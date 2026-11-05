-- ORDEVA 1.76.0 · 🔗 Calendario con Booking, Airbnb y otras plataformas (iCal), sin duplicados.
-- • EXPORTAR: Booking / Airbnb leen el calendario de cada habitación de ORDEVA (lo sirve la Edge Function vento-ical con
--   reservas_ical_exportar): solo fechas ocupadas, NUNCA datos del cliente.
-- • IMPORTAR: la app lee el calendario de Booking / Airbnb (por la Edge Function, que solo deja leer esas plataformas) y
--   llama reserva_ical_sincronizar: cada evento queda como una reserva (nota «ical:<fuente>:<uid>»). La restricción de la
--   tabla «reservas» sigue mandando: si un evento de afuera choca con una reserva de ORDEVA NO se guarda y se devuelve como
--   «choque» (doble reserva), para avisarle al dueño. Lo que la plataforma ya no trae (cancelado allá) se cancela aquí.

create or replace function public.reservas_ical_exportar(p_publico text, p_recurso text) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare c public.reservas_config;
begin
  if coalesce(p_publico, '') !~ '^[0-9a-f]{12}$' then raise exception 'no_disponible'; end if;
  select * into c from public.reservas_config where publico = p_publico;
  if not found then raise exception 'no_disponible'; end if;
  return jsonb_build_object('nombre', coalesce(c.nombre, ''), 'eventos', coalesce((
    select jsonb_agg(jsonb_build_object('uid', r.id, 'desde', r.desde, 'hasta', r.hasta, 'recurso', r.recurso_nombre) order by r.desde)
    from public.reservas r
    where r.negocio_id = c.negocio_id and r.recurso = p_recurso and r.estado in ('pendiente', 'confirmada', 'ocupada')
      and r.hasta > now() - interval '1 day' and r.desde < now() + interval '400 days'
  ), '[]'::jsonb));
end $$;

create or replace function public.reserva_ical_sincronizar(p_negocio uuid, p_recurso text, p_recurso_nombre text, p_fuente text, p_eventos jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  fuente text := left(regexp_replace(coalesce(p_fuente, 'Otra'), '[^[:alnum:] ._-]', '', 'g'), 30);
  pref text;
  e jsonb; uid text; d timestamptz; h timestamptz; v_nota text; r public.reservas;
  nuevas int := 0; cambiadas int := 0; canceladas int := 0; choques jsonb := '[]'::jsonb; vistos text[] := '{}';
begin
  if not public.es_miembro(p_negocio) then raise exception 'sin_permiso'; end if;
  if fuente = '' then fuente := 'Otra'; end if;
  pref := 'ical:' || fuente || ':';
  if jsonb_typeof(coalesce(p_eventos, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_eventos, '[]'::jsonb)) > 500 then raise exception 'eventos_invalidos'; end if;
  for e in select * from jsonb_array_elements(coalesce(p_eventos, '[]'::jsonb)) loop
    uid := left(coalesce(e->>'uid', ''), 200);
    begin d := (e->>'desde')::timestamptz; h := (e->>'hasta')::timestamptz; exception when others then continue; end;
    if uid = '' or d is null or h is null or h <= d or h < now() - interval '1 day' or h - d > interval '120 days' then continue; end if;
    v_nota := pref || uid; vistos := vistos || v_nota;
    select * into r from public.reservas x where x.negocio_id = p_negocio and x.recurso = p_recurso and x.nota = v_nota order by x.creado_en desc limit 1;
    begin
      if found and r.estado in ('pendiente', 'confirmada', 'ocupada') then
        if r.desde <> d or r.hasta <> h then
          update public.reservas x set desde = d, hasta = h, actualizado_en = now() where x.id = r.id;
          cambiadas := cambiadas + 1;
        end if;
      elsif not found or r.estado = 'cancelada' then
        insert into public.reservas(negocio_id, recurso, recurso_nombre, desde, hasta, estado, cliente, nota, origen, codigo, creado_por)
        values (p_negocio, p_recurso, left(p_recurso_nombre, 60), d, h, 'confirmada', left('🔗 ' || fuente, 80), v_nota, 'web', public.srv_reserva_codigo(), auth.uid());
        nuevas := nuevas + 1;
      end if;
    exception when exclusion_violation then
      choques := choques || jsonb_build_object('uid', uid, 'desde', d, 'hasta', h, 'con', public.srv_reserva_choque(p_negocio, p_recurso, d, h, null));
    end;
  end loop;
  -- Lo que la plataforma ya no trae (se canceló allá): se cancela aquí. Solo lo que no ha pasado.
  update public.reservas x set estado = 'cancelada', actualizado_en = now()
  where x.negocio_id = p_negocio and x.recurso = p_recurso and x.nota like pref || '%' and not (x.nota = any(vistos))
    and x.estado in ('pendiente', 'confirmada') and x.hasta > now();
  get diagnostics canceladas = row_count;
  if nuevas + cambiadas + canceladas > 0 then perform public.srv_negocio_avisar(p_negocio, 'reservas'); end if;
  return jsonb_build_object('ok', true, 'nuevas', nuevas, 'cambiadas', cambiadas, 'canceladas', canceladas, 'choques', choques);
end $$;

revoke all on function public.reservas_ical_exportar(text, text) from public;
revoke all on function public.reserva_ical_sincronizar(uuid, text, text, text, jsonb) from public;
grant execute on function public.reservas_ical_exportar(text, text) to anon, authenticated;
grant execute on function public.reserva_ical_sincronizar(uuid, text, text, text, jsonb) to authenticated;
