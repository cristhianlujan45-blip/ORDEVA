# ORDEVA 1.57.1 · arreglo urgente: los pagos vuelven a llegar al instante con el celular bloqueado

## Qué pasaba
- Desde la 1.55.4, con el celular **bloqueado o la pantalla apagada**, los pagos de Nequi, DaviPlata y bancos llegaban
  tarde, casi siempre **al desbloquear**. Con la pantalla prendida llegaban bien.
- Por lo mismo llegaban tarde al **computador** y a los demás equipos: el aviso sale del celular que lee la notificación.

## Por qué
- **Antes de la 1.55.4:** el servicio de fondo de la app revisaba cada minuto si Android le seguía pasando los avisos de
  los bancos. Solo a los 2 minutos sin conexión apagaba y prendía la lectura.
- **En la 1.55.4:** pasó a revisar cada 10 s y a apagarla y prenderla a los 30 s.
- **El problema:** con el celular bloqueado, muchos Android no vuelven a conectar la lectura hasta desbloquear. Así que la
  app la cortaba una y otra vez, y los pagos quedaban en la barra hasta desbloquear.

## Qué cambia
- **El servicio de fondo vuelve a ser exactamente el de la 1.55.3**, el que funcionaba bien: revisa cada minuto,
  reinicia la lectura solo a los 2 minutos y revisa la barra cada 10 s. Es el único cambio de código de la app Android.
- **Una prueba nueva** impide que esa revisión se vuelva a poner agresiva sin que se note.
- **Recarga desde Bancolombia** a Nequi (la de la foto, «Recarga desde Bancolombia $71.800,00»):
  - ya se tomaba como plata recibida, con el valor correcto ($71.800, sin los centavos);
  - quedan dos casos más en las pruebas con ese texto exacto;
  - llegaba tarde por la misma razón del celular bloqueado.

## Pruebas
- **Java:** 284 comprobaciones, incluidas la lectura completa de avisos y SMS reales y los pagos entre equipos desde
  Android.
- **App:**
  - `pagosaviso` 94;
  - `avisosandroid` 15;
  - `pagosequipos` 40;
  - `confirmapago` 61;
  - `alertaspagos` 13.
- **No probado aquí:** el celular real bloqueado. Se instala sola la versión nueva de la app (o se descarga vento.apk);
  luego, la prueba 4 de `puente/PRUEBA-FISICA-PAGOS.md`.
