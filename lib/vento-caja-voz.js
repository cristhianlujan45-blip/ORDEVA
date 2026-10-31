/* =====================================================================
   ORDEVA · 🎙️ Caja Inteligente 2.0: la MISMA caja (lib/vento-pos.js) con voz y teclado

   Tres formas de vender sobre un solo carrito y un solo motor de ventas: táctil, teclado y voz.
   Este archivo NO registra ventas por su cuenta: todo pasa por window.ventoPOS (carrito, cobro con
   qsRegistrarVenta, inventario, historial, recibo, cajón, DIAN) y, para las mesas, por las funciones de
   siempre (applyVoiceItems, tableBalance, closeTableToHistory a través de ventoPOS.cobrarMesa).

   Partes (desacopladas):
   1. MOTOR DE INTERPRETACIÓN (puro, sin DOM ni red): español de Colombia → { intent, items, mesa, monto,
      metodo, pagos }. Números en palabras («cincuenta mil», «treinta y dos»), plurales, tildes, diminutivos,
      «polas», «lucas». Nunca inventa productos: si no está o hay varios parecidos, pregunta.
   2. RECONOCEDORES (adaptadores): el dictado del navegador / del teléfono (Web Speech; en la APK es el
      reconocedor de Android, ver app/02) y SIEMPRE la orden escrita como respaldo. Se pueden registrar otros
      (ventoCajaVoz.registrarMotor) sin tocar el motor ni la caja.
   3. EJECUTOR: aplica la orden en la caja con 3 niveles de confirmación:
      simple (agregar, cantidad) · modificación (vaciar) · financiera (cobrar: confirmación explícita).
      La voz NUNCA reemplaza la clave del dueño: el descuento abre la ventana de siempre (pide autorización).
   4. TECLADO: F1 buscar · F2 cobrar · F3 cliente · F4 pendiente · F5 limpiar · F6 efectivo · F7 transferencia ·
      F8 micrófono · F9 total · ESC cancelar · Enter seguro (no cobra al abrir la ventana de pago).

   Privacidad: ORDEVA no graba ni guarda audio. El texto reconocido se procesa aquí, en el equipo. El dictado
   lo hace el reconocedor del navegador o del teléfono; en Chrome ese servicio puede enviar el audio a Google
   para convertirlo en texto: se avisa ANTES del primer uso y siempre se puede escribir la orden en su lugar.
   Preferencias de este equipo en localStorage «vento_caja_voz».
   ===================================================================== */
(function(){
  'use strict';

  // ======================================================================
  // 1. MOTOR DE INTERPRETACIÓN
  // ======================================================================
  const UNI = { cero: 0, un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
    diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19,
    veinte: 20, veintiun: 21, veintiuno: 21, veintiuna: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25,
    veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60,
    setenta: 70, ochenta: 80, noventa: 90 };
  const CIEN = { cien: 100, ciento: 100, doscientos: 200, doscientas: 200, trescientos: 300, trescientas: 300, cuatrocientos: 400,
    cuatrocientas: 400, quinientos: 500, quinientas: 500, seiscientos: 600, seiscientas: 600, setecientos: 700, setecientas: 700,
    ochocientos: 800, ochocientas: 800, novecientos: 900, novecientas: 900 };
  const MIL = { mil: 1, luca: 1, lucas: 1, luka: 1, lukas: 1 };
  const MILLON = { millon: 1, millones: 1, palo: 1, palos: 1 };
  const ORD = { primera: 1, primero: 1, primer: 1, segunda: 2, segundo: 2, tercera: 3, tercero: 3, tercer: 3, cuarta: 4, cuarto: 4, quinta: 5, quinto: 5 };
  const METODOS = { efectivo: 'efectivo', cash: 'efectivo', nequi: 'nequi', daviplata: 'daviplata', tarjeta: 'tarjeta', transferencia: 'transferencia' };
  const NOMBRE_METODO = { efectivo: 'Efectivo', nequi: 'Nequi', daviplata: 'DaviPlata', tarjeta: 'Tarjeta', transferencia: 'Transferencia' };

  // Texto en minúsculas, sin tildes ni signos; «$50.000» → «50000»; palabras que el dictado suele deformar.
  function normalizar(s){
    let t = String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    t = t.replace(/\$\s*/g, ' ').replace(/(\d)[.,](?=\d{3}(?!\d))/g, '$1').replace(/(\d)\s*k\b/g, '$1 mil');
    t = t.replace(/\.(?!\d)/g, ' ').replace(/(^|\D)\./g, '$1 ').replace(/[^a-z0-9.\s]/g, ' ').replace(/\s+/g, ' ').trim();
    return t
      .replace(/\b(meza|misa|messa|mensa)\b/g, 'mesa').replace(/\b(mesa|mesita)(\d+)\b/g, 'mesa $2')
      .replace(/\b(neki|nekui|nequy|neqi|nequis)\b/g, 'nequi')
      .replace(/\b(davi ?plata|davivienda plata|davi plato)\b/g, 'daviplata')
      .replace(/\b(datafono|datafono|tarjeta de credito|tarjeta debito|tarjeta de debito|tarjeta credito|con tarjeta|credito|debito)\b/g, 'tarjeta')
      .replace(/\b(transfer|transferencias|bancolombia|bre ?b|llave)\b/g, 'transferencia')
      .replace(/\b(poquer|pocker|pokers|poquers)\b/g, 'poker')
      .replace(/\bmedia docena\b/g, '6').replace(/\b(una|un) docena\b/g, '12').replace(/\b(un|una) par de\b/g, '2').replace(/\bun par\b/g, '2')
      .replace(/\s+/g, ' ').trim();
  }
  // Las secuencias de números dichos en palabras se vuelven cifras: «cincuenta y dos mil quinientos» → «52500».
  function numerar(t){
    const w = String(t || '').split(' ').filter(Boolean), out = [];
    for(let i = 0; i < w.length;){
      const r = leerNumero(w, i);
      if(r){ out.push(String(r.valor)); i = r.fin; } else { out.push(w[i]); i++; }
    }
    return out.join(' ');
  }
  function leerNumero(w, i){
    let total = 0, grupo = 0, prev = null, j = i, algo = false;
    const esNum = x => /^\d+$/.test(x);
    while(j < w.length){
      const x = w[j];
      if(esNum(x) && j === i){ grupo = parseInt(x, 10); prev = 'cifra'; algo = true; j++; continue; }
      if(x === 'y' && prev === 'decena' && j + 1 < w.length && UNI[w[j + 1]] != null && UNI[w[j + 1]] > 0 && UNI[w[j + 1]] < 10){ j++; continue; }
      if(x === 'y' && (prev === 'mil' || prev === 'millon') && j + 1 < w.length && CIEN[w[j + 1]] != null){ j++; continue; }
      if(UNI[x] != null){
        const v = UNI[x];
        if(prev === 'unidad' || prev === 'cifra') break;
        if(prev === 'decena' && v >= 10) break;
        grupo += v; prev = (v === 20 || (v >= 30 && v % 10 === 0)) ? 'decena' : 'unidad'; algo = true; j++; continue;
      }
      if(CIEN[x] != null){
        if(prev && prev !== 'mil' && prev !== 'millon') break;
        grupo += CIEN[x]; prev = 'ciento'; algo = true; j++; continue;
      }
      if(MIL[x] != null && algo || (x === 'mil' && !algo)){
        if(prev === 'mil') break;
        total += (grupo || 1) * 1000; grupo = 0; prev = 'mil'; algo = true; j++; continue;
      }
      if(MILLON[x] != null && algo){
        total += (grupo || 1) * 1e6; grupo = 0; prev = 'millon'; j++; continue;
      }
      break;
    }
    if(!algo || j === i) return null;
    return { valor: total + grupo, fin: j };
  }
  // Singular sencillo y simétrico (se aplica igual a lo dicho y a los nombres de los productos).
  function singular(x){
    if(x.length <= 3 || /\d/.test(x)) return x;
    if(/ces$/.test(x)) return x.slice(0, -3) + 'z';
    if(/[aeiou]s$/.test(x)) return x.slice(0, -1);
    if(/[nlrdjy]es$/.test(x)) return x.slice(0, -2);
    if(/s$/.test(x) && x.length > 4) return x.slice(0, -1);
    return x;
  }
  const JERGA = { pola: 'cerveza', birra: 'cerveza', fria: 'cerveza', cervecita: 'cerveza', guaro: 'aguardiente', tintico: 'tinto', cafecito: 'cafe',
    cocacola: 'coca cola', gaseosita: 'gaseosa', agüita: 'agua' };
  const VACIAS = new Set(['el', 'la', 'los', 'las', 'lo', 'de', 'del', 'un', 'una', 'unos', 'unas', 'por', 'favor', 'porfa', 'porfavor', 'otra', 'otro', 'otras', 'otros', 'mas', 'tambien', 'ademas', 'me', 'nos', 'le', 'les', 'pa', 'para']);
  // Clave de comparación de un nombre de producto o de lo dicho.
  function clave(s){
    return numerar(normalizar(s)).split(' ').filter(x => x && !VACIAS.has(x)).map(x => {
      let y = x.replace(/^(\w{3,})it([ao])$/, '$1$2');
      y = singular(y); y = JERGA[y] || JERGA[x] || y;
      return y;
    }).join(' ').trim();
  }
  function lev(a, b){
    const m = a.length, n = b.length; if(!m) return n; if(!n) return m;
    let prev = []; for(let j = 0; j <= n; j++) prev[j] = j;
    for(let i = 1; i <= m; i++){ const cur = [i]; for(let j = 1; j <= n; j++) cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] : 1 + Math.min(prev[j - 1], prev[j], cur[j - 1]); prev = cur; }
    return prev[n];
  }
  const parecida = (a, b) => a === b || (Math.max(a.length, b.length) >= 4 && 1 - lev(a, b) / Math.max(a.length, b.length) >= 0.75);
  const CERVEZA = /\b(cerveza|aguila|poker|club colombia|costena|costenita|corona|pilsen|redds|budweiser|heineken|stella|cola y pola|andina|miller|tecate|bbc|apostol)\b/;
  function puntaje(q, p, alias){
    const qs = q.split(' ');
    const nombres = [[clave(p.name), 100], [clave(p.name + ' ' + (p.size || '')), 100]].concat((alias || []).map(a => [clave(a), 97]));
    let mejor = 0;
    nombres.forEach(([n, exacto]) => {
      if(!n) return;
      const ns = n.split(' ');
      let s = 0;
      if(n === q) s = exacto;
      else if(qs.every(x => ns.includes(x))) s = Math.max(70, 85 - 3 * (ns.length - qs.length));
      else if(ns.every(x => qs.includes(x))) s = Math.max(60, 75 - 3 * (qs.length - ns.length));
      else if(qs.every(x => ns.some(y => parecida(x, y)))) s = 66 - 6 * Math.abs(ns.length - qs.length);
      if(s > mejor) mejor = s;
    });
    return mejor;
  }
  // { producto } si es uno solo y claro · { candidatos: [...] } si hay varios parecidos · { } si no está.
  function resolverProducto(texto, productos, o){
    o = o || {};
    const L = (productos || []).filter(p => p && p.name);
    const q = clave(texto);
    if(!q) return { producto: null, candidatos: [] };
    if(q === 'cerveza'){
      const c = L.filter(p => CERVEZA.test(normalizar(p.name + ' ' + (p.category || ''))) || /cerveza/.test(normalizar(o.categoria ? o.categoria(p) : '')));
      return c.length === 1 ? { producto: c[0], candidatos: [] } : { producto: null, candidatos: c.slice(0, 5), generico: 'cerveza' };
    }
    const sc = L.map(p => [p, puntaje(q, p, o.alias ? o.alias(p) : null)]).filter(x => x[1] >= 60).sort((a, b) => b[1] - a[1]);
    if(!sc.length){
      let x = null; try{ x = o.extra ? o.extra(texto) : null; }catch(e){}
      // El buscador aproximado de siempre solo cuenta si alguna palabra se parece de verdad (no se inventa).
      const parece = x && L.includes(x) && q.split(' ').some(a => clave(x.name + ' ' + (o.alias ? o.alias(x) : []).join(' ')).split(' ').some(b => parecida(a, b)));
      return parece ? { producto: x, candidatos: [], aproximado: true } : { producto: null, candidatos: [] };
    }
    const top = sc[0][1], emp = sc.filter(x => top - x[1] < 6);
    if(emp.length === 1) return { producto: sc[0][0], candidatos: [] };
    return { producto: null, candidatos: emp.slice(0, 5).map(x => x[0]) };
  }
  // Respuesta a «¿cuál?»: «la primera», «la de 400», «la grande», o el nombre.
  function elegirCandidato(texto, cands){
    const t = numerar(normalizar(texto)), w = t.split(' ');
    for(const x of w){ if(ORD[x] && cands[ORD[x] - 1]) return cands[ORD[x] - 1]; }
    const tam = p => { const m = String(p.size || p.name || '').toLowerCase().replace(',', '.').match(/(\d+(?:\.\d+)?)\s*(ml|cc|l|lt|litro|litros|g|gr|kg|oz)?/); if(!m) return 0; const v = parseFloat(m[1]); return /^(l|lt|litro|litros|kg)$/.test(m[2] || '') ? v * 1000 : v; };
    if(/\b(grande|mas grande|la grande|familiar)\b/.test(t)){ return cands.slice().sort((a, b) => tam(b) - tam(a) || (b.price || 0) - (a.price || 0))[0]; }
    if(/\b(pequena|pequeno|chiquita|chiquito|mini|personal|mas pequena)\b/.test(t)){ return cands.slice().sort((a, b) => tam(a) - tam(b) || (a.price || 0) - (b.price || 0))[0]; }
    const r = resolverProducto(texto, cands);
    if(r.producto) return r.producto;
    const n = w.find(x => /^\d+(\.\d+)?$/.test(x));
    if(n){ const c = cands.filter(p => clave(p.name + ' ' + (p.size || '')).split(' ').includes(n)); if(c.length === 1) return c[0]; }
    return null;
  }
  const UNIDAD_MEDIDA = /^(ml|cc|l|lt|lts|litro|litros|g|gr|grs|gramo|gramos|kg|kilo|kilos|oz|onza|onzas|libra|libras|mililitro|mililitros)$/;
  // «2 aguilas y 1 poker, 3 empanadas» → [{ qty, texto }]
  // ⚖️ 1.69.0: peso dicho al comienzo: «medio kilo de queso», «2 libras de carne», «300 gramos de jamón», «kilo y medio de
  // papa», «un cuarto de libra». Devuelve los gramos (la libra es de 500 g, como en Colombia) y el producto.
  const RE_PESO = /^(\d+(?:\.\d+)?|medio|media|(?:1 )?cuarto de)?\s*(kilos?|kilogramos?|kg|kgs|kilito|libras?|lb|lbs|librita|gramos?|gr|grs|g)(?:\s+y\s+(medio|media|cuarto))?\s+(?:de\s+)?(.+)$/;
  function pesoDicho(c){
    const m = String(c || '').match(RE_PESO); if(!m) return null;
    const u = /^(kilo|kg)/.test(m[2]) ? 1000 : /^(libra|lb|librita)/.test(m[2]) ? 500 : 1;
    let n = m[1] == null ? 1 : /^med/.test(m[1]) ? 0.5 : /cuarto/.test(m[1]) ? 0.25 : parseFloat(m[1]);
    if(m[3]) n += /cuarto/.test(m[3]) ? 0.25 : 0.5;
    const gramos = Math.round(n * u);
    return gramos > 0 && gramos <= 50000 ? { gramos, texto: m[4].trim() } : null;
  }
  function partirItems(t, protegidos){
    let s = ' ' + t.replace(/\b(kilos?|libras?)\s+y\s+(medio|media|cuarto)\b/g, '$1_y_$2') + ' ';
    (protegidos || []).forEach(n => { if(n.includes(' y ')) s = s.split(' ' + n + ' ').join(' ' + n.replace(/ /g, '_') + ' '); });
    const trozos = s.split(/\s*(?:,|;|\by\b|\be\b|\bmas\b|\btambien\b|\bademas\b|\bcon\s+(?=\d))\s*/).map(x => x.trim()).filter(Boolean);
    const out = [];
    trozos.forEach(tr => {
      const w = tr.split(' ').filter(Boolean); let cur = [];
      w.forEach((x, k) => {
        if(/^\d+$/.test(x) && +x < 100 && cur.length && !/^\d+$/.test(cur[cur.length - 1]) && !UNIDAD_MEDIDA.test(w[k + 1] || '') && cur.some(y => !/^\d+$/.test(y))) { out.push(cur.join(' ')); cur = []; }
        cur.push(x);
      });
      if(cur.length) out.push(cur.join(' '));
    });
    return out.map(c => {
      const pz = pesoDicho(c.replace(/_/g, ' '));
      if(pz){ const w0 = pz.texto.split(' ').filter(Boolean); while(w0.length && VACIAS.has(w0[0])) w0.shift(); return { qty: 1, qtyDicha: false, gramos: pz.gramos, texto: w0.join(' ') }; }
      const w = c.replace(/_/g, ' ').split(' ').filter(Boolean);
      let qty = null;
      if(w.length > 1 && /^\d+$/.test(w[0]) && +w[0] > 0 && +w[0] < 1000 && !UNIDAD_MEDIDA.test(w[1])){ qty = +w.shift(); }
      else if(w.length > 1 && /^\d+$/.test(w[w.length - 1]) && +w[w.length - 1] < 100 && !UNIDAD_MEDIDA.test(w[w.length - 2] || '')){ qty = +w.pop(); }
      while(w.length && VACIAS.has(w[0])) w.shift();
      const texto = w.join(' ').replace(/\b(por favor|porfa)\b/g, '').trim();
      return { qty: qty || 1, qtyDicha: qty != null, texto };
    }).filter(x => x.texto && !/^\d+$/.test(x.texto));
  }
  const VERBOS_AGREGAR = /\b(agrega|agregar|agregame|agregale|anade|anadir|anademe|pon|ponme|ponle|ponga|pongale|dame|deme|damelo|regalame|regaleme|regala|vende|vendeme|venda|suma|sumale|sumame|mete|metele|anota|anotale|apunta|carga|cargale|sirve|sirveme|traeme|trae|traiga|quiero|queremos|necesito|dale|echale|manda|mandame|lleva|llevo|va|van|venta de|vendi)\b/g;
  const RE_CONFIRMA = /^(si|sii|claro|confirmo|confirmado|confirmar|confirma|correcto|ok|okey|okay|listo|de una|hagale|eso es|asi es|perfecto|dale)( (senor|senora|por favor|ya|la venta|el cobro|el pago|todo|confirmo|si))*$/;
  const RE_CANCELA = /^(no|nop|nada|cancela|cancelar|cancelalo|cancelala|olvidalo|olvida|mejor no|dejalo|negativo|para|detente|alto|stop)( (eso|la operacion|el cobro|gracias|asi|mejor|nada))*$/;

  // Frase → orden. ctx: { productos, total, alias(p), extra(texto) }
  function interpretar(texto, ctx){
    ctx = ctx || {};
    const R = { texto: String(texto || ''), intent: 'desconocido', items: [], mesa: null, mesaDicha: false, monto: null, metodo: null, pagos: null };
    let t = numerar(normalizar(texto)).replace(/^(oye |hola |ey |ok |okey )?(ordeva|hordeva|or deva|laya)\b\s*/, '').replace(/\b(por favor|porfa|porfavor)\b/g, ' ').replace(/\s+/g, ' ').trim();
    R.t = t;
    if(!t) return R;
    // Mesa: solo con la palabra «mesa» y su número. Si no se entiende el número NO se adivina.
    const mm = t.match(/\b(?:(?:a|para|en|de|pa) )?(?:la )?(?:mesa|mesita)(?: (?:numero|num|nro|no|n|la|el))? (\d+|primera|primero|segunda|segundo|tercera|tercero|cuarta|cuarto|quinta|quinto)\b/);
    if(mm){ R.mesaDicha = true; R.mesa = /^\d+$/.test(mm[1]) ? +mm[1] : ORD[mm[1]]; t = (t.slice(0, mm.index) + ' ' + t.slice(mm.index + mm[0].length)).replace(/\s+/g, ' ').trim(); }
    else if(/\b(mesa|mesita)\b/.test(t)){ R.mesaDicha = true; t = t.replace(/\b(?:(?:a|para|en|de) (?:la )?)?(mesa|mesita)\b/, ' ').replace(/\s+/g, ' ').trim(); }
    const metodos = []; t.replace(/\b(efectivo|cash|nequi|daviplata|tarjeta|transferencia)\b/g, (m, x, i) => { metodos.push([METODOS[x], i]); return m; });
    if(metodos.length) R.metodo = metodos[0][0];
    const nums = (t.match(/\b\d+\b/g) || []).map(Number);
    const montoDe = () => {
      let m = nums.length ? Math.max.apply(null, nums) : null;
      if(m != null && m < 1000 && [1, 2, 5, 10, 20, 50, 100].includes(m) && (/\bbillete/.test(t) || (ctx.total || 0) > m)){ m *= 1000; R.montoInferido = true; }
      return m;
    };
    const es = re => re.test(t);

    if(RE_CONFIRMA.test(t) || es(/\bconfirm\w* (la |el )?(venta|cobro|pago|compra)\b/)){ R.intent = 'confirmar'; return R; }
    if(RE_CANCELA.test(t)){ R.intent = 'cancelar'; return R; }
    if(es(/\b(ayuda|que puedo decir|comandos|como funciona|que se puede)\b/)){ R.intent = 'ayuda'; return R; }

    // 💵 Pago mixto: dos medios de pago en la misma frase.
    const distintos = [...new Set(metodos.map(x => x[0]))];
    if(distintos.length >= 2){
      const pagos = [];
      metodos.forEach(([m, pos], k) => {
        if(pagos.some(x => x.metodo === m)) return;
        const desde = k ? metodos[k - 1][1] : 0, seg = t.slice(desde, pos + 1 + m.length).replace(/\b(efectivo|cash|nequi|daviplata|tarjeta|transferencia)\b(?=.*\b(efectivo|cash|nequi|daviplata|tarjeta|transferencia)\b)/, '');
        const n = (seg.match(/\b\d+\b/g) || []).map(Number);
        let v = n.length ? n[n.length - 1] : null;
        if(v != null && v < 1000 && [1, 2, 5, 10, 20, 50, 100].includes(v)) v *= 1000;
        if(/\b(resto|lo demas|el resto|lo que falta|la diferencia)\b/.test(seg)) v = null;
        pagos.push({ metodo: m, monto: v });
      });
      R.intent = R.mesa != null || (R.mesaDicha) ? 'mesa_cobrar' : 'cobrar'; R.pagos = pagos; R.metodo = 'mixto';
      return R;
    }
    // 💵 «Me paga con cincuenta mil», «recibí 100 mil», «con un billete de 50».
    if(nums.length && (es(/\b(paga|pagan|pago|pague|me dio|me dan|me da|le dio|entrega|entrego|recibi|recibo|recibido|billete|billetes)\b/) || es(/^(y )?con (un billete de |billete de )?\d+( pesos)?$/)) && !es(/\b(cobra|cobrar|cobrale|cobre)\b/) && !es(VERBOS_AGREGAR_TEST())){
      R.intent = 'recibido'; R.monto = montoDe(); return R;
    }
    if(es(/\b(vueltas|vuelto|devuelvo|devolver|devuelve|cambio)\b/) && (es(/\b(cuanto|cuantas|que|dime|calcula|cuales)\b/) || es(/^(las |el )?(vueltas|vuelto|cambio)$/))){ R.intent = 'vueltas'; return R; }
    // Cobrar (en la caja o una mesa). «En efectivo» / «por Nequi» solos también cobran.
    if(es(/\b(cobra|cobrar|cobrale|cobralo|cobrala|cobrame|cobre|cobro|cobrele|factura|facturar|facturale)\b/) || es(/\b(cierra|cerrar|cierre|termina|terminar|finaliza|finalizar)\b (la )?(venta|cuenta)\b/) ||
       es(/^(en |por |con |pago en |paga en |pago con |paga con |pagan con |pagan en )?(efectivo|cash|nequi|daviplata|tarjeta|transferencia)$/) || (R.mesaDicha && es(/\b(cierra|cerrar|cierre|liquida|liquidar)\b/))){
      R.intent = R.mesaDicha ? 'mesa_cobrar' : 'cobrar';
      if(nums.length && R.metodo === 'efectivo') R.monto = montoDe();
      return R;
    }
    if(es(/\bdescuento\b/)){ R.intent = 'descuento'; return R; }
    if(es(/\b(ver|muestra|muestrame|mostrar|cuales|recupera|recuperar|abre|abrir)\b.*\bpendientes?\b/)){ R.intent = 'pendientes'; return R; }
    if(es(/\b(suspend\w*|en espera|pendiente|aparta|apartala)\b/) || es(/\bguarda(la)? (la )?venta\b/)){ R.intent = 'suspender'; return R; }
    if(es(/^(pon(le)? (una )?nota|nota|observacion)\b/)){ R.intent = 'nota'; R.nota = t.replace(/^(pon(le)? (una )?nota|nota|observacion)\s*(que\s+)?/, '').trim(); return R; }
    // Preguntas.
    if(es(/\b(cuanto|cuantos|cuantas) (es|son|va|van|lleva|llevamos|llevo|da|suma|seria|serian|queda|le cobro|cobro|debe|deben|debo|esta la cuenta)\b/) && !es(/\b(vale|valen|cuesta|cuestan)\b/) || es(/^(el |la )?(total|cuenta)$/) || es(/\b(dime|dame|cual es) (el )?total\b/)){
      R.intent = R.mesaDicha ? 'mesa_saldo' : 'total'; return R;
    }
    if(es(/\b(cuanto (vale|valen|cuesta|cuestan|sale|salen|esta|estan)|precio|a como (esta|estan|es|son|sale|salen))\b/)){
      R.intent = 'precio'; R.items = [{ qty: 1, texto: t.replace(/\b(cuanto|vale|valen|cuesta|cuestan|sale|salen|esta|estan|el|la|los|las|precio|de|del|a|como|es|son|que|dime|cual)\b/g, ' ').replace(/\s+/g, ' ').trim() }].filter(x => x.texto);
      return R;
    }
    if(es(/\bcuant[oa]s?\b.*\b(hay|quedan|queda|tengo|tenemos|tienes)\b/) || es(/\b(stock|inventario|existencias?)\b/) || es(/^(hay|quedan|todavia hay|aun hay)\b/)){
      R.intent = 'stock'; R.items = [{ qty: 1, texto: t.replace(/\b(cuantos|cuantas|cuanto|cuanta|hay|quedan|queda|tengo|tenemos|tienes|nos|me|stock|inventario|existencias|existencia|de|del|el|la|los|las|todavia|aun|en)\b/g, ' ').replace(/\s+/g, ' ').trim() }].filter(x => x.texto);
      return R;
    }
    if(es(/\b(que (lleva|llevo|llevamos|hay|tengo|va|van|tiene|pidio|pidieron)|lee(me)? (la )?(venta|cuenta|lista|pedido)|que (productos|cosas)|resumen|repasa|repasame|que hay en (la )?(venta|cuenta))\b/)){
      R.intent = R.mesaDicha ? 'mesa_items' : 'items'; return R;
    }
    if(es(/\b(quita|quitar|borra|borrar|elimina|eliminar|saca|sacar|deshaz|deshace|deshacer)\b (lo |el |la )?(ultimo|ultima|anterior)\b/) || es(/^(deshaz|deshacer|deshace|eso no|lo ultimo no)$/)){ R.intent = 'quitar_ultimo'; return R; }
    if(es(/\b(vacia|vaciar|limpia|limpiar|borra|borrar|cancela|cancelar|anula|anular|elimina|eliminar)\b( toda| todo)? (la venta|el carrito|la caja|la cuenta|todo|toda)\b/) || es(/\b(nueva venta|empezar de nuevo|empieza de nuevo|de cero)\b/)){ R.intent = 'vaciar'; return R; }
    if(es(/\b(repite|repetir|repiteme|repetime|otra vez|lo mismo|otra igual|otra ronda|misma ronda|la misma)\b/)){ R.intent = 'repetir'; R.venta = es(/\b(venta|ultima venta|venta anterior|cliente anterior)\b/); return R; }
    if(R.mesaDicha && es(/^(abre|abrir|abreme|abri|muestra|muestrame|ver|ve a|ir a|vamos a)?$/)){ R.intent = 'mesa_abrir'; return R; }
    // Cambiar la cantidad: «cambia las águilas a 3», «que sean 3 águilas», «deja 2 póker», «no, eran dos».
    if(es(/\b(que sean|cambia|cambiale|cambiar|corrige|corregir|corrigela|corrigelo|deja|dejame|dejale|eran|ajusta|modifica|mejor)\b/)){
      let s = t.replace(/\b(no|que sean|cambia|cambiale|cambiar|corrige|corregir|corrigela|corrigelo|deja|dejame|dejale|eran|ajusta|modifica|mejor|son|en realidad|la cantidad de|cantidad)\b/g, ' ').replace(/\s+/g, ' ').trim();
      const fin = s.match(/^(.*?)\s+(?:a|en|por)\s+(\d+)$/);
      R.intent = R.mesaDicha ? 'mesa_cantidad' : 'cantidad';
      R.items = fin ? [{ qty: +fin[2], qtyDicha: true, texto: clave(fin[1]) ? fin[1].replace(/^(el|la|los|las|de)\s+/, '') : '' }].filter(x => x.texto) : partirItems(s, ctx.protegidos);
      if(!R.items.length && /^\d+$/.test(s)) R.qtySola = +s;      // «no, eran dos»: lo último que se agregó
      return R;
    }
    if(es(/\b(quita|quitar|quitame|quitale|saca|sacar|sacame|sacale|elimina|eliminar|eliminame|borra|borrar|borrame|resta|restar|restale|restame|menos)\b/)){
      const s = t.replace(/\b(quita|quitar|quitame|quitale|saca|sacar|sacame|sacale|elimina|eliminar|eliminame|borra|borrar|borrame|resta|restar|restale|restame|menos)\b/g, ' ').replace(/\s+/g, ' ').trim();
      R.intent = R.mesaDicha ? 'mesa_quitar' : 'quitar'; R.items = partirItems(s, ctx.protegidos); return R;
    }
    const s = t.replace(VERBOS_AGREGAR, ' ').replace(/\s+/g, ' ').trim();
    R.items = partirItems(s, ctx.protegidos);
    if(R.items.length) R.intent = R.mesaDicha ? 'mesa_agregar' : 'agregar';
    else if(R.mesaDicha) R.intent = 'mesa_abrir';
    return R;
  }
  function VERBOS_AGREGAR_TEST(){ return new RegExp(VERBOS_AGREGAR.source); }

  const motor = { normalizar, numerar, singular, clave, resolverProducto, elegirCandidato, partirItems, interpretar, leerNumero, pesoDicho };

  // Sin navegador (pruebas en Node): solo el motor.
  if(typeof window === 'undefined'){ if(typeof module !== 'undefined') module.exports = motor; return; }

  // ======================================================================
  // 2. ESTADO, PREFERENCIAS Y RESPUESTAS
  // ======================================================================
  const KEY = 'vento_caja_voz';
  const DEF = { responder: true, volumen: 1, manos: false, privacidad: false, local: false };
  const lsGet = (k, d) => { try{ const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); }catch(e){ return d; } };
  const lsSet = (k, v) => { try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} };
  const cfg = () => Object.assign({}, DEF, lsGet(KEY, {}) || {});
  const ponerCfg = c => { lsSet(KEY, Object.assign(cfg(), c)); pintar(); };
  const D = () => { try{ return typeof data !== 'undefined' ? data : null; }catch(e){ return null; } };
  const P = () => window.ventoPOS || null;
  const plata = n => { try{ return fmt(Number(n) || 0); }catch(e){ return '$' + Math.round(Number(n) || 0).toLocaleString('es-CO'); } };
  const pesosVoz = n => { try{ return typeof fmtSpoken === 'function' ? fmtSpoken(n) : Math.round(n).toLocaleString('es-CO') + ' pesos'; }catch(e){ return Math.round(n) + ' pesos'; } };
  const aviso = (m, ms) => { try{ showToast(m, ms); }catch(e){} };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nombreP = p => p.name + (p.size && !String(p.name).toLowerCase().includes(String(p.size).toLowerCase()) ? ' ' + p.size : '');

  const S = {
    estado: 'apagado',       // apagado · escuchando · procesando · entendido · no_entendido · sin_permiso · sin_red · no_disponible
    oido: '',                // lo que se va oyendo (transcripción)
    respuesta: '',           // lo que ORDEVA respondió
    pregunta: null,          // { tipo: 'producto'|'metodo'|'monto'|'mesa', texto, opciones, seguir(fn) }
    confirmar: null,         // { nivel: 'modificacion'|'financiera', texto, hacer() , hasta }
    recibido: 0,             // «me paga con 50 mil» (para la venta de la caja)
    ultimo: [],              // lo último agregado por voz: [{ id, qty }]
    ultimaOrden: null,       // para «repite»
    ocupado: false,          // un cobro en curso: no se aceptan dos a la vez
    vacios: 0                // manos libres: silencios seguidos
  };
  const registro = [];       // las últimas órdenes (para soporte y pruebas): { t, texto, intent, resultado }

  function decir(texto, o){
    S.respuesta = texto; pintar();
    if(!texto || !cfg().responder) return;
    try{ window.ventoHablar ? window.ventoHablar(texto, { volumen: cfg().volumen }) : (typeof speakVoice === 'function' && speakVoice(texto)); }catch(e){}
  }
  function responder(texto, o){ o = o || {}; decir(texto); if(o.toast !== false) aviso((o.icono || '🎙️ ') + texto, o.ms || 4500); }

  // ======================================================================
  // 3. EJECUTOR (sobre la caja y las mesas de siempre)
  // ======================================================================
  const productos = () => ((D() || {}).products || []).filter(p => p && p.name);
  const aliasDe = p => { try{ return typeof voiceAliasTermsForProduct === 'function' ? voiceAliasTermsForProduct(p) : []; }catch(e){ return []; } };
  const extra = txt => { try{ return typeof findProductByVoiceAlias === 'function' ? findProductByVoiceAlias(txt) : null; }catch(e){ return null; } };
  const protegidos = () => productos().map(p => clave(p.name)).filter(n => n.includes(' y '));
  const resolver = (txt, lista) => resolverProducto(txt, lista || productos(), { alias: aliasDe, extra: lista ? null : extra });
  const resumen = () => { const p = P(); return p && p.resumen ? p.resumen() : { lineas: [], bruto: 0, descuento: 0, total: 0 }; };
  const mesas = () => (D() || {}).tables || {};
  const mesaNombre = id => { try{ return typeof tableLabel === 'function' ? tableLabel(id) : 'Mesa ' + id; }catch(e){ return 'Mesa ' + id; } };
  const saldoMesa = id => { try{ return typeof tableBalance === 'function' ? tableBalance(id) : 0; }catch(e){ return 0; } };

  function preguntar(tipo, texto, opciones, seguir){
    S.pregunta = { tipo, texto, opciones: opciones || [], seguir, hasta: Date.now() + 30000 };
    responder(texto, { icono: '❓ ', ms: 7000 });
  }
  function pedirConfirmacion(nivel, texto, hacer, voz){
    S.confirmar = { nivel, texto, hacer, hasta: Date.now() + 30000 };
    S.pregunta = null;
    pintar();
    decir(voz || texto);
  }

  // Resuelve todos los productos de una orden; si alguno es dudoso pregunta y luego sigue con el resto.
  function resolverItems(items, lista, listo){
    const out = [], faltan = [];
    const paso = k => {
      for(; k < items.length; k++){
        const it = items[k];
        const r = resolver(it.texto, lista);
        if(r.producto){ out.push(Object.assign({}, it, { producto: r.producto })); continue; }
        if(r.candidatos && r.candidatos.length){
          const ops = r.candidatos;
          preguntar('producto', (r.generico ? '¿Cuál ' + r.generico + '? ' : '¿Cuál ' + it.texto + '? ') + ops.map((p, i) => (i ? (i === ops.length - 1 ? ' o ' : ', ') : '') + nombreP(p)).join('') + '.',
            ops.map(p => ({ id: p.id, txt: nombreP(p) + ' · ' + plata(p.price) })),
            resp => { const p = typeof resp === 'object' ? resp : elegirCandidato(resp, ops); if(!p) return false; out.push(Object.assign({}, it, { producto: p })); paso(k + 1); return true; });
          return;
        }
        faltan.push(it.texto);
      }
      listo(out, faltan);
    };
    paso(0);
  }

  function noEncontre(faltan){ return faltan.length ? 'No encontré ' + faltan.map(x => '«' + x + '»').join(', ') + ' en tus productos; no lo agregué.' : ''; }

  const ACCIONES = {
    agregar(R){
      const p = P(); if(!p) return;
      resolverItems(R.items, null, (ok, faltan) => {
        const hechos = [], aPesar = [], porUnidad = [];
        const EQ = window.ventoEquipos, unidad = pr => { try{ return EQ ? EQ.unidadDe(pr) : ''; }catch(e){ return ''; } };
        const f = () => ok.forEach(it => {
          const u = unidad(it.producto);
          // ⚖️ Por kilo o por libra: con el peso dicho se agrega ya; sin peso se abre la ventana para pesarlo.
          if(u && it.gramos){ const cant = it.gramos / (u === 'lb' ? 500 : 1000); if(p.sumarPeso && p.sumarPeso(it.producto.id, cant)) hechos.push({ id: it.producto.id, qty: cant, p: it.producto, peso: EQ.pesoTxt(cant, u) }); return; }
          if(u){ aPesar.push(it.producto); p.sumar(it.producto.id, 1); return; }
          if(it.gramos){ porUnidad.push(it.producto); return; }
          if(p.sumar(it.producto.id, it.qty)) hechos.push({ id: it.producto.id, qty: it.qty, p: it.producto });
        });
        if(window.ventoSonidos && window.ventoSonidos.lote) window.ventoSonidos.lote(f); else f();
        if(hechos.length){ S.ultimo = hechos.map(x => ({ id: x.id, qty: x.qty })); S.ultimaOrden = { intent: 'agregar', items: hechos.map(x => ({ qty: x.qty, producto: x.p })) }; }
        const stock = hechos.filter(x => x.p.stock != null && x.p.stock < (p.cuanto ? p.cuanto(x.id) : x.qty)).map(x => 'de ' + x.p.name + ' solo quedan ' + Math.max(0, x.p.stock));
        const t = (hechos.length ? hechos.map(x => x.peso ? x.peso + ' de ' + nombreP(x.p) : (x.qty > 1 ? x.qty + ' ' : '') + nombreP(x.p)).join(', ') + ' agregado a la venta. Total ' + pesosVoz(resumen().total) + '.' : '') +
          (aPesar.length ? ' ' + aPesar.map(nombreP).join(', ') + ' se vende por peso: pésalo en la ventana o di, por ejemplo, «medio kilo de ' + aPesar[0].name.toLowerCase() + '».' : '') +
          (porUnidad.length ? ' ' + porUnidad.map(nombreP).join(', ') + ' se vende por unidad, no por peso: di cuántas.' : '') +
          (stock.length ? ' Ojo: ' + stock.join('; ') + '.' : '') + (faltan.length ? ' ' + noEncontre(faltan) : '');
        responder(t.trim() || 'No agregué nada.', { icono: hechos.length ? '✅ ' : '⚠️ ' });
      });
    },
    quitar(R){
      const p = P(); if(!p) return;
      const enVenta = resumen().lineas.map(l => productos().find(x => x.id === l.id)).filter(Boolean);
      if(!enVenta.length) return responder('La venta está vacía.');
      resolverItems(R.items, enVenta, (ok, faltan) => {
        const hechos = ok.map(it => {
          const ahora = p.cuanto(it.producto.id), queda = it.qtyDicha ? Math.max(0, ahora - it.qty) : 0;
          p.fijar(it.producto.id, queda); return nombreP(it.producto) + (queda ? ' queda en ' + queda : ' quitado');
        });
        responder((hechos.join(', ') + (hechos.length ? '.' : '') + (faltan.length ? ' ' + faltan.map(x => '«' + x + '»').join(', ') + ' no está en la venta.' : '')).trim(), { icono: '➖ ' });
      });
    },
    cantidad(R){
      const p = P(); if(!p) return;
      if(!R.items.length && R.qtySola != null){
        if(S.ultimo.length !== 1) return responder('¿De qué producto? Di por ejemplo: que sean ' + R.qtySola + ' águilas.');
        const pr = productos().find(x => x.id === S.ultimo[0].id); if(!pr) return responder('Ese producto ya no está.');
        R = { items: [{ qty: R.qtySola, qtyDicha: true, texto: pr.name }] };
      }
      resolverItems(R.items, null, (ok, faltan) => {
        const hechos = ok.map(it => { p.fijar(it.producto.id, it.qty); return nombreP(it.producto) + (it.qty ? ' en ' + it.qty : ' quitado'); });
        responder((hechos.join(', ') + (hechos.length ? '. Total ' + pesosVoz(resumen().total) + '.' : '') + (faltan.length ? ' ' + noEncontre(faltan) : '')).trim(), { icono: '✏️ ' });
      });
    },
    quitar_ultimo(){
      const p = P(); if(!p) return;
      if(!S.ultimo.length) return responder('No hay nada que deshacer por voz.');
      const n = S.ultimo.map(x => { const pr = productos().find(y => y.id === x.id); p.fijar(x.id, Math.max(0, p.cuanto(x.id) - x.qty)); return pr ? nombreP(pr) : ''; }).filter(Boolean);
      S.ultimo = [];
      responder('Quité lo último: ' + n.join(', ') + '.', { icono: '↩️ ' });
    },
    vaciar(){
      const r = resumen(); if(!r.lineas.length) return responder('La venta ya está vacía.');
      pedirConfirmacion('modificacion', '¿Vaciar la venta? ' + r.lineas.length + ' producto' + (r.lineas.length === 1 ? '' : 's') + ' · ' + plata(r.total), () => { P().vaciarYa(); S.ultimo = []; S.recibido = 0; responder('Venta vaciada. Puedes deshacerlo con el botón.', { icono: '🗑️ ' }); },
        '¿Vacío la venta de ' + pesosVoz(r.total) + '? Di sí o no.');
    },
    repetir(R){
      const p = P(); if(!p) return;
      if(R.venta){
        const h = ((D() || {}).history || []).find(x => x && (x.items || []).length && !x.borrada);
        if(!h) return responder('Todavía no hay una venta anterior.');
        if(resumen().lineas.length) return responder('Cobra o suspende primero la venta que tienes en la caja.');
        p.repetir(h); return responder('Repetí la última venta. Total ' + pesosVoz(resumen().total) + '.', { icono: '🔁 ' });
      }
      if(!S.ultimaOrden) return responder('No hay una orden anterior para repetir.');
      ACCIONES.agregar({ items: S.ultimaOrden.items.map(x => ({ qty: x.qty, texto: x.producto.name })) });
    },
    total(){
      const r = resumen();
      if(!r.lineas.length) return responder('La venta está vacía.');
      const u = r.lineas.reduce((s, x) => s + (x.unidad ? 1 : Number(x.qty) || 0), 0);
      responder('Total ' + pesosVoz(r.total) + ', ' + u + ' producto' + (u === 1 ? '' : 's') + (r.descuento ? ', con descuento de ' + pesosVoz(r.descuento) : '') + '.', { icono: '🧾 ' });
    },
    items(){
      const r = resumen();
      if(!r.lineas.length) return responder('La venta está vacía.');
      responder('Llevas: ' + r.lineas.map(x => (x.unidad ? '' : x.qty + ' ') + x.name).join(', ') + '. Total ' + pesosVoz(r.total) + '.', { icono: '🧾 ', ms: 7000 });
    },
    precio(R){
      if(!R.items.length) return responder('¿El precio de qué producto?');
      const r = resolver(R.items[0].texto);
      if(r.producto) return responder(nombreP(r.producto) + ' vale ' + pesosVoz(r.producto.price) + '.', { icono: '💲 ' });
      if(r.candidatos.length) return responder(r.candidatos.map(p => nombreP(p) + ' ' + pesosVoz(p.price)).join('; ') + '.', { icono: '💲 ', ms: 7000 });
      responder(noEncontre([R.items[0].texto]).replace('; no lo agregué', ''));
    },
    stock(R){
      if(!R.items.length) return responder('¿El inventario de qué producto?');
      const di = p => p.stock == null ? nombreP(p) + ' no lleva control de inventario' : 'De ' + nombreP(p) + ' quedan ' + p.stock;
      const r = resolver(R.items[0].texto);
      if(r.producto) return responder(di(r.producto) + '.', { icono: '📦 ' });
      if(r.candidatos.length) return responder(r.candidatos.map(di).join('; ') + '.', { icono: '📦 ', ms: 7000 });
      responder(noEncontre([R.items[0].texto]).replace('; no lo agregué', ''));
    },
    recibido(R){
      const r = resumen();
      if(!R.monto) return preguntar('monto', '¿Con cuánto paga el cliente?', [], resp => { const m = typeof resp === 'number' ? resp : interpretar('con ' + resp, { total: r.total }).monto; if(!m) return false; ACCIONES.recibido({ monto: m }); return true; });
      S.recibido = R.monto;
      if(!r.lineas.length) return responder('Recibido ' + pesosVoz(R.monto) + ', pero la venta está vacía.');
      const c = P().cambio(r.total, R.monto);
      responder(c.estado === 'falta' ? 'Recibe ' + pesosVoz(R.monto) + '. Faltan ' + pesosVoz(c.falta) + '.' : c.estado === 'exacto' ? 'Pago exacto.' : 'Recibe ' + pesosVoz(R.monto) + '. Devuelve ' + pesosVoz(c.vueltas) + '.', { icono: '💵 ', ms: 8000 });
    },
    vueltas(){
      const r = resumen();
      if(!r.lineas.length) return responder('La venta está vacía.');
      if(!S.recibido) return ACCIONES.recibido({});
      ACCIONES.recibido({ monto: S.recibido });
    },
    cobrar(R){ cobrarCon(R, null); },
    confirmar(){
      const c = S.confirmar;
      if(c && Date.now() <= c.hasta){ S.confirmar = null; pintar(); try{ c.hacer(); }catch(e){ console.error('caja voz', e); } return; }
      S.confirmar = null;
      if(resumen().lineas.length) return cobrarCon({ intent: 'cobrar' }, null);
      responder('No hay nada que confirmar.');
    },
    cancelar(){
      const habia = S.confirmar || S.pregunta;
      S.confirmar = null; S.pregunta = null;
      responder(habia ? 'Cancelado. No se hizo nada.' : 'No había nada pendiente.', { icono: '✕ ' });
    },
    descuento(){
      const p = P(); if(!p || !resumen().lineas.length) return responder('La venta está vacía.');
      p.herramienta('desc'); responder('Abrí el descuento. ' + (jefe() ? '' : 'Necesita la autorización del dueño.'), { icono: '🏷️ ' });
    },
    suspender(){
      const p = P(); if(!p || !resumen().lineas.length) return responder('La venta está vacía.');
      const n = p.suspenderYa(); S.ultimo = []; S.recibido = 0;
      responder('Venta guardada como pendiente: ' + n + '.', { icono: '⏸️ ' });
    },
    pendientes(){ const p = P(); if(!p) return; const n = p.pendientes().length; if(!n) return responder('No hay ventas pendientes.'); p.herramienta('pend'); responder('Tienes ' + n + ' venta' + (n === 1 ? '' : 's') + ' pendiente' + (n === 1 ? '' : 's') + '.', { icono: '📂 ' }); },
    nota(R){ const p = P(); if(!p) return; if(!R.nota) return p.herramienta('nota'); p.ponerNota(R.nota); responder('Nota guardada: ' + R.nota + '.', { icono: '📝 ' }); },
    ayuda(){ abrirAyuda(); decir('Puedes decir: dos águilas, quita una póker, ¿cuánto es?, me paga con cincuenta mil, cobrar en efectivo.'); },

    // ---------- Mesas (las mismas funciones de la cuenta de siempre) ----------
    mesa_agregar(R){ conMesa(R, id => resolverItems(R.items, null, (ok, faltan) => aplicarMesa(id, ok, 'add', faltan))); },
    mesa_quitar(R){ conMesa(R, id => resolverItems(R.items, null, (ok, faltan) => aplicarMesa(id, ok.map(x => Object.assign({}, x, { qty: x.qtyDicha ? x.qty : 999 })), 'subtract', faltan))); },
    mesa_cantidad(R){ conMesa(R, id => resolverItems(R.items, null, (ok, faltan) => aplicarMesa(id, ok, 'set', faltan))); },
    mesa_saldo(R){ conMesa(R, id => { const t = mesas()[id]; if(!(t.items || []).length) return responder(mesaNombre(id) + ' no tiene nada pendiente.'); responder(mesaNombre(id) + ' debe ' + pesosVoz(saldoMesa(id)) + '.', { icono: '🧾 ' }); }); },
    mesa_items(R){ conMesa(R, id => { const t = mesas()[id], L = t.items || []; if(!L.length) return responder(mesaNombre(id) + ' está vacía.'); responder(mesaNombre(id) + ': ' + L.map(x => x.qty + ' ' + x.name).join(', ') + '. Debe ' + pesosVoz(saldoMesa(id)) + '.', { icono: '🧾 ', ms: 7000 }); }); },
    mesa_abrir(R){
      conMesa(R, id => {
        try{ P() && P().cerrarCaja && P().cerrarCaja(); }catch(e){}
        try{ openTableModal(id); }catch(e){}
        responder(mesaNombre(id) + '.', { icono: '🪑 ' });
      });
    },
    mesa_cobrar(R){ conMesa(R, id => { if(!(mesas()[id].items || []).length) return responder(mesaNombre(id) + ' no tiene nada por cobrar.'); cobrarCon(R, id); }); }
  };
  const jefe = () => { try{ return !window.ventoRoles || window.ventoRoles.esJefe(); }catch(e){ return true; } };

  // Nunca se toca una mesa equivocada: sin número claro se pregunta; si no existe, se dice.
  function conMesa(R, fn){
    if(R.mesa == null){
      return preguntar('mesa', '¿Cuál mesa? Di el número.', [], resp => { const n = typeof resp === 'number' ? resp : (numerar(normalizar(resp)).match(/\b\d+\b/) || [])[0]; if(!n) return false; R.mesa = +n; conMesa(R, fn); return true; });
    }
    if(!mesas()[R.mesa]) return responder('No encontré la ' + mesaNombre(R.mesa).toLowerCase() + '. No hice nada.', { icono: '⚠️ ' });
    fn(R.mesa);
  }
  function aplicarMesa(id, items, modo, faltan){
    if(typeof applyVoiceItems !== 'function') return responder('No pude usar las mesas en este equipo.');
    let r = { added: [], notFound: [] };
    if(items.length){
      const f = () => { r = applyVoiceItems(id, items.map(x => ({ qty: x.qty, productText: x.producto.name })), modo) || r; };
      if(window.ventoSonidos && window.ventoSonidos.lote) window.ventoSonidos.lote(f); else f();
      try{ typeof renderMesas === 'function' && renderMesas(); }catch(e){}
    }
    const txt = (r.added || []).map(a => modo === 'add' ? (a.qty > 1 ? a.qty + ' ' : '') + a.name : a.name + (a.qty ? ' en ' + a.qty : ' quitado')).join(', ');
    responder(((txt ? txt + (modo === 'add' ? ' a ' : ' en ') + mesaNombre(id) + '.' : '') + ((faltan || []).length ? ' ' + noEncontre(faltan) : '') + ((r.notFound || []).length && modo !== 'add' ? ' No estaba en ' + mesaNombre(id) + ': ' + r.notFound.join(', ') + '.' : '')).trim() || 'No cambié nada.', { icono: '✅ ' });
  }

  // 💵 Cobro por voz: arma el pago, lo muestra y SOLO se registra al confirmar (botón o «sí, confirmo»).
  function cobrarCon(R, mesaId){
    const p = P(); if(!p) return;
    if(p.puedeVender && !p.puedeVender()){ responder('Para vender, renueva tu suscripción.', { icono: '🔒 ' }); return; }
    const total = mesaId != null ? saldoMesa(mesaId) : resumen().total;
    if(!(total > 0)) return responder(mesaId != null ? mesaNombre(mesaId) + ' no tiene saldo.' : 'La venta está vacía.');
    if(!R.metodo){
      return preguntar('metodo', 'Total ' + pesosVoz(total) + '. ¿Cómo paga: efectivo, Nequi, DaviPlata o tarjeta?',
        [['efectivo', '💵 Efectivo'], ['nequi', '💜 Nequi'], ['daviplata', '🔴 DaviPlata'], ['tarjeta', '💳 Tarjeta']].map(x => ({ id: x[0], txt: x[1] })),
        resp => {
          const r2 = typeof resp === 'object' ? { metodo: resp.id } : interpretar(resp, { total });
          if(r2.pagos){ cobrarCon(Object.assign({}, R, { metodo: 'mixto', pagos: r2.pagos }), mesaId); return true; }
          if(!r2.metodo) return false;
          cobrarCon(Object.assign({}, R, { metodo: r2.metodo, monto: r2.monto || R.monto }), mesaId); return true;
        });
    }
    let pago, resumenTxt, voz;
    if(R.metodo === 'mixto'){
      const ps = (R.pagos || []).slice(0, 4), sinMonto = ps.filter(x => x.monto == null);
      if(sinMonto.length > 1) return responder('Dime cuánto va por cada medio de pago, por ejemplo: veinte mil en efectivo y el resto por Nequi.');
      const conocido = ps.reduce((s, x) => s + (x.monto || 0), 0);
      ps.forEach(x => { if(x.monto == null) x.monto = Math.max(0, total - conocido); });
      const digital = ps.filter(x => x.metodo !== 'efectivo').reduce((s, x) => s + x.monto, 0), suma = ps.reduce((s, x) => s + x.monto, 0);
      if(digital > total) return responder('Lo de Nequi, tarjeta o transferencia pasa del total de ' + pesosVoz(total) + '. Las vueltas solo salen del efectivo.');
      if(suma < total) return responder('Con eso faltan ' + pesosVoz(total - suma) + '. Dime el pago completo.');
      const ef = Math.max(0, total - digital), vueltas = suma - total, recEf = (ps.find(x => x.metodo === 'efectivo') || { monto: 0 }).monto;
      const pagos = ps.map(x => ({ method: x.metodo === 'efectivo' ? 'efectivo' : 'transferencia', amount: x.metodo === 'efectivo' ? ef : x.monto, note: NOMBRE_METODO[x.metodo] })).filter(x => x.amount > 0);
      pago = { method: pagos[0] ? pagos[0].method : 'efectivo', nota: 'Pago mixto', metodo: 'mixto', pagos, vueltas, recibido: recEf };
      resumenTxt = 'Pago mixto: ' + ps.map(x => NOMBRE_METODO[x.metodo] + ' ' + plata(x.monto)).join(' + ') + (vueltas ? ' · Vueltas ' + plata(vueltas) : '');
      voz = 'Total ' + pesosVoz(total) + ', pago mixto: ' + ps.map(x => NOMBRE_METODO[x.metodo] + ' ' + pesosVoz(x.monto)).join(' y ') + (vueltas ? '. Devuelve ' + pesosVoz(vueltas) : '') + '. ¿Confirmo?';
    } else if(R.metodo === 'efectivo'){
      const rec = R.monto || (mesaId == null ? S.recibido : 0) || total;
      const c = p.cambio(total, rec);
      if(c.estado === 'falta'){
        return preguntar('monto', 'Con ' + pesosVoz(rec) + ' faltan ' + pesosVoz(c.falta) + '. ¿Con cuánto paga?', [], resp => { const m = typeof resp === 'number' ? resp : interpretar('con ' + resp, { total }).monto; if(!m) return false; cobrarCon(Object.assign({}, R, { monto: m }), mesaId); return true; });
      }
      pago = { method: 'efectivo', nota: 'Efectivo', metodo: 'efectivo', recibido: c.recibido, vueltas: c.vueltas };
      resumenTxt = 'Efectivo · Recibe ' + plata(c.recibido) + (c.vueltas ? ' · Vueltas ' + plata(c.vueltas) : ' · Exacto');
      voz = 'Total ' + pesosVoz(total) + ' en efectivo' + (c.vueltas ? '. Recibe ' + pesosVoz(c.recibido) + ', devuelve ' + pesosVoz(c.vueltas) : '') + '. ¿Confirmo la venta?';
    } else {
      pago = { method: 'transferencia', nota: NOMBRE_METODO[R.metodo] || 'Transferencia', metodo: R.metodo, vueltas: 0 };
      resumenTxt = NOMBRE_METODO[R.metodo] || 'Transferencia';
      voz = 'Total ' + pesosVoz(total) + ' por ' + resumenTxt + '. ¿Confirmo la venta?';
    }
    const quien = mesaId != null ? mesaNombre(mesaId) : 'la venta';
    pedirConfirmacion('financiera', '💵 Cobrar ' + plata(total) + ' de ' + quien + ' · ' + resumenTxt, async () => {
      if(S.ocupado) return;
      // Lo que se va a cobrar no cambió mientras se confirmaba (otro equipo, un toque…): si cambió, se vuelve a preguntar.
      const ahora = mesaId != null ? saldoMesa(mesaId) : resumen().total;
      if(Math.round(ahora) !== Math.round(total)){ responder('El total cambió a ' + pesosVoz(ahora) + '. Vuelve a pedir el cobro.', { icono: '⚠️ ' }); return; }
      S.ocupado = true; pintar();
      let entry = null;
      try{ entry = mesaId != null ? await p.cobrarMesa(mesaId, { pago }) : await p.cobrar({ pago }); }
      catch(e){ console.error('caja voz cobro', e); }
      finally{ S.ocupado = false; }
      if(entry){ S.recibido = 0; S.ultimo = []; responder('Venta registrada: ' + pesosVoz(entry.total) + (pago.vueltas ? '. Devuelve ' + pesosVoz(pago.vueltas) : '') + '.', { icono: '✅ ', ms: 6000 }); }
      else responder('No se registró la venta. Revisa la caja.', { icono: '⚠️ ' });
    }, voz);
  }

  // Procesa una frase (de la voz o escrita). Devuelve la orden interpretada.
  let ultimaFrase = '', ultimaT = 0;
  function procesar(texto, o){
    o = o || {};
    texto = String(texto || '').trim();
    if(!texto) return null;
    // La misma frase dos veces seguidas (el dictado de algunos celulares la repite): una sola vez.
    const n = normalizar(texto), ahora = Date.now();
    if(n === ultimaFrase && ahora - ultimaT < 1500) return { intent: 'duplicado' };
    ultimaFrase = n; ultimaT = ahora;
    S.oido = texto;
    if(S.confirmar && Date.now() > S.confirmar.hasta) S.confirmar = null;
    if(S.pregunta && Date.now() > S.pregunta.hasta) S.pregunta = null;
    const R = interpretar(texto, { total: S.confirmar ? 0 : resumen().total, protegidos: protegidos() });
    // ¿Responde a la pregunta pendiente? (si no es una orden nueva, se usa como respuesta)
    if(S.pregunta && R.intent !== 'cancelar'){
      const q = S.pregunta, nueva = !['desconocido', 'agregar', 'confirmar'].includes(R.intent) && !(q.tipo === 'metodo' && R.intent === 'cobrar') && !(q.tipo === 'monto' && R.intent === 'recibido') && !(q.tipo === 'mesa' && R.intent === 'mesa_abrir');
      if(!nueva){
        S.pregunta = null;
        const arg = q.tipo === 'monto' && R.monto ? R.monto : q.tipo === 'mesa' && R.mesa ? R.mesa : texto;
        if(q.seguir(arg) !== false){ anotar(texto, R, 'respuesta'); estado('entendido'); return R; }
        S.pregunta = q; responder('No entendí. ' + q.texto, { icono: '❓ ' }); estado('no_entendido'); return R;
      }
      S.pregunta = null;
    }
    // Con una confirmación pendiente solo valen «sí», «no» u otra orden (que la reemplaza).
    if(S.confirmar && R.intent !== 'confirmar' && R.intent !== 'cancelar') S.confirmar = null;
    // Lo que no es de la caja sigue con los comandos de voz de siempre (libreta, calculadora, rondas de mesa, Laya…).
    const resoluble = it => { const r = resolver(it.texto); return !!(r.producto || r.candidatos.length); };
    const delegar = R.intent === 'desconocido' || (R.intent === 'repetir' && R.mesaDicha) ||
      (o.desdeFab && /^mesa_/.test(R.intent) && R.intent !== 'mesa_cobrar') || (R.intent === 'agregar' && !R.items.some(resoluble));
    if(delegar){
      anotar(texto, R, 'delegado');
      if(o.desdeFab) return { intent: 'desconocido' };
      estado('apagado'); try{ origFab(texto); }catch(e){} return R;
    }
    const fn = ACCIONES[R.intent];
    if(!fn){
      anotar(texto, R, 'no_entendido');
      estado('no_entendido');
      responder('No entendí «' + texto + '». Di por ejemplo: dos águilas, ¿cuánto es?, cobrar en efectivo.', { icono: '🤔 ' });
      return R;
    }
    estado('entendido');
    try{ fn(R); }catch(e){ console.error('caja voz', e); responder('No pude hacer eso. Intenta de nuevo.'); }
    anotar(texto, R, 'ok');
    pintar();
    return R;
  }
  function anotar(texto, R, res){ registro.push({ t: Date.now(), texto, intent: R.intent, resultado: res }); if(registro.length > 50) registro.shift(); }
  // Botones de la pregunta / confirmación.
  function elegirOpcion(id){
    const q = S.pregunta; if(!q) return;
    const op = q.opciones.find(x => String(x.id) === String(id)); if(!op) return;
    S.pregunta = null;
    const prod = productos().find(p => String(p.id) === String(id));
    if(q.tipo === 'producto' && prod) q.seguir(prod); else q.seguir({ id: op.id });
    pintar();
  }

  // ======================================================================
  // 4. RECONOCEDORES DE VOZ (adaptadores intercambiables)
  // ======================================================================
  /* 🔒 1.69.0: reconocedor EN ESTE EQUIPO (Vosk en WebAssembly): la voz no sale del equipo y funciona sin internet
     (también en Windows y Mac, donde el dictado del navegador no sirve). Se activa en ⚙️; la primera vez descarga el
     modelo en español (~34 MB, se guarda en el navegador). Se le pasa la lista de palabras del negocio (productos y
     órdenes) para que entienda mejor. Si algo falla, ORDEVA vuelve al dictado de siempre o a la orden escrita. */
  const VOSK_JS = 'https://cdn.jsdelivr.net/npm/vosk-browser@0.0.8/dist/vosk.js';
  const VOSK_MODELO = 'https://ccoreilly.github.io/vosk-browser/models/vosk-model-small-es-0.3.tar.gz';
  let voskModelo = null, voskCargando = null;
  function cargarVosk(){
    if(voskModelo) return Promise.resolve(voskModelo);
    if(voskCargando) return voskCargando;
    voskCargando = new Promise((ok, no) => {
      const listo = () => window.Vosk.createModel(window.__ventoVoskModelo || VOSK_MODELO).then(m => { voskModelo = m; ok(m); }, no);
      if(window.Vosk) return listo();
      const sc = document.createElement('script'); sc.src = window.__ventoVoskJs || VOSK_JS; sc.async = true;
      sc.onload = () => window.Vosk ? listo() : no(new Error('vosk')); sc.onerror = () => no(new Error('vosk'));
      document.head.appendChild(sc);
    }).catch(e => { voskCargando = null; throw e; });
    return voskCargando;
  }
  // Las palabras que puede oír: las órdenes de la caja, números y los nombres de los productos del negocio.
  const PALABRAS_BASE = ('agrega pon dame quita saca cambia que sean deja cobrar cobra en por con efectivo nequi daviplata tarjeta transferencia cuanto cuánto es vale cuesta quedan hay ' +
    'devuelvo vueltas paga me mil pesos lucas billete y una un uno dos tres cuatro cinco seis siete ocho nueve diez once doce quince veinte treinta cuarenta cincuenta sesenta setenta ochenta noventa cien ' +
    'ciento doscientos trescientos quinientos medio media kilo kilos libra libras gramos de la el las los lo último ultimo vacía vacia venta sí si no confirmo confirma cancela mesa total qué que llevo ' +
    'descuento pendiente nota repite otra igual ayuda abre debe').split(' ');
  function gramatica(){
    const w = new Set(PALABRAS_BASE);
    productos().forEach(p => String(p.name || '').toLowerCase().split(/[^a-záéíóúñü0-9]+/).forEach(x => { if(x && x.length > 1){ w.add(x); w.add(x.normalize('NFD').replace(/[\u0300-\u036f]/g, '')); if(!/s$/.test(x)) w.add(x + 's'); } }));
    return JSON.stringify([...w].concat(['[unk]']));
  }
  const motores = {
    local: {
      nombre: () => 'el reconocedor de voz de ORDEVA en este equipo (la voz no sale del equipo)',
      local: true,
      disponible: () => !!cfg().local && typeof WebAssembly === 'object' && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) && !!(window.AudioContext || window.webkitAudioContext),
      crear(h){
        let st = null, ctx = null, pr = null, rec = null, vivo = true, finales = [], parcial = '', terminado = false;
        const cerrar = () => { try{ pr && pr.disconnect(); }catch(e){} try{ st && st.getTracks().forEach(t => t.stop()); }catch(e){} try{ ctx && ctx.close(); }catch(e){} try{ rec && rec.remove(); }catch(e){} };
        const terminar = () => { if(terminado) return; terminado = true; vivo = false; cerrar(); h.fin((finales.join(' ').trim() || parcial).trim()); };
        return {
          iniciar(){
            if(!voskModelo) estado('procesando');
            if(!voskModelo) responder('Preparando el reconocedor en este equipo (la primera vez descarga ~34 MB)…', { icono: '⏳ ', toast: true, ms: 8000 });
            cargarVosk().then(m => {
              if(!vivo) return;
              return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } }).then(stream => {
                if(!vivo){ stream.getTracks().forEach(t => t.stop()); return; }
                st = stream; const AC = window.AudioContext || window.webkitAudioContext; ctx = new AC();
                rec = new m.KaldiRecognizer(ctx.sampleRate, gramatica());
                // Vosk detecta solo el final de la frase: esa frase es la orden (como soltar el botón).
                rec.on('result', x => { const t = (x && x.result && x.result.text || '').replace(/\[unk\]/g, '').replace(/\s+/g, ' ').trim(); if(t && vivo){ finales.push(t); parcial = ''; h.oyendo(finales.join(' '), true); setTimeout(terminar, 30); } });
                rec.on('partialresult', x => { const t = x && x.result && x.result.partial; if(t){ parcial = t.replace(/\[unk\]/g, '').trim(); if(parcial) h.oyendo((finales.join(' ') + ' ' + parcial).trim(), false); } });
                const src = ctx.createMediaStreamSource(stream); pr = ctx.createScriptProcessor(4096, 1, 1);
                pr.onaudioprocess = e => { if(vivo) try{ rec.acceptWaveform(e.inputBuffer); }catch(x){} };
                src.connect(pr); pr.connect(ctx.destination);
                h.inicio();
              });
            }).catch(e => {
              if(!vivo) return;
              const n = e && e.name;
              h.error(n === 'NotAllowedError' || n === 'SecurityError' ? 'not-allowed' : n === 'NotFoundError' ? 'audio-capture' : 'network');
              terminar();
            });
          },
          parar(){ if(!vivo) return; try{ rec && rec.retrieveFinalResult(); }catch(e){} setTimeout(terminar, 450); },
          abortar(){ finales = []; parcial = ''; terminar(); }
        };
      }
    },
    navegador: {
      nombre: () => window.VentoAndroid ? 'el reconocedor de voz del teléfono' : 'el dictado del navegador',
      disponible: () => !!(window.SpeechRecognition || window.webkitSpeechRecognition),
      crear(h){
        const C = window.SpeechRecognition || window.webkitSpeechRecognition;
        const r = new C();
        r.lang = 'es-CO'; r.continuous = true; r.interimResults = true; r.maxAlternatives = 3; r.mantener = true;
        let finales = [], parcial = '';
        r.onstart = () => h.inicio();
        r.onresult = e => {
          finales = []; parcial = '';
          for(let i = 0; i < e.results.length; i++){ const x = e.results[i], t = (x[0] && x[0].transcript || '').trim(); if(!t) continue; if(x.isFinal){ if(finales[finales.length - 1] !== t) finales.push(t); } else parcial = t; }
          h.oyendo((finales.join(' ') + ' ' + parcial).trim(), !parcial);
        };
        r.onerror = e => h.error(e && e.error || 'error');
        r.onend = () => h.fin((finales.join(' ').trim() || parcial).trim());
        return { iniciar: () => r.start(), parar: () => { try{ r.stop(); }catch(e){} }, abortar: () => { try{ r.abort(); }catch(e){} } };
      }
    }
  };
  let motorActual = null, sesion = null, silencioT = null, tocado = 0, apretado = false;
  function registrarMotor(nombre, m){ if(nombre && m && typeof m.crear === 'function') motores[nombre] = m; }
  const elegirMotor = () => Object.keys(motores).map(k => motores[k]).find(m => { try{ return m.disponible(); }catch(e){ return false; } }) || null;
  const micOcupado = () => { try{ return (typeof voiceListening !== 'undefined' && voiceListening) || (typeof voiceProductListening !== 'undefined' && voiceProductListening); }catch(e){ return false; } };
  function estado(e){ S.estado = e; pintar(); }

  function escuchar(){
    if(sesion) return;
    if(!vozPermitida()) return;                                   // la suscripción no incluye «Pedidos por voz»
    if(micApagado()){ responder('El micrófono está apagado en Ajustes. Puedes escribir la orden.', { icono: '⌨️ ' }); abrirEscrito(); return; }
    const m = elegirMotor();
    if(!m){ estado('no_disponible'); responder('Este equipo no tiene dictado por voz. Escribe la orden en el cuadro ⌨️.', { icono: '⌨️ ' }); abrirEscrito(); return; }
    if(micOcupado()){ responder('El micrófono ya está en uso. Termina esa orden primero.'); return; }
    if(!cfg().privacidad && !m.local){ avisoPrivacidad(m, () => escuchar()); return; }   // con el reconocedor local la voz no sale del equipo
    try{ window.speechSynthesis && (speechSynthesis.speaking || speechSynthesis.pending) && speechSynthesis.cancel(); }catch(e){}
    try{ window.ventoHola && window.ventoHola.soltar(true); }catch(e){}
    motorActual = m;
    let s = null;
    const h = {
      inicio(){ if(sesion !== s) return; estado('escuchando'); },
      oyendo(t, final){ if(sesion !== s) return; S.oido = t; pintar(); clearTimeout(silencioT); silencioT = setTimeout(() => parar(), final ? 1200 : 2200); },
      error(code){
        if(sesion !== s) return;
        s.err = code;
        if(code === 'not-allowed' || code === 'service-not-allowed' || code === 'audio-capture'){ estado('sin_permiso'); responder(code === 'audio-capture' ? 'No encontré un micrófono en este equipo. Puedes escribir la orden.' : 'No hay permiso para el micrófono. Dale permiso en el navegador o el teléfono, o escribe la orden.', { icono: '🚫 ', ms: 7000 }); }
        else if(code === 'network'){ estado('sin_red'); responder((m.local ? 'No se pudo preparar el reconocedor de este equipo (hace falta internet la primera vez para descargarlo).' : 'Sin internet el dictado no funciona en este equipo.') + ' Escribe la orden: ORDEVA la entiende sin internet.' + (!cfg().local ? ' O activa en ⚙️ «Reconocer la voz en este equipo».' : ''), { icono: '📡 ', ms: 7000 }); abrirEscrito(); }
        else if(code === 'no-speech'){ S.vacios++; estado('no_entendido'); if(!cfg().manos) responder('No escuché nada. Toca el micrófono y habla.', { icono: '🎤 ' }); }
      },
      fin(t){
        if(sesion !== s) return;
        clearTimeout(silencioT); sesion = null; window.__ventoEscuchando = false;
        if(t){ S.vacios = 0; estado('procesando'); procesar(t); }
        else if(S.estado === 'escuchando') estado('apagado');
        if(cfg().manos && cajaRoot() && S.vacios < 3 && !['sin_permiso', 'sin_red', 'no_disponible'].includes(S.estado)) seguirManos();
        else if(S.estado === 'escuchando' || S.estado === 'procesando') estado('apagado');
      }
    };
    try{
      s = sesion = m.crear(h);
      window.__ventoEscuchando = true;
      S.oido = ''; estado('escuchando');
      s.iniciar();
      clearTimeout(silencioT); silencioT = setTimeout(() => parar(), 8000);
    }catch(e){ sesion = null; window.__ventoEscuchando = false; estado('sin_permiso'); responder('No se pudo abrir el micrófono. Escribe la orden.', { icono: '🚫 ' }); }
  }
  function parar(){ clearTimeout(silencioT); if(sesion) sesion.parar(); }
  function apagar(){ clearTimeout(silencioT); clearTimeout(manosT); const s = sesion; sesion = null; window.__ventoEscuchando = false; if(s) s.abortar(); if(['escuchando', 'procesando'].includes(S.estado)) estado('apagado'); }
  let manosT = null;
  // Manos libres (solo si se autorizó en ⚙️): vuelve a escuchar cuando ORDEVA termina de hablar.
  function seguirManos(){
    clearTimeout(manosT);
    const espera = () => { let h = false; try{ h = window.speechSynthesis && (speechSynthesis.speaking || speechSynthesis.pending); }catch(e){} if(h) { manosT = setTimeout(espera, 250); return; } if(cfg().manos && cajaRoot() && !sesion) escuchar(); };
    manosT = setTimeout(espera, 500);
  }
  function avisoPrivacidad(m, seguir){
    const ov = document.createElement('div');
    ov.className = 'overlay show cv-priv-ov'; ov.setAttribute('data-novocab', '');
    ov.innerHTML = '<div class="modal cv-priv" role="dialog" aria-modal="true" aria-label="Micrófono de la caja"><h2>🎙️ Vender con la voz</h2>' +
      '<p>ORDEVA <b>no graba ni guarda audio</b>. La frase se convierte en texto con ' + esc(m.nombre()) + ' y ese texto se interpreta aquí, en este equipo.</p>' +
      '<p class="cv-nota">' + (window.VentoAndroid ? 'En el teléfono el reconocedor de Android puede usar los servicios de Google para convertir la voz en texto (según el teléfono, también sin internet).' : 'En Chrome y Edge el dictado puede enviar el audio a los servidores de Google o Microsoft para convertirlo en texto, y necesita internet.') +
      ' Si prefieres, escribe la orden en el cuadro ⌨️: funciona igual y sin internet.</p>' +
      '<div class="modal-actions"><button type="button" class="btn-close" data-no>Prefiero escribir</button><button type="button" class="btn-primary" data-si>Entendido, usar el micrófono</button></div></div>';
    document.body.appendChild(ov);
    const fin = () => ov.remove(); ov._fin = fin;
    ov.addEventListener('click', e => {
      if(e.target.closest('[data-si]')){ fin(); ponerCfg({ privacidad: true }); seguir(); }
      else if(e.target.closest('[data-no]') || e.target === ov){ fin(); abrirEscrito(); }
    });
  }

  // ======================================================================
  // 5. INTERFAZ EN LA CAJA (micrófono, transcripción, preguntas, confirmación, ⌨️, ⚙️)
  // ======================================================================
  const ESTADOS = {
    apagado: ['🎤', 'Toca o mantén para hablar'], escuchando: ['🔴', 'Escuchando…'], procesando: ['⏳', 'Procesando…'],
    entendido: ['✅', 'Entendido'], no_entendido: ['🤔', 'No entendí'], sin_permiso: ['🚫', 'Sin permiso de micrófono'],
    sin_red: ['📡', 'Sin internet: escribe la orden'], no_disponible: ['⌨️', 'Sin dictado: escribe la orden']
  };
  const cajaRoot = () => { try{ return P() && P().cajaActiva ? P().cajaActiva() : null; }catch(e){ return null; } };
  const raices = new Set();
  function montar(root, opt){
    if(!root || (opt && opt.variante === 'grande')) return;
    const pz = root.querySelector('.pz'); if(!pz || root.querySelector('.cv-barra')) { raices.add(root); pintar(); return; }
    const bus = root.querySelector('.pz-buscar');
    if(bus && !bus.querySelector('.cv-mic')){
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'cv-mic'; b.setAttribute('aria-label', 'Micrófono de la caja (F8): toca para hablar o mantén presionado'); b.title = 'Micrófono (F8) · toca o mantén presionado';
      b.innerHTML = '<span class="cv-mic-i">🎤</span>';
      bus.appendChild(b);
      b.addEventListener('pointerdown', e => { if(e.button > 0) return; e.preventDefault(); tocado = Date.now(); apretado = true; if(sesion){ apretado = false; parar(); return; } escuchar(); });
      const soltar = () => { if(!apretado) return; apretado = false; if(Date.now() - tocado > 450 && sesion) parar(); };   // mantener presionado = hablar mientras se mantiene
      b.addEventListener('pointerup', soltar); b.addEventListener('pointercancel', soltar); b.addEventListener('pointerleave', soltar);
      b.addEventListener('keydown', e => { if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); sesion ? parar() : escuchar(); } });
    }
    const barra = document.createElement('div');
    barra.className = 'cv-barra'; barra.setAttribute('aria-live', 'polite');
    barra.innerHTML = '<div class="cv-fila"><span class="cv-est"></span><span class="cv-oido"></span><button type="button" class="cv-btn" data-cv="escribir" title="Escribir la orden">⌨️</button><button type="button" class="cv-btn" data-cv="cfg" title="Voz y sonidos" aria-label="Voz y sonidos">⚙️</button><button type="button" class="cv-btn" data-cv="ayuda" title="Qué puedo decir y atajos" aria-label="Ayuda de voz y atajos">?</button></div>' +
      '<form class="cv-escrito" hidden><input type="text" class="cv-in" maxlength="160" placeholder="Escribe: 2 águilas · cuánto es · paga con 50 mil · cobrar en efectivo" autocomplete="off" enterkeyhint="send" aria-label="Orden escrita"><button type="submit" class="cv-btn cv-go">↵</button></form>' +
      '<div class="cv-resp"></div><div class="cv-preg"></div>';
    const grid = pz.querySelector('.pz-grid');
    (pz.querySelector('.pz-cats') || grid).insertAdjacentElement('beforebegin', barra);
    const at = document.createElement('div');
    at.className = 'cv-atajos'; at.innerHTML = '<span><kbd>F1</kbd> Buscar</span><span><kbd>F2</kbd> Cobrar</span><span><kbd>F3</kbd> Cliente</span><span><kbd>F4</kbd> Pendiente</span><span><kbd>F5</kbd> Limpiar</span><span><kbd>F6</kbd> Efectivo</span><span><kbd>F7</kbd> Transferencia</span><span><kbd>F8</kbd> Micrófono</span><span><kbd>F9</kbd> Total</span>';
    const pie = root.querySelector('.pz-pie'); if(pie) pie.insertAdjacentElement('afterend', at);
    const conf = document.createElement('div'); conf.className = 'cv-conf'; conf.hidden = true;
    if(pie) pie.insertAdjacentElement('beforebegin', conf);
    if(!root._cvClic) root.addEventListener('click', e => {
      const b = e.target.closest('[data-cv]'); if(!b || !root.contains(b)) return;
      const k = b.dataset.cv;
      if(k === 'escribir'){ abrirEscrito(root); return; }
      if(k === 'cfg'){ abrirCfg(); return; }
      if(k === 'ayuda'){ abrirAyuda(); return; }
      if(k === 'si'){ procesarAccion('confirmar'); return; }
      if(k === 'no'){ procesarAccion('cancelar'); return; }
      if(k === 'op'){ elegirOpcion(b.dataset.id); return; }
    });
    root._cvClic = true;
    barra.querySelector('.cv-escrito').addEventListener('submit', e => { e.preventDefault(); const i = barra.querySelector('.cv-in'), v = i.value.trim(); if(!v) return; i.value = ''; estado('procesando'); procesar(v); });
    raices.add(root);
    pintar();
  }
  function procesarAccion(a){ ultimaFrase = ''; ACCIONES[a](); pintar(); }
  function abrirEscrito(root){
    root = root || cajaRoot() || [...raices][0]; if(!root) return;
    const f = root.querySelector('.cv-escrito'); if(!f) return;
    f.hidden = false; const i = f.querySelector('.cv-in'); try{ i.focus(); }catch(e){}
  }
  function pintar(){
    raices.forEach(root => {
      if(!root.isConnected){ raices.delete(root); return; }
      const e = ESTADOS[S.estado] || ESTADOS.apagado;
      root.querySelectorAll('.cv-mic').forEach(b => { b.dataset.estado = S.estado; b.classList.toggle('on', S.estado === 'escuchando'); b.querySelector('.cv-mic-i').textContent = S.estado === 'escuchando' ? '⏹' : '🎤'; });
      const est = root.querySelector('.cv-est'); if(!est) return;
      est.textContent = e[0] + ' ' + e[1] + (cfg().manos ? ' · manos libres' : ''); est.dataset.estado = S.estado;
      root.querySelector('.cv-oido').textContent = S.oido ? '«' + S.oido + '»' : '';
      root.querySelector('.cv-resp').textContent = S.respuesta || '';
      const pq = root.querySelector('.cv-preg'), q = S.pregunta;
      pq.innerHTML = q ? '<b>❓ ' + esc(q.texto) + '</b>' + (q.opciones.length ? '<div class="cv-ops">' + q.opciones.map(o => '<button type="button" data-cv="op" data-id="' + esc(o.id) + '">' + esc(o.txt) + '</button>').join('') + '</div>' : '') + '<button type="button" class="cv-x" data-cv="no">✕ Cancelar</button>' : '';
      const cf = root.querySelector('.cv-conf'), c = S.confirmar;
      if(cf){
        cf.hidden = !c;
        cf.className = 'cv-conf' + (c ? ' cv-' + c.nivel : '');
        cf.innerHTML = c ? '<div class="cv-conf-t">' + esc(c.texto) + '</div><div class="cv-conf-b"><button type="button" class="cv-no" data-cv="no">✕ Cancelar</button><button type="button" class="cv-si" data-cv="si"' + (S.ocupado ? ' disabled' : '') + '>✅ ' + (c.nivel === 'financiera' ? 'Confirmar venta' : 'Sí, confirmar') + '</button></div><small>' + (c.nivel === 'financiera' ? 'Di «sí, confirmo» o toca el botón. Nada se cobra sin confirmar.' : 'Di «sí» o «no».') + '</small>' : '';
      }
    });
  }
  function abrirCfg(){
    const c = cfg(), sn = (window.ventoSonidos && window.ventoSonidos.cfg) ? window.ventoSonidos.cfg() : null;
    const ov = document.createElement('div');
    ov.className = 'overlay show cv-priv-ov'; ov.setAttribute('data-novocab', '');
    ov.innerHTML = '<div class="modal cv-priv" role="dialog" aria-modal="true" aria-label="Voz y sonidos de la caja"><h2>⚙️ Voz y sonidos de la caja</h2>' +
      '<label class="cv-op"><input type="checkbox" data-k="responder"' + (c.responder ? ' checked' : '') + '> 🔊 Responder en voz alta</label>' +
      '<label class="cv-op">Volumen de la voz <input type="range" min="0.2" max="1" step="0.1" data-k="volumen" value="' + c.volumen + '"></label>' +
      (sn ? '<label class="cv-op"><input type="checkbox" data-k="sonidos"' + (sn.on ? ' checked' : '') + '> 🔔 Sonidos discretos al agregar y cobrar</label>' : '') +
      '<label class="cv-op"><input type="checkbox" data-k="local"' + (c.local ? ' checked' : '') + '> 🔒 Reconocer la voz en este equipo (sin internet; la voz no sale del equipo). La primera vez descarga ~34 MB.</label>' +
      '<label class="cv-op"><input type="checkbox" data-k="manos"' + (c.manos ? ' checked' : '') + '> 🙌 Manos libres: el micrófono vuelve a escuchar después de cada orden (solo con la caja abierta)</label>' +
      '<p class="cv-nota">Manos libres deja el micrófono abierto mientras la caja está en pantalla. Úsalo solo si quieres: se apaga al cerrar la caja, con F8, o tras 3 silencios seguidos.</p>' +
      '<div class="modal-actions"><button type="button" class="btn-primary" data-ok>Listo</button></div></div>';
    document.body.appendChild(ov);
    const fin = () => ov.remove(); ov._fin = fin;
    ov.addEventListener('change', e => {
      const i = e.target, k = i.dataset.k; if(!k) return;
      if(k === 'sonidos'){ try{ window.ventoSonidos.guardar ? window.ventoSonidos.guardar({ on: i.checked }) : null; }catch(x){} return; }
      ponerCfg({ [k]: i.type === 'checkbox' ? i.checked : Number(i.value) });
      if(k === 'local' && i.checked){ aviso('⏳ Descargando el reconocedor de voz en español (~34 MB, solo la primera vez)…', 6000); cargarVosk().then(() => aviso('🔒 Listo: la voz se reconoce en este equipo, sin internet.', 6000), () => aviso('⚠️ No se pudo descargar el reconocedor. Revisa el internet e inténtalo otra vez.', 7000)); }
      if(k === 'manos' && !i.checked) apagar();
    });
    ov.addEventListener('click', e => { if(e.target === ov || e.target.closest('[data-ok]')) fin(); });
  }
  function abrirAyuda(){
    const ov = document.createElement('div');
    ov.className = 'overlay show cv-priv-ov'; ov.setAttribute('data-novocab', '');
    ov.innerHTML = '<div class="modal cv-priv cv-ayuda" role="dialog" aria-modal="true" aria-label="Qué puedo decir"><h2>🎙️ Qué puedo decir</h2><ul>' +
      ['«dos águilas y una póker» · «agrega tres empanadas»', '«quita una póker» · «quita las águilas» · «quita lo último»', '«que sean tres águilas» · «cambia la póker a 2»',
       '«¿cuánto es?» · «¿qué llevo?» · «¿cuánto vale la Coca-Cola?» · «¿cuántas águilas quedan?»', '«me paga con cincuenta mil» · «¿cuánto devuelvo?»',
       '«cobrar en efectivo» · «por Nequi» · «veinte mil en efectivo y el resto por Nequi» → luego «sí, confirmo»', '«vacía la venta» (pide confirmar) · «deja la venta pendiente» · «repite la última venta»',
       '«mesa 3 dos águilas» · «¿cuánto debe la mesa 4?» · «abre la mesa 5» · «cobra la mesa 2 en efectivo»', '«descuento» abre la ventana de siempre (pide la clave del dueño al equipo)']
        .map(x => '<li>' + esc(x) + '</li>').join('') + '</ul><h2>⌨️ Atajos de teclado</h2><div class="cv-atajos cv-at-full"><span><kbd>F1</kbd> Buscar</span><span><kbd>F2</kbd> Cobrar</span><span><kbd>F3</kbd> Cliente</span><span><kbd>F4</kbd> Pendiente</span><span><kbd>F5</kbd> Limpiar</span><span><kbd>F6</kbd> Efectivo</span><span><kbd>F7</kbd> Transferencia</span><span><kbd>F8</kbd> Micrófono</span><span><kbd>F9</kbd> Total</span><span><kbd>Esc</kbd> Cancelar</span></div>' +
      '<div class="modal-actions"><button type="button" class="btn-primary" data-ok>Listo</button></div></div>';
    document.body.appendChild(ov);
    const fin = () => ov.remove(); ov._fin = fin;
    ov.addEventListener('click', e => { if(e.target === ov || e.target.closest('[data-ok]')) fin(); });
  }

  // ======================================================================
  // 6. TECLADO
  // ======================================================================
  function pagoAbierto(){ return document.querySelector('.pz-pago-ov.show'); }
  function abrirCobro(foco){
    const root = cajaRoot(); if(!root) return;
    const b = root.querySelector('.pz-cobrar'); if(!b || b.disabled){ responder('La venta está vacía.'); return; }
    b.click();
    setTimeout(() => {
      const ov = pagoAbierto(); if(!ov) return;
      if(foco === 'efectivo'){ const i = ov.querySelector('#pzPagaCon'); if(i) try{ i.focus(); }catch(e){} }
      if(foco === 'transferencia'){ const n = ov.querySelector('.pz-met[data-m="nequi"]'); if(n) try{ n.focus(); }catch(e){} }
    }, 60);
  }
  function cliente(){
    const p = P(); if(!p) return;
    if(window.ventoDian && window.ventoDian.activo && window.ventoDian.activo()){
      const fe = !!((window.ventoDian.cfg && window.ventoDian.cfg()) || {}).fe_resolucion;
      window.ventoDian.pedirCliente(fe ? 'Factura electrónica a nombre de…' : 'Documento a nombre de…', fe).then(c => { if(c){ p.ponerCliente({ nombre: c.nombre, dian: c, fe }); aviso('👤 Cliente: ' + c.nombre); } });
      return;
    }
    p.herramienta('cliente');
  }
  document.addEventListener('keydown', e => {
    if(e.ctrlKey || e.altKey || e.metaKey) return;
    const k = e.key;
    const pago = pagoAbierto();
    // Enter seguro: con la ventana de pago recién abierta, un Enter (del lector o de la mano) no cobra.
    // (Si se escribió lo recibido en «¿Con cuánto paga?», ese Enter sí cobra: el valor se escribió a propósito.)
    if(pago && k === 'Enter'){ const t0 = Number(pago.dataset.abierto || 0), a = document.activeElement; if(t0 && Date.now() - t0 < 600 && !(a && a.id === 'pzPagaCon')){ e.preventDefault(); e.stopPropagation(); } return; }
    if(pago){
      if(k === 'F6'){ e.preventDefault(); const i = pago.querySelector('#pzPagaCon'); if(i && document.activeElement !== i){ try{ i.focus(); }catch(x){} } else { const ef = pago.querySelector('.pz-met[data-m="efectivo"]'); if(ef) ef.click(); } }
      else if(k === 'F7'){ e.preventDefault(); const n = pago.querySelector('.pz-met[data-m="nequi"]'); if(n) try{ n.focus(); }catch(x){} }
      return;
    }
    if(!/^F([1-9])$/.test(k) && k !== 'Escape') return;
    const root = cajaRoot(); if(!root) return;
    if(document.querySelector('.overlay.show:not(.pz-caja-ov)')) return;   // otra ventana encima (la suya maneja Esc)
    if(k === 'Escape'){
      if(S.confirmar || S.pregunta){ e.preventDefault(); procesarAccion('cancelar'); return; }
      if(sesion){ e.preventDefault(); apagar(); return; }
      const q = root.querySelector('.pz-q'); if(q && q.value){ e.preventDefault(); q.value = ''; q.dispatchEvent(new Event('input')); }
      return;
    }
    e.preventDefault(); e.stopPropagation();
    if(k === 'F1'){ const q = root.querySelector('.pz-q'); if(q){ try{ q.focus(); q.select(); }catch(x){} } }
    else if(k === 'F2') abrirCobro();
    else if(k === 'F3') cliente();
    else if(k === 'F4'){ if(resumen().lineas.length) P().herramienta('susp'); else if(P().pendientes().length) P().herramienta('pend'); }
    else if(k === 'F5'){ if(resumen().lineas.length) ACCIONES.vaciar(); }
    else if(k === 'F6') abrirCobro('efectivo');
    else if(k === 'F7') abrirCobro('transferencia');
    else if(k === 'F8'){ if(sesion) parar(); else escuchar(); }
    else if(k === 'F9') ACCIONES.total();
  }, true);

  // ======================================================================
  // 7. CONEXIÓN CON EL RESTO DE ORDEVA
  // ======================================================================
  // El micrófono flotante: con la caja en pantalla, primero entiende la caja (cobros, preguntas, vueltas…); lo que no
  // es de la caja sigue con los comandos de siempre.
  // Se engancha DENTRO del camino de siempre (voiceExtras), así siguen valiendo antes: el permiso «voice» de la
  // suscripción (app/12), «Primeros pasos» (app/22), la suscripción vencida, «ayuda», la calculadora…
  let delegando = false;
  const origFab = t => { delegando = true; try{ return window.handleVoiceTranscript(t); }finally{ setTimeout(() => { delegando = false; }, 0); } };
  function enganchar(){
    const o = window.voiceExtras;
    if(typeof o === 'function' && !o.__cajaVoz){
      const w = function(raw){
        if(!delegando && cajaRoot() && !window.__pedidoOrigen){
          const R = procesar(raw, { desdeFab: true });
          if(R && R.intent !== 'desconocido') return true;
        }
        return o.apply(this, arguments);
      };
      w.__cajaVoz = true; window.voiceExtras = w;
    }
  }
  const vozPermitida = () => {
    try{ if(typeof subAcceso === 'function' && !subAcceso('voice')){ try{ window.ventoSuscripcion.funcionPro('voice', 'Pedidos por voz'); }catch(e){} return false; } }catch(e){}
    return true;
  };
  const micApagado = () => { try{ return typeof micEnabled !== 'undefined' && !micEnabled; }catch(e){ return false; } };

  // ---------- Estilos (tokens de ORDEVA 2.0; sin dependencias) ----------
  function estilos(){
    if(document.getElementById('ventoCajaVozCss')) return;
    const st = document.createElement('style'); st.id = 'ventoCajaVozCss';
    st.textContent =
      '.pz .cv-mic{flex:none;width:52px;min-height:48px;border-radius:14px;border:1px solid var(--line);background:var(--surface);color:var(--ink);font-size:22px;cursor:pointer;touch-action:none;-webkit-user-select:none;user-select:none}' +
      '.pz .cv-mic.on{background:#dc2626;border-color:#dc2626;color:#fff;animation:cvPulso 1.2s ease-in-out infinite}' +
      '.pz .cv-mic[data-estado="sin_permiso"],.pz .cv-mic[data-estado="no_disponible"],.pz .cv-mic[data-estado="sin_red"]{opacity:.7;border-style:dashed}' +
      '@keyframes cvPulso{0%,100%{box-shadow:0 0 0 0 rgba(220,38,38,.45)}50%{box-shadow:0 0 0 8px rgba(220,38,38,0)}}' +
      '@media (prefers-reduced-motion:reduce){.pz .cv-mic.on{animation:none}}' +
      '.cv-barra{margin:0 0 10px;padding:8px 10px;border:1px solid var(--line);border-radius:14px;background:var(--surface);display:grid;gap:6px}' +
      '.cv-fila{display:flex;align-items:center;gap:8px;min-width:0}.cv-est{flex:none;font-size:13px;font-weight:700;color:var(--ink-soft)}' +
      '.cv-est[data-estado="escuchando"]{color:#dc2626}.cv-est[data-estado="entendido"]{color:#15803d}.cv-est[data-estado="sin_permiso"],.cv-est[data-estado="no_entendido"],.cv-est[data-estado="sin_red"]{color:#b45309}' +
      '.cv-oido{flex:1;min-width:0;font-size:14px;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-style:italic}' +
      '.cv-btn{flex:none;min-width:36px;min-height:36px;border-radius:10px;border:1px solid var(--line);background:transparent;color:var(--ink);font:inherit;font-size:15px;font-weight:700;cursor:pointer}' +
      '.cv-escrito{display:flex;gap:6px}.cv-escrito[hidden]{display:none}.cv-in{flex:1;min-width:0;font:inherit;font-size:15px;padding:8px 12px;min-height:40px;border-radius:10px;border:1px solid var(--line);background:var(--bg,transparent);color:var(--ink)}' +
      '.cv-resp{font-size:14px;font-weight:600;color:var(--ink)}.cv-resp:empty,.cv-preg:empty{display:none}' +
      '.cv-preg{display:grid;gap:6px;padding:8px;border-radius:10px;background:rgba(245,158,11,.12);font-size:14px}.cv-ops{display:flex;flex-wrap:wrap;gap:6px}' +
      '.cv-ops button,.cv-x{min-height:40px;padding:6px 12px;border-radius:10px;border:1px solid var(--line);background:var(--surface);color:var(--ink);font:inherit;font-size:14px;font-weight:700;cursor:pointer}.cv-x{justify-self:start;font-weight:600}' +
      '.cv-conf{margin:8px 0;padding:10px;border-radius:14px;border:2px solid #b45309;background:rgba(245,158,11,.12);display:grid;gap:8px}.cv-conf[hidden]{display:none}.cv-conf.cv-financiera{border-color:#15803d;background:rgba(21,128,61,.10)}' +
      '.cv-conf-t{font-weight:800;font-size:15px}.cv-conf-b{display:flex;gap:8px}.cv-conf-b button{flex:1;min-height:48px;border-radius:12px;font:inherit;font-weight:800;font-size:15px;cursor:pointer}' +
      '.cv-si{border:0;background:#15803d;color:#fff}.cv-si[disabled]{opacity:.5}.cv-no{border:1px solid var(--line);background:transparent;color:var(--ink)}.cv-conf small{color:var(--ink-soft)}' +
      '.cv-atajos{display:flex;flex-wrap:wrap;gap:4px 10px;margin-top:8px;font-size:11px;color:var(--ink-soft)}.cv-atajos kbd{font:inherit;font-weight:800;padding:0 4px;border:1px solid var(--line);border-radius:4px}' +
      '@media (hover:none),(max-width:760px){.pz-cart .cv-atajos{display:none}}' +
      '.cv-priv-ov{z-index:10060}' +
      '.cv-priv{max-width:520px}.cv-priv p{line-height:1.45}.cv-nota{font-size:13px;color:var(--ink-soft)}.cv-op{display:flex;gap:10px;align-items:center;padding:8px 2px;font-weight:600}.cv-op input[type=checkbox]{width:auto}' +
      '.cv-ayuda ul{padding-left:18px;display:grid;gap:6px;font-size:14px}.cv-at-full{font-size:13px}' +
      '@media (min-width:1280px){.pz-caja-ov .pz-tienda,body.o2 .pz-caja-ov .pz-tienda{grid-template-columns:minmax(0,3fr) minmax(380px,2fr)}}';
    document.head.appendChild(st);
  }
  function iniciar(){
    estilos(); enganchar();
    document.querySelectorAll('#posPanel, .pz-caja-root').forEach(r => { if(r._pz) montar(r, r._pz.opt); });
    // Al cerrar la caja se apaga el micrófono (manos libres no queda escuchando en otra pantalla).
    setInterval(() => { if(sesion && !cajaRoot() && !document.querySelector('.cv-priv-ov')) apagar(); }, 1500);
  }
  window.ventoCajaVoz = {
    motor, procesar, interpretar: (t, c) => interpretar(t, Object.assign({ total: resumen().total, protegidos: protegidos() }, c || {})),
    resolver: t => resolver(t), escuchar, parar, apagar, montar, registrarMotor, motores,
    estado: () => ({ estado: S.estado, oido: S.oido, respuesta: S.respuesta, pregunta: S.pregunta ? { tipo: S.pregunta.tipo, texto: S.pregunta.texto, opciones: S.pregunta.opciones } : null,
      confirmar: S.confirmar ? { nivel: S.confirmar.nivel, texto: S.confirmar.texto } : null, recibido: S.recibido, ocupado: S.ocupado }),
    confirmar: () => procesarAccion('confirmar'), cancelar: () => procesarAccion('cancelar'), elegir: elegirOpcion,
    cfg, ponerCfg, registro: () => registro.slice(), reiniciar(){ S.pregunta = null; S.confirmar = null; S.recibido = 0; S.ultimo = []; S.ultimaOrden = null; S.oido = ''; S.respuesta = ''; ultimaFrase = ''; apagar(); estado('apagado'); }
  };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
