/* ORDEVA · app/02-android-apk-dentro.js — antes estaba dentro de index.html (línea 107). Se carga en el mismo lugar y orden. */
/* ---------- ORDEVA para Android (APK) ----------
   Dentro de la app instalada (window.VentoAndroid) se usan los servicios del celular para lo que el
   navegador de una app no trae: dictado por voz, voz de ORDEVA, guardar archivos y el botón Atrás.
   Fuera de la app no se toca nada. */
(function(){
  var A = window.VentoAndroid; if(!A) return;
  try{ document.documentElement.classList.add('en-apk'); }catch(e){}
  // Dictado por voz: misma forma que SpeechRecognition del navegador (onresult, isFinal, alternativas…)
  var activo = null;
  function SR(){ this.lang = 'es-CO'; this.continuous = false; this.interimResults = false; this.maxAlternatives = 1; this.onresult = this.onerror = this.onend = this.onstart = null; this._fin = []; }
  /* Pasar el micrófono abierto: «Hola ORDEVA» deja escuchando el reconocedor de Android casi todo el tiempo. Antes, al
     tocar 🎤 se cancelaba esa escucha y se abría otra enseguida; Android todavía estaba soltando la anterior, respondía
     «ocupado» y la app reintentaba (450 ms, luego creaba otro reconocedor): 1–3 s de «Abriendo el micrófono…».
     Ahora, si la escucha ya está abierta, ceder() la suelta SIN cerrarla y el próximo start() la toma al instante. */
  var libre = null, libreT = 0;
  function palabras(t){ var x = String(t || '').toLowerCase(); try{ x = x.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }catch(e){} return x.replace(/[^a-z0-9ñ\s]/g, ' ').split(/\s+/).filter(Boolean); }
  // Android repite en cada resultado todo lo oído en la escucha: se quita lo que se oyó ANTES de tocar el botón.
  function sinPrevio(alts, previo){
    var pv = palabras(previo); if(!pv.length) return alts;
    var out = [];
    alts.forEach(function(a){
      var w = String(a.t || '').trim().split(/\s+/), n = 0;
      while(n < w.length && n < pv.length && palabras(w[n])[0] === pv[n]) n++;
      var t = w.slice(n).join(' ').trim(); if(t) out.push({ t: t, c: a.c });
    });
    return out;
  }
  SR.prototype.start = function(){
    if(activo && activo !== this){ try{ activo._vivo = false; }catch(e){} }
    activo = this; this._fin = []; this._vivo = true; this._parado = false; this._oyo = false; this._oyoSesion = false; this._ultimo = null; this._reabrir = false; this._desde = Date.now(); this._reabiertas = 0;
    var l = libre; libre = null; clearTimeout(libreT);
    if(l && l.lang === (this.lang || 'es-CO') && l.parcial === !!this.interimResults){
      // El micrófono ya está escuchando: se toma tal cual (sin cerrarlo ni volverlo a abrir).
      var me = this; me._tomada = Date.now(); me._previo = l.previo; me._listo = true;
      setTimeout(function(){ if(activo === me && me._vivo) me.onstart && me.onstart({}); }, 0);
      return;
    }
    this._tomada = 0; this._previo = null; this._listo = false;
    A.vozIniciar(this.lang || 'es-CO', !!this.interimResults, !!this.continuous);
  };
  // Cancelar: el aviso de «terminé» que manda Android después es de ESTA escucha; si llegara a la siguiente
  // (p. ej. «Hola ORDEVA» suelta el micrófono y enseguida se toca el botón) la cortaría. Se descarta.
  var finesIgnorar = 0;
  /* Pitido de Android: suena cada vez que se abre el micrófono. Con el botón 🎤 solo debe sonar al tocarlo; cuando la
     escucha se vuelve a abrir sola tras una pausa del pedido se silencia (como «Hola ORDEVA») y vuelve al terminar. */
  var mudo = false;
  function callar(si){ if(si === mudo) return; mudo = si; try{ A.vozSilencio && A.vozSilencio(si); }catch(e){} }
  function soltarMudo(){ if(!mudo) return; setTimeout(function(){ if(activo && activo._vivo) return; callar(false); }, 350); }
  /* Parar: si en ESTA escucha de Android no se ha oído nada (se volvió a abrir tras la orden, o nunca se habló) se
     CANCELA y se termina ya. Antes se «paraba»: Android respondía «no te entendí», la app nativa lo tomaba como un
     tropiezo al abrir y volvía a abrir el micrófono sola (otro pitido y 5–8 s más escuchando — y anotando lo que se
     hablara cerca — antes de anotar el pedido). */
  SR.prototype.stop = function(){
    var me = this; me._parado = true;
    if(activo === me && me._vivo && !me._oyoSesion){
      activo = null; me._vivo = false; finesIgnorar++;
      try{ A.vozCancelar(); }catch(e){ finesIgnorar--; }
      soltarMudo();
      setTimeout(function(){ if(!me._oyo && me.onerror) me.onerror({ error: 'no-speech' }); me.onend && me.onend({}); }, 0);
      return;
    }
    try{ A.vozParar(); }catch(e){}
  };
  SR.prototype.abort = function(){ var me = this; if(activo !== me) return; activo = null; me._vivo = false; finesIgnorar++; try{ A.vozCancelar(); }catch(e){ finesIgnorar--; } soltarMudo(); setTimeout(function(){ me.onend && me.onend({}); }, 0); };
  SR.prototype.ceder = function(){
    var me = this; if(activo !== me) return;
    if(!me._listo || !me._vivo){ me.abort(); return; }          // todavía abriendo o ya terminando: como antes
    activo = null; me._vivo = false;
    libre = { lang: me.lang || 'es-CO', parcial: !!me.interimResults, previo: me._ultimo };
    clearTimeout(libreT);
    // Si nadie la toma enseguida, se cierra como siempre.
    libreT = setTimeout(function(){ if(!libre) return; libre = null; finesIgnorar++; try{ A.vozCancelar(); }catch(e){ finesIgnorar--; } }, 600);
    setTimeout(function(){ me.onend && me.onend({}); }, 0);
  };
  SR.prototype.addEventListener = function(t, f){ this['on' + t] = f; };
  function lista(arr){ arr.item = function(i){ return this[i]; }; return arr; }
  // Escucha tomada que se acaba sin haber oído nada del comando (Android la cierra por silencio, o ya venía
  // cerrándose): se vuelve a abrir sola, sin «No escuché nada».
  function reabrir(r){ return r._tomada && !r._oyo && !r._parado && r._vivo && Date.now() - r._tomada < 8000; }
  window.__ventoVoz = function(tipo, d){
    if(tipo === 'end' && finesIgnorar > 0){ finesIgnorar--; return; }
    var r = activo;
    if(!r){
      // Escucha abierta sin dueño (cedida): se lleva la cuenta de lo oído; si se cierra, ya no hay nada que tomar.
      if(libre){ if(tipo === 'result' && d && d.alts && d.alts[0]) libre.previo = d.alts[0].t; else if(tipo === 'error' || tipo === 'end'){ libre = null; clearTimeout(libreT); } }
      return;
    }
    if(tipo === 'start'){ r._listo = true; r.onstart && r.onstart({}); return; }
    if(tipo === 'result'){
      var alts = (d && d.alts) || [];
      if(r._tomada){
        // Lo que llega apenas se tomó la escucha se dijo ANTES del toque: no es parte del comando.
        if(!r._oyo && Date.now() - r._tomada < 350){ if(d.final) r._reabrir = true; else if(alts[0]) r._previo = alts[0].t; return; }
        if(r._previo){ alts = sinPrevio(alts, r._previo); if(!alts.length){ if(d.final && !r._oyo) r._reabrir = true; return; } }
      }
      if(alts[0]){ r._oyo = true; r._oyoSesion = true; r._ultimo = alts[0].t; }
      // Botón 🎤: terminó una frase; si la escucha se vuelve a abrir para seguir el pedido, que no pite.
      if(d.final && r.mantener && alts[0]) callar(true);
      var res = lista(alts.map(function(a){ return { transcript: a.t, confidence: a.c }; })); res.isFinal = !!d.final;
      var todos;
      if(d.final){ r._fin.push(res); todos = lista(r._fin.slice()); }
      else { todos = lista(r._fin.slice().concat([res])); }
      r.onresult && r.onresult({ results: todos, resultIndex: todos.length - 1 });
      return;
    }
    if(tipo === 'error'){
      r._listo = false;
      // Botón 🎤 (escucha «mantenida»): un silencio después de haber hablado no es un error, es que terminó de hablar.
      if(r.mantener && r._oyo && d && /no-speech|aborted|network/.test(d.error || '')){ r._parado = true; return; }
      if(reabrir(r) && !(d && /not-allowed/.test(d.error || ''))){ r._reabrir = true; return; }
      r.onerror && r.onerror({ error: d && d.error }); return;
    }
    if(tipo === 'end'){
      if(r._reabrir || reabrir(r)){
        if(r._vivo && !r._parado){
          r._reabrir = false; r._tomada = 0; r._previo = null; r._listo = false; r._fin = []; r._oyoSesion = false;
          try{ A.vozIniciar(r.lang || 'es-CO', !!r.interimResults, !!r.continuous); return; }catch(e){}
        }
      }
      // Botón 🎤: Android cierra la escucha en cada pausa («dos águilas… tres póker»). Antes ahí se cortaba el pedido y se
      // perdía lo que seguía; ahora se vuelve a abrir sola y se SUMA, hasta que la página detecte un silencio de verdad
      // (o se toque el botón). Lo que ya se oyó (r._fin) se conserva.
      // Tope: 25 s y 8 vueltas (con música o gente hablando cerca no se queda escuchando sin fin).
      if(r.mantener && r._vivo && !r._parado && r._oyo && Date.now() - (r._desde || 0) < 25000 && (r._reabiertas || 0) < 8){
        r._listo = false; r._oyoSesion = false; r._reabiertas = (r._reabiertas || 0) + 1;
        callar(true);
        try{ A.vozIniciar(r.lang || 'es-CO', !!r.interimResults, !!r.continuous); return; }catch(e){}
      }
      if(!r._vivo && r._finAvisado) return; r._vivo = false; r._finAvisado = true; if(activo === r) activo = null; soltarMudo(); r.onend && r.onend({}); setTimeout(function(){ r._finAvisado = false; }, 0);
    }
  };
  window.SpeechRecognition = window.webkitSpeechRecognition = SR;
  // El reconocedor queda listo desde que abre la app: así la PRIMERA vez que se toca el micrófono ya escucha.
  try{ if(A.vozPreparar){ A.vozPreparar(); document.addEventListener('visibilitychange', function(){ if(!document.hidden) try{ A.vozPreparar(); }catch(e){} }); } }catch(e){}
  // Voz de ORDEVA (leer en voz alta)
  if(!('speechSynthesis' in window) || !window.speechSynthesis || !window.speechSynthesis.speak){
    var hablando = null;
    window.SpeechSynthesisUtterance = window.SpeechSynthesisUtterance || function(t){ this.text = t || ''; this.lang = 'es-CO'; this.rate = 1; this.onend = this.onstart = this.onerror = null; };
    window.speechSynthesis = { speaking: false, pending: false, onvoiceschanged: null,
      getVoices: function(){ return []; },
      speak: function(u){ hablando = u; this.speaking = true; try{ A.hablar(String(u.text || ''), u.lang || 'es-CO', Number(u.rate) || 1); }catch(e){ this.speaking = false; } },
      cancel: function(){ this.speaking = false; try{ A.callar(); }catch(e){} var h = hablando; hablando = null; if(h && h.onend) try{ h.onend({}); }catch(e){} },
      pause: function(){}, resume: function(){} };
    window.__ventoHabla = function(t){ var h = hablando; if(t === 'start'){ h && h.onstart && h.onstart({}); return; } window.speechSynthesis.speaking = false; hablando = null; if(h && h.onend) try{ h.onend({}); }catch(e){} };
  }
  // Descargas (respaldos, reportes, fotos): la app los guarda en Descargas/Vento
  var clickOrig = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function(){
    var a = this, h = a.href || '';
    if(a.download && /^(blob:|data:)/.test(h)){
      fetch(h).then(function(r){ return r.blob(); }).then(function(b){
        var fr = new FileReader(); fr.onload = function(){ var b64 = String(fr.result).split(',')[1] || ''; A.guardarArchivo(a.download, b.type || 'application/octet-stream', b64); }; fr.readAsDataURL(b);
      }).catch(function(){});
      return;
    }
    return clickOrig.apply(this, arguments);
  };
  // Botón Atrás del celular: cierra la ventana abierta de ORDEVA (si hay una)
  window.ventoAtras = function(){
    var ab = Array.prototype.slice.call(document.querySelectorAll('.overlay.show'));
    if(!ab.length) return false;
    var arriba = ab[ab.length - 1];
    if(typeof arriba._fin === 'function'){ arriba._fin(null); return true; }   // ventanas con su propio «Cancelar» (cobro de la caja / modo fácil)
    arriba.classList.remove('show'); return true;
  };
})();
