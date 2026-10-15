// Pagos: «me sonó una vez cuando llegó el pago, pusieron otra y no volvió a sonar».
// La app Android (VentoEscucha) ya dice en voz alta «Pago confirmado. 200 pesos desde DaviPlata» y saca el aviso del
// celular (también en segundo plano); la página registra el pago. Aquí se simula el puente nativo y se revisa la página:
//  1. Dos pagos IGUALES seguidos (mismo valor y persona; cada aviso con su propio ID) → DOS pagos, cada uno suena.
//  2. Aviso que Android ya dijo (voz:true) → la página no lo repite (ni voz ni aviso del celular) pero sí lo registra y lo muestra.
//  3. Aviso sin voz de Android (app vieja) → la página dice «Pago confirmado. 200 pesos desde DaviPlata».
//  4. Un pago propio enlazado al servidor no se come el segundo pago igual; uno que reenvió OTRO celular sí evita repetirlo.
//  5. El aviso se reenvía al servidor con su ID; el interruptor «Avisos de pagos» llega a Android (pagosNotif).
//  6. Nequi: «… desde Nequi».
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';

(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => {
      try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){}
      const A = window.__and = { on: true, permiso: true, cola: [], notifs: [], voz: [], sonidos: 0, notifPagos: [], reenvios: [] };
      window.VentoAndroid = {
        pagosAvisos: v => { A.on = !!v; }, pagosAvisosEstado: () => JSON.stringify({ on: A.on, permiso: A.permiso }),
        pagosAvisosTomar: () => { const s = JSON.stringify(A.cola); A.cola = []; return s; },
        mediosPermiso: () => {}, notificar: (t, x, c) => { A.notifs.push({ t, x, c }); return true; },
        pagosNotif: v => { A.notifPagos.push(!!v); },
      };
    });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(1500);
    await p.fill('#authBiz', 'Bar Pagos'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await p.waitForTimeout(1500);
    await p.evaluate(() => {
      document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
      data.pagos = data.pagos || {}; data.pagos.on = true; saveData();
      const h = window.ventoHablar; window.ventoHablar = (t, o) => { window.__and.voz.push(String(t)); };
      if(window.ventoSonidos){ const s0 = window.ventoSonidos.success; window.ventoSonidos.success = () => { window.__and.sonidos++; }; }
      window.ventoPagosReenviarAviso = (txt, id) => window.__and.reenvios.push({ txt, id });
      window.__toasts = []; const st = window.showToast; window.showToast = (m, d) => { window.__toasts.push(String(m)); try{ st(m, d); }catch(e){} };
    });
    chk('5. Al entrar, la página le dice a Android si el aviso de pagos está prendido (pagosNotif)', (await p.evaluate(() => window.__and.notifPagos)).includes(true));

    const TXT = 'DaviPlata | ¡Le llegó plata! | JUAN PEREZ le pasó $200 a su DaviPlata';
    const llega = (id, voz, txt) => p.evaluate(([id, voz, txt]) => { window.__and.cola.push({ id, txt, t: Date.now(), voz }); window.ventoAvisosNativos(); }, [id, voz, txt || TXT]);
    const estado = () => p.evaluate(() => ({ n: (data.pagos.lista || []).filter(x => x.monto === 200).length, voz: window.__and.voz.slice(), notifs: window.__and.notifs.slice(), sonidos: window.__and.sonidos, toasts: window.__toasts.slice(), reenvios: window.__and.reenvios.slice() }));

    // 3. App vieja (sin voz de Android): la página lo dice
    await llega('k1:1000:-55', false);
    let e = await estado();
    chk('3. Sin voz de Android, la página dice «Pago confirmado. 200 pesos desde DaviPlata, de Juan Perez»', e.voz.some(t => /^Pago confirmado\. 200 pesos desde DaviPlata, de Juan Perez/.test(t)), e.voz);
    chk('3. … con el sonido de éxito y el aviso del celular «💜 Pagaron $200 por DaviPlata»', e.sonidos === 1 && e.notifs.some(n => /Pagaron \$200 por DaviPlata/.test(n.t)), e);
    chk('5. El aviso se reenvía al servidor CON su ID', e.reenvios.length === 1 && e.reenvios[0].id === 'and-k1:1000:-55' && e.reenvios[0].txt === TXT, e.reenvios);

    // 1. Segundo pago IGUAL (otro aviso, otro ID) poco después
    await p.evaluate(() => { const x = data.pagos.lista[0]; x.srv = 'uuid-1'; saveData(); });   // el servidor enlazó el primero
    await llega('k1:2000:-55', false);
    e = await estado();
    chk('1. Segundo pago igual → OTRO pago registrado (2 de $200)', e.n === 2, e.n);
    chk('1. … y vuelve a sonar (voz y sonido otra vez)', e.voz.filter(t => /^Pago confirmado\. 200 pesos desde DaviPlata/.test(t)).length === 2 && e.sonidos === 2, e);
    chk('4. Un pago propio enlazado al servidor no se come el segundo pago igual', e.reenvios.length === 2, e.reenvios);
    // El mismo aviso otra vez (mismo ID) → no se repite
    await llega('k1:2000:-55', false);
    e = await estado();
    chk('1. El mismo aviso otra vez (mismo ID) no se cuenta ni suena dos veces', e.n === 2 && e.sonidos === 2, e);

    // 2. Android ya lo dijo (voz:true): la página no repite la voz ni el aviso del celular
    const v0 = e.voz.length, n0 = e.notifs.length;
    await llega('k1:3000:-55', true);
    e = await estado();
    chk('2. Aviso que Android ya dijo en voz alta → la página NO lo repite', e.voz.length === v0, e.voz.slice(v0));
    chk('2. … ni saca otro aviso del celular', e.notifs.length === n0, e.notifs.slice(n0));
    chk('2. … pero SÍ queda registrado (3 de $200), con sonido y en pantalla', e.n === 3 && e.sonidos === 3 && e.toasts.some(t => /Pago confirmado · \$200 por DaviPlata/.test(t)), e);

    // 4. Pago que reenvió OTRO celular (llegó del servidor) y luego el mismo aviso aquí → no se repite
    await p.evaluate(() => window.ventoPagos && window.ventoPagos.recibir({ id: 'p-otro', estado: 'aprobado', confianza: 'app', verificado: false, proveedor: 'dispositivo', metodo: 'NEQUI', monto: 9000, pagador: 'Ana Gomez', creado_en: new Date().toISOString(), actualizado_en: new Date().toISOString() }, true));
    const conSrv = await p.evaluate(() => (data.pagos.lista || []).filter(x => x.monto === 9000).length);
    const s0 = (await estado()).sonidos;
    await llega('k9:1:-9', false, 'Nequi | Nequi | ANA GOMEZ te envió $9.000');
    const n9 = await p.evaluate(() => (data.pagos.lista || []).filter(x => x.monto === 9000).length);
    chk('4. Un pago que OTRO celular ya reenvió (vino del servidor) no se repite al leerlo aquí', conSrv === 1 && n9 === 1, { conSrv, n9 });

    // 6. Nequi
    await llega('k8:1:-8', false, 'Nequi | Nequi | PEDRO RUIZ te envió $15.000');
    e = await estado();
    chk('6. Nequi: «Pago confirmado. 15000 pesos desde Nequi, de Pedro Ruiz»', e.voz.some(t => /^Pago confirmado\. 15000 pesos desde Nequi, de Pedro Ruiz/.test(t)), e.voz);

    // 5. Interruptor del aviso de pagos → Android
    await p.evaluate(() => { window.__and.notifPagos = []; });
    const cambio = await p.evaluate(() => { const i = document.querySelector('[data-notif="pagos"]'); if(!i) return 'sin interruptor'; i.checked = false; i.dispatchEvent(new Event('change')); return 'ok'; });
    chk('5. Apagar «Avisos de pagos» le avisa a Android (no saca el aviso del celular)', cambio === 'ok' && (await p.evaluate(() => window.__and.notifPagos)).includes(false), cambio);
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs);
  await b.close();
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
