// Sonido al agregar o quitar productos de una mesa: se puede apagar o prender
//  - con el botón 🔊/🔇 dentro de la mesa abierta;
//  - con el interruptor en Ajustes → Notificaciones.
// Los dos quedan sincronizados con Ajustes → Sonidos y lo que se elige se recuerda al recargar.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
(async()=>{ const b=await chromium.launch(); let ok=0,mal=0; const chk=(n,c,x)=>{ if(c){ok++;console.log('✅ '+n);} else {mal++;console.log('❌ '+n+(x!==undefined?' → '+JSON.stringify(x):''));} };
 const ctx=await b.newContext({viewport:{width:390,height:844}});
 await ctx.route('**/*', r=>{const u=new URL(r.request().url()); return u.hostname==='localhost'?r.continue():r.abort();});
 const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 const BASE=process.env.VENTO_BASE||'http://localhost:8765';
 const entrar=async()=>{ await p.evaluate(async()=>{ try{await enterApp('test',null);}catch(x){} localStorage.setItem('cm-tutorial-seen','1'); document.querySelectorAll('.overlay.show').forEach(o=>o.classList.remove('show'));
   data.products=[{id:'ag',name:'Águila',price:4000,stock:200,favorite:true}];
   data.tables[1]={items:[{productId:'ag',name:'Águila',price:4000,qty:2,personId:null,history:[]}],people:[],payments:[]};
   saveData(); renderMesas(); openTableModal(1); }); await p.waitForTimeout(500); };
 try{
  await p.goto(BASE+'/index.html',{waitUntil:'load'}); await p.waitForTimeout(3000); await entrar();
  const S=()=>p.evaluate(()=>ventoSonidos._historial.map(x=>x.tipo));
  const pausa=()=>p.waitForTimeout(200);
  chk('Dentro de la mesa está el botón de sonido (prendido por defecto)', await p.evaluate(()=>{ const b=document.getElementById('sndMesaBtn'); return !!b && b.offsetParent!==null && b.getAttribute('aria-pressed')==='true'; }));
  let a=await S(); await p.click('#itemsContainer .li-qty-plus'); await pausa(); let d=await S();
  chk('Prendido: tocar + suena', JSON.stringify(d.slice(a.length))==='["add"]', d.slice(a.length));

  await p.click('#sndMesaBtn'); await pausa();
  chk('Al tocar el botón se apaga (🔇) y lo dice', await p.evaluate(()=>{ const b=document.getElementById('sndMesaBtn'), c=ventoSonidos.cfg(); return b.getAttribute('aria-pressed')==='false' && !c.add && !c.remove; }));
  a=await S(); await p.click('#itemsContainer .li-qty-plus'); await pausa(); await p.click('#itemsContainer .li-qty-minus'); await pausa(); d=await S();
  chk('Apagado: + y − ya no suenan', d.length===a.length, d.slice(a.length));
  chk('… pero el sonido al cobrar sigue como estaba', await p.evaluate(()=>ventoSonidos.cfg().sale===true && ventoSonidos.cfg().on===true));
  chk('Ajustes → Sonidos refleja el cambio (agregar y quitar apagados)', await p.evaluate(()=>{ const x=document.getElementById('sndAdd'), y=document.getElementById('sndRemove'); return !!x && !x.checked && !y.checked; }));
  chk('Ajustes → Notificaciones tiene el interruptor y está apagado', await p.evaluate(()=>{ const t=document.getElementById('sndMesaOn'); return !!t && !t.checked && !!t.closest('#avTipos'); }));

  // Se recuerda al recargar
  await p.reload({waitUntil:'load'}); await p.waitForTimeout(3000); await entrar();
  chk('Al recargar sigue apagado', await p.evaluate(()=>{ const b=document.getElementById('sndMesaBtn'); return !!b && b.getAttribute('aria-pressed')==='false'; }));

  // Prender desde Ajustes → Notificaciones
  await p.evaluate(()=>{ const t=document.getElementById('sndMesaOn'); t.checked=true; t.dispatchEvent(new Event('change',{bubbles:true})); }); await pausa();
  chk('Desde Notificaciones se prende y el botón de la mesa cambia a 🔊', await p.evaluate(()=>{ const b=document.getElementById('sndMesaBtn'), c=ventoSonidos.cfg(); return b.getAttribute('aria-pressed')==='true' && c.add && c.remove && c.on; }));
  a=await S(); await p.click('#itemsContainer .li-qty-plus'); await pausa(); d=await S();
  chk('Prendido otra vez: + suena', JSON.stringify(d.slice(a.length))==='["add"]', d.slice(a.length));

  // Si en Ajustes → Sonidos se apaga solo «agregar», el botón sigue prendido (todavía suena al quitar)
  await p.evaluate(()=>{ const x=document.getElementById('sndAdd'); x.checked=false; x.dispatchEvent(new Event('change',{bubbles:true})); }); await pausa();
  chk('Ajustes → Sonidos y el botón de la mesa quedan sincronizados', await p.evaluate(()=>document.getElementById('sndMesaBtn').getAttribute('aria-pressed')==='true' && document.getElementById('sndMesaOn').checked));
  await p.evaluate(()=>{ const x=document.getElementById('sndRemove'); x.checked=false; x.dispatchEvent(new Event('change',{bubbles:true})); }); await pausa();
  chk('Apagando también «quitar», el botón pasa a 🔇', await p.evaluate(()=>document.getElementById('sndMesaBtn').getAttribute('aria-pressed')==='false' && !document.getElementById('sndMesaOn').checked));
 }catch(e){ mal++; console.log('❌ La prueba se cayó: '+(e&&e.stack||e)); }
 chk('Sin errores de página', !errs.length, errs);
 console.log('RESULTADO',ok,'bien',mal,'mal'); await b.close(); process.exit(mal?1:0); })();
