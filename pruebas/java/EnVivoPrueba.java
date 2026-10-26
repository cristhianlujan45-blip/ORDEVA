package co.vento.app;

/** Corre el cliente en vivo contra el servidor de prueba de pruebas/javaenvivo.test.js: imprime «AVISO» cada vez que avisa. */
public class EnVivoPrueba {
    public static void main(String[] a) throws Exception {
        EnVivo.latidoMs = 400;
        final long t0 = System.currentTimeMillis();
        EnVivo v = new EnVivo("http://127.0.0.1:" + a[0], "llave-publica", a[1], () -> { System.out.println("AVISO " + (System.currentTimeMillis() - t0)); System.out.flush(); });
        v.iniciar();
        Thread.sleep(Long.parseLong(a[2]));
        v.parar();
        System.out.println("FIN"); System.out.flush();
    }
}
