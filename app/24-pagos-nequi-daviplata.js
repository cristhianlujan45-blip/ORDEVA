/* ORDEVA · app/24-pagos-nequi-daviplata.js — antes estaba dentro de index.html (línea 32379). Se carga en el mismo lugar y orden. */
/* ==================== 💜 Pagos Nequi / Daviplata: registrar en la cuenta + panel del día ====================
   El aviso del pago ya llega solo (MacroDroid → canal privado → ORDEVA, ver «Verificar pagos» en Ajustes).
   Esto agrega lo que faltaba para usarlo de verdad en la caja:
   • Ventana «💜 Llegó un pago» con un botón para REGISTRARLO en la cuenta que lo debe (o elegir cuál).
     Se anota como transferencia con la app, quién pagó y la marca de verificado; nunca se registra dos veces.
   • Panel «💜 Pagos de hoy» (Más → Pagos Nequi / Daviplata): total del día por app, la lista con su estado
     (✅ confirmado, ⚠️ revisar, 🚨 falso) y acciones. Desde ahí se configura si aún no está activo.
   • ORDEVA responde «¿cuánto me ha llegado por Nequi hoy?» y avisa en su tarjeta los pagos sin registrar. */
(function(){
  const plata = n => '$' + Math.round(n || 0).toLocaleString('es-CO');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const lista = () => ((typeof data !== 'undefined' && data && data.pagos && data.pagos.lista) || []);
  const confirmado = x => !x.estado || x.estado === 'app' || x.estado === 'ok';
  const saldoDe = id => { try{ return tableTotal(id) - tablePaid(id); }catch(e){ return 0; } };
  const mesasConSaldo = () => Object.keys(data.tables || {}).map(Number).filter(id => (data.tables[id].items || []).length && saldoDe(id) > 0);

  function registrar(x, mesa){
    if(!x || x.aplicado) return '⚠️ Ese pago ya estaba registrado en ' + (x && x.aplicado ? tableLabel(x.aplicado) : 'una cuenta') + '.';
    const t = data.tables[mesa]; if(!t) return 'No encontré esa cuenta.';
    t.payments = t.payments || [];
    // 1.55.0: sin el nombre de quien pagó (la cuenta queda en el historial, que ve todo el equipo); el dueño lo ve en el pago.
    t.payments.push({ note: '💜 ' + x.app + ' (verificado)', amount: x.monto, method: 'transferencia', pagoDigital: { id: x.id, app: x.app } });
    x.aplicado = mesa; x.mesa = mesa;
    saveData();
    try{ renderMesas(); }catch(e){}
    try{ if(typeof currentTable !== 'undefined' && currentTable === mesa) renderModalItems(); }catch(e){}
    try{ window.Laya && window.Laya.registrar('ejecución', 'Pago ' + x.app + ' ' + plata(x.monto) + ' registrado en ' + tableLabel(mesa)); }catch(e){}
    try{ window.layaPintarTarjeta && window.layaPintarTarjeta(); }catch(e){}
    const queda = saldoDe(mesa);
    return '✅ ' + plata(x.monto) + ' por ' + x.app + ' registrado en ' + tableLabel(mesa) + '. ' + (queda > 0 ? 'Le falta ' + plata(queda) + '.' : queda < 0 ? 'Pagó ' + plata(-queda) + ' de más.' : 'Quedó al día. 🎉');
  }

  // ---------- Ventana «Llegó un pago» ----------
  function ventana(){
    let ov = document.getElementById('pagoOv');
    if(!ov){ ov = document.createElement('div'); ov.id = 'pagoOv'; ov.className = 'overlay'; document.body.appendChild(ov);
      ov.addEventListener('click', e => { if(e.target === ov) ov.classList.remove('show'); }); }
    return ov;
  }
  window.pagoLlego = function(x, aMano){
    if(!x || !confirmado(x) || x.aplicado) return;
    try{ if(typeof authIsAdmin === 'function' && !authIsAdmin() && !aMano) return; }catch(e){}
    const ov = ventana(), mesas = mesasConSaldo(), sug = x.mesa && data.tables[x.mesa] ? x.mesa : null;
    const op = mesas.map(id => '<option value="' + id + '"' + (id === sug ? ' selected' : '') + '>' + esc(tableLabel(id)) + ' · debe ' + plata(saldoDe(id)) + '</option>').join('');
    ov.innerHTML = '<div class="modal pago-modal"><h2>💜 Llegó un pago</h2>' +
      '<div class="pago-monto">' + plata(x.monto) + '</div><div class="modal-sub">' + esc(x.app) + (pagoDet(x).de ? ' · de <b>' + esc(pagoDet(x).de) + '</b>' : '') + ' · ✅ verificado por la app del banco</div>' +
      (sug ? '<button type="button" class="btn-primary pago-go" data-m="' + sug + '">Registrar en ' + esc(tableLabel(sug)) + ' (debe ' + plata(saldoDe(sug)) + ')</button>' :
        (x.cands || []).filter(id => data.tables[id]).length ? '<div class="modal-sub">¿De cuál cuenta es?</div>' + (x.cands || []).filter(id => data.tables[id]).map(id => '<button type="button" class="btn-primary pago-go" data-m="' + id + '" style="margin-top:6px">' + esc(tableLabel(id)) + ' · debe ' + plata(saldoDe(id)) + '</button>').join('') : '') +
      (mesas.length ? '<div class="pago-otra"><select id="pagoMesaSel" class="mz-in">' + (sug ? '' : '<option value="">¿De qué cuenta es?</option>') + op + '</select><button type="button" class="btn-ghost" id="pagoOtraBtn">' + (sug ? 'Es de otra' : 'Registrar') + '</button></div>' : '<div class="modal-sub">No hay cuentas abiertas con saldo: queda guardado en «💜 Pagos».</div>') +
      '<div class="modal-actions"><button type="button" class="btn-close" id="pagoSolo">Solo guardar</button></div></div>';
    const fin = m => {
      ov.classList.remove('show');
      // Pago del Servidor ORDEVA: el servidor deja registrarlo una sola vez aunque esté abierto en varios celulares.
      if(x.srv && window.ventoPagosAntesDeRegistrar) return window.ventoPagosAntesDeRegistrar(x, m).then(gane => {
        if(gane === false){ x.aplicado = x.aplicado || m; saveData(); showToast('Ese pago ya lo registró otro celular.', 6000); }
        else showToast(registrar(x, m), 7000);
      });
      showToast(registrar(x, m), 7000);
    };
    ov.querySelectorAll('.pago-go').forEach(go => { go.onclick = () => fin(+go.dataset.m); });
    const ob = ov.querySelector('#pagoOtraBtn'); if(ob) ob.onclick = () => { const v = +ov.querySelector('#pagoMesaSel').value; if(!v) return showToast('Elige la cuenta.'); fin(v); };
    ov.querySelector('#pagoSolo').onclick = () => { x.ignorado = true; saveData(); ov.classList.remove('show'); try{ window.layaPintarTarjeta && window.layaPintarTarjeta(); }catch(e){} };
    ov.classList.add('show');
  };

  window.pagoRegistrar = registrar;   // lo usa nube/vento-pagos.js cuando el servidor confirma un cobro de la cuenta

  // ---------- Resumen (lo usa ORDEVA) ----------
  window.pagosResumen = function(pe, mesa){
    const ini = pe && pe.ini || new Date().setHours(0, 0, 0, 0), fin = pe && pe.fin || Date.now() + 1, txt = pe && pe.txt || 'hoy';
    if(!(data.pagos && data.pagos.on)) return '💜 Los avisos de Nequi y Daviplata no están activados. Actívalos en Ajustes → 💜 Pagos → «📘 Paso a paso: agregar DaviPlata o Nequi».';
    if(mesa){ const l = lista().filter(x => x.mesa === mesa && Date.now() - x.t < 6 * 36e5 && x.estado !== 'falso');
      return l.length ? '💜 ' + tableLabel(mesa) + ': ' + l.map(x => plata(x.monto) + ' por ' + x.app + (pagoDet(x).de ? ' de ' + pagoDet(x).de : '') + (confirmado(x) ? ' ✅' : ' ⚠️ revisar') + (x.aplicado ? ' (registrado)' : '')).join('; ') + '.' : '⏳ No ha llegado ningún pago de ' + tableLabel(mesa) + ' en las últimas horas.'; }
    const l = lista().filter(x => x.t >= ini && x.t < fin);
    const ok = l.filter(confirmado), rev = l.filter(x => x.estado === 'revisar'), fal = l.filter(x => x.estado === 'falso');
    if(!l.length) return '💜 No han llegado pagos por Nequi ni Daviplata ' + txt + '.';
    const porApp = {}; ok.forEach(x => { porApp[x.app] = (porApp[x.app] || 0) + x.monto; });
    return '💜 Pagos que llegaron ' + txt + ': ' + plata(ok.reduce((a, x) => a + x.monto, 0)) + ' confirmados en ' + ok.length + ' pago' + (ok.length === 1 ? '' : 's') + '.\n' +
      Object.entries(porApp).map(([a, v]) => '• ' + a + ': ' + plata(v)).join('\n') +
      (ok.filter(x => !x.aplicado).length ? '\n• Sin registrar en una cuenta: ' + ok.filter(x => !x.aplicado).length : '') +
      (rev.length ? '\n• ⚠️ Por revisar (llegaron por SMS): ' + rev.length : '') + (fal.length ? '\n• 🚨 Falsos detectados: ' + fal.length : '');
  };

  // ---------- Panel «💜 Pagos de hoy» ----------
  window.pagosAbrirPanel = function(){
    let ov = document.getElementById('pagosPanelOv');
    if(!ov){ ov = document.createElement('div'); ov.id = 'pagosPanelOv'; ov.className = 'overlay'; document.body.appendChild(ov);
      ov.addEventListener('click', e => {
        if(e.target === ov || e.target.closest('[data-pp="cerrar"]')) return ov.classList.remove('show');
        if(e.target.closest('[data-pp="guia"]')){ ov.classList.remove('show'); try{ window.ventoPagosGuia(); }catch(x){} return; }
        if(e.target.closest('[data-pp="config"]')){ ov.classList.remove('show'); const b = document.querySelector('nav button[data-view="ajustes"]') ; try{ asisGoView('ajustes'); }catch(x){ b && b.click(); } setTimeout(() => { const c = document.querySelector('.ajustes-cat[data-cat="pagos"]'); c && c.click(); setTimeout(() => { const g = document.getElementById('pgGrupo'); g && g.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 300); }, 300); return; }
        const r = e.target.closest('[data-reg]'); if(r){ const x = lista().find(y => y.id === r.dataset.reg); if(x){ x.ignorado = false; window.pagoLlego(x, true); } return; }
        const v = e.target.closest('[data-vi]'); if(v){ const x = lista().find(y => y.id === v.dataset.vi); if(x){ x.estado = 'ok'; saveData(); pintar(); window.pagoLlego(x, true); } }
      }); }
    function pintar(){
      const on = data.pagos && data.pagos.on, hoy = new Date().setHours(0, 0, 0, 0), l = lista().slice(0, 40), hoyL = lista().filter(x => x.t >= hoy);
      const ok = hoyL.filter(confirmado), porApp = {}; ok.forEach(x => { porApp[x.app] = (porApp[x.app] || 0) + x.monto; });
      const sello = x => x.estado === 'falso' ? '<span class="pp-s pp-f">🚨 Falso</span>' : x.estado === 'revisar' ? '<span class="pp-s pp-r">⚠️ Revisar</span>' : '<span class="pp-s pp-ok">✅</span>';
      ov.innerHTML = '<div class="modal" style="max-width:520px"><h2>💜 Pagos Nequi / Daviplata</h2>' +
        (on ? '<div class="pp-total"><small>Hoy, confirmados</small><b>' + plata(ok.reduce((a, x) => a + x.monto, 0)) + '</b><span>' + (Object.entries(porApp).map(([a, v]) => a + ' ' + plata(v)).join(' · ') || 'Todavía nada hoy') + '</span></div>'
          : '<div class="pp-off"><b>Los avisos de pago no están activados.</b><br>' + (window.VentoAndroid && window.VentoAndroid.pagosAvisosTomar ? 'Prende «Recibir avisos de pagos»: la app de ORDEVA lee directo el aviso de DaviPlata o Nequi de este celular y te dice «Pago confirmado» con el valor y quién te pagó.' : 'Con la app ORDEVA para Android en el celular donde tienes DaviPlata o Nequi, cada pago que te llega sale aquí en un segundo y ORDEVA dice «Pago confirmado».') + '<br><button type="button" class="btn-primary" data-pp="guia" style="margin-top:10px">📘 Paso a paso: agregar DaviPlata o Nequi</button> <button type="button" class="btn-ghost" data-pp="config" style="margin-top:10px">⚙️ Ajustes de pagos</button></div>') +
        (l.length ? '<div class="pp-lista">' + l.map(x => '<div class="pp-fila' + (x.estado === 'falso' ? ' pp-tach' : '') + '"><span><b>' + plata(x.monto) + '</b> ' + esc(x.app) + (pagoDet(x).de ? ' · ' + esc(pagoDet(x).de) : '') + '<small>' + new Date(x.t).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) + (x.aplicado ? ' · registrado en ' + esc(tableLabel(x.aplicado)) : x.mesa ? ' · coincide con ' + esc(tableLabel(x.mesa)) : '') + '</small></span>' + sello(x) +
          (x.estado === 'revisar' ? '<button type="button" class="btn-ghost" data-vi="' + esc(x.id) + '">Lo vi en la app</button>' : (confirmado(x) && !x.aplicado ? '<button type="button" class="btn-ghost" data-reg="' + esc(x.id) + '">Registrar</button>' : '')) + '</div>').join('') + '</div>' : (on ? '<div class="modal-sub">Aún no ha llegado ningún pago.</div>' : '')) +
        '<div class="modal-actions" style="flex-wrap:wrap;gap:8px">' + (on ? '<button type="button" class="btn-ghost" data-pp="config">⚙️ Configuración</button>' : '') + '<button type="button" class="btn-close" data-pp="cerrar">Cerrar</button></div></div>';
    }
    pintar(); ov.classList.add('show');
  };

  // ==================== 🧮 Calculadora (teclado grande + por voz) ====================
  function evaluar(expr){
    const tk = String(expr).replace(/,/g, '.').match(/\d*\.?\d+|[+\-×÷%()]/g) || [];
    let i = 0;
    const num = () => { let t = tk[i++]; if(t === '-') return -num(); if(t === '('){ const v = suma(); i++; return v; } let v = parseFloat(t); if(tk[i] === '%'){ i++; v = v / 100; } return v; };
    const prod = () => { let v = num(); while(tk[i] === '×' || tk[i] === '÷'){ const o = tk[i++], b = num(); if(o === '÷' && b === 0) throw new Error('No se puede dividir entre cero'); v = o === '×' ? v * b : v / b; } return v; };
    const suma = () => { let v = prod(); while(tk[i] === '+' || tk[i] === '-'){ const o = tk[i++]; let b = prod(); if(tk[i - 1] === '%' ) b = v * b; v = o === '+' ? v + b : v - b; } return v; };
    const r = suma(); if(!isFinite(r)) throw new Error('Cuenta inválida'); return r;
  }
  const fmtN = n => (Math.round(n * 100) / 100).toLocaleString('es-CO', { maximumFractionDigits: 2 });
  window.calculadoraAbrir = function(){
    let ov = document.getElementById('calcOv');
    const cinta = () => { try{ return JSON.parse(localStorage.getItem('vento_calc_cinta')) || []; }catch(e){ return []; } };
    const guardarCinta = l => { try{ localStorage.setItem('vento_calc_cinta', JSON.stringify(l.slice(-30))); }catch(e){} };
    if(!ov){
      ov = document.createElement('div'); ov.id = 'calcOv'; ov.className = 'overlay';
      const K = [['C', 'k-c'], ['⌫', 'k-c'], ['%', 'k-o'], ['÷', 'k-o'], ['7'], ['8'], ['9'], ['×', 'k-o'], ['4'], ['5'], ['6'], ['-', 'k-o'], ['1'], ['2'], ['3'], ['+', 'k-o'], ['0'], ['000'], ['.'], ['=', 'k-ig']];
      ov.innerHTML = '<div class="modal calc-modal"><div class="calc-h"><h2>🧮 Calculadora</h2><button type="button" class="btn-ghost" data-k="cerrar">Cerrar</button></div>' +
        '<div class="calc-cinta" id="calcCinta"></div><div class="calc-exp" id="calcExp"></div><div class="calc-pant" id="calcPant">0</div>' +
        '<div class="calc-grid">' + K.map(([k, c]) => '<button type="button" class="' + (c || '') + '" data-k="' + k + '">' + (k === '-' ? '−' : k) + '</button>').join('') + '</div>' +
        '<button type="button" class="calc-mic" id="calcMic">🎤 Dicta la cuenta (ej. «3 por 4000 más 2 por 3500»)</button></div>';
      document.body.appendChild(ov);
      let exp = '';
      const pant = () => ov.querySelector('#calcPant'), expEl = () => ov.querySelector('#calcExp');
      const pintarCinta = () => { const l = cinta(); ov.querySelector('#calcCinta').innerHTML = l.slice(-6).map(x => '<div><span>' + esc(x.e) + '</span><b>= ' + esc(x.r) + '</b></div>').join(''); const c = ov.querySelector('#calcCinta'); c.scrollTop = c.scrollHeight; };
      const vista = () => { expEl().textContent = exp && !/^-?[\d.]+$/.test(exp) ? exp.replace(/-/g, '−') : ''; let v = ''; try{ v = exp && /\d$|%$|\)$/.test(exp) ? fmtN(evaluar(exp)) : ''; }catch(e){} pant().textContent = v || (exp ? '…' : '0'); };
      ov.calcEx = { set: e => { exp = e; vista(); }, cinta: pintarCinta };
      ov.addEventListener('click', e => {
        if(e.target === ov) return ov.classList.remove('show');
        const b = e.target.closest('[data-k]'); if(!b) return;
        const k = b.dataset.k;
        if(k === 'cerrar') return ov.classList.remove('show');
        if(k === 'C') exp = ''; else if(k === '⌫') exp = exp.slice(0, -1);
        else if(k === '='){ if(!exp) return; try{ const r = evaluar(exp); const l = cinta(); l.push({ e: exp.replace(/-/g, '−'), r: fmtN(r) }); guardarCinta(l); pintarCinta(); exp = String(Math.round(r * 100) / 100); }catch(er){ pant().textContent = er.message; return; } }
        else if(/[+\-×÷%]/.test(k)){ if(!exp && k !== '-') exp = (cinta().slice(-1)[0] ? cinta().slice(-1)[0].r.replace(/\./g, '').replace(',', '.') : '0'); exp = exp.replace(/[+\-×÷]$/, '') + k; }
        else exp += k;
        vista();
      });
      // Teclado físico (computador)
      document.addEventListener('keydown', e => { if(!ov.classList.contains('show')) return; const m = { '*': '×', '/': '÷', 'Enter': '=', 'Backspace': '⌫', 'Escape': 'cerrar', ',': '.' }; const k = m[e.key] || e.key; const b = ov.querySelector('[data-k="' + (k === '=' ? '=' : k) + '"]'); if(b){ e.preventDefault(); b.click(); } });
      // Por voz: varias cuentas a la vez (usa la calculadora de voz de la app)
      ov.querySelector('#calcMic').onclick = () => {
        const R = window.SpeechRecognition || window.webkitSpeechRecognition;
        if(!R) return showToast('Este navegador no deja dictar. Usa Chrome.');
        const rec = new R(); rec.lang = 'es-CO'; rec.interimResults = false; rec.maxAlternatives = 3;
        const btn = ov.querySelector('#calcMic'); btn.classList.add('on'); btn.textContent = '🎙️ Escuchando…';
        rec.onresult = ev => {
          const alts = Array.from(ev.results[0]).map(a => a.transcript);
          let r = null; for(const a of alts){ r = window.ventoCalcular && (window.ventoCalcular(a, false)); if(r) break; }
          if(!r){ showToast('No entendí la cuenta: «' + alts[0] + '». Prueba «cuánto es 3500 más 4000».'); return; }
          const l = cinta(); r.texto.split('\n').forEach(x => { const m = x.replace(/^🧮 /, '').split(' = '); l.push({ e: m[0], r: m[1] }); }); guardarCinta(l); pintarCinta();
          ov.calcEx.set(String(Math.round(r.valores[r.valores.length - 1] * 100) / 100));
          try{ window.ventoHablar && window.ventoHablar(r.voz); }catch(e){}
        };
        rec.onerror = () => showToast('No te escuché. Intenta de nuevo.');
        rec.onend = () => { btn.classList.remove('on'); btn.textContent = '🎤 Dicta la cuenta (ej. «3 por 4000 más 2 por 3500»)'; };
        try{ rec.start(); }catch(e){ rec.onend(); }
      };
      pintarCinta();
    }
    ov.classList.add('show');
  };
  window.calculadoraEvaluar = evaluar;   // para pruebas

  const st = document.createElement('style');
  st.textContent = '.pago-modal{max-width:420px;text-align:center}.pago-monto{font:800 40px/1.1 var(--font-main);margin:6px 0 2px;color:var(--paid,#22c55e)}.pago-go{width:100%;padding:14px;font-size:16px;margin:10px 0 6px}' +
    '.pago-otra{display:flex;gap:8px;margin:6px 0}.pago-otra select{flex:1;min-width:0;font-size:16px}' +
    '.pp-total{display:flex;flex-direction:column;align-items:center;border:1px solid var(--line);border-radius:14px;padding:12px;margin:8px 0;background:var(--surface-2,transparent)}.pp-total b{font-size:30px}.pp-total small,.pp-total span{color:var(--ink-soft);font-size:13px}' +
    '.pp-off{border:1px dashed var(--line);border-radius:14px;padding:12px;margin:8px 0;font-size:14px;line-height:1.5}.pp-lista{display:flex;flex-direction:column;max-height:46vh;overflow:auto;margin:6px 0}' +
    '.pp-fila{display:flex;gap:8px;align-items:center;padding:8px 2px;border-top:1px solid var(--line);font-size:14px}.pp-fila>span{flex:1;min-width:0;overflow-wrap:anywhere}.pp-fila small{display:block;color:var(--ink-soft);font-size:12px}.pp-tach{opacity:.7;text-decoration:line-through}' +
    '.gp-modal{max-width:560px;width:100%;max-height:92vh;overflow:auto}.gp-lista{list-style:none;margin:10px 0 0;padding:0;display:flex;flex-direction:column;gap:10px}.gp-paso{display:flex;gap:10px;align-items:flex-start;border:1px solid var(--line);border-radius:14px;padding:10px 12px}' +
    '.gp-n{flex:0 0 28px;height:28px;border-radius:50%;display:grid;place-items:center;font-weight:800;background:color-mix(in srgb,var(--amber,#8b5cf6) 25%,transparent)}.gp-c{font-size:14px;line-height:1.5;margin-top:4px;color:var(--ink-soft)}.gp-c b{color:var(--ink)}' +
    '.gp-e{display:inline-block;margin-left:6px;font-size:12px;font-weight:800;white-space:nowrap}.gp-si{color:#22c55e}.gp-no{color:#f5a524}.gp-btn{margin-top:8px;display:inline-block;text-decoration:none;padding:9px 14px}.gp-alerta{border:1px dashed #f5a524;border-radius:12px;padding:10px;margin:8px 0;font-size:14px}' +
    '.pp-s{font-weight:800;font-size:12px;white-space:nowrap}.pp-f{color:#e5484d}.pp-r{color:#f5a524}.pp-ok{color:#22c55e}' +
    '.calc-modal{max-width:400px;width:100%}.calc-h{display:flex;justify-content:space-between;align-items:center}.calc-h h2{margin:0}' +
    '.calc-cinta{max-height:120px;overflow:auto;margin:8px 0 4px;font-size:14px;color:var(--ink-soft)}.calc-cinta div{display:flex;justify-content:space-between;gap:8px;padding:2px 0}.calc-cinta b{color:var(--ink)}' +
    '.calc-exp{min-height:22px;text-align:right;color:var(--ink-soft);font-size:16px;overflow-wrap:anywhere}.calc-pant{text-align:right;font:800 38px/1.2 var(--font-main);padding:4px 2px 10px;overflow-wrap:anywhere}' +
    '.calc-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.calc-grid button{padding:16px 0;border-radius:14px;border:1px solid var(--line);background:var(--surface-2,transparent);color:inherit;font:700 22px var(--font-main);cursor:pointer}' +
    '.calc-grid .k-o{background:color-mix(in srgb,var(--amber,#f59e0b) 22%,transparent)}.calc-grid .k-c{color:var(--brick,#e5484d)}.calc-grid .k-ig{background:var(--paid,#22c55e);color:#fff;border:0}' +
    '.calc-mic{width:100%;margin-top:10px;padding:12px;border-radius:14px;border:1px solid var(--amber,#f59e0b);background:transparent;color:inherit;font:600 14px var(--font-main);cursor:pointer}.calc-mic.on{background:var(--brick,#e5484d);color:#fff}';
  document.head.appendChild(st);
})();
