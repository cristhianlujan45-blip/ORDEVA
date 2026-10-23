-- =====================================================================
--  Vento 1.53.2 · ¿Están corriendo los repasos dentro de Supabase? (lo muestra GET /vento-pagos/salud)
--  Solo dice si están programados y cuándo fue la última corrida de cada uno (sin comandos ni secretos).
-- =====================================================================
create or replace function public.srv_repasos_estado()
returns jsonb language plpgsql stable security definer set search_path = public, extensions as $$
declare r jsonb;
begin
  if to_regclass('cron.job') is null then return jsonb_build_object('pg_cron', false); end if;
  execute $q$
    select jsonb_build_object('pg_cron', true, 'pg_net', to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is not null,
      'config', exists (select 1 from public.servidor_config where clave = 'repaso'),
      'trabajos', coalesce((select jsonb_object_agg(j.jobname, jsonb_build_object('cada', j.schedule, 'activo', j.active,
          'ultimo', (select jsonb_build_object('fin', d.end_time, 'estado', d.status) from cron.job_run_details d where d.jobid = j.jobid order by d.runid desc limit 1)))
        from cron.job j where j.jobname like 'vento-%'), '{}'::jsonb))
  $q$ into r;
  return r;
exception when others then
  return jsonb_build_object('pg_cron', to_regclass('cron.job') is not null, 'error', left(sqlerrm, 200));
end $$;
revoke all on function public.srv_repasos_estado() from public, anon, authenticated;
grant execute on function public.srv_repasos_estado() to service_role;
