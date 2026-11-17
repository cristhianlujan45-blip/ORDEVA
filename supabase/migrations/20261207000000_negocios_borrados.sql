-- ORDEVA 1.99.16 · Copia de un negocio antes de borrarlo (.github/workflows/borrar-negocio.yml, solo con autorización
-- expresa del dueño). Guarda el negocio y todas sus filas en las tablas que lo usan, por si hay que devolverlo.
-- Sin políticas: solo el servidor la lee (nadie desde la app).
create table if not exists public.negocios_borrados (
  negocio_id uuid primary key,
  copia jsonb not null,
  borrado_en timestamptz not null default now(),
  motivo text
);
alter table public.negocios_borrados enable row level security;
revoke all on public.negocios_borrados from anon, authenticated;
