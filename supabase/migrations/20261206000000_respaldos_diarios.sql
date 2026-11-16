-- =====================================================================
--  ORDEVA 1.99.13 · Respaldos en la nube que no se pierden, y el administrador de ORDEVA los puede ver y restaurar
--
--  Pedido del dueño (16/11): «no encuentro los datos de una cuenta… desaparecieron sus datos, el historial, todo».
--  1. Antes cada guardado borraba los respaldos más viejos que los últimos 48 (uno por hora ≈ 2 días): si los datos de un
--     negocio quedaban mal y el negocio se seguía usando, a los 2 días ya no había copia buena. Ahora el servidor NO deja
--     borrar el primer respaldo de cada día (hora de Colombia) durante 60 días. No se cambian las funciones de guardar:
--     es una regla sobre la tabla. Si se borra el negocio entero, sus respaldos sí se borran (como antes).
--  2. srv_admin_respaldos: el administrador de ORDEVA ve los respaldos de un negocio con cuántas ventas, productos,
--     compras y gastos tenía cada uno (y quién lo guardó), y el estado de hoy. Solo lectura.
--  3. srv_admin_respaldo_restaurar: el administrador restaura un respaldo de ese negocio. Igual que restaurar_respaldo del
--     dueño: el estado actual queda primero como respaldo (se puede deshacer), pasa por la misma limpieza, y queda en la
--     auditoría del negocio. Los celulares, al ver el salto de versión, bajan el negocio completo.
--  Las dos se llaman solo desde el servidor de ORDEVA (service_role), después de comprobar que quien pide es administrador.
-- =====================================================================

create or replace function public.respaldos_guardar_diarios() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  -- Se está borrando el negocio entero (en cascada): sus respaldos se van con él.
  if not exists (select 1 from negocios where id = old.negocio_id) then return old; end if;
  -- Más de 60 días: se puede borrar.
  if old.creado_en < now() - interval '60 days' then return old; end if;
  -- No es el primero de su día: se puede borrar.
  if exists (select 1 from respaldos r
              where r.negocio_id = old.negocio_id and r.id <> old.id
                and (r.creado_en at time zone 'America/Bogota')::date = (old.creado_en at time zone 'America/Bogota')::date
                and (r.creado_en < old.creado_en or (r.creado_en = old.creado_en and r.id < old.id))) then
    return old;
  end if;
  return null;   -- primer respaldo del día y de los últimos 60 días: se queda
end $$;

drop trigger if exists respaldos_guardar_diarios on public.respaldos;
create trigger respaldos_guardar_diarios before delete on public.respaldos
  for each row execute function public.respaldos_guardar_diarios();

create or replace function public.srv_admin_respaldos(p_negocio uuid) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object(
    'actual', (select sub_resumen(coalesce(d.datos, '{}'::jsonb)) || jsonb_build_object('version', d.version, 'actualizado_en', d.actualizado_en,
                        'por', (select email from auth.users u where u.id = d.actualizado_por))
                 from datos_negocio d where d.negocio_id = p_negocio),
    'respaldos', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'creado_en', r.creado_en, 'version', r.version,
                                                               'por', (select email from auth.users u where u.id = r.creado_por))
                                            || sub_resumen(coalesce(r.datos, '{}'::jsonb)) order by r.creado_en desc)
                             from respaldos r where r.negocio_id = p_negocio), '[]'::jsonb));
$$;

create or replace function public.srv_admin_respaldo_restaurar(p_negocio uuid, p_respaldo bigint, p_admin uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare r respaldos%rowtype; v bigint; d jsonb;
begin
  select * into r from respaldos where id = p_respaldo and negocio_id = p_negocio;
  if not found then raise exception 'no_existe'; end if;
  if jsonb_typeof(r.datos) <> 'object' then raise exception 'respaldo_invalido'; end if;
  d := r.datos;
  if d ? 'iaClave' then
    begin perform public.ia_clave_recibir(r.negocio_id, d->>'iaClave'); exception when others then null; end;
    d := d - 'iaClave';
  end if;
  begin d := public.pagos_lista_sin_detalle(r.negocio_id, d); exception when others then null; end;
  -- Lo de ahora queda como respaldo antes de cambiarlo (se puede deshacer restaurando ese).
  insert into respaldos(negocio_id, datos, version, creado_por)
    select negocio_id, datos, version, p_admin from datos_negocio where negocio_id = r.negocio_id;
  update datos_negocio set datos = d, version = version + 1, actualizado_por = p_admin, actualizado_en = now()
    where negocio_id = r.negocio_id returning version into v;
  if v is null then raise exception 'no_existe'; end if;
  begin perform public.canal_privado_anotar(r.negocio_id, d); exception when others then null; end;
  begin perform vento_auditar(r.negocio_id, p_admin, null, 'respaldo_restaurado_admin', jsonb_build_object('respaldo', p_respaldo, 'version_respaldo', r.version, 'creado_en', r.creado_en)); exception when others then null; end;
  return jsonb_build_object('version', v, 'restaurado', sub_resumen(d));
end $$;

do $$
declare f text;
begin
  foreach f in array array['public.srv_admin_respaldos(uuid)', 'public.srv_admin_respaldo_restaurar(uuid, bigint, uuid)', 'public.respaldos_guardar_diarios()'] loop
    execute 'revoke all on function ' || f || ' from public, anon, authenticated';
    execute 'grant execute on function ' || f || ' to service_role';
  end loop;
end $$;
