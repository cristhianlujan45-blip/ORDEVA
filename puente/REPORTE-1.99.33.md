# ORDEVA 1.99.33 · Las ventanas que se abren encima

## Pedido del dueño (22/11): «Continúa con lo siguiente de la auditoría»
Hasta la 1.99.32 se midieron las pantallas principales y 6 ventanas. Ahora se hizo un **recorrido automático**: en cada
pantalla (y en «Más») se tocó cada botón y se midió la ventana que se abría.
- Celular táctil de 390 px, con datos de prueba y sin internet.
- Se saltaron los botones de borrar, reiniciar, anular y salir.
- 91 botones tocados y 15 ventanas distintas medidas.

### Lo que se arregló (pantallas táctiles: de 26–39 px a 44 px)
| Ventana | Antes |
|---|---|
| ⚡ Venta rápida: − y + | 30 × 36 |
| ⚡ Venta rápida: buscador, cantidad, «Agregar», datos del cliente | 37–39 de alto |
| 🔳 Escanear código: la ✕ de cerrar | 26 × 26 |
| 🔳 Escanear código: «Ocultar», «Copiar enlace» | 32 |
| 📥 Exportar ventas: Hoy · Ayer · Este mes · Rango de fechas · Por cierre de caja | 32 |
| 🎵 Reproductor de música: Cerrar | 38 |
| 🎵 Reproductor de música: pestañas | 37 |
| 🎵 Reproductor de música: «⏭ Siguiente» | 38 |
| 🎵 Reproductor de música: géneros (Vallenato, Salsa…) | 32 |
| 🎵 Reproductor de música: «Ver todas →» | 28 |
| 🚫 Música sin comerciales: «Buscar mi TV», «Con el código del TV» | 35–36 |
| Buscadores de 📚 Facturas anteriores, 📜 Historial de música, 🛒 Pedido a proveedores | 37–39 |
| 🧾 Caja POS: 👁 «Ver la cuenta» de las mesas por cobrar | 33 de ancho |

Después del arreglo, el mismo recorrido no encuentra nada de menos de 40 px en ninguna de las 15 ventanas. Tampoco
encuentra letra de menos de 12 px ni nada que se salga.

### Comprobado
- Fotos de antes y después de Venta rápida y del reproductor de música: nada se descuadra.
- **Prueba nueva:** `pruebas/ventanas1933.test.js` (9/9). Con la 1.99.32 fallan 8 de 9.
