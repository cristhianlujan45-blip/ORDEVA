# Vento 1.34.0 — Vento Admin conectado: usuarios, soporte, licencias y recuperar cuentas

## 1. Vento Admin ve a todos los usuarios (antes «no se veía ningún usuario»)
- **Por qué no salía nadie:**
  - la lista «👥 Clientes» de Vento Admin era una libreta guardada solo en ese equipo (nunca leía el servidor);
  - las cuentas sin correo («mesero1», «ana») vivían solo en el celular.
- **Ahora todo sale del servidor**, en cualquier equipo donde entres:
  - **📊 Resumen:** usuarios registrados, nuevos de la semana, negocios, planes pagados, en prueba y vencidos, pagos por
    revisar, soporte sin responder, licencias activas y equipos usando Vento.
  - **👥 Usuarios:** TODAS las cuentas (también las que no tienen negocio), con su negocio, rol, plan, celular,
    equipos donde usan Vento y último ingreso. Se puede buscar y filtrar.
  - **Equipos sin cuenta en la nube:** cada equipo donde se abre Vento avisa que existe, así también ves los negocios que
    usan usuarios de un solo celular (para invitarlos a crear su cuenta).
- **Ficha de cada cuenta (soporte):**
  - 🔑 contraseña temporal con botón **«📱 Mandar por mensaje de texto»** (abre el SMS de tu celular con el texto listo)
    o WhatsApp;
  - 📧 enlace al correo para cambiar la contraseña;
  - 🎁 darle una licencia, ✅ confirmar el correo, ⛔ bloquear o desbloquear.
- **➕ Crear la cuenta de un cliente:** correo, negocio, celular y licencia (1, 3, 6, 12 meses o para siempre). Muestra la
  contraseña para mandársela por SMS, WhatsApp o correo; al entrar, la app le pide poner una propia.

## 2. Entrar a Vento Admin con correo y contraseña
- El administrador es **cristhianwkh@gmail.com** (quedó en el servidor).
- **La contraseña no está en el código:** la pones tú la primera vez con «Crear mi cuenta», y queda guardada solo
  cifrada en el servidor.
- «¿Olvidaste la contraseña?» manda un código de 6 números al correo.
- El código personal de antes solo hace falta para los códigos firmados sin internet (🔑 Licencias → sistema anterior).

## 3. Tu cuenta de cliente, aparte y con OTRA contraseña
- El correo de administrador ya no entra como cliente en la app.
- Tu cuenta de cliente es por ejemplo **cristhianwkh+cliente@gmail.com**; los correos te llegan al mismo Gmail.
- La app no deja que la cuenta de cliente tenga la misma contraseña de administrador.
- **Si ya tenías tu negocio con el correo de administrador:** al entrar, la app ofrece «🔀 Pasar mi negocio a mi cuenta de
  cliente». Pasa todo sin perder datos y te deja dentro.

## 4. Licencias: solo tú las das
- **🔑 Nueva licencia:**
  - plan;
  - duración en días, meses o años, hasta una fecha, o para siempre;
  - **correos con los que se comparte**;
  - cuántos negocios la pueden activar;
  - una nota para ti.
- **Con correos:** solo esas cuentas la pueden usar, y se les activa sola al entrar a Vento. Con otro correo no
  sirve, así nadie la puede revender ni pasar.
- **Sin correos:** sirve por código (VENTO-XXXX-XXXX-XXXX), con link para mandar por WhatsApp o correo
  (`…/index.html#lic=CÓDIGO`) o en la app: ⋯ Más → 💳 Mi plan → «🔑 Tengo un código de licencia».
- **En la lista:** quién la usó, en qué negocio y hasta cuándo. Se pueden agregar o quitar correos, y **anular** la
  licencia (con opción de quitarle el plan a quien ya la activó).
- **Por qué no se pueden falsificar:**
  - solo el servidor crea licencias, y solo a pedido del administrador;
  - el plan de cada negocio lo firma el servidor;
  - un cliente no puede crear licencias ni llamando la base directamente (probado).
- La app muestra la **licencia de uso** al crear la cuenta: se usa en el negocio, no se revende ni se pasa a otros;
  único distribuidor autorizado: Vento.

## 5. Soporte dentro de la app
- **El cliente:** Ajustes → Guía y soporte → **«🎧 Soporte de Vento» → «✍️ Escribir a soporte»**. Funciona con o sin
  cuenta. La respuesta le llega en la app, con aviso «1 nueva», y puede contestar.
- **Vento Admin → 🎧 Soporte:** casos por atender, con correo, celular y negocio. Puedes:
  - responder (con respuestas rápidas) y cerrar el caso;
  - dar una contraseña temporal o mandar el enlace al correo desde el mismo caso;
  - abrir WhatsApp o un mensaje de texto.
- Aviso de casos nuevos en la pestaña.

## 6. Recuperar la contraseña por correo o por mensaje de texto
- **Por correo:** como antes, con un enlace o un código.
- **Por mensaje de texto (nuevo):** en «¿Olvidaste tu contraseña?» se escribe el celular y llega un caso de soporte.
  - Vento Admin muestra si ese celular **coincide con el de la cuenta**.
  - Tú le pones una contraseña temporal y se la mandas por SMS con un toque.
  - Al entrar con ella, la app le pide poner una nueva.
- **📱 Celular de la cuenta** (Ajustes → Negocio): se guarda para comprobar que es el dueño.

## 7. Servidor
- **Migración `20261015000000_admin_soporte_licencias.sql`.** Agrega:
  - administradores por correo;
  - equipos;
  - perfiles (celular);
  - casos y mensajes de soporte;
  - licencias, sus correos y sus usos.
- Todas estas tablas se manejan solo por funciones que revisan permisos; las tablas no se leen directo.
- **Edge Function `vento-suscripciones`:** rutas nuevas `/licencia` y `/admin/*` para usuarios, equipos, soporte,
  licencias, contraseña temporal, enlace, bloquear, confirmar y crear cuenta. Al pedir el estado, se activan las
  licencias compartidas con tu correo.

## 8. Facturas: se giran solas, y «↻ Girar» a mano
- Si la foto quedó **de lado o al revés**, el escaneo la deja derecha sola.
  - Funciona con texto normal, solo MAYÚSCULAS y tirillas POS, aunque esté un poco torcida.
  - Avisa «Estaba al revés: la giré».
- **«↻ Girar»** en «📷 Revisa la foto» da un cuarto de vuelta cada vez, y el escaneo HD que se guarda sale igual.
- **«↻ Girar la página»** en «📚 Facturas anteriores» gira una página ya guardada.
- Si Vento no está seguro hacia dónde va el texto, no gira nada (queda el botón a mano).

## Pruebas nuevas

| Prueba | Resultado |
|---|---|
| servidor/admin (PostgreSQL real) | 66 / 66 |
| adminreal (Vento Admin en el navegador, servidor real) | 39 / 39 |
| cuentacliente (app del negocio con soporte, licencias, SMS, admin vs. cliente) | 32 / 32 |
| girofactura (facturas que se giran solas) | 24 / 24 |
| **Batería completa (40 pruebas + 3 del servidor)** | **1.538 bien, 0 mal** |
