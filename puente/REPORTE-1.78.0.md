# ORDEVA 1.78.0 · 🗺️ El plano del local, otra vez a la mano y completo

## Qué pidió el dueño
«Corrígeme el mapeo del restaurante y del local, ya no puedo hacer el plano. Para hacer los planos de un local, un bar, una
tienda, un restaurante, un hotel; que se vea organizado, hermoso, fácil de manejar. Revisa errores, haz pruebas, y dime qué
más le agregarías a restaurantes y hoteles, también en la contabilidad.»

## El error
Desde la 1.65.6 la **vista sencilla** viene prendida de fábrica. Con ella, los botones «📋 Lista / 🗺️ Mapa del local»
quedaron escondidos dentro de «⋯ Más opciones» (`lib/vento-sencilla.js`). Por eso parecía que el plano ya no existía.

## Cómo quedó (`lib/vento-plano.js`)
- **Siempre a la vista:** arriba de las mesas o habitaciones están «📋 Lista | 🗺️ Plano» y «✏️ Editar plano».
- **Zonas o pisos en pestañas:** Salón, Terraza, Segundo piso… En los hoteles, un piso por pestaña, armado solo a partir de
  los números de habitación (101, 201…).
- **Elementos del local,** que no son mesas ni cuentas:
  - barra, cocina, baños, entrada, caja, recepción;
  - paredes, ventanas, pasillo, escaleras, ascensor;
  - estantes, neveras, bodega;
  - tarima, piscina, jardín, parqueadero, plantas y textos.

  Cada uno se mueve, se agranda o achica, se gira, se duplica, se le cambia el texto o se quita.
- **Mesas:**
  - **forma:** redonda, cuadrada, rectangular, alta, sofá, con sombrilla, billar, estación, silla o puesto, cancha;
  - **sillas:** se dibujan alrededor según cuántas personas caben;
  - **tamaño:** de pequeño a muy grande;
  - **giro**, nombre, foto y la zona donde va;
  - **las habitaciones** se ven como cama.
- **Plantillas en un toque:**
  - 🍽️ Restaurante: barra, cocina, baños, caja, entrada y ventana.
  - 🍻 Bar: barra, DJ o tarima, mesas redondas pequeñas.
  - ☕ Café: vitrina, caja y plantas.
  - 🏨 Hotel: pasillo con habitaciones a lado y lado, escaleras, ascensor y recepción.
  - 🛒 Tienda: góndolas, neveras, bodega, caja y entrada.
  - ⬜ Local vacío.

  Si el plano nunca se ha trabajado, la plantilla del tipo de negocio se ofrece sola.
- **Fácil de manejar:**
  - se arrastra con el dedo y las cosas caen en la cuadrícula;
  - «↩ Deshacer», «↺ Ordenar» y «➕ Mesa» (queda en la zona que se está viendo);
  - en el celular el plano se desliza de lado para no verse diminuto.
- **Para trabajar** (fuera de «Editar»): cada mesa tiene el color de su estado (libre, ocupada con el tiempo, reservada, por
  limpiar, para atender), y al tocarla se abre su cuenta.
- **Lo de antes se conserva:** la posición, la forma y la foto de cada mesa siguen igual.
- **Tiendas por caja:** no tienen mesas, así que no muestran plano de mesas.

## Pruebas
- **`plano` (nueva, 19 ✅, en el celular):** revisa cada paso:
  - con la vista sencilla, «Lista | Plano» está a la vista;
  - el plano vacío ofrece plantillas, y la del restaurante pone los elementos;
  - arrastrar una mesa la ubica en la cuadrícula y «Deshacer» la devuelve;
  - forma, 7 sillas dibujadas y tamaño grande;
  - agregar y quitar elementos;
  - zona «Terraza» nueva con una mesa nueva en ella;
  - fuera de editar, la mesa ocupada se ve así y al tocarla abre su cuenta;
  - el hotel arma un piso por pestaña y su plantilla pone el pasillo;
  - la plantilla del bar;
  - la tienda no muestra plano;
  - sin errores.
- **Siguen bien:** `mapa` (24), `mesa` (51), `hotel` (15), `vistasencilla` (45), `ordeva2pantallas` (20), `modos` (55),
  `mesacomoda` (16) y `modulos` (11).

## Lo que agregaría (restaurantes y hoteles, con la contabilidad)
### Contabilidad e impuestos
1. **Impuesto al consumo (INC 8 %) en restaurantes y bares.**
   - En Colombia, la venta de comidas y bebidas de un restaurante lleva INC, no IVA.
   - Hoy ORDEVA solo maneja IVA al vender; el impoconsumo solo lo lee en las facturas de compra.
   - Falta que cada negocio elija «IVA» o «INC 8 %» y que salga bien en la factura, el cierre y el Excel para el contador.
2. **Las propinas no son ingreso del negocio.**
   - Hoy la propina entra como una línea más de la cuenta y suma a las ventas.
   - Debe ir aparte, porque es de los empleados (Ley 1935 de 2018).
   - Falta un informe de propinas por día y por mesero, para repartirlas.
3. **Hoteles: IVA exento para extranjeros no residentes.**
   - El hospedaje de un turista extranjero con pasaporte puede ir sin IVA.
   - Con el registro de huéspedes 🪪 ya se sabe la nacionalidad: la cuenta podría proponerlo sola.
   - Debe guardar el soporte (pasaporte y sello de entrada).
4. **Comisiones de Booking y Airbnb como gasto:** que la reserva que llega por una plataforma descuente su comisión (15 a
   18 % en Booking, alrededor de 3 % en Airbnb), para ver la ganancia real.
5. **Estado de resultados del mes:** ventas, costo de ventas, gastos y utilidad, comparado con el mes anterior y con Excel
   para el contador. Hoy solo lo dice el asistente en texto.
6. **Costo por plato:** el porcentaje de costo de cada plato con las recetas, para ver cuáles dejan poco y cuáles
   conviene subir de precio.

### Restaurantes
7. **Comanda impresa en la impresora de cocina y de barra:** cada cosa a su impresora.
8. **Domicilios con estados y repartidor:** en preparación, en camino y entregado, con aviso por WhatsApp al cliente.
9. **Pagar desde el QR de la mesa** con Nequi, DaviPlata o Bre-B, confirmado por el aviso del banco.
10. **Turnos y propinas por mesero:** quién atendió cada mesa, cuánto vendió y cuánto le toca de propina.

### Hoteles
11. **Indicadores del hotel:** ocupación %, tarifa promedio por noche (ADR) y RevPAR por día y por mes.
12. **Check-out del día:** «Hoy salen 3 habitaciones», con el saldo de cada una para cobrar antes de que se vayan.
13. **Tarifas por temporada:** temporada alta, baja, fines de semana y festivos, para que el agente y la cuenta pongan el
    precio correcto solos.
14. **Contribución a FONTUR** (parafiscal de turismo): el cálculo mensual sobre los ingresos.
