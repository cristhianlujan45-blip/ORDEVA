package co.vento.app;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Lectura de los avisos de PLATA RECIBIDA de los bancos y billeteras (DaviPlata, Nequi, Bancolombia…), sin nada de
 * Android: así se prueba sola (pruebas/java/AvisoPagoPrueba.java) y es la misma regla que usa la página (pgLeer).
 *  • esRecibido: ¿es plata que ENTRA? («Recibiste», «Te llegó», «Le llegó plata», «Le pasaron», «Recibió»…). Nunca toma
 *    códigos, claves ni plata que SALE.
 *  • monto: el valor del aviso («$20.000», «$200,00», «$ 1.500.000», «25.000 pesos»).
 *  • frase: lo que se dice en voz alta: «Pago confirmado. 200 pesos desde DaviPlata.»
 */
public final class AvisoPago {
    private AvisoPago() { }

    static final Pattern BANCO = Pattern.compile("daviplata|nequi|bancolombia|davivienda|movii|\\bdale\\b|bre-?b|banco|\\bnu\\b|lulo|rappipay|powwi|ual[aá]|bbva|scotiabank|av villas|colpatria|occidente|caja social", Pattern.CASE_INSENSITIVE);
    // DaviPlata escribe de «usted»: «Le llegó plata», «Le pasaron»; Nequi de «tú»: «Te llegó plata».
    static final Pattern RECIBIDO = Pattern.compile("recibiste|has recibido|ha recibido|(te|le) lleg[oó]|(te|le) llegaron|(te|le) pas[oó]|(te|le) pasaron|pasaron plata|(te|le) envi[oó]|(te|le) enviaron|(te|le) transfiri|(te|le) pag[oó]|(te|le) pagaron|(te|le) consign|(te|le) abon|consignaron|abonaron|entr[oó] plata|lleg[oó] plata|ingres[oó]|recibi[oó]|recepci[oó]n|pago recibido|dinero recibido|transferencia recibida|abono a (tu|su) cuenta", Pattern.CASE_INSENSITIVE);
    static final Pattern PRIVADO = Pattern.compile("c[oó]digo|clave|otp|contrase|token|enviaste|pagaste|transferiste|retiraste|compraste|sacaste|usted (envi|pag|transfiri|pas)", Pattern.CASE_INSENSITIVE);
    static final Pattern SEGURO = Pattern.compile("recibiste|recibi[oó]|ha recibido|(te|le) lleg", Pattern.CASE_INSENSITIVE);
    private static final Pattern PESOS = Pattern.compile("\\$\\s?(\\d{1,3}(?:[.,]\\d{3})+|\\d+)");
    private static final Pattern PESOS2 = Pattern.compile("(\\d{1,3}(?:[.,]\\d{3})+|\\d{4,})\\s*(?:pesos|cop)\\b", Pattern.CASE_INSENSITIVE);

    static boolean esBanco(String app) { return app != null && BANCO.matcher(app).find(); }

    static boolean esRecibido(String todo) {
        if (todo == null || !RECIBIDO.matcher(todo).find()) return false;
        return !PRIVADO.matcher(todo).find() || SEGURO.matcher(todo).find();
    }

    /** El valor del aviso en pesos (0 si no se entiende). «$20.000,00» → 20000; «$200,00» → 200. */
    static long monto(String todo) {
        if (todo == null) return 0;
        Matcher m = PESOS.matcher(todo);
        if (!m.find()) { m = PESOS2.matcher(todo); if (!m.find()) return 0; }
        try { return Long.parseLong(m.group(1).replaceAll("[.,]", "")); } catch (Exception e) { return 0; }
    }

    /** Nombre de la app como se dice: «DaviPlata», «Nequi», «Bancolombia»… */
    static String nombreApp(String app) {
        String a = app == null ? "" : app.trim(), b = a.toLowerCase();
        if (b.contains("daviplata")) return "DaviPlata";
        if (b.contains("nequi")) return "Nequi";
        if (b.contains("bancolombia")) return "Bancolombia";
        if (b.contains("davivienda")) return "Davivienda";
        return a.isEmpty() ? "el banco" : a;
    }

    /** «Pago confirmado. 200 pesos desde DaviPlata.» */
    static String frase(String app, long monto) {
        return "Pago confirmado. " + monto + " pesos desde " + nombreApp(app) + ".";
    }

    /** «$20.000» para mostrar. */
    static String plata(long monto) {
        String s = Long.toString(monto), out = "";
        for (int i = s.length(); i > 0; i -= 3) out = s.substring(Math.max(0, i - 3), i) + (out.isEmpty() ? "" : "." + out);
        return "$" + out;
    }
}
