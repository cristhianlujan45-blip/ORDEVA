# ORDEVA 1.99.46 — Auditoría: pagos con el celular bloqueado, app Android, hotel, cuadre de caja

## 1. Pagos por transferencia con el celular bloqueado
Revisado el camino completo en la app Android (VentoEscucha, VentoApp, VentoServicio) y 30 días de registros reales:
- La voz del pago la dice el propio Android (no la página), por el canal de la ALARMA, con el procesador despierto mientras
  habla: suena con el celular bloqueado y en silencio, sin desbloquear.
- Si Android corta la lectura de avisos, se reconecta sola; al reconectar toma los pagos que siguen en la barra (y la
  página los dice). Cada 10 s se barre la barra por si Android no le pasó un aviso.
- DaviPlata / Bold por SMS llegan directo (permiso de SMS), también bloqueado.
- La app ya revisa si Nequi o DaviPlata tienen ahorro de batería y abre su ajuste para quitarlo.
- Pruebas de Android (sin celular): 367/367 (reglas, ventana, voz, lectura de avisos y SMS reales, pagos entre equipos) y
  13/13 de la conexión en vivo.

Hallazgos y arreglos:
- El registro de avisos de pago (lo que llega a 🐞 Errores, sin nombres ni valores) se volvía a mandar ENTERO cada vez que
  se recargaba la página: «378 veces volvió a conectar», «115 veces 468 s tarde»… eran los mismos apuntes repetidos.
  Ahora cada apunte se manda una sola vez (se recuerda en el equipo): los conteos son los reales.
- Un pago que el BANCO mandó tarde ahora dice si esa app del banco tenía ahorro de batería («🔋 Nequi CON ahorro de
  batería»): la causa más común de que llegue tarde con el celular bloqueado.
- El único pago muy tardío real del mes: el banco lo mandó 468 s tarde (Samsung). No es de ORDEVA: es la app del banco.

## 2. App de Android
- Ningún cierre por falta de memoria en los últimos 7 días (el último fue el 21/11, antes de la 1.99.40).
- Los cierres de la app también se reportaban otra vez en cada recarga («51 veces»): ahora cada uno una sola vez.

## 3. Hotel completo
Recorrido de un día: entrada con llegada y noches, registro del huésped, salida con parte fiada, «por limpiar»,
indicadores (ocupación, tarifa promedio, RevPAR). Todo cuadra: 2 noches, el fiado queda en la libreta, la habitación queda
«por limpiar», la tarifa promedio cuenta solo las noches (no el desayuno). Sin errores.

## 4. Cuadre de caja y contabilidad — 2 errores arreglados
- **Fiado cobrado en efectivo desde la libreta** («Juan me pagó 30000»): la plata entraba al cajón pero el cuadre solo
  contaba las ventas del día → al contar salían «sobran $30.000». Ahora, con la caja abierta, queda como entrada de caja
  («Fiado cobrado · Juan»); «me equivoqué» la quita también. Sin caja abierta no se abre ninguna.
- **«✅ Ya pagó» en el Historial** pasaba TODO lo fiado a pagado aunque ya hubiera abonado una parte en la libreta:
  Contabilidad contaba ese abono dos veces (40.000 fiados, 10.000 abonados → 50.000). Ahora cobra solo lo que faltaba
  (30.000) y, en efectivo con la caja abierta, entra a la caja.

## Pruebas nuevas
- `pagosdiag1946` (7/7): registro de pagos sin repetir al recargar, batería del banco, cierres de Android una vez.
- `cuadrefiados1946` (8/8): caja con fiados cobrados (libreta y Historial), «me equivoqué», transferencia, sin caja.
