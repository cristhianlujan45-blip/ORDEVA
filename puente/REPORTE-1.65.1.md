# ORDEVA 1.65.1 · Con el celular bloqueado no llegaban pedidos ni pagos

## Qué pasaba
Con el celular bloqueado no llegaban las notificaciones de pagos ni de pedidos, en los dos celulares del negocio:
- Samsung A34 (SM-A346M), Android 16;
- Xiaomi (24090RA29G), Android 16.

## Lo que muestran los datos del servidor
Diagnóstico de solo lectura del 25 y el 26 de octubre (`diagnostico-pagos.yml`):

- **Los pagos sí llegan al servidor:** 162 en 7 días. Ningún equipo está callado («suena» en todos).
- **Los avisos del banco se leen todos juntos al desbloquear.** Pasó el 25/10 a las 10:24 y a las 13:44, y el 26/10 a
  las 07:47. Mientras el celular estaba bloqueado, los avisos se quedaban en la barra.
- **«Android cerró la página de ORDEVA por falta de memoria»** en los dos celulares, a las mismas horas de esas
  tandas: 24/10 19:57 (Xiaomi), 25/10 10:24 y 26/10 07:48 (Samsung). Android solo le entrega ese aviso a la app cuando
  se descongela, o sea al desbloquear.
- **«Android desconectó la lectura de avisos de pago»**: 7 veces, solo desde el 25/10.
- **El Xiaomi se reinstaló el 23/10 a las 22:46:** se registró como equipo nuevo. Al día siguiente:
  - faltaba el permiso «Acceso a notificaciones»;
  - faltaba el permiso «encima de otras apps».

  Al reinstalar, Xiaomi vuelve a poner sus ajustes de fábrica (inicio automático, ahorro de batería, pantalla de
  bloqueo).

**Conclusión:** con el celular bloqueado, Android **congela** ORDEVA. Una app congelada no lee los avisos del banco, no
pregunta por los pedidos y no oye los pagos de los otros equipos. Android no congela una app que tiene su **trabajo de
fondo** prendido (el aviso fijo «ORDEVA está trabajando») y que está **sin ahorro de batería**. Así que en estos
celulares falla al menos una de las dos.

La 1.65.0 (celular como lector) no es la causa: no está publicada, y el código de la app Android que lee los avisos es
el mismo de la 1.57.1.

## Qué cambia (página, sin instalar otra app)
Cada vez que se abre ORDEVA o se vuelve a ella (`app/12-fotos-productos-fondo.js`, `revisarFondoApp`):

- **Trabajo de fondo apagado sin querer:** se prende solo.
  - Pasa, por ejemplo, con «Detener» en el aviso fijo o después de reinstalar.
  - Sale el aviso «🔋 ORDEVA vuelve a trabajar de fondo…».
  - Si el dueño lo apagó a propósito en Ajustes, se respeta.
- **ORDEVA con ahorro de batería:** sale «Para que te lleguen los avisos con el celular bloqueado».
  - El botón **Arreglar** abre el ajuste para elegir «Sin restricciones».
  - El aviso se repite cada 6 h mientras siga así.
- **Las dos cosas quedan en 🐞 Errores del panel.** Así la próxima vez se ve de una cuál falla en cada celular.

## Lo que hay que hacer en cada celular (una vez)
1. **Abrir ORDEVA:** si sale «Arreglar», tocarlo y elegir **Sin restricciones**.
2. **Revisar el aviso fijo:** en la barra de notificaciones tiene que estar «ORDEVA está trabajando». Si no está:
   Ajustes → «Trabajar de fondo» prendido.
3. **Xiaomi:** Ajustes → Apps → ORDEVA:
   - **Inicio automático:** prendido;
   - **Ahorro de batería:** Sin restricciones;
   - **Otros permisos:** «Mostrar en pantalla de bloqueo», «Iniciar en segundo plano» y «Ventanas emergentes».
   - En recientes, dejar presionada ORDEVA → **🔒 Bloquear**.
4. **Samsung:** Ajustes → Batería → Límites de uso en segundo plano → quitar ORDEVA de «Apps en suspensión» y de
   «Apps en suspensión profunda». En Apps → ORDEVA → Batería: **Sin restricciones**.
5. **Probar:** bloquear el celular, pedir que manden $1.000 por Nequi y ver que suene sin desbloquear.

## Pruebas
- `pruebas/fondoapp.test.js` (7 ✅), con la app Android simulada:
  - el trabajo de fondo apagado se prende solo, con su aviso y su reporte;
  - apagado a propósito, se respeta;
  - con ahorro de batería, sale el aviso y «Arreglar» abre el ajuste.
- **Siguen bien:** hola, facil, abririnstante, cajapos, avisosandroid, holaapk, appoweb, alertaspagos y lectorcel.
- **No se pudieron correr aquí** `pagossuenan` y `entrar`, porque necesitan el PostgreSQL local. Fallan igual sin estos
  cambios.

## Lo que no se pudo probar
- **El celular real bloqueado.** Después de esta versión, el diagnóstico dirá en 🐞 Errores si en cada celular era el
  trabajo de fondo apagado, el ahorro de batería o ninguno de los dos.
- **Si no es ninguno de los dos:** el siguiente paso es la app Android, que guardaría la hora de cada aviso del banco
  contra la hora en que ORDEVA lo leyó.
