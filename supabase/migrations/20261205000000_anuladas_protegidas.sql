-- ORDEVA 1.99.2 · 🚫 El registro de ventas anuladas queda protegido en el servidor.
-- Pedido del dueño: «protege en el servidor el registro de ventas anuladas» (1.99.1 guardó las ventas anuladas en
-- data.anuladas; la revisión goldfish anotó que un miembro del equipo con conocimientos técnicos podía quitar un registro).
-- Solo vuelve a crear datos_proteger_equipo con un bloque más al final; lo demás queda igual que en
-- 20261117000000_modulos_negocio.sql. Dueño y administrador no cambian. No borra ni cambia datos existentes.

create or replace function public.datos_proteger_equipo(p_negocio uuid, p_rol text, p_usuario uuid, p_viejo jsonb, p_nuevo jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  perm jsonb := case when jsonb_typeof(p_viejo->'permisosEquipo') = 'object' then p_viejo->'permisosEquipo' else '{}'::jsonb end;
  puede_prod boolean; puede_costo boolean; nuevo jsonb := p_nuevo; prods jsonb; revertidos int := 0; borradas jsonb; an jsonb; an_rev int := 0;
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

  -- 🚫 1.99.2: el registro de ventas ANULADAS («Facturas → Anuladas») solo crece para el equipo: puede agregar anulaciones
  -- nuevas, pero no quitar ni cambiar las que ya están. Lo único que puede cambiar en una ya guardada es la respuesta de la
  -- DIAN dentro de su copia (venta.dian: la nota crédito llega después y la puede anotar el celular de cualquiera).
  -- Solo se revisa si la lista cambió, se cruza por id con joins (rápido con miles) y, si algo falla, queda la lista que
  -- estaba: un error aquí nunca deja pasar el guardado sin las demás protecciones.
  if jsonb_typeof(p_viejo->'anuladas') = 'array' and jsonb_array_length(p_viejo->'anuladas') > 0
     and (nuevo->'anuladas') is distinct from (p_viejo->'anuladas') then
    begin
      with v as (
        select e, o, case when jsonb_typeof(e) = 'object' then nullif(e->>'id', '') end id
        from jsonb_array_elements(p_viejo->'anuladas') with ordinality x(e, o)
      ), n as (
        select e, o, case when jsonb_typeof(e) = 'object' then nullif(e->>'id', '') end id
        from jsonb_array_elements(case when jsonb_typeof(nuevo->'anuladas') = 'array' then nuevo->'anuladas' else '[]'::jsonb end) with ordinality x(e, o)
      ), vk as (      -- las que ya estaban, con id; «k» = sin la respuesta de la DIAN
        select distinct on (id) id, e, o, case when jsonb_typeof(e->'venta') = 'object' then e #- '{venta,dian}' else e end k from v where id is not null order by id, o
      ), nk as (
        select id, e, o, case when jsonb_typeof(e) = 'object' and jsonb_typeof(e->'venta') = 'object' then e #- '{venta,dian}' else e end k from n
      ), ok as (      -- la primera copia intacta de cada una que ya estaba
        select distinct on (vk.id) vk.id, nk.e, nk.o from vk join nk on nk.id = vk.id and nk.k = vk.k order by vk.id, nk.o
      ), viejas as (
        select coalesce(ok.e, vk.e) x, (ok.id is null) cambio, 1000000 + vk.o ord from vk left join ok on ok.id = vk.id
        union all
        select v.e, false, 1000000 + v.o from v where v.id is null
      ), sobrantes as (   -- otra copia (cambiada o repetida) de una que ya estaba: no entra
        select nk.o from nk join vk on vk.id = nk.id left join ok on ok.id = nk.id and ok.o = nk.o where ok.id is null
      ), nuevas as (
        select nk.e x, false cambio, nk.o ord from nk left join vk on vk.id = nk.id
        where vk.id is null and not exists (select 1 from v where v.id is null and v.e = nk.e)
      ), todo as (select x, cambio, ord from nuevas union all select x, cambio, ord from viejas)
      select coalesce((select jsonb_agg(x order by ord) from todo), '[]'::jsonb),
             (select count(*) from todo where cambio) + (select count(*) from sobrantes)
        into an, an_rev;
      if an_rev > 0 then
        nuevo := jsonb_set(nuevo, '{anuladas}', an);
        perform vento_auditar(p_negocio, p_usuario, null, 'anuladas_revertidas', jsonb_build_object('rol', p_rol, 'anuladas', an_rev));
      end if;
    exception when others then
      nuevo := jsonb_set(nuevo, '{anuladas}', p_viejo->'anuladas');
    end;
  end if;
  return nuevo;
end $$;
revoke all on function public.datos_proteger_equipo(uuid, text, uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.datos_proteger_equipo(uuid, text, uuid, jsonb, jsonb) to service_role;
