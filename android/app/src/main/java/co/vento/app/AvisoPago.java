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
    // Publicidad del banco que se parece a un pago («¿Te llegó la prima? Guárdala en un colchón», «Te prestamos hasta
    // $5.000.000»): NO es plata que llegó. Los avisos de pago de verdad no preguntan ni ofrecen nada.
    static final Pattern PROMO = Pattern.compile("¿|pr[eé]stamo|te prestamos|le prestamos|cr[eé]dito (de libre|pre|para|f[aá]cil|aprobado|express|r[aá]pido)|tarjeta de cr[eé]dito|colch[oó]n|oferta|promo|descuento|cashback|sorteo|particip|\\bgan(a|e|ar)\\b|aprovecha|beneficio|invit|hasta \\$|\\bcupo\\b|activa tu|desc[aá]rga", Pattern.CASE_INSENSITIVE);
    private static final Pattern PESOS = Pattern.compile("(?:\\$|\\bCOP)\\s?(\\d{1,3}(?:[.,]\\d{3})+|\\d+)", Pattern.CASE_INSENSITIVE);
    private static final Pattern PESOS2 = Pattern.compile("(\\d{1,3}(?:[.,]\\d{3})+|\\d{4,})\\s*(?:pesos|cop)\\b", Pattern.CASE_INSENSITIVE);

    static boolean esBanco(String app) { return app != null && BANCO.matcher(app).find(); }

    static boolean esRecibido(String todo) {
        if (todo == null || !RECIBIDO.matcher(todo).find() || PROMO.matcher(todo).find()) return false;
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

    /** Las apps OFICIALES de los bancos (nombre del paquete en Play Store). Una app que se llame «DaviPlata» pero no sea
     *  la oficial (instalada por fuera de la tienda) podría mostrar avisos de pago falsos. */
    static final String[][] OFICIALES = {
            {"com.davivienda.daviplataapp", "DaviPlata"}, {"com.nequi.MobileApp", "Nequi"}, {"com.todo1.mobile", "Bancolombia"},
            {"com.davivienda.daviviendaapp", "Davivienda"},
    };
    static final String[] TIENDAS = {"com.android.vending", "com.sec.android.app.samsungapps", "com.huawei.appmarket", "com.xiaomi.market",
            "com.xiaomi.mipicks", "com.heytap.market", "com.oppo.market", "com.bbk.appstore", "com.vivo.appstore", "com.google.android.packageinstaller.store"};

    static boolean paqueteOficial(String pkg) {
        if (pkg == null) return false;
        for (String[] o : OFICIALES) if (o[0].equalsIgnoreCase(pkg)) return true;
        return false;
    }

    static boolean deTienda(String instalador) {
        if (instalador == null) return false;
        for (String t : TIENDAS) if (t.equals(instalador)) return true;
        return false;
    }

    /** ¿Se puede confiar en el aviso? Si es la app oficial del banco, o una app de banco instalada desde la tienda
     *  (Play Store, Galaxy Store…) o que viene con el celular. */
    static boolean confiable(String pkg, String instalador, boolean delSistema) {
        return paqueteOficial(pkg) || deTienda(instalador) || delSistema;
    }

    /** Volumen del aviso de pagos (10 a 150 %): hasta 100 % es qué tan alto suena el celular; más de 100 % suena al
     *  máximo y además se refuerza (más fuerte de lo normal). */
    static int volumen(int v) { return v <= 0 ? 100 : Math.max(10, Math.min(150, v)); }

    /** Refuerzo en milibelios por encima del 100 % (150 % → +12 dB). */
    static int refuerzo(int v) { v = volumen(v); return v <= 100 ? 0 : (v - 100) * 24; }

    /** Nivel del volumen del celular para ese porcentaje (1 a máx). */
    static int nivel(int v, int max) { v = volumen(v); return Math.max(1, Math.min(max, Math.round(max * Math.min(100, v) / 100f))); }

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
