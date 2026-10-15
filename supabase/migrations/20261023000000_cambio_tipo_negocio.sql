-- =====================================================================
--  Cambiar el TIPO de negocio necesita permiso del administrador de Vento
--  • Al elegir el tipo (registro o asistente) se avisa que después no se puede cambiar sin permiso.
--  • Para cambiarlo, el dueño o administrador del negocio manda una solicitud (de → a). El administrador de Vento la
--    aprueba o la rechaza desde su panel. Aprobada, la app del negocio aplica el cambio sola en todos sus equipos
--    (aviso al instante por «vs-<negocio>») y la marca como aplicada.
--  Se puede volver a correr sin dañar nada.
-- =====================================================================

create table if not exists public.cambios_tipo (
  id            uuid primary key default gen_random_uuid(),
  negocio_id    uuid not null references public.negocios(id) on delete cascade,
  usuario_id    uuid references auth.users(id) on delete set null,
  email         text check (char_length(email) <= 120),
  de            text check (de is null or de ~ '^[a-z0-9_]{2,40}$'),
  de_nombre     text check (char_length(de_nombre) <= 80),
  a             text not null check (a ~ '^[a-z0-9_]{2,40}$'),
  a_nombre      text check (char_length(a_nombre) <= 80),
  propio        text check (char_length(propio) <= 30),            -- nombre propio cuando el tipo es «otro»
  motivo        text check (char_length(motivo) <= 300),
  estado        text not null default 'pendiente' check (estado in ('pendiente','aprobado','rechazado','aplicado','anulado')),
  respuesta     text check (char_length(respuesta) <= 300),
  creado_en     timestamptz not null default now(),
  resuelto_en   timestamptz,
  resuelto_por  uuid references auth.users(id) on delete set null
);
create index if not exists cambios_tipo_negocio_idx on public.cambios_tipo(negocio_id, creado_en desc);
create index if not exists cambios_tipo_estado_idx on public.cambios_tipo(estado, creado_en desc);
alter table public.cambios_tipo enable row level security;
revoke all on public.cambios_tipo from public, anon, authenticated;

create or replace function public.cambio_tipo_pub(c public.cambios_tipo) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object('id', c.id, 'negocio_id', c.negocio_id, 'de', c.de, 'de_nombre', c.de_nombre, 'a', c.a, 'a_nombre', c.a_nombre,
    'propio', c.propio, 'motivo', c.motivo, 'estado', c.estado, 'respuesta', c.respuesta, 'creado_en', c.creado_en, 'resuelto_en', c.resuelto_en)
$$;

-- Pedir el cambio (lo llama el servidor con la cuenta de quien pide). Una sola solicitud viva por negocio.
create or replace function public.srv_tipo_pedir(p_negocio uuid, p_usuario uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare c cambios_tipo%rowtype; v_a text := lower(trim(coalesce(p ->> 'a', ''))); v_de text := nullif(lower(trim(coalesce(p ->> 'de', ''))), '');
begin
  if not exists (select 1 from miembros where negocio_id = p_negocio and usuario_id = p_usuario and rol in ('dueno','admin')) then raise exception 'sin_permiso'; end if;
  if v_a !~ '^[a-z0-9_]{2,40}$' then raise exception 'tipo_invalido'; end if;
  if v_de is not null and v_de !~ '^[a-z0-9_]{2,40}$' then v_de := null; end if;
  if v_a = v_de and v_a <> 'otro' then raise exception 'tipo_igual'; end if;
  if (select count(*) from cambios_tipo where negocio_id = p_negocio and creado_en > now() - interval '1 day') >= 10 then raise exception 'demasiados'; end if;
  update cambios_tipo set estado = 'anulado' where negocio_id = p_negocio and estado = 'pendiente';
  insert into cambios_tipo(negocio_id, usuario_id, email, de, de_nombre, a, a_nombre, propio, motivo)
    values (p_negocio, p_usuario, lower((select email from auth.users where id = p_usuario)), v_de, left(nullif(trim(p ->> 'de_nombre'), ''), 80),
            v_a, left(nullif(trim(p ->> 'a_nombre'), ''), 80), left(nullif(trim(p ->> 'propio'), ''), 30), left(nullif(trim(p ->> 'motivo'), ''), 300))
    returning * into c;
  perform vento_auditar(p_negocio, p_usuario, null, 'tipo_cambio_pedido', jsonb_build_object('de', v_de, 'a', v_a));
  return cambio_tipo_pub(c) || jsonb_build_object('negocio', (select nombre from negocios where id = p_negocio));
end $$;

-- La última solicitud del negocio (cualquier miembro: la app la revisa para aplicar lo aprobado).
create or replace function public.tipo_mi_cambio(p_negocio uuid) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select case when public.es_miembro(p_negocio) then
    (select cambio_tipo_pub(c) from cambios_tipo c where c.negocio_id = p_negocio and c.estado <> 'anulado' order by c.creado_en desc limit 1) end
$$;

-- La app ya aplicó el cambio aprobado.
create or replace function public.tipo_cambio_aplicado(p_id uuid) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare c cambios_tipo%rowtype;
begin
  select * into c from cambios_tipo where id = p_id;
  if not found or not public.es_miembro(c.negocio_id) then return false; end if;
  update cambios_tipo set estado = 'aplicado' where id = p_id and estado = 'aprobado';
  return found;
end $$;

-- Panel del administrador de Vento.
create or replace function public.srv_tipo_lista(p_estado text default 'pendiente') returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select coalesce(jsonb_agg(cambio_tipo_pub(c) || jsonb_build_object('negocio', n.nombre, 'email', c.email) order by c.creado_en desc), '[]'::jsonb)
  from (select * from cambios_tipo where (coalesce(p_estado, 'pendiente') = 'todos' and estado <> 'anulado') or estado = p_estado order by creado_en desc limit 300) c
  join negocios n on n.id = c.negocio_id
$$;

create or replace function public.srv_tipo_resolver(p_id uuid, p_aprobar boolean, p_respuesta text, p_admin uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare c cambios_tipo%rowtype;
begin
  if p_admin is null or not srv_admin_es(p_admin) then raise exception 'sin_permiso'; end if;
  update cambios_tipo set estado = case when p_aprobar then 'aprobado' else 'rechazado' end, respuesta = left(nullif(trim(p_respuesta), ''), 300),
      resuelto_en = now(), resuelto_por = p_admin
    where id = p_id and estado = 'pendiente' returning * into c;
  if not found then raise exception 'solicitud_resuelta'; end if;
  perform vento_auditar(c.negocio_id, p_admin, null, case when p_aprobar then 'tipo_cambio_aprobado' else 'tipo_cambio_rechazado' end, jsonb_build_object('de', c.de, 'a', c.a));
  return cambio_tipo_pub(c);
end $$;

-- Avisos al instante: solicitud nueva → panel (vs-admin, k = 'tipo'); aprobada/rechazada → el negocio (vs-<negocio>).
create or replace function public.cambio_tipo_avisar() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  begin
    if tg_op = 'INSERT' then perform realtime.send(jsonb_build_object('t', now(), 'k', 'tipo'), 'a', 'vs-admin', false);
    elsif new.estado is distinct from old.estado and new.estado in ('aprobado','rechazado') then
      perform realtime.send(jsonb_build_object('t', now(), 'k', 'tipo'), 's', 'vs-' || new.negocio_id::text, false);
    end if;
  exception when others then null;
  end;
  return null;
end $$;
revoke all on function public.cambio_tipo_avisar() from public, anon, authenticated;
drop trigger if exists cambios_tipo_avisar on public.cambios_tipo;
create trigger cambios_tipo_avisar after insert or update on public.cambios_tipo for each row execute function public.cambio_tipo_avisar();

do $$
declare f text;
begin
  foreach f in array array['public.cambio_tipo_pub(public.cambios_tipo)', 'public.srv_tipo_pedir(uuid, uuid, jsonb)', 'public.srv_tipo_lista(text)',
    'public.srv_tipo_resolver(uuid, boolean, text, uuid)'] loop
    execute 'revoke all on function ' || f || ' from public, anon, authenticated';
    execute 'grant execute on function ' || f || ' to service_role';
  end loop;
  foreach f in array array['public.tipo_mi_cambio(uuid)', 'public.tipo_cambio_aplicado(uuid)'] loop
    execute 'revoke all on function ' || f || ' from public, anon';
    execute 'grant execute on function ' || f || ' to authenticated, service_role';
  end loop;
end $$;
