// Mismo correo = mismos datos en el celular y en el computador, AL INSTANTE (contra el «Supabase local» REAL).
//  1. Celular crea la cuenta; el computador entra con el mismo correo y ve lo mismo.
//  2. Lo que se cambia en uno aparece solo en el otro en pocos segundos (sin tocar nada ni recargar), en los dos sentidos.
//  3. Las FOTOS de productos también viajan (antes quedaban solo en el equipo donde se tomaron); cambiar o quitar la foto también.
//  4. Las facturas escaneadas en HD y los comprobantes de pago se ven y se descargan desde el otro equipo.
//  5. La «reparación» automática de datos ya no borra la foto de un producto solo porque no estaba en ese equipo.
//  6. Sin internet al guardar una foto: queda en cola y se sube sola al volver.
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('fs');
const { spawnSync } = require('child_process');
function hayPostgres(){
  if(process.env.VENTO_PG_URL) return true;
  if(fs.existsSync('/usr/lib/postgresql')) return true;
  return spawnSync('bash', ['-c', 'command -v psql || command -v pg_ctl'], { stdio: 'ignore' }).status === 0;
}
if(!process.env.VENTO_LOGS) for(const k of ['log', 'warn', 'error']){
  const orig = console[k].bind(console);
  console[k] = (...a) => { if(typeof a[0] === 'string' && a[0].startsWith('{"t":"')) return; orig(...a); };
}

(async () => {
  if(!hayPostgres()){ console.log('RESULTADO 0 bien 0 mal (este equipo no tiene PostgreSQL: se omitió esta prueba)'); process.exit(0); }
  const { iniciar, enrutar } = require('./servidor/supabase-local');
  const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
  let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 500) : '')); } };
  const sb = await iniciar();
  const b = await chromium.launch();
  try{ await pruebas(); }
  catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página en ningún equipo', !errs.length, errs.join(' | '));
  await b.close().catch(() => {}); await sb.cerrar().catch(() => {});
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);

  async function pruebas(){
    const uno = async (q, p) => (await sb.sql(q, p))[0];
    const esperar = (p, fn, arg, ms) => p.waitForFunction(fn, arg, { timeout: ms || 10000, polling: 200 }).then(() => true, () => false);
    async function equipo(nombre, ancho){
      const ctx = await b.newContext({ viewport: { width: ancho || 390, height: 844 } });
      await ctx.route('**/*', rt => { const u = new URL(rt.request().url()); return (u.hostname === 'localhost' || u.hostname === '127.0.0.1') ? rt.continue() : rt.abort(); });
      await enrutar(ctx, sb);
      await ctx.addInitScript(() => { try{ localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento-hola', '0'); }catch(e){} });
      const p = await ctx.newPage();
      p.on('pageerror', e => errs.push(nombre + ': ' + e.message));
      await p.goto(BASE + '/index.html');
      await p.waitForSelector('#authOverlay:not([hidden])', { timeout: 15000 });
      await p.waitForFunction(() => window.ventoNube && window.ventoNube.crearCuenta, null, { timeout: 15000 });
      return { nombre, ctx, p };
    }
    const cerrarTodo = p => p.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));
    const dentro = p => esperar(p, () => document.getElementById('authOverlay').hidden, null, 15000);
    const foto = color => `data:image/jpeg;base64,` + Buffer.from(color).toString('base64');   // contenido distinto por «color»
    const imagen = async (p, color) => p.evaluate(c => { const x = document.createElement('canvas'); x.width = 60; x.height = 60; const g = x.getContext('2d'); g.fillStyle = c; g.fillRect(0, 0, 60, 60); return x.toDataURL('image/jpeg', 0.8); }, color);

    // ===== 1. Celular y computador con el mismo correo =====
    const CEL = await equipo('celular');
    await CEL.p.fill('#authBiz', 'Bar Sync'); await CEL.p.fill('#authUser', 'dueno@sync.co'); await CEL.p.fill('#authPass', 'clave123'); await CEL.p.click('#authBtn');
    chk('1. El celular crea la cuenta y entra', await dentro(CEL.p));
    await CEL.p.click('#onbSaltar', { timeout: 4000 }).catch(() => {}); await cerrarTodo(CEL.p);
    chk('1. El celular queda en la nube', await esperar(CEL.p, () => !!window.ventoNube.negocio(), null, 10000));
    const NEG = (await CEL.p.evaluate(() => window.ventoNube.negocio())).id;
    await CEL.p.evaluate(() => { data.products.push({ id: 'p-aguila', name: 'Águila Sync', price: 3500, stock: 40 }); saveData(); });
    await new Promise(r => setTimeout(r, 2500));
    const PC = await equipo('computador', 1280);
    await PC.p.click('#authTabs [data-tab="entrar"]').catch(() => {});
    await PC.p.fill('#authUser', 'dueno@sync.co'); await PC.p.fill('#authPass', 'clave123'); await PC.p.click('#authBtn');
    chk('1. El computador entra con el mismo correo', await dentro(PC.p));
    await cerrarTodo(PC.p);
    chk('1. El computador ve los mismos datos (el producto del celular)', await esperar(PC.p, () => data.products.some(p => p.name === 'Águila Sync'), null, 10000));
    chk('1. Los dos en el MISMO negocio', (await PC.p.evaluate(() => (window.ventoNube.negocio() || {}).id)) === NEG);

    // ===== 2. Cambios al instante, en los dos sentidos (sin tocar nada) =====
    let t0 = Date.now();
    await CEL.p.evaluate(() => { data.products.push({ id: 'p-poker', name: 'Póker Sync', price: 3800 }); data.tables[1] = { items: [{ productId: 'p-aguila', name: 'Águila Sync', price: 3500, qty: 3 }], people: [] }; saveData(); });
    const llego = await esperar(PC.p, () => data.products.some(p => p.name === 'Póker Sync') && (data.tables[1].items || []).length === 1, null, 12000);
    const seg1 = (Date.now() - t0) / 1000;
    chk('2. Producto nuevo y mesa abierta en el celular → aparecen solos en el computador (' + seg1.toFixed(1) + ' s)', llego && seg1 <= 9, seg1);
    t0 = Date.now();
    await PC.p.evaluate(() => { const p = data.products.find(x => x.id === 'p-aguila'); p.price = 3900; saveData(); });
    const llego2 = await esperar(CEL.p, () => (data.products.find(x => x.id === 'p-aguila') || {}).price === 3900, null, 12000);
    const seg2 = (Date.now() - t0) / 1000;
    chk('2. Precio cambiado en el computador → llega solo al celular (' + seg2.toFixed(1) + ' s)', llego2 && seg2 <= 9, seg2);

    // ===== 3. Fotos de productos =====
    const rojo = await imagen(CEL.p, '#d00');
    await CEL.p.evaluate(u => { const p = data.products.find(x => x.id === 'p-aguila'); fotosCache[p.id] = u; p.foto = Date.now(); fotoSet(p.id, u); saveData(); }, rojo);
    chk('3. La foto se guardó en la nube', await (async () => { const t = Date.now(); while(Date.now() - t < 8000){ const r = await uno('select tam from archivos_negocio where negocio_id = $1 and clave = $2', [NEG, 'foto/p-aguila']); if(r) return true; await new Promise(x => setTimeout(x, 250)); } return false; })());
    chk('3. El computador muestra la MISMA foto del producto (sin tocar nada)', await esperar(PC.p, u => fotosCache['p-aguila'] === u, rojo, 15000));
    await PC.p.evaluate(() => { document.querySelector('nav button[data-view="productos"]') && document.querySelector('nav button[data-view="productos"]').click(); renderProductos(); });
    chk('3. … y se ve en la lista de productos del computador', await esperar(PC.p, () => !!document.querySelector('#productList img.p-thumb'), null, 5000));
    // Cambiarla en el computador → el celular la ve
    const azul = await imagen(PC.p, '#00d');
    await PC.p.evaluate(u => { const p = data.products.find(x => x.id === 'p-aguila'); fotosCache[p.id] = u; p.foto = Date.now() + 5; fotoSet(p.id, u); saveData(); }, azul);
    chk('3. Foto cambiada en el computador → el celular tiene la nueva', await esperar(CEL.p, u => fotosCache['p-aguila'] === u, azul, 15000));
    // Una foto que ya estaba en el celular desde antes (sin nube) se sube sola
    await CEL.p.evaluate(async () => { const p = { id: 'p-viejo', name: 'Producto Viejo', price: 1000, foto: 123 }; data.products.push(p); const x = document.createElement('canvas'); x.width = 30; x.height = 30; x.getContext('2d').fillRect(0, 0, 30, 30); fotosCache[p.id] = x.toDataURL('image/jpeg'); await fotoSetLocal(p.id, fotosCache[p.id]); saveData(); await fotosALaNube(); });
    chk('3. Fotos que ya estaban guardadas en el celular (de antes) se suben a la nube', !!(await uno('select 1 from archivos_negocio where negocio_id = $1 and clave = $2', [NEG, 'foto/p-viejo'])));
    chk('3. … y el computador las recibe', await esperar(PC.p, () => !!fotosCache['p-viejo'], null, 15000));

    // ===== 4. Facturas escaneadas y comprobantes =====
    await CEL.p.evaluate(async () => {
      const c = document.createElement('canvas'); c.width = 1200; c.height = 900; const x = c.getContext('2d');
      x.fillStyle = '#3b2a1c'; x.fillRect(0, 0, 1200, 900); x.save(); x.translate(600, 450); x.rotate(0.06); x.fillStyle = '#f4f1ea'; x.fillRect(-300, -420, 600, 840);
      x.fillStyle = '#111'; x.font = 'bold 30px Arial'; x.fillText('FACTURA SYNC SAS', -260, -340); x.restore();
      const f = new File([await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9))], 'f.jpg', { type: 'image/jpeg' });
      window.showConfirm = async () => true;
      invoiceOpen({ supplier: 'Factura Sync SAS', items: [{ original: 'CERVEZA SYNC', name: 'Cerveza Sync', qty: 12, unit_cost: 2000, line_total: 24000 }] });
      invoiceDraft.archivos = [f]; invoiceDraft.archivo = f;
      document.getElementById('invoiceApplyBtn').click();
    });
    chk('4. La factura escaneada quedó en la nube', await (async () => { const t = Date.now(); while(Date.now() - t < 30000){ const r = await uno("select count(*) n from archivos_negocio where negocio_id = $1 and clave like 'rec/fesc-%'", [NEG]); if(Number(r.n) >= 1) return true; await new Promise(x => setTimeout(x, 400)); } return false; })());
    chk('4. El computador ve la factura en «Facturas anteriores»', await esperar(PC.p, () => (data.purchases || []).some(x => x.supplier === 'Factura Sync SAS' && (x.escaneos || []).length), null, 20000));
    const enPC = await PC.p.evaluate(async () => { const x = data.purchases.find(y => y.supplier === 'Factura Sync SAS'); const pg = await fiEscaneosDe(x); return pg.length ? { n: pg.length, tipo: pg[0].url.slice(0, 15), kb: Math.round(pg[0].url.length / 1024) } : null; });
    chk('4. … y abre la factura escaneada en HD que se tomó en el celular (la trae de la nube)', enPC && enPC.n === 1 && /^data:image\/jpe?g/.test(enPC.tipo), enPC);
    const rid = await CEL.p.evaluate(async u => { const id = saveReceipt(u); return id; }, rojo);
    await new Promise(r => setTimeout(r, 2500));
    const vio = await PC.p.evaluate(async id => { const b = document.createElement('button'); b.className = 'rcpt-view'; b.dataset.rid = id; document.body.appendChild(b); b.click(); for(let i = 0; i < 40; i++){ await new Promise(r => setTimeout(r, 200)); const im = document.getElementById('rcptImg'); if(document.getElementById('rcptOverlay').classList.contains('show') && im.src.startsWith('data:image')) return true; } return false; }, rid);
    chk('4. Un comprobante de pago tomado en el celular se ve en el computador', vio);
    await cerrarTodo(PC.p);

    // ===== 5. La reparación automática no borra fotos que están en la nube =====
    await PC.p.evaluate(() => { delete fotosCache['p-viejo']; });
    const tras = await PC.p.evaluate(() => { try{ mesoraRepararDatos(); }catch(e){} return !!(data.products.find(x => x.id === 'p-viejo') || {}).foto; });
    chk('5. La reparación de datos ya NO borra la foto de un producto que no estaba en ese equipo', tras);

    // ===== 6. Sin internet al guardar una foto: se sube sola después =====
    const cortar = rt => rt.abort('internetdisconnected');
    await CEL.ctx.route('**/rest/v1/rpc/guardar_archivo', cortar);
    const verde = await imagen(CEL.p, '#0a0');
    await CEL.p.evaluate(u => { const p = data.products.find(x => x.id === 'p-poker'); fotosCache[p.id] = u; p.foto = Date.now(); fotoSet(p.id, u); saveData(); }, verde);
    await new Promise(r => setTimeout(r, 1500));
    chk('6. Sin internet: la foto queda en cola en el celular', (await CEL.p.evaluate(() => window.ventoNube.archivos.pendientes())) >= 1);
    await CEL.ctx.unroute('**/rest/v1/rpc/guardar_archivo', cortar);
    await CEL.p.evaluate(() => window.dispatchEvent(new Event('online')));
    chk('6. Vuelve el internet → la foto se sube sola y llega al computador', await esperar(PC.p, u => fotosCache['p-poker'] === u, verde, 20000));
    chk('6. … y la cola quedó vacía', await esperar(CEL.p, () => window.ventoNube.archivos.pendientes() === 0, null, 8000));

    // ===== 7. Tocar algo justo cuando llegan los datos del otro equipo: no se pierde nada (1.59.2) =====
    //   a) en el MISMO instante en que el computador pone los datos que llegaron del celular, alguien agrega algo en él;
    //   b) agregar algo y que en ese instante (aún sin guardar del todo) lleguen datos del otro.
    // Antes, la bajada de datos pisaba lo que este equipo acababa de tocar: se perdía la venta o el producto.
    const nubeTiene = async n => { const r = await uno('select datos from datos_negocio where negocio_id = $1', [NEG]); return !!r && (r.datos.products || []).some(p => p.name === n); };
    const esperarNube = async (n, ms) => { const t = Date.now(); while(Date.now() - t < (ms || 15000)){ if(await nubeTiene(n)) return true; await new Promise(r => setTimeout(r, 300)); } return false; };
    await PC.p.evaluate(() => {
      const orig = window.ventoAplicarDatosNube; let una = true;
      window.ventoAplicarDatosNube = async (obj, r) => {
        if(una){ una = false; data.products.push({ id: 'p-en-el-instante', name: 'Del PC en el instante', price: 1000 }); saveData(); }
        return orig(obj, r);
      };
    });
    await CEL.p.evaluate(() => { data.products.push({ id: 'p-del-cel-7', name: 'Del celular 7', price: 2000 }); saveData(); });
    chk('7a. Al computador le llega lo del celular', await esperar(PC.p, () => data.products.some(p => p.name === 'Del celular 7'), null, 15000));
    chk('7a. … y NO se pierde lo que se agregó en el computador en ese mismo instante', await esperar(PC.p, () => data.products.some(p => p.name === 'Del PC en el instante'), null, 8000), await PC.p.evaluate(() => data.products.map(p => p.name)));
    chk('7a. … y los dos quedan en la nube y en el celular', await esperarNube('Del PC en el instante') && await esperarNube('Del celular 7') && await esperar(CEL.p, () => data.products.some(p => p.name === 'Del PC en el instante'), null, 15000));
    await CEL.p.evaluate(() => { data.products.push({ id: 'p-del-cel-7b', name: 'Del celular 7b', price: 2000 }); saveData(); });
    await PC.p.evaluate(() => { window.__antesDeBajar = true; const orig = window.ventoAplicarDatosNube; window.ventoAplicarDatosNube = async (obj, r) => orig(obj, r); });
    // b) el computador agrega algo y, sin dar tiempo a guardarlo, llegan los datos del celular (que ya subió 7b)
    await new Promise(r => setTimeout(r, 1200));
    await PC.p.evaluate(() => { data.products.push({ id: 'p-pc-7b', name: 'Del PC 7b', price: 1000 }); saveData(); });
    chk('7b. Lo del computador sin guardar del todo tampoco se pierde cuando llega lo del celular', await esperar(PC.p, () => data.products.some(p => p.name === 'Del celular 7b') && data.products.some(p => p.name === 'Del PC 7b'), null, 15000), await PC.p.evaluate(() => data.products.map(p => p.name)));
    chk('7b. … y queda en la nube', await esperarNube('Del PC 7b') && await esperarNube('Del celular 7b'));
  }
})();
