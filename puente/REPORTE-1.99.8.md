# ORDEVA 1.99.8 · Segunda tanda de ventanas propias (auditoría de diseño, hallazgo 19)

## Qué cambia
- **Ventanas del navegador cambiadas por las de ORDEVA** (de 38 quedan 12, y todas las que quedan son de respaldo):
  - Pagos: celular Nequi del cliente para el cobro, retirar equipos (uno o los viejos), nombre de un equipo, desconectar la
    API de DaviPlata.
  - Nube: usar otro negocio en este celular, nombre del negocio al subirlo, quitar el acceso a alguien, cerrar sesión.
  - Mesas y caja: reducir el número de mesas con cuentas abiertas, cerrar el día con mesas abiertas, salida de caja mayor a
    lo que debería haber, cambiar el nombre de la caja con turno abierto.
  - Pantalla de preparación (link nuevo, nombre, ocultarla), link nuevo del TV, balanza que todavía se mueve, quién lleva el
    domicilio, desconectar los celulares que leen códigos.
- Todas siguen preguntando antes de actuar. Después de preguntar se vuelve a mirar lo que se iba a cambiar:
  - Reducir mesas: si otra de las mesas que se quitan abrió cuenta mientras preguntaba, no la cierra y pide tocar otra vez.
  - Cobro Nequi: si el valor cambió mientras se escribía el celular, no cobra; al cancelar no se crea nada ni sale error.
  - Balanza: se agrega justo el peso que se preguntó.
- **Quedan del navegador** (a propósito): los «Copia esto / Abre este enlace» que solo salen si el celular no deja copiar,
  los de respaldo cuando las ventanas de ORDEVA no han cargado, y el de MacroDroid en Pagos (es de NTFY: no se toca).

## Revisión independiente (goldfish, contexto nuevo)
- BLOQUEANTE: el **cierre automático programado** con mesas abiertas quedaba esperando la pregunta toda la noche (la caja
  no se cerraba; al contestar al otro día habría mezclado ventas). → En modo automático ya no pregunta (solo se llega ahí
  si el dueño eligió «cerrarlas» en Ajustes); prueba nueva en `cerrarcaja` (punto 9).
- MENOR: nombre de la caja → se aplica el nombre preguntado aunque la pantalla se haya repintado.
- MENOR: domicilio → si llegaron datos de otro equipo mientras preguntaba, se repinta el panel que está a la vista (antes
  el botón viejo podía marcarlo «Entregado» sin querer).
- MENOR: Nequi → cancelar no muestra «el celular debe tener 10 dígitos»; la comprobación de la ventana usa su estado real.
- NOTA: las pruebas de retirar equipos, desconectar celulares y usar otro negocio ahora exigen que salga la pregunta.
- Revisado sin hallazgos: z-index (todas las preguntas quedan encima), `this` en las funciones async, NTFY sin tocar,
  sin credenciales expuestas.

## Pruebas (una por una, con el código final)
cerrarcaja 27/0, equiposprobar 20/0, lectorcel 31/0, flujocompleto 88/0, v186 15/0, daviplatacobro 28/0, cajamas 45/0,
cajagastos 10/0, pagossuenan 13/0. Antes de los arreglos de la revisión también: mejoras 32/0, cajapro 56/0, modos 55/0,
equipos 35/0, v189 7/0, salidas 29/0, pinempleado 18/0, diseno199 42/0. La lista completa la corre GitHub al publicar.

## No probado
Teléfonos reales; cobro Nequi y DaviPlata reales (solo con el servidor de pruebas); balanza física.
