# ORDEVA 1.99.9 · Estadísticas con las mismas palabras que Inicio y Contabilidad (auditoría de diseño, hallazgo 8)

- En Estadísticas, la tarjeta «Ingresos totales · todo lo cobrado» se llama ahora **«Ventas · lo vendido (incluye fiado)»**.
  La cifra siempre fue lo vendido (suma de las cuentas, con lo fiado), no lo cobrado: el subtítulo anterior no era cierto
  cuando había fiados.
- «Pedidos totales · cuentas cobradas» → **«Cuentas · cuentas cerradas»** (Contabilidad dice «8 cuentas»).
- «📈 Ingresos por día», «Ingresos totales en mesas / en caja» → **«📈 Ventas por día», «Ventas en mesas / en caja»**.
- Inicio sigue diciendo «Ventas» y Contabilidad «Vendido» (el resumen contable, el Excel, el resumen por WhatsApp y Laya
  usan «Vendido»; no se cambió para no mover lo que los contadores ya leen). Las cifras no cambian.
- Pruebas: tablero 26/0 (actualizado a las palabras nuevas), ordeva2pantallas 20/0, finanzas 17/0, facil 47/0,
  suscripnube 67/0.
- `ordeva2` se cae aquí al recargar con el tema viejo «halloween» (el navegador se cierra); pasa lo mismo con la 1.99.8 ya
  publicada en esta máquina, y en GitHub pasa: es del entorno, no del cambio.
