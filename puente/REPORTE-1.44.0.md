# Vento 1.44.0 · Cada pago de Nequi, DaviPlata y Bre-B llega a todos los equipos del negocio

El dueño: «Quiero que todas las notificaciones lleguen a todos los celulares que estén conectados en la cuenta como
administrador, también al computador o a una tablet, cada vez que pongan un Nequi o un DaviPlata. Acuérdate que
solamente el administrador puede ver lo del Nequi».

## Cómo viaja un pago
1. El celular que tiene Nequi o DaviPlata lee el aviso del banco.
2. Lo manda al Servidor Vento.
3. El servidor se lo pasa a los demás equipos que entraron con la cuenta del negocio: otros celulares, tablets y
   computadores.

Solo les sale y les suena al dueño y a los administradores. Un mesero solo ve el pago de la mesa que atiende o cobra,
como antes.

## Por qué no les llegaba a los demás equipos
- **El arreglo principal.** La lista de pagos del negocio se copia a todos los equipos. La tablet y el computador
  encontraban ahí el pago que había leído el celular y creían que ya lo habían avisado ellos. Por eso no sonaba ni
  salía la ventana.
  - Ahora cada equipo tiene su marca y solo se salta el aviso el equipo que de verdad leyó el pago.
- **Sin internet en ese momento, el aviso se perdía.** Pasaba también si el servidor no respondió cuando se abrió
  Vento.
  - Ahora queda en espera en el celular y se manda solo apenas vuelve la conexión, hasta 30 min.
- **El servidor no entendía algunos avisos**, como «$ 50 000» con espacios o «Movimiento recibido».
  - Ahora el celular le manda también lo que entendió: el valor, el banco y quién pagó.
  - El servidor lo usa cuando su propia lectura no alcanza.
  - Un SMS desde un número de celular sigue siendo **falso** siempre.
- **Con Vento de fondo o el celular bloqueado, los otros equipos se enteraban tarde.**
  - Ahora la app Android revisa los pagos de los demás equipos cada 10 s.
  - Si el canal en vivo se cayó porque Android lo cortó al dormir, pregunta al servidor cada 20 s.
  - Aunque el canal diga que está vivo, revisa cada minuto, por si quedó colgado.

## Cómo sale en cada equipo
- **Otro celular o tablet con la app:** igual que si lo hubiera leído él mismo.
  - La notificación de pagos con su sonido.
  - La 🪟 ventana con el valor, también con el celular bloqueado.
  - La voz: «Recibiste 300 pesos por Nequi».
- **Computador o tablet en el navegador:**
  - Con Vento abierta: la 🪟 ventana con el valor, «Pago confirmado» y la voz.
  - Con Vento de fondo: la notificación del navegador.
  - Con el navegador cerrado: llega si se tocó «🔔 Activar avisos aunque Vento esté cerrada» en Ajustes → Pagos.
- **El celular que leyó el aviso** no lo repite: ni otra ventana ni otra voz.
- Un aviso «⚠️ por revisar» también se dice en voz alta en los demás equipos: «Revísalo en la aplicación del banco antes
  de entregar».

## Servidor Vento 1.19.0
`/aviso` acepta lo que entendió la app (`pista`: valor, banco, quién y nivel). MacroDroid y los avisos de antes siguen igual. Un servidor viejo ignora la `pista`: no se rompe nada si la página se actualiza primero.
Se publica solo con esta versión.

## Pruebas
- **`pagosequipos` (nueva, 21):** de punta a punta, con PostgreSQL real, el Servidor Vento y la app de verdad en tres
  equipos del mismo negocio: celular con la app, tablet con la app y computador.
  - El aviso real de la llave Bre-B de Nequi le llega a la tablet con ventana, valor y voz en menos de 30 s, con Vento
    de fondo.
  - Al computador le llega con la ventana.
  - El celular que lo leyó no lo repite.
  - Sin internet queda en espera y llega al volver.
  - «$ 50 000» con lo que entendió la app.
- **`avisos` del servidor:** 27, con 4 nuevas sobre lo que entendió la app.
- **Repetidas y bien:** `pagosaviso` 92, `avisosandroid`, `pagosguia`, `daviplatacobro`, `canalvivo`, `puertaytiemporeal`,
  `sincroniza`, `erroresreal`, `servidor` 101, `equipoactividad`, `parlante`.
- Suite completa.

## Lo que necesita el dueño
- Que cada equipo entre a Vento con la cuenta del negocio: el mismo correo, o como administrador.
- En el computador, para que avise aunque el navegador esté cerrado: Ajustes → Pagos → «🔔 Activar avisos aunque Vento
  esté cerrada».
- No hay que instalar otra app: sirve la misma app 1.0.52, porque el cambio está en la página y en el servidor, que se actualizan solos.
