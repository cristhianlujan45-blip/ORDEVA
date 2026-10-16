package co.vento.app;

/**
 * Cómo se abre la 💜 ventana de un pago en CADA celular (Samsung, Xiaomi, Motorola, OPPO…, Android 7 a 15). Sin nada de
 * Android para poder probarlo con todos los casos (pruebas/java/PlanVentanaPrueba.java).
 *  • Vento a la vista y desbloqueado: la muestra la página (aquí nada).
 *  • Bloqueado o pantalla apagada: la notificación de «pantalla completa» (la abre Android encima de la pantalla de
 *    bloqueo, como una llamada) Y además se abre directo (algunos celulares, como Xiaomi, no abren la de la notificación).
 *    En Android 15, para abrirla directo hace falta una ventana de Vento encima (el «ancla»).
 *  • Usando otra app: encima de esa app (permiso «encima de otras apps»); sin ese permiso se intenta como pantalla.
 *  • «falta»: el permiso que hay que pedir para que en ESE celular salga siempre ("" si no falta ninguno).
 */
final class PlanVentana {
    boolean pantallaCompleta, directo, encima, ancla;
    String falta = "";

    static PlanVentana de(int sdk, boolean bloqueado, boolean alFrente, boolean puedeEncima, boolean puedeCompleta, boolean xiaomi, Boolean xiaomiFondo, Boolean xiaomiBloqueo) {
        PlanVentana p = new PlanVentana();
        if (alFrente && !bloqueado) return p;
        if (bloqueado) {
            p.pantallaCompleta = true;
            p.directo = true;
            p.ancla = puedeEncima && sdk >= 35;
            if (xiaomi && Boolean.FALSE.equals(xiaomiBloqueo)) p.falta = "xiaomi";
            else if (!puedeCompleta && !puedeEncima) p.falta = "completa";
        } else {
            p.encima = puedeEncima;
            p.directo = !puedeEncima;
            if (!puedeEncima) p.falta = "encima";
            else if (xiaomi && Boolean.FALSE.equals(xiaomiFondo)) p.falta = "xiaomi";
        }
        return p;
    }

    /** ¿Se vuelve a intentar abrir la ventana? (a los 1,5 s y a los 4 s). "" = no; "encima" = encima de la app que se
     *  esté usando; "pantalla" = como pantalla (sobre la pantalla de bloqueo si está bloqueado). Nunca si ya se vio, si
     *  Vento está a la vista (ahí la muestra la página), si la ventana está apagada o después del 2º reintento. */
    static String reintento(boolean visto, boolean alFrente, boolean prendida, int intento, boolean bloqueado, boolean puedeEncima) {
        if (visto || alFrente || !prendida || intento > 2) return "";
        return !bloqueado && puedeEncima ? "encima" : "pantalla";
    }

    @Override public String toString() { return (pantallaCompleta ? "completa " : "") + (directo ? "directo " : "") + (encima ? "encima " : "") + (ancla ? "ancla " : "") + (falta.isEmpty() ? "" : "falta:" + falta); }
}
