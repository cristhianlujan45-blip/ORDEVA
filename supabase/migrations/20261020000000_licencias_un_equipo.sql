-- =====================================================================
--  Licencias ÚNICAS, de UN SOLO EQUIPO y que el cliente puede pasar a otro equipo
--  • Una licencia = un cliente: un solo uso y máximo un correo. Otra sede u otro negocio = otra licencia.
--  • Funciona en UN dispositivo: queda en el equipo que la activó. Los demás equipos del negocio ven
--    «Tu licencia está en otro equipo» (estado «otro_equipo», sin funciones).
--  • El dueño o administrador la pasa a su equipo nuevo (srv_lic_mover); el anterior queda bloqueado al instante
--    (tiempo real). Máximo un cambio cada 30 días.
--  • Solo licencias con código: los planes pagados por Nequi/DaviPlata o activados por el administrador siguen
--    sirviendo en todos los equipos del negocio.
--  Se puede volver a correr sin dañar nada.
-- =====================================================================

alter table public.licencia_usos add column if not exists equipo text check (equipo is null or equipo ~ '^[A-Za-z0-9_-]{6,64}$');
alter table public.licencia_usos add column if not exists movida_en timestamptz;
alter table public.licencia_usos add column if not exists cambios int not null default 0;

-- Las que ya existen con varios usos quedan con los usos que ya tuvieron (ninguna más se puede repartir).
update public.licencias l set usos_max = greatest(1, (select count(*) from public.licencia_usos u where u.licencia_id = l.id))
 where l.usos_max > 1;

-- Los cambios de signatura: se quitan las versiones viejas para no dejar dos funciones con el mismo nombre.
drop function if exists public.srv_lic_canjear(text, uuid, uuid);
drop function if exists public.srv_lic_auto(uuid, uuid);
drop function if exists public.srv_lic_activar(public.licencias, uuid, uuid, text);

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
        'email', u.email, 'hasta', u.hasta, 'creado_en', u.creado_en,
        'equipo', u.equipo, 'movida_en', u.movida_en, 'cambios', u.cambios) order by u.creado_en) from licencia_usos u where u.licencia_id = l.id), '[]'::jsonb))
$$;

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
  -- Única: un solo cliente (máximo un correo) y un solo uso.
  if coalesce(array_length(v_correos, 1), 0) > 1 then raise exception 'licencia_un_correo'; end if;
  v_usos := 1;
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
  if n > 1 then raise exception 'licencia_un_correo'; end if;   -- una licencia = un cliente
  select * into l from licencias where id = p_id;
  return lic_pub(l);
end $$;

create or replace function public.srv_lic_activar(l public.licencias, p_negocio uuid, p_usuario uuid, p_email text, p_equipo text default null) returns jsonb
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
  -- Queda en ESTE equipo (el que la activó). Solo funciona en un dispositivo; se puede pasar a otro (srv_lic_mover).
  insert into licencia_usos(licencia_id, negocio_id, usuario_id, email, hasta, equipo)
    values (l.id, p_negocio, p_usuario, v_email, v_hasta, case when coalesce(p_equipo, '') ~ '^[A-Za-z0-9_-]{6,64}$' then p_equipo end);
  perform vento_auditar(p_negocio, p_usuario, null, 'licencia_activada', jsonb_build_object('codigo', l.codigo, 'plan', l.plan_id, 'hasta', v_hasta));
  return jsonb_build_object('ok', true, 'codigo', l.codigo, 'plan_id', l.plan_id, 'hasta', v_hasta, 'subscription', v_sus);
end $$;

create or replace function public.srv_lic_canjear(p_codigo text, p_negocio uuid, p_usuario uuid, p_equipo text default null) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare l licencias%rowtype; v_email text := lower((select email from auth.users where id = p_usuario));
begin
  if not exists (select 1 from miembros where negocio_id = p_negocio and usuario_id = p_usuario and rol in ('dueno','admin')) then raise exception 'sin_permiso'; end if;
  select * into l from licencias where codigo = upper(regexp_replace(trim(coalesce(p_codigo, '')), '\s+', '', 'g')) for update;
  if not found then raise exception 'licencia_inexistente'; end if;
  return srv_lic_activar(l, p_negocio, p_usuario, v_email, p_equipo);
end $$;

create or replace function public.srv_lic_auto(p_negocio uuid, p_usuario uuid, p_equipo text default null) returns jsonb
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
      r := r || jsonb_build_array(srv_lic_activar(l, p_negocio, p_usuario, v_email, p_equipo));
    exception when others then null;   -- una que no se pueda (ej. ya usada en este negocio) no frena las demás
    end;
  end loop;
  return r;
end $$;

-- ¿Este equipo puede usar la licencia del negocio? Solo cuenta si el período ACTUAL de la suscripción es el de una
-- licencia con código (si después pagó por Nequi o el administrador le dio otro período, no aplica).
-- La primera vez que un equipo pregunta por una licencia sin equipo (las activadas antes de esta regla), queda en él.
create or replace function public.srv_lic_equipo(p_negocio uuid, p_equipo text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare s subscriptions%rowtype; u licencia_usos%rowtype; v_cod text;
  v_eq text := case when coalesce(p_equipo, '') ~ '^[A-Za-z0-9_-]{6,64}$' then p_equipo end;
begin
  select * into s from subscriptions where business_id = p_negocio;
  if not found or s.status <> 'active' or s.expiry_date <= now() or coalesce(s.external_id, '') not like 'lic:%' then
    return jsonb_build_object('ok', true, 'licencia', false);
  end if;
  v_cod := substr(s.external_id, 5);
  select x.* into u from licencia_usos x join licencias l on l.id = x.licencia_id
   where l.codigo = v_cod and x.negocio_id = p_negocio order by x.creado_en desc limit 1 for update of x;
  if not found or abs(extract(epoch from (u.hasta - s.expiry_date))) > 120 then return jsonb_build_object('ok', true, 'licencia', false); end if;
  if u.equipo is null then
    if v_eq is not null then update licencia_usos set equipo = v_eq where id = u.id; end if;
    return jsonb_build_object('ok', true, 'licencia', true, 'codigo', v_cod);
  end if;
  if u.equipo = v_eq then return jsonb_build_object('ok', true, 'licencia', true, 'codigo', v_cod); end if;
  return jsonb_build_object('ok', false, 'licencia', true, 'codigo', v_cod, 'desde', coalesce(u.movida_en, u.creado_en),
    'mover_desde', case when u.movida_en is null then now() else u.movida_en + interval '30 days' end);
end $$;

-- Pasar la licencia del negocio a ESTE equipo (dueño o administrador). El equipo anterior queda bloqueado al instante.
create or replace function public.srv_lic_mover(p_negocio uuid, p_usuario uuid, p_equipo text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare s subscriptions%rowtype; u licencia_usos%rowtype; v_cod text; v_antes text;
begin
  if coalesce(p_equipo, '') !~ '^[A-Za-z0-9_-]{6,64}$' then raise exception 'equipo_invalido'; end if;
  if not exists (select 1 from miembros where negocio_id = p_negocio and usuario_id = p_usuario and rol in ('dueno','admin')) then raise exception 'sin_permiso'; end if;
  select * into s from subscriptions where business_id = p_negocio for update;
  if not found or s.status <> 'active' or s.expiry_date <= now() or coalesce(s.external_id, '') not like 'lic:%' then raise exception 'sin_licencia'; end if;
  v_cod := substr(s.external_id, 5);
  select x.* into u from licencia_usos x join licencias l on l.id = x.licencia_id
   where l.codigo = v_cod and x.negocio_id = p_negocio order by x.creado_en desc limit 1 for update of x;
  if not found then raise exception 'sin_licencia'; end if;
  if u.equipo = p_equipo then return jsonb_build_object('ok', true, 'codigo', v_cod, 'repetido', true); end if;
  if u.movida_en is not null and u.movida_en > now() - interval '30 days' then raise exception 'licencia_cambio_reciente'; end if;
  v_antes := u.equipo;
  update licencia_usos set equipo = p_equipo, movida_en = now(), cambios = cambios + 1 where id = u.id;
  update subscriptions set updated_at = now() where id = s.id;   -- avisa al instante a todos los equipos (sub_avisar)
  perform vento_auditar(p_negocio, p_usuario, null, 'licencia_movida', jsonb_build_object('codigo', v_cod, 'de', v_antes, 'a', p_equipo));
  return jsonb_build_object('ok', true, 'codigo', v_cod, 'repetido', false, 'mover_desde', now() + interval '30 days');
end $$;

do $$
declare f text;
begin
  foreach f in array array['public.lic_pub(public.licencias)', 'public.srv_lic_crear(jsonb, uuid)', 'public.srv_lic_correos(uuid, jsonb, jsonb, uuid)',
    'public.srv_lic_activar(public.licencias, uuid, uuid, text, text)', 'public.srv_lic_canjear(text, uuid, uuid, text)', 'public.srv_lic_auto(uuid, uuid, text)',
    'public.srv_lic_equipo(uuid, text)', 'public.srv_lic_mover(uuid, uuid, text)'] loop
    execute 'revoke all on function ' || f || ' from public, anon, authenticated';
    execute 'grant execute on function ' || f || ' to service_role';
  end loop;
end $$;
