# ORDEVA · Auditoría del proyecto (etapas 1 y 2)

Revisada el 23 de octubre de 2026 sobre el código publicado (versión 1.55.5, app Android 1.0.60). Cada hallazgo dice
**dónde está** (archivo:línea) y **cómo se comprobó**. Se distingue entre:
- **probado**: hay una prueba automática que pasa;
- **revisado en el código**: leído, sin prueba que lo ejercite;
- **no verificado**: no se pudo comprobar desde aquí, por ejemplo en celulares físicos.

## 1. Resumen
**Qué es hoy.** Una plataforma completa para negocios:
- **Ventas:** POS, mesas, cuentas, pedidos por QR, meseros, preparación y TV con música.
- **Operación:** inventario con recetas, caja con arqueo y cierre, contabilidad, fiados, facturación DIAN, pagos
  Nequi/DaviPlata/Wompi y suscripciones.
- **Equipo y asistente:** permisos por rol, Laya IA y apps de Android y PC.
- **Datos:** el negocio vive en un documento JSON en Supabase, que se proyecta a tablas para los reportes.

**Lo más urgente, por riesgo:**

| # | Riesgo | Dónde | Severidad | Etapa |
|---|---|---|---|---|
| R1 | **Un pedido falso entra a la cuenta de cualquier mesa.** Quien escaneó un QR del negocio (sabe el canal) puede mandar pedidos para cualquier número de mesa, y por defecto se suman solos a la cuenta. No se revisa el código de la mesa. | `index.html:22075` (`pedidoEntrante`), `:22046` (`pedidosAuto` por defecto sí), `:22047` (crea mesas hasta la 500) | **Alta** | 4 |
| R2 | **Publicar en un canal no pide identidad.** El nombre del canal (que va en el QR) es la única llave. Hay límites, pero no hay autenticación. | `supabase/migrations/20261022000000_seguridad.sql:29-49` (`canal_publicar`) | **Alta** (es la causa de R1, R3 y R4) | 4 |
| R3 | **El canal de meseros ejecuta comandos de voz completos.** Quien tenga el link del mesero (por ejemplo, un mesero que ya no trabaja) puede mandar cualquier comando de la voz, no solo pedidos. | `index.html:21886-21900` (`procesarMesero` → `handleVoiceTranscript`) | **Media** | 4 |
| R4 | **El canal de preparación cambia el estado de los pedidos** sin identidad: cancelar un pedido le quita los productos a la cuenta. | `index.html:21851-21857` (`procesarPrep` → `pedidoCambiar`) | **Media** | 4 |
| R5 | **Las 102 pruebas automáticas no corren en GitHub.** Solo se revisan las migraciones antes de publicar. | `.github/workflows/servidor-vento.yml:72` | **Media** | 12 |
| R6 | **La llave de YouTube está en el código público.** Es normal para ese tipo de llave solo si está restringida por dirección en Google Cloud. Con el cambio a `/ORDEVA/` hay que revisar esa restricción. | `index.html:22605`, `pedido.html:891` | **Media** (no verificado: depende de Google Cloud) | 4 |
| R7 | **El límite de uso de Laya** vive en la memoria de una instancia del servidor y se reinicia con ella. No es un límite real compartido. | `supabase/functions/vento-ia/index.ts:23` (`new Map`) | **Media** | 7 |
| R8 | **Las contraseñas locales del celular** usan un solo SHA-256 con sal. Es débil si alguien copia el almacenamiento del celular. Las de la cuenta en la nube las guarda Supabase Auth. | `index.html:19336` (`authHash`) | Baja-media | 7 |
| R9 | **`supabase-js@2` no tiene la versión fijada:** carga la última 2.x sin aviso. | `nube/vento-nube.js:21`, `admin.html:1296` | Baja-media | 10 |
| R10 | **`_vistos` del adaptador de canales crece sin límite** mientras la conexión está abierta (un TV o una pantalla de cocina prendidos días). | `lib/vento-canal.js:148,172` | Baja | 4 |

## 2. Hallazgos de la revisión de Kimi, verificados contra el código
| Hallazgo | ¿Se confirma? | Detalle |
|---|---|---|
| `POST /canal/<canal>` no exige identidad | **Sí**, revisado en el código | `canal_publicar` es `security definer`, abierta a `anon` (`20261016000000_canales.sql:68-70`). Valida el formato del nombre y un tamaño máximo de 32 KB. Límites: 240 mensajes por minuto por canal y 6.000 por minuto en total (`20261022000000_seguridad.sql:33-39`). |
| El nombre del canal funciona como secreto | **Sí** | El canal de pedidos va en el QR (`?c=`). Los de meseros y preparación agregan un código de 8 caracteres que no está en el QR. |
| La lectura de canales es posible con `anon` | **Corregido en la 1.54.0 (D8)**, probado (`canalprivado` 17, `qrprivado` 9) | Los canales de pedidos solo los lee un miembro del negocio. |
| Riesgo de pedidos y eventos falsos | **Sí**, y es más grave de lo descrito | Ver R1: entran a la cuenta solos y para cualquier mesa. |
| Riesgo de saturación | **Parcial** | Hay topes por canal y globales. No hay tope por IP ni por dispositivo. Un atacante puede llenar el tope global y frenar a todos los negocios. |
| No hay rotación completa de canales | **Parcial** | Preparación tiene «Crear un link nuevo» (`index.html`, `prepNuevo`). El canal de pedidos del QR no se rota: rotarlo exige reimprimir los QR. |
| `vento-canal.js` intercepta fetch/XHR/EventSource | **Sí**, revisado en el código | `lib/vento-canal.js:119` (fetch), `:127` (XHR) y `:191` (EventSource). Funciona y lo cubren `canalvivo` 17 y `seguridadqr` 6, pero es implícito. |
| `_vistos` sin límite | **Sí** | Ver R10. El otro registro de la app (`vito_vistos`) sí está limitado a 1.000 (`index.html:21788`). |
| `vento-pagos/app.ts` es sólido | **Sí** | Firma de Wompi en tiempo constante, idempotencia, cifrado de credenciales y límites por rol. Probado: `daviplata` 102, `pagosprivados` 25 y `avisos` 31. |

## 3. Aplicaciones
| App | Archivo | Tamaño | Qué hace | Estado |
|---|---|---|---|---|
| App principal | `index.html` | **33.224 líneas / 2,5 MB** | Mesas, POS, productos, inventario, caja, contabilidad, música, Laya, ajustes y equipo | Implementada. 87 pruebas de la app, que **no** corren en GitHub |
| Panel del proveedor | `admin.html` | 2.660 líneas | Negocios, licencias, planes, pagos, soporte y errores | Implementada. Probada: `adminreal` 44, `adminsubreal` 39 |
| Página del cliente (QR) | `pedido.html` | 1.986 líneas | Carta, pedido, canción, su cuenta y pago | Implementada. Probada: `canalvivo`, `qrprivado`, `cuentacliente` |
| Meseros | `mesero.html` | 396 líneas | Pedidos por voz o texto desde el celular del mesero | Implementada. Ver R3 |
| Preparación | `preparacion.html` | 124 líneas | Pedidos activos y cambios de estado | Implementada. Ver R4 |
| TV | `tv.html` | 288 líneas | Reproduce la cola de canciones | Implementada. Probada: `tvocupado` y otras de música |
| Tipos de negocio | `negocios.html` | 1.007 líneas | Catálogo de tipos de negocio | Implementada |
| Licencias | `licencias.html` | 16 líneas | Página mínima | **Parcial** (solo un acceso) |
| Service worker | `sw.js` | 28 líneas | Solo avisos push; no guarda páginas | Implementado |
| App Android | `android/app` | 20 archivos, 5.536 líneas | Envuelve la página y suma lectura de avisos de bancos, voz, servicio de fondo, impresora, balanza y TV | Implementada. Pruebas de Java: `javaavisos` 224 |
| App de PC | `pc/` | Electron | Envuelve la página para Windows | Implementada. Probada: `pc` |
| Servidor | `supabase/functions` | vento-pagos 2.251 líneas, vento-ia 319, vento-suscripciones 775 | Pagos, DIAN, IA, YouTube y suscripciones | Implementado. 15 pruebas de servidor contra PostgreSQL real |
| Base de datos | `supabase/migrations` | 33 migraciones | Negocios, miembros, datos, respaldos, pagos, DIAN, canales y proyección | RLS en todas las tablas (lo comprueba `revisar-migraciones`) |

## 4. Rendimiento y dependencias
- **`index.html` de 2,5 MB** se descarga y se lee entero al abrir.
  - Partirlo en módulos que se cargan cuando se usan es la mejora de rendimiento más grande, pero también la más
    riesgosa.
  - Se debe hacer **por partes y con las pruebas corriendo en GitHub** (R5 primero).
- **El lector de facturas** (`lib/vento-ocr.js` 10 MB + PDF 1,7 MB) **ya se carga solo cuando se usa**, al entrar a
  Inventario (`index.html:24093-24100`). Revisado, correcto.
- **Librerías del CDN:**
  - `jszip@3.10.1`, `jsqr@1.4.0` y `html2canvas 1.4.1`: con la versión fijada.
  - `supabase-js@2`: sin la versión fijada (R9).
- **Android:** `targetSdk 34` (`android/app/build.gradle:17`).
  - No es obligatorio, porque el APK se instala por fuera de Play Store.
  - Para publicar en Play Store haría falta 35.
- **El repaso programado en GitHub cada 10 min** (`servidor-vento.yml:20`) ya está duplicado: los repasos corren
  dentro de Supabase desde la 1.53.1. Gasta minutos de GitHub Actions sin necesidad.

## 5. Datos y sincronización
- **Modelo:** el negocio es **un documento JSON por negocio** (`datos_negocio.datos`), guardado con control de versión
  (`guardar_datos` → `'conflicto'` si otro equipo guardó antes; `20261106000000_equipo_no_reescribe.sql:96`).
  - La app junta los cambios con una mezcla de tres vías (`nube/vento-nube.js:135`, `fusionar`). Probado:
    `sincroniza` 22, `flujocompleto` 87.
- **Tablas para reportes** (ventas, ítems, pagos, inventario, cierres): se llenan solas desde el documento cada 5 min
  (1.52.1). Usan `numeric(16,2)`. Probado: `proyeccion` 66.
- **Pagos:** `monto bigint` en pesos enteros. Es exacto para COP, que no usa centavos.
- **Respaldos:** 48 por negocio, uno por hora como máximo. Restaurarlos está probado (`respaldos` 15).
- **Puntos que pueden fallar:**
  - Un documento muy grande: cada guardado sube el documento completo.
  - Dos equipos que cambian el mismo campo a la vez: gana la mezcla de tres vías.
  - Celulares sin internet por mucho tiempo.

## 6. Android y avisos de pago
**La cadena** (revisada en el código):
1. Aviso de la app del banco.
2. `VentoEscucha` (lector de notificaciones).
3. `AvisoPago` (reglas).
4. Voz y aviso propio (`VentoApp.anunciarPago`).
5. Servidor, para los demás equipos.

**Protecciones:**
- servicio en primer plano con el procesador despierto (`VentoServicio`);
- reconexión del lector cada 10 s (1.55.4);
- barrido de la barra cada 5 s;
- motor de voz preparado de antemano;
- detección del ahorro de batería de Nequi y DaviPlata;
- arranque al prender el celular.

**No verificado:** el comportamiento en celulares físicos bloqueados. Desde la 1.55.4 cada demora se reporta al
panel con su origen («el banco lo mandó tarde» o «Vento lo leyó tarde»).

## 7. Autenticación
- **Proveedor:** Supabase Auth: correo y contraseña, código por correo, celular con código y Google.
- **Recuperación de contraseña:** probada (`recuperacion` 25, `entrar` 35). Los correos con código propio necesitan
  configurar un SMTP (secretos `VENTO_SMTP_*`, no configurados en el último despliegue).
- **Contraseña local del celular** (para entrar sin internet): ver R8.
- **Permisos en el servidor:**
  - corregidos en la 1.54.0 los huecos de invitaciones, roles y restauración;
  - el equipo no reescribe precios ni permisos (D2, 1.55.0).

  Probado: `permisos` 19, `equiponoreescribe` 20.

## 8. Pruebas
**Cuántas hay:**
- 87 pruebas de la app (navegador real);
- 15 de servidor (PostgreSQL real);
- 5 de Java (reglas de avisos, voz y ventana).

**Áreas sin prueba automática, o sin probar de verdad:**
- **Celulares físicos:** avisos con el celular bloqueado, distintas marcas y ahorro de batería.
- **Pagos reales:** contra Wompi, Nequi Conecta y DaviPlata en producción (hay simulados).
- **Ataques:** publicación falsa en los canales (R1 a R4) y saturación.
- **Integración continua:** las pruebas de la app y del servidor no corren en GitHub (R5).

## 9. Plan (etapa 2: orden por riesgo)
1. **Etapa 4: canales.**
   - **R1:** el pedido trae el código de la mesa; sin el código correcto queda «por aceptar».
   - **R3:** el canal de meseros solo acepta pedidos, no cualquier comando.
   - **R4:** la cancelación desde preparación no le quita productos a la cuenta sin confirmación.
   - **R10:** límite para `_vistos`.
   - **Más:**
     - límites por dispositivo;
     - rotación del canal de meseros y de preparación desde «Seguridad» en los ajustes;
     - pruebas de ataque.
2. **Etapa 12 adelantada:** las pruebas del servidor y de la app corren en GitHub antes de publicar (R5).
3. **Etapa 5-6:**
   - pruebas de pagos y DIAN que faltan;
   - panel «ALERTAS DE PAGOS» con el estado de permisos, batería, último aviso y prueba de sonido.
4. **Etapa 7:**
   - límites de Laya en la base de datos (R7);
   - contraseña local con PBKDF2 (R8);
   - aislamiento entre negocios.
5. **Etapa 8:** marca ORDEVA visible, con el logo ya hecho en `marca/`.
6. **Etapas 9-11:**
   - partir `index.html` por módulos;
   - fijar `supabase-js`;
   - módulos nuevos.

Lo que puede romper producción (cambios en canales que usan celulares con versiones viejas) se hace **compatible
hacia atrás**. Por ejemplo, un pedido sin código no se bota: queda «por aceptar».
