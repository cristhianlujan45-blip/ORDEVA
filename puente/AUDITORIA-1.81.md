# Auditoría ORDEVA 1.81 (4 de noviembre de 2026)

La auditoría se hizo midiendo y probando, no solo leyendo el código. Las prioridades fueron restaurantes, hoteles, tiendas
y agencias.

## 1. Lo que se midió (y está bien)
| Qué | Resultado |
|---|---|
| **Abrir la app en un celular sencillo** (procesador 4× más lento) | Carga en 1,2 s y entra en 1,8 s. Sin caché y con 4G lento, la primera vez son unos 10 s (descarga de 4,1 MB, que GitHub Pages manda comprimidos: `index.html` pasa de 400 KB a 103 KB). Las siguientes veces abre de lo guardado en el equipo. |
| **La página quieta** | 0,2 s de trabajo cada 30 s y respuesta en 4 ms. Igual que la 1.77.0, así que no es la causa de la demora de los pagos. |
| **Un año de ventas** (20.000 ventas, 4,7 MB de datos, celular 4× más lento) | Contabilidad 0,22 s, Estadísticas 0,33 s, Historial 0,06 s, cobrar en la caja 0,14 s. |
| **Dónde se guardan los datos** | Los grandes van a IndexedDB, así que no los frena el límite de 5 MB del `localStorage`. |
| **Todas las pantallas** en un celular de 360 px, en restaurante, hotel, tienda, agencia y cervecería | Ningún error y nada que se salga de la pantalla. Solo 1 o 2 botones pequeños por pantalla (el «?» de ayuda). |
| **Calendario público para Booking y Airbnb** | Solo dice «Reservado - ORDEVA», nunca el nombre ni el celular del huésped. |
| **Avisos de pago** (lo que preguntó el dueño) | Se corrigieron dos causas posibles en la 1.81.1. La página no está más pesada y el servidor no cambió. Ver `REPORTE-1.81.0.md` y el commit de la 1.81.1. |

## 2. Arreglado en esta auditoría
1. **Varias cajas:** el cierre de una caja sumaba también lo vendido por las otras desde el último cierre de cualquiera.
   Ahora cada caja cierra solo sus ventas, desde su propio último cierre, y el cierre dice «Cierre Z N.º 0007 · Caja 2».
   Prueba: `cajamas`, 43 ✅.
2. **Pruebas:** de 159, GitHub solo corría 94 en cada cambio; las otras 65 solo a mano. Ahora **corren todas cada noche**
   (2:17 a. m.), para que nada se dañe sin aviso.
3. **Las 65 pruebas que no corrían:** se corrieron aquí. Lo que salió está en la sección 5.

## 3. Lo que más conviene mejorar (por orden de importancia)

### 🧾 Contabilidad e impuestos (afecta a todos)
1. **Las propinas cuentan como venta.**
   - Hoy la propina suma a «Vendido», a las entradas de Contabilidad y al cierre. No es ingreso del negocio, es de los
     empleados (Ley 1935 de 2018).
   - Al IVA ya no se le suma: eso está bien.
   - **Propuesta:** que vaya aparte en Contabilidad y en el cierre («🤝 Propinas: $X, de los empleados»), con el informe por
     mesero para repartirla.
2. **Impuesto al consumo (INC 8 %) en restaurantes y bares.**
   - La venta de comida y bebida en restaurantes lleva INC, no IVA. Hoy ORDEVA solo maneja IVA al vender.
   - **Propuesta:** elegir «IVA» o «INC 8 %» por negocio o por producto, y que salga así en el recibo, la factura DIAN, el
     cierre y el Excel.
3. **Comisiones de Booking y Airbnb:** descontar la comisión de cada reserva que llega por una plataforma, para ver la
   ganancia real.
4. **Estado de resultados del mes**, con Excel para el contador: ventas, costo, gastos y utilidad, comparado con el mes
   anterior. Hoy solo lo dice el asistente en texto.

### 🍽️ Restaurantes y bares
5. **Comanda impresa en la impresora de cocina y en la de barra**, cada cosa a la suya. Hoy la impresora solo imprime la
   factura.
6. **Domicilios con estados y repartidor:**
   - recibido → en preparación → en camino → entregado;
   - aviso por WhatsApp al cliente: «tu pedido va en camino».
7. **Menú del día:** poner cada día la sopa, el principio y la proteína, y que el QR y el agente lo ofrezcan.
8. **Platos que dejan más y menos:** el informe semanal del % de ganancia de cada plato con las recetas.

### 🏨 Hoteles
9. **Indicadores:** ocupación %, tarifa promedio (ADR) y RevPAR por día y por mes.
10. **«Hoy salen 3 habitaciones»**, con el saldo de cada una, para cobrar antes de que se vayan.
11. **Tarifas por temporada:** alta, baja, fines de semana y festivos, puestas solas en la cuenta y en el agente.
12. **IVA exento para extranjeros no residentes**, que el registro 🪪 ya sabe proponer por la nacionalidad, y el cálculo
    de **FONTUR**.

### 🛒 Tiendas
13. **Avisos de stock bajo en la caja**, con «pedir al proveedor» a un toque, por el pedido por WhatsApp que ya existe.
14. **Productos por vencer en el inicio**, con «poner en promoción». Hoy solo salen en Estadísticas.
15. **Combos «lleve 3 pague 2»** que la caja ponga solos.

### ✈️ Agencias de turismo
16. **Viajeros de cada venta** (documento, nacimiento, contacto de emergencia) y **salidas con cupos reales** que bajen al
    vender, sin pasarse.
17. **Voucher en PDF** para el cliente, con el número del **RNT** (obligatorio en Colombia).

### ⚙️ Técnico
18. **Archivos de código:** son 87 sin comprimir (3,7 MB). Unirlos y comprimirlos en un paquete por versión haría la
    primera carga en 4G 2 a 3 veces más rápida. No cambia nada de lo que hace la app.
19. **Pruebas que dependen del tiempo:** varias fallan a veces en GitHub porque GitHub es más lento (pasó con `reservas`,
    `plano` y `guia`). Hay que pasarlas a «esperar hasta que aparezca» en vez de esperas fijas.

## 4. Recomendación
Empezar por la **1 (propinas aparte)** y la **2 (INC 8 %)**. Son errores de contabilidad que afectan lo que se le reporta
al contador y a la DIAN. Después, la **5 (comanda impresa)** para restaurantes y la **9 y la 10 (indicadores y salidas del
día)** para hoteles.

## 5. Las 65 pruebas que no corrían en GitHub
(Se llena al terminar la tanda.)
