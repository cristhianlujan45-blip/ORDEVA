package co.vento.app;

import android.content.ContextWrapper;
import android.content.SharedPreferences;
import com.sun.net.httpserver.HttpServer;

import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * SOLO PARA PRUEBAS: los pagos entre equipos desde Android (Cruce.java) contra un servidor de mentira (HTTP de verdad).
 * revisar(): la primera vez solo toma la hora; un pago nuevo de OTRO equipo suena aquí (voz + notificación de pagos con
 * su ventana) UNA sola vez; el que leyó este celular no se repite; un mesero no lo oye; «revisar» y «falso» con su aviso;
 * un pago viejo no suena; lo que ya avisó la página (reclamar) no se repite; un celular retirado le avisa a la página.
 * reenviar(): el aviso que lee este celular sale de una al servidor con el MISMO id de la página y lo que entendió.
 */
public class CrucePrueba {
    static int ok = 0, mal = 0;
    static void chk(String n, boolean c, Object x) { if (c) { ok++; System.out.println("✅ " + n); } else { mal++; System.out.println("❌ " + n + " → " + x); } }

    static String respuesta = "{}";
    static final List<String> avisos = new ArrayList<>(), pedidos = new ArrayList<>();

    static final Preferencias PREF = new Preferencias();
    static final ContextWrapper CTX = new ContextWrapper(null) {
        @Override public SharedPreferences getSharedPreferences(String n, int m) { return PREF; }
    };

    static void revisarYEsperar() throws Exception {
        String antes = PREF.getString(Cruce.PREF_ESTADO, "");
        Cruce.revisar(CTX);
        for (int i = 0; i < 100 && PREF.getString(Cruce.PREF_ESTADO, "").equals(antes); i++) Thread.sleep(30);
        Thread.sleep(60);
    }
    static String iso(long msAtras) { return java.time.OffsetDateTime.now(java.time.ZoneOffset.UTC).minusNanos(msAtras * 1_000_000L).toString(); }
    static String pago(String id, long monto, String metodo, String de, String conf, String deDisp, long msAtras) {
        String t = iso(msAtras);
        return "{\"id\":\"" + id + "\",\"monto\":" + monto + ",\"metodo\":\"" + metodo + "\",\"pagador\":" + (de == null ? "null" : "\"" + de + "\"") + ",\"confianza\":\"" + conf +
            "\",\"estado\":\"aprobado\",\"detalle\":\"Confirmado por la app de Nequi\",\"actualizado_en\":\"" + t + "\",\"aprobado_en\":\"" + t + "\",\"de_dispositivo\":" + (deDisp == null ? "null" : "\"" + deDisp + "\"") + "}";
    }
    static void responder(String rol, String... pagos) { respuesta = "{\"ok\":true,\"rol\":\"" + rol + "\",\"dispositivo\":\"YO\",\"ahora\":\"" + iso(0) + "\",\"pagos\":[" + String.join(",", pagos) + "]}"; }

    public static void main(String[] a) throws Exception {
        HttpServer s = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        s.createContext("/rest/v1/rpc/pagos_dispositivo", h -> {
            pedidos.add(new String(h.getRequestBody().readAllBytes(), StandardCharsets.UTF_8) + " key=" + h.getRequestHeaders().getFirst("apikey"));
            byte[] b = respuesta.getBytes(StandardCharsets.UTF_8); h.sendResponseHeaders(200, b.length); try (OutputStream o = h.getResponseBody()) { o.write(b); }
        });
        s.createContext("/functions/v1/vento-pagos/aviso/", h -> {
            avisos.add(h.getRequestURI().getPath() + " " + new String(h.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            byte[] b = "{\"ok\":true}".getBytes(StandardCharsets.UTF_8); h.sendResponseHeaders(200, b.length); try (OutputStream o = h.getResponseBody()) { o.write(b); }
        });
        s.start();
        String url = "http://127.0.0.1:" + s.getAddress().getPort();
        String TOKEN = "tok-0123456789abcdef0123456789";

        // Sin configurar: no pregunta nada
        Cruce.revisar(CTX); Thread.sleep(200);
        chk("Sin la configuración de la página no pregunta nada", pedidos.isEmpty(), pedidos);
        Cruce.configurar(CTX, "{\"url\":\"" + url + "/\",\"key\":\"ANON\",\"token\":\"" + TOKEN + "\"}");

        // 1. Primera vez: solo toma la hora
        responder("dueno", pago("p0", 5000, "NEQUI", "Luis", "app", "OTRO", 60_000));
        revisarYEsperar();
        chk("1. Pregunta con el token del celular y la llave pública", pedidos.size() == 1 && pedidos.get(0).contains(TOKEN) && pedidos.get(0).contains("key=ANON"), pedidos);
        chk("1. La primera vez no anuncia los pagos de antes (solo toma la hora)", VentoApp.dichos.isEmpty() && VentoApp.notifs.isEmpty(), VentoApp.dichos);
        chk("1. … y desde ahí pregunta por lo nuevo (p_desde)", !PREF.getString(Cruce.PREF_DESDE, "").isEmpty(), PREF.m);

        // 2. Un pago nuevo de otro equipo
        responder("dueno", pago("p1", 20000, "NEQUI", "Ana Ruiz", "app", "OTRO", 2_000));
        revisarYEsperar();
        chk("2. Pago de otro equipo: suena aquí «Llegaron 20000 pesos por Nequi» (la cantidad, sin el nombre)", VentoApp.dichos.size() == 1 && VentoApp.dichos.get(0).equals("Llegaron 20000 pesos por Nequi.") && !VentoApp.dichos.get(0).contains("Ana"), VentoApp.dichos);
        chk("2. … con la notificación de pagos y su ventana («💜 Recibiste $20.000 por Nequi», $20.000)", VentoApp.notifs.size() == 1 && VentoApp.notifs.get(0)[0].equals("💜 Recibiste $20.000 por Nequi") && VentoApp.notifs.get(0)[3].equals("$20.000") && VentoApp.notifs.get(0)[5].equals("ok"), VentoApp.avisos);
        chk("2. Le pide a la página que se ponga al día", VentoApp.jss.stream().anyMatch(x -> x.contains("ventoPagos.sincronizar")), VentoApp.jss);
        revisarYEsperar();
        chk("2. El mismo pago otra vez → no se repite", VentoApp.dichos.size() == 1, VentoApp.dichos);

        // 3. El que leyó este celular, el de un mesero, uno viejo, y uno que ya avisó la página
        responder("dueno", pago("p2", 7000, "DAVIPLATA", null, "app", "YO", 1_000), pago("p3", 8000, "NEQUI", null, "app", "OTRO", 40 * 60_000));
        revisarYEsperar();
        chk("3. El pago que leyó ESTE celular (ya sonó aquí) y uno de hace 40 min → no suenan", VentoApp.dichos.size() == 1, VentoApp.dichos);
        chk("3. La página ya lo avisó (reclamado) → Android no lo repite", !Cruce.reclamar(CTX, "p2") && Cruce.reclamar(CTX, "p9"), "");
        responder("dueno", pago("p9", 9000, "NEQUI", null, "app", "OTRO", 1_000));
        revisarYEsperar();
        chk("3. … (p9 lo reclamó la página primero: Android no lo dice)", VentoApp.dichos.size() == 1, VentoApp.dichos);
        responder("mesero", pago("p4", 11000, "NEQUI", null, "app", "OTRO", 1_000));
        revisarYEsperar();
        chk("3. En el celular de un mesero no suena (lo de Nequi solo lo oye el administrador)", VentoApp.dichos.size() == 1, VentoApp.dichos);

        // 4. Por revisar y falso
        responder("admin", pago("p5", 12000, "TRANSFERENCIA", null, "revisar", "OTRO", 1_000), pago("p6", 50000, "NEQUI", null, "falso", "OTRO", 1_000));
        revisarYEsperar();
        chk("4. «Revisar»: «⚠️ Aviso de $12.000: revísalo» y la voz lo dice", VentoApp.notifs.stream().anyMatch(n -> n[0].equals("⚠️ Aviso de $12.000: revísalo") && n[5].equals("revisar")) && VentoApp.dichos.stream().anyMatch(d -> d.contains("12000") && d.contains("Revísalo")), VentoApp.avisos);
        chk("4. «Falso»: «🚨 Mensaje de pago FALSO: $50.000» y la voz avisa", VentoApp.notifs.stream().anyMatch(n -> n[0].equals("🚨 Mensaje de pago FALSO: $50.000") && n[5].equals("falso")) && VentoApp.dichos.stream().anyMatch(d -> d.contains("sospechoso")), VentoApp.avisos);

        // 5. Celular retirado
        respuesta = "{\"ok\":false,\"error\":\"dispositivo_no_autorizado\"}";
        revisarYEsperar();
        chk("5. Celular retirado: le avisa a la página para que lo vuelva a autorizar", VentoApp.jss.stream().anyMatch(x -> x.contains("ventoPagosCruceMal") && x.contains("dispositivo_no_autorizado")), VentoApp.jss);

        // 6. reenviar: el aviso de este celular al servidor de una
        Cruce.reenviar(CTX, "k1:100:5", "Nequi | Nequi | ANA te envió $ 50 000", null, false);
        Cruce.reenviar(CTX, "k2:100:5", "DaviPlata | ¡Recibiste plata! | Recibiste plata usando Llaves", null, false);
        Cruce.reenviar(CTX, "k3:100:5", "DaviPlata | DaviPlata | PEDRO le pasó $33.000", "La app no es la oficial", false);
        for (int i = 0; i < 100 && avisos.size() < 2; i++) Thread.sleep(30);
        Thread.sleep(200);
        chk("6. El aviso sale al servidor de una, con el token y el MISMO id de la página («and-k1:100:5»)", avisos.stream().anyMatch(x -> x.startsWith("/functions/v1/vento-pagos/aviso/" + TOKEN + " ") && x.contains("\"id\":\"and-k1:100:5\"")), avisos);
        chk("6. … con lo que entendió Android («$ 50 000» = 50000)", avisos.stream().anyMatch(x -> x.contains("and-k1") && x.contains("\"monto\":50000")), avisos);
        chk("6. Sin valor no se manda (la página decide); app que no es la oficial → nivel «revisar»", avisos.stream().noneMatch(x -> x.contains("and-k2")) && avisos.stream().anyMatch(x -> x.contains("and-k3") && x.contains("\"nivel\":\"revisar\"")), avisos);

        // 7. Apagar
        Cruce.configurar(CTX, "");
        int n0 = pedidos.size();
        Cruce.revisar(CTX); Thread.sleep(200);
        chk("7. Al cerrar sesión deja de preguntar", pedidos.size() == n0, pedidos.size());
        s.stop(0);
        System.out.println("RESULTADO " + ok + " bien " + mal + " mal");
        System.exit(mal > 0 ? 1 : 0);
    }
}
