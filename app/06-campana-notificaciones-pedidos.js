/* ORDEVA · app/06-campana-notificaciones-pedidos.js — antes estaba dentro de index.html (línea 20898). Se carga en el mismo lugar y orden. */
/* === Campana de notificaciones: pedidos de trago/cerveza + canciones === */
(function(){
  const PKEY='vito_pedidos_pend';
  const CKEY='vito_cola';
  const NKEY='vito_notif_cfg';
  const LKEY='vito_notif_log';
  // Los pedidos por aceptar salen de la lista de pedidos del negocio (la misma en todos los equipos: la que llena la app
  // de los clientes, el QR, los meseros y WhatsApp). Antes salían de una copia de ESTE celular: en los otros no se veían.
  const getPendList=()=>{
    try{ const P=window.vitoPedidos; if(P) return P.lista().filter(x=>x.estado==='nuevo').map(x=>({id:x.id,mesa:x.mesa,ts:x.at||x.recibidoEn,items:(x.items||[]).map(i=>({productText:i.name,qty:i.qty}))})); }catch(e){}
    try{return JSON.parse(localStorage.getItem(PKEY))||[]}catch(e){return[]}
  };
  // Pedidos de hoy y los que siguen en curso (más nuevos primero).
  const pedidosPanel=()=>{
    try{ const P=window.vitoPedidos; if(!P) return null;
      const d0=new Date(); d0.setHours(0,0,0,0);
      return P.lista().filter(x=>['nuevo','recibido','preparacion','listo'].includes(x.estado)||(x.recibidoEn||x.at||0)>=d0.getTime()).slice(-80).reverse(); }catch(e){ return null; }
  };
  const setPendList=l=>{try{localStorage.setItem(PKEY,JSON.stringify(l));}catch(e){}};
  const getSongList=()=>{try{return (JSON.parse(localStorage.getItem(CKEY))||[]).filter(x=>!x.done&&!x.fondo)}catch(e){return[]}};   // la música de fondo (tu playlist) no es un pedido: no suena la campana
  const getCfg=()=>{try{return Object.assign({voz:true,volumen:1},JSON.parse(localStorage.getItem(NKEY))||{})}catch(e){return{voz:true,volumen:1}}};
  const setCfg=c=>{try{localStorage.setItem(NKEY,JSON.stringify(c));}catch(e){}};
  // El mismo interruptor está en Ajustes → Voz («Anunciar los pedidos en voz alta»).
  setTimeout(()=>{const t=document.getElementById('vozPedidosOn');if(!t)return;t.checked=getCfg().voz!==false;t.onchange=()=>{const c=getCfg();c.voz=t.checked;setCfg(c);};},0);

  function previewPedido(items){
    return (items||[]).map(it=>{
      let name=it.productText, ok=false;
      try{ const p=matchProductVoice(it.productText); if(p){name=p.name;ok=true;} }catch(e){}
      const qn=Math.max(1,it.qty||1);
      return qn+' '+name+(ok?'':' ⚠️');
    }).join(', ');
  }

  let audioCtx=null, unlocked=false;
  function unlockAudio(){
    if(unlocked) return;
    try{ audioCtx=new (window.AudioContext||window.webkitAudioContext)(); unlocked=true; }catch(e){}
    document.removeEventListener('click',unlockAudio);
    document.removeEventListener('touchstart',unlockAudio);
  }
  document.addEventListener('click',unlockAudio);
  document.addEventListener('touchstart',unlockAudio);
  function timbre(){
    if(!audioCtx){ try{audioCtx=new (window.AudioContext||window.webkitAudioContext)();}catch(e){return;} }
    if(audioCtx.state==='suspended'){ try{audioCtx.resume();}catch(e){} }
    const now=audioCtx.currentTime;
    [[880,0],[1320,0.14]].forEach(([freq,delay])=>{
      const osc=audioCtx.createOscillator(), gain=audioCtx.createGain();
      osc.type='sine'; osc.frequency.value=freq;
      osc.connect(gain); gain.connect(audioCtx.destination);
      const t0=now+delay;
      gain.gain.setValueAtTime(0,t0);
      gain.gain.linearRampToValueAtTime(0.35,t0+0.02);
      gain.gain.exponentialRampToValueAtTime(0.001,t0+0.3);
      osc.start(t0); osc.stop(t0+0.32);
    });
  }
  function decir(texto){
    try{
      const cfg=getCfg();
      if(!cfg.voz) return;
      if(!('speechSynthesis' in window)) return;
      if(window.ventoHablar) window.ventoHablar(texto,{enCola:true,volumen:Math.max(0,Math.min(1,cfg.volumen))});
    }catch(e){}
  }

  let bell,badge,menu,panelBody,panelSig='',cardsWrap,ajustesPanel,lastTotal=-1,lastPendIds=[],lastSongIds=[];

  /* ---------- Tarjetas de notificación: solo pedidos de trago/cerveza ---------- */
  function aceptarPedido(pid){
    if(window.vitoDespacharPedido) window.vitoDespacharPedido(pid);
    quitarTarjeta(pid);
    check();
  }
  function rechazarPedido(pid){
    if(window.vitoRechazarPedido) window.vitoRechazarPedido(pid);
    quitarTarjeta(pid);
    check();
  }
  function quitarTarjeta(pid){
    const el=cardsWrap.querySelector('[data-pid="'+pid+'"]');
    if(el) el.remove();
  }
  function crearTarjeta(it){
    const card=document.createElement('div');
    card.className='vito-pedido-card';
    card.dataset.pid=it.id;
    const h=document.createElement('div');
    h.className='vito-pedido-card-h';
    h.textContent='📥 Pedido recibido · Mesa '+it.mesa;
    const b=document.createElement('div');
    b.className='vito-pedido-card-b';
    b.textContent=previewPedido(it.items);
    const acts=document.createElement('div');
    acts.className='vito-pedido-card-acts';
    const bOk=document.createElement('button'); bOk.className='vito-ok'; bOk.textContent='✅ Enviar pedido';
    bOk.onclick=()=>aceptarPedido(it.id);
    const bNo=document.createElement('button'); bNo.className='vito-no'; bNo.textContent='❌ Rechazar';
    bNo.onclick=()=>rechazarPedido(it.id);
    acts.append(bOk,bNo);
    card.append(h,b,acts);
    return card;
  }
  /* La tarjeta flotante dura solo 10 segundos desde que llega el pedido; el pedido sigue en la campanita */
  const VIDA_TARJETA=10000, tarjetasCerradas={};
  function sincronizarTarjetas(pendList){
    const ahora=Date.now();
    const vigentes=pendList.filter(x=>!tarjetasCerradas[x.id] && (ahora-(x.ts||0))<VIDA_TARJETA);
    const ids=vigentes.map(x=>String(x.id));
    Array.from(cardsWrap.children).forEach(el=>{ if(ids.indexOf(el.dataset.pid)===-1) el.remove(); });
    vigentes.forEach(it=>{
      if(cardsWrap.querySelector('[data-pid="'+it.id+'"]')) return;
      const card=crearTarjeta(it);
      cardsWrap.appendChild(card);
      setTimeout(()=>{ tarjetasCerradas[it.id]=true; if(card.parentNode) card.remove(); }, Math.max(0,VIDA_TARJETA-(ahora-it.ts)));
    });
  }

  function buildUI(){
    const style=document.createElement('style');
    style.textContent=
      '@keyframes vitoCampanaGlow{0%,100%{box-shadow:0 0 0 0 rgba(255,140,0,.75),0 0 12px 2px rgba(255,140,0,.6)}50%{box-shadow:0 0 0 9px rgba(255,140,0,0),0 0 20px 6px rgba(255,180,0,.9)}}'+
      '@keyframes vitoCampanaRing{0%{transform:rotate(0)}10%{transform:rotate(18deg)}20%{transform:rotate(-16deg)}30%{transform:rotate(14deg)}40%{transform:rotate(-10deg)}50%{transform:rotate(6deg)}60%{transform:rotate(-4deg)}70%,100%{transform:rotate(0)}}'+
      /* Fija (no se arrastra): así no estorba ni queda tapando otros botones.
         z-index por debajo de los modales (.overlay = 50) para que, si abres
         una ventana (agregar producto, cobrar, factura...), la campana no
         quede flotando encima tapando nada. */
      '.vito-campana{position:fixed;right:14px;bottom:84px;z-index:45;width:52px;height:52px;border-radius:50%;border:1px solid #6b5a44;background:#221c16;color:#f3e9d8;font-size:24px;display:flex;align-items:center;justify-content:center;cursor:pointer;touch-action:manipulation;user-select:none;box-shadow:0 4px 14px rgba(0,0,0,.45);transition:transform .15s ease;}'+
      '.vito-campana:active{transform:scale(0.93);}'+
      '.vito-campana.activa{animation:vitoCampanaGlow 1.3s ease-in-out infinite;border-color:#ff8c00;}'+
      '.vito-campana.sonando{animation:vitoCampanaRing .6s ease-in-out;}'+
      '.vito-campana-badge{position:absolute;top:-4px;right:-4px;min-width:22px;height:22px;padding:0 5px;border-radius:11px;background:#ff8c00;color:#221c16;font-size:12px;font-weight:bold;display:none;align-items:center;justify-content:center;box-shadow:0 0 0 2px #221c16;pointer-events:none;}'+
      '.vito-campana-menu{position:fixed;z-index:10000;background:#221c16;color:#f3e9d8;border:1px solid #6b5a44;border-radius:12px;padding:8px;display:none;flex-direction:column;gap:6px;width:min(340px,calc(100vw - 20px));max-height:72vh;overflow-y:auto;box-sizing:border-box;font-family:system-ui;}'+
      '.vito-np-sec{font-weight:bold;font-size:13px;opacity:.8;margin:4px 2px 0;}'+
      '.vito-np-item{border-left:4px solid #6b5a44;background:#2b241c;border-radius:8px;padding:8px 10px;}'+
      '.vito-np-item.recibido{border-left-color:#ff8c00;}'+
      '.vito-np-item.enviado{border-left-color:#3fa34d;}'+
      '.vito-np-item.rechazado{border-left-color:#b0392f;}'+
      '.vito-np-top{display:flex;justify-content:space-between;gap:8px;font-weight:bold;font-size:14px;}'+
      '.vito-np-time{font-weight:normal;font-size:12px;opacity:.7;white-space:nowrap;}'+
      '.vito-np-body{font-size:14px;margin-top:3px;}'+
      '.vito-np-vacio{font-size:13px;opacity:.7;padding:4px 2px;}'+
      '.vito-campana-menu button{padding:10px 12px;border-radius:8px;border:1px solid #6b5a44;background:#2b241c;color:#f3e9d8;font-size:14px;text-align:left;}'+
      '.vito-pedidos-cards{position:fixed;top:calc(10px + env(safe-area-inset-top));right:calc(10px + env(safe-area-inset-right));z-index:10002;display:flex;flex-direction:column;gap:8px;max-width:300px;width:calc(100% - 20px - env(safe-area-inset-left) - env(safe-area-inset-right));max-height:calc(100dvh - 20px - env(safe-area-inset-top) - env(safe-area-inset-bottom));overflow-y:auto;overscroll-behavior:contain;}'+
      '.vito-pedido-card,.vito-np-item{overflow-wrap:break-word;word-break:normal;min-width:0;flex-shrink:0;}'+
      '.vito-np-top{flex-wrap:wrap;row-gap:2px;align-items:center!important;font-size:13px!important;}.vito-np-top>span:first-child{flex:1 1 150px;min-width:0;line-height:1.3;}.vito-np-top>.vito-np-time{flex:0 0 auto;margin-left:auto;white-space:nowrap;}'+
      '.vito-np-mesa{font-size:17px;font-weight:800;line-height:1.25;margin-top:3px;color:var(--ink,#f3e9d8);}.vito-np-body{color:var(--ink-soft,#cbbfae);line-height:1.35;}'+
      '.vito-pedido-card{background:#221c16;border:2px solid #ff8c00;border-radius:12px;padding:10px 12px;color:#f3e9d8;font-family:system-ui;box-shadow:0 4px 16px rgba(0,0,0,.55);}'+
      '.vito-pedido-card-h{font-weight:bold;margin-bottom:4px;}'+
      '.vito-pedido-card-b{font-size:14px;opacity:.9;margin-bottom:8px;}'+
      '.vito-pedido-card-acts{display:flex;gap:6px;}'+
      '.vito-pedido-card-acts button{flex:1;padding:9px 4px;border-radius:8px;border:0;font-size:13px;font-weight:bold;text-align:center;}'+
      '.vito-np-item .vito-pedido-card-acts{margin-top:8px;}'+
      '.vito-pedido-card-acts .vito-ok{background:#3fa34d;color:#fff;}'+
      '.vito-pedido-card-acts .vito-no{background:#b0392f;color:#fff;}'+
      '.vito-campana-menu{max-height:min(72vh,calc(100dvh - 24px));box-sizing:border-box;}'+
      '.vc-avisos{display:flex;flex-direction:column;gap:8px;}.vc-avisos[hidden]{display:none!important}'+
      '.vc-avisos > #pgSalud,.vc-avisos > #actBanner,.vc-avisos > #subBar{position:static!important;inset:auto!important;left:auto!important;right:auto!important;top:auto!important;bottom:auto!important;z-index:auto!important;margin:0!important;width:auto!important;max-width:none!important;box-shadow:none!important;pointer-events:auto!important;border-radius:14px!important;}'+
      '.vc-avisos > [hidden]{display:none!important}'+
      '.vc-avisos > #layaHome{margin:0!important;}'+
      '.vito-campana-menu.vc-movil,.vito-ajustes.vc-movil{left:8px!important;right:8px!important;width:auto!important;min-width:0!important;max-width:none!important;margin:0!important;box-sizing:border-box!important;}'+
      /* Computador: los accesos rápidos son botones con su texto completo */
      '.vc-rapido .vc-corto{display:none}.vc-rapido .vc-ic{margin-right:6px}.vc-asa{display:none}.vc-fondo{display:none}'+
      /* Celular: panel de notificaciones estilo Android / iPhone */
      'html body .vito-campana-menu.vc-movil{top:calc(env(safe-area-inset-top,0px) + 8px)!important;flex-direction:row!important;flex-wrap:wrap;align-content:flex-start;gap:10px 8px!important;padding:14px 12px 6px!important;border-radius:26px!important;background:color-mix(in srgb,var(--surface,#1b1b22) 86%,transparent)!important;-webkit-backdrop-filter:blur(22px) saturate(1.3);backdrop-filter:blur(22px) saturate(1.3);border:1px solid color-mix(in srgb,var(--ink,#fff) 12%,transparent)!important;box-shadow:0 24px 60px rgba(0,0,0,.55)!important;overscroll-behavior:contain;}'+
      '.vito-campana-menu.vc-movil.vc-entra{animation:vcBaja .28s cubic-bezier(.2,.9,.25,1) both}@keyframes vcBaja{from{opacity:0;translate:0 -40px}to{opacity:1;translate:0 0}}'+
      'html body .vito-campana-menu.vc-movil > button.vc-rapido{order:-1;flex:1 1 0;min-width:0;display:flex!important;flex-direction:column;align-items:center;gap:6px;margin:0!important;padding:4px 0 2px!important;border:0!important;background:transparent!important;text-align:center;font-size:12px!important;font-weight:600;line-height:1.15;}'+
      'html body .vito-campana-menu.vc-movil > button.vc-rapido[hidden]{display:none!important}'+
      '.vito-campana-menu.vc-movil .vc-rapido .vc-ic{margin:0;width:54px;height:54px;border-radius:50%;display:grid;place-items:center;font-size:24px;background:color-mix(in srgb,var(--amber,#8b5cf6) 22%,transparent);border:1px solid color-mix(in srgb,var(--amber,#8b5cf6) 40%,transparent);transition:transform .12s}'+
      '.vito-campana-menu.vc-movil .vc-rapido:active .vc-ic{transform:scale(.92)}'+
      '.vito-campana-menu.vc-movil .vc-rapido .vc-largo{display:none}.vito-campana-menu.vc-movil .vc-rapido .vc-corto{display:block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ink-soft,#bbb)}'+
      '.vito-campana-menu.vc-movil > div:not(.vc-asa){flex:1 1 100%;min-width:0;}'+
      '.vito-campana-menu.vc-movil .vito-np-sec:first-child{font-size:20px!important;font-weight:800!important;letter-spacing:0!important;text-transform:none!important;margin:2px 4px 0!important;opacity:1!important;color:var(--ink,#fff)!important}'+
      '.vito-campana-menu.vc-movil .vito-np-sec:not(:first-child){font-size:12px!important;margin:6px 6px 0!important}'+
      '.vc-asa{flex:1 1 100%!important;height:22px;place-items:center;cursor:grab;touch-action:none}.vito-campana-menu.vc-movil .vc-asa{display:grid}.vc-asa::before{content:"";width:44px;height:5px;border-radius:3px;background:color-mix(in srgb,var(--ink,#fff) 35%,transparent)}'+
      '.vc-fondo{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.45);-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px)}.vc-fondo.on{display:block;animation:vcFade .2s both}@keyframes vcFade{from{opacity:0}to{opacity:1}}'+
      /* Tarjetas: ícono redondo + estado y hora + mesa + pedido */
      '.vito-np-item{display:flex;gap:12px;align-items:flex-start}.vito-np-cont{flex:1;min-width:0}'+
      '.vito-np-ic{flex:0 0 auto;width:40px;height:40px;border-radius:50%;display:grid;place-items:center;font-size:19px;background:color-mix(in srgb,var(--ink,#fff) 8%,transparent)}'+
      '.vito-np-item.recibido .vito-np-ic{background:color-mix(in srgb,#f5a524 24%,transparent)}.vito-np-item.enviado .vito-np-ic{background:color-mix(in srgb,#22c55e 24%,transparent)}.vito-np-item.rechazado .vito-np-ic{background:color-mix(in srgb,#e5484d 24%,transparent)}'+
      'html body .vito-campana-menu.vc-movil .vito-np-item{border-radius:20px!important;padding:12px 14px!important;border:0!important;background:color-mix(in srgb,var(--surface-2,#26262f) 92%,transparent)!important;box-shadow:0 1px 0 color-mix(in srgb,var(--ink,#fff) 6%,transparent) inset}'+
      'html body .vito-campana-menu.vc-movil .vito-np-item::before{display:none}'+
      '@media (prefers-reduced-motion:reduce){.vito-campana-menu.vc-movil.vc-entra{animation:none}}'+
      '.vito-campana-menu > *{min-width:0;max-width:100%;overflow-wrap:break-word;word-break:normal;box-sizing:border-box;}'+
      '.vito-ajustes{max-width:calc(100vw - 20px);box-sizing:border-box;}'+
      '.vito-ajustes{position:fixed;z-index:10000;background:#221c16;color:#f3e9d8;border:1px solid #6b5a44;border-radius:12px;padding:14px;display:none;flex-direction:column;gap:10px;min-width:230px;font-family:system-ui;}'+
      '.vito-ajustes label{display:flex;align-items:center;gap:8px;font-size:14px;}'+
      '.vito-ajustes input[type=range]{width:100%;}';
    document.head.appendChild(style);
    bell=document.createElement('div'); bell.className='vito-campana'; bell.title='Notificaciones'; bell.setAttribute('role','button');
    bell.innerHTML='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 16v-5a6 6 0 0 0-12 0v5l-2 2h16z"/><path d="M10 21a2 2 0 0 0 4 0"/></svg>';
    badge=document.createElement('span'); badge.className='vito-campana-badge'; bell.appendChild(badge);
    // Ya no flota: va arriba, junto al botón de IA, para no llenar la pantalla de botones.
    const topBar=document.getElementById('topActionsRow')||document.getElementById('topActions');
    if(topBar) topBar.insertBefore(bell, topBar.firstChild); else document.body.appendChild(bell);
    cardsWrap=document.createElement('div'); cardsWrap.className='vito-pedidos-cards';
    document.body.appendChild(cardsWrap);
    menu=document.createElement('div'); menu.className='vito-campana-menu';
    // Accesos rápidos: en computador se ven como botones con texto; en el celular, como los cuadritos de
    // ajustes rápidos del panel de notificaciones (ícono redondo + nombre corto).
    function rapido(b,ic,largo,corto){ b.classList.add('vc-rapido'); b.innerHTML='<span class="vc-ic">'+ic+'</span><span class="vc-largo">'+largo+'</span><span class="vc-corto">'+corto+'</span>'; b.title=largo; b.setAttribute('aria-label',largo); }
    const bPed=document.createElement('button'); rapido(bPed,'📝','Pegar pedido de WhatsApp','Pedido');
    bPed.onclick=()=>{menu.style.display='none';if(window.vitoAbrirPedidos)window.vitoAbrirPedidos();};
    const bMus=document.createElement('button'); rapido(bMus,'🎵','Ver cola de música','Música'); bMus.dataset.mus='1';
    try{ bMus.hidden=!musicaOn(); }catch(e){}   // este menú se arma después del arranque
    bMus.onclick=()=>{menu.style.display='none';const nv=document.querySelector('nav button[data-view="musica"]');if(nv)nv.click();};
    const bAdj=document.createElement('button'); rapido(bAdj,'🔊','Ajustes de voz','Voz');
    bAdj.onclick=()=>{menu.style.display='none';abrirAjustes();};
    panelBody=document.createElement('div'); panelBody.style.cssText='display:flex;flex-direction:column;gap:6px;';
    const bClr=document.createElement('button'); rapido(bClr,'🗑','Borrar historial','Borrar');
    bClr.onclick=()=>{ if(window.vitoBorrarLog) window.vitoBorrarLog(); renderPanel(); };
    // Asa para cerrar deslizando hacia arriba (como el panel de notificaciones del celular)
    const asa=document.createElement('div'); asa.className='vc-asa'; asa.setAttribute('aria-label','Cerrar notificaciones'); asa.setAttribute('role','button');
    asa.onclick=()=>{menu.style.display='none';};
    menu.append(panelBody,bPed,bMus,bAdj,bClr,asa);
    document.body.appendChild(menu);
    // Fondo oscuro detrás del panel en el celular (tocarlo cierra)
    const fondo=document.createElement('div'); fondo.className='vc-fondo'; document.body.appendChild(fondo);
    fondo.addEventListener('click',()=>{menu.style.display='none';});
    new MutationObserver(()=>{
      const abierto=menu.style.display==='flex'&&menu.classList.contains('vc-movil');
      fondo.classList.toggle('on',abierto);
      if(abierto&&!menu.dataset.anim){ menu.dataset.anim='1'; menu.classList.remove('vc-entra'); void menu.offsetWidth; menu.classList.add('vc-entra'); }
      if(menu.style.display!=='flex') delete menu.dataset.anim;
    }).observe(menu,{attributes:true,attributeFilter:['style','class']});
    // Deslizar hacia arriba para cerrar (desde el asa, o cuando ya se llegó al final de la lista)
    let y0=null;
    menu.addEventListener('touchstart',e=>{ const fin=menu.scrollTop+menu.clientHeight>=menu.scrollHeight-2; y0=(e.target.closest('.vc-asa')||fin)?e.touches[0].clientY:null; },{passive:true});
    menu.addEventListener('touchmove',e=>{ if(y0==null)return; const dy=e.touches[0].clientY-y0; if(dy<0) menu.style.translate='0 '+Math.max(dy,-160)+'px'; },{passive:true});
    menu.addEventListener('touchend',e=>{ if(y0==null)return; const dy=(e.changedTouches[0]||{}).clientY-y0; y0=null; menu.style.translate=''; if(dy<-60) menu.style.display='none'; },{passive:true});

    ajustesPanel=document.createElement('div'); ajustesPanel.className='vito-ajustes';
    const cfg=getCfg();
    const lblVoz=document.createElement('label');
    const chkVoz=document.createElement('input'); chkVoz.type='checkbox'; chkVoz.checked=cfg.voz;
    chkVoz.onchange=()=>{const c=getCfg();c.voz=chkVoz.checked;setCfg(c);};
    lblVoz.append(chkVoz,document.createTextNode('🗣️ Anunciar pedidos por voz'));
    const lblVol=document.createElement('label'); lblVol.style.flexDirection='column'; lblVol.style.alignItems='stretch';
    const spanVol=document.createElement('span'); spanVol.textContent='🔉 Volumen de la voz';
    const rango=document.createElement('input'); rango.type='range'; rango.min='0'; rango.max='100'; rango.value=Math.round(cfg.volumen*100);
    rango.oninput=()=>{const c=getCfg();c.volumen=rango.value/100;setCfg(c);};
    lblVol.append(spanVol,rango);
    const bProbar=document.createElement('button');
    bProbar.textContent='🔔 Probar sonido y voz'; bProbar.style.cssText='padding:9px 4px;border-radius:8px;border:1px solid #6b5a44;background:#2b241c;color:#f3e9d8;font-size:13px;';
    bProbar.onclick=()=>{timbre();decir('Pedido recibido, mesa de prueba');};
    ajustesPanel.append(lblVoz,lblVol,bProbar);
    document.body.appendChild(ajustesPanel);
    document.addEventListener('click',e=>{
      const enMenu=e.composedPath?e.composedPath().indexOf(menu)!==-1:menu.contains(e.target);
      if(menu.style.display==='flex' && !enMenu && e.target!==bell) menu.style.display='none';
      if(ajustesPanel.style.display==='flex' && !ajustesPanel.contains(e.target) && e.target!==bell) ajustesPanel.style.display='none';
    });
  }
  // Ancho y alto que REALMENTE se ven. En algunos Android, si algo de la página queda más ancho que la
  // pantalla, «innerWidth» crece (la página mide más de lo visible) y el panel se iba corrido a la derecha.
  function vistaReal(){
    const vv=window.visualViewport, de=document.documentElement;
    const cands=[window.innerWidth, de.clientWidth||Infinity, vv?vv.width:Infinity];
    if(window.matchMedia&&matchMedia('(pointer:coarse)').matches&&screen.width) cands.push(screen.width);
    return { w:Math.min.apply(null,cands), h:vv?vv.height:window.innerHeight, x:vv?vv.offsetLeft:0, y:vv?vv.offsetTop:0 };
  }
  function posicionarCerca(panel,anchoAprox){
    const r=bell.getBoundingClientRect(), v=vistaReal();
    // Celular: el panel se estira con CSS (left/right fijos) en vez de calcular su ancho: así ocupa siempre
    // el ancho que se ve, aunque el navegador del celular reporte medidas distintas.
    const mm=q=>window.matchMedia&&matchMedia(q).matches;
    const esCel=v.w<600||mm('(max-width:599px)')||(mm('(pointer:coarse)')&&screen.width&&Math.min(screen.width,screen.height)<600);
    if(esCel){
      const tb=document.getElementById('tabbar'),abajo=(tb&&getComputedStyle(tb).position==='fixed')?tb.offsetHeight:0;
      const top=8;   // baja desde arriba, sobre el encabezado (como el panel de notificaciones del celular)
      panel.classList.add('vc-movil');
      ['width','left'].forEach(k=>panel.style.removeProperty(k));
      panel.style.setProperty('top',top+'px','important');
      panel.style.setProperty('max-height','calc(100dvh - '+(top+abajo+12)+'px)','important');
      return;
    }
    panel.classList.remove('vc-movil');
    ['width','left','top','max-height'].forEach(k=>panel.style.removeProperty(k));
    let left=r.right-anchoAprox, top=r.top-8-panel.offsetHeight;
    if(top<8) top=r.bottom+8;
    top=Math.max(8,Math.min(top,window.innerHeight-panel.offsetHeight-8));
    if(left<8) left=8;
    const maxLeft=window.innerWidth-anchoAprox-10; if(left>maxLeft) left=maxLeft;
    panel.style.left=left+'px'; panel.style.top=top+'px';
  }
  function panelAncho(){ return Math.min(340,window.innerWidth-20); }
  function openMenuNearBell(){ menu.style.display='flex'; renderPanel(); posicionarCerca(menu,panelAncho()); }
  // Si el celular gira, sale el teclado o la vista se mueve, el panel abierto se vuelve a acomodar.
  function reacomodar(){ if(menu&&menu.style.display==='flex') posicionarCerca(menu,panelAncho()); if(ajustesPanel&&ajustesPanel.style.display==='flex') posicionarCerca(ajustesPanel,230); }
  window.addEventListener('resize',reacomodar);
  if(window.visualViewport){ visualViewport.addEventListener('resize',reacomodar); visualViewport.addEventListener('scroll',reacomodar); }

  /* ---------- Panel de la campanita: pedidos por enviar + historial (recibido / enviado) ---------- */
  function fmtHora(ts){
    const d=new Date(ts), hoy=new Date();
    const h=d.toLocaleTimeString('es-CO',{hour:'numeric',minute:'2-digit'});
    return d.toDateString()===hoy.toDateString()?h:d.toLocaleDateString('es-CO',{day:'numeric',month:'short'})+' '+h;
  }
  function leerLog(){ try{ return window.vitoLeerLog?window.vitoLeerLog():[]; }catch(e){ return []; } }
  function firmaPanel(){ const l=leerLog(), pd=pedidosPanel(); return getPendList().map(x=>x.id).join(',')+'|'+(l[0]?l[0].id:'')+'|'+l.length+'|'+(pd?pd.map(x=>x.id+':'+x.estado).join(','):''); }
  function refrescarPanel(){
    if(!menu || menu.style.display!=='flex') return;
    if(firmaPanel()===panelSig) return;
    renderPanel(); posicionarCerca(menu,panelAncho());
  }
  function renderPanel(){
    panelSig=firmaPanel();
    panelBody.textContent='';
    const pend=getPendList().sort((a,b)=>a.ts-b.ts);
    const pendIds=pend.map(x=>x.id);
    const log=leerLog().filter(e=>!(e.tipo==='recibido' && e.pid && pendIds.indexOf(e.pid)!==-1));
    const sec=t=>{ const d=document.createElement('div'); d.className='vito-np-sec'; d.textContent=t; return d; };
    const fila=(cls,titulo,hora,texto)=>{
      // Tarjeta en 3 líneas: estado + hora / mesa en grande / qué pidieron (no se amontona en celulares).
      const d=document.createElement('div'); d.className='vito-np-item '+cls;
      const partes=String(titulo).split(' · ');
      const em=(partes[0].match(/^(\S+)\s+(.*)$/)||[]);
      const ic=document.createElement('span'); ic.className='vito-np-ic'; ic.textContent=em[1]||'🔔'; ic.setAttribute('aria-hidden','true');
      const cont=document.createElement('div'); cont.className='vito-np-cont';
      const top=document.createElement('div'); top.className='vito-np-top';
      const a=document.createElement('span'); a.textContent=em[2]||partes[0];
      const b=document.createElement('span'); b.className='vito-np-time'; b.textContent=hora;
      top.append(a,b); cont.appendChild(top);
      if(partes.length>1){ const m=document.createElement('div'); m.className='vito-np-mesa'; m.textContent=partes.slice(1).join(' · '); cont.appendChild(m); }
      const body=document.createElement('div'); body.className='vito-np-body'; body.textContent=texto||'—';
      cont.appendChild(body);
      d.append(ic,cont);
      return d;
    };
    panelBody.appendChild(sec('🔔 Notificaciones'));
    if(pend.length){
      panelBody.appendChild(sec('Por enviar ('+pend.length+')'));
      pend.forEach(it=>{
        const f=fila('recibido','📥 Pedido recibido · Mesa '+it.mesa,fmtHora(it.ts),previewPedido(it.items));
        const acts=document.createElement('div'); acts.className='vito-pedido-card-acts';
        const bOk=document.createElement('button'); bOk.className='vito-ok'; bOk.textContent='✅ Enviar pedido';
        bOk.onclick=()=>aceptarPedido(it.id);
        const bNo=document.createElement('button'); bNo.className='vito-no'; bNo.textContent='❌ Rechazar';
        bNo.onclick=()=>rechazarPedido(it.id);
        acts.append(bOk,bNo); (f.querySelector('.vito-np-cont')||f).appendChild(acts);
        panelBody.appendChild(f);
      });
    }
    // 🍺 Los pedidos que hace la gente (app de los clientes, QR, meseros, WhatsApp): en curso y los de hoy, con su estado.
    const pd=pedidosPanel();
    if(pd){
      const ORI={qr:'📱 App',whatsapp:'💬 WhatsApp',mesero:'🧑‍🍳 Mesero',voz:'🎙️ Voz'};
      const curso=pd.filter(x=>['recibido','preparacion','listo'].includes(x.estado)), hechos=pd.filter(x=>['entregado','cancelado'].includes(x.estado));
      const filaPed=x=>{
        const est=(window.vitoPedidos.EST||{})[x.estado]||x.estado;
        const f=fila(x.estado==='cancelado'?'rechazado':'enviado',(x.estado==='listo'?'✅ ':x.estado==='cancelado'?'❌ ':x.estado==='entregado'?'🍽️ ':'🍺 ')+'Pedido '+est.toLowerCase()+' · '+(x.mesaNombre||('Mesa '+x.mesa)),
          fmtHora(x.recibidoEn||x.at), (x.items||[]).map(i=>i.qty+' '+i.name+(i.ok===false?' ⚠️':'')).join(', ')+(x.nota?' · 📝 '+x.nota:'')+(ORI[x.origen]?' · '+ORI[x.origen]:''));
        f.dataset.pedido=x.id; f.style.cursor='pointer'; f.title='Abrir la cuenta';
        f.onclick=ev=>{ if(ev.target.closest('button')) return; menu.style.display='none'; try{ openTableModal(x.mesa); }catch(e){} };
        return f;
      };
      if(curso.length){ panelBody.appendChild(sec('En curso ('+curso.length+')')); curso.forEach(x=>panelBody.appendChild(filaPed(x))); }
      panelBody.appendChild(sec('Pedidos de hoy'));
      if(!hechos.length && !curso.length && !pend.length){
        const v=document.createElement('div'); v.className='vito-np-vacio'; v.textContent='Todavía no hay pedidos. Aquí salen los que hace la gente desde la app, el QR de la mesa o los meseros.';
        panelBody.appendChild(v);
      } else if(!hechos.length){
        const v=document.createElement('div'); v.className='vito-np-vacio'; v.textContent='Todavía no se ha entregado ningún pedido hoy.';
        panelBody.appendChild(v);
      } else hechos.forEach(x=>panelBody.appendChild(filaPed(x)));
      return;
    }
    panelBody.appendChild(sec('Historial'));
    if(!log.length){
      const v=document.createElement('div'); v.className='vito-np-vacio'; v.textContent='Todavía no hay pedidos.';
      panelBody.appendChild(v);
    } else {
      const nombres={recibido:'📥 Pedido recibido',enviado:'✅ Pedido enviado',rechazado:'❌ Pedido rechazado'};
      log.forEach(e=>{
        let ms=e.mesa;
        if(ms==null||ms===''){try{const pp=window.vitoPedidos&&window.vitoPedidos.lista().find(p=>p.id===e.pid);if(pp)ms=pp.mesa;}catch(x){}}
        panelBody.appendChild(fila(e.tipo,(nombres[e.tipo]||e.tipo)+(ms!=null&&ms!==''?' · Mesa '+ms:''),fmtHora(e.ts),e.texto));
      });
    }
  }
  function abrirAjustes(){ ajustesPanel.style.display='flex'; posicionarCerca(ajustesPanel,230); }

  /* ---------- La campana queda fija (ya no se arrastra): solo se toca para abrir/cerrar el menú ---------- */
  function wireTap(){
    bell.addEventListener('click',()=>{
      menu.style.display=(menu.style.display==='flex')?'none':'flex';
      if(menu.style.display==='flex') openMenuNearBell();
    });
  }
  /* ---------- 📣 Avisos de ORDEVA en la campanita ----------
     Los avisos fijos de ORDEVA (los pagos no van a sonar / falta un permiso, versión nueva de la app, prueba gratis o
     plan por vencer) ya no salen en la pantalla principal: quedan aquí, con sus mismos botones, y la campanita los
     cuenta en su número. Cada aviso sigue siendo el mismo (su lógica no cambia): solo cambia dónde se ve. */
  // layaHome: la tarjeta «🧠 ORDEVA» del inicio (pagos que llegaron y no están en ninguna cuenta, lo que se acaba…):
  // también va aquí y no en la pantalla principal (1.43.8). Cuenta cada aviso de la tarjeta.
  const AVISOS=['pgSalud','actBanner','subBar','layaHome'];
  let avisosBox=null, avisosN=0;
  const avisoVisible=e=>!!e&&!e.hidden&&!!e.innerHTML.trim();
  function avisosVento(){
    if(!menu||!panelBody) return 0;
    if(!avisosBox){
      avisosBox=document.createElement('div'); avisosBox.id='vcAvisos'; avisosBox.className='vc-avisos';
      avisosBox.innerHTML='<div class="vito-np-sec vc-avisos-tit">📣 Avisos de ORDEVA</div>';
      menu.insertBefore(avisosBox,panelBody);
      // Al tocar un botón de un aviso se cierra la campanita (así se ve lo que abre: permiso, planes…).
      avisosBox.addEventListener('click',e=>{ if(e.target.closest('[data-a="x"]')) return; if(e.target.closest('button,a,#subBar')) setTimeout(()=>{ menu.style.display='none'; },0); });
    }
    AVISOS.forEach(id=>{ const e=document.getElementById(id); if(e&&(e.parentNode!==avisosBox||e!==avisosBox.lastElementChild)) avisosBox.appendChild(e); });
    const n=AVISOS.reduce((t,id)=>{ const e=document.getElementById(id); if(!avisoVisible(e)) return t; return t+(id==='layaHome'?Math.max(1,e.querySelectorAll('.lh-it').length):1); },0);
    avisosBox.hidden=!n;
    return n;
  }
  function check(){
    const pendList=getPendList(), songList=getSongList();
    const nAv=avisosVento(); avisosN=nAv;
    let nCurso=0; try{ const pd=pedidosPanel(); if(pd) nCurso=pd.filter(x=>['recibido','preparacion'].includes(x.estado)).length; }catch(e){}
    const total=pendList.length+nCurso+songList.length+nAv;
    sincronizarTarjetas(pendList);
    refrescarPanel();
    if(total>0){
      badge.textContent=total>99?'99+':String(total);
      badge.style.display='flex';
      bell.classList.add('activa');
    } else {
      badge.style.display='none';
      bell.classList.remove('activa');
    }
    const nuevosPed=pendList.filter(x=>lastPendIds.indexOf(x.id)===-1);
    const nuevasCan=songList.filter(x=>lastSongIds.indexOf(x.id)===-1);
    // Avisos de pedidos y de música se pueden apagar por separado (Ajustes → Notificaciones del
    // celular → Qué avisos quieres recibir); si ambos están apagados, ni siquiera suena la campana.
    const avisaPed=(!window.notifPedidos||window.notifPedidos())&&nuevosPed.length;
    const avisaMus=(!window.notifMusica||window.notifMusica())&&nuevasCan.length;
    if(lastTotal>=0 && (avisaPed||avisaMus)){
      timbre();
      bell.classList.remove('sonando'); void bell.offsetWidth; bell.classList.add('sonando');
      if(avisaPed)nuevosPed.forEach(it=>{
        try{showToast('📥 Pedido recibido · '+tableLabel(it.mesa)+': '+previewPedido(it.items));}catch(e){}
        decir('Pedido recibido, '+tableLabel(it.mesa));
      });
      if(avisaMus)nuevasCan.forEach(it=>{
        try{showToast('🎵 Canción pedida: '+tableLabel(it.mesa));}catch(e){}
        decir('Canción pedida, '+tableLabel(it.mesa));
      });
    }
    lastTotal=total; lastPendIds=pendList.map(x=>x.id); lastSongIds=songList.map(x=>x.id);
  }
  window.vitoDecir=decir;
  window.vitoTimbre=()=>{try{timbre();if(bell){bell.classList.remove('sonando');void bell.offsetWidth;bell.classList.add('sonando');}}catch(e){}};
  window.vitoCheckNotif=()=>{ try{ if(bell) check(); }catch(e){} };
  window.vitoRefrescarNotif=()=>{ try{ refrescarPanel(); }catch(e){} };
  function init(){
    buildUI();
    wireTap();
    const pendList=getPendList(), songList=getSongList();
    lastTotal=pendList.length+songList.length;
    lastPendIds=pendList.map(x=>x.id); lastSongIds=songList.map(x=>x.id);
    check();
    setInterval(check,3000);
    // Un aviso de ORDEVA que aparece o se va: la campanita se actualiza al momento (y se mueve si es uno nuevo).
    setInterval(()=>{ const n=avisosVento(); if(n!==avisosN){ const mas=n>avisosN; check(); if(mas&&bell){ bell.classList.remove('sonando'); void bell.offsetWidth; bell.classList.add('sonando'); } } },1000);
    window.addEventListener('storage',e=>{if(e.key===PKEY||e.key===CKEY||e.key===LKEY)check();});
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();
