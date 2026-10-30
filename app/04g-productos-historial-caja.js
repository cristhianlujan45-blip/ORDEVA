/* ORDEVA · app/04g-productos-historial-caja.js — parte 7 de 8 de app/04-principal.js (antes dentro de index.html). Se carga en el mismo lugar y orden. */
/* ---------- Productos ---------- */
document.getElementById('prodAddBtn').addEventListener('click', async ()=>{  const nameInput = document.getElementById('prodName');
  const priceInput = document.getElementById('prodPrice');
  const categorySelect = document.getElementById('prodCategory');
  const name = nameInput.value.trim();
  const price = parseFloat(priceInput.value);
  if(!name || isNaN(price) || price < 0){
    showToast('Escribe un nombre y un precio válido.');
    return;
  }
  const sizeInput = document.getElementById('prodSize');
  const specsInput = document.getElementById('prodSpecs');
  const ex = data.products.find(p => dupKey(p) === dupKey({ name, size: sizeInput ? sizeInput.value.trim() : '' }));
  if(ex){                                       // ya existe: no se crea otro
    const st = invNum(document.getElementById('prodStock').value);
    if(st != null && await showConfirm({ title: 'Producto repetido', message: '"' + ex.name + '" ya existe. ¿Sumarle ' + st + ' unidades al stock en vez de crear otro?', confirmText: 'Sí, sumar', icon: '📦' })){
      ex.stock = (ex.stock || 0) + st; nameInput.value = priceInput.value = document.getElementById('prodStock').value = document.getElementById('prodCost').value = '';
      saveData(); renderProductos(); renderInventario(); showToast('✅ ' + ex.name + ': ahora hay ' + ex.stock);
    } else showToast('"' + ex.name + '" ya existe. Edítalo en vez de crear otro.');
    return;
  }
  data.products.push({
    id: Date.now().toString(),
    name,
    price,
    categoryId: categorySelect.value || null,
    size: sizeInput ? sizeInput.value.trim() : '',
    specifications: specsInput ? specsInput.value.trim() : '',
    stock: invNum(document.getElementById('prodStock').value),
    cost: invNum(document.getElementById('prodCost').value)
  });
  document.getElementById('prodStock').value = '';
  document.getElementById('prodCost').value = '';
  nameInput.value = '';
  if(sizeInput) sizeInput.value = '';
  if(specsInput) specsInput.value = '';
  priceInput.value = '';
  nameInput.focus();
  saveData();
  renderProductos();
});

/* ---------- Etiquetas de producto (código de barras o QR) ----------
   Usa el mismo truco que ya usa la app para imprimir los QR de las mesas
   (pintarQR/imprimirQR): dibuja las etiquetas en un contenedor oculto del
   documento principal (nunca en un iframe aparte, para que QRCode.js y
   JsBarcode siempre tengan un documento real donde dibujar) y al imprimir
   se muestra solo ese contenedor. El tipo (código de barras o QR) se
   recuerda para la próxima vez. */
function productLabelCode(p){
  return 'P' + String(p.id).replace(/[^A-Za-z0-9]/g, '').slice(-10).toUpperCase();
}
// Lo que "dice" el QR al escanearlo con la cámara de cualquier celular:
// nombre, tamaño y precio en texto legible — no un código interno que solo
// esta app entiende — para que sirva también de consulta rápida en el local.
function productQrText(p, code){
  return (p.name + (p.size ? ' ' + p.size : '') + ' — ' + fmt(p.price) + ' · ' + code);
}
function labelTypeSelected(){
  const sel = document.getElementById('labelTypeSelect');
  return sel && sel.value === 'qr' ? 'qr' : 'barcode';
}
let labelPreviewList = [];
// Dibuja el código de una etiqueta. Si algo falla con un producto (p. ej. el
// generador de QR se queja de un nombre raro), no se cae toda la hoja: se
// reintenta con un QR más sencillo y, como último recurso, se deja el código
// escrito para no perder la etiqueta.
function drawLabelCode(holder, p, code, type){
  if(type === 'qr'){
    try{ new QRCode(holder, { text: productQrText(p, code), width: 120, height: 120, correctLevel: QRCode.CorrectLevel.M }); return true; }catch(e){}
    holder.innerHTML = '';
    try{ new QRCode(holder, { text: code, width: 120, height: 120, correctLevel: QRCode.CorrectLevel.L }); return true; }catch(e){}
  } else {
    try{
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      holder.appendChild(svg);
      JsBarcode(svg, code, { format: 'CODE128', displayValue: true, fontSize: 13, width: 1.6, height: 50, margin: 6 });
      return true;
    }catch(e){ holder.innerHTML = ''; }
  }
  holder.innerHTML = '<div class="label-code" style="font-size:16px;font-weight:700">' + invEsc(code) + '</div>';
  return false;
}
function printProductLabels(products, forcedType){
  if(!products || !products.length) return;
  labelPreviewList = products;
  const type = forcedType || labelTypeSelected();
  if(type === 'barcode' && typeof JsBarcode === 'undefined'){ showToast('No se pudo cargar el generador de código de barras. Recarga la página.'); return; }
  if(type === 'qr' && typeof QRCode === 'undefined'){ showToast('No se pudo cargar el generador de QR. Recarga la página.'); return; }
  let copies = 1;
  const prevCopies = document.getElementById('lpCopies');
  if(prevCopies) copies = Math.max(1, Math.min(50, parseInt(prevCopies.value, 10) || 1));
  let box = document.getElementById('labelPrint');
  if(!box){ box = document.createElement('div'); box.id = 'labelPrint'; document.body.appendChild(box); }
  box.innerHTML = '';
  const total = products.length * copies;
  const bar = document.createElement('div');
  bar.className = 'lp-bar';
  bar.innerHTML =
    '<span class="lp-title">🏷️ ' + total + (total === 1 ? ' etiqueta' : ' etiquetas') + '</span>' +
    '<button type="button" data-lp="barcode" class="' + (type === 'barcode' ? 'on' : '') + '">Código de barras</button>' +
    '<button type="button" data-lp="qr" class="' + (type === 'qr' ? 'on' : '') + '">Código QR</button>' +
    '<label>Copias de cada una <input type="number" id="lpCopies" min="1" max="50" value="' + copies + '"></label>' +
    '<button type="button" data-lp="print" class="lp-print">🖨️ Imprimir</button>' +
    '<button type="button" data-lp="close">✕ Cerrar</button>';
  box.appendChild(bar);
  const hint = document.createElement('p');
  hint.className = 'lp-hint';
  hint.textContent = 'Así van a salir. Toca "Imprimir": en el celular puedes elegir tu impresora o "Guardar como PDF". Estas etiquetas se escanean con el botón "Escanear" de la mesa o de Venta rápida.';
  box.appendChild(hint);
  const grid = document.createElement('div');
  grid.className = 'lp-grid';
  let fallos = 0;
  products.forEach(p => {
    const code = productLabelCode(p);
    for(let k = 0; k < copies; k++){
      const card = document.createElement('div');
      card.className = 'label-card';
      const nameEl = document.createElement('div');
      nameEl.className = 'label-name';
      nameEl.textContent = p.name + (p.size ? ' · ' + p.size : '');
      card.appendChild(nameEl);
      const codeHolder = document.createElement('div');
      codeHolder.style.cssText = 'display:flex;justify-content:center';
      card.appendChild(codeHolder);
      if(!drawLabelCode(codeHolder, p, code, type)) fallos++;
      if(type === 'qr'){
        const codeEl = document.createElement('div');
        codeEl.className = 'label-code';
        codeEl.textContent = code;
        card.appendChild(codeEl);
      }
      const priceEl = document.createElement('div');
      priceEl.className = 'label-price';
      priceEl.textContent = fmt(p.price);
      card.appendChild(priceEl);
      grid.appendChild(card);
    }
  });
  box.appendChild(grid);
  bar.querySelectorAll('button[data-lp]').forEach(b => b.addEventListener('click', () => {
    const a = b.dataset.lp;
    if(a === 'close') return closeLabelPreview();
    if(a === 'print'){ try{ window.print(); }catch(e){ showToast('Este navegador no deja imprimir desde aquí.'); } return; }
    const sel = document.getElementById('labelTypeSelect');
    if(sel) sel.value = a;
    try{ localStorage.setItem('vito_label_type', a); }catch(e){}
    printProductLabels(labelPreviewList, a);
  }));
  const copiesEl = document.getElementById('lpCopies');
  copiesEl.addEventListener('change', () => printProductLabels(labelPreviewList, type));
  document.body.classList.add('print-labels');
  if(fallos) showToast('⚠️ ' + fallos + ' etiqueta(s) no se pudieron dibujar; quedó el código escrito.', 4000);
}
function closeLabelPreview(){
  document.body.classList.remove('print-labels');
  const box = document.getElementById('labelPrint');
  if(box) box.innerHTML = '';
}
document.addEventListener('keydown', e => { if(e.key === 'Escape' && document.body.classList.contains('print-labels')) closeLabelPreview(); });
const labelTypeSelectEl = document.getElementById('labelTypeSelect');
if(labelTypeSelectEl){
  try{ labelTypeSelectEl.value = localStorage.getItem('vito_label_type') || 'barcode'; }catch(e){}
  labelTypeSelectEl.addEventListener('change', () => {
    try{ localStorage.setItem('vito_label_type', labelTypeSelectEl.value); }catch(e){}
  });
}
document.getElementById('productLabelsBtn').addEventListener('click', () => {
  const list = window.__labelProductList && window.__labelProductList.length ? window.__labelProductList : data.products;
  if(!list.length){ showToast('No hay productos para imprimir.'); return; }
  printProductLabels(list);
});

/* ---------- Escanear código de barras / QR (cámara en vivo) ----------
   Sirve para dos cosas: (1) vender más rápido escaneando el código de un
   producto para agregarlo de una a la cuenta abierta ("punto de venta"), y
   (2) reconocer o encontrar un producto al agregarlo/editarlo. Usa la misma
   API nativa del navegador (BarcodeDetector) que ya usaba el reconocimiento
   de facturas — sin librerías nuevas — y ahora también lee QR, no solo
   códigos de barras. Queda abierta para escanear varios seguidos: fácil de
   usar, sin tener que volver a tocar el botón cada vez. */
let scanStream = null, scanDetector = null, scanTimer = null, scanLastCode = null, scanLastAt = 0, scanOnResult = null, scanVivo = false;
let scanVez = 0;   // cada apertura/cierre suma 1: lo que termina tarde (cámara, lector) de una apertura vieja no se mete en la nueva
// Formatos que se piden: los que el celular sí sabe leer (pedir uno que no soporta rompe el lector en algunos equipos).
const SCAN_FORMATOS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'qr_code', 'code_39', 'itf', 'codabar'];

function scanBeep(){
  try{
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if(!Ctx) return;
    const ctx = new Ctx();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = 880; o.type = 'sine';
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + 0.15);
    setTimeout(() => ctx.close().catch(()=>{}), 300);
  }catch(e){}
}

// Código leído: si con él se agregó un producto, su «tún» (Sonidos POS) ya confirma la lectura y no se pita encima.
function scanLeido(raw){
  const t0 = Date.now();
  // 📱 El QR de «Usar el celular como lector» de otro equipo, leído con este celular: este celular pasa a ser el lector.
  if(/\/lector\.html#c=lc[A-Za-z0-9]{20,40}$/.test(String(raw || '').trim())){
    try{
      const u = new URL(String(raw).trim());
      if(u.origin === location.origin){ closeScanOverlay(); location.href = u.href; return; }
    }catch(e){}
  }
  if(navigator.vibrate) try{ navigator.vibrate(60); }catch(e){}
  try{ if(scanOnResult) scanOnResult(raw); }
  finally{ if(!(window.ventoSonidos && window.ventoSonidos.ultimo() >= t0)) scanBeep(); }
}

function closeScanOverlay(){
  const ov = document.getElementById('scanOverlay');
  if(ov) ov.classList.remove('show');
  if(scanTimer){ clearInterval(scanTimer); scanTimer = null; }
  scanVivo = false; scanVez++; scanAbriendo = false;
  const tb = document.getElementById('scanTorchBtn'); if(tb){ tb.hidden = true; tb.classList.remove('on'); }
  if(scanStream){ scanStream.getTracks().forEach(t => t.stop()); scanStream = null; }
  try{ const v = document.getElementById('scanVideo'); if(v){ v.pause(); v.srcObject = null; } }catch(e){}   // suelta la cámara del todo
  try{ if(window.ventoLectorCel) window.ventoLectorCel.cerrar(); }catch(e){}
  scanDetector = null; scanOnResult = null; scanLastCode = null;
}

/* 1.65.0: 📱 el celular como lector (lib/vento-lector-cel.js): mientras esta ventana está abierta, lo que lea el celular
   emparejado llega aquí igual que si lo hubiera leído esta cámara. Y por cable: el celular conectado por USB como
   cámara web (o DroidCam / Iriun) sale en «Cámara» para elegirlo; queda recordada en este equipo. */
const SCAN_CAM_LS = 'vento_scan_cam';
async function scanAbrirCamara(){
  let cam = ''; try{ cam = localStorage.getItem(SCAN_CAM_LS) || ''; }catch(e){}
  const pedir = v => navigator.mediaDevices.getUserMedia({ video: v });
  /* Cámara en buena resolución y con enfoque continuo: con la cámara por defecto (baja
     resolución, sin autoenfoque) los códigos pequeños o de cerca no se leían. Si el celular
     no acepta estas opciones, se abre la cámara normal. */
  const buena = { width: { ideal: 1280 }, height: { ideal: 720 }, advanced: [{ focusMode: 'continuous' }] };
  if(cam){
    try{ return await pedir(Object.assign({ deviceId: { exact: cam } }, buena)); }catch(e){}
    try{ return await pedir({ deviceId: { exact: cam } }); }catch(e){}   // ya no está conectada: la de siempre
  }
  /* 1.65.7: si la cámara está «ocupada» (NotReadableError: todavía la tiene la apertura anterior, otra app o el celular
     no la soltó), se espera un momento y se intenta otra vez; y al final, cualquier cámara. Antes fallaba de una y salía
     «No se pudo abrir la cámara» (tocar el botón varias veces lo provocaba). Sin permiso no se reintenta: se pregunta. */
  const ocupada = e => e && /NotReadable|TrackStart|Abort|Overconstrained|ConstraintNotSatisfied/.test(e.name || '');
  let ultimo;
  for(const v of [Object.assign({ facingMode: 'environment' }, buena), { facingMode: 'environment' }, { facingMode: 'environment' }, true]){
    try{ return await pedir(v); }
    catch(e){ ultimo = e; if(e && /NotAllowed|Security|NotFound/.test(e.name || '')) throw e; if(ocupada(e)) await new Promise(r => setTimeout(r, 450)); }
  }
  throw ultimo;
}
// «Cámara»: solo sale con más de una (la del computador y el celular por cable, por ejemplo).
async function scanPintarCamaras(){
  const sel = document.getElementById('scanCamSel'), fila = document.getElementById('scanCamRow');
  if(!sel || !fila) return;
  let cams = [];
  try{ cams = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput'); }catch(e){}
  if(cams.length < 2){ fila.hidden = true; return; }
  const actual = scanStream && scanStream.getVideoTracks()[0] && scanStream.getVideoTracks()[0].getSettings ? scanStream.getVideoTracks()[0].getSettings().deviceId : '';
  sel.innerHTML = cams.map((c, i) => '<option value="' + invEsc(c.deviceId) + '">' + invEsc(c.label || ('Cámara ' + (i + 1))) + (/android|phone|celular|droidcam|iriun|usb/i.test(c.label || '') ? ' 📱' : '') + '</option>').join('');
  if(actual) sel.value = actual;
  fila.hidden = false;
}

let scanAbriendo = false;
async function openScanOverlay(onResult, opts){
  opts = opts || {};
  const ov = document.getElementById('scanOverlay');
  const video = document.getElementById('scanVideo');
  const status = document.getElementById('scanStatus');
  if(!ov || !video) return;
  /* 1.65.7: tocar «Escanear» otra vez mientras la cámara abre (o ya abierta) NO la vuelve a abrir: antes cada toque
     cerraba la apertura en curso y pedía la cámara de nuevo, y en muchos celulares terminaba en «No se pudo abrir la
     cámara» (la cámara seguía ocupada por la apertura anterior). Solo se cambia a qué va lo que se lea. */
  if(ov.classList.contains('show') && !opts.reabrir && (scanAbriendo || (scanStream && scanStream.getVideoTracks().some(t => t.readyState === 'live')))){
    scanOnResult = onResult;
    if(opts.hint) status.textContent = opts.hint;
    return;
  }
  closeScanOverlay();
  const reintentar = document.getElementById('scanRetryBtn'); if(reintentar) reintentar.hidden = true;
  const vez = scanVez;
  ov.classList.add('show');
  const hint = opts.hint || i18nPut('Apunta la cámara al código del producto.');
  status.textContent = hint;
  scanOnResult = onResult;
  try{ if(window.ventoLectorCel) window.ventoLectorCel.abrir(hint, raw => { if(scanVez === vez && scanOnResult) scanLeido(raw); }); }catch(e){}
  const sinCamara = (msg, conReintento) => {
    scanAbriendo = false;
    status.textContent = msg + (window.ventoLectorCel ? ' También puedes usar tu celular como lector (abajo).' : '');
    const rb = document.getElementById('scanRetryBtn');
    if(rb && conReintento){ rb.hidden = false; rb.onclick = () => openScanOverlay(onResult, Object.assign({}, opts, { reabrir: true })); }
    try{ if(window.ventoLectorCel) window.ventoLectorCel.mostrar(true); }catch(e){}
  };
  if(!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)){ sinCamara('Este equipo no deja usar la cámara aquí.'); return; }
  // El lector: el del equipo (Chrome en Android y Mac) o ZXing (programa de PC en Windows, iPhone).
  const lector = window.ventoCodigos ? window.ventoCodigos.detector(SCAN_FORMATOS) : Promise.reject(new Error('sin_lector'));
  lector.catch(() => {});
  let stream;
  scanAbriendo = true;
  // Si en 12 s la cámara no abrió (el permiso quedó sin responder), se dice y sale «Reintentar».
  const lento = setTimeout(() => { if(scanVez === vez && scanAbriendo) { status.textContent = '⏳ La cámara no responde todavía. Si salió un aviso de permiso, toca «Permitir».'; const rb = document.getElementById('scanRetryBtn'); if(rb){ rb.hidden = false; rb.onclick = () => openScanOverlay(onResult, Object.assign({}, opts, { reabrir: true })); } } }, 12000);
  try{ stream = await scanAbrirCamara(); }
  catch(e){
    clearTimeout(lento);
    if(scanVez !== vez) return;
    const n = e && e.name || '';
    if(/NotAllowed|Security/.test(n)){
      sinCamara(window.VentoAndroid ? '📷 ORDEVA no tiene permiso de la cámara. Toca «Reintentar» y elige «Permitir» (si no sale, actívalo en Ajustes del celular → Apps → ORDEVA → Permisos → Cámara).'
        : '📷 El navegador no dejó usar la cámara. Toca el candado 🔒 junto a la dirección → Cámara → Permitir, y luego «Reintentar».', true);
      // «Reintentar»: si Android ya no vuelve a preguntar, abre los permisos de ORDEVA en Ajustes (app Android).
      const rb = document.getElementById('scanRetryBtn');
      if(rb) rb.onclick = () => {
        let ajustes = false; try{ ajustes = !!(window.VentoAndroid && window.VentoAndroid.camaraPermiso && window.VentoAndroid.camaraPermiso()); }catch(x){}
        if(ajustes) status.textContent = '⚙️ En la pantalla que se abrió: Permisos → Cámara → Permitir. Luego vuelve y toca «Reintentar».';
        else openScanOverlay(onResult, Object.assign({}, opts, { reabrir: true }));
      };
    } else sinCamara(/NotFound|DevicesNotFound/.test(n) ? 'Este equipo no tiene cámara.' : 'No se pudo abrir la cámara (otra app la está usando). Toca «Reintentar».', !/NotFound|DevicesNotFound/.test(n));
    return;
  }
  clearTimeout(lento);
  scanAbriendo = false;
  if(scanVez !== vez){ stream.getTracks().forEach(t => t.stop()); return; }
  scanStream = stream;
  video.srcObject = scanStream;
  try{ await video.play(); }catch(e){}
  scanPintarCamaras();
  try{ scanDetector = await lector; }
  catch(e){
    if(scanVez !== vez) return;
    scanDetector = null;
    sinCamara('No se pudo preparar el lector de códigos de esta cámara (revisa el internet).');
    return;
  }
  if(scanVez !== vez){ scanDetector = null; return; }
  // Linterna (en un bar suele estar oscuro): solo si la cámara la tiene.
  try{
    const track = scanStream.getVideoTracks()[0], cap = track && track.getCapabilities ? track.getCapabilities() : {};
    const tb = document.getElementById('scanTorchBtn');
    if(tb && cap && cap.torch){
      tb.hidden = false; tb.classList.remove('on');
      tb.onclick = async () => {
        const on = !tb.classList.contains('on');
        try{ await track.applyConstraints({ advanced: [{ torch: on }] }); tb.classList.toggle('on', on); tb.textContent = on ? '🔦 Apagar linterna' : '🔦 Linterna'; }catch(e){}
      };
    }
  }catch(e){}
  /* Se lee en cada cuadro del video (antes cada 350 ms): el código sale apenas entra en
     cámara. Nunca se lanzan dos lecturas a la vez, para no trabar celulares lentos. Con ZXing
     (sin lector propio del equipo) se lee cada 120 ms: así no se come el procesador del computador. */
  scanVivo = true;
  let ocupado = false;
  const leer = async () => {
    if(!scanVivo || scanVez !== vez) return;
    if(!ocupado && scanDetector && video.videoWidth){
      ocupado = true;
      try{
        const codes = await scanDetector.detect(video);
        const c0 = codes && codes.find(c => c && c.rawValue);
        if(c0 && scanVez === vez){
          const raw = c0.rawValue, now = Date.now();
          // Mientras el código siga en cámara no se repite (antes se volvía a sumar cada 1,5 s si
          // se dejaba quieto). Para sumar otra unidad del mismo, se retira un momento y se vuelve a mostrar.
          if(!(raw === scanLastCode && (now - scanLastAt) < 800)){
            scanLastCode = raw; scanLastAt = now;
            scanLeido(raw);
          } else scanLastAt = now;
        }
      }catch(e){}
      ocupado = false;
    }
    if(!scanVivo || scanVez !== vez) return;
    if(scanDetector && scanDetector.zxing) setTimeout(leer, 120);
    else (video.requestVideoFrameCallback ? video.requestVideoFrameCallback(leer) : requestAnimationFrame(leer));
  };
  leer();
}

document.getElementById('scanCamSel').addEventListener('change', e => {
  try{ localStorage.setItem(SCAN_CAM_LS, e.target.value); }catch(x){}
  // Se vuelve a abrir con la cámara elegida, con lo mismo que se estaba escaneando.
  const fn = scanOnResult, hint = document.getElementById('scanStatus').textContent;
  if(fn) openScanOverlay(fn, { hint, reabrir: true });
});

document.getElementById('scanCloseBtn').addEventListener('click', closeScanOverlay);
document.getElementById('scanCloseBtn2').addEventListener('click', closeScanOverlay);
// 1.65.7: tocar el fondo ya NO cierra la cámara: al tocar «📷» varias veces, los toques caían en el fondo y la cerraban y
// abrían una y otra vez. Se cierra con ✕ o «Cerrar».

// Encuentra el producto dueño de un código leído: coincide con el código de
// barras exacto, o con el código que va al final del texto del QR (ver
// productQrText/productLabelCode más arriba).
function findProductByScannedCode(raw){
  if(!raw) return null;
  const clean = String(raw).trim();
  // Códigos propios del producto (el de fábrica, p. ej. el EAN de la lata),
  // que se enlazan la primera vez que se escanean.
  let p = data.products.find(x => Array.isArray(x.barcodes) && x.barcodes.includes(clean));
  if(p) return p;
  p = data.products.find(x => (x.specifications || '').includes('Código: ' + clean));
  if(p) return p;
  p = data.products.find(x => productLabelCode(x) === clean);
  if(p) return p;
  const tail = clean.split('·').pop().trim();
  p = data.products.find(x => productLabelCode(x) === tail);
  if(p) return p;
  p = data.products.find(x => clean.includes(productLabelCode(x)));
  return p || null;
}

// --- Vender escaneando: agrega el producto reconocido a la cuenta abierta ---
const scanSellBtnEl = document.getElementById('scanSellBtn');
if(scanSellBtnEl){
  scanSellBtnEl.addEventListener('click', () => {
    if(!currentTable && currentTable !== 0){ return; }
    openScanOverlay(async (raw) => {
      const p = findProductByScannedCode(raw);
      if(p){ addFavoriteToTable(p.id); return; }
      handleUnknownScannedCode(raw, prod => addFavoriteToTable(prod.id), { canCreate: true });
    }, { hint: i18nPut('Escanea el código del producto para agregarlo a la cuenta — puedes escanear varios seguidos.') });
  });
}

// --- Agregar/encontrar producto escaneando (en Productos) ---
const scanCodeAddBtnEl = document.getElementById('scanCodeAddBtn');
if(scanCodeAddBtnEl){
  scanCodeAddBtnEl.addEventListener('click', () => {
    openScanOverlay(async (raw) => {
      const existing = findProductByScannedCode(raw);
      if(existing){
        closeScanOverlay();
        showToast('✅ "' + existing.name + '" ya está en tu lista — puedes editarlo.');
        openEditProductModal(existing.id);
        return;
      }
      showToast('🔎 Código no reconocido en tu lista, buscando información…');
      // 1.65.9: lo que ORDEVA ya aprendió de otros negocios, las bases libres y, con la IA, internet (lib/vento-producto-codigo.js).
      const info = window.ventoProductoCodigo ? await window.ventoProductoCodigo.buscar(raw).catch(() => null)
        : await lookupOpenFoodFacts(raw).then(o => o && o.name ? { nombre: o.name, marca: o.brand, tamano: o.size, fuente: 'Open Food Facts' } : null).catch(() => null);
      if(info && info.nombre){
        closeScanOverlay();
        document.getElementById('prodName').value = [info.marca && info.nombre.toLowerCase().indexOf(String(info.marca).toLowerCase()) < 0 ? info.marca : '', info.nombre].filter(Boolean).join(' ').trim();
        if(info.tamano) document.getElementById('prodSize').value = info.tamano;
        document.getElementById('prodSpecs').value = 'Código: ' + raw;
        document.getElementById('prodPrice').focus();
        showToast('Detectado: ' + info.nombre + (info.fuente ? ' (' + info.fuente + ')' : '') + '. Revisa y agrega el precio.', 7000);
      } else {
        showToast('❌ No encontré ese código. Escribe el producto a mano' + (typeof hasAIKey === 'function' && hasAIKey() ? ' o tómale una foto con «📷 Foto con IA».' : '.'), 7000);
      }
    }, { hint: i18nPut('Escanea el código de barras o QR de un producto para agregarlo o encontrarlo.') });
  });
}

/* ---------- Código desconocido: enlazarlo a un producto (una sola vez) ----------
   Antes, si escaneabas el código de fábrica de un producto (el de la lata o
   el paquete) y no era una etiqueta impresa por la app, solo salía "código no
   reconocido". Ahora se pregunta qué producto es, se guarda ese código en el
   producto y desde ahí se reconoce solo. */
let lcCode = null, lcOnPick = null, lcCanCreate = false, lcSuggestName = '';
async function handleUnknownScannedCode(raw, onPick, opts){
  opts = opts || {};
  closeScanOverlay();
  lcCode = String(raw).trim(); lcOnPick = onPick; lcCanCreate = !!opts.canCreate; lcSuggestName = '';
  const ov = document.getElementById('linkCodeOverlay');
  const search = document.getElementById('lcSearch');
  document.getElementById('lcSub').textContent = 'El código ' + lcCode + ' todavía no está en tu lista. ¿Qué producto es? Elígelo una sola vez y desde ahí se reconoce solo cada vez que lo escanees.';
  search.value = '';
  document.getElementById('lcCreateBtn').style.display = lcCanCreate ? '' : 'none';
  ov.classList.add('show');
  lcRenderList('');
  // Si hay internet, se intenta averiguar el nombre (Open Food Facts) para
  // sugerir el producto correcto sin que tengas que escribir.
  if(/^\d{8,14}$/.test(lcCode) && (window.ventoProductoCodigo || typeof lookupOpenFoodFacts === 'function')){
    const off = window.ventoProductoCodigo ? await window.ventoProductoCodigo.buscar(lcCode).then(i => i && i.nombre ? { name: i.nombre, brand: i.marca } : null).catch(() => null) : await lookupOpenFoodFacts(lcCode).catch(() => null);
    if(off && off.name && ov.classList.contains('show') && !search.value){
      lcSuggestName = [off.brand && off.name.toLowerCase().indexOf(String(off.brand).toLowerCase()) < 0 ? off.brand : '', off.name].filter(Boolean).join(' ').trim();
      document.getElementById('lcSub').textContent = 'Parece que es: "' + lcSuggestName + '". ¿Cuál de tus productos es? Elígelo una sola vez y desde ahí se reconoce solo.';
      lcRenderList(lcSuggestName);
    }
  }
}
function lcRenderList(query){
  const list = document.getElementById('lcList');
  const q = normVoiceText ? normVoiceText(query || '') : (query || '').toLowerCase();
  const words = q.split(/\s+/).filter(w => w.length > 1);
  let items = data.products.map(p => {
    const n = normVoiceText ? normVoiceText(p.name + ' ' + (p.size || '')) : (p.name + ' ' + (p.size || '')).toLowerCase();
    const score = words.length ? words.filter(w => n.includes(w)).length : 1;
    return { p, score };
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score || a.p.name.localeCompare(b.p.name)).slice(0, 12);
  if(!items.length && words.length){
    list.innerHTML = '<div class="lc-empty">Ningún producto coincide' + (lcCanCreate ? ' — usa "Es un producto nuevo".' : '. Créalo primero en Productos.') + '</div>';
    return;
  }
  list.innerHTML = items.map(x => '<button type="button" data-id="' + invEsc(x.p.id) + '"><span>' + invEsc(x.p.name) + (x.p.size ? ' · ' + invEsc(x.p.size) : '') + '</span><strong>' + fmt(x.p.price) + '</strong></button>').join('');
  list.querySelectorAll('button[data-id]').forEach(b => b.addEventListener('click', () => {
    const prod = data.products.find(p => p.id === b.dataset.id);
    if(!prod) return;
    if(!Array.isArray(prod.barcodes)) prod.barcodes = [];
    if(!prod.barcodes.includes(lcCode)) prod.barcodes.push(lcCode);
    saveData();
    try{ window.ventoProductoCodigo && window.ventoProductoCodigo.aportar(lcCode, prod); }catch(e){}   // 1.65.9: ORDEVA aprende el código
    const cb = lcOnPick;
    closeLinkCodeOverlay();
    showToast('🔗 Listo: ese código ahora es "' + prod.name + '".');
    if(cb) cb(prod);
  }));
}
function closeLinkCodeOverlay(){
  document.getElementById('linkCodeOverlay').classList.remove('show');
  lcOnPick = null;
}
document.getElementById('lcSearch').addEventListener('input', e => lcRenderList(e.target.value));
document.getElementById('lcCloseBtn').addEventListener('click', closeLinkCodeOverlay);
document.getElementById('lcCancelBtn').addEventListener('click', closeLinkCodeOverlay);
document.getElementById('linkCodeOverlay').addEventListener('click', e => { if(e.target.id === 'linkCodeOverlay') closeLinkCodeOverlay(); });
document.getElementById('lcCreateBtn').addEventListener('click', () => {
  const code = lcCode, name = document.getElementById('lcSearch').value.trim() || lcSuggestName, cb = lcOnPick;
  closeLinkCodeOverlay();
  // 🆕 1.65.9: la ficha sale llena sola (catálogo de ORDEVA, bases libres, IA); solo falta el precio. Al guardar, el
  // producto sigue a la venta o a la cuenta, como cuando se elige uno de la lista.
  if(window.ventoProductoCodigo && window.ventoProductoCodigo.ficha){
    window.ventoProductoCodigo.ficha(code, { nombre: name }).then(r => { if(r && r.p && cb) cb(r.p); }).catch(() => {});
    return;
  }
  openQuickProductOverlay(name, { barcode: code });
});

// --- Venta rápida: vender escaneando (igual que en la mesa) ---
document.getElementById('qsScanBtn').addEventListener('click', () => {
  openScanOverlay((raw) => {
    const p = findProductByScannedCode(raw);
    if(p){ qsAddToCart(p, 1); showToast('✅ ' + p.name + ' agregado'); return; }
    handleUnknownScannedCode(raw, prod => { qsAddToCart(prod, 1); showToast('✅ ' + prod.name + ' agregado'); }, { canCreate: true });
  }, { hint: i18nPut('Escanea el código del producto para agregarlo a la venta — puedes escanear varios seguidos.') });
});

// 📱 1.65.6: el celular lector (lib/vento-lector-cel.js) también manda a la cuenta abierta de una mesa y a la venta
// rápida, sin abrir «🔳 Escanear»: lo mismo que hace leer el código con la cámara de este equipo.
function scanEncimaDe(id){ const ov = document.getElementById(id); return !!ov && ov.classList.contains('show') && ![...document.querySelectorAll('.overlay.show')].some(x => x !== ov && !x.contains(ov) && x.id !== 'scanOverlay'); }
(window.ventoLectorDestinos = window.ventoLectorDestinos || []).push(
  { nombre: 'mesa', prioridad: 20, activo: () => (currentTable || currentTable === 0) && scanEncimaDe('overlay'),
    hint: () => '🧾 ' + (typeof tableLabel === 'function' ? tableLabel(currentTable) : 'La cuenta') + ': cada código se suma a la cuenta',
    leer: raw => { const p = findProductByScannedCode(raw); if(p){ addFavoriteToTable(p.id); return; } handleUnknownScannedCode(raw, prod => addFavoriteToTable(prod.id), { canCreate: true }); } },
  { nombre: 'venta-rapida', prioridad: 20, activo: () => scanEncimaDe('quickSaleOverlay'), hint: '🛍️ Venta rápida: cada código se suma a la venta',
    leer: raw => { const p = findProductByScannedCode(raw); if(p){ qsAddToCart(p, 1); showToast('✅ ' + p.name + ' agregado'); return; } handleUnknownScannedCode(raw, prod => { qsAddToCart(prod, 1); showToast('✅ ' + prod.name + ' agregado'); }); } });

/* ---------- Producto nuevo por foto, directo desde la mesa ---------- */
// Cuando buscas un producto en una mesa y no existe, en vez de tener que
// salirte a Productos, tomarle o subirle una foto, la IA (o el código de
// barras + Open Food Facts si no hay IA configurada) intenta identificarlo
// — igual que en Productos — y de una vez lo crea en el inventario y lo
// agrega a la cuenta abierta.
let qpBarcode = null;
let qpFotoBlanca = null;   // la misma foto que se tomó para identificarlo, ya con fondo blanco, lista para guardarse como foto del producto
function openQuickProductOverlay(prefillName, ctx){
  const ov = document.getElementById('quickProductOverlay');
  if(!ov) return;
  qpBarcode = ctx && ctx.barcode ? ctx.barcode : null;
  qpFotoBlanca = null;
  document.getElementById('qpName').value = prefillName || '';
  document.getElementById('qpPrice').value = '';
  document.getElementById('qpCost').value = '';
  document.getElementById('qpSize').value = '';
  const preview = document.getElementById('qpPhotoPreview');
  if(preview) preview.classList.remove('show');
  ov.classList.add('show');
  hideProductSuggestions();
}
function closeQuickProductOverlay(){
  const ov = document.getElementById('quickProductOverlay');
  if(ov) ov.classList.remove('show');
  const input = document.getElementById('qpCameraInput');
  if(input) input.value = '';
  qpFotoBlanca = null;
}
document.getElementById('qpCloseBtn').addEventListener('click', closeQuickProductOverlay);
document.getElementById('qpCancelBtn').addEventListener('click', closeQuickProductOverlay);
document.getElementById('quickProductOverlay').addEventListener('click', (e) => { if(e.target.id === 'quickProductOverlay') closeQuickProductOverlay(); });

document.getElementById('qpCameraBtn').addEventListener('click', () => document.getElementById('qpCameraInput').click());
document.getElementById('qpCameraInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if(!file) return;
  const btn = document.getElementById('qpCameraBtn');
  const preview = document.getElementById('qpPhotoPreview');
  const previewImg = document.getElementById('qpPhotoPreviewImg');
  const status = document.getElementById('qpPhotoStatus');
  btn.disabled = true; btn.textContent = '📷 Analizando…';
  preview.classList.add('show');
  status.textContent = 'Preparando la foto…';
  qpFotoBlanca = null;
  try{
    const dataUrl = await scalePhotoForAI(file, 640, 0.7);
    previewImg.src = dataUrl;
    // La misma foto que se tomó para identificar el producto queda lista para
    // usarse como su foto en la carta, con fondo blanco automático (igual que
    // al subir una foto desde Productos) — así no hay que repetir el paso.
    try{ qpFotoBlanca = fotoFondoBlanco(await fotoLeerImagen(file)).blanco; }catch(e){ qpFotoBlanca = null; }
    status.textContent = 'Analizando imagen y completando la información del producto…';
    let info;
    try{
      info = await recognizeProductWithAI(dataUrl, (m) => { status.textContent = m; });
    }catch(err){
      if(err.message === 'NO_API_KEY') info = await recognizeProductFallback(file);
      else throw err;
    }
    if(info && info.raw && !info.name){
      status.textContent = 'Código de barras detectado: ' + info.raw + '. Configura la IA (Ajustes) para identificar el producto automáticamente, o escríbelo a mano.';
    } else {
      const displayName = [info.brand, info.name].filter(Boolean).join(' ').trim() || info.name || '';
      if(!displayName){
        status.textContent = 'No logré identificar el producto en la foto. Acércate a la etiqueta, con buena luz, o escríbelo a mano.';
      } else {
        document.getElementById('qpName').value = displayName;
        if(info.size && info.unit) document.getElementById('qpSize').value = info.size + ' ' + info.unit;
        else if(info.size) document.getElementById('qpSize').value = String(info.size);
        status.textContent = 'Detectado: ' + displayName + '. Revisa y ponle el precio.';
        document.getElementById('qpPrice').focus();
      }
    }
  }catch(err){
    if(err.message === 'NO_API_KEY') status.textContent = 'Configura la IA en Ajustes para reconocimiento por foto, o escríbelo a mano.';
    else status.textContent = '❌ ' + (err && err.message ? err.message : 'No se pudo reconocer el producto.') + ' Puedes escribirlo a mano.';
  }finally{
    btn.disabled = false; btn.textContent = '📷 Tomar foto / subir imagen';
    document.getElementById('qpCameraInput').value = '';
  }
});

document.getElementById('qpAddBtn').addEventListener('click', async () => {
  const nameInput = document.getElementById('qpName');
  const priceInput = document.getElementById('qpPrice');
  const costInput = document.getElementById('qpCost');
  const sizeInput = document.getElementById('qpSize');
  const name = nameInput.value.trim();
  const price = +priceInput.value;
  if(!name || !price || price <= 0 || isNaN(price)){
    showToast('Escribe un nombre y un precio válido.');
    return;
  }
  if(!currentTable && currentTable !== 0){
    showToast('Abre una mesa primero.');
    return;
  }
  const size = sizeInput.value.trim();
  const fotoLista = qpFotoBlanca;   // se pierde al cerrar el overlay, así que se guarda antes
  const guardarFoto = async (p) => {
    if(!fotoLista || p.foto) return;   // no pisa una foto que el producto ya tuviera
    try{
      fotosCache[p.id] = fotoLista; p.foto = Date.now();
      await fotoSet(p.id, fotoLista);
      renderProductos(); renderInventario();
      setTimeout(() => { try{ publicarFotosCarta(); }catch(e){} }, 1500);
    }catch(e){ if(window.mesoraLogError) mesoraLogError('fotos', 'No se pudo guardar la foto tomada al crear el producto: ' + (e && e.message || e), 'qpAddBtn'); }
  };
  const existing = data.products.find(p => dupKey(p) === dupKey({ name, size }));
  if(existing){
    if(qpBarcode){ if(!Array.isArray(existing.barcodes)) existing.barcodes = []; if(!existing.barcodes.includes(qpBarcode)) existing.barcodes.push(qpBarcode); saveData(); }
    closeQuickProductOverlay();
    guardarFoto(existing);
    addFavoriteToTable(existing.id);
    return;
  }
  const newProduct = {
    id: Date.now().toString(),
    name,
    price,
    categoryId: null,
    size,
    specifications: '',
    stock: null,
    cost: invNum(costInput.value)
  };
  if(qpBarcode) newProduct.barcodes = [qpBarcode];
  data.products.push(newProduct);
  await saveData();
  renderProductos();
  renderInventario();
  closeQuickProductOverlay();
  await guardarFoto(newProduct);
  addFavoriteToTable(newProduct.id);
});

/* ---------- Cuentas de un producto: costo, precio, IVA, cantidad ----------
   Lo que de verdad te queda NO es «precio − costo» cuando eres responsable de IVA:
   el precio que cobras lleva el IVA por dentro (ese IVA es de la DIAN, no tuyo) y el
   IVA que le pagaste al proveedor se descuenta. Por eso todo se calcula sobre los
   valores SIN IVA, y además se multiplica por la cantidad que tienes para ver la
   plata metida y la ganancia que hay en la bodega.
   - Responsable de IVA:    utilidad = precio/(1+iva) − costo/(1+iva)
   - No responsable:        el IVA de la compra es parte del costo → utilidad = precio − costo */
function ivaDeProducto(p){
  if(p && p.iva != null && p.iva !== '') return Math.max(0, Math.min(50, Number(p.iva) || 0));
  return (typeof data !== 'undefined' && data && data.ivaResponsable) ? (Number(data.ivaRate) || 19) : 0;
}
function cuentasProducto(p){
  const iva = ivaDeProducto(p), f = 1 + iva / 100, conIva = iva > 0;
  const precio = Number(p.price) || 0;
  const costo = (p.cost == null || p.cost === '') ? null : (Number(p.cost) || 0);
  const precioNeto = conIva ? precio / f : precio;
  const costoNeto = costo == null ? null : (conIva ? costo / f : costo);
  const utilidad = costoNeto == null ? null : precioNeto - costoNeto;
  const margen = (utilidad == null || precioNeto <= 0) ? null : (utilidad / precioNeto * 100);
  const sobreCosto = (utilidad == null || !costoNeto) ? null : (utilidad / costoNeto * 100);
  const cant = (p.stock == null || p.stock === '') ? null : Math.max(0, Number(p.stock) || 0);
  return {
    iva, conIva, precio, precioNeto, ivaVenta: precio - precioNeto,
    costo, costoNeto, ivaCompra: costo == null ? null : costo - costoNeto,
    utilidad, margen, sobreCosto, cant,
    // Por la cantidad que tienes guardada
    inversion: (cant != null && costo != null) ? costo * cant : null,
    ventaTotal: cant != null ? precio * cant : null,
    utilidadTotal: (cant != null && utilidad != null) ? utilidad * cant : null,
    // Lo que le quedarías debiendo a la DIAN por esas ventas (IVA cobrado − IVA pagado)
    ivaPorPagar: (costo == null || !conIva) ? null : (precio - precioNeto) - (costo - costoNeto)
  };
}
const fmtPct = v => (v == null ? '—' : (Math.round(v * 10) / 10).toString().replace('.', ',') + '%');
// Tabla de números de un producto, para el desplegable y para el editor.
function cuentasHtml(p){
  const c = cuentasProducto(p);
  if(c.costo == null && !c.precio) return '<div class="pr-nums-vacio">Ponle precio y costo para ver cuánto ganas.</div>';
  const cls = c.margen == null ? '' : c.margen < 0 ? 'pr-mal' : c.margen < 15 ? 'pr-bajo' : 'pr-bien';
  const fila = (etq, val, extra) => '<div class="pr-num' + (extra || '') + '"><span>' + etq + '</span><b>' + val + '</b></div>';
  let h = '<div class="pr-nums">';
  if(c.conIva){
    h += fila('Precio de venta (con IVA ' + c.iva + '%)', fmt(Math.round(c.precio)));
    h += fila('Te queda de la venta (sin IVA)', fmt(Math.round(c.precioNeto)));
    if(c.costo != null){
      h += fila('Costo con IVA (lo que pagas)', fmt(Math.round(c.costo)));
      h += fila('Costo sin IVA (lo que cuesta de verdad)', fmt(Math.round(c.costoNeto)));
    }
  }else{
    h += fila('Precio de venta', fmt(Math.round(c.precio)));
    if(c.costo != null) h += fila('Costo (lo que pagas)', fmt(Math.round(c.costo)));
  }
  if(c.utilidad != null){
    h += fila('Ganas por unidad', fmt(Math.round(c.utilidad)), ' ' + cls);
    h += fila('Margen', fmtPct(c.margen), ' ' + cls);
    if(c.sobreCosto != null) h += fila('Le ganas sobre el costo', fmtPct(c.sobreCosto));
  }
  if(c.cant != null){
    h += '<div class="pr-num-sep">Por las ' + c.cant + ' unidades que tienes</div>';
    if(c.inversion != null) h += fila('Plata metida (costo × ' + c.cant + ')', fmt(Math.round(c.inversion)));
    if(c.ventaTotal != null) h += fila('Si las vendes todas', fmt(Math.round(c.ventaTotal)));
    if(c.utilidadTotal != null) h += fila('Ganancia si las vendes todas', fmt(Math.round(c.utilidadTotal)), ' ' + cls);
  }
  if(c.ivaPorPagar != null && c.ivaPorPagar !== 0) h += fila('IVA que le entregas a la DIAN (por unidad)', fmt(Math.round(c.ivaPorPagar)));
  return h + '</div>';
}
function renderProductos(){
  refreshProdCategorySelect();
  renderCategoryBar();
  try{ renderMarginTable(); }catch(e){}

  const list = document.getElementById('productList');
  list.innerHTML = '';

  let products = data.products;
  if(currentCategoryFilter === '__none__'){
    products = products.filter(p=>!p.categoryId);
  } else if(currentCategoryFilter !== null){
    products = products.filter(p=>p.categoryId === currentCategoryFilter);
  }

  // Buscador: todas las palabras escritas deben aparecer en el nombre, tamaño, categoría o
  // especificaciones (sin importar tildes ni mayúsculas).
  const qEl = document.getElementById('prodBuscar'), qRaw = qEl ? qEl.value.trim() : '';
  const sinTilde = x => String(x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const qWords = sinTilde(qRaw).split(/\s+/).filter(Boolean);
  if(qWords.length){
    products = data.products.filter(p => { const h = sinTilde([p.name, p.size, p.categoryId ? categoryName(p.categoryId) : '', Array.isArray(p.specifications) ? p.specifications.join(' ') : p.specifications, p.codigo || '', (p.barcodes || []).join(' ')].join(' ')); return qWords.every(w => h.includes(w)); });
  }
  const nEl = document.getElementById('prodBuscarN');
  if(nEl) nEl.textContent = qWords.length ? products.length + ' de ' + data.products.length : data.products.length + ' productos';
  if(data.products.length === 0){
    list.innerHTML = '<div class="empty-state">Todavía no tienes productos. Agrega tu primera referencia arriba — por ejemplo, una cerveza o una bebida del menú.</div>';
    return;
  }
  if(qWords.length && products.length === 0){
    list.innerHTML = '<div class="empty-state">No encontré «' + invEsc(qRaw) + '». <button type="button" class="btn-ghost" id="prodBuscarCrear">➕ Crear «' + invEsc(qRaw) + '»</button></div>';
    document.getElementById('prodBuscarCrear').onclick = () => { const n = document.getElementById('prodName'); n.value = qRaw; qEl.value = ''; renderProductos(); n.scrollIntoView({ block: 'center' }); n.focus(); };
    return;
  }
  if(products.length === 0){
    list.innerHTML = '<div class="empty-state">No hay productos en esta categoría todavía.</div>';
    return;
  }

  // ORDEVA 2.0: en el computador, con la apariencia nueva, la lista se ve como tabla (lib/ordeva2.css); en el celular igual que siempre.
  const cab = document.createElement('div'); cab.className = 'o2-tabla-h'; cab.setAttribute('aria-hidden', 'true');
  cab.innerHTML = '<span>Producto</span><span>Existencias</span><span>Costo</span><span>Precio</span><span>Margen</span><span></span>';
  list.appendChild(cab);
  products.forEach(p=>{
    const row = document.createElement('details');
    row.className = 'product-row pr-det';
    row.dataset.id = p.id;
    const tag = p.categoryId
      ? `<span class="p-tag"><span class="dot" style="background:${categoryColorVar(p.categoryId)}"></span>${categoryName(p.categoryId)}</span>`
      : '';
    const c = cuentasProducto(p);
    const margenChip = c.margen == null ? '' :
      `<span class="p-margen ${c.margen < 0 ? 'pr-mal' : c.margen < 15 ? 'pr-bajo' : 'pr-bien'}">${fmtPct(c.margen)}</span>`;
    const hist = productCostHistoryHtml(p.id, 5);
    row.innerHTML = `
      <summary class="pr-sum">
        <div class="p-name-wrap">
          ${typeof prodFotoThumbHtml === 'function' ? prodFotoThumbHtml(p) : ''}
      <span class="p-name">${qWords.length ? invEsc(p.name).replace(new RegExp('(' + qWords.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'gi'), '<mark class="pb">$1</mark>') : invEsc(p.name)}</span>
          ${p.size ? `<span class="p-size">📦 ${invEsc(p.size)}</span>` : ''}
          ${p.codigo ? `<span class="p-size">🔢 ${invEsc(p.codigo)}</span>` : ''}
          ${detResumen(p, 70) ? `<span class="p-det">${invEsc(detResumen(p, 70))}</span>` : ''}
          ${tag}
          ${invChip(p)}
        </div>
        <span class="o2-col o2-c-stock">${p.stock == null ? '—' : invEsc(Math.round(p.stock * 100) / 100) + ' <small>' + invEsc(invPalabra()[1]) + '</small>'}</span>
        <span class="o2-col o2-c-costo">${p.cost > 0 ? fmt(p.cost) : '—'}</span>
        <div class="p-right">
          <span class="p-price">${fmt(p.price)}</span>
          ${margenChip}
          <span class="pr-caret" aria-hidden="true">▾</span>
        </div>
      </summary>
      <div class="pr-body">
        ${cuentasHtml(p)}
        <div class="pr-inv">
          <span class="pr-inv-t">${invEsc(invPalabra()[0])}: ${p.stock == null ? 'sin control' : p.stock + ' ' + invPalabra()[1]}${p.stock != null ? ' · aviso ≤ ' + (p.minStock != null ? p.minStock : INV_DEF_MIN) : ''}</span>
          <div class="pr-inv-btns">
            <button type="button" class="btn-ghost" data-act="in" data-id="${p.id}">+ Entrada</button>
            <button type="button" class="btn-ghost" data-act="count" data-id="${p.id}">Contar</button>
            <button type="button" class="btn-ghost" data-act="min" data-id="${p.id}">Aviso</button>
          </div>
        </div>
        ${hist ? `<details class="iv-boxdetails"><summary>📈 Ver historial de precios</summary>${hist}</details>` : ''}
        <div class="pr-acciones">
          <button type="button" class="p-fav${p.favorite ? ' on' : ''}" data-id="${p.id}" title="Acceso rápido en la mesa">${p.favorite ? '⭐ Rápido' : '☆ Rápido'}</button>
          <button type="button" class="p-label" data-id="${p.id}" title="Imprimir la etiqueta con código de barras">🏷️ Etiqueta</button>
          <button type="button" class="p-edit" data-id="${p.id}">✏️ Editar</button>
          <button type="button" class="p-del" data-id="${p.id}">🗑️ Eliminar</button>
        </div>
      </div>
    `;
    list.appendChild(row);
  });
  window.__labelProductList = products;
  list.querySelectorAll('.p-label').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const prod = data.products.find(p=>p.id === btn.dataset.id);
      if(prod) printProductLabels([prod]);
    });
  });
  list.querySelectorAll('.p-fav').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const prod = data.products.find(p=>p.id === btn.dataset.id);
      if(!prod) return;
      prod.favorite = !prod.favorite;
      saveData();
      renderProductos();
    });
  });
  list.querySelectorAll('.p-edit').forEach(btn=>{
    btn.addEventListener('click', ()=> openEditProductModal(btn.dataset.id));
  });
  // Tocar el producto lo despliega con sus cuentas (costo, precio, IVA, margen y
  // cuánto hay metido en la cantidad que tienes) y los botones de inventario.
  list.querySelectorAll('[data-act]').forEach(btn=>{
    btn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); invAsk(btn.dataset.id, btn.dataset.act); });
  });
  list.querySelectorAll('.p-del').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      const prod = data.products.find(p=>p.id === btn.dataset.id);
      const ok = await showConfirm({
        title: '¿Eliminar producto?',
        message: '¿Estás seguro que quieres eliminar "' + (prod ? prod.name : 'este producto') + '"? No podrás deshacer esta acción.',
        confirmText: 'Sí, eliminar',
        icon: '🗑️'
      });
      if(!ok) return;
      data.products = data.products.filter(p=>p.id !== btn.dataset.id);
      saveData();
      renderProductos();
    });
  });
}

/* ---------- Editar producto ---------- */
const editProductOverlay = document.getElementById('editProductOverlay');
let editingProductId = null;

function refreshEditProdCategorySelect(selectedId){
  const sel = document.getElementById('editProdCategory');
  sel.innerHTML = '<option value="">Sin categoría</option>';
  data.categories.forEach(cat=>{
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = cat.name;
    sel.appendChild(opt);
  });
  sel.value = selectedId || '';
}

// Crear una categoría desde donde sea (la barra de categorías o el formulario de
// agregar producto): abre el panel que la contiene y pone el cursor en el nombre.
function abrirNuevaCategoria(){
  const row = document.getElementById('categoryAddRow'); if(!row) return;
  const panel = row.closest('details'); if(panel) panel.open = true;
  const abierto = row.style.display === 'flex';
  row.style.display = abierto ? 'none' : 'flex';
  if(!abierto){ const inp = document.getElementById('newCategoryName'); if(inp){ try{ inp.focus(); }catch(e){} try{ row.scrollIntoView({ block: 'center', behavior: 'smooth' }); }catch(e){} } }
}
/* ---------- Detalles propios de cada negocio ----------
   Un paquete de viaje no se describe igual que un tornillo: la agencia guarda destino,
   días, qué incluye y cupos; el hotel, cuántas personas y qué camas; la ferretería, la
   medida y si se vende por metro o por unidad. Los campos salen del catálogo (campos)
   y se guardan en p.det. Se ven en Productos y en la carta que abren los clientes. */
function camposNegocio(){ const t = tipoNegocio(); return (t && t.campos) || []; }
function pintarCamposProducto(p){
  const box = document.getElementById('editProdDet'), wrap = document.getElementById('editProdDetWrap');
  if(!box || !wrap) return;
  const campos = camposNegocio(), det = (p && p.det) || {};
  wrap.hidden = !campos.length;
  document.getElementById('editProdDetSum').textContent = '📋 Detalles ' + (producto1()[0].toLowerCase() === 'producto' ? 'del producto' : 'de ' + (generoDe(producto1()[0]) === 'm' ? 'este ' : 'esta ') + producto1()[0].toLowerCase());
  document.getElementById('editProdDetSub').textContent = 'Lo que el cliente quiere saber antes de comprar. Todo es opcional y sale en la lista que ven tus clientes.';
  box.innerHTML = campos.map(([k, lab, tipo, ph]) => {
    const v = det[k] == null ? '' : det[k];
    if(tipo === 'si') return '<label class="det-si"><input type="checkbox" data-det="' + k + '"' + (v ? ' checked' : '') + '> ' + invEsc(lab) + '</label>';
    return '<label for="det-' + k + '">' + invEsc(lab) + '</label><input id="det-' + k + '" data-det="' + k + '" type="' + (tipo === 'num' ? 'number' : 'text') + '"' + (tipo === 'num' ? ' min="0" step="1" inputmode="numeric"' : '') + ' placeholder="' + invEsc(ph || '') + '" value="' + invEsc(String(v)) + '">';
  }).join('');
  wrap.open = Object.keys(det).some(k => det[k] !== '' && det[k] != null);
}
function leerCamposProducto(){
  const box = document.getElementById('editProdDet'); if(!box) return null;
  const det = {};
  box.querySelectorAll('[data-det]').forEach(el => {
    const v = el.type === 'checkbox' ? el.checked : el.value.trim();
    if(v !== '' && v !== false) det[el.dataset.det] = el.type === 'number' ? Number(v) : v;
  });
  return Object.keys(det).length ? det : null;
}
// Renglón corto para la lista y para la carta: «San Andrés · 4 días, 3 noches · Incluye: vuelo, hotel»
function detResumen(p, max){
  const det = p && p.det; if(!det) return '';
  const campos = camposNegocio(), partes = [];
  campos.forEach(([k, lab, tipo]) => {
    const v = det[k]; if(v === '' || v == null || v === false) return;
    if(tipo === 'si'){ partes.push(lab); return; }
    partes.push(/incluye|detalle|prepara|garant|horario|camas|qué/i.test(lab) ? lab + ': ' + v : (tipo === 'num' ? v + ' ' + lab.replace(/^(cuántas?|para cuántas?|hasta cuántos?|precio por cuántas)\s*/i, '').toLowerCase() : v));
  });
  const r = partes.join(' · ');
  return max && r.length > max ? r.slice(0, max - 1) + '…' : r;
}
function openEditProductModal(productId){
  const p = data.products.find(x=>x.id === productId);
  if(!p) return;
  editingProductId = productId;
  document.getElementById('editProdName').value = p.name;
  document.getElementById('editProdPrice').value = p.price;
  document.getElementById('editProdCost').value = p.cost != null ? p.cost : '';
  document.getElementById('editProdCostWrap').open = p.cost != null;
  const ivaEl = document.getElementById('editProdIva');
  if(ivaEl){ ivaEl.value = (p.iva == null || p.iva === '') ? '' : p.iva; ivaEl.placeholder = String(ivaDeProducto({})); }
  document.getElementById('editProdSize').value = p.size || '';
  document.getElementById('editProdSpecs').value = Array.isArray(p.specifications) ? p.specifications.join(', ') : (p.specifications || '');
  pintarCamposProducto(p);
  document.getElementById('editProdStock').value = p.stock != null ? p.stock : '';
  document.getElementById('editProdMin').value = p.minStock != null ? p.minStock : '';
  refreshEditProdCategorySelect(p.categoryId);
  const codEl = document.getElementById('editProdCodigo'); if(codEl) codEl.value = p.codigo || (p.barcodes || [])[0] || '';
  if(typeof prodFotoModalAbrir === 'function') prodFotoModalAbrir(p);
  renderProductCostHistory(productId);
  renderEditProdMargin();
  editProductOverlay.classList.add('show');
}

// Margen de ganancia calculado al vuelo con lo que hay escrito en el
// formulario (no lo guardado todavía), para que se vea de una vez cuánto
// se está ganando o perdiendo mientras se edita el precio o el costo —
// lo mismo que ya se ve en Inventario, pero directo aquí en Productos.
function renderEditProdMargin(){
  // Desglose detallado de margen: costo actual, precio actual, cuánto se
  // gana o se pierde por unidad (con la palabra correcta según el signo) y
  // el margen, cada dato en su propia fila -- no todo amontonado en una
  // sola línea. Los valores de arriba (precio/costo) se pueden seguir
  // editando ahí mismo; este bloque solo reacciona a esos cambios.
  const line = document.getElementById('editProdMarginLine');
  if(!line) return;
  const price = parseFloat(document.getElementById('editProdPrice').value);
  const cost = parseFloat(document.getElementById('editProdCost').value);
  if(!isFinite(price) || price <= 0 || !isFinite(cost) || cost <= 0){
    line.innerHTML = '<div class="mb-empty">Escribe el costo (lo que te cuesta comprarlo) para ver aquí el desglose completo: cuánto ganas o pierdes por unidad, y tu margen.</div>';
    return;
  }
  const ivaTxt = (document.getElementById('editProdIva') || {}).value;
  const falso = { price, cost, iva: (ivaTxt == null || ivaTxt === '') ? null : Number(ivaTxt),
    stock: invNum(document.getElementById('editProdStock').value) };
  line.innerHTML = cuentasHtml(falso);
}
document.getElementById('editProdPrice').addEventListener('input', renderEditProdMargin);
document.getElementById('editProdCost').addEventListener('input', renderEditProdMargin);
document.getElementById('editProdIva').addEventListener('input', renderEditProdMargin);
document.getElementById('prodNewCatBtn').addEventListener('click', abrirNuevaCategoria);
document.getElementById('editProdStock').addEventListener('input', renderEditProdMargin);

// ---------- Histórico de precio de compra (de las facturas ya escaneadas) ----------
// Función compartida: arma el HTML del histórico de un producto (fecha, proveedor,
// costo y flecha si subió/bajó frente a la compra anterior). La usan tanto el
// modal de "Editar producto" como cada fila de Inventario (para no tener que
// entrar a Productos a verlo — queda todo ahí mismo, en Inventario).
function productCostHistoryHtml(productId, limit){
  const rows = [];
  (data.purchases || []).forEach(pur => {
    (pur.items || []).forEach(it => {
      if(it.productId === productId) rows.push({ date: pur.date || (pur.at ? pur.at.slice(0, 10) : ''), supplier: pur.supplier || '', cost: it.cost, at: pur.at || pur.date || '' });
    });
  });
  if(!rows.length) return '';
  rows.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const lastN = rows.slice(0, limit || 5);
  const lines = lastN.map((r, i) => {
    const prev = lastN[i + 1];
    let arrow = '';
    if(prev && prev.cost != null && r.cost != null && prev.cost !== r.cost){
      arrow = r.cost > prev.cost ? ' <b class="up">▲</b>' : ' <b class="down">▼</b>';
    }
    return '<div class="cost-hist-row"><span>' + invEsc(r.date || '—') + (r.supplier ? ' · ' + invEsc(r.supplier) : '') + '</span><span>' + fmt(r.cost) + arrow + '</span></div>';
  }).join('');
  return '<div class="cost-hist"><div class="cost-hist-title">📈 Histórico de compra (últimas ' + lastN.length + ')</div>' + lines + '</div>';
}
function renderProductCostHistory(productId){
  const box = document.getElementById('editProdHistory');
  if(!box) return;
  box.innerHTML = productCostHistoryHtml(productId, 5);
}

function closeEditProductModal(){
  editProductOverlay.classList.remove('show');
  editingProductId = null;
}

// Cuando se cambia el nombre, el precio o el tamaño de un producto, también se actualiza en las
// mesas abiertas (cada mesa guarda una copia del producto al agregarlo). Las cuentas ya cerradas
// (historial y facturas) NO cambian. Los productos viejos sin enlace se reconocen por su nombre anterior.
// Cambios de nombre: data.renombres guarda { nombre viejo (normalizado) → nombre actual }. Las
// estadísticas, "lo más vendido", ORDEVA y el orden de la carta agrupan con el nombre vigente, así
// las ventas de antes y de después del cambio se suman juntas. Las facturas ya hechas no cambian.
function nombreVigente(n){
  const r = data && data.renombres; if(!r || !n) return n;
  let x = n, k = 0;
  while(k++ < 10){ const nx = r[String(x).trim().toLowerCase()]; if(!nx || nx === x) break; x = nx; }
  return x;
}
function registrarRenombre(viejo, nuevo){
  if(!viejo || !nuevo || viejo === nuevo) return;
  data.renombres = data.renombres || {};
  data.renombres[String(viejo).trim().toLowerCase()] = nuevo;
  delete data.renombres[String(nuevo).trim().toLowerCase()];     // el nombre nuevo es el vigente (sin ciclos)
}
// Después de editar un producto: todo lo que se ve en pantalla (y la carta de los clientes) al día.
function refrescarTodoEnVivo(){
  try{ renderAll(); }catch(e){}
  const act = document.querySelector('nav button.active'), v = act && act.dataset.view;
  try{ if(v === 'estadisticas') renderStats(); if(v === 'cocina') renderCocina(); if(v === 'carta') renderCarta(); if(v === 'historial') renderHistorial(); if(v === 'contabilidad' && typeof renderConta === 'function') renderConta(); }catch(e){}
  try{ if(typeof window.vitoPublicarCatalogo === 'function') window.vitoPublicarCatalogo(true); }catch(e){}
}
function sincronizarProductoEnMesas(p, nombreAnterior){
  if(!p || !data || !data.tables) return 0;
  const viejo = String(nombreAnterior || '').trim().toLowerCase();
  let mesas = 0;
  Object.keys(data.tables).forEach(k => {
    const t = data.tables[k]; let cambio = false;
    (t.items || []).forEach(it => {
      const es = it.productId ? it.productId === p.id : (viejo && String(it.name || '').trim().toLowerCase() === viejo);
      if(!es) return;
      if(it.name !== p.name || it.price !== p.price || (it.size || '') !== (p.size || '')){
        it.name = p.name; it.price = p.price; it.size = p.size || ''; if(!it.productId) it.productId = p.id; cambio = true;
      }
    });
    if(cambio) mesas++;
  });
  if(mesas){
    try{ renderMesas(); }catch(e){}
    try{ if(currentTable != null){ renderModalItems(); renderPeople(); } }catch(e){}
  }
  return mesas;
}
function avisoMesasActualizadas(n){ return n ? ' Actualizado también en ' + (n === 1 ? '1 mesa abierta' : n + ' mesas abiertas') + '.' : ''; }

function saveEditedProduct(){
  const p = data.products.find(x=>x.id === editingProductId);
  if(!p) return;
  const nombreAntes = p.name;
  const name = document.getElementById('editProdName').value.trim();
  const price = parseFloat(document.getElementById('editProdPrice').value);
  const size = document.getElementById('editProdSize').value.trim();
  const categoryId = document.getElementById('editProdCategory').value || null;
  if(!name || isNaN(price) || price < 0){
    showToast('Escribe un nombre y un precio válido.');
    return;
  }
  const other = data.products.find(x => x.id !== p.id && dupKey(x) === dupKey({ name, size }));
  if(other){ showToast('Ya existe "' + other.name + '". Usa "Unir repetidos" en Inventario.'); return; }
  p.name = name;
  p.price = price;
  p.size = size;
  p.specifications = document.getElementById('editProdSpecs').value.trim();
  const det = leerCamposProducto(); if(det) p.det = det; else delete p.det;
  p.categoryId = categoryId;
  // Código: queda como código del producto y entre sus códigos de barras (así se reconoce al escanearlo).
  const codEl = document.getElementById('editProdCodigo');
  if(codEl){
    const v = codEl.value.trim().slice(0, 40), viejo = p.codigo || '';
    if(viejo && viejo !== v && Array.isArray(p.barcodes)) p.barcodes = p.barcodes.filter(b => b !== viejo);
    if(v){ p.codigo = v; p.barcodes = p.barcodes || []; if(!p.barcodes.includes(v)) p.barcodes.push(v); } else delete p.codigo;
  }
  p.stock = invNum(document.getElementById('editProdStock').value);
  p.minStock = invNum(document.getElementById('editProdMin').value);
  p.cost = invNum(document.getElementById('editProdCost').value);
  const ivaTxt = (document.getElementById('editProdIva').value || '').trim();
  if(ivaTxt === '') delete p.iva; else p.iva = Math.max(0, Math.min(50, Number(ivaTxt) || 0));
  if(typeof prodFotoModalGuardar === 'function') prodFotoModalGuardar(p);
  const nMesas = sincronizarProductoEnMesas(p, nombreAntes);
  registrarRenombre(nombreAntes, p.name);
  saveData();
  closeEditProductModal();
  renderProductos();
  refrescarTodoEnVivo();
  showToast('✅ Producto actualizado.' + avisoMesasActualizadas(nMesas), nMesas ? 4500 : undefined);
}

document.getElementById('prodBuscar').addEventListener('input', () => renderProductos());
document.getElementById('editProdCancelBtn').addEventListener('click', closeEditProductModal);
document.getElementById('editProdSaveBtn').addEventListener('click', saveEditedProduct);
document.getElementById('editProdCodigoScan').addEventListener('click', () => {
  openScanOverlay(raw => { const v = String(raw || '').trim().slice(0, 40); if(!v) return; document.getElementById('editProdCodigo').value = v; closeScanOverlay(); showToast('🔢 Código leído: ' + v + '. Toca «Guardar cambios».'); },
    { hint: 'Apunta al código de barras del producto.' });
});
editProductOverlay.addEventListener('click', (e)=>{ if(e.target === editProductOverlay) closeEditProductModal(); });

/* ---------- Compartir por WhatsApp ---------- */
function methodLabelShort(m){ return methodLabelHist[m] || m; }

function buildReceiptText({businessName, tableLabel, dateStr, items, payments, total, debt, invoiceNo, nit, bizAddress, ivaResponsable, ivaRate, dianResolucionText, pendiente, dian}){
  const lines = [];
  lines.push(`*${businessName}*`);
  if(nit) lines.push(`NIT/CC: ${nit}`);
  if(bizAddress) lines.push(bizAddress);
  lines.push(tableLabel);
  lines.push(dateStr);
  if(invoiceNo) lines.push(`Factura de venta N.º ${invoiceNo}`);
  if(dianResolucionText) lines.push(dianResolucionText);
  lines.push('');
  lines.push('*Productos:*');
  (items||[]).forEach(it=> lines.push(`${it.qty} x ${it.name}${it.size ? ' (' + it.size + ')' : ''}${it.person ? ' — ' + it.person : ''} - ${fmt(it.price*it.qty)}`));
  lines.push('');
  if(ivaResponsable){
    const b = ivaBreakdown(total, ivaRate);
    lines.push(`Subtotal: ${fmt(b.base)}`);
    lines.push(`IVA (${ivaRate}%): ${fmt(b.iva)}`);
  } else {
    lines.push('No responsable de IVA');
  }
  lines.push(`Total: ${fmt(total)}`);
  if(payments && payments.length){
    lines.push('');
    lines.push('*Pagos:*');
    payments.forEach(p=> lines.push(`${p.note ? p.note + ': ' : ''}${fmt(p.amount)} (${methodLabelShort(p.method)})`));
  }
  if(debt > 0){
    lines.push('');
    lines.push(`⚠️ Queda debiendo: ${fmt(debt)}`);
  }
  { const qp = receiptQrPago(pendiente); if(qp) lines.push('', '💳 ' + qp.titulo.replace(' con este QR', '') + (qp.llave ? ' a la llave ' + qp.llave : ' con el QR del negocio')); }
  if(dian && window.ventoDian){ lines.push('', window.ventoDian.reciboTexto(dian)); if(dian.qr) lines.push('Consulta en la DIAN: ' + dian.qr); }
  return lines.join('\n');
}

function whatsappShareText(text){
  window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
}

// QR de pago del negocio (un solo QR, ej. Bre-B) en la factura cuando todavía falta plata.
function receiptQrPago(pendiente){
  const q = data.qrPago; if(!q || !(pendiente > 0)) return null;
  return { src: q.orig || q.img, titulo: 'Paga ' + fmt(pendiente) + ' con este QR' + (q.tipo ? ' (' + q.tipo + ')' : ''), llave: q.llave || '' };
}
function buildReceiptHTML({businessName, tableLabel, dateStr, items, payments, total, debt, invoiceNo, nit, bizAddress, ivaResponsable, ivaRate, dianResolucionText, pendiente, dian}){
  const qp = receiptQrPago(pendiente);
  const itemsHtml = (items||[]).map(it=>`<div class="r-line"><span>${it.qty} x ${it.name}${it.size ? ' (' + it.size + ')' : ''}${it.person ? ' — ' + it.person : ''}</span><span>${fmt(it.price*it.qty)}</span></div>`).join('') || '<div class="r-line"><span>Sin productos</span><span></span></div>';
  const paymentsHtml = (payments||[]).map(p=>`<div class="r-line"><span>${p.note || 'Pago'} (${methodLabelShort(p.method)})</span><span>${fmt(p.amount)}</span></div>`).join('') || '<div class="r-line"><span>Sin pagos registrados</span><span></span></div>';
  const debtHtml = debt > 0 ? `<div class="r-line r-debt"><span>Queda debiendo</span><span>${fmt(debt)}</span></div>` : '';
  const bizLineHtml = [nit ? 'NIT/CC: ' + invEsc(nit) : '', bizAddress ? invEsc(bizAddress) : ''].filter(Boolean).join(' · ');
  const invoiceLineHtml = [invoiceNo ? 'Factura de venta N.º ' + invEsc(invoiceNo) : '', dianResolucionText ? invEsc(dianResolucionText) : ''].filter(Boolean).join(' · ');
  const ivaHtml = ivaResponsable
    ? (() => { const b = ivaBreakdown(total, ivaRate); return `<div class="r-line"><span>Subtotal</span><span>${fmt(b.base)}</span></div><div class="r-line"><span>IVA (${ivaRate}%)</span><span>${fmt(b.iva)}</span></div>`; })()
    : '<div class="r-line"><span>No responsable de IVA</span><span></span></div>';
  return `
    <h3>${businessName}</h3>
    ${bizLineHtml ? `<div class="r-sub">${bizLineHtml}</div>` : ''}
    <div class="r-sub">${tableLabel} · ${dateStr}</div>
    ${invoiceLineHtml ? `<div class="r-sub">${invoiceLineHtml}</div>` : ''}
    <div class="r-section">Productos</div>
    ${itemsHtml}
    ${ivaHtml}
    <div class="r-section">Pagos</div>
    ${paymentsHtml}
    ${debtHtml}
    <div class="r-total"><span>Total</span><span>${fmt(total)}</span></div>
    ${qp ? `<div style="text-align:center;margin-top:14px"><div style="font-weight:700;margin-bottom:6px">${invEsc(qp.titulo)}</div><img src="${qp.src}" alt="QR de pago" style="width:170px;height:auto;image-rendering:pixelated">${qp.llave ? `<div style="font-size:12px;margin-top:4px">Llave: ${invEsc(qp.llave)}</div>` : ''}</div>` : ''}
    ${dian && window.ventoDian ? window.ventoDian.reciboHTML(dian) : ''}
  `;
}

async function shareReceiptImage(receiptData){
  const el = document.getElementById('receiptTemplate');
  el.innerHTML = buildReceiptHTML(receiptData);
  try{
    const canvas = await html2canvas(el, { backgroundColor: '#ffffff', scale: 2 });
    canvas.toBlob(async (blob)=>{
      if(!blob){ showToast('No se pudo generar la imagen.'); return; }
      const file = new File([blob], 'factura.png', { type: 'image/png' });
      if(navigator.canShare && navigator.canShare({ files: [file] })){
        try{
          await navigator.share({ files: [file], title: 'Factura', text: receiptData.tableLabel });
          return;
        }catch(e){ /* cancelado, sigue al respaldo de descarga */ }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'factura-' + Date.now() + '.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Se descargó la imagen. Ábrela y envíala por WhatsApp.');
    }, 'image/png');
  }catch(e){
    showToast('No se pudo generar la captura.');
  }
}

function currentTableReceiptData(){
  const t = data.tables[currentTable];
  return {
    businessName: data.businessName,
    tableLabel: tableLabel(currentTable),
    dateStr: new Date().toLocaleString('es-CO'),
    items: (t.items||[]).map(it=>({name:it.name, qty:it.qty, price:it.price, person: personLookupName(t, it.personId)})),
    payments: (t.payments||[]).map(p=>({note:p.note, amount:p.amount, method:p.method||'efectivo'})),
    total: tableTotal(currentTable),
    debt: tableDebt(currentTable),
    pendiente: tableBalance(currentTable),
    // Vista previa: éste es el número que se le asignaría si se cierra ahora
    // (no se consume hasta que la cuenta se cierra de verdad).
    invoiceNo: (data.invoicePrefix || 'FV') + '-' + numFactura(data.invoiceNextNo || 1),
    nit: data.nit || '',
    bizAddress: data.bizAddress || '',
    ivaResponsable: !!data.ivaResponsable,
    ivaRate: data.ivaRate || 19,
    dianResolucionText: data.dianResolucionText || ''
  };
}

document.getElementById('shareTextBtn').addEventListener('click', ()=>{
  whatsappShareText(buildReceiptText(currentTableReceiptData()));
});

document.getElementById('shareImageBtn').addEventListener('click', ()=>{
  shareReceiptImage(currentTableReceiptData());
});

function printReceipt(receiptData){
  const f = document.createElement('iframe');
  f.style.cssText = 'position:fixed;width:0;height:0;border:0';
  document.body.appendChild(f);
  const d = f.contentDocument; d.open();
  const bizLine = [receiptData.nit ? 'NIT/CC: ' + invEsc(receiptData.nit) : '', receiptData.bizAddress ? invEsc(receiptData.bizAddress) : ''].filter(Boolean).join(' · ');
  const invoiceLine = [receiptData.invoiceNo ? 'Factura de venta N.º ' + invEsc(receiptData.invoiceNo) : '', receiptData.dianResolucionText ? invEsc(receiptData.dianResolucionText) : ''].filter(Boolean).join('<br>');
  const ivaLine = receiptData.ivaResponsable
    ? (() => { const b = ivaBreakdown(receiptData.total, receiptData.ivaRate); return '<div style="display:flex;justify-content:space-between"><span>Subtotal</span><span>' + fmt(b.base) + '</span></div><div style="display:flex;justify-content:space-between"><span>IVA (' + receiptData.ivaRate + '%)</span><span>' + fmt(b.iva) + '</span></div>'; })()
    : '<div style="display:flex;justify-content:space-between"><span>No responsable de IVA</span><span></span></div>';
  d.write('<title>Recibo</title><body style="font-family:monospace;max-width:320px;margin:16px auto;font-size:13px">' +
    '<h2 style="text-align:center;margin:0 0 4px">' + invEsc(receiptData.businessName) + '</h2>' +
    (bizLine ? '<div style="text-align:center;font-size:11px">' + bizLine + '</div>' : '') +
    '<div style="text-align:center;margin-bottom:10px">' + invEsc(receiptData.tableLabel) + '<br>' + invEsc(receiptData.dateStr) + (invoiceLine ? '<br>' + invoiceLine : '') + '</div>' +
    '<hr>' +
    (receiptData.items||[]).map(it=>'<div style="display:flex;justify-content:space-between"><span>' + it.qty + ' x ' + invEsc(it.name) + (it.person ? ' (' + invEsc(it.person) + ')' : '') + '</span><span>' + fmt(it.price*it.qty) + '</span></div>').join('') +
    '<hr>' +
    ivaLine +
    '<div style="display:flex;justify-content:space-between;font-weight:bold"><span>Total</span><span>' + fmt(receiptData.total) + '</span></div>' +
    (receiptData.payments && receiptData.payments.length ? '<div style="margin-top:8px"><b>Pagos:</b>' + receiptData.payments.map(p=>'<div style="display:flex;justify-content:space-between"><span>' + invEsc(p.note || 'Pago') + '</span><span>' + fmt(p.amount) + '</span></div>').join('') + '</div>' : '') +
    (receiptData.debt > 0 ? '<div style="margin-top:8px;font-weight:bold">⚠️ Queda debiendo: ' + fmt(receiptData.debt) + '</div>' : '') +
    ((qp => qp ? '<div style="text-align:center;margin-top:14px"><b>' + invEsc(qp.titulo) + '</b><br><img src="' + qp.src + '" style="width:170px;margin-top:6px">' + (qp.llave ? '<div style="font-size:12px">Llave: ' + invEsc(qp.llave) + '</div>' : '') + '</div>' : '')(receiptQrPago(receiptData.pendiente))) +
    (receiptData.dian && window.ventoDian ? window.ventoDian.reciboHTML(receiptData.dian, 140) : '') +
    '</body>');
  d.close();
  setTimeout(()=>{ f.contentWindow.focus(); f.contentWindow.print(); setTimeout(()=> f.remove(), 2000); }, 300);
}
document.getElementById('printReceiptBtn').addEventListener('click', ()=>{
  printReceipt(currentTableReceiptData());
});

/* ---------- Historial ---------- */
const methodLabelHist = { efectivo: 'Efectivo', transferencia: 'Transferencia', debe: 'Debe' };

/* Historial por páginas. Antes se dibujaban TODAS las cuentas de una vez (con 3.000 cuentas,
   unos meses de un bar, la app se congelaba casi 2 segundos al abrir el historial, al hacer el
   cierre de caja o al marcar una deuda pagada). Ahora se dibujan de a HIST_PAGINA y se pueden
   ver más. El filtro (Deben / Pagaron) se aplica ANTES de paginar, para que una deuda vieja
   nunca quede escondida al filtrar por «Deben». */
const HIST_PAGINA = 60;
let histMostrar = HIST_PAGINA;
const histFmtFecha = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
const histFmtHora = new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit' });
function histFiltroActual(){ const b = document.querySelector('#histFilter button.on'); return (b && b.dataset.f) || 'todos'; }
function histFila(h, idx){
  const d = new Date(h.date);
  const dateStr = histFmtFecha.format(d) + ' · ' + histFmtHora.format(d);
  const items = h.items || [];
  const payments = h.payments || [];
  const debt = h.debt || 0;
  const itemsHtml = items.map(it=>`
      <div class="hist-detail-line"><span>${it.name}${it.person ? ' — ' + it.person : ''} ×${it.qty}</span><span>${fmt(it.price*it.qty)}</span></div>
    `).join('') || '<div class="hist-detail-line"><span>Sin productos registrados</span><span></span></div>';
  const paymentsHtml = payments.map(p=>`
      <div class="hist-detail-line"><span>${p.note || 'Pago'} <span class="pay-method ${p.method}">${methodLabelHist[p.method] || p.method}</span>${payItemsHtml(p)}</span><span>${fmt(p.amount)}</span></div>
    `).join('') || '<div class="hist-detail-line"><span>Sin pagos registrados</span><span></span></div>';
  const debtHtml = debt > 0 ? `<div class="hist-detail-line"><span class="hist-debt-flag">Queda debiendo</span><span class="hist-debt-flag">${fmt(debt)}</span></div>` : '';
  const row = document.createElement('div');
  row.className = 'hist-row';
  row.dataset.idx = idx;
  row.innerHTML = `
      <div class="hist-row-top">
        <div class="hist-left">
          <div class="hist-table">${h.tableName || (i18nPut(espacioN()) + ' ' + h.table)}${h.person ? ' — ' + h.person : ''}${debt > 0 ? ' · <span class="hist-debt-flag">DEBE</span>' : ''}${h.corregida ? ' · ✏️ corregida' : ''}</div>
          <div class="hist-date">${dateStr}</div>
        </div>
        <div class="hist-total">${fmt(h.total)}</div>
      </div>
      <div class="hist-detail">
        <div class="hist-detail-title">Productos vendidos</div>
        ${itemsHtml}
        <div class="hist-detail-title">Pagos</div>
        ${paymentsHtml}
        ${debtHtml}
        ${window.ventoDian ? window.ventoDian.bloqueHistorial(h) : ''}
        <div class="hist-share-row">
          <button class="hist-share-image" data-idx="${idx}">🖼️ Enviar captura por WhatsApp</button>
        </div>
        <div class="hist-fix-row">
          <button type="button" class="hist-fix" data-fix="corregir" data-id="${String(h.id).replace(/"/g, '')}">✏️ Corregir</button>
          ${window.ventoInventario ? `<button type="button" class="hist-fix" data-fix="devolver" data-id="${String(h.id).replace(/"/g, '')}">↩️ Devolución</button>` : ''}
          ${h.table != null && data.tables && data.tables[h.table] ? `<button type="button" class="hist-fix" data-fix="liberar" data-id="${String(h.id).replace(/"/g, '')}">🔓 Liberar</button>` : ''}
          <button type="button" class="hist-fix peligro" data-fix="borrar" data-id="${String(h.id).replace(/"/g, '')}">🗑️ Borrar</button>
        </div>
      </div>
    `;
  return row;
}
function histReceiptData(h){
  return {
    businessName: h.businessName || data.businessName,
    tableLabel: (h.tableName || (i18nPut(espacioN()) + ' ' + h.table)) + (h.person ? ' — ' + h.person : ''),
    dateStr: new Date(h.date).toLocaleString('es-CO'),
    items: h.items || [],
    payments: h.payments || [],
    total: h.total,
    debt: h.debt || 0,
    // Cuentas cerradas antes de esta versión no tienen estos campos
    // guardados — en ese caso, simplemente no aparecen en la factura.
    invoiceNo: h.dian ? '' : (h.invoiceNo || ''),   // con documento DIAN, el número que vale es el de la DIAN
    nit: h.nit || '',
    bizAddress: h.bizAddress || '',
    ivaResponsable: !!h.ivaResponsable,
    ivaRate: h.ivaRate || 19,
    dianResolucionText: h.dianResolucionText || '',
    dian: h.dian || null
  };
}
function renderHistorial(masPagina){
  const list = document.getElementById('histList');
  const summary = document.getElementById('histSummary');
  let totalSum = 0, debtSum = 0;
  for(const h of data.history){ totalSum += h.total; debtSum += (h.debt || 0); }
  summary.innerHTML = `
    <div class="hist-stat"><div class="n">${data.history.length}</div><div class="l">Cuentas cerradas</div></div>
    <div class="hist-stat"><div class="n">${fmt(totalSum)}</div><div class="l">Total vendido</div></div>
    <div class="hist-stat"><div class="n hist-debt-flag">${fmt(debtSum)}</div><div class="l">Total en deudas</div></div>
  `;
  // Un solo manejador para los botones de todas las filas (también las de «ver más»).
  if(!list.dataset.delegado){
    list.dataset.delegado = '1';
    list.addEventListener('click', (e)=>{
      const btn = e.target.closest('.hist-share-text, .hist-share-image');
      if(btn){
        e.stopPropagation();
        const h = data.history[parseInt(btn.dataset.idx,10)];
        if(!h) return;
        if(btn.classList.contains('hist-share-text')) whatsappShareText(buildReceiptText(histReceiptData(h)));
        else shareReceiptImage(histReceiptData(h));
        return;
      }
      const fx = e.target.closest('.hist-fix');
      if(fx){ e.stopPropagation(); try{ window.ventoVentaFix && window.ventoVentaFix(fx.dataset.fix, fx.dataset.id); }catch(x){} return; }
      const mas = e.target.closest('.hist-mas');
      if(mas){ e.stopPropagation(); histMostrar += HIST_PAGINA; renderHistorial(true); return; }
      const row = e.target.closest('.hist-row');
      if(row && e.target.closest('.hist-row-top, .hist-detail') && !e.target.closest('button')) row.classList.toggle('expanded');
    });
  }
  if(!masPagina) histMostrar = HIST_PAGINA;
  list.innerHTML = '';
  if(data.history.length === 0){
    list.innerHTML = '<div class="empty-state">Todavía no has cerrado ninguna cuenta.</div>';
    renderClosures();
    return;
  }
  const f = histFiltroActual();
  const idxs = [];
  // Equipo sin permiso de historial completo: solo las ventas de hoy (para revisar o corregir), sin totales.
  let soloHoy = false; try{ soloHoy = !!(window.ventoRoles && window.ventoRoles.soloHoy()); }catch(e){}
  const hoy = new Date().toDateString();
  data.history.forEach((h, idx) => { const debe = (h.debt || 0) > 0; if(soloHoy && new Date(h.date).toDateString() !== hoy) return; if(f === 'todos' || (f === 'deben' && debe) || (f === 'pagaron' && !debe)) idxs.push(idx); });
  const frag = document.createDocumentFragment();
  idxs.slice(0, histMostrar).forEach(idx => frag.appendChild(histFila(data.history[idx], idx)));
  if(!idxs.length){
    const v = document.createElement('div'); v.className = 'empty-state';
    v.textContent = soloHoy && f === 'todos' ? 'Hoy todavía no hay ventas.' : f === 'deben' ? 'Nadie te debe. 🎉' : 'No hay cuentas con ese filtro.';
    frag.appendChild(v);
  } else if(idxs.length > histMostrar){
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn-ghost hist-mas'; b.style.cssText = 'width:100%;margin-top:10px';
    const quedan = idxs.length - histMostrar;
    b.textContent = 'Ver ' + Math.min(HIST_PAGINA, quedan) + ' más (' + quedan + ' ' + (quedan === 1 ? 'cuenta anterior' : 'cuentas anteriores') + ')';
    frag.appendChild(b);
  }
  list.appendChild(frag);
  renderClosures();
}

/* ---------- Cierre de caja del día ---------- */
function computeClosureStats(fromISO, toISO){
  const from = fromISO ? new Date(fromISO) : null;
  const to = new Date(toISO);
  const tickets = data.history.filter(h=>{
    const d = new Date(h.date);
    return (!from || d > from) && d <= to;
  });
  const totalSold = tickets.reduce((s,h)=> s + h.total, 0);
  let totalEfectivo = 0, totalTransferencia = 0, totalDebe = 0;
  tickets.forEach(h=>{
    (h.payments||[]).forEach(p=>{
      if(p.method === 'efectivo') totalEfectivo += p.amount;
      else if(p.method === 'transferencia') totalTransferencia += p.amount;
      else if(p.method === 'debe') totalDebe += p.amount;
    });
  });
  const hourlyMap = {};
  tickets.forEach(h=>{
    const d = new Date(h.date);
    const hourKey = String(d.getHours()).padStart(2,'0') + ':00';
    hourlyMap[hourKey] = (hourlyMap[hourKey]||0) + h.total;
  });
  const hourly = Object.keys(hourlyMap).sort().map(h=>({ hour: h, total: hourlyMap[h] }));
  return { tickets, totalSold, totalEfectivo, totalTransferencia, totalDebe, hourly };
}

// 1.55.0: lo que se le muestra antes de cerrar la caja (ventas desde el último cierre, mesas abiertas y qué pasa).
function cierreResumenTexto(s, openIds, last){
  const L = [];
  const desde = last ? 'desde el último cierre (' + new Date(last.date).toLocaleString('es-CO', { weekday:'short', hour:'numeric', minute:'2-digit' }) + ')' : 'desde el comienzo';
  L.push(s.tickets.length ? 'Ventas ' + desde + ': ' + s.tickets.length + (s.tickets.length === 1 ? ' cuenta' : ' cuentas') + ' por ' + fmt(s.totalSold) + ' (efectivo ' + fmt(s.totalEfectivo) + ').' : 'No hay ventas nuevas ' + desde + '.');
  if(openIds.length){
    const tot = openIds.reduce((a, id) => a + tableTotal(id), 0);
    L.push('Hay ' + openIds.length + (openIds.length === 1 ? ' mesa abierta' : ' mesas abiertas') + ' (Mesa ' + openIds.join(', Mesa ') + ') por ' + fmt(tot) + (openIds.length === 1 ? ': se cierra' : ': se cierran') + ' y lo que no esté pagado queda como «Debe».');
  }
  if(window.ventoTurno && (s.tickets.length || openIds.length || window.ventoTurno.turno())) L.push('Después cuenta el efectivo de la caja (o «Cerrar sin contar»).');
  L.push('Se guarda el resumen del día y la caja empieza de cero.');
  return L.join('\n\n');
}

async function closeCashRegister(opts){
  const auto = !!(opts && opts.auto === true);   // el cierre automático programado no espera a que alguien cuente
  const openIds = getOpenTableIds();
  const lastClosure = (data.closures && data.closures.length) ? data.closures[0] : null;
  const fromISO = lastClosure ? lastClosure.date : null;
  if(!auto){
    // Siempre pregunta antes de cerrar, con lo que se va a cerrar (antes solo preguntaba si había mesas abiertas).
    const pre = computeClosureStats(fromISO, new Date().toISOString());
    if(!pre.tickets.length && !openIds.length && !(window.ventoTurno && window.ventoTurno.turno())){
      showToast('No hay cuentas nuevas para cerrar. La caja ya está al día.');
      return;
    }
    const ok = await showConfirm({ icon: '🔒', title: '¿Cerrar la caja del día?', message: cierreResumenTexto(pre, openIds, lastClosure), confirmText: '🔒 Sí, cerrar caja', cancelText: 'No, todavía no' });
    if(!ok) return;
    if(window.ventoCierreClave && !(await window.ventoCierreClave.pedir())) return;   // 🔑 si el dueño puso clave para cerrar
    openIds.forEach(id => closeTableToHistory(id));
  } else if(openIds.length){
    const ok = confirm('Hay ' + openIds.length + ' mesa(s) con cuentas abiertas (Mesa ' + openIds.join(', Mesa ') + '). Para cerrar el día hay que cerrarlas: lo que no esté abonado quedará registrado como "Debe". ¿Cerrarlas y continuar?');
    if(!ok) return;
    openIds.forEach(id => closeTableToHistory(id));
  }
  const toISO = new Date().toISOString();
  const stats = computeClosureStats(fromISO, toISO);
  // 🧮 Arqueo: contar el efectivo de la caja (base + ventas en efectivo + entradas − salidas). Cancelar = no se cierra.
  let caja = null;
  if(window.ventoTurno && (stats.tickets.length || window.ventoTurno.turno())){
    caja = auto ? window.ventoTurno.sinContar(stats.totalEfectivo) : await window.ventoTurno.arqueo(stats.totalEfectivo);
    if(!caja){ saveData(); renderMesas(); return; }
  }
  if(stats.tickets.length === 0 && !caja){
    saveData();
    renderMesas();
    showToast('No hay cuentas nuevas para cerrar. La caja ya está al día.');
    return;
  }
  const closure = {
    id: Date.now().toString(),
    date: toISO,
    from: fromISO,
    businessName: data.businessName,
    ticketCount: stats.tickets.length,
    totalSold: stats.totalSold,
    totalEfectivo: stats.totalEfectivo,
    totalTransferencia: stats.totalTransferencia,
    totalDebe: stats.totalDebe,
    hourly: stats.hourly,
    caja
  };
  try{ window.ventoTurno && window.ventoTurno.cerrar(caja); }catch(e){}
  if(!data.closures) data.closures = [];
  data.closures.unshift(closure);
  saveData();
  renderMesas();
  renderHistorial();
  openClosureReport(closure);
}
document.getElementById('closeDayBtn').addEventListener('click', () => closeCashRegister());
document.getElementById('closeDayTopBtn').addEventListener('click', () => closeCashRegister());

function closureDateRangeStr(closure){
  const to = new Date(closure.date);
  const toStr = to.toLocaleDateString('es-CO', {weekday:'long', day:'2-digit', month:'long', year:'numeric'});
  if(closure.from){
    const from = new Date(closure.from);
    const sameDay = from.toDateString() === to.toDateString();
    const fromTime = from.toLocaleTimeString('es-CO', {hour:'2-digit', minute:'2-digit'});
    const toTime = to.toLocaleTimeString('es-CO', {hour:'2-digit', minute:'2-digit'});
    return sameDay ? (toStr + ' · ' + fromTime + ' a ' + toTime) : (from.toLocaleDateString('es-CO',{day:'2-digit',month:'short'}) + ' ' + fromTime + ' — ' + toStr + ' ' + toTime);
  }
  const toTime = to.toLocaleTimeString('es-CO', {hour:'2-digit', minute:'2-digit'});
  return toStr + ' · hasta las ' + toTime;
}

function buildClosureText(closure){
  const lines = [];
  lines.push(`*🔒 Cierre de caja — ${closure.businessName || data.businessName}*`);
  lines.push(closureDateRangeStr(closure));
  lines.push('');
  lines.push(`Cuentas cerradas: ${closure.ticketCount}`);
  lines.push(`*Total vendido: ${fmt(closure.totalSold)}*`);
  lines.push('');
  lines.push('*Por método de pago:*');
  lines.push(`Efectivo: ${fmt(closure.totalEfectivo)}`);
  lines.push(`Transferencia: ${fmt(closure.totalTransferencia)}`);
  if(closure.totalDebe > 0) lines.push(`⚠️ Quedó debiendo: ${fmt(closure.totalDebe)}`);
  if(closure.hourly && closure.hourly.length){
    lines.push('');
    lines.push('*Ventas por hora:*');
    closure.hourly.forEach(h=> lines.push(`${h.hour} — ${fmt(h.total)}`));
  }
  if(closure.caja && window.ventoTurno) lines.push(window.ventoTurno.texto(closure.caja));
  lines.push('');
  lines.push('¡Buen cierre! 🍻');
  return lines.join('\n');
}

function buildClosureHTML(closure){
  const hourlyHtml = (closure.hourly||[]).map(h=>`<div class="r-line"><span>${h.hour}</span><span>${fmt(h.total)}</span></div>`).join('') || '<div class="r-line"><span>Sin ventas registradas</span><span></span></div>';
  const debtHtml = closure.totalDebe > 0 ? `<div class="r-line r-debt"><span>Quedó debiendo</span><span>${fmt(closure.totalDebe)}</span></div>` : '';
  return `
    <h3>🔒 Cierre de caja</h3>
    <div class="r-sub">${closure.businessName || data.businessName} · ${closureDateRangeStr(closure)}</div>
    <div class="r-line"><span>Cuentas cerradas</span><span>${closure.ticketCount}</span></div>
    <div class="r-section">Por método de pago</div>
    <div class="r-line"><span>Efectivo</span><span>${fmt(closure.totalEfectivo)}</span></div>
    <div class="r-line"><span>Transferencia</span><span>${fmt(closure.totalTransferencia)}</span></div>
    ${debtHtml}
    <div class="r-section">Ventas por hora</div>
    ${hourlyHtml}
    ${closure.caja && window.ventoTurno ? window.ventoTurno.html(closure.caja, 'r') : ''}
    <div class="r-total"><span>Total vendido</span><span>${fmt(closure.totalSold)}</span></div>
  `;
}

async function shareClosureImage(closure){
  const el = document.getElementById('closureReceiptTemplate');
  el.innerHTML = buildClosureHTML(closure);
  try{
    const canvas = await html2canvas(el, { backgroundColor: '#ffffff', scale: 2 });
    canvas.toBlob(async (blob)=>{
      if(!blob){ showToast('No se pudo generar la imagen.'); return; }
      const file = new File([blob], 'cierre-caja.png', { type: 'image/png' });
      if(navigator.canShare && navigator.canShare({ files: [file] })){
        try{
          await navigator.share({ files: [file], title: 'Cierre de caja', text: closure.businessName || data.businessName });
          return;
        }catch(e){ /* cancelado, sigue al respaldo de descarga */ }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'cierre-caja-' + Date.now() + '.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Se descargó la imagen. Ábrela y envíala por WhatsApp.');
    }, 'image/png');
  }catch(e){
    showToast('No se pudo generar la captura.');
  }
}

const closureOverlay = document.getElementById('closureOverlay');
let openClosure = null;
function openClosureReport(closure){
  openClosure = closure;
  document.getElementById('closureModalSub').textContent = closureDateRangeStr(closure);
  const body = document.getElementById('closureReportBody');
  const hourlyHtml = (closure.hourly||[]).map(h=>`
    <div class="hist-detail-line"><span>${h.hour}</span><span>${fmt(h.total)}</span></div>
  `).join('') || '<div class="hist-detail-line"><span>Sin ventas registradas</span><span></span></div>';
  body.innerHTML = `
    <div class="total-row sub">
      <span class="label">Cuentas cerradas</span>
      <span class="amount">${closure.ticketCount}</span>
    </div>
    <div class="total-row sub">
      <span class="label">Efectivo</span>
      <span class="amount paid">${fmt(closure.totalEfectivo)}</span>
    </div>
    <div class="total-row sub">
      <span class="label">Transferencia</span>
      <span class="amount paid">${fmt(closure.totalTransferencia)}</span>
    </div>
    ${closure.totalDebe > 0 ? `<div class="total-row sub"><span class="label">Quedó debiendo</span><span class="amount hist-debt-flag">${fmt(closure.totalDebe)}</span></div>` : ''}
    <div class="hist-detail-title">Ventas por hora</div>
    ${hourlyHtml}
    ${closure.caja && window.ventoTurno ? window.ventoTurno.html(closure.caja) : ''}
    <div class="total-row">
      <span class="label">Total vendido</span>
      <span class="amount">${fmt(closure.totalSold)}</span>
    </div>
  `;
  closureOverlay.classList.add('show');
}
document.getElementById('closureModalOkBtn').addEventListener('click', ()=>{ closureOverlay.classList.remove('show'); openClosure = null; });
closureOverlay.addEventListener('click', (e)=>{ if(e.target === closureOverlay){ closureOverlay.classList.remove('show'); openClosure = null; } });
document.getElementById('closureShareTextBtn').addEventListener('click', ()=>{ if(openClosure) whatsappShareText(buildClosureText(openClosure)); });
document.getElementById('closureShareImageBtn').addEventListener('click', ()=>{ if(openClosure) shareClosureImage(openClosure); });

function renderClosures(){
  const title = document.getElementById('closuresTitle');
  const list = document.getElementById('closuresList');
  list.innerHTML = '';
  if(!data.closures || data.closures.length === 0){
    title.style.display = 'none';
    return;
  }
  title.style.display = 'block';
  data.closures.forEach((c, idx)=>{
    const hourlyHtml = (c.hourly||[]).map(h=>`
      <div class="hist-detail-line"><span>${h.hour}</span><span>${fmt(h.total)}</span></div>
    `).join('') || '<div class="hist-detail-line"><span>Sin ventas registradas</span><span></span></div>';
    const debtHtml = c.totalDebe > 0 ? `<div class="hist-detail-line"><span class="hist-debt-flag">Quedó debiendo</span><span class="hist-debt-flag">${fmt(c.totalDebe)}</span></div>` : '';
    const row = document.createElement('div');
    row.className = 'hist-row';
    row.innerHTML = `
      <div class="hist-row-top">
        <div class="hist-left">
          <div class="hist-table"><span class="closure-emoji">🔒</span>Cierre de caja${c.ticketCount ? ' · ' + c.ticketCount + (c.ticketCount===1?' cuenta':' cuentas') : ''}</div>
          <div class="hist-date">${closureDateRangeStr(c)}</div>
        </div>
        <div class="hist-total">${fmt(c.totalSold)}</div>
      </div>
      <div class="hist-detail">
        <div class="hist-detail-line"><span>Efectivo</span><span>${fmt(c.totalEfectivo)}</span></div>
        <div class="hist-detail-line"><span>Transferencia</span><span>${fmt(c.totalTransferencia)}</span></div>
        ${debtHtml}
        <div class="hist-detail-title">Ventas por hora</div>
        ${hourlyHtml}
        <div class="hist-share-row">
          <button class="closure-share-text" data-idx="${idx}">📤 Resumen</button>
          <button class="closure-share-image" data-idx="${idx}">🖼️ Captura</button>
        </div>
      </div>
    `;
    row.addEventListener('click', ()=> row.classList.toggle('expanded'));
    list.appendChild(row);
  });
  list.querySelectorAll('.closure-share-text').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      e.stopPropagation();
      whatsappShareText(buildClosureText(data.closures[parseInt(btn.dataset.idx,10)]));
    });
  });
  list.querySelectorAll('.closure-share-image').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      e.stopPropagation();
      shareClosureImage(data.closures[parseInt(btn.dataset.idx,10)]);
    });
  });
}

/* ---------- Borrar historial por día ---------- */
const deleteHistoryOverlay = document.getElementById('deleteHistoryOverlay');

function dayKey(dateStr){
  const d = new Date(dateStr);
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

function groupHistoryByDay(){
  const map = {};
  (data.history||[]).forEach(h=>{
    const key = dayKey(h.date);
    if(!map[key]) map[key] = { key, date: h.date, count:0, total:0, debt:0 };
    map[key].count++;
    map[key].total += h.total;
    map[key].debt += (h.debt||0);
  });
  return Object.values(map).sort((a,b)=> b.key.localeCompare(a.key));
}

function renderDeleteHistoryDays(){
  const list = document.getElementById('deleteHistoryDaysList');
  const days = groupHistoryByDay();
  if(days.length === 0){
    list.innerHTML = '<div class="empty-state">Todavía no hay historial guardado para borrar.</div>';
    return;
  }
  list.innerHTML = days.map(d=>{
    const dateStr = new Date(d.date).toLocaleDateString('es-CO', {day:'2-digit', month:'short', year:'numeric'});
    return `
      <div class="settings-row">
        <div class="settings-row-text">
          <strong>${dateStr}</strong>
          <span>${d.count} cuenta${d.count===1?'':'s'} cerrada${d.count===1?'':'s'} · ${fmt(d.total)}${d.debt>0 ? ' · Debía ' + fmt(d.debt) : ''}</span>
        </div>
        <button class="btn-danger-outline" data-key="${d.key}">🗑️ Borrar</button>
      </div>
    `;
  }).join('');
  list.querySelectorAll('button[data-key]').forEach(btn=>{
    btn.addEventListener('click', ()=> deleteHistoryDay(btn.dataset.key));
  });
}

async function deleteHistoryDay(key){
  const days = groupHistoryByDay();
  const day = days.find(d=>d.key === key);
  if(!day) return;
  const dateStr = new Date(day.date).toLocaleDateString('es-CO', {day:'2-digit', month:'long', year:'numeric'});
  const ok = await showConfirm({
    title: '¿Borrar el historial del ' + dateStr + '?',
    message: '⚠️ Vas a borrar ' + day.count + ' cuenta' + (day.count===1?'':'s') + ' cerrada' + (day.count===1?'':'s') + ' (' + fmt(day.total) + ') y los cierres de caja de ese día. Esta acción no se puede deshacer. Verifica bien la fecha antes de confirmar.',
    confirmText: 'Sí, borrar ese día',
    cancelText: 'Cancelar',
    icon: '🗑️'
  });
  if(!ok) return;
  data.history = (data.history||[]).filter(h=> dayKey(h.date) !== key);
  if(data.closures) data.closures = data.closures.filter(c=> dayKey(c.date) !== key);
  await saveData();
  renderHistorial();
  renderDeleteHistoryDays();
  showToast('Historial del ' + dateStr + ' borrado.');
}

function openDeleteHistory(){
  renderDeleteHistoryDays();
  deleteHistoryOverlay.classList.add('show');
}
function closeDeleteHistory(){
  deleteHistoryOverlay.classList.remove('show');
}
document.getElementById('deleteHistoryDayBtn').addEventListener('click', openDeleteHistory);
document.getElementById('deleteHistoryCloseBtn').addEventListener('click', closeDeleteHistory);
deleteHistoryOverlay.addEventListener('click', (e)=>{ if(e.target === deleteHistoryOverlay) closeDeleteHistory(); });

/* ---------- Init ---------- */
/* ---------- Ajustes: Restablecer ---------- */
async function resetDay(){
  const ok = await showConfirm({
    title: '¿Restablecer el día?',
    message: 'Se vaciarán todas las mesas. Las cuentas abiertas se guardan en el historial: lo que no se ha pagado queda como deuda (fiado), para que no se pierda.',
    confirmText: 'Sí, restablecer día',
    icon: '🔄'
  });
  if(!ok) return;
  let guardadas = 0;
  Object.keys(data.tables).forEach(id=>{
    if(closeTableToHistory(Number(id))) guardadas++;   // cuenta abierta → historial (lo no pagado queda como deuda)
    data.tables[id].items = [];
    data.tables[id].people = [];
    data.tables[id].payments = [];
  });
  await saveData();
  renderAll();
  renderHistorial();
  showToast('Día restablecido. ' + (guardadas ? guardadas + (guardadas === 1 ? ' cuenta abierta quedó' : ' cuentas abiertas quedaron') + ' en el historial (lo no pagado, como deuda).' : 'Todas las mesas quedaron vacías.'), 6000);
}

async function resetAll(){
  if(!authIsAdmin()){ showToast('🔒 Solo el usuario administrador puede restablecer todo el negocio.'); return; }
  const ok = await showConfirm({
    title: '¿Restablecer TODO?',
    message: 'Esto borra mesas, historial, cierres de caja y productos. La app queda como recién instalada. Esta acción no se puede deshacer.',
    confirmText: 'Sí, borrar todo',
    icon: '⚠️'
  });
  if(!ok) return;
  const keepTheme = data.theme;
  data = defaultData();
  Object.keys(localStorage).filter(k => k.startsWith('cm-rcpt-')).forEach(k => localStorage.removeItem(k));
  ventoAlmacen.claves().then(ks => ks.filter(k => /^rcpt\//.test(k)).forEach(k => ventoAlmacen.del(k).catch(() => {}))).catch(() => {});
  if(keepTheme) data.theme = keepTheme;
  await saveData();
  renderAll();
  renderHistorial();
  applyPalette(data.theme || 'ordeva2');
  showToast('La aplicación fue restablecida por completo.');
}

async function clearAllTableNames(){
  const named = Object.keys(data.tables).filter(id => data.tables[id] && data.tables[id].name && data.tables[id].name.trim());
  if(!named.length){
    showToast('Ninguna mesa tiene un nombre puesto todavía.');
    return;
  }
  const ok = await showConfirm({
    title: '¿Borrar el nombre de todas las mesas?',
    message: 'Las ' + named.length + ' mesa(s) con nombre propio (ej. "Terraza", "VIP") volverán a mostrar solo su número. Las cuentas, personas e historial no se tocan. Esta acción no se puede deshacer.',
    confirmText: 'Sí, borrar nombres',
    icon: '✏️'
  });
  if(!ok) return;
  named.forEach(id => { data.tables[id].name = ''; });
  await saveData();
  renderAll();
  showToast('Se borraron los nombres de ' + named.length + ' mesa(s).');
}

document.getElementById('resetDayBtn').addEventListener('click', resetDay);
document.getElementById('resetAllBtn').addEventListener('click', resetAll);
document.getElementById('clearAllTableNamesBtn').addEventListener('click', clearAllTableNames);

// ---------- Ayuda y soporte: WhatsApp directo ----------
// Antes era un solo botón genérico. Ahora, como Freshdesk o Zendesk, el
// mensaje se organiza solo por tipo y urgencia antes de llegar por WhatsApp
// (que sigue siendo el único canal real que tenemos, pero ya no llega en
// blanco: llega clasificado, para responder más rápido lo urgente).
const SUPPORT_WA_NUMBER = '573138950277';
const SUPPORT_TYPE_LABELS = { falla: '🐛 Algo no funciona', pregunta: '❓ Pregunta', pago: '💳 Problema con un pago o factura', sugerencia: '💡 Idea o sugerencia' };
const SUPPORT_URGENCY_LABELS = { urgente: '🔴 Urgente', normal: '🟡 Normal', baja: '🟢 No urgente' };
document.getElementById('supportWaBtn').addEventListener('click', () => {
  const type = SUPPORT_TYPE_LABELS[document.getElementById('supportType').value];
  const urgency = SUPPORT_URGENCY_LABELS[document.getElementById('supportUrgency').value];
  const detail = document.getElementById('supportMsg').value.trim();
  const lines = [
    'Hola, les escribo desde la app ORDEVA (' + (typeof MESORA_VERSION !== 'undefined' ? MESORA_VERSION : '') + ').',
    'Tipo: ' + type,
    'Urgencia: ' + urgency,
    authUser ? 'Usuario: ' + authUser + (data && data.businessName ? ' · ' + data.businessName : '') : ''
  ];
  if(detail) lines.push('Detalle: ' + detail);
  const msg = lines.filter(Boolean).join('\n');
  window.open('https://wa.me/' + SUPPORT_WA_NUMBER + '?text=' + encodeURIComponent(msg), '_blank');
});

// ---------- Guía de uso con buscador ----------
// Cada negocio ve solo los temas que usa: una floristería no necesita la pantalla de cocina.
function guiaDelNegocio(){
  try{ return GUIDE_ENTRIES.filter(e => !e.mod || usaMod(e.mod)); }catch(err){ return GUIDE_ENTRIES; }
}
const GUIDE_ENTRIES = [
  { title: '🍽️ Abrir y cobrar una mesa', keywords: 'abrir mesa cobrar cuenta cerrar pagar cliente pedido', body: 'Toca una mesa libre para abrirla y empieza a agregar lo que van pidiendo. Cuando el cliente se va, toca "Cobrar", revisa el total y confirma el pago. La mesa vuelve a quedar libre automáticamente.' },
  { mod: 'k', title: '🍳 Pantalla de cocina (KDS)', keywords: 'cocina kds pantalla pedidos barra despachar preparar listo', body: 'La pestaña "Cocina" muestra en tiempo real lo que hay pendiente en cada mesa y los pedidos nuevos que llegan por el QR o WhatsApp, para que cocina o barra los vea sin ir hasta la caja. Toca "Listo" en un ticket para marcarlo atendido, o "Aceptar"/"Rechazar" en un pedido nuevo.' },
  { title: '🧮 Calculadoras rápidas (NIT, descuento, prima, Rete-ICA)', keywords: 'calculadora nit digito verificacion descuento prima bonificacion reteica retencion ica', body: 'En Ajustes → Calculadoras rápidas tienes cuatro herramientas: el dígito de verificación del NIT, un cálculo de descuento, la prima o bonificación proporcional a los días trabajados, y la retención de ICA sobre un pago. No guardan nada, solo calculan al momento.' },
  { title: '📒 La Libreta: fiados, pagos y calculadora por voz', keywords: 'libreta fiados deudas pagar empleados calculadora suma resta multiplicacion voz cuenta corrida corregir', body: 'La Libreta entiende lo que le digas o escribas, al instante, sin necesitar internet. Fiados y pagos: "Juan me debe 20 mil", "Juan me pagó 10 mil", "le fié a Carlos 15 lucas", "¿cuánto me debe Juan?", "¿quién me debe?", "le pagué a Pedro 50 mil" (para empleados), "borra lo último" (deshace el último movimiento). Cuentas de la casa: las mesas que quedan "debiendo" al cobrar aparecen solas en la Libreta con el nombre de quien debe, con su historial de cuándo debió y cuándo pagó. Calculadora suelta (no se guarda): "cuánto es 20 mil más 15 mil", "cuánto vale 45 por 3", "800 entre 4", "calcula 100 más 200 más 300". Calculadora de cuenta corrida (con memoria, para ir sumando varias cosas seguidas): "súmame 13.400", y luego, sin decir "más", otro comando aparte "súmame 15.200" — se van sumando una tras otra. También "réstame 2.000", "cuánto llevo" (dice el total), y para corregir si algo quedó mal, "corrige" o "réstame" sin decir ningún número (quita lo último que se metió y dice cuánto era). "nueva cuenta" la deja en cero para empezar otra. También hay una calculadora con botones grandes tocando "🧮 Calculadora" dentro de la Libreta, para quien prefiera usar el dedo en vez de la voz.' },
  { title: '💬 WhatsApp con IA: recibir y responder pedidos solo', keywords: 'whatsapp business api ia auto responder pedidos puente cloudflare worker webhook meta', body: 'En Ajustes → Negocio y facturación → "WhatsApp con IA" puedes conectar el WhatsApp Business de tu negocio para que ORDEVA reciba los pedidos y la IA los entienda y responda. Necesitas una app de WhatsApp Business en developers.facebook.com (la tramitas tú, con tu número; Meta te da un token de acceso y un número de prueba gratis para empezar) y publicar un "puente" gratis en Cloudflare (los pasos exactos están dentro de esa sección, con un botón para copiar el código). Cuando un cliente escribe, la IA lee el mensaje, saca el nombre, la dirección y los productos, y redacta una respuesta corta y personalizada. Si activas "Responder automáticamente" se envía sola por WhatsApp; si la dejas apagada, revisas cada respuesta y la envías con un toque. El botón "🛵 Armar domicilio" en cada mensaje lo deja listo para facturar, con el nombre y el teléfono ya puestos.' },
  { title: '🏷️ Código de barras / etiquetas de producto', keywords: 'codigo de barras etiqueta imprimir producto qr generar', body: 'En Productos, el botón "🏷️ Imprimir etiquetas" genera una hoja para imprimir con el código o QR y el precio de todos los productos visibles. Arriba puedes elegir si quieres código de barras o QR. El botón 🏷️ junto a cada producto imprime solo la etiqueta de ese producto.' },
  { mod: 'q', title: '💜 Cobrar con Nequi desde el QR de la mesa', keywords: 'nequi pago pasarela cobrar transferencia cuenta', body: 'En Ajustes → Pasarela de pago (Nequi), activa "Aceptar pagos por Nequi" y escribe tu número. Cuando un cliente pida la cuenta desde el QR de su mesa, si queda saldo por pagar, le aparece tu número y el valor exacto para transferir, y un botón "Ya pagué por Nequi" que te avisa. Tú confirmas el pago cuando lo veas llegar — no es un cobro automático. Reimprime los QR de tus mesas después de activarlo para que lleven el número.' },
  { mod: 'd', title: '➗ Dividir la cuenta', keywords: 'dividir cuenta partes personas mitad separar pago', body: 'Al cobrar una mesa puedes dividir el total entre varias personas, en partes iguales o eligiendo qué le corresponde a cada quien, y cobrar cada parte por separado.' },
  { title: '🎖️ Clientes frecuentes', keywords: 'clientes frecuentes fidelizacion fidelidad puntos premio vip whatsapp visitas', body: 'En Ajustes → Clientes frecuentes, actívalo para que al cerrar una cuenta aparezca un campo para anotar el WhatsApp (y el nombre, si quieres) del cliente. La app lleva la cuenta de sus visitas y de cuánto ha gastado, y le va poniendo una insignia (🥉 recurrente, 🥈 frecuente, 🥇 VIP) según cuántas veces vuelve, para que sepas a quién darle una atención especial.' },
  { title: '🎧 Atención al cliente (casos y reclamos)', keywords: 'atencion cliente casos reclamos quejas problemas pedido incorrecto calidad demora domicilio helpdesk soporte interno', body: 'En Ajustes → Pedidos, QR y caja → Atención al cliente puedes anotar cualquier reclamo (pedido incorrecto, calidad, demora, un domicilio que no llegó) con su urgencia. Al escribir qué pasó, la app te sugiere sola la categoría. Se puede asignar a quién lo va a atender, y si el cliente ya está en Clientes frecuentes queda relacionado con él. Cuando lo resuelvas, anota cómo quedó y qué tan satisfecho salió el cliente, para no perder el rastro de ningún caso.' },
  { title: '💸 Marcar una cuenta como deuda (fiado)', keywords: 'deuda fiado fiar debe pagar despues credito cliente', body: 'Si un cliente no paga de una vez, marca la cuenta como deuda en vez de cobrarla. Queda guardada como pendiente hasta que la salde, y puedes verla y cobrarla después.' },
  { title: '➕ Agregar o editar productos', keywords: 'agregar producto editar crear nuevo precio nombre categoria', body: 'En Productos puedes crear un producto nuevo con nombre, precio y categoría, o tocar uno existente para editarlo. Los cambios se reflejan al instante en las mesas.' },
  { title: '🍔 Combos', keywords: 'combo combos paquete varios productos juntos', body: 'Puedes armar combos que agrupan varios productos en una sola opción con su propio precio, para agregarlos más rápido a una mesa.' },
  { title: '📷 Escanear un producto con la cámara', keywords: 'escanear producto camara foto ia inteligencia artificial crear', body: 'Al crear un producto puedes tomarle una foto con la cámara y la app usa inteligencia artificial para sugerirte el nombre, la categoría y el precio, para que no tengas que escribirlo todo a mano.' },
  { title: '📦 Control de stock (existencias)', keywords: 'stock existencias inventario cantidad disponible agotado alerta aviso bajo', body: 'Cada producto puede llevar un control de cuántas unidades tienes disponibles. La cantidad baja sola cuando se vende y puedes ajustarla manualmente cuando repongas mercancía. Si algo se agota o queda bajo, te avisa solo al abrir la app.' },
  { title: '⭐ Accesos rápidos (favoritos)', keywords: 'favoritos rapido rapidos estrella agregar pedidos frecuentes acceso', body: 'En Productos toca la estrella de tus productos más vendidos para marcarlos como favoritos. Aparecen como botones arriba, dentro de cada mesa, para agregarlos con un solo toque sin tener que buscarlos.' },
  { title: '🧾 Escanear factura de proveedor con IA (con internet)', keywords: 'escanear factura proveedor ia internet camara galeria pdf inteligencia artificial', body: 'En Inventario, en "Factura de proveedor · Con IA" puedes tomar una foto, elegir una foto de la galería, o subir un PDF de la factura. La app lee los productos, cantidades y precios de costo automáticamente y te deja revisarlos antes de guardarlos.' },
  { title: '📴 Escanear factura sin internet', keywords: 'escanear factura sin internet offline sin wifi', body: 'Si no tienes internet, puedes escanear la factura igual desde la opción "Sin internet". La app lee el texto de la foto o el PDF directamente en tu equipo, sin necesidad de conexión.' },
  { title: '📊 Ver costos, márgenes y ganancia o pérdida', keywords: 'costo margen ganancia perdida precio compra venta gana pierde historico subio precio proveedor', body: 'En Inventario, cada producto muestra en cuánto te llega (costo) y en cuánto lo vendes, junto con el margen y si estás ganando bien, justo, o perdiendo con ese producto. Más abajo hay una gráfica que compara la ganancia o pérdida de todos tus productos de un vistazo. Al editar un producto también ves el histórico de lo que te ha costado en cada compra, y si escaneas una factura donde un proveedor te subió el precio, te avisa cuáles.' },
  { title: '📈 Estadísticas', keywords: 'estadisticas ventas reportes negocio resumen numeros comparar semana mes anterior', body: 'En Estadísticas puedes ver cómo va tu negocio: ventas, productos más vendidos y otros resúmenes útiles para tomar decisiones. También hay un comparativo de esta semana contra la semana pasada, y de este mes contra el mes pasado.' },
  { title: '🎨 Cambiar la apariencia o el diseño', keywords: 'apariencia diseño tema color cambiar personalizar', body: 'En Ajustes → Apariencia puedes elegir entre varios diseños para que la app se vea como tú quieras. Hay diseños pensados para el negocio y, en "Tu diseño personal", el diseño original Matrix, solo para ti.' },
  { title: '🧩 Modo fácil', keywords: 'modo facil simple sencillo basico', body: 'El modo fácil simplifica la pantalla para que sea más sencillo de usar, ideal si alguien nuevo va a manejar la app.' },
  { title: '💾 Respaldo y transferir datos', keywords: 'respaldo backup transferir datos copia seguridad exportar importar puntos restauracion automatico', body: 'En Ajustes puedes descargar una copia de respaldo de toda tu información (productos, mesas, inventario, ventas) en un archivo, y luego restaurarla en este u otro dispositivo si algo pasa o si cambias de celular. Además, la app va guardando sola un punto de restauración interno cada día (Ajustes → Puntos de restauración), por si algo se daña por accidente y no alcanzaste a respaldar a tiempo.' },
  { title: '🏢 Varias sedes o negocios', keywords: 'sede sedes negocio negocios varios locales separar tienda cerveceria', body: 'Si manejas más de un negocio o local, en Ajustes → Sedes o negocios puedes agregar uno nuevo y cambiar entre ellos. Cada sede tiene sus propias mesas, productos, inventario y ventas, totalmente separados, pero todo desde la misma cuenta.' },
  { title: '🖨️ Imprimir el recibo de una mesa', keywords: 'imprimir recibo factura mesa cobrar papel', body: 'Al cobrar una mesa, junto a "Enviar captura por WhatsApp" hay un botón de "Imprimir recibo" para sacarlo en papel si tienes impresora conectada al celular o computador.' },
  { title: '👤 Agregar un usuario', keywords: 'agregar usuario cuenta nueva empleado crear cuenta', body: 'Puedes crear cuentas adicionales para que otras personas del negocio (empleados) usen la app con su propio usuario y contraseña.' },
  { title: '🔑 Recuperar contraseña', keywords: 'recuperar contraseña olvide clave acceso perdido restaurar', body: 'Si olvidaste tu contraseña, en la pantalla de inicio toca "¿Olvidaste tu contraseña?" para recuperarla por WhatsApp. Si perdiste el acceso por completo (celular nuevo, app reinstalada), usa "Restaura tu copia de respaldo" con el archivo que descargaste antes.' },
  { title: '📋 Carta o menú para clientes (QR)', keywords: 'carta menu qr clientes ver productos mas vendido destacado agotado orden', body: 'Puedes compartir un menú o carta para que tus clientes vean los productos disponibles, por ejemplo con un código QR. Se ve en tarjetas por categoría, con las promociones destacadas arriba de todo, lo más vendido primero, y lo agotado al final para no interrumpir la lectura.' },
  { title: '🌙 Cierre de caja', keywords: 'cierre caja dia cerrar jornada automatico manual resumen', body: 'Al final del día toca «🔒 Cerrar caja del día», arriba en Mesas (también está en Historial y, en el modo fácil, en «Hoy»). Antes de cerrar te pregunta y te muestra las ventas, el efectivo y las mesas abiertas. El cierre también puede ser automático; te resume las ventas del día y deja todo listo para el día siguiente.' },
  { title: '💵 Caja: base, entradas, salidas y arqueo', keywords: 'base caja sencillo abrir caja entrada salida efectivo pagar proveedor arqueo contar billetes monedas sobra falta descuadre', body: 'Historial → «💵 Caja: base, entradas y salidas»: abre la caja con su base, anota lo que entra o sale en efectivo (pago a proveedor, sencillo) y al «Cerrar caja del día» cuenta los billetes y monedas: ORDEVA te dice si sobra o falta.' },
  { title: '🔢 Inventario por código', keywords: 'codigo barras plu sku inventario conteo toma de inventario entrada mercancia llego pedido kardex movimientos escanear lector existencias', body: 'Inventario → «🔢 Inventario por código»: dale código a cada producto, escanea lo que llegó (entrada de mercancía), haz la toma de inventario contando con el lector y mira el kárdex de cada producto.' },
  { title: '💲 Precio por cantidad (mayorista)', keywords: 'precio mayorista al por mayor por cantidad descuento por volumen docena', body: 'Inventario → «🔢 Inventario por código» → consulta el producto → «Precio por cantidad»: por ejemplo, desde 6 unidades a $3.500 cada una. La caja lo cobra sola.' },
  { title: '↩️ Devoluciones', keywords: 'devolucion devolver cliente reembolso producto malo cambio', body: 'En el historial, abre la venta y toca «↩️ Devolución»: eliges qué devuelve, vuelve al inventario, la venta baja y el efectivo sale de la caja. Con facturación electrónica sale la nota crédito.' },
  { title: '🧾 Facturación electrónica DIAN', keywords: 'factura electronica dian cufe cude pos electronico documento equivalente resolucion nota credito', body: 'Ajustes → Negocio → «🧾 Facturación electrónica DIAN»: con tu resolución de numeración, cada venta sale validada por la DIAN con CUDE y código QR. Anular o devolver hace la nota crédito, y el cliente puede pedir factura a su nombre.' },
  { title: '💵 Propina al cobrar', keywords: 'propina redondeo cobrar cliente porcentaje', body: 'Actívala en Ajustes → Propina al cobrar. Cada vez que cobres una mesa, te pregunta si el cliente deja propina (10% o redondear el total) antes de cerrar la cuenta.' },
  { title: '👤 Ventas por empleado (turno)', keywords: 'empleado turno caja quien vendio cuanto', body: 'Si más de una persona maneja la caja con su propio usuario, en Estadísticas aparece cuánto vendió cada empleado en el período que estés viendo, sin que tengas que hacer nada extra.' },
  { title: '🤖 ORDEVA, tu asistente de IA', keywords: 'laya mesi asistente ia inteligencia artificial preguntar chat comandos hablar ayuda', body: 'Toca la carita con "IA" arriba a la derecha (o "Más" → ORDEVA). Puedes escribirle o hablarle. Te responde cuánto vendiste hoy, ayer o en el mes, quién te debe, qué mesas están abiertas, qué se está acabando, el precio o stock de un producto y tus mejores clientes; te lleva a cualquier sección ("abre inventario", "abre la mesa 3") y te explica cómo usar la app. También puede cambiar precios o sumar stock, siempre preguntándote antes. Escríbele "¿Qué sabes hacer?" para ver todo.' },
  { title: '💬 Soporte por WhatsApp', keywords: 'soporte ayuda whatsapp contacto problema falla ticket urgencia', body: 'Si algo no funciona o tienes una duda, en Ajustes → Guía y soporte elige qué tipo de solicitud es y qué tan urgente es, y te escribimos por WhatsApp con el mensaje ya armado y clasificado, para responderte más rápido si es algo urgente.' },
  { title: '🛵 Facturar un domicilio', keywords: 'domicilio domicilios entrega envio direccion cliente restaurante bar', body: 'Actívalo en Ajustes → Domicilios. Aparece un botón "🛵 Domicilio" junto a "Venta rápida" en Mesas: agrega los productos, y si quieres el nombre, teléfono, dirección del cliente y el valor del envío, sin necesidad de abrir una mesa.' },
  { title: '📥 Descargar las ventas en Excel', keywords: 'excel exportar ventas dia mes rango cierre descargar csv contabilidad personalizar', body: 'En Estadísticas, el botón "📥 Exportar ventas (Excel)" te deja elegir el período: hoy, ayer, este mes, un rango de fechas personalizado, o un cierre de caja específico. Descarga un archivo con el detalle de cada producto vendido (mesas, mostrador y domicilios), listo para abrir con Excel.' }
];

function guideMatchScore(entry, q){
  if(!q) return 1;
  const hay = (entry.title + ' ' + entry.keywords + ' ' + entry.body).toLowerCase();
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  let score = 0;
  for(const w of words){ if(hay.indexOf(w) !== -1) score++; }
  return score;
}

function renderGuideResults(){
  const inputEl = document.getElementById('guideSearchInput');
  const wrap = document.getElementById('guideResults');
  const detailsEl = document.getElementById('guideResultsWrap');
  const summaryEl = detailsEl ? detailsEl.querySelector('summary') : null;
  if(!inputEl || !wrap) return;
  const q = inputEl.value.trim();
  let list = guiaDelNegocio();
  if(q){
    list = guiaDelNegocio()
      .map(e => ({ e, score: guideMatchScore(e, q) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(x => x.e);
  }
  // Con una búsqueda escrita, la guía se abre sola para mostrar el resultado;
  // sin nada escrito vuelve a quedar recogida (así no se ve tan larga por
  // defecto), y el texto del desplegable dice cuántos temas hay adentro.
  if(detailsEl) detailsEl.open = !!q;
  if(summaryEl) summaryEl.textContent = q ? 'Resultados de la guía' : ('Ver toda la guía (' + guiaDelNegocio().length + ' temas)');
  if(!list.length){
    wrap.innerHTML = '<div class="guide-empty">No encontramos nada para "' + invEsc(q) + '". Escríbenos por WhatsApp con el botón de abajo y te ayudamos.</div>';
    return;
  }
  wrap.innerHTML = list.map(e => '<div class="guide-item"><strong>' + invEsc(e.title) + '</strong><span>' + invEsc(e.body) + '</span></div>').join('');
}

document.getElementById('guideSearchInput').addEventListener('input', renderGuideResults);
renderGuideResults();

/* ---------- Ajustes: Apariencia ---------- */
/* ---------- Ajustes: Apariencia ----------
   1.65.6 · Las apariencias, rediseñadas como un sistema: ninguna se parece a otra (fondo y color de acento distintos,
   medidos con la distancia de color CIE Lab) y en todas el texto se lee bien (contraste WCAG AA o más: letras sobre el
   fondo 7:1 o más, texto secundario 4,5:1, texto de los botones sobre el acento 4,5:1). Antes «Cervecería» y «Velitas»
   eran casi iguales (café oscuro y ámbar), y «Navidad» / «Turquesa» y «Noche» / «Halloween» tenían el mismo fondo.
   Grupos: claras (para el mostrador con mucha luz), oscuras (de noche, bares) y fechas especiales. La verificación está en
   pruebas/apariencias.test.js. Cada una dice qué color va encima de su acento (--on-amber): blanco u oscuro, el que se
   lea mejor (antes los botones tenían letra blanca fija y en los acentos claros casi no se leía). */
// o: g grupo · n nombre · bg fondo · s / s2 tarjetas · p / p2 papel (si no, las tarjetas) · ink letra · soft letra suave ·
// a acento · a2 acento oscuro · cr acento de títulos · r rojo · line líneas · ok verde de pagado · c2 c3 c5 categorías.
const pal = o => ({ name: o.n, grupo: o.g, fx: o.fx, recommended: !!o.rec, rain: false, vars: Object.assign(o.font ? { '--font-main': o.font } : {}, {
  '--bg': o.bg, '--surface': o.s, '--surface-2': o.s2, '--paper': o.p || o.s, '--paper-2': o.p2 || o.s2,
  '--ink': o.ink, '--ink-soft': o.soft, '--cream': o.cr || o.ink, '--cream-soft': o.crs || o.cr || o.soft,
  '--amber': o.a, '--amber-deep': o.a2, '--on-amber': textoSobre(o.a), '--brick': o.r, '--brick-soft': o.r2 || o.r,
  '--line': o.line, '--paid': o.ok, '--cat-1': o.a, '--cat-2': o.c2, '--cat-3': o.c3, '--cat-4': o.r, '--cat-5': o.c5, '--cat-6': o.ok }) });
// Blanco u oscuro sobre un color: el que tenga más contraste (WCAG).
function textoSobre(hex){
  const l = h => { const c = parseInt(String(h).slice(1), 16), v = x => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
    return 0.2126 * v(c >> 16 & 255) + 0.7152 * v(c >> 8 & 255) + 0.0722 * v(c & 255); };
  if(!/^#[0-9a-f]{6}$/i.test(String(hex))) return '#ffffff';
  const L = l(hex); return (1.05 / (L + 0.05)) >= ((L + 0.05) / (l('#101114') + 0.05)) ? '#ffffff' : '#101114';
}
const PALETTE_GRUPOS = [['claro', '☀️ Claras · para el mostrador con mucha luz'], ['oscuro', '🌙 Oscuras · de noche, bares y discotecas'], ['fecha', '🎉 Fechas especiales']];
const PALETTES = {
  // ORDEVA 2.0: la identidad de la marca. Blanco, negro y grises; el color solo dice algo (verde = bien / pagado, rojo =
  // error, naranja = pendiente, azul = información). La navegación lateral oscura la pone lib/ordeva2.js.
  ordeva2: pal({ n: '◐ ORDEVA 2.0', g: 'claro', rec: true, bg: '#f4f5f7', s: '#ffffff', s2: '#f1f2f4', ink: '#0d0e10', soft: '#5f6672', a: '#111214', a2: '#000000', cr: '#111214', r: '#dc2626', line: '#e4e6ea', ok: '#16a34a', c2: '#2563eb', c3: '#ea580c', c5: '#475569', font: "'Inter', 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }),
  apple: pal({ n: '☁️ Blanco nube', g: 'claro', bg: '#f2f2f7', s: '#ffffff', s2: '#e9e9ef', ink: '#1c1c1e', soft: '#6e6e73', a: '#0a6cff', a2: '#0050c8', cr: '#0a6cff', r: '#e0352b', line: '#e3e3e8', ok: '#248a3d', c2: '#8e44ad', c3: '#b8740a', c5: '#00838f' }),
  claro: pal({ n: '🍊 Mostrador mandarina', g: 'claro', bg: '#fbf8f4', s: '#ffffff', s2: '#f2ece4', ink: '#1f1a17', soft: '#6b625a', a: '#e8590c', a2: '#c2410c', cr: '#c2410c', r: '#d6293f', line: '#ebe3d8', ok: '#1f8a4c', c2: '#2563eb', c3: '#a87900', c5: '#7c3aed' }),
  cafe: pal({ n: '☕ Café con leche', g: 'claro', bg: '#f3ebde', s: '#fffdf9', s2: '#eadfcc', ink: '#3b2a1d', soft: '#75604f', a: '#8b5a2b', a2: '#6f4520', cr: '#6f4520', r: '#b23a2e', line: '#dccdb5', ok: '#4d7c3a', c2: '#3f7f8a', c3: '#a57a10', c5: '#7a5c9e' }),
  menta: pal({ n: '🌿 Menta fresca', g: 'claro', bg: '#eff7f3', s: '#ffffff', s2: '#e0efe7', ink: '#12261d', soft: '#4f665c', a: '#087a54', a2: '#066343', cr: '#066343', r: '#d33a3a', line: '#cfe3d8', ok: '#15803d', c2: '#2f6fd6', c3: '#b07a00', c5: '#8a4fd6' }),
  noche: pal({ n: '🌙 Noche violeta', g: 'oscuro', bg: '#0f0f16', s: '#17171f', s2: '#1e1e29', p: '#15151c', p2: '#1c1c26', ink: '#f2f1f7', soft: '#9a97ad', a: '#7c3aed', a2: '#5b21b6', cr: '#c4b5fd', crs: '#a78bfa', r: '#fb7185', r2: '#fda4af', line: '#2a2a38', ok: '#34d399', c2: '#22d3ee', c3: '#fbbf24', c5: '#60a5fa', font: "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }),
  nocturno: pal({ n: '🔷 Azul medianoche', g: 'oscuro', bg: '#0a1220', s: '#101a2c', s2: '#16233a', ink: '#e4eaf5', soft: '#93a3bf', a: '#2f6fe0', a2: '#1f55b8', cr: '#8fb8ff', r: '#f26d6d', line: '#22314d', ok: '#3fbf8f', c2: '#22c3e6', c3: '#e8b84a', c5: '#a78bfa' }),
  moderno: pal({ n: '🌊 Laguna turquesa', g: 'oscuro', bg: '#061b1c', s: '#0b2627', s2: '#103032', ink: '#e3faf7', soft: '#86b8b2', a: '#0d9488', a2: '#0b766c', cr: '#6fe3d3', r: '#f47272', line: '#1a4143', ok: '#3ccf91', c2: '#5aa9f0', c3: '#f0c04a', c5: '#c58af0' }),
  vito: pal({ n: '🍺 Cervecería ámbar', g: 'oscuro', bg: '#1b1208', s: '#241a0f', s2: '#2d2213', ink: '#fff3e0', soft: '#d2b48a', a: '#e39b2d', a2: '#b8770f', cr: '#ffcf6b', r: '#e2542d', line: '#3c2a17', ok: '#8bc34a', c2: '#4fb3bf', c3: '#ffd166', c5: '#c9a2ff' }),
  grafito: pal({ n: '⚫ Grafito y lima', g: 'oscuro', bg: '#111113', s: '#19191c', s2: '#222226', ink: '#f1f1f3', soft: '#a1a1aa', a: '#a3e635', a2: '#7cb518', cr: '#d9f99d', r: '#f87171', line: '#2e2e33', ok: '#34d399', c2: '#38bdf8', c3: '#facc15', c5: '#e879f9' }),
  navidad: pal({ n: '🎄 Navidad', g: 'fecha', fx: 'navidad', bg: '#0a1d14', s: '#0f2a1d', s2: '#153626', ink: '#f7f0e1', soft: '#b9cdb8', a: '#d62839', a2: '#a81d2b', cr: '#f4c542', r: '#ff7b8a', line: '#2a5a3e', ok: '#46c26a', c2: '#f4c542', c3: '#ffffff', c5: '#8ecae6' }),
  halloween: pal({ n: '🎃 Halloween', g: 'fecha', fx: 'halloween', bg: '#150a1f', s: '#1f0f2e', s2: '#2a163d', ink: '#f6ecff', soft: '#bda3d6', a: '#ff5a1f', a2: '#d4420c', cr: '#ffb15c', r: '#ff4d6d', line: '#3d2560', ok: '#7bd88f', c2: '#b388ff', c3: '#ffd166', c5: '#4dd0e1' }),
  sanvalentin: pal({ n: '💘 Amor y amistad', g: 'fecha', fx: 'sanvalentin', bg: '#1f0a14', s: '#2a0f1c', s2: '#361526', ink: '#ffeef3', soft: '#dba8b9', a: '#d42a78', a2: '#a81d5d', cr: '#ff8fa8', r: '#ff9f43', line: '#4a1b2e', ok: '#4cd97b', c2: '#f4c542', c3: '#b388ff', c5: '#ffd1dc' }),
  velitas: pal({ n: '🕯️ Día de las Velitas', g: 'fecha', fx: 'velitas', bg: '#0d0c26', s: '#16143a', s2: '#1f1c4b', ink: '#fff5dc', soft: '#bdb4dd', a: '#f5b301', a2: '#d49500', cr: '#ffe08a', r: '#ff6b6b', line: '#2e2a63', ok: '#8bd17c', c2: '#ff8a3d', c3: '#ffe08a', c5: '#9ad0ff' }),
  matrix: {
    name: '🟢 Original (Matrix)',
    rain: true,
    vars: {
      '--bg':'#000000', '--surface':'#050a05', '--surface-2':'#0a140a',
      '--paper':'#061006', '--paper-2':'#0a1a0a',
      '--ink':'#00ff41', '--ink-soft':'#0d9e2f',
      '--cream':'#00ff41', '--cream-soft':'#3ecb5e',
      '--amber':'#00ff41', '--amber-deep':'#00b32d', '--on-amber':'#101114',
      '--brick':'#ff3b3b', '--brick-soft':'#ff7a7a',
      '--line':'#0d3d16', '--paid':'#39d98a',
      '--cat-1':'#00ff41', '--cat-2':'#00d4ff', '--cat-3':'#ffd400',
      '--cat-4':'#ff3b3b', '--cat-5':'#b388ff', '--cat-6':'#ff9f1c'
    }
  },};

function applyPalette(key){
  const palette = PALETTES[key] || PALETTES.noche;
  const root = document.documentElement;
  // La tipografía es la única variable que no todos los temas traen (solo el
  // estilo Apple la cambia): si el tema elegido no la trae, hay que
  // devolverla a la de por defecto (removeProperty), si no se queda pegada
  // la tipografía del tema anterior al cambiar a otro que no la especifica.
  if(!('--font-main' in palette.vars)) root.style.removeProperty('--font-main');
  Object.entries(palette.vars).forEach(([k,v])=> root.style.setProperty(k, v));
  const rainCanvas = document.getElementById('matrixRain');
  if(rainCanvas) rainCanvas.style.display = (palette.rain && !(data && data.rainOff)) ? '' : 'none';
  document.querySelectorAll('.palette-card').forEach(card=>{
    card.classList.toggle('selected', card.dataset.key === key);
  });
  applyCustomColors();
  fxSet(motivoActual(palette.fx));
}
// El motivo elegido en Ajustes manda; «Según la temática» usa el de la paleta.
function motivoActual(deLaPaleta){ const m = data && data.motivo; return m === 'ninguno' ? null : (m || deLaPaleta || null); }
window.fxSet = fxSet;

// Modo fácil: agranda letras/botones y quita animaciones (gente mayor, táctil).
// Es aditivo: no cambia la paleta ni el resto del diseño, solo el tamaño/quietud.
function applyEasyMode(){
  const on = !!(data && data.easyMode);
  document.body.classList.toggle('easy-mode', on);
  try{ window.ventoFacil && window.ventoFacil.aplicar(); }catch(x){}   // la cáscara Vender / Hoy / Más (lib/vento-pos.js)
  const cb = document.getElementById('easyModeToggle');
  if(!cb) return;
  cb.checked = on;
  cb.onchange = async e => {
    data.easyMode = e.target.checked;
    document.body.classList.toggle('easy-mode', data.easyMode);
    try{ window.libretaFab && window.libretaFab(); }catch(x){}
    try{ window.ventoFacil && window.ventoFacil.aplicar(); }catch(x){}
    if(data.easyMode) showToast('🧓 Modo fácil prendido. Para volver a la app completa: «⋯ Más» → «Salir del modo fácil».', 6000);
    await saveData();
  };
}

// El diseño "Original (Matrix)" se deja aparte, en su propia sección: es el
// que Cristhian pidió tener solo para él, no para mostrarle al negocio. Los
// demás (incluidos los 3 nuevos pensados para verse bien y fáciles de leer
// para clientes/empleados) van juntos en la galería principal.
const PALETTE_PERSONAL_KEYS = ['matrix'];
function paletteCardHtml(key, p, current){
  // 1.65.6: vista previa de verdad (su fondo, una tarjeta, la letra y un botón «Cobrar» con su acento), no solo cuadritos.
  const v = p.vars, badge = p.recommended ? '<span class="palette-badge">Predeterminada</span>' : '';
  const prev = `<div class="palette-prev" style="background:${v['--bg']};color:${v['--ink']}">
      <div class="pp-card" style="background:${v['--surface']};border-color:${v['--line']}">
        <span class="pp-l1" style="background:${v['--ink']}"></span><span class="pp-l2" style="background:${v['--ink-soft']}"></span>
        <span class="pp-chips"><i style="background:${v['--cat-2']}"></i><i style="background:${v['--cat-3']}"></i><i style="background:${v['--paid']}"></i></span>
      </div>
      <span class="pp-btn" style="background:${v['--amber']};color:${v['--on-amber'] || '#fff'}">Cobrar</span>
    </div>`;
  return `<button type="button" class="palette-card${key===current?' selected':''}" data-key="${key}">
    ${badge}${prev}
    <div class="palette-name">${p.name}<span class="palette-check">✓</span></div>
  </button>`;
}
function renderPaletteOptions(){
  const grid = document.getElementById('paletteGrid');
  const personalGrid = document.getElementById('palettePersonalGrid');
  const current = data.theme || 'ordeva2';
  // 1.65.6: por grupos (claras, oscuras, fechas especiales), cada uno con su título.
  grid.innerHTML = PALETTE_GRUPOS.map(([g, titulo]) => {
    const l = Object.entries(PALETTES).filter(([key, p]) => p.grupo === g && !PALETTE_PERSONAL_KEYS.includes(key));
    return l.length ? '<div class="palette-grupo">' + titulo + '</div>' + l.map(([key, p]) => paletteCardHtml(key, p, current)).join('') : '';
  }).join('');
  // 1.66.6: «Volver a la que tenía» (la apariencia y la decoración de antes de ORDEVA 2.0).
  let volver = document.getElementById('o2Volver');
  const ant = data.o2Antes, pa = ant && ant.theme && PALETTES[ant.theme];
  if(pa && current === 'ordeva2'){
    if(!volver){ volver = document.createElement('div'); volver.id = 'o2Volver'; volver.className = 'o2-volver'; grid.parentNode.insertBefore(volver, grid); }
    volver.innerHTML = '<span>Tu negocio pasó al diseño <b>◐ ORDEVA 2.0</b>. ¿Prefieres la apariencia que tenías?</span><button type="button" class="btn-ghost" id="o2VolverBtn">↩ Volver a ' + pa.name + '</button>';
    volver.querySelector('button').onclick = async () => {
      data.theme = ant.theme; if(ant.motivo) data.motivo = ant.motivo; delete data.o2Antes;
      applyPalette(data.theme); renderPaletteOptions(); await saveData();
      showToast('↩ Volviste a ' + pa.name + '. ORDEVA 2.0 sigue en Apariencia para ponerlo cuando quieras.');
      if(typeof window.vitoPublicarCatalogo === 'function') window.vitoPublicarCatalogo(true);
    };
  } else if(volver) volver.remove();
  if(personalGrid){
    personalGrid.innerHTML = Object.entries(PALETTES).filter(([key])=>PALETTE_PERSONAL_KEYS.includes(key)).map(([key, p])=>paletteCardHtml(key, p, current)).join('');
  }
  document.querySelectorAll('#paletteGrid .palette-card, #palettePersonalGrid .palette-card').forEach(card=>{
    card.addEventListener('click', async ()=>{
      const key = card.dataset.key;
      data.theme = key;
      if(key !== 'ordeva2') delete data.o2Antes;   // ya eligió: no hace falta «Volver a la que tenía»
      applyPalette(key);
      renderPaletteOptions();
      await saveData();
      // Avisa de una vez a la página de pedidos (pedido.html) del cambio de
      // diseño, para que el cliente lo vea a juego sin esperar horas.
      // OJO: publicarCatalogo() vive en el cierre (IIFE) de otro bloque
      // <script>, así que desde aquí no es visible por su nombre normal;
      // por eso ese otro módulo la expone como window.vitoPublicarCatalogo.
      if(typeof window.vitoPublicarCatalogo === 'function') window.vitoPublicarCatalogo(true);
    });
  });
}

/* ---------- Fondo personalizado desde fotos locales ---------- */
function applyCustomBackground(){
  const el = document.getElementById('customBackground');
  if(!el) return;
  if(data && data.backgroundImage){
    el.style.backgroundImage = `url(${data.backgroundImage})`;
    el.style.display = 'block';
  }else{
    el.style.backgroundImage = '';
    el.style.display = 'none';
  }
  const status = document.getElementById('backgroundPhotoStatus');
  const remove = document.getElementById('backgroundRemoveBtn');
  if(status) status.textContent = data && data.backgroundImage ? 'Hay una foto personalizada guardada en este dispositivo.' : 'No hay una foto personalizada.';
  if(remove) remove.style.display = data && data.backgroundImage ? '' : 'none';
}

function resizeBackgroundImage(file, maxSize0, quality){
  return new Promise((resolve,reject)=>{
    if(!file || !file.type.startsWith('image/')) return reject(new Error('No es una imagen'));
    const reader = new FileReader();
    reader.onload = ()=>{
      const img = new Image();
      img.onload = ()=>{
        const maxSize = maxSize0 || 1600;
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;
        if(width > maxSize || height > maxSize){
          const scale = Math.min(maxSize/width, maxSize/height);
          width = Math.max(1, Math.round(width*scale));
          height = Math.max(1, Math.round(height*scale));
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img,0,0,width,height);
        resolve(canvas.toDataURL('image/jpeg', quality || 0.78));
      };
      img.onerror = ()=>reject(new Error('No se pudo leer la imagen'));
      img.src = reader.result;
    };
    reader.onerror = ()=>reject(new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });
}

function setupBackgroundPicker(){
  const btn = document.getElementById('backgroundGalleryBtn');
  const input = document.getElementById('backgroundGalleryInput');
  const remove = document.getElementById('backgroundRemoveBtn');
  if(btn && input) btn.onclick = ()=>input.click();
  if(input) input.onchange = async e=>{
    const file = e.target.files[0];
    input.value = '';
    if(!file) return;
    try{
      data.backgroundImage = await resizeBackgroundImage(file);
      await saveData();
      applyCustomBackground();
      showToast('Foto de fondo guardada.');
    }catch(err){
      showToast('No se pudo usar esa foto.');
    }
  };
  if(remove) remove.onclick = async ()=>{
    delete data.backgroundImage;
    await saveData();
    applyCustomBackground();
    showToast('Foto de fondo quitada.');
  };
}

function renderAll(){
  document.getElementById('brandName').value = data.businessName;
  updateMesaViewUI();
  renderProductos();
  renderPaletteOptions();
  setupBackgroundPicker();
  applyCustomBackground();
  setupColorPickers();
  cartaLabel();
}

/* ---------- Pago parcial: elegir qué productos se pagan ---------- */
const payPick = { table: null, person: null };   // selección pendiente antes de tocar "+"
let paySel = null;
const sameLine = (x, it) => x.productId === it.productId && (x.personId || null) === (it.personId || null);
function coveredQty(t, it, kind){   // kind: 'paid' | 'debe' | undefined (ambos)
  return (t.payments || []).reduce((s, p) => {
    if(!p.items) return s;
    if(kind === 'debe' && p.method !== 'debe') return s;
    if(kind === 'paid' && p.method === 'debe') return s;
    return s + p.items.filter(x => sameLine(x, it)).reduce((a, x) => a + x.qty, 0);
  }, 0);
}
function payItemsHtml(p){
  let h = (p.items && p.items.length) ? '<div class="li-paystatus">' + p.items.map(x => x.qty + ' ' + invEsc(x.name)).join(', ') + '</div>' : '';
  if(p.receiptId) h += '<button type="button" class="rcpt-view" data-rid="' + p.receiptId + '">📎 Ver comprobante</button>';
  return h;
}
function decoratePaidStatus(container, t){
  container.querySelectorAll('.li-remove[data-idx]').forEach(btn => {
    const it = t.items[parseInt(btn.dataset.idx, 10)];
    const row = btn.closest('.line-item');
    if(!it || !row) return;
    const paid = coveredQty(t, it, 'paid'), debe = coveredQty(t, it, 'debe');
    if(!paid && !debe) return;
    const falta = Math.max(0, it.qty - paid - debe);
    const bits = [];
    if(paid) bits.push('✔ Pagado ' + paid);
    if(debe) bits.push('📒 Debe ' + debe);
    bits.push(falta ? '⏳ Falta ' + falta : '✅ Completo');
    row.insertAdjacentHTML('afterend', '<div class="li-paystatus after' + (falta ? '' : ' done') + '">' + bits.join(' · ') + '</div>');
  });
}
function updatePayPickInfo(scope){
  const el = document.getElementById(scope === 'person' ? 'personPayPickInfo' : 'payPickInfo');
  const sel = payPick[scope], rc = pendingReceipt[scope];
  if(!el) return;
  if(!sel && !rc){ el.style.display = 'none'; el.textContent = ''; return; }
  const bits = [];
  if(sel) bits.push('Paga: ' + sel.map(x => x.qty + ' ' + x.name).join(', ') + ' · ' + fmt(sel.reduce((a, x) => a + x.price * x.qty, 0)));
  if(rc) bits.push('📎 Comprobante adjunto');
  el.style.display = 'block';
  el.textContent = bits.join(' · ');
}
function openPaySelect(scope){
  const t = data.tables[currentTable];
  const pend = payPick[scope] || [];
  const lines = (t.items || [])
    .filter(it => scope === 'person' ? it.personId === currentPersonId : !it.personId)
    .map(it => ({ it, rem: it.qty - coveredQty(t, it), sel: (pend.find(x => sameLine(x, it)) || {}).qty || 0 }))
    .filter(l => l.rem > 0);
  if(!lines.length){ showToast('No hay productos pendientes de pago en esta cuenta.'); return; }
  paySel = { scope, lines };
  renderPaySel();
  document.getElementById('paySelOverlay').classList.add('show');
}
function renderPaySel(){
  const box = document.getElementById('paySelList');
  box.innerHTML = '';
  let total = 0;
  paySel.lines.forEach((l, i) => {
    total += l.sel * l.it.price;
    const row = document.createElement('div');
    row.className = 'line-item';
    row.innerHTML = `<div><span class="li-name">${l.it.name}</span><div class="li-paystatus">${fmt(l.it.price)} · pendientes ${l.rem}</div></div>` +
      `<div class="qty-stepper"><button type="button" data-i="${i}" data-d="-1">−</button><input type="number" value="${l.sel}" readonly><button type="button" data-i="${i}" data-d="1">+</button></div>`;
    box.appendChild(row);
  });
  box.querySelectorAll('button').forEach(b => b.onclick = () => {
    const l = paySel.lines[b.dataset.i];
    l.sel = Math.min(l.rem, Math.max(0, l.sel + Number(b.dataset.d)));
    renderPaySel();
  });
  document.getElementById('paySelTotal').textContent = fmt(total);
}
const closePaySel = () => { document.getElementById('paySelOverlay').classList.remove('show'); paySel = null; };
document.getElementById('payPickBtn').addEventListener('click', () => openPaySelect('table'));
document.getElementById('personPayPickBtn').addEventListener('click', () => openPaySelect('person'));
document.getElementById('paySelAll').addEventListener('click', () => { paySel.lines.forEach(l => l.sel = l.rem); renderPaySel(); });
document.getElementById('paySelCancel').addEventListener('click', closePaySel);
document.getElementById('paySelOk').addEventListener('click', () => {
  const scope = paySel.scope;
  const ch = paySel.lines.filter(l => l.sel > 0).map(l => ({ productId: l.it.productId, name: l.it.name, price: l.it.price, qty: l.sel, personId: l.it.personId || null }));
  payPick[scope] = ch.length ? ch : null;
  if(ch.length) document.getElementById(scope === 'person' ? 'personPaymentAmount' : 'paymentAmount').value = ch.reduce((a, x) => a + x.price * x.qty, 0);
  updatePayPickInfo(scope);
  closePaySel();
});
