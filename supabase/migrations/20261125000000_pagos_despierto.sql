-- =====================================================================
-- ORDEVA 1.72.6 · El servidor de pagos siempre despierto («que todo sea inmediato»)
--   El Servidor ORDEVA de pagos (Edge Function vento-pagos) se duerme si pasa un rato sin uso; el primer aviso de pago
--   después de un rato quieto tenía que esperar a que arrancara (puede ser uno o dos segundos más). Antes solo lo
--   despertaba el repaso de cobros cada 5 minutos. Ahora, cada minuto, una pregunta liviana a /vento-pagos/salud (no
--   consulta bancos ni toca datos) lo mantiene listo.
--   Solo funciones nuevas y una tarea programada nueva: no cambia tablas ni borra nada. Si este Supabase no tiene pg_net o
--   pg_cron, no hace nada (como los otros repasos).
-- =====================================================================
create or replace function public.vento_pagos_despierto()
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare c jsonb; u text; i bigint;
begin
  select valor into c from servidor_config where clave = 'repaso';
  u := rtrim(coalesce(c->>'url', ''), '/');
  if u !~ '^https?://' then return jsonb_build_object('ok', false, 'motivo', 'sin_config'); end if;
  if to_regprocedure('net.http_get(text,jsonb,jsonb,integer)') is null then return jsonb_build_object('ok', false, 'motivo', 'sin_pg_net'); end if;
  execute 'select net.http_get($1, $2, $3, $4)' into i using u || '/functions/v1/vento-pagos/salud', '{}'::jsonb, '{}'::jsonb, 10000;
  return jsonb_build_object('ok', true, 'pedido', i);
end $$;
revoke all on function public.vento_pagos_despierto() from public, anon, authenticated;
grant execute on function public.vento_pagos_despierto() to service_role;

do $$
begin
  if to_regprocedure('cron.schedule(text,text,text)') is null then
    raise notice 'Vento: este Supabase no tiene pg_cron: el servidor de pagos se despierta con el repaso de 5 minutos';
    return;
  end if;
  begin
    perform cron.schedule('vento-pagos-despierto', '* * * * *', 'select public.vento_pagos_despierto()');
  exception when others then raise notice 'Vento: no se pudo programar el despertador del servidor de pagos (%)', sqlerrm;
  end;
end $$;
