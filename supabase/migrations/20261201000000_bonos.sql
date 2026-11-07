-- ORDEVA 1.93.0 · 🎁 BONOS Y TARJETAS DE REGALO. El saldo vive en el SERVIDOR (no en el documento del negocio): así dos
-- cajas no pueden gastar el mismo bono al mismo tiempo. Solo AGREGA dos tablas y sus funciones; no toca nada más.
--   • bono_crear: el negocio vende un bono (código de 8, valor, a nombre de quién, vence en N meses).
--   • bono_ver: saldo y estado de un código.
--   • bono_redimir: paga con el bono (idempotente por «ref»: si la misma venta lo pide dos veces, se descuenta una sola).
--     Si el saldo no alcanza, usa lo que tiene (el resto se paga con otro medio).
--   • bono_devolver: si la venta se deshace, el saldo vuelve (una sola vez por ref).
--   • bono_lista: los bonos del negocio (para el panel).
-- Solo miembros del negocio; las tablas no se leen ni se escriben directo (RLS sin políticas).

create table if not exists public.bonos (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios(id) on delete cascade,
  codigo text not null,
  valor numeric not null check (valor > 0),
  saldo numeric not null check (saldo >= 0),
  cliente text,
  vence date,
  estado text not null default 'activo' check (estado in ('activo','anulado')),
  creado_por uuid,
  creado_en timestamptz not null default now(),
  unique (negocio_id, codigo)
);
create table if not exists public.bonos_movimientos (
  id bigserial primary key,
  bono_id uuid not null references public.bonos(id) on delete cascade,
  negocio_id uuid not null references public.negocios(id) on delete cascade,
  tipo text not null check (tipo in ('venta','redencion','devolucion','anulacion')),
  monto numeric not null,
  ref text,
  por uuid,
  creado_en timestamptz not null default now()
);
create unique index if not exists bonos_mov_ref_unico on public.bonos_movimientos(bono_id, tipo, ref) where ref is not null;
alter table public.bonos enable row level security;
alter table public.bonos_movimientos enable row level security;
revoke all on public.bonos, public.bonos_movimientos from public, anon, authenticated;

create or replace function public.bono_json(b public.bonos) returns jsonb language sql immutable set search_path = public as $$
  select jsonb_build_object('codigo', b.codigo, 'valor', b.valor, 'saldo', b.saldo, 'cliente', b.cliente, 'vence', b.vence, 'estado', b.estado, 'creado_en', b.creado_en,
    'vencido', b.vence is not null and b.vence < current_date)
$$;

create or replace function public.bono_crear(p_negocio uuid, p_valor numeric, p_cliente text, p_meses int) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare b public.bonos; c text; n int := 0;
begin
  if not public.es_miembro(p_negocio) then raise exception 'sin_permiso'; end if;
  if p_valor is null or p_valor <= 0 or p_valor > 100000000 then raise exception 'valor_invalido'; end if;
  loop
    c := upper(substr(translate(encode(gen_random_bytes(18), 'base64'), '+/=0O1Il', ''), 1, 8));
    n := n + 1;
    exit when length(c) = 8 and not exists (select 1 from public.bonos where negocio_id = p_negocio and codigo = c);
    if n > 20 then raise exception 'sin_codigo'; end if;
  end loop;
  insert into public.bonos(negocio_id, codigo, valor, saldo, cliente, vence, creado_por)
    values (p_negocio, c, round(p_valor), round(p_valor), left(nullif(trim(coalesce(p_cliente, '')), ''), 60),
      case when coalesce(p_meses, 0) > 0 then (current_date + make_interval(months => least(p_meses, 60)))::date end, auth.uid())
    returning * into b;
  insert into public.bonos_movimientos(bono_id, negocio_id, tipo, monto, por) values (b.id, p_negocio, 'venta', b.valor, auth.uid());
  return public.bono_json(b);
end $$;

create or replace function public.bono_ver(p_negocio uuid, p_codigo text) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare b public.bonos;
begin
  if not public.es_miembro(p_negocio) then raise exception 'sin_permiso'; end if;
  select * into b from public.bonos where negocio_id = p_negocio and codigo = upper(trim(p_codigo));
  if not found then return jsonb_build_object('ok', false, 'error', 'no_existe'); end if;
  return jsonb_build_object('ok', true, 'bono', public.bono_json(b));
end $$;

create or replace function public.bono_redimir(p_negocio uuid, p_codigo text, p_monto numeric, p_ref text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare b public.bonos; m public.bonos_movimientos; usar numeric;
begin
  if not public.es_miembro(p_negocio) then raise exception 'sin_permiso'; end if;
  if coalesce(trim(p_ref), '') = '' or length(p_ref) > 80 then raise exception 'ref_invalida'; end if;
  if p_monto is null or p_monto <= 0 then raise exception 'valor_invalido'; end if;
  select * into b from public.bonos where negocio_id = p_negocio and codigo = upper(trim(p_codigo)) for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'no_existe'); end if;
  -- La misma venta otra vez (dos toques, se cayó el internet y se reintentó): lo mismo de antes, sin descontar otra vez.
  select * into m from public.bonos_movimientos where bono_id = b.id and tipo = 'redencion' and ref = p_ref;
  if found then return jsonb_build_object('ok', true, 'usado', -m.monto, 'bono', public.bono_json(b), 'repetido', true); end if;
  if b.estado <> 'activo' then return jsonb_build_object('ok', false, 'error', 'anulado'); end if;
  if b.vence is not null and b.vence < current_date then return jsonb_build_object('ok', false, 'error', 'vencido', 'bono', public.bono_json(b)); end if;
  if b.saldo <= 0 then return jsonb_build_object('ok', false, 'error', 'sin_saldo', 'bono', public.bono_json(b)); end if;
  usar := least(b.saldo, round(p_monto));
  update public.bonos set saldo = saldo - usar where id = b.id returning * into b;
  insert into public.bonos_movimientos(bono_id, negocio_id, tipo, monto, ref, por) values (b.id, p_negocio, 'redencion', -usar, p_ref, auth.uid());
  return jsonb_build_object('ok', true, 'usado', usar, 'bono', public.bono_json(b));
end $$;

create or replace function public.bono_devolver(p_negocio uuid, p_ref text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare m public.bonos_movimientos; b public.bonos; n int := 0;
begin
  if not public.es_miembro(p_negocio) then raise exception 'sin_permiso'; end if;
  for m in select * from public.bonos_movimientos x where x.negocio_id = p_negocio and x.tipo = 'redencion' and x.ref = p_ref loop
    begin
      insert into public.bonos_movimientos(bono_id, negocio_id, tipo, monto, ref, por) values (m.bono_id, p_negocio, 'devolucion', -m.monto, p_ref, auth.uid());
      update public.bonos set saldo = saldo + (-m.monto) where id = m.bono_id returning * into b;
      n := n + 1;
    exception when unique_violation then null;   -- ya se había devuelto: una sola vez
    end;
  end loop;
  return jsonb_build_object('ok', true, 'devueltos', n);
end $$;

create or replace function public.bono_lista(p_negocio uuid) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select case when public.es_miembro(p_negocio) then coalesce((select jsonb_agg(public.bono_json(b) order by b.creado_en desc)
    from (select * from public.bonos where negocio_id = p_negocio order by creado_en desc limit 300) b), '[]'::jsonb) end
$$;

revoke all on function public.bono_json(public.bonos) from public, anon, authenticated;
revoke all on function public.bono_crear(uuid, numeric, text, int), public.bono_ver(uuid, text), public.bono_redimir(uuid, text, numeric, text),
  public.bono_devolver(uuid, text), public.bono_lista(uuid) from public, anon;
grant execute on function public.bono_crear(uuid, numeric, text, int), public.bono_ver(uuid, text), public.bono_redimir(uuid, text, numeric, text),
  public.bono_devolver(uuid, text), public.bono_lista(uuid) to authenticated;
