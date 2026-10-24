-- =====================================================================
-- ORDEVA 1.64.0 · Funciones por negocio (Insumos y recetas solo donde se preparan alimentos)
--   La app esconde «🧂 Insumos y recetas» en bares, tiendas, licoreras y demás negocios que no preparan comida, salvo que
--   el administrador lo prenda en «🧩 Funciones de este negocio» (data.modulos, en los datos de CADA negocio).
--   La pantalla no reemplaza los permisos del servidor: aquí el equipo (cajero, mesero, empleado) tampoco puede cambiar
--   desde su celular:
--     • data.modulos (qué funciones usa el negocio) ni data.recetasBloquear: solo dueño o administrador;
--     • la receta de un producto que ya existe: con el permiso «productos», como el precio y el nombre.
--   El stock de los insumos sí cambia con las ventas, como siempre. Lo revertido queda en la auditoría.
--   Sin borrar nada: la misma función de 20261106000000_equipo_no_reescribe.sql con estas reglas de más.
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

  -- 1.64.0: las funciones del negocio («🧩 Funciones de este negocio») y «no vender si faltan ingredientes»: solo dueño o
  -- administrador.
  if (p_nuevo->'modulos') is distinct from (p_viejo->'modulos') then
    nuevo := case when p_viejo ? 'modulos' then jsonb_set(nuevo, '{modulos}', p_viejo->'modulos') else nuevo - 'modulos' end;
    perform vento_auditar(p_negocio, p_usuario, null, 'modulos_revertidos', jsonb_build_object('rol', p_rol));
  end if;
  if (p_nuevo->'recetasBloquear') is distinct from (p_viejo->'recetasBloquear') then
    nuevo := case when p_viejo ? 'recetasBloquear' then jsonb_set(nuevo, '{recetasBloquear}', p_viejo->'recetasBloquear') else nuevo - 'recetasBloquear' end;
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
                  else (n.e - 'receta') || jsonb_strip_nulls(jsonb_build_object('price', v.e->'price', 'name', v.e->'name', 'cost', case when puede_costo then null else v.e->'cost' end, 'receta', v.e->'receta')) end x,
             n.o ord,
             v.e is not null and jsonb_typeof(n.e) = 'object' and ((n.e->'price') is distinct from (v.e->'price') or (n.e->'name') is distinct from (v.e->'name')
               or (n.e->'receta') is distinct from (v.e->'receta')
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
