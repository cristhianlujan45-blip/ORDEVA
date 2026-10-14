# Vento 1.32.0 — Facturas: categoría y código por producto, y facturas escaneadas en HD para descargar

## Qué cambió

### 1. Cada producto de la factura en su propia categoría
- En «🧾 Revisa la factura», cada renglón trae **🏷️ Categoría**. Viene sugerida:
  - si el producto ya existe, la suya;
  - si es nuevo, la de los productos parecidos («Cerveza Águila» → la de «Cerveza Póker») o la que corresponda al tipo
    de producto (cervezas, gaseosas, licores, mecato…), cuando esa categoría ya existe.
- Se cambia una por una, se crea una nueva ahí mismo («➕ Nueva categoría…») o se pone la misma a todos con
  **«Poner a todos la categoría»** y después se ajusta cada una.
- Al aplicar, cada producto queda en **su** categoría. En los productos que ya existían solo se cambia si la tocaste
  (o si no tenían categoría).

### 2. Código de cada producto
- Cada renglón trae **🔢 Código (barras o interno)**. Viene con el código de barras de la factura o el que ya tenía el
  producto. Se puede escribir o **escanear con la cámara (📷)**.
- Al aplicar, el código queda en el producto: escanearlo en la venta encuentra el producto, sale en la lista de
  productos (🔢), en el buscador y en «✏️ Editar producto», donde también se puede cambiar o escanear.

### 3. Facturas escaneadas como CamScanner, guardadas y para descargar
- Al aplicar una factura se guardan en el celular **todas las páginas** (todas las fotos o todas las hojas del PDF;
  antes solo la primera foto, en baja calidad), **escaneadas**:
  - recortadas al borde de la hoja y con la perspectiva corregida;
  - **con el texto alineado** aunque la hoja ocupe toda la foto y esté inclinada (nuevo: detección del ángulo de los
    renglones, ±8°);
  - con la luz pareja: sin sombras, papel blanco parejo y letra negra;
  - en **Full HD o más** (lado largo de 1920 a 2560 px).
- Después, sin hacer esperar, se **detecta todo el texto** de cada página, con la posición de cada palabra.
- En **📚 Facturas anteriores** cada factura muestra la vista previa escaneada y:
  - **📄 Descargar escaneada (PDF HD con el texto)**: las páginas en HD con el texto encima, invisible (se puede buscar
    y copiar, como el PDF de un escáner). Al final va la hoja «Datos de la factura»: proveedor, número, fecha, cada
    producto con su código, categoría, cantidad, costo y total, y los totales.
  - **🖼️ Descargar imagen HD (JPG)**, una por página.
  - **📎 Ver la foto original**.
- Las **facturas guardadas antes** (solo con la foto original) también se descargan **mejoradas en HD**: se escanean
  al abrirlas y quedan guardadas así.
- El mejorador de fotos se arregló de paso, y también beneficia la lectura de las facturas:
  - dejaba una **sombra gris alrededor de las letras** (tomaba el punto más claro de cada zona como «papel»);
  - dejaba **vetas** en el fondo y escalones en la letra al agrandar;
  - dejaba una **raya en el borde**.

## Límites (honestos)
- Las fotos escaneadas se guardan **en el celular donde se escaneó la factura** (como antes). En otro celular de la
  misma cuenta se ven los datos de la factura y se puede descargar la hoja de datos en PDF, pero no la foto.
- El escaneo es en blanco y negro (modo «documento»): los logos de color salen en negro.
- Se guardan las últimas 300 facturas en el historial (como antes).

## Pruebas

| Prueba | Resultado |
|---|---|
| facturascan (nueva): categoría sugerida (Cervezas/Gaseosas/Licores), cambiar una por una, crear categoría, «poner a todos», código escrito y escaneado, aplicar (cada producto en su categoría y con su código), escanear para vender, buscador, «Editar producto»; foto con la hoja girada 5° → recortada, derecha y ≥ 1920 px; texto inclinado 4° → alineado; factura derecha → no se gira; 2 fotos → 2 páginas guardadas; PDF válido (pdfinfo) con imagen ≥ 1920 px (pdfimages), texto detectado que se encuentra con pdftotext (AGUILA, COCA, TOTAL) y la hoja de datos con categorías y códigos; PDF de 2 páginas + datos; JPG HD; factura vieja → descargada mejorada en HD | 33 / 33 |
| Revisión visual: foto difícil (hoja girada 7°, sombra, luz dispareja, ruido de cámara, letra gris clara y logo) → hoja derecha, blanca, sin sombra, letra gris conservada, 1958 × 2560 px | ✔ |
| Batería completa | ver abajo |
