-- =====================================================================
--  Vento Nube · fotos y archivos del negocio, sincronizados entre todos los equipos de la cuenta
--  (fotos de productos, facturas escaneadas en HD, recibos de gastos y comprobantes de pago).
--  Antes quedaban solo en el celular donde se tomaron; ahora el celular y el computador ven los mismos.
--
--  Cada archivo va como texto (data URL) con su clave: «foto/<producto>», «rec/<id>», «rcpt/<id>».
--  Seguridad: igual que datos_negocio — solo los miembros del negocio pueden verlos; se guardan y se
--  borran por funciones que revisan que seas miembro. Máximo 6 MB por archivo.
--  Se puede volver a correr sin dañar nada.
-- =====================================================================

create table if not exists public.archivos_negocio (
  negocio_id      uuid not null references public.negocios(id) on delete cascade,
  clave           text not null check (char_length(clave) between 1 and 120),
  datos           text not null,
  tam             integer not null default 0,
  subido_por      uuid references auth.users(id) on delete set null,
  actualizado_en  timestamptz not null default now(),
  primary key (negocio_id, clave)
);

alter table public.archivos_negocio enable row level security;
drop policy if exists archivos_ver on public.archivos_negocio;
create policy archivos_ver on public.archivos_negocio for select using (public.es_miembro(negocio_id));

-- Guarda (o reemplaza) un archivo del negocio.
create or replace function public.guardar_archivo(p_negocio uuid, p_clave text, p_datos text)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
begin
  if auth.uid() is null then raise exception 'sin_sesion'; end if;
  if not public.es_miembro(p_negocio) then raise exception 'sin_permiso'; end if;
  if p_clave is null or p_clave !~ '^[A-Za-z0-9_./:-]{1,120}$' then raise exception 'clave_invalida'; end if;
  if p_datos is null or char_length(p_datos) = 0 or char_length(p_datos) > 6000000 then raise exception 'archivo_grande'; end if;
  insert into archivos_negocio(negocio_id, clave, datos, tam, subido_por, actualizado_en)
    values (p_negocio, p_clave, p_datos, char_length(p_datos), auth.uid(), now())
    on conflict (negocio_id, clave) do update
      set datos = excluded.datos, tam = excluded.tam, subido_por = excluded.subido_por, actualizado_en = now();
  return true;
end $$;

-- Borra un archivo (ej. se quitó la foto de un producto).
create or replace function public.borrar_archivo(p_negocio uuid, p_clave text)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
begin
  if auth.uid() is null then raise exception 'sin_sesion'; end if;
  if not public.es_miembro(p_negocio) then raise exception 'sin_permiso'; end if;
  delete from archivos_negocio where negocio_id = p_negocio and clave = p_clave;
  return true;
end $$;

revoke all on function public.guardar_archivo(uuid, text, text), public.borrar_archivo(uuid, text) from public, anon;
grant execute on function public.guardar_archivo(uuid, text, text), public.borrar_archivo(uuid, text) to authenticated;
grant select on public.archivos_negocio to authenticated;
