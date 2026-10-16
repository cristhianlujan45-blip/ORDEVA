# Vento 1.40.9 · 🪟 Ventana emergente con el valor de cada pago

El dueño: «Que me salga una ventana emergente con el valor que me mandaron, con la opción de cerrarla, o que se cierre
automáticamente después de 15 segundos».

## Cómo es
- El valor grande («$20.000»), por qué banco («por Nequi», «por Bre-B en DaviPlata»), de quién y lo que dijo el banco.
- Botón «✕ Cerrar» y la cuenta «Se cierra sola en 15 s» (15, 14, 13…).
- Si llegan varios pagos seguidos, muestra el último y «+N pagos más».
- Colores según el aviso:
  - morado: pago confirmado o plata sin valor («💜 Llegó plata»);
  - naranja: «⚠️ Revisa este pago»;
  - rojo: «🚨 Pago FALSO».

## Dónde sale
- **Con Vento a la vista:** dentro de Vento (la página).
- **Usando otra app:** encima de lo que se esté viendo (`VentanaPago`, permiso «Aparecer encima de otras apps»).
- **Con el celular bloqueado o la pantalla apagada:** encima de la pantalla de bloqueo, y prende la pantalla
  (`PagoActivity`). La abre la notificación del pago con «pantalla completa»; con el permiso de encima de otras apps
  también se abre directo.
- Nunca dos veces: la página solo la muestra si Vento se está viendo (`alFrente`; la página de fondo sigue «visible»
  aunque la app esté minimizada), y Android solo fuera de Vento.

## Ajustes y permisos
- **Ajustes → 💜 Pagos → «🪟 Ventana emergente con el valor»**: prendida de fábrica, con «▶ Probar la ventana» y el
  estado de los dos permisos («✅ Sale encima de otras apps» / «⚠️ … 🪟 Permitir»).
- **Aviso arriba con «🪟 Permitir»** si falta un permiso: primero «encima de otras apps», luego «pantalla completa». Con
  «Luego» no sale en 3 días.

## Pruebas
- `pagosaviso` 81:
  - ventana con valor, banco, de quién y texto;
  - «Cerrar»;
  - no sale con Vento minimizada ni apagada;
  - se cierra sola a los 15 s;
  - la fila de Ajustes;
  - el aviso de permisos.
- `javaavisos` (`EscuchaPrueba` 25): cada pago lleva a la ventana el valor, el banco y el tipo (también «$65.000 por
  Bre-B en DaviPlata» y la plata sin valor).
- Compila todo el código Android (con `android-all`).

## Lo que necesita el dueño
- Instalar la app nueva una vez.
- Dar los dos permisos con el aviso «🪟 Permitir», que lleva a la pantalla exacta.
