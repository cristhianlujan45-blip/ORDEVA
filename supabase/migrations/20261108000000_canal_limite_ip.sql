-- =====================================================================
--  Vento 1.56.0 · Límite por conexión al publicar en los canales (auditoría ORDEVA R2, saturación)
--
--  canal_publicar no pide cuenta (el cliente del QR no tiene). Ya tenía topes por canal (240/min) y en todo el sistema
--  (6.000/min): con ese tope global, UNA sola persona mandando mensajes desde un computador podía llenarlo y frenar los
--  pedidos de TODOS los negocios. Ahora además hay un tope por conexión (la IP desde donde llega): 300 mensajes por
--  minuto (un negocio grande con su wifi —todos los clientes salen por la misma IP— usa mucho menos).
--  De la IP solo se guarda una huella (no la IP), y se borra con el mensaje a los 8 días.
--  No borra nada. Se puede volver a correr sin dañar nada.
-- =====================================================================

alter table public.canal_mensajes add column if not exists origen_h text;
create index if not exists canal_mensajes_origen_idx on public.canal_mensajes(origen_h, creado) where origen_h is not null;

-- La IP de quien llama, como la entrega el servidor de Supabase (x-forwarded-for; la primera es la del cliente).
create or replace function public.canal_origen() returns text
language plpgsql stable security definer set search_path = public, extensions as $$
declare h jsonb; ip text;
begin
  begin h := nullif(current_setting('request.headers', true), '')::jsonb; exception when others then h := null; end;
  if h is null then return null; end if;
  ip := nullif(trim(split_part(coalesce(h->>'x-forwarded-for', h->>'x-real-ip', ''), ',', 1)), '');
  if ip is null then return null; end if;
  return left(encode(digest('vento-canal:' || ip, 'sha256'), 'hex'), 24);
end $$;

-- Igual que antes (20261022000000_seguridad.sql) + el tope por conexión.
create or replace function public.canal_publicar(p_canal text, p_cuerpo text, p_titulo text default null) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare m canal_mensajes%rowtype; n int; o text := public.canal_origen();
begin
  if p_canal is null or p_canal !~ '^[A-Za-z0-9_-]{4,80}$' then raise exception 'canal_invalido'; end if;
  if p_cuerpo is null or char_length(p_cuerpo) > 32768 then raise exception 'mensaje_grande'; end if;
  -- Límite por canal: 240 mensajes por minuto (un negocio con mucho movimiento usa muchos menos).
  select count(*) into n from canal_mensajes where canal = p_canal and creado > now() - interval '1 minute';
  if n >= 240 then raise exception 'demasiados'; end if;
  -- Límite por conexión: 300 por minuto (así una sola persona no llena el tope de todo el sistema).
  if o is not null and (select count(*) from canal_mensajes where origen_h = o and creado > now() - interval '1 minute') >= 300 then raise exception 'demasiados'; end if;
  -- Tope GLOBAL (cualquiera puede inventar nombres de canal): 6.000 mensajes por minuto en todo Vento.
  if (select count(*) from canal_mensajes where creado > now() - interval '1 minute') >= 6000 then raise exception 'demasiados'; end if;
  insert into canal_mensajes(canal, cuerpo, titulo, origen_h) values (p_canal, p_cuerpo, left(nullif(trim(p_titulo), ''), 200), o) returning * into m;
  -- Aviso al instante a quien escucha el canal (Realtime). Si el servidor no lo tiene, quien escucha igual revisa cada pocos segundos.
  begin
    perform realtime.send(jsonb_build_object('id', m.id), 'm', 'vc-' || p_canal, false);
  exception when others then null;
  end;
  -- Limpieza: los mensajes de más de 8 días se borran de vez en cuando.
  if m.id % 200 = 0 then delete from canal_mensajes where creado < now() - interval '8 days'; end if;
  return canal_pub(m);
end $$;

revoke all on function public.canal_origen() from public, anon, authenticated;
grant execute on function public.canal_origen() to service_role;
revoke all on function public.canal_publicar(text, text, text) from public;
grant execute on function public.canal_publicar(text, text, text) to anon, authenticated, service_role;
