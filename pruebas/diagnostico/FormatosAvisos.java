// Diagnóstico (solo lectura, lo usa .github/workflows/diagnostico-formatos.yml): pasa los avisos de banco que ORDEVA no
// entendió (ya vienen SIN nombres ni números: «NOMBRE te envió $#») por las MISMAS reglas de la app Android (AvisoPago) y
// dice, sin mostrar el texto, qué palabras clave traen y por qué no se tomaron. Así se sabe si se escapó un pago de verdad.
package co.vento.app;

import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.*;
import java.util.regex.Pattern;

public class FormatosAvisos {
    static final String[][] CLAVES = {
        {"valor", "\\$\\s?#|#\\s*pesos|cop\\s?#"}, {"recib", "recib"}, {"llego", "lleg[oó]|llegaron"}, {"envio", "envi[oó]|enviaron|te mand"},
        {"paso", "pas[oó] plata|te pas[oó]|le pas[oó]"}, {"transf", "transfiri|transferencia"}, {"consign", "consign|dep[oó]sit"}, {"abono", "abon"},
        {"ingreso", "ingres"}, {"acredit", "acredit"}, {"llave", "llave|bre-?b|@llave"}, {"codigo", "c[oó]digo|clave|otp"}, {"compra", "compra|pagaste|enviaste|retir|pasaste"},
        {"recarga", "recarg"}, {"promo", "gana|premio|promo|descuento|cashback|oferta|invita|tasa|cr[eé]dito|pr[eé]stamo|cuota|meta|bolsillo|colch[oó]n"}, {"solicitud", "solicit|pedido|cobr|rechaz|program"}
    };
    public static void main(String[] a) throws Exception {
        List<String> l = Files.readAllLines(Paths.get(a[0]));
        Map<String, Integer> cuenta = new LinkedHashMap<>();
        for (String linea : l) { if (linea.trim().isEmpty()) continue; cuenta.merge(linea, 1, Integer::sum); }
        int n = 0, posibles = 0;
        for (Map.Entry<String, Integer> e : cuenta.entrySet()) {
            String[] p = e.getKey().split("\t", 2); String app = p[0], txt = p.length > 1 ? p[1] : "";
            String todo = app + " | " + txt, low = todo.toLowerCase();
            List<String> f = new ArrayList<>();
            for (String[] c : CLAVES) if (Pattern.compile(c[1], Pattern.CASE_INSENSITIVE).matcher(low).find()) f.add(c[0]);
            boolean pareceRecibido = (f.contains("recib") || f.contains("llego") || f.contains("envio") || f.contains("paso") || f.contains("transf") || f.contains("consign") || f.contains("ingreso") || f.contains("acredit"))
                    && f.contains("valor") && !f.contains("compra") && !f.contains("codigo") && !f.contains("promo") && !f.contains("solicitud") && !f.contains("recarga");
            if (pareceRecibido) posibles++;
            System.out.println((pareceRecibido ? "⚠️ POSIBLE PAGO " : "· ") + "app=" + app.replaceAll("[^\\p{L} ]", "").trim() + " veces=" + e.getValue() + " largo=" + txt.length()
                    + " claves=" + f + " reglas=" + (AvisoPago.esRecibido(todo) ? "recibido" : "no: " + AvisoPago.porQueNo(todo)));
            n++;
        }
        System.out.println("FORMATOS " + n + " distintos · posibles pagos que no se tomaron: " + posibles);
    }
}
