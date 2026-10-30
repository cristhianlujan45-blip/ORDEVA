/* ORDEVA · app/16-pago-dueno-sube.js — antes estaba dentro de index.html (línea 30606). Se carga en el mismo lugar y orden. */
/* ==================== 📱 QR de pago ====================
   El dueño sube la captura de su QR de cobro (Nequi, Bancolombia, Daviplata, Bre-B). Se lee el
   QR y se vuelve a dibujar nítido y liviano (un mensaje a la app de pedidos no puede pasar de
   4 KB); si el celular no sabe leer QR, se usa la imagen en blanco y negro reducida. Viaja por
   el canal de fotos de la carta, así lo ven también los QR de mesa ya impresos. */
(function(){
  const $q = id => document.getElementById(id);
  const QP = () => (typeof data !== 'undefined' && data && data.qrPago) || null;   // 1.65.10: sin «data» (cerrando sesión, cambiando de negocio) no se cae   // solo leer: antes ponía «qrPago: null» en los datos de todos los negocios sin QR
  const cargarImg = src => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
  const leerArchivo = f => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(f); });
  function canvasDe(img, lado){
    const k = Math.min(1, lado / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
    const c = document.createElement('canvas'); c.width = Math.round((img.naturalWidth || img.width) * k); c.height = Math.round((img.naturalHeight || img.height) * k);
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height); return c;
  }
  function blancoNegro(c){
    const x = c.getContext('2d'), d = x.getImageData(0, 0, c.width, c.height), p = d.data;
    for(let i = 0; i < p.length; i += 4){ const v = (p[i] * .3 + p[i + 1] * .59 + p[i + 2] * .11) < 140 ? 0 : 255; p[i] = p[i + 1] = p[i + 2] = v; p[i + 3] = 255; }
    x.putImageData(d, 0, 0); return c;
  }
  // Lector de QR de respaldo (iPhone y navegadores sin lector propio): se carga solo si hace falta.
  function cargarJsQR(){
    if(window.jsQR) return Promise.resolve(window.jsQR);
    return new Promise(ok => { const sc = document.createElement('script'); sc.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js'; sc.onload = () => ok(window.jsQR || null); sc.onerror = () => ok(null); document.head.appendChild(sc); });
  }
  async function leerTexto(img){
    if('BarcodeDetector' in window){ try{ const r = await new BarcodeDetector({ formats: ['qr_code'] }).detect(img); if(r && r[0] && r[0].rawValue) return r[0].rawValue; }catch(e){} }
    const lib = await cargarJsQR(); if(!lib) return null;
    for(const lado of [1000, 700, 1400]){
      try{ const c = canvasDe(img, lado), d = c.getContext('2d').getImageData(0, 0, c.width, c.height), r = lib(d.data, c.width, c.height); if(r && r.data) return r.data; }catch(e){}
    }
    return null;
  }
  /* Del QR se manda solo el PATRÓN de cuadritos (1 bit por cuadrito, ~700 bytes aunque el QR sea
     largo) y la app de pedidos lo dibuja nítido. Es el mismo QR: la plata va al mismo lado. */
  function qrMatriz(txt){
    if(!window.QRCode) return null;
    const div = document.createElement('div');
    let q; try{ q = new QRCode(div, { text: txt, width: 64, height: 64, correctLevel: QRCode.CorrectLevel.M }); }catch(e){ return null; }
    const o = q && q._oQRCode; if(!o) return null;
    const n = o.getModuleCount(), bytes = new Uint8Array(Math.ceil(n * n / 8));
    for(let r = 0; r < n; r++) for(let k = 0; k < n; k++) if(o.isDark(r, k)){ const i = r * n + k; bytes[i >> 3] |= 128 >> (i & 7); }
    let bin = ''; bytes.forEach(v => bin += String.fromCharCode(v));
    return { s: n, m: btoa(bin) };
  }
  function matrizAImagen(mz, px){
    const n = mz.s, bin = atob(mz.m), mg = 4, c = document.createElement('canvas');
    c.width = c.height = (n + mg * 2) * px;
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.fillStyle = '#000';
    for(let i = 0; i < n * n; i++) if(bin.charCodeAt(i >> 3) & (128 >> (i & 7))) x.fillRect(((i % n) + mg) * px, (Math.floor(i / n) + mg) * px, px, px);
    return c.toDataURL('image/png');
  }
  async function qrLiviano(img){
    const txt = await leerTexto(img);
    if(txt){ const mz = qrMatriz(txt); if(mz && mz.m.length <= 3000) return { img: matrizAImagen(mz, 8), mz, txt }; }
    for(const lado of [240, 200, 170, 140, 110]){ const u = blancoNegro(canvasDe(img, lado)).toDataURL('image/png'); if(u.length <= 3600) return { img: u, txt }; }
    return null;
  }
  async function qpPublicar(forzar){
    const q = QP(), cfg = window.vitoQCfg ? window.vitoQCfg() : null;
    if(!cfg || !cfg.topic || !navigator.onLine) return;
    const k = q ? (q.mz ? q.mz.m.length : q.img.length) + '|' + q.tipo + '|' + q.llave : 'nada';
    const ult = (() => { try{ return JSON.parse(localStorage.getItem('mesora_qp_pub') || '{}'); }catch(e){ return {}; } })();
    if(!forzar && ult.k === k && Date.now() - ult.t < 10 * 36e5) return;
    const msg = q ? Object.assign({ n: '__qrpago__', q: q.tipo || '', l: (q.llave || '').slice(0, 60) }, q.mz ? { s: q.mz.s, m: q.mz.m } : { i: q.img }) : { n: '__qrpago__', i: '' };
    try{ const r = await fetch('https://canal.vento.local/' + cfg.topic + 'f', { method: 'POST', body: JSON.stringify(msg) }); if(r.ok) localStorage.setItem('mesora_qp_pub', JSON.stringify({ k, t: Date.now() })); }catch(e){}
  }
  function qpPintar(){
    if(!$q('qpSubir') || !data) return;
    const q = QP();
    $q('qpVista').hidden = !q; ['qpCompartir', 'qpBajar', 'qpQuitar'].forEach(i => $q(i).hidden = !q);
    $q('qpSubir').textContent = q ? '📷 Cambiar mi QR' : '📷 Subir mi QR';
    if(q){ $q('qpImg').src = q.orig || q.img; $q('qpInfo').textContent = (q.tipo || 'QR de pago') + (q.llave ? ' · ' + q.llave : '') + (q.txt ? ' · ✅ leído y listo' : ' · imagen'); $q('qpTipo').value = q.tipo || 'Nequi'; $q('qpLlave').value = q.llave || ''; }
  }
  async function qpArchivoDe(q){
    const b = await (await fetch(q.orig || q.img)).blob();
    return new File([b], 'qr-pago-' + (q.tipo || 'mesora').toLowerCase() + (b.type === 'image/png' ? '.png' : '.jpg'), { type: b.type });
  }
  function qpIni(){
    if(!$q('qpSubir')) return;
    $q('qpSubir').onclick = () => $q('qpArchivo').click();
    $q('qpArchivo').onchange = async e => {
      const f = e.target.files[0]; e.target.value = ''; if(!f) return;
      showToast('Leyendo tu QR…');
      try{
        const url = await leerArchivo(f), img = await cargarImg(url);
        const liv = await qrLiviano(img);
        if(!liv) return showToast('⚠️ La imagen tiene mucho detalle. Recórtala para que se vea solo el QR y súbela otra vez.', 8000);
        const orig = canvasDe(img, 700).toDataURL('image/jpeg', 0.85);
        const tipo = /nequi/i.test(liv.txt || '') ? 'Nequi' : /bancolombia/i.test(liv.txt || '') ? 'Bancolombia' : /davi/i.test(liv.txt || '') ? 'Daviplata' : $q('qpTipo').value;
        data.qrPago = { img: liv.img, mz: liv.mz || null, orig: liv.mz ? liv.img : orig, txt: liv.txt || '', tipo, llave: $q('qpLlave').value.trim(), t: Date.now() };
        saveData(); qpPintar(); qpPublicar(true);
        showToast('✅ QR de pago listo. Tus clientes ya lo ven en la app de pedidos (Mi cuenta).', 7000);
        try{ window.mesoraCelebrar && window.mesoraCelebrar(['📱', '💜', '✨']); }catch(x){}
      }catch(err){ showToast('⚠️ No pude abrir esa imagen.'); }
    };
    $q('qpTipo').onchange = () => { const q = QP(); if(q){ q.tipo = $q('qpTipo').value; saveData(); qpPintar(); qpPublicar(true); } };
    $q('qpLlave').onchange = () => { const q = QP(); if(q){ q.llave = $q('qpLlave').value.trim(); saveData(); qpPintar(); qpPublicar(true); } };
    $q('qpQuitar').onclick = () => { if(!confirm('¿Quitar tu QR de pago? Tus clientes dejarán de verlo.')) return; data.qrPago = null; saveData(); qpPintar(); qpPublicar(true); };
    $q('qpBajar').onclick = async () => { const q = QP(); if(!q) return; const a = document.createElement('a'); a.href = q.orig || q.img; a.download = 'qr-pago-' + (q.tipo || 'mesora').toLowerCase() + '.jpg'; document.body.appendChild(a); a.click(); a.remove(); };
    $q('qpCompartir').onclick = async () => {
      const q = QP(); if(!q) return;
      const texto = 'Paga aquí' + (data.businessName ? ' a ' + data.businessName : '') + ' con ' + (q.tipo || 'tu app del banco') + ': abre tu app → Pagar con QR → elige esta imagen.' + (q.llave ? ' Llave / número: ' + q.llave : '');
      try{ const f = await qpArchivoDe(q); if(navigator.canShare && navigator.canShare({ files: [f] })){ await navigator.share({ files: [f], text: texto, title: 'QR de pago' }); return; } }catch(e){ if(e && e.name === 'AbortError') return; }
      $q('qpBajar').onclick(); showToast('💾 Se descargó la imagen: envíala por WhatsApp desde tu galería.', 7000);
    };
    qpPintar();
  }
  window.qrPagoPublicar = qpPublicar;
  window.leerTextoQR = leerTexto;   // reutilizado por «Fijar mis QR impresos» (subir foto del QR pegado en la mesa)
  const t0 = setInterval(() => { if(typeof data !== 'undefined' && data){ clearInterval(t0); qpIni(); qpPublicar(false); } }, 1000);
  setInterval(() => { if(typeof data !== 'undefined' && data) qpPublicar(false); }, 30 * 60000);
})();
