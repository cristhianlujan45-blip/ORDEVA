# ORDEVA · Caja Inteligente 2.0: táctil + teclado + voz sobre la MISMA caja

Versión **1.68.0**. Esto no es una app nueva ni una simulación. Es la caja de siempre (`lib/vento-pos.js`), con el
mismo carrito, el mismo cobro, el mismo inventario y el mismo historial, ahora manejada también con la voz y el
teclado.

---

## 1. Diagnóstico: lo que ya existía

Antes de escribir código se revisaron las herramientas de voz que ya tenía ORDEVA. Se reutiliza lo que funciona.

| Módulo | Qué hace | Cómo se usa ahora |
|---|---|---|
| `app/02-android-apk-dentro.js` | En la APK, `window.SpeechRecognition` es el reconocedor nativo de Android (puente Java) | Se reutiliza tal cual: es el «motor navegador» dentro del teléfono |
| `app/04a` `parseVoiceCommand`, `matchProductVoice`, `findProductByVoiceAlias`, `voiceAliasTermsForProduct`, `applyVoiceItems`, `ventoHablar`/`speakVoice` | Pedidos por voz para **mesas**, alias de marcas colombianas, voz en voz alta | Las mesas siguen con `applyVoiceItems` (inventario e historial de siempre). Los alias se usan como sinónimos. La respuesta hablada usa `ventoHablar` |
| `app/04b` micrófono flotante (`voiceFab`, `handleVoiceTranscript`) | Mesas, rondas, deshacer, libreta, calculadora, Laya | Se mantiene. Con la caja abierta, primero entiende la caja; **lo demás sigue igual** |
| `lib/vento-pos.js` `vozCaja` | «Dos águilas» sin mesa → carrito de la caja (solo agregar, quitar y fijar) | Se mantiene como respaldo; la Caja Inteligente lo amplía |
| `lib/vento-sonidos.js` | Sonidos discretos (tún / tic / venta), con su interruptor | Se reutiliza: lote de sonidos y el interruptor en ⚙️ |
| `app/27` roles y `app/28` `autorizar()` | Permisos del equipo y clave del dueño | Se respetan: la voz nunca reemplaza la clave |

### Problemas encontrados
1. La voz de la caja **solo agregaba, quitaba o fijaba** productos. No había:
   - preguntas («¿cuánto es?», «¿qué llevo?», precio, inventario);
   - dinero recibido ni vueltas;
   - cobro por voz;
   - pago mixto;
   - confirmaciones.
2. `matchProductVoice` siempre devuelve «el más parecido». Con «coca cola» y dos presentaciones elegía una sin
   preguntar. Con «cerveza» tomaba la primera cerveza. **Eso es inventar.**
3. No había un micrófono en la caja: se usaba el botón flotante. Tampoco había estados visibles (sin permiso, sin
   internet), ni orden escrita cuando no hay dictado, ni aviso de privacidad.
4. No había atajos de teclado: solo el lector de código de barras.

## 2. Diseño
- **Escritorio (≥1280 px):** caja a pantalla completa en **60 / 40**.
  - **Izquierda (productos):**
    - buscador con 🎤 y 📷 al lado;
    - la barra de voz: estado, lo que oyó, ⌨️, ⚙️ y ?;
    - las categorías, con **⭐ Favoritos** y el nuevo **🕘 Recientes**;
    - las tarjetas con foto, precio y stock.
  - **Derecha (venta):**
    - el carrito: cantidad, precio, subtotal, ✕, descuento, nota y 👤 cliente;
    - la **confirmación** cuando hace falta;
    - el **TOTAL** siempre a la vista y el botón **💵 COBRAR** grande;
    - debajo, los atajos F1–F9.
- **Celular:** el mismo orden en una columna, con el carrito fijo abajo. Los atajos se esconden en pantallas táctiles.
- **El botón del micrófono cambia según el estado:**

  | Estado | Cómo se ve |
  |---|---|
  | Apagado | 🎤 |
  | Escuchando | ⏹ rojo con pulso (sin animación si el equipo pide menos movimiento) |
  | Sin permiso, sin red o sin dictado | Borde punteado |

  En la barra de voz:
  - el texto del estado: 🎤 Toca o mantén · 🔴 Escuchando… · ⏳ Procesando… · ✅ Entendido · 🤔 No entendí ·
    🚫 Sin permiso · 📡 Sin internet · ⌨️ Sin dictado;
  - la **transcripción** («lo que oyó»);
  - la respuesta de ORDEVA.

## 3. Arquitectura de voz (desacoplada)

```
 micrófono 🎤 / F8 / micrófono flotante / ⌨️ orden escrita
          │
 [2] RECONOCEDOR (adaptador)  ── motores.navegador: Web Speech (Chrome/Edge) o, en la APK, el de Android
          │                     └ registrarMotor(nombre, {disponible, nombre, crear}) para otro motor
          ▼                       (por ejemplo uno local en WebAssembly) sin tocar lo demás
      texto
          │
 [1] MOTOR DE INTERPRETACIÓN (puro, sin DOM ni red: también corre en Node)
     normalizar → numerar → intención + productos + mesa + monto + método + pagos
          │
 [3] EJECUTOR con niveles de confirmación
     simple ─────────── agregar, quitar, cantidad, preguntas
     modificación ───── vaciar la venta («¿seguro?»)
     financiera ─────── cobrar caja o mesa: resumen + «Confirmar venta» (botón o «sí, confirmo»)
          │
 window.ventoPOS (el MISMO motor de ventas) ── qsRegistrarVenta · inventario · historial · recibo · cajón · DIAN
 applyVoiceItems / cobrarMesa ─────────────── mesas de siempre
```

- **No depende de una sola API:**
  - el intérprete es propio y local;
  - el reconocedor es un adaptador;
  - si no hay dictado (Electron sin servicio de voz, Firefox) o no hay internet, **la orden escrita usa el mismo
    intérprete** y funciona sin conexión.
- **Privacidad:**
  - ORDEVA **no graba ni guarda audio**, y no envía a ningún servidor propio ni el audio ni el texto;
  - **antes del primer uso** se avisa que el dictado de Chrome o Edge (o el de Android) puede enviar el audio a
    Google o Microsoft para convertirlo en texto;
  - quien no quiera eso puede escribir la orden.

## 4. Lo que entiende (español de Colombia)

### Cómo entiende las palabras
- **Números en palabras**:
  - «treinta y dos» → 32, «cincuenta y dos mil quinientos» → 52.500;
  - «media docena», «un par de»;
  - «50 lucas», «$50.000», «50k».
- **El mismo producto dicho de varias formas:**
  - plurales y tildes: «águilas» → Águila;
  - diminutivos: «aguilitas» → Águila;
  - **«polas»**, «frías», «birra» = cerveza;
  - «guaro» = aguardiente.
- **Errores del dictado:** «meza» → mesa, «neki» → Nequi, «datáfono» → tarjeta.

### Órdenes de la caja

| Qué | Ejemplos |
|---|---|
| Agregar | «dos águilas y una póker» · «agrega tres empanadas» · «dame dos polas» |
| Quitar | «quita una póker» (una) · «quita las águilas» (todas) · «quita lo último» / «deshacer» |
| Cantidad | «que sean tres águilas» · «cambia la póker a 2» · «no, eran dos» (lo último agregado) |
| Vaciar | «vacía la venta» → **pide confirmar** |
| Repetir | «repite» / «lo mismo» (la última orden) · «repite la última venta» |
| Preguntas | «¿cuánto es?» · «¿qué llevo?» · «¿cuánto vale la Coca-Cola?» · «¿cuántas águilas quedan?» |
| Recibido y vueltas | «me paga con cincuenta mil» · «con un billete de 50» · «¿cuánto devuelvo?» |
| Cobrar | «cobrar en efectivo» · «por Nequi» · «con tarjeta» · «cobrar» (pregunta cómo paga) → **confirmación** → «sí, confirmo» / «confirma la venta» / botón |
| Pago mixto | «veinte mil en efectivo y el resto por Nequi» |
| Otras | «deja la venta pendiente» · «ver pendientes» · «ponle nota sin cebolla» · «descuento» (abre la ventana con la clave del dueño) |

### Órdenes de las mesas

| Qué | Ejemplos |
|---|---|
| Agregar | «mesa 3 dos águilas» |
| Saldo y pedido | «¿cuánto debe la mesa 4?» · «¿qué tiene la mesa 2?» |
| Abrir | «abre la mesa 5» |
| Cobrar | «cobra la mesa 2 en efectivo» → **confirmación** |

### Cuándo pregunta
- **Si dudas, pregunta:**
  - con «coca cola» y dos presentaciones: «¿Cuál coca cola? Coca-Cola 400 ml o Coca-Cola 1.5 L». Se responde «la de
    400», «la grande», «la primera», o tocando el botón;
  - con «polas» y varias cervezas, pregunta cuál.
- **Nunca inventa:**
  - si el producto no existe, dice «No encontré «…»; no lo agregué»;
  - **nunca toca una mesa equivocada**: sin número pregunta «¿Cuál mesa?», y si la mesa no existe lo dice y no hace
    nada;
  - si el total cambió mientras se confirmaba, no cobra y pide repetir.

## 5. Teclado

| Tecla | Acción |
|---|---|
| F1 | Buscar (pone el cursor en el buscador) |
| F2 | Cobrar (abre «¿Cómo pagó?») |
| F3 | Cliente de la venta (con la DIAN prendida usa su ventana de cédula o NIT) |
| F4 | Suspender (o ver pendientes si la caja está vacía) |
| F5 | Limpiar la venta (**pide confirmar**) |
| F6 | Efectivo: cobro con el cursor en «¿Con cuánto paga?»; se escribe y Enter |
| F7 | Transferencia: cobro con Nequi seleccionado; Enter confirma |
| F8 | Micrófono (abre o cierra) |
| F9 | Total (lo muestra y lo dice) |
| Esc | Cancela la pregunta o confirmación de voz, cierra el micrófono, borra la búsqueda, cierra el cobro |
| Enter seguro | En los primeros 0,6 s de la ventana de cobro, un Enter (del lector o de la mano) **no cobra**. Si se escribió lo recibido, ese Enter sí cobra |

El lector de código de barras (teclado) sigue funcionando igual.

## 6. Archivos

| Archivo | Cambio |
|---|---|
| `lib/vento-caja-voz.js` (nuevo) | Motor de interpretación, reconocedores, ejecutor, interfaz de voz, atajos, estilos |
| `lib/vento-pos.js` | API para la caja inteligente; 🕘 Recientes; 👤 cliente en la venta; `data-abierto` en el cobro; enganche de `montarCaja` |
| `index.html` | `<script src="lib/vento-caja-voz.js" defer>` |
| `pruebas/cajavoz.test.js` (nueva, en CI) | 53 comprobaciones |

**Funciones nuevas en `window.ventoPOS`:**
- `cajaActiva`, `resumen`, `cuanto`, `sumar`, `fijar`, `vaciarYa`;
- `suspenderYa`, `ponerNota`, `ponerCliente`, `herramienta`, `cobrarMesa`.

Todas usan el carrito y el cobro que ya existían.

**`window.ventoCajaVoz`:**
- `motor` (normalizar, numerar, interpretar, resolverProducto, elegirCandidato);
- `procesar`, `escuchar`, `parar`, `apagar`;
- `estado`, `confirmar`, `cancelar`, `elegir`;
- `registrarMotor`, `cfg`, `ponerCfg`, `registro`, `reiniciar`.

Se cumplieron las reglas de la petición:
- sin base de datos nueva, sin migraciones y sin dependencias nuevas;
- no se tocaron las suscripciones ni los registros históricos;
- ninguna función se quitó.

## 7. Pruebas
`pruebas/cajavoz.test.js` (53 ✅). El dictado se simula con un `SpeechRecognition` falso porque el navegador de
pruebas no tiene uno. Se prueba lo que ORDEVA hace con el texto, el micrófono y sus estados.

### Micrófono y venta
- **Micrófono:** el botón, el aviso de privacidad y que el micrófono no se abra antes de aceptar.
- **Estados:** escuchando, sin permiso, sin red, apagado con Esc.
- **Venta:** agregar, quitar, cantidad, quitar lo último, total, números en palabras.
- **Productos:** los parecidos (por voz y con botón), y que nunca invente uno que no existe.

### Cobro y mesas
- **Recibido y vueltas.**
- **Cobro con confirmación obligatoria:** la venta no se registra antes del «sí».
- **Sin duplicados:** un segundo «sí» no cobra otra vez.
- **Pago mixto**, y cancelar con «no».
- **Inventario:** se descuenta con el mismo motor.
- **Mesas:** agregar, saldo, mesa inexistente, cobrar con confirmación.

### Respaldo y teclado
- **Recuperar el micrófono** después de dar el permiso.
- **Orden escrita** sin internet.
- **Frase repetida** por el dictado: se aplica una vez.
- **Confirmaciones sensibles:** vaciar, y el descuento que solo abre la ventana de autorización.
- **Teclado:** F1, F2 con Enter seguro, Esc, F6 con 5000 + Enter, F5, F4 y F8.
- **Micrófono flotante** con la caja abierta, el chip Recientes y que no haya errores de página.

Además se corrieron las pruebas de voz y caja que ya existían y la lista completa de CI (resultados en el mensaje de
la versión).

## 8. Compatibilidad (lo verificado y lo que no)

| Equipo | Estado |
|---|---|
| Web en Chromium (pruebas automáticas) | ✅ Verificado con reconocedor simulado |
| Chrome / Edge reales (dictado del navegador) | ⚠️ No probado aquí con un micrófono real. Usa la misma API Web Speech que el micrófono flotante actual |
| App Android (APK) | ⚠️ Usa el reconocedor de Android del puente que ya existe (`app/02`). No probado con un teléfono real en esta sesión |
| Windows y Mac (Electron) | ⚠️ El dictado de Chromium dentro de Electron normalmente **no** funciona (no tiene el servicio de voz de Google): ORDEVA lo detecta y deja la **orden escrita** y el teclado (F1–F9) |
| Firefox y Safari | Firefox no tiene dictado: orden escrita. Safari tiene `webkitSpeechRecognition`, que no se probó |

**No se declara compatibilidad universal.** Lo que no se probó con un micrófono real está marcado ⚠️.

## 9. Limitaciones conocidas
- La calidad del dictado depende del reconocedor del navegador o del teléfono. Con ruido fuerte puede oír mal; por eso
  se muestra lo que oyó y nada se cobra sin confirmar.
- Los productos **por peso** (kilo o libra) se agregan por voz pero se **pesan** en la balanza o a mano, como al
  tocarlos. «Que sean dos kilos» no se fija por voz.
- **Manos libres** (opcional, en ⚙️) deja el micrófono abierto mientras la caja está en pantalla. Se apaga al cerrar
  la caja, con F8 o tras 3 silencios.
- «Mesa dos águilas» se entiende como mesa 2 con una Águila (igual que el micrófono de mesas de siempre). Para dos
  águilas en una mesa se dice «mesa 3, dos águilas».
- Sin internet, el dictado de Chrome no funciona. La orden escrita y el teclado sí.

## 10. Cómo se usa
1. Abre la **🧾 Caja**.
2. Toca **🎤** (o F8) y di la orden. También puedes **mantenerlo presionado** mientras hablas y soltar al terminar.
3. La primera vez sale el aviso de privacidad: «Entendido, usar el micrófono» o «Prefiero escribir».
4. Mira la barra: lo que oyó y lo que hizo ORDEVA. Si pregunta «¿Cuál…?», responde o toca la opción.
5. Para cobrar: «me paga con cincuenta mil» → «cobrar en efectivo» → revisa el recuadro verde → «sí, confirmo» o
   **✅ Confirmar venta**.
6. **⚙️**: responder en voz alta, el volumen, los sonidos y manos libres. **?** muestra todo lo que entiende y los
   atajos.

## 11. Pendiente
- Probar con micrófono real en Chrome de escritorio, en un Android de gama baja y en Safari de iPhone.
- Un reconocedor **local** opcional (por ejemplo Vosk o Whisper en WebAssembly) para Electron y para trabajar sin
  internet. Ya se puede conectar con `registrarMotor`, pero pesa entre 40 y 75 MB y no se incluyó sin autorización.
- Voz para productos por peso («medio kilo de queso») conectada a la balanza.
