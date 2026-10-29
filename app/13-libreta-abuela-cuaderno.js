/* ORDEVA · app/13-libreta-abuela-cuaderno.js — antes estaba dentro de index.html (línea 28835). Se carga en el mismo lugar y orden. */
/* ==================== 📒 Libreta de la abuela ====================
   Cuaderno de fiados y pagos a empleados, pensado para personas mayores: pantalla grande,
   tres botones y voz. La voz se entiende AQUÍ MISMO en el celular (sin IA ni internet), así
   que responde al instante: «Juan me debe 20 mil», «Juan me pagó 10 mil», «le pagué a Pedro
   50 lucas», «¿cuánto me debe Juan?», «¿quién me debe?», «borra lo último». */
(function(){
  const LB = () => { if(!data.libreta) data.libreta = { movs: [] }; return data.libreta; };
  let lbAbrirPersona = null;
  // Calculadora "de cuenta corrida": una cuenta que se va sumando/restando con
  // varios comandos de voz seguidos («súmame 13.400», luego «súmame 15.200»…),
  // sin guardarse en los datos del negocio — se reinicia si recargas la app.
  let lbCuenta = null;   // { total, pasos:[{op:'+'|'-', valor, total}] }
  // 1.65.7: 📦 pagos a PROVEEDORES (gasto «Proveedores» en Contabilidad) y 🧾 lo que le DEBO a un proveedor (cuentas por
  // pagar). Los pagos a empleados van a «Nómina» y lo que me pagan los que me deben, a las entradas (lbConta).
  const TIPOS = { debe: '📕 Me debe', abono: '✅ Me pagó', emp: '👷 Pagué a', prov: '📦 Pagué al proveedor', pdeb: '🧾 Le debo a' };
  const $l = id => document.getElementById(id);
  const esc2 = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const plata = n => '$' + Math.round(n || 0).toLocaleString('es-CO');
  const hablar = t => { try{ speakVoice(t); }catch(e){} };

  // ---------- Texto y números dichos en voz ----------
  function lbNorm(s){
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/\$/g, ' ')
      .replace(/(\d{1,3})(?:[.,](\d{3}))+(?!\d)/g, m => m.replace(/[.,]/g, ''))
      .replace(/(\d+)\s*k\b/g, '$1 mil')
      .replace(/[^a-z0-9ñ\s]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  const U = { un:1, uno:1, una:1, dos:2, tres:3, cuatro:4, cinco:5, seis:6, siete:7, ocho:8, nueve:9, diez:10, once:11, doce:12, trece:13, catorce:14, quince:15,
    dieciseis:16, diecisiete:17, dieciocho:18, diecinueve:19, veinte:20, veintiun:21, veintiuno:21, veintidos:22, veintitres:23, veinticuatro:24, veinticinco:25,
    veintiseis:26, veintisiete:27, veintiocho:28, veintinueve:29, treinta:30, cuarenta:40, cincuenta:50, sesenta:60, setenta:70, ochenta:80, noventa:90,
    cien:100, ciento:100, doscientos:200, doscientas:200, trescientos:300, trescientas:300, cuatrocientos:400, quinientos:500, quinientas:500,
    seiscientos:600, setecientos:700, ochocientos:800, novecientos:900, medio:0.5 };
  const MIL = /^(mil|lucas?|barras?)$/, MILLON = /^(millon|millones|palo|palos)$/;
  // Todos los números dichos, en orden, con su posición (palabra i a j) — «20 mil», «cinco», «3».
  function lbRuns(t){
    const w = t.split(' '), runs = [];
    let i = 0;
    while(i < w.length){
      const esNum = x => /^\d+$/.test(x) || U[x] !== undefined || MIL.test(x) || MILLON.test(x);
      if(!esNum(w[i]) || w[i] === 'una' && !(w[i + 1] && (MIL.test(w[i + 1]) || MILLON.test(w[i + 1])))){ i++; continue; }
      let j = i, total = 0, grupo = 0, huboMil = false;
      while(j < w.length){
        const x = w[j];
        // Si ya se cerró un «mil»/«millón» en este mismo número y el que sigue
        // TAMBIÉN trae su propio «mil»/«millón» (ej. «10 mil 15 mil»), es otra
        // cantidad aparte, no la misma — así se pueden decir varias cantidades
        // seguidas, sin pausa ni «más» entre ellas, y no se pegan como una
        // sola («veinte mil quinientos» sigue siendo un solo número porque
        // «quinientos» no repite «mil»).
        const otraCantidad = huboMil && (MIL.test(w[j + 1] || '') || MILLON.test(w[j + 1] || ''));
        if(/^\d+$/.test(x)){ if(otraCantidad) break; grupo += Number(x); }
        else if(U[x] !== undefined){ if(otraCantidad) break; grupo += U[x]; }
        else if(MIL.test(x)){ total += (grupo || 1) * 1000; grupo = 0; huboMil = true; }
        else if(MILLON.test(x)){ total = (total + (grupo || 1)) * 1e6; grupo = 0; huboMil = true; }
        else if(x === 'y' && w[j + 1] && esNum(w[j + 1])){ /* «mil y quinientos» */ }
        else if(x === 'con' && w[j + 1] && esNum(w[j + 1]) && total){ /* «dos mil con quinientos» */ }
        else break;
        j++;
      }
      runs.push({ i, j, v: Math.round(total + grupo) });
      i = j;
    }
    return { w, runs };
  }
  // Devuelve { monto, resto } : el número más grande dicho y el texto sin ese número.
  function lbMonto(t){
    const { w, runs } = lbRuns(t);
    if(!runs.length) return { monto: 0, resto: t };
    const r = runs.reduce((a, b) => (b.v > a.v ? b : a));
    return { monto: r.v, resto: w.slice(0, r.i).concat(w.slice(r.j)).join(' ') };
  }
  window.ventoMonto = t => { try{ return lbMonto(normVoiceText(t).replace(/\b(lucas?|barras?)\b/g, 'mil')).monto || 0; }catch(e){ return 0; } };
  const numFmt = n => { const r = Math.round(n * 100) / 100; return r.toLocaleString('es-CO', { maximumFractionDigits: 2 }); };
  // Calculadora de cabeza: toma TODOS los números dichos, en orden, y la palabra entre cada par
  // decide la operación («más», «menos», «por», «dividido»/«entre»). Se resuelve de izquierda a
  // derecha, como se hace a mano, no con la jerarquía de operaciones del colegio.
  function lbCalcPasos(t){
    const { w, runs } = lbRuns(t);
    if(!runs.length) return null;
    let acc = runs[0].v, detalle = numFmt(acc);
    for(let k = 1; k < runs.length; k++){
      const entre = w.slice(runs[k - 1].j, runs[k].i).join(' ');
      let op = '+';
      if(/\b(menos|resta|restale|restando|quitando|quitale)\b/.test(entre)) op = '-';
      else if(/\b(por|multiplicado|veces)\b/.test(entre)) op = '×';
      else if(/\b(dividido|entre|divide)\b/.test(entre)) op = '÷';
      const b = runs[k].v;
      if(op === '÷' && b === 0) return { err: 'No se puede dividir entre cero.' };
      acc = op === '+' ? acc + b : op === '-' ? acc - b : op === '×' ? acc * b : acc / b;
      detalle += ' ' + op + ' ' + numFmt(b);
    }
    return { acc, detalle, n: runs.length };
  }
  function lbCalc(t){        // texto «20.000 + 15.000 = 35.000» de una cuenta suelta (no toca lbCuenta)
    const r = lbCalcPasos(t);
    if(!r || r.n < 2) return null;
    if(r.err) return r.err;
    return r.detalle + ' = ' + numFmt(r.acc);
  }
  /* Calculadora por voz «de varias cuentas»: «súmame 3500 más 4000 y multiplícame 5000 por 2 o 6000 por 2»
     → 3.500 + 4.000 = 7.500 · 5.000 × 2 = 10.000 · 6.000 × 2 = 12.000. Cada cuenta se separa por «y», «o»,
     «luego», «después»…; el verbo da la operación («multiplícame 5000 y 2» también es ×) y las palabras o signos
     entre números la cambian (más, menos, por, x, entre, dividido, +, −, ×, ÷, /). Se resuelve de izquierda a
     derecha, como se hace a mano. La usan el micrófono principal, la libreta y ORDEVA. */
  const CALC_VERBO = /\b(sumame|sumale|sumeme|suma|sumar|sume|restame|restale|resta|restar|reste|multiplicame|multiplicale|multiplica|multiplicar|multiplique|divideme|dividele|divide|dividir|divida|cuanto es|cuanto son|cuanto da|cuanto dan|calcula|calculame|calcule)\b/;
  function calcPrepara(raw){
    let s = String(raw || '');
    for(let k = 0; k < 6; k++){ const a = s;
      s = s.replace(/(\d)\s*[x×*]\s*(\d)/gi, '$1 por $2').replace(/(\d)\s*[\/÷]\s*(\d)/g, '$1 entre $2').replace(/(\d)\s*\+\s*(\d)/g, '$1 mas $2').replace(/(\d)\s+[-−]\s*(\d)/g, '$1 menos $2');
      if(s === a) break; }
    return lbNorm(s).replace(/\bmultiplicado por\b/g, 'por').replace(/\bdividido (?:por|entre)\b/g, 'entre');
  }
  function calcUna(seg){
    const { w, runs } = lbRuns(seg);
    if(runs.length < 2) return null;
    const v = (seg.match(CALC_VERBO) || [''])[0];
    const def = /^rest/.test(v) ? '-' : /^multipl/.test(v) ? '×' : /^divid/.test(v) ? '÷' : '+';
    // Se multiplica y divide primero, después se suma y resta (como una calculadora normal):
    // «3 por 4000 más 2 por 3500» = 12.000 + 7.000 = 19.000 (3 cervezas a 4.000 y 2 a 3.500).
    let det = numFmt(runs[0].v), voz = numFmt(runs[0].v);
    const PAL = { '+': 'más', '-': 'menos', '×': 'por', '÷': 'entre' };
    const terminos = [[1, runs[0].v]];                  // [signo, valor] de cada sumando
    for(let k = 1; k < runs.length; k++){
      const entre = w.slice(runs[k - 1].j, runs[k].i).join(' ');
      let op = def;
      if(/\b(menos|resta|restale|restando|quitale)\b/.test(entre)) op = '-';
      else if(/\b(por|x|veces|multiplicado)\b/.test(entre)) op = '×';
      else if(/\b(entre|dividido|divide|sobre)\b/.test(entre)) op = '÷';
      else if(/\b(mas|sumale|suma)\b/.test(entre)) op = '+';
      const b = runs[k].v;
      if(op === '÷' && b === 0) return { det: 'No se puede dividir entre cero', voz: 'No se puede dividir entre cero' };
      const ult = terminos[terminos.length - 1];
      if(op === '×') ult[1] *= b; else if(op === '÷') ult[1] /= b; else terminos.push([op === '-' ? -1 : 1, b]);
      det += ' ' + op + ' ' + numFmt(b); voz += ' ' + PAL[op] + ' ' + numFmt(b);
    }
    const acc = terminos.reduce((x, t) => x + t[0] * t[1], 0);
    return { det: det + ' = ' + numFmt(acc), voz: voz + ' son ' + numFmt(acc), acc };
  }
  window.ventoCalcular = function(raw, exigirVerbo){
    const t = calcPrepara(raw);
    if(exigirVerbo && !CALC_VERBO.test(t)) return null;
    const piezas = t.split(/\s(?:y luego|y despues|y tambien|luego|despues|tambien|ademas|aparte|y|o)\s/);
    const segs = [];
    piezas.forEach(p => {
      const n = lbRuns(p).runs.length, cur = segs[segs.length - 1];
      const nueva = CALC_VERBO.test(p) || (cur && cur.n >= 2 && n >= 2 && /\b(mas|menos|por|x|veces|entre|dividido)\b/.test(p));
      if(!cur || nueva) segs.push({ t: p, n });
      else { cur.t += ' junto ' + p; cur.n += n; }               // «súmame 3500 y 4000»: el «y» une números de la misma cuenta
    });
    const res = segs.map(x => calcUna(x.t)).filter(Boolean);
    if(!res.length) return null;
    return { texto: '🧮 ' + res.map(r => r.det).join('\n🧮 '), voz: res.map(r => r.voz).join('. ') + '.', valores: res.map(r => r.acc) };
  };
  function lbCalcValor(t){   // solo el número final (uno o varios valores combinados), para sumarlo/restarlo a lbCuenta
    const r = lbCalcPasos(t);
    if(!r || r.err) return null;
    return r.acc;
  }

  // ---------- Personas ----------
  const QUITAR = /\b(me|le|les|lo|la|los|las|a|al|el|de|del|que|y|por|para|pesos?|plata|hoy|ayer|ya|se|todo|toda|completo|completa|la deuda|deuda|empleado|empleada|trabajador|trabajadora|sueldo|nomina|quincena|salario|dia|semana|jornal|pago|pague|pagado|pagaron|pagar|paga|debe|deben|debia|debiendo|quedo|queda|fiado|fiada|fie|fiar|fiale|fiele|preste|prestamo|prestado|abono|abonó|abonar|dio|di|devolvio|trajo|cancelo|saldo|anota|anotale|apunta|apuntale|cuanto|cuantos|quien|quienes|mas|otra|otro|vez|tambien|senor|senora|mi|mis|su|sus|un|una|pesitos|lucas?|mil|con|en|total|entonces|bueno|ok|listo|oye|mira|he|has|ha|hemos|hice|hizo|le he|este|mes|cuanto|proveedor|proveedora|proveedores|factura|facturas|pedido|mercancia|surtido|distribuidor|distribuidora|debo|compra|compras|credito|mesero|mesera|cocinero|cocinera|ayudante|cajero|cajera|domiciliario|domiciliaria)\b/g;
  function lbNombre(resto){
    const n = resto.replace(QUITAR, ' ').replace(/\s+/g, ' ').trim();
    if(!n || n.length < 2) return '';
    const known = lbPersonas().find(p => lbNorm(p) === n || lbNorm(p).split(' ')[0] === n || n.split(' ')[0] === lbNorm(p));
    if(known) return known;
    // Se escribe como lo dijo la persona (con tildes y ñ: «Doña Rosa», «María»).
    const crudas = String(lbNombre.crudo || '').split(/\s+/).map(x => x.replace(/[^\p{L}]/gu, '')).filter(Boolean);
    return n.split(' ').slice(0, 3).map(x => { const c = crudas.find(r => lbNorm(r) === x) || x; return c.charAt(0).toUpperCase() + c.slice(1).toLowerCase(); }).join(' ');
  }
  /* Los fiados de las MESAS también son de la libreta: cuando una cuenta se cierra con
     «Quedó debiendo», esa deuda aparece aquí con el nombre de quien debe. Un pago anotado
     en la libreta salda primero esas cuentas (la más vieja primero) y queda en su historial. */
  const lbHist = () => (typeof data !== 'undefined' && data && data.history) || [];
  function lbQuienMesa(h){
    const q = (h.payments || []).filter(x => x.method === 'debe' && x.note && x.note !== 'Saldo sin registrar al cerrar').map(x => x.note);
    const n = q[0] || h.person || h.tableName || 'Sin nombre';
    return lbPersonasLib().find(x => lbNorm(x) === lbNorm(n)) || n;
  }
  const lbPagoDespues = h => (h.payments || []).filter(x => /pag[oó] despu[eé]s/i.test(x.note || '')).reduce((s, x) => s + (x.amount || 0), 0);
  const lbAbonosMesa = h => (h.abonosLib || []).reduce((s, x) => s + x.m, 0);
  const lbDeudaOriginal = h => (h.debt || 0) + lbAbonosMesa(h) + lbPagoDespues(h);
  const lbFiadosMesa = () => lbHist().filter(h => lbDeudaOriginal(h) > 0 && ((h.debt || 0) > 0 || h.abonosLib || h.paidLater));
  function lbPersonasLib(){ return [...new Set(LB().movs.map(m => m.persona))]; }
  function lbPersonas(){ return [...new Set(lbPersonasLib().concat(lbFiadosMesa().map(lbQuienMesa)))]; }
  const lbMesasDe = p => lbHist().filter(h => (h.debt || 0) > 0 && lbNorm(lbQuienMesa(h)) === lbNorm(p));
  function lbSaldo(p){
    const lib = LB().movs.filter(m => m.persona === p).reduce((s, m) => s + (m.tipo === 'debe' ? m.monto : m.tipo === 'abono' ? -(m.monto - (m.aMesas || 0)) : 0), 0);
    return lib + lbMesasDe(p).reduce((s, h) => s + (h.debt || 0), 0);
  }
  // Todo lo que pasó con una persona, en orden: cuándo quedó debiendo y cuándo pagó.
  function lbHistorial(p){
    const ev = [];
    LB().movs.filter(m => m.persona === p).forEach(m => ev.push({ f: m.fecha, t: m.tipo === 'debe' ? '📕 Quedó debiendo' : m.tipo === 'abono' ? '✅ Pagó' : '👷 Le pagaste', m: m.monto, d: m.nota === 'pagó todo' ? 'todo' : '' }));
    lbHist().filter(h => lbNorm(lbQuienMesa(h)) === lbNorm(p) && lbDeudaOriginal(h) > 0).forEach(h => {
      ev.push({ f: h.date, t: '📕 Quedó debiendo', m: lbDeudaOriginal(h), d: h.tableName || (i18nPut(espacioN()) + ' ' + h.table) });
      if(lbPagoDespues(h) > 0 && h.paidLater) ev.push({ f: h.paidLater, t: '✅ Pagó', m: lbPagoDespues(h), d: (h.tableName || 'Mesa') + ' · desde Historial' });
    });
    return ev.sort((a, b) => new Date(b.f) - new Date(a.f));
  }
  function lbPagadoMes(p){
    const d = new Date(), ini = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    return LB().movs.filter(m => m.tipo === 'emp' && m.persona === p && new Date(m.fecha).getTime() >= ini).reduce((s, m) => s + m.monto, 0);
  }
  function lbQuitarMov(m){
    if(m.compra){ const pu = ((typeof data !== 'undefined' && data && data.purchases) || []).find(x => x.pagadoMov === m.id); if(pu) delete pu.pagadoMov; }
    (m.aplic || []).forEach(x => {
      const h = lbHist().find(y => y.id === x.hid); if(!h) return;
      h.debt = (h.debt || 0) + x.m;
      const i = (h.abonosLib || []).findIndex(y => y.f === m.fecha && y.m === x.m); if(i >= 0) h.abonosLib.splice(i, 1);
      if(h.abonosLib && !h.abonosLib.length) delete h.abonosLib;
      if(h.debt > 0 && h.paidLater === m.fecha) delete h.paidLater;
    });
  }
  // ---------- Proveedores ----------
  // Marcas y distribuidores que casi todo negocio tiene: «le pagué a Postobón» es un proveedor, no un empleado.
  const MARCAS = { 'postobon': 'Postobón', 'coca cola': 'Coca-Cola', 'cocacola': 'Coca-Cola', 'femsa': 'Coca-Cola FEMSA', 'bavaria': 'Bavaria', 'alpina': 'Alpina', 'colanta': 'Colanta',
    'nutresa': 'Nutresa', 'zenu': 'Zenú', 'quala': 'Quala', 'bimbo': 'Bimbo', 'ramo': 'Ramo', 'noel': 'Noel', 'colombina': 'Colombina', 'familia': 'Familia', 'diana': 'Diana', 'roa': 'Roa',
    'pepsi': 'Pepsi', 'aguila': 'Bavaria', 'central cervecera': 'Central Cervecera', 'nestle': 'Nestlé', 'unilever': 'Unilever', 'colgate': 'Colgate', 'super ricas': 'Super Ricas',
    'frito lay': 'Frito Lay', 'margarita': 'Frito Lay', 'tosh': 'Nutresa', 'gloria': 'Gloria', 'parmalat': 'Parmalat', 'pietran': 'Pietrán', 'rica': 'Rica', 'kokoriko': 'Kokoriko', 'surtimax': 'Surtimax',
    'makro': 'Makro', 'exito': 'Éxito', 'ara': 'Ara', 'd1': 'D1', 'olimpica': 'Olímpica', 'gas': 'Gas', 'licorera': 'Licorera', 'dislicores': 'Dislicores', 'industria licorera': 'Industria Licorera' };
  const PROV_PAL = /\b(proveedor|proveedora|proveedores|factura|facturas|pedido|mercancia|surtido|distribuidor|distribuidora|distribuidores|compra|compras)\b/;
  const EMP_PAL = /\b(sueldo|salario|nomina|quincena|jornal|empleado|empleada|trabajador|trabajadora|mesero|mesera|cocinero|cocinera|ayudante|cajero|cajera)\b/;
  function lbProveedores(){
    const de = (typeof data !== 'undefined' && data && data.purchases || []).map(x => String(x.supplier || '').trim()).filter(Boolean);
    return [...new Set(LB().movs.filter(m => m.tipo === 'prov' || m.tipo === 'pdeb').map(m => m.persona).concat(de))];
  }
  function lbMarca(t){ const k = Object.keys(MARCAS).sort((a, b) => b.length - a.length).find(m => new RegExp('\\b' + m + '\\b').test(t)); return k ? MARCAS[k] : null; }
  function lbEsProveedor(t, persona){
    if(PROV_PAL.test(t) || lbMarca(t)) return true;
    const n = lbNorm(persona || '');
    return !!n && lbProveedores().some(p => lbNorm(p) === n || lbNorm(p).split(' ')[0] === n.split(' ')[0]);
  }
  function lbNombreProv(resto, t){
    const m = lbMarca(t); if(m) return lbProveedores().find(p => lbNorm(p) === lbNorm(m)) || m;
    const n = lbNombre(resto); if(!n) return '';
    return lbProveedores().find(p => lbNorm(p) === lbNorm(n) || lbNorm(p).split(' ')[0] === lbNorm(n).split(' ')[0]) || n;
  }
  // Lo que le debo: en orden; un pago cuando no se le debía nada es una compra de contado (no deja saldo a favor).
  const lbDeboProv = p => LB().movs.filter(m => m.persona === p && (m.tipo === 'pdeb' || m.tipo === 'prov'))
    .sort((a, b) => new Date(a.fecha) - new Date(b.fecha)).reduce((s, m) => m.tipo === 'pdeb' ? s + m.monto : Math.max(0, s - m.monto), 0);
  function lbPorPagar(){ return lbProveedores().map(p => [p, lbDeboProv(p)]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]); }
  function lbPagadoProvMes(){
    const d = new Date(), ini = new Date(d.getFullYear(), d.getMonth(), 1).getTime(), o = {};
    LB().movs.filter(m => m.tipo === 'prov' && new Date(m.fecha).getTime() >= ini).forEach(m => { o[m.persona] = (o[m.persona] || 0) + m.monto; });
    return Object.entries(o).sort((a, b) => b[1] - a[1]);
  }
  // El pago de una factura que ya se escaneó (la compra ya está en Contabilidad): se enlaza y NO se cuenta otra vez.
  function lbEnlazarCompra(m){
    const l = (typeof data !== 'undefined' && data && data.purchases) || [], n = lbNorm(m.persona), hace = Date.now() - 60 * 864e5;
    const pu = l.find(x => !x.pagadoMov && Number(x.total) > 0 && Math.abs(Number(x.total) - m.monto) <= Math.max(100, m.monto * 0.01) && new Date(x.at || x.date).getTime() >= hace &&
      (lbNorm(x.supplier || '') === n || lbNorm(x.supplier || '').split(' ')[0] === n.split(' ')[0] || (lbNorm(x.supplier || '').includes(n) && n.length >= 4)));
    if(pu){ pu.pagadoMov = m.id; m.compra = pu.id || true; }
    return pu || null;
  }
  // Productos fiados por nombre («José me debe 2 cervezas»): el valor sale del precio del producto.
  function lbProductosEn(t){
    const ps = (typeof data !== 'undefined' && data && data.products) || [];
    const sing = w => w.replace(/(es|s)$/, '');
    const pal = t.split(' ').map(sing);
    let mejor = null, punt = 0;
    ps.forEach(p => {
      const ws = lbNorm(p.name).split(' ').filter(w => w.length > 2).map(sing);
      const n = ws.filter(w => pal.includes(w)).length;
      if(n > punt && Number(p.price) > 0){ punt = n; mejor = p; }
    });
    return mejor;
  }

  function lbDeudores(){ return lbPersonas().map(p => [p, lbSaldo(p)]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]); }
  function lbEmpleadosMes(){ return [...new Set(LB().movs.filter(m => m.tipo === 'emp').map(m => m.persona))].map(p => [p, lbPagadoMes(p)]).filter(x => x[1] > 0); }

  function lbAgregar(tipo, persona, monto, nota){
    const m = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), tipo, persona, monto: Math.round(monto), nota: nota || '', fecha: new Date().toISOString() };
    if(tipo === 'abono'){
      let resto = m.monto; m.aplic = [];
      lbMesasDe(persona).sort((a, b) => new Date(a.date) - new Date(b.date)).forEach(h => {
        if(resto <= 0) return;
        const toma = Math.min(resto, h.debt);
        h.debt -= toma; resto -= toma;
        h.abonosLib = (h.abonosLib || []).concat({ f: m.fecha, m: toma });
        if(h.debt <= 0){ h.debt = 0; h.paidLater = m.fecha; }
        m.aplic.push({ hid: h.id, m: toma });
      });
      m.aMesas = m.monto - resto;
    }
    if(tipo === 'prov') m.enlazada = lbEnlazarCompra(m);
    LB().movs.push(m); saveData(); lbPintar();
    try{ typeof renderConta === 'function' && renderConta(); }catch(e){}
    return m;
  }

  // ---------- Entender lo que se dijo (al instante, sin IA) ----------
  // Devuelve { texto } con la respuesta, o null si no es algo de la libreta.
  /* «Lista negra» = los que quedaron debiendo. Se traduce a la frase de siempre («Julián me debe
     30000» / «Pedro me pagó 10000» / «Pedro pagó todo») ANTES de la calculadora, que si no se
     quedaba con «agrégame…» o «descuéntale…» como si fuera una suma suelta. */
  const LB_LISTA = /\b(lista negra|lista de (?:los )?(?:deudores|morosos|que (?:me )?deben|fiados?|pendientes)|(?:la|mi) lista|listica|libreta|cuaderno|cuenta de|deuda de|deudas de|fiados? de|los que me deben)\b/g;
  const LB_FUERTE = /\b(quedo de pagar|quedo pendiente|quedo pendiente de|se llevo fiado|se lo llevo fiado|se llevo al fiado|llevo fiado|a credito|fiado de|cargale|carguele|cargarle|pendiente de pago|me quedo a deber|quedo a deber)\b/g;
  const LB_ANOTAR = /\b(agrega|agregame|agregale|agregar|agregue|agreguele|anade|anademe|anadele|mete|meteme|metele|meter|pon|ponme|ponle|poner|ponga|pongale|suma|sumale|sumame|sumar|carga|cargale|cargar|cargue|apunta|apuntame|apuntale|anota|anotame|anotale|anotar|escribe|escribele|escribeme|registra|registrale|incluye|incluyele|debe|deben|debiendo|fiado|fiar|fiale)\b/g;
  const LB_SACAR = /\b(saca|sacame|sacale|sacar|quita|quitale|quitar|borra|borrale|borrar|descuenta|descuentale|descontar|rebaja|rebajale|rebajar|resta|restale|tacha|tachale|tachar|elimina|eliminale)\b/g;
  const LB_RELLENO = /\b(negra|nombre|anotado|anotada|apuntado|apuntada|llevo|lleva|llevaron|pendiente|credito|ahi|aqui|esta|este|eso|esto|porfa|porfavor|favor|gracias|dile|sale|tiene|tengo)\b/g;
  function lbListaNegra(t){
    if(/\b(cuanto|cuantos|quien|quienes|como va|historial|movimientos?)\b/.test(t)) return null;
    const hay = rx => { rx.lastIndex = 0; const r = rx.test(t); rx.lastIndex = 0; return r; };
    const lista = hay(LB_LISTA), fuerte = hay(LB_FUERTE), sacar = hay(LB_SACAR), anotar = hay(LB_ANOTAR);
    if(!lista && !fuerte && !sacar) return null;
    const { monto, resto } = lbMonto(t);
    const limpio = resto.replace(LB_LISTA, ' ').replace(LB_FUERTE, ' ').replace(LB_SACAR, ' ').replace(LB_ANOTAR, ' ').replace(LB_RELLENO, ' ');
    const persona = lbNombre(limpio);
    if(!persona) return null;
    const conocida = lbPersonas().some(p => lbNorm(p) === lbNorm(persona));
    if(sacar && (lista || (conocida && lbSaldo(persona) > 0))) return monto >= 50 ? persona + ' me pago ' + monto : persona + ' pago todo';
    if(fuerte || (lista && anotar)) return monto >= 50 ? persona + ' me debe ' + monto : null;
    return null;
  }
  function lbEntender(raw, soloSeguro){
    lbNombre.crudo = raw;
    const t = lbNorm(raw);
    if(!t) return null;
    if(/\bmesa\b/.test(t)) return null;   // eso es de las mesas, no de la libreta
    const canon = lbListaNegra(t);
    if(canon){ const r = lbEntender(canon, soloSeguro); lbNombre.crudo = raw; if(r) return r; }
    if(/^(borra|quita|cancela|elimina)( lo| el)? (ultimo|ultima)$|^me equivoque$|^deshacer$/.test(t)){
      if(soloSeguro) return null;
      const m = LB().movs.pop(); if(!m) return { texto: 'No hay nada que borrar.' };
      lbQuitarMov(m); saveData(); lbPintar();
      return { texto: 'Listo, borré: ' + TIPOS[m.tipo].replace(/^\S+ /, '') + ' ' + m.persona + ', ' + plata(m.monto) + '.' };
    }
    // 1.65.7: «súmale a Juan 5 mil» con Juan en la libreta = Juan me debe 5 mil más (antes se iba a la calculadora).
    { const pc = lbPersonas().find(p => new RegExp('\\b' + lbNorm(p).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b').test(t));
      if(pc && /\b(sumale|sumele|agregale|agreguele|cargale|carguele|anotale|apuntale|ponle|metele)\b/.test(t) && !/\b(pago|pagos|abono|abonale|me pago)\b/.test(t)){
        const { monto } = lbMonto(t);
        if(monto >= 50){ lbNombre.crudo = raw; return lbEntender(pc + ' me debe ' + monto, soloSeguro); }
      } }
    // Calculadora de cuenta suelta (no se guarda): «cuánto es 20 mil más 15 mil»,
    // «calcula 45 por 3», «cuánto vale 800 entre 4»… Se resuelve aquí mismo (sin
    // IA), así responde al instante.
    const esDeuda = /\b(debe|deben|debia|debiendo|pague|pago|pagaron|paga|fiado|fiar|fie|fio|preste|abono|abonar|sueldo|nomina|quincena|jornal)\b/.test(t);
    if(/\b(cuanto es|cuanto da|cuanto son|cuanto queda|cuanto suman|cuanto vale|cuanto valen|calcula|calculame)\b/.test(t) ||
       (/\b(mas|menos|por|multiplicado|dividido|entre)\b/.test(t) && lbRuns(t).runs.length >= 2 && !esDeuda)){
      const r2 = window.ventoCalcular(t); if(r2) return { texto: r2.texto.replace(/🧮 /g, ''), voz: r2.voz };
      const r = lbCalc(t);
      if(r) return { texto: r };
    }
    // Calculadora "de cuenta corrida" (con memoria): «súmame 13.400», y después
    // «súmame 15.200» (sin decir «más» entre una y otra) va acumulando un total
    // — así se pueden ir metiendo varias cuentas seguidas, cada una con su
    // propio comando, sin tener que acordarse del total ni volver a sumarlo
    // todo de una vez. Si algo quedó mal, «corrige» (o «réstame» sin decir
    // ningún valor) quita lo último que se metió y dice cuánto era.
    if(!esDeuda){
      const esSuma = /\b(sumame|sumale|suma esto|sumale esto|agregame|agregale|anademe|anadele|mete a la cuenta|agrega a la cuenta|suma a la cuenta)\b/.test(t);
      const esResta = /\b(restame|restale|resta esto|restale esto|quitame|quitale|descuentame|descuentale|resta a la cuenta|quita a la cuenta)\b/.test(t);
      const esCorrige = /\b(corrige|corrigela|corrigelo|deshaz eso|deshaz la cuenta|quita eso|quita lo ultimo de la cuenta|quita el ultimo valor|borra el ultimo valor|borra lo ultimo de la cuenta|me equivoque en la cuenta)\b/.test(t);
      const esPreguntaCuenta = /\b(cuanto llevo|cuanto voy|como va la cuenta|cuanto suma la cuenta|cuanto tengo en la cuenta|total de la cuenta|cual es el total de la cuenta)\b/.test(t);
      const esNuevaCuenta = /^(nueva cuenta|nueva suma|nueva cuenta corrida|reinicia la cuenta|borra toda la cuenta|cuenta nueva|limpia la cuenta)$/.test(t);
      if(esNuevaCuenta){
        lbCuenta = null;
        return { texto: 'Lista, empecé una cuenta nueva. Dime «súmame» y el valor.' };
      }
      if(esPreguntaCuenta){
        if(!lbCuenta || !lbCuenta.pasos.length) return { texto: 'Todavía no has empezado ninguna cuenta. Dime «súmame» y un valor.' };
        return { texto: 'Vas en ' + plata(lbCuenta.total) + '.' };
      }
      if(esCorrige || (esResta && lbRuns(t).runs.length === 0)){
        if(!lbCuenta || !lbCuenta.pasos.length) return { texto: 'No hay nada que corregir: todavía no has metido ningún valor a la cuenta.' };
        const paso = lbCuenta.pasos.pop();
        lbCuenta.total = lbCuenta.pasos.length ? lbCuenta.pasos[lbCuenta.pasos.length - 1].total : 0;
        return { texto: 'Corregido: quité ' + plata(paso.valor) + ' que había ' + (paso.op === '+' ? 'sumado' : 'restado') + '. Vas en ' + plata(lbCuenta.total) + '.' };
      }
      if(esSuma || esResta){
        const valor = lbCalcValor(t);
        if(valor === null) return { texto: (esSuma ? 'Súmame' : 'Réstame') + ' ¿cuánto? Di, por ejemplo, «súmame 13.400».' };
        if(!lbCuenta) lbCuenta = { total: 0, pasos: [] };
        const op = esSuma ? '+' : '-';
        lbCuenta.total += op === '+' ? valor : -valor;
        lbCuenta.pasos.push({ op, valor, total: lbCuenta.total });
        return { texto: (op === '+' ? '+ ' : '− ') + plata(valor) + ' → vas en ' + plata(lbCuenta.total) + '.' };
      }
    }
    // Preguntas
    // Preguntas: «cuánto…», «quién…» o empezando con «qué…». (Antes cualquier «que» era pregunta: «anota que Camilo debe
    // 6 mil» respondía «Camilo 6 no te debe nada».)
    if(/\b(cuanto|cuantos|quien|quienes)\b/.test(t) || /^que\b/.test(t)){
      if(/\b(cuanto|que) (le )?debo\b|\ba quien(es)? le debo\b|\bpor pagar\b|\bdebo a (los )?proveedores\b/.test(t)){
        const quienP = lbNombreProv(t.replace(/\b(cuanto|que|le|les|debo|a|al|quien|quienes|por pagar)\b/g, ' '), t);
        if(quienP && lbProveedores().some(p => lbNorm(p) === lbNorm(quienP))) return { texto: lbDeboProv(quienP) > 0 ? 'Le debes ' + plata(lbDeboProv(quienP)) + ' a ' + quienP + '.' : 'No le debes nada a ' + quienP + '.' };
        const l = lbPorPagar(); if(!l.length) return { texto: 'No le debes nada a ningún proveedor. 🎉' };
        return { texto: 'Les debes ' + plata(l.reduce((a, x) => a + x[1], 0)) + ' a los proveedores: ' + l.slice(0, 6).map(x => x[0] + ' ' + plata(x[1])).join(', ') + '.' };
      }
      if(/\b(pague|pagado|pagamos)\b/.test(t) && /\b(proveedor|proveedores)\b/.test(t)){
        const l = lbPagadoProvMes(); if(!l.length) return { texto: 'Este mes no has anotado pagos a proveedores.' };
        return { texto: 'Este mes les has pagado ' + plata(l.reduce((a, x) => a + x[1], 0)) + ' a los proveedores: ' + l.slice(0, 6).map(x => x[0] + ' ' + plata(x[1])).join(', ') + '.' };
      }
      if(/\b(quien|quienes)\b.*\bdeben?\b|\bcuanto me deben\b|\bcuanto me estan debiendo\b|\bcuanto hay (por|en) (cobrar|fiados?)\b/.test(t)){
        const d = lbDeudores(); if(!d.length) return { texto: 'Nadie te debe nada. 🎉' };
        const tot = d.reduce((s, x) => s + x[1], 0);
        return { texto: 'Te deben ' + plata(tot) + ' en total. ' + d.slice(0, 6).map(x => x[0] + ' ' + plata(x[1])).join(', ') + (d.length > 6 ? ', y ' + (d.length - 6) + ' más.' : '.') };
      }
      if(/\b(pague|pagado|pagamos)\b/.test(t) && /\b(empleados?|trabajadores?|nomina|sueldos?)\b/.test(t) && !lbNombre(t.replace(/\b(empleados?|trabajadores?|nomina|sueldos?)\b/g, ' '))){
        const e = lbEmpleadosMes(); if(!e.length) return { texto: 'Este mes no has anotado pagos a empleados.' };
        return { texto: 'Este mes les has pagado ' + plata(e.reduce((s, x) => s + x[1], 0)) + ': ' + e.map(x => x[0] + ' ' + plata(x[1])).join(', ') + '.' };
      }
      const quien = lbNombre(t);
      if(quien && /\bdebe\b/.test(t)){ const s = lbSaldo(quien); return { texto: s > 0 ? quien + ' te debe ' + plata(s) + '.' : quien + ' no te debe nada.' }; }
      if(quien && /\b(pague|pagado)\b/.test(t)){ return { texto: 'Este mes le has pagado a ' + quien + ' ' + plata(lbPagadoMes(quien)) + '.' }; }
      return null;
    }
    if(/\b(historial|cuentas? de|movimientos?|que ha pasado con|como va)\b/.test(t)){
      const quien = lbNombre(t.replace(/\b(historial|cuentas?|movimientos?|que ha pasado con|como va)\b/g, ' '));
      if(quien){
        const ev = lbHistorial(quien).slice(0, 4);
        if(!ev.length) return { texto: 'No tengo nada anotado de ' + quien + '.' };
        lbAbrirPersona = quien;
        return { texto: quien + ': ' + ev.map(e => e.t.replace(/^\S+ /, '').toLowerCase() + ' ' + plata(e.m) + ' el ' + new Date(e.f).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })).join('; ') + '. Hoy te debe ' + plata(lbSaldo(quien)) + '.' };
      }
    }
    let { monto, resto } = lbMonto(t);
    const todo = /\b(todo|toda la deuda|completo|completa|lo que debia|lo que me debia)\b/.test(t);
    // 🧾 Le debo a un proveedor (compré fiado / a crédito): «le debo a Postobón 300 mil», «me fiaron en Alpina 80 mil».
    if(/\b(le debo|les debo|debo a|debo al|quede debiendo|quedamos debiendo|me fiaron|me fio|compre fiado|compre a credito|me dejaron fiado|me dejo fiado)\b/.test(t) && !/\bme debe\b/.test(t)){
      const prov = lbNombreProv(resto, t);
      if(!prov) return soloSeguro ? null : { texto: '¿A quién le debes? Di por ejemplo: «Le debo a Postobón 300 mil».' };
      if(!(monto >= 50)) return soloSeguro ? null : { texto: '¿Cuánto le debes a ' + prov + '?' };
      lbAgregar('pdeb', prov, monto);
      return { texto: '🧾 Anotado: le debes ' + plata(monto) + ' a ' + prov + '. En total le debes ' + plata(lbDeboProv(prov)) + '.' };
    }
    // Pagos a empleados: «le pagué a Pedro», «pagué a María», «pago a Pedro», «le di a Juan», «sueldo de Pedro»
    const emp = /\b(le pague|les pague|pague a|pague al|pague la|pago a|pago al|le di|di a|sueldo|salario|nomina|quincena|jornal)\b/.test(t) || (/\bpague\b/.test(t) && !/\bme\b/.test(t));
    // Me pagaron: «Juan me pagó», «Juan pagó», «Juan abonó», «me dio», «me devolvió», «canceló»
    const abono = !emp && /\b(me pago|pago|pagaron|abono|abonaron|me dio|me devolvio|devolvio|me trajo|cancelo|me cancelo)\b/.test(t);
    // Me debe: «Juan me debe», «quedó debiendo», «le fié», «fiado», «le presté»
    const debe = !emp && !abono && /\b(me debe|debe|deben|debiendo|fiado|fiada|fie|fiar|fiale|fiele|preste|prestado|prestamo|anota|anotale|apunta|apuntale)\b/.test(t);
    if(!emp && !abono && !debe) return null;
    // 📦 ¿Le pagué a un PROVEEDOR (no a un empleado)? «le pagué al proveedor de Postobón», «pagué la factura de Alpina».
    if(emp && !EMP_PAL.test(t) && lbEsProveedor(t, lbNombre(resto))){
      const prov = lbNombreProv(resto, t);
      if(!prov) return soloSeguro ? null : { texto: '¿A cuál proveedor? Di por ejemplo: «Le pagué a Postobón 200 mil».' };
      if(!(monto >= 50)){
        const d0 = lbDeboProv(prov);
        if(todo && d0 > 0) monto = d0;
        else return soloSeguro ? null : { texto: '¿Cuánto le pagaste a ' + prov + '?' + (d0 > 0 ? ' Le debes ' + plata(d0) + '.' : '') };
      }
      const debia = lbDeboProv(prov), m = lbAgregar('prov', prov, monto), queda = lbDeboProv(prov);
      return { texto: '📦 Anotado: le pagaste ' + plata(monto) + ' a ' + prov + '.' + (m.enlazada ? ' Es la factura escaneada del ' + new Date(m.enlazada.at || m.enlazada.date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) + ' (queda pagada; no se cuenta dos veces en Contabilidad).' : ' Queda como gasto de proveedores en Contabilidad.') +
        (debia > 0 ? (queda > 0 ? ' Todavía le debes ' + plata(queda) + '.' : ' Ya no le debes nada.') : '') };
    }
    // «José me debe 2 cervezas»: sin valor en plata, pero con un producto de la lista → cantidad × precio.
    let notaProd = '';
    if(debe && !(monto >= 50)){
      const pr = lbProductosEn(t);
      if(pr){ const q = monto > 0 && monto < 50 ? monto : 1; notaProd = q + ' × ' + pr.name; monto = Math.round(q * Number(pr.price));
        resto = resto.split(' ').filter(w => !lbNorm(pr.name).split(' ').some(x => x.length > 2 && (w === x || w.replace(/(es|s)$/, '') === x.replace(/(es|s)$/, '')))).join(' '); }
    }
    const persona = lbNombre(resto);
    if(!persona) return soloSeguro ? null : { texto: '¿De quién? Di por ejemplo: «Juan me debe 20 mil».' };
    if(abono && (todo || !monto)){
      const s = lbSaldo(persona);
      if(!(s > 0)) return { texto: persona + ' no te debe nada.' };
      if(!todo && !monto) return { texto: '¿Cuánto te pagó ' + persona + '? Te debe ' + plata(s) + '.' };
      lbAgregar('abono', persona, s, 'pagó todo');
      try{ window.mesoraCelebrar && window.mesoraCelebrar(['🎉', '💰', '✨']); }catch(e){}
      return { texto: '✅ ' + persona + ' pagó todo (' + plata(s) + '). Ya no te debe nada.' };
    }
    if(!(monto >= 50)) return soloSeguro ? null : { texto: '¿Cuánta plata? Di por ejemplo: «' + persona + ' me debe 20 mil».' };
    if(debe){
      lbAgregar('debe', persona, monto, notaProd);
      return { texto: '📕 Anotado: ' + persona + ' te debe ' + plata(monto) + (notaProd ? ' (' + notaProd + ')' : '') + '. En total te debe ' + plata(lbSaldo(persona)) + '.' };
    }
    if(abono){
      const antes = lbSaldo(persona);
      lbAgregar('abono', persona, monto);
      const s = lbSaldo(persona);
      return { texto: '✅ ' + persona + ' te pagó ' + plata(monto) + '. ' + (s > 0 ? 'Todavía te debe ' + plata(s) + '.' : s < 0 ? 'Te pagó ' + plata(-s) + ' de más.' : antes > 0 ? 'Ya no te debe nada.' : '') };
    }
    lbAgregar('emp', persona, monto);
    return { texto: '👷 Anotado: le pagaste ' + plata(monto) + ' a ' + persona + '. Este mes van ' + plata(lbPagadoMes(persona)) + '.' };
  }

  // Desde el micrófono principal: solo si es claramente de la libreta (no se roba pedidos).
  window.libretaVoz = function(raw){
    const r = lbEntender(raw, true);
    if(!r) return false;
    lbResponder(r.texto);
    return true;
  };
  window.libretaEntender = lbEntender;   // para pruebas

  function lbResponder(txt){
    const el = $l('lbRespuesta'); if(el){ el.textContent = txt; el.hidden = false; }
    try{ showToast(txt, 6000); }catch(e){}
    hablar(txt.replace(/[📕✅👷🎉]/gu, '').replace(/\$([\d.]+)/g, (m, n) => n.replace(/\./g, '') + ' pesos'));
  }

  // ---------- Pantalla ----------
  function lbCrear(){
    if($l('libretaOverlay')) return;
    const ov = document.createElement('div');
    ov.className = 'overlay'; ov.id = 'libretaOverlay';
    ov.innerHTML = '<div class="modal lb-modal"><div class="modal-title-row"><h2>📒 Mi libreta</h2><button class="rename-table-btn" id="lbCerrar" title="Cerrar">✕</button></div>' +
      '<button type="button" class="lb-mic" id="lbMic">🎤 Toca y habla</button>' +
      '<div class="lb-ej">Di, por ejemplo:<br>«Juan me debe 20 mil» · «Juan me pagó 10 mil»<br>«Agrégame a la lista negra 30 mil para Julián» · «Julián quedó debiendo 30 mil»<br>«Saca a Pedro de la lista negra» (pagó todo)<br>«Le pagué a Pedro 50 mil» · «¿Quién me debe?»<br>«Le pagué a Postobón 200 mil» · «Le debo a Alpina 80 mil» · «¿Cuánto le debo a los proveedores?»<br>«Cuánto es 20 mil más 15 mil» (cuenta suelta)<br>«Súmame 13.400», y después «súmame 15.200» (se va sumando solo)<br>«Cuánto llevo» · «Réstame» o «corrige» (si algo quedó mal)</div>' +
      '<div class="lb-resp" id="lbRespuesta" hidden></div>' +
      '<div class="lb-btns"><button type="button" class="lb-b lb-debe" data-t="debe">📕 Alguien<br>me debe</button><button type="button" class="lb-b lb-abono" data-t="abono">✅ Me<br>pagaron</button><button type="button" class="lb-b lb-emp" data-t="emp">👷 Pagué a un<br>empleado</button>' +
      '<button type="button" class="lb-b lb-prov" data-t="prov">📦 Pagué a un<br>proveedor</button><button type="button" class="lb-b lb-pdeb" data-t="pdeb">🧾 Le debo a un<br>proveedor</button></div>' +
      '<button type="button" class="lb-calc-btn" id="lbCalcAbrir">🧮 Calculadora</button>' +
      '<div class="lb-calc" id="lbCalcBox" hidden>' +
      '<div class="lb-calc-pant" id="lbCalcPant">0</div>' +
      '<div class="lb-calc-grid">' +
      '<button type="button" data-k="C">C</button><button type="button" data-k="⌫">⌫</button><button type="button" data-k="%">%</button><button type="button" data-k="÷" class="lb-calc-op">÷</button>' +
      '<button type="button" data-k="7">7</button><button type="button" data-k="8">8</button><button type="button" data-k="9">9</button><button type="button" data-k="×" class="lb-calc-op">×</button>' +
      '<button type="button" data-k="4">4</button><button type="button" data-k="5">5</button><button type="button" data-k="6">6</button><button type="button" data-k="−" class="lb-calc-op">−</button>' +
      '<button type="button" data-k="1">1</button><button type="button" data-k="2">2</button><button type="button" data-k="3">3</button><button type="button" data-k="+" class="lb-calc-op">+</button>' +
      '<button type="button" data-k="0" class="lb-calc-0">0</button><button type="button" data-k=".">.</button><button type="button" data-k="=" class="lb-calc-ig">=</button>' +
      '</div></div>' +
      '<div class="lb-form" id="lbForm" hidden><div class="lb-form-t" id="lbFormT"></div>' +
      '<input id="lbPersona" class="mz-in" list="lbPersonasList" placeholder="Nombre" autocomplete="off"><datalist id="lbPersonasList"></datalist>' +
      '<input id="lbMonto" class="mz-in" type="number" inputmode="numeric" placeholder="¿Cuánta plata?" min="0" step="500">' +
      '<div class="lb-form-a"><button type="button" class="btn-close" id="lbFormNo">Cancelar</button><button type="button" class="btn-primary" id="lbFormSi">Guardar</button></div></div>' +
      '<div class="lb-sec"><div class="lb-sec-t">📕 Me deben <b id="lbTotDeben"></b></div><div id="lbDeben"></div></div>' +
      '<div class="lb-sec"><div class="lb-sec-t">👷 Pagos a empleados este mes <b id="lbTotEmp"></b></div><div id="lbEmp"></div></div>' +
      '<div class="lb-sec"><div class="lb-sec-t">🧾 Le debo a proveedores <b id="lbTotDebo"></b></div><div id="lbDebo"></div></div>' +
      '<div class="lb-sec"><div class="lb-sec-t">📦 Pagado a proveedores este mes <b id="lbTotProv"></b></div><div id="lbProv"></div></div>' +
      '<div class="lb-sec"><div class="lb-sec-t">🕘 Lo último que anoté</div><div id="lbMovs"></div></div></div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', e => { if(e.target === ov) ov.classList.remove('show'); });
    $l('lbCerrar').onclick = () => ov.classList.remove('show');
    let tipoForm = null;
    ov.querySelectorAll('.lb-b').forEach(b => b.onclick = () => {
      tipoForm = b.dataset.t;
      $l('lbFormT').textContent = { debe: '📕 ¿Quién te debe y cuánto?', abono: '✅ ¿Quién te pagó y cuánto?', emp: '👷 ¿A quién le pagaste y cuánto?', prov: '📦 ¿A qué proveedor le pagaste y cuánto?', pdeb: '🧾 ¿A qué proveedor le debes y cuánto?' }[tipoForm];
      $l('lbPersonasList').innerHTML = (tipoForm === 'emp' ? [...new Set(LB().movs.filter(m => m.tipo === 'emp').map(m => m.persona))] : tipoForm === 'abono' ? lbDeudores().map(x => x[0]) : tipoForm === 'prov' || tipoForm === 'pdeb' ? lbProveedores() : lbPersonas()).map(p => '<option value="' + esc2(p) + '">').join('');
      $l('lbPersona').value = ''; $l('lbMonto').value = '';
      $l('lbForm').hidden = false; $l('lbPersona').focus();
    });
    $l('lbFormNo').onclick = () => { $l('lbForm').hidden = true; };
    // ---------- Calculadora de botones (suma, resta, multiplica, divide) ----------
    // Igual que cualquier calculadora de bolsillo: un acumulador, un operador pendiente y lo que
    // se va tecleando. «=» resuelve de una; encadenar operadores («20 + 5 ×») va calculando de
    // a poco, como en una calculadora de verdad.
    let calcAcc = null, calcOp = null, calcTexto = '0', calcNueva = false;
    const calcPintar = () => { $l('lbCalcPant').textContent = calcTexto; };
    const calcNum = s => { const n = Number(String(s).replace(',', '.')); return isFinite(n) ? n : 0; };
    const calcOpera = (a, op, b) => op === '+' ? a + b : op === '−' ? a - b : op === '×' ? a * b : (b === 0 ? NaN : a / b);
    $l('lbCalcAbrir').onclick = () => {
      const box = $l('lbCalcBox'); box.hidden = !box.hidden;
      if(!box.hidden){ calcAcc = null; calcOp = null; calcTexto = '0'; calcNueva = false; calcPintar(); }
    };
    ov.querySelectorAll('.lb-calc-grid button').forEach(b => b.onclick = () => {
      const k = b.dataset.k;
      if(k === 'C'){ calcAcc = null; calcOp = null; calcTexto = '0'; calcNueva = false; }
      else if(k === '⌫'){ calcTexto = calcTexto.length > 1 ? calcTexto.slice(0, -1) : '0'; }
      else if(k === '%'){ calcTexto = numFmt(calcNum(calcTexto) / 100); calcNueva = true; }
      else if(k === '.'){ if(calcNueva){ calcTexto = '0.'; calcNueva = false; } else if(!calcTexto.includes('.')) calcTexto += '.'; }
      else if(/^[0-9]$/.test(k)){ calcTexto = (calcTexto === '0' || calcNueva) ? k : calcTexto + k; calcNueva = false; }
      else if(['+', '−', '×', '÷'].includes(k)){
        const n = calcNum(calcTexto);
        calcAcc = calcAcc === null ? n : calcOpera(calcAcc, calcOp, n);
        calcOp = k; calcNueva = true; calcTexto = numFmt(calcAcc);
      } else if(k === '='){
        const n = calcNum(calcTexto);
        const r = calcAcc === null ? n : calcOpera(calcAcc, calcOp, n);
        calcTexto = isNaN(r) ? 'No se puede dividir entre 0' : numFmt(r);
        if(!isNaN(r)) try{ hablar('son ' + numFmt(r) + ' pesos'); }catch(e){}
        calcAcc = null; calcOp = null; calcNueva = true;
      }
      calcPintar();
    });
    $l('lbFormSi').onclick = () => {
      const p = $l('lbPersona').value.trim().replace(/\s+/g, ' '), n = Number($l('lbMonto').value);
      if(!p) return lbResponder('Escribe el nombre.');
      if(!(n > 0)) return lbResponder('Escribe cuánta plata.');
      const nombre = (tipoForm === 'prov' || tipoForm === 'pdeb' ? lbProveedores() : lbPersonas()).find(x => lbNorm(x) === lbNorm(p)) || p.charAt(0).toUpperCase() + p.slice(1);
      $l('lbForm').hidden = true;
      // Con los botones se sabe qué es: se anota directo (sin adivinar por las palabras).
      if(tipoForm === 'prov' || tipoForm === 'pdeb' || tipoForm === 'emp'){
        const debia = lbDeboProv(nombre), m = lbAgregar(tipoForm, nombre, n);
        lbResponder(tipoForm === 'pdeb' ? '🧾 Anotado: le debes ' + plata(n) + ' a ' + nombre + '. En total le debes ' + plata(lbDeboProv(nombre)) + '.'
          : tipoForm === 'prov' ? '📦 Anotado: le pagaste ' + plata(n) + ' a ' + nombre + '.' + (m.enlazada ? ' Es la factura escaneada (no se cuenta dos veces).' : ' Queda como gasto de proveedores en Contabilidad.') + (debia > 0 ? (lbDeboProv(nombre) > 0 ? ' Todavía le debes ' + plata(lbDeboProv(nombre)) + '.' : ' Ya no le debes nada.') : '')
          : '👷 Anotado: le pagaste ' + plata(n) + ' a ' + nombre + '. Este mes van ' + plata(lbPagadoMes(nombre)) + '.');
        return;
      }
      const frase = tipoForm === 'debe' ? nombre + ' me debe ' + n : nombre + ' me pagó ' + n;
      const r = lbEntender(frase); if(r) lbResponder(r.texto);
    };
    ov.addEventListener('click', e => {
      const dp = e.target.closest('.lb-deudor');
      if(dp && !e.target.closest('button')){ lbAbrirPersona = lbAbrirPersona === dp.dataset.persona ? null : dp.dataset.persona; lbPintar(); return; }
      const pt = e.target.closest('[data-pagotodo]');
      if(pt){ const r = lbEntender(pt.dataset.pagotodo + ' pagó todo'); if(r) lbResponder(r.texto); return; }
      const del = e.target.closest('[data-borrar]');
      if(del){
        const l = LB().movs, i = l.findIndex(m => m.id === del.dataset.borrar);
        if(i >= 0 && confirm('¿Borrar este apunte?')){ lbQuitarMov(l[i]); l.splice(i, 1); saveData(); lbPintar(); }
      }
    });
    $l('lbMic').onclick = lbEscuchar;
  }
  function lbPintar(){
    if(!$l('libretaOverlay') || !data) return;
    const d = lbDeudores();
    $l('lbTotDeben').textContent = d.length ? plata(d.reduce((s, x) => s + x[1], 0)) : '';
    $l('lbDeben').innerHTML = d.length ? d.map(([p, s]) => {
      const mesas = lbMesasDe(p).length;
      const abierto = lbAbrirPersona === p;
      return '<div class="lb-fila lb-deudor" data-persona="' + esc2(p) + '"><span>' + esc2(p) + '<small>' + (mesas ? '🍽️ ' + mesas + (mesas === 1 ? ' cuenta de mesa' : ' cuentas de mesa') + ' · ' : '') + 'toca para ver su historial</small></span><b>' + plata(s) + '</b><button type="button" class="btn-ghost" data-pagotodo="' + esc2(p) + '">✅ Pagó todo</button></div>' +
        (abierto ? '<div class="lb-hist">' + lbHistorial(p).map(e => '<div class="lb-ev"><span>' + e.t + (e.d && e.d !== 'todo' ? ' · ' + esc2(e.d) : e.d === 'todo' ? ' (todo)' : '') + '<small>' + new Date(e.f).toLocaleString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + '</small></span><b>' + plata(e.m) + '</b></div>').join('') + '</div>' : '');
    }).join('') : '<div class="lb-vacio">Nadie te debe nada 🎉</div>';
    const e = lbEmpleadosMes();
    $l('lbTotEmp').textContent = e.length ? plata(e.reduce((s, x) => s + x[1], 0)) : '';
    $l('lbEmp').innerHTML = e.length ? e.map(([p, s]) => '<div class="lb-fila"><span>' + esc2(p) + '</span><b>' + plata(s) + '</b></div>').join('') : '<div class="lb-vacio">Todavía no hay pagos este mes.</div>';
    const pp = lbPorPagar();
    $l('lbTotDebo').textContent = pp.length ? plata(pp.reduce((a, x) => a + x[1], 0)) : '';
    $l('lbDebo').innerHTML = pp.length ? pp.map(([p, s]) => '<div class="lb-fila"><span>' + esc2(p) + '</span><b>' + plata(s) + '</b></div>').join('') : '<div class="lb-vacio">No le debes a ningún proveedor.</div>';
    const pv = lbPagadoProvMes();
    $l('lbTotProv').textContent = pv.length ? plata(pv.reduce((a, x) => a + x[1], 0)) : '';
    $l('lbProv').innerHTML = pv.length ? pv.map(([p, s]) => '<div class="lb-fila"><span>' + esc2(p) + '</span><b>' + plata(s) + '</b></div>').join('') : '<div class="lb-vacio">Todavía no hay pagos a proveedores este mes.</div>';
    const ult = LB().movs.slice(-12).reverse();
    $l('lbMovs').innerHTML = ult.length ? ult.map(m => '<div class="lb-fila lb-mov"><span>' + TIPOS[m.tipo] + ' ' + (m.tipo === 'emp' || m.tipo === 'prov' || m.tipo === 'pdeb' ? esc2(m.persona) : '· ' + esc2(m.persona)) + (m.nota && m.nota !== 'pagó todo' ? ' · ' + esc2(m.nota) : '') + '<small>' + new Date(m.fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) + '</small></span><b>' + plata(m.monto) + '</b><button type="button" class="lb-x" data-borrar="' + m.id + '" title="Borrar">🗑</button></div>').join('') : '<div class="lb-vacio">Aquí van a salir tus apuntes.</div>';
  }
  /* 📊 Lo de la libreta en Contabilidad (1.65.7), en el periodo [ini, fin):
     • ✅ lo que me pagaron los que me debían → entradas («Fiado cobrado»);
     • 👷 los pagos a empleados → gasto «Nómina / sueldos»;
     • 📦 los pagos a proveedores → gasto «Proveedores / mercancía» (si es una factura ya escaneada, esa compra ya está
       contada: no se cuenta otra vez).
     «📕 Me debe» y «🧾 Le debo a» no son plata que entró o salió: salen aparte (por cobrar / por pagar). */
  window.libretaConta = function(ini, fin){
    const out = [];
    if(typeof data === 'undefined' || !data || !data.libreta) return out;
    LB().movs.forEach(m => {
      const t = new Date(m.fecha).getTime(); if(!(t >= ini && t < fin)) return;
      if(m.tipo === 'abono') out.push({ tipo: 'venta', monto: m.monto, metodo: m.metodo || 'efectivo', fecha: t, desc: 'Fiado cobrado · ' + m.persona + ' (libreta)', auto: true });
      else if(m.tipo === 'emp') out.push({ tipo: 'gasto', cat: 'nomina', monto: m.monto, metodo: m.metodo || 'efectivo', fecha: t, desc: 'Pago a ' + m.persona + ' (libreta)', auto: true });
      else if(m.tipo === 'prov' && !m.compra) out.push({ tipo: 'gasto', cat: 'proveedores', monto: m.monto, metodo: m.metodo || 'efectivo', fecha: t, desc: 'Pago al proveedor ' + m.persona + ' (libreta)', auto: true });
    });
    return out;
  };
  window.libretaTotales = () => ({ meDeben: lbDeudores().reduce((a, x) => a + x[1], 0), debo: lbPorPagar().reduce((a, x) => a + x[1], 0) });

  window.libretaAbrir = function(){ lbCrear(); lbPintar(); $l('libretaOverlay').classList.add('show'); };
  window.libretaPintar = lbPintar;
  window.libretaSaldo = p => lbSaldo(p);

  // ---------- Micrófono propio de la libreta ----------
  let rec = null;
  function lbEscuchar(){
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    const b = $l('lbMic');
    if(!Ctor) return lbResponder('Este celular no deja usar la voz aquí. Usa los botones de abajo.');
    if(rec){ try{ rec.abort(); }catch(e){} rec = null; window.__lbMicOn = false; b.classList.remove('on'); b.textContent = '🎤 Toca y habla'; return; }
    rec = new Ctor(); rec.lang = 'es-CO'; rec.interimResults = false; rec.maxAlternatives = 4; rec.continuous = false;
    b.classList.add('on'); b.textContent = '👂 Te escucho…';
    rec.onresult = ev => {
      const alts = [...ev.results[0]].map(a => a.transcript);
      // Se prueba cada versión de lo que entendió el celular hasta que una tenga sentido.
      let r = null;
      for(const a of alts){ r = lbEntender(a, true); if(r) break; }
      if(!r) r = lbEntender(alts[0]) || { texto: 'No te entendí: «' + alts[0] + '». Di por ejemplo: «Juan me debe 20 mil».' };
      lbResponder(r.texto);
    };
    rec.onerror = ev => { if(ev.error === 'not-allowed') lbResponder('Hay que darle permiso al micrófono en el navegador.'); else if(ev.error === 'no-speech') lbResponder('No te escuché. Toca otra vez y habla cerca del celular.'); };
    rec.onend = () => { rec = null; window.__lbMicOn = false; b.classList.remove('on'); b.textContent = '🎤 Toca y habla'; };
    // «Hola ORDEVA» suelta el micrófono y no lo vuelve a abrir mientras la libreta escucha.
    window.__lbMicOn = true;
    try{ window.speechSynthesis && window.speechSynthesis.cancel(); }catch(e){}
    try{ window.ventoHola && window.ventoHola.soltar(true); }catch(e){}
    try{ rec.start(); }catch(e){ rec = null; window.__lbMicOn = false; b.classList.remove('on'); b.textContent = '🎤 Toca y habla'; }
  }

  // ---------- Botón grande en el modo fácil ----------
  function lbFab(){
    let f = $l('libretaFab');
    if(!f){
      f = document.createElement('button'); f.type = 'button'; f.id = 'libretaFab'; f.textContent = '📒 Libreta';
      f.onclick = () => window.libretaAbrir();
      document.body.appendChild(f);
    }
    f.hidden = !(data && data.easyMode);
  }
  window.libretaFab = lbFab;
  const st = document.createElement('style');
  st.textContent =
    '.lb-modal{max-width:460px;max-height:92vh;overflow:auto}' +
    '.lb-mic{display:block;width:100%;padding:22px 12px;margin:6px 0 8px;border-radius:18px;border:0;font:700 24px system-ui;background:var(--amber,#c8a24a);color:#1a1410;cursor:pointer}' +
    '.lb-mic.on{background:#c0392b;color:#fff;animation:lbPulso 1s infinite}@keyframes lbPulso{50%{transform:scale(.97)}}' +
    '.lb-ej{font-size:14px;text-align:center;opacity:.8;line-height:1.5;margin-bottom:8px}' +
    '.lb-resp{font-size:19px;font-weight:700;padding:14px;border-radius:14px;background:rgba(200,162,74,.15);margin:8px 0;line-height:1.4}' +
    '.lb-btns{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:10px 0}' +
    '.lb-calc-btn{display:block;width:100%;padding:14px;border-radius:14px;border:2px solid var(--amber,#c8a24a);background:transparent;color:inherit;font:700 17px system-ui;cursor:pointer;margin-bottom:8px}' +
    '.lb-calc{background:rgba(127,127,127,.10);border-radius:16px;padding:12px;margin-bottom:10px;animation:mzIn .2s ease-out}' +
    '.lb-calc-pant{background:rgba(0,0,0,.25);border-radius:12px;padding:16px 14px;text-align:right;font:800 32px system-ui;margin-bottom:10px;overflow-x:auto;white-space:nowrap}' +
    '.lb-calc-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}' +
    '.lb-calc-grid button{padding:18px 4px;border-radius:14px;border:0;background:rgba(127,127,127,.18);color:inherit;font:700 22px system-ui;cursor:pointer}' +
    '.lb-calc-grid .lb-calc-op{background:var(--amber,#c8a24a);color:#1a1410}' +
    '.lb-calc-grid .lb-calc-ig{background:#27ae60;color:#fff;grid-column:span 2}' +
    '.lb-calc-grid .lb-calc-0{grid-column:span 1}' +
    '.lb-b{padding:16px 6px;border-radius:14px;border:2px solid var(--line,#555);background:transparent;color:inherit;font:700 16px system-ui;line-height:1.25;cursor:pointer}' +
    '.lb-debe{border-color:#c0392b}.lb-abono{border-color:#27ae60}.lb-emp{border-color:#2980b9}.lb-prov{border-color:#8e44ad}.lb-pdeb{border-color:#d35400}' +
    '.lb-form{padding:12px;border-radius:14px;background:rgba(127,127,127,.12);display:flex;flex-direction:column;gap:8px}.lb-form-t{font-weight:700;font-size:17px}' +
    '.lb-form input{font-size:20px!important;padding:12px!important}.lb-form-a{display:flex;gap:8px}.lb-form-a button{flex:1;padding:14px;font-size:18px}' +
    '.lb-sec{margin-top:14px}.lb-sec-t{font-size:17px;font-weight:700;margin-bottom:6px;display:flex;justify-content:space-between}' +
    '.lb-fila{display:flex;align-items:center;gap:8px;padding:10px 4px;border-top:1px solid var(--line,#444);font-size:18px}.lb-fila span{flex:1}.lb-fila small{display:block;font-size:12px;opacity:.65}' +
    '.lb-deudor{cursor:pointer}.lb-hist{margin:0 0 8px 10px;padding:6px 10px;border-left:3px solid var(--amber,#c8a24a);background:rgba(127,127,127,.08);border-radius:0 10px 10px 0;animation:mzIn .25s ease-out}' +
    '.lb-ev{display:flex;gap:8px;padding:6px 0;font-size:15px}.lb-ev span{flex:1}.lb-ev small{display:block;font-size:12px;opacity:.65}' +
    '.lb-mov{font-size:15px}.lb-x{background:none;border:0;font-size:18px;cursor:pointer;padding:4px}.lb-vacio{opacity:.7;padding:8px 4px}' +
    '#libretaFab{position:fixed;right:14px;bottom:92px;z-index:55;padding:16px 20px;border-radius:30px;border:0;font:800 20px system-ui;background:var(--amber,#c8a24a);color:#1a1410;box-shadow:0 6px 18px rgba(0,0,0,.35);cursor:pointer}';
  document.head.appendChild(st);
  // Se muestra el botón cuando cargan los datos (y se revisa por si cambian el modo fácil).
  const t0 = setInterval(() => { if(typeof data !== 'undefined' && data){ lbFab(); } }, 1500);
  setTimeout(() => clearInterval(t0), 120000);
})();
