// Avisos de pago de la app Android, SIN celular (Java):
//  • AvisoPagoPrueba: las reglas (qué es plata recibida, el valor, la frase) con avisos reales de DaviPlata, Nequi y Bre-B.
//  • EscuchaPrueba: la lectura completa (VentoEscucha) con los SMS reales del 85888 («Recibiste 200.», la conversación con
//    los mensajes viejos, dos pagos iguales seguidos, la llave Bre-B sin valor + el SMS, Nequi, «Pasaste»). Necesita la
//    librería de Android para compilar: VENTO_ANDROID_ALL=/ruta/android-all.jar (si no está, se omite esa parte).
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');
const raiz = path.join(__dirname, '..'), src = path.join(raiz, 'android/app/src/main/java/co/vento/app');
let ok = 0, mal = 0;
const correr = (cmd, args) => spawnSync(cmd, args, { encoding: 'utf8', env: Object.assign({}, process.env, { JAVA_TOOL_OPTIONS: '' }) });
function contar(salida, nombre){
  const m = /RESULTADO (\d+) bien (\d+) mal/.exec(salida || '');
  (salida || '').split('\n').filter(l => /^❌/.test(l)).forEach(l => console.log(l));
  if(!m){ mal++; console.log('❌ ' + nombre + ' no terminó: ' + String(salida).slice(-400)); return; }
  ok += +m[1]; mal += +m[2]; console.log((+m[2] ? '❌ ' : '✅ ') + nombre + ': ' + m[1] + ' bien, ' + m[2] + ' mal');
}
if(correr('javac', ['-version']).status !== 0){ console.log('RESULTADO 0 bien 0 mal (sin Java: se omitió)'); process.exit(0); }
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vento-java-'));
let r = correr('javac', ['-encoding', 'UTF-8', '-d', path.join(tmp, 'a'), path.join(src, 'AvisoPago.java'), path.join(__dirname, 'java/AvisoPagoPrueba.java')]);
if(r.status !== 0){ mal++; console.log('❌ No compila AvisoPago: ' + r.stderr.slice(0, 800)); }
else contar(correr('java', ['-Dstdout.encoding=UTF-8', '-cp', path.join(tmp, 'a'), 'co.vento.app.AvisoPagoPrueba']).stdout, 'Reglas de los avisos (AvisoPagoPrueba)');
const jar = process.env.VENTO_ANDROID_ALL;   // ej.: android-all de Robolectric (org.robolectric:android-all 14), solo para compilar
if(jar && fs.existsSync(jar)){
  const sim = path.join(__dirname, 'java/simulado');
  r = correr('javac', ['-nowarn', '-encoding', 'UTF-8', '-cp', jar, '-d', path.join(tmp, 'b'), path.join(src, 'VentoEscucha.java'), path.join(src, 'AvisoPago.java'),
    ...fs.readdirSync(sim).map(f => path.join(sim, f)), path.join(__dirname, 'java/EscuchaPrueba.java')]);
  if(r.status !== 0){ mal++; console.log('❌ No compila VentoEscucha: ' + r.stderr.slice(0, 800)); }
  else contar(correr('java', ['-Dstdout.encoding=UTF-8', '-cp', path.join(tmp, 'b') + path.delimiter + jar, 'co.vento.app.EscuchaPrueba']).stdout, 'Lectura de avisos y SMS reales (EscuchaPrueba)');
} else console.log('ℹ️ Sin la librería de Android (VENTO_ANDROID_ALL): se omitió la simulación de VentoEscucha.');
fs.rmSync(tmp, { recursive: true, force: true });
console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
