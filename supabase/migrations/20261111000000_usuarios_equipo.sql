-- =====================================================================
-- ORDEVA 1.60.0 · Usuarios del equipo creados solo con un nombre (ej. «juan»), en TODOS los equipos del negocio
--   Antes vivían solo en el celular donde el dueño los creó. Ahora cada equipo conectado con la cuenta del dueño
--   (o de un administrador) los sube y los baja: el mismo usuario y la misma contraseña en todos.
--   • Se guarda la huella de la contraseña (PBKDF2 con su sal, como en el celular), nunca la contraseña.
--   • Solo el dueño y el administrador del negocio los leen o cambian (por estas funciones; la tabla no se lee directo).
--     El cajero, empleado o mesero con cuenta propia no ve las huellas.
--   • Quitar un usuario deja la marca «borrado» (para que los otros equipos también lo quiten): no se pierde historial.
--   Sin borrar nada: tabla y funciones nuevas.
-- =====================================================================

create table if not exists public.usuarios_equipo (
  negocio_id       uuid not null references public.negocios(id) on delete cascade,
  usuario          text not null check (char_length(usuario) between 1 and 60 and position('@' in usuario) = 0),
  salt             text check (char_length(salt) <= 80),
  hash             text check (char_length(hash) <= 200),
  rol              text check (rol in ('admin', 'staff', 'cajero', 'empleado', 'mesero')),
  borrado          boolean not null default false,
  version          bigint not null default 1,
  actualizado_en   timestamptz not null default now(),
  actualizado_por  uuid references auth.users(id) on delete set null,
  primary key (negocio_id, usuario)
);
alter table public.usuarios_equipo enable row level security;
revoke all on public.usuarios_equipo from anon, authenticated;

create or replace function public.usuarios_equipo_lista(p_negocio uuid) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if coalesce(public.rol_en(p_negocio), '') not in ('dueno', 'admin') then raise exception 'sin_permiso'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('usuario', u.usuario, 'salt', u.salt, 'hash', u.hash, 'rol', u.rol,
                                                       'borrado', u.borrado, 'version', u.version, 'actualizado_en', u.actualizado_en) order by u.usuario)
                   from usuarios_equipo u where u.negocio_id = p_negocio), '[]'::jsonb);
end $$;

-- Crea, cambia o quita (p_borrado) un usuario. Devuelve la versión nueva y avisa en vivo a los otros equipos.
create or replace function public.usuarios_equipo_guardar(p_negocio uuid, p_usuario text, p_salt text, p_hash text, p_rol text, p_borrado boolean)
returns bigint
language plpgsql security definer set search_path = public, extensions as $$
declare v_u text := lower(trim(coalesce(p_usuario, ''))); v bigint; v_borrar boolean := coalesce(p_borrado, false);
begin
  if coalesce(public.rol_en(p_negocio), '') not in ('dueno', 'admin') then raise exception 'sin_permiso'; end if;
  if char_length(v_u) < 1 or char_length(v_u) > 60 or position('@' in v_u) > 0 then raise exception 'usuario_invalido'; end if;
  if not v_borrar then
    if coalesce(p_salt, '') = '' or coalesce(p_hash, '') = '' or char_length(p_salt) > 80 or char_length(p_hash) > 200 then raise exception 'datos_invalidos'; end if;
    if coalesce(p_rol, 'staff') not in ('admin', 'staff', 'cajero', 'empleado', 'mesero') then raise exception 'rol_invalido'; end if;
    if not exists (select 1 from usuarios_equipo where negocio_id = p_negocio and usuario = v_u)
       and (select count(*) from usuarios_equipo where negocio_id = p_negocio and not borrado) >= 300 then raise exception 'demasiados'; end if;
  end if;
  insert into usuarios_equipo as x (negocio_id, usuario, salt, hash, rol, borrado, actualizado_por)
    values (p_negocio, v_u, case when v_borrar then null else p_salt end, case when v_borrar then null else p_hash end,
            case when v_borrar then null else coalesce(p_rol, 'staff') end, v_borrar, auth.uid())
  on conflict (negocio_id, usuario) do update set
    salt = excluded.salt, hash = excluded.hash, rol = excluded.rol, borrado = excluded.borrado,
    version = x.version + 1, actualizado_en = now(), actualizado_por = auth.uid()
  returning version into v;
  begin perform srv_negocio_avisar(p_negocio, 'usuarios'); exception when others then null; end;
  return v;
end $$;

revoke all on function public.usuarios_equipo_lista(uuid), public.usuarios_equipo_guardar(uuid, text, text, text, text, boolean) from public, anon;
grant execute on function public.usuarios_equipo_lista(uuid), public.usuarios_equipo_guardar(uuid, text, text, text, text, boolean) to authenticated, service_role;
