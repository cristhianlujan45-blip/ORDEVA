# Auditoría completa de ORDEVA · 1.59.0 (24-oct-2026)

**Alcance:** web, iPhone/iPad, Android, Windows y Mac, el panel ORDEVA Admin, y los errores y el soporte.

**Leyenda:**
- ✅ arreglado en esta versión;
- 🟢 revisado, ya estaba bien;
- ⚠️ pendiente (lo puedo hacer yo);
- 👤 necesita algo de ti (una cuenta, un pago o un clic);
- ℹ️ límite del equipo que no se puede cambiar.

**Cómo se revisó:**
- con pruebas automáticas (92 baterías de la app + las del servidor);
- con un navegador real en tamaño celular, tablet y computador;
- con una revisión automática de todo el código contra Safari de iPhone;
- con mediciones con el procesador 4 veces más lento (como un celular de gama media) y con 4G lento.

**No se probó en equipos físicos** (iPhone, Mac, Windows, celular Android bloqueado). Para eso están las guías de
prueba.

---

## 1. Página web (la que usan todos)
| | Hallazgo | Estado |
|---|---|---|
| ✅ | **Abrir era lento:** todo el código (2,2 MB) iba dentro de index.html y el celular lo volvía a preparar cada vez. Ahora son 30 archivos que el celular guarda ya preparados. | Listo: abre en **1,25 s en vez de 1,85 s** (−33 %). La pausa más larga al abrir baja de 0,40 a 0,25 s. |
| ✅ | Una librería de afuera (html2canvas, para la imagen del recibo) se cargaba **antes** que casi toda la app. Si esa página externa estaba lenta o caída, ORDEVA se quedaba en blanco esperándola. | Ahora se carga sin frenar nada. |
| 🟢 | 9 páginas (app, meseros, pedidos QR, preparación, TV, admin, tipos de negocio, 404, licencias) × celular, tablet y computador: **sin errores, sin archivos perdidos, nada se sale de la pantalla**. | — |
| 🟢 | Claves en el código: solo hay claves públicas, que pueden estar ahí. Nunca la clave secreta del servidor. | — |
| 👤 | La clave de YouTube es pública por diseño, pero cualquiera puede usarla si no se restringe a tu página. | Pasos en la sección 8. |
| 👤 | La dirección vieja `…/cuentas/` no lleva sola a `…/ORDEVA/`. | Pasos en la sección 8. |
| ⚠️ | Con 4G lento la primera vez tarda unos 6 s (son 760 KB comprimidos). | Siguiente paso: guardar la app en el celular (sección 9.1). |

## 2. iPhone y iPad (Safari, agregado a la pantalla de inicio)
| | Hallazgo | Estado |
|---|---|---|
| ✅ | **Revisión automática de todo el código** contra Safari de iOS 15.4–16.3. No hay nada que tumbe la app al abrir (expresiones de iOS 16.4+, `static {}`, funciones de iOS 16+). | Listo, y queda como prueba (`pruebas/iphone.test.js`): si alguien agrega algo así, la prueba dice el archivo y la línea. |
| ✅ | En iPhone con **iOS 15 y 16.0–16.1**, Safari no entiende los colores mezclados (`color-mix`). Se perdían fondos, bordes y el botón resaltado (126 reglas). | Ahora se calculan con los colores del tema. En los demás equipos no hace nada. |
| ✅ | No había instrucciones para instalar en iPhone. | Ajustes → Instalar ORDEVA → «📱 iPhone o iPad»: agregar a inicio y activar notificaciones. En iPhone se abre sola. |
| 🟢 | **Avisos de pago con la app cerrada (Web Push):** ya existían. La app explica que en iPhone primero hay que agregarla a la pantalla de inicio. | Requiere iOS 16.4 o más nuevo. |
| ℹ️ | El iPhone **no deja que ninguna app lea las notificaciones de Nequi o DaviPlata**. | Esa lectura la hace un celular Android del negocio, y el iPhone recibe los pagos al instante. |
| ℹ️ | En iPhone no hay conexión directa por USB o Bluetooth a la balanza, la impresora o el cajón (Safari no lo permite). | Para eso: el computador o la app Android. |
| ⚠️ | No probado en un iPhone real: aquí solo hay el motor de Chrome. | Prueba sugerida: abrir, entrar, vender, cobrar y recibir un aviso de pago con la app cerrada. |

## 3. App Android
| | Hallazgo | Estado |
|---|---|---|
| ✅ | **Cierres de la app** (error de Java) y **la página que Android cierra por falta de memoria**: no le llegaban al Admin. | Ahora quedan anotados y se mandan al volver a abrir, con su pila (📲 en 🐞 Errores). Compilado en GitHub. |
| ✅ | El nombre de la descarga decía «Vento para Android». | Dice «ORDEVA para Android» desde la próxima versión. |
| ✅ | El taller de GitHub podía publicar una app desde una rama de prueba. | Solo publica desde la rama principal. |
| 🟢 | Lectura de avisos de pago, servicio de fondo, voz, actualización sola: ya probados (Java, 284 comprobaciones). | — |
| ⚠️ | **Para Play Store (cuando decidas):** | Nada de esto afecta la descarga desde GitHub. |
| | • subir la versión de Android de destino (`targetSdk` 34 → 35/36): cambia cómo se dibuja bajo la barra de arriba y hay que revisarlo; | |
| | • declarar ante Google para qué se usan el acceso a notificaciones, la ventana sobre otras apps y el servicio de fondo; | |
| | • quitar la actualización sola desde GitHub (Play no la permite: se actualiza por Play); | |
| | • excluir de las copias de seguridad de Android la llave de este celular (`allowBackup`). | |

## 4. Programa para Windows
| | Hallazgo | Estado |
|---|---|---|
| ✅ | **El motor del programa (Electron 33) ya no recibía arreglos de seguridad.** Su navegador interno tenía 2 años de parches atrasados. | Actualizado a **Electron 44.9.3** (con soporte). Probado con el programa de verdad: 14/14. |
| ✅ | Errores del propio programa (no de la página) y la página caída: no le llegaban al Admin. | Ahora sí, con su pila. |
| 🟢 | Seguridad de la ventana: aislada de la computadora, solo abre ORDEVA, y los enlaces de afuera van al navegador. | — |
| 👤 | Aviso «Windows protegió su PC» la primera vez. | Se quita con un **certificado de firma de código** (pago anual, sección 8). |

## 5. Programa para Mac
| | Hallazgo | Estado |
|---|---|---|
| ✅ | **En Mac no habrían funcionado Cmd+C, Cmd+V, Cmd+Z ni Cmd+Q** (el programa quitaba el menú, y en Mac los atajos viven en el menú). | Menú mínimo de Mac (ORDEVA, Editar, Ver, Ventana). Windows sigue sin menú. |
| ✅ | «Abrir ORDEVA al prender el computador» en Mac abría la ventana en vez de quedarse junto al reloj. | Se abre escondido. |
| ✅ | No había programa para Mac. | ORDEVA-Mac.dmg: Intel + Apple (M1–M4). GitHub comprueba la firma local, que abre y que el .dmg está sano. |
| 👤 | Sin firma de Apple: hay que abrirlo la primera vez con clic derecho → Abrir, y no se actualiza solo. | Cuenta de desarrollador de Apple (99 USD al año, sección 8). |

## 6. Errores y soporte (lo que pediste)
- **🐞 Reportar un problema** está en Más y en Ajustes → Guía y soporte:
  - la persona escribe qué pasó y puede agregar un pantallazo;
  - llega a ORDEVA Admin → 🐞 Errores como «📝 Reportado por el cliente», con los **códigos E-XXXX** de los errores que tuvo ese equipo justo antes, la versión y el equipo;
  - también queda como caso de soporte, y la respuesta le llega en la app.
- **Lo que ya llegaba solo** sigue igual: errores de la página, música que no suena, pedidos QR sin confirmar y avisos de banco que ORDEVA no entendió.
- **Lo nuevo que llega solo:**
  - los cierres de la app Android;
  - los errores del programa de PC y Mac;
  - los errores del propio panel Admin.
- **En el Admin, cada error trae:**
  - 🧠 **Qué significa** (en palabras);
  - 📍 **Dónde** (archivo, línea y la parte del código);
  - **📋 Copiar para arreglar**: un texto con todo (código, mensaje, qué significa, dónde, pila, equipos y versiones), listo para pegarlo y arreglarlo;
  - filtros «📝 Reportados por el cliente» y «📲 Del programa / app Android»;
  - el equipo claro: iPhone, iPad, Mac, PC, app Android o navegador.
- **Privacidad:** nunca van ventas, productos, clientes ni contraseñas, igual que antes.
- **Probado de punta a punta** con la base de datos y el servidor reales: `erroresreal` 30/30.

## 7. Servidor y base de datos
- 🟢 Ya auditados en las etapas 4 y 7, con pruebas que siguen pasando:
  - aislamiento entre negocios en todas las tablas;
  - RLS;
  - límites de Laya;
  - canales;
  - Wompi;
  - Nequi Conecta;
  - DIAN.
- 🟢 Esta versión **no cambia el servidor ni la base de datos**: el reporte de problemas usa lo que ya existía.

---

## 8. Lo que necesita de ti
1. **Clave de YouTube** (5 minutos):
   1. Entra a console.cloud.google.com → APIs y servicios → Credenciales.
   2. Abre la clave que empieza por `AIzaSyCQ_IK…`.
   3. En «Restricciones de aplicaciones» elige **Sitios web** y agrega `https://cristhianlujan45-blip.github.io/*`.
   4. En «Restricciones de API» deja solo **YouTube Data API v3**.
   5. Guarda.
2. **Dirección vieja → nueva:**
   1. En GitHub crea un repositorio público llamado `cuentas` en tu cuenta. El actual se renombró a ORDEVA, así que el nombre está libre.
   2. Súbele un `index.html` que lleve a `https://cristhianlujan45-blip.github.io/ORDEVA/` (te lo preparo cuando lo crees).
   3. Activa Pages en ese repositorio.
3. **Firma de Windows** (opcional, pago anual): un certificado de firma de código (Certum, Sectigo, Azure Trusted Signing…) para que no salga «Windows protegió su PC». Con el certificado lo conecto al taller de GitHub.
4. **Firma de Mac** (opcional, 99 USD al año): cuenta de desarrollador de Apple. Con ella:
   - el programa abre sin clic derecho;
   - se actualiza solo en Mac;
   - lo conecto al taller (notarización).
5. **Pruebas en equipos reales**, cuando puedas:
   - pagos con el celular bloqueado (`puente/PRUEBA-FISICA-PAGOS.md`);
   - un iPhone;
   - un Mac;
   - un computador con Windows.

## 8b. Pendiente encontrado en las pruebas
- ⚠️ **La prueba `cuentas` falla al azar, igual en la versión anterior:**
  - a veces un segundo celular de la misma cuenta lee los datos antes de que terminen de llegar;
  - sale el error «Cannot read properties of null (reading 'products')» y ese celular no muestra lo del otro hasta
    recargar.
  - Pasa en la 1.58.2 y en la 1.59.0 (no viene de estos cambios). Siguiente arreglo sugerido.

## 9. Qué más mejoraría después de esto (en orden)
1. **Que ORDEVA abra al instante y sin internet.**
   - Guardar la app en el celular la primera vez, y que las siguientes abra desde ahí mientras revisa si hay versión nueva. El aviso «Hay una versión nueva» ya existe.
   - Bajaría la apertura de ~1,3 s a casi nada y abriría aunque se caiga el internet.
   - Hay que hacerlo con cuidado para que nadie quede con una versión vieja.
2. **Partir más el archivo principal** (`app/04-principal.js`, 950 KB) por pantallas: mesas, inventario, pagos, música…
   - Cada parte cargaría solo cuando se usa: abrir más rápido, y arreglos más seguros porque cada cosa está en su lugar.
3. **Resumen diario de errores en tu celular:** «hoy: 3 errores nuevos, 1 en varios negocios», con el botón para verlos.
4. **Pantallazo automático en «Reportar un problema»:** foto de lo que se veía en la pantalla, sin que la persona tenga que tomarla.
5. **Preparar Play Store** cuando lo decidas (sección 3).
6. **Probar en Safari de verdad:**
   - una prueba automática con el motor de Safari (WebKit) en GitHub, además de Chrome;
   - así cada cambio se revisa también como en un iPhone.
