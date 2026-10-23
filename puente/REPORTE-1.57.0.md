# ORDEVA 1.57.0 · etapas 5, 6, 7 y 8 (primera parte) + limpieza de la 9

Corrige los riesgos R7, R8 y R9 de `puente/ORDEVA-AUDITORIA.md`. Servidor de pagos 1.24.0.

## Etapa 6 · Panel «🚨 ALERTAS DE PAGOS» (Ajustes → 💜 Pagos)
Una sola lista con todo lo que hace falta para que un pago suene con el celular bloqueado. Cada línea tiene su botón
para arreglarla:
- **Lectura de los avisos** de Nequi y DaviPlata y el permiso «Acceso a notificaciones».
- **Notificaciones** de la app permitidas.
- **Batería de la app** sin restricciones, y la app trabajando de fondo.
- **Batería de Nequi y DaviPlata** sin restricciones (si no, Android retrasa sus avisos).
- **Voz** de los pagos y su volumen.
- **Conexión** con los demás equipos de la cuenta.

Abajo de la lista:
- Último pago y último aviso de un banco en el celular.
- **▶ Probar el sonido.**
- **📳 Probar la alerta completa:** un aviso de prueba por el camino de verdad. No queda como pago.
- **🎵 Elegir el sonido y la vibración:** abre el ajuste de Android del canal «💜 Pagos que te llegan».

En Vento Web el panel explica que la lectura la hace la app, y ofrece probar la vibración.

**Qué no cambió:** el panel solo lee lo que la app ya medía. No cambia cómo se leen ni cómo suenan los pagos.

**Guía para probar en un celular real:** `puente/PRUEBA-FISICA-PAGOS.md` (10 pruebas: bloqueado, app cerrada, No
molestar, sin internet, reinicio, recarga…). **Esto no se probó en un celular real:** solo se puede hacer con el
celular del negocio.

## Etapa 5 · Pruebas de punta a punta de Wompi y Nequi Conecta
Ya estaban en el código, pero sin pruebas. Ahora se prueban contra una API simulada que responde como la oficial:
- **Wompi** (`pruebas/servidor/wompi.test.js`, 18 comprobaciones):
  - llaves malas o mezcladas (test/prod) no se guardan;
  - las buenas quedan cifradas;
  - firma de integridad del link;
  - eventos con firma mala, dirección desconocida, duplicados, ambiente distinto y rechazados;
  - un valor distinto al cobrado no se aprueba;
  - el repaso aprueba el pago aunque el evento no llegue;
  - registros sin secretos.
- **Nequi Conecta** (`pruebas/servidor/nequiconecta.test.js`, 16 comprobaciones):
  - Client Secret o API Key malos;
  - cobro push con el cuerpo exacto;
  - rechazo de Nequi con su motivo;
  - QR;
  - estado «35» con el mismo valor sí se aprueba, y con otro valor no;
  - registros sin secretos.
- **DIAN y DaviPlata** ya tenían sus pruebas (69 y 102 comprobaciones). Siguen pasando.

**Para cobrar de verdad** hacen falta las credenciales del negocio (`puente/CREDENCIALES-PAGOS.md`).

## Etapa 7 · Base de datos y autenticación
- **R7 · Límites de Laya en el servidor.**
  - **Antes:** el límite vivía en la memoria de cada instancia del servidor y se reiniciaba solo.
  - **Ahora:** está en la base de datos (`ia_uso` + `srv_ia_cupo`), atómico y compartido por todas las instancias.
    - Por cada negocio: 40 por minuto y 3000 por día.
    - En la IA de ORDEVA: por conexión (minuto y día) y un tope diario global.
    - Lo rechazado no gasta cupo.
    - Si la base no responde, queda el límite de antes (la IA no se cae por eso).
  - Todo se ajusta con variables: `VENTO_IA_NEGOCIO_MIN/DIA`, `VENTO_IA_IP_MIN/DIA`, `VENTO_IA_DIA`.
- **R8 · Contraseñas del celular con PBKDF2.**
  - Las nuevas se guardan con PBKDF2-SHA256 de 100.000 vueltas.
  - Las viejas (SHA-256) siguen entrando y se pasan solas a PBKDF2 la primera vez que entran bien. Nadie tiene que
    cambiar su contraseña.
- **Aislamiento entre negocios** (`pruebas/servidor/aislamiento.test.js`). Recorre TODAS las tablas, incluidas las que
  se agreguen en el futuro, y comprueba:
  - el dueño, el mesero de otro negocio o alguien sin sesión no ven ninguna fila ajena;
  - nadie de afuera cambia nada;
  - cada regla pasa por la membresía;
  - todas las tablas tienen RLS;
  - ningún valor se guarda en decimales inexactos (todo es NUMERIC o entero).
- **Comprobación de la prueba:** se le metió a propósito una regla abierta y la prueba la detectó.

## Etapa 8 (1/2) · Identidad ORDEVA
- **Íconos nuevos:** favicon (SVG y PNG), ícono de iPhone, y el acceso directo de la web, que ahora se llama
  **«ORDEVA Web»**.
- **Título de la página:** «ORDEVA», también en el acceso directo de iPhone y Android.
- **Pantalla de inicio:** el logo de ORDEVA con «Tu negocio en orden».
- **Ícono de la app Android** (sale en la próxima versión del APK).
- **Íconos viejos:** `icons/vento-*` se quedan para no romper accesos directos ya instalados.
- **Sin tocar:** ids, claves de almacenamiento, funciones del servidor y el paquete de Android.
- **Falta (2/2):** cambiar «Vento» por «ORDEVA» en los textos de las pantallas (unas 1.300 menciones en las páginas). Se hará junto con
  el nombre de la app Android, para que las instrucciones («busca ORDEVA en Acceso a notificaciones») coincidan con lo
  que el celular muestra.

## Etapa 9 · Limpieza
- **R9:** supabase-js fija en 2.117.2 (la misma de las pruebas). Antes cargaba «la última 2.x» del CDN.
- **Repaso de GitHub:** pasa de cada 10 minutos a respaldo cada hora. El de verdad corre cada 5 minutos dentro de
  Supabase.
- **README al día:** canales del servidor (sin ntfy), pagos, links `/ORDEVA/` y seguridad.
- **Pruebas de la app en GitHub:** se agregan `alertaspagos` y `clavelocal` a las críticas.

## Arreglo de la 1.56.0 (antes de publicarla)
- Al abrir la app se agregaba un campo vacío `qrCodigos` a los datos del negocio aunque no hubiera códigos de mesa
  que guardar. La prueba `practica` («los datos quedan EXACTAMENTE igual») lo detectó en la batería completa. Ahora el
  campo solo se crea cuando hay un código que guardar. Por eso la 1.56.0 se publica junto con la 1.57.0.

## Pruebas
- **Servidor:** las 20 baterías pasan (814 comprobaciones), con 4 nuevas: aislamiento 9, iacupo 6, wompi 18 y
  nequiconecta 16.
- **App nuevas:** `alertaspagos` 13 y `clavelocal` 6.
- **App relacionadas (todas bien):**
  - `avisosandroid` 15: se ajustó para buscar la sección de MacroDroid por su título;
  - `pagosaviso` 94;
  - `confirmapago` 61;
  - `ajustesorden` 17;
  - `desplazamiento` 10;
  - `appoweb` 25: ahora espera «ORDEVA Web»;
  - `entrar` 35;
  - `adminreal` 44;
  - `canalvivo` 17;
  - `iaclave` 34;
  - `recuperacion` 25;
  - `cerrarcaja` 26;
  - `puertabloqueo` 12;
  - `holaapk` 10;
  - `practica` 25, `canalseguro` 16 y `herramientas` 28 (después del arreglo de `qrCodigos`).
- **No probado aquí:**
  - la función `vento-ia` (corre en Supabase; el arnés local solo corre `vento-pagos` y `vento-suscripciones`);
  - las alertas en un celular real.
