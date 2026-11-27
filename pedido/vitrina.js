/* ORDEVA · pedido/vitrina.js — antes estaba dentro de pedido.html (1.99.92: así la lista blanca CSP no deja correr código pegado en la página). Se carga en el mismo lugar y orden. */
/* ---------- 🎉 Vitrina: ocasión, mensaje del local y promociones ----------
   La arma el dueño en su app (Ajustes → Pedidos, QR y caja → Página de pedidos) y llega por su propio
   canal de ORDEVA (topic + 'a'): {v, oc: ocasión, nom: nombre (cumpleañero…), msg: mensaje, sal: saludo al abrir,
   pr: [[emoji, título, texto, precio, producto de la carta]]}. Se guarda en el celular para verse sin señal. */
(function(){
  if(!c) return;
  const OC = {
    navidad:     { e:'🎄', fx:['❄️','🎄','✨','🎁'], es:'¡Feliz Navidad!', en:'Merry Christmas!', pt:'Feliz Natal!', g:'linear-gradient(135deg,#0f5132,#b42318)' },
    anonuevo:    { e:'🎆', fx:['🎆','🥂','✨','🎊'], es:'¡Feliz Año Nuevo!', en:'Happy New Year!', pt:'Feliz Ano Novo!', g:'linear-gradient(135deg,#1e1b4b,#b45309)' },
    cumple:      { e:'🎂', fx:['🎂','🎈','🎁','🎉'], es:'¡Feliz cumpleaños{n}!', en:'Happy birthday{n}!', pt:'Feliz aniversário{n}!', g:'linear-gradient(135deg,#db2777,#7c3aed)' },
    sanvalentin: { e:'💘', fx:['💘','❤️','💕','✨'], es:'¡Feliz día del amor y la amistad!', en:'Happy Valentine’s Day!', pt:'Feliz Dia dos Namorados!', g:'linear-gradient(135deg,#be123c,#f472b6)' },
    halloween:   { e:'🎃', fx:['🦇','🎃','👻','🍬'], es:'¡Feliz Halloween!', en:'Happy Halloween!', pt:'Feliz Halloween!', g:'linear-gradient(135deg,#3b0764,#ea580c)' },
    madre:       { e:'💐', fx:['💐','🌷','💖','🌸'], es:'¡Feliz día de la madre{n}!', en:'Happy Mother’s Day{n}!', pt:'Feliz Dia das Mães{n}!', g:'linear-gradient(135deg,#db2777,#f59e0b)' },
    padre:       { e:'👔', fx:['👔','🏆','💙','⭐'], es:'¡Feliz día del padre{n}!', en:'Happy Father’s Day{n}!', pt:'Feliz Dia dos Pais{n}!', g:'linear-gradient(135deg,#1d4ed8,#0f766e)' },
    futbol:      { e:'⚽', fx:['⚽','🏆','⭐','🇨🇴'], es:'¡Hoy hay partido!', en:'Game day!', pt:'Hoje tem jogo!', g:'linear-gradient(135deg,#15803d,#facc15)' },
    aniversario: { e:'🥳', fx:['🥳','🎉','🎊','✨'], es:'¡Estamos de aniversario{n}!', en:'It’s our anniversary{n}!', pt:'Estamos de aniversário{n}!', g:'linear-gradient(135deg,#7c3aed,#f59e0b)' },
    happyhour:   { e:'🍻', fx:['🍻','🍺','🍹','✨'], es:'¡Happy hour!', en:'Happy hour!', pt:'Happy hour!', g:'linear-gradient(135deg,#c2410c,#facc15)' },
    patrias:     { e:'🇨🇴', fx:['🇨🇴','🎉','⭐','🎊'], es:'¡Felices fiestas patrias!', en:'Happy national holiday!', pt:'Feliz feriado nacional!', g:'linear-gradient(135deg,#eab308,#1d4ed8 60%,#dc2626)' },
    amor:        { e:'💑', fx:['💞','🌹','🕯️','✨'], es:'Noche romántica', en:'Romantic night', pt:'Noite romântica', g:'linear-gradient(135deg,#881337,#4c1d95)' }
  };
  const TX = {
    es:{ pedir:'➕ Pedir', agregado:'✅ {p} agregado a tu pedido', promos:'Promociones', menu:'Ver el menú', hola:'¡Bienvenido!' },
    en:{ pedir:'➕ Order', agregado:'✅ {p} added to your order', promos:'Specials', menu:'See the menu', hola:'Welcome!' },
    pt:{ pedir:'➕ Pedir', agregado:'✅ {p} adicionado ao pedido', promos:'Promoções', menu:'Ver o cardápio', hola:'Bem-vindo!' },
    fr:{ pedir:'➕ Commander', agregado:'✅ {p} ajouté à la commande', promos:'Promotions', menu:'Voir le menu', hola:'Bienvenue !' }
  };
  const tx = k => (TX[LANG] || TX.es)[k] || TX.es[k];
  const quieto = () => (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) || document.body.classList.contains('easy-mode');
  const KEY = 'vit_' + c;
  let vit = jget(KEY, null);

  const st = document.createElement('style');
  st.textContent =
    '#vitHero{position:relative;overflow:hidden;margin:14px 0 4px;padding:18px 16px 16px;border-radius:22px;color:#fff;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,.25);animation:vitIn .6s cubic-bezier(.2,.8,.2,1) both}' +
    '#vitHero::after{content:"";position:absolute;inset:0;background:linear-gradient(110deg,transparent 30%,rgba(255,255,255,.28) 50%,transparent 70%);transform:translateX(-100%);animation:vitBrillo 4.5s ease-in-out 1s infinite;pointer-events:none}' +
    '#vitHero .vh-e{display:inline-block;font-size:46px;line-height:1;animation:vitLatido 2.2s ease-in-out infinite;filter:drop-shadow(0 4px 8px rgba(0,0,0,.3))}' +
    '#vitHero .vh-t{margin:8px 0 0;font-size:clamp(20px,6vw,28px);font-weight:800;line-height:1.15;text-shadow:0 2px 8px rgba(0,0,0,.3);overflow-wrap:anywhere}' +
    '#vitHero .vh-m{margin:8px auto 0;max-width:34ch;font-size:16px;line-height:1.4;opacity:.95;overflow-wrap:anywhere}' +
    '#vitPromoBox{margin:14px 0 6px;animation:vitIn .6s .15s cubic-bezier(.2,.8,.2,1) both}' +
    '#vitPromoBox .vp-h{display:flex;align-items:center;justify-content:space-between;margin:0 2px 8px;font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:var(--gold)}' +
    '#vitPromos{display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;padding:2px 2px 10px;scrollbar-width:none;overscroll-behavior-x:contain}' +
    '#vitPromos::-webkit-scrollbar{display:none}' +
    '.vp-card{flex:0 0 min(78%,300px);scroll-snap-align:center;position:relative;display:flex;gap:12px;align-items:center;padding:14px;border-radius:18px;background:var(--card);border:1px solid var(--line);box-shadow:0 6px 18px rgba(0,0,0,.14);animation:vitIn .5s cubic-bezier(.2,.8,.2,1) both}' +
    '.vp-card:only-child{flex-basis:100%}' +
    '.vp-card .vp-i{flex:0 0 64px;height:64px;display:grid;place-items:center;font-size:40px;border-radius:14px;background:var(--card2);overflow:hidden}' +
    '.vp-card .vp-i img{width:100%;height:100%;object-fit:contain;background:#fff}' +
    '.vp-card .vp-b{flex:1;min-width:0}' +
    '.vp-card .vp-t{font-weight:800;font-size:16px;line-height:1.2;overflow-wrap:anywhere}' +
    '.vp-card .vp-d{margin-top:3px;font-size:14px;color:var(--ink2);line-height:1.3;overflow-wrap:anywhere}' +
    '.vp-card .vp-p{margin-top:6px;font-weight:800;font-size:17px;color:var(--gold)}' +
    '.vp-card .vp-add{margin-top:8px;padding:9px 14px;border:0;border-radius:999px;background:linear-gradient(135deg,var(--gold-hi),var(--gold-lo));color:#111;font-weight:800;font-size:15px;transition:transform .15s}' +
    '.vp-card .vp-add:active{transform:scale(.94)}' +
    '.vp-card.vp-ok{animation:vitRebote .5s}' +
    '.vp-dots{display:flex;gap:6px;justify-content:center}.vp-dots i{width:7px;height:7px;border-radius:50%;background:var(--line);transition:all .25s}.vp-dots i.on{width:18px;border-radius:4px;background:var(--gold)}' +
    '#vitSaludo{position:fixed;inset:0;z-index:9000;display:grid;place-items:center;padding:20px;background:rgba(0,0,0,.55);backdrop-filter:blur(3px);animation:vitFade .3s both}' +
    '#vitSaludo .vs-c{width:min(100%,360px);padding:26px 20px 20px;border-radius:26px;color:#fff;text-align:center;box-shadow:0 20px 50px rgba(0,0,0,.4);animation:vitPop .55s cubic-bezier(.2,1.4,.4,1) both}' +
    '#vitSaludo .vs-e{font-size:72px;line-height:1;animation:vitLatido 1.8s ease-in-out infinite}' +
    '#vitSaludo h2{margin:10px 0 0;font-size:26px;line-height:1.15;overflow-wrap:anywhere}#vitSaludo p{margin:10px 0 0;font-size:16px;line-height:1.4;overflow-wrap:anywhere}' +
    '#vitSaludo button{margin-top:18px;width:100%;padding:14px;border:0;border-radius:16px;background:#fff;color:#111;font-weight:800;font-size:17px}' +
    '@keyframes vitIn{from{opacity:0;transform:translateY(14px) scale(.98)}to{opacity:1;transform:none}}' +
    '@keyframes vitFade{from{opacity:0}to{opacity:1}}' +
    '@keyframes vitPop{from{opacity:0;transform:scale(.7)}to{opacity:1;transform:none}}' +
    '@keyframes vitLatido{0%,100%{transform:scale(1) rotate(0)}25%{transform:scale(1.12) rotate(-6deg)}50%{transform:scale(1) rotate(0)}75%{transform:scale(1.08) rotate(5deg)}}' +
    '@keyframes vitBrillo{0%{transform:translateX(-100%)}40%,100%{transform:translateX(100%)}}' +
    '@keyframes vitRebote{0%,100%{transform:none}30%{transform:scale(1.05)}60%{transform:scale(.97)}}' +
    '.pcard{animation:vitIn .45s cubic-bezier(.2,.8,.2,1) both}.pcard:active{transform:scale(.97);transition:transform .12s}';
  document.head.appendChild(st);

  function titulo(o){
    const d = OC[o.oc]; if(!d) return '';
    const n = String(o.nom || '').trim();
    return (d[LANG] || d.es).replace('{n}', n ? ', ' + n : '');
  }
  function pedir(nombre, card){
    agregar(1, nombre);
    try{ if(modo !== 'p') set('p'); }catch(e){}
    msg(tx('agregado').replace('{p}', nombre), 'ok');
    if(card){ card.classList.remove('vp-ok'); void card.offsetWidth; card.classList.add('vp-ok'); }
    try{ mesoraCelebrar(['✨', '🛒', '⭐']); }catch(e){}
  }
  let rotar = null;
  function pintar(){
    const nav = document.querySelector('nav.tabs'); if(!nav) return;
    let hero = $('vitHero'), box = $('vitPromoBox');
    const o = vit && vit.v ? vit : null;
    const d = o && OC[o.oc];
    // Banner de la ocasión (o solo el mensaje si no hay ocasión)
    if(o && (d || o.msg)){
      if(!hero){ hero = h('div'); hero.id = 'vitHero'; hero.setAttribute('role', 'note'); nav.parentNode.insertBefore(hero, nav); }
      hero.innerHTML = '';
      hero.style.background = d ? d.g : 'linear-gradient(135deg,var(--gold-lo),var(--gold))';
      if(d){ hero.appendChild(h('span', 'vh-e', d.e)); hero.appendChild(h('p', 'vh-t', titulo(o))); }
      if(o.msg) hero.appendChild(h('p', 'vh-m', o.msg));
    } else if(hero) hero.remove();
    // Carrusel de promociones
    const pr = o && Array.isArray(o.pr) ? o.pr.filter(x => Array.isArray(x) && x[1]) : [];
    clearInterval(rotar);
    if(pr.length){
      if(!box){ box = h('section'); box.id = 'vitPromoBox'; box.setAttribute('aria-label', tx('promos')); nav.parentNode.insertBefore(box, nav); }
      else if(hero && box.previousElementSibling !== hero) nav.parentNode.insertBefore(box, nav);
      box.innerHTML = '';
      const hd = h('div', 'vp-h'); hd.appendChild(h('span', '', '📣 ' + tx('promos'))); const dots = h('span', 'vp-dots'); hd.appendChild(dots); box.appendChild(hd);
      const fila = h('div'); fila.id = 'vitPromos'; box.appendChild(fila);
      pr.forEach((x, i) => {
        const card = h('div', 'vp-card'); card.style.animationDelay = (0.08 * i) + 's';
        const ic = h('div', 'vp-i'), foto = x[4] && fotos[norm(x[4])];
        if(foto){ const im = document.createElement('img'); im.src = foto; im.alt = ''; im.loading = 'lazy'; ic.appendChild(im); } else ic.textContent = x[0] || '🎁';
        card.appendChild(ic);
        const b = h('div', 'vp-b'); b.appendChild(h('div', 'vp-t', x[1]));
        if(x[2]) b.appendChild(h('div', 'vp-d', x[2]));
        if(+x[3] > 0) b.appendChild(h('div', 'vp-p', fm(+x[3])));
        const prod = String(x[4] || '').trim();
        const enCarta = prod && !(cat && Array.isArray(cat.p) && cat.p.some(p => norm(p[0]) === norm(prod) && p[3] == 2));   // agotado → sin botón
        if(enCarta){ const bt = h('button', 'vp-add', tx('pedir')); bt.type = 'button'; bt.setAttribute('aria-label', tx('pedir') + ': ' + prod); bt.onclick = () => pedir(prod, card); b.appendChild(bt); }
        card.appendChild(b); fila.appendChild(card);
        if(pr.length > 1) dots.appendChild(h('i', i ? '' : 'on'));
      });
      const marcar = () => { const w = fila.firstElementChild ? fila.firstElementChild.offsetWidth + 12 : 1; const k = Math.round(fila.scrollLeft / w); Array.from(dots.children).forEach((e, j) => e.classList.toggle('on', j === k)); };
      fila.addEventListener('scroll', marcar, { passive: true });
      if(pr.length > 1 && !quieto()){
        let pausa = 0;
        const parar = () => { pausa = Date.now(); };
        fila.addEventListener('touchstart', parar, { passive: true }); fila.addEventListener('pointerdown', parar);
        rotar = setInterval(() => {
          if(document.hidden || Date.now() - pausa < 9000) return;
          const w = fila.firstElementChild.offsetWidth + 12, fin = fila.scrollLeft + fila.clientWidth >= fila.scrollWidth - 4;
          fila.scrollTo({ left: fin ? 0 : fila.scrollLeft + w, behavior: 'smooth' });
        }, 5000);
      }
    } else if(box) box.remove();
    // Adornos que caen: la ocasión manda sobre el motivo de la carta
    if(d){ FX_SETS['oc_' + o.oc] = d.fx; fxSet('oc_' + o.oc); }
    else applyTh(cat && cat.th);
  }
  function saludo(){
    const o = vit; if(!o || !o.sal) return;
    const d = OC[o.oc]; if(!d) return;
    const k = 'vitSal_' + c + '_' + o.oc + '_' + (o.nom || '');
    try{ if(sessionStorage.getItem(k)) return; sessionStorage.setItem(k, '1'); }catch(e){}
    if($('vitSaludo')) return;
    const ov = h('div'); ov.id = 'vitSaludo'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    const cc = h('div', 'vs-c'); cc.style.background = d.g;
    cc.appendChild(h('div', 'vs-e', d.e)); cc.appendChild(h('h2', '', titulo(o)));
    const nb = cat && cat.n ? String(cat.n).trim() : '';
    cc.appendChild(h('p', '', o.msg || (nb ? tx('hola') + ' · ' + nb : tx('hola'))));
    const bt = h('button', '', tx('menu')); bt.type = 'button';
    const cerrar = () => ov.remove();
    bt.onclick = cerrar; ov.onclick = e => { if(e.target === ov) cerrar(); };
    cc.appendChild(bt); ov.appendChild(cc); document.body.appendChild(ov);
    setTimeout(() => { try{ mesoraCelebrar(d.fx); }catch(e){} }, 250);
    setTimeout(cerrar, 9000);
  }
  function recibir(x, nuevo){
    if(!x || x.v !== 1) return;
    const antes = JSON.stringify(vit);
    vit = x; jset(KEY, vit);
    if(JSON.stringify(vit) !== antes || nuevo) pintar();
    saludo();
  }
  async function cargar(){
    try{
      const ctrl = new AbortController(), tmo = setTimeout(() => ctrl.abort(), 6000);
      const r = await fetch('https://canal.vento.local/' + c + 'a/json?poll=1&since=7d', { signal: ctrl.signal });
      clearTimeout(tmo);
      const ls = (await r.text()).trim().split('\n').filter(Boolean);
      let ult = null;
      ls.forEach(l => { try{ const m = JSON.parse(l); if(m.event === 'message') ult = JSON.parse(m.message); }catch(e){} });
      if(ult) recibir(ult);
    }catch(e){}
  }
  let es2 = null;
  function enVivo(){
    if(es2 || !window.EventSource) return;
    try{ es2 = new EventSource('https://canal.vento.local/' + c + 'a/sse?since=' + Math.floor(Date.now() / 1000)); }catch(e){ return; }
    es2.onmessage = ev => { try{ const m = JSON.parse(ev.data); if(m.event === 'message') recibir(JSON.parse(m.message)); }catch(e){} };
    es2.onerror = () => { if(es2 && es2.readyState === 2){ es2 = null; setTimeout(enVivo, 5000); } };
  }
  window.vitrinaRecibir = recibir;   // para pruebas
  // Repintar al cambiar idioma/moneda o al llegar la carta (fotos, agotados)
  const _rv = refrescarVista; refrescarVista = function(){ _rv.apply(this, arguments); try{ pintar(); }catch(e){} };
  const _ath = applyTh; applyTh = function(th){ _ath(th); const d = vit && OC[vit.oc]; if(d){ FX_SETS['oc_' + vit.oc] = d.fx; fxSet('oc_' + vit.oc); } };
  if(vit){ pintar(); saludo(); }
  cargar(); enVivo();
  setTimeout(() => { try{ pintar(); }catch(e){} }, 7000);   // por si las fotos llegan después
  document.addEventListener('visibilitychange', () => { if(!document.hidden) cargar(); });
})();
