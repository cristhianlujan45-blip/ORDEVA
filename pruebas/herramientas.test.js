// Herramientas según el negocio y avisos de Vento en la 🔔 campanita (1.43.2):
//  • «🧾 Caja (POS)» en tiendas, comidas, bares y restaurantes; NO en servicios (barbería, hotel, consultorio…).
//  • En las tiendas NO va «⚡ Venta rápida»: en su lugar «📒 Fiados» (abre la libreta «Me deben»). También en un
//    negocio sin tipo que se llama «Tienda…».
//  • Los avisos fijos de Vento (prueba gratis, versión nueva, pagos que no van a sonar) quedan en la campanita.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = (process.env.VENTO_BASE || 'http://localhost:8765') + '/index.html';
(async()=>{ const b=await chromium.launch(); let ok=0,mal=0; const chk=(n,c,x)=>{ if(c){ok++;console.log('✅ '+n);} else {mal++;console.log('❌ '+n+(x!==undefined?' → '+JSON.stringify(x):''));} };
 const ctx=await b.newContext({viewport:{width:390,height:844}});
 await ctx.route('**/*', r=>{const u=new URL(r.request().url()); return u.hostname==='localhost'?r.continue():r.abort();});
 await ctx.addInitScript(()=>{ try{ localStorage.setItem('vento-hola','0'); localStorage.setItem('cm-tutorial-seen','1'); localStorage.setItem('vento-pp-oculta','1'); }catch(e){} });
 const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto(BASE); await p.waitForTimeout(2500);
 await p.evaluate(async()=>{ await enterApp('test',null); document.querySelectorAll('.overlay.show').forEach(o=>o.classList.remove('show')); });
 await p.waitForTimeout(1200);
 const vis=s=>p.evaluate(s=>{const e=document.querySelector(s);return !!e&&e.checkVisibility();},s);
 const poner=(tipo,modo,nombre)=>p.evaluate(([t,m,n])=>{ if(t) data.businessType=t; else delete data.businessType; data.modoOperacion=m; if(n) data.businessName=n; saveData(); renderAll(); aplicarVocabulario(); try{ventoPOS.pintar()}catch(e){} },[tipo,modo,nombre]).then(()=>p.waitForTimeout(400));
 const botones=async()=>({ rapida: await vis('#quickSaleBtn'), caja: await vis('#posCajaBtn'), fiados: await vis('#fiadosBtn') });

 // ---------- Herramientas por negocio ----------
 await poner('bar','restaurante'); let r=await botones();
 chk('Bar: «⚡ Venta rápida» y «🧾 Caja (POS)», sin «Fiados»', r.rapida && r.caja && !r.fiados, r);
 await poner('arepas','restaurante'); r=await botones();
 chk('Arepería (comida): «Venta rápida» y «Caja (POS)»', r.rapida && r.caja && !r.fiados, r);
 await poner('barberia','restaurante'); r=await botones();
 chk('Barbería (servicio): sin «Caja (POS)»', !r.caja && r.rapida, r);
 await poner('hotel','restaurante'); r=await botones();
 chk('Hotel (servicio): sin «Caja (POS)»', !r.caja, r);
 await poner('tienda','mixto'); r=await botones();
 chk('Tienda: SIN «⚡ Venta rápida», con «📒 Fiados» y «🧾 Caja (POS)»', !r.rapida && r.fiados && r.caja, r);
 await p.click('#fiadosBtn'); await p.waitForTimeout(300);
 chk('«📒 Fiados» abre la libreta «Me deben»', await p.evaluate(()=>{ const o=document.getElementById('libretaOverlay'); return !!o && o.classList.contains('show') && /Me deben/.test(o.textContent); }));
 await p.evaluate(()=>document.querySelectorAll('.overlay.show').forEach(o=>o.classList.remove('show')));
 await poner('tienda','tienda');
 chk('Tienda en modo tienda: la caja tiene «📒 Fiados»', await vis('#posPanel .pz-herr [data-fiados]'));
 await poner('minimercado','mixto'); r=await botones();
 chk('Minimercado (tienda): sin «Venta rápida», con «Fiados»', !r.rapida && r.fiados, r);
 await poner(null,'restaurante','Tienda Vito'); r=await botones();
 chk('Negocio sin tipo llamado «Tienda Vito»: sin «Venta rápida», con «Fiados» y «Caja (POS)»', !r.rapida && r.fiados && r.caja, r);
 await poner(null,'restaurante','Cervecería El Parche'); r=await botones();
 chk('Negocio sin tipo «Cervecería…»: todo como antes («Venta rápida» y «Caja (POS)»)', r.rapida && r.caja && !r.fiados, r);
 await p.evaluate(()=>{ data.businessType='barberia'; data.modoCompleto=true; saveData(); aplicarVocabulario(); }); await p.waitForTimeout(300);
 chk('«Mostrar todas las funciones»: la barbería también ve «Caja (POS)»', await vis('#posCajaBtn'));
 await p.evaluate(()=>{ data.modoCompleto=false; data.businessType='bar'; saveData(); aplicarVocabulario(); });

 // ---------- Avisos de Vento en la campanita ----------
 await p.waitForTimeout(1500);
 r=await p.evaluate(()=>{ const s=document.getElementById('subBar'); return { en: !!(s&&s.closest('#vcAvisos')), vis: !!(s&&s.checkVisibility()), badge: document.querySelector('.vito-campana-badge').textContent }; });
 chk('«🎁 Prueba gratis» ya no sale en la pantalla principal: está en la campanita, que lo cuenta', r.en && !r.vis && r.badge==='1', r);
 await p.click('.vito-campana'); await p.waitForTimeout(300);
 chk('Al abrir la campanita: «📣 Avisos de Vento» con la prueba gratis', await vis('#vcAvisos .vc-avisos-tit') && await vis('#vcAvisos #subBar') && /Prueba gratis/.test(await p.textContent('#vcAvisos')));
 // Un aviso de pagos (permiso) también va a la campanita
 await p.evaluate(()=>{ const b=document.createElement('div'); b.id='pgSalud'; b.innerHTML='⚠️ <b>Los pagos no van a sonar</b> <button type="button" data-x2>🔓 Dar el permiso</button>'; document.body.appendChild(b); });
 await p.waitForTimeout(1300);
 r=await p.evaluate(()=>({ en: !!document.getElementById('pgSalud').closest('#vcAvisos'), primero: document.querySelector('#vcAvisos > :not(.vc-avisos-tit)').id, badge: document.querySelector('.vito-campana-badge').textContent }));
 chk('El aviso de pagos también entra a la campanita, de primero, y el número sube a 2', r.en && r.primero==='pgSalud' && r.badge==='2', r);
 await p.click('#vcAvisos [data-x2]'); await p.waitForTimeout(200);
 chk('Tocar el botón de un aviso cierra la campanita (para ver lo que abre)', await p.evaluate(()=>document.querySelector('.vito-campana-menu').style.display==='none'));
 await p.evaluate(()=>{ document.getElementById('pgSalud').hidden=true; }); await p.waitForTimeout(1300);
 chk('Cuando el aviso se resuelve, sale de la cuenta de la campanita', (await p.textContent('.vito-campana-badge'))==='1');

 // ---------- Los pedidos de la gente en la campanita ----------
 await p.evaluate(()=>{ document.querySelector('.vito-campana-menu').style.display='none'; data.products=[{id:'ag',name:'Águila',price:4000},{id:'pa',name:'Papas',price:3000}]; data.tables={1:{items:[],people:[],payments:[]},2:{items:[],people:[],payments:[]}}; data.tableCount=2; data.pedidos=[]; localStorage.removeItem('vito_notif_log'); saveData(); renderAll(); });
 await p.click('.vito-campana'); await p.waitForTimeout(300);
 chk('Sin pedidos: la campanita lo dice («Aquí salen los que hace la gente desde la app…»)', /Aquí salen los que hace la gente desde la app/.test(await p.textContent('.vito-campana-menu')));
 await p.evaluate(()=>{ document.querySelector('.vito-campana-menu').style.display='none'; window.vitoPedidos.entrante({ id:'pq1', mesa:1, items:[{n:'Águila',q:2},{n:'Papas',q:1}], nota:'sin hielo' }, 'qr'); });
 await p.waitForTimeout(400); await p.click('.vito-campana'); await p.waitForTimeout(400);
 r=await p.evaluate(()=>{ const f=document.querySelector('.vito-campana-menu [data-pedido="pq1"]'); return { t: f?f.textContent:'', curso: /En curso \(1\)/.test(document.querySelector('.vito-campana-menu').textContent), badge: document.querySelector('.vito-campana-badge').textContent }; });
 chk('Pedido desde la app: sale «En curso» con la mesa, lo que pidió, la nota y «📱 App»', r.curso && /Mesa 1/.test(r.t) && /2 Águila/.test(r.t) && /1 Papas/.test(r.t) && /sin hielo/.test(r.t) && /📱 App/.test(r.t), r);
 chk('La campanita cuenta el pedido en curso (prueba gratis + 1 pedido = 2)', r.badge==='2', r.badge);
 // Pedido que llegó a OTRO celular del negocio: aquí solo llega en los datos (sin la copia local de este celular)
 await p.evaluate(()=>{ document.querySelector('.vito-campana-menu').style.display='none'; localStorage.removeItem('vito_notif_log'); localStorage.removeItem('vito_pedidos_pend');
   data.pedidos.push({ id:'pq2', mesa:2, mesaNombre:'Mesa 2', items:[{name:'Papas',qty:3,price:3000,ok:true}], total:9000, at:Date.now(), recibidoEn:Date.now(), estado:'nuevo', origen:'qr', hist:[] }); saveData(); });
 await p.waitForTimeout(3300); await p.click('.vito-campana'); await p.waitForTimeout(400);
 r=await p.evaluate(()=>({ t:(document.querySelector('.vito-campana-menu')||{}).textContent||'', aceptar: !!document.querySelector('.vito-campana-menu .vito-ok') }));
 chk('Pedido que llegó a otro celular: también sale aquí «Por enviar» con «✅ Enviar pedido»', /Por enviar \(1\)/.test(r.t) && /Mesa 2/.test(r.t) && r.aceptar, r.t.slice(0,300));
 await p.click('.vito-campana-menu .vito-ok'); await p.waitForTimeout(400);
 chk('«Enviar pedido» lo pasa a la cuenta de la mesa', await p.evaluate(()=>data.pedidos.find(x=>x.id==='pq2').estado==='recibido' && (data.tables[2].items||[]).some(i=>i.name==='Papas' && i.qty===3)));
 await p.evaluate(()=>{ window.vitoPedidos.cambiar('pq1','entregado'); document.querySelector('.vito-campana-menu').style.display='none'; });
 await p.click('.vito-campana'); await p.waitForTimeout(400);
 chk('Pedido entregado: queda en «Pedidos de hoy»', await p.evaluate(()=>{ const t=document.querySelector('.vito-campana-menu').textContent; const f=document.querySelector('.vito-campana-menu [data-pedido="pq1"]'); return /Pedidos de hoy/.test(t) && !!f && /Pedido entregado/.test(f.textContent) && /Mesa 1/.test(f.textContent); }));
 await p.click('.vito-campana-menu [data-pedido="pq1"]'); await p.waitForTimeout(400);
 chk('Tocar un pedido abre la cuenta de esa mesa', await p.evaluate(()=>document.querySelector('.vito-campana-menu').style.display==='none' && typeof currentTable!=='undefined' && Number(currentTable)===1));

 chk('Sin errores de página', !errs.length, errs);
 console.log('RESULTADO',ok,'bien',mal,'mal'); await b.close(); process.exit(mal?1:0); })();
