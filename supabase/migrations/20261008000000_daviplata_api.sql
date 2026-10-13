-- =====================================================================
--  Vento · API oficial «Pago con DaviPlata» (Davivienda · conectesunegocio.daviplata.com, API 37)
--
--  Flujo:  caja → Servidor Vento → DaviPlata (token OAuth2 + compra) → código OTP al celular del CLIENTE
--          → el cliente le dice el código a la caja → confirmarCompra → «Aprobado» → pago aprobado → celulares.
--  DaviPlata no manda webhook: la confirmación del pago es la respuesta «Aprobado» de confirmarCompra.
--
--  Esta migración (idempotente; las anteriores ya están en producción y no se tocan):
--    • proveedor 'daviplata' en pago_proveedores y pagos; canal 'otp' en pagos.
--    • pagos: documento (solo tipo + últimos 4 dígitos), aprobacion (numAprobacion), otp_intentos,
--      confirmando_hasta (para que dos celulares no confirmen el mismo cobro a la vez), confirmando_tx (idTransaccion
--      que se mandó a confirmarCompra y cuya respuesta todavía no se conoce) e incierto (DaviPlata no respondió: puede
--      que SÍ haya aprobado → nunca se marca «vencido»/«rechazado» en silencio; queda «error» para revisar con el cliente).
--    • daviplata_consecutivos + srv_daviplata_consecutivo(): idTransaccion 1..999999 único por terminal de Redeban
--      (para TODOS los negocios de Vento que la usen) y por día (de Bogotá; se reinicia solo).
--    • crear_cobro, srv_pago_actualizar, srv_pendientes y pago_publico conocen DaviPlata (create or replace, misma firma).
--    • srv_daviplata_compra / srv_daviplata_turno / srv_daviplata_fallo: pasos del cobro con código (solo servidor).
-- =====================================================================

-- ---------- Proveedor y canal nuevos ----------
alter table public.pago_proveedores drop constraint if exists pago_proveedores_proveedor_check;
alter table public.pago_proveedores add constraint pago_proveedores_proveedor_check check (proveedor in ('wompi','nequi','daviplata'));
alter table public.pagos drop constraint if exists pagos_proveedor_check;
alter table public.pagos add constraint pagos_proveedor_check check (proveedor in ('wompi','nequi','dispositivo','manual','daviplata'));
alter table public.pagos drop constraint if exists pagos_canal_check;
alter table public.pagos add constraint pagos_canal_check check (canal in ('link','push','qr','notificacion','manual','otp'));

alter table public.pagos add column if not exists documento text;                         -- «CC •••8019» (nunca el número completo)
alter table public.pagos add column if not exists aprobacion text;                        -- numAprobacion de DaviPlata
alter table public.pagos add column if not exists otp_intentos int not null default 0;    -- códigos equivocados (máx. 3)
alter table public.pagos add column if not exists confirmando_hasta timestamptz;          -- turno de confirmación (un celular a la vez)
alter table public.pagos add column if not exists confirmando_tx int;                     -- idTransaccion enviado y sin respuesta conocida
alter table public.pagos add column if not exists incierto boolean not null default false; -- DaviPlata no respondió: pudo haber aprobado

-- ---------- Consecutivo idTransaccion (único por terminal y por día) ----------
-- La terminal la asigna Redeban: si dos negocios de Vento usan la misma (en el laboratorio TODOS usan ESB10934),
-- comparten el contador; por eso la llave es la terminal y no el negocio (si dos comercios tuvieran el mismo código de
-- terminal, compartir el contador sigue siendo único: nunca repite).
do $$ begin
  -- Forma anterior de esta misma migración (nunca publicada): contador por negocio.
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'daviplata_consecutivos' and column_name = 'negocio_id') then
    drop table public.daviplata_consecutivos;
  end if;
end $$;
drop function if exists public.srv_daviplata_consecutivo(uuid, text);
create table if not exists public.daviplata_consecutivos (
  terminal       text primary key check (char_length(terminal) between 1 and 40),
  dia            date not null,                         -- fecha de Bogotá del último número entregado
  ultimo         int not null default 0 check (ultimo >= 0),
  actualizado_en timestamptz not null default now()
);
alter table public.daviplata_consecutivos enable row level security;
-- Sin políticas: la app no la lee; solo el servidor.
revoke all on public.daviplata_consecutivos from anon, authenticated;
grant all on public.daviplata_consecutivos to service_role;

-- Devuelve el siguiente idTransaccion (1..999999) de esa terminal para HOY (hora de Colombia). Atómico: el upsert bloquea
-- la fila, así dos cobros a la vez nunca reciben el mismo número. Al cambiar el día vuelve a 1.
-- En la MISMA transacción deja anotado en el pago que ese número se va a mandar a confirmarCompra (confirmando_tx):
-- si después no se sabe qué respondió DaviPlata (red cortada, el servidor se cayó…), el pago queda «incierto».
create or replace function public.srv_daviplata_consecutivo(p_negocio uuid, p_pago uuid, p_terminal text)
returns int language plpgsql security definer set search_path = public, extensions as $$
declare hoy date := (now() at time zone 'America/Bogota')::date; n int; t text := trim(coalesce(p_terminal, ''));
begin
  if t = '' then raise exception 'daviplata_terminal: falta el código de terminal (idTerminal)'; end if;
  insert into daviplata_consecutivos as x (terminal, dia, ultimo, actualizado_en) values (t, hoy, 1, now())
    on conflict (terminal) do update
      set ultimo = case when x.dia = excluded.dia then x.ultimo + 1 else 1 end, dia = excluded.dia, actualizado_en = now()
    returning ultimo into n;
  if n > 999999 then
    -- La excepción deshace el upsert: el contador se queda en 999999 hasta mañana.
    raise exception 'daviplata_consecutivo_agotado: la terminal % ya usó los 999.999 números de transacción de hoy', t;
  end if;
  if p_pago is not null then
    update pagos set confirmando_tx = n
      where id = p_pago and negocio_id = p_negocio and proveedor = 'daviplata' and estado = 'pendiente';
    if not found then raise exception 'no_existe'; end if;
  end if;
  return n;
end $$;

-- Texto para un pago DaviPlata cuyo resultado no se conoce (nunca se dice «venció» si pudo haberse cobrado).
create or replace function public.daviplata_texto_incierto(p public.pagos) returns text
language sql stable as $$
  select 'Sin confirmar: DaviPlata no respondió y no se sabe si aprobó este pago de $' || p.monto ||
    '. Antes de cobrarle otra vez, pídele al cliente que revise en su DaviPlata si se le descontó; si sí, regístralo a mano en la cuenta.'
$$;

-- ---------- Forma pública del pago (la que reciben la app y los celulares) ----------
create or replace function public.pago_publico(p public.pagos) returns jsonb
language sql stable as $$
  select jsonb_build_object('id', p.id, 'referencia', p.referencia, 'proveedor', p.proveedor, 'metodo', p.metodo, 'canal', p.canal,
    'monto', p.monto, 'estado', p.estado, 'verificado', p.verificado, 'confianza', p.confianza, 'mesa', p.mesa, 'pagador', p.pagador,
    'telefono', p.telefono, 'url', p.url, 'qr', p.qr, 'detalle', p.detalle, 'creado_en', p.creado_en, 'actualizado_en', p.actualizado_en,
    'expira_en', p.expira_en, 'aprobado_en', p.aprobado_en, 'aplicado_en', p.aplicado_en, 'aplicado_mesa', p.aplicado_mesa, 'id_externo', p.id_externo,
    'documento', p.documento, 'aprobacion', p.aprobacion, 'otp_intentos', p.otp_intentos, 'ultimo_error', p.ultimo_error,
    'incierto', p.incierto)
$$;

-- ---------- Crear un cobro (ahora también DaviPlata con código) ----------
create or replace function public.crear_cobro(p_negocio uuid, p_proveedor text, p_metodo text, p_canal text, p_monto bigint,
  p_mesa text default null, p_telefono text default null, p_clave text default null)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare r text := public.rol_en(p_negocio); p pagos%rowtype; ref text;
begin
  if r is null or r not in ('dueno','admin','cajero','mesero') then raise exception 'sin_permiso'; end if;
  if nullif(p_clave, '') is not null then
    select * into p from pagos where negocio_id = p_negocio and clave_idem = left(p_clave, 80);
    if found then return pago_publico(p) || jsonb_build_object('repetido', true); end if;
  end if;
  if p_proveedor not in ('wompi','nequi','daviplata') then raise exception 'proveedor_invalido'; end if;
  if p_canal not in ('link','push','qr','otp') then raise exception 'canal_invalido'; end if;
  -- DaviPlata (API oficial) solo cobra con código OTP, y el código OTP solo existe en DaviPlata.
  if (p_proveedor = 'daviplata') <> (p_canal = 'otp') then raise exception 'canal_invalido'; end if;
  if p_monto is null or p_monto < 100 or p_monto > 50000000 then raise exception 'monto_invalido'; end if;
  if not exists (select 1 from pago_proveedores where negocio_id = p_negocio and proveedor = p_proveedor and estado = 'conectado') then
    raise exception 'proveedor_no_conectado';
  end if;
  ref := 'VNT-' || to_char(now() at time zone 'America/Bogota', 'YYMMDD') || '-' || upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 10));
  insert into pagos(negocio_id, referencia, proveedor, metodo, canal, monto, mesa, telefono, creado_por, expira_en, proximo_intento, clave_idem)
    values (p_negocio, ref, p_proveedor, upper(coalesce(nullif(p_metodo, ''), 'OTRO')), p_canal, p_monto, left(p_mesa, 20),
            case when p_telefono is not null then '•••' || right(regexp_replace(p_telefono, '\D', '', 'g'), 4) end,
            auth.uid(), now() + interval '30 minutes', case when p_canal = 'otp' then null else now() + interval '20 seconds' end, left(nullif(p_clave, ''), 80))
    returning * into p;
  perform vento_auditar(p_negocio, auth.uid(), null, 'cobro_creado', jsonb_build_object('pago', p.id, 'proveedor', p_proveedor, 'canal', p_canal, 'monto', p_monto, 'mesa', p_mesa));
  return pago_publico(p);
end $$;

-- ---------- Aplicar lo que dijo el proveedor (igual que antes + datos de DaviPlata) ----------
create or replace function public.srv_pago_actualizar(p_negocio uuid, p_proveedor text, p_referencia text, p_id_externo text,
  p_estado text, p_estado_proveedor text, p_metodo text, p_monto bigint, p_extra jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare p pagos%rowtype; nuevo boolean := false; cambio boolean := false; datos boolean := false; ext text := nullif(p_id_externo, '');
begin
  if p_estado not in ('pendiente','aprobado','rechazado','anulado','error','vencido') then raise exception 'estado_invalido'; end if;
  if p_referencia is not null then
    select * into p from pagos where negocio_id = p_negocio and referencia = p_referencia for update;
  end if;
  if not found and ext is not null then
    select * into p from pagos where proveedor = p_proveedor and id_externo = ext and negocio_id = p_negocio for update;
  end if;
  if not found then
    if coalesce(p_monto, 0) <= 0 then raise exception 'monto_invalido'; end if;
    insert into pagos(negocio_id, referencia, proveedor, metodo, canal, id_externo, monto, estado, estado_proveedor, verificado,
        confianza, pagador, telefono, mesa, detalle, aprobado_en)
      values (p_negocio, coalesce(nullif(p_referencia, ''), p_proveedor || ':' || ext), p_proveedor, upper(coalesce(nullif(p_metodo, ''), 'OTRO')),
        coalesce(p_extra->>'canal', 'link'), ext, p_monto, p_estado, p_estado_proveedor, coalesce((p_extra->>'verificado')::boolean, true),
        coalesce(p_extra->>'confianza', 'entidad'), left(p_extra->>'pagador', 80), left(p_extra->>'telefono', 20), left(p_extra->>'mesa', 20),
        left(p_extra->>'detalle', 300), case when p_estado = 'aprobado' then now() end)
      returning * into p;
    return jsonb_build_object('cambio', true, 'nuevo', true, 'pago', pago_publico(p));
  end if;
  -- Datos que no son de estado (id del proveedor, link, QR, método real) se completan sin tocar el estado.
  update pagos set
      id_externo = coalesce(id_externo, ext),
      metodo = case when nullif(p_metodo, '') is not null and upper(p_metodo) <> 'OTRO' then upper(p_metodo) else metodo end,
      url = coalesce(p_extra->>'url', url), qr = coalesce(p_extra->>'qr', qr),
      pagador = coalesce(left(p_extra->>'pagador', 80), pagador),
      ultimo_error = case when p_extra ? 'error' then left(p_extra->>'error', 300) else ultimo_error end,
      estado_proveedor = coalesce(p_estado_proveedor, estado_proveedor),
      -- DaviPlata: número de aprobación y detalle de la confirmación; el turno de confirmación se suelta.
      aprobacion = coalesce(left(p_extra->>'aprobacion', 40), aprobacion),
      detalle = case when p_proveedor = 'daviplata' and p_extra ? 'detalle' then left(p_extra->>'detalle', 300) else detalle end,
      confirmando_hasta = case when p_proveedor = 'daviplata' then null else confirmando_hasta end,
      confirmando_tx = case when p_proveedor = 'daviplata' then null else confirmando_tx end
    where id = p.id;
  if pago_puede_pasar(p.estado, p_estado) then
    -- Seguridad: si el proveedor reporta otro valor del que se cobró, no se aprueba solo.
    if p_estado = 'aprobado' and p_monto is not null and p_monto > 0 and p_monto <> p.monto then
      update pagos set estado = 'error', ultimo_error = 'El valor pagado (' || p_monto || ') no coincide con el cobro (' || p.monto || ')',
          actualizado_en = now(), verificado = true where id = p.id;
    else
      update pagos set estado = p_estado, verificado = true, actualizado_en = now(),
          aprobado_en = case when p_estado = 'aprobado' then now() else aprobado_en end,
          incierto = case when p_estado = 'aprobado' then false else incierto end
        where id = p.id;
    end if;
    cambio := true;
  elsif p_extra ? 'url' or p_extra ? 'qr' or (ext is not null and p.id_externo is null) then
    update pagos set actualizado_en = now() where id = p.id;   -- llega a los celulares (link, QR), sin ser cambio de estado
    datos := true;
  end if;
  select * into p from pagos where id = p.id;
  return jsonb_build_object('cambio', cambio, 'datos', datos, 'nuevo', nuevo, 'pago', pago_publico(p));
end $$;

-- ---------- Pasos del cobro con código (solo el servidor) ----------
-- 1) DaviPlata aceptó la compra y mandó el código al cliente: se guarda el idSessionToken, cuándo vence y el documento enmascarado.
create or replace function public.srv_daviplata_compra(p_negocio uuid, p_pago uuid, p_id_externo text, p_expira timestamptz, p_documento text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare p pagos%rowtype;
begin
  -- Un idSessionToken sirve una sola vez y vence en minutos: si DaviPlata repite uno viejo, al viejo se le marca el id
  -- para no chocar con el índice único (proveedor, id_externo).
  update pagos set id_externo = left(id_externo || '#' || left(id::text, 8), 120)
    where proveedor = 'daviplata' and id_externo = p_id_externo and id <> p_pago;
  update pagos set id_externo = p_id_externo, expira_en = coalesce(p_expira, expira_en), documento = left(p_documento, 24),
      estado_proveedor = 'OTP enviado', ultimo_error = null, actualizado_en = now()
    where id = p_pago and negocio_id = p_negocio and proveedor = 'daviplata' and estado = 'pendiente'
    returning * into p;
  if not found then raise exception 'no_existe'; end if;
  return jsonb_build_object('pago', pago_publico(p));
end $$;

-- 2) Tomar el turno para confirmar (un solo celular a la vez). Si el código ya venció, el pago queda «vencido»
--    (o «error · sin confirmar» si un intento anterior quedó sin respuesta: pudo haberse cobrado).
--    El turno dura más que la peor confirmación posible (token + confirmarCompra + reintento de token, 25 s cada uno),
--    así nunca hay dos confirmarCompra del mismo cobro a la vez. Un intento anterior que no dejó resultado
--    (confirmando_tx sin limpiar: el servidor se cayó a mitad de camino) vuelve el pago «incierto».
create or replace function public.srv_daviplata_turno(p_negocio uuid, p_pago uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare p pagos%rowtype; tomado boolean := false;
begin
  select * into p from pagos where id = p_pago and negocio_id = p_negocio and proveedor = 'daviplata' for update;
  if not found then raise exception 'no_existe'; end if;
  if p.estado <> 'pendiente' or (p.confirmando_hasta is not null and p.confirmando_hasta >= now()) then
    null;   -- cerrado, u otro celular confirmando ahora mismo
  elsif p.expira_en is not null and p.expira_en < now() - interval '1 minute' then
    if p.incierto or p.confirmando_tx is not null then
      update pagos set estado = 'error', incierto = true, confirmando_tx = null, confirmando_hasta = null,
          detalle = daviplata_texto_incierto(p), actualizado_en = now()
        where id = p.id returning * into p;
      perform vento_auditar(p.negocio_id, null, null, 'daviplata_sin_confirmar', jsonb_build_object('pago', p.id, 'monto', p.monto));
    else
      update pagos set estado = 'vencido', detalle = 'El código de DaviPlata venció: crea un cobro nuevo', confirmando_hasta = null, actualizado_en = now()
        where id = p.id returning * into p;
    end if;
  else
    update pagos set confirmando_hasta = now() + interval '180 seconds',
        incierto = incierto or confirmando_tx is not null, confirmando_tx = null
      where id = p.id returning * into p;
    tomado := true;
  end if;
  return jsonb_build_object('tomado', tomado, 'pago', pago_publico(p) || jsonb_build_object('negocio_id', p.negocio_id));
end $$;

-- 3) La confirmación no salió: código equivocado (cuenta intentos; al llegar a p_max queda rechazado), vencido,
--    rechazado por DaviPlata, error seguro (no llegó a DaviPlata: sigue pendiente) o «incierto» (DaviPlata no respondió:
--    pudo haber aprobado; sigue pendiente para reintentar con el mismo código). Si algún intento quedó incierto, el pago
--    NUNCA se cierra como «vencido»/«rechazado» (el cajero cobraría otra vez): queda «error · sin confirmar».
--    Siempre suelta el turno.
create or replace function public.srv_daviplata_fallo(p_negocio uuid, p_pago uuid, p_tipo text, p_detalle text, p_max int default 3)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare p pagos%rowtype; m int := greatest(coalesce(p_max, 3), 1); cierra text;
begin
  select * into p from pagos where id = p_pago and negocio_id = p_negocio and proveedor = 'daviplata' for update;
  if not found then raise exception 'no_existe'; end if;
  if p.estado <> 'pendiente' then
    update pagos set confirmando_hasta = null, confirmando_tx = null where id = p.id returning * into p;
    return jsonb_build_object('pago', pago_publico(p), 'restantes', 0);
  end if;
  cierra := case when p_tipo = 'otp' and p.otp_intentos + 1 >= m then 'rechazado'
                 when p_tipo in ('vencido', 'rechazado') then p_tipo end;
  if cierra is not null and p.incierto then
    update pagos set estado = 'error', otp_intentos = otp_intentos + case when p_tipo = 'otp' then 1 else 0 end,
        detalle = daviplata_texto_incierto(p), ultimo_error = left(p_detalle, 300),
        confirmando_hasta = null, confirmando_tx = null, actualizado_en = now()
      where id = p.id returning * into p;
  elsif p_tipo = 'otp' then
    update pagos set otp_intentos = otp_intentos + 1, ultimo_error = left(p_detalle, 300), confirmando_hasta = null, confirmando_tx = null, actualizado_en = now(),
        estado = case when otp_intentos + 1 >= m then 'rechazado' else estado end,
        detalle = case when otp_intentos + 1 >= m then 'Código de DaviPlata equivocado ' || m || ' veces' else detalle end
      where id = p.id returning * into p;
  elsif p_tipo in ('vencido', 'rechazado') then
    update pagos set estado = p_tipo, detalle = left(p_detalle, 300), ultimo_error = left(p_detalle, 300), confirmando_hasta = null, confirmando_tx = null, actualizado_en = now()
      where id = p.id returning * into p;
  elsif p_tipo = 'incierto' then
    update pagos set incierto = true, ultimo_error = left(p_detalle, 300), confirmando_hasta = null, confirmando_tx = null, actualizado_en = now()
      where id = p.id returning * into p;
    perform vento_auditar(p.negocio_id, null, null, 'daviplata_sin_respuesta', jsonb_build_object('pago', p.id, 'monto', p.monto));
  else
    update pagos set ultimo_error = left(p_detalle, 300), confirmando_hasta = null, confirmando_tx = null, actualizado_en = now()
      where id = p.id returning * into p;
  end if;
  if p.estado <> 'pendiente' then
    perform vento_auditar(p.negocio_id, null, null, case when p.estado = 'error' then 'daviplata_sin_confirmar' else 'daviplata_' || p.estado end,
      jsonb_build_object('pago', p.id, 'monto', p.monto, 'intentos', p.otp_intentos));
  end if;
  return jsonb_build_object('pago', pago_publico(p), 'restantes', greatest(0, m - p.otp_intentos));
end $$;

-- ---------- Pagos pendientes que toca consultar y vencimiento (igual que antes + DaviPlata) ----------
-- Un cobro DaviPlata que se está confirmando ahora mismo no se vence; uno con un intento sin respuesta queda
-- «error · sin confirmar» (no «vencido»): pudo haberse cobrado y hay que revisarlo con el cliente.
create or replace function public.srv_pendientes(p_negocio uuid default null, p_limite int default 40)
returns setof jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  update pagos set estado = 'error', incierto = true, confirmando_tx = null, actualizado_en = now(), detalle = daviplata_texto_incierto(pagos)
    where estado = 'pendiente' and proveedor = 'daviplata' and (incierto or confirmando_tx is not null)
      and expira_en is not null and expira_en < now() - interval '10 minutes'
      and (confirmando_hasta is null or confirmando_hasta < now())
      and (p_negocio is null or negocio_id = p_negocio);
  update pagos set estado = 'vencido', actualizado_en = now(), detalle = coalesce(detalle, 'No se pagó a tiempo')
    where estado = 'pendiente' and expira_en is not null and expira_en < now() - interval '10 minutes'
      and not (proveedor = 'daviplata' and (incierto or confirmando_tx is not null or coalesce(confirmando_hasta >= now(), false)))
      and (p_negocio is null or negocio_id = p_negocio);
  return query
    with c as (
      select id from pagos
        where estado = 'pendiente' and proveedor in ('wompi','nequi') and (p_negocio is null or negocio_id = p_negocio)
          and coalesce(proximo_intento, now()) <= now()
        order by proximo_intento nulls first limit least(greatest(p_limite, 1), 200) for update skip locked)
    update pagos p set intentos = p.intentos + 1,
        proximo_intento = now() + make_interval(secs => least(300, 15 * power(1.6, least(p.intentos, 10))::int))
      from c where p.id = c.id
      returning jsonb_build_object('id', p.id, 'negocio_id', p.negocio_id, 'proveedor', p.proveedor, 'referencia', p.referencia,
        'id_externo', p.id_externo, 'canal', p.canal, 'monto', p.monto, 'qr', p.qr, 'intentos', p.intentos);
end $$;

-- ---------- Permisos ----------
do $$
declare f text;
begin
  foreach f in array array[
    'public.srv_daviplata_consecutivo(uuid, uuid, text)',
    'public.srv_pendientes(uuid, int)',
    'public.srv_daviplata_compra(uuid, uuid, text, timestamptz, text)',
    'public.srv_daviplata_turno(uuid, uuid)',
    'public.srv_daviplata_fallo(uuid, uuid, text, text, int)',
    'public.srv_pago_actualizar(uuid, text, text, text, text, text, text, bigint, jsonb)'] loop
    execute 'revoke all on function ' || f || ' from public, anon, authenticated';
    execute 'grant execute on function ' || f || ' to service_role';
  end loop;
  execute 'revoke all on function public.crear_cobro(uuid, text, text, text, bigint, text, text, text) from public, anon';
  execute 'grant execute on function public.crear_cobro(uuid, text, text, text, bigint, text, text, text) to authenticated, service_role';
end $$;
