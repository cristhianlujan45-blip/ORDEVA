-- =====================================================================
-- ORDEVA 1.73.0 · 📅 Reservas de habitaciones y mesas, SIN duplicados
--   Pedido del dueño: «que los hoteles y restaurantes reciban reservas automáticamente… que no se dupliquen los estados de
--   reserva. Apenas hacemos una atención, ponerla ya no disponible».
--   • reservas: cada reserva de una habitación o mesa (recurso) entre «desde» y «hasta».
--     LA BASE DE DATOS impide dos reservas que se crucen en el mismo recurso (restricción de exclusión con rangos de
--     tiempo): ni dos celulares al mismo tiempo ni el agente de IA pueden reservar dos veces lo mismo.
--   • Una habitación o mesa ATENDIDA (cuenta abierta) es una reserva «ocupada»: queda no disponible para las reservas en
--     línea; al cobrarla se libera.
--   • reservas_config: lo que el negocio ofrece para reservar en línea (recursos, capacidad, horarios) y su id público
--     (el link del agente). Solo dueño o administrador lo cambia.
--   • Funciones públicas (sin cuenta) para el agente: ver disponibilidad, reservar, consultar y cancelar con el código.
--     Nunca devuelven datos de otros clientes. Topes contra abuso: 30 reservas en línea por hora por negocio y 3 por
--     teléfono al día.
--   Sin borrar nada: tablas y funciones nuevas.
-- =====================================================================
create extension if not exists btree_gist with schema extensions;

create table if not exists public.reservas (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios(id) on delete cascade,
  recurso text not null check (char_length(recurso) between 1 and 40),        -- la habitación o la mesa (su número en ORDEVA)
  recurso_nombre text check (char_length(recurso_nombre) <= 60),
  desde timestamptz not null,
  hasta timestamptz not null,
  estado text not null default 'confirmada' check (estado in ('pendiente', 'confirmada', 'ocupada', 'terminada', 'cancelada', 'no_llego')),
  cliente text check (char_length(cliente) <= 80),
  telefono text check (char_length(telefono) <= 20),
  personas int check (personas between 1 and 99),
  nota text check (char_length(nota) <= 300),
  origen text not null default 'app' check (origen in ('app', 'agente', 'web', 'ocupacion')),
  codigo text unique,
  valor numeric check (valor >= 0),
  creado_por uuid,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  check (hasta > desde),
  constraint reservas_sin_cruce exclude using gist (negocio_id with =, recurso with =, tstzrange(desde, hasta, '[)') with &&)
    where (estado in ('pendiente', 'confirmada', 'ocupada'))
);
create index if not exists reservas_negocio_idx on public.reservas(negocio_id, desde);
alter table public.reservas enable row level security;
drop policy if exists reservas_ver on public.reservas;
create policy reservas_ver on public.reservas for select using (public.es_miembro(negocio_id));

create table if not exists public.reservas_config (
  negocio_id uuid primary key references public.negocios(id) on delete cascade,
  publico text not null unique,
  activo boolean not null default false,
  tipo text not null default 'mesa' check (tipo in ('habitacion', 'mesa')),
  nombre text,
  recursos jsonb not null default '[]'::jsonb,        -- [{id, nombre, capacidad, precio, detalle}]
  reglas jsonb not null default '{}'::jsonb,          -- {entrada, salida, duracion_min, abre, cierra, dias, confirmar, whatsapp, info}
  actualizado_en timestamptz not null default now()
);
alter table public.reservas_config enable row level security;
drop policy if exists reservas_config_ver on public.reservas_config;
create policy reservas_config_ver on public.reservas_config for select using (public.es_miembro(negocio_id));

-- ---------- Ayudas ----------
create or replace function public.srv_reserva_json(r public.reservas, completa boolean) returns jsonb
language sql immutable set search_path = public, extensions as $$
  select jsonb_build_object('id', r.id, 'recurso', r.recurso, 'recurso_nombre', r.recurso_nombre, 'desde', r.desde, 'hasta', r.hasta,
    'estado', r.estado, 'personas', r.personas, 'origen', r.origen, 'codigo', r.codigo, 'valor', r.valor, 'creado_en', r.creado_en)
    || case when completa then jsonb_build_object('cliente', r.cliente, 'telefono', r.telefono, 'nota', r.nota) else '{}'::jsonb end
$$;
create or replace function public.srv_reserva_codigo() returns text
language plpgsql volatile set search_path = public, extensions as $$
declare c text; abc text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
begin
  loop
    c := '';
    for i in 1..6 loop c := c || substr(abc, 1 + floor(random() * length(abc))::int, 1); end loop;
    exit when not exists (select 1 from public.reservas where codigo = c);
  end loop;
  return c;
end $$;
-- El cruce con OTRA reserva activa (para decir con quién choca, sin datos del cliente).
create or replace function public.srv_reserva_choque(p_negocio uuid, p_recurso text, p_desde timestamptz, p_hasta timestamptz, p_menos uuid) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object('desde', r.desde, 'hasta', r.hasta, 'estado', r.estado, 'recurso', r.recurso, 'recurso_nombre', r.recurso_nombre)
  from public.reservas r
  where r.negocio_id = p_negocio and r.recurso = p_recurso and r.estado in ('pendiente', 'confirmada', 'ocupada')
    and tstzrange(r.desde, r.hasta, '[)') && tstzrange(p_desde, p_hasta, '[)') and r.id is distinct from p_menos
  order by r.desde limit 1
$$;

-- ---------- Configuración (dueño o administrador) ----------
create or replace function public.reservas_config_guardar(p_negocio uuid, p_activo boolean, p_tipo text, p_nombre text, p_recursos jsonb, p_reglas jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare c public.reservas_config;
begin
  if coalesce(public.rol_en(p_negocio), '') not in ('dueno', 'admin') then raise exception 'sin_permiso'; end if;
  if jsonb_typeof(coalesce(p_recursos, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_recursos, '[]'::jsonb)) > 300 then raise exception 'recursos_invalidos'; end if;
  insert into public.reservas_config(negocio_id, publico, activo, tipo, nombre, recursos, reglas)
  values (p_negocio, lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)), coalesce(p_activo, false),
    case when p_tipo = 'habitacion' then 'habitacion' else 'mesa' end, left(p_nombre, 60), coalesce(p_recursos, '[]'::jsonb), coalesce(p_reglas, '{}'::jsonb))
  on conflict (negocio_id) do update set activo = excluded.activo, tipo = excluded.tipo, nombre = excluded.nombre,
    recursos = excluded.recursos, reglas = excluded.reglas, actualizado_en = now()
  returning * into c;
  return to_jsonb(c);
end $$;
create or replace function public.reservas_config_ver(p_negocio uuid) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select case when public.es_miembro(p_negocio) then (select to_jsonb(c) from public.reservas_config c where c.negocio_id = p_negocio) end
$$;

-- ---------- Las reservas del negocio (equipo) ----------
create or replace function public.reservas_lista(p_negocio uuid, p_desde timestamptz, p_hasta timestamptz) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if not public.es_miembro(p_negocio) then raise exception 'sin_permiso'; end if;
  return coalesce((select jsonb_agg(public.srv_reserva_json(r, true) order by r.desde)
    from public.reservas r where r.negocio_id = p_negocio and r.hasta > p_desde and r.desde < p_hasta
      and r.estado <> 'cancelada'), '[]'::jsonb);
end $$;

-- Crear o cambiar una reserva desde la app. Si se cruza con otra, 'ocupado' y con cuál choca (nunca se guarda doble).
create or replace function public.reserva_guardar(p_negocio uuid, p_id uuid, p_recurso text, p_recurso_nombre text, p_desde timestamptz, p_hasta timestamptz,
  p_cliente text, p_telefono text, p_personas int, p_nota text, p_estado text, p_valor numeric) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare r public.reservas; ch jsonb;
begin
  if not public.es_miembro(p_negocio) then raise exception 'sin_permiso'; end if;
  if p_hasta <= p_desde then raise exception 'fechas_invalidas'; end if;
  ch := public.srv_reserva_choque(p_negocio, p_recurso, p_desde, p_hasta, p_id);
  if ch is not null and coalesce(p_estado, 'confirmada') in ('pendiente', 'confirmada', 'ocupada') then
    return jsonb_build_object('ok', false, 'error', 'ocupado', 'choque', ch);
  end if;
  begin
    if p_id is null then
      insert into public.reservas(negocio_id, recurso, recurso_nombre, desde, hasta, estado, cliente, telefono, personas, nota, origen, codigo, valor, creado_por)
      values (p_negocio, p_recurso, left(p_recurso_nombre, 60), p_desde, p_hasta, coalesce(p_estado, 'confirmada'), left(p_cliente, 80), left(p_telefono, 20),
        p_personas, left(p_nota, 300), 'app', public.srv_reserva_codigo(), p_valor, auth.uid())
      returning * into r;
    else
      update public.reservas set recurso = p_recurso, recurso_nombre = left(p_recurso_nombre, 60), desde = p_desde, hasta = p_hasta,
        estado = coalesce(p_estado, estado), cliente = left(p_cliente, 80), telefono = left(p_telefono, 20), personas = p_personas,
        nota = left(p_nota, 300), valor = p_valor, actualizado_en = now()
      where id = p_id and negocio_id = p_negocio returning * into r;
      if not found then raise exception 'no_existe'; end if;
    end if;
  exception when exclusion_violation then
    -- Otro equipo reservó lo mismo en el mismo instante: la base de datos lo impidió.
    return jsonb_build_object('ok', false, 'error', 'ocupado', 'choque', public.srv_reserva_choque(p_negocio, p_recurso, p_desde, p_hasta, p_id));
  end;
  perform public.srv_negocio_avisar(p_negocio, 'reservas');
  return jsonb_build_object('ok', true, 'reserva', public.srv_reserva_json(r, true));
end $$;

-- Cambiar el estado: llegó (ocupada), terminada, cancelada, no llegó.
create or replace function public.reserva_estado(p_id uuid, p_estado text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare r public.reservas;
begin
  select * into r from public.reservas where id = p_id;
  if not found then raise exception 'no_existe'; end if;
  if not public.es_miembro(r.negocio_id) then raise exception 'sin_permiso'; end if;
  if p_estado not in ('pendiente', 'confirmada', 'ocupada', 'terminada', 'cancelada', 'no_llego') then raise exception 'estado_invalido'; end if;
  begin
    update public.reservas set estado = p_estado, actualizado_en = now(),
      hasta = case when p_estado = 'terminada' and now() > desde and now() < hasta then now() else hasta end
    where id = p_id returning * into r;
  exception when exclusion_violation then
    return jsonb_build_object('ok', false, 'error', 'ocupado', 'choque', public.srv_reserva_choque(r.negocio_id, r.recurso, r.desde, r.hasta, r.id));
  end;
  perform public.srv_negocio_avisar(r.negocio_id, 'reservas');
  return jsonb_build_object('ok', true, 'reserva', public.srv_reserva_json(r, true));
end $$;

-- Se ATENDIÓ (se abrió la cuenta): la habitación o mesa queda ocupada hasta p_hasta. Si tenía una reserva para ahora, esa
-- pasa a «ocupada» (llegó el cliente). Si choca con una reserva más adelante, se ocupa hasta que esa empiece y se avisa.
create or replace function public.reserva_ocupar(p_negocio uuid, p_recurso text, p_recurso_nombre text, p_hasta timestamptz) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare r public.reservas; prox public.reservas; fin timestamptz := p_hasta;
begin
  if not public.es_miembro(p_negocio) then raise exception 'sin_permiso'; end if;
  -- ¿Ya está ocupada (o con una reserva que empieza ahora o empezó hace poco)?
  select * into r from public.reservas where negocio_id = p_negocio and recurso = p_recurso and estado in ('confirmada', 'pendiente', 'ocupada')
    and desde <= now() + interval '2 hours' and hasta > now() order by (estado = 'ocupada') desc, desde limit 1;
  if found then
    if r.estado <> 'ocupada' then update public.reservas set estado = 'ocupada', actualizado_en = now() where id = r.id returning * into r;
      perform public.srv_negocio_avisar(p_negocio, 'reservas'); end if;
    return jsonb_build_object('ok', true, 'reserva', public.srv_reserva_json(r, true), 'llego', r.origen <> 'ocupacion');
  end if;
  select * into prox from public.reservas where negocio_id = p_negocio and recurso = p_recurso and estado in ('confirmada', 'pendiente')
    and desde > now() and desde < fin order by desde limit 1;
  if found then fin := prox.desde; end if;
  if fin <= now() + interval '5 minutes' then
    return jsonb_build_object('ok', false, 'error', 'reservada_ya', 'choque', public.srv_reserva_json(prox, false));
  end if;
  begin
    insert into public.reservas(negocio_id, recurso, recurso_nombre, desde, hasta, estado, origen, creado_por)
    values (p_negocio, p_recurso, left(p_recurso_nombre, 60), now(), fin, 'ocupada', 'ocupacion', auth.uid()) returning * into r;
  exception when exclusion_violation then
    return jsonb_build_object('ok', false, 'error', 'ocupado');
  end;
  perform public.srv_negocio_avisar(p_negocio, 'reservas');
  return jsonb_build_object('ok', true, 'reserva', public.srv_reserva_json(r, true), 'hasta_reserva', case when prox.id is not null then public.srv_reserva_json(prox, false) end);
end $$;

-- La ocupación sigue: se alarga hasta p_hasta (sin pisar la siguiente reserva).
create or replace function public.reserva_extender(p_negocio uuid, p_recurso text, p_hasta timestamptz) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare r public.reservas; prox timestamptz; fin timestamptz := p_hasta;
begin
  if not public.es_miembro(p_negocio) then raise exception 'sin_permiso'; end if;
  select * into r from public.reservas where negocio_id = p_negocio and recurso = p_recurso and estado = 'ocupada' and hasta > now() - interval '1 day'
    order by desde desc limit 1;
  if not found or r.hasta >= p_hasta then return jsonb_build_object('ok', true); end if;
  select min(desde) into prox from public.reservas where negocio_id = p_negocio and recurso = p_recurso and estado in ('confirmada', 'pendiente') and desde > r.desde;
  if prox is not null and prox < fin then fin := prox; end if;
  if fin <= r.hasta then return jsonb_build_object('ok', false, 'error', 'reservada_despues', 'desde', prox); end if;
  update public.reservas set hasta = fin, actualizado_en = now() where id = r.id;
  return jsonb_build_object('ok', true, 'hasta', fin);
end $$;

-- Se cobró la cuenta: la ocupación termina ahora (queda disponible).
create or replace function public.reserva_liberar(p_negocio uuid, p_recurso text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare n int;
begin
  if not public.es_miembro(p_negocio) then raise exception 'sin_permiso'; end if;
  update public.reservas set estado = 'terminada', hasta = greatest(desde + interval '1 minute', least(hasta, now())), actualizado_en = now()
    where negocio_id = p_negocio and recurso = p_recurso and estado = 'ocupada';
  get diagnostics n = row_count;
  if n > 0 then perform public.srv_negocio_avisar(p_negocio, 'reservas'); end if;
  return jsonb_build_object('ok', true, 'liberadas', n);
end $$;

-- ---------- Público (el agente de IA y la página de reservas, sin cuenta) ----------
create or replace function public.reservas_publico_info(p_publico text) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object('nombre', coalesce(c.nombre, n.nombre), 'tipo', c.tipo, 'reglas', c.reglas,
    'recursos', (select coalesce(jsonb_agg(jsonb_build_object('id', x ->> 'id', 'nombre', x ->> 'nombre', 'capacidad', (x ->> 'capacidad')::int,
      'precio', (x ->> 'precio')::numeric, 'detalle', x ->> 'detalle')), '[]'::jsonb) from jsonb_array_elements(c.recursos) x))
  from public.reservas_config c join public.negocios n on n.id = c.negocio_id
  where c.publico = p_publico and c.activo
$$;

-- Los recursos LIBRES entre desde y hasta para «personas» (sin datos de nadie).
create or replace function public.reservas_disponibles(p_publico text, p_desde timestamptz, p_hasta timestamptz, p_personas int) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare c public.reservas_config;
begin
  select * into c from public.reservas_config where publico = p_publico and activo;
  if not found then raise exception 'no_disponible'; end if;
  if p_hasta <= p_desde or p_hasta - p_desde > interval '31 days' then raise exception 'fechas_invalidas'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', x ->> 'id', 'nombre', x ->> 'nombre', 'capacidad', (x ->> 'capacidad')::int, 'precio', (x ->> 'precio')::numeric, 'detalle', x ->> 'detalle')
      order by (x ->> 'capacidad')::int nulls last, x ->> 'nombre')
    from jsonb_array_elements(c.recursos) x
    where coalesce((x ->> 'capacidad')::int, 99) >= coalesce(p_personas, 1)
      and public.srv_reserva_choque(c.negocio_id, x ->> 'id', p_desde, p_hasta, null) is null), '[]'::jsonb);
end $$;

-- Reservar en línea. Sin recurso: el más pequeño que alcance y esté libre. 'ocupado' si en el mismo instante otro lo tomó.
create or replace function public.reserva_publica_crear(p_publico text, p_recurso text, p_desde timestamptz, p_hasta timestamptz,
  p_cliente text, p_telefono text, p_personas int, p_nota text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare c public.reservas_config; x jsonb; r public.reservas; tel text := regexp_replace(coalesce(p_telefono, ''), '\D', '', 'g');
  dias int; est text;
begin
  select * into c from public.reservas_config where publico = p_publico and activo;
  if not found then return jsonb_build_object('ok', false, 'error', 'no_disponible'); end if;
  if length(trim(coalesce(p_cliente, ''))) < 2 then return jsonb_build_object('ok', false, 'error', 'falta_nombre'); end if;
  if length(tel) < 7 or length(tel) > 15 then return jsonb_build_object('ok', false, 'error', 'falta_telefono'); end if;
  dias := coalesce((c.reglas ->> 'dias')::int, 90);
  if p_hasta <= p_desde or p_desde < now() - interval '10 minutes' or p_desde > now() + make_interval(days => dias)
     or p_hasta - p_desde > interval '31 days' then return jsonb_build_object('ok', false, 'error', 'fechas_invalidas'); end if;
  -- Topes contra abuso
  if (select count(*) from public.reservas where negocio_id = c.negocio_id and origen in ('agente', 'web') and creado_en > now() - interval '1 hour') >= 30
     or (select count(*) from public.reservas where negocio_id = c.negocio_id and origen in ('agente', 'web') and regexp_replace(coalesce(telefono, ''), '\D', '', 'g') = tel
          and creado_en > now() - interval '1 day' and estado <> 'cancelada') >= 3
  then return jsonb_build_object('ok', false, 'error', 'demasiadas'); end if;
  for x in select v from jsonb_array_elements(c.recursos) v
    where (p_recurso is null or v ->> 'id' = p_recurso) and coalesce((v ->> 'capacidad')::int, 99) >= coalesce(p_personas, 1)
    order by (v ->> 'capacidad')::int nulls last, v ->> 'nombre'
  loop
    if public.srv_reserva_choque(c.negocio_id, x ->> 'id', p_desde, p_hasta, null) is not null then continue; end if;
    est := case when coalesce((c.reglas ->> 'confirmar')::boolean, false) then 'pendiente' else 'confirmada' end;
    begin
      insert into public.reservas(negocio_id, recurso, recurso_nombre, desde, hasta, estado, cliente, telefono, personas, nota, origen, codigo, valor)
      values (c.negocio_id, x ->> 'id', left(x ->> 'nombre', 60), p_desde, p_hasta, est, left(trim(p_cliente), 80), left(tel, 20), p_personas, left(p_nota, 300), 'agente',
        public.srv_reserva_codigo(),
        case when c.tipo = 'habitacion' and (x ->> 'precio') is not null
          then (x ->> 'precio')::numeric * greatest(1, (p_hasta::date - p_desde::date)) end)
      returning * into r;
    exception when exclusion_violation then continue;           -- otro la tomó en ese mismo instante: la siguiente
    end;
    perform public.srv_negocio_avisar(c.negocio_id, 'reserva-nueva');
    return jsonb_build_object('ok', true, 'reserva', public.srv_reserva_json(r, false));
  end loop;
  return jsonb_build_object('ok', false, 'error', 'ocupado');
end $$;

create or replace function public.reserva_publica_ver(p_codigo text) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select public.srv_reserva_json(r, false) || jsonb_build_object('negocio', coalesce(c.nombre, n.nombre))
  from public.reservas r join public.negocios n on n.id = r.negocio_id left join public.reservas_config c on c.negocio_id = r.negocio_id
  where r.codigo = upper(trim(p_codigo)) and r.origen in ('agente', 'web', 'app')
$$;

create or replace function public.reserva_publica_cancelar(p_codigo text, p_telefono text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare r public.reservas;
begin
  select * into r from public.reservas where codigo = upper(trim(p_codigo));
  if not found or regexp_replace(coalesce(r.telefono, ''), '\D', '', 'g') <> regexp_replace(coalesce(p_telefono, ''), '\D', '', 'g') or length(coalesce(r.telefono, '')) < 7
  then return jsonb_build_object('ok', false, 'error', 'no_existe'); end if;
  if r.estado not in ('pendiente', 'confirmada') then return jsonb_build_object('ok', false, 'error', 'no_se_puede'); end if;
  update public.reservas set estado = 'cancelada', actualizado_en = now() where id = r.id;
  perform public.srv_negocio_avisar(r.negocio_id, 'reservas');
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.srv_reserva_json(public.reservas, boolean), public.srv_reserva_codigo(), public.srv_reserva_choque(uuid, text, timestamptz, timestamptz, uuid) from public, anon, authenticated;
revoke all on function public.reservas_config_guardar(uuid, boolean, text, text, jsonb, jsonb), public.reservas_config_ver(uuid), public.reservas_lista(uuid, timestamptz, timestamptz),
  public.reserva_guardar(uuid, uuid, text, text, timestamptz, timestamptz, text, text, int, text, text, numeric), public.reserva_estado(uuid, text),
  public.reserva_ocupar(uuid, text, text, timestamptz), public.reserva_extender(uuid, text, timestamptz), public.reserva_liberar(uuid, text) from public, anon;
grant execute on function public.reservas_config_guardar(uuid, boolean, text, text, jsonb, jsonb), public.reservas_config_ver(uuid), public.reservas_lista(uuid, timestamptz, timestamptz),
  public.reserva_guardar(uuid, uuid, text, text, timestamptz, timestamptz, text, text, int, text, text, numeric), public.reserva_estado(uuid, text),
  public.reserva_ocupar(uuid, text, text, timestamptz), public.reserva_extender(uuid, text, timestamptz), public.reserva_liberar(uuid, text) to authenticated, service_role;
grant execute on function public.reservas_publico_info(text), public.reservas_disponibles(text, timestamptz, timestamptz, int),
  public.reserva_publica_crear(text, text, timestamptz, timestamptz, text, text, int, text), public.reserva_publica_ver(text),
  public.reserva_publica_cancelar(text, text) to anon, authenticated, service_role;
