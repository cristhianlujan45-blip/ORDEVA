# ORDEVA 1.99.49 — Un pago que llega tarde dice de cuándo es

Pedido del dueño (23/11): «me llegó una transacción de 3.500 y después me notificó otra de 1.400 que habían puesto antes;
que no suceda eso, que me la notifique al instante y que no haya confusión».

## Qué pasó (registro real del celular, sin nombres ni valores)
- En el Xiaomi, hacia la 1:53 p. m. Android dejó de pasarle a ORDEVA los avisos del banco; volvió a conectar la lectura a
  las 2:02 p. m. y ahí ORDEVA encontró el aviso en la barra: «Vento lo leyó 595 s después». Se dijo como si fuera nuevo.
- En el Samsung, otro pago: «el banco lo mandó 370 s tarde» (la app del banco).

## Arreglo
- Un pago que llegó tarde (el banco lo mandó tarde, o Android se lo pasó tarde a ORDEVA) se dice con su hora:
  «Llegaron 1400 pesos por Nequi. Es de hace 10 minutos.» y la notificación: «💜 Recibiste $1.400 por Nequi · de hace 10 min».
  Uno de ahora (menos de 2 min) suena igual que siempre.
- Lo que se toma al reconectar (hasta 30 min) ya no queda «callado» para que lo diga la página sin la hora: lo dice la voz
  de los pagos del celular, con «Es de hace…».
- Lo que la app no entiende y pasa a la página también lleva la hora (la página dice «Es de hace N minutos»).
- No se tocó el ritmo con el que la app revisa los avisos (lo que ya funciona con el celular bloqueado).

## Pruebas
- Android (sin celular): 378/378 (+10 nuevas: pago de ahora, Android 10 min tarde, banco 6 min tarde, menos de 2 min).
- Página: pagosdiag1946 9/9 (pago tardío por la página), pagosaviso 95, confirmapago 61, alertaspagos 13, pagosequipos 51,
  pagosguia 29, pagosprivados 12, pagossuenan 13, pagostodos 17, pagocuenta1948 8.

# 1.99.50 — Auditoría de los datos del negocio y «pagado de más»
Diagnóstico nuevo de solo lectura (integridad, solo conteos) con los datos reales de la agropecuaria:
- Sin facturas repetidas, sin deudas negativas ni mayores que la venta, sin fechas futuras, sin inventario negativo, sin
  productos sin precio ni con costo mayor que el precio, sin cuentas abiertas olvidadas.
- 4 nombres de producto repetidos: son el mismo producto en distinto tamaño (ORDEVA no los toma como repetidos: bien).
- 8 de 14 cierres juntan varios días (el cierre automático perdido, arreglado en la 1.99.47, y días sin ventas).
- **2 ventas viejas con pagos MAYORES que el total** (8 nov: $74.800 con pagos por $101.800; 2 oct: $34.600 con $36.200):
  se cobró un producto aparte y después se quitó o se bajó de la cuenta; el pago quedó completo.
**Arreglo:** en la cuenta abierta, si lo registrado pasa del total:
- lo fiado que sobra se ajusta solo (no es plata recibida);
- si sobra plata de verdad: «⚠️ Pagaron $27.000 de más» con «↩️ Ya se lo devolví» (resta de los últimos pagos, anotando
  «devuelto») o «Dejar así». Pagos en dólares con vueltas en pesos no avisan.
Prueba nueva `sobrepago1950` (8/8). Cuentas, cobros, propinas, cajas y fiados: 15 pruebas, todas bien.

# 1.99.51 — Número de factura en las ventas de mostrador
- Auditoría: 42 ventas sin número de factura; las recientes son TODAS de mostrador (Caja POS), p. ej. la de hoy
  «Mostrador — Tania» (sin «N.º FV-…»). Tampoco tenía número la cuenta de UNA persona de la mesa al cobrarla.
- Arreglo: la venta de mostrador, los domicilios y la cuenta de una persona llevan su número (el mismo consecutivo de las
  cuentas de mesa, por equipo, sin repetirse). Deshacer la venta al instante devuelve el número. Las ventas viejas no cambian.
- Prueba nueva `factura1951` (6/6). anularventas 27, dian 29, equipos 35, facturasorden 21, mejoras 32, tablero 26, v183 18,
  cajapos 27, cajamas 45, flujocompleto 88, mesapersonas 22, cobrosimple 21, vueltas 25, sincstress 10 — todas bien.
