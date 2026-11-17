# ORDEVA 1.99.15 · Todo negocio en la nube, sin entrar a Supabase

**Pedido del dueño (17/11):** «que todos los datos de un negocio queden guardados en la nube… que ya entre automáticamente
a la base de datos… y cada usuario ya le quede su base de datos guardada apenas crea la cuenta con ORDEVA».

## Diagnóstico en producción (solo lectura, `.github/workflows/diagnostico-cuentas.yml`)
- El servidor YA confirma los correos solo (no hay que confirmar nada ni entrar a Supabase). 7 cuentas, todas confirmadas;
  6 negocios.
- El negocio con más datos: 168 productos (81 inventariados) y 192 ventas, intacto (lo máximo en sus respaldos es lo de hoy).
  Es de otra cuenta de correo (cr…@gmail.com), no de la que el dueño revisó.
- La conexión que viene con la app (`nube/config.js`) solo existe desde el 7/11 (1.95.0).

## Por qué un negocio quedaba solo en un equipo
1. Si el equipo tenía guardada una conexión vacía o vieja, la app ignoraba la que viene con ella y mostraba el formulario
   de Supabase («me toca entrar a Supabase»).
2. Al vincular un equipo con su inventario a una cuenta que ya tenía negocio en la nube, mandaba la nube también en los
   productos: los del equipo se perdían (las ventas sí se sumaban).
3. Una cuenta creada con un usuario sin correo queda solo en ese equipo.

## Qué cambia
- `nube/vento-nube.js` cfg(): la conexión de la app se usa siempre que lo guardado no sirva. Para apagar la nube a
  propósito: `{ off: true }` (modo demo y pruebas; también lo respetan `lib/vento-canal.js` y `lib/vento-errores.js`).
- `vincular()` sin copia de referencia: `unirCatalogo` agrega los productos del equipo que la nube no tiene (por id, sin
  repetir nombre), y las categorías que usan (emparejadas por nombre). Los de muestra se agregan solo si el dueño los usó
  (stock o vendidos). Solo para dueño o administrador, y no si leer la copia de referencia tardó demasiado.
- Crear cuenta con la nube disponible exige correo (sin internet se crea en el equipo y sube después, como antes).
  Las pruebas automáticas siguen pudiendo crear «ana» (igual que con el tipo de negocio).

## Revisión independiente (goldfish)
Bloqueante: la exigencia de correo rompía ~36 pruebas → arreglado (excepción para pruebas automáticas, como con el tipo de
negocio; `nubeinventario` la prueba de verdad). Mayor: productos de muestra inventariados se perdían → se conservan si
tienen stock o se vendieron. Menores arreglados: solo dueño/admin suman productos; categorías por nombre; sin unir si la
copia tardó. Queda (nota): crear un segundo negocio en el mismo equipo ahora pide otro correo (es lo que se busca).

## Pruebas
- Nueva `pruebas/nubeinventario.test.js` 14/0 con el servidor real: conexión vacía guardada → usa la de la app; equipo con
  30 productos + 3 ventas se vincula a una cuenta con 2 → la nube queda con los 30 + la cerveza de muestra inventariada +
  los 2 (33) y las 3 ventas, categoría con el mismo id y otro nombre bien separada, la de muestra sin usar no sube; un
  celular nuevo entra con el correo y tiene todo; crear con un usuario sin correo pide el correo.
  En la versión publicada antes, esta prueba falla desde el primer paso.
- Lista completa: 142 pruebas, 3.276 bien y 4 mal, todas de `pinempleado` (no apagaba la nube y con la máquina cargada
  tardaba en crear a «juan»; sola pasa 18/0). Arreglada la prueba: ahora apaga la nube (18/0 dos veces).
- Las que la revisión vio rotas, ya bien: facil 47/0, tactorapido 8/0, abririnstante 11/0, pasos 14/0, modos 55/0,
  sonidos 38/0, panelsuena 15/0, sincupo 11/0, sololocal 8/0, flujocompleto 88/0, loginotro 28/0.
