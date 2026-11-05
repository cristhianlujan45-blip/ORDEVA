# ORDEVA 1.81.4 · Cada equipo con sus propios ajustes

**Pedido del dueño:** «si tengo la misma cuenta abierta en otro dispositivo, déjame controlar el volumen
independientemente… una configuración que yo haga en un celular, si lo pongo en modo fácil, no afecte al otro».

## Qué pasaba
Algunos ajustes viajaban con los datos del negocio. Al cambiarlos en un equipo se pasaban a **todos** los de la cuenta:
- **🧓 Modo fácil:** prenderlo en un celular lo prendía en el computador y en los demás.
- **Vista de las mesas** (lista o plano).
- **Animación de fondo** (lluvia).

## Qué cambió
- Esos tres ajustes ahora son **de cada equipo**:
  - cada equipo los guarda aparte, por negocio;
  - la nube ya no los sube (`nube/vento-nube.js`, en `subirFoto`);
  - al llegar los datos de otro equipo, cada uno se queda con los suyos (`app/04a-inicio-cuentas-clientes.js`).
- **La primera vez** que un equipo se actualiza, se queda con lo que ya tenía.
- **En Ajustes → Modo fácil** dice «📱 Solo en este equipo».

## Lo que ya era de cada equipo (se revisó)
- **Volumen y voz de los pagos** (Ajustes → Pagos). En la app Android también: se guarda en el celular.
- **Volumen de la campana de pedidos**, **sonidos de la caja** y **voz de la caja**.
- **Elección de la voz** y su velocidad.
- **Vista sencilla**.
- **«¿Suenan aquí los avisos de pago?»**: lo elige el dueño para cada equipo.

## Lo que sigue siendo del negocio (a propósito)
- **El diseño** (tema, colores, decoración): también es el de la carta del QR que ven los clientes. Si fuera de cada
  equipo, la carta cambiaría de diseño según el último equipo que la publicó.
- **Los datos y los ajustes del negocio:** productos, propina, Nequi, horarios, «ver todas las funciones»…

## Pruebas
- **Nueva `ajustesequipo`** (17 revisiones, contra el servidor de pruebas, dos equipos en la misma cuenta):
  - con la versión anterior falla 7: el computador se ponía en modo fácil y la nube se quedaba con él;
  - ahora pasa 17 de 17.
- **Comprueba también** que no hay ida y vuelta: con ajustes distintos, ningún equipo se queda subiendo datos.
- **Pasan:**

  | Grupo | Pruebas |
  |---|---|
  | Modo fácil y apariencia | `facil`, `facilpantallas`, `modos`, `apariencias`, `vistasencilla`, `ordeva2` |
  | Mesas y plano | `plano`, `mapa` |
  | Sincronización | `sincroniza`, `sincmesas`, `cuentas` |
  | Canal y QR | `canalseguro`, `qrprivado` |
  | Caja y cierre | `cajaqr`, `cerrarcaja` |
  | Ajustes | `ajustesorden` |
  | Otras | `guia`, `herramientas`, `practica` |
