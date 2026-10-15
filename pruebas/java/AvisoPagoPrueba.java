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
        // Publicidad del banco que parece pago: NO es plata que llegó
        String[] promos = { "¿Te llegó la prima? Guárdala en un colchón de Nequi", "Te prestamos hasta $5.000.000 con tu DaviPlata, ¡te llegó la oportunidad!",
                "Le llegó un crédito pre aprobado por $2.000.000", "Te llegó un descuento de $10.000 en tu próxima compra", "¡Te llegó la oferta! Recibe cashback de $5.000" };
        for (String n : promos) chk("Publicidad, no es pago: «" + n + "»", !AvisoPago.esRecibido(n), n);
        chk("Valor con COP: «Recibiste COP 45.000 de ANA» → 45000", AvisoPago.esRecibido("Recibiste COP 45.000 de ANA") && AvisoPago.monto("Recibiste COP 45.000 de ANA") == 45000, AvisoPago.monto("Recibiste COP 45.000 de ANA"));
        chk("Plata a un bolsillo de Nequi sigue siendo pago: «Te llegó plata: $9.000 a tu bolsillo»", AvisoPago.esRecibido("Te llegó plata: $9.000 a tu bolsillo"), "");
        // ¿La app es la de verdad?
        chk("DaviPlata oficial (com.davivienda.daviplataapp) → confiable", AvisoPago.confiable("com.davivienda.daviplataapp", null, false), "");
        chk("Nequi oficial (com.nequi.MobileApp) → confiable", AvisoPago.confiable("com.nequi.MobileApp", null, false), "");
        chk("App de banco instalada desde Play Store → confiable", AvisoPago.confiable("co.banco.nuevo", "com.android.vending", false), "");
        chk("App «DaviPlata» instalada por fuera (APK suelto) → NO confiable", !AvisoPago.confiable("com.falsa.daviplata", "com.google.android.packageinstaller", false), "");
        chk("App «DaviPlata» sin instalador → NO confiable", !AvisoPago.confiable("com.falsa.daviplata", null, false), "");
        chk("App del celular (sistema) → confiable", AvisoPago.confiable("com.samsung.pay", null, true), "");
        // Volumen
        chk("Volumen: sin elegir = 100 %", AvisoPago.volumen(0) == 100, AvisoPago.volumen(0));
        chk("Volumen: entre 10 y 150 %", AvisoPago.volumen(5) == 10 && AvisoPago.volumen(400) == 150, AvisoPago.volumen(400));
        chk("Volumen 50 % de 7 niveles → nivel 4", AvisoPago.nivel(50, 7) == 4, AvisoPago.nivel(50, 7));
        chk("Volumen 100 % y 150 % → nivel máximo", AvisoPago.nivel(100, 7) == 7 && AvisoPago.nivel(150, 7) == 7, AvisoPago.nivel(150, 7));
        chk("Volumen 10 % → al menos nivel 1 (nunca mudo)", AvisoPago.nivel(10, 7) == 1, AvisoPago.nivel(10, 7));
        chk("Refuerzo: 100 % = nada; 150 % = +12 dB (más fuerte de lo normal)", AvisoPago.refuerzo(100) == 0 && AvisoPago.refuerzo(150) == 1200 && AvisoPago.refuerzo(120) == 480, AvisoPago.refuerzo(150));
        // SMS del banco
        chk("App de SMS: Mensajes de Google", AvisoPago.esAppSms("com.google.android.apps.messaging", null), "");
        chk("App de SMS: la de SMS por defecto del celular", AvisoPago.esAppSms("com.xiaomi.otra", "com.xiaomi.otra"), "");
        chk("WhatsApp no es app de SMS", !AvisoPago.esAppSms("com.whatsapp", "com.google.android.apps.messaging"), "");
        chk("SMS de pago: «DaviPlata: Le llegó plata. Recibió $200 de JUAN»", AvisoPago.esSmsDePago("85888", "DaviPlata: Le llegó plata. Recibió $200 de JUAN"), "");
        chk("SMS de pago desde «Nequi» (contacto guardado): «Te llegó plata $15.000»", AvisoPago.esSmsDePago("Nequi", "¡Te llegó plata! ANA te envió $15.000"), "");
        chk("SMS personal (sin banco) NO se toma: «Te envié $20.000 de lo del almuerzo»", !AvisoPago.esSmsDePago("Mamá", "Te llegaron los $20.000 de lo del almuerzo?"), "");
        chk("SMS de código NO se toma", !AvisoPago.esSmsDePago("85888", "DaviPlata: su clave para recibir $5.000 es 4455"), "");
        chk("Remitente celular (3001234567) → «celular» (falso)", AvisoPago.tipoRemitente("+57 300 123 4567").equals("celular"), AvisoPago.tipoRemitente("+57 300 123 4567"));
        chk("Remitente código corto (85888) → «corto»", AvisoPago.tipoRemitente("85888").equals("corto"), "");
        chk("Frase SMS sin confiar: «Llegó un mensaje de texto de 200 pesos desde DaviPlata. Revísalo…»", AvisoPago.fraseSms("DaviPlata: Recibió $200", 200, "corto", false).startsWith("Llegó un mensaje de texto de 200 pesos desde DaviPlata. Revísalo"), AvisoPago.fraseSms("DaviPlata: Recibió $200", 200, "corto", false));
        chk("Frase SMS confiando: «Pago confirmado. 200 pesos desde DaviPlata, por mensaje de texto.»", AvisoPago.fraseSms("DaviPlata: Recibió $200", 200, "corto", true).equals("Pago confirmado. 200 pesos desde DaviPlata, por mensaje de texto."), AvisoPago.fraseSms("DaviPlata: Recibió $200", 200, "corto", true));
        chk("Frase SMS desde celular: «Ojo… parece falso» aunque se confíe", AvisoPago.fraseSms("Nequi: te llegó $50.000", 50000, "celular", true).startsWith("Ojo."), "");
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
