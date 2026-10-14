-- =====================================================================
--  Vento Admin · usuarios, equipos, soporte y licencias (el proveedor maneja todo desde la app de administración)
--
--  • admin_correos: correos que SIEMPRE son administradores de Vento (el de Cristhian). La contraseña NO va aquí:
--    la cuenta se crea o se recupera desde Vento Admin (Supabase Auth guarda solo el hash).
--  • instalaciones: cada equipo donde se abre Vento avisa que existe (también las cuentas que no usan la nube),
--    así el administrador ve a TODOS los usuarios registrados y en cuántos equipos usa cada uno su cuenta.
--  • perfiles: el celular de cada cuenta (para recuperar la contraseña por mensaje de texto) y si aceptó la licencia.
--  • soporte_casos / soporte_mensajes: cada cliente escribe a soporte desde la app y el administrador responde.
--  • licencias: solo el proveedor las crea (con su duración y los correos con los que se comparte). Se activan
--    solas cuando entra alguien con uno de esos correos, o con el código. Nadie más puede crear licencias.
--  Todo pasa por funciones que revisan permisos; las tablas no se pueden leer directo. Se puede volver a correr.
-- =====================================================================

-- ---------- Administradores por correo ----------
create table if not exists public.admin_correos (
  email      text primary key check (email = lower(email) and char_length(email) between 5 and 120),
  creado_en  timestamptz not null default now()
);
insert into public.admin_correos(email) values ('cristhianwkh@gmail.com') on conflict do nothing;

-- Es administrador si está en platform_admins o si su correo está en admin_correos.
create or replace function public.srv_admin_es(p_usuario uuid) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from platform_admins where user_id = p_usuario)
      or exists (select 1 from auth.users u join admin_correos a on a.email = lower(u.email) where u.id = p_usuario)
$$;

-- ¿Ese correo es de un administrador? (la app de los negocios no deja usarlo como cuenta de cliente)
create or replace function public.es_correo_admin(p_email text) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from admin_correos where email = lower(trim(coalesce(p_email, ''))))
$$;

-- ---------- Equipos (instalaciones) ----------
create table if not exists public.instalaciones (
  equipo          text primary key check (equipo ~ '^[A-Za-z0-9_-]{6,64}$'),
  negocio_nombre  text check (char_length(negocio_nombre) <= 80),
  usuario         text check (char_length(usuario) <= 120),
  correo          text check (char_length(correo) <= 120),
  usuario_id      uuid references auth.users(id) on delete set null,
  negocio_id      uuid references public.negocios(id) on delete set null,
  tipo            text not null default 'local' check (tipo in ('local','nube')),
  version         text check (char_length(version) <= 40),
  plataforma      text check (char_length(plataforma) <= 40),
  modelo          text check (char_length(modelo) <= 120),
  primera         timestamptz not null default now(),
  ultima          timestamptz not null default now(),
  veces           int not null default 1
);
create index if not exists instalaciones_negocio_idx on public.instalaciones(negocio_id);
create index if not exists instalaciones_usuario_idx on public.instalaciones(usuario_id);
create index if not exists instalaciones_ultima_idx on public.instalaciones(ultima desc);
alter table public.instalaciones enable row level security;

-- Cada equipo avisa al abrir Vento (con o sin cuenta en la nube). Sin contraseñas ni datos del negocio.
create or replace function public.registrar_instalacion(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v_eq text := left(trim(coalesce(p ->> 'equipo', '')), 64); v_neg uuid; v_uid uuid := auth.uid(); v_correo text;
begin
  if v_eq !~ '^[A-Za-z0-9_-]{6,64}$' then raise exception 'equipo_invalido'; end if;
  if v_uid is not null then
    v_correo := lower((select email from auth.users where id = v_uid));
    begin v_neg := nullif(p ->> 'negocio_id', '')::uuid; exception when others then v_neg := null; end;
    if v_neg is not null and not exists (select 1 from miembros where negocio_id = v_neg and usuario_id = v_uid) then v_neg := null; end if;
  end if;
  insert into instalaciones as i (equipo, negocio_nombre, usuario, correo, usuario_id, negocio_id, tipo, version, plataforma, modelo)
    values (v_eq, left(nullif(trim(p ->> 'negocio'), ''), 80), left(nullif(trim(p ->> 'usuario'), ''), 120),
            coalesce(v_correo, left(nullif(lower(trim(p ->> 'correo')), ''), 120)), v_uid, v_neg,
            case when v_uid is not null then 'nube' else 'local' end,
            left(p ->> 'version', 40), left(p ->> 'plataforma', 40), left(p ->> 'modelo', 120))
  on conflict (equipo) do update set
    negocio_nombre = coalesce(excluded.negocio_nombre, i.negocio_nombre), usuario = coalesce(excluded.usuario, i.usuario),
    correo = coalesce(excluded.correo, i.correo), usuario_id = coalesce(excluded.usuario_id, i.usuario_id),
    negocio_id = coalesce(excluded.negocio_id, i.negocio_id),
    tipo = case when coalesce(excluded.usuario_id, i.usuario_id) is not null then 'nube' else 'local' end,
    version = coalesce(excluded.version, i.version), plataforma = coalesce(excluded.plataforma, i.plataforma),
    modelo = coalesce(excluded.modelo, i.modelo), ultima = now(), veces = i.veces + 1;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- Perfil de la cuenta (celular para recuperar la contraseña) ----------
create table if not exists public.perfiles (
  usuario_id        uuid primary key references auth.users(id) on delete cascade,
  telefono          text check (telefono ~ '^\+?[0-9]{7,15}$'),
  nombre            text check (char_length(nombre) <= 80),
  acepto_licencia   timestamptz,
  cambiar_clave     boolean not null default false,
  actualizado_en    timestamptz not null default now()
);
alter table public.perfiles enable row level security;

create or replace function public.perfil_yo() returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object('telefono', p.telefono, 'nombre', p.nombre, 'acepto_licencia', p.acepto_licencia,
           'cambiar_clave', coalesce(p.cambiar_clave, false), 'admin', srv_admin_es(auth.uid()))
  from (select auth.uid() as id) yo left join perfiles p on p.usuario_id = yo.id
  where auth.uid() is not null
$$;

create or replace function public.perfil_guardar(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v_tel text := nullif(regexp_replace(coalesce(p ->> 'telefono', ''), '[\s().-]', '', 'g'), '');
begin
  if auth.uid() is null then raise exception 'sin_sesion'; end if;
  if v_tel is not null and v_tel !~ '^\+?[0-9]{7,15}$' then raise exception 'telefono_invalido'; end if;
  insert into perfiles as x (usuario_id, telefono, nombre, acepto_licencia, cambiar_clave)
    values (auth.uid(), v_tel, left(nullif(trim(p ->> 'nombre'), ''), 80),
            case when (p ->> 'acepto_licencia')::boolean then now() end, false)
  on conflict (usuario_id) do update set
    telefono = case when p ? 'telefono' then v_tel else x.telefono end,
    nombre = coalesce(left(nullif(trim(p ->> 'nombre'), ''), 80), x.nombre),
    acepto_licencia = coalesce(x.acepto_licencia, case when (p ->> 'acepto_licencia')::boolean then now() end),
    cambiar_clave = case when (p ->> 'clave_cambiada')::boolean then false else x.cambiar_clave end,
    actualizado_en = now();
  return perfil_yo();
end $$;

-- ---------- Soporte ----------
create table if not exists public.soporte_casos (
  id              uuid primary key default gen_random_uuid(),
  clave           text not null,                                   -- para que el equipo que lo creó lo pueda ver sin cuenta
  usuario_id      uuid references auth.users(id) on delete set null,
  negocio_id      uuid references public.negocios(id) on delete set null,
  equipo          text check (char_length(equipo) <= 64),
  email           text check (char_length(email) <= 120),
  telefono        text check (char_length(telefono) <= 20),
  nombre          text check (char_length(nombre) <= 80),
  negocio_nombre  text check (char_length(negocio_nombre) <= 80),
  tipo            text not null default 'ayuda' check (tipo in ('ayuda','error','pago','clave','licencia','otro')),
  asunto          text not null check (char_length(asunto) between 1 and 120),
  estado          text not null default 'abierto' check (estado in ('abierto','respondido','cerrado')),
  visto_cliente   timestamptz,
  visto_admin     timestamptz,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now()
);
create index if not exists soporte_casos_estado_idx on public.soporte_casos(estado, actualizado_en desc);
create index if not exists soporte_casos_usuario_idx on public.soporte_casos(usuario_id);
create table if not exists public.soporte_mensajes (
  id         bigserial primary key,
  caso_id    uuid not null references public.soporte_casos(id) on delete cascade,
  autor      text not null check (autor in ('cliente','admin')),
  admin_id   uuid references auth.users(id) on delete set null,
  texto      text not null check (char_length(texto) between 1 and 2000),
  creado_en  timestamptz not null default now()
);
create index if not exists soporte_mensajes_caso_idx on public.soporte_mensajes(caso_id, id);
alter table public.soporte_casos enable row level security;
alter table public.soporte_mensajes enable row level security;

create or replace function public.soporte_caso_pub(c public.soporte_casos, p_admin boolean default false) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object('id', c.id, 'tipo', c.tipo, 'asunto', c.asunto, 'estado', c.estado, 'creado_en', c.creado_en,
      'actualizado_en', c.actualizado_en, 'nombre', c.nombre, 'negocio_nombre', coalesce(c.negocio_nombre, (select nombre from negocios where id = c.negocio_id)),
      'mensajes', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'autor', m.autor, 'texto', m.texto, 'creado_en', m.creado_en) order by m.id)
                            from soporte_mensajes m where m.caso_id = c.id), '[]'::jsonb),
      'sin_leer', (select count(*) from soporte_mensajes m where m.caso_id = c.id
                     and m.autor = case when p_admin then 'cliente' else 'admin' end
                     and m.creado_en > coalesce(case when p_admin then c.visto_admin else c.visto_cliente end, '-infinity'::timestamptz)))
    || case when p_admin then jsonb_build_object('email', c.email, 'telefono', c.telefono, 'equipo', c.equipo, 'usuario_id', c.usuario_id,
          'negocio_id', c.negocio_id,
          'telefono_perfil', (select telefono from perfiles where usuario_id = c.usuario_id),
          'cuenta_email', (select email from auth.users where id = c.usuario_id),
          'cuenta_por_correo', (select id from auth.users where lower(email) = lower(c.email) limit 1),
          'telefono_de_la_cuenta', (select p.telefono from auth.users u join perfiles p on p.usuario_id = u.id where lower(u.email) = lower(c.email) limit 1))
       else '{}'::jsonb end
$$;

-- Crear un caso (con o sin cuenta). Devuelve su id y la clave para verlo después desde ese equipo.
create or replace function public.soporte_crear(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare c soporte_casos%rowtype; v_uid uuid := auth.uid(); v_eq text := left(nullif(trim(p ->> 'equipo'), ''), 64);
  v_txt text := trim(coalesce(p ->> 'mensaje', '')); v_tipo text := coalesce(nullif(p ->> 'tipo', ''), 'ayuda'); v_neg uuid;
begin
  if char_length(v_txt) < 2 or char_length(v_txt) > 2000 then raise exception 'mensaje_invalido'; end if;
  if v_tipo not in ('ayuda','error','pago','clave','licencia','otro') then v_tipo := 'otro'; end if;
  -- Límite: 8 casos por equipo (o cuenta) por día.
  if (select count(*) from soporte_casos where creado_en > now() - interval '1 day'
        and ((v_uid is not null and usuario_id = v_uid) or (v_eq is not null and equipo = v_eq))) >= 8 then raise exception 'demasiados'; end if;
  if v_uid is not null then
    begin v_neg := nullif(p ->> 'negocio_id', '')::uuid; exception when others then v_neg := null; end;
    if v_neg is not null and not exists (select 1 from miembros where negocio_id = v_neg and usuario_id = v_uid) then v_neg := null; end if;
  end if;
  insert into soporte_casos(clave, usuario_id, negocio_id, equipo, email, telefono, nombre, negocio_nombre, tipo, asunto)
    values (encode(gen_random_bytes(18), 'hex'), v_uid, v_neg, v_eq,
            coalesce(lower((select email from auth.users where id = v_uid)), left(nullif(lower(trim(p ->> 'email')), ''), 120)),
            left(nullif(regexp_replace(coalesce(p ->> 'telefono', ''), '[^0-9+]', '', 'g'), ''), 20),
            left(nullif(trim(p ->> 'nombre'), ''), 80), left(nullif(trim(p ->> 'negocio'), ''), 80), v_tipo,
            left(coalesce(nullif(trim(p ->> 'asunto'), ''), left(v_txt, 80)), 120))
    returning * into c;
  insert into soporte_mensajes(caso_id, autor, texto) values (c.id, 'cliente', v_txt);
  return jsonb_build_object('id', c.id, 'clave', c.clave, 'caso', soporte_caso_pub(c, false));
end $$;

-- Ver mis casos: los de mi cuenta y los que creó este equipo (con su clave).
create or replace function public.soporte_mis_casos(p_claves jsonb default '[]'::jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare r jsonb;
begin
  select coalesce(jsonb_agg(soporte_caso_pub(c, false) order by c.actualizado_en desc), '[]'::jsonb) into r
    from soporte_casos c
   where (auth.uid() is not null and c.usuario_id = auth.uid())
      or exists (select 1 from jsonb_array_elements(case when jsonb_typeof(p_claves) = 'array' then p_claves else '[]'::jsonb end) k
                 where (k ->> 'id') = c.id::text and (k ->> 'clave') = c.clave);
  return r;
end $$;

create or replace function public.soporte_puede(p_caso uuid, p_clave text) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from soporte_casos c where c.id = p_caso
                  and ((auth.uid() is not null and c.usuario_id = auth.uid()) or (p_clave is not null and c.clave = p_clave)))
$$;

create or replace function public.soporte_escribir(p_caso uuid, p_clave text, p_texto text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare c soporte_casos%rowtype;
begin
  if not soporte_puede(p_caso, p_clave) then raise exception 'sin_permiso'; end if;
  if char_length(trim(coalesce(p_texto, ''))) < 1 or char_length(p_texto) > 2000 then raise exception 'mensaje_invalido'; end if;
  if (select count(*) from soporte_mensajes where caso_id = p_caso and creado_en > now() - interval '1 hour') >= 30 then raise exception 'demasiados'; end if;
  insert into soporte_mensajes(caso_id, autor, texto) values (p_caso, 'cliente', trim(p_texto));
  update soporte_casos set estado = 'abierto', actualizado_en = now(), visto_cliente = now() where id = p_caso returning * into c;
  return soporte_caso_pub(c, false);
end $$;

create or replace function public.soporte_visto(p_caso uuid, p_clave text) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not soporte_puede(p_caso, p_clave) then return false; end if;
  update soporte_casos set visto_cliente = now() where id = p_caso;
  return true;
end $$;

-- ---------- Licencias ----------
create table if not exists public.licencias (
  id           uuid primary key default gen_random_uuid(),
  codigo       text not null unique check (codigo ~ '^VENTO-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$'),
  plan_id      text not null references public.plans(id),
  dias         int check (dias between 1 and 36500),         -- duración desde que se activa (null = usa «hasta»)
  hasta        timestamptz,                                  -- o una fecha fija de vencimiento
  usos_max     int not null default 1 check (usos_max between 1 and 1000),
  nota         text check (char_length(nota) <= 200),
  estado       text not null default 'activa' check (estado in ('activa','revocada')),
  creada_por   uuid references auth.users(id) on delete set null,
  creada_en    timestamptz not null default now(),
  revocada_en  timestamptz,
  check (dias is not null or hasta is not null)
);
create table if not exists public.licencia_correos (
  licencia_id  uuid not null references public.licencias(id) on delete cascade,
  email        text not null check (email = lower(email) and char_length(email) between 5 and 120),
  agregado_en  timestamptz not null default now(),
  primary key (licencia_id, email)
);
create index if not exists licencia_correos_email_idx on public.licencia_correos(email);
create table if not exists public.licencia_usos (
  id           bigserial primary key,
  licencia_id  uuid not null references public.licencias(id) on delete cascade,
  negocio_id   uuid references public.negocios(id) on delete set null,
  usuario_id   uuid references auth.users(id) on delete set null,
  email        text,
  hasta        timestamptz not null,
  creado_en    timestamptz not null default now(),
  unique (licencia_id, negocio_id)
);
alter table public.licencias enable row level security;
alter table public.licencia_correos enable row level security;
alter table public.licencia_usos enable row level security;

create or replace function public.lic_pub(l public.licencias) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object('id', l.id, 'codigo', l.codigo, 'plan_id', l.plan_id, 'plan_name', (select name from plans where id = l.plan_id),
    'dias', l.dias, 'hasta', l.hasta, 'usos_max', l.usos_max, 'nota', l.nota, 'estado', l.estado, 'creada_en', l.creada_en,
    'revocada_en', l.revocada_en,
    'usos', (select count(*) from licencia_usos u where u.licencia_id = l.id),
    'correos', coalesce((select jsonb_agg(jsonb_build_object('email', c.email,
        'usada', exists (select 1 from licencia_usos u where u.licencia_id = l.id and lower(u.email) = c.email),
        'registrado', exists (select 1 from auth.users x where lower(x.email) = c.email)) order by c.agregado_en)
      from licencia_correos c where c.licencia_id = l.id), '[]'::jsonb),
    'activaciones', coalesce((select jsonb_agg(jsonb_build_object('negocio_id', u.negocio_id, 'negocio', (select nombre from negocios where id = u.negocio_id),
        'email', u.email, 'hasta', u.hasta, 'creado_en', u.creado_en) order by u.creado_en) from licencia_usos u where u.licencia_id = l.id), '[]'::jsonb))
$$;

create or replace function public.lic_correos_de(p jsonb) returns text[]
language sql immutable as $$
  select coalesce(array_agg(distinct e), '{}') from (
    select lower(trim(x)) as e from jsonb_array_elements_text(case when jsonb_typeof(p) = 'array' then p else '[]'::jsonb end) x
  ) y where e ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' and char_length(e) <= 120
$$;

-- Crear una licencia (solo el servidor, a pedido de un administrador).
-- p: { plan, dias | hasta | para_siempre, correos: [..], usos_max, nota }
create or replace function public.srv_lic_crear(p jsonb, p_admin uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare l licencias%rowtype; v_cod text; v_correos text[] := lic_correos_de(p -> 'correos'); v_dias int; v_hasta timestamptz;
  v_usos int; a text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; i int;
begin
  if p_admin is null or not srv_admin_es(p_admin) then raise exception 'sin_permiso'; end if;
  if coalesce(p ->> 'plan', '') = 'free' or not exists (select 1 from plans where id = p ->> 'plan') then raise exception 'plan_invalido'; end if;
  if (p ->> 'para_siempre')::boolean then v_dias := 36500;
  elsif nullif(p ->> 'hasta', '') is not null then
    v_hasta := (p ->> 'hasta')::timestamptz;
    if v_hasta <= now() then raise exception 'fechas_invalidas'; end if;
  else
    v_dias := (p ->> 'dias')::int;
    if v_dias is null or v_dias < 1 or v_dias > 36500 then raise exception 'dias_invalidos'; end if;
  end if;
  v_usos := greatest(coalesce(nullif(p ->> 'usos_max', '')::int, 0), coalesce(array_length(v_correos, 1), 0), 1);
  if v_usos > 1000 then raise exception 'usos_invalidos'; end if;
  loop
    v_cod := 'VENTO';
    for i in 1..3 loop
      v_cod := v_cod || '-' || (select string_agg(substr(a, 1 + (get_byte(b, k) % length(a)), 1), '' order by k)
                                  from (select gen_random_bytes(4) as b) r, generate_series(0, 3) k);
    end loop;
    exit when not exists (select 1 from licencias where codigo = v_cod);
  end loop;
  insert into licencias(codigo, plan_id, dias, hasta, usos_max, nota, creada_por)
    values (v_cod, p ->> 'plan', v_dias, v_hasta, v_usos, left(nullif(trim(p ->> 'nota'), ''), 200), p_admin) returning * into l;
  insert into licencia_correos(licencia_id, email) select l.id, e from unnest(v_correos) e on conflict do nothing;
  return lic_pub(l);
end $$;

create or replace function public.srv_lic_lista() returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select coalesce(jsonb_agg(lic_pub(l) order by l.creada_en desc), '[]'::jsonb) from (select * from licencias order by creada_en desc limit 1000) l
$$;

-- Agregar o quitar correos con los que se comparte una licencia.
create or replace function public.srv_lic_correos(p_id uuid, p_agregar jsonb, p_quitar jsonb, p_admin uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare l licencias%rowtype; v_add text[] := lic_correos_de(p_agregar); v_del text[] := lic_correos_de(p_quitar); n int;
begin
  if p_admin is null or not srv_admin_es(p_admin) then raise exception 'sin_permiso'; end if;
  select * into l from licencias where id = p_id for update;
  if not found then raise exception 'no_existe'; end if;
  delete from licencia_correos where licencia_id = p_id and email = any(v_del);
  insert into licencia_correos(licencia_id, email) select p_id, e from unnest(v_add) e on conflict do nothing;
  select count(*) into n from licencia_correos where licencia_id = p_id;
  update licencias set usos_max = greatest(usos_max, n) where id = p_id returning * into l;
  return lic_pub(l);
end $$;

-- Revocar: la licencia ya no se puede usar y (si se pide) se quita el plan a los negocios que la activaron.
create or replace function public.srv_lic_revocar(p_id uuid, p_quitar_acceso boolean, p_admin uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare l licencias%rowtype; u record;
begin
  if p_admin is null or not srv_admin_es(p_admin) then raise exception 'sin_permiso'; end if;
  update licencias set estado = 'revocada', revocada_en = now() where id = p_id returning * into l;
  if not found then raise exception 'no_existe'; end if;
  if coalesce(p_quitar_acceso, false) then
    for u in select * from licencia_usos where licencia_id = p_id and negocio_id is not null loop
      update subscriptions set status = 'canceled', canceled_at = now(), expiry_date = least(expiry_date, now()), updated_at = now()
       where business_id = u.negocio_id and external_id = 'lic:' || l.codigo and status = 'active';
      perform vento_auditar(u.negocio_id, p_admin, null, 'licencia_revocada', jsonb_build_object('codigo', l.codigo));
    end loop;
  end if;
  return lic_pub(l);
end $$;

-- Activa una licencia en un negocio. Revisa: activa, sin pasar el tope de usos, y si tiene correos, que sea uno de ellos.
create or replace function public.srv_lic_activar(l public.licencias, p_negocio uuid, p_usuario uuid, p_email text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v_hasta timestamptz; v_sus jsonb; v_desde timestamptz := now(); v_email text := lower(coalesce(p_email, ''));
begin
  if l.estado <> 'activa' then raise exception 'licencia_revocada'; end if;
  if exists (select 1 from licencia_usos where licencia_id = l.id and negocio_id = p_negocio) then raise exception 'licencia_ya_usada'; end if;
  if exists (select 1 from licencia_correos where licencia_id = l.id)
     and not exists (select 1 from licencia_correos where licencia_id = l.id and email = v_email) then raise exception 'licencia_otro_correo'; end if;
  if exists (select 1 from licencia_usos where licencia_id = l.id and lower(email) = v_email) then raise exception 'licencia_ya_usada'; end if;
  if (select count(*) from licencia_usos where licencia_id = l.id) >= l.usos_max then raise exception 'licencia_agotada'; end if;
  if l.hasta is not null then
    if l.hasta <= now() then raise exception 'licencia_vencida'; end if;
    v_hasta := l.hasta;
  else
    -- Si ya tiene ese plan activo y pagado, la licencia se suma al final.
    select greatest(now(), case when s.status = 'active' and s.source <> 'trial' and s.plan_id = l.plan_id then s.expiry_date end)
      into v_desde from subscriptions s where s.business_id = p_negocio;
    v_desde := coalesce(v_desde, now());
    v_hasta := v_desde + make_interval(days => l.dias);
  end if;
  perform srv_sub_vencer(p_negocio);
  v_sus := srv_sub_activar(p_negocio, l.plan_id, now(), v_hasta, 'admin', 'lic:' || l.codigo, p_usuario, null);
  insert into licencia_usos(licencia_id, negocio_id, usuario_id, email, hasta) values (l.id, p_negocio, p_usuario, v_email, v_hasta);
  perform vento_auditar(p_negocio, p_usuario, null, 'licencia_activada', jsonb_build_object('codigo', l.codigo, 'plan', l.plan_id, 'hasta', v_hasta));
  return jsonb_build_object('ok', true, 'codigo', l.codigo, 'plan_id', l.plan_id, 'hasta', v_hasta, 'subscription', v_sus);
end $$;

-- Canjear con el código (lo pide el dueño o un administrador del negocio).
create or replace function public.srv_lic_canjear(p_codigo text, p_negocio uuid, p_usuario uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare l licencias%rowtype; v_email text := lower((select email from auth.users where id = p_usuario));
begin
  if not exists (select 1 from miembros where negocio_id = p_negocio and usuario_id = p_usuario and rol in ('dueno','admin')) then raise exception 'sin_permiso'; end if;
  select * into l from licencias where codigo = upper(regexp_replace(trim(coalesce(p_codigo, '')), '\s+', '', 'g')) for update;
  if not found then raise exception 'licencia_inexistente'; end if;
  return srv_lic_activar(l, p_negocio, p_usuario, v_email);
end $$;

-- Las licencias compartidas con el correo de quien entra se activan solas en su negocio (dueño o administrador).
create or replace function public.srv_lic_auto(p_negocio uuid, p_usuario uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare l licencias%rowtype; v_email text := lower((select email from auth.users where id = p_usuario)); r jsonb := '[]'::jsonb;
begin
  if v_email is null or not exists (select 1 from miembros where negocio_id = p_negocio and usuario_id = p_usuario and rol in ('dueno','admin')) then return r; end if;
  for l in select x.* from licencias x join licencia_correos c on c.licencia_id = x.id
            where c.email = v_email and x.estado = 'activa' and (x.hasta is null or x.hasta > now())
              and not exists (select 1 from licencia_usos u where u.licencia_id = x.id and lower(u.email) = v_email)
              and (select count(*) from licencia_usos u where u.licencia_id = x.id) < x.usos_max
            order by x.creada_en for update of x loop
    begin
      r := r || jsonb_build_array(srv_lic_activar(l, p_negocio, p_usuario, v_email));
    exception when others then null;   -- una que no se pueda (ej. ya usada en este negocio) no frena las demás
    end;
  end loop;
  return r;
end $$;

-- ---------- Panel: usuarios, equipos, resumen y soporte ----------
create or replace function public.srv_admin_usuarios(p_buscar text default null, p_limite int default 300) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select coalesce(jsonb_agg(x.j order by x.t desc), '[]'::jsonb) from (
    select jsonb_build_object('id', u.id, 'email', u.email, 'creado_en', u.created_at, 'ultimo_ingreso', u.last_sign_in_at,
        'confirmado', u.email_confirmed_at is not null,
        'bloqueado', coalesce(nullif(to_jsonb(u) ->> 'banned_until', '')::timestamptz > now(), false),
        'telefono', (select telefono from perfiles where usuario_id = u.id),
        'admin', srv_admin_es(u.id),
        'negocios', coalesce((select jsonb_agg(jsonb_build_object('id', n.id, 'nombre', n.nombre, 'rol', m.rol, 'plan_efectivo', sub_plan_de(n.id),
              'suscripcion', (select sub_sus_pub(s) from subscriptions s where s.business_id = n.id)) order by m.creado_en)
            from miembros m join negocios n on n.id = m.negocio_id where m.usuario_id = u.id), '[]'::jsonb),
        'equipos', (select count(*) from instalaciones i where i.usuario_id = u.id),
        'equipo_ultimo', (select max(ultima) from instalaciones i where i.usuario_id = u.id),
        'soporte_abiertos', (select count(*) from soporte_casos c where c.usuario_id = u.id and c.estado <> 'cerrado')) as j,
      greatest(u.created_at, coalesce(u.last_sign_in_at, u.created_at)) as t
    from auth.users u
    where p_buscar is null or p_buscar = '' or u.email ilike '%' || p_buscar || '%'
       or exists (select 1 from miembros m join negocios n on n.id = m.negocio_id where m.usuario_id = u.id and n.nombre ilike '%' || p_buscar || '%')
    order by greatest(u.created_at, coalesce(u.last_sign_in_at, u.created_at)) desc
    limit greatest(1, least(coalesce(p_limite, 300), 2000))) x
$$;

create or replace function public.srv_admin_usuario(p_usuario uuid) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select (select j from (select jsonb_array_elements(srv_admin_usuarios(u.email, 5)) j) z where (j ->> 'id')::uuid = u.id limit 1)
    || jsonb_build_object(
      'equipos_lista', coalesce((select jsonb_agg(jsonb_build_object('equipo', i.equipo, 'negocio', i.negocio_nombre, 'usuario', i.usuario, 'version', i.version,
          'plataforma', i.plataforma, 'modelo', i.modelo, 'primera', i.primera, 'ultima', i.ultima, 'veces', i.veces) order by i.ultima desc)
        from instalaciones i where i.usuario_id = u.id), '[]'::jsonb),
      'licencias', coalesce((select jsonb_agg(jsonb_build_object('codigo', l.codigo, 'plan_id', l.plan_id, 'hasta', x.hasta, 'creado_en', x.creado_en) order by x.creado_en desc)
        from licencia_usos x join licencias l on l.id = x.licencia_id where x.usuario_id = u.id or lower(x.email) = lower(u.email)), '[]'::jsonb),
      'licencias_pendientes', coalesce((select jsonb_agg(l.codigo) from licencia_correos c join licencias l on l.id = c.licencia_id
        where c.email = lower(u.email) and l.estado = 'activa'
          and not exists (select 1 from licencia_usos x where x.licencia_id = l.id and lower(x.email) = c.email)), '[]'::jsonb),
      'soporte', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'asunto', c.asunto, 'estado', c.estado, 'actualizado_en', c.actualizado_en) order by c.actualizado_en desc)
        from soporte_casos c where c.usuario_id = u.id or lower(c.email) = lower(u.email)), '[]'::jsonb))
  from auth.users u where u.id = p_usuario
$$;

create or replace function public.srv_admin_equipos(p_solo_locales boolean default false) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select coalesce(jsonb_agg(jsonb_build_object('equipo', i.equipo, 'negocio', i.negocio_nombre, 'usuario', i.usuario, 'correo', i.correo,
      'usuario_id', i.usuario_id, 'negocio_id', i.negocio_id, 'tipo', i.tipo, 'version', i.version, 'plataforma', i.plataforma,
      'modelo', i.modelo, 'primera', i.primera, 'ultima', i.ultima, 'veces', i.veces) order by i.ultima desc), '[]'::jsonb)
  from (select * from instalaciones where not coalesce(p_solo_locales, false) or tipo = 'local' order by ultima desc limit 2000) i
$$;

create or replace function public.srv_admin_resumen() returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object(
    'usuarios', (select count(*) from auth.users),
    'usuarios_7d', (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'activos_7d', (select count(*) from auth.users where last_sign_in_at > now() - interval '7 days'),
    'negocios', (select count(*) from negocios),
    'pagadas', (select count(*) from subscriptions where status = 'active' and source <> 'trial' and expiry_date > now()),
    'prueba', (select count(*) from subscriptions where status = 'active' and source = 'trial' and expiry_date > now()),
    'vencidas', (select count(*) from subscriptions where status in ('expired') or (status = 'active' and expiry_date <= now())),
    'pagos_revision', (select count(*) from payment_records where status = 'review'),
    'soporte_abiertos', (select count(*) from soporte_casos where estado = 'abierto'),
    'equipos', (select count(*) from instalaciones),
    'equipos_30d', (select count(*) from instalaciones where ultima > now() - interval '30 days'),
    'equipos_locales', (select count(*) from instalaciones where tipo = 'local'),
    'licencias_activas', (select count(*) from licencias where estado = 'activa'),
    'recientes', coalesce((select jsonb_agg(jsonb_build_object('id', u.id, 'email', u.email, 'creado_en', u.created_at,
        'negocio', (select n.nombre from miembros m join negocios n on n.id = m.negocio_id where m.usuario_id = u.id order by m.creado_en limit 1)) order by u.created_at desc)
      from (select * from auth.users order by created_at desc limit 8) u), '[]'::jsonb))
$$;

create or replace function public.srv_soporte_lista(p_estado text default 'abiertos') returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select coalesce(jsonb_agg(soporte_caso_pub(c, true) order by (c.estado = 'abierto') desc, c.actualizado_en desc), '[]'::jsonb)
  from (select * from soporte_casos
         where coalesce(p_estado, 'abiertos') = 'todos' or (p_estado = 'abiertos' and estado <> 'cerrado') or estado = p_estado
         order by actualizado_en desc limit 500) c
$$;

create or replace function public.srv_soporte_responder(p_caso uuid, p_texto text, p_estado text, p_admin uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare c soporte_casos%rowtype;
begin
  if p_admin is null or not srv_admin_es(p_admin) then raise exception 'sin_permiso'; end if;
  select * into c from soporte_casos where id = p_caso for update;
  if not found then raise exception 'no_existe'; end if;
  if char_length(trim(coalesce(p_texto, ''))) > 0 then
    if char_length(p_texto) > 2000 then raise exception 'mensaje_invalido'; end if;
    insert into soporte_mensajes(caso_id, autor, admin_id, texto) values (p_caso, 'admin', p_admin, trim(p_texto));
  end if;
  update soporte_casos set
      estado = case when p_estado in ('abierto','respondido','cerrado') then p_estado
                    when char_length(trim(coalesce(p_texto, ''))) > 0 then 'respondido' else estado end,
      visto_admin = now(), actualizado_en = case when char_length(trim(coalesce(p_texto, ''))) > 0 then now() else actualizado_en end
    where id = p_caso returning * into c;
  return soporte_caso_pub(c, true);
end $$;

-- Al poner una contraseña temporal, la app pide cambiarla al entrar.
create or replace function public.srv_marcar_cambiar_clave(p_usuario uuid, p_si boolean) returns void
language sql security definer set search_path = public, extensions as $$
  insert into perfiles(usuario_id, cambiar_clave) values (p_usuario, p_si)
  on conflict (usuario_id) do update set cambiar_clave = excluded.cambiar_clave, actualizado_en = now()
$$;

-- Negocio para una cuenta creada por el administrador.
create or replace function public.srv_negocio_crear(p_usuario uuid, p_nombre text) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare n uuid;
begin
  insert into negocios(nombre, creado_por) values (left(coalesce(nullif(trim(p_nombre), ''), 'Mi negocio'), 80), p_usuario) returning id into n;
  insert into miembros(negocio_id, usuario_id, rol, email) values (n, p_usuario, 'dueno', (select lower(email) from auth.users where id = p_usuario));
  insert into datos_negocio(negocio_id, datos, version, actualizado_por) values (n, '{}'::jsonb, 1, p_usuario);
  return n;
end $$;

-- ---------- Permisos ----------
do $$
declare f text;
begin
  foreach f in array array[
    'public.srv_admin_es(uuid)', 'public.lic_pub(public.licencias)', 'public.srv_lic_crear(jsonb, uuid)', 'public.srv_lic_lista()',
    'public.srv_lic_correos(uuid, jsonb, jsonb, uuid)', 'public.srv_lic_revocar(uuid, boolean, uuid)',
    'public.srv_lic_activar(public.licencias, uuid, uuid, text)', 'public.srv_lic_canjear(text, uuid, uuid)', 'public.srv_lic_auto(uuid, uuid)',
    'public.srv_admin_usuarios(text, int)', 'public.srv_admin_usuario(uuid)', 'public.srv_admin_equipos(boolean)', 'public.srv_admin_resumen()',
    'public.srv_soporte_lista(text)', 'public.srv_soporte_responder(uuid, text, text, uuid)', 'public.srv_marcar_cambiar_clave(uuid, boolean)',
    'public.srv_negocio_crear(uuid, text)', 'public.soporte_caso_pub(public.soporte_casos, boolean)'] loop
    execute 'revoke all on function ' || f || ' from public, anon, authenticated';
    execute 'grant execute on function ' || f || ' to service_role';
  end loop;
  -- Con o sin cuenta (cada equipo, y soporte desde la pantalla de entrar).
  foreach f in array array['public.registrar_instalacion(jsonb)', 'public.soporte_crear(jsonb)', 'public.soporte_mis_casos(jsonb)',
    'public.soporte_escribir(uuid, text, text)', 'public.soporte_visto(uuid, text)', 'public.soporte_puede(uuid, text)', 'public.es_correo_admin(text)'] loop
    execute 'revoke all on function ' || f || ' from public';
    execute 'grant execute on function ' || f || ' to anon, authenticated, service_role';
  end loop;
  -- Solo con la cuenta.
  foreach f in array array['public.perfil_yo()', 'public.perfil_guardar(jsonb)'] loop
    execute 'revoke all on function ' || f || ' from public, anon';
    execute 'grant execute on function ' || f || ' to authenticated, service_role';
  end loop;
end $$;
revoke all on public.admin_correos, public.instalaciones, public.perfiles, public.soporte_casos, public.soporte_mensajes,
  public.licencias, public.licencia_correos, public.licencia_usos from anon, authenticated;
