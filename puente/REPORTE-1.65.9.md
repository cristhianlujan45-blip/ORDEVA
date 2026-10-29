# ORDEVA 1.65.9 · 🏷️ Productos reconocidos por su código + «¿cuántas llegaron?» + lector del celular más rápido

## Qué se pidió
- Que al escanear el código de barras de un producto de la canasta colombiana ORDEVA sepa qué producto es.
- Que el celular conectado por QR no se quede en la primera lectura y que la transmisión sea rápida.
- Que al escanear un producto nuevo la ficha se llene sola (con IA si ayuda) y pregunte cuánto llegó.
- Para vender: si ya está en el inventario, que se agregue a la venta. Si no está, que se pueda crear ahí mismo.

## Qué quedó

### 1. El celular como lector (el de 1.65.0, sin duplicar)
- Se dejó el lector de la otra sesión (`lector.html` + `lib/vento-lector-cel.js`), que ya manda cada lectura sin
  perderla.
- Su canal ahora revisa cada **0,8 s** (`rapido=1` en `lib/vento-canal.js`). Antes revisaba cada 2,5 s.
- Si el aviso al instante (Realtime) está vivo, revisa cada 3 s: el aviso ya trae el mensaje de una.
- Solo pasa mientras un lector está abierto. El resto de canales sigue igual.

### 2. ¿Qué producto es? (`lib/vento-producto-codigo.js`)
Se busca en este orden y se usa el primero que lo tenga:
1. **📚 Catálogo de ORDEVA** (`catalogo_buscar`): lo que otros negocios ya registraron con ese código.
   - Aprende solo: cada producto creado o enlazado a un código se aporta (`catalogo_aportar`).
   - Solo guarda el nombre, la marca, el tamaño y la categoría, nunca precios ni datos del negocio.
   - Solo pueden aportar los miembros de un negocio, con un tope de 300 aportes por hora. Gana el nombre que más
     negocios usan.
2. **🌐 Bases libres**: Open Food Facts, Open Products Facts y Open Beauty Facts al mismo tiempo. Gana la primera
   que responda, con máximo 6 s de espera.
3. **🤖 IA con búsqueda en internet**, solo si el negocio tiene la IA configurada.
   - A los códigos 770 (Colombia) les busca en Éxito, Olímpica, D1, Ara, etc.
   - Solo se acepta si la IA trae la página donde aparece **ese** código. Si no, no llena nada.
   - Sale marcado «🤖 … revísalo».
4. **📷 Foto con IA**: en la ficha, una foto de la etiqueta la reconoce (`recognizeProductWithAI`).

### 3. La ficha del producto nuevo
- Sale llena con el nombre, la marca, el tamaño y la categoría, y marca «🇨🇴 producto colombiano» en los 770.
- **El precio nunca se llena solo** (nada inventado): sin precio no se guarda.
- El producto queda con su código. La próxima vez se reconoce al instante.
- Se abre desde:
  - Inventario por código: consultar, entrada de mercancía y toma de inventario.
  - «🔗 ¿Qué producto es?» → «Es un producto nuevo»: mesa, venta rápida y la cámara de la caja (POS). Al guardar,
    el producto pasa a la venta o la cuenta.
- Crear productos sigue siendo del dueño o de quien tenga el permiso «Crear y editar productos». Si no lo tiene, la
  ficha no se abre.

### 4. 📥 Entrada de mercancía: «¿Cuántas llegaron?»
- Al escanear un producto ya inventariado se pregunta cuántas llegaron y el costo, si cambió.
- Si se sigue escaneando el **mismo** código con la pregunta abierta, suma 1 a esa cantidad.
- Otro código queda **en fila** y sale después, sin perderse. El celular lector sigue mandando mientras tanto.
- «Preguntar cada vez» se puede quitar: entonces cada lectura suma 1, como antes. «3*código» suma 3 sin preguntar.
- Para un producto nuevo, la ficha ya trae «¿Cuántas llegaron?».

### 5. Servidor
- Migración nueva `20261118000000_catalogo_codigos.sql`: **solo agrega** tablas y funciones. No borra ni cambia
  nada.
- Las tablas tienen RLS y sin acceso directo; solo se usan las dos funciones.

## Pruebas
- `pruebas/codigoproducto.test.js` (22 ✅), con una base libre de mentira. Cubre:
  - la ficha llena;
  - «colombiano»;
  - el precio sin inventar y obligatorio;
  - el producto con su código;
  - entrada con 6;
  - la fila con la ficha abierta;
  - el código desconocido sin nada inventado;
  - «¿cuántas llegaron?» sumando lo que manda el celular;
  - el costo nuevo;
  - preguntar apagado;
  - «3*»;
  - el producto nuevo desde la venta;
  - sin permiso no crea.
- `pruebas/servidor/catalogo.test.js` (12 ✅) en Postgres: aportar, buscar, permisos, tope y el nombre más votado.
- Siguen bien `lectorcel` (24 ✅), la suite completa de la app y todas las pruebas del servidor. Las migraciones se
  revisaron: 48 OK.

## Avisos de pago (diagnóstico de solo lectura)
- El servidor sí recibe los pagos.
- Cuando no suena, es el celular Xiaomi: lee el aviso del banco tarde o no tiene el permiso de mostrarse encima.
- En el celular: Ajustes → 💜 Pagos → «Arreglar». Allí: inicio automático, batería «Sin restricciones», «Mostrar
  encima de otras apps», y dejar ORDEVA con candado en las apps recientes.

## Lo que no se pudo probar
- Un celular y un computador de verdad: la latencia real del canal. Solo se probó con el servidor de canales simulado.
- Las bases libres y la IA de verdad: en la prueba se simulan. Si Open Food Facts no tiene un producto colombiano,
  el catálogo de ORDEVA lo aprende la primera vez que un negocio lo registra.
