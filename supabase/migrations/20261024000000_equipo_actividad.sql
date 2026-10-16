-- =====================================================================
--  Equipo: rol «empleado» y ACTIVIDAD del equipo (huella de todo lo que se hace)
--  • Nuevo rol «empleado» (en la app se llama según el negocio: vendedor, médico, barbero, estilista, técnico…). Puede
--    vender y cobrar como el cajero; lo demás lo deciden los permisos que da el dueño en la app.
--  • El dueño puede tener un segundo administrador (rol «admin», solo lo da el dueño).
--  • ACTIVIDAD: cada venta, cambio de precio o de producto, inventario, gasto, lo que se quita de una cuenta, permisos…
--    de CADA persona queda en la tabla «auditoria» del servidor. Nadie la puede cambiar ni borrar (ni el administrador)
--    y SOLO EL DUEÑO la ve (actividad_ver), filtrada por persona.
--  Se puede volver a correr sin dañar nada.
-- =====================================================================

alter table public.miembros drop constraint if exists miembros_rol_check;
alter table public.miembros add constraint miembros_rol_check check (rol in ('dueno','admin','cajero','mesero','empleado'));
alter table public.invitaciones drop constraint if exists invitaciones_rol_check;
alter table public.invitaciones add constraint invitaciones_rol_check check (rol in ('admin','cajero','mesero','empleado'));

create or replace function public.crear_invitacion(p_negocio uuid, p_rol text)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare c text;
begin
  if public.rol_en(p_negocio) not in ('dueno','admin') then raise exception 'sin_permiso'; end if;
  if p_rol not in ('admin','cajero','mesero','empleado') then raise exception 'rol_invalido'; end if;
  if p_rol = 'admin' and public.rol_en(p_negocio) <> 'dueno' then raise exception 'sin_permiso'; end if;
  c := upper(substr(translate(encode(gen_random_bytes(9), 'base64'), '+/=0O1Il', ''), 1, 8));
  insert into invitaciones(codigo, negocio_id, rol, creado_por) values (c, p_negocio, p_rol, auth.uid());
  return c;
end $$;

create or replace function public.cambiar_rol(p_negocio uuid, p_usuario uuid, p_rol text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if public.rol_en(p_negocio) <> 'dueno' then raise exception 'sin_permiso'; end if;
  if p_usuario = auth.uid() then raise exception 'no_a_si_mismo'; end if;
  if p_rol not in ('admin','cajero','mesero','empleado') then raise exception 'rol_invalido'; end if;
  update miembros set rol = p_rol where negocio_id = p_negocio and usuario_id = p_usuario;
end $$;

create or replace function public.quitar_miembro(p_negocio uuid, p_usuario uuid)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare yo text := public.rol_en(p_negocio); el text;
begin
  select rol into el from miembros where negocio_id = p_negocio and usuario_id = p_usuario;
  if el is null then return; end if;
  if p_usuario = auth.uid() then
    if el = 'dueno' then raise exception 'dueno_no_sale'; end if;
  elsif yo = 'dueno' then null;
  elsif yo = 'admin' and el in ('cajero','mesero','empleado') then null;
  else raise exception 'sin_permiso';
  end if;
  delete from miembros where negocio_id = p_negocio and usuario_id = p_usuario;
end $$;

create or replace function public.pagos_puedo(p_negocio uuid, p_accion text)
returns text language plpgsql stable security definer set search_path = public, extensions as $$
declare r text := public.rol_en(p_negocio);
begin
  if r is null then raise exception 'sin_permiso'; end if;
  if p_accion = 'configurar' and r not in ('dueno','admin') then raise exception 'sin_permiso'; end if;
  if p_accion = 'cobrar' and r not in ('dueno','admin','cajero','mesero','empleado') then raise exception 'sin_permiso'; end if;
  return auth.uid()::text || ':' || r;
end $$;

create or replace function public.crear_cobro(p_negocio uuid, p_proveedor text, p_metodo text, p_canal text, p_monto bigint,
  p_mesa text default null, p_telefono text default null, p_clave text default null)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare r text := public.rol_en(p_negocio); p pagos%rowtype; ref text;
begin
  if r is null or r not in ('dueno','admin','cajero','mesero','empleado') then raise exception 'sin_permiso'; end if;
  if nullif(p_clave, '') is not null then
    select * into p from pagos where negocio_id = p_negocio and clave_idem = left(p_clave, 80);
    if found then return pago_publico(p) || jsonb_build_object('repetido', true); end if;
  end if;
  if p_proveedor not in ('wompi','nequi','daviplata') then raise exception 'proveedor_invalido'; end if;
  if p_canal not in ('link','push','qr','otp') then raise exception 'canal_invalido'; end if;
  -- DaviPlata (API oficial) solo cobra con código OTP, y el código OTP solo existe en DaviPlata.
  if (p_proveedor = 'daviplata') <> (p_canal = 'otp') then raise exception 'canal_invalido'; end if;
  if p_monto is null or p_monto < 100 or p_monto > 50000000 then raise exception 'monto_invalido'; end if;
  if not exists (select 1 from pago_proveedores where negocio_id = p_negocio and proveedor = p_proveedor and estado = 'conectado') then
    raise exception 'proveedor_no_conectado';
  end if;
  ref := 'VNT-' || to_char(now() at time zone 'America/Bogota', 'YYMMDD') || '-' || upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 10));
  insert into pagos(negocio_id, referencia, proveedor, metodo, canal, monto, mesa, telefono, creado_por, expira_en, proximo_intento, clave_idem)
    values (p_negocio, ref, p_proveedor, upper(coalesce(nullif(p_metodo, ''), 'OTRO')), p_canal, p_monto, left(p_mesa, 20),
            case when p_telefono is not null then '•••' || right(regexp_replace(p_telefono, '\D', '', 'g'), 4) end,
            auth.uid(), now() + interval '30 minutes', case when p_canal = 'otp' then null else now() + interval '20 seconds' end, left(nullif(p_clave, ''), 80))
    returning * into p;
  perform vento_auditar(p_negocio, auth.uid(), null, 'cobro_creado', jsonb_build_object('pago', p.id, 'proveedor', p_proveedor, 'canal', p_canal, 'monto', p_monto, 'mesa', p_mesa));
  return pago_publico(p);
end $$;

-- La actividad la ve SOLO el dueño (antes también el administrador): el segundo administrador no puede revisar ni
-- tapar lo suyo. Nadie la puede cambiar ni borrar.
drop policy if exists auditoria_ver on public.auditoria;
create policy auditoria_ver on public.auditoria for select to authenticated using (public.rol_en(negocio_id) = 'dueno');
revoke insert, update, delete, truncate on public.auditoria from anon, authenticated;
create index if not exists auditoria_negocio_usuario_idx on public.auditoria(negocio_id, usuario_id, creado_en desc);

-- La app manda lo que hace cada persona (en lotes). Cada evento: {a: acción, d: detalle, m: monto, u: usuario en la
-- app, t: hora del equipo (ms)}. Queda con la cuenta (auth.uid()) y el rol de quien lo hizo.
create or replace function public.actividad_registrar(p_negocio uuid, p_eventos jsonb) returns int
language plpgsql security definer set search_path = public, extensions as $$
declare r text := public.rol_en(p_negocio); e jsonb; n int := 0; v_hora int;
begin
  if auth.uid() is null then raise exception 'sin_sesion'; end if;
  if r is null then raise exception 'sin_permiso'; end if;
  if jsonb_typeof(p_eventos) <> 'array' or jsonb_array_length(p_eventos) > 100 then raise exception 'actividad_invalida'; end if;
  select count(*) into v_hora from auditoria where negocio_id = p_negocio and usuario_id = auth.uid() and creado_en > now() - interval '1 hour' and accion like 'app:%';
  if v_hora >= 3000 then raise exception 'demasiados'; end if;
  for e in select * from jsonb_array_elements(p_eventos) loop
    exit when n >= 100;
    if jsonb_typeof(e) <> 'object' or coalesce(trim(e ->> 'a'), '') = '' then continue; end if;
    insert into auditoria(negocio_id, usuario_id, accion, detalle)
      values (p_negocio, auth.uid(), 'app:' || left(trim(e ->> 'a'), 60),
              jsonb_build_object('d', left(coalesce(e ->> 'd', ''), 300), 'm', case when jsonb_typeof(e -> 'm') = 'number' then e -> 'm' end,
                                 'u', left(coalesce(e ->> 'u', ''), 60), 't', case when jsonb_typeof(e -> 't') = 'number' then e -> 't' end, 'rol', r));
    n := n + 1;
  end loop;
  return n;
end $$;

-- Ver la actividad (SOLO el dueño). Filtro opcional por persona y paginación hacia atrás.
create or replace function public.actividad_ver(p_negocio uuid, p_usuario uuid default null, p_antes bigint default null, p_limite int default 200) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if public.rol_en(p_negocio) is distinct from 'dueno' then raise exception 'sin_permiso'; end if;
  return jsonb_build_object(
    'eventos', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'accion', a.accion, 'detalle', a.detalle, 'creado_en', a.creado_en, 'usuario_id', a.usuario_id,
        'nombre', coalesce(m.nombre, u.email), 'email', u.email, 'rol', coalesce(m.rol, a.detalle ->> 'rol')) order by a.id desc)
      from (select * from auditoria where negocio_id = p_negocio and (p_usuario is null or usuario_id = p_usuario) and (p_antes is null or id < p_antes)
            order by id desc limit greatest(1, least(coalesce(p_limite, 200), 500))) a
      left join miembros m on m.negocio_id = p_negocio and m.usuario_id = a.usuario_id
      left join auth.users u on u.id = a.usuario_id), '[]'::jsonb),
    'personas', coalesce((select jsonb_agg(jsonb_build_object('usuario_id', m.usuario_id, 'nombre', coalesce(m.nombre, m.email), 'email', m.email, 'rol', m.rol) order by m.rol, m.email)
      from miembros m where m.negocio_id = p_negocio), '[]'::jsonb));
end $$;

do $$
declare f text;
begin
  foreach f in array array['public.actividad_registrar(uuid, jsonb)', 'public.actividad_ver(uuid, uuid, bigint, int)'] loop
    execute 'revoke all on function ' || f || ' from public, anon';
    execute 'grant execute on function ' || f || ' to authenticated, service_role';
  end loop;
end $$;
