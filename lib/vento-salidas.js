/* =====================================================================
   ORDEVA · 💸 Salidas de Nequi / DaviPlata por clasificar (1.66.5)
   La app Android guarda en el celular los avisos de plata que SALE de las apps del banco («Enviaste $250.000 a
   DISTRIBUIDORA EL SOL», «Pasaste $100 a otro DaviPlata», «Compra exitosa … por 20,000»). Aquí:
   • Solo el administrador (dueño o admin) las toma y las ve, en Contabilidad. Se quedan en ESTE celular
     (localStorage, por negocio): no van al documento compartido, ni al servidor, ni a los equipos de los empleados.
   • Cada una se clasifica:
       📦 Proveedor            → gasto «Proveedores / mercancía» (con el nombre de a quién se le pagó)
       🗂️ Otro gasto           → gasto de la categoría que se elija
       🔗 Ya estaba anotada    → no se suma (ej. el pago de una factura escaneada, que ya cuenta como compra)
       🙈 No es del negocio    → se descarta (pide confirmación)
     El gasto queda en data.contab como cualquier gasto (se puede borrar desde la lista de movimientos).
   • Sugerencias, nunca automáticas: si ya se clasificó antes a quien se le pagó, se propone lo mismo; si el nombre se
     parece al proveedor de una factura escaneada, «Proveedor»; y si además el valor es el de esa factura, «Ya estaba
     anotada» (para no contar dos veces la misma compra).
   El valor y a quién se le pagó se leen aquí (la página se actualiza sola, sin reinstalar la app).
   ===================================================================== */
(function(){
  'use strict';
  if(window.ventoSalidas) return;
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const D = () => { try{ return typeof data !== 'undefined' ? data : null; }catch(e){ return null; } };
  const plata = n => { try{ return fmt(Math.round(Number(n) || 0)); }catch(e){ return '$' + Math.round(Number(n) || 0).toLocaleString('es-CO'); } };
  const aviso = (m, ms) => { try{ showToast(m, ms); }catch(e){} };
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const dia = t => { const x = new Date(t); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
  const jefe = () => { try{ return !!(window.ventoRoles && window.ventoRoles.esJefe()); }catch(e){ return false; } };
  const puente = () => { try{ const A = window.VentoAndroid; return A && typeof A.pagosSalidasTomar === 'function' ? A : null; }catch(e){ return null; } };
  const negocio = () => { try{ const n = window.ventoNube && window.ventoNube.negocio && window.ventoNube.negocio(); if(n && n.id) return n.id; }catch(e){} const d = D(); return d && d.businessName ? 'local:' + norm(d.businessName) : ''; };
  const K = () => 'vento_salidas:' + negocio(), KR = () => 'vento_salidas_reglas:' + negocio();
  const leer = (k, d) => { try{ const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; }catch(e){ return d; } };
  const escribir = (k, v) => { try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} };

  // ---------- Leer el aviso ----------
  const VERBO = /enviaste|pagaste|pasaste|transferiste|compraste|compra exitosa|retiraste|sacaste|usted (?:envi|pag|transfiri|pas)/i;
  function montoDe(t){
    t = String(t || '');
    let m = /(?:\$|\bCOP)\s?(\d{1,3}(?:[.,\s ]\d{3})+|\d+)(?![\d])/i.exec(t)
         || /(?:enviaste|pagaste|pasaste|transferiste|compraste|retiraste|sacaste|\bpor|\bvalor(?: de)?)\s+(\d{1,3}(?:[.,]\d{3})+|\d{1,7})(?![\d.,]\d)/i.exec(t);
    if(!m) return 0;
    const n = parseInt(m[1].replace(/[.,\s ]/g, ''), 10);
    return n > 0 && n < 1e10 ? n : 0;
  }
  // A quién / dónde: «… a DISTRIBUIDORA EL SOL», «… en la Tienda Virtual por 20,000», «… para JUAN PÉREZ».
  function destinoDe(t){
    t = String(t || '').split('|').pop();
    const i = t.search(VERBO); if(i < 0) return '';
    const m = /\s(?:a|al|en|para)\s+(?:la\s+|el\s+|tu\s+)?([^.,;:!¡?\n]{2,60})/i.exec(t.slice(i));
    if(!m) return '';
    let d = m[1].replace(/\s+(?:por|desde|con|de tu|el d[ií]a|hoy|a las|ref|referencia|valor)\b.*$/i, '').replace(/\s*\$\s?\d[\d.,\s]*$/, '').replace(/\s+\d{1,3}(?:[.,]\d{3})+$/, '').trim();   // un valor al final, no un «80» del nombre
    if(/^(?:tu|su)\s/i.test(d) || d.length < 2) return '';
    return d.slice(0, 40);
  }
  function appDe(o){
    const s = (o.app || '') + ' ' + (o.txt || '');
    if(/daviplata|85888/i.test(s)) return 'DaviPlata';
    if(/nequi|85954/i.test(s)) return 'Nequi';
    const b = /bancolombia|davivienda|bbva|banco de bogot[aá]|av villas|scotiabank|colpatria|ita[uú]|nubank|lulo|movii|dale/i.exec(s);
    return b ? b[0].replace(/^./, c => c.toUpperCase()) : (String(o.app || '').replace(/^SMS\s+/, 'SMS ') || 'Banco');
  }

  // ---------- Pendientes (solo en este celular) ----------
  const lista = () => { const l = leer(K(), []); return Array.isArray(l) ? l : []; };
  const guardarLista = l => escribir(K(), l.slice(-200));
  function tomar(){
    const A = puente(); if(!A || !jefe() || !negocio()) return 0;
    let nuevos = [];
    try{ nuevos = JSON.parse(A.pagosSalidasTomar() || '[]') || []; }catch(e){ nuevos = []; }
    if(!nuevos.length) return 0;
    const l = lista(), ids = new Set(l.map(x => x.id));
    let n = 0, ultimo = null;
    nuevos.forEach(o => {
      if(!o || !o.id || ids.has(o.id)) return;
      const monto = montoDe(o.txt);
      if(!(monto > 0)) return;                                       // sin valor no se anota nada (nada inventado)
      const x = { id: String(o.id).slice(0, 80), app: appDe(o), monto, destino: destinoDe(o.txt), txt: String(o.txt || '').slice(0, 300), t: Number(o.t) || Date.now() };
      l.push(x); ids.add(x.id); n++; ultimo = x;
    });
    if(n){
      guardarLista(l); pintar();
      aviso(n === 1 ? '💸 Salió ' + plata(ultimo.monto) + ' por ' + ultimo.app + (ultimo.destino ? ' a ' + ultimo.destino : '') + ': clasifícala en Contabilidad.' : '💸 ' + n + ' salidas nuevas por clasificar en Contabilidad.', 4500);
    }
    return n;
  }

  // ---------- Sugerencias ----------
  const parecido = (a, b) => { a = norm(a); b = norm(b); return a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a)); };
  function factura(x){
    const d = D(); if(!d || !x.destino) return null;
    const desde = x.t - 60 * 864e5;
    return (d.purchases || []).find(pu => pu.supplier && parecido(pu.supplier, x.destino) && Math.abs((Number(pu.total) || 0) - x.monto) <= Math.max(1, x.monto * 0.005)
      && new Date(pu.at || pu.date).getTime() >= desde && new Date(pu.at || pu.date).getTime() <= x.t + 864e5) || null;
  }
  function sugerencia(x){
    const f = factura(x);
    if(f) return { k: 'ya', txt: 'Parece el pago de la factura de ' + f.supplier + ' (' + plata(f.total) + '), que ya cuenta como compra: «Ya estaba anotada» para no sumarla dos veces.' };
    const r = x.destino && leer(KR(), {})[norm(x.destino)];
    if(r && r.k === 'prov') return { k: 'prov', txt: 'La otra vez lo clasificaste como proveedor.' };
    if(r && r.k === 'gasto') return { k: 'gasto', cat: r.cat, txt: 'La otra vez lo clasificaste como «' + catNombre(r.cat) + '».' };
    const d = D();
    if(x.destino && d && (d.purchases || []).some(pu => pu.supplier && parecido(pu.supplier, x.destino))) return { k: 'prov', txt: 'Tiene el nombre de un proveedor de tus facturas.' };
    return null;
  }
  const cats = () => { try{ return ctCatsGasto(); }catch(e){ return [['proveedores', '📦 Proveedores / mercancía'], ['otros', '🗂️ Otros gastos']]; } };
  const catNombre = c => { const x = cats().find(y => y[0] === c); return x ? x[1].replace(/^\S+\s/, '') : c; };

  // ---------- Clasificar ----------
  function quitar(id){ guardarLista(lista().filter(x => x.id !== id)); }
  function recordar(x, regla){ if(!x.destino) return; const r = leer(KR(), {}); r[norm(x.destino)] = regla; escribir(KR(), r); }
  function gasto(x, cat, nota){
    const d = D(); if(!d) return false;
    d.contab = Array.isArray(d.contab) ? d.contab : [];
    d.contab.unshift({ id: 'ct' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), tipo: 'gasto', cat, monto: x.monto, fecha: dia(x.t),
      metodo: /nequi|daviplata/i.test(x.app) ? 'nequi' : 'transferencia', nota: nota.slice(0, 120), origen: 'salida', by: (typeof authUser !== 'undefined' && authUser) || '', at: Date.now() });
    try{ saveData(); }catch(e){}
    return true;
  }
  async function clasificar(id, k, cat){
    const x = lista().find(y => y.id === id); if(!x || !jefe()) return;
    const quien = x.destino ? ' ' + x.destino : '';
    if(k === 'prov'){
      gasto(x, 'proveedores', 'Pago a proveedor' + quien + ' (' + x.app + ')'); recordar(x, { k: 'prov' });
      aviso('📦 Gasto de proveedor de ' + plata(x.monto) + ' guardado en Contabilidad.');
    } else if(k === 'gasto'){
      if(!cat) return;
      gasto(x, cat, catNombre(cat) + (quien ? ' ·' + quien : '') + ' (' + x.app + ')'); recordar(x, { k: 'gasto', cat });
      aviso('🗂️ Gasto de ' + plata(x.monto) + ' guardado en «' + catNombre(cat) + '».');
    } else if(k === 'ya'){
      aviso('🔗 Listo: no se suma otra vez.');
    } else if(k === 'no'){
      let ok = true;
      try{ ok = await showConfirm({ title: '¿No es del negocio?', message: plata(x.monto) + ' por ' + x.app + (x.destino ? ' a ' + x.destino : '') + '. No se anota en Contabilidad.', confirmText: 'Sí, no es del negocio', cancelText: 'No', icon: '🙈' }); }catch(e){}
      if(!ok) return;
      recordar(x, { k: 'no' });
    } else return;
    quitar(id); pintar();
    try{ if(typeof renderConta === 'function' && $('view-contabilidad') && $('view-contabilidad').classList.contains('active')) renderConta(); }catch(e){}
  }

  // ---------- Pantalla: Contabilidad ----------
  function caja(){
    let box = $('salidasBox');
    if(box) return box;
    const ref = $('ctAviso'); if(!ref || !ref.parentNode) return null;
    box = document.createElement('div'); box.id = 'salidasBox'; box.className = 'settings-group sl-box'; box.hidden = true; box.setAttribute('data-novocab', '');
    ref.parentNode.insertBefore(box, ref.nextSibling);
    box.addEventListener('click', e => {
      const b = e.target.closest('button[data-sl]'); if(!b) return;
      const fila = b.closest('[data-id]'); if(!fila) return;
      if(b.dataset.sl === 'gasto'){ const s = fila.querySelector('.sl-cat'); s.hidden = !s.hidden; return; }
      if(b.dataset.sl === 'gok'){ clasificar(fila.dataset.id, 'gasto', fila.querySelector('.sl-cat select').value); return; }
      clasificar(fila.dataset.id, b.dataset.sl);
    });
    return box;
  }
  function pintar(){
    const box = caja(); if(!box) return;
    const l = jefe() ? lista() : [];
    box.hidden = !l.length;
    if(!l.length){ box.innerHTML = ''; return; }
    const hora = t => new Date(t).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
    const opts = cats().filter(c => c[0] !== 'proveedores').map(c => '<option value="' + esc(c[0]) + '">' + esc(c[1]) + '</option>').join('');
    box.innerHTML = '<h2>💸 Salidas de Nequi / DaviPlata por clasificar <i class="sl-n">' + l.length + '</i></h2>' +
      '<p class="settings-desc">Lo que enviaste o pagaste desde las apps del banco de este celular. Solo lo ves tú (administrador) y solo en este celular. Dinos qué fue y queda en tus gastos.</p>' +
      l.slice().sort((a, b) => b.t - a.t).map(x => {
        const s = sugerencia(x), on = k => s && s.k === k ? ' sl-sug' : '';
        return '<div class="sl-fila" data-id="' + esc(x.id) + '">' +
          '<div class="sl-top"><b class="sl-monto">' + plata(x.monto) + '</b><span class="sl-app">' + esc(x.app) + '</span><span class="sl-hora">' + esc(hora(x.t)) + '</span></div>' +
          '<div class="sl-a">' + (x.destino ? 'A <b>' + esc(x.destino) + '</b>' : '<small>' + esc(String(x.txt).split('|').pop().trim().slice(0, 120)) + '</small>') + '</div>' +
          (s ? '<div class="sl-pista">💡 ' + esc(s.txt) + '</div>' : '') +
          '<div class="sl-btns"><button type="button" class="btn-ghost' + on('prov') + '" data-sl="prov">📦 Proveedor</button><button type="button" class="btn-ghost' + on('gasto') + '" data-sl="gasto">🗂️ Otro gasto</button>' +
          '<button type="button" class="btn-ghost' + on('ya') + '" data-sl="ya">🔗 Ya estaba anotada</button><button type="button" class="btn-ghost" data-sl="no">🙈 No es del negocio</button></div>' +
          '<div class="sl-cat" hidden><select class="mz-in" aria-label="Categoría del gasto">' + opts + '</select><button type="button" class="btn-primary" data-sl="gok">Guardar</button></div>' +
        '</div>';
      }).join('');
    l.forEach(x => { const s = sugerencia(x); if(s && s.k === 'gasto' && s.cat){ const sel = box.querySelector('[data-id="' + (window.CSS && CSS.escape ? CSS.escape(x.id) : x.id) + '"] .sl-cat select'); if(sel) sel.value = s.cat; } });
  }

  const css = document.createElement('style');
  css.id = 'ventoSalidasCss';
  css.textContent =
    '.sl-box[hidden]{display:none}.sl-box h2 .sl-n{font-style:normal;font-size:13px;background:var(--brick);color:#fff;border-radius:999px;padding:1px 9px;vertical-align:middle;margin-left:4px}' +
    '.sl-fila{border:1px solid var(--line);border-radius:14px;padding:12px;margin-top:10px;display:flex;flex-direction:column;gap:6px;background:var(--surface)}' +
    '.sl-top{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}.sl-monto{font-size:20px;font-weight:900}.sl-app{font-weight:700}.sl-hora{color:var(--ink-soft);font-size:13px;margin-left:auto}' +
    '.sl-a{font-size:14px;overflow-wrap:anywhere}.sl-a small{color:var(--ink-soft)}.sl-pista{font-size:13px;color:var(--ink-soft)}' +
    '.sl-btns{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.sl-btns .btn-ghost{width:100%;margin:0;padding:9px 8px;font-size:13.5px}@media (min-width:760px){.sl-btns{grid-template-columns:repeat(4,minmax(0,1fr))}}' +
    '.sl-btns .sl-sug{border-color:var(--amber);box-shadow:0 0 0 1px var(--amber) inset;font-weight:800}' +
    '.sl-cat{display:flex;gap:6px}.sl-cat[hidden]{display:none}.sl-cat select{flex:1;min-width:0}.sl-cat .btn-primary{width:auto;margin:0;padding:8px 14px}';
  document.head.appendChild(css);

  // Se revisa al abrir, cada 20 s, al volver a la app y al entrar a Contabilidad.
  const revisar = () => { try{ tomar(); }catch(e){} try{ pintar(); }catch(e){} };
  setTimeout(revisar, 2500);
  setInterval(() => { if(!document.hidden) revisar(); }, 20000);
  document.addEventListener('visibilitychange', () => { if(!document.hidden) revisar(); });
  document.addEventListener('click', e => { const b = e.target && e.target.closest && e.target.closest('[data-view="contabilidad"], [data-go="contabilidad"], [data-o2ir="contabilidad"]'); if(b) setTimeout(revisar, 60); }, true);

  window.ventoSalidas = { tomar, pintar, lista, clasificar, montoDe, destinoDe, appDe, sugerencia, cuantas: () => (jefe() ? lista().length : 0) };
})();
