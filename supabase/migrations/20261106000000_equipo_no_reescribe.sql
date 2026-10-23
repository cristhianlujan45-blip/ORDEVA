-- =====================================================================
--  Vento 1.55.0 · El equipo (cajero, mesero, empleado) no reescribe precios, costos ni permisos desde su celular
--  (hallazgo D2 de la auditoría de datos).
--
--  Antes: guardar_datos solo pedía ser miembro del negocio. La app no le muestra al mesero cómo cambiar precios, pero
--  un celular con un fallo (o alguien con la consola del navegador) podía subir precios, costos o permisos cambiados.
--  Ahora el servidor aplica los mismos permisos que el dueño da en «👥 Permisos del equipo» (data.permisosEquipo), con
--  lo que YA estaba en el servidor (no con lo que manda el celular):
--    • Precio y nombre de los productos que ya existen: solo con el permiso «productos». Costo: con «productos» o con
--      «inventario» (las facturas de proveedor actualizan el costo). Sin permiso, el servidor deja los de antes.
--    • Productos borrados: sin el permiso «productos», vuelven.
--    • El stock y los productos nuevos: como siempre (vender descuenta stock).
--    • Los permisos del equipo y la clave de autorización: solo dueño o administrador.
--    • Ventas borradas por el equipo (con la clave del dueño, «corregir / liberar / borrar»): NO se bloquean, pero cada
--      una queda COMPLETA en la auditoría (venta_borrada_equipo). No se pierde historia.
--  Lo que el servidor revierte también queda en la auditoría. Si algo fallara aquí, el guardado sigue igual que antes.
--  Se puede volver a correr sin dañar nada.
-- =====================================================================

create or replace function public.datos_proteger_equipo(p_negocio uuid, p_rol text, p_usuario uuid, p_viejo jsonb, p_nuevo jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  perm jsonb := case when jsonb_typeof(p_viejo->'permisosEquipo') = 'object' then p_viejo->'permisosEquipo' else '{}'::jsonb end;
  puede_prod boolean; puede_costo boolean; nuevo jsonb := p_nuevo; prods jsonb; revertidos int := 0; borradas jsonb;
begin
  if p_rol in ('dueno', 'admin') or p_viejo is null or jsonb_typeof(p_nuevo) <> 'object' then return p_nuevo; end if;

  -- Permisos del equipo y clave de autorización: como estaban.
  if (p_nuevo->'permisosEquipo') is distinct from (p_viejo->'permisosEquipo') then
    nuevo := case when p_viejo ? 'permisosEquipo' then jsonb_set(nuevo, '{permisosEquipo}', p_viejo->'permisosEquipo') else nuevo - 'permisosEquipo' end;
    perform vento_auditar(p_negocio, p_usuario, null, 'permisos_revertidos', jsonb_build_object('rol', p_rol));
  end if;

  puede_prod := coalesce(perm->p_rol->>'productos', '') = 'true';
  puede_costo := puede_prod or coalesce(perm->p_rol->>'inventario', '') = 'true';
  if not puede_prod and jsonb_typeof(p_viejo->'products') = 'array' then
    with v as (
      select e->>'id' id, e, o from jsonb_array_elements(p_viejo->'products') with ordinality x(e, o) where jsonb_typeof(e) = 'object' and coalesce(e->>'id', '') <> ''
    ), n as (
      select e->>'id' id, e, o from jsonb_array_elements(case when jsonb_typeof(nuevo->'products') = 'array' then nuevo->'products' else '[]'::jsonb end) with ordinality x(e, o)
    ), s as (
      select case when v.e is null or jsonb_typeof(n.e) <> 'object' then n.e
                  else n.e || jsonb_strip_nulls(jsonb_build_object('price', v.e->'price', 'name', v.e->'name', 'cost', case when puede_costo then null else v.e->'cost' end)) end x,
             n.o ord,
             v.e is not null and jsonb_typeof(n.e) = 'object' and ((n.e->'price') is distinct from (v.e->'price') or (n.e->'name') is distinct from (v.e->'name')
               or (not puede_costo and (n.e->'cost') is distinct from (v.e->'cost'))) cambio
      from n left join v on v.id = n.id
      union all
      select v.e, 1000000 + v.o, true from v where not exists (select 1 from n where n.id = v.id)
    )
    select coalesce(jsonb_agg(x order by ord), '[]'::jsonb), count(*) filter (where cambio) into prods, revertidos from s;
    if revertidos > 0 then
      nuevo := jsonb_set(nuevo, '{products}', prods);
      perform vento_auditar(p_negocio, p_usuario, null, 'productos_revertidos', jsonb_build_object('rol', p_rol, 'productos', revertidos));
    end if;
  end if;

  -- Ventas que el equipo borró: quedan completas en la auditoría (las 500 más recientes: el equipo solo ve las de hoy).
  if jsonb_typeof(p_viejo->'history') = 'array' and jsonb_typeof(nuevo->'history') = 'array' then
    with viejas as (
      select e from jsonb_array_elements(p_viejo->'history') with ordinality x(e, o) where o <= 500 and jsonb_typeof(e) = 'object' and coalesce(e->>'id', '') <> ''
    ), quedan as (
      select e->>'id' id from jsonb_array_elements(nuevo->'history') e where jsonb_typeof(e) = 'object'
    )
    select jsonb_agg(e) into borradas from viejas where e->>'id' in (select e->>'id' from viejas except select id from quedan);
    if borradas is not null then
      insert into auditoria(negocio_id, usuario_id, accion, detalle)
        select p_negocio, p_usuario, 'venta_borrada_equipo', jsonb_build_object('rol', p_rol, 'venta', e) from jsonb_array_elements(borradas) e;
    end if;
  end if;
  return nuevo;
end $$;
revoke all on function public.datos_proteger_equipo(uuid, text, uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.datos_proteger_equipo(uuid, text, uuid, jsonb, jsonb) to service_role;

-- Igual que antes (20261105000000_pagos_privados.sql) + lo que el equipo no puede reescribir.
create or replace function public.guardar_datos(p_negocio uuid, p_datos jsonb, p_version bigint)
returns bigint language plpgsql security definer set search_path = public, extensions as $$
declare v bigint; ult timestamptz; r text := public.rol_en(p_negocio); viejo jsonb;
begin
  if r is null then raise exception 'sin_permiso'; end if;
  if p_datos ? 'iaClave' then
    begin perform public.ia_clave_recibir(p_negocio, p_datos->>'iaClave'); exception when others then null; end;
    p_datos := p_datos - 'iaClave';
  end if;
  begin p_datos := public.pagos_lista_sin_detalle(p_negocio, p_datos); exception when others then null; end;
  if r not in ('dueno', 'admin') then
    begin
      select datos into viejo from datos_negocio where negocio_id = p_negocio and version = p_version;
      if viejo is not null then p_datos := public.datos_proteger_equipo(p_negocio, r, auth.uid(), viejo, p_datos); end if;
    exception when others then null;
    end;
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
