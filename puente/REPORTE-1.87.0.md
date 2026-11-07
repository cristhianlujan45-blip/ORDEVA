# ORDEVA 1.87.0 · Hoteles: tarifas por temporada y comisión de Booking y Airbnb

**Para:** hoteles, hostales y apartamentos. Es la sección 6b del plan `puente/egm/POS-COMPLETO.md`.

## 1. 🗓️ Tarifas por temporada y fin de semana
- **Dónde:** en «📅 Reservas → 🤖 Reservas en línea», debajo de las habitaciones, salen dos opciones:
  - **Temporadas:** nombre, desde y hasta (día-mes, por ejemplo del 15-12 al 15-01) y el %.
    - Puede cruzar el año.
    - Un % negativo es temporada baja.
    - Si una noche cae en dos temporadas, vale la primera de la lista.
  - **Fin de semana:** + % las noches de viernes y sábado.
- **Cómo se calcula:**
  - Cada noche vale precio × (1 + (temporada + fin de semana) / 100), redondeado a cientos. Por ejemplo, una semana de
    $100.000 la noche con el fin de semana +20 % da $740.000.
  - Si no se pone ninguna regla, todo queda igual que antes.
- **El agente en línea:**
  - muestra y cobra el total de cada noche, que calcula el servidor; lo que ve el cliente es lo mismo que queda en la
    reserva;
  - al conversar no da un precio fijo: dice que el total exacto lo da el sistema al elegir las fechas.
- **Las reservas que se hacen en la app** (📅 Reservas → nueva) quedan con el mismo valor. Antes quedaban sin valor.

## 2. 🌐 Comisión de Booking, Airbnb y Expedia
- **En la cuenta de la habitación** sale «🌐 Viene de»: Directo (sin comisión), Booking, Airbnb, Expedia u Otra.
  - Al tocar «✅ Llegó» en una reserva que entró por el calendario de Booking o Airbnb, se pone sola.
- **Al cobrar:**
  - la venta guarda la plataforma, el % y la comisión;
  - la comisión queda como gasto «Comisión de plataformas» en Contabilidad, así la ganancia del mes ya la descuenta;
  - sale un aviso, por ejemplo: «Booking: comisión de $36.000 (15 %) anotada como gasto. Te queda $204.000».
- **Si la venta se deshace,** el gasto se quita solo.
- **El % de cada plataforma** se pone en Ajustes → Negocio. De entrada: Booking 15 %, Airbnb 3 % y Expedia 18 %.
- **Límite:** la propina no paga comisión. Las demás cosas de la cuenta, como el minibar o el restaurante, sí entran en
  la base de la comisión. Si alguna no la paga, se corrige el gasto a mano en Contabilidad.

## 3. El servidor
- **Migración nueva:** `supabase/migrations/20261129000000_tarifas_temporada.sql`.
  - **Solo agrega:** la función de la tarifa de cada noche, y una versión nueva de las funciones que dan la
    disponibilidad y crean la reserva en línea.
  - **No toca tablas ni borra nada.** Las reglas van en la misma configuración de reservas que ya guarda el dueño.
  - **La función de la tarifa** no se puede llamar desde afuera.
- **La revisión de migraciones:** las 57 se aplican sobre una base vacía, cada una tiene su propia versión y todas las
  tablas tienen RLS.
- **Al publicar,** GitHub la aplica sola, con el flujo «Servidor ORDEVA».

## 4. Pruebas
- **Prueba nueva del servidor `tarifas`:** 9 de 9, contra PostgreSQL de verdad.
- **`reservas`, la del servidor que ya existía:** 28 de 28.
- **Prueba nueva `v187`:** 13 de 13. Revisa que la app calcule igual que el servidor, el editor, la plataforma, la
  comisión y el gasto, y que no se vuelva a envolver «cerrar cuenta».
- RESULTADOS_AQUI
- **No se probó con Booking ni con Airbnb de verdad.**

## 5. Lo que sigue
Está hecho todo lo del orden nuevo del plan (sección 6b de `POS-COMPLETO.md`):
- **1.85:** motel;
- **1.86:** domicilios;
- **1.87:** hoteles.

Lo que queda, según los clientes:
- **Dólares para turismo.**
- **Asistencia del personal.**
- **Menú del día.**
- **Bonos y tarjetas regalo.**
- **Pruebas con equipos de verdad.**
