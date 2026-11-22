// Carga supabase/functions/vento-ia/index.ts con un «Deno» simulado y prueba el puente del YouTube del TV (1.99.37).
// YouTube también es simulado (fetch): se revisa qué se le reenvía. Lo corre pruebas/puentetv1937.test.js.
let manejador: ((r: Request) => Promise<Response>) | null = null;
(globalThis as any).Deno = { serve: (f: any) => { manejador = f; }, env: { get: (k: string) => ({ VENTO_ORIGENES: 'https://ordeva.co' } as any)[k] } };
const llamadas: any[] = [];
const fetchReal = globalThis.fetch;
globalThis.fetch = (async (url: any, o: any = {}) => {
  llamadas.push({ url: String(url), metodo: o.method, token: o.headers && o.headers['X-YouTube-LoungeId-Token'], cuerpo: String(o.body || '') });
  if (/\/api\/lounge\/pairing\/get_screen/.test(String(url))) return new Response('{"screen":{"screenId":"abc","loungeToken":"tok1","expiration":0,"name":"TV Sala"}}', { status: 200 });
  return new Response('[[0,["c","SID",""]]]', { status: 200 });
}) as any;
await import('../../supabase/functions/vento-ia/index.ts');
const pedir = (ruta: string, o: any = {}) => manejador!(new Request('https://x.supabase.co/functions/v1/vento-ia' + ruta, o));
const res: Record<string, unknown> = {};
let r = await pedir('/lounge/pairing/get_screen', { method: 'POST', headers: { Origin: 'https://ordeva.co', 'content-type': 'application/x-www-form-urlencoded' }, body: 'pairing_code=123456789012' });
res.parear = { status: r.status, cuerpo: await r.text(), cors: r.headers.get('access-control-allow-origin'), reenvio: llamadas[0] };
r = await pedir('/lounge/bc/bind?RID=1&VER=8', { method: 'POST', headers: { Origin: 'https://ordeva.co', 'X-YouTube-LoungeId-Token': 'tok1' }, body: 'count=0' });
res.bind = { status: r.status, reenvio: llamadas[1] };
r = await pedir('/lounge/../../watch', { method: 'POST', headers: { Origin: 'https://ordeva.co' }, body: '' });
res.otraRuta = { status: r.status, llamadas: llamadas.length };
r = await pedir('/lounge/pairing/get_screen', { method: 'GET', headers: { Origin: 'https://ordeva.co' } });
res.get = { status: r.status };
r = await pedir('/lounge/pairing/get_screen', { method: 'POST', headers: { Origin: 'https://malo.com' }, body: 'x=1' });
res.origenMalo = { status: r.status, llamadas: llamadas.length };
r = await pedir('/lounge/pairing/get_screen', { method: 'POST', headers: { Origin: 'https://ordeva.co' }, body: 'x'.repeat(70000) });
res.grande = { status: r.status };
let ultimo = 0; for (let i = 0; i < 260; i++) { const q = await pedir('/lounge/bc/bind', { method: 'POST', headers: { Origin: 'https://ordeva.co', 'x-forwarded-for': '9.9.9.9' }, body: 'a=1' }); ultimo = q.status; if (q.status === 429) { res.tope = { en: i + 1 }; break; } }
r = await pedir('/lounge/bc/bind', { method: 'OPTIONS', headers: { Origin: 'https://ordeva.co', 'Access-Control-Request-Headers': 'x-youtube-loungeid-token' } });
res.preflight = { status: r.status, headers: r.headers.get('access-control-allow-headers') };
globalThis.fetch = fetchReal;
console.log(JSON.stringify(res));
