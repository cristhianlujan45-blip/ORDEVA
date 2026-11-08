-- =====================================================================
--  ORDEVA 1.96 · Lo que queda de la auditoría 1.95.3 en el servidor (puente/egm/PLAN-1.96.md, con la revisión goldfish).
--
--  S1 · Los canales del negocio (`c+e` estados, `c+k` carta, `c+f` fotos y QR de pago, `c+a` ambiente) solo los escribe
--       el negocio. Antes cualquiera que viera el QR de una mesa podía publicar un QR de pago falso.
--       • Si el canal es Y + e|k|f|a y Y es un canal de pedidos registrado a un negocio, publicar pide la sesión de un
--         miembro de ESE negocio. Manda Y: aunque otro negocio haya registrado el canal derivado como «suyo», no lo
--         abre ni se lo apropia (revisión goldfish, bloqueante 1).
--       • Ningún negocio puede registrar como canal de pedidos el derivado (Y+letra) del canal de otro.
--       • Cada mensaje queda marcado `firmado` si lo publicó un miembro. Desde la fecha de cierre, canal_leer no entrega
--         los mensajes sin firmar de esos canales: los falsos de antes desaparecen de una (revisión goldfish, M2).
--       • Gracia: 72 h desde que corre esta migración (servidor_config 'canal_escribir_desde'), para que los celulares
--         del negocio con la versión anterior (que publican sin sesión) se actualicen. Si la fila no existe, no se cierra.
--       • Sin excepción para service_role: la ruta abierta /vento-pagos/canal/<canal> no tiene sesión de un miembro.
--       • El error es 'sin_permiso' con código 42501 (PostgREST responde 401/403).
--  S10 · pagos_estado: los datos públicos de los proveedores (código de Nequi, terminal de DaviPlata, llave de Wompi)
--       solo para dueño y administrador. A los demás, solo los métodos de Wompi (lo que usa el resumen).
--  S6  · Bonos: crear bonos y ver la lista con los códigos (valen como plata), solo dueño, administrador o cajero.
--       Devolver el saldo: esos roles o quien hizo la redención. Usar un bono sigue abierto a todo el equipo.
--  No borra nada: agrega una columna, una fila de configuración y reemplaza funciones. Se puede volver a correr.
-- =====================================================================

alter table public.canal_mensajes add column if not exists firmado boolean not null default false;

insert into public.servidor_config(clave, valor) values ('canal_escribir_desde', jsonb_build_object('t', now() + interval '72 hours'))
on conflict (clave) do nothing;

-- ¿Ya se cerraron los canales del negocio? (sin la fila, o con una fecha mala: no)
create or replace function public.canal_escribir_activo() returns boolean
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  return coalesce((select now() >= (valor->>'t')::timestamptz from servidor_config where clave = 'canal_escribir_desde'), false);
exception when others then return false;
end $$;

-- El negocio dueño de un canal derivado (Y + e|k|f|a, con Y registrado). null si no es un canal del negocio.
-- Revisión goldfish (bloqueante del cambio): si el canal mismo es un canal de pedidos registrado ANTES que Y por otro negocio,
-- no es un derivado (es el canal de pedidos de ese negocio y sigue abierto para sus clientes). Así nadie le quita el canal
-- de pedidos a otro registrando su nombre sin la última letra.
create or replace function public.canal_dueno_derivado(p_canal text) returns uuid
language sql stable security definer set search_path = public, extensions as $$
  select b.negocio_id from canal_privado b
   where char_length(p_canal) >= 5 and right(p_canal, 1) in ('e', 'k', 'f', 'a') and b.canal = left(p_canal, char_length(p_canal) - 1)
     and not exists (select 1 from canal_privado s where s.canal = p_canal and s.negocio_id <> b.negocio_id and s.creado_en <= b.creado_en)
$$;

-- Registrar los canales de pedidos del negocio: igual que antes (20261104000000), pero sin choques con otro negocio en
-- ninguna dirección: ni el derivado de un canal ajeno (Y+letra con Y de otro), ni la «raíz» de un canal ajeno (Y cuando
-- Y+e|k|f|a ya es de otro). Así nadie le quita a otro el QR de pago, la carta ni el canal de pedidos.
create or replace function public.canal_privado_anotar(p_negocio uuid, p_datos jsonb) returns void
language sql security definer set search_path = public, extensions as $$
  insert into canal_privado(canal, negocio_id, cerrar_desde)
    select c, p_negocio, canal_privado_inicio() from unnest(canales_pedidos_de(p_datos)) c
     where not exists (select 1 from canal_privado o where o.negocio_id <> p_negocio
                         and ((right(c, 1) in ('e', 'k', 'f', 'a') and o.canal = left(c, char_length(c) - 1))
                           or o.canal in (c || 'e', c || 'k', c || 'f', c || 'a')))
  on conflict (canal) do nothing
$$;
create index if not exists canal_mensajes_firmado_idx on public.canal_mensajes(canal, id) where firmado;

-- Igual que antes (20261108000000_canal_limite_ip.sql) + S1: los canales del negocio piden la sesión de un miembro y cada
-- mensaje queda marcado si lo firmó un miembro.
create or replace function public.canal_publicar(p_canal text, p_cuerpo text, p_titulo text default null) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare m canal_mensajes%rowtype; n int; o text := public.canal_origen(); neg uuid; firma boolean := false;
begin
  if p_canal is null or p_canal !~ '^[A-Za-z0-9_-]{4,80}$' then raise exception 'canal_invalido'; end if;
  if p_cuerpo is null or char_length(p_cuerpo) > 32768 then raise exception 'mensaje_grande'; end if;
  -- 1.96 (S1): un canal del negocio (Y + e|k|f|a) lo escribe solo un miembro de ese negocio (después de la gracia).
  neg := public.canal_dueno_derivado(p_canal);
  if neg is not null then
    firma := public.es_miembro(neg);
    if not firma and public.canal_escribir_activo() then raise exception 'sin_permiso' using errcode = '42501'; end if;
    -- El QR de pago (la llave a la que le pagan los clientes) solo lo cambian el dueño o el administrador.
    if firma and right(p_canal, 1) = 'f' and p_cuerpo like '%"__qrpago__"%' and coalesce(public.rol_en(neg), '') not in ('dueno', 'admin') then
      raise exception 'sin_permiso' using errcode = '42501';
    end if;
  end if;
  -- Límite por canal: 240 mensajes por minuto (un negocio con mucho movimiento usa muchos menos).
  select count(*) into n from canal_mensajes where canal = p_canal and creado > now() - interval '1 minute';
  if n >= 240 then raise exception 'demasiados'; end if;
  -- Límite por conexión: 300 por minuto (así una sola persona no llena el tope de todo el sistema).
  if o is not null and (select count(*) from canal_mensajes where origen_h = o and creado > now() - interval '1 minute') >= 300 then raise exception 'demasiados'; end if;
  -- Tope GLOBAL (cualquiera puede inventar nombres de canal): 6.000 mensajes por minuto en todo Vento.
  if (select count(*) from canal_mensajes where creado > now() - interval '1 minute') >= 6000 then raise exception 'demasiados'; end if;
  insert into canal_mensajes(canal, cuerpo, titulo, origen_h, firmado) values (p_canal, p_cuerpo, left(nullif(trim(p_titulo), ''), 200), o, firma) returning * into m;
  -- Aviso al instante a quien escucha el canal (Realtime). Si el servidor no lo tiene, quien escucha igual revisa cada pocos segundos.
  begin
    perform realtime.send(jsonb_build_object('id', m.id), 'm', 'vc-' || p_canal, false);
  exception when others then null;
  end;
  -- Limpieza: los mensajes de más de 8 días se borran de vez en cuando.
  if m.id % 200 = 0 then delete from canal_mensajes where creado < now() - interval '8 days'; end if;
  return canal_pub(m) || jsonb_build_object('firmado', m.firmado);
end $$;

-- Igual que antes (20261104000000_canal_pedidos_privado.sql) + S1: cerrados los canales del negocio, sus mensajes sin
-- firmar (los que mandó alguien que no es del negocio) ya no se entregan.
create or replace function public.canal_leer(p_canales text[], p_desde_id bigint default null, p_desde bigint default null, p_limite int default 300)
returns jsonb language plpgsql stable security definer set search_path = public, extensions as $$
declare ok text[]; protegidos text[] := '{}';
begin
  -- Un canal del negocio (Y+e|k|f|a de un Y registrado) se lee siempre (carta, estados, fotos, QR de pago), aunque otro
  -- negocio lo haya registrado como «suyo» antes de la 1.96 (revisión goldfish).
  select coalesce(array_agg(c), '{}') into ok from unnest(p_canales[1:20]) c
   where public.canal_dueno_derivado(c) is not null
      or not exists (select 1 from canal_privado p where p.canal = c and p.cerrar_desde <= now() and not public.es_miembro(p.negocio_id));
  if public.canal_escribir_activo() then
    select coalesce(array_agg(c), '{}') into protegidos from unnest(ok) c where public.canal_dueno_derivado(c) is not null;
  end if;
  return (select coalesce(jsonb_agg(canal_pub(x) order by x.id), '[]'::jsonb) from (
    select * from canal_mensajes
     where canal = any(ok)
       and (firmado or not (canal = any(protegidos)))
       and (p_desde_id is null or id > p_desde_id)
       and (p_desde is null or creado >= to_timestamp(p_desde))
       and creado > now() - interval '8 days'
     order by id desc
     limit greatest(1, least(coalesce(p_limite, 300), 500))) x);
end $$;

-- Para el dueño de ORDEVA: mensajes sin firmar que quedan en los canales del negocio en los últimos 3 días (para decidir si
-- se adelanta o se atrasa el cierre: si quedan muchos, hay celulares sin actualizar).
create or replace function public.canal_sin_firmar_resumen() returns table(negocio uuid, canales int, mensajes int, ultimo timestamptz)
language sql stable security definer set search_path = public, extensions as $$
  select public.canal_dueno_derivado(m.canal), count(distinct m.canal)::int, count(*)::int, max(m.creado) from canal_mensajes m
   where not m.firmado and m.creado > now() - interval '3 days' and public.canal_dueno_derivado(m.canal) is not null
   group by 1 order by 3 desc
$$;
-- Registros hechos sobre canales que ya tenían mensajes ANTES de registrarse (B1-b): pueden ser de otro. No borra nada.
create or replace function public.canal_registros_sospechosos() returns table(canal text, negocio uuid, registrado timestamptz, mensajes_antes int)
language sql stable security definer set search_path = public, extensions as $$
  select p.canal, p.negocio_id, p.creado_en, count(m.id)::int from canal_privado p
    join canal_mensajes m on (m.canal = p.canal or m.canal in (p.canal || 'e', p.canal || 'k', p.canal || 'f', p.canal || 'a')) and m.creado < p.creado_en - interval '1 hour'
   group by 1, 2, 3 order by 4 desc
$$;
-- Para el dueño de ORDEVA (revisión goldfish B1-b): registros que chocan (Y de un negocio, Y+letra de otro). No borra nada.
create or replace function public.canal_choques() returns table(canal text, negocio uuid, derivado_de text, dueno_base uuid)
language sql stable security definer set search_path = public, extensions as $$
  select d.canal, d.negocio_id, b.canal, b.negocio_id from canal_privado d join canal_privado b
    on char_length(d.canal) >= 5 and right(d.canal, 1) in ('e', 'k', 'f', 'a') and b.canal = left(d.canal, char_length(d.canal) - 1)
   where d.negocio_id <> b.negocio_id
$$;

-- S10 · Igual que antes (20261002120000_pagos.sql) + los datos públicos de los proveedores solo para dueño y administrador.
create or replace function public.pagos_estado(p_negocio uuid)
returns jsonb language plpgsql stable security definer set search_path = public, extensions as $$
declare r text := public.rol_en(p_negocio);
begin
  if r is null then raise exception 'sin_permiso'; end if;
  return jsonb_build_object(
    'rol', r,
    'proveedores', coalesce((select jsonb_agg(jsonb_build_object('proveedor', proveedor, 'ambiente', ambiente, 'estado', estado,
        'publico', case when r in ('dueno','admin') then publico
                        when proveedor = 'wompi' then jsonb_strip_nulls(jsonb_build_object('metodos', publico->'metodos'))
                        else '{}'::jsonb end,
        'detalle', case when r in ('dueno','admin') then detalle end, 'verificado_en', verificado_en,
        'webhook_visto_en', webhook_visto_en, 'tiene_secreto', secreto is not null,
        'webhook_token', case when r in ('dueno','admin') then webhook_token end) order by proveedor)
      from pago_proveedores where negocio_id = p_negocio), '[]'::jsonb),
    'dispositivos', (select count(*) from dispositivos where negocio_id = p_negocio and revocado_en is null),
    'pendientes', (select count(*) from pagos where negocio_id = p_negocio and estado = 'pendiente'),
    'sin_aplicar', (select count(*) from pagos where negocio_id = p_negocio and estado = 'aprobado' and aplicado_en is null)
  );
end $$;

-- S6 · ¿Puede manejar los bonos (venderlos y ver sus códigos)?
create or replace function public.bono_jefe(p_negocio uuid) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select coalesce(public.rol_en(p_negocio) in ('dueno', 'admin', 'cajero'), false)
$$;

-- Igual que antes (20261201000000_bonos.sql) + solo dueño, administrador o cajero crean bonos.
create or replace function public.bono_crear(p_negocio uuid, p_valor numeric, p_cliente text, p_meses int) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare b public.bonos; c text; n int := 0;
begin
  if not public.bono_jefe(p_negocio) then raise exception 'sin_permiso'; end if;
  if p_valor is null or p_valor <= 0 or p_valor > 100000000 then raise exception 'valor_invalido'; end if;
  loop
    c := upper(substr(translate(encode(gen_random_bytes(18), 'base64'), '+/=0O1Il', ''), 1, 8));
    n := n + 1;
    exit when length(c) = 8 and not exists (select 1 from public.bonos where negocio_id = p_negocio and codigo = c);
    if n > 20 then raise exception 'sin_codigo'; end if;
  end loop;
  insert into public.bonos(negocio_id, codigo, valor, saldo, cliente, vence, creado_por)
    values (p_negocio, c, round(p_valor), round(p_valor), left(nullif(trim(coalesce(p_cliente, '')), ''), 60),
      case when coalesce(p_meses, 0) > 0 then (current_date + make_interval(months => least(p_meses, 60)))::date end, auth.uid())
    returning * into b;
  insert into public.bonos_movimientos(bono_id, negocio_id, tipo, monto, por) values (b.id, p_negocio, 'venta', b.valor, auth.uid());
  return public.bono_json(b);
end $$;

-- Igual que antes + devolver el saldo solo dueño, administrador o cajero, o quien hizo esa redención.
create or replace function public.bono_devolver(p_negocio uuid, p_ref text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare m public.bonos_movimientos; b public.bonos; n int := 0; jefe boolean := public.bono_jefe(p_negocio);
begin
  if not public.es_miembro(p_negocio) then raise exception 'sin_permiso'; end if;
  for m in select * from public.bonos_movimientos x where x.negocio_id = p_negocio and x.tipo = 'redencion' and x.ref = p_ref loop
    if not jefe and m.por is distinct from auth.uid() then raise exception 'sin_permiso'; end if;
    begin
      insert into public.bonos_movimientos(bono_id, negocio_id, tipo, monto, ref, por) values (m.bono_id, p_negocio, 'devolucion', -m.monto, p_ref, auth.uid());
      update public.bonos set saldo = saldo + (-m.monto) where id = m.bono_id returning * into b;
      n := n + 1;
    exception when unique_violation then null;   -- ya se había devuelto: una sola vez
    end;
  end loop;
  return jsonb_build_object('ok', true, 'devueltos', n);
end $$;

-- Igual que antes + la lista con los códigos (valen como plata) solo para dueño, administrador o cajero.
create or replace function public.bono_lista(p_negocio uuid) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select case when public.bono_jefe(p_negocio) then coalesce((select jsonb_agg(public.bono_json(b) order by b.creado_en desc)
    from (select * from public.bonos where negocio_id = p_negocio order by creado_en desc limit 300) b), '[]'::jsonb) end
$$;

revoke all on function public.canal_escribir_activo(), public.canal_dueno_derivado(text), public.canal_choques(), public.bono_jefe(uuid), public.canal_sin_firmar_resumen(), public.canal_registros_sospechosos() from public, anon, authenticated;
grant execute on function public.canal_escribir_activo(), public.canal_dueno_derivado(text), public.canal_choques(), public.bono_jefe(uuid), public.canal_sin_firmar_resumen(), public.canal_registros_sospechosos() to service_role;
revoke all on function public.canal_privado_anotar(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.canal_privado_anotar(uuid, jsonb) to service_role;
revoke all on function public.canal_publicar(text, text, text) from public;
grant execute on function public.canal_publicar(text, text, text) to anon, authenticated, service_role;
revoke all on function public.canal_leer(text[], bigint, bigint, int) from public;
grant execute on function public.canal_leer(text[], bigint, bigint, int) to anon, authenticated, service_role;
revoke all on function public.pagos_estado(uuid) from public, anon;
grant execute on function public.pagos_estado(uuid) to authenticated, service_role;
revoke all on function public.bono_crear(uuid, numeric, text, int), public.bono_devolver(uuid, text), public.bono_lista(uuid) from public, anon;
grant execute on function public.bono_crear(uuid, numeric, text, int), public.bono_devolver(uuid, text), public.bono_lista(uuid) to authenticated;
