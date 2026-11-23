# ORDEVA 1.99.41 · 🗺️ Mapa del local para todos los negocios (también tiendas), más claro y fácil

## Pedido del dueño (23/11)
«Revisa el tema del mapeo de los locales, las tiendas, los restaurantes, las mesas. Ya que quitaste la opción,
agrégamela otra vez… muy profesional y fácil de usar.»

## Por qué no aparecía
- El diagnóstico (solo lectura) muestra que tu negocio está registrado como **agropecuaria** (tipo tienda), con 10
  cuentas y sin plano guardado.
- ORDEVA **escondía el plano en los negocios tipo tienda**, porque allá las cuentas no son lugares.
- Además, en una tienda la pantalla principal es «Vender» (la caja) y esconde todo lo demás.
- **Error encontrado:** en Ajustes → «🧩 Funciones de este negocio», el interruptor «🗺️ Mapa del local» no hacía nada en
  una tienda. El plano seguía escondido por la otra regla.

## Lo que cambió
1. **«🗺️ Mapa del local» en «Más», en todos los negocios.**
   - En un restaurante, bar u hotel abre Mesas en el plano.
   - En una tienda o agropecuaria muestra el plano en vez de la caja, con **«🛒 Volver a vender»**.
   - Viene prendido. Se apaga en Ajustes → Funciones de este negocio → «Mapa del local».
2. **Plano de tienda = plano del local:** góndolas, neveras, bodega, caja, entrada y letreros de cada sección. Las
   cuentas no se ponen encima (no son lugares). En restaurantes, bares y hoteles se siguen viendo las mesas con su estado
   (libre, ocupada, valor).
3. **Cabe en el celular:**
   - Antes el plano medía 560 px y había que deslizarlo de lado (en un celular no se veían todas las mesas). Ahora se
     ajusta al ancho de la pantalla.
   - **«🔍 Acercar»** lo agranda (se desliza de lado); **«🔍 Alejar»** lo devuelve.
4. **Se lee bien:**
   - Las mesas son más grandes. El nombre pasa de 8,5 a 11–15 px y el valor de 8 a 10,5–13 px.
   - Las góndolas angostas llevan el nombre a lo largo.
   - Los elementos pequeños llevan el ícono arriba y el nombre abajo (antes «B…», «G…»).
   - La entrada se lee completa.
5. **Más fácil la primera vez:** con el plano vacío, la plantilla elegida se pone de una, sin la pregunta en rojo
   «¿Usar la plantilla?».

## Comprobado
- Fotos en 390 px: restaurante, bar y agropecuaria, antes y después.
- **Prueba nueva:** `pruebas/mapalocal1941.test.js` (12/12). Con la 1.99.39 falla.
- **`pruebas/plano.test.js`:** 20/20. Se actualizó la revisión 8, que pedía que una tienda NO tuviera plano; ahora sí
  tiene, sin las cuentas encima. También se ajustó la revisión de la plantilla, que ya no pregunta con el plano vacío.
