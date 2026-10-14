/* =====================================================================
   Vento · Guía para personas mayores (modo fácil)
   ---------------------------------------------------------------------
   Inspirada en lo que funciona en los celulares y apps para mayores (BIG Launcher, BaldPhone, GrandPad, Wiser):
     • UNA pregunta por pantalla, con letra y botones grandes, un dibujo y palabras sencillas;
     • Vento dice cada paso en voz alta (🔊 «Repetir» lo vuelve a decir) y se puede contestar hablando (🎤);
     • «← Atrás» y «✕ Salir» siempre en el mismo lugar; nada se borra sin querer;
     • un botón amarillo «🙋 Ayúdame» siempre a la vista: se le dice qué se necesita («quiero agregar una cerveza»,
       «dónde veo las facturas») y Vento abre la guía de esa tarea o lo explica (con la IA, si está conectada);
     • la primera vez, un recorrido que señala cada botón de la pantalla y explica para qué sirve.
   Tareas guiadas: agregar un producto, llegó mercancía (sumar unidades), foto a un producto, cambiar un precio,
   escanear una factura, ver mis facturas, cuánto vendí hoy, cómo vender, música.
   Usa lo que ya existe en la app (data, saveData, fotos de productos, facturas, panel de YouTube, modo fácil).
   ===================================================================== */
(function(){
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const plata = n => '$' + Math.round(Number(n) || 0).toLocaleString('es-CO');
  const D = () => (typeof data !== 'undefined' && data) ? data : null;
  const guardar = () => { try{ saveData(); }catch(e){} try{ renderProductos(); }catch(e){} try{ window.ventoFacil && window.ventoFacil.pintar(); }catch(e){} };
  const VOZ_K = 'vento-guia-voz', TOUR_K = 'vento-guia-tour', GRANDE_K = 'vento-guia-grande';
  const ls = (k, v) => { try{ if(v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); }catch(e){ return null; } };
  const vozOn = () => ls(VOZ_K) !== '0';
  const sinT = x => String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  // Cómo llama este negocio a sus «mesas» (mesa, cuenta, habitación…). La guía no deja que la app cambie la palabra
  // «mesa» sola (data-novocab): «ponga la factura sobre una mesa» es el mueble, no una cuenta.
  const esp = () => { try{ return String((typeof espacio === 'function' && espacio()[0]) || 'Mesa').toLowerCase(); }catch(e){ return 'mesa'; } };

  // ---------- Voz ----------
  function decir(t){
    if(!vozOn() || !t) return;
    const limpio = String(t).replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ' ').replace(/\$\s?([\d.]+)/g, (m, n) => n.replace(/\./g, '') + ' pesos').replace(/\s+/g, ' ').trim();
    try{ if(window.speechSynthesis && speechSynthesis.cancel) speechSynthesis.cancel(); }catch(e){}
    try{ if(typeof ventoHablar === 'function') ventoHablar(limpio); else if(typeof speakVoice === 'function') speakVoice(limpio); }catch(e){}
  }
  // ---------- Micrófono (una frase) ----------
  let oyendo = null;
  function escuchar(listo, boton){
    const C = window.SpeechRecognition || window.webkitSpeechRecognition;
    if(!C){ showToast('Este celular no deja hablarle a la app. Escríbalo, por favor.'); return; }
    if(oyendo){ try{ oyendo.abort(); }catch(e){} oyendo = null; }
    try{ if(window.speechSynthesis) speechSynthesis.cancel(); }catch(e){}
    const r = new C(); r.lang = 'es-CO'; r.continuous = false; r.interimResults = false; r.maxAlternatives = 1;
    oyendo = r; let dijo = '';
    const txt = boton ? boton.innerHTML : '';
    if(boton){ boton.classList.add('gz-oyendo'); boton.innerHTML = '🔴 Le escucho…'; }
    r.onresult = e => { try{ dijo = Array.from(e.results).map(x => x[0].transcript).join(' ').trim(); }catch(x){} };
    r.onerror = () => {};
    r.onend = () => { oyendo = null; if(boton){ boton.classList.remove('gz-oyendo'); boton.innerHTML = txt; } if(dijo) listo(dijo); else showToast('No le escuché. Toque 🎤 y hable cerquita.'); };
    try{ r.start(); }catch(e){ oyendo = null; if(boton){ boton.classList.remove('gz-oyendo'); boton.innerHTML = txt; } }
  }

  // ---------- Pantalla de la guía ----------
  function ventana(){
    let ov = $('gzOv'); if(ov) return ov;
    // Es una «ventana» de la app (.overlay): el botón Atrás del celular la cierra como cualquier otra (window.ventoAtras).
    ov = document.createElement('div'); ov.id = 'gzOv'; ov.className = 'overlay gz'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('data-novocab', '');
    ov.innerHTML = '<div class="gz-top"><button type="button" class="gz-atras">← Atrás</button><span class="gz-paso"></span><button type="button" class="gz-x">✕ Salir</button></div>' +
      '<div class="gz-cuerpo"><div class="gz-ico"></div><h2 class="gz-preg"></h2><p class="gz-ayuda"></p><div class="gz-campo"></div></div>' +
      '<div class="gz-pie"><button type="button" class="gz-oir">🔊 Repetir</button><button type="button" class="gz-sig">Siguiente ➜</button></div>';
    document.body.appendChild(ov);
    ov.querySelector('.gz-x').onclick = cerrar;
    ov.querySelector('.gz-atras').onclick = atras;
    ov.querySelector('.gz-oir').onclick = () => decir(ov._dicho || '');
    ov.querySelector('.gz-sig').onclick = siguiente;
    ov._fin = cerrar;      // botón Atrás del celular (window.ventoAtras)
    return ov;
  }
  let G = null;          // guía en curso: { k, def, i, st }
  function cerrar(){
    const ov = $('gzOv'); if(ov) ov.classList.remove('show');
    G = null; try{ if(oyendo) oyendo.abort(); }catch(e){}
    try{ if(window.speechSynthesis) speechSynthesis.cancel(); }catch(e){}
  }
  const pasos = () => G.def.pasos.filter(p => !p.si || p.si(G.st));
  function iniciar(k, pre){
    const def = GUIAS[k]; if(!def) return false;
    if(def.directo){ cerrar(); def.directo(pre || {}); return true; }
    G = { k, def, i: 0, st: Object.assign({}, pre || {}) };
    // Si ya viene el producto elegido (desde otra guía), se salta la pregunta «¿cuál producto?».
    if(G.st.prod) G.i = Math.max(0, pasos().findIndex(p => p.tipo !== 'producto'));
    const ov = ventana(); ov.classList.add('show');
    pintar(); return true;
  }
  function pintar(){
    if(!G) return;
    const ov = ventana(), ps = pasos(), p = ps[G.i], st = G.st;
    if(!p){ cerrar(); return; }
    const txt = v => typeof v === 'function' ? v(st) : (v || '');
    ov.querySelector('.gz-paso').textContent = (G.def.titulo || '') + (ps.length > 1 && p.tipo !== 'fin' ? ' · Paso ' + (G.i + 1) + ' de ' + ps.filter(x => x.tipo !== 'fin').length : '');
    ov.querySelector('.gz-ico').textContent = txt(p.ico) || G.def.ico || '';
    ov.querySelector('.gz-preg').textContent = txt(p.preg);
    const ay = txt(p.ayuda); ov.querySelector('.gz-ayuda').textContent = ay; ov.querySelector('.gz-ayuda').hidden = !ay;
    const campo = ov.querySelector('.gz-campo'); campo.innerHTML = ''; campo.className = 'gz-campo gz-' + p.tipo;
    const sig = ov.querySelector('.gz-sig');
    sig.hidden = p.tipo === 'producto' || p.tipo === 'opciones' || p.tipo === 'fin';
    sig.textContent = txt(p.boton) || 'Siguiente ➜';
    ov.querySelector('.gz-atras').textContent = '← Atrás'; ov.querySelector('.gz-atras').style.visibility = G.i === 0 ? 'hidden' : '';   // en el primer paso solo «✕ Salir» (dos «Salir» confunden)
    (CAMPOS[p.tipo] || (() => {}))(campo, p, st);
    ov._dicho = txt(p.voz) || (p.tipo === 'fin' && st.resumen ? '¡Listo! ' + st.resumen : (txt(p.preg) + (ay ? '. ' + ay : '')));
    decir(ov._dicho);
    setTimeout(() => { const i = campo.querySelector('input:not([type=file])'); if(i && !('ontouchstart' in window)) try{ i.focus(); }catch(e){} }, 120);
  }
  function siguiente(){
    if(!G) return;
    const p = pasos()[G.i], st = G.st;
    if(p.leer) p.leer($('gzOv').querySelector('.gz-campo'), st);
    const v = p.valido ? p.valido(st) : true;
    if(v !== true){ showToast(v, 4500); decir(v); return; }
    if(p.alSalir){ const r = p.alSalir(st); if(r === false) return; }
    G.i++;
    if(G.i >= pasos().length){ cerrar(); return; }
    pintar();
  }
  function atras(){ if(!G) return; if(G.i === 0){ cerrar(); return; } G.i--; const p = pasos()[G.i]; if(p && p.tipo === 'fin') G.i--; pintar(); }

  // ---------- Tipos de pregunta ----------
  const CAMPOS = {
    texto(c, p, st){
      c.innerHTML = '<div class="gz-fila"><input class="gz-in" type="text" maxlength="60" autocomplete="off" placeholder="' + esc(p.ej || '') + '"><button type="button" class="gz-mic" aria-label="Decirlo con la voz">🎤</button></div>';
      const i = c.querySelector('input'); i.value = st[p.campo] || '';
      i.onkeydown = e => { if(e.key === 'Enter'){ e.preventDefault(); siguiente(); } };
      c.querySelector('.gz-mic').onclick = e => escuchar(t => { i.value = t.replace(/^\w/, x => x.toUpperCase()).slice(0, 60); }, e.currentTarget);
      p.leer = (cc, s) => { s[p.campo] = cc.querySelector('input').value.trim(); };
    },
    numero(c, p, st){
      const chips = p.chips || [];
      c.innerHTML = '<div class="gz-fila">' + (p.pesos ? '<span class="gz-signo">$</span>' : '<button type="button" class="gz-menos" aria-label="Uno menos">−</button>') +
        '<input class="gz-in gz-num" type="number" inputmode="numeric" min="0" step="1" placeholder="' + esc(p.ej || '') + '">' + (p.pesos ? '' : '<button type="button" class="gz-mas" aria-label="Uno más">+</button>') + '</div>' +
        '<div class="gz-ver"></div>' + (chips.length ? '<div class="gz-chips">' + chips.map(n => '<button type="button" data-n="' + n + '">' + (p.pesos ? plata(n) : n) + '</button>').join('') + '</div>' : '') +
        (p.opcional ? '<button type="button" class="gz-saltar">' + esc(p.opcional) + '</button>' : '') +
        '<button type="button" class="gz-mic gz-mic-ancho">🎤 Decirlo con la voz</button>';
      const i = c.querySelector('input'), ver = c.querySelector('.gz-ver');
      const pint = () => { const n = Number(i.value); ver.textContent = i.value === '' ? '' : (p.pesos ? plata(n) : n + ' ' + (p.unidad || 'unidades')); };
      i.value = st[p.campo] != null && st[p.campo] !== '' ? st[p.campo] : (p.inicial ? p.inicial(st) : '');
      i.oninput = pint; pint();
      i.onkeydown = e => { if(e.key === 'Enter'){ e.preventDefault(); siguiente(); } };
      c.querySelectorAll('[data-n]').forEach(b => b.onclick = () => { i.value = b.dataset.n; pint(); });
      const mm = c.querySelector('.gz-menos'), ma = c.querySelector('.gz-mas');
      if(mm) mm.onclick = () => { i.value = Math.max(0, (Number(i.value) || 0) - 1); pint(); };
      if(ma) ma.onclick = () => { i.value = (Number(i.value) || 0) + 1; pint(); };
      const sl = c.querySelector('.gz-saltar'); if(sl) sl.onclick = () => { st[p.campo] = null; st[p.campo + 'Salto'] = true; G.i++; pintar(); };
      c.querySelector('.gz-mic').onclick = e => escuchar(t => { const n = numeroDicho(t); if(n != null){ i.value = n; pint(); } else showToast('No entendí el número. Escríbalo, por favor.'); }, e.currentTarget);
      p.leer = (cc, s) => { const v = cc.querySelector('input').value; s[p.campo] = v === '' ? '' : Math.max(0, Math.round(Number(v) || 0)); s[p.campo + 'Salto'] = false; };
    },
    producto(c, p, st){
      c.innerHTML = '<div class="gz-fila"><input class="gz-in" type="search" placeholder="Busque por el nombre" autocomplete="off"><button type="button" class="gz-mic" aria-label="Decirlo con la voz">🎤</button></div><div class="gz-prods"></div>';
      const i = c.querySelector('input'), L = c.querySelector('.gz-prods');
      const pint = () => {
        const q = sinT(i.value), ps = ((D() || {}).products || []).filter(x => !x.combo && (!q || sinT(x.name).includes(q))).sort((a, b) => a.name.localeCompare(b.name)).slice(0, 60);
        L.innerHTML = ps.length ? ps.map(x => { const f = x.foto && typeof fotosCache !== 'undefined' && fotosCache[x.id];
          return '<button type="button" class="gz-prod" data-id="' + esc(x.id) + '">' + (f ? '<img src="' + f + '" alt="">' : '<span class="gz-prod-l">' + esc((x.name || '?').charAt(0).toUpperCase()) + '</span>') + '<b>' + esc(x.name) + '</b><small>' + plata(x.price) + (x.stock != null ? ' · quedan ' + x.stock : '') + '</small></button>'; }).join('')
          : '<p class="gz-vacio">No encontré ese producto.' + (p.crear ? ' <button type="button" class="gz-crear">➕ Crearlo</button>' : '') + '</p>';
        const cr = L.querySelector('.gz-crear'); if(cr) cr.onclick = () => iniciar('producto', { nombre: i.value.trim() });
      };
      i.oninput = pint; pint();
      L.onclick = e => { const b = e.target.closest('[data-id]'); if(!b) return; st.prod = b.dataset.id; G.i++; pintar(); };
      c.querySelector('.gz-mic').onclick = e => escuchar(t => { i.value = t; pint(); const ps = L.querySelectorAll('[data-id]'); if(ps.length === 1){ st.prod = ps[0].dataset.id; G.i++; pintar(); } }, e.currentTarget);
    },
    foto(c, p, st){
      c.innerHTML = '<div class="gz-foto-ver"></div><div class="gz-botones"><label class="gz-bgrande">📷 Tomar la foto<input type="file" accept="image/*" capture="environment" hidden></label>' +
        '<label class="gz-bgrande gz-bsec">🖼️ Elegir una foto guardada<input type="file" accept="image/*" hidden></label>' +
        (p.opcional ? '<button type="button" class="gz-saltar">' + esc(p.opcional) + '</button>' : '') + '</div>';
      const ver = c.querySelector('.gz-foto-ver');
      const mostrar = () => { ver.innerHTML = st.foto ? '<img src="' + st.foto + '" alt="Foto del producto"><small>✅ Así quedó. Si no le gusta, tome otra.</small>' : ''; };
      mostrar();
      c.querySelectorAll('input[type=file]').forEach(inp => inp.onchange = async e => {
        const f = e.target.files[0]; e.target.value = ''; if(!f) return;
        ver.innerHTML = '<small>⏳ Arreglando la foto…</small>';
        try{ st.foto = (typeof fotoFondoBlanco === 'function' && typeof fotoLeerImagen === 'function') ? fotoFondoBlanco(await fotoLeerImagen(f)).blanco : await leerComoUrl(f); }
        catch(err){ st.foto = null; showToast('No pude abrir esa foto. Intente con otra.'); }
        mostrar(); if(st.foto) decir('Así quedó la foto. Toque Siguiente para guardarla.');
      });
      const sl = c.querySelector('.gz-saltar'); if(sl) sl.onclick = () => { st.foto = null; G.i++; pintar(); };
    },
    opciones(c, p, st){
      const ops = typeof p.opciones === 'function' ? p.opciones(st) : p.opciones;
      c.innerHTML = '<div class="gz-botones">' + ops.map((o, k) => '<button type="button" class="gz-bgrande' + (o.sec ? ' gz-bsec' : '') + '" data-k="' + k + '">' + esc(o.t) + '</button>').join('') + '</div>';
      c.onclick = e => { const b = e.target.closest('[data-k]'); if(b) ops[+b.dataset.k].fn(st); };
    },
    info(c, p, st){ c.innerHTML = (typeof p.html === 'function' ? p.html(st) : p.html) || ''; if(p.listo) p.listo(c, st); },
    fin(c, p, st){
      const r = G.def.guardar ? G.def.guardar(st) : '';
      st.resumen = r;
      c.innerHTML = '<div class="gz-listo">✅</div><p class="gz-resumen">' + esc(r) + '</p><div class="gz-botones">' +
        (G.def.otra ? '<button type="button" class="gz-bgrande gz-bsec" data-otra="1">' + esc(G.def.otra) + '</button>' : '') + '<button type="button" class="gz-bgrande" data-listo="1">👍 Listo</button></div>';
      const k = G.k;
      c.querySelector('[data-listo]').onclick = cerrar;
      const o = c.querySelector('[data-otra]'); if(o) o.onclick = () => iniciar(k);
      $('gzOv')._dicho = r;
    }
  };
  const leerComoUrl = f => new Promise((ok, mal) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.onerror = mal; fr.readAsDataURL(f); });
  // «veinticuatro», «24», «dos mil quinientos», «tres mil» → número
  function numeroDicho(t){
    t = sinT(t).replace(/[$.]/g, '').replace(/pesos?|unidades?|botellas?|latas?/g, ' ').trim();
    const d = t.match(/\d[\d\s]*/); if(d && !/mil/.test(t)) return Number(d[0].replace(/\s/g, ''));
    try{ if(typeof window.ventoMonto === 'function'){ const n = window.ventoMonto(t); if(n > 0) return n; } }catch(e){}
    const U = { cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20, veintiuno: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90, cien: 100, ciento: 100, doscientos: 200, trescientos: 300, cuatrocientos: 400, quinientos: 500, seiscientos: 600, setecientos: 700, ochocientos: 800, novecientos: 900 };
    let tot = 0, cur = 0, hay = false;
    t.split(/\s+|y/).forEach(w => { if(!w) return; if(w === 'mil'){ tot += (cur || 1) * 1000; cur = 0; hay = true; } else if(U[w] != null){ cur += U[w]; hay = true; } else if(/^\d+$/.test(w)){ cur += Number(w); hay = true; } });
    return hay ? tot + cur : null;
  }
  const prod = st => ((D() || {}).products || []).find(x => x.id === st.prod) || null;
  const dupNombre = n => ((D() || {}).products || []).find(x => !x.combo && (typeof dupKey === 'function' ? dupKey(x) === dupKey({ name: n }) : sinT(x.name) === sinT(n)));
  function movimiento(p, n){
    const d = D(); d.inventarioMov = d.inventarioMov || [];
    d.inventarioMov.push({ id: Date.now().toString() + '-' + p.id, tipo: 'entrada', productId: p.id, name: p.name, qty: n, costo: p.cost || null, unidad: 'und', proveedor: '', fecha: new Date().toISOString().slice(0, 10), usuario: (typeof authUser !== 'undefined' && authUser) || '', at: Date.now(), nota: 'Modo fácil' });
  }
  function ponerFoto(p, url){
    if(!p || !url) return;
    try{ fotosCache[p.id] = url; }catch(e){}
    p.foto = Date.now();
    try{ fotoSet(p.id, url); }catch(e){}
  }

  // ---------- Las guías ----------
  const GUIAS = {
    producto: { titulo: 'Agregar un producto', ico: '🍺', otra: '➕ Agregar otro producto',
      pasos: [
        { tipo: 'texto', campo: 'nombre', ico: '🍺', preg: '¿Cómo se llama el producto?', ayuda: 'Escríbalo o toque 🎤 y dígalo. Por ejemplo: Cerveza Águila.', ej: 'Ej. Cerveza Águila',
          valido: st => { if(!st.nombre) return 'Escriba el nombre del producto, por favor.'; const ya = dupNombre(st.nombre); st.existe = ya ? ya.id : null; return true; } },
        { tipo: 'opciones', si: st => !!st.existe, ico: '🤔', preg: st => 'Ya tiene «' + (((D() || {}).products || []).find(x => x.id === st.existe) || {}).name + '» en sus productos.', ayuda: '¿Qué quiere hacer?',
          opciones: [{ t: '📦 Sumar las que llegaron', fn: st => iniciar('llego', { prod: st.existe }) }, { t: '💲 Cambiarle el precio', fn: st => iniciar('precio', { prod: st.existe }) }, { t: '✏️ Escribir otro nombre', sec: 1, fn: () => { G.i = 0; pintar(); } }] },
        { tipo: 'numero', campo: 'precio', pesos: true, ico: '💲', preg: st => '¿A cuánto vende ' + st.nombre + '?', ayuda: 'El precio para el cliente, en pesos.', ej: 'Ej. 3500', chips: [2000, 3000, 3500, 4000, 5000],
          valido: st => (st.precio > 0) || 'Escriba el precio, por favor.' },
        { tipo: 'numero', campo: 'stock', ico: '📦', preg: '¿Cuántas tiene ahora?', ayuda: 'Así Vento le avisa cuando se estén acabando.', ej: 'Ej. 24', chips: [6, 12, 24, 30, 48], opcional: 'No llevo la cuenta' },
        { tipo: 'foto', ico: '📷', preg: '¿Le tomamos una foto?', ayuda: 'Con foto lo reconoce más fácil al vender. Póngalo sobre una mesa, con buena luz.', opcional: 'Ahora no, sin foto', boton: 'Guardar ➜' },
        { tipo: 'fin', ico: '🎉', preg: '¡Listo!' }
      ],
      guardar(st){
        const d = D(); d.products = d.products || [];
        const p = { id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name: st.nombre.slice(0, 60), price: st.precio, categoryId: null };
        if(st.stock !== '' && st.stock != null && !st.stockSalto) p.stock = st.stock;
        d.products.push(p);
        if(st.foto) ponerFoto(p, st.foto);
        guardar();
        return 'Guardé ' + p.name + ' a ' + plata(p.price) + (p.stock != null ? ', con ' + p.stock + ' unidades' : '') + (st.foto ? ', con su foto' : '') + '. Ya lo puede vender.';
      } },
    llego: { titulo: 'Llegó mercancía', ico: '📦', otra: '📦 Sumar otro producto',
      pasos: [
        { tipo: 'producto', crear: true, ico: '📦', preg: '¿Qué producto le llegó?', ayuda: 'Tóquelo en la lista. Puede buscarlo escribiendo o con 🎤.' },
        { tipo: 'numero', campo: 'n', ico: '🔢', preg: st => '¿Cuántas ' + ((prod(st) || {}).name || '') + ' llegaron?', ayuda: st => { const p = prod(st); return p && p.stock != null ? 'Ahora tiene ' + p.stock + '. Se suman a esas.' : 'Escriba cuántas unidades llegaron.'; }, ej: 'Ej. 24', chips: [6, 12, 24, 30, 48],
          valido: st => (st.n > 0) || 'Escriba cuántas llegaron, por favor.', boton: 'Sumar ➜' },
        { tipo: 'fin' }
      ],
      guardar(st){ const p = prod(st); if(!p) return 'No encontré el producto.'; p.stock = (Number(p.stock) || 0) + st.n; movimiento(p, st.n); guardar(); return 'Sumé ' + st.n + ' a ' + p.name + '. Ahora tiene ' + p.stock + '.'; } },
    foto: { titulo: 'Foto a un producto', ico: '📷', otra: '📷 Otra foto',
      pasos: [
        { tipo: 'producto', ico: '📷', preg: '¿A qué producto le tomamos la foto?', ayuda: 'Tóquelo en la lista.' },
        { tipo: 'foto', ico: '📷', preg: st => 'Tómele la foto a ' + ((prod(st) || {}).name || 'el producto'), ayuda: 'Póngalo sobre una mesa, con buena luz, y que se vea completo.', boton: 'Guardar ➜',
          valido: st => !!st.foto || 'Primero tome la foto.' },
        { tipo: 'fin' }
      ],
      guardar(st){ const p = prod(st); if(!p) return 'No encontré el producto.'; ponerFoto(p, st.foto); guardar(); return 'Listo: ' + p.name + ' ya tiene su foto.'; } },
    precio: { titulo: 'Cambiar un precio', ico: '💲', otra: '💲 Cambiar otro precio',
      pasos: [
        { tipo: 'producto', ico: '💲', preg: '¿A qué producto le cambia el precio?', ayuda: 'Tóquelo en la lista.' },
        { tipo: 'numero', campo: 'precio', pesos: true, ico: '💲', preg: st => '¿Cuál es el precio nuevo de ' + ((prod(st) || {}).name || '') + '?', ayuda: st => 'Ahora está a ' + plata((prod(st) || {}).price) + '.', inicial: st => (prod(st) || {}).price || '',
          valido: st => (st.precio > 0) || 'Escriba el precio, por favor.', boton: 'Guardar ➜' },
        { tipo: 'fin' }
      ],
      guardar(st){ const p = prod(st); if(!p) return 'No encontré el producto.'; const antes = p.price; p.price = st.precio; try{ sincronizarProductoEnMesas(p); }catch(e){} guardar(); return p.name + ' quedó a ' + plata(p.price) + ' (antes ' + plata(antes) + ').'; } },
    factura: { titulo: 'Escanear una factura', ico: '🧾',
      pasos: [
        { tipo: 'info', ico: '🧾', preg: 'Vamos a leer la factura con la cámara', ayuda: 'Vento lee los productos, las cantidades y los precios, y los suma a su inventario.',
          voz: 'Vamos a leer la factura con la cámara. Ponga la factura sobre una mesa, estirada y con buena luz. Toque Tomar la foto. Después revise lo que leyó y toque Aplicar al inventario.',
          html: '<ol class="gz-tips"><li>📄 Ponga la factura <b>estirada sobre una mesa</b>.</li><li>💡 Con <b>buena luz</b>, sin sombra.</li><li>📱 Que se vea <b>toda la hoja</b>.</li></ol>' +
            '<div class="gz-botones"><button type="button" class="gz-bgrande" data-fact="cam">📷 Tomar la foto</button><button type="button" class="gz-bgrande gz-bsec" data-fact="gal">🖼️ Elegir una foto o PDF guardado</button></div>',
          listo(c){ c.onclick = e => { const b = e.target.closest('[data-fact]'); if(!b) return; cerrar(); escanearFactura(b.dataset.fact); }; } }
      ] },
    facturas: { directo(){ verFacturas(); } },
    cuanto: { directo(){
      let r = null; try{ r = window.ventoFacil && window.ventoFacil.hoy(); }catch(e){}
      try{ window.ventoFacil && window.ventoFacil.ir('hoy'); }catch(e){}
      const t = r ? 'Hoy ha vendido ' + plata(r.total) + ' en ' + r.ventas.length + (r.ventas.length === 1 ? ' venta' : ' ventas') + '. En efectivo ' + plata(r.efectivo) + ' y digital ' + plata(r.digital) + '.' : 'Aquí ve cuánto vendió hoy.';
      showToast('📊 ' + t, 7000); decir(t);
    } },
    vender: { directo(){ try{ window.ventoFacil && window.ventoFacil.ir('vender'); }catch(e){} setTimeout(() => tour('vender'), 300); } },
    musica: { directo(){ try{ window.vitoPanel.abrir(); decir('Aquí pone la música. Busque una canción y toque Que siga, o ponga una de sus listas.'); }catch(e){ showToast('La música no está disponible.'); } } }
  };

  // Factura: abre la cámara (o la galería) del lector de facturas y acompaña la revisión con una pista y la voz.
  function escanearFactura(como){
    const inp = como === 'gal' ? $('invoiceGalInput') : $('invoiceCamInput');
    if(!inp){ showToast('El lector de facturas no está disponible.'); return; }
    try{ inp.click(); }catch(e){}
    let n = 0;
    const t = setInterval(() => {
      if(++n > 360){ clearInterval(t); return; }
      const ov = $('invoiceOverlay'); if(!ov || !ov.classList.contains('show') || !document.querySelector('#invoiceBody .iv-item')) return;
      clearInterval(t);
      const m = ov.querySelector('.invoice-modal');
      if(m && !m.querySelector('.gz-pista')){
        const d = document.createElement('div'); d.className = 'gz-pista';
        d.innerHTML = '👉 <b>Revise los productos.</b> Si algo está mal, tóquelo y corríjalo. Al final toque <b>«Aplicar al inventario»</b> (abajo). <button type="button" class="gz-pista-x" aria-label="Cerrar">✕</button>';
        m.insertBefore(d, m.children[1] || null);
        d.querySelector('.gz-pista-x').onclick = () => d.remove();
      }
      decir('Ya leí la factura. Revise los productos. Si algo está mal, tóquelo y corríjalo. Al final toque Aplicar al inventario, abajo.');
      const ap = $('invoiceApplyBtn');
      if(ap && !ap._gz){ ap._gz = true; ap.addEventListener('click', () => setTimeout(() => { if(!$('invoiceOverlay').classList.contains('show')) decir('Listo. La factura quedó guardada y los productos se sumaron a su inventario.'); }, 1200)); }
    }, 500);
  }
  function verFacturas(){
    if(typeof window.fiAbrirHistorialFacturas !== 'function'){ showToast('Las facturas no están disponibles.'); return; }
    window.fiAbrirHistorialFacturas();
    const n = ((D() || {}).purchases || []).length;
    setTimeout(() => {
      const c = document.querySelector('#fiHistOv .fi-hist-c');
      if(c && !c.querySelector('.gz-pista')){ const d = document.createElement('div'); d.className = 'gz-pista'; d.innerHTML = n ? '👉 <b>Toque una factura</b> para verla. Ahí la puede <b>descargar</b>.' : '👉 Todavía no hay facturas. Escanee una en <b>Más → Escanear una factura</b>.'; c.insertBefore(d, c.firstChild); }
    }, 80);
    decir(n ? 'Aquí están sus facturas. Toque una para verla. Ahí la puede descargar.' : 'Todavía no tiene facturas guardadas. Para guardar una, toque Escanear una factura.');
  }

  // ---------- 🙋 Ayúdame: «dígame qué necesita» ----------
  const RUTAS = [
    [/(agreg|crear|crea|meter|nuev|registr|anot).*(producto|cerveza|gaseosa|trago|comida|bebida|licor|aguardiente|art[ií]culo)|producto nuevo/, 'producto'],
    [/(lleg|sum|entr|trajeron|recib|compr).*(mercanc|pedido|cerveza|unidad|caja|producto|canasta)|llegaron|llego (el|la|un)|me trajeron|inventario/, 'llego'],
    [/foto|imagen|retrato/, 'foto'],
    [/precio|cuesta|vale|subir|bajar|cobrar m[aá]s|cambiar.*valor/, 'precio'],
    [/(escane|tomar|leer|subir|meter|pasar).*(factura|recibo|cuenta de cobro)|foto.*factura/, 'factura'],
    [/(ver|mirar|buscar|descargar|encontrar|d[oó]nde).*(factura)|mis facturas|facturas (guardadas|viejas|anteriores)/, 'facturas'],
    [/(cu[aá]nto|qu[eé]).*(vend|gan|hice|llevo)|ventas de hoy|plata de hoy|caja de hoy/, 'cuanto'],
    [/(c[oó]mo|quiero|ayuda).*(vend|cobr|anot.*pedido|mesa)|vender|cobrar/, 'vender'],
    [/m[uú]sica|canci[oó]n|youtube|playlist|lista de reproducci/, 'musica']
  ];
  // Las facturas van antes que las fotos (si no, «tomarle foto a la factura» sería una foto de producto).
  const ORDEN = ['factura', 'facturas', 'producto', 'llego', 'precio', 'foto', 'cuanto', 'vender', 'musica'];
  function ruta(texto){
    const t = sinT(texto);
    for(const k of ORDEN){ const r = RUTAS.find(x => x[1] === k); if(r && r[0].test(t)) return k; }
    return null;
  }
  const NOMBRES = { producto: '🍺 Agregar un producto', llego: '📦 Llegó mercancía', foto: '📷 Foto a un producto', precio: '💲 Cambiar un precio', factura: '🧾 Escanear una factura', facturas: '📚 Mis facturas', cuanto: '📊 ¿Cuánto vendí hoy?', vender: '🛒 ¿Cómo vendo?', musica: '🎵 Música' };
  function ayudame(){
    cerrar();
    const ov = ventana(); ov.classList.add('show');
    G = { k: 'ayuda', def: { titulo: 'Ayúdame', pasos: [{ tipo: 'info' }] }, i: 0, st: {} };
    ov.querySelector('.gz-paso').textContent = 'Ayúdame';
    ov.querySelector('.gz-ico').textContent = '🙋';
    ov.querySelector('.gz-preg').textContent = '¿En qué le ayudo?';
    const ay = ov.querySelector('.gz-ayuda'); ay.hidden = false; ay.textContent = 'Toque el micrófono y dígame qué necesita. O toque una de las opciones.';
    ov.querySelector('.gz-sig').hidden = true;
    ov.querySelector('.gz-atras').style.visibility = 'hidden';
    const c = ov.querySelector('.gz-campo'); c.className = 'gz-campo gz-ayudame';
    c.innerHTML = '<button type="button" class="gz-mic-grande">🎤 Toque y dígame qué necesita</button>' +
      '<form class="gz-fila gz-pregunta"><input class="gz-in" type="text" placeholder="O escríbalo aquí…" autocomplete="off"><button type="submit" class="gz-mic">➜</button></form>' +
      '<div class="gz-respuesta" hidden></div>' +
      '<div class="gz-ops">' + Object.keys(NOMBRES).map(k => '<button type="button" data-g="' + k + '">' + NOMBRES[k] + '</button>').join('') + '</div>' +
      '<div class="gz-ajustes"><button type="button" data-a="tour">▶ Ver otra vez cómo funciona</button>' +
      '<button type="button" data-a="voz">' + (vozOn() ? '🔊 Vento me habla: SÍ' : '🔇 Vento me habla: NO') + '</button>' +
      '<button type="button" data-a="grande">' + (ls(GRANDE_K) === '1' ? '🔠 Letra grande: SÍ' : '🔠 Letra más grande') + '</button>' +
      '<button type="button" data-a="wa">💬 Hablar con una persona (WhatsApp)</button></div>';
    ov._dicho = '¿En qué le ayudo? Toque el micrófono y dígame qué necesita. O toque una de las opciones.';
    decir(ov._dicho);
    const resp = c.querySelector('.gz-respuesta');
    const atender = async texto => {
      texto = String(texto || '').trim(); if(!texto) return;
      const k = ruta(texto);
      if(k){ resp.hidden = false; resp.innerHTML = '<b>«' + esc(texto) + '»</b><br>Le explico paso a paso: ' + esc(NOMBRES[k]); setTimeout(() => iniciar(k), 700); return; }
      resp.hidden = false; resp.innerHTML = '<b>«' + esc(texto) + '»</b><br>⏳ Pensando…';
      const r = await responder(texto);
      resp.innerHTML = '<b>«' + esc(texto) + '»</b><p>' + esc(r) + '</p>';
      decir(r);
    };
    c.querySelector('.gz-mic-grande').onclick = e => escuchar(atender, e.currentTarget);
    c.querySelector('.gz-pregunta').onsubmit = e => { e.preventDefault(); const i = e.target.querySelector('input'); atender(i.value); i.value = ''; };
    c.querySelector('.gz-ops').onclick = e => { const b = e.target.closest('[data-g]'); if(b) iniciar(b.dataset.g); };
    c.querySelector('.gz-ajustes').onclick = e => {
      const b = e.target.closest('[data-a]'); if(!b) return;
      const a = b.dataset.a;
      if(a === 'tour'){ cerrar(); tour('inicio', true); }
      else if(a === 'voz'){ ls(VOZ_K, vozOn() ? '0' : '1'); b.textContent = vozOn() ? '🔊 Vento me habla: SÍ' : '🔇 Vento me habla: NO'; if(vozOn()) decir('Listo, le voy a hablar.'); }
      else if(a === 'grande'){ const on = ls(GRANDE_K) !== '1'; ls(GRANDE_K, on ? '1' : '0'); aplicarGrande(); b.textContent = on ? '🔠 Letra grande: SÍ' : '🔠 Letra más grande'; }
      else if(a === 'wa'){ let n = '573000000000'; try{ if(typeof ventoWa === 'function') n = ventoWa(); }catch(x){} window.open('https://wa.me/' + encodeURIComponent(n) + '?text=' + encodeURIComponent('Hola, necesito ayuda con Vento.'), '_blank'); }
    };
  }
  // Pregunta libre: primero lo que Vento ya sabe con los datos del negocio; si no, la IA (si está conectada) explica
  // cómo hacerlo en el modo fácil, en palabras sencillas.
  async function responder(texto){
    try{ const ly = window.Laya && window.Laya.responder(texto); if(ly && ly.text) return String(ly.text).replace(/[•🧠📦🧾🛒🧮💰🆕🚫⚠️📈📉🏭🛎️🍳🎵✅🔎🔗⏭▶🗑]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 400); }catch(e){}
    try{
      if(typeof hasAIKey === 'function' && hasAIKey() && typeof aiText === 'function'){
        const prompt = 'Eres Vento, una app para manejar bares y tiendas, y le explicas a una persona MAYOR, con mucha paciencia, cómo hacer algo en el MODO FÁCIL. ' +
          'La pantalla del modo fácil tiene abajo 3 botones grandes: «Vender» (se toca la ' + esp() + ', se tocan los productos que pidieron y al final el botón COBRAR), «Hoy» (cuánto vendió hoy) y «Más». ' +
          'En «Más» hay tarjetas: Agregar un producto, Llegó mercancía, Foto a un producto, Cambiar un precio, Escanear una factura, Mis facturas, Música, Libreta (quién debe), Mis productos. ' +
          'Arriba siempre está el botón amarillo «Ayúdame». ' +
          'Responde en español de Colombia, de usted, en máximo 3 pasos numerados muy cortos (máximo 60 palabras en total), sin emojis ni palabras técnicas. ' +
          'Si la pregunta no tiene que ver con la app, contesta amable y breve. Pregunta: «' + texto.slice(0, 300) + '»';
        const r = await aiText({ prompt, timeoutMs: 15000, retries: 1 });
        if(r && String(r).trim()) return String(r).trim().slice(0, 600);
      }
    }catch(e){}
    return 'No le entendí bien. Toque una de las opciones de abajo, o toque «Hablar con una persona».';
  }
  function aplicarGrande(){ document.body.classList.toggle('gz-grande', ls(GRANDE_K) === '1'); }

  // ---------- Recorrido con señalador (la primera vez) ----------
  const TOURS = {
    inicio: [
      { t: '¡Hola! Soy Vento. 👋', d: 'Le voy a mostrar cómo funciona. Es muy fácil. Toque «Siguiente».' },
      { sel: '#facilApp .fz-mesas .fz-mesa, #facilApp .pz-grid .pz-tile, #facilApp .fz-mesas', t: 'Aquí vende', d: () => 'Toque una ' + esp() + ' y luego los productos que le piden. Cada toque suma uno.', antes: () => window.ventoFacil && window.ventoFacil.ir('vender') },
      { sel: '#facilApp [data-fz="hoy"]', t: 'Hoy', d: 'Aquí ve cuánto vendió hoy, en efectivo y digital.' },
      { sel: '#facilApp [data-fz="mas"]', t: 'Más', d: 'Aquí agrega productos, les toma fotos, escanea facturas y pone música.' },
      { sel: '#facilApp .fz-ayuda', t: 'Ayúdame', d: 'Si se pierde, toque este botón amarillo y dígame qué necesita. Yo le explico paso a paso.' },
      { t: '¡Eso es todo! 🎉', d: 'Cuando quiera ver esto otra vez: Ayúdame → Ver otra vez cómo funciona.' }
    ],
    vender: [
      { sel: '#facilApp .fz-mesas .fz-mesa, #facilApp .fz-mesas', t: () => 'Toque la ' + esp(), d: () => 'Toque la ' + esp() + ' del cliente. Las amarillas ya tienen algo anotado.', esperar: '#facilApp .pz-grid' },
      { sel: '#facilApp .pz-grid .pz-tile', t: 'Toque los productos', d: 'Cada toque suma uno. Si se equivoca, toque el menos para quitarlo.' },
      { sel: '#facilApp .pz-cobrar', t: 'COBRAR', d: 'Cuando le paguen, toque COBRAR y escoja cómo le pagaron.' }
    ]
  };
  let TT = null;
  function tour(nombre, forzar){
    nombre = nombre || 'inicio';
    if(nombre === 'inicio' && !forzar && tourVisto()) return;
    cerrarTour(); cerrar();
    TT = { pasos: TOURS[nombre] || [], i: 0, nombre };
    const ov = document.createElement('div'); ov.id = 'gzTour'; ov.className = 'gz-tour'; ov.setAttribute('data-novocab', '');
    ov.innerHTML = '<div class="gz-hueco"></div><div class="gz-globo" role="dialog" aria-live="polite"><b class="gz-gt"></b><p class="gz-gd"></p><div class="gz-gb"><button type="button" class="gz-gsaltar">Saltar</button><button type="button" class="gz-gsig">Siguiente ➜</button></div></div>';
    document.body.appendChild(ov);
    ov.querySelector('.gz-gsaltar').onclick = () => terminarTour();
    ov.querySelector('.gz-gsig').onclick = () => { TT.i++; pasoTour(); };
    ov._fin = () => terminarTour();
    pasoTour();
  }
  function pasoTour(){
    const ov = $('gzTour'); if(!ov || !TT) return;
    const p = TT.pasos[TT.i];
    if(!p){ terminarTour(); return; }
    if(p.antes) try{ p.antes(); }catch(e){}
    setTimeout(() => {
      const el = p.sel ? document.querySelector(p.sel) : null;
      if(p.sel && !el){ TT.i++; pasoTour(); return; }      // ese botón no está en esta pantalla: se salta
      const h = ov.querySelector('.gz-hueco'), g = ov.querySelector('.gz-globo');
      const T = typeof p.t === 'function' ? p.t() : p.t, Dd = typeof p.d === 'function' ? p.d() : p.d;
      ov.querySelector('.gz-gt').textContent = T; ov.querySelector('.gz-gd').textContent = Dd;
      ov.querySelector('.gz-gsig').textContent = TT.i >= TT.pasos.length - 1 ? '👍 Entendido' : 'Siguiente ➜';
      if(el){
        try{ el.scrollIntoView({ block: 'nearest' }); }catch(e){}
        const r = el.getBoundingClientRect(), m = 8;
        Object.assign(h.style, { display: 'block', left: (r.left - m) + 'px', top: (r.top - m) + 'px', width: (r.width + 2 * m) + 'px', height: (r.height + 2 * m) + 'px' });
        ov.classList.remove('gz-sin');
        const abajo = r.bottom + 16 + 190 < innerHeight;
        Object.assign(g.style, abajo ? { top: (r.bottom + 16) + 'px', bottom: '' } : { top: '', bottom: (innerHeight - r.top + 16) + 'px' });
      } else { h.style.display = 'none'; ov.classList.add('gz-sin'); Object.assign(g.style, { top: '', bottom: '' }); }
      decir(T.replace(/[^\p{L}\p{N}¡!¿? ,.]/gu, '') + '. ' + Dd);
      // Si el paso pide tocar algo (ej. la mesa), al tocarlo sigue solo.
      // En los pasos que piden tocar algo, la capa deja pasar el toque (solo el globo recibe toques).
      ov.classList.toggle('gz-pasa', !!(el && p.esperar));
      if(el && p.esperar){ el.addEventListener('click', () => setTimeout(() => { if(TT && TT.pasos[TT.i] === p){ TT.i++; pasoTour(); } }, 350), { once: true }); }
    }, 160);
  }
  function cerrarTour(){ const ov = $('gzTour'); if(ov) ov.remove(); }
  function terminarTour(){ const n = TT && TT.nombre; TT = null; cerrarTour(); if(n === 'inicio') ls(TOUR_K, '1'); try{ if(window.speechSynthesis) speechSynthesis.cancel(); }catch(e){} }
  function tourVisto(){ return ls(TOUR_K) === '1'; }
  // El hueco del recorrido deja tocar lo que señala (para «Toque la mesa»).
  document.addEventListener('click', e => {
    const ov = $('gzTour'); if(!ov || !TT) return;
    if(e.target.closest('.gz-globo')) return;
    const p = TT.pasos[TT.i], el = p && p.sel && document.querySelector(p.sel);
    if(el && p.esperar && el.contains(e.target)) return;
    if(e.target.closest('#gzTour')){ e.stopPropagation(); e.preventDefault(); }
  }, true);
  window.addEventListener('resize', () => { if(TT) pasoTour(); });

  // ---------- Estilos (letra grande, alto contraste, botones de 64 px o más) ----------
  const css = document.createElement('style');
  css.textContent =
    '.overlay.gz{position:fixed;inset:0;z-index:80;display:none;flex-direction:column;align-items:stretch;justify-content:flex-start;padding:0;background:var(--bg);color:var(--ink);font-family:var(--font-main);backdrop-filter:none}.overlay.gz.show{display:flex}.overlay.gz > *{zoom:1}' +
    '.gz-top{display:flex;align-items:center;gap:10px;padding:calc(10px + env(safe-area-inset-top)) 12px 10px;border-bottom:1px solid var(--line);background:var(--surface)}' +
    '.gz-top button{min-height:56px;padding:0 16px;border-radius:16px;border:2px solid var(--line);background:transparent;color:var(--ink);font:inherit;font-size:19px;font-weight:900;cursor:pointer}' +
    '.gz-paso{flex:1;min-width:0;text-align:center;font-size:15px;font-weight:800;color:var(--ink-soft)}' +
    '.gz-cuerpo{flex:1;min-height:0;overflow-y:auto;padding:18px 18px 24px;max-width:760px;width:100%;margin:0 auto;box-sizing:border-box}' +
    '.gz-ico{font-size:64px;line-height:1;text-align:center;margin:4px 0 8px}' +
    '.gz-preg{font-size:clamp(25px,7vw,34px);font-weight:900;line-height:1.2;text-align:center;margin:0 0 8px}' +
    '.gz-ayuda{font-size:clamp(18px,5vw,22px);line-height:1.4;text-align:center;color:var(--ink-soft);margin:0 0 18px}' +
    '.gz-fila{display:flex;gap:10px;align-items:stretch}' +
    '.gz-in{flex:1;min-width:0;min-height:68px;padding:10px 16px;font:inherit;font-size:26px;font-weight:800;border-radius:18px;border:3px solid var(--amber);background:var(--surface);color:var(--ink);box-sizing:border-box}' +
    '.gz-num{text-align:center;font-size:34px}.gz-signo{align-self:center;font-size:34px;font-weight:900}' +
    '.gz-mic,.gz-menos,.gz-mas{flex:0 0 auto;min-width:68px;min-height:68px;border-radius:18px;border:3px solid var(--line);background:var(--surface);color:var(--ink);font:inherit;font-size:30px;font-weight:900;cursor:pointer}' +
    '.gz-mic-ancho{width:100%;margin-top:14px;font-size:20px}.gz-oyendo{border-color:#ef4444!important;background:#ef444422!important}' +
    '.gz-ver{text-align:center;font-size:24px;font-weight:900;color:var(--amber);min-height:32px;margin:10px 0 2px}' +
    '.gz-chips{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin-top:10px}.gz-chips button{min-height:60px;min-width:84px;padding:0 16px;border-radius:999px;border:2px solid var(--line);background:var(--surface);color:var(--ink);font:inherit;font-size:21px;font-weight:900;cursor:pointer}' +
    '.gz-saltar{display:block;width:100%;min-height:60px;margin-top:14px;border-radius:16px;border:2px dashed var(--line);background:transparent;color:var(--ink-soft);font:inherit;font-size:19px;font-weight:800;cursor:pointer}' +
    '.gz-prods{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(150px,46%),1fr));gap:12px;margin-top:14px}' +
    '.gz-prod{min-height:150px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:10px;border-radius:20px;border:2px solid var(--line);background:var(--surface);color:var(--ink);font:inherit;cursor:pointer;text-align:center}' +
    '.gz-prod img{width:76px;height:76px;object-fit:cover;border-radius:14px;background:#fff}.gz-prod-l{width:76px;height:76px;display:grid;place-items:center;border-radius:14px;background:var(--surface-2);font-size:38px;font-weight:900}' +
    '.gz-prod b{font-size:19px;line-height:1.2}.gz-prod small{font-size:15px;color:var(--ink-soft)}.gz-vacio{text-align:center;font-size:19px;color:var(--ink-soft)}' +
    '.gz-crear{margin-top:10px;min-height:56px;padding:0 16px;border-radius:14px;border:2px solid var(--amber);background:transparent;color:var(--ink);font:inherit;font-size:18px;font-weight:900;cursor:pointer}' +
    '.gz-botones{display:flex;flex-direction:column;gap:12px}' +
    '.gz-bgrande{display:flex;align-items:center;justify-content:center;min-height:72px;padding:10px 18px;border-radius:20px;border:3px solid var(--amber);background:var(--amber);color:#1a1200;font:inherit;font-size:22px;font-weight:900;cursor:pointer;text-align:center}' +
    '.gz-bsec{background:var(--surface);color:var(--ink);border-color:var(--line)}' +
    '.gz-foto-ver{text-align:center;margin-bottom:12px}.gz-foto-ver img{width:min(240px,70vw);aspect-ratio:1;object-fit:cover;border-radius:20px;background:#fff;display:block;margin:0 auto 6px}.gz-foto-ver small{font-size:17px}' +
    '.gz-listo{font-size:84px;text-align:center}.gz-resumen{font-size:23px;font-weight:800;line-height:1.4;text-align:center;margin:0 0 20px}' +
    '.gz-tips{font-size:21px;line-height:1.6;margin:0 0 18px;padding-left:28px}' +
    '.gz-pie{display:flex;gap:10px;padding:10px 12px calc(10px + env(safe-area-inset-bottom));border-top:1px solid var(--line);background:var(--surface)}' +
    '.gz-pie button{min-height:68px;border-radius:18px;font:inherit;font-size:21px;font-weight:900;cursor:pointer}' +
    '.gz-oir{flex:0 0 auto;padding:0 16px;border:2px solid var(--line);background:transparent;color:var(--ink)}.gz-sig{flex:1;border:3px solid #16a34a;background:#16a34a;color:#fff}.gz-sig[hidden]{display:none}' +
    '.gz-mic-grande{display:block;width:100%;min-height:110px;border-radius:24px;border:3px solid #ef4444;background:#ef444418;color:var(--ink);font:inherit;font-size:24px;font-weight:900;cursor:pointer;margin-bottom:12px}' +
    '.gz-pregunta .gz-in{font-size:20px;min-height:60px}.gz-pregunta .gz-mic{min-height:60px;font-size:24px}' +
    '.gz-respuesta{margin:14px 0;padding:14px 16px;border-radius:18px;background:color-mix(in srgb,var(--amber) 14%,var(--surface));font-size:20px;line-height:1.45}.gz-respuesta p{margin:8px 0 0;white-space:pre-line}' +
    '.gz-ops{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(220px,100%),1fr));gap:10px;margin-top:16px}' +
    '.gz-ops button,.gz-ajustes button{min-height:64px;padding:8px 14px;border-radius:18px;border:2px solid var(--line);background:var(--surface);color:var(--ink);font:inherit;font-size:19px;font-weight:900;text-align:left;cursor:pointer}' +
    '.gz-ajustes{display:flex;flex-direction:column;gap:10px;margin-top:22px;padding-top:16px;border-top:1px dashed var(--line)}' +
    '.gz-pista{position:relative;margin:8px 0 10px;padding:12px 44px 12px 14px;border-radius:14px;border:2px solid #fbbf24;background:#fbbf2422;font-size:17px;line-height:1.4}.gz-pista-x{position:absolute;right:6px;top:6px;width:32px;height:32px;border-radius:50%;border:0;background:transparent;color:inherit;font-size:16px;cursor:pointer}' +
    '.gz-tour{position:fixed;inset:0;z-index:90}' +
    '.gz-hueco{position:fixed;border-radius:20px;box-shadow:0 0 0 9999px rgba(0,0,0,.74);border:4px solid #fbbf24;pointer-events:none;transition:all .25s ease}' +
    '.gz-tour.gz-sin{background:rgba(0,0,0,.74)}.gz-tour.gz-pasa{pointer-events:none}.gz-tour.gz-pasa .gz-globo{pointer-events:auto}' +
    '.gz-globo{position:fixed;left:50%;transform:translateX(-50%);width:min(440px,calc(100vw - 24px));box-sizing:border-box;padding:18px;border-radius:22px;background:#fff;color:#111;box-shadow:0 12px 40px rgba(0,0,0,.5)}' +
    '.gz-tour.gz-sin .gz-globo{top:50%;transform:translate(-50%,-50%)}' +
    '.gz-gt{display:block;font-size:26px;font-weight:900;margin-bottom:6px}.gz-gd{font-size:20px;line-height:1.45;margin:0 0 14px}' +
    '.gz-gb{display:flex;gap:10px}.gz-gb button{min-height:60px;border-radius:16px;font:inherit;font-size:19px;font-weight:900;cursor:pointer}.gz-gsaltar{padding:0 14px;border:2px solid #ccc;background:#fff;color:#333}.gz-gsig{flex:1;border:0;background:#16a34a;color:#fff}' +
    'body.gz-grande #facilApp{zoom:1.15}body.gz-grande .gz{zoom:1.12}' +
    /* Más fuerte que las reglas generales de botones de la app (que los dejaban en 48 px). */
    '.overlay.gz .gz-top button{min-height:60px;height:auto}.overlay.gz .gz-pie button{min-height:68px;height:auto}';
  document.head.appendChild(css);
  aplicarGrande();

  window.ventoGuia = { iniciar, ayudame, tour, tourVisto, cerrar, ruta, numeroDicho, activa: () => !!G };
})();
