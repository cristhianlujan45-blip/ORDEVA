-- =====================================================================
--  Soporte con FOTOS y PANTALLAZOS, y avisos al panel de Administrador
--  • Cada mensaje del cliente puede llevar una imagen (JPG/PNG/WebP, máx. 3 MB). La sube el SERVIDOR al bucket
--    privado «soporte» (ruta soporte/{caso}/{id}.{ext}); nadie la ve sin pasar por el servidor, y el panel la abre
--    con un enlace firmado que vence.
--  • Cada mensaje o imagen nueva del cliente avisa al instante al panel (Realtime «vs-admin», k = 'soporte') y,
--    por el servidor, con notificación push a los equipos del administrador (también con el panel cerrado).
--  Se puede volver a correr sin dañar nada.
-- =====================================================================

alter table public.soporte_mensajes add column if not exists adjunto text check (adjunto is null or adjunto ~ '^soporte/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$');
alter table public.soporte_mensajes add column if not exists adjunto_tipo text check (adjunto_tipo is null or adjunto_tipo in ('image/jpeg','image/png','image/webp'));
alter table public.soporte_casos add column if not exists avisado_en timestamptz;

-- Equipos del administrador que reciben notificaciones push (navegador / PWA).
create table if not exists public.admin_push (
  endpoint    text primary key check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  usuario_id  uuid not null references auth.users(id) on delete cascade,
  p256dh      text not null check (char_length(p256dh) <= 200),
  auth        text not null check (char_length(auth) <= 100),
  creado_en   timestamptz not null default now()
);
alter table public.admin_push enable row level security;
revoke all on public.admin_push from public, anon, authenticated;

-- Bucket privado de las imágenes de soporte (solo si este proyecto tiene Storage).
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets(id, name, public) values ('soporte', 'soporte', false) on conflict (id) do nothing;
    if exists (select 1 from information_schema.columns where table_schema = 'storage' and table_name = 'buckets' and column_name = 'file_size_limit') then
      execute 'update storage.buckets set file_size_limit = 3145728 where id = ''soporte''';
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'storage' and table_name = 'buckets' and column_name = 'allowed_mime_types') then
      execute 'update storage.buckets set allowed_mime_types = array[''image/jpeg'',''image/png'',''image/webp''] where id = ''soporte''';
    end if;
  end if;
end $$;

create or replace function public.soporte_caso_pub(c public.soporte_casos, p_admin boolean default false) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object('id', c.id, 'tipo', c.tipo, 'asunto', c.asunto, 'estado', c.estado, 'creado_en', c.creado_en,
      'actualizado_en', c.actualizado_en, 'nombre', c.nombre, 'negocio_nombre', coalesce(c.negocio_nombre, (select nombre from negocios where id = c.negocio_id)),
      'mensajes', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'autor', m.autor, 'texto', m.texto, 'creado_en', m.creado_en, 'adjunto', m.adjunto is not null) order by m.id)
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

-- ¿Quien llama (por su cuenta o con la clave del caso que guardó su equipo) puede escribir en ese caso?
create or replace function public.srv_soporte_acceso(p_caso uuid, p_uid uuid, p_clave text) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from soporte_casos c where c.id = p_caso
                  and ((p_uid is not null and c.usuario_id = p_uid) or (p_clave is not null and char_length(p_clave) >= 20 and c.clave = p_clave)))
$$;

-- Guarda una imagen del cliente (la ruta la pone el servidor después de subirla).
create or replace function public.srv_soporte_adjuntar(p_caso uuid, p_uid uuid, p_clave text, p_path text, p_tipo text, p_texto text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare c soporte_casos%rowtype; v_id bigint; v_txt text := left(nullif(trim(coalesce(p_texto, '')), ''), 2000);
begin
  if not srv_soporte_acceso(p_caso, p_uid, p_clave) then raise exception 'sin_permiso'; end if;
  if p_path is null or p_path !~ ('^soporte/' || p_caso::text || '/[0-9a-f-]{36}\.(jpg|png|webp)$') then raise exception 'imagen_invalida'; end if;
  -- Límite: 15 imágenes por caso cada hora (y los mensajes de siempre: 30 por hora).
  if (select count(*) from soporte_mensajes where caso_id = p_caso and adjunto is not null and creado_en > now() - interval '1 hour') >= 15 then raise exception 'demasiados'; end if;
  insert into soporte_mensajes(caso_id, autor, texto, adjunto, adjunto_tipo) values (p_caso, 'cliente', coalesce(v_txt, '📷 Imagen'), p_path, p_tipo) returning id into v_id;
  update soporte_casos set estado = 'abierto', actualizado_en = now(), visto_cliente = now() where id = p_caso returning * into c;
  return soporte_caso_pub(c, false) || jsonb_build_object('mensaje_id', v_id);
end $$;

-- Datos para avisar al administrador de un mensaje nuevo del cliente. Solo si el último mensaje del caso es del
-- cliente y de hace poco, y como mucho un aviso cada 20 s por caso (nadie puede llenar de avisos al administrador).
create or replace function public.srv_soporte_para_avisar(p_caso uuid, p_uid uuid, p_clave text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare c soporte_casos%rowtype; m soporte_mensajes%rowtype;
begin
  if not srv_soporte_acceso(p_caso, p_uid, p_clave) then return null; end if;
  select * into c from soporte_casos where id = p_caso for update;
  select * into m from soporte_mensajes where caso_id = p_caso order by id desc limit 1;
  if m.id is null or m.autor <> 'cliente' or m.creado_en < now() - interval '10 minutes' then return null; end if;
  if c.avisado_en is not null and c.avisado_en > now() - interval '20 seconds' then return null; end if;
  update soporte_casos set avisado_en = now() where id = p_caso;
  return jsonb_build_object('caso', c.id, 'asunto', c.asunto, 'nombre', c.nombre, 'negocio', coalesce(c.negocio_nombre, (select nombre from negocios where id = c.negocio_id)),
    'texto', m.texto, 'imagen', m.adjunto is not null);
end $$;

-- Imagen de un mensaje (para el panel: el servidor firma la ruta).
create or replace function public.srv_soporte_adjunto_de(p_mensaje bigint) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object('path', adjunto, 'tipo', adjunto_tipo) from soporte_mensajes where id = p_mensaje and adjunto is not null
$$;

-- Notificaciones push del administrador.
create or replace function public.srv_admin_push_guardar(p_admin uuid, p_endpoint text, p_p256dh text, p_auth text) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
begin
  if p_admin is null or not srv_admin_es(p_admin) then raise exception 'sin_permiso'; end if;
  if coalesce(p_endpoint, '') !~ '^https://' or char_length(p_endpoint) > 1000 or coalesce(p_p256dh, '') = '' or coalesce(p_auth, '') = '' then raise exception 'push_invalido'; end if;
  insert into admin_push(endpoint, usuario_id, p256dh, auth) values (p_endpoint, p_admin, left(p_p256dh, 200), left(p_auth, 100))
    on conflict (endpoint) do update set usuario_id = excluded.usuario_id, p256dh = excluded.p256dh, auth = excluded.auth, creado_en = now();
  -- Máximo 10 equipos por administrador (los más viejos se van).
  delete from admin_push where usuario_id = p_admin and endpoint in (select endpoint from admin_push where usuario_id = p_admin order by creado_en desc offset 10);
  return true;
end $$;
create or replace function public.srv_admin_push_lista() returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select coalesce(jsonb_agg(jsonb_build_object('endpoint', p.endpoint, 'keys', jsonb_build_object('p256dh', p.p256dh, 'auth', p.auth))), '[]'::jsonb)
  from admin_push p where srv_admin_es(p.usuario_id)
$$;
create or replace function public.srv_admin_push_borrar(p_endpoint text) returns void
language sql security definer set search_path = public, extensions as $$ delete from admin_push where endpoint = p_endpoint $$;

-- Aviso al instante al panel (Realtime «vs-admin») con cada mensaje nuevo de un cliente. Sin datos: el panel recarga.
create or replace function public.soporte_avisar_panel() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  begin
    perform realtime.send(jsonb_build_object('t', now(), 'k', 'soporte'), 'a', 'vs-admin', false);
  exception when others then null;
  end;
  return null;
end $$;
revoke all on function public.soporte_avisar_panel() from public, anon, authenticated;
drop trigger if exists soporte_mensajes_avisar on public.soporte_mensajes;
create trigger soporte_mensajes_avisar after insert on public.soporte_mensajes
  for each row when (new.autor = 'cliente') execute function public.soporte_avisar_panel();

do $$
declare f text;
begin
  foreach f in array array['public.soporte_caso_pub(public.soporte_casos, boolean)', 'public.srv_soporte_acceso(uuid, uuid, text)',
    'public.srv_soporte_adjuntar(uuid, uuid, text, text, text, text)', 'public.srv_soporte_para_avisar(uuid, uuid, text)',
    'public.srv_soporte_adjunto_de(bigint)', 'public.srv_admin_push_guardar(uuid, text, text, text)', 'public.srv_admin_push_lista()',
    'public.srv_admin_push_borrar(text)'] loop
    execute 'revoke all on function ' || f || ' from public, anon, authenticated';
    execute 'grant execute on function ' || f || ' to service_role';
  end loop;
end $$;
