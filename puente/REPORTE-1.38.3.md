# Vento 1.38.3 — «Ya no me llega nada y me dice que instale la app»: la app y Vento Web ya no se confunden, y la app lee los SMS del banco

## Qué pasaba
- **Había dos «Vento» en el celular, con el mismo nombre y el mismo ícono:**
  - la **app Vento** (la que se instala con el APK), que lee los avisos de DaviPlata y Nequi y dice «Pago confirmado»
    aunque esté minimizada;
  - **Vento Web**, la página instalada desde el navegador como acceso directo. Se ve igual, pantalla completa y sin barra
    de direcciones, pero **Android no le deja leer los avisos de otras apps**.
- **En Vento Web:**
  - no llegaban los pagos ni se pedía el permiso;
  - el paso a paso decía **«Falta instalarla»** aunque la app ya estaba instalada.
- **Cómo se terminaba en Vento Web sin darse cuenta:** al tocar «Conectar mi cuenta de YouTube» en la app, Google se
  abre en el navegador (Google no deja entrar dentro de las apps). Al terminar, Google devolvía a **Vento en el
  navegador**, no a la app, y de ahí en adelante se seguía usando la web.

## Qué cambió
- **El acceso directo de la web ahora se llama «Vento Web».** La app sigue siendo «Vento». El nombre del acceso directo
  se actualiza solo en unos días; también se puede borrar el de «Vento Web» y dejar solo la app.
- **En Vento Web en un Android, Vento lo dice claro:**
  - el paso a paso dice **«Estás en Vento Web»** y tiene el botón **«📲 Abrir la app Vento»** (si la app no está
    instalada, la descarga);
  - Ajustes → 💜 Pagos muestra el mismo aviso con el mismo botón;
  - al abrir Vento Web con los pagos prendidos, sale una vez: «Estás en Vento Web: aquí no se leen los avisos de
    DaviPlata y Nequi…».
- **«Conectar mi cuenta de YouTube» desde la app vuelve a la app:** Google termina en el navegador, que muestra
  «✅ Google listo · 📲 Volver a la app Vento» y lleva la conexión a la app, donde queda conectada. Vento Web ya no la
  toma como suya.
- **Si la app abre sin su conexión con Android** (raro), el paso a paso dice que la cierres del todo y la abras otra
  vez, y se reporta solo a Vento Admin → 🐞 Errores.
- **App Android:** si el celular no deja saber de dónde se instaló la app del banco, el pago se confirma como antes.
  Solo queda «⚠️ Revisar» cuando se sabe que esa app se instaló por fuera de la tienda. Así ningún pago real de
  DaviPlata o Nequi queda como «Revisar» por error.

## La app también lee los SMS del banco (nuevo)
- **Antes:** la app solo leía los avisos de las **apps** de DaviPlata, Nequi y los bancos. Si el banco avisaba por
  **mensaje de texto (SMS)**, no llegaba nada.
- **Ahora** lee el aviso que muestra la app de mensajes (Mensajes de Google, Samsung, Xiaomi…), con el **mismo permiso
  «Acceso a notificaciones»**. No hay que dar otro permiso y no lee la bandeja de SMS.
- **Solo toma** los SMS de **plata recibida que nombran un banco o billetera** con un valor. Los mensajes personales,
  los códigos y las claves no se leen.
- **Seguridad** (un SMS lo puede mandar cualquiera):
  - **desde un número de celular** → 🚨 **FALSO**, y Vento lo dice: «Ojo… parece falso. No entregues nada»;
  - **desde el número corto del banco** (o el contacto «DaviPlata») → dice **«Llegó un mensaje de texto de 200 pesos
    desde DaviPlata. Revísalo en la app del banco»** y queda «⚠️ Revisar» con el botón «✅ Lo vi en la app».
- **Si quieres que esos SMS digan «Pago confirmado»:** Ajustes → 💜 Pagos → **«📩 Confirmar también los SMS del
  banco»**. Viene apagado. Prendido, el SMS del número corto del banco dice «Pago confirmado. 200 pesos desde DaviPlata,
  por mensaje de texto». Los de un número de celular siguen siendo FALSO.
- **El mismo pago por SMS y por la app** (algunos bancos avisan por los dos lados) **cuenta una sola vez**. Si llega
  primero el SMS y luego el aviso de la app, queda confirmado.

## «🔎 Este equipo» en el paso a paso
- Al final del paso a paso dice dónde estás: «App Vento para Android 1.0.x», «Vento Web instalada (acceso directo de
  Brave) · Android», «Vento Web en Chrome»…
- Así, con un pantallazo se sabe enseguida si estás en la app o en la web, y si la app es vieja.

## Qué hacer en el celular
1. Instala la app nueva (vento.apk) encima de la que tienes.
2. Abre **la app «Vento»**, no «Vento Web». Si no sabes cuál es, entra a Vento Web → Ajustes → 💜 Pagos → «📲 Abrir la
   app Vento».
3. En la app: Ajustes → 💜 Pagos → «Recibir avisos de pagos». Si pide el permiso «Acceso a notificaciones», actívalo
   para Vento. Ese mismo permiso sirve para los SMS del banco.
4. «▶ Probar la voz» y luego un pago de prueba de $1.000.

## Pruebas
- **`AvisoPagoPrueba` (Java):** 57 comprobaciones, con las del SMS: apps de mensajes, SMS de pago o personal, celular o
  número corto, y las frases.
- **`pagosaviso`:** 34 comprobaciones, con las del SMS: «Revisar», confirmado si se eligió, FALSO desde celular, el
  mismo pago por SMS y por la app cuenta uno, el interruptor y «🔎 Este equipo».
- **Nueva: `appoweb`**, 18 comprobaciones, estable al correrla 3 veces seguidas:
  - Vento Web en Android (paso a paso, botón, Ajustes y aviso al entrar);
  - la app («Ya estás en la app»);
  - la app sin conexión con Android;
  - YouTube desde la app vuelve a la app, con código o con token, y queda conectado;
  - el nombre «Vento Web».
- **Siguen pasando:** `avisosandroid`, `pagosaviso`, `pagosguia`, `daviplatacobro`, `canalvivo`, `guia`, `googletest`,
  `googlevuelta`, `panelyoutube`, `ventanayoutube` y `youtubesincupo`.
