-- =====================================================================
--  Vento 1.57.0 · Límites de uso de Laya (IA) compartidos y persistentes (auditoría ORDEVA R7)
--
--  Antes el límite de peticiones a la IA vivía en la memoria de cada instancia del servidor (un Map): Supabase prende
--  varias instancias y las reinicia, así que el límite no era real (cada instancia contaba aparte y se reiniciaba en 0).
--  Ahora el conteo está en la base de datos, compartido por todas las instancias: por minuto y por día, para cada clave
--  (un negocio, una conexión) y un tope del día para la IA de Vento (la clave del proveedor).
--  Solo el servidor lo usa (service_role). No borra nada. Se puede volver a correr sin dañar nada.
-- =====================================================================

create table if not exists public.ia_uso (
  clave    text not null check (char_length(clave) between 1 and 120),
  ventana  timestamptz not null,           -- inicio del minuto o del día
  tipo     text not null check (tipo in ('min', 'dia')),
  n        int not null default 0,
  primary key (clave, tipo, ventana)
);
alter table public.ia_uso enable row level security;
revoke all on public.ia_uso from anon, authenticated;

-- Cuenta una petición para `p_clave` y dice si cabe: { ok, min, dia }. Atómico (dos peticiones a la vez cuentan bien).
-- p_max_min / p_max_dia <= 0 = sin ese tope. Si no cabe, no se cuenta (la petición rechazada no gasta cupo).
create or replace function public.srv_ia_cupo(p_clave text, p_max_min int, p_max_dia int) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare m int; d int; vm timestamptz := date_trunc('minute', now()); vd timestamptz := date_trunc('day', now());
begin
  if p_clave is null or char_length(p_clave) < 1 then raise exception 'clave_invalida'; end if;
  p_clave := left(p_clave, 120);
  insert into ia_uso(clave, tipo, ventana, n) values (p_clave, 'min', vm, 1)
    on conflict (clave, tipo, ventana) do update set n = ia_uso.n + 1 returning n into m;
  insert into ia_uso(clave, tipo, ventana, n) values (p_clave, 'dia', vd, 1)
    on conflict (clave, tipo, ventana) do update set n = ia_uso.n + 1 returning n into d;
  if (p_max_min > 0 and m > p_max_min) or (p_max_dia > 0 and d > p_max_dia) then
    update ia_uso set n = n - 1 where clave = p_clave and ((tipo = 'min' and ventana = vm) or (tipo = 'dia' and ventana = vd));
    return jsonb_build_object('ok', false, 'min', m - 1, 'dia', d - 1, 'tope', case when p_max_min > 0 and m > p_max_min then 'minuto' else 'dia' end);
  end if;
  -- Limpieza de vez en cuando: lo de hace más de 2 días ya no sirve.
  if random() < 0.01 then delete from ia_uso where ventana < now() - interval '2 days'; end if;
  return jsonb_build_object('ok', true, 'min', m, 'dia', d);
end $$;

revoke all on function public.srv_ia_cupo(text, int, int) from public, anon, authenticated;
grant execute on function public.srv_ia_cupo(text, int, int) to service_role;
