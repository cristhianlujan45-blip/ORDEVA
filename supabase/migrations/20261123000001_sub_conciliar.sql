-- =====================================================================
-- ORDEVA 1.69.0 · Suscripciones: conciliación de pagos aprobados (que nunca se pierda tiempo pagado)
--
-- Un pago aprobado (payment_records.status = 'approved') cubre su período (period_start → period_end). Si después
-- algo dejó la suscripción con MENOS tiempo del que está pagado —por ejemplo un «🎁 Dar plan» o un cambio de plan
-- con una fecha más corta, o un vencimiento automático mientras había un pago para un período siguiente—, el negocio
-- perdía días que ya pagó.
--
-- srv_sub_conciliar(negocio | null):
--   • para cada negocio con un pago aprobado cuyo period_end todavía no llega, si la suscripción está vencida
--     ('expired') o activa pero con expiry_date antes de ese period_end, la deja activa hasta ese period_end
--     (con el plan de ese pago si estaba vencida; si estaba activa conserva su plan y solo alarga la fecha);
--   • NO toca suscripciones canceladas ni rechazadas (eso lo decidió una persona);
--   • deja la constancia en payment_events ('payment_reconciled') y en la auditoría.
-- Corre sola cada 10 minutos (pg_cron, si este Supabase lo tiene) y el administrador la puede correr a mano.
--
-- No borra ni cambia la estructura de nada: solo agrega una función y una tarea programada.
-- =====================================================================

create or replace function public.srv_sub_conciliar(p_negocio uuid default null) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare r record; n int := 0; arreglos jsonb := '[]'::jsonb; s subscriptions%rowtype;
begin
  for r in
    select distinct on (pr.business_id) pr.business_id, pr.id pago, pr.plan_id, pr.period_end, pr.period_start
      from payment_records pr
     where pr.status = 'approved' and pr.period_end is not null and pr.period_end > now()
       and (p_negocio is null or pr.business_id = p_negocio)
     order by pr.business_id, pr.period_end desc
  loop
    select * into s from subscriptions where business_id = r.business_id for update;
    if found and s.status in ('canceled', 'rejected') then continue; end if;
    if found and s.status = 'active' and s.expiry_date is not null and s.expiry_date >= r.period_end then continue; end if;
    if found and s.status = 'active' then
      update subscriptions set expiry_date = r.period_end, updated_at = now() where id = s.id returning * into s;
    elsif found then
      update subscriptions set status = 'active', plan_id = r.plan_id, source = 'manual', start_date = coalesce(r.period_start, now()),
          expiry_date = r.period_end, canceled_at = null, updated_at = now()
        where id = s.id returning * into s;
    else
      insert into subscriptions(user_id, business_id, plan_id, status, source, start_date, expiry_date)
        values ((select user_id from payment_records where id = r.pago), r.business_id, r.plan_id, 'active', 'manual', coalesce(r.period_start, now()), r.period_end)
        returning * into s;
    end if;
    update payment_records set subscription_id = s.id where id = r.pago and subscription_id is distinct from s.id;
    insert into payment_events(payment_id, subscription_id, business_id, type, data)
      values (r.pago, s.id, r.business_id, 'payment_reconciled', jsonb_build_object('hasta', r.period_end, 'plan', s.plan_id));
    begin perform vento_auditar(r.business_id, null, null, 'suscripcion_conciliada', jsonb_build_object('pago', r.pago, 'hasta', r.period_end)); exception when others then null; end;
    n := n + 1;
    arreglos := arreglos || jsonb_build_object('negocio', r.business_id, 'pago', r.pago, 'hasta', r.period_end);
  end loop;
  return jsonb_build_object('arreglados', n, 'detalle', arreglos);
end $$;

-- payment_events.type: la misma lista de 20261019000000_suscripciones_reactivar.sql + 'payment_reconciled'.
alter table public.payment_events drop constraint if exists payment_events_type_check;
alter table public.payment_events add constraint payment_events_type_check check (type in ('trial_started','payment_submitted','duplicate_blocked',
  'payment_approved','payment_rejected','subscription_activated','subscription_renewed','subscription_expired','subscription_canceled','plan_changed',
  'subscription_reactivated', 'payment_reconciled'));

revoke all on function public.srv_sub_conciliar(uuid) from public, anon, authenticated;
grant execute on function public.srv_sub_conciliar(uuid) to service_role;

do $$
begin
  if to_regprocedure('cron.schedule(text,text,text)') is null then
    raise notice 'Vento: este Supabase no tiene pg_cron: la conciliación de suscripciones se corre a mano desde ORDEVA Admin';
    return;
  end if;
  begin
    perform cron.schedule('vento-sub-conciliar', '*/10 * * * *', 'select public.srv_sub_conciliar(null)');
  exception when others then raise notice 'Vento: no se pudo programar la conciliación (%)', sqlerrm;
  end;
end $$;
