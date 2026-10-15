// Prueba de AvisoPago (las reglas de los avisos de pago de la app Android) sin Android:
//   javac -d /tmp/ap android/app/src/main/java/co/vento/app/AvisoPago.java pruebas/java/AvisoPagoPrueba.java && java -cp /tmp/ap co.vento.app.AvisoPagoPrueba
package co.vento.app;

public class AvisoPagoPrueba {
    static int ok = 0, mal = 0;
    static void chk(String n, boolean c, Object x) { if (c) { ok++; System.out.println("✅ " + n); } else { mal++; System.out.println("❌ " + n + " → " + x); } }
    public static void main(String[] a) {
        String[][] recibidos = {
            {"¡Le llegó plata! MARIA LOPEZ le pasó $200 a su DaviPlata", "200"},
            {"¡Te llegó plata! JUAN PEREZ te envió $25.000", "25000"},
            {"DaviPlata Recibió $15.000 de CARLOS RUIZ", "15000"},
            {"Movimiento Ha recibido una transferencia por $8.500,00", "8500"},
            {"Nequi Recibiste $1.500.000 de ANA", "1500000"},
            {"Bancolombia Recibiste 30.000 pesos de LUIS", "30000"},
            {"¡Le pasaron plata! Le enviaron $200,00 a su DaviPlata", "200"},
        };
        for (String[] r : recibidos) {
            chk("Plata recibida: «" + r[0] + "»", AvisoPago.esRecibido(r[0]), r[0]);
            chk("  … valor " + r[1], AvisoPago.monto(r[0]) == Long.parseLong(r[1]), AvisoPago.monto(r[0]));
        }
        String[] noSon = { "Usted pasó $10.000 a JUAN PEREZ", "Su código de seguridad es 123456 para recibir $5.000", "Compraste $20.000 en Tienda", "Enviaste $50.000 a MARIA", "Tu clave dinámica es 4455" };
        for (String n : noSon) chk("No es plata recibida: «" + n + "»", !AvisoPago.esRecibido(n), n);
        chk("Banco: DaviPlata", AvisoPago.esBanco("DaviPlata"), "");
        chk("Banco: Nequi", AvisoPago.esBanco("Nequi"), "");
        chk("No es banco: WhatsApp", !AvisoPago.esBanco("WhatsApp"), "");
        chk("Frase DaviPlata: «Pago confirmado. 200 pesos desde DaviPlata.»", AvisoPago.frase("DaviPlata", 200).equals("Pago confirmado. 200 pesos desde DaviPlata."), AvisoPago.frase("DaviPlata", 200));
        chk("Frase Nequi: «Pago confirmado. 25000 pesos desde Nequi.»", AvisoPago.frase("Nequi", 25000).equals("Pago confirmado. 25000 pesos desde Nequi."), AvisoPago.frase("Nequi", 25000));
        chk("Plata: $1.500.000", AvisoPago.plata(1500000).equals("$1.500.000"), AvisoPago.plata(1500000));
        chk("Plata: $200", AvisoPago.plata(200).equals("$200"), AvisoPago.plata(200));
        System.out.println("RESULTADO " + ok + " bien " + mal + " mal");
        System.exit(mal > 0 ? 1 : 0);
    }
}
