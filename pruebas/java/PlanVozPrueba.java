// Por dónde sale la voz de cada pago en CADA tipo de celular y tablet (PlanVoz), sin celular: todas las combinaciones de
// marca/motor de voz, volumen y parlante. Regla (1.50.0): sin parlante, la voz SIEMPRE sale directo, en todas las marcas y
// con cualquier volumen (el refuerzo de más de 100 % va sobre la voz en vivo); grabar a archivo (lo frágil) solo para el
// parlante de avisos.
package co.vento.app;

public class PlanVozPrueba {
    static int ok = 0, mal = 0;
    static void chk(String n, boolean c, Object x) { if (c) { ok++; System.out.println("✅ " + n); } else { mal++; System.out.println("❌ " + n + " → " + x); } }

    public static void main(String[] a) {
        // [marca o equipo, motor de voz que trae]
        String[][] equipos = {
            {"Samsung (Galaxy A/S, Tab)", "com.samsung.SMT"}, {"Samsung con voz de Google", "com.google.android.tts"},
            {"Xiaomi / Redmi / POCO", "com.xiaomi.mibrain.speech"}, {"Xiaomi con voz de Google", "com.google.android.tts"},
            {"Motorola", "com.google.android.tts"}, {"Huawei / Honor", "com.huawei.hiai"}, {"OPPO / Realme / OnePlus", "com.heytap.speechassist"},
            {"Vivo", "com.vivo.aiengine"}, {"Tecno / Infinix", "com.transsion.tts"}, {"Tablet Lenovo", "com.google.android.tts"},
            {"Tablet Amazon Fire", "com.ivona.tts"}, {"Motor desconocido", "otra.voz"}, {"Sin motor (no se sabe)", null}};
        int[] volumenes = {10, 50, 100, 110, 120, 150};
        int combos = 0;
        for (String[] e : equipos) {
            boolean todoBien = true;
            for (int v : volumenes) for (boolean parlante : new boolean[]{true, false}) {
                combos++;
                String c = PlanVoz.camino(parlante, v, e[1]);
                boolean esperado;
                if (parlante) esperado = "parlante".equals(c);
                else esperado = "directo".equals(c);
                if (!esperado || !(c.equals("parlante") || c.equals("archivo") || c.equals("directo"))) { todoBien = false; chk(e[0] + " · volumen " + v + "% · parlante " + parlante + " → " + c, false, c); }
            }
            if (todoBien) chk(e[0] + ": la voz siempre tiene por dónde salir (12 combinaciones de volumen y parlante)", true, null);
        }
        chk("Xiaomi con su motor y volumen 150 %: habla DIRECTO (antes grababa a archivo y a veces no sonaba)", "directo".equals(PlanVoz.camino(false, 150, "com.xiaomi.mibrain.speech")), PlanVoz.camino(false, 150, "com.xiaomi.mibrain.speech"));
        chk("Samsung y voz de Google con 130 % o 150 %: también DIRECTO (en la 1.49.0 grababan a archivo y en varios celulares no sonaba)", "directo".equals(PlanVoz.camino(false, 150, "com.samsung.SMT")) && "directo".equals(PlanVoz.camino(false, 130, "com.google.android.tts")), "");
        chk("Volumen 100 % o menos: directo en todas las marcas (lo que siempre funcionó)", "directo".equals(PlanVoz.camino(false, 100, "com.google.android.tts")) && "directo".equals(PlanVoz.camino(false, 100, "com.xiaomi.mibrain.speech")), "");
        chk("Total: " + combos + " combinaciones de celular/tablet, volumen y parlante revisadas", combos == equipos.length * volumenes.length * 2, combos);
        System.out.println("RESULTADO " + ok + " bien " + mal + " mal");
        System.exit(mal > 0 ? 1 : 0);
    }
}
