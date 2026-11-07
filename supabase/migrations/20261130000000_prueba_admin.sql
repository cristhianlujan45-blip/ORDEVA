-- ORDEVA 1.88.0 · 🎬 «Dar prueba» desde ORDEVA Admin: el administrador le da a un negocio N días (1 a 90) con un plan
-- completo, como la prueba gratis (source 'trial'). Pedido del dueño: que el administrador de cuentas pueda dar el modo
-- demo. Solo AGREGA una función; no toca tablas ni datos.
--   • Si el negocio ya tiene un plan PAGADO vigente, no se toca (no se le quita lo que pagó): «ya_tiene_plan».
--   • Si ya está en prueba, la prueba nueva reemplaza a la anterior (desde hoy, N días).
--   • Queda en la auditoría del negocio y en los eventos de la suscripción (trial_started).

create or replace function public.srv_sub_dar_prueba(p_negocio uuid, p_plan text, p_dias int, p_admin uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare s subscriptions%rowtype; v_sus jsonb; v_hasta timestamptz;
begin
  if p_admin is null then raise exception 'sin_permiso'; end if;
  if p_dias is null or p_dias < 1 or p_dias > 90 then raise exception 'dias_invalido'; end if;
  if p_plan = 'free' or not exists (select 1 from plans where id = p_plan) then raise exception 'plan_invalido'; end if;
  if not exists (select 1 from negocios where id = p_negocio) then raise exception 'no_existe'; end if;
  perform srv_sub_vencer(p_negocio);
  select * into s from subscriptions where business_id = p_negocio for update;
  if found and s.status = 'active' and s.source <> 'trial' and s.expiry_date > now() then raise exception 'ya_tiene_plan'; end if;
  v_hasta := now() + make_interval(days => p_dias);
  v_sus := srv_sub_activar(p_negocio, p_plan, now(), v_hasta, 'trial', null, p_admin, null);
  insert into payment_events(subscription_id, business_id, type, actor, data)
    select id, p_negocio, 'trial_started', p_admin, jsonb_build_object('plan', p_plan, 'dias', p_dias, 'hasta', v_hasta, 'por', 'admin')
    from subscriptions where business_id = p_negocio;
  perform vento_auditar(p_negocio, p_admin, null, 'prueba_dada', jsonb_build_object('plan', p_plan, 'dias', p_dias, 'hasta', v_hasta));
  return jsonb_build_object('subscription', v_sus);
end $$;
revoke all on function public.srv_sub_dar_prueba(uuid, text, int, uuid) from public, anon, authenticated;
grant execute on function public.srv_sub_dar_prueba(uuid, text, int, uuid) to service_role;
