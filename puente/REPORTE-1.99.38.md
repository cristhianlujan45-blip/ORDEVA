# ORDEVA 1.99.38 · Lector de pantalla y velocidad de la página del QR

## Pedido del dueño (22/11): «Publícala y continúa»

### 1. Velocidad de la página del QR (la que abren los clientes): está bien, no se tocó
- Pesa unos 196 KB sin comprimir (unos 50 KB como la manda GitHub Pages) y carga 4 archivos pequeños.
- Simulando un celular de gama baja (CPU 4 veces más lenta):
  - con internet de celular regular («3G»): lista para usar en **2,7 s**;
  - con 4G: lista en **0,7 s**.
- Las letras de Google no frenan la página: cargan después.

### 2. Botones y campos sin nombre para el lector de pantalla (TalkBack)
Quien usa el lector de pantalla del celular oía solo un símbolo («✕», «−», «+», «⏭») o «campo sin nombre». Ahora dicen
qué hacen:
- **Cuenta de la mesa:** la ✕ de cada producto dice «Quitar de la cuenta».
- **Venta rápida:** «Uno menos», «Cantidad» y «Uno más».
- **Campos:**
  - nombre del negocio;
  - categoría del producto;
  - tipo de etiqueta;
  - Contabilidad: categoría, fecha y medio de pago.
- **Reproductor de música:** «Siguiente canción».

Los demás avisos de la medición eran falsos: botones que sí tienen texto, pero que estaban fuera de la vista.

**Prueba nueva:** `pruebas/nombres1938.test.js`.
