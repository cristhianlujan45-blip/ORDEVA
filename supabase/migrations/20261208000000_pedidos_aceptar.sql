-- ORDEVA 1.99.90 · 🛍️ Aceptar un pedido del QR UNA sola vez aunque lo acepten dos equipos a la vez.
-- En una tienda el pedido del QR espera a que alguien toque «✅ Aceptar». Con dos equipos abiertos, si los dos lo aceptaban
-- casi al mismo tiempo, cada uno lo sumaba a la cuenta: quedaba el doble (4 en vez de 2) y el inventario bajaba el doble.
-- Ahora el equipo que acepta lo «reclama» primero aquí: solo el primero lo suma a la cuenta; el otro solo lo marca aceptado
-- (lo sumado le llega con los datos del negocio). Tabla nueva (no toca nada de lo que ya existe), una fila por pedido.
create table if not exists public.pedidos_aceptados (
  negocio_id uuid not null references public.negocios(id) on delete cascade,
  pedido     text not null check (char_length(pedido) between 1 and 60),
  usuario_id uuid,
  creado_en  timestamptz not null default now(),
  primary key (negocio_id, pedido)
);
alter table public.pedidos_aceptados enable row level security;
revoke all on public.pedidos_aceptados from anon, authenticated;

-- true = este equipo es el primero (lo suma a la cuenta); false = otro ya lo aceptó.
create or replace function public.pedido_reclamar(p_negocio uuid, p_pedido text)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
begin
  if public.rol_en(p_negocio) is null then raise exception 'sin_permiso'; end if;
  if p_pedido is null or char_length(p_pedido) < 1 or char_length(p_pedido) > 60 then raise exception 'pedido_invalido'; end if;
  insert into public.pedidos_aceptados(negocio_id, pedido, usuario_id) values (p_negocio, p_pedido, auth.uid())
    on conflict (negocio_id, pedido) do nothing;
  return found;
end $$;
revoke all on function public.pedido_reclamar(uuid, text) from public, anon;
grant execute on function public.pedido_reclamar(uuid, text) to authenticated;
