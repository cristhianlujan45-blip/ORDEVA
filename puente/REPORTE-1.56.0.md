# Vento 1.56.0 · ORDEVA etapa 4: canales seguros (pedidos falsos, meseros, preparación, saturación) + pruebas en GitHub

Corrige los riesgos R1, R2 (en parte), R3, R4, R5 y R10 de `puente/ORDEVA-AUDITORIA.md`.

## R1 · Un pedido falso ya no entra solo a la cuenta
- **Antes:** quien hubiera escaneado un QR del negocio podía mandar pedidos para cualquier número de mesa. Entraban
  solos a la cuenta y creaban mesas hasta la 500.
- **Ahora:**
  - **El pedido lleva el código de su mesa.** La página del cliente (`pedido.html`) manda el código secreto que
    viene en el QR de esa mesa (`vm`).
  - **Con el código correcto** entra solo a la cuenta, como siempre.
  - **Sin el código, con el de otra mesa o inventado:**
    - **no** entra solo y **no** crea mesas;
    - queda **«🆕 Por aceptar»** con el aviso «⚠️ Sin el código del QR de la mesa: confirma con la mesa antes de
      aceptarlo»;
    - queda en la actividad del equipo.
  - **Al aceptarlo a mano** se suma a la cuenta, y si la mesa no existía, se crea entonces.
- **Varios celulares:** los códigos de las mesas quedan en los datos del negocio (`data.qrCodigos`), así todos los
  celulares reconocen los pedidos. Antes solo los conocía el celular que generó los QR, salvo que estuvieran
  «fijados».
- **Compatibilidad:** los QR impresos no cambian.
  - Un pedido de un QR muy viejo (formato de texto) o de una página vieja guardada en el celular del cliente no se
    pierde: queda por aceptar.

## R3 · El link de meseros solo anota pedidos
- **Desde la app de meseros se puede:** agregar y quitar productos, misma ronda, crear una mesa y pedir la cuenta.
- **Se bloquea:**
  - borrar, reiniciar o vaciar;
  - cerrar o abrir la caja;
  - cambiar precios, inventario o productos;
  - ajustes, claves y usuarios;
  - facturas, DIAN, devoluciones, descuentos, liberar o anular;
  - Laya, respaldos, sedes y negocio.
- Al mesero le responde «⛔ Eso solo se hace en el celular principal del negocio». Queda en la actividad del equipo.

## R4 · Cancelar desde la pantalla de preparación
- Sigue funcionando (es legítimo), pero **queda en la actividad del equipo** y se avisa en el celular principal:
  «✕ Cocina canceló el pedido de Mesa 3: …».

## R2 · Tope por conexión al publicar (saturación)
- **Migración nueva** (`20261108000000_canal_limite_ip.sql`): además de los topes por canal (240 por minuto) y de
  todo el sistema (6.000 por minuto), hay **300 mensajes por minuto por conexión (IP)**.
- **Por qué importa:** una sola persona ya no puede llenar el tope de todo el sistema y frenar los pedidos de todos
  los negocios.
- **Privacidad:** de la IP solo se guarda una huella, nunca la IP, y se borra con el mensaje a los 8 días.

## R10 · Memoria de los mensajes vistos
- `lib/vento-canal.js`: con una pantalla prendida días (TV, cocina), `_vistos` ya no crece sin fin. Quedan los
  1.000 más nuevos.

## R5 · Las pruebas corren en GitHub
- **Servidor Vento** (`servidor-vento.yml`): antes de tocar producción corren **las 16 pruebas del servidor contra
  PostgreSQL real**. Si una falla, **no se despliega**.
- **Pruebas de la app** (`pruebas-app.yml`, nuevo):
  - en cada publicación que cambia la app corren 15 pruebas críticas en un navegador real;
  - la batería completa se lanza a mano (Actions → «Pruebas de la app» → «todas»).

## Pruebas
- **Nueva, `canalseguro`:** 16 comprobaciones.
  - R1: código correcto, sin código, código falso, mesa que no existe, aceptarlo a mano, el aviso en la pantalla
    de pedidos, el formato viejo y el caso de varios celulares.
  - R3: pedido del mesero y 5 comandos peligrosos bloqueados.
  - R4: cancelación desde preparación.
- **Nueva, `servidor/canallimite`:** 5 comprobaciones.
  - 300 mensajes desde una conexión pasan y el 301 se rechaza.
  - Otra conexión sigue publicando normal.
  - Solo queda la huella de la IP, y sin IP se publica como antes.
- **Actualizadas `herramientas` y `sonidos`:** simulan el pedido del QR como lo manda la página real, con el código.
- **Servidor:** las 16 pruebas pasan.
- **App:** pasan `canalvivo`, `cajaqr`, `qrprivado`, `seguridadqr`, `pagosequipos` y `flujocompleto`.
