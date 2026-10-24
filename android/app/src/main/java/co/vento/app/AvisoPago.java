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

    static final Pattern BANCO = Pattern.compile("daviplata|nequi|bancolombia|davivienda|movii|\\bdale\\b|bre-?b|banco|\\bnu\\b|lulo|rappipay|powwi|ual[aá]|bbva|scotiabank|av villas|colpatria|occidente|caja social"
            + "|ita[uú]|popular|bogot[aá]|pibank|coltefinanciera|bancam[ií]a|mibanco|falabella|finandina|serfinanza|confiar|global66|ban100|coomeva|cooperativa|tpaga|transfiya|\\bbold\\b|agrario|gnb|sudameris", Pattern.CASE_INSENSITIVE);
    // DaviPlata escribe de «usted»: «Le llegó plata», «Le pasaron»; Nequi de «tú»: «Te llegó plata».
    // También las transferencias de OTROS bancos por la llave Bre-B («Llegaron $50.000 a tu llave», «Recibiste $X por Bre-B»,
    // «Te mandaron», «Te giraron», «Se acreditó en tu cuenta»).
    static final Pattern RECIBIDO = Pattern.compile("recibiste|has recibido|ha recibido|(te|le) lleg[oó]|(te|le) llegaron|(te|le) pas[oó]|(te|le) pasaron|pasaron plata|(te|le) envi[oó]|(te|le) enviaron|(te|le) transfiri|(te|le) pag[oó]|(te|le) pagaron|(te|le) consign|(te|le) abon|consignaron|abonaron|entr[oó] (plata|dinero)|lleg[oó] (plata|dinero)|ingres[oó]|recibi[oó]|recepci[oó]n|pago recibido|dinero recibido|transferencia recibida|abono a (tu|su) cuenta"
            + "|(te|le) mand(o|ó|aron)|(te|le) gir(o|ó|aron)|(te|le) deposit|dep[oó]sito recibido|(te|le|se) acredit|acredit\\w*\\s+(a|en)\\s+(tu|su)\\s+(cuenta|llave|nequi|daviplata)"
            + "|lleg(o|ó|aron)\\s+(\\$|cop|plata|dinero)|a (tu|su) llave|(recib|lleg|entr|ingres)[^.]{0,40}bre-?b|bre-?b[^.]{0,40}(recib|lleg|entr|ingres)"
            // Más formas de los bancos para la plata que entra (transferencias por llave Bre-B y de otros bancos)
            + "|movimiento recibido|\\+\\s?\\$\\s?\\d"   // «Movimiento recibido +$15.000» (1.43.7)
            + "|transferencia entrante|abono recibido|abono (por|de|bre-?b)\\s|ingreso de (\\$|cop|dinero|plata)|ingresaron|entrada de (dinero|plata)|recibiste un (pago|abono)|lleg[oó] una transferencia|(en|a) (tu|su) llave"
            // Plata desde OTRO banco por la llave (1.41.2): «Te enviaron dinero desde otra entidad», «Transferencia
            // interbancaria recibida», «Tienes un nuevo abono», «Nuevo ingreso por Bre-B».
            + "|(dinero|plata|transferencia|abono|pago)\\s+(de|desde)\\s+otr[oa]s?\\s+(entidad|banco)|interbancari\\w*\\s+recibid|(tienes|tiene)\\s+(un\\s+)?(nuevo\\s+)?(abono|ingreso|dep[oó]sito)|nuevo\\s+(abono|ingreso)", Pattern.CASE_INSENSITIVE);
    static final Pattern PRIVADO = Pattern.compile("c[oó]digo|clave|otp|contrase|token|enviaste|pagaste|pasaste|transferiste|retiraste|compraste|sacaste|compra exitosa|usted (envi|pag|transfiri|pas)", Pattern.CASE_INSENSITIVE);
    static final Pattern SEGURO = Pattern.compile("recibiste|recibi[oó]|ha recibido|(te|le) lleg", Pattern.CASE_INSENSITIVE);
    // Nunca es plata que llegó, diga lo que diga: solicitudes y cobros («JUAN te pidió $20.000», «Recibiste una solicitud»),
    // pagos rechazados, fallidos, reversados o programados.
    static final Pattern NUNCA = Pattern.compile("solicitud|(te|le) pide|(te|le) pidi[oó]|(te|le) cobr|cobro pendiente|rechazad|fall[oó]|no se pudo|reversad|programad", Pattern.CASE_INSENSITIVE);
    // Frases que solo trae un pago de verdad: con ellas un «¿…?» o un «bolsillo» en el mismo aviso no lo vuelven publicidad
    // (antes un «¿La guardas en un bolsillo?» en el aviso de Nequi hacía que el pago no sonara).
    static final Pattern FUERTE = Pattern.compile("(te|le) (envi[oó]|enviaron|pas[oó]|pasaron|transfiri[oó]|transfirieron|consign[oó]|consignaron|mand[oó]|mandaron|gir[oó]|giraron|pag[oó]|pagaron)(?![a-záéíóúñ])|(recibiste|recibi[oó]|ha recibido|has recibido)\\s+(\\$|cop|\\d|una transferencia|un pago|dinero|plata)|transferencia recibida|pago recibido|a (tu|su) llave|(te|le) lleg[oó]\\s+(\\$|cop|\\d|plata|dinero)", Pattern.CASE_INSENSITIVE);
    // Publicidad del banco que se parece a un pago («¿Te llegó la prima? Guárdala en un colchón», «Te prestamos hasta
    // $5.000.000»): NO es plata que llegó. Los avisos de pago de verdad no preguntan ni ofrecen nada.
    static final Pattern PROMO = Pattern.compile("¿|pr[eé]stamo|te prestamos|le prestamos|cr[eé]dito (de libre|pre|para|f[aá]cil|aprobado|express|r[aá]pido)|tarjeta de cr[eé]dito|colch[oó]n|oferta|promo|descuento|cashback|sorteo|particip|\\bgan(a|e|ar)\\b|aprovecha|beneficio|invit|hasta \\$|\\bcupo\\b|activa tu|desc[aá]rga", Pattern.CASE_INSENSITIVE);
    // 1.43.7: también con espacios entre los miles («$ 50 000», como lo escriben algunas apps): antes daba «50».
    private static final Pattern PESOS = Pattern.compile("(?:\\$|\\bCOP)\\s?(\\d{1,3}(?:[.,]\\d{3})+|\\d{1,3}(?:[ \\u00a0\\u202f]\\d{3})+(?![\\d.,])|\\d+)", Pattern.CASE_INSENSITIVE);
    private static final Pattern PESOS2 = Pattern.compile("(\\d{1,3}(?:[.,]\\d{3})+|\\d+)\\s*(?:pesos|cop)\\b", Pattern.CASE_INSENSITIVE);
    // Sin signo: el SMS de DaviPlata (85888) dice «recibiste 100,000 en tu DaviPlata» o «Recibiste 140,000. Para saber mas…».
    private static final Pattern PESOS3 = Pattern.compile("\\b(?:recibiste|recibi[oó]|has recibido|ha recibido|te llegaron|le llegaron|llegaron|abono de|ingreso de|por|de"
            // Nequi también escribe el valor sin $: «MARIBE ARIAS te envió 1500, ¡lo mejor!» (1.41.3)
            + "|(?:te|le)\\s+(?:envi[oó]|enviaron|pas[oó]|pasaron|mand[oó]|mandaron|transfiri[oó]|transfirieron|consign[oó]|consignaron|gir[oó]|giraron|pag[oó]|pagaron))\\s+(\\d{1,3}(?:[.,]\\d{3})+(?![.,]?\\d)|\\d{1,7}(?!\\d|[.,]\\d))(?!\\s*(?:%|min|seg|horas?|d[ií]as?|veces))", Pattern.CASE_INSENSITIVE);

    static boolean esBanco(String app) { return app != null && BANCO.matcher(app).find(); }

    // Plata que llega como RECARGA desde un banco (1.55.1): una transferencia de Bancolombia (u otro banco) a Nequi sale en
    // Nequi como «Recarga desde Bancolombia» y antes no se avisaba. Nunca la recarga de un celular (minutos, datos,
    // operador, a un número), una recarga fallida o pendiente, ni la publicidad «Recarga tu Nequi…».
    static final Pattern RECARGA = Pattern.compile("recarga(?:ste)?\\b[^|\\n]{0,60}?\\b(?:(?:desde|de|por|con)\\s+(?:tu\\s+|su\\s+)?(?:cuenta\\s+(?:de\\s+)?)?)?"
            + "(?:bancolombia|davivienda|daviplata|bbva|scotiabank|colpatria|av villas|ita[uú]|banco\\s+(?:de\\s+)?\\w+|pse|otr[oa]s?\\s+(?:entidad|banco))\\b"
            + "|recibiste\\s+una\\s+recarga|(?:te|le)\\s+recargaron"
            // 1.62.1: sin el nombre del banco («Recarga exitosa por $9.000», «Recargamos $9.000 a tu Nequi», «Tu Nequi fue recargado»)
            + "|\\brecarga\\s+(?:exitosa|realizada|recibida|aprobada|confirmada)\\b|\\brecargaste\\s+(?:\\$|cop)\\s?\\d|\\brecarg(?:amos|ado|ada|[oó]|aron)(?![a-zñ])[^|\\n]{0,40}?(?:\\$|cop)\\s?\\d|(?:nequi|cuenta|daviplata)\\s+(?:fue|ha sido|se)\\s+recarg|\\brecarg[oó]\\s+(?:tu|su)\\s+(?:nequi|cuenta|daviplata)", Pattern.CASE_INSENSITIVE);
    static final Pattern RECARGA_NO = Pattern.compile("\\brecarga\\s+(?:tu|su)\\b|celular|minutos|paquete|recarga(?:ste)?\\s+(?:de\\s+)?(?:datos|plan|m[oó]vil)\\b"
            + "|\\b(?:claro|tigo|movistar|wom|virgin|etb|avantel|kalley)\\b|(?:a|al|para)\\s+(?:el\\s+)?(?:n[uú]mero\\s+)?(?:\\+?57\\s?)?3\\d{2}\\s?\\d{3}\\s?\\d{4}"
            + "|fallid|no exitosa|pendiente|compraste|compra de|\\b(?:tullave|transmilenio|sitp|c[ií]vica|peaje|flypass)\\b", Pattern.CASE_INSENSITIVE);
    static boolean esRecarga(String todo) { return todo != null && RECARGA.matcher(todo).find() && !RECARGA_NO.matcher(todo).find(); }

    static boolean esRecibido(String todo) {
        if (todo == null || !(RECIBIDO.matcher(todo).find() || esRecarga(todo)) || NUNCA.matcher(todo).find() || CODIGO.matcher(todo).find()) return false;
        if (PROMO.matcher(todo).find() && !FUERTE.matcher(todo).find()) return false;
        // Un pago de verdad puede traer «nunca compartas tu clave» o «tu código de transacción»: con una frase fuerte de
        // plata recibida («te envió $…», «a tu llave») sigue siendo pago. Antes esos avisos se descartaban.
        return !PRIVADO.matcher(todo).find() || SEGURO.matcher(todo).find() || (FUERTE.matcher(todo).find() && !SALE.matcher(todo).find());
    }
    // Códigos de seguridad: nunca son un pago, digan lo que digan.
    // Solo los mensajes de un código para entrar (con el número del código): «Tu código de verificación es 123456». Un
    // pago que trae «código de aprobación 604107» o «nunca compartas tu clave» SÍ es pago.
    static final Pattern CODIGO = Pattern.compile("(c[oó]digo|clave)( de)? (seguridad|verificaci[oó]n|acceso|ingreso|otp|din[aá]mica)( es)?\\s*:?\\s*\\d{4,8}|clave din[aá]mica|\\botp\\b[^.]{0,20}\\d{4,8}|tu c[oó]digo es \\d|es tu c[oó]digo", Pattern.CASE_INSENSITIVE);
    // Plata que SALE (nunca es un pago recibido, aunque el aviso diga «te»).
    static final Pattern SALE = Pattern.compile("enviaste|pagaste|pasaste|compra exitosa|transferiste|retiraste|compraste|sacaste|usted (envi|pag|transfiri|pas)|c[oó]digo (de )?(seguridad|verificaci)|clave din[aá]mica|\\botp\\b", Pattern.CASE_INSENSITIVE);

    /** ¿El pago llegó por la llave Bre-B? (para decirlo: «… por Bre-B, en Nequi») */
    static boolean esBreB(String todo) { return todo != null && Pattern.compile("bre-?b|\\bllaves?\\b", Pattern.CASE_INSENSITIVE).matcher(todo).find(); }

    /** Aviso de plata que llegó pero SIN el valor («¡Te llegó plata! Entra a Nequi para verla»): igual se avisa. */
    static boolean esPlataSinValor(String todo) {
        return todo != null && monto(todo) <= 0 && esRecibido(todo)
                && Pattern.compile("(dinero|plata|transferencia|abono|pago)\\s+(de|desde)\\s+otr[oa]s?\\s+(entidad|banco)|interbancari\\w*\\s+recibid|(tienes|tiene)\\s+(un\\s+)?(nuevo\\s+)?(abono|ingreso|dep[oó]sito)|nuevo\\s+(abono|ingreso)|usando\\s+llaves?|(te|le) lleg[oó] (plata|dinero)|lleg[oó] (plata|dinero)|(lleg[oó]|recibiste|recibi[oó]) una transferencia|transferencia entrante|(te|le) (enviaron|pasaron|mandaron|transfirieron|consignaron) (plata|dinero)|recibiste (plata|dinero|una transferencia)|recibi[oó] (plata|dinero|una transferencia)|transferencia recibida|a (tu|su) llave", Pattern.CASE_INSENSITIVE).matcher(todo).find();
    }

    /** El valor del aviso en pesos (0 si no se entiende). «$20.000,00» → 20000; «$200,00» → 200. */
    static long monto(String todo) {
        if (todo == null) return 0;
        Matcher m = PESOS.matcher(todo);
        if (!m.find()) { m = PESOS2.matcher(todo); if (!m.find()) { m = PESOS3.matcher(todo); if (!m.find()) return 0; } }
        try { return Long.parseLong(m.group(1).replaceAll("[.,\\s\\u00a0\\u202f]", "")); } catch (Exception e) { return 0; }
    }

    /** Nombre de la app como se dice: «DaviPlata», «Nequi», «Bancolombia»… */
    static String nombreApp(String app) {
        String a = app == null ? "" : app.trim(), b = a.toLowerCase();
        if (b.contains("daviplata")) return "DaviPlata";
        if (b.contains("nequi")) return "Nequi";
        if (b.contains("bancolombia")) return "Bancolombia";
        if (b.contains("davivienda")) return "Davivienda";
        if (b.equals("banco")) return "el banco";
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

    /**
     * Voz de los pagos con volumen PAREJO de principio a fin (antes empezaba bajito y subía: el refuerzo era un
     * compresor que sube la ganancia de a poco, y la salida de audio tardaba en despertar):
     *  • un silencio corto al principio, para que el parlante o el Bluetooth ya estén despiertos en la primera palabra;
     *  • la frase se lleva siempre al mismo nivel (normalizada al pico) y, por encima de 100 %, con una ganancia FIJA
     *    a todo el audio y un tope suave (sin chasquidos).
     * Entra y sale un WAV PCM de 16 bits (lo que graba el motor de voz). Si no es ese formato devuelve null.
     */
    static byte[] vozPareja(byte[] wav, int volumenPct, int silencioMs) {
        if (wav == null || wav.length < 44 || !"RIFF".equals(ascii(wav, 0, 4)) || !"WAVE".equals(ascii(wav, 8, 4))) return null;
        int canales = 0, frecuencia = 0, bits = 0, formato = 0, ini = -1, largo = 0;
        for (int i = 12; i + 8 <= wav.length; ) {
            String id = ascii(wav, i, 4);
            int tam = le32(wav, i + 4);
            if (tam < 0) return null;
            if ("fmt ".equals(id) && i + 24 <= wav.length) {
                formato = le16(wav, i + 8); canales = le16(wav, i + 10); frecuencia = le32(wav, i + 12); bits = le16(wav, i + 22);
            } else if ("data".equals(id)) {
                ini = i + 8; largo = Math.min(tam, wav.length - ini); break;
            }
            i += 8 + tam + (tam & 1);
        }
        if (formato != 1 || bits != 16 || canales < 1 || canales > 2 || frecuencia < 8000 || frecuencia > 96000 || ini < 0) return null;
        int muestras = largo / 2;
        int pico = 1;
        for (int k = 0; k < muestras; k++) pico = Math.max(pico, Math.abs((short) le16(wav, ini + k * 2)));
        // Al mismo nivel siempre (92 % del máximo).
        final double TOPE = 0.92;
        double g = 32767.0 * TOPE / pico;
        double[] x = new double[muestras];
        for (int k = 0; k < muestras; k++) x[k] = (short) le16(wav, ini + k * 2) * g / 32767.0;
        // Arriba de 100 %: más fuerte y ESTABLE (1.49.0). La 1.43.4 usaba un nivelador que subía las sílabas bajitas y bajaba
        // antes de cada pico: la ganancia cambiaba sílaba por sílaba y el dueño lo oía «subir y bajar». Ahora la ganancia es
        // FIJA en toda la frase (hasta ×1,6 = +4 dB) y solo la punta de los picos se dobla suave (curva fija, sin memoria):
        // suena más duro, parejo de principio a fin y sin chasquidos (nunca pasa de 97 %).
        double gmax = Math.min(1.6, Math.pow(10, refuerzo(volumenPct) / 2000.0));
        if (gmax > 1.0001) {
            final double RODILLA = 0.6, TECHO = 0.97, ANCHO = TECHO - RODILLA;
            for (int k = 0; k < muestras; k++) {
                double y = x[k] * gmax, a = Math.abs(y);
                if (a > RODILLA) y = Math.signum(y) * (RODILLA + ANCHO * Math.tanh((a - RODILLA) / ANCHO));
                x[k] = y;
            }
        }
        int sil = Math.max(0, Math.min(2000, silencioMs)) * frecuencia / 1000 * canales;
        byte[] out = new byte[44 + (sil + muestras) * 2];
        cabecera(out, canales, frecuencia, (sil + muestras) * 2);
        for (int k = 0; k < muestras; k++) {
            int v = (int) Math.round(Math.max(-1.0, Math.min(1.0, x[k])) * 32767.0);
            int o = 44 + (sil + k) * 2;
            out[o] = (byte) v; out[o + 1] = (byte) (v >> 8);
        }
        return out;
    }

    private static String ascii(byte[] b, int i, int n) { return i + n <= b.length ? new String(b, i, n, java.nio.charset.StandardCharsets.US_ASCII) : ""; }
    private static int le16(byte[] b, int i) { return (b[i] & 0xff) | ((b[i + 1] & 0xff) << 8); }
    private static int le32(byte[] b, int i) { return (b[i] & 0xff) | ((b[i + 1] & 0xff) << 8) | ((b[i + 2] & 0xff) << 16) | ((b[i + 3] & 0xff) << 24); }
    private static void pon32(byte[] b, int i, int v) { b[i] = (byte) v; b[i + 1] = (byte) (v >> 8); b[i + 2] = (byte) (v >> 16); b[i + 3] = (byte) (v >> 24); }
    private static void cabecera(byte[] b, int canales, int frecuencia, int datos) {
        byte[] t = "RIFF....WAVEfmt ".getBytes(java.nio.charset.StandardCharsets.US_ASCII);
        System.arraycopy(t, 0, b, 0, 16);
        pon32(b, 4, 36 + datos); pon32(b, 16, 16);
        b[20] = 1; b[21] = 0; b[22] = (byte) canales; b[23] = 0;
        pon32(b, 24, frecuencia); pon32(b, 28, frecuencia * canales * 2);
        b[32] = (byte) (canales * 2); b[33] = 0; b[34] = 16; b[35] = 0;
        System.arraycopy("data".getBytes(java.nio.charset.StandardCharsets.US_ASCII), 0, b, 36, 4);
        pon32(b, 40, datos);
    }

    /** Nivel del volumen del celular para ese porcentaje (1 a máx). */
    static int nivel(int v, int max) { v = volumen(v); return Math.max(1, Math.min(max, Math.round(max * Math.min(100, v) / 100f))); }

    // ---------- SMS del banco ----------
    // Hay bancos que avisan la plata recibida por mensaje de texto (SMS) y no por su app. Vento lee el aviso que la app
    // de mensajes muestra (con el mismo permiso «Acceso a notificaciones»; no lee la bandeja de SMS) y SOLO si es de
    // plata recibida y nombra un banco. Un SMS lo puede mandar cualquiera: desde un celular común es FALSO; desde el código
    // corto del banco se dice «revísalo», salvo que el dueño elija confirmarlos (Ajustes → Pagos).
    static final String[] APPS_SMS = {"com.google.android.apps.messaging", "com.samsung.android.messaging", "com.android.mms",
            "com.android.messaging", "com.miui.mms", "com.xiaomi.mms", "com.oneplus.mms", "com.motorola.messaging", "com.textra",
            "com.coloros.mms", "com.oplus.mms", "com.huawei.message", "com.hihonor.mms", "com.sonyericsson.conversations",
            "com.lge.message", "com.asus.message", "com.transsion.message", "com.android.mms.service"};

    static boolean esAppSms(String pkg, String smsPorDefecto) {
        if (pkg == null) return false;
        if (pkg.equals(smsPorDefecto)) return true;
        for (String a : APPS_SMS) if (a.equals(pkg)) return true;
        return false;
    }

    /** ¿El SMS habla de plata que llegó y nombra un banco o billetera? */
    static boolean esSmsDePago(String remitente, String cuerpo) {
        String todo = (remitente == null ? "" : remitente) + " " + (cuerpo == null ? "" : cuerpo);
        return esRecibido(todo) && (BANCO.matcher(todo).find() || bancoDeCodigo(remitente) != null) && monto(todo) > 0;
    }

    /** Códigos cortos de los bancos que avisan por SMS (el SMS a veces no dice el nombre del banco). */
    static final String[][] CODIGOS = { {"85888", "DaviPlata"} };
    static String bancoDeCodigo(String remitente) {
        String d = remitente == null ? "" : remitente.replaceAll("\\D", "");
        if (d.isEmpty() || d.length() > 6) return null;
        for (String[] c : CODIGOS) if (c[0].equals(d)) return c[1];
        return null;
    }

    /** Remitente: «celular» (7 o más dígitos: los bancos no escriben desde celulares → falso), «corto» (código del banco). */
    static String tipoRemitente(String remitente) {
        String d = remitente == null ? "" : remitente.replaceAll("\\D", "");
        if (d.length() >= 7) return "celular";
        return "corto";
    }

    static String fraseSms(String cuerpo, long monto, String tipo, boolean confiar) { return fraseSms(null, cuerpo, monto, tipo, confiar); }
    static String fraseSms(String remitente, String cuerpo, long monto, String tipo, boolean confiar) {
        String b0 = bancoDe(cuerpo); if (b0.isEmpty() && bancoDeCodigo(remitente) != null) b0 = bancoDeCodigo(remitente);
        String banco = nombreApp(b0);
        if ("celular".equals(tipo)) return "Ojo. Llegó un mensaje de pago sospechoso por " + monto + " pesos desde un número de celular. Parece falso. No entregues nada.";
        if (confiar) return "Llegaron " + monto + " pesos por " + banco + ", por mensaje de texto.";
        return "Llegó un mensaje de texto de " + monto + " pesos desde " + banco + ". Revísalo en la aplicación del banco antes de entregar.";
    }

    /** El banco que nombra el texto («DaviPlata», «Nequi»…) o «el banco». */
    static String bancoDe(String txt) {
        if (txt == null) return "";
        Matcher m = BANCO.matcher(txt);
        return m.find() ? m.group() : "";
    }

    /** «Llegó plata por Nequi. Mira el valor en la aplicación.» (el aviso no traía el valor) */
    static String fraseSinValor(String app) {
        return "Llegó plata por " + nombreApp(app) + ". Mira el valor en la aplicación.";
    }

    /** «Llegaron 200 pesos por DaviPlata.» (1.49.0: el dueño pidió «llegaron tanto»: la cantidad siempre, sin el nombre). */
    static String frase(String app, long monto) {
        return "Llegaron " + monto + " pesos por " + nombreApp(app) + ".";
    }

    /** Velocidad de la voz de los pagos: más pausada que la normal (1.43.4: «que se demore más diciendo el precio»). */
    static final float VELOCIDAD = 0.85f;

    /** La frase con pausas cortas para que se entienda: «Recibiste, 20000 pesos, por Nequi.» (lo que se muestra no cambia). */
    static String pausado(String f) {
        if (f == null) return "";
        return f.replaceFirst("^(Recibiste|Llegó plata|Ojo\\.)\\s+(?!,)", "$1, ")
                .replaceAll("(\\d+ pesos)\\s+(?=(por|de|desde|en)\\b)", "$1, ");
    }

    /** Con el texto del aviso: si llegó por la llave Bre-B lo dice («Pago confirmado. 20000 pesos por Bre-B, en Nequi.»). */
    static String frase(String app, long monto, String texto) {
        return esBreB(texto) ? "Llegaron " + monto + " pesos por Bre-B, en " + nombreApp(app) + "." : frase(app, monto);
    }

    /** ¿Vale la pena guardarlo para revisar? Aviso de una app de banco que habla de plata pero que Vento NO tomó como pago. */
    static boolean pareceDePlata(String todo) {
        return todo != null && Pattern.compile("\\$\\s?\\d|\\bcop\\b|\\d\\s*pesos", Pattern.CASE_INSENSITIVE).matcher(todo).find()
                && Pattern.compile("recib|lleg|transfer|bre-?b|llave|abon|ingres|acredit|envi|pas[oó]|consign|deposit|pago|recarg", Pattern.CASE_INSENSITIVE).matcher(todo).find();
    }

    /**
     * ¿Se le pasa a la página un aviso de banco que estas reglas NO tomaron como pago? Sí, si habla de plata o de plata
     * recibida (la página siempre está al día y puede entender un formato nuevo sin reinstalar la app). Nunca los códigos
     * de seguridad ni la plata que sale.
     */
    static boolean sirveCrudo(String todo) {
        if (todo == null || todo.trim().isEmpty() || CODIGO.matcher(todo).find() || SALE.matcher(todo).find()) return false;
        if (Pattern.compile("c[oó]digo|clave|contrase|token", Pattern.CASE_INSENSITIVE).matcher(todo).find() && !FUERTE.matcher(todo).find()) return false;
        return pareceDePlata(todo) || RECIBIDO.matcher(todo).find()
                // «8,000» sin signo (como escriben los SMS de DaviPlata) junto a una palabra de plata
                || Pattern.compile("\\d{1,3}(?:[.,]\\d{3})+", Pattern.CASE_INSENSITIVE).matcher(todo).find()
                   && Pattern.compile("recib|lleg|abon|transfer|ingres|acredit|plata|dinero|bre-?b|llave", Pattern.CASE_INSENSITIVE).matcher(todo).find();
    }

    /** ¿El remitente del SMS es un banco? (código corto de 3 a 6 cifras, o el nombre de un banco). Nunca un contacto. */
    static boolean remitenteBanco(String remitente) {
        String r = remitente == null ? "" : remitente.trim();
        return r.matches("\\+?\\d{3,6}") || BANCO.matcher(r).find();
    }

    /** Por qué un aviso NO se tomó como plata recibida (para el registro de Ajustes → Pagos). */
    static String porQueNo(String t) {
        if (t == null || t.trim().isEmpty()) return "aviso vacío";
        if (SALE.matcher(t).find()) return "plata que SALE (pasaste, enviaste, compra…)";
        if (CODIGO.matcher(t).find()) return "código de seguridad";
        if (NUNCA.matcher(t).find()) return "solicitud, rechazado o programado";
        if (RECARGA.matcher(t).find() && RECARGA_NO.matcher(t).find()) return "recarga de celular o que no se hizo";
        if (!RECIBIDO.matcher(t).find() && !esRecarga(t)) return "no dice que llegó plata";
        if (PROMO.matcher(t).find() && !FUERTE.matcher(t).find()) return "parece publicidad del banco";
        if (PRIVADO.matcher(t).find()) return "mensaje privado (clave o código)";
        if (monto(t) <= 0) return "sin el valor";
        return "no se tomó";
    }

    /** El aviso sin nombres ni números (para revisarlo sin datos de nadie). */
    static String sinDatos(String t) {
        if (t == null) return "";
        String x = t.replaceAll("\\b[A-ZÁÉÍÓÚÑ]{2,}(\\s+[A-ZÁÉÍÓÚÑ]{2,})*\\b", "NOMBRE").replaceAll("\\d[\\d.,]*", "#").replaceAll("@\\S+", "@llave");
        return x.length() > 220 ? x.substring(0, 220) : x;
    }

    /** «$20.000» para mostrar. */
    static String plata(long monto) {
        String s = Long.toString(monto), out = "";
        for (int i = s.length(); i > 0; i -= 3) out = s.substring(Math.max(0, i - 3), i) + (out.isEmpty() ? "" : "." + out);
        return "$" + out;
    }
}
