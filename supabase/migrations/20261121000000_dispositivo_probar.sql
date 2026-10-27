-- =====================================================================
-- ORDEVA 1.65.6 · «🔔 Probar» en cada equipo de «Celulares y dónde suenan los pagos»
--   El dueño o el administrador hace sonar un aviso de pago de PRUEBA en ESE equipo (también si está bloqueado): llega
--   por el mismo canal en vivo de los pagos (20261119000000_pagos_al_instante.sql) y solo lo atiende el equipo nombrado.
--   No crea ningún pago (no toca la caja, las cuentas ni la contabilidad). Respeta «🔕 NO SUENA»: así se comprueba que
--   apagar y volver a prender el sonido de un equipo funciona. Lleva «s» (si ese equipo suena, según el servidor): así el
--   celular no depende de su última pregunta (cada 2,5 s) si el dueño lo acaba de cambiar.
-- Sin borrar nada; se puede volver a correr.
-- =====================================================================
create or replace function public.dispositivo_probar(p_dispositivo uuid) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare d dispositivos%rowtype;
begin
  select * into d from dispositivos where id = p_dispositivo and revocado_en is null;
  if not found then raise exception 'no_existe'; end if;
  if coalesce(public.rol_en(d.negocio_id), '') not in ('dueno', 'admin') and d.usuario_id is distinct from auth.uid() then raise exception 'sin_permiso'; end if;
  begin
    perform realtime.send(jsonb_build_object('d', p_dispositivo::text, 's', coalesce(d.suena, true), 't', extract(epoch from now())), 'prueba', 'vp-' || public.pagos_canal_de(d.negocio_id), false);
  exception when others then return false;
  end;
  return true;
end $$;
revoke all on function public.dispositivo_probar(uuid) from public, anon;
grant execute on function public.dispositivo_probar(uuid) to authenticated, service_role;
