# Vento 1.43.5 · La app se actualiza sola, sin instalar otra versión a mano

El dueño: «Haz que se actualice solo, no que toque instalar otra versión».

## Por qué seguía preguntando
Android deja que una app se actualice sola, sin preguntar, solo si **ella misma** instaló la versión que está puesta.
La Vento del dueño la había instalado el navegador. Desde la 1.43.2, «Actualizar ahora» abría el instalador de
Android, y con eso Android seguía preguntando en cada versión.

## Arreglo (app 1.0.48)
- **«Actualizar ahora» y la actualización automática usan el instalador de Vento.**
  - La primera vez Android pregunta **una sola vez** «¿Actualizar?», con un aviso «🔄 Vento tiene una actualización ·
    Toca aquí» si Vento no está abierta.
  - Desde ahí Vento queda como la que instala sus propias versiones, y **las siguientes se instalan solas**: sin
    preguntar, cuando no estés usando Vento (revisa cada 5 min). Vento se cierra un momento y vuelve sola.
- **Android 14 o más nuevo:** Vento además pide ser la dueña de sus actualizaciones (`setRequestUpdateOwnership`).
- **Si el instalador de Vento falla**, por ejemplo en algún Xiaomi, se abre el de Android («¿Actualizar esta app?») o
  queda el aviso para tocar. Nunca se queda sin actualizar.
- El aviso «Actualizar ahora» dice que es solo esta vez.

## Lo que necesita el dueño (una sola vez)
- Si Android pregunta «¿Actualizar?», tocar **Actualizar**. Después ya no vuelve a preguntar.
- En algunos Xiaomi, el sistema puede seguir pidiendo confirmar cada versión: es una regla de Xiaomi, no de Vento.
  Igual basta un toque en el aviso.

## Pruebas
- Compila todo el código Android (con `android-all`, Android 14).
