# ORDEVA 1.99.14 · Aviso «este negocio está guardado solo en este equipo»

**Pedido del dueño (17/11):** se perdieron los productos inventariados de su cuenta; «que el usuario ingrese con su cuenta
y ya tenga todos sus datos ahí, no que tenga que estar entrando a Supabase».

## Diagnóstico en producción (solo lectura, `.github/workflows/diagnostico-datos.yml`)
- Nuevo flujo de GitHub que se corre a mano con la HUELLA (md5) del correo: muestra los negocios de esa cuenta, sus
  respaldos, los cambios de ventas/productos y la auditoría, solo con conteos, fechas y roles (sin correos ni nombres).
- Resultado para la cuenta del dueño: tiene UN negocio en la nube, creado el 18/10. Todos sus respaldos (18/10, 22/10,
  30/10, 16/11, 17/11) tienen como mucho 2 productos y 5 ventas: **los productos inventariados nunca llegaron a la nube**.
- En TODA la base, ningún negocio tiene en un respaldo bastante más productos o ventas que hoy: no se borró nada en la nube.

## Por qué
Cada cuenta de correo guarda UN negocio en la nube (el vinculado). Un negocio creado en el mismo equipo como otra sede
(«Sedes o negocios») o con un usuario sin correo se guarda solo en ese equipo, y no había ningún aviso.
La conexión a la base ya viene puesta en la app (`nube/config.js`, solo la clave pública): nadie tiene que entrar a Supabase.

## Qué cambia
- `lib/vento-solo-local.js` (nuevo): al dueño o administrador, arriba de Inicio, si el negocio que ve tiene productos o
  ventas y no es el que su cuenta guarda en la nube: «📱 «Nombre» está guardado solo en este equipo · Tiene N productos y
  M ventas…» con «☁️ Guardarlo en mi cuenta» (abre el panel de la cuenta; no sube nada solo) y «Hoy no». Si la cuenta ya
  guarda otro negocio, lo dice con su nombre. Sin nube configurada, negocio vacío o empleados: no sale.

## Pruebas
- Nueva `pruebas/sololocal.test.js` 8/0 (agregada a la lista de GitHub).
- Con la nube de verdad: flujocompleto 88/0, cuentas 43/0, sincroniza 27/0, ordeva2pantallas 20/0, diseno199 50/0,
  suscripnube 67/0, usuariosequipo 27/0, daviplatacobro 28/0. `almacen` falló una vez (paso 6) con la máquina cargada y
  pasó sola dos veces seguidas (15/0).

## Pendiente (decide el dueño)
- Recuperar el negocio con el inventario: está en el celular o computador donde se creó (si no se borraron los datos de
  ese navegador/app). Para subirlo, como cada correo guarda un negocio: reemplazar el de la nube (2 productos) o usar otro correo.
