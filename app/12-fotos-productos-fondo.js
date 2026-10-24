/* ORDEVA · app/12-fotos-productos-fondo.js — antes estaba dentro de index.html (línea 25742). Se carga en el mismo lugar y orden. */
/* ================================================================
   Fotos de productos (con fondo blanco automático), transmisión al TV
   con la app de YouTube y autorreparación de errores con ORDEVA.
   ================================================================ */
// Funciones del módulo de QR/música (vive dentro de su propia función; ver window.vitoMod).
const vm = () => window.vitoMod || {};
const LS = (k, d) => { try{ return JSON.parse(localStorage.getItem(window.ventoClave(k))) || d; }catch(e){ return d; } };
const SS = (k, v) => { try{ localStorage.setItem(window.ventoClave(k), JSON.stringify(v)); }catch(e){} };

/* ---------- Fotos de productos ----------
   Las fotos se guardan en IndexedDB (no en los datos principales): así no
   llenan el localStorage ni se copian 7 veces en los puntos de restauración.
   El producto solo guarda p.foto = versión (fecha) para saber que tiene foto. */
const FOTO_DB = 'mesora-fotos';
const fotosCache = {};          // id de producto -> dataURL (400x400, fondo blanco)
let fotoDbP = null;
function fotoDb(){
  if(!fotoDbP) fotoDbP = new Promise((res, rej) => {
    const r = indexedDB.open(FOTO_DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('fotos');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return fotoDbP;
}
async function fotoTx(mode, fn){
  const db = await fotoDb();
  return new Promise((res, rej) => {
    const tx = db.transaction('fotos', mode), rq = fn(tx.objectStore('fotos'));
    tx.oncomplete = () => res(rq && rq.result);
    tx.onerror = () => rej(tx.error);
    tx.onabort = () => rej(tx.error);
  });
}
/* Fotos de productos sincronizadas: al guardarla o quitarla en un equipo también se sube o se borra en la nube
   (clave «foto/<id>»), y los demás equipos de la cuenta la bajan solos. Así el celular y el computador muestran
   las mismas fotos. `fotosVer` recuerda qué versión de cada foto (p.foto) tiene este equipo. */
const FOTOS_VER_K = 'vento-fotos-ver';
const fotosVer = (() => { try{ return JSON.parse(localStorage.getItem(FOTOS_VER_K) || '{}') || {}; }catch(e){ return {}; } })();
const fotosVerGuardar = () => { try{ localStorage.setItem(FOTOS_VER_K, JSON.stringify(fotosVer)); }catch(e){} };
const nubeArch = () => (window.ventoNube && window.ventoNube.enNube && window.ventoNube.enNube() && window.ventoNube.archivos) || null;
const fotoSetLocal = (id, url) => fotoTx('readwrite', st => st.put(url, id));
// Productos de los datos cargados (vacío antes de entrar a la cuenta, cuando todavía no hay datos).
const fotosProds = () => { try{ return (typeof data !== 'undefined' && data && data.products) || []; }catch(e){ return []; } };
const fotoSet = (id, url) => {
  const p = fotosProds().find(x => x.id === id); fotosVer[id] = p && p.foto || Date.now(); fotosVerGuardar();
  const n = nubeArch(); if(n) n.subir('foto/' + id, url);
  return fotoSetLocal(id, url);
};
const fotoDel = (id, soloAqui) => { delete fotosVer[id]; fotosVerGuardar(); const n = !soloAqui && nubeArch(); if(n) n.borrar('foto/' + id); return fotoTx('readwrite', st => st.delete(id)); };
// Baja de la nube las fotos que este equipo no tiene (o que cambiaron en otro equipo).
let fotosBajando = false;
async function fotosDeLaNube(){
  const n = nubeArch(); if(!n || fotosBajando) return 0;
  fotosBajando = true; let hechas = 0;
  try{
    const falta = fotosProds().filter(p => p.foto && (!fotosCache[p.id] || fotosVer[p.id] !== p.foto)).slice(0, 60);
    for(const p of falta){
      const url = await n.bajar('foto/' + p.id);
      if(url && /^data:image\//.test(url)){ fotosCache[p.id] = url; fotosVer[p.id] = p.foto; await fotoSetLocal(p.id, url).catch(() => {}); hechas++; }
      else if(fotosCache[p.id]){ fotosVer[p.id] = p.foto; hechas = hechas || 0; }   // la nube no la tiene: se queda la de aquí (no se vuelve a preguntar)
    }
    if(hechas){ fotosVerGuardar(); try{ renderProductos(); }catch(e){} try{ window.ventoFacil && window.ventoFacil.activo() && window.ventoFacil.pintar(); }catch(e){} }
  }finally{ fotosBajando = false; }
  return hechas;
}
window.fotosDeLaNube = fotosDeLaNube;
async function fotosCargar(){
  try{
    const db = await fotoDb();
    await new Promise((res, rej) => {
      const tx = db.transaction('fotos', 'readonly'), cur = tx.objectStore('fotos').openCursor();
      cur.onsuccess = () => { const c = cur.result; if(c){ fotosCache[c.key] = c.value; c.continue(); } };
      tx.oncomplete = res; tx.onerror = () => rej(tx.error);
    });
    // Limpia fotos de productos que ya no existen
    const ids = new Set((data.products || []).map(p => p.id));
    Object.keys(fotosCache).forEach(id => { if(!ids.has(id)){ delete fotosCache[id]; fotoDel(id, true).catch(() => {}); } });
    // Fotos que ya estaban en este equipo desde antes: se toman como la versión actual.
    let marco = false; (data.products || []).forEach(p => { if(p.foto && fotosCache[p.id] && fotosVer[p.id] == null){ fotosVer[p.id] = p.foto; marco = true; } }); if(marco) fotosVerGuardar();
    // Las fotos que este equipo todavía no tiene se bajan de la nube (y las que ya estaban aquí se suben si faltan).
    setTimeout(() => { fotosDeLaNube(); fotosALaNube(); }, 2500);
  }catch(e){ if(window.mesoraLogError) mesoraLogError('fotos', 'No se pudieron leer las fotos: ' + (e && e.message || e), 'fotosCargar'); }
}
// Una sola vez por equipo: las fotos que ya estaban guardadas aquí (de antes de sincronizar) se suben a la nube.
async function fotosALaNube(){
  const n = nubeArch(); if(!n) return;
  let hechas = {}; try{ hechas = JSON.parse(localStorage.getItem('vento-fotos-subidas') || '{}') || {}; }catch(e){}
  let cambio = false;
  for(const p of fotosProds()){
    if(!p.foto || !fotosCache[p.id] || hechas[p.id] === p.foto) continue;
    if(await n.subir('foto/' + p.id, fotosCache[p.id])){ hechas[p.id] = p.foto; cambio = true; }
  }
  if(cambio) try{ localStorage.setItem('vento-fotos-subidas', JSON.stringify(hechas)); }catch(e){}
}
function prodFotoThumbHtml(p){
  const u = p && p.foto && fotosCache[p.id];
  // Con foto: la miniatura (tocarla la cambia). Sin foto: un 📷 para subirla de una (cámara o galería).
  return u ? '<img class="p-thumb" src="' + u + '" alt="" loading="lazy" data-fotoprod="' + p.id + '" title="Cambiar foto">'
           : (p ? '<button type="button" class="p-thumb p-thumb-add" data-fotoprod="' + p.id + '" aria-label="Agregar foto">📷</button>' : '');
}
document.addEventListener('click', e => {
  const t = e.target.closest && e.target.closest('[data-fotoprod]'); if(!t) return;
  e.preventDefault(); e.stopPropagation();
  try{ openEditProductModal(t.dataset.fotoprod); setTimeout(() => { const i = document.getElementById('editProdPhotoInput'); if(i) i.click(); }, 120); }catch(x){}
}, true);
(function(){ const st = document.createElement('style'); st.textContent = '.p-thumb-add{display:inline-flex;align-items:center;justify-content:center;border:1.5px dashed var(--line);background:transparent;color:inherit;font-size:18px;cursor:pointer;padding:0}'; document.head.appendChild(st); })();

function fotoLeerImagen(file){
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); res(img); };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('No se pudo leer la imagen.')); };
    img.src = url;
  });
}

// Deja el producto sobre fondo blanco: toma el color del borde de la foto como
// "fondo", lo rellena desde las orillas hacia adentro (sin cruzar los bordes del
// producto), lo pinta de blanco con un borde suave y centra el producto en un
// cuadro blanco de 400x400. Funciona mejor con fotos sobre un fondo liso (mesa,
// pared, mostrador). Devuelve { blanco, original } como dataURL JPEG.
function fotoFondoBlanco(img){
  const MAX = 480, OUT = 400;
  let w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
  const k = Math.min(1, MAX / Math.max(w, h));
  w = Math.max(1, Math.round(w * k)); h = Math.max(1, Math.round(h * k));
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  cx.fillStyle = '#fff'; cx.fillRect(0, 0, w, h);
  cx.drawImage(img, 0, 0, w, h);
  const cuadro = (src, bx) => {       // centra la zona bx del canvas src en un cuadro blanco OUT x OUT
    const o = document.createElement('canvas'); o.width = o.height = OUT;
    const ox = o.getContext('2d'); ox.fillStyle = '#fff'; ox.fillRect(0, 0, OUT, OUT);
    const s = Math.min((OUT * 0.88) / bx.w, (OUT * 0.88) / bx.h);
    const dw = bx.w * s, dh = bx.h * s;
    ox.imageSmoothingQuality = 'high';
    ox.drawImage(src, bx.x, bx.y, bx.w, bx.h, (OUT - dw) / 2, (OUT - dh) / 2, dw, dh);
    return o.toDataURL('image/jpeg', 0.82);
  };
  const original = cuadro(cv, { x: 0, y: 0, w, h });

  const id = cx.getImageData(0, 0, w, h), d = id.data, N = w * h;
  // 1) Color del fondo = mediana de los píxeles del borde
  const R = [], G = [], B = [], border = [];
  for(let x = 0; x < w; x++){ border.push(x, (h - 1) * w + x); }
  for(let y = 1; y < h - 1; y++){ border.push(y * w, y * w + w - 1); }
  border.forEach(i => { R.push(d[i * 4]); G.push(d[i * 4 + 1]); B.push(d[i * 4 + 2]); });
  const med = a => { const b = a.slice().sort((x, y) => x - y); return b[b.length >> 1]; };
  const bg = [med(R), med(G), med(B)];
  const dist = (i, c) => { const r = d[i * 4] - c[0], g = d[i * 4 + 1] - c[1], b = d[i * 4 + 2] - c[2]; return Math.sqrt(r * r * 0.3 + g * g * 0.59 + b * b * 0.11) * 1.6; };
  let spread = 0; border.forEach(i => spread += dist(i, bg)); spread /= border.length;
  const T = Math.max(26, Math.min(70, 24 + spread * 1.4));   // tolerancia según qué tan parejo es el fondo
  // 2) Relleno desde las orillas
  const mask = new Uint8Array(N), q = new Int32Array(N);
  let qh = 0, qt = 0;
  border.forEach(i => { if(!mask[i] && dist(i, bg) < T){ mask[i] = 1; q[qt++] = i; } });
  while(qh < qt){
    const i = q[qh++], x = i % w, y = (i / w) | 0;
    const cur = [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]];
    const nb = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1];
    for(const j of nb){
      if(j < 0 || mask[j]) continue;
      if(dist(j, bg) < T && dist(j, cur) < T * 0.55){ mask[j] = 1; q[qt++] = j; }   // no cruza bordes marcados del producto
    }
  }
  const frac = qt / N;
  if(frac < 0.03 || frac > 0.97) return { blanco: original, original, sinCambio: true };   // no se distinguió el fondo
  // 3) Pinta el fondo de blanco con borde suave (promedio 3x3 de la máscara)
  const colN = new Uint32Array(w), rowN = new Uint32Array(h);
  for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){
    const i = y * w + x;
    let s = 0, n = 0;
    for(let yy = Math.max(0, y - 1); yy <= Math.min(h - 1, y + 1); yy++)
      for(let xx = Math.max(0, x - 1); xx <= Math.min(w - 1, x + 1); xx++){ s += mask[yy * w + xx]; n++; }
    const a = s / n;                       // 1 = fondo, 0 = producto
    if(a > 0){ const o = i * 4; d[o] += (255 - d[o]) * a; d[o + 1] += (255 - d[o + 1]) * a; d[o + 2] += (255 - d[o + 2]) * a; }
    if(!mask[i]){ colN[x]++; rowN[y]++; }
  }
  // Recorte: solo filas/columnas con suficiente "producto" (así una manchita suelta
  // del fondo no descentra la foto).
  const cMin = Math.max(2, h * 0.02), rMin = Math.max(2, w * 0.02);
  let minX = 0, maxX = w - 1, minY = 0, maxY = h - 1;
  while(minX < maxX && colN[minX] < cMin) minX++;
  while(maxX > minX && colN[maxX] < cMin) maxX--;
  while(minY < maxY && rowN[minY] < rMin) minY++;
  while(maxY > minY && rowN[maxY] < rMin) maxY--;
  cx.putImageData(id, 0, 0);
  const pad = Math.round(Math.max(maxX - minX, maxY - minY) * 0.04);
  const bx = { x: Math.max(0, minX - pad), y: Math.max(0, minY - pad) };
  bx.w = Math.min(w, maxX + pad + 1) - bx.x; bx.h = Math.min(h, maxY + pad + 1) - bx.y;
  return { blanco: cuadro(cv, bx.w > 4 && bx.h > 4 ? bx : { x: 0, y: 0, w, h }), original };
}

// Estado del modal "Editar producto": undefined = sin cambios, '' = quitar, dataURL = nueva
let prodFotoNueva, prodFotoAlt = null, prodFotoProd = null;
function prodFotoPintar(url){
  const box = document.getElementById('editProdPhoto');
  if(!box) return;
  box.innerHTML = url ? '<img src="' + url + '" alt="Foto del producto">' : '<span>📷</span>';
  document.getElementById('editProdPhotoDel').hidden = !url;
  document.getElementById('editProdPhotoBtn').textContent = url ? '📷 Cambiar foto' : '📷 Agregar foto';
}
function prodFotoModalAbrir(p){
  prodFotoProd = p; prodFotoNueva = undefined; prodFotoAlt = null;
  document.getElementById('editProdPhotoOrig').hidden = true;
  document.getElementById('editProdPhotoNote').textContent = 'El fondo se vuelve blanco automáticamente. Sale en la carta que ven los clientes.';
  prodFotoPintar(p.foto ? fotosCache[p.id] : '');
}
function prodFotoModalGuardar(p){
  if(prodFotoNueva === undefined) return;
  if(prodFotoNueva){
    fotosCache[p.id] = prodFotoNueva; p.foto = Date.now();
    fotoSet(p.id, prodFotoNueva).catch(e => { if(window.mesoraLogError) mesoraLogError('fotos', 'No se pudo guardar la foto: ' + (e && e.message || e), 'fotoSet'); showToast('⚠️ No se pudo guardar la foto en este dispositivo.'); });
  } else {
    delete fotosCache[p.id]; delete p.foto; fotoDel(p.id).catch(() => {});
  }
  prodFotoNueva = undefined;
  setTimeout(() => { try{ publicarFotosCarta(); }catch(e){} }, 1500);
}
function iniFotosProductos(){
  const inp = document.getElementById('editProdPhotoInput');
  document.getElementById('editProdPhotoBtn').onclick = () => inp.click();
  document.getElementById('editProdPhoto').onclick = () => inp.click();
  document.getElementById('editProdPhotoDel').onclick = () => { prodFotoNueva = ''; prodFotoAlt = null; document.getElementById('editProdPhotoOrig').hidden = true; prodFotoPintar(''); };
  document.getElementById('editProdPhotoOrig').onclick = () => {
    if(!prodFotoAlt) return;
    const t = prodFotoNueva; prodFotoNueva = prodFotoAlt; prodFotoAlt = t;
    const orig = document.getElementById('editProdPhotoOrig');
    orig.textContent = orig.textContent === 'Usar foto original' ? 'Usar fondo blanco' : 'Usar foto original';
    prodFotoPintar(prodFotoNueva);
  };
  inp.onchange = async () => {
    const f = inp.files && inp.files[0]; inp.value = '';
    if(!f) return;
    const box = document.getElementById('editProdPhoto'), note = document.getElementById('editProdPhotoNote');
    box.classList.add('busy'); note.textContent = 'Poniendo el fondo blanco…';
    try{
      await new Promise(r => setTimeout(r, 30));            // deja pintar el aviso antes del cálculo
      const r = fotoFondoBlanco(await fotoLeerImagen(f));
      prodFotoNueva = r.blanco; prodFotoAlt = r.sinCambio ? null : r.original;
      const orig = document.getElementById('editProdPhotoOrig');
      orig.hidden = !prodFotoAlt; orig.textContent = 'Usar foto original';
      note.textContent = r.sinCambio ? 'No distinguí bien el fondo; la dejé centrada sobre blanco. Para mejor resultado, toma la foto sobre una mesa o pared lisa.' : '✅ Fondo blanco listo. Toca «Guardar cambios».';
      prodFotoPintar(prodFotoNueva);
    }catch(e){
      note.textContent = '⚠️ ' + (e.message || 'No se pudo usar esa foto.');
    }finally{ box.classList.remove('busy'); }
  };
}

// La carta del cliente (pedido.html) recibe una miniatura de cada foto por un canal
// aparte del canal de ORDEVA (topic + 'f'), una por mensaje (el canal de ORDEVA admite ~4 KB por mensaje).
// Se reenvían cada 10 h porque el canal de ORDEVA guarda los mensajes 12 h.
const FOTO_PUB_KEY = 'vito_fotos_pub';
let fotoPubCorriendo = false;
function fotoMiniatura(url){
  return new Promise(res => {
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement('canvas'); let side = 110, qual = 0.62, out = '';
      for(let n = 0; n < 8; n++){
        cv.width = cv.height = side;
        const c = cv.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, side, side); c.drawImage(img, 0, 0, side, side);
        out = cv.toDataURL('image/jpeg', qual);
        if(out.length < 3300) break;
        if(qual > 0.4) qual -= 0.08; else side -= 12;
      }
      res(out.length < 3500 ? out : '');
    };
    img.onerror = () => res('');
    img.src = url;
  });
}
async function publicarFotosCarta(){
  if(fotoPubCorriendo || !vm().qCfg) return;
  const c = vm().qCfg();
  if(!c || !c.topic || !c.live || !navigator.onLine) return;
  fotoPubCorriendo = true;
  try{
    const pub = LS(FOTO_PUB_KEY, {}), now = Date.now(), porEnviar = [];
    (data.products || []).forEach(p => {
      if(!p.foto || !fotosCache[p.id]) return;
      const k = p.foto + '|' + p.name, prev = pub[p.id];
      if(!prev || prev.k !== k || now - prev.t > 10 * 36e5) porEnviar.push({ id: p.id, n: p.name, k, url: fotosCache[p.id], oldN: prev && prev.n !== p.name ? prev.n : '' });
    });
    Object.keys(pub).forEach(id => { const p = (data.products || []).find(x => x.id === id); if(!p || !p.foto) porEnviar.push({ id, n: pub[id].n, borrar: true }); });
    for(const it of porEnviar){
      const msgs = [];
      if(it.borrar) msgs.push({ n: it.n, i: '' });
      else { const mini = await fotoMiniatura(it.url); if(!mini) continue; if(it.oldN) msgs.push({ n: it.oldN, i: '' }); msgs.push({ n: String(it.n).slice(0, 40), i: mini }); }
      for(const m of msgs){
        const r = await fetch('https://canal.vento.local/' + c.topic + 'f', { method: 'POST', body: JSON.stringify(m) });
        if(!r.ok) throw new Error('canal ' + r.status);
        await new Promise(r2 => setTimeout(r2, 2500));        // sin saturar el límite del canal de ORDEVA
      }
      if(it.borrar) delete pub[it.id]; else pub[it.id] = { k: it.k, n: it.n, t: Date.now() };
      SS(FOTO_PUB_KEY, pub);
    }
  }catch(e){ /* sin internet o el canal de ORDEVA ocupado: se reintenta en el próximo ciclo */ }
  finally{ fotoPubCorriendo = false; }
}

/* ---------- Transmitir al TV con la app de YouTube ----------
   Un navegador no puede elegir el televisor por su cuenta: lo que sí se puede
   es abrir la app de YouTube ya reproduciendo la lista, y la app transmite al
   TV (si ya estaba conectada, sigue sonando allá sola). Con Google conectado
   la lista es la de tu cuenta y las canciones nuevas se agregan en vivo. */
const CAST_KEY = 'vito_cast';
function castOn(){ return !!LS(CAST_KEY, {}).on; }
// Canciones que llegaron después de abrir YouTube: la app de YouTube / YouTube Music carga la
// lista UNA vez al empezar, así que las nuevas hay que mandarlas volviendo a abrirla (un toque).
function castNuevas(){
  const c = LS(CAST_KEY, {});
  if(!c.on) return [];
  const l = vm().cola ? vm().cola() : [];
  return (vm().yTok && vm().yTok()) ? l.filter(x => (x.yt === true && !x.enviado) || (!x.done && !x.novid)) : l.filter(x => !x.done && !x.novid);
}
function castEstado(){
  const e = document.getElementById('castEstado'); if(!e) return;
  const c = LS(CAST_KEY, {}), g = !!(vm().yTok && vm().yTok());
  document.getElementById('castStop').hidden = !c.on;
  castDevsPintar();
  const vin = LS(PAIR_KEY, {}).ok ? ' · 🔗 TV vinculado con código' : '';
  if(!c.on){ e.textContent = (g ? '🟢 Google conectado: las canciones pedidas se agregan solas a tu lista de YouTube.' : '⚪ Sin Google conectado: YouTube abre la primera canción de la cola. Conecta Google abajo (una sola vez) para que la lista completa se arme y se actualice sola.') + vin; return; }
  const nuevas = castNuevas().length, rb = document.getElementById('castRefresh');
  if(rb){ rb.hidden = !nuevas; rb.textContent = '▶ Mandar ' + (nuevas === 1 ? 'la canción nueva' : 'las ' + nuevas + ' canciones nuevas') + ' al TV'; }
  const pend = vm().cola().filter(x => !x.done).length;
  e.textContent = '📡 Transmitiendo desde ' + new Date(c.desde).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' }) + (g ? ' · las canciones nuevas se agregan solas a tu lista de YouTube' : ' · sin Google: cada canción nueva se manda con «Mandar al TV»') + (pend ? ' · ' + pend + ' por agregar' : '') + '.' + vin;
}
// Abre la APP de YouTube (nunca el navegador). En Android se le pide la app por su
// paquete exacto (com.google.android.youtube); si no está instalada, Android abre la
// Play Store para instalarla. En iPhone se usa youtube:// y, si no está, el App Store.
// El link "watch_videos" (lista sin cuenta) NO lo abre la app de YouTube — por eso antes
// terminaba en el navegador —, así que ya no se usa: la app recibe siempre un video
// (watch?v=) o una lista real de tu cuenta (list=).
const YT_ANDROID_PKG = 'com.google.android.youtube';
function ytAppUrl(path){
  const ua = navigator.userAgent;
  if(window.esAndroid()) return { url: 'intent://www.youtube.com/' + path + '#Intent;scheme=https;package=' + YT_ANDROID_PKG + ';action=android.intent.action.VIEW;end', tipo: 'android' };
  if(/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return { url: 'youtube://www.youtube.com/' + path, tipo: 'ios' };
  return { url: 'https://www.youtube.com/' + path, tipo: 'pc' };
}
function abrirEnAppYouTube(path){
  const d = ytAppUrl(path);
  if(d.tipo === 'pc'){ window.open(d.url, '_blank'); return; }   // en computador no hay app: se abre youtube.com
  if(d.tipo === 'ios'){
    const t = setTimeout(() => { if(!document.hidden) location.href = 'https://apps.apple.com/app/youtube/id544007664'; }, 2000);
    document.addEventListener('visibilitychange', () => clearTimeout(t), { once: true });
    location.href = d.url; return;
  }
  abrirIntent(d.url);                                          // cambia a la app de YouTube; esta pantalla queda abierta detrás
}
// Los navegadores solo dejan abrir otra app justo después de un toque. Si preparar la lista
// tardó (buscar canciones, conectar Google), se pide un toque más con un botón grande.
function castLanzar(path, aviso){
  const act = navigator.userActivation;
  if(!act || act.isActive){ abrirAppElegida(path); if(aviso) showToast(aviso, 8000); return; }
  let ov = document.getElementById('castGoOverlay');
  if(!ov){
    ov = document.createElement('div'); ov.id = 'castGoOverlay'; ov.className = 'overlay';
    ov.innerHTML = '<div class="modal" style="max-width:380px;text-align:center"><h2>📺 Lista lista</h2><div class="modal-sub" id="castGoTxt"></div>' +
      '<div class="modal-actions" style="flex-direction:column;gap:8px"><button class="btn-primary" id="castGoBtn" type="button" style="width:100%;padding:14px;font-size:16px">▶ Abrir YouTube y elegir el TV</button>' +
      '<button class="btn-close" id="castGoNo" type="button">Cancelar</button></div></div>';
    document.body.appendChild(ov);
    ov.querySelector('#castGoNo').onclick = () => ov.classList.remove('show');
  }
  ov.querySelector('#castGoTxt').textContent = aviso || '';
  ov.querySelector('#castGoBtn').onclick = () => { ov.classList.remove('show'); abrirAppElegida(path); };
  ov.classList.add('show');
}
const CAST_AVISO = '📺 Toca el ícono de transmitir (arriba) y elige tu TV: ahí salen todos tus dispositivos. Si ya estaba conectado, suena directo en el TV.';
let castEsperaGoogle = 0, castAvisadas = 0;
// Muestra el botón grande «Mandar al TV» (hace falta un toque para abrir YouTube).
function castLanzarNuevas(){
  const n = castNuevas().length;
  let ov = document.getElementById('castNewOverlay');
  if(!ov){
    ov = document.createElement('div'); ov.id = 'castNewOverlay'; ov.className = 'overlay';
    ov.innerHTML = '<div class="modal" style="max-width:380px;text-align:center"><h2>🎵 Canciones nuevas</h2><div class="modal-sub" id="castNewTxt"></div>' +
      '<div class="modal-actions" style="flex-direction:column;gap:8px"><button class="btn-primary" id="castNewGo" type="button" style="width:100%;padding:14px;font-size:16px">▶ Mandar al TV</button>' +
      '<button class="btn-close" id="castNewNo" type="button">Ahora no</button></div></div>';
    document.body.appendChild(ov);
    ov.querySelector('#castNewNo').onclick = () => ov.classList.remove('show');
    ov.querySelector('#castNewGo').onclick = () => { ov.classList.remove('show'); transmitirTV(); };
  }
  ov.querySelector('#castNewTxt').textContent = (n === 1 ? 'Pidieron 1 canción' : 'Pidieron ' + n + ' canciones') + ' desde que abriste ' + (castApp() === 'yt' ? 'YouTube' : 'YouTube Music') + '. Toca para mandarlas al TV (se abre la app con la lista actualizada).';
  ov.classList.add('show');
}

/* App con la que se transmite. La lista de dispositivos (YouTube on TV, Smart TV LG/Samsung,
   Chromecast…) solo la puede armar la propia app de YouTube / YouTube Music: los buscan con
   protocolos de red local a los que una página web no tiene acceso (Chrome solo vería los
   Chromecast). Por eso se abre directo la app elegida con la lista y ahí se toca transmitir. */
const CAST_APP_KEY = 'vito_cast_app';
function castApp(){ return LS(CAST_APP_KEY, { app: 'music' }).app === 'yt' ? 'yt' : 'music'; }
function castAppPintar(){
  document.querySelectorAll('#castApp button').forEach(b => b.classList.toggle('on', b.dataset.app === castApp()));
}
// Abre un intent/esquema de app con un enlace tocado: Chrome y Samsung Internet lo mandan a la app
// instalada (sin pasar por el navegador); si la app no está, Android abre la Play Store.
function abrirIntent(url){
  const a = document.createElement('a'); a.href = url; a.rel = 'noopener'; a.style.display = 'none';
  document.body.appendChild(a); a.click(); setTimeout(() => a.remove(), 500);
}
function abrirAppElegida(path){
  if(castApp() === 'yt') return abrirEnAppYouTube(path);
  const ua = navigator.userAgent;
  if(window.esAndroid()) abrirIntent('intent://music.youtube.com/' + path + '#Intent;scheme=https;package=com.google.android.apps.youtube.music;action=android.intent.action.VIEW;end');
  else if(/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)){
    // Intenta la app de YouTube Music; si no está instalada, abre la versión web.
    if(window.abrirYTMusicIOS) window.abrirYTMusicIOS(path); else location.href = 'https://music.youtube.com/' + path;
  } else window.open('https://music.youtube.com/' + path, '_blank');
}
function castBuscarYTransmitir(){ transmitirTV(); }

/* Entorno y estado de la transmisión. Chromecast / Google TV / Android TV se manejan más abajo
   (ccTransmitir): abren la app de YouTube del TV. Los Smart TV LG/Samsung sin Chromecast se
   conectan con «Vincular con código de TV» (sección YouTube del TV). */
const MESORA_VERSION = '2026-10-24 · v1.59.2';
// Visible en Ajustes: así se puede confirmar de un vistazo si la app ya tomó la última versión.
try{ const ve = document.getElementById('appVersionEl'); if(ve) ve.textContent = 'ORDEVA · versión ' + MESORA_VERSION.split('·').pop().trim() + ' (' + MESORA_VERSION.split('·')[0].trim() + ')'; }catch(e){}
/* 🔄 La app Android se actualiza SOLA (Actualizador): revisa cada 3 h, baja la versión nueva y la instala cuando no se
   está usando ORDEVA. Aquí: el estado en Ajustes y, si falta, el permiso de Android que se da UNA vez («Instalar apps
   desconocidas» para ORDEVA). La página (casi todo ORDEVA) ya se actualiza sola siempre. */
(function(){
  const A = () => window.VentoAndroid && window.VentoAndroid.actualizacionEstado ? window.VentoAndroid : null;
  const est = () => { try{ return JSON.parse(A().actualizacionEstado() || '{}'); }catch(e){ return {}; } };
  const LUEGO = 'vento-act-luego';
  function pintar(){
    const a = A(), el = document.getElementById('appActEl');
    // App Android sin el actualizador (antes de la 1.0.36): una última instalación a mano (el aviso de pagos ya lo dice).
    if(!a && window.VentoAndroid){
      const ps = document.getElementById('pgSalud'), yaDice = ps && !ps.hidden && ps.dataset.k === 'vieja';
      let luego = 0; try{ luego = Number(localStorage.getItem(LUEGO)) || 0; }catch(x){}
      if(el){ el.hidden = false; el.innerHTML = '📲 Tu app Android todavía no se actualiza sola. <a href="https://github.com/cristhianlujan45-blip/ORDEVA/releases/latest/download/vento.apk" download="vento.apk" rel="noopener">⬇️ Instálala una última vez</a>'; }
      banner(!yaDice && Date.now() > luego ? 'vieja' : ''); return null;
    }
    if(!a){ if(el) el.hidden = true; banner(''); return null; }
    const e = est(), hay = e.nueva > e.codigo;
    if(el){
      el.hidden = false;
      el.innerHTML = '📲 App Android ' + (e.nombre || '') + ' · ' + (!e.permiso ? '⚠️ falta el permiso para actualizarse sola <button type="button" class="btn-ghost" data-act="permiso" style="padding:4px 10px">🔓 Permitir</button>'
        : hay ? '🔄 hay una nueva (' + (e.nuevaNombre || '') + '): se instala sola cuando no estés usando ORDEVA <button type="button" class="btn-ghost" data-act="ahora" style="padding:4px 10px">Actualizar ahora</button>'
        : '✅ se actualiza sola') + (e.estado && /error|no se pudo|confirmes/.test(e.estado) ? '<br><small>' + String(e.estado).replace(/[<>&]/g, '') + '</small>' : '');
    }
    let luego = 0; try{ luego = Number(localStorage.getItem(LUEGO)) || 0; }catch(x){}
    // Hay una versión nueva esperando (p. ej. Android pide confirmar «Actualizar» la primera vez): un toque la instala.
    banner(!e.permiso && Date.now() > luego ? 'permiso' : hay && Date.now() > luego ? 'nueva' : '');
    return e;
  }
  // Sale UNA vez cada vez que se abre ORDEVA y se esconde sola a los 20 s; deja pasar los toques (solo sus botones
  // responden). En Ajustes queda siempre el estado y el botón.
  let mostrado = '', escondeT = null;
  function banner(k){
    let b = document.getElementById('actBanner');
    if(!k){ if(b) b.hidden = true; return; }
    if(mostrado === k) return;
    mostrado = k;
    clearTimeout(escondeT);   // (ya no se esconde sola: queda en la 🔔 campanita hasta «Actualizar» o «Luego»)
    if(!b){
      b = document.createElement('div'); b.id = 'actBanner'; b.setAttribute('role', 'status');
      b.style.cssText = 'position:fixed;left:8px;right:8px;bottom:calc(84px + env(safe-area-inset-bottom,0px));z-index:9997;background:#1e3a8a;color:#fff;border-radius:14px;padding:10px 12px;font-size:14px;line-height:1.4;box-shadow:0 6px 20px rgba(0,0,0,.35);pointer-events:none';
      document.body.appendChild(b);
    }
    if(k === 'nueva'){ const e = est();
      b.innerHTML = '<style>#actBanner a,#actBanner button{pointer-events:auto}</style><div>🔄 <b>Hay una versión nueva de ORDEVA' + (e.nuevaNombre ? ' (' + String(e.nuevaNombre).replace(/[<>&]/g, '') + ')' : '') + '</b>: trae arreglos de los pagos. Se instala en segundos y ORDEVA vuelve sola.</div>' +
        '<div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap"><button type="button" data-act="ahora" style="background:#fff;color:#1e3a8a;border:0;border-radius:10px;padding:7px 12px;font-weight:800">🔄 Actualizar ahora</button><button type="button" data-act="luego" style="background:transparent;color:#fff;border:1px solid rgba(255,255,255,.6);border-radius:10px;padding:6px 10px">Luego</button></div>';
      b.hidden = false; return; }
    b.innerHTML = '<style>#actBanner a,#actBanner button{pointer-events:auto}</style>' + (k === 'vieja' ? '<div>📲 <b>Instala la app ORDEVA nueva una última vez</b>: desde esa versión se actualiza sola, sin instalar a mano.</div>' : '<div>🔄 <b>Que ORDEVA se actualice sola</b>, sin descargar ni instalar a mano: dale un permiso una sola vez.</div>') +
      '<div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">' + (k === 'vieja' ? '<a href="https://github.com/cristhianlujan45-blip/ORDEVA/releases/latest/download/vento.apk" download="vento.apk" rel="noopener" style="background:#fff;color:#1e3a8a;border-radius:10px;padding:7px 12px;font-weight:800;text-decoration:none">⬇️ Instalar la nueva</a>' : '<button type="button" data-act="permiso" style="background:#fff;color:#1e3a8a;border:0;border-radius:10px;padding:7px 12px;font-weight:800">🔓 Dar el permiso</button>') + '<button type="button" data-act="luego" style="background:transparent;color:#fff;border:1px solid rgba(255,255,255,.6);border-radius:10px;padding:6px 10px">Luego</button></div>';
    b.hidden = false;
  }
  document.addEventListener('click', ev => {
    const x = ev.target.closest && ev.target.closest('[data-act]'); if(!x) return;
    const k = x.dataset.act;
    if(k === 'luego'){ try{ localStorage.setItem(LUEGO, String(Date.now() + 3 * 864e5)); }catch(e){} banner(''); return; }
    if(!A()) return;
    if(k === 'permiso'){ try{ A().actualizacionPermiso(); }catch(e){} showToast('En la pantalla que se abre, activa «Permitir de esta fuente» para ORDEVA y vuelve. Desde ahí ORDEVA se actualiza sola.', 10000); }
    else if(k === 'ahora'){ try{ A().actualizarAhora(); }catch(e){} showToast('🔄 Bajando la versión nueva… Si Android pregunta «¿Actualizar?», toca «Actualizar» (solo esta vez: después ORDEVA se actualiza sola, sin preguntar). ORDEVA se cierra un momento y vuelve sola.', 12000); }
    else if(k === 'luego'){ try{ localStorage.setItem(LUEGO, String(Date.now() + 3 * 864e5)); }catch(e){} banner(''); }
  });
  window.ventoActualizacion = { pintar };
  setTimeout(pintar, 3000); setInterval(pintar, 60000);
  document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'visible') setTimeout(pintar, 800); });
})();
// Si el navegador (o el celular, con la app agregada a la pantalla de inicio) se quedó con
// una versión vieja guardada, antes no había forma de saberlo desde adentro — parecía que "la
// app no carga bien" o "el diseño se ve raro", sin ningún aviso. Ahora, de vez en cuando, se
// vuelve a pedir esta misma página (sin usar la caché) y se compara la versión que trae contra
// la que está corriendo; si son distintas, aparece un aviso para actualizar con un toque.
// Se consulta el archivo pequeñito version.txt (unos bytes) — antes se volvía a bajar la
// app entera (más de 14 MB) cada vez que se abría, lo que la ponía lenta con datos móviles.
let mesoraUltimaRevision = 0;
function mesoraRevisarVersionNueva(){
  if(location.protocol === 'file:') return;
  if(Date.now() - mesoraUltimaRevision < 60000) return;
  mesoraUltimaRevision = Date.now();
  fetch(new URL('version.txt', location.href).href + '?t=' + Date.now(), { cache: 'no-store' })
    .then(r => r.ok ? r.text() : '').then(t => {
      const v = String(t || '').trim();
      if(v && v.length < 60 && v.indexOf('·') > 0 && v !== MESORA_VERSION) mesoraAvisoVersionNueva(v);
    }).catch(() => {});
}
function mesoraAvisoVersionNueva(nueva){
  if(document.getElementById('mesoraNuevaVersion')) return;
  const b = document.createElement('div');
  b.id = 'mesoraNuevaVersion';
  // Arriba, no abajo: abajo es donde vive el botón flotante del micrófono (que además se
  // puede arrastrar a cualquier lado), así este aviso nunca lo tapa ni se le monta encima.
  b.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:99999;background:#2d7d46;color:#fff;padding:12px 16px;display:flex;gap:10px;align-items:center;justify-content:center;flex-wrap:wrap;font:600 14px system-ui;box-shadow:0 4px 16px rgba(0,0,0,.3)';
  b.innerHTML = '<span>🔄 Hay una versión nueva de ORDEVA (' + String(nueva).split('·').pop().trim() + '). Actualízala para que todo funcione bien.</span>' +
    '<button type="button" style="background:#fff;color:#2d7d46;border:0;border-radius:8px;padding:8px 16px;font:700 14px system-ui;cursor:pointer">Actualizar ahora</button>';
  b.querySelector('button').onclick = () => location.reload();
  document.body.appendChild(b);
}
setInterval(() => { if(document.visibilityState === 'visible') mesoraRevisarVersionNueva(); }, 5 * 60000);
document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'visible') mesoraRevisarVersionNueva(); });
setTimeout(mesoraRevisarVersionNueva, 4000);
let presDisp = null, presConn = null;
function presUrl(){ const u = vm().tvUrl ? vm().tvUrl() : ''; return u ? u.replace('tv.html#', 'tv.html?auto=1#') : ''; }
function presSoportado(){ return 'PresentationRequest' in window && !!navigator.presentation; }
function castEntorno(){
  const ua = navigator.userAgent;
  if(!window.VentoAndroid && /; wv\)|FBAN|FBAV|Instagram|WhatsApp|Line\/|GSA\//.test(ua)) return { bad: true, t: '⚠️ ORDEVA está abierta DENTRO de otra app (no en Chrome). Así el celular no deja abrir YouTube ni buscar televisores. Ábrela en Chrome (copia su dirección y pégala en Chrome) o instálala desde el menú de Chrome.' };
  if(location.protocol === 'file:') return { bad: true, t: '⚠️ ORDEVA está abierta como archivo. Ábrela desde su dirección https para transmitir.' };
  if(/SamsungBrowser/.test(ua)) return { t: 'Samsung Internet: los botones de YouTube funcionan; para buscar Chromecast/Google TV abre ORDEVA en Chrome.' };
  if(!/iPhone|iPad/.test(ua) && !window.esAndroid()) return { t: 'Computador: aquí no hay app de YouTube (se abre youtube.com).' };
  return { t: '✅ Listo para transmitir.' };
}
function castDevsPintar(){
  const box = document.getElementById('castDevs'), t = document.getElementById('castDevsTxt');
  if(!box) return;
  if(ccSes){ ccPintar(); return; }
  if(typeof lngOn === 'function' && lngOn() && !box.classList.contains('busy') && lng.error && !lng.sid){ box.hidden = false; box.classList.remove('ok'); box.classList.add('no'); t.textContent = '⚠️ «' + (lngCfg().nombre || 'TV') + '» no contesta: ' + lng.error + ' ORDEVA lo sigue intentando solo.'; return; }
  if(typeof lngOn === 'function' && lngOn() && !box.classList.contains('busy') && lngTVEnLinea() === false){ box.hidden = false; box.classList.remove('ok'); box.classList.add('no'); t.textContent = '📴 «' + (lngCfg().nombre || 'TV') + '» no responde ahora (apagado o en otra red). Toca «Transmitir al TV» y elige uno de este wifi.'; return; }
  if(typeof lngOn === 'function' && lngOn() && !box.classList.contains('busy')){ box.hidden = false; box.classList.remove('no'); box.classList.add('ok'); t.textContent = '📺 Conectado a «' + (lngCfg().nombre || 'TV') + '»' + (lng.tvSt === 1 ? ' · sonando ahora' : '') + ': las canciones de las mesas suenan allá solas. Abajo ves en vivo lo que suena.'; return; }
  box.classList.remove('ok', 'no', 'busy');
  box.hidden = !((presConn && presConn.state === 'connected') || presDisp === true);
  if(presConn && presConn.state === 'connected'){ box.classList.add('ok'); t.textContent = '📡 Transmitiendo a tu dispositivo: la música de las mesas suena allá en vivo.'; return; }
  if(!presSoportado()){ box.hidden = true; return; }
  if(presDisp === true){ box.classList.add('ok'); t.textContent = 'Hay un TV en tu wifi: toca «Transmitir al TV» y elígelo.'; }
  else if(presDisp === false){ box.hidden = true; }
  else { box.hidden = true; }
}
// No hay Chromecast: su TV es un Smart TV (LG/Samsung) que solo ve la app de YouTube.
function castSinChromecast(){
  let ov = document.getElementById('castNoCcOverlay');
  if(!ov){
    ov = document.createElement('div'); ov.id = 'castNoCcOverlay'; ov.className = 'overlay';
    ov.innerHTML = '<div class="modal" style="max-width:400px;text-align:center"><h2>📺 Tu TV se abre con YouTube</h2>' +
      '<div class="modal-sub">En tu wifi no hay Chromecast. Tu TV (LG, Samsung o «YouTube on TV») lo encuentra la app de YouTube: ábrela y toca el ícono de transmitir.</div>' +
      '<div class="modal-actions" style="flex-direction:column;gap:8px">' +
      '<button class="btn-primary" id="ccMusic" type="button" style="width:100%;padding:13px;font-size:15px">▶ Abrir YouTube Music</button>' +
      '<button class="btn-primary" id="ccYT" type="button" style="width:100%;padding:13px;font-size:15px">▶ Abrir YouTube</button>' +
      '<button class="btn-close" id="ccNo" type="button">Cerrar</button></div></div>';
    document.body.appendChild(ov);
    ov.querySelector('#ccMusic').onclick = () => { ov.classList.remove('show'); SS(CAST_APP_KEY, { app: 'music' }); castAbrirApp(); };
    ov.querySelector('#ccYT').onclick = () => { ov.classList.remove('show'); SS(CAST_APP_KEY, { app: 'yt' }); castAbrirApp(); };
    ov.querySelector('#ccNo').onclick = () => ov.classList.remove('show');
  }
  ov.classList.add('show');
}
/* ---------- Chromecast / Google TV / Android TV con la APP de YouTube ----------
   Se transmite con el sistema oficial de Chromecast pidiendo la app de YouTube del TV (no un
   reproductor web). Al abrirse, la app de YouTube del TV dice su «screenId»; con él ORDEVA se
   vuelve su control remoto (igual que el código de TV) y le manda la cola: cada canción que pidan
   las mesas entra sola a la cola del YouTube del TV. */
// El reproductor de la app se apaga solo cuando el TV de verdad quedó sonando, y vuelve si el TV se desconecta.
function autoPausar(){ const a = document.getElementById('autoPlay'); if(a && a.checked){ SS('vito_auto_antes', { on: true }); a.checked = false; a.dispatchEvent(new Event('change')); } }
function autoRestaurar(){ if(!LS('vito_auto_antes', {}).on) return; SS('vito_auto_antes', {}); const a = document.getElementById('autoPlay'); if(a && !a.checked){ a.checked = true; a.dispatchEvent(new Event('change')); } }
const YT_RECEIVER = '233637DE', MDX_NS = 'urn:x-cast:com.google.youtube.mdx';
let castSdkP = null, ccSes = null, ccRespaldo = false, ccPorPersona = false;
function castSdk(){
  if(castSdkP) return castSdkP;
  castSdkP = new Promise((res, rej) => {
    if(window.cast && cast.framework) return res();
    const tmo = setTimeout(() => rej(new Error('sdk')), 12000);
    const prev = window.__onGCastApiAvailable;
    window.__onGCastApiAvailable = ok => { clearTimeout(tmo); try{ prev && prev(ok); }catch(e){} ok ? res() : rej(new Error('nocast')); };
    const sc = document.createElement('script');
    sc.src = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';
    sc.onerror = () => { clearTimeout(tmo); rej(new Error('sdk')); };
    document.head.appendChild(sc);
  }).then(() => {
    const ctx = cast.framework.CastContext.getInstance();
    ctx.setOptions({ receiverApplicationId: YT_RECEIVER, autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED });
    ctx.addEventListener(cast.framework.CastContextEventType.SESSION_STATE_CHANGED, ev => {
      const S = cast.framework.SessionState;
      if(ev.sessionState === S.SESSION_STARTED || ev.sessionState === S.SESSION_RESUMED) ccConectado(ctx.getCurrentSession());
      if(ev.sessionState === S.SESSION_ENDED){ ccSes = null; ccRespaldo = false; ccPintar(); const c = lngCfg(); if(c.on && c.screenId && !c.codigo){ c.on = false; SS(LNG_KEY, c); lngEstado(); } autoRestaurar(); }
    });
    return ctx;
  });
  castSdkP.catch(() => { castSdkP = null; });
  return castSdkP;
}
function ccPintar(txt, cls){
  const box = document.getElementById('castDevs'), t = document.getElementById('castDevsTxt'); if(!box) return;
  box.classList.remove('ok', 'no', 'busy');
  if(!txt && !ccSes){ box.hidden = true; return; }
  box.hidden = false;
  if(!txt){ const n = ccSes.getCastDevice ? ccSes.getCastDevice().friendlyName : 'TV'; txt = '📺 YouTube abierto en «' + n + '».' + (lngOn() ? ' Las canciones de las mesas entran solas a su cola.' : ''); cls = 'ok'; }
  if(cls) box.classList.add(cls);
  t.textContent = txt;
}
/* Todos los dispositivos: la lista de Chrome solo trae los que tienen Chromecast integrado (Chromecast,
   Google TV, Android TV / TV Box certificados). Los Smart TV (LG, Samsung), los TV Box sin Chromecast,
   Fire TV, consolas y «YouTube on TV» solo los encuentra la app de YouTube o el código de TV. Y Brave no
   trae la función de transmitir de Chrome en Android: ahí la lista sale vacía o casi vacía.
   Por eso este selector ofrece cada camino según el aparato, en vez de solo la lista de Chrome. */
const esBrave = () => !!(navigator.brave) || /Brave/i.test(navigator.userAgent);
function castDispositivos(motivo){
  /* Aviso simple cuando la lista de TV no se puede mostrar o el TV no salió. Solo dos salidas:
     abrir ORDEVA en Chrome (el que sí muestra los TV) o conectar con el código del TV. */
  let ov = document.getElementById('castTodosOv');
  if(!ov){
    ov = document.createElement('div'); ov.id = 'castTodosOv'; ov.className = 'overlay';
    ov.innerHTML = '<div class="modal" style="max-width:400px;text-align:center"><h2>📺 Transmitir al TV</h2>' +
      '<div class="modal-sub" id="castTodosTxt"></div>' +
      '<div class="modal-actions" style="flex-direction:column;gap:8px;align-items:stretch">' +
      '<button class="btn-primary" id="ctChrome" type="button" style="padding:13px">🌐 Abrir ORDEVA en Chrome</button>' +
      '<button class="btn-primary" id="ctCodigo" type="button" style="padding:13px">🔗 Conectar con el código del TV</button>' +
      '<button class="btn-close" id="ctNo" type="button">Cerrar</button></div></div>';
    document.body.appendChild(ov);
    const cerrar = () => ov.classList.remove('show');
    ov.querySelector('#ctCodigo').onclick = () => { cerrar(); const d = document.getElementById('tvOptCodigo'); if(d){ d.open = true; d.scrollIntoView({ block: 'start', behavior: 'smooth' }); } setTimeout(() => { const i = document.getElementById('lngCode'); if(i) try{ i.focus(); }catch(e){} }, 500); };
    ov.querySelector('#ctChrome').onclick = () => { cerrar(); abrirIntent('intent://' + location.host + location.pathname + '#Intent;scheme=https;package=com.android.chrome;end'); };
    ov.querySelector('#ctNo').onclick = cerrar;
    ov.addEventListener('click', e => { if(e.target === ov) cerrar(); });
  }
  const android = window.esAndroid && window.esAndroid();
  ov.querySelector('#castTodosTxt').textContent = motivo || (esBrave() ? 'Brave no puede buscar los TV de tu wifi (Chrome sí). Abre ORDEVA en Chrome y toca «Transmitir al TV» otra vez.' : 'Este navegador no puede buscar los TV de tu wifi. Ábrelo en Chrome, o conecta con el código del TV.');
  ov.querySelector('#ctChrome').hidden = !(android && (esBrave() || !('chrome' in window)));
  ov.classList.add('show');
}
async function ccTransmitir(directo){
  const env = castEntorno();
  if(env.bad){ showToast(env.t, 9000); return; }
  // En Brave (o un navegador sin la función de transmitir) la lista de Chrome sale vacía: se ofrecen los demás caminos.

  ccPintar('Buscando tus televisores…', 'busy');
  ccPorPersona = true;   // la persona eligió el TV: al conectar, la música arranca allá sí o sí
  let ctx;
  try{ ctx = await castSdk(); }
  catch(e){ ccPintar(''); tvSinLista('Este navegador no puede mostrar los TV de tu wifi. Abre ORDEVA en Chrome, o conecta con el código del TV (abajo).'); return; }
  try{ await ctx.requestSession(); }
  catch(e){
    ccPintar('');
    // Cerró la lista sin elegir: casi siempre es porque su TV no salía ahí → se le muestran los otros caminos.
    // Cerró la lista (casi siempre porque salió vacía: su TV no tiene Chromecast) → directo al código del TV,
    // que sirve para TODOS los TV y TV Box que ve la app de YouTube.
    if(e === 'cancel' || (e && e.code === 'cancel')){ tvSinLista('¿Tu TV no salió en la lista? Esa lista solo trae aparatos con Chromecast. Conéctalo con el código del TV: en el TV abre YouTube → Configuración → «Vincular con código de TV» y escribe aquí los 12 números.'); return; }
    if(e === 'receiver_unavailable' || (e && e.code === 'receiver_unavailable')){ tvSinLista('No encontré TV en tu wifi. Revisa que el celular y el TV estén en el mismo wifi y el TV encendido. Si tu TV no tiene Chromecast, conéctalo con el código del TV (abajo).'); return; }
    showToast('⚠️ No se pudo abrir YouTube en el TV (' + (e && e.code || e) + ').', 7000); return;
  }
  ccConectado(ctx.getCurrentSession());
}
function ccConectado(ses){
  if(!ses || ses === ccSes) return;
  ccSes = ses; ccRespaldo = false;
  const nombre = ses.getCastDevice ? ses.getCastDevice().friendlyName : 'TV';
  let listo = false;
  ses.addMessageListener(MDX_NS, (ns, msg) => {
    let m; try{ m = typeof msg === 'string' ? JSON.parse(msg) : msg; }catch(e){ return; }
    if(m && m.type === 'mdxSessionStatus' && m.data && m.data.screenId && !listo){ listo = true; ccScreen(m.data.screenId, nombre); }
  });
  const pedir = () => { if(!listo && ccSes === ses) ses.sendMessage(MDX_NS, { type: 'getMdxSessionStatus' }).catch(() => {}); };
  pedir(); [2000, 4500, 8000, 12000, 18000].forEach(ms => setTimeout(pedir, ms));
  setTimeout(() => { if(!listo && ccSes === ses){ ccRespaldo = true; ccSiguiente(); } }, 20000);
  ccPintar('📺 Abriendo YouTube en «' + nombre + '»…', 'busy');
}
async function ccScreen(screenId, nombre){
  if(lngCfg().screenId !== screenId || ccPorPersona) lngReloj0('Chromecast «' + nombre + '»');
  const c = lngCfg();
  Object.assign(c, { screenId, nombre, on: true, ultimo: 0 }); delete c.loungeToken; delete c.exp; delete c.codigo;
  SS(LNG_KEY, c); lng.sid = null; lng.error = '';
  try{ vm().cola().forEach(x => { if(!x.vid && !x.done) vm().ytAgregar(x.id); }); }catch(e){}
  if(!lngHayPuente()){ ccPintar('📺 YouTube abierto en «' + nombre + '», pero para que suenen las canciones de las mesas falta el puente (paso 1 de «YouTube del TV»).', 'no'); lngEstado(); ccFaltaPuente(nombre); ccRespaldo = true; ccSiguiente(); return; }
  if(ccPorPersona){ ccPorPersona = false; lng.porPersona = true; lng.pausaHasta = 0; }
  await lngSync(true);
  lngEstado();
  if(lng.error){ ccRespaldo = true; ccSiguiente(); ccPintar('⚠️ ' + lng.error, 'no'); return; }
  if(!vm().cola().some(x => x.lng && x.lngAt > Date.now() - 60000)) showToast('📺 YouTube listo en el TV. Aún no hay canciones pedidas: la primera que pidan las mesas empieza a sonar allá.', 8000);
  autoPausar();
  const tv = document.getElementById('tvpOn'); if(tv && tv.checked){ tv.checked = false; tv.dispatchEvent(new Event('change')); }
  ccPintar();
  showToast('✅ YouTube abierto en «' + nombre + '»: las canciones de las mesas entran solas a su cola.', 7000);
}
// Respaldo sin puente: se le pide a la app de YouTube del TV que reproduzca la canción por el canal
// normal de Chromecast; cuando termina, la siguiente.
function ccSiguiente(){
  if(!ccRespaldo || !ccSes || !window.chrome || !chrome.cast || !chrome.cast.media) return;
  const ms = ccSes.getMediaSession && ccSes.getMediaSession();
  if(ms && ms.playerState && ms.playerState !== 'IDLE') return;
  if(ccRespaldo !== 'esperando'){ const ant = vm().cola().find(y => y.status === 'playing' && y.fuente === 'cc'); if(ant && Date.now() - (ant.startedAt || 0) > 15000) vm().mzTermino(ant.id, 'played'); }
  const l = vm().cola ? vm().ordenJusto(vm().cola()) : [];
  const x = l.find(y => y.vid && !y.lng && !y.done); if(!x) return;
  if(ccRespaldo === 'esperando') return;
  ccRespaldo = 'esperando';
  try{ ccSes.sendMessage(MDX_NS, { type: 'flingVideo', data: { currentTime: 0, videoId: x.vid } }).catch(() => {}); }catch(e){}
  let req;
  try{ req = new chrome.cast.media.LoadRequest(new chrome.cast.media.MediaInfo(x.vid, 'x-youtube/video')); req.autoplay = true; }
  catch(e){ ccRespaldo = false; return; }
  ccSes.loadMedia(req).then(() => {
    ccRespaldo = true; autoPausar();
    const cl = vm().cola(), it = cl.find(y => y.id === x.id);
    if(it){ it.lng = true; it.done = true; it.lngAt = Date.now(); SS('vito_cola', cl); }
    const e = vm().mzEmpezo(x.id, 'cc'); SS('vito_now', e || x); try{ vm().renderMusica(); }catch(e){}
  }).catch(() => { ccRespaldo = false; if(!lngOn() || !lngHayPuente()) ccPintar('📺 YouTube está abierto en el TV. Para que suene la cola de las mesas conecta el puente (Música → YouTube del TV, paso 1).', 'no'); });
}
setInterval(ccSiguiente, 5000);
function ccFaltaPuente(nombre){
  let ov = document.getElementById('ccPuenteOverlay');
  if(!ov){
    ov = document.createElement('div'); ov.id = 'ccPuenteOverlay'; ov.className = 'overlay';
    ov.innerHTML = '<div class="modal" style="max-width:420px"><h2>📺 YouTube ya está abierto en el TV</h2>' +
      '<div class="modal-sub" id="ccPuenteTxt"></div>' +
      '<div class="modal-actions" style="flex-direction:column;gap:8px">' +
      '<button class="btn-primary" id="ccPuenteGo" type="button" style="width:100%;padding:13px">🛠️ Crear el puente (gratis, una vez)</button>' +
      '<button class="btn-close" id="ccPuenteNo" type="button">Por ahora que suene en el celular</button></div></div>';
    document.body.appendChild(ov);
    ov.querySelector('#ccPuenteGo').onclick = () => { ov.classList.remove('show'); const r = document.getElementById('lngRelay'); if(r) r.scrollIntoView({ block: 'center', behavior: 'smooth' }); lngGuia(); };
    ov.querySelector('#ccPuenteNo').onclick = () => { ov.classList.remove('show'); const a = document.getElementById('autoPlay'); if(a && !a.checked){ a.checked = true; a.dispatchEvent(new Event('change')); } const b = document.getElementById('ytBox'); if(b) b.scrollIntoView({ block: 'center', behavior: 'smooth' }); };
  }
  ov.querySelector('#ccPuenteTxt').innerHTML = 'La app de YouTube se abrió en «' + String(nombre || 'tu TV').replace(/</g, '&lt;') + '», pero para mandarle las canciones de las mesas YouTube exige un <b>puente</b>: el navegador no deja que una página (tampoco GitHub) le hable directo al YouTube del TV. Se crea gratis en 5 minutos y queda para siempre.';
  ov.classList.add('show');
}
/* Vincular con código de TV: sirve aunque el wifi no deje ver el TV (routers de negocio).
   El código lo muestra la app de YouTube del TV; el enlace lo hace la app de YouTube del
   celular (Configuración → Ver en TV → Ingresar código de TV). Esta pantalla guía los pasos,
   copia el código y abre YouTube. Una vez vinculado, el TV sale siempre al transmitir. */
const PAIR_KEY = 'vito_tv_vinculado';
function castVincular(){
  let ov = document.getElementById('castPairOverlay');
  if(!ov){
    ov = document.createElement('div'); ov.id = 'castPairOverlay'; ov.className = 'overlay';
    ov.innerHTML = '<div class="modal" style="max-width:430px;max-height:90vh;overflow:auto"><h2>🔗 Vincular con código de TV</h2>' +
      '<div class="modal-sub">Se hace una sola vez. Después tu TV aparece siempre al transmitir, aunque el wifi no lo detecte.</div>' +
      '<div id="pairDone"></div>' +
      '<div class="pair-steps">' +
        '<div class="pair-step"><span class="pair-n">1</span><div><strong>En el TV</strong><p>Abre la app de <b>YouTube</b> → <b>Configuración</b> (⚙️, abajo a la izquierda) → <b>Vincular con código de TV</b>. Aparece un código azul de 12 números.</p></div></div>' +
        '<div class="pair-step"><span class="pair-n">2</span><div style="flex:1;min-width:0"><strong>Escribe aquí el código del TV</strong>' +
          '<input id="pairCode" inputmode="numeric" autocomplete="off" placeholder="000 000 000 000" maxlength="15">' +
          '<div class="pair-hint" id="pairHint">Son 12 números. Te lo copio para pegarlo en YouTube.</div></div></div>' +
        '<div class="pair-step"><span class="pair-n">3</span><div><strong>En el celular</strong><p>Toca el botón de abajo: se copia el código y se abre la app. En <b>YouTube Music</b>: toca el ícono de <b>transmitir</b> → <b>Vincular con código de TV</b>. En <b>YouTube</b>: <b>tu foto</b> → <b>Configuración</b> → <b>Ver en TV</b> → <b>Ingresar código de TV</b>. Pega el código y toca <b>Vincular</b>.</p></div></div>' +
      '</div>' +
      '<div class="modal-actions" style="flex-direction:column;gap:8px;margin-top:16px">' +
        '<button class="btn-primary" id="pairGo" type="button" style="width:100%;padding:13px;font-size:15px" disabled>📋 Copiar código y abrir la app</button>' +
        '<button class="btn-ghost" id="pairOk" type="button" style="width:100%">✅ Ya quedó vinculado</button>' +
        '<button class="btn-ghost" id="pairWeb" type="button" style="width:100%">💻 Vincular desde el navegador (youtube.com/pair)</button>' +
        '<button class="btn-close" id="pairClose" type="button">Cerrar</button>' +
      '</div></div>';
    document.body.appendChild(ov);
    const inp = ov.querySelector('#pairCode'), go = ov.querySelector('#pairGo'), hint = ov.querySelector('#pairHint');
    const digits = () => inp.value.replace(/\D/g, '').slice(0, 12);
    inp.addEventListener('input', () => {
      const d = digits();
      inp.value = d.replace(/(\d{3})(?=\d)/g, '$1 ');
      go.disabled = d.length !== 12;
      hint.textContent = d.length === 12 ? '✅ Código completo.' : 'Van ' + d.length + ' de 12 números.';
    });
    go.onclick = async () => {
      const d = digits(); if(d.length !== 12) return;
      let copiado = false;
      try{ await navigator.clipboard.writeText(d); copiado = true; }catch(e){}
      if(!copiado){ try{ inp.select(); copiado = document.execCommand('copy'); }catch(e){} }
      SS(PAIR_KEY, Object.assign({}, LS(PAIR_KEY, {}), { codigo: d, pedido: Date.now() }));
      abrirAppElegida('');
      showToast((copiado ? '📋 Código copiado. ' : '✍️ Anota el código: ' + inp.value + '. ') + (castApp() === 'yt' ? 'En YouTube: tu foto → Configuración → Ver en TV → Ingresar código de TV.' : 'En YouTube Music: ícono de transmitir → Vincular con código de TV.'), 9000);
    };
    ov.querySelector('#pairOk').onclick = () => {
      SS(PAIR_KEY, Object.assign({}, LS(PAIR_KEY, {}), { ok: Date.now() }));
      ov.classList.remove('show'); castEstado();
      showToast('✅ TV vinculado. Ahora toca «Transmitir al TV» y, en YouTube, el ícono de transmitir: tu TV sale en la lista.', 7000);
    };
    ov.querySelector('#pairWeb').onclick = () => window.open('https://www.youtube.com/pair', '_blank');
    ov.querySelector('#pairClose').onclick = () => ov.classList.remove('show');
    ov.addEventListener('click', e => { if(e.target === ov) ov.classList.remove('show'); });
  }
  const v = LS(PAIR_KEY, {});
  ov.querySelector('#pairDone').innerHTML = v.ok ? '<div class="pair-done">✅ Ya vinculaste un TV el ' + new Date(v.ok).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' }) + '. Repite los pasos solo si cambiaste de TV.</div>' : '';
  ov.classList.add('show');
  setTimeout(() => { const i = document.getElementById('pairCode'); if(i && window.innerWidth > 700) i.focus(); }, 60);
}
function castGuia(){
  let ov = document.getElementById('castGuideOverlay');
  if(!ov){
    ov = document.createElement('div'); ov.id = 'castGuideOverlay'; ov.className = 'overlay';
    ov.innerHTML = '<div class="modal cast-guide" style="max-width:440px;max-height:88vh;overflow:auto"><h2>📺 ¿No aparece tu TV?</h2>' +
      '<div class="modal-sub">Revisa esto en orden; casi siempre es el punto 1, 3 o 5.</div><ol>' +
      '<li><b>Mismo wifi:</b> el celular y el TV deben estar en la MISMA red wifi (no la de invitados ni los datos del celular).</li>' +
      '<li><b>TV listo:</b> enciende el TV y abre su app de YouTube una vez. En Smart TV activa «Chromecast integrado» o «Google Cast» en su configuración.</li>' +
      '<li><b>Permiso del celular:</b> Ajustes del celular → Apps → YouTube (y también Chrome) → Permisos → activa <b>Dispositivos cercanos</b>. Sin ese permiso no ve los TV.</li>' +
      '<li><b>Apaga la VPN</b> y el ahorro de batería extremo, si los tienes.</li>' +
      '<li><b>Wifi del negocio que bloquea:</b> muchos routers de negocio no dejan que los aparatos se vean entre sí. Solución que siempre funciona: en el <b>TV</b> abre YouTube → Configuración → <b>Vincular con código de TV</b>; en el <b>celular</b>, en YouTube Music toca transmitir → <b>Vincular con código de TV</b> (en YouTube: tu foto → Configuración → <b>Ver en TV</b> → <b>Ingresar código de TV</b>). Queda vinculado para siempre y aparece en el ícono de transmitir aunque el wifi no lo detecte. <button type="button" class="btn-ghost" id="castGuidePair" style="margin-top:8px;display:block">🔗 Vincular con código de TV</button></li>' +
      '<li>Vuelve aquí y toca <b>Buscar TV y transmitir</b>.</li></ol>' +
      '<div class="modal-actions"><button class="btn-primary" type="button" id="castGuideOk">Entendido</button></div></div>';
    document.body.appendChild(ov);
    ov.querySelector('#castGuideOk').onclick = () => ov.classList.remove('show');
    ov.querySelector('#castGuidePair').onclick = () => { ov.classList.remove('show'); castVincular(); };
    ov.addEventListener('click', e => { if(e.target === ov) ov.classList.remove('show'); });
  }
  ov.classList.add('show');
}
async function transmitirTV(){
  const b = document.getElementById(castApp() === 'yt' ? 'castOpenYT' : 'castOpenMusic');
  b.disabled = true; const txt = b.textContent; b.textContent = '⏳ Preparando…';
  try{
    // Si la reproducción dentro de la app estaba prendida, se apaga para que no suenen dos a la vez.
    if(vm().AUTO && vm().AUTO()){ const a = document.getElementById('autoPlay'); if(a){ a.checked = false; a.dispatchEvent(new Event('change')); } }
    const cfg = vm().yCfg();
    // Con Client ID pero sin sesión de Google: se conecta primero y la transmisión sigue sola al volver.
    if(!vm().yTok() && cfg.cid && vm().yConectar){
      castEsperaGoogle = Date.now();
      vm().yConectar(false);
      showToast('Conectando con Google para armar tu lista del TV…', 4000);
      return;
    }
    const prev = LS(CAST_KEY, {});
    const abiertoAntes = prev.on ? (prev.abierto || 0) : 0;
    SS(CAST_KEY, { on: true, desde: prev.on && prev.desde ? prev.desde : Date.now(), abierto: Date.now() });
    const pend = vm().ordenJusto(vm().cola());
    if(vm().yTok()){
      const pl = await vm().yLista();
      pend.forEach(x => vm().ytAgregar(x.id));
      await vm().esperarYT();                                    // espera a que entren las pendientes
      // Empieza por la primera canción que entró a la lista DESPUÉS de la última vez que se abrió
      // YouTube (así la app vuelve a cargar la lista, ya con las nuevas), o por la primera pendiente.
      const l0 = vm().cola();
      const nuevas = l0.filter(x => x.yt === true && !x.enviado && Date.now() - (x.ytAt || 0) < 6 * 36e5).sort((a, b) => a.ytAt - b.ytAt);
      const f = nuevas[0] || pend.map(x => l0.find(y => y.id === x.id)).find(it => it && it.vid);
      // Todo lo que ya está en la lista va en esta apertura: ya no cuenta como «nueva».
      l0.forEach(x => { if(x.yt === true) x.enviado = true; }); SS('vito_cola', l0);
      const now = LS('vito_now', null);
      const vid = f ? f.vid : (now && now.vid) || '';
      castLanzar(vid ? 'watch?v=' + encodeURIComponent(vid) + '&list=' + encodeURIComponent(pl) : 'playlist?list=' + encodeURIComponent(pl),
        CAST_AVISO + ' Las canciones que pidan las mesas se agregan solas a esta lista.');
    } else {
      if(!cfg.key){ showToast('Falta la API key de YouTube (más abajo) para buscar las canciones.', 5000); SS(CAST_KEY, {}); return; }
      // Sin cuenta de Google no hay lista: la app de YouTube abre la primera canción de la cola.
      let vid = '';
      for(const x of pend.slice(0, 5)){
        let it = vm().cola().find(y => y.id === x.id);
        if(it && !it.vid && !it.novid){ try{ const v = await vm().ySearch(it.song); const l = vm().cola(); it = l.find(y => y.id === x.id); if(it){ if(v){ it.vid = v; if(ytDurCache[v]) it.dur = ytDurCache[v]; } else it.novid = true; SS('vito_cola', l); } }catch(e){} }
        if(it && it.vid){ vid = it.vid; const l = vm().cola(), z = l.find(y => y.id === it.id); if(z){ z.done = true; z.cast = true; } SS('vito_cola', l); SS('vito_now', it); break; }
      }
      if(!vid){ showToast('No hay canciones en cola para transmitir. Los clientes las piden con el QR de su mesa.', 5000); SS(CAST_KEY, {}); return; }
      castLanzar('watch?v=' + encodeURIComponent(vid), CAST_AVISO + ' Para que la lista completa se arme y se actualice sola, conecta Google (más abajo) una sola vez.');
    }
  }catch(e){
    showToast('YouTube: ' + (e.message || e), 5000);
  }finally{
    b.disabled = false; b.textContent = txt; castEstado(); try{ vm().renderMusica(); }catch(e){}
  }
}
// Botones de YouTube Music / YouTube: con la cola vacía abre la app igual (para transmitir lo que quieras).
function castAbrirApp(){
  const env = castEntorno();
  if(env.bad){ showToast(env.t, 9000); return; }
  const hay = vm().cola && vm().cola().some(x => !x.done);
  if(!hay && !(vm().yTok && vm().yTok() && vm().yCfg().pl)){
    abrirAppElegida('');
    showToast('📺 Abrí ' + (castApp() === 'yt' ? 'YouTube' : 'YouTube Music') + '. Toca el ícono de transmitir y elige tu TV.', 7000);
    return;
  }
  transmitirTV();
}
// ¿La música está yendo a un TV? (YouTube del TV por código o Chromecast)
window.tvConectado = () => { try{ return (typeof lngOn === 'function' && lngOn()) || !!ccSes; }catch(e){ return false; } };
window.tvMandarYa = () => { if(typeof lngOn === 'function' && lngOn()){ lng.porPersona = true; lng.pausaHasta = 0; lngSync(true); } else if(ccSes){ ccRespaldo = true; ccSiguiente(); } };
/* «Transmitir al TV»: abre DIRECTO la lista de aparatos del wifi (Chromecast, Google TV, Android TV,
   TV Box con Chromecast). Sin ventanas de opciones.
   - Si este navegador tiene la lista (Chrome): se abre la lista.
   - Si no la tiene (Brave, otros): el mismo toque abre ORDEVA en Chrome, que sí la tiene, y allá queda
     el botón resaltado para tocarlo una vez. (Ninguna página web puede ver los aparatos del wifi sin
     la lista del navegador; Brave la trae apagada.)
   La librería de Chromecast ya se cargó al abrir la app, así que la respuesta es inmediata y el toque
   sigue valiendo para abrir la lista o Chrome. */
async function tvTransmitirToque(){
  if(window.VentoAndroid){ tvApkLista(); return; }   // app de Android: lista con TODOS los TV del wifi
  const env = castEntorno();
  if(env.bad){ showToast(env.t, 9000); return; }
  let hay = false;
  try{ await Promise.race([castSdk(), new Promise((_, r) => setTimeout(() => r(new Error('lento')), 2500))]); hay = true; }catch(e){ hay = false; }
  if(hay){ ccTransmitir(true); return; }
  if(window.esAndroid && window.esAndroid()){
    showToast('Abriendo ORDEVA en Chrome para ver los TV de tu wifi…', 5000);
    abrirIntent('intent://' + location.host + location.pathname + '?transmitir=1#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=' + encodeURIComponent('https://play.google.com/store/apps/details?id=com.android.chrome') + ';end');
    return;
  }
  tvSinLista('Este navegador no puede mostrar los TV de tu wifi. Abre ORDEVA en Chrome, o conecta con el código del TV (abajo).');
}
/* ---------- App de Android: todos los TV del wifi ----------
   La app busca en el wifi igual que YouTube (LG webOS, Samsung, TV Box, Android TV, Fire TV, Chromecast).
   Al tocar uno, abre YouTube en ese TV con un código de vinculación y ORDEVA se vincula sola con ese
   código (el mismo sistema de «Vincular con código de TV», sin escribir nada). Desde ahí la cola de
   las mesas suena allá sola, como con el código. */
/* Informe de la búsqueda de TV (app de Android): qué encontró cada forma de buscar. Si un TV no sale, con
   esto se sabe por qué (sin wifi, router que bloquea, Google Play Services…). */
function tvDiagTexto(d){
  if(!d) return '';
  const l = [];
  l.push('Wifi: ' + (d.wifi || '—') + (d.subred ? ' · red ' + d.subred : ''));
  l.push('Buscador de Google (como YouTube): ' + (d.castGoogle || 'no corrió') + (d.castRutas ? ' · vio: ' + d.castRutas : ' · no vio aparatos') + (d.castSinIp ? ' · sin dirección: ' + d.castSinIp : ''));
  l.push('Chromecast por mDNS: ' + (d.mdns || 0) + ' anunciados, ' + (d.mdnsResueltos || 0) + ' resueltos' + (d.mdnsSinResolver ? ', ' + d.mdnsSinResolver + ' sin resolver' : '') + (d.mdnsError ? ' · error ' + d.mdnsError : ''));
  l.push('TV por SSDP/DIAL: ' + (d.ssdp || 0) + ' respuestas' + (d.ssdpError ? ' · error ' + d.ssdpError : ''));
  l.push('Barrido del wifi: ' + (d.puertos ? 'puertos abiertos ' + d.puertos : 'ningún TV con puertos abiertos'));
  l.push('En la lista: ' + (d.vistos || 'ninguno'));
  return l.join('\n');
}
function tvDiagPintar(ov, diag){
  try{
    window.__tvDiag = diag || null;
    let box = ov.querySelector('#tvDiag');
    if(!box){ box = document.createElement('details'); box.id = 'tvDiag'; box.className = 'settings-desc'; box.style.marginTop = '8px';
      box.innerHTML = '<summary>🔍 Detalles de la búsqueda</summary><pre style="white-space:pre-wrap;font-size:12px;margin:6px 0"></pre><button type="button" class="btn-ghost" style="width:100%">📋 Copiar detalles</button>';
      box.querySelector('button').onclick = () => { try{ navigator.clipboard.writeText('ORDEVA ' + MESORA_VERSION + ' · búsqueda de TV\n' + tvDiagTexto(window.__tvDiag)); showToast('📋 Copiado. Mándamelo para revisarlo.'); }catch(e){} };
      ov.querySelector('#tvApkLista').after(box); }
    box.hidden = !diag;
    box.querySelector('pre').textContent = tvDiagTexto(diag);
    try{ lngLog('🔍 búsqueda de TV · ' + tvDiagTexto(diag).replace(/\n/g, ' | ')); }catch(e){}
  }catch(e){}
}
const tvEsc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const tvIcono = t => ({ lg: '📺', samsung: '📺', tv: '📺', chromecast: '📡', androidtv: '🤖', firetv: '🔥', roku: '🟣', tvbox: '📦' }[t] || '📺');
function tvApkLista(){
  let ov = document.getElementById('tvApkOv');
  if(!ov){
    ov = document.createElement('div'); ov.id = 'tvApkOv'; ov.className = 'overlay';
    ov.innerHTML = '<div class="modal" style="max-width:420px;max-height:88vh;overflow:auto"><h2>📺 TV de tu wifi</h2><div class="modal-sub" id="tvApkSub"></div>' +
      '<div id="tvApkLista" style="display:flex;flex-direction:column;gap:8px;margin:12px 0"></div>' +
      '<div class="modal-actions" style="flex-direction:column;gap:8px;align-items:stretch"><button class="btn-ghost" id="tvApkOtra" type="button">🔄 Buscar otra vez</button><button class="btn-close" id="tvApkNo" type="button">Cerrar</button></div></div>';
    document.body.appendChild(ov);
    ov.querySelector('#tvApkNo').onclick = () => ov.classList.remove('show');
    ov.querySelector('#tvApkOtra').onclick = () => tvApkLista();
    ov.addEventListener('click', e => { if(e.target === ov) ov.classList.remove('show'); });
  }
  const L = ov.querySelector('#tvApkLista'), sub = ov.querySelector('#tvApkSub'), vistos = {};
  L.innerHTML = ''; sub.textContent = '⏳ Buscando los TV de tu wifi…';
  const vinc = document.createElement('div'); vinc.id = 'tvApkVinc';
  const pintarVinc = () => {
    vinc.innerHTML = '';
    if(!lngOn()) return;
    // El TV vinculado por internet («YouTube en el TV») va APARTE de los del wifi: puede estar en otra red.
    const enl = lngTVEnLinea(), b0 = document.createElement('button'); b0.type = 'button'; b0.className = 'btn-ghost';
    b0.style.cssText = 'display:flex;align-items:center;gap:12px;text-align:left;padding:11px 14px;width:100%;margin-bottom:6px' + (enl ? ';outline:2px solid var(--paid)' : '');
    b0.innerHTML = '<span style="font-size:22px">' + (enl === false ? '📴' : enl ? '🟢' : '🔗') + '</span><span><b>' + tvEsc(lngCfg().nombre || 'TV') + '</b><br><small style="opacity:.85">' +
      (enl === false ? 'Vinculado por internet · no responde ahora (apagado o en otra red)' : enl ? 'Conectado por internet' + (lng.tvSt === 1 ? ' · sonando ahora' : '') + ' · tocar para ver lo que suena' : 'Vinculado por internet · revisando si responde…') + '</small></span>';
    b0.onclick = () => { ov.classList.remove('show'); const v = document.getElementById('tvVivo'); if(v){ v.scrollIntoView({ block: 'center', behavior: 'smooth' }); } lngVivo(true); };
    vinc.appendChild(b0);
  };
  pintarVinc();
  L.appendChild(vinc);
  // Los TV a los que YA transmites desde el celular (YouTube Music, YouTube, Spotify…), como «YouTube on TV» en YouTube.
  const med = document.createElement('div'); L.appendChild(med);
  try{
    const md = mediosLeer();
    if(md && md.permiso) (md.lista || []).filter(m => m.remoto && m.titulo).forEach(m => {
      const b1 = document.createElement('button'); b1.type = 'button'; b1.className = 'btn-ghost';
      b1.style.cssText = 'display:flex;align-items:center;gap:12px;text-align:left;padding:11px 14px;width:100%;margin-bottom:6px;outline:2px solid var(--paid)';
      b1.innerHTML = '<span style="font-size:22px">📡</span><span><b>' + tvEsc(m.donde || 'TV al que ya transmites') + '</b><br><small style="opacity:.85">' + (m.estado === 3 ? '▶ Reproduciendo ' : '⏸ ') + tvEsc(m.titulo) + ' · desde ' + tvEsc(m.nombreApp) + '</small></span>';
      b1.onclick = () => { ov.classList.remove('show'); tvDisposToque('codigo'); };
      med.appendChild(b1);
    });
    else if(md && md.permiso === false){
      const b2 = document.createElement('button'); b2.type = 'button'; b2.className = 'btn-ghost';
      b2.style.cssText = 'display:flex;align-items:center;gap:12px;text-align:left;padding:11px 14px;width:100%;margin-bottom:6px';
      b2.innerHTML = '<span style="font-size:22px">📡</span><span><b>Ver los TV a los que ya transmites</b><br><small style="opacity:.85">Lo que suena desde YouTube Music, YouTube o Spotify de este celular y en qué TV</small></span>';
      b2.onclick = () => tvDisposToque('mperm');
      med.appendChild(b2);
    }
  }catch(e){}
  const tit = document.createElement('div'); tit.className = 'settings-desc'; tit.style.margin = '4px 0 0'; tit.innerHTML = '<b>En este wifi:</b>'; L.appendChild(tit);
  // Como en YouTube: siempre se puede vincular con el código del TV (sirve para cualquier TV o TV Box, esté o no en este wifi).
  if(!ov.querySelector('#tvApkCodigo')){
    const bc = document.createElement('button'); bc.type = 'button'; bc.id = 'tvApkCodigo'; bc.className = 'btn-ghost';
    bc.style.cssText = 'display:flex;align-items:center;gap:12px;text-align:left;padding:11px 14px;width:100%;margin-top:6px';
    bc.innerHTML = '<span style="font-size:22px">🔗</span><span><b>Vincular con código de TV</b><br><small style="opacity:.85">Para cualquier TV o TV Box (onn, Google TV, LG, Samsung…): en el TV abre YouTube → Configuración → «Vincular con código de TV».</small></span>';
    bc.onclick = () => { ov.classList.remove('show'); tvSinLista('Escribe los 12 números que muestra el TV en YouTube → Configuración → «Vincular con código de TV».'); setTimeout(() => { const c = document.getElementById('lngCode'); if(c) c.focus(); }, 500); };
    L.after(bc);
  }
  if(lngOn()) lngVivo(true).then(pintarVinc).catch(() => {});
  const porIp = {};
  window.__ventoTV = tv => {
    if(!tv) return;
    // El mismo aparato puede llegar varias veces (como «reproductor» y como «TV que abre YouTube»): se queda la ficha
    // más completa y su botón reemplaza al anterior. Antes ganaba la primera y el TV quedaba como «solo código».
    const viejo = (tv.ip && porIp[tv.ip]) || (tv.reemplaza && vistos[tv.reemplaza]);
    if(viejo && tvPuntos(tv) <= tvPuntos(viejo.tv)) return;
    if(!viejo && vistos[tv.id]) return;
    vistos[tv.id] = tv; tvWifiGuardar(tv);
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn-primary';
    b.style.cssText = 'display:flex;align-items:center;gap:12px;text-align:left;padding:13px 14px;width:100%';
    const extra = [tv.fabricante, tv.modelo].filter(x => x && !String(tv.nombre).includes(x)).join(' · ');
    b.innerHTML = '<span style="font-size:24px">' + tvIcono(tv.tipo) + '</span><span><b>' + tvEsc(tv.nombre) + '</b>' + (extra ? '<br><small style="opacity:.8">' + tvEsc(extra) + '</small>' : '') + (tv.youtube ? '<br><small style="opacity:.9">▶ Reproduciendo YouTube</small>' : '') + (tv.soloCodigo && !tv.screenId ? '<br><small style="opacity:.8">Se conecta con su código de TV</small>' : '') + '</span>';
    b.onclick = () => { ov.classList.remove('show'); tvConectarAparato(tv); };
    if(viejo && viejo.b && viejo.b.parentNode){ viejo.b.replaceWith(b); if(viejo.tv && viejo.tv.ip && viejo.tv.ip !== tv.ip) delete porIp[viejo.tv.ip]; } else L.appendChild(b);
    if(tv.ip) porIp[tv.ip] = { tv, b };
    sub.textContent = 'Toca tu TV: se abre YouTube allá y las canciones de las mesas suenan solas.';
  };
  window.__ventoTVfin = (n, diag) => {
    tvDiagPintar(ov, diag);
    if(!Object.keys(vistos).length) sub.textContent = 'No encontré TV en este wifi. Revisa que el celular y el TV estén en el MISMO wifi y el TV encendido, y toca «Buscar otra vez». Si aun así no sale, usa el código del TV.';
  };
  ov.classList.add('show');
  // Los TV que ya se encontraron hace poco salen de una vez (no se espera a la búsqueda nueva).
  Object.values(tvWifi).filter(x => Date.now() - (x.visto || 0) < 5 * 60000).forEach(x => { try{ window.__ventoTV(x); }catch(e){} });
  try{ window.VentoAndroid.buscarTVs(); }catch(e){ sub.textContent = 'No pude buscar los TV: ' + (e.message || e); }
}
window.__ventoCb = (id, d) => { const f = window.__ventoCbs && window.__ventoCbs[id]; if(f){ delete window.__ventoCbs[id]; f(d || {}); } };
async function tvApkConectar(tv){
  if(tv.soloCodigo || !tv.appUrl){ tvSinLista('«' + tv.nombre + '» se conecta con su código (una sola vez): en ese TV abre YouTube → Configuración → «Vincular con código de TV» y escribe aquí los 12 números. Lo que esté sonando allá no se corta.'); setTimeout(() => { const c = document.getElementById('lngCode'); if(c) c.focus(); }, 500); return false; }
  if(!lngHayPuente()){
    showToast('Falta el puente (se crea gratis una sola vez). Te llevo al paso: Música → «¿Tu TV no aparece?» → paso 1.', 9000);
    const d = document.getElementById('tvOptCodigo'); if(d){ d.open = true; d.querySelectorAll('[hidden]').forEach(x => { if(x.classList.contains('lng-step') || x.classList.contains('settings-desc') || x.classList.contains('pair-n')){ x.hidden = false; x.style.display = ''; } }); d.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
    return false;
  }
  const box = document.getElementById('castDevs'), txt = document.getElementById('castDevsTxt');
  const pintar = (t, cls) => { if(!box) return; box.hidden = false; box.classList.remove('ok', 'no', 'busy'); if(cls) box.classList.add(cls); txt.textContent = t; };
  // Turno exclusivo con el TV mientras se conecta (que ninguna revisión de fondo se cruce con la vinculación).
  for(let i = 0; i < 40 && lng.ocupado && Date.now() - lng.ocupadoT < 90000; i++) await new Promise(r => setTimeout(r, 500));
  lng.ocupado = true; lng.ocupadoT = Date.now(); lng.fallas = 0; lng.pausaHasta = 0;
  try{
    const abrirYT = async () => {
      const codigo = (crypto.randomUUID ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join(''));
      const r = await new Promise(res => { const id = 'y' + Date.now() + Math.random().toString(36).slice(2, 5); window.__ventoCbs = window.__ventoCbs || {}; window.__ventoCbs[id] = res; try{ window.VentoAndroid.abrirYouTube(id, tv.appUrl, codigo); }catch(e){ res({ status: -1 }); } setTimeout(() => res({ status: -2 }), 15000); });
      return { codigo, st: r.status };
    };
    const vincular = async codigo => { let err = ''; for(let i = 0; i < 12; i++){ await new Promise(r2 => setTimeout(r2, 2500)); lng.ocupadoT = Date.now(); try{ await lngParear(codigo); return ''; }catch(e){ err = e.message || String(e); } if(i >= 2 && i % 2 === 0){ const inf = await tvInfoYT(tv.appUrl); if(inf && inf.screenId){ tv.screenId = inf.screenId; tv.youtube = true; return 'PANTALLA'; } } } return err || 'sin respuesta'; };
    pintar('📺 Abriendo YouTube en «' + tv.nombre + '»…', 'busy');
    lngLog('TV del wifi: «' + tv.nombre + '» (' + (tv.fabricante || tv.tipo) + ') → abrir YouTube en ' + tv.appUrl);
    let a = await abrirYT();
    if(!(a.st >= 200 && a.st < 300)){
      lngLog('   ❌ el TV no dejó abrir YouTube (respuesta ' + a.st + ')');
      pintar('⚠️ «' + tv.nombre + '» no dejó abrir YouTube. Enciende el TV, abre YouTube en él una vez y vuelve a tocar «Transmitir al TV».', 'no');
      return false;
    }
    lngLog('   ✅ YouTube abierto en el TV (' + a.st + ') · vinculando…');
    pintar('📺 YouTube abierto en «' + tv.nombre + '». Vinculando…', 'busy');
    let err = await vincular(a.codigo);
    if(err === 'PANTALLA'){ lngLog('   el TV no tomó el código (YouTube en uso) pero dio su código de pantalla → me uno a esa sesión'); return 'PANTALLA'; }
    if(err){
      // Segundo intento: se vuelve a abrir YouTube con un código nuevo (a veces el TV tarda en registrar el primero).
      lngLog('   ⚠️ no se vinculó con el primer código (' + err + ') → otro intento');
      pintar('📺 Vinculando con «' + tv.nombre + '» (segundo intento)…', 'busy');
      a = await abrirYT();
      if(a.st >= 200 && a.st < 300) err = await vincular(a.codigo);
      if(err === 'PANTALLA') return 'PANTALLA';
    }
    if(err){
      lngLog('   ❌ no se pudo vincular solo: ' + err);
      pintar('⚠️ YouTube se abrió en «' + tv.nombre + '», pero no se vinculó solo. Usa el código del TV (abajo): en el TV, YouTube → Configuración → Vincular con código de TV.', 'no');
      tvSinLista('YouTube ya está abierto en el TV: falta escribir su código una vez.');
      return false;
    }
    lngLog('   ✅ vinculado con el TV');
    SS(LNG_KEY, Object.assign(lngCfg(), { nombre: tv.nombre, codigo: true }));
    lngRecordar(lngCfg().screenId, tv.nombre, tv.ip);
    lngReloj0('TV «' + tv.nombre + '»');
    // El saludo es lo que hace que el TV muestre «ORDEVA se conectó». Antes, si fallaba, ORDEVA decía «Conectado» igual.
    let saludo = '';
    for(let i = 0; i < 3; i++){ try{ await lngBind(); saludo = ''; break; }catch(e){ saludo = e.message || String(e); lngLog('   ⚠️ saludo al TV falló (' + saludo + '), reintento'); await new Promise(r2 => setTimeout(r2, 1500)); } }
    if(saludo){ lng.error = 'el TV no contesta (' + saludo + ').'; lng.sid = null; pintar('⚠️ Vinculado con «' + tv.nombre + '», pero el TV no contesta: ' + saludo, 'no'); lngEstado(); return false; }
    autoPausar();
    try{ vm().cola().forEach(x => { if(!x.vid && !x.done) vm().ytAgregar(x.id); }); }catch(e){}
    lng.ocupado = false;
    lng.pausaHasta = 0;
    if(tv.youtube || lng.tvPlay === true) lngSync(); else { lng.porPersona = true; lngSync(true); }   // si ya sonaba algo, no se corta
    lngEstado();
    pintar('📺 Conectado a «' + tv.nombre + '»: las canciones de las mesas suenan allá solas, una tras otra.', 'ok');
    showToast('✅ Conectado a «' + tv.nombre + '». La música de las mesas ya va al TV.', 7000);
    return true;
  }finally{ lng.ocupado = false; }
}
/* Conectar a un aparato de la lista: primero el camino de siempre (abrir YouTube en el TV con un código de
   vinculación, el que ya funcionaba); si no se puede y el TV dio su screenId, se usa ese; y si no, el código del TV. */
// Estado de YouTube en el TV (DIAL GET, como hacen la app de YouTube y ytcast): { state, screenId } o null.
function tvInfoYT(appUrl){
  return new Promise(res => {
    const A = window.VentoAndroid;
    if(!appUrl || !A || typeof A.infoYouTube !== 'function') return res(null);
    const id = 'i' + Date.now() + Math.random().toString(36).slice(2, 6);
    window.__ventoCbs = window.__ventoCbs || {};
    const tmo = setTimeout(() => { delete window.__ventoCbs[id]; res(null); }, 6000);
    window.__ventoCbs[id] = d => { clearTimeout(tmo); let j = null; try{ j = JSON.parse(String((d && d.text) || '{}')); }catch(e){} res(j); };
    try{ A.infoYouTube(id, appUrl); }catch(e){ clearTimeout(tmo); delete window.__ventoCbs[id]; res(null); }
  });
}
async function tvConectarAparato(tv){
  if(!tv) return false;
  // 1) Como la app de YouTube: se le pregunta al TV. Si YouTube YA está abierto (aunque otro celular o TV Box esté
  //    conectado), el TV da su código de pantalla y ORDEVA se une a ESA MISMA sesión, sin volver a abrir YouTube y
  //    sin cortar lo que suena (las canciones de las mesas quedan en cola detrás).
  if(tv.appUrl && !tv.soloCodigo){
    const inf = await tvInfoYT(tv.appUrl);
    if(inf && /running/i.test(inf.state || '')) tv.youtube = true;
    if(inf && inf.screenId){ tv.screenId = inf.screenId; tv.youtube = true; }
  }
  const rec = (lngCfg().pantallas || []).find(x => (tv.ip && x.ip === tv.ip) || (x.nombre && x.nombre === tv.nombre));
  const sid = tv.screenId || (rec && rec.screenId) || '';
  if(tv.youtube && sid){
    lngLog('TV «' + tv.nombre + '» ya tiene YouTube abierto → me uno a esa sesión con su código de pantalla');
    if(await lngUsarPantalla(sid, tv.nombre, true, true)){ lngRecordar(sid, tv.nombre, tv.ip); return true; }
    lngLog('   → no se pudo así; abro YouTube con código de vinculación');
  }
  if(tv.appUrl && !tv.soloCodigo){
    const ok = await tvApkConectar(tv);
    if(ok === true) return true;
    // El TV no tomó el código de vinculación (YouTube en uso por otro): se usa su código de pantalla.
    const s2 = tv.screenId || sid;
    if(s2){
      lngLog('   → me uno a la sesión de YouTube del TV con su código de pantalla');
      const ok2 = await lngUsarPantalla(s2, tv.nombre, true, ok !== 'PANTALLA');
      if(ok2){ lngRecordar(s2, tv.nombre, tv.ip); const box = document.getElementById('castDevs'), txt = document.getElementById('castDevsTxt'); if(box && txt){ box.hidden = false; box.classList.remove('no', 'busy'); box.classList.add('ok'); txt.textContent = '📺 Conectado a «' + tv.nombre + '» (junto con el otro celular): las canciones de las mesas entran en cola allá.'; } }
      return ok2;
    }
    return false;
  }
  if(sid) return lngUsarPantalla(sid, tv.nombre, !!tv.youtube);
  return tvApkConectar(tv);
}
// Sin lista de aparatos: aviso corto (sin ventana) y se abre la opción del código del TV.
function tvSinLista(msg){
  showToast('📺 ' + msg, 9000);
  const d = document.getElementById('tvOptCodigo'); if(d){ d.open = true; setTimeout(() => d.scrollIntoView({ block: 'start', behavior: 'smooth' }), 300); }
}
function iniCast(){
  if(!document.getElementById('castPres')) return;
  const tb = document.getElementById('tvTransmitir'); if(tb) tb.onclick = tvTransmitirToque;
  try{
    const A = window.VentoAndroid, fila = document.getElementById('apkFondoFila'), sw = document.getElementById('apkFondo'), bat = document.getElementById('apkBateria');
    if(A && typeof A.fondo === 'function' && fila && sw){
      fila.hidden = false; bat.hidden = false;
      sw.checked = !!A.fondo();
      sw.onchange = () => { A.fondoActivar(sw.checked); showToast(sw.checked ? '🔋 ORDEVA seguirá trabajando con la app cerrada (verás un aviso fijo en la barra).' : 'ORDEVA solo trabajará con la app abierta.', 6000); setTimeout(() => { try{ sw.checked = !!A.fondo(); }catch(e){} }, 1500); };
      bat.onclick = () => { try{ A.ajustesBateria(); }catch(e){} };
      const pb = document.getElementById('apkPermisos'), pt = document.getElementById('apkPermisosTxt');
      if(pb && typeof A.permisos === 'function'){
        const pintarP = () => { try{ const e = JSON.parse(A.permisos() || '{}'); const f = (ok, n) => (ok ? '✅ ' : '⚠️ ') + n;
          pt.textContent = [f(e.microfono, 'Micrófono'), f(e.camara, 'Cámara'), f(e.avisos, 'Avisos'), f(e.bateria, 'Sin ahorro de batería'), f(e.fondo, 'Trabajando de fondo')].join(' · ');
          const todo = e.microfono && e.camara && e.avisos && e.bateria; pb.textContent = todo ? '🔐 Permisos del celular: todo listo' : '🔐 Dar los permisos que faltan'; pt.hidden = false; }catch(x){} };
        pb.hidden = false; pintarP();
        pb.onclick = () => { try{ A.pedirPermisos(); }catch(x){} setTimeout(pintarP, 4000); };
        window.ventoPermisosCambio = pintarP;
        document.addEventListener('visibilitychange', () => { if(!document.hidden) pintarP(); });
      }
      const ini = document.getElementById('apkInicio'), pr = document.getElementById('apkProbarAviso');
      if(ini && typeof A.ajustesInicio === 'function'){ ini.hidden = false; ini.onclick = () => { showToast('En la lista que se abre, activa «ORDEVA» (inicio automático / sin restricciones).', 7000); try{ A.ajustesInicio(); }catch(e){} }; }
      if(pr && typeof A.notificar === 'function'){ pr.hidden = false; pr.onclick = () => { const ok = A.notificar('🆕 Pedido de prueba · Mesa 1', '2 Poker, 1 Águila — así te avisa ORDEVA aunque esté cerrada.', 'pedidos', true); showToast(ok ? '🔔 Mira la barra de notificaciones: así suena un pedido.' : '⚠️ Android no deja mostrar avisos: activa las notificaciones de ORDEVA en Ajustes del celular.', 7000); }; }
    }
  }catch(e){}
  const ta = document.getElementById('tvApk'); if(ta){ const ver = !window.VentoAndroid && !!(window.esAndroid && window.esAndroid()); ta.hidden = !ver; ta.style.display = ver ? 'block' : 'none'; }
  // Llegó desde Brave (se abrió en Chrome para transmitir): se lleva a Música y se resalta el botón.
  if(/[?&]transmitir=1/.test(location.search)){
    try{ history.replaceState(null, '', location.pathname + location.hash); }catch(e){}
    setTimeout(() => { try{ document.querySelector('nav button[data-view="musica"]')?.click(); const b = document.getElementById('tvTransmitir'); if(b){ b.scrollIntoView({ block: 'center' }); b.classList.add('pulso'); } showToast('📡 Toca «Transmitir al TV» y elige tu TV o TV Box.', 7000); }catch(e){} }, 1800);
  }
  // v1.19: el modo viejo «abrir YouTube en el celular y mandar al TV» ya no está en pantalla: se apaga
  // para que no salgan avisos de «Mandar al TV» ni se abra YouTube afuera.
  try{ if(LS(CAST_KEY, {}).on && !localStorage.getItem('vito_castoff1')){ SS(CAST_KEY, {}); } localStorage.setItem('vito_castoff1', '1'); }catch(e){}
  /* Un solo botón: una página web no puede ver los aparatos de la red (el navegador no lo permite).
     La que sí los muestra TODOS en un solo ícono (Smart TV, TV Box, Android TV, Chromecast, Fire TV,
     consolas) es la app de YouTube / YouTube Music: este botón la abre con la lista puesta y avisa que
     toque el ícono de transmitir. La lista de Chrome (solo Chromecast) queda aparte. */
  document.getElementById('castPres').onclick = () => { castAbrirApp(); };
  const ccl = document.getElementById('castChromeList'); if(ccl) ccl.onclick = () => ccTransmitir(true);
  setTimeout(() => { castSdk().catch(() => {}); }, 1500);   // se carga antes para que la lista de TV salga al instante
  document.getElementById('castRefresh').onclick = () => transmitirTV();
  // Al volver a ORDEVA (desde YouTube) con canciones nuevas: se ofrece mandarlas al TV de un toque.
  document.addEventListener('visibilitychange', () => {
    if(document.hidden) return;
    castEstado();
    if(typeof lngOn === 'function' && lngOn()) return;   // el TV ya recibe las canciones solas por el código (YouTube del TV): no hace falta nada de esto
    const n = castNuevas().length;
    if(n && !vm().tvOn()) setTimeout(() => { if(!document.hidden && castNuevas().length) castLanzarNuevas(); }, 600);
  });
  // Si una canción nueva entra mientras ORDEVA está abierta, también se avisa — PERO solo si
  // hace falta que la persona haga algo. Si ya está conectado el «YouTube del TV» (con el
  // código de 12 dígitos), las canciones ya entran solas a la cola del TV sin ningún botón que
  // tocar: este aviso de «manda al TV» quedaba sonando de más y sin sentido, avisando de algo
  // que ya había pasado automáticamente.
  setInterval(() => {
    if(typeof lngOn === 'function' && lngOn()) return;
    if(window.notifMusica && !window.notifMusica()) return;
    const n = castNuevas().length; if(n && n !== castAvisadas && !document.hidden){ castAvisadas = n; castEstado(); showToast('🎵 ' + (n === 1 ? 'Hay 1 canción nueva' : 'Hay ' + n + ' canciones nuevas') + ' para el TV: toca «Mandar al TV» en Música.', 6000); }
  }, 10000);
  document.getElementById('castOpenMusic').onclick = () => { SS(CAST_APP_KEY, { app: 'music' }); castAbrirApp(); };
  document.getElementById('castOpenYT').onclick = () => { SS(CAST_APP_KEY, { app: 'yt' }); castAbrirApp(); };
  const env = castEntorno(), ce = document.getElementById('castEnv');
  ce.textContent = env.t + ' · Versión ' + MESORA_VERSION; ce.classList.toggle('bad', !!env.bad);
  document.getElementById('castHelp').onclick = castGuia;
  // «Vincular con código de TV» ahora es el de ORDEVA (sección YouTube del TV), que sí manda la cola sola.
  document.getElementById('castPair').onclick = () => { const b = document.getElementById('lngCode'); if(b){ b.scrollIntoView({ block: 'center', behavior: 'smooth' }); setTimeout(() => b.focus(), 400); } };

  document.getElementById('castStop').onclick = () => { SS(CAST_KEY, {}); castEstado(); showToast('Transmisión terminada. En el TV puedes detenerla desde la app de YouTube.'); };
  const nb = document.querySelector('nav button[data-view="musica"]'); if(nb) nb.addEventListener('click', castEstado);
  setInterval(castEstado, 15000);
  // Volvió de conectar Google: sigue con la transmisión que se había pedido.
  setInterval(() => { if(castEsperaGoogle && vm().yTok()){ castEsperaGoogle = 0; transmitirTV(); } else if(castEsperaGoogle && Date.now() - castEsperaGoogle > 120000) castEsperaGoogle = 0; }, 1000);
  castEstado();
}

/* ---------- Sedes adicionales: se pagan (código de activación firmado) ----------
   La sede principal va incluida. Cada sede adicional se activa con un código que genera el dueño
   de ORDEVA en licencias.html con SU llave privada (que nunca está en la app ni en GitHub). La app
   solo tiene la llave pública: con ella comprueba que el código es auténtico, que es para ESTE
   equipo y que no ha vencido. Nadie puede fabricar un código válido sin la llave privada. */
const LIC_PUB = {"kty": "EC", "crv": "P-256", "x": "6tWjt1Nt7nzGlVijod0J1_6lSJtXJwEMQ84hG-Jgeko", "y": "zi6sTkXAddYp0frD8QP97PjvoWKASu42ATu3EAe2XrE"};
// Llave del panel ORDEVA Admin (protegida con el código personal del proveedor). Se aceptan las dos.
const LIC_PUB_ADMIN = {"kty": "EC", "crv": "P-256", "x": "xWQFWjVmOPxN8n7VwdYkDWkiT9yIC8_hbSVTJL8CT3U", "y": "l8SXO-hNy1v-FkXW0Irjo5cSbT2si4Kr_ZA_wvVMKGc"};
const LIC_PUBS = [LIC_PUB, LIC_PUB_ADMIN];
const LIC_KEY = 'mesora-licencia', EQUIPO_KEY = 'mesora-equipo';
const SEDES_INCLUIDAS = 1;                         // la sede principal
const SEDE_PRECIO_TEXTO = '';                      // ej. '$30.000 al mes por sede' (vacío = "consulta el precio")
let licExtra = 0, licInfo = null;
function codigoEquipo(){
  let c = ''; try{ c = localStorage.getItem(EQUIPO_KEY) || ''; }catch(e){}
  if(!c){
    const a = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    c = Array.from(crypto.getRandomValues(new Uint8Array(8)), b => a[b % a.length]).join('');
    c = c.slice(0, 4) + '-' + c.slice(4);
    try{ localStorage.setItem(EQUIPO_KEY, c); }catch(e){}
  }
  return c;
}
const licB64 = s => { s = s.replace(/-/g, '+').replace(/_/g, '/'); while(s.length % 4) s += '='; return Uint8Array.from(atob(s), ch => ch.charCodeAt(0)); };
async function licVerificar(texto){
  const m = String(texto || '').replace(/\s+/g, '').match(/([A-Za-z0-9_-]{10,})\.([A-Za-z0-9_-]{40,})/);
  if(!m) return { error: 'formato' };
  try{
    let ok = false;
    for(const jwk of LIC_PUBS){
      const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
      if(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, licB64(m[2]), new TextEncoder().encode(m[1]))){ ok = true; break; }
    }
    if(!ok) return { error: 'firma' };
    const p = JSON.parse(new TextDecoder().decode(licB64(m[1])));
    if(p.d !== codigoEquipo() && p.d !== codigoNegocio()) return { error: 'equipo', p };
    if(p.v && p.v < Date.now()) return { error: 'vencida', p };
    return { p, raw: m[1] + '.' + m[2] };
  }catch(e){ return { error: 'formato' }; }
}
const LICS_KEY = 'vento-licencias', NEGOCIO_KEY = 'vento-negocio';
// Código del NEGOCIO: el mismo en todos los celulares del negocio (viaja con los datos). La suscripción se firma para él.
function codigoNegocio(){
  let c = ''; try{ c = localStorage.getItem(NEGOCIO_KEY) || ''; }catch(e){}
  if(!c && typeof data !== 'undefined' && data && data.negocioCodigo) c = data.negocioCodigo;
  if(!c){ const a = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; c = Array.from(crypto.getRandomValues(new Uint8Array(8)), b => a[b % a.length]).join(''); c = c.slice(0, 4) + '-' + c.slice(4); }
  try{ localStorage.setItem(NEGOCIO_KEY, c); }catch(e){}
  if(typeof data !== 'undefined' && data && data.negocioCodigo !== c){ data.negocioCodigo = c; try{ saveData(); }catch(e){} }
  return c;
}
function licRaws(){
  const out = [];
  try{ const a = localStorage.getItem(LIC_KEY); if(a) out.push(a); }catch(e){}
  try{ (JSON.parse(localStorage.getItem(LICS_KEY) || '[]') || []).forEach(x => out.push(x)); }catch(e){}
  try{ if(typeof data !== 'undefined' && data && Array.isArray(data.licencias)) data.licencias.forEach(x => out.push(x)); }catch(e){}
  return [...new Set(out.filter(Boolean))];
}
async function licCargar(){
  licExtra = 0; licInfo = null; subInfo = null; subEsProveedor = false;
  for(const raw of licRaws()){
    const r = await licVerificar(raw), p = r.p;
    if(!p || (r.error && r.error !== 'vencida')) continue;
    const vencida = r.error === 'vencida';
    if(p.r === 'proveedor' && !vencida) subEsProveedor = true;
    if(p.m && (!subInfo || (p.v || 9e15) > (subInfo.v || 9e15))) subInfo = Object.assign({ vencida }, p);
    if(!vencida && p.s){ if((p.s | 0) >= licExtra){ licExtra = Math.max(0, p.s | 0); licInfo = p; } }
  }
  licPintar();
  try{ subAplicar(); }catch(e){}
}
// Con cuenta de ORDEVA Nube (y sin ser el proveedor) la cuenta es de un solo negocio: no se agregan sedes en ella.
function sedeUnaPorCuenta(){ try{ return !!(window.ventoNube && window.ventoNube.negocio && window.ventoNube.negocio()) && !(typeof subEsProv === 'function' && subEsProv()); }catch(e){ return false; } }
function licPuedeAgregarSede(){ return sedesList().length < SEDES_INCLUIDAS + licExtra; }
function licPintar(){
  const box = document.getElementById('licPlan'); if(!box) return;
  const usadas = sedesList().length, total = SEDES_INCLUIDAS + licExtra;
  box.innerHTML = '<b>Tu plan:</b> ' + total + (total === 1 ? ' sede' : ' sedes') + ' (' + SEDES_INCLUIDAS + ' incluida' + (licExtra ? ' + ' + licExtra + ' pagada' + (licExtra > 1 ? 's' : '') : '') + ') · usas ' + usadas + '.' +
    (licInfo && licInfo.v ? ' Vence el ' + new Date(licInfo.v).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }) + '.' : '') +
    '<br>Código de tu negocio: <b>' + codigoNegocio() + '</b>' + (sedeUnaPorCuenta() ? '<br>Tu cuenta es de un solo negocio: para otra sede, crea otra cuenta con su propia suscripción.' : ' · <a href="#" id="licOpen" style="color:var(--cream);font-weight:700">Activar más sedes</a>');
  const a = document.getElementById('licOpen'); if(a) a.onclick = e => { e.preventDefault(); licPaywall(''); };
}
async function licActivar(texto, silencioso){
  // Licencia del proveedor (VENTO-XXXX-XXXX-XXXX): la activa el servidor en el negocio de la cuenta.
  const lic = /VENTO-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}/i.exec(String(texto || '').replace(/\s+/g, ''));
  if(lic){
    if(!(window.ventoSuscripcion && window.ventoSuscripcion.canjear)){ if(!silencioso) showToast('⚠️ Para activar esa licencia entra con tu cuenta de ORDEVA (correo y contraseña).', 8000); return false; }
    try{ const r = await window.ventoSuscripcion.canjear(lic[0]); showToast('🎉 Licencia activada: plan ' + String(r.plan_id || '').toUpperCase() + ' hasta el ' + new Date(r.hasta).toLocaleDateString('es-CO') + '.', 9000); return true; }
    catch(e){ if(!silencioso) showToast('⚠️ ' + ((e && e.message) || 'No se pudo activar la licencia.'), 8000); return false; }
  }
  const r = await licVerificar(texto);
  if(r.error){
    const why = { formato: 'Ese código no está completo. Cópialo o ábrelo desde el link tal como te llegó.', firma: 'Ese código no es válido.', equipo: 'Ese código es para otro negocio (' + (r.p && r.p.d) + '). El código de tu negocio es ' + codigoNegocio() + '.', vencida: 'Ese código ya venció.' }[r.error];
    if(!silencioso) showToast('⚠️ ' + why, 8000);
    return false;
  }
  try{ const l = JSON.parse(localStorage.getItem(LICS_KEY) || '[]') || []; if(!l.includes(r.raw)) l.push(r.raw); localStorage.setItem(LICS_KEY, JSON.stringify(l.slice(-20))); }catch(e){}
  if(r.p.d === codigoNegocio() && typeof data !== 'undefined' && data){ data.licencias = (data.licencias || []).filter(x => x !== r.raw).concat([r.raw]).slice(-20); try{ saveData(); }catch(e){} }
  await licCargar();
  if(r.p.r === 'proveedor') showToast('👑 Este equipo quedó como PROVEEDOR de ORDEVA: control total, sin restricciones.', 8000);
  else if(r.p.m) showToast('✅ Suscripción activa' + (r.p.v ? ' hasta el ' + new Date(r.p.v).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }) : '') + '. ¡Gracias!', 8000);
  else showToast('✅ Activado: ahora puedes tener ' + (SEDES_INCLUIDAS + licExtra) + ' sedes.', 7000);
  return true;
}
function licPaywall(nombreSede){
  let ov = document.getElementById('licOverlay');
  if(!ov){
    ov = document.createElement('div'); ov.id = 'licOverlay'; ov.className = 'overlay';
    ov.innerHTML = '<div class="modal" style="max-width:420px;text-align:center"><h2>🏢 Agregar otra sede</h2>' +
      '<div class="modal-sub" id="licTxt"></div>' +
      '<div class="modal-sub" style="margin-top:10px">Código de tu negocio:</div><div class="lic-code" id="licEquipo"></div>' +
      '<div class="modal-actions" style="flex-direction:column;gap:8px">' +
        '<button class="btn-primary" id="licWa" type="button" style="width:100%;padding:13px;font-size:15px">💬 Pedir activación por WhatsApp</button>' +
        '<input id="licInput" class="mz-in" placeholder="¿Ya pagaste? Pega aquí tu código de activación" autocomplete="off" autocapitalize="none" spellcheck="false" style="width:100%;box-sizing:border-box">' +
        '<button class="btn-ghost" id="licGo" type="button" style="width:100%">✅ Activar</button>' +
        '<button class="btn-close" id="licNo" type="button">Cerrar</button></div></div>';
    document.body.appendChild(ov);
    ov.querySelector('#licNo').onclick = () => ov.classList.remove('show');
    ov.querySelector('#licGo').onclick = async () => { if(await licActivar(ov.querySelector('#licInput').value)){ ov.classList.remove('show'); renderSedesUI(); } };
  }
  const total = SEDES_INCLUIDAS + licExtra;
  ov.querySelector('#licTxt').innerHTML = 'Tu plan incluye <b>' + total + (total === 1 ? ' sede' : ' sedes') + '</b> y ya las estás usando. Cada sede adicional tiene un costo' + (SEDE_PRECIO_TEXTO ? ': <b>' + SEDE_PRECIO_TEXTO + '</b>' : '') + '. Escríbenos para pagar y te enviamos el código de activación; al abrirlo, la sede queda activa en este equipo.';
  ov.querySelector('#licEquipo').textContent = codigoNegocio();
  ov.querySelector('#licWa').onclick = () => {
    const msg = 'Hola, quiero activar ' + (total + 1 - SEDES_INCLUIDAS) + ' sede(s) adicional(es) en ORDEVA.\nNegocio: ' + ((data && data.businessName) || '') + (nombreSede ? '\nNueva sede: ' + nombreSede : '') + '\nCódigo del negocio: ' + codigoNegocio();
    window.open('https://wa.me/' + ventoWa() + '?text=' + encodeURIComponent(msg), '_blank');
  };
  ov.classList.add('show');
}
// Link de activación: index.html#licencia=CODIGO (lo manda el dueño de ORDEVA por WhatsApp).
async function licDesdeLink(){
  const m = /[#&]licencia=([A-Za-z0-9_.-]+)/.exec(location.hash);
  if(!m) return;
  try{ history.replaceState(null, '', location.pathname + location.search); }catch(e){}
  await licActivar(m[1]);
}

/* ---------- Suscripción: ORDEVA es un SERVICIO del proveedor (1.27) ----------
   • PROVEEDOR (el dueño de ORDEVA): su equipo se activa con una licencia firmada «proveedor» (licencias.html,
     con SU llave privada). Tiene control total: es el único que puede borrar todo, borrar historial, etc.
   • SUSCRIPTORES (los negocios que pagan): usan la app con restricciones. Su mensualidad es una licencia
     firmada para el código del NEGOCIO (sirve en todos sus celulares) con fecha de vencimiento.
   • Sin suscripción: prueba gratis de PRUEBA_DIAS días + GRACIA_DIAS de gracia. Después, la app NO borra
     nada ni pierde pedidos: deja ver todo, cobrar las cuentas abiertas, recibir los pedidos del QR y sacar
     respaldo, pero no deja hacer ventas nuevas hasta renovar. Nadie puede fabricar una licencia sin la llave.
   • NEGOCIO EN VENTO NUBE (nube/vento-suscripcion.js): el plan lo decide el SERVIDOR (suscripción de la cuenta +
     el negocio, pagos Nequi/DaviPlata con comprobante). Cuando hay un estado VERIFICADO (token firmado por el
     servidor), subEstado() usa ese estado, se vende con «pos_basic» y cada función PRO pide su permiso
     (entitlement). Sin nube, o mientras el servidor no responde con un estado firmado, todo sigue como arriba. */
let PRUEBA_DIAS = 15, GRACIA_DIAS = 3;
let SUSCRIPCION_PRECIO_TEXTO = '';       // ej. '$59.900 al mes' (vacío = «consulta el precio»)
/* Configuración que publica el proveedor desde ORDEVA Admin (admin.html → «Configurar la app»): precio, días de prueba
   y de gracia, WhatsApp de soporte, anuncio para todos y negocios suspendidos. Vive en la rama «vento-config» de
   GitHub; se lee al abrir y cada hora, y se guarda para cuando no hay internet. */
const VENTO_CFG_URL = 'https://raw.githubusercontent.com/cristhianlujan45-blip/cuentas/vento-config/vento-config.json';
let ventoCfg = (() => { try{ return JSON.parse(localStorage.getItem('vento-cfg') || 'null') || {}; }catch(e){ return {}; } })();
function ventoCfgAplicar(){
  const c = ventoCfg || {};
  if(c.pruebaDias != null && isFinite(c.pruebaDias)) PRUEBA_DIAS = Math.max(0, +c.pruebaDias);
  if(c.graciaDias != null && isFinite(c.graciaDias)) GRACIA_DIAS = Math.max(0, +c.graciaDias);
  if(typeof c.precioTexto === 'string') SUSCRIPCION_PRECIO_TEXTO = c.precioTexto;
  try{ subAplicar(); }catch(e){}
  try{ ventoAnuncioPintar(); }catch(e){}
}
async function ventoCfgCargar(){
  try{
    const r = await fetch(VENTO_CFG_URL + '?t=' + Math.floor(Date.now() / 6e4), { cache: 'no-store' });
    if(!r.ok) return;
    const j = await r.json();
    if(j && typeof j === 'object'){ ventoCfg = j; try{ localStorage.setItem('vento-cfg', JSON.stringify(j)); }catch(e){} ventoCfgAplicar(); }
  }catch(e){}
}
const ventoWa = () => String((ventoCfg && ventoCfg.whatsapp) || SUPPORT_WA_NUMBER).replace(/\D/g, '') || SUPPORT_WA_NUMBER;
function ventoAnuncioPintar(){
  const txt = String((ventoCfg && ventoCfg.anuncio) || '').trim();
  let bar = document.getElementById('ventoAnuncio');
  let visto = ''; try{ visto = localStorage.getItem('vento-anuncio-visto') || ''; }catch(e){}
  if(!txt || visto === txt){ if(bar) bar.hidden = true; return; }
  if(!bar){
    const h = document.querySelector('.wrap > header'); if(!h) return;
    bar = document.createElement('div'); bar.id = 'ventoAnuncio'; bar.className = 'sub-bar';
    h.parentNode.insertBefore(bar, h.nextSibling);
    bar.addEventListener('click', e => { if(e.target.closest('[data-x]')){ try{ localStorage.setItem('vento-anuncio-visto', bar.dataset.txt || ''); }catch(x){} bar.hidden = true; } });
  }
  bar.dataset.txt = txt; bar.hidden = false;
  bar.innerHTML = '<span>📣 ' + txt.replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch])) + '</span><i data-x title="Entendido">✕</i>';
}
setTimeout(() => { ventoCfgAplicar(); ventoCfgCargar(); }, 2500);
setInterval(ventoCfgCargar, 60 * 60000);
let subInfo = null, subEsProveedor = false;
const DIA_MS = 864e5;
function subPruebaDesde(){
  let a = 0; try{ a = +localStorage.getItem('vento-prueba-desde') || 0; }catch(e){}
  const b = (typeof data !== 'undefined' && data && +data.pruebaDesde) || 0;
  let t = [a, b].filter(x => x > 1.5e12).sort((x, y) => x - y)[0] || Date.now();
  if(t > Date.now()) t = Date.now();
  try{ localStorage.setItem('vento-prueba-desde', String(t)); }catch(e){}
  if(typeof data !== 'undefined' && data && data.pruebaDesde !== t){ data.pruebaDesde = t; try{ saveData(); }catch(e){} }
  return t;
}
// Suscripción de ORDEVA Nube con estado verificado por el servidor (si no, null → sistema de siempre).
const subNube = () => { try{ const s = window.ventoSuscripcion; return s && s.enCuenta() && s.verificado() ? s : null; }catch(e){ return null; } };
// Licencia firmada del sistema anterior (licencias.html / ORDEVA Admin) todavía vigente. La firma el proveedor con su llave
// privada, así que darle prioridad es seguro: un negocio que ya pagó así no pierde nada al conectarse a ORDEVA Nube.
const subLicVigente = () => !!(subInfo && !subInfo.vencida && (!subInfo.v || subInfo.v > Date.now()));
function subEstado(){
  if(subEsProveedor) return { k: 'proveedor' };
  const now = Date.now();
  try{ if(ventoCfg && Array.isArray(ventoCfg.suspendidos) && ventoCfg.suspendidos.includes(codigoNegocio())) return { k: 'vencida', suspendido: true }; }catch(e){}
  const sn = subNube();
  if(sn){ const x = sn.estadoApp(); if(x && (x.k === 'activa' || x.k === 'prueba' || !subLicVigente())) return x; }   // {k:'activa'|'prueba'|'revision'|'rechazada'|'vencida'|'cancelada'|'gratis', nube:true, …}
  if(subInfo && !subInfo.vencida && (!subInfo.v || subInfo.v > now)) return { k: 'activa', v: subInfo.v || 0, dias: subInfo.v ? Math.ceil((subInfo.v - now) / DIA_MS) : null, plan: subInfo.pl || '' };
  const finPrueba = subPruebaDesde() + PRUEBA_DIAS * DIA_MS;
  if(!subInfo && now < finPrueba) return { k: 'prueba', dias: Math.ceil((finPrueba - now) / DIA_MS) };
  const fin = (subInfo && subInfo.v ? Math.max(subInfo.v, 0) : finPrueba) + GRACIA_DIAS * DIA_MS;
  if(now < fin) return { k: 'gracia', dias: Math.ceil((fin - now) / DIA_MS) };
  return { k: 'vencida' };
}
window.ventoPlan = () => subEstado();
const subEsProv = () => subEstado().k === 'proveedor';
// ¿El plan incluye esta función? Solo se restringe con la nube y un estado verificado; el proveedor puede todo.
const subAcceso = ent => { if(subEsProv() || subLicVigente()) return true; const sn = subNube(); return !sn || sn.tiene(ent); };
// En la nube se vende con «pos_basic» (el plan gratis lo trae: con el plan PRO vencido se sigue vendiendo).
const subPuedeVender = () => { const st = subEstado(); if(st.k === 'proveedor') return true; if(st.nube) return subAcceso('pos_basic');
  try{ const s = window.ventoSuscripcion; if(s && s.enCuenta() && !s.verificado()) return true; }catch(e){}
  return st.k !== 'vencida'; };
function subRenovarWa(){
  const st = subEstado();
  const pl = ((ventoCfg && ventoCfg.planes) || []).find(p => p.id === subPlanElegido);
  const msg = 'Hola, quiero ' + (st.k === 'activa' ? 'renovar' : 'activar') + ' mi suscripción de ORDEVA' + (pl ? ' (plan ' + pl.nombre + (pl.precio ? ', ' + fmt(pl.precio) + '/mes' : '') + ')' : '') + '. Te envío el comprobante de pago.\nNegocio: ' + ((typeof data !== 'undefined' && data && data.businessName) || '') + '\nCódigo del negocio: ' + codigoNegocio();
  window.open('https://wa.me/' + ventoWa() + '?text=' + encodeURIComponent(msg), '_blank');
}
function subPaywall(motivo){
  const sn = subNube();
  if(sn && !subEstado().suspendido){ sn.abrirPlanes(motivo || ''); return; }   // planes y pagos de ORDEVA Nube
  let ov = document.getElementById('subOverlay');
  if(!ov){
    ov = document.createElement('div'); ov.id = 'subOverlay'; ov.className = 'overlay';
    ov.innerHTML = '<div class="modal" style="max-width:420px;text-align:center"><h2 id="subTit">💳 Tu suscripción</h2>' +
      '<div class="modal-sub" id="subTxt"></div>' +
      '<div id="subPlanes"></div>' +
      '<div class="modal-sub" style="margin-top:10px">Código de tu negocio:</div><div class="lic-code" id="subCod"></div>' +
      '<div class="modal-actions" style="flex-direction:column;gap:8px">' +
        '<button class="btn-primary" id="subWa" type="button" style="width:100%;padding:13px;font-size:15px">✅ Ya pagué: enviar comprobante por WhatsApp</button>' +
        '<input id="subInput" class="mz-in" placeholder="¿Ya pagaste? Pega aquí tu código de activación" autocomplete="off" autocapitalize="none" spellcheck="false" style="width:100%;box-sizing:border-box">' +
        '<button class="btn-ghost" id="subGo" type="button" style="width:100%">✅ Activar</button>' +
        '<button class="btn-ghost" id="subSalir" type="button" hidden style="width:100%">🚪 Cerrar sesión</button>' +
        '<button class="btn-close" id="subNo" type="button">Cerrar</button></div></div>';
    document.body.appendChild(ov);
    ov.querySelector('#subNo').onclick = () => ov.classList.remove('show');
    ov.querySelector('#subSalir').onclick = () => { try{ window.ventoSalir(); }catch(e){ location.reload(); } };
    ov.querySelector('#subWa').onclick = subRenovarWa;
    ov.querySelector('#subGo').onclick = async () => { if(await licActivar(ov.querySelector('#subInput').value)){ ov.classList.remove('show'); } };
  }
  const st = subEstado();
  ov.querySelector('#subTit').textContent = st.suspendido ? '⛔ Negocio suspendido' : st.k === 'vencida' ? '🔒 Tu suscripción venció' : '💳 Planes y pagos';
  ov.querySelector('#subTxt').innerHTML = (motivo ? '<b>' + motivo + '</b><br>' : '') +
    (st.suspendido ? 'Tu negocio está suspendido por el proveedor de ORDEVA. Tus datos están a salvo: puedes ver todo, cobrar las cuentas abiertas, recibir los pedidos del QR y guardar respaldo. Para reactivarlo, escríbenos' : st.k === 'vencida' ? 'Tus datos están a salvo: puedes ver todo, cobrar las cuentas abiertas, recibir los pedidos del QR y guardar respaldo. Para seguir vendiendo, renueva tu suscripción' :
     st.k === 'prueba' ? 'Estás en la prueba gratis: te quedan <b>' + st.dias + ' día' + (st.dias === 1 ? '' : 's') + '</b>. Para seguir usando ORDEVA después, activa tu suscripción' :
     st.k === 'gracia' ? 'Tu suscripción está por cortarse: te quedan <b>' + st.dias + ' día' + (st.dias === 1 ? '' : 's') + '</b> de gracia. Renueva tu suscripción' :
     'Renueva tu suscripción') + (SUSCRIPCION_PRECIO_TEXTO ? ': <b>' + SUSCRIPCION_PRECIO_TEXTO + '</b>.' : '.') + ' Escríbenos por WhatsApp con el código de tu negocio y te mandamos tu código de activación.';
  ov.querySelector('#subCod').textContent = codigoNegocio();
  ov.querySelector('#subSalir').hidden = !(st.suspendido || st.k === 'vencida');   // se acabó la mensualidad: también puede salir
  subPlanesPintar(ov.querySelector('#subPlanes'));
  ov.classList.add('show');
}
// Planes y medios de pago que publica el proveedor (ORDEVA Admin → Planes y «Cómo te pagan»).
let subPlanElegido = '';
function subPlanesPintar(box){
  if(!box) return;
  const c = ventoCfg || {}, planes = Array.isArray(c.planes) ? c.planes : [], pg = c.pagos || {};
  const e = t => String(t == null ? '' : t).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  let h = '';
  if(planes.length){
    h += '<div class="sp-tit">Elige tu plan</div><div class="sp-planes">' + planes.map(p =>
      '<div class="sp-plan' + (subPlanElegido === p.id ? ' on' : '') + '" data-plan="' + e(p.id) + '"><b>' + e(p.nombre) + '</b><div class="sp-precio">' + (p.precio ? fmt(p.precio) + '<small>/mes</small>' : 'Consulta el precio') + '</div>' +
      (p.desc ? '<div class="sp-desc">' + e(p.desc) + '</div>' : '') +
      (p.link ? '<a class="btn-primary sp-pagar" href="' + e(p.link) + '" target="_blank" rel="noopener">💳 Pagar con tarjeta, PSE o Nequi</a>' : '') + '</div>').join('') + '</div>';
  }
  const m = [];
  if(pg.nequi) m.push(['📱 Nequi / Daviplata', pg.nequi]);
  if(pg.breb) m.push(['⚡ Llave Bre-B', pg.breb]);
  if(pg.banco) m.push(['🏦 Transferencia', pg.banco]);
  if(m.length){
    h += '<div class="sp-tit">O paga por transferencia' + (pg.titular ? ' a nombre de <b>' + e(pg.titular) + '</b>' : '') + '</div>' +
      m.map(x => '<div class="sp-medio"><span>' + x[0] + '<b>' + e(x[1]) + '</b></span><button type="button" class="btn-ghost" data-copiar="' + e(x[1]) + '">📋 Copiar</button></div>').join('') +
      '<div class="sp-nota">Después de pagar, toca «Ya pagué» y envía el comprobante. Te activamos con un código que llega por WhatsApp.</div>';
  }
  box.innerHTML = h;
  box.querySelectorAll('[data-plan]').forEach(x => x.onclick = ev => { if(ev.target.closest('a')) return; subPlanElegido = x.dataset.plan; box.querySelectorAll('[data-plan]').forEach(y => y.classList.toggle('on', y === x)); });
  box.querySelectorAll('[data-copiar]').forEach(b => b.onclick = () => { const t = b.dataset.copiar; (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => showToast('📋 Copiado: ' + t), () => prompt('Copia esto:', t)); });
}
function subTexto(st){
  if(st.k === 'proveedor') return '👑 <b>Proveedor de ORDEVA</b>: este equipo tiene control total, sin restricciones.';
  if(st.k === 'activa') return '✅ <b>Suscripción activa</b>' + (st.plan ? ' · plan ' + st.plan : '') + (st.v ? ' · vence el ' + new Date(st.v).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }) + ' (' + st.dias + ' día' + (st.dias === 1 ? '' : 's') + ')' : '') + '.';
  if(st.k === 'prueba') return '🎁 <b>Prueba gratis</b>: te quedan ' + st.dias + ' día' + (st.dias === 1 ? '' : 's') + '.';
  if(st.k === 'gracia') return '⚠️ <b>Suscripción por cortarse</b>: ' + st.dias + ' día' + (st.dias === 1 ? '' : 's') + ' de gracia.';
  return '🔒 <b>Suscripción vencida</b>: puedes ver, cobrar y sacar respaldo, pero no hacer ventas nuevas.';
}
function subPintar(){
  const st = subEstado(), sn = st.nube ? subNube() : null;
  // Panel en Ajustes → Negocio
  let g = document.getElementById('subGrupo');
  if(!g){
    const ref = document.querySelector('#view-ajustes .settings-group[data-cat="negocio"]');
    if(ref){
      g = document.createElement('div'); g.className = 'settings-group'; g.id = 'subGrupo'; g.dataset.cat = 'negocio'; g.hidden = ref.hidden;
      g.innerHTML = '<h2>💳 Plan y suscripción</h2><div id="subNubePanel" data-novocab hidden></div><div id="subViejo"><div class="lic-plan" id="subPlan"></div>' +
        '<div class="settings-desc">ORDEVA es un servicio por suscripción. Solo el proveedor de ORDEVA puede cambiar la aplicación, borrar todo o borrar historial; tus datos siempre quedan guardados.</div>' +
        '<div class="mz-actions" style="flex-wrap:wrap"><button class="btn-warn" id="subRenovarBtn" type="button">💳 Planes y pagos</button><button class="btn-ghost" id="subCodigoBtn" type="button">🔑 Pegar código de activación</button><a class="btn-ghost" id="subLicLink" href="admin.html" target="_blank" rel="noopener" hidden>👑 ORDEVA Admin (proveedor)</a></div></div>';
      ref.parentNode.insertBefore(g, ref);
      g.querySelector('#subRenovarBtn').onclick = () => subPaywall('');
      g.querySelector('#subCodigoBtn').onclick = () => subPaywall('');
    }
  }
  if(g){
    // Con la nube: estado del servidor, pagos (solo dueño/administrador) y renovación. Sin nube: licencias de siempre.
    const panel = g.querySelector('#subNubePanel');
    g.querySelector('#subViejo').hidden = !!sn; panel.hidden = !sn;
    if(sn) sn.pintarPanel(panel);
    g.querySelector('#subPlan').innerHTML = subTexto(st) + '<br>Código de tu negocio: <b>' + codigoNegocio() + '</b>' + (st.k === 'proveedor' ? ' · Código de este equipo: <b>' + codigoEquipo() + '</b>' : '');
    g.querySelector('#subLicLink').hidden = st.k !== 'proveedor';
  }
  // Barra arriba solo cuando hace falta (prueba, gracia, vencida o pocos días)
  let bar = document.getElementById('subBar');
  const mostrar = st.k === 'prueba' || st.k === 'gracia' || st.k === 'vencida' || (st.k === 'activa' && st.dias != null && st.dias <= 5);
  if(!bar){
    const h = document.querySelector('.wrap > header'); if(!h) return;
    bar = document.createElement('div'); bar.id = 'subBar'; bar.className = 'sub-bar';
    h.parentNode.insertBefore(bar, h.nextSibling);
    // ✕: la barra se oculta por 3 días (o hasta que cambie lo que avisa: ej. de «prueba» a «vencida»). El menú sigue en ⋯ Más → 💳 Mi plan.
    bar.addEventListener('click', e => { if(e.target.closest('[data-x]')){ e.stopPropagation(); try{ localStorage.setItem('vento-subbar-x', JSON.stringify({ k: bar.dataset.k || '', t: Date.now() })); }catch(x){} bar.hidden = true; try{ showToast('Listo, oculté el aviso. Tu plan está en ⋯ Más → 💳 Mi plan.', 4500); }catch(x){} return; }
      const s2 = subNube(); if(s2 && bar.dataset.accion === 'renovar'){ s2.abrirRenovar(); return; } subPaywall(''); });
  }
  const xGuard = (() => { try{ return JSON.parse(localStorage.getItem('vento-subbar-x') || 'null'); }catch(e){ return null; } })();
  const cerradaK = k => !!(xGuard && xGuard.k === k && Date.now() - (xGuard.t || 0) < 3 * 864e5);
  // «Mi plan» en ⋯ Más: para quien maneja los pagos (con la nube, dueño o administrador; sin nube, siempre).
  try{ const mt = document.getElementById('morePlanTile'); if(mt){ mt.hidden = !!(sn && !(sn.estado() || {}).manda); const tx = document.getElementById('morePlanTxt'); if(tx) tx.textContent = sn ? ('Plan ' + String((sn.estado() || {}).plan || 'gratis').toUpperCase() + ' · planes y pagos') : (st.k === 'prueba' ? 'Prueba gratis: ' + st.dias + ' día' + (st.dias === 1 ? '' : 's') : 'Suscripción, planes y pagos'); } }catch(e){}
  if(sn){   // barra de ORDEVA Nube: renovar, pago en revisión, rechazado, vencido (cajero y mesero no la ven)
    const b = sn.barra() || {};
    bar.hidden = !b.mostrar || (cerradaK(b.k || '') && !b.fija); bar.dataset.k = b.k || ''; bar.dataset.accion = b.accion || '';
    bar.innerHTML = b.html || '';
    return;
  }
  bar.dataset.accion = '';
  bar.hidden = !mostrar || (cerradaK(st.k) && st.k !== 'vencida');
  bar.dataset.k = st.k;
  bar.innerHTML = '<span>' + subTexto(st) + '</span><b>' + (st.k === 'vencida' ? 'Renovar' : 'Activar') + ' ›</b>' + (st.k !== 'vencida' ? '<i data-x title="Ocultar">✕</i>' : '');
}
function subAplicar(){ try{ subPintar(); }catch(e){} document.body.classList.toggle('sub-vencida', subEstado().k === 'vencida'); }
// Solo el PROVEEDOR: borrar todo y borrar historial (datos permanentes).
const SUB_SOLO_PROVEEDOR = '#resetAllBtn, #deleteHistoryDayBtn';
// Con la suscripción vencida no se hacen ventas nuevas (cobrar, ver, respaldo y pedidos del QR siguen funcionando).
const SUB_VENTAS = '#addItemBtn, #qpAddBtn, #scanSellBtn, #prodAddBtn, #voiceProductBtn, #invInvoiceCamBtn, #invInvoiceGalBtn, #voiceFab, #personAddItemBtn, #favChips button, .fav-chips button[data-fav]';
document.addEventListener('click', ev => {
  const t = ev.target && ev.target.closest && ev.target.closest(SUB_SOLO_PROVEEDOR + ', ' + SUB_VENTAS);
  if(!t) return;
  if(t.matches(SUB_SOLO_PROVEEDOR) && !subEsProv()){
    ev.preventDefault(); ev.stopImmediatePropagation();
    showToast('🔒 Solo el proveedor de ORDEVA puede borrar datos permanentes. Si lo necesitas, escríbenos por WhatsApp (Ajustes → Guía y soporte).', 8000);
    return;
  }
  if(t.matches(SUB_VENTAS) && !subPuedeVender()){
    ev.preventDefault(); ev.stopImmediatePropagation();
    subPaywall('Para hacer ventas nuevas, renueva tu suscripción.');
  }
}, true);
setInterval(() => { try{ subAplicar(); }catch(e){} }, 60 * 60000);
// Funciones PRO (solo con el negocio en ORDEVA Nube y un estado verificado): sin el permiso se abre «Función PRO».
const SUB_FUNCIONES = [
  ['voice', '#voiceFab, #voiceFabAI, #voiceProductBtn', 'Pedidos por voz'],
  ['voice', '#holaVentoToggle', '«Hola ORDEVA» (manos libres)'],
  ['ocr', '#invInvoiceCamBtn, #invInvoiceGalBtn', 'Leer facturas con la cámara'],
  ['ai_camera', '#cameraBtn, #invPriceBtn, #qpCameraBtn, #domIaFotoBtn', 'La cámara con IA'],
  ['advanced_reports', 'nav button[data-view="estadisticas"], .more-tile[data-go="estadisticas"]', 'Estadísticas avanzadas'],
  ['multi_branch', '#sedeAddBtn', 'Agregar otra sede'],
  ['employee_management', '#accAddBtn, #nubeInvitar', 'Invitar personas a tu equipo'],
  ['invoices', '#fiHistBtn', 'Facturas de proveedor'],
  ['expenses', '#ctGuardar', 'Registrar gastos']
];
document.addEventListener('click', ev => {
  const sn = subNube(); if(!sn || subEsProv() || subLicVigente()) return;
  const el = ev.target && ev.target.closest ? ev.target : null; if(!el) return;
  for(const [ent, sel, nombre] of SUB_FUNCIONES){
    const t = el.closest(sel); if(!t) continue;
    if(t.id === 'holaVentoToggle' && !t.checked) return;   // apagar «Hola ORDEVA» siempre se puede
    if(sn.tiene(ent)) return;
    ev.preventDefault(); ev.stopImmediatePropagation();
    sn.funcionPro(ent, nombre);
    return;
  }
}, true);
// Voz por «Hola ORDEVA» (manos libres) y demás caminos al reconocedor: también piden el permiso «voice».
if(typeof handleVoiceTranscript === 'function'){
  const subVozOrig = handleVoiceTranscript;
  handleVoiceTranscript = async function(){
    // window.__pedidoOrigen = pedido escrito que llega de la app de meseros o del QR: no es el micrófono, siempre pasa.
    if(!window.__pedidoOrigen && !subAcceso('voice')){ try{ window.ventoSuscripcion.funcionPro('voice', 'Pedidos por voz'); }catch(e){} return; }
    return subVozOrig.apply(this, arguments);
  };
}
// El estado de la suscripción en la nube cambió (llegó del servidor, se aprobó un pago…): se repinta.
window.addEventListener('vento-suscripcion', () => { try{ subAplicar(); }catch(e){} });

/* ---------- YouTube del TV en vivo (protocolo «Vincular con código de TV») ----------
   La app de YouTube del TV acepta controles remotos: con el código del TV se obtiene un permiso
   (loungeToken) y se abre una sesión de control. Por esa sesión ORDEVA manda «setPlaylist» (la
   primera canción) y «addVideo» (cada canción nueva): el TV las agrega a su cola y suenan solas.
   Es el mismo sistema que usan los celulares al vincular un TV; no es una API pública de Google,
   así que YouTube podría cambiarlo. Las llamadas pasan por el puente (Cloudflare Worker) porque
   el navegador bloquea hablar directo con youtube.com desde otra página. */
const LNG_KEY = 'vito_ytlounge';
const lngCfg = () => LS(LNG_KEY, {});
function lngOn(){ const c = lngCfg(); return !!(c.on && lngHayPuente() && c.screenId); }
const lng = { sid: null, gs: null, rid: 1, ofs: 0, t: 0, uuid: '', ocupado: false, error: '', tvPlay: null, ocupadoT: 0, fallas: 0, pausaHasta: 0 };
/* Un solo trabajo con el TV a la vez. Si uno se quedara pegado más de 90 s, se suelta solo.
   Tras errores seguidos (sin internet, puente caído) se espera cada vez más (5 s, 10 s, 20 s…
   hasta 2 min) en vez de insistir cada 4 s; al primer éxito vuelve al ritmo normal. */
function lngTomar(forzar){
  if(lng.ocupado && Date.now() - lng.ocupadoT < 90000) return false;
  if(!forzar && Date.now() < lng.pausaHasta) return false;
  lng.ocupado = true; lng.ocupadoT = Date.now(); return true;
}
function lngResultado(ok){
  if(ok){ lng.fallas = 0; lng.pausaHasta = 0; return; }
  lng.fallas++; lng.pausaHasta = Date.now() + Math.min(120000, 5000 * Math.pow(2, lng.fallas - 1));
}
const LNG_CANCION_MS = 4 * 60000;   // lo que dura más o menos una canción en el TV
function lngUuid(){ const c = lngCfg(); if(!c.uuid){ c.uuid = 'mesora' + Array.from(crypto.getRandomValues(new Uint8Array(10)), b => (b % 36).toString(36)).join(''); SS(LNG_KEY, c); } return c.uuid; }
/* 🩺 Probar conexión: revisa cada paso y dice cuál falla.
   1) la app habla directo con YouTube (si es la app); 2) el puente responde; 3) el puente llega a YouTube
   (se pregunta por un código de TV inventado: si YouTube contesta «no existe», el camino funciona);
   4) si ya hay un TV vinculado, que el TV conteste. */
async function lngProbar(){
  const out = [], c = lngCfg(), fake = { pairing_code: '000000000000' };
  const yt = st => st >= 400 && st < 500;                 // YouTube contestó (el código inventado no existe): el camino sirve
  if(lngPuenteApp()){
    try{ await lngFetchApp('pairing/get_screen', null, fake); out.push('✅ La app habla directo con YouTube.'); }
    catch(e){ out.push(e.status ? (yt(e.status) ? '✅ La app habla directo con YouTube (puente incluido).' : '❌ YouTube contestó error ' + e.status + ' a la app.') : '❌ La app no llega a YouTube: ' + (e.message || e) + ' Revisa el internet del celular.'); }
  }
  if(c.relay){
    const base = c.relay.replace(/\/+$/, '');
    try{ const r = await fetch(base + '/', { cache: 'no-store' }); const t = await r.text(); out.push(/Vento/.test(t) ? '✅ El puente responde (' + base.replace(/^https:\/\//, '') + ').' : '⚠️ Esa dirección responde, pero NO es el puente de Vento: en Cloudflare pega otra vez el código del puente (Copiar código del puente) y toca Deploy.'); }
    catch(e){ out.push('❌ El puente no responde: revisa que la dirección esté bien escrita (termina en .workers.dev) y que en Cloudflare tocaste Deploy.'); }
    try{
      const r = await fetch(base + '/api/lounge/pairing/get_screen', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(fake) });
      const t = await r.text();
      out.push(yt(r.status) || r.ok ? '✅ El puente llega a YouTube (YouTube contestó ' + r.status + ').' : '❌ El puente no llega a YouTube (error ' + r.status + (t ? ': ' + t.slice(0, 80) : '') + '). En Cloudflare vuelve a pegar el código del puente y toca Deploy.');
    }catch(e){ out.push('❌ El puente no deja pasar a ORDEVA (bloqueo del navegador). En Cloudflare pega otra vez el código del puente COMPLETO (botón «Copiar código del puente») y toca Deploy.'); }
  } else if(!lngPuenteApp()) out.push('❌ No hay puente configurado (paso 1).');
  if(c.screenId){
    try{ await lngBind(); out.push('✅ El TV «' + (c.nombre || 'TV') + '» contesta' + (lng.tvPlay === true ? ' y está sonando.' : '.')); }
    catch(e){ out.push('❌ El TV vinculado no contesta: ' + (e.message || e) + ' Enciéndelo con YouTube abierto, o vuelve a poner su código.'); }
  } else out.push('ℹ️ Todavía no hay un TV vinculado: pon el código del TV y toca Conectar.');
  out.forEach(x => lngLog('🩺 ' + x));
  return out;
}
// ¿Hay puente? Dentro de la app de Android el puente viene incluido (la app le habla directo a YouTube).
const lngPuenteApp = () => !!(window.VentoAndroid && typeof window.VentoAndroid.lounge === 'function');
const lngHayPuente = () => lngPuenteApp() || !!lngCfg().relay;
function lngFetchApp(path, params, body, token){
  return new Promise((res, rej) => {
    const id = 'l' + Date.now() + Math.random().toString(36).slice(2, 6);
    window.__ventoCbs = window.__ventoCbs || {};
    const tmo = setTimeout(() => { delete window.__ventoCbs[id]; rej(new Error('YouTube no respondió a tiempo (internet lento). Reintento solo.')); }, 20000);
    window.__ventoCbs[id] = d => {
      clearTimeout(tmo);
      const st = Number(d && d.status), t = String((d && d.text) || '');
      if(st < 0){ rej(new Error('Sin conexión con YouTube. Revisa el internet.')); return; }
      if(st >= 400){ const err = new Error('YouTube del TV respondió ' + st + (t ? ': ' + t.slice(0, 120) : '')); err.status = st; rej(err); return; }
      res(t);
    };
    try{ window.VentoAndroid.lounge(id, path, params ? String(new URLSearchParams(params)) : '', String(new URLSearchParams(body || {})), token || ''); }
    catch(e){ clearTimeout(tmo); delete window.__ventoCbs[id]; rej(e); }
  });
}
async function lngFetch(path, params, body, token){
  if(lngPuenteApp()){
    // App de Android: puente incluido. Si esa conexión directa falla (no es una respuesta de YouTube,
    // sino que no hubo conexión), se prueba por el puente configurado, si hay uno.
    try{ return await lngFetchApp(path, params, body, token); }
    catch(e){ if(e.status || !lngCfg().relay) throw e; lngLog('   la app no llegó directo a YouTube: uso el puente'); }
  }
  const c = lngCfg();
  if(!c.relay) throw new Error('Falta la dirección del puente (paso 1).');
  const url = c.relay.replace(/\/+$/, '') + '/api/lounge/' + path + (params ? '?' + new URLSearchParams(params) : '');
  const h = { 'Content-Type': 'application/x-www-form-urlencoded' };
  if(token) h['X-YouTube-LoungeId-Token'] = token;
  // Tiempo límite de 15 s: antes, una llamada que se quedaba colgada (internet lento) dejaba la
  // conexión con el TV «ocupada» para siempre y no volvía a mandar ni revisar nada.
  const ctl = new AbortController(), tmo = setTimeout(() => ctl.abort(), 15000);
  let r, t;
  try{ r = await fetch(url, { method: 'POST', headers: h, body: new URLSearchParams(body || {}), signal: ctl.signal }); t = await r.text(); }
  catch(e){ throw new Error(e && e.name === 'AbortError' ? 'El puente o el TV no respondieron a tiempo (internet lento). Reintento solo.' : 'No hay conexión con el puente. Revisa la dirección del paso 1 y el internet.'); }
  finally{ clearTimeout(tmo); }
  if(!r.ok){ const err = new Error('YouTube del TV respondió ' + r.status + (t ? ': ' + t.slice(0, 120) : '')); err.status = r.status; throw err; }
  return t;
}
const lngExp = v => { v = Number(v) || 0; return v && v < 1e12 ? v * 1000 : v; };
async function lngParear(code){
  let t;
  try{ t = await lngFetch('pairing/get_screen', null, { pairing_code: code }); }
  catch(e){ if(e.status === 404 || e.status === 400) throw new Error('YouTube no reconoce ese código. En el TV vuelve a abrir «Vincular con código de TV» y escribe el código nuevo (cambia cada vez).'); throw e; }
  let j; try{ j = JSON.parse(t); }catch(e){ throw new Error('El código no funcionó. Revisa los 12 números (el código del TV cambia cada vez que lo abres).'); }
  const sc = j && j.screen;
  if(!sc || !sc.screenId) throw new Error('El código no funcionó. Revisa los 12 números.');
  const c = lngCfg();
  Object.assign(c, { screenId: sc.screenId, loungeToken: sc.loungeToken, exp: lngExp(sc.expiration), nombre: sc.name || sc.screenName || 'TV', on: true });
  SS(LNG_KEY, c);
  lngRecordar(sc.screenId, c.nombre);
  lng.sid = null;
}
async function lngToken(){
  const c = lngCfg();
  if(c.loungeToken && (!c.exp || c.exp > Date.now() + 60000)) return c.loungeToken;
  const t = await lngFetch('pairing/get_lounge_token_batch', null, { screen_ids: c.screenId });
  const s0 = (JSON.parse(t).screens || [])[0];
  if(!s0 || !s0.loungeToken) throw new Error('El TV ya no está vinculado. Vuelve a poner el código del TV.');
  c.loungeToken = s0.loungeToken; c.exp = lngExp(s0.expiration); SS(LNG_KEY, c);
  return c.loungeToken;
}
function lngBase(tok){ return { VER: 8, CVER: 1, device: 'REMOTE_CONTROL', id: lngUuid(), name: 'ORDEVA', app: 'web', 'mdx-version': 3, loungeIdToken: tok }; }
async function lngBind(){
  const tok = await lngToken();
  lng.rid = 1; lng.ofs = 0;
  // Mismo saludo que usan hoy los controles remotos de YouTube (los datos van en el cuerpo).
  const t = await lngFetch('bc/bind', { RID: lng.rid++, VER: 8, CVER: 1, auth_failure_option: 'send_error' }, {
    app: 'web', 'mdx-version': 3, name: 'ORDEVA', id: lngUuid(), device: 'REMOTE_CONTROL', capabilities: 'que,dsdtr,atp',
    method: 'setPlaylist', magnaKey: 'cloudPairedDevice', ui: 'false', theme: 'cl', loungeIdToken: tok,
    deviceContext: 'user_agent=dunno&window_width_points=&window_height_points=&os_name=android&ms='
  }, tok);
  const sid = (t.match(/"c"\s*,\s*"([^"]+)"/) || [])[1], gs = (t.match(/"S"\s*,\s*"([^"]+)"/) || [])[1];
  if(!sid) throw new Error('El TV no respondió. Enciéndelo y abre la app de YouTube.');
  lng.sid = sid; lng.gs = gs || ''; lng.t = Date.now(); lng.pantallaFuera = 0; lng.error = '';
  lng.fallas = 0; lng.pausaHasta = 0;   // el TV respondió: se olvidan los errores de antes (no se espera nada)
  lng.tvPlay = lngEstadoTV(t); lngLeerTV(t);
  // Prueba de que el TV DE VERDAD llegó a reproducir. Sin esta prueba no se puede dar por
  // hecho que hay una cola viva: es lo que hacía que la canción entrara como «agregada»
  // a una cola que nunca existió y se quedara callada.
  if(lng.tvPlay === true) SS(LNG_KEY, Object.assign(lngCfg(), { visto: Date.now() }));
  try{ const ev = lngEventos(t); lng.aid = ev.length ? Math.max(...ev.map(x => x[2] || 0)) : 0; }catch(e){ lng.aid = 0; }
  lngLog('saludo al TV: ok · el TV está ' + lngEstadoNombre(lng.tvPlay));
  try{ lngEscuchar(); }catch(e){}
}
/* El TV cuenta en el saludo qué está haciendo ahora mismo (eventos «nowPlaying» /
   «onStateChange»). Códigos de YouTube: -1 sin empezar, 0 terminó, 1 reproduciendo,
   2 en pausa, 3 cargando, 5 en espera. Se mira el ÚLTIMO que venga, que es el más
   reciente. Devuelve true (hay cola sonando), false (no hay nada sonando) o null
   (no se pudo saber). Saberlo es lo que decide entre arrancar la reproducción o
   solo agregar a la cola. */
/* Qué video tiene puesto el TV (evento «nowPlaying»), en qué segundo va y cuánto dura. Con eso
   ORDEVA sabe cuál de sus canciones está sonando, cuándo terminó y si el TV se quedó sin cola.
   tvVid: null = el TV no lo dijo; '' = no tiene nada puesto. */
function lngLeerTV(t){
  let m, np = null, re = /"nowPlaying"\s*,\s*\{([^}]*)\}/g;
  while((m = re.exec(t))) np = m[1];
  const campo = k => { const r = new RegExp('"' + k + '"\\s*:\\s*"?([^",}]*)"?').exec(np || ''); return r ? r[1] : ''; };
  lng.tvVid = np === null ? null : campo('videoId');
  let st = null; re = /"state"\s*:\s*"?(-?\d+)"?/g; while((m = re.exec(t))) st = m[1];
  lng.tvSt = st === null ? null : Number(st);
  let ct = null, du = null;
  re = /"currentTime"\s*:\s*"?([\d.]+)"?/g; while((m = re.exec(t))) ct = Number(m[1]);
  re = /"duration"\s*:\s*"?([\d.]+)"?/g; while((m = re.exec(t))) du = Number(m[1]);
  lng.tvT = ct; lng.tvD = du;
  if((lng.tvSt !== null || lng.tvVid) && !lngCfg().reporta) SS(LNG_KEY, Object.assign(lngCfg(), { reporta: Date.now() }));
  try{ lngLeerMas(t); lngVivoPintar(); }catch(e){}
}
/* Hay TV que NUNCA dicen qué están haciendo (el saludo siempre trae «no se sabe»), ni sonando.
   Con esos no se puede deducir nada del silencio: se confía en que el TV reproduce su cola, como
   hacía ORDEVA antes de la 1.17.1 (y funcionaba). Volver a mandarle la canción cada vez que callaba
   la reiniciaba una y otra vez y no terminaba de cargar nunca. */
const lngReporta = () => !!lngCfg().reporta;
// Canciones que ORDEVA ya le mandó al TV y todavía no han sonado, en el orden en que se mandaron.
function lngEnTV(){ return vm().cola().filter(x => x.lng && x.status === 'tv').sort((a, b) => (a.lngN || a.lngAt || 0) - (b.lngN || b.lngAt || 0)); }
let lngN = 0;
function lngMarcar(x){
  const l = vm().cola(), it = l.find(y => y.id === x.id);
  if(it){ it.lng = true; it.done = true; it.lngAt = Date.now(); it.lngN = Date.now() * 100 + (lngN++ % 100); if(!['playing', 'played', 'skipped', 'cancelled'].includes(it.status)) it.status = 'tv'; SS('vito_cola', l); }
}
/* Pone en el TV una cola nueva con TODAS las canciones que faltan (no solo una): la primera con
   «setPlaylist» y las demás detrás con «addVideo». Son las mismas dos órdenes de siempre, las que
   el TV sí acepta (en 1.17.1 se probó mandar la lista entera en una sola orden y hay TV que no la
   reproducen). Antes solo se mandaba la primera y las demás se perdían. */
async function lngPoner(vids){
  vids = vids.filter((v, i) => v && vids.indexOf(v) === i);
  if(!vids.length) return;
  await lngCmd('setPlaylist', { videoId: vids[0], currentTime: 0, currentIndex: -1, audioOnly: false, listId: '' });
  for(const v of vids.slice(1)) await lngCmd('addVideo', { videoId: v });
}
const lngFaltan = extra => lngEnTV().map(x => x.vid).concat(extra || []);
function lngEstadoTV(t){
  let st = null, m, re = /"state"\s*:\s*"?(-?\d+)"?/g;
  while((m = re.exec(t))) st = m[1];
  if(st === null) return null;
  return st === '1' || st === '2' || st === '3';
}
/* La sesión del TV se cae sola en menos de un minuto si nadie la sostiene (ORDEVA no
   mantiene el canal de vuelta abierto). Por eso, antes de cada canción, se saluda de
   nuevo: sale barato, garantiza que el envío no se pierda y de paso trae el estado real
   del TV. Antes se esperaba 5 minutos y por eso la segunda canción ya no entraba. */
async function lngAsegurar(fresca){
  // Con el canal en vivo abierto (app de Android), el TV ya contó todo al instante y la sesión sigue viva:
  // no se vuelve a saludar (cada saludo abría una sesión nueva).
  if(lng.sid && lngEscVivo()){ lng.t = Date.now(); return; }
  // «vigilar» (revisión periódica en el navegador): como mucho un saludo cada 20 s, para que el TV no vea a ORDEVA
  // conectarse y desconectarse a cada rato.
  if(fresca === 'vigilar'){ if(!lng.sid || Date.now() - lng.t > 20000) await lngBind(); return; }
  if(fresca || !lng.sid || Date.now() - lng.t > 60000) await lngBind();
}
async function lngCmd(sc, datos, reintento){
  await lngAsegurar();
  const tok = await lngToken();
  const ofs = lng.ofs;
  const body = { count: 1, ofs: ofs, req0__sc: sc };
  Object.keys(datos || {}).forEach(k => { body['req0_' + k] = datos[k]; });
  try{
    lngLog('→ ' + sc + (datos && datos.videoId ? ' (' + datos.videoId + ')' : '') + ' ofs=' + ofs);
    await lngFetch('bc/bind', Object.assign({ SID: lng.sid, gsessionid: lng.gs, RID: lng.rid++ }, lngBase(tok)), body, tok);
    // El ofs solo avanza si el envío salió bien: si avanzara igual, quedaría un hueco en la
    // numeración y YouTube rechazaría TODO lo que se mandara después (la canción 2 en adelante).
    lng.ofs = ofs + 1;
    lng.t = Date.now();
    lngLog('   el TV aceptó ' + sc);
  }catch(e){
    lngLog('   ⚠️ ' + sc + ' falló: ' + (e.status ? 'error ' + e.status + ' · ' : '') + (e.message || e));
    if(!reintento && e.status && e.status >= 400 && e.status < 500){
      // Sesión vencida o permiso viejo: se abre otra y se vuelve a intentar.
      lng.sid = null;
      if(e.status === 401 || e.status === 403){ const c = lngCfg(); delete c.loungeToken; delete c.exp; SS(LNG_KEY, c); }
      await lngAsegurar(true);
      // Si el TV quedó sin nada sonando, «agregar» no se oiría: se arranca la reproducción.
      // (Las que falten detrás las repone la revisión del TV al ver que se queda sin la siguiente.)
      if(sc === 'addVideo' && lng.tvPlay === false){ const vids = lngFaltan([datos.videoId]); return lngCmd('setPlaylist', { videoId: vids[0], currentTime: 0, currentIndex: -1, audioOnly: false, listId: '' }, true); }
      return lngCmd(sc, datos, true);
    }
    throw e;
  }
}
/* No basta con mandar el comando: hay que comprobar que el TV de verdad se puso a sonar.
   Si quedó detenido («video agregado» y nada más), se le dan las órdenes que daría una
   persona con el control: primero «play»; si sigue quieto, «next» (reproducir a
   continuación); y si ni así, se le pone la canción directa. Así no depende de haberle
   acertado al comando la primera vez. */
async function lngArrancar(videoId, encolada){
  /* Después de mandar se comprueba que el TV de verdad suene. Un TV que está sonando lo dice en el
     saludo (estado 1/2/3); si dice «detenido» o NO dice nada, es que no arrancó: antes, con «no se
     sabe», se dejaba así y el TV se quedaba callado para siempre.
       1) «play» (no hace daño si ya sonaba);
       2) si sigue sin sonar, se le vuelve a poner la cola que falta (una vez);
       3) si ni así, queda escrito en el registro y en el estado qué revisar en el TV. */
  for(let i = 0; i < 2; i++){
    await new Promise(r => setTimeout(r, 3000));
    try{ await lngAsegurar(true); }catch(e){ lngLog('   no pude comprobar el TV: ' + (e.message || e)); return; }
    if(lng.tvPlay === true){ lngOk(); return; }
    if(!lngReporta() && lng.tvPlay === null){
      if(i === 0){ lngLog('   este TV no informa su estado → «play» por si acaso y se deja sonar'); try{ await lngCmd('play', {}); }catch(e){} }
      return;
    }
    const paso = i === 0 ? 'play' : 'setPlaylist';
    lngLog('   el TV ' + (lng.tvPlay === false ? 'sigue detenido' : 'no dice que esté sonando') + ' → ' + (paso === 'play' ? 'play' : 'le vuelvo a poner la cola'));
    try{ if(paso === 'play') await lngCmd('play', {}); else await lngPoner(lngFaltan(videoId ? [videoId] : [])); }
    catch(e){ lngLog('   ⚠️ ' + paso + ' falló: ' + (e.message || e)); return; }
  }
  await new Promise(r => setTimeout(r, 3500));
  try{
    await lngAsegurar(true);
    if(lng.tvPlay === true){ lngOk(); return; }
    lngLog('   ❌ el TV recibió las canciones pero no se puso a sonar (quedó: ' + lngEstadoNombre(lng.tvPlay) + ')');
    lng.error = 'El TV recibe las canciones pero no las reproduce. En el TV abre la app de YouTube y déjala en su pantalla de inicio (no en un video ni en el protector de pantalla), y toca ▶ en ORDEVA. Si sigue igual, vuelve a vincular con el código del TV.';
  }catch(e){}
}
function lngOk(){ lngLog('   ✅ el TV está sonando'); lng.reinicios = 0; lng.error = ''; SS(LNG_KEY, Object.assign(lngCfg(), { visto: Date.now() })); }
// Manda al TV, en orden justo, las canciones que ya tienen video y aún no se mandaron.
async function lngSync(forzar){
  // El «arranca ya» (al conectar el TV o al tocar ▶) se guarda, no se gasta: cuando se pide,
  // la canción todavía no tiene video buscado y la lista de pendientes está vacía, así que
  // antes se perdía y la primera canción terminaba entrando solo como «agregada».
  if(forzar) lng.forzar = true;
  if(!lngOn() || !vm().cola) return;
  if(!lngTomar(forzar)) return;
  try{
    const c = lngCfg();
    let forzarInicio = lng.forzar;
    const pend = vm().ordenJusto(vm().cola()).filter(x => x.vid && !x.lng);
    if(!pend.length && forzarInicio && (lngEnTV().length || (lng.porPersona && vm().cola().some(y => y.status === 'playing' && y.fuente === 'tvyt')))){
      // «▶» con canciones ya mandadas que el TV no está sonando: se le vuelven a poner.
      lng.forzar = false; lng.reinicios = 0;
      await lngAsegurar(true);
      const aMano = !!lng.porPersona; lng.porPersona = false;
      if(!aMano && !lngReporta() && Date.now() < lngOcupadoHasta()){ lngLog('según el tiempo todavía suena una canción de ORDEVA → no se corta'); try{ await lngCmd('play', {}); }catch(e){} }
      else if(aMano || lng.tvPlay !== true){
        // ▶ a mano: se vuelve a poner desde la que «sonaba» (si el TV no la tenía, ahora sí suena).
        const suenaV = vm().cola().find(y => y.status === 'playing' && y.fuente === 'tvyt');
        const vids = (suenaV ? [suenaV.vid] : []).concat(lngFaltan());
        lngLog('▶ arrancar: le pongo al TV la cola que falta (' + vids.length + ')');
        await lngPoner(vids); lng.ultimoEnvio = Date.now();
        await lngArrancar(vids[0], false);
      } else lngOk();
    }
    if(pend.length){
      await lngAsegurar(true);
      /* Recién mandada una canción, el TV puede reportar «cargando» por unos segundos: ahí no
         hay que creerle que está quieto, o se cortaría lo que acaba de arrancar.
         Si el TV NO dice qué está haciendo, solo se encola si hay prueba de que llegó a
         reproducir (lo dijo él, o le pusimos una cola que todavía no debe haber terminado).
         Y si el TV tiene puesta una canción de ORDEVA, hay cola viva: se agrega al final. */
      const arrancando = !!lng.ultimoEnvio && Date.now() - lng.ultimoEnvio < 20000;
      const deVento = !!lng.tvVid && vm().cola().some(y => y.lng && y.vid === lng.tvVid && ['tv', 'playing'].includes(y.status));
      const probado = lng.tvPlay === true || deVento || ((c.visto || c.arranco) && c.hasta && Date.now() < c.hasta);
      // TV que no informa: manda el reloj de ORDEVA. Mientras, según la duración real, siga sonando una
      // canción de ORDEVA (o haya mandadas esperando), la nueva SOLO se agrega al final: nunca se corta
      // la que suena. Se dejan 30 s de margen por si el TV tardó en cargar.
      const relojOcupado = !lngReporta() && Date.now() < lngOcupadoHasta() + 30000;
      const quedaCola = arrancando || relojOcupado || (lng.tvPlay === false ? false : probado);
      // «Arrancar ya» (al reconectar el TV solo o tocar ▶) no corta una canción de ORDEVA que ya suena.
      const porPersona = !!lng.porPersona; lng.porPersona = false;   // ▶ tocado a mano: arrancar sí o sí
      const nuevaCola = porPersona || (forzarInicio && !(deVento && lng.tvPlay === true) && !relojOcupado) || !quedaCola;
      lng.forzar = false;
      if(nuevaCola){
        // El TV está quieto: se le pone la cola completa — las que ya se le habían mandado y no
        // alcanzaron a sonar, más las nuevas — para que al acabar una siga sola con la siguiente.
        const vids = lngFaltan(pend.map(x => x.vid));
        lngLog('TV ' + lngEstadoNombre(lng.tvPlay) + ' → arrancar cola de ' + vids.length + (vids.length === 1 ? ' canción' : ' canciones'));
        await lngPoner(vids);
        c.arranco = Date.now(); SS(LNG_KEY, Object.assign(lngCfg(), { arranco: c.arranco, cursor: c.arranco }));
        // La que «sonaba» según ORDEVA quedó reemplazada por esta cola nueva.
        try{ vm().cola().filter(y => y.status === 'playing' && y.fuente === 'tvyt').forEach(y => vm().mzTermino(y.id, 'played')); }catch(e){}
        pend.forEach(lngMarcar);
        forzarInicio = false; lng.forzar = false; lng.ultimoEnvio = Date.now();
        await lngArrancar(pend[0].vid, false);
      } else {
        for(const x of pend){
          lngLog('«' + String(x.song || '').slice(0, 40) + '» · TV ' + lngEstadoNombre(lng.tvPlay) + ' → encolar al final');
          await lngCmd('addVideo', { videoId: x.vid });
          lngMarcar(x); lng.ultimoEnvio = Date.now();
        }
        await lngArrancar(pend[pend.length - 1].vid, true);
      }
      // Hasta cuándo se calcula que al TV le queda música de ORDEVA por sonar (duración REAL de
      // cada video; si no se sabe, unos 4 minutos).
      const durMs = x => x.dur ? x.dur * 1000 : LNG_CANCION_MS;
      const base = nuevaCola ? Date.now() : Math.max(c.hasta || 0, Date.now());
      c.hasta = Math.max(base + (nuevaCola ? lngEnTV() : pend).reduce((t, x) => t + durMs(x), 0), lngOcupadoHasta()); c.ultimo = Date.now();
      SS(LNG_KEY, Object.assign(lngCfg(), { hasta: c.hasta, ultimo: c.ultimo, arranco: c.arranco }));
    }
    lng.error = ''; lngResultado(true);
  }catch(e){ lng.error = e.message || String(e); lngResultado(false); }
  finally{ lng.ocupado = false; lngEstado(); try{ vm().renderMusica(); }catch(e){} }
}
/* El YouTube del TV como reproductor de ORDEVA: cada 12 s (solo mientras haya canciones de ORDEVA
   en el TV) se mira qué tiene puesto. Así ORDEVA sabe cuál está sonando (y la muestra en «Sonando»
   con su tiempo real), cuándo terminó (va al historial) y, sobre todo, si el TV se quedó sin la
   siguiente (se acabó su cola o se fue a un video recomendado): ahí le pone la cola que falta.
   Antes se mandaban y se daban por terminadas al instante: desaparecían de la cola de ORDEVA y,
   si el TV no las tenía, nadie se daba cuenta y la música se detenía. */
async function lngVigilar(){
  if(!lngOn() || !vm().cola) return;
  const enTV = lngEnTV(), suena = vm().cola().find(x => x.status === 'playing' && x.fuente === 'tvyt');
  if(!enTV.length && !suena) return;
  // TV que no informa: no se le reenvía nada; se sigue por tiempo (y se saluda solo cada minuto, por si empieza a informar).
  if(!lngReporta() && lng.sid && Date.now() - lng.t < 60000){ lngPorTiempo(enTV); return; }
  if(!lngTomar(false)) return;
  try{
    await lngAsegurar(true);
    const vid = lng.tvVid, st = lng.tvSt, reciente = Date.now() - (lng.ultimoEnvio || 0) < 25000;
    lngResultado(true);
    if(!lngReporta()){ lngPorTiempo(lngEnTV()); return; }
    // Canciones mandadas hace más de 3 h (el TV se apagó, cerraron ORDEVA…): no se reponen.
    enTV.filter(x => Date.now() - (x.lngAt || 0) > 3 * 36e5).forEach(x => vm().mzTermino(x.id, 'skipped'));
    if(lng.tvPlay === true) lng.reinicios = 0;
    if(vid === null && st === null){
      /* El TV no dice qué hace: un TV que está sonando sí lo dice, así que lo normal es que no
         tenga nada puesto. Antes aquí no se hacía nada y las canciones se quedaban esperando
         para siempre. Solo se espera si a esta cola ya se le vio sonar y todavía no debe acabar. */
      const c = lngCfg();
      if(c.visto && c.visto > (c.arranco || 0) && c.hasta && Date.now() < c.hasta) return;
      if(suena) vm().mzTermino(suena.id, 'played');
    }
    else {
    const it = vid ? enTV.concat(suena ? [suena] : []).find(x => x.vid === vid) : null;
    if(it){
      if(st === 0){                                               // esa canción terminó
        vm().mzTermino(it.id, 'played', lng.tvD || lng.tvT || null);
      } else {
        if(it.status !== 'playing' && st !== -1 && st !== 5){
          // Las que se mandaron antes que ésta y nunca sonaron: el TV las pasó (no se dejaron reproducir).
          enTV.filter(x => x.id !== it.id && (x.lngN || 0) < (it.lngN || 0)).forEach(x => vm().mzTermino(x.id, 'skipped'));
          // La que sonaba antes: el TV pasó solo a la siguiente de su cola, o sea que terminó.
          if(suena && suena.id !== it.id) vm().mzTermino(suena.id, 'played', suena.dur || null);
          const e = vm().mzEmpezo(it.id, 'tvyt'); if(e) SS('vito_now', e);
          lngLog('▶ en el TV suena «' + String(it.title || it.song || '').slice(0, 40) + '»');
        }
        if(lng.tvT != null && st === 1) vm().mzProgreso(it.id, lng.tvT, lng.tvD || 0);
        if((st === -1 || st === 5) && !reciente){ lngLog('   el TV tiene la canción quieta → play'); await lngCmd('play', {}); }
        return;
      }
    } else if(suena && (st === 0 || st === -1 || st === 5 || vid === '' || !!vid)){
      // Sonaba una de ORDEVA y el TV ya no la tiene: terminó (o se fue a un recomendado).
      const acabo = lng.terminoVid && lng.terminoVid === suena.vid;
      vm().mzTermino(suena.id, acabo || !(suena.dur && (suena.playedSeconds || 0) < suena.dur * 0.8 && st !== 0) ? 'played' : 'skipped', acabo && lng.terminoT ? lng.terminoT : undefined);
      if(acabo) lng.terminoVid = null;
    }
    if(st === 1 && vid && !it && !suena) return;                  // está sonando algo que puso otra persona: no se corta
    }
    if(st === 2 || st === 3 || reciente) return;                  // en pausa, cargando o recién mandado: se espera
    const falta = lngEnTV();
    if(!falta.length) return;
    // Máximo 3 intentos seguidos sin que el TV suene: después se avisa en vez de insistir
    // (se reintenta al tocar ▶ o cuando el TV vuelva a sonar).
    if((lng.reinicios || 0) >= 3){ if(!lng.avisoReinicio){ lng.avisoReinicio = true; lngLog('   ❌ el TV no se pone a sonar después de 3 intentos; toca ▶ para reintentar'); } return; }
    lng.reinicios = (lng.reinicios || 0) + 1; lng.avisoReinicio = false;
    lngLog('el TV ' + (vid === null && st === null ? 'no tiene nada puesto' : 'se quedó sin la siguiente') + ' → le pongo la cola que falta (' + falta.length + ')');
    await lngPoner(falta.map(x => x.vid)); lng.ultimoEnvio = Date.now();
    SS(LNG_KEY, Object.assign(lngCfg(), { arranco: Date.now(), cursor: Date.now() }));
    await lngArrancar(falta[0].vid, false);
    SS(LNG_KEY, Object.assign(lngCfg(), { arranco: Date.now(), hasta: Date.now() + falta.reduce((t, x) => t + (x.dur ? x.dur * 1000 : LNG_CANCION_MS), 0) }));
  }catch(e){ lngLog('   ⚠️ revisando el TV: ' + (e.message || e)); lngResultado(false); }
  finally{ lng.ocupado = false; try{ vm().renderMusica(); }catch(e){} }
}
/* TV que no informa su estado: se sigue la cola por la duración REAL de cada video. La que según el
   tiempo está sonando se muestra en «Sonando» y la que ya debió terminar pasa al historial. */
/* TV nuevo (se puso el código otra vez, otro Chromecast, o se desconectó): lo que se le había mandado
   al TV anterior ya no existe. Las canciones que esperaban vuelven a la cola para mandarse a ESTE TV y el
   reloj empieza de cero. Antes se quedaba el reloj viejo: ORDEVA creía que el TV ya estaba sonando, solo
   «agregaba» a una cola que no existía y no sonaba nada. */
function lngReloj0(motivo){
  try{
    const m = vm(), l = m.cola ? m.cola() : []; let n = 0;
    l.forEach(x => {
      if(x.lng && x.status === 'tv'){ x.lng = false; x.done = false; x.status = x.ok ? 'approved' : 'pending'; delete x.lngAt; delete x.lngN; n++; }
      // Las que se pidieron antes de conectar el TV y se fueron a la lista de YouTube (sin sonar): van al TV.
      else if(x.status === 'lista' && x.vid && Date.now() - (x.ytAt || x.ts || 0) < 3 * 36e5){ x.done = false; x.status = x.ok ? 'approved' : 'pending'; n++; }
    });
    if(n) SS('vito_cola', l);
    l.filter(x => x.status === 'playing' && x.fuente === 'tvyt').forEach(x => m.mzTermino(x.id, 'played'));
    const c = lngCfg(); ['arranco', 'cursor', 'hasta', 'visto', 'reporta', 'ultimo'].forEach(k => delete c[k]); SS(LNG_KEY, c);
    lng.ultimoEnvio = 0; lng.reinicios = 0; lng.tvPlay = null; lng.tvVid = null; lng.tvSt = null;
    lngLog('TV nuevo (' + motivo + '): reloj en cero' + (n ? ', ' + n + ' canciones vuelven a la cola para este TV' : ''));
  }catch(e){}
}
// Hasta cuándo, según la duración real, le queda música de ORDEVA al TV: la que suena + las que esperan.
function lngOcupadoHasta(){
  const c = lngCfg(), m = vm(); if(!m.cola) return 0;
  const suena = m.cola().find(x => x.status === 'playing' && x.fuente === 'tvyt');
  let t = suena && suena.startedAt ? suena.startedAt : (c.cursor || c.arranco || 0);
  if(!t) return 0;
  (suena ? [suena] : []).concat(lngEnTV().filter(x => !suena || x.id !== suena.id)).forEach(x => { t += (x.dur ? x.dur * 1000 : LNG_CANCION_MS) + 3000; });
  return t;
}
function lngPorTiempo(enTV){
  const c = lngCfg(), ahora = Date.now(), m = vm();
  const suena = m.cola().find(x => x.status === 'playing' && x.fuente === 'tvyt');
  // Desde cuándo empieza la siguiente: lo que sonaba, o el «cursor» (fin de la última), o el arranque de la cola.
  let t = suena && suena.startedAt ? suena.startedAt : (c.cursor || c.arranco || 0);
  if(!t) return;
  const orden = (suena ? [suena] : []).concat(enTV.filter(x => !suena || x.id !== suena.id));
  for(const x of orden){
    const dur = (x.dur ? x.dur * 1000 : LNG_CANCION_MS) + 3000;   // +3 s: lo que tarda el TV en cargar cada una
    if(ahora >= t + dur){ m.mzTermino(x.id, 'played', x.dur || null); t += dur; continue; }
    if(x.status !== 'playing'){
      m.mzEmpezo(x.id, 'tvyt');
      const l = m.cola(), it = l.find(y => y.id === x.id); if(it){ it.startedAt = Math.min(t, ahora); SS('vito_cola', l); SS('vito_now', it); }
    }
    break;
  }
  SS(LNG_KEY, Object.assign(lngCfg(), { cursor: t }));
  try{ m.renderMusica(); }catch(e){}
}
/* Latido de la app de Android: con la app cerrada, el servicio de fondo despierta a ORDEVA cada 5 s
   (Android frena los relojes de una página que no se ve). Se manda lo pendiente al TV y se revisa
   qué suena, igual que con la app abierta. */
let latidoN = 0;
window.ventoLatido = () => {
  latidoN++;
  try{ if(lngOn()) lngSync(); }catch(e){}
  try{ if(lngOn() && latidoN % 3 === 0) lngVigilar(); }catch(e){}
  try{ if(vm().tvOn && vm().tvOn() && latidoN % 4 === 0 && typeof tvPublicar === 'function') tvPublicar(); }catch(e){}
  try{ if(latidoN % 3 === 0 && window.vitoDespertarPedidos) window.vitoDespertarPedidos(); }catch(e){}
  try{ if(window.vitoMusicaLatido) window.vitoMusicaLatido(); }catch(e){}   // música del reproductor de la app con ORDEVA minimizada
  try{ if(window.ventoPagosLatido) window.ventoPagosLatido(); }catch(e){}   // pagos de los otros equipos y reenvíos pendientes
};
// «Saltar» en ORDEVA cuando suena en el YouTube del TV: el TV pasa a la siguiente de su cola.
function lngSaltar(){ if(lngOn()) lngCmd('next', {}).then(() => { lng.ultimoEnvio = Date.now(); }).catch(e => lngLog('   ⚠️ saltar: ' + (e.message || e))); }
/* ---------- Canal en vivo con el TV (app de Android) ----------
   La app deja abierto el canal de vuelta del «YouTube del TV», como la app de YouTube: el TV cuenta al instante
   qué suena, si pausó, si pasó a la siguiente o si cambió la lista. Sin la app (navegador) se sigue preguntando
   cada pocos segundos, como antes. */
// APAGADO (v1.26.4): el canal en vivo nunca se pudo probar contra el YouTube real; si YouTube lo rechaza, ORDEVA
// entraba en un ciclo de reconectar cada 2 s y las canciones no llegaban al TV. Se vuelve al sistema de la 1.22
// (el que funcionaba): saludar y revisar cada pocos segundos. Solo se usa si alguien lo prende a propósito.
const lngEscOk = () => window.__ventoEnVivo === true && lngPuenteApp() && typeof window.VentoAndroid.escucharTV === 'function';
// El canal está vivo mientras esté abierto (si se cae, la app avisa con __ventoTVcerro). Antes se daba por muerto si el TV
// pasaba 100 s sin decir nada (p. ej. sonando una canción larga): ORDEVA abría otra sesión y el TV veía que ORDEVA se
// desconectaba y se volvía a conectar todo el tiempo.
const lngEscVivo = () => !!(lng.escId && lng.escSid === lng.sid);
async function lngEscuchar(){
  if(!lngEscOk() || !lngOn() || !lng.sid) return;
  if(lng.escId && lng.escSid === lng.sid) return;               // ya escuchando esta sesión
  let tok; try{ tok = await lngToken(); }catch(e){ return; }
  const id = 'e' + Date.now().toString(36);
  lng.escId = id; lng.escSid = lng.sid; lng.escUlt = Date.now(); lng.escBuf = '';
  const q = Object.assign({ SID: lng.sid, gsessionid: lng.gs, RID: 'rpc', CI: 0, AID: lng.aid || 0, TYPE: 'xmlhttp' }, lngBase(tok));
  try{ window.VentoAndroid.escucharTV(id, String(new URLSearchParams(q)), tok); lngLog('📡 escuchando al TV en vivo'); }
  catch(e){ lng.escId = null; }
}
function lngEscParar(){ try{ if(lng.escId && lngEscOk()) window.VentoAndroid.pararTV(lng.escId); }catch(e){} lng.escId = null; }
let lngEscVig = null;
window.__ventoTVev = (id, txt) => {
  if(id !== lng.escId) return;
  lng.escUlt = Date.now(); lngEscFallas = 0;
  lng.escBuf = (lng.escBuf || '') + String(txt || '');
  if(lng.escBuf.length > 400000) lng.escBuf = lng.escBuf.slice(-200000);
  const r = {}, ev = lngEventos(lng.escBuf, r);
  lng.escBuf = lng.escBuf.slice(r.i || 0);
  if(!ev.length) return;
  const antes = lng.tvVid + '|' + lng.tvSt;
  ev.forEach(([n, d, k]) => {
    if(k > (lng.aid || 0)) lng.aid = k;
    if(n === 'nowPlaying'){
      lng.tvVid = d && d.videoId ? String(d.videoId) : '';
      if(d && d.state != null && d.state !== '') lng.tvSt = Number(d.state); else if(!lng.tvVid) lng.tvSt = null;
      lng.tvT = d && d.currentTime != null && d.currentTime !== '' ? Number(d.currentTime) : (lng.tvVid ? lng.tvT : null);
      lng.tvD = d && d.duration != null && d.duration !== '' ? Number(d.duration) : (lng.tvVid ? lng.tvD : null);
    } else if(n === 'onStateChange'){
      // «Terminó» se guarda: si en el mismo trozo ya viene la siguiente, la que acabó cuenta como sonada (no saltada).
      if(String(d.state) === '0' && lng.tvVid){ lng.terminoVid = lng.tvVid; lng.terminoT = d.currentTime != null && d.currentTime !== '' ? Number(d.currentTime) : null; }
      if(d.state != null && d.state !== '') lng.tvSt = Number(d.state);
      if(d.currentTime != null && d.currentTime !== '') lng.tvT = Number(d.currentTime);
      if(d.duration != null && d.duration !== '') lng.tvD = Number(d.duration);
    } else if(n === 'loungeScreenDisconnected'){ lng.pantallaFuera = Date.now(); lngLog('📴 el TV se desconectó (apagado o cerró YouTube)'); }
    else if(n === 'loungeScreenConnected' || n === 'loungeStatus'){ if(n === 'loungeScreenConnected' || (d && d.devices && /SCREEN/.test(String(d.devices)))) lng.pantallaFuera = 0; }
  });
  // el resto (aparatos conectados, lista del TV) con el mismo lector del saludo
  try{ lngLeerMas(JSON.stringify(ev.map(([n, d, k]) => [k, [n, d]]))); }catch(e){}
  lng.tvAt = Date.now();
  if(lng.tvSt != null) lng.tvPlay = lng.tvSt === 1 || lng.tvSt === 2 || lng.tvSt === 3;
  if((lng.tvSt !== null || lng.tvVid) && !lngCfg().reporta) SS(LNG_KEY, Object.assign(lngCfg(), { reporta: Date.now() }));
  try{ lngVivoPintar(); }catch(e){}
  // Cambió la canción o su estado: ORDEVA pone al día su cola (sonando / terminada / siguiente) enseguida.
  if(lng.tvVid + '|' + lng.tvSt !== antes){ clearTimeout(lngEscVig); lngEscVig = setTimeout(() => { try{ lngVigilar(); }catch(e){} }, 700); }
};
let lngEscFallas = 0;
window.__ventoTVcerro = (id, st) => {
  if(id !== lng.escId) return;
  lng.escId = null;
  if(!lngOn()) return;
  // YouTube rechazó el canal en vivo: se deja de usar (sin tumbar la conexión) y se sigue con el sistema de siempre.
  if(st >= 400 && st < 500){ window.__ventoEnVivo = false; lngLog('   el canal en vivo no está disponible: sigo con el sistema de siempre'); return; }
  else lngEscFallas++;
  setTimeout(lngEscReintentar, Math.min(30000, 1500 * Math.pow(2, Math.min(lngEscFallas, 4))));
};
async function lngEscReintentar(){
  if(!lngOn() || lng.escId) return;
  if(lng.sid) return lngEscuchar();
  if(!lngTomar(true)){ setTimeout(lngEscReintentar, 3000); return; }     // otro trabajo con el TV en curso: se espera
  try{ await lngBind(); }catch(e){ lngEscFallas++; setTimeout(lngEscReintentar, Math.min(30000, 3000 * lngEscFallas)); }
  finally{ lng.ocupado = false; }
}
/* ---------- En vivo en el TV ----------
   Lo que cuenta el TV en cada saludo, además de qué suena: los aparatos conectados a él (el TV mismo,
   el celular que le transmite desde YouTube / YouTube Music, otros controles) y, si el TV la comparte,
   la lista que tiene en cola. Con eso ORDEVA muestra en vivo el aparato que está sonando, la canción
   (aunque la haya puesto otro celular con su cuenta de Google), su tiempo y lo que sigue, y deja
   agregar canciones a esa misma cola. */
// La respuesta del TV viene en trozos «largo + [[n,["evento",{datos}]],…]»: se leen todos los eventos.
function lngEventos(t, resto){
  const s = String(t || ''), out = []; let i = 0, hasta = 0;
  while(i < s.length){
    const a = s.indexOf('[', i); if(a < 0) break;
    let d = 0, str = false, esc = false, j = a;
    for(; j < s.length; j++){
      const ch = s[j];
      if(str){ if(esc) esc = false; else if(ch === '\\') esc = true; else if(ch === '"') str = false; continue; }
      if(ch === '"') str = true; else if(ch === '[') d++; else if(ch === ']'){ d--; if(!d) break; }
    }
    if(d) break;
    try{ const arr = JSON.parse(s.slice(a, j + 1)); if(Array.isArray(arr)) arr.forEach(e => { if(Array.isArray(e) && Array.isArray(e[1]) && typeof e[1][0] === 'string') out.push([e[1][0], e[1][1] || {}, Number(e[0])]); }); }catch(e){}
    i = j + 1; hasta = i;
  }
  if(resto) resto.i = hasta;
  return out;
}
const lngJSON = v => { if(v && typeof v === 'object') return v; try{ return JSON.parse(v); }catch(e){ return null; } };
function lngLeerMas(t){
  const ev = lngEventos(t);
  ev.forEach(([n, d]) => {
    if(!d || typeof d !== 'object') return;
    if(n === 'loungeStatus' && d.devices != null){
      const ds = lngJSON(d.devices);
      if(Array.isArray(ds)) lng.disp = ds.filter(x => x && x.id !== lngUuid()).map(x => {
        const inf = lngJSON(x.deviceInfo) || {};
        return { id: x.id || '', nombre: x.name || '', tipo: x.type || '', app: x.app || '', marca: inf.brand || '', modelo: inf.model || '' };
      });
    }
    if(typeof d.videoIds === 'string' && d.videoIds){ lng.tvLista = d.videoIds.split(',').filter(Boolean); }
    if((n === 'nowPlaying' || n === 'playlistModified') && d.currentIndex != null && d.currentIndex !== '') lng.tvIdx = Number(d.currentIndex);
    if((n === 'nowPlaying' || n === 'playlistModified') && d.listId) lng.tvListId = d.listId;
  });
  lng.tvAt = Date.now();
}
// Título, canal y duración de un video: primero de las canciones de ORDEVA; si no, de YouTube.
const lngInfo = {};
function lngInfoVideo(vid){
  if(!vid) return null;
  if(lngInfo[vid]) return lngInfo[vid];
  const m = vm(), propias = (m.cola ? m.cola() : []).concat(window.vitoMusica && window.vitoMusica.hist ? window.vitoMusica.hist() : []);
  const p = propias.find(x => x.vid === vid && (x.title || x.song));
  if(p){ lngInfo[vid] = { t: p.title || p.song, c: p.artist || '', dur: p.dur || p.duration || 0, mesa: p.mesa }; return lngInfo[vid]; }
  lngInfo[vid] = { t: '', c: '', cargando: true };
  (async () => {
    let r = null;
    try{
      if(m.yGet && m.yCfg && (m.yCfg().key || (m.yTok && m.yTok()))){
        const j = await m.yGet('videos?part=snippet,contentDetails&id=' + encodeURIComponent(vid));
        const it = j && j.items && j.items[0];
        if(it) r = { t: it.snippet.title, c: it.snippet.channelTitle || '', dur: m.ytDur ? m.ytDur(it.contentDetails && it.contentDetails.duration) : 0 };
      }
    }catch(e){}
    if(!r){
      try{ const x = await fetch('https://noembed.com/embed?url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + vid)); const j = await x.json(); if(j && j.title) r = { t: j.title, c: j.author_name || '' }; }catch(e){}
    }
    lngInfo[vid] = r || { t: '', c: '' };
    lngVivoPintar();
  })();
  return lngInfo[vid];
}
const lngMini = vid => 'https://i.ytimg.com/vi/' + encodeURIComponent(vid) + '/mqdefault.jpg';
// Segundo en que va el TV ahora mismo (lo que dijo + lo que ha pasado desde que lo dijo, si está sonando).
function lngTiempoAhora(){
  if(lng.tvT == null) return null;
  let t = lng.tvT; if(lng.tvSt === 1 && lng.tvAt) t += (Date.now() - lng.tvAt) / 1000;
  return lng.tvD ? Math.min(t, lng.tvD) : t;
}
const lngNombreEstado = st => ({ 1: '▶ Sonando', 2: '⏸ En pausa', 3: '⏳ Cargando', 0: '⏹ Terminó', '-1': '⏹ Sin empezar', 5: '⏹ En espera' }[st] || '');
const lngMmss = s => { s = Math.max(0, Math.round(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
function lngVivoPintar(){
  const box = document.getElementById('tvVivo'), mini = document.getElementById('mzTvAhora');
  if(!box) return;
  if(!lngOn()){ box.hidden = true; if(mini) mini.hidden = true; try{ tvDisposPintar(); }catch(e){} return; }
  box.hidden = false;
  const c = lngCfg(), m = vm(), vid = lng.tvVid;
  const hace = lng.tvAt ? Math.round((Date.now() - lng.tvAt) / 1000) : null;
  document.getElementById('tvvAct').textContent = hace == null ? 'conectando…' : hace < 5 ? 'actualizado ahora' : 'hace ' + hace + ' s';
  // Aparatos: el TV (el que suena) y los demás conectados a él, como los muestra YouTube.
  const disp = lng.disp || [], pant = disp.find(x => /SCREEN/i.test(x.tipo));
  const nomTV = pant && (pant.marca || pant.modelo) ? '[' + (pant.marca || 'TV') + '] ' + (pant.modelo || pant.nombre) : (c.nombre || (pant && pant.nombre) || 'TV');
  const suena = lng.tvSt === 1 || lng.tvSt === 3;
  const otroNom = [pant && pant.nombre, c.nombre].filter(x => x && x !== nomTV)[0] || '';
  let h = '';
  disp.filter(x => !/SCREEN/i.test(x.tipo)).forEach(x => {
    const app = /music/i.test(x.app) ? 'YouTube Music' : /youtube|android|ios|web|m?web/i.test(x.app) ? 'YouTube' : '';
    h += '<div class="tvv-dev">📱<div><b>' + tvEsc(x.nombre || 'Otro control') + '</b><small>Conectado a «' + tvEsc(nomTV) + '»' + (app ? ' · ' + app : '') + '</small></div></div>';
  });
  lng.nomTV = nomTV; lng.otroNom = otroNom; lng.suena = suena;
  try{ tvDisposPintar(); }catch(e){}
  document.getElementById('tvvDisp').innerHTML = h;
  // Lo que suena.
  const ahora = document.getElementById('tvvAhora');
  const propia = m.cola ? m.cola().find(x => x.status === 'playing' && x.fuente === 'tvyt') : null;
  const v = vid || (propia && propia.vid) || '';
  let titulo = '';
  if(v){
    const inf = lngInfoVideo(v) || {}, dur = lng.tvD || inf.dur || (propia && propia.dur) || 0;
    let t = vid ? lngTiempoAhora() : (propia && propia.startedAt ? (Date.now() - propia.startedAt) / 1000 : null);
    if(t != null && dur) t = Math.min(t, dur);
    const de = propia && propia.vid === v ? ' · pedida por ' + tableLabel(propia.mesa) : !vid ? '' : (m.cola && m.cola().some(x => x.vid === v) ? '' : ' · puesta desde otro celular');
    titulo = inf.t || (propia && propia.vid === v ? propia.title || propia.song : '') || (inf.cargando ? 'Buscando el nombre…' : 'Video ' + v);
    const pct = dur && t != null ? Math.min(100, t / dur * 100) : 0;
    const key = v + '|' + titulo + '|' + (inf.c || '') + '|' + de + '|' + lng.tvSt;
    if(ahora.dataset.k !== key){
      ahora.dataset.k = key;
      ahora.innerHTML = '<div class="tvv-now"><img alt="" loading="lazy" src="' + lngMini(v) + '"><div class="tvv-tt"><b>' + tvEsc(titulo) + '</b><small>' + tvEsc((inf.c || '') + de) + '</small>' +
        '<div class="mzs-bar"><i id="tvvBar" style="width:' + pct.toFixed(1) + '%"></i></div><div class="mzs-time" id="tvvTiempo"></div></div></div>';
    }
    const bar = document.getElementById('tvvBar'); if(bar) bar.style.width = pct.toFixed(1) + '%';
    const tt = document.getElementById('tvvTiempo');
    if(tt) tt.textContent = (lngNombreEstado(lng.tvSt) || (vid ? '' : '▶ Según el tiempo de ORDEVA')) + (t != null ? ' · ' + lngMmss(t) + ' / ' + (dur ? lngMmss(dur) : '--:--') : '');
  } else {
    if(ahora.dataset.k !== '-'){ ahora.dataset.k = '-'; ahora.innerHTML = '<div class="settings-desc">' + (lng.tvAt ? 'El TV no tiene nada sonando ahora. Las canciones que pidan las mesas (o las que agregues abajo) arrancan solas.' : 'Preguntándole al TV qué está sonando…') + '</div>'; }
  }
  const bp = document.getElementById('tvvPausa'); if(bp) bp.textContent = lng.tvSt === 2 ? '▶ Seguir' : '⏸ Pausa';
  // Lo que sigue: la lista del TV (si la comparte) o, si no, las que ORDEVA ya le mandó.
  let sig = [];
  if(lng.tvLista && lng.tvLista.length){
    const i0 = vid ? lng.tvLista.indexOf(vid) : (lng.tvIdx != null ? lng.tvIdx : -1);
    const deV = vv => m.cola ? m.cola().filter(y => y.vid === vv && y.lng).pop() : null;
    sig = lng.tvLista.slice(Math.max(0, i0 + 1)).map(x => ({ vid: x, it: deV(x) }));
  }
  const enTV = lngEnTV().filter(x => x.vid !== v);
  enTV.forEach(x => { if(!sig.some(y => y.vid === x.vid)) sig.push({ vid: x.vid, it: x }); });
  const pend = m.ordenJusto && m.cola ? m.ordenJusto(m.cola()).filter(x => !x.lng && !x.done) : [];
  let lh = '';
  if(sig.length || pend.length){
    lh += '<div class="settings-desc" style="margin:10px 0 2px"><b>Sigue en el TV</b>' + (lng.tvLista ? '' : ' <small>(las que ORDEVA le mandó)</small>') + '</div>';
    sig.slice(0, 20).forEach((x, i) => {
      const inf = x.it ? { t: x.it.title || x.it.song, c: tableLabel(x.it.mesa) } : (lngInfoVideo(x.vid) || {});
      lh += '<div class="tvv-li"><img alt="" loading="lazy" src="' + lngMini(x.vid) + '"><span>' + (i + 1) + '. ' + tvEsc(inf.t || 'Cargando…') + (inf.c ? ' <small>· ' + tvEsc(inf.c) + '</small>' : '') + '</span></div>';
    });
    pend.slice(0, 10).forEach(x => { lh += '<div class="tvv-li"><span>⏳ ' + tvEsc(x.title || x.song) + ' <small>· ' + tvEsc(tableLabel(x.mesa)) + ' · ' + (x.vid ? 'entrando al TV…' : 'buscando el video…') + '</small></span></div>'; });
  }
  const L = document.getElementById('tvvLista'); if(L.dataset.h !== lh){ L.dataset.h = lh; L.innerHTML = lh; }
  // Arriba, en la cola de música: qué suena en el TV cuando no es una canción de las mesas.
  if(mini){
    const ajena = vid && !propia && lng.tvSt != null && lng.tvSt !== 0;
    mini.hidden = !ajena;
    if(ajena){ const t = lngTiempoAhora(); mini.innerHTML = '<div class="mzs-t">📺 En el TV suena: <b>' + tvEsc(titulo) + '</b> <span>· ' + tvEsc(lngNombreEstado(lng.tvSt)) + (t != null ? ' · ' + lngMmss(t) + (lng.tvD ? ' / ' + lngMmss(lng.tvD) : '') : '') + '</span></div>'; }
  }
}
// Se le pregunta al TV qué está pasando cada 8 s mientras la pantalla de Música está a la vista.
async function lngVivo(forzar){
  if(!lngOn() || document.visibilityState !== 'visible') return;
  const sec = document.getElementById('view-musica'); if(!forzar && (!sec || !sec.classList.contains('active'))) return;
  // Con el canal en vivo NUNCA se abre otra sesión (ni a mano): el TV ya contó todo al instante.
  if(lngEscVivo()){ lngVivoPintar(); return; }
  // Sin canal en vivo (navegador): cada saludo es una sesión nueva y el TV lo ve como «se conectó / se desconectó»;
  // por eso se pregunta cada 25 s y no cada 8 s.
  if(!forzar && Date.now() - lng.t < (lngEscOk() ? 7000 : 25000)){ lngVivoPintar(); if(lngEscOk()) lngEscuchar(); return; }
  if(!lngTomar(!!forzar)) return;
  try{ await lngBind(); lngResultado(true); }
  catch(e){ lngResultado(false); }
  finally{ lng.ocupado = false; lngVivoPintar(); try{ vm().renderMusica(); }catch(e){} }
}
async function lngVivoCmd(sc, txt){
  try{ await lngCmd(sc, {}); if(sc === 'next') lng.ultimoEnvio = Date.now(); showToast(txt, 3000); setTimeout(() => lngVivo(true), 1500); }
  catch(e){ showToast('⚠️ El TV no recibió la orden: ' + (e.message || e), 6000); }
}
/* ---------- Dispositivos (como la lista de YouTube) ----------
   Salen juntos: el TV conectado a ORDEVA, los otros TV que se vincularon antes con su código («YouTube on
   TV») y, en la app de Android, los TV del wifi (LG, Samsung, Chromecast, TV Box…), con «Reproduciendo
   YouTube» cuando tienen YouTube abierto. Tocar uno pasa la música de las mesas a ese TV. */
// ¿El TV vinculado está prendido? Lo dice el TV en cada saludo: si en la lista de aparatos conectados no
// está la pantalla, el TV está apagado o sin internet (o en otra red). null = todavía no se sabe.
function lngTVEnLinea(){
  if(lng.pantallaFuera && Date.now() - lng.pantallaFuera < 10 * 60000) return false;   // el TV avisó que se desconectó
  if(lngEscVivo() || ((lng.tvSt === 1 || lng.tvSt === 2 || lng.tvSt === 3) && lng.tvAt && Date.now() - lng.tvAt < 5 * 60000)) return true;
  if(!lng.disp || !lng.tvAt || Date.now() - lng.tvAt > 3 * 60000) return null;
  return lng.disp.some(x => /SCREEN/i.test(x.tipo));
}
function lngRecordar(screenId, nombre, ip){
  if(!screenId) return;
  const c = lngCfg(), viejo = (c.pantallas || []).find(x => x.screenId === screenId), l = (c.pantallas || []).filter(x => x.screenId !== screenId);
  l.unshift({ screenId, nombre: nombre || 'TV', at: Date.now(), ip: ip || (viejo && viejo.ip) || '' });
  c.pantallas = l.slice(0, 6); SS(LNG_KEY, c);
}
const tvWifi = {};
let tvWifiT = 0, tvWifiBuscando = false;
// Qué tan completa es la ficha: la que abre YouTube (appUrl) gana a la de «solo código».
const tvPuntos = t => t ? (t.appUrl ? 8 : 0) + (t.screenId ? 4 : 0) + (t.youtube ? 2 : 0) + (t.soloCodigo ? 0 : 1) : -1;
function tvWifiGuardar(tv){
  if(!tv || !tv.ip) return;
  const v = tvWifi[tv.ip];
  if(v && tvPuntos(tv) < tvPuntos(v)){ v.visto = Date.now(); return; }       // ya había una ficha mejor: no se pisa
  // Ficha nueva o mejor: reemplaza entera (no se mezcla: así no queda «soloCodigo» pegado de la ficha vieja).
  tvWifi[tv.ip] = Object.assign({}, tv, { visto: Date.now() });
  if(tv.reemplaza) Object.keys(tvWifi).forEach(k => { if(k !== tv.ip && tvWifi[k].id === tv.reemplaza) delete tvWifi[k]; });
  tvDisposPintar();
}
// App de Android: busca los TV del wifi sola al abrir Música (máximo una vez por minuto).
function tvWifiBuscar(forzar){
  if(!lngPuenteApp() || !window.VentoAndroid.buscarTVs || tvWifiBuscando) return;
  if(!forzar && Date.now() - tvWifiT < 60000) return;
  const ov = document.getElementById('tvApkOv'); if(ov && ov.classList.contains('show')) return;   // ya está buscando la lista grande
  tvWifiBuscando = true; tvWifiT = Date.now();
  Object.keys(tvWifi).forEach(k => { tvWifi[k].viejo = true; });
  window.__ventoTV = tvWifiGuardar;
  window.__ventoTVfin = () => { tvWifiBuscando = false; Object.keys(tvWifi).forEach(k => { if(tvWifi[k].viejo && Date.now() - tvWifi[k].visto > 3 * 60000) delete tvWifi[k]; }); tvDisposPintar(); };
  setTimeout(() => { tvWifiBuscando = false; }, 15000);
  try{ window.VentoAndroid.buscarTVs(); }catch(e){ tvWifiBuscando = false; }
  tvDisposPintar();
}
function tvDisposPintar(){
  const box = document.getElementById('tvDispos'), L = document.getElementById('tvdLista'); if(!box) return;
  const c = lngCfg(), on = lngOn(), filas = [];
  const fila = (ic, nombre, sub, cls, accion, go) => filas.push({ ic, nombre, sub, cls, accion, go });
  if(on){
    const nom = lng.nomTV || c.nombre || 'TV';
    const enl = lngTVEnLinea();
    const est = enl === false ? 'no responde ahora (apagado o en otra red)' : lng.tvSt === 1 || lng.tvSt === 3 ? 'Reproduciendo YouTube' : lng.tvSt === 2 ? 'En pausa' : 'Conectado';
    fila(enl === false ? '📴' : '🟢', nom, (enl === false ? 'Vinculado a ORDEVA por internet · ' : '✓ Conectado a ORDEVA · ') + est + (lng.otroNom && lng.otroNom !== nom ? ' · ' + lng.otroNom : ''), enl === false ? '' : 'on', 'vivo', 'Ver');
  }
  (c.pantallas || []).filter(x => !(on && x.screenId === c.screenId)).forEach(x => fila('📺', x.nombre || 'YouTube on TV', 'Vinculado antes con su código', '', 'p:' + x.screenId, 'Usar'));
  Object.values(tvWifi).sort((a, b) => (b.youtube ? 1 : 0) - (a.youtube ? 1 : 0)).forEach(tv => {
    if(on && tv.screenId && tv.screenId === c.screenId) return;
    const extra = [tv.fabricante, tv.modelo].filter(x => x && !String(tv.nombre).includes(x)).join(' · ');
    fila(tvIcono(tv.tipo), tv.nombre, (tv.youtube ? '▶ Reproduciendo YouTube' : (tv.app ? tv.app : 'En tu wifi')) + (extra ? ' · ' + extra : '') + (tv.soloCodigo && !tv.screenId ? ' · se conecta con su código' : ''), '', 'w:' + tv.ip, 'Usar');
  });
  // Lo que ya suena desde el celular (YouTube Music, YouTube, Spotify…) y en qué aparato: el TV al que ya estás transmitiendo.
  const md = window.__medios;
  if(md && md.permiso){
    (md.lista || []).filter(m => m.titulo).forEach(m => {
      const suena = m.estado === 3, donde = m.donde || (m.remoto ? 'otro aparato (TV / Chromecast)' : 'este celular');
      filas.push({ ic: m.remoto ? '📡' : '📱', nombre: (m.remoto ? m.donde || 'TV al que ya transmites' : m.nombreApp + ' en este celular'), sub: (suena ? '▶ ' : '⏸ ') + m.titulo + (m.artista ? ' · ' + m.artista : '') + ' — desde ' + m.nombreApp + (m.remoto ? ' en ' + donde : ''), cls: suena ? 'on' : '', accion: 'm:' + m.app, go: suena ? '⏸' : '▶', extra: m });
    });
  } else if(md && md.permiso === false){
    filas.push({ ic: '📡', nombre: 'Ver los TV a los que ya transmites', sub: 'Permite a ORDEVA ver la música que ya suena desde tu celular (YouTube Music, YouTube, Spotify…) y en qué TV', cls: '', accion: 'mperm', go: 'Permitir' });
  }
  const app = lngPuenteApp();
  box.hidden = !filas.length && !app;
  const act = document.getElementById('tvdAct'); if(act) act.textContent = tvWifiBuscando ? '⏳ buscando en el wifi…' : app ? '' : '';
  let h = filas.map(f => f.extra
    ? '<div class="tvv-dev ' + f.cls + '"><span class="tvv-ic">' + f.ic + '</span><div style="flex:1;min-width:0"><b>' + tvEsc(f.nombre) + '</b><small>' + tvEsc(f.sub) + '</small></div><span style="display:flex;gap:4px"><button type="button" class="btn-ghost" data-acc="mp:' + tvEsc(f.extra.app) + '" style="padding:6px 10px">' + f.go + '</button><button type="button" class="btn-ghost" data-acc="mn:' + tvEsc(f.extra.app) + '" style="padding:6px 10px">⏭</button></span></div>' +
      (f.extra.remoto && !(lngOn() && lngTVEnLinea() !== false) ? '<button type="button" class="tvv-dev" data-acc="codigo"><span class="tvv-ic">🔗</span><div><b>Mandarle las canciones de las mesas a ' + tvEsc(f.extra.donde || 'ese TV') + '</b><small>Vincúlalo una vez con su código: en ese TV, YouTube → Configuración → «Vincular con código de TV». No se corta lo que suena.</small></div><span class="tvv-go">›</span></button>' : '')
    : '<button type="button" class="tvv-dev ' + f.cls + '" data-acc="' + tvEsc(f.accion) + '"><span class="tvv-ic">' + f.ic + '</span><div><b>' + tvEsc(f.nombre) + '</b><small>' + tvEsc(f.sub) + '</small></div><span class="tvv-go">' + f.go + ' ›</span></button>').join('');
  if(app) h += '<button type="button" class="tvv-dev" data-acc="buscar"><span class="tvv-ic">🔄</span><div><b>Buscar TV en el wifi</b><small>' + (tvWifiBuscando ? 'Buscando…' : 'LG, Samsung, Chromecast, Android TV, TV Box, Fire TV') + '</small></div></button>';
  else if(!filas.length) h = '';
  if(!app && window.esAndroid && window.esAndroid()) h += '<div class="settings-desc">Los TV de tu wifi (como los que ves en YouTube) solo los puede buscar la <b>app ORDEVA para Android</b>; desde el navegador conecta con el código del TV.</div>';
  if(L.dataset.h !== h){ L.dataset.h = h; L.innerHTML = h; }
  try{ castDevsPintar(); }catch(e){}
}
// Pasa la música de ORDEVA a otro TV ya conocido (por su screenId), sin volver a abrir YouTube allá.
async function lngUsarPantalla(screenId, nombre, yaSuena, silencioso){
  for(let i = 0; i < 40 && lng.ocupado && Date.now() - lng.ocupadoT < 90000; i++) await new Promise(r => setTimeout(r, 500));
  lng.ocupado = true; lng.ocupadoT = Date.now(); lng.fallas = 0; lng.pausaHasta = 0;
  const c = lngCfg(), antes = { screenId: c.screenId, loungeToken: c.loungeToken, exp: c.exp, nombre: c.nombre, on: c.on };
  try{
    lngLog('cambiar al TV «' + (nombre || 'TV') + '»');
    Object.assign(c, { screenId, nombre: nombre || 'TV', on: true, codigo: true }); delete c.loungeToken; delete c.exp; SS(LNG_KEY, c);
    lng.sid = null; lng.disp = null; lng.tvLista = null;
    await lngBind();
    lngRecordar(screenId, nombre);
    lngReloj0('TV «' + (nombre || 'TV') + '»');
    lng.ocupado = false;
    autoPausar();
    try{ vm().cola().forEach(x => { if(!x.vid && !x.done) vm().ytAgregar(x.id); }); }catch(e){}
    // Si ese TV ya está sonando algo, las canciones de las mesas se agregan detrás (no se corta).
    if(yaSuena || lng.tvPlay === true) lngSync(); else { lng.porPersona = true; lngSync(true); }
    showToast('✅ Conectado a «' + (nombre || 'TV') + '». La música de las mesas va a ese TV.', 6000);
    return true;
  }catch(e){
    Object.assign(c, antes); SS(LNG_KEY, c); lng.sid = null;
    lngLog('   ❌ ' + (e.message || e)); if(!silencioso) showToast('⚠️ No pude conectar con «' + (nombre || 'TV') + '»: ' + (e.message || e), 9000);
    return false;
  }finally{ lng.ocupado = false; lngEstado(); lngVivoPintar(); }
}
function mediosLeer(){
  const A = window.VentoAndroid; if(!A || typeof A.medios !== 'function') return;
  let m = null; try{ m = JSON.parse(A.medios() || '{}'); }catch(e){}
  const ahora = JSON.stringify(m ? { p: m.permiso, l: (m.lista || []).map(x => [x.app, x.titulo, x.estado, x.donde, x.remoto]) } : null);
  const cambio = ahora !== window.__mediosHuella;
  window.__mediosHuella = ahora; window.__medios = m;
  if(cambio) try{ tvDisposPintar(); }catch(e){}
  return m;
}
function tvDisposToque(acc){
  const A = window.VentoAndroid;
  if(acc === 'mperm'){ showToast('En la pantalla que se abre, prende «ORDEVA». Solo mira los reproductores de música, no tus mensajes.', 9000); try{ A.mediosPermiso(); }catch(e){} return; }
  if(acc === 'codigo'){ tvSinLista('Escribe los 12 números que muestra ese TV en YouTube → Configuración → «Vincular con código de TV». Lo que suena no se corta.'); setTimeout(() => { const c = document.getElementById('lngCode'); if(c) c.focus(); }, 500); return; }
  if(/^m[pn]:/.test(acc) || /^m:/.test(acc)){
    const pkg = acc.replace(/^m[pn]?:/, ''), m = ((window.__medios || {}).lista || []).find(x => x.app === pkg);
    const que = acc.startsWith('mn:') ? 'next' : (m && m.estado === 3 ? 'pause' : 'play');
    try{ A.medioAccion(pkg, que); }catch(e){}
    setTimeout(mediosLeer, 700); return;
  }
  if(acc === 'buscar') return tvWifiBuscar(true);
  if(acc === 'vivo'){ const v = document.getElementById('tvVivo'); if(v) v.scrollIntoView({ block: 'start', behavior: 'smooth' }); return lngVivo(true); }
  if(acc.startsWith('p:')){ const p = (lngCfg().pantallas || []).find(x => x.screenId === acc.slice(2)); if(p) lngUsarPantalla(p.screenId, p.nombre, false); return; }
  if(acc.startsWith('w:')){
    const tv = tvWifi[acc.slice(2)]; if(!tv) return;
    return tvConectarAparato(tv);
  }
}
function iniVivo(){
  const b = id => document.getElementById(id);
  if(!b('tvVivo')) return;
  b('tvvPausa').onclick = () => lng.tvSt === 2 ? lngVivoCmd('play', '▶ Sigue sonando en el TV') : lngVivoCmd('pause', '⏸ En pausa en el TV');
  b('tvvSig').onclick = () => lngVivoCmd('next', '⏭ El TV pasa a la siguiente');
  b('tvvRef').onclick = () => lngVivo(true);
  b('tvdLista').addEventListener('click', e => { const x = e.target.closest('[data-acc]'); if(x) tvDisposToque(x.dataset.acc); });
  const agregar = () => {
    const inp = b('tvvIn'), q = inp.value.trim();
    if(!q) return showToast('Escribe la canción o el artista.');
    const msg = window.vitoAddSong ? window.vitoAddSong(0, q) : '';
    inp.value = '';
    showToast(/^⚠️|ya está|ya pidió/.test(msg) ? msg : '➕ «' + q + '» va a entrar a la cola del TV.', 5000);
    lngVivoPintar();
  };
  b('tvvAdd').onclick = agregar;
  b('tvvIn').addEventListener('keydown', e => { if(e.key === 'Enter'){ e.preventDefault(); agregar(); } });
  setInterval(() => { lngVivo(); }, 8000);
  setInterval(() => { try{ const sc = document.getElementById('view-musica'); if(sc && sc.classList.contains('active') && document.visibilityState === 'visible') mediosLeer(); }catch(e){} }, 3000);
  document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'visible') setTimeout(mediosLeer, 400); });
  setInterval(() => { try{ const s = document.getElementById('view-musica'); if(lngOn() && s && s.classList.contains('active')) lngVivoPintar(); }catch(e){} }, 1000);
  const nb = document.querySelector('nav button[data-view="musica"]'); if(nb) nb.addEventListener('click', () => setTimeout(() => { lngVivo(true); tvWifiBuscar(false); }, 300));
  if(lngCfg().screenId) lngRecordar(lngCfg().screenId, lngCfg().nombre);
  lngVivoPintar(); tvDisposPintar();
}
/* ---------- Registro de lo que pasa con el TV ----------
   Sin esto no hay forma de saber por qué el TV no arranca: queda lo que ORDEVA le mandó,
   lo que el TV contestó y en qué estado quedó. Se puede copiar y mandar para revisarlo. */
const LNG_LOG_MAX = 40;
function lngLog(txt){
  const h = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  lng.log = (lng.log || []); lng.log.push(h + '  ' + txt);
  if(lng.log.length > LNG_LOG_MAX) lng.log = lng.log.slice(-LNG_LOG_MAX);
  const box = document.getElementById('lngLog');
  if(box){ box.textContent = lng.log.join('\n'); box.scrollTop = box.scrollHeight; }
}
const lngEstadoNombre = v => v === true ? 'sonando' : v === false ? 'detenido' : 'no se sabe';
/* Las canciones solo llegan al TV si antes se les encontró el video en YouTube. Aquí se ve con
   qué se busca (clave, tu cuenta o búsqueda libre), qué cuenta está conectada y, si hay
   canciones atascadas sin video, por qué. */
function lngBusca(){
  const el = document.getElementById('lngBusca'); if(!el) return;
  const m = vm(); if(!m.yCfg) return;
  const y = m.yCfg(), tok = m.yTok && m.yTok(), f = m.yFuente ? m.yFuente() : '';
  const atascadas = m.cola ? m.cola().filter(x => !x.done && !x.vid && !x.novid).length : 0;
  const bCta = document.getElementById('lngCuenta');
  if(bCta) bCta.textContent = tok ? '🔑 Cuenta conectada' + (y.who ? ': «' + y.who + '»' : '') + ' · tocar para cambiarla' : '🔑 Conectar mi cuenta de YouTube';
  let t = '🔎 Las canciones se buscan con: ' + (f === 'cuenta' ? 'tu cuenta' + (y.who ? ' «' + y.who + '»' : '') : f === 'libre' ? 'búsqueda libre (sin clave)' : f === 'clave' ? 'la API key' : (tok ? 'tu cuenta' + (y.who ? ' «' + y.who + '»' : '') : 'la API key, y si se acaba el cupo, búsqueda libre')) + '.';
  if(atascadas) t += '\n⚠️ ' + atascadas + (atascadas === 1 ? ' canción no ha encontrado' : ' canciones no han encontrado') + ' su video' + (window.ytFallo ? ': ' + window.ytFallo : ' todavía (se reintenta solo).');
  el.style.whiteSpace = 'pre-line';
  el.textContent = t;
}
function lngEstado(){
  try{ lngBusca(); }catch(x){}
  const e = document.getElementById('lngEstado'), box = document.getElementById('lngBox'); if(!e) return;
  const c = lngCfg();
  box.classList.remove('ok', 'no');
  document.getElementById('lngOff').hidden = !c.screenId;
  document.getElementById('lngPlay').hidden = !lngOn();
  if(!lngOn()){ e.textContent = lngHayPuente() ? 'Falta conectar el TV: escribe su código arriba o toca «Transmitir al TV».' : 'Sin conectar. Sigue los pasos 1 y 2.'; return; }
  if(lng.error){ box.classList.add('no'); e.textContent = '⚠️ ' + lng.error; return; }
  box.classList.add('ok');
  const n = vm().cola ? vm().cola().filter(x => x.lng && x.lngAt > Date.now() - 36e5).length : 0;
  e.textContent = '🟢 Conectado a «' + (c.nombre || 'TV') + '»: cada canción que pidan las mesas entra sola a la cola del YouTube del TV' + (n ? ' (' + n + ' en la última hora)' : '') + '.';
}
function lngGuia(){
  let ov = document.getElementById('lngHowOverlay');
  if(!ov){
    ov = document.createElement('div'); ov.id = 'lngHowOverlay'; ov.className = 'overlay';
    ov.innerHTML = '<div class="modal cast-guide" style="max-width:440px;max-height:88vh;overflow:auto"><h2>🛠️ Crear el puente (gratis, una vez)</h2>' +
      '<div class="modal-sub">Mejor hazlo desde un computador; también sirve el celular.</div><ol>' +
      '<li>Entra a <b>dash.cloudflare.com</b> y crea una cuenta gratis (solo correo y contraseña).</li>' +
      '<li>En el menú: <b>Workers &amp; Pages</b> (o «Compute») → <b>Create</b> → <b>Create Worker</b>. Ponle de nombre <b>mesora-tv</b> y toca <b>Deploy</b>.</li>' +
      '<li>Toca <b>Edit code</b>. Borra todo lo que aparece.</li>' +
      '<li>En ORDEVA toca <b>📋 Copiar código del puente</b> y pégalo allá. Toca <b>Deploy</b>.</li>' +
      '<li>Copia la dirección que te da Cloudflare (termina en <b>.workers.dev</b>) y pégala en el paso 1 de ORDEVA. Toca <b>Probar puente</b>: debe decir ✅.</li></ol>' +
      '<div class="modal-actions"><button class="btn-primary" type="button" id="lngHowOk">Entendido</button></div></div>';
    document.body.appendChild(ov);
    ov.querySelector('#lngHowOk').onclick = () => ov.classList.remove('show');
    ov.addEventListener('click', e => { if(e.target === ov) ov.classList.remove('show'); });
  }
  ov.classList.add('show');
}
/* Arreglo de datos (una vez, v1.17.8): las canciones que quedaron «en el TV» con las versiones
   1.17.1–1.17.7 y nunca sonaron vuelven a la cola para mandarse bien (las de más de 3 h se cierran).
   No se borra ninguna: las viejas quedan en el historial. */
function lngArreglarDatos(){
  try{
    if(localStorage.getItem('vito_tvfix1')) return;
    const l = vm().cola ? vm().cola() : []; let n = 0, v = 0;
    l.forEach(x => {
      if(x.lng && x.status === 'tv'){
        if(Date.now() - (x.lngAt || x.ts || 0) < 3 * 36e5){ x.lng = false; x.done = false; x.status = x.ok ? 'approved' : 'pending'; delete x.lngAt; delete x.lngN; n++; }
        else v++;
      }
    });
    if(n) SS('vito_cola', l);
    l.filter(x => x.lng && x.status === 'tv').forEach(x => vm().mzTermino(x.id, 'skipped'));
    const c = lngCfg(); delete c.hasta; delete c.cursor; delete c.visto; SS(LNG_KEY, c);
    localStorage.setItem('vito_tvfix1', String(Date.now()));
    if(n || v) lngLog('arreglo de datos: ' + n + ' canciones vuelven a la cola' + (v ? ', ' + v + ' viejas al historial' : ''));
  }catch(e){}
}
function iniLounge(){
  lngArreglarDatos();
  const relay = document.getElementById('lngRelay'); if(!relay) return;
  relay.value = lngCfg().relay || '';
  // Con el puente ya configurado, la sección queda en lo único que hace falta: el código del TV.
  try{
    const det = document.getElementById('tvOptCodigo');
    if(det && lngHayPuente()){
      // Con estilo directo: el «hidden» solo no alcanzaba (el estilo de .lng-step le ganaba y se seguía viendo).
      const ocultar = x => { if(x){ x.hidden = true; x.style.display = 'none'; } };
      ocultar(relay.closest('.lng-step'));
      det.querySelectorAll(':scope > .settings-desc').forEach(ocultar);
      det.querySelectorAll('.pair-n').forEach(ocultar);
      const nota = document.createElement('div'); nota.className = 'settings-desc'; nota.textContent = (lngPuenteApp() ? '✅ Puente incluido en la app.' : '✅ Puente listo.') + ' En el TV: YouTube → Configuración → «Vincular con código de TV». Escribe aquí los 12 números y toca Conectar.';
      det.insertBefore(nota, det.querySelector('.lng-step'));
    }
  }catch(e){}
  relay.onchange = () => { const c = lngCfg(); c.relay = relay.value.trim().replace(/\/+$/, ''); if(c.relay && !/^https:\/\//.test(c.relay)) c.relay = 'https://' + c.relay.replace(/^\w+:\/\//, ''); relay.value = c.relay; SS(LNG_KEY, c); lngEstado(); };
  document.getElementById('lngHow').onclick = e => { e.preventDefault(); lngGuia(); };
  document.getElementById('lngCopy').onclick = async () => {
    const src = document.getElementById('lngWorkerSrc').textContent.trim();
    try{ await navigator.clipboard.writeText(src); showToast('📋 Código del puente copiado. Pégalo en Cloudflare (Edit code) y toca Deploy.', 6000); }
    catch(e){ showToast('⚠️ No se pudo copiar. Está en la carpeta «puente» del proyecto en GitHub.', 6000); }
  };
  document.getElementById('lngTest').onclick = async () => {
    relay.onchange();
    const c = lngCfg(); if(!c.relay) return showToast('⚠️ Pega primero la dirección del puente.');
    try{ const r = await fetch(c.relay + '/'); const t = await r.text(); showToast(/Vento/.test(t) ? '✅ El puente funciona.' : '⚠️ Esa dirección responde, pero no es el puente de Vento. Revisa que pegaste el código completo.', 6000); }
    catch(e){ showToast('⚠️ No responde. Revisa la dirección (termina en .workers.dev) y que tocaste Deploy.', 6000); }
  };
  const code = document.getElementById('lngCode');
  code.addEventListener('input', () => { const d = code.value.replace(/\D/g, '').slice(0, 12); code.value = d.replace(/(\d{3})(?=\d)/g, '$1 '); });
  document.getElementById('lngGo').onclick = async () => {
    relay.onchange();
    const d = code.value.replace(/\D/g, '');
    if(!lngHayPuente()) return showToast('⚠️ Primero el paso 1: la dirección del puente.');
    if(d.length !== 12) return showToast('⚠️ El código del TV tiene 12 números.');
    const b = document.getElementById('lngGo'); b.disabled = true; b.textContent = '⏳ Conectando con el TV…';
    // Turno exclusivo: se espera (máx. 20 s) a que termine cualquier revisión del TV en curso, para que
    // dos conexiones no se crucen (antes podían pisarse y la del código quedaba dañada).
    for(let i = 0; i < 40 && lng.ocupado && Date.now() - lng.ocupadoT < 90000; i++) await new Promise(r => setTimeout(r, 500));
    lng.ocupado = true; lng.ocupadoT = Date.now(); lng.fallas = 0; lng.pausaHasta = 0;
    try{
      lngLog('código del TV: buscando el TV con el código ' + d.slice(0, 3) + '…');
      await lngParear(d);
      lngLog('   ✅ el TV respondió: «' + (lngCfg().nombre || 'TV') + '»');
      lngReloj0('código del TV');
      await lngBind();
      // Si ORDEVA también estaba mandando la música por otros caminos, se apagan para no duplicar.
      autoPausar(); SS(LNG_KEY, Object.assign(lngCfg(), { codigo: true }));
      const tv = document.getElementById('tvpOn'); if(tv && tv.checked){ tv.checked = false; tv.dispatchEvent(new Event('change')); }
      code.value = '';
      showToast('✅ Conectado a «' + (lngCfg().nombre || 'TV') + '». Las canciones de las mesas van a entrar solas a la cola del YouTube del TV.', 8000);
      vm().cola().forEach(x => { if(!x.vid && !x.done) vm().ytAgregar(x.id); });
      lng.ocupado = false;
      if(lng.tvPlay === true){ lngLog("   el TV ya está sonando: las canciones de las mesas se agregan detrás (no se corta)"); lngSync(); } else { lng.porPersona = true; lngSync(true); }
    }catch(e){
      lng.error = e.message; lngLog('   ❌ ' + e.message); showToast('⚠️ ' + e.message, 10000);
      const lb = document.getElementById('lngLogBox'); if(lb){ lb.hidden = false; const l = document.getElementById('lngLog'); if(l) l.textContent = 'ORDEVA ' + MESORA_VERSION + '\n' + (lng.log || []).join('\n'); }
    }
    finally{ lng.ocupado = false; b.disabled = false; b.textContent = '🔗 Conectar con el YouTube del TV'; lngEstado(); }
  };
  document.getElementById('lngPlay').onclick = () => { lng.porPersona = true; lng.pausaHasta = 0; lngSync(true); };
  document.getElementById('lngCuenta').onclick = () => {
    const m = vm(), y = m.yCfg ? m.yCfg() : {};
    if(!y.cid){ showToast('Para entrar con tu cuenta de YouTube primero hay que pegar el «Client ID de Google» en Música → ▶ YouTube Music automático (ahí están los pasos). Mientras tanto las canciones se buscan con la clave o con la búsqueda libre.', 10000); const k = document.getElementById('ytCid'); if(k){ k.scrollIntoView({ block: 'center', behavior: 'smooth' }); } return; }
    // Antes se refrescaba el estado con un tiempo fijo (4s) adivinando que ya
    // había terminado — si la ventana de Google tardaba más (elegir cuenta,
    // poner contraseña, aprobar permisos), el botón se quedaba diciendo
    // "Conectar" aunque sí se hubiera conectado, y parecía que no pasó nada.
    // Ahora se avisa apenas Google responde de verdad (con o sin éxito).
    const btn = document.getElementById('lngCuenta');
    btn.disabled = true; btn.textContent = '⏳ Conectando con tu cuenta de Google…';
    let terminado = false;
    const refrescar = () => { if(terminado) return; terminado = true; btn.disabled = false; lngEstado(); };
    m.yConectar(false, refrescar);
    setTimeout(refrescar, 20000); // respaldo por si la ventana de Google se quedó abierta sin responder
  };
  document.getElementById('lngProbar').onclick = async () => {
    const b = document.getElementById('lngProbar'); b.disabled = true; b.textContent = '⏳ Probando…';
    try{
      const r = await lngProbar();
      const box = document.getElementById('lngLogBox'); box.hidden = false;
      document.getElementById('lngLog').textContent = 'ORDEVA ' + MESORA_VERSION + (window.VentoAndroid ? ' · app Android' : '') + '\n' + r.join('\n') + '\n\n' + (lng.log || []).join('\n');
      showToast(r.some(x => x.startsWith('❌')) ? '⚠️ ' + r.find(x => x.startsWith('❌')).replace(/^❌\s*/, '') : '✅ Todo conecta: puente y YouTube funcionan.', 10000);
    }finally{ b.disabled = false; b.textContent = '🩺 Probar conexión'; lngEstado(); }
  };
  document.getElementById('lngVerLog').onclick = () => {
    const box = document.getElementById('lngLogBox');
    box.hidden = !box.hidden;
    if(!box.hidden) document.getElementById('lngLog').textContent = 'ORDEVA ' + MESORA_VERSION + '\n' + ((lng.log || []).join('\n') || 'Todavía no se ha mandado nada al TV.');
  };
  document.getElementById('lngLogCopy').onclick = async () => {
    const txt = (lng.log || []).join('\n');
    if(!txt) return showToast('Todavía no hay nada que copiar.');
    try{ await navigator.clipboard.writeText('ORDEVA ' + MESORA_VERSION + ' · YouTube del TV\n' + txt); showToast('📋 Registro copiado.'); }
    catch(e){ showToast('⚠️ No se pudo copiar.'); }
  };
  document.getElementById('lngOff').onclick = () => { lngEscParar(); lngReloj0('desconectado'); const c = lngCfg(); ['screenId', 'loungeToken', 'exp', 'nombre', 'on', 'ultimo', 'hasta', 'visto', 'arranco'].forEach(k => delete c[k]); SS(LNG_KEY, c); lng.sid = null; lng.error = ''; lngEstado(); autoRestaurar(); showToast('Desconectado del YouTube del TV.'); };
  setInterval(() => { lngSync(); }, 4000);
  setInterval(() => { lngVigilar(); }, 12000);
  const ahora = () => { lng.pausaHasta = 0; lngSync(); setTimeout(lngVigilar, 1500); };
  window.addEventListener('online', ahora);
  document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'visible' && lngOn()) ahora(); });
  /* Latido: sin esto, mientras no hubiera canciones pendientes, la conexión con el TV nunca se
     volvía a revisar — si el TV se apagaba o se desvinculaba, nadie se enteraba (ni un aviso)
     hasta que llegara la próxima canción, que entonces tampoco sonaba. Ahora se comprueba sola
     cada 30 s aunque no haya nada por mandar, y cualquier problema queda visible en el estado. */
  setInterval(async () => {
    if(!lngOn() || (lng.ocupado && Date.now() - lng.ocupadoT < 90000) || Date.now() < lng.pausaHasta) return;
    try{ await lngAsegurar(false); if(lng.error){ lng.error = ''; lngLog('   ✅ conexión con el TV recuperada'); } }
    catch(e){ const msg = e.message || String(e); if(lng.error !== msg){ lng.error = msg; lngLog('   ⚠️ latido: ' + msg); } }
    lngEstado();
  }, 30000);
  // Canciones que quedaron sin video (búsqueda fallida): se reintentan cada 20 s mientras el TV esté conectado.
  setInterval(() => { try{ if(!lngOn()) return; const m = vm(); m.cola().filter(x => !x.done && !x.vid && !x.novid).forEach(x => m.ytAgregar(x.id)); lngEstado(); }catch(e){} }, 20000);
  const nb = document.querySelector('nav button[data-view="musica"]'); if(nb) nb.addEventListener('click', lngEstado);
  lngEstado();
  try{ iniVivo(); }catch(e){}
}

/* ---------- Contabilidad: entradas, gastos y resultado del negocio ----------
   Entradas automáticas: lo cobrado en las cuentas cerradas y ventas de mostrador (por medio de
   pago; los fiados cuentan el día que se pagan). Gastos automáticos: las compras a proveedores
   (facturas escaneadas). Además se registran a mano otros gastos (arriendo, servicios, nómina…)
   y otros ingresos (data.contab). Todo sale de los datos que ya tiene la app. */
const CT_CATS = {
  gasto: [['proveedores', '📦 Proveedores / mercancía'], ['arriendo', '🏠 Arriendo'], ['servicios', '💡 Servicios (luz, agua, gas, internet)'], ['nomina', '👥 Nómina / sueldos'], ['impuestos', '🏛️ Impuestos'], ['mantenimiento', '🛠️ Mantenimiento'], ['transporte', '🚚 Transporte / domicilios'], ['publicidad', '📣 Publicidad'], ['seguridad_social', '🩺 Salud, pensión y ARL'], ['bancos', '🏦 Bancos (comisiones, intereses, cuotas)'], ['otros', '🗂️ Otros gastos']],
  ingreso: [['otros_ingresos', '💰 Otros ingresos'], ['aporte', '🙋 Aporte del dueño'], ['prestamo', '🏦 Préstamo recibido']]
};
// Además de las de siempre, cada tipo de negocio tiene sus propios gastos típicos.
const CT_CATS_NEGOCIO = {
  restaurante: [['insumos', '🥩 Insumos de cocina'], ['gas', '🔥 Gas / pipetas'], ['licencias', '📜 Licencias y permisos (Sayco, bomberos)']],
  cafeteria: [['insumos', '☕ Insumos (café, leche, pan)'], ['gas', '🔥 Gas / pipetas'], ['licencias', '📜 Licencias y permisos (Sayco, bomberos)']],
  cerveceria: [['licores', '🍺 Cerveza y licores'], ['licencias', '📜 Licencias y permisos (Sayco, bomberos)'], ['musica', '🎵 Música / DJ']],
  billar: [['licores', '🍺 Cerveza y licores'], ['billar', '🎱 Paños, tacos y bolas'], ['licencias', '📜 Licencias y permisos']],
  licorera: [['licores', '🍾 Licores (mercancía)'], ['licencias', '📜 Licencias y permisos']],
  panaderia: [['harinas', '🌾 Harinas e insumos'], ['gas', '🔥 Gas / pipetas'], ['empaques', '🛍️ Empaques']],
  farmacia: [['laboratorios', '💊 Laboratorios / mayoristas'], ['vencidos', '🗑️ Productos vencidos'], ['licencias', '📜 Permisos (Invima, secretaría de salud)']],
  ferreteria: [['mercancia', '🔩 Mercancía'], ['fletes', '🚛 Fletes']],
  ropa: [['mercancia', '👕 Mercancía'], ['confeccion', '🧵 Confección / arreglos'], ['empaques', '🛍️ Bolsas y empaques']],
  barberia: [['productos_bar', '💈 Productos (ceras, cuchillas)'], ['comisiones', '✂️ Comisiones de barberos']],
  hotel: [['lavanderia', '🧺 Lavandería'], ['aseo', '🧴 Aseo y amenities'], ['plataformas', '🌐 Comisión de plataformas (Booking, Airbnb)']],
  motel: [['lavanderia', '🧺 Lavandería'], ['aseo', '🧴 Aseo y amenities']],
  medico: [['insumos_med', '🩺 Insumos médicos'], ['equipos', '🩻 Equipos'], ['seguros', '🛡️ Póliza de responsabilidad']],
  veterinaria: [['medicamentos', '💉 Medicamentos y vacunas'], ['alimento', '🦴 Alimento'], ['equipos', '🩻 Equipos']],
  evento: [['alquiler', '🎪 Alquiler de mobiliario'], ['personal', '🧑‍🍳 Personal por evento'], ['decoracion', '🎈 Decoración']],
  tienda: [['mercancia', '🛒 Mercancía']]
};
window.VENTO_NEGOCIOS.CAT.forEach(t => { if(!CT_CATS_NEGOCIO[t.k] && t.gastos.length) CT_CATS_NEGOCIO[t.k] = t.gastos.map(g => [g, window.VENTO_NEGOCIOS.G[g] || g]); });
Object.keys(window.VENTO_NEGOCIOS.ALIAS).forEach(k => { if(!CT_CATS_NEGOCIO[k]) CT_CATS_NEGOCIO[k] = CT_CATS_NEGOCIO[window.VENTO_NEGOCIOS.ALIAS[k]] || []; });
function ctCatsGasto(){
  const base = CT_CATS.gasto, otros = base.find(c => c[0] === 'otros');
  const extra = CT_CATS_NEGOCIO[(typeof data !== 'undefined' && data && data.businessType) || ''] || [];
  return base.filter(c => c[0] !== 'otros').concat(extra.filter(e => !base.some(b => b[0] === e[0])), [otros]);
}
const CT_METODOS = { efectivo: '💵 Efectivo', transferencia: '🏦 Transferencia', nequi: '📱 Nequi / Daviplata', tarjeta: '💳 Tarjeta', debe: 'Fiado', otro: 'Otro' };
let ctPeriodo = 'mes', ctTipo = 'gasto', ctCsvData = null;
const ctCatNombre = (t, c) => { const l = t === 'gasto' ? ctCatsGasto().concat(Object.values(CT_CATS_NEGOCIO).flat()) : (CT_CATS[t] || []); const x = l.find(y => y[0] === c); return x ? x[1] : (c || ''); };
const ctDia = d => { const x = new Date(d); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
const ctFmt = n => fmt(Math.round(n));
function ctRango(){
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const fin = new Date(hoy); fin.setDate(fin.getDate() + 1);
  let ini = new Date(hoy), f = fin, titulo;
  if(ctPeriodo === 'hoy'){ titulo = 'Hoy'; }
  else if(ctPeriodo === 'semana'){ ini.setDate(ini.getDate() - 6); titulo = 'Últimos 7 días'; }
  else if(ctPeriodo === 'mes'){ ini.setDate(1); titulo = 'Este mes'; }
  else if(ctPeriodo === 'mesant'){ ini = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1); f = new Date(hoy.getFullYear(), hoy.getMonth(), 1); titulo = 'Mes pasado'; }
  else if(ctPeriodo === 'anio'){ ini = new Date(hoy.getFullYear(), 0, 1); titulo = 'Este año'; }
  else {
    const d = document.getElementById('ctDesde').value, h = document.getElementById('ctHasta').value;
    ini = d ? new Date(d + 'T00:00') : new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    f = h ? new Date(new Date(h + 'T00:00').getTime() + 864e5) : fin;
    titulo = 'Fechas elegidas';
  }
  const opt = { day: 'numeric', month: 'short', year: 'numeric' };
  return { ini: ini.getTime(), fin: f.getTime(), titulo: titulo + ' · ' + new Date(ini).toLocaleDateString('es-CO', opt) + ' al ' + new Date(f.getTime() - 1).toLocaleDateString('es-CO', opt) };
}
// Todos los movimientos del periodo en un solo formato: { tipo: venta|ingreso|gasto, monto, fecha, ... }
function ctMovimientos(r){
  const mov = [];
  let vendido = 0, costo = 0, sinCosto = false, porCobrar = 0, nVentas = 0;
  (data.history || []).forEach(h => {
    const t = new Date(h.date).getTime();
    if(t >= r.ini && t < r.fin){
      nVentas++; vendido += Number(h.total) || 0;
      (h.items || []).forEach(it => { const c = Number(it.cost); if(c > 0) costo += c * (Number(it.qty) || 0); else if(!/domicilio|propina/i.test(it.name || '')) sinCosto = true; });
      porCobrar += Number(h.debt) || 0;
    }
    const pagoTarde = h.paidLater ? new Date(h.paidLater).getTime() : 0;
    (h.payments || []).forEach(p => {
      if(p.method === 'debe' || !(Number(p.amount) > 0)) return;
      const tarde = pagoTarde && /pagó después/.test(p.note || '');
      const cuando = tarde ? pagoTarde : t;
      if(cuando >= r.ini && cuando < r.fin){
        const quien = h.tableName || (h.table ? i18nPut(espacioN()) + ' ' + h.table : 'Venta');
        mov.push({ tipo: 'venta', monto: Number(p.amount), metodo: p.method || 'otro', fecha: cuando, desc: tarde ? 'Fiado cobrado · ' + quien : quien });
      }
    });
  });
  (data.purchases || []).forEach(pu => {
    const t = new Date(pu.at || pu.date).getTime();
    if(t >= r.ini && t < r.fin && Number(pu.total) > 0) mov.push({ tipo: 'gasto', cat: 'proveedores', monto: Number(pu.total), metodo: 'otro', fecha: t, desc: 'Compra' + (pu.supplier ? ' a ' + pu.supplier : '') + ' (factura escaneada)', auto: true });
  });
  (data.contab || []).forEach(g => {
    const t = new Date(g.fecha + 'T12:00').getTime();
    if(t >= r.ini && t < r.fin) mov.push({ tipo: g.tipo, cat: g.cat, monto: Number(g.monto) || 0, metodo: g.metodo, fecha: t, desc: g.nota || ctCatNombre(g.tipo, g.cat).replace(/^\S+\s/, ''), id: g.id, adj: !!g.adj });
  });
  mov.sort((a, b) => b.fecha - a.fecha);
  return { mov, vendido, costo, sinCosto, porCobrar, nVentas };
}
function renderConta(){
  if(!document.getElementById('view-contabilidad') || typeof data === 'undefined' || !data) return;
  document.querySelectorAll('#ctPeriodos button').forEach(b => b.classList.toggle('on', b.dataset.p === ctPeriodo));
  document.getElementById('ctRango').hidden = ctPeriodo !== 'rango';
  const r = ctRango(); document.getElementById('ctTitulo').textContent = r.titulo;
  const x = ctMovimientos(r);
  const suma = f => x.mov.filter(f).reduce((a, m) => a + m.monto, 0);
  const ventas = suma(m => m.tipo === 'venta'), otrosIn = suma(m => m.tipo === 'ingreso'), gastos = suma(m => m.tipo === 'gasto');
  const entradas = ventas + otrosIn, resultado = entradas - gastos;
  const k = (cls, t, v, sub) => '<div class="ct-kpi ' + cls + '"><small>' + t + '</small><b>' + v + '</b>' + (sub ? '<span>' + sub + '</span>' : '') + '</div>';
  document.getElementById('ctKpis').innerHTML =
    k('in', '💰 Entradas', ctFmt(entradas), 'Cobrado ' + ctFmt(ventas) + (otrosIn ? ' + otros ' + ctFmt(otrosIn) : '')) +
    k('out', '💸 Gastos', ctFmt(gastos), 'Compras y gastos registrados') +
    k('res', resultado >= 0 ? '✅ Te quedó' : '⚠️ Faltó', ctFmt(Math.abs(resultado)), 'Entradas − gastos') +
    k('', '🧾 Vendido', ctFmt(x.vendido), x.nVentas + (x.nVentas === 1 ? ' cuenta' : ' cuentas')) +
    k('', '📈 Ganancia de lo vendido', ctFmt(x.vendido - x.costo), 'Vendido − costo de los productos' + (x.sinCosto ? ' (faltan costos)' : '')) +
    k('', '🕒 Por cobrar (fiados)', ctFmt(x.porCobrar), 'De las ventas de este periodo');
  document.getElementById('ctAviso').textContent = (x.sinCosto ? '⚠️ Algunos productos vendidos no tienen costo: la ganancia de lo vendido sale más alta de lo real (ponlo en Productos → tocar el producto → Costo). ' : '') + 'Entradas = dinero cobrado (los fiados cuentan el día que los pagan). Las compras a proveedores entran solas al escanear sus facturas; los demás gastos regístralos aquí abajo.';
  const barras = (obj, cls, nombre) => { const ks = Object.keys(obj).sort((a, b) => obj[b] - obj[a]); const max = Math.max(1, ...ks.map(q => obj[q])); return ks.length ? ks.map(q => '<div class="ct-barra ' + cls + '"><span>' + invEsc(nombre(q)) + '</span><i style="width:' + Math.max(2, obj[q] / max * 100) + '%"></i><b>' + ctFmt(obj[q]) + '</b></div>').join('') : '<div class="empty-note">Nada en este periodo.</div>'; };
  const porMedio = {}, porCat = {};
  x.mov.forEach(m => { if(m.tipo === 'gasto') porCat[m.cat || 'otros'] = (porCat[m.cat || 'otros'] || 0) + m.monto; else porMedio[m.metodo || 'otro'] = (porMedio[m.metodo || 'otro'] || 0) + m.monto; });
  document.getElementById('ctMedios').innerHTML = barras(porMedio, 'v', q => CT_METODOS[q] || q);
  document.getElementById('ctCats').innerHTML = barras(porCat, 'g', q => ctCatNombre('gasto', q));
  // Gráfica: por día (hasta ~2 meses) o por mes
  const porMes = (r.fin - r.ini) / 864e5 > 62, grupos = {}, llaves = [];
  const clave = t => { const d = new Date(t); return porMes ? d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') : ctDia(d); };
  x.mov.forEach(m => { const g = grupos[clave(m.fecha)] || (grupos[clave(m.fecha)] = { in: 0, out: 0 }); if(m.tipo === 'gasto') g.out += m.monto; else g.in += m.monto; });
  if(porMes){ const d = new Date(r.ini); while(d.getTime() < r.fin){ llaves.push(clave(d)); d.setMonth(d.getMonth() + 1); } }
  else { for(let t = r.ini; t < r.fin; t += 864e5) llaves.push(clave(t)); }
  const mx = Math.max(1, ...llaves.map(q => Math.max((grupos[q] || {}).in || 0, (grupos[q] || {}).out || 0)));
  const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  document.getElementById('ctGrafica').innerHTML = x.mov.length ? '<div class="ct-chart">' + llaves.map(q => { const g = grupos[q] || { in: 0, out: 0 }; const et = porMes ? MES[parseInt(q.slice(5), 10) - 1] : String(parseInt(q.slice(8), 10)); return '<div class="ct-col" title="' + q + ': entró ' + ctFmt(g.in) + ', gastos ' + ctFmt(g.out) + '"><div class="bs"><i style="height:' + (g.in / mx * 120) + 'px"></i><i class="g" style="height:' + (g.out / mx * 120) + 'px"></i></div><small>' + et + '</small></div>'; }).join('') + '</div><div class="ct-leyenda"><span><i style="background:var(--paid)"></i>Entradas</span><span><i style="background:var(--brick)"></i>Gastos</span></div>' : '<div class="empty-note">Todavía no hay movimientos en este periodo.</div>';
  { const ch = document.querySelector('#ctGrafica .ct-chart'); if(ch) ch.scrollLeft = ch.scrollWidth; }   // se ven primero los días más recientes
  // Movimientos: las ventas se agrupan por día para no llenar la lista
  const filas = [], ventasDia = {};
  x.mov.forEach(m => { if(m.tipo === 'venta'){ const kk = ctDia(m.fecha); const v = ventasDia[kk] || (ventasDia[kk] = { monto: 0, n: 0 }); v.monto += m.monto; v.n++; } else filas.push(m); });
  Object.keys(ventasDia).forEach(kk => filas.push({ tipo: 'venta', monto: ventasDia[kk].monto, fecha: new Date(kk + 'T23:00').getTime(), desc: 'Ventas cobradas del día', sub: ventasDia[kk].n + (ventasDia[kk].n === 1 ? ' pago' : ' pagos') }));
  filas.sort((a, b) => b.fecha - a.fecha);
  const lista = document.getElementById('ctLista');
  lista.innerHTML = filas.length ? '' : '<div class="empty-note">Sin movimientos en este periodo.</div>';
  filas.slice(0, 300).forEach(m => {
    const d = document.createElement('div'); d.className = 'ct-mov';
    const ic = m.tipo === 'venta' ? '🧾' : m.tipo === 'ingreso' ? '💰' : (ctCatNombre('gasto', m.cat).split(' ')[0] || '💸');
    const med = m.metodo && m.metodo !== 'otro' && CT_METODOS[m.metodo] ? ' · ' + CT_METODOS[m.metodo].replace(/^\S+\s/, '') : '';
    const sub = new Date(m.fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) + ' · ' + (m.sub || (ctCatNombre(m.tipo, m.cat).replace(/^\S+\s/, '') + med + (m.auto ? ' · automático' : '')));
    d.innerHTML = '<span class="ic">' + ic + '</span><span class="tx"><b></b><small></small></span><span class="vl ' + (m.tipo === 'gasto' ? 'out' : 'in') + '">' + (m.tipo === 'gasto' ? '−' : '+') + ctFmt(m.monto) + '</span>';
    d.querySelector('b').textContent = m.desc; d.querySelector('small').textContent = sub;
    if(m.adj){
      const ver = document.createElement('button'); ver.type = 'button'; ver.className = 'btn-ghost'; ver.textContent = '📎'; ver.title = 'Ver el recibo';
      ver.onclick = () => window.ctVerRecibo && window.ctVerRecibo(m.id, m.desc);
      d.appendChild(ver);
    }
    if(m.id){
      const del = document.createElement('button'); del.type = 'button'; del.className = 'btn-ghost'; del.textContent = '🗑'; del.title = 'Borrar este movimiento';
      del.onclick = async () => {
        const ok = await showConfirm({ title: '¿Borrar este movimiento?', message: m.desc + ' · ' + ctFmt(m.monto), confirmText: 'Sí, borrar', icon: '🗑️' });
        if(!ok) return;
        data.contab = (data.contab || []).filter(g => g.id !== m.id); saveData(); if(window.ctReciboBorrar) window.ctReciboBorrar(m.id); renderConta(); showToast('Movimiento borrado.');
      };
      d.appendChild(del);
    }
    lista.appendChild(d);
  });
  ctCsvData = { filas: x.mov, titulo: r.titulo };
}
function ctPintarCats(){
  const sel = document.getElementById('ctCat'); if(!sel) return;
  sel.innerHTML = (ctTipo === 'gasto' ? ctCatsGasto() : CT_CATS[ctTipo]).map(c => '<option value="' + c[0] + '">' + c[1] + '</option>').join('');
  document.querySelectorAll('#ctTipo button').forEach(b => b.classList.toggle('on', b.dataset.t === ctTipo));
}
function iniConta(){
  if(!document.getElementById('ctPeriodos')) return;
  document.querySelectorAll('#ctPeriodos button').forEach(b => b.onclick = () => { ctPeriodo = b.dataset.p; renderConta(); });
  ['ctDesde', 'ctHasta'].forEach(id => document.getElementById(id).onchange = renderConta);
  document.querySelectorAll('#ctTipo button').forEach(b => b.onclick = () => { ctTipo = b.dataset.t; ctPintarCats(); });
  ctPintarCats();
  document.getElementById('ctFecha').value = ctDia(Date.now());
  document.getElementById('ctGuardar').onclick = () => {
    const monto = Math.round(parseFloat(document.getElementById('ctMonto').value));
    if(!(monto > 0)){ showToast('⚠️ Escribe el valor.'); return; }
    data.contab = Array.isArray(data.contab) ? data.contab : [];
    const nuevoId = 'ct' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), adj = window.ctAdjPendiente || null;
    data.contab.unshift({ id: nuevoId, adj: !!adj, tipo: ctTipo, cat: document.getElementById('ctCat').value, monto, fecha: document.getElementById('ctFecha').value || ctDia(Date.now()), metodo: document.getElementById('ctMetodo').value, nota: document.getElementById('ctNota').value.trim(), by: authUser || '', at: Date.now() });
    saveData();
    if(adj && window.ctReciboGuardar){ window.ctReciboGuardar(nuevoId, adj); window.ctAdjPendiente = null; const ab = document.getElementById('ctAdjBtn'); if(ab) ab.textContent = '📎 Adjuntar recibo o factura'; }
    document.getElementById('ctMonto').value = ''; document.getElementById('ctNota').value = '';
    showToast('✅ ' + (ctTipo === 'gasto' ? 'Gasto' : 'Ingreso') + ' de ' + ctFmt(monto) + ' guardado.');
    renderConta();
  };
  document.getElementById('ctCsv').onclick = () => {
    if(!ctCsvData || !ctCsvData.filas.length){ showToast('No hay movimientos para descargar.'); return; }
    const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const filas = [['Fecha', 'Tipo', 'Categoría', 'Detalle', 'Medio de pago', 'Entrada', 'Salida']].concat(ctCsvData.filas.slice().reverse().map(m => [
      new Date(m.fecha).toLocaleString('es-CO'), m.tipo === 'venta' ? 'Venta' : m.tipo === 'ingreso' ? 'Otro ingreso' : 'Gasto',
      m.tipo === 'venta' ? 'Ventas' : ctCatNombre(m.tipo, m.cat).replace(/^\S+\s/, ''), m.desc, (CT_METODOS[m.metodo] || '').replace(/^\S+\s/, ''),
      m.tipo === 'gasto' ? '' : Math.round(m.monto), m.tipo === 'gasto' ? Math.round(m.monto) : '']));
    const csv = '﻿' + filas.map(f => f.map(q).join(';')).join('\r\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'contabilidad-' + String(data.businessName || 'negocio').replace(/[^\w]+/g, '-') + '-' + ctDia(Date.now()) + '.csv';
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    showToast('⬇️ Descargado: ábrelo con Excel o Google Sheets.');
  };
}

/* ---------- Ajustes → App de meseros ---------- */
function iniMeseros(){
  const sw = document.getElementById('mesOn'); if(!sw || !vm().mCfg) return;
  const pintar = () => {
    const c = vm().mCfg(), on = !!c.on;
    sw.checked = on;
    document.getElementById('mesBox').hidden = !on;
    document.getElementById('mesLink').value = vm().mUrl() || 'Abre ORDEVA desde su dirección https para tener el link de meseros.';
    const live = vm().qCfg().live;
    document.getElementById('mesEstado').textContent = !on ? 'Apagada.' : live ? '🟢 Activa: los pedidos de los meseros llegan a este celular.' : '🟠 Activa, pero los pedidos en vivo están apagados (Ajustes → Pedidos, QR y caja): enciéndelos para recibirlos.';
    const v = vm().mVistos(), ks = Object.keys(v).sort((a, b) => v[b] - v[a]);
    document.getElementById('mesVistos').innerHTML = ks.length ? '<b>Meseros conectados:</b> ' + ks.map(k => { const min = Math.round((Date.now() - v[k]) / 60000); return invEsc(k) + ' (' + (min < 2 ? 'ahora' : min < 60 ? 'hace ' + min + ' min' : new Date(v[k]).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })) + ')'; }).join(' · ') : 'Todavía no se ha conectado ningún mesero.';
  };
  sw.onchange = () => { const c = vm().mCfg(); c.on = sw.checked; SS('vito_meseros', c); vm().reconectarPedidos(); if(c.on) vm().mPublicar(true); pintar(); };
  document.getElementById('mesCopy').onclick = () => { const u = vm().mUrl(); if(!u) return; (navigator.clipboard ? navigator.clipboard.writeText(u) : Promise.reject()).then(() => showToast('📋 Link de meseros copiado.'), () => { document.getElementById('mesLink').select(); showToast('Copia el link a mano.'); }); };
  document.getElementById('mesWa').onclick = () => { const u = vm().mUrl(); if(!u) return; window.open('https://wa.me/?text=' + encodeURIComponent('🧑‍🍳 App de meseros de ' + ((data && data.businessName) || 'ORDEVA') + ': ábrela en Chrome y agrégala a tu pantalla principal.\n' + u), '_blank'); };
  document.getElementById('mesNew').onclick = async () => {
    const ok = await showConfirm({ title: '¿Crear un link nuevo?', message: 'El link anterior deja de funcionar: tendrás que mandarles el nuevo a los meseros.', confirmText: 'Sí, crear', icon: '🔗' });
    if(!ok) return;
    const c = vm().mCfg(); delete c.code; c.vistos = {}; SS('vito_meseros', c); vm().mCfg(); vm().reconectarPedidos(); vm().mPublicar(true); pintar();
    showToast('🔗 Link nuevo creado. Mándaselo a tus meseros.');
  };
  pintar();
  setInterval(pintar, 30000);
}

/* ---------- Autorreparación: ORDEVA detecta y corrige errores ----------
   Todos los errores de la app quedan registrados con un código (ver el
   <script> del <head>). ORDEVA aplica reparaciones seguras y probadas (nunca
   borra ventas, cuentas ni productos) y explica en palabras sencillas lo
   que no se puede arreglar desde el teléfono. */
function mesoraErrores(){
  let l = []; try{ l = JSON.parse(localStorage.getItem('vito_errlog') || '[]') || []; }catch(e){}
  if(!l.length && Array.isArray(window.__mesoraErrMem)) l = window.__mesoraErrMem;
  return l;
}
function mesoraMarcarVistos(){
  const l = mesoraErrores().map(x => Object.assign(x, { visto: true }));
  try{ localStorage.setItem('vito_errlog', JSON.stringify(l.slice(-15))); }catch(e){}
  window.__mesoraErrMem = l;
}
function mesoraExplicar(e){
  const m = String(e.msg || '');
  if(/quota|QuotaExceeded|exceeded the quota|memoria.*llena/i.test(m)) return 'la memoria de la app se llenó y no se podía guardar.';
  if(/Failed to fetch|NetworkError|Load failed|network|sin internet|No hay conexión/i.test(m)) return 'se cortó el internet un momento (no se perdió nada).';
  if(/No cargó un componente/i.test(m)) return 'no cargó una parte de la app (casi siempre por el internet).';
  if(/API key|NO_API_KEY|clave/i.test(m)) return 'hay un problema con la clave de la IA.';
  if(/JSON|Unexpected token|Unexpected end/i.test(m)) return 'había un dato guardado dañado.';
  if(/Cannot read|Cannot set|undefined|null|is not a function|is not defined|not iterable/i.test(m)) return 'una pantalla intentó usar un dato que faltaba o estaba dañado.';
  if(/No se pudo guardar/i.test(m)) return 'no se pudo guardar un cambio.';
  if(/fotos?/i.test(m)) return 'hubo un problema con las fotos de los productos.';
  return 'falló una parte de la app.';
}
function mesoraLiberarEspacio(){
  const hecho = [];
  // 1.51.0: los puntos de restauración y los comprobantes se pasan al almacén grande del celular (IndexedDB), sin borrarlos.
  if(window.indexedDB && typeof autoBackupPoints === 'function'){
    try{ if(localStorage.getItem('bar-autobk-points')){ autoBackupPoints(); hecho.push('Pasé los puntos de restauración al almacén grande del celular (liberé espacio sin borrar nada).'); } }catch(e){}
    try{ if(Object.keys(localStorage).some(k => k.indexOf(RCPT_PREFIX) === 0)){ rcptMudar(); hecho.push('Pasé las fotos de los comprobantes al almacén grande del celular.'); } }catch(e){}
  } else try{
    let pts = JSON.parse(localStorage.getItem('bar-autobk-points') || '[]') || [];
    if(pts.length > 2){ localStorage.setItem('bar-autobk-points', JSON.stringify(pts.slice(0, 2))); hecho.push('Dejé solo los 2 puntos de restauración más recientes (liberé espacio).'); }
  }catch(e){ try{ localStorage.removeItem('bar-autobk-points'); hecho.push('Borré los puntos de restauración automáticos, que estaban dañados.'); }catch(x){} }
  try{
    const rc = Object.keys(localStorage).filter(k => k.indexOf(RCPT_PREFIX) === 0).sort();
    if(rc.length > 20){ rc.slice(0, rc.length - 20).forEach(k => localStorage.removeItem(k)); hecho.push('Borré ' + (rc.length - 20) + ' fotos de comprobantes viejos (se quedan los 20 últimos).'); }
  }catch(e){}
  try{
    const l = vm().cola(), keep = l.filter(x => !x.done || Date.now() - x.ts < 864e5);
    if(keep.length < l.length){ SS('vito_cola', keep); hecho.push('Limpié ' + (l.length - keep.length) + ' canciones viejas de la cola.'); }
  }catch(e){}
  try{ if(asisMsgs.length > 40){ asisMsgs = asisMsgs.slice(-20); asisSave(); } }catch(e){}
  return hecho;
}
function mesoraRepararDatos(){
  if(typeof data === 'undefined' || !data) return [];
  const hecho = []; let n = 0;
  const num = v => { const x = Number(v); return isFinite(x) ? x : null; };
  ['products', 'history', 'categories', 'closures', 'casos', 'clientesFrecuentes'].forEach(k => { if(!Array.isArray(data[k])){ data[k] = []; n++; } });
  if(!data.tables || typeof data.tables !== 'object'){ data.tables = {}; n++; }
  const antes = data.products.length, ids = new Set();
  data.products = data.products.filter(p => p && typeof p === 'object' && String(p.name || '').trim());
  if(data.products.length < antes) hecho.push('Quité ' + (antes - data.products.length) + ' producto(s) vacío(s) o dañado(s).');
  data.products.forEach((p, i) => {
    if(!p.id || ids.has(p.id)){ p.id = Date.now().toString(36) + i + Math.random().toString(36).slice(2, 5); n++; }
    ids.add(p.id);
    if(num(p.price) === null || p.price < 0){ p.price = 0; n++; } else if(typeof p.price !== 'number'){ p.price = num(p.price); n++; }
    ['cost', 'stock', 'minStock'].forEach(k => { if(p[k] != null && p[k] !== '' && num(p[k]) === null){ p[k] = null; n++; } else if(typeof p[k] === 'string' && p[k] !== ''){ p[k] = num(p[k]); n++; } });
    if(p.categoryId && !data.categories.some(c => c && c.id === p.categoryId)){ p.categoryId = null; n++; }
    // Con la nube, que la foto no esté en ESTE equipo no significa que no exista (está en otro equipo o por bajar).
    if(p.foto && !fotosCache[p.id] && fotosListas && !(window.ventoNube && window.ventoNube.enNube && window.ventoNube.enNube())){ delete p.foto; n++; }
  });
  Object.keys(data.tables).forEach(k => {
    let t = data.tables[k];
    if(!t || typeof t !== 'object'){ data.tables[k] = t = { items: [], people: [] }; n++; }
    if(!Array.isArray(t.items)){ t.items = []; n++; }
    if(!Array.isArray(t.people)){ t.people = []; n++; }
    const a = t.items.length;
    t.items = t.items.filter(it => it && typeof it === 'object');
    t.items.forEach(it => {
      if(num(it.qty) === null || it.qty <= 0){ it.qty = 1; n++; }
      if(num(it.price) === null){ it.price = 0; n++; }
      if(it.personId === undefined) it.personId = null;
    });
    n += a - t.items.length;
  });
  const hb = data.history.length;
  data.history = data.history.filter(h => h && typeof h === 'object');
  data.history.forEach(h => { if(!Array.isArray(h.items)){ h.items = []; n++; } if(num(h.total) === null){ h.total = 0; n++; } });
  n += hb - data.history.length;
  if(n) hecho.push('Corregí ' + n + ' dato(s) dañado(s) o incompleto(s) en mesas, productos o historial (sin borrar ventas).');
  if(n || hecho.length) saveData();
  return hecho;
}
function mesoraReparar(opts){
  opts = opts || {};
  const hecho = [];
  const errs = mesoraErrores().filter(x => !x.visto);
  // 1) Memoria llena: se prueba escribir; si no se puede, se libera espacio.
  let lleno = errs.some(x => /quota|llena/i.test(x.msg));
  try{ localStorage.setItem('vito_probe', 'x'.repeat(200000)); localStorage.removeItem('vito_probe'); }catch(e){ lleno = true; try{ localStorage.removeItem('vito_probe'); }catch(x){} }
  if(lleno){ hecho.push(...mesoraLiberarEspacio()); if(hecho.length) try{ saveData(); }catch(e){} }
  // 2) Datos dañados
  try{ hecho.push(...mesoraRepararDatos()); }catch(e){ mesoraLogError('reparar', 'Reparación de datos: ' + e.message, ''); }
  // 3) Estados trabados
  try{ if(asisBusy && !opts.enChat){ asisBusy = false; hecho.push('Destrabé el chat de ORDEVA.'); } }catch(e){}
  try{ if(document.body.style.overflow === 'hidden' && !document.querySelector('.overlay.show, #carta:not([hidden])')){ document.body.style.overflow = ''; hecho.push('Destrabé la pantalla (no dejaba bajar).'); } }catch(e){}
  // 4) IA: modelo que ya no existe → se vuelve al de fábrica
  if(errs.some(x => /modelo no está disponible|model/i.test(x.msg) && /not found|no está disponible|does not exist/i.test(x.msg))){
    try{ setGeminiModel(''); setOpenAIModel(''); hecho.push('Volví al modelo de IA de fábrica (el que tenías ya no existe).'); }catch(e){}
  }
  // 5) YouTube: sesión vencida
  try{ const t = JSON.parse(localStorage.getItem('vito_ytok') || sessionStorage.getItem('vito_ytok') || 'null'); if(t && !(t.exp > Date.now())){ localStorage.removeItem('vito_ytok'); sessionStorage.removeItem('vito_ytok'); hecho.push('Borré la conexión vencida con YouTube; reconéctala en Música → «Reconectar».'); } }catch(e){ try{ localStorage.removeItem('vito_ytok'); sessionStorage.removeItem('vito_ytok'); }catch(x){} }
  // 6) Volver a dibujar las pantallas
  try{ renderAll(); }catch(e){ mesoraLogError('reparar', 'Al redibujar: ' + e.message, 'renderAll'); hecho.push('⚠️ Una pantalla sigue fallando al dibujarse; recarga la app.'); }
  return hecho;
}
async function mesoraDiagnosticoChat(userText){
  const pend = mesoraErrores().filter(x => !x.visto).slice(-6);
  asisBusy = true; asisRender();
  let hechos = [];
  try{ hechos = mesoraReparar({ enChat: true }); }catch(e){}
  let txt = pend.length
    ? 'Revisé la app y encontré ' + (pend.length === 1 ? 'este problema' : 'estos problemas') + ':\n' + pend.map(e => '• ' + mesoraExplicar(e) + (e.n > 1 ? ' (' + e.n + ' veces)' : '')).join('\n')
    : 'Revisé la app y no encontré errores registrados.';
  txt += '\n\nLo que hice:\n' + (hechos.length ? hechos.map(h => (h.charAt(0) === '⚠' ? '' : '✅ ') + h).join('\n') : '✅ Revisé tus datos, la memoria y las pantallas: todo está en orden.');
  if(hasAIKey()){
    try{
      const prompt = 'Eres ORDEVA, el asistente de la app ORDEVA (cuentas de mesas de un negocio en Colombia). Hablas con el dueño, que no sabe de tecnología. ' +
        'La persona dijo: "' + String(userText || '').slice(0, 300) + '". ' +
        'Errores técnicos registrados en la app: ' + JSON.stringify(pend.map(e => ({ tipo: e.tipo, mensaje: e.msg, donde: e.donde, veces: e.n }))) + '. ' +
        'Reparaciones que la app YA hizo sola: ' + JSON.stringify(hechos) + '. ' +
        'En máximo 4 frases cortas y sencillas, sin palabras técnicas ni markdown: di qué pasó y qué debe hacer la persona si el problema sigue ' +
        '(por ejemplo: recargar la app, revisar el internet, conectar la IA en ⚙️ Configurar IA, o escribir a soporte en Ajustes → Guía y soporte; el detalle técnico le llega solo a ORDEVA). Nunca muestres códigos de error ni nombres técnicos. No inventes nada que no esté en los datos.';
      const r = await aiText({ prompt, maxOutputTokens: 260, timeoutMs: 12000, retries: 1, maxMs: ASIS_MAX_MS });
      if(r && r.trim()) txt += '\n\n' + r.trim().replace(/\*\*/g, '');
    }catch(e){}
  }
  if(pend.length) txt += '\n\nSi vuelve a pasar, dime "arregla los errores" o escríbenos a soporte: el detalle técnico ya le llegó a ORDEVA.';
  mesoraMarcarVistos(); mesoraPill(false);
  asisBusy = false;
  asisBot(txt, { quick: ['Recargar la app', '¿Qué sabes hacer?'] });
}

// Aviso flotante cuando aparece un error, con reparación automática inmediata.
let mesoraAutoT = 0;
function mesoraPill(show, cod){
  let p = document.getElementById('mesoraFixPill');
  if(!p){
    p = document.createElement('button'); p.type = 'button'; p.id = 'mesoraFixPill';
    p.onclick = () => { mesoraPill(false); asisOpen(); asisAsk('Arregla los errores'); };
    document.body.appendChild(p);
  }
  if(show){ p.innerHTML = ''; p.append(mesiEl(), document.createTextNode('Algo falló · Toca y lo arreglo')); }   // el código lo ve solo el administrador de ORDEVA
  p.classList.toggle('show', !!show);
}
window.addEventListener('mesora-error', ev => {
  if(ev.detail && /No cargó un componente/.test(ev.detail.msg)) return;   // sin internet: nada que reparar
  const now = Date.now();
  if(now - mesoraAutoT > 30000){
    mesoraAutoT = now;
    setTimeout(() => { try{ const h = mesoraRepararDatos(); if(h.length) showToast('🛠️ ORDEVA corrigió datos dañados automáticamente.', 4000); }catch(e){} }, 500);
  }
  if(!document.getElementById('asisOverlay').classList.contains('show')) mesoraPill(true, ev.detail && ev.detail.cod);
});

/* ---------- Arranque ---------- */
let fotosListas = false;
(function arrancar(){
  if(typeof data === 'undefined' || !data || !Array.isArray(data.products)){ setTimeout(arrancar, 300); return; }
  try{ iniFotosProductos(); }catch(e){ mesoraLogError('arranque', 'Fotos: ' + e.message, ''); }
  try{ iniCast(); }catch(e){ mesoraLogError('arranque', 'Transmisión: ' + e.message, ''); }
  try{ iniLounge(); }catch(e){ mesoraLogError('arranque', 'YouTube del TV: ' + e.message, ''); }
  try{ iniMeseros(); }catch(e){ mesoraLogError('arranque', 'Meseros: ' + e.message, ''); }
  try{ iniConta(); }catch(e){ mesoraLogError('arranque', 'Contabilidad: ' + e.message, ''); }
  try{ aplicarModoMesero(); }catch(e){}
  try{ aplicarMusica(); }catch(e){}
  try{ aplicarVocabulario(); }catch(e){}
  try{ domisBadge(); }catch(e){}
  try{ aplicarDomicilios(); }catch(e){}
  try{ iniDomicilios(); }catch(e){ mesoraLogError('arranque', 'Domicilios en línea: ' + e.message, ''); }
  try{ iniDomIa(); }catch(e){ mesoraLogError('arranque', 'Pedido escrito con IA: ' + e.message, ''); }
  licCargar().then(licDesdeLink).catch(e => mesoraLogError('arranque', 'Licencia: ' + e.message, ''));
  window.addEventListener('hashchange', () => { licDesdeLink(); });   // link abierto con ORDEVA ya abierta
  fotosCargar().then(() => { fotosListas = true; try{ renderProductos(); }catch(e){} publicarFotosCarta(); });
  setInterval(() => { try{ publicarFotosCarta(); }catch(e){} }, 5 * 60000);
  const pend = mesoraErrores().filter(x => !x.visto && x.tipo !== 'recurso' && Date.now() - x.t < 864e5);
  if(pend.length) mesoraPill(true, pend[pend.length - 1].cod);
})();
