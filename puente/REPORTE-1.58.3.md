# ORDEVA 1.58.3 · El pantallazo del comprobante ya no traba la app ni da otro valor + ORDEVA para Mac

## 1. Pantallazo del comprobante (📎 Comprobante en la cuenta y «🔎 Verificar un comprobante»)
Se probó con capturas del tamaño de un celular (1080×2400) de Nequi (claro y oscuro), DaviPlata y Bancolombia.

### Qué pasaba (reproducido, no supuesto)
- **Daba otro valor:**
  - el lector leía la captura «en un solo bloque», el modo de las facturas en papel;
  - en ese modo **se saltaba el renglón grande del valor**: en DaviPlata no salía «$ 65.000»;
  - entonces quedaba el mayor de lo que sí leyó: **el saldo, «$ 1.250.300»**;
  - la ventana decía «⏳ Aún no llega $1.250.300».
- **El pantallazo no quedaba en el pago:**
  - cuando la revisión decía «🚨 NO LO ACEPTES», el pantallazo se **quitaba solo** de la cuenta;
  - esa revisión podía equivocarse: el valor mal leído, la hora del equipo corrida (otra zona horaria) o un número del
    destino mal leído («fue a OTRO número»).
- **Se trababa:**
  - el lector cargaba (12 MB) **justo al elegir la foto**;
  - el idioma se decodificaba en el hilo de la pantalla;
  - la captura se preparaba también en el hilo de la pantalla;
  - el adjunto se convertía a JPEG de golpe.

### Qué cambia
- **El valor:**
  - la captura va **tal cual** al lector, que la abre en su propio hilo, y se lee en columna: ya sale el renglón grande
    del valor;
  - si así no aparece «¿Cuánto?» / «Valor» junto a un valor (por ejemplo una **foto** de la pantalla del cliente), se lee
    otra vez como antes y se queda la lectura que sí lo tiene;
  - lo que va **debajo de «Saldo disponible» o «Costo…» nunca se toma como el valor**. Si no hay otro, queda «¿?» y la
    ventana pide revisarlo: no se inventa;
  - «S 65.000» (el $ mal leído) se toma como $ 65.000;
  - si el valor no estaba junto a «¿Cuánto?» / «Valor», la ventana dice que se revise que sea el del pantallazo;
  - «Registrar» sigue saliendo solo cuando el valor coincide con un pago que de verdad llegó.
- **El pantallazo queda adjunto** aunque salga «NO LO ACEPTES». La persona lo quita con **«🗑 Quitar el pantallazo de la
  cuenta»** si quiere.
- **Menos falsas alarmas** (siguen detectando lo falso de verdad):
  - **hora adelantada menos de 6 h:** «⚠️ Revísalo» (la hora del equipo puede estar corrida);
  - **días en el futuro:** «🚨 editado»;
  - **un solo número del destino distinto:** «⚠️ Revísalo» (un 8 leído como 3);
  - **dos o más números distintos:** «🚨 fue a OTRO número»;
  - **comprobante repetido:** «🚨 YA SE USÓ», igual que antes.
- **Sin trabar:**
  - el lector empieza a cargar **al tocar 📎** (mientras se elige la foto, no después);
  - el idioma se decodifica sin bucle en la pantalla;
  - la captura se abre y se pasa a JPEG fuera del hilo de la pantalla.

### Medido (celular simulado 4 veces más lento)
- **Después de elegir la captura, tarea más larga de la pantalla:**
  - antes: 177–280 ms, más 110 ms del JPEG;
  - ahora: **ninguna tarea larga**.
- **Al tocar 📎:** queda una tarea de unos 250 ms (cargar el lector). Ocurre mientras está abierto el selector de fotos
  del sistema.
- **Lectura de cada captura** (equipo de pruebas): 0,5–1 s.

### Prueba nueva: `pruebas/comprobantepantallazo.test.js` (23 comprobaciones)
- **Valor correcto en las 4 capturas**, y la pantalla no se traba al leerlas.
- **En la cuenta:**
  - DaviPlata sale «✅ Pago verificado $65.000» (no el saldo);
  - el pantallazo queda adjunto;
  - «Registrar» anota $65.000 con el pantallazo.
- **Comprobante repetido:**
  - sale «NO LO ACEPTES · YA SE USÓ»;
  - el pantallazo no se quita solo;
  - «Quitar» lo quita.
- **Lectura del texto:** saldo, «S 65.000», hora corrida, número mal leído y otro número de verdad.
- **Con el código de antes, la misma prueba falla:**
  - sale $1.250.300;
  - tareas largas de hasta 246 ms;
  - no hay «Registrar».

**No probado aquí:** capturas reales de un celular (aquí son dibujadas con el formato de cada app). Si una captura real
todavía sale mal, se puede mandar para agregarla a la prueba.

## 2. ORDEVA para Mac
- **Nuevo en el taller de GitHub (`pc.yml`):**
  - se arma **ORDEVA-Mac.dmg**, uno solo para Mac con chip Apple (M1–M4) e Intel, macOS 11 o más nuevo;
  - se publica junto al de Windows: `releases/download/pc/ORDEVA-Mac.dmg`.
- **Antes de publicar, el taller comprueba que:**
  - el programa trae las dos versiones (Intel y Apple);
  - la firma local es válida;
  - el programa abre;
  - el .dmg está sano.
- **Sin firma de Apple:**
  - eso requiere la cuenta de desarrollador de Apple (pago anual). Por eso la primera vez se abre con **clic derecho →
    Abrir → Abrir**, o en Ajustes del Sistema → Privacidad y seguridad → «Abrir igualmente»;
  - por lo mismo, en Mac **el programa no se actualiza solo**: «Buscar actualización» abre la descarga;
  - lo de adentro (la página de ORDEVA) se actualiza solo, igual que en Windows.
- **Ajustes → Instalar ORDEVA:** nuevo botón «🍎 Descargar ORDEVA para Mac».
- **El taller ahora solo publica desde la rama principal.** Desde otra rama (a mano) compila y deja el archivo para
  revisar.
