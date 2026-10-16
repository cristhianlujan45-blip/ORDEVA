// Prueba de AvisoPago (las reglas de los avisos de pago de la app Android) sin Android:
//   javac -d /tmp/ap android/app/src/main/java/co/vento/app/AvisoPago.java pruebas/java/AvisoPagoPrueba.java && java -cp /tmp/ap co.vento.app.AvisoPagoPrueba
package co.vento.app;

public class AvisoPagoPrueba {
    static int ok = 0, mal = 0;
    static void chk(String n, boolean c, Object x) { if (c) { ok++; System.out.println("✅ " + n); } else { mal++; System.out.println("❌ " + n + " → " + x); } }
    static int maxAbs(byte[] b, int ini, int muestras) { int m = 0; for (int k = 0; k < muestras; k++) m = Math.max(m, Math.abs((short) ((b[ini + k * 2] & 0xff) | ((b[ini + k * 2 + 1] & 0xff) << 8)))); return m; }
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
        // Bre-B (de otros bancos a DaviPlata o Nequi por la llave) y Nequi
        String[][] breb = {
            {"Llegaron $50.000 a tu llave @juan123", "50000"},
            {"¡Te llegó plata por Bre-B! MARIA LOPEZ te envió $35.000", "35000"},
            {"DaviPlata Recibió $80.000 a través de Bre-B de CARLOS RUIZ", "80000"},
            {"Transferencia Bre-B recibida por $120.000 desde Bancolombia", "120000"},
            {"Le llegaron $15.000 a su llave 3001234567", "15000"},
            {"PEDRO GOMEZ te mandó $9.000", "9000"},
            {"Se acreditaron $45.000 en tu cuenta Nequi", "45000"},
            {"¡Te llegó plata! ANA RUIZ te envió $20.000. ¿La guardas en un bolsillo?", "20000"},
            {"Nequi: Recibiste $7.500 de LUIS. ¿Quieres ver tus movimientos?", "7500"},
            {"Ingresó dinero: $60.000 a tu llave Bre-B", "60000"},
        };
        for (String[] r : breb) {
            chk("Bre-B / Nequi: «" + r[0] + "»", AvisoPago.esRecibido(r[0]), r[0]);
            chk("  … valor " + r[1], AvisoPago.monto(r[0]) == Long.parseLong(r[1]), AvisoPago.monto(r[0]));
        }
        String[] pedidos = { "JUAN PEREZ te pidió $20.000", "Recibiste una solicitud de plata de $15.000 de ANA", "Tu transferencia Bre-B de $10.000 fue rechazada",
                "La transferencia de $30.000 no se pudo completar", "Enviaste $50.000 a la llave @maria por Bre-B" };
        for (String n : pedidos) chk("No es plata que llegó: «" + n + "»", !AvisoPago.esRecibido(n), n);
        chk("Sin valor: «¡Te llegó plata! Entra a Nequi para verla» → igual avisa", AvisoPago.esPlataSinValor("Nequi ¡Te llegó plata! Entra a Nequi para verla"), "");
        chk("Sin valor: frase «Llegó plata por Nequi. Mira el valor en la aplicación.»", AvisoPago.fraseSinValor("Nequi").equals("Llegó plata por Nequi. Mira el valor en la aplicación."), AvisoPago.fraseSinValor("Nequi"));
        chk("Sin valor NO toma «Recibiste un mensaje nuevo»", !AvisoPago.esPlataSinValor("Nequi Recibiste un mensaje nuevo"), "");
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
        chk("Frase SMS confiando: «Recibiste 200 pesos por DaviPlata, por mensaje de texto.»", AvisoPago.fraseSms("DaviPlata: Recibió $200", 200, "corto", true).equals("Recibiste 200 pesos por DaviPlata, por mensaje de texto."), AvisoPago.fraseSms("DaviPlata: Recibió $200", 200, "corto", true));
        chk("Frase SMS desde celular: «Ojo… parece falso» aunque se confíe", AvisoPago.fraseSms("Nequi: te llegó $50.000", 50000, "celular", true).startsWith("Ojo."), "");
        chk("Banco: DaviPlata", AvisoPago.esBanco("DaviPlata"), "");
        chk("Banco: Nequi", AvisoPago.esBanco("Nequi"), "");
        chk("No es banco: WhatsApp", !AvisoPago.esBanco("WhatsApp"), "");
        chk("Frase DaviPlata: «Recibiste 200 pesos por DaviPlata.»", AvisoPago.frase("DaviPlata", 200).equals("Recibiste 200 pesos por DaviPlata."), AvisoPago.frase("DaviPlata", 200));
        chk("Frase Nequi: «Recibiste 25000 pesos por Nequi.»", AvisoPago.frase("Nequi", 25000).equals("Recibiste 25000 pesos por Nequi."), AvisoPago.frase("Nequi", 25000));
        chk("Plata: $1.500.000", AvisoPago.plata(1500000).equals("$1.500.000"), AvisoPago.plata(1500000));
        chk("Plata: $200", AvisoPago.plata(200).equals("$200"), AvisoPago.plata(200));
        // Voz de los pagos con volumen PAREJO (antes empezaba bajito y subía)
        int fr = 22050, n = fr;                                         // 1 s de voz: la primera mitad bajita, la segunda alta
        byte[] wav = new byte[44 + n * 2];
        for (int k = 0; k < n; k++) { double amp = k < n / 2 ? 3000 : 12000; int v = (int) (amp * Math.sin(2 * Math.PI * 440 * k / fr));
            wav[44 + k * 2] = (byte) v; wav[45 + k * 2] = (byte) (v >> 8); }
        System.arraycopy("RIFF".getBytes(), 0, wav, 0, 4); System.arraycopy("WAVE".getBytes(), 0, wav, 8, 4); System.arraycopy("fmt ".getBytes(), 0, wav, 12, 4);
        wav[16] = 16; wav[20] = 1; wav[22] = 1; wav[24] = (byte) fr; wav[25] = (byte) (fr >> 8); wav[34] = 16; System.arraycopy("data".getBytes(), 0, wav, 36, 4);
        int dl = n * 2; wav[40] = (byte) dl; wav[41] = (byte) (dl >> 8); wav[42] = (byte) (dl >> 16);
        byte[] p100 = AvisoPago.vozPareja(wav, 100, 400), p150 = AvisoPago.vozPareja(wav, 150, 400);
        int sil = 400 * fr / 1000;
        chk("Voz pareja: sale un WAV válido con 0,4 s de silencio al principio (la salida despierta antes de hablar)", p100 != null && p100.length == 44 + (sil + n) * 2 &&
            new String(p100, 0, 4).equals("RIFF") && new String(p100, 36, 4).equals("data") && maxAbs(p100, 44, sil) == 0, p100 == null ? "null" : p100.length);
        int pico = maxAbs(p100, 44 + sil * 2, n);
        chk("Voz pareja: misma ganancia en TODA la frase (la parte bajita no se sube sola: sin compresor)", Math.abs((double) maxAbs(p100, 44 + sil * 2, n / 2) / maxAbs(p100, 44 + (sil + n / 2) * 2, n / 2) - 0.25) < 0.01,
            maxAbs(p100, 44 + sil * 2, n / 2) + " / " + maxAbs(p100, 44 + (sil + n / 2) * 2, n / 2));
        chk("Voz pareja: 100 % queda al 92 % del máximo (todas las frases al mismo nivel)", Math.abs(pico - 30145) < 60, pico);
        chk("Voz pareja: 150 % suena más fuerte, sin pasarse del tope (sin chasquidos)", p150 != null && maxAbs(p150, 44 + (sil + n / 2) * 2, n / 2) <= 32767 && maxAbs(p150, 44 + sil * 2, n / 2) > maxAbs(p100, 44 + sil * 2, n / 2) * 2, p150 == null ? "null" : maxAbs(p150, 44 + sil * 2, n / 2));
        chk("Voz pareja: si no es un WAV de 16 bits, no se toca (se reproduce como siempre)", AvisoPago.vozPareja("hola".getBytes(), 100, 400) == null && AvisoPago.vozPareja(new byte[60], 100, 400) == null, "");
        // Más formas de DaviPlata, Nequi y la llave Bre-B (antes algunas no sonaban)
        String[][] mas = {
            {"JUAN PEREZ le envió $30.000 a su DaviPlata. Nunca comparta su clave", "30000"},
            {"Te llegaron $12.000 a tu llave 3001234567. No compartas tu clave con nadie", "12000"},
            {"Transferencia entrante por $40.000 desde Banco de Bogotá", "40000"},
            {"Abono recibido $25.000 por Bre-B", "25000"},
            {"Recibiste un pago de $18.000 en tu llave @tienda", "18000"},
            {"Ingreso de $70.000 a tu cuenta de ahorros", "70000"},
            {"Llegó una transferencia de $33.000 a tu Nequi", "33000"},
            {"DaviPlata: Recibio $5.000 de MARIA", "5000"},
            {"Bre-B: recibiste $90.000 de CARLOS en tu llave", "90000"},
        };
        for (String[] r : mas) {
            chk("Pago: «" + r[0] + "»", AvisoPago.esRecibido(r[0]), r[0]);
            chk("  … valor " + r[1], AvisoPago.monto(r[0]) == Long.parseLong(r[1]), AvisoPago.monto(r[0]));
        }
        String[] noMas = { "Enviaste $20.000 a la llave @juan. Nunca compartas tu clave", "Tu código de verificación es 123456. Te llegó por Bre-B", "Usted pagó $10.000. Le enviamos el comprobante" };
        for (String nm : noMas) chk("No es plata recibida: «" + nm + "»", !AvisoPago.esRecibido(nm), nm);
        chk("Voz con Bre-B: «Recibiste 20000 pesos por Bre-B, en Nequi.»", "Recibiste 20000 pesos por Bre-B, en Nequi.".equals(AvisoPago.frase("Nequi", 20000, "Te llegaron $20.000 a tu llave")), AvisoPago.frase("Nequi", 20000, "Te llegaron $20.000 a tu llave"));
        chk("Voz sin Bre-B igual que antes", AvisoPago.frase("DaviPlata", 200, "Le llegó plata $200").equals(AvisoPago.frase("DaviPlata", 200)), "");
        chk("Bancos nuevos: Itaú, Banco Popular, Banco de Bogotá, Pibank, Bold", AvisoPago.esBanco("Itaú") && AvisoPago.esBanco("Banco Popular") && AvisoPago.esBanco("Bogotá App") && AvisoPago.esBanco("Pibank") && AvisoPago.esBanco("Bold"), "");
        chk("Diagnóstico: un aviso de banco con plata que no se tomó se guarda SIN nombres ni números", AvisoPago.pareceDePlata("Movimiento: JUAN PEREZ $20.000 llave") && AvisoPago.sinDatos("Movimiento: JUAN PEREZ $20.000 @juan").equals("Movimiento: NOMBRE $# @llave"), AvisoPago.sinDatos("Movimiento: JUAN PEREZ $20.000 @juan"));
        chk("Diagnóstico: publicidad sin plata no se guarda", !AvisoPago.pareceDePlata("Actualiza tu app de Nequi"), "");
        // Avisos REALES de DaviPlata (capturas del dueño, 15-oct-2026)
        // Plata desde OTRO banco por la llave (1.41.2): se entiende en la app (sin depender de la página, que con la pantalla
        // apagada se demora)
        String[][] otraEntidad = {
            {"Te enviaron $45.000 desde otra entidad a tu DaviPlata", "45000"},
            {"Transferencia interbancaria recibida por $30.000", "30000"},
            {"Tienes un nuevo abono de $12.500 en tu cuenta", "12500"},
            {"Nuevo ingreso por Bre-B: $8.000", "8000"},
            {"Recibiste dinero desde otro banco por $15.000", "15000"} };
        for (String[] x : otraEntidad) chk("Otra entidad: «" + x[0] + "» → $" + x[1], AvisoPago.esRecibido(x[0]) && String.valueOf(AvisoPago.monto(x[0])).equals(x[1]), AvisoPago.esRecibido(x[0]) + " " + AvisoPago.monto(x[0]));
        String[] otraSinValor = { "DaviPlata: tienes un nuevo abono de otra entidad, revisa tus movimientos", "Te llegó dinero de otra entidad por tu llave" };
        for (String x : otraSinValor) chk("Otra entidad sin valor: «" + x + "» → suena «Llegó plata»", AvisoPago.esRecibido(x) && AvisoPago.esPlataSinValor(x), AvisoPago.esRecibido(x) + " " + AvisoPago.esPlataSinValor(x));
        String[] otraNo = { "Enviaste $20.000 a otra entidad", "Transferencia a otro banco por $50.000 rechazada", "Pagaste $10.000 desde tu DaviPlata a otra entidad" };
        for (String x : otraNo) chk("No es plata recibida: «" + x + "»", !AvisoPago.esRecibido(x), x);

        // Nequi real (captura del dueño, 16-oct 1:45 p. m.): título «Envío», el valor SIN $ → antes no sonaba
        String nq = "Envío MARIBE ARIAS te envió 1500, ¡lo mejor!";
        chk("Nequi «MARIBE ARIAS te envió 1500, ¡lo mejor!» (sin $) → $1500", AvisoPago.esRecibido(nq) && AvisoPago.monto(nq) == 1500, AvisoPago.esRecibido(nq) + " " + AvisoPago.monto(nq));
        chk("Nequi «te envió 25,000» → $25000 y «te envió 1.500.000» → $1500000", AvisoPago.monto("JUAN te envió 25,000") == 25000 && AvisoPago.monto("ANA te envió 1.500.000, ¡lo mejor!") == 1500000, AvisoPago.monto("JUAN te envió 25,000"));
        chk("Voz: «Recibiste 1500 pesos por Nequi.»", "Recibiste 1500 pesos por Nequi.".equals(AvisoPago.frase("Nequi", 1500, nq)), AvisoPago.frase("Nequi", 1500, nq));

        String llaves = "DaviPlata | Transaccion exitosa: Recibiste Plata de otra entidad usando Llaves, consulta el detalle de tus movimientos desde el app DaviPlata.";
        chk("DaviPlata por llave (sin valor): es plata recibida y SIN valor → se espera el SMS", AvisoPago.esRecibido(llaves) && AvisoPago.monto(llaves) == 0 && AvisoPago.esPlataSinValor(llaves) && AvisoPago.esBreB(llaves), AvisoPago.monto(llaves));
        String sms1 = "DaviPlata: recibiste  100,000 en tu DaviPlata. Usalos de forma segura para pagar, comprar y mucho mas! Conoce todo lo que puedes hacer en www.daviplata.com";
        chk("SMS 85888 «recibiste  100,000» (sin $): pago de 100000", AvisoPago.esSmsDePago("85888", sms1) && AvisoPago.monto(sms1) == 100000, AvisoPago.monto(sms1));
        String sms2 = "Recibiste  140,000. Para saber mas, consulta tus movimientos.";
        chk("SMS 85888 «Recibiste 140,000.» (sin decir DaviPlata): pago de 140000 de DaviPlata", AvisoPago.esSmsDePago("85888", sms2) && AvisoPago.monto(sms2) == 140000 && "DaviPlata".equals(AvisoPago.bancoDeCodigo("85888")), AvisoPago.monto(sms2));
        chk("…y desde un celular el mismo texto NO es del banco", !AvisoPago.esSmsDePago("3001234567", sms2), "");
        chk("Voz del SMS 85888: «… 140000 pesos desde DaviPlata …»", AvisoPago.fraseSms("85888", sms2, 140000, "corto", false).contains("140000 pesos desde DaviPlata"), AvisoPago.fraseSms("85888", sms2, 140000, "corto", false));
        chk("Voz de la llave con el valor del SMS: «Recibiste 140000 pesos por Bre-B, en DaviPlata.»", "Recibiste 140000 pesos por Bre-B, en DaviPlata.".equals(AvisoPago.frase("DaviPlata", 140000, llaves)), AvisoPago.frase("DaviPlata", 140000, llaves));
        String[] salen = { "DaviPlata | Pasaste $100 a otro DaviPlata. Para saber mas, consulta tus movimientos.", "DaviPlata: Compra exitosa en la Tienda Virtual por  20,000. Para saber mas, consulta tus movimientos" };
        for (String x : salen) chk("Plata que SALE no es pago: «" + x + "»", !AvisoPago.esRecibido(x) && !AvisoPago.esSmsDePago("85888", x), x);
        chk("Valores sin signo pequeños: «Recibiste 100 pesos» → 100; «recibiste 1000» → 1000", AvisoPago.monto("Recibiste 100 pesos") == 100 && AvisoPago.monto("DaviPlata: recibiste 1000 en tu DaviPlata") == 1000, AvisoPago.monto("Recibiste 100 pesos"));
        chk("Un número de celular no es el valor («Recibiste plata de 3001234567»)", AvisoPago.monto("Recibiste plata de 3001234567") == 0, AvisoPago.monto("Recibiste plata de 3001234567"));
        // Un pago con «código de aprobación» o «código de confirmación» SÍ es pago (antes se descartaba)
        String[] conCodigo = { "DaviPlata: Recibiste $50.000 de JUAN. Codigo de aprobacion 604107", "Te llegó plata: ANA te envió $8.000. Código de confirmación: 123987" };
        for (String x : conCodigo) chk("Pago con código de aprobación: «" + x + "»", AvisoPago.esRecibido(x), x);
        chk("Por qué no: «Pasaste $100…» → plata que SALE", AvisoPago.porQueNo("Pasaste $100 a otro DaviPlata").contains("SALE"), AvisoPago.porQueNo("Pasaste $100 a otro DaviPlata"));
        chk("Por qué no: publicidad", AvisoPago.porQueNo("¿Te llegó la prima? Guárdala").contains("publicidad"), AvisoPago.porQueNo("¿Te llegó la prima? Guárdala"));
        System.out.println("RESULTADO " + ok + " bien " + mal + " mal");
        System.exit(mal > 0 ? 1 : 0);
    }
}
