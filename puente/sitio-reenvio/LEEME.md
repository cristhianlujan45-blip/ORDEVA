# Reenvío de la dirección vieja (…github.io/cuentas/ → …github.io/ORDEVA/)

Cuando el repositorio pasó de «cuentas» a «ORDEVA», GitHub Pages dejó de servir `…github.io/cuentas/`. Ya se
arreglaron los QR (Netlify) y las apps de Android y PC (1.55.2), pero todavía quedan apuntando a la dirección vieja:
- los accesos directos y las PWA que se instalaron desde el navegador;
- los enlaces guardados;
- los correos viejos.

Este sitio de reenvío los arregla. GitHub sirve en `https://cristhianlujan45-blip.github.io/` el repositorio especial
**`cristhianlujan45-blip.github.io`**. Todo lo que no es de otro repositorio (como `/cuentas/…`) cae en su `404.html`,
que reenvía a `/ORDEVA/…` con los mismos datos (`?mesa=…`, `#…`).

## Cómo crearlo (una sola vez, 2 minutos)
1. En GitHub: **New repository** → nombre exacto **`cristhianlujan45-blip.github.io`** → **Public** → **Create**.
2. **Add file → Upload files** y sube `404.html` e `index.html` de esta carpeta. Luego **Commit changes**.
3. **Settings → Pages**: «Deploy from a branch», rama `main`, carpeta `/ (root)` → **Save**.
4. En 1–2 minutos, `https://cristhianlujan45-blip.github.io/cuentas/pedido.html?mesa=1` debe abrir
   `…/ORDEVA/pedido.html?mesa=1`.

**No** cree un repositorio llamado «cuentas»: rompería la redirección de GitHub que usan las actualizaciones de las
apps.
