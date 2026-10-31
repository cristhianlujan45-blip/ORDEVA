/* =====================================================================
   ORDEVA · 📊 Excel de verdad (.xlsx) sin librerías: varias hojas, números como números (se pueden sumar).
   Un .xlsx es un ZIP con unos XML. Aquí se arma el ZIP «sin comprimir» (método store) con su CRC32: Excel,
   LibreOffice, Google Sheets y Numbers lo abren igual. Pesa unos pocos KB de código (no se descarga nada).
   Uso: ventoXlsx.libro([{ nombre: 'Ventas', filas: [['Fecha', 'Total'], ['2026-10-31', 35000]] }, …]) → Blob
        ventoXlsx.descargar(nombreArchivo, hojas)
   ===================================================================== */
(function(){
  'use strict';
  const enc = new TextEncoder();
  // ---------- CRC32 ----------
  const TABLA = (() => { const t = new Uint32Array(256); for(let n = 0; n < 256; n++){ let c = n; for(let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(b){ let c = 0xFFFFFFFF; for(let i = 0; i < b.length; i++) c = TABLA[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  // ---------- ZIP (store) ----------
  function zip(archivos){
    const partes = [], central = []; let off = 0;
    const u16 = n => [n & 255, (n >>> 8) & 255], u32 = n => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
    const d = new Date(), hora = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), dia = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    archivos.forEach(a => {
      const nombre = enc.encode(a.nombre), datos = typeof a.datos === 'string' ? enc.encode(a.datos) : a.datos, crc = crc32(datos);
      const cab = new Uint8Array([].concat([0x50, 0x4b, 0x03, 0x04], u16(20), u16(0x0800), u16(0), u16(hora), u16(dia), u32(crc), u32(datos.length), u32(datos.length), u16(nombre.length), u16(0)));
      partes.push(cab, nombre, datos);
      central.push(new Uint8Array([].concat([0x50, 0x4b, 0x01, 0x02], u16(20), u16(20), u16(0x0800), u16(0), u16(hora), u16(dia), u32(crc), u32(datos.length), u32(datos.length), u16(nombre.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(off))), nombre);
      off += cab.length + nombre.length + datos.length;
    });
    const tamCentral = central.reduce((s, x) => s + x.length, 0);
    const fin = new Uint8Array([].concat([0x50, 0x4b, 0x05, 0x06], u16(0), u16(0), u16(archivos.length), u16(archivos.length), u32(tamCentral), u32(off), u16(0)));
    return new Blob(partes.concat(central, [fin]), { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }
  // ---------- Hojas ----------
  const x = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  const col = n => { let s = ''; n++; while(n > 0){ const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
  function hojaXml(filas){
    const rows = (filas || []).map((f, i) => '<row r="' + (i + 1) + '">' + (f || []).map((v, j) => {
      const ref = col(j) + (i + 1);
      if(v == null || v === '') return '';
      if(typeof v === 'number' && isFinite(v)) return '<c r="' + ref + '"' + (i === 0 ? ' s="1"' : '') + '><v>' + v + '</v></c>';
      return '<c r="' + ref + '" t="inlineStr"' + (i === 0 ? ' s="1"' : '') + '><is><t xml:space="preserve">' + x(v) + '</t></is></c>';
    }).join('') + '</row>').join('');
    const anchos = (filas[0] || []).map((_, j) => { const m = Math.min(60, Math.max(8, ...filas.slice(0, 200).map(f => String(f && f[j] != null ? f[j] : '').length + 2))); return '<col min="' + (j + 1) + '" max="' + (j + 1) + '" width="' + m + '" customWidth="1"/>'; }).join('');
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      (filas.length > 1 ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' : '') +
      (anchos ? '<cols>' + anchos + '</cols>' : '') + '<sheetData>' + rows + '</sheetData></worksheet>';
  }
  function libro(hojas){
    hojas = (hojas || []).filter(h => h && Array.isArray(h.filas));
    if(!hojas.length) hojas = [{ nombre: 'Hoja1', filas: [[]] }];
    const nom = (n, i) => (String(n || 'Hoja' + (i + 1)).replace(/[\\/?*[\]:]/g, ' ').slice(0, 31).trim() || 'Hoja' + (i + 1));
    const archivos = [
      { nombre: '[Content_Types].xml', datos: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        hojas.map((_, i) => '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('') + '</Types>' },
      { nombre: '_rels/.rels', datos: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
      { nombre: 'xl/workbook.xml', datos: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
        hojas.map((h, i) => '<sheet name="' + x(nom(h.nombre, i)) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>').join('') + '</sheets></workbook>' },
      { nombre: 'xl/_rels/workbook.xml.rels', datos: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        hojas.map((_, i) => '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>').join('') +
        '<Relationship Id="rId' + (hojas.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
      { nombre: 'xl/styles.xml', datos: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf fontId="0"/><xf fontId="1" applyFont="1"/></cellXfs></styleSheet>' }
    ].concat(hojas.map((h, i) => ({ nombre: 'xl/worksheets/sheet' + (i + 1) + '.xml', datos: hojaXml(h.filas) })));
    return zip(archivos);
  }
  function descargar(nombre, hojas){
    const b = libro(hojas), a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = String(nombre || 'ORDEVA').replace(/\.xlsx$/i, '') + '.xlsx';
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    return b;
  }
  window.ventoXlsx = { libro, descargar, _crc32: crc32 };
})();
