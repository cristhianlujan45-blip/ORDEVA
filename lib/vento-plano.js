/* ORDEVA · lib/vento-plano.js — 1.78.0: 🗺️ El plano del local (restaurante, bar, café, hotel, tienda…).
   El dueño: «ya no puedo hacer el plano». Desde la vista sencilla (1.65.6) «🗺️ Mapa del local» quedó escondido en
   «⋯ Más opciones». Ahora:
   • Arriba de las mesas / habitaciones, siempre a la vista: «📋 Lista | 🗺️ Plano» y «✏️ Editar plano».
   • ZONAS o PISOS (Salón, Terraza, Barra… · Piso 1, Piso 2): pestañas; cada mesa o habitación va en una.
   • ELEMENTOS del local que no son mesas: barra, cocina, baños, entrada, caja, paredes, ventanas, plantas, escaleras,
     ascensor, recepción, pasillo, estantes, neveras, bodega, tarima, piscina, jardín, parqueadero y textos.
   • Cada mesa con su FORMA, SILLAS (según cuántas personas caben), TAMAÑO y GIRO; las habitaciones con su cama.
   • PLANTILLAS para empezar en un toque: restaurante, bar, café, hotel, tienda o local vacío.
   • Todo se arrastra con el dedo y queda en la cuadrícula; «↩ Deshacer»; nada se borra de las cuentas.
   • Fuera de «Editar», el plano es para trabajar: el color de cada mesa dice su estado (lib/vento-mapa.js) y al tocarla
     se abre su cuenta.
   Se guarda con los datos del negocio (data.plano y en cada mesa: zona, forma, sillas, tamaño, giro, posición). */
(function(){
  'use strict';
  if(window.ventoPlano) return;
  const D = () => (typeof data !== 'undefined' ? data : null);
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = (t, ms) => { try{ showToast(t, ms || 3500); }catch(e){} };
  const guardar = () => { try{ const d = D(); if(d && d.plano && editando) d.plano.usado = 1; saveData(); }catch(e){} };
  const etiqueta = id => { try{ return tableLabel(id); }catch(e){ return 'Mesa ' + id; } };
  const HOSP = ['hotel', 'hostal', 'apartamentos', 'motel'];
  const esHotel = () => { const d = D(); return !!(d && HOSP.includes(d.businessType)); };
  const fam = () => { try{ const t = tipoNegocio(); return (t && t.fam) || ''; }catch(e){ return ''; } };
  const espacio = () => { try{ const t = tipoNegocio(); return (t && t.esp) || ['Mesa', 'Mesas']; }catch(e){ return ['Mesa', 'Mesas']; } };
  const sinLugar = () => ['Cuenta', 'Orden', 'Cliente', 'Pedido', 'Evento', 'Vehículo', 'Mascota', 'Paciente'].includes(espacio()[0]);
  const disponible = () => { const d = D(); return !!d && !sinLugar() && !(d.modulos && d.modulos.p === false); };
  const SNAP = 2.5, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), snap = v => Math.round(v / SNAP) * SNAP;
  const nid = () => 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

  // ---------- Formas de mesa y elementos ----------
  // r: proporción ancho/alto · c: sillas por defecto · cls: la clase de siempre (shape-…)
  const FORMAS = {
    redonda: { n: 'Redonda', ic: '⚪', r: 1, c: 4 }, cuadrada: { n: 'Cuadrada', ic: '⬜', r: 1, c: 4 }, larga: { n: 'Rectangular', ic: '▭', r: 1.8, c: 6 },
    barra: { n: 'Alta / barra', ic: '🍹', r: 1.5, c: 2 }, sofa: { n: 'Sofá / lounge', ic: '🛋️', r: 1.6, c: 4 }, sombrilla: { n: 'Con sombrilla', ic: '⛱️', r: 1, c: 4 },
    cama: { n: 'Habitación', ic: '🛏️', r: 1.4, c: 0 }, billar: { n: 'Billar', ic: '🎱', r: 1.8, c: 0 }, consola: { n: 'Estación', ic: '🎮', r: 1.3, c: 1 },
    silla: { n: 'Silla / puesto', ic: '💺', r: 1, c: 0 }, puesto: { n: 'Puesto', ic: '🚗', r: 0.7, c: 0 }, cancha: { n: 'Cancha', ic: '⚽', r: 1.6, c: 0 }
  };
  const ELEMENTOS = {
    barra: ['🍹', 'Barra', 30, 7], cocina: ['🍳', 'Cocina', 24, 18], bano: ['🚻', 'Baños', 11, 11], entrada: ['🚪', 'Entrada', 14, 4], caja: ['🧾', 'Caja', 11, 7],
    pared: ['', 'Pared', 40, 1.6], ventana: ['🪟', 'Ventana', 20, 1.6], planta: ['🪴', '', 5, 6.5], escalera: ['🪜', 'Escaleras', 9, 14], ascensor: ['🛗', 'Ascensor', 8, 10],
    recepcion: ['🛎️', 'Recepción', 22, 8], pasillo: ['', 'Pasillo', 70, 8], estante: ['🗄️', 'Estante', 24, 5], nevera: ['🧊', 'Neveras', 14, 6], bodega: ['📦', 'Bodega', 16, 16],
    tarima: ['🎤', 'Tarima', 18, 12], piscina: ['🏊', 'Piscina', 30, 20], jardin: ['🌳', 'Jardín', 22, 16], parqueo: ['🅿️', 'Parqueadero', 22, 14], texto: ['🔤', 'Texto', 16, 6]
  };
  const formaDe = t => FORMAS[t && t.shape] ? t.shape : (esHotel() ? 'cama' : 'cuadrada');
  const sillasDe = t => (t && Number.isFinite(+t.cap) && t.cap !== '' && t.cap != null) ? clamp(+t.cap, 0, 12) : FORMAS[formaDe(t)].c;

  // ---------- Datos ----------
  function piso(id){ const m = /(?:^|\D)(\d{3,4})(?:\D|$)/.exec(etiqueta(id)); return m ? Math.floor(Number(m[1]) / 100) : null; }
  function plano(){
    const d = D(); if(!d) return { zonas: [], el: [] };
    if(!d.plano || !Array.isArray(d.plano.zonas) || !d.plano.zonas.length){
      let zonas = [{ id: 'z1', n: esHotel() ? 'Piso 1' : fam() === 'tienda' ? 'Local' : 'Salón' }];
      if(esHotel()){
        const ps = [...new Set(Object.keys(d.tables || {}).map(piso).filter(p => p != null))].sort((a, b) => a - b);
        if(ps.length >= 2){
          zonas = ps.map(p => ({ id: 'p' + p, n: p === 0 ? 'Primer piso' : 'Piso ' + p }));
          Object.keys(d.tables).forEach(id => { const p = piso(id); if(p != null && !d.tables[id].zona) d.tables[id].zona = 'p' + p; });
        }
      }
      d.plano = { v: 1, zonas, el: (d.plano && Array.isArray(d.plano.el)) ? d.plano.el : [] };
    }
    if(!Array.isArray(d.plano.el)) d.plano.el = [];
    return d.plano;
  }
  const zonaDe = t => { const P = plano(); return (t && t.zona && P.zonas.some(z => z.id === t.zona)) ? t.zona : P.zonas[0].id; };
  const K_ZONA = 'vento_plano_zona';
  let zona = null;
  function zonaActual(){ const P = plano(); if(!zona){ try{ zona = localStorage.getItem(K_ZONA); }catch(e){} } if(!P.zonas.some(z => z.id === zona)) zona = P.zonas[0].id; return zona; }
  const idsDeZona = z => Object.keys((D() || {}).tables || {}).map(Number).sort((a, b) => a - b).filter(id => zonaDe(D().tables[id]) === z);

  // Acomodar en cuadrícula dentro de un área (las que no tienen lugar todavía, o todas con «Ordenar»).
  function acomodar(ids, area, todas){
    const d = D(), lista = ids.filter(id => todas || typeof d.tables[id].mapX !== 'number' || typeof d.tables[id].mapY !== 'number');
    if(!lista.length) return;
    const a = area || { x0: 12, x1: 88, y0: 16, y1: 84 }, n = lista.length;
    // El lienzo es 4:3: un % de ancho mide más que uno de alto, así que caben más columnas que filas.
    const cols = Math.max(1, Math.min(n, Math.ceil(Math.sqrt(n * ((a.x1 - a.x0) / (a.y1 - a.y0)) * (4 / 3))))), filas = Math.ceil(n / cols);
    lista.forEach((id, i) => {
      const c = i % cols, f = Math.floor(i / cols), t = d.tables[id];
      t.mapX = snap(a.x0 + (cols === 1 ? (a.x1 - a.x0) / 2 : c * (a.x1 - a.x0) / (cols - 1)));
      t.mapY = snap(a.y0 + (filas === 1 ? (a.y1 - a.y0) / 2 : f * (a.y1 - a.y0) / (filas - 1)));
    });
  }

  // ---------- Plantillas ----------
  const PLANTILLAS = {
    restaurante: { n: '🍽️ Restaurante', area: { x0: 12, x1: 72, y0: 30, y1: 80 }, el: [['barra', 30, 9, 34, 7], ['cocina', 86, 13, 24, 20], ['bano', 92, 44, 12, 12], ['caja', 84, 82, 12, 7], ['entrada', 52, 97, 14, 4], ['ventana', 1.5, 50, 1.6, 40], ['planta', 6, 92], ['planta', 96, 92]] },
    bar: { n: '🍻 Bar', area: { x0: 12, x1: 70, y0: 32, y1: 82 }, forma: 'redonda', tam: 0.85, el: [['barra', 50, 8, 60, 8, 0, 'Barra'], ['tarima', 86, 50, 20, 16, 0, 'DJ / Tarima'], ['bano', 8, 12, 12, 12], ['caja', 86, 84, 12, 7], ['entrada', 52, 97, 14, 4]] },
    cafe: { n: '☕ Café', area: { x0: 16, x1: 84, y0: 36, y1: 80 }, forma: 'redonda', el: [['barra', 28, 10, 36, 8, 0, 'Vitrina y barra'], ['caja', 58, 10, 10, 7], ['bano', 90, 12, 12, 12], ['entrada', 52, 97, 14, 4], ['planta', 6, 30], ['planta', 6, 70], ['planta', 94, 60]] },
    hotel: { n: '🏨 Hotel (un piso)', hotel: true, el: [['pasillo', 50, 50, 92, 9], ['escalera', 96, 50, 6, 16], ['ascensor', 4, 50, 6, 12], ['recepcion', 16, 92, 26, 8]] },
    tienda: { n: '🛒 Tienda', area: { x0: 70, x1: 92, y0: 60, y1: 86 }, el: [['estante', 18, 46, 5, 54, 0, 'Góndola 1'], ['estante', 34, 46, 5, 54, 0, 'Góndola 2'], ['estante', 50, 46, 5, 54, 0, 'Góndola 3'], ['nevera', 40, 6, 56, 6], ['bodega', 90, 14, 16, 18], ['caja', 78, 88, 14, 8], ['entrada', 52, 97, 16, 4]] },
    vacio: { n: '⬜ Local vacío', area: { x0: 14, x1: 86, y0: 16, y1: 84 }, el: [] }
  };
  function aplicarPlantilla(k){
    const T = PLANTILLAS[k], d = D(), P = plano(), z = zonaActual(); if(!T) return;
    deshacerGuardar();
    P.el = P.el.filter(e => e.z !== z).concat(T.el.map(e => {
      const def = ELEMENTOS[e[0]];
      return { id: nid(), t: e[0], z, x: e[1], y: e[2], w: e[3] != null ? e[3] : def[2], h: e[4] != null ? e[4] : def[3], r: e[5] || 0, txt: e[6] != null ? e[6] : def[1] };
    }));
    const ids = idsDeZona(z);
    if(T.hotel){
      // Habitaciones a lado y lado del pasillo.
      const mitad = Math.ceil(ids.length / 2);
      ids.forEach((id, i) => { const arriba = i < mitad, j = arriba ? i : i - mitad, n = arriba ? mitad : ids.length - mitad, t = d.tables[id];
        t.mapX = snap(12 + (n === 1 ? 38 : j * 76 / Math.max(1, n - 1))); t.mapY = arriba ? 26 : 74; t.shape = 'cama'; });
    } else {
      if(T.forma) ids.forEach(id => { if(!FORMAS[d.tables[id].shape] || d.tables[id].shape === 'cuadrada') d.tables[id].shape = T.forma; if(T.tam && !d.tables[id].tam) d.tables[id].tam = T.tam; });
      acomodar(ids, T.area, true);
    }
    guardar(); pintar();
    toast('🗺️ Plantilla «' + T.n.replace(/^\S+\s/, '') + '» lista. Arrastra lo que quieras mover.');
  }
  const plantillaSugerida = () => esHotel() ? 'hotel' : fam() === 'bar' ? 'bar' : fam() === 'tienda' ? 'tienda' : (D() || {}).businessType === 'cafeteria' ? 'cafe' : fam() === 'comida' ? 'restaurante' : 'vacio';

  // ---------- Deshacer ----------
  const pila = [];
  function instantanea(){ const d = D(); return JSON.stringify({ plano: d.plano, mesas: Object.fromEntries(Object.keys(d.tables).map(id => { const t = d.tables[id]; return [id, { mapX: t.mapX, mapY: t.mapY, zona: t.zona, shape: t.shape, cap: t.cap, tam: t.tam, rot: t.rot }]; })) }); }
  function deshacerGuardar(){ pila.push(instantanea()); if(pila.length > 40) pila.shift(); }
  function deshacer(){
    const s = pila.pop(); if(!s){ toast('No hay nada para deshacer.'); return; }
    const o = JSON.parse(s), d = D(); d.plano = o.plano;
    Object.keys(o.mesas).forEach(id => { const t = d.tables[id]; if(!t) return; ['mapX', 'mapY', 'zona', 'shape', 'cap', 'tam', 'rot'].forEach(k => { if(o.mesas[id][k] === undefined) delete t[k]; else t[k] = o.mesas[id][k]; }); });
    guardar(); pintar();
  }

  // ---------- Pintar ----------
  let editando = false, sel = null;   // sel = { k: 'm' | 'e', id }
  function sillasHtml(t){
    const n = sillasDe(t), f = formaDe(t); if(!n) return '';
    let out = '';
    if(f === 'redonda' || f === 'sombrilla'){
      for(let i = 0; i < n; i++){ const a = (i / n) * Math.PI * 2 - Math.PI / 2; out += '<i class="pl-silla" style="left:' + (50 + 62 * Math.cos(a)).toFixed(1) + '%;top:' + (50 + 62 * Math.sin(a)).toFixed(1) + '%"></i>'; }
      return out;
    }
    // A los lados largos primero (arriba y abajo), luego a las cabeceras.
    const cab = n >= 6 ? 2 : (n % 2 ? 1 : 0), lado = n - cab, arriba = Math.ceil(lado / 2), abajo = lado - arriba;
    const fila = (k, y) => { for(let i = 0; i < k; i++) out += '<i class="pl-silla" style="left:' + ((i + 1) * 100 / (k + 1)).toFixed(1) + '%;top:' + y + '%"></i>'; };
    fila(arriba, -16); fila(abajo, 116);
    if(cab >= 1) out += '<i class="pl-silla" style="left:-12%;top:50%"></i>';
    if(cab >= 2) out += '<i class="pl-silla" style="left:112%;top:50%"></i>';
    return out;
  }
  function pintarMesa(lz, id, ctx){
    const d = D(), t = d.tables[id], f = formaDe(t), F = FORMAS[f], isOpen = (t.items || []).length > 0;
    let bal = 0; try{ bal = tableBalance(id); }catch(e){}
    const el = document.createElement('div');
    el.className = 'floor-table pl-mesa pl-f-' + f + (isOpen ? ' open' : '') + (t.photo ? ' has-photo' : '') + (editando ? ' editing' : '') + (sel && sel.k === 'm' && String(sel.id) === String(id) ? ' pl-sel' : '');
    el.style.left = (typeof t.mapX === 'number' ? t.mapX : 50) + '%'; el.style.top = (typeof t.mapY === 'number' ? t.mapY : 50) + '%';
    el.style.setProperty('--tam', String(clamp(Number(t.tam) || 1, 0.7, 1.8))); el.style.setProperty('--r', String(F.r));
    if(t.rot) el.style.setProperty('--rot', t.rot + 'deg');
    el.dataset.id = id;
    el.innerHTML = '<span class="pl-sillas">' + sillasHtml(t) + '</span>' + (t.photo ? '<img class="ft-photo" src="' + t.photo + '" alt="">' : ['redonda', 'cuadrada', 'larga', 'barra'].includes(f) ? '' : '<div class="ft-icon">' + F.ic + '</div>') +
      '<div class="ft-label"><div class="ft-name">' + esc(etiqueta(id)) + '</div><div class="ft-status">' + (isOpen ? (typeof fmt === 'function' ? fmt(bal) : bal) : 'Libre') + '</div></div>';
    try{ if(window.ventoMapa) window.ventoMapa.plano(el, id, ctx); }catch(e){}
    lz.appendChild(el);
  }
  function pintarElemento(lz, e){
    const def = ELEMENTOS[e.t] || ELEMENTOS.texto;
    const el = document.createElement('div');
    el.className = 'pl-el pl-el-' + e.t + (e.h * 3 > e.w * 4 ? ' pl-vert' : '') + (editando ? ' editing' : '') + (sel && sel.k === 'e' && sel.id === e.id ? ' pl-sel' : '');
    el.style.left = e.x + '%'; el.style.top = e.y + '%'; el.style.width = e.w + '%'; el.style.height = e.h + '%';
    if(e.r) el.style.setProperty('--rot', e.r + 'deg');
    el.dataset.eid = e.id;
    const txt = e.txt != null ? e.txt : def[1];
    el.innerHTML = (def[0] ? '<b>' + def[0] + '</b>' : '') + (txt ? '<span>' + esc(txt) + '</span>' : '');
    el.title = txt || def[1];
    lz.appendChild(el);
  }
  function pintar(){
    const fp = $('floorPlan'), d = D(); if(!fp || !d || !d.tables) return;
    const P = plano(), z = zonaActual(), ctx = window.ventoMapa ? window.ventoMapa.contexto() : null;
    acomodar(idsDeZona(z));
    fp.classList.add('pl-on'); fp.classList.toggle('pl-editando', editando);
    const zonas = '<div class="pl-zonas">' + P.zonas.map(x => '<button type="button" class="pl-zona' + (x.id === z ? ' on' : '') + '" data-pl="zona" data-z="' + esc(x.id) + '">' + esc(x.n) + ' <small>' + idsDeZona(x.id).length + '</small></button>').join('') +
      (editando ? '<button type="button" class="pl-zona pl-mas" data-pl="zona+">➕ ' + (esHotel() ? 'Piso' : 'Zona') + '</button>' : '') + '</div>';
    const barra = editando ? '<div class="pl-barra">' +
      '<button type="button" data-pl="mesa+">➕ ' + esc(espacio()[0]) + '</button><button type="button" data-pl="elem">🧱 Elemento</button><button type="button" data-pl="plantillas">🧩 Plantilla</button>' +
      '<button type="button" data-pl="ordenar">↺ Ordenar</button><button type="button" data-pl="deshacer">↩ Deshacer</button><button type="button" class="pl-listo" data-pl="listo">✅ Listo</button></div>' : '';
    fp.innerHTML = zonas + barra + '<div class="pl-scroll"><div class="pl-lienzo" id="plLienzo"></div></div>' + (editando ? '<div class="pl-panel" id="plPanel"></div>' : '') +
      (editando ? '<p class="pl-ayuda">Arrastra con el dedo. Toca algo para cambiarle la forma, las sillas, el tamaño o el nombre.</p>' : '');
    const lz = $('plLienzo');
    P.el.filter(e => e.z === z).forEach(e => pintarElemento(lz, e));
    idsDeZona(z).forEach(id => pintarMesa(lz, id, ctx));
    if(!idsDeZona(z).length && !P.el.some(e => e.z === z)) lz.insertAdjacentHTML('beforeend', '<div class="pl-vacio">' + (editando ? 'Esta ' + (esHotel() ? 'planta' : 'zona') + ' está vacía: toca «➕ ' + esc(espacio()[0]) + '», «🧱 Elemento» o «🧩 Plantilla».' : 'Sin ' + esc(espacio()[1].toLowerCase()) + ' en esta zona.') + '</div>');
    try{ if(window.ventoMapa) window.ventoMapa.planoListo(fp); }catch(e){}
    pintarPanel();
    pintarVista();
  }

  // ---------- Panel de lo elegido (editar) ----------
  function pintarPanel(){
    const p = $('plPanel'); if(!p) return;
    const d = D(), P = plano();
    if(!sel){ p.innerHTML = ''; p.hidden = true; return; }
    p.hidden = false;
    if(sel.k === 'm'){
      const t = d.tables[sel.id]; if(!t){ sel = null; p.hidden = true; return; }
      const f = formaDe(t), formas = esHotel() ? ['cama', 'cuadrada', 'larga'] : fam() === 'tienda' ? ['cuadrada', 'larga', 'redonda', 'puesto'] : ['redonda', 'cuadrada', 'larga', 'barra', 'sofa', 'sombrilla', 'billar', 'consola', 'silla', 'cancha'];
      p.innerHTML = '<div class="pl-ph"><b>' + esc(etiqueta(sel.id)) + '</b><button type="button" class="pl-x" data-pl="soltar">✕</button></div>' +
        '<div class="pl-fila"><span>Forma</span><div class="pl-ops">' + formas.map(k => '<button type="button" class="' + (k === f ? 'on' : '') + '" data-pl="forma" data-v="' + k + '">' + FORMAS[k].ic + ' ' + esc(FORMAS[k].n) + '</button>').join('') + '</div></div>' +
        (f !== 'cama' && f !== 'puesto' && f !== 'cancha' && f !== 'billar' ? '<div class="pl-fila"><span>Sillas</span><div class="pl-paso"><button type="button" data-pl="sillas" data-v="-1">−</button><b>' + sillasDe(t) + '</b><button type="button" data-pl="sillas" data-v="1">+</button></div></div>' : '') +
        '<div class="pl-fila"><span>Tamaño</span><div class="pl-ops">' + [[0.8, 'Pequeño'], [1, 'Normal'], [1.3, 'Grande'], [1.6, 'Muy grande']].map(x => '<button type="button" class="' + (Math.abs((Number(t.tam) || 1) - x[0]) < 0.01 ? 'on' : '') + '" data-pl="tam" data-v="' + x[0] + '">' + x[1] + '</button>').join('') + '</div></div>' +
        '<div class="pl-fila"><span>' + (esHotel() ? 'Piso' : 'Zona') + '</span><select data-pl-sel="zona">' + P.zonas.map(z => '<option value="' + esc(z.id) + '"' + (z.id === zonaDe(t) ? ' selected' : '') + '>' + esc(z.n) + '</option>').join('') + '</select></div>' +
        '<div class="pl-acc"><button type="button" data-pl="girar">↻ Girar</button><button type="button" data-pl="foto">📷 Foto o ícono</button><button type="button" data-pl="nombre">✏️ Nombre</button></div>';
    } else {
      const e = P.el.find(x => x.id === sel.id); if(!e){ sel = null; p.hidden = true; return; }
      const def = ELEMENTOS[e.t] || ELEMENTOS.texto;
      p.innerHTML = '<div class="pl-ph"><b>' + def[0] + ' ' + esc(def[1] || 'Elemento') + '</b><button type="button" class="pl-x" data-pl="soltar">✕</button></div>' +
        '<div class="pl-fila"><span>Texto</span><input data-pl-in="txt" value="' + esc(e.txt != null ? e.txt : def[1]) + '" maxlength="30" placeholder="Ej. Terraza, Baño mujeres…"></div>' +
        '<div class="pl-fila"><span>Ancho</span><div class="pl-paso"><button type="button" data-pl="w" data-v="-2.5">−</button><b>' + Math.round(e.w) + '%</b><button type="button" data-pl="w" data-v="2.5">+</button></div></div>' +
        '<div class="pl-fila"><span>Alto</span><div class="pl-paso"><button type="button" data-pl="h" data-v="-2.5">−</button><b>' + Math.round(e.h) + '%</b><button type="button" data-pl="h" data-v="2.5">+</button></div></div>' +
        '<div class="pl-acc"><button type="button" data-pl="girar">↻ Girar</button><button type="button" data-pl="duplicar">⧉ Duplicar</button><button type="button" class="pl-borrar" data-pl="borrar">🗑️ Quitar</button></div>';
    }
  }

  // ---------- Selector de vista (siempre a la vista) ----------
  function pintarVista(){
    const v = $('view-mesas'), grid = $('tableGrid'); if(!v || !grid) return;
    let b = $('plVista');
    if(!disponible()){ if(b) b.remove(); document.body.classList.remove('pl-activo'); return; }
    document.body.classList.add('pl-activo');
    if(!b){ b = document.createElement('div'); b.id = 'plVista'; b.className = 'pl-vista'; b.setAttribute('data-novocab', ''); const ref = $('rsBarra') && $('rsBarra').parentNode === grid.parentNode ? $('rsBarra') : grid; grid.parentNode.insertBefore(b, ref); }
    const mapa = D().tableViewMode === 'map';
    const h = '<div class="pl-seg"><button type="button" class="' + (mapa ? '' : 'on') + '" data-pl="lista">📋 Lista</button><button type="button" class="' + (mapa ? 'on' : '') + '" data-pl="plano">🗺️ Plano</button></div>' +
      (mapa ? '<button type="button" class="pl-edit' + (editando ? ' on' : '') + '" data-pl="' + (editando ? 'listo' : 'editar') + '">' + (editando ? '✅ Terminar' : '✏️ Editar plano') + '</button>' : '');
    if(b._h !== h){ b._h = h; b.innerHTML = h; }
  }

  // ---------- Botones ----------
  function hoja(titulo, html){
    let ov = $('plHoja');
    if(!ov){ ov = document.createElement('div'); ov.id = 'plHoja'; ov.className = 'overlay'; ov.setAttribute('data-novocab', ''); document.body.appendChild(ov); ov.addEventListener('click', e => { if(e.target === ov) ov.classList.remove('show'); }); }
    ov.innerHTML = '<div class="modal pl-hoja"><div class="modal-title-row"><h2>' + titulo + '</h2><button class="rename-table-btn" data-pl="hoja-x">✕</button></div>' + html + '</div>';
    ov.classList.add('show');
  }
  const cerrarHoja = () => { const o = $('plHoja'); if(o) o.classList.remove('show'); };
  // Pedir un nombre con una ventanita de ORDEVA (no la del navegador).
  function preguntar(t, def){
    return new Promise(res => {
      hoja('✏️ ' + esc(t), '<input id="plPreg" class="pl-preg" maxlength="30" value="' + esc(def || '') + '"><div class="modal-actions"><button type="button" class="btn-close" id="plPregNo">Cancelar</button><button type="button" class="btn-primary" id="plPregSi">Guardar</button></div>');
      const i = $('plPreg'), fin = v => { cerrarHoja(); res(v); };
      setTimeout(() => { try{ i.focus(); i.select(); }catch(e){} }, 50);
      $('plPregSi').onclick = () => fin(i.value);
      $('plPregNo').onclick = () => fin(null);
      i.onkeydown = e => { if(e.key === 'Enter') fin(i.value); if(e.key === 'Escape') fin(null); };
    });
  }
  document.addEventListener('click', async ev => {
    const b = ev.target.closest && ev.target.closest('[data-pl]'); if(!b) return;
    ev.stopPropagation();
    const a = b.dataset.pl, d = D(), P = plano();
    const mesa = sel && sel.k === 'm' ? d.tables[sel.id] : null, el = sel && sel.k === 'e' ? P.el.find(x => x.id === sel.id) : null;
    if(a === 'lista' || a === 'plano'){ d.tableViewMode = a === 'plano' ? 'map' : 'list'; if(a === 'lista'){ editando = false; sel = null; } guardar(); try{ updateMesaViewUI(); }catch(e){ pintar(); } return; }
    if(a === 'editar'){ editando = true; sel = null; /* plano nunca trabajado: ofrece plantillas */ try{ if(!P.el.length && !P.usado) setTimeout(() => ofrecerPlantillas(true), 150); }catch(e){} pintar(); return; }
    if(a === 'listo'){ editando = false; sel = null; guardar(); pintar(); toast('✅ Plano guardado.'); return; }
    if(a === 'zona'){ zona = b.dataset.z; try{ localStorage.setItem(K_ZONA, zona); }catch(e){} sel = null; pintar(); return; }
    if(a === 'zona+'){
      const n = String(await preguntar(esHotel() ? 'Nombre del piso (ej. Piso 2)' : 'Nombre de la zona (ej. Terraza, Segundo piso)', esHotel() ? 'Piso ' + (P.zonas.length + 1) : '') || '').trim(); if(!n) return;
      deshacerGuardar(); const z = { id: 'z' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), n: n.slice(0, 24) }; P.zonas.push(z); zona = z.id; guardar(); pintar(); return;
    }
    if(a === 'mesa+'){
      deshacerGuardar();
      const ids = Object.keys(d.tables).map(Number), id = (ids.length ? Math.max(...ids) : 0) + 1;
      d.tables[id] = { items: [], people: [], payments: [], zona: zonaActual(), mapX: 50, mapY: 50, shape: esHotel() ? 'cama' : undefined };
      d.tableCount = Object.keys(d.tables).length;
      sel = { k: 'm', id }; guardar(); pintar(); try{ renderMesasSummary(); }catch(e){}
      toast('➕ ' + etiqueta(id) + ' en el centro: arrástrala a su lugar.'); return;
    }
    if(a === 'elem'){
      hoja('🧱 Agregar al plano', '<div class="pl-elems">' + Object.keys(ELEMENTOS).map(k => '<button type="button" data-pl="elem-add" data-v="' + k + '"><b>' + (ELEMENTOS[k][0] || '▬') + '</b>' + esc(ELEMENTOS[k][1] || 'Planta') + '</button>').join('') + '</div>');
      return;
    }
    if(a === 'elem-add'){
      const k = b.dataset.v, def = ELEMENTOS[k]; deshacerGuardar();
      const e = { id: nid(), t: k, z: zonaActual(), x: 50, y: 50, w: def[2], h: def[3], r: 0, txt: def[1] };
      P.el.push(e); sel = { k: 'e', id: e.id }; guardar(); cerrarHoja(); pintar(); return;
    }
    if(a === 'plantillas') return ofrecerPlantillas(false);
    if(a === 'plantilla'){
      cerrarHoja();
      const ok = await (typeof showConfirm === 'function' ? showConfirm({ icon: '🧩', title: '¿Usar la plantilla «' + PLANTILLAS[b.dataset.v].n.replace(/^\S+\s/, '') + '»?', message: 'Acomoda las ' + espacio()[1].toLowerCase() + ' de esta zona y pone los elementos del local. Las cuentas no cambian, y con «↩ Deshacer» vuelve como estaba.', confirmText: 'Sí, usarla', cancelText: 'No' }) : Promise.resolve(true));
      if(ok) aplicarPlantilla(b.dataset.v); return;
    }
    if(a === 'ordenar'){ deshacerGuardar(); acomodar(idsDeZona(zonaActual()), null, true); guardar(); pintar(); return; }
    if(a === 'deshacer') return deshacer();
    if(a === 'hoja-x') return cerrarHoja();
    if(a === 'soltar'){ sel = null; pintar(); return; }
    if(mesa){
      if(a === 'forma'){ deshacerGuardar(); mesa.shape = b.dataset.v; delete mesa.cap; }
      else if(a === 'sillas'){ deshacerGuardar(); mesa.cap = clamp(sillasDe(mesa) + Number(b.dataset.v), 0, 12); }
      else if(a === 'tam'){ deshacerGuardar(); mesa.tam = Number(b.dataset.v); if(mesa.tam === 1) delete mesa.tam; }
      else if(a === 'girar'){ deshacerGuardar(); mesa.rot = ((Number(mesa.rot) || 0) + 90) % 360; if(!mesa.rot) delete mesa.rot; }
      else if(a === 'foto'){ try{ openShapePicker(sel.id); }catch(e){} return; }
      else if(a === 'nombre'){
        const n = String(await preguntar('Nombre de ' + etiqueta(sel.id), (mesa.name || '').trim() || etiqueta(sel.id)) || '').trim();
        if(n){ mesa.name = n.slice(0, 30); try{ renderMesasList(); }catch(e){} }
      }
      guardar(); pintar(); return;
    }
    if(el){
      if(a === 'w'){ deshacerGuardar(); el.w = clamp(el.w + Number(b.dataset.v), 1.5, 100); }
      else if(a === 'h'){ deshacerGuardar(); el.h = clamp(el.h + Number(b.dataset.v), 1.5, 100); }
      else if(a === 'girar'){ deshacerGuardar(); const w = el.w; el.w = el.h; el.h = w; }   // girar 90°: cambia ancho por alto (más claro que rotar el texto)
      else if(a === 'duplicar'){ deshacerGuardar(); const c = Object.assign({}, el, { id: nid(), x: clamp(el.x + 5, 0, 100), y: clamp(el.y + 5, 0, 100) }); P.el.push(c); sel = { k: 'e', id: c.id }; }
      else if(a === 'borrar'){ deshacerGuardar(); P.el = P.el.filter(x => x.id !== el.id); sel = null; }
      guardar(); pintar(); return;
    }
  }, true);
  document.addEventListener('change', ev => {
    const s = ev.target.closest && ev.target.closest('[data-pl-sel="zona"]'); if(!s || !sel || sel.k !== 'm') return;
    const t = D().tables[sel.id]; if(!t) return; deshacerGuardar(); t.zona = s.value; zona = s.value; guardar(); pintar();
  }, true);
  document.addEventListener('input', ev => {
    const i = ev.target.closest && ev.target.closest('[data-pl-in="txt"]'); if(!i || !sel || sel.k !== 'e') return;
    const e = plano().el.find(x => x.id === sel.id); if(!e) return; e.txt = i.value.slice(0, 30);
    const n = document.querySelector('.pl-el[data-eid="' + e.id + '"] span'); if(n) n.textContent = e.txt; else pintar();
    clearTimeout(i._t); i._t = setTimeout(guardar, 600);
  }, true);
  function ofrecerPlantillas(primera){
    const sug = plantillaSugerida();
    hoja('🧩 ' + (primera ? '¿Empezamos con una plantilla?' : 'Plantillas'), '<p class="settings-desc">' + (primera ? 'Tu plano está vacío. Elige cómo es tu local y lo acomodamos; después mueves lo que quieras.' : 'Acomoda las ' + esc(espacio()[1].toLowerCase()) + ' de esta zona y pone los elementos del local.') + '</p>' +
      '<div class="pl-elems">' + Object.keys(PLANTILLAS).map(k => '<button type="button" class="' + (k === sug ? 'on' : '') + '" data-pl="plantilla" data-v="' + k + '"><b>' + PLANTILLAS[k].n.split(' ')[0] + '</b>' + esc(PLANTILLAS[k].n.replace(/^\S+\s/, '')) + (k === sug ? '<small>Sugerida</small>' : '') + '</button>').join('') + '</div>');
  }

  // ---------- Arrastrar (dedo o ratón) ----------
  let arr = null;
  document.addEventListener('pointerdown', ev => {
    const lz = $('plLienzo'); if(!lz) return;
    const it = ev.target.closest && ev.target.closest('#plLienzo .pl-mesa, #plLienzo .pl-el'); if(!it) return;
    if(!editando) return;   // fuera de «Editar» se toca para abrir la cuenta
    ev.preventDefault();
    const r = lz.getBoundingClientRect(), d = D();
    const esM = it.classList.contains('pl-mesa'), obj = esM ? d.tables[it.dataset.id] : plano().el.find(x => x.id === it.dataset.eid);
    if(!obj) return;
    arr = { it, esM, obj, r, x0: ev.clientX, y0: ev.clientY, ox: esM ? (obj.mapX || 50) : obj.x, oy: esM ? (obj.mapY || 50) : obj.y, movio: false, antes: instantanea() };
    try{ it.setPointerCapture(ev.pointerId); }catch(e){}
    it.classList.add('dragging');
  }, true);
  document.addEventListener('pointermove', ev => {
    if(!arr) return;
    const dx = (ev.clientX - arr.x0) / arr.r.width * 100, dy = (ev.clientY - arr.y0) / arr.r.height * 100;
    if(Math.abs(dx) + Math.abs(dy) > 1) arr.movio = true;
    if(!arr.movio) return;
    const x = clamp(snap(arr.ox + dx), 2, 98), y = clamp(snap(arr.oy + dy), 2, 98);
    arr.it.style.left = x + '%'; arr.it.style.top = y + '%';
    if(arr.esM){ arr.obj.mapX = x; arr.obj.mapY = y; } else { arr.obj.x = x; arr.obj.y = y; }
  }, true);
  const soltar = () => {
    if(!arr) return;
    const a = arr; arr = null; a.it.classList.remove('dragging');
    if(a.movio){ pila.push(a.antes); if(pila.length > 40) pila.shift(); guardar(); }
    else { sel = a.esM ? { k: 'm', id: Number(a.it.dataset.id) } : { k: 'e', id: a.it.dataset.eid }; }
    pintar();
  };
  document.addEventListener('pointerup', soltar, true);
  document.addEventListener('pointercancel', soltar, true);
  // Tocar una mesa (sin editar): su cuenta.
  document.addEventListener('click', ev => {
    const it = ev.target.closest && ev.target.closest('#plLienzo .pl-mesa'); if(!it || editando) return;
    ev.stopPropagation();
    try{ openTableModal(Number(it.dataset.id)); }catch(e){}
  }, true);

  // ---------- Encajar con lo de siempre ----------
  function envolver(){
    const orig = window.renderFloorPlan; if(typeof orig !== 'function' || orig._pl) return;
    const nuevo = function(){ if(!disponible()) return orig.apply(this, arguments); return pintar(); };
    nuevo._pl = true; window.renderFloorPlan = nuevo;
  }
  envolver();
  setInterval(() => { try{ envolver(); pintarVista(); }catch(e){} }, 1200);
  setTimeout(() => { try{ envolver(); pintarVista(); if(D() && D().tableViewMode === 'map') renderMesas(); }catch(e){} }, 400);

  const css = document.createElement('style');
  css.textContent =
    'body.pl-activo #mesaViewListBtn,body.pl-activo #mesaViewMapBtn,body.pl-activo #floorPlanControls,body.pl-activo #floorPlanHint{display:none!important}' +
    '.pl-vista{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:0 0 10px}.pl-seg{display:inline-flex;border:1px solid var(--line);border-radius:999px;padding:3px;background:var(--surface)}' +
    '.pl-seg button{border:0;background:transparent;color:var(--ink);font:700 14px/1 var(--font-main,inherit);padding:9px 16px;border-radius:999px;cursor:pointer}.pl-seg button.on{background:var(--ink);color:var(--paper,#fff)}' +
    '.pl-edit{border:1px solid var(--line);background:var(--surface);color:var(--ink);font:700 14px/1 var(--font-main,inherit);padding:10px 14px;border-radius:999px;cursor:pointer}.pl-edit.on{background:#16a34a;border-color:#16a34a;color:#fff}' +
    '#floorPlan.pl-on{min-height:0;background:none;border:0;padding:0;overflow:visible}' +
    '.pl-zonas{display:flex;gap:6px;overflow-x:auto;padding:2px 0 8px;scrollbar-width:none}.pl-zona{flex:none;border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:999px;padding:7px 13px;font:700 13px/1 var(--font-main,inherit);cursor:pointer}' +
    '.pl-zona small{opacity:.6;font-weight:600}.pl-zona.on{background:var(--amber);border-color:var(--amber);color:var(--on-amber,#fff)}.pl-zona.pl-mas{border-style:dashed}' +
    '.pl-barra{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 8px}.pl-barra button{border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:12px;padding:9px 12px;font:700 13.5px/1 var(--font-main,inherit);cursor:pointer}.pl-barra .pl-listo{background:#16a34a;border-color:#16a34a;color:#fff;margin-left:auto}' +
    '.pl-scroll{overflow-x:auto;border-radius:18px;-webkit-overflow-scrolling:touch}' +
    '.pl-lienzo{position:relative;width:100%;min-width:560px;aspect-ratio:4/3;container-type:inline-size;border-radius:18px;border:1px solid var(--line);overflow:hidden;touch-action:pan-x pan-y;' +
      'background:linear-gradient(color-mix(in srgb,var(--line) 55%,transparent) 1px,transparent 1px) 0 0/2.5% 3.333%,linear-gradient(90deg,color-mix(in srgb,var(--line) 55%,transparent) 1px,transparent 1px) 0 0/2.5% 3.333%,linear-gradient(160deg,color-mix(in srgb,var(--amber) 5%,var(--paper-2,var(--surface))),var(--paper-2,var(--surface)))}' +
    '.pl-editando .pl-lienzo{outline:2px dashed color-mix(in srgb,#16a34a 60%,transparent);outline-offset:3px}' +
    '.pl-lienzo .floor-table{position:absolute;transform:translate(-50%,-50%) rotate(var(--rot,0deg));width:clamp(46px,calc(var(--tam,1) * 9.5cqw * var(--r,1)),190px);height:clamp(40px,calc(var(--tam,1) * 9.5cqw),110px);border-radius:14px;padding:3px;z-index:2}' +
    '.pl-lienzo .floor-table.pl-f-redonda,.pl-lienzo .floor-table.pl-f-sombrilla{border-radius:50%}.pl-lienzo .floor-table.pl-f-sofa{border-radius:22px}.pl-lienzo .floor-table.pl-f-barra{border-radius:999px}.pl-lienzo .floor-table.pl-f-cama{border-radius:12px 12px 20px 20px}' +
    '.pl-lienzo .floor-table .ft-icon{font-size:clamp(12px,2.2cqw,20px)}.pl-lienzo .floor-table .ft-name{font-size:clamp(8.5px,1.5cqw,12px);line-height:1.1}.pl-lienzo .floor-table .ft-status{font-size:clamp(8px,1.35cqw,11.5px)}' +
    '.pl-lienzo .floor-table.pl-f-silla .ft-label{display:block}.pl-lienzo .floor-table.editing{cursor:grab;touch-action:none}.pl-lienzo .floor-table.dragging,.pl-lienzo .pl-el.dragging{cursor:grabbing;z-index:9;box-shadow:0 12px 26px rgba(0,0,0,.35)}' +
    '.pl-sillas{position:absolute;inset:0;pointer-events:none}.pl-silla{position:absolute;width:clamp(7px,1.5cqw,13px);height:clamp(7px,1.5cqw,13px);border-radius:4px;transform:translate(-50%,-50%);background:color-mix(in srgb,var(--ink) 35%,var(--surface));border:1px solid color-mix(in srgb,var(--ink) 25%,transparent)}' +
    '.pl-sel{outline:3px solid #16a34a!important;outline-offset:3px}' +
    '.pl-el{position:absolute;transform:translate(-50%,-50%) rotate(var(--rot,0deg));display:flex;align-items:center;justify-content:center;gap:4px;border-radius:8px;z-index:1;font:700 clamp(8px,1.4cqw,12.5px)/1.1 var(--font-main,inherit);color:var(--ink-soft);' +
      'background:color-mix(in srgb,var(--ink) 9%,var(--surface));border:1px solid color-mix(in srgb,var(--ink) 18%,transparent);overflow:hidden;text-align:center;padding:2px;user-select:none;-webkit-user-select:none}' +
    '.pl-el b{font-size:clamp(11px,2cqw,18px)}.pl-el span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}.pl-el.pl-vert{flex-direction:column;gap:2px}.pl-el.pl-vert span{font-size:clamp(7px,1.1cqw,10.5px)}.pl-el.editing{cursor:grab;touch-action:none}' +
    '.pl-el-pared{background:color-mix(in srgb,var(--ink) 55%,var(--surface));border:0;border-radius:2px}.pl-el-pared span{display:none}.pl-el-ventana{background:color-mix(in srgb,#38bdf8 45%,var(--surface));border:0}.pl-el-ventana span,.pl-el-ventana b{display:none}' +
    '.pl-el-pasillo{background:repeating-linear-gradient(90deg,transparent 0 14px,color-mix(in srgb,var(--ink) 8%,transparent) 14px 16px),color-mix(in srgb,var(--ink) 4%,var(--surface));border-style:dashed}' +
    '.pl-el-cocina{background:color-mix(in srgb,#f97316 14%,var(--surface))}.pl-el-barra{background:color-mix(in srgb,#a16207 22%,var(--surface))}.pl-el-bano{background:color-mix(in srgb,#0ea5e9 14%,var(--surface))}' +
    '.pl-el-entrada{background:color-mix(in srgb,#16a34a 22%,var(--surface));border-color:#16a34a;color:var(--ink)}.pl-el-caja,.pl-el-recepcion{background:color-mix(in srgb,#7c3aed 14%,var(--surface))}' +
    '.pl-el-planta{background:none;border:0}.pl-el-piscina{background:color-mix(in srgb,#0ea5e9 35%,var(--surface));color:#075985}.pl-el-jardin{background:color-mix(in srgb,#22c55e 22%,var(--surface))}' +
    '.pl-el-estante{background:color-mix(in srgb,#a16207 16%,var(--surface))}.pl-el-nevera{background:color-mix(in srgb,#38bdf8 18%,var(--surface))}.pl-el-tarima{background:color-mix(in srgb,#ec4899 14%,var(--surface))}' +
    '.pl-el-texto{background:none;border:0;color:var(--ink);font-size:clamp(10px,1.9cqw,16px)}' +
    '.pl-vacio{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;padding:20px;color:var(--ink-soft);font-size:14px}' +
    '.pl-panel{margin-top:10px;border:1px solid var(--line);border-radius:16px;padding:10px 12px;background:var(--surface);display:flex;flex-direction:column;gap:8px}.pl-panel[hidden]{display:none}' +
    '.pl-ph{display:flex;justify-content:space-between;align-items:center}.pl-x{border:0;background:transparent;color:var(--ink-soft);font-size:16px;cursor:pointer}' +
    '.pl-fila{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.pl-fila>span{min-width:62px;font-size:12.5px;font-weight:700;color:var(--ink-soft)}.pl-fila select,.pl-fila input{flex:1;min-width:140px;padding:8px 10px;border-radius:10px;border:1px solid var(--line);background:var(--surface-2,#fff);color:var(--ink);font:inherit}' +
    '.pl-ops{display:flex;flex-wrap:wrap;gap:6px;flex:1}.pl-ops button,.pl-acc button,.pl-paso button{border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:10px;padding:7px 10px;font:700 12.5px/1.1 var(--font-main,inherit);cursor:pointer}' +
    '.pl-ops button.on{background:var(--ink);color:var(--paper,#fff);border-color:var(--ink)}.pl-paso{display:flex;align-items:center;gap:10px}.pl-paso b{min-width:36px;text-align:center}.pl-paso button{width:40px;height:36px;font-size:18px;padding:0}' +
    '.pl-acc{display:flex;gap:6px;flex-wrap:wrap}.pl-acc .pl-borrar{color:#dc2626}.pl-ayuda{font-size:12.5px;color:var(--ink-soft);margin:8px 2px 0}' +
    '.pl-preg{width:100%;padding:12px;border-radius:12px;border:1px solid var(--line);background:var(--surface-2,#fff);color:var(--ink);font:inherit;font-size:16px;margin:6px 0 4px}.pl-hoja{max-width:560px;width:min(560px,96vw);max-height:90vh;overflow:auto}.pl-elems{display:grid;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:8px;margin-top:8px}' +
    '.pl-elems button{display:flex;flex-direction:column;align-items:center;gap:4px;padding:12px 6px;border-radius:14px;border:1px solid var(--line);background:var(--surface);color:var(--ink);font:700 13px/1.15 var(--font-main,inherit);cursor:pointer}.pl-elems button b{font-size:24px}' +
    '.pl-elems button.on{border-color:var(--amber);box-shadow:0 0 0 2px color-mix(in srgb,var(--amber) 40%,transparent)}.pl-elems button small{font-weight:600;color:var(--amber);font-size:11px}';
  document.head.appendChild(css);

  window.ventoPlano = { pintar, plano, aplicarPlantilla, PLANTILLAS, ELEMENTOS, FORMAS, editar: v => { editando = !!v; sel = null; pintar(); }, estado: () => ({ editando, sel, zona: zonaActual() }), disponible };
})();
