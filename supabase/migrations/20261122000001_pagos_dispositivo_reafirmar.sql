-- =====================================================================
-- ORDEVA 1.65.9 · Volver a dejar pagos_dispositivo como la última versión (la de 20261119000000_pagos_al_instante).
--   El despliegue de 1.65.9 falló porque dos migraciones tenían la misma versión (20261118000000: catalogo_codigos y
--   pagos_dispositivo_suena) y el CLI intentó aplicar otra vez pagos_dispositivo_suena. Si alguna parte de ese intento
--   quedó aplicada, pagos_dispositivo habría vuelto a la versión anterior (sin «vivo»). Esto la deja otra vez igual a
--   la de 20261119000000. Es «create or replace»: si no había cambiado nada, tampoco cambia nada. No borra datos.
-- =====================================================================
-- pagos_dispositivo: igual que 20261118000000, más «vivo» (el canal en vivo del negocio para la app Android).
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
    select pago_para(p, d.usuario_id) || jsonb_build_object('de_dispositivo',
        (select e.cuerpo->>'dispositivo' from pago_eventos e
          where e.negocio_id = p.negocio_id and e.recibido_en > now() - interval '3 hours'
            and p.referencia like 'AV-%' and e.huella like 'aviso:' || substr(p.referencia, 4) || '%' limit 1)) as x
      from pagos p
      where p.negocio_id = d.negocio_id
        and p.actualizado_en > greatest(coalesce(p_desde, now() - interval '10 minutes'), now() - interval '2 hours')
        and (p.estado = 'aprobado' or (p.estado = 'rechazado' and p.confianza = 'falso'))
      order by p.actualizado_en asc limit 30) s;
  return jsonb_build_object('ok', true, 'rol', r, 'dispositivo', d.id, 'suena', coalesce(d.suena, true),
    'vivo', 'vp-' || public.pagos_canal_de(d.negocio_id), 'ahora', now(), 'pagos', l);
end $$;

revoke all on function public.pagos_dispositivo(text, timestamptz) from public;
grant execute on function public.pagos_dispositivo(text, timestamptz) to anon, authenticated, service_role;
