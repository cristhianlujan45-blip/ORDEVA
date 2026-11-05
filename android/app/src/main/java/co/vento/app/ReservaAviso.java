package co.vento.app;

/** 🏨 ORDEVA 1.77.0 · Avisos de las apps de reservas (Booking.com Pulse, Airbnb, Expedia, Vrbo, Hostelworld…).
 *  Booking y Airbnb no dejan que ORDEVA lea sus reservas directo; su app SÍ avisa en el celular del dueño apenas alguien
 *  reserva («Nueva reserva de Juan Pérez, 5–7 nov, 2 huéspedes»). VentoEscucha toma ese aviso (con el mismo permiso de
 *  «Acceso a notificaciones» de los pagos) y la página lo convierte en la reserva, con el nombre del huésped.
 *  Aquí solo se decide si un aviso es de una app de reservas (sin Android: se prueba en pruebas/java/ReservaAvisoPrueba). */
final class ReservaAviso {
    private ReservaAviso() { }

    /** La plataforma del aviso («Booking», «Airbnb»…) o null si no es de una app de reservas. */
    static String fuente(String pkg, String app) {
        String p = pkg == null ? "" : pkg.toLowerCase(java.util.Locale.ROOT), a = app == null ? "" : app.toLowerCase(java.util.Locale.ROOT);
        if (p.equals("com.booking")) return null;                       // la app de viajes (el dueño reservando para él), no la de su hotel
        if (p.equals("com.booking.hotelmanager") || p.startsWith("com.booking.pulse") || a.contains("booking.com pulse") || a.contains("booking partner")) return "Booking";
        if (p.equals("com.airbnb.android") || p.startsWith("com.airbnb.") || a.contains("airbnb")) return "Airbnb";
        if (p.startsWith("com.expedia.partner") || a.contains("partner central") || a.contains("expedia partner")) return "Expedia";
        if (p.startsWith("com.vrbo") || p.startsWith("com.homeaway") || a.contains("vrbo")) return "Vrbo";
        if (p.startsWith("com.hostelworld") || a.contains("hostelworld")) return "Hostelworld";
        if (p.startsWith("com.despegar") && a.contains("socio")) return "Despegar";
        if (p.startsWith("com.agoda.ycs") || a.contains("agoda ycs")) return "Agoda";
        if (p.startsWith("com.lodgify") || a.contains("lodgify")) return "Lodgify";
        if (p.startsWith("com.cloudbeds") || a.contains("cloudbeds")) return "Cloudbeds";
        return null;
    }

    /** ¿Habla de una reserva? (no de promociones, mensajes de marketing ni recordatorios de la app). */
    static boolean pareceReserva(String txt) {
        String t = txt == null ? "" : txt.toLowerCase(java.util.Locale.ROOT);
        return t.matches("(?s).*(reserva|reservation|booking|booked|reservó|reservo|cancel|llega|arriv|check-in|check in|huésped|huesped|guest|solicitud de|request to book|estadía|estadia|stay).*");
    }
}
