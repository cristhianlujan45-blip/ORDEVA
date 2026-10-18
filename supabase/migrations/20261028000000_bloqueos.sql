-- =====================================================================
-- Vento · Bloquear un NEGOCIO o un USUARIO desde Vento Admin, con efecto AL INSTANTE en todos sus celulares
--  • negocios.bloqueado_en + bloqueo_motivo: el negocio bloqueado no funciona en ningún equipo («🔒 Cuenta bloqueada»).
--  • Bloquear la cuenta de un usuario (ban de Auth) también se aplica ya: /estado lo responde a sus equipos.
--  • Cada cambio avisa por el mismo canal en vivo de las suscripciones («vs-<negocio>», 20261018000000) para que los
--    equipos vuelvan a preguntar su estado sin esperar; y al panel («vs-admin»).
-- Idempotente: se puede correr otra vez sin errores.
-- =====================================================================

alter table public.negocios add column if not exists bloqueado_en timestamptz;
alter table public.negocios add column if not exists bloqueo_motivo text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'negocios_bloqueo_motivo_largo') then
    alter table public.negocios add constraint negocios_bloqueo_motivo_largo check (bloqueo_motivo is null or char_length(bloqueo_motivo) <= 300);
  end if;
end $$;

-- Aviso en vivo a los equipos de un negocio (sin Realtime, en pruebas locales, no hace nada).
create or replace function public.srv_negocio_avisar(p_negocio uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  begin
    perform realtime.send(jsonb_build_object('t', now(), 'k', left(coalesce(p_motivo, ''), 40)), 's', 'vs-' || p_negocio::text, false);
    perform realtime.send(jsonb_build_object('t', now(), 'k', 'bloqueo'), 'a', 'vs-admin', false);
  exception when others then null;
  end;
end $$;

-- Todos los negocios de un usuario (al bloquearlo o desbloquearlo). Devuelve cuántos.
create or replace function public.srv_usuario_avisar(p_usuario uuid, p_motivo text) returns integer
language plpgsql security definer set search_path = public, extensions as $$
declare n uuid; c integer := 0;
begin
  for n in select negocio_id from miembros where usuario_id = p_usuario loop
    perform srv_negocio_avisar(n, p_motivo); c := c + 1;
  end loop;
  return c;
end $$;

create or replace function public.trg_negocio_bloqueo() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  if new.bloqueado_en is distinct from old.bloqueado_en or new.bloqueo_motivo is distinct from old.bloqueo_motivo then
    perform srv_negocio_avisar(new.id, 'bloqueo');
  end if;
  return null;
end $$;
drop trigger if exists negocio_bloqueo_avisar on public.negocios;
create trigger negocio_bloqueo_avisar after update on public.negocios
  for each row execute function public.trg_negocio_bloqueo();

-- Bloquear / desbloquear un negocio (solo el servidor, desde Vento Admin).
create or replace function public.srv_negocio_bloquear(p_negocio uuid, p_bloquear boolean, p_motivo text, p_admin uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare n negocios%rowtype;
begin
  update negocios set bloqueado_en = case when p_bloquear then coalesce(bloqueado_en, now()) else null end,
                      bloqueo_motivo = case when p_bloquear then nullif(left(trim(coalesce(p_motivo, '')), 300), '') else null end
    where id = p_negocio returning * into n;
  if not found then raise exception 'no_existe'; end if;
  perform vento_auditar(p_negocio, p_admin, null, case when p_bloquear then 'negocio_bloqueado' else 'negocio_desbloqueado' end,
                        jsonb_build_object('motivo', n.bloqueo_motivo));
  return jsonb_build_object('id', n.id, 'bloqueado_en', n.bloqueado_en, 'bloqueo_motivo', n.bloqueo_motivo);
end $$;

-- ¿Bloqueado? (la cuenta de quien pregunta o el negocio). Lo usa /estado en cada consulta.
create or replace function public.srv_bloqueo_de(p_negocio uuid, p_usuario uuid) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select case
    when exists (select 1 from auth.users u where u.id = p_usuario and u.banned_until is not null and u.banned_until > now())
      then jsonb_build_object('tipo', 'usuario', 'motivo', null)
    when (select bloqueado_en from negocios where id = p_negocio) is not null
      then jsonb_build_object('tipo', 'negocio', 'motivo', (select bloqueo_motivo from negocios where id = p_negocio), 'desde', (select bloqueado_en from negocios where id = p_negocio))
    else null end
$$;

revoke all on function public.srv_negocio_avisar(uuid, text), public.srv_usuario_avisar(uuid, text), public.srv_negocio_bloquear(uuid, boolean, text, uuid),
  public.srv_bloqueo_de(uuid, uuid), public.trg_negocio_bloqueo() from public, anon, authenticated;
grant execute on function public.srv_negocio_avisar(uuid, text), public.srv_usuario_avisar(uuid, text), public.srv_negocio_bloquear(uuid, boolean, text, uuid),
  public.srv_bloqueo_de(uuid, uuid) to service_role;

-- Vento Admin ve si el negocio está bloqueado (lista y detalle).
create or replace function public.srv_admin_negocios() returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select coalesce(jsonb_agg(x.j order by x.t desc), '[]'::jsonb) from (
    select jsonb_build_object('id', n.id, 'nombre', n.nombre, 'creado_en', n.creado_en,
        'dueno_email', coalesce((select m.email from miembros m where m.negocio_id = n.id and m.rol = 'dueno' limit 1),
                                (select email from auth.users where id = n.creado_por)),
        'miembros', (select count(*) from miembros m where m.negocio_id = n.id),
        'bloqueado_en', n.bloqueado_en, 'bloqueo_motivo', n.bloqueo_motivo,
        'suscripcion', sub_sus_pub(s), 'plan_efectivo', sub_plan_de(n.id),
        'resumen', sub_resumen(coalesce(d.datos, '{}'::jsonb)) || jsonb_build_object('actualizado_en', d.actualizado_en)) as j,
      n.creado_en as t
    from negocios n left join subscriptions s on s.business_id = n.id left join datos_negocio d on d.negocio_id = n.id
    order by n.creado_en desc limit 1000) x
$$;

create or replace function public.srv_admin_negocio(p_negocio uuid) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare n negocios%rowtype; s subscriptions%rowtype; d datos_negocio%rowtype;
begin
  select * into n from negocios where id = p_negocio;
  if not found then raise exception 'no_existe'; end if;
  select * into s from subscriptions where business_id = p_negocio;
  select * into d from datos_negocio where negocio_id = p_negocio;
  return jsonb_build_object(
    'negocio', jsonb_build_object('id', n.id, 'nombre', n.nombre, 'creado_en', n.creado_en, 'bloqueado_en', n.bloqueado_en, 'bloqueo_motivo', n.bloqueo_motivo,
                                  'creado_por_email', (select email from auth.users where id = n.creado_por)),
    'miembros', coalesce((select jsonb_agg(jsonb_build_object('nombre', m.nombre, 'email', m.email, 'rol', m.rol, 'creado_en', m.creado_en) order by m.creado_en)
                          from miembros m where m.negocio_id = p_negocio), '[]'::jsonb),
    'suscripcion', sub_sus_pub(s),
    'plan_efectivo', sub_plan_de(p_negocio),
    'entitlements', sub_ents(sub_plan_de(p_negocio)),
    'pagos', coalesce((select jsonb_agg(sub_pago_pub(p) || jsonb_build_object('comprobante', exists (select 1 from payment_proofs pr where pr.payment_id = p.id)) order by p.created_at desc)
                       from (select * from payment_records where business_id = p_negocio order by created_at desc limit 50) p), '[]'::jsonb),
    'eventos', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'type', e.type, 'payment_id', e.payment_id, 'actor', e.actor, 'data', e.data, 'created_at', e.created_at) order by e.id desc)
                         from (select * from payment_events where business_id = p_negocio order by id desc limit 100) e), '[]'::jsonb),
    'resumen', sub_resumen(coalesce(d.datos, '{}'::jsonb)) || jsonb_build_object('actualizado_en', d.actualizado_en, 'version', d.version));
end $$;
