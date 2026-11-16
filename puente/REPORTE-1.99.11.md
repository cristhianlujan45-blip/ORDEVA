# ORDEVA 1.99.11 · Botones de 44 px en la cuenta de la mesa, Cobrar e Inventario (hallazgo 7, segunda tanda)

- Medido en un celular de 390 px:
  - Cuenta de la mesa: «🍾 Consumo mínimo» 32 px, «🍳 Enviar a Cocina» 37, «➕ Abono o dividir» 39, «Cerrar» 43.
  - Cobrar: «📝 Queda debiendo» y «Cancelar» 43 px.
  - Inventario: 37 controles bajo 44 px: «Precio con foto», «Unir repetidos», «Pedido a proveedor» (35), los campos del
    formulario de producto (39), las categorías (32), los botones de cada producto (32), la miniatura «📷» (40) y
    «Ponerles stock» (30).
- Ahora todos miden al menos 44 px en pantallas táctiles. Queda a propósito el número de cantidad entre − y + en la cuenta
  de la mesa (los botones − y + ya miden 44).
- Solo CSS (`index.html`); en el computador con mouse no cambia.
- Pruebas: diseno199 47/0 (punto 13 nuevo), mesa 51/0, mesacomoda 16/0, mesapersonas 22/0, cobrosimple 21/0,
  inventario5 15/0, inventariosimple 14/0, recetas 21/0, codigoproducto 23/0, codigobarras 25/0, facturacategorias 11/0,
  modulosnegocio 33/0, cajapos 27/0, vistasencilla 45/0, ordeva2pantallas 20/0, comanda 12/0.
- No probado: teléfonos reales.
