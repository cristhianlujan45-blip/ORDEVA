# ORDEVA 1.69.1 · Un «+» llega al otro celular en menos de un segundo

Pedido del dueño: «yo agrego una cerveza y, si tengo otro dispositivo con la misma cuenta, que se vea reflejado de una;
que no se demore ni un segundo».

## Lo que cambió

| Qué | Antes (1.69.0) | Ahora (1.69.1) |
|---|---|---|
| Tiempo para subir después de un toque | 300 ms | 25 ms. Los toques seguidos igual se juntan en una subida. |
| Revisión de la nube sin canal en vivo | Cada 3 s | Cada 1 s |
| Revisión de la nube con canal en vivo | Cada 3 s | Cada 3 s, solo de respaldo. El aviso llega al instante por el canal. |

- **Subir y bajar nunca al mismo tiempo.** Con la espera tan corta, una subida podía caer en medio de una bajada. Ahora la
  subida se hace apenas termina la bajada.
- **Un toque mientras se ponían los datos del otro celular.** Se le avisa a la nube enseguida. Antes, en ese instante
  exacto, el toque quedaba en el celular sin avisar.
- **Dos toques en el mismo milésimo de segundo.** Cada anotación del historial lleva una marca propia y ya no se
  confunden como si fueran una sola.
- **Fotos tomadas sin internet.** A veces los datos llegaban al otro equipo antes que la foto. Ahora el otro equipo la
  vuelve a pedir solo unas veces (2 s, 4 s, 8 s… hasta unos 4 minutos), sin depender del aviso en vivo.

## Medido (Chromium contra el servidor de pruebas, PostgreSQL real)

| Caso | Tiempo para verse en el otro celular |
|---|---|
| Con el canal en vivo (como en Supabase de verdad) | Mediana ≈ 0,2 s |
| Sin canal en vivo (se cayó o la red no lo deja) | ≈ 0,7 s; como mucho, alrededor de 1 s |
| 1.69.0 | ≈ 1,7 s |

- El servidor de pruebas ahora tiene un canal en vivo (`enVivo` en `pruebas/servidor/supabase-local.js`), con los
  formatos de Supabase Realtime (JSON v1 y v2, y binario). Antes las pruebas solo medían la revisión periódica.

## Pruebas

- **`sincmesas`** (24 casos):
  - toques al mismo tiempo en dos celulares;
  - negocio con 4000 ventas;
  - mesero sin permiso;
  - sin internet;
  - sincronización por partes;
  - indicador;
  - tiempo.
- **Bajo carga:** se corrió unas 50 veces en paralelo junto con `sincroniza` (varias pruebas a la vez en el mismo equipo).
  - Pasó en todas menos una.
  - En esa, con la máquina muy cargada, **se perdió 1 toque de 16** en el caso de «8 toques en cada celular al mismo
    tiempo». Los dos celulares quedaron iguales, en 20 en vez de 21.
  - No se volvió a repetir en las 44 corridas siguientes, 24 de ellas con traza, y no se encontró la causa leyendo el
    código.
  - Queda abierto y vigilado: la prueba guarda la traza completa de los dos celulares si vuelve a pasar
    (`VENTO_TRAZA=…`).
  - No se sabe si ya pasaba en la 1.69.0.
- **`sincroniza`:** con el arreglo de las fotos pasó 27/27 en todas las corridas.
- **Otras fallas vistas bajo carga, que son de las pruebas y no de la app:**
  - **`sincmesas`:** la prueba preguntaba por los productos del mesero antes de que le llegaran los datos. Corregido en
    la prueba.
  - **`codigoproducto`:** con muchas pruebas a la vez, el costo «1800» cayó en el campo de cantidad. Sola pasa 22/22. Esa
    prueba no usa la nube.
- **Recarga en `sincroniza` (2 de unas 25 corridas):** la página del celular se recargó sola en medio de la prueba. No es
  por la actualización automática, porque la versión era la misma. No se reprodujo en 20 corridas con diagnóstico, que
  anotaba por qué se recarga. Queda anotado.

## Lo que no se probó
- Celulares reales con datos móviles. El tiempo real depende de la red: con 4G normal se espera menos de 1 s.
