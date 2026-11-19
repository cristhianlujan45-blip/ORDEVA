/* 📧 ORDEVA 1.99.18 · ¿Ese correo existe?
   Pedido del dueño (19/11): «revisa que sea un correo que sí exista, porque el usuario puede entrar con cualquier cosa
   que escriba ahí». El servidor crea la cuenta al instante (sin confirmar el correo), así que antes servía cualquier
   cosa con forma de correo («hola@hola.hola»). Ahora, antes de crear la cuenta:
   1. Que tenga forma de correo de verdad (sin espacios, puntos dobles, etc.).
   2. Errores de dedo en los correos más usados: «gmial.com», «gmail.co», «hotmial.com»… → «¿Quisiste decir …?».
   3. Correos desechables (mailinator, yopmail…): no.
   4. Que el DOMINIO exista y reciba correos (se pregunta al DNS público por sus servidores de correo, MX). Gmail,
      Hotmail, Outlook, Yahoo e iCloud se dan por buenos sin preguntar. Sin internet no se puede preguntar: se deja pasar
      (la cuenta igual se crea en la nube cuando vuelve la conexión).
   Lo que esto NO puede saber es si el buzón (lo que va antes de la @) existe: para eso hay que mandarle un código al
   correo (ver ventoCorreo.puedeMandarCodigo y app/04h). */
(function(){
  'use strict';
  var BUENOS = ['gmail.com', 'hotmail.com', 'hotmail.es', 'outlook.com', 'outlook.es', 'live.com', 'yahoo.com', 'yahoo.es', 'icloud.com', 'me.com', 'msn.com', 'protonmail.com', 'proton.me'];
  var DESECHABLES = /(^|\.)(mailinator\.com|yopmail\.(com|fr|net)|guerrillamail\.(com|net|org|biz|info)|sharklasers\.com|10minutemail\.(com|net)|temp-mail\.(org|io)|tempmail\.(com|net|dev|plus)|tempmailo\.com|trashmail\.(com|de|net)|getnada\.com|dispostable\.com|maildrop\.cc|mohmal\.com|fakeinbox\.com|throwawaymail\.com|mintemail\.com|emailondeck\.com|mailnesia\.com|spamgourmet\.com|tmpmail\.(org|net)|minuteinbox\.com)$/i;
  // Errores de dedo en el nombre del proveedor (la parte antes del .com)
  var DEDO = { gmail: /^(gmial|gmai|gmal|gamil|gnail|gmaill|gmali|gmil|gmeil|gemail|gimail|gmsil|hmail|gmaul|gmqil)$/, hotmail: /^(hotmial|hotmal|hotmai|hotmil|homail|hotmaill|hotamil|hotmall|htmail|hormail|jotmail|hotnail)$/, outlook: /^(outlok|outloo|otlook|outllok|outlookk|oulook|outloock)$/, yahoo: /^(yaho|yahooo|yhoo|yaoo|yahho)$/, icloud: /^(iclod|icoud|iclould|icluod)$/ };
  var NOMBRES = { gmail: 'gmail.com', hotmail: 'hotmail.com', outlook: 'outlook.com', yahoo: 'yahoo.com', icloud: 'icloud.com' };
  var TLD_MAL = /^(co|con|cm|om|comm|cpm|vom|xom|coom|cmo|ocm|c|clm|col)$/;   // «.com» mal escrito

  function forma(e){
    return /^[a-z0-9](?:[a-z0-9._%+-]{0,62}[a-z0-9])?@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/.test(e) && !/\.\./.test(e) && e.length <= 254;
  }
  // ¿Se le parece a un correo conocido? Devuelve el correo corregido o null.
  function sugerir(e){
    var m = /^([^@]+)@(.+)$/.exec(e); if(!m) return null;
    var local = m[1], dom = m[2], i = dom.lastIndexOf('.'), base = i > 0 ? dom.slice(0, i) : dom, tld = i > 0 ? dom.slice(i + 1) : '';
    if(BUENOS.indexOf(dom) >= 0) return null;
    for(var k in DEDO){
      if(DEDO[k].test(base) && (tld === 'com' || TLD_MAL.test(tld))) return local + '@' + NOMBRES[k];
      if(base === k && TLD_MAL.test(tld) && tld !== 'co') return local + '@' + NOMBRES[k];
      if(base === k && tld === 'co' && k !== 'yahoo') return local + '@' + NOMBRES[k];   // gmail.co, hotmail.co, outlook.co (no existen)
    }
    if(/^(gmail|hotmail|outlook)\.com\.co$/.test(dom)) return local + '@' + dom.replace(/\.co$/, '');
    return null;
  }
  function conTiempo(p, ms){ return new Promise(function(ok, no){ var t = setTimeout(function(){ no(new Error('tiempo')); }, ms); p.then(function(v){ clearTimeout(t); ok(v); }, function(e){ clearTimeout(t); no(e); }); }); }
  // DNS público (DNS sobre HTTPS). true = recibe correo, false = no existe / no recibe, null = no se pudo preguntar.
  var cache = {};
  function dnsPreguntar(nombre, tipo){
    var urls = ['https://dns.google/resolve?name=' + encodeURIComponent(nombre) + '&type=' + tipo,
                'https://cloudflare-dns.com/dns-query?name=' + encodeURIComponent(nombre) + '&type=' + tipo];
    var intentar = function(i){
      if(i >= urls.length) return Promise.resolve(null);
      return conTiempo(fetch(urls[i], { headers: { accept: 'application/dns-json' }, cache: 'no-store' }), 4500)
        .then(function(r){ return r.ok ? r.json() : null; }).then(function(j){ return j && typeof j.Status === 'number' ? j : intentar(i + 1); }, function(){ return intentar(i + 1); });
    };
    return intentar(0);
  }
  function recibeCorreo(dom){
    if(cache[dom] !== undefined) return Promise.resolve(cache[dom]);
    return dnsPreguntar(dom, 'MX').then(function(j){
      if(!j) return null;
      if(j.Status === 3) return false;                                             // el dominio no existe
      var mx = (j.Answer || []).filter(function(a){ return a.type === 15; });
      if(mx.length) return !mx.every(function(a){ return /^0\s+\.?$/.test(String(a.data || '').trim()); });   // «MX 0 .» = no recibe correo
      // Sin MX: el correo puede ir al servidor del dominio (registro A), aunque es raro.
      return dnsPreguntar(dom, 'A').then(function(a){ return a ? !!(a.Answer || []).some(function(x){ return x.type === 1; }) : null; });
    }).then(function(v){ if(v !== null) cache[dom] = v; return v; });
  }
  // revisar(correo) → { ok, motivo, sugerencia, sinRevisar }
  function revisar(correo){
    var e = String(correo || '').trim().toLowerCase();
    if(!forma(e)) return Promise.resolve({ ok: false, motivo: 'forma' });
    var s = sugerir(e); if(s) return Promise.resolve({ ok: false, motivo: 'dedo', sugerencia: s });
    var dom = e.split('@')[1];
    if(DESECHABLES.test(dom)) return Promise.resolve({ ok: false, motivo: 'desechable' });
    if(BUENOS.indexOf(dom) >= 0) return Promise.resolve({ ok: true });
    return recibeCorreo(dom).then(function(v){
      if(v === false) return { ok: false, motivo: 'dominio', dominio: dom };
      return { ok: true, sinRevisar: v === null };
    });
  }
  function mensaje(r, correo){
    if(!r || r.ok) return '';
    if(r.motivo === 'dedo') return '📧 ¿Quisiste decir ' + r.sugerencia + '? Revisa tu correo: así como está no existe.';
    if(r.motivo === 'desechable') return '📧 Ese es un correo temporal (se borra solo). Usa tu correo de siempre: es tu cuenta y por ahí recuperas la contraseña.';
    if(r.motivo === 'dominio') return '📧 «' + r.dominio + '» no existe o no recibe correos. Revisa que esté bien escrito (ej. tunombre@gmail.com).';
    return '📧 Ese correo no está bien escrito. Ejemplo: tunombre@gmail.com';
  }
  window.ventoCorreo = { revisar: revisar, mensaje: mensaje, sugerir: sugerir, forma: forma };
})();
