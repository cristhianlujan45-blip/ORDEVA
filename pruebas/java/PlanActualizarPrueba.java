// 🔄 1.99.83 · Cuándo se actualiza sola la app Android (PlanActualizar), sin celular.
package co.vento.app;

public class PlanActualizarPrueba {
    static int ok = 0, mal = 0;
    static void chk(String n, boolean c) { if (c) { ok++; System.out.println("✅ " + n); } else { mal++; System.out.println("❌ " + n); } }
    public static void main(String[] a) {
        long t = 1_800_000_000_000L, m = 60_000L;
        chk("ORDEVA cerrada o minimizada, sin pago reciente → se instala (como siempre)", PlanActualizar.momento(t, 15, false, t - m, t - 10 * m) == PlanActualizar.NO_ESTA);
        chk("… pero si acaba de sonar un pago (30 s) → espera", PlanActualizar.momento(t, 15, false, t - m, t - 30_000L) == PlanActualizar.ESPERAR);
        chk("En pantalla de día (3 p. m.) → espera, aunque nadie la toque", PlanActualizar.momento(t, 15, true, t - 5 * 60 * m, t - 5 * 60 * m) == PlanActualizar.ESPERAR);
        chk("En pantalla a las 3:xx a. m., sin toques ni pagos en 30 min → se instala de madrugada", PlanActualizar.momento(t, 3, true, t - 31 * m, t - 45 * m) == PlanActualizar.MADRUGADA);
        chk("… a las 4:xx a. m. también", PlanActualizar.momento(t, 4, true, 0, 0) == PlanActualizar.MADRUGADA);
        chk("A la 1 o 2 a. m. (bar abierto) → espera", PlanActualizar.momento(t, 1, true, 0, 0) == PlanActualizar.ESPERAR && PlanActualizar.momento(t, 2, true, 0, 0) == PlanActualizar.ESPERAR);
        chk("A las 5 a. m. → espera (ya pueden estar abriendo)", PlanActualizar.momento(t, 5, true, 0, 0) == PlanActualizar.ESPERAR);
        chk("3 a. m. pero la tocaron hace 10 min → espera", PlanActualizar.momento(t, 3, true, t - 10 * m, 0) == PlanActualizar.ESPERAR);
        chk("3 a. m. pero llegó un pago hace 20 min → espera", PlanActualizar.momento(t, 3, true, 0, t - 20 * m) == PlanActualizar.ESPERAR);
        System.out.println("RESULTADO " + ok + " bien " + mal + " mal");
    }
}
