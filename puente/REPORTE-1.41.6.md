# Vento 1.41.6 · La ventana del pago tapa la pantalla de bloqueo

El dueño: «No me salió la ventana emergente con la cantidad cuando entró un Nequi».

## Por qué
La ventana del celular bloqueado (`PagoActivity`) era **semitransparente**. En Android 10 en adelante, una ventana
semitransparente NO tapa la pantalla de bloqueo: se abría DETRÁS del bloqueo y no se veía. Así funcionan las ventanas de
las alarmas y las llamadas: tienen que ser opacas.

## Arreglo
- La ventana con el celular bloqueado es **opaca**: fondo oscuro de pantalla completa con la tarjeta del pago en el
  centro (valor grande, banco, texto, «✕ Cerrar», se cierra sola a los 15 s). Así tapa la pantalla de bloqueo en todos
  los celulares. Usando otra app sigue saliendo encima de esa app.
- **🪟 Registro de cada ventana:** a los 3 s se revisa si de verdad se abrió.
  - En Ajustes → 💜 Pagos → «📋 Últimos avisos…» sale «🪟 ventana abierta» o «🪟 la ventana no se abrió (celular
    bloqueado / usando otra app, marca, Android, permiso que falta)».
  - Si no se abrió, le llega al administrador a 🐞 Errores: se sabe en qué celular falla y por qué, sin pedir
    pantallazos.

## Pruebas
- `pagosaviso` 91: «🪟 la ventana no se abrió (…samsung Android 14…)» llega al administrador.
- `javaavisos` 187; pasan `pagosguia` y `avisosandroid`; compila todo el código Android.
