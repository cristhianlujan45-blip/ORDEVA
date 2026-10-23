# Vento 1.55.4 · Aviso de Nequi más rápido con el celular bloqueado + diagnóstico real de demoras

## Se mantiene la lectura del aviso de Nequi (pedido del dueño)
Es la que avisa cualquier transferencia a su Nequi. Esta versión la hace más rápida y deja medido de dónde viene
cada demora.

## Lo que ya tenía (revisado en el código)
- **Voz:** se dice en el instante en que llega el aviso. No hay esperas.
- **Motor de voz:** queda preparado de antemano.
- **Fondo:**
  - el servicio en primer plano mantiene la app viva con la pantalla apagada;
  - el celular se mantiene despierto mientras se anuncia el pago;
  - arranca solo al encender el celular.
- **Lectura de avisos:** se reconecta sola si Android la suelta.
- **Barrido de la barra de notificaciones:** toma los pagos que Android no le pasó a Vento.
- **Ahorro de batería de la app Nequi:** se detecta y la app guía a ponerlo en «Sin restricciones», porque con
  ahorro Android retrasa los avisos del banco.

## Mejoras (app Android 1.0.60)
- **Reconexión:** si Android suelta la lectura de avisos (pasa con la pantalla apagada y el ahorro de batería), se
  revisa **cada 10 s** (antes cada minuto). Si en **30 s** (antes 2 min) no volvió, se reinicia la lectura.
  - Antes, un pago podía quedar sin sonar hasta un minuto o más, o hasta desbloquear.
- **Barrido de la barra cada 5 s** (antes 10 s): un pago que Android no le pasó a Vento se dice hasta 5 s antes.

## Diagnóstico real (página)
Cuando un pago se avisa tarde, el celular lo manda al panel de administrador (🐞 Errores) con **solo los tiempos**,
sin valores ni nombres.
- **«el banco lo mandó X s tarde»** (20 s o más): fue **Nequi**, que mandó su aviso tarde. Suele pasar con el
  ahorro de batería de la app Nequi o con el celular en reposo profundo.
- **«Vento lo leyó X s después»** (5 s o más): fue **Vento o Android**.
- **«Android no le pasó el aviso a Vento: lo tomó el barrido»**.

Con esos datos de los celulares reales se ve dónde se pierde el tiempo, en vez de suponerlo.

## Credenciales oficiales
- La guía está en `puente/CREDENCIALES-PAGOS.md`: Wompi (en línea) y Nequi Conecta (por el formulario de Nequi
  Negocios).
- La app ya trae las dos integraciones; solo faltan las llaves del negocio.

## Pruebas
- Java: `javaavisos` 224.
- Página: `avisosandroid` 15 y `pagosaviso` 94.
- Simulación del registro de la app:
  - se reportan una vez cada uno el banco tarde (45 s), Vento tarde (7 s) y el barrido;
  - una demora normal (4 s) no se reporta.
- **Pendiente de prueba física:** el tiempo real con el celular bloqueado se ve en los reportes de demora después
  de instalar la 1.0.60.
