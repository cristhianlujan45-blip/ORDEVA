/* ORDEVA · app/14-verificacion-pagos-nequi.js — antes estaba dentro de index.html (línea 29408). Se carga en el mismo lugar y orden. */
/* ==================== 💜 Verificación de pagos Nequi / Daviplata ====================
   Nequi y Daviplata no tienen una API pública para cuentas personales, así que la app no
   puede preguntarle al banco. Lo que sí llega al instante es la NOTIFICACIÓN en el celular del
   dueño («¡Te llegó plata! JUAN PÉREZ te envió $20.000»). Una app gratis (MacroDroid) la
   reenvía a un canal privado de ORDEVA y ORDEVA la lee aquí: avisa con voz, la guarda y la
   cruza con la mesa que debe ese valor o que dijo «Ya pagué por Nequi». */
/* 🔒 1.55.0: quién pagó («de»), el texto del banco («txt») y la explicación («fuente») de un aviso de pago ya NO viajan
   en los datos del negocio: el servidor los saca en cada guardado y solo se los da al dueño y al administrador
   («solamente el administrador puede ver lo del Nequi»). pagoDet(x) los busca: en el aviso (negocio sin la nube o
   versión anterior), en ESTE equipo (lo leyó aquí) o en el servidor (dueño y administrador). pagoHuella(texto) junta
   el mismo aviso que llega por dos caminos sin necesitar el texto. */
const PAGO_DET_KEY = 'vento-pagos-det';
let pagoDetSrv = {}, pagoDetPidiendo = false, pagoDetUlt = 0;
function pagoDetLocal(){ try{ return JSON.parse(localStorage.getItem(PAGO_DET_KEY) || '{}') || {}; }catch(e){ return {}; } }
function pagoDetGuardar(id, d){
  if(!id || !d || !(d.de || d.txt || d.fuente)) return;
  try{
    const m = pagoDetLocal(); m[id] = { de: String(d.de || '').slice(0, 120), txt: String(d.txt || '').slice(0, 300), fuente: String(d.fuente || '').slice(0, 300), t: Date.now() };
    const ks = Object.keys(m); if(ks.length > 300) ks.sort((a, b) => (m[a].t || 0) - (m[b].t || 0)).slice(0, ks.length - 300).forEach(k => delete m[k]);
    localStorage.setItem(PAGO_DET_KEY, JSON.stringify(m));
  }catch(e){}
}
function pagoDetJefe(){ try{ const n = window.ventoNube && window.ventoNube.negocio && window.ventoNube.negocio(); return !!n && (n.rol === 'dueno' || n.rol === 'admin'); }catch(e){ return false; } }
function pagoDetPedir(){
  if(pagoDetPidiendo || !pagoDetJefe() || Date.now() - pagoDetUlt < 20000) return;
  const n = window.ventoNube.negocio(); pagoDetPidiendo = true; pagoDetUlt = Date.now();
  window.ventoNube.cliente().then(c => c.rpc('pago_avisos_detalle_de', { p_negocio: n.id }))
    .then(r => { if(r && !r.error && r.data && typeof r.data === 'object'){ pagoDetSrv = r.data; try{ window.pgRepintar && window.pgRepintar(); }catch(e){} } })
    .catch(() => {}).then(() => { pagoDetPidiendo = false; });
}
function pagoDet(x){
  if(!x) return { de: '', txt: '', fuente: '' };
  const l = x.id ? (pagoDetLocal()[x.id] || null) : null, s = x.id ? (pagoDetSrv[x.id] || null) : null;
  let c = null; try{ const pc = x.srv && window.ventoPagos && window.ventoPagos._cache; c = (pc && pc[x.srv]) || null; }catch(e){}
  if(!x.de && !x.txt && !l && !s && pagoDetJefe()) pagoDetPedir();
  return { de: x.de || (l && l.de) || (s && s.de) || (c && c.pagador) || '', txt: x.txt || (l && l.txt) || (s && s.txt) || '', fuente: x.fuente || (l && l.fuente) || (s && s.fuente) || (c && c.detalle) || '' };
}
function pagoHuella(t){
  const s = String(t || '').slice(0, 200).replace(/^\s*[^|]*\|/, '').replace(/\s+/g, ' ').trim(); let h = 2166136261;
  for(let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return s ? h.toString(36) : '';
}
(function(){
  const $p = id => document.getElementById(id);
  const plata = n => '$' + Math.round(n || 0).toLocaleString('es-CO');
  const escp = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const PG = () => {
    if(!data.pagos) data.pagos = { on: false, topic: '', lista: [], vistos: [], espera: {} };
    const g = data.pagos;
    // Canal PROPIO y secreto (no el de los QR de las mesas, que ven los clientes).
    if(!g.topic) g.topic = 'mesorapago' + Array.from(crypto.getRandomValues(new Uint8Array(14)), b => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join('');
    if(!g.espera) g.espera = {};
    return g;
  };
  const url = () => 'https://canal.vento.local/' + PG().topic;
  // La dirección para MacroDroid (afuera de la app): el canal en el servidor de ORDEVA.
  const urlExterna = () => (window.ventoCanal && window.ventoCanal.url(PG().topic)) || '';

  // ---------- Leer la notificación ----------
  const APPS = [[/daviplata/i, 'DaviPlata'], [/nequi/i, 'Nequi'], [/bancolombia/i, 'Bancolombia'], [/movii/i, 'Movii'], [/\bdale\b/i, 'Dale'], [/davivienda/i, 'Davivienda'], [/bre-?b/i, 'Bre-B']];
  const PG_NUNCA = /solicitud|(?:te|le) pide|(?:te|le) pidi[oó]|(?:te|le) cobr|cobro pendiente|rechazad|fall[oó]|no se pudo|reversad|programad/i;
  const PG_FUERTE = /(?:te|le) (?:envi[oó]|enviaron|pas[oó]|pasaron|transfiri[oó]|transfirieron|consign[oó]|consignaron|mand[oó]|mandaron|gir[oó]|giraron|pag[oó]|pagaron)|(?:recibiste|recibi[oó]|ha recibido|has recibido)\s+(?:\$|cop|\d|una transferencia|un pago|dinero|plata)|transferencia recibida|pago recibido|a (?:tu|su) llave|(?:te|le) lleg[oó]\s+(?:\$|cop|\d|plata|dinero)/i;
  // 1.55.1: plata que llega como «Recarga desde Bancolombia» (transferencia de un banco a Nequi). Nunca la recarga de un
  // celular, una fallida o pendiente, ni «Recarga tu Nequi…» (la misma regla de la app Android: AvisoPago.RECARGA).
  const PG_RECARGA = /recarga(?:ste)?\b[^|\n]{0,60}?\b(?:(?:desde|de|por|con)\s+(?:tu\s+|su\s+)?(?:cuenta\s+(?:de\s+)?)?)?(?:bancolombia|davivienda|daviplata|bbva|scotiabank|colpatria|av villas|ita[uú]|banco\s+(?:de\s+)?\w+|pse|otr[oa]s?\s+(?:entidad|banco))\b|recibiste\s+una\s+recarga|(?:te|le)\s+recargaron|\brecarga\s+(?:exitosa|realizada|recibida|aprobada|confirmada)\b|\brecargaste\s+(?:\$|cop)\s?\d|\brecarg(?:amos|ado|ada|[oó]|aron)(?![a-zñ])[^|\n]{0,40}?(?:\$|cop)\s?\d|(?:nequi|cuenta|daviplata)\s+(?:fue|ha sido|se)\s+recarg|\brecarg[oó]\s+(?:tu|su)\s+(?:nequi|cuenta|daviplata)/i;
  const PG_RECARGA_NO = /\brecarga\s+(?:tu|su)\b|celular|minutos|paquete|recarga(?:ste)?\s+(?:de\s+)?(?:datos|plan|m[oó]vil)\b|\b(?:claro|tigo|movistar|wom|virgin|etb|avantel|kalley)\b|(?:a|al|para)\s+(?:el\s+)?(?:n[uú]mero\s+)?(?:\+?57\s?)?3\d{2}\s?\d{3}\s?\d{4}|fallid|no exitosa|pendiente|compraste|compra de|\b(?:tullave|transmilenio|sitp|c[ií]vica|peaje|flypass)\b/i;
  const PG_PROMO = /¿|pr[eé]stamo|te prestamos|le prestamos|cr[eé]dito (?:de libre|pre|para|f[aá]cil|aprobado|express|r[aá]pido)|tarjeta de cr[eé]dito|colch[oó]n|oferta|promo|descuento|cashback|sorteo|particip|\bgan(?:a|e|ar)\b|aprovecha|beneficio|invit|hasta \$|\bcupo\b|activa tu|desc[aá]rga/i;
  // ---------- Voz de los pagos con su propio volumen (Ajustes → Pagos) ----------
  // En la app Android la dice la voz de pagos de Android (canal de la alarma, al volumen elegido; más de 100 % = reforzada,
  // más fuerte de lo normal). En el navegador, la voz del navegador (hasta 100 %).
  const PG_VOL_KEY = 'vento_pagos_vol';
  // De fábrica 100 % = la alarma del celular al MÁXIMO, dicha directo por el motor de voz: lo que suena en TODOS los
  // celulares. (1.50.0: en la 1.49.0 era 130 % y la página se lo mandaba también a las apps sin actualizar: con la voz de
  // Google o Samsung eso grababa la frase a un archivo antes de tocarla, y en varios celulares el pago quedaba callado.)
  const pgVol = () => { try{ const v = Number(localStorage.getItem(PG_VOL_KEY)); return v >= 10 && v <= 150 ? v : 100; }catch(e){ return 100; } };
  window.ventoPagosVolumen = pgVol;
  // «🗣️ Decir los pagos en voz alta» (Ajustes → Pagos): prendido de fábrica. Apagado: llegan con notificación y ventana.
  const PG_VOZ_KEY = 'vento_pagos_voz';
  const pgVozOn = v => {
    if(v === undefined){ try{ return localStorage.getItem(PG_VOZ_KEY) !== '0'; }catch(e){ return true; } }
    try{ localStorage.setItem(PG_VOZ_KEY, v ? '1' : '0'); }catch(e){}
    try{ const A = window.VentoAndroid; A && A.pagosVozOn && A.pagosVozOn(!!v); }catch(e){}
    return !!v;
  };
  try{ const A = window.VentoAndroid; if(A && A.pagosVozOn) A.pagosVozOn(pgVozOn()); }catch(e){}
  window.ventoPagosVozOn = pgVozOn;
  window.ventoDecirPago = function(frase){
    if(!pgVozOn()) return;
    if(window.ventoPagoSuenaAqui && !window.ventoPagoSuenaAqui()) return;   // el administrador eligió que aquí no suenen
    const A = window.VentoAndroid;
    if(A && A.pagosDecir){ try{ A.pagosDecir(String(frase)); return; }catch(e){} }
    try{ speakVoice(frase, { volumen: Math.min(1, pgVol() / 100) }); }catch(e){}
  };
  function pgLeer(txt){
    const t = String(txt || '').replace(/\s+/g, ' ').trim();
    if(!t) return null;
    // Nequi habla de «tú» («Te llegó plata»); DaviPlata y varios bancos de «usted» («Le llegó plata», «Le pasaron»,
    // «Recibió», «Ha recibido»). Antes solo se entendía la forma de «tú» y los avisos de DaviPlata no salían.
    const recibido = /(recibiste|has recibido|ha recibido|(?:te|le) lleg(?:[oó]|aron)|(?:te|le) pas(?:[oó]|aron)|pasaron plata|(?:te|le) envi(?:[oó]|aron)|(?:te|le) transfiri(?:[oó]|eron)|(?:te|le) pag(?:[oó]|aron)|(?:te|le) consign|(?:te|le) abon|consignaron|abonaron|entr[oó] plata|lleg[oó] plata|ingres[oó]|recibi[oó]|recepci[oó]n|pago recibido|dinero recibido|transferencia recibida|abono a (?:tu|su) cuenta|(?:te|le) mand(?:o|ó|aron)|(?:te|le) gir(?:o|ó|aron)|(?:te|le) deposit|dep[oó]sito recibido|(?:te|le|se) acredit|acredit\w*\s+(?:a|en)\s+(?:tu|su)\s+(?:cuenta|llave|nequi|daviplata)|lleg(?:o|ó|aron)\s+(?:\$|cop|plata|dinero)|a (?:tu|su) llave|(?:recib|lleg|entr|ingres)[^.]{0,40}bre-?b|bre-?b[^.]{0,40}(?:recib|lleg|entr|ingres)|entr[oó] dinero|lleg[oó] dinero|transferencia entrante|abono recibido|abono (?:por|de|bre-?b)\s|ingreso de (?:\$|cop|dinero|plata)|ingresaron|entrada de (?:dinero|plata)|recibiste un (?:pago|abono)|lleg[oó] una transferencia|(?:en|a) (?:tu|su) llave|(?:dinero|plata|transferencia|abono|pago)\s+(?:de|desde)\s+otr[oa]s?\s+(?:entidad|banco)|interbancari\w*\s+recibid|(?:tienes|tiene)\s+(?:un\s+)?(?:nuevo\s+)?(?:abono|ingreso|dep[oó]sito)|nuevo\s+(?:abono|ingreso))/i.test(t) || (PG_RECARGA.test(t) && !PG_RECARGA_NO.test(t));
    // Códigos de seguridad: nunca son un pago (la misma regla de la app Android: AvisoPago.CODIGO).
    if(/c[oó]digo (?:de )?(?:seguridad|verificaci|acceso|confirmaci)|clave din[aá]mica|\botp\b|tu c[oó]digo es|es tu c[oó]digo/i.test(t)) return null;
    const salida = /(enviaste|pagaste|pasaste|compra exitosa|transferiste|retiraste|compraste|sacaste|usted (?:envi|pag|transfiri|pas)|c[oó]digo|clave|otp|contrase)/i.test(t);
    const sale = /enviaste|pagaste|pasaste|compra exitosa|transferiste|retiraste|compraste|sacaste|usted (?:envi|pag|transfiri|pas)/i.test(t);
    // Un pago de verdad puede traer «nunca compartas tu clave»: con una frase fuerte de plata recibida sigue siendo pago.
    if(!recibido || salida && !/(recibiste|recibi[oó]|ha recibido|(?:te|le) lleg)/i.test(t) && !(PG_FUERTE.test(t) && !sale)) return null;
    // Publicidad del banco que se parece a un pago («¿Te llegó la prima?…», «Te prestamos hasta $5.000.000»): NO es plata
    // que llegó (la misma regla de la app Android: AvisoPago.PROMO).
    // Solicitudes y cobros («JUAN te pidió $20.000»), rechazados o fallidos: nunca son plata que llegó.
    if(PG_NUNCA.test(t)) return null;
    // Un «¿…?» o «bolsillo» junto a un pago de verdad («te envió $20.000. ¿La guardas?») no lo vuelve publicidad.
    if(PG_PROMO.test(t) && !PG_FUERTE.test(t)) return null;
    // Con signo ($20.000), «COP 20.000» o sin él («Recibiste 25.000 pesos», «transferencia por 30.000»)
    // Con signo ($20.000), «COP 20.000», «25.000 pesos» o sin signo como el SMS de DaviPlata («recibiste  100,000»,
    // «Recibiste 140,000.»). Un número de celular (10 cifras) no es el valor.
    const m = t.match(/(?:\$|\bCOP)\s?(\d{1,3}(?:[.,]\d{3})+|\d+)/i) || t.match(/(\d{1,3}(?:[.,]\d{3})+|\d+)\s*(?:pesos|cop)\b/i)
      || t.match(/\b(?:recibiste|recibi[oó]|has recibido|ha recibido|te llegaron|le llegaron|llegaron|abono de|ingreso de|por|de|(?:te|le)\s+(?:envi[oó]|enviaron|pas[oó]|pasaron|mand[oó]|mandaron|transfiri[oó]|transfirieron|consign[oó]|consignaron|gir[oó]|giraron|pag[oó]|pagaron))\s+(\d{1,3}(?:[.,]\d{3})+(?![.,]?\d)|\d{1,7}(?!\d|[.,]\d))(?!\s*(?:%|min|seg|horas?|d[ií]as?|veces))/i);
    if(!m) return null;
    const monto = Number(m[1].replace(/[.,]/g, ''));
    if(!(monto > 0)) return null;
    const app = (APPS.find(([re]) => re.test(t)) || [0, 'Transferencia'])[1];
    const NOM = "[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ'.]+(?:\\s+[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ'.]+){0,3}";
    let de = (t.match(new RegExp('(' + NOM + ')\\s+(?:te|le)\\s+(?:envi|transfiri|pag|pas|consign|abon|mand|gir)')) || [])[1]
          || (t.match(new RegExp('\\bde\\s+(' + NOM + ')')) || [])[1] || '';
    if(/^(nequi|daviplata|bancolombia|tu|su|la|el|le|dinero|plata|recibiste|te|usted)$/i.test(de.split(' ')[0])) de = '';
    de = de.split(' ').map(x => x.charAt(0).toUpperCase() + x.slice(1).toLowerCase()).join(' ');
    return { monto, app, de, breb: /bre-?b|\bllave\b/i.test(t) };
  }

  // ---------- ¿De qué mesa es? ----------
  function pgMesaPara(monto){
    // La mesa que está «⏳ Esperando el pago», la que se está cobrando, el valor exacto, la propina o el abono
    // (lib/vento-confirma.js). Con dos mesas que deben lo mismo y nada que las distinga: ninguna (se pregunta).
    try{ if(window.ventoConfirma) return window.ventoConfirma.mesaPara(monto); }catch(e){}
    const g = PG(), ahora = Date.now(), cands = [];
    Object.keys(data.tables || {}).forEach(id => {
      const t = data.tables[id]; if(!t || !(t.items || []).length) return;
      const saldo = tableTotal(id) - tablePaid(id);
      if(saldo === monto || tableTotal(id) === monto) cands.push({ id, avisada: !!(g.espera[id] && ahora - g.espera[id] < 3600e3) });
    });
    cands.sort((a, b) => b.avisada - a.avisada);
    return cands[0] ? cands[0].id : null;
  }
  // ---------- ¿Qué tan confiable es el aviso? ----------
  // MacroDroid manda «origen | título | texto». Una notificación de la APP del banco solo la puede
  // mostrar esa app instalada en tu celular: un tercero no la puede falsificar → confirmado.
  // Un SMS lo puede mandar cualquiera: si viene de un celular común (los bancos escriben desde
  // códigos cortos de 5-6 dígitos) es falso; si viene de un código corto, hay que mirarlo en la app.
  const PG_APPS_SMS = /^(sms|mensajes?|messages?|google messages|mensajes de samsung|samsung messages|mensajes de texto|textra)$/i;
  function pgFuente(txt){
    const partes = String(txt || '').split('|').map(x => x.trim());
    const origen = partes[0] || '', t1 = partes[1] || '';
    const esSms = PG_APPS_SMS.test(origen) || /^sms$/i.test(t1);
    if(!esSms){
      if(/nequi|daviplata|bancolombia|davivienda|movii|\bdale\b|bre-?b|banco|\bnu\b|lulo|rappipay|powwi|ual[aá]|bbva|scotiabank|av villas|colpatria|occidente|popular|caja social|ita[uú]|bogot[aá]|pibank|coltefinanciera|bancam[ií]a|mibanco|falabella|finandina|serfinanza|confiar|global66|ban100|coomeva|cooperativa|tpaga|transfiya|\bbold\b|agrario|gnb|sudameris/i.test(origen)) return { nivel: 'app', txt: 'Confirmado por la app de ' + origen };
      return { nivel: 'revisar', txt: 'Aviso de «' + (origen || 'otra app') + '»: confírmalo en la app del banco' };
    }
    const quien = /^sms$/i.test(t1) ? '' : t1;
    const dig = quien.replace(/\D/g, '');
    if(dig.length >= 7) return { nivel: 'falso', txt: 'SMS desde un número de celular (' + quien + '): los bancos no escriben desde celulares' };
    return { nivel: 'revisar', txt: 'Llegó por SMS' + (quien ? ' (' + quien + ')' : '') + ': confírmalo en la app del banco antes de entregar' };
  }
  const pgConfirmado = x => !x.estado || x.estado === 'app' || x.estado === 'ok';
  // ¿El aviso llegó por SMS? («origen | remitente | texto»)
  const pgEsSms = t => { const pz = String(t || '').split('|').map(y => y.trim()); return PG_APPS_SMS.test(pz[0] || '') || /^sms$/i.test(pz[1] || ''); };
  const pgEsSmsX = x => x.sms != null ? !!x.sms : pgEsSms(pagoDet(x).txt);
  // op.voz: la app Android ya dijo «Pago confirmado…» y sacó el aviso del celular (aquí no se repite).
  // ---------- 🪟 Ventana emergente de cada pago (dentro de ORDEVA) ----------
  // El valor grande, por qué banco, de quién y el texto, con «✕ Cerrar»; se cierra sola a los 15 s. Fuera de ORDEVA (otra
  // app abierta o el celular bloqueado) la muestra la app Android (VentanaPago). Si llegan varios pagos, sale el último y
  // dice cuántos más llegaron.
  const PG_VENT_KEY = 'vento_pagos_ventana', PG_VENT_MS = 15000;
  function pgVentanaOn(v){
    if(v === undefined){ try{ return localStorage.getItem(PG_VENT_KEY) !== '0'; }catch(e){ return true; } }
    try{ localStorage.setItem(PG_VENT_KEY, v ? '1' : '0'); }catch(e){}
    try{ const A = window.VentoAndroid; A && A.ventanaPagoOn && A.ventanaPagoOn(!!v); }catch(e){}
    return !!v;
  }
  function pgVentanaPermisos(){
    const box = $p('pgVentPerm'); if(!box) return;
    const A = window.VentoAndroid; let e = null; try{ e = A && A.ventanaPagoEstado ? JSON.parse(A.ventanaPagoEstado() || '{}') : null; }catch(x){}
    if(!e || !pgVentanaOn()){ box.innerHTML = A && !A.ventanaPagoEstado ? '📲 Para que salga también fuera de ORDEVA y con el celular bloqueado, <a href="' + APK + '" download="vento.apk" rel="noopener">instala la app nueva</a>.' : ''; return; }
    box.innerHTML = (e.encima ? '✅ Sale encima de otras apps.' : '⚠️ Para que salga encima de otras apps: <button type="button" class="btn-ghost" data-vperm="encima" style="padding:4px 10px">🪟 Permitir</button>') + '<br>' +
      (e.completa ? '✅ Sale con el celular bloqueado.' : '⚠️ Para que salga con el celular bloqueado: <button type="button" class="btn-ghost" data-vperm="completa" style="padding:4px 10px">🔒 Permitir</button>') +
      // Xiaomi / Redmi / POCO: dos permisos propios que vienen apagados (sin ellos la ventana no sale).
      (e.xiaomi ? '<br>' + (e.segundoPlano === true && e.bloqueo === true ? '✅ Xiaomi: ventanas en segundo plano y en la pantalla de bloqueo.' :
        '⚠️ En Xiaomi activa también <b>«Mostrar ventanas emergentes mientras se ejecuta en segundo plano»</b> y <b>«Mostrar en pantalla de bloqueo»</b>: <button type="button" class="btn-ghost" data-vperm="xiaomi" style="padding:4px 10px">📱 Abrir permisos</button>') : '');
  }
  try{ const A = window.VentoAndroid; if(A && A.ventanaPagoOn) A.ventanaPagoOn(pgVentanaOn()); }catch(e){}
  let pgVentT = null, pgVentTic = null, pgVentN = 0;
  function pgVentanaCerrar(){ clearTimeout(pgVentT); clearInterval(pgVentTic); pgVentN = 0; const v = document.getElementById('pgVentana'); if(v) v.remove(); }
  function pgVentana(d){
    if(!pgVentanaOn() || !d) return;
    let ov = document.getElementById('pgVentana');
    pgVentN = ov ? pgVentN + 1 : 0;
    if(!ov){
      ov = document.createElement('div'); ov.id = 'pgVentana'; ov.setAttribute('role', 'alertdialog'); ov.setAttribute('aria-label', 'Pago recibido');
      ov.style.cssText = 'position:fixed;inset:0;z-index:10050;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,.45)';
      ov.addEventListener('click', e => { if(e.target === ov || e.target.closest('[data-pv="cerrar"]')) pgVentanaCerrar(); });
      document.body.appendChild(ov);
    }
    const falso = d.nivel === 'falso', revisar = d.nivel === 'revisar', sinValor = !(d.monto > 0);
    const color = falso ? '#dc2626' : revisar ? '#d97706' : '#7c3aed';
    const titulo = falso ? '🚨 Pago FALSO' : revisar ? '⚠️ Revisa este pago' : sinValor ? '💜 Llegó plata' : '💜 Recibiste';
    ov.innerHTML = '<div class="pg-vent" style="width:100%;max-width:380px;background:#fff;color:#111827;border:3px solid ' + color + ';border-radius:22px;padding:18px 20px 16px;text-align:center;box-shadow:0 18px 50px rgba(0,0,0,.4)">' +
      '<div style="font-size:20px;font-weight:800;color:' + color + '">' + titulo + '</div>' +
      (sinValor ? '' : '<div class="pg-vent-valor" style="font-size:46px;font-weight:900;line-height:1.1;margin-top:2px">' + escp(plata(d.monto)) + '</div>') +
      '<div style="font-size:19px;font-weight:700;color:#374151">por ' + escp((d.breb ? 'Bre-B en ' : '') + (d.app || 'transferencia')) + '</div>' +
      (d.de ? '<div style="font-size:16px;color:#374151;margin-top:4px">de ' + escp(d.de) + '</div>' : '') +
      (d.mesa ? '<div style="font-size:16px;color:#374151;margin-top:2px">' + escp(d.mesa) + '</div>' : '') +
      (d.txt ? '<div style="font-size:14px;color:#4b5563;margin-top:10px;max-height:5.6em;overflow:hidden">«' + escp(d.txt) + '»</div>' : '') +
      (pgVentN ? '<div style="font-size:13px;color:#6b7280;margin-top:6px">+' + pgVentN + ' pago' + (pgVentN === 1 ? '' : 's') + ' más (mira 💜 Pagos)</div>' : '') +
      '<div class="pg-vent-cuenta" style="font-size:13px;color:#6b7280;margin:10px 0 6px">Se cierra sola en 15 s</div>' +
      '<button type="button" data-pv="cerrar" style="width:100%;min-height:52px;border:0;border-radius:14px;background:' + color + ';color:#fff;font-size:18px;font-weight:800">✕ Cerrar</button></div>';
    clearTimeout(pgVentT); clearInterval(pgVentTic);
    const hasta = Date.now() + PG_VENT_MS;
    const tic = () => { const c = ov.querySelector('.pg-vent-cuenta'); if(c) c.textContent = 'Se cierra sola en ' + Math.max(0, Math.ceil((hasta - Date.now()) / 1000)) + ' s'; };
    tic(); pgVentTic = setInterval(tic, 1000);
    pgVentT = setTimeout(pgVentanaCerrar, PG_VENT_MS);
    try{ ov.querySelector('[data-pv="cerrar"]').focus({ preventScroll: true }); }catch(e){}
  }
  window.ventoPagoVentana = pgVentana;
  /** Notificación + ventana por la app Android (el mismo camino de los pagos que entiende la app). false si la app es vieja. */
  function pgNotificarAndroid(titulo, frase, orig, valor, banco, tipo){
    const A = window.VentoAndroid; if(!A || !A.pagoNotificar) return false;
    try{ A.pagoNotificar(String(titulo).slice(0, 80), String(frase || '').slice(0, 300), String(orig || '').slice(0, 220), String(valor || ''), String(banco || ''), tipo || 'ok'); return true; }catch(e){ return false; }
  }
  window.ventoPagoVentanaCerrar = pgVentanaCerrar;

  // ---------- 💜 Frases de pago del administrador (ORDEVA Admin) ----------
  // Cuando un banco cambia cómo escribe el aviso, el administrador agrega la frase en ORDEVA Admin («Abono a tu DaviPlata»
  // = es un pago; «Tu saldo es» = no es un pago) y le llega al instante a todos: la app la consulta justo cuando le llega
  // un aviso que no entiende (si la que tiene es de hace más de 10 s). Se guarda para usarla también sin internet.
  const PG_FR_KEY = 'vento-frases-pago';
  let pgFr = (() => { try{ const x = JSON.parse(localStorage.getItem(PG_FR_KEY) || 'null'); return x && Array.isArray(x.l) ? x : { v: 0, l: [], t: 0 }; }catch(e){ return { v: 0, l: [], t: 0 }; } })();
  let pgFrPidiendo = null;
  const pgNorm = t => { let x = String(t || '').toLowerCase(); try{ x = x.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }catch(e){} return x.replace(/\s+/g, ' ').trim(); };
  function pgFrasesCfg(){ try{ return window.ventoServidorCfg ? window.ventoServidorCfg() : null; }catch(e){ return null; } }
  function pgFrasesCargar(){
    const c = pgFrasesCfg(); if(!c) return Promise.resolve(pgFr);
    if(pgFrPidiendo) return pgFrPidiendo;
    pgFrPidiendo = fetch(c.url + '/rest/v1/rpc/frases_pago_lista', { method: 'POST', headers: { apikey: c.key, Authorization: 'Bearer ' + c.key, 'Content-Type': 'application/json' }, body: '{}', cache: 'no-store' })
      .then(r => r.ok ? r.json() : null).then(j => {
        if(j && Array.isArray(j.l)){ pgFr = { v: j.v || 0, l: j.l.filter(x => x && x.t), t: Date.now() }; try{ localStorage.setItem(PG_FR_KEY, JSON.stringify(pgFr)); }catch(e){} }
        else pgFr.t = Date.now();
        return pgFr;
      }).catch(() => { pgFr.t = Date.now(); return pgFr; }).then(x => { pgFrPidiendo = null; return x; });
    return pgFrPidiendo;
  }
  window.ventoFrasesPago = { cargar: pgFrasesCargar, lista: () => pgFr.l.slice(), poner: l => { pgFr = { v: Date.now(), l: (l || []).filter(x => x && x.t), t: Date.now() }; } };
  setTimeout(() => { if(pgFrasesCfg()) pgFrasesCargar(); }, 6000);
  setInterval(() => { if(pgFrasesCfg() && document.visibilityState === 'visible') pgFrasesCargar(); }, 10 * 60e3);
  /** ¿El aviso trae una frase del administrador? {ignorar} o {monto, app, de, breb, frase} (monto 0 = plata sin valor). */
  function pgFrase(txt){
    if(!pgFr.l.length) return null;
    const t = String(txt || ''), n = pgNorm(t);
    const ign = pgFr.l.find(x => x.tipo === 'ignorar' && n.includes(pgNorm(x.t)));
    if(ign) return { ignorar: true, frase: ign.t };
    const r = pgFr.l.find(x => x.tipo !== 'ignorar' && n.includes(pgNorm(x.t)));
    if(!r) return null;
    const m = t.match(/(?:\$|\bCOP)\s?(\d{1,3}(?:[.,]\d{3})+|\d+)/i) || t.match(/(\d{1,3}(?:[.,]\d{3})+|\d+)\s*(?:pesos|cop)\b/i) || t.match(/(?:^|[^\d.,])(\d{1,3}(?:[.,]\d{3})+)(?![.,]?\d)/);
    const monto = m ? Number(m[1].replace(/[.,]/g, '')) || 0 : 0;
    const origen = (t.split('|')[0] || '').trim();
    const app = r.banco || (APPS.find(([re]) => re.test(t)) || [])[1] || (origen && !/^sms$/i.test(origen) ? origen : '') || 'Transferencia';
    return { monto, app, de: '', breb: /bre-?b|\bllaves?\b/i.test(t), frase: r.t };
  }
  window.pagosFrase = pgFrase;

  // Cada equipo tiene su marca: así se sabe qué pagos leyó ESTE equipo (la lista de pagos se copia a los demás).
  const pgEq = (() => { try{ let v = localStorage.getItem('vento_pagos_eq'); if(!v){ v = Date.now().toString(36) + Math.random().toString(36).slice(2, 8); localStorage.setItem('vento_pagos_eq', v); } return v; }catch(e){ return 'm' + Math.random().toString(36).slice(2, 10); } })();
  window.ventoPagosEquipo = () => pgEq;
  // ---------- 1.58.2: el aviso SIN valor también llega a los demás equipos ----------
  // La llave Bre-B a DaviPlata avisa «Recibiste plata de otra entidad usando Llaves» SIN el valor (el valor llega
  // después por el SMS 85888, o no llega si el celular no lee los SMS). El servidor solo guarda pagos con valor, así que
  // el computador y las tablets no se enteraban. Ahora el celular que lo leyó (y lo dijo) lo manda por el canal de pagos
  // del negocio y los demás equipos dicen «Llegó plata por Bre-B, en DaviPlata. Mira el valor en la aplicación.» con su
  // ventana. Cuando llegue el valor, llega como siempre por el servidor. Cada equipo lo dice una vez; lo de hace más de
  // 3 min no (al reconectarse el canal repite lo de los últimos 15 min); solo el dueño y los administradores.
  const pgSvMios = new Set(), PG_SV_VISTOS = 'ordeva-sinvalor-vistos';
  function pgSinValorCompartir(app, txt, id, op){
    try{
      if(!String(id || '').startsWith('and-') || !(op && op.voz) || !PG().topic) return;      // solo lo que este celular leyó y dijo
      const j = { id: String(id).slice(0, 120), app: String(app || 'el banco').slice(0, 40), txt: String(txt).split('|').slice(1).join(' · ').trim().slice(0, 220), breb: /llaves|bre-?b/i.test(String(txt)), t: Date.now() };
      pgSvMios.add(j.id);
      fetch(url(), { method: 'POST', headers: { Title: 'ordeva-sinvalor' }, body: JSON.stringify(j) }).catch(() => {});
    }catch(e){}
  }
  function pgSinValorRemoto(m){
    if(!m || m.title !== 'ordeva-sinvalor') return false;               // no es de estos: sigue el camino de siempre
    try{
      const j = JSON.parse(m.message || '{}');
      if(!j.id || pgSvMios.has(j.id) || !data || !data.pagos || !data.pagos.on) return true;
      if(!(Math.abs(Date.now() - (+j.t || 0)) < 180e3)) return true;
      let vistos = []; try{ vistos = JSON.parse(localStorage.getItem(PG_SV_VISTOS) || '[]'); }catch(e){}
      if(vistos.includes(j.id)) return true;
      vistos.push(j.id); try{ localStorage.setItem(PG_SV_VISTOS, JSON.stringify(vistos.slice(-60))); }catch(e){}
      let jefe = true; try{ jefe = !window.ventoRoles || window.ventoRoles.esJefe(); }catch(e){}
      if(!jefe) return true;
      const app = String(j.app || 'el banco'), por = (j.breb ? 'Bre-B, en ' : '') + app;
      const frase = 'Llegó plata por ' + por + '. Mira el valor en la aplicación.';
      try{ showToast('💜 Llegó plata por ' + por + ' (el aviso no trae el valor). Mira el valor en la app del banco.', 12000); }catch(e){}
      try{ const A = window.VentoAndroid; if(A && A.alFrente ? A.alFrente() : document.visibilityState === 'visible') pgVentana({ monto: 0, app, txt: String(j.txt || '').slice(0, 220), nivel: 'app' }); }catch(e){}
      try{ window.ventoDecirPago(frase); }catch(e){}
      try{ pgNotificarAndroid('💜 Llegó plata por ' + (j.breb ? 'Bre-B en ' : '') + app, frase, String(j.txt || '').slice(0, 220), '', (j.breb ? 'Bre-B en ' : '') + app, 'sinvalor'); }catch(e){}
    }catch(e){}
    return true;
  }
  function pgRecibir(txt, id, op){
    op = op || {};
    const g = PG();
    if(id){ if(g.vistos.includes(id)) return; g.vistos.push(id); g.vistos = g.vistos.slice(-300); }
    const fr = pgFrase(txt);
    if(fr && fr.ignorar){ saveData(); return; }                 // el administrador dijo que esa frase NO es un pago
    let p = pgLeer(txt);
    if(!p && fr && fr.monto > 0) p = fr;
    // No se entendió: si las frases del administrador son de hace más de 10 s, se piden ya y se vuelve a revisar (así
    // una frase que se acaba de agregar en ORDEVA Admin sirve para este mismo aviso).
    if(!p && !fr && !op.frasesOk && String(id || '').startsWith('and-') && pgFrasesCfg() && Date.now() - (pgFr.t || 0) > 10e3){
      g.vistos = g.vistos.filter(x => x !== id);
      pgFrasesCargar().then(() => pgRecibir(txt, id, Object.assign({}, op, { frasesOk: true })));
      return;
    }
    if(!p && fr){
      // Frase de pago del administrador, pero el aviso no trae el valor: se avisa sin el valor.
      try{ showToast('💜 Llegó plata por ' + fr.app + ' (el aviso no trae el valor). Mira el valor en la app del banco.', 12000); }catch(e){}
      try{ const A = window.VentoAndroid; if(A && A.alFrente ? A.alFrente() : document.visibilityState === 'visible') pgVentana({ monto: 0, app: fr.app, txt: String(txt).split('|').slice(1).join(' · ').trim().slice(0, 220), nivel: 'app' }); }catch(e){}
      if(!op.voz) window.ventoDecirPago('Llegó plata por ' + fr.app + '. Mira el valor en la aplicación.');
      if(!op.voz) pgNotificarAndroid('💜 Llegó plata por ' + fr.app, 'Llegó plata por ' + fr.app + '. Mira el valor en la aplicación.', String(txt).split('|').slice(1).join(' · ').trim().slice(0, 220), '', fr.app, 'sinvalor');
      try{ window.ventoConfirma && window.ventoConfirma.sinValor(fr.app, txt); }catch(e){}   // ¿de qué mesa es? poner el valor con un toque
      pgSinValorCompartir(fr.app, txt, id, op);
      saveData(); return;
    }
    if(!p){
      // Un aviso de PLATA RECIBIDA del banco (ya filtrado por la app Android) que ORDEVA no supo leer: se reporta (sin
      // nombres ni valores) para enseñarle a ORDEVA ese formato, como pasó con los avisos de DaviPlata.
      // «Recibiste Plata … usando Llaves» (sin el valor): la app Android lo junta con el SMS del banco; no es un error.
      // Si no llega el SMS, se muestra qué mesa estaba esperando ese pago para confirmar el valor en la app del banco.
      if(String(id || '').startsWith('and-') && /(recibiste|lleg[oó]) (plata|dinero)|usando llaves/i.test(String(txt)) && !/\d/.test(String(txt).split('|').slice(1).join(' '))){
        try{ const ahora = Date.now(), esperan = Object.keys(data.tables || {}).filter(m => { const t = data.tables[m]; return t && (t.items || []).length && ((g.espera && g.espera[m] && ahora - g.espera[m] < 3600e3) || (t.cobrando && ahora - (t.cobrando.t || 0) < 30 * 60e3)); });
          const app0 = (String(txt).split('|')[0] || 'el banco').trim();
          showToast('💜 Llegó plata por ' + app0 + ' (el aviso no trae el valor)' + (esperan.length ? '. Estaba esperando el pago: ' + esperan.map(m => tableLabel(m) + ' (' + plata(tableTotal(m) - tablePaid(m)) + ')').join(', ') + '. Mira el valor en la app del banco y regístralo.' : '. Mira el valor en la app del banco.'), 12000); }catch(e){}
        try{ const A = window.VentoAndroid; if(A && A.alFrente ? A.alFrente() : document.visibilityState === 'visible') pgVentana({ monto: 0, app: (String(txt).split('|')[0] || 'el banco').trim(), txt: String(txt).split('|').slice(1).join(' · ').replace(/\s+/g, ' ').trim().slice(0, 220), nivel: 'app' }); }catch(e){}
        try{ window.ventoConfirma && window.ventoConfirma.sinValor((String(txt).split('|')[0] || 'el banco').trim(), txt); }catch(e){}
        pgSinValorCompartir((String(txt).split('|')[0] || 'el banco').trim(), txt, id, op);
      }
      if(String(id || '').startsWith('and-') && !/(recibiste|lleg[oó]) (plata|dinero)|usando llaves/i.test(String(txt))) try{ const pz = String(txt).split('|').map(x => x.trim());
        window.ventoError && window.ventoError('pago', 'Aviso de pago que ORDEVA no entendió (' + (pz[0] || 'app') + ')', { app: (pz[0] || '').slice(0, 40), texto: pz.slice(1).join(' | ').replace(/\b[A-ZÁÉÍÓÚÑ]{2,}(?:\s+[A-ZÁÉÍÓÚÑ]{2,})*\b/g, 'NOMBRE').replace(/\d[\d.,]*/g, '#').slice(0, 200) }, 'pago|no-entendido|' + (pz[0] || '').toLowerCase().slice(0, 30)); }catch(e){}
      return;
    }
    // Una sola vez: el MISMO aviso que llega por dos caminos (la app ORDEVA de este celular y MacroDroid) no se cuenta dos veces.
    // Por el mismo camino cada aviso ya trae su propio ID (dos clientes que pagan lo mismo sí son dos pagos).
    const via = String(id || '').startsWith('and-') ? 'and' : 'canal', mismo = String(txt).slice(0, 200).replace(/^\s*[^|]*\|/, '');
    const huella = pagoHuella(txt);
    if((g.lista || []).some(x => x.via && x.via !== via && Date.now() - (x.t || 0) < 3 * 60e3 && x.monto === p.monto && (x.th ? x.th === huella : String(pagoDet(x).txt || '').replace(/^\s*[^|]*\|/, '') === mismo))){ saveData(); return; }
    // ¿Ya llegó este mismo pago por el Servidor ORDEVA (otro celular lo reenvió)? Entonces no se repite.
    // Solo un pago que vino DEL servidor (otro celular lo reenvió): uno propio enlazado al servidor no cuenta. Antes, el
    // segundo pago igual al primero (mismo valor, en 3 min) se tomaba como repetido y no sonaba.
    const yaSrv = (g.lista || []).find(x => x.srv && String(x.id || '').startsWith('srv-') && Number(x.monto) === p.monto && Math.abs((x.t || 0) - Date.now()) < 3 * 60e3 && String(x.app).toLowerCase() === String(p.app).toLowerCase());
    if(yaSrv){ saveData(); return; }
    // op.revisar: la app Android vio que la app de ese banco NO es la oficial (instalada por fuera de la tienda): podría
    // mostrar pagos falsos, así que queda «⚠️ Revisar» y nunca «Pago confirmado».
    const f0 = pgFuente(txt);
    // op.smsOk: SMS del código corto del banco y el dueño eligió confirmarlos (Ajustes → Pagos). Nunca uno «falso».
    const f = op.revisar ? { nivel: 'revisar', txt: String(op.revisar) }
      : op.smsOk && f0.nivel === 'revisar' ? { nivel: 'app', txt: 'Confirmado por SMS del banco (elegiste confirmar los SMS del banco)' } : f0;
    // 📩 + 📱 El MISMO pago por SMS y por la app del banco → uno solo (uno con uno, en 5 min). Si el SMS llegó primero
    // («⚠️ Revisar»), el aviso de la app lo confirma solo; si llega después de la app, ya estaba confirmado.
    const sms = pgEsSms(txt);
    let silencio = false, delSms = null;
    if(!op.reemplaza && f.nivel !== 'falso'){
      const cerca = x => !x.par && x.estado !== 'falso' && Number(x.monto) === p.monto && Date.now() - (x.t || 0) < 5 * 60e3;
      if(sms){
        const app = (g.lista || []).find(x => cerca(x) && !pgEsSmsX(x) && pgConfirmado(x));
        if(app){ app.par = true; saveData(); pgPintar(); return; }
      } else if(f.nivel === 'app'){
        const i = (g.lista || []).findIndex(x => cerca(x) && pgEsSmsX(x));
        if(i >= 0){ delSms = g.lista.splice(i, 1)[0]; silencio = pgConfirmado(delSms); }
      }
    }
    // También al Servidor ORDEVA → a los demás equipos del negocio (celulares, computador, tablet), con lo que se entendió.
    try{ window.ventoPagosReenviarAviso && window.ventoPagosReenviarAviso(txt, id, { monto: p.monto, app: p.app, de: p.de, nivel: f.nivel }); }catch(e){}
    // op.reemplaza: este aviso de la app del banco es el MISMO pago que ya había llegado por SMS → se queda uno (confirmado).
    if(op.reemplaza){ const i = g.lista.findIndex(x => x.id === 'and-' + op.reemplaza); if(i >= 0) g.lista.splice(i, 1); }
    const mesa = f.nivel === 'falso' ? null : pgMesaPara(p.monto);
    const reg = { id: id || Date.now().toString(36), via, eq: pgEq, t: Date.now(), monto: p.monto, app: p.app, de: p.de, mesa: mesa ? Number(mesa) : null, estado: f.nivel, fuente: f.txt, txt: String(txt).slice(0, 200) };
    reg.sms = !!sms; reg.th = huella;
    if(delSms){ reg.par = true; reg.fuente = f.txt + ' (y el mensaje de texto del banco)'; if(delSms.aplicado){ reg.aplicado = delSms.aplicado; reg.mesa = delSms.mesa || reg.mesa; try{ const t = data.tables[delSms.aplicado]; ((t && t.payments) || []).forEach(q => { if(q.pagoDigital && q.pagoDigital.id === delSms.id) q.pagoDigital.id = reg.id; }); }catch(e){} } }
    pagoDetGuardar(reg.id, reg);                            // quién pagó y el texto quedan en ESTE equipo (el servidor los saca de los datos)
    g.lista.unshift(reg); g.lista = g.lista.slice(0, 200);
    if(mesa && f.nivel === 'app') delete g.espera[mesa];
    saveData();
    if(silencio){ pgPintar(); return; }                    // ya se había avisado con el SMS (el dueño confía en los SMS)
    // ⏳ «Esperando el pago» abierta en este equipo: la pantalla lo muestra y lo registra (no sale otra ventana encima).
    let enPantalla = false; try{ enPantalla = window.ventoConfirma ? window.ventoConfirma.llego(reg) : null; }catch(e){}
    if(enPantalla === 'junto'){                             // el valor de un pago que ya se registró «a mano»
      try{ showToast('✅ Llegó el valor: ' + plata(p.monto) + ' por ' + p.app + (reg.aplicado ? ' (ya estaba registrado en ' + tableLabel(reg.aplicado) + ')' : '') + '.', 7000); }catch(e){}
      pgPintar(); return;
    }
    // Por el canal (otro celular o MacroDroid): solo le sale y le suena al dueño, al administrador y a quien cobra o atiende
    // esa mesa. El celular que leyó el aviso del banco (via «and») siempre avisa: es el que recibe la plata.
    if(via !== 'and' && window.ventoPagoParaMi && !window.ventoPagoParaMi(p.monto, mesa)){ pgPintar(); return; }
    // Mesero, empleado o cajero: solo «✅ Mesa 3 ya pagó», sin el valor ni quién pagó (lo de Nequi lo ve el administrador).
    try{ if(via !== 'and' && window.ventoConfirma && window.ventoConfirma.mesero(reg)){ pgPintar(); return; } }catch(e){}
    // 🪟 La ventana con el valor, si ORDEVA se está viendo (fuera de ORDEVA la muestra la app Android).
    const origTxt = String(txt).split('|').slice(1).join(' · ').replace(/\s+/g, ' ').trim().slice(0, 220);
    try{ const A = window.VentoAndroid, viendo = A && A.alFrente ? !!A.alFrente() : document.visibilityState === 'visible';
      if(viendo && !enPantalla) pgVentana({ monto: p.monto, app: p.app, de: p.de, breb: p.breb, mesa: mesa ? tableLabel(mesa) : '', txt: origTxt, nivel: f.nivel }); }catch(e){}
    if(f.nivel === 'falso'){
      try{ showToast('🚨 OJO, PAGO FALSO: un SMS dice que llegaron ' + plata(p.monto) + ', pero ' + f.txt + '. No entregues nada.', 15000); }catch(e){}
      if(!op.voz) window.ventoDecirPago('Ojo. Llegó un mensaje de pago sospechoso por ' + p.monto + ' pesos. Parece falso. No entregues nada hasta revisar la aplicación del banco.');
      if(!op.voz) pgNotificarAndroid('🚨 Mensaje de pago FALSO: ' + plata(p.monto), 'Parece falso: ' + f.txt + '. No entregues nada.', origTxt, plata(p.monto), p.app, 'falso');
      if(navigator.vibrate) try{ navigator.vibrate([500, 150, 500, 150, 500]); }catch(e){}
      pgPintar(); return;
    }
    if(f.nivel === 'revisar'){
      try{ showToast('⚠️ ' + p.app + ': ' + plata(p.monto) + (p.de ? ' de ' + p.de : '') + (mesa ? ' (sería de ' + tableLabel(mesa) + ')' : '') + '. ' + f.txt + '. Luego toca «✅ Lo vi en la app».', 12000); }catch(e){}
      if(!op.voz) window.ventoDecirPago(op.revisar ? 'Ojo. Llegó un aviso de ' + p.monto + ' pesos de una aplicación que no es la oficial. Revísalo en la aplicación del banco antes de entregar.' : 'Llegó un aviso de ' + p.monto + ' pesos por mensaje de texto. Revísalo en la aplicación del banco antes de entregar.');
      if(!op.voz) pgNotificarAndroid('⚠️ Aviso de ' + plata(p.monto) + ': revísalo', f.txt, origTxt, plata(p.monto), p.app, 'revisar');
      if(navigator.vibrate) try{ navigator.vibrate([150, 80, 150]); }catch(e){}
      pgPintar(); return;
    }
    // Como el parlante de Bold: sonido de éxito y «Pago confirmado» en voz alta, con el valor y quién pagó.
    const msg = '✅ Pago confirmado · ' + plata(p.monto) + ' por ' + (p.breb ? 'Bre-B · ' : '') + p.app + (p.de ? ' de ' + p.de : '') + (mesa ? ' · ' + tableLabel(mesa) : '');
    try{ showToast(msg, 9000); }catch(e){}
    // Notificación del celular SIEMPRE (con ORDEVA abierta, cerrada o el celular bloqueado): el valor y el texto.
    // «💜 Recibiste $20.000 por Nequi» · «Recibiste 20000 pesos por Nequi, de Ana Ruiz. Mesa 3.» + lo que dijo el banco.
    // Con la app Android: por el MISMO camino que los pagos que entiende la app (notificación + 🪟 ventana fuera de ORDEVA,
    // también con el celular bloqueado). Antes un pago que entendía la página solo sacaba la notificación.
    if(!op.voz) try{ if(!window.ventoAvisoOn || window.ventoAvisoOn('pagos')){ const orig = origTxt;
      const tit = '💜 Recibiste ' + plata(p.monto) + ' por ' + (p.breb ? 'Bre-B en ' : '') + p.app, fr = 'Recibiste ' + p.monto + ' pesos por ' + p.app + (p.de ? ', de ' + p.de : '') + '.' + (mesa ? ' ' + tableLabel(mesa) + '.' : '');
      if(!pgNotificarAndroid(tit, fr, orig, plata(p.monto), (p.breb ? 'Bre-B en ' : '') + p.app, 'ok')) window.ventoAvisoCel && window.ventoAvisoCel(tit, fr + (orig ? '\n«' + orig + '»' : ''), 'pagos'); } }catch(e){}
    const suenaAqui = !window.ventoPagoSuenaAqui || window.ventoPagoSuenaAqui();
    if(suenaAqui) try{ window.ventoSonidos && window.ventoSonidos.success(); }catch(e){}
    // «Pago confirmado. 200 pesos desde DaviPlata» (o «desde Nequi»…), con quién pagó y la mesa si se sabe.
    // «Llegaron 3200 pesos por Nequi»: la cantidad siempre, sin el nombre de quién pagó (1.49.0).
    if(!op.voz) window.ventoDecirPago('Llegaron ' + p.monto + ' pesos ' + (p.breb ? 'por Bre-B, en ' : 'por ') + p.app + (mesa ? ', de la ' + tableLabel(mesa) : ''));
    if(navigator.vibrate && suenaAqui) try{ navigator.vibrate([150, 80, 150]); }catch(e){}
    try{ window.mesoraCelebrar && window.mesoraCelebrar(['💜', '💰', '✨']); }catch(e){}
    pgPintar();
    try{ window.pagoLlego && window.pagoLlego(reg); }catch(e){}    // ventana «Registrar en la mesa»
  }
  window.pagosFuente = pgFuente;
  window.pagosRecibirTexto = pgRecibir;   // también para pruebas

  // ---------- App Android: los avisos de plata recibida de DaviPlata/Nequi de ESTE celular, sin MacroDroid ----------
  // VentoEscucha (Android) los guarda en una cola y avisa; aquí se toman y siguen el mismo camino que los de MacroDroid
  // (voz, mesa que debe ese valor, Servidor ORDEVA → los demás celulares del negocio).
  const AND = () => window.VentoAndroid && window.VentoAndroid.pagosAvisosTomar ? window.VentoAndroid : null;
  const andEstado = () => { try{ return JSON.parse(AND().pagosAvisosEstado() || '{}'); }catch(e){ return {}; } };
  window.ventoAvisosNativos = function(){
    if(!AND() || typeof authUser === 'undefined' || !authUser || typeof data === 'undefined' || !data) return;
    let l = []; try{ l = JSON.parse(AND().pagosAvisosTomar() || '[]'); }catch(e){}
    l.forEach(a => { try{
      // Prueba piloto (Ajustes → Pagos): pasó por el mismo camino que un aviso de verdad, pero no se registra como pago.
      if(a && /^PRUEBA/.test(String(a.id || ''))){ const pp = pgLeer(a.txt); showToast('🧪 Prueba piloto: ' + (pp ? 'ORDEVA entendió ' + plata(pp.monto) + ' por ' + (pp.breb ? 'Bre-B · ' : '') + pp.app : 'aviso sin valor (espera el SMS)') + '. No se registró como pago.', 7000); return; }
      // a.crudo: la app Android no lo entendió y lo pasa tal cual; aquí se revisa con las reglas de la página (que siempre
      // están al día) y, si es plata recibida, se dice en voz alta («Recibiste … pesos por …»).
      if(a && a.txt) pgRecibir(a.txt, 'and-' + a.id, { voz: !!a.voz, revisar: a.revisar || '', smsOk: !!a.smsOk, reemplaza: a.reemplaza || '', crudo: !!a.crudo }); }catch(e){} });
    if(l.length) try{ pgPintar(); }catch(e){}
  };
  setInterval(() => window.ventoAvisosNativos(), 5000);

  // ---------- ¿Este celular sí está leyendo los avisos de pago? ----------
  // Al reinstalar la app Android se borran sus ajustes: la lectura quedaba APAGADA (o sin el permiso) y los pagos dejaban
  // de sonar sin que nadie lo notara. Con los pagos prendidos en ORDEVA, en el celular del dueño o del administrador:
  //  • la lectura se vuelve a prender sola (salvo que el dueño la haya apagado a propósito en Ajustes → Pagos);
  //  • si falta el permiso, Android desconectó la lectura o la app es vieja, sale un aviso fijo con el botón para arreglarlo.
  // (En el celular de un mesero o empleado no se prende sola: leería los avisos de su banco personal.)
  const PG_APK = 'https://github.com/cristhianlujan45-blip/ORDEVA/releases/latest/download/vento.apk';
  // 🔋 DaviPlata y Nequi con ahorro de batería («Optimizada»): Android retrasa SUS avisos de pago (llegan tarde o al
  // prender la pantalla) y ORDEVA los dice tarde. ORDEVA revisa cada app del banco instalada y abre su ajuste para elegir
  // «Sin restricciones». (Ninguna app puede cambiar eso por otra: lo elige el dueño con un toque.)
  const PG_BAT_LUEGO = 'vento-bancos-bat-luego';
  function pgBancosBat(){ const A = AND(); if(!A || !A.bancosBateria) return []; try{ const l = JSON.parse(A.bancosBateria() || '[]'); return Array.isArray(l) ? l : []; }catch(e){ return []; } }
  function pgBancoArreglar(pkg){
    const A = AND(), b = pgBancosBat().find(x => x.pkg === pkg); if(!A || !A.bancoAjustes || !b) return;
    A.bancoAjustes(pkg);
    showToast('En los ajustes de ' + b.nombre + ': toca «Batería» (o «Uso de batería» / «Ahorro de batería») y elige «Sin restricciones». Revisa también que «Notificaciones» esté prendido. Luego vuelve con atrás.', 14000);
  }
  window.ventoBancoArreglar = pgBancoArreglar;
  function pgBancosHtml(){
    const l = pgBancosBat(); if(!l.length) return '';
    return '<div class="pg-bancos-bat" style="margin-top:8px"><b>🔋 Que DaviPlata y Nequi avisen al instante</b><div style="opacity:.85;margin:2px 0 4px">Con ahorro de batería, Android retrasa los avisos de pago de esas apps. Elige <b>Sin restricciones</b> en cada una.</div>' +
      l.map(b => '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:4px 0">' + (b.sinRestriccion ? '✅ <b>' + escp(b.nombre) + '</b>: sin restricciones' : '⚠️ <b>' + escp(b.nombre) + '</b>: con ahorro de batería <button type="button" class="btn-ghost" data-banco="' + escp(b.pkg) + '" style="padding:5px 10px">🔋 Arreglar ' + escp(b.nombre) + '</button>') + '</div>').join('') + '</div>';
  }
  document.addEventListener('click', ev => { const x = ev.target.closest && ev.target.closest('[data-banco]'); if(x) pgBancoArreglar(x.dataset.banco); });
  let pgSinVivo = 0, pgSaludOculto = 0;
  const pgSaludRep = {};
  function pgSaludReportar(k, msg){
    const hoy = new Date().toDateString(); if(pgSaludRep[k] === hoy) return; pgSaludRep[k] = hoy;
    try{ window.ventoError && window.ventoError('pago', msg, { app: window.ventoAppVersion ? window.ventoAppVersion() : '' }, 'pago|lectura|' + k); }catch(e){}
  }
  function pgSalud(){
    const A = AND();
    let jefe = true; try{ jefe = !window.ventoRoles || window.ventoRoles.esJefe(); }catch(e){}
    if(!A || !jefe || typeof authUser === 'undefined' || !authUser || typeof data === 'undefined' || !data || !data.pagos || !data.pagos.on){ pgSaludPintar(''); return ''; }
    const g = PG();
    let e = andEstado();
    if(!e.on && !g.andOff){ try{ A.pagosAvisos(true); }catch(x){} e = andEstado(); pgSaludReportar('apagada', 'La lectura de avisos de pago estaba apagada en la app (se prendió sola)'); }
    pgSinVivo = e.permiso && e.vivo === false ? pgSinVivo + 1 : 0;
    let k = '';
    if(!e.on) k = '';
    else if(!A.pagosLectura) k = 'vieja';
    else if(e.permiso === false) k = 'permiso';
    else if(pgSinVivo >= 2) k = 'desconectada';
    if(k === 'permiso') pgSaludReportar('permiso', 'La app no tiene el permiso «Acceso a notificaciones»: los pagos no suenan');
    if(k === 'desconectada') pgSaludReportar('desconectada', 'Android desconectó la lectura de avisos de pago');
    if(k === 'vieja') pgSaludReportar('vieja', 'App Android vieja: no pasa a la página los avisos que no entiende');
    // Lo último: apps de banco con ahorro de batería (se puede dejar para «Luego»: 3 días).
    let lentos = [];
    if(!k && e.on){
      lentos = pgBancosBat().filter(b => !b.sinRestriccion);
      let luego = 0; try{ luego = Number(localStorage.getItem(PG_BAT_LUEGO)) || 0; }catch(x){}
      if(lentos.length){ pgSaludReportar('bateria-banco', 'Apps de banco con ahorro de batería (avisos de pago retrasados): ' + lentos.map(b => b.nombre).join(', ')); if(Date.now() > luego) k = 'bancos'; }
    }
    // Y la 🪟 ventana del pago fuera de ORDEVA: falta «encima de otras apps» o «pantalla completa» (celular bloqueado).
    // 1.65.7: también en los celulares que solo RECIBEN los pagos (antes solo en el que lee los avisos del banco): al
    // Xiaomi que recibía, usándolo, no le salía la ventana del pago y nunca se le pidió el permiso.
    let faltaVent = '';
    if(!k && A.ventanaPagoEstado && pgVentanaOn()){
      let v = {}; try{ v = JSON.parse(A.ventanaPagoEstado() || '{}'); }catch(x){}
      faltaVent = v.encima === false ? 'encima' : v.completa === false ? 'completa' : v.xiaomi && (v.segundoPlano === false || v.bloqueo === false) ? 'xiaomi' : '';
      let luego = 0; try{ luego = Number(localStorage.getItem('vento-ventana-luego')) || 0; }catch(x){}
      if(faltaVent) pgSaludReportar('ventana-' + faltaVent, 'Falta el permiso de la ventana del pago («' + faltaVent + '»): usando otra app o bloqueado no sale la ventana');
      if(faltaVent && Date.now() > luego) k = 'ventana';
    }
    pgSaludPintar(Date.now() < pgSaludOculto ? '' : k, lentos, faltaVent);
    return k;
  }
  function pgSaludPintar(k, lentos, faltaVent){
    let b = document.getElementById('pgSalud');
    if(!k){ if(b) b.hidden = true; return; }
    if(!b){
      b = document.createElement('div'); b.id = 'pgSalud'; b.setAttribute('role', 'alert');
      b.style.cssText = 'position:fixed;left:8px;right:8px;top:calc(8px + env(safe-area-inset-top,0px));z-index:9998;background:#7a1f1f;color:#fff;border-radius:14px;padding:10px 12px;font-size:14px;line-height:1.4;box-shadow:0 6px 20px rgba(0,0,0,.35)';
      b.addEventListener('click', ev => {
        const x = ev.target.closest('[data-pgs]'); if(!x) return;
        const A = AND(), a = x.dataset.pgs;
        if(a === 'cerrar'){ if(b.dataset.k === 'bancos' || b.dataset.k === 'ventana'){ try{ localStorage.setItem(b.dataset.k === 'bancos' ? PG_BAT_LUEGO : 'vento-ventana-luego', String(Date.now() + 3 * 864e5)); }catch(e){} } else pgSaludOculto = Date.now() + 3600e3; b.hidden = true; return; }
        if(a === 'vent-encima' || a === 'vent-completa' || a === 'vent-xiaomi'){ const c = a.slice(5); try{ A && A.ventanaPagoPermiso(c); }catch(e){} showToast(c === 'xiaomi' ? 'En «Otros permisos» activa «Mostrar ventanas emergentes mientras se ejecuta en segundo plano» y «Mostrar en pantalla de bloqueo», y vuelve.' : c === 'completa' ? 'Activa «ORDEVA» en «Notificaciones de pantalla completa» y vuelve.' : 'Activa «ORDEVA» en «Aparecer encima de otras apps» y vuelve.', 12000); return; }
        if(a === 'permiso' || a === 'reconectar'){ try{ A && A.mediosPermiso(); }catch(e){} if(a === 'reconectar') showToast('En la pantalla que se abre, APAGA «ORDEVA» y vuélvelo a PRENDER. Luego regresa.', 10000); }
      });
      document.body.appendChild(b);
    }
    const txt = {
      vieja: '📲 <b>Instala la app ORDEVA nueva una última vez</b>: desde esa versión se actualiza sola, sin instalar a mano.',
      permiso: '⚠️ <b>Los pagos no van a sonar:</b> ORDEVA no tiene el permiso «Acceso a notificaciones» en este celular.',
      desconectada: '⚠️ <b>Los pagos no van a sonar:</b> Android desconectó la lectura de avisos de ORDEVA.',
      ventana: faltaVent === 'xiaomi' ? '🪟 <b>Para que la ventana con el valor de cada pago se abra sola</b>, en Xiaomi activa «Mostrar ventanas emergentes mientras se ejecuta en segundo plano» y «Mostrar en pantalla de bloqueo».'
        : '🪟 <b>Para que la ventana con el valor de cada pago salga ' + (faltaVent === 'completa' ? 'con el celular bloqueado' : 'encima de otras apps') + '</b>, dale a ORDEVA un permiso.',
      bancos: '🔋 <b>' + (lentos || []).map(b => escp(b.nombre)).join(' y ') + '</b> ' + ((lentos || []).length > 1 ? 'tienen' : 'tiene') + ' ahorro de batería: Android puede retrasar sus avisos de pago. Elige <b>Sin restricciones</b>.'
    }[k];
    const btn = k === 'ventana' ? '<button type="button" data-pgs="vent-' + (faltaVent || 'encima') + '" style="background:#fff;color:#7a1f1f;border:0;border-radius:10px;padding:7px 12px;font-weight:800">' + (faltaVent === 'xiaomi' ? '📱 Abrir permisos' : '🪟 Permitir') + '</button>'
      : k === 'bancos' ? '<button type="button" data-banco="' + escp((lentos || [])[0] ? lentos[0].pkg : '') + '" style="background:#fff;color:#7a1f1f;border:0;border-radius:10px;padding:7px 12px;font-weight:800">🔋 Arreglar ' + escp((lentos || [])[0] ? lentos[0].nombre : '') + '</button>'
      : k === 'vieja' ? '<a href="' + PG_APK + '" download="vento.apk" rel="noopener" style="background:#fff;color:#7a1f1f;border-radius:10px;padding:7px 12px;font-weight:800;text-decoration:none">⬇️ Instalar la nueva</a>'
      : '<button type="button" data-pgs="' + (k === 'permiso' ? 'permiso' : 'reconectar') + '" style="background:#fff;color:#7a1f1f;border:0;border-radius:10px;padding:7px 12px;font-weight:800">' + (k === 'permiso' ? '🔓 Dar el permiso' : '🔄 Reconectar') + '</button>';
    b.innerHTML = '<div>' + txt + '</div><div style="display:flex;gap:8px;align-items:center;margin-top:8px;flex-wrap:wrap">' + btn + '<button type="button" data-pgs="cerrar" style="background:transparent;color:#fff;border:1px solid rgba(255,255,255,.6);border-radius:10px;padding:6px 10px">Luego</button></div>';
    b.dataset.k = k; b.hidden = false;
  }
  window.ventoPagosSalud = pgSalud;
  setTimeout(() => { try{ pgSalud(); }catch(e){} }, 4000);
  setInterval(() => { try{ pgSalud(); }catch(e){} }, 30000);
  document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'visible') try{ pgSalud(); }catch(e){} });
  window.pagosLeer = pgLeer;

  // La mesa avisó «Ya pagué por Nequi»: ¿ya llegó la plata?
  window.pagosVerificarMesa = function(mesa){
    if(!data || !data.pagos || !data.pagos.on) return;
    const g = PG(), saldo = tableTotal(mesa) - tablePaid(mesa), total = tableTotal(mesa);
    const cerca = x => Date.now() - x.t < 3600e3 && (x.monto === saldo || x.monto === total) && (!x.mesa || x.mesa === Number(mesa));
    const hay = g.lista.find(x => cerca(x) && pgConfirmado(x));
    const dudoso = !hay && g.lista.find(x => cerca(x) && x.estado === 'revisar');
    if(dudoso){
      g.espera[mesa] = Date.now(); saveData();
      setTimeout(() => { try{ showToast('⚠️ ' + tableLabel(mesa) + ' dice que pagó ' + plata(dudoso.monto) + ', pero solo llegó por SMS. Míralo en la app del banco y toca «✅ Lo vi en la app».', 10000); }catch(e){} }, 1500);
      return;
    }
    if(hay){
      hay.mesa = Number(mesa); saveData(); pgPintar();
      const m = '✅ Verificado: ' + tableLabel(mesa) + ' pagó ' + plata(hay.monto) + ' por ' + hay.app + (hay.de ? ' (' + hay.de + ')' : '') + '.';
      setTimeout(() => { try{ showToast(m, 9000); speakVoice(m.replace(/[✅$]/g, '')); }catch(e){} }, 1500);
    } else {
      g.espera[mesa] = Date.now(); saveData();
      setTimeout(() => { try{ showToast('⏳ ' + tableLabel(mesa) + ' dice que pagó por Nequi, pero todavía no ha llegado la notificación. Te aviso apenas llegue.', 8000); }catch(e){} }, 1500);
    }
  };

  // ---------- Escuchar el canal ----------
  let es = null, vivo = 0;
  function pgConectar(){
    if(!data || !data.pagos || !data.pagos.on) return;
    if(es && es.readyState !== 2 && Date.now() - vivo < 100000) return;
    try{ if(es) es.close(); }catch(e){}
    try{ es = new EventSource(url() + '/sse?since=15m'); }catch(e){ return; }
    vivo = Date.now();
    es.onmessage = ev => { vivo = Date.now(); try{ const m = JSON.parse(ev.data); if(m.event === 'message' && !pgSinValorRemoto(m)) pgRecibir((m.title ? m.title + ' | ' : '') + (m.message || ''), m.id); }catch(e){} };
    ['open', 'keepalive'].forEach(n => es.addEventListener(n, () => { vivo = Date.now(); }));
    pgPintar();
  }
  async function pgSondear(){
    if(!data || !data.pagos || !data.pagos.on) return;
    try{
      const r = await fetch(url() + '/json?poll=1&since=15m', { cache: 'no-store' });
      (await r.text()).split('\n').forEach(l => { if(!l.trim()) return; try{ const m = JSON.parse(l); if(m.event === 'message' && !pgSinValorRemoto(m)) pgRecibir((m.title ? m.title + ' | ' : '') + (m.message || ''), m.id); }catch(e){} });
    }catch(e){}
  }
  setInterval(pgConectar, 15000);
  setInterval(() => { if(document.visibilityState === 'visible') pgSondear(); }, 30000);
  document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'visible'){ pgConectar(); pgSondear(); } });

  // ---------- 📘 Paso a paso: agregar DaviPlata (o Nequi) para que ORDEVA avise «Pagaron $X» ----------
  // Para recibir los avisos NO hace falta convenio con Davivienda ni la API: la app ORDEVA para Android lee el aviso
  // que DaviPlata ya muestra en el celular («¡Le llegó plata!…») y lo convierte en «Pago confirmado» + el aviso del celular.
  const APK = 'https://github.com/cristhianlujan45-blip/ORDEVA/releases/latest/download/vento.apk';
  // Marca del celular (Xiaomi, Samsung…) y sus pasos para que no cierre ORDEVA (esas marcas cierran las apps de fondo).
  function pgMarca(){ try{ const A = window.VentoAndroid; const f = A && A.fabricante ? String(A.fabricante()) : ''; return f.split('|')[0] || ''; }catch(e){ return ''; } }
  function pgPasosMarca(){
    const m = (pgMarca() + ' ' + (navigator.userAgent || '')).toLowerCase();
    if(/xiaomi|redmi|poco/.test(m)) return '<li><b>Xiaomi / Redmi / POCO:</b> Ajustes → Apps → ORDEVA → <b>Inicio automático</b> ✅ y <b>Ahorro de batería → Sin restricciones</b>. En «Notificaciones», deja prendida <b>«Pantalla de bloqueo»</b>.</li>';
    if(/samsung/.test(m)) return '<li><b>Samsung:</b> Ajustes → Batería → Límites de uso en segundo plano → quita ORDEVA de «Apps en suspensión» y agrégala a <b>«Apps que nunca se suspenden»</b>.</li>';
    if(/oppo|realme|oneplus/.test(m)) return '<li><b>OPPO / realme / OnePlus:</b> Ajustes → Apps → ORDEVA → Uso de batería → <b>Permitir actividad en segundo plano</b> e <b>Inicio automático</b>.</li>';
    if(/vivo|iqoo/.test(m)) return '<li><b>vivo:</b> Ajustes → Batería → Consumo en segundo plano → ORDEVA → <b>Permitir</b>, y <b>Inicio automático</b> ✅.</li>';
    if(/huawei|honor/.test(m)) return '<li><b>Huawei / Honor:</b> Ajustes → Batería → Inicio de aplicaciones → ORDEVA → <b>Administrar manualmente</b> (todo prendido).</li>';
    if(/motorola|moto/.test(m)) return '<li><b>Motorola:</b> Ajustes → Apps → ORDEVA → Batería → <b>Sin restricciones</b>.</li>';
    return '';
  }
  // «🔎 Este equipo: …»: con un pantallazo se sabe si es la app o ORDEVA Web (y cuál navegador).
  function pgDondeEstoy(){
    const ua = navigator.userAgent || '';
    const ver = window.ventoAppVersion ? window.ventoAppVersion() : '';
    if(AND()) return 'App ORDEVA para Android' + (ver ? ' ' + ver : '') + (AND().pagosSmsConfiar ? '' : ' (no lee SMS: actualízala)');
    if(window.VentoAndroid) return 'App ORDEVA para Android' + (ver ? ' ' + ver : '') + ' — VIEJA: no lee los avisos de pagos, actualízala';
    if(window.ventoAppSinPuente && window.ventoAppSinPuente()) return 'App ORDEVA sin conexión con Android (ciérrala y ábrela otra vez)';
    const pc = /VentoPC\/([\d.]+)/.exec(ua);
    if(pc) return 'ORDEVA para PC ' + pc[1] + (/Windows/i.test(ua) ? ' (Windows)' : '');
    let nav = navigator.brave ? 'Brave' : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /EdgA?\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /MiuiBrowser|XiaoMi/.test(ua) ? 'navegador de Xiaomi' : /OPR\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'navegador';
    let inst = false; try{ inst = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; }catch(e){}
    return 'ORDEVA Web' + (inst ? ' instalada (acceso directo de ' + nav + ')' : ' en ' + nav) + (/Android/i.test(ua) ? ' · Android' : '');
  }
  function pgGuia(){
    let ov = $p('pgGuiaOv');
    if(!ov){ ov = document.createElement('div'); ov.className = 'overlay'; ov.id = 'pgGuiaOv'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Paso a paso: avisos de DaviPlata y Nequi'); document.body.appendChild(ov);
      ov.addEventListener('click', e => {
        if(e.target === ov || e.target.closest('[data-gp="cerrar"]')){ ov.classList.remove('show'); clearInterval(ov.__t); return; }
        const a = e.target.closest('[data-gp]'); if(!a) return;
        const k = a.dataset.gp, A = AND();
        if(k === 'abrirapp'){ try{ window.ventoAbrirApp(); }catch(x){} return; }
        if(k === 'prender'){ PG().on = true; PG().andOff = false; saveData(); try{ pgConectar(); }catch(x){} if(A && !andEstado().on){ A.pagosAvisos(true); if(!andEstado().permiso) try{ A.mediosPermiso(); }catch(x){} } try{ pgPintar(); }catch(x){} }
        if(k === 'permiso' && A) try{ A.mediosPermiso(); }catch(x){}
        if(k === 'bateria' && A) try{ A.ajustesBateria(); }catch(x){}
        if(k === 'autoinicio' && A) try{ A.abrirInicioAutomatico(); showToast('Busca «ORDEVA» en la lista y actívalo. Luego vuelve con el botón de atrás.', 8000); }catch(x){}
        if(k === 'probar'){ pgRecibir('DaviPlata | ¡Le llegó plata! | PRUEBA VENTO le pasó $1.000 a su DaviPlata', 'prueba-' + Date.now()); }
        if(k === 'macro'){ ov.classList.remove('show'); clearInterval(ov.__t); try{ pgPintar(); const d = $p('pgGrupo') && $p('pgGrupo').querySelector('details'); if(d){ d.open = true; d.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }catch(x){} }
        setTimeout(pintar, 400);
      }); }
    const ua = navigator.userAgent || '', A = AND(), iphone = /iPhone|iPad/.test(ua), android = /Android/.test(ua);
    function pintar(){
      const g = PG(), e = A ? andEstado() : {}, perm = (() => { try{ return A && A.permisos ? JSON.parse(A.permisos() || '{}') : {}; }catch(x){ return {}; } })();
      const llego = (g.lista || []).find(x => /davi/i.test(x.app) && !/PRUEBA VENTO/.test(x.txt || ''));
      const ok = (b, t) => '<span class="gp-e ' + (b ? 'gp-si' : 'gp-no') + '">' + (b ? '✅ ' : '⏳ ') + t + '</span>';
      const paso = (n, tit, cuerpo, estado) => '<li class="gp-paso"><div class="gp-n">' + n + '</div><div><b>' + tit + '</b>' + (estado || '') + '<div class="gp-c">' + cuerpo + '</div></div></li>';
      const html = '<div class="modal gp-modal"><h2>📘 Agregar DaviPlata (y Nequi) a ORDEVA</h2>' +
        '<div class="modal-sub">Así, cada vez que te pasen plata a tu DaviPlata o Nequi, ORDEVA te avisa <b>una sola vez</b>: «💜 Pagaron $20.000 por DaviPlata», lo dice en voz alta y te muestra de qué mesa es. <b>No necesitas convenio con Davivienda</b> ni ninguna clave del banco.</div>' +
        (iphone ? '<div class="gp-alerta">📱 En iPhone no se pueden leer los avisos de otras apps. Haz estos pasos en un <b>celular Android</b> que tenga DaviPlata (puede ser el del negocio). Este iPhone igual recibe los avisos.</div>' : '') +
        '<ol class="gp-lista">' +
        paso(1, 'Usa la app ORDEVA en el celular donde tienes DaviPlata', A ? 'Ya estás en la app ORDEVA para Android. 👍' + (window.ventoAppSinSms && window.ventoAppSinSms() ? '<br><small>Para que también lea los <b>SMS</b> del banco, actualízala: <a href="' + APK + '" download="vento.apk" rel="noopener">⬇️ vento.apk</a> (se instala encima, no se borra nada).</small>' : '')
          : window.ventoAppVieja && window.ventoAppVieja() ? '<b>Estás en la app ORDEVA, pero es una versión VIEJA' + (window.ventoAppVersion() ? ' (' + escp(window.ventoAppVersion()) + ')' : '') + '</b> que todavía no lee los avisos de pagos. Actualízala:' +
            '<br><a class="btn-primary gp-btn" href="' + APK + '" download="vento.apk" rel="noopener">⬇️ Descargar la app nueva (vento.apk)</a>' +
            '<ol style="margin:6px 0 0;padding-left:20px;line-height:1.5;font-size:14px"><li>Ábrela desde la notificación de la descarga o en <b>Archivos → Descargas</b>.</li><li>Si pregunta, <b>Configuración → Permitir de esta fuente</b>.</li><li>Toca <b>Actualizar</b> (no se borra nada) y luego <b>Abrir</b>.</li><li>Si dice <b>«No se instaló la app»</b> o <b>«conflicto con un paquete»</b>: revisa que entraste con tu correo (tu cuenta de ORDEVA), desinstala la ORDEVA vieja e instala la nueva; al entrar con tu correo vuelven tus datos.</li></ol>'
          : window.ventoAppSinPuente && window.ventoAppSinPuente() ? '⚠️ La app ORDEVA no cargó bien. Ciérrala del todo (quítala de las apps recientes) y ábrela otra vez.'
          : android ? '<b>Estás en ORDEVA Web</b> (el navegador o su acceso directo «ORDEVA Web»), no en la app. Los avisos de DaviPlata y Nequi <b>solo los puede leer la app ORDEVA</b> (el archivo <b>vento.apk</b>).' +
            '<br><b>¿Todavía no tienes la app?</b><br><a class="btn-primary gp-btn" href="' + APK + '" download="vento.apk" rel="noopener">⬇️ Descargar la app (vento.apk)</a>' +
            '<ol style="margin:6px 0 0;padding-left:20px;line-height:1.5;font-size:14px"><li>Toca el botón: se baja el archivo <b>vento.apk</b> (3,5 MB).</li><li>Ábrelo desde la notificación de la descarga o en <b>Archivos → Descargas</b>.</li><li>Si el celular pregunta, toca <b>Configuración → Permitir de esta fuente</b> y vuelve.</li><li>Toca <b>Instalar</b> (si ya la tenías, <b>Actualizar</b>: no se borra nada) y luego <b>Abrir</b>.</li><li>Entra con tu misma cuenta y vuelve a este paso a paso en la app (Ajustes → 💜 Pagos).</li></ol>' +
            '<b>¿Ya la tienes instalada?</b><br><button type="button" class="btn-ghost gp-btn" data-gp="abrirapp">📲 Abrir la app ORDEVA</button><br><small>De ahí en adelante abre siempre <b>la app</b> (ícono «ORDEVA»), no «ORDEVA Web».</small>'
          : '<a class="btn-primary gp-btn" href="' + APK + '" target="_blank" rel="noopener">📲 Descargar la app ORDEVA (Android)</a><br><small>Ábrela, entra con tu misma cuenta y vuelve a este paso a paso (Ajustes → 💜 Pagos).</small>',
          ok(!!A, A ? 'Listo' : window.ventoAppVieja && window.ventoAppVieja() ? 'App vieja: actualízala' : window.ventoAppSinPuente && window.ventoAppSinPuente() ? 'Ábrela de nuevo' : android ? 'Estás en ORDEVA Web' : 'Hazlo en el Android')) +
        paso(2, 'Prende «Recibir avisos de pagos»', 'ORDEVA empieza a escuchar los avisos de plata que te llegan.' + (g.on && (!A || e.on) ? '' : '<br><button type="button" class="btn-primary gp-btn" data-gp="prender">Prender ahora</button>'), ok(g.on && (!A || e.on), g.on && (!A || e.on) ? 'Prendido' : 'Apagado')) +
        paso(3, 'Dale a ORDEVA el permiso «Acceso a notificaciones»', 'Se abre una pantalla del celular: busca <b>ORDEVA</b> en la lista, actívalo y toca <b>Permitir</b>. Luego vuelve con el botón de atrás. ORDEVA solo toma los avisos de <b>plata recibida</b>: nunca códigos, claves ni compras.' + (A && !e.permiso ? '<br><button type="button" class="btn-primary gp-btn" data-gp="permiso">Abrir el permiso</button>' : ''), A ? ok(!!e.permiso, e.permiso ? 'Permiso dado' : 'Falta el permiso') : '') +
        paso(4, 'Deja prendidas las notificaciones de DaviPlata (y sin ahorro de batería)', 'En el celular: <b>Ajustes → Aplicaciones → DaviPlata → Notificaciones → Permitir</b> (todas). Abre DaviPlata una vez y entra con tu clave para que quede activa. Haz lo mismo con <b>Nequi</b> si también la usas.' + (A ? pgBancosHtml() : '') + ' <b>¿Tu banco te avisa por SMS?</b> La app también lee esos mensajes de texto (con el mismo permiso): mira «📩 Confirmar también los SMS del banco» en Ajustes → 💜 Pagos.', '') +
        paso(5, 'Que suene siempre: con la pantalla bloqueada o ORDEVA cerrada', 'Así «Pago confirmado» suena aunque el celular esté bloqueado o no hayas abierto ORDEVA.' +
          (A && perm.bateria === false ? '<br><b>1.</b> <button type="button" class="btn-primary gp-btn" data-gp="bateria">⚡ Quitar el ahorro de batería</button> (elige <b>Sin restricciones</b> / <b>Permitir</b>)' : A ? '<br>✅ Sin ahorro de batería.' : '') +
          (A && A.abrirInicioAutomatico ? '<br><b>' + (perm.bateria === false ? '2.' : '') + '</b> <button type="button" class="btn-ghost gp-btn" data-gp="autoinicio">🚀 Permitir «Inicio automático»</button>' + (pgMarca() ? ' <small>(' + escp(pgMarca()) + ')</small>' : '') : '') +
          (A ? '<ul style="margin:6px 0 0;padding-left:20px;font-size:14px;line-height:1.5">' + pgPasosMarca() + '<li>En las apps recientes, deja presionada ORDEVA y toca <b>🔒 Bloquear</b> (así el celular no la cierra al limpiar).</li><li>Deja ORDEVA abierta una vez después de instalarla: desde ahí trabaja sola de fondo (aviso fijo «ORDEVA está trabajando»).</li></ul>' : ''),
          A && perm.bateria !== undefined ? ok(!!perm.bateria, perm.bateria ? 'Listo' : 'Falta') : '') +
        paso(6, 'Prueba', 'Pídele a alguien que te pase <b>$1.000</b> a tu DaviPlata. ORDEVA dirá <i>«Recibiste 1000 pesos por DaviPlata»</i> y en el celular sale <b>«💜 Pagaron $1.000 por DaviPlata»</b>.<br><button type="button" class="btn-ghost gp-btn" data-gp="probar">▶️ Ver cómo se ve (simulado)</button>', ok(!!llego, llego ? 'Ya llegó un pago real de DaviPlata (' + plata(llego.monto) + ')' : 'Esperando el primer pago')) +
        '</ol>' +
        '<div class="settings-desc" style="margin-top:8px"><b>¿Y los demás celulares del negocio?</b> Con tu misma cuenta de ORDEVA también ven el pago al instante. <b>¿No usas la app ORDEVA en ese celular?</b> <button type="button" class="btn-ghost gp-btn" data-gp="macro">Usar MacroDroid</button><br><small>«Conectar DaviPlata» (API oficial) es otra cosa: sirve para <b>cobrar con código</b> y necesita convenio con Davivienda. Para que ORDEVA te avise los pagos <b>no lo necesitas</b>.</small></div>' +
        '<div class="settings-desc" style="margin-top:6px;opacity:.75"><small>🔎 Este equipo: ' + escp(pgDondeEstoy()) + '</small></div>' +
        '<div class="modal-actions"><button type="button" class="btn-close" data-gp="cerrar">Listo</button></div></div>';
      // Solo si algo cambió (el estado se revisa cada 3 s) y sin volver arriba: antes el paso a paso se rehacía cada 3 s y
      // mandaba al principio mientras uno bajaba.
      if(ov.__html === html) return;
      const sc = [ov, ov.firstElementChild].map(x => x ? x.scrollTop : 0);
      // El paso que se está viendo queda QUIETO en la pantalla aunque cambie lo de arriba (p. ej. llega el permiso y el
      // paso 3 se achica): antes se guardaba solo el número de desplazamiento y la pantalla se corría unos 60 px.
      const pasos0 = [...ov.querySelectorAll('.gp-paso')], arriba = ov.getBoundingClientRect().top;
      // Ancla: el primer paso que empieza dentro de la pantalla (el que se está leyendo); si ninguno, el que se ve a medias.
      let ia = pasos0.findIndex(x => x.getBoundingClientRect().top >= arriba);
      if(ia < 0) ia = pasos0.findIndex(x => x.getBoundingClientRect().bottom > arriba + 1);
      const ya = ia >= 0 ? pasos0[ia].getBoundingClientRect().top : 0;
      const repinta = !!ov.__html;
      ov.__html = html; ov.innerHTML = html;
      // Al repintar, la ventana NO vuelve a hacer su animación de entrada (se movía y la pantalla se corría).
      if(repinta && ov.firstElementChild) ov.firstElementChild.style.animation = 'none';
      [ov, ov.firstElementChild].forEach((x, n) => { if(x){ x.style.overflowAnchor = 'none'; if(sc[n]) x.scrollTop = sc[n]; } });
      const pa = ia >= 0 && (sc[0] || sc[1]) ? ov.querySelectorAll('.gp-paso')[ia] : null;
      if(pa){
        const el = sc[1] ? ov.firstElementChild : ov;
        const ajustar = () => { const d = pa.getBoundingClientRect().top - ya; if(Math.abs(d) > 0.5) el.scrollTop += d; };
        ajustar(); requestAnimationFrame(ajustar); setTimeout(ajustar, 150);   // y otra vez cuando termina de acomodarse
      }
    }
    pintar(); ov.classList.add('show');
    clearInterval(ov.__t); ov.__t = setInterval(() => { if(!ov.classList.contains('show')) return clearInterval(ov.__t); if(!ov.contains(document.activeElement) || document.activeElement === document.body) pintar(); }, 3000);
  }
  window.ventoPagosGuia = pgGuia;

  // ---------- Ajustes ----------
  function pgCrearUI(){
    if($p('pgGrupo')) return true;
    const ancla = $p('nequiOnToggle'); const grupo = ancla && ancla.closest('.settings-group');
    if(!grupo) return false;
    const g = document.createElement('div');
    g.className = 'settings-group'; g.id = 'pgGrupo'; g.hidden = true; g.dataset.cat = 'pagos';
    const enApp = !!AND();
    g.innerHTML = '<h2>🔔 Pagos de Nequi y DaviPlata al instante <span class="tvp-badge">Nuevo</span></h2>' +
      '<button type="button" class="btn-primary" id="pgGuiaBtn" style="width:100%;margin:2px 0 10px">📘 Paso a paso: agregar DaviPlata o Nequi</button>' +
      (enApp
        ? '<div class="settings-desc">Cuando te llega plata a <b>DaviPlata</b>, <b>Nequi</b> o tu banco, <b>la app de ORDEVA lee directamente el aviso del banco en este celular</b> y te dice en voz alta <b>«Pago confirmado»</b> con el valor, quién pagó y de qué mesa es (como el parlante de Bold). No necesitas instalar nada más.</div>'
        : '<div class="settings-desc">Para que ORDEVA te diga <b>«Pago confirmado»</b> apenas te llegue la plata, instala la <b>app ORDEVA para Android</b> en el celular donde tienes DaviPlata o Nequi y prende esta opción allí: la app lee directamente el aviso del banco. Desde el navegador no se pueden leer los avisos de otras apps. Los demás celulares del negocio reciben el aviso por tu cuenta de ORDEVA.</div>') +
      '<div class="settings-desc" id="pgWebAviso" hidden style="border:1px solid #f5a524;border-radius:12px;padding:10px"><b id="pgWebAvisoTit">📲 Estás en ORDEVA Web, no en la app.</b> Para que ORDEVA lea los avisos de DaviPlata y Nequi y diga «Pago confirmado» (también con el celular bloqueado), usa <b>la app ORDEVA</b> (archivo vento.apk) en este celular. <a class="btn-primary" id="pgBajarApk" href="https://github.com/cristhianlujan45-blip/ORDEVA/releases/latest/download/vento.apk" download="vento.apk" rel="noopener" style="margin-top:8px;width:100%;display:block;text-align:center;box-sizing:border-box">⬇️ Descargar la app (vento.apk)</a><button type="button" class="btn-ghost" id="pgAbrirApp" style="margin-top:8px;width:100%">📲 Ya la tengo: abrir la app ORDEVA</button></div>' +
      '<div class="settings-row"><div class="settings-row-text"><strong>Recibir avisos de pagos</strong><span id="pgEstado"></span></div><label class="switch"><input type="checkbox" id="pgOn"><span class="switch-slider"></span></label></div>' +
      '<div id="pgCaja" hidden>' +
      '<div class="settings-row" id="pgAlertas" style="flex-direction:column;align-items:stretch"></div>' +
      '<div class="settings-row" id="pgVolFila" style="flex-direction:column;align-items:stretch"><div class="settings-row-text"><strong>🔊 Volumen de la voz de los pagos: <span id="pgVolTxt"></span></strong><span>Qué tan alto dice «Llegaron 200 pesos por DaviPlata». ' + (enApp ? 'Suena a este volumen aunque la música o el celular estén bajitos, y luego deja el volumen como estaba. <b>Más de 100 % = más fuerte de lo normal.</b>' : 'En el navegador llega hasta 100 %; en la app Android se puede subir hasta 150 % (más fuerte de lo normal).') + '</span></div>' +
      '<input type="range" id="pgVol" min="10" max="' + (enApp ? 150 : 100) + '" step="10" style="width:100%;margin:6px 0" aria-label="Volumen de la voz de los pagos"><div class="mz-actions"><button class="btn-ghost" id="pgVolMenos" type="button">🔉 Más bajo</button><button class="btn-ghost" id="pgVolMas" type="button">🔊 Más alto</button><button class="btn-primary" id="pgVolProbar" type="button">▶ Probar la voz</button></div></div>' +
      '<div class="settings-row" id="pgVozFila"><div class="settings-row-text"><strong>🗣️ Decir los pagos en voz alta</strong><span>Prendido: cada pago que llega se dice con la cantidad («Llegaron 20000 pesos por Nequi»), en este equipo y en los demás de la cuenta, también con el celular bloqueado. Si primero llega el aviso de Bre-B sin el valor, se dice ese y luego el valor. Apagado: llegan con su notificación y su ventana, sin voz.</span></div><label class="switch"><input type="checkbox" id="pgVozOn" checked><span class="switch-slider"></span></label></div>' +
      '<div class="settings-row" id="pgChequeoFila"><div class="settings-row-text"><strong>🩺 ¿Les llegan los pagos a todos los equipos?</strong><span>Revisa este equipo (lectura de avisos, voz, servidor) y qué equipos de la cuenta están escuchando los pagos ahora mismo.</span></div><button class="btn-primary" id="pgChequeo" type="button">🩺 Revisar</button></div>' +
      '<div class="settings-row" id="pgVentFila" style="flex-direction:column;align-items:stretch"><div style="display:flex;align-items:center;gap:10px"><div class="settings-row-text" style="flex:1"><strong>🪟 Ventana emergente con el valor</strong><span>Cada pago sale en una ventana con el valor grande, el banco y el texto, con «Cerrar». Se cierra sola a los 15 s.' + (enApp ? ' También con el celular bloqueado o usando otra app.' : '') + '</span></div><label class="switch"><input type="checkbox" id="pgVentOn" checked><span class="switch-slider"></span></label></div>' +
      '<div id="pgVentPerm" style="font-size:14px;line-height:1.5;margin-top:6px"></div><div class="mz-actions"><button class="btn-ghost" id="pgVentProbar" type="button">▶ Probar la ventana</button></div></div>' +
      (enApp ? '<div class="settings-row" id="pgSmsFila"><div class="settings-row-text"><strong>📩 Confirmar también los SMS del banco</strong><span>Si tu banco te avisa por <b>mensaje de texto</b>, la app también lo lee (con el mismo permiso). <b>Apagado:</b> dice «Llegó un mensaje de texto de $X… revísalo en la app del banco». <b>Prendido:</b> dice «Pago confirmado» con los SMS que vienen del <b>número corto</b> del banco. Ojo: un SMS se puede falsificar; los que vienen de un número de celular siempre salen como 🚨 FALSO.</span></div><label class="switch"><input type="checkbox" id="pgSmsOk"><span class="switch-slider"></span></label></div>' : '') +
      (enApp ? '<div class="settings-row" id="pgAndFila"><div class="settings-row-text"><strong>📲 Leer los avisos de ESTE celular</strong><span id="pgAndTxt">ORDEVA toma directo los avisos de plata recibida de DaviPlata, Nequi y tu banco que llegan a este celular. Nunca toma códigos, claves ni compras.</span></div><label class="switch"><input type="checkbox" id="pgAndOn"><span class="switch-slider"></span></label></div>' : '') +
      '<details class="settings-desc"' + (enApp ? '' : ' open') + '><summary><b>' + (enApp ? 'Otro método, solo si en ese celular NO usas la app ORDEVA' : 'Sin la app ORDEVA: con MacroDroid') + '</b></summary>' +
      '<div class="settings-row" style="flex-direction:column;align-items:stretch"><div class="settings-row-text"><strong>Tu dirección privada de avisos</strong><span>No la compartas: quien la tenga podría mandarte avisos falsos.</span></div>' +
      '<input id="pgUrl" class="mz-in" style="width:100%" readonly onclick="this.select()"><div class="mz-actions"><button class="btn-primary" id="pgCopiar" type="button">📋 Copiar dirección</button><button class="btn-ghost" id="pgProbar" type="button">Probar</button><button class="btn-ghost" id="pgNueva" type="button">Cambiar dirección</button></div></div>' +
      '<div><b>Cómo configurarlo con MacroDroid (una vez):</b></div>' +
      '<ol style="margin:8px 0 0;padding-left:20px;line-height:1.55">' +
      '<li>Instala <b>MacroDroid</b> desde Play Store (gratis) y dale el permiso de <b>acceso a notificaciones</b> que te pide.</li>' +
      '<li>Toca <b>Añadir macro</b>. En <b>Disparadores</b> elige <b>Notificación → Notificación recibida</b>, marca las <b>apps</b> Nequi, DaviPlata (y Bancolombia si quieres) y deja «Cualquier contenido». <b>Usa las notificaciones de las apps, no los SMS:</b> esas solo las puede mostrar la app del banco, así que no se pueden falsificar.</li>' +
      '<li>En <b>Acciones</b> elige <b>Web / Conectividad → Solicitud HTTP</b>. Método <b>POST</b>. En URL pega la dirección de arriba.</li>' +
      '<li>En <b>Cuerpo del mensaje</b> (texto sin formato) usa el botón de <b>texto mágico</b> y agrega el <b>nombre de la app</b>, el <b>título de la notificación</b> y el <b>texto de la notificación</b>, separados por una raya «|».</li>' +
      '<li>Guarda la macro con el ✓. Pídele a alguien que te mande $1.000: acá debe salir el aviso. También puedes tocar <b>Probar</b>.</li></ol>' +
      '<p style="margin:8px 0 0"><b>Qué significa cada aviso:</b> ✅ <b>Confirmado</b> = llegó por la notificación de la app del banco. ⚠️ <b>Revisar</b> = llegó por SMS: míralo en la app y toca «Lo vi en la app». 🚨 <b>FALSO</b> = un SMS desde un número de celular común (los bancos escriben desde códigos cortos): no cuenta como pago y ORDEVA te avisa en voz alta.</p>' +
      '<p style="margin:8px 0 0">Si igual quieres reenviar los SMS, crea otra macro con el disparador <b>SMS recibido</b> y en el cuerpo pon: <b>SMS | [número que envía] | [texto del SMS]</b>. ORDEVA debe estar abierta en algún celular o computador para oír los avisos (en el negocio normalmente lo está).</p></details>' +
      '<div class="settings-row" style="flex-direction:column;align-items:stretch"><div class="settings-row-text"><strong>Últimos pagos que llegaron</strong></div><div id="pgLista"></div></div></div>';
    grupo.insertAdjacentElement('afterend', g);
    $p('pgGuiaBtn').onclick = pgGuia;
    $p('pgAbrirApp').onclick = () => { try{ window.ventoAbrirApp(); }catch(e){} };
    const smsOk = $p('pgSmsOk');
    if(smsOk){
      try{ smsOk.checked = !!(AND().pagosSmsConfiarActual && AND().pagosSmsConfiarActual()); }catch(e){}
      if(!(AND() && AND().pagosSmsConfiar)){ smsOk.disabled = true; smsOk.closest('.settings-row').querySelector('span').insertAdjacentHTML('beforeend', ' <b>Para leer los SMS instala la app nueva (Ajustes → Descargar la app).</b>'); }
      smsOk.onchange = () => {
        try{ AND().pagosSmsConfiar(smsOk.checked); }catch(e){}
        showToast(smsOk.checked ? '📩 Listo: los SMS del número corto del banco dicen «Pago confirmado». Los de un celular siguen saliendo como FALSO.' : '📩 Los SMS del banco dicen «revísalo en la app del banco».', 8000);
      };
    }
    const vol = $p('pgVol'), volMax = Number(vol.max);
    const volTxt = v => v + ' %' + (v > 100 ? ' · más fuerte de lo normal' : v === 100 ? ' · lo más alto del celular' : v <= 30 ? ' · bajito' : '');
    const volPoner = v => {
      v = Math.max(10, Math.min(volMax, Math.round(v / 10) * 10));
      try{ localStorage.setItem(PG_VOL_KEY, String(v)); }catch(e){}
      try{ const A = window.VentoAndroid; A && A.pagosVolumen && A.pagosVolumen(v); }catch(e){}
      vol.value = v; $p('pgVolTxt').textContent = volTxt(v);
      return v;
    };
    vol.oninput = () => { $p('pgVolTxt').textContent = volTxt(Number(vol.value)); };
    vol.onchange = () => { const v = volPoner(Number(vol.value)); showToast('🔊 Voz de los pagos: ' + volTxt(v) + '.'); };
    $p('pgVolMenos').onclick = () => { const v = volPoner(pgVol() - 10); showToast('🔉 Voz de los pagos: ' + volTxt(v) + '.'); };
    $p('pgVolMas').onclick = () => { const v = volPoner(pgVol() + 10); showToast('🔊 Voz de los pagos: ' + volTxt(v) + '.'); };
    $p('pgVolProbar').onclick = () => {
      const A = window.VentoAndroid;
      if(A && A.pagosProbarVoz){ try{ A.pagosProbarVoz(); return; }catch(e){} }
      window.ventoDecirPago('Llegaron 200 pesos por DaviPlata.');
    };
    $p('pgVozOn').onchange = () => { pgVozOn($p('pgVozOn').checked); showToast($p('pgVozOn').checked ? '🗣️ Los pagos se dicen en voz alta.' : '🔕 Voz de los pagos apagada: llegan con su notificación y su ventana.', 6000); };
    $p('pgChequeo').onclick = () => { try{ window.ventoPagosChequeo ? window.ventoPagosChequeo() : showToast('El chequeo necesita ORDEVA Nube (entrar con tu correo).'); }catch(e){} };
    $p('pgVentOn').onchange = () => { pgVentanaOn($p('pgVentOn').checked); pgVentanaPermisos(); showToast($p('pgVentOn').checked ? '🪟 Cada pago sale en una ventana con el valor (se cierra sola a los 15 s).' : '🪟 Ventana de pagos apagada: queda la notificación y la voz.', 6000); };
    $p('pgVentProbar').onclick = () => {
      pgVentana({ monto: 20000, app: 'Nequi', de: 'Ana Ruiz', txt: 'Prueba de ORDEVA', nivel: 'app' });
      const A = window.VentoAndroid; if(A && A.ventanaPagoProbar){ try{ A.ventanaPagoProbar(); showToast('▶ En 3 s sale también fuera de ORDEVA: sal a la pantalla de inicio o bloquea el celular para verla.', 7000); }catch(e){} }
    };
    $p('pgVentPerm').addEventListener('click', e => { const b = e.target.closest('[data-vperm]'); if(!b) return; try{ window.VentoAndroid.ventanaPagoPermiso(b.dataset.vperm); }catch(x){} showToast(b.dataset.vperm === 'xiaomi' ? 'En «Otros permisos» activa «Mostrar ventanas emergentes mientras se ejecuta en segundo plano» y «Mostrar en pantalla de bloqueo», y vuelve.' : b.dataset.vperm === 'completa' ? 'Activa «ORDEVA» (Permitir notificaciones de pantalla completa) y vuelve.' : 'Activa «ORDEVA» (Permitir aparecer encima de otras apps) y vuelve.', 9000); });
    const on = $p('pgOn');
    on.onchange = () => {
      PG().on = on.checked; saveData();
      if(on.checked){ pgConectar(); pgSondear(); } else { try{ es && es.close(); }catch(e){} es = null; }
      // En la app Android, prender los avisos = leer directo los avisos del banco de ESTE celular (sin MacroDroid).
      if(AND() && on.checked && !andEstado().on){ const a = $p('pgAndOn'); if(a){ a.checked = true; a.onchange(); return; } }
      pgPintar();
    };
    const andOn = $p('pgAndOn');
    if(andOn) andOn.onchange = () => {
      AND().pagosAvisos(andOn.checked);
      PG().andOff = !andOn.checked; saveData();   // apagada a propósito: no se vuelve a prender sola (ver pgSalud)
      try{ pgSalud(); }catch(e){}
      if(andOn.checked && !andEstado().permiso){
        showToast('Falta un permiso: en la pantalla que se abre, activa «ORDEVA» en «Acceso a notificaciones» y vuelve.', 9000);
        try{ AND().mediosPermiso(); }catch(e){}
      } else if(andOn.checked) showToast('✅ Listo: los avisos de plata que te lleguen a DaviPlata o Nequi en este celular aparecen en ORDEVA.', 7000);
      pgPintar();
    };
    $p('pgCopiar').onclick = async () => { try{ await navigator.clipboard.writeText(urlExterna()); showToast('📋 Dirección copiada. Pégala en MacroDroid (Solicitud HTTP → URL).', 7000); }catch(e){ $p('pgUrl').select(); showToast('Mantén presionada la dirección para copiarla.'); } };
    $p('pgProbar').onclick = async () => {
      try{ await fetch(url(), { method: 'POST', body: 'Nequi | ¡Te llegó plata! | PRUEBA VENTO te envió $1.000' }); showToast('Enviado. En unos segundos debe salir el aviso de $1.000.'); pgConectar(); setTimeout(pgSondear, 2500); }
      catch(e){ showToast('No se pudo enviar la prueba. Revisa el internet.'); }
    };
    $p('pgNueva').onclick = () => { if(!confirm('¿Cambiar la dirección? Tendrás que pegar la nueva en MacroDroid.')) return; PG().topic = ''; PG(); saveData(); try{ es && es.close(); }catch(e){} es = null; pgConectar(); pgPintar(); };
    return true;
  }
  // Avisos de apps de banco que hablaban de plata pero ORDEVA NO tomó como pago (vienen sin nombres ni números): se ven en
  // Ajustes → Pagos y se reportan para enseñarle a ORDEVA ese formato.
  const pgDiagVistos = new Set();
  // Cada aviso del banco que ORDEVA NO tomó como pago (o que no entendió) llega solo a 🐞 Errores del panel de
  // administrador, sin nombres ni valores, aunque nadie abra Ajustes → Pagos: así se ve qué llegó y por qué no sonó.
  function pgDiagReportar(){
    const A = AND(); if(!A || !A.pagosAvisosDiag) return null;
    let d = {}; try{ d = JSON.parse(A.pagosAvisosDiag() || '{}'); }catch(x){ return null; }
    const rep = (motivo, app, txt) => { const k = app + '|' + txt; if(pgDiagVistos.has(k)) return; pgDiagVistos.add(k);
      try{ window.ventoError && window.ventoError('pago', 'Aviso del banco que ORDEVA no tomó (' + String(app || 'app').slice(0, 30) + ': ' + motivo + ')', { app: String(app || '').slice(0, 40), texto: String(txt || '').slice(0, 220), motivo: String(motivo).slice(0, 80) }, 'pago|no-tomado|' + String(app || '').toLowerCase().slice(0, 30) + '|' + String(txt || '').slice(0, 60)); }catch(e){} };
    (Array.isArray(d.lista) ? d.lista : []).forEach(x => rep(x.motivo || '', x.app, x.txt));
    // Del registro: lo que se descartó (🚫), lo que no se entendió (❓) o se pasó crudo a la página (📤). Los de plata que
    // SALE y los códigos no se mandan (no son pagos).
    (Array.isArray(d.traza) ? d.traza : []).forEach(x => { const r = String(x.r || '');
      if(/^(🚫|❓|📤)/.test(r) && !/SALE|código de seguridad/.test(r)) rep(r.replace(/^\S+\s*/, ''), x.app, x.txt);
      if(/^🪟 la ventana no se abrió/.test(r)) rep(r.replace(/^\S+\s*/, '').replace(/\s*·\s*⏱.*$/, ''), 'Ventana del pago', x.txt);
      if(/^🔇/.test(r)) rep(r.replace(/^\S+\s*/, ''), 'Voz del pago', String(x.txt || '').replace(/\d[\d.,]*/g, '#'));
      // 1.55.4: ⏱ ¿De dónde viene la demora de un pago? (el banco lo mandó tarde o Vento lo leyó tarde) y 🧹 los que Android
      // no le pasó a ORDEVA (los tomó el barrido de la barra). Una vez por aviso (su hora), solo tiempos: sin valores ni nombres.
      const b = +((r.match(/el banco lo mandó (\d+) s tarde/) || [])[1] || 0), v = +((r.match(/Vento lo leyó (\d+) s después/) || [])[1] || 0);
      if((b >= 20 || v >= 5) && !pgDiagVistos.has('t' + x.t)){ pgDiagVistos.add('t' + x.t);
        try{ window.ventoError && window.ventoError('pago', 'Pago avisado tarde: ' + (b >= 20 ? 'el banco lo mandó ' + b + ' s tarde' : '') + (b >= 20 && v >= 5 ? ' y ' : '') + (v >= 5 ? 'Vento lo leyó ' + v + ' s después' : ''), { app: String(x.app || '').slice(0, 40), texto: String(x.txt || '').slice(0, 220), banco_s: b, vento_s: v, app_version: window.ventoAppVersion ? window.ventoAppVersion() : '' }, 'pago|demora|' + (b >= 20 ? 'banco' : 'vento')); }catch(e){} }
      if(/^🧹/.test(r) && !pgDiagVistos.has('t' + x.t)){ pgDiagVistos.add('t' + x.t);
        try{ window.ventoError && window.ventoError('pago', 'Android no le pasó el aviso del pago a ORDEVA: lo tomó el barrido de la barra', { app_version: window.ventoAppVersion ? window.ventoAppVersion() : '' }, 'pago|barrido'); }catch(e){} } });
    return d;
  }
  setInterval(() => { try{ pgDiagReportar(); }catch(e){} }, 60000);
  function pgDiagPintar(){
    const A = AND(); if(!A || !A.pagosAvisosDiag) return;
    const d = pgDiagReportar() || {};
    const l = Array.isArray(d.lista) ? d.lista : [];
    let box = document.getElementById('pgDiag');
    const ancla = $p('pgAndTxt'); if(!ancla) return;
    if(!box){ box = document.createElement('div'); box.id = 'pgDiag'; box.style.cssText = 'font-size:13px;line-height:1.45;margin-top:8px'; ancla.parentNode.insertBefore(box, ancla.nextSibling); }
    const ult = +d.ultimo || 0, tr = Array.isArray(d.traza) ? d.traza : [];
    const e0 = (() => { try{ return JSON.parse(A.pagosAvisosEstado() || '{}'); }catch(x){ return {}; } })();
    const ck = (ok, txt) => '<div>' + (ok ? '✅ ' : '❌ ') + txt + '</div>';
    const prueba = A.pagosPrueba ? '<details style="margin-top:8px" id="pgPilotoBox"><summary style="cursor:pointer;font-weight:700">🧪 Prueba piloto (que suene un pago de prueba)</summary>' +
      '<div style="opacity:.85;margin:4px 0">Pasa un aviso de prueba por el mismo camino que uno de verdad: debe sonar «Recibiste … pesos» y salir el aviso del celular. No se registra como pago.</div>' +
      ck(!!e0.on, 'Leer los avisos de este celular: ' + (e0.on ? 'prendido' : 'APAGADO (préndelo arriba)')) + ck(!!e0.permiso, 'Permiso «Acceso a notificaciones»') + ck(e0.vivo !== false, 'Android tiene conectada la lectura de avisos') +
      '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px"><button type="button" class="btn-ghost" data-piloto="davi">DaviPlata $1.000</button><button type="button" class="btn-ghost" data-piloto="nequi">Nequi $2.500</button><button type="button" class="btn-ghost" data-piloto="breb">Bre-B a DaviPlata + SMS $3.000</button></div><div id="pgPilotoRes" style="margin-top:6px;font-weight:700"></div></details>' : '';
    const traza = tr.length ? '<details style="margin-top:6px"><summary style="cursor:pointer;font-weight:700">📋 Últimos avisos del banco y qué hizo ORDEVA (' + tr.length + ')</summary>' +
      tr.slice().reverse().map(x => '<div style="padding:5px 0;border-top:1px solid var(--line)"><b>' + escp(x.r) + '</b><br><small style="opacity:.8">' + escp(x.app) + ' · ' + new Date(+x.t).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' · ' + escp(x.txt) + '</small></div>').join('') + '</details>' : '';
    const abiertos = [...box.querySelectorAll('details')].map(d => d.open);   // lo que estaba abierto sigue abierto
    box.innerHTML = pgBancosHtml() + prueba + traza + (ult ? '<div style="opacity:.8">📨 Último aviso de un banco en este celular: ' + new Date(ult).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + '</div>' : '') +
      (l.length ? '<details style="margin-top:6px"><summary style="cursor:pointer;font-weight:700">🔎 Avisos del banco que ORDEVA no tomó como pago (' + l.length + ')</summary>' +
        '<div style="opacity:.85;margin:4px 0">Sin nombres ni valores. Ya los mandamos a ORDEVA para aprender ese formato. Si uno de estos era un pago, revísalo en la app del banco.</div>' +
        l.slice().reverse().map(x => '<div style="padding:5px 0;border-top:1px solid var(--line)"><b>' + escp(x.app) + '</b> · ' + escp(x.motivo || '') + '<br><small style="opacity:.8">' + escp(x.txt) + '</small></div>').join('') + '</details>' : '');
    [...box.querySelectorAll('details')].forEach((d, i) => { if(abiertos[i]) d.open = true; });
    box.querySelectorAll('[data-piloto]').forEach(b => { b.onclick = () => {
      const k = b.dataset.piloto, res = document.getElementById('pgPilotoRes');
      const correr = (app, tit, txt, sms) => { try{ return JSON.parse(A.pagosPrueba(app, tit, txt, !!sms) || '{}'); }catch(x){ return { ok: false, r: 'error' }; } };
      let r;
      if(k === 'davi') r = correr('DaviPlata', 'DaviPlata', '¡Le llegó plata! JUAN PEREZ le pasó $1.000 a su DaviPlata');
      else if(k === 'nequi') r = correr('Nequi', 'Nequi', '¡Te llegó plata! ANA RUIZ te envió $2.500');
      else { r = correr('DaviPlata', 'DaviPlata', 'Transaccion exitosa: Recibiste Plata de otra entidad usando Llaves, consulta el detalle de tus movimientos desde el app DaviPlata.');
        setTimeout(() => { const r2 = correr('', '85888', 'Recibiste  3,000. Para saber mas, consulta tus movimientos.', true); if(res) res.textContent = (r2.r || '') + ' · (si no sonó, mira el registro de abajo)'; pgDiagPintar(); }, 2500); }
      if(res) res.textContent = (r.r || (r.ok ? '✅' : '❌ no se tomó')) + (k === 'breb' ? ' · ahora llega el SMS con el valor…' : '');
      setTimeout(pgDiagPintar, 600);
    }; });
  }
  window.ventoPagosDiag = () => { try{ pgDiagPintar(); }catch(e){} };
  // Con Ajustes → Pagos a la vista, el registro de avisos se actualiza solo (cada 4 s).
  setInterval(() => { const b = document.getElementById('pgDiag'); if(b && b.offsetParent) try{ pgDiagPintar(); }catch(e){} }, 4000);
  setInterval(() => { const b = document.getElementById('pgAlertas'); if(b && b.offsetParent) try{ pgAlertasPintar(); }catch(e){} }, 4000);
  window.pgRepintar = () => { try{ pgPintar(); }catch(e){} };
  function pgPintar(){
    if(!data || !pgCrearUI()) return;
    const g = PG();
    $p('pgOn').checked = !!g.on; $p('pgCaja').hidden = !g.on; $p('pgUrl').value = urlExterna();
    if($p('pgVentOn')){ $p('pgVentOn').checked = pgVentanaOn(); pgVentanaPermisos(); }
    if($p('pgVozOn')) $p('pgVozOn').checked = pgVozOn();
    if(document.activeElement !== $p('pgVol')){ const v = Math.min(pgVol(), Number($p('pgVol').max)); $p('pgVol').value = v; $p('pgVolTxt').textContent = v + ' %' + (v > 100 ? ' · más fuerte de lo normal' : v === 100 ? ' · lo más alto del celular' : v <= 30 ? ' · bajito' : ''); }
    const ea = AND() ? andEstado() : null;
    const vieja = !ea && window.ventoAppVieja && window.ventoAppVieja();
    const web = !ea && (vieja || (window.ventoAndroidWeb && window.ventoAndroidWeb()));
    if($p('pgWebAviso')){ $p('pgWebAviso').hidden = !web; const t = $p('pgWebAvisoTit'); if(t) t.textContent = vieja ? '📲 Tu app ORDEVA es una versión vieja: todavía no lee los avisos de pagos. Actualízala (se instala encima, no se borra nada).' : '📲 Estás en ORDEVA Web, no en la app.'; }
    $p('pgEstado').textContent = !g.on ? 'Apagado.' : vieja ? '🟠 Tu app ORDEVA es vieja: actualízala para que lea los avisos del banco.' : web ? '🟠 Estás en ORDEVA Web: aquí no se leen los avisos del banco. Abre la app ORDEVA en este celular.' : ea && ea.on ? (ea.permiso ? '🟢 La app lee directo los avisos de pagos de este celular.' : '🟠 Falta el permiso «Acceso a notificaciones» para ORDEVA.') : (es && es.readyState === 1 ? '🟢 Escuchando los avisos de pagos.' : '🟠 Conectando…');
    if($p('pgAndOn')){
      const e = andEstado();
      $p('pgAndOn').checked = !!e.on;
      $p('pgAndTxt').textContent = !e.on ? 'ORDEVA toma directo los avisos de plata recibida de DaviPlata, Nequi, la llave Bre-B y tu banco que llegan a este celular. Nunca toma códigos, claves ni compras.'
        : !e.permiso ? '🟠 Falta el permiso «Acceso a notificaciones» para ORDEVA: apaga y prende este interruptor para abrirlo.'
        : e.vivo === false ? '🟠 Android desconectó la lectura de avisos de ORDEVA (ahorro de batería o una actualización). Ya le pedimos que la vuelva a conectar; si en un minuto sigue así, apaga y prende «Acceso a notificaciones» para ORDEVA y quita el ahorro de batería de ORDEVA.'
        : '🟢 Leyendo los avisos de plata recibida de este celular (DaviPlata, Nequi, llave Bre-B y bancos). Ya no necesitas MacroDroid aquí.';
      pgDiagPintar();
    }
    const sello = x => x.estado === 'falso' ? '<span style="color:#e5484d;font-weight:800">🚨 FALSO</span>' : x.estado === 'revisar' ? '<span style="color:#f5a524;font-weight:800">⚠️ Revisar</span> <button type="button" class="btn-ghost" data-pgok="' + escp(x.id) + '" style="padding:2px 8px;font-size:12px">✅ Lo vi en la app</button>' : x.estado === 'ok' ? '<span style="color:#30a46c;font-weight:800">✅ Revisado</span>' : '<span style="color:#30a46c;font-weight:800">✅ Confirmado</span>';
    $p('pgLista').innerHTML = g.lista.length ? g.lista.slice(0, 15).map(x => '<div style="display:flex;gap:8px;padding:6px 0;border-top:1px solid var(--line);font-size:14px' + (x.estado === 'falso' ? ';opacity:.8;text-decoration:line-through' : '') + '"><span style="flex:1;min-width:0">' + escp(x.app) + (pagoDet(x).de ? ' · ' + escp(pagoDet(x).de) : '') + ' ' + sello(x) + '<br><small style="opacity:.7">' + new Date(x.t).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + (x.mesa ? ' · ' + escp(tableLabel(x.mesa)) : '') + (pagoDet(x).fuente && x.estado !== 'app' ? ' · ' + escp(pagoDet(x).fuente) : '') + '</small></span><b>' + plata(x.monto) + '</b></div>').join('') : '<div class="empty-note">Todavía no ha llegado ningún aviso.</div>';
    $p('pgLista').onclick = e => {
      const b = e.target.closest('[data-pgok]'); if(!b) return;
      const x = PG().lista.find(y => y.id === b.dataset.pgok); if(!x) return;
      x.estado = 'ok'; if(x.mesa) delete PG().espera[x.mesa]; saveData(); pgPintar(); try{ window.pagoLlego && window.pagoLlego(x); }catch(e2){}
      showToast('✅ Listo: ' + plata(x.monto) + ' de ' + (pagoDet(x).de || x.app) + ' quedó como revisado en la app.');
    };
    pgAlertasPintar();
  }
  // ---------- 🚨 ALERTAS DE PAGOS (ORDEVA etapa 6): todo lo que hace falta para que un pago suene con el celular bloqueado,
  // en una sola lista con su botón para arreglarlo, la conexión y el último pago. Solo lee lo que ya mide la app; no cambia
  // cómo se leen ni cómo suenan los pagos.
  function pgAlertasDatos(){
    const A = AND(), g = PG(), l = [];
    const j = f => { try{ return JSON.parse(f() || '{}'); }catch(e){ return {}; } };
    const fila = (ok, txt, fix, btn) => l.push({ ok, txt, fix: ok ? '' : fix || '', btn: btn || '🔧 Arreglar' });
    if(A){
      const e = andEstado();
      fila(!!(e.on && e.permiso && e.vivo !== false), !e.on ? 'Leer los avisos de Nequi y DaviPlata en este celular: APAGADO' : !e.permiso ? 'Falta el permiso «Acceso a notificaciones» para ORDEVA' : e.vivo === false ? 'Android desconectó la lectura de avisos de ORDEVA' : 'Lee los avisos de Nequi, DaviPlata y bancos de este celular', !e.on ? 'leer' : 'permiso', !e.on ? '▶ Prender' : '🔓 Dar el permiso');
      if(A.avisosEstado){ const n = j(A.avisosEstado); fila(n.prendidos !== false && n.permiso !== false, n.prendidos !== false && n.permiso !== false ? 'ORDEVA puede mostrar notificaciones (con sonido y vibración)' : 'ORDEVA NO puede mostrar notificaciones: el aviso del pago no sale ni vibra', 'notif', '🔔 Permitir'); }
      if(A.permisos){ const p = j(A.permisos);
        if(p.bateria !== undefined) fila(!!p.bateria, p.bateria ? 'Batería de ORDEVA: sin restricciones' : 'ORDEVA tiene ahorro de batería: con el celular bloqueado Android puede dormirla', 'bateria', '🔋 Quitar ahorro');
        if(p.fondo !== undefined) fila(!!p.fondo, p.fondo ? 'ORDEVA sigue trabajando con la pantalla apagada' : 'ORDEVA NO está trabajando de fondo (con la pantalla apagada se puede dormir)', 'fondo', '▶ Prender'); }
      pgBancosBat().forEach(b => fila(!!b.sinRestriccion, b.nombre + (b.sinRestriccion ? ': batería sin restricciones (avisa al instante)' : ': con ahorro de batería (sus avisos pueden llegar tarde)'), 'banco:' + b.pkg, '🔋 Arreglar'));
    } else {
      fila(false, 'Aquí no se leen los avisos del banco: eso lo hace la app ORDEVA en el celular donde está Nequi o DaviPlata. Este equipo recibe los pagos por la cuenta.', 'app', '📲 Abrir la app');
      if('Notification' in window) fila(Notification.permission === 'granted', Notification.permission === 'granted' ? 'Este navegador puede mostrar notificaciones' : 'Este navegador no tiene permiso para notificaciones', 'notifweb', '🔔 Permitir');
    }
    fila(pgVozOn(), pgVozOn() ? 'Voz de los pagos prendida (volumen ' + pgVol() + ' %)' : 'Voz de los pagos APAGADA: solo llega la notificación', 'voz', '🗣️ Prender');
    const red = navigator.onLine !== false, canal = !!(es && es.readyState === 1) || Date.now() - vivo < 100000;
    fila(red && canal, !red ? 'Sin internet: los pagos de este celular sí se leen, pero no llegan a los demás equipos' : canal ? 'Conectado: los pagos llegan a todos los equipos de la cuenta' : 'Conectando con los demás equipos de la cuenta…', 'conectar', '🔄 Reconectar');
    const ult = g.lista && g.lista[0];
    let banco = 0; if(A && A.pagosAvisosDiag){ banco = +(j(A.pagosAvisosDiag).ultimo) || 0; }
    return { l, ult, banco };
  }
  function pgAlertasPintar(){
    const box = $p('pgAlertas'); if(!box) return;
    const { l, ult, banco } = pgAlertasDatos(), mal = l.filter(x => !x.ok).length;
    const hora = t => new Date(+t).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    const abierto = box.querySelector('details') ? box.querySelector('details').open : mal > 0;
    box.innerHTML = '<div class="settings-row-text"><strong>🚨 ALERTAS DE PAGOS</strong><span id="pgAlertasRes" style="font-weight:700;color:' + (mal ? '#f5a524' : '#30a46c') + '">' +
      (mal ? '🟠 ' + mal + (mal === 1 ? ' cosa por arreglar' : ' cosas por arreglar') + ' para que los pagos suenen con el celular bloqueado.' : '🟢 Todo listo: los pagos suenan aunque el celular esté bloqueado.') + '</span></div>' +
      '<details' + (abierto ? ' open' : '') + ' style="margin-top:6px"><summary style="cursor:pointer;font-weight:700">Ver la lista (' + l.length + ')</summary>' +
      l.map(x => '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:5px 0;border-top:1px solid var(--line);font-size:14px"><span style="flex:1;min-width:180px">' + (x.ok ? '✅ ' : '⚠️ ') + escp(x.txt) + '</span>' +
        (x.fix ? '<button type="button" class="btn-ghost" data-pga="' + escp(x.fix) + '" style="padding:4px 10px">' + escp(x.btn) + '</button>' : '') + '</div>').join('') + '</details>' +
      '<div style="font-size:14px;margin-top:6px;opacity:.9">🕒 Último pago: ' + (ult ? '<b>' + plata(ult.monto) + '</b> por ' + escp(ult.app) + ' · ' + hora(ult.t) : 'todavía ninguno') +
      (banco ? '<br>📨 Último aviso de un banco en este celular: ' + hora(banco) : '') + '</div>' +
      '<div class="mz-actions"><button type="button" class="btn-primary" data-pga="probar">▶ Probar el sonido</button>' +
      (AND() && AND().pagosPrueba ? '<button type="button" class="btn-ghost" data-pga="completa">📳 Probar la alerta completa</button>' : '<button type="button" class="btn-ghost" data-pga="vibrar">📳 Probar la vibración</button>') +
      (AND() && AND().avisosAjustes ? '<button type="button" class="btn-ghost" data-pga="sonido">🎵 Elegir el sonido y la vibración</button>' : '') + '</div>';
  }
  document.addEventListener('click', ev => {
    const b = ev.target.closest && ev.target.closest('[data-pga]'); if(!b || !b.closest('#pgAlertas')) return;
    const A = AND(), k = b.dataset.pga;
    try{
      if(k === 'leer'){ const t = $p('pgAndOn'); if(t){ t.checked = true; t.onchange(); } }
      else if(k === 'permiso') A.mediosPermiso();
      else if(k === 'notif'){ A.avisosActivar ? A.avisosActivar() : A.avisosAjustes(); }
      else if(k === 'bateria'){ A.ajustesBateria(); showToast('Elige «Sin restricciones» (o «Permitir») para ORDEVA y vuelve con atrás.', 9000); }
      else if(k === 'fondo') A.fondoActivar(true);
      else if(k.startsWith('banco:')) pgBancoArreglar(k.slice(6));
      else if(k === 'app') window.ventoAbrirApp();
      else if(k === 'notifweb') Notification.requestPermission().then(() => pgAlertasPintar());
      else if(k === 'voz'){ pgVozOn(true); if($p('pgVozOn')) $p('pgVozOn').checked = true; showToast('🗣️ Los pagos se dicen en voz alta.'); }
      else if(k === 'conectar'){ try{ es && es.close(); }catch(e){} es = null; pgConectar(); pgSondear(); }
      else if(k === 'probar') $p('pgVolProbar').click();
      else if(k === 'vibrar'){ const ok = navigator.vibrate && navigator.vibrate([250, 120, 250]); showToast(ok ? '📳 ¿Vibró? Si no, este equipo no vibra desde el navegador: la vibración de los pagos la da la app ORDEVA.' : '📳 Este equipo no vibra desde el navegador: la vibración de los pagos la da la app ORDEVA en el celular.', 8000); }
      else if(k === 'completa'){ const r = JSON.parse(A.pagosPrueba('Nequi', 'Nequi', '¡Te llegó plata! PRUEBA ORDEVA te envió $2.500', false) || '{}'); showToast('📳 Prueba: debe decir los 2.500 pesos por Nequi, salir el aviso y vibrar. ' + (r.r || '') + ' · No se registra como pago. Bloquea el celular para probarlo así.', 10000); }
      else if(k === 'sonido'){ A.avisosAjustes(); showToast('Toca «💜 Pagos que te llegan»: ahí eliges el sonido, la vibración y que se vea con el celular bloqueado. Luego vuelve con atrás.', 12000); }
    }catch(e){}
    setTimeout(() => { try{ pgAlertasPintar(); }catch(e){} }, 800);
  });
  const arr = setInterval(() => { if(typeof data !== 'undefined' && data){ clearInterval(arr); pgPintar(); pgConectar(); pgAvisarWeb(); } }, 1000);
  // ORDEVA Web en Android con los avisos de pagos prendidos: aquí no se leen los avisos del banco (antes no se decía y
  // parecía que la app había dejado de avisar). Una vez por sesión.
  function pgAvisarWeb(){
    try{
      if(!PG().on || !(window.ventoAndroidWeb && window.ventoAndroidWeb()) || sessionStorage.getItem('vento_pg_web')) return;
      sessionStorage.setItem('vento_pg_web', '1');
      setTimeout(() => { try{ showToast('📲 Estás en ORDEVA Web: aquí no se leen los avisos de DaviPlata y Nequi. Para que suenen los pagos abre la app ORDEVA (Ajustes → 💜 Pagos → «Abrir la app ORDEVA»).', 12000); }catch(e){} }, 4000);
    }catch(e){}
  }
  if(window.ventoAppSinPuente && window.ventoAppSinPuente()) try{ window.ventoError && window.ventoError('app', 'La app Android abrió la página sin su puente (VentoAndroid)', { ua: navigator.userAgent.slice(0, 160) }, 'app|sin-puente'); }catch(e){}
  try{ const A = window.VentoAndroid; A && A.pagosVolumen && A.pagosVolumen(pgVol()); }catch(e){}
})();
