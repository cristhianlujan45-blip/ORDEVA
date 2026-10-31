// 🎵 ORDEVA 1.72.0 · Música fácil: una tarjeta arriba en «Música» (qué suena, poner canción, dónde suena). Sin internet.
// Pedido del dueño: «panel de YouTube más cómodo, elegante y fácil; quita lo repetido; muy fácil de conectar; sin límite».
//  1. Arriba: la tarjeta con «➕ Poner una canción», «⏭ Siguiente» y «¿Dónde suena?» con 3 caminos sin límite.
//  2. Sin dónde sonar y con canciones del QR esperando: lo avisa. Lo que sigue y cuántas hay en cola, a la vista.
//  3. «🔊 En este equipo» prende el reproductor de ORDEVA y la tarjeta dice «Suena en este equipo».
//  4. «➕ Poner una canción» abre el panel de YouTube. Sin botones repetidos (el panel, «Siguiente», «Saltar»).
//  5. Lo técnico en «⚙️ Más opciones», plegado; «🔢 Con el código del TV» lo abre en el campo del código.
//  6. Lo que ya suena en un TV (app de Android): «➕ Poner aquí las canciones de las mesas» con un toque se une al TV
//     del wifi que tiene YouTube abierto.
//  7. La pantalla de Música mide bastante menos que antes (antes ≈ 2381 px de alto en el celular).
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 700) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 400, height: 860 }, hasTouch: true });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(1100);
    await p.fill('#authBiz', 'Bar Música Fácil'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await p.waitForTimeout(1400);
    await p.click('#onbSaltar', { timeout: 3000 }).catch(() => {});
    await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); const b = document.querySelector('.more-tile[data-go="musica"]') || document.querySelector('nav button[data-view="musica"]'); if(b) b.click(); });
    await p.waitForTimeout(600);
    // ===== 1 =====
    let v = await p.evaluate(() => { const c = document.getElementById('mfCard'), v = document.getElementById('view-musica'); return { primero: v && [...v.children].find(x => x.offsetParent || x.tagName === 'DETAILS') === c, ops: [...document.querySelectorAll('#mfCard .mf-op b')].map(x => x.textContent), botones: [...document.querySelectorAll('#mfCard .mf-ctl button')].map(x => x.textContent), sin: /Sin límite/.test(c ? c.innerText : '') }; });
    chk('1. Arriba en Música: la tarjeta con «➕ Poner una canción» y «⏭ Siguiente»', v.primero && /Poner una canción/.test(v.botones[0]) && /Siguiente/.test(v.botones[1]), v);
    chk('1. «¿Dónde suena la música?»: En el TV · Con el código del TV · En este equipo — sin límite de canciones', v.ops.join('|') === 'En el TV|Con el código del TV|En este equipo' && v.sin, v);
    // ===== 2 =====
    await p.evaluate(() => { window.vitoAddSong(3, 'Joe Arroyo - La rebelion'); window.vitoAddSong(5, 'Grupo Niche - Cali pachanguero'); window.ventoMusicaFacil.pintar(); });
    await p.waitForTimeout(1800);
    v = await p.evaluate(() => ({ aviso: document.getElementById('mfAviso').hidden ? '' : document.getElementById('mfAviso').textContent, sigue: document.getElementById('mfSigue').textContent }));
    chk('2. Canciones del QR esperando y sin dónde sonar → lo avisa («2 canciones esperando»)', /2 canciones esperando/.test(v.aviso), v);
    chk('2. Dice lo que sigue (la de la Cuenta 3) y cuántas hay en cola', /rebelion/i.test(v.sigue) && /2 en cola/.test(v.sigue), v);
    // ===== 4 (antes de prender el reproductor) =====
    v = await p.evaluate(() => { const vis = s => { const e = document.querySelector(s); return !!(e && e.offsetParent); }; return { panelViejo: [...document.querySelectorAll('#view-musica [data-yp-abrir]')].filter(x => x.offsetParent && x.id !== 'mfPoner').length, sig: vis('#mzNext'), saltar: vis('#mzSkip'), auto: vis('#mzAutoGo') }; });
    chk('4. Sin botones repetidos (otro «Abrir el panel», «Siguiente canción», «Saltar», «Activar música»)', !v.panelViejo && !v.sig && !v.saltar && !v.auto, v);
    await p.click('#mfPoner'); await p.waitForTimeout(500);
    chk('4. «➕ Poner una canción» abre el panel de YouTube', await p.evaluate(() => !!(window.vitoPanel && window.vitoPanel.abierto())));
    await p.evaluate(() => window.vitoPanel.cerrar()); await p.waitForTimeout(300);
    // ===== 3 =====
    await p.click('#mfCard [data-mf="equipo"]'); await p.waitForTimeout(1600);
    v = await p.evaluate(() => ({ auto: window.vitoMod.AUTO(), donde: document.getElementById('mfDonde').textContent, on: (document.querySelector('#mfCard .mf-op.on') || {}).dataset, aviso: document.getElementById('mfAviso').hidden }));
    chk('3. «🔊 En este equipo» prende el reproductor de ORDEVA; la tarjeta dice «Suena en este equipo» y se marca', v.auto && /Suena en este equipo/.test(v.donde) && v.on && v.on.mf === 'equipo' && v.aviso, v);
    // ===== 5 =====
    v = await p.evaluate(() => { const m = document.getElementById('mfMas'); return { existe: !!m, plegado: m && !m.open, tieneTV: !!(m && m.querySelector('#tvTransmitir')), tieneGoogle: !!(m && m.querySelector('#ytCid')) }; });
    chk('5. Lo técnico (TV, puente, YouTube Music con cuenta de Google) en «⚙️ Más opciones», plegado', v.existe && v.plegado && v.tieneTV && v.tieneGoogle, v);
    await p.click('#mfCard [data-mf="codigo"]'); await p.waitForTimeout(900);
    v = await p.evaluate(() => ({ abierto: document.getElementById('mfMas').open, cod: !!document.getElementById('tvOptCodigo') && document.getElementById('tvOptCodigo').open, foco: document.activeElement && document.activeElement.id }));
    chk('5. «🔢 Con el código del TV» abre «Más opciones» en el campo del código', v.abierto && v.cod && v.foco === 'lngCode', v);
    // ===== 6 =====
    v = await p.evaluate(async () => {
      window.__usado = null;
      window.tvConectarAparato = async tv => { window.__usado = tv.nombre; return true; };
      tvWifiGuardar({ ip: '192.168.1.40', nombre: 'Samsung de la barra', tipo: 'tv' });
      tvWifiGuardar({ ip: '192.168.1.41', nombre: '[LG] webOS TV', tipo: 'tv', youtube: true, appUrl: 'http://192.168.1.41:1234/apps/YouTube' });
      window.__medios = { permiso: true, lista: [{ app: 'com.google.android.youtube.tvunplugged', nombreApp: 'YouTube', titulo: 'RUBICON', artista: 'Peso Pluma', estado: 3, remoto: true, donde: 'YouTube on TV' }] };
      tvDisposPintar();
      const bt = document.querySelector('#tvdLista [data-acc="aqui"]');
      const txt = bt ? bt.innerText : '';
      if(bt) bt.click();
      await new Promise(r => setTimeout(r, 300));
      return { txt, usado: window.__usado };
    });
    chk('6. En lo que ya suena en un TV: «➕ Poner aquí las canciones de las mesas» (a continuación, sin límite)', /Poner aquí las canciones/.test(v.txt) && /continuación/.test(v.txt) && /Sin límite/.test(v.txt), v);
    chk('6. Un toque → se une al TV del wifi que tiene YouTube abierto («[LG] webOS TV»)', v.usado === '[LG] webOS TV', v);
    // ===== 7 =====
    await p.evaluate(() => { document.getElementById('mfMas').open = false; });
    const alto = await p.evaluate(() => document.getElementById('view-musica').scrollHeight);
    chk('7. La pantalla de Música mide menos (' + alto + ' px; antes ≈ 2381 px)', alto < 1800, alto);
    chk('Sin errores de página', !errs.length, errs);
  }catch(e){ mal++; console.log('❌ Excepción: ' + (e && e.stack || e)); }
  await b.close();
  console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
