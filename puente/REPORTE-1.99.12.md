# ORDEVA 1.99.12 · 44 px en Facturas, Contabilidad y Ajustes (hallazgo 7, tercera tanda)

- Medido en un celular de 390 px: Facturas tenía 8 controles bajo 44 px (Caja, Cierres Z, filtros Todos/Pagaron/Deben,
  gráficas: 32 px), Contabilidad 25 (períodos 36 px, «Adjuntar recibo» y los pagos fijos Luz/Agua/Gas… 32 px, campos 41–43)
  y Ajustes › Negocio 37 (botones de los usuarios 27 px, «👁» 33, campos 41–43, Cajeros/Meseros 32…).
- Ahora, en pantallas táctiles, todos los botones, campos, listas y desplegables de esas tres pantallas miden al menos 44 px;
  el «👁» de las contraseñas y los botones de cada usuario también 44 de ancho. La Libreta ya estaba bien.
- Solo CSS (`index.html`). Revisado con fotos: usuarios, clave de autorización y Contabilidad sin desacomodos.
- Pruebas: diseno199 50/0 (punto 14 nuevo), anularventas 27/0, facturasorden 21/0, cerrarcaja 27/0, finanzas 17/0,
  ivaexcel 18/0, cajagastos 10/0, layafinanzas 10/0, ajustesequipo 17/0, pinempleado 18/0, tipofijo 16/0,
  modulosnegocio 33/0, propinas 12/0, impuestoconsumo 10/0, herramientas 28/0, vistasencilla 45/0, apariencias 16/0,
  registrotipo 6/0.
- No probado: teléfonos reales.
