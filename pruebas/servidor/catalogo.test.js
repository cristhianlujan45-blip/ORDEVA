// Pruebas del SERVIDOR: catálogo compartido de códigos de barras (ORDEVA 1.65.0, migración 20261118000000), contra
// PostgreSQL REAL.
//  • Un miembro de un negocio aporta «código → nombre, marca, tamaño, categoría»; otro negocio lo encuentra.
//  • Solo el nombre del producto: nunca precio, costo ni existencias (no hay dónde guardarlos).
//  • Si lo llaman distinto, queda el nombre que más veces se ha puesto.
//  • Sin sesión no se lee ni se aporta; sin negocio no se aporta; códigos o nombres raros no entran; tope por hora.
//  • Nadie lee ni escribe las tablas directo (solo por las funciones).
// Corre solo:   node pruebas/servidor/catalogo.test.js
'use strict';
const { iniciar } = require('./supabase-local');
let ok = 0, mal = 0;
const chk = (n, c, x) => { if (c) { ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 600) : '')); } };
if (!process.env.VENTO_LOGS) for (const k of ['log', 'warn', 'error']) { const o = console[k].bind(console); console[k] = (...a) => { if (typeof a[0] === 'string' && a[0].startsWith('{"t":"')) return; o(...a); }; }

async function pruebas(sb) {
  const cab = (tok) => ({ apikey: sb.anonKey, 'Content-Type': 'application/json', Authorization: 'Bearer ' + (tok || sb.anonKey) });
  const rpc = async (fn, args, tok) => { const r = await fetch(sb.url + '/rest/v1/rpc/' + fn, { method: 'POST', headers: cab(tok), body: JSON.stringify(args || {}) }); return { st: r.status, j: await r.json().catch(() => null) }; };
  const a = await sb.usuario('tienda1@cat.co'), b = await sb.usuario('tienda2@cat.co'), suelto = await sb.usuario('suelto@cat.co');
  await rpc('crear_negocio', { p_nombre: 'Tienda Uno', p_datos: {} }, a.token);
  await rpc('crear_negocio', { p_nombre: 'Tienda Dos', p_datos: {} }, b.token);

  let r = await rpc('catalogo_aportar', { p_codigo: '7702004003508', p_nombre: 'Gaseosa Colombiana Postobón', p_marca: 'Postobón', p_tamano: '400 ml', p_categoria: 'Bebidas' }, a.token);
  chk('Un miembro de un negocio aporta código → nombre, marca, tamaño y categoría', r.st === 200 && r.j === true, r);
  r = await rpc('catalogo_buscar', { p_codigo: '7702004003508' }, b.token);
  chk('Otro negocio lo encuentra por el código', r.st === 200 && r.j && r.j.nombre === 'Gaseosa Colombiana Postobón' && r.j.marca === 'Postobón' && r.j.tamano === '400 ml' && r.j.categoria === 'Bebidas', r);
  chk('Solo trae el nombre del producto (nada de precios, costos ni existencias)', r.j && !('precio' in r.j) && !('costo' in r.j) && !('stock' in r.j), r.j);
  r = await rpc('catalogo_buscar', { p_codigo: '0000000000000' }, b.token);
  chk('Un código que nadie ha aportado: vacío', r.st === 200 && r.j === null, r);

  // Dos negocios lo llaman distinto: gana el que más veces se ha puesto
  await rpc('catalogo_aportar', { p_codigo: '7701234000011', p_nombre: 'Arroz Diana 500 g' }, a.token);
  await rpc('catalogo_aportar', { p_codigo: '7701234000011', p_nombre: 'Arroz Roa 500 g' }, b.token);
  await rpc('catalogo_aportar', { p_codigo: '7701234000011', p_nombre: 'arroz  ROA 500g' }, b.token);
  await rpc('catalogo_aportar', { p_codigo: '7701234000011', p_nombre: 'Arroz Roa 500 g' }, a.token);
  r = await rpc('catalogo_buscar', { p_codigo: '7701234000011' }, a.token);
  chk('Si lo llaman distinto, queda el nombre que más veces se ha puesto', r.j && r.j.nombre === 'Arroz Roa 500 g' && r.j.veces === 4, r.j);

  r = await rpc('catalogo_buscar', { p_codigo: '7702004003508' });
  chk('Sin sesión no se lee', r.j === null || r.st >= 400, r);
  r = await rpc('catalogo_aportar', { p_codigo: '7709999999999', p_nombre: 'Algo' });
  chk('Sin sesión no se aporta', r.st >= 400, r);
  r = await rpc('catalogo_aportar', { p_codigo: '7709999999999', p_nombre: 'Algo' }, suelto.token);
  chk('Alguien sin negocio no aporta', r.st >= 400 && /sin_permiso/.test(JSON.stringify(r.j)), r);
  r = await rpc('catalogo_aportar', { p_codigo: '<script>', p_nombre: 'Algo' }, a.token);
  const r2 = await rpc('catalogo_aportar', { p_codigo: '7709999999998', p_nombre: 'x' }, a.token);
  chk('Códigos raros o nombres de una letra no entran', r.j === false && r2.j === false, [r, r2]);

  const directo = await fetch(sb.url + '/rest/v1/catalogo_codigos?select=*', { headers: cab(a.token) });
  const dj = await directo.json().catch(() => null);
  chk('Nadie lee la tabla directo (solo por las funciones)', directo.status >= 400 || (Array.isArray(dj) && dj.length === 0), { st: directo.status, dj });
  const esc = await fetch(sb.url + '/rest/v1/catalogo_codigos', { method: 'POST', headers: cab(a.token), body: JSON.stringify({ codigo: '7700000000017', nombre: 'Falso' }) });
  chk('Nadie escribe la tabla directo', esc.status >= 400, esc.status);

  // Tope: 300 aportes por hora por usuario
  await sb.sql("insert into catalogo_aportes(usuario_id, creado_en) select $1, now() from generate_series(1, 300)", [a.id]);
  r = await rpc('catalogo_aportar', { p_codigo: '7709999999997', p_nombre: 'Uno más' }, a.token);
  chk('Tope de 300 aportes por hora por usuario', r.st >= 400 && /demasiados/.test(JSON.stringify(r.j)), r);
}

(async () => {
  let sb = null;
  try { sb = await iniciar(); await pruebas(sb); }
  catch (e) { mal++; console.log('❌ Error inesperado → ' + (e && e.stack || e)); }
  finally { if (sb) await sb.cerrar().catch(() => {}); }
  console.log('RESULTADO', ok, 'bien', mal, 'mal');
  process.exit(mal ? 1 : 0);
})();
