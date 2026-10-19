# Vento 1.47.0 · Facturación electrónica DIAN, caja con arqueo e inventario por código

El dueño pidió:
- «Dame lo de facturación con la DIAN… recomiéndame el proveedor».
- «Y haz las mejoras».
- «Recuerda también cómo los sistemas POS inventarían las cosas por código, los productos».

## 🧾 1. Facturación electrónica DIAN (por MATIAS API)

### Proveedor recomendado: MATIAS API (casa de software)
MATIAS fue el único revisado que trae las tres cosas que Vento necesita:
- Un plan de «casa de software»: con una sola cuenta factura a nombre de muchos NIT. Cada negocio es una empresa
  cliente (`client_uuid`).
- El documento equivalente electrónico P.O.S. (tipo 20) y sus notas crédito (tipo 94).
- Un ambiente de pruebas gratis, que se probó contra su servidor de verdad: las rutas y catálogos públicos responden.

Precios publicados, por año:
- 5.000 documentos: $220.000.
- 10.000 documentos: $400.000.
- 30.000 documentos: $630.000.

El certificado de firma va aparte, desde $99.000 por NIT al año. Factus no trae el P.O.S. electrónico ni varias empresas
en una cuenta. Bilidox no publica su API.

### Cómo funciona
**Ajustes → Negocio → «🧾 Facturación electrónica DIAN».** Ahí van:
- La razón social y el NIT. El dígito de verificación se calcula solo.
- La dirección, la caja y el impuesto: no responsable, IVA 19 / 5 / 0 % o impuesto al consumo 8 %.
- La resolución P.O.S.: número, prefijo, rango y vigencia.
- La resolución de factura, que es opcional.
- Los botones «Guardar», el interruptor y «Probar conexión».

**Cada venta cobrada** (en la caja, en la mesa o en la cuenta de una persona) sale sola como documento P.O.S.
electrónico:
- Los precios traen el impuesto por dentro. Vento separa la base y el impuesto línea por línea, con la tarifa del
  producto si la tiene.
- Las sumas cuadran como lo exige la DIAN. Los descuentos se reparten en el precio y la propina va sin impuesto.
- Los pagos se mapean así: efectivo = 10, Nequi / DaviPlata / transferencia = 31, tarjeta = 48 y fiado = crédito con
  fecha.

**Recibo** (pantalla, WhatsApp e impresora del navegador):
- «Documento equivalente electrónico P.O.S. N.º FPOS12».
- La resolución con su rango y vigencia, y los impuestos por tarifa.
- El CUDE y el código QR de la DIAN.
- «AMBIENTE DE PRUEBAS» mientras sea sandbox.

La impresora térmica imprime todo eso con el QR nativo (GS ( k). Si está en «imprimir al cobrar», espera hasta 10 s
la respuesta de la DIAN.

**Historial:**
- El estado del documento, el PDF de la DIAN, «🔁 Reintentar», «🧾 Factura a nombre de…» y «↩️ Anular (nota
  crédito)».
- «Factura a nombre de…» anula el P.O.S. y saca la factura electrónica (tipo 7) a nombre del cliente: cédula o NIT,
  nombre y correo.

**En la caja,** antes de cobrar: «🧾 Factura electrónica (datos del cliente)».

**Nota crédito automática** al deshacer un cobro, borrar, liberar o corregir una venta. Al corregir, además sale el
documento nuevo. Las devoluciones parciales hacen la nota parcial.

**Sin internet:** la venta queda en una cola en el equipo y sale sola al volver. El servidor no repite números
aunque el mismo documento llegue dos veces o desde dos celulares.

### Servidor
**Migración `20261029000000_dian.sql`:**
- `dian_config` y `dian_documentos`, con RLS. El cajero ve y el dueño o el administrador cambian.
- Numeración reservada con la fila bloqueada: 6 cajas cobrando a la vez dan 2…7, sin repetir ni saltar.
- No se puede volver a un consecutivo ya usado.
- Rango agotado o resolución vencida dan un aviso claro y no gastan número.
- Avisa cuando quedan 50 números o menos.

**`vento-pagos` (`dian.ts`):** rutas `/dian/config`, `/dian/emitir`, `/dian/anular` y `/dian/estado`.
- **Rechazos:** un rechazo se corrige y se manda con el mismo número.
- **Sin respuesta:** si se pierde la respuesta, primero se consulta (`GET /status`) y nunca se manda a ciegas.
- **Caídas de la DIAN:** los códigos 503, 98 y 402 quedan pendientes y el repaso de cada 10 minutos los reenvía.
- **Token:** el de MATIAS se guarda cifrado y se renueva solo, también si responde 401.

**Vento Admin:** facturación de cada negocio (prendida, conectada y documentos). Conecta con un toque la empresa de
MATIAS que tiene el mismo NIT, o con su `client_uuid`.

**Despliegue:** los secretos `MATIAS_EMAIL`, `MATIAS_PASSWORD` (o `MATIAS_TOKEN`), `MATIAS_URL` y
`VENTO_FABRICANTE*`. Sin `MATIAS_URL` se usa el ambiente de pruebas.

## 💵 2. Caja con base, entradas, salidas y arqueo
- **Abrir la caja:** historial → «💵 Caja: base, entradas y salidas», con la base.
- **Movimientos:** entradas y salidas de efectivo con motivo, por ejemplo pago a proveedor o sencillo. Quedan en la
  actividad del equipo.
- **Lo que debe haber:** base + ventas en efectivo + entradas − salidas. Se ve en el panel y en «📊 Caja de hoy».
- **Arqueo:** al cerrar la caja del día se cuentan los billetes ($100.000 a $1.000) y las monedas ($1.000 a $50), o se
  escribe el total. Dice en vivo «✅ Cuadra», «⚠️ Faltan $X» o «Sobran $X».
- **Resultado:** queda en el cierre, en pantalla, en WhatsApp y en la imagen. El cierre automático programado guarda
  la caja «sin contar», sin quedarse esperando.

## 🔢 3. Inventario por código (como los sistemas POS)
Inventario → «🔢 Inventario por código»:
- **Códigos:** los productos sin código reciben uno interno de 4 dígitos (1001, 1002…). Sirve en la caja, con el
  lector, la cámara y la búsqueda.
- **🔎 Consultar:** precio, costo, existencias, cambiar el código y el 📒 kárdex (ventas, entradas, ajustes y
  devoluciones con fecha, quién y saldo).
- **📥 Entrada de mercancía:** cada lectura suma 1, o «12*código» suma 12. Lleva costo nuevo y proveedor o factura,
  y «Aplicar» sube las existencias.
- **📋 Toma de inventario:** se escanea todo lo que hay y Vento compara con el sistema, en unidades y en plata
  («faltan $11.100»). «Aplicar ajustes» corrige las existencias. El conteo se guarda aunque se cierre la app.
- **Excel:** el inventario con códigos, existencias, costo, precio y valor.
- **Código desconocido:** ofrece crear el producto con ese código.

## 💲 4. Precio por cantidad (mayorista)
En «Consultar», cada producto tiene escalones del tipo «desde 6 unidades a $3.500 c/u». La caja cobra sola el precio
por cantidad.

## ↩️ 5. Devoluciones
En el historial, «↩️ Devolución» pide la clave como «Corregir». Se elige cuánto devuelve de cada producto y el motivo.
- Lo devuelto vuelve al inventario y queda en el kárdex.
- La venta baja y la devolución queda anotada.
- El efectivo devuelto sale de la caja.
- Con facturación electrónica sale la nota crédito parcial.

## Pruebas
- **`servidor/dian` (nueva):** 69 comprobaciones contra PostgreSQL real y MATIAS simulado. El simulador revisa los
  campos obligatorios de cada tipo, la aritmética de líneas, impuestos, totales y pagos, la numeración y las
  referencias de las notas.
- **`dian` (nueva):** 29 comprobaciones de punta a punta, con la app de verdad, el servidor y PostgreSQL.
- **`mejoras` (nueva):** 32 comprobaciones de caja, arqueo, inventario por código, kárdex, precio por cantidad y
  devoluciones.
- Suite completa del navegador y del servidor.

## Lo que necesita el dueño
1. **Contratar MATIAS API (casa de software):** el paquete de documentos al año y un certificado por cada NIT que
   facture.
2. **Agregar los secretos en GitHub** (Settings → Secrets and variables → Actions):
   - `MATIAS_EMAIL` y `MATIAS_PASSWORD`, de la cuenta de casa de software. Sirven primero los del sandbox para
     probar.
   - Para producción, `MATIAS_URL = https://api-v2.matias-api.com/api/ubl2.1`.
   - `VENTO_FABRICANTE` y `VENTO_FABRICANTE_DUENO`: tu empresa y tu nombre, como fabricante del software P.O.S.
3. **Por cada negocio:**
   - El negocio se habilita en la DIAN y pide su resolución P.O.S.
   - Tú creas su empresa en el portal de MATIAS y la conectas en Vento Admin.
   - El negocio llena Ajustes y prende la facturación.

**Ojo:** las reglas de la DIAN cambian. Antes de facturar de verdad conviene que un contador confirme las tarifas y
el tipo de documento de cada negocio.
