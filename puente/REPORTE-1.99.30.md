# ORDEVA 1.99.30 · Lo último de letra chica de la auditoría de diseño

## Pedido del dueño (22/11): «Continúa con lo siguiente de la auditoría»
Los 3 puntos pendientes de `puente/AUDITORIA-DISENO-1.99.27.md` ya quedaron hechos:
- botones (1.99.28);
- gráficas y el «?» de la ayuda de voz (1.99.29).

Lo que seguía era la letra de menos de 12 px que todavía quedaba. Se midió de nuevo en 11 pantallas (390 y 320 px, con 120
días de ventas):

| Dónde | Antes | Ahora |
|---|---|---|
| Productos e Inventario › encabezados de la tabla (Producto, Costo, Precio, Margen…) | 11 px | 12 px |
| Estadísticas › fechas bajo las barras | 11 px | 12 px; en pantallas angostas se muestran menos fechas para que no se tapen |
| Contabilidad › días de «Entradas y gastos» | 10 px | 12 px; columnas un poco más anchas (la gráfica ya se desplaza de lado) |
| Contabilidad › «▼ 1 %» en «Frente al período anterior» | 11,7 px | 12 px |
| Mesas › «Ocupada» y la capacidad | 11,5 px | 12 px |

Resultado: **0 textos de menos de 12 px** en Inicio, Mesas, Productos, Inventario, Estadísticas, Contabilidad, Historial,
Carta, Música, Ajustes y Cocina (sin contar la barra de abajo en 320 px, que se achicó a propósito para que no se corte).

### Comprobado
- Fotos en 390 y 320 px de Estadísticas y Contabilidad: las fechas no se enciman.
- **Prueba nueva:** `pruebas/letra1930.test.js` (11/11). Con la 1.99.29 falla la revisión de la letra en los dos anchos.
