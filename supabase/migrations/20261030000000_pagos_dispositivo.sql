-- =====================================================================
--  Vento · Los pagos le llegan a TODOS los equipos aunque estén bloqueados (1.48.0)
--
--  La app Android de cada equipo pregunta cada pocos segundos, desde su servicio de fondo y sin depender de la página
--  (que Android duerme con el celular bloqueado), si hay pagos nuevos del negocio. Entra con el token del celular
--  autorizado (el mismo de los avisos), sin sesión: solo ve los pagos de SU negocio, y queda «visto hace X s» en
--  «📱 Celulares autorizados» (así se sabe qué equipos están escuchando).
--  de_dispositivo: el celular que leyó el aviso del banco (ese ya sonó allá y no se repite).
-- =====================================================================
create or replace function public.pagos_dispositivo(p_token text, p_desde timestamptz default null)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare d dispositivos%rowtype; r text; l jsonb;
begin
  if p_token is null or length(p_token) < 20 then return jsonb_build_object('ok', false, 'error', 'sin_token'); end if;
  select * into d from dispositivos where token_hash = encode(digest(p_token, 'sha256'), 'hex') and revocado_en is null;
  if not found then return jsonb_build_object('ok', false, 'error', 'dispositivo_no_autorizado'); end if;
  select rol into r from miembros where negocio_id = d.negocio_id and usuario_id = d.usuario_id;
  if r is null then return jsonb_build_object('ok', false, 'error', 'sin_permiso'); end if;
  update dispositivos set ultimo_visto = now() where id = d.id;
  select coalesce(jsonb_agg(x), '[]'::jsonb) into l from (
    select pago_publico(p) || jsonb_build_object('de_dispositivo',
        (select e.cuerpo->>'dispositivo' from pago_eventos e
          where e.negocio_id = p.negocio_id and e.recibido_en > now() - interval '3 hours'
            and p.referencia like 'AV-%' and e.huella like 'aviso:' || substr(p.referencia, 4) || '%' limit 1)) as x
      from pagos p
      where p.negocio_id = d.negocio_id
        and p.actualizado_en > greatest(coalesce(p_desde, now() - interval '10 minutes'), now() - interval '2 hours')
        and (p.estado = 'aprobado' or (p.estado = 'rechazado' and p.confianza = 'falso'))
      order by p.actualizado_en asc limit 30) s;
  return jsonb_build_object('ok', true, 'rol', r, 'dispositivo', d.id, 'ahora', now(), 'pagos', l);
end $$;

revoke all on function public.pagos_dispositivo(text, timestamptz) from public;
grant execute on function public.pagos_dispositivo(text, timestamptz) to anon, authenticated, service_role;
