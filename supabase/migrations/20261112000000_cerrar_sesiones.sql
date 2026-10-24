-- =====================================================================
-- ORDEVA 1.61.0 · «🚪 Cerrar sesión en todos los equipos» sin cambiar la contraseña
--   • perfiles.sesiones_cerradas_en: cuándo se pidió. Cada equipo abierto con esa cuenta lo compara con lo que vio al
--     entrar (igual que la hora de la contraseña, 1.60.0): si cambió, guarda todo, sale y pide entrar otra vez (con
--     internet, porque la contraseña guardada en ese celular deja de servir).
--   • Lo pide ORDEVA Admin (srv_cerrar_sesiones) o la persona misma desde otro equipo (perfil_guardar «cerrar_sesiones»).
--   Sin borrar nada: una columna nueva y funciones.
-- =====================================================================

alter table public.perfiles add column if not exists sesiones_cerradas_en timestamptz;

create or replace function public.perfil_yo() returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object('telefono', p.telefono, 'nombre', p.nombre, 'acepto_licencia', p.acepto_licencia,
           'cambiar_clave', coalesce(p.cambiar_clave, false), 'admin', srv_admin_es(auth.uid()), 'clave_puesta_en', p.clave_puesta_en,
           'sesiones_cerradas_en', p.sesiones_cerradas_en)
  from (select auth.uid() as id) yo left join perfiles p on p.usuario_id = yo.id
  where auth.uid() is not null
$$;

create or replace function public.perfil_guardar(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v_tel text := nullif(regexp_replace(coalesce(p ->> 'telefono', ''), '[\s().-]', '', 'g'), '');
        v_nueva boolean := coalesce((p ->> 'clave_nueva')::boolean, false);
        v_cerrar boolean := coalesce((p ->> 'cerrar_sesiones')::boolean, false);
begin
  if auth.uid() is null then raise exception 'sin_sesion'; end if;
  if v_tel is not null and v_tel !~ '^\+?[0-9]{7,15}$' then raise exception 'telefono_invalido'; end if;
  insert into perfiles as x (usuario_id, telefono, nombre, acepto_licencia, cambiar_clave, clave_puesta_en, sesiones_cerradas_en)
    values (auth.uid(), v_tel, left(nullif(trim(p ->> 'nombre'), ''), 80),
            case when (p ->> 'acepto_licencia')::boolean then now() end, false, case when v_nueva then now() end, case when v_cerrar then now() end)
  on conflict (usuario_id) do update set
    telefono = case when p ? 'telefono' then v_tel else x.telefono end,
    nombre = coalesce(left(nullif(trim(p ->> 'nombre'), ''), 80), x.nombre),
    acepto_licencia = coalesce(x.acepto_licencia, case when (p ->> 'acepto_licencia')::boolean then now() end),
    cambiar_clave = case when (p ->> 'clave_cambiada')::boolean then false else x.cambiar_clave end,
    clave_puesta_en = case when v_nueva then now() else x.clave_puesta_en end,
    sesiones_cerradas_en = case when v_cerrar then now() else x.sesiones_cerradas_en end,
    actualizado_en = now();
  if v_nueva or v_cerrar then
    begin perform srv_usuario_avisar(auth.uid(), 'clave'); exception when others then null; end;
  end if;
  return perfil_yo();
end $$;

-- ORDEVA Admin cierra la sesión de una cuenta en todos sus equipos.
create or replace function public.srv_cerrar_sesiones(p_usuario uuid) returns timestamptz
language plpgsql security definer set search_path = public, extensions as $$
declare t timestamptz := now();
begin
  if not exists (select 1 from auth.users where id = p_usuario) then raise exception 'no_existe'; end if;
  insert into perfiles as x (usuario_id, sesiones_cerradas_en) values (p_usuario, t)
  on conflict (usuario_id) do update set sesiones_cerradas_en = t, actualizado_en = now();
  begin perform srv_usuario_avisar(p_usuario, 'clave'); exception when others then null; end;
  return t;
end $$;

revoke all on function public.srv_cerrar_sesiones(uuid) from public, anon, authenticated;
grant execute on function public.srv_cerrar_sesiones(uuid) to service_role;
revoke all on function public.perfil_yo(), public.perfil_guardar(jsonb) from public, anon;
grant execute on function public.perfil_yo(), public.perfil_guardar(jsonb) to authenticated, service_role;
