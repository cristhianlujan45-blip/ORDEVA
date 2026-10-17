package co.vento.app;

/**
 * Por dónde sale la voz de cada pago, en CUALQUIER celular o tablet (Samsung, Xiaomi, Motorola, Huawei, OPPO, Vivo…).
 * Sin nada de Android para poder probar todos los casos (pruebas/java/PlanVozPrueba.java).
 *  • «parlante»: hay un parlante de avisos conectado → se graba la frase y se toca en ese parlante.
 *  • «archivo»: volumen por encima de 100 % → se graba, se refuerza parejo y se toca. SOLO con los motores de voz que
 *    graban bien a archivo (Google y Samsung). Con otros (el de Xiaomi y otras marcas), grabar a archivo a veces no
 *    termina o deja un archivo que no suena: el pago quedaba callado (1.43.9).
 *  • «directo»: lo de siempre, el motor de voz habla directo (con el volumen de la alarma al máximo si se pidió más de
 *    100 %). Es lo que funciona en todos los celulares.
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
        if (AvisoPago.refuerzo(volumenPct) <= 0) return "directo";
        return grabaBien(motor) ? "archivo" : "directo";
    }
}
