# ORDEVA: qué falta para ser un sistema POS completo (versión 2, después de la revisión Goldfish)

**Estado:** para aprobación del dueño. **Revisión:** `puente/egm/REVISION-GOLDFISH.md`, de cuatro revisores con contexto
nuevo. **Código revisado:** ORDEVA 1.82.2.

## 1. Lo que cambió desde el borrador 1
- **Tres cosas que el borrador daba por faltantes ya existen:**
  - la DIAN con INC (el servidor manda el código 04);
  - el estado de resultados en Excel (`ctExcel`, cinco hojas);
  - las alertas de stock bajo y de productos por vencer en el inicio.

  Bajan a ajustes pequeños.
- **La revisión encontró cuatro errores reales del código actual** (sección 2). Van primero.
- **Traslados entre sedes y «ventas fuera del documento»** salen de esta lista: cada uno es un proyecto con plan propio.
- **Los apartados reutilizan la cotización,** en vez de crear algo nuevo.
- **Las comisiones suben de riesgo** y van antes que los apartados. Las barberías, salones y lavaderos las tienen
  prometidas.

## 2. 1.83 · Errores primero (riesgo de plata o legal)
- **B1 · Un solo ajuste de impuesto.**
  - **Qué pasa:** el «INC 8 %» del recibo (`data.impuestoConsumo`) y el de la DIAN (`dian_config.impuesto`) van sueltos.
  - **Arreglo:**
    - con la DIAN conectada, cambiar uno cambia el otro;
    - si no coinciden (negocios de antes), se avisa en Ajustes y en la factura;
    - una prueba revisa que recibo y DIAN digan lo mismo.
- **B2 · El número de factura no se repite.**
  - **Qué pasa:** hoy `invoiceNextNo` es un número suelto; dos equipos dan el mismo número.
  - **Arreglo:** cada equipo toma su número del servidor (como ya hace la DIAN con `srv_dian_reservar`). Sin internet, sale
    un número provisional que se cambia al conectarse.
  - **Alternativa más simple:** un prefijo por equipo (A-0001, B-0001). Decide el dueño (pregunta 1).
- **B3 · Juntar cierres sin faltantes falsos.** Al juntar dos cierres de la misma caja, se recalculan lo que debía haber
  y la diferencia con las ventas de los dos. Si contaron los dos, quedan los dos conteos. Arregla lo de la 1.82.2.
- **B4 · Lotes que suman entre equipos.**
  - Las unidades de cada lote se mezclan como el stock (contador).
  - La toma de inventario y la entrada de mercancía también actualizan los lotes.
- **Ajustes pequeños de lo que ya existe:**
  - el Excel de Contabilidad con la columna del mes anterior y la fila del INC;
  - un solo criterio de «stock bajo» (hoy hay tres: 5, 3 y solo con mínimo);
  - «pedir al proveedor» a un toque desde la alerta.

## 3. 1.84 · Lo que el catálogo promete y no cumple
- **Comisiones** (barberías, salones, lavaderos):
  - al vender un servicio se elige quién lo hizo;
  - la venta guarda en cada renglón la persona y su comisión de ese momento;
  - el informe del período por persona, y lo pagado como lista de pagos.
- **Arqueo ciego:**
  - un ajuste del dueño: el cajero cuenta sin ver lo esperado en ninguna de las cinco pantallas donde aparece hoy;
  - lo esperado y la diferencia se calculan al mostrar el cierre (con los datos ya juntados), no se guardan fijos;
  - el jefe sí lo ve.

## 4. 1.85 · Apartados (plan separe), sobre la cotización
- **Base:** reutilizar `cotizar` / `pasarAVenta` / `abonar` (`lib/vento-caja-mas.js`).
- **Reserva:** el apartado descuenta las unidades al crearse, con un movimiento de kárdex de id fijo.
- **Abonos:** son una lista, cada uno con su id, y entran como efectivo del turno.
- **Venta final:** al pagarse completo se vuelve venta con un id fijo («apt-<id>»), así no sale dos veces si dos equipos
  la terminan.
- **Vencimiento:** se vence a mano, nunca solo, para no devolver el stock dos veces.

## 5. Después, según lo que pidan los clientes
- **Domicilios con estados:**
  - hoy se guardan en un solo equipo (`localStorage`, no se sincronizan);
  - pasarlos a los datos del negocio y reutilizar los estados de los pedidos del QR.
- **Bonos y tarjetas regalo:**
  - el saldo en el servidor;
  - redimir sin repetir (bono + venta);
  - devolver el saldo al anular;
  - fuera de las ventas hasta que se usan.
- **Dólares para turismo, tarifas por temporada en hoteles, asistencia del personal y menú del día.**

## 6. Fuera de esta lista (cada uno con su propio plan)
- **Traslados entre sedes.** Cada sede es otra cuenta. Primero hay que decidir si ORDEVA maneja grupos de sedes.
- **Archivar las ventas viejas fuera del documento.** Hoy eso se tomaría como un borrado: hace falta «archivar» en el
  servidor, con una fecha de corte.
- **Empaquetar los archivos para 4G.** Antes hay que medir la carga real.

## 7. Preguntas para el dueño
1. **Número de factura entre equipos:** ¿del servidor (consecutivo único, necesita internet al vender) o con un prefijo
   por equipo (A-0001 / B-0001, funciona sin internet)?
2. **¿Qué tipos de negocio usan más ORDEVA hoy?** Decide si van primero las comisiones o los apartados.
3. **Apartados:** ¿se pagan solo en la tienda donde se hicieron, o también desde otro equipo o sede?
