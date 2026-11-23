// Diagnóstico (solo lectura, lo usa .github/workflows/diagnostico-fiados.yml): abre la libreta REAL de ORDEVA con los datos de
// un negocio y dice qué ve el dueño en «Me deben» para UN nombre que pidió revisar. No imprime ningún otro nombre: solo
// cuántas filas hay, el total, y para ese nombre si está, en qué puesto y con cuánto.
'use strict';
const fs = require('fs');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = (process.env.VENTO_BASE || 'http://localhost:8765') + '/index.html';
const NOMBRE = String(process.env.NOMBRE || '').toLowerCase();
const D = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
(async () => {
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 412, height: 915 } });
  await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
  await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('vento-guia-tour', '1'); localStorage.setItem('cm-tutorial-seen', '1'); }catch(e){} });
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message.slice(0, 200)));
  await p.goto(BASE, { waitUntil: 'load' }); await p.waitForTimeout(900);
  const r = await p.evaluate(async ([D, NOMBRE]) => {
    await enterApp('test', null); document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
    data.businessType = D.businessType || data.businessType; data.history = D.history || []; data.libreta = D.libreta || { movs: [] };
    if(Array.isArray(D.tables)) data.tables = D.tables;
    window.libretaAbrir(); await new Promise(r => setTimeout(r, 400));
    const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
    const filas = [...document.querySelectorAll('#lbDeben .lb-deudor')].map(f => ({ n: f.dataset.persona, m: f.querySelector('b').textContent, vis: !!f.getClientRects().length }));
    const claves = filas.map(f => norm(f.n));
    const mias = filas.map((f, i) => ({ puesto: i + 1, m: f.m, visible: f.vis, igual: norm(f.n) === NOMBRE })).filter((x, i) => claves[i].includes(NOMBRE));
    const deuda = (data.history || []).filter(h => (h.debt || 0) > 0 && (h.payments || []).some(x => x.method === 'debe' && norm(x.note) === NOMBRE));
    return { total: document.getElementById('lbTotDeben').textContent, filas: filas.length, repetidas: claves.length - new Set(claves).size,
      el_nombre: mias, saldo_libreta: window.libretaSaldo ? window.libretaSaldo(NOMBRE.charAt(0).toUpperCase() + NOMBRE.slice(1)) : null,
      cuentas_que_deben_con_ese_nombre: deuda.map(h => ({ factura: h.invoiceNo, deuda: h.debt })) };
  }, [D, NOMBRE]);
  console.log('LIBRETA_REAL ' + JSON.stringify(Object.assign(r, { errores: errs })));
  await b.close();
})();
