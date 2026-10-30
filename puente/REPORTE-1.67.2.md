# ORDEVA 1.67.2 · 🧮 Fase 2: motor financiero en toda la app + alertas

## Problema encontrado (y corregido)
**Doble conteo de las compras de mercancía en la utilidad del Inicio.**
- **Antes:** utilidad = vendido − costo de lo vendido − *todos* los gastos. «Todos los gastos» incluía las facturas de
  proveedores escaneadas, los pagos a proveedores de la libreta y los gastos de categoría «Proveedores / mercancía».
- **Por qué está mal:** esa mercancía ya se resta en el «costo de lo vendido» cuando se vende. Restarla otra vez hacía
  que la utilidad saliera más baja de lo real. Con una factura grande del mes, podía dar pérdida sin que la hubiera.
- **Ahora:** **utilidad (resultado neto estimado) = vendido − costo de lo vendido − gastos operativos.** Las compras de
  mercancía no se restan otra vez:
  - categorías Proveedores, Mercancía, Insumos, Licores, Harinas, Laboratorios, Medicamentos, Alimento y Productos de
    barbería;
  - las facturas escaneadas;
  - los pagos a proveedores de la libreta.
- **Se separan claramente:**
  - **ventas** (lo facturado);
  - **recaudo** (lo cobrado);
  - **utilidad** (lo que gana el negocio);
  - **flujo de caja** (lo que entró − lo que salió). En Contabilidad, «Te quedó (caja)».

## Qué quedó

### Motor (`lib/vento-finanzas.js`)
- `resultado(vendido, costo, gastos)` → utilidad bruta, margen bruto, gastos operativos, compras de inventario y
  resultado neto.
- `rentabilidad(historial, productos, categorías, rango)` → por producto y por categoría: unidades, ventas, costo,
  utilidad y margen.
  - Usa el **costo guardado en cada venta**: si el costo cambia después, el pasado no cambia.
  - No cuenta domicilios ni propinas, y dice cuánto se vendió sin costo.
- `inventario(productos)` → plata invertida (a costo), venta potencial y ganancia potencial.
- `alertas(datos)`, solo con datos reales y cada una diciendo por qué:

  | Alerta | Cuándo sale |
  |---|---|
  | 🔻 Producto con pérdida | Precio ≤ costo |
  | 📉 Margen bajo | Menos de la mitad del margen objetivo (30 % si no se cambia) |
  | 📈 Subió de costo: revisa el precio | La última factura costó 5 % o más que la anterior (últimos 45 días) y el margen quedó bajo el objetivo |
  | 💸 Gastos del mes por encima de lo normal | Gastos operativos más de 30 % sobre el promedio de los 3 meses anteriores |
  | 🗂️ Categoría con peor margen | Bajó 5 puntos o más frente al mes pasado |

### Pantallas
- **Inicio:**
  - el «Resultado» muestra «Gastos operativos» y la utilidad corregida;
  - dice cuánto en compras de mercancía no se restó;
  - las alertas financieras salen solo para el dueño o el administrador.
- **Contabilidad:** «Te quedó (caja)» es el flujo de caja. Nuevo **«🧮 Resultado estimado»**: ganancia de lo vendido −
  gastos operativos.
- **Estadísticas → 💹 Rentabilidad:**
  - utilidad bruta y margen bruto;
  - gastos operativos y resultado neto estimado;
  - **margen por categoría**;
  - los más rentables y **los de menor margen**;
  - aviso de lo vendido sin costo.
- **Inventario (Estadísticas):** nuevos «💼 Plata invertida (a costo)» y «📈 Ganancia potencial».
- **Fórmulas unificadas:** la revisión de facturas (`invoiceInferMargin`, `invoicePriceFromMargin`), el asistente
  (`asisMargin`) y Laya (cambio de precio) ahora usan el motor y dan los mismos números que antes.

## Pruebas
- `pruebas/finanzas.test.js` (17 ✅, nueva, en CI). Cubre:
  - el resultado sin doble conteo;
  - la rentabilidad por categoría;
  - el inventario;
  - las 5 alertas, y ninguna sin motivo;
  - Inicio, Contabilidad y Estadísticas con sus cifras;
  - las fórmulas unificadas.
- Las demás pruebas están en el mensaje de publicación.

## Pendiente de la fase 2
- IVA más detallado: excluidos, exentos, descontables y retenciones parametrizables.
- Rentabilidad filtrada por producto o categoría en el dashboard.
- Ambas van con la fase 7 (caja y gastos) y la de Informes.
