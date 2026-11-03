-- ORDEVA 1.77.0 · ⚡ Reservas de Booking / Airbnb casi al instante y con los datos del huésped.
-- Booking y Airbnb no dejan que un programa como ORDEVA lea sus reservas directo (esa conexión es solo para empresas
-- certificadas). Lo que sí hay, y aquí se junta:
--  1. EL CALENDARIO (iCal) de cada habitación: ahora lo lee el SERVIDOR cada 5 minutos (pg_cron → vento_repaso →
--     Edge Function vento-ical/sincronizar), aunque ORDEVA esté cerrado. Los links quedan en «reservas_ical_links».
--  2. EL AVISO del celular del dueño: la app Android lee la notificación de Booking.com Pulse / Airbnb («Nueva reserva de
--     Juan Pérez, 5–7 nov, 2 huéspedes») apenas llega y la guarda aquí («reservas_avisos») con reserva_aviso_guardar.
--  3. SE JUNTAN: la reserva del calendario (que solo trae fechas) recibe el nombre, el celular y las personas del aviso de
--     la misma plataforma con las mismas fechas (llegue primero el uno o el otro). Nada se duplica.

-- ---------- Links de calendario por habitación (los lee el servidor) ----------
create table if not exists public.reservas_ical_links (
  negocio_id uuid not null references public.negocios(id) on delete cascade,
  recurso text not null,
  recurso_nombre text,
  fuente text not null,
  url text not null,
  ult timestamptz,
  error text,
  n int,
  choques jsonb not null default '[]'::jsonb,
  creado_en timestamptz not null default now(),
  primary key (negocio_id, recurso, url)
);
alter table public.reservas_ical_links enable row level security;   -- sin políticas: solo por las funciones de abajo

-- ---------- Avisos de las apps de reservas (celular del dueño) ----------
create table if not exists public.reservas_avisos (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios(id) on delete cascade,
  fuente text not null,
  tipo text not null default 'nueva' check (tipo in ('nueva', 'cancelada', 'cambio', 'otro')),
  cliente text, telefono text, personas int, codigo text,
  desde timestamptz, hasta timestamptz,
  texto text,
  reserva_id uuid,
  creado_en timestamptz not null default now()
);
create index if not exists reservas_avisos_neg on public.reservas_avisos(negocio_id, creado_en desc);
alter table public.reservas_avisos enable row level security;

-- Juntar un aviso con la reserva del calendario de la misma plataforma y las mismas fechas (día de Colombia).
create or replace function public.srv_reserva_aviso_casar(p_aviso uuid) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare a public.reservas_avisos; rid uuid; n int;
begin
  select * into a from public.reservas_avisos where id = p_aviso;
  if not found or a.reserva_id is not null or a.tipo <> 'nueva' or a.desde is null or a.hasta is null then return a.reserva_id; end if;
  select count(*), min(r.id::text)::uuid into n, rid from public.reservas r
  where r.negocio_id = a.negocio_id and r.nota like 'ical:' || a.fuente || ':%' and r.estado in ('pendiente', 'confirmada', 'ocupada')
    and (r.desde at time zone 'America/Bogota')::date = (a.desde at time zone 'America/Bogota')::date
    and (r.hasta at time zone 'America/Bogota')::date = (a.hasta at time zone 'America/Bogota')::date
    and coalesce(r.cliente, '') like '🔗%';
  if n <> 1 then return null; end if;   -- ninguna o varias (dos habitaciones iguales): no se adivina
  update public.reservas set cliente = left(coalesce(nullif(a.cliente, ''), cliente), 80), telefono = coalesce(nullif(a.telefono, ''), telefono),
    personas = coalesce(a.personas, personas), actualizado_en = now() where id = rid;
  update public.reservas_avisos set reserva_id = rid where id = a.id;
  perform public.srv_negocio_avisar(a.negocio_id, 'reservas');
  return rid;
end $$;

-- ---------- Importar (la misma lógica de la 1.76.0, ahora también para el servidor) ----------
create or replace function public.srv_reserva_ical_sincronizar(p_negocio uuid, p_recurso text, p_recurso_nombre text, p_fuente text, p_eventos jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_fuente text := left(regexp_replace(coalesce(p_fuente, 'Otra'), '[^[:alnum:] ._-]', '', 'g'), 30);
  pref text;
  e jsonb; uid text; d timestamptz; h timestamptz; v_nota text; v_cliente text; r public.reservas; nueva uuid;
  nuevas int := 0; cambiadas int := 0; canceladas int := 0; choques jsonb := '[]'::jsonb; vistos text[] := '{}';
begin
  if v_fuente = '' then v_fuente := 'Otra'; end if;
  pref := 'ical:' || v_fuente || ':';
  if jsonb_typeof(coalesce(p_eventos, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_eventos, '[]'::jsonb)) > 500 then raise exception 'eventos_invalidos'; end if;
  for e in select * from jsonb_array_elements(coalesce(p_eventos, '[]'::jsonb)) loop
    uid := left(coalesce(e->>'uid', ''), 200);
    begin d := (e->>'desde')::timestamptz; h := (e->>'hasta')::timestamptz; exception when others then continue; end;
    if uid = '' or d is null or h is null or h <= d or h < now() - interval '1 day' or h - d > interval '120 days' then continue; end if;
    v_nota := pref || uid; vistos := vistos || v_nota;
    -- Lo que trae el calendario (Airbnb: código de la reserva y los últimos 4 del celular; otras plataformas: el nombre).
    v_cliente := left('🔗 ' || v_fuente || coalesce(' · ' || nullif(left(e->>'detalle', 60), ''), ''), 80);
    select * into r from public.reservas x where x.negocio_id = p_negocio and x.recurso = p_recurso and x.nota = v_nota order by x.creado_en desc limit 1;
    begin
      if found and r.estado in ('pendiente', 'confirmada', 'ocupada') then
        if r.desde <> d or r.hasta <> h then
          update public.reservas x set desde = d, hasta = h, actualizado_en = now() where x.id = r.id;
          cambiadas := cambiadas + 1;
        end if;
      elsif not found or r.estado = 'cancelada' then
        insert into public.reservas(negocio_id, recurso, recurso_nombre, desde, hasta, estado, cliente, nota, origen, codigo, creado_por)
        values (p_negocio, p_recurso, left(p_recurso_nombre, 60), d, h, 'confirmada', v_cliente, v_nota, 'web', public.srv_reserva_codigo(), auth.uid())
        returning id into nueva;
        nuevas := nuevas + 1;
        -- Si el aviso del celular llegó antes, la reserva queda ya con el nombre del huésped.
        perform public.srv_reserva_aviso_casar(a.id) from public.reservas_avisos a
          where a.negocio_id = p_negocio and a.fuente = v_fuente and a.reserva_id is null and a.tipo = 'nueva' and a.creado_en > now() - interval '30 days'
            and (a.desde at time zone 'America/Bogota')::date = (d at time zone 'America/Bogota')::date
            and (a.hasta at time zone 'America/Bogota')::date = (h at time zone 'America/Bogota')::date;
      end if;
    exception when exclusion_violation then
      choques := choques || jsonb_build_object('uid', uid, 'desde', d, 'hasta', h, 'con', public.srv_reserva_choque(p_negocio, p_recurso, d, h, null));
    end;
  end loop;
  update public.reservas x set estado = 'cancelada', actualizado_en = now()
  where x.negocio_id = p_negocio and x.recurso = p_recurso and x.nota like pref || '%' and not (x.nota = any(vistos))
    and x.estado in ('pendiente', 'confirmada') and x.hasta > now();
  get diagnostics canceladas = row_count;
  if nuevas + cambiadas + canceladas > 0 then perform public.srv_negocio_avisar(p_negocio, 'reservas'); end if;
  return jsonb_build_object('ok', true, 'nuevas', nuevas, 'cambiadas', cambiadas, 'canceladas', canceladas, 'choques', choques);
end $$;

create or replace function public.reserva_ical_sincronizar(p_negocio uuid, p_recurso text, p_recurso_nombre text, p_fuente text, p_eventos jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.es_miembro(p_negocio) then raise exception 'sin_permiso'; end if;
  return public.srv_reserva_ical_sincronizar(p_negocio, p_recurso, p_recurso_nombre, p_fuente, p_eventos);
end $$;

-- ---------- Links: guardar (dueño/administrador) y ver (equipo; el link completo solo el dueño/administrador) ----------
create or replace function public.reservas_ical_links_guardar(p_negocio uuid, p_links jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare l jsonb; n int := 0;
begin
  if coalesce(public.rol_en(p_negocio), '') not in ('dueno', 'admin') then raise exception 'sin_permiso'; end if;
  if jsonb_typeof(coalesce(p_links, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_links, '[]'::jsonb)) > 300 then raise exception 'links_invalidos'; end if;
  delete from public.reservas_ical_links x where x.negocio_id = p_negocio
    and not exists (select 1 from jsonb_array_elements(p_links) j where j->>'recurso' = x.recurso and j->>'url' = x.url);
  for l in select * from jsonb_array_elements(coalesce(p_links, '[]'::jsonb)) loop
    if coalesce(l->>'url', '') !~ '^https?://' or length(l->>'url') > 600 or coalesce(l->>'recurso', '') = '' then continue; end if;
    insert into public.reservas_ical_links(negocio_id, recurso, recurso_nombre, fuente, url)
    values (p_negocio, left(l->>'recurso', 40), left(l->>'recurso_nombre', 60), left(coalesce(nullif(l->>'fuente', ''), 'Otra'), 30), l->>'url')
    on conflict (negocio_id, recurso, url) do update set recurso_nombre = excluded.recurso_nombre, fuente = excluded.fuente;
    n := n + 1;
  end loop;
  return jsonb_build_object('ok', true, 'links', n);
end $$;

create or replace function public.reservas_ical_links_ver(p_negocio uuid) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare jefe boolean;
begin
  if not public.es_miembro(p_negocio) then raise exception 'sin_permiso'; end if;
  jefe := coalesce(public.rol_en(p_negocio), '') in ('dueno', 'admin');
  return coalesce((select jsonb_agg(jsonb_build_object('recurso', recurso, 'recurso_nombre', recurso_nombre, 'fuente', fuente,
    'url', case when jefe then url else null end, 'ult', ult, 'error', error, 'n', n, 'choques', choques) order by recurso, fuente)
    from public.reservas_ical_links where negocio_id = p_negocio), '[]'::jsonb);
end $$;

-- ---------- Avisos del celular ----------
create or replace function public.reserva_aviso_guardar(p_negocio uuid, p_fuente text, p_tipo text, p_cliente text, p_telefono text,
  p_personas int, p_codigo text, p_desde timestamptz, p_hasta timestamptz, p_texto text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare a public.reservas_avisos; ya uuid; rid uuid; f text := left(regexp_replace(coalesce(p_fuente, 'Otra'), '[^[:alnum:] ._-]', '', 'g'), 30);
begin
  if not public.es_miembro(p_negocio) then raise exception 'sin_permiso'; end if;
  if (select count(*) from public.reservas_avisos where negocio_id = p_negocio and creado_en > now() - interval '1 hour') > 120 then raise exception 'demasiados'; end if;
  -- El mismo aviso desde dos celulares del negocio (o repetido): una sola vez.
  select id into ya from public.reservas_avisos where negocio_id = p_negocio and fuente = f and tipo = coalesce(p_tipo, 'nueva')
    and coalesce(codigo, '') = coalesce(left(p_codigo, 40), '') and coalesce(cliente, '') = coalesce(left(p_cliente, 80), '')
    and desde is not distinct from p_desde and hasta is not distinct from p_hasta and creado_en > now() - interval '3 days' limit 1;
  if ya is not null then return jsonb_build_object('ok', true, 'duplicado', true, 'id', ya, 'reserva', (select reserva_id from public.reservas_avisos where id = ya)); end if;
  insert into public.reservas_avisos(negocio_id, fuente, tipo, cliente, telefono, personas, codigo, desde, hasta, texto)
  values (p_negocio, f, case when p_tipo in ('nueva', 'cancelada', 'cambio') then p_tipo else 'otro' end, left(p_cliente, 80), left(p_telefono, 20),
    case when p_personas between 1 and 50 then p_personas end, left(p_codigo, 40), p_desde, p_hasta, left(p_texto, 400))
  returning * into a;
  rid := public.srv_reserva_aviso_casar(a.id);
  perform public.srv_negocio_avisar(p_negocio, 'reservas');
  return jsonb_build_object('ok', true, 'id', a.id, 'reserva', rid);
end $$;

create or replace function public.reservas_avisos_lista(p_negocio uuid) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if not public.es_miembro(p_negocio) then raise exception 'sin_permiso'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'fuente', a.fuente, 'tipo', a.tipo, 'cliente', a.cliente, 'telefono', a.telefono,
    'personas', a.personas, 'codigo', a.codigo, 'desde', a.desde, 'hasta', a.hasta, 'reserva', a.reserva_id, 'recurso_nombre', r.recurso_nombre, 'creado_en', a.creado_en) order by a.creado_en desc)
    from public.reservas_avisos a left join public.reservas r on r.id = a.reserva_id
    where a.negocio_id = p_negocio and a.creado_en > now() - interval '30 days'), '[]'::jsonb);
end $$;

-- Asignar a mano a una habitación un aviso que el calendario todavía no trae (o que no se pudo juntar).
create or replace function public.reserva_aviso_asignar(p_aviso uuid, p_recurso text, p_recurso_nombre text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare a public.reservas_avisos; x jsonb;
begin
  select * into a from public.reservas_avisos where id = p_aviso;
  if not found then raise exception 'no_existe'; end if;
  if not public.es_miembro(a.negocio_id) then raise exception 'sin_permiso'; end if;
  if a.reserva_id is not null then return jsonb_build_object('ok', true, 'reserva', a.reserva_id); end if;
  if a.desde is null or a.hasta is null then raise exception 'sin_fechas'; end if;
  x := public.reserva_guardar(a.negocio_id, null, p_recurso, p_recurso_nombre, a.desde, a.hasta, coalesce(a.cliente, '📲 ' || a.fuente), a.telefono, a.personas,
    '📲 ' || a.fuente || coalesce(' · ' || a.codigo, ''), 'confirmada', null);
  if coalesce((x->>'ok')::boolean, false) then update public.reservas_avisos set reserva_id = (x->'reserva'->>'id')::uuid where id = a.id; end if;
  return x;
end $$;

-- ---------- Para el servidor (Edge Function vento-ical, con service_role) ----------
create or replace function public.srv_ical_pendientes(p_negocio uuid) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select coalesce(jsonb_agg(jsonb_build_object('negocio', l.negocio_id, 'recurso', l.recurso, 'recurso_nombre', l.recurso_nombre, 'fuente', l.fuente, 'url', l.url,
    'entrada', coalesce(c.reglas->>'entrada', '15:00'), 'salida', coalesce(c.reglas->>'salida', '12:00')) order by l.ult nulls first), '[]'::jsonb)
  from public.reservas_ical_links l left join public.reservas_config c on c.negocio_id = l.negocio_id
  where (p_negocio is null or l.negocio_id = p_negocio)
$$;
create or replace function public.srv_ical_link_estado(p_negocio uuid, p_recurso text, p_url text, p_error text, p_n int, p_choques jsonb) returns void
language sql security definer set search_path = public, extensions as $$
  update public.reservas_ical_links set ult = now(), error = left(p_error, 200), n = p_n, choques = coalesce(p_choques, '[]'::jsonb)
  where negocio_id = p_negocio and recurso = p_recurso and url = p_url
$$;
-- La app pide sincronizar YA su negocio (al llegar un aviso o con «🔄 Sincronizar ahora»): ¿es del equipo?
create or replace function public.reservas_ical_puede(p_negocio uuid) returns boolean
language sql stable security definer set search_path = public, extensions as $$ select public.es_miembro(p_negocio) $$;

revoke all on function public.srv_reserva_aviso_casar(uuid) from public, anon, authenticated;
revoke all on function public.srv_reserva_ical_sincronizar(uuid, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.srv_ical_pendientes(uuid) from public, anon, authenticated;
revoke all on function public.srv_ical_link_estado(uuid, text, text, text, int, jsonb) from public, anon, authenticated;
grant execute on function public.srv_reserva_ical_sincronizar(uuid, text, text, text, jsonb) to service_role;
grant execute on function public.srv_ical_pendientes(uuid) to service_role;
grant execute on function public.srv_ical_link_estado(uuid, text, text, text, int, jsonb) to service_role;
grant execute on function public.srv_reserva_aviso_casar(uuid) to service_role;
revoke all on function public.reserva_ical_sincronizar(uuid, text, text, text, jsonb) from public;
grant execute on function public.reserva_ical_sincronizar(uuid, text, text, text, jsonb) to authenticated;
revoke all on function public.reservas_ical_links_guardar(uuid, jsonb) from public;
revoke all on function public.reservas_ical_links_ver(uuid) from public;
revoke all on function public.reserva_aviso_guardar(uuid, text, text, text, text, int, text, timestamptz, timestamptz, text) from public;
revoke all on function public.reservas_avisos_lista(uuid) from public;
revoke all on function public.reserva_aviso_asignar(uuid, text, text) from public;
revoke all on function public.reservas_ical_puede(uuid) from public;
grant execute on function public.reservas_ical_links_guardar(uuid, jsonb) to authenticated;
grant execute on function public.reservas_ical_links_ver(uuid) to authenticated;
grant execute on function public.reserva_aviso_guardar(uuid, text, text, text, text, int, text, timestamptz, timestamptz, text) to authenticated;
grant execute on function public.reservas_avisos_lista(uuid) to authenticated;
grant execute on function public.reserva_aviso_asignar(uuid, text, text) to authenticated;
grant execute on function public.reservas_ical_puede(uuid) to authenticated;

-- ---------- El repaso de cada 5 minutos también lee los calendarios ----------
create or replace function public.vento_repaso()
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare c jsonb; u text; s text; ids bigint[] := '{}'; i bigint;
begin
  select valor into c from servidor_config where clave = 'repaso';
  u := rtrim(coalesce(c->>'url', ''), '/'); s := coalesce(c->>'secreto', '');
  if u !~ '^https?://' or length(s) < 16 then return jsonb_build_object('ok', false, 'motivo', 'sin_config'); end if;
  if to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is null then return jsonb_build_object('ok', false, 'motivo', 'sin_pg_net'); end if;
  foreach u in array array[u || '/functions/v1/vento-pagos/sync', u || '/functions/v1/vento-suscripciones/vencer', u || '/functions/v1/vento-ical/sincronizar'] loop
    execute 'select net.http_post($1, $2, $3, $4, $5)' into i
      using u, '{}'::jsonb, '{}'::jsonb, jsonb_build_object('content-type', 'application/json', 'x-vento-cron', s), 55000;
    ids := ids || i;
  end loop;
  return jsonb_build_object('ok', true, 'pedidos', to_jsonb(ids));
end $$;
revoke all on function public.vento_repaso() from public, anon, authenticated;
grant execute on function public.vento_repaso() to service_role;
