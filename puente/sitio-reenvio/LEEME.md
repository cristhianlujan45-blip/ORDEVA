# Reenvío de la dirección vieja (…github.io/cuentas/ → …github.io/ORDEVA/)

Cuando el repositorio pasó de «cuentas» a «ORDEVA», GitHub Pages dejó de servir `…github.io/cuentas/`. Ya se
arreglaron las apps de Android y PC (1.55.2), pero todavía quedan apuntando a la dirección vieja:
- los accesos directos y las PWA que se instalaron desde el navegador;
- los enlaces guardados;
- los correos viejos.

Este sitio de reenvío los arregla. GitHub sirve en `https://cristhianlujan45-blip.github.io/` el repositorio especial
**`cristhianlujan45-blip.github.io`**. Todo lo que no es de otro repositorio (como `/cuentas/…`) cae en su `404.html`,
que reenvía a `/ORDEVA/…` con los mismos datos (`?mesa=…`, `#…`).

## Estado: publicado (1.93.0)
El repositorio `cristhianlujan45-blip.github.io` ya existe y sirve estas páginas. Si se cambian aquí, hay que copiarlas
allá también.

## Cómo se creó (una sola vez, 2 minutos)
1. En GitHub: **New repository** → nombre exacto **`cristhianlujan45-blip.github.io`** → **Public** → «Add a README
   file» → **Create**. (La app de Claude no puede crear repositorios en la cuenta: GitHub responde 403.)
2. Claude sube `404.html`, `index.html`, `README.md` y `.nojekyll` de esta carpeta (o **Add file → Upload files**).
3. **Settings → Pages**: «Deploy from a branch», rama `main`, carpeta `/ (root)` → **Save**.
4. En 1–2 minutos, `https://cristhianlujan45-blip.github.io/cuentas/pedido.html?mesa=1` debe abrir
   `…/ORDEVA/pedido.html?mesa=1`.

**No** cree un repositorio llamado «cuentas»: rompería la redirección de GitHub que usan las actualizaciones de las
apps.

## Qué hace
- Reenvía `/cuentas/<lo que sea>?<datos>#<datos>` a `/ORDEVA/<lo mismo>` (también `/` y `/index.html` → `/ORDEVA/`).
- Si el celular tiene la app vieja instalada (service worker de `/cuentas/`), la quita antes de reenviar. No toca los
  datos: ORDEVA guarda lo suyo en el mismo sitio (`…github.io`).
- Prueba: `pruebas/reenvio.test.js` (9), con un servidor local que imita a GitHub Pages.

## Netlify ya no se usa (1.55.5)
- **Netlify se quitó del proyecto.** Los QR los hace ORDEVA.
- **Los QR pegados con la dirección de Netlify** (`joyful-basbousa-0bc49b.netlify.app`) servían una copia vieja con
  ntfy.sh, que ya no funciona. **Reimprímalos** desde la app: Ajustes → QR de las mesas. El canal y los códigos de
  cada mesa no cambian.
- **Luego puede borrar el sitio en Netlify.**
