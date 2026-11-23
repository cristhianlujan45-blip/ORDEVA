// Simulación de la lectura de avisos de la app Android (VentoEscucha) SIN celular, con los avisos REALES del dueño
// (capturas del 15-oct-2026): SMS del 85888 de DaviPlata sin «$», la conversación con los mensajes viejos, la llave
// Bre-B sin valor, Nequi y «Pasaste» (plata que sale). Corre el MISMO código de VentoEscucha y AvisoPago; solo cambia
// VentoApp (pruebas/java/simulado: anota lo que se diría en voz alta).
//   ver pruebas/correr-java.sh
package co.vento.app;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;

public class EscuchaPrueba {
    static int ok = 0, mal = 0;
    static void chk(String n, boolean c, Object x) { if (c) { ok++; System.out.println("✅ " + n); } else { mal++; System.out.println("❌ " + n + " → " + x); } }
    static Method procesar, procesarSms;
    static boolean app(Preferencias sp, String app, String titulo, String cuerpo, String pref) throws Exception {
        return VentoEscucha.procesarApp(sp, app, titulo, cuerpo, pref, true, false);
    }
    static List<Object[]> conv(Object[]... m) { List<Object[]> l = new ArrayList<>(); for (Object[] x : m) l.add(x); return l; }
    static void limpiar() { VentoApp.dichos.clear(); VentoApp.avisos.clear(); VentoApp.notifs.clear(); VentoApp.ui.despues.clear(); }
    static Preferencias nuevo() { limpiar(); return new Preferencias(); }   // cada caso, como un pago aparte

    public static void main(String[] a) throws Exception {
        procesar = VentoEscucha.class.getDeclaredMethod("procesar", android.content.SharedPreferences.class, String.class, String.class, String.class, String.class, boolean.class, boolean.class);
        procesarSms = VentoEscucha.class.getDeclaredMethod("procesarSms", android.content.SharedPreferences.class, String.class, String.class, String.class, boolean.class);
        procesar.setAccessible(true); procesarSms.setAccessible(true);
        Preferencias sp = new Preferencias();
        long ahora = System.currentTimeMillis(), min = 60_000L;

        // 1) SMS del 85888: «Recibiste 200.» (sin $ y sin decir DaviPlata) → «Llegaron 200 pesos por DaviPlata.»
        limpiar();
        boolean r = VentoEscucha.leerSms(sp, "85888", "Recibiste  200. Para saber mas, consulta tus movimientos.",
                conv(new Object[]{"Recibiste  200. Para saber mas, consulta tus movimientos.", ahora - 2000}), "k1:", false);
        VentoApp.ui.correr();
        chk("SMS 85888 «Recibiste 200.» → suena «Llegaron 200 pesos por DaviPlata.»", r && VentoApp.dichos.contains("Llegaron 200 pesos por DaviPlata."), VentoApp.dichos);
        chk("…y sale la notificación «💜 Recibiste $200 por DaviPlata» con el texto «Llegaron 200 pesos por DaviPlata.» y el SMS", VentoApp.notifs.stream().anyMatch(n -> n[0].equals("💜 Recibiste $200 por DaviPlata") && n[1].equals("Llegaron 200 pesos por DaviPlata.") && n[2].contains("Recibiste  200")), VentoApp.notifs.size());

        // 2) La conversación trae los mensajes VIEJOS (65,000 · 100 · 1,000 de hace 40 min) y uno nuevo (20,000): solo suena el nuevo
        limpiar();
        r = VentoEscucha.leerSms(sp, "85888", "DaviPlata: recibiste  20,000 en tu DaviPlata. Usalos de forma segura para pagar, comprar y mucho mas!",
                conv(new Object[]{"Recibiste  65,000. Para saber mas, consulta tus movimientos.", ahora - 40 * min},
                     new Object[]{"Recibiste  100. Para saber mas, consulta tus movimientos.", ahora - 40 * min},
                     new Object[]{"Recibiste  1,000. Para saber mas, consulta tus movimientos.", ahora - 40 * min},
                     new Object[]{"DaviPlata: recibiste  20,000 en tu DaviPlata. Usalos de forma segura para pagar, comprar y mucho mas! Conoce todo lo que puedes hacer en www.daviplata.com", ahora - 3000}), "k2:", false);
        VentoApp.ui.correr();
        chk("Conversación con mensajes viejos: solo suena el NUEVO ($20.000), una vez", r && VentoApp.dichos.size() == 1 && VentoApp.dichos.get(0).equals("Llegaron 20000 pesos por DaviPlata."), VentoApp.dichos);

        // 3) El mismo SMS otra vez (la app de mensajes vuelve a publicar la conversación): no se repite
        limpiar();
        VentoEscucha.leerSms(sp, "85888", "x", conv(new Object[]{"DaviPlata: recibiste  20,000 en tu DaviPlata. Usalos de forma segura para pagar, comprar y mucho mas! Conoce todo lo que puedes hacer en www.daviplata.com", ahora - 3000}), "k3:", false);
        VentoApp.ui.correr();
        chk("El mismo SMS publicado otra vez no vuelve a sonar", VentoApp.dichos.isEmpty(), VentoApp.dichos);

        // 4) Dos pagos IGUALES seguidos (dos mensajes «Recibiste 1,000.» a distinta hora): suenan los dos
        limpiar();
        VentoEscucha.leerSms(sp, "85888", "", conv(new Object[]{"Recibiste  1,000. Para saber mas, consulta tus movimientos.", ahora - 60_000},
                                                  new Object[]{"Recibiste  1,000. Para saber mas, consulta tus movimientos.", ahora - 5_000}), "k4:", false);
        VentoApp.ui.correr();
        chk("Dos pagos iguales seguidos ($1.000 y $1.000): suenan los dos", VentoApp.dichos.size() == 2 && VentoApp.dichos.stream().allMatch(x -> x.equals("Llegaron 1000 pesos por DaviPlata.")), VentoApp.dichos);

        // 5) Llave Bre-B: la app de DaviPlata avisa SIN valor y luego llega el SMS con el valor → una sola voz con el valor
        Preferencias sp0 = sp; sp = nuevo();
        app(sp, "DaviPlata", "DaviPlata", "Transaccion exitosa: Recibiste Plata de otra entidad usando Llaves, consulta el detalle de tus movimientos desde el app DaviPlata.", "k5:");
        chk("Llave Bre-B sin valor: suena DE UNA «Llegó plata por Bre-B, en DaviPlata.» (sin esperar: con la pantalla apagada la espera se dormía)", VentoApp.dichos.equals(java.util.Arrays.asList("Llegó plata por Bre-B, en DaviPlata.")) && VentoApp.ui.despues.isEmpty(), VentoApp.dichos);
        VentoEscucha.leerSms(sp, "85888", "", conv(new Object[]{"Recibiste  65,000. Para saber mas, consulta tus movimientos.", ahora - 1000}), "k5b:", false);
        chk("…llega el SMS: suena de una «Llegaron 65000 pesos por Bre-B, en DaviPlata.»", VentoApp.dichos.size() == 2 && VentoApp.dichos.get(1).equals("Llegaron 65000 pesos por Bre-B, en DaviPlata.") && VentoApp.ui.despues.isEmpty(), VentoApp.dichos);
        chk("…y la ventana dice «$65.000» por «Bre-B en DaviPlata»", VentoApp.notifs.stream().anyMatch(n -> n[3].equals("$65.000") && n[4].equals("Bre-B en DaviPlata")), VentoApp.notifs.size());

        // 6) Llave Bre-B sin valor y SIN SMS: a los pocos segundos avisa sin el valor
        sp = nuevo();
        app(sp, "DaviPlata", "DaviPlata", "Transaccion exitosa: Recibiste Plata de otra entidad usando Llaves, consulta el detalle de tus movimientos desde el app DaviPlata.", "k6:");
        chk("Llave Bre-B sin SMS: suena de una «Llegó plata por Bre-B, en DaviPlata.»", VentoApp.dichos.contains("Llegó plata por Bre-B, en DaviPlata."), VentoApp.dichos);
        chk("…y su notificación y ventana «💜 Llegó plata por Bre-B en DaviPlata» (sin valor)", VentoApp.notifs.stream().anyMatch(n -> n[0].equals("💜 Llegó plata por Bre-B en DaviPlata") && n[3].isEmpty() && n[5].equals("sinvalor")), VentoApp.notifs.size());

        // 6b) Primero el SMS y después (segundos) el aviso de la llave: una sola voz con el valor
        sp = nuevo();
        VentoEscucha.leerSms(sp, "85888", "", conv(new Object[]{"Recibiste  140,000. Para saber mas, consulta tus movimientos.", ahora - 1000}), "k6b:", false);
        app(sp, "DaviPlata", "DaviPlata", "Transaccion exitosa: Recibiste Plata de otra entidad usando Llaves, consulta el detalle de tus movimientos desde el app DaviPlata.", "k6c:");
        VentoApp.ui.correr();
        chk("Primero el SMS y luego la llave: suena de una el SMS «Llegaron 140000 pesos por DaviPlata.» y la llave no lo repite", VentoApp.dichos.equals(java.util.Arrays.asList("Llegaron 140000 pesos por DaviPlata.")), VentoApp.dichos);

        // 6c) Un SMS de HACE 2 MIN (otro pago) y ahora la llave sin valor: NO se juntan (avisa sin valor)
        sp = nuevo();
        VentoEscucha.leerSms(sp, "85888", "", conv(new Object[]{"Recibiste  5,000. Para saber mas, consulta tus movimientos.", ahora - 1000}), "k6d:", false);
        VentoApp.ui.correr(); limpiar();
        { org.json.JSONArray l = new org.json.JSONArray(sp.getString("pagosSmsValor", "[]")); for (int i = 0; i < l.length(); i++) l.getJSONObject(i).put("t", ahora - 90_000L); sp.edit().putString("pagosSmsValor", l.toString()).apply(); }
        app(sp, "DaviPlata", "DaviPlata", "Transaccion exitosa: Recibiste Plata de otra entidad usando Llaves, consulta el detalle de tus movimientos desde el app DaviPlata.", "k6e:");
        VentoApp.ui.correr();
        chk("La llave no se junta con el SMS de OTRO pago de hace 1,5 min", VentoApp.dichos.contains("Llegó plata por Bre-B, en DaviPlata.") && !VentoApp.dichos.stream().anyMatch(x -> x.contains("5000")), VentoApp.dichos);

        // 6d) DaviPlata avisa por los dos lados con el valor (SMS primero, luego la app): suena una sola vez, de una
        sp = nuevo();
        VentoEscucha.leerSms(sp, "85888", "", conv(new Object[]{"Recibiste  7,000. Para saber mas, consulta tus movimientos.", ahora - 1000}), "k6f:", false);
        app(sp, "DaviPlata", "DaviPlata", "¡Le llegó plata! JUAN PEREZ le pasó $7.000 a su DaviPlata", "k6g:");
        chk("El mismo pago por SMS y por la app con el valor: una sola voz, sin esperar", VentoApp.dichos.equals(java.util.Arrays.asList("Llegaron 7000 pesos por DaviPlata.")) && VentoApp.ui.despues.isEmpty(), VentoApp.dichos);

        // 7) Nequi con el valor en su aviso: suena directo
        sp = nuevo();
        app(sp, "Nequi", "Nequi", "¡Te llegó plata! ANA RUIZ te envió $2.500", "k7:");
        chk("Nequi «te envió $2.500» → «Llegaron 2500 pesos por Nequi.»", VentoApp.dichos.contains("Llegaron 2500 pesos por Nequi."), VentoApp.dichos);
        chk("Nequi: notificación «💜 Recibiste $2.500 por Nequi» con el texto del banco (se ve con el celular bloqueado)", VentoApp.notifs.size() == 1 && VentoApp.notifs.get(0)[0].equals("💜 Recibiste $2.500 por Nequi") && VentoApp.notifs.get(0)[2].contains("ANA RUIZ te envió $2.500"), VentoApp.notifs.size());
        chk("Nequi: la ventana emergente lleva el valor «$2.500», «Nequi» y es un pago confirmado", VentoApp.notifs.size() == 1 && VentoApp.notifs.get(0)[3].equals("$2.500") && VentoApp.notifs.get(0)[4].equals("Nequi") && VentoApp.notifs.get(0)[5].equals("ok"), VentoApp.notifs.isEmpty() ? "" : String.join(" | ", VentoApp.notifs.get(0)));

        // 7b) Nequi real (captura del 16-oct): título «Envío» y el valor SIN $ → suena, con notificación y ventana
        sp = nuevo();
        app(sp, "Nequi", "Envío", "MARIBE ARIAS te envió 1500, ¡lo mejor!", "k7b:");
        chk("Nequi «Envío · MARIBE ARIAS te envió 1500, ¡lo mejor!» → suena «Llegaron 1500 pesos por Nequi.» y sale «💜 Recibiste $1.500 por Nequi»", VentoApp.dichos.contains("Llegaron 1500 pesos por Nequi.") && VentoApp.notifs.stream().anyMatch(n -> n[0].equals("💜 Recibiste $1.500 por Nequi") && n[3].equals("$1.500")), VentoApp.dichos);

        // 7c) Nequi que llega primero por SMS (sin número corto confirmado → «revísalo») y luego por la app: la app de Nequi
        //     lo CONFIRMA → suena «Recibiste…», con su notificación y su ventana. Antes se tomaba como «ya dicho» y no abría.
        sp = nuevo();
        VentoEscucha.leerSms(sp, "85954", "", conv(new Object[]{"Nequi: MARIBE ARIAS te envio $1.500", ahora - 1000}), "k7c:", false);
        VentoApp.ui.correr();
        chk("1.99.26: la VOZ del SMS de Nequi dice «Llegaron 1500 pesos por Nequi.» (sin «revísalo»); la notificación sigue «⚠️ … revísalo»", VentoApp.dichos.contains("Llegaron 1500 pesos por Nequi.") && !VentoApp.dichos.stream().anyMatch(d -> d.contains("Revísalo")) && VentoApp.notifs.stream().anyMatch(n -> n[0].contains("revísalo") && n[5].equals("revisar")), VentoApp.dichos + " " + VentoApp.notifs.size());
        VentoApp.notifs.clear(); VentoApp.dichos.clear();
        app(sp, "Nequi", "Envío", "MARIBE ARIAS te envió 1500, ¡lo mejor!", "k7d:");
        chk("Nequi por SMS y luego por la app: la app lo confirma con notificación y 🪟 ventana «$1.500» (1.99.26: sin repetir la voz)", VentoApp.dichos.isEmpty() && VentoApp.notifs.stream().anyMatch(n -> n[3].equals("$1.500") && n[5].equals("ok")), VentoApp.dichos + " " + VentoApp.notifs.size());

        // 8) «Pasaste $100 a otro DaviPlata» (plata que SALE): no suena
        limpiar();
        app(sp, "DaviPlata", "DaviPlata", "Pasaste $100 a otro DaviPlata. Para saber mas, consulta tus movimientos.", "k8:");
        VentoEscucha.leerSms(sp, "85888", "", conv(new Object[]{"DaviPlata: Compra exitosa en la Tienda Virtual por  20,000. Para saber mas, consulta tus movimientos", ahora - 1000}), "k8b:", false);
        VentoApp.ui.correr();
        chk("«Pasaste $100» y «Compra exitosa» NO suenan", VentoApp.dichos.isEmpty(), VentoApp.dichos);

        // 9) Un SMS desde un celular común con el mismo texto: «parece falso»
        limpiar();
        VentoEscucha.leerSms(sp, "3001234567", "", conv(new Object[]{"DaviPlata: recibiste 50,000 en tu DaviPlata", ahora - 1000}), "k9:", false);
        VentoApp.ui.correr();
        chk("SMS de un celular común: «Ojo… parece falso»", VentoApp.dichos.stream().anyMatch(x -> x.startsWith("Ojo.")), VentoApp.dichos);
        chk("…y su notificación «🚨 Mensaje de pago FALSO»", VentoApp.notifs.stream().anyMatch(n -> n[0].startsWith("🚨 Mensaje de pago FALSO")), VentoApp.notifs.size());

        // 10) Lo que hizo Vento queda en el registro de Ajustes → Pagos
        String d = VentoEscucha.diag(sp0) + VentoEscucha.diag(sp);
        chk("Registro (Ajustes → Pagos): cada aviso con lo que hizo Vento", d.contains("Llegaron 200 pesos por DaviPlata") && d.contains("plata que SALE"), d.length() > 300 ? d.substring(0, 300) : d);

        // 10b) El 85888 manda el SMS con RETRASO (la hora del mensaje es de hace 20 min): igual suena, porque es el más nuevo
        //      de la conversación. En la 1.40.4 se ignoraba (solo se leían los de los últimos 3 min).
        sp = nuevo();
        r = VentoEscucha.leerSms(sp, "85888", "", conv(new Object[]{"Recibiste  9,000. Para saber mas, consulta tus movimientos.", ahora - 50 * min},
                                                      new Object[]{"Recibiste  12,000. Para saber mas, consulta tus movimientos.", ahora - 20 * min}), "k10b:", false);
        VentoApp.ui.correr();
        chk("SMS con retraso (hora de hace 20 min) pero es el más nuevo: suena «Llegaron 12000 pesos por DaviPlata.» (el viejo no)", r && VentoApp.dichos.size() == 1 && VentoApp.dichos.get(0).equals("Llegaron 12000 pesos por DaviPlata."), VentoApp.dichos);

        // 10c) ⏱ El registro dice si el BANCO mandó el aviso tarde (el SMS dice que el pago fue hace 40 s)
        sp = nuevo();
        VentoEscucha.leerSms(sp, "85888", "", conv(new Object[]{"Recibiste  4,000. Para saber mas, consulta tus movimientos.", ahora - 40_000}), "k10c:", false);
        String dd = VentoEscucha.diag(sp);
        chk("Registro: «⏱ el banco lo mandó 40 s tarde» (la voz sale en el instante en que llega)", dd.contains("el banco lo mandó 40 s tarde") || dd.contains("el banco lo mandó 41 s tarde"), dd.length() > 300 ? dd.substring(0, 300) : dd);

        // 11) Un aviso del banco con un formato que la app NO entiende («Abono en cuenta $15.000»): no suena aquí, pero se le
        //     pasa a la página «crudo» (ella lo revisa con sus reglas, que se actualizan solas)
        sp = nuevo();
        r = app(sp, "Bancolombia", "Bancolombia", "Abono en cuenta por $15.000 desde otra entidad", "k11:");
        String cola = VentoEscucha.tomar(sp);
        chk("Formato que la app no entiende: va a la página «crudo» (sin decir nada aquí)", r && VentoApp.dichos.isEmpty() && cola.contains("\"crudo\":true") && cola.contains("15.000"), cola);
        r = app(sp, "Bancolombia", "Bancolombia", "Abono en cuenta por $15.000 desde otra entidad", "k11:");
        chk("…el mismo aviso publicado otra vez no se pasa dos veces", !r && VentoEscucha.tomar(sp).equals("[]"), r);

        // 12) Lo que NO se le pasa a la página: plata que sale, códigos, SMS de un contacto
        sp = nuevo();
        app(sp, "DaviPlata", "DaviPlata", "Pasaste $100 a otro DaviPlata. Para saber mas, consulta tus movimientos.", "k12:");
        VentoEscucha.leerSms(sp, "85888", "", conv(new Object[]{"DaviPlata: Tu codigo de verificacion es 482913. No lo compartas.", ahora - 1000}), "k12b:", false);
        VentoEscucha.leerSms(sp, "Mamá", "", conv(new Object[]{"Te paso la plata del mercado mañana", ahora - 1000}), "k12c:", false);
        cola = VentoEscucha.tomar(sp);
        chk("Plata que sale, códigos y SMS de un contacto NO van a la página", cola.equals("[]") && VentoApp.dichos.isEmpty(), cola);

        // 13) SMS del 85888 con un formato nuevo: va a la página «crudo», marcado como del banco (DaviPlata)
        sp = nuevo();
        r = VentoEscucha.leerSms(sp, "85888", "", conv(new Object[]{"Abono a tu DaviPlata por transferencia: 8,000", ahora - 1000}), "k13:", false);
        cola = VentoEscucha.tomar(sp);
        chk("SMS del 85888 que la app no entiende: va a la página como del banco", r && cola.contains("\"crudo\":true") && cola.contains("\"smsOk\":true") && cola.contains("85888"), cola);

        // 14) Lo que sí entiende NO va crudo (va normal, ya dicho)
        sp = nuevo();
        app(sp, "Nequi", "Nequi", "¡Te llegó plata! ANA RUIZ te envió $2.500", "k14:");
        cola = VentoEscucha.tomar(sp);
        chk("Un pago que la app entiende va normal (ya dicho), no crudo", !cola.contains("crudo") && cola.contains("\"voz\":true"), cola);

        // 1.43.6: avisos «resumen» (varios pagos agrupados). Antes se ignoraban: el pago que venía solo en el resumen no sonaba.
        chk("Resumen: un pago que se dijo desde el resumen NO se repite cuando llega su aviso normal", 
            ((java.util.function.BooleanSupplier) () -> { VentoEscucha.marcarResumen("Nequi", "ANA te envió 2000"); return VentoEscucha.porResumen("Nequi", "ANA te envió 2000"); }).getAsBoolean(), "");
        chk("Resumen: …y solo una vez (un segundo pago igual en su aviso normal SÍ suena)", !VentoEscucha.porResumen("Nequi", "ANA te envió 2000"), "");
        chk("Resumen: lo que no vino del resumen no se salta", !VentoEscucha.porResumen("Nequi", "JUAN te envió 5000"), "");
        chk("Resumen: es por app (lo mismo en otra app no cuenta)", ((java.util.function.BooleanSupplier) () -> { VentoEscucha.marcarResumen("Nequi", "X te envió 100"); return !VentoEscucha.porResumen("DaviPlata", "X te envió 100"); }).getAsBoolean(), "");
        // Aviso REAL de la llave Bre-B de Nequi (captura del dueño, 16-oct 8:29 p. m., app «Nequi Colombia», agrupado con los «Envío»)
        { Preferencias spB = nuevo();
          boolean rb = app(spB, "Nequi Colombia", "Te enviaron plata por Bre-B", "Te enviaron $300. Entra a tu app y revisa tu saldo.", "kbreb:");
          VentoApp.ui.correr();
          chk("Bre-B real de Nequi: suena «Llegaron 300 pesos por Bre-B, en Nequi.»", rb && VentoApp.dichos.contains("Llegaron 300 pesos por Bre-B, en Nequi."), VentoApp.dichos);
          chk("Bre-B real de Nequi: notificación y 🪟 ventana con «$300» por «Bre-B en Nequi» (pago confirmado)", VentoApp.notifs.stream().anyMatch(n -> n[3].equals("$300") && n[4].equals("Bre-B en Nequi") && n[5].equals("ok")), VentoApp.notifs.size());
          chk("Bre-B real de Nequi: se dice con pausas y despacio: «Recibiste, 300 pesos, por Bre-B, en Nequi.»", AvisoPago.pausado("Recibiste 300 pesos por Bre-B, en Nequi.").equals("Recibiste, 300 pesos, por Bre-B, en Nequi."), ""); }
        // 💸 1.66.5: plata que SALE (lo que el dueño envía o paga): no suena, no va a la cola de pagos ni al servidor,
        // pero queda en ESTE celular para clasificarla en Contabilidad (proveedor u otro gasto).
        { Preferencias spS = nuevo();
          app(spS, "Nequi", "Envío", "Enviaste $250.000 a DISTRIBUIDORA EL SOL", "ks1:");
          app(spS, "DaviPlata", "DaviPlata", "Pasaste $100 a otro DaviPlata. Para saber mas, consulta tus movimientos.", "ks2:");
          VentoEscucha.leerSms(spS, "85888", "", conv(new Object[]{"DaviPlata: Compra exitosa en la Tienda Virtual por  20,000. Para saber mas, consulta tus movimientos", ahora - 1000}), "ks3:", false);
          VentoEscucha.leerSms(spS, "85888", "", conv(new Object[]{"DaviPlata: Tu codigo de verificacion es 482913. No lo compartas.", ahora - 1000}), "ks4:", false);
          VentoEscucha.leerSms(spS, "3001234567", "", conv(new Object[]{"Pagaste $50.000 a JUAN", ahora - 1000}), "ks5:", false);
          app(spS, "Nequi", "Nequi", "Tu pago de $30.000 fue rechazado. Pagaste con saldo insuficiente", "ks6:");
          VentoApp.ui.correr();
          String sal = VentoEscucha.tomarSalidas(spS);
          chk("💸 Salidas: «Enviaste $250.000 a DISTRIBUIDORA EL SOL» (Nequi) queda para Contabilidad", sal.contains("Enviaste $250.000 a DISTRIBUIDORA EL SOL") && sal.contains("\"app\":\"Nequi\""), sal);
          chk("💸 Salidas: «Pasaste $100» (DaviPlata) y «Compra exitosa … 20,000» (SMS 85888) también", sal.contains("Pasaste $100") && sal.contains("Compra exitosa") && sal.contains("SMS 85888"), sal);
          chk("💸 Salidas: NO los códigos, ni un SMS de un celular común, ni un pago rechazado", !sal.contains("482913") && !sal.contains("JUAN") && !sal.contains("rechazado"), sal);
          chk("💸 Salidas: no suenan ni van a la cola de pagos (ni al servidor)", VentoApp.dichos.isEmpty() && VentoEscucha.tomar(spS).equals("[]"), VentoApp.dichos);
          chk("💸 Salidas: la página las toma una vez (después la lista queda vacía)", VentoEscucha.tomarSalidas(spS).equals("[]"), "");
          app(spS, "Nequi", "Envío", "Enviaste $250.000 a DISTRIBUIDORA EL SOL", "ks1:");
          chk("💸 Salidas: el mismo aviso publicado otra vez no se guarda dos veces", VentoEscucha.tomarSalidas(spS).equals("[]"), ""); }
        // ===== 1.82.1 · Un pago = UNA voz, aunque llegue por la app del banco, por SMS directo y por la app de mensajes =====
        // El dueño: «me avisa llegaron 200 pesos y después me dice llegaron otra vez 200 pesos por mensaje de texto».
        { // A) Nequi: primero el aviso de la app (con valor), después el SMS (directo) y el mismo SMS por la app de mensajes
          Preferencias s2 = nuevo(); long t = System.currentTimeMillis();
          app(s2, "Nequi", "Nequi", "¡Te llegó plata! JUAN PEREZ te envió $200", "dA:");
          SmsBanco.recibir(s2, "85954", "Nequi: Recibiste $200 de JUAN PEREZ en tu Nequi.", t);
          VentoEscucha.leerSms(s2, "85954", "Nequi: Recibiste $200 de JUAN PEREZ en tu Nequi.", conv(new Object[]{"Nequi: Recibiste $200 de JUAN PEREZ en tu Nequi.", t}), "dA2:", false);
          VentoApp.ui.correr();
          chk("1.82.1 A) Nequi por la app + el mismo pago por SMS (directo y por la app de mensajes): suena UNA vez", VentoApp.dichos.size() == 1, VentoApp.dichos); }
        { // B) DaviPlata 85888: el SMS directo y después el aviso de la app de mensajes con otro encabezado (texto distinto)
          Preferencias s2 = nuevo(); long t = System.currentTimeMillis();
          SmsBanco.recibir(s2, "85888", "Recibiste 200. Para saber mas, consulta tus movimientos.", t);
          VentoEscucha.leerSms(s2, "85888", "DaviPlata: Recibiste 200. Para saber mas, consulta tus mov", conv(new Object[]{"DaviPlata: Recibiste 200. Para saber mas, consulta tus mov", t + 1500}), "dB:", false);
          VentoApp.ui.correr();
          chk("1.82.1 B) El mismo SMS directo y por la app de mensajes (cortado y con «DaviPlata:» adelante): suena UNA vez", VentoApp.dichos.size() == 1 && VentoApp.dichos.get(0).equals("Llegaron 200 pesos por DaviPlata."), VentoApp.dichos); }
        { // C) La app de mensajes llega PRIMERO y después el SMS directo
          Preferencias s2 = nuevo(); long t = System.currentTimeMillis();
          VentoEscucha.leerSms(s2, "85888", "Recibiste 5,000. Para saber mas, consulta tus movimientos.", conv(new Object[]{"Recibiste 5,000. Para saber mas, consulta tus movimientos.", t}), "dC:", false);
          SmsBanco.recibir(s2, "85888", "Recibiste 5,000. Para saber mas, consulta tus movimientos.", t);
          VentoApp.ui.correr();
          chk("1.82.1 C) Primero por la app de mensajes y después directo: suena UNA vez", VentoApp.dichos.size() == 1, VentoApp.dichos); }
        { // D) Dos pagos IGUALES de verdad (dos «Recibiste 1,000.»), cada uno directo y por la app de mensajes: suenan DOS veces
          Preferencias s2 = nuevo(); long t = System.currentTimeMillis();
          SmsBanco.recibir(s2, "85888", "Recibiste 1,000. Para saber mas, consulta tus movimientos.", t - 40_000);
          SmsBanco.recibir(s2, "85888", "Recibiste 1,000. Para saber mas, consulta tus movimientos.", t);
          VentoEscucha.leerSms(s2, "85888", "", conv(new Object[]{"Recibiste 1,000. Para saber mas, consulta tus movimientos.", t - 40_000}, new Object[]{"Recibiste 1,000. Para saber mas, consulta tus movimientos.", t}), "dD:", false);
          VentoApp.ui.correr();
          chk("1.82.1 D) Dos pagos iguales de verdad (directo + app de mensajes cada uno): suenan los DOS, una vez cada uno", VentoApp.dichos.size() == 2, VentoApp.dichos); }
        { // E) Dos SMS distintos (200 y 300) por los dos lados: suena cada uno una vez
          Preferencias s2 = nuevo(); long t = System.currentTimeMillis();
          SmsBanco.recibir(s2, "85888", "Recibiste 200. Para saber mas, consulta tus movimientos.", t - 20_000);
          SmsBanco.recibir(s2, "85888", "Recibiste 300. Para saber mas, consulta tus movimientos.", t);
          VentoEscucha.leerSms(s2, "85888", "", conv(new Object[]{"Recibiste 200. Para saber mas, consulta tus movimientos.", t - 20_000}, new Object[]{"Recibiste 300. Para saber mas, consulta tus movimientos.", t}), "dE:", false);
          VentoApp.ui.correr();
          chk("1.82.1 E) Dos SMS distintos ($200 y $300) por los dos lados: cada uno una vez", VentoApp.dichos.size() == 2 && VentoApp.dichos.contains("Llegaron 200 pesos por DaviPlata.") && VentoApp.dichos.contains("Llegaron 300 pesos por DaviPlata."), VentoApp.dichos); }
        // 1.99.52 · El caso real (23/11, Samsung, SMS de Nequi 890806): llega el SMS de $1.400 (directo y luego en la
        // conversación de la app de mensajes); 6 min después llega el de $3.500 y la conversación trae los DOS. Antes el de
        // $1.400 volvía a sonar como pago nuevo; ahora cada pago suena una sola vez.
        {
            long t = System.currentTimeMillis();
            Preferencias s6 = nuevo();
            String sa = "Nequi: Recibiste $1.400 de LUIS PEREZ en tu cuenta. Codigo de transaccion M123", sb = "Nequi: Recibiste $3.500 de ANA RUIZ en tu cuenta. Codigo de transaccion M456";
            SmsBanco.recibir(s6, "890806", sa, t - 370_000L);
            VentoEscucha.leerSms(s6, "890806", sa, conv(new Object[]{sa, t - 369_000L}), "c1:", false);
            SmsBanco.recibir(s6, "890806", sb, t - 2000);
            VentoEscucha.leerSms(s6, "890806", sb, conv(new Object[]{sa, t - 369_000L}, new Object[]{sb, t - 1000}), "c2:", false);
            VentoEscucha.leerSms(s6, "890806", sb, conv(new Object[]{sa, t - 369_000L}, new Object[]{sb, t - 1000}), "c3:", false);   // la app de mensajes la vuelve a publicar
            VentoApp.ui.correr();
            long n14 = VentoApp.dichos.stream().filter(x -> x.contains("1400")).count(), n35 = VentoApp.dichos.stream().filter(x -> x.contains("3500")).count();
            chk("1.99.52: con la conversación de la app de mensajes, $1.400 suena UNA vez y $3.500 UNA vez (antes $1.400 sonaba otra vez después del $3.500)", n14 == 1 && n35 == 1, VentoApp.dichos);
            // Dos pagos IGUALES de verdad (dos SMS de $1.400 a distinta hora) siguen siendo dos.
            limpiar();
            Preferencias s7 = nuevo();
            SmsBanco.recibir(s7, "890806", sa, t - 60_000L);
            VentoEscucha.leerSms(s7, "890806", sa, conv(new Object[]{sa, t - 59_000L}), "d1:", false);
            SmsBanco.recibir(s7, "890806", sa, t - 2000);
            VentoEscucha.leerSms(s7, "890806", sa, conv(new Object[]{sa, t - 59_000L}, new Object[]{sa, t - 1000}), "d2:", false);
            VentoApp.ui.correr();
            chk("1.99.52: dos pagos iguales de verdad (dos SMS de $1.400, a distinta hora) siguen sonando los dos", VentoApp.dichos.stream().filter(x -> x.contains("1400")).count() == 2, VentoApp.dichos);
        }
        // 1.99.49 · «Me sonó uno de 3.500 y después otro de 1.400 que habían puesto antes» (Xiaomi, 23/11: Android le pasó
        // el aviso a ORDEVA 595 s tarde). El pago de AHORA suena normal; el que llegó tarde dice de cuándo es.
        {
            long t = System.currentTimeMillis();
            Preferencias s5 = nuevo();
            VentoEscucha.tiempos(t - 1000, t - 500);
            app(s5, "Nequi", "Nequi", "ANA RUIZ te envió $3.500", "N35:");
            VentoApp.ui.correr();
            chk("1.99.49: el pago de ahora suena normal: «Llegaron 3500 pesos por Nequi.»", VentoApp.dichos.contains("Llegaron 3500 pesos por Nequi."), VentoApp.dichos);
            limpiar();
            VentoEscucha.tiempos(t - 600_000L, t - 595_000L);
            app(s5, "Nequi", "Nequi", "LUIS PEREZ te envió $1.400", "N14:");
            VentoApp.ui.correr();
            chk("1.99.49: el que Android pasó 10 min tarde dice de cuándo es: «Llegaron 1400 pesos por Nequi. Es de hace 10 minutos.»", VentoApp.dichos.contains("Llegaron 1400 pesos por Nequi. Es de hace 10 minutos."), VentoApp.dichos);
            chk("1.99.49: … y la notificación también: «💜 Recibiste $1.400 por Nequi · de hace 10 min»", VentoApp.notifs.stream().anyMatch(n -> n[0].equals("💜 Recibiste $1.400 por Nequi · de hace 10 min")), VentoApp.avisos);
            limpiar();
            VentoEscucha.tiempos(t - 370_000L, t - 2000);
            app(s5, "Nequi", "Nequi", "MARIA LOPEZ te envió $8.000", "N80:");
            VentoApp.ui.correr();
            chk("1.99.49: el que el BANCO mandó 6 min tarde también lo dice: «… Es de hace 6 minutos.»", VentoApp.dichos.contains("Llegaron 8000 pesos por Nequi. Es de hace 6 minutos."), VentoApp.dichos);
            limpiar();
            VentoEscucha.tiempos(t - 40_000L, t - 30_000L);
            app(s5, "Nequi", "Nequi", "PEDRO DIAZ te envió $2.000", "N20:");
            VentoApp.ui.correr();
            chk("1.99.49: uno de hace menos de 2 min suena normal (sin «Es de hace»)", VentoApp.dichos.contains("Llegaron 2000 pesos por Nequi."), VentoApp.dichos);
            VentoEscucha.tiempos(0, 0);
        }
        System.out.println("RESULTADO " + ok + " bien " + mal + " mal");
        System.exit(mal > 0 ? 1 : 0);
    }
}
