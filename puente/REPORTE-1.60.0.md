# ORDEVA 1.60.0 · Cambiar la contraseña cierra la sesión abierta · Empleados con nombre en todos los equipos

## 1. 🔑 Al cambiar la contraseña, sale quien seguía adentro con la vieja
**Antes:** un equipo que tenía ORDEVA abierto seguía adentro hasta que alguien cerrara la sesión, aunque el Admin ya
hubiera cambiado la contraseña.

**Ahora:** ese equipo sale solo y pide la nueva. Pasa en todos estos casos:
- ORDEVA Admin le pone una contraseña («✏️ Ponerle una contraseña») o le da una temporal;
- la persona la cambia ella misma: en Ajustes, con «¿Olvidaste tu contraseña?», con el enlace del correo o al poner la
  propia después de una temporal.

**Cómo funciona:**
- El servidor anota **la hora en que se puso la contraseña** (la del servidor, no la del reloj del celular).
- Cada equipo compara esa hora con la que vio al entrar.
- Si cambió:
  - guarda todo;
  - la contraseña vieja deja de servir en ese celular, también sin internet;
  - vuelve a la entrada con «🔑 La contraseña de X cambió. Entra con la nueva.»
- **Revisa:** al instante con el aviso en vivo del negocio, cada 3 minutos y al volver a la app.
- **El equipo donde se hizo el cambio no se saca a sí mismo.**
- **Solo sale quien entró CON esa cuenta.** El celular de la barra, donde juan entra con su nombre pero que está
  conectado con la cuenta del dueño, sigue funcionando y sincronizando.
  - Por eso no se borran las sesiones en el servidor: si se borraran, esos equipos dejarían de sincronizar.

**Probado con la app real y la base de datos real (`cuentacliente` 49/49):**
- El primer celular sigue adentro mientras en otro celular se pone la temporal y luego una propia.
- Ese primer celular sale con el aviso.
- La contraseña vieja ya no entra ahí; la nueva sí, con sus datos.
- No lo vuelve a sacar.
- El celular donde se hizo el cambio no se saca a sí mismo.

**Servidor (`servidor/admin` 153/153):**
- La hora cambia con la temporal, con «Ponerle una contraseña» y cuando la persona la cambia.
- Guardar otra cosa del perfil no la cambia.
- Un cliente no puede marcar la de otro.

## 2. 👥 Empleados creados solo con un nombre, en todos los equipos del negocio
**Antes:** «juan», creado por el dueño en Ajustes, existía solo en ese celular.

**Ahora:** en cada equipo conectado con la cuenta del dueño o de un administrador, juan aparece solo. Tiene el mismo
nombre, la misma contraseña y el mismo rol.
- Lo que el dueño cambie en un celular llega a los demás: crear, contraseña nueva, rol o quitar.
- Si juan estaba adentro en otro equipo cuando le cambiaron la contraseña o lo quitaron, sale con el aviso.
  - «🔑 El administrador le cambió la contraseña a juan» o «👤 El administrador quitó el usuario juan».
- **Viaja la huella de la contraseña** (PBKDF2, como ya se guardaba en el celular), **nunca la contraseña**.
- **Solo el dueño y el administrador** leen o cambian esa lista.
  - El mesero, cajero o empleado con cuenta propia no ve las huellas.
  - Otro negocio tampoco.
  - La tabla no se lee directo.
- **Quitar deja la marca «borrado»:** los demás equipos también lo quitan y no se pierde el registro.
- **Compatibilidad con lo que ya existe:**
  - Los usuarios que ya estaban en un celular se suben solos la primera vez.
  - Si el mismo nombre ya existía en dos celulares con contraseñas DISTINTAS, cada uno conserva la suya hasta que el
    dueño la cambie. No se le cambia la contraseña a nadie por sorpresa.
- **Las cuentas con correo no pasan por aquí:** esas ya son las mismas en todos los equipos.
- **Los datos del negocio (ventas, productos…) no se tocan.**

**Probado con la app real, dos celulares y la base de datos real (`usuariosequipo` 23/23):**
- crear en uno → aparece en el otro y juan entra ahí como equipo;
- cambiar la contraseña → juan sale en el otro, la vieja no sirve y la nueva sí;
- quitar → sale y ya no entra;
- el dueño sigue entrando;
- los datos del negocio quedan iguales.

**Servidor:** `servidor/usuariosequipo` 18/18 (permisos, versiones, borrado, nombres con @, volver a correr la migración).

## Base de datos (sin borrar nada)
- `20261110000000_clave_puesta.sql`:
  - columna nueva `perfiles.clave_puesta_en`;
  - `perfil_yo` la devuelve;
  - `perfil_guardar` acepta `clave_nueva`;
  - función nueva `srv_clave_puesta` (solo el servidor).
- `20261111000000_usuarios_equipo.sql`:
  - tabla nueva `usuarios_equipo` (con RLS, sin acceso directo);
  - funciones `usuarios_equipo_lista` y `usuarios_equipo_guardar` (solo dueño y administrador).
- El revisor de migraciones las aprueba: 37 migraciones sobre una base vacía, todas las tablas con RLS.

## Archivos
- `nube/vento-usuarios.js` (nuevo).
- `nube/vento-nube.js`, `nube/vento-suscripcion.js`, `lib/vento-cuenta.js`, `app/04-principal.js`.
- `supabase/functions/vento-suscripciones/cuentas.ts`.
- Pruebas: `pruebas/usuariosequipo.test.js` (nueva), `pruebas/servidor/usuariosequipo.test.js` (nueva),
  `cuentacliente`, `servidor/admin`.
- GitHub ahora también corre `cuentacliente` y `usuariosequipo` en cada cambio.

## Lo que no se pudo probar aquí
- **El aviso en vivo de Supabase (Realtime).** El servidor de pruebas no lo tiene, así que en las pruebas el aviso se
  simula. Si en producción no llegara, el equipo igual lo revisa cada 3 minutos (contraseña) o 5 minutos (usuarios),
  y al volver a la app.

## Pruebas completas
- **Servidor:** las 21 suites pasan, entre ellas la nueva `usuariosequipo` (18).
- **App:** 94 de 96 pasaron en la corrida completa.
  - Las otras dos, `cuentacliente` (en la parte de soporte) y `dian`, fallaron por esperas mientras corrían al mismo
    tiempo las pruebas del servidor.
  - Corridas solas pasan completas: `cuentacliente` 49/49 y `dian` 29/29.
