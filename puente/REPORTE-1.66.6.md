# ORDEVA 1.66.6 · ◐ El diseño ORDEVA 2.0 llega a todos los negocios

## Qué pasó
- El dueño abrió la app con la versión v1.66.5 y seguía viendo el diseño de antes: oscuro, con calabazas y murciélagos.
- La razón: en la 1.66.0 solo pasaban al diseño nuevo los negocios que tenían «Noche violeta», el diseño que venía de
  fábrica. A los que habían elegido otra apariencia (aquí «🎃 Halloween», con su decoración y una foto de fondo) se
  les respetaba lo que tenían.

## Qué quedó
- **Todos los negocios pasan UNA vez a ◐ ORDEVA 2.0**, también los que tenían otra apariencia o decoración
  (🎃, 🎄, 💘…).
- Lo que tenían **queda guardado** (`data.o2Antes`: la apariencia y la decoración).
- En **Ajustes → Apariencia** aparece «Tu negocio pasó al diseño ORDEVA 2.0. ¿Prefieres la apariencia que tenías?
  **↩ Volver a 🎃 Halloween**».
  - Con un toque vuelve todo como estaba, y ya no se cambia solo otra vez.
  - Elegir cualquier otra apariencia también quita el aviso.
- **La foto de fondo no se borra.** Con ORDEVA 2.0 solo no se muestra; vuelve si se elige otra apariencia.
- **App Android:** el celular ya tiene la 1.0.76, la que trae las salidas de Nequi y DaviPlata. Seguía saliendo «no se
  pudo instalar de fondo (INSTALL_FAILED_ABORTED…)», un error guardado de un intento anterior. Ahora ese mensaje solo
  sale si de verdad hay una actualización pendiente.

## Pruebas
- `ordeva2` (30 ✅). La parte 6 cambió y ahora comprueba:
  - Noche, Menta y Halloween con decoración pasan a ORDEVA 2.0 y lo de antes queda guardado;
  - la foto de fondo se guarda pero no se muestra;
  - aparece «Volver a 🎃 Halloween»;
  - al volver, Halloween regresa con su decoración y su foto, y no se cambia solo al recargar.
- Los resultados de la demás suite están en el mensaje de publicación.
