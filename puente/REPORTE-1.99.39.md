# ORDEVA 1.99.39 · La pantalla del TV se lee desde lejos

## Pedido del dueño (23/11): «Publica y continúa»
Se revisó la pantalla de ORDEVA para el TV (`tv.html`), la que ven los clientes en el televisor: la canción que suena y
la cola.
- **Medido en:** 1920 × 1080, 1280 × 720 y 1024 × 576, con una cola de 4 canciones y un título largo.
- **Cómo se ve:** los tamaños van relativos al alto de la pantalla, así que se ve igual en un TV de 720 o de 1080. Nada
  se sale.

### Lo que se mejoró
A 3 metros (la distancia normal a un TV de bar) varias cosas quedaban pequeñas:

| Qué | Antes (% del alto de la pantalla) | Ahora |
|---|---|---|
| Mesa que pidió cada canción | 2 % | 2,4 % |
| Título de cada canción de la cola | 2,5 % | 2,9 % |
| «Siguen» | 2,4 % | 2,7 % |
| Estado («Conectado con ORDEVA») | 1,9 % | 2,2 % |
| «Pide tu canción con el QR de tu mesa» | 2,2 % | 2,5 % |

Además, un título largo en la cola ahora usa **dos renglones**; antes se cortaba con «…».

### Comprobado
- Fotos en 1280 × 720.
- **Prueba nueva:** `pruebas/tvlejos1939.test.js` (7/7).
- La prueba existente `v188`, que usa esta pantalla, pasa 12/12.
