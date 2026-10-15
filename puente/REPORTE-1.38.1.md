# Vento 1.38.1 — «Conectar mi cuenta de YouTube» ya conecta (sin «El enlace no sirvió»)

## El problema
- **Qué pasaba:**
  - Al tocar «Conectar mi cuenta de YouTube», Google devuelve a Vento con el permiso en la dirección
    (`#access_token=…&state=vento-yt.…`).
  - La parte de Vento que lee el **enlace del correo para recuperar la contraseña** también buscaba un `access_token` en
    la dirección. Se quedaba con el permiso de Google y lo borraba.
  - Mostraba **«📧 El enlace no sirvió — El enlace del correo ya se usó o venció»**, y la cuenta de YouTube nunca se
    conectaba.
- **Dónde:** pasaba en el navegador, por ejemplo Brave.

## El arreglo
- **La vuelta de Google para YouTube** (con `state=vento-yt.…`) ya no la toma el lector del enlace del correo, sino la
  conexión de YouTube.
  - Si entras: «🟢 Google conectado».
  - Si cancelas: «Google: access_denied».
- **Los enlaces del correo de verdad** (recuperar la contraseña) siguen funcionando igual.

## Pruebas
- **Nueva: `googlevuelta`**, 6 comprobaciones.
  - Con el código anterior reproduce el error: sale «El enlace no sirvió» y la cuenta no se conecta.
  - Con el arreglo la cuenta queda conectada, cancelar en Google avisa bien y el enlace del correo se sigue procesando.
- **También pasan:** `cuentacliente`, `cuentas`, `suscripnube`, `panelyoutube`, `ventanayoutube` y `googletest`.
