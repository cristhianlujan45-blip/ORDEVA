-- =====================================================================
-- ORDEVA 1.62.0 · El PIN de los empleados (4 a 6 números) también va a todos los equipos del negocio
--   usuarios_equipo.pin: { s: sal, h: huella } (PBKDF2, como la contraseña; nunca el PIN). Solo dueño y administrador
--   lo leen o lo cambian, por las mismas funciones de 20261111000000 (la tabla no se lee directo).
--   usuarios_equipo_guardar_v2 = la de antes + el PIN. La de antes sigue igual (los equipos con 1.60/1.61 la usan y
--   no tocan el PIN).
--   Sin borrar nada: una columna y una función nuevas.
-- =====================================================================

alter table public.usuarios_equipo add column if not exists pin jsonb;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'usuarios_equipo_pin_forma') then
    alter table public.usuarios_equipo add constraint usuarios_equipo_pin_forma check (pin is null or (jsonb_typeof(pin) = 'object' and octet_length(pin::text) <= 400));
  end if;
end $$;

create or replace function public.usuarios_equipo_lista(p_negocio uuid) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if coalesce(public.rol_en(p_negocio), '') not in ('dueno', 'admin') then raise exception 'sin_permiso'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('usuario', u.usuario, 'salt', u.salt, 'hash', u.hash, 'rol', u.rol, 'pin', u.pin,
                                                       'borrado', u.borrado, 'version', u.version, 'actualizado_en', u.actualizado_en) order by u.usuario)
                   from usuarios_equipo u where u.negocio_id = p_negocio), '[]'::jsonb);
end $$;

create or replace function public.usuarios_equipo_guardar_v2(p_negocio uuid, p_usuario text, p_salt text, p_hash text, p_rol text, p_borrado boolean, p_pin jsonb)
returns bigint
language plpgsql security definer set search_path = public, extensions as $$
declare v bigint; v_u text := lower(trim(coalesce(p_usuario, ''))); v_pin jsonb := p_pin;
begin
  if v_pin is not null and (jsonb_typeof(v_pin) <> 'object' or coalesce(v_pin ->> 's', '') = '' or coalesce(v_pin ->> 'h', '') = ''
     or octet_length(v_pin::text) > 400 or coalesce(p_rol, 'staff') = 'admin') then raise exception 'pin_invalido'; end if;
  v := public.usuarios_equipo_guardar(p_negocio, p_usuario, p_salt, p_hash, p_rol, p_borrado);   -- permisos y validaciones de siempre
  update usuarios_equipo set pin = case when coalesce(p_borrado, false) or v_pin is null then null else jsonb_build_object('s', v_pin ->> 's', 'h', v_pin ->> 'h') end
   where negocio_id = p_negocio and usuario = v_u;
  return v;
end $$;

revoke all on function public.usuarios_equipo_lista(uuid), public.usuarios_equipo_guardar_v2(uuid, text, text, text, text, boolean, jsonb) from public, anon;
grant execute on function public.usuarios_equipo_lista(uuid), public.usuarios_equipo_guardar_v2(uuid, text, text, text, text, boolean, jsonb) to authenticated, service_role;
