-- ORDEVA 1.87.0 · El código de invitación de un empleado salía a veces de 7 letras en vez de 8.
-- Se sacaban 12 letras al azar y se quitaban las que se confunden (0 O 1 I l + / =); 1 o 2 de cada 100 veces quedaban
-- menos de 8. Ahora se sacan 24 y, si aun así no alcanzan, se vuelve a sacar: siempre 8.
-- Igual que 20261104100000_permisos_sin_hueco.sql en todo lo demás (quién puede, qué roles). No toca tablas ni datos.

create or replace function public.crear_invitacion(p_negocio uuid, p_rol text)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare c text; yo text := coalesce(public.rol_en(p_negocio), '');
begin
  if yo not in ('dueno','admin') then raise exception 'sin_permiso'; end if;
  if p_rol not in ('admin','cajero','mesero','empleado') then raise exception 'rol_invalido'; end if;
  if p_rol = 'admin' and yo <> 'dueno' then raise exception 'sin_permiso'; end if;
  loop
    c := upper(substr(translate(encode(gen_random_bytes(18), 'base64'), '+/=0O1Il', ''), 1, 8));
    exit when length(c) = 8;
  end loop;
  insert into invitaciones(codigo, negocio_id, rol, creado_por) values (c, p_negocio, p_rol, auth.uid());
  return c;
end $$;

revoke all on function public.crear_invitacion(uuid, text) from public, anon;
grant execute on function public.crear_invitacion(uuid, text) to authenticated;
