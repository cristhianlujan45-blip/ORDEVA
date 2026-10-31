-- =====================================================================
-- ORDEVA 1.69.0 · Sincronizar SOLO lo que cambió (no todo el negocio en cada toque)
--
-- Antes cada «+» en una mesa subía el negocio COMPLETO (con meses de ventas) y cada equipo lo bajaba completo: con
-- negocios grandes e internet lento, las cuentas llegaban atrasadas.
--
-- Ahora:
--   • guardar_cambios(negocio, cambios, versión): el equipo manda solo las partes que cambiaron. El servidor las aplica
--     sobre el documento guardado y hace EXACTAMENTE lo mismo que guardar_datos (clave de IA aparte, detalle privado
--     de los pagos, lo que el equipo no puede cambiar, canal de pedidos, respaldos). El documento completo se sigue
--     guardando igual en datos_negocio: los respaldos, las tablas de informes y lo demás no cambian.
--   • datos_cambios: lo que cambió en cada versión (lo que de verdad quedó guardado), para que los otros equipos bajen
--     solo eso. Se guardan las últimas 300 versiones por negocio. Si falta alguna (por ejemplo, una restauración),
--     el equipo baja el documento completo como siempre.
--
-- Formato de «cambios» (por cada dato de primer nivel):
--   {"v": valor}                       reemplaza ese dato
--   {"x": true}                        lo quita
--   {"o": {clave: {"v": …}|{"x": true}}}  objeto (ej. tables): cambia o quita solo esas claves
--   {"l": {"pre": [...], "set": [...], "del": [ids]}}   lista con «id» (ej. history): agrega al comienzo, reemplaza
--                                       por id y quita por id, sin mandar la lista completa
--
-- No borra ni cambia nada existente. Solo agrega una tabla y dos funciones.
-- =====================================================================

create table if not exists public.datos_cambios (
  negocio_id uuid not null references public.negocios(id) on delete cascade,
  version bigint not null,
  cambios jsonb not null,
  creado_por uuid,
  creado_en timestamptz not null default now(),
  primary key (negocio_id, version)
);
alter table public.datos_cambios enable row level security;
drop policy if exists datos_cambios_ver on public.datos_cambios;
create policy datos_cambios_ver on public.datos_cambios for select using (public.es_miembro(negocio_id));
revoke insert, update, delete on public.datos_cambios from anon, authenticated;
grant select on public.datos_cambios to authenticated;

-- Aplica «cambios» sobre un documento (función pura, la misma lógica que lib: nube/vento-nube.js aplicarCambios).
create or replace function public.datos_aplicar_cambios(p_doc jsonb, p_cambios jsonb) returns jsonb
language plpgsql immutable set search_path = public, extensions as $$
declare d jsonb := coalesce(p_doc, '{}'::jsonb); k text; c jsonb; sub text; sc jsonb; obj jsonb; lp jsonb; base jsonb; borra jsonb; pone jsonb;
begin
  if jsonb_typeof(p_cambios) <> 'object' then raise exception 'cambios_invalidos'; end if;
  for k, c in select * from jsonb_each(p_cambios) loop
    if jsonb_typeof(c) <> 'object' then raise exception 'cambios_invalidos'; end if;
    if c ? 'x' then
      d := d - k;
    elsif c ? 'v' then
      d := jsonb_set(d, array[k], c->'v', true);
    elsif c ? 'o' then
      obj := case when jsonb_typeof(d->k) = 'object' then d->k else '{}'::jsonb end;
      if jsonb_typeof(c->'o') <> 'object' then raise exception 'cambios_invalidos'; end if;
      for sub, sc in select * from jsonb_each(c->'o') loop
        if sc ? 'x' then obj := obj - sub; elsif sc ? 'v' then obj := jsonb_set(obj, array[sub], sc->'v', true); else raise exception 'cambios_invalidos'; end if;
      end loop;
      d := jsonb_set(d, array[k], obj, true);
    elsif c ? 'l' then
      lp := c->'l';
      base := case when jsonb_typeof(d->k) = 'array' then d->k else '[]'::jsonb end;
      borra := coalesce(lp->'del', '[]'::jsonb); pone := coalesce(lp->'set', '[]'::jsonb);
      if jsonb_typeof(borra) <> 'array' or jsonb_typeof(pone) <> 'array' or jsonb_typeof(coalesce(lp->'pre', '[]'::jsonb)) <> 'array' then raise exception 'cambios_invalidos'; end if;
      d := jsonb_set(d, array[k], coalesce(lp->'pre', '[]'::jsonb) || coalesce((
        select jsonb_agg(coalesce((select s from jsonb_array_elements(pone) s where s->>'id' = e->>'id' limit 1), e) order by o)
        from jsonb_array_elements(base) with ordinality x(e, o)
        where not exists (select 1 from jsonb_array_elements(borra) b where b #>> '{}' = e->>'id')
      ), '[]'::jsonb), true);
    else
      raise exception 'cambios_invalidos';
    end if;
  end loop;
  return d;
end $$;

-- Igual que guardar_datos (20261106000000_equipo_no_reescribe.sql), pero recibe solo lo que cambió.
create or replace function public.guardar_cambios(p_negocio uuid, p_cambios jsonb, p_version bigint)
returns bigint language plpgsql security definer set search_path = public, extensions as $$
declare v bigint; ult timestamptz; r text := public.rol_en(p_negocio); viejo jsonb; aplicado jsonb; p_datos jsonb; efectivo jsonb := '{}'::jsonb; k text; c jsonb;
begin
  if r is null then raise exception 'sin_permiso'; end if;
  select datos into viejo from datos_negocio where negocio_id = p_negocio and version = p_version for update;
  if viejo is null then raise exception 'conflicto'; end if;
  aplicado := public.datos_aplicar_cambios(viejo, p_cambios);
  p_datos := aplicado;
  if p_datos ? 'iaClave' then
    begin perform public.ia_clave_recibir(p_negocio, p_datos->>'iaClave'); exception when others then null; end;
    p_datos := p_datos - 'iaClave';
  end if;
  begin p_datos := public.pagos_lista_sin_detalle(p_negocio, p_datos); exception when others then null; end;
  if r not in ('dueno', 'admin') then
    begin p_datos := public.datos_proteger_equipo(p_negocio, r, auth.uid(), viejo, p_datos); exception when others then null; end;
  end if;
  update datos_negocio set datos = p_datos, version = version + 1, actualizado_por = auth.uid(), actualizado_en = now()
    where negocio_id = p_negocio and version = p_version returning version into v;
  if v is null then raise exception 'conflicto'; end if;
  -- Lo que de verdad quedó: si el servidor cambió algo de lo que llegó (detalle de pagos, lo protegido del equipo,
  -- la clave de IA), los otros equipos reciben lo que quedó guardado, no lo que mandó este.
  for k, c in select * from jsonb_each(p_cambios) loop
    if (p_datos->k) is distinct from (aplicado->k) then
      efectivo := efectivo || jsonb_build_object(k, case when p_datos ? k then jsonb_build_object('v', p_datos->k) else '{"x": true}'::jsonb end);
    else
      efectivo := efectivo || jsonb_build_object(k, c);
    end if;
  end loop;
  insert into datos_cambios(negocio_id, version, cambios, creado_por) values (p_negocio, v, efectivo, auth.uid())
    on conflict (negocio_id, version) do update set cambios = excluded.cambios;
  delete from datos_cambios where negocio_id = p_negocio and version < v - 300;
  begin perform public.canal_privado_anotar(p_negocio, p_datos); exception when others then null; end;
  select max(creado_en) into ult from respaldos where negocio_id = p_negocio;
  if ult is null or ult < now() - interval '1 hour' then
    insert into respaldos(negocio_id, datos, version, creado_por) values (p_negocio, p_datos, v, auth.uid());
    delete from respaldos where negocio_id = p_negocio and id not in
      (select id from respaldos where negocio_id = p_negocio order by creado_en desc limit 48);
  end if;
  return v;
end $$;

revoke all on function public.guardar_cambios(uuid, jsonb, bigint) from public, anon;
grant execute on function public.guardar_cambios(uuid, jsonb, bigint) to authenticated, service_role;
revoke all on function public.datos_aplicar_cambios(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.datos_aplicar_cambios(jsonb, jsonb) to service_role;
