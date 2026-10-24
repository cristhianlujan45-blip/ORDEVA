/* ORDEVA · app/15-whatsapp-recibir-responder.js — antes estaba dentro de index.html (línea 30397). Se carga en el mismo lugar y orden. */
/* ==================== 💬 WhatsApp con IA (recibir y responder pedidos) ====================
   WhatsApp Business tiene una API oficial (de Meta) para negocios, pero solo habla con un
   servidor de verdad, no con una página web como ORDEVA. El "puente" (un Cloudflare Worker
   gratis, igual que el del TV) hace ese papel: recibe los mensajes de WhatsApp y se los pasa
   a ORDEVA por un canal privado de ORDEVA; cuando ORDEVA quiere contestar, le pide al puente que
   la envíe. La IA lee cada mensaje, arma el pedido (cliente, dirección, productos) y redacta
   una respuesta — que se manda sola si activas "Responder automáticamente", o que tú revisas
   y envías con un toque si prefieres tener el control. */
(function(){
  const $w = id => document.getElementById(id);
  const escw = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const WA = () => {
    if(!data.whatsapp) data.whatsapp = { on: false, auto: false, topic: '', puente: '', secreto: '', lista: [], vistos: [] };
    const g = data.whatsapp;
    // Canal PROPIO y secreto (no el de los QR de las mesas, que ven los clientes).
    if(!g.topic) g.topic = 'mesorawa' + Array.from(crypto.getRandomValues(new Uint8Array(14)), b => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join('');
    if(!g.secreto) g.secreto = Array.from(crypto.getRandomValues(new Uint8Array(18)), b => 'abcdefghjkmnpqrstuvwxyz0123456789'[b % 36]).join('');
    if(g.puente == null) g.puente = '';
    if(!Array.isArray(g.lista)) g.lista = [];
    if(!Array.isArray(g.vistos)) g.vistos = [];
    return g;
  };
  const waUrl = () => 'https://canal.vento.local/' + WA().topic;
  const waUrlExterna = () => (window.ventoCanal && window.ventoCanal.url(WA().topic)) || '';

  // ---------- La IA lee el mensaje, entiende el pedido y redacta la respuesta ----------
  const WA_IA_PROMPT = 'Eres el asistente de WhatsApp de un restaurante/tienda colombiano que recibe pedidos por este medio. ' +
    'Te llega el mensaje de un cliente. Devuelve SOLO JSON válido (sin texto extra, sin ```), con esta forma exacta: ' +
    '{"cliente":"","direccion":"","items":[{"nombre":"","cantidad":1}],"respuesta":""}. ' +
    'cliente y direccion: solo si el mensaje los trae explícitos, si no cadena vacía (no inventes). ' +
    'items: un objeto por cada producto que pidió, con la cantidad en número (si no dice cantidad, 1); vacío si el mensaje no es un pedido (solo saluda, pregunta algo, o agradece). ' +
    'respuesta: el mensaje que le vas a contestar por WhatsApp — cálido, breve (máximo 3 líneas), en español colombiano informal pero respetuoso, sin emojis de más. ' +
    'Si el pedido viene completo, confírmalo y pregunta la dirección si no la dio. Si falta la dirección, pídesela. Si no es un pedido, respóndele lo que preguntó o salúdalo de vuelta. No agregues nada fuera del JSON.';
  async function waProcesar(texto, de, nombre){
    const g = WA();
    let info = null;
    try{
      info = cleanAiJsonText(await aiText({ prompt: WA_IA_PROMPT + '\n\nMensaje del cliente' + (nombre ? ' (' + nombre + ')' : '') + ':\n' + texto, json: true, timeoutMs: 30000, retries: 1, fast: true, maxOutputTokens: 500 }));
    }catch(err){ info = null; }
    const items = (info && Array.isArray(info.items)) ? info.items.filter(x => x && x.nombre) : [];
    const reg = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), t: Date.now(), de, nombre: nombre || '',
      texto: String(texto || '').slice(0, 500),
      cliente: (info && info.cliente) || nombre || '', direccion: (info && info.direccion) || '',
      items, respuesta: (info && info.respuesta) || 'Recibimos tu mensaje, en un momento te contestamos 🙂',
      enviada: false, enviarFallo: false
    };
    g.lista.unshift(reg); g.lista = g.lista.slice(0, 200); saveData();
    try{ showToast('💬 WhatsApp de ' + (reg.cliente || de) + (items.length ? ': ' + items.map(x => x.cantidad + ' ' + x.nombre).join(', ') : ''), 9000); }catch(e){}
    try{ if(navigator.vibrate) navigator.vibrate([120, 60, 120]); }catch(e){}
    if(g.auto) await waEnviar(reg);
    waPintar();
    return reg;
  }
  async function waEnviar(reg){
    const g = WA();
    if(!g.puente){ showToast('⚠️ Configura el puente de WhatsApp en Ajustes para poder responder.'); return; }
    try{
      const r = await fetch(g.puente.replace(/\/+$/, '') + '/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: reg.de, text: reg.respuesta, secret: g.secreto }) });
      reg.enviada = r.ok; reg.enviarFallo = !r.ok; saveData(); waPintar();
      if(!r.ok) showToast('⚠️ No se pudo enviar la respuesta por WhatsApp (revisa el puente en Ajustes).');
    }catch(e){ reg.enviarFallo = true; saveData(); waPintar(); showToast('⚠️ No se pudo conectar con el puente de WhatsApp.'); }
  }
  window.waArmarDomicilio = function(id){
    const reg = WA().lista.find(x => x.id === id); if(!reg) return;
    domRecibirDeIa({ cliente: reg.cliente, telefono: reg.de, direccion: reg.direccion, items: reg.items });
  };
  window.waReenviar = function(id){ const reg = WA().lista.find(x => x.id === id); if(reg) waEnviar(reg); };
  window.waTextoAbrir = function(o){ try{ o.disabled = false; }catch(e){} };

  // ---------- Escuchar el canal (igual patrón que los avisos de pago) ----------
  let es = null, vivo = 0;
  function waConectar(){
    if(!data || !data.whatsapp || !data.whatsapp.on) return;
    if(es && es.readyState !== 2 && Date.now() - vivo < 100000) return;
    try{ if(es) es.close(); }catch(e){}
    try{ es = new EventSource(waUrl() + '/sse?since=15m'); }catch(e){ return; }
    vivo = Date.now();
    es.onmessage = ev => { vivo = Date.now(); waRecibirCruda(ev); };
    ['open', 'keepalive'].forEach(n => es.addEventListener(n, () => { vivo = Date.now(); }));
    waPintar();
  }
  async function waSondear(){
    if(!data || !data.whatsapp || !data.whatsapp.on) return;
    try{
      const r = await fetch(waUrl() + '/json?poll=1&since=15m', { cache: 'no-store' });
      (await r.text()).split('\n').forEach(l => { if(!l.trim()) return; try{ waRecibirCruda({ data: l }); }catch(e){} });
    }catch(e){}
  }
  function waRecibirCruda(ev){
    let m; try{ m = JSON.parse(ev.data); }catch(e){ return; }
    if(m.event !== 'message' || !m.message) return;
    const g = WA(); if(g.vistos.includes(m.id)) return; g.vistos.push(m.id); g.vistos = g.vistos.slice(-500);
    let paquete; try{ paquete = JSON.parse(m.message); }catch(e){ return; }
    if(!paquete || !paquete.texto || !paquete.de) return;
    // Evita procesar el mismo mensaje dos veces si WhatsApp lo reintenta.
    if(paquete.id && g.vistos.includes('w:' + paquete.id)) return;
    if(paquete.id) g.vistos.push('w:' + paquete.id);
    waProcesar(paquete.texto, paquete.de, paquete.nombre);
  }
  setInterval(waConectar, 15000);
  setInterval(() => { if(document.visibilityState === 'visible') waSondear(); }, 30000);
  document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'visible'){ waConectar(); waSondear(); } });

  // ---------- Ajustes ----------
  function waCrearUI(){
    if($w('waGrupo')) return true;
    const ancla = $w('domIaBtn'); const grupo = ancla && ancla.closest('.settings-group');
    if(!grupo) return false;
    const g = document.createElement('div');
    g.className = 'settings-group'; g.id = 'waGrupo'; g.hidden = true; g.dataset.cat = 'pedidos';
    g.innerHTML = '<h2>💬 WhatsApp con IA (recibir pedidos) <span class="tvp-badge">Nuevo</span></h2>' +
      '<div class="settings-desc">Necesitas una app de WhatsApp Business en Meta for Developers (gratis, lo tramitas tú con tu número). Una vez la tengas, este puente conecta esos mensajes con ORDEVA: la IA lee cada pedido, lo deja listo para facturar y redacta la respuesta — que se envía sola si activas "Responder automáticamente", o la revisas tú primero.</div>' +
      '<div class="settings-row"><div class="settings-row-text"><strong>Escuchar mensajes de WhatsApp</strong><span id="waEstado"></span></div><label class="switch"><input type="checkbox" id="waOn"><span class="switch-slider"></span></label></div>' +
      '<div id="waCaja" hidden>' +
      '<div class="settings-row"><div class="settings-row-text"><strong>Responder automáticamente con IA</strong><span>Si lo apagas, tú revisas y envías cada respuesta con un toque.</span></div><label class="switch"><input type="checkbox" id="waAuto"><span class="switch-slider"></span></label></div>' +
      '<details class="settings-desc" open><summary><b>Cómo conectarlo (una vez)</b></summary><ol style="margin:8px 0 0;padding-left:20px;line-height:1.55">' +
      '<li>En <b>developers.facebook.com</b>, crea una app de tipo "Negocio" y agrégale el producto <b>WhatsApp</b>. Ahí Meta te da un <b>token de acceso</b> y el <b>ID del número de teléfono</b> (Phone Number ID) — dan uno de prueba gratis para empezar.</li>' +
      '<li>Publica el puente: <b>dash.cloudflare.com</b> → Workers & Pages → Create Worker → Deploy → Edit code → borra todo, pega el código de abajo → Deploy.</li>' +
      '<li>En el Worker, <b>Settings → Variables and Secrets</b>, agrega <b>WHATSAPP_TOKEN</b>, <b>PHONE_NUMBER_ID</b>, y una palabra tuya como <b>VERIFY_TOKEN</b>. Copia también <b>VENTO_CANAL</b> y <b>MESORA_SECRET</b> de aquí abajo. <i>(Si tu puente es de antes, vuelve a pegar el código del puente y agrega VENTO_CANAL.)</i></li>' +
      '<li>En Meta, en la configuración del <b>Webhook</b> de tu app de WhatsApp, pega la dirección del Worker (termina en <b>.workers.dev/webhook</b>) y el mismo VERIFY_TOKEN. Suscríbete al campo <b>messages</b>.</li>' +
      '<li>Pega abajo la dirección de tu Worker (sin <b>/webhook</b> al final) y activa "Escuchar mensajes".</li></ol></details>' +
      '<div class="mz-actions"><button type="button" class="btn-ghost" id="waCopyCode">📋 Copiar código del puente</button></div>' +
      '<div class="settings-row" style="flex-direction:column;align-items:stretch"><div class="settings-row-text"><strong>Dirección de tu puente</strong></div>' +
      '<input id="waPuente" class="mz-in" style="width:100%" placeholder="https://mesora-whatsapp.tu-usuario.workers.dev"></div>' +
      '<div class="settings-row" style="flex-direction:column;align-items:stretch"><div class="settings-row-text"><strong>VENTO_CANAL</strong><span>Pégalo tal cual en el Worker (es la dirección privada por donde llegan los mensajes a ORDEVA).</span></div><input id="waTopicVal" class="mz-in" style="width:100%" readonly onclick="this.select()"></div>' +
      '<div class="settings-row" style="flex-direction:column;align-items:stretch"><div class="settings-row-text"><strong>MESORA_SECRET</strong><span>No lo compartas: protege que solo ORDEVA pueda mandar mensajes por tu número.</span></div><input id="waSecretoVal" class="mz-in" style="width:100%" readonly onclick="this.select()"></div>' +
      '<div class="settings-row" style="flex-direction:column;align-items:stretch"><div class="settings-row-text"><strong>Mensajes recientes</strong></div><div id="waLista"></div></div></div>';
    grupo.insertAdjacentElement('afterend', g);
    const on = $w('waOn'), auto = $w('waAuto'), puente = $w('waPuente');
    on.onchange = () => { WA().on = on.checked; saveData(); if(on.checked){ waConectar(); waSondear(); } else { try{ es && es.close(); }catch(e){} es = null; } waPintar(); };
    auto.onchange = () => { WA().auto = auto.checked; saveData(); waPintar(); };
    puente.addEventListener('change', () => { WA().puente = puente.value.trim().replace(/\/webhook\/?$/, '').replace(/\/+$/, ''); saveData(); waPintar(); });
    $w('waCopyCode').onclick = async () => {
      const src = document.getElementById('waWorkerSrc').textContent.trim();
      try{ await navigator.clipboard.writeText(src); showToast('📋 Código del puente copiado. Pégalo en Cloudflare (Edit code) y toca Deploy.', 6000); }
      catch(e){ showToast('⚠️ No se pudo copiar. Está en la carpeta «puente» del proyecto en GitHub.', 6000); }
    };
    g.addEventListener('click', e => {
      const bDom = e.target.closest('[data-wa-dom]'); if(bDom){ window.waArmarDomicilio(bDom.dataset.waDom); return; }
      const bEnv = e.target.closest('[data-wa-send]'); if(bEnv){ window.waReenviar(bEnv.dataset.waSend); return; }
    });
    return true;
  }
  function waPintar(){
    if(!data || !waCrearUI()) return;
    const g = WA();
    $w('waOn').checked = !!g.on; $w('waCaja').hidden = !g.on; $w('waAuto').checked = !!g.auto;
    $w('waPuente').value = g.puente || ''; $w('waTopicVal').value = waUrlExterna(); $w('waSecretoVal').value = g.secreto;
    $w('waEstado').textContent = !g.on ? 'Apagado.' : (es && es.readyState === 1 ? '🟢 Escuchando WhatsApp.' : '🟠 Conectando…');
    $w('waLista').innerHTML = g.lista.length ? g.lista.slice(0, 15).map(x => {
      const items = x.items.map(i => i.cantidad + ' ' + escw(i.nombre)).join(', ');
      const estadoEnvio = x.enviada ? '✅ Respondido' : (x.enviarFallo ? '⚠️ No se pudo enviar' : (g.auto ? '⏳ Enviando…' : '🕓 Por responder'));
      return '<div style="padding:8px 0;border-top:1px solid var(--line);font-size:14px">' +
        '<div><b>' + escw(x.cliente || x.de) + '</b> <small style="opacity:.7">' + new Date(x.t).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + '</small></div>' +
        '<div style="opacity:.85">"' + escw(x.texto) + '"</div>' +
        (items ? '<div style="margin-top:2px">🛒 ' + items + '</div>' : '') +
        '<div style="margin-top:4px;opacity:.8">💬 ' + escw(x.respuesta) + '</div>' +
        '<div style="margin-top:4px;display:flex;gap:8px;align-items:center;flex-wrap:wrap"><small>' + estadoEnvio + '</small>' +
        (items.length || x.direccion ? '<button type="button" class="btn-ghost" style="padding:4px 10px;font-size:12px" data-wa-dom="' + x.id + '">🛵 Armar domicilio</button>' : '') +
        (!x.enviada ? '<button type="button" class="btn-ghost" style="padding:4px 10px;font-size:12px" data-wa-send="' + x.id + '">📤 Enviar respuesta</button>' : '') +
        '</div></div>';
    }).join('') : '<div class="empty-note">Todavía no ha llegado ningún mensaje.</div>';
  }
  const arrW = setInterval(() => { if(typeof data !== 'undefined' && data){ clearInterval(arrW); waPintar(); waConectar(); } }, 1000);
})();
