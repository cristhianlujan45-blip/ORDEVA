// ⚡ 1.65.3: el aviso de un pago AL INSTANTE en todos los celulares. El cliente en vivo de la app Android (EnVivo.java, Java
// puro) contra un servidor de mentira igual al de Supabase Realtime (Phoenix sobre WebSocket):
//  1. Se une al canal secreto del negocio con la llave pública y, al quedar unido, pregunta una vez (lo que llegó sin conexión).
//  2. El servidor avisa un pago → la app pregunta en ese instante (menos de 300 ms).
//  3. Ping → pong, y manda su latido para que el servidor no lo corte.
//  4. Un aviso de OTRO canal no hace nada; un mensaje en varias partes sí se entiende.
//  5. Si se cae la conexión, se vuelve a conectar y a unir solo.
'use strict';
const http = require('http'), crypto = require('crypto'), fs = require('fs'), os = require('os'), path = require('path');
const { spawnSync, spawn } = require('child_process');
let ok = 0, mal = 0;
const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 400) : '')); } };
if(spawnSync('javac', ['-version']).status !== 0){ console.log('RESULTADO 0 bien 0 mal (sin Java: se omitió)'); process.exit(0); }
const src = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'java', 'co', 'vento', 'app');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'envivo-'));
const c = spawnSync('javac', ['-encoding', 'UTF-8', '-d', tmp, path.join(src, 'EnVivo.java'), path.join(__dirname, 'java', 'EnVivoPrueba.java')], { encoding: 'utf8' });
if(c.status !== 0){ console.log('❌ No compila EnVivo.java: ' + c.stderr); console.log('RESULTADO 0 bien 1 mal'); process.exit(1); }
ok++; console.log('✅ EnVivo.java compila (Java puro, sin Android)');

const TOPIC = 'vp-' + 'a'.repeat(32);
const conexiones = [], recibidos = [];
function marco(op, datos){ const d = Buffer.from(datos); const h = d.length < 126 ? Buffer.from([0x80 | op, d.length]) : Buffer.from([0x80 | op, 126, d.length >> 8, d.length & 255]); return Buffer.concat([h, d]); }
const srv = http.createServer();
srv.on('upgrade', (req, sock) => {
  const k = req.headers['sec-websocket-key'];
  const acepta = crypto.createHash('sha1').update(k + '258EAFA5-E914-47DA-95CA-C5AB0DC11B76').digest('base64');
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + acepta + '\r\n\r\n');
  const cx = { sock, url: req.url, msgs: [], pongs: 0 }; conexiones.push(cx);
  let buf = Buffer.alloc(0);
  sock.on('data', d => {
    buf = Buffer.concat([buf, d]);
    while(buf.length >= 2){
      const op = buf[0] & 15, enm = (buf[1] & 128) !== 0; let n = buf[1] & 127, i = 2;
      if(n === 126){ if(buf.length < 4) return; n = buf.readUInt16BE(2); i = 4; }
      if(buf.length < i + (enm ? 4 : 0) + n) return;
      const m = enm ? buf.slice(i, i + 4) : null; i += enm ? 4 : 0;
      const p = Buffer.from(buf.slice(i, i + n)); if(m) for(let j = 0; j < p.length; j++) p[j] ^= m[j % 4];
      buf = buf.slice(i + n);
      cx.enmascarado = enm;
      if(op === 0xA){ cx.pongs++; continue; }
      if(op !== 1) continue;
      const j = JSON.parse(p.toString()); cx.msgs.push(j); recibidos.push(j);
      if(j.event === 'phx_join') sock.write(marco(1, JSON.stringify({ topic: j.topic, event: 'phx_reply', payload: { status: 'ok', response: {} }, ref: j.ref })));
    }
  });
  sock.on('error', () => {});
});
const espera = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const port = srv.address().port;
  const java = spawn('java', ['-cp', tmp, 'co.vento.app.EnVivoPrueba', String(port), TOPIC, '9000']);
  const avisos = [], pruebas = []; java.stdout.on('data', d => String(d).split('\n').forEach(l => { const m = /^AVISO (\d+)/.exec(l); if(m) avisos.push({ t: Date.now() }); const p = /^PRUEBA (\S+)/.exec(l); if(p) pruebas.push(p[1]); }));
  const hasta = async (f, ms) => { const t = Date.now(); while(Date.now() - t < ms){ if(f()) return true; await espera(20); } return false; };
  try{
    await hasta(() => conexiones.length && conexiones[0].msgs.some(m => m.event === 'phx_join'), 5000);
    const c0 = conexiones[0];
    const join = c0 && c0.msgs.find(m => m.event === 'phx_join');
    chk('1. Se conecta a /realtime/v1/websocket con la llave pública y se une al canal del negocio', !!join && /apikey=llave-publica/.test(c0.url) && join.topic === 'realtime:' + TOPIC && join.payload.config.private === false && join.payload.access_token === 'llave-publica', { url: c0 && c0.url, join });
    chk('1. Sus mensajes van enmascarados (como exige WebSocket)', c0 && c0.enmascarado === true);
    chk('1. Al quedar unido pregunta una vez (lo que llegó mientras no había conexión)', await hasta(() => avisos.length === 1, 2000), avisos.length);
    // 2. Un pago
    const t2 = Date.now();
    c0.sock.write(marco(1, JSON.stringify({ topic: 'realtime:' + TOPIC, event: 'broadcast', payload: { event: 'p', payload: { t: 1 }, type: 'broadcast' }, ref: null })));
    const llego = await hasta(() => avisos.length === 2, 2000);
    const ms = llego ? avisos[1].t - t2 : -1;
    chk('2. El servidor avisa un pago → la app pregunta al instante (' + ms + ' ms)', llego && ms < 300, ms);
    // 3. Ping y latido
    c0.sock.write(marco(9, 'hola'));
    chk('3. Ping → pong', await hasta(() => c0.pongs >= 1, 2000));
    chk('3. Manda su latido (heartbeat) para que no lo corten', await hasta(() => c0.msgs.some(m => m.topic === 'phoenix' && m.event === 'heartbeat'), 2000));
    // 4. Otro canal / mensaje en partes
    c0.sock.write(marco(1, JSON.stringify({ topic: 'realtime:vp-otro', event: 'broadcast', payload: {}, ref: null })));
    await espera(300);
    chk('4. Un aviso de OTRO canal no hace nada', avisos.length === 2, avisos.length);
    const txt = JSON.stringify({ topic: 'realtime:' + TOPIC, event: 'broadcast', payload: { event: 'p' }, ref: null });
    const a = Buffer.from(txt.slice(0, 20)), b = Buffer.from(txt.slice(20));
    c0.sock.write(Buffer.concat([Buffer.from([0x01, a.length]), a, Buffer.from([0x80, b.length]), b]));
    chk('4. Un aviso que llega en dos partes sí se entiende', await hasta(() => avisos.length === 3, 2000), avisos.length);
    // 4b. «🔔 Probar» (1.65.6): llega como «prueba» con el id del equipo; no cuenta como pago (no pregunta por pagos)
    const antesP = avisos.length;
    c0.sock.write(marco(1, JSON.stringify({ topic: 'realtime:' + TOPIC, event: 'broadcast', payload: { event: 'prueba', payload: { d: 'equipo-123' }, type: 'broadcast' }, ref: null })));
    chk('4. «🔔 Probar»: le llega a la app como prueba, con el id del equipo (y no pregunta por pagos)', await hasta(() => pruebas.includes('equipo-123'), 2000) && avisos.length === antesP, { pruebas, avisos: avisos.length });
    // 5. Se cae la conexión
    c0.sock.destroy();
    chk('5. Se cae la conexión: se vuelve a conectar y a unir solo', await hasta(() => conexiones.length >= 2 && conexiones[1].msgs.some(m => m.event === 'phx_join'), 5000), conexiones.length);
    chk('5. … y pregunta otra vez al volver (por si llegó un pago mientras estaba caída)', await hasta(() => avisos.length === 4, 3000), avisos.length);
    const t5 = Date.now();
    conexiones[1].sock.write(marco(1, JSON.stringify({ topic: 'realtime:' + TOPIC, event: 'broadcast', payload: { event: 'p' }, ref: null })));
    chk('5. … y los pagos siguen llegando al instante', await hasta(() => avisos.length === 5, 1000) && avisos[4].t - t5 < 300, avisos.length);
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  java.kill(); srv.close(); conexiones.forEach(c => c.sock.destroy());
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
