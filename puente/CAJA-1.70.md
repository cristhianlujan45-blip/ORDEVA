# ORDEVA 1.70.0 · Rediseño de la CAJA

Objetivo: cobrar rápido, fácil y con menos errores, y que un empleado nuevo aprenda en pocos minutos.

**El mismo motor de ventas y el mismo sistema de pagos.** La caja sigue registrando con `qsRegistrarVenta` (historial e
inventario una sola vez), y las cuentas de mesa se cierran con `closeTableToHistory`. El cobro es el mismo `elegirPago`.
No hay otra base de datos ni otro registro de pagos. No se quitó ninguna función. Archivos principales:
`lib/vento-pos.js`, `lib/vento-turno.js` y `lib/ordeva2.css`.

## Pantalla

### Computador (desde 900 px): dos columnas

| Izquierda (≈ 60 %) | Derecha (≈ 40 %) |
|---|---|
| Buscador permanente (fijo arriba, F1) y escáner con la cámara 📷 | La venta: cada producto con − / cantidad / + y ✕ |
| Lector de código de barras USB o Bluetooth (lee aunque el cursor no esté en el buscador) | La cantidad se escribe: se toca el número, Enter guarda y Esc deja como estaba |
| 🍽️ Mesas o cuentas por cobrar (restaurante): saldo, «Cobrar» y 👁 ver la cuenta | 🏷️ Descuento autorizado, 📝 Nota, ⏸️ Suspender, 📂 Pendientes |
| Categorías (Todos, ⭐ Favoritos, 🕘 Recientes y las del negocio) | Subtotal y descuento a la vista cuando hay descuento |
| ⭐ Favoritos (fila de acceso rápido) con «✏️ Editar» | TOTAL grande (34–46 px), siempre a la vista |
| Cuadrícula de productos: se agregan con un toque | 💵 COBRAR a todo lo ancho, siempre a la vista (F2) |

Arriba, a todo lo ancho, va el **estado de la caja** (ver «Apertura, operación y cierre»).

### Celular: una sola columna
- Los productos van arriba.
- La venta queda pegada abajo, con el total y COBRAR siempre a la vista.
- «▾» pliega la lista de la venta. Siguen a la vista cuántos productos hay, el total y COBRAR, así que no se pierde
  información.

### Venta vacía
Muestra «Cobrar en 3 pasos»: productos → COBRAR → con cuánto paga y entregar el vuelto.

## Cobro
- **Medios de pago:**
  - Efectivo (a todo lo ancho), Nequi, DaviPlata, **🏦 Transferencia** (nueva) y Tarjeta.
  - Pago combinado (➗ Pago mixto), 📲 Pagar con QR y fiado.
  - La transferencia queda con el mismo registro que Nequi y DaviPlata: `method: 'transferencia'` y el medio en la nota.
  - El modo fácil se queda con sus 4 botones grandes.
- **«¿CON CUÁNTO PAGA EL CLIENTE?»** siempre a la vista, nunca escondido.
  - Billetes rápidos que se suman (los de Ajustes → Negocio), «Pago exacto» y ↺ para borrar lo recibido.
- **El resultado en grande (34–52 px) y al instante:**
  - ⚠️ Faltan $X, en rojo;
  - ✅ PAGO EXACTO;
  - «Cambio que debe devolver: $X», en verde.
  - Encima se ve «Recibe $X · Total $Y».
- **Efectivo incompleto:** no se registra. Abre el pago mixto con lo recibido para cobrar el resto por otro medio.
- **En el computador la ventana va en dos columnas:** lo recibido y el vuelto a la izquierda, cómo pagó a la derecha.
  Nada queda abajo escondido.
- **Doble toque en COBRAR:** el segundo toque no cae en un botón de la ventana de cobro.

### ✅ Confirmación del pago
Sale en la columna de la venta, después de cobrar:
- «Pago confirmado» (o «Quedó debiendo»);
- la venta, cómo pagó y lo recibido;
- el **VUELTO** en grande.

Botones:
- 🖨️ **Imprimir comprobante**: la impresora de la caja si está configurada; si no, la ventana de imprimir.
- 🧾 Enviar recibo (WhatsApp o imagen).
- ↩ Anular.
- ➕ Nueva venta.

Se quita sola al tocar el siguiente producto. La barra «↩ Deshacer / 🧾 Recibo» de siempre sigue igual.

## Ventas pendientes y recuperación
- ⏸️ Suspender (con nombre) y 📂 Pendientes para recuperar. Ya existía; F4 también.
- 🛟 **Recuperación:** si la app se cerró con una venta a medias (se fue la luz, se cerró la pestaña), al volver la caja
  la recupera y lo dice: «Se recuperó la venta que estaba en curso». Se puede seguir («Entendido») o «Empezar de cero».
- 🔁 Repetir una venta y 🧾 su recibo, en «📊 Caja de hoy» (ya existía).

## Atajos de teclado
| Tecla | Acción |
|---|---|
| F1 | Buscar |
| F2 | Cobrar |
| F3 | Cliente |
| F4 | Pendiente |
| F5 | Limpiar |
| F6 | Efectivo («¿Con cuánto paga?») |
| F7 | Transferencia (ahora el botón Transferencia) |
| F8 | Micrófono |
| F9 | Total |
| Esc | Cancelar |
| Enter | En el buscador agrega la única coincidencia; en «¿Con cuánto paga?» cobra en efectivo |

- «3*código» suma 3 unidades.
- Los atajos se ven bajo COBRAR, y la tecla aparece en el botón (F2) y en el buscador (F1).

## ⭐ Favoritos configurables
- «✏️ Editar» en la fila de favoritos y luego se tocan los productos para marcarlos o quitarlos.
- Se guarda en el producto (`favorite`, el mismo de su ficha) y viaja a los demás equipos.
- Solo lo hacen el dueño, el administrador o quien tiene el permiso «Crear y editar productos».

## Permisos
- **Descuento:** al equipo se le pide la clave de autorización del dueño. Ya existía.
- **Nuevo, necesitan la clave del dueño si no es dueño ni administrador:**
  - **Anular una venta ya cobrada** (desde «Anular» o «↩ Deshacer»).
  - **Sacar efectivo de la caja.**
  - Queda en la auditoría.
- **Cerrar la caja:** la clave de cierre si el dueño la puso (ya existía).

## Apertura, operación y cierre
| Estado | Cómo se ve |
|---|---|
| ⚪ Caja sin abrir | Franja ámbar con «💵 Abrir caja» (base de efectivo). Se puede vender igual, como antes. |
| 🟢 Caja abierta | Desde qué hora, la base, las ventas de hoy y quién está en la caja. Botones «➕➖ Efectivo» (entradas y salidas) y «🔒 Cerrar caja». |
| 🔒 Cerrar caja | El cierre del día de siempre: resumen, arqueo contando billetes y monedas, y si sobra o falta. Después la caja vuelve a «Caja sin abrir». |

El estado de la caja es el mismo en todos los equipos del negocio (`data.turno`).

## Restaurantes
- La caja muestra las mesas o cuentas abiertas «por cobrar», con su saldo.
- «Cobrar» usa el mismo cobro y cierra la cuenta como «Cobrar todo y liberar mesa».
- 👁 abre la cuenta para verla o editarla.
- La venta rápida de mostrador sigue igual al lado: no se mezcla con las mesas.

## Pruebas
- **`pruebas/cajapro.test.js`** (nueva, en CI):
  - computador y celular;
  - las dos columnas y sus medidas;
  - estado de la caja, agregar de todas las formas, cantidad escrita, quitar y descuento;
  - los 5 medios, el pago combinado, falta / exacto / vuelto (tamaño y al instante);
  - confirmación, imprimir, pendientes, recuperación tras recargar, F1 / F2 / Esc;
  - favoritos con y sin permiso;
  - anular y sacar efectivo con y sin la clave del dueño;
  - cobrar una mesa desde la caja y cerrar la caja.
- **Las pruebas de siempre de la caja**, ajustadas a Transferencia (`modos`):
  - `modos`, `cajapos`, `cajaextra`, `cajaqr`, `cajavoz`, `facil`, `vueltas`, `dian`, `equipos`;
  - `inventario5`, `ordeva2pantallas`, `cerrarcaja`, `cajagastos`, `ordeva2`, `pasos` y `guia`.

## Lo que no se probó
- En una caja real con impresora térmica y lector físico. Se probó con el lector simulado (teclado rápido + Enter) y la
  impresión registrada.
- Con un empleado nuevo de verdad. Lo de «en pocos minutos» hay que verlo en el negocio.
