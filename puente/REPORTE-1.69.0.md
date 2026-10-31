# ORDEVA 1.69.0 · Las 12 mejoras propuestas

El estado de cada punto, con lo que se probó y lo que no.

## 1. Sincronizar solo lo que cambió ✅

### Cómo funciona
- **Antes:** cada «+» subía el negocio completo y cada equipo lo bajaba completo.
- **Ahora:** solo viajan las partes que cambiaron.
  - Las mesas viajan por mesa.
  - Las listas con `id` (como el historial) viajan por renglón: lo nuevo al comienzo, lo cambiado y lo borrado.
- Los otros equipos bajan solo esos cambios.
- **Servidor** (migración `20261123000000_datos_por_partes.sql`, que solo agrega):
  - `guardar_cambios` pone las partes sobre el documento guardado.
  - Hace exactamente lo mismo que `guardar_datos`: clave de IA aparte, detalle privado de los pagos, protección del
    equipo, canal de pedidos y respaldos.
  - El documento completo se sigue guardando igual: los respaldos y las tablas de informes no cambian.
- **`datos_cambios`** guarda lo que de verdad quedó en cada versión (las últimas 300), con RLS de miembros. Lo que
  reciben los demás es lo que quedó guardado:
  - sin el detalle privado de los pagos;
  - con el precio real si un mesero lo intentó cambiar.

### Si algo no cuadra, todo el negocio como antes
Pasa en estos casos:
- falta una versión (por ejemplo, un respaldo restaurado);
- no hay base;
- el servidor todavía no tiene la función;
- cambió casi todo.

### Medido
Con 4000 ventas, un «+» viaja como ≈3 KB en vez de ≈758 KB.

## 2. Indicador de sincronización ✅
- Está arriba, junto a «Salir»:

  | Indicador | Qué quiere decir |
  |---|---|
  | ✓ | Al día |
  | ⏳ | Enviando |
  | ⚠️ | Sin internet: lo que se haga queda guardado y se envía solo al volver |

- Tocarlo dice el detalle.

## 3. El celular del empleado vuelve a lo que dejó el servidor ✅
- Si un empleado sin permiso cambia un precio, el servidor lo deja como estaba.
- Ahora su celular baja enseguida lo que quedó y le avisa. Antes seguía mostrando su precio.

## 4. Probar en celulares reales ⚠️ Pendiente (no se puede desde aquí)
- Todo se probó en Chromium y contra el servidor de pruebas (PostgreSQL real).
- Falta una prueba corta en el negocio con un Android sencillo: sincronización con dos celulares y voz.

## 5. Caja y gastos ✅
- **Tipos de gasto:**

  | Tipo | Qué incluye |
  |---|---|
  | Directos | Mercancía, insumos, fletes y comisiones por venta |
  | Operativos | Lo demás para que el negocio funcione |
  | Administrativos | Nómina, salud y pensión, impuestos, licencias y seguros |
  | Financieros | Bancos |

- **Contabilidad:**
  - «🗂️ Gastos por tipo».
  - «📊 Frente al período anterior»: este mes se compara contra el mismo tramo del mes pasado; hoy, contra ayer.
- **Cierre de caja:** muestra lo que entregaron los clientes en efectivo y las vueltas, en el arqueo y en el cierre
  guardado.

## 6. Facturas: enderezar y recortar la foto ✅ Ya existía
- La auditoría de la 1.67 lo marcó mal.
- ORDEVA ya busca el papel, corrige la perspectiva y empareja la luz antes de leer.
- Además existe «✂️ Ajustar esquinas».
- Corregido en la auditoría.

## 7. Laya con las cifras del negocio ✅
- Responde con el mismo motor de Estadísticas:
  - «¿Qué categoría me deja menos?», «¿cuál es la más rentable?» y «¿qué producto tiene el menor margen?»;
  - «¿Qué gasto subió este mes?»;
  - «¿Cuánto gané este mes?»: vendido, costo, utilidad bruta, gastos operativos y resultado.
- Antes «¿cuánto gané?» daba la ganancia sin restar los gastos, y también se la daba al equipo.
- Solo dueño o administrador. Sin datos, lo dice.

## 8. Suscripciones: conciliación ✅
- `srv_sub_conciliar` (migración `20261123000001_sub_conciliar.sql`): un pago aprobado nunca pierde su tiempo.
  - Si un «Dar plan» o un cambio de plan dejó menos días de los pagados, se alarga hasta el final del pago.
  - Si el plan venció y el pago todavía cubre, se reactiva.
  - No toca planes cancelados ni rechazados por una persona.
- Corre sola cada 10 minutos (pg_cron) y en ORDEVA Admin hay un botón «🧮 Conciliar pagos».

## 9. Historial más liviano ✅ En parte
- La pantalla ya mostraba el historial por páginas («ver más»).
- Con el punto 1, la red ya no carga todo el historial en cada cambio.
- Lo que no cambió: el celular todavía tiene todo el historial en memoria. Con negocios de varios años esto se puede
  partir por años más adelante.

## 10. IVA detallado y Excel ✅
- **Cada producto:** gravado (con su tarifa), exento o excluido.
- **Contabilidad → «🧾 IVA del período (estimado)»:**
  - IVA generado por tarifa;
  - ventas exentas y excluidas;
  - IVA descontable de las facturas de compra;
  - saldo por pagar o a favor;
  - retenciones (ReteFuente, ReteIVA y ReteICA en Ajustes → Negocio).
  - Dice que es un estimado para el contador.
- **«📊 Excel completo»:** un .xlsx de verdad, hecho sin librerías.
  - Hojas: Resumen, Ventas, Productos vendidos, Gastos e IVA.
  - Los números se pueden sumar.

## 11. Voz ✅
- **Peso:** entiende «medio kilo de queso», «dos libras de carne» (libra de 500 g), «300 gramos de jamón» y «kilo y
  medio».
  - Un producto por peso sin peso dicho abre la ventana de pesar.
  - Un producto por unidad no se agrega por gramos, y ORDEVA lo dice.
- **🔒 Reconocer la voz en este equipo** (⚙️ de la caja):
  - usa Vosk en WebAssembly con el modelo en español (~34 MB la primera vez);
  - la voz no sale del equipo y funciona sin internet, también en Windows y Mac;
  - se le pasan las palabras del negocio para que entienda mejor.
  - El modelo se descarga de `ccoreilly.github.io`, el sitio del autor de la librería. Si ese sitio falla, ORDEVA vuelve
    al dictado de siempre o a la orden escrita.

## 12. Dirección vieja (…/cuentas/ → …/ORDEVA/) ⚠️ Falta un paso tuyo
- Las apps de Android y computador ya usan la dirección nueva.
- Para la vieja hay que crear el repositorio especial `cristhianlujan45-blip.github.io`.
- El permiso que tengo no deja crear repositorios: GitHub contestó 403.
- Los archivos y los pasos (2 minutos) están en `puente/sitio-reenvio/LEEME.md`.
- **No** crees un repositorio llamado «cuentas»: rompería la redirección que usa GitHub.

## Pruebas
- **Nuevas en CI:**

  | Prueba | Resultado | Qué cubre |
  |---|---|---|
  | `sincmesas` | 23 ✅ | 7 casos, entre ellos por partes, indicador y mesero |
  | `cajagastos` | 10 ✅ | Tipos de gasto, comparación y vueltas en el cierre |
  | `layafinanzas` | 10 ✅ | Laya con las cifras del negocio |
  | `ivaexcel` | 18 ✅ | IVA y Excel; el .xlsx se abrió con openpyxl |
  | `cajavoz` | 59 ✅ | Ampliada con el peso por voz |

- **Nueva fuera de CI:** `cajavozlocal` (5 ✅). Usa el modelo real y un micrófono de Chromium alimentado con una frase de
  espeak-ng. Necesita internet y espeak-ng.
- **Servidor:**
  - `porpartes` 20 ✅ y `subconciliar` 11 ✅ (nuevas);
  - las demás pruebas de servidor (23 archivos) pasaron;
  - `revisar-migraciones`: «no borra datos» y RLS en todas las tablas.
- La lista completa de CI está en el mensaje de la publicación.

## Lo que no se probó
- Celulares y computadores reales (punto 4).
- Qué tan bien entiende el reconocedor local una voz humana con ruido. Con la voz sintética entendió «cobrar en
  efectivo», pero no bien los nombres de productos.
