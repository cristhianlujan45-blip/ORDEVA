-- =====================================================================
-- Vento · Frases de pago que maneja el administrador desde Vento Admin (💜 Frases de pago)
-- Cuando un banco cambia la forma de escribir el aviso de un pago, el administrador agrega aquí la frase («Abono a tu
-- DaviPlata» = es un pago; «Tu saldo es» = no es un pago) y le llega AL INSTANTE a la app de todos los negocios, sin
-- reinstalar nada: la app la consulta cuando le llega un aviso del banco que no entiende.
-- Solo frases (texto), nunca datos de nadie. Cualquier equipo las puede leer; solo el administrador las cambia.
-- =====================================================================

create table if not exists public.frases_pago (
  id          bigserial primary key,
  texto       text not null check (char_length(texto) between 3 and 120),
  tipo        text not null default 'pago' check (tipo in ('pago', 'ignorar')),
  banco       text check (char_length(banco) <= 40),
  activo      boolean not null default true,
  creado      timestamptz not null default now(),
  actualizado timestamptz not null default now()
);
create unique index if not exists frases_pago_texto on public.frases_pago (lower(texto));
alter table public.frases_pago enable row level security;

-- Para la app: las frases activas y la marca de la última actualización (si no cambió, no hay nada nuevo).
create or replace function public.frases_pago_lista() returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object(
    'v', coalesce((select extract(epoch from max(actualizado))::bigint from frases_pago), 0),
    'l', coalesce((select jsonb_agg(jsonb_build_object('t', texto, 'tipo', tipo, 'banco', banco) order by id) from frases_pago where activo), '[]'::jsonb))
$$;

-- Vento Admin (por el Servidor Vento, con la llave de servicio)
create or replace function public.srv_admin_frases_pago() returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'texto', texto, 'tipo', tipo, 'banco', banco, 'activo', activo, 'actualizado', actualizado) order by id desc), '[]'::jsonb) from frases_pago
$$;

create or replace function public.srv_admin_frase_pago_guardar(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_id bigint := nullif(p ->> 'id', '')::bigint;
  v_texto text := regexp_replace(trim(coalesce(p ->> 'texto', '')), '\s+', ' ', 'g');
  v_tipo text := case when p ->> 'tipo' = 'ignorar' then 'ignorar' else 'pago' end;
  v_banco text := nullif(left(trim(coalesce(p ->> 'banco', '')), 40), '');
  v_activo boolean := coalesce((p ->> 'activo')::boolean, true);
  v_fila frases_pago;
begin
  if char_length(v_texto) < 3 or char_length(v_texto) > 120 then raise exception 'frase_invalida' using hint = 'La frase debe tener entre 3 y 120 letras.'; end if;
  if v_id is null then
    insert into frases_pago (texto, tipo, banco, activo) values (v_texto, v_tipo, v_banco, v_activo)
      on conflict (lower(texto)) do update set tipo = excluded.tipo, banco = excluded.banco, activo = excluded.activo, actualizado = now()
      returning * into v_fila;
  else
    update frases_pago set texto = v_texto, tipo = v_tipo, banco = v_banco, activo = v_activo, actualizado = now() where id = v_id returning * into v_fila;
  end if;
  return to_jsonb(v_fila);
end $$;

create or replace function public.srv_admin_frase_pago_borrar(p_id bigint) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
begin
  delete from frases_pago where id = p_id;
  -- La marca de actualización también cambia al borrar (para que la app sepa que hay algo nuevo).
  update frases_pago set actualizado = now() where id = (select max(id) from frases_pago);
  return jsonb_build_object('ok', true);
end $$;

do $$
declare f text;
begin
  foreach f in array array['public.srv_admin_frases_pago()', 'public.srv_admin_frase_pago_guardar(jsonb)', 'public.srv_admin_frase_pago_borrar(bigint)'] loop
    execute 'revoke all on function ' || f || ' from public, anon, authenticated';
    execute 'grant execute on function ' || f || ' to service_role';
  end loop;
  execute 'revoke all on function public.frases_pago_lista() from public';
  execute 'grant execute on function public.frases_pago_lista() to anon, authenticated, service_role';
end $$;
