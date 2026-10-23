-- =====================================================================
--  Vento 1.53.0 · La clave de IA del negocio ya NO viaja a todos los celulares (hallazgo D6 de la auditoría de datos)
--
--  Antes: la clave propia de Gemini del negocio se guardaba en el documento compartido (datos_negocio.datos.iaClave):
--  la recibían TODOS los equipos (también meseros), quedaba en los respaldos y en cada celular.
--  Ahora:
--    • guardar_datos SACA «iaClave» del documento (y de los respaldos nuevos) en cada guardado, venga de la versión que
--      venga de la app. Si la manda el dueño o un administrador, queda guardada en integraciones (tipo «ia»), donde
--      ningún celular la puede leer; el Servidor Vento la cifra con su llave la primera vez que la usa.
--    • Los documentos que ya la tenían: se pasa a integraciones y se quita del documento (una vez, aquí abajo).
--      La app de cada equipo baja el documento sin la clave (la versión sube) y la mezcla respeta que se quitó.
--    • La IA del negocio pasa por el Servidor Vento (vento-pagos /ia/<negocio>/v1beta/…), que agrega la clave.
--  Nada se pierde: la clave queda en el servidor; los respaldos viejos no se tocan (solo los ven dueño y administrador).
--  Se puede volver a correr sin dañar nada.
-- =====================================================================

alter table public.integraciones drop constraint if exists integraciones_tipo_check;
alter table public.integraciones add constraint integraciones_tipo_check check (tipo in ('google', 'ia'));

-- Guarda la clave que llegó en el documento, SOLO si el negocio nunca ha tenido una en el servidor y la manda el dueño
-- o un administrador. Después manda Ajustes: los celulares con la versión anterior de la app vuelven a meter en el
-- documento la clave que tienen guardada cada vez que abren, y eso no puede deshacer un cambio ni un «Quitar»
-- (por eso quitarla deja la fila sin secreto, como marca). «plano:» = falta cifrarla (lo hace el servidor al usarla).
create or replace function public.ia_clave_recibir(p_negocio uuid, p_clave text)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
declare k text := regexp_replace(coalesce(p_clave, ''), '\s+', '', 'g');
begin
  if k !~ '^[\x21-\x7e]{20,200}$' then return false; end if;
  if auth.uid() is not null and coalesce(public.rol_en(p_negocio), '') not in ('dueno', 'admin') then return false; end if;
  if exists (select 1 from integraciones where negocio_id = p_negocio and tipo = 'ia') then return false; end if;
  insert into integraciones(negocio_id, tipo, publico, secreto, actualizado_por, actualizado_en)
    values (p_negocio, 'ia', jsonb_build_object('final', right(k, 4), 'huella', encode(digest(k, 'sha256'), 'hex'), 'desde', now(), 'origen', 'documento'),
            'plano:' || k, auth.uid(), now())
  on conflict (negocio_id, tipo) do nothing;
  return true;
end $$;

-- «🗑️ Quitar la clave del negocio» (lo llama el Servidor Vento): queda la fila sin secreto, como marca.
create or replace function public.srv_ia_clave_quitar(p_negocio uuid, p_usuario uuid)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  update integraciones set secreto = null, publico = jsonb_build_object('quitada', now()), actualizado_por = p_usuario, actualizado_en = now()
    where negocio_id = p_negocio and tipo = 'ia';
  if not found then
    insert into integraciones(negocio_id, tipo, publico, secreto, actualizado_por) values (p_negocio, 'ia', jsonb_build_object('quitada', now()), null, p_usuario);
  end if;
  perform vento_auditar(p_negocio, p_usuario, null, 'integracion_borrada', jsonb_build_object('tipo', 'ia'));
end $$;

-- Igual que antes (20261002000000_vento_nube.sql) + sacar la clave de IA del documento y de los respaldos nuevos.
create or replace function public.guardar_datos(p_negocio uuid, p_datos jsonb, p_version bigint)
returns bigint language plpgsql security definer set search_path = public, extensions as $$
declare v bigint; ult timestamptz;
begin
  if not public.es_miembro(p_negocio) then raise exception 'sin_permiso'; end if;
  if p_datos ? 'iaClave' then
    begin perform public.ia_clave_recibir(p_negocio, p_datos->>'iaClave'); exception when others then null; end;
    p_datos := p_datos - 'iaClave';
  end if;
  update datos_negocio set datos = p_datos, version = version + 1, actualizado_por = auth.uid(), actualizado_en = now()
    where negocio_id = p_negocio and version = p_version returning version into v;
  if v is null then raise exception 'conflicto'; end if;
  -- Respaldo automático: como máximo uno por hora, se guardan los últimos 48.
  select max(creado_en) into ult from respaldos where negocio_id = p_negocio;
  if ult is null or ult < now() - interval '1 hour' then
    insert into respaldos(negocio_id, datos, version, creado_por) values (p_negocio, p_datos, v, auth.uid());
    delete from respaldos where negocio_id = p_negocio and id not in
      (select id from respaldos where negocio_id = p_negocio order by creado_en desc limit 48);
  end if;
  return v;
end $$;

-- ¿El negocio tiene clave de IA en el servidor? Cualquier miembro sabe si hay (para usar la IA del negocio); solo
-- dueño y administrador ven los últimos 4 caracteres. La clave nunca sale de aquí.
create or replace function public.ia_clave_estado(p_negocio uuid)
returns jsonb language plpgsql stable security definer set search_path = public, extensions as $$
declare r text := public.rol_en(p_negocio); p jsonb; s text; hay boolean;
begin
  if r is null then raise exception 'sin_permiso'; end if;
  select publico, secreto, true into p, s, hay from integraciones where negocio_id = p_negocio and tipo = 'ia';
  if s is null then p := null; end if;
  return jsonb_build_object('tiene', p is not null, 'quitada', coalesce(hay, false) and s is null,
    'final', case when r in ('dueno', 'admin') then p->>'final' end,
    'desde', case when r in ('dueno', 'admin') then p->>'desde' end);
end $$;

-- Mudanza de las claves que ya están en los documentos (una vez; si ya se mudaron, no hay nada que hacer).
do $$
declare d record;
begin
  for d in select negocio_id, datos->>'iaClave' k from datos_negocio where datos ? 'iaClave' loop
    perform public.ia_clave_recibir(d.negocio_id, d.k);
    update datos_negocio set datos = datos - 'iaClave', version = version + 1, actualizado_en = now() where negocio_id = d.negocio_id;
  end loop;
end $$;

revoke all on function public.ia_clave_recibir(uuid, text), public.srv_ia_clave_quitar(uuid, uuid) from public, anon, authenticated;
grant execute on function public.ia_clave_recibir(uuid, text), public.srv_ia_clave_quitar(uuid, uuid) to service_role;
revoke all on function public.ia_clave_estado(uuid) from public, anon;
grant execute on function public.ia_clave_estado(uuid) to authenticated, service_role;
