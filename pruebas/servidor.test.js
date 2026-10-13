// Corre dentro de «bash pruebas/correr.sh» las pruebas del SERVIDOR (PostgreSQL 16 real), sin navegador:
//   pruebas/servidor/suscripciones.test.js   suscripciones de Vento
//   pruebas/servidor/daviplata.test.js       pagos con la API oficial «Pago con DaviPlata» (vento-pagos)
// Si el equipo no tiene PostgreSQL instalado lo dice y no falla (las pruebas del navegador no lo necesitan).
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function hayPostgres() {
  if (process.env.VENTO_PG_URL) return true;
  if (fs.existsSync('/usr/lib/postgresql')) return true;
  return spawnSync('bash', ['-c', 'command -v psql || command -v pg_ctl'], { stdio: 'ignore' }).status === 0;
}
function hayModulos() {
  try { require.resolve('pg', { paths: [__dirname] }); require.resolve('@supabase/supabase-js', { paths: [__dirname] }); return true; } catch (e) { return false; }
}

if (!hayModulos()) {
  console.log('❌ Faltan los paquetes de las pruebas del servidor: corre «cd pruebas && npm install».');
  console.log('RESULTADO 0 bien 1 mal');
  process.exit(1);
}
if (!hayPostgres()) {
  console.log('RESULTADO 0 bien 0 mal (este equipo no tiene PostgreSQL: se omitieron las pruebas del servidor; instala PostgreSQL 16 o define VENTO_PG_URL)');
  process.exit(0);
}
let fallo = 0;
for (const f of ['suscripciones.test.js', 'daviplata.test.js']) {
  console.log('— servidor/' + f);
  const r = spawnSync(process.execPath, [path.join(__dirname, 'servidor', f)], { stdio: 'inherit', env: process.env, timeout: 110000 });
  if (r.status !== 0) fallo = 1;
}
process.exit(fallo);
