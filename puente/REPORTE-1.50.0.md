# Vento 1.50.0 · La voz de los pagos vuelve a sonar en todos los celulares, todo sincroniza más rápido, tablero de estadísticas nuevo y caja con QR en el modo fácil

El dueño: «Ya no me está sonando cuando pagan. Que suenen todos los celulares de administrador, cada vez que llegue la
plata, así esté bloqueado, que diga cuánto entra. Que llegue en todo, siempre notifique y que sea más rápido. Y que se
sincronice más rápido: cuando agrego cervezas en una mesa, que se sincronice todo muy rápido».

## 1. Por qué dejó de sonar la voz, y el arreglo
- **La causa:** en la 1.49.0 el volumen de fábrica pasó a 130 %. La página le manda ese volumen a la app Android cada vez
  que abre, **también a las apps que no se habían actualizado**.
  - Por encima de 100 %, con la voz de Google o de Samsung, la app ya no decía la frase directo. La grababa a un archivo,
    la reforzaba y después la tocaba.
  - Ese camino es el que dejó pagos callados en algunos celulares en la 1.40.
  - Así la voz se cayó en casi todos los celulares, aunque nadie hubiera tocado nada.
- **El arreglo:**
  - **De fábrica, 100 %:** la voz suena por la alarma del celular **al máximo** y se dice **directo**, como en todas las
    versiones que funcionaron. Suena con el celular en silencio y bloqueado, y después el volumen vuelve a como estaba.
  - **En la app Android nueva, la voz siempre se dice directo**, también si alguien sube a más de 100 % (Ajustes →
    Pagos). El refuerzo va sobre la misma voz en vivo, sin grabar archivos. Solo el parlante de avisos (Bluetooth o cable)
    sigue grabando, como antes.
  - Los celulares con la app vieja también se arreglan al abrir la página nueva, porque ya no reciben el 130 %.
- Sigue diciendo la cantidad, sin el nombre: «Llegaron 3200 pesos, por Nequi».

## 2. Más rápido entre los celulares de la cuenta
- **Pagos:**
  - Los otros celulares preguntan por los pagos **cada 2,5 s** desde la app Android, también bloqueados. Antes era cada
    5 s, y en la 1.48 cada 10 s.
  - El celular que lee el aviso lo manda al servidor en el mismo segundo.
  - En el computador y el navegador, el respaldo del tiempo real revisa cada 6 s si se cayó (antes 20 s) y cada 20 s
    aunque esté vivo (antes cada minuto).
- **Datos (mesas, cervezas, cuentas):**
  - Cada cambio sube a la nube a los **0,3 s** (antes 1 s).
  - Los otros equipos lo bajan **apenas les llega el aviso en vivo**, sin una consulta antes (un viaje menos).
  - Si el aviso en vivo no llega, revisan **cada 3 s** (antes 5 s).
- **Un pago, una sola voz:** al acelerar se vio un caso viejo.
  - Si la tablet registraba el pago y esos datos le llegaban al celular que lo había leído, el celular a veces lo volvía
    a anunciar como si fuera de otro equipo.
  - Ahora el celular reconoce su propio registro, y la copia que bajó de la nube no se cuenta dos veces.

## 3. 🛰️ Tablero en Estadísticas (como el de astracore, con los colores de Vento)
Arriba de Estadísticas, con el período de siempre (Hoy, 7 días, 30 días, Todo):
- **4 tarjetas:** Pedidos totales, Ingresos totales, Ticket promedio y Productos vendidos. Cada una con ▲/▼ % contra
  ayer, o contra los días anteriores del mismo largo.
- **📈 Ingresos por hora** (o por día o por mes):
  - **En mesas** y **en caja** (mostrador y domicilios), por separado.
  - Al tocar la gráfica, una ventanita con la hora y los valores.
  - **Hoy, el ESTIMADO al cierre:** el promedio de los mismos días de las semanas anteriores (por ejemplo, los últimos 4
    jueves). Va en línea punteada y **siempre dice «estimado»**: nunca se mezcla con la plata real.
- **🏆 Productos más vendidos:** dona y lista con unidades, % y plata.
- **🛠️ Carga de trabajo:** finalizados contra cancelados o devueltos (pedidos por QR cancelados y devoluciones).
- **⚡ Últimos movimientos:** tarjetas que se deslizan (Mesa, orden, FINALIZADO / FIADO / DEVOLUCIÓN, valor y hora).
- **🧠 Lo que ve Laya:** la hora o el día más fuerte, lo que más salió, cuánto más o menos que antes, caja contra mesas,
  fiados y el estimado. **Solo cifras de las ventas guardadas.**
- **🧾 Órdenes recientes:** tabla con páginas de 8.
- **Apariencia neón** con las paletas oscuras: borde cian con brillo, cuadrícula de fondo y códigos tipo `SALES//01`.
  Con la paleta clara se ve en claro. Las estadísticas de siempre siguen debajo.

## 4. 🛍️ Caja en el modo fácil, con código y con QR
- **«🛍️ Venta rápida (caja)»** también en los negocios con mesas (antes solo en el modo mixto).
- **«📷 Leer código»**, botón grande en la caja y en cada mesa: la cámara lee el código de barras o QR del producto y lo
  agrega.
- **«📲 Pagar con QR»** al cobrar, si el negocio guardó su QR de pago (Bre-B, Nequi…):
  - sale el QR en grande con el total a pagar;
  - **si mientras tanto llega un pago por ese valor exacto, la venta se cobra sola** («✅ ¡Llegó! $15.000 por Nequi»);
  - si no, «✅ Ya pagó»;
  - un pago de otro valor no se toma y sigue a las mesas como siempre.

## 5. ETAPA 1 — Auditoría (lo que tiene Vento hoy)
**Se conserva, ya funciona:**
- **Venta y cobro:**
  - mesas, caja POS (tienda o mixto), pedidos por QR con pantalla de preparación, domicilios;
  - propinas, dividir cuenta, fiados (libreta), combos y promociones, precio por cantidad.
- **Plata y documentos:**
  - facturación DIAN (P.O.S. y factura electrónica);
  - caja con base y arqueo, entradas y salidas, devoluciones;
  - pagos Nequi, DaviPlata y Bre-B por aviso del celular, con confirmación y voz.
- **Inventario y compras:** inventario por código con kárdex, lectura de facturas de proveedor con IA, márgenes y
  rentabilidad.
- **Laya (la IA):** centro de control, auditoría, predicción de agotados, tiempos de pedidos. **No se duplica:** el
  tablero usa sus mismas reglas («no inventar cifras»).
- **Equipos y operación:** clientes frecuentes, roles y permisos, equipos POS (balanza, impresora, cajón), varios
  celulares sincronizados, modo fácil con guía y voz.
- **ntfy:** Vento ya no lo usa. `lib/vento-canal.js` solo entiende las direcciones viejas para mandarlas al servidor de
  Vento. No hay ninguna dependencia de ntfy.

**Se optimizó en esta versión:** la voz de los pagos, la rapidez de pagos y datos entre equipos, las estadísticas
(tablero) y la caja del modo fácil.

**Lo que de verdad falta (frente a la competencia: Siigo, Loggro/PirPos, Alegra, astracore):**
- **Recetas e insumos:**
  - costo real de cada plato según sus ingredientes en gramos o ml;
  - descontar insumos al vender;
  - avisar antes de cobrar si no alcanza un ingrediente.
  - Hoy solo existen los combos, que descuentan productos enteros.
- **Tutorial con ventas de práctica para personas mayores:** hay guía y recorrido, pero no práctica.
- **Lista de compras sugerida al proveedor** con lo que se va a agotar, para mandar por WhatsApp.
- **Cuentas por pagar a proveedores:** facturas de compra por pagar y abonos.
- **Reservas y citas** con recordatorio (Vento ya lo anota como faltante en barberías, consultorios y talleres).
- **Reportes de caja por turno y por usuario en el tablero:** diferencias del arqueo, entradas y salidas por persona.

## 6. ETAPA 2 — Plan, en pasos chicos
1. **Crítico (hecho en esta versión):** voz de los pagos, rapidez y sincronización.
2. **Alto, siguiente versión:**
   - **Práctica de ventas para personas mayores:** ventas de mentira con productos del negocio, voz que dice cada paso,
     botones grandes y estrellas al terminar, sin tocar las ventas reales. Archivos: `lib/vento-guia.js` (se reusa su voz
     y su micrófono) y un archivo nuevo para la práctica.
   - **Recetas e insumos.** Archivos: `index.html` (inventario e invOnSale), `lib/vento-pos.js` (aviso antes de
     cobrar) y una tarjeta «Consumo e inventario» en el tablero.
3. **Medio:**
   - lista de compras sugerida;
   - tarjeta «🔐 Caja auditada» del tablero (diferencias del arqueo y movimientos por usuario);
   - cuentas por pagar.
4. **Evolutivo:**
   - reservas y citas;
   - reglas automáticas (por ejemplo: «si un producto baja de X, avísame»);
   - comparativos entre sedes.

## Pruebas
- **Nuevas:**
  - `tablero`: 26, con la hora fija y ventas sembradas. Revisa las cifras exactas de las 4 tarjetas y sus %, mesas
    contra caja, el estimado marcado como estimado, más vendidos, carga de trabajo, movimientos, páginas, Laya, cambio de
    período, paleta clara y celular de 320 px, 390 px, tablet y computador sin salirse de la pantalla.
  - `cajaqr`: 13. Revisa la venta rápida en un restaurante, «📷 Leer código», «Pagar con QR», el pago que llega solo por
    el valor exacto, «Ya pagó», que un pago de otro valor no se tome y «Volver».
- **Voz en todos los celulares (`PlanVozPrueba`):** 13 tipos de celular y tablet × 6 volúmenes × con y sin parlante.
  Sin parlante, siempre directo.
- **`javaavisos`:** 252. Además compila todo el código Android con `android-all` (Android 14).
- **Pagos y sincronización:**
  - `pagosequipos`: 40, con PostgreSQL real, con el caso del celular que no debe repetir el pago;
  - `pagosaviso`: 92, ahora de fábrica 100 %;
  - `confirmapago`: 61;
  - `sincroniza`: 22.
- **Suite completa:** 79 de 79 pruebas, 2331 comprobaciones, 0 fallos.

## Lo que necesita el dueño
- **Abrir Vento en cada celular**, para que tome la página nueva: la voz vuelve a 100 % directo, también con la app
  vieja.
- **Instalar la app Android nueva** con «Actualizar ahora» en la 🔔 campanita: voz siempre directa y pagos cada 2,5 s.
- **Para probar:** Ajustes → Pagos → «▶ Probar la voz».
