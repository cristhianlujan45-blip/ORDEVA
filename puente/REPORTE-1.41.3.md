# Vento 1.41.3 · Nequi con el valor sin «$» y sin avisos de celulares al día

El dueño (captura del 16-oct, 1:45 p. m.): «Nequi mandó la notificación y no la detectó. Solo rectifica eso, y quítame
las notificaciones de que los celulares están actualizados / conectados. No muevas nada más».

## Qué cambió (solo esto)
- **Nequi sin «$»:** el aviso real dice «Envío · MARIBE ARIAS te envió 1500, ¡lo mejor!», con el valor sin signo. Vento
  leía el aviso pero no encontraba el valor y no decía nada. Ahora entiende el valor después de «te envió», «te pasó»,
  «te mandó», «te transfirió», «te consignó», «te giró» o «te pagó». Suena «Recibiste 1500 pesos por Nequi», con su
  notificación y su ventana. La regla está en la app Android y en la página.
- **Sin avisos de sincronización:** se quitaron «🔄 Datos al día con tus otros equipos» y «🔄 Otro celular también hizo
  cambios: se juntaron los dos». Los datos se siguen juntando y actualizando solos, en silencio.

## Pruebas
- `javaavisos`: `AvisoPagoPrueba` 143 y `EscuchaPrueba` 28, con el aviso real de Nequi («te envió 1500», «25,000» y
  «1.500.000»). Suena, sale la notificación «💜 Recibiste $1.500 por Nequi» y la ventana con «$1.500».
- `pagosaviso`: la página entiende el mismo aviso ($1.500 de Maribe Arias).
- Pasan `pagosguia`, `sincroniza`, `canalvivo` y `suscripnube`; compila todo el código Android.
