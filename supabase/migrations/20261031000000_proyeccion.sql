-- =====================================================================
--  Vento Nube · Fase A de la arquitectura de datos: PROYECCIÓN RELACIONAL del documento del negocio.
--  (puente/ARQUITECTURA-DATOS-FASE1.md, sección 6, y puente/ARQUITECTURA-DATOS-FASE-A.md)
--
--  Qué hace: copia a tablas de verdad (con claves, tipos, fechas en UTC y RLS por rol) lo que ya está en
--  datos_negocio.datos: categorías, productos, costos, ventas con sus ítems y pagos, movimientos de inventario y
--  cierres de caja. Las apps NO cambian: siguen leyendo y escribiendo el documento, que sigue siendo la fuente de
--  verdad. Estas tablas se llenan solas y sirven para reportes SQL, historial y la Fase 4-B.
--
--  Cómo se llena (sin tocar el guardado de la app: guardar_datos y datos_negocio quedan exactamente igual):
--    1. El repaso del Servidor Vento (cada 10 min, POST /sync con x-vento-cron) llama proyectar_pendientes(),
--       que compara datos_negocio.version con la última versión proyectada y proyecta los que cambiaron, con un
--       tope de tiempo para no colgar la petición. Solo lee el documento: nunca bloquea un guardado.
--    2. proyectar_negocio() es idempotente: correrla dos veces con el mismo documento no cambia nada. Usa el ID que
--       ya trae cada venta, producto o movimiento en el JSON, y una huella (md5) para reescribir solo lo que cambió.
--
--  No borra nada:
--    • lo que desaparece del documento queda marcado con eliminado_en / eliminada_en (borrado suave);
--    • los movimientos de inventario que la app recorta del documento (guarda los últimos 4000) se quedan aquí;
--    • solo se reescriben los ítems, pagos y costos de una venta cuya huella cambió (corrección o devolución),
--      para que reflejen exactamente el documento.
--  Si algo falla en un negocio, se anota el error en proyeccion_estado y los demás siguen.
--  Para apagarlo basta con no llamar proyectar_pendientes (quitar la línea en vento-pagos/app.ts): todo sigue igual.
-- =====================================================================

-- ---------- Ayudantes: conversiones que nunca fallan (el documento lo escriben los celulares) ----------
create or replace function public.vento_num(t text) returns numeric
language sql immutable set search_path = public, extensions as $$
  select case when t ~ '^\s*-?\d{1,13}(\.\d+)?\s*$' then round(t::numeric, 3) end
$$;

create or replace function public.vento_fecha(t text) returns timestamptz
language plpgsql stable set search_path = public, extensions as $$
begin
  if t is null then return null; end if;
  if t ~ '^\d{12,14}(\.\d+)?$' then return to_timestamp(t::numeric / 1000); end if;         -- milisegundos (Date.now())
  if t !~ '^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?)?(Z|[+-]\d{2}(:?\d{2})?)?$' then return null; end if;
  return t::timestamptz;
exception when others then return null;
end $$;

create or replace function public.vento_texto(t text, maximo int) returns text
language sql immutable set search_path = public, extensions as $$
  select nullif(left(trim(t), maximo), '')
$$;

-- Lo que no tiene columna propia se guarda tal cual en «extra», sin costos ni márgenes (los ve solo dueño/admin).
create or replace function public.vento_sin_costos(j jsonb) returns jsonb
language sql immutable set search_path = public, extensions as $$
  select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) from jsonb_each(case when jsonb_typeof(j) = 'object' then j else '{}'::jsonb end) x(k, v)
  where k !~* '(cost|costo|margen|margin)'
$$;

-- Lista del documento (si la clave no es una lista, una lista vacía).
create or replace function public.vento_lista(j jsonb) returns jsonb
language sql immutable set search_path = public, extensions as $$
  select case when jsonb_typeof(j) = 'array' then j else '[]'::jsonb end
$$;

-- ---------- Tablas ----------
create table if not exists public.proyeccion_estado (
  negocio_id          uuid primary key references public.negocios(id) on delete cascade,
  version_proyectada  bigint not null default 0,
  proyectado_en       timestamptz,
  intentado_en        timestamptz,
  duracion_ms         integer,
  filas               jsonb not null default '{}'::jsonb,
  error               text,
  intentos            integer not null default 0 check (intentos >= 0)
);

create table if not exists public.producto_categorias (
  negocio_id      uuid not null references public.negocios(id) on delete cascade,
  id              text not null check (char_length(id) between 1 and 200),
  nombre          text not null check (char_length(nombre) between 1 and 200),
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now(),
  eliminado_en    timestamptz,
  primary key (negocio_id, id)
);

create table if not exists public.productos (
  negocio_id      uuid not null references public.negocios(id) on delete cascade,
  id              text not null check (char_length(id) between 1 and 200),
  nombre          text not null check (char_length(nombre) between 1 and 300),
  tamano          text,
  categoria_id    text,
  precio          numeric(16,2),
  stock           numeric(16,3),
  stock_minimo    numeric(16,3),
  es_combo        boolean not null default false,
  codigos         text[] not null default '{}',
  extra           jsonb not null default '{}'::jsonb,
  huella          text not null,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now(),
  eliminado_en    timestamptz,
  primary key (negocio_id, id),
  foreign key (negocio_id, categoria_id) references public.producto_categorias(negocio_id, id)
);
create index if not exists productos_codigos_idx on public.productos using gin (codigos);

-- Aparte para que el mesero y el cajero no vean costos (RLS por tabla).
create table if not exists public.producto_costos (
  negocio_id      uuid not null,
  producto_id     text not null,
  costo           numeric(16,2),
  actualizado_en  timestamptz not null default now(),
  primary key (negocio_id, producto_id),
  foreign key (negocio_id, producto_id) references public.productos(negocio_id, id) on delete cascade
);

create table if not exists public.ventas (
  negocio_id      uuid not null references public.negocios(id) on delete cascade,
  id              text not null check (char_length(id) between 1 and 200),
  fecha           timestamptz not null,
  lugar           text not null check (lugar in ('mesa', 'mostrador', 'domicilio')),
  mesa            text,
  mesa_nombre     text,
  factura         text,
  persona         text,
  total           numeric(16,2) not null,
  deuda           numeric(16,2) not null default 0,
  cobro_por       text,
  extra           jsonb not null default '{}'::jsonb,
  huella          text not null,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now(),
  eliminada_en    timestamptz,
  primary key (negocio_id, id)
);
create index if not exists ventas_fecha_idx on public.ventas(negocio_id, fecha desc);

-- Precio y cantidad HISTÓRICOS de cada venta (como quedaron al cobrar, aunque después cambie el producto).
create table if not exists public.venta_items (
  negocio_id      uuid not null,
  venta_id        text not null,
  linea           integer not null check (linea >= 1),
  producto_nombre text not null,
  cantidad        numeric(16,3) not null,
  precio          numeric(16,2) not null,
  subtotal        numeric(16,2) generated always as (round(cantidad * precio, 2)) stored,
  unidad          text,
  persona         text,
  primary key (negocio_id, venta_id, linea),
  foreign key (negocio_id, venta_id) references public.ventas(negocio_id, id) on delete cascade
);

create table if not exists public.venta_costos (
  negocio_id      uuid not null,
  venta_id        text not null,
  linea           integer not null,
  costo           numeric(16,2),
  primary key (negocio_id, venta_id, linea),
  foreign key (negocio_id, venta_id, linea) references public.venta_items(negocio_id, venta_id, linea) on delete cascade
);

create table if not exists public.venta_pagos (
  negocio_id      uuid not null,
  venta_id        text not null,
  linea           integer not null check (linea >= 1),
  metodo          text not null check (char_length(metodo) between 1 and 60),
  monto           numeric(16,2) not null,
  nota            text,
  comprobante_id  text,
  primary key (negocio_id, venta_id, linea),
  foreign key (negocio_id, venta_id) references public.ventas(negocio_id, id) on delete cascade
);
create index if not exists venta_pagos_metodo_idx on public.venta_pagos(negocio_id, metodo);

create table if not exists public.inventario_movimientos (
  negocio_id      uuid not null references public.negocios(id) on delete cascade,
  id              text not null check (char_length(id) between 1 and 200),
  producto_id     text,
  producto_nombre text,
  tipo            text not null check (char_length(tipo) between 1 and 60),
  cantidad        numeric(16,3),
  unidad          text,
  usuario         text,
  fecha           timestamptz not null,
  extra           jsonb not null default '{}'::jsonb,
  creado_en       timestamptz not null default now(),
  primary key (negocio_id, id),
  foreign key (negocio_id, producto_id) references public.productos(negocio_id, id)
);
create index if not exists inventario_movimientos_fecha_idx on public.inventario_movimientos(negocio_id, fecha desc);
create index if not exists inventario_movimientos_producto_idx on public.inventario_movimientos(negocio_id, producto_id);

create table if not exists public.caja_cierres (
  negocio_id          uuid not null references public.negocios(id) on delete cascade,
  id                  text not null check (char_length(id) between 1 and 200),
  fecha               timestamptz not null,
  desde               timestamptz,
  tickets             integer,
  total_vendido       numeric(16,2),
  total_efectivo      numeric(16,2),
  total_transferencia numeric(16,2),
  total_debe          numeric(16,2),
  automatico          boolean not null default false,
  extra               jsonb not null default '{}'::jsonb,
  huella              text not null,
  creado_en           timestamptz not null default now(),
  actualizado_en      timestamptz not null default now(),
  eliminado_en        timestamptz,
  primary key (negocio_id, id)
);
create index if not exists caja_cierres_fecha_idx on public.caja_cierres(negocio_id, fecha desc);

-- ---------- RLS: solo lectura, y según el rol ----------
-- Catálogo (sin costos): todo el equipo. Ventas, pagos y caja: dueño, administrador y cajero.
-- Costos y estado de la proyección: dueño y administrador. Nadie escribe directo: solo las funciones de abajo.
alter table public.proyeccion_estado      enable row level security;
alter table public.producto_categorias    enable row level security;
alter table public.productos              enable row level security;
alter table public.producto_costos        enable row level security;
alter table public.ventas                 enable row level security;
alter table public.venta_items            enable row level security;
alter table public.venta_costos           enable row level security;
alter table public.venta_pagos            enable row level security;
alter table public.inventario_movimientos enable row level security;
alter table public.caja_cierres           enable row level security;

revoke insert, update, delete, truncate on public.proyeccion_estado, public.producto_categorias, public.productos,
  public.producto_costos, public.ventas, public.venta_items, public.venta_costos, public.venta_pagos,
  public.inventario_movimientos, public.caja_cierres from anon, authenticated;
revoke all on public.proyeccion_estado, public.producto_categorias, public.productos, public.producto_costos,
  public.ventas, public.venta_items, public.venta_costos, public.venta_pagos, public.inventario_movimientos,
  public.caja_cierres from anon;

drop policy if exists proyeccion_estado_ver on public.proyeccion_estado;
create policy proyeccion_estado_ver on public.proyeccion_estado for select using (public.rol_en(negocio_id) in ('dueno','admin'));
drop policy if exists producto_categorias_ver on public.producto_categorias;
create policy producto_categorias_ver on public.producto_categorias for select using (public.es_miembro(negocio_id));
drop policy if exists productos_ver on public.productos;
create policy productos_ver on public.productos for select using (public.es_miembro(negocio_id));
drop policy if exists producto_costos_ver on public.producto_costos;
create policy producto_costos_ver on public.producto_costos for select using (public.rol_en(negocio_id) in ('dueno','admin'));
drop policy if exists ventas_ver on public.ventas;
create policy ventas_ver on public.ventas for select using (public.rol_en(negocio_id) in ('dueno','admin','cajero'));
drop policy if exists venta_items_ver on public.venta_items;
create policy venta_items_ver on public.venta_items for select using (public.rol_en(negocio_id) in ('dueno','admin','cajero'));
drop policy if exists venta_costos_ver on public.venta_costos;
create policy venta_costos_ver on public.venta_costos for select using (public.rol_en(negocio_id) in ('dueno','admin'));
drop policy if exists venta_pagos_ver on public.venta_pagos;
create policy venta_pagos_ver on public.venta_pagos for select using (public.rol_en(negocio_id) in ('dueno','admin','cajero'));
drop policy if exists inventario_movimientos_ver on public.inventario_movimientos;
create policy inventario_movimientos_ver on public.inventario_movimientos for select using (public.rol_en(negocio_id) in ('dueno','admin','cajero'));
drop policy if exists caja_cierres_ver on public.caja_cierres;
create policy caja_cierres_ver on public.caja_cierres for select using (public.rol_en(negocio_id) in ('dueno','admin','cajero'));

-- ---------- Proyectar un negocio (idempotente) ----------
create or replace function public.proyectar_negocio(p_negocio uuid, p_lote integer default 1500)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  d jsonb; v bigint; t0 timestamptz := clock_timestamp();
  cambiadas text[]; prods_cambiados text[]; lote text[]; n_cand int; parcial boolean;
  n_cat int := 0; n_prod int := 0; n_venta int := 0; n_baja int := 0; n_mov int := 0; n_cierre int := 0;
  r jsonb;
begin
  perform pg_advisory_xact_lock(hashtext('vento-proyeccion'), hashtext(p_negocio::text));
  select datos, version into d, v from datos_negocio where negocio_id = p_negocio;
  if d is null then return null; end if;

  -- Categorías
  with src as (
    select distinct on (id) id, nombre from (
      select vento_texto(c->>'id', 200) id, coalesce(vento_texto(c->>'name', 200), '(sin nombre)') nombre, o
      from jsonb_array_elements(vento_lista(d->'categories')) with ordinality x(c, o) where jsonb_typeof(c) = 'object'
    ) s where id is not null order by id, o
  ), up as (
    insert into producto_categorias(negocio_id, id, nombre) select p_negocio, id, nombre from src
    on conflict (negocio_id, id) do update set nombre = excluded.nombre, actualizado_en = now(), eliminado_en = null
      where producto_categorias.nombre is distinct from excluded.nombre or producto_categorias.eliminado_en is not null
    returning 1
  ) select count(*) into n_cat from up;
  update producto_categorias c set eliminado_en = now(), actualizado_en = now()
    from (select id from producto_categorias where negocio_id = p_negocio and eliminado_en is null
          except select vento_texto(c->>'id', 200) from jsonb_array_elements(vento_lista(d->'categories')) c where jsonb_typeof(c) = 'object') x
    where c.negocio_id = p_negocio and c.id = x.id;

  -- Productos (y sus costos, en su tabla)
  with src as (
    select distinct on (id) id, p, md5(p::text) huella from (
      select vento_texto(p->>'id', 200) id, p, o
      from jsonb_array_elements(vento_lista(d->'products')) with ordinality x(p, o) where jsonb_typeof(p) = 'object'
    ) s where id is not null order by id, o
  ), up as (
    insert into productos(negocio_id, id, nombre, tamano, categoria_id, precio, stock, stock_minimo, es_combo, codigos, extra, huella)
    select p_negocio, id, coalesce(vento_texto(p->>'name', 300), '(sin nombre)'), vento_texto(p->>'size', 200),
      (select k.id from producto_categorias k where k.negocio_id = p_negocio and k.id = vento_texto(p->>'categoryId', 200)),
      vento_num(p->>'price'), vento_num(p->>'stock'), vento_num(p->>'minStock'),
      coalesce(jsonb_typeof(p->'combo') = 'array' and jsonb_array_length(p->'combo') > 0, false),
      coalesce((select array_agg(distinct left(trim(b), 120)) from jsonb_array_elements_text(vento_lista(p->'barcodes')) b where trim(b) <> ''), '{}'),
      vento_sin_costos(p) - array['id','name','size','categoryId','price','stock','minStock','barcodes'], huella
    from src
    on conflict (negocio_id, id) do update set nombre = excluded.nombre, tamano = excluded.tamano, categoria_id = excluded.categoria_id,
      precio = excluded.precio, stock = excluded.stock, stock_minimo = excluded.stock_minimo, es_combo = excluded.es_combo,
      codigos = excluded.codigos, extra = excluded.extra, huella = excluded.huella, actualizado_en = now(), eliminado_en = null
      where productos.huella is distinct from excluded.huella or productos.eliminado_en is not null
    returning id
  ) select coalesce(array_agg(id), '{}') into prods_cambiados from up;
  n_prod := cardinality(prods_cambiados);
  insert into producto_costos(negocio_id, producto_id, costo)
    select distinct on (vento_texto(p->>'id', 200)) p_negocio, vento_texto(p->>'id', 200), vento_num(p->>'cost')
    from jsonb_array_elements(vento_lista(d->'products')) with ordinality x(p, o)
    where jsonb_typeof(p) = 'object' and vento_texto(p->>'id', 200) = any(prods_cambiados)
    order by vento_texto(p->>'id', 200), o
  on conflict (negocio_id, producto_id) do update set costo = excluded.costo, actualizado_en = now()
    where producto_costos.costo is distinct from excluded.costo;
  update productos q set eliminado_en = now(), actualizado_en = now()
    from (select id from productos where negocio_id = p_negocio and eliminado_en is null
          except select vento_texto(p->>'id', 200) from jsonb_array_elements(vento_lista(d->'products')) p where jsonb_typeof(p) = 'object') x
    where q.negocio_id = p_negocio and q.id = x.id;

  -- Ventas. El historial se lee UNA vez a una tabla temporal; se escriben (cabecera, ítems, costos y pagos) solo las
  -- nuevas o cambiadas, y como máximo p_lote por llamada (las más recientes primero): la primera vez de un negocio con
  -- muchas ventas se hace en varias tandas sin pasarse del tiempo de la petición.
  create temporary table if not exists _vento_historial (id text primary key, e jsonb not null, huella text not null, o bigint not null) on commit drop;
  truncate _vento_historial;
  insert into _vento_historial
    select distinct on (id) id, e, md5(e::text), o from (
      select coalesce(vento_texto(e->>'id', 200), 'sin-id-' || md5(coalesce(e->>'date', '') || '|' || coalesce(e->>'total', '') || '|' || coalesce(e->>'invoiceNo', ''))) id, e, o
      from jsonb_array_elements(vento_lista(d->'history')) with ordinality x(e, o) where jsonb_typeof(e) = 'object'
    ) s order by id, o;
  with cand as (
    select h.id, h.o from _vento_historial h left join ventas q on q.negocio_id = p_negocio and q.id = h.id
    where q.id is null or q.huella is distinct from h.huella or q.eliminada_en is not null
  ) select (select count(*) from cand),
           coalesce((select array_agg(id order by o) from (select id, o from cand order by o limit greatest(1, coalesce(p_lote, 1500))) l), '{}')
    into n_cand, lote;
  parcial := n_cand > cardinality(lote);

  with up as (
    insert into ventas(negocio_id, id, fecha, lugar, mesa, mesa_nombre, factura, persona, total, deuda, cobro_por, extra, huella)
    select p_negocio, h.id, coalesce(vento_fecha(e->>'date'), vento_fecha(left(h.id, 13)), now()),
      case when jsonb_typeof(e->'delivery') = 'object' then 'domicilio' when coalesce(e->>'table', '') <> '' then 'mesa' else 'mostrador' end,
      vento_texto(e->>'table', 100), vento_texto(e->>'tableName', 200), vento_texto(e->>'invoiceNo', 60), vento_texto(e->>'person', 200),
      coalesce(vento_num(e->>'total'), 0), coalesce(vento_num(e->>'debt'), 0), vento_texto(e->>'by', 200),
      vento_sin_costos(e) - array['id','date','table','tableName','invoiceNo','person','total','debt','by','items','payments'], h.huella
    from _vento_historial h join unnest(lote) l(id) on l.id = h.id
    on conflict (negocio_id, id) do update set fecha = excluded.fecha, lugar = excluded.lugar, mesa = excluded.mesa, mesa_nombre = excluded.mesa_nombre,
      factura = excluded.factura, persona = excluded.persona, total = excluded.total, deuda = excluded.deuda, cobro_por = excluded.cobro_por,
      extra = excluded.extra, huella = excluded.huella, actualizado_en = now(), eliminada_en = null
      where ventas.huella is distinct from excluded.huella or ventas.eliminada_en is not null
    returning id
  ) select coalesce(array_agg(id), '{}') into cambiadas from up;
  n_venta := cardinality(cambiadas);

  if n_venta > 0 then
    delete from venta_items where negocio_id = p_negocio and venta_id = any(cambiadas);   -- se vuelven a escribir igual al documento
    delete from venta_pagos where negocio_id = p_negocio and venta_id = any(cambiadas);
    insert into venta_items(negocio_id, venta_id, linea, producto_nombre, cantidad, precio, unidad, persona)
      select p_negocio, h.id, i.o, coalesce(vento_texto(i.it->>'name', 300), '(sin nombre)'), coalesce(vento_num(i.it->>'qty'), 0),
        coalesce(vento_num(i.it->>'price'), 0), vento_texto(i.it->>'unidad', 20), vento_texto(i.it->>'person', 200)
      from _vento_historial h join unnest(cambiadas) c(id) on c.id = h.id, jsonb_array_elements(vento_lista(h.e->'items')) with ordinality i(it, o)
      where jsonb_typeof(i.it) = 'object';
    insert into venta_costos(negocio_id, venta_id, linea, costo)
      select p_negocio, h.id, i.o, vento_num(i.it->>'cost')
      from _vento_historial h join unnest(cambiadas) c(id) on c.id = h.id, jsonb_array_elements(vento_lista(h.e->'items')) with ordinality i(it, o)
      where jsonb_typeof(i.it) = 'object' and vento_num(i.it->>'cost') is not null;
    insert into venta_pagos(negocio_id, venta_id, linea, metodo, monto, nota, comprobante_id)
      select p_negocio, h.id, i.o, coalesce(vento_texto(i.pg->>'method', 60), 'efectivo'), coalesce(vento_num(i.pg->>'amount'), 0),
        vento_texto(i.pg->>'note', 300), vento_texto(i.pg->>'receiptId', 200)
      from _vento_historial h join unnest(cambiadas) c(id) on c.id = h.id, jsonb_array_elements(vento_lista(h.e->'payments')) with ordinality i(pg, o)
      where jsonb_typeof(i.pg) = 'object';
  end if;

  -- Ventas que ya no están en el documento (deshechas o borradas en la app): borrado suave
  with b as (
    update ventas q set eliminada_en = now(), actualizado_en = now()
      from (select id from ventas where negocio_id = p_negocio and eliminada_en is null except select id from _vento_historial) x
      where q.negocio_id = p_negocio and q.id = x.id returning 1
  ) select count(*) into n_baja from b;
  truncate _vento_historial;

  -- Movimientos de inventario: solo se agregan (la app recorta su lista; aquí quedan todos)
  with src as (
    select distinct on (id) id, m from (
      select vento_texto(m->>'id', 200) id, m, o
      from jsonb_array_elements(vento_lista(d->'inventarioMov')) with ordinality x(m, o) where jsonb_typeof(m) = 'object'
    ) s where id is not null order by id, o
  ), up as (
    insert into inventario_movimientos(negocio_id, id, producto_id, producto_nombre, tipo, cantidad, unidad, usuario, fecha, extra)
    select p_negocio, id,
      (select q.id from productos q where q.negocio_id = p_negocio and q.id = vento_texto(m->>'productId', 200)),
      vento_texto(m->>'name', 300), coalesce(vento_texto(m->>'tipo', 60), 'movimiento'), vento_num(m->>'qty'), vento_texto(m->>'unidad', 20),
      vento_texto(m->>'usuario', 200), coalesce(vento_fecha(m->>'at'), vento_fecha(m->>'date'), now()),
      vento_sin_costos(m) - array['id','productId','name','tipo','qty','unidad','usuario','at']
    from src
    on conflict (negocio_id, id) do nothing
    returning 1
  ) select count(*) into n_mov from up;

  -- Cierres de caja
  with src as (
    select distinct on (id) id, c, md5(c::text) huella from (
      select vento_texto(c->>'id', 200) id, c, o
      from jsonb_array_elements(vento_lista(d->'closures')) with ordinality x(c, o) where jsonb_typeof(c) = 'object'
    ) s where id is not null order by id, o
  ), up as (
    insert into caja_cierres(negocio_id, id, fecha, desde, tickets, total_vendido, total_efectivo, total_transferencia, total_debe, automatico, extra, huella)
    select p_negocio, id, coalesce(vento_fecha(c->>'date'), vento_fecha(left(id, 13)), now()), vento_fecha(c->>'from'),
      least(vento_num(c->>'ticketCount'), 2000000000)::integer, vento_num(c->>'totalSold'), vento_num(c->>'totalEfectivo'), vento_num(c->>'totalTransferencia'),
      vento_num(c->>'totalDebe'), coalesce(c->>'auto', '') = 'true',
      c - array['id','date','from','ticketCount','totalSold','totalEfectivo','totalTransferencia','totalDebe','auto','businessName'], huella
    from src
    on conflict (negocio_id, id) do update set fecha = excluded.fecha, desde = excluded.desde, tickets = excluded.tickets,
      total_vendido = excluded.total_vendido, total_efectivo = excluded.total_efectivo, total_transferencia = excluded.total_transferencia,
      total_debe = excluded.total_debe, automatico = excluded.automatico, extra = excluded.extra, huella = excluded.huella,
      actualizado_en = now(), eliminado_en = null
      where caja_cierres.huella is distinct from excluded.huella or caja_cierres.eliminado_en is not null
    returning 1
  ) select count(*) into n_cierre from up;
  update caja_cierres q set eliminado_en = now(), actualizado_en = now()
    from (select id from caja_cierres where negocio_id = p_negocio and eliminado_en is null
          except select vento_texto(c->>'id', 200) from jsonb_array_elements(vento_lista(d->'closures')) c where jsonb_typeof(c) = 'object') x
    where q.negocio_id = p_negocio and q.id = x.id;

  r := jsonb_build_object('version', v, 'categorias', n_cat, 'productos', n_prod, 'ventas', n_venta, 'ventas_eliminadas', n_baja,
                          'movimientos', n_mov, 'cierres', n_cierre, 'parcial', parcial, 'ventas_faltan', n_cand - cardinality(lote));
  -- Si quedaron ventas para la próxima tanda, la versión no se marca como proyectada (el repaso sigue).
  insert into proyeccion_estado(negocio_id, version_proyectada, proyectado_en, intentado_en, duracion_ms, filas, error, intentos)
    values (p_negocio, case when parcial then 0 else v end, case when parcial then null else now() end, now(),
            (extract(epoch from clock_timestamp() - t0) * 1000)::int, r, null, 0)
  on conflict (negocio_id) do update set
    version_proyectada = case when parcial then proyeccion_estado.version_proyectada else excluded.version_proyectada end,
    proyectado_en = coalesce(excluded.proyectado_en, proyeccion_estado.proyectado_en), intentado_en = excluded.intentado_en,
    duracion_ms = excluded.duracion_ms, filas = excluded.filas, error = null, intentos = 0;
  return r;
end $$;

-- ---------- Proyectar los negocios con versión nueva (lo llama el repaso del Servidor Vento) ----------
-- Con tope de negocios y de tiempo, para que la petición nunca se cuelgue. Un negocio con error se reintenta
-- después de un rato (cada vez más largo) sin frenar a los demás.
-- Seguro de espacio: si la base ya pesa más de p_tope_mb (el plan gratis de Supabase da 500 MB y al llenarse la deja
-- solo de lectura), no proyecta nada y lo dice: primero está que la app pueda seguir guardando.
create or replace function public.proyectar_pendientes(p_max integer default 20, p_segundos numeric default 4, p_tope_mb integer default 400)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  t0 timestamptz := clock_timestamp(); tope interval := make_interval(secs => coalesce(p_segundos, 4)::double precision);
  e record; r jsonb; listos int := 0; fallidos int := 0; quedan int; mb bigint := pg_database_size(current_database()) / 1048576;
begin
  if p_tope_mb is not null and mb > p_tope_mb then
    return jsonb_build_object('proyectados', 0, 'fallidos', 0, 'pausado', 'espacio', 'base_mb', mb, 'tope_mb', p_tope_mb);
  end if;
  for e in
    select dn.negocio_id from datos_negocio dn left join proyeccion_estado pe on pe.negocio_id = dn.negocio_id
    where coalesce(pe.version_proyectada, 0) < dn.version
      and (pe.error is null or pe.intentado_en < now() - least(interval '6 hours', interval '5 minutes' * power(2, least(pe.intentos, 10))))
    order by pe.intentado_en nulls first, dn.version - coalesce(pe.version_proyectada, 0) desc
    limit greatest(1, least(coalesce(p_max, 20), 200))
  loop
    exit when clock_timestamp() - t0 > tope and listos + fallidos > 0;
    begin
      loop   -- un negocio grande se proyecta por tandas mientras alcance el tiempo
        r := proyectar_negocio(e.negocio_id);
        exit when not coalesce((r->>'parcial')::boolean, false) or clock_timestamp() - t0 > tope;
      end loop;
      if not coalesce((r->>'parcial')::boolean, false) then listos := listos + 1; end if;
    exception when others then
      fallidos := fallidos + 1;
      insert into proyeccion_estado(negocio_id, error, intentos, intentado_en) values (e.negocio_id, left(sqlstate || ' ' || sqlerrm, 500), 1, now())
      on conflict (negocio_id) do update set error = excluded.error, intentos = proyeccion_estado.intentos + 1, intentado_en = now();
    end;
  end loop;
  select count(*) into quedan from datos_negocio dn left join proyeccion_estado pe on pe.negocio_id = dn.negocio_id
    where coalesce(pe.version_proyectada, 0) < dn.version;
  return jsonb_build_object('proyectados', listos, 'fallidos', fallidos, 'pendientes', quedan, 'base_mb', mb,
                            'ms', (extract(epoch from clock_timestamp() - t0) * 1000)::int);
end $$;

-- ---------- Permisos de las funciones ----------
revoke all on function public.proyectar_negocio(uuid, integer), public.proyectar_pendientes(integer, numeric, integer)
  from public, anon, authenticated;
grant execute on function public.proyectar_negocio(uuid, integer), public.proyectar_pendientes(integer, numeric, integer) to service_role;
grant execute on function public.vento_num(text), public.vento_fecha(text), public.vento_texto(text, int),
  public.vento_sin_costos(jsonb), public.vento_lista(jsonb) to anon, authenticated, service_role;
