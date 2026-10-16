-- =====================================================================
--  Soporte: el DIAGNÓSTICO del equipo va pegado al reporte, solo para el administrador
--  Cuando un cliente reporta algo, la app manda sola los códigos de error que registró ese equipo (E-XXXX), qué
--  pasó, dónde, cuántas veces, la versión y el equipo. El cliente NO lo ve (no sale en soporte_mis_casos); solo el
--  administrador de Vento (soporte_caso_pub con p_admin). Se puede volver a correr sin dañar nada.
-- =====================================================================
alter table public.soporte_casos add column if not exists diagnostico jsonb;

-- Lo que manda la app, recortado (nunca más de 12 KB ni campos raros).
create or replace function public.soporte_diag_limpio(p jsonb) returns jsonb
language plpgsql immutable as $$
declare e jsonb; l jsonb := '[]'::jsonb; n int := 0;
begin
  if p is null or jsonb_typeof(p) <> 'object' then return null; end if;
  if jsonb_typeof(p -> 'errores') = 'array' then
    for e in select * from jsonb_array_elements(p -> 'errores') loop
      exit when n >= 15;
      if jsonb_typeof(e) <> 'object' then continue; end if;
      l := l || jsonb_build_array(jsonb_build_object('cod', left(e ->> 'cod', 12), 'tipo', left(e ->> 'tipo', 20), 'msg', left(e ->> 'msg', 300),
        'donde', left(e ->> 'donde', 160), 'n', case when jsonb_typeof(e -> 'n') = 'number' then e -> 'n' end, 't', case when jsonb_typeof(e -> 't') = 'number' then e -> 't' end));
      n := n + 1;
    end loop;
  end if;
  return jsonb_build_object('errores', l, 'version', left(p ->> 'version', 40), 'plataforma', left(p ->> 'plataforma', 20),
    'pagina', left(p ->> 'pagina', 40), 'modelo', left(p ->> 'modelo', 120), 'vista', left(p ->> 'vista', 40), 'en', now());
end $$;

create or replace function public.soporte_crear(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare c soporte_casos%rowtype; v_uid uuid := auth.uid(); v_eq text := left(nullif(trim(p ->> 'equipo'), ''), 64);
  v_txt text := trim(coalesce(p ->> 'mensaje', '')); v_tipo text := coalesce(nullif(p ->> 'tipo', ''), 'ayuda'); v_neg uuid;
begin
  if char_length(v_txt) < 2 or char_length(v_txt) > 2000 then raise exception 'mensaje_invalido'; end if;
  if v_tipo not in ('ayuda','error','pago','clave','licencia','otro') then v_tipo := 'otro'; end if;
  if (select count(*) from soporte_casos where creado_en > now() - interval '1 day'
        and ((v_uid is not null and usuario_id = v_uid) or (v_eq is not null and equipo = v_eq))) >= 8 then raise exception 'demasiados'; end if;
  if v_uid is null and (select count(*) from soporte_casos where usuario_id is null and creado_en > now() - interval '1 hour') >= 300 then raise exception 'demasiados'; end if;
  if v_uid is not null then
    begin v_neg := nullif(p ->> 'negocio_id', '')::uuid; exception when others then v_neg := null; end;
    if v_neg is not null and not exists (select 1 from miembros where negocio_id = v_neg and usuario_id = v_uid) then v_neg := null; end if;
  end if;
  insert into soporte_casos(clave, usuario_id, negocio_id, equipo, email, telefono, nombre, negocio_nombre, tipo, asunto, diagnostico)
    values (encode(gen_random_bytes(18), 'hex'), v_uid, v_neg, v_eq,
            coalesce(lower((select email from auth.users where id = v_uid)), left(nullif(lower(trim(p ->> 'email')), ''), 120)),
            left(nullif(regexp_replace(coalesce(p ->> 'telefono', ''), '[^0-9+]', '', 'g'), ''), 20),
            left(nullif(trim(p ->> 'nombre'), ''), 80), left(nullif(trim(p ->> 'negocio'), ''), 80), v_tipo,
            left(coalesce(nullif(trim(p ->> 'asunto'), ''), left(v_txt, 80)), 120),
            case when octet_length(coalesce(p -> 'diagnostico', 'null'::jsonb)::text) <= 12000 then soporte_diag_limpio(p -> 'diagnostico') end)
    returning * into c;
  insert into soporte_mensajes(caso_id, autor, texto) values (c.id, 'cliente', v_txt);
  return jsonb_build_object('id', c.id, 'clave', c.clave, 'caso', soporte_caso_pub(c, false));
end $$;

-- Cuando el cliente vuelve a escribir en el caso, el diagnóstico se pone al día (los errores nuevos de ese equipo).
create or replace function public.soporte_diagnostico(p_caso uuid, p_clave text, p jsonb) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
begin
  if p is null or octet_length(p::text) > 12000 then return false; end if;
  update soporte_casos set diagnostico = soporte_diag_limpio(p)
    where id = p_caso and ((auth.uid() is not null and usuario_id = auth.uid()) or (p_clave is not null and clave = p_clave));
  return found;
end $$;
revoke all on function public.soporte_diagnostico(uuid, text, jsonb) from public;
grant execute on function public.soporte_diagnostico(uuid, text, jsonb) to anon, authenticated;
revoke all on function public.soporte_diag_limpio(jsonb) from public, anon, authenticated;

-- El administrador ve el diagnóstico en cada caso (el cliente no).
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
          'negocio_id', c.negocio_id, 'diagnostico', c.diagnostico,
          'telefono_perfil', (select telefono from perfiles where usuario_id = c.usuario_id),
          'cuenta_email', (select email from auth.users where id = c.usuario_id),
          'cuenta_por_correo', (select id from auth.users where lower(email) = lower(c.email) limit 1),
          'telefono_de_la_cuenta', (select p.telefono from auth.users u join perfiles p on p.usuario_id = u.id where lower(u.email) = lower(c.email) limit 1))
       else '{}'::jsonb end
$$;
