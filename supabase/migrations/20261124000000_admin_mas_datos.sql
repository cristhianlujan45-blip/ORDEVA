-- =====================================================================
-- ORDEVA 1.72.4 · ORDEVA Admin: más datos de cada cuenta y de los errores
--   Pedido del dueño: «déjame ver más datos de los usuarios y más datos de los errores».
--   • srv_admin_usuario: lo de antes + su perfil (nombre, cuándo se puso la contraseña, si tiene que cambiarla, cuándo se
--     cerraron sus sesiones, cuándo aceptó la licencia), un resumen de cada negocio (tipo, productos, ventas de los últimos
--     30 días y de hoy, última venta, cuentas abiertas, cuándo se guardaron los datos por última vez) y los últimos errores
--     de sus equipos.
--   • srv_admin_errores: lo de antes + por cada equipo: primera vez, usuario_id y negocio_id (para abrir la cuenta).
--   La contraseña NO: el servidor no la guarda (solo una huella de una sola vía); nadie la puede ver.
--   Solo funciones de lectura (create or replace): no cambia tablas ni borra nada. Solo las llama el Servidor ORDEVA con
--   la llave de servicio (como antes: los permisos de las funciones no cambian).
-- =====================================================================

create or replace function public.srv_admin_usuario(p_usuario uuid) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select (select j from (select jsonb_array_elements(srv_admin_usuarios(u.email, 5)) j) z where (j ->> 'id')::uuid = u.id limit 1)
    || jsonb_build_object(
      'equipos_lista', coalesce((select jsonb_agg(jsonb_build_object('equipo', i.equipo, 'negocio', i.negocio_nombre, 'usuario', i.usuario, 'version', i.version,
          'plataforma', i.plataforma, 'modelo', i.modelo, 'primera', i.primera, 'ultima', i.ultima, 'veces', i.veces) order by i.ultima desc)
        from instalaciones i where i.usuario_id = u.id), '[]'::jsonb),
      'licencias', coalesce((select jsonb_agg(jsonb_build_object('codigo', l.codigo, 'plan_id', l.plan_id, 'hasta', x.hasta, 'creado_en', x.creado_en) order by x.creado_en desc)
        from licencia_usos x join licencias l on l.id = x.licencia_id where x.usuario_id = u.id or lower(x.email) = lower(u.email)), '[]'::jsonb),
      'licencias_pendientes', coalesce((select jsonb_agg(l.codigo) from licencia_correos c join licencias l on l.id = c.licencia_id
        where c.email = lower(u.email) and l.estado = 'activa'
          and not exists (select 1 from licencia_usos x where x.licencia_id = l.id and lower(x.email) = c.email)), '[]'::jsonb),
      'soporte', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'asunto', c.asunto, 'estado', c.estado, 'actualizado_en', c.actualizado_en) order by c.actualizado_en desc)
        from soporte_casos c where c.usuario_id = u.id or lower(c.email) = lower(u.email)), '[]'::jsonb),
      -- 1.72.4 ↓
      'perfil', (select jsonb_build_object('nombre', p.nombre, 'clave_puesta_en', p.clave_puesta_en, 'cambiar_clave', coalesce(p.cambiar_clave, false),
          'sesiones_cerradas_en', p.sesiones_cerradas_en, 'acepto_licencia', p.acepto_licencia, 'actualizado_en', p.actualizado_en)
        from perfiles p where p.usuario_id = u.id),
      'negocios_resumen', coalesce((select jsonb_agg(r order by r ->> 'nombre') from (
          select jsonb_build_object('id', n.id, 'nombre', n.nombre, 'rol', m.rol,
            'tipo', d.datos ->> 'businessType',
            'productos', case when jsonb_typeof(d.datos -> 'products') = 'array' then jsonb_array_length(d.datos -> 'products') else 0 end,
            'cuentas_abiertas', (select count(*) from jsonb_each(case when jsonb_typeof(d.datos -> 'tables') = 'object' then d.datos -> 'tables' else '{}'::jsonb end) t
                                  where jsonb_typeof(t.value -> 'items') = 'array' and jsonb_array_length(t.value -> 'items') > 0),
            'ventas_30', v.n30, 'total_30', v.t30, 'ventas_hoy', v.nhoy, 'total_hoy', v.thoy, 'ultima_venta', v.ult,
            'datos_guardados_en', d.actualizado_en, 'version_datos', d.version) r
          from miembros m join negocios n on n.id = m.negocio_id
          left join datos_negocio d on d.negocio_id = n.id
          left join lateral (
            select count(*) filter (where h.f > now() - interval '30 days')::int n30,
                   coalesce(sum(h.t) filter (where h.f > now() - interval '30 days'), 0) t30,
                   count(*) filter (where (h.f at time zone 'America/Bogota')::date = (now() at time zone 'America/Bogota')::date)::int nhoy,
                   coalesce(sum(h.t) filter (where (h.f at time zone 'America/Bogota')::date = (now() at time zone 'America/Bogota')::date), 0) thoy,
                   max(h.f) ult
            from (select case when x ->> 'date' ~ '^\d{4}-\d{2}-\d{2}T' then (x ->> 'date')::timestamptz end f,
                         case when x ->> 'total' ~ '^-?\d+(\.\d+)?$' then (x ->> 'total')::numeric else 0 end t
                  from jsonb_array_elements(case when jsonb_typeof(d.datos -> 'history') = 'array' then d.datos -> 'history' else '[]'::jsonb end) x) h
          ) v on true
          where m.usuario_id = u.id) q), '[]'::jsonb),
      'errores', coalesce((select jsonb_agg(e order by e ->> 'ultimo' desc) from (
          select jsonb_build_object('huella', a.huella, 'tipo', a.tipo, 'mensaje', a.mensaje, 'veces', a.veces, 'primero', a.primero, 'ultimo', a.ultimo,
                   'plataforma', a.plataforma, 'version', a.version, 'modelo', a.modelo, 'negocio', a.negocio, 'resuelto', a.resuelto) e
          from app_errores a
          where a.usuario_id = u.id or lower(coalesce(a.usuario, '')) = lower(u.email)
             or a.negocio_id in (select negocio_id from miembros where usuario_id = u.id)
          order by a.ultimo desc limit 15) z), '[]'::jsonb))
  from auth.users u where u.id = p_usuario
$$;

create or replace function public.srv_admin_errores(p_estado text default 'abiertos', p_limite int default 200) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select coalesce(jsonb_agg(g order by g.ultimo desc), '[]'::jsonb) from (
    select e.huella, max(e.tipo) tipo, (array_agg(e.mensaje order by e.ultimo desc))[1] mensaje,
           sum(e.veces)::int veces, count(distinct e.equipo)::int equipos, count(distinct coalesce(e.negocio_id::text, e.negocio, e.equipo))::int negocios,
           min(e.primero) primero, max(e.ultimo) ultimo, bool_and(e.resuelto) resuelto,
           (array_agg(e.version order by e.ultimo desc))[1] version, (array_agg(e.pagina order by e.ultimo desc))[1] pagina,
           (select jsonb_agg(x order by x.ultimo desc) from (
              select e2.equipo, e2.negocio, e2.usuario, e2.version, e2.plataforma, e2.modelo, e2.veces, e2.ultimo, e2.detalle, e2.resuelto,
                     e2.primero, e2.usuario_id, e2.negocio_id                                                 -- 1.72.4
              from app_errores e2 where e2.huella = e.huella and (coalesce(p_estado, 'abiertos') = 'todos' or not e2.resuelto)
              order by e2.ultimo desc limit 20) x) casos
    from app_errores e
    where coalesce(p_estado, 'abiertos') = 'todos' or not e.resuelto
    group by e.huella
    order by max(e.ultimo) desc
    limit greatest(1, least(coalesce(p_limite, 200), 500))) g
$$;
