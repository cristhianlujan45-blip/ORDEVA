// ORDEVA · lib/vento-plata.js — la usan index.html y admin.html.
/* 💵 1.99.85 · Plata escrita con puntos de miles. En los campos de número del navegador, «8.000» quedaba en 8 (el punto es
   el decimal) y «1.500.000» en 1,5: un pago de $8.000 se podía registrar como $8. En los campos de PLATA (precio, costo,
   pago, abono, envío, valor…) el punto y la coma de miles se ignoran al escribir o pegar: «8.000» → 8000. Los de
   porcentaje, tarifa, cantidad, peso o días no se tocan (ahí sí puede haber decimales). */
(function(){
  var IDS = { prodPrice: 1, prodCost: 1, ctMonto: 1, qpPrice: 1, qpCost: 1, paymentAmount: 1, personPaymentAmount: 1, editProdPrice: 1, editProdCost: 1,
    qsEnvio: 1, calcDescPrecio: 1, calcPrimaSalario: 1, calcReteicaValor: 1 };
  var NO = /pct|porc|tarifa|iva|rate|ret[A-Z]|qty|cant|stock|dias|d[ií]as|peso|kg|min\b|count|split|nota|vol|puntos|%/i;
  var SI = /precio|price|monto|valor|cost|plata|pago|payment|abono|env[ií]o|cuota|salario|tarifaNoche|\$/i;
  function esPlata(el){
    if(!el || el.tagName !== 'INPUT' || el.type !== 'number') return false;
    if(el.dataset && el.dataset.plata === '0') return false;
    if(IDS[el.id] || (el.dataset && el.dataset.plata === '1')) return true;
    var txt = [el.id, el.className, el.name, el.placeholder, el.getAttribute('aria-label'), el.dataset ? (el.dataset.k || '') + ' ' + (el.dataset.q || '') + ' ' + (el.dataset.a || '') : ''].join(' ');
    if(NO.test(txt)) return false;
    var paso = Number(el.getAttribute('step'));
    return SI.test(txt) || (paso >= 50 && paso % 50 === 0);
  }
  window.ventoEsPlata = esPlata;
  function soloCifras(s){ return String(s == null ? '' : s).replace(/[^\d]/g, ''); }
  // Teclado de computador: el punto y la coma no entran.
  document.addEventListener('keydown', function(e){ if((e.key === '.' || e.key === ',' || e.key === 'Decimal') && esPlata(e.target)) e.preventDefault(); }, true);
  // Celular (Gboard y otros mandan «beforeinput») y pegar: solo las cifras.
  document.addEventListener('beforeinput', function(e){
    var el = e.target; if(!esPlata(el) || !e.data || !/[.,]/.test(e.data)) return;
    if(!e.cancelable) return;
    e.preventDefault();
    var c = soloCifras(e.data); if(c){ el.value = soloCifras(el.value) + c; el.dispatchEvent(new Event('input', { bubbles: true })); }
  }, true);
  document.addEventListener('paste', function(e){
    var el = e.target; if(!esPlata(el)) return;
    var t = (e.clipboardData && e.clipboardData.getData('text')) || ''; if(!/[.,]/.test(t)) return;
    e.preventDefault(); el.value = soloCifras(t); el.dispatchEvent(new Event('input', { bubbles: true }));
  }, true);
  // Por si se coló («8.000» exacto, de un teclado que no avisa): al cambiar, los miles con punto se vuelven cifras.
  document.addEventListener('input', function(e){
    var el = e.target; if(!esPlata(el)) return;
    var v = String(el.value || ''); if(/^\d{1,3}([.,]\d{3})+$/.test(v)) el.value = soloCifras(v);
  }, true);
})();
