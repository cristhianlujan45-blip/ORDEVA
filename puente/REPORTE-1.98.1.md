# ORDEVA 1.98.1 · 💸 Una cobranza no es plata que llegó, y más formas de leer lo que el dueño paga

**Pedido del dueño (con pantallazo):** un SMS de cobranza del 87068 sonó como si hubiera entrado plata; los pagos que hace
por Nequi y DaviPlata no quedan como salida en la contabilidad; y los avisos se demoran si no desbloquea el celular.

## 1. La cobranza que sonó como pago
- **El mensaje:** «Liquitty/PRA: AMPARO, su obligacion con OCCIDENTE registra una deuda de $ 9.265.137… medidas cautelares
  sobre sus ingresos, incluida la posibilidad de embargo salarial…».
- **Por qué pasó:** la regla tomaba «ingresos» como «ingresó plata», «OCCIDENTE» como el banco, y había un valor.
- **Arreglo, en el celular (app Android) y en la página:**
  - una cobranza o una deuda nunca es plata que llegó: «deuda», «obligación», «mora», «proceso judicial», «embargo»,
    «medidas cautelares», «cobranza», «ponte al día», «acuerdo de pago», «centrales de riesgo», «cuota vencida»,
    «contáctenos»;
  - «ingresos» ya no cuenta como «ingresó».
- En el registro de Ajustes → Pagos esos mensajes quedan como «cobranza o deuda (no es plata que llegó)».

## 2. Lo que el dueño paga por Nequi y DaviPlata
- **Cómo funciona (desde la 1.66.5):** la app Android lee el aviso de plata que sale y lo deja en Contabilidad. Solo en el
  celular del dueño o del administrador, con la app Android y la lectura de pagos prendida.
- **Lo que se amplió:** además de «Enviaste», «Pagaste», «Pasaste», «Compra exitosa» y los retiros, ahora también «Envío
  exitoso», «Pago exitoso», «Transferencia exitosa», «Transacción exitosa», «Hiciste un pago», «Tu envío de $… a … fue
  exitoso».
- **Lo que no se sabe todavía:** no tengo el texto exacto del aviso que le llega al dueño cuando paga. Si después de
  actualizar la app Android sigue sin anotarse, hace falta un pantallazo de ese aviso.

## 3. Avisos con el celular bloqueado
- **No se cambió nada en esta versión.** La app ya tiene: servicio en primer plano, lectura directa de los SMS del banco,
  reconexión de la lectura de avisos y el permiso de batería sin restricciones.
- **Sin datos del celular no se puede saber qué lo frena.** Hace falta el diagnóstico de Ajustes → Pagos de ese celular.

## Para que llegue al celular
- **La página** se actualiza sola.
- **La app Android** hay que actualizarla: las reglas del celular viven en la app.

## Pruebas
- Reglas de la app Android (`javaavisos`): 276 bien, 0 mal. Incluye los dos SMS del pantallazo, otras dos cobranzas, pagos
  de verdad que siguen entrando y las formas nuevas de salida.
- Página: `pagosaviso` 95 bien, 0 mal; `salidas` 27 bien, 0 mal.
- **Lista completa:** 131 pruebas en el navegador, 2.916 bien, 0 mal, sobre la versión final.
- **No se probó** en un celular de verdad.

## 1.98.2 · Corrección de la 1.98.1 (el mismo día)
- **Qué pasaba:** la regla contra cobranzas vetaba siempre. Un pago de verdad con una de esas palabras se habría callado:
  «JUAN MORA te envió $20.000» (por «mora»), o un aviso con «contáctanos» o «sin embargo».
- **Quién lo encontró:** la auditoría general (`puente/egm/AUDITORIA-1.98-GENERAL.md`), después de publicar.
- **Arreglo:** la cobranza solo veta si el aviso no trae una frase fuerte de pago recibido. Los dos SMS del pantallazo
  siguen bloqueados. «Pagaste $… de tu obligación» vuelve a contar como salida.
- **Pruebas:** reglas de la app Android 281 bien, 0 mal; página: `pagosaviso` 95, `pagosguia` 29, `salidas` 27,
  `confirmapago` 61, `alertaspagos` 13, `modulos` 12, todas sin fallas. **La lista completa no se volvió a correr.**
