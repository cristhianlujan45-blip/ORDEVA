// ORDEVA · PNG de la identidad (a partir de los SVG de marca/, con el navegador de Playwright).
// Uso:  node marca/png.js          (después de python3 marca/generar.py)
// Sale en marca/png/: favicon, icono de Apple, PWA (normal y «maskable»), Android (todas las densidades, normal y
// adaptable) y el logo para correos y documentos.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('fs'), path = require('path');
const D = __dirname, OUT = path.join(D, 'png');

const LISTA = [
  // [svg, archivo, ancho, alto]
  ['ordeva-icono.svg', 'favicon-16.png', 16], ['ordeva-icono.svg', 'favicon-32.png', 32], ['ordeva-icono.svg', 'favicon-48.png', 48],
  ['ordeva-icono.svg', 'apple-touch-icon.png', 180],
  ['ordeva-icono.svg', 'ordeva-192.png', 192], ['ordeva-icono.svg', 'ordeva-512.png', 512],
  ['ordeva-icono-maskable.svg', 'ordeva-maskable-192.png', 192], ['ordeva-icono-maskable.svg', 'ordeva-maskable-512.png', 512],
  ['ordeva-icono.svg', 'ordeva-64.png', 64],
  // Android: ic_launcher (48 dp) y el primer plano del icono adaptable (108 dp), en cada densidad
  ...[['mdpi', 1], ['hdpi', 1.5], ['xhdpi', 2], ['xxhdpi', 3], ['xxxhdpi', 4]].flatMap(([d, k]) => [
    ['ordeva-icono.svg', 'android/mipmap-' + d + '/ic_launcher.png', Math.round(48 * k)],
    ['ordeva-android-primer-plano.svg', 'android/mipmap-' + d + '/ic_launcher_foreground.png', Math.round(108 * k)],
  ]),
  // Correos y documentos
  ['ordeva-logo-horizontal-negro.svg', 'ordeva-logo-correo.png', 600, 0],
  ['ordeva-logo-horizontal-blanco.svg', 'ordeva-logo-correo-blanco.png', 600, 0],
];

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  for (const [svg, arch, w, h0] of LISTA) {
    const s = fs.readFileSync(path.join(D, svg), 'utf8');
    const vb = s.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
    const h = h0 === 0 ? Math.round(w * vb[3] / vb[2]) : (h0 || w);
    await p.setViewportSize({ width: w, height: h });
    await p.setContent('<html><body style="margin:0;background:transparent">' + s.replace('<svg ', '<svg width="' + w + '" height="' + h + '" ') + '</body></html>');
    const dest = path.join(OUT, arch);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    await p.screenshot({ path: dest, omitBackground: true, clip: { x: 0, y: 0, width: w, height: h } });
  }
  await b.close();
  console.log('Listo:', LISTA.length, 'PNG en', OUT);
})();
