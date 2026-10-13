# Vento 1.31.2 — Micrófono: pedidos largos con pausas y sin prenderse solo

## Qué cambió

- **Pedidos largos con pausas.** En la app Android, el reconocedor de voz cierra la escucha en cada pausa. Si se decía
  «dos águilas…» y se respiraba antes de «tres póker», Vento anotaba solo lo primero y el resto se perdía. Ahora la
  escucha se vuelve a abrir sola y **suma** lo que se dice. Anota cuando hay 2 segundos de silencio o cuando se toca el
  botón otra vez.
  - «mesa 1 dos águilas · tres póker · ocho póker cinco águilas» → 7 Águila y 11 Póker.
  - «mesa 2 veinte póker · y quince águilas» → 20 Póker y 15 Águila.
- **El micrófono ya no se prende y apaga solo.** «Hola Vento» (manos libres) venía prendido de fábrica y abría el
  micrófono una y otra vez esperando «Hola Vento». Además, al tocar el botón se perdía el comienzo de la frase. Ahora
  viene **apagado**; quien lo quiera lo prende en ⚙️ Ajustes.
- No necesita instalar otra APK: el arreglo está en la página que abre la app.

## Pruebas

| Prueba | Resultado |
|---|---|
| vozpausas (pedido largo con pausas, cantidades grandes, «Hola Vento» apagado) | 9 |
| mesa (con «Producto por voz»: dicta una sola frase y ya no se queda con el micrófono) | 51 |
| hola, holaapk, voz1ra (ajustadas: «Hola Vento» se prende en la prueba; el Android simulado ya no repite la frase al reabrir) | 15, 10, 7 |
