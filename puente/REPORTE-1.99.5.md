# ORDEVA 1.99.5 · Ventanas propias en vez de las del navegador (auditoría de diseño, hallazgo 19)
Se publica junto con la 1.99.3 y la 1.99.4 (ver `REPORTE-1.99.4.md`), con una sola lista completa.

## Qué cambia
- **Dos ventanas nuevas de ORDEVA** (`app/04a`): `showPrompt` (escribir un dato) y `showAviso` (avisar). Se ven como el
  resto de la app, con etiqueta visible unida al campo, rol de diálogo para lectores de pantalla, botones de 44 px, Enter
  para aceptar y Escape para cancelar. La de confirmar que ya existía ahora también tiene su marca (`role="alertdialog"`).
- **27 ventanas del navegador cambiadas** (de 65 quedan 38):
  - Contraseña nueva de un usuario, PIN de un empleado, contraseña actual y correo de recuperación (`app/04h`): **la
    contraseña y el PIN ya no se ven mientras se escriben** (el `prompt()` del navegador los mostraba).
  - Recibir un respaldo (`index.html`): pregunta antes de reemplazar los datos y avisa en la ventana propia.
  - Inventario (`lib/vento-inventario.js`): crear producto por código, precio por cantidad, cambiar código, vaciar entrada,
    cancelar conteo y aplicar la toma de inventario.
  - Quitar persona de la mesa, borrar categoría (ahora dice su nombre), borrar apunte de la Libreta, quitar promoción,
    quitar QR de pago, borrar cotización, descartar solicitud (agencia), terminar torneo de Play, vaciar la cola de música.
  - Avisos: «el proveedor subió el precio» y los de pedidos escritos.
- Después de preguntar, cada una **vuelve a buscar** lo que iba a cambiar (la mesa, el apunte, la promoción, lo contado):
  con la ventana propia la app no se congela mientras pregunta, y en ese rato pudo llegar un cambio de otro equipo.
- **No se tocaron** (quedan para otra tanda con su revisión): pagos (Nequi/DaviPlata, equipos que avisan), la nube
  (cargar datos de otro negocio, quitar acceso, cerrar sesión), reducir mesas con cuentas abiertas, enlaces de pantallas y
  TV, y los «Copia esto» que solo salen si el celular no deja copiar. La de MacroDroid tampoco (es de NTFY: no se toca).

## Pruebas
- Nuevo `pruebas/ventanas.js`: ayuda para que las pruebas contesten las ventanas propias.
- Ajustadas: `pinempleado` 17/0, `usuariosequipo` 27/0, `clavevarios` 24/0, `playtorneo` 23/0, `mejoras` 32/0, `almacen` 15/0.
- `diseno199` punto 10: 37 bien, 0 mal (contraseña oculta, etiqueta, rol, 44 px, Enter, Escape, aviso de un botón,
  borrar categoría en la ventana propia, ninguna ventana del navegador).
- **Lista completa (1.99.3 + 1.99.4 + 1.99.5):** RESULTADOS_AQUI
- **Revisión independiente:** REVISION_AQUI

## No probado
- Teléfonos reales; lectores de pantalla de verdad (solo se revisaron las marcas).
