-- =====================================================================
--  Suscripciones en TIEMPO REAL
--  Apenas el administrador activa, cambia, cancela o aprueba/rechaza un pago (o vence una suscripción), la base
--  de datos avisa al instante a las apps de ESE negocio (canal «vs-<negocio>») y al panel de administrador
--  (canal «vs-admin»). El aviso no lleva datos: solo dice «cambió». Cada app vuelve a pedirle su estado firmado
--  al servidor, así que lo que decide el plan sigue siendo la base de datos.
--  Se puede volver a correr sin dañar nada.
-- =====================================================================

create or replace function public.sub_avisar() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare v_neg uuid;
begin
  v_neg := coalesce(case when tg_op = 'DELETE' then old.business_id else new.business_id end, null);
  begin
    if v_neg is not null then
      perform realtime.send(jsonb_build_object('t', now()), 's', 'vs-' || v_neg::text, false);
    end if;
    perform realtime.send(jsonb_build_object('t', now(), 'k', tg_table_name), 'a', 'vs-admin', false);
  exception when others then null;   -- sin Realtime (pruebas locales) todo sigue igual; las apps igual revisan cada minuto
  end;
  return null;
end $$;
revoke all on function public.sub_avisar() from public, anon, authenticated;

drop trigger if exists subscriptions_avisar on public.subscriptions;
create trigger subscriptions_avisar after insert or update or delete on public.subscriptions
  for each row execute function public.sub_avisar();

drop trigger if exists payment_records_avisar on public.payment_records;
create trigger payment_records_avisar after insert or update or delete on public.payment_records
  for each row execute function public.sub_avisar();
