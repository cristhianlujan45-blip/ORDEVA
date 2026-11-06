# ORDEVA: qué falta para ser un sistema POS completo (borrador del Elephant)

**Estado:** borrador para revisión Goldfish. **Versión revisada:** ORDEVA 1.82.2 (6 de noviembre de 2026).
**Pedido del dueño:** «revisa todo el proyecto y mira qué podemos mejorar para que quede un sistema POS completo».

## 1. Para qué es este documento
Decide qué construir para que ORDEVA haga todo lo que un comerciante colombiano espera de un sistema de punto de venta.
Los negocios son tiendas, restaurantes, bares, hoteles, agencias y servicios, con uno o varios equipos en la misma cuenta.

No es un plan de cada pantalla: es la lista de lo que falta, por qué importa, en qué orden, y qué riesgo trae cada parte.

## 2. Cómo está hecho ORDEVA hoy (lo que condiciona cualquier cambio)
- **Una página web** (`index.html` + `app/*.js` + `lib/*.js` + `nube/*.js`, unos 90 archivos sin empaquetar).
  - Funciona en el navegador, como app Android (`android/`, WebView con lectura de avisos de pago) y como programa de PC.
- **Todos los datos del negocio son UN documento JSON** (`data`).
  - Se guarda en el equipo (IndexedDB y `localStorage`) y se sincroniza con Supabase (`nube/vento-nube.js`): cada equipo
    sube los cambios y, si choca con otro, mezcla campo por campo (`fusionar`).
  - Ventas (`data.history`), cierres (`data.closures`), productos, mesas, libreta y contabilidad son listas dentro de ese
    documento.
  - **Consecuencia:** toda función nueva que guarde datos tiene que resistir dos equipos cambiando lo mismo a la vez.
    En la 1.82.0–1.82.2 se encontraron tres errores de este tipo: ventas con el mismo número, el stock que no sumaba y
    los cierres repetidos.
- **El servidor (Supabase)** tiene, además del documento:
  - pagos;
  - reservas;
  - facturación DIAN;
  - suscripciones;
  - canales del QR;
  - tablas que se llenan solas desde el documento para consultas (`20261031000000_proyeccion.sql`).
- **Pruebas:** 105 pruebas de navegador con un Supabase local real (`pruebas/`), 27 del servidor y las de Java de
  Android. Corren en GitHub en cada cambio.

## 3. Lo que ya tiene (no hay que rehacerlo)
| Área | Ya existe | Dónde |
|---|---|---|
| Vender | Caja POS con teclado, lector USB/Bluetooth, cámara del celular, celular como lector del PC | `lib/vento-pos.js`, `lib/vento-escaner-caja.js`, `lib/vento-lector-cel.js` |
| Cobrar | Efectivo con vueltas, Nequi, DaviPlata, Bre-B, transferencia, tarjeta (datáfono), mixto, fiado, saldo a favor | `lib/vento-pos.js` (`elegirPago`) |
| Precios | Descuentos, hora feliz, combos, variantes, precio por cliente, venta por peso con balanza | `lib/vento-caja-mas.js`, `lib/vento-equipos.js` |
| Devolver | Devoluciones con saldo a favor, cotizaciones, recibos de cualquier día | `lib/vento-caja-mas.js` |
| Caja | Abrir con base, entradas y salidas, corte X, cierre Z numerado, arqueo por billetes, varias cajas, Excel de cierres | `lib/vento-turno.js`, `app/04g-…` |
| Impuestos | IVA por tarifa, INC 8 %, retenciones estimadas, documento POS electrónico y factura DIAN | `app/04a-…` (`ivaLineas`), `nube/vento-dian.js` |
| Inventario | Stock, kárdex, entrada de mercancía con lector, toma de inventario, lotes y vencimientos, costo promedio, recetas e insumos, pedidos al proveedor | `lib/vento-inventario.js`, `lib/vento-recetas.js` |
| Clientes | Clientes frecuentes, puntos, fiados, libreta, crédito con cuotas y recordatorio | `app/13-libreta-…`, `lib/vento-caja-mas.js` |
| Restaurante | Mesas, plano, dividir cuenta, comanda impresa en cocina y barra, pantalla de cocina, QR en la mesa, app de meseros, reservas | `lib/vento-comanda.js`, `lib/vento-plano.js`, `app/09-…` |
| Hotel y agencia | Llegada y noches, registro de huéspedes, ocupación/ADR/RevPAR, reservas con Booking/Airbnb (iCal), cupos, viajeros, voucher con RNT | `lib/vento-hotel*.js`, `lib/vento-reservas.js`, `lib/vento-agencia.js` |
| Equipos | Impresora térmica, cajón, balanza, pantalla del cliente, etiquetas | `lib/vento-equipos.js` |
| Personas | Roles y permisos, PIN, varios equipos, ajustes por equipo | `app/27-roles-…`, `app/04a-…` |

## 4. Lo que falta, en orden

Cada punto dice qué problema le resuelve al comerciante, una propuesta y el riesgo principal.

### Prioridad 1: le cuestan plata o problemas con la DIAN hoy
**P1.1 · Factura electrónica DIAN con INC (restaurantes y bares).**
- **Hoy:** el recibo ya dice «INC 8 %» (1.82.0), pero el documento electrónico que va a la DIAN sale con IVA. Un
  restaurante que factura electrónicamente reporta el impuesto equivocado.
- **Propuesta:** que `nube/vento-dian.js` y el servidor de facturación manden el código de tributo del INC (04) cuando la
  venta tiene `inc`.
- **Riesgo:** depende del proveedor tecnológico. Hay que probarlo en su ambiente de habilitación antes de prenderlo.

**P1.2 · Estado de resultados del mes en Excel, para el contador.**
- **Hoy:** el contador recibe ventas, gastos y cierres sueltos. Las ventas, el costo, los gastos y la utilidad del mes
  solo los dice el asistente en texto.
- **Propuesta:** un Excel con una hoja por concepto, comparado con el mes anterior, desde las mismas funciones de
  Contabilidad (`ctMovimientos`, `F.resultado`). Sin las propinas (1.82.0) y con el INC aparte.
- **Riesgo:** bajo. Es solo lectura de datos que ya existen.

**P1.3 · Arqueo ciego (conteo sin ver lo esperado).**
- **Hoy:** al cerrar, el cajero ve «debe haber $98.000» antes de contar. Puede contar «para que cuadre».
- **Propuesta:** un ajuste del dueño «el cajero cuenta sin ver cuánto debe haber». El sistema compara después y el
  faltante queda a nombre de quien cerró.
- **Riesgo:** bajo. Es un cambio en `ventoTurno.arqueo`.

### Prioridad 2: lo que un comerciante espera de un POS y hoy no está
**P2.1 · Apartados (plan separe).**
- **Hoy:** el catálogo de tipos de negocio (ropa, joyería) promete «apartados con abono», pero no existe. Se hace a mano
  como fiado, sin reservar el producto.
- **Propuesta:** un apartado que separa las unidades (no se pueden vender a otro), recibe abonos y, al pagarse completo,
  se vuelve venta. Si vence, devuelve el stock.
- **Riesgo:** medio. Toca stock y dinero a la vez, y debe resistir dos equipos (usar contadores e ids únicos, como
  1.82.1).

**P2.2 · Tarjetas regalo y bonos.**
- **Propuesta:** vender un bono con código (QR o número) que después se usa como medio de pago, con su saldo.
- **Riesgo:** medio. El saldo debe vivir en el servidor, no en el documento: si dos equipos cobran el mismo bono a la
  vez, el documento no sabe impedir que se gaste dos veces.

**P2.3 · Comisiones por vendedor o barbero.**
- **Hoy:** solo existe como categoría de gasto. Nada calcula cuánto le toca a cada uno.
- **Propuesta:** porcentaje o valor fijo por producto o servicio y por persona, con el informe del período.
- **Riesgo:** bajo.

**P2.4 · Traslados de inventario entre sedes.**
- **Hoy:** cada sede tiene sus propios datos; no hay forma de mandar mercancía de una a otra.
- **Propuesta:** «enviar a la sede X»: sale de una y entra a la otra cuando la reciben.
- **Riesgo:** alto. Las sedes son documentos distintos: hace falta algo en el servidor que mueva entre dos documentos
  sin perder ni duplicar.

**P2.5 · Domicilios con estados y repartidor.** Recibido → en preparación → en camino → entregado, con aviso por WhatsApp.
- **Riesgo:** bajo-medio.

**P2.6 · Alertas en la caja.** Stock bajo con «pedir al proveedor» a un toque, y productos por vencer en el inicio con
«poner en promoción».
- **Riesgo:** bajo.

### Prioridad 3: depende del tipo de negocio
- **P3.1 · Dólares (turismo):** cobrar en dólares con la tasa del día y dar las vueltas en pesos.
- **P3.2 · Hoteles:** tarifas por temporada; IVA exento para extranjeros no residentes y el cálculo de FONTUR.
- **P3.3 · Comisión de Booking y Airbnb** descontada en cada reserva.
- **P3.4 · Asistencia del personal:** marcar entrada y salida con el PIN.
- **P3.5 · Menú del día** (sopa, principio, proteína) ofrecido por el QR.

### Técnico: no lo ve el comerciante, pero sostiene todo lo anterior
- **T1 · Ventas fuera del documento único.**
  - **Problema:** con años de ventas, el documento crece. Cada equipo lo baja entero al entrar y lo mezcla en cada
    cambio.
  - **Propuesta:** guardar las ventas viejas (más de N meses) en las tablas del servidor (ya existe la proyección) y que el
    documento lleve solo las recientes.
  - **Riesgo:** alto. Toca la sincronización, que es donde más errores aparecieron.
- **T2 · Primera carga en 4G:** juntar y comprimir los ~90 archivos.
- **T3 · Pruebas con equipos de verdad:** celulares, lectores e impresoras.

## 5. Lo que este documento NO propone
- Rehacer la sincronización ni pasar a otra base de datos.
- Integrarse con plataformas de domicilios (Rappi, iFood): sus APIs son cerradas y cambian.
- Una tienda en línea completa (ya hay carta/QR y agente de pedidos).

## 6. Orden propuesto
1. **1.83:** P1.2 (estado de resultados), P1.3 (arqueo ciego), P2.6 (alertas en la caja). Son bajo riesgo y de valor
   inmediato.
2. **1.84:** P2.1 (apartados) y P2.3 (comisiones).
3. **1.85:** P1.1 (DIAN con INC), cuando el proveedor lo habilite en pruebas.
4. Después: P2.2 (bonos, con servidor), P2.5 (domicilios), P3 según qué negocios lo pidan. T1 solo con un plan propio.

## 7. Preguntas abiertas
- ¿Cuántas ventas tiene hoy el negocio más grande? Decide si T1 es urgente o puede esperar.
- ¿Qué proveedor de factura electrónica usan los clientes que tienen INC? Decide si P1.1 es posible ya.
- ¿Los apartados deben poder pagarse desde otro equipo o sede?
