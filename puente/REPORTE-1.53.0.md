# Vento 1.53.0 · La clave de IA del negocio ya no viaja a todos los celulares

Es el primer paso de la **Fase 3 · Seguridad** de la arquitectura de datos (hallazgo **D6**). Va con la regla del dueño:
«No expongas claves, tokens ni credenciales en el frontend».

## El problema (verificado en el código)
- Cuando el negocio ponía su propia clave de Gemini, Vento la guardaba **dentro de los datos del negocio**
  (`data.iaClave`). Así llegaba a los demás celulares.
- Por eso la tenían:
  - **todos los equipos**, también los de los meseros;
  - los respaldos de cada hora del servidor;
  - la memoria de cada celular.
- Con esa clave, cualquiera podía gastar la cuenta de Google del negocio fuera de Vento.

## El arreglo
- **La clave vive en el Servidor Vento, cifrada**, en la tabla de integraciones, igual que las de Wompi o Google.
  - Ningún celular la guarda.
  - El mesero sabe que el negocio tiene IA, pero no ve la clave ni cómo termina.
- **La IA del negocio pasa por el Servidor Vento**, que le agrega la clave al pedido a Google. Funciona igual que antes
  para leer facturas, productos y Laya, en todos los equipos y sin configurar nada en cada uno.
- **Cada guardado de los datos del negocio quita la clave**, venga de la versión que venga de la app.
  - Si la manda el dueño o un administrador y el negocio todavía no tenía una en el servidor, queda guardada allá.
  - Los respaldos nuevos tampoco la llevan.
- **Los negocios que ya la tenían:** al desplegar, la clave se pasa al servidor y se quita de los datos. Cada equipo
  baja los datos sin la clave y la borra de su memoria.
- **⚙️ Configurar IA:**
  - dice «🔐 La IA usa la clave del negocio, guardada en el Servidor Vento (termina en …)». El final solo lo ven el
    dueño y el administrador;
  - para cambiarla, se pega otra: Google la prueba antes de guardarla;
  - «Guardar» con el campo vacío ya no la borra;
  - **«🗑️ Quitar la clave del negocio»** deja la IA de Vento. Pide confirmación y solo lo pueden hacer el dueño y el
    administrador;
  - cambiarla o quitarla queda en la auditoría.
- **Un celular con la versión anterior** que vuelve a meter su clave vieja en los datos no deshace un cambio ni un
  «Quitar» hecho desde Ajustes. El servidor la quita y no la guarda.
- **Sin Vento Nube** (negocio solo en un equipo), la clave queda solo en ese equipo, ya no en los datos.

Archivos:
- `supabase/migrations/20261101000000_ia_clave_servidor.sql`: `guardar_datos` quita la clave, `ia_clave_recibir`,
  `ia_clave_estado`, `srv_ia_clave_quitar` y la mudanza;
- `supabase/functions/vento-pagos/app.ts`: rutas `/ia/<negocio>/v1beta/…` y `/ia-clave` (servidor 1.21.0);
- `nube/vento-pagos.js`: `ventoPagos.ia`;
- `index.html`: cómo se usa, se guarda y se muestra la clave.

## Lo que no cambia
- La IA de Vento (la del proveedor) para los negocios sin clave propia.
- Leer facturas, escanear productos, Laya y la música por YouTube.
- La sincronización: el guardado es el mismo; solo se quita una clave de los datos.
- Los respaldos viejos del servidor no se tocan; solo los ven el dueño y el administrador.

## Pruebas
- **Nueva, `servidor/iaclave`:** 34 comprobaciones contra PostgreSQL real y un Gemini de mentiras.
  - **La clave sale de los datos:** se quita del documento y del respaldo, y queda en el servidor.
  - **Nadie la puede leer:** ni el mesero, ni otro negocio, ni sin sesión.
  - **La IA del negocio funciona por el servidor para el mesero:** la clave queda cifrada al primer uso, también con
    respuesta en vivo y con la lista de modelos.
  - **Ajustes:** solo dueño o administrador guardan, cambian o quitan; una clave que Google rechaza no se guarda.
  - **Celulares viejos:** no deshacen un cambio ni un «Quitar».
  - **Mudanza:** se mudan los negocios que ya tenían la clave, y la migración se puede correr otra vez.
- **Nueva, `iaclave`:** 17 comprobaciones en la app con el navegador.
  - Un celular que traía la clave copiada la sube y la borra.
  - El celular del mesero nunca la tiene y la IA le funciona.
  - **Ajustes:** muestra el final, «Guardar» vacío no la borra, cambiarla vale para todos y «Quitar» funciona.
  - Ningún equipo llamó a Google directo con la clave.
- **Actualizada, `iaunavez`** (8 comprobaciones): antes comprobaba que la clave quedara en los datos del negocio; ahora
  comprueba lo contrario.
- **Siguen pasando:**
  - pruebas del servidor: `admin` 142, `avisos` 27, `bloqueos` 18, `daviplata` 101, `dian` 69, `errores` 30,
    `proyeccion` 66 y `suscripciones` 154;
  - pruebas de la app: `facturarapida`, `musicaequipo`, `pedidomusica`, `sincupo`, `youtubesincupo`, `panelyoutube` y
    `sincroniza`.
- `revisar-migraciones`: la migración no borra datos y las 26 migraciones se aplican con RLS en todas las tablas.

## Lo que sigue de la Fase 3 (necesita una decisión del dueño)
Las otras tres partes cambian cómo trabajan los celulares del equipo. Están explicadas en el mensaje de esta versión,
antes de hacerlas:
- **D5:** pagos de Nequi y DaviPlata solo para dueño y administrador;
- **D2:** que un mesero no pueda reescribir precios ni ventas;
- **D8:** que el QR del cliente solo pueda mandar pedidos.
