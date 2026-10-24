-- =====================================================================
-- ORDEVA 1.62.0 · El administrador elige en qué equipos SUENAN los avisos de pago
--   Con varios celulares, tablets o computadores en el mismo negocio, el dueño o el administrador elige en Ajustes →
--   Pagos cuáles suenan (voz, sonido y notificación). En los demás el pago igual llega y queda en la lista, sin sonar.
--   • dispositivos.suena (por defecto sí: todo sigue como antes hasta que se elija).
--   • dispositivos_lista: la lista con «suena» (mis_dispositivos queda igual para los equipos con la versión anterior).
--   • dispositivo_sonar / dispositivo_nombre: solo dueño o administrador (el nombre también quien usa ese equipo).
--   • dispositivo_suena: cada equipo pregunta por el suyo. Al cambiarlo, aviso en vivo a los equipos del negocio.
--   • srv_push_destinos: la notificación con la app cerrada (Web Push) solo va a los que suenan.
--   Sin borrar nada: una columna y funciones.
-- =====================================================================

alter table public.dispositivos add column if not exists suena boolean not null default true;

create or replace function public.dispositivos_lista(p_negocio uuid)
returns table(id uuid, nombre text, plataforma text, usuario text, rol text, creado_en timestamptz, ultimo_visto timestamptz, push boolean, propio boolean, suena boolean)
language plpgsql stable security definer set search_path = public, extensions as $$
declare r text := public.rol_en(p_negocio);
begin
  if r is null then raise exception 'sin_permiso'; end if;
  return query select d.id, d.nombre, d.plataforma, coalesce(m.nombre, m.email), m.rol, d.creado_en, d.ultimo_visto, d.push is not null, d.usuario_id = auth.uid(), d.suena
    from dispositivos d left join miembros m on m.negocio_id = d.negocio_id and m.usuario_id = d.usuario_id
    where d.negocio_id = p_negocio and d.revocado_en is null and (r in ('dueno','admin') or d.usuario_id = auth.uid())
    order by d.ultimo_visto desc;
end $$;

create or replace function public.dispositivo_sonar(p_dispositivo uuid, p_suena boolean)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
declare d dispositivos%rowtype;
begin
  select * into d from dispositivos where id = p_dispositivo and revocado_en is null;
  if not found then raise exception 'no_existe'; end if;
  if coalesce(public.rol_en(d.negocio_id), '') not in ('dueno','admin') then raise exception 'sin_permiso'; end if;
  update dispositivos set suena = coalesce(p_suena, true) where id = p_dispositivo;
  perform vento_auditar(d.negocio_id, auth.uid(), p_dispositivo, case when coalesce(p_suena, true) then 'dispositivo_suena' else 'dispositivo_callado' end, jsonb_build_object('nombre', d.nombre));
  begin perform srv_negocio_avisar(d.negocio_id, 'dispositivos'); exception when others then null; end;
  return coalesce(p_suena, true);
end $$;

create or replace function public.dispositivo_nombre(p_dispositivo uuid, p_nombre text)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare d dispositivos%rowtype; v text := left(nullif(trim(coalesce(p_nombre, '')), ''), 60);
begin
  select * into d from dispositivos where id = p_dispositivo and revocado_en is null;
  if not found then raise exception 'no_existe'; end if;
  if d.usuario_id <> auth.uid() and coalesce(public.rol_en(d.negocio_id), '') not in ('dueno','admin') then raise exception 'sin_permiso'; end if;
  if v is null then raise exception 'nombre_invalido'; end if;
  update dispositivos set nombre = v where id = p_dispositivo;
  return v;
end $$;

-- ¿Este equipo suena? (lo pregunta cada equipo por el suyo). null = no es suyo o lo retiraron.
create or replace function public.dispositivo_suena(p_dispositivo uuid)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select d.suena from dispositivos d where d.id = p_dispositivo and d.usuario_id = auth.uid() and d.revocado_en is null
$$;

-- Igual que 20261025000000, más: solo a los equipos que suenan.
create or replace function public.srv_push_destinos(p_negocio uuid, p_pago uuid)
returns table(id uuid, push jsonb) language plpgsql stable security definer set search_path = public, extensions as $$
declare v_mesa text; v_creador uuid; v_correos text[] := '{}'; t jsonb;
begin
  if p_pago is null then
    return query select d.id, d.push from dispositivos d join miembros m on m.negocio_id = d.negocio_id and m.usuario_id = d.usuario_id
      where d.negocio_id = p_negocio and d.revocado_en is null and d.push is not null and d.suena and m.rol in ('dueno','admin','cajero');
    return;
  end if;
  select p.mesa, p.creado_por into v_mesa, v_creador from pagos p where p.id = p_pago and p.negocio_id = p_negocio;
  if v_mesa is not null then
    select dn.datos -> 'tables' -> v_mesa into t from datos_negocio dn where dn.negocio_id = p_negocio;
    if t is not null then
      if (t -> 'cobrando' ->> 'e') is not null and coalesce((t -> 'cobrando' ->> 't')::bigint, 0) > (extract(epoch from now()) * 1000 - 30 * 60000) then
        v_correos := v_correos || lower(t -> 'cobrando' ->> 'e');
      end if;
      if (t -> 'atiende' ->> 'e') is not null then v_correos := v_correos || lower(t -> 'atiende' ->> 'e'); end if;
    end if;
  end if;
  return query select d.id, d.push from dispositivos d join miembros m on m.negocio_id = d.negocio_id and m.usuario_id = d.usuario_id
    where d.negocio_id = p_negocio and d.revocado_en is null and d.push is not null and d.suena
      and (m.rol in ('dueno','admin') or d.usuario_id = v_creador or lower(coalesce(m.email, '')) = any(v_correos));
end $$;

revoke all on function public.srv_push_destinos(uuid, uuid) from public, anon, authenticated;
grant execute on function public.srv_push_destinos(uuid, uuid) to service_role;
revoke all on function public.dispositivos_lista(uuid), public.dispositivo_sonar(uuid, boolean), public.dispositivo_nombre(uuid, text), public.dispositivo_suena(uuid) from public, anon;
grant execute on function public.dispositivos_lista(uuid), public.dispositivo_sonar(uuid, boolean), public.dispositivo_nombre(uuid, text), public.dispositivo_suena(uuid) to authenticated, service_role;
