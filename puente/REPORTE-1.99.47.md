# ORDEVA 1.99.47 — Cierres de caja que no se pierden y el Historial ordenado

Con los pantallazos del dueño (23/11).

## Cierre automático de caja
- En sus cierres, el sábado 21 no tuvo cierre: el del domingo fue «20 nov 11:30 p. m. — 22 nov 11:30 p. m.» (dos días
  juntos); también «14 nov — 19 nov». El cierre automático solo se hacía si ORDEVA estaba despierta entre la hora
  programada (11:30 p. m.) y la medianoche.
- Ahora, al despertar (hasta 36 h después), se hace el cierre de ese día CORTADO a la hora programada: solo las ventas
  hasta esa hora. Si ya se cerró a mano después de esa hora, no se repite. Recién prendido no hace cierres de antes.
- Un cierre que junta varios días lo dice: «⚠️ junta 2 días».

## Historial más ordenado
- Herramientas de la caja en una fila de 3: 💵 Caja (base, entradas y salidas) · 📊 Gráficas · 📗 Cierres Z (Excel).
- Resumen general: el total vendido grande arriba (antes «$1.206.00 / 0» partido), cuentas cerradas y deudas debajo.
- Cierres de caja: los 3 últimos y «Ver los N cierres ▾»; fecha corta («domingo, 22 de nov, 11:30 p. m. · desde el vie 20,
  11:30 p. m.»).
- «Todos · ✅ Pagaron · ⏳ Deben» junto a la lista que filtra (encima del buscador).
- Buscador y mes con los colores del tema (en el oscuro eran blancos).

## Revisión de las deudas (diagnóstico de solo lectura)
- Historial «Total en deudas» $328.600 = lo que deben 12 cuentas cerradas. Libreta «Me deben» $355.125 = esos $328.600 +
  $26.525 anotados directo en la libreta. Cuadra.

## Pruebas
- Nuevas: `cierreauto1947` (6/6), `historialorden1947` (9/9).
- Historial, caja y cierres: anularventas 27, facturasorden 21, mejoras 32, equipoactividad 32, graficas1929 45,
  cerrarcaja 27, doscierres 7, cajamas 45, cuadrefiados1946 8, v1954 23, erroresreal 33, letraancha1935 11,
  ordeva2pantallas 20, diseno1927 14 — todas bien.

# 1.99.48 — Historial en pestañas y pagar una cuenta a la vez en la libreta
Pedido del dueño: «arréglame este menú de los cierres para que no tenga que verlos todos primero y pueda ver los
historiales aparte… y en la libreta de fiados, seleccionar cuál cuenta me paga el cliente, no todo de una vez».
- **Historial en 2 pestañas:** «🧾 Ventas» (lo primero: resumen, filtros, buscador y las cuentas) y «🔒 Cierres de caja (N)»
  (todos los cierres, sin las ventas). Se recuerda la última pestaña en el equipo. Las herramientas de la caja quedan arriba.
- **Libreta → Me deben → tocar a la persona:** «💳 Cuentas que debe (N)», cada una con su número, su día, lo que debe,
  «💵 Pagó esta» y «📱 Transferencia». Pregunta antes; salda SOLO esa cuenta (las demás siguen debiendo). En efectivo con la
  caja abierta entra a la caja; por transferencia, no. Contabilidad lo cuenta con su medio de pago. «Me equivoqué» lo deshace.
- **Revisión de correcciones y errores:** pruebas de anular, corregir y cobrar (anularventas 27, cobrosimple 21, vueltas 25,
  esquinas 22), fiados y libreta (fiadosnombres 28, libreta 24, ventasfiados 16, libretanombres1942 12, cuadrefiados1946 8)
  — todas bien. Errores de la app en los celulares en las últimas 48 h: ninguno.
- Pruebas nuevas: `pagocuenta1948` (8/8); `historialorden1947` actualizada a las pestañas (9/9).
