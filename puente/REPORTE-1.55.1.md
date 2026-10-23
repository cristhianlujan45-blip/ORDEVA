# Vento 1.55.1 · Los pagos que llegan a Nequi como «Recarga desde Bancolombia» ya avisan

## El problema (reportado por el dueño, con foto)
- En Nequi salió «✅ Recarga realizada · Recarga Bancolombia · Recarga desde Bancolombia · $9.000,00». Vento no avisó.
  Los demás pagos sí llegaban bien.
- Cuando alguien manda plata desde **Bancolombia a un Nequi**, Nequi la muestra como una **recarga**, no como «te
  envió».
- Las reglas que deciden si un aviso es «plata que llegó» no conocían esa forma.
  - La app de Android la descartaba («no dice que llegó plata»).
  - Ni siquiera se la pasaba a la página para que la revisara: no traía ninguna palabra de plata recibida.

## El arreglo (sin tocar lo que ya funcionaba)
- **Una regla nueva, la misma en los tres lugares que leen avisos:**
  - la app Android (`AvisoPago.RECARGA`);
  - la página (`PG_RECARGA` en `pgLeer`);
  - el servidor (`avisos.ts`, versión 1.23.1).
- **Qué cuenta como pago:** «recarga» o «recargaste» desde un banco (Bancolombia, Davivienda, BBVA, otro banco,
  PSE…), «Recibiste una recarga» o «Te recargaron», con su valor.
  - Se dice en voz alta: «Recibiste 9000 pesos por Nequi».
- **Nunca cuentan como pago:**
  - la recarga de un celular (celular, minutos, paquete o datos, un operador como Claro o Tigo, o un número);
  - una recarga fallida o pendiente;
  - lo que se compró;
  - la publicidad «Recarga tu Nequi…» (y la que dice «gana» o «participa»).
- **Si Nequi cambia el texto de la recarga,** la app Android igual se la pasa a la página («recarg» ya cuenta como
  palabra de plata), y la página se actualiza sin reinstalar.
- **Todas las demás reglas** (te envió, recibiste, Bre-B, DaviPlata, SMS, códigos, publicidad) quedan exactamente
  igual.

## Ojo
- **Si el dueño recarga su propio Nequi desde su Bancolombia,** también suena como pago, porque es plata que entra.
- **La app Android se actualiza sola:** sale «Hay una versión nueva de Vento → Actualizar ahora». Hasta actualizarla,
  ese celular sigue sin avisar las recargas.

## Pruebas
- **Java (`AvisoPagoPrueba`), 184:**
  - 8 avisos de recarga que sí son pago, incluido uno con «Mira el comprobante»;
  - 9 que no (celular, número, Claro, «Recarga tu Nequi», «participa», pendiente, fallida, minutos, datos).
- **`javaavisos`:** 224, todas las pruebas de Java, incluidas `VentoEscucha` y `Cruce`.
- **Servidor:**
  - `avisos`: 31, con 7b de recargas.
  - `daviplata`: 102, versión 1.23.1.
  - `pagosprivados`: 25.
- **Página:**
  - `pagosaviso`: 94, con 16b de recargas.
  - Siguen pasando: `avisosandroid` 15, `confirmapago` 61, `pagosequipos` 40, `pagosguia` 29, `pagosprivados` 12,
    `herramientas` 28 y `daviplatacobro` 28.
