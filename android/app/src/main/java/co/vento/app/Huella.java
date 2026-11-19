package co.vento.app;

import android.app.Activity;
import android.content.Context;
import android.content.pm.PackageManager;
import android.hardware.biometrics.BiometricManager;
import android.hardware.biometrics.BiometricPrompt;
import android.os.Build;
import android.os.CancellationSignal;

/**
 * 👆 ORDEVA 1.99.17 · Entrar con la huella (o la cara) del celular.
 * La página (lib/vento-huella.js) pregunta si el celular tiene huella guardada (estado) y pide la huella (pedir); la
 * respuesta vuelve a la página con window.__ventoHuellaRespuesta(id, ok, motivo). Android solo dice «es el dueño de
 * una huella de este celular» o no: no se guarda ninguna huella ni contraseña aquí.
 * Desde Android 9 (API 28). En los más viejos dice «no-soporta» y se entra con la contraseña, como siempre.
 */
final class Huella {
    private Huella() { }

    /** "ok" (tiene huella o cara guardada), "sin-huella" (el lector existe pero no hay ninguna) o "no-soporta". */
    static String estado(Context c) {
        try {
            if (c == null || Build.VERSION.SDK_INT < 28) return "no-soporta";
            if (Build.VERSION.SDK_INT >= 30) {
                BiometricManager bm = c.getSystemService(BiometricManager.class);
                return bm == null ? "no-soporta" : traducir(bm.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_WEAK));
            }
            if (Build.VERSION.SDK_INT == 29) {
                BiometricManager bm = c.getSystemService(BiometricManager.class);
                return bm == null ? "no-soporta" : traducir(bm.canAuthenticate());
            }
            // Android 9: solo hay lector de huellas (FingerprintManager).
            if (!c.getPackageManager().hasSystemFeature(PackageManager.FEATURE_FINGERPRINT)) return "no-soporta";
            @SuppressWarnings("deprecation")
            android.hardware.fingerprint.FingerprintManager fm = c.getSystemService(android.hardware.fingerprint.FingerprintManager.class);
            if (fm == null || !fm.isHardwareDetected()) return "no-soporta";
            return fm.hasEnrolledFingerprints() ? "ok" : "sin-huella";
        } catch (Throwable e) {
            return "no-soporta";
        }
    }

    private static String traducir(int r) {
        if (r == BiometricManager.BIOMETRIC_SUCCESS) return "ok";
        if (r == BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED) return "sin-huella";
        return "no-soporta";
    }

    /** Muestra la ventana de Android «Pon tu huella». Siempre en el hilo principal (VentoApp.ui). */
    static void pedir(final String id, String titulo, String subtitulo) {
        final Activity a = VentoApp.ventana;
        if (Build.VERSION.SDK_INT < 28) { responder(id, false, "no-soporta"); return; }
        if (a == null || a.isFinishing()) { responder(id, false, "sin-ventana"); return; }
        try {
            BiometricPrompt.Builder b = new BiometricPrompt.Builder(a)
                    .setTitle(titulo == null || titulo.isEmpty() ? "Entrar a ORDEVA" : titulo)
                    .setNegativeButton("Usar contraseña", a.getMainExecutor(), (d, w) -> responder(id, false, "cancelado"));
            if (subtitulo != null && !subtitulo.isEmpty()) b.setSubtitle(subtitulo);
            if (Build.VERSION.SDK_INT >= 30) b.setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_WEAK);
            if (Build.VERSION.SDK_INT >= 29) b.setConfirmationRequired(false);   // con la cara: entra sin tocar «Confirmar»
            b.build().authenticate(new CancellationSignal(), a.getMainExecutor(), new BiometricPrompt.AuthenticationCallback() {
                @Override public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult r) { responder(id, true, "ok"); }
                @Override public void onAuthenticationError(int codigo, CharSequence msg) {
                    boolean cancelo = codigo == BiometricPrompt.BIOMETRIC_ERROR_USER_CANCELED || codigo == BiometricPrompt.BIOMETRIC_ERROR_CANCELED;
                    boolean bloqueo = codigo == BiometricPrompt.BIOMETRIC_ERROR_LOCKOUT || codigo == BiometricPrompt.BIOMETRIC_ERROR_LOCKOUT_PERMANENT;
                    responder(id, false, cancelo ? "cancelado" : bloqueo ? "bloqueado" : "error");
                }
                // onAuthenticationFailed: una huella que no es; Android deja intentar otra vez solo.
            });
        } catch (Throwable e) {
            responder(id, false, "error");
        }
    }

    private static void responder(String id, boolean ok, String motivo) {
        VentoApp.js("window.__ventoHuellaRespuesta && window.__ventoHuellaRespuesta(" + VentoApp.q(id) + "," + ok + "," + VentoApp.q(motivo) + ")");
    }
}
