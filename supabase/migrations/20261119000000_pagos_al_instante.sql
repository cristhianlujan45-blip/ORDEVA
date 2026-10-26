-- =====================================================================
-- ORDEVA 1.65.3 · El pago les llega AL INSTANTE a todos los celulares del negocio (también bloqueados)
--   Antes la app Android de cada celular preguntaba cada 2,5 s si había pagos nuevos: entre un celular y otro había hasta
--   2,5 s (más la red). Ahora, apenas un pago queda aprobado (o se marca falso), el servidor manda un aviso en vivo por el
--   canal secreto del negocio («vp-<canal>», Supabase Realtime) y cada app Android pregunta en ese mismo momento.
--   El aviso no lleva datos del pago (solo «hay algo nuevo»): el pago se pide con el token del celular, como siempre.
--   La pregunta cada 2,5 s sigue de respaldo. Sin borrar nada; se puede volver a correr.
-- =====================================================================

-- Un canal secreto por negocio (no es el id del negocio: no se puede adivinar).
create table if not exists public.pagos_canal_vivo (
  negocio_id uuid primary key references public.negocios(id) on delete cascade,
  canal      text not null default encode(extensions.gen_random_bytes(16), 'hex'),
  creado_en  timestamptz not null default now()
);
alter table public.pagos_canal_vivo enable row level security;
revoke all on public.pagos_canal_vivo from anon, authenticated;

create or replace function public.pagos_canal_de(p_negocio uuid) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare c text;
begin
  select canal into c from pagos_canal_vivo where negocio_id = p_negocio;
  if c is null then
    insert into pagos_canal_vivo(negocio_id) values (p_negocio) on conflict (negocio_id) do nothing;
    select canal into c from pagos_canal_vivo where negocio_id = p_negocio;
  end if;
  return c;
end $$;
revoke all on function public.pagos_canal_de(uuid) from public, anon, authenticated;
grant execute on function public.pagos_canal_de(uuid) to service_role;

-- Aviso en vivo cuando un pago queda aprobado (o falso): es lo mismo que pagos_dispositivo le entrega a Android.
create or replace function public.trg_pago_al_instante() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  if (new.estado = 'aprobado' or (new.estado = 'rechazado' and new.confianza = 'falso'))
     and (tg_op = 'INSERT' or old.estado is distinct from new.estado or old.confianza is distinct from new.confianza) then
    begin
      perform realtime.send(jsonb_build_object('t', extract(epoch from now())), 'p', 'vp-' || public.pagos_canal_de(new.negocio_id), false);
    exception when others then null;   -- sin Realtime, la pregunta cada 2,5 s lo trae igual
    end;
  end if;
  return null;
end $$;
drop trigger if exists pago_al_instante on public.pagos;
create trigger pago_al_instante after insert or update of estado, confianza on public.pagos
  for each row execute function public.trg_pago_al_instante();

-- pagos_dispositivo: igual que 20261118000000, más «vivo» (el canal en vivo del negocio para la app Android).
create or replace function public.pagos_dispositivo(p_token text, p_desde timestamptz default null)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare d dispositivos%rowtype; r text; l jsonb;
begin
  if p_token is null or length(p_token) < 20 then return jsonb_build_object('ok', false, 'error', 'sin_token'); end if;
  select * into d from dispositivos where token_hash = encode(digest(p_token, 'sha256'), 'hex') and revocado_en is null;
  if not found then return jsonb_build_object('ok', false, 'error', 'dispositivo_no_autorizado'); end if;
  select rol into r from miembros where negocio_id = d.negocio_id and usuario_id = d.usuario_id;
  if r is null then return jsonb_build_object('ok', false, 'error', 'sin_permiso'); end if;
  update dispositivos set ultimo_visto = now() where id = d.id;
  select coalesce(jsonb_agg(x), '[]'::jsonb) into l from (
    select pago_para(p, d.usuario_id) || jsonb_build_object('de_dispositivo',
        (select e.cuerpo->>'dispositivo' from pago_eventos e
          where e.negocio_id = p.negocio_id and e.recibido_en > now() - interval '3 hours'
            and p.referencia like 'AV-%' and e.huella like 'aviso:' || substr(p.referencia, 4) || '%' limit 1)) as x
      from pagos p
      where p.negocio_id = d.negocio_id
        and p.actualizado_en > greatest(coalesce(p_desde, now() - interval '10 minutes'), now() - interval '2 hours')
        and (p.estado = 'aprobado' or (p.estado = 'rechazado' and p.confianza = 'falso'))
      order by p.actualizado_en asc limit 30) s;
  return jsonb_build_object('ok', true, 'rol', r, 'dispositivo', d.id, 'suena', coalesce(d.suena, true),
    'vivo', 'vp-' || public.pagos_canal_de(d.negocio_id), 'ahora', now(), 'pagos', l);
end $$;

revoke all on function public.pagos_dispositivo(text, timestamptz) from public;
grant execute on function public.pagos_dispositivo(text, timestamptz) to anon, authenticated, service_role;
