/* ORDEVA · app/09-cuentas-mesa-modulo.js — antes estaba dentro de index.html (línea 21373). Se carga en el mismo lugar y orden. */
/* === Cuentas de mesa · módulo v2: QR permanentes, cierre automático, historial, gráficas, música, letra === */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const LS=(k,d)=>{try{return JSON.parse(localStorage.getItem(window.ventoClave(k)))||d}catch(e){return d}};
const SS=(k,v)=>{try{localStorage.setItem(window.ventoClave(k),JSON.stringify(v))}catch(e){}};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const dkey=(d=new Date())=>d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();
const btn=(t,f)=>{const e=document.createElement('button');e.className='btn-ghost';e.type='button';e.textContent=t;e.onclick=f;return e;};

/* ---------- Letra: tipografía, color, tamaño ---------- */
const FONTS={manrope:"'Manrope',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif",orig:"'Share Tech Mono','IBM Plex Mono',monospace",sans:"system-ui,-apple-system,'Segoe UI',Roboto,sans-serif",serif:"Georgia,'Times New Roman',serif",round:"'Trebuchet MS','Segoe UI',sans-serif",mono:"'Courier New',monospace"};
// "manrope" es el nuevo default (va con el rediseño 2026); "orig" (la
// monoespaciada del diseño viejo) se deja disponible para quien la prefiera,
// pero ya no se fuerza sola por encima de la tipografía de cada paleta.
function tipo(){return Object.assign({f:'manrope',c:'',s:100},LS('vito_tipo',{}));}
function aplicarTipo(){
  const t=tipo(),f=FONTS[t.f]||FONTS.orig;
  let st=$('tipoStyle');if(!st){st=document.createElement('style');st.id='tipoStyle';document.head.appendChild(st);}
  let css=':root{--font-main:'+f+'!important}html body,html body button,html body input,html body select,html body textarea{font-family:'+f+'!important}';
  if(t.c)css+=':root{--ink:'+t.c+'!important;--ink-soft:color-mix(in srgb,'+t.c+' 70%,transparent)!important}';
  if(+t.s!==100)css+=':root{--tz:'+(t.s/100)+'}';   // se aplica al contenido (ver «Letra más grande SIN zoom en todo el body»)
  st.textContent=css;
}
function iniTipo(){
  const t=tipo();$('tyFont').value=t.f;$('tySize').value=t.s;$('tySizeLbl').textContent=t.s+'%';if(t.c)$('tyColor').value=t.c;
  const g=(k,v)=>{const x=tipo();x[k]=v;SS('vito_tipo',x);aplicarTipo();};
  $('tyFont').onchange=e=>g('f',e.target.value);
  $('tyColor').oninput=e=>g('c',e.target.value);
  $('tySize').oninput=e=>{$('tySizeLbl').textContent=e.target.value+'%';g('s',+e.target.value);};
  $('tyReset').onclick=()=>{SS('vito_tipo',{});aplicarTipo();iniTipo();};
}

/* ---------- Ajustes por categorías ---------- */
function mostrarCategoriaAjustes(cat){
  document.querySelectorAll('#view-ajustes .settings-group[data-cat]').forEach(g=>{ g.hidden = g.dataset.cat !== cat || g.dataset.off === '1'; });
  $('ajustesCats').hidden = true;
  $('ajustesBackBtn').hidden = false;
  try{ $('ajBuscarBox').hidden = true; }catch(e){}
  window.scrollTo({ top: 0 });
}
function volverACategoriasAjustes(){
  document.querySelectorAll('#view-ajustes .settings-group[data-cat]').forEach(g=>{ g.hidden = true; });
  $('ajustesCats').hidden = false;
  $('ajustesBackBtn').hidden = true;
  try{ $('ajBuscarBox').hidden = false; }catch(e){}
}
window.volverACategoriasAjustes = volverACategoriasAjustes;
window.mostrarCategoriaAjustes = mostrarCategoriaAjustes;
/* 🔎 Buscador de ajustes: busca en todos los títulos, opciones, botones y explicaciones de Ajustes y lleva directo. */
function ajNorm(t){ return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ ]+/g, ' ').replace(/\s+/g, ' ').trim(); }
const AJ_SINON = { notificacion: 'avisos alertas sonido notificaciones', aviso: 'notificaciones alertas', nequi: 'pagos daviplata pasarela', pago: 'nequi daviplata pasarela', voz: 'hablar anunciar microfono', clave: 'contrasena', contrasena: 'clave password', qr: 'codigo mesas pedidos', iva: 'impuesto factura', musica: 'cancion youtube tv', tv: 'televisor transmitir musica', correo: 'email recuperar' };
function ajIndice(){
  const out = [], cats = {};
  document.querySelectorAll('#ajustesCats .ajustes-cat').forEach(b => { cats[b.dataset.cat] = (b.querySelector('.ac-label') || b).textContent.trim(); });
  document.querySelectorAll('#view-ajustes .settings-group[data-cat]').forEach(g => {
    if(g.dataset.off === '1') return;
    const cat = g.dataset.cat, tg = (g.querySelector('h2') || {}).textContent || '';
    g.querySelectorAll('h2, h3, .settings-row, button, label, summary, .lng-step strong').forEach(el => {
      if(el.closest('[hidden]') && el.closest('[hidden]') !== g) return;
      if(el.matches('button') && el.closest('.settings-row')) return;          // el renglón ya lo incluye
      const titulo = (el.querySelector && el.querySelector('strong') ? el.querySelector('strong').textContent : el.textContent).trim().replace(/\s+/g, ' ').slice(0, 90);
      const texto = el.textContent.replace(/\s+/g, ' ').trim();
      if(!titulo || titulo.length < 2) return;
      out.push({ el, cat, catNom: cats[cat] || cat, grupo: tg.trim(), titulo, n: ajNorm(texto + ' ' + tg + ' ' + (cats[cat] || '')) });
    });
  });
  return out;
}
function ajBuscar(q){
  const box = document.getElementById('ajBuscarRes'); if(!box) return;
  const qn = ajNorm(q);
  if(qn.length < 2){ box.hidden = true; box.innerHTML = ''; return; }
  // Palabras sueltas como «de», «la» no cuentan; cada palabra (o su sinónimo) tiene que estar al COMIENZO de una
  // palabra del ajuste («tv» no encuentra «actividad»). Si la categoría o el grupo también la nombran, suma más.
  const VACIAS = new Set(['de', 'la', 'el', 'los', 'las', 'del', 'y', 'en', 'a', 'al', 'para', 'con', 'mi', 'mis', 'un', 'una', 'que', 'como', 'por']);
  const palabras = qn.split(' ').filter(w => w && !VACIAS.has(w)).map(w => w + ' ' + (AJ_SINON[w.replace(/(es|s)$/, '')] || AJ_SINON[w] || ''));
  if(!palabras.length){ box.hidden = true; box.innerHTML = ''; return; }
  const esta = (t, a) => (' ' + t).includes(' ' + a);
  const res = ajIndice().map(x => {
    let p = 0; const lugar = ajNorm(x.catNom + ' ' + (x.grupo || ''));
    palabras.forEach(w => { const alt = w.trim().split(' ').filter(Boolean);
      if(alt.some(a => esta(x.n, a))) p += esta(x.n, alt[0]) ? 2 : 1; else p -= 5;
      if(esta(lugar, alt[0])) p += 2; else if(alt.some(a => esta(lugar, a))) p += 1; });
    if(ajNorm(x.titulo).includes(qn)) p += 4;
    return [p, x];
  }).filter(r => r[0] > 0).sort((a, b) => b[0] - a[0]);
  const vistos = new Set(), top = [];
  res.forEach(([, x]) => { const k = x.cat + '|' + x.titulo; if(!vistos.has(k) && top.length < 12){ vistos.add(k); top.push(x); } });
  box.hidden = false;
  box.innerHTML = '';
  if(!top.length){ box.innerHTML = '<div class="settings-desc">No encontré nada con «' + q.replace(/[<>&]/g, '') + '». Prueba con otra palabra.</div>'; return; }
  top.forEach(x => {
    const b = document.createElement('button'); b.type = 'button';
    b.innerHTML = '<b></b><small></small>'; b.querySelector('b').textContent = x.titulo; b.querySelector('small').textContent = x.catNom + (x.grupo && x.grupo !== x.titulo ? ' › ' + x.grupo : '');
    b.onclick = () => {
      mostrarCategoriaAjustes(x.cat); box.hidden = true;
      const el = x.el.closest('.settings-row') || x.el;
      setTimeout(() => { try{ el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.classList.add('aj-flash'); setTimeout(() => el.classList.remove('aj-flash'), 2200); }catch(e){} }, 120);
    };
    box.appendChild(b);
  });
}
/* 🔔 Notificaciones del celular (app de Android): estado real y botones para prenderlas. */
function avEstado(){
  const A = window.VentoAndroid, e = document.getElementById('avEstado'), box = document.getElementById('avEstadoBox'), l = document.getElementById('avLista');
  if(!e) return null;
  const app = !!(A && typeof A.avisosEstado === 'function');
  ['avActivar', 'avAjustes', 'avGuia', 'avProbar', 'avInicio', 'avBateria'].forEach(id => { const x = document.getElementById(id); if(x) x.hidden = !app; });
  document.getElementById('avWeb').hidden = app;
  if(!app){ box.classList.remove('ok'); e.textContent = 'ℹ️ Estás en el navegador.'; l.textContent = ''; return null; }
  let st = {}; try{ st = JSON.parse(A.avisosEstado() || '{}'); }catch(x){}
  const ch = st.canales || {}, mal = [];
  if(!st.prendidos) mal.push('«Mostrar notificaciones» está APAGADO');
  Object.entries({ vento_pedidos2: 'Pedidos y cuentas', vento_musica2: 'Canciones pedidas' }).forEach(([k, n]) => { const c = ch[k]; if(!c) return; if(c.importancia === 0) mal.push('la categoría «' + n + '» está apagada'); else { if(c.importancia < 4) mal.push('«' + n + '» no sale flotante'); if(c.bloqueo === -1) mal.push('«' + n + '» no sale en la pantalla de bloqueo'); if(!c.sonido) mal.push('«' + n + '» sin sonido'); } });
  box.classList.toggle('ok', !mal.length); box.classList.toggle('no', !!mal.length);
  e.textContent = mal.length ? '🔕 No te van a llegar bien los avisos con la app cerrada.' : '✅ Notificaciones prendidas: te llegan con la app cerrada y la pantalla bloqueada.';
  l.textContent = mal.length ? 'Falta: ' + mal.join('; ') + '.' : '';
  return { ok: !mal.length, st };
}
function avBarra(){
  const A = window.VentoAndroid; if(!A || typeof A.avisosEstado !== 'function') return;
  let st = {}; try{ st = JSON.parse(A.avisosEstado() || '{}'); }catch(x){}
  let b = document.getElementById('avBarra');
  if(st.prendidos){ if(b) b.remove(); return; }
  try{ if(sessionStorage.getItem('avBarraNo')) return; }catch(x){}
  if(b) return;
  b = document.createElement('div'); b.id = 'avBarra'; b.className = 'av-barra';
  b.innerHTML = '<span style="flex:1">🔕 Las notificaciones de ORDEVA están apagadas en tu celular: no te llegan los pedidos con la app cerrada.</span><button type="button" class="si">Activar</button><button type="button" class="x" aria-label="Cerrar">✕</button>';
  b.querySelector('.si').onclick = () => { try{ A.avisosActivar(); }catch(x){} showToast('En la pantalla que se abre prende «Mostrar notificaciones», «flotantes», «pantalla de bloqueo», sonido y vibración.', 9000); };
  b.querySelector('.x').onclick = () => { b.remove(); try{ sessionStorage.setItem('avBarraNo', '1'); }catch(x){} };
  document.body.appendChild(b);
}
function iniAvisos(){
  const A = window.VentoAndroid, g = id => document.getElementById(id);
  if(g('avActivar')) g('avActivar').onclick = () => { try{ A.avisosActivar(); }catch(x){} showToast('Prende: «Mostrar notificaciones», «Notificaciones flotantes», «Pantalla de bloqueo», «Sonido» y «Vibración».', 9000); };
  if(g('avAjustes')) g('avAjustes').onclick = () => { try{ A.avisosAjustes(); }catch(x){} };
  if(g('avProbar')) g('avProbar').onclick = () => { let ok = false; try{ ok = A.notificar('🆕 Pedido de prueba · Mesa 1', '2 Poker, 1 Águila — así te avisa ORDEVA aunque esté cerrada.', 'pedidos', true); }catch(x){} showToast(ok ? '🔔 Mira la barra de notificaciones.' : '⚠️ Android no deja mostrar avisos: toca «Activar las notificaciones».', 7000); setTimeout(avEstado, 800); };
  if(g('avInicio')) g('avInicio').onclick = () => { try{ A.ajustesInicio(); }catch(x){} };
  if(g('avBateria')) g('avBateria').onclick = () => { try{ A.ajustesBateria(); }catch(x){} };
  document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'visible'){ avEstado(); avBarra(); } });
  avEstado(); setTimeout(avBarra, 5000);
  const bq = g('ajBuscar');
  if(bq){ let t = null; bq.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => ajBuscar(bq.value), 150); }); bq.addEventListener('keydown', e => { if(e.key === 'Enter'){ e.preventDefault(); const f = document.querySelector('#ajBuscarRes button'); if(f) f.click(); } }); }
}
window.ajBuscar = ajBuscar; window.avEstado = avEstado;
function iniAjustesCats(){
  document.querySelectorAll('.ajustes-cat').forEach(b=>{
    b.addEventListener('click', ()=>mostrarCategoriaAjustes(b.dataset.cat));
  });
  $('ajustesBackBtn').addEventListener('click', volverACategoriasAjustes);
  try{ iniAvisos(); }catch(e){}
  document.querySelectorAll('.ajustes-cat[data-cat="avisos"]').forEach(b => b.addEventListener('click', () => setTimeout(avEstado, 50)));
}

/* ---------- Cierre automático de caja ---------- */
const acCfg=()=>Object.assign({on:false,times:[],last:{},open:'saltar'},LS('vito_auto',{}));
function acRender(){
  const c=acCfg();$('acOn').checked=c.on;$('acOpen').value=c.open;
  const l=$('acList');l.textContent='';
  if(!c.times.length){l.textContent='Sin horarios. Elige una hora y toca Agregar horario.';return;}
  c.times.forEach(t=>{const b=btn(t+'  ✕',()=>{const x=acCfg();x.times=x.times.filter(y=>y!==t);SS('vito_auto',x);acRender();});b.style.margin='3px';l.appendChild(b);});
}
function cierreAuto(c){
  if(c.open==='cerrar'){const oc=window.confirm;window.confirm=()=>true;try{closeCashRegister({ auto: true });}finally{window.confirm=oc;}return;}
  const last=data.closures.length?data.closures[0]:null,fromISO=last?last.date:null,toISO=new Date().toISOString();
  const s=computeClosureStats(fromISO,toISO);
  if(!s.tickets.length){showToast('Cierre automático: no había cuentas nuevas.');return;}
  data.closures.unshift({id:Date.now().toString(),date:toISO,from:fromISO,businessName:data.businessName,ticketCount:s.tickets.length,totalSold:s.totalSold,totalEfectivo:s.totalEfectivo,totalTransferencia:s.totalTransferencia,totalDebe:s.totalDebe,hourly:s.hourly,auto:true});
  saveData();renderMesas();renderHistorial();showToast('🔒 Cierre automático de caja hecho.');
}
function acTick(){
  if(typeof data==='undefined'||!data)return;
  const c=acCfg();if(!c.on||!c.times.length)return;
  const now=new Date(),k=dkey(now);
  c.times.forEach(t=>{
    const [h,m]=t.split(':').map(Number),at=new Date(now);at.setHours(h,m,0,0);
    const d=now-at;
    if(d>=0&&d<=4*36e5&&c.last[t]!==k){c.last[t]=k;SS('vito_auto',c);cierreAuto(c);}
  });
}
function iniAuto(){
  acRender();
  $('acOn').onchange=e=>{const c=acCfg();c.on=e.target.checked;SS('vito_auto',c);acTick();};
  $('acOpen').onchange=e=>{const c=acCfg();c.open=e.target.value;SS('vito_auto',c);};
  $('acAdd').onclick=()=>{const v=$('acTime').value;if(!v)return;const c=acCfg();if(!c.times.includes(v))c.times.push(v);c.times.sort();SS('vito_auto',c);acRender();};
  setInterval(acTick,30000);document.addEventListener('visibilitychange',acTick);setTimeout(acTick,3000);
}

/* ---------- Historial: pagó / debe + filtro ---------- */
let filtro='todos';
function pagarDeuda(h,m){
  (h.payments||[]).forEach(p=>{if(p.method==='debe'){p.method=m;p.note=(p.note||'Pago')+' (pagó después)';}});
  h.debt=0;h.paidLater=new Date().toISOString();saveData();renderHistorial();showToast('Deuda marcada como pagada.');try{window.libretaPintar&&window.libretaPintar();}catch(e){}
}
function mejorarHist(){
  if(typeof data==='undefined'||!data)return;
  $('histList').querySelectorAll(':scope > .hist-row').forEach(row=>{
    const h=data.history[+row.dataset.idx];if(!h)return;
    const e=(h.debt||0)>0?'deben':'pagaron';row.dataset.est=e;
    if(!row.querySelector('.est-badge')){
      const ps=h.payments||[],uniq=a=>[...new Set(a)];
      const ok=uniq(ps.filter(p=>p.method!=='debe'&&p.note).map(p=>p.note));
      const no=uniq(ps.filter(p=>p.method==='debe').map(p=>(p.note&&p.note!=='Saldo sin registrar al cerrar')?p.note:(h.person||'sin nombre')));
      const d=document.createElement('div');d.className='est-badge';
      d.innerHTML=(e==='pagaron'?'✅ Pagó':'⏳ Debe '+fmt(h.debt))+(ok.length?' · Pagaron: '+esc(ok.join(', ')):'')+(no.length?' · Deben: '+esc(no.join(', ')):'');
      row.querySelector('.hist-left').appendChild(d);
      if(e==='deben'){
        const sr=row.querySelector('.hist-share-row');
        [['efectivo','efectivo'],['transferencia','transf.']].forEach(([m,l])=>{const b=document.createElement('button');b.textContent='✅ Ya pagó ('+l+')';b.onclick=ev=>{ev.stopPropagation();pagarDeuda(h,m);};sr.appendChild(b);});
      }
    }
    row.style.display=(filtro==='todos'||filtro===e)?'':'none';
  });
}

/* ---------- Gráficas ---------- */
let rango=7;
function barras(t,labels,vals,f){
  const W=320,H=130,mx=Math.max(...vals,1),n=vals.length,bw=Math.max(4,Math.floor((W-10)/n)-3);
  let s='<svg viewBox="0 0 '+W+' '+(H+22)+'" style="width:100%;height:auto" role="img" aria-label="'+esc(t)+'">';
  vals.forEach((v,i)=>{const h=Math.round(v/mx*H),x=5+i*(bw+3);
    s+='<rect x="'+x+'" y="'+(H-h)+'" width="'+bw+'" height="'+h+'" rx="2" fill="var(--ink)" opacity=".85"><title>'+esc(labels[i])+': '+f(v)+'</title></rect>';
    if(n<=12||i%Math.ceil(n/8)===0)s+='<text x="'+(x+bw/2)+'" y="'+(H+14)+'" font-size="9" text-anchor="middle" fill="var(--ink-soft)">'+esc(labels[i])+'</text>';});
  return '<div class="chart-box"><h3>'+esc(t)+'</h3>'+s+'</svg></div>';
}
function hbarras(t,rows,f){
  const mx=Math.max(...rows.map(r=>r[1]),1);
  return '<div class="chart-box"><h3>'+esc(t)+'</h3>'+(rows.length?rows.map(r=>'<div style="display:flex;gap:6px;align-items:center;font-size:12px;margin:4px 0"><span style="width:36%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(r[0])+'</span><span style="flex:1;background:var(--line);border-radius:4px"><i style="display:block;height:12px;width:'+Math.round(r[1]/mx*100)+'%;background:var(--ink);border-radius:4px"></i></span><b>'+f(r[1])+'</b></div>').join(''):'<div class="empty-note">Sin datos en este rango.</div>')+'</div>';
}
function graficas(){
  const p=$('chartsPanel'),since=Date.now()-rango*864e5;
  const hs=data.history.filter(h=>new Date(h.date)>=since);
  const days=[];for(let i=rango-1;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);days.push(d);}
  const byDay=days.map(d=>hs.filter(h=>dkey(new Date(h.date))===dkey(d)).reduce((s,h)=>s+h.total,0));
  const byHour=Array(24).fill(0);hs.forEach(h=>{byHour[new Date(h.date).getHours()]+=h.total;});
  const prod={};hs.forEach(h=>(h.items||[]).forEach(it=>{const nv=nombreVigente(it.name);prod[nv]=(prod[nv]||0)+it.qty;}));
  const top=Object.entries(prod).sort((a,b)=>b[1]-a[1]).slice(0,8);
  let ef=0,tr=0,de=0;hs.forEach(h=>(h.payments||[]).forEach(x=>{if(x.method==='efectivo')ef+=x.amount;else if(x.method==='transferencia')tr+=x.amount;else if(x.method==='debe')de+=x.amount;}));
  p.innerHTML='<div class="mz-actions" id="rg">'+[7,30,90].map(r=>'<button class="btn-ghost'+(r===rango?' on':'')+'" data-r="'+r+'" type="button">'+r+' días</button>').join('')+'</div>'
    +'<div style="font-size:13px">Vendido: <b>'+fmt(hs.reduce((s,h)=>s+h.total,0))+'</b> · '+hs.length+' cuentas</div>'
    +barras('Ventas por día',days.map(d=>d.getDate()+'/'+(d.getMonth()+1)),byDay,fmt)
    +barras('Ventas por hora',[...Array(24).keys()].map(h=>h+'h'),byHour,fmt)
    +hbarras('Productos más vendidos (unidades)',top,String)
    +hbarras('Cómo pagaron',[['Efectivo',ef],['Transferencia',tr],['Debido',de]],fmt);
  p.querySelectorAll('#rg button').forEach(b=>{b.onclick=()=>{rango=+b.dataset.r;graficas();};});
}
function iniHist(){
  new MutationObserver(mejorarHist).observe($('histList'),{childList:true});
  document.querySelectorAll('#histFilter button').forEach(b=>{b.onclick=()=>{
    filtro=b.dataset.f;document.querySelectorAll('#histFilter button').forEach(x=>x.classList.toggle('on',x===b));renderHistorial();};});
  $('chartsToggle').onclick=()=>{const p=$('chartsPanel');p.hidden=!p.hidden;$('chartsToggle').textContent=p.hidden?'📊 Ver gráficas de ventas':'📊 Ocultar gráficas';if(!p.hidden)graficas();};
}

/* ---------- QR permanentes + canal en vivo ---------- */
// QR impresos FIJOS: el canal (c), el link, el WhatsApp y el código de cada mesa (v) que ya están
// impresos en las mesas se guardan también DENTRO de los datos del negocio (data.qrFijo), que viajan
// en los respaldos y transferencias. Si este celular perdiera su configuración, se recuperan de ahí
// en vez de inventar un canal nuevo (que dejaría inservibles los QR pegados en las mesas).
const qrFijoDe=()=>(typeof data!=='undefined'&&data&&data.qrFijo&&data.qrFijo.topic)?data.qrFijo:null;
const qCfg=()=>{
  const c=Object.assign({url:'',wa:'',topic:'',live:true},LS('vito_qr',{}));
  if(!c.url&&/\.github\.io$/.test(location.hostname))c.url=location.origin+location.pathname.replace(/[^/]*$/,'')+'pedido.html';   // todo desde GitHub: los QR nuevos apuntan a esta misma página
  if(!c.topic){
    const f=qrFijoDe();
    const usados=qCanalesDatos();
    if(f){c.topic=f.topic;if(!c.url)c.url=f.url||'';if(!c.wa)c.wa=f.wa||'';c.v=Object.assign({},f.v||{},c.v||{});c.fijo=true;}
    else if(usados.length){c.topic=usados[0];c.deDatos=true;}       // otro celular del negocio ya tiene canal: se usa ese (los QR impresos apuntan ahí)
    else{c.topic='vito'+Array.from(crypto.getRandomValues(new Uint8Array(12)),b=>(b%36).toString(36)).join('');c.nuevo=Date.now();}
    SS('vito_qr',c);
  }
  // Todo lo hace ORDEVA (Netlify se quitó en la 1.55.5): si en este celular quedó guardada la dirección de Netlify, los
  // links que arma ORDEVA (pedido, WhatsApp, domicilios, ver/imprimir QR) pasan a GitHub. El canal y el código
  // de cada mesa NO cambian, así que los QR ya pegados siguen sirviendo igual.
  // 1.55.2: también la dirección vieja de este mismo sitio (…/cuentas/ → …/ORDEVA/, el repositorio cambió de nombre).
  if(/\.github\.io$/.test(location.hostname)&&c.url&&(/netlify\.app/i.test(c.url)||qOtraCarpeta(c.url))){c.urlImpreso=c.url;c.url=location.origin+location.pathname.replace(/[^/]*$/,'')+'pedido.html';SS('vito_qr',c);}
  return c;
};
/* Canales de pedidos del negocio. Cada celular tenía su propio canal guardado SOLO en ese celular: si se
   borraba, o en un celular nuevo, o en la app de Android (que no comparte memoria con Chrome), ORDEVA creaba
   un canal nuevo sin avisar y los QR pegados en las mesas seguían mandando al viejo — los pedidos y las
   canciones no llegaban. Ahora todos los canales que ha usado el negocio quedan en sus datos (viajan con
   ORDEVA Nube y los respaldos) y ORDEVA escucha TODOS a la vez: llegue por donde llegue, el pedido entra. */
function qCanalOk(t){return typeof t==='string'&&/^[\w-]{6,64}$/.test(t);}
function qCanalesDatos(){
  if(typeof data==='undefined'||!data)return[];
  const l=(Array.isArray(data.qrCanales)?data.qrCanales:[]).filter(qCanalOk);
  const f=data.qrFijo&&data.qrFijo.topic;if(qCanalOk(f)&&!l.includes(f))l.unshift(f);
  return l;
}
function qCanales(){
  const c=qCfg(),l=[c.topic].concat(qCanalesDatos()).filter((t,i,a)=>qCanalOk(t)&&a.indexOf(t)===i);
  return l.slice(0,6);
}
function qCanalRegistrar(){
  if(typeof data==='undefined'||!data)return;
  const c=qCfg();if(!qCanalOk(c.topic))return;
  const l=(Array.isArray(data.qrCanales)?data.qrCanales:[]).filter(qCanalOk);
  if(l.includes(c.topic))return;
  if(c.fijo)l.unshift(c.topic);else l.push(c.topic);   // el primero que quedó (o el de los QR fijados) va de primero
  data.qrCanales=l.slice(0,6);saveData();
}
function qrFijoSync(){
  const c=LS('vito_qr',{});
  if(!c.fijo||!c.topic||typeof data==='undefined'||!data)return;
  const f={topic:c.topic,url:c.url||'',wa:c.wa||'',v:Object.assign({},c.v||{})};
  if(JSON.stringify(f)===JSON.stringify(data.qrFijo||null))return;
  data.qrFijo=f;saveData();
}
// Lee el QR de una foto, un PDF (cada página) o un Word .docx (cada imagen que
// tenga adentro) — para "Fijar mis QR impresos" cuando la persona no tiene la
// foto suelta sino, por ejemplo, la lista de mesas que le mandó el diseñador
// en un PDF o en un Word.
async function qrFijoCargarJSZip(){
  if(window.JSZip) return window.JSZip;
  return new Promise(ok=>{const sc=document.createElement('script');sc.src='https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';sc.onload=()=>ok(window.JSZip||null);sc.onerror=()=>ok(null);document.head.appendChild(sc);});
}
const qrFijoEsDocx=f=>/\.docx$/i.test(f.name||'')||f.type==='application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const qrFijoEsImagen=f=>/^image\//.test(f.type||'')||/\.(png|jpe?g|bmp|gif|webp)$/i.test(f.name||'');
function qrFijoArchivoAImagen(f){
  return new Promise((ok,no)=>{const r=new FileReader();r.onload=async()=>{try{const i=new Image();i.onload=()=>ok(i);i.onerror=no;i.src=r.result;}catch(e){no(e);}};r.onerror=no;r.readAsDataURL(f);});
}
async function qrFijoImagenesDeDocx(f){
  const JSZip=await qrFijoCargarJSZip();if(!JSZip)return[];
  try{
    const zip=await JSZip.loadAsync(await f.arrayBuffer());
    const medias=Object.keys(zip.files).filter(p=>/^word\/media\//i.test(p)&&/\.(png|jpe?g|bmp|gif)$/i.test(p));
    const imgs=[];
    for(const path of medias){
      try{
        const blob=await zip.files[path].async('blob');
        const url=URL.createObjectURL(blob);
        const img=await new Promise((ok2,no2)=>{const i=new Image();i.onload=()=>ok2(i);i.onerror=no2;i.src=url;});
        imgs.push(img);
      }catch(e){}
    }
    return imgs;
  }catch(e){return[];}
}
async function qrFijoImagenesDePdf(f){
  if(!window.VitoOfflineOCR||!window.VitoOfflineOCR.expandFilesWithPdfPages)return[];
  try{
    const paginas=await window.VitoOfflineOCR.expandFilesWithPdfPages([f]);
    const imgs=[];
    for(const pg of paginas){ try{ imgs.push(await qrFijoArchivoAImagen(pg)); }catch(e){} }
    return imgs;
  }catch(e){return[];}
}
async function qrFijoImagenesDe(f){
  if(qrFijoEsImagen(f)){ try{ return [await qrFijoArchivoAImagen(f)]; }catch(e){ return []; } }
  if((window.VitoOfflineOCR&&window.VitoOfflineOCR.isPdfFile&&window.VitoOfflineOCR.isPdfFile(f))||/\.pdf$/i.test(f.name||'')) return qrFijoImagenesDePdf(f);
  if(qrFijoEsDocx(f)) return qrFijoImagenesDeDocx(f);
  return [];
}
// Restaura los QR impresos desde sus links (uno o varios): ?mesa=N&w=…&c=CANAL&v=CODIGO
function qrFijoDesdeLinks(texto){
  const urls=String(texto||'').match(/https?:\/\/[^\s"'<>]+/g)||[];
  const res={c:'',url:'',wa:'',v:{},n:0,err:''};
  urls.forEach(u=>{
    let x;try{x=new URL(u);}catch(e){return;}
    const q=x.searchParams,c=(q.get('c')||'').replace(/[^\w]/g,''),m=parseInt(q.get('mesa'),10),v=(q.get('v')||'').replace(/[^\w]/g,'');
    if(!c)return;
    if(res.c&&res.c!==c){res.err='Los links son de canales distintos ('+res.c+' y '+c+'): usa los QR de un mismo negocio.';return;}
    res.c=c;res.url=x.origin+x.pathname;res.wa=(q.get('w')||'').replace(/\D/g,'')||res.wa;
    if(m&&v){res.v[m]=v;res.n++;}
  });
  return res;
}
// ¿La dirección es de este mismo sitio pero de otra carpeta? (…github.io/cuentas/ con la app abierta en …github.io/ORDEVA/)
function qOtraCarpeta(u){
  try{ const x=new URL(u,location.href), base=location.pathname.replace(/[^/]*$/,''); return x.hostname===location.hostname&&base.length>1&&!x.pathname.startsWith(base); }catch(e){ return false; }
}
function qrFijoAplicar(r){
  const c=qCfg();
  c.topic=r.c;if(r.url){if(/\.github\.io$/.test(location.hostname)&&(!/\.github\.io$/i.test(new URL(r.url,location.href).hostname)||qOtraCarpeta(r.url))){c.urlImpreso=r.url;c.url=location.origin+location.pathname.replace(/[^/]*$/,'')+'pedido.html';}else c.url=r.url;}if(r.wa)c.wa=r.wa;c.v=Object.assign({},c.v||{},r.v);c.fijo=true;
  SS('vito_qr',c);qrFijoSync();
  try{$('qrUrl').value=c.url;$('qrWa').value=c.wa;}catch(e){}
  try{conectar();}catch(e){}
  try{publicarCatalogo(true);}catch(e){}
  qrFijoEstado();
}
function qrFijoEstado(){
  const e=$('qrFijoEstado');if(!e)return;
  const c=qCfg(),n=Object.keys(c.v||{}).length;
  e.innerHTML=c.fijo
    ?'📌 <b>QR impresos fijos.</b> Canal <b>'+esc(c.topic)+'</b> · '+n+(n===1?' mesa guardada':' mesas guardadas')+' · link <b>'+esc(c.url||'—')+'</b>. Los QR pegados en las mesas siguen sirviendo aunque cambies de celular o de proveedor (arriba puedes seguir actualizando la dirección de tu página de pedidos): esto va en tus respaldos. Los pedidos llegan directo por GitHub; si reimprimes, salen con el mismo canal y código de cada mesa (y el link de GitHub).'
    :'¿Ya tienes QR impresos en las mesas? Tócalo en «Fijar mis QR impresos» para que nunca cambien.';
}
function qrFijoDialogo(){
  let ov=$('qrFijoOverlay');
  if(!ov){
    ov=document.createElement('div');ov.id='qrFijoOverlay';ov.className='overlay';
    ov.innerHTML='<div class="modal" style="max-width:460px"><h2>📌 Fijar mis QR impresos</h2>'+
      '<div class="modal-sub">Sube una foto de un QR que ya tengas pegado en una mesa (o de varias, una por una), o un PDF o Word con esos QR, y ORDEVA lo lee solo — o pega aquí abajo los links, si los tienes copiados. En todos los casos se usa exactamente ese mismo link, sin generar uno nuevo: los QR que ya pegaste en las mesas siguen sirviendo tal cual.</div>'+
      '<button type="button" class="btn-camera" id="qrFijoFotoBtn" style="width:100%;margin-top:8px">📷 Subir foto, PDF o Word del QR de una mesa</button>'+
      '<input type="file" id="qrFijoFoto" accept="image/*,application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" multiple hidden>'+
      '<div class="modal-sub" id="qrFijoFotoMsg" style="margin-top:4px"></div>'+
      '<textarea id="qrFijoTxt" class="mz-in" style="width:100%;min-height:120px;box-sizing:border-box;font-size:12.5px;margin-top:8px" placeholder="https://…/?mesa=1&w=…&c=…&v=…"></textarea>'+
      '<div class="modal-sub" id="qrFijoMsg" style="margin-top:6px"></div>'+
      '<div class="modal-actions"><button class="btn-close" type="button" id="qrFijoNo">Cancelar</button><button class="btn-primary" type="button" id="qrFijoOk">Fijar</button></div></div>';
    document.body.appendChild(ov);
    $('qrFijoNo').onclick=()=>ov.classList.remove('show');
    $('qrFijoFotoBtn').onclick=()=>$('qrFijoFoto').click();
    $('qrFijoFoto').onchange=async e=>{
      const files=Array.from(e.target.files||[]);e.target.value='';
      if(!files.length)return;
      const btn=$('qrFijoFotoBtn'),msg=$('qrFijoFotoMsg'),origTxt=btn.innerHTML;
      btn.disabled=true;let leidas=0;
      for(const f of files){
        btn.textContent='📷 Leyendo '+(leidas+1)+' de '+files.length+'…';
        try{
          const imgs=await qrFijoImagenesDe(f);
          let hallado=false;
          for(const img of imgs){
            const txt=window.leerTextoQR?await window.leerTextoQR(img):null;
            if(txt&&/^https?:\/\//.test(txt)){
              const ta=$('qrFijoTxt');ta.value=(ta.value.trim()?ta.value.trim()+'\n':'')+txt;
              hallado=true;
            }
          }
          if(hallado)leidas++;
        }catch(err){}
      }
      btn.disabled=false;btn.innerHTML=origTxt;
      msg.textContent=leidas?('✅ '+leidas+' de '+files.length+(files.length===1?' archivo leído':' archivos leídos')+'. Revisa abajo y toca «Fijar» — es exactamente el mismo link, no se genera uno nuevo.')
        :'⚠️ No pude leer ningún código QR en esos archivos. En fotos, acércate más al QR con buena luz; en PDF o Word, revisa que el QR se vea nítido, o pega el link a mano.';
    };
    $('qrFijoOk').onclick=async()=>{
      const r=qrFijoDesdeLinks($('qrFijoTxt').value);
      if(r.err){$('qrFijoMsg').textContent='⚠️ '+r.err;return;}
      if(!r.c){$('qrFijoMsg').textContent='⚠️ No encontré ningún link de QR de ORDEVA (deben tener «c=» y «mesa=»).';return;}
      const cur=LS('vito_qr',{});
      if(cur.topic&&cur.topic!==r.c){
        const ok=await showConfirm({title:'¿Cambiar al canal de tus QR impresos?',message:'Este celular usa el canal '+cur.topic+' y tus QR usan '+r.c+'. Se va a usar el de los QR (los pedidos por QR y la app de meseros quedan con ese). Si tenías la app el canal de ORDEVA suscrita al canal viejo, suscríbela al nuevo.',confirmText:'Sí, usar el de mis QR',icon:'📌'});
        if(!ok)return;
      }
      qrFijoAplicar(r);ov.classList.remove('show');
      showToast('📌 Listo: QR fijados ('+r.n+(r.n===1?' mesa':' mesas')+'). Los QR de las mesas no cambian.',7000);
    };
  }
  $('qrFijoTxt').value='';$('qrFijoMsg').textContent='';$('qrFijoFotoMsg').textContent='';
  ov.classList.add('show');
}
// Link de restauración: index.html#qrfijo=<datos> (lo arma el soporte a partir de los QR impresos).
async function qrFijoDesdeHash(){
  const m=/[#&]qrfijo=([A-Za-z0-9_-]+)/.exec(location.hash);if(!m)return;
  try{history.replaceState(null,'',location.pathname+location.search);}catch(e){}
  let o;try{let b=m[1].replace(/-/g,'+').replace(/_/g,'/');while(b.length%4)b+='=';o=JSON.parse(decodeURIComponent(escape(atob(b))));}catch(e){showToast('⚠️ Ese link de QR está incompleto.');return;}
  if(!o||!o.c){showToast('⚠️ Ese link de QR no es válido.');return;}
  const r={c:String(o.c).replace(/[^\w]/g,''),url:o.url||'',wa:String(o.wa||'').replace(/\D/g,''),v:o.v||{},n:Object.keys(o.v||{}).length};
  const cur=LS('vito_qr',{});
  if(cur.topic&&cur.topic!==r.c){
    const ok=await showConfirm({title:'¿Fijar tus QR impresos?',message:'ORDEVA va a usar el canal de tus QR impresos ('+r.c+') con '+r.n+' mesas, para que los QR pegados en las mesas sigan sirviendo siempre.',confirmText:'Sí, fijar',icon:'📌'});
    if(!ok)return;
  }
  qrFijoAplicar(r);
  showToast('📌 QR impresos fijados: '+r.n+' mesas. Los QR de las mesas no cambian.',7000);
}
const linkMesa=(c,id)=>c.url.split('?')[0].trim()+'?mesa='+id+(c.wa?'&w='+c.wa:'')+'&c='+c.topic+'&v='+vTopic(id)+((data.nequiOn&&data.nequiNumber)?'&nq='+data.nequiNumber+(data.nequiName?'&nqn='+encodeURIComponent(data.nequiName):''):'');
function pintarQR(el){
  const c=qCfg();el.textContent='';
  if(!c.url){el.textContent='Escribe primero el link donde subiste pedido.html.';return;}
  if(typeof QRCode==='undefined'){el.textContent='No cargó el generador de QR. Revisa el internet e inténtalo otra vez.';return;}
  Object.keys(data.tables).map(Number).sort((a,b)=>a-b).forEach(id=>{
    const d=document.createElement('div');d.className='qr-card';
    d.innerHTML='<h3 style="margin:0 0 8px">Mesa '+id+'</h3><div class="q" style="display:flex;justify-content:center"></div><small>Escanea: pide, música o cuenta</small>';
    el.appendChild(d);new QRCode(d.querySelector('.q'),{text:linkMesa(c,id),width:150,height:150});
  });
}
function imprimirQR(){
  const c=qCfg();if(!c.url)return showToast('Escribe primero el link de pedido.html.');
  let a=$('qrPrint');if(!a){a=document.createElement('div');a.id='qrPrint';document.body.appendChild(a);}
  pintarQR(a);document.body.classList.add('print-qr');
  // En Android la impresión no espera: si se quitaba la clase justo después de
  // window.print() salía la app entera en vez de los QR. La clase solo afecta
  // a la impresión, así que se quita cuando termina (afterprint) o al volver
  // a tocar la pantalla.
  const quitar=()=>{document.body.classList.remove('print-qr');window.removeEventListener('afterprint',quitar);document.removeEventListener('pointerdown',quitar,true);};
  setTimeout(()=>{window.addEventListener('afterprint',quitar);try{window.print();}catch(e){}setTimeout(()=>document.addEventListener('pointerdown',quitar,true),1500);},400);
}
let es=null,esOn=false,esAct=0,esTime=0,esTimer=null,esRetry=0,esPolling=false;
let esCanales='';
function estado(s){
  const t={on:'🟢 Conectado: los pedidos, cuentas y canciones llegan solos.',err:'🟠 Sin conexión. Reintentando…',off:'⚪ Apagado.'}[s];
  ['mzEstado','qrEstado'].forEach(i=>{if($(i))$(i).textContent=t;});
}
const esTouch=()=>{esAct=Date.now();};
/* Un mensaje del canal de ORDEVA (por el canal en vivo o por la consulta de respaldo): se procesa una sola vez */
function recibir(m){
  if(!m||m.event!=='message')return;
  if(m.time&&m.time>esTime)esTime=m.time;
  const v=LS('vito_vistos',[]);if(v.includes(m.id))return;
  v.push(m.id);SS('vito_vistos',v.slice(-1000));
  if(m.topic&&m.topic===mTopic()){try{procesarMesero(String(m.message||'').slice(0,1500));}catch(e){console.error(e);}return;}
  if(m.topic&&m.topic===pTopic()+'r'){try{procesarPrep(String(m.message||'').slice(0,1500));}catch(e){console.error(e);}return;}
  // 600: un domicilio (nombre + teléfono + dirección + productos) es más largo que un pedido de mesa.
  window.__canalMsgId=m.id;window.__canalTopic=m.topic||'';
  try{procesar(String(m.message||'').slice(0,4000));}catch(e){console.error(e);}
}
/* ---------- App de meseros (mesero.html) ----------
   Cada mesero usa la app en SU celular. Manda los pedidos por un canal privado de ORDEVA
   (topic + 'm' + código secreto) que los clientes no conocen; aquí se aplican directo, sin
   confirmar, con el mismo entendedor de la voz clásica (así sirven todos los comandos: "mesa 2
   dos águilas", "misma ronda para la mesa 3", "crea la mesa Juan con dos póker"…). Este celular
   le responde qué pasó y le publica el estado de las mesas (canal + 's'). */
const MKEY='vito_meseros';
const mCfg=()=>{const c=LS(MKEY,{});if(!c.code){c.code=Array.from(crypto.getRandomValues(new Uint8Array(8)),b=>'abcdefghjkmnpqrstuvwxyz23456789'[b%31]).join('');SS(MKEY,c);}return c;};
const mTopic=()=>qCfg().topic+'m'+mCfg().code;
function mUrl(){const base=location.protocol==='file:'?'':location.origin+location.pathname.replace(/[^/]*$/,'');return base?base+'mesero.html#'+qCfg().topic+'.'+mCfg().code:'';}
function mVistos(nombre){const c=mCfg();c.vistos=c.vistos||{};if(nombre){c.vistos[String(nombre).slice(0,30)]=Date.now();SS(MKEY,c);}return c.vistos;}
let mPubT=null,mHash='';
function mEstado(){
  const tabs=Object.keys(data.tables).map(Number).sort((a,b)=>a-b).map(id=>{
    const t=data.tables[id],its=(t.items||[]);
    return{i:id,n:String(tableLabel(id)).slice(0,24),t:Math.round(tableBalance(id)),it:its.slice(0,10).map(x=>[String(x.name).slice(0,24),x.qty])};
  });
  const m={e:1,b:String(data.businessName||'').slice(0,40),m:tabs,t:Date.now()};
  // el canal de ORDEVA acepta ~4 KB por mensaje: si no cabe, se quitan los detalles de las mesas más grandes.
  let s=JSON.stringify(m);
  for(let k=tabs.length-1;s.length>3800&&k>=0;k--){tabs[k].it=tabs[k].it.slice(0,2);s=JSON.stringify(m);}
  for(let k=tabs.length-1;s.length>3800&&k>=0;k--){tabs[k].it=[];s=JSON.stringify(m);}
  return s;
}
function mPublicar(force){
  const c=mCfg();if(!c.on||!qCfg().live)return;
  const s=mEstado(),h=s.replace(/"t":\d+/,'');
  if(!force&&h===mHash)return;
  mHash=h;
  fetch('https://canal.vento.local/'+mTopic()+'s',{method:'POST',body:s}).catch(()=>{mHash='';});
}
/* ---------- Pantalla de preparación en otro equipo (preparacion.html) ----------
   Canal privado topic+'p'+código: la app le publica los pedidos activos; la pantalla responde por
   topic+'p'+código+'r' con {k:'estado', id, e}. Solo lo ve quien tiene el link. */
const PKEYP='vito_prep';
const pCfgP=()=>{const c=LS(PKEYP,{});if(!c.code){c.code=Array.from(crypto.getRandomValues(new Uint8Array(8)),b=>'abcdefghjkmnpqrstuvwxyz23456789'[b%31]).join('');SS(PKEYP,c);}return c;};
const pTopic=()=>qCfg().topic+'p'+pCfgP().code;
function prepUrl(){const base=location.protocol==='file:'?'':location.origin+location.pathname.replace(/[^/]*$/,'');return base?base+'preparacion.html#'+qCfg().topic+'.'+pCfgP().code:'';}
let prepT=null,prepHash='';
function prepPublicar(force){
  clearTimeout(prepT);
  prepT=setTimeout(()=>{
    if(typeof data==='undefined'||!data||!prepOn())return;
    if(Date.now()-(LS('vito_prep_visto',0)||0)>24*36e5)return;   // ninguna pantalla externa abierta: no se gasta mensajes de más
    const act=pedidosLista().filter(p=>['nuevo','recibido','preparacion','listo'].includes(p.estado)).slice(-30);
    const m={t:'prep',n:prepNombre(),b:String(data.businessName||'').slice(0,40),o:act.map(p=>({i:p.id,m:String(window.vitoGrupos?window.vitoGrupos.etiquetaDe(p.mesa):tableLabel(p.mesa)).slice(0,40),e:p.estado,a:p.recibidoEn||p.at,g:String(p.origen||'').slice(0,20),x:String(p.nota||'').slice(0,80),it:p.items.slice(0,15).map(i=>[String(i.name).slice(0,30),i.qty])})),at:Date.now()};
    let s2=JSON.stringify(m);
    while(s2.length>3800&&m.o.length){m.o.shift();s2=JSON.stringify(m);}
    if(!force&&s2.replace(/"at":\d+/,'')===prepHash)return;
    prepHash=s2.replace(/"at":\d+/,'');
    fetch('https://canal.vento.local/'+pTopic(),{method:'POST',body:s2}).catch(()=>{prepHash='';});
  },force?0:700);
}
window.prepPublicar=prepPublicar;
// Repaso cada 10 min (antes cada minuto) y solo con pedidos activos: los cambios ya se publican al instante.
setInterval(()=>{if(prepOn()&&pedidosLista().some(p=>['nuevo','recibido','preparacion','listo'].includes(p.estado)))prepPublicar(true);},600000);
function procesarPrep(txt){
  let o;try{o=JSON.parse(txt);}catch(e){return;}
  if(!o||o.t==='prep')return;                                   // eco de lo que publicamos
  SS('vito_prep_visto',Date.now());                              // hay una pantalla de preparación abierta
  if(o.k==='hola'){prepPublicar(true);return;}
  if(o.k==='estado'&&o.id&&PEDIDO_EST[o.e]){
    // 1.56.0 (auditoría ORDEVA R4): cancelar desde la pantalla de preparación le quita los productos a la cuenta. Queda en
    // la actividad del equipo y se avisa en este celular (si alguien con el link lo hace sin razón, se ve).
    const ant=pedidosLista().find(x=>x.id===String(o.id));
    if(o.e==='cancelado'&&ant&&ant.estado!=='cancelado'){
      const det=tableLabel(ant.mesa)+': '+ant.items.map(i=>i.qty+' '+i.name).join(', ').slice(0,160);
      try{window.ventoAuditar&&window.ventoAuditar('pedido cancelado desde '+prepNombre(),det);}catch(e){}
      try{showToast('✕ '+prepNombre()+' canceló el pedido de '+det,8000);}catch(e){}
    }
    pedidoCambiar(String(o.id),o.e);try{renderCocina();}catch(e){}
  }
}
function iniPrep(){
  const on=$('prepOn');if(!on)return;
  const sel=$('prepNomSel'),otro=$('prepNomOtro');
  sel.innerHTML=PREP_NOMBRES.map(n=>'<option>'+esc(n)+'</option>').join('')+'<option value="__otro">Otro nombre…</option>';
  const pintar=()=>{
    on.checked=prepOn();$('prepOnTxt').textContent=prepOn()?'Activada · se llama «'+prepNombre()+'»':'Desactivada (oculta)';
    const n=prepNombre();if(PREP_NOMBRES.includes(n)){sel.value=n;otro.hidden=true;}else{sel.value='__otro';otro.hidden=false;otro.value=n;}
    $('prepNomRow').hidden=$('prepLinkRow').hidden=!prepOn();
    $('pedAutoOn').checked=pedidosAuto();$('prepLink').value=prepUrl()||'Abre ORDEVA desde su dirección https para tener el link.';
  };
  const guardar=c=>{data.prep=Object.assign({},data.prep,c);saveData();aplicarModulos();try{conectar();}catch(e){}try{aplicarVocabulario();}catch(e){}pintar();renderCocina();prepPublicar(true);};
  on.onchange=()=>{guardar({on:on.checked});showToast(on.checked?'🍳 Pantalla «'+prepNombre()+'» activada.':'Pantalla de preparación desactivada: los pedidos siguen llegando a las cuentas.');};
  sel.onchange=()=>{if(sel.value==='__otro'){otro.hidden=false;otro.focus();return;}guardar({nombre:sel.value});};
  otro.onchange=()=>{const v=otro.value.replace(/[<>]/g,'').trim().slice(0,24);if(v)guardar({nombre:v});};
  $('pedAutoOn').onchange=e=>{data.pedidosAuto=e.target.checked;saveData();pintar();};
  $('prepCopy').onclick=()=>{const u=prepUrl();if(!u)return;(navigator.clipboard?navigator.clipboard.writeText(u):Promise.reject()).then(()=>showToast('📋 Link de la pantalla copiado.'),()=>{$('prepLink').select();showToast('Copia el link a mano.');});};
  $('prepNuevo').onclick=()=>{if(!confirm('¿Crear un link nuevo? La pantalla que tenga el link anterior dejará de recibir pedidos.'))return;const c=LS(PKEYP,{});delete c.code;SS(PKEYP,c);pCfgP();pintar();conectar();prepPublicar(true);};
  document.querySelectorAll('.ajustes-cat[data-cat="pedidos"]').forEach(b=>b.addEventListener('click',()=>setTimeout(pintar,50)));
  // Control en la misma pantalla: cambiarle el nombre u ocultarla sin ir a Ajustes.
  const vNom=$('prepNomVista'),vOff=$('prepApagar');
  const pintarVista=()=>{if(!vNom)return;const n=prepNombre();
    vNom.innerHTML=(PREP_NOMBRES.includes(n)?'':'<option>'+esc(n)+'</option>')+PREP_NOMBRES.map(x=>'<option>'+esc(x)+'</option>').join('')+'<option value="__otro">Otro nombre…</option>';vNom.value=n;};
  if(vNom){vNom.onchange=()=>{let v=vNom.value;if(v==='__otro'){v=(prompt('¿Cómo se llama esta pantalla en tu negocio?',prepNombre())||'').replace(/[<>]/g,'').trim().slice(0,24);if(!v){pintarVista();return;}}guardar({nombre:v});pintarVista();showToast('✅ Ahora se llama «'+v+'».');};}
  if(vOff){vOff.onclick=()=>{if(!confirm('¿Ocultar la pantalla «'+prepNombre()+'»? Los pedidos siguen llegando a las cuentas. La vuelves a activar en Ajustes → Pedidos, QR y caja.'))return;guardar({on:false});const b=document.querySelector('nav button[data-view="mesas"]');if(b)b.click();showToast('Pantalla «'+prepNombre()+'» oculta.');};}
  const navP=document.querySelector('nav button[data-view="cocina"]');if(navP)navP.addEventListener('click',()=>setTimeout(pintarVista,30));
  pintarVista();
  pintar();
}
// Lo que la app de meseros NO puede pedir (texto ya normalizado con normVoiceText: minúsculas y sin tildes).
const MESERO_NO=/\b(borra\w*|elimina\w*|reinicia\w*|resetea\w*|vacia\w*|limpia\w*|cierra\w* (la )?caja|cerrar (la )?caja|cierre( de caja)?|abre (la )?caja|precio\w*|inventario|stock|configura\w*|ajustes?|recarga\w* (la )?(app|aplicacion|pagina)|contrasena|clave|usuario\w*|suscripcion|plan|factura\w*|dian|devolucion\w*|descuento\w*|libera\w*|anula\w*|cambia\w* (el )?nombre|producto nuevo|nuevo producto|crea\w* (un |el )?producto|agrega\w* (un |el )?producto|laya|vento|bento|ordeva|respaldo\w*|copia de seguridad|sede\w*|negocio)\b/;
async function procesarMesero(txt){
  let o;try{o=JSON.parse(txt);}catch(e){return;}
  if(!o||o.e)return;                                    // mensajes de estado propios
  const quien=String(o.mesero||'Mesero').slice(0,30);
  mVistos(quien);
  if(o.k==='hola'){mPublicar(true);return;}
  if(o.k!=='voz'||!o.texto)return;
  const texto=String(o.texto).slice(0,400);
  // 1.56.0 (seguridad, auditoría ORDEVA R3): desde la app de meseros se anotan pedidos (agregar, quitar, misma ronda, crear
  // mesa, pedir la cuenta), pero NO comandos que borran, reinician, cierran la caja o cambian productos, precios, inventario
  // o la configuración: esos solo en el celular principal. (Quien tenga el link de mesero no puede manejar todo el negocio.)
  if(MESERO_NO.test(normVoiceText(texto))){
    try{window.ventoAuditar&&window.ventoAuditar('comando de mesero bloqueado',quien+': '+texto.slice(0,160));}catch(e){}
    try{await fetch('https://canal.vento.local/'+mTopic()+'s',{method:'POST',body:JSON.stringify({r:o.id,ok:['⛔ Eso solo se hace en el celular principal del negocio.'],t:Date.now()})});}catch(e){}
    return;
  }
  // Se captura lo que la app avisaría (para devolvérselo al mesero) y no se habla en voz alta aquí.
  const capt=[],oT=showToast,oV=speakVoice;
  showToast=(msg,ms)=>{capt.push(String(msg));oT('🧑‍🍳 '+quien+': '+msg,ms);};
  speakVoice=()=>{};
  window.__pedidoOrigen='mesero:'+quien;
  try{await handleVoiceTranscript(texto);}catch(e){capt.push('⚠️ '+(e.message||e));}
  finally{showToast=oT;speakVoice=oV;window.__pedidoOrigen=null;}
  const r={r:o.id,ok:capt.length?capt:['✅ Listo.'],t:Date.now()};
  try{await fetch('https://canal.vento.local/'+mTopic()+'s',{method:'POST',body:JSON.stringify(r)});}catch(e){}
  mPublicar(true);
}
function esProgramar(){
  esRetry++;clearTimeout(esTimer);
  esTimer=setTimeout(conectar,Math.min(30000,1000*Math.pow(2,Math.min(esRetry,5))));
}
function conectar(){
  const c=qCfg();esOn=true;clearTimeout(esTimer);
  if(es){es.close();es=null;}
  if(!c.live){estado('off');return;}
  // Al reconectar se pide solo lo que llegó desde el último mensaje (no las 12 h otra vez)
  try{qCanalRegistrar();}catch(e){}
  esCanales=qCanales().join(',');
  const tops=esCanales+(mCfg().on?','+mTopic():'')+(prepOn()?','+pTopic()+'r':'');
  try{es=new EventSource('https://canal.vento.local/'+tops+'/sse?since='+(esTime||'12h'));}catch(e){estado('err');esProgramar();return;}
  const mine=es;esTouch();
  es.onopen=()=>{esTouch();esRetry=0;estado('on');};
  es.onerror=()=>{
    if(mine!==es)return;estado('err');
    if(mine.readyState===2){mine.close();es=null;esProgramar();}   // el navegador se rindió: reintenta nosotros
  };
  es.onmessage=ev=>{esTouch();let m;try{m=JSON.parse(ev.data);}catch(e){return;}recibir(m);};
  ['open','keepalive'].forEach(n=>es.addEventListener(n,esTouch));   // el canal de ORDEVA avisa que sigue vivo cada ~45 s
}
/* Respaldo: consulta directa al canal de ORDEVA. Cubre el caso en que el celular deja la conexión "muerta"
   (pantalla apagada, otra app, cambio de WiFi/datos) y el navegador no avisa nada. */
async function sondear(){
  const c=qCfg();if(!c.live||esPolling||!esOn)return;esPolling=true;
  try{
    const ctrl=new AbortController(),tmo=setTimeout(()=>ctrl.abort(),8000);
    const r=await fetch('https://canal.vento.local/'+qCanales().join(',')+(mCfg().on?','+mTopic():'')+(prepOn()?','+pTopic()+'r':'')+'/json?poll=1&since='+(esTime||Math.floor(Date.now()/1000)-1800),{signal:ctrl.signal,cache:'no-store'});
    clearTimeout(tmo);
    if(!r.ok)return;
    (await r.text()).split('\n').forEach(l=>{if(!l.trim())return;try{recibir(JSON.parse(l));}catch(e){}});
    try{if(window.vitoCheckNotif)window.vitoCheckNotif();}catch(e){}
  }catch(e){}finally{esPolling=false;}
}
// 🩺 Probar pedidos: se manda un mensaje de prueba por el canal de los QR y se espera verlo llegar.
async function qProbarPedidos(){
  const c=qCfg(),out=[],can=qCanales();
  out.push((es&&es.readyState===1?'✅':'⚠️')+' Recepción en vivo: '+(es&&es.readyState===1?'conectada':'reconectando…')+'.');
  out.push('📡 Escuchando '+can.length+(can.length===1?' canal':' canales')+' de pedidos: '+can.map(t=>t.slice(0,8)+'…').join(', ')+'.');
  const id='pr'+Date.now().toString(36);window.__qPrueba=window.__qPrueba||{};
  const llego=new Promise(res=>{window.__qPrueba[id]=res;setTimeout(()=>res(null),15000);});
  try{const r=await fetch('https://canal.vento.local/'+c.topic,{method:'POST',body:JSON.stringify({t:'prueba',id,at:Date.now()})});
    if(!r.ok)out.push('❌ El canal de ORDEVA no dejó enviar (error '+r.status+(r.status===429?': demasiados mensajes seguidos, espera un minuto':'')+').');}
  catch(e){out.push('❌ Sin internet para enviar la prueba.');}
  setTimeout(()=>{try{sondear();}catch(e){}},2500);
  const t=await llego;delete window.__qPrueba[id];
  out.push(t?'✅ La prueba llegó: los pedidos y canciones de los QR entran a ORDEVA.':'❌ La prueba NO llegó en 15 s. Revisa el internet de este celular; si sigue, toca «📌 Fijar mis QR impresos» y escanea un QR de una mesa.');
  if(!c.fijo&&!(data.qrCanales||[]).length)out.push('ℹ️ Si tus QR se imprimieron en OTRO celular, toca «📌 Fijar mis QR impresos» para que este escuche ese canal.');
  return out;
}
window.vitoDespertarPedidos=()=>{try{despertar();}catch(e){}};
function despertar(){
  if(!esOn)return;
  if(!es||es.readyState===2||Date.now()-esAct>45000)conectar();
  sondear();
}
setInterval(()=>{
  if(!esOn||!qCfg().live)return;
  if(!es||es.readyState===2||Date.now()-esAct>100000||qCanales().join(',')!==esCanales)conectar();   // sin señales de vida: se reconecta sola
},15000);
setInterval(()=>{if(document.visibilityState==='visible')sondear();},20000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')despertar();});
window.addEventListener('online',despertar);
window.addEventListener('pageshow',despertar);

/* ---------- Pantalla siempre encendida (no se corta la recepción de pedidos/canciones) ----------
   Si el celular bloquea la pantalla solo (por el tiempo de espera de
   Android), Chrome termina pausando esta pestaña y se dejan de recibir
   pedidos y canciones hasta que alguien la vuelva a abrir. Con el celular
   dedicado a esta app, el Wake Lock evita que la pantalla se apague sola
   mientras esta pestaña esté al frente, así que la recepción sigue viva.
   No hace nada si cambiás a OTRA app (eso Android lo maneja aparte y
   ninguna página puede evitarlo), pero cubre el caso más común: el
   celular se queda quieto en esta pantalla y se bloquea por inactividad. */
let wakeLock=null;
async function pedirWakeLock(){
  try{
    if(!('wakeLock' in navigator))return;
    wakeLock=await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release',()=>{wakeLock=null;});
  }catch(e){wakeLock=null;}
}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&!wakeLock)pedirWakeLock();});
pedirWakeLock();
// Mesas con clientes usando el QR (últimas 12 h): solo a esas se les publica la cuenta en vivo.
// Antes se publicaba CADA cambio de CADA mesa al canal de ORDEVA y eso gastaba el límite de mensajes
// del local; si el cliente estaba en el mismo Wi-Fi, sus pedidos salían «Sin conexión».
function mesaQRActiva(id,marcar){const a=LS('vito_qr_act',{});if(marcar){a[id]=Date.now();Object.keys(a).forEach(k=>{if(Date.now()-a[k]>12*36e5)delete a[k];});SS('vito_qr_act',a);return true;}return Date.now()-(a[id]||0)<12*36e5;}
function procesar(txt){
  try{const mm=/"mesa":\s*(\d+)|MESA\s*(\d+)/i.exec(txt);if(mm)mesaQRActiva(+(mm[1]||mm[2]),true);}catch(e){}
  // Formato nuevo (pedido.html 1.8+): JSON con ID único → sin duplicados, mesa y productos exactos.
  if(/^\s*\{/.test(txt)){
    let o=null;try{o=JSON.parse(txt);}catch(e){}
    if(o&&o.t==='pedido'){pedidoEntrante(o,'qr');return;}
    if(o&&o.t==='cancion'){const id=parseInt(o.mesa,10);if(!id)return;const r=agregarCancion(id,String(o.s||'').slice(0,120),String(o.id||'').slice(0,40));
      // Mesa sin cupo: se le avisa al celular que la pidió (por el canal de estados) en vez de dejarla esperando.
      if(r.limite&&!mqOtro()){try{const cn=qCanalOk(window.__canalTopic)?window.__canalTopic:qCfg().topic;fetch('https://canal.vento.local/'+cn+'e',{method:'POST',body:JSON.stringify({t:'estado',id:String(o.id||'').slice(0,40),e:'limite',m:id,min:r.min,max:mzMax(),n:r.msg,at:Date.now()})}).catch(()=>{});}catch(e){}return;}if(r.nuevo!==false&&notifMusica()){showToast(r.msg+(mzSinReproductor()?' · Para que suene: Música → «🎶 Activar música automática».':''),mzSinReproductor()?8000:0);ventoAvisoCel('🎵 Canción · '+tableLabel(id),String(o.s||'').slice(0,120),'musica');}renderMusica();return;}
    if(o&&o.t==='estado')return;                                   // eco de nuestros propios avisos
    if(o&&o.t==='prueba'){if(o.id&&window.__qPrueba&&window.__qPrueba[o.id])window.__qPrueba[o.id](window.__canalTopic);return;}
  }
  const dm=/^DOMICILIO\s*:?\s*([\s\S]*)$/i.exec(txt.trim());
  if(dm){ domRecibir(dm[1]); if(navigator.vibrate)navigator.vibrate(200); return; }
  const m=/^(PEDIDO|CANCION|CUENTA)\s+MESA\s*(\d+)\s*:?\s*([\s\S]*)$/i.exec(txt.trim());if(!m)return;
  const tp=m[1].toUpperCase(),id=parseInt(m[2],10),cuerpo=m[3].trim().replace(/\s+/g,' ');
  if(!id)return;
  // Antes, si la mesa del QR no existía en la app (ej. se bajó el número de mesas), el pedido se
  // botaba en silencio. Ahora la mesa se crea sola para no perder nada.
  if(!data.tables[id])asegurarMesa(id);
  if(tp==='CANCION'){const r=agregarCancion(id,cuerpo,window.__canalMsgId?'t'+window.__canalMsgId:null);if(r.nuevo!==false&&notifMusica()){showToast(r.msg+(mzSinReproductor()?' · Para que suene: Música → «🎶 Activar música automática».':''),mzSinReproductor()?8000:0);ventoAvisoCel('🎵 Canción · '+tableLabel(id),cuerpo,'musica');}renderMusica();}
  else if(tp==='CUENTA'){
    /* Si el cliente avisó que ya pagó (botón "Ya pagué" del QR o de Nequi en pedido.html), el
       aviso trae el MONTO y la APP (Nequi, Bancolombia, Daviplata, Bre-B…) en el cuerpo — se
       muestra tal cual en vez del toast genérico, para no perder ese dato. Antes solo se
       detectaba la palabra "nequi", así que pagar con cualquier otra app (Bancolombia,
       Daviplata) mostraba solo "pide la cuenta" sin el monto ni con qué pagó. */
    const avisoPago = /ya pag[oó]/i.test(cuerpo);
    if(window.ventoAvisoOn('cuenta')){
      showToast(avisoPago ? (tableLabel(id) + ': ' + cuerpo) : ('🧾 ' + tableLabel(id) + ' pide la cuenta'));
      ventoAvisoCel(avisoPago ? '💜 ' + tableLabel(id) + ' avisa que pagó' : '🧾 ' + tableLabel(id) + ' pide la cuenta', avisoPago ? cuerpo : (cuerpo || 'Toca para abrir ORDEVA.'), 'pedidos');
      if(avisoPago) try{ speakVoice(tableLabel(id) + ' dice que ya pagó.'); }catch(e){}
    }
    if(avisoPago) try{ window.pagosVerificarMesa && window.pagosVerificarMesa(id); }catch(e){}
    try{openBillSummary(id);}catch(e){}
  }
  else{
    // Formato viejo en texto (QR de una versión anterior de pedido.html o WhatsApp): mismo camino.
    const p=parseVoiceCommand('mesa '+id+', '+m[3].replace(/\n+/g,', '));
    if(!p.items||!p.items.length){if(notifPedidos())showToast('⚠️ '+tableLabel(id)+' mandó un pedido que no entendí: '+cuerpo);}
    else pedidoEntrante({id:'t'+(window.__canalMsgId||Date.now().toString(36)),mesa:id,items:p.items.map(x=>({n:x.productText,q:x.qty||1}))},'qr');
  }
  if(navigator.vibrate)navigator.vibrate(200);
}
/* ================= Pedidos: QR → app principal → mesa correcta → pantalla de preparación =================
   Una sola lista de pedidos (data.pedidos, se guarda con los datos del negocio y en sus respaldos).
   Cada pedido: {id único, mesa, items [{productId, name, qty, price, ok}], total, at, estado, origen,
   negocio (canal del local), hist [{e, at}]}. Estados: nuevo · recibido · preparacion · listo ·
   entregado · cancelado. Un mismo ID nunca se suma dos veces (doble toque, reintento, recarga,
   mala señal). Cada cambio de estado se le avisa a la página del cliente por el canal «topic+e». */
const PEDIDO_EST={nuevo:'Nuevo',recibido:'Recibido',preparacion:'En preparación',listo:'Listo',entregado:'Entregado',cancelado:'Cancelado'};
const pedidosLista=()=>{if(typeof data==='undefined'||!data)return[];if(!Array.isArray(data.pedidos))data.pedidos=[];return data.pedidos;};
const pedidosAuto=()=>!(data&&data.pedidosAuto===false);        // por defecto el pedido entra solo a la cuenta
// Los códigos secretos de la mesa que van en sus QR (los que ya existen; no se inventa uno nuevo aquí): los de este
// celular, los de los QR fijados y los que guardaron los demás celulares del negocio en data.qrCodigos (1.56.0: así un
// pedido del QR se reconoce en todos los celulares, no solo en el que generó los QR).
function qMesaCodigos(id){
  const l=[];
  try{ const c=qCfg(), f=qrFijoDe(), g=(data&&data.qrCodigos&&data.qrCodigos[id])||[];
    [c.v&&c.v[id], f&&f.v&&f.v[id]].concat(Array.isArray(g)?g:[g]).forEach(x=>{ if(x&&l.indexOf(String(x))<0) l.push(String(x)); }); }catch(e){}
  return l;
}
function qMesaCodigo(id){ return qMesaCodigos(id)[0]||null; }
// Sube a los datos del negocio los códigos de mesa que tiene este celular (los de sus QR impresos).
function qCodigosCompartir(){
  try{
    if(typeof data==='undefined'||!data)return;
    const c=LS('vito_qr',{}),v=Object.assign({},(qrFijoDe()||{}).v||{},c.v||{});let cambio=false;
    // Solo se crea data.qrCodigos cuando hay un código que guardar (no se cambian los datos del negocio por nada).
    const qc=data.qrCodigos&&typeof data.qrCodigos==='object'?data.qrCodigos:{};
    Object.keys(v).forEach(id=>{ const k=String(v[id]||'');if(!/^\w{6,40}$/.test(k))return;
      const a=Array.isArray(qc[id])?qc[id]:(qc[id]?[qc[id]]:[]);
      if(a.indexOf(k)<0){a.push(k);qc[id]=a.slice(-4);cambio=true;} });
    if(cambio)data.qrCodigos=qc;
    if(cambio)saveData();
  }catch(e){}
}
setTimeout(qCodigosCompartir,4000);
function asegurarMesa(id){
  id=parseInt(id,10);if(!id||id>500)return false;
  if(!data.tables[id]){data.tables[id]={items:[],people:[]};if((data.tableCount||0)<id)data.tableCount=id;try{renderMesas();}catch(e){}}
  return true;
}
function pedidoProducto(nombre){
  const k=normVoiceText(nombre);
  return data.products.find(p=>!p.oculto&&normVoiceText(p.name)===k)||data.products.find(p=>normVoiceText(p.name+' '+(p.size||''))===k)||matchProductVoice(nombre)||null;
}
function pedidoPublicar(p){
  try{fetch('https://canal.vento.local/'+(p.canal&&qCanalOk(p.canal)?p.canal:qCfg().topic)+'e',{method:'POST',body:JSON.stringify({t:'estado',id:p.id,e:p.estado,m:p.mesa,n:PEDIDO_EST[p.estado],at:Date.now()})}).catch(()=>{});}catch(e){}
}
function pedidoAplicar(p){
  if(p.aplicado)return;
  asegurarMesa(p.mesa);                                          // un pedido aceptado a mano de una mesa que no estaba (1.56.0)
  const its=p.items.filter(i=>i.ok).map(i=>({productText:i.name,qty:i.qty}));
  // Pedidos del QR: no suenan aquí (ya tienen su timbre y su aviso; si llegan muchos no se llena de «tún»).
  if(its.length){const r=sinSonidoPos(()=>applyVoiceItems(p.mesa,its,'add'));p.agregados=r.added.map(a=>a.qty+' '+a.name);}
  p.aplicado=true;
  try{saveData();renderMesas();if(typeof refrescarTodoEnVivo==='function')refrescarTodoEnVivo();}catch(e){}
}
function pedidosGuardar(){
  const l=pedidosLista();if(l.length>600)data.pedidos=l.slice(-500);
  saveData();
  try{localStorage.setItem('vito_pedidos_pend',JSON.stringify(pedidosLista().filter(x=>x.estado==='nuevo').map(x=>({id:x.id,mesa:x.mesa,ts:x.at,items:x.items.map(i=>({productText:i.name,qty:i.qty}))}))));}catch(e){}
  try{window.vitoCheckNotif&&window.vitoCheckNotif();}catch(e){}
  try{if(typeof renderCocina==='function')renderCocina();}catch(e){}
  try{window.prepPublicar&&window.prepPublicar();}catch(e){}
}
function pedidoEntrante(o,origen){
  const id=String(o.id||('p'+Date.now().toString(36)+Math.random().toString(36).slice(2,6))).replace(/[^\w-]/g,'').slice(0,40);
  const ya=pedidosLista().find(x=>x.id===id);
  if(ya){pedidoPublicar(ya);return ya;}                           // reintento del cliente: solo se le vuelve a confirmar
  const mesa=parseInt(o.mesa,10);
  // 1.56.0 (seguridad, auditoría ORDEVA R1): un pedido del QR trae el código secreto de SU mesa (el del QR impreso). Sin ese
  // código (alguien que conoce el canal y escribe un pedido para otra mesa, o un QR muy viejo) NO entra solo a la cuenta ni
  // crea mesas: queda «🆕 Por aceptar» para que una persona lo revise.
  const cods=origen==='qr'?qMesaCodigos(mesa):[];
  const verificado=origen!=='qr'||(!!o.vm&&cods.indexOf(String(o.vm))>=0);
  if(!mesa||(verificado?!asegurarMesa(mesa):(mesa<1||mesa>500)))return null;
  const items=(Array.isArray(o.items)?o.items:[]).slice(0,40).map(x=>{
    const n=String(x.n||x.name||'').slice(0,60),q=Math.max(1,Math.min(99,Math.round(Number(x.q||x.qty)||1)));
    const pr=n?pedidoProducto(n):null;
    return{productId:pr?pr.id:null,name:pr?pr.name:n,qty:q,price:pr?Number(pr.price)||0:Math.max(0,Number(x.p)||0),ok:!!pr};
  }).filter(x=>x.name);
  if(!items.length)return null;
  const p={id,mesa,mesaNombre:tableLabel(mesa),items,total:items.reduce((s,i)=>s+i.qty*i.price,0),nota:String(o.nota||'').slice(0,140),
    at:Number(o.at)||Date.now(),recibidoEn:Date.now(),estado:'nuevo',origen:origen||'qr',sinCodigo:!verificado||undefined,negocio:qCfg().topic,canal:qCanalOk(window.__canalTopic)?window.__canalTopic:qCfg().topic,hist:[{e:'nuevo',at:Date.now()}]};
  pedidosLista().push(p);
  try{const g=window.vitoGrupos&&window.vitoGrupos.de(mesa);if(g&&window.ventoAuditar)window.ventoAuditar('pedido en grupo','Nuevo pedido de '+tableLabel(mesa)+' agregado al grupo '+window.vitoGrupos.etiqueta(g)+': '+items.map(i=>i.qty+' '+i.name).join(', '),[mesa]);}catch(e){}
  if(pedidosAuto()&&verificado){pedidoAplicar(p);p.estado='recibido';p.hist.push({e:'recibido',at:Date.now()});}
  if(!verificado){
    try{window.ventoAuditar&&window.ventoAuditar('pedido sin código de mesa','Pedido para '+tableLabel(mesa)+' sin el código de su QR: quedó por aceptar ('+items.map(i=>i.qty+' '+i.name).join(', ').slice(0,200)+')');}catch(e){}
    setTimeout(()=>{try{showToast('⚠️ Pedido para '+tableLabel(mesa)+' sin el código de su QR: revísalo antes de aceptarlo.',9000);}catch(e){}},400);
  }
  pedidosGuardar();pedidoPublicar(p);
  const txt=items.map(i=>i.qty+' '+i.name+(i.ok?'':' ⚠️')).join(', ');
  try{window.vitoLogNotif&&window.vitoLogNotif(p.estado==='nuevo'?'recibido':'enviado',mesa,items.map(i=>({productText:i.name,qty:i.qty})),id);}catch(e){}
  if(notifPedidos()){ventoAvisoCel((p.estado==='nuevo'?'🆕 Pedido por aceptar · ':'🍺 Pedido · ')+tableLabel(mesa),txt,'pedidos');showToast((p.estado==='nuevo'?'🆕 Pedido por aceptar · ':'🍺 ')+tableLabel(mesa)+': '+txt,6000);
    if(p.estado!=='nuevo'){try{window.vitoTimbre&&window.vitoTimbre();window.vitoDecir&&window.vitoDecir('Pedido recibido, '+tableLabel(mesa));}catch(e){}}}
  const malos=items.filter(i=>!i.ok);
  if(malos.length)showToast('⚠️ '+tableLabel(mesa)+' pidió algo que no está en tus productos: '+malos.map(i=>i.name).join(', ')+'. Agrégalo a mano.',9000);
  return p;
}
function pedidoCambiar(id,estado){
  const p=pedidosLista().find(x=>x.id===id);if(!p||!PEDIDO_EST[estado]||p.estado===estado)return p;
  if(estado==='cancelado'&&p.aplicado&&['recibido','preparacion','nuevo'].includes(p.estado)){
    const its=p.items.filter(i=>i.ok).map(i=>({productText:i.name,qty:i.qty}));
    if(its.length)try{sinSonidoPos(()=>applyVoiceItems(p.mesa,its,'subtract'));}catch(e){}
    p.aplicado=false;try{renderMesas();}catch(e){}
  }
  if(estado!=='cancelado'&&!p.aplicado)pedidoAplicar(p);
  p.estado=estado;p.hist.push({e:estado,at:Date.now()});
  pedidosGuardar();pedidoPublicar(p);
  return p;
}
// Pedidos que ya se sumaron a la cuenta por otro camino (app de meseros): también van a preparación.
function pedidoRegistrarAplicado(mesa,added,origen){
  const items=(added||[]).filter(a=>a.qty>0).map(a=>{const pr=pedidoProducto(a.name);return{productId:pr?pr.id:null,name:a.name,qty:a.qty,price:pr?Number(pr.price)||0:0,ok:true};});
  if(!items.length)return null;
  const p={id:'m'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),mesa:parseInt(mesa,10),mesaNombre:tableLabel(mesa),items,total:items.reduce((s,i)=>s+i.qty*i.price,0),
    at:Date.now(),recibidoEn:Date.now(),estado:'recibido',origen:origen||'mesero',negocio:qCfg().topic,aplicado:true,hist:[{e:'recibido',at:Date.now()}]};
  pedidosLista().push(p);pedidosGuardar();return p;
}
window.vitoPedidos={lista:pedidosLista,entrante:pedidoEntrante,cambiar:pedidoCambiar,registrarAplicado:pedidoRegistrarAplicado,EST:PEDIDO_EST,auto:pedidosAuto};
// Para las pruebas de seguridad de los canales (pruebas/canalseguro.test.js): lo que llega por cada canal.
window.vitoCanalPrueba={procesar:procesar,procesarMesero:procesarMesero,procesarPrep:procesarPrep,vTopic:vTopic,qMesaCodigo:qMesaCodigo};
// Compatibilidad con la campana y la pantalla vieja: aceptar = recibido; rechazar = cancelado.
window.vitoDespacharPedido=id=>pedidoCambiar(id,'recibido');
window.vitoRechazarPedido=id=>pedidoCambiar(id,'cancelado');
// Pedidos que quedaron "por despachar" en la versión anterior: pasan a la lista nueva (no se pierden).
setTimeout(()=>{try{
  const viejos=JSON.parse(localStorage.getItem('vito_pedidos_pend')||'[]');
  viejos.forEach(v=>{if(!pedidosLista().some(x=>x.id===v.id))pedidoEntrante({id:v.id,mesa:v.mesa,at:v.ts,items:(v.items||[]).map(i=>({n:i.productText,q:i.qty}))},'qr');});
}catch(e){}},2500);

// Avisos (toasts/sonidos) dentro de la app, por separado para pedidos y música —
// para no confundirlos con las alertas del canal de ORDEVA (esas sí avisan con la pantalla
// bloqueada; estas son mientras ORDEVA está abierta).
const NOTIF_KEY='vito_notif';
const notifCfg=()=>Object.assign({pedidos:true,musica:true,cuenta:true,pagos:true,domicilios:true,soporte:true,ia:true},LS(NOTIF_KEY,{}));
// La app Android avisa los pagos por su cuenta (también con ORDEVA cerrada): se le dice si el aviso de pagos está prendido.
try{const A=window.VentoAndroid;if(A&&A.pagosNotif)A.pagosNotif(notifCfg().pagos!==false);}catch(e){}
const notifPedidos=()=>notifCfg().pedidos;
const notifMusica=()=>notifCfg().musica;
window.notifPedidos=notifPedidos;window.notifMusica=notifMusica;   // para el módulo de la campana, que corre en otro cierre
window.ventoAvisoOn=tipo=>notifCfg()[tipo]!==false&&(tipo!=='pagos'||!window.ventoPagoSuenaAqui||window.ventoPagoSuenaAqui());   // cada aviso se puede apagar (Ajustes → Notificaciones); los de pago, también si el administrador eligió que aquí no suenen
function iniQR(){
  const c=qCfg();
  // Interruptores de cada aviso (Ajustes → Notificaciones del celular → Qué avisos quieres recibir)
  const nc=notifCfg();
  document.querySelectorAll('input[data-notif]').forEach(i=>{
    i.checked=nc[i.dataset.notif]!==false;
    i.onchange=()=>{const x=notifCfg();x[i.dataset.notif]=i.checked;SS(NOTIF_KEY,x);if(i.dataset.notif==='pagos')try{window.VentoAndroid&&window.VentoAndroid.pagosNotif&&window.VentoAndroid.pagosNotif(i.checked);}catch(e){}showToast(i.checked?'🔔 Aviso prendido.':'🔕 Aviso apagado: ya no te sale ni suena.');};
  });
  document.querySelectorAll('[data-notif-probar]').forEach(b=>{b.onclick=()=>{
    const k=b.dataset.notifProbar,T={pedidos:['🍺 Prueba · Mesa 1','2 Águila (así te llegan los pedidos)'],musica:['🎵 Prueba · Mesa 1','Karol G - Provenza (así te llegan las canciones)'],avisos:['🧠 ORDEVA','Así te llegan los avisos de ORDEVA IA y del soporte.']}[k];
    showToast(T[0]+': '+T[1],5000);try{window.vitoTimbre&&window.vitoTimbre();}catch(e){}
    let cel=false;try{const A=window.VentoAndroid;if(A&&A.notificar)cel=A.notificar(T[0],T[1],k,true);}catch(e){}
    const m=$('avTiposMsg');if(m)m.textContent=window.VentoAndroid?(cel?'✅ Te llegó la notificación al celular. Si no sonó, toca «📲 Abrir las notificaciones de ORDEVA en el celular» y prende la categoría «'+({pedidos:'Pedidos y cuentas',musica:'Canciones pedidas',avisos:'Avisos de ORDEVA'}[k])+'».':'⚠️ El celular no dejó mostrar la notificación: toca «🔔 Activar las notificaciones».'):'En el navegador el aviso sale solo con ORDEVA abierta.';
  };});
  // Si esta misma app está servida desde GitHub Pages, el link de la página de
  // pedidos debe ser justo esta misma dirección. Se corrige sola si quedó
  // desactualizada (ej. cambió la rama que publica GitHub Pages) — esto NO
  // toca el canal ni los códigos de cada mesa, así que los QR ya pegados en
  // las mesas siguen sirviendo exactamente igual; solo actualiza a dónde
  // apuntan los QR nuevos que imprimas de ahora en adelante.
  if(/\.github\.io$/.test(location.hostname)){   // todo por GitHub (los QR fijados conservan su canal y códigos; solo el link nuevo es de GitHub)
    const actual=location.origin+location.pathname.replace(/[^/]*$/,'')+'pedido.html';
    if(c.url!==actual){
      const antes=c.url;
      c.url=actual;SS('vito_qr',c);
      if(antes)showToast('🔄 Actualicé el link de tu página de pedidos al de GitHub: '+actual+'. Los QR ya pegados en las mesas siguen sirviendo igual.',8000);
    }
  }
  $('qrUrl').value=c.url;$('qrWa').value=c.wa;$('liveOn').checked=c.live;
  const g=(k,v)=>{const x=qCfg();x[k]=v;SS('vito_qr',x);};
  $('qrUrl').oninput=e=>g('url',e.target.value.trim());
  $('qrWa').oninput=e=>g('wa',e.target.value.replace(/\D/g,''));
  $('liveOn').onchange=e=>{g('live',e.target.checked);conectar();};
  $('qrGen').onclick=()=>pintarQR($('qrGrid'));
  $('qrFijoBtn').onclick=qrFijoDialogo;
  $('qrProbar').onclick=async()=>{const b=$('qrProbar'),r=$('qrProbarRes');b.disabled=true;b.textContent='⏳ Probando…';r.hidden=false;r.textContent='Mandando un pedido de prueba por el canal de tus QR…';
    try{const o=await qProbarPedidos();r.textContent=o.join('\n');showToast(o.some(x=>x.startsWith('❌'))?'⚠️ '+o.find(x=>x.startsWith('❌')).replace(/^❌\s*/,''):'✅ Los pedidos y canciones de los QR están llegando.',9000);}
    finally{b.disabled=false;b.textContent='🩺 Probar pedidos';}};
  $('qrUrl').addEventListener('change',()=>{const f=qrFijoDe();if(f&&f.url&&$('qrUrl').value.trim()!==f.url)showToast('✅ Cambiaste de proveedor: los QR que YA pegaste en las mesas (con «'+f.url+'») siguen sirviendo exactamente igual. Esto solo define a dónde apuntan los QR NUEVOS que imprimas de aquí en adelante.',9000);});
  qrFijoSync();qrFijoEstado();qrFijoDesdeHash();
  window.addEventListener('hashchange',qrFijoDesdeHash);
  $('qrPrintBtn').onclick=imprimirQR;
  conectar();
}

/* ---------- Música: máximo 5 por mesa y turnos equitativos ---------- */
// Canciones por mesa cada 15 min (Ajustes → Negocio → Música): 10 (así viene); 0 = sin límite.
const mzMax=()=>{const v=typeof data!=='undefined'&&data?data.cancionesMesa:undefined;if(v==null||v==='')return 10;const n=Number(v);return n>0?n:0;};
const cola=()=>LS('vito_cola',[]);
const VENT=15*6e4;
/* ---------- Una sola cola con estados (vito_cola) ----------
   Cada pedido: {id, mesa, song (lo que se busca), pedido (lo que escribió el cliente), title, artist,
   vid (YouTube video ID), url, dur (s), ts (pedido), startedAt, endedAt, playedSeconds, status}.
   status: pending (recién pedida) · approved (versión encontrada y comprobada) · playing ·
   played · skipped · cancelled. `done` se mantiene (= ya no está esperando) para lo que ya lo usaba.
   Todo lo que termina queda en el historial (vito_mzhist) y se respalda en IndexedDB. */
const MZ_HIST='vito_mzhist';
const mzHist=()=>LS(MZ_HIST,[]);
// «pon una canción de Feid», «quiero Poker», «ponme la de Shakira» → lo que hay que buscar
function mzLimpiarPedido(t){
  let q=String(t||'').trim();
  const base=q.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  q=q.replace(/^(por\s+favor\s+)?(pon(me|ga|gan)?|quiero( escuchar| oir)?|coloca(me)?|reproduce|me\s+pone[ns]?|pongan|regalame|nos\s+pone[ns]?)\s+/i,'')
     .replace(/^(una|la|el|un)\s+(cancion|canción|tema|rola)\s+(de|del)\s+/i,'')
     .replace(/^(algo|lo que sea|cualquiera)\s+(de|del)\s+/i,'').replace(/^(la|el)\s+(de|del)\s+/i,'').replace(/\s+por\s+favor$/i,'').trim();
  let title='',artist='';
  const g1=q.match(/^(.+?)\s+-\s+(.+)$/),g=g1?null:q.match(/^(.+?)\s+de\s+(.+)$/i);
  if(g1){artist=g1[1].trim();title=g1[2].trim();}                 // «Artista - Canción» (como lo escribe YouTube)
  else if(g){title=g[1].trim();artist=g[2].trim();}                // «Canción de Artista»
  else if(/(cancion|tema|algo)\s+(de|del)\s/.test(base)) artist=q; else title=q;
  return {query:q||String(t||'').trim(),title,artist};
}
function mzCambiar(id,cambios){const l=cola(),it=l.find(y=>y.id===id);if(!it)return null;Object.assign(it,cambios);SS('vito_cola',l);mzRespaldo();return it;}
function mzAlHistorial(it){
  if(!it)return;
  const h=mzHist().filter(x=>x.id!==it.id);
  h.push({id:it.id,mesa:it.mesa,mesaNombre:tableLabel(it.mesa),song:it.song,pedido:it.pedido||it.song,title:it.title||'',artist:it.artist||'',vid:it.vid||null,
    reqId:it.reqId||null,requestedAt:it.ts,startedAt:it.startedAt||null,endedAt:it.endedAt||null,duration:it.dur||null,playedSeconds:it.playedSeconds||0,status:it.status,fuente:it.fuente||''});
  SS(MZ_HIST,h.slice(-2000));mzRespaldo();
}
// Empezó a sonar (en el TV, en el reproductor de la app o en YouTube Music)
function mzEmpezo(id,fuente){
  const l=cola(),now=Date.now();
  l.filter(y=>y.status==='playing'&&y.id!==id).forEach(y=>{               // la que sonaba antes se cierra
    const fin=y.dur&&y.playedSeconds>=y.dur*0.9;y.status=fin?'played':'skipped';y.endedAt=now;
    if(y.startedAt&&(y.fuente==='ytmusic'||!y.playedSeconds))y.playedSeconds=Math.round((now-y.startedAt)/1000);
    if(y.dur)y.playedSeconds=Math.min(y.playedSeconds,y.dur);y.status=y.dur&&y.playedSeconds>=y.dur*0.9?'played':'skipped';mzAlHistorial(y);});
  const it=l.find(y=>y.id===id);
  if(it){it.done=true;it.status='playing';it.startedAt=now;it.endedAt=null;it.playedSeconds=0;it.fuente=fuente||it.fuente||'';}
  SS('vito_cola',l);mzRespaldo();return it;
}
// Progreso real que manda el reproductor (segundos sonados y duración del video)
function mzProgreso(id,t,d){
  const it=mzCambiar(id,Object.assign({playedSeconds:Math.max(0,Math.round(t||0)),progresoAt:Date.now()},d>0?{dur:Math.round(d)}:{}));
  if(it&&it.status!=='playing'&&!['played','skipped','cancelled'].includes(it.status))mzCambiar(id,{status:'playing',done:true,startedAt:it.startedAt||Date.now()-1000*(t||0)});
  mzPintarSonando();
}
function mzTermino(id,estado,t){
  const l=cola(),it=l.find(y=>y.id===id);if(!it||['played','skipped','cancelled'].includes(it.status)&&estado!=='cancelled')return;
  it.done=true;it.status=estado||'played';it.endedAt=Date.now();
  if(t!=null)it.playedSeconds=Math.round(t);else if(it.startedAt&&!it.playedSeconds)it.playedSeconds=Math.round((it.endedAt-it.startedAt)/1000);
  SS('vito_cola',l);mzAlHistorial(it);mzPintarSonando();
}
const mzActual=()=>cola().find(y=>y.status==='playing')||null;
const mmss=s=>{s=Math.max(0,Math.round(s||0));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');};
function mzPintarSonando(){
  const e=$('mzSonando');if(!e)return;
  const x=mzActual();
  if(!x){e.hidden=true;return;}
  let t=x.playedSeconds||0;
  if((x.fuente==='ytmusic'||(x.fuente==='tvyt'&&!x.progresoAt))&&x.startedAt)t=Math.round((Date.now()-x.startedAt)/1000);    // en la app externa solo se sabe el tiempo transcurrido
  else if(x.progresoAt)t+=Math.round((Date.now()-x.progresoAt)/1000);
  if(x.dur)t=Math.min(t,x.dur);
  const pct=x.dur?Math.min(100,t/x.dur*100):0;
  e.hidden=false;
  e.innerHTML='<div class="mzs-t">▶ <b>'+esc(x.title||x.song)+'</b>'+(x.artist?' · '+esc(x.artist):'')+' <span>· '+esc(mzEtq(x))+'</span></div>'+
    '<div class="mzs-bar"><i style="width:'+pct.toFixed(1)+'%"></i></div><div class="mzs-time">'+mmss(t)+' / '+(x.dur?mmss(x.dur):'--:--')+(x.dur?' · faltan '+mmss(x.dur-t):'')+
    (x.fuente==='ytmusic'?' · (en YouTube Music: tiempo aproximado)':'')+'</div>';
}
setInterval(()=>{try{mzPintarSonando();}catch(e){}},1000);
// Respaldo en IndexedDB (además de localStorage): si el navegador borra el almacenamiento rápido,
// la cola y el historial se recuperan al abrir ORDEVA.
let mzRespT=null;
function mzRespaldo(){clearTimeout(mzRespT);mzRespT=setTimeout(()=>{try{const r=indexedDB.open('vento-musica',1);r.onupgradeneeded=()=>r.result.createObjectStore('estado');
  r.onsuccess=()=>{try{const t=r.result.transaction('estado','readwrite');t.objectStore('estado').put({cola:cola(),hist:mzHist(),now:LS('vito_now',null),at:Date.now()},ventoClave('musica'));}catch(e){}};}catch(e){}},800);}
function mzRecuperar(){return new Promise(res=>{try{const r=indexedDB.open('vento-musica',1);r.onupgradeneeded=()=>r.result.createObjectStore('estado');
  r.onsuccess=()=>{try{const q=r.result.transaction('estado','readonly').objectStore('estado').get(ventoClave('musica'));q.onsuccess=()=>res(q.result||null);q.onerror=()=>res(null);}catch(e){res(null);}};r.onerror=()=>res(null);}catch(e){res(null);}});}
function agregarCancion(mesa,song,reqId){
  if(!song)return{msg:'⚠️ Canción vacía',nuevo:false};
  const pedidoOriginal=String(song).slice(0,120),lim=mzLimpiarPedido(song);
  song=lim.query||song;
  const now=Date.now(),l=cola().filter(x=>now-x.ts<36*36e5);
  // Sin duplicados: el mismo pedido (mismo ID, o la misma canción de la misma mesa en 3 minutos por
  // doble toque, recarga o reintento) no se vuelve a encolar.
  const nk=normVoiceText(song);
  const dup=l.concat(mzHist()).find(x=>(reqId&&x.reqId===reqId)||(x.mesa===mesa&&normVoiceText(x.song||'')===nk&&now-(x.ts||x.requestedAt||0)<3*6e4&&x.status!=='cancelled'));
  if(dup)return{msg:'🎵 Esa canción ya está en la cola.',nuevo:false};
  const rec=l.filter(x=>x.mesa===mesa&&now-x.ts<VENT).sort((x,y)=>x.ts-y.ts);
  // El límite es POR MESA (sumando todos los celulares de esa mesa), no por dispositivo.
  const MAX=mzMax();
  if(mesa!==0&&MAX&&rec.length>=MAX)return{msg:'🎵 '+tableLabel(mesa)+' ya pidió '+MAX+' canciones; podrá pedir otra en '+Math.ceil((rec[0].ts+VENT-now)/6e4)+' min.',limite:true,min:Math.ceil((rec[0].ts+VENT-now)/6e4)};
  const it={id:now+'-'+Math.random().toString(36).slice(2,6),reqId:reqId||null,mesa,mesaNombre:tableLabel(mesa),song:song.slice(0,120),pedido:pedidoOriginal,title:lim.title.slice(0,80),artist:lim.artist.slice(0,60),ts:now,done:false,status:'pending'};
  l.push(it);SS('vito_cola',l);mzRespaldo();
  // Busca el video y la agrega sola a la lista/reproductor apenas llega el pedido,
  // sin esperar a que alguien toque "Cargar en mi lista" (antes solo pasaba con
  // ese botón, así que las canciones nuevas se quedaban esperando en silencio).
  try{ if(typeof ytAgregar === 'function') ytAgregar(it.id); }catch(e){}
  try{ tvPublicar(); }catch(e){}
  // La cuenta en vivo de la mesa lleva cuántas canciones ya pidió la mesa: así cada celular ve el cupo real.
  try{ clearTimeout(pubT); pubT=setTimeout(publicarCuentas,1200); }catch(e){}
  return{msg:'🎵 '+tableLabel(mesa)+': '+song,nuevo:true};
}
window.vitoAddSong=(mesa,song)=>{const r=agregarCancion(mesa,song);try{renderMusica();}catch(e){}return r.msg;};
// Para ORDEVA (y la campana): leer y manejar la cola sin duplicar su lógica.
window.vitoMusica={cola:()=>cola(),hist:()=>mzHist(),actual:()=>mzActual(),saltar:()=>mzSaltar(),cancelar:id=>{if(mqOtro())mqPub({t:'cmd',a:'quitar',id});mzTermino(id,'cancelled');try{tvPublicar(true);renderMusica();}catch(e){}},auto:()=>AUTO(),tv:()=>tvOn()};
// Rotación justa: cada mesa tiene «turnos». Su 1.ª canción va en la ronda 1, la 2.ª en la ronda 2…
// y lo que ya le sonó en la última hora cuenta: una mesa que ya escuchó 3 no se adelanta a una
// que no ha escuchado ninguna. Dentro de la misma ronda manda el orden de llegada.
// La música de fondo (tu playlist) va SIEMPRE después de lo que piden las mesas.
function ordenJusto(l){
  const cnt={},turno=new Map(),hace=Date.now()-60*6e4,q=x=>x.fondo?'fondo':x.mesa;
  mzHist().concat(l.filter(x=>x.status==='playing')).forEach(x=>{if(['played','playing','skipped'].includes(x.status)&&(x.startedAt||x.requestedAt||0)>=hace)cnt[q(x)]=(cnt[q(x)]||0)+1;});
  l.filter(x=>!x.done).sort((a,b)=>a.ts-b.ts).forEach(x=>{cnt[q(x)]=(cnt[q(x)]||0)+1;turno.set(x.id,cnt[q(x)]);});
  // «⏭ Que siga» (panel de YouTube): esa canción va de primera.
  return l.filter(x=>!x.done).sort((a,b)=>(b.primero||0)-(a.primero||0)||(a.fondo?1:0)-(b.fondo?1:0)||turno.get(a.id)-turno.get(b.id)||a.ts-b.ts);
}
const mzEtq=x=>x&&x.fondo?'🎶 '+(x.mesaNombre||'Tu playlist'):tableLabel(x.mesa);
/* ---------- 📃 Mis playlists de YouTube: música de fondo del negocio ----------
   Se guardan en los datos del negocio (data.mzListas, llegan a los demás celulares). Al «Poner» una, sus canciones
   entran a la cola de a 2 (así lo que pide una mesa no queda detrás de 100 canciones, y no se gasta el cupo de
   YouTube metiéndolas todas de una) y suenan por el camino de siempre: TV, YouTube del TV o el reproductor de la app.
   Las canciones se leen del Servidor ORDEVA sin cupo (vento-ia/yt/lista); de respaldo, la API (1 unidad por cada 50). */
const MZF_KEY='vito_fondo';
const mzF=()=>LS(MZF_KEY,{on:false});
const mzListas=()=>((typeof data!=='undefined'&&data&&Array.isArray(data.mzListas))?data.mzListas:[]);
function mzListaId(t){
  t=String(t||'').trim();
  const m=/[?&]list=([\w-]{10,})/.exec(t);if(m)return m[1];
  return /^(PL|OLAK5uy_|RD|UU|FL|OL|VL)[\w-]{8,}$/.test(t)?t.replace(/^VL/,''):'';
}
async function mzSrv(ruta){
  const b=typeof iaVentoBase==='function'?iaVentoBase():'';if(!b)return null;
  const ctrl=new AbortController(),tm=setTimeout(()=>ctrl.abort(),20000);
  try{const r=await fetch(b+ruta,{signal:ctrl.signal});return r.ok?await r.json():null;}catch(e){return null;}finally{clearTimeout(tm);}
}
async function mzLeerLista(id){
  const j=await mzSrv('/yt/lista?id='+encodeURIComponent(id));
  if(j&&Array.isArray(j.items)&&j.items.length)return{titulo:j.titulo||'',vids:j.items.filter(x=>x&&x.id&&x.id.videoId).map(x=>({v:x.id.videoId,t:(x.snippet&&x.snippet.title)||'',c:(x.snippet&&x.snippet.channelTitle)||'',d:x.duracion||null}))};
  const vids=[];let tok='',titulo='';
  try{
    for(let n=0;n<4;n++){
      const r=await yGet('playlistItems?part=snippet&maxResults=50&playlistId='+encodeURIComponent(id)+(tok?'&pageToken='+encodeURIComponent(tok):''));
      if(!r||!Array.isArray(r.items))break;
      r.items.forEach(it=>{const sn=it.snippet||{},v=sn.resourceId&&sn.resourceId.videoId;if(v&&!/^(private|deleted) video$/i.test(sn.title||''))vids.push({v,t:sn.title||'',c:sn.videoOwnerChannelTitle||'',d:null});});
      tok=r.nextPageToken;if(!tok)break;
    }
    const p=await yGet('playlists?part=snippet&id='+encodeURIComponent(id));titulo=(p&&p.items&&p.items[0]&&p.items[0].snippet&&p.items[0].snippet.title)||'';
  }catch(e){}
  return vids.length?{titulo,vids}:null;
}
const mzMezclar=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
function mzGuardarLista(id,nombre,n){
  if(typeof data==='undefined'||!data)return;
  data.mzListas=[{id,nombre:String(nombre||'Mi playlist').slice(0,80),n:n||null}].concat(mzListas().filter(x=>x.id!==id)).slice(0,30);
  saveData();
}
async function mzPonerLista(id,nombre,boton){
  if(mqOtro()){mzGuardarLista(id,nombre||'Mi playlist',null);mqPub({t:'cmd',a:'lista',id,nombre:nombre||''});showToast('🎶 La lista va a sonar de fondo en «'+mqNombre()+'».',6000);return true;}
  if(boton){boton.disabled=true;boton.dataset.t=boton.textContent;boton.textContent='⏳';}
  try{
    const L=await mzLeerLista(id);
    if(!L){showToast('⚠️ No pude leer esa playlist. Revisa que sea pública (o «no listada») y que haya internet.',8000);return false;}
    const nom=L.titulo||nombre||'Mi playlist';
    mzGuardarLista(id,nom,L.vids.length);
    mzFondoQuitar(true);
    const mezclar=!!($('mzPlMezclar')&&$('mzPlMezclar').checked),repetir=!($('mzPlRepetir')&&!$('mzPlRepetir').checked);
    SS(MZF_KEY,{on:true,id,nombre:nom,vids:mezclar?mzMezclar(L.vids):L.vids,pos:0,mezclar,repetir});
    const pr=mzAsegurarReproductor(true);                     // que suene de verdad en este equipo si nadie más la pone
    mzFondoRellenar();
    showToast('🎶 Sonando de fondo: «'+nom+'» ('+L.vids.length+' canciones). Lo que pidan las mesas va primero.'+(pr==='prendido'?' Encendí el reproductor de ORDEVA: suena en este equipo.':''),7000);
    try{renderMusica();}catch(e){}
    return true;
  }finally{if(boton){boton.disabled=false;boton.textContent=boton.dataset.t||'▶ Poner';}}
}
function mzFondoQuitar(silencio){
  if(mqOtro()&&!silencio){mqPub({t:'cmd',a:'fondo-quitar'});showToast('⏹ Quitando la música de fondo en «'+mqNombre()+'».');return;}
  const f=mzF();f.on=false;SS(MZF_KEY,f);
  cola().filter(x=>x.fondo&&!x.done&&x.status!=='playing').forEach(x=>mzTermino(x.id,'cancelled'));
  try{tvPublicar(true);}catch(e){}
  if(!silencio){showToast('⏹ Quitaste la música de fondo.');try{renderMusica();}catch(e){}}
}
function mzFondoRellenar(){
  const f=mzF();if(!f.on||!Array.isArray(f.vids)||!f.vids.length)return;
  const l=cola();let falta=2-l.filter(x=>x.fondo&&!x.done).length,nuevos=0,vueltas=0;
  while(falta>0&&vueltas++<f.vids.length*2){
    if(f.pos>=f.vids.length){
      if(!f.repetir){f.on=false;showToast('🎶 Terminó tu playlist «'+f.nombre+'».');break;}
      f.pos=0;if(f.mezclar)f.vids=mzMezclar(f.vids);
    }
    const v=f.vids[f.pos++];if(!v||!v.v||ytBad().includes(v.v))continue;
    const now=Date.now();
    if(v.d)ytDurCache[v.v]=v.d;
    l.push({id:now+'-'+Math.random().toString(36).slice(2,6),reqId:null,mesa:0,fondo:true,mesaNombre:f.nombre,song:String(v.t||'Canción').slice(0,120),pedido:String(v.t||'').slice(0,120),title:String(v.t||'').slice(0,80),artist:String(v.c||'').slice(0,60),vid:v.v,dur:v.d||null,ts:now+nuevos,done:false,status:'pending'});
    falta--;nuevos++;
  }
  SS(MZF_KEY,f);
  if(!nuevos)return;
  SS('vito_cola',l);mzRespaldo();
  l.filter(x=>x.fondo&&!x.done&&!x.yt).forEach(x=>{try{ytAgregar(x.id);}catch(e){}});
  try{tvPublicar();}catch(e){}
  try{verificarCola();}catch(e){}
  try{renderMusica();}catch(e){}
}
setInterval(()=>{try{mzFondoRellenar();}catch(e){}},8000);
function mzPlFila(x,acciones){
  const d=document.createElement('div');d.className='mz-song';
  const sp=document.createElement('span');sp.innerHTML='<b></b> <small></small>';sp.querySelector('b').textContent=x.nombre;sp.querySelector('small').textContent=x.extra||'';
  d.appendChild(sp);
  acciones.forEach(([t,fn])=>{const b=document.createElement('button');b.type='button';b.className=t.startsWith('▶')?'btn-primary':'btn-ghost';b.textContent=t;b.onclick=()=>fn(b);d.appendChild(b);});
  return d;
}
function mzPlPintar(){
  const A=$('mzPlAhora'),L=$('mzPlLista');if(!A||!L)return;
  const f=mzF();
  A.hidden=!f.on;
  if(f.on){
    A.textContent='';const t=document.createElement('span');t.innerHTML='🎶 <b></b> <small></small>';t.querySelector('b').textContent='De fondo: «'+f.nombre+'»';
    t.querySelector('small').textContent='· canción '+Math.min(f.pos,(f.vids||[]).length)+' de '+(f.vids||[]).length+(f.mezclar?' · 🔀':'')+(f.repetir?' · 🔁':'');
    const b=document.createElement('button');b.type='button';b.className='btn-ghost';b.textContent='⏹ Quitar';b.onclick=()=>mzFondoQuitar();
    A.append(t,b);
  }
  L.textContent='';
  const ls=mzListas();
  if(!ls.length){const e=document.createElement('div');e.className='empty-note';e.textContent='Todavía no tienes playlists guardadas.';L.appendChild(e);return;}
  ls.forEach(x=>L.appendChild(mzPlFila({nombre:x.nombre,extra:(x.n?x.n+' canciones':'')+(f.on&&f.id===x.id?' · sonando':'')},[
    ['▶ Poner',b=>mzPonerLista(x.id,x.nombre,b)],
    ['🗑',()=>{if(f.on&&f.id===x.id)mzFondoQuitar(true);data.mzListas=mzListas().filter(y=>y.id!==x.id);saveData();mzPlPintar();}]])));
}
async function mzPlBuscar(){
  const inp=$('mzPlIn'),R=$('mzPlRes'),b=$('mzPlBuscar');if(!inp||!R)return;
  const q=inp.value.trim();if(!q)return showToast('Pega el link de la playlist o escribe un nombre.');
  const id=mzListaId(q);
  R.textContent='';b.disabled=true;b.textContent='⏳';
  try{
    if(id){ if(await mzPonerLista(id,'',null)){inp.value='';} return; }
    const j=await mzSrv('/yt/buscar?tipo=lista&q='+encodeURIComponent(q));
    const items=(j&&Array.isArray(j.items)?j.items:[]).filter(x=>x&&x.id&&x.id.playlistId).slice(0,8);
    if(!items.length){const e=document.createElement('div');e.className='empty-note';e.textContent='No encontré playlists con ese nombre. Prueba con otras palabras o pega el link.';R.appendChild(e);return;}
    items.forEach(x=>{const nombre=(x.snippet&&x.snippet.title)||'Playlist';
      R.appendChild(mzPlFila({nombre,extra:[(x.canciones?x.canciones+' canciones':''),(x.snippet&&x.snippet.channelTitle)||''].filter(Boolean).join(' · ')},[
        ['▶ Poner',async bt=>{if(await mzPonerLista(x.id.playlistId,nombre,bt))R.textContent='';}],
        ['➕ Guardar',()=>{mzGuardarLista(x.id.playlistId,nombre,x.canciones);mzPlPintar();showToast('📃 Guardada en tus playlists.');}]]));});
  }finally{b.disabled=false;b.textContent='🔎 Buscar';}
}
// Para ORDEVA (voz/asistente) y las pruebas: el orden de la cola y la música de fondo.
if(window.vitoMusica)Object.assign(window.vitoMusica,{orden:()=>ordenJusto(cola()),terminar:(id,e)=>mzTermino(id,e),fondo:{poner:mzPonerLista,quitar:mzFondoQuitar,rellenar:mzFondoRellenar,estado:mzF,listas:mzListas}});
(function(){
  const b=$('mzPlBuscar'),i=$('mzPlIn');if(!b||!i)return;
  b.onclick=mzPlBuscar;i.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();mzPlBuscar();}});
  const f=mzF();if($('mzPlMezclar'))$('mzPlMezclar').checked=!!f.mezclar;if($('mzPlRepetir'))$('mzPlRepetir').checked=f.repetir!==false;
  $('mzPlMezclar').onchange=e=>{const x=mzF();x.mezclar=e.target.checked;if(x.on&&x.mezclar)x.vids=x.vids.slice(0,x.pos).concat(mzMezclar(x.vids.slice(x.pos)));SS(MZF_KEY,x);mzPlPintar();};
  $('mzPlRepetir').onchange=e=>{const x=mzF();x.repetir=e.target.checked;SS(MZF_KEY,x);mzPlPintar();};
})();
// Abre una canción en YouTube MUSIC (no YouTube normal). Si ya se conoce el
// video exacto (vid, resuelto por la búsqueda automática) va directo a esa
// canción en vez de a una búsqueda, para no tener que elegirla a mano.
// En Android, un link común a music.youtube.com a veces lo abre la app de
// YouTube normal (no la de YouTube Music) porque el teléfono no la tiene
// asociada; el "intent://" de abajo le pide a Android la app de YouTube
// Music por su nombre exacto, y si no la tiene instalada cae solo al link
// normal de siempre.
function ytOpenMusicPath(path){
  const ua = navigator.userAgent;
  // Android: «intent» oficial de Chrome con el paquete de YouTube Music; si no está instalada,
  // abre la canción en YouTube en el navegador. iPhone: enlace universal https (lo abre la app si está).
  const fb = /^watch\?v=([\w-]{6,})/.exec(path);
  const respaldo = fb ? ';S.browser_fallback_url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + fb[1]) : '';
  if(window.esAndroid()) location.href = 'intent://music.youtube.com/' + path + '#Intent;package=com.google.android.apps.youtube.music;scheme=https;action=android.intent.action.VIEW' + respaldo + ';end';
  else if(/iPhone|iPad|iPod/i.test(ua)) abrirYTMusicIOS(path);
  else window.open('https://music.youtube.com/' + path, '_blank');
}
// iPhone: primero se intenta la app de YouTube Music (si está instalada se abre ahí); si a los 1,6 s la
// página sigue a la vista es porque no se abrió, y entonces va la versión web que sí funciona.
function abrirYTMusicIOS(path){
  let salio = false; const marca = () => { salio = true; };
  document.addEventListener('visibilitychange', marca, { once: true }); window.addEventListener('pagehide', marca, { once: true });
  setTimeout(() => { if(!salio && !document.hidden) location.href = 'https://music.youtube.com/' + path; }, 1600);
  location.href = 'youtubemusic://music.youtube.com/' + path;
}
window.abrirYTMusicIOS = abrirYTMusicIOS;
function ytOpenMusic(vid, song){
  ytOpenMusicPath(vid ? ('watch?v=' + encodeURIComponent(vid)) : ('search?q=' + encodeURIComponent(song || '')));
}
function reproducir(x){
  if(mqOtro()){mqPub({t:'cmd',a:'poner',id:x.id});showToast('▶ «'+(x.title||x.song)+'» → suena ya en «'+mqNombre()+'».');return;}
  // Con el TV conectado, «▶» manda la música al TV (antes abría YouTube Music afuera, en el celular).
  if(window.tvConectado&&window.tvConectado()){try{window.tvMandarYa();}catch(e){}showToast('📺 Mandando la música al TV…');return;}
  const it=mzEmpezo(x.id,'ytmusic');
  SS('vito_now',x);
  // Con Google conectado y la canción ya en tu lista: se abre DENTRO de la lista, así YouTube Music sigue solo con las demás.
  const y=yCfg();
  if(x.vid&&yTok()&&y.pl&&it&&it.yt===true)ytOpenMusicPath('watch?v='+encodeURIComponent(x.vid)+'&list='+encodeURIComponent(y.pl));
  else ytOpenMusic(x.vid, x.song);
  mzCronoIniciar(it||x);
  renderMusica();
}
/* ---------- Cronómetro: la siguiente canción sola ----------
   Al abrir una canción se cuenta su duración real (la que da YouTube; si no se sabe, 4 min).
   Cuando se acaba, sale un botón grande con vibración: «▶ Siguiente canción». YouTube Music se
   abre SOLO al tocarlo (abrirlo solo sacaba a ORDEVA y lo reabría una y otra vez). */
const MZ_AUTO_KEY='vito_mzauto',MZ_T_KEY='vito_mzt';
const mzAutoOn=()=>LS(MZ_AUTO_KEY,{on:true}).on!==false;
async function mzCronoIniciar(x){
  if(!mzAutoOn()){SS(MZ_T_KEY,null);return;}
  let dur=x.dur||(x.vid&&ytDurCache[x.vid])||0;
  if(!dur&&x.vid&&yCfg().key){try{const j=await yGet('videos?part=contentDetails&id='+encodeURIComponent(x.vid));const d=ytDur(j.items&&j.items[0]&&j.items[0].contentDetails.duration);if(d){dur=d;ytDurCache[x.vid]=d;}}catch(e){}}
  SS(MZ_T_KEY,{id:x.id,song:x.song,fin:Date.now()+((dur||YT_DUR_DEFECTO)+4)*1000,sabe:!!dur});
  mzCronoPintar();
}
function mzSiguiente(){ const o=ordenJusto(cola()); return o[0]||null; }
async function mzCronoAvanzar(){
  const sig=mzSiguiente();
  if(!sig){SS(MZ_T_KEY,null);mzCronoPintar();return;}
  // Sin video resuelto todavía: se busca antes de abrir (así va directo a la canción).
  if(!sig.vid&&!sig.novid&&yCfg().key){try{const v=await ySearch(sig.song);const l=cola(),it=l.find(y=>y.id===sig.id);if(it){if(v){it.vid=v;if(ytDurCache[v])it.dur=ytDurCache[v];sig.vid=v;sig.dur=it.dur;}else it.novid=true;SS('vito_cola',l);}}catch(e){}}
  SS(MZ_T_KEY,Object.assign({},LS(MZ_T_KEY,{}),{pend:sig.id}));
  // Ya NO se abre YouTube Music solo: eso sacaba a ORDEVA y lo volvía a abrir cada vez que regresabas
  // («la app se cierra y se abre Google»). Ahora se avisa con un botón grande y vibración; se abre al tocarlo.
  mzBotonGrande(sig);
}
function mzBotonGrande(sig){
  if(window.tvConectado&&window.tvConectado())return;   // la música va al TV: no se abre YouTube Music
  let ov=$('mzGoOverlay');
  if(!ov){ov=document.createElement('div');ov.id='mzGoOverlay';ov.className='overlay';
    ov.innerHTML='<div class="modal" style="max-width:380px;text-align:center"><h2>🎵 Siguiente canción</h2><div class="modal-sub" id="mzGoTxt"></div><div class="modal-actions" style="flex-direction:column;gap:8px"><button class="btn-primary" id="mzGoBtn" type="button" style="width:100%;padding:16px;font-size:17px">▶ Ponerla en YouTube Music</button><button class="btn-close" id="mzGoNo" type="button">Ahora no</button></div></div>';
    document.body.appendChild(ov); $('mzGoNo').onclick=()=>ov.classList.remove('show');}
  $('mzGoTxt').textContent='«'+sig.song+'» · '+tableLabel(sig.mesa);
  $('mzGoBtn').onclick=()=>{ov.classList.remove('show');reproducir(sig);};
  $('mzGoNo').onclick=()=>{ov.classList.remove('show');const t=LS(MZ_T_KEY,{});if(t&&t.pend===sig.id){delete t.pend;t.espera=false;t.fin=Date.now()+5*60000;SS(MZ_T_KEY,t);}};
  ov.classList.add('show'); try{navigator.vibrate&&navigator.vibrate([200,100,200]);}catch(e){}
}
function mzCronoPintar(){
  const e=$('mzCrono');if(!e)return;
  const t=LS(MZ_T_KEY,null);
  if(!mzAutoOn()||!t||!t.fin){e.hidden=true;return;}
  const falta=Math.max(0,Math.round((t.fin-Date.now())/1000)),sig=mzSiguiente();
  e.hidden=false;
  e.textContent='⏱️ Suena «'+t.song+'» · '+(falta?'faltan '+Math.floor(falta/60)+':'+String(falta%60).padStart(2,'0'):'terminando')+(t.sabe?'':' (aprox.)')+' · '+(sig?'luego «'+sig.song+'»':'no hay más en la cola');
}
setInterval(()=>{
  const t=LS(MZ_T_KEY,null);
  mzCronoPintar();
  if(!mzAutoOn()||!t||!t.fin||Date.now()<t.fin||t.pend)return;
  if(document.hidden){ if(!t.espera) SS(MZ_T_KEY,Object.assign({},t,{espera:true})); return; }   // se abre apenas vuelvas a ORDEVA
  mzCronoAvanzar();
},1000);
document.addEventListener('visibilitychange',()=>{ const t=LS(MZ_T_KEY,null); if(!document.hidden&&t&&t.espera&&!t.pend&&mzAutoOn()) mzCronoAvanzar(); });
function renderMusica(){
  const L=$('mzList');if(!L||typeof data==='undefined'||!data)return;
  try{mzPlPintar();}catch(e){}
  const o=ordenJusto(cola()),now=LS('vito_now',null);L.textContent='';mzPintarSonando();
  if(now&&!mzActual()){const d=document.createElement('div');d.className='mz-song';d.innerHTML='<span>▶ Última: <b>'+esc(now.song)+'</b> · '+esc(mzEtq(now))+'</span>';L.appendChild(d);}
  // Las que ya se mandaron al TV (o a tu lista de YouTube) y todavía no suenan siguen a la vista.
  const enTV=cola().filter(x=>x.done&&(x.status==='tv'||(x.status==='lista'&&Date.now()-(x.ytAt||0)<3*36e5))).sort((a,b)=>(a.lngN||a.lngAt||a.ytAt||0)-(b.lngN||b.lngAt||b.ytAt||0)).slice(-15);
  if(!o.length&&!enTV.length){const d=document.createElement('div');d.className='empty-note';d.textContent='No hay canciones en cola. Los clientes las piden con el QR de su mesa.';L.appendChild(d);return;}
  if(enTV.length){
    const h=document.createElement('div');h.className='mz-song';h.innerHTML='<span><b>📺 Ya en el TV</b> <small>(suenan en este orden)</small></span>';L.appendChild(h);
    enTV.forEach((x,i)=>{const d=document.createElement('div');d.className='mz-song';
      d.innerHTML='<span>'+(i+1)+'. '+esc(x.song)+' · '+esc(mzEtq(x))+' <small class="mz-est mz-approved">'+(x.status==='tv'?'En la cola del TV':'En tu lista de YouTube')+' · '+new Date(x.ts).toLocaleTimeString('es-CO',{hour:'numeric',minute:'2-digit'})+'</small></span>';
      L.appendChild(d);});
    if(o.length){const h2=document.createElement('div');h2.className='mz-song';h2.innerHTML='<span><b>⏳ Por mandar</b></span>';L.appendChild(h2);}
  }
  o.forEach((x,i)=>{
    const d=document.createElement('div');d.className='mz-song';
    d.innerHTML='<span>'+(i+1)+'. '+esc(x.song)+' · '+esc(mzEtq(x))+' <small class="mz-est mz-'+(x.status||'pending')+'">'+(x.status==='approved'||x.ok?'En cola':'Pendiente')+' · '+new Date(x.ts).toLocaleTimeString('es-CO',{hour:'numeric',minute:'2-digit'})+'</small></span>';
    d.append(btn('▶',()=>reproducir(x)),btn('🗑',()=>{if(mqOtro())mqPub({t:'cmd',a:'quitar',id:x.id});mzTermino(x.id,'cancelled');tvPublicar(true);renderMusica();}));
    L.appendChild(d);
  });
}
// Saltar la que suena (en el TV, en el reproductor de la app o en YouTube Music) y pasar a la siguiente.
function mzSaltar(){
  if(mqOtro()){mqPub({t:'cmd',a:'sig'});showToast('⏭ Siguiente → «'+mqNombre()+'».');return;}
  const x=mzActual();
  if(!x){const o=ordenJusto(cola());if(!o.length)return showToast('No hay canciones en cola.');return reproducir(o[0]);}
  mzTermino(x.id,'skipped');
  if(x.fuente==='tv'){try{fetch('https://canal.vento.local/'+tvTopic(),{method:'POST',body:JSON.stringify({skip:x.id,t:Date.now()})}).catch(()=>{});}catch(e){}tvPublicar(true);}
  else if(x.fuente==='app'&&yPl&&yPl.stopVideo){try{yPl.stopVideo();}catch(e){}sonando=false;siguienteAuto();}
  else if(x.fuente==='tvyt'&&typeof lngSaltar==='function')lngSaltar();
  else if(x.fuente==='cc'&&typeof ccSes!=='undefined'&&ccSes){try{const ms=ccSes.getMediaSession&&ccSes.getMediaSession();if(ms)ms.stop(null,()=>{},()=>{});}catch(e){}}
  else{const o=ordenJusto(cola());if(o.length)reproducir(o[0]);}
  renderMusica();showToast('⏭ Saltada: «'+(x.title||x.song)+'».');
}
function mzVerHistorial(){
  let ov=$('mzHistOv');
  if(!ov){ov=document.createElement('div');ov.id='mzHistOv';ov.className='overlay';
    ov.innerHTML='<div class="modal" style="max-width:520px"><h2>📜 Historial de música</h2><input id="mzHistQ" type="search" placeholder="Buscar canción o mesa" style="width:100%;margin:6px 0"><div id="mzHistL" style="max-height:60vh;overflow:auto"></div><div class="modal-actions"><button class="btn-close" type="button" id="mzHistX">Cerrar</button></div></div>';
    document.body.appendChild(ov);$('mzHistX').onclick=()=>ov.classList.remove('show');$('mzHistQ').oninput=pintar;}
  const NOM={played:'✅ Reproducida',skipped:'⏭ Saltada',cancelled:'🗑 Cancelada',error:'⚠️ Error (no se pudo reproducir)'};
  function pintar(){
    const q=fiAscii($('mzHistQ').value||'').toLowerCase();
    const h=mzHist().slice().reverse().filter(x=>!q||fiAscii((x.title||x.song)+' '+x.artist+' '+x.mesaNombre).toLowerCase().includes(q)).slice(0,300);
    $('mzHistL').innerHTML=h.length?h.map(x=>'<div class="mz-song"><span><b>'+esc(x.title||x.song)+'</b>'+(x.artist?' · '+esc(x.artist):'')+'<br><small>'+esc(x.mesaNombre||tableLabel(x.mesa))+' · '+new Date(x.startedAt||x.requestedAt).toLocaleString('es-CO',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})+' · '+(NOM[x.status]||x.status)+(x.playedSeconds?' · '+mmss(x.playedSeconds)+(x.duration?' / '+mmss(x.duration):''):'')+'</small></span></div>').join(''):'<div class="empty-note">Todavía no hay canciones en el historial.</div>';
  }
  pintar();ov.classList.add('show');
}
function iniMusica(){
  $('mzNext').onclick=()=>{const o=ordenJusto(cola());if(!o.length)return showToast('No hay canciones en cola.');reproducir(o[0]);};
  const ma=$('mzAutoNext');if(ma){ma.checked=mzAutoOn();ma.onchange=()=>{SS(MZ_AUTO_KEY,{on:ma.checked});if(!ma.checked)SS(MZ_T_KEY,null);mzCronoPintar();showToast(ma.checked?'⏱️ Listo: cuando se acabe cada canción pongo la siguiente sola.':'Cronómetro apagado: la siguiente la pones tú.');};}
  $('mzClear').onclick=()=>{if(confirm('¿Vaciar la cola de música?')){cola().filter(x=>!x.done).forEach(x=>mzTermino(x.id,'cancelled'));tvPublicar(true);renderMusica();}};
  $('mzSkip').onclick=mzSaltar;
  $('mzHistBtn').onclick=mzVerHistorial;
  // Si el navegador borró el almacenamiento rápido, la cola y el historial vuelven del respaldo.
  if(!cola().length&&!mzHist().length)mzRecuperar().then(r=>{if(r&&(r.cola||[]).length+(r.hist||[]).length){SS('vito_cola',r.cola||[]);SS(MZ_HIST,r.hist||[]);if(r.now)SS('vito_now',r.now);renderMusica();}});
  document.querySelector('nav button[data-view="musica"]').addEventListener('click',renderMusica);
}

/* ---------- YouTube Music automático (lista de reproducción por API de YouTube) ---------- */
// Client ID de Google del negocio (es público: Google lo muestra en la página de permiso). Se usa si no
// se ha pegado otro en Música → YouTube.
const YT_CID_VENTO='896233860758-56pu0r79ff4ld5buf5a56goqb1892i7r.apps.googleusercontent.com';
// Una vez: si quedó guardado otro Client ID (de pruebas anteriores), se cambia por el del negocio, que
// es el que tiene el Client Secret y la dirección de regreso registrados.
try{const c0=JSON.parse(localStorage.getItem('vito_yt')||'null');if(c0&&c0.cid&&c0.cid!==YT_CID_VENTO&&!c0.cidVento){c0.cid=YT_CID_VENTO;c0.cidVento=1;delete c0.srv;localStorage.setItem('vito_yt',JSON.stringify(c0));}}catch(e){}
// ORDEVA 2.0: sin clave de YouTube escrita en el código (estaba a la vista de todos). La búsqueda va primero por el
// Servidor ORDEVA (vento-ia/yt, sin clave en la página); la clave propia del negocio se pone en Ajustes → Música.
const yCfg=()=>{const c=Object.assign({cid:'',pl:'',len:0,on:false,key:''},LS('vito_yt',{}));if(!c.cid)c.cid=YT_CID_VENTO;return c;};
const yTok=()=>{try{const t=JSON.parse(localStorage.getItem('vito_ytok')||sessionStorage.getItem('vito_ytok'));return t&&t.exp>Date.now()?t.t:null;}catch(e){return null;}};
let yTC=null,cadena=Promise.resolve();
/* Con qué cuenta de Google quedó conectada la app. Importa porque la lista se crea en
   ESA cuenta: si el TV está con otra, la lista no le aparece y parece que «no agrega
   los videos». Se pregunta el nombre del canal, que es lo que identifica la cuenta. */
async function yQuien(){
  if(!yTok()) return;
  try{
    const j = await yApi('channels?part=snippet&mine=true');
    const it = (j && j.items || [])[0];
    const n = it && it.snippet && it.snippet.title;
    if(n){ const c = yCfg(); if(c.who !== n){ c.who = n; SS('vito_yt', c); } yEstado(); }
  }catch(e){}
}
function yEstado(){
  const e=$('ytEstado'),c=yCfg();
  const n=cola().filter(x=>!x.done&&!x.yt&&!x.vid).length,p=n?' ('+n+' canciones sin buscar)':'';
  if(e)e.textContent=(c.key?'🟢 Búsqueda lista (API key)':'⚪ Sin API key')+' · '+(yTok()?('🟢 Google conectado'+(c.srv&&ySrv()?' (se renueva sola 🔄)':'')+(c.who?' como «'+c.who+'» (el TV debe estar con esta misma cuenta)':'')+': se copian solas a tu lista de YouTube Music'):(c.cid?(c.on?'🟠 Google desconectado (la conexión dura 1 hora): toca «Reconectar» arriba o «Conectar con Google»':'🟠 Google desconectado: toca «Conectar con Google» para la lista de YouTube Music'):'⚪ Lista de YouTube Music sin configurar'))+p+'.';
  const a=$('autoEstado');if(a)a.textContent=AUTO()?((c.key||yTok())?'🟢 Activo: suena solo y las nuevas entran solas.':'🟠 Falta la API key para buscar las canciones.'):'⚪ Apagado.';
}
async function yApi(path,opt){
  const r=await fetch('https://www.googleapis.com/youtube/v3/'+path,Object.assign({headers:{Authorization:'Bearer '+yTok(),'Content-Type':'application/json'}},opt));
  if(!r.ok){const j=await r.json().catch(()=>({}));throw new Error((j.error&&j.error.message)||('Error '+r.status));}
  return r.json();
}
async function yLista(){
  const c=yCfg();if(c.pl)return c.pl;
  const j=await yApi('playlists?part=snippet,status',{method:'POST',body:JSON.stringify({snippet:{title:'Música '+(data.businessName||'del local')},status:{privacyStatus:'private'}})});
  c.pl=j.id;c.len=0;SS('vito_yt',c);$('ytPl').value=c.pl;return c.pl;
}
function ytAgregar(id){cadena=cadena.then(()=>ytUno(id)).catch(()=>{});}
// Solo versiones que se pueden poner en un reproductor fuera de youtube.com:
// 1) la búsqueda pide videos "embeddable" y "syndicated";
// 2) se revisa cada candidato con la API (público, se deja insertar, sin +18, no bloqueado en
//    Colombia) y se dejan al final los canales oficiales de sellos que suelen bloquear (VEVO,
//    Warner/WMG, "- Topic");
// 3) los que igual fallaron alguna vez en el reproductor quedan en una lista negra y no se
//    vuelven a elegir. excluir: ids ya probados para esta canción.
const YT_BAD_KEY='vito_yt_bad', YT_REGION=((navigator.language||'').split('-')[1]||'CO').toUpperCase();
const ytBad=()=>LS(YT_BAD_KEY,[]);
// La lista negra vieja tenía canciones buenas marcadas por error (cuando YouTube pasaba comerciales): se limpia una vez.
try{if(!LS('vito_yt_bad_v2',0)){SS(YT_BAD_KEY,[]);SS('vito_yt_bad_v2',1);}}catch(e){}
function ytMarcarBad(v){ if(!v)return; const b=ytBad(); if(!b.includes(v)){ b.push(v); SS(YT_BAD_KEY,b.slice(-400)); } }
const SELLO_RE=/vevo|\s-\stopic$|warner|wmg|atlantic|elektra|parlophone|reprise|rhino|asylum|nonesuch|sire records/i;
/* Buscar en YouTube, con respaldos. Antes, si la clave compartida se quedaba sin cupo del día
   (la usan todos los locales), la búsqueda fallaba y NINGUNA canción llegaba al TV. Ahora:
   1) la clave; 2) la cuenta de YouTube conectada (su propio cupo); 3) búsqueda libre sin clave. */
let yFuente='';           // con qué se encontró la última canción
window.ytFallo=null;      // último problema buscando (se muestra en Música)
const Y_LIBRES=['https://pipedapi.kavin.rocks','https://inv.nadeko.net','https://invidious.nerdvpn.de','https://yewtu.be'];
async function yLibre(u){
  const q=(u.match(/[?&]q=([^&]*)/)||[])[1];if(!q)return undefined;
  for(const base of Y_LIBRES){
    const ctrl=new AbortController(),tm=setTimeout(()=>ctrl.abort(),4500);
    try{
      const piped=/piped/.test(base);
      const r=await fetch(base+(piped?'/search?filter=videos&q=':'/api/v1/search?type=video&q=')+q,{signal:ctrl.signal});
      if(!r.ok)continue;
      const j=await r.json();
      const items=(piped?(j.items||[]).map(x=>({v:(String(x.url||'').match(/v=([\w-]{11})/)||[])[1],t:x.title,c:x.uploaderName})):(Array.isArray(j)?j:[]).map(x=>({v:x.videoId,t:x.title,c:x.author}))).filter(x=>x.v);
      if(items.length)return {items:items.map(x=>({id:{videoId:x.v},snippet:{title:x.t||'',channelTitle:x.c||''}})),_libre:true};
    }catch(e){}finally{clearTimeout(tm);}
  }
  return undefined;
}
// Dentro de la app de Android: búsqueda propia en la página pública de YouTube (no gasta el cupo de la clave
// compartida, que se agota con ~100 canciones al día entre todos los locales y dejaba canciones sin sonar).
function yBuscarApp(q){
  return new Promise(res=>{
    if(!(window.VentoAndroid&&typeof window.VentoAndroid.buscarYT==='function'))return res(undefined);
    const id='y'+Date.now()+Math.random().toString(36).slice(2,6);
    window.__ventoCbs=window.__ventoCbs||{};
    const tmo=setTimeout(()=>{delete window.__ventoCbs[id];res(undefined);},12000);
    window.__ventoCbs[id]=d=>{clearTimeout(tmo);let arr=[];try{arr=JSON.parse(String((d&&d.text)||'[]'));}catch(e){}
      if(!Array.isArray(arr)||!arr.length)return res(undefined);
      arr.forEach(x=>{const p=String(x.d||'').split(':').map(Number);if(x.v&&p.length>1&&p.every(n=>!isNaN(n))){const sg=p.reduce((t,n)=>t*60+n,0);if(sg>0)ytDurCache[x.v]=sg;}});
      res({items:arr.filter(x=>x&&x.v).map(x=>({id:{videoId:x.v},snippet:{title:x.t||'',channelTitle:x.c||''}})),_app:true});};
    try{window.VentoAndroid.buscarYT(id,decodeURIComponent(q));}catch(e){clearTimeout(tmo);delete window.__ventoCbs[id];res(undefined);}
  });
}
// Búsqueda SIN cupo desde el Servidor ORDEVA (vento-ia/yt/buscar lee la página pública de resultados de YouTube).
// La API de YouTube da 10.000 unidades al día y cada búsqueda cuesta 100: así ya no aparece «se alcanzó el límite».
async function ySrvBuscar(qEnc){
  const b=typeof iaVentoBase==='function'?iaVentoBase():'';if(!b)return undefined;
  const ctrl=new AbortController(),tm=setTimeout(()=>ctrl.abort(),8000);
  try{
    const r=await fetch(b+'/yt/buscar?tipo=video&q='+qEnc,{signal:ctrl.signal});if(!r.ok)return undefined;
    const j=await r.json();if(!j||!Array.isArray(j.items)||!j.items.length)return undefined;
    j.items.forEach(x=>{if(x&&x.id&&x.id.videoId&&x.duracion>0)ytDurCache[x.id.videoId]=x.duracion;});
    return {items:j.items,_srv:true};
  }catch(e){return undefined;}finally{clearTimeout(tm);}
}
async function yGet(u){
  const c=yCfg();let err=null;
  if(/^search\?/.test(u)&&window.VentoAndroid&&typeof window.VentoAndroid.buscarYT==='function'){
    const q=(u.match(/[?&]q=([^&]*)/)||[])[1];
    if(q){const j=await yBuscarApp(q);if(j){yFuente='app';window.ytFallo=null;return j;}}
  }
  if(/^search\?/.test(u)){
    const q=(u.match(/[?&]q=([^&]*)/)||[])[1];
    if(q){const j=await ySrvBuscar(q);if(j){yFuente='servidor';window.ytFallo=null;return j;}}
  }
  if(c.key){
    try{const r=await fetch('https://www.googleapis.com/youtube/v3/'+u+'&key='+encodeURIComponent(c.key));const j=await r.json();
      if(r.ok){yFuente='clave';window.ytFallo=null;return j;}
      err=new Error((j.error&&j.error.message)||('Error '+r.status));}
    catch(e){err=e;}
  }
  if(yTok()){
    try{const j=await yApi(u);yFuente='cuenta';window.ytFallo=null;return j;}catch(e){err=err||e;}
  }
  if(/^search\?/.test(u)){
    const j=await yLibre(u);
    if(j){yFuente='libre';window.ytFallo=null;return j;}
  }
  if(err){
    window.ytFallo=/quota/i.test(err.message)?'YouTube no respondió la búsqueda (sin internet o el Servidor ORDEVA no contesta). Se reintenta sola.':'No pude buscar la canción en YouTube: '+err.message;
    throw err;
  }
  return undefined;
}
// Duración real de cada video (PT3M42S -> segundos). Se guarda en la propia canción de la
// cola (x.dur), así el TV sabe cuándo de verdad va a terminar en vez de calcular a ojo.
function ytDur(iso){
  const m=/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso||'');
  if(!m)return null;
  return (parseInt(m[1]||0,10)*3600)+(parseInt(m[2]||0,10)*60)+parseInt(m[3]||0,10);
}
const ytDurCache={};
// Cuando piden varias canciones casi seguidas mientras suena una sola, cada una se insertaba
// en la posición 1 (justo después de la que suena) — eso hacía que la ÚLTIMA pedida terminara
// sonando primero y las demás quedaran atrás, al revés del orden en que las pidieron. Ahora se
// lleva una posición que solo AVANZA mientras dure la "tanda" (usando la duración real de cada
// canción, cuando se sabe, o ~4 min si no) y se reinicia sola a 1 en cuanto ya pasó tiempo de
// sobra para que lo de antes haya sonado — así entran en orden, una detrás de otra.
const YT_DUR_DEFECTO=240;
let ytTanda={n:0,libreDesde:0};
function ytPosicionSiguiente(durSeg){
  const ahora=Date.now();
  if(ahora>=ytTanda.libreDesde){ytTanda.n=0;ytTanda.libreDesde=ahora;}
  ytTanda.n++;
  ytTanda.libreDesde+=(durSeg||YT_DUR_DEFECTO)*1000;
  return ytTanda.n;
}
async function ySearch(q,excluir){
  const j=await yGet('search?part=snippet&type=video&videoCategoryId=10&videoEmbeddable=true&videoSyndicated=true&maxResults=10&q='+encodeURIComponent(q));
  if(j===undefined)return undefined;
  const no=new Set([...(excluir||[]),...ytBad()]);
  let cands=(j.items||[]).filter(x=>x&&x.id&&x.id.videoId&&!no.has(x.id.videoId)).map(x=>({v:x.id.videoId,canal:(x.snippet&&x.snippet.channelTitle)||''}));
  if(!cands.length)return null;
  try{
    const d=await yGet('videos?part=status,contentDetails&id='+cands.map(x=>x.v).join(','));
    const ok={};
    ((d&&d.items)||[]).forEach(v=>{
      const st=v.status||{},cd=v.contentDetails||{},rr=cd.regionRestriction||{};
      const bloqReg=(rr.blocked&&rr.blocked.includes(YT_REGION))||(rr.allowed&&!rr.allowed.includes(YT_REGION));
      const edad=cd.contentRating&&cd.contentRating.ytRating==='ytAgeRestricted';
      ok[v.id]=st.embeddable!==false&&st.privacyStatus==='public'&&!bloqReg&&!edad;
      const dur=ytDur(cd.duration);if(dur)ytDurCache[v.id]=dur;
    });
    // Solo se descartan las que YouTube dice que NO se pueden poner. Una respuesta vacía (cupo, clave sin permiso…) no es
    // un «no»: antes así se perdía la canción de la mesa («No encontré una versión…»); el probador de la app igual la revisa.
    if(d&&d.items&&d.items.length)cands=cands.filter(x=>ok[x.v]!==false&&(x.v in ok));
  }catch(e){}
  cands.sort((a,b)=>SELLO_RE.test(a.canal)-SELLO_RE.test(b.canal));
  if(cands.length)window.ytFallo=null;   // la canción sí se encontró (aunque el chequeo extra haya fallado)
  return cands.length?cands[0].v:null;
}
async function ytUno(id){
  if(mqOtro())return;                                  // la busca y la pone el equipo de la música
  try{
    let l=cola(),it=l.find(x=>x.id===id);if(!it||it.done)return;
    if(!it.vid&&!it.novid){
      const v=await ySearch(it.song,it.probados);
      l=cola();it=l.find(x=>x.id===id);if(!it||v===undefined)return;
      if(v){it.vid=v;it.ok=false;if(ytDurCache[v])it.dur=ytDurCache[v];}else{it.novid=true;it.yt='no';it.status='error';it.done=true;it.endedAt=Date.now();try{mzAlHistorial(it);}catch(e){}showToast('⚠️ No encontré una versión de «'+it.song+'» que se pueda reproducir aquí.');try{window.ventoError&&window.ventoError('musica','No se encontró ninguna versión que se pueda reproducir',{cancion:String(it.song).slice(0,80),fuente:yFuente||''},'musica|sin-version');}catch(e){}}
      SS('vito_cola',l);
      tvPublicar();
      if(v)setTimeout(()=>{try{verificarCola();}catch(e){}},50);   // se comprueba y, si no hay música, suena ya
    }
    // Sin acceso a Google justo ahora: si el Servidor ORDEVA tiene la conexión, se renueva sola y la canción
    // entra enseguida (sin aviso). Solo si de verdad falta algo se avisa, una vez cada 10 min, con el motivo.
    if(it.vid&&!it.yt&&!yTok()&&!tvOn()&&typeof castOn==='function'&&castOn()&&yCfg().cid){
      if(ySrv()&&yCfg().srv){const idR=it.id;yRenovarServidor(true).then(ok=>{if(ok)ytAgregar(idR);});return;}
      if(!window.ytAvisoDesc||Date.now()-window.ytAvisoDesc>600000){window.ytAvisoDesc=Date.now();yAvisoReconectar();const e=$('ytRecon');showToast('⚠️ «'+it.song+'» todavía no entró a la lista del TV: '+(e&&!e.hidden?e.querySelector('span').textContent.replace(/^🟠\s*/,''):'falta conectar Google en Música.'),9000);}
    }
    // Si el reproductor de ESTA app es el que pone la música, no se copia a la lista de YouTube Music: quedaba marcada
    // «en tu lista» y el reproductor de la app ya no la tocaba (con Google conectado, la cola se «gastaba» sin sonar).
    // Ya se renovó el cupo y el reproductor lo había prendido ORDEVA por eso: se vuelve a la lista de YouTube Music.
    if(!ySinCupo()&&LS('vito_auto_por_cupo',0)&&AUTO()&&!sonando){SS('vito_auto_play',{on:false});SS('vito_auto_por_cupo',0);try{const a=$('autoPlay');if(a)a.checked=false;}catch(e){}}
    if(!it.vid||it.yt||!yTok()||tvOn()||(typeof lngOn==='function'&&lngOn())||AUTO()||ySinCupo())return;
    const pl=await yLista();
    // position:1 (no position:0) pone la canción nueva JUSTO DESPUÉS de la
    // que ya está sonando — la posición 0 de la lista es la que YouTube
    // Music tiene cargada como actual, así que insertar ahí la empuja a la
    // posición 1 y hace que "la próxima" termine siendo la MISMA canción
    // que ya sonó (se repite) en vez de la nueva. Insertando en 1 la actual
    // queda intacta en 0 y la nueva pedida sí queda como la siguiente real.
    // Si llegan varias seguidas mientras suena una sola canción, ytPosicionSiguiente
    // les da posiciones 1, 2, 3... (no siempre 1), para que queden EN EL ORDEN en que
    // se pidieron y no al revés; se reinicia sola cuando, según la duración real de
    // las canciones ya puestas, ya debieron sonar.
    // Transmitiendo al TV con la app de YouTube, la lista se reproduce de principio a fin:
    // las canciones nuevas van al FINAL (en el orden en que las pidieron) para no saltar
    // una que ya sonó.
    const sn={playlistId:pl,resourceId:{kind:'youtube#video',videoId:it.vid}};
    if(!(typeof castOn==='function'&&castOn()))sn.position=ytPosicionSiguiente(it.dur);
    const r=await yApi('playlistItems?part=snippet',{method:'POST',body:JSON.stringify({snippet:sn})});
    l=cola();it=l.find(x=>x.id===id);if(it){it.yt=true;it.done=true;it.ytAt=Date.now();it.ytItemId=r&&r.id;if(['pending','approved'].includes(it.status||'pending'))it.status='lista';SS('vito_cola',l);}
    try{if(typeof castEstado==='function')castEstado();}catch(e){}
    const c=yCfg();c.len++;SS('vito_yt',c);
  }catch(e){
    // Agregar a la lista de YouTube Music con la cuenta conectada SÍ usa el cupo diario de Google (50 de 10.000 por canción):
    // se explica claro y se ofrece el camino que no tiene cupo («Vincular con código de TV»: va directo al TV).
    const sinCupo=/quota|exceeded/i.test(String(e&&e.message));
    if(sinCupo){ ySinLimite(); yEstado(); return; }
    if(!window.ytAvisoT||Date.now()-window.ytAvisoT>600000){ window.ytAvisoT=Date.now();
      showToast('YouTube: '+(window.ytFallo||e.message),8000); }
  }
  yEstado();
}
/* ---------- Música SIN el límite de YouTube ----------
   Meter cada canción en la lista de YouTube Music gasta el cupo diario de Google (50 de 10.000 unidades por canción,
   compartido por todos los negocios que usan ORDEVA): al acabarse, las canciones del QR se quedaban sin entrar.
   Ahora la música NUNCA se detiene por eso: ORDEVA deja de usar ese cupo hasta que Google lo renueve (medianoche de
   California) y sigue poniendo las canciones por un camino sin límite: el TV vinculado con su código, o el
   reproductor de ORDEVA (que también suena con la app en segundo plano). */
const YSC_KEY='vito_yt_sincupo';
const ySinCupo=()=>Number(LS(YSC_KEY,0)||0)>Date.now();
function ySinLimite(){
  const d=new Date(),fin=Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate(),8,0,0)+(d.getUTCHours()>=8?864e5:0);   // ~00:00 en California
  const yaEstaba=ySinCupo();
  SS(YSC_KEY,fin);
  // Las canciones que no alcanzaron a entrar a la lista siguen en la cola (no se pierde ninguna).
  const tv=(typeof lngOn==='function'&&lngOn())||(window.tvConectado&&window.tvConectado());
  if(!tv&&!AUTO()){
    SS('vito_auto_play',{on:true});SS('vito_auto_por_cupo',1);   // lo prendió ORDEVA: al renovarse el cupo se vuelve a la lista
    try{const a=$('autoPlay');if(a)a.checked=true;const b=$('ytBox');if(b)b.hidden=false;}catch(e){}
    try{cargarAPI();}catch(e){}
  }
  try{siguienteAuto();}catch(e){} try{tvPublicar(true);}catch(e){} try{renderMusica();}catch(e){}
  if(!yaEstaba)showToast('🎵 La lista de YouTube Music llegó al tope de Google por hoy, pero la música NO se detiene: '+(tv?'las canciones siguen yendo directo al TV.':'sigo poniéndolas con el reproductor de ORDEVA, sin límite.')+' Mañana vuelve a usar tu lista sola.',12000);
}
window.vitoSinLimite={activo:ySinCupo,activar:ySinLimite};
function yPendientes(silencio){
  const o=ordenJusto(cola().filter(x=>!x.yt));
  if(!o.length){if(!silencio)showToast('No hay canciones nuevas por cargar.');return;}
  o.forEach(x=>ytAgregar(x.id));
  if(!silencio)cadena=cadena.then(()=>{showToast('✅ Listo: se procesaron '+o.length+' canciones en tu lista de YouTube Music.');renderMusica();});
  else cadena=cadena.then(()=>{try{renderMusica();}catch(e){}});
}
function cargarLista(){
  if(!yCfg().cid){showToast('Primero pega tu Client ID de Google (más abajo).');return;}
  if(!yTok())yConectar(false);else yPendientes();
}
/* ---------- Conexión con Google que NO se vence (Servidor ORDEVA) ----------
   Con el flujo de «código de autorización» de Google, el servidor guarda (cifrado) el refresh token y
   entrega un acceso nuevo cada vez que hace falta: la app se reconecta sola, sin ventanas ni botón. */
const yGuardarTok=(t,exp)=>{const v=JSON.stringify({t:t,exp:Date.now()+(Math.max(300,exp||3599)-120)*1000});try{localStorage.setItem('vito_ytok',v);}catch(e){try{sessionStorage.setItem('vito_ytok',v);}catch(e2){}}};
const yTokExp=()=>{try{const t=JSON.parse(localStorage.getItem('vito_ytok')||sessionStorage.getItem('vito_ytok'));return t&&t.exp||0;}catch(e){return 0;}};
const ySrv=()=>!!(window.ventoGoogle&&window.ventoGoogle.disponible());
const yEnApp=()=>{try{return matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;}catch(e){return false;}};
// Dirección de regreso: la carpeta de ORDEVA (…/ORDEVA/), igual a la registrada en Google Cloud,
// aunque ORDEVA se haya abierto como …/ORDEVA/index.html.
const yRedir=()=>location.origin+location.pathname.replace(/index\.html$/,'');
let yRenovando=null,yFalloSrv=0,yFalloMsg='';
function yRenovarServidor(forzar){
  const c=yCfg();
  if(!ySrv()||!c.srv)return Promise.resolve(false);
  if(!forzar&&yTok()&&yTokExp()-Date.now()>6*60000)return Promise.resolve(true);   // todavía le quedan más de 6 min
  if(yRenovando)return yRenovando;
  yRenovando=window.ventoGoogle.token().then(j=>{yGuardarTok(j.access_token,j.expires_in);yFalloSrv=0;const x=yCfg();x.on=true;SS('vito_yt',x);yEstado();yAvisoReconectar();return true;})
    .catch(e=>{yFalloSrv=Date.now();yFalloMsg=(e&&e.message)||'';if(e&&(e.codigo==='google_revocado'||e.codigo==='google_no_conectado')){const x=yCfg();x.srv=false;SS('vito_yt',x);}yEstado();yAvisoReconectar();return false;})
    .then(r=>{yRenovando=null;return r;});
  return yRenovando;
}
/* Conectar con Google UNA vez: la página va a Google y Google la devuelve a ORDEVA con un código
   (flujo oficial OAuth 2.0 para aplicaciones web, con redirección). Antes se usaba una ventanita
   (popup): en Brave, en la app instalada y en varios celulares esa ventanita se abre como pestaña
   aparte y, al tocar «Continuar», Google no logra devolverle el código a ORDEVA — se quedaba quieto.
   access_type=offline + prompt=consent: Google entrega SIEMPRE la llave de renovación (aunque ya
   se hubiera dado permiso antes); el Servidor ORDEVA la guarda cifrada y desde ahí se renueva sola. */
const YT_GUARDA='vito_ytvuelta';
// El Client Secret solo va en sessionStorage (dura lo que la pestaña y sobrevive al ir y volver de
// Google); la copia de respaldo en localStorage NO lo lleva. Se borra apenas termina.
function yGuardaVuelta(v){
  try{v?sessionStorage.setItem(YT_GUARDA,JSON.stringify(v)):sessionStorage.removeItem(YT_GUARDA);}catch(e){}
  try{if(v){const w=Object.assign({},v);delete w.secret;localStorage.setItem(YT_GUARDA,JSON.stringify(w));}else localStorage.removeItem(YT_GUARDA);}catch(e){}
}
function yLeeVuelta(){for(const st of [sessionStorage,localStorage]){try{const v=JSON.parse(st.getItem(YT_GUARDA)||'null');if(v&&Date.now()-v.at<20*60000)return v;}catch(e){}}return null;}
/* La conexión de siempre (acceso de 1 hora), por redirección: Google se abre en la misma pestaña y
   devuelve a ORDEVA (sin ventanita, funciona en Brave y en la app instalada). NO necesita Client Secret.
   Es la que se usa si la conexión permanente todavía no está o el Client Secret no sirvió: así
   «Conectar con Google» SIEMPRE conecta. */
function yConectarHora(aviso){
  const c=yCfg();
  const nonce=(window.VentoAndroid?'app':'')+Array.from(crypto.getRandomValues(new Uint8Array(12)),b=>b.toString(16).padStart(2,'0')).join('');   // «app…»: Google vuelve al navegador y de ahí a la app
  yGuardaVuelta({nonce,cid:c.cid,redir:yRedir(),at:Date.now(),hora:true});
  const q=new URLSearchParams({client_id:c.cid,redirect_uri:yRedir(),response_type:'token',scope:'https://www.googleapis.com/auth/youtube',include_granted_scopes:'true',state:'vento-yt.'+nonce});
  showToast(aviso||'Abriendo Google… elige tu cuenta y toca «Continuar». ORDEVA vuelve sola.',6000);
  setTimeout(()=>{location.href='https://accounts.google.com/o/oauth2/v2/auth?'+q.toString();},aviso?2500:300);
}
window.ytConectarHora=yConectarHora;   // también para pruebas
async function yConectarConCodigo(silencio,listo){
  const c=yCfg();
  const secret=(($('ytSecret')&&$('ytSecret').value)||'').replace(/\s+/g,'');
  // Revisión antes de ir a Google: el error más común es pegar el Client ID (o un pedazo) en el campo del secret.
  if(secret&&(/apps\.googleusercontent\.com$/.test(secret)||/^\d{6,}-/.test(secret))){if($('ytSecret'))$('ytSecret').value='';yConectarHora('ℹ️ Eso que pegaste es el Client ID, no el Client Secret (empieza por «GOCSPX-»). Te conecto igual con Google.');listo();return;}
  // Sin Client Secret, solo se puede seguir si el servidor ya lo tiene guardado (de una conexión anterior).
  if(!secret){
    let est=null;try{est=await window.ventoGoogle.estado();}catch(e){}
    if(!(est&&est.client_id===c.cid)){yConectarHora();listo();return;}   // sin Client Secret: conecta igual (la de siempre)
  }
  const nonce=(window.VentoAndroid?'app':'')+Array.from(crypto.getRandomValues(new Uint8Array(12)),b=>b.toString(16).padStart(2,'0')).join('');   // «app…»: Google vuelve al navegador y de ahí a la app
  yGuardaVuelta({nonce,secret,cid:c.cid,redir:yRedir(),at:Date.now()});
  const q=new URLSearchParams({client_id:c.cid,redirect_uri:yRedir(),response_type:'code',scope:'https://www.googleapis.com/auth/youtube',
    access_type:'offline',prompt:'consent',include_granted_scopes:'true',state:'vento-yt.'+nonce});
  showToast('Abriendo Google… elige tu cuenta y toca «Continuar». ORDEVA vuelve sola.',6000);
  setTimeout(()=>{location.href='https://accounts.google.com/o/oauth2/v2/auth?'+q.toString();},300);
}
// Regreso de Google sin ORDEVA Nube (#access_token=…&state=vento-yt.<nonce>): acceso de 1 hora.
(function(){
  try{
    const h=new URLSearchParams((location.hash||'').replace(/^#/,''));
    if(!/^vento-yt\./.test(h.get('state')||'')||!(h.get('access_token')||h.get('error')))return;
    const v=yLeeVuelta();history.replaceState(null,'',location.pathname+location.search);
    const avisar=t=>{const f=()=>{try{showToast(t,8000);}catch(e){setTimeout(f,800);}};setTimeout(f,1500);};
    if(!v||h.get('state')!=='vento-yt.'+v.nonce||!h.get('access_token')){yGuardaVuelta(null);avisar(h.get('error')?'Google: '+h.get('error'):'⚠️ La respuesta de Google no corresponde a esta conexión.');return;}
    yGuardaVuelta(null);yGuardarTok(h.get('access_token'),Number(h.get('expires_in'))||3599);
    const c=yCfg();c.on=true;SS('vito_yt',c);
    avisar('🟢 Google conectado.');
    setTimeout(()=>{try{yEstado();yAvisoReconectar();yQuien();yPendientes(true);}catch(e){}},2000);
  }catch(e){}
})();
// Regreso de Google (?code=…&state=vento-yt.<nonce>): se canjea el código en el Servidor ORDEVA.
(function(){
  try{
    const q=new URLSearchParams(location.search),st=q.get('state')||'';
    if(!/^vento-yt\b/.test(st)||!(q.get('code')||q.get('error')))return;
    const code=q.get('code'),err=q.get('error'),v=yLeeVuelta();
    history.replaceState(null,'',location.pathname+location.hash);
    const avisar=(t,ms)=>{const f=()=>{try{showToast(t,ms||9000);}catch(e){setTimeout(f,800);}};setTimeout(f,1500);};
    if(err){yGuardaVuelta(null);avisar(err==='access_denied'?'Google: cancelaste el permiso. Toca «Conectar con Google» para intentarlo de nuevo.':'Google: '+err);return;}
    if(!v||st!=='vento-yt.'+v.nonce){avisar('⚠️ La respuesta de Google no corresponde a esta conexión. Toca «Conectar con Google» otra vez.');return;}
    avisar('⏳ Terminando la conexión con Google…',5000);
    // ORDEVA Nube tarda unos segundos en estar lista después de abrir la app: se espera hasta 90 s.
    let n=0;const t=setInterval(()=>{
      if(!ySrv()){if(++n>180){clearInterval(t);avisar('⚠️ No pude terminar la conexión con Google: entra a Ajustes → YouTube y toca «Conectar con Google» otra vez.');}return;}
      clearInterval(t);
      window.ventoGoogle.canjear(code,v.cid,v.secret||'',v.redir).then(async j=>{
        yGuardaVuelta(null);
        const c=yCfg();yGuardarTok(j.access_token,j.expires_in);c.on=true;c.srv=true;if(v.cid&&!c.cid)c.cid=v.cid;SS('vito_yt',c);
        avisar('🟢 Google conectado para siempre: se renueva solo, ya no te vuelve a pedir autorización.',8000);
        try{yEstado();yAvisoReconectar();await yQuien();const w=yCfg().who;if(w)window.ventoGoogle.cuenta(w);yPendientes(true);}catch(e){}
      }).catch(e=>{yGuardaVuelta(null);
        if(e&&(e.codigo==='google_cliente'||e.codigo==='google_secret'||e.codigo==='google_sin_refresh'||e.codigo==='google_redirect')){
          // La conexión permanente no se pudo (Client Secret o configuración de Google): se conecta igual
          // con la de siempre para que la música funcione YA.
          try{const x=yCfg();delete x.srv;SS('vito_yt',x);}catch(z){}
          setTimeout(()=>{try{yConectarHora('ℹ️ La conexión permanente no se pudo ('+(e.codigo==='google_cliente'?'Google no aceptó el Client Secret':e.message)+'). Te conecto igual con Google, como antes.');}catch(z){}},1500);
        }
        else avisar('Google: '+(e.message||e),12000);
        try{yEstado();yAvisoReconectar();const i=$('ytSecret');if(i&&e&&e.codigo==='google_cliente')i.value='';}catch(x){}});
    },500);
  }catch(e){}
})();
function yConectar(silencio,cb){
  // cb (opcional) avisa cuando el intento terminó (con o sin éxito), para que
  // quien llamó (ej. el botón "Conectar mi cuenta de YouTube" en YouTube del
  // TV) pueda refrescar su propio estado en pantalla apenas se sepa el
  // resultado, en vez de adivinar con un tiempo fijo.
  const listo=()=>{ if(typeof cb==='function'){ try{cb();}catch(e){} } };
  const c=yCfg();
  if(!c.cid){if(!silencio)showToast('Pega primero tu Client ID de Google.');listo();return;}
  // Con el Servidor ORDEVA: primero se intenta renovar sola (sin ventanas); si el servidor aún no tiene la
  // conexión guardada y la persona tocó el botón, se hace el flujo de código una sola vez.
  if(ySrv()&&c.srv){yRenovarServidor(true).then(ok=>{if(ok){yPendientes(silencio);listo();}else if(!silencio)yConectarConCodigo(silencio,listo);else listo();});return;}
  // Con el Servidor ORDEVA la conexión es por redirección (no necesita la librería ni ventanitas de Google).
  if(ySrv()&&!silencio&&(location.protocol==='https:'||location.hostname==='localhost')){yConectarConCodigo(silencio,listo);return;}
  // Google bloquea el inicio de sesión ("Error 400: invalid_request ... no
  // cumple la política de OAuth 2.0") cuando la app se abre como archivo
  // (file://) o desde una dirección http sin candado. Se avisa antes de
  // intentarlo, con la dirección exacta que hay que registrar.
  const segura = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if(!segura){
    if(!silencio) showToast('⚠️ Google no deja conectar desde aquí: la app está abierta como ' + (location.protocol === 'file:' ? 'archivo del teléfono/PC' : 'dirección sin https') + '. Ábrela desde tu dirección https (por ejemplo tu página de GitHub Pages) y registra esa dirección en Google Cloud → Credenciales → Orígenes de JavaScript autorizados.', 9000);
    listo();return;
  }
  if(ySrv()&&!silencio){yConectarConCodigo(silencio,listo);return;}
  // El Servidor ORDEVA todavía se está comprobando (recién abierta la app): se espera un momento en vez
  // de caer en la conexión de 1 hora.
  if(!silencio&&!ySrv()&&window.ventoGoogle&&window.ventoGoogle.motivo&&window.ventoGoogle.motivo()==='comprobando'&&!(cb&&cb.esperado>=10)){
    showToast('⏳ Un momento, conectando con el Servidor ORDEVA…',2500);const cb2=()=>listo();cb2.esperado=((cb&&cb.esperado)||0)+1;
    setTimeout(()=>yConectar(false,cb2),1000);return;
  }
  if(!silencio&&!ySrv()){yConectarHora();listo();return;}   // sin ORDEVA Nube: la de siempre (1 hora), por redirección
  if(!window.google||!google.accounts){if(!silencio)showToast('No cargó Google. Revisa el internet.');listo();return;}
  yTC=yTC||google.accounts.oauth2.initTokenClient({client_id:c.cid,scope:'https://www.googleapis.com/auth/youtube',
    error_callback:e=>{const t=e&&e.type;if(!yTC||!yTC.silencio){if(t==='popup_failed_to_open')showToast('El celular bloqueó la ventana de Google. Toca «Reconectar» y acepta.'+(yEnApp()?' Si ORDEVA está instalada como app y no vuelve, conéctate a ORDEVA Nube: así se reconecta sola.':''),9000);else if(t!=='popup_closed')showToast('Google: '+(t||'no se pudo conectar'));}yAvisoReconectar();listo();},
    callback:async r=>{
    if(r.error){if(!yTC.silencio)showToast('Google: '+r.error);yAvisoReconectar();listo();return;}
    try{localStorage.setItem('vito_ytok',JSON.stringify({t:r.access_token,exp:Date.now()+(r.expires_in-120)*1000}));}catch(e){sessionStorage.setItem('vito_ytok',JSON.stringify({t:r.access_token,exp:Date.now()+(r.expires_in-120)*1000}));}
    const x=yCfg();x.on=true;SS('vito_yt',x);yEstado();yAvisoReconectar();await yQuien();yPendientes(yTC.silencio);listo();}});
  yTC.silencio=!!silencio;
  yTC.requestAccessToken({prompt:silencio?'none':''});
}
function iniYT(){
  const c=yCfg();$('ytKey').value=c.key||'';$('ytCid').value=c.cid;$('ytPl').value=c.pl;
  const g=(k,v)=>{const x=yCfg();x[k]=v;SS('vito_yt',x);yEstado();};
  $('ytCid').oninput=e=>{g('cid',e.target.value.trim());yTC=null;};
  $('ytPl').oninput=e=>{g('pl',e.target.value.trim());g('len',0);};
  $('ytKey').oninput=e=>{g('key',e.target.value.trim());};$('ytConn').onclick=()=>yConectar(false);$('mzLoad').onclick=cargarLista;$('mzOpenYT').onclick=()=>$('ytOpen').click();
  $('ytOpen').onclick=()=>{const x=yCfg();if(!x.pl)return showToast('Todavía no hay lista: se crea con la primera canción.');ytOpenMusicPath('playlist?list='+encodeURIComponent(x.pl));};
  // Respaldo: por si una canción no se resolvió sola al llegar (sin internet un
  // instante, o la API key se configuró después), cada minuto revisa si quedó
  // alguna pendiente y la vuelve a intentar.
  // La conexión con Google dura ~1 hora. Se renueva ella sola, en silencio (prompt:"none": la
  // API de Google no abre nada, ni pestaña ni ventana — o no dice nada si no puede). Antes se
  // pedía con prompt:"" (sin silencio), y eso sí abría una pestaña en blanco con Google cada
  // vez; con el modo silencioso de verdad esto no pasa. Si el modo silencioso no logra renovar
  // (por ejemplo, la persona revocó el permiso), se deja el aviso de siempre para reconectar a mano.
  let yUltimoSilencioso=0;
  setInterval(()=>{
    yEstado();yAvisoReconectar();
    const c=yCfg();
    if(c.key||yTok())ordenJusto(cola().filter(x=>!x.yt&&!x.novid)).forEach(x=>ytAgregar(x.id));
    if(ySrv()&&c.srv){ if(Date.now()-yFalloSrv>60000) yRenovarServidor(false); }   // se renueva sola antes de vencer
    else if(c.cid&&c.on&&!yTok()&&Date.now()-yUltimoSilencioso>5*60000){yUltimoSilencioso=Date.now();yConectar(true);}
  },60000);
  // Al volver a la app (pantalla prendida, otra app) o al volver el internet, se renueva de una vez si hace falta.
  const yDespertar=()=>{if(document.visibilityState==='visible'&&ySrv()&&yCfg().srv)yRenovarServidor(false);};
  document.addEventListener('visibilitychange',yDespertar);window.addEventListener('online',yDespertar);
  setTimeout(()=>{if(ySrv()&&yCfg().srv)yRenovarServidor(false);},4000);
  if($('ytRedirUri'))$('ytRedirUri').textContent=yRedir();
  yAvisoReconectar();
  yEstado();
  yQuien();
}
// Aviso (en Música) cuando no hay conexión con Google: dice EXACTAMENTE qué falta y el botón hace eso.
// Antes siempre decía «se venció (dura 1 hora) → Reconectar», aunque lo que faltaba fuera otra cosa
// (la sesión de ORDEVA Nube, el Client Secret…), y reconectar no lo arreglaba.
function yIrNube(){
  const b=document.querySelector('nav button[data-view="ajustes"]');try{asisGoView('ajustes');}catch(x){b&&b.click();}
  setTimeout(()=>{const c=document.querySelector('.ajustes-cat[data-cat="nube"]');c&&c.click();},300);
}
function yAvisoReconectar(){
  let b=$('ytRecon');const c=yCfg(),falta=!!(c.cid&&c.on&&!yTok()&&!(ySrv()&&c.srv&&!yFalloSrv));
  if(!b){
    const sec=$('view-musica');if(!sec)return;
    b=document.createElement('div');b.id='ytRecon';b.className='yt-recon';
    b.innerHTML='<span></span><button type="button" class="btn-primary"></button>';
    sec.insertBefore(b,sec.firstChild);
  }
  b.hidden=!falta;if(!falta)return;
  const m=window.ventoGoogle&&window.ventoGoogle.motivo?window.ventoGoogle.motivo():'sin_sesion';
  let txt,btn,fn;
  if(m==='sin_sesion'){txt='🟠 Google no está conectado: las canciones nuevas no entran a tu lista de YouTube. Toca «Conectar con Google».';btn='Conectar con Google';fn=()=>yConectar(false);}
  else if(m==='comprobando'){txt='⏳ Conectando con el Servidor ORDEVA…';btn='Reintentar';fn=()=>yConectar(false);}
  else if(m==='sin_servidor'){txt='🟠 Google no está conectado. Toca «Conectar con Google».';btn='Conectar con Google';fn=()=>{yFalloSrv=0;yConectar(false);};}
  else if(c.srv&&yFalloSrv&&yFalloMsg&&!/revoc|no está conectado|ya no acepta/i.test(yFalloMsg)){txt='🟠 Google: '+yFalloMsg+' Se reintenta solo cada minuto.';btn='Reintentar ahora';fn=()=>{yFalloSrv=0;yRenovarServidor(true);};}
  else{txt='🟠 Google no está conectado: las canciones nuevas no entran a tu lista de YouTube. Toca «Conectar con Google».';btn='Conectar con Google';fn=()=>yConectar(false);}
  b.querySelector('span').textContent=txt;const k=b.querySelector('button');k.textContent=btn;k.onclick=fn;
}

/* ---------- 🎶 Un solo equipo pone la música ----------
   Con la misma cuenta en varios equipos (celular y computador), se elige UNO que pone la música: así nunca suenan dos a
   la vez. Los demás muestran lo que suena y la cola, y lo que se haga en ellos (panel de YouTube, ⏭, ⏯, 🗑, poner una
   lista) se manda a ese equipo por un canal PRIVADO del negocio (data.musicaCanal: no es el de los QR, que conocen los
   clientes). El equipo de la música publica lo que suena y la cola (sin el segundo a segundo: los demás lo calculan).
   Sin elegir ninguno, cada equipo funciona por su cuenta, como antes. */
function mqEq(){try{return codigoEquipo();}catch(e){return '';}}
function mqCfg(){return (typeof data!=='undefined'&&data&&data.musicaEquipo&&data.musicaEquipo.id)?data.musicaEquipo:null;}
function mqOtro(){const c=mqCfg();return !!c&&c.id!==mqEq();}
function mqSoy(){const c=mqCfg();return !!c&&c.id===mqEq();}
function mqNombre(){const c=mqCfg();return c?(c.nombre||'el equipo de la música'):'';}
function mqNombreEquipo(){const u=navigator.userAgent||'';return (window.VentoAndroid?'App Android':/iPhone|iPad/.test(u)?'iPhone':/Android/.test(u)?'Celular':'Computador')+(typeof authUser!=='undefined'&&authUser?' de '+String(authUser).split('@')[0].slice(0,30):'')+(mqEq()?' · '+mqEq().replace(/[^A-Za-z0-9]/g,'').slice(0,4):'');}   // con el código del equipo: dos computadores no se confunden
function mqCanal(){if(typeof data==='undefined'||!data)return '';if(!/^vmus[a-z0-9]{20,}$/.test(data.musicaCanal||'')){data.musicaCanal='vmus'+Array.from(crypto.getRandomValues(new Uint8Array(20)),b=>(b%36).toString(36)).join('');saveData();}return data.musicaCanal;}
function mqPub(o){const c=mqCanal();if(!c)return;try{fetch('https://canal.vento.local/'+c,{method:'POST',body:JSON.stringify(Object.assign({de:mqEq(),n:mqNombreEquipo(),at:Date.now()},o))}).catch(()=>{});}catch(e){}}
let mqES=null,mqESCanal='',mqVisto=0,mqHash='',mqHashT=0,mqEra=null;
const mqHechos=new Set(),mqDesde=Date.now();
function mqEscuchar(){
  const c=mqCfg()?mqCanal():'';
  if(c===mqESCanal&&(mqES||!c))return;
  try{mqES&&mqES.close();}catch(e){}mqES=null;mqESCanal=c;if(!c)return;
  try{mqES=new EventSource('https://canal.vento.local/'+c+'/sse?since=2m');}catch(e){return;}
  mqES.onmessage=ev=>{let m;try{const r=JSON.parse(ev.data);if(r.event&&r.event!=='message')return;m=JSON.parse(r.message);}catch(e){return;}
    if(!m||m.de===mqEq())return;
    if(m.t==='estado'&&mqOtro()&&m.de===(mqCfg()||{}).id)mqAplicar(m);
    else if(m.t==='cmd'&&mqSoy())mqComando(m);};
}
// Equipo de la música → los demás: lo que suena y la cola.
function mqPublicarEstado(forzar){
  if(!mqSoy())return;
  const a=mzActual(),F=mzF();let pausa=false;try{pausa=!!(a&&a.fuente==='app'&&yPl&&yPl.getPlayerState&&yPl.getPlayerState()===2);}catch(e){}
  const it=x=>({i:x.id,v:x.vid||'',s:String(x.title||x.song||'').slice(0,80),a:String(x.artist||'').slice(0,50),g:String(x.song||'').slice(0,100),m:x.mesa,mn:String(x.mesaNombre||tableLabel(x.mesa)).slice(0,30),d:x.dur||null,ts:x.ts||0,pr:x.primero||0,fo:x.fondo?1:0});
  const est={t:'estado',ahora:a?Object.assign(it(a),{f:a.fuente||'',p:pausa?1:0}):null,q:ordenJusto(cola()).slice(0,40).map(it),fondo:F&&F.on?String(F.nombre||'').slice(0,60):''};
  const h=JSON.stringify(est);
  if(!forzar&&h===mqHash&&Date.now()-mqHashT<60e3)return;                // sin cambios: un «sigo aquí» por minuto
  mqHash=h;mqHashT=Date.now();
  let e=0;if(a){e=a.playedSeconds||0;if(a.progresoAt)e+=(Date.now()-a.progresoAt)/1000;else if(a.startedAt&&!a.playedSeconds)e=(Date.now()-a.startedAt)/1000;}
  if(est.ahora)est.ahora.e=Math.round(e);
  mqPub(est);
}
// Los demás equipos: muestran la cola y lo que suena en el equipo de la música.
function mqAplicar(m){
  mqVisto=Date.now();
  const prev=mzActual(),l=[];
  if(prev&&(!m.ahora||m.ahora.i!==prev.id)){prev.status='played';prev.endedAt=Date.now();try{mzAlHistorial(prev);}catch(e){}}
  const de=x=>({id:String(x.i),vid:x.v||null,title:x.s,artist:x.a,song:x.g||x.s,mesa:x.m,mesaNombre:x.mn,dur:x.d,ts:x.ts||Date.now(),primero:x.pr||0,fondo:!!x.fo});
  if(m.ahora)l.push(Object.assign(de(m.ahora),{status:'playing',done:true,fuente:'remoto',pausa:!!m.ahora.p,playedSeconds:m.ahora.p?m.ahora.e||0:m.ahora.e||0,progresoAt:m.ahora.p?null:Date.now(),startedAt:Date.now()-(m.ahora.e||0)*1000}));
  (m.q||[]).forEach(x=>l.push(Object.assign(de(x),{status:'approved',ok:true,done:false})));
  const ids=new Set(l.map(x=>x.id));
  cola().filter(x=>!x.done&&!ids.has(x.id)&&Date.now()-(x.ts||0)<20000).forEach(x=>l.push(x));   // lo que se acaba de mandar y todavía no vuelve
  SS('vito_cola',l);
  try{renderMusica();}catch(e){}try{ypSigueK='';ypPintar();if(ypAbierto&&!ypVer&&ypTab==='cola')ypCuerpo(true);}catch(e){}
}
// El equipo de la música recibe lo que mandan los demás.
function mqComando(m){
  const k=(m.de||'')+'|'+(m.at||0)+'|'+(m.a||'')+'|'+(m.id||'');
  if(mqHechos.has(k)||(m.at&&m.at<mqDesde-90e3))return;mqHechos.add(k);
  const quien=String(m.n||'otro equipo').slice(0,40);
  try{
    if(m.a==='add'&&m.v&&/^[\w-]{6,20}$/.test(m.v.vid||'')){
      if(ypAgregar({vid:m.v.vid,title:String(m.v.title||'').slice(0,80),artist:String(m.v.artist||'').slice(0,60),dur:+m.v.dur||null},!!m.pr,true,m.id&&/^[\w-]{4,40}$/.test(m.id)?m.id:null))
        showToast('🎵 «'+String(m.v.title||'').slice(0,60)+'» (desde '+quien+')'+(m.pr?' suena después de la actual.':' a la cola.'));
    }
    else if(m.a==='sig')mzSaltar();
    else if(m.a==='pausa')ypPausa();
    else if(m.a==='quitar'&&m.id){mzTermino(String(m.id),'cancelled');try{tvPublicar(true);}catch(e){}renderMusica();}
    else if((m.a==='primero'||m.a==='poner')&&m.id){const l=cola(),it=l.find(z=>z.id===String(m.id));if(it){it.primero=Date.now();SS('vito_cola',l);try{tvPublicar(true);}catch(e){}if(m.a==='poner'&&mzActual())mzSaltar();else{try{siguienteAuto();}catch(e){}}renderMusica();}}
    else if(m.a==='lista'&&m.id&&mzListaId(String(m.id)))mzPonerLista(mzListaId(String(m.id)),String(m.nombre||'').slice(0,80),null);
    else if(m.a==='fondo-quitar')mzFondoQuitar();
  }catch(e){}
  setTimeout(()=>mqPublicarEstado(true),400);
}
// Un equipo que deja de ser el de la música se calla (la música sigue en el otro).
function mqRevisar(){
  try{
    mqEscuchar();
    const otro=mqOtro();
    if(otro&&mqEra!==true){try{if(yPl&&yPl.stopVideo)yPl.stopVideo();}catch(e){}sonando=false;cargadoEn=0;try{ytMostrar(false);}catch(e){}
      const l=cola();l.filter(x=>x.status==='playing'&&x.fuente==='app').forEach(x=>{x.status='skipped';x.endedAt=Date.now();});SS('vito_cola',l);}
    if(mqEra===true&&!otro){mqVisto=0;try{siguienteAuto();}catch(e){}}
    mqEra=otro;
    mqPublicarEstado(false);
    mqPintar();
  }catch(e){}
}
setInterval(mqRevisar,3000);setTimeout(mqRevisar,1500);
function mqElegir(si){
  if(typeof data==='undefined'||!data)return;
  if(si){data.musicaEquipo={id:mqEq(),nombre:mqNombreEquipo(),at:Date.now()};mqCanal();saveData();
    mqEra=false;try{mzAsegurarReproductor(true);}catch(e){}
    showToast('🎶 Listo: la música suena SOLO en este equipo. En tus otros equipos ves la cola y lo que pongas allá suena aquí.',8000);}
  else{data.musicaEquipo=null;saveData();showToast('🎶 Listo: cada equipo pone su música por su cuenta (como antes).',6000);}
  mqRevisar();mqPublicarEstado(true);try{mzAutoPintar();renderMusica();}catch(e){}
}
function mqPintar(){
  const t=$('mqTxt'),b1=$('mqYo'),b2=$('mqLibre');if(!t)return;
  const c=mqCfg();
  t.textContent=!c?'Ahora cada equipo con tu cuenta puede poner música por su lado. Elige uno para que nunca suenen dos a la vez.':
    mqSoy()?'🟢 Este equipo pone la música. En tus otros equipos se ve la cola y lo que pongan suena aquí.':
    '🔊 La música suena en «'+mqNombre()+'». Aquí ves la cola y lo que pongas suena allá.'+(mqVisto&&Date.now()-mqVisto>3*6e4?' ⚠️ No responde hace rato (¿está cerrado o sin internet?).':!mqVisto?' (conectando…)':'');
  b1.hidden=mqSoy();b1.textContent=c?'🎶 Que suene en este equipo':'🎶 Este equipo pone la música';
  b2.hidden=!c;
  if(!b1.onclick){b1.onclick=()=>mqElegir(true);b2.onclick=()=>mqElegir(false);}
}
/* ---------- Reproductor automático dentro de la app ---------- */
// Si otro equipo es el de la música, este no suena (aunque tenga el reproductor prendido).
const AUTO=()=>!!LS('vito_auto_play',{}).on&&!mqOtro();
let yPl=null,yListo=false,sonando=false,cargadoEn=0;
function cargarAPI(){
  if(window.YT&&YT.Player){if(AUTO())crearPlayer();crearTest();return;}
  if($('ytApi'))return;
  window.onYouTubeIframeAPIReady=()=>{if(AUTO())crearPlayer();crearTest();};
  const t=document.createElement('script');t.id='ytApi';t.src='https://www.youtube.com/iframe_api';document.head.appendChild(t);
}
function crearPlayer(){
  if(yPl)return;
  yPl=new YT.Player('ytPlayer',{width:'100%',height:'200',playerVars:{playsinline:1,rel:0},events:{
    onReady:()=>{yListo=true;crearTest();siguienteAuto();},
    onStateChange:e=>{if(e.data===1){cargadoEn=0;pausaManual=false;}if(e.data===2)pausaManual=window.__ventoAlFrente!==false&&!document.hidden;if(e.data===0){sonando=false;const a=mzActual();if(a&&a.fuente==='app')mzTermino(a.id,'played',a.dur||null);if(!ordenJusto(cola()).some(y=>y.vid))ytMostrar(false);siguienteAuto();}},
    onError:e=>{reemplazarBloqueada('error',e&&e.data);}}});
}
// El video que sonaba está bloqueado para reproductores fuera de YouTube: se busca otra versión
// de la MISMA canción (hasta 3 intentos) antes de pasar a la siguiente; si ya no queda ninguna,
// se tapa el aviso de error de YouTube con un «esperando la próxima canción».
let reemplazando=false;
// motivo: 'error' = YouTube dijo que esa versión no se deja poner aquí (100/101/150…): queda en la lista negra.
//         'atascada' = no arrancó en mucho rato sin decir nada: se prueba otra versión, pero NO se marca como mala
//         (antes un comercial largo de YouTube hacía creer que la canción estaba «bloqueada por el sello»).
async function reemplazarBloqueada(motivo,codigo){
  if(reemplazando)return;
  reemplazando=true;sonando=false;cargadoEn=0;
  try{
    const now=LS('vito_now',null);
    if(now&&now.song){
      if(motivo==='error')ytMarcarBad(now.vid);
      const probados=(now.probados||[]).concat(now.vid?[now.vid]:[]);
      if(probados.length<=3){
        const qs=[now.song,now.song+' audio',now.song+' letra'];
        let v=null;
        for(const q of qs){ try{ v=await ySearch(q,probados); }catch(e){ v=null; } if(v)break; }
        if(v){
          const nx=Object.assign({},now,{vid:v,probados,dur:ytDurCache[v]||null});
          SS('vito_now',nx);
          const l=cola(),it=l.find(y=>y.id===now.id);if(it){it.vid=v;it.dur=ytDurCache[v]||it.dur;SS('vito_cola',l);}
          showToast(motivo==='error'?'🔁 Esa versión de «'+now.song+'» no se deja poner fuera de YouTube; pongo otra versión.':'🔁 «'+now.song+'» no arrancó; pruebo otra versión.');
          ytMostrar(true);sonando=true;cargadoEn=Date.now();yPl.loadVideoById(v);
          return;
        }
      }
      showToast('⏭️ «'+now.song+'» no se deja reproducir fuera de YouTube; paso a la siguiente.');
      try{window.ventoError&&window.ventoError('musica','Canción bloqueada: ninguna versión se dejó reproducir',{cancion:String(now.song).slice(0,80),probados:probados.length},'musica|bloqueada');}catch(e){}
    }
    try{const a=mzActual();if(a&&a.fuente==='app')mzTermino(a.id,'error');}catch(e){}
    ytMostrar(false);
    siguienteAuto();
  }finally{ reemplazando=false; }
}
// Verificación ANTES de sonar: un segundo reproductor, invisible y en silencio, prueba cada
// canción de la cola apenas llega. Si YouTube dice que no se puede reproducir aquí, se busca
// otra versión (hasta 5) y la mala queda en la lista negra; así al reproductor solo llegan
// versiones que ya se comprobó que suenan.
let yTest=null,yTestListo=false,verificando=null;
function crearTest(){
  if(yTest||!window.YT||!YT.Player)return;
  let d=$('ytTest');
  if(!d){d=document.createElement('div');d.id='ytTest';d.setAttribute('aria-hidden','true');
    d.style.cssText='position:fixed;left:0;bottom:0;width:4px;height:4px;opacity:.01;pointer-events:none;overflow:hidden;z-index:-1';
    const i=document.createElement('div');i.id='ytTestIn';d.appendChild(i);document.body.appendChild(d);}
  yTest=new YT.Player('ytTestIn',{width:'200',height:'113',playerVars:{playsinline:1,mute:1,controls:0},events:{
    onReady:()=>{yTestListo=true;try{yTest.mute();}catch(e){}},
    onStateChange:e=>{if(verificando&&e.data===1)verificando.fin(true);},
    onError:()=>{if(verificando)verificando.fin(false);}}});
}
function probarVideo(v){
  return new Promise(res=>{
    if(!yTestListo){res(true);return;}                      // sin probador: el reproductor principal igual cambia de versión si falla
    let t=null;
    verificando={fin:ok=>{clearTimeout(t);verificando=null;try{yTest.stopVideo();}catch(e){}res(ok);}};
    t=setTimeout(()=>verificando&&verificando.fin(true),9000);   // no respondió: se da por buena
    try{yTest.mute();yTest.loadVideoById(v);}catch(e){verificando.fin(true);}
  });
}
let verifCorriendo=false;
async function verificarCola(){
  if(verifCorriendo||!(AUTO()||tvOn()))return;
  const x=ordenJusto(cola()).find(y=>y.vid&&!y.ok);
  if(!x)return;
  verifCorriendo=true;
  try{
    if(!yTestListo){cargarAPI();return;}                 // el probador todavía está cargando
    const ok=await probarVideo(x.vid);
    const l=cola(),it=l.find(y=>y.id===x.id);if(!it)return;
    if(ok){it.ok=true;if(it.status==='pending')it.status='approved';SS('vito_cola',l);tvPublicar();renderMusica();try{siguienteAuto();}catch(e){}return;}
    ytMarcarBad(it.vid);
    it.probados=(it.probados||[]).concat(it.vid);it.vid=null;it.ok=false;
    if(it.probados.length>=5){it.novid=true;it.sinVersion=true;it.status='error';it.done=true;it.endedAt=Date.now();SS('vito_cola',l);try{mzAlHistorial(it);}catch(e){}showToast('⚠️ «'+it.song+'» no tiene ninguna versión que se deje reproducir aquí; la salto.');renderMusica();return;}
    SS('vito_cola',l);
    ytUno(it.id);
  }finally{verifCorriendo=false;}
}
// Tapa el reproductor cuando no hay nada sonando (así no queda el aviso de error de YouTube).
function ytMostrar(si){
  const b=$('ytBox');if(!b)return;
  b.classList.toggle('yt-espera',!si);
}
/* Poner música desde el panel de YouTube (o «▶ Poner» una lista) es querer que suene YA. Antes, con el reproductor de
   ORDEVA apagado (así viene) la canción solo quedaba en la cola y no sonaba nada. Ahora, si en este equipo nadie la va a
   reproducir (ni el TV, ni YouTube Music sonando), se prende el reproductor de ORDEVA, igual que «Activar música automática». */
const mzHayTV=()=>tvOn()||(typeof lngOn==='function'&&lngOn());
const mzConYTMusic=()=>{const a=mzActual();return !!(yTok()&&!ySinCupo()&&a&&a.fuente==='ytmusic');};
const mzSinReproductor=()=>!mqOtro()&&!AUTO()&&!mzHayTV()&&!(yTok()&&!ySinCupo());
function mzAsegurarReproductor(callado){
  gestoUsuario=true;
  if(mqOtro()||mzHayTV()||mzConYTMusic())return false;
  let prendi=false;
  if(!AUTO()){prendi=true;
    const a=$('autoPlay');
    if(a&&a.onchange){a.checked=true;a.dispatchEvent(new Event('change'));}
    else{SS('vito_auto_play',{on:true});const b=$('ytBox');if(b)b.hidden=false;}
    SS('vito_auto_por_cupo',0);
    if(!callado)showToast('🎶 Encendí el reproductor de ORDEVA: lo que pongas aquí y lo que pidan las mesas por QR suena en este equipo, una tras otra.',7000);
  }
  try{cargarAPI();}catch(e){}
  try{if(yPl&&yPl.getPlayerState&&yPl.getPlayerState()===2&&!pausaManual)yPl.playVideo();}catch(e){}
  try{mzAutoPintar();}catch(e){}
  return prendi?'prendido':true;
}
/* Vigía de la música → ORDEVA Admin (🐞 Errores): avisa cuando hay canciones esperando y no suena nada, para arreglarlo
   antes de que el negocio tenga que contarlo. Una vez por problema (el reporte se agrupa solo). */
const mzVigia={};
function mzVigilar(){
  try{
    if(typeof data==='undefined'||!data||data.musicOn===false)return;
    const o=ordenJusto(cola()),esperan=o.filter(y=>!y.fondo&&y.vid),viejo=esperan.length?Date.now()-Math.min(...esperan.map(y=>y.ts||Date.now())):0;
    const marca=(k,si,ms,fn)=>{if(!si){delete mzVigia[k];return;}if(!mzVigia[k])mzVigia[k]=Date.now();else if(Date.now()-mzVigia[k]>ms&&!mzVigia[k+'!']){mzVigia[k+'!']=1;fn();}};
    // 1) Piden canciones y en este equipo nadie las pone (ni el reproductor de ORDEVA, ni el TV, ni YouTube Music).
    marca('sinrep',typeof mqOtro==='function'?!mqOtro()&&mzSinReproductor()&&viejo>0:mzSinReproductor()&&viejo>0,3*6e4,()=>window.ventoError&&window.ventoError('musica','Canciones esperando y ningún reproductor prendido',{esperando:esperan.length,minutos:Math.round(viejo/6e4)},'musica|sin-reproductor'));
    // 1b) El equipo de la música no responde (otro equipo de la cuenta lo eligió y está cerrado o sin internet).
    marca('mqmudo',typeof mqOtro==='function'&&mqOtro()&&Date.now()-mqVisto>3*6e4&&viejo>0,6e4,()=>window.ventoError&&window.ventoError('musica','El equipo que pone la música no responde',{equipo:mqNombre(),esperando:esperan.length},'musica|equipo-no-responde'));
    // 2) El reproductor está prendido, hay canciones listas y no suena nada.
    const a=mzActual(),listas=o.filter(y=>y.vid&&(y.ok||!yTestListo));
    const quieto=AUTO()&&!mzHayTV()&&listas.length>0&&!a&&!sonando;
    marca('quieto',quieto,9e4,()=>{let st=-2;try{st=yPl&&yPl.getPlayerState?yPl.getPlayerState():-2;}catch(e){}
      window.ventoError&&window.ventoError('musica','Hay canciones listas pero el reproductor no arranca',{listas:listas.length,yListo:!!yListo,probador:!!yTestListo,toque:!!gestoUsuario,estado:st,visible:!document.hidden,navegador:(navigator.userAgent.match(/(Brave|Edg|OPR|SamsungBrowser|Firefox|Chrome|Safari)\/[\d.]+/)||[''])[0],app:!!window.VentoAndroid},'musica|no-arranca');});
    // 3) Sonando «de mentiras»: dice que suena pero el video lleva 2 min quieto (sin pausa a mano).
    let st=-2;try{st=yPl&&yPl.getPlayerState?yPl.getPlayerState():-2;}catch(e){}
    marca('pegada',AUTO()&&sonando&&!pausaManual&&st!==1&&st!==3,12e4,()=>window.ventoError&&window.ventoError('musica','El reproductor quedó pegado (no avanza)',{estado:st,cancion:String(a&&(a.title||a.song)||'').slice(0,80)},'musica|pegada'));
  }catch(e){}
}
setInterval(mzVigilar,15000);
window.vitoMusicaVigilar=mzVigilar;window.__mzVigia=mzVigia;
// Diagnóstico de la música (para el soporte y las pruebas): en qué está el reproductor y por qué no suena.
window.vitoMusicaDiag=()=>{let st=-2,t=0,vd='';try{st=yPl&&yPl.getPlayerState?yPl.getPlayerState():-2;t=yPl&&yPl.getCurrentTime?yPl.getCurrentTime():0;vd=yPl&&yPl.getVideoData?(yPl.getVideoData()||{}).video_id:'';}catch(e){}
  return {pausaManual,cargadoHace:cargadoEn?Math.round((Date.now()-cargadoEn)/1000):null,auto:AUTO(),guardado:!!LS('vito_auto_play',{}).on,otroEquipo:typeof mqOtro==='function'&&mqOtro(),tv:mzHayTV(),api:!!(window.YT&&YT.Player),yListo,probador:yTestListo,toque:gestoUsuario,sonando,estado:st,tiempo:t,video:vd,
    cola:ordenJusto(cola()).slice(0,5).map(x=>({t:(x.title||x.song||'').slice(0,40),vid:x.vid,ok:!!x.ok,st:x.status})),actual:(mzActual()||{}).title||null,visible:!document.hidden};};   // para las pruebas (adelantar el reloj del vigía)
function siguienteAuto(){
  if(!AUTO()||!yListo||sonando)return;
  if(!gestoUsuario)return;                            // sin el primer toque el navegador no deja sonar: se espera
  if(mzActual()&&mzActual().fuente==='app')return;    // ya hay una sonando: la nueva queda en la cola
  if(tvOn())return;                                   // el TV es el reproductor
  const o=ordenJusto(cola()).filter(y=>y.vid);
  const x=o.find(y=>y.ok||!yTestListo);if(!x)return;  // solo versiones ya comprobadas
  mzEmpezo(x.id,'app');
  SS('vito_now',x);sonando=true;cargadoEn=Date.now();ytMostrar(true);yPl.loadVideoById(x.vid);renderMusica();
}
// Progreso real del reproductor de la app (segundos y duración que da YouTube)
setInterval(()=>{try{const a=mzActual();if(a&&a.fuente==='app'&&yPl&&yPl.getCurrentTime&&yPl.getPlayerState()===1)mzProgreso(a.id,yPl.getCurrentTime(),yPl.getDuration());}catch(e){}},5000);
// Algunos videos bloqueados por el sello discográfico (ej. WMG) muestran su
// propio aviso de "vídeo no disponible" DENTRO del reproductor sin avisarle
// a la app — el evento onError no siempre llega (pasa sobre todo con las
// cookies de terceros bloqueadas, cada vez más común en los celulares). Si
// una canción "cargada" no arranca a sonar en 7 segundos, se da por
// trabada/bloqueada y se pasa sola a la siguiente, en vez de quedarse
// pegada mostrando el aviso de YouTube para siempre.
let atascoPlay=0;
window.__ytVigilar=()=>vigilarAtascado();window.__ytAdelantar=ms=>{if(cargadoEn)cargadoEn-=ms;};   // para las pruebas
function vigilarAtascado(){
  if(!sonando||!cargadoEn||!yPl||!yPl.getPlayerState)return;
  const st=yPl.getPlayerState();
  if(st===1||st===3){atascoPlay=0;return;} // 1=reproduciendo, 3=cargando/buffering: va bien, solo tarda
  // Antes se daba por bloqueada a los 7 s, pero mientras YouTube pasa sus comerciales (hasta 30 s o más, a veces dos)
  // el video no arranca: la canción se marcaba «bloqueada» sin estarlo. Ahora: a los 12 s se le da play una vez, y solo
  // si a los 60 s sigue quieta se prueba otra versión (sin marcarla como mala para siempre).
  const t=Date.now()-cargadoEn;
  // Con la app minimizada el celular puede frenar el video: a los 7 s se le da play otra vez (y nunca se descarta).
  if(fondoMusica()&&t>=7000){try{yPl.playVideo();}catch(e){}cargadoEn=Date.now();return;}
  if(t>=12000&&atascoPlay!==cargadoEn&&!pausaManual){atascoPlay=cargadoEn;try{yPl.playVideo();}catch(e){}return;}
  if(t<60000)return;
  // Con la app minimizada el celular puede frenar el video un momento: se le da play otra vez en vez de
  // marcar la canción como mala (antes se descartaban canciones buenas por estar en segundo plano).
  if(fondoMusica()){try{yPl.playVideo();}catch(e){}cargadoEn=Date.now();return;}
  reemplazarBloqueada('atascada');
}
/* Música automática: RECIBIR → ENCOLAR → REPRODUCIR → DETECTAR EL FINAL → SIGUIENTE, sin tocar Play.
   Los navegadores no dejan sonar con audio hasta que la persona toca la pantalla una vez (es una
   protección del navegador que no se salta): por eso hay un solo toque inicial («Música automática»
   o cualquier toque en la app); después todo sigue solo. En el TV (tv.html) pasa igual con «Empezar música». */
// En la app de Android no hace falta el primer toque (la app deja sonar sola): así, si Android reinicia ORDEVA con la
// app minimizada, la música sigue sola.
let gestoUsuario=!!window.VentoAndroid,pausaManual=false;
// ¿ORDEVA está minimizada (o con la pantalla apagada)?
const fondoMusica=()=>window.__ventoAlFrente===false||document.hidden;
/* Música con la app minimizada (app de Android): el servicio de fondo despierta a ORDEVA cada 5 s (ventoLatido) y
   aquí se revisa que siga sonando: si el celular frenó el video se le da play; si terminó, pone la siguiente. */
window.vitoMusicaLatido=()=>{
  try{
    if(!AUTO()||tvOn())return;
    if(!yPl||!yListo){cargarAPI();return;}
    const st=yPl.getPlayerState?yPl.getPlayerState():-1,a=mzActual(),deApp=!!(a&&a.fuente==='app');
    if((sonando||deApp)&&st===2&&!pausaManual){yPl.playVideo();sonando=true;return;}
    if((sonando||deApp)&&st===0){sonando=false;if(deApp)mzTermino(a.id,'played',a.dur||null);}
    if(!sonando)siguienteAuto();
    verificarCola();
  }catch(e){}
};
['pointerdown','keydown','touchstart'].forEach(ev=>document.addEventListener(ev,()=>{if(gestoUsuario)return;gestoUsuario=true;try{if(AUTO())siguienteAuto();}catch(e){}mzAutoPintar();},{capture:true,passive:true}));
function mzAutoPintar(){
  const t=$('mzAutoTxt'),b=$('mzAutoGo');if(!t||!b)return;
  if(mqOtro()){b.hidden=true;t.textContent='🔊 La música suena en «'+mqNombre()+'». Lo que pongas aquí suena allá (cámbialo en «🎶 Equipo que pone la música»).';return;}
  if(tvOn()){b.hidden=true;t.textContent=(Date.now()-tvVisto<75000)?'📺 Automática en el TV: las canciones que piden las mesas suenan solas, una tras otra.':'📺 Modo TV: abre el link del TV y toca «Empezar música» una vez; después todo es automático.';return;}
  b.hidden=false;
  if(!AUTO()){b.textContent='🎶 Activar música automática';t.textContent='Toca «Activar música automática»: este celular reproduce la cola sola, una canción tras otra, y las nuevas entran solas.';return;}
  b.textContent=gestoUsuario?'🎶 Automática encendida':'▶ Toca para empezar';
  const a=mzActual();
  t.textContent=!gestoUsuario?'🔈 Toca la pantalla una vez para permitir el sonido (el navegador lo exige); luego sigue sola.':a?'🟢 Automática: suena «'+(a.title||a.song)+'»; al terminar pone la siguiente sola.':'🟢 Automática: esperando canciones. Cuando una mesa pida, empieza sola.';
}
function iniAutoPlay(){
  // Si la app se cerró o recargó mientras sonaba algo en este celular, esa canción se da por terminada.
  try{cola().filter(x=>x.status==='playing'&&x.fuente==='app').forEach(x=>mzTermino(x.id,x.dur&&x.playedSeconds>=x.dur*0.9?'played':'skipped'));}catch(e){}
  const go=$('mzAutoGo');
  if(go)go.onclick=()=>{gestoUsuario=true;if(!AUTO()){$('autoPlay').checked=true;$('autoPlay').dispatchEvent(new Event('change'));}cargarAPI();try{if(yPl&&yPl.getPlayerState&&yPl.getPlayerState()===2)yPl.playVideo();}catch(e){}siguienteAuto();mzAutoPintar();showToast('🎶 Música automática encendida: las canciones suenan solas, una tras otra.');};
  setInterval(mzAutoPintar,3000);setTimeout(mzAutoPintar,800);
  $('autoPlay').checked=AUTO();$('ytBox').hidden=!AUTO();
  $('autoPlay').onchange=e=>{
    SS('vito_auto_play',{on:e.target.checked});SS('vito_auto_por_cupo',0);$('ytBox').hidden=!e.target.checked;
    if(e.target.checked){cargarAPI();pausaManual=false;try{const a=mzActual();if(a&&a.fuente==='app'&&yPl&&yPl.getPlayerState&&yPl.getPlayerState()===2){yPl.playVideo();sonando=true;}}catch(x){}}
    else{sonando=false;cargadoEn=0;if(yPl&&yPl.pauseVideo)yPl.pauseVideo();}
    // App de Android: para que la música siga con la app minimizada, ORDEVA queda trabajando de fondo.
    try{const A=window.VentoAndroid;if(e.target.checked&&A&&A.fondo&&A.fondoActivar&&!A.fondo()){A.fondoActivar(true);showToast('🎶 La música seguirá sonando con ORDEVA minimizada (verás un aviso fijo «ORDEVA está trabajando»).',7000);}}catch(x){}
    yEstado();
  };
  if(AUTO()||tvOn())cargarAPI();
  setInterval(()=>{siguienteAuto();vigilarAtascado();verificarCola();},3000);
}

/* ---------- Pantalla del TV: el propio TV es el reproductor ----------
   En el navegador del TV (LG webOS, Samsung, Android TV, TV Box) se abre tv.html con un
   código. El celular le manda la cola por el canal de ORDEVA (canal "mesoratv"+código) y el TV la
   reproduce en orden, en vivo: cada canción que piden las mesas entra sola, sin Google, sin
   transmitir y sin tocar nada. El TV le avisa al celular qué está sonando y si una versión
   no se deja reproducir (se busca otra). */
const TVP_KEY='vito_tvpant';
const tvCfg=()=>{const c=LS(TVP_KEY,{});if(!c.code){c.code=Array.from(crypto.getRandomValues(new Uint8Array(6)),b=>'abcdefghjkmnpqrstuvwxyz23456789'[b%31]).join('');SS(TVP_KEY,c);}return c;};
function tvOn(){return !!LS(TVP_KEY,{}).on;}
const tvTopic=()=>'mesoratv'+tvCfg().code;
function tvUrl(){
  const base=location.protocol==='file:'?'':location.origin+location.pathname.replace(/[^/]*$/,'');
  return base?base+'tv.html#'+tvCfg().code:'';
}
let tvHash='',tvHashT=0,tvES=null,tvVisto=0,tvSonando='',tvReintT=null;
function tvPublicar(force){
  if(!tvOn()||mqOtro())return;
  const q=ordenJusto(cola()).filter(x=>x.vid&&!x.sinVersion&&(x.ok||!yTestListo)).slice(0,15)
    .map(x=>({i:x.id,v:x.vid,s:String(x.title||x.song).slice(0,60),a:String(x.artist||'').slice(0,40),m:String(tableLabel(x.mesa)).slice(0,20)}));
  const msg={q,b:String(data&&data.businessName||'').slice(0,40)};
  const s=JSON.stringify(msg);
  if(!force&&s===tvHash&&Date.now()-tvHashT<5*6e4)return;
  tvHash=s;tvHashT=Date.now();
  fetch('https://canal.vento.local/'+tvTopic(),{method:'POST',body:JSON.stringify(Object.assign(msg,{t:Date.now()}))})
    .then(r=>{if(!r.ok)throw new Error('canal '+r.status);})
    .catch(()=>{tvHash='';clearTimeout(tvReintT);tvReintT=setTimeout(()=>{try{tvPublicar(true);}catch(e){}},6000);});   // no salió: se reintenta en 6 s
}
function tvEscuchar(){
  if(tvES){try{tvES.close();}catch(e){}tvES=null;}
  if(!tvOn())return;
  try{tvES=new EventSource('https://canal.vento.local/'+tvTopic()+'r/sse?since=1m');}catch(e){return;}
  tvES.onmessage=ev=>{
    let m;try{m=JSON.parse(JSON.parse(ev.data).message);}catch(e){return;}
    if(!m)return;
    tvVisto=Date.now();
    if(m.p){                                               // empezó a sonar en el TV
      const it0=cola().find(y=>y.id===m.p);
      if(it0&&it0.status!=='playing'&&!['played','skipped','cancelled'].includes(it0.status)){const it=mzEmpezo(m.p,'tv');if(it){it.tvAt=Date.now();SS('vito_now',it);}}
      const it=cola().find(y=>y.id===m.p);
      tvSonando=it?it.song:tvSonando;renderMusica();tvPublicar();
    }
    if(m.b){                                               // esa versión no se dejó reproducir en el TV
      ytMarcarBad(m.v);
      const l=cola(),it=l.find(y=>y.id===m.b);
      if(it&&it.vid===m.v){it.probados=(it.probados||[]).concat(m.v);it.vid=null;it.ok=false;SS('vito_cola',l);ytAgregar(it.id);}
      tvPublicar(true);
    }
    if(m.g)mzProgreso(m.g,m.t,m.d);                        // progreso real en el TV
    if(m.e){const it=cola().find(y=>y.id===m.e);if(it&&it.status==='playing'){if(m.d)mzCambiar(m.e,{dur:Math.round(m.d)});mzTermino(m.e,'played',m.t);}renderMusica();}
    if(m.s!==undefined)tvSonando=m.s||'';
    tvEstado();
  };
}
function tvEstado(){
  const e=$('tvpEstado');if(!e)return;
  if(!tvOn()){e.textContent='⚪ Apagado.';return;}
  const vivo=Date.now()-tvVisto<75000;
  e.textContent=vivo?('🟢 El TV está conectado'+(tvSonando?' · sonando: '+tvSonando:'')+'.'):'🟠 Esperando que abras el link en el navegador del TV…';
}
function iniTVPantalla(){
  const sw=$('tvpOn');if(!sw)return;
  const pintar=()=>{const u=tvUrl();$('tvpLink').value=u||'Abre ORDEVA desde su dirección https (no como archivo) para tener el link del TV.';$('tvpBox').hidden=!tvOn();tvEstado();};
  sw.checked=tvOn();
  sw.onchange=e=>{
    const c=tvCfg();c.on=e.target.checked;SS(TVP_KEY,c);
    if(c.on){
      // Si la app estaba sonando aquí o transmitiendo, se apaga para que no suenen dos a la vez.
      const a=$('autoPlay');if(a&&a.checked){a.checked=false;a.dispatchEvent(new Event('change'));}
      cargarAPI();ordenJusto(cola()).forEach(x=>{if(!x.vid)ytAgregar(x.id);});
    }
    tvEscuchar();tvPublicar(true);pintar();
  };
  $('tvpCopy').onclick=()=>{const u=tvUrl();if(!u)return showToast('⚠️ Abre ORDEVA desde su dirección https para tener el link del TV.');
    (navigator.clipboard?navigator.clipboard.writeText(u):Promise.reject()).then(()=>showToast('📋 Link del TV copiado.'),()=>{$('tvpLink').select();showToast('Copia el link a mano.');});};
  $('tvpNew').onclick=()=>{if(!confirm('¿Crear un link nuevo para el TV? El link anterior dejará de funcionar.'))return;const c=LS(TVP_KEY,{});delete c.code;SS(TVP_KEY,c);tvCfg();tvEscuchar();tvPublicar(true);pintar();};
  pintar();tvEscuchar();tvPublicar(true);
  // El canal por el que el TV avisa (qué suena, cuándo terminó) se reabre si el navegador lo cerró.
  setInterval(()=>{if(tvOn()&&(!tvES||tvES.readyState===2))tvEscuchar();tvPublicar();tvEstado();},20000);
  window.addEventListener('online',()=>{if(tvOn()){tvEscuchar();tvPublicar(true);}});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&tvOn()){if(!tvES||tvES.readyState===2)tvEscuchar();tvPublicar(true);}});
  document.querySelector('nav button[data-view="musica"]').addEventListener('click',pintar);
}

/* ---------- TV Box: link del reproductor ---------- */
function tvLink(){return qCfg().topic;}
function iniTV(){
  $('tvOn').checked=!!LS('vito_tv',{}).on;
  const ref=()=>{$('tvLink').value=tvLink()||'Primero escribe el link de pedido.html en Ajustes → QR de las mesas.';};
  $('tvOn').onchange=e=>SS('vito_tv',{on:e.target.checked});
  $('tvCopy').onclick=()=>{const v=tvLink();if(!v)return showToast('Falta el link de pedido.html.');
    (navigator.clipboard?navigator.clipboard.writeText(v):Promise.reject()).then(()=>showToast('Código copiado.'),()=>{$('tvLink').select();showToast('Copia el código a mano.');});};
  ref();document.querySelector('nav button[data-view="musica"]').addEventListener('click',ref);
}

/* ---------- Cuenta en vivo para el cliente (la ve desde el QR de su mesa) ---------- */
function vTopic(id){
  const c=qCfg();c.v=c.v||{};
  if(!c.v[id]){
    const f=qrFijoDe();
    const g=(typeof data!=='undefined'&&data&&data.qrCodigos&&data.qrCodigos[id])||null;
    c.v[id]=(f&&f.v&&f.v[id])||(Array.isArray(g)?g[0]:g)||('vb'+Array.from(crypto.getRandomValues(new Uint8Array(12)),b=>(b%36).toString(36)).join(''));
    SS('vito_qr',c);qrFijoSync();qCodigosCompartir();
  }
  return c.v[id];
}
const pubHash={};let pubT=null;
function snapMesa(id){
  const its=(data.tables[id]&&data.tables[id].items)||[],consumo=tableTotal(id),saldo=tableBalance(id);
  const sn={t:Date.now(),c:consumo,s:saldo,p:Math.max(0,consumo-saldo),i:its.slice(0,40).map(it=>[String(it.name).slice(0,40),it.qty,it.price])};
  // Canciones que la mesa pidió en la ventana del límite (hora de cada una): el cupo es de la mesa, no del celular.
  try{const now=Date.now(),cs=cola().filter(x=>x.mesa===id&&!x.fondo&&now-x.ts<VENT).map(x=>x.ts).sort((a,b)=>a-b);const lim=mzMax();if(lim&&cs.length){sn.cs=cs.slice(-lim);sn.cm=lim;}}catch(e){}
  return sn;
}
/* ---------- Menú (restaurante/cafetería) o catálogo (cervecería/tienda) para el QR ---------- */
let catHash = '', catT = 0;
function catEstado(t){ const e = $('catPubEstado'); if(e) e.textContent = t; const l = $('catLiveTxt'); if(l) l.textContent = 'Carta de los clientes: ' + t.replace(/^✅ /, '✅ ').replace(/^🟠 /, '🟠 '); }
// Unidades vendidas por producto (todo el historial), para publicar cada
// categoría del catálogo con lo más vendido primero en vez de alfabético.
function productSalesUnits(){
  const units = {};
  (data.history || []).forEach(h => (h.items || []).forEach(it => {
    const k = cartaNrm(nombreVigente(it.name)); units[k] = (units[k] || 0) + (it.qty || 0);
  }));
  return units;
}
async function publicarCatalogo(force){
  if(!data.products.length){ if(force) catEstado('⚠️ Primero agrega productos.'); return; }
  const c = qCfg(), bt = data.businessType || 'tienda', cats = {};
  data.categories.forEach(k => cats[k.id] = k.name);
  const est = p => { if(p.combo){ const b = p.combo.map(c => data.products.find(x => x.id === c.id)).filter(Boolean); return b.some(x => invStatus(x) === 'out') ? 2 : b.some(x => invStatus(x) === 'low') ? 1 : 0; } const s = invStatus(p); return s === 'out' ? 2 : s === 'low' ? 1 : 0; };
  const units = productSalesUnits();
  const productsRanked = data.products.slice().sort((a, b) => {
    const catA = cats[a.categoryId] || '', catB = cats[b.categoryId] || '';
    if(catA !== catB) return 0;                    // el orden entre categorías lo decide pintarCat() en pedido.html
    return (units[cartaNrm(b.name)] || 0) - (units[cartaNrm(a.name)] || 0);
  });
  const list = productsRanked.map(p => {
    const row = [String(p.name).slice(0, 40), Math.round(p.price), String(cats[p.categoryId] || '').slice(0, 24), est(p)];
    const promo = p.combo ? (() => { const n = promoNormal(p.combo); return n > p.price ? Math.round((n - p.price) / n * 100) : 0; })() : 0;
    // Los detalles del negocio (qué incluye el paquete, cuántas personas, la medida…) viajan
    // con cada producto para que el cliente los vea en la carta, como en cualquier página de ventas.
    const det = detResumen(p, 120);
    if(promo || det) row.push(promo);
    if(det) row.push(det);
    return row;
  });
  const m = {
    y: bt, t: cartaTerm(), ic: cartaIcon(), ip: (tipoNegocio() || {}).icono || '', th: data.theme || '', n: (data.businessName || '').slice(0, 40), p: list,
    // Personalización de pedido.html: mensaje, info extra y horario (para el
    // reloj + aviso de abierto/cerrado). Todo opcional, se manda tal cual.
    msg: (data.orderMessage || '').slice(0, 200),
    info: (data.orderExtraInfo || '').slice(0, 200),
    oh: data.orderOpenTime || '', ch: data.orderCloseTime || '', hn: (data.orderHoursNote || '').slice(0, 100),
    mz: musicaOn() ? 1 : 0,
    cl: mzMax(),                                                         // canciones por mesa cada 15 min (0 = sin límite)
    mo: (data.motivo || '')
  };
  while(list.length && new Blob([JSON.stringify(m)]).size > 3800) list.pop();   // tope del canal de ORDEVA (~4 KB)
  const s = JSON.stringify(m);
  if(!force && s === catHash && Date.now() - catT < 3 * 36e5) return;           // se reenvía cada 3 h para que no caduque
  try{
    const r = await fetch('https://canal.vento.local/' + c.topic + 'k', { method: 'POST', body: s });
    if(!r.ok) throw new Error('error ' + r.status);
    catHash = s; catT = Date.now();
    catEstado('✅ Publicado: ' + list.length + ' productos · ' + new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }));
  }catch(e){ catHash = ''; catEstado('🟠 No se pudo publicar (' + (e.message || 'sin internet') + '). Se reintenta solo.'); }
}
window.vitoPublicarCatalogo = publicarCatalogo;
window.vitoQCfg = qCfg;   // lo usan los domicilios por web/WhatsApp, que viven fuera de este módulo
// Lo que usan las fotos de la carta y la transmisión al TV (script del final).
/* ================= ▶️ Panel de YouTube (dentro de la app) =================
   Una ventana de YouTube en ORDEVA: lo que está sonando (el video, si suena en este equipo; la portada si suena en el
   TV), pausa y siguiente, buscar canciones y ponerlas, tus listas de reproducción (las guardadas, pegando el link o
   las de tu cuenta de YouTube) y la cola con portadas. Se abre desde la barrita «🎵 Sonando…» que aparece abajo en
   toda la app, o desde Música → «▶️ Abrir el panel de YouTube».
   El reproductor de la app vive fuera de la pantalla de Música (así sigue sonando en cualquier pantalla) y se muestra
   dentro del panel cuando está abierto. */
const ypMini_=v=>v?'https://i.ytimg.com/vi/'+encodeURIComponent(v)+'/mqdefault.jpg':'';
let ypTab='inicio',ypAbierto=false,ypMiasCache=null;
// El reproductor (#ytBox) pasa a un contenedor propio en <body>: se puede ver en el panel sin recargar el video.
(function(){
  const b=$('ytBox');if(!b||b.dataset.dock)return;
  const sitio=document.createElement('div');sitio.id='ytSitio';sitio.className='yt-sitio';
  sitio.innerHTML='<span>📺 El video se ve en el panel de YouTube.</span> <button type="button" class="btn-ghost" data-yp-abrir>▶️ Abrir el panel</button>';
  b.parentNode.insertBefore(sitio,b);
  b.dataset.dock='1';b.classList.add('yt-dock');document.body.appendChild(b);
})();
function ypUbicar(){
  const b=$('ytBox');if(!b)return;
  const v=$('ypVideo'),ver=ypAbierto&&v&&!b.hidden&&ypFuente()==='app';
  if(ver){const r=v.getBoundingClientRect();Object.assign(b.style,{left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'});b.classList.add('yt-visible');}
  else{b.classList.remove('yt-visible');Object.assign(b.style,{left:'-10000px',top:'0px',width:'320px',height:'180px'});}
  const s=$('ytSitio');if(s)s.hidden=b.hidden;
}
const ypFuente=()=>{const x=mzActual();return x?(x.fuente||''):(sonando?'app':'');};
const ypDonde=f=>f==='remoto'?'🔊 En «'+mqNombre()+'»':f==='app'?'🔊 En este equipo':(f==='tv'||f==='tvyt'||f==='cc')?'📺 En el TV':f==='ytmusic'?'🎧 En YouTube Music':'';
/* ---------- Ventana de YouTube (como YouTube normal) ----------
   Ocupa toda la pantalla, como una ventana nueva. Arriba el buscador; a un lado (o arriba en el celular) las secciones:
   Inicio · Buscar · En cola · Mis canciones (❤️ guardadas, las que más suenan, historial) · Mis listas · Mi YouTube
   (las listas, los «Me gusta», los videos y las suscripciones de la cuenta de Google). Lo que suena y «A continuación»
   quedan siempre a la vista. Cualquier lista o canal se abre para ver sus canciones y elegir una sola. */
const ypGeneros=[['🪗 Vallenato','vallenato'],['💃 Salsa','salsa'],['🔥 Reggaetón','reggaeton'],['🎺 Merengue','merengue'],['🍺 Popular','musica popular'],['🎸 Rock en español','rock en español'],['🌹 Bachata','bachata'],['🌴 Champeta','champeta'],['🤠 Rancheras','rancheras'],['🎧 Electrónica','electronica']];
const ypSecciones=[['inicio','🏠','Inicio'],['buscar','🔎','Buscar'],['cola','🎵','En cola'],['canciones','❤️','Mis canciones'],['listas','📃','Mis listas'],['mio','👤','Mi YouTube']];
let ypRes=null,ypVer=null,ypMioCache={},ypSigueK='';
const ypFavs=()=>((typeof data!=='undefined'&&data&&Array.isArray(data.mzFavs))?data.mzFavs:[]);
const ypEsFav=vid=>!!vid&&ypFavs().some(x=>x.vid===vid);
const ypIso=s=>{const m=/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(s||'');return m?(+m[1]||0)*3600+(+m[2]||0)*60+(+m[3]||0):null;};
const ypImg=sn=>{const t=sn&&sn.thumbnails;return t?((t.medium||t.high||t.default||{}).url||''):'';};
function ypFav(v){
  if(typeof data==='undefined'||!data||!v||!v.vid)return;
  const l=ypFavs();
  if(l.some(x=>x.vid===v.vid)){data.mzFavs=l.filter(x=>x.vid!==v.vid);showToast('💔 Quitada de Mis canciones.');}
  else{data.mzFavs=[{vid:v.vid,title:String(v.title||v.song||'').slice(0,80),artist:String(v.artist||'').slice(0,60),dur:v.dur||null,t:Date.now()}].concat(l).slice(0,300);showToast('❤️ Guardada en Mis canciones (también en tus otros equipos).');}
  saveData();
}
function ypCorBtn(v){
  const b=document.createElement('button');b.type='button';b.className='yp-cor';
  const p=()=>{const si=ypEsFav(v.vid);b.textContent=si?'❤️':'🤍';b.title=si?'Quitar de Mis canciones':'Guardar en Mis canciones';b.setAttribute('aria-label',b.title);b.setAttribute('aria-pressed',si?'true':'false');};
  p();b.onclick=()=>{ypFav(v);p();if(ypTab==='canciones')ypCuerpo(true);ypPintar();};return b;
}
/* ---------- 🚫 Música sin comerciales con YouTube Premium ----------
   Por qué salen: el reproductor que va DENTRO de ORDEVA (como en cualquier app o página) es el de YouTube para otras
   páginas, y Google no deja iniciar sesión con la cuenta dentro de apps (lo bloquea por seguridad): ese reproductor no
   sabe que tienes Premium. Donde Premium SÍ se nota es en las apps de YouTube: el TV (vinculado a ORDEVA por código, sin
   límites) o YouTube Music en el celular. Esta guía lleva a eso con un toque. */
function mzSinComerciales(){
  let ov=$('mzScOv');
  if(!ov){ov=document.createElement('div');ov.id='mzScOv';ov.className='overlay';document.body.appendChild(ov);
    ov.addEventListener('click',e=>{
      if(e.target===ov||e.target.closest('[data-sc="x"]')){ov.classList.remove('show');return;}
      const a=e.target.closest('[data-sc]');if(!a)return;ov.classList.remove('show');
      const ir=()=>{try{ypCerrar();}catch(x){}const b=document.querySelector('nav button[data-view="musica"]')||document.querySelector('.more-tile[data-go="musica"]');if(b)b.click();};
      if(a.dataset.sc==='tv'){ir();setTimeout(()=>{try{tvTransmitirToque();}catch(x){const t=$('tvTransmitir');t&&t.click();}},350);}
      if(a.dataset.sc==='codigo'){ir();setTimeout(()=>{try{tvSinLista('En el TV: abre YouTube con tu cuenta Premium → Configuración → «Vincular con código de TV» y escribe aquí los 12 números.');}catch(x){}},350);}
      if(a.dataset.sc==='entrar'){try{window.VentoAndroid.youtubeEntrar();}catch(x){}return;}
      if(a.dataset.sc==='cuenta'){try{yConectar(false,()=>{try{ypMiasCache=null;ypMioCache={};}catch(x){}showToast('✅ Tu cuenta de YouTube quedó vinculada.');});}catch(x){showToast('No pude abrir Google. Revisa el internet.');}}
    });}
  const A=window.VentoAndroid,app=!!(A&&A.youtubeEntrar),ses=ytSesionApp(),tv=mzHayTV(),con=!!yTok();
  ov.innerHTML='<div class="modal gp-modal"><h2>🚫 Música sin comerciales con tu YouTube Premium</h2>'+
    '<div class="modal-sub"><b>Por qué salen comerciales:</b> el reproductor de ORDEVA es el de YouTube, y YouTube solo quita los comerciales cuando sabe que eres tú, con tu cuenta Premium iniciada <b>en ese mismo reproductor</b>.</div>'+
    (app?'<div class="gp-paso" style="margin:10px 0;border-color:'+(ses?'#22c55e':'#ff0033')+'"><div class="gp-n">★</div><div><b>Entra con tu cuenta Premium en esta app</b>'+
        (ses?'<span class="gp-e gp-si">✅ Ya entraste</span><div class="gp-c">YouTube ya sabe que eres tú: con tu Premium, el reproductor de ORDEVA no pone comerciales (desde la próxima canción).</div>'
            :'<div class="gp-c">Se abre la página de Google de siempre; entra con tu correo y contraseña de YouTube Premium (ORDEVA no los ve). Queda guardado en la app.<br><button type="button" class="btn-primary gp-btn" data-sc="entrar">🔑 Entrar con mi YouTube Premium</button><br><small>Si Google dice <i>«Este navegador o app no es seguro»</i>, Google no deja entrar desde apps en tu celular: usa el TV (abajo), donde tu Premium siempre funciona.</small></div>')+
      '</div></div>'
      :'<div class="gp-alerta" style="border-color:#22c55e">💻 En este navegador: entra a <b>youtube.com</b> con tu cuenta Premium (en este mismo navegador) y vuelve a ORDEVA: el reproductor usa tu sesión.</div>')+
    (tv?'<div class="gp-alerta" style="border-color:#22c55e">✅ Ya tienes un TV vinculado: la música suena allá. Si el TV tiene tu cuenta Premium, no salen comerciales.</div>':'')+
    '<div class="yp-sub" style="margin-top:12px">También en el TV (siempre funciona, sin límites)</div>'+
    '<ol class="gp-lista">'+
    '<li class="gp-paso"><div class="gp-n">1</div><div><b>En el TV, entra a YouTube con tu cuenta Premium</b><div class="gp-c">Abre la app de <b>YouTube</b> del TV → tu foto (arriba a la izquierda) → elige o agrega <b>tu cuenta con Premium</b>.</div></div></li>'+
    '<li class="gp-paso"><div class="gp-n">2</div><div><b>Vincula el TV con ORDEVA</b><div class="gp-c">Una sola vez: queda vinculado. Las canciones que pidan las mesas por QR y las que pongas tú suenan allá solas, una tras otra, <b>sin comerciales y sin límite</b> (no gasta el cupo de Google).'+
      '<br><button type="button" class="btn-primary gp-btn" data-sc="tv">📡 Buscar mi TV</button> <button type="button" class="btn-ghost gp-btn" data-sc="codigo">🔢 Con el código del TV</button></div></div></li>'+
    '<li class="gp-paso"><div class="gp-n">3</div><div><b>Tu cuenta de YouTube en ORDEVA (para tus listas)</b><div class="gp-c">Con tu cuenta conectada ves y pones tus listas, tus «Me gusta» y tus suscripciones (👤 Mi YouTube). Queda vinculada para siempre.'+
      (con?'<br>✅ <b>Ya está conectada.</b>':'<br><button type="button" class="btn-ghost gp-btn" data-sc="cuenta">🔗 Conectar mi cuenta de YouTube</button>')+'</div></div></li>'+
    '</ol>'+
    '<div class="settings-desc" style="margin-top:8px"><b>¿Sin TV?</b> Conecta el celular o el computador a un parlante Bluetooth y usa <b>YouTube Music</b> con tu Premium: ORDEVA pasa las canciones a tu lista «Música '+esc((typeof data!=='undefined'&&data&&data.businessName)||'del local')+'» (Música → «Lista de YouTube Music»). Ojo: Google pone un tope diario a esa forma; cuando se llena, ORDEVA sigue con su reproductor (con comerciales) hasta el otro día.'+
'</div>'+
    '<div class="modal-actions"><button type="button" class="btn-close" data-sc="x">Listo</button></div></div>';
  ov.classList.add('show');
}
window.vitoSinComerciales=mzSinComerciales;
// ¿La app Android ya tiene la sesión de YouTube (las cookies del reproductor)?
function ytSesionApp(){try{const A=window.VentoAndroid;return !!(A&&A.youtubeSesion&&A.youtubeSesion());}catch(e){return false;}}
// La app Android avisa al cerrar la pantalla de Google.
window.ventoYouTubeSesion=ok=>{
  if(ok){showToast('✅ Entraste con tu YouTube Premium en la app: desde la próxima canción el reproductor de ORDEVA no pone comerciales.',9000);try{ypPintar();}catch(e){}}
  else{showToast('⚠️ No quedó la sesión de YouTube. Si Google dijo que la app no es segura, Google no deja entrar desde apps en tu celular: usa el YouTube de tu TV (sin comerciales y sin límite).',11000);
    try{window.ventoError&&window.ventoError('musica','No se pudo entrar a YouTube dentro de la app',{},'musica|login-youtube-app');}catch(e){}}
  try{if($('mzScOv')&&$('mzScOv').classList.contains('show'))mzSinComerciales();}catch(e){}
};
function ypCrear(){
  if($('ypOv'))return;
  const ov=document.createElement('div');ov.id='ypOv';ov.className='overlay yp-ov';
  ov.innerHTML='<div class="yp" role="dialog" aria-label="Panel de YouTube">'+
    '<div class="yp-head"><span class="yp-logo" aria-hidden="true"><i>▶</i><span>YouTube</span></span>'+
      '<form class="yp-buscar yp-hbuscar" id="ypBuscarF" role="search"><input type="search" id="ypQ" placeholder="Buscar canción, artista o video" autocomplete="off" enterkeyhint="search" aria-label="Buscar en YouTube"><button type="submit" class="btn-primary" aria-label="Buscar">🔎<span class="yp-bt-txt"> Buscar</span></button></form>'+
      '<button type="button" class="yp-x" id="ypCerrar" aria-label="Cerrar">✕</button></div>'+
    '<div class="yp-main">'+
      '<div class="yp-nav" role="tablist" aria-label="Secciones">'+ypSecciones.map(([k,i,t])=>'<button type="button" role="tab" data-yp-tab="'+k+'"><span class="yp-ni">'+i+'</span><span class="yp-nt">'+t+'</span>'+(k==='cola'?'<span id="ypNCola" class="yp-nn"></span>':'')+'</button>').join('')+'</div>'+
      '<section class="yp-lado" aria-label="Lo que suena">'+
        '<div class="yp-video" id="ypVideo"><img id="ypPortada" alt=""><div class="yp-nada" id="ypNada">🎵 No está sonando nada.<br><small>Busca una canción o pon una de tus listas.</small></div></div>'+
        '<div class="yp-ahora"><div class="yp-info"><div class="yp-titulo" id="ypTitulo"></div><div class="yp-quien" id="ypQuien"></div><div class="yp-donde" id="ypDonde"></div><div class="yp-bar"><i id="ypBar"></i></div><div class="yp-tiempo" id="ypTiempo"></div></div>'+
        '<div class="yp-ctrl"><button type="button" class="yp-cor" id="ypCor" hidden>🤍</button><button type="button" class="btn-ghost" id="ypPausa">⏯<span class="yp-bt-txt"> Pausa</span></button><button type="button" class="btn-primary" id="ypSig">⏭<span class="yp-bt-txt"> Siguiente</span></button></div></div>'+
        '<button type="button" class="btn-primary yp-tocar" id="ypTocar" hidden>▶ Toca aquí para que suene</button>'+
        '<div class="yp-mq" id="ypMq" hidden><span id="ypMqTxt"></span><button type="button" class="btn-ghost" id="ypMqYo">🎶 Que suene aquí</button></div>'+
        '<button type="button" class="yp-sc" id="ypSc" hidden>🚫 ¿Salen comerciales? Entra con tu YouTube Premium <b>›</b></button>'+
        '<div class="yp-sigue" id="ypSigue"></div>'+
      '</section>'+
      '<div class="yp-cuerpo" id="ypCuerpo"></div>'+
    '</div></div>';
  document.body.appendChild(ov);
  $('ypCerrar').onclick=ypCerrar;ov.addEventListener('click',e=>{if(e.target===ov)ypCerrar();});
  ov._fin=()=>ypCerrar();
  $('ypSig').onclick=()=>{if(!mzActual()&&!ordenJusto(cola()).length)return showToast('No hay más canciones en la cola.');mzSaltar();setTimeout(ypPintar,300);};
  $('ypPausa').onclick=ypPausa;
  $('ypSc').onclick=mzSinComerciales;
  $('ypTocar').onclick=ypTocarSonar;
  $('ypMqYo').onclick=()=>{mqElegir(true);ypSigueK='';ypPintar();};
  $('ypCor').onclick=()=>{const x=mzActual();if(x&&x.vid){ypFav(x);ypPintar();if(ypTab==='canciones')ypCuerpo(true);}};
  $('ypBuscarF').onsubmit=e=>{e.preventDefault();ypBuscar($('ypQ').value);};
  ov.querySelectorAll('[data-yp-tab]').forEach(b=>b.onclick=()=>{ypTab=b.dataset.ypTab;ypVer=null;ypCuerpo();if(ypTab==='buscar'&&!ypRes)setTimeout(()=>{try{$('ypQ').focus();}catch(e){}},30);});
  // El video sigue al recuadro aunque se mueva cualquier parte de la ventana (scroll no burbujea: se escucha en captura).
  ov.addEventListener('scroll',ypUbicar,{passive:true,capture:true});
}
// ¿El video de este equipo está cargado pero quieto (sin pausa a mano)? → el navegador no lo dejó arrancar solo.
function ypNeedSt(){try{return yPl&&yPl.getPlayerState?yPl.getPlayerState():-2;}catch(e){return -2;}}
function ypNecesitaToque(){
  const a=mzActual();if(!a||a.fuente!=='app'||!sonando||!cargadoEn||pausaManual)return false;
  const st=ypNeedSt();return (st===-1||st===5||st===2)&&Date.now()-cargadoEn>4000;
}
function ypTocarSonar(){
  gestoUsuario=true;pausaManual=false;
  const a=mzActual(),st=ypNeedSt();
  try{if((st===-1||st===5)&&a&&a.vid)yPl.loadVideoById(a.vid);else yPl.playVideo();}catch(e){}   // dentro del toque: el navegador sí deja
  cargadoEn=Date.now();
  try{window.ventoError&&window.ventoError('musica','El navegador no dejó sonar solo: hubo que tocar',{estado:st,diag:window.vitoMusicaDiag&&window.vitoMusicaDiag()},'musica|autoplay');}catch(e){}
  setTimeout(()=>{try{ypPintar();}catch(e){}},600);
}
function ypPausa(){
  if(mqOtro()){mqPub({t:'cmd',a:'pausa'});showToast('⏯ Enviado a «'+mqNombre()+'».');return;}
  const f=ypFuente();
  if(f==='app'&&yPl&&yPl.getPlayerState){try{if(yPl.getPlayerState()===1){yPl.pauseVideo();showToast('⏸ En pausa.');}else{yPl.playVideo();showToast('▶ Sigue sonando.');}}catch(e){}return;}
  if((f==='tvyt'||f==='cc')&&$('tvvPausa')){$('tvvPausa').click();return;}
  showToast(f==='ytmusic'?'La pausa se hace en YouTube Music.':'No hay nada sonando.');
}
function ypAbrir(tab){
  ypCrear();if(tab){ypTab=tab;ypVer=null;}ypAbierto=true;$('ypOv').classList.add('show');document.body.classList.add('yp-abierto');ypSigueK='';ypPintar();ypCuerpo();
  try{if(AUTO()&&!yPl)cargarAPI();}catch(e){}
  setTimeout(ypUbicar,30);
}
function ypCerrar(){ypAbierto=false;const o=$('ypOv');if(o)o.classList.remove('show');document.body.classList.remove('yp-abierto');ypUbicar();ypMiniPintar();}
function ypPintar(){
  if(!ypAbierto)return;
  const x=mzActual(),f=ypFuente(),b=$('ytBox');
  $('ypDonde').textContent=ypDonde(f);
  const conVideo=f==='app'&&b&&!b.hidden;
  $('ypPortada').src=x&&x.vid&&!conVideo?ypMini_(x.vid).replace('mqdefault','hqdefault'):'';$('ypPortada').hidden=!(x&&x.vid&&!conVideo);
  $('ypNada').hidden=!!x;$('ypVideo').classList.toggle('yp-vacio',!x);
  $('ypTitulo').textContent=x?(x.title||x.song):'';
  $('ypQuien').textContent=x?[x.artist,mzEtq(x)].filter(Boolean).join(' · '):'';
  let t=x?(x.playedSeconds||0):0;
  if(x&&(x.fuente==='ytmusic'||(x.fuente==='tvyt'&&!x.progresoAt))&&x.startedAt)t=Math.round((Date.now()-x.startedAt)/1000);else if(x&&x.progresoAt)t+=Math.round((Date.now()-x.progresoAt)/1000);
  if(x&&x.dur)t=Math.min(t,x.dur);
  if(f==='app'&&yPl&&yPl.getCurrentTime){try{t=yPl.getCurrentTime();}catch(e){}}
  $('ypBar').style.width=(x&&x.dur?Math.min(100,t/x.dur*100):0).toFixed(1)+'%';
  $('ypTiempo').textContent=x?mmss(t)+' / '+(x.dur?mmss(x.dur):'--:--'):'';
  $('ypPausa').hidden=!(f==='app'||f==='tvyt'||f==='cc'||f==='remoto');
  $('ypSc').hidden=!(f==='app'||(!x&&!mzHayTV()))||ytSesionApp();
  // El navegador no dejó arrancar solo el video (bloqueo de reproducción automática): un toque lo arranca.
  $('ypTocar').hidden=!ypNecesitaToque();
  // Otro equipo pone la música: dónde suena y «Que suene aquí».
  const mq=$('ypMq');if(mq){const otro=mqOtro();mq.hidden=!otro;if(otro)$('ypMqTxt').textContent='🔊 La música suena en «'+mqNombre()+'»'+(mqVisto&&Date.now()-mqVisto<9e4?'.':' (no responde).');}
  const cor=$('ypCor');cor.hidden=!(x&&x.vid);if(x&&x.vid){const si=ypEsFav(x.vid);cor.textContent=si?'❤️':'🤍';cor.title=si?'Quitar de Mis canciones':'Guardar en Mis canciones';cor.setAttribute('aria-label',cor.title);}
  const o=ordenJusto(cola());$('ypNCola').textContent=o.length?String(o.length):'';
  // «A continuación» (solo se vuelve a pintar si cambió)
  const k=o.slice(0,6).map(y=>y.id+(y.primero?'p':'')).join(',');
  if(k!==ypSigueK){ypSigueK=k;const s=$('ypSigue');s.innerHTML='';
    const h=document.createElement('div');h.className='yp-sub';h.textContent='A continuación'+(o.length?' ('+o.length+')':'');s.appendChild(h);
    if(!o.length){const e=document.createElement('div');e.className='empty-note';e.textContent='Nada en cola. Busca arriba o pon una de tus listas; las mesas piden con el QR.';s.appendChild(e);}
    o.slice(0,6).forEach((y,i)=>{const d=document.createElement('div');d.className='yp-mfila';d.innerHTML=(y.vid?'<img src="'+esc(ypMini_(y.vid))+'" alt="" loading="lazy">':'<span class="yp-sinimg">🎵</span>')+'<span class="yp-txt"><b>'+esc((i+1)+'. '+(y.title||y.song))+'</b><small>'+esc(mzEtq(y)+(y.primero?' · ⏭ va primero':''))+'</small></span>';s.appendChild(d);});
    if(o.length>6){const m=ypBtn('Ver toda la cola ('+o.length+') →',()=>{ypTab='cola';ypVer=null;ypCuerpo();});m.classList.add('yp-vermas');s.appendChild(m);}
  }
  ypUbicar();
}
setInterval(()=>{try{ypPintar();ypMiniPintar();}catch(e){}},1000);
window.addEventListener('resize',()=>{try{ypUbicar();}catch(e){}});
// ---------- Secciones ----------
// mantener=true: se rehace la lista (llegó una canción, se agregaron varias, ❤️) SIN volver arriba. Antes cada canción que
// pedía una mesa mandaba la cola al principio mientras uno bajaba.
function ypCuerpo(mantener){
  const c=$('ypCuerpo');if(!c)return;
  const antes=mantener?c.scrollTop:0;
  document.querySelectorAll('#ypOv [data-yp-tab]').forEach(b=>{const on=b.dataset.ypTab===ypTab;b.classList.toggle('on',on);b.setAttribute('aria-selected',on?'true':'false');});
  c.innerHTML='';c.scrollTop=0;c.__vScroll=null;
  if(ypVer)ypVerUI(c);
  else if(ypTab==='inicio')ypInicioUI(c);else if(ypTab==='buscar')ypBuscarUI(c);else if(ypTab==='listas')ypListasUI(c);
  else if(ypTab==='canciones')ypCancionesUI(c);else if(ypTab==='mio')ypMioUI(c);else ypColaUI(c);
  if(antes){c.scrollTop=antes;requestAnimationFrame(()=>{c.scrollTop=antes;});}
  setTimeout(ypUbicar,30);
}
const ypBtn=(t,fn,cls)=>{const b=document.createElement('button');b.type='button';b.className=cls||'btn-ghost';b.textContent=t;b.onclick=()=>fn(b);return b;};
const ypTit=(c,t,extra)=>{const h=document.createElement('div');h.className='yp-sec';const s=document.createElement('h3');s.textContent=t;h.appendChild(s);(extra||[]).forEach(x=>h.appendChild(x));c.appendChild(h);return h;};
const ypNota=(c,t)=>{const e=document.createElement('div');e.className='empty-note';e.textContent=t;c.appendChild(e);return e;};
function ypFila(img,titulo,sub,botones){
  const d=document.createElement('div');d.className='yp-fila';
  d.innerHTML=(img?'<img src="'+esc(img)+'" alt="" loading="lazy">':'<span class="yp-sinimg">🎵</span>')+'<span class="yp-txt"><b>'+esc(titulo)+'</b><small>'+esc(sub||'')+'</small></span>';
  const bb=document.createElement('span');bb.className='yp-bts';botones.forEach(x=>bb.appendChild(x));d.appendChild(bb);return d;
}
// Tarjeta de un video, como en YouTube: portada grande con la duración, título, canal y los botones.
function ypCard(v,extra){
  const d=document.createElement('div');d.className='yp-fila yp-card';
  d.innerHTML='<div class="yp-th">'+(v.vid?'<img src="'+esc(ypMini_(v.vid))+'" alt="" loading="lazy">':'<span class="yp-sinimg">🎵</span>')+(v.dur?'<span class="yp-dur">'+mmss(v.dur)+'</span>':'')+'</div>'+
    '<span class="yp-txt"><b>'+esc(v.title||'')+'</b><small>'+esc([v.artist,extra].filter(Boolean).join(' · '))+'</small></span>';
  const bb=document.createElement('span');bb.className='yp-bts';
  bb.append(ypBtn('⏭ Que siga',()=>ypAgregar(v,true),'btn-primary'),ypBtn('➕ Cola',()=>ypAgregar(v,false)),ypCorBtn(v));
  d.appendChild(bb);
  d.querySelector('.yp-th').onclick=()=>ypAgregar(v,true);d.querySelector('.yp-th').title='Que siga';
  return d;
}
const ypGrid=(c,id)=>{const g=document.createElement('div');g.className='yp-grid';if(id)g.id=id;c.appendChild(g);return g;};
// Canción elegida en el panel → a la cola (con «primero», va de primera). Suena por el camino de siempre
// (reproductor de la app, el TV o YouTube Music).
function ypAgregar(v,primero,callado,idFijo){
  const now=Date.now(),l=cola();
  if(l.some(x=>!x.done&&x.vid===v.vid)){if(!callado)showToast('🎵 «'+v.title+'» ya está en la cola.');return false;}
  // «Wiz Khalifa - Yiccen» con canal «Wiz Khalifa»: no se repite el artista («Wiz Khalifa - Wiz Khalifa - …»).
  const conArt=v.artist&&!fiAscii(String(v.title||'')).toLowerCase().includes(fiAscii(String(v.artist).replace(/\s*-\s*topic$/i,'').replace(/vevo$/i,'')).toLowerCase().trim());
  const it={id:idFijo||(now+'-'+Math.random().toString(36).slice(2,6)),reqId:null,mesa:0,mesaNombre:tableLabel(0),song:(conArt?v.artist+' - ':'')+v.title,pedido:v.title,
    title:String(v.title||'').slice(0,80),artist:String(v.artist||'').slice(0,60),vid:v.vid,dur:v.dur||ytDurCache[v.vid]||null,ts:now,done:false,status:'pending',panel:true};
  if(primero)it.primero=now;
  // El equipo que pone la música no responde (cerrado o sin internet): este equipo la toma, para que no quede en silencio.
  if(mqOtro()&&Date.now()-mqDesde>15e3&&Date.now()-mqVisto>9e4){const era=mqNombre();try{mqElegir(true);}catch(e){}
    showToast('🎶 «'+era+'» no respondía: ahora la música suena en este equipo.',8000);}
  // Nada suena en este equipo y la elegiste con «Que siga»: suena YA, dentro del mismo toque (sin esperar la revisión
  // de fondo). Así el navegador (Brave, Chrome…) deja sonar con audio; si la versión no se deja poner, se cambia sola.
  const yaSuena=mzActual();
  if(primero&&!mqOtro()&&!mzHayTV()&&!(yaSuena&&yaSuena.fuente==='app'))it.ok=true;
  l.push(it);SS('vito_cola',l);mzRespaldo();
  // Otro equipo pone la música: se le manda allá (aquí queda en la cola mientras llega la respuesta).
  if(mqOtro()){mqPub({t:'cmd',a:'add',id:it.id,pr:primero?1:0,v:{vid:it.vid,title:it.title,artist:it.artist,dur:it.dur}});
    if(!callado)showToast((primero?'⏭ «':'➕ «')+it.title+'» → suena en «'+mqNombre()+'»'+(primero?' después de la actual.':'.'));try{renderMusica();}catch(e){}ypPintar();return true;}
  try{mzAsegurarReproductor();}catch(e){}                  // que suene de verdad (antes quedaba en la cola sin sonar)
  try{ytAgregar(it.id);}catch(e){}try{tvPublicar();}catch(e){}try{verificarCola();}catch(e){}try{siguienteAuto();}catch(e){}
  try{renderMusica();}catch(e){}
  if(!callado)showToast(primero?'⏭ «'+it.title+'» suena después de la actual.':'➕ «'+it.title+'» a la cola.');
  ypPintar();return true;
}
function ypPonerVarias(l,nombre){
  const ya=mzActual();let n=0;l.forEach(v=>{if(v&&v.vid&&!(ya&&ya.vid===v.vid)&&ypAgregar(v,false,true))n++;});   // la que suena no se repite
  showToast(n?'➕ '+n+' canci'+(n===1?'ón':'ones')+(nombre?' de «'+nombre+'»':'')+' a la cola.':'🎵 Esas canciones ya están en la cola.');
  if(ypTab==='cola')ypCuerpo(true);
}
const ypChips=(c,lista)=>{const r=document.createElement('div');r.className='yp-chips';lista.forEach(([t,q])=>r.appendChild(ypBtn(t,()=>ypBuscar(q),'yp-chip')));c.appendChild(r);return r;};
async function ypBuscar(q){
  q=String(q||'').replace(/\s+/g,' ').trim();if(!q){try{$('ypQ').focus();}catch(e){}return;}
  ypCrear();$('ypQ').value=q;ypTab='buscar';ypVer=null;const yo=ypRes={q,items:null};ypCuerpo();
  let items=[];
  try{const j=await ySrvBuscar(encodeURIComponent(q));items=(j&&j.items)||[];}catch(err){}
  if(!items.length){try{const j=await yGet('search?part=snippet&type=video&videoEmbeddable=true&maxResults=20&q='+encodeURIComponent(q));items=(j&&j.items)||[];}catch(err){}}
  yo.items=items.filter(x=>x&&x.id&&x.id.videoId).slice(0,24).map(x=>{const sn=x.snippet||{};return{vid:x.id.videoId,title:sn.title||q,artist:sn.channelTitle||'',dur:x.duracion||ytDurCache[x.id.videoId]||null};});
  if(ypRes===yo&&ypTab==='buscar'&&!ypVer&&ypAbierto)ypCuerpo();
}
function ypBuscarUI(c){
  if(!ypRes){
    ypTit(c,'🔎 Buscar en YouTube');
    ypNota(c,'Escribe arriba una canción, un artista o un video y toca 🔎. «⏭ Que siga» la pone después de la que suena; «➕ Cola» la deja en su turno; 🤍 la guarda en Mis canciones.');
    ypChips(c,ypGeneros);return;
  }
  ypTit(c,'Resultados de «'+ypRes.q+'»');
  ypChips(c,ypGeneros);
  const R=ypGrid(c,'ypRes');
  if(ypRes.items===null){R.innerHTML='<div class="empty-note">⏳ Buscando «'+esc(ypRes.q)+'»…</div>';return;}
  if(!ypRes.items.length){R.innerHTML='<div class="empty-note">No encontré canciones con «'+esc(ypRes.q)+'». Prueba con otras palabras.</div>';return;}
  ypRes.items.forEach(v=>R.appendChild(ypCard(v)));
}
// Historial de lo que sonó (sin repetir) y las que más suenan aquí.
function ypHistorial(){
  const vistos=new Set(),out=[];
  mzHist().slice().sort((a,b)=>(b.startedAt||b.ts||0)-(a.startedAt||a.ts||0)).forEach(x=>{if(!x.vid||vistos.has(x.vid)||!['played','playing','skipped'].includes(x.status))return;vistos.add(x.vid);out.push({vid:x.vid,title:x.title||x.song,artist:x.artist||'',dur:x.dur||null,mesa:x});});
  return out;
}
function ypMasSonadas(){
  const cnt={},info={};
  mzHist().forEach(x=>{if(!x.vid||x.status!=='played')return;cnt[x.vid]=(cnt[x.vid]||0)+1;info[x.vid]=info[x.vid]||{vid:x.vid,title:x.title||x.song,artist:x.artist||'',dur:x.dur||null};});
  return Object.keys(cnt).filter(v=>cnt[v]>=2).sort((a,b)=>cnt[b]-cnt[a]).slice(0,12).map(v=>Object.assign({n:cnt[v]},info[v]));
}
function ypInicioUI(c){
  ypTit(c,'🏠 Inicio');
  ypChips(c,ypGeneros);
  const fav=ypFavs();
  ypTit(c,'❤️ Mis canciones',fav.length>8?[ypBtn('Ver todas ('+fav.length+') →',()=>{ypTab='canciones';ypCuerpo();},'yp-vermas')]:[]);
  if(!fav.length)ypNota(c,'Toca 🤍 en cualquier canción para guardarla aquí. Quedan guardadas en todos tus equipos.');
  else{const g=ypGrid(c);fav.slice(0,8).forEach(v=>g.appendChild(ypCard(v)));}
  const h=ypHistorial();
  if(h.length){ypTit(c,'🕘 Sonaron hace poco',h.length>8?[ypBtn('Ver más →',()=>{ypTab='canciones';ypCuerpo();},'yp-vermas')]:[]);const g=ypGrid(c);h.slice(0,8).forEach(v=>g.appendChild(ypCard(v,mzEtq(v.mesa))));}
  const L=mzListas();
  ypTit(c,'📃 Mis listas',[ypBtn('Ver todas →',()=>{ypTab='listas';ypCuerpo();},'yp-vermas')]);
  if(!L.length)ypNota(c,'Pega el link de una playlist en «📃 Mis listas» o conecta tu cuenta en «👤 Mi YouTube».');
  else{const g=document.createElement('div');g.className='yp-lista';L.slice(0,6).forEach(x=>g.appendChild(ypListaFila(x.id,x.nombre,x.n,'')));c.appendChild(g);}
}
function ypCancionesUI(c){
  const fav=ypFavs();
  ypTit(c,'❤️ Mis canciones ('+fav.length+')',fav.length?[ypBtn('▶ Poner todas',()=>ypPonerVarias(fav,'Mis canciones'),'btn-primary'),ypBtn('🔀 Al azar',()=>ypPonerVarias(mzMezclar(fav),'Mis canciones'))]:[]);
  if(!fav.length)ypNota(c,'Todavía no has guardado canciones. Toca 🤍 en un resultado, en la cola o en la que está sonando.');
  else{const g=ypGrid(c);fav.forEach(v=>g.appendChild(ypCard(v)));}
  const top=ypMasSonadas();
  if(top.length){ypTit(c,'🔥 Las que más suenan aquí');const g=ypGrid(c);top.forEach(v=>g.appendChild(ypCard(v,v.n+' veces')));}
  const h=ypHistorial();
  ypTit(c,'🕘 Historial');
  if(!h.length)ypNota(c,'Aquí salen las canciones que ya sonaron.');
  else{const g=ypGrid(c);h.slice(0,40).forEach(v=>g.appendChild(ypCard(v,mzEtq(v.mesa))));}
}
// Una lista (guardada, de la cuenta o de un canal): «▶ Poner» la pone de fondo; «👁 Ver» muestra sus canciones.
function ypListaFila(id,nombre,n,sub,img){
  return ypFila(img||'',nombre,[(n!=null&&n!==''?n+' canciones':''),sub].filter(Boolean).join(' · '),[
    ypBtn('▶ Poner',async b=>{if(await mzPonerLista(id,nombre,b))ypCuerpo();},'btn-primary'),
    ypBtn('👁 Ver',()=>{ypVer={id,nombre,vuelve:ypTab};ypCuerpo();})]);
}
async function ypVerUI(c){
  const V=ypVer;
  ypTit(c,'📃 '+(V.nombre||'Lista'),[ypBtn('← Volver',()=>{ypVer=null;ypTab=V.vuelve||ypTab;ypCuerpo();})]);
  const acc=document.createElement('div');acc.className='yp-acc';c.appendChild(acc);
  const g=ypGrid(c);g.innerHTML='<div class="empty-note">⏳ Trayendo las canciones…</div>';
  if(!V.vids){const L=await mzLeerLista(V.id);if(ypVer!==V)return;V.vids=L?L.vids.map(x=>({vid:x.v,title:x.t,artist:x.c,dur:x.d||null})):[];if(L&&L.titulo&&!V.nombre)V.nombre=L.titulo;}
  g.innerHTML='';
  if(!V.vids.length){g.innerHTML='<div class="empty-note">⚠️ No pude leer esta lista. Revisa que sea pública (o «no listada») o conecta tu cuenta de YouTube si es privada.</div>';return;}
  acc.append(ypBtn('▶ Poner toda de fondo ('+V.vids.length+')',async b=>{if(await mzPonerLista(V.id,V.nombre,b)){ypVer=null;ypTab='listas';ypCuerpo();}},'btn-primary'),ypBtn('➕ Todas a la cola',()=>ypPonerVarias(V.vids.slice(0,50),V.nombre)),ypBtn('➕ Guardar en Mis listas',()=>{mzGuardarLista(V.id,V.nombre,V.vids.length);showToast('📃 Guardada en tus listas.');}));
  V.vids.forEach(v=>g.appendChild(ypCard(v)));
}
function ypListasUI(c){
  const F=mzF();
  ypTit(c,'📃 Mis listas');
  if(F&&F.on){const d=document.createElement('div');d.className='yp-fondo';d.innerHTML='🎶 De fondo: <b>'+esc(F.nombre||'Tu lista')+'</b> · canción '+Math.min((F.pos||0),(F.vids||[]).length)+' de '+(F.vids||[]).length+' ';d.appendChild(ypBtn('⏹ Quitar',()=>{mzFondoQuitar();ypCuerpo();}));c.appendChild(d);}
  const f=document.createElement('form');f.className='yp-buscar';
  f.innerHTML='<input type="search" id="ypLq" placeholder="Pega el link de tu lista o escribe un nombre" autocomplete="off"><button type="submit" class="btn-primary">▶ Poner</button>';
  const R=document.createElement('div');R.className='yp-lista';
  f.onsubmit=async e=>{
    e.preventDefault();const q=$('ypLq').value.trim();if(!q)return;const id=mzListaId(q),bt=f.querySelector('button');
    if(id){if(await mzPonerLista(id,'',bt)){$('ypLq').value='';ypCuerpo();}return;}
    R.innerHTML='<div class="empty-note">⏳ Buscando listas…</div>';
    const j=await mzSrv('/yt/buscar?tipo=lista&q='+encodeURIComponent(q));
    const items=(j&&Array.isArray(j.items)?j.items:[]).filter(x=>x&&x.id&&x.id.playlistId).slice(0,12);R.innerHTML='';
    if(!items.length){R.innerHTML='<div class="empty-note">No encontré listas con ese nombre. Pega el link de la lista (en YouTube: Compartir → Copiar enlace).</div>';return;}
    items.forEach(x=>{const nombre=(x.snippet&&x.snippet.title)||'Lista';
      R.appendChild(ypFila(ypImg(x.snippet),nombre,[(x.canciones?x.canciones+' canciones':''),(x.snippet&&x.snippet.channelTitle)||''].filter(Boolean).join(' · '),[ypBtn('▶ Poner',async b=>{if(await mzPonerLista(x.id.playlistId,nombre,b))ypCuerpo();},'btn-primary'),ypBtn('👁 Ver',()=>{ypVer={id:x.id.playlistId,nombre,vuelve:'listas'};ypCuerpo();}),ypBtn('➕ Guardar',()=>{mzGuardarLista(x.id.playlistId,nombre,x.canciones);showToast('📃 Guardada en tus listas.');ypCuerpo();})]));});
  };
  c.append(f,R);
  // Guardadas en ORDEVA (llegan a todos los equipos)
  const g=mzListas();
  ypTit(c,'📃 Mis listas guardadas');
  const G=document.createElement('div');G.className='yp-lista';c.appendChild(G);
  if(!g.length)ypNota(G,'Todavía no hay listas guardadas. Pega un link arriba o cárgalas de tu cuenta de YouTube.');
  g.forEach(L=>G.appendChild(ypListaFila(L.id,L.nombre,L.n,F&&F.on&&F.id===L.id?'🎶 sonando':'')));
  // Las listas de la cuenta de YouTube (con Google conectado)
  ypTit(c,'▶️ Listas de mi cuenta de YouTube');
  const M=document.createElement('div');M.className='yp-lista';c.appendChild(M);
  ypMiasUI(M);
}
function ypConectarUI(M,txt){
  ypNota(M,txt||'Conecta tu cuenta de YouTube (Google) para ver aquí tus listas de reproducción y ponerlas con un toque.');
  M.appendChild(ypBtn('🔗 Conectar mi cuenta de YouTube',()=>{try{yConectar(false,()=>{ypMiasCache=null;ypMioCache={};ypCuerpo();});}catch(e){showToast('No pude abrir Google. Revisa el internet.');}},'btn-primary'));
}
function ypMiasUI(M){
  if(!yTok())return ypConectarUI(M);
  const pintarMias=items=>{M.innerHTML='';
    if(!items.length){M.innerHTML='<div class="empty-note">Tu cuenta de YouTube no tiene listas todavía.</div>';return;}
    items.forEach(x=>{const nombre=(x.snippet&&x.snippet.title)||'Lista',n=x.contentDetails&&x.contentDetails.itemCount;
      M.appendChild(ypFila(ypImg(x.snippet),nombre,(n!=null?n+' canciones':'')+(x.status&&x.status.privacyStatus==='private'?' · 🔒 privada':''),[ypBtn('▶ Poner',async b=>{if(await mzPonerLista(x.id,nombre,b))ypCuerpo();},'btn-primary'),ypBtn('👁 Ver',()=>{ypVer={id:x.id,nombre,vuelve:ypTab};ypCuerpo();}),ypBtn('➕ Guardar',()=>{mzGuardarLista(x.id,nombre,n);showToast('📃 Guardada en tus listas.');ypCuerpo();})]));});
  };
  if(ypMiasCache){pintarMias(ypMiasCache);return;}
  M.innerHTML='<div class="empty-note">⏳ Trayendo tus listas de YouTube…</div>';
  yApi('playlists?part=snippet,contentDetails,status&mine=true&maxResults=50').then(j=>{ypMiasCache=(j&&j.items)||[];pintarMias(ypMiasCache);})
    .catch(e=>{M.innerHTML='<div class="empty-note">⚠️ No pude traer tus listas: '+esc(e&&e.message||'error')+'. Vuelve a conectar Google.</div>';});
}
// «👤 Mi YouTube»: lo de la cuenta de Google conectada (listas, «Me gusta», mis videos y suscripciones).
function ypMioUI(c){
  if(!yTok()){ypTit(c,'👤 Mi YouTube');const M=document.createElement('div');c.appendChild(M);ypConectarUI(M,'Conecta tu cuenta de YouTube (Google) para ver aquí TU contenido: tus listas (también las privadas), los videos que te gustan, tus videos y los canales a los que estás suscrito.');return;}
  const cab=ypTit(c,'👤 Mi YouTube');
  const trae=(k,ruta)=>ypMioCache[k]?Promise.resolve(ypMioCache[k]):yApi(ruta).then(j=>(ypMioCache[k]=j||{}));
  const bloque=(t)=>{ypTit(c,t);const d=document.createElement('div');c.appendChild(d);d.innerHTML='<div class="empty-note">⏳ Cargando…</div>';return d;};
  const falla=(d,e)=>{d.innerHTML='<div class="empty-note">⚠️ '+esc(e&&e.message||'No se pudo cargar')+'. Si sigue, vuelve a conectar Google.</div>';};
  const Ls=bloque('📃 Mis listas de YouTube');Ls.className='yp-lista';ypMiasUI(Ls);
  const Lk=bloque('👍 Videos que me gustan');
  trae('like','videos?part=snippet,contentDetails&myRating=like&maxResults=24').then(j=>{Lk.innerHTML='';const it=(j.items||[]);if(!it.length){ypNota(Lk,'Todavía no le has dado «Me gusta» a ningún video.');return;}
    Lk.className='yp-grid';it.forEach(x=>{const sn=x.snippet||{},d=ypIso(x.contentDetails&&x.contentDetails.duration);if(d)ytDurCache[x.id]=d;Lk.appendChild(ypCard({vid:x.id,title:sn.title||'',artist:sn.channelTitle||'',dur:d}));});}).catch(e=>falla(Lk,e));
  const Up=bloque('📤 Mis videos');
  trae('canal','channels?part=snippet,contentDetails&mine=true').then(j=>{const ch=(j.items||[])[0];
    if(ch&&ch.snippet){const s=document.createElement('span');s.className='yp-canal';s.innerHTML=(ypImg(ch.snippet)?'<img src="'+esc(ypImg(ch.snippet))+'" alt="">':'')+'<b>'+esc(ch.snippet.title||'')+'</b>';cab.appendChild(s);}
    const up=ch&&ch.contentDetails&&ch.contentDetails.relatedPlaylists&&ch.contentDetails.relatedPlaylists.uploads;
    if(!up){Up.innerHTML='';ypNota(Up,'Tu canal no tiene videos subidos.');return;}
    Up.innerHTML='';Up.appendChild(ypBtn('👁 Ver mis videos',()=>{ypVer={id:up,nombre:'Mis videos',vuelve:'mio'};ypCuerpo();},'btn-primary'));}).catch(e=>falla(Up,e));
  const Sb=bloque('📺 Mis suscripciones');
  trae('subs','subscriptions?part=snippet&mine=true&maxResults=50&order=alphabetical').then(j=>{Sb.innerHTML='';const it=(j.items||[]);if(!it.length){ypNota(Sb,'No estás suscrito a ningún canal.');return;}
    Sb.className='yp-subs';it.forEach(x=>{const sn=x.snippet||{},chId=sn.resourceId&&sn.resourceId.channelId;if(!chId)return;const b=document.createElement('button');b.type='button';b.className='yp-sch';
      b.innerHTML=(ypImg(sn)?'<img src="'+esc(ypImg(sn))+'" alt="" loading="lazy">':'<span class="yp-sinimg">📺</span>')+'<span>'+esc(sn.title||'Canal')+'</span>';
      // Los videos de un canal están en su lista de «subidos» (UU…): se leen como cualquier lista.
      b.onclick=()=>{ypVer={id:'UU'+chId.slice(2),nombre:sn.title||'Canal',vuelve:'mio'};ypCuerpo();};Sb.appendChild(b);});}).catch(e=>falla(Sb,e));
}
function ypColaUI(c){
  const x=mzActual(),o=ordenJusto(cola());
  if(x){ypTit(c,'▶ Sonando');const L=document.createElement('div');L.className='yp-lista';c.appendChild(L);L.appendChild(ypFila(ypMini_(x.vid),x.title||x.song,mzEtq(x),x.vid?[ypCorBtn({vid:x.vid,title:x.title||x.song,artist:x.artist,dur:x.dur})]:[]));}
  ypTit(c,'⏳ Siguen ('+o.length+')');
  if(!o.length){ypNota(c,'No hay canciones en cola. Busca arriba o pon una de tus listas; las mesas piden con el QR.');return;}
  const L=document.createElement('div');L.className='yp-lista';c.appendChild(L);
  o.slice(0,60).forEach((y,i)=>L.appendChild(ypFila(ypMini_(y.vid),(i+1)+'. '+(y.title||y.song),mzEtq(y)+(y.primero?' · ⏭ va primero':''),[
    ypBtn('⏭',()=>{if(mqOtro())mqPub({t:'cmd',a:'primero',id:y.id});const l=cola(),it=l.find(z=>z.id===y.id);if(it){it.primero=Date.now();SS('vito_cola',l);try{tvPublicar(true);}catch(e){}renderMusica();ypCuerpo(true);showToast('⏭ «'+(y.title||y.song)+'» suena después de la actual.');}}),
    ypBtn('🗑',()=>{if(mqOtro())mqPub({t:'cmd',a:'quitar',id:y.id});mzTermino(y.id,'cancelled');try{tvPublicar(true);}catch(e){}renderMusica();ypCuerpo(true);})].concat(y.vid?[ypCorBtn({vid:y.vid,title:y.title||y.song,artist:y.artist,dur:y.dur})]:[]))));
}
// ---------- Barrita «🎵 Sonando…» en toda la app ----------
function ypMiniPintar(){
  let m=$('ypMini');
  const x=mzActual(),hay=x||ordenJusto(cola()).length;
  const ver=hay&&!ypAbierto&&typeof data!=='undefined'&&data&&data.musicOn!==false&&!document.body.classList.contains('facil-on')&&!(document.getElementById('authOverlay')&&!document.getElementById('authOverlay').hidden)&&!sessionStorage.getItem('yp-mini-x');
  if(!m){if(!ver)return;m=document.createElement('button');m.type='button';m.id='ypMini';m.className='yp-mini';m.setAttribute('aria-label','Abrir el panel de YouTube');document.body.appendChild(m);
    m.addEventListener('click',e=>{if(e.target.closest('[data-yp-x]')){e.stopPropagation();try{sessionStorage.setItem('yp-mini-x','1');}catch(z){}m.hidden=true;return;}if(e.target.closest('[data-yp-sig]')){e.stopPropagation();mzSaltar();return;}ypAbrir();});}
  m.hidden=!ver;if(!ver)return;
  const k=(x?x.id:'')+'|'+(x?x.vid:'');
  if(m.dataset.k!==k){m.dataset.k=k;
    m.innerHTML=(x&&x.vid?'<img src="'+esc(ypMini_(x.vid))+'" alt="">':'<span class="yp-sinimg">🎵</span>')+'<span class="yp-mt"><b>'+esc(x?(x.title||x.song):'Música en cola')+'</b><small>'+esc(x?ypDonde(x.fuente)+' · '+mzEtq(x):'Toca para ver la cola')+'</small></span>'+
      (x?'<span class="yp-mb" data-yp-sig title="Siguiente">⏭</span>':'')+'<span class="yp-mb yp-mx" data-yp-x title="Ocultar">✕</span>';}
}
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-yp-abrir]');if(b){e.preventDefault();ypAbrir();}});
window.vitoPanel={abrir:ypAbrir,cerrar:ypCerrar,agregar:ypAgregar,abierto:()=>ypAbierto};
window.vitoMod = { republicarMesas: () => { Object.keys(pubHash).forEach(k => { if(pubHash[k] !== undefined) pubHash[k] = '-'; }); try{ publicarCuentas(); }catch(e){} }, mzMax, yRenovarServidor, linkMesa, mCfg, mUrl, prepUrl: () => { try{ return prepUrl(); }catch(e){ return ''; } }, prepPublicar: f => { try{ prepPublicar(f); }catch(e){} }, mVistos, mPublicar, reconectarPedidos: () => { try{conectar();}catch(e){} }, qCanales, qProbarPedidos, tvOn, tvUrl, LS, SS, qCfg, yCfg, yTok, yConectar, cola, ordenJusto, mzEmpezo, mzTermino, mzProgreso, yLista, ytAgregar, ySearch, yGet, AUTO, renderMusica, esperarYT: () => cadena, yFuente: () => yFuente, ytDur, ytPosicionSiguiente, ytTanda: () => ytTanda, procesar, notifPedidos, notifMusica };
function publicarCuentas(){
  if(typeof data==='undefined'||!data)return;
  try{publicarCatalogo();}catch(e){}             // la carta se publica siempre (aunque "en vivo" esté apagado)
  if(!qCfg().live)return;
  Object.keys(data.tables).forEach(k=>{
    const id=+k,sn=snapMesa(id),h=JSON.stringify(Object.assign({},sn,{t:0}));
    if(pubHash[id]===h)return;
    if(pubHash[id]===undefined&&!mesaQRActiva(id))return;      // nadie la está viendo por QR
    const primera=pubHash[id]===undefined;pubHash[id]=h;
    if(primera&&!sn.i.length&&!sn.cs)return;
    fetch('https://canal.vento.local/'+vTopic(id),{method:'POST',body:JSON.stringify(sn)}).catch(()=>{delete pubHash[id];});
  });
}
const _saveData=saveData;
saveData=async function(){const r=await _saveData.apply(this,arguments);clearTimeout(pubT);pubT=setTimeout(()=>{publicarCuentas();try{mPublicar();}catch(e){}},2500);return r;};
setInterval(publicarCuentas,60000);
setInterval(()=>{try{mPublicar();}catch(e){}},60000);

/* ---------- Mesas ocupadas: el texto se adapta al color del fondo ---------- */
function contrasteMesas(){
  const r=document.documentElement,c=getComputedStyle(r).getPropertyValue('--cream').trim();let rgb,m=/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c);
  if(m){let h=m[1];if(h.length===3)h=h.replace(/./g,'$&$&');const n=parseInt(h,16);rgb=[n>>16&255,n>>8&255,n&255];}
  else{const q=/(\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(c);if(!q)return;rgb=[+q[1],+q[2],+q[3]];}
  // Contraste real (fórmula WCAG), no solo brillo aproximado: se calcula la
  // luminancia relativa del color de fondo y se elige negro o blanco — el que
  // de verdad dé más contraste contra ese color exacto. El truco de "brillo >
  // 0.5" de antes fallaba con colores de brillo medio (ej. un tema con acento
  // azul o naranja): salía texto blanco que apenas se leía. Así se lee bien
  // siempre, pase lo que pase el tema, incluido un color 100% personalizado.
  const lin=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);};
  const L=0.2126*lin(rgb[0])+0.7152*lin(rgb[1])+0.0722*lin(rgb[2]);
  const contraste=(a,b)=>(Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);
  // Se compara contra la luminancia REAL de los dos colores que de verdad se
  // van a poner (#0a0a0a y #ffffff, no un negro/blanco ideal), para que la
  // decisión coincida con lo que se ve en pantalla.
  const L_BLACK = 0.003035, L_WHITE = 1; // luminancia relativa de #0a0a0a y #ffffff
  const col = contraste(L,L_WHITE) >= contraste(L,L_BLACK) ? '#ffffff' : '#0a0a0a';
  if(r.style.getPropertyValue('--on-cream')!==col)r.style.setProperty('--on-cream',col);
}
new MutationObserver(contrasteMesas).observe(document.documentElement,{attributes:true,attributeFilter:['style']});
contrasteMesas();

/* ---------- Reloj en vivo del encabezado ---------- */
function iniReloj(){
  const t=$('lcTime'),d=$('lcDate');
  if(!t||!d)return;
  function tick(){
    const n=new Date();
    t.textContent=n.toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'});
    d.textContent=n.toLocaleDateString('es-CO',{weekday:'short',day:'numeric',month:'short'});
  }
  tick();
  setInterval(tick,15000);
}

/* ---------- Arranque ---------- */
aplicarTipo();iniTipo();iniAjustesCats();iniAuto();iniHist();iniMusica();iniYT();iniAutoPlay();iniTVPantalla();iniReloj();
const w=setInterval(()=>{if(typeof data!=='undefined'&&data){clearInterval(w);iniQR();iniPrep();renderMusica();mejorarHist();if(typeof i18nRefreshDynamic==='function')i18nRefreshDynamic();setTimeout(publicarCuentas,4000);}},400);
})();

