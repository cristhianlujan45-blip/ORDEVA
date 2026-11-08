-- =====================================================================
--  ORDEVA PLAY · Fase 1: el motor y los 5 juegos de lanzamiento (ORDEVA 1.97.0).
--  Plan: puente/egm/PLAY-FASE0.md (auditoría aprobada por el dueño: «continúa como creas mejor; los premios son opcionales»).
--
--  • El cliente del QR juega SIN registrarse: play_entrar comprueba el canal del negocio (canal_privado) y el código secreto
--    de SU mesa (datos del negocio → qrCodigos) y le da un token temporal (12 h; se guarda cifrado con sha256).
--  • El SERVIDOR manda: guarda las respuestas correctas, mide el tiempo (fase_hasta), valida cada jugada (una por ronda,
--    sin duplicados por reintento), calcula los puntos y decide quién gana. El celular solo muestra y manda jugadas.
--  • Tiempo real: después de cada cambio el servidor avisa por el canal «ply<sala>» (solo el número de versión, nada del
--    juego); el celular pide su vista con play_estado (cada jugador ve solo lo suyo: p. ej. la palabra secreta).
--  • Juegos: show (EL SHOW DE LA MESA), bomba (LA BOMBA), impostor (EL IMPOSTOR), ruleta (RULETA DEL CAOS) y
--    sobreviviente (ÚLTIMO SOBREVIVIENTE). Modo «mesa» (solo la misma mesa) o «local» (todas las mesas del negocio).
--  • Retos: divertidos y seguros; nunca beber alcohol, nada peligroso, nada privado. Siempre se puede pasar.
--  • Cada negocio decide si lo activa (apagado por defecto) y qué juegos y retos ofrece.
--  • Sin acceso directo a las tablas (RLS sin políticas para anon/authenticated): todo pasa por funciones que validan.
--  No borra nada de lo existente. Se puede volver a correr.
-- =====================================================================

create table if not exists public.play_config (
  negocio_id      uuid primary key references public.negocios(id) on delete cascade,
  activo          boolean not null default false,
  juegos          text[] not null default array['show','bomba','impostor','ruleta','sobreviviente'],
  retos           text[] not null default array['divertido','musica','talento','preguntas'],
  actualizado_en  timestamptz not null default now(),
  actualizado_por uuid
);
create table if not exists public.play_jugadores (
  id          uuid primary key default gen_random_uuid(),
  negocio_id  uuid not null references public.negocios(id) on delete cascade,
  mesa        int not null check (mesa between 1 and 500),
  alias       text not null check (char_length(alias) between 1 and 20),
  avatar      text not null default '🙂' check (char_length(avatar) <= 8),
  token_h     text not null unique,
  origen_h    text,
  creado      timestamptz not null default now(),
  visto       timestamptz not null default now()
);
create index if not exists play_jugadores_neg_idx on public.play_jugadores(negocio_id, creado);
create index if not exists play_jugadores_origen_idx on public.play_jugadores(origen_h, creado) where origen_h is not null;
create table if not exists public.play_salas (
  id          uuid primary key default gen_random_uuid(),
  negocio_id  uuid not null references public.negocios(id) on delete cascade,
  codigo      text not null,
  juego       text not null check (juego in ('show','bomba','impostor','ruleta','sobreviviente')),
  modo        text not null default 'mesa' check (modo in ('mesa','local')),
  mesa        int,
  anfitrion   uuid references public.play_jugadores(id) on delete set null,
  estado      text not null default 'espera' check (estado in ('espera','jugando','fin')),
  ronda       int not null default 0,
  fase        text not null default 'espera',
  fase_hasta  timestamptz,
  secreto     jsonb not null default '{}'::jsonb,
  publico     jsonb not null default '{}'::jsonb,
  version     int not null default 1,
  creado      timestamptz not null default now(),
  actualizado timestamptz not null default now()
);
create unique index if not exists play_salas_codigo_idx on public.play_salas(negocio_id, codigo) where estado <> 'fin';
create index if not exists play_salas_neg_idx on public.play_salas(negocio_id, estado, actualizado);
create table if not exists public.play_miembros (
  sala_id    uuid not null references public.play_salas(id) on delete cascade,
  jugador_id uuid not null references public.play_jugadores(id) on delete cascade,
  puntos     int not null default 0,
  vivo       boolean not null default true,
  orden      int not null default 0,
  unido      timestamptz not null default now(),
  primary key (sala_id, jugador_id)
);
create table if not exists public.play_eventos (
  id         bigserial primary key,
  sala_id    uuid not null references public.play_salas(id) on delete cascade,
  jugador_id uuid not null references public.play_jugadores(id) on delete cascade,
  ronda      int not null,
  tipo       text not null,
  dato       jsonb not null default '{}'::jsonb,
  cid        text not null,
  creado     timestamptz not null default now(),
  unique (sala_id, jugador_id, cid)
);
create index if not exists play_eventos_ronda_idx on public.play_eventos(sala_id, ronda, tipo);
-- Puntos que quedan (para la clasificación del día y de la semana). Uno por jugador y partida: no se suman dos veces.
create table if not exists public.play_puntos (
  id         bigserial primary key,
  negocio_id uuid not null references public.negocios(id) on delete cascade,
  sala_id    uuid not null,
  jugador_id uuid not null,
  alias      text not null,
  avatar     text not null default '🙂',
  mesa       int not null,
  juego      text not null,
  puntos     int not null,
  gano       boolean not null default false,
  creado     timestamptz not null default now(),
  unique (sala_id, jugador_id)
);
create index if not exists play_puntos_neg_idx on public.play_puntos(negocio_id, creado);
-- Contenido (de ORDEVA, igual para todos los negocios).
create table if not exists public.play_preguntas (id serial primary key, categoria text not null, q text not null unique, opciones text[] not null, correcta int not null check (correcta between 0 and 3));
create table if not exists public.play_palabras (id serial primary key, categoria text not null, palabra text not null, unique (categoria, palabra));
create table if not exists public.play_retos (id serial primary key, categoria text not null, texto text not null unique);

do $$ declare t text; begin
  foreach t in array array['play_config','play_jugadores','play_salas','play_miembros','play_eventos','play_puntos','play_preguntas','play_palabras','play_retos'] loop
    execute 'alter table public.' || t || ' enable row level security';
    execute 'revoke all on public.' || t || ' from anon, authenticated';
  end loop;
end $$;

-- ---------- Ayudantes ----------
create or replace function public.play_ms(t timestamptz) returns bigint language sql immutable as $$ select (extract(epoch from t) * 1000)::bigint $$;
create or replace function public.play_canal(p_sala uuid) returns text language sql immutable as $$ select 'ply' || replace(p_sala::text, '-', '') $$;

-- El jugador del token (vence a las 12 h).
create or replace function public.play_yo(p_token text) returns public.play_jugadores
language plpgsql security definer set search_path = public, extensions as $$
declare j public.play_jugadores;
begin
  if p_token is null or char_length(p_token) < 20 then raise exception 'play_sesion'; end if;
  select * into j from play_jugadores where token_h = encode(digest(p_token, 'sha256'), 'hex');
  if not found or j.creado < now() - interval '12 hours' then raise exception 'play_sesion'; end if;
  if j.visto < now() - interval '10 seconds' then update play_jugadores set visto = now() where id = j.id; end if;
  return j;
end $$;

-- Aviso «cambió la sala» (solo la versión: el estado se pide con play_estado).
create or replace function public.play_ping(p_sala uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare m canal_mensajes%rowtype; v int;
begin
  select version into v from play_salas where id = p_sala;
  insert into canal_mensajes(canal, cuerpo, firmado) values (play_canal(p_sala), jsonb_build_object('v', v)::text, true) returning * into m;
  begin perform realtime.send(jsonb_build_object('id', m.id), 'm', 'vc-' || play_canal(p_sala), false); exception when others then null; end;
end $$;

-- Una pregunta de cálculo (LA BOMBA, ÚLTIMO SOBREVIVIENTE): más difícil en cada nivel. 4 opciones, una correcta.
create or replace function public.play_mate(p_nivel int) returns jsonb
language plpgsql volatile set search_path = public, extensions as $$
declare a int; b int; op int := floor(random() * 3); r int; q text; ops int[] := '{}'; d int; i int; correcta int;
begin
  if op = 0 then a := 2 + floor(random() * (8 + p_nivel * 6)); b := 2 + floor(random() * (8 + p_nivel * 6)); r := a + b; q := a || ' + ' || b;
  elsif op = 1 then a := 10 + floor(random() * (10 + p_nivel * 8)); b := 1 + floor(random() * a); r := a - b; q := a || ' − ' || b;
  else a := 2 + floor(random() * least(12, 4 + p_nivel)); b := 2 + floor(random() * least(12, 4 + p_nivel)); r := a * b; q := a || ' × ' || b; end if;
  ops := array[r];
  while array_length(ops, 1) < 4 loop
    d := r + (case when random() < 0.5 then -1 else 1 end) * (1 + floor(random() * greatest(3, r / 5 + 2)));
    if d >= 0 and not (d = any(ops)) then ops := ops || d; end if;
  end loop;
  select array_agg(x order by random()) into ops from unnest(ops) x;
  for i in 1..4 loop if ops[i] = r then correcta := i - 1; end if; end loop;
  return jsonb_build_object('q', '¿' || q || '?', 'opciones', to_jsonb(array(select x::text from unnest(ops) x)), 'correcta', correcta);
end $$;

create or replace function public.play_vivos(p_sala uuid) returns uuid[]
language sql stable set search_path = public, extensions as $$
  select coalesce(array_agg(jugador_id order by orden), '{}') from play_miembros where sala_id = p_sala and vivo
$$;
create or replace function public.play_azar(p_ids uuid[], p_menos uuid default null) returns uuid
language sql volatile set search_path = public, extensions as $$
  select x from unnest(p_ids) x where x is distinct from p_menos order by random() limit 1
$$;
create or replace function public.play_sumar(p_sala uuid, p_jug uuid, p_pts int) returns void
language sql security definer set search_path = public, extensions as $$
  update play_miembros set puntos = greatest(0, puntos + p_pts) where sala_id = p_sala and jugador_id = p_jug
$$;
create or replace function public.play_fase(p_sala uuid, p_fase text, p_seg numeric, p_publico jsonb, p_secreto jsonb default null, p_ronda int default null) returns void
language sql security definer set search_path = public, extensions as $$
  update play_salas set fase = p_fase, fase_hasta = case when p_seg is null then null else now() + make_interval(secs => p_seg) end,
    publico = p_publico, secreto = coalesce(p_secreto, secreto), ronda = coalesce(p_ronda, ronda), version = version + 1, actualizado = now()
   where id = p_sala
$$;
create or replace function public.play_reto(p_neg uuid) returns text
language sql volatile set search_path = public, extensions as $$
  select texto from play_retos where categoria = any(coalesce((select retos from play_config where negocio_id = p_neg), array['divertido']))
   order by random() limit 1
$$;

-- ---------- Fin de la partida: puntos que quedan ----------
create or replace function public.play_terminar(p_sala uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare s play_salas; top int; fin jsonb;
begin
  select * into s from play_salas where id = p_sala;
  if s.estado = 'fin' then return; end if;
  -- Sobrevivientes al final (LA BOMBA, ÚLTIMO SOBREVIVIENTE): +200.
  if s.juego in ('bomba', 'sobreviviente') then update play_miembros set puntos = puntos + 200 where sala_id = p_sala and vivo; end if;
  select max(puntos) into top from play_miembros where sala_id = p_sala;
  insert into play_puntos(negocio_id, sala_id, jugador_id, alias, avatar, mesa, juego, puntos, gano)
    select s.negocio_id, p_sala, j.id, j.alias, j.avatar, j.mesa, s.juego, m.puntos, m.puntos = top and top > 0
      from play_miembros m join play_jugadores j on j.id = m.jugador_id where m.sala_id = p_sala
  on conflict (sala_id, jugador_id) do nothing;
  select coalesce(jsonb_agg(jsonb_build_object('j', m.jugador_id, 'alias', j.alias, 'avatar', j.avatar, 'mesa', j.mesa, 'puntos', m.puntos, 'gano', m.puntos = top and top > 0) order by m.puntos desc), '[]'::jsonb)
    into fin from play_miembros m join play_jugadores j on j.id = m.jugador_id where m.sala_id = p_sala;
  update play_salas set estado = 'fin', fase = 'fin', fase_hasta = null, publico = jsonb_build_object('final', fin), version = version + 1, actualizado = now() where id = p_sala;
end $$;

-- ---------- EL SHOW DE LA MESA (preguntas rápidas) ----------
create or replace function public.play_show_ronda(p_sala uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare s play_salas; usadas int[]; pq play_preguntas;
begin
  select * into s from play_salas where id = p_sala;
  if s.ronda >= 8 then perform play_terminar(p_sala); return; end if;
  usadas := coalesce(array(select x::int from jsonb_array_elements_text(coalesce(s.secreto->'usadas', '[]'::jsonb)) x), '{}');
  select * into pq from play_preguntas where not (id = any(usadas)) order by random() limit 1;
  if pq.id is null then perform play_terminar(p_sala); return; end if;
  perform play_fase(p_sala, 'pregunta', 20, jsonb_build_object('q', pq.q, 'opciones', to_jsonb(pq.opciones), 'cat', pq.categoria, 'total', 8),
    jsonb_build_object('usadas', to_jsonb(usadas || pq.id), 'correcta', pq.correcta), s.ronda + 1);
end $$;
create or replace function public.play_show_resultado(p_sala uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare s play_salas; conteo jsonb;
begin
  select * into s from play_salas where id = p_sala;
  select coalesce(jsonb_object_agg(i, n), '{}'::jsonb) into conteo from (select dato->>'i' i, count(*) n from play_eventos where sala_id = p_sala and ronda = s.ronda and tipo = 'responder' group by 1) x;
  perform play_fase(p_sala, 'resultado', 5, s.publico || jsonb_build_object('correcta', s.secreto->'correcta', 'conteo', conteo));
end $$;

-- ---------- LA BOMBA (pasa la bomba respondiendo bien; si te explota, pierdes) ----------
create or replace function public.play_bomba_pregunta(p_sala uuid, p_portador uuid, p_pases int) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare s play_salas; m jsonb;
begin
  select * into s from play_salas where id = p_sala;
  m := play_mate(s.ronda + least(p_pases, 6));
  update play_salas set publico = jsonb_build_object('portador', p_portador, 'q', m->'q', 'opciones', m->'opciones', 'pases', p_pases),
    secreto = secreto || jsonb_build_object('correcta', m->'correcta'), version = version + 1, actualizado = now() where id = p_sala;
end $$;
create or replace function public.play_bomba_ronda(p_sala uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare s play_salas; v uuid[];
begin
  select * into s from play_salas where id = p_sala; v := play_vivos(p_sala);
  if array_length(v, 1) is null or array_length(v, 1) <= 1 or s.ronda >= 5 then perform play_terminar(p_sala); return; end if;
  -- La explosión es secreta: entre 20 y 45 s (el celular no la recibe).
  perform play_fase(p_sala, 'bomba', 20 + floor(random() * 26), '{}'::jsonb, '{}'::jsonb, s.ronda + 1);
  perform play_bomba_pregunta(p_sala, play_azar(v), 0);
end $$;
create or replace function public.play_bomba_explota(p_sala uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare s play_salas; quien uuid;
begin
  select * into s from play_salas where id = p_sala; quien := (s.publico->>'portador')::uuid;
  update play_miembros set vivo = false where sala_id = p_sala and jugador_id = quien;
  update play_miembros set puntos = puntos + 50 where sala_id = p_sala and vivo;
  perform play_fase(p_sala, 'explota', 7, jsonb_build_object('perdio', quien, 'reto', play_reto(s.negocio_id)));
end $$;

-- ---------- EL IMPOSTOR (todos tienen la palabra menos uno: pistas y votación) ----------
create or replace function public.play_impostor_ronda(p_sala uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare s play_salas; p play_palabras; v uuid[];
begin
  select * into s from play_salas where id = p_sala; v := play_vivos(p_sala);
  if s.ronda >= 2 then perform play_terminar(p_sala); return; end if;
  select * into p from play_palabras order by random() limit 1;
  perform play_fase(p_sala, 'pistas', 60, jsonb_build_object('total', 2),
    jsonb_build_object('palabra', p.palabra, 'cat', p.categoria, 'impostor', play_azar(v)), s.ronda + 1);
end $$;
create or replace function public.play_impostor_votar(p_sala uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare s play_salas; pistas jsonb;
begin
  select * into s from play_salas where id = p_sala;
  select coalesce(jsonb_agg(jsonb_build_object('j', jugador_id, 't', dato->>'t') order by id), '[]'::jsonb) into pistas
    from play_eventos where sala_id = p_sala and ronda = s.ronda and tipo = 'pista';
  perform play_fase(p_sala, 'votar', 40, s.publico || jsonb_build_object('pistas', pistas));
end $$;
create or replace function public.play_impostor_resultado(p_sala uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare s play_salas; imp uuid; votos jsonb; top uuid; topn int; empates int; ganan text;
begin
  select * into s from play_salas where id = p_sala; imp := (s.secreto->>'impostor')::uuid;
  select coalesce(jsonb_object_agg(j, n), '{}'::jsonb) into votos from (select dato->>'j' j, count(*) n from play_eventos where sala_id = p_sala and ronda = s.ronda and tipo = 'votar' group by 1) x;
  select (dato->>'j')::uuid, count(*) into top, topn from play_eventos where sala_id = p_sala and ronda = s.ronda and tipo = 'votar' group by 1 order by 2 desc limit 1;
  select count(*) into empates from (select count(*) n from play_eventos where sala_id = p_sala and ronda = s.ronda and tipo = 'votar' group by dato->>'j' having count(*) = topn) x;
  if top = imp and empates = 1 then
    ganan := 'grupo';
    update play_miembros m set puntos = puntos + case when exists (select 1 from play_eventos e where e.sala_id = p_sala and e.ronda = s.ronda and e.tipo = 'votar' and e.jugador_id = m.jugador_id and e.dato->>'j' = imp::text) then 100 else 50 end
     where sala_id = p_sala and jugador_id <> imp;
  else
    ganan := 'impostor'; perform play_sumar(p_sala, imp, 200);
  end if;
  perform play_fase(p_sala, 'resultado', 10, s.publico || jsonb_build_object('impostor', imp, 'palabra', s.secreto->'palabra', 'votos', votos, 'ganan', ganan));
end $$;

-- ---------- RULETA DEL CAOS (la ruleta elige a alguien y un reto; aceptar, cambiar una vez o pasar) ----------
create or replace function public.play_ruleta_girar(p_sala uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare s play_salas;
begin
  select * into s from play_salas where id = p_sala;
  perform play_fase(p_sala, 'reto', 35, jsonb_build_object('elegido', play_azar(play_vivos(p_sala)), 'reto', play_reto(s.negocio_id), 'cambio', true, 'total', 6));
end $$;
create or replace function public.play_ruleta_ronda(p_sala uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare s play_salas;
begin
  select * into s from play_salas where id = p_sala;
  if s.ronda >= 6 then perform play_terminar(p_sala); return; end if;
  perform play_fase(p_sala, 'girar', 8, jsonb_build_object('total', 6), null, s.ronda + 1);
end $$;
create or replace function public.play_ruleta_cerrar(p_sala uuid, p_que text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare s play_salas;
begin
  select * into s from play_salas where id = p_sala;
  if p_que = 'cumplir' then perform play_sumar(p_sala, (s.publico->>'elegido')::uuid, 100); end if;
  perform play_fase(p_sala, 'resultado', 4, s.publico || jsonb_build_object('hizo', p_que));
end $$;

-- ---------- ÚLTIMO SOBREVIVIENTE (cada ronda más rápida; quien falla o no responde, sale) ----------
create or replace function public.play_sobre_ronda(p_sala uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare s play_salas; m jsonb; v uuid[];
begin
  select * into s from play_salas where id = p_sala; v := play_vivos(p_sala);
  if array_length(v, 1) is null or array_length(v, 1) <= 1 or s.ronda >= 12 then perform play_terminar(p_sala); return; end if;
  m := play_mate(s.ronda + 1);
  perform play_fase(p_sala, 'reto', greatest(6, 14 - s.ronda), jsonb_build_object('q', m->'q', 'opciones', m->'opciones', 'vivos', array_length(v, 1)),
    jsonb_build_object('correcta', m->'correcta'), s.ronda + 1);
end $$;
create or replace function public.play_sobre_resolver(p_sala uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare s play_salas; v uuid[]; buenos uuid[]; fuera uuid[];
begin
  select * into s from play_salas where id = p_sala; v := play_vivos(p_sala);
  buenos := coalesce(array(select jugador_id from play_eventos where sala_id = p_sala and ronda = s.ronda and tipo = 'responder' and (dato->>'ok')::boolean and jugador_id = any(v)), '{}');
  fuera := coalesce(array(select x from unnest(v) x where not (x = any(buenos))), '{}');
  -- Si todos fallan, nadie sale en esta ronda.
  if array_length(buenos, 1) is null then fuera := '{}'; end if;
  update play_miembros set vivo = false where sala_id = p_sala and jugador_id = any(fuera);
  update play_miembros set puntos = puntos + 30 where sala_id = p_sala and vivo;
  perform play_fase(p_sala, 'resultado', 4, s.publico || jsonb_build_object('correcta', s.secreto->'correcta', 'fuera', to_jsonb(fuera)));
end $$;

-- ---------- El reloj: lo que pasa cuando se acaba el tiempo de una fase ----------
create or replace function public.play_vencio(p_sala uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare s play_salas;
begin
  select * into s from play_salas where id = p_sala;
  if s.estado <> 'jugando' then return; end if;
  case s.juego
    when 'show' then if s.fase = 'pregunta' then perform play_show_resultado(p_sala); else perform play_show_ronda(p_sala); end if;
    when 'bomba' then if s.fase = 'bomba' then perform play_bomba_explota(p_sala); else perform play_bomba_ronda(p_sala); end if;
    when 'impostor' then
      if s.fase = 'pistas' then perform play_impostor_votar(p_sala);
      elsif s.fase = 'votar' then perform play_impostor_resultado(p_sala);
      else perform play_impostor_ronda(p_sala); end if;
    when 'ruleta' then
      if s.fase = 'girar' then perform play_ruleta_girar(p_sala);
      elsif s.fase = 'reto' then perform play_ruleta_cerrar(p_sala, 'tiempo');
      else perform play_ruleta_ronda(p_sala); end if;
    when 'sobreviviente' then if s.fase = 'reto' then perform play_sobre_resolver(p_sala); else perform play_sobre_ronda(p_sala); end if;
  end case;
end $$;
create or replace function public.play_tick(p_sala uuid) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare h timestamptz; e text;
begin
  select fase_hasta, estado into h, e from play_salas where id = p_sala;
  if e <> 'jugando' or h is null or h > now() then return false; end if;
  select fase_hasta, estado into h, e from play_salas where id = p_sala for update;
  if e <> 'jugando' or h is null or h > now() then return false; end if;
  perform play_vencio(p_sala);
  perform play_ping(p_sala);
  return true;
end $$;

-- ---------- Lo que ve cada jugador ----------
create or replace function public.play_vista(p_sala uuid, p_jug uuid) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare s play_salas; jug jsonb; mio jsonb := '{}'::jsonb; hasta bigint;
begin
  select * into s from play_salas where id = p_sala;
  select coalesce(jsonb_agg(jsonb_build_object('id', j.id, 'alias', j.alias, 'avatar', j.avatar, 'mesa', j.mesa, 'puntos', m.puntos, 'vivo', m.vivo,
      'yo', j.id = p_jug, 'enLinea', j.visto > now() - interval '25 seconds') order by m.orden), '[]'::jsonb)
    into jug from play_miembros m join play_jugadores j on j.id = m.jugador_id where m.sala_id = p_sala;
  -- La palabra secreta solo para quien la tiene; el impostor solo sabe la categoría.
  if s.juego = 'impostor' and s.estado = 'jugando' and s.fase in ('pistas', 'votar') then
    mio := case when (s.secreto->>'impostor')::uuid = p_jug then jsonb_build_object('rol', 'impostor', 'cat', s.secreto->'cat')
                else jsonb_build_object('rol', 'civil', 'palabra', s.secreto->'palabra', 'cat', s.secreto->'cat') end;
  end if;
  mio := mio || jsonb_build_object('hecho', exists (select 1 from play_eventos e where e.sala_id = p_sala and e.jugador_id = p_jug and e.ronda = s.ronda and e.tipo in ('responder', 'pista', 'votar', 'aplaudir')),
    'acerte', exists (select 1 from play_eventos e where e.sala_id = p_sala and e.jugador_id = p_jug and e.ronda = s.ronda and e.tipo = 'responder' and (e.dato->>'ok')::boolean));
  -- LA BOMBA: la hora de la explosión no se manda (es la gracia del juego).
  hasta := case when s.juego = 'bomba' and s.fase = 'bomba' then null else play_ms(s.fase_hasta) end;
  return jsonb_build_object('sala', jsonb_build_object('id', s.id, 'codigo', s.codigo, 'juego', s.juego, 'modo', s.modo, 'mesa', s.mesa, 'estado', s.estado,
      'fase', s.fase, 'ronda', s.ronda, 'version', s.version, 'hasta', hasta, 'ahora', play_ms(now()), 'anfitrion', s.anfitrion = p_jug, 'canal', play_canal(s.id)),
    'publico', s.publico, 'jugadores', jug, 'mio', mio);
end $$;

-- ---------- Para el cliente del QR (sin cuenta, con su token) ----------
-- Entrar: el canal del negocio + la mesa + el código secreto de esa mesa (el del QR impreso).
create or replace function public.play_entrar(p_canal text, p_mesa int, p_vm text, p_alias text, p_avatar text default null, p_token text default null) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare neg uuid; cfg play_config; cods jsonb; tok text; j play_jugadores; o text := public.canal_origen(); al text; av text;
begin
  select negocio_id into neg from canal_privado where canal = p_canal;
  if neg is null then raise exception 'play_no_disponible'; end if;
  select * into cfg from play_config where negocio_id = neg;
  if not found or not cfg.activo then raise exception 'play_no_disponible'; end if;
  if p_mesa is null or p_mesa < 1 or p_mesa > 500 then raise exception 'play_mesa'; end if;
  select datos->'qrCodigos'->(p_mesa::text) into cods from datos_negocio where negocio_id = neg;
  if p_vm is null or cods is null or not (case when jsonb_typeof(cods) = 'array' then cods ? p_vm else cods #>> '{}' = p_vm end) then raise exception 'play_mesa'; end if;
  al := left(regexp_replace(trim(coalesce(p_alias, '')), '\s+', ' ', 'g'), 20); if al = '' then al := 'Jugador'; end if;
  av := left(coalesce(nullif(trim(p_avatar), ''), '🙂'), 8);
  -- Volver con el mismo token (recargó la página): se conserva el jugador.
  if p_token is not null and char_length(p_token) >= 20 then
    select * into j from play_jugadores where token_h = encode(digest(p_token, 'sha256'), 'hex') and negocio_id = neg and creado > now() - interval '12 hours';
    if found then
      update play_jugadores set alias = al, avatar = av, mesa = p_mesa, visto = now() where id = j.id;
      return jsonb_build_object('token', p_token, 'jugador', j.id, 'juegos', to_jsonb(cfg.juegos));
    end if;
  end if;
  if o is not null and (select count(*) from play_jugadores where origen_h = o and creado > now() - interval '1 minute') >= 30 then raise exception 'demasiados'; end if;
  tok := encode(gen_random_bytes(24), 'hex');
  insert into play_jugadores(negocio_id, mesa, alias, avatar, token_h, origen_h) values (neg, p_mesa, al, av, encode(digest(tok, 'sha256'), 'hex'), o) returning * into j;
  -- Limpieza de vez en cuando: salas olvidadas y jugadores viejos (los puntos quedan en play_puntos).
  if random() < 0.05 then
    update play_salas set estado = 'fin', fase = 'fin', fase_hasta = null where estado <> 'fin' and actualizado < now() - interval '3 hours';
    delete from play_salas where estado = 'fin' and actualizado < now() - interval '2 days';
    delete from play_jugadores where creado < now() - interval '2 days';
  end if;
  return jsonb_build_object('token', tok, 'jugador', j.id, 'juegos', to_jsonb(cfg.juegos));
end $$;

create or replace function public.play_salas_abiertas(p_token text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare j play_jugadores := play_yo(p_token);
begin
  return coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'codigo', s.codigo, 'juego', s.juego, 'modo', s.modo, 'mesa', s.mesa, 'estado', s.estado,
      'jugadores', (select count(*) from play_miembros m where m.sala_id = s.id)) order by s.creado desc)
    from play_salas s where s.negocio_id = j.negocio_id and s.estado = 'espera' and s.actualizado > now() - interval '30 minutes'
      and (s.modo = 'local' or s.mesa = j.mesa)), '[]'::jsonb);
end $$;

create or replace function public.play_crear(p_token text, p_juego text, p_modo text default 'mesa') returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare j play_jugadores := play_yo(p_token); cfg play_config; s play_salas; c text; n int := 0;
begin
  select * into cfg from play_config where negocio_id = j.negocio_id;
  if not found or not cfg.activo then raise exception 'play_no_disponible'; end if;
  if not (p_juego = any(cfg.juegos)) then raise exception 'play_juego'; end if;
  if (select count(*) from play_salas where anfitrion = j.id and creado > now() - interval '10 minutes') >= 10 then raise exception 'demasiados'; end if;
  loop
    c := upper(substr(translate(encode(gen_random_bytes(6), 'base64'), '+/=0O1IL', ''), 1, 4)); n := n + 1;
    exit when length(c) = 4 and not exists (select 1 from play_salas where negocio_id = j.negocio_id and codigo = c and estado <> 'fin');
    if n > 30 then raise exception 'play_codigo'; end if;
  end loop;
  insert into play_salas(negocio_id, codigo, juego, modo, mesa, anfitrion) values (j.negocio_id, c, p_juego, case when p_modo = 'local' then 'local' else 'mesa' end, j.mesa, j.id) returning * into s;
  insert into play_miembros(sala_id, jugador_id, orden) values (s.id, j.id, 1);
  return play_vista(s.id, j.id);
end $$;

create or replace function public.play_unirse(p_token text, p_codigo text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare j play_jugadores := play_yo(p_token); s play_salas;
begin
  select * into s from play_salas where negocio_id = j.negocio_id and codigo = upper(trim(coalesce(p_codigo, ''))) and estado <> 'fin' for update;
  if not found then raise exception 'play_sala'; end if;
  if s.modo = 'mesa' and s.mesa is distinct from j.mesa then raise exception 'play_otra_mesa'; end if;
  if exists (select 1 from play_miembros where sala_id = s.id and jugador_id = j.id) then return play_vista(s.id, j.id); end if;
  if s.estado <> 'espera' then raise exception 'play_empezo'; end if;
  if (select count(*) from play_miembros where sala_id = s.id) >= 12 then raise exception 'play_llena'; end if;
  insert into play_miembros(sala_id, jugador_id, orden) values (s.id, j.id, (select coalesce(max(orden), 0) + 1 from play_miembros where sala_id = s.id));
  update play_salas set version = version + 1, actualizado = now() where id = s.id;
  perform play_ping(s.id);
  return play_vista(s.id, j.id);
end $$;

create or replace function public.play_empezar(p_token text, p_sala uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare j play_jugadores := play_yo(p_token); s play_salas; n int;
begin
  select * into s from play_salas where id = p_sala and negocio_id = j.negocio_id for update;
  if not found then raise exception 'play_sala'; end if;
  if s.anfitrion is distinct from j.id then raise exception 'play_anfitrion'; end if;
  if s.estado <> 'espera' then return play_vista(s.id, j.id); end if;
  select count(*) into n from play_miembros where sala_id = s.id;
  if n < case when s.juego = 'impostor' then 3 else 2 end then raise exception 'play_pocos'; end if;
  update play_salas set estado = 'jugando', ronda = 0, version = version + 1, actualizado = now() where id = s.id;
  case s.juego
    when 'show' then perform play_show_ronda(s.id);
    when 'bomba' then perform play_bomba_ronda(s.id);
    when 'impostor' then perform play_impostor_ronda(s.id);
    when 'ruleta' then perform play_ruleta_ronda(s.id);
    when 'sobreviviente' then perform play_sobre_ronda(s.id);
  end case;
  perform play_ping(s.id);
  return play_vista(s.id, j.id);
end $$;

-- Una jugada. p_cid: id único que pone el celular (un reintento no cuenta dos veces).
create or replace function public.play_accion(p_token text, p_sala uuid, p_tipo text, p_dato jsonb, p_cid text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare j play_jugadores := play_yo(p_token); s play_salas; m play_miembros; ok boolean := false; i int; t text; obj uuid; n int; nv int; ins int;
begin
  if p_cid is null or char_length(p_cid) not between 4 and 60 then raise exception 'play_jugada'; end if;
  perform play_tick(p_sala);
  select * into s from play_salas where id = p_sala and negocio_id = j.negocio_id for update;
  if not found then raise exception 'play_sala'; end if;
  select * into m from play_miembros where sala_id = s.id and jugador_id = j.id;
  if not found then raise exception 'play_sala'; end if;
  if (select count(*) from play_eventos where jugador_id = j.id and creado > now() - interval '10 seconds') >= 25 then raise exception 'demasiados'; end if;
  if s.estado <> 'jugando' then return play_vista(s.id, j.id); end if;
  -- Fuera de tiempo: no cuenta.
  if s.fase_hasta is not null and s.fase_hasta <= now() then return play_vista(s.id, j.id); end if;
  nv := coalesce(array_length(play_vivos(s.id), 1), 0);

  if s.juego = 'show' and s.fase = 'pregunta' and p_tipo = 'responder' then
    i := (p_dato->>'i')::int; if i is null or i not between 0 and 3 then raise exception 'play_jugada'; end if;
    ok := i = (s.secreto->>'correcta')::int;
    insert into play_eventos(sala_id, jugador_id, ronda, tipo, dato, cid) values (s.id, j.id, s.ronda, 'responder', jsonb_build_object('i', i, 'ok', ok), 'r' || s.ronda) on conflict do nothing;
    get diagnostics ins = row_count;
    if ins = 1 and ok then perform play_sumar(s.id, j.id, 100 + 5 * greatest(0, floor(extract(epoch from s.fase_hasta - now())))::int); end if;
    select count(*) into n from play_eventos where sala_id = s.id and ronda = s.ronda and tipo = 'responder';
    if n >= nv then perform play_show_resultado(s.id); end if;

  elsif s.juego = 'bomba' and s.fase = 'bomba' and p_tipo = 'responder' then
    if (s.publico->>'portador')::uuid is distinct from j.id then return play_vista(s.id, j.id); end if;
    i := (p_dato->>'i')::int; if i is null or i not between 0 and 3 then raise exception 'play_jugada'; end if;
    insert into play_eventos(sala_id, jugador_id, ronda, tipo, dato, cid) values (s.id, j.id, s.ronda, 'bomba', jsonb_build_object('i', i), p_cid) on conflict do nothing;
    get diagnostics ins = row_count;
    if ins = 1 then
      if i = (s.secreto->>'correcta')::int then
        perform play_sumar(s.id, j.id, 20);
        perform play_bomba_pregunta(s.id, play_azar(play_vivos(s.id), j.id), coalesce((s.publico->>'pases')::int, 0) + 1);
      else
        perform play_bomba_pregunta(s.id, j.id, coalesce((s.publico->>'pases')::int, 0));
      end if;
    end if;

  elsif s.juego = 'impostor' and s.fase = 'pistas' and p_tipo = 'pista' then
    t := left(regexp_replace(trim(coalesce(p_dato->>'t', '')), '\s+', ' ', 'g'), 24);
    if t = '' then raise exception 'play_jugada'; end if;
    if position(lower(s.secreto->>'palabra') in lower(t)) > 0 then raise exception 'play_pista_palabra'; end if;
    insert into play_eventos(sala_id, jugador_id, ronda, tipo, dato, cid) values (s.id, j.id, s.ronda, 'pista', jsonb_build_object('t', t), 'p' || s.ronda) on conflict do nothing;
    select count(*) into n from play_eventos where sala_id = s.id and ronda = s.ronda and tipo = 'pista';
    if n >= nv then perform play_impostor_votar(s.id); end if;

  elsif s.juego = 'impostor' and s.fase = 'votar' and p_tipo = 'votar' then
    obj := (p_dato->>'j')::uuid;
    if obj is null or obj = j.id or not exists (select 1 from play_miembros where sala_id = s.id and jugador_id = obj) then raise exception 'play_jugada'; end if;
    insert into play_eventos(sala_id, jugador_id, ronda, tipo, dato, cid) values (s.id, j.id, s.ronda, 'votar', jsonb_build_object('j', obj), 'v' || s.ronda) on conflict do nothing;
    select count(*) into n from play_eventos where sala_id = s.id and ronda = s.ronda and tipo = 'votar';
    if n >= nv then perform play_impostor_resultado(s.id); end if;

  elsif s.juego = 'ruleta' and s.fase = 'girar' and p_tipo = 'girar' then
    perform play_ruleta_girar(s.id);
  elsif s.juego = 'ruleta' and s.fase = 'reto' and p_tipo in ('cumplir', 'pasar', 'cambiar') then
    if (s.publico->>'elegido')::uuid is distinct from j.id then return play_vista(s.id, j.id); end if;
    insert into play_eventos(sala_id, jugador_id, ronda, tipo, dato, cid) values (s.id, j.id, s.ronda, p_tipo, '{}'::jsonb, p_cid) on conflict do nothing;
    get diagnostics ins = row_count;
    if ins = 1 then
      if p_tipo = 'cambiar' then
        if coalesce((s.publico->>'cambio')::boolean, false) then perform play_fase(s.id, 'reto', 35, s.publico || jsonb_build_object('reto', play_reto(s.negocio_id), 'cambio', false)); end if;
      else perform play_ruleta_cerrar(s.id, p_tipo); end if;
    end if;
  elsif s.juego = 'ruleta' and s.fase = 'reto' and p_tipo = 'aplaudir' then
    if (s.publico->>'elegido')::uuid is not distinct from j.id then return play_vista(s.id, j.id); end if;
    insert into play_eventos(sala_id, jugador_id, ronda, tipo, dato, cid) values (s.id, j.id, s.ronda, 'aplaudir', '{}'::jsonb, 'a' || s.ronda) on conflict do nothing;
    get diagnostics ins = row_count;
    if ins = 1 then perform play_sumar(s.id, (s.publico->>'elegido')::uuid, 10); update play_salas set version = version + 1 where id = s.id; end if;

  elsif s.juego = 'sobreviviente' and s.fase = 'reto' and p_tipo = 'responder' then
    if not m.vivo then return play_vista(s.id, j.id); end if;
    i := (p_dato->>'i')::int; if i is null or i not between 0 and 3 then raise exception 'play_jugada'; end if;
    insert into play_eventos(sala_id, jugador_id, ronda, tipo, dato, cid) values (s.id, j.id, s.ronda, 'responder', jsonb_build_object('i', i, 'ok', i = (s.secreto->>'correcta')::int), 'r' || s.ronda) on conflict do nothing;
    select count(*) into n from play_eventos where sala_id = s.id and ronda = s.ronda and tipo = 'responder';
    if n >= nv then perform play_sobre_resolver(s.id); end if;
  else
    return play_vista(s.id, j.id);   -- una jugada que no toca en esta fase: no hace nada
  end if;
  perform play_ping(s.id);
  return play_vista(s.id, j.id);
end $$;

create or replace function public.play_estado(p_token text, p_sala uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare j play_jugadores := play_yo(p_token);
begin
  if not exists (select 1 from play_miembros m join play_salas s on s.id = m.sala_id where m.sala_id = p_sala and m.jugador_id = j.id and s.negocio_id = j.negocio_id) then raise exception 'play_sala'; end if;
  perform play_tick(p_sala);
  return play_vista(p_sala, j.id);
end $$;

create or replace function public.play_salir(p_token text, p_sala uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare j play_jugadores := play_yo(p_token); s play_salas; otro uuid;
begin
  select * into s from play_salas where id = p_sala and negocio_id = j.negocio_id for update;
  if not found then return jsonb_build_object('ok', true); end if;
  if s.estado = 'espera' then
    delete from play_miembros where sala_id = s.id and jugador_id = j.id;
    if s.anfitrion = j.id then
      select jugador_id into otro from play_miembros where sala_id = s.id order by orden limit 1;
      if otro is null then update play_salas set estado = 'fin', fase = 'fin' where id = s.id; else update play_salas set anfitrion = otro where id = s.id; end if;
    end if;
  else
    update play_miembros set vivo = false where sala_id = s.id and jugador_id = j.id;
  end if;
  update play_salas set version = version + 1, actualizado = now() where id = s.id;
  perform play_ping(s.id);
  return jsonb_build_object('ok', true);
end $$;

-- Clasificación del día: jugadores y mesas del negocio.
create or replace function public.play_ranking(p_token text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare j play_jugadores := play_yo(p_token);
begin
  return public.play_ranking_de(j.negocio_id);
end $$;
create or replace function public.play_ranking_de(p_neg uuid) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  with hoy as (select * from play_puntos where negocio_id = p_neg and creado >= (date_trunc('day', now() at time zone 'America/Bogota') at time zone 'America/Bogota'))
  select jsonb_build_object(
    'jugadores', coalesce((select jsonb_agg(jsonb_build_object('alias', alias, 'avatar', avatar, 'mesa', mesa, 'puntos', pts, 'ganadas', g) order by pts desc)
        from (select max(alias) alias, max(avatar) avatar, max(mesa) mesa, sum(puntos)::int pts, count(*) filter (where gano)::int g
                from hoy group by jugador_id order by sum(puntos) desc limit 10) y), '[]'::jsonb),
    'mesas', coalesce((select jsonb_agg(jsonb_build_object('mesa', mesa, 'puntos', pts) order by pts desc)
        from (select mesa, sum(puntos)::int pts from hoy group by mesa order by 2 desc limit 10) z), '[]'::jsonb))
$$;

-- ---------- Para el negocio (con su sesión) ----------
create or replace function public.play_config_ver(p_negocio uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare c play_config;
begin
  if not public.es_miembro(p_negocio) then raise exception 'sin_permiso'; end if;
  select * into c from play_config where negocio_id = p_negocio;
  return jsonb_build_object('activo', coalesce(c.activo, false), 'juegos', to_jsonb(coalesce(c.juegos, array['show','bomba','impostor','ruleta','sobreviviente'])),
    'retos', to_jsonb(coalesce(c.retos, array['divertido','musica','talento','preguntas'])), 'ranking', public.play_ranking_de(p_negocio),
    'hoy', (select jsonb_build_object('partidas', count(distinct sala_id), 'jugadores', count(distinct jugador_id), 'mesas', count(distinct mesa))
      from play_puntos where negocio_id = p_negocio and creado >= (date_trunc('day', now() at time zone 'America/Bogota') at time zone 'America/Bogota')));
end $$;
create or replace function public.play_config_guardar(p_negocio uuid, p_activo boolean, p_juegos text[], p_retos text[]) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare r text := public.rol_en(p_negocio); jg text[]; rt text[];
begin
  if r is null or r not in ('dueno', 'admin') then raise exception 'sin_permiso'; end if;
  jg := array(select distinct x from unnest(coalesce(p_juegos, '{}')) x where x in ('show','bomba','impostor','ruleta','sobreviviente'));
  rt := array(select distinct x from unnest(coalesce(p_retos, '{}')) x where x in ('divertido','musica','talento','preguntas'));
  if array_length(rt, 1) is null then rt := array['divertido']; end if;
  insert into play_config(negocio_id, activo, juegos, retos, actualizado_en, actualizado_por) values (p_negocio, coalesce(p_activo, false), jg, rt, now(), auth.uid())
  on conflict (negocio_id) do update set activo = excluded.activo, juegos = excluded.juegos, retos = excluded.retos, actualizado_en = now(), actualizado_por = auth.uid();
  return public.play_config_ver(p_negocio);
end $$;

-- ---------- Permisos ----------
do $$ declare f text; begin
  foreach f in array array['play_ms(timestamptz)','play_canal(uuid)','play_yo(text)','play_ping(uuid)','play_mate(int)','play_vivos(uuid)','play_azar(uuid[], uuid)',
    'play_sumar(uuid, uuid, int)','play_fase(uuid, text, numeric, jsonb, jsonb, int)','play_reto(uuid)','play_terminar(uuid)','play_show_ronda(uuid)','play_show_resultado(uuid)',
    'play_bomba_pregunta(uuid, uuid, int)','play_bomba_ronda(uuid)','play_bomba_explota(uuid)','play_impostor_ronda(uuid)','play_impostor_votar(uuid)','play_impostor_resultado(uuid)',
    'play_ruleta_girar(uuid)','play_ruleta_ronda(uuid)','play_ruleta_cerrar(uuid, text)','play_sobre_ronda(uuid)','play_sobre_resolver(uuid)','play_vencio(uuid)','play_tick(uuid)',
    'play_vista(uuid, uuid)','play_ranking_de(uuid)'] loop
    execute 'revoke all on function public.' || f || ' from public, anon, authenticated';
    execute 'grant execute on function public.' || f || ' to service_role';
  end loop;
  foreach f in array array['play_entrar(text, int, text, text, text, text)','play_salas_abiertas(text)','play_crear(text, text, text)','play_unirse(text, text)',
    'play_empezar(text, uuid)','play_accion(text, uuid, text, jsonb, text)','play_estado(text, uuid)','play_salir(text, uuid)','play_ranking(text)'] loop
    execute 'revoke all on function public.' || f || ' from public';
    execute 'grant execute on function public.' || f || ' to anon, authenticated, service_role';
  end loop;
  foreach f in array array['play_config_ver(uuid)','play_config_guardar(uuid, boolean, text[], text[])'] loop
    execute 'revoke all on function public.' || f || ' from public, anon';
    execute 'grant execute on function public.' || f || ' to authenticated, service_role';
  end loop;
end $$;

-- ---------- Contenido inicial (de ORDEVA; se puede ampliar sin cambiar el código) ----------
insert into public.play_preguntas(categoria, q, opciones, correcta) values
('Colombia','¿Cuál es la capital de Colombia?','{Medellín,Bogotá,Cali,Cartagena}',1),
('Colombia','¿En qué ciudad se celebra la Feria de las Flores?','{Medellín,Cali,Barranquilla,Manizales}',0),
('Colombia','¿Qué ciudad es famosa por su Carnaval declarado patrimonio de la humanidad?','{Pasto,Barranquilla,Santa Marta,Cúcuta}',1),
('Colombia','¿Cuál es la moneda de Colombia?','{El sol,El peso,El bolívar,El dólar}',1),
('Colombia','¿Qué escritor colombiano ganó el Premio Nobel de Literatura?','{Jorge Isaacs,Gabriel García Márquez,Álvaro Mutis,Fernando Vallejo}',1),
('Colombia','¿Cómo se llama la novela más famosa de García Márquez?','{La vorágine,María,Cien años de soledad,El túnel}',2),
('Colombia','¿Qué río es el más importante de Colombia?','{El Cauca,El Magdalena,El Atrato,El Meta}',1),
('Colombia','¿En qué departamento queda Cartagena?','{Bolívar,Atlántico,Sucre,Córdoba}',0),
('Colombia','¿Cuál es la flor nacional de Colombia?','{La rosa,El girasol,La orquídea,El clavel}',2),
('Colombia','¿Qué ave es símbolo nacional de Colombia?','{El cóndor de los Andes,El colibrí,La guacamaya,El tucán}',0),
('Colombia','¿Qué ciudad es conocida como «la Sucursal del Cielo»?','{Bogotá,Popayán,Cali,Pereira}',2),
('Colombia','¿Qué ritmo musical nació en la costa Caribe colombiana con el acordeón?','{El tango,El vallenato,La bachata,El merengue}',1),
('Colombia','¿Qué cantante colombiana canta «Hips Don''t Lie»?','{Karol G,Shakira,Fanny Lú,Totó la Momposina}',1),
('Colombia','¿En qué eje está la zona cafetera?','{Caldas, Risaralda y Quindío,Nariño y Cauca,Meta y Casanare,Sucre y Córdoba}',0),
('Colombia','¿Cómo se llama el sombrero típico de la costa colombiana?','{Sombrero vueltiao,Panamá,Sombrero aguadeño,Chupalla}',0),
('Colombia','¿Qué plato es típico de Antioquia?','{Ajiaco,Bandeja paisa,Sancocho de pescado,Mote de queso}',1),
('Colombia','¿Qué sopa típica de Bogotá lleva tres tipos de papa?','{Mondongo,Ajiaco,Cuchuco,Sancocho}',1),
('Colombia','¿En qué océanos tiene costa Colombia?','{Solo el Pacífico,Solo el Atlántico,Pacífico y Atlántico (Caribe),Índico y Pacífico}',2),
('Geografía','¿Cuál es el río más largo del mundo según la mayoría de fuentes?','{El Nilo,El Amazonas,El Misisipi,El Yangtsé}',1),
('Geografía','¿Cuál es el país más grande del mundo?','{Canadá,China,Rusia,Estados Unidos}',2),
('Geografía','¿Cuál es la capital de Perú?','{Quito,Lima,La Paz,Santiago}',1),
('Geografía','¿En qué continente queda Egipto?','{Asia,África,Europa,Oceanía}',1),
('Geografía','¿Cuál es el océano más grande?','{Atlántico,Índico,Pacífico,Ártico}',2),
('Geografía','¿Cuál es la montaña más alta del mundo?','{Aconcagua,K2,Everest,Kilimanjaro}',2),
('Geografía','¿Cuál es la capital de México?','{Guadalajara,Ciudad de México,Monterrey,Cancún}',1),
('Ciencia','¿Cuántos planetas tiene el sistema solar?','{7,8,9,10}',1),
('Ciencia','¿Qué gas respiran las plantas para hacer la fotosíntesis?','{Oxígeno,Dióxido de carbono,Nitrógeno,Helio}',1),
('Ciencia','¿Cuál es el planeta más cercano al Sol?','{Venus,Mercurio,Marte,Tierra}',1),
('Ciencia','¿Cuántos huesos tiene el cuerpo humano adulto?','{106,206,306,186}',1),
('Ciencia','¿Qué órgano bombea la sangre?','{El hígado,El pulmón,El corazón,El riñón}',2),
('Ciencia','¿A qué temperatura hierve el agua al nivel del mar?','{90 °C,100 °C,110 °C,120 °C}',1),
('Ciencia','¿Cuál es el animal terrestre más rápido?','{El león,El guepardo,El caballo,La gacela}',1),
('Deportes','¿Cuántos jugadores tiene un equipo de fútbol en la cancha?','{9,10,11,12}',2),
('Deportes','¿Qué país ganó más Mundiales de fútbol?','{Alemania,Argentina,Brasil,Italia}',2),
('Deportes','¿Con qué se juega el tejo?','{Una pelota,Un disco de metal y mechas,Un taco,Una raqueta}',1),
('Deportes','¿Cada cuántos años se juegan los Juegos Olímpicos de verano?','{2,3,4,5}',2),
('Deportes','¿Cómo se llama la vuelta ciclística más famosa de Francia?','{Giro,Tour de Francia,Vuelta,Clásico RCN}',1),
('Música','¿De qué país es el reguetonero Bad Bunny?','{Colombia,Puerto Rico,Panamá,México}',1),
('Música','¿Quién canta «Provenza»?','{Shakira,Karol G,Becky G,Rosalía}',1),
('Música','¿Qué instrumento tiene teclas blancas y negras?','{La guitarra,El piano,El violín,La flauta}',1),
('Música','¿Qué grupo británico cantaba «Hey Jude»?','{The Rolling Stones,Queen,The Beatles,Coldplay}',2),
('Música','¿De dónde es el cantante J Balvin?','{Medellín,Cali,Bogotá,Barranquilla}',0),
('Cine','¿Cómo se llama la película de Disney inspirada en Colombia?','{Coco,Encanto,Moana,Elio}',1),
('Cine','¿Qué superhéroe vive en Gotham?','{Superman,Batman,Spiderman,Iron Man}',1),
('Cine','¿Cómo se llama el muñeco vaquero de Toy Story?','{Buzz,Woody,Rex,Jessie}',1),
('Cultura','¿Cuántos días tiene un año bisiesto?','{364,365,366,367}',2),
('Cultura','¿Cuántos lados tiene un hexágono?','{5,6,7,8}',1),
('Cultura','¿Qué idioma tiene más hablantes nativos en el mundo?','{Inglés,Español,Chino mandarín,Hindi}',2),
('Cultura','¿En qué año llegó Colón a América?','{1492,1500,1810,1519}',0),
('Cultura','¿Cuál es el color que resulta de mezclar azul y amarillo?','{Morado,Verde,Naranja,Café}',1)
on conflict (q) do nothing;

insert into public.play_palabras(categoria, palabra) values
('Comida','Arepa'),('Comida','Empanada'),('Comida','Pizza'),('Comida','Hamburguesa'),('Comida','Sancocho'),('Comida','Helado'),('Comida','Buñuelo'),('Comida','Ceviche'),
('Comida','Patacón'),('Comida','Tamal'),('Comida','Chocolate'),('Comida','Mango'),('Comida','Aguacate'),('Comida','Pandebono'),
('Lugares','Playa'),('Lugares','Hospital'),('Lugares','Aeropuerto'),('Lugares','Cine'),('Lugares','Gimnasio'),('Lugares','Biblioteca'),('Lugares','Estadio'),
('Lugares','Iglesia'),('Lugares','Supermercado'),('Lugares','Zoológico'),('Lugares','Peluquería'),('Lugares','Piscina'),
('Animales','Perro'),('Animales','Gato'),('Animales','Jirafa'),('Animales','Delfín'),('Animales','Elefante'),('Animales','Loro'),('Animales','Tiburón'),
('Animales','Mariposa'),('Animales','Caballo'),('Animales','Pingüino'),('Animales','Hormiga'),('Animales','Oso perezoso'),
('Objetos','Celular'),('Objetos','Paraguas'),('Objetos','Bicicleta'),('Objetos','Guitarra'),('Objetos','Reloj'),('Objetos','Linterna'),('Objetos','Espejo'),
('Objetos','Almohada'),('Objetos','Tijeras'),('Objetos','Maleta'),('Objetos','Control remoto'),('Objetos','Escoba'),
('Profesiones','Médico'),('Profesiones','Bombero'),('Profesiones','Piloto'),('Profesiones','Chef'),('Profesiones','Profesor'),('Profesiones','Futbolista'),
('Profesiones','Mesero'),('Profesiones','Policía'),('Profesiones','Astronauta'),('Profesiones','Peluquero'),
('Deportes','Fútbol'),('Deportes','Tejo'),('Deportes','Ciclismo'),('Deportes','Natación'),('Deportes','Boxeo'),('Deportes','Tenis'),('Deportes','Patinaje')
on conflict (categoria, palabra) do nothing;

-- Retos: divertidos y seguros. Nunca beber, nada peligroso, nada privado, nada que incomode a otros. Siempre se puede pasar.
insert into public.play_retos(categoria, texto) values
('divertido','Imita a un animal durante 10 segundos y que la mesa adivine cuál es.'),
('divertido','Habla como presentador de noticias contando lo que pidió tu mesa.'),
('divertido','Haz tu mejor cara de sorpresa y que la mesa la califique del 1 al 10.'),
('divertido','Di un trabalenguas sin equivocarte: «Tres tristes tigres tragaban trigo en un trigal».'),
('divertido','Cuenta un chiste (blanco) en menos de 30 segundos.'),
('divertido','Haz un brindis de 15 segundos por algo bonito de hoy (con lo que estés tomando, puede ser agua).'),
('divertido','Dile un cumplido sincero a cada persona de tu mesa.'),
('divertido','Imita la risa de alguien famoso hasta que la mesa adivine quién es.'),
('divertido','Inventa un nombre de superhéroe para la persona de tu derecha y su superpoder.'),
('divertido','Durante la próxima ronda, habla solo con rimas.'),
('divertido','Haz una pose de estatua por 15 segundos sin reírte.'),
('divertido','Narra como en un partido de fútbol lo que está pasando en la mesa.'),
('musica','Tararea una canción y que la mesa adivine cuál es.'),
('musica','Canta el coro de una canción que todos conozcan (puede ser bajito).'),
('musica','Haz el ritmo de una canción famosa con las manos en la mesa.'),
('musica','Baila 10 segundos tu canción favorita (o mueve solo los hombros si estás sentado).'),
('musica','Di tres canciones que tengan la palabra «amor» en el título.'),
('musica','Imita a tu cantante favorito diciendo «gracias» a su público.'),
('talento','Dibuja en una servilleta algo que la mesa adivine en 30 segundos.'),
('talento','Di cinco frutas en cinco segundos.'),
('talento','Di el abecedario al revés desde la J.'),
('talento','Equilibra una cuchara en tu nariz durante 5 segundos (o inténtalo).'),
('talento','Di diez palabras que empiecen por la letra M en 20 segundos.'),
('talento','Cuenta del 20 al 1 lo más rápido que puedas.'),
('talento','Explica cómo se hace una arepa sin usar la palabra «masa».'),
('talento','Haz una adivinanza para la mesa (si nadie la adivina, ganas).'),
('preguntas','Cuenta cuál fue el mejor viaje que has hecho.'),
('preguntas','¿Qué superpoder escogerías y para qué lo usarías?'),
('preguntas','Cuenta una anécdota graciosa que te haya pasado (que quieras contar).'),
('preguntas','Si pudieras cenar con alguien famoso, ¿con quién y por qué?'),
('preguntas','¿Cuál es la comida que nunca te cansarías de comer?'),
('preguntas','¿Qué canción te pone de buen humor siempre?'),
('preguntas','¿Qué harías si te ganaras la lotería mañana? (versión corta)'),
('preguntas','¿Cuál es tu película favorita y por qué?'),
('preguntas','¿Qué talento oculto tienes?'),
('preguntas','¿Qué lugar de Colombia le recomendarías a un turista?')
on conflict (texto) do nothing;
