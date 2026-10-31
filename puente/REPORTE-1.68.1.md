# ORDEVA 1.68.1 · 🔄 Cuentas sincronizadas entre celulares

## Lo que reportó el dueño
«Le doy sumar y no suma en el otro celular, llega atrasado y se desincroniza.»

## Reproducido antes de corregir
Prueba nueva `pruebas/sincmesas.test.js`. Usa dos celulares con la misma cuenta, contra el servidor local real. Con el
código de antes:

| Caso | Esperado | Antes |
|---|---|---|
| Cuenta abierta en el celular 2 cuando llega el «+» del celular 1 | ×4 en pantalla | **×3** (no se actualizaba) |
| «+» en esa cuenta abierta del celular 2 | 5 | **4: el toque se perdió** |
| 8 «+» a la vez en cada celular | 21 | **17: se perdieron 4** |
| Negocio con 4000 ventas, 10 «+» en cada celular | +20 | **+33: se contó de más** |

## Causas encontradas y arreglos

1. **La cuenta abierta quedaba con la copia vieja** (`app/04a`). Cuando llegaban los datos del otro celular, ORDEVA
   reemplazaba todos los datos, pero la cuenta abierta en pantalla seguía mostrando la cantidad de antes. Su «+» sumaba
   en esa copia vieja, que ya no se guardaba. **Esa era la suma que «no sumaba».**
   - Ahora, al llegar datos nuevos, se vuelven a pintar la cuenta abierta, la persona abierta y las mesas.
   - Cada «+» o «−» busca la mesa y el renglón actuales (`stepperActual`).
2. **Lo que se tocaba mientras llegaban datos no se subía** (`app/04a`). El toque se guardaba en el celular, pero no se
   avisaba a la nube hasta el siguiente cambio. Ahora se sube apenas terminan de llegar los datos.
3. **La subida enviaba el objeto «vivo»** (`nube/vento-nube.js`). Un toque hecho mientras viajaba quedaba anotado como
   si ya estuviera en la nube. En la siguiente mezcla se perdía o se contaba dos veces. Ahora se sube una foto exacta
   de los datos, y esa misma foto queda como base de la mezcla.
4. **Choques seguidos entre celulares sumaban de más.** Si la subida después de mezclar volvía a chocar, la siguiente
   mezcla usaba la base vieja y volvía a sumar lo que ya se había juntado. Ahora, al mezclar, la base pasa a ser lo que
   tenía la nube.
5. **Mezcla sin base** (la copia de IndexedDB tardaba con negocios grandes). Los productos que estaban en los dos
   celulares se sumaban dos veces.
   - Ahora la base también vive en memoria.
   - Si de verdad no hay base, no se suma dos veces: se deja la cantidad mayor.
6. **«Sucio» se apagaba aunque hubiera cambios nuevos.** Ahora se cuentan los guardados: solo queda «al día» si no se
   tocó nada mientras se subía.
7. **Esperas largas:**

   | Situación | Antes | Ahora |
   |---|---|---|
   | Choque con otro celular | 10 s | 0,15–0,6 s, con algo de azar para no volver a chocar |
   | Sin internet o servidor lento | 20 s siempre | 2, 4, 8… hasta 20 s |
   | Aviso de otro equipo que llega durante una subida | Se esperaba a la siguiente revisión (3 s) | Se revisa al terminar la subida |
   | Con cambios propios por subir | Se mezclaba fuera del candado de subida | Se sube y, si choca, se mezcla dentro del candado |

   - Ya no se baja dos veces a la vez.
   - Si el canal en vivo se cae (cambio de wifi a datos), se vuelve a abrir solo.
   - No se vuelve a subir lo que la nube ya tiene (evita subidas de eco que hacían esperar a los demás).

8. **Toques durante la llegada de datos de un negocio grande** (encontrado con la traza de diagnóstico, con el equipo de
   pruebas cargado).
   - Mientras se ponían los datos del otro equipo, el guardado podía escribir la copia vieja encima.
   - La mezcla tenía un tope de 5 vueltas: con toques seguidos, la última vuelta iba sin protección.
   - Ahora no se escribe la copia vieja durante esa carga, y la mezcla se repite (protegida) hasta que no quede nada sin
     juntar.
   - Una bajada vieja tampoco pisa una subida más nueva.
9. **Gastos de hoy en las mañanas** (`lib/vento-finanzas.js`, `app/12`). Un gasto con solo fecha contaba a las 12:00:
   antes del mediodía no aparecía en «gastos operativos» ni en la alerta de gastos. Ahora cuenta desde las 00:00 de ese
   día. Lo destapó la prueba `finanzas` al correr en la mañana.

## Sin cambios en
- La base de datos y el servidor: no hay migraciones.
- Las suscripciones y los permisos.
- El formato de los datos y los registros históricos.

## Pruebas
- `sincmesas`: **14 ✅** (nueva, en CI). Un «+» llega al otro celular en ≈1 s cuando la prueba corre sola (4–5 s con
  4 pruebas a la vez).
  - Además se corrió 11 veces con 3 o 4 copias a la vez (el equipo muy cargado). Las 3 primeras, antes del arreglo 8,
    todavía perdieron 1 a 5 toques en el negocio grande.
  - Después del arreglo 8 (8 corridas): ningún toque perdido ni contado dos veces.
- Lista completa de CI + sincroniza, cuentas, mesarepetida, mesapersonas: **59 de 60 ✅**. Faltaba `finanzas` por el
  punto 9; ya corregido: 17 ✅, y las 8 pruebas que usan gastos y contabilidad ✅.

## Pendiente (ya conocido: P7 de la auditoría)
Cada cambio todavía viaja con el negocio completo. Con negocios muy grandes y internet lento eso pesa. La solución de
fondo es sincronizar solo lo que cambió (por ejemplo, las mesas aparte del historial). Es un cambio de arquitectura y
no se hizo sin autorización.
