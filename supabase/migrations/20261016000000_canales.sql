-- =====================================================================
--  Canales en vivo de Vento (reemplazan a ntfy.sh): pedidos y canciones por QR, estado del pedido para el cliente,
--  la carta, la cuenta en vivo de la mesa, la app de meseros, la pantalla de preparación, el TV de la música,
--  los avisos de pagos (MacroDroid) y el puente de WhatsApp.
--
--  Como antes, el nombre del canal es el secreto (12+ letras al azar que solo conocen el negocio y sus códigos QR).
--  La diferencia: ahora todo pasa por el servidor de Vento (sin límites diarios de un servicio público ni avisos
--  de terceros). Los mensajes duran 8 días y después se borran solos.
--  Escritura y lectura solo por funciones (con límites de tamaño y de velocidad); la tabla no se puede leer directo.
--  Se puede volver a correr sin dañar nada.
-- =====================================================================

create table if not exists public.canal_mensajes (
  id      bigserial primary key,
  canal   text not null check (canal ~ '^[A-Za-z0-9_-]{4,80}$'),
  cuerpo  text not null check (char_length(cuerpo) <= 32768),
  titulo  text check (char_length(titulo) <= 200),
  creado  timestamptz not null default now()
);
create index if not exists canal_mensajes_canal_idx on public.canal_mensajes(canal, id);
create index if not exists canal_mensajes_creado_idx on public.canal_mensajes(creado);
alter table public.canal_mensajes enable row level security;

-- Mensaje en el formato de siempre (el de ntfy), para no cambiar a quien lo lee.
create or replace function public.canal_pub(m public.canal_mensajes) returns jsonb
language sql immutable as $$
  select jsonb_build_object('id', m.id::text, 'time', floor(extract(epoch from m.creado))::bigint, 'event', 'message', 'topic', m.canal, 'message', m.cuerpo)
    || case when m.titulo is not null then jsonb_build_object('title', m.titulo) else '{}'::jsonb end
$$;

-- Publicar en un canal (con o sin cuenta: el cliente que pide por QR no tiene cuenta).
create or replace function public.canal_publicar(p_canal text, p_cuerpo text, p_titulo text default null) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare m canal_mensajes%rowtype; n int;
begin
  if p_canal is null or p_canal !~ '^[A-Za-z0-9_-]{4,80}$' then raise exception 'canal_invalido'; end if;
  if p_cuerpo is null or char_length(p_cuerpo) > 32768 then raise exception 'mensaje_grande'; end if;
  -- Límite por canal: 240 mensajes por minuto (un negocio con mucho movimiento usa muchos menos).
  select count(*) into n from canal_mensajes where canal = p_canal and creado > now() - interval '1 minute';
  if n >= 240 then raise exception 'demasiados'; end if;
  insert into canal_mensajes(canal, cuerpo, titulo) values (p_canal, p_cuerpo, left(nullif(trim(p_titulo), ''), 200)) returning * into m;
  -- Aviso al instante a quien escucha el canal (Realtime). Si el servidor no lo tiene, quien escucha igual revisa cada pocos segundos.
  begin
    perform realtime.send(jsonb_build_object('id', m.id), 'm', 'vc-' || p_canal, false);
  exception when others then null;
  end;
  -- Limpieza: los mensajes de más de 8 días se borran de vez en cuando.
  if m.id % 200 = 0 then delete from canal_mensajes where creado < now() - interval '8 days'; end if;
  return canal_pub(m);
end $$;

-- Leer uno o varios canales: lo que llegó después de p_desde_id, o desde la fecha p_desde (segundos unix).
create or replace function public.canal_leer(p_canales text[], p_desde_id bigint default null, p_desde bigint default null, p_limite int default 300)
returns jsonb language sql stable security definer set search_path = public, extensions as $$
  select coalesce(jsonb_agg(canal_pub(x) order by x.id), '[]'::jsonb) from (
    select * from canal_mensajes
     where canal = any(p_canales[1:20])
       and (p_desde_id is null or id > p_desde_id)
       and (p_desde is null or creado >= to_timestamp(p_desde))
       and creado > now() - interval '8 days'
     order by id desc
     limit greatest(1, least(coalesce(p_limite, 300), 500))) x
$$;

do $$
declare f text;
begin
  foreach f in array array['public.canal_publicar(text, text, text)', 'public.canal_leer(text[], bigint, bigint, int)'] loop
    execute 'revoke all on function ' || f || ' from public';
    execute 'grant execute on function ' || f || ' to anon, authenticated, service_role';
  end loop;
  execute 'revoke all on function public.canal_pub(public.canal_mensajes) from public, anon, authenticated';
  execute 'grant execute on function public.canal_pub(public.canal_mensajes) to service_role';
end $$;
revoke all on public.canal_mensajes from anon, authenticated;
