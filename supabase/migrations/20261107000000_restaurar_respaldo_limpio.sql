-- =====================================================================
--  Vento 1.57.0 · Restaurar un respaldo pasa por la misma limpieza que un guardado (hallazgo D10 + D5/D6)
--
--  restaurar_respaldo copiaba el respaldo tal cual al documento compartido. Un respaldo de antes de la 1.53 / 1.55
--  podía volver a meter en los datos que van a todos los celulares la clave de IA del negocio, o el nombre de quien
--  pagó y el texto del banco. Ahora, igual que guardar_datos: la clave se guarda en el servidor (si no había), los
--  detalles de los avisos de pago quedan aparte y se anotan los canales de pedidos. El resto, igual que antes:
--  solo dueño o administrador, y el estado actual queda como respaldo antes de restaurar (se puede deshacer).
-- =====================================================================
create or replace function public.restaurar_respaldo(p_respaldo bigint)
returns bigint language plpgsql security definer set search_path = public, extensions as $$
declare r respaldos%rowtype; v bigint; d jsonb;
begin
  select * into r from respaldos where id = p_respaldo;
  if not found then raise exception 'no_existe'; end if;
  if coalesce(public.rol_en(r.negocio_id), '') not in ('dueno','admin') then raise exception 'sin_permiso'; end if;
  d := r.datos;
  if d ? 'iaClave' then
    begin perform public.ia_clave_recibir(r.negocio_id, d->>'iaClave'); exception when others then null; end;
    d := d - 'iaClave';
  end if;
  begin d := public.pagos_lista_sin_detalle(r.negocio_id, d); exception when others then null; end;
  insert into respaldos(negocio_id, datos, version, creado_por)
    select negocio_id, datos, version, auth.uid() from datos_negocio where negocio_id = r.negocio_id;
  update datos_negocio set datos = d, version = version + 1, actualizado_por = auth.uid(), actualizado_en = now()
    where negocio_id = r.negocio_id returning version into v;
  begin perform public.canal_privado_anotar(r.negocio_id, d); exception when others then null; end;
  perform vento_auditar(r.negocio_id, auth.uid(), null, 'respaldo_restaurado', jsonb_build_object('respaldo', p_respaldo, 'version_respaldo', r.version));
  return v;
end $$;
revoke all on function public.restaurar_respaldo(bigint) from public, anon;
grant execute on function public.restaurar_respaldo(bigint) to authenticated;
