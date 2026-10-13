# Servidor Vento: pagos con Nequi y DaviPlata

```
 NEQUI ──► Nequi Conecta (API oficial) ─┐
 DAVIPLATA ─► Pago con DaviPlata (API) ─┤
                                        ├──► SERVIDOR VENTO ──► base de datos ──► Vento app ──► celulares autorizados
 DAVIPLATA ─► Wompi (pasarela oficial) ─┘    (Supabase Edge       (Postgres +       (tiempo real,     (dueño, caja,
 NEQUI ─────► Wompi (pasarela oficial) ─┘     Function)            seguridad RLS)    push, historial)   meseros…)

 Auxiliar: notificación de la app del banco reenviada desde un celular autorizado (MacroDroid) ─► mismo servidor
```

## Qué integración usa cada entidad (fuentes oficiales)

| Entidad | Mecanismo oficial | Qué hace Vento |
|---|---|---|
| **Nequi** | **Nequi Conecta**, la API de Nequi para negocios ([conecta.nequi.com.co](https://conecta.nequi.com.co)): token OAuth2, cobro push, QR dinámico, consulta de estado. | Cobro push al celular del cliente y QR de Nequi. Consulta el estado hasta que Nequi responde `35` (pago realizado). |
| **Nequi** | **Wompi**, la pasarela de Bancolombia ([docs.wompi.co](https://docs.wompi.co)), método `NEQUI`. | Link o QR de pago, evento firmado `transaction.updated` y consulta por referencia. |
| **DaviPlata** | **Wompi**, método `DAVIPLATA` (el cliente confirma con un código OTP en la página de Wompi). | Igual que Nequi por Wompi. |
| **DaviPlata** | **API «Pago con DaviPlata»** de Davivienda ([conectesunegocio.daviplata.com](https://conectesunegocio.daviplata.com), API 37): token OAuth2, compra, código OTP al celular del cliente y confirmación. Requiere convenio con Davivienda y certificado (TLS mutuo). | **Cobro con código** desde la mesa: DaviPlata responde «Aprobado» con su número de aprobación y el pago queda verificado. Ver [DaviPlata: API oficial](#daviplata-api-oficial-pago-con-daviplata). |

Vento **no** entra a las apps bancarias ni usa APIs no autorizadas.

## Qué hace el servidor (`functions/vento-pagos`)

**Detección automática.** Al llegar un evento, el servidor sigue estos pasos:
1. Identifica la entidad: Wompi por la ruta y la firma, Nequi por el cobro que se creó, aviso del celular por el token.
2. Valida la autenticidad:
   - **Wompi:** firma SHA-256 con el secreto de eventos, revisada en el cuerpo y en `X-Event-Checksum`, comparada en tiempo constante.
   - **Nequi:** consulta directa a Nequi.
   - **DaviPlata (API):** respuesta «Aprobado» de `confirmarCompra`, por TLS mutuo con el certificado del comercio.
   - **Aviso del celular:** token del dispositivo.
3. Normaliza el formato, guarda el evento en el log y detecta duplicados por huella única.
4. Aplica el estado con reglas:
   - un pago aprobado no vuelve a pendiente;
   - si el valor pagado no coincide con el cobro, el pago queda en error.
5. Asocia el pago a la mesa del cobro.
6. Avisa a los celulares en tiempo real (Supabase Realtime) y con Web Push cifrado (RFC 8291 y RFC 8292).
7. Deja todo en el historial y la auditoría.

**Idempotencia y reintentos.**
- Tocar dos veces «Cobrar» crea un solo cobro (clave de idempotencia).
- Un mismo evento repetido no cambia nada.
- Las consultas reintentan con espera creciente; la creación de cobros no se reintenta sola, para no cobrar dos veces.

**Sin depender del webhook.**
- Mientras un cobro está pendiente, los celulares abiertos le piden al servidor que consulte a Wompi o Nequi.
- GitHub Actions repasa cada 10 minutos.
- Los cobros vencen a los 30 minutos.

**Seguridad.**
- Las credenciales se cifran con AES-256-GCM antes de guardarse; la app nunca las lee.
- RLS en todas las tablas.
- Roles:
  - **Configurar:** dueño y administrador.
  - **Cobrar:** dueño, administrador, caja y mesero.
  - **Registrar en la caja:** dueño, administrador y caja.
- CORS solo para el sitio de Vento.
- Los logs no guardan secretos.

## Rutas

| Ruta | Quién | Para qué |
|---|---|---|
| `GET /salud` | cualquiera | Estado y versión del servidor. |
| `GET /push-clave` | cualquiera | Llave pública VAPID; se crea sola la primera vez. |
| `POST /config` | sesión | Consultar el estado, conectar Wompi, Nequi Conecta o DaviPlata (`guardar_daviplata`), verificando con la entidad; comprobar o desconectar. |
| `POST /cobro` | sesión | Crear un link de Wompi, un cobro push de Nequi, un QR de Nequi o un cobro DaviPlata con código (`canal: "otp"`). |
| `POST /confirmar` | sesión | Confirmar un cobro DaviPlata con el código que le llegó al cliente. |
| `POST /estado` | sesión | Consultar ya el estado de un pago. |
| `POST /sync` | sesión o `X-Vento-Cron` | Repasar los pagos pendientes. |
| `POST /webhook/wompi/{token}` | firma de Wompi | Eventos de Wompi. |
| `POST /aviso/{token}` | token del dispositivo | Aviso reenviado desde el celular (auxiliar). |

## Base de datos (`migrations/`)

| Tabla | Qué guarda |
|---|---|
| `pago_proveedores` | Credenciales cifradas y estado de Wompi, Nequi Conecta y la API de DaviPlata. |
| `pagos` | Cada cobro o pago: estado, método, mesa, verificado y aplicado. |
| `pago_eventos` | Log de todo lo que llega, con su huella para detectar duplicados. |
| `dispositivos` | Celulares autorizados (solo el hash del token) y su suscripción push. |
| `auditoria` | Quién configuró, cobró, registró o revocó. |
| `servidor_config` | Llaves VAPID. |
| `daviplata_consecutivos` | Último `idTransaccion` de DaviPlata por terminal de Redeban (compartido por todos los negocios que la usen) y de qué día (Bogotá). |

## Despliegue (automático)

`.github/workflows/servidor-vento.yml` hace todo:
- aplica las migraciones;
- configura los secretos internos (sitio, CORS, secreto del repaso);
- despliega la función;
- comprueba que responda;
- escribe la URL y la clave **pública** en `nube/config.js`, para que todos los celulares queden conectados.

La llave de cifrado se deriva sola de la llave de servicio del proyecto.

**Lo único que hace el dueño (autorizaciones que solo él puede dar):**

1. **GitHub → Settings → Secrets and variables → Actions:** agregar `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF` y `SUPABASE_DB_PASSWORD`. Luego, en **Actions → Servidor Vento → Run workflow**.
2. **En Vento → Ajustes → 💜 Pagos → Conectar Nequi / Conectar DaviPlata,** pegar las credenciales de su cuenta:
   - **Wompi:** las 4 llaves de *Desarrolladores*.
   - **Nequi Conecta:** Client ID, Client Secret, API Key y código de comercio.
   - **DaviPlata (API):** Client ID, Client Secret, certificado y llave (o el puente), idComercio e idTerminal.

   Vento las verifica con la entidad antes de guardarlas.
3. **(Recomendado)** Pegar la **URL de Eventos** que muestra Vento en Wompi → Desarrolladores. Sin este paso igual funciona, porque Vento consulta el estado, pero los avisos tardan unos segundos más.

## Variables opcionales del servidor

| Variable | Para qué |
|---|---|
| `VENTO_CIFRADO_CLAVE` | Llave AES propia (32 bytes en base64). Si no se define, se deriva sola. |
| `VENTO_ORIGENES`, `VENTO_SITIO`, `VENTO_CRON_SECRETO` | Las pone el flujo de despliegue. |

## DaviPlata: API oficial «Pago con DaviPlata»

Código: `functions/vento-pagos/daviplata.ts` (cliente de la API), rutas en `app.ts`, migración
`migrations/20261008000000_daviplata_api.sql`, puente `puente/daviplata-worker.js`.

**Requisitos (los consigue el dueño con Davivienda):**
- Convenio «Pago con DaviPlata» con Davivienda y la aplicación creada en el Developer Portal
  ([conectesunegocio.daviplata.com](https://conectesunegocio.daviplata.com)) con el producto «Pago con DaviPlata»: **Client ID**
  (Consumer Key) y **Client Secret** (Consumer Secret).
- El **certificado** de la aplicación (Guía de inicio → paso 4 «Descargar certificados»: un `.cer` y su llave `.pem`). Hay uno para
  laboratorio y otro para producción.
- **idComercio** e **idTerminal**, que asigna Redeban (en laboratorio son fijos: `0010203040` y `ESB10934`).

**Flujo (no hay webhook):**

| Paso | Llamada | Qué hace Vento |
|---|---|---|
| 1 | `POST /oauth2Provider/type1/v1/token` (form-urlencoded, `scope=daviplata`) | Token OAuth2. Se guarda en memoria hasta `expires_in − 60 s`. Si el portal lo rechaza (401), pide otro y repite una vez. |
| 2 | `POST /daviplata/v1/compra` `{valor: "12000", numeroIdentificacion, tipoDocumento: "01"/"02"/"04"}` | Crea el pago «pendiente» (canal `otp`, `id_externo` = `idSessionToken`, vence en `fechaExpiracionToken`). Del documento solo guarda el tipo y los 4 últimos dígitos. DaviPlata le manda un código al celular del cliente. |
| 3 | `POST /otpSec/v1/read` (**solo laboratorio**) | Lee el código de prueba y se lo muestra a la caja para poder probar. En producción no se llama. |
| 4 | `POST /daviplata/v1/confirmarCompra` `{otp, idSessionToken, idComercio, idTerminal, idTransaccion}` | `idTransaccion` es un entero 1–999999 único por terminal y por día (`srv_daviplata_consecutivo`, atómico, se reinicia a medianoche de Bogotá). Con `estado: "Aprobado"` el pago queda **aprobado y verificado**, con `numAprobacion` e `idTransaccionAutorizador` en el detalle, y avisa a los celulares. |

- La **notificación del pago** es la respuesta «Aprobado» de `confirmarCompra`: llega en el mismo momento en que la caja
  confirma el código. Así se le explica al dueño en la app.
- **Código equivocado:** el pago sigue pendiente y se cuentan los intentos; al tercero queda **rechazado**.
- **Idempotente:** confirmar otra vez un pago aprobado lo devuelve sin volver a llamar a DaviPlata. Dos celulares que
  confirman a la vez: solo uno llama a DaviPlata (turno de 180 s en `pagos.confirmando_hasta`, más que la peor confirmación posible).
- **Vencido:** si el código ya venció (o DaviPlata responde 4001 «Objeto No existe en la cache») el pago queda **vencido**.
- **Sin respuesta de DaviPlata al confirmar** (se cortó la red o venció el tiempo después de mandar `confirmarCompra`, el
  puente no alcanzó a DaviPlata, error interno/timeout de DaviPlata, el servidor se cayó a mitad de camino): DaviPlata **pudo
  haber aprobado**. El `idTransaccion` queda anotado en el pago (`pagos.confirmando_tx`) ANTES de llamar a DaviPlata; si no
  llega una respuesta clara el pago queda `incierto` y sigue pendiente: se puede reintentar con el **mismo** código (si la
  primera no llegó, se aprueba). Si al final DaviPlata dice 4001/rechazado, o el código vence, el pago queda **«error · Sin
  confirmar: revisa con el cliente»**, nunca «vencido»/«rechazado», para que la caja no le cobre dos veces. La confirmación
  no se reintenta sola. Si DaviPlata aprobó pero la base no se pudo actualizar, se reintenta y, si aun así falla, la caja ve
  «DaviPlata APROBÓ (N.º …) … NO le cobres otra vez» y el registro `daviplata_aprobado_sin_guardar` queda en los Logs.
- **Errores en español:** 1304/321 → «Ese documento no tiene DaviPlata»; «Saldo insuficiente»; 401 «Autenticacion
  Denegada» → «El código no es correcto»; 2100/2103/3200/91/5xx → «DaviPlata no está disponible» (en laboratorio, fuera
  de horario: «solo atiende de lunes a viernes de 8:00 a 17:00»); 401 de mTLS → certificado sin cargar o equivocado;
  `invalid_client` / `invalid_scope` → Client ID/Secret o producto sin inscribir.
- Los registros nunca guardan secretos, tokens, certificados ni el número de documento completo.

**TLS mutuo: directo o por el puente.** DaviPlata exige el certificado de cliente en **todas** las llamadas (sin él responde
401 «Application is not registered with mutual tls» o «Invalid client certificate is provided»).
- **Directo:** la función usa `Deno.createHttpClient({ cert, key })` (también prueba los nombres viejos `certChain` /
  `privateKey`). El certificado y la llave se suben como archivos en Ajustes y se guardan cifrados. Si el entorno de la función
  no permite certificados de cliente, Vento lo dice con un mensaje claro: «usa el puente».
- **Puente (Cloudflare Worker, plan gratis):** `puente/daviplata-worker.js` presenta el certificado con el enlace
  `mtls_certificates` de Cloudflare y reenvía **solo** las 4 rutas a `apislab.daviplata.com` / `apis.daviplata.com`. Vento le
  habla con un secreto compartido en la cabecera `X-Vento-Puente`. Instalación:

  ```bash
  # el .cer en PEM (si es binario):  openssl x509 -inform der -in BancoDaviviendalab_2022.cer -out daviplata-lab.pem
  npx wrangler mtls-certificate upload --cert daviplata-lab.pem --key BancoDaviviendalab_2022.pem --name daviplata-lab
  # puente/daviplata-wrangler.jsonc:
  #   { "name": "vento-daviplata", "main": "daviplata-worker.js", "compatibility_date": "2025-01-01",
  #     "mtls_certificates": [ { "binding": "DAVIPLATA", "certificate_id": "<id de producción>" },
  #                            { "binding": "DAVIPLATA_LAB", "certificate_id": "<id de laboratorio>" } ] }
  npx wrangler secret put VENTO_PUENTE_SECRETO -c daviplata-wrangler.jsonc     # ≥ 16 caracteres, el mismo que se pega en Vento
  npx wrangler deploy -c daviplata-wrangler.jsonc
  ```

  En Vento: **Conectar DaviPlata → Conexión segura: «Por mi puente de Cloudflare»**, con la URL del Worker y el secreto.

**Laboratorio:** `https://apislab.daviplata.com`, de **lunes a viernes de 8:00 a 17:00** (hora de Colombia). Datos de prueba:
CC `01` 1134568019 · CE `02` 786630 · TI `04` 1389123506 (usa valores pequeños). La data propia de pruebas se le pide al
banco (Coordinación de Integración). **Producción:** `https://apis.daviplata.com`, con los códigos propios de Redeban.

| Variable opcional | Para qué |
|---|---|
| `VENTO_DAVIPLATA_URL_SANDBOX`, `VENTO_DAVIPLATA_URL` | Cambiar la base de la API (solo para pruebas). |

## Pruebas hechas

- **Servidor:** 68 casos contra PostgreSQL 16 real, con Wompi, Nequi y el servicio push simulados. Incluyen:
  - firma válida, alterada y de otro secreto;
  - eventos duplicados;
  - valor distinto al cobrado;
  - Wompi caído con reintentos;
  - cobro push y QR de Nequi (estado 35);
  - llaves mezcladas de prueba y producción;
  - roles, revocación de celulares y CORS;
  - push cifrado, descifrado con `http_ece` y firma VAPID verificada.
- **App + servidor + base de datos:** 19 casos en el navegador con dos celulares a la vez:
  - el dueño conecta DaviPlata;
  - cobra la mesa 3 con QR;
  - llega el evento firmado;
  - se registra **una sola vez** en la mesa;
  - un aviso de DaviPlata se recupera al reconectarse.
- **Revisión de tipos:** `deno check` y `deno lint` sin errores.
- **DaviPlata (API oficial):** `node pruebas/servidor/daviplata.test.js` (82 casos contra PostgreSQL 16 real, con DaviPlata
  simulado que revisa las cabeceras y los cuerpos exactos de la especificación): credenciales cifradas que nunca se devuelven,
  token en caché, compra → pendiente, código de prueba solo en laboratorio, código equivocado (rechazado al tercero), aprobado
  una sola vez con push, confirmación doble y simultánea, consecutivo por terminal y día, errores traducidos, roles, modo
  directo (`Deno.createHttpClient`), `mtls_no_disponible` y el puente con el Worker de verdad. En el navegador:
  `pruebas/daviplatacobro.test.js` (configurar en Ajustes y cobrar una mesa con código → registrada una vez).

## Suscripciones de Vento (beta, `functions/vento-suscripciones`)

Cobro de la suscripción de **Vento** a cada negocio (no confundir con `pagos`, que son cobros a los clientes del negocio).
La suscripción es de la **cuenta + el negocio** (`negocios.id`), una sola fila por negocio, y el plan lo decide **siempre el
servidor**: la app consulta `POST /estado` y recibe un token firmado (ECDSA P-256, llave en `servidor_config` → `sub_firma`,
se crea sola) que le sirve sin internet hasta 72 h.

- **Migración** `20261005000000_suscripciones.sql`: `plans` (única fuente de precios), `entitlements`, `plan_entitlements`,
  `billing_config`, `platform_admins`, `subscriptions`, `payment_records`, `payment_proofs`, `payment_events` y el bucket
  privado `comprobantes`. RLS en todo; solo las funciones `srv_*` (servidor) escriben.
- **Flujo beta:** prueba gratis automática (PRO, `trial_days`) → la persona paga por Nequi o DaviPlata al número de Vento y
  envía la foto del comprobante (`POST /pago`) → queda **en revisión** (no activa nada) → un proveedor de Vento la aprueba o
  rechaza en el panel (`/admin/*`). Aprobar suma `interval '1 month'` desde hoy, o desde el vencimiento actual si es una
  renovación. Vencimiento al consultar y con el cron `/vencer` cada 10 minutos.
- **Anti-duplicados:** misma idempotencia → mismo pago; la misma referencia (por método) o la misma foto (sha256) no sirven
  para dos pagos vigentes; un solo pago en revisión por negocio; aprobar bloquea la fila (dos administradores a la vez →
  una sola activación). La foto se sube primero y el pago se guarda con su comprobante en una sola transacción: si Storage
  falla no se crea el pago.
- **Medios de pago:** interfaz `PaymentProvider` (`proveedores/`): `manual` (ahora) y `google_play` (solo arquitectura:
  responde 501 hasta que exista `GOOGLE_PLAY_PACKAGE` + `GOOGLE_PLAY_SERVICE_ACCOUNT` y `beta_mode = false`).
- **Administradores:** usuarios en `platform_admins`, o cuyo correo (confirmado) esté en el secreto opcional
  `VENTO_ADMIN_EMAILS` (GitHub → Secrets → `VENTO_ADMIN_EMAILS`, separados por comas): entran solos la primera vez.
- **Otros servicios** pueden hacer cumplir el plan con `negocio_tiene(negocio, 'voice' | 'ai_camera' | …)`.

| Ruta | Quién | Para qué |
|---|---|---|
| `GET /planes`, `GET /clave`, `GET /salud` | cualquiera | Catálogo y números de pago; llave pública del token. |
| `POST /estado` | cualquier miembro | Plan efectivo, funciones, pago pendiente/último, aviso de renovación y token firmado. |
| `POST /pago` | dueño o administrador | Pago con comprobante (JPEG/PNG/WebP ≤ 3 MB). |
| `POST /admin/…` | administrador de Vento | `yo`, `pagos`, `comprobante`, `aprobar`, `rechazar`, `suscripciones`, `negocios`, `negocio`, `cancelar`, `cambiar_plan`, `dar`, `planes`, `plan_guardar`, `config_guardar`. |
| `POST /vencer` | `X-Vento-Cron` | Vence las suscripciones con fecha pasada. |
| `POST /google-play/rtdn` | — | 501 mientras sea beta. |

Pruebas: `node pruebas/servidor/suscripciones.test.js` (141 casos contra PostgreSQL 16 real con `pruebas/servidor/supabase-local.js`).
