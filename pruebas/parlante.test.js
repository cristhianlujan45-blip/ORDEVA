// 🔊 Parlante de avisos (Ajustes → Notificaciones): un parlante por Bluetooth o por cable donde suenan SOLO los avisos que
// el dueño elija (pagos, pedidos, cuenta, domicilios…), nada de música. Se simula el puente de la app Android.
//  1. Sin la app (navegador): explica que es de la app Android.
//  2. En la app: lista los parlantes conectados (Bluetooth / cable), se elige uno y se prueba.
//  3. Los avisos elegidos se dicen SOLO en el parlante (pedido, cuenta, domicilio); los no elegidos (canciones) no.
//  4. Los pagos los dice Android directo (no se repiten desde la página).
//  5. Parlante desconectado: no se intenta decir nada en él y se avisa en Ajustes.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';

(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x) : '')); } };
  async function abrir(conApp){
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(conApp => {
      try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){}
      if(!conApp) return;
      const P = window.__parl = { dev: [{ id: 7, nombre: 'JBL Flip 5', clase: 'bluetooth' }, { id: 9, nombre: 'Parlante por cable', clase: 'cable' }, { id: 2, nombre: 'Parlante del celular', clase: 'celular' }],
        elegido: '', conectado: true, tipos: 'pagos,pedidos,cuenta,domicilios', dichos: [], notifs: [] };
      window.VentoAndroid = {
        notificar: (t, x, c) => { P.notifs.push(t); return true; }, pagosNotif: () => {}, pagosAvisosEstado: () => '{}', pagosAvisosTomar: () => '[]',
        parlantes: () => JSON.stringify(P.dev),
        parlanteElegir: id => { const d = P.dev.find(x => x.id === id); P.elegido = d ? d.nombre : ''; },
        parlanteEstado: () => JSON.stringify({ nombre: P.elegido, conectado: !!P.elegido && P.conectado, tipos: P.tipos }),
        parlanteTipos: csv => { P.tipos = csv; },
        parlanteDecir: f => { if(!P.elegido || !P.conectado) return false; P.dichos.push(String(f)); return true; },
      };
    }, conApp);
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(1500);
    await p.fill('#authBiz', 'Bar Parlante'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await p.waitForTimeout(1500);
    await p.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));
    await p.click('#navMoreBtn'); await p.click('.more-tile[data-go="ajustes"]');
    if(await p.isVisible('#ajustesBackBtn')) await p.click('#ajustesBackBtn');
    await p.click('.ajustes-cat[data-cat="avisos"]'); await p.waitForTimeout(300);
    return { ctx, p };
  }
  try{
    { const { ctx, p } = await abrir(false);
      chk('1. Navegador: «🔊 Parlante de avisos» explica que es de la app Android', await p.evaluate(() => !document.getElementById('parlanteSinApp').hidden && document.getElementById('parlanteApp').hidden && /Bluetooth/.test(document.getElementById('parlanteBox').innerText)));
      await ctx.close(); }
    const { ctx, p } = await abrir(true);
    const ops = await p.evaluate(() => [...document.querySelectorAll('#parlanteSel option')].map(o => o.textContent));
    chk('2. Lista los parlantes conectados (Bluetooth y cable; no el del celular) y «Ninguno»', ops.length === 3 && /Ninguno/.test(ops[0]) && ops.some(x => /🔵 JBL Flip 5/.test(x)) && ops.some(x => /Parlante por cable/.test(x)), ops);
    await p.selectOption('#parlanteSel', '7');
    const st = await p.evaluate(() => ({ e: document.getElementById('parlanteEstado').textContent, d: window.__parl.dichos.slice() }));
    chk('2. Elegir el JBL: queda conectado y lo dice en el parlante', /JBL Flip 5 conectado/.test(st.e) && /suenan en este parlante/.test(st.d[0] || ''), st);
    await p.click('#parlanteProbar');
    chk('2. «▶ Probar el parlante» suena en el parlante', await p.evaluate(() => window.__parl.dichos.some(x => /Prueba del parlante/.test(x))));
    const r3 = await p.evaluate(() => {
      window.__parl.dichos = [];
      ventoAvisoCel('🍺 Pedido · Mesa 3', '2 Águila, 1 Papas', 'pedidos');
      ventoAvisoCel('🧾 Mesa 5 pide la cuenta', 'Toca para abrir Vento.', 'pedidos');
      ventoAvisoCel('🛵 Domicilio nuevo de Juan', 'Hamburguesa · Cra 10', 'pedidos');
      ventoAvisoCel('🎵 Canción · Mesa 2', 'Karol G - Provenza', 'musica');
      ventoAvisoCel('💜 Pagaron $20.000 por Nequi', 'Confirmado', 'pagos');
      return { dichos: window.__parl.dichos.slice(), notifs: window.__parl.notifs.length };
    });
    chk('3. Pedido, cuenta y domicilio se dicen en el parlante (sin emojis)', r3.dichos.some(x => /^Pedido, Mesa 3\. 2 Águila, 1 Papas/.test(x)) && r3.dichos.some(x => /Mesa 5 pide la cuenta/.test(x)) && r3.dichos.some(x => /Domicilio nuevo de Juan/.test(x)) && !r3.dichos.some(x => /[🍺🧾🛵]/u.test(x)), r3);
    chk('3. Las canciones (no elegidas) no suenan en el parlante, y la notificación del celular sale igual', !r3.dichos.some(x => /Karol/.test(x)) && r3.notifs >= 5, r3);
    chk('4. Los pagos no se repiten desde la página (los dice Android directo en el parlante)', !r3.dichos.some(x => /Pagaron/.test(x)), r3);
    await p.check('#parlanteTipos [data-parl="musica"]'); await p.uncheck('#parlanteTipos [data-parl="pedidos"]');
    const r3b = await p.evaluate(() => { window.__parl.dichos = []; ventoAvisoCel('🎵 Canción · Mesa 2', 'Karol G - Provenza', 'musica'); ventoAvisoCel('🍺 Pedido · Mesa 3', '2 Águila', 'pedidos'); return { t: window.__parl.tipos, d: window.__parl.dichos.slice() }; });
    chk('3. El dueño elige: con «Canciones» sí y «Pedidos» no, cambia lo que suena', /musica/.test(r3b.t) && !/pedidos/.test(r3b.t) && r3b.d.some(x => /Karol/.test(x)) && !r3b.d.some(x => /Mesa 3/.test(x)), r3b);
    const r5 = await p.evaluate(() => { window.__parl.conectado = false; window.__parl.dichos = []; const r = window.ventoParlanteAviso('🧾 Mesa 1 pide la cuenta', ''); document.querySelector('.ajustes-cat[data-cat="avisos"]'); return { r, d: window.__parl.dichos.length }; });
    await p.click('#parlanteBuscar');
    chk('5. Parlante desconectado: no se intenta y Ajustes lo dice', !r5.r && r5.d === 0 && /no está conectado/.test(await p.textContent('#parlanteEstado')), r5);
    await p.selectOption('#parlanteSel', '0');
    chk('5. «Ninguno»: todo vuelve a sonar en el celular', await p.evaluate(() => window.__parl.elegido === '' && /Ninguno/.test(document.getElementById('parlanteEstado').textContent)));
    await ctx.close();
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs);
  await b.close();
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
