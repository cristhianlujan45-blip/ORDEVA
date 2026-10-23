// 🔐 Contraseña local con PBKDF2 (ORDEVA 1.57.0, auditoría ORDEVA R8): la contraseña de cada usuario en el celular.
//  • Un usuario nuevo queda guardado con PBKDF2 («p2:…»), nunca la contraseña.
//  • Uno guardado a la antigua (SHA-256) sigue entrando y se pasa solo a PBKDF2 al entrar bien.
//  • Una contraseña equivocada no entra (ni con la vieja ni con la nueva forma).
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = (process.env.VENTO_BASE || 'http://localhost:8765') + '/index.html';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 400) : '')); } };
  try{
    const ctx = await b.newContext();
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('vento-guia-tour', '1'); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE, { waitUntil: 'load' }); await p.waitForTimeout(2000);
    const r = await p.evaluate(async () => {
      const o = {};
      const msg = await authAddUser('ana', 'clave123', 'admin');
      const ana = authUsers().find(x => x.user === 'ana');
      o.nuevo = { msg, p2: String(ana.hash).startsWith('p2:'), sinClave: !localStorage.getItem(AUTH_USERS_KEY).includes('clave123') };
      o.anaBien = await authClaveOk(ana, 'clave123'); o.anaMal = await authClaveOk(ana, 'clave124');
      // Uno guardado a la antigua (como en las versiones anteriores)
      const us = authUsers(); const salt = 'salvieja'; us.push({ user: 'pedro', salt, hash: await authHash('viejita99', salt), role: 'staff' });
      localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(us));
      let pedro = authUsers().find(x => x.user === 'pedro');
      o.viejoAntes = /^[0-9a-f]{64}$/.test(pedro.hash);
      o.viejoMal = await authClaveOk(pedro, 'viejita98');
      o.viejoSigueViejo = /^[0-9a-f]{64}$/.test(authUsers().find(x => x.user === 'pedro').hash);
      o.viejoBien = await authClaveOk(pedro, 'viejita99');
      pedro = authUsers().find(x => x.user === 'pedro');
      o.viejoPasado = String(pedro.hash).startsWith('p2:');
      o.otraVez = await authClaveOk(pedro, 'viejita99'); o.otraVezMal = await authClaveOk(pedro, 'viejita9');
      return o;
    });
    chk('Usuario nuevo: guardado con PBKDF2 («p2:»), sin la contraseña en la memoria del celular', !r.nuevo.msg && r.nuevo.p2 && r.nuevo.sinClave, r.nuevo);
    chk('Entra con su contraseña y no con otra', r.anaBien === true && r.anaMal === false, r);
    chk('Guardado a la antigua: una contraseña equivocada no entra (y no se toca lo guardado)', r.viejoAntes && r.viejoMal === false && r.viejoSigueViejo, r);
    chk('Guardado a la antigua: con la contraseña correcta entra y se pasa solo a PBKDF2', r.viejoBien === true && r.viejoPasado, r);
    chk('Después de pasarse, sigue entrando con la misma contraseña (y no con otra)', r.otraVez === true && r.otraVezMal === false, r);
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs);
  await b.close();
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
