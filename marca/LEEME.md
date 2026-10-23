# ORDEVA · Identidad visual

**ORDEVA — TU NEGOCIO EN ORDEN.**

**El isotipo** es la «O» circular del logo del dueño:
- anillo con el corte diagonal «/», que forma dos interrupciones diagonales;
- centro vacío;
- simétrica y en blanco y negro.

Está reconstruida en vector con las medidas del logo original. No es una captura.

## Archivos (SVG, vectoriales)
| Archivo | Para qué |
|---|---|
| `ordeva-icono.svg` | Icono de la app: «O» blanca sobre cuadro negro redondeado, como el logo original |
| `ordeva-icono-claro.svg` | Icono invertido, para fondos oscuros |
| `ordeva-icono-maskable.svg` | Icono PWA «maskable»: la «O» queda dentro de la zona segura |
| `ordeva-android-primer-plano.svg` | Primer plano del icono adaptable de Android; el fondo negro lo pone el sistema |
| `ordeva-isotipo-negro.svg` / `-blanco.svg` | La «O» sola, para fondos claros u oscuros |
| `ordeva-logo-horizontal-negro.svg` / `-blanco.svg` | Logo completo con el eslogan: inicio de sesión, paneles, materiales comerciales |
| `ordeva-logo-vertical-negro.svg` / `-blanco.svg` | Logo vertical: pantallas de inicio, carteles |
| `ordeva-logo-nav-negro.svg` / `-blanco.svg` | Logo reducido para la barra de navegación, sin eslogan |

## PNG (`png/`)
- **Navegador:** `favicon-16/32/48.png`, `apple-touch-icon.png` (180).
- **PWA:** `ordeva-192/512.png` y `ordeva-maskable-192/512.png`.
- **Android:** `android/mipmap-*/ic_launcher.png` (48 dp) e `ic_launcher_foreground.png` (108 dp, adaptable).
- **Correos y documentos:** `ordeva-logo-correo.png` (600 px) y `ordeva-logo-correo-blanco.png`.

## Reglas
- **Colores:** negro `#000`, blanco `#fff` y grises. Nada de colores en el logo.
- **No deformar ni girar.** El corte va siempre en «/», de arriba a la derecha hacia abajo a la izquierda.
- **Espacio libre** alrededor del logo: al menos el grosor del anillo.
- **Letras:** Inter (licencia OFL), convertida a trazos. Se ve igual en todos los equipos.

## Volver a generar
```
python3 marca/generar.py                                                    # SVG (necesita fontTools y las fuentes Inter)
NODE_PATH=pruebas/node_modules PLAYWRIGHT_PATH=/opt/node22/lib/node_modules/playwright node marca/png.js   # PNG
```
