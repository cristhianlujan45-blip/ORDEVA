/* ORDEVA · app/26-verificar-comprobantes-nequi.js — antes estaba dentro de index.html (línea 32681). Se carga en el mismo lugar y orden. */
/* ==================== 🔎 Verificar comprobantes de Nequi / DaviPlata ====================
   El fraude más común: el cliente muestra un pantallazo de «Envío exitoso» que es falso, viejo, de otro
   número o que ya mostró antes. ORDEVA lee el comprobante (sin internet) y lo cruza con lo que DE VERDAD
   llegó (Servidor ORDEVA o avisos de la app del banco):
     ✅ Coincide con un pago que llegó (valor y hora)         → se puede registrar
     ⏳ Todavía no llega ese pago                             → no entregues; te avisa cuando llegue
     🚨 Ya se usó (misma referencia), fue a otro número, fecha futura → no lo aceptes
     ⚠️ Comprobante viejo o sin avisos automáticos           → revísalo en la app del banco
   ORDEVA nunca da un pago por recibido solo por el pantallazo. */
(function(){
  const plata = n => '$' + Math.round(n || 0).toLocaleString('es-CO');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MESES = { ene: 0, enero: 0, feb: 1, febrero: 1, mar: 2, marzo: 2, abr: 3, abril: 3, may: 4, mayo: 4, jun: 5, junio: 5, jul: 6, julio: 6, ago: 7, agosto: 7, sep: 8, sept: 8, septiembre: 8, set: 8, oct: 9, octubre: 9, nov: 10, noviembre: 10, dic: 11, diciembre: 11 };
  const num = t => Number(String(t).replace(/[.\s]/g, '').replace(/,\d{1,2}$/, '').replace(/,/g, ''));

  // ---------- Leer el texto del comprobante ----------
  function leer(texto){
    const t = String(texto || '').replace(/\r/g, '').replace(/[ \t]+/g, ' ');
    const plano = t.replace(/\n+/g, ' ');
    // «Recarga desde Bancolombia» (detalle o lista de movimientos de Nequi): plata que LLEGÓ a Nequi desde un banco.
    const recargaBanco = /recarga\s+(?:desde|de)\s+(?:bancolombia|davivienda|bbva|banco\b|otr[oa]s?\s+(?:banco|entidad)|pse)/i.test(plano);
    const app = /daviplata/i.test(plano) ? 'DaviPlata' : /bre-?b|llave/i.test(plano) && !/nequi/i.test(plano) ? 'Bre-B' : /nequi/i.test(plano) || recargaBanco ? 'Nequi' : /bancolombia/i.test(plano) ? 'Bancolombia' : 'Transferencia';
    // Valor: el que va junto a «¿Cuánto?», «Valor», «Monto», «Total»; si no, el mayor que no sea costo/saldo.
    // El valor que va DEBAJO de «Saldo disponible» / «Costo…» es el saldo o el costo, nunca el pago (antes, si el
    // renglón del valor no se leía, quedaba el saldo: «$ 1.250.300» en vez de «$ 65.000»).
    let monto = null, porEtiqueta = false, montoAlt = null;
    const lineas = t.split('\n').map(x => x.trim()).filter(Boolean);
    const RX_PLATA = /(?:\$|\bS(?=\s?\d{1,3}[.,]\d{3}))\s?(\d{1,3}(?:[.,]\d{3})+(?:,\d{1,2})?|\d+(?:,\d{1,2})?)/;   // «S 65.000»: el $ mal leído
    const ETQ = /(cu[aá]nto|valor|monto|total|enviaste|pasaste|pagaste|recibiste|transferiste)/i, NO = /(costo|comisi|saldo|gmf|4x1000|cuota de manejo|disponible)/i;
    const excluida = i => NO.test(lineas[i]) || (i > 0 && NO.test(lineas[i - 1]) && !RX_PLATA.test(lineas[i - 1]) && !ETQ.test(lineas[i]));
    for(let i = 0; i < lineas.length && monto == null; i++){
      if(ETQ.test(lineas[i]) && !NO.test(lineas[i])){
        const sig = lineas[i + 1] && !excluida(i + 1) ? lineas[i + 1] : '';
        const m = lineas[i].match(RX_PLATA) || sig.match(RX_PLATA) || sig.replace(/(\d)-(\d{3})/g, '$1.$2').match(/^(\d{1,3}(?:[.,]\d{3})+)(?:,\d{1,2})?$/);
        if(m && num(m[1]) > 0){ monto = num(m[1]); porEtiqueta = true; }
        // En una FOTO de la pantalla el «$» se lee «5» o «6»: «5 11.000,00» es $11.000; «51.950,00» puede ser $1.950 o $51.950
        // (se guardan los dos y vale el que coincida con un pago que de verdad llegó).
        const s5 = !m && sig.match(/^[56]\s(\d{1,3}(?:[.,]\d{3})+)(?:,\d{1,2})?$/);
        if(s5){ monto = num(s5[1]); porEtiqueta = true; }
        else if(m && !/\$|\bS\s?\d/.test(lineas[i] + ' ' + sig)){ const x = String(m[1]).match(/^[56](\d{1,3}(?:[.,]\d{3})+)$/); if(x) montoAlt = num(x[1]); }
      }
    }
    if(monto == null){
      const todos = lineas.map((l, i) => excluida(i) ? null : (l.match(RX_PLATA) || [])[1]).filter(Boolean).map(num).filter(v => v > 0);
      if(todos.length) monto = Math.max.apply(null, todos);
    }
    // Referencia / número de aprobación (identifica la transacción: el mismo número no puede usarse dos veces).
    let ref = null;
    const rxs = [/referencia\s*[:#]?\s*([A-Z]{0,3}\d{5,})/i, /\b(M\d{6,})\b/, /(?:n[uú]mero|no\.?|c[oó]digo)\s*(?:de\s*)?(?:aprobaci[oó]n|autorizaci[oó]n|transacci[oó]n|comprobante)\s*[:#]?\s*([A-Z0-9]{5,})/i,
      /(?:aprobaci[oó]n|autorizaci[oó]n|comprobante|transacci[oó]n)\s*(?:no\.?|n[uú]mero|#)?\s*[:#]?\s*([A-Z0-9]{6,})/i];
    // Nequi: «M05698629» a veces se lee «MO5698629» (la O en vez del cero).
    const planoRef = plano.replace(/\bM[Oo](\d{6,})\b/g, 'M0$1');
    for(const rx of rxs){ const m = planoRef.match(rx); if(m && !/^3\d{9}$/.test(m[1])){ ref = m[1].toUpperCase(); break; } }
    if(!ref){ const i = lineas.findIndex(l => /^(referencia|n[uú]mero de (aprobaci[oó]n|autorizaci[oó]n|transacci[oó]n))$/i.test(l)); if(i >= 0 && /^[A-Z0-9]{5,}$/i.test(lineas[i + 1] || '')) ref = lineas[i + 1].toUpperCase().replace(/^MO(\d)/, 'M0$1'); }
    // Fecha y hora
    let fecha = null;
    let d = null, mes = null, an = null;
    let m = plano.match(/\b(\d{1,2})\s+de\s+([a-záéíóú]+)\.?\s+(?:de\s+|del\s+)?(\d{4})/i);
    if(m && MESES[m[2].toLowerCase()] != null){ d = +m[1]; mes = MESES[m[2].toLowerCase()]; an = +m[3]; }
    if(d == null){ m = plano.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/); if(m){ d = +m[1]; mes = +m[2] - 1; an = +m[3] < 100 ? 2000 + +m[3] : +m[3]; } }
    if(d == null){ m = plano.match(/\b([a-záéíóú]{3,})\.?\s+(\d{1,2}),?\s+(\d{4})/i); if(m && MESES[m[1].toLowerCase()] != null){ d = +m[2]; mes = MESES[m[1].toLowerCase()]; an = +m[3]; } }
    const h = plano.match(/\b(\d{1,2}):(\d{2})(?::\d{2})?\s*(a\.?\s?m\.?|p\.?\s?m\.?)?/i);
    if(d != null && mes >= 0 && mes < 12){
      let hh = h ? +h[1] : 12, mm = h ? +h[2] : 0;
      if(h && h[3]){ const pm = /p/i.test(h[3]); if(pm && hh < 12) hh += 12; if(!pm && hh === 12) hh = 0; }
      fecha = new Date(an, mes, d, hh, mm).getTime();
      if(!h) fecha = { soloDia: true, t: fecha };
    }
    // ¿A qué número fue? (los comprobantes muestran el celular, a veces enmascarado: 300 *** 4567)
    let destino = null;
    const md = plano.match(/(?:para|a|destino|n[uú]mero nequi|celular|daviplata|cuenta)\D{0,12}(3\d{2})[\s*•·.xX-]*(\d{3}|\*{2,4}|[•·]{2,4})?[\s*•·.xX-]*(\d{4})\b/i) || plano.match(/\b(3\d{2})\s?(\d{3})\s?(\d{4})\b/);
    if(md) destino = md[3];
    const nombre = (plano.match(/(?:para|nombre|destinatario)\s*:?\s*([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ.]+(?:\s+[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ.]+){0,3})/) || [])[1] || '';
    const exito = /(exitos|realizad|aprobad|env[ií]o\s+(exitoso|realizado)|listo|enviaste|pasaste|transferencia exitosa|transacci[oó]n exitosa|pago exitoso)/i.test(plano) || recargaBanco;
    // 1.62.1: ¿es la LISTA de movimientos (varias entradas, cada una con su valor al final del renglón) y no un comprobante?
    // «Recarga desde Bancolombia $ 2.800,00», «CAMILO ANDRES CONTRERAS AVI… $ 2.500,00». El «$» a veces se lee «6» o «S».
    // Si el valor quedó solo en su renglón (el nombre en el de arriba), se toma el nombre de arriba. Los que salen («-$») no son llegadas.
    const lista = [], usadas = new Set();
    const RX_FILA = /^(.*?)\s*(-\s*)?(?:([$S6])(\s?))?(\d{1,3}(?:[.,]\d{3})+)(,\d{2})?\s*$/, LETRAS = /[A-Za-zÁÉÍÓÚÑáéíóúñ]{3}/;
    const SUB = /^\W*(recarga en|de|para|hoy|ayer|movimientos)\W*$/i;
    // Un comprobante («exitosa», «aprobación», «referencia»…) nunca es la lista, aunque tenga dos valores.
    const esComprobante = /exitos|aprobaci|autorizaci|referencia|comprobante|cu[aá]nto\?/i.test(plano);
    if(!porEtiqueta && !esComprobante) lineas.forEach((l, i) => {
      const x = l.match(RX_FILA);
      if(!x || NO.test(l) || x[2] || !(x[3] || x[6])) return;
      let desc = x[1].replace(/\s+[$S6O0]$/, '').replace(/^[^A-Za-zÁÉÍÓÚÑáéíóúñ]+/, '').trim();
      if(!LETRAS.test(desc)){
        desc = '';
        for(let k = i - 1; k >= Math.max(0, i - 2); k--){
          const a = lineas[k];
          if(usadas.has(k) || RX_FILA.test(a) || SUB.test(a) || !LETRAS.test(a)) continue;
          desc = a.replace(/^[^A-Za-zÁÉÍÓÚÑáéíóúñ]+/, '').trim(); usadas.add(k); break;
        }
        if(!desc) return;
      }
      usadas.add(i);
      const e = { desc: desc.slice(0, 60), monto: num(x[5]), signo: x[3] || '' };
      // «62.800,00» pegado: puede ser «$ 2.800» (el $ leído como 6) o de verdad $62.800. Se guardan los dos.
      if(x[3] === '6' && !x[4]) e.alt = num('6' + x[5]);
      if(e.monto > 0) lista.push(e);
    });
    return { app, monto, montoAlt, porEtiqueta, ref, fecha: typeof fecha === 'number' ? fecha : null, dia: fecha && fecha.soloDia ? fecha.t : null, destino, nombre, exito,
      lista: lista.length >= 2 ? lista : null, texto: plano.slice(0, 600) };
  }

  // ---------- Cruzar con lo que llegó ----------
  const G = () => { if(!data.pagos) data.pagos = { on: false, topic: '', lista: [], vistos: [], espera: {} }; const g = data.pagos; g.comprobantes = g.comprobantes || []; return g; };
  const confirmado = x => !x.estado || x.estado === 'app' || x.estado === 'ok';
  const avisosActivos = () => !!(data.pagos && data.pagos.on) || !!(window.ventoPagos && window.ventoPagos.estado().resumen && (window.ventoPagos.estado().resumen.nequi.estado === 'conectado' || window.ventoPagos.estado().resumen.daviplata.estado === 'conectado'));
  const quien = c => c.mesa ? (window.tableLabel ? tableLabel(c.mesa) : 'Mesa ' + c.mesa) : 'otra cuenta';

  // El pago que llegó (Servidor ORDEVA o avisos del banco) por ese valor, cerca de esa hora, y que ningún comprobante usó todavía.
  function llegado(monto, fecha, mesa){
    const g = G(), ahora = Date.now();
    const desde = fecha ? fecha - 20 * 60e3 : ahora - 6 * 3600e3, hasta = fecha ? fecha + 4 * 3600e3 : ahora + 60e3;
    const ya = new Set(g.comprobantes.map(c => c.pago).filter(Boolean));
    const cands = (g.lista || []).filter(x => confirmado(x) && Number(x.monto) === Number(monto) && x.t >= desde && x.t <= hasta && !ya.has(x.id));
    cands.sort((a, b) => (a.mesa == mesa ? 0 : 1) - (b.mesa == mesa ? 0 : 1) || Math.abs(a.t - (fecha || ahora)) - Math.abs(b.t - (fecha || ahora)));
    return cands[0] || null;
  }

  function verificar(info, mesa){
    const g = G(), ahora = Date.now(), motivos = [];
    let nivel = 'ok', pago = null;
    // La LISTA de movimientos de Nequi (varias llegadas en un pantallazo): se muestra cada una con si de verdad llegó, y se elige cuál es.
    if(info && info.lista && !info.porEtiqueta) return { nivel: 'lista', motivos: [], info, filas: info.lista.map(e => Object.assign({}, e, { pago: llegado(e.monto, null, mesa) || (e.alt ? llegado(e.alt, null, mesa) : null) })) };
    if(!info || !info.monto) return { nivel: 'revisar', motivos: ['No pude leer el valor del comprobante. Revisa que la foto se vea completa y clara.'], info };
    if(info.ref){
      const usado = g.comprobantes.find(c => c.ref === info.ref && c.app === info.app);
      if(usado) return { nivel: 'falso', motivos: ['🚨 Este comprobante YA SE USÓ el ' + new Date(usado.t).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + ' en ' + quien(usado) + ' (misma referencia ' + info.ref + ').'], info };
    }
    const mio = String(data.nequiNumber || '').replace(/\D/g, '');
    if(info.destino && mio.length === 10 && (info.app === 'Nequi' || info.app === 'Bre-B') && info.destino !== mio.slice(-4)){
      // Un solo número distinto puede ser la lectura del pantallazo (un 8 leído como 3): eso se revisa, no se acusa.
      const dif = [0, 1, 2, 3].filter(k => info.destino[k] !== mio.slice(-4)[k]).length;
      if(dif >= 2) return { nivel: 'falso', motivos: ['🚨 La plata fue a OTRO número (termina en ' + info.destino + '). Tu Nequi termina en ' + mio.slice(-4) + '.'], info };
      nivel = 'revisar'; motivos.push('⚠️ El número del comprobante se leyó como •••' + info.destino + ' y tu Nequi termina en ' + mio.slice(-4) + ': mira en el pantallazo a qué número fue.');
    }
    // La hora del equipo puede ir corrida (otra zona horaria, reloj atrasado): solo muy en el futuro es un comprobante editado.
    if(info.fecha && info.fecha > ahora + 6 * 3600e3) return { nivel: 'falso', motivos: ['🚨 La fecha del comprobante es del futuro: está editado.'], info };
    if(info.fecha && info.fecha > ahora + 10 * 60e3){ nivel = 'revisar'; motivos.push('⚠️ La hora del comprobante va adelantada ' + Math.round((info.fecha - ahora) / 60e3) + ' min frente a este equipo: revisa la hora del equipo y la del comprobante.'); }
    if(info.porIA) motivos.push('🤖 El valor lo leyó la IA' + (info.iaVisto ? ' (y también aparece en el texto del pantallazo)' : '') + ': mira que ' + plata(info.monto) + ' sea el del pantallazo.');
    else if(!info.porEtiqueta) motivos.push('Mira que ' + plata(info.monto) + ' sea el valor del pantallazo: no encontré la palabra «¿Cuánto?» / «Valor» junto a él.');
    const ref = info.fecha || info.dia;
    if(ref && ahora - ref > 36 * 3600e3){ nivel = 'revisar'; motivos.push('⚠️ El comprobante es de hace ' + Math.round((ahora - ref) / 864e5 * 10) / 10 + ' días: no es de hoy.'); }
    if(!info.exito) motivos.push('El comprobante no dice «exitoso»/«realizado»: revisa que no sea un pago pendiente o rechazado.');
    // ¿Llegó un pago así?
    pago = llegado(info.monto, info.fecha, mesa);
    if(!pago && info.montoAlt){ const p2 = llegado(info.montoAlt, info.fecha, mesa); if(p2){ pago = p2; info = Object.assign({}, info, { monto: info.montoAlt, montoAlt: null }); } }
    if(!pago && info.montoAlt) motivos.push('⚠️ El valor se leyó como ' + plata(info.monto) + ', pero puede ser ' + plata(info.montoAlt) + ' (el «$» mal leído en la foto): míralo en el pantallazo.');
    if(pago){ if(nivel === 'ok') motivos.unshift('✅ Coincide con el pago de ' + plata(pago.monto) + ' que llegó por ' + pago.app + (pagoDet(pago).de ? ' de ' + pagoDet(pago).de : '') + ' a las ' + new Date(pago.t).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }).replace(/\.$/, '') + '.'); }
    else if(avisosActivos()){ nivel = nivel === 'revisar' ? 'revisar' : 'espera'; motivos.unshift('⏳ Todavía NO ha llegado un pago de ' + plata(info.monto) + '. No entregues nada: te aviso apenas llegue.'); }
    else { nivel = 'revisar'; motivos.unshift('⚠️ ORDEVA no tiene avisos automáticos de pagos activos: confírmalo en tu app ' + (info.app === 'DaviPlata' ? 'DaviPlata' : 'Nequi') + ' antes de entregar. (Actívalos en Ajustes → 💜 Pagos.)'); }
    return { nivel, motivos, info, pago };
  }

  function guardar(r, mesa){
    if(r.nivel === 'lista') return null;
    const g = G();
    const c = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), t: Date.now(), ref: r.info.ref || null, app: r.info.app, monto: r.info.monto, mesa: mesa != null ? mesa : null, nivel: r.nivel, pago: r.pago ? r.pago.id : null };
    if(r.nivel !== 'falso' && (c.ref || c.pago)) { g.comprobantes.unshift(c); g.comprobantes = g.comprobantes.slice(0, 300); }
    if(r.nivel === 'espera'){ g.esperaComp = (g.esperaComp || []).filter(x => Date.now() - x.t < 3 * 3600e3); g.esperaComp.push({ id: c.id, t: Date.now(), monto: c.monto, mesa: c.mesa, app: c.app }); }
    try{ saveData(); }catch(e){}
    return c;
  }

  // Cuando por fin llega el pago de un comprobante que estaba esperando, avisa.
  setInterval(() => {
    if(typeof data === 'undefined' || !data || !data.pagos || !(data.pagos.esperaComp || []).length) return;
    const g = data.pagos, usados = new Set((g.comprobantes || []).map(c => c.pago).filter(Boolean));
    g.esperaComp = g.esperaComp.filter(e => {
      if(Date.now() - e.t > 3 * 3600e3) return false;
      const x = (g.lista || []).find(p => confirmado(p) && Number(p.monto) === Number(e.monto) && p.t >= e.t - 30 * 60e3 && !usados.has(p.id));
      if(!x) return true;
      const c = (g.comprobantes || []).find(k => k.id === e.id); if(c){ c.pago = x.id; c.nivel = 'ok'; }
      usados.add(x.id);
      const m = '✅ Ya llegó el pago del comprobante de ' + plata(e.monto) + (e.mesa != null ? ' (' + quien(e) + ')' : '') + ' por ' + x.app + (pagoDet(x).de ? ' de ' + pagoDet(x).de : '') + '. Ya puedes entregar.';
      try{ showToast(m, 10000); }catch(er){}
      try{ (window.ventoHablar || window.speakVoice || function(){})(m.replace(/[✅$]/g, '')); }catch(er){}
      return false;
    });
    try{ saveData(); }catch(e){}
  }, 4000);

  // ---------- Pantalla del resultado ----------
  function ventana(){
    let ov = document.getElementById('compOv');
    if(!ov){ ov = document.createElement('div'); ov.id = 'compOv'; ov.className = 'overlay'; ov.setAttribute('data-novocab', ''); ov.style.zIndex = '10060'; document.body.appendChild(ov); ov.addEventListener('click', e => { if(e.target === ov) ov.classList.remove('show'); }); }
    document.body.appendChild(ov);   // siempre encima de la cuenta abierta
    return ov;
  }
  const COLOR = { ok: '#22c55e', espera: '#f5a524', revisar: '#f5a524', falso: '#e5484d' };
  const TITULO = { ok: '✅ Pago verificado', espera: '⏳ Aún no llega', revisar: '⚠️ Revísalo', falso: '🚨 NO LO ACEPTES' };
  COLOR.lista = 'var(--accent, #7c5cff)'; TITULO.lista = '📋 Movimientos de Nequi';
  const hora = t => new Date(t).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }).replace(/\.$/, '');
  function mostrarLista(r, mesa, alRegistrar, alQuitar){
    const ov = ventana(), filas = r.filas || [];
    ov.innerHTML = '<div class="modal" style="max-width:440px;width:100%"><h2>' + TITULO.lista + '</h2>' +
      '<div class="modal-sub">Este pantallazo es la lista de movimientos, no un comprobante. Toca el que es de esta cuenta.</div>' +
      '<div class="comp-filas" style="display:flex;flex-direction:column;gap:8px;margin-top:12px">' + filas.map((e, k) => {
        const v = e.pago ? Number(e.pago.monto) : e.monto;
        return '<button type="button" class="btn-ghost comp-fila" data-k="' + k + '" style="display:flex;align-items:center;gap:10px;text-align:left;width:100%;padding:10px 12px">' +
          '<span style="flex:1;min-width:0"><b style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(e.desc) + '</b>' +
          '<small style="color:' + (e.pago ? COLOR.ok : 'var(--text-secondary, #9a9ab0)') + '">' + (e.pago ? '✅ Llegó a las ' + esc(hora(e.pago.t)) : (avisosActivos() ? 'Todavía no veo que haya llegado' : 'Sin avisos automáticos: revísalo en Nequi')) + '</small></span>' +
          '<b style="font-size:17px;white-space:nowrap">' + plata(v) + (e.alt && !e.pago ? ' <small style="font-weight:600">o ' + plata(e.alt) + '</small>' : '') + '</b></button>';
      }).join('') + '</div>' +
      '<div class="modal-actions"><button type="button" class="btn-close" id="compX">Cerrar</button></div></div>';
    ov.classList.add('show');
    ov.querySelector('#compX').onclick = () => ov.classList.remove('show');
    ov.querySelectorAll('.comp-fila').forEach(b => b.onclick = () => {
      const e = filas[+b.dataset.k];
      const info = Object.assign({}, r.info, { lista: null, porEtiqueta: true, elegido: true, monto: e.pago ? Number(e.pago.monto) : e.monto });
      const r2 = verificar(info, mesa); guardar(r2, mesa); mostrar(r2, mesa, alRegistrar, alQuitar);
    });
  }
  function mostrar(r, mesa, alRegistrar, alQuitar){
    if(r.nivel === 'lista') return mostrarLista(r, mesa, alRegistrar, alQuitar);
    const ov = ventana(), i = r.info || {};
    ov.innerHTML = '<div class="modal" style="max-width:420px;width:100%"><h2 style="color:' + COLOR[r.nivel] + '">' + TITULO[r.nivel] + '</h2>' +
      '<div style="font:800 30px/1.2 var(--font-main);text-align:center;margin:4px 0">' + (i.monto ? plata(i.monto) : '¿?') + '</div>' +
      '<div class="modal-sub" style="text-align:center">' + esc(i.app || '') + (i.ref ? ' · Ref. ' + esc(i.ref) : '') + (i.fecha ? ' · ' + new Date(i.fecha).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '') + (i.destino ? ' · a •••' + esc(i.destino) : '') + '</div>' +
      '<ul style="margin:12px 0 0;padding-left:18px;line-height:1.5">' + r.motivos.map(m => '<li>' + esc(m) + '</li>').join('') + '</ul>' +
      '<div class="modal-actions" style="flex-wrap:wrap">' + (r.nivel === 'ok' && alRegistrar ? '<button type="button" class="btn-primary" id="compReg">Registrar ' + (i.monto ? plata(i.monto) : '') + ' en la cuenta</button>' : '') + (r.nivel === 'falso' && alQuitar ? '<button type="button" class="btn-ghost" id="compQuitar">🗑 Quitar el pantallazo de la cuenta</button>' : '') + '<button type="button" class="btn-close" id="compX">Cerrar</button></div></div>';
    ov.classList.add('show');
    ov.querySelector('#compX').onclick = () => ov.classList.remove('show');
    const b = ov.querySelector('#compReg'); if(b) b.onclick = () => { ov.classList.remove('show'); alRegistrar(r); };
    const q = ov.querySelector('#compQuitar'); if(q) q.onclick = () => { ov.classList.remove('show'); alQuitar(r); };
    if(r.nivel === 'falso'){ try{ (window.ventoHablar || window.speakVoice || function(){})('Ojo. ' + r.motivos[0].replace(/🚨/g, '')); }catch(e){} try{ navigator.vibrate && navigator.vibrate([400, 120, 400]); }catch(e){} }
  }

  // Primero el pantallazo tal cual (en el hilo del lector, sin trabar la pantalla). Si así no aparece el valor junto a
  // «¿Cuánto?»/«Valor» (una FOTO de la pantalla, con reflejos), se lee otra vez con el arreglo de las fotos de facturas.
  async function leerArchivo(f){
    const O = window.VitoOfflineOCR;
    if(!O || !(O.textoDeComprobante || O.textoDeImagen)) throw new Error('El lector de comprobantes no está disponible.');
    let info = null, err = null;
    if(O.textoDeComprobante){ try{ info = leer(await O.textoDeComprobante(f)); }catch(e){ err = e; } }
    if((!info || !info.porEtiqueta) && O.textoDeImagen){
      let otra = null; try{ otra = leer(await O.textoDeImagen(f)); }catch(e){ if(!info) throw err || e; }
      if(otra && (!info || otra.porEtiqueta || (!info.monto && otra.monto))){
        if(info){ ['ref', 'fecha', 'dia', 'destino', 'nombre'].forEach(k => { if(otra[k] == null || otra[k] === '') otra[k] = info[k]; }); otra.exito = otra.exito || info.exito; }
        info = otra;
      }
    }
    // 1.62.1: una FOTO del celular tomada de lado o al revés no se lee. Si no salió nada claro, se gira (de lado primero si la
    // foto es horizontal) y se vuelve a leer; se queda la primera vuelta que sí se entiende.
    if(!legible(info) && O.textoDeComprobante && window.createImageBitmap){
      let bmp = null; try{ bmp = await createImageBitmap(f); }catch(e){}
      if(bmp){
        const vueltas = bmp.width > bmp.height * 1.1 ? [90, 270, 180] : [180, 90, 270];
        for(const g of vueltas){
          let otra = null, fg = null; try{ fg = await girar(bmp, g); otra = leer(await O.textoDeComprobante(fg)); }catch(e){}
          if(legible(otra)){
            otra.girada = g; info = otra;
            // Sin el valor: la misma foto ya derecha, con el arreglo de las fotos de facturas.
            if(!info.porEtiqueta && O.textoDeImagen){ try{ const o2 = leer(await O.textoDeImagen(fg)); if(o2.monto && o2.porEtiqueta){ info.monto = o2.monto; info.montoAlt = o2.montoAlt; info.porEtiqueta = o2.porEtiqueta; } }catch(e){} }
            break;
          }
        }
        try{ bmp.close && bmp.close(); }catch(e){}
      }
    }
    if(!info) throw err || new Error('No se pudo leer el comprobante.');
    // Con internet y sin «¿Cuánto?»/«Valor» junto al valor: también lo lee la IA del negocio. El valor de la IA se marca
    // (🤖) y solo se registra si coincide con un pago que DE VERDAD llegó, como siempre: la IA no da un pago por recibido.
    if((!info.monto || !info.porEtiqueta) && !info.lista && navigator.onLine !== false){ try{ const ia = await leerConIA(f); if(ia) info = mezclarIA(info, ia); }catch(e){} }
    return info;
  }
  const legible = i => !!(i && (i.porEtiqueta || i.lista || ((i.monto || i.ref || i.fecha) && (i.exito || i.ref))));
  async function girar(bmp, grados){
    const k = Math.min(1, 2400 / Math.max(bmp.width, bmp.height)), w = Math.round(bmp.width * k), h = Math.round(bmp.height * k);
    const c = document.createElement('canvas'), lado = grados % 180 !== 0;
    c.width = lado ? h : w; c.height = lado ? w : h;
    const x = c.getContext('2d'); x.translate(c.width / 2, c.height / 2); x.rotate(grados * Math.PI / 180); x.drawImage(bmp, -w / 2, -h / 2, w, h);
    const b = await new Promise(z => c.toBlob(z, 'image/jpeg', 0.9));
    return new File([b], 'girada.jpg', { type: 'image/jpeg' });
  }
  async function leerConIA(f){
    if(typeof hasAIKey !== 'function' || !hasAIKey() || typeof aiText !== 'function') return null;
    const foto = typeof scalePhotoForAI === 'function' ? await scalePhotoForAI(f, 1280, 0.75) : null; if(!foto) return null;
    const prompt = 'Es el pantallazo de un comprobante de transferencia en Colombia (Nequi, DaviPlata, Bancolombia, Bre-B u otro banco). ' +
      'Devuelve SOLO este JSON: {"monto": valor ENVIADO en pesos como número entero (no el saldo, no el costo, sin centavos), "referencia": texto o null, ' +
      '"fecha": "AAAA-MM-DD HH:MM" o null, "app": "Nequi"|"DaviPlata"|"Bancolombia"|"Bre-B"|"Otro", "destino": últimos 4 dígitos del celular o cuenta destino o null, "exitoso": true/false}. ' +
      'Si un dato no se ve claro, pon null. No inventes nada.';
    const t = await Promise.race([aiText({ prompt, imageDataUrl: foto, json: true, timeoutMs: 9000, retries: 0, fast: true, maxOutputTokens: 300 }), new Promise((_, n) => setTimeout(() => n(new Error('tarde')), 10000))]);
    const j = typeof cleanAiJsonText === 'function' ? cleanAiJsonText(t) : JSON.parse(t);
    return j && typeof j === 'object' ? j : null;
  }
  function mezclarIA(info, j){
    const r = Object.assign({}, info), m = Math.round(Number(String(j.monto == null ? '' : j.monto).replace(/[^\d.]/g, '')));
    if(m > 0 && m < 1e9 && (!r.monto || !r.porEtiqueta)){
      // ¿El lector sin internet vio ese mismo número en el pantallazo? Entonces es el de la imagen.
      const dig = String(r.texto || '').replace(/[.,\s]/g, '');
      r.monto = m; r.porIA = true; r.iaVisto = dig.indexOf(String(m)) >= 0;
    }
    if(!r.ref && j.referencia && /^[A-Z0-9-]{5,30}$/i.test(String(j.referencia).trim())) r.ref = String(j.referencia).trim().toUpperCase();
    if(!r.fecha && j.fecha){ const x = String(j.fecha).match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?/); if(x){ const t = new Date(+x[1], +x[2] - 1, +x[3], x[4] ? +x[4] : 12, x[5] ? +x[5] : 0).getTime(); if(x[4]) r.fecha = t; else r.dia = r.dia || t; } }
    if(!r.destino && /^\d{4}$/.test(String(j.destino || ''))) r.destino = String(j.destino);
    if((r.app === 'Transferencia' || !r.app) && /^(Nequi|DaviPlata|Bancolombia|Bre-B)$/.test(j.app || '')) r.app = j.app;
    if(!r.exito && j.exitoso === true) r.exito = true;
    return r;
  }
  // Con la cuenta de una mesa abierta y la pantalla quieta (1,5 s sin tocar), el lector se deja cargado: así el primer
  // pantallazo del día ya no espera a que cargue. Una sola vez, nunca mientras se está tocando la pantalla, y no en
  // equipos con poca memoria.
  let precargado = false, ultimoToque = Date.now();
  document.addEventListener('pointerdown', () => { ultimoToque = Date.now(); }, true);
  setInterval(() => {
    if(precargado || document.hidden || Date.now() - ultimoToque < 1500) return;
    if(navigator.deviceMemory && navigator.deviceMemory < 3) return;
    const enCuenta = document.querySelector('.overlay.show #addPaymentBtn'); if(!enCuenta) return;
    precargado = true;
    const ir = () => window.comprobantePrecalentar();
    if(window.requestIdleCallback) window.requestIdleCallback(ir, { timeout: 3000 }); else setTimeout(ir, 0);
  }, 1000);
  window.comprobantePrecalentar = () => { try{ window.VitoOfflineOCR && window.VitoOfflineOCR.precalentar && window.VitoOfflineOCR.precalentar(); }catch(e){} };
  // Uso general: verificar un archivo (o un texto ya leído) para una cuenta.
  window.comprobanteVerificar = async function(fuente, mesa, opciones){
    opciones = opciones || {};
    let info;
    if(typeof fuente === 'string') info = leer(fuente);
    else {
      try{ showToast('🔎 Revisando el comprobante…', 4000); }catch(e){}
      await new Promise(z => setTimeout(z, 0));   // que el aviso se pinte antes de leer
      info = await leerArchivo(fuente);
    }
    const r = verificar(info, mesa);
    guardar(r, mesa);
    if(opciones.mostrar !== false) mostrar(r, mesa, opciones.alRegistrar, opciones.alQuitar);
    return r;
  };
  window.comprobanteLeer = leer;

  // ---------- En la cuenta: al adjuntar «📎 Comprobante» se revisa solo ----------
  const inp = document.getElementById('rcptInput');
  if(inp) inp.addEventListener('change', e => {
    const f = e.target.files && e.target.files[0]; if(!f) return;
    const mesa = typeof currentTable !== 'undefined' ? currentTable : null;
    if(mesa == null || !document.getElementById('modalTitle')) return;
    const enCuenta = document.querySelector('.overlay.show #addPaymentBtn') || document.getElementById('addPaymentBtn');
    if(!enCuenta) return;
    const scope = (typeof rcptScope !== 'undefined' && rcptScope) || 'table';
    window.comprobanteVerificar(f, mesa, { alRegistrar: r => {
      const a = document.getElementById('paymentAmount'), m = document.getElementById('paymentMethod'), n = document.getElementById('paymentNote');
      if(a) a.value = r.info.monto; if(m) m.value = 'transferencia'; if(n && !n.value) n.value = '💜 ' + r.info.app + ' (comprobante verificado)';
      document.getElementById('addPaymentBtn').click();
    }, alQuitar: () => {
      // Antes un comprobante «falso» se quitaba solo: si la lectura se equivocaba, el pantallazo no quedaba en el pago.
      // Ahora queda adjunto y la persona decide.
      try{ pendingReceipt[scope] = null; updatePayPickInfo(scope); showToast('🗑 Pantallazo quitado de la cuenta.'); }catch(e){}
    } }).catch(err => { try{ showToast('No se pudo leer el comprobante: ' + (err.message || err), 7000); }catch(e){} });
  }, true);

  // ---------- Botón suelto: Más → 💜 Pagos y Ajustes → 💜 Pagos ----------
  let entrada = null;
  window.comprobanteElegir = function(mesa){
    if(!entrada){ entrada = document.createElement('input'); entrada.type = 'file'; entrada.accept = 'image/*'; entrada.hidden = true; document.body.appendChild(entrada); }
    window.comprobantePrecalentar();   // el lector carga mientras se elige el pantallazo
    entrada.onchange = () => { const f = entrada.files[0]; entrada.value = ''; if(f) window.comprobanteVerificar(f, mesa != null ? mesa : null).catch(err => showToast('No se pudo leer el comprobante: ' + (err.message || err), 7000)); };
    entrada.click();
  };
  function botonEn(cont, antes){
    if(!cont || cont.querySelector('.comp-btn')) return;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn-ghost comp-btn'; b.setAttribute('data-novocab', '');
    b.textContent = '🔎 Verificar un comprobante (pantallazo)'; b.style.cssText = 'width:100%;margin:8px 0';
    b.onclick = () => window.comprobanteElegir(null);
    if(antes) cont.insertBefore(b, antes); else cont.appendChild(b);
  }
  new MutationObserver(() => {
    const p = document.querySelector('#pagosOv .modal, #pagosPanelOv .modal'); if(p) botonEn(p, p.querySelector('.modal-actions'));
    const g = document.getElementById('vpGrupo'); if(g && g.innerHTML && !g.querySelector('.comp-btn')) botonEn(g, g.querySelector('.vp-checks'));
  }).observe(document.body, { childList: true, subtree: true });
})();
