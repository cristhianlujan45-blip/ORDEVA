# Vento 1.38.3 — «Ya no me llega nada y me dice que instale la app»: la app y Vento Web ya no se confunden

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

## Qué hacer en el celular
1. Instala la app nueva (vento.apk) encima de la que tienes.
2. Abre **la app «Vento»**, no «Vento Web». Si no sabes cuál es, entra a Vento Web → Ajustes → 💜 Pagos → «📲 Abrir la
   app Vento».
3. En la app: Ajustes → 💜 Pagos → «Recibir avisos de pagos». Si pide el permiso «Acceso a notificaciones», actívalo
   para Vento.
4. «▶ Probar la voz» y luego un pago de prueba de $1.000.

## Pruebas
- **Nueva: `appoweb`**, 18 comprobaciones:
  - Vento Web en Android (paso a paso, botón, Ajustes y aviso al entrar);
  - la app («Ya estás en la app»);
  - la app sin conexión con Android;
  - YouTube desde la app vuelve a la app, con código o con token, y queda conectado;
  - el nombre «Vento Web».
- **Siguen pasando:** `avisosandroid`, `pagosaviso`, `pagosguia`, `daviplatacobro`, `canalvivo`, `guia`, `googletest`,
  `googlevuelta`, `panelyoutube`, `ventanayoutube` y `youtubesincupo`.
