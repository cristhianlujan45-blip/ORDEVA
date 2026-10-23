-- =====================================================================
--  Vento 1.55.0 · Los datos de quien paga (Nequi, DaviPlata, Bre-B…) solo los ven el dueño y el administrador
--  (hallazgo D5 de la auditoría de datos; regla del dueño: «solamente el administrador puede ver lo del Nequi»).
--
--  Antes: la app escondía el nombre de quien pagó y el texto del banco a meseros, cajeros y empleados, pero el servidor
--  se los entregaba igual (tabla pagos, pagos_desde, pagos_dispositivo) y además iban en los datos del negocio que se
--  copian a todos los celulares (data.pagos.lista: «de», «txt», «fuente»).
--  Ahora:
--    • A quien no es dueño ni administrador, el servidor le da el pago SIN pagador, teléfono, documento ni el texto del
--      banco (sí el valor, la mesa y el estado: «✅ Mesa 3 ya pagó» y la voz siguen igual). Quien creó el cobro lo ve
--      completo (es su cobro). La tabla pagos ya no se lee directo si no es dueño, administrador o quien lo creó.
--    • En cada guardado, guardar_datos saca «de», «txt» y «fuente» de los avisos de data.pagos.lista y los deja en
--      pago_avisos_detalle, que solo leen dueño y administrador (pago_avisos_detalle_de). La app nueva deja en cada aviso
--      «th» (una huella del texto, calculada en el celular) para seguir juntando el mismo aviso sin duplicarlo.
--  Nada se pierde: los detalles quedan en el servidor. Se puede volver a correr sin dañar nada.
-- =====================================================================

create table if not exists public.pago_avisos_detalle (
  negocio_id  uuid not null references public.negocios(id) on delete cascade,
  aviso_id    text not null check (char_length(aviso_id) between 1 and 200),
  de          text,
  txt         text,
  fuente      text,
  creado_en   timestamptz not null default now(),
  primary key (negocio_id, aviso_id)
);
alter table public.pago_avisos_detalle enable row level security;
revoke all on public.pago_avisos_detalle from anon, authenticated;

-- ---------- El pago para quien no es dueño ni administrador ----------
create or replace function public.pago_reducido(p public.pagos) returns jsonb
language sql stable set search_path = public, extensions as $$
  select pago_publico(p) || jsonb_build_object('pagador', null, 'telefono', null, 'documento', null, 'detalle', null, 'reducido', true,
    'sms', coalesce(p.detalle, '') ~ '\mSMS\M')
$$;
-- ¿Este usuario ve el pago completo? Dueño, administrador o quien creó el cobro.
create or replace function public.pago_completo_para(p public.pagos, p_usuario uuid) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select p.creado_por = p_usuario or exists (select 1 from miembros m where m.negocio_id = p.negocio_id and m.usuario_id = p_usuario and m.rol in ('dueno', 'admin'))
$$;
create or replace function public.pago_para(p public.pagos, p_usuario uuid) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select case when public.pago_completo_para(p, p_usuario) then pago_publico(p) else pago_reducido(p) end
$$;

-- /vento-pagos/estado (el servidor, con quien pregunta).
create or replace function public.srv_pago_para(p_id uuid, p_usuario uuid) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select pago_para(p, p_usuario) || jsonb_build_object('negocio_id', p.negocio_id) from pagos p where p.id = p_id
$$;

drop policy if exists pagos_ver on public.pagos;
create policy pagos_ver on public.pagos for select using (public.rol_en(negocio_id) in ('dueno', 'admin') or creado_por = auth.uid());

-- Igual que antes (20261002120000_pagos.sql), con los datos de quien paga solo para dueño, administrador o quien cobró.
create or replace function public.pagos_desde(p_negocio uuid, p_desde timestamptz default null, p_limite int default 200)
returns setof jsonb language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if not public.es_miembro(p_negocio) then raise exception 'sin_permiso'; end if;
  return query select pago_para(p, auth.uid()) from pagos p
    where p.negocio_id = p_negocio and p.actualizado_en > coalesce(p_desde, now() - interval '2 days')
    order by p.actualizado_en asc limit least(greatest(coalesce(p_limite, 200), 1), 500);
end $$;

create or replace function public.confirmar_pago(p_pago uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare p pagos%rowtype;
begin
  select * into p from pagos where id = p_pago;
  if not found then raise exception 'no_existe'; end if;
  if coalesce(public.rol_en(p.negocio_id), '') not in ('dueno','admin','cajero') then raise exception 'sin_permiso'; end if;
  update pagos set confianza = 'ok', actualizado_en = now() where id = p_pago and confianza = 'revisar' returning * into p;
  if found then perform vento_auditar(p.negocio_id, auth.uid(), null, 'pago_confirmado_a_mano', jsonb_build_object('pago', p.id, 'monto', p.monto)); end if;
  if p.id is null then select * into p from pagos where id = p_pago; end if;
  return pago_para(p, auth.uid());
end $$;

-- Igual que antes (20261030000000_pagos_dispositivo.sql), con el mismo criterio según el dueño del celular.
create or replace function public.pagos_dispositivo(p_token text, p_desde timestamptz default null)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare d dispositivos%rowtype; r text; l jsonb;
begin
  if p_token is null or length(p_token) < 20 then return jsonb_build_object('ok', false, 'error', 'sin_token'); end if;
  select * into d from dispositivos where token_hash = encode(digest(p_token, 'sha256'), 'hex') and revocado_en is null;
  if not found then return jsonb_build_object('ok', false, 'error', 'dispositivo_no_autorizado'); end if;
  select rol into r from miembros where negocio_id = d.negocio_id and usuario_id = d.usuario_id;
  if r is null then return jsonb_build_object('ok', false, 'error', 'sin_permiso'); end if;
  update dispositivos set ultimo_visto = now() where id = d.id;
  select coalesce(jsonb_agg(x), '[]'::jsonb) into l from (
    select pago_para(p, d.usuario_id) || jsonb_build_object('de_dispositivo',
        (select e.cuerpo->>'dispositivo' from pago_eventos e
          where e.negocio_id = p.negocio_id and e.recibido_en > now() - interval '3 hours'
            and p.referencia like 'AV-%' and e.huella like 'aviso:' || substr(p.referencia, 4) || '%' limit 1)) as x
      from pagos p
      where p.negocio_id = d.negocio_id
        and p.actualizado_en > greatest(coalesce(p_desde, now() - interval '10 minutes'), now() - interval '2 hours')
        and (p.estado = 'aprobado' or (p.estado = 'rechazado' and p.confianza = 'falso'))
      order by p.actualizado_en asc limit 30) s;
  return jsonb_build_object('ok', true, 'rol', r, 'dispositivo', d.id, 'ahora', now(), 'pagos', l);
end $$;

-- ---------- Los avisos que viajan en los datos del negocio ----------
-- Saca «de», «txt» y «fuente» de cada aviso de data.pagos.lista y los guarda aparte.
create or replace function public.pagos_lista_sin_detalle(p_negocio uuid, p_datos jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare l jsonb := p_datos->'pagos'->'lista';
begin
  if jsonb_typeof(l) <> 'array' or not exists (select 1 from jsonb_array_elements(l) e where jsonb_typeof(e) = 'object' and (e ? 'de' or e ? 'txt' or e ? 'fuente')) then
    return p_datos;
  end if;
  insert into pago_avisos_detalle(negocio_id, aviso_id, de, txt, fuente)
    select distinct on (e->>'id') p_negocio, left(e->>'id', 200), nullif(left(e->>'de', 200), ''), nullif(left(e->>'txt', 1000), ''), nullif(left(e->>'fuente', 300), '')
    from jsonb_array_elements(l) e
    where jsonb_typeof(e) = 'object' and coalesce(e->>'id', '') <> '' and (coalesce(e->>'de', '') <> '' or coalesce(e->>'txt', '') <> '' or coalesce(e->>'fuente', '') <> '')
  on conflict (negocio_id, aviso_id) do update set
    de = coalesce(excluded.de, pago_avisos_detalle.de), txt = coalesce(excluded.txt, pago_avisos_detalle.txt), fuente = coalesce(excluded.fuente, pago_avisos_detalle.fuente);
  return jsonb_set(p_datos, '{pagos,lista}', (
    select coalesce(jsonb_agg(case when jsonb_typeof(e) = 'object' then
        e - 'de' - 'txt' - 'fuente'
      else e end order by o), '[]'::jsonb)
    from jsonb_array_elements(l) with ordinality x(e, o)));
end $$;

-- Detalles de los avisos (quién pagó y el texto del banco) para dueño y administrador.
create or replace function public.pago_avisos_detalle_de(p_negocio uuid, p_ids text[] default null)
returns jsonb language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if coalesce(public.rol_en(p_negocio), '') not in ('dueno', 'admin') then raise exception 'sin_permiso'; end if;
  return coalesce((select jsonb_object_agg(aviso_id, jsonb_strip_nulls(jsonb_build_object('de', de, 'txt', txt, 'fuente', fuente)))
    from (select * from pago_avisos_detalle where negocio_id = p_negocio and (p_ids is null or aviso_id = any(p_ids[1:300]))
          order by creado_en desc limit 300) x), '{}'::jsonb);
end $$;

-- Igual que antes (20261104000000_canal_pedidos_privado.sql) + sacar los detalles de los avisos de pago.
create or replace function public.guardar_datos(p_negocio uuid, p_datos jsonb, p_version bigint)
returns bigint language plpgsql security definer set search_path = public, extensions as $$
declare v bigint; ult timestamptz;
begin
  if not public.es_miembro(p_negocio) then raise exception 'sin_permiso'; end if;
  if p_datos ? 'iaClave' then
    begin perform public.ia_clave_recibir(p_negocio, p_datos->>'iaClave'); exception when others then null; end;
    p_datos := p_datos - 'iaClave';
  end if;
  begin p_datos := public.pagos_lista_sin_detalle(p_negocio, p_datos); exception when others then null; end;
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

-- Mudanza: los avisos que ya están en los datos de cada negocio (una vez; la versión sube para que los equipos bajen).
do $$
declare d record; nuevo jsonb;
begin
  for d in select negocio_id, datos from datos_negocio
           where jsonb_typeof(datos->'pagos'->'lista') = 'array'
             and exists (select 1 from jsonb_array_elements(datos->'pagos'->'lista') e where jsonb_typeof(e) = 'object' and (e ? 'de' or e ? 'txt' or e ? 'fuente')) loop
    nuevo := public.pagos_lista_sin_detalle(d.negocio_id, d.datos);
    update datos_negocio set datos = nuevo, version = version + 1, actualizado_en = now() where negocio_id = d.negocio_id;
  end loop;
end $$;

revoke all on function public.pagos_lista_sin_detalle(uuid, jsonb), public.pago_completo_para(public.pagos, uuid), public.pago_para(public.pagos, uuid),
  public.pago_reducido(public.pagos), public.srv_pago_para(uuid, uuid) from public, anon, authenticated;
grant execute on function public.pagos_lista_sin_detalle(uuid, jsonb), public.pago_completo_para(public.pagos, uuid), public.pago_para(public.pagos, uuid),
  public.pago_reducido(public.pagos), public.srv_pago_para(uuid, uuid) to service_role;
revoke all on function public.pago_avisos_detalle_de(uuid, text[]) from public, anon;
grant execute on function public.pago_avisos_detalle_de(uuid, text[]) to authenticated, service_role;
