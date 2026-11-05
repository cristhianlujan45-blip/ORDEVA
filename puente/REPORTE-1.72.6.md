# ORDEVA 1.72.6 · Los pagos vuelven a sonar con el celular bloqueado, y la carta de pedidos ya no se devuelve arriba

## Qué pidió el dueño
- «Nequi y DaviPlata ya no suenan con la pantalla bloqueada. Antes funcionaba. Que siempre funcione así se bloquee.»
- «El deslizamiento en pedidos: cuando bajo vuelve a subir y se carga.»

## Lo que mostraron los datos de producción (2-nov, diagnóstico de solo lectura)
- **«Android desconectó la lectura de avisos de pago»: 21 veces** (la última, hoy a las 8:32 a. m.).
- **«Pago avisado tarde»: 121 veces, hasta 1.244 s (20 min) tarde.** Con el celular bloqueado, Android dejaba de pasarle
  los avisos a ORDEVA y ORDEVA los leía al desbloquear.
- **El Samsung que leía los avisos no ha mandado ninguno desde el 31-oct a las 8:30 p. m.** Hay que revisar en ese celular
  el permiso «Acceso a notificaciones» de ORDEVA.
- **Cuando el aviso llega, el camino es rápido:** menos de 1 s del banco al celular y del celular al servidor.
- **Bold:** «BoldCF: Has recibido una transferencia a traves de llaves por valor de $…» (SMS 890412) no se tomaba.

## Causa y arreglos
| Problema | Causa | Arreglo |
|---|---|---|
| No suena bloqueado | En la 1.65.7 se cambió el servicio de fondo: pedir la reconexión cada 5 s, revisar el motor de voz cada 30 s y barrer la barra cada 2,5 s. La prueba que protege ese servicio (`javaavisos`) **no estaba en GitHub**, y nadie vio que se rompió. | El servicio de fondo vuelve a ser **exactamente el de la 1.55.3 / 1.57.1**, la que funcionaba bloqueada. `javaavisos` queda en GitHub. |
| Android corta la lectura de avisos | Android 16 la corta con el celular bloqueado. | **📩 SMS del banco directo** (`SmsBanco.java`), ver abajo. |
| Bold no se tomaba | «BoldCF» no contaba como Bold y el 890412 no era un código de banco. | «BoldCF» = Bold, y el 890412 confiable como el 85888 de DaviPlata. |
| No se sabía cuándo se corta | — | Cada vez que Android corta o vuelve a conectar la lectura queda en el diagnóstico, con si el celular estaba bloqueado o en uso. |

### 📩 SMS del banco directo
- Android le entrega cada SMS a ORDEVA en el instante en que llega, también bloqueado y aunque se haya cortado la lectura
  de avisos.
- Sirve para DaviPlata (85888), Bold (890412) y los bancos que avisan por SMS. **Nequi avisa por la app, no por SMS:**
  para Nequi sigue siendo la lectura de avisos.
- Solo mira códigos cortos de bancos; los SMS de personas ni se leen.
- Pasa por las mismas reglas de siempre: voz, notificación, ventana y servidor.
- El aviso del mismo SMS que llega después por la app de mensajes no vuelve a sonar. Dos SMS iguales de verdad cuentan como
  dos pagos.
- Necesita el permiso «SMS»: ORDEVA lo pide junto con los demás y muestra un aviso rojo si falta.

## Deslizamiento en pedidos (`pedido.html`)
- **Causa:** la app del negocio publica la carta cada vez que cambia algo (una venta mueve «lo más vendido» o un agotado).
  La página del cliente vaciaba y volvía a armar toda la carta, y lo mismo pasaba al volver a la página. La carta se
  devolvía arriba y las fotos se volvían a cargar.
- **Arreglo:**
  - Solo se vuelve a pintar si la carta o las fotos cambiaron, y el cliente sigue en el mismo punto.
  - Lo que cambia solo (orden, agotados) se publica como mucho una vez por minuto; un cambio de productos o precios sale
    ya.
- **Además:** la versión nueva de la app ya no recarga mientras se usa. Espera 2 minutos sin tocarla, o que quede de fondo.

## Pruebas
- **`javaavisos` 247 ✅** (antes 1 mal: la del servicio de fondo), ahora en GitHub. Incluye los casos de Bold.
- **`pedidodesliza` (nueva, 5 ✅).** Sin el arreglo falla igual que en el celular del dueño.
- **`autoactualiza` 11 ✅**, con el caso nuevo: deslizando no recarga.
- **Siguen bien:** `javaenvivo` 13, `avisosandroid` 15, `pagosaviso` 94, `alertaspagos` 13, `pagossuenan` 13, `pedidomusica`
  14, `qrprivado` 9, `cancionesmesa` 17, `canalvivo` 17, `seguridadqr` 6, `tipofijo` 16, `modulosnegocio` 33 y `modulos` 11.
- **La app Android compila** con el lector de SMS (GitHub).

## Qué hacer en los celulares
1. **Samsung y Xiaomi:** abrir ORDEVA y aceptar el permiso **SMS**.
2. **Samsung:** Ajustes → Notificaciones → Acceso a notificaciones → **ORDEVA prendido**. Batería → ORDEVA →
   **Sin restricciones**, y que no esté en «Aplicaciones en suspensión».
3. **Xiaomi:** ORDEVA con **Sin restricciones**, **Inicio automático** y **Mostrar ventanas emergentes**.

## Lo que no se pudo probar aquí
- **Celulares reales bloqueados.** El diagnóstico va a mostrar si Android sigue cortando la lectura y si los SMS llegan
  directo.
