# Vento 1.55.5 · Sin Netlify: los QR los hace ORDEVA

Pedido del dueño: «quita Netlify y lo del QR, todo lo debe hacer ORDEVA».

## Qué se quitó
- **`netlify.toml` y la carpeta `netlify-qr/`.** El proyecto ya no tiene nada de Netlify.

## Qué no cambia
- **La app genera los QR** con la dirección de ORDEVA: `…github.io/ORDEVA/pedido.html`, con el canal y el código
  de cada mesa.
- **Si en un celular quedó guardada una dirección de Netlify** (o la de `…/cuentas/`), la app la cambia sola por la
  de ORDEVA. Ningún link ni QR nuevo sale con Netlify.

## Lo que debe hacer el dueño
- **Reimprimir los QR pegados que tengan la dirección de Netlify** (`joyful-basbousa-0bc49b.netlify.app`), desde
  Ajustes → QR de las mesas.
  - Ese sitio servía una copia vieja con ntfy.sh, que ya no funciona: sus pedidos no llegaban.
  - El canal y los códigos de cada mesa siguen iguales.
- **Después puede borrar el sitio en Netlify.**
