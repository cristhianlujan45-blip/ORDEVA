# ORDEVA 1.99.16 · El Xiaomi con la cuenta de Cristian WKH muestra «Tienda Vito»

**Pedido del dueño (17/11):** «tengo abierta la cuenta de Cristian WKH cliente en otro celular y me sale con otros datos
como cervecería, cuando en el Samsung me sale como tienda Vito… la cuenta que necesito enlazada con la de Cristian WKH es
la que tiene más productos».

## Diagnóstico en producción (solo lectura)
- El negocio de la cuenta cristhianwkh+cliente (adc9bb00, «Tienda Vito»: 168 productos, 81 inventariados, 192 ventas)
  está intacto en la nube.
- El Xiaomi (APK 1.99.15) estaba conectado a la nube con OTRA cuenta (negocio 95636ded: 2 productos y sin nombre, por eso
  la app decía «Cervecería»). No se conecta a adc9bb00 desde el 16/11.
- Además, lo guardado en el Xiaomi quedó como «null»: la app se caía en cada arranque
  («Cannot read properties of null (reading 'tables')» ×17, «… 'businessName'» ×7).

## Por qué pasaba
1. Entrar a ORDEVA con un correo NO cambiaba la conexión de la nube si el equipo ya estaba conectado a otra cuenta, y si
   lo hacía, mezclaba los datos del otro negocio con los de esta cuenta.
2. Con lo guardado en «null», `loadData` dejaba `data = null` y todo se caía.
3. Encontrado al probar: si lo guardado se dañaba, la app arrancaba con los datos de muestra y **los subía a la nube por
   encima del negocio** (la red de seguridad «se borraron los datos de este equipo» no funcionaba en la primera subida
   después de abrir la app, porque la copia de referencia solo estaba en IndexedDB).

## Qué cambia
- `app/04h` `authConectarNube`: si el equipo estaba conectado a OTRO negocio (en el mismo espacio del equipo), al entrar
  con un correo se baja el negocio de ESA cuenta y reemplaza lo que se ve (no se mezclan). Lo de la otra cuenta sigue en
  su nube. Si esa cuenta no tiene negocio, no se crea uno con los datos de la otra: se avisa.
- `app/04a` `loadData`: lo guardado dañado o vacío ya no tumba la app. Si el equipo está conectado a un negocio de la
  nube, se marca `window.__ventoDatosVacios` y la nube baja el negocio y manda ella. `saveData` ignora un `data` nulo.
- `nube/vento-nube.js`: con esa marca, `cambio`, `subir` y `revisarNube` no suben nada: bajan la nube (`recuperarVacio`).
  `subirFoto` lee la copia de referencia de IndexedDB si no está en memoria (la red de seguridad funciona al abrir).
  `ventoNube.revisar` expuesto.
- `lib/vento-solo-local.js`: si se entró con un correo y el equipo está conectado a otro, aviso arriba de Inicio
  «☁️ Este celular está conectado a otra cuenta» con «Ver los datos de …» (pide la contraseña y conecta).

## Pruebas
- Nueva `pruebas/nubecambiocuenta.test.js` (Supabase local real, 12/12): el caso del Xiaomi; lo guardado en «null»
  vuelve a bajar «Tienda Vito» y la nube NO se pisa; el aviso de otra cuenta. Agregada a la lista de CI.

## Para el Xiaomi, después de actualizar
Abrir la app: si sale el aviso «Este celular está conectado a otra cuenta», tocar «Ver los datos de
cristhianwkh+cliente@gmail.com» y poner la contraseña. Si no sale: Cerrar sesión y volver a entrar con ese correo.

## No se hizo (necesita confirmación del dueño)
Borrar los otros negocios de prueba en la nube (95636ded, e634fbf1, 7b91bdc7…): no se borra nada sin que el dueño diga
cuáles.
