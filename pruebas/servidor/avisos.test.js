// Pruebas del SERVIDOR: avisos de pago reenviados por un celular autorizado (POST /aviso/{token}) contra PostgreSQL REAL.
//  • Dos pagos IGUALES seguidos (mismo valor, misma persona) que la app Vento manda con su ID → DOS pagos (antes el
//    segundo se tomaba como repetido durante 2 minutos y los demás celulares no se enteraban).
//  • El mismo aviso (mismo ID) reenviado otra vez → uno solo.
//  • MacroDroid (texto plano, sin ID) → como antes: la misma notificación en 2 minutos cuenta una vez.
// Corre solo:   node pruebas/servidor/avisos.test.js
'use strict';
const { iniciar } = require('./supabase-local');
let ok = 0, mal = 0;
const chk = (n, c, x) => { if (c) { ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 600) : '')); } };
for (const k of ['log', 'warn', 'error']) { const o = console[k].bind(console); console[k] = (...a) => { if (typeof a[0] === 'string' && a[0].startsWith('{"t":"')) return; o(...a); }; }

async function pruebas(sb) {
  const F = sb.url + '/functions/v1/vento-pagos';
  const cab = (tok) => ({ apikey: sb.anonKey, 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) });
  const rpc = async (fn, args, tok) => { const r = await fetch(sb.url + '/rest/v1/rpc/' + fn, { method: 'POST', headers: cab(tok), body: JSON.stringify(args || {}) }); return r.json().catch(() => null); };
  const aviso = async (tok, cuerpo) => { const r = await fetch(F + '/aviso/' + tok, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: cuerpo }); return { st: r.status, j: await r.json().catch(() => ({})) }; };
  const pagos = async (neg) => sb.sql("select monto::int monto, estado, metodo from pagos where negocio_id = $1 and proveedor = 'dispositivo' order by creado_en", [neg]);

  const dueno = await sb.usuario('dueno@avisos.co');
  const NEG = await rpc('crear_negocio', { p_nombre: 'Bar Avisos', p_datos: {} }, dueno.token);
  const dev = await rpc('registrar_dispositivo', { p_negocio: NEG, p_nombre: 'Caja' }, dueno.token);
  chk('Celular autorizado con token', dev && typeof dev.token === 'string' && dev.token.length >= 20, dev);
  const TXT = 'DaviPlata | ¡Le llegó plata! | JUAN PEREZ le pasó $200 a su DaviPlata';

  // 1. App Vento: dos pagos iguales seguidos, cada uno con su ID
  let r1 = await aviso(dev.token, JSON.stringify({ text: TXT, id: 'and-k1:1000:55' }));
  let r2 = await aviso(dev.token, JSON.stringify({ text: TXT, id: 'and-k1:2000:55' }));
  chk('1. Primer pago de $200 por DaviPlata → pago aprobado', r1.st === 200 && r1.j.ok && r1.j.pago && r1.j.monto === 200, r1.j);
  chk('1. Segundo pago IGUAL (otro ID) → otro pago, no «duplicado»', r2.st === 200 && r2.j.ok && r2.j.pago && r2.j.pago !== r1.j.pago && !r2.j.duplicado, r2.j);
  // 2. El mismo aviso reenviado (mismo ID) → uno solo
  const r3 = await aviso(dev.token, JSON.stringify({ text: TXT, id: 'and-k1:2000:55' }));
  chk('2. El mismo aviso otra vez (mismo ID) → duplicado, no cuenta', r3.st === 200 && r3.j.duplicado === true, r3.j);
  let l = await pagos(NEG);
  chk('2. Quedan exactamente 2 pagos de $200 aprobados por DaviPlata', l.length === 2 && l.every((x) => x.monto === 200 && x.estado === 'aprobado' && /DAVIPLATA/i.test(x.metodo)), l);

  // 3. MacroDroid (texto plano sin ID): la misma notificación en 2 minutos cuenta una vez (como antes)
  const TXT2 = 'Nequi | Nequi | ANA GOMEZ te envió $15.000';
  const m1 = await aviso(dev.token, TXT2), m2 = await aviso(dev.token, TXT2);
  chk('3. MacroDroid: el aviso cuenta y el repetido en 2 minutos no', m1.j.ok && m1.j.pago && m1.j.monto === 15000 && m2.j.duplicado === true, [m1.j, m2.j]);
  // 4. JSON de MacroDroid {app,titulo,texto} sigue sirviendo
  const m3 = await aviso(dev.token, JSON.stringify({ app: 'Nequi', titulo: 'Nequi', texto: 'PEDRO te envió $7.500' }));
  chk('4. JSON {app, titulo, texto} sigue sirviendo', m3.j.ok && m3.j.monto === 7500, m3.j);
  // 5. Lo que no es plata recibida no crea pagos; token falso → 401
  const m4 = await aviso(dev.token, JSON.stringify({ text: 'Nequi | Nequi | Tu código es 123456', id: 'and-x' }));
  chk('5. Un código no es un pago', m4.j.ok && m4.j.ignorado && !m4.j.pago, m4.j);
  const m5 = await aviso('x'.repeat(40), JSON.stringify({ text: TXT, id: 'and-z' }));
  chk('5. Token que no es de un celular autorizado → 401', m5.st === 401, m5);
  // 6. La lectura del servidor es la misma de la app: DaviPlata habla de «usted»
  const A = await import(require('url').pathToFileURL(require('path').resolve(__dirname, '..', '..', 'supabase', 'functions', 'vento-pagos', 'avisos.ts')).href);
  const casos = [
    ['DaviPlata | ¡Le llegó plata! | JUAN PEREZ le pasó $200 a su DaviPlata', 200, 'DAVIPLATA', 'Juan Perez'],
    ['DaviPlata | DaviPlata | Recibió $25.000 de MARIA LOPEZ', 25000, 'DAVIPLATA', 'Maria Lopez'],
    ['Nequi | Nequi | ANA GOMEZ te envió $15.000', 15000, 'NEQUI', 'Ana Gomez'],
    ['Bancolombia | Bancolombia | Ha recibido una transferencia por $1.500.000', 1500000, 'BANCOLOMBIA', ''],
  ];
  for (const [t, m, met, de] of casos) { const a = A.leerAviso(t); chk('6. «' + t.split('|')[2].trim() + '» → ' + m + ' ' + met + (de ? ' de ' + de : ''), a && a.monto === m && a.metodo === met && a.de === de && a.confianza === 'app', a); }
  chk('6. Publicidad del banco («¿Te llegó la prima?…», «Te prestamos hasta $5.000.000») no es un pago',
    A.leerAviso('Nequi | Nequi | ¿Te llegó la prima? Guárdala en un colchón') === null && A.leerAviso('DaviPlata | DaviPlata | Te prestamos hasta $5.000.000, ¡le llegó la oportunidad!') === null);
  chk('6. «Recibiste COP 45.000 de ANA RUIZ» → 45000', (A.leerAviso('Bancolombia | Bancolombia | Recibiste COP 45.000 de ANA RUIZ') || {}).monto === 45000, A.leerAviso('Bancolombia | Bancolombia | Recibiste COP 45.000 de ANA RUIZ'));
  // 7. Bre-B (de otros bancos por la llave) y Nequi con «¿…?»
  const casos7 = [
    ['DaviPlata | DaviPlata | Llegaron $50.000 a tu llave @juan', 50000, 'DAVIPLATA'],
    ['Nequi | ¡Te llegó plata por Bre-B! | MARIA LOPEZ te envió $35.000', 35000, 'NEQUI'],
    ['DaviPlata | DaviPlata | Recibió $80.000 a través de Bre-B de CARLOS RUIZ', 80000, 'DAVIPLATA'],
    ['Nequi | Nequi | ¡Te llegó plata! ANA RUIZ te envió $20.000. ¿La guardas en un bolsillo?', 20000, 'NEQUI'],
    ['Nequi | Nequi | PEDRO GOMEZ te mandó $9.000', 9000, 'NEQUI'],
  ];
  for (const [t, m, met] of casos7) { const a = A.leerAviso(t); chk('7. «' + t.split('|').slice(1).join('|').trim() + '» → ' + m, a && a.monto === m && a.metodo === met && a.confianza === 'app', a); }
  chk('7. Solicitudes y rechazos no son pagos («te pidió», «solicitud», «rechazada»)', A.leerAviso('Nequi | Nequi | JUAN PEREZ te pidió $20.000') === null && A.leerAviso('Nequi | Nequi | Recibiste una solicitud de plata de $15.000') === null && A.leerAviso('Nequi | Nequi | Tu transferencia Bre-B de $10.000 fue rechazada') === null);
  chk('6. «Usted envió $5.000» (plata que SALE) no es un pago', A.leerAviso('DaviPlata | DaviPlata | Usted envió $5.000 a PEDRO') === null);
  // 8. Lo que entendió la app del celular (pista): su valor manda; «falso» siempre gana; una pista mala no cuenta
  const P1 = A.conPista(A.leerAviso('Nequi | Nequi | Movimiento recibido $ 50 000'), { monto: 50000, app: 'Nequi', de: 'Ana', nivel: 'app' }, 'Nequi | Nequi | Movimiento recibido $ 50 000');
  chk('8. «$ 50 000» con la pista de la app → 50000 por Nequi', P1 && P1.monto === 50000 && P1.metodo === 'NEQUI' && P1.de === 'Ana' && P1.confianza === 'app', P1);
  const P2 = A.conPista(A.leerAviso('SMS | 3001234567 | Te enviaron $20.000'), { monto: 20000, app: 'Nequi', nivel: 'app' }, 'SMS | 3001234567 | Te enviaron $20.000');
  chk('8. SMS desde un celular: sigue FALSO aunque la app diga confiable', P2 && P2.confianza === 'falso', P2);
  const P3 = A.conPista(A.leerAviso('Nequi | Nequi | ANA te envió $9.000'), { monto: 9000, nivel: 'falso' }, 'Nequi | Nequi | ANA te envió $9.000');
  chk('8. Si la app dice falso → falso', P3 && P3.confianza === 'falso', P3);
  const base8 = A.leerAviso('Nequi | Nequi | ANA te envió $9.000');
  chk('8. Una pista sin valor o con un valor raro no cambia nada', JSON.stringify(A.conPista(base8, { monto: 0 }, '')) === JSON.stringify(base8) && JSON.stringify(A.conPista(base8, { monto: '9.5' }, '')) === JSON.stringify(base8) && A.conPista(null, null, 'x') === null);
  l = await pagos(NEG);
  chk('Total: 4 pagos (2 de $200, $15.000 y $7.500)', l.length === 4, l);
}

(async () => {
  let sb = null;
  try { sb = await iniciar({ env: {} }); await pruebas(sb); }
  catch (e) { mal++; console.log('❌ Error inesperado → ' + (e && e.stack || e)); }
  finally { if (sb) await sb.cerrar().catch(() => {}); }
  console.log('RESULTADO', ok, 'bien', mal, 'mal');
  process.exit(mal ? 1 : 0);
})();
