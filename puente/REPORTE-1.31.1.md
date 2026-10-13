# Vento 1.31.1 — Facturas: cantidades que no se leyeron y la división del total

## Qué cambió

- **Escribir la cantidad DIVIDE el total.** En la revisión de la factura, al escribir cuántas unidades son (por ejemplo, 24),
  Vento toma lo que se pagó por el renglón ($60.000) y lo divide: **$2.500 cada una**. Antes dejaba el costo por unidad
  igual y el total se multiplicaba (24 × $60.000).
- **La división a la vista:** «🧮 Total del renglón $60.000 ÷ 24 unidades = $2.500 cada una», y se actualiza mientras
  escribes.
- **Cantidad que no se leyó:** si el escaneo no encuentra cuántas unidades son, el renglón sale marcado («⚠️ No se leyó
  cuántas unidades son…») y con «📦 ¿Viene en cajas o paquetes?» abierto. Ahí se pone, por ejemplo, 2 cajas × 12 unidades.
  Antes quedaba en 1 unidad con todo el valor y sin aviso.

## Pruebas

| Prueba | Resultado |
|---|---|
| facturacantidad (cantidad sin leer, escribir 24, cajas × unidades, aplicar al inventario) | 10 |
