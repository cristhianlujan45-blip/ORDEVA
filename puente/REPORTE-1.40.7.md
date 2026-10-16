# Vento 1.40.7 · Frases de pago desde Vento Admin y dos arreglos de pantalla

El dueño pidió las mejoras 1, 2 y 5 (no la 3 «aviso si no suena por mucho rato» ni la 4 «¿es de la mesa…?»: no todos
los pagos son de una mesa).

## 1. Los avisos del banco que no se tomaron llegan solos al panel
Ya quedó en la 1.40.5: cada aviso que Vento no tomó, no entendió o pasó crudo llega a 🐞 Errores, sin nombres ni
valores, aunque nadie abra Ajustes → Pagos.

## 2. 💜 Frases de pago: se enseñan desde Vento Admin y llegan al instante a todos
- **Vento Admin → 🐞 Errores → «💜 Frases de pago»**: el administrador agrega una frase del aviso del banco.
  - «💜 Es un pago»: Vento lo toma y dice el valor que traiga el aviso. Si no trae valor, dice «Llegó plata por
    Bancolombia. Mira el valor en la aplicación.».
  - «🚫 No es un pago»: Vento lo ignora (publicidad, saldo…).
  - Banco opcional, para que la voz diga «por Bancolombia».
- **«💜 Enseñar esta frase»** en cada aviso de pago que Vento no tomó: llena la frase con el texto fijo del aviso y el
  banco. Solo queda revisarla y tocar «➕ Agregar».
- **La app de cada negocio** pide las frases cuando le llega un aviso que no entiende, si las que tiene son de hace más
  de 10 s. Así la frase recién agregada sirve para el siguiente aviso, sin reinstalar nada. También las pide al abrir,
  cada 10 min, y las guarda para cuando no haya internet.
- **Servidor:**
  - Tabla `frases_pago` y migración `20261027000000_frases_pago.sql`.
  - `frases_pago_lista()` la puede leer cualquier equipo.
  - Guardar y borrar solo lo puede hacer el administrador, por el Servidor Vento (`frases_pago`, `frase_pago_guardar`,
    `frase_pago_borrar`).
  - Un cliente no puede escribir en la tabla ni llamar esas funciones.

## 5. Las dos pruebas que fallaban (eran errores de verdad)
- **Ventana de YouTube en el celular:** el buscador de arriba no se encogía y empujaba el botón ✕ 35 px fuera de la
  pantalla. Ahora se encoge (`min-width:0`).
- **Paso a paso de pagos:** al llegar el permiso, el paso 3 se achica y la pantalla se corría unos 60 px. Además, al
  repintar, la ventana repetía su animación de entrada. Ahora:
  - el paso que se está leyendo queda quieto en la pantalla;
  - la animación no se repite.

## Pruebas
- `servidor/errores`: 30 comprobaciones, 10 nuevas de frases de pago. Hay frases, no se repiten, cualquier equipo las
  lee, un cliente no puede agregar ni escribir directo, y al borrarlas dejan de llegar.
- `erroresreal`: 22 comprobaciones, de punta a punta con PostgreSQL real.
  - Un aviso que no se entiende llega al panel.
  - «Enseñar esta frase» y luego «Agregar».
  - El siguiente aviso igual ya es un pago en la app del negocio y suena «Recibiste 4000 pesos por Bancolombia».
- `pagosaviso`: 72 comprobaciones; 3 nuevas: es un pago con valor, no es un pago, y pago sin valor.
- `ventanayoutube` 30 y `desplazamiento` 10: ya pasan.
