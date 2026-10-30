# ORDEVA 1.66.5 · 💸 Salidas de Nequi / DaviPlata: ¿proveedor u otro gasto?

## Qué se pidió
Que las salidas de plata por Nequi y DaviPlata (lo que el dueño envía o paga) queden registradas, para decir si fueron un
pago a un proveedor o un gasto de otra cosa.

## Qué quedó

### 1. App Android (`AvisoPago.java`, `VentoEscucha.java`, `VentoApp.java`)
- Antes, los avisos de plata que sale se descartaban a propósito.
- Ahora se guardan **solo en ese celular**, para que la página los tome. Son los avisos de las apps oficiales de
  Nequi, DaviPlata y los bancos («Enviaste $250.000 a…», «Pasaste $100 a otro DaviPlata», «Compra exitosa … por
  20,000»), y los SMS de un código corto del banco (85888, etc.).
- Estos avisos **no suenan**, no entran en los pagos recibidos y **no van al Servidor Vento** ni a los demás equipos.
- Nunca se guardan:
  - los códigos y claves (OTP, clave dinámica, código de verificación);
  - lo rechazado, fallido o programado, y las solicitudes;
  - los SMS que llegan de un celular común.
- Nuevo método del puente: `VentoAndroid.pagosSalidasTomar()`. La lista se borra del celular al tomarla y guarda como
  máximo 7 días y 60 salidas.

### 2. Página (`lib/vento-salidas.js`, nuevo)
- **Solo el administrador** (dueño o admin) las toma y las ve. Con un empleado en sesión, se quedan en la app hasta
  que entre el administrador.
- Viven en este celular (localStorage, por negocio). **No van al documento compartido.**
- El valor y a quién se le pagó se leen en la página, que se actualiza sola sin reinstalar. Ejemplos: «$1.250.000,00»
  da $1.250.000 y «… a ARRENDAMIENTOS LA 80 desde tu cuenta» da «ARRENDAMIENTOS LA 80».
- **Sin valor en el aviso, no se anota nada.**
- En **Contabilidad** aparece la tarjeta «💸 Salidas de Nequi / DaviPlata por clasificar». Cada salida muestra el valor,
  la app, la hora y a quién se le pagó, con 4 botones:

  | Botón | Qué hace |
  |---|---|
  | 📦 Proveedor | Gasto «Proveedores / mercancía» con el nombre («Pago a proveedor X (Nequi)»). |
  | 🗂️ Otro gasto | Gasto en la categoría que se elija (arriendo, servicios, nómina… y las del tipo de negocio). |
  | 🔗 Ya estaba anotada | No se suma nada. Sirve, por ejemplo, para el pago de una factura escaneada, que ya cuenta como compra. |
  | 🙈 No es del negocio | Se descarta, **con confirmación**. |

- El gasto queda en `data.contab` como cualquier otro, con el medio de pago: Nequi / DaviPlata, o transferencia si fue
  por un banco. Se puede borrar desde los movimientos.
- **Sugerencias** (nunca se clasifica sola):
  - si ese nombre ya se clasificó antes, se propone lo mismo;
  - si se parece al proveedor de una factura escaneada, «Proveedor»;
  - si además el valor es el de esa factura (de los últimos 60 días), «Ya estaba anotada», para no contar la misma compra
    dos veces.
- **Inicio**: la alerta «💸 N salidas de Nequi / DaviPlata por clasificar» lleva a Contabilidad.
- Al llegar una salida nueva sale un aviso: «💸 Salió $X por Nequi a …: clasifícala en Contabilidad».

## Pruebas
- `pruebas/salidas.test.js` (19 ✅, nueva, en la lista de CI). Cubre:
  - la lectura con avisos reales y sin valor;
  - que un empleado no las toma ni las ve;
  - Contabilidad y la alerta de Inicio;
  - que no están en los datos compartidos;
  - Proveedor y su sugerencia la vez siguiente;
  - Otro gasto (Arriendo);
  - el pago de una factura escaneada;
  - «No es del negocio» con confirmación.
- `pruebas/java/EscuchaPrueba.java`: 6 casos nuevos (42 ✅). Comprueban, con el mismo código de `VentoEscucha`, que:
  - Nequi «Enviaste», DaviPlata «Pasaste» y el SMS 85888 «Compra exitosa» se guardan;
  - los códigos, un SMS de un celular común y un pago rechazado no se guardan;
  - no suenan ni van a la cola de pagos;
  - se toman una vez;
  - el mismo aviso no se guarda dos veces.
- `AvisoPagoPrueba` sigue con 203 ✅.
- Compilación de Android en este equipo: los mismos errores que antes del cambio, todos por librerías que aquí no
  están (androidx, Google Cast). Ninguno es del código nuevo. El APK lo compila GitHub al publicar.

## Para que funcione en el celular
- Hay que **actualizar la app Android**: el Actualizador la baja sola en unas horas, o se instala el APK nuevo.
- Con la app vieja no se rompe nada, pero tampoco llegan salidas.
- Solo se ven en el celular donde están instaladas las apps de Nequi o DaviPlata.

## Lo que no se pudo probar
- Con un celular de verdad y avisos reales de Nequi y DaviPlata de plata que sale. Se probó con textos de avisos
  reales en la simulación de Java y en el navegador.
- Si el formato de algún aviso no se entiende bien (el valor o a quién), se arregla en la página, sin reinstalar la app.
