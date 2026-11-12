-- =====================================================================
--  ORDEVA PLAY · Fase 2: torneos entre mesas (ORDEVA 1.98.0).
--  Plan y revisión goldfish: puente/egm/PLAN-PLAY-FASE2.md.
--
--  • El equipo es la MESA. Un torneo es un rato de competencia (15 a 120 minutos) que empieza el dueño o el administrador.
--    Mientras dura, las partidas que TERMINEN dentro del torneo suman a la mesa donde se jugaron.
--  • La regla: «cada partida le da a tu mesa hasta 100 puntos (los de su mejor jugador); cuentan las 5 mejores partidas de
--    la mesa». Los puntos de la partida se pasan a una escala de 0 a 100 según el juego. La Ruleta no suma. Empate: gana
--    la mesa que llegó primero a ese puntaje.
--  • No se vuelve a definir nada de la fase 1: un disparador en play_puntos marca cada partida con su torneo y guarda los
--    puntos sin el tope del día («brutos»). Si algo falla en el disparador, la partida termina igual, sin torneo.
--  • Sin carrera con el cierre: el disparador lee el torneo con candado compartido; el cierre toma el exclusivo y solo
--    después calcula el resultado.
--  • La tabla de mesas se guarda y se recalcula como mucho cada 8 segundos. El cliente manda su versión y, si no cambió,
--    recibe una respuesta corta.
--  • Sin premios: esta fase solo anuncia la mesa ganadora (los premios son la fase 3).
--  • Sin acceso directo a la tabla (RLS sin políticas). No borra nada de lo existente. Se puede volver a correr.
-- =====================================================================

create table if not exists public.play_torneos (
  id          uuid primary key default gen_random_uuid(),
  negocio_id  uuid not null references public.negocios(id) on delete cascade,
  inicio      timestamptz not null default now(),
  fin         timestamptz not null,
  cerrado     timestamptz,                               -- cuándo se cerró (a mano o por tiempo); null = abierto
  tabla       jsonb not null default '[]'::jsonb,        -- la tabla de mesas guardada
  tabla_en    timestamptz,                               -- cuándo se calculó
  resultado   jsonb,                                     -- congelado al cerrar: la tabla y la regla usada
  creado_por  uuid,
  check (fin > inicio)
);
create unique index if not exists play_torneos_abierto_idx on public.play_torneos(negocio_id) where cerrado is null;
create index if not exists play_torneos_neg_idx on public.play_torneos(negocio_id, fin desc);
create index if not exists play_torneos_fin_idx on public.play_torneos(fin) where cerrado is null;
alter table public.play_torneos enable row level security;
revoke all on public.play_torneos from anon, authenticated;

alter table public.play_puntos add column if not exists torneo_id uuid references public.play_torneos(id) on delete set null;
alter table public.play_puntos add column if not exists brutos int;   -- los puntos de la partida sin el tope del día
create index if not exists play_puntos_torneo_idx on public.play_puntos(torneo_id) where torneo_id is not null;

-- La referencia de cada juego para pasar sus puntos a la escala de 0 a 100 (lo que saca un jugador muy bueno).
-- La Ruleta no tiene: no suma al torneo.
create or replace function public.play_torneo_ref(p_juego text) returns int language sql immutable as $$
  select case p_juego when 'show' then 1600 when 'bomba' then 600 when 'impostor' then 600 when 'sobreviviente' then 560 end
$$;

-- Cada partida que termina pasa por aquí (haya torneo o no): guarda los puntos sin el tope del día y, si el negocio tiene
-- un torneo abierto, la marca. NUNCA tumba la partida: si algo falla, la fila se guarda sin torneo.
create or replace function public.play_puntos_torneo() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare t uuid; b int;
begin
  begin
    select m.puntos into b from play_miembros m where m.sala_id = new.sala_id and m.jugador_id = new.jugador_id;
    new.brutos := coalesce(b, new.puntos);
    -- Candado compartido: el cierre (candado exclusivo) espera a que esta partida termine de guardarse.
    select id into t from play_torneos where negocio_id = new.negocio_id and cerrado is null and inicio <= now() and fin > now() for share;
    new.torneo_id := t;
  exception when others then
    new.torneo_id := null; new.brutos := coalesce(new.brutos, new.puntos);
  end;
  return new;
end $$;
drop trigger if exists play_puntos_torneo_tg on public.play_puntos;
create trigger play_puntos_torneo_tg before insert on public.play_puntos for each row execute function public.play_puntos_torneo();

-- La tabla de mesas de un torneo, con la regla. Cada mesa: sus puntos, cuántas partidas jugó, cuántas cuentan y los apodos
-- de quienes sumaron (hasta 4). Orden: más puntos y, si empatan, la que llegó primero.
create or replace function public.play_torneo_tabla(p_torneo uuid) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  with filas as (
    select mesa, sala_id, alias, avatar, creado, id,
           least(100, greatest(0, round(100.0 * coalesce(brutos, puntos) / play_torneo_ref(juego))))::int p
      from play_puntos where torneo_id = p_torneo and play_torneo_ref(juego) is not null),
  por_sala as (   -- de cada partida, el mejor jugador de la mesa
    select distinct on (mesa, sala_id) mesa, sala_id, p, alias, avatar, creado from filas order by mesa, sala_id, p desc, creado, id),
  orden as (select *, row_number() over (partition by mesa order by p desc, creado) rn, count(*) over (partition by mesa) jugadas from por_sala),
  mesas as (
    select mesa, sum(p)::int puntos, max(jugadas)::int partidas, count(*)::int cuentan, max(creado) llego,
           (array_agg(distinct alias))[1:4] nombres
      from orden where rn <= 5 group by mesa)
  select coalesce(jsonb_agg(jsonb_build_object('mesa', mesa, 'puntos', puntos, 'partidas', partidas, 'cuentan', cuentan, 'jugadores', to_jsonb(nombres))
                            order by puntos desc, llego, mesa), '[]'::jsonb)
    from mesas
$$;

-- Recalcula la tabla guardada de un torneo abierto, como mucho cada 8 segundos (o ya, si p_ya).
create or replace function public.play_torneo_refrescar(p_torneo uuid, p_ya boolean default false) returns void
language sql security definer set search_path = public, extensions as $$
  update play_torneos set tabla = play_torneo_tabla(id), tabla_en = clock_timestamp()
   where id = p_torneo and cerrado is null and (p_ya or tabla_en is null or tabla_en < now() - interval '8 seconds')
$$;

-- Cierra un torneo: primero el candado (espera a las partidas que se están guardando) y después, en otra instrucción, el
-- resultado. p_ahora = true lo cierra aunque no haya pasado su hora (el negocio tocó «Terminar ahora»).
create or replace function public.play_torneo_cerrar_uno(p_torneo uuid, p_ahora boolean default false) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare t play_torneos; tab jsonb;
begin
  select * into t from play_torneos where id = p_torneo and cerrado is null and (p_ahora or fin <= now()) for update;
  if not found then return false; end if;
  tab := play_torneo_tabla(t.id);
  update play_torneos set fin = least(fin, now()), cerrado = now(), tabla = tab, tabla_en = clock_timestamp(),
      resultado = jsonb_build_object('mesas', tab, 'regla', jsonb_build_object('tope', 100, 'mejores', 5,
        'ref', jsonb_build_object('show', 1600, 'bomba', 600, 'impostor', 600, 'sobreviviente', 560), 'sin', jsonb_build_array('ruleta')))
   where id = t.id;
  return true;
end $$;

-- El torneo que le toca ver a un negocio: el abierto o el más reciente. Si el abierto ya venció, lo cierra.
create or replace function public.play_torneo_actual(p_neg uuid) returns public.play_torneos
language plpgsql security definer set search_path = public, extensions as $$
declare t play_torneos;
begin
  -- Primero el abierto (como mucho hay uno); si ya venció, se cierra. Si no hay abierto, el más reciente.
  select * into t from play_torneos where negocio_id = p_neg and cerrado is null;
  if found then
    if t.fin > now() then return t; end if;
    perform play_torneo_cerrar_uno(t.id);
  end if;
  select * into t from play_torneos where negocio_id = p_neg order by fin desc limit 1;
  if not found then return null; end if;
  return t;
end $$;

-- Repaso de pg_cron (cada 5 minutos): cierra los que vencieron aunque nadie los mire y borra los de más de 90 días.
create or replace function public.play_torneos_repaso() returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare r record; n int := 0; b int;
begin
  for r in select id from play_torneos where cerrado is null and fin <= now() limit 500 loop
    if play_torneo_cerrar_uno(r.id) then n := n + 1; end if;
  end loop;
  delete from play_torneos where id in (select id from play_torneos where fin < now() - interval '90 days' limit 2000);
  get diagnostics b = row_count;
  return jsonb_build_object('cerrados', n, 'borrados', b);
end $$;

-- Lo que se le manda a quien mira un torneo (cliente o negocio): tiempos en milisegundos y la tabla.
create or replace function public.play_torneo_json(t public.play_torneos, p_cuantas int) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object('id', t.id, 'inicio', play_ms(t.inicio), 'fin', play_ms(t.fin), 'ahora', play_ms(now()), 'abierto', t.cerrado is null,
    'v', play_ms(coalesce(t.cerrado, t.tabla_en, t.inicio)), 'total', jsonb_array_length(t.tabla),
    'mesas', coalesce((select jsonb_agg(x order by n) from jsonb_array_elements(t.tabla) with ordinality as e(x, n) where n <= p_cuantas), '[]'::jsonb))
$$;

-- ---------- Para el cliente del QR (con su token) ----------
-- El torneo abierto, o el que terminó hace menos de 3 horas (contadas desde su hora de fin). p_ver: la versión que ya
-- tiene el celular; si no cambió, la respuesta es corta. «miUltima» dice si la última partida de este jugador sumó.
create or replace function public.play_torneo(p_token text, p_ver bigint default null) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare j play_jugadores := play_yo(p_token); t play_torneos; r jsonb; mia jsonb; puesto int; ult record;
begin
  if not play_cupo(j.id, 25) then return play_err('demasiados'); end if;
  if not exists (select 1 from play_config where negocio_id = j.negocio_id and activo) then return jsonb_build_object('torneo', null); end if;
  t := play_torneo_actual(j.negocio_id);
  if t.id is null or t.fin <= now() - interval '3 hours' then return jsonb_build_object('torneo', null); end if;
  if t.cerrado is null then
    perform play_torneo_refrescar(t.id);
    select * into t from play_torneos where id = t.id;
  end if;
  if p_ver is not null and p_ver = play_ms(coalesce(t.cerrado, t.tabla_en, t.inicio)) then return jsonb_build_object('igual', true, 'ahora', play_ms(now())); end if;
  r := play_torneo_json(t, 10);
  select x, n::int into mia, puesto from jsonb_array_elements(t.tabla) with ordinality as e(x, n) where (x->>'mesa')::int = j.mesa limit 1;
  select p.torneo_id, p.juego into ult from play_puntos p where p.jugador_id = j.id order by p.creado desc limit 1;
  return jsonb_build_object('torneo', r || jsonb_build_object('miMesa', j.mesa, 'miPuesto', puesto, 'mia', mia,
    'miUltima', case when ult.juego is null then null else jsonb_build_object('sumo', ult.torneo_id is not distinct from t.id and play_torneo_ref(ult.juego) is not null, 'juego', ult.juego) end));
end $$;

-- ---------- Para el negocio (con su sesión) ----------
create or replace function public.play_torneo_ver(p_negocio uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare t play_torneos; act boolean; loc boolean;
begin
  if not public.es_miembro(p_negocio) then raise exception 'sin_permiso'; end if;
  select activo, local into act, loc from play_config where negocio_id = p_negocio;
  t := play_torneo_actual(p_negocio);
  -- El que terminó en las últimas 12 horas se sigue viendo (un torneo que cruza la medianoche no se pierde).
  if t.id is null or t.fin <= now() - interval '12 hours' then return jsonb_build_object('torneo', null, 'activo', coalesce(act, false), 'local', coalesce(loc, false)); end if;
  if t.cerrado is null then
    perform play_torneo_refrescar(t.id);
    select * into t from play_torneos where id = t.id;
  end if;
  return jsonb_build_object('torneo', play_torneo_json(t, 20), 'activo', coalesce(act, false), 'local', coalesce(loc, false));
end $$;

create or replace function public.play_torneo_crear(p_negocio uuid, p_minutos int) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare r text := public.rol_en(p_negocio); mins int := least(120, greatest(15, coalesce(p_minutos, 60)));
begin
  if r is null or r not in ('dueno', 'admin') then raise exception 'sin_permiso'; end if;
  if not exists (select 1 from play_config where negocio_id = p_negocio and activo) then raise exception 'play_no_disponible'; end if;
  perform play_torneo_actual(p_negocio);   -- si el anterior ya venció, se cierra aquí
  begin
    insert into play_torneos(negocio_id, fin, creado_por) values (p_negocio, now() + make_interval(mins => mins), auth.uid());
  exception when unique_violation then raise exception 'play_torneo_abierto';
  end;
  return public.play_torneo_ver(p_negocio);
end $$;

create or replace function public.play_torneo_cerrar(p_negocio uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare r text := public.rol_en(p_negocio); t uuid;
begin
  if r is null or r not in ('dueno', 'admin') then raise exception 'sin_permiso'; end if;
  select id into t from play_torneos where negocio_id = p_negocio and cerrado is null;
  if t is not null then perform play_torneo_cerrar_uno(t, true); end if;
  return public.play_torneo_ver(p_negocio);
end $$;

-- ---------- Permisos ----------
do $$ declare f text; begin
  foreach f in array array['play_torneo_ref(text)','play_puntos_torneo()','play_torneo_tabla(uuid)','play_torneo_refrescar(uuid, boolean)',
    'play_torneo_cerrar_uno(uuid, boolean)','play_torneo_actual(uuid)','play_torneos_repaso()','play_torneo_json(public.play_torneos, int)'] loop
    execute 'revoke all on function public.' || f || ' from public, anon, authenticated';
    execute 'grant execute on function public.' || f || ' to service_role';
  end loop;
  execute 'revoke all on function public.play_torneo(text, bigint) from public';
  execute 'grant execute on function public.play_torneo(text, bigint) to anon, authenticated, service_role';
  foreach f in array array['play_torneo_ver(uuid)','play_torneo_crear(uuid, int)','play_torneo_cerrar(uuid)'] loop
    execute 'revoke all on function public.' || f || ' from public, anon';
    execute 'grant execute on function public.' || f || ' to authenticated, service_role';
  end loop;
end $$;

do $$
begin
  if to_regprocedure('cron.schedule(text,text,text)') is null then
    raise notice 'ORDEVA PLAY: este Supabase no tiene pg_cron: los torneos se cierran cuando alguien los mira';
    return;
  end if;
  begin
    perform cron.schedule('ordeva-play-torneos', '*/5 * * * *', 'select public.play_torneos_repaso()');
  exception when others then raise notice 'ORDEVA PLAY: no se pudo programar el repaso de los torneos (%)', sqlerrm;
  end;
end $$;
