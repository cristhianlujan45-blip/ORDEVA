/* ORDEVA · app/05-pedidos-canciones-recibidos.js — antes estaba dentro de index.html (línea 20731). Se carga en el mismo lugar y orden. */
/* Pedidos y canciones recibidos por WhatsApp desde el QR de mesa */
(function(){
  const KEY='vito_musica';
  const PKEY='vito_pedidos_pend';
  const load=()=>{try{return JSON.parse(localStorage.getItem(KEY))||[]}catch(e){return[]}};
  const save=l=>{try{localStorage.setItem(KEY,JSON.stringify(l))}catch(e){}};
  const loadPend=()=>{try{return JSON.parse(localStorage.getItem(PKEY))||[]}catch(e){return[]}};
  const savePend=l=>{try{localStorage.setItem(PKEY,JSON.stringify(l))}catch(e){}try{window.vitoCheckNotif&&window.vitoCheckNotif();}catch(e){}};

  /* Historial de notificaciones (pedido recibido / enviado / rechazado) que se ve al abrir la campanita */
  const LKEY='vito_notif_log';
  const loadLog=()=>{try{return JSON.parse(localStorage.getItem(LKEY))||[]}catch(e){return[]}};
  function logNotif(tipo,mesa,items,pid){
    const texto=previewItems(items||[]).map(a=>a.qty+' '+a.name+(a.ok?'':' ⚠️')).join(', ');
    const l=loadLog();
    l.unshift({id:Date.now()+'-'+Math.random().toString(36).slice(2,6),tipo:tipo,mesa:mesa,texto:texto,pid:pid||'',ts:Date.now()});
    try{localStorage.setItem(LKEY,JSON.stringify(l.slice(0,80)));}catch(e){}
    try{window.vitoRefrescarNotif&&window.vitoRefrescarNotif();}catch(e){}
  }

  /* Vista previa de los ítems sin tocar la cuenta todavía */
  function previewItems(items){
    return items.map(it=>{
      const product=matchProductVoice(it.productText);
      const qn=Math.max(1,it.qty||1);
      return product?{ok:true,name:product.name,qty:qn}:{ok:false,name:it.productText,qty:qn};
    });
  }

  function importar(txt){
    const c=/cuenta\s+mesa\s*(\d+)\s*[:\-]?\s*([\s\S]*)/i.exec(txt||'');
    if(c){
      const cid=parseInt(c[1],10);
      if(!data.tables[cid]) return '⚠️ La mesa '+cid+' no existe en la app.';
      const nota=c[2].trim().replace(/\s+/g,' ');
      setTimeout(()=>{try{openBillSummary(cid);}catch(e){}},0);
      return '🧾 Mesa '+cid+' pide la cuenta. Total a pagar: $'+tableBalance(cid).toLocaleString('es-CO')+(nota?'\nNota: '+nota:'');
    }
    const s=/canci[oó]n\s+mesa\s*(\d+)\s*[:\-]?\s*([\s\S]+)/i.exec(txt||'');
    if(s){
      const song=s[2].trim().replace(/\s+/g,' ');
      return window.vitoAddSong(parseInt(s[1],10),song);
    }
    const m=/mesa\s*(\d+)\s*[:\-]?\s*([\s\S]*)/i.exec(txt||'');
    if(!m) return '⚠️ No encontré "MESA N" en el mensaje.';
    const id=parseInt(m[1],10);
    if(!data.tables[id]) return '⚠️ La mesa '+id+' no existe en la app.';
    const p=parseVoiceCommand('mesa '+id+', '+m[2].replace(/\n+/g,', '));
    if(!p.items || !p.items.length) return '⚠️ No se reconoció ningún producto en el pedido.';
    recibirPedido(id,p.items);
    const prev=previewItems(p.items).map(a=>a.qty+' '+a.name).join(', ');
    return '🕓 Pedido recibido de Mesa '+id+' (pendiente de despachar): '+prev;
  }

  /* Un pedido nuevo llega (WhatsApp o QR en vivo): queda pendiente y se anota "Pedido recibido" */
  function recibirPedido(mesa,items){
    // Un solo camino para todos los pedidos (QR, WhatsApp pegado, meseros): la lista de pedidos.
    if(window.vitoPedidos){ const p=window.vitoPedidos.entrante({mesa:mesa,items:(items||[]).map(i=>({n:i.productText,q:i.qty||1}))},'whatsapp'); return p&&p.id; }
    const pid=Date.now()+'-'+Math.random().toString(36).slice(2,6);
    logNotif('recibido',mesa,items,pid);
    const pend=loadPend();
    pend.push({id:pid,mesa:mesa,items:items,ts:Date.now()});
    savePend(pend);
    return pid;
  }

  /* Enviar (despachar) un pedido pendiente: recién ahí se añade a la cuenta y se anota "Pedido enviado" */
  function confirmarPendiente(pid){
    if(window.vitoPedidos){ window.vitoPedidos.cambiar(pid,'recibido'); return {added:[],notFound:[]}; }
    const pend=loadPend();
    const it=pend.find(x=>x.id===pid);
    if(!it) return null;
    const r=applyVoiceItems(it.mesa,it.items,'add');
    savePend(pend.filter(x=>x.id!==pid));
    logNotif('enviado',it.mesa,it.items,pid);
    let out='✅ Pedido enviado · Mesa '+it.mesa+': ';
    out+=r.added.length?r.added.map(a=>a.qty+' '+a.name).join(', '):'—';
    if(r.notFound.length) out+='\n⚠️ No reconocí (agrégalo a mano): '+r.notFound.join(', ');
    try{showToast(out);}catch(e){alert(out);}
    try{window.vitoDecir&&window.vitoDecir('Pedido enviado, mesa '+it.mesa);}catch(e){}
    return r;
  }
  function descartarPendiente(pid){
    if(window.vitoPedidos){ window.vitoPedidos.cambiar(pid,'cancelado'); return; }
    const pend=loadPend();
    const it=pend.find(x=>x.id===pid);
    savePend(pend.filter(x=>x.id!==pid));
    if(it){
      logNotif('rechazado',it.mesa,it.items,pid);
      try{showToast('❌ Pedido rechazado · Mesa '+it.mesa);}catch(e){}
    }
  }
  window.vitoRecibirPedido=recibirPedido;
  window.vitoDespacharPedido=confirmarPendiente;
  window.vitoRechazarPedido=descartarPendiente;
  window.vitoLeerLog=loadLog;
  window.vitoLogNotif=logNotif;
  window.vitoBorrarLog=()=>{try{localStorage.removeItem(LKEY);}catch(e){}};

  function btn(t,fn){const b=document.createElement('button');b.textContent=t;b.style.cssText='padding:10px 14px;font-size:16px;margin:2px';b.onclick=fn;return b;}
  function overlay(){
    const o=document.createElement('div');
    o.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:99999;display:flex;align-items:center;justify-content:center;padding:12px';
    const b=document.createElement('div');
    b.style.cssText='background:#221c16;color:#f3e9d8;padding:16px;border-radius:12px;width:100%;max-width:440px;max-height:90vh;overflow:auto;font-family:system-ui';
    o.appendChild(b);document.body.appendChild(o);return {o,b};
  }
  function abrir(musica){
    const {o,b}=overlay();
    const h=document.createElement('b');h.textContent=musica?'🎵 Música – canciones pedidas':'📥 Pedidos de WhatsApp';b.appendChild(h);
    const ta=document.createElement('textarea');
    ta.placeholder=musica?'Pega aquí: CANCION MESA 5: canción - artista':'Pega aquí: PEDIDO MESA 5: 2 águilas, 1 coca cola';
    ta.style.cssText='display:block;width:100%;height:'+(musica?70:110)+'px;margin:10px 0;padding:10px;font-size:16px;box-sizing:border-box';
    b.appendChild(ta);
    const pendWrap=document.createElement('div');
    const list=document.createElement('div');
    function renderPend(){
      pendWrap.textContent='';
      if(musica) return;
      const pend=loadPend();
      if(!pend.length) return;
      const h2=document.createElement('div');h2.style.cssText='margin-top:10px;font-weight:bold;';h2.textContent='🔔 Pedidos activos por despachar ('+pend.length+')';pendWrap.appendChild(h2);
      pend.sort((a,b)=>a.ts-b.ts).forEach(it=>{
        const r=document.createElement('div');
        r.style.cssText='padding:8px 0;border-top:1px solid #443';
        const t=document.createElement('div');
        t.textContent=i18nPut(espacioN())+' '+it.mesa+' · '+previewItems(it.items).map(a=>a.qty+' '+a.name+(a.ok?'':' ⚠️')).join(', ');
        r.appendChild(t);
        const actions=document.createElement('div');
        actions.appendChild(btn('✅ Despachar',()=>{confirmarPendiente(it.id);renderPend();}));
        actions.appendChild(btn('🗑 Descartar',()=>{descartarPendiente(it.id);renderPend();}));
        r.appendChild(actions);
        pendWrap.appendChild(r);
      });
    }
    b.appendChild(pendWrap);
    function render(){
      list.textContent='';
      if(!musica) return;
      const l=load();
      if(!l.length){list.textContent='No hay canciones pedidas.';return;}
      l.forEach(it=>{
        const r=document.createElement('div');
        r.style.cssText='display:flex;gap:4px;align-items:center;padding:8px 0;border-top:1px solid #443';
        const t=document.createElement('span');
        t.style.cssText='flex:1;'+(it.done?'text-decoration:line-through;opacity:.5':'');
        t.textContent=i18nPut(espacioN())+' '+it.mesa+' · '+it.song;
        r.appendChild(t);
        r.appendChild(btn('🔎',()=>{ if(window.ytOpenMusic) window.ytOpenMusic(null, it.song); else window.open('https://music.youtube.com/search?q='+encodeURIComponent(it.song),'_blank'); }));
        r.appendChild(btn('✔',()=>{it.done=!it.done;save(l);render();}));
        r.appendChild(btn('🗑',()=>{save(l.filter(x=>x.id!==it.id));render();}));
        list.appendChild(r);
      });
    }
    b.appendChild(btn(musica?'Agregar a la cola':'Recibir pedido (queda pendiente)',()=>{
      try{const msg=importar(ta.value);alert(msg);ta.value='';render();renderPend();if(msg.charAt(0)==='🧾')o.remove();}catch(e){alert('Error: '+e.message);}
    }));
    b.appendChild(btn('Cerrar',()=>o.remove()));
    b.appendChild(list);render();renderPend();
  }
  window.vitoAbrirPedidos=()=>abrir(false);
  window.vitoAbrirMusicaWA=()=>abrir(true);
  window.vitoPendCount=()=>loadPend().length;
})();
