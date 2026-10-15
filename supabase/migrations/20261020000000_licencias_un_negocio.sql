-- =====================================================================
--  Licencias ÚNICAS y UN negocio por cuenta
--  • Una licencia = un cliente y un negocio: un solo uso y máximo un correo. Las licencias viejas con varios usos
--    quedan con los usos que ya tuvieron (ninguna se puede seguir repartiendo).
--  • La suscripción o licencia sirve en TODOS los equipos del negocio a la vez (computador, tablet, celular…).
--  • Lo que no se puede: tener otro negocio u otra sede con la misma cuenta. Una cuenta es dueña de UN negocio;
--    otra sede = otra cuenta con su propia suscripción o licencia. Las cuentas que ya tenían varios los conservan.
--  Se puede volver a correr sin dañar nada.
-- =====================================================================

update public.licencias l set usos_max = greatest(1, (select count(*) from public.licencia_usos u where u.licencia_id = l.id))
 where l.usos_max > 1;

create or replace function public.crear_negocio(p_nombre text, p_datos jsonb, p_nombre_usuario text default null)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare n uuid;
begin
  if auth.uid() is null then raise exception 'sin_sesion'; end if;
  -- Un negocio por cuenta: la suscripción o licencia es de UN negocio (en todos sus equipos). Otra sede u otro negocio
  -- = otra cuenta con su propia suscripción. (Ser cajero/mesero/administrador en otro negocio sí se puede.)
  if exists (select 1 from miembros where usuario_id = auth.uid() and rol = 'dueno') then raise exception 'un_negocio_por_cuenta'; end if;
  insert into negocios(nombre, creado_por) values (left(coalesce(nullif(trim(p_nombre), ''), 'Mi negocio'), 80), auth.uid()) returning id into n;
  insert into miembros(negocio_id, usuario_id, rol, nombre, email)
    values (n, auth.uid(), 'dueno', left(p_nombre_usuario, 60), auth.jwt() ->> 'email');
  insert into datos_negocio(negocio_id, datos, version, actualizado_por) values (n, coalesce(p_datos, '{}'::jsonb), 1, auth.uid());
  return n;
end $$;

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
  -- Única: un solo cliente (máximo un correo), un solo uso = un solo negocio.
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
  -- Una licencia es de UN negocio, y una cuenta con licencia no la reparte: si esta cuenta ya activó otra licencia en
  -- OTRO negocio que sigue vigente, no se activa aquí (otra sede = otra cuenta y otra licencia).
  if exists (select 1 from licencia_usos u where lower(u.email) = v_email and v_email <> '' and u.negocio_id is distinct from p_negocio and u.hasta > now()
              and exists (select 1 from licencias x where x.id = u.licencia_id and x.estado = 'activa')) then raise exception 'un_negocio_por_cuenta'; end if;
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

create or replace function public.pasar_negocio_a(p_negocio uuid, p_email text) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare v_dest uuid;
begin
  if auth.uid() is null then raise exception 'sin_sesion'; end if;
  if not exists (select 1 from miembros where negocio_id = p_negocio and usuario_id = auth.uid() and rol = 'dueno') then raise exception 'sin_permiso'; end if;
  select id into v_dest from auth.users where lower(email) = lower(trim(coalesce(p_email, '')));
  if v_dest is null then raise exception 'no_existe'; end if;
  if v_dest = auth.uid() then return true; end if;
  -- La cuenta que recibe no puede quedar con dos negocios (un negocio por cuenta).
  if exists (select 1 from miembros where usuario_id = v_dest and rol = 'dueno' and negocio_id <> p_negocio) then raise exception 'un_negocio_por_cuenta'; end if;
  insert into miembros(negocio_id, usuario_id, rol, email) values (p_negocio, v_dest, 'dueno', lower(trim(p_email)))
    on conflict (negocio_id, usuario_id) do update set rol = 'dueno';
  update negocios set creado_por = v_dest where id = p_negocio;
  update subscriptions set user_id = v_dest where business_id = p_negocio;
  delete from miembros where negocio_id = p_negocio and usuario_id = auth.uid();
  perform vento_auditar(p_negocio, auth.uid(), null, 'negocio_pasado', jsonb_build_object('a', lower(trim(p_email))));
  return true;
end $$;

-- ¿Esta cuenta ya es dueña de un negocio? (la app lo pregunta antes de ofrecer «crear negocio» u «otra sede»)
create or replace function public.mi_negocio_propio() returns uuid
language sql stable security definer set search_path = public, extensions as $$
  select negocio_id from miembros where usuario_id = auth.uid() and rol = 'dueno' order by negocio_id limit 1
$$;

do $$
declare f text;
begin
  foreach f in array array['public.srv_lic_crear(jsonb, uuid)', 'public.srv_lic_correos(uuid, jsonb, jsonb, uuid)',
    'public.srv_lic_activar(public.licencias, uuid, uuid, text)'] loop
    execute 'revoke all on function ' || f || ' from public, anon, authenticated';
    execute 'grant execute on function ' || f || ' to service_role';
  end loop;
  foreach f in array array['public.crear_negocio(text, jsonb, text)', 'public.pasar_negocio_a(uuid, text)', 'public.mi_negocio_propio()'] loop
    execute 'revoke all on function ' || f || ' from public, anon';
    execute 'grant execute on function ' || f || ' to authenticated, service_role';
  end loop;
end $$;
