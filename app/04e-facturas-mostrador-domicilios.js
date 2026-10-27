/* ORDEVA · app/04e-facturas-mostrador-domicilios.js — parte 5 de 8 de app/04-principal.js (antes dentro de index.html). Se carga en el mismo lugar y orden. */
const FI_MAX_LADO = 2000, FI_MAX_BYTES = 15 * 1024 * 1024;
function fiCargarImagen(file){
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), im = new Image();
    im.onload = () => { URL.revokeObjectURL(url); res(im); };
    im.onerror = () => { URL.revokeObjectURL(url); rej(new Error('No se pudo abrir la imagen.')); };
    im.src = url;
  });
}
function fiOtsu(g){
  const h = new Uint32Array(256); for(let p = 0; p < g.length; p++) h[g[p] | 0]++;
  const tot = g.length; let sum = 0; for(let i = 0; i < 256; i++) sum += i * h[i];
  let sB = 0, wB = 0, max = 0, th = 128;
  for(let i = 0; i < 256; i++){ wB += h[i]; if(!wB) continue; const wF = tot - wB; if(!wF) break; sB += i * h[i];
    const mB = sB / wB, mF = (sum - sB) / wF, v = wB * wF * (mB - mF) * (mB - mF); if(v > max){ max = v; th = i; } }
  return th;
}
// Las 4 esquinas del papel en una versión chica de la foto, o null si no hay un papel claro.
function fiEsquinasPapel(img){
  const S = 360, k = Math.min(1, S / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * k)), h = Math.max(1, Math.round(img.height * k));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const cx = c.getContext('2d', { willReadFrequently: true }); cx.drawImage(img, 0, 0, w, h);
  const d = cx.getImageData(0, 0, w, h).data, g = new Uint8Array(w * h);
  for(let i = 0, p = 0; p < g.length; i += 4, p++) g[p] = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0;
  const th = fiOtsu(g), vis = new Uint8Array(w * h);
  let mejor = null;
  for(let s = 0; s < g.length; s++){
    if(vis[s] || g[s] < th) continue;
    const pila = [s]; vis[s] = 1; const pts = [];
    while(pila.length){ const q = pila.pop(); pts.push(q); const x = q % w, y = (q / w) | 0;
      [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]].forEach(([a, b]) => { if(a >= 0 && b >= 0 && a < w && b < h){ const t = b * w + a; if(!vis[t] && g[t] >= th){ vis[t] = 1; pila.push(t); } } }); }
    if(!mejor || pts.length > mejor.length) mejor = pts;
  }
  if(!mejor) return null;
  const frac = mejor.length / (w * h);
  if(frac < 0.22 || frac > 0.94) return null;          // casi toda la foto ya es papel, o no se ve el papel
  let tl, tr, br, bl, a1 = Infinity, a2 = -Infinity, a3 = -Infinity, a4 = Infinity;
  mejor.forEach(q => { const x = q % w, y = (q / w) | 0, s1 = x + y, s2 = x - y;
    if(s1 < a1){ a1 = s1; tl = [x, y]; } if(s1 > a2){ a2 = s1; br = [x, y]; } if(s2 > a3){ a3 = s2; tr = [x, y]; } if(s2 < a4){ a4 = s2; bl = [x, y]; } });
  const q = [tl, tr, br, bl].map(([x, y]) => [x / k, y / k]);
  // el cuadrilátero tiene que ser razonable (convexo y no muy chueco)
  const cruz = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const sg = [0, 1, 2, 3].map(i => Math.sign(cruz(q[i], q[(i + 1) % 4], q[(i + 2) % 4])));
  if(!sg.every(v => v === sg[0] && v !== 0)) return null;
  return q;
}
// Homografía de un rectángulo w×h hacia el cuadrilátero q (para leer cada punto de origen).
function fiHomografia(w, h, q){
  const src = [[0, 0], [w, 0], [w, h], [0, h]], A = [], B = [];
  for(let i = 0; i < 4; i++){ const [x, y] = src[i], [u, v] = q[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); B.push(u); A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); B.push(v); }
  for(let c = 0; c < 8; c++){                           // eliminación de Gauss
    let piv = c; for(let r = c + 1; r < 8; r++) if(Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    [A[c], A[piv]] = [A[piv], A[c]]; [B[c], B[piv]] = [B[piv], B[c]];
    for(let r = 0; r < 8; r++){ if(r === c) continue; const f = A[r][c] / A[c][c]; for(let k = c; k < 8; k++) A[r][k] -= f * A[c][k]; B[r] -= f * B[c]; }
  }
  return B.map((b, i) => b / A[i][i]);
}
/* Ángulo (en grados) de los renglones de texto, como un escáner: se prueban giros entre −8° y 8° y gana el que deja
   la tinta más concentrada en filas (renglones derechos). 0 si no hay una inclinación clara (o no hay texto). */
function fiAnguloTexto(g, w, h){
  const k = Math.min(1, 700 / Math.max(w, h)), sw = Math.max(1, Math.round(w * k)), sh = Math.max(1, Math.round(h * k));
  const xs = [], ys = [];
  for(let y = 0; y < sh; y++){ const fy = Math.min(h - 1, (y / k) | 0) * w; for(let x = 0; x < sw; x++){ if(g[fy + Math.min(w - 1, (x / k) | 0)] < 110){ xs.push(x - sw / 2); ys.push(y - sh / 2); } } }
  const n = xs.length; if(n < 300 || n > sw * sh * 0.5) return 0;
  const paso = Math.max(1, Math.floor(n / 40000)), alto = Math.ceil(Math.hypot(sw, sh)) + 4, bins = new Float64Array(alto);
  const puntaje = gr => {
    const a = gr * Math.PI / 180, si = Math.sin(a), co = Math.cos(a); bins.fill(0);
    for(let i = 0; i < n; i += paso){ const r = (-xs[i] * si + ys[i] * co + alto / 2) | 0; if(r >= 0 && r < alto) bins[r]++; }
    let t = 0; for(let i = 0; i < alto; i++) t += bins[i] * bins[i]; return t;
  };
  let mejor = 0, pm = puntaje(0); const p0 = pm;
  for(let a = -8; a <= 8; a += 0.5){ if(!a) continue; const v = puntaje(a); if(v > pm){ pm = v; mejor = a; } }
  for(let a = mejor - 0.4; a <= mejor + 0.41; a += 0.1){ const v = puntaje(a); if(v > pm){ pm = v; mejor = a; } }
  return (pm > p0 * 1.04 && Math.abs(mejor) >= 0.3) ? Math.round(mejor * 10) / 10 : 0;
}
/* Hacia dónde quedó la hoja (como CamScanner): 0, 90, 180 o 270 = cuánto hay que girarla (a la derecha) para que el texto
   quede derecho. Primero se ve si los renglones van acostados o parados (y qué tan torcidos); después si está al revés:
   las letras se apoyan alineadas abajo, y en texto en MAYÚSCULAS los puntos y comas («2.500», «S.A.S.») quedan abajo del
   renglón. seguro=false si no hay pistas claras (entonces no se gira: queda «↻ Girar» a mano). */
function fiOrientacion(g, w, h){
  const k = Math.min(1, 1200 / Math.max(w, h)), sw = Math.max(1, Math.round(w * k)), sh = Math.max(1, Math.round(h * k));
  const b = new Uint8Array(sw * sh), xs = [], ys = [];
  for(let y = 0; y < sh; y++){ const fy = Math.min(h - 1, (y / k) | 0) * w; for(let x = 0; x < sw; x++){ if(g[fy + Math.min(w - 1, (x / k) | 0)] < 140){ b[y * sw + x] = 1; xs.push(x - sw / 2); ys.push(y - sh / 2); } } }
  const n = xs.length;
  if(n < 400 || n > sw * sh * 0.45) return { giro: 0, seguro: false, razon: 'sin texto' };
  // 1. ¿Renglones acostados o parados, y qué tan torcidos? Se prueban giros (0° o 90°, ±8°) y gana el que deja más
  //    filas en blanco entre renglones (como cuando los renglones quedan derechos).
  const paso = Math.max(1, Math.floor(n / 60000)), L = Math.ceil(Math.hypot(sw, sh)) + 4, bins = new Int32Array(L);
  const huecos = th => {
    const a = th * Math.PI / 180, si = Math.sin(a), co = Math.cos(a); bins.fill(0);
    for(let i = 0; i < n; i += paso){ const r = (xs[i] * si + ys[i] * co + L / 2) | 0; if(r >= 0 && r < L) bins[r]++; }
    let i0 = 0; while(i0 < L && !bins[i0]) i0++; let i1 = L - 1; while(i1 > i0 && !bins[i1]) i1--;
    let bl = 0; for(let i = i0; i <= i1; i++) if(bins[i] === 0) bl++;
    return bl / Math.max(1, i1 - i0 + 1);
  };
  const junto = th => { huecos(th); let t = 0; for(let i = 0; i < L; i++) t += bins[i] * bins[i]; return t; };   // tinta concentrada en filas
  const mejorDe = base => { let m = { th: base, v: -1 }; for(let a = -8; a <= 8; a += 1){ const v = huecos(base + a); if(v > m.v) m = { th: base + a, v }; }
    let c = m.th, cj = junto(c); for(let a = m.th - 1; a <= m.th + 1.01; a += 0.1){ const v = junto(a); if(v > cj){ cj = v; c = a; } } m.th = c; return m; };
  const mh = mejorDe(0), mv = mejorDe(90);
  if(Math.abs(mh.v - mv.v) < 0.08 || Math.max(mh.v, mv.v) < 0.12) return { giro: 0, seguro: false, razon: 'sin renglones claros', mh, mv };
  const m = mh.v > mv.v ? mh : mv, base = m === mh ? 0 : 90;
  // 2. La hoja «enderezada» (girada base + torcido) para revisar cada renglón.
  const th = m.th * Math.PI / 180, co = Math.cos(th), si = Math.sin(th);
  const W = base ? sh : sw, H = base ? sw : sh, t = new Uint8Array(W * H);
  for(let Y = 0; Y < H; Y++) for(let X = 0; X < W; X++){
    const dx = X - W / 2, dy = Y - H / 2, x = Math.round(dx * co + dy * si + sw / 2), y = Math.round(-dx * si + dy * co + sh / 2);
    if(x >= 0 && y >= 0 && x < sw && y < sh && b[y * sw + x]) t[Y * W + X] = 1;
  }
  const P = new Float64Array(H); for(let Y = 0; Y < H; Y++){ let c = 0; for(let X = 0; X < W; X++) c += t[Y * W + X]; P[Y] = c; }
  const umbral = Math.max(1, W * 0.004), lineas = [];
  for(let i = 0; i < H;){
    if(P[i] <= umbral){ i++; continue; }
    let j = i; while(j < H && P[j] > umbral) j++;
    if(j - i >= 5 && j - i < H / 6){
      let pico = 0; for(let q = i; q < j; q++) pico = Math.max(pico, P[q]);
      if(pico < W * 0.85){ const tt = pico * 0.5; let ct = i, cb = j - 1; while(P[ct] < tt) ct++; while(P[cb] < tt) cb--; lineas.push({ y0: i, y1: j, ct, cb }); }
    }
    i = j;
  }
  if(lineas.length < 2) return { giro: 0, seguro: false, razon: 'pocos renglones' };
  // Pista 2 (texto en MAYÚSCULAS): puntos y comas («2.500», «S.A.S.») quedan abajo del renglón; las tildes, arriba.
  const lin = new Int32Array(H).fill(-1); lineas.forEach((l, q) => { for(let y = l.y0; y < l.y1; y++) lin[y] = q; });
  const vis = new Uint8Array(W * H), pila = []; let pAbajo = 0, pArriba = 0; const letras = lineas.map(() => []);
  for(let s = 0; s < W * H; s++){
    if(!t[s] || vis[s]) continue;
    vis[s] = 1; pila.push(s); let x0 = W, x1 = 0, y0 = H, y1 = 0, c = 0;
    while(pila.length){ const q = pila.pop(), x = q % W, y = (q / W) | 0; c++; if(x < x0) x0 = x; if(x > x1) x1 = x; if(y < y0) y0 = y; if(y > y1) y1 = y;
      if(x > 0 && t[q - 1] && !vis[q - 1]){ vis[q - 1] = 1; pila.push(q - 1); } if(x < W - 1 && t[q + 1] && !vis[q + 1]){ vis[q + 1] = 1; pila.push(q + 1); }
      if(y > 0 && t[q - W] && !vis[q - W]){ vis[q - W] = 1; pila.push(q - W); } if(y < H - 1 && t[q + W] && !vis[q + W]){ vis[q + W] = 1; pila.push(q + W); } }
    const cy = (y0 + y1) >> 1, li = lin[cy]; if(li < 0) continue;
    const l = lineas[li], alto = l.cb - l.ct + 1; if(alto < 4) continue;
    if(y1 - y0 + 1 >= alto * 0.6){ letras[li].push([y0, y1]); continue; }   // letras y números (para la pista 1)
    if(y1 - y0 + 1 > alto * 0.38 || x1 - x0 + 1 > alto * 0.45) continue;   // solo puntos, comas, tildes
    const pos = (cy - l.ct) / alto;
    if(pos > 0.62) pAbajo++; else if(pos < 0.3) pArriba++;
  }
  const s2 = (pAbajo - pArriba) / (pAbajo + pArriba + 1);
  // Pista 1: casi todas las letras se apoyan en la misma línea (abajo), pero arriba no: unas suben (b, d, h, l, mayúsculas,
  // números) y otras no (a, c, e, o…). Las que bajan (g, p, q, y) son pocas. Al revés, las letras quedan alineadas arriba.
  // En texto en MAYÚSCULAS las letras quedan alineadas arriba y abajo: ahí decide la pista 2.
  let votos = 0, total = 0;
  letras.forEach((ls, li) => {
    if(ls.length < 4) return;
    const l = lineas[li], tol = Math.max(1.5, (l.y1 - l.y0) * 0.1);
    const alineadas = k => { const v = ls.map(c => c[k]).sort((a, b) => a - b); let mejor = 0; for(let i = 0, j = 0; i < v.length; i++){ while(v[i] - v[j] > tol * 2) j++; mejor = Math.max(mejor, i - j + 1); } return mejor / v.length; };
    const fb = alineadas(1), ft = alineadas(0);
    votos += (fb - ft) * ls.length; total += ls.length;
  });
  const s1 = total ? votos / total : 0, peso1 = total;
  let s = 0, seguro = false;
  if(Math.abs(s1) > 0.15 && peso1 >= 12){ s = s1; seguro = true; }
  else if(pAbajo + pArriba >= 4 && Math.abs(s2) > 0.3){ s = s2; seguro = true; }
  return { giro: seguro ? (s >= 0 ? base : base + 180) % 360 : 0, seguro, torcido: m.th - base, s1, s2, peso1, pAbajo, pArriba, lineas: lineas.length, mh, mv };
}
// o: { lado: lado máximo en px, minLado: agrandar hasta este lado (Full HD = 1920), calidad: JPG 0–1, alinear: enderezar el texto }
async function fiMejorarFoto(file, o){
  o = o || {};
  const LADO = o.lado || FI_MAX_LADO, MIN = o.minLado || 0;
  const img = await fiCargarImagen(file);
  let fuente = img, W = img.width, H = img.height, enderezada = false, odListo = null;
  // Esquinas puestas a mano (✂️ Ajustar esquinas) o, si no, las que detecta ORDEVA.
  const q = (o.esquinas && o.esquinas.length === 4) ? o.esquinas.map(([x, y]) => [Math.max(0, Math.min(img.width, x)), Math.max(0, Math.min(img.height, y))]) : fiEsquinasPapel(img);
  if(o.esquinas && o.alinear === undefined) o = Object.assign({}, o, { alinear: false });   // ya la alineó la persona
  if(q){
    const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    let ow = Math.max(dist(q[0], q[1]), dist(q[3], q[2])), oh = Math.max(dist(q[0], q[3]), dist(q[1], q[2]));
    let k = Math.min(2, LADO / Math.max(ow, oh)); if(MIN && Math.max(ow, oh) * k < MIN) k = Math.min(3, MIN / Math.max(ow, oh));
    ow = Math.round(ow * k); oh = Math.round(oh * k);   // si la hoja salió chica se agranda (letra pequeña)
    if(ow > 200 && oh > 200){
      /* Más rápido sin perder calidad: la hoja se recorta a máx. 2000 px, así que no hace falta leer
         la foto de 12 MP completa. Se reduce primero (lo hace la tarjeta gráfica) a lo justo que
         necesita el recorte (con 15 % de margen) y se copian los píxeles de a 32 bits. En un celular
         de gama media esto bajó de ~4,5 s a ~1,5 s. */
      const kk = Math.min(1, (k * 1.15) || 1), sw = Math.max(1, Math.round(img.width * kk)), sh = Math.max(1, Math.round(img.height * kk));
      const sc = document.createElement('canvas'); sc.width = sw; sc.height = sh;
      const scx = sc.getContext('2d', { willReadFrequently: true }); scx.imageSmoothingQuality = 'high'; scx.drawImage(img, 0, 0, sw, sh);
      const s32 = new Uint32Array(scx.getImageData(0, 0, sw, sh).data.buffer);
      const oc = document.createElement('canvas'); oc.width = ow; oc.height = oh;
      const ocx = oc.getContext('2d'); const od = ocx.createImageData(ow, oh), o32 = new Uint32Array(od.data.buffer);
      // Un pelo hacia adentro del borde de la hoja, para que no quede la raya de la mesa en la orilla.
      const cxq = (q[0][0] + q[1][0] + q[2][0] + q[3][0]) / 4, cyq = (q[0][1] + q[1][1] + q[2][1] + q[3][1]) / 4;
      const [a, b, c, d, e, f, g, h] = fiHomografia(ow, oh, q.map(([x, y]) => [(x + (cxq - x) * 0.014) * kk, (y + (cyq - y) * 0.014) * kk]));
      const BLANCO = 0xFFFFFFFF, s8 = new Uint8Array(s32.buffer), od8 = od.data;
      for(let y = 0, o = 0; y < oh; y++){
        let nu = b * y + c, nv = e * y + f, nz = h * y + 1;   // se suman a, d, g en cada paso de x
        for(let x = 0; x < ow; x++, o++, nu += a, nv += d, nz += g){
          // Interpolación bilineal (antes el píxel más cercano: al agrandar la letra quedaba con escalones y vetas)
          const fu = nu / nz, fv = nv / nz, u = Math.floor(fu), v = Math.floor(fv);
          if(u < 0 || v < 0 || u >= sw - 1 || v >= sh - 1){ o32[o] = (u >= 0 && v >= 0 && u < sw && v < sh) ? (s32[v * sw + u] | 0xFF000000) : BLANCO; continue; }
          const du = fu - u, dv = fv - v, i0 = (v * sw + u) * 4, i1 = i0 + sw * 4, q = o * 4;
          for(let ch = 0; ch < 3; ch++){
            const top = s8[i0 + ch] + (s8[i0 + 4 + ch] - s8[i0 + ch]) * du, bot = s8[i1 + ch] + (s8[i1 + 4 + ch] - s8[i1 + ch]) * du;
            od8[q + ch] = top + (bot - top) * dv;
          }
          od8[q + 3] = 255;
        }
      }
      odListo = od; fuente = oc; W = ow; H = oh; enderezada = true;   // los píxeles ya enderezados se usan directo abajo (sin dibujar y leer otra vez)
    }
  }
  let kf = Math.min(1, LADO / Math.max(W, H)); if(MIN && Math.max(W, H) * kf < MIN) kf = Math.min(3, MIN / Math.max(W, H));
  const k = kf, w = Math.round(W * k), h = Math.round(H * k);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const cx = c.getContext('2d', { willReadFrequently: true }); cx.imageSmoothingEnabled = true; cx.imageSmoothingQuality = 'high';
  let id;
  if(odListo && w === W && h === H) id = odListo;
  else { if(odListo) fuente.getContext('2d').putImageData(odListo, 0, 0); cx.drawImage(fuente, 0, 0, w, h); id = cx.getImageData(0, 0, w, h); }
  const px = id.data;
  const gr = new Float32Array(w * h);
  for(let i = 0, p = 0; p < gr.length; i += 4, p++) gr[p] = px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114;
  /* Luz del papel: en cada bloque, el tono del papel (el 90 % más claro, no el punto MÁS claro: el borde de cada letra
     sale más claro que el papel por la compresión de la foto y eso dejaba una sombra gris alrededor del texto). Un bloque
     casi todo de letra toma el papel de sus vecinos. Luego se suaviza entre bloques. */
  const B = Math.max(12, Math.round(Math.max(w, h) / 48)), bw = Math.ceil(w / B), bh = Math.ceil(h / B);
  const bc = document.createElement('canvas'); bc.width = bw; bc.height = bh;
  const bcx = bc.getContext('2d'), bd = bcx.createImageData(bw, bh), pb = new Float32Array(bw * bh), hb = new Uint32Array(64);
  for(let by = 0; by < bh; by++) for(let bx = 0; bx < bw; bx++){
    hb.fill(0); let nn = 0; const y1 = Math.min(h, (by + 1) * B), x1 = Math.min(w, (bx + 1) * B);
    for(let y = by * B; y < y1; y += 2) for(let x = bx * B; x < x1; x += 2){ hb[Math.min(63, gr[y * w + x] / 4) | 0]++; nn++; }
    let acc = 0, i = 63; const lim = nn * 0.10; for(; i > 0; i--){ acc += hb[i]; if(acc >= lim) break; }
    pb[by * bw + bx] = i * 4 + 2;
  }
  for(let by = 0; by < bh; by++) for(let bx = 0; bx < bw; bx++){
    let mx = pb[by * bw + bx];
    for(let yy = Math.max(0, by - 1); yy <= Math.min(bh - 1, by + 1); yy++) for(let xx = Math.max(0, bx - 1); xx <= Math.min(bw - 1, bx + 1); xx++) mx = Math.max(mx, pb[yy * bw + xx] - 6);
    const o = (by * bw + bx) * 4; bd.data[o] = bd.data[o + 1] = bd.data[o + 2] = mx; bd.data[o + 3] = 255;
  }
  bcx.putImageData(bd, 0, 0);
  const fc = document.createElement('canvas'); fc.width = w; fc.height = h;
  const fcx = fc.getContext('2d', { willReadFrequently: true }); fcx.imageSmoothingEnabled = true; fcx.imageSmoothingQuality = 'high'; fcx.drawImage(bc, 0, 0, w, h);
  const fondo = fcx.getImageData(0, 0, w, h).data;
  const g = new Float32Array(w * h);
  for(let i = 0, p = 0; p < g.length; i += 4, p++) g[p] = Math.min(255, gr[p] / Math.max(40, fondo[i]) * 245);
  const hist = new Uint32Array(256); for(let p = 0; p < g.length; p++) hist[g[p] | 0]++;   // recorrido directo (forEach era 10 veces más lento)
  let lo = 0, hi = 255, acc = 0; const n = g.length;
  for(let i = 0; i < 256; i++){ acc += hist[i]; if(acc > n * 0.01){ lo = i; break; } }
  acc = 0; for(let i = 255; i >= 0; i--){ acc += hist[i]; if(acc > n * 0.02){ hi = i; break; } }
  const rango = Math.max(40, hi - lo);
  const out = new Uint8ClampedArray(g.length);
  // Como un escáner: el papel queda blanco parejo (sin vetas ni manchas) y la letra bien negra.
  const blanco = 0.88 * 255;
  for(let p = 0; p < g.length; p++){ const v = (g[p] - lo) * 255 / rango; out[p] = v >= blanco ? 255 : v * 255 / blanco; }
  // nitidez: realce de bordes 3×3 (letra pequeña más marcada)
  for(let y = 1; y < h - 1; y++) for(let x = 1; x < w - 1; x++){
    const p = y * w + x, s = out[p] * 5 - out[p - 1] - out[p + 1] - out[p - w] - out[p + w];
    const v = out[p] * 0.6 + s * 0.4, o = p * 4; px[o] = px[o + 1] = px[o + 2] = v < 0 ? 0 : v > 222 ? 255 : v; px[o + 3] = 255;   // >222: puntitos del ruido de la cámara → papel blanco
  }
  // Orillas (el filtro de nitidez no las recorre): quedaban con la foto sin procesar y salía una raya en el borde.
  for(let x = 0; x < w; x++){ for(const y of [0, h - 1]){ const o = (y * w + x) * 4, v = out[y * w + x] > 222 ? 255 : out[y * w + x]; px[o] = px[o + 1] = px[o + 2] = v; px[o + 3] = 255; } }
  for(let y = 0; y < h; y++){ for(const x of [0, w - 1]){ const o = (y * w + x) * 4, v = out[y * w + x] > 222 ? 255 : out[y * w + x]; px[o] = px[o + 1] = px[o + 2] = v; px[o + 3] = 255; } }
  cx.putImageData(id, 0, 0);
  // Foto de lado o al revés: se gira sola (o como la dejó la persona con «↻ Girar»).
  let giro = 0, giroAuto = false;
  const giroPedido = o.giro != null ? o.giro : file.__giro;
  if(giroPedido != null) giro = ((Number(giroPedido) || 0) % 360 + 360) % 360;
  else if(o.autoGiro !== false){ try{ const r = fiOrientacion(out, w, h); if(r.seguro && r.giro){ giro = r.giro; giroAuto = true; } }catch(e){} }
  // Con el giro, los píxeles del texto se giran también para medir la inclinación ya derecha.
  let og = out, gw = w, gh = h;
  if(giro){
    gw = giro % 180 ? h : w; gh = giro % 180 ? w : h; og = new Uint8ClampedArray(w * h);
    for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){
      const v = out[y * w + x];
      if(giro === 90) og[x * gw + (h - 1 - y)] = v; else if(giro === 180) og[(h - 1 - y) * gw + (w - 1 - x)] = v; else og[(w - 1 - x) * gw + y] = v;
    }
  }
  // Texto torcido (la hoja ocupaba toda la foto o quedó un poco girada): se alinea como un escáner.
  let angulo = 0, final = c;
  if(o.alinear !== false){ try{ angulo = fiAnguloTexto(og, gw, gh); }catch(e){ angulo = 0; } }
  if(angulo || giro){
    const r = document.createElement('canvas'); r.width = gw; r.height = gh;
    const rx = r.getContext('2d'); rx.fillStyle = '#fff'; rx.fillRect(0, 0, gw, gh); rx.imageSmoothingQuality = 'high';
    rx.translate(gw / 2, gh / 2); rx.rotate((giro - angulo) * Math.PI / 180); rx.drawImage(c, -w / 2, -h / 2);
    final = r; if(angulo) enderezada = true;
  }
  const blob = await new Promise(r => final.toBlob(r, 'image/jpeg', o.calidad || 0.85));
  const nombre = (file.name || 'factura').replace(/\.[^.]+$/, '') + '-mejorada.jpg';
  const file2 = new File([blob], nombre, { type: 'image/jpeg' });
  return { file: file2, dataUrl: URL.createObjectURL(file2), enderezada, angulo, giro, giroAuto, w: final.width, h: final.height };   // vista previa sin volver a codificar la foto
}
const fiEsPdf = f => (window.VitoOfflineOCR && window.VitoOfflineOCR.isPdfFile && window.VitoOfflineOCR.isPdfFile(f)) || /\.pdf$/i.test(f.name || '') || f.type === 'application/pdf';
// Archivos válidos: fotos o PDF, de hasta 15 MB cada uno, máximo 10 a la vez.
function fiValidarArchivos(files){
  const ok = [], malos = [];
  // 1.65.7: el archivo llegó VACÍO (0 bytes): pasaba al elegir el PDF desde WhatsApp, Drive o Descargas en la app Android
  // vieja, y salía un error en inglés («The PDF file is empty»). Ahora se dice qué hacer (la app nueva ya lo arregla sola).
  const vacios = (files || []).filter(f => f && f.size === 0);
  if(vacios.length){
    showToast('⚠️ ' + (vacios.length === 1 ? 'El archivo «' + vacios[0].name + '» llegó vacío' : vacios.length + ' archivos llegaron vacíos') + ' (0 bytes). ' +
      (window.VentoAndroid ? 'Actualiza la app ORDEVA (se actualiza sola) o guarda el PDF en el celular y elígelo desde «Archivos».' : 'Descárgalo primero al equipo y vuelve a elegirlo.'), 12000);
    try{ window.ventoError && window.ventoError('otro', 'Factura: el archivo llegó vacío (0 bytes)', { tipo: vacios[0].type, nombre: String(vacios[0].name).slice(-20) }, 'factura|vacio'); }catch(e){}
    files = files.filter(f => f && f.size > 0);
  }
  (files || []).slice(0, 10).forEach(f => { if(!(f.type && /^image\//.test(f.type)) && !fiEsPdf(f)) malos.push(f.name + ' (no es foto ni PDF)'); else if(f.size > FI_MAX_BYTES) malos.push(f.name + ' (pesa más de 15 MB)'); else ok.push(f); });
  if(malos.length) showToast('⚠️ No se usaron: ' + malos.join(', '));
  return ok;
}
// Estados claros mientras se lee la factura
function fiEstado(txt){ const s = document.getElementById('invoiceSub'); if(s) s.textContent = txt; }
/* ================= ✂️ Ajustar esquinas (como CamScanner) =================
   La foto original con las 4 esquinas de la hoja (las que detectó ORDEVA; si no encontró la hoja, un recuadro). Se
   arrastran las esquinas o los bordes con el dedo; mientras se arrastra, una lupa muestra de cerca dónde queda el punto.
   «🔍 Detectar otra vez», «⬜ Toda la foto», «↻ Girar». «✅ Listo» devuelve { esquinas, archivo } (archivo = la foto,
   girada si se giró). Las esquinas van en píxeles de la foto, en orden: arriba-izq, arriba-der, abajo-der, abajo-izq. */
function fiOrdenarEsquinas(q){
  const cx = q.reduce((a, p) => a + p[0], 0) / 4, cy = q.reduce((a, p) => a + p[1], 0) / 4;
  const s = q.slice().sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx));   // en orden de las agujas del reloj (y hacia abajo)
  let i0 = 0; s.forEach((p, i) => { if(p[0] + p[1] < s[i0][0] + s[i0][1]) i0 = i; });
  return [0, 1, 2, 3].map(k => s[(i0 + k) % 4]);
}
async function fiGirarArchivo(file){
  const img = await fiCargarImagen(file), c = document.createElement('canvas'); c.width = img.height; c.height = img.width;
  const x = c.getContext('2d'); x.translate(c.width, 0); x.rotate(Math.PI / 2); x.drawImage(img, 0, 0);
  const b = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.92));
  return new File([b], (file.name || 'factura').replace(/\.[^.]+$/, '') + '-girada.jpg', { type: 'image/jpeg' });
}
function fiEditarEsquinas(file, inicial){
  return new Promise(async resolve => {
    let ov = document.getElementById('fiEsqOv');
    if(!ov){
      ov = document.createElement('div'); ov.id = 'fiEsqOv'; ov.className = 'overlay fi-esq';
      ov.innerHTML = '<div class="fi-esq-top"><b>✂️ Ajusta las esquinas</b><small>Arrastra cada punto a una esquina de la hoja</small></div>' +
        '<div class="fi-esq-zona"><canvas class="fi-esq-c"></canvas><canvas class="fi-esq-lupa" width="132" height="132" hidden></canvas></div>' +
        '<div class="fi-esq-bts"><button type="button" class="btn-ghost" data-e="auto">🔍 Detectar otra vez</button><button type="button" class="btn-ghost" data-e="todo">⬜ Toda la foto</button><button type="button" class="btn-ghost" data-e="girar">↻ Girar</button></div>' +
        '<div class="fi-esq-pie"><button type="button" class="btn-close" data-e="no">Cancelar</button><button type="button" class="btn-primary" data-e="ok">✅ Listo</button></div>';
      document.body.appendChild(ov);
    }
    const cv = ov.querySelector('.fi-esq-c'), lupa = ov.querySelector('.fi-esq-lupa'), zona = ov.querySelector('.fi-esq-zona');
    let img = null, q = null, k = 1, ox = 0, oy = 0, arr = null;
    const cargar = async f => {
      file = f; img = await fiCargarImagen(f);
      const det = fiEsquinasPapel(img);
      q = (inicial && !cargar.usado) ? inicial.map(p => p.slice()) : det;
      cargar.usado = true;
      if(!q){ const m = 0.04; q = [[img.width * m, img.height * m], [img.width * (1 - m), img.height * m], [img.width * (1 - m), img.height * (1 - m)], [img.width * m, img.height * (1 - m)]]; }
      medir(); pintar();
    };
    function medir(){
      const r = zona.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
      cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); cv.style.width = r.width + 'px'; cv.style.height = r.height + 'px';
      const pad = 22;
      k = Math.min((r.width - 2 * pad) / img.width, (r.height - 2 * pad) / img.height);
      ox = (r.width - img.width * k) / 2; oy = (r.height - img.height * k) / 2;
    }
    const aPant = p => [ox + p[0] * k, oy + p[1] * k];
    const aFoto = (x, y) => [Math.max(0, Math.min(img.width, (x - ox) / k)), Math.max(0, Math.min(img.height, (y - oy) / k))];
    const medios = () => [0, 1, 2, 3].map(i => { const a = q[i], b = q[(i + 1) % 4]; return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; });
    function pintar(){
      if(!img) return;
      const x = cv.getContext('2d'), dpr = window.devicePixelRatio || 1;
      x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, cv.width, cv.height);
      x.drawImage(img, ox, oy, img.width * k, img.height * k);
      const P = q.map(aPant);
      x.save(); x.beginPath(); x.rect(0, 0, cv.width, cv.height); x.moveTo(P[0][0], P[0][1]); P.slice(1).forEach(p => x.lineTo(p[0], p[1])); x.closePath();
      x.fillStyle = 'rgba(0,0,0,.55)'; x.fill('evenodd'); x.restore();
      x.beginPath(); x.moveTo(P[0][0], P[0][1]); P.slice(1).forEach(p => x.lineTo(p[0], p[1])); x.closePath();
      x.lineWidth = 3; x.strokeStyle = '#22c55e'; x.stroke();
      medios().map(aPant).forEach(p => { x.beginPath(); x.arc(p[0], p[1], 9, 0, 7); x.fillStyle = '#fff'; x.fill(); x.lineWidth = 3; x.strokeStyle = '#22c55e'; x.stroke(); });
      P.forEach((p, i) => { x.beginPath(); x.arc(p[0], p[1], 15, 0, 7); x.fillStyle = arr && arr.i === i ? '#22c55e' : 'rgba(34,197,94,.35)'; x.fill(); x.lineWidth = 3; x.strokeStyle = '#fff'; x.stroke(); });
    }
    function pintarLupa(pf, pantalla){
      const L = lupa.getContext('2d'), Z = 2.6, R = 66;
      L.clearRect(0, 0, 132, 132); L.save(); L.beginPath(); L.arc(R, R, R - 2, 0, 7); L.clip();
      L.fillStyle = '#000'; L.fillRect(0, 0, 132, 132);
      const ancho = 132 / (k * Z);
      L.drawImage(img, pf[0] - ancho / 2, pf[1] - ancho / 2, ancho, ancho, 0, 0, 132, 132);
      L.restore(); L.strokeStyle = '#22c55e'; L.lineWidth = 3; L.beginPath(); L.arc(R, R, R - 2, 0, 7); L.stroke();
      L.beginPath(); L.moveTo(R - 12, R); L.lineTo(R + 12, R); L.moveTo(R, R - 12); L.lineTo(R, R + 12); L.lineWidth = 2; L.stroke();
      const izq = pantalla[0] < zona.clientWidth / 2;
      Object.assign(lupa.style, { left: izq ? '' : '10px', right: izq ? '10px' : '', top: '10px' }); lupa.hidden = false;
    }
    const punto = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    cv.onpointerdown = e => {
      const pt = punto(e), P = q.map(aPant), M = medios().map(aPant), d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
      let i = -1, best = 40; P.forEach((p, j) => { if(d(p, pt) < best){ best = d(p, pt); i = j; } });
      if(i >= 0) arr = { i };
      else { let m = -1, bm = 34; M.forEach((p, j) => { if(d(p, pt) < bm){ bm = d(p, pt); m = j; } }); if(m < 0) return; arr = { lado: m, desde: aFoto(pt[0], pt[1]), q0: q.map(p => p.slice()) }; }
      try{ cv.setPointerCapture(e.pointerId); }catch(x){} e.preventDefault(); mover(e);
    };
    function mover(e){
      if(!arr) return;
      const pt = punto(e), f = aFoto(pt[0], pt[1]);
      if(arr.i != null){ q[arr.i] = f; pintarLupa(f, pt); }
      else { const dx = f[0] - arr.desde[0], dy = f[1] - arr.desde[1], a = arr.lado, b = (arr.lado + 1) % 4;
        [a, b].forEach(j => { q[j] = [Math.max(0, Math.min(img.width, arr.q0[j][0] + dx)), Math.max(0, Math.min(img.height, arr.q0[j][1] + dy))]; }); pintarLupa(f, pt); }
      pintar();
    }
    cv.onpointermove = e => { if(arr){ e.preventDefault(); mover(e); } };
    cv.onpointerup = cv.onpointercancel = () => { arr = null; lupa.hidden = true; q = fiOrdenarEsquinas(q); pintar(); };
    const alCambiarTam = () => { if(img && ov.classList.contains('show')){ medir(); pintar(); } };
    window.addEventListener('resize', alCambiarTam);
    const fin = v => { ov.classList.remove('show'); window.removeEventListener('resize', alCambiarTam); ov._fin = null; resolve(v); };
    ov._fin = () => fin(null);
    ov._prueba = { esquinas: () => q.map(x => x.slice()), pantalla: x => aPant(x), foto: () => img && { w: img.width, h: img.height } };   // para las pruebas automáticas
    ov.querySelector('.fi-esq-bts').onclick = async e => {
      const b = e.target.closest('[data-e]'); if(!b || !img) return;
      if(b.dataset.e === 'auto'){ const d = fiEsquinasPapel(img); if(d){ q = d; pintar(); } else showToast('No encontré bien la hoja: ajústala con los puntos.'); }
      else if(b.dataset.e === 'todo'){ q = [[0, 0], [img.width, 0], [img.width, img.height], [0, img.height]]; pintar(); }
      else if(b.dataset.e === 'girar'){ b.disabled = true; try{ inicial = null; await cargar(await fiGirarArchivo(file)); }finally{ b.disabled = false; } }
    };
    ov.querySelector('.fi-esq-pie').onclick = e => {
      const b = e.target.closest('[data-e]'); if(!b) return;
      if(b.dataset.e === 'no') return fin(null);
      const o = fiOrdenarEsquinas(q), area = Math.abs(o.reduce((a, p, i) => { const n = o[(i + 1) % 4]; return a + p[0] * n[1] - n[0] * p[1]; }, 0)) / 2;
      if(area < img.width * img.height * 0.04){ showToast('El recuadro quedó muy pequeño: abre las esquinas hasta los bordes de la hoja.'); return; }
      fin({ esquinas: o, archivo: file });
    };
    ov.classList.add('show');
    try{ await cargar(file); }catch(e){ showToast('No pude abrir la foto.'); fin(null); }
  });
}
window.fiEditarEsquinas = fiEditarEsquinas;
/* Revisar la foto antes de leerla: se muestra ya arreglada (recortada, enderezada y con la luz
   pareja). «Usar esta foto», «Tomar otra», «Elegir otra» o «Usar la original». */
function fiRevisarFoto(file, onLista){
  return new Promise(async resolve => {
    let ov = document.getElementById('fiFotoOv');
    if(!ov){
      ov = document.createElement('div'); ov.id = 'fiFotoOv'; ov.className = 'overlay';
      ov.innerHTML = '<div class="modal fi-foto"><h2>📷 Revisa la foto</h2><div class="modal-sub" id="fiFotoSub">Procesando imagen…</div>' +
        '<div class="fi-foto-img"><img id="fiFotoImg" alt="Factura"></div>' +
        '<div class="fi-foto-btns"><button type="button" class="btn-primary" id="fiFotoOk">✅ Usar esta foto</button>' +
        '<button type="button" class="btn-ghost" id="fiFotoOtra">📷 Tomar otra</button><button type="button" class="btn-ghost" id="fiFotoGal">🖼️ Elegir otra</button>' +
        '<button type="button" class="btn-ghost" id="fiFotoEsq">✂️ Ajustar esquinas</button><button type="button" class="btn-ghost" id="fiFotoGirar">↻ Girar</button>' +
        '<button type="button" class="btn-ghost" id="fiFotoOrig">Usar la original</button><button type="button" class="btn-close" id="fiFotoNo">Cancelar</button></div></div>';
      document.body.appendChild(ov);
    }
    const sub = document.getElementById('fiFotoSub'), im = document.getElementById('fiFotoImg');
    im.removeAttribute('src'); sub.textContent = 'Procesando imagen…'; ov.classList.add('show');
    const fin = v => { ov.classList.remove('show'); resolve(v); };
    let mejor = null;
    const giroTxt = m => m && m.giroAuto ? (m.giro === 180 ? 'Estaba al revés: la giré. ' : 'Estaba de lado: la giré. ') : '';
    try{ mejor = await fiMejorarFoto(file); im.src = mejor.dataUrl;
      sub.textContent = giroTxt(mejor) + (mejor.enderezada ? 'La recorté y la enderecé. ' : '') + 'Mejoré la luz y el contraste. ¿Se lee bien? Si quedó girada, toca «↻ Girar»; si el recorte no quedó bien, «✂️ Ajustar esquinas».'; }
    catch(e){ im.src = URL.createObjectURL(file); sub.textContent = 'No pude mejorarla, pero puedes usarla así o tomar otra.'; }
    // Mientras la persona mira la foto, ya se empieza a leer (así al tocar «Usar esta foto» la respuesta ya viene en camino).
    if(typeof onLista === 'function') try{ onLista(mejor ? mejor.file : file); }catch(e){}
    document.getElementById('fiFotoOk').onclick = () => fin({ usar: mejor ? mejor.file : file, original: file });
    document.getElementById('fiFotoOrig').onclick = () => fin({ usar: file, original: file });
    // ✂️ Ajustar esquinas (como CamScanner): la persona corrige el recorte y la foto se vuelve a escanear con sus esquinas.
    document.getElementById('fiFotoEsq').onclick = async () => {
      const r = await fiEditarEsquinas(file);
      if(!r) return;
      file = r.archivo; file.__esquinas = r.esquinas; delete file.__giro;   // la hoja ya quedó como la puso la persona
      sub.textContent = 'Recortando con tus esquinas…';
      try{ mejor = await fiMejorarFoto(file, { esquinas: r.esquinas }); im.src = mejor.dataUrl; sub.textContent = '✂️ Recortada con tus esquinas, enderezada y con la luz pareja. ¿Se lee bien?'; }
      catch(e){ sub.textContent = 'No pude recortarla así. Prueba otra vez.'; }
      if(typeof onLista === 'function') try{ onLista(mejor ? mejor.file : file); }catch(e){}
      document.getElementById('fiFotoOk').onclick = () => fin({ usar: mejor ? mejor.file : file, original: file });
      document.getElementById('fiFotoOrig').onclick = () => fin({ usar: file, original: file });
    };
    // ↻ Girar a mano (un cuarto de vuelta a la derecha cada vez). El giro queda en la foto, así el escaneo HD que se guarda
    // también sale derecho.
    const gb = document.getElementById('fiFotoGirar');
    gb.onclick = async () => {
      if(gb.disabled) return; gb.disabled = true;
      const g = (((mejor && mejor.giro) || 0) + 90) % 360; file.__giro = g;
      sub.textContent = 'Girando…';
      try{ mejor = await fiMejorarFoto(file, Object.assign({ giro: g }, file.__esquinas ? { esquinas: file.__esquinas } : {})); im.src = mejor.dataUrl; sub.textContent = '↻ Girada. ¿Quedó derecha? Si no, toca «↻ Girar» otra vez.'; }
      catch(e){ sub.textContent = 'No pude girarla. Prueba otra vez.'; }
      finally{ gb.disabled = false; }
      if(typeof onLista === 'function') try{ onLista(mejor ? mejor.file : file); }catch(e){}
      document.getElementById('fiFotoOk').onclick = () => fin({ usar: mejor ? mejor.file : file, original: file });
      document.getElementById('fiFotoOrig').onclick = () => fin({ usar: file, original: file });
    };
    document.getElementById('fiFotoOtra').onclick = () => fin({ otra: 'cam' });
    document.getElementById('fiFotoGal').onclick = () => fin({ otra: 'gal' });
    document.getElementById('fiFotoNo').onclick = () => fin(null);
  });
}
// Guarda el archivo original de la factura (foto o primera página del PDF) en el celular.
async function fiGuardarOriginal(file){
  try{
    if(!file || typeof window.ctReciboGuardar !== 'function') return null;
    let img = file;
    if(fiEsPdf(file)){ const pags = window.VitoOfflineOCR && window.VitoOfflineOCR.expandFilesWithPdfPages ? await window.VitoOfflineOCR.expandFilesWithPdfPages([file]) : []; img = pags[0]; if(!img) return null; }
    const url = await scalePhotoForAI(img, 1600, 0.7);
    const id = 'fact-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    await window.ctReciboGuardar(id, url);
    return id;
  }catch(e){ return null; }
}

/* ================= Facturas escaneadas en HD (como CamScanner) =================
   Al aplicar una factura, cada página (todas las fotos o todas las hojas del PDF) se guarda en el celular ya
   escaneada: recortada, enderezada, con el texto alineado, la luz pareja y en Full HD o más (lado largo ≥ 1920 px).
   Después, sin estorbar, se detecta todo el texto de cada página (con la posición de cada palabra).
   Desde «📚 Facturas anteriores» se descarga en PDF (las páginas escaneadas con el texto encima, que se puede buscar y
   copiar, más una hoja con los datos leídos) o en imagen JPG HD. Las facturas que ya estaban guardadas (solo con la foto
   original) también se descargan mejoradas: se escanean en ese momento. */
const FI_HD = { lado: 2560, minLado: 1920, calidad: 0.9 };
const fiBlobADataUrl = b => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => rej(fr.error); fr.readAsDataURL(b); });
async function fiDataUrlAFile(url, nombre){ const b = await (await fetch(url)).blob(); return new File([b], nombre || 'factura.jpg', { type: b.type || 'image/jpeg' }); }
// Fotos y PDF → una imagen por página (máx. 12 páginas).
async function fiPaginasDe(files){
  const out = [];
  for(const f of (files || [])){
    if(out.length >= 12) break;
    if(fiEsPdf(f)){ try{ const pags = window.VitoOfflineOCR && window.VitoOfflineOCR.expandFilesWithPdfPages ? await window.VitoOfflineOCR.expandFilesWithPdfPages([f]) : []; pags.forEach(x => out.push(x)); }catch(e){} }
    else out.push(f);
  }
  return out.slice(0, 12);
}
// Escanea cada página en HD y la guarda en el celular. Devuelve [{ id, w, h, esq }]. Si la persona ajustó las esquinas
// (✂️), se usan esas. También queda en este equipo la foto original de cada página («-o»), para poder corregir el
// recorte después desde «Facturas anteriores» (las esquinas van en fracciones de la foto: 0 a 1).
async function fiGuardarEscaneos(files, base){
  const pags = await fiPaginasDe(files), out = [];
  for(let i = 0; i < pags.length; i++){
    try{
      const esq = pags[i].__esquinas || null;
      const r = await fiMejorarFoto(pags[i], Object.assign({}, FI_HD, esq ? { esquinas: esq } : {})), id = base + '-p' + (i + 1);
      await window.ctReciboGuardar(id, await fiBlobADataUrl(r.file));
      let fr = null;
      try{
        const im = await fiCargarImagen(pags[i]);
        if(esq) fr = esq.map(([x, y]) => [x / im.width, y / im.height]);
        await window.ctReciboGuardar(id + '-o', await scalePhotoForAI(pags[i], 2000, 0.85));
      }catch(e){}
      out.push(Object.assign({ id, w: r.w, h: r.h }, fr ? { esq: fr } : {}, r.giro ? { giro: r.giro } : {}));
    }catch(e){}
  }
  return out;
}
// ✂️ Corregir el recorte de una factura ya guardada: se abre la foto original de esa página con sus esquinas, se
// ajustan y se vuelve a escanear en HD (reemplaza la página guardada; el texto se vuelve a detectar al descargarla).
async function fiCorregirEscaneo(p, n, avisar){
  avisar = avisar || (t => showToast(t, 3500));
  await fiEscaneosDe(p);
  const e = (p.escaneos || [])[n]; if(!e){ showToast('No encontré esa página.'); return false; }
  const leer = window.ctReciboLeer;
  let url = await leer(e.id + '-o'), desdeOriginal = !!url;
  if(!url && n === 0 && p.archivoId){ url = await leer(p.archivoId); desdeOriginal = !!url; }
  if(!url) url = await leer(e.id);
  if(!url){ showToast('La foto de esta página no está en este equipo.'); return false; }
  const f = await fiDataUrlAFile(url, 'factura-p' + (n + 1) + '.jpg');
  let inicial = null;
  if(desdeOriginal && e.esq){ const im = await fiCargarImagen(f); inicial = e.esq.map(([x, y]) => [x * im.width, y * im.height]); }
  const r = await fiEditarEsquinas(f, inicial);
  if(!r) return false;
  avisar('✂️ Recortando y escaneando en HD…');
  const m = await fiMejorarFoto(r.archivo, Object.assign({}, FI_HD, { esquinas: r.esquinas }, desdeOriginal && r.archivo === f && e.giro ? { giro: e.giro } : {}));
  await window.ctReciboGuardar(e.id, await fiBlobADataUrl(m.file));
  try{ await window.ctReciboBorrar(e.id + '-ocr'); }catch(x){}
  const im2 = await fiCargarImagen(r.archivo);
  if(r.archivo !== f || !desdeOriginal) try{ await window.ctReciboGuardar(e.id + '-o', await scalePhotoForAI(r.archivo, 2000, 0.85)); }catch(x){}
  Object.assign(e, { w: m.w, h: m.h, esq: r.esquinas.map(([x, y]) => [x / im2.width, y / im2.height]), corregida: Date.now() });
  saveData();
  showToast('✅ Página ' + (n + 1) + ' recortada con tus esquinas y guardada en HD.', 4500);
  return true;
}
// ↻ Girar una página guardada: un cuarto de vuelta a la derecha de la imagen HD (sin volver a escanear, así no pierde
// calidad). El texto se vuelve a detectar al descargarla.
async function fiGirarEscaneo(p, n, avisar){
  avisar = avisar || (t => showToast(t, 3500));
  await fiEscaneosDe(p);
  const e = (p.escaneos || [])[n]; if(!e){ showToast('No encontré esa página.'); return false; }
  const url = await window.ctReciboLeer(e.id);
  if(!url){ showToast('La foto de esta página no está en este equipo.'); return false; }
  avisar('↻ Girando la página ' + (n + 1) + '…');
  const f = await fiGirarArchivo(await fiDataUrlAFile(url, 'factura-p' + (n + 1) + '.jpg'));
  await window.ctReciboGuardar(e.id, await fiBlobADataUrl(f));
  try{ await window.ctReciboBorrar(e.id + '-ocr'); }catch(x){}
  e.giro = ((e.giro || 0) + 90) % 360; const w = e.w; e.w = e.h; e.h = w;
  saveData();
  showToast('↻ Página ' + (n + 1) + ' girada y guardada.', 3500);
  return true;
}
// Lo que se hace después de aplicar (sin hacer esperar): escanear en HD todas las páginas y detectar su texto.
async function fiEscanearCompra(compraId, files){
  try{
    if(!window.ctReciboGuardar || !(files || []).length) return;
    const esc = await fiGuardarEscaneos(files, 'fesc-' + compraId);
    const p = (data.purchases || []).find(x => x.id === compraId);
    if(p && esc.length){ p.escaneos = esc; saveData(); }
    setTimeout(async () => { for(const e of esc){ try{ await fiOcrEscaneo(e.id); }catch(err){} } }, 1500);
  }catch(e){}
}
// Texto con posiciones de una página escaneada (se detecta una vez y queda guardado en el celular).
async function fiOcrEscaneo(id, url){
  const leer = window.ctReciboLeer; if(!leer) return null;
  try{ const ya = await leer(id + '-ocr'); if(ya) return JSON.parse(ya); }catch(e){}
  const V = window.VitoOfflineOCR; if(!V || !V.palabrasDeImagen) return null;
  url = url || await leer(id); if(!url) return null;
  const r = await V.palabrasDeImagen(await fiDataUrlAFile(url, id + '.jpg'));
  if(r && (r.words || []).length){ try{ await window.ctReciboGuardar(id + '-ocr', JSON.stringify(r)); }catch(e){} }
  return r;
}
// Las páginas escaneadas de una factura guardada: [{ id, url }]. Si solo estaba la foto original (facturas de
// antes), se escanea en HD en este momento y queda guardada.
async function fiEscaneosDe(p, avance){
  const leer = window.ctReciboLeer; if(!leer) return [];
  const out = [];
  for(const e of (p.escaneos || [])){ try{ const url = await leer(e.id); if(url) out.push({ id: e.id, url }); }catch(err){} }
  if(out.length || !p.archivoId) return out;
  const orig = await leer(p.archivoId); if(!orig) return [];
  if(avance) avance('🖨️ Escaneando la factura en HD…');
  const r = await fiMejorarFoto(await fiDataUrlAFile(orig, 'factura.jpg'), FI_HD), id = 'fesc-' + p.id + '-p1', url = await fiBlobADataUrl(r.file);
  await window.ctReciboGuardar(id, url);
  p.escaneos = [{ id, w: r.w, h: r.h }]; saveData();
  return [{ id, url }];
}
const fiNombreArchivo = (p, ext) => ('Factura ' + [p.supplier || 'proveedor', p.invoiceNumber || '', (p.date || String(p.at || '').slice(0, 10) || '')].filter(Boolean).join(' ')).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9 ._-]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 80) + '.' + ext;
function fiDescargar(blob, nombre){
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
const fiDataUrlABytes = url => { const b = atob(String(url).split(',')[1] || ''), u = new Uint8Array(b.length); for(let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
const fiTamImagen = url => new Promise(res => { const im = new Image(); im.onload = () => res({ w: im.naturalWidth, h: im.naturalHeight }); im.onerror = () => res(null); im.src = url; });

/* PDF hecho a mano (sin librerías): cada página escaneada como imagen JPG con el texto detectado encima, invisible
   (se puede buscar y copiar, como un PDF de escáner), y al final la hoja «Datos de la factura». */
// Ancho aproximado de un texto en Helvetica (en «em»), para que cada palabra invisible tape justo la palabra de la foto.
function fiAnchoHelvetica(t){
  let a = 0;
  for(const ch of String(t)){
    if(/[ilIjtf.,;:!'|]/.test(ch)) a += 0.28; else if(/[mwMW]/.test(ch)) a += 0.86; else if(/[A-ZÁÉÍÓÚÑ]/.test(ch)) a += 0.69;
    else if(/[0-9$]/.test(ch)) a += 0.556; else if(/[rJ]/.test(ch)) a += 0.36; else a += 0.53;
  }
  return a;
}
function fiPdf(paginas, resumen){
  const WIN = { 0x2013: 0x96, 0x2014: 0x97, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2026: 0x85, 0x20AC: 0x80 };
  const bytes = str => { const u = new Uint8Array(str.length); for(let i = 0; i < str.length; i++) u[i] = str.charCodeAt(i) & 255; return u; };
  const txt = t => '(' + Array.from(String(t == null ? '' : t)).map(ch => { let c = ch.codePointAt(0); if(WIN[c]) c = WIN[c]; else if(c > 255 || c < 32) c = c < 32 ? 32 : 63; const x = String.fromCharCode(c); return x === '(' || x === ')' || x === '\\' ? '\\' + x : x; }).join('') + ')';
  const n2 = v => (Math.round(v * 100) / 100).toString();
  const objs = [];                        // cada objeto: [partes…] (texto o bytes)
  const nuevo = () => { objs.push(null); return objs.length; };
  const CAT = nuevo(), PAGS = nuevo(), F1 = nuevo(), F2 = nuevo(), kids = [];
  objs[F1 - 1] = ['<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'];
  objs[F2 - 1] = ['<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'];
  const pagina = (W, H, contenido, img) => {
    const cont = nuevo(), pg = nuevo(); let res = '/Font << /F1 ' + F1 + ' 0 R /F2 ' + F2 + ' 0 R >>';
    if(img){ const im = nuevo(); objs[im - 1] = ['<< /Type /XObject /Subtype /Image /Width ' + img.w + ' /Height ' + img.h + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + img.jpg.length + ' >>\nstream\n', img.jpg, '\nendstream']; res += ' /XObject << /Im1 ' + im + ' 0 R >>'; }
    const c = bytes(contenido);
    objs[cont - 1] = ['<< /Length ' + c.length + ' >>\nstream\n', c, '\nendstream'];
    objs[pg - 1] = ['<< /Type /Page /Parent ' + PAGS + ' 0 R /MediaBox [0 0 ' + n2(W) + ' ' + n2(H) + '] /Resources << ' + res + ' >> /Contents ' + cont + ' 0 R >>'];
    kids.push(pg);
  };
  // Páginas escaneadas
  (paginas || []).forEach(pg => {
    const W = 595.28, H = W * pg.h / pg.w;
    let c = 'q ' + n2(W) + ' 0 0 ' + n2(H) + ' 0 0 cm /Im1 Do Q\n';
    const o = pg.ocr;
    if(o && (o.words || []).length && o.w && o.h){
      c += 'BT 3 Tr\n';                  // 3 = texto invisible (encima de la imagen, para buscar y copiar)
      o.words.forEach(wd => {
        const fs = Math.max(2, (wd.y1 - wd.y0) / o.h * H), ancho = (wd.x1 - wd.x0) / o.w * W, nat = fs * Math.max(0.3, fiAnchoHelvetica(wd.t));
        c += '/F1 ' + n2(fs) + ' Tf ' + n2(Math.max(20, Math.min(400, ancho / nat * 100))) + ' Tz 1 0 0 1 ' + n2(wd.x0 / o.w * W) + ' ' + n2(H - wd.y1 / o.h * H + fs * 0.15) + ' Tm ' + txt(wd.t) + ' Tj\n';
      });
      c += 'ET\n';
    } else if(o && o.text){
      c += 'BT 3 Tr /F1 6 Tf\n'; let y = H - 10;
      String(o.text).split(/\n+/).slice(0, 200).forEach(l => { if(y < 4) return; c += '1 0 0 1 10 ' + n2(y) + ' Tm ' + txt(l) + ' Tj\n'; y -= 7; });
      c += 'ET\n';
    }
    pagina(W, H, c, { w: pg.w, h: pg.h, jpg: pg.jpg });
  });
  // Hoja «Datos de la factura» (texto normal, visible)
  if(resumen && resumen.length){
    const W = 595.28, H = 841.89, M = 40; let c = '', y = H - M;
    const linea = (partes, tam, neg) => { if(y < M + tam){ pagina(W, H, c); c = ''; y = H - M; } partes.forEach(([x, t]) => { c += 'BT /' + (neg ? 'F2' : 'F1') + ' ' + tam + ' Tf 1 0 0 1 ' + n2(M + x) + ' ' + n2(y) + ' Tm ' + txt(t) + ' Tj ET\n'; }); y -= tam * 1.45; };
    resumen.forEach(r => { if(r.raya){ c += '0.6 w ' + M + ' ' + n2(y + 6) + ' m ' + n2(W - M) + ' ' + n2(y + 6) + ' l S\n'; y -= 6; return; } linea(r.partes, r.tam || 9, r.neg); });
    pagina(W, H, c);
  }
  objs[PAGS - 1] = ['<< /Type /Pages /Kids [' + kids.map(k => k + ' 0 R').join(' ') + '] /Count ' + kids.length + ' >>'];
  objs[CAT - 1] = ['<< /Type /Catalog /Pages ' + PAGS + ' 0 R >>'];
  const partes = [bytes('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')], offs = []; let len = partes[0].length;
  objs.forEach((ob, i) => {
    offs.push(len);
    [('' + (i + 1) + ' 0 obj\n')].concat(ob, ['\nendobj\n']).forEach(x => { const u = typeof x === 'string' ? bytes(x) : x; partes.push(u); len += u.length; });
  });
  const xref = len;
  let tr = 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n' + offs.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('');
  tr += 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root ' + CAT + ' 0 R >>\nstartxref\n' + xref + '\n%%EOF';
  partes.push(bytes(tr));
  return new Blob(partes, { type: 'application/pdf' });
}
// Renglones de la hoja «Datos de la factura».
function fiResumenPdf(p){
  const h = p.header || {}, r = [], corta = (t, n) => { t = String(t == null ? '' : t); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
  const pesos = v => '$' + Math.round(v || 0).toLocaleString('es-CO');
  const catN = id => { const c = id ? (data.categories || []).find(k => String(k.id) === String(id)) : null; return c ? c.name : ''; };
  r.push({ partes: [[0, 'Datos de la factura']], tam: 16, neg: true });
  r.push({ partes: [[0, (p.supplier || 'Proveedor sin nombre') + (p.invoiceNumber ? ' · Factura ' + p.invoiceNumber : '')]], tam: 11, neg: true });
  const datos = [['Fecha', p.date || ''], ['NIT', h.supplierNit || h.nit || ''], ['Procesada', p.procesadaEn ? new Date(p.procesadaEn).toLocaleString('es-CO') : ''], ['Confirmó', p.usuario || '']].filter(x => x[1]);
  datos.forEach(([k, v]) => r.push({ partes: [[0, k + ':'], [80, v]], tam: 9 }));
  r.push({ raya: true });
  r.push({ partes: [[0, 'Producto'], [205, 'Código'], [290, 'Categoría'], [380, 'Cant.'], [420, 'Costo/u'], [470, 'Total']], tam: 8.5, neg: true });
  (p.items || []).forEach(i => r.push({ partes: [[0, corta(i.name, 42)], [205, corta(i.codigo || i.barcode || '', 16)], [290, corta(catN(i.categoryId), 17)], [380, String(i.qty || 0)], [420, pesos(i.cost)], [470, pesos(i.total != null ? i.total : (i.qty || 0) * (i.cost || 0))]], tam: 8.5 }));
  r.push({ raya: true });
  if(p.subtotal) r.push({ partes: [[330, 'Subtotal'], [470, pesos(p.subtotal)]], tam: 9 });
  if(p.ivaTotal) r.push({ partes: [[330, 'IVA'], [470, pesos(p.ivaTotal)]], tam: 9 });
  r.push({ partes: [[330, 'TOTAL'], [470, pesos(p.total)]], tam: 10.5, neg: true });
  r.push({ partes: [[0, 'Generado por ORDEVA.']], tam: 7.5 });
  return r;
}
// Descargar una factura guardada: 'pdf' (escaneada + texto + datos) o 'jpg' (cada página en HD).
async function fiDescargarFactura(p, tipo, avisar){
  avisar = avisar || (t => showToast(t, 4000));
  const pags = await fiEscaneosDe(p, avisar);
  if(tipo === 'jpg'){
    if(!pags.length){ showToast('La foto de esta factura no quedó guardada en este equipo.'); return false; }
    for(let i = 0; i < pags.length; i++){ const b = await (await fetch(pags[i].url)).blob(); fiDescargar(b, fiNombreArchivo(p, '').replace(/\.$/, '') + (pags.length > 1 ? ' pag ' + (i + 1) : '') + '.jpg'); }
    showToast('⬇️ ' + (pags.length > 1 ? pags.length + ' imágenes HD descargadas' : 'Imagen HD descargada') + ' (Descargas).');
    return true;
  }
  const paginas = [];
  for(let i = 0; i < pags.length; i++){
    avisar('🔎 Detectando el texto' + (pags.length > 1 ? ' (página ' + (i + 1) + ' de ' + pags.length + ')' : '') + '…');
    let ocr = null; try{ ocr = await fiOcrEscaneo(pags[i].id, pags[i].url); }catch(e){}
    const t = await fiTamImagen(pags[i].url); if(!t) continue;
    paginas.push({ jpg: fiDataUrlABytes(pags[i].url), w: t.w, h: t.h, ocr });
  }
  fiDescargar(fiPdf(paginas, fiResumenPdf(p)), fiNombreArchivo(p, 'pdf'));
  showToast('⬇️ PDF descargado' + (paginas.length ? ' (' + paginas.length + ' página' + (paginas.length > 1 ? 's' : '') + ' escaneada' + (paginas.length > 1 ? 's' : '') + ' en HD' + (paginas.some(x => x.ocr) ? ', con el texto' : '') + ')' : ' (los datos de la factura)') + '.', 5000);
  return true;
}

let invoiceDraft = null; // { supplier, date, header, archivo, items:[{name,originalDescription,qty,cost,productId,match,newPrice,include}] }

// Desglose por unidad que se ve en cada renglón: sin IVA + IVA = con IVA, y el total de la compra.
function fiDesgloseHtml(it){
  const c = it.cost || 0, r = it.ivaPct || 0, sin = c / (1 + r);
  const po = it.pesoOpc;
  const peso = it.contentPerUnit ? '<br>⚖️ Cada unidad: <b>' + invEsc(String(it.contentPerUnit)) + '</b>' + (it.pesoNota ? ' <small>(' + invEsc(it.pesoNota) + ')</small>' : '') +
    (po ? ' <button type="button" class="iv-peso-flip">' + (it.pesoModo === 'div' ? '↩️ No dividir: ' + invEsc(po.tot) + ' c/u' : '➗ Dividir: ' + invEsc(po.div) + ' c/u') + '</button>' : '') : '';
  return it.qty + ' unid. × (' + fmt(Math.round(sin)) + ' sin IVA + ' + fmt(Math.round(c - sin)) + ' IVA ' + Math.round(r * 100) + '%) = <b>' + fmt(Math.round(c)) + ' c/u</b> · total ' + fmt(Math.round(c * it.qty)) + peso;
}
/* ---------- Categoría y código de cada producto de la factura ----------
   Cada renglón lleva su propia categoría (la del producto si ya existe; si es nuevo, la que se parezca: cervezas,
   gaseosas, licores…) y su código (de barras o interno: el que trae la factura, el del producto o uno escrito/escaneado). */
const fiSinT = x => String(x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const FI_CAT_PISTAS = [
  [/\b(cerveza|pilsen|lager|aguila|poker|club colombia|costena|corona|heineken|budweiser|stella|redds|andina|tres cordilleras|bbc)\b/, /cervez|pola/],
  [/\b(gaseosa|coca|pepsi|postobon|sprite|colombiana|manzana postobon|quatro|uva|7up|seven up|big cola|ginger)\b/, /gaseos|bebida|refresc/],
  [/\b(agua|cristal|brisa|manantial|h2o)\b/, /agua|bebida/],
  [/\b(jugo|hit|tutti|del valle|frutto|natumalta|malta|pony)\b/, /jug|malta|bebida/],
  [/\b(energizante|red bull|vive 100|speed|monster|volt)\b/, /energ|bebida/],
  [/\b(aguardiente|antioqueno|nectar|ron|medellin|viejo de caldas|whisky|whiskey|old parr|buchanan|vodka|tequila|vino|ginebra|brandy|licor)\b/, /licor|trago|aguardient|ron|vino/],
  [/\b(papas|margarita|chitos|de todito|doritos|tostacos|platanitos|mani|snack|natuchips|yupi|choclitos|cheetos)\b/, /snack|mecato|paquet|pasaboc/],
  [/\b(cigarrillo|cigarro|marlboro|lucky|boston|belmont|pielroja)\b/, /cigarr|tabaco/],
  [/\b(chocolatina|jet|jumbo|chicle|bombon|dulce|galleta|festival|ducales|wafer)\b/, /dulce|golosin|confit|galleta/],
  [/\b(hielo)\b/, /hielo/]
];
function fiCategoriaSugerida(it){
  const m = it.productId ? data.products.find(p => p.id === it.productId) : null;
  if(m) return m.categoryId || '';
  const cats = data.categories || []; if(!cats.length) return '';
  const nom = fiSinT((it.name || '') + ' ' + (it.originalDescription || ''));
  // 1) La categoría de otro producto que empiece igual («Cerveza Águila…» → la de «Cerveza Póker»)
  const pal = nom.split(/[^a-z0-9]+/).filter(w => w.length > 3 && !/^(caja|paca|und|unid|unidad|botella|lata|litro|pet|vidrio|x\d+)$/.test(w));
  for(const w of pal.slice(0, 2)){
    const cnt = {}; data.products.forEach(p => { if(p.categoryId && !p.combo && fiSinT(p.name).split(/[^a-z0-9]+/).includes(w)) cnt[p.categoryId] = (cnt[p.categoryId] || 0) + 1; });
    const mejor = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
    if(mejor && cats.some(c => c.id === mejor)) return mejor;
  }
  // 2) Por el tipo de producto, si ya existe una categoría así
  for(const [re, cre] of FI_CAT_PISTAS){ if(re.test(nom)){ const c = cats.find(k => cre.test(fiSinT(k.name))); if(c) return c.id; } }
  return '';
}
function fiCodigoSugerido(it){
  const m = it.productId ? data.products.find(p => p.id === it.productId) : null;
  return String(it.barcode || (m && (m.codigo || (m.barcodes || [])[0])) || it.sku || '').trim();
}
function fiCatOpciones(sel){
  return '<option value="">Sin categoría</option>' + (data.categories || []).filter(c => c.id !== (typeof PROMO_CAT !== 'undefined' ? PROMO_CAT : '')).map(c => '<option value="' + invEsc(c.id) + '"' + (String(c.id) === String(sel) ? ' selected' : '') + '>' + invEsc(c.name) + '</option>').join('') + '<option value="__nueva">➕ Nueva categoría…</option>';
}
function fiCatCodigoHtml(it){
  if(it.categoryId === undefined) it.categoryId = fiCategoriaSugerida(it);
  if(it.codigo === undefined) it.codigo = fiCodigoSugerido(it);
  return '<div class="iv-grid iv-catgrid">' +
      '<div><label>🏷️ Categoría</label><select class="iv-cat">' + fiCatOpciones(it.categoryId) + '</select></div>' +
      '<div><label>🔢 Código (barras o interno)</label><div class="iv-codewrap"><input type="text" class="iv-code" maxlength="40" autocomplete="off" autocapitalize="characters" placeholder="Opcional" value="' + invEsc(it.codigo || '') + '"><button type="button" class="iv-code-scan" title="Escanear el código con la cámara">📷</button></div></div>' +
    '</div>' +
    '<div class="iv-catnew" hidden><input type="text" class="iv-catnew-in" maxlength="40" placeholder="Nombre de la nueva categoría"><button type="button" class="btn-primary iv-catnew-ok">Crear</button></div>';
}
// Crea la categoría (o usa la que ya se llame igual) y devuelve su id.
const fiCatValida = id => { const c = id ? (data.categories || []).find(k => String(k.id) === String(id)) : null; return c ? c.id : null; };
function fiCrearCategoria(nombre){
  nombre = String(nombre || '').trim().slice(0, 40); if(!nombre) return null;
  data.categories = data.categories || [];
  const ya = data.categories.find(c => fiSinT(c.name) === fiSinT(nombre)); if(ya) return ya.id;
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  data.categories.push({ id, name: nombre }); saveData();
  try{ renderProductos(); }catch(e){}
  return id;
}
// Barra «Poner a todos la misma categoría» (arriba de los productos).
function fiCatTodosHtml(){
  if(!invoiceDraft || invoiceDraft.items.length < 2) return '';
  return '<div class="iv-cattodos"><label>🏷️ Poner a todos la categoría</label><div class="iv-codewrap"><select id="ivCatTodosSel">' + fiCatOpciones('') + '</select><button type="button" class="btn-ghost" id="ivCatTodosBtn">Aplicar a todos</button></div>' +
    '<div class="iv-catnew" id="ivCatTodosNueva" hidden><input type="text" id="ivCatTodosNuevaIn" maxlength="40" placeholder="Nombre de la nueva categoría"><button type="button" class="btn-primary" id="ivCatTodosNuevaOk">Crear</button></div>' +
    '<div class="iv-note">Luego puedes cambiar la de cada producto.</div></div>';
}
function invoiceRowHtml(it, i){
  const matched = it.productId ? data.products.find(p => p.id === it.productId) : null;
  const inc = matched && matched.cost != null && it.cost > matched.cost;
  const incPct = inc ? Math.round((it.cost - matched.cost) / matched.cost * 100) : 0;
  const real = data.products.filter(p => !p.combo).slice().sort((a, b) => a.name.localeCompare(b.name));
  const cands = (it.match && it.match.candidatos) || [];
  const optsCand = cands.length ? '<optgroup label="Posibles productos encontrados">' + cands.map(c => '<option value="' + c.id + '"' + (c.id === it.productId ? ' selected' : '') + '>' + invEsc(c.name) + ' · ' + c.conf + '%</option>').join('') + '</optgroup>' : '';
  const opts = '<option value="">➕ Crear producto nuevo</option>' + optsCand + '<optgroup label="Todos los productos">' + real.filter(p => !cands.some(c => c.id === p.id)).map(p => '<option value="' + p.id + '"' + (p.id === it.productId ? ' selected' : '') + '>' + invEsc(p.name + (p.size ? ' · ' + p.size : '')) + '</option>').join('') + '</optgroup>';
  const marginPct = typeof it.marginPct === 'number' ? it.marginPct : invoiceInferMargin(matched);
  const utilidad = it.newPrice > 0 ? it.newPrice - it.cost : 0;
  const cajas = it.cajas || 1, unidadesPorCaja = it.unidadesPorCaja || 1, ivaPct = it.ivaPct || 0, costoSinIva = it.costoSinIva || 0;
  const costoConIvaPorCaja = costoSinIva * (1 + ivaPct);
  const totalCompraConIva = cajas * costoConIvaPorCaja;
  const precioActual = typeof it.precioActual === 'number' ? it.precioActual : null;
  const margenActual = (precioActual != null && precioActual > 0) ? (precioActual - it.cost) / precioActual : null;
  const utilidadActual = precioActual != null ? precioActual - it.cost : null;
  return '<div class="iv-item' + (it.include ? '' : ' iv-skip') + '" data-i="' + i + '">' +
    '<div class="iv-top"><input type="text" class="iv-name-in" value="' + invEsc(it.name) + '" maxlength="60" placeholder="Nombre del producto" title="Toca para cambiarle el nombre">' +
    '<span class="iv-name-flags">' +
      (matched ? '' : '<span class="iv-flag new">nuevo</span>') +
      (inc ? '<span class="iv-flag up">⬆ ' + incPct + '%</span>' : '') +
    '</span><label><input type="checkbox" class="iv-inc" ' + (it.include ? 'checked' : '') + '> incluir</label></div>' +
    (it.originalDescription ? '<div class="iv-orig" title="Así viene escrito en la factura">🧾 ' + invEsc(it.originalDescription) + '</div>' : '') +
    (it.ajustes && it.ajustes.length ? '<div class="iv-ajuste">🧮 ORDEVA calculó: ' + invEsc(it.ajustes.join(' · ')) + '</div>' : '') +
    '<div class="iv-desglose">' + fiDesgloseHtml(it) + '</div>' +
    fiChipConfianza(it) +
    '<div class="iv-full" style="margin-bottom:8px"><label>Coincide con</label><select class="iv-match">' + opts + '</select></div>' +
    fiCatCodigoHtml(it) +
    '<div class="iv-grid iv-presgrid"><div><label>Presentación</label><input type="text" class="iv-pres" maxlength="40" placeholder="Ej. 24 x 594 g" value="' + invEsc(it.presentation || '') + '"></div>' +
    '<div><label>Unidad</label><input type="text" class="iv-unidad" maxlength="12" placeholder="und, caja, kg…" value="' + invEsc(it.unit || '') + '"></div></div>' +

    // ---------- 1) LA COMPRA: lo que te costó esta factura ----------
    '<div class="iv-section">' +
      '<div class="iv-section-title">🧾 Lo que te costó (esta compra)</div>' +
      '<div class="iv-grid">' +
        '<div><label>Cantidad (unidades)</label><input type="number" inputmode="numeric" class="iv-qty' + (it.qtyFalta ? ' iv-falta' : '') + '" min="1" step="1" value="' + it.qty + '"></div>' +
        '<div><label>Costo por unidad (con IVA)</label><input type="number" class="iv-cost" min="0" step="50" value="' + it.cost + '"></div>' +
      '</div>' +
      (it.qtyFalta ? '<div class="iv-falta-msg">⚠️ No se leyó cuántas unidades son. Escribe la cantidad (o abre «📦 ¿Viene en cajas?») y ORDEVA divide el total entre las unidades.</div>' : '') +
      '<div class="iv-note iv-division">' + fiDivisionTxt(it) + '</div>' +
      (matched && matched.cost != null ? '<div class="iv-note">Costo anterior de este producto: ' + fmt(matched.cost) + '</div>' : '') +
      '<div class="iv-full" style="margin-top:6px"><label>Total de la compra (' + cajas + ' × ' + unidadesPorCaja + ' = ' + (cajas * unidadesPorCaja) + ' unid., con IVA)</label><input type="number" class="iv-totalcompra" min="0" step="1" value="' + Math.round(totalCompraConIva) + '"></div>' +
      '<details class="iv-boxdetails"' + ((it.qtyFalta || (it.cajas || 1) > 1) ? ' open' : '') + '><summary>📦 ¿Viene en cajas o paquetes? (ej. 1 caja × 24 unidades)</summary>' +
        '<div class="iv-grid" style="margin-top:8px">' +
          '<div><label>Cant. cajas / paquetes</label><input type="number" class="iv-cajas" min="1" step="1" value="' + cajas + '"></div>' +
          '<div><label>Unid. por caja / paquete</label><input type="number" class="iv-unidxcaja" min="1" step="1" value="' + unidadesPorCaja + '"></div>' +
          '<div><label>Precio compra sin IVA (por caja)</label><input type="number" class="iv-costosiniva" min="0" step="50" value="' + Math.round(costoSinIva) + '"></div>' +
          '<div><label>IVA %</label><input type="number" class="iv-ivapct" min="0" max="30" step="1" value="' + Math.round(ivaPct * 100) + '"></div>' +
          '<div class="iv-full"><label>Precio compra CON IVA (por caja)</label><input type="number" class="iv-costoconiva" min="0" step="50" value="' + Math.round(costoConIvaPorCaja) + '"></div>' +
        '</div>' +
      '</details>' +
    '</div>' +

    // ---------- 2) LA VENTA: a cómo lo tienes, a cómo se sugiere, y si ganas o pierdes ----------
    '<div class="iv-section iv-section-venta">' +
      '<div class="iv-section-title">💰 A cómo lo vendes</div>' +
      '<div class="iv-grid">' +
        '<div><label>Precio actual (al que lo tienes hoy)</label><input type="number" class="iv-precioactual" min="0" step="50" placeholder="Ingresar valor" value="' + (precioActual != null ? Math.round(precioActual) : '') + '"></div>' +
        '<div><label>Margen al precio actual</label><span class="iv-actual-margen ' + (margenActual == null ? '' : (margenActual < 0 ? 'bad' : 'good')) + '">' + (margenActual == null ? '—' : Math.round(margenActual * 100) + '%') + '</span></div>' +
      '</div>' +
      (utilidadActual == null ? '' :
        '<div class="iv-actual-verdict ' + (utilidadActual < 0 ? 'bad' : (utilidadActual === 0 ? '' : 'good')) + '">' +
          (utilidadActual < 0
            ? '⚠️ Estás PERDIENDO ' + fmt(Math.abs(utilidadActual)) + ' por unidad al precio actual (costo ' + fmt(it.cost) + ' vs. venta ' + fmt(precioActual) + ').'
            : utilidadActual === 0
              ? '➖ Ni ganas ni pierdes: vendes exactamente al costo (' + fmt(it.cost) + ').'
              : '✅ Estás GANANDO ' + fmt(utilidadActual) + ' por unidad al precio actual (' + Math.round(margenActual * 100) + '% de margen).') +
        '</div>') +
      '<div class="iv-subsection-title">Precio sugerido (según el margen que quieras dejar)</div>' +
      '<div class="iv-grid">' +
        '<div><label>Margen de venta %</label><input type="number" class="iv-margin" min="0" max="90" step="1" value="' + Math.round(marginPct * 100) + '"></div>' +
        '<div><label>Utilidad por unidad (al sugerido)</label><span class="iv-profit">' + fmt(utilidad) + '</span></div>' +
        '<div class="iv-full"><label>Precio sugerido (el que se va a aplicar al inventario)</label><input type="number" class="iv-price" min="0" step="100" value="' + it.newPrice + '"></div>' +
        '<div class="iv-full"><button type="button" class="btn-ghost iv-webprice">🌐 Ver a cómo lo tienen en el mercado</button><div class="iv-note iv-webprice-note">' + invEsc(it.webPriceNote || '') + '</div></div>' +
      '</div>' +
    '</div>' +
  '</div>';
}
function fiChipConfianza(it){
  const m = it.match; if(!m) return '';
  const elegido = it.productId && (m.candidatos || []).find(c => c.id === it.productId);
  if(!it.productId) return '<div class="iv-conf nuevo">➕ Producto nuevo' + ((m.candidatos || []).length ? ' · hay ' + m.candidatos.length + ' parecido(s) en la lista' : '') + '</div>';
  if(!elegido) return '<div class="iv-conf manual">✋ Elegido por ti</div>';
  const cls = elegido.conf >= 95 ? 'muy' : elegido.conf >= 85 ? 'alta' : 'revisar';
  const txt = elegido.conf >= 95 ? 'Coincidencia muy alta' : elegido.conf >= 85 ? 'Coincidencia alta' : 'Posible coincidencia: revísela';
  return '<div class="iv-conf ' + cls + '">' + (cls === 'revisar' ? '⚠️ ' : '✅ ') + txt + ' · ' + elegido.conf + '% <small>(' + invEsc(elegido.motivo || '') + ')</small></div>';
}
function fiHeaderHtml(){
  const h = invoiceDraft.header || {};
  const val = k => k === 'supplier' ? (invoiceDraft.supplier || h.supplier || '') : (h[k] == null ? '' : h[k]);
  const esNum = k => ['subtotal', 'iva', 'retenciones', 'otrosImpuestos', 'descuentos', 'total'].includes(k);
  const esFecha = k => /Date$/.test(k);
  const clave = new Set(['invoiceNumber', 'supplier', 'supplierNit', 'issueDate', 'subtotal', 'total']);
  const campo = ([k, lab]) => { const v = val(k), falta = v === '' || v == null, fuerte = falta && clave.has(k);
    return '<div class="ivh-f' + (fuerte ? ' falta' : falta ? ' vacio' : '') + '"><label>' + lab + (falta ? ' <em>Revisar dato</em>' : '') + '</label>' +
      '<input data-h="' + k + '" type="' + (esNum(k) ? 'number' : esFecha(k) ? 'date' : 'text') + '"' + (esNum(k) ? ' min="0" step="1"' : ' maxlength="' + (k === 'cufe' ? 120 : 80) + '"') + ' value="' + invEsc(String(v)) + '"></div>'; };
  const principales = FI_CAMPOS.slice(0, 11), otros = FI_CAMPOS.slice(11);
  return '<div class="ivh-grid">' + principales.map(campo).join('') + '</div>' +
    '<details class="ivh-mas"><summary>Más datos (dirección, teléfono, pago, CUFE…)</summary><div class="ivh-grid">' + otros.map(campo).join('') + '</div></details>';
}
function fiPintarAvisos(){
  const box = document.getElementById('ivAvisos'); if(!box || !invoiceDraft) return;
  const av = fiValidar(invoiceDraft);
  box.innerHTML = av.length ? '<div class="iv-avisos"><b>⚠️ Para revisar (' + av.length + ')</b><ul>' + av.map(a => '<li class="iva-' + a.tipo + '">' + invEsc(a.txt) + '</li>').join('') + '</ul></div>' : '<div class="iv-avisos ok">✅ Los valores cuadran y no hay datos dudosos.</div>';
  const ia = document.getElementById('ivIaMsg'); if(ia){ ia.hidden = !invoiceDraft.iaMsg; ia.textContent = invoiceDraft.iaMsg || ''; }
}
function renderInvoiceReview(){
  const hb = document.getElementById('ivHeader'); if(hb) hb.innerHTML = fiHeaderHtml();
  document.getElementById('invoiceBody').innerHTML = invoiceDraft.items.map(invoiceRowHtml).join('');
  const ct = document.getElementById('ivCatTodos'); if(ct) ct.innerHTML = fiCatTodosHtml();
  fiPintarAvisos();
}
document.getElementById('ivHeader').addEventListener('input', e => {
  const el = e.target.closest('[data-h]'); if(!el || !invoiceDraft) return;
  const k = el.dataset.h, v = el.value.trim();
  invoiceDraft.header = invoiceDraft.header || {};
  if(k === 'supplier') invoiceDraft.supplier = v;
  invoiceDraft.header[k] = v === '' ? null : (el.type === 'number' ? Number(v) : v);
  if(k === 'issueDate') invoiceDraft.date = v;
  clearTimeout(fiPintarAvisos.t); fiPintarAvisos.t = setTimeout(fiPintarAvisos, 300);
});
document.getElementById('invoiceBody').addEventListener('change', e => {
  if(!invoiceDraft || !e.target.closest('.iv-item')) return;
  invoiceReadRow(e.target.closest('.iv-item'));
  if(e.target.classList.contains('iv-match')){
    const row = e.target.closest('.iv-item'), it = invoiceDraft.items[+row.dataset.i];
    const chip = row.querySelector('.iv-conf'); if(chip) chip.outerHTML = fiChipConfianza(it);
  }
  clearTimeout(fiPintarAvisos.t); fiPintarAvisos.t = setTimeout(fiPintarAvisos, 300);
});
function invFindDuplicate(name){                 // como invMatch, pero también prueba una coincidencia exacta (dupKey)
  const exact = data.products.find(p => dupKey(p) === dupKey({ name }));
  return exact || invMatch(name);
}
function invoiceMatchItems(rawItems, proveedor){    // arma las filas de revisión a partir de lo que leyó la IA o el OCR
  const n01 = v => (v == null || v === '' || isNaN(Number(v))) ? null : Number(v);
  return (rawItems || [])
    // Regla clave: un renglón solo es un producto si tiene precio. Sin
    // precio (0 o vacío) no se muestra como "detectado" — así el nombre
    // esté en clave o abreviado, lo que lo hace producto es el precio.
    .filter(x => x && (x.name || x.original) && (Number(x.qty) > 0) && (Number(x.unit_cost) > 0))
    .slice(0, 60)
    .map(x => {
      const original = String(x.original || x.name || '').trim().slice(0, 120);   // nunca se borra
      const pres = fiPresentacion(original + ' ' + (x.presentation || ''));
      const upp = n01(x.units_per_package) || pres.unidadesPorPaquete || null;
      const match = fiCoincidir({ name: x.name || original, originalDescription: original, sku: x.sku, barcode: x.barcode }, proveedor);
      const matched = match.productId ? data.products.find(p => p.id === match.productId) : null;
      const cost = Math.round((Number(x.unit_cost) || 0) * 100) / 100;   // con centavos: así cantidad × costo da el total exacto
      const marginPct = invoiceInferMargin(matched);
      const qty = Math.max(1, Math.round(Number(x.qty) || 1));
      const lineTotal = n01(x.line_total);
      // Desglose por cajas/paquetes (si el escaneo sin internet lo trajo) o,
      // si no, un desglose "de 1 sola caja" equivalente para poder editarlo
      // igual (cuántas cajas llegaron, unidades por caja, precio sin IVA…).
      const cajas = x.cajas != null ? Math.max(1, Math.round(Number(x.cajas) || 1)) : 1;
      const unidadesPorCaja = x.unidades_por_caja != null ? Math.max(1, Math.round(Number(x.unidades_por_caja) || 1)) : qty;
      let ivaLeido = n01(x.iva_pct); if(ivaLeido != null && ivaLeido > 0 && ivaLeido < 1) ivaLeido = Math.round(ivaLeido * 100);
      const ivaPct = ivaLeido != null ? ivaLeido / 100 : 0;
      // Precio sin IVA POR CAJA (el campo de la revisión es por caja): antes se llenaba con el costo de UNA
      // unidad y el «Total de la compra» mostraba el precio de una sola unidad.
      const costoSinIva = x.costo_sin_iva != null ? Math.max(0, Number(x.costo_sin_iva) || 0) : (ivaPct > 0 ? cost / (1 + ivaPct) : cost) * unidadesPorCaja;
      // Si la cantidad coincide con las unidades del paquete pero el total del renglón es el
      // de un solo paquete, seguramente se tomó la presentación como cantidad: se avisa.
      const qtyDeColumna = !(upp > 1 && qty === upp && lineTotal != null && Math.abs(lineTotal - cost) <= Math.max(50, cost * 0.02));
      // Peso o volumen de CADA unidad. «MAGGI 24X594G» comprado por paquete: los 594 g son del paquete completo,
      // así que cada unidad pesa 594 ÷ 24 = 24,75 g. Si se compraron sueltas («LECHERA 48X80G», 4 a $2.742) o
      // el resultado no tiene sentido (menos de 5 g o ml), el peso escrito ya es el de cada unidad.
      // Solo se divide sola cuando el peso NO es un tamaño típico de una unidad (594 g sí se divide; 300 g, 80 g o
      // 1000 ml no: «JABON REY 3X300G» son 3 barras de 300 g). En la revisión hay un botón para cambiarlo a mano.
      let pesoU = null, volU = null, pesoNota = '', pesoOpc = null;
      const repartido = upp > 1 && Number(x.unidades_por_caja) === upp;
      if(pres.orden === 'nx' && upp > 1 && (pres.pesoG > 0 || pres.volumenMl > 0)){
        const tot = pres.pesoG > 0 ? pres.pesoG : pres.volumenMl, cada = tot / upp, u = pres.pesoG > 0 ? 'g' : 'ml';
        if(cada >= 5){
          const r = Math.round(cada * 100) / 100, f = v => String(v).replace('.', ',') + ' ' + u;
          pesoOpc = { div: f(r), tot: f(tot), nota: f(tot) + ' ÷ ' + upp + ' = ' + f(r) + ' cada una', u, r, total: tot, upp };
          if(repartido && Math.round(tot) % 5 !== 0){ if(u === 'g') pesoU = r; else volU = r; pesoNota = pesoOpc.nota; }
        }
      }
      return {
        name: (matched ? (x.name || original) : (x.nombreIA && x.name && !pesoNota) ? String(x.name) : (pesoNota ? fiNombreSugerido(original).replace(new RegExp('\\b' + String(pres.contenido).replace('.', '[.,]') + '\\s*' + (pesoU ? 'g' : 'ml') + '\\b', 'i'), String(pesoU || volU).replace('.', ',') + ' ' + (pesoU ? 'g' : 'ml')) : fiNombreSugerido(original))).slice(0, 60),
        originalDescription: original,
        sku: x.sku ? String(x.sku).slice(0, 30) : null, barcode: x.barcode ? String(x.barcode).replace(/\D/g, '').slice(0, 14) || null : null,
        brand: x.brand || fiNormalizar(original).marca || null, unit: x.unit || null,
        presentation: pesoNota ? upp + ' x ' + String(pesoU || volU).replace('.', ',') + ' ' + (pesoU ? 'g' : 'ml') + ' (' + (pres.presentacion || '').replace(/^\d+ x /, '') + ' en total)' : (x.presentation || pres.presentacion || ''), unitsPerPackage: upp,
        contentPerUnit: pesoNota ? String(pesoU || volU).replace('.', ',') + ' ' + (pesoU ? 'g' : 'ml') : (x.content_per_unit || (pres.contenido != null ? String(pres.contenido).replace('.', ',') + (pres.unidadContenido ? ' ' + pres.unidadContenido : '') : null)),
        pesoNota, pesoOpc, pesoModo: pesoNota ? 'div' : 'tot', weightG: pesoNota ? pesoU : pres.pesoG, volumeMl: pesoNota ? volU : pres.volumenMl, discount: n01(x.discount), ivaPctLeido: ivaLeido, ivaValue: n01(x.iva_value), lineTotal,
        qtyDeColumna, qtyFalta: !!x.qty_falta, match, noCuadra: x.cuadra === false, ajustes: Array.isArray(x.ajustes) ? x.ajustes.slice(0, 4) : [],
        lineSubtotal: n01(x.line_subtotal), lineIva: n01(x.line_iva),
        qty, cost, cajas, unidadesPorCaja, costoSinIva, ivaPct,
        productId: match.productId || '',
        marginPct,
        newPrice: invoicePriceFromMargin(cost, marginPct) || (matched ? matched.price : 0),
        precioActual: matched ? matched.price : null,
        include: true,
        orig: { productId: match.productId || '', qty, cost }
      };
    });
}
/* ---------- Barra de progreso mientras carga/analiza la foto de la factura ----------
   Mientras está cargando solo se ve la barra con el porcentaje: el botón
   "Aplicar al inventario" se esconde (no tiene nada que aplicar todavía) y
   vuelve a aparecer cuando termina el análisis y hay algo que revisar. */
let invoiceProgressTimer = null;
let invoiceProgressHigh = 0;   // nunca deja que la barra retroceda (ej. si el OCR reintenta una segunda pasada)
let invoiceProgressReal = false; // true en cuanto llega progreso real (OCR sin internet): apaga la simulación
function invoiceProgressStart(){
  const applyBtn = document.getElementById('invoiceApplyBtn');
  if(applyBtn) applyBtn.hidden = true;
  const wrap = document.getElementById('invoiceProgress'), fill = document.getElementById('invoiceProgressFill'), pctEl = document.getElementById('invoiceProgressPct');
  if(!wrap || !fill || !pctEl) return;
  clearInterval(invoiceProgressTimer);
  wrap.hidden = false;
  invoiceProgressHigh = 0; invoiceProgressReal = false;
  let p = 0;
  fill.style.width = '0%'; pctEl.textContent = '0%';
  // No hay un progreso real disponible con la IA (es una sola llamada), así
  // que se simula un avance que se acerca a 92% y se queda ahí esperando —
  // invoiceProgressSet() lo reemplaza con el progreso real cuando sí existe
  // (lectura sin internet) y apaga esta simulación, e invoiceProgressDone()
  // lo cierra a 100% al final.
  invoiceProgressTimer = setInterval(() => {
    if(invoiceProgressReal) return;
    p += (92 - p) * 0.07 + 0.4;
    if(p > 92) p = 92;
    invoiceProgressHigh = Math.max(invoiceProgressHigh, p);
    fill.style.width = invoiceProgressHigh.toFixed(0) + '%';
    pctEl.textContent = invoiceProgressHigh.toFixed(0) + '%';
  }, 220);
}
function invoiceProgressSet(pct0a100){
  const fill = document.getElementById('invoiceProgressFill'), pctEl = document.getElementById('invoiceProgressPct');
  if(!fill || !pctEl) return;
  invoiceProgressReal = true;
  const v = Math.max(0, Math.min(99, Math.round(pct0a100)));
  invoiceProgressHigh = Math.max(invoiceProgressHigh, v);
  fill.style.width = invoiceProgressHigh + '%'; pctEl.textContent = invoiceProgressHigh + '%';
}
function invoiceProgressDone(){
  clearInterval(invoiceProgressTimer); invoiceProgressTimer = null;
  const wrap = document.getElementById('invoiceProgress'), fill = document.getElementById('invoiceProgressFill'), pctEl = document.getElementById('invoiceProgressPct');
  if(fill) fill.style.width = '100%';
  if(pctEl) pctEl.textContent = '100%';
  setTimeout(() => {
    if(wrap) wrap.hidden = true;
    const applyBtn = document.getElementById('invoiceApplyBtn');
    if(applyBtn) applyBtn.hidden = false;
  }, 200);
}
function invoiceOpen(info){
  invoiceProgressDone();
  fiEstado('Analizando factura…');
  const header = fiUnirEncabezado(info.header || {}, fiEncabezado(info.rawText || info.textoPdf || ''));
  header.supplier = info.supplier || header.supplier || '';
  if(info.rawText){
    const mios = fiParsearRenglones(info.rawText), viejos = (info.items || []);
    if(mios.length && (mios.length > viejos.length || mios.filter(x => x.cuadra).length >= viejos.length)) info.items = mios;
  }
  if(!header.issueDate && info.date) header.issueDate = info.date;
  fiEstado('Calculando cantidades, IVA y costo por unidad…');
  info.items = fiCuadrar(info.items, header);
  fiEstado('Buscando producto…');
  const items = invoiceMatchItems(info.items, header.supplier);
  invoiceDraft = { supplier: header.supplier, date: header.issueDate || info.date || '', header, items, rawText: info.rawText || '',
    archivo: window.__fiArchivo || null, archivos: window.__fiArchivos || null, fuente: info.fuente || (info.rawText ? 'ocr' : 'ia'), iaMsg: '' };
  window.__fiArchivo = null; window.__fiArchivos = null;
  invoiceResumen(info);
  renderInvoiceReview();
  const rawWrap = document.getElementById('invoiceRawWrap'), rawBox = document.getElementById('invoiceRawText');
  if(info.rawText){ rawBox.value = info.rawText; rawWrap.hidden = false; }
  else { rawBox.value = ''; rawWrap.hidden = true; rawWrap.open = false; }
  document.getElementById('invoiceOverlay').classList.add('show');
  // ORDEVA IA solo para los renglones que quedaron en duda (nunca para lo seguro).
  const draft = invoiceDraft;
  fiDesempatarConIA(items).then(r => {
    if(invoiceDraft !== draft) return;
    if(r.sinIA || r.falla) draft.iaMsg = 'IA temporalmente no disponible. Revise los datos.';
    else if(r.usada) draft.iaMsg = '🧠 ORDEVA IA ayudó a elegir en los productos dudosos (confírmelos).';
    // (lo que el usuario cambie mientras tanto ya quedó en el borrador: cada cambio se lee al instante)
    renderInvoiceReview(); invoiceResumen(info);
  }).catch(() => {});
}
// Línea de resumen + estado «Listo para revisar».
function invoiceResumen(info){
  const items = invoiceDraft.items, ya = items.filter(it => it.productId).length, dudas = items.filter(it => it.match && it.match.revisar && it.productId).length;
  fiEstado(items.length
    ? 'Listo para revisar: ' + items.length + ' producto' + (items.length > 1 ? 's' : '') + (invoiceDraft.supplier ? ' de ' + invoiceDraft.supplier.replace(/\.+$/, '') : '') + '. ' +
      (ya ? ya + ' ya estaba' + (ya > 1 ? 'n' : '') + ' en tu inventario' + (dudas ? ' (' + dudas + ' por confirmar)' : '') + '. ' : '') + 'Revisa y corrige antes de aplicar.'
    : 'No se pudo detectar correctamente el texto. Puede intentar nuevamente o editar manualmente.');
}
document.getElementById('invoiceRawReparseBtn').addEventListener('click', () => {
  if(!invoiceDraft) return;
  if(!window.VitoOfflineOCR || !window.VitoOfflineOCR.parseTextToInvoiceItems){ showToast('Esta función solo funciona con la lectura sin internet.'); return; }
  const text = document.getElementById('invoiceRawText').value;
  let rawItems;
  try{ rawItems = window.VitoOfflineOCR.parseTextToInvoiceItems(text); const mios = fiParsearRenglones(text); if(mios.length >= (rawItems || []).length) rawItems = mios; }
  catch(e){ showToast('No pude releer el texto: ' + (e && e.message ? e.message : 'error desconocido.')); return; }
  invoiceDraft.header = fiUnirEncabezado(invoiceDraft.header || {}, fiEncabezado(text));
  const items = invoiceMatchItems(fiCuadrar(rawItems, invoiceDraft.header), invoiceDraft.supplier);
  invoiceDraft.items = items;
  invoiceDraft.rawText = text;
  document.getElementById('invoiceSub').textContent = items.length
    ? 'Releído: ' + items.length + ' producto' + (items.length > 1 ? 's' : '') + '. Revisa y corrige lo que haga falta antes de aplicar.'
    : 'No logré separar productos en el texto corregido. Ajusta el texto e inténtalo de nuevo.';
  renderInvoiceReview();
  showToast('🔄 Texto releído.');
});
function invoiceReadRow(el){
  const i = +el.dataset.i, it = invoiceDraft.items[i]; if(!it) return it;
  const nameEl = el.querySelector('.iv-name-in');
  if(nameEl){ const v = nameEl.value.trim(); if(v) it.name = v.slice(0, 60); }
  it.include = el.querySelector('.iv-inc').checked;
  const pidAntes = it.productId;
  it.productId = el.querySelector('.iv-match').value;
  // Otro producto elegido: su categoría y su código se vuelven a sugerir (salvo que ya los hayas puesto tú).
  if((pidAntes || '') !== (it.productId || '')){ if(!it.catTocada) it.categoryId = undefined; if(!it.codTocado) it.codigo = undefined; }
  else {
    const catEl = el.querySelector('.iv-cat'), codEl = el.querySelector('.iv-code');
    if(catEl && catEl.value !== '__nueva' && catEl.value !== String(it.categoryId || '')){ it.categoryId = catEl.value; it.catTocada = true; }
    if(codEl){ const v = codEl.value.trim().slice(0, 40); if(v !== (it.codigo || '')){ it.codigo = v; it.codTocado = true; } }
  }
  const qAntes = it.qty, cAntes = it.cost;
  it.qty = Math.max(0, Math.round(invNum(el.querySelector('.iv-qty').value) || 0));
  const cLeido = Math.max(0, invNum(el.querySelector('.iv-cost').value) || 0);
  if(Math.abs(cLeido - (cAntes || 0)) >= 1) it.cost = cLeido;          // si no lo cambiaron, se conservan los centavos calculados
  if(it.noCuadra && (it.qty !== qAntes || Math.round(it.cost) !== Math.round(cAntes))) it.noCuadra = false;   // ya lo corrigió el usuario
  const marginEl = el.querySelector('.iv-margin');
  if(marginEl) it.marginPct = Math.max(0, Math.min(0.9, invNum(marginEl.value, 0) / 100));
  it.newPrice = Math.max(0, invNum(el.querySelector('.iv-price').value) || 0);
  const cajasEl = el.querySelector('.iv-cajas'), unidxEl = el.querySelector('.iv-unidxcaja'),
    siEl = el.querySelector('.iv-costosiniva'), ivaEl = el.querySelector('.iv-ivapct');
  if(cajasEl) it.cajas = Math.max(1, Math.round(invNum(cajasEl.value, 1) || 1));
  if(unidxEl) it.unidadesPorCaja = Math.max(1, Math.round(invNum(unidxEl.value, 1) || 1));
  if(siEl) it.costoSinIva = Math.max(0, invNum(siEl.value, 0) || 0);
  if(ivaEl) it.ivaPct = Math.max(0, Math.min(0.3, invNum(ivaEl.value, 0) / 100));
  const paEl = el.querySelector('.iv-precioactual');
  if(paEl){ const v = paEl.value.trim(); it.precioActual = v === '' ? null : Math.max(0, invNum(v, 0) || 0); }
  const presEl = el.querySelector('.iv-pres'), uniEl = el.querySelector('.iv-unidad');
  if(presEl) it.presentation = presEl.value.trim().slice(0, 40);
  if(uniEl) it.unit = uniEl.value.trim().slice(0, 12) || null;
  return it;
}
// «$60.000 ÷ 24 unid. = $2.500 c/u»: la división a la vista, para saber de dónde sale el costo por unidad.
function fiDivisionTxt(it){
  const total = (it.cajas || 1) * (it.costoSinIva || 0) * (1 + (it.ivaPct || 0)), q = Math.max(1, it.qty || 1);
  if(!(total > 0)) return '';
  return '🧮 Total del renglón ' + fmt(Math.round(total)) + ' ÷ ' + q + (q === 1 ? ' unidad' : ' unidades') + ' = <b>' + fmt(Math.round(total / q)) + '</b> cada una' + ((it.cajas || 1) > 1 ? ' (' + it.cajas + ' × ' + it.unidadesPorCaja + ')' : '');
}
function invoiceRecalcFromBox(it){                // recalcula cantidad y costo/unidad a partir de cajas × unid./caja × precio (con IVA)
  it.qtyFalta = false;
  const totalUnidades = Math.max(1, (it.cajas || 1) * (it.unidadesPorCaja || 1));
  const costoTotalConIva = (it.cajas || 1) * (it.costoSinIva || 0) * (1 + (it.ivaPct || 0));
  it.qty = totalUnidades;
  it.cost = Math.round(costoTotalConIva / totalUnidades);
  it.newPrice = invoicePriceFromMargin(it.cost, it.marginPct) || it.newPrice;
}
function invoiceApplyFieldChange(it, cls, target){  // recalcula el item según qué campo cambió (sin tocar el DOM)
  if(cls.contains('iv-match') || cls.contains('iv-cost')){
    if(cls.contains('iv-cost')){
      // Cambió el costo por unidad a mano: por dentro convertimos ese valor
      // de vuelta al precio por caja sin IVA, para que "Cajas/paquetes" y
      // "Total de la compra" sigan cuadrando con lo que se ve arriba.
      const unidadesPorCaja = it.unidadesPorCaja || 1, ivaPct = it.ivaPct || 0;
      it.costoSinIva = ivaPct > -1 ? (it.cost * unidadesPorCaja) / (1 + ivaPct) : it.cost * unidadesPorCaja;
    }
    // Cambió el producto emparejado o el costo: recalculamos el margen (el
    // que ya tenía ese producto, o el sano por defecto) y el precio sugerido.
    const matched = it.productId ? data.products.find(p => p.id === it.productId) : null;
    it.marginPct = invoiceInferMargin(matched);
    it.newPrice = invoicePriceFromMargin(it.cost, it.marginPct) || (matched ? matched.price : 0);
  } else if(cls.contains('iv-margin')){
    // Cambió el margen de venta a mano: el precio de venta se recalcula solo.
    it.newPrice = invoicePriceFromMargin(it.cost, it.marginPct);
  } else if(cls.contains('iv-price')){
    // Cambió el precio de venta a mano: el margen mostrado se ajusta solo,
    // para que siempre cuadren entre sí.
    it.marginPct = it.newPrice > 0 ? Math.max(0, (it.newPrice - it.cost) / it.newPrice) : it.marginPct;
  } else if(cls.contains('iv-qty')){
    // Cambió la cantidad de unidades a mano: lo que dice la factura es cuánto se PAGÓ por el renglón, así que ese
    // total se mantiene y se DIVIDE entre las unidades (antes se dejaba el costo por unidad y el total se multiplicaba).
    const q = Math.max(1, it.qty || 1), iva = it.ivaPct || 0;
    const total = (it.cajas || 1) * (it.costoSinIva || 0) * (1 + iva);
    if(q % (it.cajas || 1) === 0) it.unidadesPorCaja = q / (it.cajas || 1); else { it.cajas = 1; it.unidadesPorCaja = q; }
    it.qty = q;
    if(total > 0){
      it.costoSinIva = total / (it.cajas * (1 + iva));
      it.cost = Math.round(total / q * 100) / 100;
      it.newPrice = invoicePriceFromMargin(it.cost, it.marginPct) || it.newPrice;
    }
    it.qtyFalta = false;
  } else if(cls.contains('iv-cajas') || cls.contains('iv-unidxcaja') || cls.contains('iv-costosiniva') || cls.contains('iv-ivapct')){
    // Cambió algo del desglose por cajas/paquetes: recalculamos la cantidad
    // total y el costo por unidad, y de ahí el precio de venta sugerido.
    invoiceRecalcFromBox(it);
  } else if(cls.contains('iv-costoconiva')){
    // Precio de la caja YA con IVA, escrito directo: despejamos el precio
    // sin IVA para que el resto de los cálculos sigan cuadrando.
    const ivaPct = it.ivaPct || 0;
    const nuevo = Math.max(0, invNum(target.value, 0) || 0);
    it.costoSinIva = ivaPct > -1 ? nuevo / (1 + ivaPct) : nuevo;
    invoiceRecalcFromBox(it);
  } else if(cls.contains('iv-totalcompra')){
    // Total de la compra (con IVA) escrito directo, ej. lo que dice la
    // factura: despejamos el precio por caja sin IVA a partir de ese total.
    const cajas = it.cajas || 1, ivaPct = it.ivaPct || 0;
    const totalConIva = Math.max(0, invNum(target.value, 0) || 0);
    it.costoSinIva = ivaPct > -1 ? totalConIva / (cajas * (1 + ivaPct)) : totalConIva / cajas;
    invoiceRecalcFromBox(it);
  }
  // iv-precioactual e iv-inc no necesitan recalcular nada más del item: el
  // primero solo se compara contra el costo, y el segundo es un check simple.
}
function invoiceRowComputed(it){                    // los mismos valores derivados que arma invoiceRowHtml, para refrescar la fila en vivo
  const matched = it.productId ? data.products.find(p => p.id === it.productId) : null;
  const marginPct = typeof it.marginPct === 'number' ? it.marginPct : invoiceInferMargin(matched);
  const utilidad = it.newPrice > 0 ? it.newPrice - it.cost : 0;
  const cajas = it.cajas || 1, unidadesPorCaja = it.unidadesPorCaja || 1, ivaPct = it.ivaPct || 0, costoSinIva = it.costoSinIva || 0;
  const costoConIvaPorCaja = costoSinIva * (1 + ivaPct);
  const totalCompraConIva = cajas * costoConIvaPorCaja;
  const precioActual = typeof it.precioActual === 'number' ? it.precioActual : null;
  const margenActual = (precioActual != null && precioActual > 0) ? (precioActual - it.cost) / precioActual : null;
  const utilidadActual = precioActual != null ? precioActual - it.cost : null;
  return { matched, marginPct, utilidad, cajas, unidadesPorCaja, ivaPct, costoSinIva, costoConIvaPorCaja, totalCompraConIva, precioActual, margenActual, utilidadActual };
}
// Actualiza en vivo, mientras se escribe, todos los valores calculados de una
// fila SIN reconstruir su HTML — así no se pierde el foco ni el cursor de lo
// que se está escribiendo (a diferencia de renderInvoiceReview(), que sí
// reconstruye todo y solo se usa para cambios "estructurales", como elegir
// otro producto en "Coincide con").
function invoiceUpdateRowLive(row, it){
  const c = invoiceRowComputed(it);
  const setVal = (sel, val) => { const el = row.querySelector(sel); if(el && el !== document.activeElement) el.value = val; };
  setVal('.iv-qty', it.qty);
  setVal('.iv-cost', it.cost);
  setVal('.iv-margin', Math.round(c.marginPct * 100));
  setVal('.iv-price', it.newPrice);
  setVal('.iv-precioactual', c.precioActual != null ? Math.round(c.precioActual) : '');
  setVal('.iv-cajas', c.cajas);
  setVal('.iv-unidxcaja', c.unidadesPorCaja);
  setVal('.iv-costosiniva', Math.round(c.costoSinIva));
  setVal('.iv-ivapct', Math.round(c.ivaPct * 100));
  setVal('.iv-costoconiva', Math.round(c.costoConIvaPorCaja));
  setVal('.iv-totalcompra', Math.round(c.totalCompraConIva));

  const profitEl = row.querySelector('.iv-profit'); if(profitEl) profitEl.textContent = fmt(c.utilidad);
  const dsg = row.querySelector('.iv-desglose'); if(dsg) dsg.innerHTML = fiDesgloseHtml(it);
  const margenActualEl = row.querySelector('.iv-actual-margen');
  if(margenActualEl){
    margenActualEl.textContent = c.margenActual == null ? '—' : Math.round(c.margenActual * 100) + '%';
    margenActualEl.className = 'iv-actual-margen ' + (c.margenActual == null ? '' : (c.margenActual < 0 ? 'bad' : 'good'));
  }
  const dv = row.querySelector('.iv-division'); if(dv) dv.innerHTML = fiDivisionTxt(it);
  if(!it.qtyFalta){ const fm = row.querySelector('.iv-falta-msg'); if(fm) fm.remove(); const qi = row.querySelector('.iv-qty'); if(qi) qi.classList.remove('iv-falta'); }
  const totalLabel = row.querySelector('.iv-totalcompra') && row.querySelector('.iv-totalcompra').previousElementSibling;
  if(totalLabel) totalLabel.textContent = 'Total de la compra (' + c.cajas + ' × ' + c.unidadesPorCaja + ' = ' + (c.cajas * c.unidadesPorCaja) + ' unid., con IVA)';

  let verdictEl = row.querySelector('.iv-actual-verdict');
  if(c.utilidadActual == null){
    if(verdictEl) verdictEl.remove();
  } else {
    if(!verdictEl){
      verdictEl = document.createElement('div');
      const marginRow = row.querySelector('.iv-precioactual') && row.querySelector('.iv-precioactual').closest('.iv-grid');
      if(marginRow) marginRow.insertAdjacentElement('afterend', verdictEl);
    }
    if(verdictEl){
      verdictEl.className = 'iv-actual-verdict ' + (c.utilidadActual < 0 ? 'bad' : (c.utilidadActual === 0 ? '' : 'good'));
      verdictEl.textContent = c.utilidadActual < 0
        ? '⚠️ Estás PERDIENDO ' + fmt(Math.abs(c.utilidadActual)) + ' por unidad al precio actual (costo ' + fmt(it.cost) + ' vs. venta ' + fmt(c.precioActual) + ').'
        : c.utilidadActual === 0
          ? '➖ Ni ganas ni pierdes: vendes exactamente al costo (' + fmt(it.cost) + ').'
          : '✅ Estás GANANDO ' + fmt(c.utilidadActual) + ' por unidad al precio actual (' + Math.round(c.margenActual * 100) + '% de margen).';
    }
  }
}
// ⚖️ Cambiar a mano si el peso escrito es del paquete completo (se divide) o de cada unidad.
document.getElementById('invoiceBody').addEventListener('click', e => {
  const b = e.target.closest('.iv-peso-flip'); if(!b || !invoiceDraft) return;
  const row = b.closest('.iv-item'); const it = row && invoiceDraft.items[+row.dataset.i]; if(!it || !it.pesoOpc) return;
  const po = it.pesoOpc, div = it.pesoModo !== 'div';
  it.pesoModo = div ? 'div' : 'tot'; it.contentPerUnit = div ? po.div : po.tot; it.pesoNota = div ? po.nota : '';
  if(po.u === 'g'){ it.weightG = div ? po.r : po.total; } else { it.volumeMl = div ? po.r : po.total; }
  it.presentation = po.upp + ' x ' + (div ? po.div + ' (' + po.tot + ' en total)' : po.tot);
  const pr = row.querySelector('.iv-pres'); if(pr) pr.value = it.presentation;
  const dsg = row.querySelector('.iv-desglose'); if(dsg) dsg.innerHTML = fiDesgloseHtml(it);
});
document.getElementById('invoiceBody').addEventListener('input', e => {
  // Escribir en cualquier campo numérico recalcula todo en vivo, en el
  // momento, sin esperar a que el campo pierda el foco.
  if(e.target.tagName === 'SELECT' || e.target.type === 'checkbox') return;
  const row = e.target.closest('.iv-item'); if(!row || !invoiceDraft) return;
  const it = invoiceReadRow(row);
  invoiceApplyFieldChange(it, e.target.classList, e.target);
  invoiceUpdateRowLive(row, it);
});
document.getElementById('invoiceBody').addEventListener('change', e => {
  // "Coincide con" (select) e "incluir" (checkbox) sí reconstruyen la fila
  // completa: cambian cosas estructurales (nombre emparejado, insignias).
  const row = e.target.closest('.iv-item'); if(!row || !invoiceDraft) return;
  if(e.target.classList.contains('iv-match')){
    const it = invoiceReadRow(row);
    invoiceApplyFieldChange(it, e.target.classList, e.target);
    renderInvoiceReview();
  } else if(e.target.classList.contains('iv-inc')){
    const it = invoiceReadRow(row);
    row.classList.toggle('iv-skip', !it.include);
  }
});
document.getElementById('invoiceBody').addEventListener('click', async e => {
  const b = e.target.closest('.iv-webprice'); if(!b || !invoiceDraft) return;
  const row = b.closest('.iv-item'); if(!row) return;
  const i = +row.dataset.i, it = invoiceDraft.items[i]; if(!it) return;
  const nm = it.name.trim(); if(!nm){ showToast('Escribe el nombre del producto primero.'); return; }
  const lbl = b.textContent, note = row.querySelector('.iv-webprice-note');
  b.disabled = true; b.textContent = '🌐 Buscando…'; if(note) note.textContent = '';
  try{
    const r = await pcWebPrice(nm);
    if(!invoiceDraft || invoiceDraft.items[i] !== it) return;   // se canceló o se cambió la factura mientras buscaba
    it.webPriceNote = (r && Number(r.price) > 0)
      ? '🌐 En el mercado lo tienen alrededor de ' + fmt(Math.round(Number(r.price))) + (r.source ? ' (' + r.source + ')' : '') + '. Es un estimado de internet: verifícalo antes de usarlo.'
      : 'No encontré un precio confiable en internet para comparar.';
  }catch(err){
    if(!invoiceDraft || invoiceDraft.items[i] !== it) return;
    it.webPriceNote = err && err.message === 'NO_API_KEY' ? 'Configura la IA (⚙️ en Productos) para buscar precios en internet.' : '❌ ' + (err && err.message ? err.message : 'No se pudo buscar el precio.');
  }finally{
    b.disabled = false; b.textContent = lbl;
    const freshNote = row.querySelector('.iv-webprice-note'); if(freshNote) freshNote.textContent = it.webPriceNote || '';
  }
});
// Categoría «➕ Nueva…», crear, escanear el código y «Poner a todos la categoría».
document.getElementById('invoiceBody').addEventListener('change', e => {
  const sel = e.target.closest('.iv-cat'); if(!sel || !invoiceDraft) return;
  const row = sel.closest('.iv-item'), it = invoiceDraft.items[+row.dataset.i];
  if(sel.value === '__nueva'){
    sel.value = (it && it.categoryId) || '';
    const box = row.querySelector('.iv-catnew'); box.hidden = false; const inp = box.querySelector('.iv-catnew-in'); inp.value = ''; inp.focus();
  }
});
function fiCatNuevaEnFila(row){
  const it = invoiceDraft && invoiceDraft.items[+row.dataset.i]; if(!it) return;
  const inp = row.querySelector('.iv-catnew-in'), id = fiCrearCategoria(inp.value);
  if(!id){ showToast('Escribe el nombre de la categoría.'); inp.focus(); return; }
  document.querySelectorAll('#invoiceBody .iv-item').forEach(invoiceReadRow);
  it.categoryId = id; it.catTocada = true;
  renderInvoiceReview(); showToast('🏷️ Categoría «' + inp.value.trim() + '» creada.');
}
document.getElementById('invoiceBody').addEventListener('keydown', e => {
  if(e.key === 'Enter' && e.target.classList.contains('iv-catnew-in')){ e.preventDefault(); fiCatNuevaEnFila(e.target.closest('.iv-item')); }
});
document.getElementById('invoiceBody').addEventListener('click', e => {
  if(!invoiceDraft) return;
  const ok = e.target.closest('.iv-catnew-ok'); if(ok){ fiCatNuevaEnFila(ok.closest('.iv-item')); return; }
  const sc = e.target.closest('.iv-code-scan'); if(!sc) return;
  const row = sc.closest('.iv-item'), it = invoiceDraft.items[+row.dataset.i]; if(!it) return;
  openScanOverlay(raw => {
    const v = String(raw || '').trim().slice(0, 40); if(!v) return;
    it.codigo = v; it.codTocado = true;
    const inp = row.querySelector('.iv-code'); if(inp) inp.value = v;
    closeScanOverlay(); showToast('🔢 Código ' + v + ' para ' + (it.name || 'el producto') + '.');
  }, { hint: 'Apunta al código de barras de «' + (it.name || 'el producto') + '».' });
});
document.getElementById('ivCatTodos').addEventListener('change', e => {
  if(e.target.id !== 'ivCatTodosSel') return;
  const nv = document.getElementById('ivCatTodosNueva');
  if(e.target.value === '__nueva'){ e.target.value = ''; nv.hidden = false; const i = document.getElementById('ivCatTodosNuevaIn'); i.value = ''; i.focus(); }
});
function fiCatTodos(id){
  if(!invoiceDraft) return;
  document.querySelectorAll('#invoiceBody .iv-item').forEach(invoiceReadRow);
  invoiceDraft.items.forEach(it => { it.categoryId = id || ''; it.catTocada = true; });
  renderInvoiceReview();
  const c = (data.categories || []).find(k => String(k.id) === String(id));
  showToast('🏷️ ' + (c ? 'Todos quedaron en «' + c.name + '»' : 'Todos quedaron sin categoría') + '. Puedes cambiar la de cada uno.');
}
document.getElementById('ivCatTodos').addEventListener('click', e => {
  if(e.target.id === 'ivCatTodosBtn'){ fiCatTodos(document.getElementById('ivCatTodosSel').value); return; }
  if(e.target.id === 'ivCatTodosNuevaOk'){ const i = document.getElementById('ivCatTodosNuevaIn'), id = fiCrearCategoria(i.value); if(!id){ showToast('Escribe el nombre de la categoría.'); i.focus(); return; } fiCatTodos(id); }
});
document.getElementById('ivCatTodos').addEventListener('keydown', e => { if(e.key === 'Enter' && e.target.id === 'ivCatTodosNuevaIn'){ e.preventDefault(); document.getElementById('ivCatTodosNuevaOk').click(); } });
function invoiceClose(){
  document.getElementById('invoiceOverlay').classList.remove('show'); invoiceDraft = null;
  clearInterval(invoiceProgressTimer); invoiceProgressTimer = null;
  const wrap = document.getElementById('invoiceProgress'); if(wrap) wrap.hidden = true;
  const applyBtn = document.getElementById('invoiceApplyBtn'); if(applyBtn) applyBtn.hidden = false;
}
document.getElementById('invoiceCancelBtn').addEventListener('click', invoiceClose);
document.getElementById('invoiceOverlay').addEventListener('click', e => { if(e.target.id === 'invoiceOverlay') invoiceClose(); });
document.getElementById('invoiceApplyBtn').addEventListener('click', async () => {
  if(!invoiceDraft) return;
  document.querySelectorAll('#invoiceBody .iv-item').forEach(invoiceReadRow);
  const toApply = invoiceDraft.items.filter(it => it.include && it.name && it.qty > 0);
  if(!toApply.length){ showToast('No hay productos marcados para aplicar.'); invoiceClose(); return; }
  // Nada incorrecto se guarda en silencio: si algo no cuadra (totales, cantidad × precio, IVA, precios
  // muy distintos) se muestra la lista y tú decides si corriges o aplicas igual.
  const probs = fiValidar(invoiceDraft).filter(a => ['dup', 'total', 'cant', 'precio', 'iva'].includes(a.tipo));
  if(probs.length && !(await showConfirm({ title: 'ORDEVA encontró ' + probs.length + (probs.length === 1 ? ' cosa por revisar' : ' cosas por revisar'),
    message: probs.slice(0, 6).map(a => '• ' + a.txt).join('\n') + (probs.length > 6 ? '\n• …y ' + (probs.length - 6) + ' más' : '') + '\n\n¿Aplicar de todas formas?', confirmText: 'Sí, aplicar', cancelText: 'Revisar', icon: '🧮' }))) return;
  const draft = invoiceDraft, compraId = Date.now().toString(), fechaFact = (draft.header && draft.header.issueDate) || draft.date || '';
  const archivoId = draft.archivo ? await fiGuardarOriginal(draft.archivo) : null;
  data.inventarioMov = data.inventarioMov || [];
  let updated = 0, created = 0, raised = 0, rectified = 0;
  const purchaseItems = [], raisedDetail = [];
  toApply.forEach(it => {
    let p = it.productId ? data.products.find(x => x.id === it.productId) : null;
    if(!p){
      // Última verificación antes de crear: por si ya existe un producto con
      // ese nombre (evita duplicados aunque no se haya emparejado a mano).
      // solo el MISMO nombre exacto: un parecido nunca se une solo (eso lo decides tú en la revisión)
      p = data.products.find(x => !x.combo && dupKey(x) === dupKey({ name: it.name })) || null;
      if(p) rectified++;
    }
    if(p){
      if(p.cost != null && it.cost > p.cost){
        raised++;
        const pct = p.cost > 0 ? Math.round((it.cost - p.cost) / p.cost * 100) : null;
        raisedDetail.push({ name: p.name, from: p.cost, to: it.cost, pct });
      }
      p.cost = it.cost;
      p.stock = (p.stock || 0) + it.qty;
      if(it.ivaPct > 0 && (p.iva == null || p.iva === '')) p.iva = Math.round(it.ivaPct * 100);
      p.costSinIva = Math.round(it.cost / (1 + (it.ivaPct || 0)) * 100) / 100;
      if(it.newPrice > 0){ p.price = it.newPrice; sincronizarProductoEnMesas(p); }
      // La categoría que elegiste en la revisión (si no la tocaste, solo se pone si el producto no tenía).
      if(it.categoryId !== undefined && (it.catTocada || !p.categoryId)){ const c = fiCatValida(it.categoryId); if(c || it.catTocada) p.categoryId = c; }
      updated++;
    } else {
      p = { id: 'inv-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6), name: it.name, price: it.newPrice || it.cost, categoryId: fiCatValida(it.categoryId),
        size: it.contentPerUnit || '', specifications: '', stock: it.qty, cost: it.cost,
        iva: it.ivaPct > 0 ? Math.round(it.ivaPct * 100) : undefined, costSinIva: Math.round(it.cost / (1 + (it.ivaPct || 0)) * 100) / 100 };
      if(it.presentation || it.unitsPerPackage) p.det = Object.assign({}, p.det, { presentacion: it.presentation || null, unidadesPorPaquete: it.unitsPerPackage || null });
      data.products.push(p);
      created++;
    }
    // Lo que se aprende de esta factura para la próxima: la equivalencia proveedor + descripción
    // → producto, el código del proveedor y el código de barras.
    fiAprender(draft.supplier, it.originalDescription || it.name, p.id);
    if(it.sku){ p.skus = p.skus || []; if(!p.skus.includes(it.sku)) p.skus.push(it.sku); }
    if(it.barcode && it.barcode.length >= 8){ p.barcodes = p.barcodes || []; if(!p.barcodes.includes(it.barcode)) p.barcodes.push(it.barcode); }
    // El código de la revisión queda como código del producto (y se reconoce al escanearlo para vender).
    const cod = String(it.codigo || '').trim();
    if(cod){ p.codigo = cod; p.barcodes = p.barcodes || []; if(!p.barcodes.includes(cod)) p.barcodes.push(cod); }
    if(!p.brand && it.brand) p.brand = it.brand;
    const modificado = it.orig && (it.orig.productId !== it.productId || it.orig.qty !== it.qty || it.orig.cost !== it.cost);
    // Desglose guardado: costo por unidad sin IVA, IVA por unidad, costo con IVA, subtotal, IVA y total.
    const tasa = it.ivaPct || 0, cU = it.cost, sU = cU / (1 + tasa);
    const totL = it.lineTotal != null && Math.abs(it.lineTotal - cU * it.qty) <= Math.max(2, it.lineTotal * 0.01) ? Math.round(it.lineTotal) : Math.round(cU * it.qty);
    const desg = { costoUnitSinIva: Math.round(sU * 100) / 100, ivaUnit: Math.round((cU - sU) * 100) / 100, costoUnitConIva: cU,
      subtotal: Math.round(totL / (1 + tasa)), ivaTotal: Math.round(totL - totL / (1 + tasa)), total: totL, cajas: it.cajas || 1, unidadesPorCaja: it.unidadesPorCaja || it.qty };
    purchaseItems.push({ productId: p.id, name: p.name, qty: it.qty, cost: it.cost, originalDescription: it.originalDescription || '', presentation: it.presentation || '',
      unitsPerPackage: it.unitsPerPackage || null, contentPerUnit: it.contentPerUnit || null, unit: it.unit || null, sku: it.sku || null, barcode: it.barcode || null,
      categoryId: p.categoryId || null, codigo: cod || null,
      taxRate: it.ivaPctLeido != null ? it.ivaPctLeido : Math.round((it.ivaPct || 0) * 100), lineTotal: it.lineTotal != null ? it.lineTotal : totL, matchConfidence: it.match ? it.match.confianza : null, modificado: !!modificado,
      ajustes: it.ajustes || [], ...desg });
    data.inventarioMov.push({ id: compraId + '-' + p.id, tipo: 'entrada', productId: p.id, name: p.name, qty: it.qty, costo: it.cost, unidad: it.unit || 'und', presentacion: it.presentation || '',
      costoSinIva: desg.costoUnitSinIva, ivaUnit: desg.ivaUnit, costoTotal: desg.total, ivaTotal: desg.ivaTotal, proveedor: draft.supplier || '',
      fecha: fechaFact, factura: (draft.header && draft.header.invoiceNumber) || '', compraId, usuario: authUser || '', at: Date.now() });
  });
  if(data.inventarioMov.length > 5000) data.inventarioMov = data.inventarioMov.slice(-4000);
  data.purchases = data.purchases || [];
  data.purchases.unshift({ id: compraId, supplier: draft.supplier || '', date: fechaFact, items: purchaseItems, total: purchaseItems.reduce((a, x) => a + (x.total != null ? x.total : x.qty * x.cost), 0),
    subtotal: purchaseItems.reduce((a, x) => a + (x.subtotal || 0), 0), ivaTotal: purchaseItems.reduce((a, x) => a + (x.ivaTotal || 0), 0),
    header: draft.header || {}, invoiceNumber: (draft.header && draft.header.invoiceNumber) || '', archivoId, fuente: draft.fuente, usuario: authUser || '',
    procesadaEn: new Date().toISOString(), modificaciones: purchaseItems.filter(x => x.modificado).length, avisos: fiValidar(draft).map(a => a.txt), at: new Date().toISOString() });
  if(data.purchases.length > 300) data.purchases = data.purchases.slice(0, 300);
  saveData();
  renderInventario(); renderProductos();
  invoiceClose();
  // Todas las páginas quedan guardadas escaneadas en HD (sin hacer esperar): se descargan en «📚 Facturas anteriores».
  const archivosFact = (draft.archivos && draft.archivos.length) ? draft.archivos : (draft.archivo ? [draft.archivo] : []);
  if(archivosFact.length) fiEscanearCompra(compraId, archivosFact);
  let msg = '✅ ' + updated + ' actualizado' + (updated === 1 ? '' : 's');
  if(created) msg += ', ' + created + ' nuevo' + (created === 1 ? '' : 's');
  if(raised) msg += ', ' + raised + ' con aumento de precio';
  if(rectified) msg += ' (' + rectified + ' unido' + (rectified === 1 ? '' : 's') + ' a un producto que ya existía, sin duplicar)';
  showToast(msg + '.');
  if(raisedDetail.length){
    const lines = raisedDetail.map(r => '• ' + r.name + ': ' + fmt(r.from) + ' → ' + fmt(r.to) + (r.pct != null ? ' (+' + r.pct + '%)' : ''));
    setTimeout(() => {
      alert('📈 El proveedor subió el precio de:\n\n' + lines.join('\n') + '\n\nRevisa si también te toca subir el precio de venta.');
    }, 300);
  }
});
// ---------- Factura CON internet (IA) ----------
// Igual que el modo sin internet: un botón de cámara (una foto directa) y uno
// de galería (elegir una o varias fotos ya guardadas, o un PDF) — antes solo
// se podía tomar una foto nueva con la cámara, no se podía adjuntar nada.
const invoiceCamInput = document.getElementById('invoiceCamInput');
const invoiceGalInput = document.getElementById('invoiceGalInput');
// Mientras la persona toma o elige la foto, se deja listo lo que va a leerla (así la espera después es corta).
function fiPrecalentar(){
  try{ if(window.VitoOfflineOCR && window.VitoOfflineOCR.precalentar) window.VitoOfflineOCR.precalentar(); }catch(e){}   // también con IA: ORDEVA lee en paralelo
}
document.getElementById('invInvoiceCamBtn').addEventListener('click', () => { fiPrecalentar(); invoiceCamInput.click(); });
document.getElementById('invInvoiceGalBtn').addEventListener('click', () => { fiPrecalentar(); invoiceGalInput.click(); });

// Carrera Gemini ⚡ ORDEVA: las dos leen la factura a la vez y se muestra la primera que traiga productos.
// Si gana ORDEVA (lector del celular, sin internet) y Gemini termina después, se ofrece su lectura con un toque.
function fiCarrera(aiProm, files){
  aiProm.catch(() => {});
  const V = window.VitoOfflineOCR;
  if(!V || !V.scanInvoiceFiles || window.__fiSinCarrera) return aiProm;
  const conItems = i => !!(i && i.items && i.items.length);
  const ocrProm = V.scanInvoiceFiles(files).then(i => Object.assign({}, i, { fuente: 'ocr', __laya: true }));
  ocrProm.catch(() => {});
  return new Promise((res, rej) => {
    let listo = false, n = 0, iaInfo = null, iaErr = null, ocrErr = null;
    const cerrar = () => {
      if(listo || ++n < 2) return; listo = true;
      if(iaInfo) return res(iaInfo);                                   // la IA respondió (aunque sin productos)
      if(ocrErr && ocrErr.rawText) return res({ supplier: '', date: '', items: [], rawText: ocrErr.rawText, fuente: 'ocr', __laya: true });
      rej(iaErr || ocrErr || new Error('No se pudo leer la factura.'));
    };
    aiProm.then(i => {
      if(!listo && conItems(i)){ listo = true; window.__fiCarreraGano = 'ia'; return res(i); }
      iaInfo = i; cerrar();
    }, e => { iaErr = e; cerrar(); });
    ocrProm.then(i => {
      if(!listo && conItems(i)){
        listo = true; window.__fiCarreraGano = 'laya'; res(i);
        aiProm.then(ia => { if(conItems(ia)) fiOfrecerLecturaIA(ia); }).catch(() => {});
        return;
      }
      cerrar();
    }, e => { ocrErr = e; cerrar(); });
  });
}
function fiOfrecerLecturaIA(ia){
  const ov = document.getElementById('invoiceOverlay');
  if(!ov || !ov.classList.contains('show') || !invoiceDraft || invoiceDraft.fuente !== 'ocr') return;
  const box = document.getElementById('ivAvisos'); if(!box || document.getElementById('fiUsarIA')) return;
  const b = document.createElement('button'); b.type = 'button'; b.id = 'fiUsarIA'; b.className = 'btn-camera'; b.style.cssText = 'width:100%;margin:6px 0';
  b.textContent = '🤖 La lectura avanzada de ORDEVA ya terminó (' + ia.items.length + ' productos): úsala, suele ser más precisa';
  b.addEventListener('click', () => { invoiceOpen(ia); showToast('🤖 Lectura avanzada de ORDEVA cargada.'); });
  box.prepend(b);
}
async function handleOnlineInvoiceFiles(files, triggerBtn, inputEl){
  if(!files || !files.length) return false;
  const lbl = triggerBtn.innerHTML;
  let ok = true;
  triggerBtn.disabled = true; triggerBtn.textContent = '🧾 Leyendo…';
  document.getElementById('invoiceOverlay').classList.add('show');
  fiEstado('Detectando texto…');
  document.getElementById('invoiceBody').innerHTML = '';
  const hb0 = document.getElementById('ivHeader'); if(hb0) hb0.innerHTML = ''; const av0 = document.getElementById('ivAvisos'); if(av0) av0.innerHTML = '';
  invoiceProgressStart();
  try{
    const isPdfHelper = window.VitoOfflineOCR && window.VitoOfflineOCR.isPdfFile;
    const pdfFiles = isPdfHelper ? files.filter(f => window.VitoOfflineOCR.isPdfFile(f)) : [];
    let info;
    if(pdfFiles.length){
      let text = '';
      try{ text = await window.VitoOfflineOCR.extractEmbeddedPdfText(pdfFiles); }catch(e){ text = ''; }
      if(text && text.trim().length > 40){
        // PDF digital: ya tiene texto, se lo mandamos a la IA como texto — más
        // rápido y confiable que convertirlo a foto.
        document.getElementById('invoiceSub').textContent = 'Leyendo el texto del PDF…';
        info = await recognizeInvoiceWithAIFromText(text);
        info.textoPdf = text;
      } else {
        // PDF escaneado (sin texto embebido): se convierte su primera página a
        // foto y se sigue el mismo camino que una foto normal.
        document.getElementById('invoiceSub').textContent = 'El PDF no trae texto digital, convirtiéndolo a foto…';
        const expanded = await window.VitoOfflineOCR.expandFilesWithPdfPages(pdfFiles);
        const firstImg = expanded && expanded[0];
        if(!firstImg) throw new OpenAIError('bad', 'No pude leer el PDF de la factura.');
        const dataUrl = await scaleInvoicePhotoForAI(firstImg, 1150, 0.68);
        info = await recognizeInvoiceWithAI(dataUrl);
      }
    } else {
      const file = files[0], pre = window.__fiPre; window.__fiPre = null;
      fiEstado('Analizando factura…');
      const aiProm = (pre && pre.file === file) ? pre.prom : scaleInvoicePhotoForAI(file, 1150, 0.68).then(recognizeInvoiceWithAI);   // ya se venía leyendo desde la vista previa
      info = await fiCarrera(aiProm, [file]);
    }
    invoiceOpen(info);
    if(info && info.__laya){
      if(!(info.items || []).length){ const rw = document.getElementById('invoiceRawWrap'); if(rw) rw.open = true; showToast('⚠️ ORDEVA leyó el texto pero no separó productos: corrígelo y toca «Releer texto».', 7000); }
      else showToast('⚡ ORDEVA leyó la factura al instante, sin internet. Revisa los datos.', 5000);
    }
  }catch(err){
    ok = false;
    invoiceClose();
    if(err && err.message === 'NO_API_KEY') showToast('Configura la IA (⚙️ en Productos) para escanear facturas.');
    else showToast('❌ ' + (err && err.message ? err.message : 'No se pudo leer la factura.'));
  }finally{
    triggerBtn.disabled = false; triggerBtn.innerHTML = lbl;
    inputEl.value = '';
  }
  return ok;
}
// Un solo par de botones: con IA si hay internet y está configurada; si no (o si la IA falla), sin internet.
async function leerFactura(files, btn, input){
  files = fiValidarArchivos(files);
  if(!files.length){ input.value = ''; return; }
  const original = files[0], originales = files.slice();   // todas las fotos / el PDF tal como llegaron (para guardarlas escaneadas en HD)
  if(files.length === 1 && !fiEsPdf(files[0])){
    // Una sola foto: se muestra ya arreglada para revisarla antes de leerla.
    const iaYa = hasAIKey() && navigator.onLine !== false;
    let pre = null;
    const r = await fiRevisarFoto(files[0], f => {
      if(iaYa){ const prom = scaleInvoicePhotoForAI(f, 1150, 0.68).then(recognizeInvoiceWithAI); prom.catch(() => {}); pre = { file: f, prom }; }
      else fiPrecalentar();
    });
    input.value = '';
    window.__fiPre = (r && pre && r.usar === pre.file) ? pre : null;
    if(!r) return;
    if(r.otra){ (r.otra === 'cam' ? invoiceCamInput : invoiceGalInput).click(); return; }
    files = [r.usar];
    if(r.original && r.original !== original) originales[0] = r.original;     // girada o con esquinas puestas a mano
    if(r.usar !== original) try{ r.usar.__original = originales[0]; }catch(e){}
  } else {
    // Varias fotos (o un PDF): las fotos se arreglan solas, sin preguntar.
    files = await Promise.all(files.map(async f => { if(fiEsPdf(f)) return f; try{ const m = (await fiMejorarFoto(f)).file; try{ m.__original = f; }catch(e){} return m; }catch(e){ return f; } }));
  }
  window.__fiArchivo = originales[0]; window.__fiArchivos = originales;
  // Sin IA configurada (ni la clave de ORDEVA en el servidor ni una propia): se ofrece configurarla UNA vez (queda
  // en los datos del negocio y llega sola a los demás celulares). Una vez al día como máximo; si no, se lee sin internet.
  if(!hasAIKey() && navigator.onLine !== false && authIsAdmin()){
    let hoy = ''; try{ hoy = new Date().toDateString(); }catch(e){}
    if(lsGet('vento-ia-ofrecida') !== hoy){
      lsSet('vento-ia-ofrecida', hoy);
      const si = await showConfirm({ title: '⚡ Leer facturas con IA', icon: '🧾',
        message: 'Con la IA (Gemini de Google, gratis) la factura se lee en segundos y con los datos completos (productos, cantidades, costos, IVA).\n\nSe configura UNA sola vez: pegas tu clave y queda para todos los celulares del negocio.\n\n¿Configurarla ahora? (Si no, esta factura se lee sin internet, más despacio.)',
        confirmText: 'Configurar IA', cancelText: 'Leer sin IA' });
      if(si){ input.value = ''; try{ openAIConfigDialog(); }catch(e){} return; }
    }
  }
  const conIA = hasAIKey() && navigator.onLine !== false;
  if(conIA && await handleOnlineInvoiceFiles(files, btn, input)) return;
  if(!window.VitoOfflineOCR){ if(!conIA) showToast('Configura la IA (⚙️ en Productos) para leer facturas.'); return; }
  if(conIA) showToast('IA temporalmente no disponible. Se lee sin internet: revise los datos.');
  else if(navigator.onLine === false) showToast('Sin conexión. Se lee la factura sin internet.');
  return handleOfflineInvoiceFiles(files, btn, input);
}
invoiceCamInput.addEventListener('change', e => leerFactura(Array.from(e.target.files || []), document.getElementById('invInvoiceCamBtn'), invoiceCamInput));
invoiceGalInput.addEventListener('change', e => leerFactura(Array.from(e.target.files || []), document.getElementById('invInvoiceGalBtn'), invoiceGalInput));
// ---------- Factura SIN internet (motor offline Precios Vito, ver <script> al final) ----------
// Dos botones, igual que en Precios Vito: cámara (una foto directa) y
// galería (elegir una o varias fotos ya guardadas, o un PDF).
const invoiceOfflineCamInput = document.getElementById('invoiceOfflineCamInput');
const invoiceOfflineGalInput = document.getElementById('invoiceOfflineGalInput');

async function handleOfflineInvoiceFiles(files, triggerBtn, inputEl){
  if(!files || !files.length) return;
  const lbl = triggerBtn.innerHTML;
  if(!window.VitoOfflineOCR){ showToast('El lector sin internet no cargó — vuelve a abrir el archivo completo.'); inputEl.value = ''; return; }
  triggerBtn.disabled = true; triggerBtn.textContent = '📴 Leyendo…';
  document.getElementById('invoiceOverlay').classList.add('show');
  fiEstado('Detectando texto sin internet (puede tardar un poco más que con IA)…');
  document.getElementById('invoiceBody').innerHTML = '';
  const hb1 = document.getElementById('ivHeader'); if(hb1) hb1.innerHTML = ''; const av1 = document.getElementById('ivAvisos'); if(av1) av1.innerHTML = '';
  invoiceProgressStart();
  window.__vitoOcrProgress = p => invoiceProgressSet(p * 100);
  try{
    const info = await window.VitoOfflineOCR.scanInvoiceFiles(files);
    invoiceOpen(info);
  }catch(err){
    if(err && err.rawText){
      // No se separaron productos, pero sí hay texto leído: se muestra igual
      // para que el usuario lo corrija a mano y presione "Releer texto".
      invoiceOpen({ supplier: '', date: '', items: [], rawText: err.rawText });
      const rawWrap = document.getElementById('invoiceRawWrap'); if(rawWrap) rawWrap.open = true;
      showToast('⚠️ ' + (err.message || 'No logré separar productos, pero puedes corregir el texto leído.'));
    } else {
      invoiceClose();
      showToast('❌ No se pudo detectar correctamente el texto. Puede intentar nuevamente o editar manualmente.' + (err && err.message ? ' (' + err.message + ')' : ''));
    }
  }finally{
    triggerBtn.disabled = false; triggerBtn.innerHTML = lbl;
    inputEl.value = '';
    window.__vitoOcrProgress = null;
  }
}

/* ---------- Escaneo de precio y margen ----------
   Foto del producto (o de su etiqueta de precio) -> la IA detecta el producto y lee el precio
   visible -> se compara contra el costo anterior guardado (subió / bajó / igual), se calcula el
   margen que te queda vendiéndolo al precio actual y se sugiere un precio de venta que te
   deje la ganancia que quieres (por defecto, el margen que ya tenías). Si la foto no trae
   precio, se puede buscar el precio actual en la web (estimado: hay que verificarlo). */
const pcColor = pct => pct <= 15 ? '#ff5a5a' : pct < 25 ? '#f5b83d' : '#4cd97b';
const pcMoney = n => (n < 0 ? '−' : '') + fmt(Math.abs(n));
let pcDraft = null;   // { name, size, productId, seen, pack, target, newPrice, note }
let pcToken = 0;

function pcPrompt(){
  return 'Esta es una foto de un producto, de su etiqueta de precio en un estante o vitrina, o de un renglón de factura o lista de precios de un PROVEEDOR o tienda (lo que el negocio paga al comprar). ' +
    'Identifica el producto y lee el precio visible. Devuelve SOLO JSON válido (sin texto extra, sin ```), con esta forma exacta: ' +
    '{"name":"","brand":"","size":"","price":0,"price_for":"unit","pack_qty":1,"confidence":0}. ' +
    'name = nombre comercial corto. size = presentación (ej. "330 ml", "500 g"). ' +
    'price = precio visible en pesos colombianos como NÚMERO ENTERO, sin símbolo ni separadores (los puntos de "3.500" son miles: 3500); si no hay ningún precio visible pon 0. ' +
    'price_for = "unit" si ese precio es de UNA unidad, "pack" si es de un paquete, caja, six-pack o canasta. pack_qty = cuántas unidades trae ese paquete (1 si es una unidad o no se ve). confidence = 0 a 1. ' +
    'No inventes ni adivines cifras que no veas. ' + invCatalogHint();
}
async function recognizePriceWithAI(dataUrl){
  const prompt = pcPrompt();
  const ok = i => !!(i && (i.name || i.brand));
  let info = null;
  try{
    info = cleanAiJsonText(await aiText({ prompt, imageDataUrl: dataUrl, json: true, timeoutMs: 7000, retries: 0, oneModel: true, fast: true, maxOutputTokens: 600 }));
  }catch(err){
    if(!(err && AI_LADDER_KINDS.includes(err.kind))) throw err;
  }
  if(!ok(info)) info = cleanAiJsonText(await aiText({ prompt, imageDataUrl: dataUrl, json: true, timeoutMs: 10000, retries: 0, fast: true, maxOutputTokens: 600 }));
  if(!ok(info)) throw new OpenAIError('bad', 'La IA respondió pero no pude identificar el producto. Prueba con una foto más cerca de la etiqueta y con buena luz.');
  return info;
}
async function pcWebPrice(name){
  const q = 'Busca en la web el precio actual en Colombia (pesos COP) de "' + name + '". Devuelve SOLO JSON válido (sin texto extra, sin ```): {"price":0,"source":""}. ' +
    'price = precio típico de UNA unidad como número entero sin separadores (si solo hay precios de paquete, divide entre las unidades). source = tienda o sitio de donde salió. ' +
    'Si no encuentras un precio confiable pon price 0. No inventes cifras.';
  return cleanAiJsonText(await aiText({ prompt: q, json: true, web: true, strictWeb: true, timeoutMs: 45000, retries: 1 }));
}

const pcProduct = () => (pcDraft && pcDraft.productId) ? (data.products.find(p => p.id === pcDraft.productId) || null) : null;
const pcUnitCost = () => pcDraft.seen > 0 ? Math.round(pcDraft.seen / Math.max(1, pcDraft.pack || 1)) : 0;
function pcAutoTarget(p){                      // por defecto: el margen que ya tenías (si era razonable) o el margen sano de la app
  if(p && p.cost > 0 && p.price > 0){ const m = (p.price - p.cost) / p.price; if(m >= 0.05) return Math.round(m * 100); }
  return Math.round(INVOICE_TARGET_MARGIN * 100);
}
function pcSuggest(cost, targetPct){           // precio = costo / (1 - margen), redondeado hacia arriba a $100 para no quedarte corto
  const m = Math.min(0.9, Math.max(0, (targetPct || 0) / 100));
  return cost > 0 ? Math.ceil(cost / (1 - m) / 100) * 100 : 0;
}
function pcResultHtml(){
  const d = pcDraft, p = pcProduct(), cost = pcUnitCost();
  if(!(cost > 0)) return '<div class="iv-note">Escribe el precio que ves en la foto (o búscalo en la web) para calcular el margen.</div>';
  const old = p && p.cost > 0 ? p.cost : null;
  const sale = p && p.price > 0 ? p.price : 0;
  const rows = [];
  let flag;
  if(old != null){
    const diff = cost - old, pct = Math.round(Math.abs(diff) / old * 1000) / 10;
    flag = diff > 0 ? '<span class="iv-flag up">⬆ Subió ' + pct + '%</span>' : diff < 0 ? '<span class="iv-flag dn">⬇ Bajó ' + pct + '%</span>' : '<span class="iv-flag eq">➡ Sigue igual</span>';
    rows.push(['Costo anterior', fmt(old)]);
    rows.push(['Costo actual (por unidad)', fmt(cost) + (diff ? ' <small>(' + (diff > 0 ? '+' : '−') + fmt(Math.abs(diff)) + ')</small>' : '')]);
  } else {
    flag = '<span class="iv-flag new">sin costo anterior</span>';
    rows.push(['Costo actual (por unidad)', fmt(cost)]);
  }
  let warn = '';
  if(sale){
    rows.push(['Precio de venta actual', fmt(sale)]);
    if(old != null){ const m0 = Math.round((sale - old) / sale * 100); rows.push(['Margen antes', '<span style="color:' + pcColor(m0) + '">' + m0 + '%</span>']); }
    const m1 = Math.round((sale - cost) / sale * 100);
    rows.push(['Margen ahora, al mismo precio', '<span style="color:' + pcColor(m1) + '">' + m1 + '%</span> · ' + pcMoney(sale - cost) + '/u']);
    if(sale <= cost) warn = '⚠️ Al precio actual vendes por debajo del costo: pierdes ' + fmt(cost - sale) + ' por unidad.';
    else if(m1 <= 15) warn = '⚠️ Con el costo nuevo te queda un margen muy bajo (' + m1 + '%). Conviene subir el precio.';
  }
  let sug = '';
  if(d.newPrice > 0){
    const m2 = Math.round((d.newPrice - cost) / d.newPrice * 100);
    const delta = sale ? d.newPrice - sale : 0;
    sug = '<div class="pc-sug"><small>Precio sugerido para ganar ' + d.target + '%</small><br><b>' + fmt(d.newPrice) + '</b> ' +
      (sale ? (delta > 0 ? '<span class="iv-flag up">sube ' + fmt(delta) + '</span>' : delta < 0 ? '<span class="iv-flag dn">baja ' + fmt(-delta) + '</span>' : '<span class="iv-flag eq">igual que hoy</span>') : '') +
      '<br><small>Margen <span style="color:' + pcColor(m2) + ';font-weight:700">' + m2 + '%</span> · ganas ' + pcMoney(d.newPrice - cost) + ' por unidad</small></div>';
  }
  return '<div style="margin-top:10px">' + flag + '</div><table class="pc-table">' + rows.map(r => '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td></tr>').join('') + '</table>' +
    (warn ? '<div class="pc-warn">' + warn + '</div>' : '') + sug;
}
function pcFormHtml(){
  const d = pcDraft, p = pcProduct();
  const real = data.products.filter(x => !x.combo).slice().sort((a, b) => a.name.localeCompare(b.name));
  const opts = '<option value="">➕ Crear producto nuevo</option>' + real.map(x => '<option value="' + x.id + '"' + (x.id === d.productId ? ' selected' : '') + '>' + invEsc(x.name + (x.size ? ' · ' + x.size : '')) + '</option>').join('');
  return '<div class="iv-item"><div class="iv-grid">' +
    '<div class="iv-full"><label>Producto detectado' + (p ? '' : ' (nuevo en tu lista)') + '</label><input type="text" id="pcName" value="' + invEsc(d.name) + '"></div>' +
    '<div class="iv-full"><label>Coincide con</label><select id="pcMatch">' + opts + '</select></div>' +
    '<div><label>Precio que ves en la foto</label><input type="number" id="pcSeen" inputmode="numeric" min="0" step="50" value="' + (d.seen || '') + '"></div>' +
    '<div><label>Unidades del paquete (1 = unidad)</label><input type="number" id="pcPack" inputmode="numeric" min="1" step="1" value="' + d.pack + '"></div>' +
    '<div class="iv-full"><button type="button" class="btn-ghost" id="pcWebBtn">🌐 Buscar precio actual en la web</button><div class="iv-note" id="pcNote">' + invEsc(d.note || '') + '</div></div>' +
    '<div><label>Margen que quieres ganar (%)</label><input type="number" id="pcTarget" inputmode="numeric" min="0" max="90" step="1" value="' + d.target + '"></div>' +
    '<div><label>Precio de venta (editable)</label><input type="number" id="pcPrice" inputmode="numeric" min="0" step="100" value="' + (d.newPrice || '') + '"></div>' +
  '</div></div><div id="pcResult"></div>';
}
function pcRenderForm(){
  document.getElementById('priceBody').innerHTML = pcFormHtml();
  document.getElementById('pcResult').innerHTML = pcResultHtml();
}
function pcOpen(info){
  const full = [info.brand, info.name].filter(Boolean).join(' ').trim() || String(info.name || '');
  const m = invMatch(full) || invMatch(info.name);
  const seen = Math.max(0, Math.round(Number(info.price) || 0));
  const pack = info.price_for === 'pack' ? Math.max(1, Math.round(Number(info.pack_qty) || 1)) : 1;
  const target = pcAutoTarget(m);
  pcDraft = { name: m ? m.name : full.slice(0, 60), size: m ? (m.size || '') : String(info.size || ''), productId: m ? m.id : '', seen, pack, target, newPrice: 0,
    note: seen > 0 ? 'Precio leído de la foto' + (pack > 1 ? ' (paquete de ' + pack + ')' : '') + '. Corrígelo si no coincide.' : 'No vi un precio en la foto. Escríbelo o búscalo en la web.' };
  pcDraft.newPrice = pcSuggest(pcUnitCost(), target);
  document.getElementById('priceSub').textContent = 'Detecté: ' + pcDraft.name + (pcDraft.size ? ' ' + pcDraft.size : '') + (m ? ' (ya está en tu lista).' : '.') + ' Revisa los datos.';
  pcRenderForm();
  document.getElementById('priceOverlay').classList.add('show');
}
function pcClose(){ pcToken++; document.getElementById('priceOverlay').classList.remove('show'); pcDraft = null; }

document.getElementById('priceBody').addEventListener('input', e => {
  if(!pcDraft) return;
  const id = e.target.id;
  if(id === 'pcName'){ pcDraft.name = e.target.value; return; }
  if(id === 'pcPrice'){ pcDraft.newPrice = Math.max(0, Math.round(+e.target.value || 0)); }
  else if(id === 'pcSeen' || id === 'pcPack' || id === 'pcTarget'){
    pcDraft.seen = Math.max(0, +document.getElementById('pcSeen').value || 0);
    pcDraft.pack = Math.max(1, Math.floor(+document.getElementById('pcPack').value || 1));
    pcDraft.target = Math.min(90, Math.max(0, +document.getElementById('pcTarget').value || 0));
    pcDraft.newPrice = pcSuggest(pcUnitCost(), pcDraft.target);
    document.getElementById('pcPrice').value = pcDraft.newPrice || '';
  } else return;
  document.getElementById('pcResult').innerHTML = pcResultHtml();
});
document.getElementById('priceBody').addEventListener('change', e => {
  if(!pcDraft || e.target.id !== 'pcMatch') return;
  pcDraft.productId = e.target.value;
  const p = pcProduct();
  if(p){ pcDraft.name = p.name; pcDraft.size = p.size || ''; }
  pcDraft.target = pcAutoTarget(p);
  pcDraft.newPrice = pcSuggest(pcUnitCost(), pcDraft.target);
  pcRenderForm();
});
document.getElementById('priceBody').addEventListener('click', async e => {
  const b = e.target.closest('#pcWebBtn'); if(!b || !pcDraft) return;
  const nm = [pcDraft.name, pcDraft.size].filter(Boolean).join(' ').trim();
  if(!nm){ showToast('Escribe el nombre del producto primero.'); return; }
  const my = pcToken, lbl = b.textContent;
  b.disabled = true; b.textContent = '🌐 Buscando…';
  try{
    const r = await pcWebPrice(nm);
    if(my !== pcToken || !pcDraft) return;
    if(r && Number(r.price) > 0){
      pcDraft.seen = Math.round(Number(r.price)); pcDraft.pack = 1;
      pcDraft.newPrice = pcSuggest(pcUnitCost(), pcDraft.target);
      pcDraft.note = '🌐 Precio estimado en la web' + (r.source ? ' (' + r.source + ')' : '') + '. Verifícalo antes de guardar.';
    } else pcDraft.note = 'No encontré un precio confiable en la web. Escríbelo tú.';
    pcRenderForm();
  }catch(err){
    if(my !== pcToken || !pcDraft) return;
    b.disabled = false; b.textContent = lbl;
    if(err && err.message === 'NO_API_KEY') showToast('Configura la IA (⚙️ en Productos) para buscar en la web.');
    else showToast('❌ ' + (err && err.message ? err.message : 'No se pudo buscar el precio.'));
  }
});
document.getElementById('priceCancelBtn').addEventListener('click', pcClose);
document.getElementById('priceOverlay').addEventListener('click', e => { if(e.target.id === 'priceOverlay') pcClose(); });
document.getElementById('priceApplyBtn').addEventListener('click', () => {
  if(!pcDraft) return;
  const cost = pcUnitCost();
  if(!(cost > 0)){ showToast('Escribe el precio que ves para poder guardar.'); return; }
  let p = pcProduct();
  let msgName;
  if(p){
    p.cost = cost;
    if(pcDraft.newPrice > 0){ p.price = pcDraft.newPrice; sincronizarProductoEnMesas(p); }
    msgName = p.name;
  } else {
    const name = (pcDraft.name || '').trim();
    if(!name){ showToast('Ponle un nombre al producto.'); return; }
    const other = data.products.find(x => dupKey(x) === dupKey({ name, size: pcDraft.size }));
    if(other){ showToast('Ya existe "' + other.name + '". Elígelo en "Coincide con".'); return; }
    p = { id: 'inv-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6), name, price: pcDraft.newPrice > 0 ? pcDraft.newPrice : cost, categoryId: null, size: pcDraft.size || '', specifications: '', stock: null, cost };
    data.products.push(p);
    msgName = name;
  }
  p.costAt = new Date().toISOString();
  p.costLog = (p.costLog || []).concat({ c: cost, at: p.costAt }).slice(-12);
  saveData();
  renderInventario(); renderProductos();
  pcClose();
  showToast('✅ ' + msgName + ': costo ' + fmt(cost) + ', precio ' + fmt(p.price) + '.');
});
const pricePhotoInput = document.getElementById('pricePhotoInput');
document.getElementById('invPriceBtn').addEventListener('click', () => pricePhotoInput.click());
pricePhotoInput.addEventListener('change', async e => {
  const file = e.target.files[0]; if(!file) return;
  const btn = document.getElementById('invPriceBtn'), lbl = btn.innerHTML;
  const my = ++pcToken;
  pcDraft = null;
  btn.disabled = true; btn.textContent = '🏷️ Leyendo foto…';
  document.getElementById('priceOverlay').classList.add('show');
  document.getElementById('priceSub').textContent = 'Detectando el producto y el precio…';
  document.getElementById('priceBody').innerHTML = '';
  try{
    const dataUrl = await scalePhotoForAI(file, 800, 0.7);   // más liviana = respuesta más rápida (la etiqueta se sigue leyendo bien)
    const info = await recognizePriceWithAI(dataUrl);
    if(my !== pcToken) return;   // canceló mientras la IA respondía
    pcOpen(info);
  }catch(err){
    if(my === pcToken) pcClose();
    if(err && err.message === 'NO_API_KEY') showToast('Configura la IA (⚙️ en Productos) para escanear precios.');
    else showToast('❌ ' + (err && err.message ? err.message : 'No se pudo leer la foto.'));
  }finally{
    btn.disabled = false; btn.innerHTML = lbl;
    pricePhotoInput.value = '';
  }
});

/* ---------- Venta rápida de mostrador / Domicilio ----------
   Para vender sin abrir una mesa: no toca data.tables en ningún momento,
   arma un carrito propio y al cobrar escribe directo en data.history
   (con table:null, tableName:'Mostrador' o '🛵 Domicilio: <cliente>') igual
   que al cerrar una mesa. El mismo modal sirve para las dos cosas — solo
   cambia qsMode ('mostrador' o 'domicilio'), que muestra/oculta los campos
   de cliente/dirección/envío y suma el valor del domicilio al total. */
let quickSaleCart = []; // [{productId, name, price, size, qty}]
let qsMode = 'mostrador';

function qsHideSuggestions(){
  const box = document.getElementById('qsSuggestions');
  box.classList.remove('show');
  box.innerHTML = '';
}
function qsRenderSuggestions(query){
  const box = document.getElementById('qsSuggestions');
  const q = (query || '').trim().toLowerCase();
  const inCart = new Set(quickSaleCart.map(it => it.productId));
  const matches = data.products.filter(p => !q || p.name.toLowerCase().includes(q));
  if(!matches.length){
    box.innerHTML = '<div class="product-suggestion-empty">Sin productos que coincidan</div>';
    box.classList.add('show');
    return;
  }
  const cartMatches = matches.filter(p => inCart.has(p.id));
  const restMatches = matches.filter(p => !inCart.has(p.id));
  let html = '';
  if(cartMatches.length){
    html += '<div class="product-suggestion-header">Ya en el carrito</div>';
    html += cartMatches.slice(0, 15).map(productSuggestionItemHtml).join('');
  }
  if(restMatches.length){
    if(cartMatches.length) html += '<div class="product-suggestion-header">Otros productos</div>';
    html += restMatches.slice(0, 30).map(productSuggestionItemHtml).join('');
  }
  box.innerHTML = html;
  box.classList.add('show');
  box.querySelectorAll('.product-suggestion-item').forEach(el=>{
    el.addEventListener('click', ()=>{
      const product = data.products.find(p=>p.id === el.dataset.id);
      if(!product) return;
      document.getElementById('qsSearch').value = product.name;
      document.getElementById('qsProductId').value = product.id;
      qsHideSuggestions();
    });
  });
}
document.getElementById('qsSearch').addEventListener('input', (e)=>{
  document.getElementById('qsProductId').value = '';
  qsRenderSuggestions(e.target.value);
});
document.getElementById('qsSearch').addEventListener('focus', (e)=>{
  document.getElementById('qsProductId').value = '';
  qsRenderSuggestions(e.target.value);
});
document.addEventListener('click', (e)=>{
  if(!e.target.closest('#quickSaleOverlay .product-search-wrap')) qsHideSuggestions();
});
document.getElementById('qsQtyMinus').addEventListener('click', ()=>{
  const qtyInput = document.getElementById('qsQty');
  const antes = parseInt(qtyInput.value,10) || 0, val = Math.max(0, antes - 1);
  qtyInput.value = val;
  if(val < antes) sonidoPos('remove');
});
document.getElementById('qsQtyPlus').addEventListener('click', ()=>{
  const qtyInput = document.getElementById('qsQty');
  qtyInput.value = Math.max(0, (parseInt(qtyInput.value,10) || 0) + 1);
  sonidoPos('add');
});

function qsEnvioValor(){
  if(qsMode !== 'domicilio') return 0;
  const v = parseFloat(document.getElementById('qsEnvio').value);
  return isFinite(v) && v > 0 ? v : 0;
}
function qsTotal(){ return quickSaleCart.reduce((s,it)=>s+it.price*it.qty,0) + qsEnvioValor(); }

function qsRenderCart(){
  const container = document.getElementById('qsItemsContainer');
  container.innerHTML = '';
  if(!quickSaleCart.length){
    container.innerHTML = '<div class="empty-note">Todavía no has agregado productos.</div>';
  } else {
    quickSaleCart.forEach((it, idx)=>{
      const row = document.createElement('div');
      row.className = 'line-item';
      row.innerHTML = `
        <div><span class="li-name">${invEsc(it.name)}</span>${it.size ? '<span class="li-size">📦 ' + invEsc(it.size) + '</span>' : ''}${qtyStepperHtml(idx, it.qty)}</div>
        <div class="li-right">
          <span class="li-price">${fmt(it.price*it.qty)}</span>
          <button class="li-remove" data-idx="${idx}" type="button">✕</button>
        </div>
      `;
      container.appendChild(row);
    });
    container.querySelectorAll('.li-qty-minus').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const idx = parseInt(btn.dataset.idx,10);
        const it = quickSaleCart[idx]; if(!it) return;
        it.qty -= 1;
        if(it.qty <= 0) quickSaleCart.splice(idx,1);
        sonidoPos('remove');
        qsRenderCart();
      });
    });
    container.querySelectorAll('.li-qty-plus').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const idx = parseInt(btn.dataset.idx,10);
        const it = quickSaleCart[idx]; if(!it) return;
        it.qty += 1;
        sonidoPos('add');
        qsRenderCart();
      });
    });
    container.querySelectorAll('.li-remove').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const idx = parseInt(btn.dataset.idx,10);
        if(quickSaleCart.splice(idx,1).length) sonidoPos('remove');
        qsRenderCart();
      });
    });
  }
  document.getElementById('qsTotal').textContent = fmt(qsTotal());
  document.getElementById('qsChargeBtn').disabled = !quickSaleCart.length;
}

function qsAddToCart(product, qty, noRender){
  const existing = quickSaleCart.find(it => it.productId === product.id);
  if(existing) existing.qty += qty;
  else quickSaleCart.push({ productId: product.id, name: product.name, price: product.price, size: product.size || '', qty });
  if(qty > 0) sonidoPos('add');
  if(!noRender) qsRenderCart();
}
document.getElementById('qsAddBtn').addEventListener('click', ()=>{
  if(data.products.length === 0){ showToast('Primero agrega productos en la pestaña Productos.'); return; }
  const searchInput = document.getElementById('qsSearch');
  const idInput = document.getElementById('qsProductId');
  const qtyInput = document.getElementById('qsQty');
  let product = data.products.find(p=>p.id === idInput.value);
  if(!product){
    const typed = searchInput.value.trim().toLowerCase();
    product = data.products.find(p=>p.name.toLowerCase() === typed);
  }
  if(!product){ showToast('Selecciona un producto de la lista de sugerencias.'); return; }
  const qty = Math.max(0, parseInt(qtyInput.value,10) || 0);
  if(qty <= 0){ showToast('Indica una cantidad mayor que 0.'); return; }
  qsAddToCart(product, qty, true);
  searchInput.value = '';
  idInput.value = '';
  qtyInput.value = 1;
  qsHideSuggestions();
  qsRenderCart();
});

function qsOpen(mode){
  qsMode = mode === 'domicilio' ? 'domicilio' : 'mostrador';
  quickSaleCart = [];
  document.getElementById('qsSearch').value = '';
  document.getElementById('qsProductId').value = '';
  document.getElementById('qsQty').value = 1;
  document.getElementById('qsMethod').value = 'efectivo';
  { const dn = document.getElementById('qsDebeName'); dn.value = ''; dn.hidden = true; }
  document.getElementById('qsCliente').value = '';
  document.getElementById('qsTelefono').value = '';
  document.getElementById('qsDireccion').value = '';
  document.getElementById('qsEnvio').value = '0';
  document.getElementById('qsDomicilioFields').hidden = qsMode !== 'domicilio';
  document.getElementById('qsTitle').textContent = qsMode === 'domicilio' ? '🛵 Domicilio' : '⚡ Venta rápida';
  document.getElementById('qsSub').textContent = qsMode === 'domicilio'
    ? 'Factura un pedido a domicilio: agrega los productos y, si quieres, los datos del cliente y el valor del envío.'
    : 'Para vender de una vez en mostrador, sin abrir ni asignar una mesa.';
  document.getElementById('qsChargeBtn').textContent = qsMode === 'domicilio' ? '✅ Facturar domicilio' : '✅ Cobrar';
  qsHideSuggestions();
  qsRenderCart();
  document.getElementById('quickSaleOverlay').classList.add('show');
}
async function qsClose(){
  if(quickSaleCart.length){
    const ok = await showConfirm({
      title: '¿Cancelar esta venta?',
      message: 'Vas a perder los productos que ya agregaste al carrito.',
      confirmText: 'Sí, cancelar',
      cancelText: 'Seguir vendiendo',
      icon: '⚡'
    });
    if(!ok) return;
  }
  quickSaleCart = [];
  document.getElementById('quickSaleOverlay').classList.remove('show');
}
document.getElementById('quickSaleBtn').addEventListener('click', () => qsOpen('mostrador'));
document.getElementById('fiadosBtn').addEventListener('click', () => { if(window.libretaAbrir) window.libretaAbrir(); });
document.getElementById('domicilioBtn').addEventListener('click', () => { domActual = null; if(domisPend().length) domAbrir(null); else qsOpen('domicilio'); });
document.getElementById('qsCancelBtn').addEventListener('click', qsClose);
document.getElementById('quickSaleOverlay').addEventListener('click', e => { if(e.target.id === 'quickSaleOverlay') qsClose(); });
document.getElementById('qsEnvio').addEventListener('input', qsRenderCart);

/* ---------- Domicilios que entran solos (página web, Instagram o WhatsApp) ----------
   Es el mismo link de pedidos de las mesas pero con dom=1 y sin mesa: el negocio lo pone
   en su página web, en su Instagram o lo manda por WhatsApp. El cliente pide ahí y el
   pedido llega por el mismo canal de ORDEVA que las mesas, con esta forma:
       DOMICILIO: nombre | teléfono | dirección | productos
   Queda guardado como pendiente (no se pierde aunque se cierre la app) y abre la
   factura de domicilio ya llena, con los productos emparejados con el inventario. */
const DOM_KEY = 'vito_domis';
const domisPend = () => LS(DOM_KEY, []);
let domActual = null;
function domisGuardar(l){ SS(DOM_KEY, l); domisBadge(); }
function domisBadge(){
  const b = document.getElementById('domicilioBtn'); if(!b) return;
  const n = domisPend().length;
  b.textContent = n ? '🛵 Domicilio (' + n + ')' : '🛵 Domicilio';
  b.classList.toggle('btn-warn', n > 0);
}
/* Aviso del celular (app de Android): suena y se ve aunque ORDEVA esté cerrada o la pantalla apagada.
   Si ORDEVA se está viendo no hace falta (ya sale en pantalla). En el navegador no hace nada. */
function ventoAvisoCel(titulo, texto, canal){
  try{ window.ventoParlanteAviso && window.ventoParlanteAviso(titulo, texto); }catch(e){}
  // Los pagos salen SIEMPRE (también con ORDEVA abierta), en su canal: se ven con el celular bloqueado.
  try{ if(window.VentoAndroid && typeof window.VentoAndroid.notificar === 'function') return window.VentoAndroid.notificar(String(titulo || 'ORDEVA').slice(0, 80), String(texto || '').slice(0, 400), canal || 'pedidos', canal === 'pagos'); }catch(e){}
  return false;
}
window.ventoAvisoCel = ventoAvisoCel;
function domRecibir(cuerpo){
  const p = String(cuerpo).split('|').map(x => x.trim());
  const d = { id: Date.now() + '' + Math.random().toString(36).slice(2, 5), ts: Date.now(),
              nombre: p[0] || '', tel: p[1] || '', dir: p[2] || '', texto: p.slice(3).join(', ').trim() };
  const l = domisPend(); l.push(d); domisGuardar(l);
  if(!window.ventoAvisoOn || window.ventoAvisoOn('domicilios')){
    showToast('🛵 Domicilio nuevo' + (d.nombre ? ' de ' + d.nombre : '') + (d.texto ? ': ' + d.texto : '') + (d.dir ? ' · ' + d.dir : ''), 10000);
    ventoAvisoCel('🛵 Domicilio nuevo' + (d.nombre ? ' de ' + d.nombre : ''), (d.texto || '') + (d.dir ? ' · ' + d.dir : ''), 'pedidos');
    try{ if(window.vitoDecir) window.vitoDecir('Nuevo domicilio' + (d.nombre ? ' de ' + d.nombre : '')); }catch(e){}
    if(navigator.vibrate) navigator.vibrate([200, 100, 200]);
  }
  // Solo se abre solo si no hay otra cosa abierta, para no interrumpir lo que esté haciendo.
  if(!document.querySelector('.overlay.show')) domAbrir(d.id);
}
function domAbrir(id){
  const l = domisPend(), d = l.find(x => x.id === id) || l[0];
  qsOpen('domicilio');
  if(!d){ domActual = null; return; }
  domActual = d.id;
  document.getElementById('qsCliente').value = d.nombre || '';
  document.getElementById('qsTelefono').value = d.tel || '';
  document.getElementById('qsDireccion').value = d.dir || '';
  const noReconocidos = [];
  if(d.texto){
    let items = [];
    try{ items = (parseVoiceCommand('mesa 1, ' + d.texto).items) || []; }catch(e){}
    sinSonidoPos(() => items.forEach(it => {        // pedido que llegó por el link de domicilios: no suena
      const prod = matchProductVoice(it.productText);
      if(prod) qsAddToCart(prod, Math.max(1, it.qty || 1), true);
      else noReconocidos.push(it.productText);
    }));
  }
  qsRenderCart();
  document.getElementById('qsSub').textContent = '🛵 Pedido que entró por tu link de domicilios' +
    (d.nombre ? ' (' + d.nombre + ')' : '') + '. Revisa los productos, ponle el valor del envío y factúralo.';
  if(noReconocidos.length) showToast('⚠️ Esto no lo reconocí, agrégalo a mano: ' + noReconocidos.join(', '), 9000);
}
function domQuitar(id){ domisGuardar(domisPend().filter(x => x.id !== id)); }
// La sección de domicilios por web/WhatsApp solo tiene sentido si el negocio hace domicilios.
function aplicarDomicilios(){
  const g = document.getElementById('domGrupoWeb');
  if(g) g.dataset.off = data.domiciliosOn ? '' : '1';
  const b = document.getElementById('domicilioBtn');
  if(b) b.hidden = !data.domiciliosOn;
}

/* El link de domicilios es el mismo pedido.html de las mesas, con dom=1 y sin mesa. */
function domLinkUrl(){
  const c = window.vitoQCfg ? window.vitoQCfg() : {};
  if(!c.url) return '';
  // Se manda también el WhatsApp: si el canal de ORDEVA llegara a fallar, el cliente puede enviarte el
  // pedido por WhatsApp con un toque en vez de perderse.
  return c.url.split('?')[0].trim() + '?dom=1&c=' + c.topic + (c.wa ? '&w=' + c.wa : '');
}
function domWaUrl(){
  const c = window.vitoQCfg ? window.vitoQCfg() : {}, l = domLinkUrl();
  if(!c.wa) return '';
  const msg = 'Hola! Quiero pedir a domicilio de ' + (data.businessName || 'tu negocio') + (l ? '. Aquí está la carta: ' + l : '');
  return 'https://wa.me/' + c.wa + '?text=' + encodeURIComponent(msg);
}
function domQrPintar(boxId, texto){
  const box = document.getElementById(boxId); if(!box) return;
  if(!box.hidden){ box.hidden = true; return; }
  box.textContent = '';
  if(!texto){ box.hidden = false; box.textContent = 'Primero completa el link arriba (Ajustes → QR de las mesas).'; return; }
  const d = document.createElement('div');
  box.appendChild(d); box.hidden = false;
  try{ new QRCode(d, { text: texto, width: 170, height: 170 }); }
  catch(e){ box.textContent = 'No se pudo dibujar el QR.'; }
}
async function domCopiar(txt, okMsg){
  if(!txt) return showToast('⚠️ Primero pon la dirección de tu página de pedidos en Ajustes → QR de las mesas.');
  try{ await navigator.clipboard.writeText(txt); showToast(okMsg); }
  catch(e){ showToast('⚠️ No se pudo copiar. Tócalo y cópialo a mano.'); }
}
function iniDomicilios(){
  const link = document.getElementById('domLink'); if(!link) return;
  const emb = document.getElementById('domEmbed'), wl = document.getElementById('domWaLink');
  const pintar = () => {
    const l = domLinkUrl(), w = domWaUrl();
    link.value = l || '(falta la dirección de tu página de pedidos: Ajustes → QR de las mesas)';
    wl.value = w || '(falta tu número de WhatsApp: Ajustes → QR de las mesas)';
    emb.value = l ? '<a href="' + l + '" target="_blank" rel="noopener" style="display:inline-block;padding:14px 22px;border-radius:12px;background:#c8a24a;color:#1a1410;font:700 16px system-ui;text-decoration:none">🛵 Pedir a domicilio</a>' : '';
  };
  pintar();
  document.getElementById('domLinkCopy').onclick = () => domCopiar(domLinkUrl(), '📋 Link copiado. Pégalo en tu página web, tu Instagram o mándalo por WhatsApp.');
  document.getElementById('domLinkOpen').onclick = () => { const l = domLinkUrl(); if(l) window.open(l, '_blank'); else showToast('⚠️ Primero pon la dirección de tu página de pedidos en Ajustes → QR de las mesas.'); };
  document.getElementById('domLinkQr').onclick = () => domQrPintar('domQrBox', domLinkUrl());
  document.getElementById('domEmbedCopy').onclick = () => domCopiar(emb.value, '📋 Código copiado. Pégalo en tu página web donde quieras el botón.');
  document.getElementById('domWaCopy').onclick = () => domCopiar(domWaUrl(), '📋 Link de WhatsApp copiado.');
  document.getElementById('domWaQr').onclick = () => domQrPintar('domWaQrBox', domWaUrl());
  document.getElementById('domIaBtn').onclick = () => { pintar(); domIaAbrir(); };
  const nav = document.querySelector('nav button[data-view="ajustes"]');
  if(nav) nav.addEventListener('click', pintar);
}
