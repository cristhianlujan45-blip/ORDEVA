-- =====================================================================
-- ORDEVA 1.61.0 · Resumen diario de errores al celular del administrador
--   Una vez al día, desde las 8:00 a. m. (hora de Colombia), el repaso automático (cada 5 min, 20261102000000) pide
--   este resumen. La PRIMERA vez del día lo devuelve y queda anotado (servidor_config «resumen_errores»): así no se
--   manda dos veces aunque lleguen dos repasos juntos. El Servidor ORDEVA lo manda como notificación a los equipos del
--   administrador (las mismas de soporte y pagos). Sin errores en las últimas 24 horas no se manda nada.
--   p_forzar = true (botón «📨 Mandarme el resumen ahora» del panel): lo devuelve siempre, sin anotar.
--   Solo lee app_errores (nombre del error, equipos y negocios): ningún dato de ventas ni de clientes.
--   Sin borrar nada: solo una función.
-- =====================================================================

-- p_ahora: solo para las pruebas (la hora «de ahora»); el servidor no lo manda.
create or replace function public.srv_resumen_errores(p_forzar boolean default false, p_ahora timestamptz default null) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_hoy text := to_char(coalesce(p_ahora, now()) at time zone 'America/Bogota', 'YYYY-MM-DD');
  v_hora int := extract(hour from coalesce(p_ahora, now()) at time zone 'America/Bogota')::int;
  v_toca boolean;
begin
  if not coalesce(p_forzar, false) then
    if v_hora < 8 then return null; end if;
    insert into servidor_config as c (clave, valor) values ('resumen_errores', jsonb_build_object('fecha', v_hoy))
    on conflict (clave) do update set valor = excluded.valor where c.valor ->> 'fecha' is distinct from v_hoy
    returning true into v_toca;
    if not coalesce(v_toca, false) then return null; end if;
  end if;
  return (
    with dia as (
      select huella, (array_agg(mensaje order by ultimo desc))[1] mensaje, min(primero) primero,
             count(distinct equipo)::int equipos, count(distinct coalesce(negocio_id::text, negocio, equipo))::int negocios
      from app_errores where not resuelto and ultimo > now() - interval '24 hours' group by huella)
    select jsonb_build_object(
      'fecha', v_hoy,
      'nuevos', (select count(*) from dia where primero > now() - interval '24 hours')::int,
      'repetidos', (select count(*) from dia where primero <= now() - interval '24 hours')::int,
      'varios_negocios', (select count(*) from dia where negocios > 1)::int,
      'abiertos', (select count(distinct huella) from app_errores where not resuelto)::int,
      'top', coalesce((select jsonb_agg(jsonb_build_object('mensaje', left(t.mensaje, 120), 'equipos', t.equipos, 'negocios', t.negocios) order by t.equipos desc, t.primero desc)
                       from (select * from dia order by equipos desc, primero desc limit 3) t), '[]'::jsonb)));
end $$;

revoke all on function public.srv_resumen_errores(boolean, timestamptz) from public, anon, authenticated;
grant execute on function public.srv_resumen_errores(boolean, timestamptz) to service_role;
