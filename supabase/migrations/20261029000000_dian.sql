-- =====================================================================
--  Vento · Facturación electrónica DIAN (por MATIAS API, proveedor tecnológico autorizado)
--
--  Cada venta de la app sale como «Documento equivalente electrónico P.O.S.» (o «Factura electrónica de venta» si el
--  cliente la pide con su cédula/NIT y correo). Vento es la «casa de software»: una sola cuenta de MATIAS emite a nombre
--  de cada negocio (su client_uuid), con la resolución de numeración DIAN de ese negocio.
--
--  Tablas:
--    dian_config      datos del emisor, resoluciones (POS y factura), consecutivos y la empresa en MATIAS
--    dian_documentos  cada documento: número reservado, lo que se mandó, estado DIAN, CUDE/CUFE, QR y PDF
--
--  Numeración: la reserva el servidor con la fila de dian_config bloqueada (FOR UPDATE): dos cajas cobrando a la vez
--  nunca sacan el mismo número, y la misma venta (venta_id) nunca saca dos números (reintentos, dos celulares).
--  Seguridad: RLS. Los miembros ven los documentos de su negocio; la configuración la cambian el dueño y el
--  administrador; lo demás pasa por funciones srv_* que solo ejecuta el servidor (service_role).
-- =====================================================================

create table if not exists public.dian_config (
  negocio_id      uuid primary key references public.negocios(id) on delete cascade,
  activo          boolean not null default false,
  client_uuid     text check (client_uuid is null or client_uuid ~ '^[0-9a-fA-F-]{36}$'),   -- empresa en MATIAS (Vento Admin)
  -- Emisor
  razon_social    text check (char_length(razon_social) <= 120),
  nit             text check (nit is null or nit ~ '^[0-9]{5,15}$'),
  dv              text check (dv is null or dv ~ '^[0-9]$'),
  direccion       text check (char_length(direccion) <= 160),
  correo          text check (char_length(correo) <= 120),
  -- Impuesto de las ventas: ninguno (no responsable de IVA), IVA (0, 5 o 19 %) o impuesto al consumo (INC 8 %)
  impuesto        text not null default 'ninguno' check (impuesto in ('ninguno','iva','inc')),
  tarifa          numeric(5,2) not null default 0 check (tarifa in (0, 5, 8, 19)),
  -- Documento equivalente electrónico P.O.S.
  pos_resolucion  text check (pos_resolucion is null or pos_resolucion ~ '^[0-9]{6,20}$'),
  pos_prefijo     text not null default '' check (pos_prefijo ~ '^[A-Z0-9]{0,4}$'),
  pos_desde       bigint check (pos_desde > 0),
  pos_hasta       bigint check (pos_hasta > 0),
  pos_siguiente   bigint check (pos_siguiente > 0),
  pos_vence       date,
  -- Factura electrónica de venta (opcional: cuando el cliente la pide)
  fe_resolucion   text check (fe_resolucion is null or fe_resolucion ~ '^[0-9]{6,20}$'),
  fe_prefijo      text not null default '' check (fe_prefijo ~ '^[A-Z0-9]{0,4}$'),
  fe_desde        bigint check (fe_desde > 0),
  fe_hasta        bigint check (fe_hasta > 0),
  fe_siguiente    bigint check (fe_siguiente > 0),
  fe_vence        date,
  -- Notas crédito (anulaciones y devoluciones): consecutivo propio, sin resolución
  nc_prefijo      text not null default 'NC' check (nc_prefijo ~ '^[A-Z0-9]{0,6}$'),
  nc_siguiente    bigint not null default 1 check (nc_siguiente > 0),
  -- Punto de venta (va en el documento P.O.S.)
  caja            text not null default 'CAJA 1' check (char_length(caja) between 1 and 30),
  actualizado_por uuid references auth.users(id) on delete set null,
  actualizado_en  timestamptz not null default now(),
  check (pos_desde is null or pos_hasta is null or pos_desde <= pos_hasta),
  check (fe_desde is null or fe_hasta is null or fe_desde <= fe_hasta)
);

create table if not exists public.dian_documentos (
  id              uuid primary key default gen_random_uuid(),
  negocio_id      uuid not null references public.negocios(id) on delete cascade,
  venta_id        text not null check (char_length(venta_id) between 1 and 80),   -- id de la venta en la app (o de la nota)
  tipo            text not null check (tipo in ('pos','factura','nota')),
  referencia_id   uuid references public.dian_documentos(id) on delete set null,  -- la nota crédito: a qué documento
  prefijo         text not null default '',
  numero          bigint not null check (numero > 0),
  resolucion      text,
  estado          text not null default 'pendiente'
                    check (estado in ('pendiente','en_proceso','aceptado','rechazado','anulado')),
  total           numeric(14,2) not null check (total >= 0),
  cliente         jsonb,
  cuerpo          jsonb,                       -- lo que se manda a la DIAN (se reenvía igual)
  cude            text,                        -- CUDE (P.O.S. y notas) o CUFE (factura)
  qr              text,                        -- enlace de la DIAN para el código QR
  pdf             text,
  xml             text,
  mensaje         text,
  errores         jsonb not null default '[]'::jsonb,
  intentos        int not null default 0,
  proximo_intento timestamptz default now(),
  creado_por      uuid references auth.users(id) on delete set null,
  creado_en       timestamptz not null default now(),
  enviado_en      timestamptz,
  aceptado_en     timestamptz,
  unique (negocio_id, tipo, venta_id),
  unique (negocio_id, tipo, prefijo, numero)
);
create index if not exists dian_documentos_pend_idx on public.dian_documentos(proximo_intento) where estado in ('pendiente','en_proceso');
create index if not exists dian_documentos_negocio_idx on public.dian_documentos(negocio_id, creado_en desc);

alter table public.dian_config     enable row level security;
alter table public.dian_documentos enable row level security;
drop policy if exists dian_config_ver on public.dian_config;
create policy dian_config_ver on public.dian_config for select to authenticated using (public.es_miembro(negocio_id));
drop policy if exists dian_documentos_ver on public.dian_documentos;
create policy dian_documentos_ver on public.dian_documentos for select to authenticated using (public.es_miembro(negocio_id));
revoke insert, update, delete, truncate on public.dian_config, public.dian_documentos from anon, authenticated;

-- Lo que la app puede ver de un documento (sin el cuerpo completo).
create or replace function public.dian_doc_publico(d public.dian_documentos) returns jsonb
language sql immutable as $$
  select jsonb_build_object('id', d.id, 'venta_id', d.venta_id, 'tipo', d.tipo, 'referencia_id', d.referencia_id,
    'prefijo', d.prefijo, 'numero', d.numero, 'documento', d.prefijo || d.numero, 'estado', d.estado, 'total', d.total,
    'cude', d.cude, 'qr', d.qr, 'pdf', d.pdf, 'mensaje', d.mensaje, 'errores', d.errores, 'intentos', d.intentos,
    'creado_en', d.creado_en, 'aceptado_en', d.aceptado_en, 'resolucion', d.resolucion,
    'impuestos', coalesce(d.cuerpo->'tax_totals', '[]'::jsonb), 'totales', d.cuerpo->'legal_monetary_totals')
$$;

-- ---------- Para la app (sesión) ----------
create or replace function public.dian_config_ver(p_negocio uuid) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare c dian_config%rowtype; r text := public.rol_en(p_negocio); v jsonb;
begin
  if r is null then raise exception 'sin_permiso'; end if;
  select * into c from dian_config where negocio_id = p_negocio;
  if not found then v := jsonb_build_object('activo', false, 'conectado', false);
  else v := to_jsonb(c) - 'actualizado_por' - 'client_uuid' || jsonb_build_object('conectado', c.client_uuid is not null);
  end if;
  return v || jsonb_build_object('rol', r,
    'pendientes', (select count(*) from dian_documentos where negocio_id = p_negocio and estado in ('pendiente','en_proceso')),
    'rechazados', (select count(*) from dian_documentos where negocio_id = p_negocio and estado = 'rechazado'),
    'aceptados',  (select count(*) from dian_documentos where negocio_id = p_negocio and estado = 'aceptado'));
end $$;

-- El dueño o el administrador guarda los datos del emisor y las resoluciones. Lo que ya se usó no se puede repetir:
-- el consecutivo no puede volver atrás de un número ya emitido con ese prefijo.
create or replace function public.dian_config_guardar(p_negocio uuid, p_cfg jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare r text := public.rol_en(p_negocio); c dian_config%rowtype; t text; n bigint;
  txt text[] := array['razon_social','nit','dv','direccion','correo','impuesto','pos_resolucion','pos_prefijo','fe_resolucion','fe_prefijo','nc_prefijo','caja'];
  num text[] := array['pos_desde','pos_hasta','pos_siguiente','fe_desde','fe_hasta','fe_siguiente','nc_siguiente'];
begin
  if r is null or r not in ('dueno','admin') then raise exception 'sin_permiso'; end if;
  if jsonb_typeof(p_cfg) <> 'object' then raise exception 'dian_config_invalida'; end if;
  insert into dian_config(negocio_id) values (p_negocio) on conflict do nothing;
  select * into c from dian_config where negocio_id = p_negocio for update;
  -- Texto: vacío = sin valor (los prefijos quedan en '')
  foreach t in array txt loop
    if p_cfg ? t then
      execute format('update dian_config set %I = $1 where negocio_id = $2', t)
        using case when t in ('pos_prefijo','fe_prefijo','nc_prefijo') then upper(coalesce(btrim(p_cfg->>t), ''))
                   when t = 'impuesto' then coalesce(nullif(btrim(p_cfg->>t), ''), 'ninguno')
                   when t = 'caja' then coalesce(nullif(btrim(p_cfg->>t), ''), 'CAJA 1')
                   when t in ('nit','dv','pos_resolucion','fe_resolucion') then nullif(regexp_replace(coalesce(p_cfg->>t, ''), '\D', '', 'g'), '')
                   else nullif(btrim(p_cfg->>t), '') end, p_negocio;
    end if;
  end loop;
  foreach t in array num loop
    if p_cfg ? t then
      n := case when coalesce(p_cfg->>t, '') ~ '^\s*[0-9]{1,15}\s*$' then (p_cfg->>t)::bigint end;
      if t = 'nc_siguiente' and n is null then n := 1; end if;
      execute format('update dian_config set %I = $1 where negocio_id = $2', t) using n, p_negocio;
    end if;
  end loop;
  if p_cfg ? 'tarifa' then update dian_config set tarifa = coalesce(nullif(p_cfg->>'tarifa', '')::numeric, 0) where negocio_id = p_negocio; end if;
  if p_cfg ? 'pos_vence' then update dian_config set pos_vence = nullif(p_cfg->>'pos_vence', '')::date where negocio_id = p_negocio; end if;
  if p_cfg ? 'fe_vence' then update dian_config set fe_vence = nullif(p_cfg->>'fe_vence', '')::date where negocio_id = p_negocio; end if;
  if p_cfg ? 'activo' then update dian_config set activo = coalesce((p_cfg->>'activo')::boolean, false) where negocio_id = p_negocio; end if;
  update dian_config set actualizado_por = auth.uid(), actualizado_en = now() where negocio_id = p_negocio returning * into c;
  -- Coherencia
  if c.impuesto = 'ninguno' and c.tarifa <> 0 then update dian_config set tarifa = 0 where negocio_id = p_negocio returning * into c; end if;
  if c.impuesto = 'iva' and c.tarifa not in (0, 5, 19) then raise exception 'dian_tarifa_invalida'; end if;
  if c.impuesto = 'inc' and c.tarifa <> 8 then raise exception 'dian_tarifa_invalida'; end if;
  if c.pos_siguiente is null and c.pos_desde is not null then update dian_config set pos_siguiente = c.pos_desde where negocio_id = p_negocio returning * into c; end if;
  if c.fe_siguiente is null and c.fe_desde is not null then update dian_config set fe_siguiente = c.fe_desde where negocio_id = p_negocio returning * into c; end if;
  if c.pos_siguiente is not null and ((c.pos_desde is not null and c.pos_siguiente < c.pos_desde) or (c.pos_hasta is not null and c.pos_siguiente > c.pos_hasta + 1)) then raise exception 'dian_consecutivo_fuera'; end if;
  if c.fe_siguiente is not null and ((c.fe_desde is not null and c.fe_siguiente < c.fe_desde) or (c.fe_hasta is not null and c.fe_siguiente > c.fe_hasta + 1)) then raise exception 'dian_consecutivo_fuera'; end if;
  if exists (select 1 from dian_documentos d where d.negocio_id = p_negocio and (
       (d.tipo = 'pos' and d.prefijo = c.pos_prefijo and d.numero >= c.pos_siguiente) or
       (d.tipo = 'factura' and d.prefijo = c.fe_prefijo and d.numero >= c.fe_siguiente) or
       (d.tipo = 'nota' and d.prefijo = c.nc_prefijo and d.numero >= c.nc_siguiente))) then
    raise exception 'dian_numero_usado';
  end if;
  if c.activo and (c.nit is null or c.dv is null or c.razon_social is null or c.pos_resolucion is null or c.pos_desde is null or c.pos_hasta is null) then
    raise exception 'dian_faltan_datos';
  end if;
  perform vento_auditar(p_negocio, auth.uid(), null, 'dian_config', jsonb_build_object('activo', c.activo, 'pos_prefijo', c.pos_prefijo, 'pos_siguiente', c.pos_siguiente, 'impuesto', c.impuesto, 'tarifa', c.tarifa));
  return public.dian_config_ver(p_negocio);
end $$;

-- Estado de documentos de unas ventas (la app lo pide al abrir el historial o al volver la conexión).
create or replace function public.dian_documentos_de(p_negocio uuid, p_ventas text[]) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if not public.es_miembro(p_negocio) then raise exception 'sin_permiso'; end if;
  return coalesce((select jsonb_agg(public.dian_doc_publico(d) order by d.creado_en desc) from dian_documentos d
    where d.negocio_id = p_negocio and (p_ventas is null or d.venta_id = any(p_ventas[1:300]))), '[]'::jsonb);
end $$;

-- ---------- Servidor ----------
create or replace function public.srv_dian_config(p_negocio uuid) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select to_jsonb(c) || jsonb_build_object('negocio_nombre', n.nombre)
  from dian_config c join negocios n on n.id = c.negocio_id where c.negocio_id = p_negocio
$$;

-- Reserva el número de un documento (o devuelve el que ya tiene esa venta). Si el que ya existe fue rechazado,
-- se puede volver a mandar con el mismo número (la DIAN no lo validó).
create or replace function public.srv_dian_reservar(p_negocio uuid, p_venta text, p_tipo text, p_total numeric, p_cliente jsonb,
  p_usuario uuid, p_referencia uuid default null) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare c dian_config%rowtype; d dian_documentos%rowtype; num bigint; pre text; res text; hasta bigint; vence date;
  hoy date := (now() at time zone 'America/Bogota')::date;
begin
  if p_tipo not in ('pos','factura','nota') then raise exception 'dian_tipo_invalido'; end if;
  if p_venta is null or char_length(p_venta) not between 1 and 80 then raise exception 'dian_venta_invalida'; end if;
  select * into d from dian_documentos where negocio_id = p_negocio and tipo = p_tipo and venta_id = p_venta;
  if found then return jsonb_build_object('nuevo', false, 'doc', to_jsonb(d)); end if;
  select * into c from dian_config where negocio_id = p_negocio for update;
  if not found or not c.activo then raise exception 'dian_inactivo'; end if;
  if p_tipo = 'pos' then num := c.pos_siguiente; pre := c.pos_prefijo; res := c.pos_resolucion; hasta := c.pos_hasta; vence := c.pos_vence;
  elsif p_tipo = 'factura' then num := c.fe_siguiente; pre := c.fe_prefijo; res := c.fe_resolucion; hasta := c.fe_hasta; vence := c.fe_vence;
  else num := c.nc_siguiente; pre := c.nc_prefijo; res := coalesce(c.pos_resolucion, c.fe_resolucion); hasta := null; vence := null;
  end if;
  if res is null or num is null then raise exception 'dian_sin_resolucion'; end if;
  if hasta is not null and num > hasta then raise exception 'dian_rango_agotado'; end if;
  if vence is not null and vence < hoy then raise exception 'dian_resolucion_vencida'; end if;
  insert into dian_documentos(negocio_id, venta_id, tipo, referencia_id, prefijo, numero, resolucion, total, cliente, creado_por)
    values (p_negocio, p_venta, p_tipo, p_referencia, pre, num, res, greatest(coalesce(p_total, 0), 0), p_cliente, p_usuario)
    returning * into d;
  if p_tipo = 'pos' then update dian_config set pos_siguiente = num + 1 where negocio_id = p_negocio;
  elsif p_tipo = 'factura' then update dian_config set fe_siguiente = num + 1 where negocio_id = p_negocio;
  else update dian_config set nc_siguiente = num + 1 where negocio_id = p_negocio;
  end if;
  return jsonb_build_object('nuevo', true, 'doc', to_jsonb(d),
    'quedan', case when hasta is null then null else hasta - num end,
    'vence', vence);
end $$;

create or replace function public.srv_dian_cuerpo(p_doc uuid, p_cuerpo jsonb) returns void
language sql security definer set search_path = public, extensions as $$
  update dian_documentos set cuerpo = p_cuerpo where id = p_doc
$$;

-- Resultado de un envío. Un documento aceptado no vuelve atrás (solo queda «anulado» con su nota crédito).
create or replace function public.srv_dian_resultado(p_doc uuid, p_estado text, p_datos jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare d dian_documentos%rowtype; espera interval;
begin
  if p_estado not in ('pendiente','en_proceso','aceptado','rechazado','anulado') then raise exception 'estado_invalido'; end if;
  select * into d from dian_documentos where id = p_doc for update;
  if not found then raise exception 'no_existe'; end if;
  if d.estado in ('aceptado','anulado') and p_estado not in ('aceptado','anulado') then return public.dian_doc_publico(d); end if;
  espera := case least(d.intentos, 6) when 0 then interval '1 minute' when 1 then interval '2 minutes' when 2 then interval '5 minutes'
    when 3 then interval '10 minutes' when 4 then interval '30 minutes' else interval '1 hour' end;
  update dian_documentos set
    estado = p_estado,
    cude = coalesce(nullif(p_datos->>'cude', ''), cude),
    qr = coalesce(nullif(p_datos->>'qr', ''), qr),
    pdf = coalesce(nullif(p_datos->>'pdf', ''), pdf),
    xml = coalesce(nullif(p_datos->>'xml', ''), xml),
    mensaje = left(coalesce(p_datos->>'mensaje', mensaje), 500),
    errores = case when p_datos ? 'errores' then coalesce(p_datos->'errores', '[]'::jsonb) else errores end,
    intentos = intentos + case when coalesce((p_datos->>'intento')::boolean, true) then 1 else 0 end,
    enviado_en = coalesce(enviado_en, now()),
    aceptado_en = case when p_estado = 'aceptado' then coalesce(aceptado_en, now()) else aceptado_en end,
    proximo_intento = case when p_estado in ('pendiente','en_proceso') then now() + espera else null end
  where id = p_doc returning * into d;
  return public.dian_doc_publico(d);
end $$;

create or replace function public.srv_dian_doc(p_doc uuid) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select to_jsonb(d) from dian_documentos d where d.id = p_doc
$$;
create or replace function public.srv_dian_doc_de(p_negocio uuid, p_tipo text, p_venta text) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select to_jsonb(d) from dian_documentos d where d.negocio_id = p_negocio and d.tipo = p_tipo and d.venta_id = p_venta
$$;

-- Documentos por reenviar (sin respuesta de la DIAN, «en proceso» o la conexión falló). Máximo 7 días y 40 intentos.
create or replace function public.srv_dian_pendientes(p_negocio uuid, p_limite int default 25) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select coalesce(jsonb_agg(to_jsonb(d) order by d.creado_en), '[]'::jsonb) from (
    select * from dian_documentos
    where estado in ('pendiente','en_proceso') and (p_negocio is null or negocio_id = p_negocio)
      and (proximo_intento is null or proximo_intento <= now() or p_negocio is not null)
      and intentos < 40 and creado_en > now() - interval '7 days'
    order by creado_en limit greatest(1, least(p_limite, 100))) d
$$;

-- Token de MATIAS cifrado (se renueva solo antes de vencer).
create or replace function public.srv_config_poner(p_clave text, p_valor jsonb) returns void
language sql security definer set search_path = public, extensions as $$
  insert into servidor_config(clave, valor) values (p_clave, p_valor) on conflict (clave) do update set valor = excluded.valor
$$;

-- ---------- Vento Admin ----------
create or replace function public.srv_dian_admin(p_negocio uuid) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object(
    'config', (select to_jsonb(c) from dian_config c where c.negocio_id = p_negocio),
    'documentos', coalesce((select jsonb_agg(public.dian_doc_publico(d) order by d.creado_en desc)
                            from (select * from dian_documentos where negocio_id = p_negocio order by creado_en desc limit 60) d), '[]'::jsonb),
    'resumen', (select jsonb_build_object(
        'aceptados', count(*) filter (where estado = 'aceptado'),
        'pendientes', count(*) filter (where estado in ('pendiente','en_proceso')),
        'rechazados', count(*) filter (where estado = 'rechazado'),
        'anulados', count(*) filter (where estado = 'anulado'),
        'mes', count(*) filter (where creado_en >= date_trunc('month', now())))
      from dian_documentos where negocio_id = p_negocio))
$$;
create or replace function public.srv_dian_admin_cliente(p_negocio uuid, p_client_uuid text, p_admin uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
begin
  if p_client_uuid is not null and p_client_uuid !~ '^[0-9a-fA-F-]{36}$' then raise exception 'dian_cliente_invalido'; end if;
  insert into dian_config(negocio_id, client_uuid) values (p_negocio, p_client_uuid)
    on conflict (negocio_id) do update set client_uuid = excluded.client_uuid, actualizado_en = now();
  perform vento_auditar(p_negocio, p_admin, null, 'dian_cliente', jsonb_build_object('client_uuid', p_client_uuid));
  return public.srv_dian_admin(p_negocio);
end $$;
-- Resumen de todos los negocios con facturación DIAN (lista del panel).
create or replace function public.srv_dian_admin_lista() returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select coalesce(jsonb_agg(x order by x->>'nombre'), '[]'::jsonb) from (
    select jsonb_build_object('negocio', c.negocio_id, 'nombre', n.nombre, 'activo', c.activo, 'conectado', c.client_uuid is not null,
      'nit', c.nit, 'pendientes', (select count(*) from dian_documentos d where d.negocio_id = c.negocio_id and d.estado in ('pendiente','en_proceso')),
      'rechazados', (select count(*) from dian_documentos d where d.negocio_id = c.negocio_id and d.estado = 'rechazado'),
      'mes', (select count(*) from dian_documentos d where d.negocio_id = c.negocio_id and d.creado_en >= date_trunc('month', now()))) x
    from dian_config c join negocios n on n.id = c.negocio_id) t
$$;

-- ---------- Permisos ----------
do $$ declare f text; begin
  foreach f in array array[
    'public.srv_dian_config(uuid)',
    'public.srv_dian_reservar(uuid, text, text, numeric, jsonb, uuid, uuid)',
    'public.srv_dian_cuerpo(uuid, jsonb)',
    'public.srv_dian_resultado(uuid, text, jsonb)',
    'public.srv_dian_doc(uuid)',
    'public.srv_dian_doc_de(uuid, text, text)',
    'public.srv_dian_pendientes(uuid, int)',
    'public.srv_config_poner(text, jsonb)',
    'public.srv_dian_admin(uuid)',
    'public.srv_dian_admin_cliente(uuid, text, uuid)',
    'public.srv_dian_admin_lista()'] loop
    execute 'revoke all on function ' || f || ' from public, anon, authenticated';
    execute 'grant execute on function ' || f || ' to service_role';
  end loop;
  foreach f in array array[
    'public.dian_config_ver(uuid)',
    'public.dian_config_guardar(uuid, jsonb)',
    'public.dian_documentos_de(uuid, text[])'] loop
    execute 'revoke all on function ' || f || ' from public, anon';
    execute 'grant execute on function ' || f || ' to authenticated, service_role';
  end loop;
end $$;
grant select on public.dian_config, public.dian_documentos to authenticated;
grant all on public.dian_config, public.dian_documentos to service_role;
