package co.vento.app;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;

/**
 * ⚡ 1.65.3 · El aviso de un pago AL INSTANTE en todos los celulares del negocio (también bloqueados).
 * Antes cada celular preguntaba cada 2,5 s (Cruce.revisar): entre un celular y otro había hasta 2,5 s más la red. Ahora el
 * servicio de fondo deja abierta una conexión en vivo (Supabase Realtime, el mismo de los canales de la página) al canal
 * secreto del negocio «vp-…»; el servidor avisa por ahí apenas un pago queda aprobado y aquí se pregunta en ese instante.
 * El aviso no trae datos del pago: el pago se pide con el token del celular, como siempre. La pregunta cada 2,5 s sigue de
 * respaldo (si se cae esta conexión, nada se pierde).
 * Java puro (sin Android) para probarlo sin el celular: pruebas/java/EnVivoPrueba.java.
 */
final class EnVivo {
    interface Oyente { void aviso(); }

    private final String url, key, topic;
    private final Oyente oyente;
    private volatile boolean vivo = true;
    private volatile Socket socket;
    private volatile boolean unido = false;
    private Thread hilo;
    private int ref = 0;
    static volatile long latidoMs = 25_000;          // Phoenix pide un latido cada 30 s como mucho

    EnVivo(String url, String key, String topic, Oyente oyente) {
        this.url = url.replaceAll("/+$", ""); this.key = key; this.topic = topic; this.oyente = oyente;
    }
    String topic() { return topic; }
    boolean unido() { return unido; }

    void iniciar() {
        hilo = new Thread(this::bucle, "ordeva-envivo");
        hilo.setDaemon(true);
        hilo.start();
    }

    void parar() {
        vivo = false;
        try { Socket s = socket; if (s != null) s.close(); } catch (IOException ignorado) { }
        if (hilo != null) hilo.interrupt();
    }

    private void bucle() {
        int espera = 1000;
        while (vivo) {
            try {
                conectar();
                espera = 1000;                        // se conectó: el próximo corte vuelve a intentar de una
            } catch (Throwable e) {
                // se cortó o no hubo internet: se vuelve a conectar (1 s, 2 s, 4 s… hasta 30 s)
            }
            unido = false;
            if (!vivo) break;
            try { Thread.sleep(espera); } catch (InterruptedException e) { if (!vivo) break; }
            espera = Math.min(30_000, espera * 2);
        }
    }

    private void conectar() throws IOException {
        URI u = URI.create(url);
        boolean seguro = "https".equals(u.getScheme()) || "wss".equals(u.getScheme());
        String host = u.getHost();
        int puerto = u.getPort() > 0 ? u.getPort() : (seguro ? 443 : 80);
        Socket s = new Socket();
        s.connect(new InetSocketAddress(host, puerto), 10_000);
        if (seguro) {
            javax.net.ssl.SSLSocket ss = (javax.net.ssl.SSLSocket) ((javax.net.ssl.SSLSocketFactory) javax.net.ssl.SSLSocketFactory.getDefault()).createSocket(s, host, puerto, true);
            ss.startHandshake();
            // El certificado tiene que ser del servidor de ORDEVA (un SSLSocket solo no revisa el nombre).
            if (!javax.net.ssl.HttpsURLConnection.getDefaultHostnameVerifier().verify(host, ss.getSession())) {
                ss.close();
                throw new IOException("certificado de otro servidor");
            }
            s = ss;
        }
        socket = s;
        try {
            s.setTcpNoDelay(true);
            s.setSoTimeout((int) Math.max(200, Math.min(5_000, latidoMs / 2)));   // así se manda el latido a tiempo aunque no llegue nada
            OutputStream out = s.getOutputStream();
            InputStream in = s.getInputStream();
            byte[] k = new byte[16]; new SecureRandom().nextBytes(k);
            String pedido = "GET /realtime/v1/websocket?apikey=" + enc(key) + "&vsn=1.0.0 HTTP/1.1\r\n"
                    + "Host: " + host + (u.getPort() > 0 ? ":" + puerto : "") + "\r\n"
                    + "Upgrade: websocket\r\nConnection: Upgrade\r\n"
                    + "Sec-WebSocket-Key: " + base64(k) + "\r\nSec-WebSocket-Version: 13\r\n\r\n";
            out.write(pedido.getBytes(StandardCharsets.UTF_8)); out.flush();
            String cab = leerCabecera(in);
            if (!cab.startsWith("HTTP/1.1 101")) throw new IOException("no aceptó la conexión en vivo: " + cab.split("\r\n")[0]);
            enviar(out, "{\"topic\":\"realtime:" + topic + "\",\"event\":\"phx_join\",\"payload\":{\"config\":{\"broadcast\":{\"self\":false,\"ack\":false},"
                    + "\"presence\":{\"key\":\"\"},\"private\":false},\"access_token\":\"" + key + "\"},\"ref\":\"" + (++ref) + "\"}");
            long ultimoLatido = System.currentTimeMillis();
            ByteArrayOutputStream partes = new ByteArrayOutputStream();
            while (vivo) {
                if (System.currentTimeMillis() - ultimoLatido >= latidoMs) {
                    enviar(out, "{\"topic\":\"phoenix\",\"event\":\"heartbeat\",\"payload\":{},\"ref\":\"" + (++ref) + "\"}");
                    ultimoLatido = System.currentTimeMillis();
                }
                int b0;
                try { b0 = in.read(); } catch (java.net.SocketTimeoutException t) { continue; }
                if (b0 < 0) throw new IOException("se cerró");
                int op = b0 & 0x0f; boolean fin = (b0 & 0x80) != 0;
                int b1 = leer(in); long n = b1 & 0x7f;
                if (n == 126) n = (leer(in) << 8) | leer(in);
                else if (n == 127) { n = 0; for (int i = 0; i < 8; i++) n = (n << 8) | leer(in); }
                if (n > 1 << 20) throw new IOException("mensaje demasiado grande");
                byte[] m = null;
                if ((b1 & 0x80) != 0) { m = new byte[4]; leerTodo(in, m); }
                byte[] datos = new byte[(int) n]; leerTodo(in, datos);
                if (m != null) for (int i = 0; i < datos.length; i++) datos[i] ^= m[i % 4];
                if (op == 0x8) throw new IOException("el servidor cerró");
                if (op == 0x9) { marco(out, 0xA, datos); continue; }        // ping → pong
                if (op == 0xA) continue;
                if (op == 0x1 || op == 0x0) {
                    partes.write(datos);
                    if (!fin) continue;
                    String txt = new String(partes.toByteArray(), StandardCharsets.UTF_8);
                    partes.reset();
                    recibido(txt);
                }
            }
        } finally {
            try { s.close(); } catch (IOException ignorado) { }
            socket = null;
        }
    }

    private void recibido(String txt) {
        if (txt.contains("\"event\":\"phx_reply\"") && txt.contains("realtime:" + topic) && txt.contains("\"status\":\"ok\"")) {
            boolean primera = !unido;
            unido = true;
            // Recién conectado: se pregunta una vez por si llegó algo mientras no había conexión.
            if (primera) avisar();
            return;
        }
        if (txt.contains("\"event\":\"broadcast\"") && txt.contains("realtime:" + topic)) avisar();
    }
    private void avisar() { try { oyente.aviso(); } catch (Throwable ignorado) { } }

    private synchronized void enviar(OutputStream out, String txt) throws IOException { marco(out, 0x1, txt.getBytes(StandardCharsets.UTF_8)); }
    // Marco WebSocket del cliente (siempre enmascarado).
    private synchronized void marco(OutputStream out, int op, byte[] datos) throws IOException {
        ByteArrayOutputStream b = new ByteArrayOutputStream();
        b.write(0x80 | op);
        int n = datos.length;
        if (n < 126) b.write(0x80 | n);
        else if (n < 65536) { b.write(0x80 | 126); b.write(n >> 8); b.write(n & 0xff); }
        else { b.write(0x80 | 127); for (int i = 7; i >= 0; i--) b.write((int) ((long) n >> (8 * i)) & 0xff); }
        byte[] m = new byte[4]; new SecureRandom().nextBytes(m);
        b.write(m);
        for (int i = 0; i < n; i++) b.write(datos[i] ^ m[i % 4]);
        out.write(b.toByteArray()); out.flush();
    }

    private static int leer(InputStream in) throws IOException {
        while (true) {
            try { int x = in.read(); if (x < 0) throw new IOException("se cerró"); return x; }
            catch (java.net.SocketTimeoutException t) { /* a mitad de un mensaje: se sigue esperando */ }
        }
    }
    private static void leerTodo(InputStream in, byte[] b) throws IOException {
        int k = 0;
        while (k < b.length) {
            try { int r = in.read(b, k, b.length - k); if (r < 0) throw new IOException("se cerró"); k += r; }
            catch (java.net.SocketTimeoutException t) { /* sigue */ }
        }
    }
    private static String leerCabecera(InputStream in) throws IOException {
        StringBuilder b = new StringBuilder();
        while (b.length() < 8192) {
            int c = leer(in);
            b.append((char) c);
            if (b.length() >= 4 && b.substring(b.length() - 4).equals("\r\n\r\n")) return b.toString();
        }
        throw new IOException("cabecera muy larga");
    }
    private static String enc(String s) {
        try { return java.net.URLEncoder.encode(s, "UTF-8"); } catch (Exception e) { return s; }
    }
    private static final char[] B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".toCharArray();
    static String base64(byte[] d) {
        StringBuilder b = new StringBuilder();
        for (int i = 0; i < d.length; i += 3) {
            int n = (d[i] & 0xff) << 16 | (i + 1 < d.length ? (d[i + 1] & 0xff) << 8 : 0) | (i + 2 < d.length ? d[i + 2] & 0xff : 0);
            b.append(B64[n >> 18 & 63]).append(B64[n >> 12 & 63]).append(i + 1 < d.length ? B64[n >> 6 & 63] : '=').append(i + 2 < d.length ? B64[n & 63] : '=');
        }
        return b.toString();
    }
}
