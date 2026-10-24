# ORDEVA 1.64.0 · Funciones según el tipo de negocio · Productos repetidos en la mesa

## 1. 🧂 Insumos y Recetas solo donde se preparan alimentos

### La causa
- ORDEVA ya clasifica los negocios: tiene unos 90 tipos (app/03-catalogo-tipos-negocio.js), agrupados en familias.
  - Familias: comida, bar, tienda, servicio, orden, salud, alojamiento, ocio, educación y otro.
  - Cada tipo trae las letras de las funciones que usa: pantalla de preparación, app de meseros, QR, mapa del local,
    dividir la cuenta, cuenta a nombre del cliente, venta de mostrador y código de barras.
  - El cuerpo (`body`) lleva la clase `mod-x` de cada función prendida, y lo que no va se esconde.
- **Insumos y Recetas (1.55.0, `lib/vento-recetas.js`) nunca entraron en ese sistema.** Se pintaban para cualquier
  negocio en dos lugares:
  - Inventario → «🧂 Insumos y recetas»;
  - Editar producto → «🧾 Receta».
- No aparecían en ninguna otra pantalla. Revisé el menú «Más», la barra de abajo, el tablero, los reportes, la IA, la
  guía, la app de meseros, el admin, el buscador y la carta: no hay enlaces a esa sección.

### La clasificación
La pedida, con los tipos que ya existían:

| Pedido | Tipo en ORDEVA | Familia | 🧂 Insumos y recetas de fábrica |
|---|---|---|---|
| Restaurante | restaurante | comida | Sí |
| Cafetería | cafeteria | comida | Sí |
| Panadería | panaderia (Panadería / Pastelería) | comida | Sí |
| Repostería | pasteleria (Repostería por encargo) | orden | Sí (se agregó a mano) |
| Comidas rápidas | comidas_rapidas | comida | Sí |
| (también) | pizzería, sushi, asadero, arepería, piqueteadero, heladería, frutería, catering, cocina oculta | comida | Sí |
| Bar | bar | bar | No |
| Cervecería | cerveceria (nombre viejo de bar) | bar | No |
| (también) | discoteca, karaoke | bar | No |
| Tienda | tienda | tienda | No |
| Minimercado / Supermercado | minimercado | tienda | No |
| Licorera | estanco (Estanco / Licorera) | tienda | No |
| Negocio mixto | modo de trabajo «Las dos» (caja y cuentas) | según su tipo | Según su tipo |
| Otros negocios | servicios, salud, alojamiento… | — | No |

### Lo que cambió
- **Una función nueva en el catálogo,** la `r` = 🧂 Insumos y recetas. La traen de fábrica la familia comida y la
  repostería por encargo.
- **Con la función apagada:**
  - no se ve el panel de Inventario ni la sección «🧾 Receta» de Editar producto;
  - al vender no se descuentan ingredientes;
  - «No vender si faltan ingredientes» no frena ventas.
- **🧩 Funciones de este negocio** (Ajustes → Negocio, solo dueño o administrador; archivo nuevo
  `lib/vento-modulos.js`):
  - Prende o apaga cada función: Insumos y recetas, pantalla de preparación, app de meseros, QR, mapa, dividir la
    cuenta, cuenta a nombre del cliente, venta de mostrador y código de barras.
  - Cada una dice si «viene con tu tipo de negocio».
  - Se guarda en `data.modulos`, dentro de los datos de ESE negocio: los otros negocios de la misma cuenta no cambian.
  - «↺ Volver a las de mi tipo de negocio» quita lo elegido.
  - La pantalla de preparación sigue con su interruptor de siempre (Ajustes → Pedidos), que este panel usa tal cual.
- **Apagar no borra nada:**
  - Si hay insumos o recetas, primero pregunta: «No se borra nada: queda guardado y vuelve igual cuando lo prendas.
    Mientras esté apagado, al vender NO se descuentan ingredientes».
  - Al prenderla otra vez, todo está igual.
- **Compatibilidad:**
  - Un negocio que ya tenía insumos o productos con receta (por ejemplo, un bar que los creó antes) los sigue viendo y
    descontando, aunque su tipo no los traiga. Así nada deja de funcionar al actualizar.
  - Los negocios sin tipo elegido siguen viendo todo, como siempre.
  - «Mostrar todas las funciones» también las muestra.

### El servidor (la pantalla no reemplaza los permisos)
- Migración `20261117000000_modulos_negocio.sql`: la misma función de 20261106000000 con reglas de más. No borra
  nada.
- Desde su celular, el equipo (cajero, mesero, empleado) **no puede cambiar:**
  - `data.modulos` (las funciones del negocio): se revierte y queda en la auditoría (`modulos_revertidos`);
  - «No vender si faltan ingredientes»;
  - la receta de un producto que ya existe, salvo con el permiso «productos» (igual que el precio y el nombre).
- **Sí sigue cambiando:** el stock de los insumos cuando se vende, y los productos nuevos con su receta.

## 2. 🍺 El mismo producto repetido en la mesa (Mesa 2: Poker ×4, ×1 y ×3)

### La causa
- Agregar a mano, por voz, desde el QR o desde la app de meseros ya juntaba el mismo producto en un renglón.
- **El problema estaba en la mezcla de datos entre celulares** (`nube/vento-nube.js`):
  - Los productos de una mesa no tienen id, así que se comparaban por TODO su contenido.
  - Si dos equipos agregaban Poker a la misma mesa casi al tiempo (el dueño y un mesero, o el celular y el
    computador), cada uno quedaba con un «Poker» distinto, y la mezcla guardaba los dos como renglones aparte.

### El arreglo
- **Al mezclar:**
  - Un producto de la mesa se reconoce por su producto, su persona, su mesa de origen (mesas juntadas) y su precio.
  - Los dos celulares quedan en UN renglón y se suman las cantidades que agregó cada uno, como ya se hacía con el
    stock.
  - Si un celular cerró la cuenta mientras el otro agregaba, lo agregado después queda en la mesa (antes se podía
    perder).
  - Personas distintas o precios distintos siguen en renglones aparte.
  - Los repetidos que ya existían se juntan antes de mezclar, para no contar de más.
- **Al abrir una mesa que ya quedó con repetidos:** se juntan en un renglón, con la misma cantidad total y el mismo
  valor. La Mesa 2 del pantallazo queda «Poker ×8» y la cuenta sigue en $56.500.

## 3. El botón «⋯ Opciones» salía sin la Vista sencilla (error de la 1.63.0)
- En el pantallazo de la Mesa 2 se veía «⋯ Opciones» junto a los iconos de siempre, aunque la Vista sencilla estaba
  apagada.
- La causa: la regla `#overlay .mesa-ico` de la cuenta pesaba más que la que lo escondía.
- Arreglado: ahora se esconde con `!important` cuando la Vista sencilla está apagada.

## Pruebas
- **`modulosnegocio` 29/29 (nueva):**
  - 10 perfiles: bar, tienda, licorera, minimercado, restaurante, cafetería, panadería, repostería, comidas rápidas y
    negocio mixto. En cada uno revisa Inventario, Editar producto y «Funciones de este negocio», y que vender siga
    descontando el inventario.
  - Un bar que prende Insumos y recetas para los cócteles: vender 2 mojitos descuenta 120 ml de ron.
  - Al apagarlo, pregunta, se esconde, deja de descontar y no borra nada; al prenderlo otra vez está igual.
  - Un bar con insumos de antes los sigue viendo.
  - Un empleado no ve ni cambia el panel.
- **`mesarepetida` 12/12 (nueva):**
  - la mezcla con dos celulares, la cuenta cerrada en uno mientras el otro agrega, y personas y precios distintos;
  - los repetidos de antes, sin contar de más;
  - el stock de los productos, igual que siempre;
  - la Mesa 2 del pantallazo, que queda en un renglón con el mismo valor;
  - el botón «⋯ Opciones».
- **`servidor/equiponoreescribe` 29/29:** 9 nuevas, de funciones del negocio, recetas y auditoría.
- **Servidor:** 21/21 archivos.
- **Java (avisos de pago):** 203/203.
- **Migraciones:** las 43 se aplican sobre una base vacía, todas con RLS.
- **App:** 102 archivos de prueba, en 4 partes a la vez.
  - Las que fallaron por la carga de la máquina pasan corridas solas: cuentas 43/43, appoweb 25/25, erroresreal 33/33,
    adminreal 50/50, usuariosequipo 27/27 y cuentacliente 57/57.
  - `almacen` sigue fallando a veces, igual que con la 1.62.0 (ver el reporte de la 1.63.0).
