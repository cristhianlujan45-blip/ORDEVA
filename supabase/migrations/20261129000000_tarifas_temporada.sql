-- ORDEVA 1.87.0 · 🏨 Tarifas por temporada y fin de semana en las reservas en línea (hoteles, hostales, apartamentos).
-- Solo AGREGA: una función nueva (srv_tarifa_total) y dos funciones que ya existían (reserva_publica_crear y
-- reservas_disponibles, de 20261125000000_reservas.sql) que ahora la usan. No cambia tablas ni borra nada.
--
-- Las reglas viven en reservas_config.reglas (la misma configuración que ya guarda el dueño):
--   temporadas: [{ n: 'Alta', desde: '12-15', hasta: '01-15', pct: 30 }, …]   (mes-día; puede cruzar el año; pct puede ser
--               negativo para temporada baja; si una noche cae en varias, cuenta la primera de la lista)
--   finde:      { pct: 20, dias: [5, 6] }   (noches de viernes y sábado: 0 = domingo … 6 = sábado)
-- Cada noche vale precio × (1 + (temporada + fin de semana) / 100), redondeado a cientos. Sin reglas, igual que antes.

create or replace function public.srv_tarifa_noche(p_reglas jsonb, p_precio numeric, p_dia date) returns numeric
language plpgsql immutable set search_path = public as $$
declare md text := to_char(p_dia, 'MM-DD'); t jsonb; dd text; hh text; pt numeric := 0; pf numeric := 0; dias jsonb;
begin
  if p_precio is null then return null; end if;
  if jsonb_typeof(p_reglas -> 'temporadas') = 'array' then
    for t in select v from jsonb_array_elements(p_reglas -> 'temporadas') v limit 20 loop
      dd := t ->> 'desde'; hh := t ->> 'hasta';
      if coalesce(dd, '') ~ '^\d\d-\d\d$' and coalesce(hh, '') ~ '^\d\d-\d\d$' and coalesce(t ->> 'pct', '') ~ '^-?\d+(\.\d+)?$'
         and ((dd <= hh and md between dd and hh) or (dd > hh and (md >= dd or md <= hh))) then
        pt := (t ->> 'pct')::numeric; exit;
      end if;
    end loop;
  end if;
  if jsonb_typeof(p_reglas -> 'finde') = 'object' and coalesce(p_reglas -> 'finde' ->> 'pct', '') ~ '^-?\d+(\.\d+)?$' then
    dias := case when jsonb_typeof(p_reglas -> 'finde' -> 'dias') = 'array' then p_reglas -> 'finde' -> 'dias' else '[5, 6]'::jsonb end;
    if dias @> to_jsonb(extract(dow from p_dia)::int) then pf := (p_reglas -> 'finde' ->> 'pct')::numeric; end if;
  end if;
  return greatest(0, round(p_precio * (1 + greatest(-90, least(300, pt + pf)) / 100) / 100) * 100);
end $$;

create or replace function public.srv_tarifa_total(p_reglas jsonb, p_precio numeric, p_desde date, p_hasta date) returns numeric
language sql immutable set search_path = public as $$
  select case when p_precio is null then null else
    (select sum(public.srv_tarifa_noche(p_reglas, p_precio, d::date))
       from generate_series(p_desde, greatest(p_hasta, p_desde + 1) - 1, interval '1 day') d) end
$$;
revoke all on function public.srv_tarifa_noche(jsonb, numeric, date) from public, anon, authenticated;
revoke all on function public.srv_tarifa_total(jsonb, numeric, date, date) from public, anon, authenticated;

-- Los recursos LIBRES entre desde y hasta para «personas» (sin datos de nadie). 1.87.0: + «total» de la estadía (hoteles).
create or replace function public.reservas_disponibles(p_publico text, p_desde timestamptz, p_hasta timestamptz, p_personas int) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare c public.reservas_config;
begin
  select * into c from public.reservas_config where publico = p_publico and activo;
  if not found then raise exception 'no_disponible'; end if;
  if p_hasta <= p_desde or p_hasta - p_desde > interval '31 days' then raise exception 'fechas_invalidas'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', x ->> 'id', 'nombre', x ->> 'nombre', 'capacidad', (x ->> 'capacidad')::int, 'precio', (x ->> 'precio')::numeric, 'detalle', x ->> 'detalle',
        'total', case when c.tipo = 'habitacion' and (x ->> 'precio') is not null then public.srv_tarifa_total(c.reglas, (x ->> 'precio')::numeric, p_desde::date, p_hasta::date) end)
      order by (x ->> 'capacidad')::int nulls last, x ->> 'nombre')
    from jsonb_array_elements(c.recursos) x
    where coalesce((x ->> 'capacidad')::int, 99) >= coalesce(p_personas, 1)
      and public.srv_reserva_choque(c.negocio_id, x ->> 'id', p_desde, p_hasta, null) is null), '[]'::jsonb);
end $$;

-- Reservar en línea. Igual que antes; 1.87.0: el valor sale de la tarifa de cada noche (temporada y fin de semana).
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
          then public.srv_tarifa_total(c.reglas, (x ->> 'precio')::numeric, p_desde::date, p_hasta::date) end)
      returning * into r;
    exception when exclusion_violation then continue;           -- otro la tomó en ese mismo instante: la siguiente
    end;
    perform public.srv_negocio_avisar(c.negocio_id, 'reserva-nueva');
    return jsonb_build_object('ok', true, 'reserva', public.srv_reserva_json(r, false));
  end loop;
  return jsonb_build_object('ok', false, 'error', 'ocupado');
end $$;
