# ORDEVA 1.59.2 · Contraseñas desde ORDEVA Admin y arreglos al entrar con una cuenta ya registrada

## 1. ORDEVA Admin: «✏️ Ponerle una contraseña»
- **Dónde:** Usuarios → la cuenta → 🛟 Soporte de la cuenta.
- **Cómo:**
  - el administrador escribe la contraseña que quiera, dos veces y con 👁 para verla (mínimo 8);
  - decide si la app le pide al cliente poner una propia al entrar (viene marcado: recomendado);
  - pregunta antes de cambiarla;
  - al final la muestra con botones para mandarla por mensaje de texto, por WhatsApp o copiarla.
- **Siguen igual:** «🔑 Contraseña temporal» (una al azar) y «📧 Mandar enlace».
- **Seguridad:**
  - la contraseña de **otro administrador** no se puede cambiar desde aquí (solo la cambia él mismo);
  - un cliente no le puede cambiar la contraseña a nadie;
  - la contraseña nunca queda guardada en el panel.
- **La vieja deja de servir en TODOS los equipos:** antes, en el celular donde la persona ya había entrado, la
  contraseña vieja seguía sirviendo para siempre (se guarda en el celular para entrar sin internet).
  - Ahora, al entrar con internet, ORDEVA la confirma con la cuenta. Si cambió, dice «La contraseña de … cambió. Entra
    con la nueva.».
  - La vieja ya no sirve en ese celular, ni sin internet.
  - Vale igual si la cambió el soporte o si la cambió el dueño en otro celular.

## 2. Problemas al entrar con una cuenta ya registrada (encontrados y arreglados)
La prueba `cuentas` fallaba a veces, también en la versión 1.58.2. Revisándola salieron problemas reales.

- **Lo que se agregaba justo cuando llegaban datos de otro equipo se perdía.**
  - Si en un equipo se agregaba algo (una venta, un producto) en el mismo momento en que bajaban los datos del otro
    equipo, uno de los dos cambios desaparecía.
  - Pasaba sobre todo al **entrar con la cuenta en otro celular** o al **cambiar de cuenta en el mismo celular**.
  - Ahora la bajada nunca pisa lo de este equipo:
    - primero guarda lo pendiente;
    - si hay cambios sin subir, **junta** los dos lados;
    - si se toca algo mientras se aplican los datos, también lo junta.
  - **Prueba nueva** (`sincroniza` 7a/7b): tocar algo justo cuando llegan los datos del otro equipo. Con el código
    anterior se perdía lo que llegaba del otro equipo; ahora quedan los dos cambios, en los dos equipos y en la nube.
- **Celular nuevo con los datos de muestra.**
  - Al entrar con la cuenta en un celular nuevo, un guardado pendiente de los datos de muestra podía caer después de
    bajar los del negocio y taparlos.
  - Ahora lo pendiente se guarda antes de poner los datos de la nube.
- **Lo último guardado antes de cerrar la app.**
  - Ahora se escribe primero en la memoria rápida (localStorage) y después en el almacén grande. Antes era al revés y
    lo último se podía quedar sin guardar.
  - Al leer gana el más nuevo, como antes.
- **La prueba misma** revisaba los datos en el instante en que la app los estaba cambiando y fallaba sola. Quedó
  corregida.
- **Resultado:** `cuentas` 43/43 en 8 corridas seguidas (antes fallaba en 1 de cada 2 o 3).

## 3. Pruebas
- **Servidor:** `admin` 148:
  - mínimo 8;
  - la vieja deja de servir;
  - con o sin «pedir que la cambie»;
  - un cliente no puede;
  - un administrador no le cambia la de otro administrador.
- **App:**
  - `cuentacliente` 44 (4c: el celular que tenía la vieja ya no entra con ella y sí con la nueva);
  - `adminreal` 48 (el botón del panel, de punta a punta);
  - `sincroniza` 27;
  - `cuentas` 43;
  - `entrar` 35;
  - `recuperacion` 25;
  - `tactorapido` 8 (2b: tocar y cerrar la app en el mismo instante).

## Ojo
- **La sesión abierta no se cierra al cambiar la contraseña.** Un equipo que tiene ORDEVA abierto sigue adentro hasta
  que cierre sesión. Para sacar a alguien de una vez está «⛔ Bloquear la cuenta», y el dueño puede quitarlo de su
  equipo.
- **Usuarios sin correo** (los que el dueño crea con un nombre, como «juan»): viven solo en ese celular. Su contraseña
  la cambia el dueño con 🔑 en Ajustes → Cuenta.
  - Para que un empleado entre en varios equipos, se le invita a «👥 Mi cuenta y mi equipo» y entra con su correo.
