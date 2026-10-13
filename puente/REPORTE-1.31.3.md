# Vento 1.31.3 — Micrófono: ya no vuelve a sonar ni a abrirse solo después de la orden

## La falla

Se tocaba 🎤, se decía la orden y el micrófono **volvía a sonar y a abrirse solo**. Pasaba así:

1. Para no cortar un pedido largo con pausas (1.31.2), Vento vuelve a abrir la escucha cuando Android termina una frase.
2. Si no se dice nada más, Vento la cierra a los 2 s. Android respondía «no te entendí» y la parte nativa de la app lo
   tomaba como un tropiezo al abrir el micrófono y **lo volvía a abrir sola**. Eso producía otro pitido y 5–8 s más
   escuchando antes de anotar el pedido.
3. En esos segundos se oía lo que se hablara cerca, y **se sumaba al pedido**: en la prueba se colaron «5 Club
   Colombia» que nadie pidió.

Se reprodujo con un simulador del reconocedor de Android que se porta como la app instalada. Con la versión 1.31.2 dio
13 fallas: 3 a 6 pitidos por orden, el micrófono se reabría solo y el pedido se anotaba 7,2 s después.

## Qué cambió

- **Un solo pitido, el del toque.** Cuando la escucha se vuelve a abrir a mitad de un pedido, el pitido de Android se
  silencia, igual que en «Hola Vento». El sonido del celular vuelve al terminar.
- **El micrófono no se vuelve a abrir solo.** Si en la escucha reabierta no se dijo nada, Vento la *cancela* en vez de
  *pararla*, y así Android no responde «no te entendí». La APK nueva tampoco reintenta después de que la página pide
  parar (`VentoApp.java`).
- **Anota más rápido.** Cuando la frase ya es una orden completa (mesa que existe + productos conocidos, o un comando
  como «deshacer» o «cuenta de la mesa 2»), anota 1,2 s después de que Android termina la frase. Si termina en «y»,
  «con», «para la mesa», un número suelto…, espera 2 s más para que se siga hablando. Antes tardaba entre 2 y 7 s.
- **Tope**: una orden escucha como máximo 25 s y 8 pausas (con música o gente hablando cerca no se queda abierto).
- **Comandos corregidos** (se encontraron al probarlos todos por el micrófono):
  - «la mesa 1 son diez águilas» **agregaba 1 Águila**; ahora corrige la cantidad a 10, como dice la ayuda. También
    «no, eran tres águilas mesa 1» y «la mesa 1 no son tres, son cinco águilas». «son dos águilas para la mesa 3»
    sigue siendo un pedido nuevo (agrega 2).
  - «cuenta de la mesa 1» no funcionaba cuando el negocio llama «Cuenta» a sus mesas: se volvía «mesa de la mesa 1».
  - Quitar una mesa con cuenta: ahora basta decir «sí» o «no». Antes solo servía «confirmar» o «cancelar».
  - «Producto por voz» actuaba con lo que se iba oyendo: con «Pilsen, precio cinco…» (todavía sin el «mil») podía
    guardar el producto a $5 y luego otra vez a $5.000. Ahora espera la frase final y lo guarda una sola vez.
- No hace falta instalar otra APK: el arreglo principal está en la página que abre la app. La APK nueva trae además el
  cambio nativo.

## Pruebas

| Prueba | Resultado |
|---|---|
| microfono — 10 vueltas, alternando la app instalada y la nueva: orden de un tirón, pedido con 4 pausas, cantidades grandes con gente hablando después, pausa a mitad de frase y tocar sin hablar. En cada una: un solo pitido, sin reabrirse, anota una vez y rápido, micrófono cerrado y sonido devuelto | 211 / 211 |
| vozcomandos — 54 comandos dichos por el micrófono: básicos, formas cortas («la 3…», «3 dos águilas»), pedidos con pausas, cantidades grandes, corregir, deshacer, cuentas y totales, crear/nombrar/pasar/juntar/abrir/quitar mesas con «sí»/«no», personas, abonos, inventario, recordar, ayuda, libreta, calculadora, cobrar, botón IA sin clave y producto por voz | 109 / 109 |
| Batería completa (todas las pruebas de `pruebas/`) | ver abajo |
