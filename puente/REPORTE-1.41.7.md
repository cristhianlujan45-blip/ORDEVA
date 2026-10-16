# Vento 1.41.7 · Nequi abre la ventana igual que DaviPlata

El dueño: «Con DaviPlata sí abre la ventana, con Nequi no. Verifica cuál es el problema. Que todo sea muy rápido sin
dañar el código».

## Las dos causas que solo afectan a Nequi
1. **Nequi por SMS y luego por la app.** Si el mismo pago llegaba primero por SMS, Vento lo decía como «revísalo» (Nequi
   no tiene un número corto confirmado como el 85888 de DaviPlata). Cuando llegaba el aviso de la app de Nequi, lo tomaba
   como «ya dicho» y NO abría la ventana. Con DaviPlata no pasaba: su SMS cuenta como confirmado.
   - Ahora cada aviso guarda si se dijo como pago CONFIRMADO.
   - Si el SMS solo fue «revísalo», la app de Nequi lo confirma: voz «Recibiste 1500 pesos por Nequi», notificación y
     🪟 ventana.
   - El 85888 de DaviPlata sigue sin repetirse.
2. **App sin actualizar.** El Nequi «te envió 1500» (sin «$») solo lo entiende la app desde la 1.0.39. Con una más
   vieja lo entiende la página, que en esa app solo saca la notificación. La app revisaba versiones nuevas cada 3 h y se
   publicaron varias seguidas.
   - Ahora revisa cada 30 min (Vento y Vento Admin).
   - Si hay una nueva esperando, sale el aviso «🔄 Hay una versión nueva de Vento (1.0.43)» con «Actualizar ahora».
     Sale una vez al abrir y no estorba.

## Pruebas
- `EscuchaPrueba` 29: Nequi por SMS y luego por la app → voz, notificación y ventana «$1.500». Sigue pasando
  «DaviPlata por SMS y por la app → una sola voz».
- `pagosaviso` 92: aviso «Hay una versión nueva» con «Actualizar ahora».
- `javaavisos` 188; pasan `pagosguia` y `avisosandroid`; compilan las dos apps Android.
