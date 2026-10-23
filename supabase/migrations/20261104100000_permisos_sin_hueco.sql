-- =====================================================================
--  Vento 1.54.0 · Arreglo de seguridad: tres permisos dejaban pasar a alguien que NO es del negocio
--
--  rol_en(negocio) devuelve NULL para quien no es miembro, y en SQL «NULL not in (...)» y «NULL <> 'dueno'» no son
--  verdaderos: el «if … then raise» no saltaba. Así, cualquier cuenta con sesión que conociera el id de un negocio
--  podía:
--    • crear_invitacion: sacar un código (incluso de administrador) y unirse a ese negocio;
--    • cambiar_rol: cambiarle el rol a los miembros de ese negocio;
--    • restaurar_respaldo: restaurar un respaldo de ese negocio.
--  Ahora las tres piden de verdad ser dueño (o administrador, donde aplica). Lo demás queda exactamente igual.
--  Las demás funciones ya revisaban «r is null» antes (pagos_puedo, integracion_puedo, sub_puedo, dian, ia, …).
--
--  Además, por si alguien lo usó: los códigos de invitación SIN USAR hechos por alguien que no es dueño ni
--  administrador de ese negocio quedan vencidos, y cada código así (usado o no) queda en la auditoría del negocio
--  como «invitacion_sospechosa» para revisarlo. No se borra nada ni se saca a nadie.
--  Se puede volver a correr sin dañar nada.
-- =====================================================================

create or replace function public.crear_invitacion(p_negocio uuid, p_rol text)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare c text; yo text := coalesce(public.rol_en(p_negocio), '');
begin
  if yo not in ('dueno','admin') then raise exception 'sin_permiso'; end if;
  if p_rol not in ('admin','cajero','mesero','empleado') then raise exception 'rol_invalido'; end if;
  if p_rol = 'admin' and yo <> 'dueno' then raise exception 'sin_permiso'; end if;
  c := upper(substr(translate(encode(gen_random_bytes(9), 'base64'), '+/=0O1Il', ''), 1, 8));
  insert into invitaciones(codigo, negocio_id, rol, creado_por) values (c, p_negocio, p_rol, auth.uid());
  return c;
end $$;

create or replace function public.cambiar_rol(p_negocio uuid, p_usuario uuid, p_rol text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if public.rol_en(p_negocio) is distinct from 'dueno' then raise exception 'sin_permiso'; end if;
  if p_usuario = auth.uid() then raise exception 'no_a_si_mismo'; end if;
  if p_rol not in ('admin','cajero','mesero','empleado') then raise exception 'rol_invalido'; end if;
  update miembros set rol = p_rol where negocio_id = p_negocio and usuario_id = p_usuario;
end $$;

create or replace function public.restaurar_respaldo(p_respaldo bigint)
returns bigint language plpgsql security definer set search_path = public, extensions as $$
declare r respaldos%rowtype; v bigint;
begin
  select * into r from respaldos where id = p_respaldo;
  if not found then raise exception 'no_existe'; end if;
  if coalesce(public.rol_en(r.negocio_id), '') not in ('dueno','admin') then raise exception 'sin_permiso'; end if;
  insert into respaldos(negocio_id, datos, version, creado_por)
    select negocio_id, datos, version, auth.uid() from datos_negocio where negocio_id = r.negocio_id;
  update datos_negocio set datos = r.datos, version = version + 1, actualizado_por = auth.uid(), actualizado_en = now()
    where negocio_id = r.negocio_id returning version into v;
  return v;
end $$;

revoke all on function public.crear_invitacion(uuid, text), public.cambiar_rol(uuid, uuid, text), public.restaurar_respaldo(bigint) from public, anon;
grant execute on function public.crear_invitacion(uuid, text), public.cambiar_rol(uuid, uuid, text), public.restaurar_respaldo(bigint) to authenticated;

-- Códigos hechos por alguien que hoy no es dueño ni administrador de ese negocio: a la auditoría (una sola vez) …
insert into public.auditoria(negocio_id, usuario_id, accion, detalle)
  select i.negocio_id, i.creado_por, 'invitacion_sospechosa',
         jsonb_build_object('codigo', i.codigo, 'rol', i.rol, 'creado_en', i.creado_en, 'usada_por', i.usada_por, 'usada_en', i.usada_en)
  from public.invitaciones i
  where i.creado_por is not null
    and not exists (select 1 from public.miembros m where m.negocio_id = i.negocio_id and m.usuario_id = i.creado_por and m.rol in ('dueno','admin'))
    and not exists (select 1 from public.auditoria a where a.negocio_id = i.negocio_id and a.accion = 'invitacion_sospechosa' and a.detalle->>'codigo' = i.codigo);
-- … y los que nadie ha usado, vencidos.
update public.invitaciones i set vence = least(vence, now())
  where i.usada_por is null and i.vence > now() and i.creado_por is not null
    and not exists (select 1 from public.miembros m where m.negocio_id = i.negocio_id and m.usuario_id = i.creado_por and m.rol in ('dueno','admin'));
