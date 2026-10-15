-- =====================================================================
--  Seguridad (revisión completa)
--  • Defensa en profundidad: las tablas del negocio NO aceptan escrituras directas de nadie de afuera (todo pasa por
--    funciones que revisan el rol); las visitas sin cuenta no las pueden ni leer. Antes RLS ya lo impedía, pero los
--    permisos sobraban: si alguien agregaba una política por error, quedaban abiertas.
--  • admin_correos con RLS (solo el servidor).
--  • Topes GLOBALES contra abuso sin cuenta (el «equipo» y el nombre del canal los pone quien llama):
--    canales en vivo, casos e imágenes de soporte y equipos nuevos.
--  Se puede volver a correr sin dañar nada.
-- =====================================================================

alter table public.admin_correos enable row level security;
revoke all on public.admin_correos from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['negocios', 'miembros', 'datos_negocio', 'invitaciones', 'respaldos', 'archivos_negocio'] loop
    execute 'revoke all on public.' || t || ' from anon';
    execute 'revoke insert, update, delete, truncate, references, trigger on public.' || t || ' from authenticated';
    execute 'grant select on public.' || t || ' to authenticated';
  end loop;
end $$;
grant update (nombre) on public.negocios to authenticated;   -- renombrar (política «negocios_renombrar»: dueño o administrador)

-- Las tablas de solo lectura del catálogo: lectura sí, escritura no.
revoke insert, update, delete, truncate on public.plans, public.entitlements, public.plan_entitlements from anon, authenticated;

create or replace function public.canal_publicar(p_canal text, p_cuerpo text, p_titulo text default null) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare m canal_mensajes%rowtype; n int;
begin
  if p_canal is null or p_canal !~ '^[A-Za-z0-9_-]{4,80}$' then raise exception 'canal_invalido'; end if;
  if p_cuerpo is null or char_length(p_cuerpo) > 32768 then raise exception 'mensaje_grande'; end if;
  -- Límite por canal: 240 mensajes por minuto (un negocio con mucho movimiento usa muchos menos).
  select count(*) into n from canal_mensajes where canal = p_canal and creado > now() - interval '1 minute';
  if n >= 240 then raise exception 'demasiados'; end if;
  -- Tope GLOBAL (cualquiera puede inventar nombres de canal): 6.000 mensajes por minuto en todo Vento.
  if (select count(*) from canal_mensajes where creado > now() - interval '1 minute') >= 6000 then raise exception 'demasiados'; end if;
  insert into canal_mensajes(canal, cuerpo, titulo) values (p_canal, p_cuerpo, left(nullif(trim(p_titulo), ''), 200)) returning * into m;
  -- Aviso al instante a quien escucha el canal (Realtime). Si el servidor no lo tiene, quien escucha igual revisa cada pocos segundos.
  begin
    perform realtime.send(jsonb_build_object('id', m.id), 'm', 'vc-' || p_canal, false);
  exception when others then null;
  end;
  -- Limpieza: los mensajes de más de 8 días se borran de vez en cuando.
  if m.id % 200 = 0 then delete from canal_mensajes where creado < now() - interval '8 days'; end if;
  return canal_pub(m);
end $$;

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
  -- El «equipo» lo dice el celular (se puede falsear): sin cuenta, además, un tope GLOBAL de 300 casos por hora.
  if v_uid is null and (select count(*) from soporte_casos where usuario_id is null and creado_en > now() - interval '1 hour') >= 300 then raise exception 'demasiados'; end if;
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

create or replace function public.registrar_instalacion(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v_eq text := left(trim(coalesce(p ->> 'equipo', '')), 64); v_neg uuid; v_uid uuid := auth.uid(); v_correo text;
begin
  if v_eq !~ '^[A-Za-z0-9_-]{6,64}$' then raise exception 'equipo_invalido'; end if;
  -- Equipos NUEVOS sin cuenta: máximo 500 por hora en todo Vento (nadie puede llenar la lista con equipos inventados).
  if auth.uid() is null and not exists (select 1 from instalaciones where equipo = v_eq)
     and (select count(*) from instalaciones where usuario_id is null and primera > now() - interval '1 hour') >= 500 then raise exception 'demasiados'; end if;
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

create or replace function public.srv_soporte_adjuntar(p_caso uuid, p_uid uuid, p_clave text, p_path text, p_tipo text, p_texto text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare c soporte_casos%rowtype; v_id bigint; v_txt text := left(nullif(trim(coalesce(p_texto, '')), ''), 2000);
begin
  if not srv_soporte_acceso(p_caso, p_uid, p_clave) then raise exception 'sin_permiso'; end if;
  if p_path is null or p_path !~ ('^soporte/' || p_caso::text || '/[0-9a-f-]{36}\.(jpg|png|webp)$') then raise exception 'imagen_invalida'; end if;
  -- Límite: 15 imágenes por caso cada hora (y los mensajes de siempre: 30 por hora).
  if (select count(*) from soporte_mensajes where caso_id = p_caso and adjunto is not null and creado_en > now() - interval '1 hour') >= 15 then raise exception 'demasiados'; end if;
  -- Sin cuenta: tope GLOBAL de 300 imágenes por hora (los casos sin cuenta se pueden crear sin conocer a nadie).
  if p_uid is null and (select count(*) from soporte_mensajes sm join soporte_casos sc on sc.id = sm.caso_id
                         where sc.usuario_id is null and sm.adjunto is not null and sm.creado_en > now() - interval '1 hour') >= 300 then raise exception 'demasiados'; end if;
  insert into soporte_mensajes(caso_id, autor, texto, adjunto, adjunto_tipo) values (p_caso, 'cliente', coalesce(v_txt, '📷 Imagen'), p_path, p_tipo) returning id into v_id;
  update soporte_casos set estado = 'abierto', actualizado_en = now(), visto_cliente = now() where id = p_caso returning * into c;
  return soporte_caso_pub(c, false) || jsonb_build_object('mensaje_id', v_id);
end $$;

-- ¿Es administrador de Vento? Por su cuenta (platform_admins) o por su correo (admin_correos). Por correo SOLO si:
--   • el correo está confirmado, y
--   • ese correo no quedó amarrado a OTRA cuenta: la primera vez que el administrador entra, su cuenta queda anotada
--     en admin_correos.usuario_id (eso no se borra aunque borren la cuenta). Así, aunque las cuentas se confirmen
--     solas, nadie puede crear (o volver a crear) una cuenta con el correo del administrador y entrar al panel.
alter table public.admin_correos add column if not exists usuario_id uuid;

create or replace function public.srv_admin_es(p_usuario uuid) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from platform_admins where user_id = p_usuario)
      or exists (select 1 from auth.users u join admin_correos a on a.email = lower(u.email)
                  where u.id = p_usuario and u.email_confirmed_at is not null and (a.usuario_id is null or a.usuario_id = u.id))
$$;

-- Agregar / amarrar: solo si ese usuario existe con ESE correo confirmado. Si el correo es de admin_correos, queda
-- amarrado a esta cuenta (si ya estaba amarrado a otra, no se agrega).
create or replace function public.srv_admin_agregar(p_usuario uuid, p_email text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_email text := lower(trim(coalesce(p_email, '')));
begin
  if not exists (select 1 from auth.users where id = p_usuario and lower(email) = v_email and email_confirmed_at is not null) then
    raise exception 'correo_sin_confirmar';
  end if;
  if exists (select 1 from admin_correos where email = v_email and usuario_id is not null and usuario_id <> p_usuario) then raise exception 'sin_permiso'; end if;
  update admin_correos set usuario_id = p_usuario where email = v_email and usuario_id is null;
  insert into platform_admins(user_id, email) values (p_usuario, v_email)
    on conflict (user_id) do update set email = excluded.email;
end $$;

-- Las cuentas que YA eran administradoras quedan amarradas desde ahora.
update public.admin_correos a set usuario_id = u.id from auth.users u
 where a.usuario_id is null and lower(u.email) = a.email and u.email_confirmed_at is not null
   and (exists (select 1 from platform_admins p where p.user_id = u.id));

do $$
declare f text;
begin
  foreach f in array array['public.srv_admin_es(uuid)', 'public.srv_admin_agregar(uuid, text)'] loop
    execute 'revoke all on function ' || f || ' from public, anon, authenticated';
    execute 'grant execute on function ' || f || ' to service_role';
  end loop;
end $$;
