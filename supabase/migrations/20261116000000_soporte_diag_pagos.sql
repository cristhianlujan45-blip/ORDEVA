-- =====================================================================
-- ORDEVA 1.62.1 · El reporte («Reportar un problema») también trae cómo están los avisos de pago en ese equipo
--   Si el lector de avisos está vivo, cuándo llegó el último aviso de un banco, si ahí suenan y lo último que hizo ORDEVA con
--   cada aviso (los textos ya vienen SIN nombres ni números: AvisoPago.sinDatos). Solo lo ve el administrador.
--   Sin borrar nada: la misma función con un campo más.
-- =====================================================================

create or replace function public.soporte_diag_limpio(p jsonb) returns jsonb
language plpgsql immutable as $$
declare e jsonb; l jsonb := '[]'::jsonb; n int := 0; pg jsonb := null; tr jsonb := '[]'::jsonb;
begin
  if p is null or jsonb_typeof(p) <> 'object' then return null; end if;
  if jsonb_typeof(p -> 'errores') = 'array' then
    for e in select * from jsonb_array_elements(p -> 'errores') loop
      exit when n >= 15;
      if jsonb_typeof(e) <> 'object' then continue; end if;
      l := l || jsonb_build_array(jsonb_build_object('cod', left(e ->> 'cod', 12), 'tipo', left(e ->> 'tipo', 20), 'msg', left(e ->> 'msg', 300),
        'donde', left(e ->> 'donde', 160), 'n', case when jsonb_typeof(e -> 'n') = 'number' then e -> 'n' end, 't', case when jsonb_typeof(e -> 't') = 'number' then e -> 't' end));
      n := n + 1;
    end loop;
  end if;
  if jsonb_typeof(p -> 'pagos') = 'object' then
    n := 0;
    if jsonb_typeof(p -> 'pagos' -> 'traza') = 'array' then
      for e in select * from jsonb_array_elements(p -> 'pagos' -> 'traza') loop
        exit when n >= 8;
        if jsonb_typeof(e) <> 'object' then continue; end if;
        tr := tr || jsonb_build_array(jsonb_build_object('t', case when jsonb_typeof(e -> 't') = 'number' then e -> 't' end,
          'app', left(e ->> 'app', 30), 'txt', left(e ->> 'txt', 160), 'r', left(e ->> 'r', 120)));
        n := n + 1;
      end loop;
    end if;
    pg := jsonb_build_object('suena', case when jsonb_typeof(p -> 'pagos' -> 'suena') = 'boolean' then p -> 'pagos' -> 'suena' end,
      'lector', case when jsonb_typeof(p -> 'pagos' -> 'lector') = 'boolean' then p -> 'pagos' -> 'lector' end,
      'ultimo', case when jsonb_typeof(p -> 'pagos' -> 'ultimo') = 'number' then p -> 'pagos' -> 'ultimo' end, 'traza', tr);
  end if;
  return jsonb_build_object('errores', l, 'version', left(p ->> 'version', 40), 'plataforma', left(p ->> 'plataforma', 20),
    'pagina', left(p ->> 'pagina', 40), 'modelo', left(p ->> 'modelo', 120), 'vista', left(p ->> 'vista', 40), 'en', now())
    || case when pg is not null then jsonb_build_object('pagos', pg) else '{}'::jsonb end;
end $$;
revoke all on function public.soporte_diag_limpio(jsonb) from public, anon, authenticated;
