/* ORDEVA · avisos de pagos con la app cerrada (Web Push) y, desde 1.61.0, que la app abra al instante.
   Cómo guarda la app en el equipo (sin que nadie quede con una versión vieja):
   • Las páginas (index.html, mesero.html…): SIEMPRE se piden primero a internet. Solo si no hay internet (o no responde
     en unos segundos) se abre la última copia guardada. Así, con internet, siempre abre la versión de hoy.
   • Los archivos de la app con versión en la dirección («app/04-principal.js?v=1.61.0»): se guardan una vez y salen
     del equipo al instante (no cambian nunca: una versión nueva trae otra dirección). Al guardar una versión, la
     anterior de ese archivo se borra.
   • Lo demás de este sitio (iconos, archivos sin versión): primero internet; sin internet, la copia guardada.
   • version.txt, el servidor de ORDEVA (Supabase), Google, CDNs: NO se tocan.
   Sin internet la app sigue la regla de siempre: «📡 Sin conexión con ORDEVA» y vuelve sola al reconectar. */
var CACHE = 'ordeva-app-1';
var LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(self.location.hostname);
var GUARDA = !LOCAL || /[?&]cache=1(&|$)/.test(self.location.search);   // en pruebas locales, solo si se pide
var ESPERA_PAGINA = 3500;

self.addEventListener('install', function(){ self.skipWaiting(); });
self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(l){
    return Promise.all(l.filter(function(k){ return /^ordeva-app-/.test(k) && k !== CACHE; }).map(function(k){ return caches.delete(k); }));
  }).catch(function(){}).then(function(){ return self.clients.claim(); }));
});

function mismoSitio(u){ return u.origin === self.location.origin; }
function conVersion(u){ return /[?&]v=[0-9][0-9.]*(&|$)/.test(u.search) && /\.(js|css|mjs)$/.test(u.pathname); }
function noTocar(u){ return /\/(version\.txt|sw\.js)$/.test(u.pathname); }
function llavePagina(u){ var p = u.pathname; if(/\/$/.test(p)) p += 'index.html'; return u.origin + p; }
function guardable(r){ return r && r.ok && r.status === 200 && (r.type === 'basic' || r.type === 'default'); }

// Al guardar «x.js?v=1.61.0» se borran las otras versiones de x.js.
function guardarVersion(c, req, res){
  var u = new URL(req.url);
  return c.put(req, res).then(function(){
    return c.keys().then(function(ks){
      return Promise.all(ks.filter(function(k){ var x = new URL(k.url); return x.pathname === u.pathname && x.search !== u.search; }).map(function(k){ return c.delete(k); }));
    });
  }).catch(function(){});
}
function primeroGuardado(req){
  return caches.open(CACHE).then(function(c){
    return c.match(req).then(function(g){
      if(g) return g;
      return fetch(req).then(function(r){ if(guardable(r)) guardarVersion(c, req, r.clone()); return r; });
    });
  });
}
function primeroInternet(req, llave, espera){
  return caches.open(CACHE).then(function(c){
    var red = fetch(req).then(function(r){ if(guardable(r)) c.put(llave, r.clone()).catch(function(){}); return r; });
    var guardado = function(){ return c.match(llave).then(function(g){ return g || red; }); };
    if(!espera) return red.catch(guardado);
    // Internet muy lento: a los pocos segundos se abre la copia guardada (si hay); internet sigue y la deja al día.
    return new Promise(function(ok, mal){
      var listo = false, t = setTimeout(function(){ c.match(llave).then(function(g){ if(g && !listo){ listo = true; ok(g); } }); }, espera);
      red.then(function(r){ clearTimeout(t); if(!listo){ listo = true; ok(r); } }, function(e){
        clearTimeout(t); if(listo) return;
        c.match(llave).then(function(g){ listo = true; if(g) ok(g); else mal(e); });
      });
    });
  });
}

self.addEventListener('fetch', function(e){
  if(!GUARDA) return;
  var req = e.request;
  if(req.method !== 'GET' || req.headers.has('range')) return;
  var u; try{ u = new URL(req.url); }catch(x){ return; }
  if(!mismoSitio(u) || noTocar(u)) return;
  if(req.mode === 'navigate'){ e.respondWith(primeroInternet(req, llavePagina(u), ESPERA_PAGINA)); return; }
  if(conVersion(u)){ e.respondWith(primeroGuardado(req)); return; }
  if(/\.(js|css|png|svg|webp|jpg|ico|woff2?|webmanifest|json)$/.test(u.pathname)){ e.respondWith(primeroInternet(req, u.origin + u.pathname + u.search, 0)); }
});

// La página manda la lista de lo que cargó (la primera vez, antes de que este guardián existiera): se guarda ya.
self.addEventListener('message', function(e){
  var d = e.data || {};
  if(d.tipo !== 'guardar' || !GUARDA || !Array.isArray(d.urls)) return;
  e.waitUntil(caches.open(CACHE).then(function(c){
    return Promise.all(d.urls.slice(0, 120).map(function(s){
      var u; try{ u = new URL(s, self.location.href); }catch(x){ return null; }
      if(!mismoSitio(u) || noTocar(u)) return null;
      var pagina = s === d.pagina, llave = pagina ? llavePagina(u) : u.origin + u.pathname + u.search;
      return c.match(llave).then(function(g){
        if(g) return null;
        return fetch(u.href, { credentials: 'same-origin' }).then(function(r){
          if(!guardable(r)) return null;
          return conVersion(u) ? guardarVersion(c, new Request(u.href), r) : c.put(llave, r);
        }).catch(function(){});
      });
    }));
  }).catch(function(){}));
});

self.addEventListener('push', function(e){
  var d = {};
  try{ d = e.data ? e.data.json() : {}; }catch(err){ d = { titulo: '💜 ORDEVA', cuerpo: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.titulo || '💜 ORDEVA', {
    body: d.cuerpo || '',
    icon: 'icons/ordeva-192.png',
    badge: 'icons/ordeva-64.png',
    tag: d.tag || 'vento-pago',
    renotify: true,
    vibrate: [150, 80, 150],
    data: { url: d.url || './' }
  }));
});

self.addEventListener('notificationclick', function(e){
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(lista){
    for(var i = 0; i < lista.length; i++){ if('focus' in lista[i]) return lista[i].focus(); }
    return self.clients.openWindow ? self.clients.openWindow(url) : null;
  }));
});
