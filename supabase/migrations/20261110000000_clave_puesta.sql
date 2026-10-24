-- =====================================================================
-- ORDEVA 1.60.0 · Al cambiar la contraseña se cierra la sesión que estaba abierta en otros equipos
--   • perfiles.clave_puesta_en: cuándo se puso la contraseña por última vez (desde ORDEVA Admin o la persona misma).
--   • Cada equipo abierto con esa cuenta compara el valor con el que vio al entrar: si cambió, cierra la sesión y
--     pide la contraseña nueva. El aviso en vivo del negocio («vs-<negocio>») hace que lo revisen al instante.
--   • No se borran sesiones del servidor: los equipos de los empleados que sincronizan con la cuenta del dueño
--     siguen sincronizando; solo sale quien estaba adentro CON esa cuenta.
--   Sin borrar nada: solo una columna nueva y funciones.
-- =====================================================================

alter table public.perfiles add column if not exists clave_puesta_en timestamptz;

create or replace function public.perfil_yo() returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object('telefono', p.telefono, 'nombre', p.nombre, 'acepto_licencia', p.acepto_licencia,
           'cambiar_clave', coalesce(p.cambiar_clave, false), 'admin', srv_admin_es(auth.uid()), 'clave_puesta_en', p.clave_puesta_en)
  from (select auth.uid() as id) yo left join perfiles p on p.usuario_id = yo.id
  where auth.uid() is not null
$$;

-- Igual que antes, más «clave_nueva»: la persona cambió su contraseña (los otros equipos abiertos salen).
create or replace function public.perfil_guardar(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v_tel text := nullif(regexp_replace(coalesce(p ->> 'telefono', ''), '[\s().-]', '', 'g'), '');
        v_nueva boolean := coalesce((p ->> 'clave_nueva')::boolean, false);
begin
  if auth.uid() is null then raise exception 'sin_sesion'; end if;
  if v_tel is not null and v_tel !~ '^\+?[0-9]{7,15}$' then raise exception 'telefono_invalido'; end if;
  insert into perfiles as x (usuario_id, telefono, nombre, acepto_licencia, cambiar_clave, clave_puesta_en)
    values (auth.uid(), v_tel, left(nullif(trim(p ->> 'nombre'), ''), 80),
            case when (p ->> 'acepto_licencia')::boolean then now() end, false, case when v_nueva then now() end)
  on conflict (usuario_id) do update set
    telefono = case when p ? 'telefono' then v_tel else x.telefono end,
    nombre = coalesce(left(nullif(trim(p ->> 'nombre'), ''), 80), x.nombre),
    acepto_licencia = coalesce(x.acepto_licencia, case when (p ->> 'acepto_licencia')::boolean then now() end),
    cambiar_clave = case when (p ->> 'clave_cambiada')::boolean then false else x.cambiar_clave end,
    clave_puesta_en = case when v_nueva then now() else x.clave_puesta_en end,
    actualizado_en = now();
  if v_nueva then
    begin perform srv_usuario_avisar(auth.uid(), 'clave'); exception when others then null; end;
  end if;
  return perfil_yo();
end $$;

-- ORDEVA Admin le puso (o le dio una temporal) la contraseña a una cuenta.
create or replace function public.srv_clave_puesta(p_usuario uuid) returns timestamptz
language plpgsql security definer set search_path = public, extensions as $$
declare t timestamptz := now();
begin
  insert into perfiles as x (usuario_id, clave_puesta_en) values (p_usuario, t)
  on conflict (usuario_id) do update set clave_puesta_en = t, actualizado_en = now();
  begin perform srv_usuario_avisar(p_usuario, 'clave'); exception when others then null; end;
  return t;
end $$;

revoke all on function public.srv_clave_puesta(uuid) from public, anon, authenticated;
grant execute on function public.srv_clave_puesta(uuid) to service_role;
revoke all on function public.perfil_yo(), public.perfil_guardar(jsonb) from public, anon;
grant execute on function public.perfil_yo(), public.perfil_guardar(jsonb) to authenticated, service_role;
