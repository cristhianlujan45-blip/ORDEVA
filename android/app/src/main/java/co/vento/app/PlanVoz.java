package co.vento.app;

/**
 * Por dónde sale la voz de cada pago, en CUALQUIER celular o tablet (Samsung, Xiaomi, Motorola, Huawei, OPPO, Vivo…).
 * Sin nada de Android para poder probar todos los casos (pruebas/java/PlanVozPrueba.java).
 *  • «parlante»: hay un parlante de avisos conectado → se graba la frase y se toca en ese parlante.
 *  • «directo»: SIEMPRE que no hay parlante (1.50.0). El motor de voz habla directo, por la alarma; con más de 100 % el
 *    refuerzo va sobre la misma voz en vivo (VentoApp.paramsVoz). Es lo que funciona en todos los celulares.
 *    Antes, con más de 100 % y la voz de Google o Samsung, la frase se grababa a un archivo y se tocaba («archivo»): en la
 *    1.49.0 el 130 % de fábrica mandó a casi todos por ahí y en varios celulares el pago quedó callado.
 */
final class PlanVoz {
    private PlanVoz() { }
    /** Motores de voz que graban a archivo sin problemas. */
    static final String[] GRABAN_BIEN = {"com.google.android.tts", "com.samsung.SMT"};

    static boolean grabaBien(String motor) {
        if (motor == null) return false;
        for (String m : GRABAN_BIEN) if (m.equals(motor)) return true;
        return false;
    }

    static String camino(boolean parlanteConectado, int volumenPct, String motor) {
        if (parlanteConectado) return "parlante";                       // (si falla, se dice directo: ver VentoApp)
        return "directo";
    }
}
