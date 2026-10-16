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
        return (Boolean) procesar.invoke(null, sp, app, titulo, cuerpo, pref, true, false);
    }
    static List<Object[]> conv(Object[]... m) { List<Object[]> l = new ArrayList<>(); for (Object[] x : m) l.add(x); return l; }
    static void limpiar() { VentoApp.dichos.clear(); VentoApp.avisos.clear(); VentoApp.ui.despues.clear(); }
    static Preferencias nuevo() { limpiar(); return new Preferencias(); }   // cada caso, como un pago aparte

    public static void main(String[] a) throws Exception {
        procesar = VentoEscucha.class.getDeclaredMethod("procesar", android.content.SharedPreferences.class, String.class, String.class, String.class, String.class, boolean.class, boolean.class);
        procesarSms = VentoEscucha.class.getDeclaredMethod("procesarSms", android.content.SharedPreferences.class, String.class, String.class, String.class, boolean.class);
        procesar.setAccessible(true); procesarSms.setAccessible(true);
        Preferencias sp = new Preferencias();
        long ahora = System.currentTimeMillis(), min = 60_000L;

        // 1) SMS del 85888: «Recibiste 200.» (sin $ y sin decir DaviPlata) → «Recibiste 200 pesos por DaviPlata.»
        limpiar();
        boolean r = VentoEscucha.leerSms(sp, "85888", "Recibiste  200. Para saber mas, consulta tus movimientos.",
                conv(new Object[]{"Recibiste  200. Para saber mas, consulta tus movimientos.", ahora - 2000}), "k1:", false);
        VentoApp.ui.correr();
        chk("SMS 85888 «Recibiste 200.» → suena «Recibiste 200 pesos por DaviPlata.»", r && VentoApp.dichos.contains("Recibiste 200 pesos por DaviPlata."), VentoApp.dichos);
        chk("…y sale el aviso del celular «💜 Pagaron $200»", VentoApp.avisos.stream().anyMatch(x -> x.contains("$200")), VentoApp.avisos);

        // 2) La conversación trae los mensajes VIEJOS (65,000 · 100 · 1,000 de hace 40 min) y uno nuevo (20,000): solo suena el nuevo
        limpiar();
        r = VentoEscucha.leerSms(sp, "85888", "DaviPlata: recibiste  20,000 en tu DaviPlata. Usalos de forma segura para pagar, comprar y mucho mas!",
                conv(new Object[]{"Recibiste  65,000. Para saber mas, consulta tus movimientos.", ahora - 40 * min},
                     new Object[]{"Recibiste  100. Para saber mas, consulta tus movimientos.", ahora - 40 * min},
                     new Object[]{"Recibiste  1,000. Para saber mas, consulta tus movimientos.", ahora - 40 * min},
                     new Object[]{"DaviPlata: recibiste  20,000 en tu DaviPlata. Usalos de forma segura para pagar, comprar y mucho mas! Conoce todo lo que puedes hacer en www.daviplata.com", ahora - 3000}), "k2:", false);
        VentoApp.ui.correr();
        chk("Conversación con mensajes viejos: solo suena el NUEVO ($20.000), una vez", r && VentoApp.dichos.size() == 1 && VentoApp.dichos.get(0).equals("Recibiste 20000 pesos por DaviPlata."), VentoApp.dichos);

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
        chk("Dos pagos iguales seguidos ($1.000 y $1.000): suenan los dos", VentoApp.dichos.size() == 2 && VentoApp.dichos.stream().allMatch(x -> x.equals("Recibiste 1000 pesos por DaviPlata.")), VentoApp.dichos);

        // 5) Llave Bre-B: la app de DaviPlata avisa SIN valor y luego llega el SMS con el valor → una sola voz con el valor
        Preferencias sp0 = sp; sp = nuevo();
        app(sp, "DaviPlata", "DaviPlata", "Transaccion exitosa: Recibiste Plata de otra entidad usando Llaves, consulta el detalle de tus movimientos desde el app DaviPlata.", "k5:");
        chk("Llave Bre-B sin valor: todavía no dice nada (espera el SMS unos segundos)", VentoApp.dichos.isEmpty(), VentoApp.dichos);
        VentoEscucha.leerSms(sp, "85888", "", conv(new Object[]{"Recibiste  65,000. Para saber mas, consulta tus movimientos.", ahora - 1000}), "k5b:", false);
        VentoApp.ui.correr();
        chk("…llega el SMS: «Recibiste 65000 pesos por Bre-B, en DaviPlata.» una sola vez", VentoApp.dichos.size() == 1 && VentoApp.dichos.get(0).equals("Recibiste 65000 pesos por Bre-B, en DaviPlata."), VentoApp.dichos);

        // 6) Llave Bre-B sin valor y SIN SMS: a los pocos segundos avisa sin el valor
        sp = nuevo();
        app(sp, "DaviPlata", "DaviPlata", "Transaccion exitosa: Recibiste Plata de otra entidad usando Llaves, consulta el detalle de tus movimientos desde el app DaviPlata.", "k6:");
        VentoApp.ui.correr();
        chk("Llave Bre-B sin SMS: «Llegó plata por DaviPlata. Mira el valor en la aplicación.»", VentoApp.dichos.contains("Llegó plata por DaviPlata. Mira el valor en la aplicación."), VentoApp.dichos);

        // 6b) Primero el SMS y después (segundos) el aviso de la llave: una sola voz con el valor
        sp = nuevo();
        VentoEscucha.leerSms(sp, "85888", "", conv(new Object[]{"Recibiste  140,000. Para saber mas, consulta tus movimientos.", ahora - 1000}), "k6b:", false);
        app(sp, "DaviPlata", "DaviPlata", "Transaccion exitosa: Recibiste Plata de otra entidad usando Llaves, consulta el detalle de tus movimientos desde el app DaviPlata.", "k6c:");
        VentoApp.ui.correr();
        chk("Primero el SMS y luego la llave: «Recibiste 140000 pesos por Bre-B, en DaviPlata.» una sola vez", VentoApp.dichos.size() == 1 && VentoApp.dichos.get(0).equals("Recibiste 140000 pesos por Bre-B, en DaviPlata."), VentoApp.dichos);

        // 6c) Un SMS de HACE 2 MIN (otro pago) y ahora la llave sin valor: NO se juntan (avisa sin valor)
        sp = nuevo();
        VentoEscucha.leerSms(sp, "85888", "", conv(new Object[]{"Recibiste  5,000. Para saber mas, consulta tus movimientos.", ahora - 1000}), "k6d:", false);
        VentoApp.ui.correr(); limpiar();
        { org.json.JSONArray l = new org.json.JSONArray(sp.getString("pagosSmsValor", "[]")); for (int i = 0; i < l.length(); i++) l.getJSONObject(i).put("t", ahora - 90_000L); sp.edit().putString("pagosSmsValor", l.toString()).apply(); }
        app(sp, "DaviPlata", "DaviPlata", "Transaccion exitosa: Recibiste Plata de otra entidad usando Llaves, consulta el detalle de tus movimientos desde el app DaviPlata.", "k6e:");
        VentoApp.ui.correr();
        chk("La llave no se junta con el SMS de OTRO pago de hace 1,5 min", VentoApp.dichos.contains("Llegó plata por DaviPlata. Mira el valor en la aplicación.") && !VentoApp.dichos.stream().anyMatch(x -> x.contains("5000")), VentoApp.dichos);

        // 7) Nequi con el valor en su aviso: suena directo
        sp = nuevo();
        app(sp, "Nequi", "Nequi", "¡Te llegó plata! ANA RUIZ te envió $2.500", "k7:");
        chk("Nequi «te envió $2.500» → «Recibiste 2500 pesos por Nequi.»", VentoApp.dichos.contains("Recibiste 2500 pesos por Nequi."), VentoApp.dichos);

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

        // 10) Lo que hizo Vento queda en el registro de Ajustes → Pagos
        String d = VentoEscucha.diag(sp0) + VentoEscucha.diag(sp);
        chk("Registro (Ajustes → Pagos): cada aviso con lo que hizo Vento", d.contains("Recibiste 200 pesos por DaviPlata") && d.contains("plata que SALE"), d.length() > 300 ? d.substring(0, 300) : d);

        System.out.println("RESULTADO " + ok + " bien " + mal + " mal");
        System.exit(mal > 0 ? 1 : 0);
    }
}
