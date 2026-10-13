// Micrófono de la app Android, muchas veces seguidas (reconocedor de Android simulado como en la app instalada).
// Falla que se corrige: se tocaba 🎤, se decía la orden y el micrófono VOLVÍA A SONAR y a abrirse solo: Vento lo reabría
// para no cortar el pedido en una pausa y, al cerrarlo sin voz, la app nativa lo reabría otra vez (otro pitido y 5–8 s
// más escuchando antes de anotar, oyendo lo que se hablara cerca).
// En cada vuelta se revisa: un solo pitido (el del toque), se anota una vez y rápido, el micrófono queda cerrado y no se
// cuela lo que se habla después.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
const VUELTAS = Number(process.env.VUELTAS || 3);

(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(require('./simandroidvoz'));
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(1500);
    await p.fill('#authBiz', 'Bar M'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await p.waitForTimeout(1200);
    await p.click('#onbSaltar').catch(() => {});
    await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); window.speakVoice = () => {};
      window.__toasts = []; const s = window.showToast; window.showToast = (m, ms) => { window.__toasts.push(String(m)); s(m, ms); };
      const h = window.handleVoiceTranscript; window.handleVoiceTranscript = function(t){ __sim.procesados.push({ t, en: Date.now(), tras: Date.now() - __sim.finalEn }); return h.apply(this, arguments); };
      data.products = [{ id: 'ag', name: 'Águila', price: 3300, stock: 5000 }, { id: 'pk', name: 'Póker', price: 3500, stock: 5000 }, { id: 'cc', name: 'Club Colombia', price: 4000, stock: 5000 }];
      for(let i = 1; i <= 4; i++) data.tables[i] = { items: [], people: [] }; saveData(); });
    await p.waitForTimeout(500);
    const mesa = m => p.evaluate(m => (data.tables[m].items || []).map(i => i.qty + '×' + i.name).sort().join(', '), m);
    const limpiar = () => p.evaluate(() => { for(let i = 1; i <= 4; i++) data.tables[i] = { items: [], people: [] }; saveData(); });
    // Una vuelta: tocar 🎤, decir el guion, esperar a que termine y 6 s más (por si el micrófono se reabre solo).
    const vuelta = async (guion, ruido) => {
      await p.evaluate(([g, r]) => { Object.assign(__sim, { guion: g, ruido: r || null, beeps: 0, aperturas: 0, reintentos: 0, procesados: [] }); __toasts.length = 0; startVoiceCommand(false); }, [guion, ruido]);
      await p.waitForFunction(() => !voiceListening, null, { timeout: 30000 });
      await p.waitForTimeout(6000);
      return p.evaluate(() => ({ beeps: __sim.beeps, aperturas: __sim.aperturas, reintentos: __sim.reintentos, vivo: __sim.vivo, mudo: __sim.mudo, escuchando: voiceListening, procesados: __sim.procesados.map(x => ({ t: x.t, tras: x.tras })), toasts: __toasts.slice() }));
    };
    const revisar = (n, r, esperado, real, maxMs) => {
      chk(n + ': se anota bien', real === esperado, { real, esperado });
      chk(n + ': un solo pitido (el del toque), sin que el micrófono vuelva a sonar', r.beeps === 1, r);
      chk(n + ': la app nativa no reabre el micrófono sola', r.reintentos === 0, r);
      chk(n + ': se procesa UNA vez y rápido (≤ ' + (maxMs / 1000) + ' s después de terminar de hablar)', r.procesados.length === 1 && r.procesados[0].tras <= maxMs, r.procesados);
      chk(n + ': el micrófono queda cerrado y el sonido del celular vuelve', !r.vivo && !r.escuchando && !r.mudo, r);
    };

    for(let v = 1; v <= VUELTAS; v++){
      // Vueltas impares: la app instalada hoy; pares: la app nueva (no reabre el micrófono después de que se le pide parar).
      await p.evaluate(a => { __sim.arreglado = a; }, v % 2 === 0);
      // A. Orden básica de un tirón
      await limpiar();
      let r = await vuelta(['mesa 1 dos águilas']);
      revisar('Vuelta ' + v + ' · «mesa 1 dos águilas»', r, '2×Águila', await mesa(1), 1800);
      // B. Pedido largo con pausas (Android corta en cada pausa)
      r = await vuelta(['mesa 4 dos águilas', 'tres póker', 'ocho póker', 'cinco águilas']);
      revisar('Vuelta ' + v + ' · «mesa 4 dos águilas · tres póker · ocho póker · cinco águilas»', r, '11×Póker, 7×Águila', await mesa(4), 1800);
      // C. Cantidades grandes, y gente hablando cerca DESPUÉS de la orden: no se cuela
      r = await vuelta(['mesa 2 cuarenta póker y treinta águilas'], 'y cinco club colombia');
      revisar('Vuelta ' + v + ' · «mesa 2 cuarenta póker y treinta águilas» (con gente hablando después)', r, '30×Águila, 40×Póker', await mesa(2), 1800);
      // D. Pausa a mitad de frase («… y» · «quince águilas»): espera y suma
      r = await vuelta(['mesa 3 veinte póker y', { t: 'quince águilas', tarde: 700 }]);
      revisar('Vuelta ' + v + ' · «mesa 3 veinte póker y · (pausa) · quince águilas»', r, '15×Águila, 20×Póker', await mesa(3), 2600);
      // E. Tocar y no decir nada: «No escuché nada», un pitido y se cierra (sin reabrirse)
      r = await vuelta([]);
      chk('Vuelta ' + v + ' · sin hablar: «No escuché nada» y se cierra sin reabrirse', r.beeps === 1 && r.reintentos === 0 && !r.vivo && !r.escuchando && r.toasts.some(t => /No escuché nada/.test(t)) && !r.procesados.length, r);
    }
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs);
  await b.close();
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
