/* =====================================================================
   ORDEVA · leer códigos de barras y QR en CUALQUIER equipo
   El lector de la cámara usa BarcodeDetector, que traen Chrome en Android y en Mac, pero NO el programa de PC en
   Windows ni Safari en iPhone. Allí se carga, solo cuando hace falta, el mismo lector hecho con ZXing
   (lib/zxing/: barcode-detector 3.2.3 + zxing-wasm 3.1.6, licencia MIT), que se baja de este mismo sitio (nada de CDN).
     ventoCodigos.detector(formatos) → promesa con un lector { detect(video|imagen) → [{ rawValue, format }] }
     ventoCodigos.nativo()           → true si el equipo trae su propio lector (más rápido)
   ===================================================================== */
(function(){
  'use strict';
  if(window.ventoCodigos) return;
  // Carpeta de este archivo (lib/): de ahí sale lib/zxing/, también desde lector.html o desde la copia local de pruebas.
  var BASE = (function(){
    try{ var s = document.currentScript && document.currentScript.src; if(s) return new URL('zxing/', s).href; }catch(e){}
    return new URL('lib/zxing/', location.href).href;
  })();
  var carga = null;
  function cargarZXing(){
    if(carga) return carga;
    carga = new Promise(function(ok, mal){
      if(window.BarcodeDetectionAPI) return ok(window.BarcodeDetectionAPI);
      var s = document.createElement('script');
      s.src = BASE + 'barcode-detector.js?v=3.2.3';
      s.onload = function(){ window.BarcodeDetectionAPI ? ok(window.BarcodeDetectionAPI) : mal(new Error('lector_no_cargo')); };
      s.onerror = function(){ mal(new Error('lector_no_cargo')); };
      document.head.appendChild(s);
    }).then(function(api){
      // El .wasm (1 MB) se pide a este mismo sitio, una sola vez; después queda guardado en el navegador.
      try{ api.prepareZXingModule({ overrides: { locateFile: function(p, pre){ return /\.wasm$/.test(p) ? BASE + p + '?v=3.1.6' : pre + p; } } }); }catch(e){}
      return api;
    });
    carga.catch(function(){ carga = null; });
    return carga;
  }
  function nativo(){ return typeof window.BarcodeDetector === 'function'; }
  function detector(formatos){
    formatos = formatos && formatos.length ? formatos : ['qr_code', 'ean_13'];
    if(nativo()){
      return Promise.resolve(window.BarcodeDetector.getSupportedFormats ? window.BarcodeDetector.getSupportedFormats().catch(function(){ return null; }) : null).then(function(sop){
        var f = sop && sop.length ? formatos.filter(function(x){ return sop.indexOf(x) >= 0; }) : formatos;
        // Un Chrome que dice tener lector pero no lee ninguno de estos (pasa en algunos computadores): se usa ZXing.
        if(sop && !f.length) throw new Error('sin_formatos');
        return new window.BarcodeDetector({ formats: f });
      }).catch(function(){ return conZXing(formatos); });
    }
    return conZXing(formatos);
  }
  function conZXing(formatos){
    return cargarZXing().then(function(api){
      var d = new api.BarcodeDetector({ formats: formatos });
      d.zxing = true;
      return d;
    });
  }
  window.ventoCodigos = { detector: detector, nativo: nativo, cargar: cargarZXing };
})();
