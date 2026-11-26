package co.vento.app;

/**
 * 🔄 1.99.83 · ¿Es buen momento para que la app se actualice sola? (sin Android: se prueba con pruebas/java/PlanActualizarPrueba)
 * ORDEVA deja la pantalla prendida: en un negocio con el celular siempre en ORDEVA nunca era «buen momento» y la app se
 * quedaba vieja (25/11: el Samsung seguía sin la 1.99.78, la de los SMS repetidos). Ahora:
 *  • NO_ESTA: ORDEVA no está en pantalla y no acaba de llegar un pago (1 min) → se instala (como siempre).
 *  • MADRUGADA: está en pantalla, pero son las 3:00 a 4:59 y nadie la tocó ni llegó un pago en 30 min → se instala y al
 *    terminar se vuelve a abrir. (De 3 a 5: los bares ya cerraron y nadie está cobrando.)
 *  • ESPERAR: cualquier otro caso.
 */
final class PlanActualizar {
    private PlanActualizar() { }
    static final int ESPERAR = 0, NO_ESTA = 1, MADRUGADA = 2;
    static final long MIN = 60_000L;

    static int momento(long ahora, int horaDelDia, boolean alFrente, long ultimoToque, long ultimoPago) {
        if (!alFrente) return ahora - ultimoPago < MIN ? ESPERAR : NO_ESTA;
        boolean madrugada = horaDelDia >= 3 && horaDelDia < 5;
        boolean quieto = ahora - ultimoToque >= 30 * MIN && ahora - ultimoPago >= 30 * MIN;
        return madrugada && quieto ? MADRUGADA : ESPERAR;
    }
}
