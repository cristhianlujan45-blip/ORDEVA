// 🧾 Caja (POS) en cualquier modo (lib/vento-pos.js): lector de código de barras (USB/Bluetooth = teclado rápido + Enter),
// «3*código», código nuevo → crear producto, pago mixto con vueltas, recibo y «📊 Caja de hoy».
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = (process.env.VENTO_BASE || 'http://localhost:8765') + '/index.html';
(async()=>{ const b=await chromium.launch(); let ok=0,mal=0; const chk=(n,c,x)=>{ if(c){ok++;console.log('✅ '+n);} else {mal++;console.log('❌ '+n+(x?' → '+x:''));} };
 const ctx=await b.newContext({viewport:{width:1280,height:800}});
 await ctx.route('**/*', r=>{const u=new URL(r.request().url()); return u.hostname==='localhost'?r.continue():r.abort();});
 await ctx.addInitScript(()=>{ try{ localStorage.setItem('vento-hola','0'); }catch(e){} });
 const p=await ctx.newPage(); p.errs=[]; p.on('pageerror',e=>p.errs.push(e.message));
 const visible=sel=>p.evaluate(s=>{ const e=document.querySelector(s); return !!e && e.checkVisibility(); }, sel);
 const carrito=()=>p.evaluate(()=>ventoPOS.carrito().map(x=>x.id+'×'+x.qty).join(','));
 // Un lector de código de barras escribe cada tecla en ~10 ms y termina con Enter.
 const lector=async cod=>{ await p.evaluate(()=>{ if(document.activeElement) document.activeElement.blur(); }); await p.keyboard.type(cod,{delay:8}); await p.keyboard.press('Enter'); await p.waitForTimeout(250); };

 await p.goto(BASE,{waitUntil:'load'}); await p.waitForTimeout(3000);
 await p.evaluate(async()=>{ await enterApp('test',null); localStorage.setItem('cm-tutorial-seen','1'); localStorage.setItem('vento-pp-oculta','1');
   document.querySelectorAll('.overlay.show').forEach(o=>o.classList.remove('show')); window.speakVoice=()=>{};
   data.products=[{id:'ag',name:'Águila',price:4000,stock:20,barcodes:['7702004003508']},{id:'em',name:'Empanada',price:2500,stock:10,barcodes:['7701234567890']},{id:'ga',name:'Gaseosa',price:3000}];
   data.tables={}; for(let k=1;k<=4;k++) data.tables[k]={items:[],people:[],payments:[]};
   data.tableCount=4; data.tipsOn=false; data.loyaltyOn=false; data.history=[]; delete data.modoOperacion; await saveData(); renderAll(); ventoPOS.vaciar(); });
 await p.waitForTimeout(500);

 // ---------- 1. Restaurante: el botón «🧾 Caja (POS)» abre la caja en pantalla completa ----------
 chk('Restaurante: se ve el botón «🧾 Caja (POS)» al lado de Venta rápida', await visible('#posCajaBtn') && await visible('#quickSaleBtn'));
 await p.click('#posCajaBtn'); await p.waitForTimeout(300);
 chk('Caja abierta: buscador, productos, COBRAR, «Lector listo» y «Caja de hoy»', await visible('#pzCajaOv .pz-q') && await visible('#pzCajaOv .pz-cobrar') && await visible('#pzCajaOv .pz-lector') && await visible('#pzCajaOv [data-hoy]') && (await p.$$('#pzCajaOv .pz-tile')).length===3);

 // ---------- 2. Lector de código de barras ----------
 await lector('7702004003508');
 chk('Lector (sin el cursor en el buscador): el código agrega el producto', await carrito()==='ag×1', await carrito());
 await lector('7702004003508');
 chk('Lector: el mismo código otra vez suma 1', await carrito()==='ag×2', await carrito());
 await p.fill('#pzCajaOv .pz-q','3*7701234567890'); await p.press('#pzCajaOv .pz-q','Enter'); await p.waitForTimeout(250);
 chk('«3*código» en el buscador agrega 3 unidades', await carrito()==='ag×2,em×3', await carrito());
 await p.fill('#pzCajaOv .pz-q','2*'); await p.evaluate(()=>document.activeElement.blur());
 await lector('7702004003508');
 chk('«2*» escrito y luego el lector: 2 unidades', await carrito()==='ag×4,em×3', await carrito());
 // Escribir a mano lento NO es el lector (no agrega nada)
 await p.evaluate(()=>document.activeElement && document.activeElement.blur());
 for(const c of '7702004003508'){ await p.keyboard.press(c); await p.waitForTimeout(130); } await p.keyboard.press('Enter'); await p.waitForTimeout(200);
 chk('Teclas lentas (una persona) no se toman como lector', await carrito()==='ag×4,em×3', await carrito());
 // Código nuevo → se ofrece crear el producto con ese código
 await lector('7709999999991');
 chk('Código que no está: sale «¿Qué producto es?» con «Crear producto»', await visible('#linkCodeOverlay') && await visible('#lcCreateBtn'));
 await p.evaluate(()=>{ document.getElementById('linkCodeOverlay').classList.remove('show'); }); await p.waitForTimeout(150);
 let r=await p.evaluate(()=>window.ventoPOS.leerCodigo('7701234567890'));
 chk('ventoPOS.leerCodigo también agrega por código', r===true && await carrito()==='ag×4,em×4', await carrito());
 await p.evaluate(()=>{ ventoPOS.vaciar(); ventoPOS.agregar('ag',2); ventoPOS.agregar('em',1); ventoPOS.agregar('ga',1); }); await p.waitForTimeout(150);
 r=await p.evaluate(()=>document.querySelector('#pzCajaOv .pz-total b').textContent);
 chk('TOTAL en la caja: $13.500', r==='$13.500', r);

 // ---------- 3. Pago mixto con vueltas ----------
 await p.click('#pzCajaOv .pz-cobrar'); await p.waitForTimeout(300);
 await p.click('.pz-pago .pz-mixto-btn'); await p.waitForTimeout(150);
 await p.fill('.pz-pago [data-mx="nequi"]','5000');
 r=await p.evaluate(()=>({t:document.querySelector('.pz-mx-falta').textContent, d:document.querySelector('.pz-mixto-ok').disabled}));
 chk('Mixto: con $5.000 por Nequi dice «Faltan $8.500» y no deja cobrar', r.t==='Faltan $8.500' && r.d, JSON.stringify(r));
 await p.fill('.pz-pago [data-mx="nequi"]','20000');
 r=await p.evaluate(()=>({t:document.querySelector('.pz-mx-falta').textContent, d:document.querySelector('.pz-mixto-ok').disabled}));
 chk('Mixto: lo digital no puede pasar del total', r.t==='Lo digital pasa del total.' && r.d, JSON.stringify(r));
 await p.fill('.pz-pago [data-mx="nequi"]','10000'); await p.fill('.pz-pago [data-mx="efectivo"]','10000');
 r=await p.evaluate(()=>({t:document.querySelector('.pz-mx-falta').textContent, d:document.querySelector('.pz-mixto-ok').disabled}));
 chk('Mixto: $10.000 Nequi + $10.000 efectivo → «Vueltas: $6.500»', r.t==='Vueltas: $6.500' && !r.d, JSON.stringify(r));
 await p.click('.pz-pago .pz-mixto-ok'); await p.waitForTimeout(400);
 r=await p.evaluate(()=>{ const h=data.history[0]; return h && {tot:h.total, n:h.payments.length, pg:h.payments.map(x=>x.method+':'+x.amount+':'+x.note).join('|'), suma:h.payments.reduce((s,x)=>s+x.amount,0), mesa:h.tableName}; });
 chk('Venta registrada con 2 pagos: efectivo $3.500 + Nequi $10.000 (suman el total)', r && r.tot===13500 && r.n===2 && r.suma===13500 && r.pg==='efectivo:3500:Efectivo|transferencia:10000:Nequi', JSON.stringify(r));
 r=await p.evaluate(()=>({ag:data.products.find(x=>x.id==='ag').stock, em:data.products.find(x=>x.id==='em').stock, c:ventoPOS.carrito().length}));
 chk('Inventario descontado (Águila 20→18, Empanada 10→9) y carrito vacío', r.ag===18 && r.em===9 && r.c===0, JSON.stringify(r));
 r=await p.evaluate(()=>{ const d=document.getElementById('pzDeshacer'); return {t:d.querySelector('.pz-dmsg').textContent, rec:!!d.querySelector('.pz-dextra'), v:!d.hidden}; });
 chk('Aviso «✅ Vendido $13.500 · Vueltas $6.500» con «🧾 Recibo» y «Deshacer»', r.v && r.t==='✅ Vendido $13.500 · Vueltas $6.500' && r.rec, JSON.stringify(r));

 // ---------- 4. Recibo ----------
 await p.click('#pzDeshacer .pz-dextra'); await p.waitForTimeout(300);
 chk('«🧾 Recibo» abre Imprimir / WhatsApp / Imagen', await visible('.pz-recibo [data-r="print"]') && await visible('.pz-recibo [data-r="wa"]') && await visible('.pz-recibo [data-r="img"]'));
 r=await p.evaluate(()=>{ try{ const t=buildReceiptText(histReceiptData(data.history[0])); return t; }catch(e){ return 'ERR '+e.message; } });
 chk('El recibo trae los productos y el total', /Águila/.test(r) && /13\.500/.test(r), r.slice(0,200));
 await p.click('.pz-recibo [data-r="x"]'); await p.waitForTimeout(150);

 // ---------- 5. Otra venta en efectivo y «📊 Caja de hoy» ----------
 await lector('7702004003508');
 await p.click('#pzCajaOv .pz-cobrar'); await p.waitForTimeout(300);
 await p.click('.pz-pago button[data-m="efectivo"]'); await p.waitForTimeout(400);
 await p.click('#pzCajaOv [data-hoy]'); await p.waitForTimeout(300);
 r=await p.evaluate(()=>({tot:document.querySelector('.pz-hoy-tot').textContent, met:[...document.querySelectorAll('.pz-hoy-met > div')].map(x=>x.textContent).join('|'), rec:document.querySelectorAll('.pz-hoy [data-rec]').length}));
 chk('Caja de hoy: 2 ventas por $17.500', /2 ventas/.test(r.tot) && /17\.500/.test(r.tot), JSON.stringify(r));
 chk('Caja de hoy: por medio de pago (efectivo $7.500, Nequi $10.000) y recibo de cada venta', /Efectivo\$7\.500/.test(r.met) && /Nequi\$10\.000/.test(r.met) && r.rec===2, JSON.stringify(r));
 await p.click('.pz-hoy [data-x]'); await p.waitForTimeout(150);
 await p.click('#pzCajaOv [data-pzx]'); await p.waitForTimeout(200);
 chk('«✕ Cerrar» cierra la caja y vuelven las mesas', !(await visible('#pzCajaOv .pz-q')) && await visible('#tableGrid'));
 // Con la caja cerrada (mesas), el lector no agrega nada
 await lector('7702004003508');
 chk('Caja cerrada en restaurante: el lector no toca el carrito', await carrito()==='', await carrito());

 // ---------- 6. Tienda: la caja principal también lee el lector y tiene «Caja de hoy» ----------
 await p.evaluate(()=>{ document.querySelectorAll('.overlay.show').forEach(o=>o.classList.remove('show')); ventoPOS.ponerModo('tienda'); }); await p.waitForTimeout(400);
 chk('Tienda: la caja tiene «▦ Lector … listo» y «📊 Caja de hoy»', await visible('#posPanel .pz-herr .pz-lector') && await visible('#posPanel .pz-herr [data-hoy]'));
 await lector('7701234567890');
 chk('Tienda: el lector agrega en la caja principal', await carrito()==='em×1', await carrito());
 await p.click('#posPanel .pz-herr [data-hoy]'); await p.waitForTimeout(250);
 chk('Tienda: «Caja de hoy» abre', await visible('.pz-hoy .pz-hoy-tot'));
 await p.click('.pz-hoy [data-x]'); await p.waitForTimeout(150);
 // Con otra ventana encima, el lector no se mete en la caja
 await p.evaluate(()=>document.getElementById('linkCodeOverlay').classList.add('show'));
 await lector('7701234567890');
 chk('Con otra ventana encima, el lector no agrega a la caja', await carrito()==='em×1', await carrito());
 await p.evaluate(()=>document.getElementById('linkCodeOverlay').classList.remove('show'));
 await p.evaluate(()=>ventoPOS.ponerModo('restaurante'));

 chk('Sin errores de página', !p.errs.length, p.errs.join(' | '));
 console.log('RESULTADO',ok,'bien',mal,'mal'); await b.close(); process.exit(mal?1:0); })();
