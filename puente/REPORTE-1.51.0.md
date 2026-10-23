# Vento 1.51.0 · Que no se pierdan ventas por memoria llena, producción protegida al desplegar y página de pedidos juvenil

Son los pasos 2 y 3 del plan de la auditoría técnica: el hallazgo crítico C1 y el alto A3.

## El problema (verificado en el código)
- Todo el negocio (productos, mesas y **todo el historial de ventas, que nunca se recorta**) se guardaba como un solo texto
  en `localStorage`. Esa memoria tiene más o menos **5 MB** por página, también dentro de la app Android.
- En la misma memoria iban **7 copias diarias completas** del negocio (los puntos de restauración) y las **fotos de los
  comprobantes de pago**, de unos 100 KB cada una.
- Una venta pesa unos 780 bytes. Con 150 ventas al día y las 8 copias, la memoria se llenaba en semanas y Vento
  dejaba de guardar: «⚠️ La memoria de la app está llena y no se pudo guardar».
- Ya estaba pasando: «arregla los errores» borraba puntos de restauración y comprobantes para salir del paso.

## El arreglo (sin borrar nada)
- **Los datos del negocio se guardan primero en el almacén grande del celular** (IndexedDB, cientos de MB).
  - `localStorage` sigue con una copia mientras quepa (hasta 1,5 millones de letras), para las versiones viejas de Vento.
  - Si ya no cabe, se queda la última copia que cupo y manda el almacén grande.
  - Cada copia en `localStorage` lleva una marca de cuándo y cuánto se guardó. Así, si algo la cambió por fuera (un
    respaldo recibido o una versión vieja de Vento), ese cambio no se pierde.
- **Los puntos de restauración** (uno por día, hasta 7, más el de «antes de la nube») se guardan en el almacén grande.
  Los que había se pasan solos, sin perder ninguno. Además, ya no se lee la memoria completa en cada guardado: solo
  una vez al día.
- **Las fotos de los comprobantes** se guardan en el almacén grande y en la nube, como siempre. Las que había se pasan
  solas a los 4 s de abrir Vento.
- **«Arregla los errores»** ya no borra puntos ni comprobantes para liberar espacio: los pasa al almacén grande.
- **Respaldo manual (Ajustes → Transferir):**
  - lleva los datos más nuevos y las fotos de los comprobantes;
  - el formato del archivo no cambia, así que los respaldos viejos y los nuevos sirven en cualquier versión;
  - al recibir un respaldo, manda lo recibido.
- **«Restablecer todo»** también vacía los comprobantes del almacén grande.
- Vento le pide al navegador que **no borre el almacén grande** cuando le falte espacio, si el navegador lo permite.

Archivos: `index.html` (almacén `ventoAlmacen`, `storageGet` y `storageSet`, puntos de restauración, comprobantes,
respaldo manual, «arregla los errores» y «restablecer todo»).

## Producción protegida al desplegar (hallazgo A3)
Archivos: `.github/workflows/servidor-vento.yml` y `pruebas/servidor/revisar-migraciones.js`.
- **Nuevo paso «revisar», antes de «desplegar».** Si algo falla, la base de datos de producción queda como estaba.
  1. **Solo desde la rama principal.** Antes, una corrida manual desde cualquier rama aplicaba a producción las
     migraciones de esa rama.
  2. **Ninguna migración nueva borra datos:**
     - no puede tener `DROP TABLE`, `DROP SCHEMA`, `DROP COLUMN` ni `TRUNCATE`;
     - tampoco `DELETE` o `UPDATE` sin `WHERE`, fuera de las funciones;
     - si de verdad hace falta, una persona escribe en el archivo `-- vento:destructiva-aprobada` y queda como aviso
       visible en el despliegue.
  3. **Todas las migraciones se aplican primero sobre un PostgreSQL vacío** con lo mínimo de Supabase, igual que en las
     pruebas. Además se revisa que **todas las tablas tengan RLS**, las reglas que separan los datos de cada negocio.
- **Verificado aquí:**
  - las 24 migraciones actuales pasan sin falsas alarmas;
  - con migraciones de mentira, detecta `DROP TABLE`, `DROP COLUMN`, `DELETE` y `UPDATE` sin `WHERE` y `TRUNCATE`;
  - no se queja de políticas, restricciones, funciones ni `DELETE` con `WHERE`;
  - deja pasar la marcada como aprobada.
- **Pendiente:**
  - fijar la versión de la herramienta de Supabase: hoy se usa «latest» y los registros no dicen cuál funcionó;
  - el respaldo de datos antes de migrar: no se puede subir a GitHub porque los archivos de un repositorio público
    quedarían a la vista. Se hará con los respaldos propios de Supabase.

## 🎵 Página de pedidos por QR: diseño juvenil y música más fácil
El dueño: «Rectifica que la gente pueda pedir música por el QR, dale un diseño más fácil y juvenil a la app de pedidos
(Vento déjala como está) y que no haya límite de la API de YouTube. El límite de 10 canciones déjalo así».
- **Revisado en producción:** el buscador del Servidor Vento responde en menos de 1 s con 10 canciones de youtube.com,
  sin usar la API de YouTube ni su cupo.
- **Diseño juvenil, solo en `pedido.html`** (la página que abre el cliente con el QR); Vento queda igual:
  - fondo de noche con brillos magenta, violeta y cian;
  - títulos con letra redondeada (Fredoka);
  - pestañas y botones en forma de píldora, con degradado rosado y violeta;
  - mensaje de «enviado» en verde-cian.
- **Pedir música más fácil:**
  - **«▶ Pedir» en cada canción:** la pide con un toque y el botón queda «✅ Pedida». Pasa por las mismas reglas de
    siempre: cupo de la mesa, turnos y guardado si no hay señal.
  - **Géneros de un toque:** Reguetón, Salsa, Vallenato, Despecho, Popular, Pop, Rock y Electrónica. Salen 8
    canciones para escoger, sin escribir.
  - Todo en los 6 idiomas de la página.
- **Sin límite de la API de YouTube:**
  - antes, cuando el servidor no encontraba un artista, la página buscaba en la API de YouTube, y cada búsqueda gastaba
    100 de las 10.000 unidades diarias;
  - ahora «no hay resultados» es una respuesta válida y la API solo se usa si el servidor no responde;
  - en la app del local ya era así: primero la búsqueda de la app Android, luego el servidor y la API solo de respaldo.
- **El límite de 10 canciones por mesa queda igual.**

## Lo que no cambia
- La nube, la sincronización entre equipos, el formato de los datos y de los respaldos, y los QR.
- Ninguna función se quitó y ningún dato se borra en la mudanza: lo de `localStorage` se borra **solo después** de
  quedar guardado en el almacén grande.

## Pruebas
- **Nueva, `almacen`:** 15 comprobaciones.
  1. Un celular que viene de la versión anterior abre con sus datos, y sus puntos y comprobantes se pasan solos y
     liberan `localStorage`.
  2. Con la memoria llena, se guarda igual (sin aviso de error) y al reabrir está la última venta.
  3. Datos de más de 1,5 millones de letras abren completos.
  4. Los puntos de restauración se ven y uno se restaura.
  5. El respaldo lleva los datos más nuevos y los comprobantes, y al recibirlo en otro celular manda lo recibido.
  6. Un cambio de una versión vieja de Vento no se pierde.
  7. «Restablecer todo» no deja comprobantes escondidos.
- **Nueva, `pedidomusica`:** 14 comprobaciones.
  - Géneros de un toque que buscan por el servidor sin tocar la API.
  - «▶ Pedir» manda la canción al local y queda «✅ Pedida».
  - Al escribir, si el servidor no encuentra artistas, no se gasta cupo.
  - Con 10 canciones pedidas no deja pedir más y avisa.
  - En un celular de 320 px nada se sale y los botones son de dedo.
  - Los 6 idiomas.
- **También pasan:** `cancionesmesa`, `youtubesincupo`, `canalvivo`, `seguridadqr` y `erroresreal`.
- **Suite completa:** 77 de 80 a la primera; las 3 restantes:
  - `cuentas` y `dian` fallan solo con la máquina cargada y pasan solas (43 de 43 y 29 de 29);
  - `appoweb` falla igual en la 1.50 publicada (se cuelga al cargar una dirección), así que no es de esta versión.

## Lo que sigue (plan de la auditoría)
- **Ya, sin código:** restringir la clave de YouTube al dominio de Vento en Google Cloud.
- **1.52:** pruebas automáticas en GitHub, versión fija de la herramienta de Supabase y respaldo previo.
- **1.53:** privacidad. El canal del cliente del QR solo escribe, para no exponer los domicilios, y los pagos se ven
  según el rol en el servidor.
- **1.54:** sincronización por partes. Hoy cada cambio sube el negocio completo a la nube (hallazgo C2).
