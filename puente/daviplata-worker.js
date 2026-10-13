/* Puente TLS mutuo para la API «Pago con DaviPlata» (Cloudflare Worker, plan gratis).
 *
 * Por qué existe: DaviPlata exige que CADA llamada presente el certificado de cliente (.cer + llave .pem) que entrega su
 * Developer Portal (TLS mutuo). Si el Servidor Vento (Supabase Edge Function) no puede presentarlo, este Worker lo hace con
 * el enlace «mTLS certificates» de Cloudflare: el certificado queda guardado en Cloudflare y nunca viaja en las peticiones.
 * El Worker SOLO reenvía las 4 rutas de «Pago con DaviPlata» a apislab.daviplata.com (laboratorio) o apis.daviplata.com
 * (producción), y solo si la petición trae el secreto compartido con Vento.
 *
 * Protocolo (lo usa supabase/functions/vento-pagos/daviplata.ts en modo «puente»):
 *   POST <url del Worker>   cabecera  X-Vento-Puente: <VENTO_PUENTE_SECRETO>
 *   cuerpo JSON  { "ambiente": "sandbox" | "produccion", "ruta": "/daviplata/v1/compra", "headers": {…}, "cuerpo": "<texto>" }
 *   → responde con el estado y el cuerpo EXACTOS de DaviPlata. Los errores propios del puente traen la cabecera
 *     X-Puente-Error (secreto | sin_secreto | sin_certificado | ruta | pedido | red).
 *
 * Instalación (una sola vez):
 *   1. En conectesunegocio.daviplata.com → Guía de inicio → paso 4 «Descargar certificados» (un .cer y un .pem por ambiente).
 *      Si el .cer es binario (no empieza por «-----BEGIN CERTIFICATE-----»), conviértelo:
 *        openssl x509 -inform der -in BancoDaviviendalab_2022.cer -out daviplata-lab.pem
 *   2. Sube el certificado a Cloudflare (te devuelve un certificate_id):
 *        npx wrangler mtls-certificate upload --cert daviplata-lab.pem --key BancoDaviviendalab_2022.pem --name daviplata-lab
 *        npx wrangler mtls-certificate upload --cert daviplata-prod.pem --key llave-prod.pem --name daviplata-prod
 *   3. Crea puente/daviplata-wrangler.jsonc con:
 *        {
 *          "name": "vento-daviplata",
 *          "main": "daviplata-worker.js",
 *          "compatibility_date": "2025-01-01",
 *          "mtls_certificates": [
 *            { "binding": "DAVIPLATA",     "certificate_id": "<id de daviplata-prod>" },
 *            { "binding": "DAVIPLATA_LAB", "certificate_id": "<id de daviplata-lab>" }
 *          ]
 *        }
 *      (si solo usas un ambiente, basta con «DAVIPLATA»: sirve para los dos).
 *   4. El secreto compartido (una frase larga al azar, ≥ 16 caracteres; la misma que pegas en Vento):
 *        npx wrangler secret put VENTO_PUENTE_SECRETO -c daviplata-wrangler.jsonc
 *   5. npx wrangler deploy -c daviplata-wrangler.jsonc   → https://vento-daviplata.<tu-cuenta>.workers.dev
 *   6. En Vento → Ajustes → 💜 Pagos → Conectar DaviPlata → «Por mi puente de Cloudflare»: pega la URL y el secreto → Comprobar.
 */
const HOSTS = { sandbox: 'https://apislab.daviplata.com', produccion: 'https://apis.daviplata.com' };
const RUTAS = new Set(['/oauth2Provider/type1/v1/token', '/daviplata/v1/compra', '/otpSec/v1/read', '/daviplata/v1/confirmarCompra']);
const SOLO_LAB = new Set(['/otpSec/v1/read']);
const CABECERAS = ['authorization', 'x-ibm-client-id', 'content-type', 'accept'];
const MAX_BYTES = 16 * 1024;

const error = (codigo, status, mensaje) => new Response(JSON.stringify({ error: codigo, mensaje }), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'x-puente-error': codigo, 'cache-control': 'no-store' },
});

// Comparación en tiempo constante.
function iguales(a, b){
  a = String(a || ''); b = String(b || '');
  let r = a.length === b.length ? 0 : 1;
  for(let i = 0; i < Math.max(a.length, b.length); i++) r |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return r === 0 && a.length > 0;
}

export default {
  async fetch(request, env){
    if(request.method !== 'POST') return error('ruta', 405, 'Solo POST');
    const secreto = String(env.VENTO_PUENTE_SECRETO || '');
    if(secreto.length < 16) return error('sin_secreto', 500, 'Falta VENTO_PUENTE_SECRETO (wrangler secret put)');
    if(!iguales(request.headers.get('x-vento-puente'), secreto)) return error('secreto', 401, 'Secreto incorrecto');
    if(Number(request.headers.get('content-length') || 0) > MAX_BYTES) return error('pedido', 413, 'Pedido demasiado grande');
    const texto = await request.text();
    if(texto.length > MAX_BYTES) return error('pedido', 413, 'Pedido demasiado grande');
    let p;
    try{ p = JSON.parse(texto); }catch(e){ return error('pedido', 400, 'JSON inválido'); }
    const ambiente = p && p.ambiente === 'produccion' ? 'produccion' : p && p.ambiente === 'sandbox' ? 'sandbox' : null;
    if(!ambiente || !RUTAS.has(p.ruta) || (SOLO_LAB.has(p.ruta) && ambiente !== 'sandbox')) return error('ruta', 404, 'Ruta no permitida');
    const enlace = ambiente === 'sandbox' ? (env.DAVIPLATA_LAB || env.DAVIPLATA) : env.DAVIPLATA;
    if(!enlace || typeof enlace.fetch !== 'function') return error('sin_certificado', 500, 'Falta el enlace mtls_certificates DAVIPLATA');
    // Solo las cabeceras que usa la API (nada de cabeceras de Cloudflare ni del Servidor Vento).
    const h = {};
    const entrada = p.headers && typeof p.headers === 'object' ? p.headers : {};
    for(const k of Object.keys(entrada)){ if(CABECERAS.includes(k.toLowerCase())) h[k.toLowerCase()] = String(entrada[k]).slice(0, 4000); }
    try{
      const r = await enlace.fetch(HOSTS[ambiente] + p.ruta, { method: 'POST', headers: h, body: typeof p.cuerpo === 'string' ? p.cuerpo : '' });
      const out = await r.text();
      return new Response(out, { status: r.status, headers: { 'content-type': r.headers.get('content-type') || 'application/json', 'cache-control': 'no-store' } });
    }catch(e){
      return error('red', 502, 'DaviPlata no respondió');
    }
  }
};
