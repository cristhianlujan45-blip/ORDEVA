/* ORDEVA · app/04b-mesas-voz-cocina.js — parte 2 de 8 de app/04-principal.js (antes dentro de index.html). Se carga en el mismo lugar y orden. */
/* ---------- Confirmación de seguridad al quitar una mesa con cuenta activa ---------- */
let pendingTableRemoval = null; // { tableId, at }
const PENDING_REMOVAL_TIMEOUT_MS = 20000;

function isConfirmVoiceCommand(rawText){
  const t = normVoiceText(rawText);
  // Un «sí» solo también confirma (solo se pregunta cuando hay una mesa esperando confirmación).
  return /\b(confirmar|confirmo|confirma|si quitar|si eliminar|si borrar|si estoy segur|si seguro|si segura|quitala igual|quitala de todas formas|hazlo|adelante|de una)\b/.test(t) || /^(si|sii|claro|dale|ok|okey|listo|correcto|exacto|quitala)( (si|senor|senora|claro|por favor|de una|quitala))*$/.test(t);
}
function isCancelVoiceCommand(rawText){
  const t = normVoiceText(rawText);
  return /\b(cancelar|cancela|cancelo|no quitar|no la quites|mejor no|olvidalo|olvidelo|deja asi|dejala asi)\b/.test(t) || /^no( (no|senor|senora|gracias|todavia))*$/.test(t);
}

function doRemoveTable(target){
  try{ closeTableToHistory(target); }catch(e){}         // si tenía cuenta, queda en el historial (lo no pagado, como deuda)
  delete data.tables[target];
  const ids = Object.keys(data.tables).map(Number);
  data.tableCount = ids.length ? Math.max(...ids) : 0;
  saveData(); renderMesas();
  const msg = 'Quité la Mesa ' + target + '.';
  showToast('➖ ' + msg); speakVoice(msg);
}

// ---- Ayuda: lista de comandos de voz ("comandos", "ayuda", "qué puedo decir") ----
function isVoiceHelpCommand(rawText){
  const t = normVoiceText(rawText);
  return /^(comandos?|ayuda|lista de comandos|que (comandos|puedo decir|te puedo decir)|cuales son (los )?comandos|que comandos hay|como te hablo)\b/.test(t);
}
const VOICE_AYUDA = [
  ['Rápido (lo más corto)', ['la 3, dos águilas', '3 dos águilas', 'regáleme una coca para la 5', 'otra la 3 (otra ronda igual)', 'cobra la 3', 'la 3 pagó', 'menos una águila la 3', 'borra lo último']],
  ['Pedidos', ['mesa 1, cinco águilas', 'dos póker y una Heineken para la mesa 3', 'agregar Heineken mesa 5', 'misma ronda para la mesa 2']],
  ['Crear mesas', ['agrégame una mesa que se llame Juan', 'agrégame mesa nueva Lucas', 'agrégame una mesa a nombre de Juan y agrégale dos cervezas y una póker', 'crea la mesa Carolina con tres Club Colombia', 'nueva mesa para don Pedro', 'ábreme una cuenta a nombre de Ana', 'quiero una mesa llamada María José', 'agrega una mesa', 'agrega hasta la mesa 10']],
  ['Nombre de la mesa', ['cámbiale el nombre a la mesa 3 por Pedro', 'la mesa 2 se llama Martín', 'ponle Carolina a la mesa 4', 'renombra la mesa 1 como Lucía', 'quítale el nombre a la mesa 2']],
  ['Cambiar de mesa', ['pasa la mesa 3 a la 5', 'junta la mesa 1 con la 4 (se juntan las cuentas)', 'cambia la mesa Juan a la 2']],
  ['Corregir', ['quita una póker de la mesa 2', 'la mesa 4 son tres águilas (corrige la cantidad)', 'deshacer', 'borra el pedido anterior', 'deshaz el último pedido', 'quitar mesa 3']],
  ['Personas y abonos', ['agrega a Juan a la mesa 4', 'pon a María en la mesa 2', 'la mesa 3 abona 20 mil', 'Juan paga 10 mil de la mesa 2 por Nequi', 'cobra la mesa 3']],
  ['Inventario y preguntas', ['cuántas Póker quedan', 'cuánto hay de Águila', 'cuánto vendí hoy', 'qué mesas están abiertas', 'siguiente canción', 'pon la canción Despacito']],
  ['Libreta (lista negra)', ['agrégame a la lista negra 30 mil para Julián', 'agrégame a la lista que Julián quedó debiendo 30 mil', 'Julián quedó de pagar 20 mil', 'cárgale a Julián 12 mil', 'fíale 10 mil a Ana', 'Julián pagó 10 mil', 'bórrale 5 mil a Julián', 'saca a Julián de la lista negra (pagó todo)', '¿quién me debe?']],
  ['Recordar', ['recuérdame el pedido (el último, por voz o a mano)', 'recuérdame el pedido de la mesa 2', 'qué lleva la mesa 3']],
  ['Cuentas', ['cuenta de la mesa 2', 'cuánto debe la 4', 'total de todas las mesas', 'cuánto llevo vendido']],
  ['Abrir', ['mesa 4 (abre esa mesa)', 'mesa Juan']]
];
function voiceAyuda(){
  let ov = document.getElementById('voiceHelpOverlay');
  if(!ov){
    ov = document.createElement('div'); ov.id = 'voiceHelpOverlay'; ov.className = 'overlay';
    ov.innerHTML = '<div class="modal" style="max-width:440px;max-height:88vh;overflow:auto"><h2>🎤 Comandos de voz</h2>' +
      '<div class="modal-sub">Toca el micrófono y di, por ejemplo:</div><div class="vh-list">' +
      VOICE_AYUDA.map(([g, xs]) => '<div><h3>' + g + '</h3>' + xs.map(x => '<div><q>' + x.replace(/ \(.*\)$/, '') + '</q>' + (/\(.*\)$/.test(x) ? ' <small>' + x.match(/\((.*)\)$/)[1] + '</small>' : '') + '</div>').join('') + '</div>').join('') +
      '</div><div class="modal-sub" style="margin-top:12px">El micrófono usa la voz clásica (sin internet). Para dictar con tus palabras usa el botón «IA» (actívalo en Ajustes → Voz).</div>' +
      '<div class="modal-actions"><button class="btn-primary" type="button" id="voiceHelpOk">Entendido</button></div></div>';
    document.body.appendChild(ov);
    ov.querySelector('#voiceHelpOk').onclick = () => ov.classList.remove('show');
    ov.addEventListener('click', e => { if(e.target === ov) ov.classList.remove('show'); });
  }
  ov.classList.add('show');
  speakVoice('Estos son los comandos de voz.');
}

/* ---------- Cambiar de mesa ----------
   Pasa toda la cuenta (o solo algunos productos) de una mesa a otra: libre, ocupada (se juntan
   las cuentas) o una mesa nueva. Se mueven también las personas, los abonos y el nombre de la
   mesa. No toca el inventario (los productos ya estaban vendidos). Se puede deshacer. */
function moverMesa(origen, destino, lineas){
  const o = data.tables[origen];
  if(!o || !(o.items || []).length) return { error: 'La ' + tableLabel(origen) + ' no tiene nada para pasar.' };
  if(origen === destino) return { error: 'Es la misma mesa.' };
  if(!data.tables[destino]){
    data.tables[destino] = { items: [], people: [] };
    data.tableCount = Math.max(data.tableCount || 0, destino);
  }
  const d = data.tables[destino];
  d.items = d.items || []; d.people = d.people || []; d.payments = d.payments || [];
  const estabaOcupada = d.items.length > 0;
  const lblO = tableLabel(origen), lblD = tableLabel(destino);   // nombres antes de mover (el nombre viaja con la cuenta)
  // Para "deshacer": copia de las dos mesas como estaban.
  voiceUndoStack.push({ mov: true, tableId: destino, tablas: [{ id: origen, t: JSON.parse(JSON.stringify(o)) }, { id: destino, t: JSON.parse(JSON.stringify(d)) }] });
  if(voiceUndoStack.length > 15) voiceUndoStack.shift();
  // Personas: se reutiliza la de igual nombre en la mesa destino; si no, se copia con id nuevo.
  const mapaPersonas = {};
  const personaDestino = pid => {
    if(pid == null) return null;
    if(mapaPersonas[pid] !== undefined) return mapaPersonas[pid];
    const p = (o.people || []).find(x => x.id === pid);
    if(!p){ mapaPersonas[pid] = null; return null; }
    const igual = d.people.find(x => String(x.name).trim().toLowerCase() === String(p.name).trim().toLowerCase());
    if(igual){ mapaPersonas[pid] = igual.id; return igual.id; }
    const nueva = Object.assign({}, p, { id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5) });
    d.people.push(nueva); mapaPersonas[pid] = nueva.id; return nueva.id;
  };
  const agregar = (it, qty) => {
    const pid = personaDestino(it.personId);
    const ex = d.items.find(x => x.productId && x.productId === it.productId && (x.personId || null) === pid && x.price === it.price);
    if(ex){ ex.qty += qty; ex.history = (ex.history || []).concat(it.history || []).slice(-30); }
    else d.items.push(Object.assign({}, it, { qty, personId: pid, history: (it.history || []).slice() }));
  };
  let movidas = 0;
  const todo = !lineas;
  if(todo){
    o.items.forEach(it => { agregar(it, it.qty); movidas += it.qty; });
    o.items = [];
    (o.payments || []).forEach(p => d.payments.push(Object.assign({}, p, { personId: p.personId != null ? personaDestino(p.personId) : p.personId })));
    o.payments = []; o.people = [];
    if(!estabaOcupada && o.name && !d.name){ d.name = o.name; o.name = null; }
    if(o.ultimaRonda && !d.ultimaRonda) d.ultimaRonda = o.ultimaRonda;
    delete o.ultimaRonda;
  } else {
    Object.keys(lineas).map(Number).sort((a, b) => b - a).forEach(i => {
      const it = o.items[i], n = Math.min(lineas[i], it ? it.qty : 0);
      if(!it || !(n > 0)) return;
      agregar(it, n); movidas += n;
      if(n >= it.qty) o.items.splice(i, 1); else it.qty -= n;
    });
    // Personas que se quedaron sin productos en la mesa de origen: se quitan de ahí.
    o.people = (o.people || []).filter(p => o.items.some(it => it.personId === p.id) || (o.payments || []).some(x => x.personId === p.id));
  }
  saveData();
  try{ renderMesas(); }catch(e){}
  if(todo && estabaOcupada) try{ window.registrarUnificacion && window.registrarUnificacion({ juntada: true, lblO, lblD, destino }); }catch(e){}
  return { movidas, todo, juntada: estabaOcupada, origen, destino, lblO, lblD };
}
function movMensaje(r){
  return (r.todo ? 'Pasé la cuenta de ' : 'Pasé ' + r.movidas + (r.movidas === 1 ? ' producto' : ' productos') + ' de ') + r.lblO + (r.juntada ? ' y la junté con ' : ' a ') + r.lblD + '.';
}
// Resuelve "3", "tres", "Juan" o "la mesa de Juan" a un número de mesa.
function movMesaDe(txt){
  const w = String(txt || '').trim();
  if(!w) return null;
  if(/^\d+$/.test(w)) return parseInt(w, 10);
  if(NUM_WORDS_VOICE[w]) return NUM_WORDS_VOICE[w];
  const n = w.replace(/^(la|el|de|del|mesa)\s+/g, '').trim();
  const id = Object.keys(data.tables).map(Number).find(k => { const nm = data.tables[k] && data.tables[k].name; return nm && normVoiceText(nm) === n; });
  return id || null;
}
// Voz: "pasa la mesa 3 a la 5", "cambia la mesa 2 para la mesa 6", "junta la mesa 1 con la 4",
// "mueve la mesa de Juan a la 2", "la mesa 3 se pasó a la 7".
function voiceCambiarMesa(rawText){
  const t = normVoiceText(rawText);
  if(!/\b(pasa|pasar|pasame|pasala|paso|pasaron|cambia|cambiar|cambiame|cambiala|mueve|mover|muevela|muevame|traslada|trasladar|lleva|llevar|junta|juntar|juntame|une|unir|unela)\b/.test(t)) return false;
  const m = t.match(/\bmesa\s+(?:de\s+|del\s+)?([a-z0-9]+(?:\s+[a-z]+)?)\s+(?:(?:se\s+)?(?:paso|pasaron|cambio|movio)\s+)?(?:a|para|hacia|con|en)\s+(?:la\s+)?(?:mesa\s+)?(?:de\s+)?([a-z0-9]+(?:\s+[a-z]+)?)\s*$/);
  if(!m) return false;
  // El nombre puede tener dos palabras ("ana maria"); se prueba primero con las dos y luego con una.
  const pick = s => movMesaDe(s) || movMesaDe(s.split(' ')[0]);
  const o = pick(m[1]), d = pick(m[2]);
  if(!o || !d){ return false; }
  if(!data.tables[o]){ const msg = 'No encontré la ' + (typeof o === 'number' ? 'mesa ' + o : o) + '.'; showToast('⚠️ ' + msg); speakVoice(msg); return true; }
  const r = moverMesa(o, d);
  if(r.error){ showToast('⚠️ ' + r.error); speakVoice(r.error); return true; }
  const msg = movMensaje(r);
  showToast('🔀 ' + msg + ' Di "deshacer" si te equivocaste.', 6000); speakVoice(msg);
  return true;
}
// Ventana: elegir qué se pasa y a cuál mesa.
function abrirCambioMesa(origen){
  const o = data.tables[origen];
  if(!o || !(o.items || []).length){ showToast('Esta mesa no tiene nada para pasar.'); return; }
  let ov = document.getElementById('movOverlay');
  if(!ov){ ov = document.createElement('div'); ov.id = 'movOverlay'; ov.className = 'overlay'; document.body.appendChild(ov); ov.addEventListener('click', e => { if(e.target === ov) ov.classList.remove('show'); }); }
  let modo = 'todo', destino = null;
  const sel = {};
  const pintar = () => {
    const ids = Object.keys(data.tables).map(Number).filter(k => k !== origen).sort((a, b) => a - b);
    const lineas = o.items.map((it, i) => '<div class="mov-li"><span>' + invEsc(it.name) + ' <small>×' + it.qty + '</small></span><div class="mov-q"><button type="button" data-i="' + i + '" data-d="-1">−</button><b>' + (sel[i] || 0) + '</b><button type="button" data-i="' + i + '" data-d="1">+</button></div></div>').join('');
    ov.innerHTML = '<div class="modal" style="max-width:460px;max-height:90vh;overflow:auto"><h2>🔀 Cambiar de mesa</h2><div class="modal-sub">Desde ' + invEsc(tableLabel(origen)) + ' (' + fmt(tableTotal(origen)) + ')</div>' +
      '<div class="mov-modo"><button type="button" data-m="todo" class="' + (modo === 'todo' ? 'on' : '') + '">Toda la cuenta</button><button type="button" data-m="parte" class="' + (modo === 'parte' ? 'on' : '') + '">Solo algunos productos</button></div>' +
      (modo === 'parte' ? '<div class="mov-lineas">' + lineas + '</div>' : '') +
      '<div class="mov-sub">¿A cuál mesa?</div><div class="mov-mesas">' +
      ids.map(k => { const tt = data.tables[k], oc = (tt.items || []).length; return '<button type="button" data-k="' + k + '" class="' + (destino === k ? 'on ' : '') + (oc ? 'oc' : '') + '"><b>' + invEsc(tableLabel(k)) + '</b><small>' + (oc ? fmt(tableTotal(k)) + ' · se juntan' : 'Libre') + '</small></button>'; }).join('') +
      '<button type="button" data-k="nueva" class="' + (destino === 'nueva' ? 'on' : '') + '"><b>➕ Mesa nueva</b><small>Mesa ' + (Math.max(0, ...Object.keys(data.tables).map(Number)) + 1) + '</small></button></div>' +
      '<div class="modal-actions"><button class="btn-close" type="button" data-x="1">Cancelar</button><button class="btn-primary" type="button" data-ok="1">Pasar</button></div></div>';
    ov.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { modo = b.dataset.m; pintar(); });
    ov.querySelectorAll('.mov-q button').forEach(b => b.onclick = () => { const i = +b.dataset.i; sel[i] = Math.max(0, Math.min(o.items[i].qty, (sel[i] || 0) + (+b.dataset.d))); pintar(); });
    ov.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { destino = b.dataset.k === 'nueva' ? 'nueva' : +b.dataset.k; pintar(); });
    ov.querySelector('[data-x]').onclick = () => ov.classList.remove('show');
    ov.querySelector('[data-ok]').onclick = () => {
      if(destino == null){ showToast('⚠️ Elige a cuál mesa.'); return; }
      const lineasSel = modo === 'parte' ? Object.fromEntries(Object.entries(sel).filter(([, v]) => v > 0)) : null;
      if(lineasSel && !Object.keys(lineasSel).length){ showToast('⚠️ Elige qué productos pasar (con +).'); return; }
      const dest = destino === 'nueva' ? Math.max(0, ...Object.keys(data.tables).map(Number)) + 1 : destino;
      const r = moverMesa(origen, dest, lineasSel);
      if(r.error){ showToast('⚠️ ' + r.error); return; }
      ov.classList.remove('show');
      try{ openTableModal(dest); }catch(e){}
      showToast('🔀 ' + movMensaje(r) + ' (toca aquí para deshacer)', 7000);
      const tt = document.getElementById('toast');
      tt.onclick = () => { tt.classList.remove('show'); const id = undoLastVoiceOrder(); if(id){ showToast('↩️ Listo, lo devolví como estaba.'); try{ openTableModal(origen); }catch(e){} } };
    };
  };
  pintar();
  ov.classList.add('show');
}

// ---- Crear una mesa con nombre (y pedido) por voz ----
// "agrégame una mesa con el nombre Juan y agrégale dos cervezas, una póker"
// "crea la mesa Carolina con tres Club Colombia" · "nueva mesa para don Pedro" · "abre una mesa a nombre de Ana"
const VOICE_MESA_VERBOS = /^(agrega|agregame|agregue|agreguen|agregueme|agregar|agregale|anade|anademe|anadime|anadir|anada|crea|creame|crear|cree|creeme|abre|abreme|abrir|abrime|abra|abrame|pon|ponme|poner|ponga|pongame|haz|hazme|hacer|haga|hagame|arma|armame|armar|monta|montame|montar|mete|meteme|registra|registrame|registrar|inicia|iniciar|empieza|arranca|habilita|activa|dame|deme|quiero|necesito|necesitamos|ocupo|nueva|nuevo|otra)$/;
const VOICE_MESA_PALABRA = /^(mesa|mesita|cuenta)$/;
const VOICE_MESA_CORTE = new Set(['y','e','con','agregale','agregar','agrega','agregue','ponle','pon','anotale','anota','sirvele','sirve','dale','traele','traigale','llevale','que','mesa','por','favor','porfa','porfavor','plis','please','ya','ahora','rapido','gracias','le','para','en','al','a']);
const VOICE_CANTIDAD = /^(\d+|un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|media|medio)$/;
// Frases que anuncian el nombre de la mesa, de la más larga a la más corta.
const VOICE_MESA_MARCAS = [
  'y que se va a llamar','que se va a llamar','y que se llame','y que se llama','que se llame','que se llama','que se llamara','y se llama','y se llame','se llama','se llame',
  'y ponle de nombre','y ponle el nombre de','y ponle el nombre','y ponle','ponle de nombre','ponle el nombre de','ponle el nombre','ponle','y llamala','llamala','y le pones','le pones',
  'que tenga el nombre de','con el nombre de','con el nombre','con nombre de','con nombre','cuyo nombre es','el nombre es','de nombre','por nombre','a nombre de','a nombre del','a nombre',
  'que diga','llamada','llamado','nombre','para el','para la','para','de el','de la','del','de'
].map(x => x.split(' '));
const VOICE_MESA_NO_NOMBRE = /^(nueva|nuevo|otra|otro|numero|mas|aparte|adicional|extra|libre|vacia|grande|pequena|afuera|adentro|terraza|personas?|gente)$/;
const voiceNormPalabra = w => w.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
function voiceCrearMesaConNombre(rawText){
  const rw = String(rawText || '').replace(/[,.;:!?¿¡"()]/g, ' ').split(/\s+/).filter(Boolean);
  const nw = rw.map(voiceNormPalabra);
  // Muletillas al inicio: "oye", "mesi", "por favor", "hola"...
  let i = 0;
  while(i < nw.length && i < 4 && !VOICE_MESA_VERBOS.test(nw[i]) && !VOICE_MESA_PALABRA.test(nw[i])) i++;
  if(i >= nw.length || i >= 4) return false;
  let m;
  if(VOICE_MESA_PALABRA.test(nw[i])){
    // "mesa nueva Juan" / "mesa para Juan": sin verbo solo vale si dice "nueva" o es lo primero.
    if(!(nw[i + 1] === 'nueva' || nw[i + 1] === 'nuevo' || i === 0)) return false;
    if(nw[i] === 'cuenta') return false;
    m = i;
  } else {
    m = i + 1;
    // Entre el verbo y "mesa" solo pueden ir palabras de relleno ("agrégame POR FAVOR una nueva
    // mesa", "crea ya otra mesa"); así "agrega dos cervezas a la mesa Juan" sigue siendo un pedido.
    const RELLENO = /^(una|un|la|el|otra|otro|nueva|nuevo|me|mi|porfa|por|favor|porfavor|ya|rapido|rapidito|ahi|aqui|tambien|de|pues|oye|mesi)$/;
    while(m < nw.length && m < i + 5 && RELLENO.test(nw[m])) m++;
    if(!VOICE_MESA_PALABRA.test(nw[m] || '')) return false;
    // "cuenta" solo cuenta como mesa con abrir/crear ("ábreme una cuenta a nombre de Ana"), no con "dame la cuenta".
    if(nw[m] === 'cuenta' && !/^(abre|abreme|abrir|abrime|abra|abrame|crea|creame|crear|cree|creeme|inicia|iniciar|arranca|nueva|otra)$/.test(nw[i]) && !/^(nueva|otra)$/.test(nw[m - 1])) return false;
  }
  let p = m + 1;
  while(/^(nueva|nuevo|mas|aparte|adicional|extra|otra)$/.test(nw[p] || '')) p++;
  // Marcador del nombre ("que se llame", "a nombre de", "para", "llamada"…); se prueba el más largo primero.
  for(const mk of VOICE_MESA_MARCAS){ if(mk.every((w, k) => nw[p + k] === w)){ p += mk.length; break; } }
  if(nw[p] === 'el' || nw[p] === 'la' || nw[p] === 'senor' || nw[p] === 'senora' || nw[p] === 'senorita') p++;
  const ini = p;
  while(p < nw.length && p - ini < 3 && nw[p] && !VOICE_MESA_CORTE.has(nw[p]) && !VOICE_CANTIDAD.test(nw[p]) && !VOICE_MESA_PALABRA.test(nw[p])) p++;
  const nombre = rw.slice(ini, p).join(' ').replace(/[^\p{L}\p{N} .'-]/gu, '').trim();
  if(!nombre || /^\d+$/.test(nombre) || VOICE_MESA_NO_NOMBRE.test(nw[ini] || '')) return false;
  // Lo que sigue es el pedido: se quitan los conectores ("y agrégale", "con", "ponle"...).
  let q = p;
  while(q < nw.length && (VOICE_MESA_CORTE.has(nw[q]) || nw[q] === 'de') && !VOICE_CANTIDAD.test(nw[q])) q++;
  const pedidoTxt = rw.slice(q).join(' ');
  const bonito = nombre.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  // ¿Ya hay una mesa con ese nombre? Se usa esa en vez de crear otra.
  const clave = bonito.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  let id = Object.keys(data.tables).map(Number).find(k => { const n = data.tables[k] && data.tables[k].name; return n && n.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim() === clave; });
  let creada = false;
  if(!id){
    id = Math.max(0, ...Object.keys(data.tables).map(Number)) + 1;
    data.tables[id] = { items: [], people: [], name: bonito };
    data.tableCount = Math.max(data.tableCount || 0, id);
    creada = true;
  }
  let resumen = '', noEncontre = [];
  if(pedidoTxt){
    const items = parseVoiceCommand(pedidoTxt).items || [];
    if(items.length){
      const r = applyVoiceItems(id, items, 'add');
      resumen = r.added.map(a => (a.qty > 1 ? a.qty + ' ' : '') + a.name).join(', ');
      noEncontre = r.notFound || [];
    } else noEncontre = [pedidoTxt];
  }
  saveData(); try{ renderMesas(); }catch(e){}
  const quien = 'la mesa ' + bonito;
  let msg = (creada ? 'Creé ' + quien : 'Ya existía ' + quien) + (resumen ? (creada ? ' y le agregué ' : '; le agregué ') + resumen : '') + '.';
  showToast((creada ? '➕ ' : '✅ ') + msg + (noEncontre.length ? ' No encontré: ' + noEncontre.join(', ') + '.' : ''), 6000);
  speakVoice(msg + (noEncontre.length ? ' No encontré ' + noEncontre.join(', ') + '.' : ''));
  if(!pedidoTxt && !creada){ try{ openTableModal(id); }catch(e){} }
  return true;
}

// ---- Cambiar el nombre de una mesa por voz o por el chat ----
// "cámbiale el nombre a la mesa 3 por Juan" · "ponle Juan a la mesa 3" · "la mesa 3 se llama Juan"
// "renombra la mesa 3 como Lucas" · "a la mesa 2 ponle de nombre Ana" · "quítale el nombre a la mesa Juan"
function voiceRenombrarMesa(rawText){
  const rw = String(rawText || '').replace(/[,.;:!?¿¡"()]/g, ' ').split(/\s+/).filter(Boolean);
  const nw = rw.map(voiceNormPalabra);
  const t = nw.join(' ');
  if(!/\bmesa\b/.test(t)) return false;
  const REF = '(\\d+|[a-z]+(?: [a-z]+)?)';
  const NOM = '(?:el nombre de |el nombre |de nombre |nombre |como |por |a |para )?(.+)';
  let ref = null, nom = null, quitar = false, mm;
  if((mm = t.match(new RegExp('\\b(?:quita|quitale|borra|borrale|elimina|eliminale|saca|sacale)(?: el)? nombre (?:a|de) (?:la )?mesa ' + REF + '$')))){ ref = mm[1]; quitar = true; }
  else if((mm = t.match(new RegExp('\\b(?:cambia|cambiale|cambiar|cambie|cambiele|pon|ponle|poner|ponga|pongale|coloca|colocale)(?: el)? nombre (?:a|de) (?:la )?mesa ' + REF + ' (?:por|a|como|para|que sea) ' + '(?:el nombre de |el nombre |de nombre )?(.+)$')))){ ref = mm[1]; nom = mm[2]; }
  else if((mm = t.match(new RegExp('\\b(?:renombra|renombrar|renombrame|renombre|bautiza|bautizar)(?: la)? mesa ' + REF + ' ' + NOM + '$')))){ ref = mm[1]; nom = mm[2]; }
  else if((mm = t.match(new RegExp('^(?:(?:oye|mesi|hola|porfa|por favor) )*(?:la )?mesa ' + REF + ' (?:ahora )?(?:se llama|se va a llamar|se llamara|es de|es para|a nombre de|ahora es) (?:el |la )?(.+)$')))){ ref = mm[1]; nom = mm[2]; }
  else if((mm = t.match(new RegExp('\\b(?:ponle|pongale|dile|llama|llamale) (?:de nombre |el nombre (?:de )?)?(.+?) a la mesa ' + REF + '$')))){ ref = mm[2]; nom = mm[1]; }
  else if((mm = t.match(new RegExp('\\ba la mesa ' + REF + ' (?:ponle|pongale|dile|llamala|cambiale el nombre (?:a|por)) (?:de nombre |el nombre (?:de )?)?(.+)$')))){ ref = mm[1]; nom = mm[2]; }
  else return false;
  // La referencia puede ser un número ("3", "tres") o el nombre que ya tiene ("la mesa Juan").
  let id = movMesaDe(ref) || movMesaDe(ref.split(' ')[0]);
  if(!id || !data.tables[id]){ const msg = 'No encontré la mesa ' + ref + '.'; showToast('⚠️ ' + msg); speakVoice(msg); return true; }
  let bonito = '';
  if(!quitar){
    // Se toma el nombre tal como se dijo (con tildes y mayúsculas) buscando esas palabras en el texto original.
    const nwNom = nom.split(' ').filter(Boolean);
    let at = -1;
    for(let k = nw.length - nwNom.length; k >= 0; k--){ if(nwNom.every((w, j) => nw[k + j] === w)){ at = k; break; } }
    const crudo = at >= 0 ? rw.slice(at, at + nwNom.length).join(' ') : nom;
    bonito = crudo.replace(/[^\p{L}\p{N} .'-]/gu, '').trim().split(' ').slice(0, 4).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    if(!bonito) return false;
  }
  const antes = tableLabel(id);
  data.tables[id].name = quitar ? null : bonito;
  saveData(); try{ renderMesas(); }catch(e){}
  const msg = quitar ? 'Listo, ' + antes + ' volvió a llamarse Mesa ' + id + '.' : 'Listo, ' + antes + ' ahora se llama ' + bonito + '.';
  showToast('✏️ ' + msg); speakVoice(msg);
  return true;
}

function voiceTableManagement(rawText){
  const t = normVoiceText(rawText).replace(/\s+/g,' ').trim();
  const det = '(?:(?:la|una|otra|nueva|esa|hasta)\\s+)*';
  const add = new RegExp('\\b(agrega|agregar|agregame|anade|anadir|añade|añadir|crea|crear|abre|abrir|pon|poner)\\s+' + det + 'mesas?\\b').test(t);
  const remove = new RegExp('\\b(quita|quitar|quitame|elimina|eliminar|eliminame|borra|borrar|saca|sacar)\\s+' + det + 'mesas?\\b').test(t);
  if(!add && !remove) return false;

  // Si después de "mesa N" vienen más palabras (productos), es un pedido y no
  // un comando de gestión de mesas. Ej: "agrega mesa 1, 5 águilas".
  const mgmtRe = new RegExp('\\b(agrega|agregar|agregame|anade|anadir|añade|añadir|crea|crear|abre|abrir|pon|poner|quita|quitar|quitame|elimina|eliminar|eliminame|borra|borrar|saca|sacar)\\s+' + det + 'mesas?\\b');
  const mm = t.match(mgmtRe);
  if(mm){
    const after = t.slice(mm.index + mm[0].length).trim().split(' ').filter(Boolean);
    let k = 0;
    while(k < after.length && k < 3 && MESA_NUMBER_FILLERS.has(after[k])) k++;
    let numVal = null;
    if(k < after.length){ numVal = voiceTableNumberFromWord(after[k]); if(numVal !== null) k++; }
    const ignore = new Set(['y','en','la','el','de','a','por','favor','porfavor','ya','ahora']);
    const tail = after.slice(k).filter(w => !ignore.has(w));
    if(tail.length) return false;
    // "abre la mesa 2" con la mesa 2 existente: abrir esa mesa, no crear otra.
    if(/^(abre|abrir)$/.test(mm[1]) && numVal !== null && data.tables[numVal]) return false;
  }

  const m = t.match(/\b(?:mesa|mesas)\s+(?:numero|num)?\s*(\d+|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\b/);
  const requested = m ? (/^\d+$/.test(m[1]) ? parseInt(m[1],10) : NUM_WORDS_VOICE[m[1]]) : null;

  if(add){
    if(requested && requested > (data.tableCount || Object.keys(data.tables).length)){
      for(let i=(data.tableCount||Object.keys(data.tables).length)+1;i<=requested;i++) data.tables[i] = {items:[], people:[]};
      data.tableCount = requested;
      saveData(); renderMesas();
      const msg = 'Agregué hasta la Mesa ' + requested + '.';
      showToast('➕ ' + msg); speakVoice(msg); return true;
    }
    const next = Math.max(0, ...(Object.keys(data.tables).map(Number))) + 1;
    data.tables[next] = {items:[], people:[]};
    data.tableCount = Math.max(data.tableCount || 0, next);
    saveData(); renderMesas();
    const msg = 'Agregué la Mesa ' + next + '.';
    showToast('➕ ' + msg); speakVoice(msg); return true;
  }

  let target = requested;
  if(!target) target = Math.max(0, ...(Object.keys(data.tables).map(Number)));
  if(!target || !data.tables[target]){
    const msg = 'No encontré esa mesa.'; showToast(msg); speakVoice(msg); return true;
  }
  const tdata = data.tables[target];
  if(tdata.items && tdata.items.length){
    const balance = tableBalance(target);
    pendingTableRemoval = { tableId: target, at: Date.now() };
    const msg = 'Atención: la Mesa ' + target + ' tiene una cuenta activa de ' + fmtSpoken(balance) + '. Si la quitas, esa cuenta pasa al historial como deuda. Si en verdad quieres quitarla, toca el micrófono y di "sí". Si no, di "no".';
    showToast('⚠️ ' + msg);
    speakVoice(msg);
    return true;
  }
  doRemoveTable(target);
  return true;
}

function handleSimpleVoiceCommands(rawText){
  // Si hay una eliminación de mesa esperando confirmación, esa respuesta manda primero.
  if(pendingTableRemoval){
    const fresh = (Date.now() - pendingTableRemoval.at) < PENDING_REMOVAL_TIMEOUT_MS;
    if(fresh && isConfirmVoiceCommand(rawText)){
      const target = pendingTableRemoval.tableId;
      pendingTableRemoval = null;
      doRemoveTable(target);
      return true;
    }
    if(fresh && isCancelVoiceCommand(rawText)){
      pendingTableRemoval = null;
      const msg = 'Listo, no quité la mesa.';
      showToast('✅ ' + msg); speakVoice(msg);
      return true;
    }
    // Si dijo otra cosa o ya pasó el tiempo, la confirmación pendiente expira sola
    // y seguimos interpretando el comando con normalidad.
    pendingTableRemoval = null;
  }

  if(voiceCambiarMesa(rawText)) return true;
  if(voiceRenombrarMesa(rawText)) return true;
  if(voiceCrearMesaConNombre(rawText)) return true;
  if(voiceTableManagement(rawText)) return true;

  if(isAllTablesTotalVoiceCommand(rawText)){
    announceGeneralBill();
    return true;
  }

  if(isSalesTotalVoiceCommand(rawText)){
    const total = getVoiceSalesTotal();
    const msg = 'Las ventas acumuladas, incluyendo las mesas abiertas, son ' + fmtSpoken(total) + '.';
    showToast('📊 ' + msg); speakVoice(msg); return true;
  }
  return false;
}

// ¿La interpretación local entiende bien el comando (mesa válida + productos del catálogo)?
function voiceLocalCanHandle(rawText){
  if(isUndoVoiceCommand(rawText) || isRecallVoiceCommand(rawText) || isBillRequestVoiceCommand(rawText)) return true;
  const p = parseVoiceCommand(rawText);
  let tid = p.tableId;
  if(!tid && !p.mesaMentioned) tid = resolveVoiceTableId(null);
  if(!tid || !data.tables[tid]) return false;
  if(!p.items.length) return !!(p.tableId && p.mesaMentioned); // solo "mesa N": abre la mesa
  return p.items.every(it => matchProductVoice(it.productText));
}

// El micrófono de pedidos es SIEMPRE la voz clásica: instantánea, gratis y sin internet.
// La IA solo se usa desde su propio botón («IA», junto al micrófono), si se activa en Ajustes → Voz.
// Separa varios productos dichos seguidos sin número ("águila póker heineken" → 3 productos). Toma
// siempre el nombre de producto más largo que calce ("águila light" gana a "águila"), en singular.
function voiceSepararProductos(items){
  const sing = w => w.length > 3 ? w.replace(/(es|s)$/, '') : w;
  const norm = x => normVoiceText(x).split(' ').filter(Boolean).map(sing);
  const nombres = (data.products || []).map(p => ({ p, w: norm(p.name) })).filter(x => x.w.length);
  const calza = seg => {                  // producto cuyo nombre empieza exactamente con esas palabras
    let best = null;
    nombres.forEach(x => { if(seg.length <= x.w.length && seg.every((w, i) => x.w[i] === w)){ if(!best || x.w.length < best.w.length) best = x; } });
    return best;
  };
  const out = [];
  (items || []).forEach(it => {
    const w = norm(it.productText || '');
    if(w.length < 2 || calza(w)){ out.push(it); return; }
    const partes = []; let i = 0;
    while(i < w.length){
      let k = Math.min(4, w.length - i), hit = null;
      for(; k >= 1; k--){ hit = calza(w.slice(i, i + k)); if(hit) break; }
      if(!hit){ partes.length = 0; break; }
      partes.push(hit.p.name); i += k;
    }
    if(partes.length >= 2){ partes.forEach((n, j) => out.push({ productText: n, qty: j === 0 ? (it.qty || 1) : 1 })); }
    else out.push(it);
  });
  return out;
}
{ const _mpv = matchProductVoice; matchProductVoice = function(t){ const r = _mpv.apply(this, arguments); if(r || !data || !data.renombres) return r; const n = normVoiceText(t || ''); const k = Object.keys(data.renombres).find(x => normVoiceText(x) === n); return k ? _mpv(nombreVigente(k)) : r; }; }
{ const _pvc = parseVoiceCommand; parseVoiceCommand = function(raw){ const r = _pvc.apply(this, arguments); if(r && r.items) r.items = voiceSepararProductos(r.items); return r; }; }
let voiceModoIA = false;
// Corrige lo que el reconocedor de voz del celular suele escribir mal:
// • "póquer"/"poquer" → póker.
// • Números pegados: al decir "mesa 1, dos águilas" el celular escribe "mesa 12 águilas". Si esa mesa
//   no existe, se separa en "mesa 1, 2 águilas" (se prueba el corte que deja una mesa que sí existe).
function voiceNormalizarHabla(raw){
  let t = String(raw || '');
  try{ const [sg, pl] = espacio(); if(sg !== 'Mesa'){ const q = w => w.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); const pat = w => q(w).split('').map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\u0300-\\u036f]?').join(''); t = t.normalize('NFD').replace(new RegExp('(^|[^\\p{L}])(' + pat(pl) + '|' + pat(sg) + ')(?![\\p{L}])', 'giu'), (m, a, w, i, str) => /^cuentas?$/.test(q(w)) && /^\s+(de|del)\b/i.test(str.slice(i + m.length)) ? m : a + (q(w) === q(pl) && q(pl) !== q(sg) ? 'mesas' : 'mesa')).normalize('NFC'); } }catch(e){}   // «la cuenta de la mesa 2» es pedir la cuenta
  t = t.replace(/\bp[oó]quer(e?s)?\b/gi, 'póker').replace(/\bpoker(e?s)\b/gi, 'póker');
  t = t.replace(/\b(mesa|mesita)\s+(\d{2,3})\b(?=\s+[^\d\s])/gi, (all, w, num) => {
    if(data.tables[parseInt(num, 10)]) return all;
    for(let k = num.length - 1; k >= 1; k--){
      const a = parseInt(num.slice(0, k), 10), q = parseInt(num.slice(k), 10);
      if(q > 0 && data.tables[a]) return w + ' ' + a + ', ' + q;
    }
    return all;
  });
  /* Formas cortas como se habla en un bar (solo si esa mesa existe, para no confundir
     cantidades con mesas):
     - «la 3», «de la 3», «a la 5», «para la 2» → «la mesa 3»…  («cobra la 3», «la cuenta de
       la 5», «quita una águila de la 3», «pasa la 3 a la 5»). Antes «la 5 tres póker» le
       metía el pedido a OTRA mesa.
     - número suelto al inicio seguido de cantidad: «3 dos águilas» → «mesa 3 dos águilas»
       (antes agregaba 3 águilas).
     - «menos» = quitar: «mesa 3 menos una águila» (antes la AGREGABA). */
  const NUM_PAL = { dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, 'dieciséis': 16, diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20 };
  const esMesa = n => !!(n && data && data.tables && data.tables[n]);
  t = t.replace(/(^|[^\p{L}])(la)\s+(\d{1,3}|[a-záéíóúñ]+)(?=$|[^\p{L}\d])/giu, (all, pre, la, x) => {
    const n = /^\d+$/.test(x) ? parseInt(x, 10) : NUM_PAL[x.toLowerCase()];
    return esMesa(n) ? pre + la + ' mesa ' + n : all;
  });
  t = t.replace(/\bmesa\s+mesa\b/gi, 'mesa');
  t = t.replace(/^\s*(\d{1,3})\s+(?=(?:un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|\d{1,2})\s+\S)/i, (all, n) => esMesa(parseInt(n, 10)) ? 'mesa ' + n + ' ' : all);
  t = t.replace(/\bmenos\s+(?=\S)/gi, 'quita ');
  // Muletillas al empezar: «que sean dos Póker…», «hay que agregar…», «que me traigan…» (se perdía la cantidad)
  t = t.replace(/^\s*no[\s,.]+(?=(?:eran|son)\b)/i, '');
  t = t.replace(/^\s*son\s+(?=(?:un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|quince|veinte|treinta|cuarenta|cincuenta|\d+)\s)/i, '');
  t = t.replace(/^\s*(?:que\s+(?:sean|sea|me\s+(?:traigan|traiga|traes|traen|regalen|regale|den|des))|hay\s+que\s+(?:agregar|poner|anotar|sumar|meter)|me\s+(?:traen|traes|trae|regalan|regalas|dan|das))\s+/i, '');
  // Deshacer con otras palabras
  if(/^\s*(borra|quita|cancela|elimina)\s+(lo|el)\s+(ultimo|último)\s*$|^\s*(me equivoque|me equivoqué|error|eso no|corrige eso|devuelve|atras|atrás)\s*$/i.test(t)) t = 'deshacer';
  return t;
}
// ---------- Más comandos de voz (1.27): inventario, abrir/cobrar mesa, personas, abonos y preguntas a ORDEVA ----------
function voiceDecir(txt, ms){ const limpio = String(txt || '').replace(/[•🧠📦🧾🛒🧮💰🆕🚫⚠️📈📉🏭🛎️🍳🎵✅🔎🔗⏭▶🗑👤💵📲📝↩️🔁]/gu, ' ').replace(/\s+/g, ' ').trim();
  showToast(String(txt).split('\n').slice(0, 5).join(' · '), ms || 8000); speakVoice(limpio.slice(0, 320)); }
function voiceEsPregunta(raw){
  const t = normVoiceText(raw);
  if(/\b(cancion|canciones|musica|cola de musica|playlist|youtube)\b/.test(t) && !/\b(mesa|meza)\s+\S+\s+(un|una|uno|dos|tres|\d)/.test(t)) return true;   // «siguiente canción», «pon la canción…»
  return /\?\s*$/.test(String(raw)) || /^(cuanto|cuanta|cuantos|cuantas|que|cual|cuales|como|quien|quienes|donde|hay|dime|digame|muestrame|ensename|revisa|informe|resumen|estado)\b/.test(t);
}
function voiceExtras(raw){
  const t = normVoiceText(raw);
  const mesaN = (() => { const m = t.match(/\b(?:mesa|meza|cuenta)\s+(?:numero\s+)?(\d{1,3}|[a-z]+)\b/); if(!m) return null; const n = /^\d+$/.test(m[1]) ? parseInt(m[1], 10) : (typeof NUM_PAL !== 'undefined' ? NUM_PAL[m[1]] : null); if(n && data.tables[n]) return n; try{ const x = extractVoiceTableId(raw); return x && data.tables[x] ? x : null; }catch(e){ return null; } })();
  // Inventario: «¿cuántas Poker quedan?», «cuánto hay de Águila», «stock de Club Colombia»
  let mInv = t.match(/^(?:cuant[oa]s?|cuanto)\s+(?:de\s+)?(.+?)\s+(?:quedan|queda|hay|tengo|tenemos|me quedan|nos quedan|van quedando)(?:\s+.*)?$/) || t.match(/^(?:cuanto|cuanta|cuantos|cuantas)\s+(?:hay|queda|quedan)\s+(?:de\s+)?(.+)$/) || t.match(/^(?:stock|inventario|existencias)\s+(?:de|del)\s+(.+)$/) || t.match(/^(?:quedan|queda|hay)\s+(.+?)\s*$/);
  if(mInv && !/\b(mesa|mesas|cuenta|cuentas|pedido|pedidos|cancion|canciones|plata|dinero|ventas?|saldo|deuda|debe)\b/.test(mInv[1])){
    const p = matchProductVoice(mInv[1]);
    if(p){ const msg = p.stock == null || p.stock === '' ? p.name + ' no lleva control de inventario.' : 'De ' + p.name + ' quedan ' + p.stock + ' unidad' + (p.stock == 1 ? '' : 'es') + '.'; voiceDecir('📦 ' + msg); return true; }
  }
  // Abrir una mesa: «abre la mesa 3», «muéstrame la mesa 2»
  if(mesaN && /^(abre|abrir|abreme|muestra|muestrame|ver|ensename|entra a|entra en)\s+(la\s+)?(cuenta\s+de\s+la\s+)?(mesa|meza|cuenta)\s+\S+$/.test(t)){
    openTableModal(mesaN); speakVoice('Listo, ' + tableLabel(mesaN) + '.'); return true;
  }
  // Cobrar una mesa (pide confirmación como siempre): «cobra la mesa 3», «cierra la cuenta de la mesa 2»
  if(mesaN && /^(cobra|cobrar|cobrale|cobrame|cierra|cerrar|cierrale|liquida|liquidar|factura|facturale)\s+(la\s+)?(cuenta\s+(de\s+)?(la\s+)?)?(mesa|meza|cuenta)\b/.test(t)){
    const tb = data.tables[mesaN];
    if(!tb.items || !tb.items.length){ voiceDecir(tableLabel(mesaN) + ' no tiene nada por cobrar.'); return true; }
    openTableModal(mesaN); voiceDecir('💰 ' + tableLabel(mesaN) + ': son ' + fmtSpoken(tableBalance(mesaN)) + '. Confirma el cobro en pantalla.');
    setTimeout(() => { const b = document.getElementById('chargeBtn'); if(b && currentTable === mesaN) b.click(); }, 450);
    return true;
  }
  // Agregar una persona a la mesa: «agrega a Juan a la mesa 4», «pon a María en la mesa 2»
  const mPer = t.match(/^(?:agrega|agregale|agregame|anade|mete|pon|suma|sumale|registra|anota)\s+(?:a\s+)?(?:una\s+persona\s+(?:llamada\s+|que\s+se\s+llama\s+)?|la\s+persona\s+)?([a-zn][a-zn ]{1,28}?)\s+(?:a|en|para)\s+la\s+(?:mesa|meza|cuenta)\s+\S+$/);
  if(mesaN && mPer && !/\d/.test(mPer[1]) && !matchProductVoice(mPer[1]) && !/^(un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|otra|otro|otras|otros|lo|la|el|los|las)\b/.test(mPer[1])){
    const pal = mPer[1].trim().split(' '), orig = String(raw).split(/\s+/), on = orig.map(w => normVoiceText(w));
    let nombre = mPer[1].trim();
    for(let i = 0; i + pal.length <= on.length; i++){ if(pal.every((w, k) => on[i + k] === w)){ nombre = orig.slice(i, i + pal.length).join(' ').replace(/[^\p{L} ]/gu, ''); break; } }
    nombre = nombre.replace(/(^|\s)\p{L}/gu, c => c.toUpperCase());
    const tb = data.tables[mesaN]; tb.people = tb.people || [];
    if(tb.people.some(x => normVoiceText(x.name) === normVoiceText(nombre))){ voiceDecir('👤 ' + nombre + ' ya está en ' + tableLabel(mesaN) + '.'); return true; }
    tb.people.push({ id: Date.now().toString(), name: nombre }); saveData();
    if(currentTable === mesaN){ try{ renderPeople(); }catch(e){} }
    renderMesas(); voiceDecir('👤 Agregué a ' + nombre + ' a ' + tableLabel(mesaN) + '.'); return true;
  }
  // Abono / pago parcial: «la mesa 3 abona 20 mil», «Juan paga 10 mil de la mesa 2 por transferencia»
  if(mesaN && /\b(abona|abono|abonar|abonale|abonen|adelanta|adelanto|anticipo|paga|pago|pagan|pagaron|pague)\b/.test(t) && !/\b(todo|toda la cuenta|completo|completa)\b/.test(t)){
    const monto = window.ventoMonto ? window.ventoMonto(t.replace(/\b(mesa|meza|cuenta)\s+(numero\s+)?\S+/, ' ')) : 0;
    if(monto > 0){
      const tb = data.tables[mesaN]; tb.payments = tb.payments || [];
      const met = /\b(transferencia|transfirio|nequi|daviplata|bancolombia|qr)\b/.test(t) ? 'transferencia' : 'efectivo';
      const mQuien = t.match(/^([a-zn]+(?:\s[a-zn]+)?)\s+(?:abona|paga|pago|adelanta)\b/);
      const quien = mQuien && !/^(la|el|mesa|cuenta|me|le|se)$/.test(mQuien[1]) ? mQuien[1].replace(/\b\w/g, c => c.toUpperCase()) : '';
      tb.payments.push({ note: quien ? quien + ' (abono por voz)' : 'Abono por voz', amount: monto, method: met });
      saveData(); if(currentTable === mesaN){ try{ renderModalItems(); }catch(e){} } renderMesas();
      voiceDecir('💵 Abono de ' + fmtSpoken(monto) + (met === 'transferencia' ? ' por transferencia' : ' en efectivo') + ' a ' + tableLabel(mesaN) + '. Queda debiendo ' + fmtSpoken(Math.max(0, tableBalance(mesaN))) + '. Di «deshacer» si te equivocaste.');
      voiceUndoStack.push({ abono: true, tableId: mesaN }); if(voiceUndoStack.length > 15) voiceUndoStack.shift();
      return true;
    }
  }
  return false;
}
// Preguntas por el micrófono: las responde ORDEVA con los datos reales (sin internet) y las dice en voz alta.
function voicePreguntaLaya(raw){
  let r = null;
  try{ r = window.Laya && window.Laya.responder(raw); }catch(e){}
  try{ if(!r && typeof asisCommand === 'function') r = asisCommand(raw); }catch(e){}
  try{ if(!r && typeof asisLocalAccion === 'function'){ const a = asisLocalAccion(raw); if(a) r = { text: a.text, actions: a.actions }; } }catch(e){}
  try{ if(!r){ const x = (typeof asisLocalMas === 'function' && asisLocalMas(raw)) || (typeof asisLocal === 'function' && asisLocal(raw)); if(x) r = { text: x }; } }catch(e){}
  if(!r || !r.text) return false;
  voiceDecir(r.text, 10000);
  if(r.run) setTimeout(r.run, 700);
  if(r.actions && r.actions.length){ try{ asisOpen(); asisBot(r.text, { actions: r.actions }); }catch(e){} }
  return true;
}
async function handleVoiceTranscript(rawText){
  const conIA = voiceModoIA; voiceModoIA = false;
  if(typeof subPuedeVender === 'function' && !subPuedeVender()){ subPaywall('Para seguir usando la voz y hacer ventas, renueva tu suscripción.'); return; }
  rawText = voiceNormalizarHabla(rawText);
  try{
    // «ORDEVA, ¿qué hay en la barra?» dicho en el micrófono de pedidos: lo responde ORDEVA (y lo dice en voz alta).
    if(/^\s*((oye|hola|ok|okey|ey|hey)[\s,]+)?(laya|vento|bento|ordeva|hordeva|or deva)\b/i.test(rawText) && !window.__pedidoOrigen){
      let ly = null; try{ ly = window.Laya && window.Laya.responder(rawText); }catch(e){}
      if(ly){ showToast('🧠 ' + ly.text.split('\n').slice(0, 4).join(' · '), 9000); speakVoice(ly.text.replace(/[•🧠📦🧾🛒🧮💰🆕🚫⚠️📈📉🏭🛎️🍳🎵✅🔎🔗⏭▶🗑]/gu, ' ').slice(0, 400)); if(ly.actions && ly.actions.length || ly.run){ asisOpen(); asisAsk(rawText); } return; }
      // No es una pregunta para ORDEVA: se quita su nombre y la frase sigue como un pedido o comando de voz normal.
      rawText = rawText.replace(/^\s*((oye|hola|ok|okey|ey|hey)[\s,]+)?(laya|vento|bento|ordeva|hordeva|or deva)\b[\s,]*/i, '');
      if(!rawText.trim()) return;
    }
    if(isVoiceHelpCommand(rawText)){ voiceAyuda(); return; }
    if(/^\s*(abre|abrir|ábreme|abreme|muestra|pon)?\s*(la\s+)?calculadora\s*$/i.test(rawText)){ if(window.calculadoraAbrir) window.calculadoraAbrir(); return; }
    // Cuentas por voz con el micrófono principal: «súmame 3500 más 4000 y multiplícame 5000 por 2».
    // Solo si se pidió una cuenta (súmame, multiplícame, divídeme, réstame, cuánto es…) y no se nombró una
    // mesa ni un producto (así «súmale 2 Águilas a la mesa 3» sigue siendo un pedido).
    try{
      const tn = String(rawText).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const nombraAlgo = /\b(mesa|meza|cuenta|silla|habitacion|pedido|ronda)\b/.test(tn) || data.products.some(p => { const w = String(p.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/\s+/).filter(x => x.length > 3 && !/^(lata|botella|cerveza|litro|unidad)$/.test(x)); return w.some(x => new RegExp('\\b' + x.replace(/[^a-z0-9]/g, '') + 's?\\b').test(tn)); });
      const calc = !nombraAlgo && window.ventoCalcular && window.ventoCalcular(rawText, true);
      if(calc){ showToast(calc.texto, 12000); speakVoice(calc.voz); return; }
    }catch(e){}
    if(voiceExtras(rawText)) return;
    if(window.libretaVoz && window.libretaVoz(rawText)) return;   // «Juan me debe 20 mil», «agrégame a la lista negra…»
    if(/\b(libreta|cuaderno)\b/i.test(rawText) && window.libretaAbrir){ window.libretaAbrir(); return; }
    if(handleSimpleVoiceCommands(rawText)) return;
    if(voiceEsPregunta(rawText) && !isRecallVoiceCommand(rawText) && !isBillRequestVoiceCommand(rawText) && voicePreguntaLaya(rawText)) return;
    if(conIA){
      if(!hasAIKey()){ showToast('⚠️ La IA no está conectada (⚙️ Configurar IA). Usé la voz clásica.'); return handleVoiceTranscriptLocal(rawText); }
      return await handleVoiceTranscriptAI(rawText, true);
    }
    return handleVoiceTranscriptLocal(rawText);
  }catch(err){
    console.error('Voz:', err);
    showToast('Error al procesar el comando de voz: ' + (err && err.message ? err.message : err));
  }
}

async function handleVoiceTranscriptAI(rawText, forzar){
  if(isRepeatLastOrderVoiceCommand(rawText) || isUndoVoiceCommand(rawText)) return handleVoiceTranscriptLocal(rawText);   // órdenes fijas: sin gastar IA
  if((forzar || voiceAiOn()) && hasAIKey()){
    const ai = await interpretVoiceWithAI(rawText);
    if(ai && ai.confidence >= 0.72){
      if(ai.intent === 'undo'){
        const undoneTableId = undoLastVoiceOrder();
        const msg = undoneTableId ? 'Deshecho el último cambio en ' + tableLabel(undoneTableId) + '.' : 'No hay nada que deshacer.';
        showToast('↩️ ' + msg); speakVoice(msg); return;
      }
      if(ai.intent === 'recall'){
        if(!lastVoiceOrderInfo){ showToast('Todavía no hay ningún pedido registrado.'); speakVoice('Todavía no hay ningún pedido registrado.'); return; }
        const msg = 'Tu último pedido fue: ' + describeVoiceOrder(lastVoiceOrderInfo) + '.';
        showToast('🗣️ ' + msg); speakVoice(msg); return;
      }
      if(ai.intent === 'repeat_last_round'){
        const tableId = resolveVoiceTableId(ai.tableId);
        const repeatItems = getRepeatLastRoundItems(tableId);
        if(!tableId){
          showToast('¿Para cuál mesa? Di por ejemplo "misma ronda para la mesa 5".');
          speakVoice('¿Para cuál mesa es la misma ronda?');
          return;
        }
        if(!repeatItems.length){
          showToast('No hay una ronda anterior para repetir.');
          speakVoice('No hay una ronda anterior para repetir.');
          return;
        }
        const result = applyVoiceItems(tableId, repeatItems, 'add');
        if(result.added.length){
          const msg = 'Misma ronda agregada a ' + tableLabel(tableId) + '.';
          showToast('✅ ' + msg); speakVoice(msg);
        }
        if(result.notFound.length) showToast('No encontré: ' + result.notFound.join(', '));
        return;
      }
      if(ai.intent === 'all_tables_total'){ announceGeneralBill(); return; }
      if(ai.intent === 'sales_total'){
        const msg = 'Las ventas acumuladas, incluyendo las mesas abiertas, son ' + fmtSpoken(getVoiceSalesTotal()) + '.';
        showToast('📊 ' + msg); speakVoice(msg); return;
      }
      if(ai.intent === 'bill'){
        const tableId = resolveVoiceTableId(ai.tableId);
        if(tableId){ openBillSummary(tableId); speakVoice('La cuenta de ' + tableLabel(tableId) + ' es ' + fmtSpoken(tableBalance(tableId)) + '.'); }
        else { showToast('¿La cuenta de cuál mesa?'); speakVoice('¿La cuenta de cuál mesa?'); }
        return;
      }
      if(ai.intent === 'order' && Array.isArray(ai.items) && ai.items.length){
        const tableId = resolveVoiceTableId(ai.tableId);
        if(tableId){
          const result = applyVoiceItems(tableId, ai.items, ai.mode || 'add');
          if(result.added.length){
            const msg = result.added.map(a => (a.qty > 1 ? a.qty + ' ' : '') + a.name).join(', ') + ' agregado a ' + tableLabel(tableId) + '.';
            showToast('✅ ' + msg); speakVoice(msg);
          }
          if(result.notFound.length){ showToast('No encontré: ' + result.notFound.join(', ')); }
          return;
        }
      }
    }
  }
  return handleVoiceTranscriptLocal(rawText);
}

function handleVoiceTranscriptLocal(rawText){
  if(isRepeatLastOrderVoiceCommand(rawText)){
    const info = lastVoiceOrderInfo || (data && data.ultimoPedido) || null;
    if(!info || !info.tableId){ showToast('Todavía no hay ningún pedido para repetir.'); speakVoice('Todavía no hay ningún pedido para repetir.'); return; }
    const rm = voiceRondaMesas(rawText), destino = rm.destino || info.tableId;
    return handleVoiceTranscriptLocal('misma ronda de la mesa ' + info.tableId + ' para la mesa ' + destino);
  }
  if(isRecallVoiceCommand(rawText)){ voiceRecordarPedido(rawText); return; }
  if(isRepeatLastRoundVoiceCommand(rawText)){
    const rm = voiceRondaMesas(rawText);
    const tableId = resolveVoiceTableId(rm.destino || extractVoiceTableId(rawText));
    if(!tableId){
      showToast('¿Para cuál mesa? Di por ejemplo "misma ronda para la mesa 5".');
      speakVoice('¿Para cuál mesa es la misma ronda?');
      return;
    }
    const origen = rm.origen || tableId;
    const repeatItems = getRepeatLastRoundItems(origen);
    if(!repeatItems.length){
      showToast('⚠️ No hay una ronda anterior para repetir en ' + tableLabel(origen) + '.');
      speakVoice('No hay una ronda anterior para repetir.');
      return;
    }
    applyVoiceItems.repitiendo = true;
    let result;
    try{ result = applyVoiceItems(tableId, repeatItems, 'add'); }finally{ applyVoiceItems.repitiendo = false; }
    if(result.added.length){
      const resumen = result.added.map(a => a.qty + ' ' + a.name).join(', ');
      const msg = 'Misma ronda para ' + tableLabel(tableId) + (origen !== tableId ? ' (copiada de ' + tableLabel(origen) + ')' : '') + ': ' + resumen + '.';
      showToast('🔁 ' + msg);
      speakVoice(msg);
    }
    if(result.notFound.length){
      showToast('No encontré: ' + result.notFound.join(', '));
    }
    return;
  }

  if(isUndoVoiceCommand(rawText)){
    const undoneTableId = undoLastVoiceOrder();
    if(undoneTableId){
      const msg = 'Deshecho el último cambio en ' + tableLabel(undoneTableId) + '.';
      showToast('↩️ ' + msg);
      speakVoice(msg);
    } else {
      showToast('No hay ningún pedido por voz para deshacer.');
      speakVoice('No hay nada que deshacer.');
    }
    return;
  }

  if(isRecallVoiceCommand(rawText)){ voiceRecordarPedido(rawText); return; }

  if(isBillRequestVoiceCommand(rawText)){
    const parsedId = extractVoiceTableId(rawText);
    const tableId = resolveVoiceTableId(parsedId);
    if(!tableId){
      showToast('¿La cuenta de cuál mesa? Di por ejemplo "cuenta de la mesa 2".');
      speakVoice('¿La cuenta de cuál mesa?');
      return;
    }
    openBillSummary(tableId);
    const balance = tableBalance(tableId);
    showToast('🧾 ' + tableLabel(tableId) + ': ' + fmt(balance), 7000); speakVoice('La cuenta de ' + tableLabel(tableId) + ' es ' + fmtSpoken(balance) + '.');
    return;
  }

  const { tableId: parsedTableId, items, mode, mesaMentioned } = parseVoiceCommand(rawText);
  if(!items.length && parsedTableId && mesaMentioned && data.tables[parsedTableId]){
    // Solo se dijo "mesa 4": se abre esa mesa.
    openTableModal(parsedTableId);
    speakVoice('Mesa ' + parsedTableId + '.');
    return;
  }
  if(!items.length){
    showToast('No entendí ningún producto en: "' + rawText + '"');
    speakVoice('No entendí ningún producto. Intenta de nuevo.');
    return;
  }
  // Si se dijo "mesa" pero no se logró entender el número, NO se asume
  // ninguna mesa (ni la que esté abierta en pantalla, ni la única mesa con
  // cuenta activa): se pide que lo repita, para evitar que el pedido caiga
  // en la mesa equivocada.
  if(!parsedTableId && mesaMentioned){
    showToast('Escuché: "' + rawText + '". No entendí el número de mesa. Di por ejemplo "mesa 2".');
    speakVoice('No entendí el número de mesa. ¿Cuál mesa?');
    return;
  }
  // Si se entendió un número de mesa pero esa mesa no existe (posible
  // confusión de dígito, ej. "mesa 1" oído como "mesa 7"), tampoco se
  // asume otra mesa: se avisa cuál número se entendió para que el usuario
  // lo corrija.
  if(parsedTableId && !data.tables[parsedTableId]){
    showToast('Escuché: "' + rawText + '". Entendí "mesa ' + parsedTableId + '" pero esa mesa no existe (mesas: 1 a ' + Math.max(0, ...Object.keys(data.tables).map(Number)) + ').');
    speakVoice('No encontré la mesa ' + parsedTableId + '. ¿Cuál mesa es?');
    return;
  }
  // Modo tienda / mixto (lib/vento-pos.js): sin mesa, el pedido va a la venta de la caja.
  if(!parsedTableId && window.ventoPOS && ventoPOS.vozCaja && ventoPOS.vozCaja(items, mode, 'antes')) return;
  const tableId = resolveVoiceTableId(parsedTableId);
  if(!tableId && !parsedTableId && window.ventoPOS && ventoPOS.vozCaja && ventoPOS.vozCaja(items, mode, 'sin_mesa')) return;
  if(!tableId){
    showToast('¿Para cuál mesa? Di por ejemplo "mesa 2" al inicio o al final.');
    speakVoice('¿Para cuál mesa es el pedido?');
    return;
  }
  const { added, notFound } = applyVoiceItems(tableId, items, mode);
  if(added.length){
    let msg;
    if(mode === 'set'){
      const resumen = added.map(a => a.name + (a.qty === 0 ? ' (quitado)' : ' ahora en ' + a.qty)).join(', ');
      msg = 'Corregido: ' + resumen + ' en ' + tableLabel(tableId) + '.';
      showToast('✏️ ' + msg);
    } else if(mode === 'subtract'){
      const resumen = added.map(a => a.name + (a.qty === 0 ? ' (quitado)' : ' queda en ' + a.qty)).join(', ');
      msg = resumen + ' en ' + tableLabel(tableId) + '.';
      showToast('➖ ' + msg);
    } else {
      const resumen = added.map(a => (a.qty > 1 ? a.qty + ' ' : '') + a.name).join(', ');
      msg = resumen + ' agregado a ' + tableLabel(tableId) + '.';
      showToast('✅ ' + msg);
    }
    speakVoice(msg);
  }
  if(notFound.length){
    const label = mode === 'subtract' ? 'No estaba en el pedido de ' + tableLabel(tableId) + ': ' : 'No encontré: ';
    const msg2 = label + notFound.join(', ') + '.';
    showToast(msg2);
    if(!added.length) speakVoice(mode === 'subtract' ? 'Ese producto no está en el pedido.' : 'No encontré ese producto. Intenta de nuevo.');
  }
}

const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
let voiceRecognizer = null;
let voiceListening = false;
let voiceFinalBuffer = '';
let voiceInterim = '';        // lo último que se oyó aunque no llegara «final» (frases cortas: «una póker»)
let voiceSilenceTimer = null;
const VOICE_SILENCE_MS = 2000;      // silencio tras hablar antes de procesar el comando (pedidos largos con pausas)
const VOICE_INITIAL_TIMEOUT_MS = 6000; // tiempo máximo esperando que empiece a hablar
const VOICE_COMPLETO_MS = 1200;     // app Android: la orden ya está completa (mesa + productos): se anota más rápido
const VOICE_ABRIENDO_MS = 400;         // si el micrófono tarda más que esto en abrir, se avisa «Abriendo…»
let voiceAbriendoT = null, voiceTocado = 0, voiceAvisado = false;

function updateVoiceFabUI(){
  const fab = document.getElementById('voiceFab');
  if(!fab) return;
  fab.classList.toggle('listening', voiceListening);
  // Escuchando: cuadrado de «detener» con ondas; en reposo: el micrófono moderno (mismo dibujo del HTML).
  fab.querySelector('.voice-fab-icon').innerHTML = voiceListening
    ? '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="2.5" fill="currentColor"/><g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M3 9v6"/><path d="M21 9v6"/></g></svg>'
    : '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><rect x="8.6" y="2.5" width="6.8" height="12" rx="3.4" fill="currentColor"/><path d="M5.4 10.8a6.6 6.6 0 0 0 13.2 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M12 17.6v3.2M9 20.8h6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
}

/* Puntúa qué tan "entendible" resulta un texto reconocido, para elegir la
   mejor alternativa entre las que ofrece el reconocedor de voz sin tener
   que ejecutar ninguna acción todavía (sin efectos secundarios). */
function scoreVoiceTranscript(text){
  if(!text) return -100;
  if(pendingTableRemoval && (isConfirmVoiceCommand(text) || isCancelVoiceCommand(text))) return 60;
  if(isUndoVoiceCommand(text) || isRecallVoiceCommand(text)) return 45;
  const t = normVoiceText(text);
  if(/\b(mesa|mesas)\b/.test(t) && /\b(agrega|agregar|quita|quitar|elimina|eliminar|borra|borrar|crea|crear|abre|abrir|saca|sacar)\b/.test(t)) return 42;
  if(isAllTablesTotalVoiceCommand(text)) return 44;
  if(isSalesTotalVoiceCommand(text)) return 40;
  if(isBillRequestVoiceCommand(text)) return 35;
  const { tableId, items, mesaMentioned } = parseVoiceCommand(text);
  let score = 0;
  if(tableId && data.tables[tableId]) score += 30;
  else if(tableId) score += 5;
  else if(mesaMentioned) score -= 15;
  if(!items.length) score -= 5;
  items.forEach(it => { score += matchProductVoice(it.productText) ? 20 : -8; });
  return score;
}

function pickBestVoiceAlternative(result){
  let best = result[0].transcript;
  let bestScore = -Infinity;
  for(let j = 0; j < result.length; j++){
    const s = scoreVoiceTranscript(result[j].transcript);
    if(s > bestScore){ bestScore = s; best = result[j].transcript; }
  }
  return best;
}

/* ¿La frase ya es una orden completa? (mesa que existe + productos conocidos, o un comando como «deshacer», «cuenta de
   la mesa 2»…). Si termina en «y», «con», «para la mesa», un número suelto… todavía falta: se sigue escuchando. */
function voiceComandoCompleto(raw){
  try{
    const t0 = voiceNormalizarHabla(String(raw || '')), t = normVoiceText(t0);
    if(!t) return false;
    if(/\b(y|e|o|con|de|del|para|pa|a|al|la|el|los|las|mas|mesa|meza|mesita|otra|otro|otras|otros|un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|veinte|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|cien|ciento|numero|nombre|llama|llamada|son|eran|agrega|agregale|agregame|quita|quitale|pon|ponle|dame|traeme|regaleme)$/.test(t)) return false;
    if(/\d$/.test(t) && !/\b(mesa|meza)\s+\d+$/.test(t)) return false;
    if(pendingTableRemoval && (isConfirmVoiceCommand(t0) || isCancelVoiceCommand(t0))) return true;
    if(isUndoVoiceCommand(t0) || isVoiceHelpCommand(t0) || isSalesTotalVoiceCommand(t0) || isAllTablesTotalVoiceCommand(t0)) return true;
    if(isBillRequestVoiceCommand(t0) || isRecallVoiceCommand(t0)) return !!extractVoiceTableId(t0);
    const p = parseVoiceCommand(t0);
    return !!(p.tableId && data.tables[p.tableId] && p.items.length && p.items.every(it => matchProductVoice(it.productText)));
  }catch(e){ return false; }
}

function scheduleVoiceSilenceStop(ms){
  if(voiceSilenceTimer) clearTimeout(voiceSilenceTimer);
  voiceSilenceTimer = setTimeout(() => {
    try{ if(voiceRecognizer && voiceListening) stopVoiceCommand(); }catch(e){}
  }, ms);
}

function ensureVoiceRecognizer(){
  if(!SpeechRecognitionCtor) return null;
  if(voiceRecognizer) return voiceRecognizer;
  voiceRecognizer = new SpeechRecognitionCtor();
  voiceRecognizer.lang = 'es-CO';
  // Modo continuo: deja pausas naturales entre "mesa", "mesa 1" y "5 águilas"
  // sin cortar el reconocimiento antes de tiempo. Solo se detiene cuando hay
  // un silencio real (o si el usuario toca el botón otra vez).
  voiceRecognizer.continuous = true;
  voiceRecognizer.interimResults = true;
  voiceRecognizer.maxAlternatives = 5;
  voiceRecognizer.mantener = true;   // en la APK: no se corta en cada pausa (ver el puente de voz de Android, arriba)
  voiceRecognizer.onresult = (e) => {
    const ultFinal = e.results.length && e.results[e.results.length - 1].isFinal;
    // Se reconstruye el texto desde todos los resultados finales (en vez de ir
    // sumando), porque algunos Chrome/Android repiten o acumulan la frase y
    // eso rompía el reconocimiento de la mesa y del producto.
    const finals = [];
    for(let i = 0; i < e.results.length; i++){
      if(!e.results[i].isFinal) continue;
      const best = pickBestVoiceAlternative(e.results[i]);
      const cur = normVoiceText(best);
      const prevRaw = finals.length ? finals[finals.length - 1] : '';
      const prev = prevRaw ? normVoiceText(prevRaw) : '';
      if(prev && prev === cur) continue;
      if(prev && prev.split(' ').length >= 2 && cur.startsWith(prev + ' ')) finals[finals.length - 1] = best;
      else finals.push(best);
    }
    voiceFinalBuffer = finals.join(' ').trim();
    // Android, con frases cortas, a veces entrega solo el resultado parcial y luego «no entendí»:
    // se guarda lo último oído para no perder el pedido (antes había que tocar el micrófono dos veces).
    const ult = e.results[e.results.length - 1];
    if(ult && !ult.isFinal){ const t = pickBestVoiceAlternative(ult); if(t && t.trim()) voiceInterim = t.trim(); }
    // App Android: Android ya esperó su silencio antes de dar la frase final; si la orden está completa se anota en
    // 1,2 s (si se sigue hablando, se suma). En el navegador se deja la espera normal.
    scheduleVoiceSilenceStop(window.VentoAndroid && ultFinal && voiceComandoCompleto(voiceFinalBuffer) ? VOICE_COMPLETO_MS : VOICE_SILENCE_MS);
  };
  voiceRecognizer.onstart = () => {
    if(!voiceListening) return;
    clearTimeout(voiceAbriendoT);
    if(!voiceAvisado){
      voiceAvisado = true;
      // Si tardó en abrir (se alcanzó a ver «Abriendo…»), una vibración avisa que ya se puede hablar.
      if(Date.now() - voiceTocado > VOICE_ABRIENDO_MS) try{ navigator.vibrate && navigator.vibrate(35); }catch(e){}
      showToast(voiceModoIA ? '🤖 Habla ahora: di tu pedido con tus palabras.' : '🎤 Habla ahora…', 2500);
    }
    // El tiempo de espera cuenta desde que de verdad escucha. Si la escucha se volvió a abrir a mitad del pedido (ya se
    // oyó algo), se mantiene la espera corta de silencio para no quedarse 6 s escuchando de más.
    if(!voiceFinalBuffer && !voiceInterim) scheduleVoiceSilenceStop(VOICE_INITIAL_TIMEOUT_MS);
  };
  voiceRecognizer.onerror = (e) => {
    clearTimeout(voiceAbriendoT);
    if(voiceSilenceTimer) clearTimeout(voiceSilenceTimer);
    voiceListening = false;
    updateVoiceFabUI();
    if(e.error === 'no-speech'){
      if(!voiceFinalBuffer && !voiceInterim) showToast('No escuché nada. Intenta de nuevo.');
    } else if(e.error === 'not-allowed' || e.error === 'service-not-allowed'){
      showToast('Necesitas dar permiso de micrófono para usar el comando por voz.');
    } else if(e.error !== 'aborted'){
      showToast('No se pudo reconocer el audio. Intenta de nuevo.');
    }
  };
  voiceRecognizer.onend = () => {
    clearTimeout(voiceAbriendoT); clearTimeout(voiceGuardiaT);
    if(voiceSilenceTimer) clearTimeout(voiceSilenceTimer);
    if(!voiceListening && !voiceFinalBuffer && !voiceInterim){ updateVoiceFabUI(); return; }   // ya se cerró (vigilante)
    voiceListening = false;
    updateVoiceFabUI();
    const transcript = (voiceFinalBuffer.trim() || voiceInterim).trim();
    voiceFinalBuffer = ''; voiceInterim = '';
    if(transcript) handleVoiceTranscript(transcript);
  };
  return voiceRecognizer;
}

function startVoiceCommand(conIA){
  if(!micEnabled) return;
  voiceModoIA = !!conIA;
  if(data.products.length === 0){
    showToast('Primero agrega productos en la pestaña Productos.');
    return;
  }
  const rec = ensureVoiceRecognizer();
  if(!rec){
    showToast('Tu navegador no soporta comandos por voz. Prueba con Chrome en Android.');
    return;
  }
  // Otra escucha que quedó trabada (más de 30 s) no bloquea el botón: se suelta.
  if(voiceProductListening && Date.now() - (window.__vozProductoDesde || 0) > 30000) voiceProductListening = false;
  if(voiceListening && voiceTocado && Date.now() - voiceTocado > 35000) voiceForzarFin();
  if(voiceListening || voiceProductListening) return;
  rec.mantener = true; voiceParandoDesde = 0;
  // Si ORDEVA está hablando se calla: el micrófono abre YA, sin esperar a que termine (y no se oye a sí misma).
  try{ if(window.speechSynthesis && (speechSynthesis.speaking || speechSynthesis.pending)) speechSynthesis.cancel(); }catch(e){}
  // «Hola ORDEVA» le pasa el micrófono que ya tiene abierto (en la APK no se cierra y se vuelve a abrir).
  try{ window.ventoHola && window.ventoHola.soltar(true); }catch(e){}
  try{
    voiceListening = true; voiceAvisado = false; voiceTocado = Date.now();
    voiceFinalBuffer = ''; voiceInterim = '';
    updateVoiceFabUI();                                              // el botón cambia a «escuchando» al instante
    try{ navigator.vibrate && navigator.vibrate(15); }catch(e){}    // y una vibración corta confirma el toque
    clearTimeout(voiceAbriendoT);
    if(window.VentoAndroid){
      // «Abriendo el micrófono…» solo si de verdad tarda; casi siempre ya está escuchando antes.
      voiceAbriendoT = setTimeout(() => { if(voiceListening && !voiceAvisado) showToast('⏳ Abriendo el micrófono…', 2500); }, VOICE_ABRIENDO_MS);
    } else showToast(conIA ? '🤖 Escuchando con IA… di tu pedido con tus palabras. Toca de nuevo para terminar.' : '🎤 Escuchando… ej: "mesa 1, 5 águilas", "agrega una mesa a nombre de Juan con dos póker", "deshacer". Di "comandos" para ver todos. Toca 🎤 de nuevo para terminar.');
    rec.start();
    scheduleVoiceSilenceStop(VOICE_INITIAL_TIMEOUT_MS);
    clearTimeout(voiceGuardiaT);
    voiceGuardiaT = setTimeout(() => { if(voiceListening) stopVoiceCommand(); }, 35000);   // tope de escucha
  }catch(e){
    clearTimeout(voiceAbriendoT);
    voiceListening = false;
    updateVoiceFabUI();
  }
}

/* Vigilante del micrófono: al parar, ORDEVA espera que Android avise «terminé». Si ese aviso no llega (el reconocedor del
   celular se trabó), el botón se quedaba en «escuchando» para siempre y tocarlo otra vez no hacía nada. Ahora, si en
   2,5 s no terminó (o se toca otra vez), se cierra a la fuerza y se anota lo que ya se oyó. Y nunca escucha más de 35 s. */
let voiceGuardiaT = null, voiceParandoDesde = 0;
function voiceForzarFin(){
  clearTimeout(voiceGuardiaT); voiceParandoDesde = 0;
  if(!voiceListening) return;
  try{ voiceRecognizer && voiceRecognizer.abort && voiceRecognizer.abort(); }catch(e){}
  if(!voiceListening) return;                         // abort ya avisó «terminé» y se anotó
  try{ voiceRecognizer && voiceRecognizer.onend && voiceRecognizer.onend({}); }catch(e){ voiceListening = false; updateVoiceFabUI(); }
}
function stopVoiceCommand(){
  if(!voiceListening) return;
  // Segundo toque mientras se está cerrando: se cierra ya.
  if(voiceParandoDesde && Date.now() - voiceParandoDesde > 600){ voiceForzarFin(); return; }
  voiceParandoDesde = Date.now();
  try{ if(voiceRecognizer) voiceRecognizer.stop(); }catch(e){}
  clearTimeout(voiceGuardiaT);
  voiceGuardiaT = setTimeout(voiceForzarFin, 2500);
}
window.ventoMicForzarFin = voiceForzarFin;

/* ---------- Manos libres: «Hola ORDEVA» ----------
   Con la app abierta, ORDEVA escucha sola: al oír «Hola ORDEVA» (u «Oye ORDEVA», «ORDEVA, …») hace lo que se le
   pide, igual que el botón del micrófono. Después de cada orden sigue atenta unos segundos, así se puede seguir
   hablando sin repetir «Hola ORDEVA». Se pausa mientras ORDEVA habla, mientras se usa el botón del micrófono, con la
   pantalla de entrada abierta o la app en segundo plano. Se prende y apaga en Ajustes (o diciendo «ORDEVA, deja de escuchar»). */
(function(){
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
  const KEY = 'vento-hola', ATENTO_MS = 9000;
  // Con saludo («hola/oye … vento») se aceptan los errores típicos del reconocedor; sin saludo solo «ORDEVA»/«Bento» al inicio.
  const WAKE = /^\s*(?:(?:hola|oye|ok|okey|ey|hey|ay)[\s,]+(?:vento|bento|viento|ventó|bentó|evento|ordeva|hordeva|or deva)|vento|bento|ordeva|hordeva)\b[\s,.:;!¡¿?-]*/i;
  let rec = null, corriendo = false, desde = 0, hechos = 0, atentoHasta = 0, fallos = 0, timer = null, gesto = !!window.VentoAndroid, ocupado = false;
  // Apagado de fábrica: escuchar todo el tiempo hacía que el micrófono se prendiera y apagara solo (y al tocar 🎤 se
  // perdía el comienzo de la frase). Quien lo quiera lo prende en ⚙️ Ajustes.
  const prendido = () => { try{ return localStorage.getItem(KEY) === '1'; }catch(e){ return false; } };
  const A = window.VentoAndroid;
  function silencio(si){ try{ A && A.vozSilencio && A.vozSilencio(!!si); }catch(e){} }
  function puede(){
    if(!Ctor || !prendido() || !gesto || ocupado || document.hidden) return false;
    if(typeof micEnabled !== 'undefined' && !micEnabled) return false;
    if(typeof voiceListening !== 'undefined' && voiceListening) return false;
    // Otro micrófono de ORDEVA está escuchando («Producto por voz», el asistente o la libreta): no se le quita.
    try{ if(voiceProductListening) return false; }catch(e){}
    try{ if(asisRecOn) return false; }catch(e){}
    if(window.__lbMicOn) return false;
    try{ if(window.speechSynthesis && window.speechSynthesis.speaking) return false; }catch(e){}
    try{ if(typeof authUser !== 'undefined' && !authUser) return false; }catch(e){}
    const au = document.getElementById('authOverlay'); if(au && !au.hidden) return false;
    try{ if(!data || !data.products || !data.products.length) return false; }catch(e){ return false; }
    return true;
  }
  function pintar(){
    const w = document.getElementById('voiceFabWrap'); if(!w) return;
    w.classList.toggle('hola-on', prendido() && !!Ctor);
    w.classList.toggle('hola-atento', Date.now() < atentoHasta);
    const t = document.getElementById('holaVentoToggle'); if(t) t.checked = prendido();
  }
  function tono(){
    try{ navigator.vibrate && navigator.vibrate([30, 40, 30]); }catch(e){}
    try{ const C = window.AudioContext || window.webkitAudioContext; if(!C) return; const c = tono.c || (tono.c = new C()); const o = c.createOscillator(), g = c.createGain();
      o.frequency.setValueAtTime(660, c.currentTime); o.frequency.linearRampToValueAtTime(990, c.currentTime + 0.12); g.gain.setValueAtTime(0.08, c.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.22);
      o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + 0.24); }catch(e){}
  }
  function crear(){
    const r = new Ctor(); r.lang = 'es-CO'; r.continuous = true; r.interimResults = true; r.maxAlternatives = 5;
    r.onstart = () => { fallos = 0; };
    r.onresult = (e) => {
      for(let i = hechos; i < e.results.length; i++){
        const res = e.results[i]; if(!res || !res.isFinal) continue;
        hechos = i + 1; oir(res);
      }
    };
    r.onerror = (e) => {
      const er = e && e.error;
      if(er === 'not-allowed' || er === 'service-not-allowed'){ apagar(); showToast('🎙️ Para usar «Hola ORDEVA» permite el micrófono y vuelve a prenderlo en ⚙️ Ajustes.', 6000); return; }
      if(er !== 'no-speech' && er !== 'aborted') fallos++;
    };
    r.onend = () => { corriendo = false; silencio(false); seguir(fallos > 3 ? 5000 : 300); };
    return r;
  }
  function seguir(ms){ clearTimeout(timer); timer = setTimeout(arrancar, ms); }
  function arrancar(){
    clearTimeout(timer); pintar();
    if(!prendido()) return;
    if(corriendo && Date.now() - desde > 70000){ corriendo = false; try{ rec && rec.abort(); }catch(e){} }  // perro guardián
    if(corriendo) return;
    if(!puede()){ seguir(1500); return; }
    rec = rec || crear(); hechos = 0; corriendo = true; desde = Date.now(); silencio(true);
    try{ rec.start(); }catch(e){ corriendo = false; silencio(false); seguir(2000); }
  }
  // paraOtro: lo pide el botón 🎤. En la APK se le PASA la escucha abierta (rec.ceder) en vez de cerrarla y abrir otra.
  function soltar(paraOtro){ clearTimeout(timer); if(corriendo){ corriendo = false; try{ if(rec){ if(paraOtro && rec.ceder) rec.ceder(); else rec.abort(); } }catch(e){} } silencio(false); }
  function oir(res){
    const alts = []; for(let k = 0; k < res.length; k++) alts.push(String(res[k].transcript || ''));
    let cmd = null;
    for(const a of alts){ const m = a.match(WAKE); if(m){ cmd = a.slice(m[0].length).trim(); break; } }
    if(cmd === null){
      if(Date.now() >= atentoHasta) return;                      // conversación de fondo: no es para ORDEVA
      cmd = (typeof pickBestVoiceAlternative === 'function' ? pickBestVoiceAlternative(res) : alts[0]).trim();
      if(!cmd) return;
    }
    atentoHasta = Date.now() + ATENTO_MS; pintar(); setTimeout(pintar, ATENTO_MS + 50);
    if(!cmd){ tono(); showToast('🟣 Te escucho…', 2500); return; }
    if(/\b(deja de escuchar|apaga(te)? (el )?(manos libres|hola vento)|desactiva(te)? (el )?(manos libres|hola vento)|no escuches)\b/i.test(cmd)){ apagar(); showToast('🔕 «Hola ORDEVA» apagado. Préndelo en ⚙️ Ajustes cuando quieras.', 5000); return; }
    // Se suelta el micrófono mientras se hace la orden (y mientras ORDEVA responde en voz alta), luego vuelve a escuchar.
    ocupado = true; soltar();
    Promise.resolve().then(() => handleVoiceTranscript(cmd)).catch(() => {}).then(() => {
      setTimeout(() => { ocupado = false; atentoHasta = Date.now() + ATENTO_MS; pintar(); setTimeout(pintar, ATENTO_MS + 50); arrancar(); }, 500);
    });
  }
  function prender(){ try{ localStorage.setItem(KEY, '1'); }catch(e){} gesto = true; arrancar(); }
  function apagar(){ try{ localStorage.setItem(KEY, '0'); }catch(e){} soltar(); atentoHasta = 0; pintar(); }
  window.ventoHola = { prender, apagar, soltar, arrancar, activo: prendido, estado: () => ({ prendido: prendido(), corriendo, atento: Date.now() < atentoHasta }) };
  if(!Ctor) return;
  // En el navegador el micrófono solo se puede abrir después de tocar la pantalla una vez.
  ['pointerdown', 'keydown', 'touchstart'].forEach(ev => document.addEventListener(ev, () => { if(!gesto){ gesto = true; seguir(400); } }, { capture: true, passive: true }));
  document.addEventListener('visibilitychange', () => { if(document.hidden) soltar(); else seguir(500); });
  setTimeout(() => { pintar(); arrancar(); }, 2500);
})();

const voiceFabWrap = document.getElementById('voiceFabWrap');
const voiceFabTab = document.getElementById('voiceFabTab');
const micEnabledToggle = document.getElementById('micEnabledToggle');
(function(){ const t = document.getElementById('holaVentoToggle'); if(!t) return; try{ t.checked = localStorage.getItem('vento-hola') === '1'; }catch(e){} t.addEventListener('change', () => { if(!window.ventoHola) return; if(t.checked){ window.ventoHola.prender(); showToast('🟣 «Hola ORDEVA» prendido: di «Hola ORDEVA» y tu pedido.', 5000); } else window.ventoHola.apagar(); }); })();
if('speechSynthesis' in window){ window.speechSynthesis.onvoiceschanged = () => {}; }
let micEnabled = true;
let voiceFabWasHidden = false; // hidden state via the ✕ button, remembered while mic is disabled from settings

function setVoiceFabHidden(hidden, persist){
  voiceFabWasHidden = hidden;
  if(micEnabled){
    voiceFabWrap.style.display = hidden ? 'none' : '';
    voiceFabTab.classList.toggle('show', hidden);
  }
  if(persist) storageSet('voice-fab-hidden', hidden ? '1' : '0');
}

async function loadVoiceFabPref(){
  try{
    const res = await storageGet('voice-fab-hidden');
    setVoiceFabHidden(!!(res && res.value === '1'), false);
  }catch(e){}
}

function applyMicEnabled(enabled, persist){
  micEnabled = enabled;
  if(micEnabledToggle) micEnabledToggle.checked = enabled;
  if(!enabled){
    voiceFabWrap.style.display = 'none';
    voiceFabTab.classList.remove('show');
    if(voiceListening){
      if(voiceSilenceTimer) clearTimeout(voiceSilenceTimer);
      voiceFinalBuffer = '';
      try{ voiceRecognizer && voiceRecognizer.abort(); }catch(e){}
      voiceListening = false;
      updateVoiceFabUI();
    }
  }else{
    voiceFabWrap.style.display = voiceFabWasHidden ? 'none' : '';
    voiceFabTab.classList.toggle('show', voiceFabWasHidden);
  }
  if(persist) storageSet('voice-mic-enabled', enabled ? '1' : '0');
}

async function loadMicEnabledPref(){
  try{
    const res = await storageGet('voice-mic-enabled');
    applyMicEnabled(!(res && res.value === '0'), false);
  }catch(e){}
}

if(micEnabledToggle){
  micEnabledToggle.addEventListener('change', () => {
    applyMicEnabled(micEnabledToggle.checked, true);
  });
}

document.getElementById('voiceFabCloseBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  setVoiceFabHidden(true, true);
});
voiceFabTab.addEventListener('click', () => setVoiceFabHidden(false, true));
loadVoiceFabPref();
loadMicEnabledPref();

/* ---------- Botón flotante: arrastrar por toda la pantalla ---------- */
function bottomBarHeight(){
  const tb = document.getElementById('tabbar');
  return (tb && getComputedStyle(tb).position === 'fixed') ? tb.offsetHeight + 8 : 0;
}
function clampFabPosition(left, top){
  // Si el botón todavía no se ha dibujado (offsetWidth/offsetHeight en 0), se usa su
  // tamaño real (56px) en vez de 0 — si no, el límite quedaba mal calculado y el
  // botón podía terminar colgando fuera de la pantalla o encima de otra cosa.
  const w = voiceFabWrap.offsetWidth || 56, h = voiceFabWrap.offsetHeight || 56;
  const maxLeft = Math.max(window.innerWidth - w, 0);
  const maxTop = Math.max(window.innerHeight - h - bottomBarHeight(), 0);
  return {
    left: Math.min(Math.max(left, 0), maxLeft),
    top: Math.min(Math.max(top, 0), maxTop)
  };
}

function placeFabAt(left, top){
  const pos = clampFabPosition(left, top);
  voiceFabWrap.style.left = pos.left + 'px';
  voiceFabWrap.style.top = pos.top + 'px';
  voiceFabWrap.style.right = 'auto';
  voiceFabWrap.style.bottom = 'auto';
}

var FAB_FIJO = false;   // v1.19.2: se puede mover otra vez (arrastre suave); ya nada lo mueve solo
async function loadVoiceFabPos(){
  if(FAB_FIJO){ try{ voiceFabWrap.style.left = voiceFabWrap.style.top = voiceFabWrap.style.right = voiceFabWrap.style.bottom = voiceFabWrap.style.transform = ''; voiceFabWrap.classList.remove('izq', 'snap', 'dragging'); await storageSet('voice-fab-pos', ''); }catch(e){} return; }
  try{
    const res = await storageGet('voice-fab-pos');
    if(res && res.value){
      const pos = JSON.parse(res.value);
      // Si la posición guardada no tiene ningún sentido para la pantalla de
      // ahora (por ejemplo, quedó de una pantalla mucho más grande, el
      // celular cambió de orientación, o algo la dejó con un número raro),
      // se ignora y el botón vuelve a su lugar de siempre en vez de
      // quedar "perdido" o encimado con otra cosa — así nunca se ve loco.
      const cabeEnPantalla = typeof pos.left === 'number' && typeof pos.top === 'number' &&
        isFinite(pos.left) && isFinite(pos.top) &&
        pos.left >= -10 && pos.top >= -10 &&
        pos.left <= window.innerWidth - 20 && pos.top <= window.innerHeight - 20;
      if(cabeEnPantalla){
        placeFabAt(pos.left, pos.top);
        voiceFabWrap.classList.toggle('izq', pos.left + 28 < window.innerWidth / 2);
      } else {
        try{ await storageSet('voice-fab-pos', ''); }catch(e){}
      }
    }
  }catch(e){}
}
loadVoiceFabPos();

/* Arrastre del micrófono, rehecho para que sea suave en Android:
   - Mientras se arrastra, el botón se mueve con «transform» (lo dibuja la tarjeta gráfica, sin
     recalcular la pantalla): sigue al dedo sin temblar ni ir a saltos.
   - Nunca se sale de la pantalla ni se mete debajo de la barra de abajo.
   - Al soltar se pega al borde más cercano con una animación corta, desde donde quedó (sin brincos).
   - Si la pantalla cambia de alto (la barra del navegador aparece/desaparece al hacer scroll, o el
     teclado), el botón NO se mueve: solo se acomoda si quedara por fuera. Antes se reacomodaba en
     cada cambio y parecía que se deslizaba solo. */
let fabDrag = null;
let fabJustDragged = false;
const FAB_DRAG_THRESHOLD = 8, FAB_M = 12;
function fabLim(w, h){
  return { x0: FAB_M, x1: Math.max(FAB_M, window.innerWidth - w - FAB_M), y0: FAB_M, y1: Math.max(FAB_M, window.innerHeight - h - bottomBarHeight() - FAB_M) };
}
const fabClamp = (v, a, b) => Math.min(Math.max(v, a), b);

/* v1.19: el micrófono queda FIJO en su esquina (abajo a la derecha, encima de la barra). Arrastrarlo
   causaba que se moviera y se deslizara solo en varios celulares: ahora no se mueve nunca. */
voiceFabWrap.addEventListener('pointerdown', (e) => {
  if(FAB_FIJO) return;
  if(e.button > 0) return;
  if(e.target.closest('#voiceFabCloseBtn')) return;
  if(e.target.closest('#voiceFabHelp')) return;
  const r = voiceFabWrap.getBoundingClientRect();
  fabDrag = { sx: e.clientX, sy: e.clientY, x: r.left, y: r.top, w: r.width || 56, h: r.height || 56, tx: 0, ty: 0, moved: false, pointerId: e.pointerId, raf: 0 };
  // La captura del dedo se pide SOLO cuando de verdad empieza a arrastrar: si se pedía desde el
  // primer toque, el «click» le llegaba al contenedor y no al micrófono.
});

window.addEventListener('pointermove', (e) => {
  if(!fabDrag || e.pointerId !== fabDrag.pointerId) return;
  const dx = e.clientX - fabDrag.sx, dy = e.clientY - fabDrag.sy;
  if(!fabDrag.moved && Math.hypot(dx, dy) < FAB_DRAG_THRESHOLD) return;
  e.preventDefault();
  if(!fabDrag.moved){
    fabDrag.moved = true;
    try{ voiceFabWrap.setPointerCapture(fabDrag.pointerId); }catch(err){}
    voiceFabWrap.classList.remove('snap');
    // Se fija exactamente donde está (left/top) y desde ahí se mueve con transform.
    voiceFabWrap.style.left = fabDrag.x + 'px'; voiceFabWrap.style.top = fabDrag.y + 'px';
    voiceFabWrap.style.right = 'auto'; voiceFabWrap.style.bottom = 'auto';
    voiceFabWrap.classList.add('dragging');
  }
  const L = fabLim(fabDrag.w, fabDrag.h);
  fabDrag.tx = fabClamp(fabDrag.x + dx, L.x0, L.x1) - fabDrag.x;
  fabDrag.ty = fabClamp(fabDrag.y + dy, L.y0, L.y1) - fabDrag.y;
  if(!fabDrag.raf) fabDrag.raf = requestAnimationFrame(() => {
    if(!fabDrag) return; fabDrag.raf = 0;
    voiceFabWrap.style.transform = 'translate3d(' + fabDrag.tx + 'px,' + fabDrag.ty + 'px,0)';
  });
}, { passive: false });

// Al soltar: queda donde se soltó y se desliza corto hasta el borde más cercano.
function fabPegarAlBorde(){
  const w = voiceFabWrap.offsetWidth || 56;
  const izq = voiceFabWrap.offsetLeft + w / 2 < window.innerWidth / 2;
  const L = fabLim(w, voiceFabWrap.offsetHeight || 56);
  voiceFabWrap.classList.toggle('izq', izq);
  voiceFabWrap.classList.add('snap');
  voiceFabWrap.style.left = (izq ? L.x0 : L.x1) + 'px';
  voiceFabWrap.style.top = fabClamp(voiceFabWrap.offsetTop, L.y0, L.y1) + 'px';
  setTimeout(() => voiceFabWrap.classList.remove('snap'), 280);
}

function endFabDrag(e){
  if(!fabDrag || (e && e.pointerId !== undefined && e.pointerId !== fabDrag.pointerId)) return;
  const d = fabDrag; fabDrag = null;
  if(d.raf) cancelAnimationFrame(d.raf);
  try{ voiceFabWrap.releasePointerCapture(d.pointerId); }catch(err){}
  if(!d.moved) return;
  // Evita que al soltar se active el micrófono (se apaga solo enseguida, por si no llega ningún «click»).
  fabJustDragged = true;
  setTimeout(() => { fabJustDragged = false; }, 350);
  // El transform se pasa a left/top en el mismo cuadro: no hay salto.
  voiceFabWrap.style.left = (d.x + d.tx) + 'px'; voiceFabWrap.style.top = (d.y + d.ty) + 'px';
  voiceFabWrap.style.transform = '';
  voiceFabWrap.classList.remove('dragging');
  void voiceFabWrap.offsetWidth;                        // el navegador toma la posición de partida
  requestAnimationFrame(() => {
    fabPegarAlBorde();
    const pos = { left: parseFloat(voiceFabWrap.style.left) || voiceFabWrap.offsetLeft, top: parseFloat(voiceFabWrap.style.top) || voiceFabWrap.offsetTop };
    storageSet('voice-fab-pos', JSON.stringify(pos));
  });
}
window.addEventListener('pointerup', endFabDrag);
window.addEventListener('pointercancel', endFabDrag);

// Solo se acomoda si la pantalla cambió de ancho (girar el celular) o si el botón quedaría por fuera.
let fabAncho = window.innerWidth;
window.addEventListener('resize', () => {
  if(fabDrag || !voiceFabWrap.style.left || voiceFabWrap.style.left === 'auto') return;
  const w = voiceFabWrap.offsetWidth || 56, h = voiceFabWrap.offsetHeight || 56, L = fabLim(w, h);
  const top = voiceFabWrap.offsetTop, cambioAncho = window.innerWidth !== fabAncho;
  fabAncho = window.innerWidth;
  if(!cambioAncho && top >= L.y0 && top <= L.y1) return;
  voiceFabWrap.style.left = (voiceFabWrap.classList.contains('izq') ? L.x0 : L.x1) + 'px';
  voiceFabWrap.style.top = fabClamp(top, L.y0, L.y1) + 'px';
});
// Si el botón quedó en un lugar incómodo, Ajustes → «Devolver a su lugar» lo regresa a su esquina.
function resetVoiceFabPos(){
  voiceFabWrap.style.left = voiceFabWrap.style.top = voiceFabWrap.style.right = voiceFabWrap.style.bottom = '';
  voiceFabWrap.classList.remove('izq');
  try{ storageSet('voice-fab-pos', ''); }catch(e){}
}
window.resetVoiceFabPos = resetVoiceFabPos;
/* Vigilante del micrófono: si está activado pero no se ve, se arregla solo.
   - Quedó por fuera de la pantalla o debajo de la barra de abajo (posición guardada de otra pantalla,
     teclado abierto, celular girado) → vuelve a su esquina.
   - Una ventana quedó marcada «abierta» pero ya no se ve (por ejemplo, se cerró a medias): eso
     escondía el micrófono por completo (se oculta mientras hay una ventana encima). Esa marca se limpia. */
function micVigilar(){
  try{
    if(!micEnabled || voiceFabWasHidden || fabDrag) return;
    // Solo se limpia si lleva más de 4 s invisible (así no se toca una ventana que se está abriendo con animación).
    document.querySelectorAll('.overlay.show:not(#overlay)').forEach(o => {
      const cs = getComputedStyle(o), r = o.getBoundingClientRect();
      const invisible = cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0 || r.width < 2 || r.height < 2;
      if(!invisible){ delete o.dataset.invDesde; return; }
      if(!o.dataset.invDesde) o.dataset.invDesde = String(Date.now());
      else if(Date.now() - Number(o.dataset.invDesde) > 4000){ o.classList.remove('show'); delete o.dataset.invDesde; }
    });
    if(document.querySelector('.overlay.show:not(#overlay)')) return;   // hay una ventana de verdad abierta: ahí sí se esconde
    if(voiceFabWrap.style.display === 'none') voiceFabWrap.style.display = '';
    // Solo si quedó DE VERDAD fuera de la pantalla (otra pantalla, celular girado) vuelve a su esquina.
    // Nada más lo mueve: antes también se reacomodaba cuando «parecía» tapado y eso lo hacía moverse solo.
    const r = voiceFabWrap.getBoundingClientRect();
    const fuera = r.width > 0 && (r.right < 24 || r.left > window.innerWidth - 24 || r.bottom < 24 || r.top > window.innerHeight - 24);
    if(fuera && !(voiceFabWrap.classList.contains('dragging'))){ voiceFabWrap.style.transform = ''; resetVoiceFabPos(); }
  }catch(e){}
}
setInterval(micVigilar, 2000);
window.addEventListener('resize', () => setTimeout(micVigilar, 300));
document.addEventListener('visibilitychange', () => { if(!document.hidden) setTimeout(micVigilar, 300); });
setTimeout(micVigilar, 1500);
{ const rb = document.getElementById('voiceFabResetBtn'); if(rb) rb.addEventListener('click', () => { resetVoiceFabPos(); showToast('✅ El botón del micrófono volvió a su lugar.'); }); }

document.getElementById('voiceFab').addEventListener('click', () => {
  if(fabJustDragged){ fabJustDragged = false; return; }
  if(voiceListening){ stopVoiceCommand(); return; }
  startVoiceCommand(false);
});
document.getElementById('voiceFabAI').addEventListener('click', () => {
  if(fabJustDragged){ fabJustDragged = false; return; }
  if(voiceListening){ stopVoiceCommand(); return; }
  if(!hasAIKey()){ showToast('⚠️ Conecta la IA primero (⚙️ Configurar IA).'); try{ openAIConfigDialog(); }catch(e){} return; }
  startVoiceCommand(true);
});
document.getElementById('voiceFabHelp').addEventListener('click', () => { if(fabJustDragged){ fabJustDragged = false; return; } voiceAyuda(); });
function voiceAIBtnSync(){ const b = document.getElementById('voiceFabAI'); if(b) b.hidden = !voiceAiOn(); }

/* ---------- Navigation ---------- */
document.querySelectorAll('nav button').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('nav button').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('section').forEach(s=>s.classList.remove('active'));
    const vista = VISTA_UNIDA[btn.dataset.view] || btn.dataset.view;
    document.getElementById('view-' + vista).classList.add('active');
    if(vista === 'inventario') renderInventario();
    if(btn.dataset.view === 'historial') renderHistorial();
    if(btn.dataset.view === 'inventario') renderInventario();
    if(btn.dataset.view === 'carta') renderCarta();
    if(btn.dataset.view === 'estadisticas') renderStats();
    if(btn.dataset.view === 'contabilidad' && typeof renderConta === 'function') renderConta();
    if(btn.dataset.view === 'cocina') renderCocina();
  });
});

/* ---------- Menú "Más" (celular) y estado de la barra de abajo ---------- */
// Productos e inventario quedaron en una sola pantalla: cualquier atajo a «productos» abre esa.
const VISTA_UNIDA = { productos: 'inventario' };
const navMoreSheet = document.getElementById('navMoreSheet');
let navCurrentView = 'mesas';
function syncNavMore(){
  const active = document.querySelector('nav button.active');
  const view = active ? active.dataset.view : '';
  document.getElementById('navMoreBtn').classList.toggle('active', !!(active && active.classList.contains('nav-extra')));
  navMoreSheet.querySelectorAll('.more-tile[data-go]').forEach(t => t.classList.toggle('active', t.dataset.go === view));
}
document.querySelectorAll('nav button').forEach(btn => btn.addEventListener('click', () => {
  const view = btn.dataset.view;
  // Con la barra abajo se puede cambiar de sección estando a mitad de página:
  // la nueva sección arranca desde arriba, y Ajustes vuelve a su menú de categorías.
  if(view !== navCurrentView){
    window.scrollTo({ top: 0 });
    if(view === 'ajustes' && typeof volverACategoriasAjustes === 'function') volverACategoriasAjustes();
  }
  navCurrentView = view;
  navMoreSheet.classList.remove('show');
  syncNavMore();
}));
document.getElementById('navMoreBtn').addEventListener('click', () => { syncNavMore(); navMoreSheet.classList.add('show'); });
// Cerrar sesión: guarda todo, pregunta y vuelve a pedir usuario y contraseña. Los datos del negocio no se borran.
async function cerrarSesion(){
  const ok = await showConfirm({ title: '¿Cerrar sesión?', message: 'Tus datos quedan guardados. Para volver a entrar te pedirá usuario y contraseña (así puede entrar otra persona con su propio usuario).', confirmText: 'Sí, cerrar sesión', icon: '🚪' });
  if(!ok) return;
  try{ saveData(); }catch(e){}
  localStorage.removeItem(AUTH_SESSION_KEY);
  location.reload();
}
window.cerrarSesion = cerrarSesion;
// «Cerrar sesión» desde los avisos de la suscripción (cancelada, vencida, sin pagar): sin preguntar otra vez (el botón
// ya lo dice), guarda todo, cierra también la sesión de la cuenta de ORDEVA en este celular y vuelve a la entrada,
// donde se puede entrar con otra cuenta. Los datos no se borran.
window.ventoSalir = async function(){
  try{ saveData(); }catch(e){}
  try{ if(window.ventoNube && window.ventoNube.salir) await Promise.race([window.ventoNube.salir(), new Promise(r => setTimeout(r, 4000))]); }catch(e){}
  try{ localStorage.removeItem(AUTH_SESSION_KEY); }catch(e){}
  location.reload();
};
navMoreSheet.addEventListener('click', e => {
  if(e.target === navMoreSheet){ navMoreSheet.classList.remove('show'); return; }
  const tile = e.target.closest('.more-tile[data-go]');
  if(!tile) return;
  navMoreSheet.classList.remove('show');
  if(tile.dataset.go === 'ia'){ document.getElementById('asisFab').click(); return; }
  if(tile.dataset.go === 'libreta'){ if(window.libretaAbrir) window.libretaAbrir(); return; }
  if(tile.dataset.go === 'pagos'){ if(window.pagosAbrirPanel) window.pagosAbrirPanel(); return; }
  if(tile.dataset.go === 'calculadora'){ if(window.calculadoraAbrir) window.calculadoraAbrir(); return; }
  if(tile.dataset.go === 'plan'){ try{ subPaywall(''); }catch(e){} return; }   // menú de suscripción siempre a mano (no solo desde la barra)
  if(tile.dataset.go === 'salir'){ cerrarSesion(); return; }
  if(tile.dataset.go === 'reportar'){ if(window.ventoReportarProblema) window.ventoReportarProblema(); else showToast('Escríbenos en Ajustes → Guía y soporte.'); return; }
  const b = document.querySelector('nav button[data-view="' + tile.dataset.go + '"]');
  if(b) b.click();
});
document.addEventListener('keydown', e => { if(e.key === 'Escape') navMoreSheet.classList.remove('show'); });

/* ---------- Business name ---------- */
const brandInput = document.getElementById('brandName');
brandInput.addEventListener('blur', ()=>{
  data.businessName = brandInput.value.trim() || 'Cervecería';
  brandInput.value = data.businessName;
  saveData();
});

/* ---------- Table count ---------- */
// Se configura una sola vez, así que queda escondido detrás de un botón.
document.getElementById('tableCountToggle').addEventListener('click', ()=>{
  const row = document.getElementById('tableCountRow');
  row.hidden = !row.hidden;
  if(!row.hidden) document.getElementById('tableCountInput').focus();
});
// Mesas o Cuentas (solo comida y bebida). Se recarga para que todos los textos cambien de palabra.
// Nombre de la unidad de atención (Ajustes → Cuenta y negocio). Se recarga para que todos los textos ya
// escritos cambien de palabra (igual que al elegir Mesas o Cuentas).
function iniUnidadNombre(){
  const sel = document.getElementById('unidadSel'); if(!sel || sel.dataset.ok) return; sel.dataset.ok = '1';
  const otro = document.getElementById('unidadOtro'), sg = document.getElementById('unidadSg'), pl = document.getElementById('unidadPl');
  const pintar = () => {
    const tipo = (ESPACIOS[(data && data.businessType) || ''] || ['Mesa', 'Mesas'])[1];
    sel.innerHTML = '<option value="">Según el tipo de negocio (' + tipo + ')</option>' + UNIDAD_PRESETS.map((x, i) => '<option value="' + i + '">' + x[1] + '</option>').join('') + '<option value="otro">Otro nombre…</option>';
    const u = data && data.unidad;
    if(!u || !u.sg){ sel.value = ''; otro.hidden = true; return; }
    const i = UNIDAD_PRESETS.findIndex(x => x[0] === u.sg && x[1] === u.pl);
    if(i >= 0){ sel.value = String(i); otro.hidden = true; } else { sel.value = 'otro'; otro.hidden = false; sg.value = u.sg; pl.value = u.pl || ''; }
  };
  const aplicar = u => {
    if(u) data.unidad = u; else delete data.unidad;
    if(u) delete data.atencion;
    saveData();
    showToast('✅ Ahora se llaman «' + getServiceUnitNamePlural() + '». Actualizo la pantalla…');
    setTimeout(() => location.reload(), 900);
  };
  sel.onchange = () => {
    if(sel.value === 'otro'){ otro.hidden = false; sg.focus(); return; }
    otro.hidden = true;
    if(sel.value === '') return aplicar(null);
    const x = UNIDAD_PRESETS[+sel.value]; aplicar({ sg: x[0], pl: x[1], ic: x[2], g: x[3] });
  };
  const libre = () => { const a = sg.value.replace(/[<>"]/g, '').trim().slice(0, 24), b = pl.value.replace(/[<>"]/g, '').trim().slice(0, 26);
    if(a) aplicar({ sg: a, pl: b || (/[aeiouáéó]$/i.test(a) ? a + 's' : a + 'es'), ic: '📍', g: 'm' }); };
  sg.onchange = () => { if(pl.value.trim()) libre(); }; pl.onchange = libre;
  pintar();
}
document.addEventListener('click', e => { if(e.target.closest('.ajustes-cat[data-cat="negocio"]')) setTimeout(iniUnidadNombre, 60); });
setTimeout(() => { try{ iniUnidadNombre(); }catch(e){} }, 3000);
function pintarAtencion(){
  const box = document.getElementById('atencionSel'); if(!box) return;
  box.hidden = !puedeElegirMesas();
  const actual = espacio()[0] === 'Cuenta' ? 'cuenta' : 'mesa';
  box.querySelectorAll('[data-at]').forEach(b => b.classList.toggle('on', b.dataset.at === actual));
}
document.getElementById('atencionSel').addEventListener('click', e => {
  const b = e.target.closest('[data-at]'); if(!b || !puedeElegirMesas()) return;
  const actual = espacio()[0] === 'Cuenta' ? 'cuenta' : 'mesa'; if(b.dataset.at === actual) return;
  data.atencion = b.dataset.at; saveData();
  showToast(b.dataset.at === 'cuenta' ? '🧾 Listo: ahora atiendes por Cuentas (las cuentas abiertas no cambian).' : '🍽️ Listo: ahora atiendes por Mesas (las cuentas abiertas no cambian).');
  setTimeout(() => location.reload(), 900);
});
document.getElementById('tableCountToggle').addEventListener('click', pintarAtencion);
document.getElementById('applyTableCount').addEventListener('click', ()=>{
  const n = parseInt(document.getElementById('tableCountInput').value, 10);
  if(!n || n < 1) return;
  const current = Object.keys(data.tables).map(Number);
  const toRemove = current.filter(id => id > n);
  const withOpenTabs = toRemove.filter(id => data.tables[id].items && data.tables[id].items.length);
  if(withOpenTabs.length){
    if(!confirm('Las mesas ' + withOpenTabs.join(', ') + ' tienen cuentas abiertas. ¿Reducir igual las mesas? Esas cuentas pasan al historial (lo no pagado, como deuda).')) return;
  }
  toRemove.forEach(id => { try{ closeTableToHistory(id); }catch(e){} delete data.tables[id]; });
  for(let i=1;i<=n;i++){
    if(!data.tables[i]) data.tables[i] = { items: [], people: [] };
  }
  data.tableCount = n;
  saveData();
  renderMesas();
});

/* ---------- Pantalla de cocina (KDS) ----------
   No duplica los datos de las mesas: lee data.tables directamente y usa un
   pequeño "acuse" en localStorage (por mesa, con una firma del pedido) para
   saber qué tickets ya se marcaron como listos, sin tocar la cuenta real.
   También muestra los pedidos que llegan por el QR (pedido.html) o WhatsApp
   y aún no se han despachado a la mesa, reutilizando esa misma cola. */
function kdsSig(id){
  const t = data.tables[id];
  if(!t || !t.items || !t.items.length) return '';
  return t.items.map(it => it.name + '×' + it.qty).join('|');
}
function kdsAckMap(){
  try{ return JSON.parse(localStorage.getItem('vito_kds_ack')) || {}; }catch(e){ return {}; }
}
function kdsSetAck(id, sig){
  const m = kdsAckMap();
  if(sig) m[id] = sig; else delete m[id];
  try{ localStorage.setItem('vito_kds_ack', JSON.stringify(m)); }catch(e){}
}
function kdsPend(){
  try{ return JSON.parse(localStorage.getItem('vito_pedidos_pend')) || []; }catch(e){ return []; }
}
function renderCocina(){
  const wrap = document.getElementById('kdsTickets');
  if(!wrap || typeof data === 'undefined' || !data) return;
  const P = window.vitoPedidos, ahora = Date.now();
  const lista = P ? P.lista() : [];
  const activos = lista.filter(p => ['nuevo', 'recibido', 'preparacion', 'listo'].includes(p.estado));
  const SIG = { nuevo: ['✅ Aceptar', 'recibido'], recibido: ['👩‍🍳 En preparación', 'preparacion'], preparacion: ['🔔 Listo', 'listo'], listo: ['🍽️ Entregado', 'entregado'] };
  const min = p => Math.max(0, Math.round((ahora - (p.recibidoEn || p.at)) / 6e4));
  const ticket = p => {
    const tarde = p.estado !== 'listo' && min(p) >= 15;
    return '<div class="kds-ticket e-' + p.estado + (tarde ? ' tarde' : '') + '" data-pid="' + invEsc(p.id) + '">' +
      '<div class="kds-ticket-h">' + invEsc(window.vitoGrupos ? window.vitoGrupos.etiquetaDe(p.mesa) : tableLabel(p.mesa)) + (window.vitoGrupos && window.vitoGrupos.de(p.mesa) ? ' <small>(de ' + invEsc(tableLabel(p.mesa)) + ')</small>' : '') + '</div>' +
      (p.sinCodigo && p.estado === 'nuevo' ? '<div class="kds-nota" style="border-color:#f59e0b">⚠️ Sin el código del QR de la mesa: confirma con la mesa antes de aceptarlo</div>' : '') +
      '<div class="kds-meta"><span>' + (p.origen === 'qr' ? '📱 QR' : p.origen === 'whatsapp' ? '💬 WhatsApp' : '🧑‍🍳 ' + invEsc(String(p.origen || '').replace(/^mesero:/, ''))) + '</span><b>' + (min(p) ? 'hace ' + min(p) + ' min' : 'ahora') + '</b></div>' +
      '<div class="kds-items">' + p.items.map(it => '<div class="kds-item">' + it.qty + '× ' + invEsc(it.name) + (it.ok ? '' : ' ⚠️') + '</div>').join('') + '</div>' +
      (p.nota ? '<div class="kds-nota">📝 ' + invEsc(p.nota) + '</div>' : '') +
      '<div class="kds-act"><button type="button" class="btn-warn" data-e="' + SIG[p.estado][1] + '">' + i18nPut(SIG[p.estado][0]) + '</button>' +
      '<button type="button" class="btn-ghost kds-x" data-e="cancelado" title="Cancelar pedido">✕</button></div></div>';
  };
  const col = (e, titulo) => { const l = activos.filter(p => p.estado === e).sort((x, y) => (x.recibidoEn || x.at) - (y.recibidoEn || y.at));
    return l.length ? '<div class="kds-col-h">' + titulo + ' <i>' + l.length + '</i></div>' + l.map(ticket).join('') : ''; };
  const entregados = lista.filter(p => p.estado === 'entregado' && ahora - (p.hist[p.hist.length - 1] || {}).at < 6 * 36e5).slice(-10).reverse();
  // Lo que se anota a mano en las cuentas sigue visible abajo, como antes.
  const ack = kdsAckMap();
  const tIds = Object.keys(data.tables).map(Number).filter(id => data.tables[id].items && data.tables[id].items.length).sort((a,b)=>a-b);
  const mesas = tIds.map(id => { const t = data.tables[id], sig = kdsSig(id), isAck = ack[id] === sig;
    return '<div class="kds-ticket' + (isAck ? ' kds-ack' : '') + '"><div class="kds-ticket-h">' + invEsc(tableLabel(id)) + '</div><div class="kds-items">' +
      t.items.map(it => '<div class="kds-item">' + it.qty + '× ' + invEsc(it.name) + (it.size ? ' (' + invEsc(it.size) + ')' : '') + '</div>').join('') + '</div>' +
      '<button type="button" class="btn-ghost kds-ack-btn" data-tid="' + id + '">' + (isAck ? i18nPut('↩️ Reabrir') : i18nPut('✅ Visto')) + '</button></div>'; }).join('');
  const html = col('nuevo', '🆕 Por aceptar') + col('recibido', '📥 Recibidos') + col('preparacion', '👩‍🍳 En preparación') + col('listo', '🔔 Listos para entregar');
  wrap.innerHTML = (html || '<div class="kds-empty">' + i18nPut('No hay pedidos pendientes en ' + prepNombre() + '. 🎉') + '</div>') +
    (entregados.length ? '<details class="kds-ent"><summary>🍽️ Entregados hoy (' + entregados.length + ')</summary><div class="kds-grid">' + entregados.map(p => '<div class="kds-ticket kds-ack"><div class="kds-ticket-h">' + invEsc(tableLabel(p.mesa)) + '</div><div class="kds-items">' + p.items.map(i => i.qty + '× ' + invEsc(i.name)).join('<br>') + '</div></div>').join('') + '</div></details>' : '') +
    (mesas ? '<details class="kds-ent"><summary>🧾 Cuentas abiertas (' + tIds.length + ')</summary><div class="kds-grid">' + mesas + '</div></details>' : '');
  const badge = document.getElementById('kdsBadge');
  if(badge){ const n = activos.filter(p => p.estado !== 'listo').length; badge.textContent = n ? String(n) : ''; }
}
const kdsTicketsEl = document.getElementById('kdsTickets');
if(kdsTicketsEl){
  kdsTicketsEl.addEventListener('click', async e => {
    const ackBtn = e.target.closest('.kds-ack-btn');
    if(ackBtn){
      const id = ackBtn.dataset.tid, cur = kdsAckMap();
      if(cur[id] === kdsSig(id)) kdsSetAck(id, null); else kdsSetAck(id, kdsSig(id));
      renderCocina(); return;
    }
    const b = e.target.closest('[data-e]'), tk = e.target.closest('[data-pid]');
    if(!b || !tk || !window.vitoPedidos) return;
    if(b.dataset.e === 'cancelado' && !(await showConfirm({ title: 'Cancelar pedido', message: '¿Cancelar este pedido? Si ya estaba en la cuenta, se descuenta.', confirmText: 'Sí, cancelar', cancelText: 'No', icon: '✕' }))) return;
    window.vitoPedidos.cambiar(tk.dataset.pid, b.dataset.e);
    renderCocina();
  });
}
setInterval(renderCocina, 5000);
setTimeout(renderCocina, 1200);

/* ---------- Calculadoras rápidas (Ajustes) ---------- */
(function(){
  const tabs = document.getElementById('calcTabs');
  if(!tabs) return;
  tabs.addEventListener('click', e => {
    const b = e.target.closest('.calc-tab-btn');
    if(!b) return;
    tabs.querySelectorAll('.calc-tab-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    document.querySelectorAll('.calc-panel').forEach(p => p.classList.remove('active'));
    const panel = document.getElementById('calc' + b.dataset.calc.charAt(0).toUpperCase() + b.dataset.calc.slice(1));
    if(panel) panel.classList.add('active');
  });

  /* Dígito de verificación del NIT (algoritmo oficial DIAN) */
  function nitDv(nitRaw){
    const nit = String(nitRaw || '').replace(/\D/g, '');
    if(!nit) return null;
    const pesos = [3,7,13,17,19,23,29,37,41,43,47,53,59,67,71];
    let suma = 0;
    for(let i = 0; i < nit.length; i++){
      const digito = parseInt(nit[nit.length - 1 - i], 10);
      const peso = pesos[i];
      if(peso === undefined) break;
      suma += digito * peso;
    }
    const resto = suma % 11;
    return (resto === 0 || resto === 1) ? resto : 11 - resto;
  }
  const nitBtn = document.getElementById('calcNitBtn'), nitIn = document.getElementById('calcNitInput'), nitRes = document.getElementById('calcNitResult');
  function runNit(){
    const nit = (nitIn.value || '').replace(/\D/g, '');
    if(!nit){ nitRes.innerHTML = 'Escribe el NIT (sin el dígito de verificación).'; return; }
    const dv = nitDv(nit);
    nitRes.innerHTML = 'NIT: <b>' + nit + '-' + dv + '</b><br>Dígito de verificación: <b>' + dv + '</b>';
  }
  if(nitBtn){ nitBtn.onclick = runNit; nitIn.addEventListener('keydown', e => { if(e.key === 'Enter') runNit(); }); nitIn.addEventListener('input', runNit); }

  /* Descuento */
  const descPrecio = document.getElementById('calcDescPrecio'), descPct = document.getElementById('calcDescPct'), descRes = document.getElementById('calcDescResult');
  function runDesc(){
    const precio = parseFloat(descPrecio.value), pct = parseFloat(descPct.value);
    if(!isFinite(precio) || precio <= 0 || !isFinite(pct) || pct < 0){ descRes.innerHTML = 'Escribe el precio original y el % de descuento.'; return; }
    const ahorro = Math.round(precio * (pct / 100));
    const final = Math.round(precio - ahorro);
    descRes.innerHTML = 'Precio final: <b>$' + final.toLocaleString('es-CO') + '</b><br>Ahorro: $' + ahorro.toLocaleString('es-CO');
  }
  if(descPrecio){ [descPrecio, descPct].forEach(el => el.addEventListener('input', runDesc)); }

  /* Prima de servicios / bonificación proporcional */
  const primaSal = document.getElementById('calcPrimaSalario'), primaDias = document.getElementById('calcPrimaDias'), primaRes = document.getElementById('calcPrimaResult');
  function runPrima(){
    const sal = parseFloat(primaSal.value), dias = parseFloat(primaDias.value);
    if(!isFinite(sal) || sal <= 0 || !isFinite(dias) || dias <= 0){ primaRes.innerHTML = 'Escribe el salario (con auxilio de transporte si aplica) y los días trabajados en el semestre.'; return; }
    const d = Math.min(dias, 180);
    const prima = Math.round((sal * d) / 360);
    primaRes.innerHTML = 'Valor a pagar: <b>$' + prima.toLocaleString('es-CO') + '</b><br>Fórmula: (salario × días) ÷ 360.';
  }
  if(primaSal){ [primaSal, primaDias].forEach(el => el.addEventListener('input', runPrima)); }

  /* Retención en la fuente por ICA */
  const reteValor = document.getElementById('calcReteicaValor'), reteTarifa = document.getElementById('calcReteicaTarifa'), reteRes = document.getElementById('calcReteicaResult');
  function runReteica(){
    const valor = parseFloat(reteValor.value), tarifa = parseFloat(reteTarifa.value);
    if(!isFinite(valor) || valor <= 0 || !isFinite(tarifa) || tarifa < 0){ reteRes.innerHTML = 'Escribe el valor del pago y la tarifa por mil.'; return; }
    const retencion = Math.round(valor * (tarifa / 1000));
    reteRes.innerHTML = 'Retención a practicar: <b>$' + retencion.toLocaleString('es-CO') + '</b><br>Valor neto a pagar: $' + Math.round(valor - retencion).toLocaleString('es-CO');
  }
  if(reteValor){ [reteValor, reteTarifa].forEach(el => el.addEventListener('input', runReteica)); }
})();

/* ---------- Render: Mesas ---------- */
function renderMesasSummary(){
  const el = document.getElementById('mesasSummary');
  if(!el) return;
  const ids = Object.keys(data.tables).map(Number);
  const abiertas = ids.filter(id => (data.tables[id].items || []).length);
  const porCobrar = abiertas.reduce((s, id) => s + tableBalance(id), 0);
  const libres = ids.length - abiertas.length;
  const tr = s => { try{ return i18nPut(s); }catch(e){ return s; } };
  el.innerHTML =
    '<div class="ms-item ms-free"><b>' + libres + '</b><span>' + tr(libres === 1 ? 'libre' : 'libres') + '</span></div>' +
    '<div class="ms-item ms-open"><b>' + abiertas.length + '</b><span>' + tr(abiertas.length === 1 ? 'abierta' : 'abiertas') + '</span></div>' +
    '<div class="ms-item"><b>' + fmt(porCobrar) + '</b><span>' + tr('por cobrar') + '</span></div>';
}
function renderMesas(){
  document.getElementById('tableCountInput').value = data.tableCount;
  renderMesasSummary();
  if(data.tableViewMode === 'map'){
    renderFloorPlan();
  } else {
    renderMesasList();
  }
}

function renderMesasList(){
  const grid = document.getElementById('tableGrid');
  grid.innerHTML = '';
  const ids = Object.keys(data.tables).map(Number).sort((a,b)=>a-b);
  ids.forEach(id=>{
    const t = data.tables[id];
    const total = tableTotal(id);
    const paid = tablePaid(id);
    const balance = tableBalance(id);
    const isOpen = t.items && t.items.length > 0;
    const card = document.createElement('button');
    card.className = 'ticket' + (isOpen ? ' open' : '');
    let subLine = 'Sin cuenta abierta';
    if(isOpen){
      const units = t.items.reduce((s, it) => s + (Number(it.qty) || 0), 0);
      subLine = units + (units===1?' producto':' productos');
      if(paid > 0) subLine += ' · abonado ' + fmt(paid);
      if((t.people || []).length){ try{ const e = mesaEstado(id); if(e.partes > 1) subLine += ' · 👥 ' + e.pagaron + '/' + e.partes + ' pagaron'; }catch(x){} }
    }
    card.innerHTML = `
      <div class="num"><svg class="tk-ic" viewBox="0 0 24 24" aria-hidden="true">${iconoEsp()}</svg>${tableLabel(id)}</div>
      <div class="status ${isOpen ? '' : 'empty'}">${isOpen ? fmt(balance) : 'Vacía'}</div>
      <div class="items-count">${subLine}</div>
      ${window.vitoGrupos && window.vitoGrupos.de(id) ? '<div class="grp-tag">🔗 ' + invEsc(window.vitoGrupos.etiqueta(window.vitoGrupos.de(id))) + ' · ' + fmt(window.vitoGrupos.total(window.vitoGrupos.de(id))) + '</div>' : ''}
    `;
    card.addEventListener('click', ()=> openTableModal(id));
    grid.appendChild(card);
  });
}

/* ---------- Mapa del local: ubicar mesas libremente ---------- */
let layoutEditing = false;

const TABLE_SHAPES = {
  redonda:   { label: 'Mesa redonda',      icon: '☕', class: 'shape-redonda' },
  cuadrada:  { label: 'Mesa cuadrada',     icon: '🍽️', class: 'shape-cuadrada' },
  sombrilla: { label: 'Mesa con sombrilla',icon: '⛱️', class: 'shape-sombrilla' },
  barra:     { label: 'Barra / mostrador', icon: '🍹', class: 'shape-barra' },
  sofa:      { label: 'Sofá / lounge',     icon: '🛋️', class: 'shape-sofa' },
  silla:     { label: 'Silla',             icon: '🪑', class: 'shape-silla' },
  banca:     { label: 'Banca',             icon: '🪑', class: 'shape-banca' },
  banco:     { label: 'Banco',             icon: '🪵', class: 'shape-banco' },
  camara:    { label: 'Cámara',            icon: '📷', class: 'shape-camara' },
  circulo:   { label: 'Círculo',            icon: '⭕', class: 'shape-circulo' },
  caja:      { label: 'Caja / caja registradora', icon: '🧾', class: 'shape-caja' },
  bano:      { label: 'Baño',               icon: '🚻', class: 'shape-bano' },
  entrada:   { label: 'Entrada',            icon: '🚪', class: 'shape-entrada' },
  cocina:    { label: 'Cocina',             icon: '🍳', class: 'shape-cocina' },
  billar:    { label: 'Mesa de billar',     icon: '🎱', class: 'shape-billar' },
  cancha:    { label: 'Cancha',             icon: '⚽', class: 'shape-cancha' },
  consola:   { label: 'Consola / estación', icon: '🎮', class: 'shape-consola' },
  cama:      { label: 'Cama / habitación',  icon: '🛏️', class: 'shape-cama' },
  puesto:    { label: 'Puesto / parqueo',   icon: '🚗', class: 'shape-puesto' }
};
// Cada negocio ve primero las figuras que le sirven: un billar, sus mesas de billar;
// una cancha sintética, sus canchas; un hotel, sus camas.
const SHAPES_NEGOCIO = { billar:['billar','mesa'], tejo:['cancha','billar'], cancha:['cancha'], bolera:['cancha'], videojuegos:['consola'],
  cafe_internet:['consola'], hotel:['cama'], motel:['cama'], hostal:['cama'], apartamentos:['cama'], parqueadero:['puesto'],
  mecanico:['puesto'], lavadero:['puesto'], montallantas:['puesto'], barberia:['silla'], salon_belleza:['silla'], manicure:['silla'],
  estetica:['cama'], tatuajes:['cama'], consultorio:['cama'], fisioterapia:['cama'], veterinaria:['cama'] };
function shapesDelNegocio(){
  const pref = SHAPES_NEGOCIO[(typeof data !== 'undefined' && data && data.businessType) || ''] || [];
  const claves = Object.keys(TABLE_SHAPES);
  return pref.filter(k => TABLE_SHAPES[k]).concat(claves.filter(k => !pref.includes(k)));
}

function ensureFloorPositions(){
  const ids = Object.keys(data.tables).map(Number).sort((a,b)=>a-b);
  const cols = Math.max(1, Math.ceil(Math.sqrt(ids.length)));
  const rows = Math.max(1, Math.ceil(ids.length / cols));
  ids.forEach((id, idx)=>{
    const t = data.tables[id];
    if(typeof t.mapX !== 'number' || typeof t.mapY !== 'number'){
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      t.mapX = ((col + 0.5) / cols) * 100;
      t.mapY = ((row + 0.5) / rows) * 100;
    }
    if(!t.shape || !TABLE_SHAPES[t.shape]) t.shape = shapesDelNegocio()[0] || 'redonda';
  });
}

function renderFloorPlan(){
  ensureFloorPositions();
  const plan = document.getElementById('floorPlan');
  plan.innerHTML = '';
  const ids = Object.keys(data.tables).map(Number).sort((a,b)=>a-b);
  ids.forEach(id=>{
    const t = data.tables[id];
    const isOpen = t.items && t.items.length > 0;
    const balance = tableBalance(id);
    const shapeInfo = TABLE_SHAPES[t.shape] || TABLE_SHAPES.redonda;
    const el = document.createElement('div');
    el.className = 'floor-table ' + shapeInfo.class + (isOpen ? ' open' : '') + (layoutEditing ? ' editing' : '') + (t.photo ? ' has-photo' : '');
    el.style.left = t.mapX + '%';
    el.style.top = t.mapY + '%';
    const iconHtml = t.photo ? `<img class="ft-photo" src="${t.photo}" alt="">` : `<div class="ft-icon">${shapeInfo.icon}</div>`;
    el.innerHTML = `
      ${iconHtml}
      <div class="ft-label">
        <div class="ft-name">${tableLabel(id)}</div>
        <div class="ft-status">${isOpen ? fmt(balance) : 'Vacía'}</div>
      </div>
    `;
    attachFloorDrag(el, id);
    plan.appendChild(el);
  });
}

function attachFloorDrag(el, id){
  let dragging = false;
  let moved = false;
  let startX = 0, startY = 0, startLeftPct = 0, startTopPct = 0;
  const plan = document.getElementById('floorPlan');

  const moveAt = (clientX, clientY) => {
    const rect = plan.getBoundingClientRect();
    if(!rect.width || !rect.height) return;
    const dxPct = ((clientX - startX) / rect.width) * 100;
    const dyPct = ((clientY - startY) / rect.height) * 100;
    if(Math.abs(dxPct) > 0.8 || Math.abs(dyPct) > 0.8) moved = true;
    const shape = TABLE_SHAPES[data.tables[id].shape] || TABLE_SHAPES.redonda;
    const halfW = Math.min(12, ((parseFloat(getComputedStyle(el).width)||72)/rect.width)*50);
    const halfH = Math.min(12, ((parseFloat(getComputedStyle(el).height)||72)/rect.height)*50);
    const newX = Math.min(100-halfW, Math.max(halfW, startLeftPct + dxPct));
    const newY = Math.min(100-halfH, Math.max(halfH, startTopPct + dyPct));
    el.style.left = newX + '%';
    el.style.top = newY + '%';
    data.tables[id].mapX = newX;
    data.tables[id].mapY = newY;
  };

  el.addEventListener('pointerdown', (e)=>{
    if(!layoutEditing) return;
    e.stopPropagation();
    dragging = true;
    moved = false;
    el.classList.add('dragging');
    startX = e.clientX;
    startY = e.clientY;
    startLeftPct = Number(data.tables[id].mapX) || 50;
    startTopPct = Number(data.tables[id].mapY) || 50;
    try{ el.setPointerCapture(e.pointerId); }catch(err){}
    e.preventDefault();
  }, {passive:false});

  el.addEventListener('pointermove', (e)=>{
    if(!dragging || !layoutEditing) return;
    e.stopPropagation();
    moveAt(e.clientX, e.clientY);
    e.preventDefault();
  }, {passive:false});

  const endDrag = (e)=>{
    if(!dragging) return;
    e.stopPropagation();
    dragging = false;
    el.classList.remove('dragging');
    if(moved){
      saveData();
      el.dataset.justDragged = '1';
      setTimeout(()=> delete el.dataset.justDragged, 80);
    }
  };
  el.addEventListener('pointerup', endDrag);
  el.addEventListener('pointercancel', endDrag);

  el.addEventListener('click', (e)=>{
    e.stopPropagation();
    if(el.dataset.justDragged === '1' || moved) { moved = false; return; }
    if(layoutEditing){ openShapePicker(id); return; }
    openTableModal(id);
  });
}

/* ---------- Selector de figura de mesa ---------- */
let shapePickerTableId = null;
const shapePickerOverlay = document.getElementById('shapePickerOverlay');

function openShapePicker(id){
  shapePickerTableId = id;
  document.getElementById('shapePickerTableName').textContent = tableLabel(id);
  const grid = document.getElementById('shapePickerGrid');
  const current = data.tables[id].shape || 'redonda';
  grid.innerHTML = shapesDelNegocio().map(key=>{
    const s = TABLE_SHAPES[key];
    return `
      <button class="shape-option${key===current?' active':''}" data-shape="${key}">
        <span class="shape-option-icon">${s.icon}</span>
        <span class="shape-option-label">${s.label}</span>
      </button>
    `;
  }).join('');
  grid.querySelectorAll('.shape-option').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      data.tables[shapePickerTableId].shape = btn.dataset.shape;
      saveData();
      closeShapePicker();
      renderFloorPlan();
      showToast('Forma actualizada.');
    });
  });
  updateShapePhotoPreview();
  shapePickerOverlay.classList.add('show');
}

function closeShapePicker(){
  shapePickerOverlay.classList.remove('show');
}

document.getElementById('shapePickerCloseBtn').addEventListener('click', closeShapePicker);
shapePickerOverlay.addEventListener('click', (e)=>{ if(e.target === shapePickerOverlay) closeShapePicker(); });

/* ---------- Foto propia para el ícono de la mesa ---------- */
function resizeImageForIcon(file, maxSize=160, quality=0.75){
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onload = ()=>{
      const img = new Image();
      img.onload = ()=>{
        let { width, height } = img;
        if(width >= height){
          if(width > maxSize){ height = Math.round(height * (maxSize/width)); width = maxSize; }
        } else {
          if(height > maxSize){ width = Math.round(width * (maxSize/height)); height = maxSize; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = ()=> reject(new Error('No se pudo leer la imagen'));
      img.src = reader.result;
    };
    reader.onerror = ()=> reject(new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });
}

function updateShapePhotoPreview(){
  const t = data.tables[shapePickerTableId];
  const preview = document.getElementById('shapePhotoPreview');
  const removeBtn = document.getElementById('shapePhotoRemoveBtn');
  if(t && t.photo){
    document.getElementById('shapePhotoPreviewImg').src = t.photo;
    preview.style.display = 'block';
    removeBtn.style.display = '';
  } else {
    preview.style.display = 'none';
    removeBtn.style.display = 'none';
  }
}

async function handleShapePhotoFile(file){
  if(!file || !shapePickerTableId) return;
  try{
    const dataUrl = await resizeImageForIcon(file);
    data.tables[shapePickerTableId].photo = dataUrl;
    saveData();
    renderFloorPlan();
    updateShapePhotoPreview();
    showToast('Foto de la mesa actualizada.');
  }catch(err){
    showToast('No se pudo usar esa foto. Intenta con otra.');
  }
}

const shapePhotoGalleryInput = document.getElementById('shapePhotoGalleryInput');
const shapePhotoCameraInput = document.getElementById('shapePhotoCameraInput');

document.getElementById('shapePhotoGalleryBtn').addEventListener('click', ()=> shapePhotoGalleryInput.click());
document.getElementById('shapePhotoCameraBtn').addEventListener('click', ()=> shapePhotoCameraInput.click());

shapePhotoGalleryInput.addEventListener('change', (e)=>{
  handleShapePhotoFile(e.target.files[0]);
  shapePhotoGalleryInput.value = '';
});
shapePhotoCameraInput.addEventListener('change', (e)=>{
  handleShapePhotoFile(e.target.files[0]);
  shapePhotoCameraInput.value = '';
});

document.getElementById('shapePhotoRemoveBtn').addEventListener('click', async ()=>{
  if(!shapePickerTableId) return;
  const ok = await showConfirm({
    title: '¿Quitar la foto de esta mesa?',
    message: 'Va a volver a mostrarse con el ícono de la figura elegida en vez de la foto.',
    confirmText: 'Sí, quitar foto',
    cancelText: 'Cancelar',
    icon: '🗑️'
  });
  if(!ok) return;
  delete data.tables[shapePickerTableId].photo;
  saveData();
  renderFloorPlan();
  updateShapePhotoPreview();
  showToast('Foto quitada.');
});

function updateMesaViewUI(){
  const isMap = data.tableViewMode === 'map';
  document.getElementById('tableGrid').style.display = isMap ? 'none' : '';
  document.getElementById('floorPlan').style.display = isMap ? 'block' : 'none';
  document.getElementById('floorPlanControls').style.display = isMap ? 'flex' : 'none';
  document.getElementById('floorPlanHint').style.display = (isMap && layoutEditing) ? 'block' : 'none';
  document.getElementById('mesaViewListBtn').classList.toggle('active', !isMap);
  document.getElementById('mesaViewMapBtn').classList.toggle('active', isMap);
  document.getElementById('toggleLayoutEditBtn').textContent = layoutEditing ? '✅ Terminar de ubicar' : '✋ Ubicar mesas (arrastrar)';
  document.getElementById('toggleLayoutEditBtn').classList.toggle('active', layoutEditing);
  renderMesas();
}

document.getElementById('mesaViewListBtn').addEventListener('click', ()=>{
  data.tableViewMode = 'list';
  layoutEditing = false;
  saveData();
  updateMesaViewUI();
});
document.getElementById('mesaViewMapBtn').addEventListener('click', ()=>{
  data.tableViewMode = 'map';
  saveData();
  updateMesaViewUI();
});
document.getElementById('toggleLayoutEditBtn').addEventListener('click', ()=>{
  layoutEditing = !layoutEditing;
  updateMesaViewUI();
});
document.getElementById('resetLayoutBtn').addEventListener('click', async ()=>{
  const ok = await showConfirm({
    title: '¿Reordenar mesas en cuadrícula?',
    message: 'Vas a perder la posición manual que le diste a cada mesa y quedarán acomodadas otra vez parejas en cuadrícula.',
    confirmText: 'Sí, reordenar',
    icon: '↺'
  });
  if(!ok) return;
  Object.values(data.tables).forEach(t=>{ delete t.mapX; delete t.mapY; });
  saveData();
  renderMesas();
});


/* ---------- Modal ---------- */
const overlay = document.getElementById('overlay');
function openTableModal(id){
  payPick.table = null; pendingReceipt.table = null; updatePayPickInfo('table');
  currentTable = id;
  document.getElementById('modalTitle').textContent = tableLabel(id);
  refreshProductSelect();
  renderPeople();
  renderFavChips();
  renderModalItems();
  document.getElementById('loyaltyDivider').hidden = !data.loyaltyOn;
  document.getElementById('loyaltyRow').hidden = !data.loyaltyOn;
  document.getElementById('loyaltyPhone').value = '';
  document.getElementById('loyaltyName').value = '';
  // Negocios de órdenes, vehículos, mascotas o pacientes: cada cuenta va a nombre de alguien.
  const cli = document.getElementById('clienteNombre');
  if(cli){ const t = data.tables[id] || {}; cli.value = (t.name || '').trim(); cli.placeholder = '¿A nombre de quién? (ej. Ana Pérez)'; }
  // Lo secundario (personas, nombre del cliente) arranca plegado: lo primero es buscar productos.
  mesaPleg('personasToggle', 'personasCuerpo', false);
  mesaPleg('clienteToggle', 'clienteRow', false);
  pintarClienteN();
  mesaAccionesTitulos();
  try{ window.grupoBarPintar && window.grupoBarPintar(id); }catch(e){}
  overlay.classList.add('show');
  // Ya no se pone el cursor solo en «¿A nombre de quién?»: abría el teclado cada vez que se abría una
  // mesa o cuenta. El campo sigue ahí; se escribe solo si la persona lo toca.
  try{ const a = document.activeElement; if(a && a !== document.body && overlay.contains(a) && /INPUT|TEXTAREA/.test(a.tagName)) a.blur(); }catch(e){}
}

/* ---------- Renombrar mesa ---------- */
const renameOverlay = document.getElementById('renameOverlay');
const renameTableInput = document.getElementById('renameTableInput');

function openRenameModal(){
  const t = data.tables[currentTable];
  renameTableInput.value = (t && t.name) ? t.name : '';
  renameOverlay.classList.add('show');
  setTimeout(()=>{ renameTableInput.focus(); renameTableInput.select(); }, 50);
}

function closeRenameModal(){
  renameOverlay.classList.remove('show');
}

function saveTableRename(){
  const t = data.tables[currentTable];
  if(!t) return;
  const newName = renameTableInput.value.trim();
  t.name = newName ? newName : null;
  saveData();
  document.getElementById('modalTitle').textContent = tableLabel(currentTable);
  const cli = document.getElementById('clienteNombre'); if(cli) cli.value = t.name || '';
  pintarClienteN();
  renderMesas();
  closeRenameModal();
  showToast(i18nPut(espacioN()) + ' renombrada.');
}

// Nombre del cliente dentro de la cuenta (negocios de órdenes, vehículos, mascotas, pacientes).
function guardarCliente(){
  const cli = document.getElementById('clienteNombre'), t = data.tables[currentTable];
  if(!cli || !t) return;
  const n = cli.value.trim();
  if((t.name || '') === n) return;
  t.name = n || null;
  saveData();
  document.getElementById('modalTitle').textContent = tableLabel(currentTable);
  pintarClienteN();
  renderMesas();
  if(n) showToast('✅ ' + i18nPut(espacioN()) + ' a nombre de ' + n + '.');
}
// Plegables de la mesa (personas, nombre del cliente): secundarios, se abren solo al tocarlos.
function mesaPleg(btnId, cuerpoId, abrir){
  const b = document.getElementById(btnId), c = document.getElementById(cuerpoId);
  if(!b || !c) return false;
  const on = abrir == null ? c.hidden : !!abrir;
  c.hidden = !on;
  b.setAttribute('aria-expanded', on ? 'true' : 'false');
  return on;
}
function pintarClienteN(){
  const el = document.getElementById('clienteN'); if(!el) return;
  const t = currentTable != null ? data.tables[currentTable] : null;
  const n = t && t.name ? String(t.name).trim() : '';
  el.textContent = n;
  const b = document.getElementById('clienteToggle'); if(b) b.classList.toggle('con-nombre', !!n);
}
// Títulos de los iconos del encabezado con el nombre que usa el negocio (mesa, silla, orden…).
function mesaAccionesTitulos(){
  const u = i18nPut(espacioN()).toLowerCase();
  [['renameTableBtn', 'Renombrar ' + u], ['moveTableBtn', 'Cambiar de ' + u]].forEach(([id, txt]) => {
    const b = document.getElementById(id); if(b){ b.title = txt; b.setAttribute('aria-label', txt); }
  });
}
document.getElementById('personasToggle').addEventListener('click', () => {
  if(mesaPleg('personasToggle', 'personasCuerpo')) setTimeout(() => { try{ document.getElementById('personNameInput').focus(); }catch(e){} }, 30);
});
document.getElementById('clienteToggle').addEventListener('click', () => {
  if(mesaPleg('clienteToggle', 'clienteRow')) setTimeout(() => { try{ const i = document.getElementById('clienteNombre'); i.focus(); i.select(); }catch(e){} }, 30);
});
document.getElementById('clienteGuardar').addEventListener('click', guardarCliente);
document.getElementById('clienteNombre').addEventListener('change', guardarCliente);
document.getElementById('clienteNombre').addEventListener('keydown', e => { if(e.key === 'Enter'){ e.preventDefault(); guardarCliente(); } });
document.getElementById('renameTableBtn').addEventListener('click', openRenameModal);
document.getElementById('moveTableBtn').addEventListener('click', () => { if(currentTable != null) abrirCambioMesa(currentTable); });
document.getElementById('renameCancelBtn').addEventListener('click', closeRenameModal);
document.getElementById('renameSaveBtn').addEventListener('click', saveTableRename);
renameTableInput.addEventListener('keydown', (e)=>{
  if(e.key === 'Enter') saveTableRename();
});
renameOverlay.addEventListener('click', (e)=>{ if(e.target === renameOverlay) closeRenameModal(); });
