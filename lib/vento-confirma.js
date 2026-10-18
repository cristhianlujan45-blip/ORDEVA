/* =====================================================================
   Vento · Confirmación de pagos (Nequi, DaviPlata, Bre-B)

   1. ⏳ «Esperando el pago»: en la cuenta, el cajero toca «Esperando Nequi / DaviPlata» y sale el valor en grande.
      Cuando llega la plata, la pantalla se pone verde («✅ PAGADO $45.000 · Nequi»), se registra sola en esa cuenta y
      queda «↩ Deshacer». Un abono deja la pantalla esperando lo que falta; un poquito de más es propina.
   2. La mesa correcta: la que espera el pago, la que se está cobrando, el valor exacto, la propina o el abono. Con dos
      mesas que deben lo mismo y nada que las distinga, se pregunta con botones (antes se escogía una a ciegas).
   3. Aviso sin el valor (llave Bre-B de DaviPlata): si el SMS con el valor no llega en 20 s, salen las mesas que
      esperaban el pago para registrarlo con un toque (o poner el valor). Si después llega el valor, se junta solo.
   4. Mesero, empleado o cajero: solo «✅ Mesa 3 ya pagó», sin el valor ni quién pagó (lo de Nequi lo ve el administrador).
   5. Cuadre en «📊 Caja de hoy»: lo que llegó, lo registrado y lo que quedó sin registrar o por revisar.
   6. El mismo pago por SMS y por la app de otro equipo → uno solo (en index.html, pgRecibir, para los de este equipo).
   No cambia el modo de mesas, la caja ni cómo llegan los avisos.
   ===================================================================== */
(function(){
  'use strict';
  const D = () => (typeof data !== 'undefined' && data) ? data : null;
  const G = () => { const d = D(); if(!d) return null; if(!d.pagos) d.pagos = { on: false, lista: [], vistos: [], espera: {} }; const g = d.pagos; g.lista = g.lista || []; g.espera = g.espera || {}; return g; };
  const plata = n => '$' + Math.round(Number(n) || 0).toLocaleString('es-CO');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const etq = id => { try{ return tableLabel(id); }catch(e){ return 'Mesa ' + id; } };
  const total = id => { try{ return tableTotal(id); }catch(e){ return 0; } };
  const saldo = id => { try{ return tableTotal(id) - tablePaid(id); }catch(e){ return 0; } };
  const mesa = id => { const d = D(); return d && d.tables ? d.tables[id] : null; };
  const conCuenta = () => Object.keys((D() || {}).tables || {}).map(Number).filter(id => { const t = mesa(id); return t && (t.items || []).length && saldo(id) > 0; });
  const jefe = () => { try{ return !window.ventoRoles || window.ventoRoles.esJefe(); }catch(e){ return true; } };
  const miEq = () => { try{ return window.ventoPagosEquipo ? window.ventoPagosEquipo() : ''; }catch(e){ return ''; } };
  const confirmado = x => !x.estado || x.estado === 'app' || x.estado === 'ok';
  const guardar = () => { try{ saveData(); }catch(e){} };
  const toast = (t, ms) => { try{ showToast(t, ms || 6000); }catch(e){} };
  const decir = t => { try{ if(window.ventoDecirPago) window.ventoDecirPago(t); }catch(e){} };
  const viendo = () => { try{ const A = window.VentoAndroid; return A && A.alFrente ? !!A.alFrente() : document.visibilityState === 'visible'; }catch(e){ return true; } };
  const propinaMax = s => Math.max(5000, Math.round(s * 0.2));

  // ---------- Pantallas abiertas (se ven en todos los equipos: data.pagos.pantallas) ----------
  const VIVA = 60e3;
  function pantallas(){ const g = G(); if(!g) return {}; if(!g.pantallas) g.pantallas = {}; return g.pantallas; }
  const viva = id => { const q = pantallas()[id]; return !!q && Date.now() - (q.t || 0) < VIVA; };

  // ---------- 2. ¿De qué mesa es este valor? ----------
  // Puntos: pantalla «Esperando el pago» > el cliente avisó / se está cobrando > valor exacto. Una propina (un poco más) o
  // un abono (menos) solo cuentan en la mesa que espera el pago o se está cobrando, y nunca si otra mesa debe ese valor exacto.
  function candidatas(monto){
    monto = Number(monto) || 0; if(monto <= 0) return [];
    const g = G() || { espera: {} }, ahora = Date.now();
    const l = conCuenta().map(id => {
      const t = mesa(id), s = saldo(id), tot = total(id);
      const exacto = monto === s || monto === tot;
      const pant = viva(id), avisada = !!(g.espera[id] && ahora - g.espera[id] < 3600e3), cobrando = !!(t.cobrando && ahora - (t.cobrando.t || 0) < 30 * 60e3);
      const atento = pant || avisada || cobrando;
      const propina = monto > s && monto <= s + propinaMax(s), abono = monto < s;
      const pts = (pant ? 100 : 0) + (avisada ? 40 : 0) + (cobrando ? 30 : 0) + (exacto ? 20 : 0);
      return { id, exacto, atento, propina, abono, pts };
    });
    const hayExacta = l.some(c => c.exacto);
    return l.filter(c => c.exacto || (!hayExacta && c.atento && (c.propina || c.abono))).sort((a, b) => b.pts - a.pts);
  }
  function mesaPara(monto){
    const c = candidatas(monto);
    if(!c.length) return null;
    if(c.length === 1) return c[0].id;
    return c[0].pts > c[1].pts ? c[0].id : null;          // empate: se pregunta en «Llegó un pago»
  }

  // ---------- 1. ⏳ Esperando el pago ----------
  let esp = null;   // { mesa, desde, ov, tic, deshacer }
  function estilos(){
    if(document.getElementById('vcEstilos')) return;
    const st = document.createElement('style'); st.id = 'vcEstilos';
    st.textContent =
      '#vcEspera{position:fixed;inset:0;z-index:10040;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,.55)}' +
      '#vcEspera .vc-caja{width:100%;max-width:440px;border-radius:24px;padding:22px 18px;text-align:center;background:var(--surface,#16131f);color:var(--ink,#fff);border:2px solid #7c3aed;box-shadow:0 20px 60px rgba(0,0,0,.4)}' +
      '#vcEspera.vc-ok .vc-caja{border-color:#22c55e;background:color-mix(in srgb,#22c55e 18%,var(--surface,#16131f))}' +
      '#vcEspera.vc-rev .vc-caja{border-color:#f5a524}#vcEspera.vc-mal .vc-caja{border-color:#e5484d;background:color-mix(in srgb,#e5484d 16%,var(--surface,#16131f))}' +
      '#vcEspera h2{margin:0;font-size:20px}#vcEspera .vc-mesa{font-size:15px;opacity:.85;margin-top:4px}' +
      '#vcEspera .vc-monto{font:800 46px/1.15 var(--font-main,system-ui);margin:14px 0 4px;letter-spacing:-.02em;word-break:break-word}' +
      '#vcEspera .vc-sub{font-size:15px;opacity:.85;min-height:20px}#vcEspera .vc-est{font-size:17px;font-weight:700;margin:14px 0 6px;min-height:24px}' +
      '#vcEspera .vc-bts{display:grid;gap:8px;margin-top:14px}#vcEspera .vc-bts button{min-height:52px;font-size:16px;border-radius:14px}' +
      '#vcEspera .vc-abonos{font-size:14px;opacity:.85;margin-top:6px}' +
      '@keyframes vcLate{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}#vcEspera.vc-ok .vc-monto{animation:vcLate .9s ease 2}' +
      '.vc-esperar{width:100%;margin:8px 0 4px;padding:12px;border-radius:14px;border:1px solid #22c55e;background:color-mix(in srgb,#22c55e 12%,transparent);color:inherit;font:700 15px var(--font-main,system-ui);cursor:pointer}' +
      '.vc-cuadre{margin:12px 0 4px;padding:12px;border-radius:14px;border:1px solid color-mix(in srgb,#7c3aed 55%,transparent);text-align:left}.vc-cuadre h3{margin:0 0 6px;font-size:15px}' +
      '.vc-cuadre .vc-f{display:flex;justify-content:space-between;gap:8px;padding:4px 0;font-size:14px}.vc-cuadre .vc-it{display:flex;align-items:center;gap:8px;padding:6px 0;border-top:1px solid var(--line,rgba(255,255,255,.12));font-size:14px}' +
      '.vc-cuadre .vc-it span{flex:1;min-width:0}.vc-cuadre .vc-it button{padding:6px 10px;font-size:13px}' +
      '#vcSinValor{z-index:9600}#vcSinValor .vc-mesas{display:grid;gap:8px;margin:10px 0}#vcSinValor .vc-mesas button{min-height:48px;font-size:15px;border-radius:14px;text-align:left;padding:10px 14px}';
    document.head.appendChild(st);
  }
  function pintarEspera(estado, html){
    if(!esp) return;
    const ov = esp.ov, s = saldo(esp.mesa);
    ov.className = estado === 'ok' ? 'vc-ok' : estado === 'rev' ? 'vc-rev' : estado === 'mal' ? 'vc-mal' : '';
    ov.querySelector('.vc-caja').innerHTML = html || (
      '<h2>⏳ Esperando el pago</h2><div class="vc-mesa">' + esc(etq(esp.mesa)) + '</div>' +
      '<div class="vc-monto">' + plata(s) + '</div><div class="vc-sub">por Nequi · DaviPlata · Bre-B</div>' +
      '<div class="vc-est" data-vc="reloj">Esperando… 0:00</div>' +
      (esp.abonos.length ? '<div class="vc-abonos">Ya llegó: ' + esp.abonos.map(plata).join(' + ') + '</div>' : '') +
      '<div class="vc-bts"><button type="button" class="btn-ghost" data-vc="cerrar">✕ Dejar de esperar</button></div>');
  }
  function reloj(){
    if(!esp) return;
    const r = esp.ov.querySelector('[data-vc="reloj"]'), seg = Math.floor((Date.now() - esp.desde) / 1000);
    if(r) r.textContent = 'Esperando… ' + Math.floor(seg / 60) + ':' + String(seg % 60).padStart(2, '0');
    if(seg % 20 === 0){ const q = pantallas()[esp.mesa]; if(q && q.eq === miEq()){ q.t = Date.now(); guardar(); } }
  }
  function abrirEspera(id){
    id = Number(id);
    if(!mesa(id) || !(mesa(id).items || []).length || saldo(id) <= 0) return toast('Esta cuenta no tiene nada por pagar.');
    cerrarEspera(true);
    estilos();
    const g = G(); g.espera[id] = Date.now(); pantallas()[id] = { eq: miEq(), t: Date.now(), monto: saldo(id) };
    try{ window.ventoAtiende && window.ventoAtiende.marcar(id, 'cobro'); }catch(e){}
    guardar();
    const ov = document.createElement('div'); ov.id = 'vcEspera'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Esperando el pago'); ov.setAttribute('data-novocab', '');
    ov.innerHTML = '<div class="vc-caja"></div>';
    ov.addEventListener('click', clicEspera);
    document.body.appendChild(ov);
    esp = { mesa: id, desde: Date.now(), ov, abonos: [], tic: setInterval(reloj, 1000), revisar: null };
    pintarEspera();
    // ¿Ya había llegado (antes de abrir la pantalla)? En los últimos 10 min, sin registrar y con ese valor.
    const ya = (g.lista || []).find(x => confirmado(x) && !x.aplicado && Date.now() - (x.t || 0) < 10 * 60e3 && (Number(x.monto) === saldo(id) || Number(x.monto) === total(id)));
    if(ya) setTimeout(() => { if(esp && esp.mesa === id) llego(ya); }, 300);
  }
  function cerrarEspera(silencioso){
    if(!esp) return;
    clearInterval(esp.tic); clearTimeout(esp.fin);
    const q = pantallas()[esp.mesa]; if(q && q.eq === miEq()) delete pantallas()[esp.mesa];
    try{ esp.ov.remove(); }catch(e){}
    esp = null;
    if(!silencioso) guardar();
  }
  function clicEspera(e){
    const b = e.target.closest('[data-vc]'); if(!b || !esp) return;
    const a = b.dataset.vc;
    if(a === 'cerrar') return cerrarEspera();
    if(a === 'listo') return cerrarEspera();
    if(a === 'seguir'){ pintarEspera(); return; }
    if(a === 'deshacer') return deshacer();
    if(a === 'lovi' && esp.revisar){ const x = esp.revisar; esp.revisar = null; x.estado = 'ok'; guardar(); return llego(x); }
    if(a === 'sinvalor' && esp.sinValor){ const sv = esp.sinValor; esp.sinValor = null; registrarAMano(sv.app, saldo(esp.mesa), esp.mesa, true); return; }
  }
  // Registrar en la cuenta (el servidor deja que lo haga UN solo equipo aunque esté abierto en varios).
  function registrarEn(x, id){
    const hacer = () => { const r = window.pagoRegistrar ? window.pagoRegistrar(x, id) : null; return r; };
    if(x.srv && window.ventoPagosAntesDeRegistrar) return window.ventoPagosAntesDeRegistrar(x, id).then(gane => { if(gane === false){ x.aplicado = x.aplicado || id; guardar(); return 'otro'; } hacer(); return 'ok'; });
    hacer(); return Promise.resolve('ok');
  }
  function verde(x, id, antes){
    if(!esp) return;
    const queda = saldo(id), de = jefe() && x.de ? ' · de ' + esc(x.de) : '';
    const linea = queda > 0 ? 'Abono. Falta <b>' + plata(queda) + '</b>' : queda < 0 ? 'Quedó al día · ' + plata(-queda) + ' de más (propina)' : 'Quedó al día 🎉';
    pintarEspera('ok', '<h2>✅ PAGADO</h2><div class="vc-mesa">' + esc(etq(id)) + '</div><div class="vc-monto">' + plata(x.monto) + '</div>' +
      '<div class="vc-sub">' + esc(x.app || '') + de + ' · confirmado por el banco</div><div class="vc-est">' + linea + '</div>' +
      '<div class="vc-bts">' + (queda > 0 ? '<button type="button" class="btn-primary" data-vc="seguir">⏳ Esperar lo que falta</button>' : '<button type="button" class="btn-primary" data-vc="listo">Listo</button>') +
      '<button type="button" class="btn-ghost" data-vc="deshacer">↩ Deshacer (no era de esta cuenta)</button></div>');
    esp.deshacer = { x, id, antes, hasta: Date.now() + 60e3 };
    if(queda > 0) esp.abonos.push(Number(x.monto));
    else { clearTimeout(esp.fin); esp.fin = setTimeout(() => { if(esp && esp.deshacer && esp.deshacer.x === x) cerrarEspera(); }, 20000); }
    try{ window.ventoSonidos && window.ventoSonidos.success(); }catch(e){}
    try{ navigator.vibrate && navigator.vibrate([150, 80, 150]); }catch(e){}
  }
  function deshacer(){
    const u = esp && esp.deshacer; if(!u) return;
    const t = mesa(u.id);
    if(t && t.payments){ const i = t.payments.findIndex(q => q.pagoDigital && q.pagoDigital.id === u.x.id); if(i >= 0) t.payments.splice(i, 1); }
    u.x.aplicado = null; u.x._pantalla = false; u.x.mesa = null;
    esp.abonos = esp.abonos.filter((v, i, a) => !(v === Number(u.x.monto) && i === a.lastIndexOf(v)));
    esp.deshacer = null; guardar();
    try{ renderMesas(); }catch(e){}
    pintarEspera();
    toast('↩ Se quitó de ' + etq(u.id) + '. Quedó en «💜 Pagos» para registrarlo en la cuenta que es.', 7000);
  }
  // ¿Este pago es el que espera la pantalla? Exacto, abono o propina (y ninguna otra mesa debe ese valor exacto).
  function esDeLaPantalla(x){
    if(!esp || !(Number(x.monto) > 0)) return false;
    const id = esp.mesa, m = Number(x.monto), s = saldo(id);
    if(s <= 0) return false;
    if(m === s || m === total(id)) return true;
    const otraExacta = conCuenta().some(o => o !== id && (saldo(o) === m || total(o) === m));
    return !otraExacta && m <= s + propinaMax(s);
  }

  // Lo llaman index.html (pgRecibir, pagos que lee este equipo) y nube/vento-pagos.js (pagos de los otros equipos).
  // Devuelve 'pantalla' si lo tomó la pantalla «Esperando el pago», 'junto' si es el valor de uno registrado a mano,
  // 'duplicado' si es el mismo pago otra vez, o null.
  function llego(x, p){
    if(!x) return null;
    if(p && parejaServidor(x)) return 'duplicado';
    // El valor que llegó después de registrar «a mano» un aviso sin valor: se juntan (no se cuenta dos veces).
    if(juntarAMano(x)) return 'junto';
    cancelarSinValor();
    if(!esDeLaPantalla(x)) return null;
    const id = esp.mesa;
    if(x.estado === 'falso'){
      pintarEspera('mal', '<h2>🚨 Mensaje de pago FALSO</h2><div class="vc-mesa">' + esc(etq(id)) + '</div><div class="vc-monto">' + plata(x.monto) + '</div>' +
        '<div class="vc-est">No entregues nada: ese SMS no lo mandó el banco.</div><div class="vc-bts"><button type="button" class="btn-primary" data-vc="seguir">⏳ Seguir esperando</button><button type="button" class="btn-ghost" data-vc="cerrar">✕ Dejar de esperar</button></div>');
      return 'pantalla';
    }
    if(x.estado === 'revisar'){
      esp.revisar = x;
      pintarEspera('rev', '<h2>⚠️ Llegó por SMS</h2><div class="vc-mesa">' + esc(etq(id)) + '</div><div class="vc-monto">' + plata(x.monto) + '</div>' +
        (jefe() ? '<div class="vc-est">Míralo en la app del banco antes de entregar.</div><div class="vc-bts"><button type="button" class="btn-primary" data-vc="lovi">✅ Lo vi en la app</button><button type="button" class="btn-ghost" data-vc="seguir">⏳ Seguir esperando</button></div>'
          : '<div class="vc-est">El administrador debe confirmarlo en la app del banco. No entregues todavía.</div><div class="vc-bts"><button type="button" class="btn-ghost" data-vc="seguir">⏳ Seguir esperando</button></div>'));
      return 'pantalla';
    }
    if(!confirmado(x) || x.aplicado) return null;
    x._pantalla = true; x.mesa = id;
    const antes = saldo(id);
    registrarEn(x, id).then(r => {
      if(r === 'otro'){ toast('Ese pago ya lo registró otro equipo en ' + etq(x.aplicado) + '.', 6000); }
      verde(x, id, antes);
      try{ renderMesas(); }catch(e){}
      try{ if(typeof currentTable !== 'undefined' && currentTable === id) renderModalItems(); }catch(e){}
    });
    return 'pantalla';
  }

  // ---------- 6. El mismo pago por SMS y por la app, llegado por el servidor ----------
  // Uno con uno: un aviso de la app se junta con UN solo SMS del mismo valor (en 5 min), y al revés.
  const esSms = y => !!y.sms || /\bSMS\b/.test(String(y.fuente || ''));
  function parejaServidor(x){
    const g = G(); if(!g || !x.srv || x.estado === 'falso') return false;
    const cerca = y => y !== x && !y.parSrv && y.estado !== 'falso' && Number(y.monto) === Number(x.monto) && Math.abs((y.t || 0) - (x.t || 0)) < 5 * 60e3;
    if(esSms(x)){
      const app = g.lista.find(y => cerca(y) && !esSms(y) && confirmado(y));
      if(!app) return false;
      app.parSrv = true; const i = g.lista.indexOf(x); if(i >= 0) g.lista.splice(i, 1);
      return true;
    }
    const i = g.lista.findIndex(y => cerca(y) && esSms(y) && !y.aplicado);
    if(i < 0) return false;
    const sms = g.lista.splice(i, 1)[0]; x.parSrv = true;
    return confirmado(sms);                                  // si el SMS ya se había avisado como confirmado, no se repite
  }

  // ---------- 3. Aviso sin el valor ----------
  let sinValorT = null;
  function cancelarSinValor(){ clearTimeout(sinValorT); sinValorT = null; const o = document.getElementById('vcSinValor'); if(o) o.remove(); }
  function sinValor(app, txt){
    app = String(app || 'el banco').trim();
    if(!jefe()) return;                                    // el valor lo mira el administrador en la app del banco
    if(esp){
      esp.sinValor = { app };
      pintarEspera('rev', '<h2>💜 Llegó plata por ' + esc(app) + '</h2><div class="vc-mesa">' + esc(etq(esp.mesa)) + '</div><div class="vc-monto">' + plata(saldo(esp.mesa)) + '</div>' +
        '<div class="vc-est">El aviso no trae el valor. Míralo en la app: ¿llegó ' + plata(saldo(esp.mesa)) + '?</div>' +
        '<div class="vc-bts"><button type="button" class="btn-primary" data-vc="sinvalor">✅ Sí, llegó ' + plata(saldo(esp.mesa)) + '</button><button type="button" class="btn-ghost" data-vc="seguir">⏳ No, seguir esperando</button></div>');
      return;
    }
    // Casi siempre el SMS con el valor llega a los pocos segundos (y se registra solo): se espera 20 s antes de preguntar.
    clearTimeout(sinValorT);
    sinValorT = setTimeout(() => { sinValorT = null; if(viendo()) ventanaSinValor(app); }, 20000);
  }
  function ventanaSinValor(app){
    estilos();
    cancelarSinValor();
    const g = G() || { espera: {} }, ahora = Date.now();
    const l = conCuenta().map(id => { const t = mesa(id); return { id, pts: (viva(id) ? 100 : 0) + (g.espera[id] && ahora - g.espera[id] < 3600e3 ? 40 : 0) + (t.cobrando && ahora - (t.cobrando.t || 0) < 30 * 60e3 ? 30 : 0) }; })
      .sort((a, b) => b.pts - a.pts).slice(0, 5);
    const ov = document.createElement('div'); ov.id = 'vcSinValor'; ov.className = 'overlay show'; ov.setAttribute('data-novocab', '');
    ov.innerHTML = '<div class="modal" style="max-width:440px"><h2>💜 Llegó plata por ' + esc(app) + '</h2><div class="modal-sub">El aviso no trae el valor. Míralo en la app del banco y toca la cuenta que pagó:</div>' +
      (l.length ? '<div class="vc-mesas">' + l.map(c => '<button type="button" class="btn-ghost" data-sv="' + c.id + '">' + (c.pts ? '⏳ ' : '') + esc(etq(c.id)) + ' · debe <b>' + plata(saldo(c.id)) + '</b></button>').join('') + '</div>' : '<div class="modal-sub">No hay cuentas abiertas.</div>') +
      '<label class="modal-sub" style="display:block;margin-top:6px">¿Otro valor?</label><input type="number" inputmode="numeric" min="0" step="100" id="vcSvMonto" class="mz-in" placeholder="Valor que llegó" style="width:100%;font-size:20px;min-height:48px">' +
      '<div class="modal-actions" style="flex-wrap:wrap;gap:8px"><button type="button" class="btn-primary" data-sv="guardar">Guardar el valor</button><button type="button" class="btn-close" data-sv="x">Luego</button></div></div>';
    ov.addEventListener('click', e => {
      if(e.target === ov) return ov.remove();
      const b = e.target.closest('[data-sv]'); if(!b) return;
      const v = Number(ov.querySelector('#vcSvMonto').value) || 0;
      if(b.dataset.sv === 'x') return ov.remove();
      if(b.dataset.sv === 'guardar'){ if(!(v > 0)) return toast('Escribe el valor que llegó.'); ov.remove(); const x = registrarAMano(app, v, null); try{ x && window.pagoLlego && window.pagoLlego(x, true); }catch(er){} return; }
      const id = Number(b.dataset.sv); ov.remove(); registrarAMano(app, v > 0 ? v : saldo(id), id);
    });
    document.body.appendChild(ov);
  }
  // Un pago con el valor puesto a mano (el aviso del banco no lo traía). Queda marcado «✍️ puesto a mano».
  function registrarAMano(app, monto, id, enPantalla){
    const g = G(); if(!g || !(monto > 0)) return null;
    const x = { id: 'man-' + Date.now().toString(36), via: 'mano', eq: miEq(), t: Date.now(), monto: Math.round(monto), app, de: '', mesa: id || null, estado: 'ok', fuente: '✍️ Valor puesto a mano (el aviso no lo traía)', txt: '', aMano: true };
    g.lista.unshift(x); g.lista = g.lista.slice(0, 200); guardar();
    if(id){
      const r = window.pagoRegistrar ? window.pagoRegistrar(x, id) : null;
      if(enPantalla && esp) verde(x, id, 0); else if(r) toast(r, 7000);
      try{ renderMesas(); }catch(e){}
    }
    return x;
  }
  // Llegó el valor de un pago que ya se registró «a mano» (mismo banco y valor, en 10 min): queda el del banco.
  function juntarAMano(x){
    // También el SMS del banco («⚠️ Revisar»): la persona ya lo miró en la app al ponerlo a mano.
    const g = G(); if(!g || x.aMano || x.estado === 'falso' || x.aplicado) return false;
    const banco = s => String(s || '').toLowerCase().replace(/bre-?b( en)?\s*/g, '').trim();
    const i = g.lista.findIndex(y => y.aMano && !y.junto && Number(y.monto) === Number(x.monto) && Date.now() - (y.t || 0) < 10 * 60e3 && (banco(y.app) === banco(x.app) || !banco(y.app) || /banco/.test(banco(y.app))));
    if(i < 0) return false;
    const m = g.lista[i];
    g.lista.splice(i, 1);
    x.aplicado = m.aplicado || null; x.mesa = m.mesa || x.mesa; x._pantalla = true;
    if(x.estado === 'revisar'){ x.estado = 'ok'; x.fuente = 'Revisado a mano en la app del banco · ' + (x.fuente || ''); }
    if(m.aplicado){ const t = mesa(m.aplicado); ((t && t.payments) || []).forEach(q => { if(q.pagoDigital && q.pagoDigital.id === m.id) q.pagoDigital.id = x.id; }); }
    guardar();
    return true;
  }

  // ---------- 4. Mesero, empleado o cajero ----------
  function mesero(x){
    if(!x || jefe()) return false;
    const id = x.mesa || x.aplicado || null, nom = id ? etq(id) : 'La cuenta';
    let tit, cuerpo;
    if(x.estado === 'falso' || x.confianza === 'falso'){ tit = '🚨 ' + nom + ': el pago parece FALSO'; cuerpo = 'No entregues nada. Avísale al administrador.'; }
    else if(x.estado === 'revisar' || x.confianza === 'revisar'){ tit = '⚠️ ' + nom + ': pago por revisar'; cuerpo = 'Espera a que el administrador lo confirme antes de entregar.'; }
    else { const s = id ? saldo(id) : 0; tit = '✅ ' + nom + (id && Number(x.monto) < s ? ' hizo un abono' : ' ya pagó'); cuerpo = 'Confirmado por el banco.'; }
    toast(tit + '. ' + cuerpo, 9000);
    decir(tit.replace(/^\S+\s/, '') + '.');
    try{ window.ventoAvisoCel && window.ventoAvisoCel(tit, cuerpo, 'pagos'); }catch(e){}
    try{ navigator.vibrate && navigator.vibrate([150, 80, 150]); }catch(e){}
    return true;
  }

  // ---------- 5. Cuadre en «📊 Caja de hoy» ----------
  window.ventoCuadreHtml = function(){
    const g = G(); if(!g || !jefe()) return '';
    const h0 = new Date().setHours(0, 0, 0, 0), hoy = g.lista.filter(x => (x.t || 0) >= h0);
    if(!hoy.length) return '';
    const ok = hoy.filter(confirmado), reg = ok.filter(x => x.aplicado), sin = ok.filter(x => !x.aplicado), rev = hoy.filter(x => x.estado === 'revisar'), fal = hoy.filter(x => x.estado === 'falso');
    const suma = l => l.reduce((a, x) => a + (Number(x.monto) || 0), 0);
    const hora = x => new Date(x.t).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
    const it = (x, bt) => '<div class="vc-it"><span><b>' + plata(x.monto) + '</b> ' + esc(x.app || '') + (x.de ? ' · ' + esc(x.de) : '') + ' <small style="opacity:.7">' + esc(hora(x)) + (x.aMano ? ' · ✍️ a mano' : '') + '</small></span>' + bt + '</div>';
    return '<div class="vc-cuadre" data-novocab=""><h3>💜 Nequi · DaviPlata · Bre-B</h3>' +
      '<div class="vc-f"><span>Llegó confirmado (' + ok.length + ')</span><b>' + plata(suma(ok)) + '</b></div>' +
      '<div class="vc-f"><span>Registrado en cuentas (' + reg.length + ')</span><b>' + plata(suma(reg)) + '</b></div>' +
      (sin.length ? '<div class="vc-f" style="color:#f5a524"><span>⚠️ Sin registrar (' + sin.length + ')</span><b>' + plata(suma(sin)) + '</b></div>' + sin.slice(0, 10).map(x => it(x, '<button type="button" class="btn-ghost" data-cuadre-reg="' + esc(x.id) + '">Registrar</button>')).join('') : '<div class="vc-f" style="color:#22c55e"><span>✅ Todo quedó registrado</span><b></b></div>') +
      (rev.length ? '<div class="vc-f" style="color:#f5a524"><span>⚠️ Por revisar (' + rev.length + ')</span><b>' + plata(suma(rev)) + '</b></div>' + rev.slice(0, 10).map(x => it(x, '<button type="button" class="btn-ghost" data-cuadre-vi="' + esc(x.id) + '">✅ Lo vi en la app</button>')).join('') : '') +
      (fal.length ? '<div class="vc-f" style="color:#e5484d"><span>🚨 Falsos detectados</span><b>' + fal.length + '</b></div>' : '') + '</div>';
  };
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-cuadre-reg],[data-cuadre-vi]'); if(!b) return;
    const g = G(), x = g && g.lista.find(y => y.id === (b.dataset.cuadreReg || b.dataset.cuadreVi)); if(!x) return;
    const ov = b.closest('.overlay'); if(ov) ov.remove();
    if(b.dataset.cuadreVi){ x.estado = 'ok'; guardar(); }
    x.ignorado = false;
    try{ window.pagoLlego && window.pagoLlego(x, true); }catch(er){}
  });

  // ---------- «Llegó un pago»: con la pantalla, otro equipo esperando, o las cuentas posibles ----------
  function envolverLlego(){
    const orig = window.pagoLlego;
    if(typeof orig !== 'function' || orig._vc) return typeof orig === 'function';
    const nuevo = function(x, aMano){
      if(!x || x._pantalla || x.aplicado) return;
      if(esp && esDeLaPantalla(x) && confirmado(x)){ llego(x); return; }
      // Otra pantalla «Esperando el pago» (en otro equipo) espera justo esa mesa: se registra allá.
      if(!aMano){ const otra = Object.keys(pantallas()).map(Number).find(id => viva(id) && pantallas()[id].eq !== miEq() && (Number(x.monto) === saldo(id) || Number(x.monto) === total(id)));
        if(otra){ toast('⏳ ' + etq(otra) + ' está esperando este pago en otro equipo: se registra allá.', 6000); return; } }
      if(!x.mesa) x.cands = candidatas(x.monto).slice(0, 3).map(c => c.id);
      return orig.apply(this, arguments);
    };
    nuevo._vc = true;
    window.pagoLlego = nuevo;
    return true;
  }

  // ---------- Botones «⏳ Esperando Nequi / DaviPlata» (cuenta de la mesa y «Cuenta de…») ----------
  const pagosOn = () => { const d = D(); return !!(d && d.pagos && d.pagos.on); };
  function botones(){
    estilos();
    const cont = document.getElementById('paymentsContainer');
    if(cont && !document.getElementById('vcEsperarBtn')){
      const b = document.createElement('button'); b.type = 'button'; b.id = 'vcEsperarBtn'; b.className = 'vc-esperar'; b.setAttribute('data-novocab', '');
      b.textContent = '⏳ Esperando pago por Nequi / DaviPlata';
      b.onclick = () => { try{ abrirEspera(currentTable); }catch(e){} };
      cont.parentNode.insertBefore(b, cont);
    }
    const bs = document.getElementById('billSummaryCloseBtn');
    if(bs && !document.getElementById('vcEsperarCuenta')){
      const b = document.createElement('button'); b.type = 'button'; b.id = 'vcEsperarCuenta'; b.className = 'vc-esperar'; b.setAttribute('data-novocab', '');
      b.textContent = '⏳ Esperar el pago por Nequi / DaviPlata';
      b.onclick = () => { if(cuentaDe != null){ try{ closeBillSummary(); }catch(e){} abrirEspera(cuentaDe); } };
      bs.parentNode.insertBefore(b, bs);
    }
    const on = pagosOn();
    ['vcEsperarBtn', 'vcEsperarCuenta'].forEach(k => { const b = document.getElementById(k); if(b) b.hidden = !on; });
  }
  let cuentaDe = null;
  function envolverCuenta(){
    const ob = window.openBillSummary;
    if(typeof ob !== 'function' || ob._vc) return;
    const nuevo = function(id){ cuentaDe = id; const r = ob.apply(this, arguments); try{ botones(); }catch(e){} return r; };
    nuevo._vc = true;
    window.openBillSummary = nuevo; try{ openBillSummary = nuevo; }catch(e){}
    const ot = window.openTableModal;                        // al abrir la cuenta de una mesa, el botón ya está al día
    if(typeof ot === 'function' && !ot._vc){ const n2 = function(){ const r = ot.apply(this, arguments); try{ botones(); }catch(e){} return r; }; n2._vc = true; window.openTableModal = n2; try{ openTableModal = n2; }catch(e){} }
  }

  const arr = setInterval(() => {
    if(!D()) return;
    if(!envolverLlego()) return;
    clearInterval(arr);
    envolverCuenta(); botones();
    setInterval(() => { try{ botones(); }catch(e){} }, 3000);
  }, 500);

  window.ventoConfirma = { llego, mesaPara, candidatas, sinValor, mesero, abrir: abrirEspera, cerrar: cerrarEspera, estado: () => esp ? { mesa: esp.mesa, abonos: esp.abonos.slice() } : null };
})();
