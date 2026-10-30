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
        VentoApp.notifs.clear(); VentoApp.dichos.clear();
        app(sp, "Nequi", "Envío", "MARIBE ARIAS te envió 1500, ¡lo mejor!", "k7d:");
        chk("Nequi por SMS («revísalo») y luego por la app: la app lo confirma con voz, notificación y 🪟 ventana «$1.500»", VentoApp.dichos.contains("Llegaron 1500 pesos por Nequi.") && VentoApp.notifs.stream().anyMatch(n -> n[3].equals("$1.500") && n[5].equals("ok")), VentoApp.dichos + " " + VentoApp.notifs.size());

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
        System.out.println("RESULTADO " + ok + " bien " + mal + " mal");
        System.exit(mal > 0 ? 1 : 0);
    }
}
