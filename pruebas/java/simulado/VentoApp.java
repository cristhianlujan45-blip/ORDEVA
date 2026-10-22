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
    static final List<String> jss = new ArrayList<>(), reenvios = new ArrayList<>();
    static void js(String s) { jss.add(s); }
    static String q(String s) { return "\"" + (s == null ? "" : s.replace("\"", "\\\"")) + "\""; }
    static void reenviarPago(String id, String txt, String revisar, boolean smsOk) { reenvios.add(id + "|" + txt); }
    static void mantenerDespierto() { }
    static void decirPago(String f) { dichos.add(f); }
    static void anunciarPago(String app, long monto, boolean notif) { anunciarPago(app, monto, notif, null); }
    static void anunciarPago(String app, long monto, boolean notif, String texto) { dichos.add(AvisoPago.frase(app, monto, texto)); if (notif) notificarPago("💜 Recibiste " + AvisoPago.plata(monto) + " por " + AvisoPago.nombreApp(app), AvisoPago.frase(app, monto, texto), texto, AvisoPago.plata(monto), (AvisoPago.esBreB(texto) ? "Bre-B en " : "") + AvisoPago.nombreApp(app), "ok"); }
    static void anunciarPagoAviso(String banco, long monto) { anunciarPagoAviso(banco, monto, null); }
    static void anunciarPagoAviso(String banco, long monto, String texto) { notificarPago("💜 Recibiste " + AvisoPago.plata(monto) + " por " + AvisoPago.nombreApp(banco), AvisoPago.frase(banco, monto, texto), texto, AvisoPago.plata(monto), (AvisoPago.esBreB(texto) ? "Bre-B en " : "") + AvisoPago.nombreApp(banco), "ok"); }
    static final List<String[]> notifs = new ArrayList<>();
    static void notificarPago(String titulo, String frase, String original) { notificarPago(titulo, frase, original, "", "", "ok"); }
    static void notificarPago(String titulo, String frase, String original, String valor, String banco, String tipo) { avisos.add(titulo); notifs.add(new String[]{titulo, frase, original, valor, banco, tipo}); }
    class Puente { public boolean notificar(String t, String x, String c, boolean b) { avisos.add(t); return true; } }
    static final class Cola {
        final List<Runnable> despues = new ArrayList<>();
        boolean post(Runnable r) { r.run(); return true; }
        boolean postDelayed(Runnable r, long ms) { despues.add(r); return true; }
        void correr() { List<Runnable> l = new ArrayList<>(despues); despues.clear(); for (Runnable r : l) r.run(); }
    }
}
