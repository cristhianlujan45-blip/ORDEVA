# ORDEVA 1.95.1 · 🔄 El QR de la mesa sincronizado con su cuenta

**Pedido del dueño:** «rectifica el tema del QR que esté sincronizado con las cuentas de la mesa… las mesas acogen el QR,
todo ya está funcionando, pero no están las cuentas registradas y no están con los datos sincronizados».

## Qué pasaba
Cada mesa tiene un código secreto, el `v` del QR impreso. Con ese código, la página del cliente escucha la cuenta en vivo.
Había tres fallas:

1. **La cuenta se publicaba a un solo código: el que tenía guardado cada equipo.**
   - Si el QR pegado en la mesa lo imprimió otro celular, o se imprimió antes de cambiar de equipo, el código no coincidía.
   - El cliente nunca veía su cuenta: «Tu mesa no tiene consumo todavía», aunque el mesero ya hubiera anotado todo.
2. **La cuenta solo se publicaba después del primer pedido o canción que el cliente mandaba desde el QR.**
   - Si el cliente solo abría el QR para mirar «Mi cuenta», no le salía nada.
3. **Los equipos compartían sus códigos de mesa solo al crear uno nuevo.**
   - Los QR impresos antes de la 1.56 solo los reconocía el equipo que los imprimió.
   - En los demás equipos, los pedidos de esos QR quedaban «🆕 Por aceptar» y no entraban a la cuenta.

## Qué cambió
- **La cuenta en vivo sale a todos los códigos conocidos de la mesa:** los de este equipo, los de los QR fijados y los que
  compartieron los demás equipos (`publicarMesaVivo` en `app/09-cuentas-mesa-modulo.js`).
- **Al abrir el QR, la página del cliente avisa al negocio** con un «hola» que lleva el código de su QR. Si el código es de
  esa mesa, la cuenta se publica en ese momento, aunque el cliente no haya pedido nada. El aviso sale como mucho una vez
  cada 2 minutos (`pedido.html`).
- **Si el QR trae un código que ningún equipo conoce:**
  - no se le publica la cuenta, para que nadie vea la cuenta de otra mesa;
  - el dueño recibe el aviso de cómo arreglarlo: abrir ORDEVA en el equipo que imprimió esos QR, o usar Ajustes → QR →
    «Fijar mis QR impresos».
- **Cada equipo comparte sus códigos al abrir ORDEVA y al llegar datos de otro equipo.** Antes los compartía solo al crear
  un código nuevo.
- **Se guardan hasta 8 códigos por mesa.** Antes eran 4, y se podía perder el del QR impreso.
- **No cambia nada en el servidor:** los canales de la cuenta en vivo ya eran públicos de leer y siguen igual.

## Pruebas
- **Nueva:** `qrcuenta` (12), contra el servidor de pruebas, con la app y la página del QR de verdad.
  - **El caso:** el QR pegado lo imprimió otro equipo y este equipo tiene su propio código para esa mesa.
  - **Lo que revisa:**
    - el cliente ve su cuenta sin pedir nada;
    - su pedido entra solo a la cuenta y él lo ve;
    - lo que agrega el mesero le llega;
    - un código desconocido no recibe nada y el dueño recibe el aviso;
    - los códigos guardados solo en un equipo suben a la nube.
  - **En la versión 1.95.0 fallan 7 de esas 12 revisiones.** Es justo lo que se veía: «Tu mesa no tiene consumo todavía».
- **Resultados:**
  - lista completa: 120 pruebas, 2.681 revisiones, 0 fallas;
  - no cambia el servidor ni Android: valen los de la 1.94.0 (servidor 29 de 29, Android 328 de 328).
- **Límites:**
  - no se probó con celulares ni con QR impresos de verdad;
  - si un QR impreso tiene un código que ningún equipo guardó nunca (el celular que lo imprimió se perdió o se borró), hay
    que fijarlo una vez con «Fijar mis QR impresos» o reimprimirlo.
