package co.vento.app;

import java.util.ArrayList;
import java.util.List;

/** SOLO PARA PRUEBAS (pruebas/java/EscuchaPrueba.java): reemplaza a VentoApp para correr VentoEscucha sin Android.
 *  Anota lo que se diría en voz alta y los avisos del celular, y deja correr «a mano» lo que se programa para después. */
public class VentoApp {
    static VentoApp app = new VentoApp();
    static final Cola ui = new Cola();
    static final List<String> dichos = new ArrayList<>(), avisos = new ArrayList<>();
    static void motor(Object o) { }
    static void js(String s) { }
    static void mantenerDespierto() { }
    static void decirPago(String f) { dichos.add(f); }
    static void anunciarPago(String app, long monto, boolean notif) { anunciarPago(app, monto, notif, null); }
    static void anunciarPago(String app, long monto, boolean notif, String texto) { dichos.add(AvisoPago.frase(app, monto, texto)); if (notif) avisos.add("💜 Pagaron " + AvisoPago.plata(monto)); }
    static void anunciarPagoAviso(String banco, long monto) { avisos.add("💜 Pagaron " + AvisoPago.plata(monto) + " (SMS)"); }
    class Puente { public boolean notificar(String t, String x, String c, boolean b) { avisos.add(t); return true; } }
    static final class Cola {
        final List<Runnable> despues = new ArrayList<>();
        boolean post(Runnable r) { r.run(); return true; }
        boolean postDelayed(Runnable r, long ms) { despues.add(r); return true; }
        void correr() { List<Runnable> l = new ArrayList<>(despues); despues.clear(); for (Runnable r : l) r.run(); }
    }
}
