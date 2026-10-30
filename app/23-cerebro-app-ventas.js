/* ORDEVA · app/23-cerebro-app-ventas.js — antes estaba dentro de index.html (línea 32011). Se carga en el mismo lugar y orden. */
/* =====================================================================
   ORDEVA · cerebro de la app (ventas, ganancias, acciones y piloto automático)
   ---------------------------------------------------------------------
   Se suma al motor de ORDEVA que ya existe (no lo reemplaza):
   • Entiende VENTAS y GANANCIAS por período, compara con la semana pasada, dice lo más vendido y la hora pico.
   • ACTÚA con confirmación: cambiar un precio, sumar stock que llegó, armar la lista de compras.
   • PILOTO AUTOMÁTICO: revisa sola el negocio y propone lo que conviene hacer (comprar lo que se acaba,
     subir un precio cuando subió el costo, cobrar una mesa olvidada, fiados viejos, productos quietos) y
     da un resumen del día. Todo se muestra en la tarjeta «🧠 ORDEVA» del inicio, con botones de un toque.
   Regla de siempre: ORDEVA propone, la app valida y la persona confirma. Nada se cambia sin confirmación,
   los cambios de precio y stock son solo para administradores y todo queda en la actividad de ORDEVA.
   ===================================================================== */
(function(){
  if(!window.Laya) return;
  const DIA = 864e5;
  const listo = () => typeof data !== 'undefined' && data && Array.isArray(data.products) && Array.isArray(data.history);
  const plata = n => (typeof fmt === 'function' ? fmt(Math.round(n || 0)) : '$' + Math.round(n || 0));
  const N = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const bul = l => l.map(x => '• ' + x).join('\n');
  const esAdmin = () => { try{ return typeof authIsAdmin !== 'function' || authIsAdmin(); }catch(e){ return true; } };
  const reg = (c, t) => { try{ window.Laya.registrar(c, t); }catch(e){} };
  const AUTO_DEF = { avisos: true, tarjeta: true, resumen: true, compras: true, precios: true, mesas: true, fiados: true, quietos: true };
  const auto = () => Object.assign({}, AUTO_DEF, (listo() && data.layaAuto) || {});

  // ---------- Ventas por período ----------
  function periodo(t){
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0); const h = hoy.getTime();
    const lunes = h - ((hoy.getDay() + 6) % 7) * DIA, mes1 = new Date(hoy.getFullYear(), hoy.getMonth(), 1).getTime();
    if(/\bayer\b/.test(t)) return { ini: h - DIA, fin: h, txt: 'ayer' };
    if(/\bsemana pasada\b/.test(t)) return { ini: lunes - 7 * DIA, fin: lunes, txt: 'la semana pasada' };
    if(/\b(esta semana|la semana|semanal)\b/.test(t)) return { ini: lunes, fin: Date.now() + 1, txt: 'esta semana' };
    if(/\bmes pasado\b/.test(t)) return { ini: new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1).getTime(), fin: mes1, txt: 'el mes pasado' };
    if(/\b(este mes|el mes|mensual)\b/.test(t)) return { ini: mes1, fin: Date.now() + 1, txt: 'este mes' };
    return { ini: h, fin: Date.now() + 1, txt: 'hoy' };
  }
  function ventas(ini, fin){
    const H = data.history.filter(e => { const t = Date.parse(e.date || e.closedAt || 0); return t >= ini && t < fin && !e.anulada && !e.voided; });
    let total = 0, costo = 0, sinCosto = 0, unidades = 0; const prod = {}, horas = {};
    H.forEach(e => {
      total += Number(e.total) || 0; const hr = new Date(Date.parse(e.date)).getHours(); horas[hr] = (horas[hr] || 0) + (Number(e.total) || 0);
      (e.items || []).forEach(i => {
        const q = Number(i.qty) || 0, v = q * (Number(i.price) || 0); unidades += q;
        const k = String(i.name || '').replace(/^🛵 /, ''); if(!/domicilio|propina/i.test(k)){ prod[k] = prod[k] || { q: 0, v: 0 }; prod[k].q += q; prod[k].v += v; }
        if(i.cost != null && i.cost !== '') costo += q * Number(i.cost); else if(!/domicilio|propina/i.test(k)) sinCosto += v;
      });
    });
    const conCosto = total - sinCosto;
    return { H, n: H.length, total, costo, ganancia: conCosto - costo, margen: conCosto > 0 ? (conCosto - costo) / conCosto : null, sinCosto, unidades, prod, horas };
  }
  const top = (prod, n) => Object.entries(prod).sort((a, b) => b[1].q - a[1].q).slice(0, n);

  // ---------- Lista de compras (lo que se acaba, cuánto pedir y a quién) ----------
  function ultimoProveedor(id){
    for(const c of (data.purchases || [])) if((c.items || []).some(i => i.productId === id)) return c.supplier || 'Proveedor';
    return 'Sin proveedor registrado';
  }
  function listaCompras(){
    const pred = {}; try{ (window.Laya.prediccion() || []).forEach(x => { pred[x.p.id] = x; }); }catch(e){}
    return data.products.filter(p => !p.combo && typeof invStatus === 'function' && ['out', 'low'].includes(invStatus(p))).map(p => {
      const x = pred[p.id], min = p.minStock != null ? p.minStock : (typeof INV_DEF_MIN !== 'undefined' ? INV_DEF_MIN : 5);
      const objetivo = x && x.porDia > 0 ? Math.ceil(x.porDia * 7) : min * 2;          // para una semana de ventas
      return { p, quedan: p.stock || 0, pedir: Math.max(1, objetivo - (p.stock || 0)), prov: ultimoProveedor(p.id), porDia: x ? x.porDia : 0 };
    }).sort((a, b) => a.prov.localeCompare(b.prov) || a.quedan - b.quedan);
  }
  function textoLista(l){
    const g = {}; l.forEach(x => { (g[x.prov] = g[x.prov] || []).push(x); });
    return '🛒 Pedido para ' + (data.businessName || 'el negocio') + '\n' + Object.entries(g).map(([prov, xs]) => '\n*' + prov + '*\n' + xs.map(x => '• ' + x.pedir + ' × ' + x.p.name).join('\n')).join('\n');
  }
  function abrirLista(){
    const l = listaCompras();
    let ov = document.getElementById('layaListaOv');
    if(!ov){ ov = document.createElement('div'); ov.id = 'layaListaOv'; ov.className = 'overlay'; document.body.appendChild(ov);
      ov.addEventListener('click', e => { if(e.target === ov || e.target.closest('[data-ll="cerrar"]')) ov.classList.remove('show'); }); }
    const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    ov.innerHTML = '<div class="modal" style="max-width:520px"><h2>🛒 Lista de compras de ORDEVA</h2><div class="modal-sub">' + (l.length ? 'Para cubrir una semana de ventas (según lo que se vendió en los últimos 14 días). Cambia las cantidades si quieres.' : 'No hay productos por comprar: todo tiene stock suficiente. ✅') + '</div>' +
      (l.length ? '<div class="ll-tabla">' + l.map((x, i) => '<div class="ll-fila"><span><b>' + esc(x.p.name) + '</b><small>' + esc(x.prov) + ' · quedan ' + x.quedan + (x.porDia ? ' · se venden ~' + (Math.round(x.porDia * 10) / 10) + '/día' : '') + '</small></span><input type="number" min="0" inputmode="numeric" data-i="' + i + '" value="' + x.pedir + '"></div>').join('') + '</div>' +
        '<div class="modal-actions" style="flex-wrap:wrap;gap:8px"><button type="button" class="btn-primary" data-ll="wa">📲 Enviar por WhatsApp</button><button type="button" class="btn-ghost" data-ll="copiar">📋 Copiar</button><button type="button" class="btn-close" data-ll="cerrar">Cerrar</button></div>' :
        '<div class="modal-actions"><button type="button" class="btn-close" data-ll="cerrar">Cerrar</button></div>') + '</div>';
    const leer = () => l.map((x, i) => Object.assign({}, x, { pedir: Math.max(0, parseInt(ov.querySelector('[data-i="' + i + '"]').value, 10) || 0) })).filter(x => x.pedir > 0);
    const bw = ov.querySelector('[data-ll="wa"]'); if(bw) bw.onclick = () => { reg('ejecución', 'Lista de compras enviada por WhatsApp'); window.open('https://wa.me/?text=' + encodeURIComponent(textoLista(leer())), '_blank'); };
    const bc = ov.querySelector('[data-ll="copiar"]'); if(bc) bc.onclick = () => { const t = textoLista(leer()); (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => showToast('📋 Lista copiada.'), () => prompt('Copia la lista:', t)); };
    ov.classList.add('show');
  }

  // ---------- Sugerencias (el «piloto automático») ----------
  const precioRedondo = v => Math.ceil(v / 100) * 100;
  function sugerencias(){
    if(!listo()) return [];
    const a = auto(), out = [], ahora = Date.now();
    if(a.resumen){
      const ay = periodo('ayer'), v = ventas(ay.ini, ay.fin);
      if(v.n) out.push({ id: 'res-' + new Date(ay.ini).toDateString(), icono: '📊', prio: 1, texto: 'Ayer vendiste ' + plata(v.total) + ' en ' + v.n + ' cuenta' + (v.n === 1 ? '' : 's') + (v.costo ? ', ganancia ~' + plata(v.ganancia) : '') + (top(v.prod, 1)[0] ? '. Lo más vendido: ' + top(v.prod, 1)[0][0] + '.' : '.'), acciones: [{ label: 'Ver resumen', pregunta: 'ORDEVA, resumen del día de ayer' }] });
    }
    if(a.compras){
      const l = listaCompras();
      if(l.length) out.push({ id: 'compras-' + l.map(x => x.p.id + ':' + x.quedan).join(','), icono: '🛒', prio: 5, texto: (l.length === 1 ? 'Se acaba ' + l[0].p.name + ' (quedan ' + l[0].quedan + ').' : l.length + ' productos se acaban (' + l.slice(0, 3).map(x => x.p.name).join(', ') + (l.length > 3 ? '…' : '') + ').') + ' Te armé la lista de compras.', acciones: [{ label: 'Ver lista', op: 'listaCompra' }] });
    }
    if(a.precios && esAdmin()){
      try{
        (window.Laya.cambiosPrecio() || []).filter(x => x.pct > 0 && ahora - x.t < 10 * DIA && x.p && x.p.price > 0).forEach(x => {
          const p = x.p, margenAntes = (p.price - x.de) / p.price, margenAhora = (p.price - x.a) / p.price;
          if(!(margenAntes > 0.05) || margenAhora >= margenAntes - 0.03) return;
          const nuevo = precioRedondo(x.a / (1 - margenAntes)); if(nuevo <= p.price) return;
          out.push({ id: 'precio-' + p.id + '-' + x.a, icono: '📈', prio: 4, texto: p.name + ' te cuesta ' + x.pct + '% más (' + plata(x.de) + ' → ' + plata(x.a) + '). Para seguir ganando ' + Math.round(margenAntes * 100) + '%, véndelo a ' + plata(nuevo) + ' (hoy ' + plata(p.price) + ').',
            acciones: [{ label: 'Subir a ' + plata(nuevo), op: 'precio', id: p.id, precio: nuevo }] });
        });
      }catch(e){}
    }
    // 💜 Pagos digitales confirmados que todavía no se registraron en ninguna mesa
    try{ (((data.pagos || {}).lista) || []).filter(x => (!x.estado || x.estado === 'app' || x.estado === 'ok') && !x.aplicado && !x.ignorado && ahora - x.t < 6 * 36e5).slice(0, 2).forEach(x =>
      out.push({ id: 'pago-' + x.id, icono: '💜', prio: 6, texto: 'Llegó ' + plata(x.monto) + ' por ' + x.app + (pagoDet(x).de ? ' de ' + pagoDet(x).de : '') + (x.mesa ? ' (coincide con ' + tableLabel(x.mesa) + ')' : '') + ' y no está registrado en ninguna cuenta.', acciones: [{ label: x.mesa ? 'Registrar en ' + tableLabel(x.mesa) : 'Elegir la mesa', op: 'pago', id: x.id }] })); }catch(e){}
    if(a.mesas){
      Object.keys(data.tables || {}).forEach(k => {
        const t = data.tables[k], its = (t && t.items) || []; if(!its.length) return;
        let ult = 0; its.forEach(i => (i.history || []).forEach(h => { if(h.at > ult) ult = h.at; }));
        if(ult && ahora - ult > 3 * 36e5){ const horas = Math.floor((ahora - ult) / 36e5);
          out.push({ id: 'mesa-' + k + '-' + ult, icono: '⏰', prio: 3, texto: tableLabel(+k) + ' lleva ' + horas + ' h sin movimiento y debe ' + plata(typeof tableBalance === 'function' ? tableBalance(+k) : 0) + '. ¿Ya se fueron?', acciones: [{ label: 'Abrir ' + tableLabel(+k), op: 'abrirMesa', id: +k }] }); }
      });
    }
    if(a.fiados){
      const viejos = data.history.filter(e => (e.debt || 0) > 0 && ahora - Date.parse(e.date) > 15 * DIA);
      if(viejos.length){ const tot = viejos.reduce((s, e) => s + e.debt, 0), quien = [...new Set(viejos.map(e => e.person || e.tableName || (e.table ? tableLabel(e.table) : '¿?')))].slice(0, 3);
        out.push({ id: 'fiados-' + viejos.length + '-' + Math.round(tot), icono: '📒', prio: 2, texto: 'Te deben ' + plata(tot) + ' desde hace más de 15 días (' + quien.join(', ') + (viejos.length > 3 ? '…' : '') + ').', acciones: [{ label: 'Ver deudas', vista: 'historial' }] }); }
    }
    if(a.quietos){
      const masViejo = data.history.length ? Date.parse(data.history[data.history.length - 1].date) : ahora;
      if(ahora - masViejo > 30 * DIA){
        const vendidos = new Set(); data.history.filter(e => ahora - Date.parse(e.date) < 30 * DIA).forEach(e => (e.items || []).forEach(i => vendidos.add(N(i.name))));
        const q = data.products.filter(p => !p.combo && (p.stock || 0) > 0 && !vendidos.has(N(p.name)));
        if(q.length) out.push({ id: 'quietos-' + q.length + '-' + new Date().getMonth(), icono: '💤', prio: 0, texto: q.length + ' producto' + (q.length === 1 ? '' : 's') + ' con stock no se vendi' + (q.length === 1 ? 'ó' : 'eron') + ' en 30 días (' + q.slice(0, 3).map(p => p.name).join(', ') + (q.length > 3 ? '…' : '') + '). Una promoción podría moverlos.', acciones: [{ label: 'Ver productos', vista: 'productos' }] });
      }
    }
    const ocultas = (data.layaOcultas || {});
    return out.filter(s => !(ocultas[s.id] && ahora - ocultas[s.id] < DIA)).sort((x, y) => y.prio - x.prio);
  }

  // ---------- Preguntas nuevas ----------
  function cerebro(raw){
    if(!listo()) return null;
    const t = N(raw).replace(/^((oye|hola|ok|okey|ey|hey),? )?(laya|vento|bento|ordeva|hordeva|or deva)\b ?/, '');
    if(!t) return null;
    if(/\b(abre|abrir|abreme|muestrame|pon)\b.*\bcalculadora\b|^calculadora$/.test(t)) return { text: '🧮 Abro la calculadora.', run: () => { try{ asisClose(); }catch(e){} window.calculadoraAbrir && window.calculadoraAbrir(); } };
    // Avisos de ORDEVA: «ORDEVA, desactiva tus notificaciones» / «ORDEVA, vuelve a mostrar los avisos»
    if(/\b(avisos|notificaciones|alertas|mensajes)\b/.test(t) && /\b(desactiva|desactivar|apaga|apagar|quita|quitar|silencia|calla|no me (mandes|muestres|salgan))\b/.test(t)){
      data.layaAuto = Object.assign({}, auto(), { avisos: false }); saveData(); reg('ejecución', 'Avisos de ORDEVA apagados');
      return { text: '🔕 Listo: ya no te salen mis avisos en pantalla. Los sigo guardando en Ajustes → ORDEVA IA → «Avisos recientes». Para volver: «ORDEVA, activa tus avisos».' };
    }
    if(/\b(avisos|notificaciones|alertas)\b/.test(t) && /\b(activa|activar|prende|enciende|vuelve a|muestrame de nuevo)\b/.test(t)){
      data.layaAuto = Object.assign({}, auto(), { avisos: true }); saveData(); reg('ejecución', 'Avisos de ORDEVA prendidos');
      return { text: '🔔 Listo: te vuelvo a avisar lo importante.' };
    }
    // Música y TV
    const mus = window.vitoMusica, enTV = typeof lngOn === 'function' && lngOn();
    if(/\b(que (cancion )?(esta sonando|suena|esta en el tv|estan poniendo)|que cancion es (esta|esa)|que suena)\b/.test(t)){
      let txt = '';
      if(enTV && typeof lng !== 'undefined' && lng.tvVid){ const inf = (typeof lngInfoVideo === 'function' && lngInfoVideo(lng.tvVid)) || {}; txt = '📺 En el TV ' + (lng.tvSt === 2 ? 'está en pausa' : 'suena') + ': «' + (inf.t || 'un video de YouTube') + '»' + (inf.c ? ' · ' + inf.c : '') + '.'; }
      const a = mus && mus.actual && mus.actual();
      if(!txt && a) txt = '🎵 Suena «' + (a.title || a.song) + '», pedida por ' + tableLabel(a.mesa) + '.';
      const cola = mus && mus.cola ? mus.cola().filter(x => !x.done || x.status === 'tv').length : 0;
      return { text: (txt || '🎵 Ahora no está sonando nada de ORDEVA.') + (cola ? '\n' + cola + (cola === 1 ? ' canción espera' : ' canciones esperan') + ' en la cola.' : '') };
    }
    if(/\b(salta|saltar|pasa|pasar|cambia|siguiente)\b.*\b(cancion|tema|musica)\b|^siguiente( cancion)?$/.test(t) && !/\bmesa\b/.test(t)){
      if(enTV && typeof lngSaltar === 'function'){ lngSaltar(); return { text: '⏭ Le dije al TV que pase a la siguiente.' }; }
      if(mus && mus.saltar){ mus.saltar(); return { text: '⏭ Pasé a la siguiente canción.' }; }
    }
    if(/^(pausa|pausar|para|parar|deten|detener)( la)?( musica| cancion| tv)?$|\b(pausa|pon en pausa|deten) (la )?(musica|cancion)\b/.test(t) && enTV && typeof lngVivoCmd === 'function'){ lngVivoCmd('pause', '⏸ En pausa en el TV'); return { text: '⏸ Pausé la música en el TV.' }; }
    if(/^(sigue|seguir|reanuda|continua|play|dale play)( la)?( musica| cancion)?$|\b(reanuda|continua|sigue con) (la )?(musica|cancion)\b/.test(t) && enTV && typeof lngVivoCmd === 'function'){ lngVivoCmd('play', '▶ Sigue sonando en el TV'); return { text: '▶ La música sigue en el TV.' }; }
    const pc = t.match(/^(?:pon(?:me|le)?|agrega(?:me)?|coloca(?:me)?|reproduce|mete)\s+(?:la cancion|el tema|una cancion de|la musica de|musica de|cancion de|la de)\s+(.{2,80})$/) || t.match(/^(?:agrega|pon|mete)\s+(.{2,80}?)\s+(?:a|en) la (?:cola|musica|lista)$/);
    if(pc && window.vitoAddSong){ const msg = window.vitoAddSong(0, pc[1]); reg('ejecución', 'Canción agregada: ' + pc[1]); return { text: /ya está|⚠️/.test(msg) ? msg : '🎵 Agregué «' + pc[1] + '» a la cola' + (enTV ? ': entra al TV detrás de la que suena.' : '.') }; }
    if(/\b(cuantas|que) canciones\b.*\b(cola|esperan|faltan|hay)\b/.test(t) && mus){
      const l = mus.cola().filter(x => !x.done || x.status === 'tv'); return { text: l.length ? '🎵 En la cola (' + l.length + '):\n' + bul(l.slice(0, 10).map(x => (x.title || x.song) + ' · ' + tableLabel(x.mesa))) : '🎵 La cola está vacía.' };
    }
    if(/\b(busca|buscar|conecta|conectar|muestrame|transmite|transmitir|manda)\b.*\b(tv|tele|televisor|televisores|chromecast)\b/.test(t) && typeof tvTransmitirToque === 'function'){
      return { text: '📺 Busco los TV de tu wifi.', run: () => { try{ asisClose(); }catch(e){} const nb = document.querySelector('nav button[data-view="musica"]'); if(nb) nb.click(); setTimeout(() => { try{ tvTransmitirToque(); }catch(e){} }, 400); } };
    }
    // «salen comerciales», «quitar anuncios», «tengo YouTube Premium» → cómo poner la música sin comerciales.
    if(/\b(comerciales?|anuncios?|propagandas?|publicidad|premium)\b/.test(t)&&/\b(musica|youtube|cancion|canciones|salen|sale|quitar|quita|premium|video)\b/.test(t)&&window.vitoSinComerciales){
      return { text: '🚫 Te muestro cómo poner la música SIN comerciales con tu YouTube Premium (en el YouTube de tu TV, sin límites).', run: () => { try{ asisClose(); }catch(e){} setTimeout(() => window.vitoSinComerciales(), 200); } };
    }
    // «¿Cómo agrego DaviPlata?», «vincular Nequi», «que me avise cuando me paguen» → el paso a paso.
    if(/\b(agrega|agregar|agrego|anadir|anado|conecta|conectar|conecto|vincula|vincular|vinculo|configura|configurar|activa|activar|poner|pongo|instalo|tutorial|paso a paso)\b.*\b(nequi|daviplata|davi plata|david plata)\b|\b(avise|avisa|avisar|aviso)\b.*\b(paguen|pagan|pagaron|pasen plata|llegue (la )?plata)\b/.test(t) && window.ventoPagosGuia){
      return { text: '📘 Te muestro el paso a paso para agregar DaviPlata (y Nequi): así ORDEVA te avisa una sola vez «Pagaron $X» cada vez que te pasan plata.', run: () => { try{ asisClose(); }catch(e){} setTimeout(() => window.ventoPagosGuia(), 200); } };
    }
    if(/\b(nequi|daviplata|bre b|transferencias?|pagos? (digitales|de hoy|recibidos|que llegaron)|me (ha |han )?llegado|cuanto (me )?llego|llego (el )?pago|llegaron pagos)\b/.test(t) && window.pagosResumen){
      const mesaP = (t.match(/\bmesa (\d+)\b/) || [])[1]; return { text: window.pagosResumen(periodo(t), mesaP ? +mesaP : null), actions: [{ tipo: 'laya', op: 'pagosPanel', label: '💜 Ver los pagos' }] };
    }
    // Cuentas: «ORDEVA, súmame 3500 más 4000 y multiplícame 5000 por 2»
    if(window.ventoCalcular && !/\b(mesa|cuenta de|pedido)\b/.test(t)){ const c = window.ventoCalcular(raw.replace(/^\s*((oye|hola|ok|okey|ey|hey)[\s,]+)?(laya|vento|bento|ordeva|hordeva|or deva)\b[\s,]*/i, ''), true); if(c) return { text: c.texto }; }
    const pe = periodo(t);
    if(/\b(ganancia|ganancias|utilidad|cuanto gane|cuanto he ganado|cuanto ganamos|me gane|rentabilidad|margen de hoy)\b/.test(t)){
      const v = ventas(pe.ini, pe.fin); reg('consulta', 'Ganancia ' + pe.txt);
      if(!v.n) return { text: 'No hay ventas registradas ' + pe.txt + '.' };
      return { text: '💰 ' + pe.txt.charAt(0).toUpperCase() + pe.txt.slice(1) + ': vendiste ' + plata(v.total) + ' en ' + v.n + ' cuenta' + (v.n === 1 ? '' : 's') + '.\n' +
        (v.costo ? '• Costo de lo vendido: ' + plata(v.costo) + '\n• Ganancia: ' + plata(v.ganancia) + (v.margen != null ? ' (' + Math.round(v.margen * 100) + '% de margen)' : '') : '• No tengo costos de estos productos: agrégalos (o aplica facturas) para calcular la ganancia.') +
        (v.sinCosto > 0 && v.costo ? '\n• ' + plata(v.sinCosto) + ' en ventas de productos sin costo registrado no entran en la ganancia.' : '') };
    }
    if(/\b(compara|comparado|comparacion|vs|versus|como voy|como vamos)\b/.test(t) && /\b(semana|ayer|pasad|antes|venta|vendi)\b/.test(t)){
      const hoy = periodo('hoy'), sem = periodo('esta semana');
      const a1 = ventas(hoy.ini, Date.now()), a0 = ventas(hoy.ini - 7 * DIA, Date.now() - 7 * DIA);
      const s1 = ventas(sem.ini, Date.now()), s0 = ventas(sem.ini - 7 * DIA, Date.now() - 7 * DIA);
      const dif = (x, y) => y ? (x >= y ? '▲ ' : '▼ ') + Math.abs(Math.round((x - y) / y * 100)) + '%' : (x ? 'nuevo' : '—');
      reg('consulta', 'Comparación de ventas');
      return { text: '📊 Comparado con hace una semana (a esta misma hora):\n' + bul(['Hoy: ' + plata(a1.total) + ' vs ' + plata(a0.total) + ' (' + dif(a1.total, a0.total) + ')', 'Esta semana: ' + plata(s1.total) + ' vs ' + plata(s0.total) + ' (' + dif(s1.total, s0.total) + ')']) };
    }
    if(/\b(lo mas vendido|mas vendidos?|que se vende mas|que mas se vende|producto estrella|mejores productos|top de productos|que vendo mas)\b/.test(t)){
      const v = ventas(pe.ini, pe.fin), l = top(v.prod, 8); reg('consulta', 'Lo más vendido ' + pe.txt);
      return { text: l.length ? '🏆 Lo más vendido ' + pe.txt + ':\n' + bul(l.map(([n, x]) => x.q + ' × ' + n + ' (' + plata(x.v) + ')')) : 'No hay ventas ' + pe.txt + '.' };
    }
    if(/\b(hora pico|horas pico|a que hora vendo mas|mejor hora|horas de mas venta|a que hora se vende mas)\b/.test(t)){
      const p2 = /\b(hoy|ayer)\b/.test(t) ? pe : { ini: Date.now() - 30 * DIA, fin: Date.now() + 1, txt: 'en los últimos 30 días' };
      const v = ventas(p2.ini, p2.fin), hs = Object.entries(v.horas).sort((a, b) => b[1] - a[1]).slice(0, 3);
      return { text: hs.length ? '⏰ Horas de más venta ' + p2.txt + ':\n' + bul(hs.map(([h, val]) => h + ':00 a ' + (+h + 1) + ':00 → ' + plata(val))) : 'Todavía no hay ventas para saberlo.' };
    }
    if(/\b(lista de compras?|que (debo|tengo que|hay que|toca) comprar|que compro|que pido|pedido (al|a los|para el) proveedor|armame el pedido|arma el pedido|surtir)\b/.test(t)){
      const l = listaCompras(); reg('sugerencia', 'Lista de compras (' + l.length + ')');
      if(!l.length) return { text: '✅ No hay nada urgente por comprar: todo tiene stock suficiente.' };
      return { text: '🛒 Para cubrir una semana de ventas te sugiero pedir:\n' + bul(l.slice(0, 12).map(x => x.pedir + ' × ' + x.p.name + ' (quedan ' + x.quedan + ' · ' + x.prov + ')')), actions: [{ tipo: 'laya', op: 'listaCompra', label: '🛒 Abrir la lista (WhatsApp / copiar)' }] };
    }
    // «sube el precio de la poker a 4500», «pon la aguila a 4.000», «cambia el precio del tinto a 2500»
    const mp = t.match(/\b(?:sube|subele|baja|bajale|cambia|cambiale|pon|ponle|deja|actualiza)\b(?: el)?(?: precio)?(?: de| del| a| al)?(?: la| el| los| las)? (.+?) (?:a|en|por) \$? ?(\d[\d .]*)(?: pesos| mil)?$/);
    if(mp && /precio|sube|baja|vale|cuesta|\d{3}/.test(t)){
      let precio = parseInt(mp[2].replace(/[ .]/g, ''), 10); if(/\bmil\b/.test(t) && precio < 1000) precio *= 1000;
      const p = buscarProducto(mp[1]);
      if(p && precio > 0){
        if(!esAdmin()) return { text: '🔒 Cambiar precios es solo para un administrador.' };
        const F = window.ventoFinanzas;   // 🧮 motor financiero
        const margen = p.cost > 0 ? ' Con costo ' + plata(p.cost) + ' te quedaría ' + Math.round(F ? F.margen(precio, p.cost) : (precio - p.cost) / precio * 100) + '% de margen.' : '';
        return { text: '¿Cambio el precio de ' + p.name + ' de ' + plata(p.price) + ' a ' + plata(precio) + '?' + margen + (p.cost > 0 && precio <= p.cost ? ' ⚠️ Ojo: quedaría por debajo del costo.' : ''), actions: [{ tipo: 'laya', op: 'precio', id: p.id, precio, label: '✅ Sí, a ' + plata(precio) }] };
      }
    }
    // «llegaron 24 aguilas», «agrega 12 poker al inventario», «entraron 30 club»
    const ms = t.match(/\b(?:llegaron|llego|entraron|entro|recibi|me llegaron|agrega|suma|sumale|mete)\b (\d+) (.+?)(?: al inventario| al stock| a inventario)?$/);
    if(ms && (/\b(llegaron|llego|entraron|entro|recibi)\b/.test(t) || /\b(inventario|stock)\b/.test(t))){
      const q = parseInt(ms[1], 10), p = buscarProducto(ms[2]);
      if(p && q > 0){
        if(!esAdmin()) return { text: '🔒 Sumar inventario es solo para un administrador.' };
        return { text: '¿Sumo ' + q + ' a ' + p.name + '? Quedarían ' + ((p.stock || 0) + q) + '.', actions: [{ tipo: 'laya', op: 'stock', id: p.id, qty: q, label: '✅ Sí, sumar ' + q }] };
      }
    }
    if(/\b(que me (recomiendas|sugieres|aconsejas)|recomendaciones|sugerencias|consejos|que hago|que deberia hacer|piloto automatico|que hay pendiente|que tengo pendiente)\b/.test(t)){
      const s = sugerencias(); reg('consulta', 'Sugerencias (' + s.length + ')');
      return { text: s.length ? '🧠 Esto es lo que te recomiendo ahora:\n' + bul(s.slice(0, 8).map(x => x.icono + ' ' + x.texto)) : '🧠 Todo en orden: no veo nada urgente. ✅',
        actions: s.flatMap(x => x.acciones.filter(a => a.op === 'precio' || a.op === 'listaCompra').map(a => Object.assign({ tipo: 'laya', label: a.label }, a))).slice(0, 4) };
    }
    if(/\b(resumen del dia|como me fue|como nos fue|buenos dias|buen dia|cierre del dia|como cerramos)\b/.test(t)){
      const p2 = /\bayer\b|buenos dias|buen dia/.test(t) ? periodo('ayer') : pe, v = ventas(p2.ini, p2.fin), l = listaCompras(), s = sugerencias();
      reg('consulta', 'Resumen ' + p2.txt);
      return { text: '📋 Resumen de ' + p2.txt + ':\n' + bul([
        'Ventas: ' + plata(v.total) + ' en ' + v.n + ' cuenta' + (v.n === 1 ? '' : 's') + (v.n ? ' (ticket promedio ' + plata(v.total / v.n) + ')' : ''),
        v.costo ? 'Ganancia: ' + plata(v.ganancia) + (v.margen != null ? ' (' + Math.round(v.margen * 100) + '%)' : '') : 'Ganancia: falta el costo de los productos',
        top(v.prod, 3).length ? 'Lo más vendido: ' + top(v.prod, 3).map(([n, x]) => x.q + ' ' + n).join(', ') : 'Sin productos vendidos',
        l.length ? 'Por comprar: ' + l.length + ' producto' + (l.length === 1 ? '' : 's') : 'Inventario: al día',
        s.length ? 'Pendientes: ' + s.filter(x => !/^res-/.test(x.id)).length : 'Sin pendientes'
      ]) };
    }
    return null;
  }
  function buscarProducto(txt){
    const q = N(txt).replace(/\b(la|el|los|las|de|del|unidades|unidad|cajas?|botellas?|latas?)\b/g, ' ').replace(/s\b/g, '').replace(/\s+/g, ' ').trim(); if(!q) return null;
    const c = data.products.filter(p => !p.combo), w = q.split(' ');
    let mejor = null, pm = 0;
    c.forEach(p => { const n = N(p.name).replace(/s\b/g, ''); let s = 0; if(n === q) s = 100; else { w.forEach(x => { if(x.length > 2 && n.includes(x)) s += 10 + x.length; }); if(n.startsWith(w[0])) s += 5; } if(s > pm){ pm = s; mejor = p; } });
    return pm >= 12 ? mejor : null;
  }

  // ---------- Acciones nuevas (siempre después de confirmar) ----------
  function ejecutarNuevo(a){
    if(a.op === 'listaCompra'){ setTimeout(abrirLista, 150); return '🛒 Abro la lista de compras.'; }
    if(a.op === 'pagosPanel'){ setTimeout(() => window.pagosAbrirPanel && window.pagosAbrirPanel(), 150); return '💜 Abro los pagos.'; }
    if(a.op === 'pago'){ const x = (((data.pagos || {}).lista) || []).find(y => y.id === a.id); if(x && window.pagoLlego) setTimeout(() => window.pagoLlego(x, true), 150); return '💜 Abro el pago.'; }
    if(a.op === 'calculadora'){ setTimeout(() => window.calculadoraAbrir && window.calculadoraAbrir(), 150); return '🧮 Abro la calculadora.'; }
    if(a.op === 'abrirMesa'){ try{ if(typeof asisClose === 'function') asisClose(); openTableModal(a.id); }catch(e){} return 'Abro ' + tableLabel(a.id) + '.'; }
    if(a.op === 'precio' || a.op === 'stock'){
      if(!esAdmin()){ reg('crítica', 'Denegado (sin permiso): ' + a.op); return '🔒 Eso es solo para un administrador.'; }
      const p = data.products.find(x => x.id === a.id); if(!p) return 'Ya no encontré ese producto.';
      if(a.op === 'precio'){ const antes = p.price; p.price = Math.round(a.precio); data.preciosLog = data.preciosLog || []; data.preciosLog.unshift({ t: Date.now(), id: p.id, name: p.name, de: antes, a: p.price, por: 'ORDEVA', usuario: (typeof authUser !== 'undefined' && authUser) || '' });
        saveData(); try{ renderProductos(); renderInventario(); }catch(e){} reg('ejecución', 'Precio de ' + p.name + ': ' + plata(antes) + ' → ' + plata(p.price)); return '✅ ' + p.name + ' ahora vale ' + plata(p.price) + ' (antes ' + plata(antes) + ').'; }
      const antes = p.stock || 0; p.stock = antes + a.qty; data.inventarioMov = data.inventarioMov || [];
      data.inventarioMov.push({ id: Date.now() + '-' + p.id, tipo: 'entrada manual', productId: p.id, name: p.name, qty: a.qty, usuario: (typeof authUser !== 'undefined' && authUser) || '', at: Date.now(), origen: 'ORDEVA' });
      saveData(); try{ renderInventario(); renderProductos(); }catch(e){} reg('ejecución', 'Stock de ' + p.name + ': ' + antes + ' → ' + p.stock); return '✅ ' + p.name + ': ahora hay ' + p.stock + ' (sumé ' + a.qty + ').';
    }
    return null;
  }
  const responderBase = window.Laya.responder, ejecutarBase = window.Laya.ejecutar;
  window.Laya.responder = raw => { let r = null; try{ r = cerebro(raw); }catch(e){ console.error(e); } return r || responderBase(raw); };
  window.Laya.ejecutar = a => { const r = ejecutarNuevo(a); return r != null ? r : ejecutarBase(a); };
  Object.assign(window.Laya, { ventas, sugerencias, listaCompras, abrirLista });

  // ---------- Tarjeta «🧠 ORDEVA» en el inicio ----------
  function pintarTarjeta(){
    const vista = document.getElementById('view-mesas'); if(!vista || !listo()) return;
    let box = document.getElementById('layaHome');
    const s = (auto().tarjeta && esAdmin()) ? sugerencias().slice(0, 3) : [];
    if(!s.length){ if(box) box.hidden = true; return; }
    if(!box){ box = document.createElement('div'); box.id = 'layaHome'; box.className = 'laya-home';
      // Va en la 🔔 campanita («📣 Avisos de ORDEVA»), no en la pantalla principal (1.43.8).
      const enCampana = document.getElementById('vcAvisos');
      if(enCampana) enCampana.appendChild(box);
      else { const ref = vista.querySelector('.stats-row, .stats, #statsRow') || vista.firstElementChild; ref && ref.nextSibling ? vista.insertBefore(box, ref.nextSibling) : vista.prepend(box); }
      box.addEventListener('click', ev => {
        const b = ev.target.closest('button[data-s]'); if(!b) return;
        const sg = sugerencias().find(x => x.id === b.dataset.s); if(!sg) return pintarTarjeta();
        if(b.dataset.a === 'x'){ data.layaOcultas = data.layaOcultas || {}; data.layaOcultas[sg.id] = Date.now(); Object.keys(data.layaOcultas).forEach(k => { if(Date.now() - data.layaOcultas[k] > 3 * DIA) delete data.layaOcultas[k]; }); saveData(); return pintarTarjeta(); }
        const ac = sg.acciones[+b.dataset.a]; if(!ac) return;
        if(ac.pregunta){ try{ asisOpen(); setTimeout(() => asisAsk(ac.pregunta), 250); }catch(e){} return; }
        if(ac.vista){ const nb = document.querySelector('nav button[data-view="' + ac.vista + '"]'); if(nb && nb.offsetParent) nb.click(); else if(typeof asisGoView === 'function') asisGoView(ac.vista); return; }
        if(ac.op === 'precio'){ const p = data.products.find(x => x.id === ac.id);
          Promise.resolve(typeof showConfirm === 'function' ? showConfirm({ title: 'Cambiar precio', message: (p ? p.name + ': ' + plata(p.price) + ' → ' : '') + plata(ac.precio) + '. ¿Confirmas?', confirmText: 'Sí, cambiar' }) : confirm('¿Cambiar el precio?'))
            .then(ok => { if(ok){ showToast(ejecutarNuevo(Object.assign({ tipo: 'laya' }, ac))); pintarTarjeta(); } }); return; }
        const r = ejecutarNuevo(Object.assign({ tipo: 'laya' }, ac)); if(r && !['listaCompra', 'abrirMesa', 'pago', 'calculadora'].includes(ac.op)) showToast(r);
      });
    }
    const esc = x => String(x).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    box.hidden = false;
    box.innerHTML = '<div class="lh-h"><b>🧠 ORDEVA</b><button type="button" class="lh-mas" onclick="try{asisOpen();setTimeout(()=>asisAsk(\'ORDEVA, ¿qué me recomiendas?\'),250)}catch(e){}">Ver todo ›</button></div>' +
      s.map(x => '<div class="lh-it"><span class="lh-ic">' + x.icono + '</span><div class="lh-tx">' + esc(x.texto) + '<div class="lh-bt">' + x.acciones.map((a, i) => '<button type="button" class="btn-ghost" data-s="' + esc(x.id) + '" data-a="' + i + '">' + esc(a.label) + '</button>').join('') + '</div></div><button type="button" class="lh-x" data-s="' + esc(x.id) + '" data-a="x" aria-label="Ocultar por hoy">✕</button></div>').join('');
  }
  setInterval(() => { try{ pintarTarjeta(); }catch(e){} }, 60000);
  document.addEventListener('visibilitychange', () => { if(!document.hidden) try{ pintarTarjeta(); }catch(e){} });
  document.addEventListener('click', e => { if(e.target.closest && e.target.closest('nav button[data-view="mesas"]')) setTimeout(() => { try{ pintarTarjeta(); }catch(x){} }, 100); });
  setTimeout(() => { try{ pintarTarjeta(); }catch(e){} }, 4000);
  window.layaPintarTarjeta = pintarTarjeta;

  // ---------- Ajustes → ORDEVA IA: interruptores del piloto automático ----------
  function panelAuto(){
    const g = document.getElementById('layaGrupo'); if(!g || !listo()) return;
    const ya = document.getElementById('layaAutoCard');
    if(ya){ ya.querySelectorAll('[data-auto]').forEach(x => { x.checked = !!auto()[x.dataset.auto]; }); return; }
    const OPS = [['avisos', '🔔 Avisos de ORDEVA en pantalla (apágalo para que no te salgan mensajes)'], ['tarjeta', 'Tarjeta de ORDEVA en el inicio'], ['resumen', 'Resumen del día anterior'], ['compras', 'Lista de compras cuando algo se acaba'], ['precios', 'Sugerir precio cuando sube el costo'], ['mesas', 'Avisar mesas sin movimiento (más de 3 h)'], ['fiados', 'Recordar fiados de más de 15 días'], ['quietos', 'Productos que no se venden en 30 días']];
    const c = document.createElement('div'); c.className = 'jm-card'; c.id = 'layaAutoCard';
    c.innerHTML = '<b>🤖 Piloto automático</b><div class="settings-desc">ORDEVA revisa el negocio sola y te propone qué hacer. Nada se cambia sin que lo confirmes.</div>' +
      OPS.map(([k, l]) => '<label class="lh-sw"><input type="checkbox" data-auto="' + k + '"' + (auto()[k] ? ' checked' : '') + '> ' + l + '</label>').join('');
    c.addEventListener('change', e => { const x = e.target.closest('[data-auto]'); if(!x) return; data.layaAuto = Object.assign({}, auto(), { [x.dataset.auto]: x.checked }); saveData(); pintarTarjeta(); });
    const ref = g.querySelector('.jm-card'); ref ? g.insertBefore(c, ref) : g.appendChild(c);
  }
  document.addEventListener('click', e => { if(e.target.closest && e.target.closest('.ajustes-cat[data-cat="laya"]')) setTimeout(panelAuto, 80); });
  setTimeout(panelAuto, 3000);

  const st = document.createElement('style');
  st.textContent = '.laya-home{border:1px solid var(--amber,#f59e0b);border-radius:16px;padding:10px 12px;margin:10px 0 14px;background:color-mix(in srgb,var(--amber,#f59e0b) 8%,var(--surface))}' +
    '.lh-h{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px}.lh-mas{border:0;background:none;color:var(--amber,#f59e0b);font:inherit;font-weight:700;cursor:pointer}' +
    '.lh-it{display:flex;gap:8px;align-items:flex-start;padding:8px 0;border-top:1px solid var(--line)}.lh-it:first-of-type{border-top:0}.lh-ic{font-size:20px;line-height:1.2}' +
    '.lh-tx{flex:1;min-width:0;font-size:14px;line-height:1.4;overflow-wrap:anywhere}.lh-bt{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}.lh-bt .btn-ghost{padding:6px 10px;font-size:13px}' +
    '.lh-x{border:0;background:none;color:var(--ink-soft);font-size:16px;cursor:pointer;padding:2px 4px}.lh-sw{display:flex;gap:8px;align-items:center;padding:6px 0;font-size:14px}' +
    '.ll-tabla{display:flex;flex-direction:column;gap:6px;max-height:50vh;overflow:auto;margin:8px 0}.ll-fila{display:flex;gap:8px;align-items:center;border:1px solid var(--line);border-radius:10px;padding:8px}' +
    '.ll-fila span{flex:1;min-width:0}.ll-fila small{display:block;color:var(--ink-soft);font-size:12px}.ll-fila input{width:70px;padding:8px;border-radius:8px;border:1px solid var(--line);background:var(--surface-2,transparent);color:inherit;font-size:16px;text-align:center}';
  document.head.appendChild(st);
})();
