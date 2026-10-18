# Vento 1.45.0 · Confirmación de pagos: «Esperando el pago», la mesa correcta y el cuadre del día

El dueño: «Haz todas las mejoras» (de la confirmación de pagos de Nequi, DaviPlata y Bre-B).

## 1. ⏳ «Esperando el pago», como un datáfono
- En la cuenta de la mesa sale **«⏳ Esperando pago por Nequi / DaviPlata»**. También sale en «🎤 Cuenta de…», la que se
  le muestra al cliente.
- Al tocarlo sale el valor en grande con la mesa y un reloj. Se le puede mostrar al cliente.
- **Cuando llega la plata, la pantalla se pone verde:** «✅ PAGADO $45.000 · Nequi · de Ana Ruiz · Quedó al día», con
  sonido.
  - Se registra sola en esa cuenta.
  - No sale ninguna ventana encima.
- **«↩ Deshacer»**: si no era de esa cuenta, se quita y el pago queda en «💜 Pagos» para registrarlo en la que es.
- **Abono:** si pagan una parte, dice «Abono. Falta $20.000» y con «⏳ Esperar lo que falta» sigue esperando. Muestra
  «Ya llegó: $25.000».
- **Propina:** si pagan un poco de más, queda al día y dice «$2.000 de más (propina)».
- **Si llega por SMS**, dice «⚠️ Llegó por SMS · míralo en la app». Con «✅ Lo vi en la app» queda pagado.
- **Si el SMS es falso**, la pantalla se pone roja: «🚨 Mensaje de pago FALSO · No entregues nada».
- **Si el pago llegó un momento antes de abrir la pantalla**, se toma de una.
- **Entre equipos:** si la pantalla está abierta en el computador y el celular lee el pago, se registra en el computador.
  El celular y la tablet no abren «Llegó un pago» para esa mesa, y queda registrado una sola vez.

## 2. La mesa correcta
Antes se buscaba solo la mesa que debía **exactamente** ese valor. Con dos mesas iguales se escogía una a ciegas.

Ahora el orden es:
1. La mesa que está «⏳ Esperando el pago».
2. La que avisó «ya pagué» o se está cobrando.
3. El valor exacto.

Un abono o una propina solo se suman a la mesa que espera el pago o se está cobrando. Nunca se suman si otra mesa debe
justo ese valor.

**Con un empate**, «💜 Llegó un pago» pregunta **«¿De cuál cuenta es?»** con un botón por cada mesa, por ejemplo «Mesa 2 ·
debe $20.000».

## 3. Aviso sin el valor (llave Bre-B de DaviPlata)
- **Con «Esperando el pago» abierta:** «💜 Llegó plata por DaviPlata · ¿llegó $15.000?» → «✅ Sí, llegó $15.000».
- **Sin la pantalla:** Vento espera 20 s, porque casi siempre el SMS con el valor llega enseguida y se registra solo.
  - Si no llega, salen las mesas para tocar la que pagó, de primero la que se estaba cobrando.
  - También se puede escribir otro valor.
- Queda marcado «✍️ puesto a mano».
- **Si después llega el valor**, se junta solo con el de a mano y no se cuenta dos veces.

## 4. Mesero, empleado y cajero: «✅ Mesa 3 ya pagó»
Solo el administrador ve lo de Nequi. Al mesero solo le sale y le suena:
- «✅ Mesa 3 ya pagó» (o «hizo un abono»), sin el valor ni quién pagó.
- «⚠️ pago por revisar».
- «🚨 el pago parece FALSO, no entregues nada».

Así no deja ir a nadie con un pantallazo falso.

## 5. Cuadre en «📊 Caja de hoy»
Solo para el dueño y los administradores. Muestra:
- **Llegó confirmado:** cuánto y cuántos pagos.
- **Registrado en cuentas.**
- **⚠️ Sin registrar:** cada pago con «Registrar», que abre «Llegó un pago» para elegir la cuenta.
- **⚠️ Por revisar:** cada uno con «✅ Lo vi en la app».
- **🚨 Falsos detectados.**

## 6. El mismo pago por SMS y por la app → uno solo
Antes solo pasaba con DaviPlata. Ahora vale para todos los bancos, y también entre equipos:
- **Si llega primero el SMS** («⚠️ Revisar»), el aviso de la app lo confirma solo y queda uno.
- **Si el SMS llega después de la app**, no deja otro «⚠️ Revisar».
- **Se juntan uno con uno** en 5 min: dos pagos iguales siguen siendo dos.

## Lo que no cambió
El modo de mesas, la caja POS, «Llegó un pago», las notificaciones, la ventana de 15 s y la voz siguen igual. Esto es
otro archivo (`lib/vento-confirma.js`) con ganchos pequeños.

## Pruebas
- **`confirmapago` (nueva):** 61 comprobaciones en celular y en tablet Android: esperando el pago, mesa correcta, aviso
  sin valor, SMS y app, cuadre.
- **`pagosequipos`:** 27, con 6 nuevas. El computador espera el pago, el celular lo lee, la pantalla se pone verde y
  queda registrado una sola vez en todos los equipos.
- **`pagosaviso`:** 92. La prueba del mesero ahora exige «ya pagó» sin el valor.
- Suite completa: todas bien menos `appoweb` (conectar YouTube), que se cae igual desde antes en el navegador de prueba (enlace `intent://`). No tiene que ver con los pagos.

## Lo que necesita el dueño
Nada. La página se actualiza sola y sirve con la misma app 1.0.52.
