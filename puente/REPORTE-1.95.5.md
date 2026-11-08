# ORDEVA 1.95.5 · Textos que se leen, pago por transferencia y música que sigue lo que piden

**Pedido del dueño (08/11, con capturas del celular):**
- «Rectifica también otra vez el tema de YouTube, de la música, porque cuando por ejemplo la gente escribe el nombre mal de
  la canción… no suena o se pone otra cosa».
- «La lista no está siguiendo la playlist, está poniendo canciones aleatoriamente, no pone las canciones que está pidiendo
  la gente».
- «Corrige también los textos… que no se alcanzan a leer bien».
- «No solamente ya pagué por Nequi… que ya pagué por transferencia… es mejor que sea el Bre-B porque para recibir
  transferencias desde otro banco… mira cómo organizar esa información bien».

## Qué pasaba y qué cambió
| Qué pasaba | Qué cambió |
|---|---|
| **Panel «🛍️ Pedidos» (tiendas):** con el tema oscuro, la tarjeta salía blanca y la letra casi blanca. No se leía nada. El panel usaba un color que el tema no tiene (`--card`) y caía en blanco. | La tarjeta usa el fondo del tema (`--surface`) y su letra. Se lee en el tema claro y en el oscuro. Lo mismo en un texto de las solicitudes de las agencias. |
| **Pago por transferencia:** solo «💜 Paga con Nequi» con «Ya pagué por Nequi», y en el QR otro «Ya pagué». | Un solo recuadro **«💸 Paga por transferencia»**: primero la **llave Bre-B**, que recibe desde cualquier banco, y después Nequi, cada una con «📋 Copiar». Debajo, un solo **«✅ Ya pagué por transferencia»**. El local recibe «Cliente dice que YA PAGÓ $… por transferencia (Bre-B o Nequi)» y lo revisa. Si el local tiene QR de pago, el QR sigue saliendo para guardarlo, sin repetir la llave ni el botón. |
| **Canción con el nombre mal escrito («Black sa»):** se mandaba tal cual, y el local buscaba con ese texto. Sonaba otra cosa o nada. | Si la canción se escribió a mano, al tocar «Pedir canción» primero salen los resultados de YouTube: «Toca ▶ Pedir en la canción correcta». Así va el video exacto. Si no está, un segundo toque la manda como se escribió. Sin servidor o sin internet, se manda de una, como antes. |
| **«No pone las canciones que pide la gente»:** mientras una canción pedida se buscaba o se probaba, el reproductor y el TV ponían la siguiente que ya estuviera lista, casi siempre de la playlist de fondo. | Mientras una canción pedida se busca, el fondo no se le adelanta. Se espera hasta 1 minuto; si no aparece, sigue el fondo para no quedar en silencio. Lista la pedida, suena primero lo que pidió la mesa. El TV recibe la lista otra vez cada 15 s (solo si cambió). |

## Si usan YouTube Music (la lista de su cuenta de Google)
ORDEVA pone cada canción en orden dentro de la lista. **Si YouTube Music está en «aleatorio» (🔀), YouTube la toca
desordenada.** Eso es de la app de YouTube Music y no lo puede cambiar ORDEVA: hay que dejar el aleatorio apagado.

## Cómo está hecho
- `lib/vento-pedidos-tienda.js`: los colores del tema en vez de `--card` y `--ink2`, que no existen.
- `lib/vento-agencia.js`: el mismo color.
- `pedido.html`:
  - el recuadro de transferencia (`pintarNequi`, `avisarTransferencia`, `copiarTexto`);
  - el QR de pago sin repetir la llave ni el botón;
  - «elige la versión» antes de mandar una canción escrita a mano;
  - 7 textos nuevos en los 6 idiomas.
- `app/09-cuentas-mesa-modulo.js`:
  - `mzOrdenParaSonar()` la usan el reproductor de la app (`siguienteAuto`) y el TV (`tvPublicar`);
  - el TV se vuelve a publicar cada 15 s.
- **Sin cambios en el servidor.**

## Pruebas
- **Nueva:** `v1955` (12):
  - el panel se lee en el tema claro y en el oscuro (contraste ≥ 4,5);
  - el recuadro de transferencia, con la llave Bre-B primero, Nequi y un solo «Ya pagué»;
  - el aviso que recibe el local;
  - «Black sa» → salen los resultados → «Paranoid» va con su video;
  - el segundo toque manda la canción como se escribió;
  - la playlist de fondo espera por la canción pedida y sigue al minuto.
- **Música y QR después del cambio:** `cancionesmesa` 17, `musicaqr` 26, `pedidomusica` 14 (después de corregir que tocar
  un resultado sin código de video también cuenta como escogida), `qrprivado` 9, `canalvivo` 17, `pedidostienda` 29,
  `musicafondo` 8, `panelyoutube` 25, `tvocupado` 11, `musicaautoplay` 10.
- **Lista completa:** RESULTADOS_AQUI
- **No se probó** con un celular, un televisor ni YouTube Music de verdad.
