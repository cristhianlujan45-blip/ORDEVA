# Vento 1.49.0 · La voz dice la cantidad, fuerte y pareja; pagos más rápidos y con el celular bloqueado en todas las marcas

El dueño: «Que siempre me diga la cantidad que llega. No necesito el nombre, pero sí la cantidad: llegaron 3200, llegó
tanto. Que suene muy duro, que suene alto, y que el volumen no cambie ni varíe, que suene estable, y en todos los
celulares. Si tengo la cuenta abierta en otro dispositivo, cuando llega un pago tiene que sonar en todos».

## 1. «Llegaron 3200 pesos, por Nequi»
- Cada pago de Nequi, DaviPlata, Bre-B y transferencias de bancos se dice con la **cantidad**: «Llegaron 3200 pesos, por
  Nequi».
  - Con Bre-B: «Llegaron 65000 pesos, por Bre-B, en DaviPlata».
  - Si la cuenta es de una mesa: «…, de la Mesa 3».
- **Ya no dice el nombre** de quién pagó. La notificación y la ventana lo siguen mostrando.
- Es la misma frase en el celular que lee el aviso, en los otros equipos de la cuenta (desde Android o desde la página) y
  en el computador.
- La pausa antes de «por Nequi» deja oír bien la cantidad.
- **Si primero llega el aviso de Bre-B sin el valor**, se dice «Llegó plata por Bre-B, en DaviPlata». Cuando llega el
  valor, «Llegaron 65000 pesos, por Bre-B, en DaviPlata».

## 2. Fuerte y estable
- **Por qué «variaba»:** por encima de 100 % la voz pasaba por un nivelador que subía las sílabas bajitas y bajaba antes
  de cada pico. La ganancia cambiaba sílaba por sílaba y se oía subir y bajar.
- **Ahora la ganancia es fija en toda la frase**, hasta ×1,6 (+4 dB). Solo la punta de los picos se dobla suave, con una
  curva fija que no cambia en el tiempo. Así suena más duro, parejo de principio a fin y sin chasquidos: nunca pasa de
  97 %.
- **De fábrica 130 %**, más fuerte de lo normal. Quien ya había elegido un volumen lo conserva.
- Se puede subir hasta 150 % en Ajustes → Pagos.
- El volumen de la alarma va al máximo mientras habla y después vuelve a como estaba.

## 3. Con el celular bloqueado, en todas las marcas, y de una
El dueño también pidió: «Corrige todos los errores en todo tipo de celular, en todos los modelos, para que suenen las
notificaciones así el celular esté bloqueado, y que lleguen rápido, apenas pagan».
- **Más rápido entre equipos:** los otros equipos de la cuenta preguntan por los pagos **cada 5 s** (antes cada 10 s),
  desde Android, también bloqueados. El celular que lee el aviso lo manda en el mismo segundo.
- **🛡️ Guardia (app Android):**
  - **Por qué:** Xiaomi, Oppo/Realme, Vivo, Huawei, Tecno/Infinix y otras marcas cierran las apps de fondo aunque tengan
    su aviso fijo. Desde ahí no sonaba nada hasta abrir Vento.
  - **Qué hace:** Android despierta un guardia cada 15 min, también después de reiniciar el celular.
    - Si Vento está cerrada, la vuelve a prender.
    - Revisa la barra de avisos, por si llegó un pago mientras estaba cerrada.
    - Revisa los pagos de los otros equipos.
- **🩺 El chequeo ahora también revisa lo que hace que suene bloqueado**, con su botón para arreglarlo:
  - 🔔 notificaciones de Vento permitidas («Permitir»);
  - 🔋 Vento sin ahorro de batería («Arreglar»);
  - ⚙️ Vento trabajando de fondo;
  - 🚀 inicio automático según la marca: Xiaomi, Oppo/Realme, Vivo, Huawei/Honor, Tecno/Infinix y Asus («Abrir inicio
    automático»);
  - en Samsung, cómo sacar a Vento de las «Aplicaciones en suspensión».
- Lo de antes sigue:
  - el servicio de fondo con el procesador despierto;
  - la lectura de la barra cada 10 s (Nequi a veces no avisa a las apps);
  - la reconexión de la lectura de avisos cada minuto;
  - la ventana encima de la pantalla de bloqueo;
  - la voz con el volumen de la alarma (suena aunque el celular esté en silencio).

## 4. En todos los equipos de la cuenta
Viene de la 1.48.0 (app Android 1.0.54, ya publicada):
- El celular que lee el aviso lo manda de una al servidor, desde Android.
- Los demás equipos preguntan desde Android, también bloqueados (ahora cada 5 s).
- Cada pago suena una sola vez en cada equipo.
- **🩺 Chequeo** (Ajustes → Pagos → «Revisar»): muestra qué equipos de la cuenta están escuchando (🟢) y cuáles están
  cerrados (🔴).

## Pruebas
- **`javaavisos`:** 252 comprobaciones.
  - Las frases «Llegaron …» (Nequi, DaviPlata, Bre-B y SMS del banco) y la pausa «Llegaron 3200 pesos, por Nequi».
  - **A 150 %:** la parte bajita sube ×1,6 igual en cada punto, **y es la misma subida al principio y justo antes de la
    parte fuerte (estable)**. La parte fuerte suena más duro que a 100 % y nunca pasa de 97 %.
  - La lectura de avisos reales (`EscuchaPrueba`).
  - El cruce entre equipos dice «Llegaron 20000 pesos por Nequi», sin el nombre.
- **Revisan que la voz diga la cantidad y no el nombre:** `pagosaviso` (92), `avisosandroid`, `erroresreal`,
  `pagosequipos` y `confirmapago`.
- **`pagosequipos`:** 40, con PostgreSQL real en celular, tablet y computador. Ahora incluye el chequeo en un Xiaomi con
  ahorro de batería: lo dice en rojo, y «Arreglar» y «Abrir inicio automático» abren sus ajustes.
- Compila todo el código Android (con `android-all`, Android 14).
- Suite completa.

## Lo que necesita el dueño
- **La app Android nueva:** se instala sola, con «Actualizar ahora» en la 🔔 campanita.
- Para probar: Ajustes → Pagos → «▶ Probar la voz» dice «Llegaron 200 pesos por DaviPlata».
- En cada celular, Vento sin ahorro de batería.
