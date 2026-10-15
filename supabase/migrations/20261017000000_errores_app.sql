-- =====================================================================
-- Vento · errores que pasan en los equipos de los clientes → Vento Admin (🐞 Errores)
-- Cada equipo (con o sin cuenta) reporta lo que falla: errores de la página, música que no suena, pedidos por QR que
-- no llegan… Se agrupan por «huella» (el mismo error en el mismo equipo suma +1 en vez de repetirse), con límites para
-- que nadie pueda llenar la base. Solo el administrador de Vento los ve. No se guardan datos del negocio (ventas,
-- productos, clientes): solo el mensaje del error, la versión, el equipo y el nombre del negocio.
-- =====================================================================

create table if not exists public.app_errores (
  id            bigserial primary key,
  huella        text not null check (char_length(huella) between 4 and 200),
  tipo          text not null check (tipo in ('js', 'promesa', 'musica', 'pedido', 'pago', 'red', 'otro')),
  mensaje       text not null check (char_length(mensaje) <= 500),
  detalle       jsonb,
  pagina        text check (char_length(pagina) <= 40),
  equipo        text not null check (char_length(equipo) <= 64),
  negocio       text check (char_length(negocio) <= 80),
  negocio_id    uuid,
  usuario       text check (char_length(usuario) <= 120),
  usuario_id    uuid,
  version       text check (char_length(version) <= 40),
  plataforma    text check (char_length(plataforma) <= 40),
  modelo        text check (char_length(modelo) <= 120),
  veces         int not null default 1,
  primero       timestamptz not null default now(),
  ultimo        timestamptz not null default now(),
  resuelto      boolean not null default false,
  resuelto_en   timestamptz
);
create unique index if not exists app_errores_abierto on public.app_errores (huella, equipo) where not resuelto;
create index if not exists app_errores_ultimo on public.app_errores (ultimo desc);
create index if not exists app_errores_equipo on public.app_errores (equipo, ultimo desc);
alter table public.app_errores enable row level security;

-- Un equipo reporta un error. Nunca falla hacia la app (si algo no cuadra, se ignora en silencio).
create or replace function public.reportar_error(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_eq text := left(trim(coalesce(p ->> 'equipo', '')), 64);
  v_tipo text := lower(coalesce(p ->> 'tipo', 'otro'));
  v_msg text := left(trim(coalesce(p ->> 'mensaje', '')), 500);
  v_huella text := left(trim(coalesce(p ->> 'huella', '')), 200);
  v_veces int := greatest(1, least(coalesce((p ->> 'veces')::int, 1), 500));
  v_det jsonb := p -> 'detalle';
  v_uid uuid := auth.uid(); v_neg uuid; v_n int;
begin
  if v_eq !~ '^[A-Za-z0-9_-]{6,64}$' or v_msg = '' then return jsonb_build_object('ok', false); end if;
  if v_tipo not in ('js', 'promesa', 'musica', 'pedido', 'pago', 'red', 'otro') then v_tipo := 'otro'; end if;
  if char_length(v_huella) < 4 then v_huella := left(v_tipo || ':' || v_msg, 200); end if;
  if v_det is not null and (jsonb_typeof(v_det) <> 'object' or octet_length(v_det::text) > 4000) then v_det := jsonb_build_object('recortado', true); end if;
  -- Límites: un equipo no reporta más de 60 errores distintos por hora, y todo Vento no más de 3.000 por hora.
  select count(*) into v_n from app_errores where equipo = v_eq and ultimo > now() - interval '1 hour';
  if v_n >= 60 and not exists (select 1 from app_errores where huella = v_huella and equipo = v_eq and not resuelto) then return jsonb_build_object('ok', false, 'limite', true); end if;
  select count(*) into v_n from app_errores where primero > now() - interval '1 hour';
  if v_n >= 3000 then return jsonb_build_object('ok', false, 'limite', true); end if;
  if v_uid is not null then
    begin v_neg := nullif(p ->> 'negocio_id', '')::uuid; exception when others then v_neg := null; end;
    if v_neg is not null and not exists (select 1 from miembros where negocio_id = v_neg and usuario_id = v_uid) then v_neg := null; end if;
  end if;
  insert into app_errores as e (huella, tipo, mensaje, detalle, pagina, equipo, negocio, negocio_id, usuario, usuario_id, version, plataforma, modelo, veces)
    values (v_huella, v_tipo, v_msg, v_det, left(p ->> 'pagina', 40), v_eq, left(nullif(trim(p ->> 'negocio'), ''), 80), v_neg,
            left(nullif(trim(p ->> 'usuario'), ''), 120), v_uid, left(p ->> 'version', 40), left(p ->> 'plataforma', 40), left(p ->> 'modelo', 120), v_veces)
  on conflict (huella, equipo) where not resuelto do update set
    veces = least(e.veces + excluded.veces, 1000000), ultimo = now(), mensaje = excluded.mensaje,
    detalle = coalesce(excluded.detalle, e.detalle), version = coalesce(excluded.version, e.version),
    negocio = coalesce(excluded.negocio, e.negocio), negocio_id = coalesce(excluded.negocio_id, e.negocio_id),
    usuario = coalesce(excluded.usuario, e.usuario), usuario_id = coalesce(excluded.usuario_id, e.usuario_id);
  -- Lo resuelto hace más de 60 días se borra solo.
  if random() < 0.02 then delete from app_errores where resuelto and resuelto_en < now() - interval '60 days'; end if;
  return jsonb_build_object('ok', true);
end $$;

-- Vento Admin: errores agrupados por huella (cuántas veces, en cuántos equipos y negocios, la última versión…).
create or replace function public.srv_admin_errores(p_estado text default 'abiertos', p_limite int default 200) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select coalesce(jsonb_agg(g order by g.ultimo desc), '[]'::jsonb) from (
    select e.huella, max(e.tipo) tipo, (array_agg(e.mensaje order by e.ultimo desc))[1] mensaje,
           sum(e.veces)::int veces, count(distinct e.equipo)::int equipos, count(distinct coalesce(e.negocio_id::text, e.negocio, e.equipo))::int negocios,
           min(e.primero) primero, max(e.ultimo) ultimo, bool_and(e.resuelto) resuelto,
           (array_agg(e.version order by e.ultimo desc))[1] version, (array_agg(e.pagina order by e.ultimo desc))[1] pagina,
           (select jsonb_agg(x order by x.ultimo desc) from (
              select e2.equipo, e2.negocio, e2.usuario, e2.version, e2.plataforma, e2.modelo, e2.veces, e2.ultimo, e2.detalle, e2.resuelto
              from app_errores e2 where e2.huella = e.huella and (coalesce(p_estado, 'abiertos') = 'todos' or not e2.resuelto)
              order by e2.ultimo desc limit 20) x) casos
    from app_errores e
    where coalesce(p_estado, 'abiertos') = 'todos' or not e.resuelto
    group by e.huella
    order by max(e.ultimo) desc
    limit greatest(1, least(coalesce(p_limite, 200), 500))) g
$$;

create or replace function public.srv_admin_error_resolver(p_huella text, p_resuelto boolean default true) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v_n int;
begin
  if p_resuelto then
    update app_errores set resuelto = true, resuelto_en = now() where huella = p_huella and not resuelto;
  else
    -- Volver a abrir: solo la fila más reciente de cada equipo (las demás quedan en el historial).
    update app_errores set resuelto = false, resuelto_en = null
     where id in (select distinct on (equipo) id from app_errores where huella = p_huella order by equipo, ultimo desc)
       and not exists (select 1 from app_errores x where x.huella = p_huella and x.equipo = app_errores.equipo and not x.resuelto);
  end if;
  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', true, 'filas', v_n);
end $$;

create or replace function public.srv_admin_errores_abiertos() returns int
language sql stable security definer set search_path = public, extensions as $$
  select count(distinct huella)::int from app_errores where not resuelto
$$;

do $$
declare f text;
begin
  foreach f in array array['public.srv_admin_errores(text, int)', 'public.srv_admin_error_resolver(text, boolean)', 'public.srv_admin_errores_abiertos()'] loop
    execute 'revoke all on function ' || f || ' from public, anon, authenticated';
    execute 'grant execute on function ' || f || ' to service_role';
  end loop;
  execute 'revoke all on function public.reportar_error(jsonb) from public';
  execute 'grant execute on function public.reportar_error(jsonb) to anon, authenticated, service_role';
end $$;
revoke all on public.app_errores from anon, authenticated;
