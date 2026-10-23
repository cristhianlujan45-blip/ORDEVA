// Micrófono en la app Android: pedidos largos con pausas y cantidades grandes.
// Android cierra la escucha en cada pausa del que habla; antes ahí se cortaba el pedido («dos águilas…» y el resto se
// perdía). Ahora la escucha se vuelve a abrir sola y SUMA lo que se dice, hasta un silencio de verdad (2 s).
// El reconocedor de Android se simula: cada vez que se abre, «dice» el siguiente pedazo del guion y cierra (como Android
// en una pausa); sin guion, solo escucha en silencio.
//  1. «mesa 1 dos águilas» · pausa · «tres póker» · pausa · «ocho póker cinco águilas» → 7 Águila y 11 Póker, UNA vez.
//  2. Cantidades grandes con pausa: «mesa 2 veinte póker» · pausa · «y quince águilas» → 20 Póker y 15 Águila.
//  3. «Hola ORDEVA» viene apagado: el micrófono NO se abre solo (antes se prendía y apagaba todo el tiempo).
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';

(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => {
      window.__guion = []; window.__aperturas = 0; window.__toasts = [];
      const V = () => window.__ventoVoz;
      window.VentoAndroid = { info: () => '{}', hablar(){}, callar(){}, guardarArchivo(){}, fondo: () => true, fondoActivar(){}, notificar(){ return true; }, avisosEstado: () => '{"prendidos":true}', buscarTVs(){}, lounge(){}, pararTV(){}, vozPreparar(){}, vozSilencio(){},
        vozIniciar(){ window.__aperturas++; setTimeout(() => V()('start', {}), 200);
          const t = window.__guion.shift();
          if(t){ setTimeout(() => V()('result', { alts: [{ t, c: 0.9 }], final: false }), 500); setTimeout(() => V()('result', { alts: [{ t, c: 0.9 }], final: true }), 800); setTimeout(() => V()('end', {}), 850); } },
        vozParar(){ setTimeout(() => { V()('error', { error: 'no-speech' }); V()('end', {}); }, 40); },
        vozCancelar(){ setTimeout(() => V()('end', {}), 20); } };
      localStorage.setItem('cm-tutorial-seen', '1');
    });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(1500);
    await p.fill('#authBiz', 'Bar V'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await p.waitForTimeout(1200);
    await p.click('#onbSaltar').catch(() => {});
    await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); window.speakVoice = () => {};
      const s = window.showToast; window.showToast = (m, ms) => { window.__toasts.push(String(m)); s(m, ms); };
      data.products = [{ id: 'ag', name: 'Águila', price: 3300, stock: 500 }, { id: 'pk', name: 'Póker', price: 3500, stock: 500 }];
      for(let i = 1; i <= 3; i++) data.tables[i] = { items: [], people: [] }; saveData(); });
    await p.waitForTimeout(3500);
    chk('3. «Hola ORDEVA» viene apagado: el micrófono no se abre solo', await p.evaluate(() => window.__aperturas === 0 && !window.ventoHola.activo()), await p.evaluate(() => window.__aperturas));
    const mesa = m => p.evaluate(m => (data.tables[m].items || []).map(i => i.qty + '×' + i.name).sort().join(', '), m);

    // 1. Pedido largo con pausas
    await p.evaluate(() => { window.__guion = ['mesa 1 dos águilas', 'tres póker', 'ocho póker cinco águilas']; startVoiceCommand(false); });
    await p.waitForTimeout(2600);
    chk('1. En medio de las pausas todavía no anota (sigue escuchando)', (await mesa(1)) === '' && await p.evaluate(() => voiceListening === true), await mesa(1));
    await p.waitForTimeout(4000);
    const m1 = await mesa(1);
    chk('1. «dos águilas · tres póker · ocho póker cinco águilas» → 7 Águila y 11 Póker', m1 === '11×Póker, 7×Águila', m1);
    chk('1. El micrófono se volvió a abrir solo en cada pausa (3 pedazos)', await p.evaluate(() => window.__aperturas >= 3), await p.evaluate(() => window.__aperturas));
    chk('1. Terminó solo después del silencio', await p.evaluate(() => voiceListening === false));
    chk('1. No dice «No escuché nada»', await p.evaluate(() => !window.__toasts.some(t => /No escuché nada/.test(t))));
    await p.waitForTimeout(1500);
    chk('1. Se anotó UNA sola vez', (await mesa(1)) === m1);

    // 2. Cantidades grandes con pausa
    await p.evaluate(() => { window.__guion = ['mesa 2 veinte póker', 'y quince águilas']; startVoiceCommand(false); });
    await p.waitForTimeout(6000);
    const m2 = await mesa(2);
    chk('2. «veinte póker · y quince águilas» → 20 Póker y 15 Águila', m2 === '15×Águila, 20×Póker', m2);
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs);
  await b.close();
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
