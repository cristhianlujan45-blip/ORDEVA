# Vento 1.43.0 · Entrar: «Iniciar sesión | Crear cuenta», entrar con un código y recuperar con código al correo

El dueño: «solamente me da la opción de crear y entrar». Pidió:
- dos opciones claras: crear la cuenta e iniciar sesión;
- un modo fácil de entrar con el número del celular y un código;
- que cada usuario entre con su correo y su contraseña;
- que, si olvidó la contraseña, le llegue al correo un código temporal para entrar.

## Por qué solo se veía «crear»
En un celular sin cuentas, Vento arrancaba en «Crear cuenta». Iniciar sesión era un botón pequeño abajo («¿Ya tienes
cuenta?»), que además se escondía si la nube no estaba lista.

## Lo nuevo
- **Pestañas «🔑 Iniciar sesión | ➕ Crear cuenta»** arriba, siempre a la vista. Al salir de Vento la pantalla vuelve a
  ellas.
- **Iniciar sesión:** correo (o usuario, para los meseros) y contraseña, como siempre.
- **«📲 Entrar fácil con un código (sin contraseña)»:**
  - **📧 Al correo:** llega un código de 6 números. Al escribirlo entra solo, sin tocar «Entrar». El mismo correo trae
    un enlace que también hace entrar.
  - **📱 Al celular:** llega un mensaje de texto con el código. Sirve cuando el celular está unido a la cuenta, en
    Ajustes → Negocio → 📱 Celular de la cuenta → «📲 Usar este celular para entrar con un código».
  - Solo para cuentas que ya existen; nunca crea una cuenta nueva por error. Correo o celular sin cuenta → «no tiene
    cuenta de Vento». Código malo o vencido → lo dice. Para pedir otro hay que esperar 30 s.
  - Entrar con código no cambia la contraseña de la cuenta.
- **«¿Olvidaste tu contraseña?»** en dos pasos:
  1. El correo y «📧 Enviarme un código al correo».
  2. El código temporal (vence en 15 min) y la contraseña nueva dos veces.

  Al terminar entra de una, y la contraseña nueva queda en la cuenta para todos los celulares. La vieja deja de
  servir. Los códigos de recuperación y el pedido por SMS al soporte siguen ahí, en «Otras formas de recuperarla».

## Servidor
- **Correo con código: falta un dato del dueño.** El servidor todavía no tiene correo propio (secretos `VENTO_SMTP_*`
  vacíos en el último despliegue). Sin él, Supabase solo entrega correos a su propio equipo, así que hoy los códigos no
  le llegan a los clientes. Con los secretos, el despliegue configura el correo de una vez: código de 6 números,
  15 min y llega a cualquier correo.
  - `VENTO_SMTP_HOST`, `VENTO_SMTP_PORT`, `VENTO_SMTP_USER`, `VENTO_SMTP_PASS`, `VENTO_SMTP_FROM`.
  - Ejemplo con Gmail: `smtp.gmail.com`, `587`, el correo y una «contraseña de aplicación».
- **Mensajes de texto (nuevo paso en «Servidor Vento»):** con `VENTO_TWILIO_SID`, `VENTO_TWILIO_TOKEN` y
  `VENTO_TWILIO_SERVICIO` se activa el código por SMS. El mensaje es «Tu código de Vento es 123456», 6 números,
  10 min. Sin esos secretos, «📱 Al celular» dice que todavía no está activado y no deja pedir.

## Pruebas
- `entrar` (nueva): 35 comprobaciones contra el Supabase local real.
  - Pestañas.
  - Código al correo: sin cuenta, código malo, código bueno; entra y baja su negocio.
  - El enlace del correo también entra.
  - Al salir vuelve a las pestañas.
  - Olvidé la contraseña con código: entra y la contraseña cambia en la cuenta.
  - SMS: unir el celular y entrar con un SMS. Sin SMS en el servidor, «Al celular» no deja pedir.
- El Supabase local de las pruebas ahora entiende `/otp` (código), `/verify` y el celular.
- Ajustadas a las pestañas: `cuentas` (43), `cuentacliente` (39), `recuperacion` (25, ahora es código y no enlace) y
  `sincroniza` (22).
