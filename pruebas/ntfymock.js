// Canal en vivo simulado para las pruebas (sin servidor): POST guarda y la lectura devuelve lo guardado.
// Atiende las funciones del servidor de Vento (rpc/canal_publicar y rpc/canal_leer, que usa lib/vento-canal.js)
// y también las direcciones viejas de ntfy.sh.
module.exports = function(ctx){
  const msgs = []; let n = 0;
  const handler = async r => {
    const req = r.request(), u = new URL(req.url());
    const rpc = /\/rest\/v1\/rpc\/(canal_publicar|canal_leer)$/.exec(u.pathname);
    if(rpc){
      const b = JSON.parse(req.postData() || '{}'), cors = { 'access-control-allow-origin': '*', 'content-type': 'application/json' };
      if(rpc[1] === 'canal_publicar'){ const m = { id: String(++n), time: Math.floor(Date.now() / 1000), event: 'message', topic: b.p_canal, message: b.p_cuerpo || '' }; msgs.push(m); await r.fulfill({ status: 200, body: JSON.stringify(m), headers: cors }); return true; }
      const l = msgs.filter(m => (b.p_canales || []).includes(m.topic) && (b.p_desde_id == null || +m.id > +b.p_desde_id) && (b.p_desde == null || m.time >= b.p_desde));
      await r.fulfill({ status: 200, body: JSON.stringify(l), headers: cors }); return true;
    }
    if(u.hostname !== 'ntfy.sh') return false;
    const parts = u.pathname.replace(/^\//, '').split('/'), topics = (parts[0] || '').split(',');
    if(req.method() === 'POST'){ const m = { id: String(++n), time: Math.floor(Date.now() / 1000), event: 'message', topic: topics[0], message: req.postData() || '' }; msgs.push(m); await r.fulfill({ status: 200, body: JSON.stringify(m), headers: { 'access-control-allow-origin': '*' } }); return true; }
    const mine = msgs.filter(m => topics.includes(m.topic));
    if(parts[1] === 'json') await r.fulfill({ status: 200, body: mine.map(m => JSON.stringify(m)).join('\n') + '\n', headers: { 'access-control-allow-origin': '*' } });
    else if(parts[1] === 'sse') await r.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream', 'access-control-allow-origin': '*' }, body: 'retry: 800\n\n' + mine.map(m => 'event: message\ndata: ' + JSON.stringify(m) + '\n\n').join('') });
    else await r.fulfill({ status: 200, body: '' });
    return true;
  };
  return { msgs, handler };
};
