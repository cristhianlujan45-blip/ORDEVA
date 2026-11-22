# ORDEVA 1.99.32 · Diseño en tableta y computador

## Pedido del dueño (22/11): «Continúa con lo siguiente de la auditoría»
Hasta la 1.99.31 todo se midió en celular (390 y 320 px). Ahora se midió también en:
- tableta de pie (768 px) y acostada (1024 px), con pantalla táctil;
- computador (1280 px), con mouse;
- celular en modo oscuro;
- la Caja POS en los tres tamaños.

### Lo que se arregló
| Dónde | Antes | Ahora |
|---|---|---|
| Cuenta de la mesa en tableta: − y + de cada producto, ✕ y 🕐 | 30, 21 y 24 × 17 px (los 44 px solo llegaban hasta 759 px de ancho) | 44 px en toda pantalla táctil; con mouse sigue igual |
| Caja POS: «Quedan 5», «Agotado» | 10 px | 12 px |
| Caja POS: «TOTAL», ayuda de teclas (F1, F2…), «Escribe un valor y ➕» | 11 a 11,5 px | 12 px |
| Fecha del reloj de arriba (tableta y computador) | 10,5 px | 12 px |
| Menú lateral del computador: «Tu negocio, en control» y el nombre del negocio | 11,5 y 10,8 px | 12 px |
| Tabla de productos del computador: «unidades» | 11,5 px | 12 px |
| Estadísticas › flechas de los movimientos (tableta) | 34 px | 44 px |
| Entrar (tableta): «Me invitaron a un negocio», «¿Ya tenías una cuenta?» | 32 y 24 px de alto | 44 px |
| Cuenta de la mesa y cierre (tableta): «Enviar captura por WhatsApp», «Imprimir recibo» | 32 px | 44 px |

### Se deja como está, a propósito
En el computador con mouse hay botones de 29 a 34 px de alto (periodos, chips, «Vaciar cola»…). Con mouse son cómodos.
En pantallas táctiles ya miden 44 px gracias a las tandas anteriores.

### Comprobado
- Fotos en 768 y 1024 px de la cuenta de la mesa (todo cabe en el renglón) y de la Caja POS en 390 y 768 px.
- Medición nueva:
  - texto de menos de 12 px: de 1 a 3 por pantalla (22 en la Caja POS) → 0;
  - botones chicos en la cuenta de la mesa (tableta): 11 → 0.
- **Prueba nueva:** `pruebas/tableta1932.test.js` (14/14). Con la 1.99.31 fallan 12 de 14.
