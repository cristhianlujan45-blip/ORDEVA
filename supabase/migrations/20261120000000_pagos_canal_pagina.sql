-- =====================================================================
-- ORDEVA 1.65.4 · El pago llega al mismo tiempo a TODOS los equipos: celulares, computador (programa de PC o navegador)
-- y tabletas. La página también escucha el aviso en vivo del servidor (20261119000000_pagos_al_instante.sql), no solo
-- la app Android, y para todos los roles (antes la caja y los empleados preguntaban cada 6 s).
--   pagos_canal_vivo: el canal secreto del negocio, solo para quien es miembro de ese negocio.
-- Sin borrar nada; se puede volver a correr.
-- =====================================================================
create or replace function public.pagos_canal_vivo(p_negocio uuid) returns text
language plpgsql security definer set search_path = public, extensions as $$
begin
  if p_negocio is null or not public.es_miembro(p_negocio) then raise exception 'sin_permiso'; end if;
  return 'vp-' || public.pagos_canal_de(p_negocio);
end $$;
revoke all on function public.pagos_canal_vivo(uuid) from public, anon;
grant execute on function public.pagos_canal_vivo(uuid) to authenticated, service_role;
