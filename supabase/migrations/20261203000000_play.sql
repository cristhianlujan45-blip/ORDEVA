-- =====================================================================
--  ORDEVA PLAY · Fase 1: el motor y los 5 juegos de lanzamiento (ORDEVA 1.97.0).
--  Plan: puente/egm/PLAY-FASE0.md (auditoría aprobada por el dueño: «continúa como creas mejor; los premios son opcionales»).
--  Revisión goldfish: puente/egm/REVISION-GOLDFISH-PLAY.md.
--
--  • El cliente del QR juega SIN registrarse: play_entrar comprueba el canal del negocio (canal_privado) y el código secreto
--    de SU mesa (datos del negocio → qrCodigos) y le da un token temporal (12 h). En la base de datos solo queda la huella
--    sha256 del token, no el token.
--  • El SERVIDOR manda: guarda las respuestas correctas, mide el tiempo (fase_hasta), valida cada jugada (una por ronda,
--    sin duplicados por reintento), calcula los puntos y decide quién gana. El celular solo muestra y manda jugadas.
--  • Sin tiempo real propio: PLAY NO escribe en canal_mensajes ni manda mensajes de Realtime (no gasta el cupo de los
--    pedidos, las canciones ni el QR de pago). El celular pregunta con play_estado(…, su versión): si nada cambió, la
--    respuesta es corta. Cada jugador ve solo lo suyo (p. ej. la palabra secreta).
--  • Juegos: show (EL SHOW DE LA MESA), bomba (LA BOMBA), impostor (EL IMPOSTOR), ruleta (RULETA DEL CAOS) y
--    sobreviviente (ÚLTIMO SOBREVIVIENTE). Modo «mesa» (solo la misma mesa) o «local» (todas las mesas; el negocio lo
--    prende aparte y viene apagado).
--  • Retos: divertidos y seguros; nunca beber (ni brindar), nada peligroso, nada privado. Siempre se puede pasar. Los retos
--    que hablan de «tu mesa» o «tu derecha» no salen en el modo «todo el local».
--  • Cada negocio decide si lo activa (apagado por defecto) y qué juegos y retos ofrece. Apagarlo (o quitar un juego)
--    termina las partidas abiertas.
--  • Límites: llamadas por jugador y entradas por IP (cuentan también las que fallan: las funciones del cliente no lanzan
--    error después de contar, devuelven {error}), jugadores nuevos por IP, por mesa y por negocio, salas abiertas por mesa
--    y por negocio, y puntos por jugador por día. La limpieza corre con pg_cron, no dentro de una petición de un cliente.
--  • Sin acceso directo a las tablas (RLS sin políticas para anon/authenticated): todo pasa por funciones que validan.
--  No borra nada de lo existente. Se puede volver a correr (esta misma versión; ningún servidor corrió los borradores).
-- =====================================================================

create table if not exists public.play_config (
  negocio_id      uuid primary key references public.negocios(id) on delete cascade,
  activo          boolean not null default false,
  juegos          text[] not null default array['show','bomba','impostor','ruleta','sobreviviente'],
  retos           text[] not null default array['divertido','musica','talento','preguntas'],
  local           boolean not null default false,   -- «contra otras mesas»: apagado hasta que el negocio lo prenda
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
  cupo_n      int not null default 0,                 -- llamadas en la ventana de 10 s (play_cupo)
  cupo_desde  timestamptz not null default now(),
  creado      timestamptz not null default now(),
  visto       timestamptz not null default now()
);
create index if not exists play_jugadores_neg_idx on public.play_jugadores(negocio_id, creado);
create index if not exists play_jugadores_origen_idx on public.play_jugadores(origen_h, creado) where origen_h is not null;
create index if not exists play_jugadores_creado_idx on public.play_jugadores(creado);
-- Entradas por IP (play_entrar): cuenta TODAS, también las que fallan (código de mesa malo). Ventana de 1 minuto.
create table if not exists public.play_origen (
  origen_h text primary key,
  n        int not null default 0,
  desde    timestamptz not null default now()
);
create index if not exists play_origen_desde_idx on public.play_origen(desde);
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
create index if not exists play_salas_anfitrion_idx on public.play_salas(anfitrion, creado);
create index if not exists play_salas_act_idx on public.play_salas(actualizado);
create table if not exists public.play_miembros (
  sala_id    uuid not null references public.play_salas(id) on delete cascade,
  jugador_id uuid not null references public.play_jugadores(id) on delete cascade,
  puntos     int not null default 0,
  vivo       boolean not null default true,
  orden      int not null default 0,
  unido      timestamptz not null default now(),
  primary key (sala_id, jugador_id)
);
create index if not exists play_miembros_jugador_idx on public.play_miembros(jugador_id);
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
create index if not exists play_eventos_jugador_idx on public.play_eventos(jugador_id, creado);
-- Puntos que quedan (para la clasificación del día). Uno por jugador y partida: no se suman dos veces. Se borran a los 90 días.
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
create index if not exists play_puntos_jugador_idx on public.play_puntos(jugador_id, creado);
create index if not exists play_puntos_creado_idx on public.play_puntos(creado);
-- Contenido (de ORDEVA, igual para todos los negocios).
create table if not exists public.play_preguntas (id serial primary key, categoria text not null, q text not null unique, opciones text[] not null, correcta int not null check (correcta between 0 and 3));
create table if not exists public.play_palabras (id serial primary key, categoria text not null, palabra text not null, unique (categoria, palabra));
create table if not exists public.play_retos (id serial primary key, categoria text not null, texto text not null unique, solo_mesa boolean not null default false);

do $$ declare t text; begin
  foreach t in array array['play_config','play_jugadores','play_origen','play_salas','play_miembros','play_eventos','play_puntos','play_preguntas','play_palabras','play_retos'] loop
    execute 'alter table public.' || t || ' enable row level security';
    execute 'revoke all on public.' || t || ' from anon, authenticated';
  end loop;
  foreach t in array array['play_eventos_id_seq','play_puntos_id_seq','play_preguntas_id_seq','play_palabras_id_seq','play_retos_id_seq'] loop
    execute 'revoke all on sequence public.' || t || ' from anon, authenticated';
  end loop;
end $$;

-- ---------- Ayudantes ----------
create or replace function public.play_ms(t timestamptz) returns bigint language sql immutable as $$ select (extract(epoch from t) * 1000)::bigint $$;
-- El comienzo de «hoy» (hora de Colombia, donde están los negocios de ORDEVA).
create or replace function public.play_hoy() returns timestamptz language sql stable as $$ select date_trunc('day', now() at time zone 'America/Bogota') at time zone 'America/Bogota' $$;
-- Texto sin tildes y en minúscula (para comparar «Delfín» con «delfin»).
create or replace function public.play_norm(t text) returns text language sql immutable as $$
  select lower(translate(coalesce(t, ''), 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun'))
$$;
-- Filtro básico de groserías para apodos y pistas (palabras completas; el negocio puede pedir más).
create or replace function public.play_grosero(t text) returns boolean language sql immutable as $$
  select play_norm(t) ~ '(^|[^a-z])(hijueputa|hijoeputa|hijodeputa|hp|hpta|puta|puto|putas|putos|mierda|marica|maricon|malparid[a-z]*|gonorrea|verga|culo|pendej[a-z]*|imbecil|estupid[a-z]*|perra|zorra|idiota|cabron|carechimba|sapohp)([^a-z]|$)'
$$;
-- ¿La pista dice la palabra? (sin tildes, sin espacios ni signos: «a-r-e-p-a» también cuenta; y cada palabra larga de una
-- palabra compuesta, como «perezoso» en «Oso perezoso»).
create or replace function public.play_dice_palabra(t text, w text) returns boolean language sql immutable as $$
  with x as (select regexp_replace(play_norm(t), '[^a-z0-9]', '', 'g') t)
  select position(regexp_replace(play_norm(w), '[^a-z0-9]', '', 'g') in x.t) > 0
      or exists (select 1 from regexp_split_to_table(play_norm(w), '\s+') p where char_length(p) >= 4 and position(regexp_replace(p, '[^a-z0-9]', '', 'g') in x.t) > 0)
    from x
$$;
-- El número de una opción (0 a 3) o null.
create or replace function public.play_i(p jsonb) returns int language sql immutable as $$
  select case when jsonb_typeof(p) = 'object' and p->>'i' ~ '^[0-3]$' then (p->>'i')::int end
$$;

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

-- Límite de llamadas por jugador: p_max en 10 s. Cuenta TODAS las llamadas (también las que no hacen nada o no valen):
-- después de contar, las funciones del cliente NO lanzan error (devuelven {error: …}), porque un error deshace el contador.
-- Devuelve false si se pasó (quien llama devuelve {error: 'demasiados'}).
create or replace function public.play_cupo(p_jug uuid, p_max int) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare n int;
begin
  update play_jugadores set
      cupo_n = case when cupo_desde < now() - interval '10 seconds' then 1 else least(cupo_n + 1, 100000) end,
      cupo_desde = case when cupo_desde < now() - interval '10 seconds' then now() else cupo_desde end
   where id = p_jug returning cupo_n into n;
  return coalesce(n, 0) <= p_max;
end $$;
-- Lo mismo por IP, para play_entrar (120 entradas por minuto: un local entero sale por la misma IP del wifi).
create or replace function public.play_cupo_origen(p_origen text, p_max int) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare c int;
begin
  if p_origen is null then return true; end if;
  -- De vez en cuando se borran los contadores viejos (por si este Supabase no tiene pg_cron).
  if random() < 0.01 then delete from play_origen where desde < now() - interval '1 hour'; end if;
  insert into play_origen as o (origen_h, n, desde) values (p_origen, 1, now())
  on conflict (origen_h) do update set
      n = case when o.desde < now() - interval '1 minute' then 1 else least(o.n + 1, 100000) end,
      desde = case when o.desde < now() - interval '1 minute' then now() else o.desde end
  returning o.n into c;
  return coalesce(c, 0) <= p_max;
end $$;
create or replace function public.play_err(p_motivo text) returns jsonb language sql immutable as $$ select jsonb_build_object('error', p_motivo) $$;

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
-- Un reto de las categorías del negocio. En «todo el local» no salen los que hablan de «tu mesa» o «tu derecha».
create or replace function public.play_reto(p_neg uuid, p_modo text default 'mesa') returns text
language sql volatile set search_path = public, extensions as $$
  select coalesce(
    (select texto from play_retos where categoria = any(coalesce((select retos from play_config where negocio_id = p_neg), array['divertido']))
        and (p_modo = 'mesa' or not solo_mesa) order by random() limit 1),
    (select texto from play_retos where not solo_mesa order by random() limit 1))
$$;

-- EL SHOW: suma los puntos anotados en las respuestas buenas de una ronda. Se llama UNA vez por ronda: al cerrar la
-- pregunta o, si la partida se acaba con la pregunta abierta, al terminar (siempre con la sala bloqueada y en «pregunta»).
create or replace function public.play_show_abonar(p_sala uuid, p_ronda int) returns void
language sql security definer set search_path = public, extensions as $$
  update play_miembros m set puntos = m.puntos + coalesce((e.dato->>'pts')::int, 0)
    from play_eventos e where e.sala_id = p_sala and e.ronda = p_ronda and e.tipo = 'responder' and (e.dato->>'ok')::boolean
     and m.sala_id = p_sala and m.jugador_id = e.jugador_id
$$;

-- ---------- Fin de la partida: puntos que quedan ----------
-- Tope de 3.000 puntos por jugador por día en la clasificación (lo que pase del tope no cuenta para el día).
-- p_bono = false cuando la partida se acaba porque los demás se fueron o el negocio apagó PLAY: sin el +200 del final.
create or replace function public.play_terminar(p_sala uuid, p_bono boolean default true) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare s play_salas; top int; fin jsonb;
begin
  select * into s from play_salas where id = p_sala;
  if s.estado = 'fin' then return; end if;
  -- EL SHOW que se acaba con una pregunta abierta (apagaron PLAY, se fueron todos): las respuestas buenas ya dadas cuentan.
  if s.juego = 'show' and s.estado = 'jugando' and s.fase = 'pregunta' then perform play_show_abonar(p_sala, s.ronda); end if;
  -- Sobrevivientes al final (LA BOMBA, ÚLTIMO SOBREVIVIENTE): +200.
  if p_bono and s.juego in ('bomba', 'sobreviviente') then update play_miembros set puntos = puntos + 200 where sala_id = p_sala and vivo; end if;
  select max(puntos) into top from play_miembros where sala_id = p_sala;
  insert into play_puntos(negocio_id, sala_id, jugador_id, alias, avatar, mesa, juego, puntos, gano)
    select s.negocio_id, p_sala, j.id, j.alias, j.avatar, j.mesa, s.juego,
           least(m.puntos, greatest(0, 3000 - coalesce((select sum(pp.puntos) from play_puntos pp where pp.jugador_id = j.id and pp.creado >= play_hoy()), 0)))::int,
           m.puntos = top and top > 0
      from play_miembros m join play_jugadores j on j.id = m.jugador_id where m.sala_id = p_sala
  on conflict (sala_id, jugador_id) do nothing;
  select coalesce(jsonb_agg(jsonb_build_object('j', m.jugador_id, 'alias', j.alias, 'avatar', j.avatar, 'mesa', j.mesa, 'puntos', m.puntos, 'gano', m.puntos = top and top > 0) order by m.puntos desc, m.orden), '[]'::jsonb)
    into fin from play_miembros m join play_jugadores j on j.id = m.jugador_id where m.sala_id = p_sala;
  update play_salas set estado = 'fin', fase = 'fin', fase_hasta = null, publico = jsonb_build_object('final', fin), version = version + 1, actualizado = now() where id = p_sala;
end $$;

-- ---------- EL SHOW DE LA MESA (preguntas rápidas) ----------
-- Las opciones salen en otro orden cada vez, y no se repite una pregunta que el local ya usó en las últimas 6 horas
-- (mientras queden preguntas nuevas).
create or replace function public.play_show_ronda(p_sala uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare s play_salas; usadas int[]; recientes int[]; pq play_preguntas; orden int[]; ops text[];
begin
  select * into s from play_salas where id = p_sala;
  if s.ronda >= 8 then perform play_terminar(p_sala); return; end if;
  usadas := coalesce(array(select x::int from jsonb_array_elements_text(coalesce(s.secreto->'usadas', '[]'::jsonb)) x), '{}');
  recientes := coalesce(array(select distinct x::int from play_salas o, jsonb_array_elements_text(coalesce(o.secreto->'usadas', '[]'::jsonb)) x
                                where o.negocio_id = s.negocio_id and o.juego = 'show' and o.id <> s.id and o.creado > now() - interval '6 hours'), '{}');
  select * into pq from play_preguntas where not (id = any(usadas || recientes)) order by random() limit 1;
  if pq.id is null then select * into pq from play_preguntas where not (id = any(usadas)) order by random() limit 1; end if;
  if pq.id is null then perform play_terminar(p_sala); return; end if;
  select array_agg(i order by random()) into orden from generate_series(1, 4) i;
  ops := array[pq.opciones[orden[1]], pq.opciones[orden[2]], pq.opciones[orden[3]], pq.opciones[orden[4]]];
  perform play_fase(p_sala, 'pregunta', 20, jsonb_build_object('q', pq.q, 'opciones', to_jsonb(ops), 'cat', pq.categoria, 'total', 8),
    jsonb_build_object('usadas', to_jsonb(usadas || pq.id), 'correcta', array_position(orden, pq.correcta + 1) - 1), s.ronda + 1);
end $$;
create or replace function public.play_show_resultado(p_sala uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare s play_salas; conteo jsonb;
begin
  select * into s from play_salas where id = p_sala;
  -- Los puntos se suman AQUÍ, al cerrar la pregunta: si se sumaran al responder, el marcador delataría la opción correcta.
  perform play_show_abonar(p_sala, s.ronda);
  select coalesce(jsonb_object_agg(i, n), '{}'::jsonb) into conteo from (select dato->>'i' i, count(*) n from play_eventos where sala_id = p_sala and ronda = s.ronda and tipo = 'responder' group by 1) x;
  perform play_fase(p_sala, 'resultado', 5, s.publico || jsonb_build_object('correcta', s.secreto->'correcta', 'conteo', conteo));
end $$;

-- ---------- LA BOMBA (pasa la bomba respondiendo bien; si te explota, pierdes) ----------
-- «n» cuenta las preguntas: una respuesta a una pregunta vieja no vale. Si fallas, sale OTRA pregunta y quedas 3 s
-- bloqueado: ni tocar al azar ni ir descartando opciones sirve.
create or replace function public.play_bomba_pregunta(p_sala uuid, p_portador uuid, p_pases int) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare s play_salas; m jsonb;
begin
  select * into s from play_salas where id = p_sala;
  m := play_mate(s.ronda + least(p_pases, 6));
  update play_salas set publico = jsonb_build_object('portador', p_portador, 'q', m->'q', 'opciones', m->'opciones', 'pases', p_pases, 'n', coalesce((s.publico->>'n')::int, 0) + 1),
    secreto = secreto || jsonb_build_object('correcta', m->'correcta'), version = version + 1, actualizado = now() where id = p_sala;
end $$;
create or replace function public.play_bomba_ronda(p_sala uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare s play_salas; v uuid[];
begin
  select * into s from play_salas where id = p_sala; v := play_vivos(p_sala);
  if array_length(v, 1) is null or array_length(v, 1) <= 1 or s.ronda >= 5 then perform play_terminar(p_sala); return; end if;
  -- La explosión es secreta: entre 20 y 45 s (el celular no la recibe).
  perform play_fase(p_sala, 'bomba', (20 + floor(random() * 26))::numeric, jsonb_build_object('n', coalesce((s.publico->>'n')::int, 0)), '{}'::jsonb, s.ronda + 1);
  perform play_bomba_pregunta(p_sala, play_azar(v), 0);
end $$;
create or replace function public.play_bomba_explota(p_sala uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare s play_salas; quien uuid;
begin
  select * into s from play_salas where id = p_sala; quien := (s.publico->>'portador')::uuid;
  update play_miembros set vivo = false where sala_id = p_sala and jugador_id = quien;
  update play_miembros set puntos = puntos + 50 where sala_id = p_sala and vivo;
  perform play_fase(p_sala, 'explota', 7, jsonb_build_object('perdio', quien, 'reto', play_reto(s.negocio_id, s.modo), 'n', coalesce((s.publico->>'n')::int, 0)));
end $$;

-- ---------- EL IMPOSTOR (todos tienen la palabra menos uno: pistas y votación; 3 rondas) ----------
create or replace function public.play_impostor_pistas(p_sala uuid, p_ronda int) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select coalesce(jsonb_agg(jsonb_build_object('j', jugador_id, 't', dato->>'t') order by id), '[]'::jsonb)
    from play_eventos where sala_id = p_sala and ronda = p_ronda and tipo = 'pista'
$$;
create or replace function public.play_impostor_ronda(p_sala uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare s play_salas; p play_palabras; v uuid[];
begin
  select * into s from play_salas where id = p_sala; v := play_vivos(p_sala);
  if s.ronda >= 3 or coalesce(array_length(v, 1), 0) < 3 then perform play_terminar(p_sala); return; end if;
  select * into p from play_palabras where palabra <> coalesce(s.secreto->>'palabra', '') order by random() limit 1;
  perform play_fase(p_sala, 'pistas', 60, jsonb_build_object('total', 3, 'pistas', '[]'::jsonb),
    jsonb_build_object('palabra', p.palabra, 'cat', p.categoria, 'impostor', play_azar(v)), s.ronda + 1);
end $$;
create or replace function public.play_impostor_votar(p_sala uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare s play_salas;
begin
  select * into s from play_salas where id = p_sala;
  perform play_fase(p_sala, 'votar', 40, s.publico || jsonb_build_object('pistas', play_impostor_pistas(p_sala, s.ronda)));
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
     where sala_id = p_sala and jugador_id <> imp and vivo;
  else
    ganan := 'impostor'; perform play_sumar(p_sala, imp, 200);
  end if;
  perform play_fase(p_sala, 'resultado', 10, s.publico || jsonb_build_object('impostor', imp, 'palabra', s.secreto->'palabra', 'votos', votos, 'ganan', ganan));
end $$;

-- ---------- RULETA DEL CAOS (la ruleta elige a alguien y un reto; aceptar, cambiar una vez o pasar) ----------
-- Los puntos NO los pone quien hace el reto: salen solo de los aplausos de los demás (+25 cada uno, uno por persona), y
-- solo se aplaude después de «¡Lo hice!» (quien pasa no se lleva aplausos).
create or replace function public.play_ruleta_girar(p_sala uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare s play_salas;
begin
  select * into s from play_salas where id = p_sala;
  perform play_fase(p_sala, 'reto', 35, jsonb_build_object('elegido', play_azar(play_vivos(p_sala)), 'reto', play_reto(s.negocio_id, s.modo), 'cambio', true, 'total', 6));
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
  -- Si lo cumplió, los demás tienen 10 s para aplaudir.
  perform play_fase(p_sala, 'resultado', case when p_que = 'cumplir' then 10 else 4 end, s.publico || jsonb_build_object('hizo', p_que));
end $$;

-- ---------- ÚLTIMO SOBREVIVIENTE (cada ronda más rápida; quien falla o no responde, sale) ----------
create or replace function public.play_sobre_ronda(p_sala uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare s play_salas; m jsonb; v uuid[];
begin
  select * into s from play_salas where id = p_sala; v := play_vivos(p_sala);
  if array_length(v, 1) is null or array_length(v, 1) <= 1 or s.ronda >= 12 then perform play_terminar(p_sala); return; end if;
  m := play_mate(s.ronda + 1);
  perform play_fase(p_sala, 'reto', greatest(6, 14 - s.ronda)::numeric, jsonb_build_object('q', m->'q', 'opciones', m->'opciones', 'vivos', array_length(v, 1)),
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

-- ---------- ¿Ya jugaron todos? (solo cuentan los que siguen en la partida) ----------
create or replace function public.play_revisar(p_sala uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare s play_salas; v uuid[]; nv int; n int; t_ev text;
begin
  select * into s from play_salas where id = p_sala;
  if s.estado <> 'jugando' then return; end if;
  v := play_vivos(p_sala); nv := coalesce(array_length(v, 1), 0);
  -- Se fueron los demás: se acaba, sin el +200 del final (no se gana porque el otro se salió).
  if nv = 0 or (s.juego in ('bomba', 'sobreviviente') and nv <= 1) then perform play_terminar(p_sala, false); return; end if;
  t_ev := case when s.juego in ('show') and s.fase = 'pregunta' then 'responder'
               when s.juego = 'sobreviviente' and s.fase = 'reto' then 'responder'
               when s.juego = 'impostor' and s.fase = 'pistas' then 'pista'
               when s.juego = 'impostor' and s.fase = 'votar' then 'votar' end;
  if t_ev is null then return; end if;
  select count(distinct e.jugador_id) into n from play_eventos e where e.sala_id = p_sala and e.ronda = s.ronda and e.tipo = t_ev and e.jugador_id = any(v);
  if n < nv then return; end if;
  if s.juego = 'show' then perform play_show_resultado(p_sala);
  elsif s.juego = 'sobreviviente' then perform play_sobre_resolver(p_sala);
  elsif s.fase = 'pistas' then perform play_impostor_votar(p_sala);
  else perform play_impostor_resultado(p_sala); end if;
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
  return true;
end $$;

-- ---------- Lo que ve cada jugador ----------
create or replace function public.play_vista(p_sala uuid, p_jug uuid) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare s play_salas; jug jsonb; mio jsonb := '{}'::jsonb; hasta bigint; t_ev text;
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
  -- «acerte» solo cuando ya se cerró la pregunta (antes diría si una opción es la correcta).
  -- «hecho»: ya hizo la jugada de ESTA fase (dar la pista no cuenta como votar).
  t_ev := case when s.fase = 'pistas' then 'pista' when s.fase = 'votar' then 'votar' when s.juego = 'ruleta' then 'aplaudir' else 'responder' end;
  mio := mio || jsonb_build_object('hecho', exists (select 1 from play_eventos e where e.sala_id = p_sala and e.jugador_id = p_jug and e.ronda = s.ronda and e.tipo = t_ev),
    'acerte', s.fase not in ('pregunta', 'reto') and exists (select 1 from play_eventos e where e.sala_id = p_sala and e.jugador_id = p_jug and e.ronda = s.ronda and e.tipo = 'responder' and (e.dato->>'ok')::boolean));
  -- LA BOMBA: la hora de la explosión no se manda (es la gracia del juego).
  hasta := case when s.juego = 'bomba' and s.fase = 'bomba' then null else play_ms(s.fase_hasta) end;
  return jsonb_build_object('sala', jsonb_build_object('id', s.id, 'codigo', s.codigo, 'juego', s.juego, 'modo', s.modo, 'mesa', s.mesa, 'estado', s.estado,
      'fase', s.fase, 'ronda', s.ronda, 'version', s.version, 'hasta', hasta, 'ahora', play_ms(now()), 'anfitrion', s.anfitrion = p_jug, 'anfitrionId', s.anfitrion),
    'publico', s.publico, 'jugadores', jug, 'mio', mio);
end $$;
-- Una jugada que no vale: la vista de siempre con el motivo (sin lanzar error, para que el límite de jugadas sí cuente).
create or replace function public.play_no(p_sala uuid, p_jug uuid, p_motivo text) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select play_vista(p_sala, p_jug) || jsonb_build_object('error', p_motivo)
$$;

-- ---------- Para el cliente del QR (sin cuenta, con su token) ----------
-- Entrar: el canal del negocio + la mesa + el código secreto de esa mesa (el del QR impreso).
create or replace function public.play_entrar(p_canal text, p_mesa int, p_vm text, p_alias text, p_avatar text default null, p_token text default null) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare neg uuid; cfg play_config; cods jsonb; tok text; j play_jugadores; o text := public.canal_origen(); al text; av text; conocido boolean := false;
begin
  -- Primero el límite por IP, antes de leer nada del negocio. Desde aquí no se lanza error: se devuelve {error}.
  if not play_cupo_origen(o, 120) then return play_err('demasiados'); end if;
  select negocio_id into neg from canal_privado where canal = p_canal;
  if neg is null then return play_err('play_no_disponible'); end if;
  select * into cfg from play_config where negocio_id = neg;
  if not found or not cfg.activo then return play_err('play_no_disponible'); end if;
  if p_mesa is null or p_mesa < 1 or p_mesa > 500 then return play_err('play_mesa'); end if;
  -- Volver con el mismo token a la MISMA mesa (recargó la página): ya se le revisó el código de esa mesa al entrar.
  if p_token is not null and char_length(p_token) >= 20 then
    select * into j from play_jugadores where token_h = encode(digest(p_token, 'sha256'), 'hex') and negocio_id = neg and creado > now() - interval '12 hours';
    conocido := found;
  end if;
  if not (conocido and j.mesa = p_mesa) then
    select datos->'qrCodigos'->(p_mesa::text) into cods from datos_negocio where negocio_id = neg;
    if p_vm is null or cods is null or not coalesce(case when jsonb_typeof(cods) = 'array' then cods ? p_vm else cods #>> '{}' = p_vm end, false) then return play_err('play_mesa'); end if;
  end if;
  al := left(regexp_replace(trim(coalesce(p_alias, '')), '\s+', ' ', 'g'), 20);
  if al = '' or play_grosero(al) then al := 'Jugador'; end if;
  -- El avatar solo de la lista del juego.
  av := case when p_avatar = any(array['😎','🦁','🐯','🦊','🐼','🐸','🦄','🐙','🤖','👽','🎃','🌟','🙂']) then p_avatar else '🙂' end;
  if conocido then
    update play_jugadores set alias = al, avatar = av, mesa = p_mesa, visto = now() where id = j.id;
    return jsonb_build_object('token', p_token, 'jugador', j.id, 'juegos', to_jsonb(cfg.juegos), 'local', cfg.local);
  end if;
  -- Jugadores nuevos: 60 por minuto por IP, 40 por hora por mesa y 1.500 por hora por negocio. (El tope por mesa hace que
  -- desde una sola mesa no se pueda gastar el tope de todo el negocio.)
  if o is not null and (select count(*) from play_jugadores where origen_h = o and creado > now() - interval '1 minute') >= 60 then return play_err('demasiados'); end if;
  if (select count(*) from play_jugadores where negocio_id = neg and mesa = p_mesa and creado > now() - interval '1 hour') >= 40 then return play_err('demasiados'); end if;
  if (select count(*) from play_jugadores where negocio_id = neg and creado > now() - interval '1 hour') >= 1500 then return play_err('demasiados'); end if;
  tok := encode(gen_random_bytes(24), 'hex');
  insert into play_jugadores(negocio_id, mesa, alias, avatar, token_h, origen_h) values (neg, p_mesa, al, av, encode(digest(tok, 'sha256'), 'hex'), o) returning * into j;
  return jsonb_build_object('token', tok, 'jugador', j.id, 'juegos', to_jsonb(cfg.juegos), 'local', cfg.local);
end $$;

create or replace function public.play_salas_abiertas(p_token text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare j play_jugadores := play_yo(p_token);
begin
  if not play_cupo(j.id, 25) then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'codigo', s.codigo, 'juego', s.juego, 'modo', s.modo, 'mesa', s.mesa, 'estado', s.estado,
      'jugadores', (select count(*) from play_miembros m where m.sala_id = s.id)) order by s.creado desc)
    from play_salas s where s.negocio_id = j.negocio_id and s.estado = 'espera' and s.actualizado > now() - interval '10 minutes'
      and (s.modo = 'local' or s.mesa = j.mesa)), '[]'::jsonb);
end $$;

-- Salas abiertas que cuentan para los topes: solo las que tienen movimiento. Una partida viva cambia de fase al menos
-- cada minuto y una sala de espera con gente mirándola se marca cada 2 minutos (play_estado); una abandonada (nadie la
-- mira, el reloj no corre) deja de contar a los 15 o a los 10 minutos, y play_limpiar la cierra a los 30.
create or replace function public.play_abiertas(p_neg uuid, p_mesa int default null) returns int
language sql stable security definer set search_path = public, extensions as $$
  select count(*)::int from play_salas where negocio_id = p_neg and (p_mesa is null or mesa = p_mesa)
     and ((estado = 'jugando' and actualizado > now() - interval '15 minutes') or (estado = 'espera' and actualizado > now() - interval '10 minutes'))
$$;

create or replace function public.play_crear(p_token text, p_juego text, p_modo text default 'mesa') returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare j play_jugadores := play_yo(p_token); cfg play_config; s play_salas; c text; n int := 0; modo text := case when p_modo = 'local' then 'local' else 'mesa' end;
begin
  if not play_cupo(j.id, 25) then return play_err('demasiados'); end if;
  select * into cfg from play_config where negocio_id = j.negocio_id;
  if not found or not cfg.activo then return play_err('play_no_disponible'); end if;
  if p_juego is null or not (p_juego = any(cfg.juegos)) then return play_err('play_juego'); end if;
  if modo = 'local' and not cfg.local then return play_err('play_local'); end if;
  if (select count(*) from play_salas where anfitrion = j.id and creado > now() - interval '10 minutes') >= 10 then return play_err('demasiados'); end if;
  -- 8 salas abiertas por mesa y 60 por negocio: una mesa sola no puede llenar el local.
  if play_abiertas(j.negocio_id, j.mesa) >= 8 or play_abiertas(j.negocio_id) >= 60 then return play_err('play_lleno'); end if;
  loop
    n := n + 1; if n > 30 then return play_err('play_codigo'); end if;
    c := substr(translate(upper(encode(gen_random_bytes(6), 'base64')), '+/=0O1IL', ''), 1, 4);
    continue when length(c) <> 4;
    begin
      insert into play_salas(negocio_id, codigo, juego, modo, mesa, anfitrion) values (j.negocio_id, c, p_juego, modo, j.mesa, j.id) returning * into s;
      exit;
    exception when unique_violation then null;   -- dos salas con el mismo código al mismo tiempo: otro código
    end;
  end loop;
  insert into play_miembros(sala_id, jugador_id, orden) values (s.id, j.id, 1);
  return play_vista(s.id, j.id);
end $$;

create or replace function public.play_unirse(p_token text, p_codigo text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare j play_jugadores := play_yo(p_token); s play_salas;
begin
  if not play_cupo(j.id, 25) then return play_err('demasiados'); end if;
  select * into s from play_salas where negocio_id = j.negocio_id and codigo = upper(trim(coalesce(p_codigo, ''))) and estado <> 'fin' for update;
  if not found then return play_err('play_sala'); end if;
  if s.modo = 'mesa' and s.mesa is distinct from j.mesa then return play_err('play_otra_mesa'); end if;
  if exists (select 1 from play_miembros where sala_id = s.id and jugador_id = j.id) then
    -- Volvió a una partida que no elimina (show, ruleta, impostor): juega otra vez. En la bomba y el sobreviviente, mira.
    if s.estado = 'jugando' and s.juego in ('show', 'ruleta', 'impostor') then
      update play_miembros set vivo = true where sala_id = s.id and jugador_id = j.id and not vivo;
      if found then update play_salas set version = version + 1, actualizado = now() where id = s.id; end if;
    end if;
    return play_vista(s.id, j.id);
  end if;
  if s.estado <> 'espera' then return play_err('play_empezo'); end if;
  if (select count(*) from play_miembros where sala_id = s.id) >= 12 then return play_err('play_llena'); end if;
  insert into play_miembros(sala_id, jugador_id, orden) values (s.id, j.id, (select coalesce(max(orden), 0) + 1 from play_miembros where sala_id = s.id));
  update play_salas set version = version + 1, actualizado = now() where id = s.id;
  return play_vista(s.id, j.id);
end $$;

create or replace function public.play_empezar(p_token text, p_sala uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare j play_jugadores := play_yo(p_token); s play_salas; cfg play_config; n int; minimo int;
begin
  if not play_cupo(j.id, 25) then return play_err('demasiados'); end if;
  select * into s from play_salas where id = p_sala and negocio_id = j.negocio_id for update;
  if not found then return play_err('play_sala'); end if;
  if s.anfitrion is distinct from j.id then return play_err('play_anfitrion'); end if;
  if s.estado <> 'espera' then return play_vista(s.id, j.id); end if;
  select * into cfg from play_config where negocio_id = s.negocio_id;
  if not found or not cfg.activo or not (s.juego = any(cfg.juegos)) then return play_err('play_no_disponible'); end if;
  select count(*) into n from play_miembros where sala_id = s.id;
  minimo := 2; if s.juego = 'impostor' then minimo := 3; end if;
  if n < minimo then return play_err('play_pocos'); end if;
  -- Una sala de espera vieja (ya no contaba para los topes) no se puede empezar si la mesa o el local ya están en el tope:
  -- así no se juntan salas viejas para saltarse el tope empezándolas todas a la vez.
  if s.actualizado <= now() - interval '10 minutes' and (play_abiertas(s.negocio_id, s.mesa) >= 8 or play_abiertas(s.negocio_id) >= 60) then return play_err('play_lleno'); end if;
  update play_salas set estado = 'jugando', ronda = 0, version = version + 1, actualizado = now() where id = s.id;
  case s.juego
    when 'show' then perform play_show_ronda(s.id);
    when 'bomba' then perform play_bomba_ronda(s.id);
    when 'impostor' then perform play_impostor_ronda(s.id);
    when 'ruleta' then perform play_ruleta_ronda(s.id);
    when 'sobreviviente' then perform play_sobre_ronda(s.id);
  end case;
  return play_vista(s.id, j.id);
end $$;

-- Una jugada. p_cid: id único que pone el celular (un reintento no cuenta dos veces). p_dato.r = la ronda que vio el
-- jugador y, en la bomba, p_dato.n = la pregunta que vio: una jugada hecha en una pantalla vieja no cuenta.
create or replace function public.play_accion(p_token text, p_sala uuid, p_tipo text, p_dato jsonb, p_cid text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare j play_jugadores := play_yo(p_token); s play_salas; m play_miembros; d jsonb := case when jsonb_typeof(p_dato) = 'object' then p_dato else '{}'::jsonb end;
        ok boolean := false; i int; t text; obj uuid; ins int; sig uuid;
begin
  if not play_cupo(j.id, 25) then return play_err('demasiados'); end if;
  if p_cid is null or char_length(p_cid) not between 4 and 60 then return play_err('play_jugada'); end if;
  -- Primero: ¿es de este negocio y de esta sala? Solo después se mueve el reloj y se bloquea la sala.
  if not exists (select 1 from play_miembros pm join play_salas ps on ps.id = pm.sala_id where pm.sala_id = p_sala and pm.jugador_id = j.id and ps.negocio_id = j.negocio_id) then return play_err('play_sala'); end if;
  perform play_tick(p_sala);
  select * into s from play_salas where id = p_sala for update;
  select * into m from play_miembros where sala_id = s.id and jugador_id = j.id;
  -- Quien salió de la partida (o ya perdió) no juega.
  if s.estado <> 'jugando' or not m.vivo then return play_vista(s.id, j.id); end if;
  -- Fuera de tiempo: no cuenta.
  if s.fase_hasta is not null and s.fase_hasta <= now() then return play_vista(s.id, j.id); end if;
  if (d ? 'r' and (d->>'r') is distinct from s.ronda::text) or (s.juego = 'bomba' and d ? 'n' and (d->>'n') is distinct from (s.publico->>'n')) then return play_vista(s.id, j.id); end if;

  if s.juego = 'show' and s.fase = 'pregunta' and p_tipo = 'responder' then
    i := play_i(d); if i is null then return play_no(s.id, j.id, 'play_jugada'); end if;
    ok := i = (s.secreto->>'correcta')::int;
    -- Los puntos (100 + rapidez) quedan anotados en la jugada y se suman al cerrar la pregunta (play_show_resultado).
    insert into play_eventos(sala_id, jugador_id, ronda, tipo, dato, cid)
      values (s.id, j.id, s.ronda, 'responder', jsonb_build_object('i', i, 'ok', ok, 'pts', 100 + 5 * greatest(0, floor(extract(epoch from s.fase_hasta - now())))::int), 'r' || s.ronda) on conflict do nothing;
    perform play_revisar(s.id);

  elsif s.juego = 'bomba' and s.fase = 'bomba' and p_tipo = 'responder' then
    if (s.publico->>'portador')::uuid is distinct from j.id then return play_vista(s.id, j.id); end if;
    if coalesce((s.publico->>'bloqueo')::bigint, 0) > play_ms(now()) then return play_vista(s.id, j.id); end if;
    i := play_i(d); if i is null then return play_no(s.id, j.id, 'play_jugada'); end if;
    insert into play_eventos(sala_id, jugador_id, ronda, tipo, dato, cid) values (s.id, j.id, s.ronda, 'bomba', jsonb_build_object('i', i), p_cid) on conflict do nothing;
    get diagnostics ins = row_count;
    if ins = 1 then
      if i = (s.secreto->>'correcta')::int then
        sig := play_azar(play_vivos(s.id), j.id);
        if sig is null then perform play_terminar(s.id);
        else perform play_sumar(s.id, j.id, 20); perform play_bomba_pregunta(s.id, sig, coalesce((s.publico->>'pases')::int, 0) + 1); end if;
      else
        -- Falló: otra pregunta y 3 s sin poder responder (adivinar al azar o descartar opciones no sirve).
        perform play_bomba_pregunta(s.id, j.id, coalesce((s.publico->>'pases')::int, 0));
        update play_salas set publico = publico || jsonb_build_object('bloqueo', play_ms(now() + interval '3 seconds')) where id = s.id;
      end if;
    end if;

  elsif s.juego = 'impostor' and s.fase = 'pistas' and p_tipo = 'pista' then
    t := left(regexp_replace(trim(coalesce(d->>'t', '')), '\s+', ' ', 'g'), 24);
    if t = '' then return play_no(s.id, j.id, 'play_jugada'); end if;
    if play_grosero(t) then return play_no(s.id, j.id, 'play_grosero'); end if;
    -- Solo a quien SABE la palabra se le revisa que no la diga: al impostor, no (si no, probando pistas la descubriría).
    if j.id is distinct from (s.secreto->>'impostor')::uuid and play_dice_palabra(t, s.secreto->>'palabra') then return play_no(s.id, j.id, 'play_pista_palabra'); end if;
    insert into play_eventos(sala_id, jugador_id, ronda, tipo, dato, cid) values (s.id, j.id, s.ronda, 'pista', jsonb_build_object('t', t), 'p' || s.ronda) on conflict do nothing;
    get diagnostics ins = row_count;
    -- Las pistas se ven a medida que llegan.
    if ins = 1 then update play_salas set publico = publico || jsonb_build_object('pistas', play_impostor_pistas(s.id, s.ronda)), version = version + 1, actualizado = now() where id = s.id; end if;
    perform play_revisar(s.id);

  elsif s.juego = 'impostor' and s.fase = 'votar' and p_tipo = 'votar' then
    obj := case when d->>'j' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then (d->>'j')::uuid end;
    if obj is null or obj = j.id or not (obj = any(play_vivos(s.id))) then return play_no(s.id, j.id, 'play_jugada'); end if;
    insert into play_eventos(sala_id, jugador_id, ronda, tipo, dato, cid) values (s.id, j.id, s.ronda, 'votar', jsonb_build_object('j', obj), 'v' || s.ronda) on conflict do nothing;
    perform play_revisar(s.id);

  elsif s.juego = 'ruleta' and s.fase = 'girar' and p_tipo = 'girar' then
    perform play_ruleta_girar(s.id);
  elsif s.juego = 'ruleta' and s.fase = 'reto' and p_tipo in ('cumplir', 'pasar', 'cambiar') then
    if (s.publico->>'elegido')::uuid is distinct from j.id then return play_vista(s.id, j.id); end if;
    if p_tipo = 'cambiar' then
      if coalesce((s.publico->>'cambio')::boolean, false) then perform play_fase(s.id, 'reto', 35, s.publico || jsonb_build_object('reto', play_reto(s.negocio_id, s.modo), 'cambio', false)); end if;
    else
      insert into play_eventos(sala_id, jugador_id, ronda, tipo, dato, cid) values (s.id, j.id, s.ronda, p_tipo, '{}'::jsonb, 'c' || s.ronda) on conflict do nothing;
      get diagnostics ins = row_count;
      if ins = 1 then perform play_ruleta_cerrar(s.id, p_tipo); end if;
    end if;
  elsif s.juego = 'ruleta' and p_tipo = 'aplaudir' and s.fase = 'resultado' and s.publico->>'hizo' = 'cumplir' then
    if (s.publico->>'elegido')::uuid is not distinct from j.id then return play_vista(s.id, j.id); end if;
    insert into play_eventos(sala_id, jugador_id, ronda, tipo, dato, cid) values (s.id, j.id, s.ronda, 'aplaudir', '{}'::jsonb, 'a' || s.ronda) on conflict do nothing;
    get diagnostics ins = row_count;
    if ins = 1 then perform play_sumar(s.id, (s.publico->>'elegido')::uuid, 25); update play_salas set version = version + 1, actualizado = now() where id = s.id; end if;

  elsif s.juego = 'sobreviviente' and s.fase = 'reto' and p_tipo = 'responder' then
    i := play_i(d); if i is null then return play_no(s.id, j.id, 'play_jugada'); end if;
    insert into play_eventos(sala_id, jugador_id, ronda, tipo, dato, cid) values (s.id, j.id, s.ronda, 'responder', jsonb_build_object('i', i, 'ok', i = (s.secreto->>'correcta')::int), 'r' || s.ronda) on conflict do nothing;
    perform play_revisar(s.id);
  end if;
  return play_vista(s.id, j.id);   -- una jugada que no toca en esta fase no hace nada
end $$;

-- Lo que ve el jugador. p_ver: la versión que ya tiene; si nada cambió, la respuesta es corta ({igual: true}).
create or replace function public.play_estado(p_token text, p_sala uuid, p_ver int default null) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare j play_jugadores := play_yo(p_token); s play_salas; nuevo uuid;
begin
  if not exists (select 1 from play_miembros m join play_salas x on x.id = m.sala_id where m.sala_id = p_sala and m.jugador_id = j.id and x.negocio_id = j.negocio_id) then raise exception 'play_sala'; end if;
  perform play_tick(p_sala);
  select * into s from play_salas where id = p_sala;
  -- En la sala de espera: si quien la creó lleva más de 60 s sin aparecer, la puede empezar el siguiente que esté conectado.
  if s.estado = 'espera' and not exists (select 1 from play_jugadores h join play_miembros hm on hm.jugador_id = h.id and hm.sala_id = s.id where h.id = s.anfitrion and h.visto > now() - interval '60 seconds') then
    select m.jugador_id into nuevo from play_miembros m join play_jugadores x on x.id = m.jugador_id
     where m.sala_id = s.id and x.visto > now() - interval '25 seconds' and m.jugador_id is distinct from s.anfitrion order by m.orden limit 1;
    if nuevo is not null then
      update play_salas set anfitrion = nuevo, version = version + 1, actualizado = now() where id = s.id and estado = 'espera' and anfitrion is not distinct from s.anfitrion;
    end if;
  end if;
  -- Una sala de espera con gente mirándola sigue «con movimiento» (como mucho una escritura cada 2 minutos): no se esconde
  -- de la lista ni la cierra la limpieza mientras alguien espera en ella.
  if s.estado = 'espera' and s.actualizado < now() - interval '2 minutes' then
    update play_salas set actualizado = now() where id = s.id and estado = 'espera' and actualizado < now() - interval '2 minutes';
  end if;
  if p_ver is not null and p_ver = (select version from play_salas where id = p_sala) then return jsonb_build_object('igual', true, 'ahora', play_ms(now())); end if;
  return play_vista(p_sala, j.id);
end $$;

create or replace function public.play_salir(p_token text, p_sala uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare j play_jugadores := play_yo(p_token); s play_salas; otro uuid; sig uuid;
begin
  if not play_cupo(j.id, 25) then return play_err('demasiados'); end if;
  -- Solo quien está en la sala puede salir de ella (y salir dos veces no hace nada).
  if not exists (select 1 from play_miembros pm join play_salas ps on ps.id = pm.sala_id where pm.sala_id = p_sala and pm.jugador_id = j.id and pm.vivo and ps.negocio_id = j.negocio_id) then return jsonb_build_object('ok', true); end if;
  -- El reloj primero: si la bomba ya explotó, explota en manos de quien la tenía (no se la pasa a otro al salir).
  perform play_tick(p_sala);
  select * into s from play_salas where id = p_sala for update;
  if not exists (select 1 from play_miembros where sala_id = s.id and jugador_id = j.id and vivo) then return jsonb_build_object('ok', true); end if;
  if s.estado = 'espera' then
    delete from play_miembros where sala_id = s.id and jugador_id = j.id;
    if s.anfitrion = j.id then
      select jugador_id into otro from play_miembros where sala_id = s.id order by orden limit 1;
      if otro is null then update play_salas set estado = 'fin', fase = 'fin' where id = s.id; else update play_salas set anfitrion = otro where id = s.id; end if;
    end if;
    update play_salas set version = version + 1, actualizado = now() where id = s.id;
  elsif s.estado = 'jugando' then
    update play_miembros set vivo = false where sala_id = s.id and jugador_id = j.id;
    update play_salas set version = version + 1, actualizado = now() where id = s.id;
    if s.juego = 'bomba' and s.fase = 'bomba' and (s.publico->>'portador')::uuid = j.id then
      -- Tenía la bomba: pasa a otro (si queda alguien).
      sig := play_azar(play_vivos(s.id));
      if sig is not null then perform play_bomba_pregunta(s.id, sig, coalesce((s.publico->>'pases')::int, 0)); end if;
    elsif s.juego = 'ruleta' and s.fase = 'reto' and (s.publico->>'elegido')::uuid = j.id then
      perform play_ruleta_cerrar(s.id, 'pasar');
    elsif s.juego = 'impostor' and s.fase in ('pistas', 'votar') and (s.secreto->>'impostor')::uuid = j.id then
      -- Se fue el impostor: se revela y sigue la siguiente ronda.
      perform play_fase(s.id, 'resultado', 8, s.publico || jsonb_build_object('impostor', j.id, 'palabra', s.secreto->'palabra', 'votos', '{}'::jsonb, 'ganan', 'salio'));
    end if;
    perform play_revisar(s.id);
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- Clasificación del día: jugadores y mesas del negocio (con el apodo más reciente de cada jugador).
create or replace function public.play_ranking(p_token text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare j play_jugadores := play_yo(p_token);
begin
  if not play_cupo(j.id, 25) then return play_err('demasiados'); end if;
  return public.play_ranking_de(j.negocio_id);
end $$;
create or replace function public.play_ranking_de(p_neg uuid) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  with hoy as (select * from play_puntos where negocio_id = p_neg and creado >= play_hoy())
  select jsonb_build_object(
    'jugadores', coalesce((select jsonb_agg(jsonb_build_object('alias', alias, 'avatar', avatar, 'mesa', mesa, 'puntos', pts, 'ganadas', g) order by pts desc)
        from (select (array_agg(alias order by creado desc))[1] alias, (array_agg(avatar order by creado desc))[1] avatar, (array_agg(mesa order by creado desc))[1] mesa,
                     sum(puntos)::int pts, count(*) filter (where gano)::int g
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
    'retos', to_jsonb(coalesce(c.retos, array['divertido','musica','talento','preguntas'])), 'local', coalesce(c.local, false), 'ranking', public.play_ranking_de(p_negocio),
    'hoy', (select jsonb_build_object('partidas', count(distinct sala_id), 'jugadores', count(distinct jugador_id), 'mesas', count(distinct mesa))
      from play_puntos where negocio_id = p_negocio and creado >= play_hoy()));
end $$;
-- Guardar (dueño o administrador). Prendido necesita al menos un juego. Apagarlo, o quitar un juego, termina las partidas
-- abiertas de ese juego: los puntos que llevaban quedan (sin el +200 del final) y las salas de espera solo se cierran.
create or replace function public.play_config_guardar(p_negocio uuid, p_activo boolean, p_juegos text[], p_retos text[], p_local boolean default false) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare r text := public.rol_en(p_negocio); jg text[]; rt text[]; sid uuid; est text;
begin
  if r is null or r not in ('dueno', 'admin') then raise exception 'sin_permiso'; end if;
  jg := array(select distinct x from unnest(coalesce(p_juegos, '{}')) x where x in ('show','bomba','impostor','ruleta','sobreviviente'));
  rt := array(select distinct x from unnest(coalesce(p_retos, '{}')) x where x in ('divertido','musica','talento','preguntas'));
  if coalesce(p_activo, false) and array_length(jg, 1) is null then raise exception 'play_sin_juegos'; end if;
  if array_length(rt, 1) is null then rt := array['divertido']; end if;
  insert into play_config(negocio_id, activo, juegos, retos, local, actualizado_en, actualizado_por) values (p_negocio, coalesce(p_activo, false), jg, rt, coalesce(p_local, false), now(), auth.uid())
  on conflict (negocio_id) do update set activo = excluded.activo, juegos = excluded.juegos, retos = excluded.retos, local = excluded.local, actualizado_en = now(), actualizado_por = auth.uid();
  for sid, est in select id, estado from play_salas where negocio_id = p_negocio and estado <> 'fin' and (not coalesce(p_activo, false) or not (juego = any(jg))) for update loop
    if est = 'espera' then update play_salas set estado = 'fin', fase = 'fin', fase_hasta = null, version = version + 1, actualizado = now() where id = sid;
    else perform play_terminar(sid, false); end if;
  end loop;
  return public.play_config_ver(p_negocio);
end $$;

-- ---------- Limpieza (pg_cron cada 10 minutos; nunca dentro de la petición de un cliente) ----------
create or replace function public.play_limpiar() returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare a int; b int; c int; d int;
begin
  -- Salas sin movimiento en 30 minutos (nadie las mira): se cierran. La versión sube para que un celular que vuelva lo vea.
  update play_salas set estado = 'fin', fase = 'fin', fase_hasta = null, version = version + 1
   where id in (select id from play_salas where estado <> 'fin' and actualizado < now() - interval '30 minutes' limit 2000);
  get diagnostics a = row_count;
  delete from play_origen where desde < now() - interval '1 hour';
  delete from play_salas where id in (select id from play_salas where estado = 'fin' and actualizado < now() - interval '2 days' limit 2000);
  get diagnostics b = row_count;
  delete from play_jugadores where id in (select id from play_jugadores where creado < now() - interval '2 days' limit 2000);
  get diagnostics c = row_count;
  delete from play_puntos where id in (select id from play_puntos where creado < now() - interval '90 days' limit 5000);
  get diagnostics d = row_count;
  return jsonb_build_object('salas_cerradas', a, 'salas_borradas', b, 'jugadores_borrados', c, 'puntos_borrados', d);
end $$;

-- ---------- Permisos ----------
do $$ declare f text; begin
  foreach f in array array['play_ms(timestamptz)','play_hoy()','play_norm(text)','play_grosero(text)','play_dice_palabra(text, text)','play_i(jsonb)','play_yo(text)',
    'play_cupo(uuid, int)','play_cupo_origen(text, int)','play_err(text)','play_abiertas(uuid, int)','play_mate(int)','play_vivos(uuid)','play_azar(uuid[], uuid)',
    'play_sumar(uuid, uuid, int)','play_fase(uuid, text, numeric, jsonb, jsonb, int)','play_reto(uuid, text)','play_show_abonar(uuid, int)','play_terminar(uuid, boolean)','play_show_ronda(uuid)','play_show_resultado(uuid)',
    'play_bomba_pregunta(uuid, uuid, int)','play_bomba_ronda(uuid)','play_bomba_explota(uuid)','play_impostor_pistas(uuid, int)','play_impostor_ronda(uuid)','play_impostor_votar(uuid)','play_impostor_resultado(uuid)',
    'play_ruleta_girar(uuid)','play_ruleta_ronda(uuid)','play_ruleta_cerrar(uuid, text)','play_sobre_ronda(uuid)','play_sobre_resolver(uuid)','play_revisar(uuid)','play_vencio(uuid)','play_tick(uuid)',
    'play_vista(uuid, uuid)','play_no(uuid, uuid, text)','play_ranking_de(uuid)','play_limpiar()'] loop
    execute 'revoke all on function public.' || f || ' from public, anon, authenticated';
    execute 'grant execute on function public.' || f || ' to service_role';
  end loop;
  foreach f in array array['play_entrar(text, int, text, text, text, text)','play_salas_abiertas(text)','play_crear(text, text, text)','play_unirse(text, text)',
    'play_empezar(text, uuid)','play_accion(text, uuid, text, jsonb, text)','play_estado(text, uuid, int)','play_salir(text, uuid)','play_ranking(text)'] loop
    execute 'revoke all on function public.' || f || ' from public';
    execute 'grant execute on function public.' || f || ' to anon, authenticated, service_role';
  end loop;
  foreach f in array array['play_config_ver(uuid)','play_config_guardar(uuid, boolean, text[], text[], boolean)'] loop
    execute 'revoke all on function public.' || f || ' from public, anon';
    execute 'grant execute on function public.' || f || ' to authenticated, service_role';
  end loop;
end $$;

do $$
begin
  if to_regprocedure('cron.schedule(text,text,text)') is null then
    raise notice 'ORDEVA PLAY: este Supabase no tiene pg_cron: la limpieza de PLAY no queda programada (select public.play_limpiar() a mano)';
    return;
  end if;
  begin
    perform cron.schedule('ordeva-play-limpiar', '*/10 * * * *', 'select public.play_limpiar()');
  exception when others then raise notice 'ORDEVA PLAY: no se pudo programar la limpieza (%)', sqlerrm;
  end;
end $$;

-- ---------- Contenido inicial (de ORDEVA; se puede ampliar sin cambiar el código) ----------
insert into public.play_preguntas(categoria, q, opciones, correcta) values
('Colombia','¿Cuál es la capital de Colombia?','{Medellín,Bogotá,Cali,Cartagena}',1),
('Colombia','¿En qué ciudad se celebra la Feria de las Flores?','{Medellín,Cali,Barranquilla,Manizales}',0),
('Colombia','¿En qué ciudad se celebra el Carnaval de Negros y Blancos?','{Pasto,Barranquilla,Santa Marta,Cúcuta}',0),
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
('Colombia','¿En qué eje está la zona cafetera?','{"Caldas, Risaralda y Quindío","Nariño y Cauca","Meta y Casanare","Sucre y Córdoba"}',0),
('Colombia','¿Cómo se llama el sombrero típico de la costa colombiana?','{Sombrero vueltiao,Panamá,Sombrero aguadeño,Chupalla}',0),
('Colombia','¿Qué plato es típico de Antioquia?','{Ajiaco,Bandeja paisa,Sancocho de pescado,Mote de queso}',1),
('Colombia','¿Qué sopa típica de Bogotá lleva tres tipos de papa?','{Mondongo,Ajiaco,Cuchuco,Sancocho}',1),
('Colombia','¿En qué océanos tiene costa Colombia?','{"Solo el Pacífico","Solo el Atlántico","Pacífico y Atlántico (Caribe)","Índico y Pacífico"}',2),
('Geografía','¿Cuál es el río más caudaloso del mundo (el que lleva más agua)?','{El Nilo,El Amazonas,El Misisipi,El Yangtsé}',1),
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

-- Retos: divertidos y seguros. Nunca beber ni brindar, nada peligroso, nada privado, nada que incomode a otros. Siempre se puede pasar.
insert into public.play_retos(categoria, texto) values
('divertido','Imita a un animal durante 10 segundos y que la mesa adivine cuál es.'),
('divertido','Habla como presentador de noticias contando lo que pidió tu mesa.'),
('divertido','Haz tu mejor cara de sorpresa y que la mesa la califique del 1 al 10.'),
('divertido','Di un trabalenguas sin equivocarte: «Tres tristes tigres tragaban trigo en un trigal».'),
('divertido','Cuenta un chiste (blanco) en menos de 30 segundos.'),
('divertido','Di en 15 segundos algo bonito que te pasó hoy.'),
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

-- Los retos que hablan de «tu mesa» o de «tu derecha» solo salen jugando con la propia mesa.
update public.play_retos set solo_mesa = true where texto ~* '(mesa|derecha)' and not solo_mesa;
