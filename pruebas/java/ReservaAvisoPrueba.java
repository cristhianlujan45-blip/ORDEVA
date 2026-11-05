package co.vento.app;

/** 🏨 1.77.0 · Qué avisos son de una app de reservas (ReservaAviso), sin celular. */
public class ReservaAvisoPrueba {
    static int ok = 0, mal = 0;
    static void chk(String n, boolean c) { if (c) { ok++; System.out.println("✅ " + n); } else { mal++; System.out.println("❌ " + n); } }
    public static void main(String[] a) {
        chk("Booking.com Pulse es Booking", "Booking".equals(ReservaAviso.fuente("com.booking.hotelmanager", "Pulse")));
        chk("La app de Airbnb es Airbnb", "Airbnb".equals(ReservaAviso.fuente("com.airbnb.android", "Airbnb")));
        chk("La app de viajes de Booking (com.booking) NO es del hotel", ReservaAviso.fuente("com.booking", "Booking.com") == null);
        chk("Expedia Partner Central es Expedia", "Expedia".equals(ReservaAviso.fuente("com.expedia.partnercentral", "Partner Central")));
        chk("Por el nombre de la app: «Hostelworld Inbox»", "Hostelworld".equals(ReservaAviso.fuente("x.y", "Hostelworld Inbox")));
        chk("Nequi no es una app de reservas", ReservaAviso.fuente("com.nequi.MobileApp", "Nequi") == null);
        chk("WhatsApp no es una app de reservas", ReservaAviso.fuente("com.whatsapp", "WhatsApp") == null);
        chk("«¡Nueva reserva! Juan Pérez…» parece reserva", ReservaAviso.pareceReserva("¡Nueva reserva!\nJuan Pérez reservó del 5 al 7 de noviembre"));
        chk("«New booking from John» parece reserva", ReservaAviso.pareceReserva("New booking from John Smith"));
        chk("«Reserva cancelada» parece reserva", ReservaAviso.pareceReserva("Reserva cancelada"));
        chk("Una promoción no parece reserva", !ReservaAviso.pareceReserva("Mejora tu perfil y gana más visibilidad"));
        System.out.println("RESULTADO " + ok + " bien " + mal + " mal");
    }
}
