-- =====================================================================
-- ORDEVA 1.65.0 · Catálogo compartido de códigos de barras (lo que ORDEVA ya aprendió)
--   Cuando un negocio enlaza un código de barras con un producto (al escanearlo por primera vez), ORDEVA guarda SOLO el
--   código y cómo se llama el producto: nombre, marca, tamaño y categoría. Nunca precios, costos, existencias ni nada del
--   negocio. Así el siguiente negocio que escanee esa misma gaseosa o ese mismo arroz ya lo encuentra con su nombre:
--   la canasta colombiana (códigos 770…) que las bases mundiales casi no tienen.
--   • catalogo_buscar(código): para cualquier usuario con sesión.
--   • catalogo_aportar(...): solo miembros de un negocio; máximo 300 aportes por hora por usuario. Si dos negocios lo
--     llaman distinto, se queda el nombre que más veces se ha puesto.
--   Tabla nueva con RLS y sin acceso directo (solo por las funciones). No toca nada de lo que ya existe.
-- =====================================================================

create table if not exists public.catalogo_codigos (
  codigo      text primary key check (codigo ~ '^[0-9A-Za-z-]{6,40}$'),
  nombre      text not null check (char_length(nombre) between 2 and 120),
  marca       text check (char_length(marca) <= 60),
  tamano      text check (char_length(tamano) <= 40),
  categoria   text check (char_length(categoria) <= 60),
  veces       int not null default 1,
  creado_en   timestamptz not null default now(),
  actualizado timestamptz not null default now()
);
alter table public.catalogo_codigos enable row level security;
revoke all on public.catalogo_codigos from anon, authenticated;

-- Las distintas formas en que lo han llamado (para quedarse con la más común).
create table if not exists public.catalogo_codigos_votos (
  codigo      text not null references public.catalogo_codigos(codigo) on delete cascade,
  nombre_n    text not null,
  nombre      text not null,
  marca       text,
  tamano      text,
  categoria   text,
  veces       int not null default 1,
  primary key (codigo, nombre_n)
);
alter table public.catalogo_codigos_votos enable row level security;
revoke all on public.catalogo_codigos_votos from anon, authenticated;

create table if not exists public.catalogo_aportes (
  id          bigserial primary key,
  usuario_id  uuid not null,
  creado_en   timestamptz not null default now()
);
create index if not exists catalogo_aportes_usuario_idx on public.catalogo_aportes (usuario_id, creado_en);
alter table public.catalogo_aportes enable row level security;
revoke all on public.catalogo_aportes from anon, authenticated;

create or replace function public.catalogo_buscar(p_codigo text) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select case when auth.uid() is null then null else (
    select jsonb_build_object('codigo', c.codigo, 'nombre', c.nombre, 'marca', c.marca, 'tamano', c.tamano, 'categoria', c.categoria, 'veces', c.veces)
    from catalogo_codigos c where c.codigo = trim(coalesce(p_codigo, ''))
  ) end
$$;
revoke all on function public.catalogo_buscar(text) from public, anon;
grant execute on function public.catalogo_buscar(text) to authenticated;

create or replace function public.catalogo_aportar(p_codigo text, p_nombre text, p_marca text default null, p_tamano text default null, p_categoria text default null)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
declare
  c text := trim(coalesce(p_codigo, ''));
  n text := left(regexp_replace(trim(coalesce(p_nombre, '')), '\s+', ' ', 'g'), 120);
  nn text; mejor record;
begin
  if auth.uid() is null then raise exception 'sin_sesion'; end if;
  if not exists (select 1 from miembros where usuario_id = auth.uid()) then raise exception 'sin_permiso'; end if;
  -- Solo códigos de producto (de barras o QR cortos) y nombres de verdad.
  if c !~ '^[0-9A-Za-z-]{6,40}$' or char_length(n) < 2 then return false; end if;
  if (select count(*) from catalogo_aportes where usuario_id = auth.uid() and creado_en > now() - interval '1 hour') >= 300 then raise exception 'demasiados'; end if;
  insert into catalogo_aportes(usuario_id) values (auth.uid());
  if random() < 0.02 then delete from catalogo_aportes where creado_en < now() - interval '2 days'; end if;

  nn := lower(regexp_replace(translate(n, 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun'), '[^A-Za-z0-9]+', ' ', 'g'));
  insert into catalogo_codigos(codigo, nombre, marca, tamano, categoria)
    values (c, n, left(nullif(trim(p_marca), ''), 60), left(nullif(trim(p_tamano), ''), 40), left(nullif(trim(p_categoria), ''), 60))
    on conflict (codigo) do update set veces = catalogo_codigos.veces + 1, actualizado = now();
  insert into catalogo_codigos_votos(codigo, nombre_n, nombre, marca, tamano, categoria)
    values (c, nn, n, left(nullif(trim(p_marca), ''), 60), left(nullif(trim(p_tamano), ''), 40), left(nullif(trim(p_categoria), ''), 60))
    on conflict (codigo, nombre_n) do update set veces = catalogo_codigos_votos.veces + 1,
      marca = coalesce(excluded.marca, catalogo_codigos_votos.marca), tamano = coalesce(excluded.tamano, catalogo_codigos_votos.tamano),
      categoria = coalesce(excluded.categoria, catalogo_codigos_votos.categoria);
  -- El nombre que queda es el que más veces se ha puesto.
  select * into mejor from catalogo_codigos_votos where codigo = c order by veces desc, nombre_n limit 1;
  update catalogo_codigos set nombre = mejor.nombre, marca = coalesce(mejor.marca, marca), tamano = coalesce(mejor.tamano, tamano), categoria = coalesce(mejor.categoria, categoria)
    where codigo = c;
  return true;
end $$;
revoke all on function public.catalogo_aportar(text, text, text, text, text) from public, anon;
grant execute on function public.catalogo_aportar(text, text, text, text, text) to authenticated;
