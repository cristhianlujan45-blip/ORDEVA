/* ORDEVA · app/11-precios-vito-motor.js — antes estaba dentro de index.html (línea 24249). Se carga en el mismo lugar y orden. */
/* ================================================================
   Precios Vito — motor de lectura de facturas SIN INTERNET (offline)
   Integrado como subcategoría dentro de Inventario > Escanear factura.
   Usa Tesseract.js (embebido en los dos <script> de arriba) + reglas
   de formato colombianas para separar producto/cantidad/precio sin
   depender de ninguna IA en la nube. Expone una sola función:
     VitoOfflineOCR.scanInvoiceFiles(files) -> Promise<{supplier,date,items:[{name,qty,unit_cost}]}>
   Acepta fotos y/o PDFs (uno o varios, como el picker de galería).
   que entrega los datos en el mismo formato que ya usa
   recognizeInvoiceWithAI(), para reutilizar toda la pantalla de
   revisión existente (invoiceOpen/invoiceApplyBtn) tal cual.
   ================================================================ */
(function () {
  "use strict";
  function numOr(v, d) { var n = Number(v); return isFinite(n) ? n : d; }

  var OCR_WORKER_LOAD_TIMEOUT_MS = 45000;
  var OCR_RECOGNIZE_TIMEOUT_MS = 30000;
  function withTimeout(promise, ms, timeoutMsg) {
    return new Promise(function (resolve, reject) {
      var settled = false;
      var timer = setTimeout(function () {
        if (settled) return;
        settled = true;
        reject(new Error(timeoutMsg));
      }, ms);
      promise.then(
        function (v) { if (settled) return; settled = true; clearTimeout(timer); resolve(v); },
        function (e) { if (settled) return; settled = true; clearTimeout(timer); reject(e); }
      );
    });
  }

  // Modo de segmentación de página alternativo para el segundo intento:
  // PSM 6 (el que usamos por defecto, "un solo bloque uniforme") a veces
  // desordena las columnas de una tabla (lee toda la columna de nombres y
  // después toda la de precios, o al revés). PSM 4 ("una sola columna de
  // texto de tamaños variables") a veces la lee mejor, y a veces peor —
  // depende de la foto. En vez de adivinar cuál usar, probamos el
  // primero, contamos cuántos productos reales logramos separar del
  // resultado, y si salieron pocos, probamos el segundo y nos quedamos
  // con el que mejor haya funcionado.
  // ---------- offline OCR (Tesseract.js, embedded, no internet needed) ----------
  var offlineWorkerPromise = null;
  var colaComprobante = Promise.resolve();   // un comprobante a la vez: cambia el modo de lectura y lo devuelve

  function b64ToUint8Array(b64) {
    var bin = atob(b64);
    var len = bin.length;
    var bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  // Prepara la imagen para el OCR: la escala a un tamaño legible (más grande
  // que para Gemini, porque Tesseract necesita más detalle) y la pasa a
  // blanco y negro con más contraste, lo que ayuda muchísimo a reconocer
  // fotos de facturas tomadas con el celular (sombras, poca luz, etc).
  // 1500px es suficiente para leer texto de una factura con buen detalle,
  // y reduce bastante el tiempo de reconocimiento frente a 1800px+ sin
  // perder precisión notable en la práctica.
  // Subido de 1500 a 2000: en facturas con letra chica y muchas columnas
  // (ej. notas de pedido de distribuidoras con 6-8 columnas), 1500px no
  // alcanza para que el OCR distinga bien los dígitos, lo que produce
  // ruido que rompe la separación automática de productos. 2000px da
  // bastante más nitidez a cambio de un poco más de tiempo de OCR.
  var OCR_MAX_DIM = 2000;
  function fileToOcrCanvas(file) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      var url = URL.createObjectURL(file);
      img.onload = function () {
        var w = img.width, h = img.height;
        var scale = Math.min(1, OCR_MAX_DIM / Math.max(w, h));
        // si la imagen es pequeña, la agrandamos un poco: Tesseract lee mejor con más píxeles
        if (Math.max(w, h) < 900) scale = Math.min(2, 1400 / Math.max(w, h));
        var cw = Math.max(1, Math.round(w * scale)), ch = Math.max(1, Math.round(h * scale));
        var canvas = document.createElement("canvas");
        canvas.width = cw; canvas.height = ch;
        var ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, cw, ch);
        URL.revokeObjectURL(url);

        var imgData = ctx.getImageData(0, 0, cw, ch);
        var d = imgData.data;
        var gray = new Uint8ClampedArray(cw * ch);
        for (var i = 0, p = 0; i < d.length; i += 4, p++) {
          gray[p] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        }

        // Binarizado adaptativo (estilo "escáner de documento"): en vez de
        // estirar el contraste de TODA la foto de una vez —que no sirve de
        // nada cuando el fondo detrás del papel es oscuro, hay sombras de
        // arrugas, o luz despareja en la mesa/fondo—, compara cada píxel
        // solo contra el promedio de su ZONA cercana y lo deja negro puro
        // (texto) o blanco puro (papel). Así el fondo de la foto (mesa,
        // otros objetos, sombras) casi siempre queda blanco parejo y el
        // texto queda con el máximo contraste posible para el OCR, sin
        // importar qué tan pareja estaba la luz al tomar la foto.
        var binarized = adaptiveThresholdBinarize(gray, cw, ch);

        // red de seguridad: en fotos muy raras (documento en pantalla,
        // fondo casi del mismo tono que el papel, etc.) el binarizado
        // puede salir degenerado —casi todo negro o casi todo blanco—, lo
        // que sería peor que no binarizar. En ese caso, mejor usar el
        // estiramiento de contraste simple de toda la vida como respaldo.
        var blackCount = 0;
        for (var bi = 0; bi < binarized.length; bi++) { if (binarized[bi] === 0) blackCount++; }
        var blackRatio = blackCount / binarized.length;
        var out;
        if (blackRatio < 0.005 || blackRatio > 0.6) {
          var min = 255, max = 0;
          for (var gi = 0; gi < gray.length; gi++) { if (gray[gi] < min) min = gray[gi]; if (gray[gi] > max) max = gray[gi]; }
          var range = Math.max(1, max - min);
          out = new Uint8ClampedArray(gray.length);
          for (var gi2 = 0; gi2 < gray.length; gi2++) { out[gi2] = ((gray[gi2] - min) * 255) / range; }
        } else {
          out = binarized;
        }

        for (var i3 = 0, p3 = 0; i3 < d.length; i3 += 4, p3++) {
          d[i3] = d[i3 + 1] = d[i3 + 2] = out[p3];
        }
        ctx.putImageData(imgData, 0, 0);

        // Enderezado (deskew): una foto tomada "a pulso" casi nunca queda
        // perfectamente recta — el papel queda unos grados inclinado. Eso
        // hace que Tesseract lea las líneas mezcladas entre sí (el modo
        // PSM que usamos asume texto más o menos horizontal). Detectamos
        // el ángulo real de inclinación del TEXTO (no de toda la foto: el
        // fondo/mesa no importa) a partir de los píxeles negros del
        // binarizado, y si hace falta, rotamos la imagen para corregirlo
        // antes de pasarla al lector. Esto endereza rotación (el papel
        // torcido en la mesa); no recorta ni corrige perspectiva de cámara
        // en ángulo (eso ya es "escanear" el documento, mucho más
        // complejo) — para eso sigue ayudando tomar la foto lo más de
        // frente posible.
        var skewAngle = estimateSkewAngleDeg(binarized, cw, ch);
        var finalCanvas = rotateCanvasByAngle(canvas, skewAngle);
        resolve(finalCanvas);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("No se pudo leer la imagen")); };
      img.src = url;
    });
  }

  // Estima el ángulo (en grados) al que está inclinado el texto de la
  // factura, usando el método clásico de "perfil de proyección": prueba
  // varios ángulos candidatos y, para cada uno, imagina cómo quedarían
  // agrupados los píxeles de texto en filas horizontales si la imagen se
  // rotara ese ángulo. Cuando el ángulo es el correcto, el texto cae en
  // bandas horizontales bien marcadas (cada línea de texto = una banda
  // densa, con espacio en blanco entre líneas), lo que da un puntaje alto;
  // con el ángulo equivocado, el texto queda repartido de forma pareja y
  // borrosa entre filas, dando un puntaje bajo. No hace falta rotar la
  // imagen de verdad para probar cada ángulo candidato — solo proyectar
  // matemáticamente las coordenadas de los píxeles oscuros, lo que lo hace
  // rápido incluso probando muchos ángulos.
  function estimateSkewAngleDeg(binGray, w, h) {
    // Trabaja sobre una versión reducida (máx. ~700px) para que la
    // búsqueda de ángulo sea rápida — el ángulo de inclinación no cambia
    // al reducir la imagen, solo la cantidad de píxeles a revisar.
    var maxDim = 700;
    var scale = Math.min(1, maxDim / Math.max(w, h));
    var sw = Math.max(1, Math.round(w * scale)), sh = Math.max(1, Math.round(h * scale));
    var darkX = [], darkY = [];
    for (var y = 0; y < sh; y++) {
      var srcY = Math.min(h - 1, Math.round(y / scale));
      for (var x = 0; x < sw; x++) {
        var srcX = Math.min(w - 1, Math.round(x / scale));
        if (binGray[srcY * w + srcX] === 0) { darkX.push(x); darkY.push(y); }
      }
    }
    // muy poco texto detectado (foto casi en blanco, o el binarizado no
    // sirvió) — no hay suficiente señal como para confiar en un ángulo
    if (darkX.length < 40 || darkX.length > sw * sh * 0.5) return 0;

    // búsqueda gruesa: de -15° a 15° en pasos de 1° (cubre el rango típico
    // de una foto tomada a pulso; una inclinación mayor a eso ya se nota a
    // simple vista al tomar la foto y conviene repetirla)
    var bestAngle = 0, bestScore = -1;
    for (var a = -15; a <= 15; a += 1) {
      var score = projectionScore(darkX, darkY, a);
      if (score > bestScore) { bestScore = score; bestAngle = a; }
    }
    // búsqueda fina alrededor del mejor ángulo grueso, para afinar la
    // corrección (±1°, en pasos de 0.2°)
    var refined = bestAngle, bestScore2 = bestScore;
    for (var a2 = bestAngle - 1; a2 <= bestAngle + 1; a2 += 0.2) {
      var score2 = projectionScore(darkX, darkY, a2);
      if (score2 > bestScore2) { bestScore2 = score2; refined = a2; }
    }
    return Math.round(refined * 10) / 10;
  }

  // Puntaje de "qué tan bien se alinean en filas horizontales" los píxeles
  // oscuros (xs, ys) si la imagen se rotara angleDeg grados. Usa la MISMA
  // fórmula de proyección que rotateCanvasByAngle usa para rotar de
  // verdad (x*sin + y*cos), a propósito: así el ángulo que da el mejor
  // puntaje aquí es exactamente el ángulo que hay que pasarle a
  // rotateCanvasByAngle para enderezar la imagen — sin tener que adivinar
  // signos de rotación por separado en los dos lados.
  function projectionScore(xs, ys, angleDeg) {
    var rad = angleDeg * Math.PI / 180;
    var sin = Math.sin(rad), cos = Math.cos(rad);
    var n = xs.length;
    var proj = new Int32Array(n);
    var minP = Infinity, maxP = -Infinity;
    for (var i = 0; i < n; i++) {
      var p = Math.round(xs[i] * sin + ys[i] * cos);
      proj[i] = p;
      if (p < minP) minP = p;
      if (p > maxP) maxP = p;
    }
    var span = maxP - minP + 1;
    var hist = new Int32Array(span);
    for (var j = 0; j < n; j++) hist[proj[j] - minP]++;
    var score = 0;
    for (var k = 0; k < span; k++) score += hist[k] * hist[k];
    return score;
  }

  // Rota el canvas angleDeg grados para enderezar el texto detectado por
  // estimateSkewAngleDeg (misma fórmula/convención de ángulo que
  // projectionScore, así que no hace falta invertir el signo). Agranda el
  // lienzo lo necesario para que no se corten las esquinas al rotar, y
  // rellena el espacio nuevo de blanco (igual que el papel), no de negro,
  // para no confundir al OCR con un borde oscuro.
  function rotateCanvasByAngle(canvas, angleDeg) {
    if (!angleDeg || Math.abs(angleDeg) < 0.3) return canvas; // tan poco que no vale la pena rotar
    var rad = angleDeg * Math.PI / 180;
    var w = canvas.width, h = canvas.height;
    var sin = Math.abs(Math.sin(rad)), cos = Math.abs(Math.cos(rad));
    var newW = Math.max(1, Math.round(w * cos + h * sin));
    var newH = Math.max(1, Math.round(w * sin + h * cos));
    var rotated = document.createElement("canvas");
    rotated.width = newW; rotated.height = newH;
    var rctx = rotated.getContext("2d");
    rctx.fillStyle = "#fff";
    rctx.fillRect(0, 0, newW, newH);
    rctx.translate(newW / 2, newH / 2);
    rctx.rotate(rad);
    rctx.drawImage(canvas, -w / 2, -h / 2);
    return rotated;
  }

  // Umbral adaptativo local (variante del método de Bradley/Roth): usa una
  // "imagen integral" (suma acumulada) para poder calcular el promedio de
  // brillo de la zona alrededor de cada píxel en tiempo constante, en vez
  // de recorrer esa zona píxel por píxel cada vez (sería demasiado lento
  // en una foto de 2000px). Un píxel se vuelve negro si es notablemente
  // más oscuro que el promedio de SU zona (t = 15% por debajo) — eso es lo
  // que distingue trazos de tinta del papel que los rodea, así el papel
  // tenga sombra de un lado y luz del otro.
  function adaptiveThresholdBinarize(gray, w, h) {
    var integral = new Float64Array((w + 1) * (h + 1));
    for (var y = 0; y < h; y++) {
      var rowSum = 0;
      var rowBase = y * w;
      var intRowBase = (y + 1) * (w + 1);
      var intPrevRowBase = y * (w + 1);
      for (var x = 0; x < w; x++) {
        rowSum += gray[rowBase + x];
        integral[intRowBase + x + 1] = integral[intPrevRowBase + x + 1] + rowSum;
      }
    }
    var windowSize = Math.max(15, Math.round(Math.min(w, h) / 8));
    var half = Math.floor(windowSize / 2);
    var t = 0.15;
    var out = new Uint8ClampedArray(w * h);
    for (var yy = 0; yy < h; yy++) {
      var y1 = Math.max(0, yy - half), y2 = Math.min(h - 1, yy + half);
      for (var xx = 0; xx < w; xx++) {
        var x1 = Math.max(0, xx - half), x2 = Math.min(w - 1, xx + half);
        var count = (x2 - x1 + 1) * (y2 - y1 + 1);
        var sum = integral[(y2 + 1) * (w + 1) + (x2 + 1)] - integral[y1 * (w + 1) + (x2 + 1)] - integral[(y2 + 1) * (w + 1) + x1] + integral[y1 * (w + 1) + x1];
        var mean = sum / count;
        out[yy * w + xx] = (gray[yy * w + xx] < mean * (1 - t)) ? 0 : 255;
      }
    }
    return out;
  }

  // IMPORTANTE: cuando este archivo se abre directo desde el disco (file://)
  // el navegador lo trata como "origen nulo", y ahí un Worker no puede hacer
  // importScripts() hacia OTRO blob (falla con "Failed to execute
  // importScripts"). Por eso todo el motor de lectura de texto (worker +
  // núcleo + WASM) va empaquetado como un ÚNICO blob, sin llamadas
  // encadenadas entre blobs distintos. Ese único blob ya viene armado en
  // __VITO_OCR2__.workerCombinedSrc (ver build_offline2.py).
  function getOfflineWorker() {
    if (offlineWorkerPromise) return offlineWorkerPromise;
    offlineWorkerPromise = (async function () {
      await window.ventoCargarLib('lib/vento-ocr.js', function(){ return window.__VITO_OCR2__; });
      var D = window.__VITO_OCR2__;
      // Este archivo pesa ~12-13 MB porque lleva el lector de texto
      // incluido para que funcione sin internet. Si window.__VITO_OCR2__ o
      // Tesseract no existen, casi siempre es porque la descarga del
      // archivo quedó incompleta (WhatsApp, un enlace compartido o una
      // conexión lenta pueden cortar un archivo tan grande a la mitad sin
      // avisar) — no es que falte configurar algo.
      if (!D || !D.workerCombinedSrc || !D.spaTraineddataB64 || typeof Tesseract === "undefined") {
        throw new Error("El lector de facturas no cargó completo (lib/vento-ocr.js). Revisa la conexión y vuelve a intentarlo.");
      }
      var workerURL = URL.createObjectURL(new Blob([D.workerCombinedSrc], { type: "application/javascript" }));
      // El idioma (2,8 MB en base64) se decodifica con fetch: el bucle de atob trababa la pantalla al primer uso.
      var spaBytes;
      try { spaBytes = new Uint8Array(await (await fetch("data:application/octet-stream;base64," + D.spaTraineddataB64)).arrayBuffer()); }
      catch (eB64) { spaBytes = b64ToUint8Array(D.spaTraineddataB64); }

      var worker = await Tesseract.createWorker(
        [{ code: "spa", data: spaBytes }],
        (Tesseract.OEM ? Tesseract.OEM.LSTM_ONLY : 1),
        {
          corePath: "vito-core-inline.js", // marcador especial: el worker combinado lo intercepta y no sale a red
          workerPath: workerURL,
          workerBlobURL: false, // el blob YA es el worker completo, no lo envuelvas en otro importScripts
          cacheMethod: "none",
          gzip: true,
          // Progreso real de la lectura (0 a 1) durante "recognizing text": se
          // lo pasamos a la barra de progreso de la pantalla (window.__vitoOcrProgress,
          // definida en el archivo principal) cuando existe; si no hay barra
          // escuchando (o venimos de otra pantalla), simplemente no hace nada.
          logger: function (m) {
            if (m && m.status === "recognizing text" && typeof m.progress === "number" && typeof window.__vitoOcrProgress === "function") {
              try { window.__vitoOcrProgress(m.progress); } catch (e) { /* noop */ }
            }
          }
        }
      );
      // Ajustes para que la lectura sea más rápida sin perder precisión:
      // - PSM 6 ("un solo bloque uniforme de texto") evita que Tesseract
      //   pierda tiempo detectando orientación/columnas de página completa
      //   (el modo automático por defecto), y mantiene mejor el orden de
      //   lectura línea por línea que modos más agresivos como "columna
      //   única", que en facturas con tablas de varias columnas termina
      //   mezclando el texto y saliendo MÁS lento (reintentos internos).
      // - Desactivamos el diccionario/corrector de palabras: en una factura
      //   la mayoría de "palabras" son códigos, precios y nombres de marca
      //   que no están en el diccionario de español, así que ese trabajo
      //   extra solo hace más lento el reconocimiento sin mejorar nada.
      try {
        await worker.setParameters({
          tessedit_pageseg_mode: (Tesseract.PSM && Tesseract.PSM.SINGLE_BLOCK) || "6",
          preserve_interword_spaces: "1",   // el texto sale tal cual (con sus espacios y columnas), sin juntar palabras
          load_system_dawg: "0",
          load_freq_dawg: "0",
          load_punc_dawg: "0",
          load_number_dawg: "0",
          load_unambig_dawg: "0",
          load_bigram_dawg: "0",
          load_fixed_length_dawgs: "0"
        });
      } catch (e) { /* si algún parámetro no existe en esta build, seguimos con los valores por defecto */ }
      return worker;
    })();
    // Si falla (ej. archivo incompleto), no dejamos la promesa rota
    // guardada para siempre: así, si el usuario vuelve a intentar después
    // de descargar bien el archivo (o recarga la página), puede reintentar.
    offlineWorkerPromise.catch(function () { offlineWorkerPromise = null; });
    return offlineWorkerPromise;
  }

  // ---------------------------------------------------------------------
  // Intenta armar productos a partir del texto crudo leído por OCR.
  // Sin IA no podemos "entender" la factura como Gemini, así que probamos
  // varias formas típicas de factura colombiana, una tras otra, y usamos
  // la que más productos logre separar. Nunca se guardan solos: siempre
  // pasan por la pantalla de revisión para que el usuario confirme.
  // ---------------------------------------------------------------------

  var HEADER_SKIP_RE = /^(total|subtotal|iva\b|nit\b|factura|fecha|cliente|cufe|resoluci[oó]n|forma de pago|vendedor|c[oó]digo|art[ií]culo|empaque|cant\.?$|ahorraste|impuestos?:|precio:|comprobante|p[aá]gina|orden|pedido)/i;

  // Vocabulario de metadatos de factura/tirilla (no productos): número de
  // resolución/autorización DIAN, CUFE, vigencia, fecha, hora, nombre del
  // cajero/vendedor, totales, etc. A diferencia de HEADER_SKIP_RE (que solo
  // mira el INICIO de la línea), esto busca en cualquier parte de la línea,
  // porque el OCR a veces pega ese texto pegado a otra cosa. Se usa tanto
  // en la estrategia de tirilla POS (para no confundir, ej., "Autoriza
  // 4500001 - 470000" con un par de precios — ambos números quedan
  // pegados con un solo espacio, exactamente como un precio real) como en
  // el respaldo genérico.
  // "total"/"subtotal"/"pagar" van SIN límite de palabra (\b) a propósito:
  // el OCR a veces pega "TOTAL A PAGAR" como "TOTALA PAGAR" o similar, y
  // con \b esa variante glued se cuela sin filtrar (fue un bug real).
  var FACTURA_METADATA_JUNK_RE = /autoriz|resoluci|vigencia|consecutivo|cufe|\bdian\b|responsable|condici[oó]n|identificaci[oó]n|\bcajero\b|\bcliente\b|impres|factura|\bnro\b|\brango\b|\bfact\b|p\.?o\.?s\b|\bhora\b|\bvalor\b|\bfecha\b|\bvendedor\b|subtotal|total|pagar/i;

  // Vocabulario de marcas y palabras típicas de facturas de tienda de barrio
  // en Colombia (cervezas/bebidas alcohólicas, gaseosas, canasta familiar).
  // Se usa para corregir errores comunes de OCR sobre fotos borrosas —
  // por ejemplo "AGUlLA" -> "AGUILA", "330eM3" -> "330cm3" — ANTES de
  // intentar separar los productos, para que el nombre quede más limpio
  // y las unidades de medida no se confundan con números de la factura.
  var KNOWN_BRAND_WORDS = [
    // Cervezas y bebidas alcohólicas (Bavaria / AB InBev y otras)
    "Aguila", "Águila", "Poker", "Club Colombia", "Costeña", "Costena", "Pilsen",
    "Redd's", "Redds", "Corona", "Coronita", "Michelob", "Michelob Ultra",
    "Stella Artois", "Budweiser", "BBC", "Cerveza Andina", "Cola y Pola",
    "Pony Malta", "Peroni", "Apple Ale", "Leona", "Cerveza 3 Cordilleras",
    "Cabra", "Nevada",
    // Gaseosas y bebidas (Postobón, Coca-Cola)
    "Coca-Cola", "Coca Cola", "Postobón", "Postobon", "Colombiana", "Pony Malta",
    "Manzana Postobón", "Uva Postobón", "Hit", "Mr Tea", "Peak", "Squash",
    "Agua Cristal", "Agua Manantial", "Agua Zalva", "Sprite", "Fanta",
    "Quatro", "Del Valle", "Pepsi", "Gatorade", "Speed Max", "Red Bull",
    // Snacks y paquetes (Super Ricas, Colombina, Frito Lay, Yupi, Quala)
    "Super Ricas", "Platanitos", "Yupi", "Detodito", "Margarita", "Chitos",
    "Doritos", "Fritos", "Papas Margarita",
    // Dulces / confitería (Colombina, Dulcenet, Dulmarcas, Nutresa)
    "Bon Bon Bum", "Colombina", "Coffee Delight", "Frunas", "Chocorramo",
    "Choco Break", "Festival", "Jet", "Trululu", "Sunki", "Menta Larga",
    "Halls", "Mentho Lyptus",
    // Aseo y hogar (Quala, Familia, Alpina básicos de tienda)
    "Jabon Rey", "Jabón Rey", "Fab", "Ariel", "Ace", "Axion", "Dersa",
    "Familia", "Scott", "Pequeñin", "Nosotras", "Ayudín", "Ayudin",
    // Café e instantáneos (Quala, Nescafé, Zenú)
    "Nescafé", "Nescafe", "Colcafé", "Colcafe", "Frutiño", "Fruco",
    "Doña Arepa", "Saltín", "Saltin", "Noel", "Zenú", "Zenu", "Rica",
    // Abarrotes básicos de canasta familiar
    "Diana", "Roa", "Aceite Gourmet", "Arroz Diana", "Panela", "Bienestarina",
    "Leche Alpina", "Alpina", "Alquería", "Alqueria", "Colanta", "Avena",
    "Huevos", "Pan Bimbo", "Bimbo",
    // Licores (aguardientes, rones) comunes en cigarrerías bogotanas
    "Aguardiente Nectar", "Néctar Club", "Nectar Club", "Aguardiente Amarillo",
    "Pionero", "Aguardiente Antioqueño", "Antioqueño", "Ron Medellín", "Ron Medellin",
    "Ron Viejo de Caldas", "Old Parr", "Aguardiente Blanco del Valle", "Tapa Roja",
    // Aseo/detergentes (formatos doypack de distribuidoras como Confisprensa)
    "Det Liq", "Detergente Líquido", "Detergente Liquido", "Doypack", "Neko",
    "Neko Avena",
    // Galletas y chicles (Mondelez/DulceNET — Oreo, Trident, Chiclets)
    "Oreo", "Oreo Regular", "Trident", "Trident Menta", "Chiclets", "Halls Mentho",
    "Club Social", "Ritz", "Tang"
  ];
  // Correcciones específicas de palabras que Tesseract confunde seguido en
  // facturas colombianas (unidades de medida, símbolos, marcas comunes).
  var OCR_FIX_PAIRS = [
    [/\b(\d+)\s?[eE][mM]3\b/g, "$1cm3"],      // "330eM3" -> "330cm3"
    [/\b(\d+)\s?crn3\b/gi, "$1cm3"],           // "crn3" -> "cm3" (m/rn confundidos)
    [/\bcc\b/gi, "cm3"],
    [/\bAGU[IL1][L1]A\b/gi, "AGUILA"],
    [/\bC0CA\b/gi, "COCA"],
    [/\bC0LOMBIA\b/gi, "COLOMBIA"],
    [/\bP0KER\b/gi, "POKER"]
  ];
  function normalizeOcrText(text) {
    OCR_FIX_PAIRS.forEach(function (pair) {
      text = text.replace(pair[0], pair[1]);
    });
    // Limpieza extra de ruido típico de fotos de tabla (facturas tipo "nota
    // de pedido" con columnas Código/Cant/U-M/Sub-Total/IVA/Total): el OCR
    // a veces pega un punto suelto justo después de un número corto que
    // debería ir seguido de un espacio (ej. código "11090047." o cantidad
    // "2." antes de "UN") — eso rompe los regex que esperan un espacio ahí.
    // El lookahead (?=\s) evita tocar puntos que SÍ son decimales reales
    // (esos siempre están pegados al siguiente dígito, nunca a un espacio).
    text = text.replace(/(\d{1,8})\.(?=\s)/g, "$1");
    // También limpia símbolos sueltos que el OCR mete entre columnas de
    // números por ruido de la foto (paréntesis, barras, virgulillas) —
    // no aportan nada y solo rompen los regex de columnas numéricas.
    text = text.replace(/[()|~§]/g, " ");
    // Un ":" metido ENTRE dos dígitos casi siempre es ruido del OCR sobre
    // una "," o un "." reales (pasa seguido en montos: "$3:36,994" en vez
    // de "$336,994", "$12:246" en vez de "$12,246") — lo quitamos entero
    // en vez de reemplazarlo por una coma, porque así el número queda con
    // el valor correcto sin importar en qué grupo cayó el ":" (probamos
    // esto contra fotos reales). Esto también "arruina" horas como
    // "13:01:18" (quedan "130118"), pero esa hora nunca se usa para nada,
    // así que no hay ningún costo real.
    text = text.replace(/(\d):(?=\d)/g, "$1");
    return text;
  }

  // Convierte un texto de número con formato colombiano ("1.026.624,4" o
  // "126.382,7" o "2.477") a número real. Colombia usa punto para miles y
  // coma para decimales.
  function parseColombianNumber(s) {
    s = String(s).trim().replace(/%/g, "");
    var hasDot = s.indexOf(".") !== -1;
    var hasComma = s.indexOf(",") !== -1;
    if (hasDot && hasComma) {
      // el separador que aparece MÁS A LA DERECHA es el decimal; el otro,
      // el de miles. Cubre tanto "126.382,7" (Colombia) como "12,750.00"
      // (formato internacional que también aparece en algunas facturas).
      if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
        s = s.replace(/\./g, "").replace(",", ".");
      } else {
        s = s.replace(/,/g, "");
      }
    } else if (hasComma) {
      // solo coma: en Colombia casi siempre es decimal ("2,5"), PERO varias
      // distribuidoras (ej. "CCESTAN FORCE", notas de pedido) usan la coma
      // como separador de MILES sin decimales ("8,401" = 8401, no 8.401).
      // Si después de la ÚLTIMA coma hay exactamente 3 dígitos y no hay
      // más comas de por medio, es separador de miles (los pesos
      // colombianos no usan centavos con 3 cifras). Si son 1-2 dígitos,
      // sí es un decimal real.
      var partsComma = s.split(",");
      var lastComma = partsComma[partsComma.length - 1];
      if (partsComma.length > 2 || lastComma.length === 3) {
        s = s.replace(/,/g, "");
      } else {
        s = s.replace(",", ".");
      }
    } else if (hasDot) {
      // sin coma: los puntos son de miles casi siempre en facturas
      // ("126.382"), salvo que el último grupo tenga 1-2 dígitos, que
      // sugiere un decimal corto en vez de miles ("2.5" cantidad, no "2500").
      var partsDot = s.split(".");
      var lastDot = partsDot[partsDot.length - 1];
      if (partsDot.length > 2 || lastDot.length === 3) {
        s = s.replace(/\./g, "");
      }
      // si length es 1-2, se deja el único punto como decimal
    }
    var n = parseFloat(s);
    return isFinite(n) ? n : NaN;
  }

  // Algunas facturas (ej. Confisprensa) usan formato "internacional": coma
  // para miles y punto para decimales ("5,891" = 5891; "0.00" = 0). Es lo
  // contrario a como Colombia suele escribir plata en las facturas de
  // distribuidores locales, así que va en una función aparte para no mezclar
  // los dos formatos por accidente.
  function parseUsNumber(s) {
    s = String(s).trim().replace(/,/g, "");
    var n = parseFloat(s);
    return isFinite(n) ? n : NaN;
  }

  // Busca en el texto del producto (nombre + presentación) cuántas unidades
  // individuales trae cada caja/paquete/display, para poder calcular el
  // precio por unidad y no solo por caja. Reconoce formas típicas de
  // facturas colombianas: "x30 uds", "x12", "caja x24", "display x10
  // sobres", "30 - 30 Uds", "x6uds", etc. Si no encuentra nada, asume 1
  // (la unidad comprada ya es la que se vende individual).
  // "x30 uds", "x12 unidades" (con palabra de unidad explícita) siempre cuenta.
  var UNITS_PER_PACK_RE = /\bx\s*(\d{1,4})\s*(uds?|unid(?:ad(?:es)?)?|sobres?|bolsas?)\b/i;
  // "x30" solo (sin palabra), pero SOLO si lo que sigue NO es una unidad de
  // volumen/peso/medida (cc, cm3, ml, gr, grs, kg, lt, l, °) — así no
  // confundimos "X 250 CC" (250 centímetros cúbicos de UNA botella) con
  // "30 unidades por caja".
  var UNITS_PER_PACK_RE_BARE = /\bx\s*(\d{1,4})\b(?!\s*(?:cc\b|cm3\b|ml\b|mls\b|gr\b|grs?\b|gramos?\b|kg\b|lt\b|l\b|°|grados?\b))/i;
  var UNITS_PER_PACK_RE2 = /\b(?:caja|paquete|display|bandeja|fardo)\s*(?:de\s*)?x?\s*(\d{1,4})\b/i;
  // Igual que UNITS_PER_PACK_RE_BARE, pero SIN exigir un límite de palabra
  // (\b) antes de la "x": cuando el OCR pega el nombre sin espacios
  // ("AGUILABTX30"), no hay ningún límite entre la "T" y la "X", así que
  // el patrón de arriba nunca calza ahí. Este es el último recurso, más
  // permisivo — por eso se prueba al final y con el mismo tope de 60.
  var UNITS_PER_PACK_RE_GLUED = /x(\d{1,3})(?!\d)(?!\s*(?:cc\b|cm3\b|ml\b|mls\b|gr\b|grs?\b|gramos?\b|kg\b|lt\b|l\b|°|grados?\b))/i;
  function detectUnitsPerPack(text) {
    var m = text.match(UNITS_PER_PACK_RE) || text.match(UNITS_PER_PACK_RE2);
    if (m) {
      var n = parseInt(m[1], 10);
      if (n > 1 && n <= 500) return n;
    }
    // El "x30" sin palabra de unidad es el caso más ambiguo (puede ser
    // volumen de una botella, como "X 375"): solo lo aceptamos hasta 60,
    // rango típico de unidades por caja/paquete en una tienda, para no
    // confundirlo con mililitros/centímetros cúbicos de una sola botella.
    var mBare = text.match(UNITS_PER_PACK_RE_BARE);
    if (mBare) {
      var nBare = parseInt(mBare[1], 10);
      if (nBare > 1 && nBare <= 60) return nBare;
    }
    var mGlued = text.match(UNITS_PER_PACK_RE_GLUED);
    if (mGlued) {
      var nGlued = parseInt(mGlued[1], 10);
      if (nGlued > 1 && nGlued <= 60) return nGlued;
    }
    return 1;
  }

  // Tope de precio de seguridad: ningún producto de una tienda de barrio
  // (cigarrería/cervecería) cuesta esto por caja/paquete comprado. Existe
  // para blindar TODAS las estrategias (no solo la genérica) contra texto
  // mal leído por el OCR que arma un número disparatado — ej. un número de
  // resolución DIAN, un CUFE, o dos números pegados por error — que de otro
  // modo se colaría como "precio" y dejaría un producto con costos
  // absurdos (millones o miles de millones) en la pantalla de revisión.
  var MAX_PRECIO_RAZONABLE = 5000000; // 5 millones de pesos por línea, con margen amplio
  // Código de empaque típico de cerveceras/distribuidoras colombianas:
  // "BOT" (botella) casi siempre viene en caja/paquete de varias unidades
  // (el "X30" ahí sí describe cuántas botellas trae la caja comprada), pero
  // "LT" (LATA) en el nombre indica que la línea se vendió por LATA suelta,
  // no por caja — el "X24"/"X30" que sigue es solo el código de referencia
  // del producto en el catálogo del proveedor (la presentación de caja que
  // ESE producto tiene disponible), no la cantidad que él compró en esta
  // línea puntual. Por eso "LT X##" pegado al nombre anula la separación
  // por caja: el precio ya es por unidad individual.
  // Sin "\b" antes de "lt": cuando el OCR pega el nombre sin espacios
  // ("CLUBCOLOMBIALTX24"), no hay ningún límite de palabra entre la "A"
  // de "COLOMBIA" y la "L" de "LT" — igual que con los demás patrones
  // "pegados" de este archivo, hay que buscarlo sin exigir ese límite.
  var LATA_INDIVIDUAL_RE = /lt\s*x\s*\d/i;
  function makeItem(nombre, cant, precio, presentacion) {
    nombre = nombre.replace(/[\s.\-–_,:=~§|]+$/, "").replace(/^[\s.\-–_,:=~§|]+/, "").trim();
    if (nombre.length < 3 || !/[A-Za-zÁÉÍÓÚÑáéíóúñ]{2,}/.test(nombre)) return null;
    if (!cant || !precio || cant <= 0 || precio <= 0 || cant > 99999 || precio > MAX_PRECIO_RAZONABLE) return null;
    // "precio" que llega aquí es el costo de CADA CAJA/PAQUETE comprado
    // (no de la unidad individual). Si detectamos cuántas unidades trae
    // cada caja, la dejamos guardada aparte — computeRow() se encarga de
    // dividir el costo total entre las unidades reales para sacar el
    // precio y la ganancia por unidad individual.
    var textoParaEmpaque = (nombre + " " + (presentacion || "")).trim();
    var unidadesPorCaja = LATA_INDIVIDUAL_RE.test(textoParaEmpaque) ? 1 : detectUnitsPerPack(textoParaEmpaque);
    return {
      producto: nombre,
      presentacion: presentacion || "",
      cantidad_cajas: cant,
      unidades_por_caja: unidadesPorCaja,
      precio_unitario_sin_iva: Math.round(precio), // costo por caja/paquete comprado
      iva_pct: 0.19,
      categoria_sugerida: "",
      presentacion_asumida: true
    };
  }

  // Igual que makeItem, pero para formatos de factura donde el número que
  // detectamos (total de la línea / cantidad) YA incluye todos los
  // impuestos (IVA, impuesto al consumo, etc.) — ej. facturas de licores
  // con impoconsumo por unidad, donde desglosar cada impuesto por separado
  // no aporta nada útil al tendero. Guardamos iva_pct en 0 para no volver
  // a sumar impuestos que ya están incluidos en el costo por unidad.
  function makeItemFromTotal(nombre, cant, precioUnitConImpuestos, presentacion) {
    var it = makeItem(nombre, cant, precioUnitConImpuestos, presentacion);
    if (it) it.iva_pct = 0;
    return it;
  }

  // --- Estrategia A: factura tipo "app de proveedor" (Bavaria, Postobón, etc.) ---
  // Cada producto es un BLOQUE de varias líneas:
  //   Línea ancla:   Nombre base ... Cant  $  Total          (tiene "$" y un monto)
  //   Líneas siguientes: más texto del nombre/presentación, SIN números de precio
  // hasta la próxima línea ancla. Ej:
  //   "Cerveza 30 330cm3 2.0 $ 126.382,7"
  //   "Poker"
  //   "Retornable"
  //   "330cm3 x30 uds"
  var ANCHOR_WITH_DOLLAR_RE = /^(.*?)\s+(\d+(?:[.,]\d+)?)\s*\$\s*([\d.,]+)\s*$/;
  function parseAnchorBlocks(lines) {
    var items = [];
    var i = 0;
    while (i < lines.length) {
      var line = lines[i];
      if (HEADER_SKIP_RE.test(line)) { i++; continue; }
      var m = line.match(ANCHOR_WITH_DOLLAR_RE);
      if (m) {
        var nombreBase = m[1].trim();
        // la cantidad aquí es un decimal simple tipo "2.0" o "1.0" (NO tiene
        // separador de miles como el monto), así que se parsea directo con punto.
        var cant = parseFloat(String(m[2]).replace(",", "."));
        var total = parseColombianNumber(m[3]);
        // junta las líneas de continuación (sin "$", sin ser otra ancla) como presentación/marca
        var contLines = [];
        var j = i + 1;
        while (j < lines.length && !HEADER_SKIP_RE.test(lines[j]) && !ANCHOR_WITH_DOLLAR_RE.test(lines[j]) && contLines.length < 5) {
          // una línea de continuación no debería ser solo números/moneda
          if (/^[\d.,$\s]+$/.test(lines[j])) break;
          contLines.push(lines[j]);
          j++;
        }
        var presentacion = contLines.join(" ").trim();
        var nombreCompleto = (nombreBase + (presentacion ? " " + presentacion : "")).replace(/\s+/g, " ").trim();
        // el total de la línea ancla es el costo de TODA la línea (cant × precio unidad);
        // si cant es válido, derivamos el precio unitario. Si cant es 0/1 raro, usamos el total como precio.
        var precioUnit = (cant && cant > 0) ? (total / cant) : total;
        var it = makeItem(nombreCompleto, Math.round(cant) || 1, precioUnit, presentacion);
        if (it) items.push(it);
        i = j;
      } else {
        i++;
      }
    }
    return items;
  }

  // --- Estrategia B: una sola línea con "nombre ... cantidad ... precio" ---
  // Ej: "Jabon Rey 300 gramos     6     2477"
  var SINGLE_LINE_RE = /^(.*?[A-Za-zÁÉÍÓÚÑáéíóúñ].*?)\s+([\d.,]{1,3}(?:[.,]\d{3})*|\d{1,4})\s+([\d.,]{4,}(?:[.,]\d{2,3})?)\s*(?:[\d.,]{4,})?$/;
  function parseSingleLines(lines) {
    var items = [];
    lines.forEach(function (line) {
      if (HEADER_SKIP_RE.test(line)) return;
      var m = line.match(SINGLE_LINE_RE);
      if (!m) return;
      var nombre = m[1];
      var cant = parseInt(String(m[2]).replace(/[.,]/g, ""), 10);
      var precio = parseColombianNumber(m[3]);
      var it = makeItem(nombre, cant, precio, "");
      if (it) items.push(it);
    });
    return items;
  }

  // --- Estrategia C: columnas separadas por 2+ espacios (texto de tabla con buen espaciado) ---
  // Ej: "Coca Cola 400ml x12    3    8.900"
  function parseSpacedColumns(lines) {
    var items = [];
    lines.forEach(function (line) {
      if (HEADER_SKIP_RE.test(line)) return;
      var cols = line.split(/\s{2,}/).map(function (c) { return c.trim(); }).filter(Boolean);
      if (cols.length < 2) return;
      var nombre = cols[0];
      if (!/[A-Za-zÁÉÍÓÚÑáéíóúñ]{2,}/.test(nombre)) return;
      var nums = cols.slice(1).map(parseColombianNumber).filter(function (n) { return isFinite(n) && n > 0; });
      if (nums.length === 0) return;
      var cant = 1, precio;
      if (nums.length >= 2) { cant = Math.round(nums[0]); precio = nums[1]; }
      else { precio = nums[0]; }
      var it = makeItem(nombre, cant, precio, "");
      if (it) items.push(it);
    });
    return items;
  }

  // --- Estrategia D: factura tipo "distribuidor de licores/abarrotes con impoconsumo" ---
  // (ej. Representaciones Continental — aguardientes). Cada línea:
  //   CODIGO  DESCRIPCION...  CANT  UND  PRECIO_UNIT  %IVA  IMPTO_CONSUMO  TOTAL_LINEA  TIPO_POSICION
  // Ej: "10000031 AGUARDIENTE NECTAR CLUB TETRA X 250 CC 4 UN 7.661 5 4.766 51.240 Posición normal"
  // El total de la línea ya incluye IVA + impoconsumo, así que derivamos el
  // costo real por unidad como total_linea / cantidad (más preciso que
  // recalcular impuestos por separado, que varían por tipo de producto).
  // Lista de unidades de medida ampliada: además de las típicas de
  // facturas de licores (UN/UND/CJ/PAQ/DIS/CJA), incluye las que aparecen
  // en "notas de pedido" de distribuidoras de abarrotes (BS = "bolsa" o
  // "bulto", KG, GR, LB, GL, DOC, ROL, SET, PAR, BOL) para no depender de
  // adivinar cada distribuidor nuevo uno por uno.
  var RE_CODIGO_DESC_TOTAL = /^(\d{4,8})\s+(.+?)\s+(\d{1,4})\s+(UN|UND|CJ|PAQ|DIS|CJA|BS|KG|GR|LB|GL|DOC|ROL|SET|PAR|BOL|MT|MTS|LT|LTS)\s+([\d.,]+)\s+(\d{1,2})\s+([\d.,]+)\s+([\d.,]+)\s+(\S.*)?$/i;
  function parseCodigoDescTotal(lines) {
    var items = [];
    lines.forEach(function (line) {
      if (HEADER_SKIP_RE.test(line)) return;
      var m = line.match(RE_CODIGO_DESC_TOTAL);
      if (!m) return;
      var nombre = m[2];
      var cant = parseInt(m[3], 10);
      var totalLinea = parseColombianNumber(m[8]);
      if (!cant || !totalLinea) return;
      var precioUnitConImpuestos = totalLinea / cant;
      var it = makeItemFromTotal(nombre, cant, precioUnitConImpuestos, "");
      if (it) items.push(it);
    });
    return items;
  }

  // --- Estrategia D2: igual que D pero para UNIDADES DE MEDIDA nuevas/desconocidas ---
  // No podemos anticipar la sigla exacta que use cada distribuidora nueva
  // (además de UN/CJ/BS ya cubiertas en la Estrategia D pueden aparecer
  // otras). En vez de mantener una lista infinita, esta estrategia acepta
  // CUALQUIER sigla de 1 a 4 letras como U/M, y en vez de exigir un número
  // exacto de columnas después (precio, IVA%, otros, total), toma TODOS
  // los números que queden hasta el final de la línea y usa el ÚLTIMO como
  // total de la línea (el total, con impuestos incluidos, siempre va al
  // final en las facturas tabulares colombianas). Así funciona tanto si la
  // factura trae "otros impuestos" como columna aparte como si no.
  // La "cola" (tail) ya NO exige que sea texto 100% limpio de números: en
  // fotos reales el OCR mete algún símbolo suelto de vez en cuando (ver
  // parseCodigoDescGenericTail), así que aceptamos cualquier resto de línea
  // y filtramos token por token más abajo, en vez de invalidar TODA la
  // línea por un solo carácter raro en medio de los números.
  var RE_CODIGO_DESC_TAIL = /^(\d{3,8})\s+(.+?)\s+(\d{1,4})\s+([A-Za-zÁÉÍÓÚÑ]{1,4})\s+(\S.*\d)$/i;
  function parseCodigoDescGenericTail(lines) {
    var items = [];
    lines.forEach(function (line) {
      if (HEADER_SKIP_RE.test(line)) return;
      var m = line.match(RE_CODIGO_DESC_TAIL);
      if (!m) return;
      var nombre = m[2];
      var cant = parseInt(m[3], 10);
      var tailTokens = m[5].trim().split(/\s+/).filter(Boolean);
      // antes de parsear cada token quitamos cualquier símbolo que no sea
      // dígito/coma/punto (paréntesis, barras, etc. que a veces deja el OCR
      // pegados a un número) — así un token como "0)" se limpia a "0" en
      // vez de invalidar toda la línea, y un token que quede vacío (era
      // puro ruido, ej. un ")" suelto) simplemente se ignora.
      var nums = tailTokens
        .map(function (t) { return parseColombianNumber(t.replace(/[^\d.,]/g, "")); })
        .filter(function (n) { return isFinite(n) && n > 0; });
      // se necesitan al menos 2 números (precio y total) para confiar en
      // esta línea; si solo hay uno, es muy ambiguo y mejor no adivinar.
      if (!cant || nums.length < 2) return;
      var totalLinea = nums[nums.length - 1];
      if (!totalLinea) return;
      var precioUnitConImpuestos = totalLinea / cant;
      var it = makeItemFromTotal(nombre, cant, precioUnitConImpuestos, "");
      if (it) items.push(it);
    });
    return items;
  }

  // --- Estrategia E: factura tipo "distribuidor de abarrotes/dulces" (ej. Confisprensa) ---
  // Cada línea (a veces con un número de ítem al inicio):
  //   [#]  CODIGO  DESCRIPCION...  CANT  UM  PRECIO  %IVA  DESCUENTO  DESC%  SUBTOTAL
  // Ej: "1 33038 NEKO AVENA X110GR 1.00 UN 5,891 19 0.00 0 7,010"
  // El "Subtotal" final de la línea ya incluye el IVA, así que igual que en
  // la estrategia D usamos subtotal / cantidad como costo real por unidad.
  // Tolerante a ruido típico del OCR sobre esta tabla: la columna de
  // precio/IVA a veces sale pegada con un "/" en vez de espacio
  // ("5891/19"), y el descuento en 0 a veces se lee como letra "o"/"O" en
  // vez de dígito.
  var RE_ITEM_CODIGO_DESC_SUBTOTAL = /^(?:\d{1,3}\s+)?(\d{3,8})\s+(.+?)\s+([\d.,]{1,6})\s+(UN|DS|CJ|UND|PAQ|BS|KG|GR|LB|GL|DOC|ROL|SET|PAR|BOL)\s+[\d.,\/]+\]?[\s\/]+\d{1,2}\s+[\d.,]+\s+[\dOo]+\s+([\d.,]+)$/i;
  function parseItemCodigoDescSubtotal(lines) {
    var items = [];
    lines.forEach(function (line) {
      if (HEADER_SKIP_RE.test(line)) return;
      var m = line.match(RE_ITEM_CODIGO_DESC_SUBTOTAL);
      if (!m) return;
      var nombre = m[2];
      var cant = Math.round(parseFloat(m[3].replace(",", ".")));
      var subtotal = parseUsNumber(m[5]);
      if (!cant || !subtotal) return;
      var precioUnitConImpuestos = subtotal / cant;
      var it = makeItemFromTotal(nombre, cant, precioUnitConImpuestos, "");
      if (it) items.push(it);
    });
    return items;
  }

  // --- Estrategia E-bis: factura tipo "tabla ancha de distribuidora" (ej.
  // Distribuidora Colombina) --- Parecida a la Estrategia E, pero con MUCHAS
  // más columnas de plata entre el precio y el total (Precio, %Descuento
  // Básico, %Descuento Adicional, $Descuento, Precio Neto, IVA, $IVA, ULT,
  // Precio Final...) y la cantidad de columnas varía según el proveedor. En
  // vez de un regex rígido con un número fijo de columnas (que se rompe en
  // cuanto una factura trae una columna de más o de menos), escaneamos por
  // TOKENS: [ítem] [código] DESCRIPCIÓN... CANTIDAD UNIDAD-DE-MEDIDA
  // [solo números de ahí en adelante], y tomamos el ÚLTIMO número de la
  // línea (el más a la derecha) como el precio final YA con descuento e
  // impuestos — es lo que el negocio realmente paga por esa unidad.
  // Ej: "001 15032 BBB BARRA CRUNCHY ROJO 1 BS 7.692 0,000 0,000 0 7.692 19 1.461 0 9.153"
  //  -> BBB BARRA CRUNCHY ROJO, cant=1, precio final=9.153
  var TABLA_ANCHA_UM_RE = /^(BS|PP|PL|LAT|UN|UND|CJ|PQ|PAQ|KG|GR|LT|ML|DOC|PAR|SET|ROL|BOL|DS|GL|LB)$/i;
  // Este formato SIEMPRE trae muchas columnas de plata (precio, dos
  // descuentos, $descuento, precio neto, IVA, $IVA, ULT, precio final = 9
  // números en la factura real de ejemplo). Exigir varias de esas columnas
  // es justo lo que separa un renglón de producto real de un falso positivo
  // — texto de encabezado/dirección/NIT/nombre de vendedor donde el OCR, por
  // ruido de una foto real, dejó por casualidad algo parecido a una unidad
  // de medida seguida de un solo número suelto (ej. un código postal o un
  // pedazo de teléfono). Las demás estrategias (D, E) ya cubren los formatos
  // con pocas columnas, así que esta puede exigir varias sin perder facturas.
  var TABLA_ANCHA_MIN_COLS_PRECIO = 4;
  function parseTablaAnchaColumnas(lines) {
    var items = [];
    lines.forEach(function (line) {
      if (HEADER_SKIP_RE.test(line)) return;
      if (FACTURA_METADATA_JUNK_RE.test(line)) return;
      // Vocabulario típico de los datos del cliente/dirección/vendedor que
      // trae esta tabla ARRIBA de los productos (no cubierto por el regex
      // genérico de metadatos, que es de facturas/tirillas en general).
      if (/agencia|autopista|carrera\s*\d|contenedor|contribuyente|autoretenedor|c[oó]digo\s*cliente/i.test(line)) return;
      var tokens = line.split(/\s+/).filter(Boolean);
      if (tokens.length < 6) return; // muy corta para ser un renglón de esta tabla
      // Busca la unidad de medida (BS, PP, LAT...): siempre viene justo
      // después de la cantidad comprada, nunca al principio ni al final.
      var umIdx = -1;
      for (var t = 2; t < tokens.length - 1; t++) {
        if (TABLA_ANCHA_UM_RE.test(tokens[t])) { umIdx = t; break; }
      }
      if (umIdx < 2) return; // necesita al menos [ítem] código descripción antes
      var cantTok = tokens[umIdx - 1];
      if (!/^\d{1,4}([.,]\d{1,2})?$/.test(cantTok)) return;
      var cant = Math.round(parseFloat(cantTok.replace(",", ".")));
      if (!cant || cant <= 0 || cant > 9999) return;
      // De la unidad de medida en adelante debe ser SOLO números (precio,
      // descuentos, IVA...) — si aparece texto ahí, esta línea no es de
      // esta tabla y la descartamos (evita falsos positivos).
      var afterUm = tokens.slice(umIdx + 1);
      if (afterUm.length < TABLA_ANCHA_MIN_COLS_PRECIO || !afterUm.every(function (tok) { return /^[\d.,]+%?$/.test(tok); })) return;
      var lastTok = afterUm[afterUm.length - 1].replace("%", "");
      var precioFinal = parseColombianNumber(lastTok);
      if (!precioFinal || precioFinal <= 0) return;
      // Descripción: todo entre el/los código(s) numérico(s) iniciales
      // (ítem + referencia de producto) y la cantidad comprada.
      var descTokens = tokens.slice(0, umIdx - 1);
      while (descTokens.length > 1 && /^\d+$/.test(descTokens[0])) descTokens.shift();
      var nombre = cleanupOcrName(descTokens.join(" "));
      if (nombre.length < 3 || !/[A-Za-zÁÉÍÓÚÑáéíóúñ]{2,}/.test(nombre)) return;
      var it = makeItemFromTotal(nombre, cant, precioFinal / cant, "");
      if (it) items.push(it);
    });
    return items;
  }

  // --- Estrategia F: factura tipo "distribuidor con número de ítem + $ inline" (ej. DulceNET) ---
  // Cada producto es un bloque de 1-2 líneas:
  //   Línea principal: #  [CODIGO]DESCRIPCION...  UM  Cant.  $Precio  IVA%  $PrecioConIVA  $Total
  //   Línea(s) siguientes (opcional): resto del empaque, ej. "12X12X36G" (sin números de precio)
  // Ej: "1 7622210REO 36GR REGULAR COL SGR 1.00 $10.714,00 19% $12.750,00 $12.750,00"
  //     "12X12X36G"
  // El "Total" final ya incluye IVA, así que usamos total / cantidad como
  // costo real por unidad (igual que en las estrategias D y E).
  //
  // Este formato sale MUY ruidoso del OCR en fotos de celular reales: guiones
  // largos "—" pegados entre columnas en vez de espacio, el símbolo "$" leído
  // como "S", barras "|" sueltas, etc. En vez de un solo regex rígido (que se
  // rompe con cualquiera de esos ruidos), escaneamos la línea por tokens:
  // buscamos el primer "$", tomamos el ÚLTIMO monto "$" de la línea como total
  // (ya con impuestos), y la cantidad es el último número antes de ese primer "$".
  function normalizeInlineDollarLine(line) {
    return line
      .replace(/[—–]/g, " ")      // guiones usados como separador de columna -> espacio
      .replace(/\bS(?=\d)/g, "$") // "S123" es un "$123" mal leído
      .replace(/[|]/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
  }
  // En este formato la cantidad siempre trae 2 decimales ("1.00", "2.00").
  // En fotos borrosas Tesseract a veces "come" el punto y la deja como un
  // bloque de 3-4 dígitos ("100", "200", "1500"). La cantidad real de un
  // producto de tienda casi nunca pasa de 99, así que si el token es de la
  // forma N00 lo interpretamos como N.00 en vez de N00 unidades (que
  // multiplicaría el costo real por 100 y arruinaría el cálculo).
  function fixQtyToken(tok) {
    if (/^\d{3,4}$/.test(tok) && /00$/.test(tok)) {
      var whole = parseInt(tok.slice(0, -2), 10);
      if (whole >= 1 && whole <= 99) return whole;
    }
    return Math.round(parseFloat(tok.replace(",", ".")));
  }
  function parseLineWithInlineDollars(rawLine) {
    var norm = normalizeInlineDollarLine(rawLine);
    var firstDollarIdx = norm.indexOf("$");
    if (firstDollarIdx === -1) return null;
    var before = norm.slice(0, firstDollarIdx).trim();
    var after = norm.slice(firstDollarIdx);
    var dollarMatches = after.match(/\$\s*[\d.,]+/g);
    if (!dollarMatches || dollarMatches.length < 2) return null; // necesitamos precio + total al menos
    var total = parseColombianNumber(dollarMatches[dollarMatches.length - 1].replace("$", ""));
    var tokensBefore = before.split(/\s+/).filter(Boolean);
    var qtyToken = null, cutAt = -1;
    for (var k = tokensBefore.length - 1; k >= 0; k--) {
      if (/^\d{1,4}([.,]\d{1,2})?$/.test(tokensBefore[k])) { qtyToken = tokensBefore[k]; cutAt = k; break; }
    }
    if (!qtyToken) return null;
    tokensBefore = tokensBefore.slice(0, cutAt);
    if (tokensBefore.length && /^\d{1,3}$/.test(tokensBefore[0])) tokensBefore.shift(); // # de ítem inicial
    if (tokensBefore.length && /^(SGR|UN|UND|CJ|PAQ|DS)$/i.test(tokensBefore[tokensBefore.length - 1])) tokensBefore.pop();
    var nombre = tokensBefore.join(" ").replace(/^\d{5,8}/, "").replace(/^[\[\]]+/, "").trim();
    var cant = fixQtyToken(qtyToken);
    if (!cant || !total) return null;
    return { nombre: nombre, cant: cant, total: total };
  }
  // Una línea de continuación real (empaque, ej. "12X12X36G") es corta y no
  // se parece al texto legal/pie de página de la factura. Si la línea es
  // muy larga, o tiene muchos caracteres repetidos de "ruido" (guiones,
  // corchetes, barras seguidos), ya no es empaque — es que el OCR se metió
  // en el pie de página y hay que parar ahí, no seguir pegándolo al nombre.
  function looksLikePackagingContinuation(line) {
    if (!line || line.length > 40) return false;
    if (/[—\-\]\[|]{3,}/.test(line)) return false; // racha de símbolos de ruido
    if (/\b(total|resoluci[oó]n|autoretenedores|contribuyente|autoriza|cufe|valor|aceptaci[oó]n)\b/i.test(line)) return false;
    // el texto de empaque real (ej. "12X12X36G", "COL") es mayúsculas y
    // números; una racha de 3+ minúsculas seguidas es texto de pie de
    // página / ruido del OCR colándose (ej. "GaN Apert"), no empaque.
    if (/[a-z]{3,}/.test(line)) return false;
    return true;
  }
  function parseItemDolarInline(lines) {
    var items = [];
    var i = 0;
    while (i < lines.length) {
      var line = lines[i];
      if (HEADER_SKIP_RE.test(line)) { i++; continue; }
      var parsed = parseLineWithInlineDollars(line);
      if (parsed) {
        // línea(s) de continuación: más texto del empaque, sin "$" ni ser otro ítem
        var contLines = [];
        var j = i + 1;
        while (j < lines.length && !HEADER_SKIP_RE.test(lines[j]) && !parseLineWithInlineDollars(lines[j]) && contLines.length < 2) {
          if (/\$/.test(lines[j]) || !looksLikePackagingContinuation(lines[j])) break;
          contLines.push(lines[j]);
          j++;
        }
        var presentacion = contLines.join(" ").trim();
        var nombreCompleto = (parsed.nombre + (presentacion ? " " + presentacion : "")).replace(/\s+/g, " ").trim();
        var precioUnitConImpuestos = parsed.total / parsed.cant;
        var it = makeItemFromTotal(nombreCompleto, parsed.cant, precioUnitConImpuestos, presentacion);
        if (it) items.push(it);
        i = j;
      } else {
        i++;
      }
    }
    return items;
  }

  // --- Estrategia G: factura tipo "tirilla POS" (facturación P.O.S. con IVA/impuestos incluidos) ---
  // Cada producto se ve en la foto como un bloque de 2-3 líneas, ej.:
  //   "0090001 3 UNI / AGUILA BT X30"
  //   "$67,496 $202,494"
  //   "Imp. I.C.O.: $6"                (línea de impuesto suelto, se ignora)
  // PERO en el texto que realmente entrega el OCR, ese orden no siempre se
  // respeta: el modo de lectura que usamos (bloque único) a veces termina
  // leyendo primero TODA la columna de nombres de producto y después TODA
  // la columna de precios (que en la foto está impresa más centrada/a la
  // derecha), en vez de ir línea por línea intercalado como se ve a simple
  // vista. Si exigimos que el renglón de precios venga INMEDIATAMENTE
  // después del renglón ancla, en una foto real eso falla casi siempre.
  // Por eso esta estrategia junta POR SEPARADO todas las líneas ancla
  // (código+cantidad+nombre) y todos los pares de montos "$X $Y" de TODA
  // la factura, y los empareja por ORDEN DE APARICIÓN — mucho más
  // tolerante a que el OCR reordene las columnas.
  // A diferencia de las estrategias D/E/F, aquí NO usamos Vr.Total/cantidad
  // como costo por unidad — en esta tirilla el "Imp. I.C.O." es un cargo
  // FIJO por línea que no es proporcional (fueron $6 en una línea y
  // $12.240 en otra de la MISMA factura), así que Vr.Total/cantidad da un
  // costo inventado y muy distinto al real. El costo real por caja/unidad
  // comprada es directamente el "Vr.Uni" que ya trae impresa la factura,
  // así que usamos ESE número tal cual, sin dividir nada.
  // Ya NO exige que el renglón EMPIECE con el patrón (^) — en fotos reales
  // el OCR mete basura suelta antes (un código mal leído como letras, por
  // ejemplo "EXI 3UN 7 AGUILABTX30"), así que buscamos el patrón cantidad+
  // unidad en CUALQUIER parte del renglón. Tampoco exige \b (límite de
  // palabra) después de la unidad, porque cuando el nombre queda pegado
  // sin espacio ("3UN7AGUILABTX30") no hay ese límite — en su lugar solo
  // exige que lo siguiente no sea otra letra.
  var POS_TICKET_ANCHOR_RE = /(\d{1,3})\s*(?:UNI|UND|UN)(?![A-Za-z])\.?\s*[\/@\|il1>\-\d]{0,3}\s*(.+)$/i;
  // dos montos de dinero en la misma línea (Vr.Unitario y Vr.Total) — no
  // exige que sean los ÚNICOS caracteres del renglón, porque el OCR a
  // veces pega basura suelta al principio o al final de la línea.
  var POS_TICKET_PRICES_RE = /\$?\s*(\d[\d.,]{2,})\s+\$?\s*(\d[\d.,]{2,})/;
  // Sin "^" (no exige que la línea EMPIECE con "imp") a propósito: el OCR
  // a veces pega un punto o símbolo suelto antes ("Imp. I.C.O." sale como
  // ". Imp. 1:50..."), y con el límite al inicio esa variante se colaba
  // sin filtrar — bug real que hacía que el impuesto de una línea se
  // tomara como si fuera el precio del producto SIGUIENTE.
  var POS_TICKET_SKIP_RE = /imp\.?\s|impoconsumo|i\.c\.o/i;

  // Quita basura suelta que el OCR deja pegada al nombre: un carácter o
  // número solitario antes de la primera palabra real ("7 AGUILABTX30" ->
  // "AGUILABTX30"), y símbolos sueltos al final ("... - >" -> "").
  function cleanupOcrName(s) {
    s = (s || "").replace(/^[\d\W]{1,4}(?=[A-Za-zÁÉÍÓÚÑáéíóúñ])/, "");
    s = s.replace(/[\s.\-–_,:=~§|<>«»]+$/, "");
    // Ruido corto en minúsculas pegado al final (ej. ". ho" sobrante de un
    // fragmento de "Hora" del encabezado que se mezcló con el nombre del
    // producto): los nombres de producto en estas facturas vienen en
    // MAYÚSCULAS, así que un pedacito corto en minúsculas al final casi
    // siempre es basura, no parte real del nombre.
    s = s.replace(/\s+[a-záéíóúñ]{1,4}$/, "");
    s = s.replace(/[\s.\-–_,:=~§|<>«»]+$/, "");
    return s.trim();
  }

  // Respaldo cuando la palabra "UNI/UND/UN" se pierde por completo en el
  // OCR (pasa seguido: "1 UNI POKER BOT X30" sale como "a 1 POKER BOT
  // X30", sin rastro de "UNI"). En vez de necesitar esa palabra, reconoce
  // el renglón por una marca/producto conocido de tienda de barrio
  // (cervezas, gaseosas, snacks — ver KNOWN_BRAND_WORDS, ya cargada en la
  // app para corregir texto pero sin usar hasta ahora para esto) y toma
  // como cantidad el último número chico (1-99) que aparezca ANTES de esa
  // marca en el renglón (si no hay ninguno, asume 1).
  function findBrandAnchor(line) {
    var lower = line.toLowerCase();
    for (var i = 0; i < KNOWN_BRAND_WORDS.length; i++) {
      var brand = KNOWN_BRAND_WORDS[i].toLowerCase();
      var idx = lower.indexOf(brand);
      // Si la marca tiene espacio (ej. "club colombia") pero no aparece
      // así en el renglón, puede ser que el OCR pegó el nombre sin
      // espacios ("clubcolombialtx24"). Probamos también esa versión sin
      // espacios y, si aparece, ubicamos dónde empieza de verdad buscando
      // solo la PRIMERA palabra de la marca ("club") en el renglón
      // original — así el nombre capturado sigue empezando en el lugar
      // correcto aunque el resto quede pegado.
      if (idx === -1 && brand.indexOf(" ") !== -1) {
        var brandNoSpace = brand.replace(/\s+/g, "");
        var lowerNoSpace = lower.replace(/\s+/g, "");
        if (lowerNoSpace.indexOf(brandNoSpace) !== -1) {
          var idxGuess = lower.indexOf(brand.split(" ")[0]);
          if (idxGuess !== -1) idx = idxGuess;
        }
      }
      if (idx !== -1) {
        var before = line.slice(0, idx);
        var nombre = line.slice(idx);
        // Cantidad = número chico (1-2 dígitos) INMEDIATAMENTE antes de la
        // marca, como su propio "token" (rodeado de espacio o inicio de
        // línea) — no cualquier número suelto que aparezca en el resto del
        // renglón, porque eso puede terminar sacando un pedazo de un
        // número más largo y sin relación (ej. "81" recortado de "2081",
        // que en realidad es "24" mal leído). Si no hay un número así de
        // limpio justo antes, es más honesto asumir 1 que inventar uno.
        var qm = before.match(/(?:^|\s)(\d{1,2})\s*$/);
        var cant = qm ? parseInt(qm[1], 10) : 1;
        if (!cant || cant <= 0 || cant > 99) cant = 1;
        return { cant: cant, nombre: nombre };
      }
    }
    return null;
  }

  function parsePosTicketBlocks(lines) {
    var anchors = [];
    var pricePairs = [];
    lines.forEach(function (line) {
      if (HEADER_SKIP_RE.test(line)) return;
      if (POS_TICKET_SKIP_RE.test(line)) return;
      if (FACTURA_METADATA_JUNK_RE.test(line)) return;
      var am = line.match(POS_TICKET_ANCHOR_RE);
      if (am) {
        var cant = parseInt(am[1], 10);
        var nombre = cleanupOcrName(am[2]);
        if (cant && nombre) { anchors.push({ cant: cant, nombre: nombre }); return; }
      }
      var brandAnchor = findBrandAnchor(line);
      if (brandAnchor) {
        var nombreB = cleanupOcrName(brandAnchor.nombre);
        if (nombreB) { anchors.push({ cant: brandAnchor.cant, nombre: nombreB }); return; }
      }
      var pm = line.match(POS_TICKET_PRICES_RE);
      if (pm) {
        // pm[1] = Vr.Uni (costo real por caja/unidad comprada, tal cual
        // impreso), pm[2] = Vr.Total (Vr.Uni × cantidad + Imp.I.C.O. — NO
        // sirve para sacar el costo por unidad, ver nota arriba).
        var vrUni = parseUsNumber(pm[1]);
        if (vrUni) pricePairs.push(vrUni);
      }
    });
    // Si no hay ni un par de precios o ni una ancla, esto no es una tirilla
    // POS — mejor dejar que otra estrategia (o el respaldo genérico)
    // intente, en vez de forzar un emparejamiento sin sentido.
    if (anchors.length === 0 || pricePairs.length === 0) return [];
    var items = [];
    var n = Math.min(anchors.length, pricePairs.length);
    for (var i = 0; i < n; i++) {
      var it = makeItem(anchors[i].nombre, anchors[i].cant, pricePairs[i], "");
      if (it) items.push(it);
    }
    return items;
  }

  // --- Estrategia Z: red de seguridad genérica (último recurso) ---
  // Ninguna de las estrategias anteriores está pensada para un formato
  // desconocido — cada una espera columnas o marcadores específicos de un
  // tipo de factura ya visto. Si NINGUNA logra separar ni un solo producto
  // (factura de un proveedor totalmente nuevo, o formato raro), en vez de
  // dejar todo en cero probamos algo mucho más laxo: en cada línea con
  // texto, tomamos el número más grande como precio y, si hay otro número
  // chico (1-99) en la misma línea, lo usamos como cantidad (si no, 1).
  // Es menos preciso que una estrategia específica, así que solo se usa
  // como último recurso (ver parseOcrTextToItems) — el usuario siempre
  // revisa los datos antes de guardar.
  //
  // Como es la más laxa de todas, es también la más propensa a "inventar"
  // productos de basura: pie de página, número de resolución DIAN, CUFE,
  // fecha de vigencia, nombre del cajero, etc. — todo eso trae letras Y
  // números revueltos, así que sin filtro extra terminaría armando cosas
  // como "y Niro Fecha Fact In" con un "precio" de miles de millones (un
  // número de resolución o CUFE mal leído). Por eso, además del tope de
  // precio de makeItem, esta estrategia descarta cualquier línea que
  // contenga vocabulario típico de metadatos de factura/tirilla en
  // cualquier parte de la línea (FACTURA_METADATA_JUNK_RE, no solo al
  // inicio como HEADER_SKIP_RE) y exige que el "nombre" tenga al menos una
  // palabra real de 4+ letras (no solo sueltas de 3, que suelen ser ruido
  // de OCR).
  function parseGenericFallback(lines) {
    var items = [];
    lines.forEach(function (line) {
      if (HEADER_SKIP_RE.test(line)) return;
      if (FACTURA_METADATA_JUNK_RE.test(line)) return;
      if (line.length < 5 || line.length > 120) return;
      var tokens = line.split(/\s+/).filter(Boolean);
      var nums = [];
      var nameTokens = [];
      tokens.forEach(function (t) {
        var cleaned = t.replace(/[$%]/g, "");
        var n = /\d/.test(t) ? parseColombianNumber(cleaned) : NaN;
        if (isFinite(n) && n > 0) nums.push(n);
        else nameTokens.push(t);
      });
      if (nums.length === 0) return;
      var nombre = nameTokens.join(" ");
      // exige al menos una palabra real de 4+ letras (evita nombres armados
      // solo de restos de ruido de 2-3 letras sueltas, tipo "y" "In" "r")
      if (!/[A-Za-zÁÉÍÓÚÑáéíóúñ]{4,}/.test(nombre)) return;
      // si más de la mitad de los "tokens de nombre" son puro símbolo/1-2
      // letras (signos de puntuación sueltos que dejó el OCR), es basura
      var realWordTokens = nameTokens.filter(function (t) { return /[A-Za-zÁÉÍÓÚÑáéíóúñ]{3,}/.test(t); });
      if (realWordTokens.length < 1 || realWordTokens.length < nameTokens.length / 2) return;
      var precio = Math.max.apply(null, nums);
      if (precio < 100) return; // muy chico para ser un precio real en pesos colombianos
      var possibleQty = nums.filter(function (n) { return n !== precio && n >= 1 && n <= 99; });
      var cant = possibleQty.length ? Math.round(possibleQty[0]) : 1;
      var it = makeItem(nombre, cant, precio, "");
      if (it) items.push(it);
    });
    return items;
  }

  function parseOcrTextToItems(text) {
    text = normalizeOcrText(text);
    var lines = text.split("\n").map(function (l) { return l.trim(); }).filter(Boolean);
    var strategies = [parseAnchorBlocks, parseItemDolarInline, parsePosTicketBlocks, parseCodigoDescTotal, parseCodigoDescGenericTail, parseItemCodigoDescSubtotal, parseTablaAnchaColumnas, parseSingleLines, parseSpacedColumns];
    var best = [];
    for (var i = 0; i < strategies.length; i++) {
      var result = strategies[i](lines);
      if (result.length > best.length) best = result;
    }
    // Red de seguridad: si ningún formato conocido encontró nada, probamos
    // el modo genérico más laxo antes de dejarle todo a mano al usuario.
    if (best.length === 0) best = parseGenericFallback(lines);
    return best;
  }

  // ---------- adaptador: arma el resultado en el formato que ya espera
  // invoiceOpen({supplier, date, items:[{name, qty, unit_cost}]}) ----------
  var OCR_ALT_PSM = "4";
  var OCR_MIN_ITEMS_BEFORE_RETRY = 2;

  var ultimaConfianza = 0;
  // Gira un canvas 90°, 180° o 270° (fotos tomadas de lado o al revés).
  function rotarCanvas(c, grados) {
    if (!grados) return c;
    var r = document.createElement("canvas"), g = ((grados % 360) + 360) % 360;
    r.width = g === 180 ? c.width : c.height; r.height = g === 180 ? c.height : c.width;
    var x = r.getContext("2d");
    x.translate(r.width / 2, r.height / 2); x.rotate(g * Math.PI / 180); x.drawImage(c, -c.width / 2, -c.height / 2);
    return r;
  }
  async function recognizeWithWorker(worker, canvas, timeoutMs) {
    try {
      var result = await withTimeout(
        worker.recognize(canvas),
        timeoutMs,
        "La lectura del texto está tardando demasiado con esta foto. Intenta con una foto más simple (más luz, más de frente, más cerca) o escribe el producto a mano."
      );
      ultimaConfianza = (result && result.data && typeof result.data.confidence === "number") ? result.data.confidence : 0;
      return (result && result.data && result.data.text) || "";
    } catch (recognizeErr) {
      try { worker.terminate(); } catch (eTerm) { /* noop */ }
      offlineWorkerPromise = null;
      throw recognizeErr;
    }
  }

  // Convierte un item del formato de Precios Vito (por caja/paquete) al
  // formato por-unidad-individual que usa Cuentas de Mesa (qty y unit_cost
  // ya cuentan unidades sueltas, como botellas, no cajas).
  function itemToInvoiceFormat(it) {
    var unidadesPorCaja = Math.max(1, it.unidades_por_caja || 1);
    var cantidadCajas = Math.max(1, it.cantidad_cajas || 1);
    var totalUnidades = cantidadCajas * unidadesPorCaja;
    var ivaPct = it.iva_pct != null ? it.iva_pct : 0.19;
    var costoTotalConIva = cantidadCajas * (it.precio_unitario_sin_iva || 0) * (1 + ivaPct);
    var costoUnidadConIva = totalUnidades > 0 ? costoTotalConIva / totalUnidades : 0;
    return {
      name: it.producto,
      qty: totalUnidades,
      unit_cost: Math.round(costoUnidadConIva),
      // Desglose por cajas/paquetes (igual que en Precios Vito), para poder
      // seguir editando "cuántas cajas llegaron" dentro de Cuentas de Mesa.
      cajas: cantidadCajas,
      unidades_por_caja: unidadesPorCaja,
      costo_sin_iva: it.precio_unitario_sin_iva || 0,
      iva_pct: ivaPct
    };
  }

  // ---------- PDFs (pdf.js embebido, funciona con y sin internet) ----------
  var PDF_RENDER_SCALE = 2; // más escala = más nitidez para el OCR, a costa de tiempo
  var pdfjsReadyPromise = null;
  function getPdfjs() {
    if (pdfjsReadyPromise) return pdfjsReadyPromise;
    pdfjsReadyPromise = (async function () {
      await window.ventoCargarLib('lib/vento-pdf.js', function(){ return window.pdfjsLib; });
      await window.ventoCargarLib('lib/vento-pdf-worker.js', function(){ return window.__VITO_PDFJS_WORKER_B64__; });
      if (typeof pdfjsLib === "undefined") throw new Error("El lector de PDF no está disponible en este archivo.");
      var workerBytes = b64ToUint8Array(window.__VITO_PDFJS_WORKER_B64__);
      var workerURL = URL.createObjectURL(new Blob([workerBytes], { type: "application/javascript" }));
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerURL;
      return pdfjsLib;
    })();
    return pdfjsReadyPromise;
  }
  function isPdfFile(f) { return f.type === "application/pdf" || /\.pdf$/i.test(f.name || ""); }
  // Convierte cada página de cada PDF en un archivo de imagen (PNG)
  // renderizado en canvas, para pasarlo por el mismo OCR que una foto.
  async function expandFilesWithPdfPages(rawFiles) {
    var out = [];
    for (var i = 0; i < rawFiles.length; i++) {
      var f = rawFiles[i];
      if (!isPdfFile(f)) { out.push(f); continue; }
      var pdfjs = await getPdfjs();
      var buf = await f.arrayBuffer();
      var pdf = await pdfjs.getDocument({ data: buf }).promise;
      var maxPages = Math.min(pdf.numPages, 6);
      for (var p = 1; p <= maxPages; p++) {
        var page = await pdf.getPage(p);
        var viewport = page.getViewport({ scale: PDF_RENDER_SCALE });
        var canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        var ctx = canvas.getContext("2d");
        await page.render({ canvasContext: ctx, viewport: viewport }).promise;
        var blob = await new Promise(function (resolve) { canvas.toBlob(resolve, "image/png"); });
        if (blob) {
          var pageFile = new File([blob], (f.name || "factura.pdf").replace(/\.pdf$/i, "") + "-p" + p + ".png", { type: "image/png" });
          out.push(pageFile);
        }
      }
    }
    return out;
  }
  // Si el PDF fue generado digitalmente (no es una foto escaneada), ya trae
  // el texto embebido y se puede leer directo — más preciso y sin pasar por
  // OCR. Devuelve "" si el PDF no tiene texto útil (ej. es un escaneo).
  async function extractEmbeddedPdfText(files) {
    var texts = [];
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      if (!isPdfFile(f)) continue;
      try {
        var pdfjs = await getPdfjs();
        var buf = await f.arrayBuffer();
        var pdf = await pdfjs.getDocument({ data: buf }).promise;
        var maxPages = Math.min(pdf.numPages, 6);
        for (var p = 1; p <= maxPages; p++) {
          var page = await pdf.getPage(p);
          var content = await page.getTextContent();
          var byLine = {};
          content.items.forEach(function (it) {
            var y = Math.round(it.transform[5] / 2) * 2;
            if (!byLine[y]) byLine[y] = [];
            byLine[y].push({ x: it.transform[4], text: it.str });
          });
          var ys = Object.keys(byLine).map(Number).sort(function (a, b) { return b - a; });
          ys.forEach(function (y) {
            var lineItems = byLine[y].sort(function (a, b) { return a.x - b.x; });
            var lineText = lineItems.map(function (it) { return it.text; }).join(" ").replace(/\s+/g, " ").trim();
            if (lineText) texts.push(lineText);
          });
        }
      } catch (e) { /* si falla, seguimos con OCR normal para este archivo */ }
    }
    return texts.join("\n");
  }

  // Qué tan bien quedó una lectura: confianza de Tesseract + renglones de producto que se pudieron armar.
  function puntajeLectura(text, conf) {
    var r = 0; try { r = typeof window.fiParsearRenglones === "function" ? window.fiParsearRenglones(text).length : 0; } catch (e) { r = 0; }
    var palabras = (String(text).match(/\b[A-Za-zÁÉÍÓÚÑáéíóúñ]{4,}\b/g) || []).length;
    return { conf: conf, renglones: r, total: conf + 25 * Math.min(r, 12) + Math.min(palabras, 80) * 0.3 };
  }
  async function ocrSingleFile(file) {
    var worker = await withTimeout(
      getOfflineWorker(),
      OCR_WORKER_LOAD_TIMEOUT_MS,
      "El lector de texto sin internet está tardando demasiado en cargar. Intenta de nuevo, o usa \"Escanear factura de proveedor\" si tienes internet."
    );
    var t0 = Date.now(), PRESUPUESTO = 6000;   // las relecturas extra solo caben dentro de ~6 s (meta: menos de 10 s en total)
    var aTiempo = function(){ return Date.now() - t0 < PRESUPUESTO; };
    var canvas = await fileToOcrCanvas(file);
    // La hoja de lado o al revés se endereza ANTES de leer (como el escáner): así no hace falta leerla 3-4 veces
    // girada (cada lectura tarda segundos) y el texto sale en orden.
    try {
      if (typeof window.fiOrientacion === "function") {
        var cx0 = canvas.getContext("2d"), d0 = cx0.getImageData(0, 0, canvas.width, canvas.height).data, g0 = new Uint8ClampedArray(canvas.width * canvas.height);
        for (var q0 = 0, p0 = 0; p0 < g0.length; q0 += 4, p0++) g0[p0] = d0[q0];
        var or0 = window.fiOrientacion(g0, canvas.width, canvas.height);
        if (or0 && or0.seguro && or0.giro) canvas = rotarCanvas(canvas, or0.giro);
      }
    } catch (eOr) { /* sin enderezar: se lee igual */ }
    var text = await recognizeWithWorker(worker, canvas, OCR_RECOGNIZE_TIMEOUT_MS);
    // Si la lectura salió pobre (foto de lado, al revés, o el arreglo de la foto la dañó), se prueba
    // con la foto original y girada 90°/270°/180°, y se queda la lectura que mejor arme los renglones.
    var mejor = { text: text, p: puntajeLectura(text, ultimaConfianza), canvas: canvas };
    // Se relee girada SOLO si no salió ningún renglón con precio (o casi nada y con muy poca confianza):
    // antes bastaba confianza < 55 para leer 3-4 veces más la misma foto (4 s cada vez).
    if (mejor.p.renglones < 2 || mejor.p.conf < 40) {
      var bases = [{ c: canvas }];
      if (file && file.__original) { try { bases.push({ c: await fileToOcrCanvas(file.__original) }); } catch (eO) { /* noop */ } }
      var pruebas = [];
      if (bases[1]) pruebas.push([bases[1].c, 0]);
      pruebas.push([canvas, 90], [canvas, 270]);
      for (var k = 0; k < pruebas.length; k++) {
        if (typeof window.__vitoOcrProgress === "function") { try { window.__vitoOcrProgress(0.1 + 0.2 * k); } catch (eP) { /* noop */ } }
        var cv = rotarCanvas(pruebas[k][0], pruebas[k][1]);
        var t2 = await recognizeWithWorker(worker, cv, OCR_RECOGNIZE_TIMEOUT_MS);
        var p2 = puntajeLectura(t2, ultimaConfianza);
        if (p2.total > mejor.p.total + 5) mejor = { text: t2, p: p2, canvas: cv };
        if (mejor.p.renglones >= 2 || !aTiempo()) break;
      }
      if (mejor.p.renglones < 1 && mejor.canvas !== canvas && aTiempo()) {
        var t3 = await recognizeWithWorker(worker, rotarCanvas(mejor.canvas, 180), OCR_RECOGNIZE_TIMEOUT_MS);
        var p3 = puntajeLectura(t3, ultimaConfianza); if (p3.total > mejor.p.total + 5) mejor = { text: t3, p: p3, canvas: null };
      }
      text = mejor.text; canvas = mejor.canvas || canvas;
    }
    var items = parseOcrTextToItems(text);

    // Igual que en Precios Vito: si el primer intento separó pocos
    // productos, probamos el otro modo de lectura antes de rendirnos.
    // El otro modo de lectura solo si el lector bueno (fiParsearRenglones) tampoco encontró renglones:
    // antes se decidía con el lector viejo, que casi siempre veía 1, y se releía todo sin necesidad (+4 s).
    var renglonesBuenos = puntajeLectura(text, 100).renglones;
    if (items.length < OCR_MIN_ITEMS_BEFORE_RETRY && renglonesBuenos < 2 && (renglonesBuenos === 0 || aTiempo())) {
      try {
        await worker.setParameters({ tessedit_pageseg_mode: OCR_ALT_PSM });
        var text2 = await recognizeWithWorker(worker, canvas, OCR_RECOGNIZE_TIMEOUT_MS);
        var items2 = parseOcrTextToItems(text2);
        await worker.setParameters({ tessedit_pageseg_mode: (Tesseract.PSM && Tesseract.PSM.SINGLE_BLOCK) || "6" });
        if (items2.length > items.length) items = items2;
      } catch (retryErr) { /* seguimos con lo que ya teníamos */ }
    }
    return { text: text, items: items };
  }

  // Punto de entrada: acepta uno o varios archivos (fotos y/o PDFs), igual
  // que el picker de galería de Precios Vito. Si hay un PDF con texto
  // embebido, se lee directo (rápido y preciso); si no, sus páginas se
  // convierten a imagen y se leen con el mismo OCR que una foto — solo la
  // primera imagen resultante se procesa, igual que en Precios Vito.
  async function scanInvoiceFiles(rawFiles) {
    var files = Array.isArray(rawFiles) ? rawFiles : [rawFiles];
    if (!files.length) throw new Error("No se eligió ninguna foto o archivo.");
    var hasPdf = files.some(isPdfFile);

    if (hasPdf) {
      var embeddedText = "";
      try { embeddedText = await extractEmbeddedPdfText(files); } catch (e) { embeddedText = ""; }
      if (embeddedText && embeddedText.replace(/\s/g, "").length > 20) {
        var itemsFromPdf = parseOcrTextToItems(embeddedText);
        if (itemsFromPdf.length === 0) {
          var errPdf = new Error("Leí el PDF pero no logré separar productos del texto. Prueba tomando una foto de la factura en su lugar.");
          errPdf.rawText = embeddedText;
          throw errPdf;
        }
        return { supplier: "", date: "", items: itemsFromPdf.map(itemToInvoiceFormat), rawText: embeddedText };
      }
      // El PDF no traía texto embebido (es un escaneo/foto): convertimos
      // sus páginas a imagen y seguimos por el camino normal de OCR.
      files = await expandFilesWithPdfPages(files);
      if (!files.length) throw new Error("No se encontraron páginas legibles en el PDF.");
    }

    var ocrResult = await ocrSingleFile(files[0]);
    if (ocrResult.items.length === 0) {
      var err = new Error("No logré separar productos en esta foto sin internet. Prueba con una foto más clara, derecha y con buena luz, o usa \"Escanear factura de proveedor\" (con internet) si tienes cobertura.");
      err.rawText = ocrResult.text;
      throw err;
    }
    return { supplier: "", date: "", items: ocrResult.items.map(itemToInvoiceFormat), rawText: ocrResult.text };
  }

  // Permite releer un texto que el usuario corrigió a mano (el mismo texto
  // que se le muestra después de escanear), sin volver a tomar la foto.
  function parseTextToInvoiceItems(text) {
    var items = parseOcrTextToItems(String(text || ""));
    return items.map(itemToInvoiceFormat);
  }

  window.VitoOfflineOCR = {
    scanInvoiceFiles: scanInvoiceFiles,
    // Texto de una imagen con el arreglo de las fotos de facturas (blanco y negro, enderezado) y en un solo bloque.
    textoDeImagen: async function (file) { var w = await getOfflineWorker(); var c = await fileToOcrCanvas(file); return await recognizeWithWorker(w, c, OCR_RECOGNIZE_TIMEOUT_MS); },
    // Pantallazo de un comprobante (Nequi, DaviPlata, bancos): el archivo va TAL CUAL al lector, que lo abre en su propio
    // hilo (la pantalla no se traba), y se lee en columna (PSM 4). En un solo bloque (PSM 6, el de las facturas) Tesseract
    // se saltaba el renglón grande del valor («$ 65.000») y quedaban solo el saldo y el costo.
    textoDeComprobante: function (file, psm) {
      var job = colaComprobante.then(async function () {
        var w = await withTimeout(getOfflineWorker(), OCR_WORKER_LOAD_TIMEOUT_MS, "El lector de comprobantes está tardando demasiado en cargar. Intenta de nuevo.");
        await w.setParameters({ tessedit_pageseg_mode: String(psm || 4) });
        try { return await recognizeWithWorker(w, file, OCR_RECOGNIZE_TIMEOUT_MS); }
        finally { try { if (offlineWorkerPromise) await w.setParameters({ tessedit_pageseg_mode: (Tesseract.PSM && Tesseract.PSM.SINGLE_BLOCK) || "6" }); } catch (eP) { /* noop */ } }
      });
      colaComprobante = job.catch(function () {});
      return job;
    },
    // Todo el texto de la foto CON la posición de cada palabra (para el PDF escaneado con texto que se puede buscar y copiar).
    palabrasDeImagen: async function (file) {
      var w = await getOfflineWorker(); var c = await fileToOcrCanvas(file), r;
      try { r = await withTimeout(w.recognize(c, {}, { text: true, blocks: true }), OCR_RECOGNIZE_TIMEOUT_MS * 2, "La lectura del texto tardó demasiado."); }
      catch (e) { try { w.terminate(); } catch (e2) { /* noop */ } offlineWorkerPromise = null; throw e; }
      var d = (r && r.data) || {}, words = [];
      var add = function (x) { var t = x && String(x.text || "").trim(); if (t && x.bbox) words.push({ t: t, x0: x.bbox.x0, y0: x.bbox.y0, x1: x.bbox.x1, y1: x.bbox.y1 }); };
      if (d.words && d.words.length) d.words.forEach(add);
      else (d.blocks || []).forEach(function (b) { (b.paragraphs || []).forEach(function (p) { (p.lines || []).forEach(function (l) { (l.words || []).forEach(add); }); }); });
      return { text: d.text || "", words: words, w: c.width, h: c.height };
    },
    _ocrPrueba: async function (file, grados) { var w = await getOfflineWorker(); var c = rotarCanvas(await fileToOcrCanvas(file), grados || 0); var t = await recognizeWithWorker(w, c, OCR_RECOGNIZE_TIMEOUT_MS); return { text: t, conf: ultimaConfianza }; },
    parseTextToInvoiceItems: parseTextToInvoiceItems,
    // Se exponen también para el escaneo CON internet (IA): así puede leer
    // el texto embebido de un PDF digital, o convertir sus páginas a foto
    // si es un PDF escaneado, sin reimplementar nada de esto por fuera.
    extractEmbeddedPdfText: extractEmbeddedPdfText,
    expandFilesWithPdfPages: expandFilesWithPdfPages,
    isPdfFile: isPdfFile,
    // Deja el motor de lectura cargado mientras se toma la foto (ahorra 1-3 s al leer).
    precalentar: function(){ try { getOfflineWorker().catch(function(){ offlineWorkerPromise = null; }); } catch (e) {} }
  };
})();
