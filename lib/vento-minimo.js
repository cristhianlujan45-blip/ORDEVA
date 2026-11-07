/* ORDEVA · lib/vento-minimo.js — 1.95.0: 🍾 Consumo mínimo por mesa (bares, discotecas, gastrobares y restaurantes).
   • El dueño pone el mínimo de cada mesa (Ajustes → Negocio → «🍾 Consumo mínimo»: «1-4, 10» → $300.000) o el de una
     cuenta (en la cuenta → «🍾 Consumo mínimo»). El de la cuenta manda sobre el de la mesa y se va al cobrarla.
   • En la cuenta: «🍾 Consumo mínimo $300.000 · lleva $215.000 · faltan $85.000» (o «✅ ya cumplió»). La propina y la
     diferencia del mínimo no cuentan como consumo.
   • Al cobrar sin llegar al mínimo pregunta: «Cobrar el mínimo» (suma la línea «🍾 Consumo mínimo (diferencia)»), «Cobrar
     solo lo consumido» (queda anotado en la venta quién lo dejó así) o cancelar. Sin mínimo, no pregunta nada (true al
     tiro, igual que el motel y las comisiones).
   • La venta guarda el mínimo y el consumo (r.minimo = { minimo, consumo, diferencia, perdonado, por }). */
(function(){
  'use strict';
  if(window.ventoMinimo) return;
  const D = () => (typeof data !== 'undefined' ? data : null);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const plata = n => { try{ return fmt(Math.round(n || 0)); }catch(e){ return '$' + Math.round(n || 0).toLocaleString('es-CO'); } };
  const toast = (t, ms) => { try{ showToast(t, ms || 5000); }catch(e){} };
  const guardar = () => { try{ saveData(); }catch(e){} };
  const NOMBRE = '🍾 Consumo mínimo (diferencia)';
  const jefe = () => { try{ return !window.ventoRoles || window.ventoRoles.esJefe(); }catch(e){ return true; } };
  const quien = () => { try{ const y = window.ventoRoles && window.ventoRoles.yo ? window.ventoRoles.yo() : null; return (y && (y.nombre || y.email)) || ''; }catch(e){ return ''; } };
  function activo(){
    const d = D(); if(!d) return false;
    let t = null; try{ t = typeof tipoNegocio === 'function' ? tipoNegocio() : null; }catch(e){}
    return !!t && (t.fam === 'bar' || t.fam === 'comida');
  }
  const mesas = () => { const d = D(); if(!d.minimoMesas || typeof d.minimoMesas !== 'object') d.minimoMesas = {}; return d.minimoMesas; };
  function minimoDe(id){
    const d = D(), t = d && d.tables && d.tables[id]; if(!t || !activo()) return 0;
    if(t.minimo != null) return Math.max(0, Math.round(Number(t.minimo) || 0));
    return Math.max(0, Math.round(Number(mesas()[id]) || 0));
  }
  const esExtra = it => !it || it.name === NOMBRE || (it.productId == null && /propina/i.test(it.name || ''));
  function consumo(id){
    const d = D(), t = d && d.tables && d.tables[id]; if(!t) return 0;
    return (t.items || []).filter(it => !esExtra(it)).reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.qty) || 0), 0);
  }
  function estado(id){
    const m = minimoDe(id); if(!m) return null;
    const c = consumo(id); return { minimo: m, consumo: c, faltan: Math.max(0, m - c) };
  }
  // «1-4, 10, 12» → [1,2,3,4,10,12]
  function partirMesas(txt){
    const out = new Set();
    String(txt || '').split(/[,;\s]+/).forEach(p => {
      const r = /^(\d{1,3})(?:-(\d{1,3}))?$/.exec(p.trim()); if(!r) return;
      const a = +r[1], b = r[2] ? +r[2] : a;
      for(let i = Math.min(a, b); i <= Math.max(a, b) && i <= 500; i++) if(i > 0) out.add(i);
    });
    return [...out];
  }
  function ponerMesas(txt, monto){
    const l = partirMesas(txt), v = Math.max(0, Math.round(Number(String(monto).replace(/[^\d]/g, '')) || 0)), m = mesas();
    l.forEach(i => { if(v > 0) m[i] = v; else delete m[i]; });
    guardar(); return l;
  }
  function ponerCuenta(id, monto){
    const d = D(), t = d && d.tables && d.tables[id]; if(!t) return false;
    if(monto === null){ delete t.minimo; guardar(); return true; }
    t.minimo = Math.max(0, Math.round(Number(String(monto).replace(/[^\d]/g, '')) || 0)); guardar(); return true;
  }

  // ---------- Al cobrar ----------
  // true (al tiro) si no hay nada que preguntar; si no, una promesa: true = seguir con el cobro, false = canceló.
  function antesDeCobrar(id){
    // Una diferencia que quedó de un cobro que se canceló se vuelve a calcular (si no, se cobraría dos veces o de más).
    const d0 = D(), t0 = d0 && d0.tables && d0.tables[id];
    if(t0 && (t0.items || []).some(it => it && it.name === NOMBRE)){ t0.items = t0.items.filter(it => !(it && it.name === NOMBRE)); delete t0.minimoCobro; guardar(); try{ renderModalItems(); }catch(x){} }
    const e = estado(id); if(!e || !(e.faltan > 0)) return true;
    return new Promise(res => {
      const ov = document.createElement('div'); ov.className = 'overlay show cm-ov mn-ov'; ov.setAttribute('data-novocab', ''); ov.style.zIndex = '9700';
      let nom = String(id); try{ nom = tableLabel(id); }catch(x){}
      ov.innerHTML = '<div class="modal cm" role="dialog" aria-modal="true"><h2 style="margin:0 0 4px">🍾 No llegó al consumo mínimo</h2>' +
        '<div class="modal-sub">' + esc(nom) + ' consumió <b>' + plata(e.consumo) + '</b> y el mínimo es <b>' + plata(e.minimo) + '</b>: faltan <b>' + plata(e.faltan) + '</b>.</div>' +
        '<div class="modal-actions" style="flex-direction:column;align-items:stretch;gap:8px"><button type="button" class="btn-primary" data-r="si">Cobrar el mínimo (sumar ' + plata(e.faltan) + ')</button>' +
        '<button type="button" class="btn-ghost" data-r="no">Cobrar solo lo consumido</button><button type="button" class="btn-ghost" data-r="x">Cancelar</button></div></div>';
      document.body.appendChild(ov);
      let listo = false; const fin = v => { if(listo) return; listo = true; ov.remove(); res(v); };
      ov.addEventListener('click', ev => {
        if(ev.target === ov) return fin(false);
        const b = ev.target.closest('[data-r]'); if(!b) return;
        const d = D(), t = d && d.tables && d.tables[id];
        if(b.dataset.r === 'si' && t){
          t.items.push({ productId: null, name: NOMBRE, price: e.faltan, size: '', qty: 1, personId: null, history: [] });
          t.minimoCobro = { minimo: e.minimo, consumo: e.consumo, diferencia: e.faltan, perdonado: false };
          guardar(); try{ renderModalItems(); }catch(x){}
          return fin(true);
        }
        if(b.dataset.r === 'no' && t){
          t.minimoCobro = { minimo: e.minimo, consumo: e.consumo, diferencia: 0, perdonado: true, por: quien() };
          guardar(); return fin(true);
        }
        fin(false);
      });
    });
  }
  // La venta guarda el mínimo y el consumo; el mínimo de la cuenta se va (el de la mesa queda para el siguiente).
  function envolverCierre(){
    const orig = window.closeTableToHistory; if(typeof orig !== 'function' || orig._mn) return;
    const nuevo = function(id){
      const d = D(), t = d && d.tables && d.tables[id];
      const e = t ? estado(id) : null, mc = t && t.minimoCobro ? t.minimoCobro : null;
      const r = orig.apply(this, arguments);
      try{
        if(r && (mc || e)) r.minimo = mc || { minimo: e.minimo, consumo: e.consumo, diferencia: 0, perdonado: false };
        if(t){ delete t.minimo; delete t.minimoCobro; }
      }catch(x){}
      return r;
    };
    // Lleva las marcas de los demás módulos (si no, se envuelven uno al otro sin fin: 1.84.1).
    for(const k in orig) if(k.charAt(0) === '_') nuevo[k] = orig[k];
    nuevo._mn = true; window.closeTableToHistory = nuevo;
  }

  // ---------- En la cuenta ----------
  function pintar(){
    const ov = document.getElementById('overlay'), id = typeof currentTable !== 'undefined' ? currentTable : null;
    let box = document.getElementById('minBox');
    if(!activo() || !ov || !ov.classList.contains('show') || id == null){ if(box) box.hidden = true; return; }
    const e = estado(id), j = jefe();
    if(!e && !j){ if(box) box.hidden = true; return; }
    if(!box){
      const ref = document.getElementById('grupoBar') || ov.querySelector('.mesa-buscar'); if(!ref) return;
      box = document.createElement('div'); box.id = 'minBox'; box.setAttribute('data-novocab', '');
      box.style.cssText = 'margin:6px 0;padding:8px 12px;border-radius:12px;border:1px solid var(--line);display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap';
      ref.parentNode.insertBefore(box, ref.nextSibling);
      box.addEventListener('click', ev => { const b = ev.target.closest('[data-mn]'); if(b) abrirCuenta(currentTable); });
    }
    box.hidden = false;
    const html = e ? '<span>🍾 Consumo mínimo <b>' + plata(e.minimo) + '</b> · lleva ' + plata(e.consumo) + (e.faltan > 0 ? ' · <b style="color:var(--brick,#b42318)">faltan ' + plata(e.faltan) + '</b>' : ' · ✅ ya cumplió') + '</span>' + (j ? '<button type="button" class="btn-ghost" data-mn="1" style="padding:4px 10px">Cambiar</button>' : '')
      : '<button type="button" class="btn-ghost" data-mn="1" style="width:100%">🍾 Consumo mínimo</button>';
    if(box.dataset.h !== html){ box.dataset.h = html; box.innerHTML = html; }
  }
  function abrirCuenta(id){
    if(!jefe()) return toast('El consumo mínimo lo pone el dueño o el administrador.');
    const d = D(), t = d && d.tables && d.tables[id]; if(!t) return;
    const deMesa = Math.round(Number(mesas()[id]) || 0), actual = minimoDe(id);
    let nom = String(id); try{ nom = tableLabel(id); }catch(x){}
    const ov = document.createElement('div'); ov.className = 'overlay show cm-ov mn-ov'; ov.setAttribute('data-novocab', ''); ov.style.zIndex = '9700';
    ov.innerHTML = '<div class="modal cm" role="dialog" aria-modal="true"><h2 style="margin:0 0 4px">🍾 Consumo mínimo · ' + esc(nom) + '</h2>' +
      '<div class="modal-sub">Lo que esta cuenta debe consumir como mínimo. Si no llega, al cobrar ORDEVA pregunta si se cobra la diferencia.</div>' +
      '<input class="mz-in mn-monto" inputmode="numeric" placeholder="Ej. 300000" value="' + (actual || '') + '" style="width:100%;box-sizing:border-box;font-size:20px;text-align:center">' +
      '<label style="display:flex;gap:8px;align-items:center;margin-top:8px"><input type="checkbox" class="mn-siempre"' + (deMesa && t.minimo == null ? ' checked' : '') + '> Siempre para ' + esc(nom) + '</label>' +
      '<div class="modal-actions" style="flex-wrap:wrap"><button type="button" class="btn-ghost" data-r="x">Cancelar</button><button type="button" class="btn-ghost" data-r="sin">Sin mínimo</button><button type="button" class="btn-primary" data-r="ok">Guardar</button></div></div>';
    document.body.appendChild(ov);
    const cerrar = () => { ov.remove(); pintar(); };
    ov.addEventListener('click', ev => {
      if(ev.target === ov) return cerrar();
      const b = ev.target.closest('[data-r]'); if(!b) return;
      if(b.dataset.r === 'x') return cerrar();
      const siempre = ov.querySelector('.mn-siempre').checked;
      if(b.dataset.r === 'sin'){ ponerCuenta(id, 0); if(siempre) ponerMesas(String(id), 0); toast('Sin consumo mínimo para ' + nom + '.'); return cerrar(); }
      const v = Math.round(Number(String(ov.querySelector('.mn-monto').value).replace(/[^\d]/g, '')) || 0);
      if(!(v > 0)) return toast('Escribe el valor del consumo mínimo.');
      if(siempre){ ponerMesas(String(id), v); ponerCuenta(id, null); } else ponerCuenta(id, v);
      toast('🍾 Consumo mínimo de ' + plata(v) + (siempre ? ' para ' + nom + ' (siempre).' : ' para esta cuenta.'));
      cerrar();
    });
    setTimeout(() => { try{ ov.querySelector('.mn-monto').focus(); }catch(x){} }, 50);
  }

  // ---------- Ajustes → Negocio ----------
  function pintarAjustes(){
    const g = document.querySelector('#view-ajustes .settings-group[data-cat="negocio"]'); if(!g) return;
    let box = document.getElementById('minAjustes');
    if(!activo() || !jefe()){ if(box) box.remove(); return; }
    if(!box){ box = document.createElement('div'); box.id = 'minAjustes'; box.className = 'settings-row'; box.style.cssText = 'flex-direction:column;align-items:stretch;gap:8px'; g.appendChild(box); }
    const m = mesas(), ks = Object.keys(m).map(Number).filter(k => m[k] > 0).sort((a, b) => a - b);
    const etq = k => { try{ return tableLabel(k); }catch(e){ return 'Mesa ' + k; } };
    box.innerHTML = '<div class="settings-row-text"><strong>🍾 Consumo mínimo por mesa</strong><span>Para las mesas VIP o reservadas. Si la cuenta no llega, al cobrar ORDEVA pregunta si se cobra la diferencia.</span></div>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap"><input class="mz-in" id="mnMesas" placeholder="Mesas: 1-4, 10" style="flex:1;min-width:120px"><input class="mz-in" id="mnMonto" inputmode="numeric" placeholder="Valor" style="width:110px"><button type="button" class="btn-primary" id="mnPoner">Poner</button></div>' +
      (ks.length ? '<div class="mn-lista">' + ks.map(k => '<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0"><span>' + esc(etq(k)) + ' · <b>' + plata(m[k]) + '</b></span><button type="button" class="btn-ghost" data-mnq="' + k + '">Quitar</button></div>').join('') + '</div>' : '<small>Ninguna mesa tiene consumo mínimo.</small>');
    box.querySelector('#mnPoner').onclick = () => {
      const l = ponerMesas(box.querySelector('#mnMesas').value, box.querySelector('#mnMonto').value);
      if(!l.length) return toast('Escribe las mesas, por ejemplo «1-4, 10».');
      toast('🍾 Consumo mínimo listo en ' + l.length + (l.length === 1 ? ' mesa.' : ' mesas.')); pintarAjustes();
    };
    box.querySelectorAll('[data-mnq]').forEach(b => { b.onclick = () => { delete mesas()[b.dataset.mnq]; guardar(); pintarAjustes(); }; });
  }
  document.addEventListener('click', ev => { if(ev.target.closest && ev.target.closest('.ajustes-cat[data-cat="negocio"], nav button[data-view="ajustes"], .more-tile[data-go]')) setTimeout(pintarAjustes, 95); }, true);

  envolverCierre();
  setInterval(() => { try{ envolverCierre(); pintar(); }catch(e){} }, 500);
  setTimeout(() => { try{ pintarAjustes(); }catch(e){} }, 3000);
  window.ventoMinimo = { activo, minimoDe, consumo, estado, partirMesas, ponerMesas, ponerCuenta, antesDeCobrar, abrirCuenta, pintarAjustes, NOMBRE };
})();
