# Vento 1.43.1 · La ventana del pago de Nequi sale como la de DaviPlata (también bloqueado)

El dueño: «De Nequi todavía no me llega la ventana emergente como DaviPlata… así esté bloqueado el celular. Dura 15
segundos».

## Por qué con DaviPlata sí y con Nequi no
El código que abre la ventana es el mismo para los dos bancos. La diferencia está en cuántas veces avisa cada uno:
- **DaviPlata avisa dos veces, con segundos de diferencia:** el aviso de la app («Recibiste plata…») y el SMS del 85888
  con el valor. Cada aviso intenta abrir la ventana, así que el segundo la abría aunque el primero fallara mientras el
  celular se despertaba.
- **Nequi avisa una sola vez.** Si ese único intento fallaba, la ventana no salía nunca.

Además, la pantalla se prendía después de intentar abrir la ventana. Con la pantalla apagada, varios celulares no dejan
abrir una pantalla.

Se revisó que Vento entiende los avisos reales de Nequi: «MARIBE ARIAS te envió 1500, ¡lo mejor!», «te envió
$1.500», «te envió 25.000», Bre-B, «Recibiste $20.000 de…» y otros 11 formatos. Todos dan el valor.

## Arreglo (solo la ventana, nada más cambia)
- **Primero se prende la pantalla y después se abre la ventana.**
- **Se comprueba que la ventana sí se vio.** Ahora cuenta cuando queda a la vista (`onResume`), no cuando se crea: una
  ventana creada detrás de la pantalla de bloqueo ya no cuenta como abierta.
- **Si no se vio, se vuelve a intentar a los 1,5 s y a los 4 s:**
  - con el celular bloqueado, como pantalla sobre la pantalla de bloqueo, prendiendo la pantalla;
  - usando otra app, encima de esa app.
  Así Nequi tiene tres intentos, uno más de los dos que tenía DaviPlata con sus dos avisos.
- No sale doble: si ya se vio, o si Vento está a la vista (ahí la muestra la página), no se reintenta.
- La ventana sigue durando 15 s, con «✕ Cerrar».
- El registro (Ajustes → Pagos y 🐞 Errores del panel) dice «🪟 ventana abierta (al intento 2)». Si después de los tres
  intentos no se vio, dice por qué: celular bloqueado o usando otra app, la marca, la versión de Android y el permiso
  que falta.

## Pruebas
- `PlanVentanaPrueba`: 23 comprobaciones (7 nuevas de reintentos).
  - No se vio y bloqueado → pantalla.
  - Usando otra app → encima o pantalla, según el permiso.
  - Ya se vio, Vento a la vista o ventana apagada → no se reintenta.
  - Máximo dos reintentos.
- `javaavisos`: 195 comprobaciones.
- Compila todo el código Android (con `android-all`).

## Lo que necesita el dueño
Nada: la app se actualiza sola (busca versión nueva cada 30 min, o con el aviso «Actualizar ahora»).
