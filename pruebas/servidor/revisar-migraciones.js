// Revisa las migraciones ANTES de tocar la base de datos de producción (lo corre .github/workflows/servidor-vento.yml).
//  1. Ninguna migración NUEVA borra datos: DROP TABLE / DROP SCHEMA / DROP COLUMN, TRUNCATE, DELETE o UPDATE sin WHERE
//     (fuera de las funciones, que corren después y con sus propias condiciones). Si de verdad hace falta, una persona
//     escribe en ese archivo la línea «-- vento:destructiva-aprobada» y queda a la vista en el despliegue.
//  2. TODAS las migraciones se aplican, en orden, sobre un PostgreSQL vacío con lo mínimo de Supabase (stub.sql), igual
//     que en las pruebas. Si una falla, no se despliega nada.
// Uso: node pruebas/servidor/revisar-migraciones.js [migraciones nuevas…]
//      VENTO_PG_URL = el PostgreSQL de prueba (por defecto postgres://postgres:postgres@127.0.0.1:5432/postgres).
//      Sin archivos: solo revisa que se apliquen todas (paso 2).
const fs = require('fs'), path = require('path');
const RAIZ = path.resolve(__dirname, '..', '..');
const MIG = path.join(RAIZ, 'supabase', 'migrations'), STUB = path.join(__dirname, 'stub.sql');

// Quita comentarios y cuerpos $$…$$ (funciones): lo que queda es lo que corre al aplicar la migración.
function sentenciasSueltas(sql) {
  return sql.replace(/--[^\n]*/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\$([A-Za-z_]*)\$[\s\S]*?\$\1\$/g, ' ')
    .split(';').map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
}
const REGLAS = [
  [/^drop\s+table\b/i, 'borra una tabla (DROP TABLE)'],
  [/^drop\s+schema\b/i, 'borra un esquema (DROP SCHEMA)'],
  [/^alter\s+table\b.*\bdrop\s+(column\b|(?!constraint\b|policy\b|trigger\b|index\b|default\b|not\s+null\b)\w)/i, 'borra una columna (ALTER TABLE … DROP COLUMN)'],
  [/^truncate\b/i, 'vacía una tabla (TRUNCATE)'],
  [/^delete\s+from\b(?!.*\bwhere\b)/i, 'borra todas las filas (DELETE sin WHERE)'],
  [/^update\s+\S+\s+set\b(?!.*\bwhere\b)/i, 'cambia todas las filas (UPDATE sin WHERE)'],
];
function destructivas(archivo) {
  const sql = fs.readFileSync(archivo, 'utf8');
  if (/--\s*vento:destructiva-aprobada/i.test(sql)) return { aprobada: true, hallazgos: [] };
  const hallazgos = [];
  for (const s of sentenciasSueltas(sql)) for (const [re, que] of REGLAS) if (re.test(s)) hallazgos.push(que + ': ' + s.slice(0, 160));
  return { aprobada: false, hallazgos };
}

async function aplicarTodas() {
  const { Client } = require('pg');
  const url = process.env.VENTO_PG_URL || 'postgres://postgres:postgres@127.0.0.1:5432/postgres';
  const admin = new Client({ connectionString: url }); await admin.connect();
  const base = 'vento_revision_' + process.pid;
  await admin.query('drop database if exists ' + base);
  await admin.query('create database ' + base);
  const u = new URL(url); u.pathname = '/' + base;
  const c = new Client({ connectionString: u.toString() }); await c.connect();
  const archivos = [STUB].concat(fs.readdirSync(MIG).filter((f) => f.endsWith('.sql')).sort().map((f) => path.join(MIG, f)));
  try {
    for (const f of archivos) {
      try { await c.query(fs.readFileSync(f, 'utf8')); } catch (e) { throw new Error('Falló ' + path.relative(RAIZ, f) + ': ' + e.message); }
    }
    // Lo que se revisó en la auditoría: todas las tablas con RLS.
    const sin = (await c.query("select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity")).rows.map((r) => r.relname);
    if (sin.length) throw new Error('Tablas sin RLS (cualquiera con la clave pública podría leerlas): ' + sin.join(', '));
    return archivos.length - 1;
  } finally { await c.end(); await admin.query('drop database if exists ' + base + ' with (force)').catch(() => {}); await admin.end(); }
}

(async () => {
  let mal = 0;
  // 1.65.9: dos migraciones con la MISMA versión (el número del principio) hacen que «supabase db push» se confunda:
  // cree que una ya está aplicada y vuelve a correr la otra (pasó con 20261118000000). Cada versión, una sola vez.
  const porVersion = {};
  fs.readdirSync(MIG).filter((f) => f.endsWith('.sql')).forEach((f) => { const v = f.split('_')[0]; (porVersion[v] = porVersion[v] || []).push(f); });
  const repetidas = Object.keys(porVersion).filter((v) => porVersion[v].length > 1);
  if (repetidas.length) { mal++; console.log('❌ Migraciones con la misma versión (renombra una con un número nuevo): ' + repetidas.map((v) => porVersion[v].join(' y ')).join('; ')); }
  else console.log('✅ Cada migración tiene su propia versión');
  const nuevas = process.argv.slice(2).filter((f) => /\.sql$/.test(f) && fs.existsSync(path.resolve(RAIZ, f)));
  for (const f of nuevas) {
    const r = destructivas(path.resolve(RAIZ, f));
    if (r.aprobada) console.log('::warning title=Migración destructiva aprobada::' + f + ' dice «vento:destructiva-aprobada»: se aplica bajo responsabilidad de quien la aprobó.');
    else if (r.hallazgos.length) { mal++; r.hallazgos.forEach((h) => console.log('::error title=Migración que borra datos::' + f + ' — ' + h)); }
    else console.log('✅ ' + f + ': no borra datos');
  }
  try { const n = await aplicarTodas(); console.log('✅ Las ' + n + ' migraciones se aplican sobre una base vacía, y todas las tablas tienen RLS'); }
  catch (e) { mal++; console.log('::error title=Las migraciones no se aplican::' + e.message); }
  if (mal) { console.log('❌ No se despliega: arregla lo de arriba.'); process.exit(1); }
  console.log('✅ Migraciones revisadas: se puede desplegar.');
})();
