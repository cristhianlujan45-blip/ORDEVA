# ORDEVA 1.99.23 · Un pago registrado en una mesa ya no se pierde al sincronizar

## Qué pasaba
La prueba nocturna del 20/11 (`pagosequipos`, parte 7) falló. El computador registró el pago de $27.300 en la Mesa 4,
y segundos después ese pago ya no estaba en ningún equipo.

Se reprodujo corriendo la prueba 4 veces a la vez, con el equipo más lento. Falló en 2 de las 4. El registro nuevo de la
prueba mostró el orden exacto:
1. ORDEVA guardó un cambio de «pagos» y avisó a la nube, que empezó a subirlo.
2. Menos de 120 ms después se registró el pago en la mesa. Ese guardado se juntó con el anterior, que todavía no se
   escribía, y **no le avisó a la nube**.
3. La nube terminó de subir lo primero y quedó «sin nada pendiente». Cuando otro equipo cambió algo, la bajada puso la
   Mesa 4 sin el pago.

Puede pasar con cualquier cambio hecho justo después de otro, no solo con pagos. Es más fácil en un celular lento.

## Qué cambia
- `app/04a` `saveData`: si un guardado se junta con uno pendiente, avisa a la nube al escribirse lo pendiente (como
  mucho 120 ms). Avisa una sola vez, aunque sean muchos guardados seguidos.
- Una bajada escribe lo pendiente antes de mirar si hay algo por subir, así que ya no alcanza a pisarlo.

## Pruebas
- **Nueva `pruebas/guardadojunto.test.js`** (4/4). Con el código anterior falla (2 mal). Revisa:
  - dos guardados seguidos avisan dos veces a la nube;
  - 50 seguidos no avisan 50 veces;
  - todo queda guardado;
  - mientras llegan datos de otro equipo, el cambio queda anotado para subirse.
- **`pagosequipos`, 4 a la vez:**
  - Antes del arreglo, la parte 7 falló 2 de 4.
  - Con el arreglo pasó 16 de 16, en 4 tandas.
  - En dos de esas corridas falló otra cosa:
    - Una vez el punto 4 («un solo pago de $300»). Ahora la prueba dice qué pagos quedaron, para la próxima vez.
    - Una vez la autorización del celular al arrancar no alcanzó en 15 s, con siete pruebas corriendo a la vez en la
      misma máquina.
- **`pagosequipos` normal:** 3/3.
- **Sincronización, todas bien:** `sincmesas`, `sincroniza`, `sincstress`, `nubecambiocuenta`, `nubeinventario`,
  `nubetrabada`, `doscierres`, `equipoactividad`, `ajustesequipo`, `pagostodos`, `pagosprivados`, `pagossuenan`,
  `ventasfiados`, `usuariosequipo` y `flujocompleto`.
- **`almacen`:** también falló esa noche, pero era de la prueba. Simulaba «una versión vieja escribió» mientras ORDEVA
  tenía un guardado pendiente. Ahora primero termina lo pendiente. Pasa 3/3.

## Errores reales (diagnóstico de 24 h, 20/11 18:46 UTC)
- No volvió «Android cerró la página por falta de memoria». Hubo 2 en dos días, contra 47 en un día con la 1.99.16.
- No hay errores nuevos.
