# ORDEVA 1.67.0 · 💵 Cobro con efectivo y vueltas siempre a la vista + 🧮 motor financiero

El diagnóstico completo, el plan por fases y los pendientes están en `puente/ORDEVA-1.67-AUDITORIA.md`.

## Qué cambió para quien cobra

### Caja · COBRAR
- Bajo el total sale siempre, sin abrir nada, **«¿CON CUÁNTO PAGA EL CLIENTE?»**:
  - un campo grande;
  - «Pago exacto»;
  - billetes de $2.000, $5.000, $10.000, $20.000, $50.000 y $100.000, que **se suman** (dos de $20.000 = $40.000);
  - ↺ para borrar.
- Al instante dice **«Cambio que debe devolver $12.500»**, **«✅ PAGO EXACTO»** o **«Faltan $17.500»**.
- **Pago incompleto:**
  - Si el efectivo no alcanza y se toca «Efectivo», la venta **no** se registra.
  - Avisa cuánto falta y abre el pago mixto con lo recibido.
  - Antes quedaba como venta pagada.
- **Pago mixto:**
  - Las vueltas salen solo del efectivo. Ejemplo: $60.000 en efectivo y $30.000 por Nequi para una venta de $80.000
    dan $10.000 de vueltas.
  - Lo de transferencia o tarjeta no puede pasar del total.
- **Lo que queda en la venta:** el efectivo que entregó el cliente y las vueltas. El pago en efectivo es lo que se
  aplicó a la venta, así que el cierre de caja no cuenta lo recibido como ingreso ni las vueltas como gasto.
- El total queda fijo arriba aunque se baje dentro del cobro en el celular.

### Cuentas (mesas y por persona)
- Al escribir con cuánto paga el cliente en efectivo, sale el cambio o lo que queda por pagar.
- **Antes:** pagar $50.000 una cuenta de $37.500 anotaba $50.000 como cobrado.
- **Ahora:** se anota $37.500, con «Cambio que debe devolver $12.500». Lo recibido y las vueltas quedan en el historial
  al cerrar la cuenta.
- Por transferencia de más, pregunta («no hay vueltas»).

### Ficha del producto
- Se muestran por separado **«Margen bruto (sobre el precio)»** y **«Recargo sobre el costo»**. Ejemplo: costo $8.000 y
  precio $10.000 dan margen 20 % y recargo 25 %.
- **💡 Precio sugerido:**
  - para no perder plata;
  - para el margen objetivo (30 % si no se cambia; se puede cambiar ahí mismo);
  - precio comercial redondeado (costo $8.000 → $11.429 → $11.500).
- «Usar» solo pone el precio en el campo: cambia cuando se guarda el producto.

## Técnico
- `lib/vento-finanzas.js` (nuevo): el motor financiero único, con funciones puras. La ficha del producto ya lo usa. Las
  demás pantallas (facturas, Laya, estadísticas) pasan a usarlo en la fase 2.
- `lib/vento-pos.js`: `cambio()`, `billetesCaja()` (se pueden cambiar con `data.cajaBilletes`), el campo siempre visible
  y el bloqueo del pago incompleto.
- `app/04f`: `qsRegistrarVenta` guarda `efectivoRecibido`, `vueltas` y, en el pago en efectivo, `recibido` y `vueltas`.
- `app/04c`: `pagoAjustarAlSaldo()` y la ayuda del cambio en las cuentas.
- `app/04a`: `closeTableToHistory` conserva `recibido` y `vueltas`.
- Sin migraciones ni cambios en el servidor. Compatible con los datos de antes: todos los campos nuevos son opcionales.

## Pruebas
- `pruebas/vueltas.test.js` (25 ✅, nueva, en CI): las pruebas del punto 4.7 que se pueden hacer en el navegador.
- Los resultados de la suite y del servidor están en el mensaje de publicación.

### Resultados reales de esta versión (30-oct-2026)
- **Navegador (33 pruebas):** 32 pasaron completas a la primera.
  - `mesapersonas` falló 4 de 22 por un error de la 1.67.0: lo que una persona paga de más dejaba de cubrir a los
    demás. Se corrigió (las vueltas cuentan solo sobre el saldo de toda la mesa) y ahora da 22 ✅.
  - `safari` no corre en este equipo (0 de 0): no queda verificada.
  - Las 31 restantes:

    | Prueba | ✅ | Prueba | ✅ | Prueba | ✅ |
    |---|---|---|---|---|---|
    | vueltas | 25 | cajapos | 27 | cajaqr | 13 |
    | confirmapago | 61 | dian | 29 | equipos | 35 |
    | escanear | 13 | facil | 47 | facilpantallas | 28 |
    | herramientas | 28 | lectorcel | 24 | mejoras | 32 |
    | modos | 55 | divtest | 6 | practica | 25 |
    | cerrarcaja | 26 | apariencias | 16 | ordeva2 | 30 |
    | ordeva2pantallas | 17 | vistasencilla | 45 | codigoproducto | 22 |
    | facturascan | 33 | facturacategorias | 11 | salidas | 19 |
    | libreta | 24 | recetas | 21 | entrar | 35 |
    | iphone | 9 | erroresreal | 33 | tablero | 26 |
    | hola | 15 | | | | |

- **Servidor, PostgreSQL real (22 pruebas, 916 revisiones, 0 fallas):**

  | Prueba | ✅ | Prueba | ✅ | Prueba | ✅ |
  |---|---|---|---|---|---|
  | admin | 169 | aislamiento | 9 | avisos | 34 |
  | bloqueos | 18 | canallimite | 5 | canalprivado | 17 |
  | catalogo | 12 | daviplata | 102 | dian | 69 |
  | equiponoreescribe | 29 | errores | 37 | iaclave | 34 |
  | iacupo | 6 | nequiconecta | 16 | pagosprivados | 42 |
  | permisos | 19 | proyeccion | 66 | repasos | 20 |
  | respaldos | 15 | suscripciones | 154 | usuariosequipo | 25 |
  | wompi | 18 (simulado) | | | | |

- **Conclusión de la fase 1:** el aislamiento entre negocios y las pruebas negativas (otro negocio, empleado sin
  permiso, QR sin código) siguen bien. No hay hallazgos nuevos.
