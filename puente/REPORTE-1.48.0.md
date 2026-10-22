# Vento 1.48.0 · Los pagos les llegan a todos los equipos, también bloqueados, con voz (que se puede apagar) y chequeo

El dueño pidió tres cosas:
- «No me está llegando la notificación a todos los dispositivos de la misma cuenta. Los pagos de Nequi y Bre-B ya no
  suenan, se demoran, y con la pantalla bloqueada no suenan. Haz un chequeo y varias pruebas hasta que quede
  solucionado».
- «Que la voz hable siempre que llegue un aviso, pero con la opción de desactivarla. Si primero llega el aviso de Bre-B y
  después el valor, que avise los dos».
- «Que el modo fácil se ajuste a todos los dispositivos».

## 1. Por qué no les llegaban (o les llegaban tarde) a los otros equipos
- **Todo dependía de la página de Vento.** Con el celular bloqueado, Android duerme la página.
  - El celular que leía el aviso de Nequi lo mandaba al servidor solo cuando la página despertaba.
  - Los otros celulares se enteraban solo cuando su página despertaba.
  - Con el celular bloqueado, eso podía ser tarde o nunca.
- **Un celular «retirado» en «📱 Celulares autorizados»**, o con el token perdido, seguía mandando sus avisos con el token
  viejo. El servidor los rechazaba sin decir nada y los demás nunca se enteraban.

## 2. Arreglo (app Android nueva + servidor)
- **El aviso de este celular sale de una desde Android.**
  - Apenas Vento lee el aviso de Nequi, DaviPlata o Bre-B, lo manda al Servidor Vento desde Android, sin esperar a la
    página. Lleva lo que entendió: valor y banco.
  - La página lo sigue mandando también, con el mismo número de aviso. El servidor lo cuenta una sola vez.
  - Si no hay internet, lo intenta 3 veces.
- **Los pagos de los otros equipos los pregunta Android cada 10 s**, desde el servicio de fondo, también con el celular
  bloqueado y la página dormida. Cuando llega uno:
  - suena como si lo hubiera leído ese celular: notificación de pagos, 🪟 ventana con el valor y la voz «Recibiste
    20000 pesos por Nequi, de Ana Ruiz»;
  - solo en los equipos del dueño y de los administradores;
  - nunca en el celular que leyó el aviso, porque ahí ya sonó;
  - nunca dos veces: Android y la página se avisan entre ellos cuál ya lo dijo.
  - Un pago de hace más de 15 min no se anuncia, para no sonar de golpe pagos viejos al prender el celular.
- **Celular retirado o con el token perdido:** mientras siga con la sesión del negocio se vuelve a autorizar solo, y el
  aviso se manda otra vez.
- **Servidor:** nueva consulta `pagos_dispositivo`, en la migración `20261030000000_pagos_dispositivo.sql`.
  - Entra con el token del celular y solo ve los pagos de su negocio.
  - Cada pregunta deja el equipo «visto hace X s».

## 3. 🩺 Chequeo: «¿Les llegan los pagos a todos los equipos?»
Está en Ajustes → Pagos → «🩺 Revisar». En **este equipo** revisa:
- **Lectura de avisos:** si lee los avisos de Nequi, DaviPlata y Bre-B, y si no, por qué (permiso, apagado o Android lo
  desconectó).
- **Voz:** si está prendida o apagada, con «▶ Probar la voz».
- **Servidor Vento.**
- **Si el equipo está autorizado**, con «📱 Autorizar este equipo» si hace falta.
- **Avisos que esperan internet.**
- **Pagos de los otros equipos:** cuándo preguntó Android por última vez.

Además muestra **cada equipo de la cuenta**:
- 🟢 «escuchando (hace 8 s)».
- 🟡 «puede estar dormido».
- 🔴 «cerrado: no le sonará hasta abrir Vento».

Así se ve de una cuál equipo no va a sonar.

## 4. 🗣️ Voz de los pagos: siempre, o apagada
- **Ajustes → Pagos → «🗣️ Decir los pagos en voz alta»**, prendido de fábrica.
  - **Prendido:** cada pago se dice en este equipo y en los demás, también bloqueados.
  - **Apagado:** llegan con su notificación y su ventana, sin voz.
  - Vale para la app Android y el navegador.
  - «▶ Probar la voz» suena siempre, aunque esté apagada.
- **Bre-B sin el valor y después el valor:** se dicen los dos.
  - Primero «Llegó plata por Bre-B, en DaviPlata».
  - Cuando llega el valor, «Recibiste 65000 pesos por Bre-B, en DaviPlata».

## 5. 🧓 Modo fácil en todas las pantallas
Se revisó en 8 tamaños: celulares de 320, 360, 390 y 412 px, celular acostado, tablet vertical, tablet acostada y
computador. Se revisaron las pantallas de mesas, vender, hoy y más.
- **Celular pequeño (320–380 px):** el nombre del negocio y la fecha quedaban tapados por «🙋 Ayúdame». Ahora el botón es
  un poco más pequeño y todo se lee.
- **Celular acostado:**
  - Al vender, la cuenta tapaba los productos y había que bajar para verlos. Ahora los productos quedan **al lado** de
    la cuenta, como en la tablet.
  - La barra de arriba y la de abajo son más bajitas.
  - «Hoy» sale en dos columnas.
- En ninguna pantalla se sale nada por los lados, la barra de abajo se ve completa y ningún botón es más chico que un dedo.

## Pruebas
- **`pagosequipos`:** 38 comprobaciones, 11 nuevas, de punta a punta con PostgreSQL real, el Servidor Vento y la app de
  verdad en celular, tablet y computador.
  - La página le pasa a Android el token.
  - Con el token, sin sesión, Android ve los pagos y de cuál celular vino cada uno. Un token falso no ve nada. La tablet
    queda «vista».
  - Si Android ya lo anunció, la página no lo repite.
  - Celular retirado: se vuelve a autorizar solo, el aviso llega y Android queda con el token nuevo.
  - Voz apagada: llega sin voz.
  - El chequeo muestra los 3 equipos «escuchando».
- **`javaavisos`:** 251, con `CrucePrueba` nueva contra un servidor HTTP de mentira:
  - La primera vez no anuncia lo viejo.
  - El pago de otro equipo suena una sola vez, con notificación y ventana.
  - Ni el pago propio, ni uno viejo, ni uno ya avisado por la página, ni en el celular de un mesero.
  - «Revisar» y «falso» con su aviso.
  - Celular retirado.
  - El reenvío con el mismo número de aviso y el valor entendido, sin mandar los avisos sin valor.
  - Al cerrar sesión deja de preguntar.
- **`facilpantallas` (nueva):** 28, en los 8 tamaños.
- **Repetidas y bien:** `facil`, `modos`, `cajapos`, `guia`, `pagosaviso`, `confirmapago`, `avisosandroid` y `equipos`.
- Compila todo el código Android (con `android-all`, Android 14).
- Suite completa: 77 de 77 bien.

## Lo que necesita el dueño
- **La app Android nueva:** se instala sola, con «Actualizar ahora» en la 🔔 campanita.
- **En cada celular:** Vento sin ahorro de batería («Sin restricciones»). Así el servicio de fondo pregunta cada 10 s
  también bloqueado.
- **Si un equipo sale 🔴 en el chequeo:** abrir Vento en ese equipo con la cuenta del negocio.
