# ORDEVA 1.82.1 · Auditoría: errores que quedaban y qué mejorar

**Pedido del dueño:** «vuelve a revisar, mira qué errores todavía tenemos y qué hay por mejorar».

La auditoría se centró en lo que más daño hace: **datos que se pierden entre equipos**. Es lo que el dueño acababa de
reportar con las ventas, y el mismo tipo de error podía estar en otras partes.

## 1. Errores encontrados y arreglados

### 1.1 🔴 El inventario no descontaba una venta cuando dos equipos vendían lo mismo a la vez
- **Qué pasaba:** al juntar los datos de dos equipos, si los dos dejaban un producto IDÉNTICO, se tomaba como «es el mismo
  cambio». Por ejemplo: los dos vendieron 1 cerveza y los dos dejaron el stock en 19 de 20. Quedaba en 19: una venta sin
  descontar.
- **Cuándo pasaba:** con dos cajeros vendiendo el mismo producto en el mismo momento. Es común en un bar o una tienda con
  dos cajas.
- **Arreglo** (`nube/vento-nube.js`, `cambioContador`): si cambió el stock, se mezcla campo por campo y se suman los dos
  movimientos. Del ejemplo queda 18.
- **Prueba nueva `sincstress`:** 8 ventas entre los dos equipos a la vez. Con la versión anterior queda 16 de 20; ahora,
  12 en los dos.

### 1.2 🟠 «Deshacer» una venta que llegó de la nube no devolvía el inventario
- **Qué pasaba:** lo que hay que devolver al inventario (`_inv`) solo vivía en la memoria del equipo que vendió. Si la
  venta llegaba de la nube, o se recargaba ORDEVA, al deshacerla se borraba la venta pero el producto no volvía al
  inventario.
- **Arreglo** (`app/04f-pedidos-escritos-categorias.js`): si no está, se devuelve con los productos de la venta.

### 1.3 🟡 Más números que se podían repetir entre equipos
Es el mismo error de las ventas que se perdían (1.82.0), en otras cosas que se sincronizan:
- los cierres de caja del módulo de mesas;
- las entradas y salidas de efectivo del turno;
- los productos creados desde el inventario;
- las cotizaciones, los pedidos al proveedor y las promociones de la vitrina;
- los grupos de mesas, las zonas del plano y los servicios de Contabilidad.

Ahora llevan una parte al azar. Era menos probable que en las ventas, pero se perdía igual.

### Lo que se revisó y está bien
La prueba `sincstress` (10 revisiones) hace todo en dos equipos AL MISMO TIEMPO, contra el servidor de pruebas:
- **Gastos de Contabilidad:** quedan todos en los dos.
- **Entradas y salidas de la caja:** quedan todas.
- **Una venta borrada en un equipo mientras el otro vende:** la borrada no vuelve y la nueva llega.
- **Productos nuevos creados a la vez:** quedan los dos.
- **La misma mesa en los dos equipos a la vez** (3 + 3): 6 en los dos.

`ventasfiados` (16), `sincroniza` (27) y `sincmesas` (24) también pasan.

## 2. Pruebas
- **La lista completa (104 pruebas, todas las de GitHub + `facturascan`):** 2.527 revisiones bien, 0 mal.
- **Las 27 del servidor:** pasan.
- **Android (`javaavisos`, con `android-all`):** 328 de 328.
- **`sincstress`:** con la versión anterior falla 2 (stock 16 en vez de 12, y deshacer no devuelve el inventario);
  ahora pasa 10 de 10.
- **No se probó con equipos de verdad.**

## 3. Lo que queda por mejorar (por orden de importancia)
1. **El cierre de caja hecho a la vez en dos equipos** (sin «varias cajas»): no se probó. Puede quedar el cierre
   repetido. Conviene que el segundo equipo vea el cierre del primero y no vuelva a cerrar lo mismo.
2. **Pruebas de Android en GitHub:** `EscuchaPrueba` y `CrucePrueba` (los avisos de pago de Android) solo corren aquí,
   porque GitHub no tiene el `android-all`. Conviene descargarlo en GitHub para que los avisos de pago se revisen en cada
   cambio.
3. **Factura electrónica DIAN con INC** para restaurantes: hoy sale con IVA.
4. **Comanda impresa para los pedidos del QR y de los meseros**, sin tocar «Enviar».
5. **Estado de resultados del mes en Excel para el contador.**
6. **Comisiones de Booking y Airbnb** en la ganancia de cada reserva.
7. **Domicilios con estados** (recibido → en camino → entregado) y aviso por WhatsApp.
8. **Hoteles:** tarifas por temporada, e IVA exento para extranjeros (y FONTUR).
9. **Tiendas:**
   - avisos de stock bajo en la caja, con «pedir al proveedor»;
   - productos por vencer en el inicio.
10. **Primera carga más rápida en 4G:** juntar y comprimir los archivos de código.
11. **Pruebas con equipos de verdad:** celulares, lectores, impresoras y TVs.
