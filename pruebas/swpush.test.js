// 🔔 1.65.5: la notificación push de un pago (sw.js), con el equipo bloqueado o ORDEVA cerrada. Se carga sw.js de verdad
// con un «navegador» de mentira y se le manda una push:
//  1. Pago nuevo: sale la notificación con su valor, suena (renotify) y queda hasta que la toquen (requireInteraction).
//  2. Si ORDEVA abierta en ese equipo ya mostró ESE pago (misma marca «pago-<id>»): se deja al día SIN sonar otra vez.
//  3. Otra push que no es de un pago: sale normal.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
let ok = 0, mal = 0;
const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 400) : '')); } };
const codigo = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
function sw(yaMostradas){
  const oyentes = {}, mostradas = [];
  const self = {
    location: new URL('https://cristhianlujan45-blip.github.io/ORDEVA/sw.js'),
    addEventListener: (t, f) => { oyentes[t] = f; }, skipWaiting(){}, clients: { claim(){}, matchAll: () => Promise.resolve([]) },
    registration: {
      getNotifications: ({ tag }) => Promise.resolve(yaMostradas.filter(x => x.tag === tag)),
      showNotification: (t, o) => { mostradas.push(Object.assign({ titulo: t }, o)); return Promise.resolve(); }
    }
  };
  vm.runInNewContext(codigo, { self, caches: { keys: () => Promise.resolve([]), open: () => Promise.resolve({}) }, fetch: () => Promise.reject(new Error('sin red')), URL, Promise, setTimeout, clearTimeout, console });
  return { push: async d => { let p; oyentes.push({ data: { json: () => d, text: () => JSON.stringify(d) }, waitUntil: x => { p = x; } }); await p; return mostradas; } };
}
(async () => {
  try{
    let m = await sw([]).push({ titulo: '✅ Pago confirmado', cuerpo: '$20.000 por Nequi', tag: 'pago-abc', url: './' });
    chk('1. Pago nuevo: notificación «✅ Pago confirmado · $20.000 por Nequi», suena y queda hasta que la toquen', m.length === 1 && /20\.000/.test(m[0].body) && m[0].renotify === true && m[0].requireInteraction === true && m[0].tag === 'pago-abc', m);
    m = await sw([{ tag: 'pago-abc' }]).push({ titulo: '✅ Pago confirmado', cuerpo: '$20.000 por Nequi', tag: 'pago-abc' });
    chk('2. ORDEVA abierta ya mostró ese pago: se deja al día sin sonar otra vez', m.length === 1 && m[0].renotify === false, m);
    m = await sw([]).push({ titulo: '🎧 Soporte', cuerpo: 'Hola', tag: 'soporte' });
    chk('3. Otra push (no es un pago): sale normal, sin quedarse fija', m.length === 1 && m[0].renotify === true && m[0].requireInteraction === false, m);
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
