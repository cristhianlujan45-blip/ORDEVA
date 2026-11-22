# ORDEVA 1.99.29 · Gráficas legibles · «90 días» completo · el «?» de la ayuda de voz

## Pedido del dueño (22/11): «Continúa con lo de las gráficas y el globito de ayuda»
Son los dos puntos que quedaban de la auditoría de diseño (`puente/AUDITORIA-DISENO-1.99.27.md`).

### 1. Letra de los ejes de las gráficas: 12 px
Medido con 90 días de ventas, en celulares de 390 px y de 320 px:

| Gráfica | Antes (390 / 320 px) | Ahora |
|---|---|---|
| Inicio › Ventas por día (`lib/ordeva2.js`, `lib/ordeva2.css`) | 11 / 10,4 px | 12 px |
| Estadísticas › Ventas en mesas y en caja, Carga de trabajo (`lib/vento-tablero.js`) | 11 / 9,7 px | 12 px |
| Historial › Ver gráficas de ventas (`app/09-cuentas-mesa-modulo.js`) | 9,8 / 7,9 px | 12 px |

- La letra ya no se achica en celulares pequeños: las gráficas se dibujan al ancho real de su tarjeta.
- Cuántas fechas se muestran depende del ancho (una cada 44 a 54 px). La última fecha no se monta sobre la anterior.
  Más espacio a la izquierda para «$500 mil». En Estadísticas, el «$0» ya no toca la primera fecha.
- Resultado: ninguna etiqueta encimada ni cortada en las 3 pantallas (antes 2 cortadas en Estadísticas y hasta 5 en
  Historial).

### 2. Error encontrado: Historial › «90 días» no mostraba los días más recientes
- Cada barra medía como mínimo 7 unidades: con 90 días, la gráfica necesitaba 630 y solo tenía 320.
- Así, **45 de las 90 barras (de principios de octubre a hoy) quedaban por fuera y no se veían**, y las fechas del eje
  se cortaban.
- **Ahora** las barras se reparten en el ancho real: se ven los 90 días, hasta hoy.

### 3. El «?» de la ayuda de voz
- Antes medía 24 px, difícil de tocar.
- Ahora se ve de 28 px (letra de 15 px) y se puede tocar en un cuadro de 44 × 44 px.
- La zona extra crece hacia arriba y hacia afuera, **no hacia el micrófono**: tocar el micrófono (en el centro y junto al «?») sigue
  siendo el micrófono. Con el micrófono a la izquierda funciona igual, al revés.

### Comprobado
- Fotos de antes y después en Inicio, Estadísticas e Historial (7 y 90 días), en 390 y 320 px.
- **Prueba nueva:** `pruebas/graficas1929.test.js` (45/45 con el cambio; sin el cambio fallan 22).
  Revisa la letra, que no se encimen, las 90 barras, el tamaño y la zona del «?», que el micrófono siga respondiendo y
  que el «?» abra la ayuda.
