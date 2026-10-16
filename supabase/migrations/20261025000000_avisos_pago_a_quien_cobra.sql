-- =====================================================================
--  Avisos de PAGO solo a quien corresponde
--  «Pago confirmado» (push) le llega al DUEÑO y a los ADMINISTRADORES, y además SOLO a quien está cobrando esa mesa:
--  quien creó el cobro (pagos.creado_por) o el mesero / empleado / cajero que atiende la mesa en ese momento
--  (la app lo guarda en datos_negocio.datos.tables[mesa].atiende / .cobrando con su correo). A los demás meseros y
--  cajeros ya no les llega (antes les llegaba a todos los cajeros: avisos repetidos).
--  Se puede volver a correr sin dañar nada.
-- =====================================================================

create or replace function public.srv_push_destinos(p_negocio uuid, p_pago uuid)
returns table(id uuid, push jsonb) language plpgsql stable security definer set search_path = public, extensions as $$
declare v_mesa text; v_creador uuid; v_correos text[] := '{}'; t jsonb;
begin
  if p_pago is null then
    return query select d.id, d.push from dispositivos d join miembros m on m.negocio_id = d.negocio_id and m.usuario_id = d.usuario_id
      where d.negocio_id = p_negocio and d.revocado_en is null and d.push is not null and m.rol in ('dueno','admin','cajero');
    return;
  end if;
  select p.mesa, p.creado_por into v_mesa, v_creador from pagos p where p.id = p_pago and p.negocio_id = p_negocio;
  if v_mesa is not null then
    select dn.datos -> 'tables' -> v_mesa into t from datos_negocio dn where dn.negocio_id = p_negocio;
    if t is not null then
      -- Quién la está cobrando (últimos 30 min) o quién la atiende (con pedidos en la mesa).
      if (t -> 'cobrando' ->> 'e') is not null and coalesce((t -> 'cobrando' ->> 't')::bigint, 0) > (extract(epoch from now()) * 1000 - 30 * 60000) then
        v_correos := v_correos || lower(t -> 'cobrando' ->> 'e');
      end if;
      if (t -> 'atiende' ->> 'e') is not null then v_correos := v_correos || lower(t -> 'atiende' ->> 'e'); end if;
    end if;
  end if;
  return query select d.id, d.push from dispositivos d join miembros m on m.negocio_id = d.negocio_id and m.usuario_id = d.usuario_id
    where d.negocio_id = p_negocio and d.revocado_en is null and d.push is not null
      and (m.rol in ('dueno','admin') or d.usuario_id = v_creador or lower(coalesce(m.email, '')) = any(v_correos));
end $$;
revoke all on function public.srv_push_destinos(uuid, uuid) from public, anon, authenticated;
grant execute on function public.srv_push_destinos(uuid, uuid) to service_role;
