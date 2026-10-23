-- =====================================================================
--  Vento 1.54.0 · El QR del cliente ya no deja leer los pedidos del negocio (hallazgo D8 de la auditoría de datos)
--
--  Antes: el nombre del canal de pedidos va en el QR de cada mesa, y con ese nombre cualquiera podía LEER 8 días de
--  pedidos de todo el negocio: domicilios con nombre, teléfono y dirección, avisos de pago, canciones…
--  (canal_leer con la clave pública). El cliente del QR nunca lo necesitó: él solo ESCRIBE ahí; lo que él lee son
--  otros canales (el estado de su pedido «…e», la carta «…k», las fotos «…f», el ambiente «…a» y la cuenta de su mesa).
--  Ahora:
--    • El servidor sabe de qué negocio es cada canal de pedidos: los que el negocio tiene en sus datos (qrCanales y
--      qrFijo.topic). Se anotan solos al guardar; el primero que lo anota se queda con él (nadie se puede «apropiar»
--      del canal de otro poniéndolo en sus propios datos).
--    • Leer un canal de pedidos pide la sesión de un miembro de ESE negocio (la app del local ya la tiene). El cliente
--      del QR sigue mandando pedidos y canciones igual.
--    • 7 días de gracia desde esta versión: mientras tanto se sigue leyendo como antes, para que ningún celular del
--      local con la versión anterior (que lee sin sesión) se quede sin recibir pedidos. Los canales que se anoten
--      después de esa fecha quedan cerrados de una vez.
--  No borra nada. Se puede volver a correr sin dañar nada.
-- =====================================================================

create table if not exists public.canal_privado (
  canal         text primary key check (canal ~ '^[A-Za-z0-9_-]{4,80}$'),
  negocio_id    uuid not null references public.negocios(id) on delete cascade,
  creado_en     timestamptz not null default now(),
  cerrar_desde  timestamptz not null
);
create index if not exists canal_privado_negocio_idx on public.canal_privado(negocio_id);
alter table public.canal_privado enable row level security;
revoke all on public.canal_privado from anon, authenticated;

-- Fecha desde la que se cierran (una sola vez: la primera vez que corre esta migración + 7 días).
insert into public.servidor_config(clave, valor) values ('canal_privado_desde', jsonb_build_object('t', now() + interval '7 days'))
on conflict (clave) do nothing;
create or replace function public.canal_privado_inicio() returns timestamptz
language sql stable security definer set search_path = public, extensions as $$
  select greatest(now(), coalesce((select (valor->>'t')::timestamptz from servidor_config where clave = 'canal_privado_desde'), now()))
$$;

-- Los canales de pedidos que el negocio tiene en sus datos.
create or replace function public.canales_pedidos_de(p_datos jsonb) returns text[]
language sql immutable set search_path = public, extensions as $$
  select coalesce(array_agg(distinct c), '{}') from (
    select jsonb_array_elements_text(case when jsonb_typeof(p_datos->'qrCanales') = 'array' then p_datos->'qrCanales' else '[]'::jsonb end) c
    union all select p_datos->'qrFijo'->>'topic'
  ) x where c ~ '^[A-Za-z0-9_-]{6,64}$'
$$;

create or replace function public.canal_privado_anotar(p_negocio uuid, p_datos jsonb) returns void
language sql security definer set search_path = public, extensions as $$
  insert into canal_privado(canal, negocio_id, cerrar_desde)
    select c, p_negocio, canal_privado_inicio() from unnest(canales_pedidos_de(p_datos)) c
  on conflict (canal) do nothing
$$;

-- Los que ya existen: el negocio más antiguo que lo tenga se queda con él.
insert into public.canal_privado(canal, negocio_id, cerrar_desde)
  select distinct on (c) c, d.negocio_id, public.canal_privado_inicio()
  from public.datos_negocio d join public.negocios n on n.id = d.negocio_id, unnest(public.canales_pedidos_de(d.datos)) c
  order by c, n.creado_en
on conflict (canal) do nothing;

-- Igual que antes (20261101000000_ia_clave_servidor.sql) + anotar los canales de pedidos del negocio.
create or replace function public.guardar_datos(p_negocio uuid, p_datos jsonb, p_version bigint)
returns bigint language plpgsql security definer set search_path = public, extensions as $$
declare v bigint; ult timestamptz;
begin
  if not public.es_miembro(p_negocio) then raise exception 'sin_permiso'; end if;
  if p_datos ? 'iaClave' then
    begin perform public.ia_clave_recibir(p_negocio, p_datos->>'iaClave'); exception when others then null; end;
    p_datos := p_datos - 'iaClave';
  end if;
  update datos_negocio set datos = p_datos, version = version + 1, actualizado_por = auth.uid(), actualizado_en = now()
    where negocio_id = p_negocio and version = p_version returning version into v;
  if v is null then raise exception 'conflicto'; end if;
  begin perform public.canal_privado_anotar(p_negocio, p_datos); exception when others then null; end;
  -- Respaldo automático: como máximo uno por hora, se guardan los últimos 48.
  select max(creado_en) into ult from respaldos where negocio_id = p_negocio;
  if ult is null or ult < now() - interval '1 hour' then
    insert into respaldos(negocio_id, datos, version, creado_por) values (p_negocio, p_datos, v, auth.uid());
    delete from respaldos where negocio_id = p_negocio and id not in
      (select id from respaldos where negocio_id = p_negocio order by creado_en desc limit 48);
  end if;
  return v;
end $$;

-- Leer canales: igual que antes, pero un canal de pedidos (ya cerrado) solo lo lee un miembro de su negocio.
create or replace function public.canal_leer(p_canales text[], p_desde_id bigint default null, p_desde bigint default null, p_limite int default 300)
returns jsonb language plpgsql stable security definer set search_path = public, extensions as $$
declare ok text[];
begin
  select coalesce(array_agg(c), '{}') into ok from unnest(p_canales[1:20]) c
   where not exists (select 1 from canal_privado p where p.canal = c and p.cerrar_desde <= now() and not public.es_miembro(p.negocio_id));
  return (select coalesce(jsonb_agg(canal_pub(x) order by x.id), '[]'::jsonb) from (
    select * from canal_mensajes
     where canal = any(ok)
       and (p_desde_id is null or id > p_desde_id)
       and (p_desde is null or creado >= to_timestamp(p_desde))
       and creado > now() - interval '8 days'
     order by id desc
     limit greatest(1, least(coalesce(p_limite, 300), 500))) x);
end $$;

revoke all on function public.canal_privado_anotar(uuid, jsonb), public.canal_privado_inicio() from public, anon, authenticated;
grant execute on function public.canal_privado_anotar(uuid, jsonb), public.canal_privado_inicio() to service_role;
revoke all on function public.canal_leer(text[], bigint, bigint, int) from public;
grant execute on function public.canal_leer(text[], bigint, bigint, int) to anon, authenticated, service_role;
grant execute on function public.canales_pedidos_de(jsonb) to anon, authenticated, service_role;
