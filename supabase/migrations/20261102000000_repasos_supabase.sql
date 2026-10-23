-- =====================================================================
--  Vento 1.53.1 · Los repasos automáticos corren DENTRO de Supabase (pg_cron + pg_net), no solo desde GitHub
--
--  Antes: el repaso (consultar cobros pendientes de Wompi/Nequi, reintentar facturas DIAN, vencer suscripciones y la
--  proyección a tablas) lo disparaba GitHub Actions «cada 10 minutos», pero GitHub lo corre cuando puede: el 23-10-2026
--  pasaron 5 horas y media entre uno y otro (02:20 → 07:52 UTC).
--  Ahora, cada 5 minutos, dentro de la base de datos:
--    • vento-proyeccion: select proyectar_pendientes(...)      (no sale de la base; no necesita ninguna clave)
--    • vento-repaso:     vento_repaso() → POST /vento-pagos/sync y /vento-suscripciones/vencer con la cabecera
--                        x-vento-cron. La dirección y el secreto los deja el propio Servidor Vento en servidor_config
--                        (tabla que ningún cliente puede leer) la primera vez que recibe un repaso autorizado: no están
--                        en el código ni en este archivo.
--  GitHub sigue como respaldo. Si este Supabase no tiene pg_cron o pg_net, la migración no falla: solo no programa.
--  Para apagarlo: select cron.unschedule('vento-repaso'); select cron.unschedule('vento-proyeccion');
-- =====================================================================

-- Lanza los repasos del Servidor Vento por HTTP (pg_net, asíncrono: no espera la respuesta).
create or replace function public.vento_repaso()
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare c jsonb; u text; s text; ids bigint[] := '{}'; i bigint;
begin
  select valor into c from servidor_config where clave = 'repaso';
  u := rtrim(coalesce(c->>'url', ''), '/'); s := coalesce(c->>'secreto', '');
  if u !~ '^https?://' or length(s) < 16 then return jsonb_build_object('ok', false, 'motivo', 'sin_config'); end if;
  if to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is null then return jsonb_build_object('ok', false, 'motivo', 'sin_pg_net'); end if;
  foreach u in array array[u || '/functions/v1/vento-pagos/sync', u || '/functions/v1/vento-suscripciones/vencer'] loop
    execute 'select net.http_post($1, $2, $3, $4, $5)' into i
      using u, '{}'::jsonb, '{}'::jsonb, jsonb_build_object('content-type', 'application/json', 'x-vento-cron', s), 55000;
    ids := ids || i;
  end loop;
  return jsonb_build_object('ok', true, 'pedidos', to_jsonb(ids));
end $$;
revoke all on function public.vento_repaso() from public, anon, authenticated;
grant execute on function public.vento_repaso() to service_role;

-- El Servidor Vento deja aquí la dirección y el secreto del repaso (solo service_role).
create or replace function public.srv_repaso_config(p_url text, p_secreto text)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
declare v jsonb := jsonb_build_object('url', rtrim(p_url, '/'), 'secreto', p_secreto);
begin
  if p_url !~ '^https?://' or length(coalesce(p_secreto, '')) < 16 then return false; end if;
  if (select valor from servidor_config where clave = 'repaso') = v then return false; end if;
  insert into servidor_config(clave, valor) values ('repaso', v) on conflict (clave) do update set valor = excluded.valor;
  return true;
end $$;
revoke all on function public.srv_repaso_config(text, text) from public, anon, authenticated;
grant execute on function public.srv_repaso_config(text, text) to service_role;

-- Programar (si se puede). Cada paso por separado: si uno no está disponible, lo demás sigue.
do $$
begin
  begin
    if not exists (select 1 from pg_extension where extname = 'pg_cron') and exists (select 1 from pg_available_extensions where name = 'pg_cron') then
      create extension if not exists pg_cron;
    end if;
  exception when others then raise notice 'Vento: pg_cron no se pudo activar (%): los repasos siguen desde GitHub', sqlerrm;
  end;
  begin
    if not exists (select 1 from pg_extension where extname = 'pg_net') and exists (select 1 from pg_available_extensions where name = 'pg_net') then
      create extension if not exists pg_net with schema extensions;
    end if;
  exception when others then raise notice 'Vento: pg_net no se pudo activar (%): el repaso de cobros sigue desde GitHub', sqlerrm;
  end;
  if to_regprocedure('cron.schedule(text,text,text)') is null then
    raise notice 'Vento: este Supabase no tiene pg_cron: los repasos siguen desde GitHub';
    return;
  end if;
  begin
    perform cron.schedule('vento-proyeccion', '*/5 * * * *', 'select public.proyectar_pendientes(50, 20)');
    perform cron.schedule('vento-repaso', '*/5 * * * *', 'select public.vento_repaso()');
    -- La bitácora de pg_cron crece con cada corrida (unas 600 al día): se guarda solo la última semana.
    perform cron.schedule('vento-limpiar-cron', '17 4 * * *', 'delete from cron.job_run_details where end_time < now() - interval ''7 days''');
  exception when others then raise notice 'Vento: no se pudieron programar los repasos (%)', sqlerrm;
  end;
end $$;
