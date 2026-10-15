-- =====================================================================
--  Activar suscripciones desde el panel de Administrador
--  • srv_sub_reactivar: vuelve a activar una suscripción CANCELADA (o vencida por cancelación) con el período que
--    ya tenía, si todavía le quedan días. No cambia las fechas.
--  • Activar por meses usa el mismo punto único de siempre (srv_sub_dar → srv_sub_activar).
--  Las apps del negocio lo ven al instante (trigger «sub_avisar» de 20261018000000).
--  Se puede volver a correr sin dañar nada.
-- =====================================================================

-- El historial acepta el evento nuevo «subscription_reactivated».
alter table public.payment_events drop constraint if exists payment_events_type_check;
alter table public.payment_events add constraint payment_events_type_check check (type in ('trial_started','payment_submitted','duplicate_blocked',
  'payment_approved','payment_rejected','subscription_activated','subscription_renewed','subscription_expired','subscription_canceled','plan_changed',
  'subscription_reactivated'));

create or replace function public.srv_sub_reactivar(p_negocio uuid, p_admin uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare s subscriptions%rowtype; v_antes text;
begin
  if p_admin is null then raise exception 'sin_permiso'; end if;
  select * into s from subscriptions where business_id = p_negocio for update;
  if not found then raise exception 'no_existe'; end if;
  if s.status = 'active' and s.expiry_date > now() then
    return jsonb_build_object('subscription', sub_sus_pub(s), 'repetido', true);
  end if;
  -- Sin días por delante (o plan gratis) no hay nada que «reactivar»: hay que activar por meses.
  if s.expiry_date is null or s.expiry_date <= now() or s.plan_id = 'free' then raise exception 'sin_periodo'; end if;
  v_antes := s.status;
  update subscriptions set status = 'active', canceled_at = null, updated_at = now() where id = s.id returning * into s;
  insert into payment_events(subscription_id, business_id, type, actor, data)
    values (s.id, p_negocio, 'subscription_reactivated', p_admin, jsonb_build_object('plan', s.plan_id, 'status_antes', v_antes, 'hasta', s.expiry_date));
  perform vento_auditar(p_negocio, p_admin, null, 'suscripcion_reactivada', jsonb_build_object('plan', s.plan_id, 'status_antes', v_antes, 'hasta', s.expiry_date));
  return jsonb_build_object('subscription', sub_sus_pub(s), 'repetido', false);
end $$;

revoke all on function public.srv_sub_reactivar(uuid, uuid) from public, anon, authenticated;
grant execute on function public.srv_sub_reactivar(uuid, uuid) to service_role;
