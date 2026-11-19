package co.vento.app;

import android.app.Activity;
import android.content.Context;
import android.content.pm.PackageManager;
import android.hardware.biometrics.BiometricManager;
import android.hardware.biometrics.BiometricPrompt;
import android.os.Build;
import android.os.CancellationSignal;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyPermanentlyInvalidatedException;
import android.security.keystore.KeyProperties;

import java.security.KeyStore;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;

/**
 * 👆 ORDEVA 1.99.17 · Entrar con la huella del celular.
 * La página (lib/vento-huella.js) pregunta si el celular tiene huella (estado), si la llave de ORDEVA sirve (lista) y pide
 * la huella (pedir); la respuesta vuelve con window.__ventoHuellaRespuesta(id, ok, motivo).
 * Seguridad: no basta con «Android dijo que sí». ORDEVA guarda una llave en el Keystore de Android que SOLO se abre con una
 * huella fuerte (clase 3) y solo en ESTE celular (no viaja en respaldos ni a otro celular). Si alguien agrega otra huella en
 * los Ajustes del celular, Android borra la llave: la huella de ORDEVA se apaga y hay que activarla otra vez con la
 * contraseña. No se guarda ninguna huella ni contraseña. Desde Android 9 (API 28); en los más viejos, «no-soporta».
 */
final class Huella {
    private Huella() { }
    private static final String LLAVE = "ordeva_huella";
    private static CancellationSignal senal;

    /** "ok" (tiene huella fuerte guardada), "sin-huella" (el lector existe pero no hay ninguna) o "no-soporta". */
    static String estado(Context c) {
        try {
            if (c == null || Build.VERSION.SDK_INT < 28) return "no-soporta";
            if (Build.VERSION.SDK_INT >= 30) {
                BiometricManager bm = c.getSystemService(BiometricManager.class);
                return bm == null ? "no-soporta" : traducir(bm.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG));
            }
            if (Build.VERSION.SDK_INT == 29) {
                BiometricManager bm = c.getSystemService(BiometricManager.class);
                return bm == null ? "no-soporta" : traducir(bm.canAuthenticate());
            }
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

    /** ¿La llave de ORDEVA está en este celular y sigue sirviendo? "ok", "sin-llave" o "invalidada" (se agregó otra huella). */
    static String lista() {
        if (Build.VERSION.SDK_INT < 28) return "sin-llave";
        try {
            SecretKey k = llave();
            if (k == null) return "sin-llave";
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.ENCRYPT_MODE, k);       // no pide la huella: solo comprueba que la llave sigue valiendo
            return "ok";
        } catch (KeyPermanentlyInvalidatedException e) {
            borrarLlave();
            return "invalidada";
        } catch (Throwable e) {
            return "sin-llave";
        }
    }

    private static SecretKey llave() throws Exception {
        KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
        ks.load(null);
        java.security.Key k = ks.getKey(LLAVE, null);
        return k instanceof SecretKey ? (SecretKey) k : null;
    }

    private static SecretKey crearLlave() throws Exception {
        borrarLlave();
        KeyGenParameterSpec.Builder b = new KeyGenParameterSpec.Builder(LLAVE, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setUserAuthenticationRequired(true)          // cada uso pide la huella
                .setInvalidatedByBiometricEnrollment(true);   // una huella nueva en el celular la borra
        if (Build.VERSION.SDK_INT >= 30) b.setUserAuthenticationParameters(0, KeyProperties.AUTH_BIOMETRIC_STRONG);
        KeyGenerator g = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        g.init(b.build());
        return g.generateKey();
    }

    private static void borrarLlave() {
        try { KeyStore ks = KeyStore.getInstance("AndroidKeyStore"); ks.load(null); if (ks.containsAlias(LLAVE)) ks.deleteEntry(LLAVE); } catch (Throwable ignorado) { }
    }

    /** Cierra la ventana de huella que haya abierta (la página dejó de esperar). */
    static void cancelar() {
        try { if (senal != null) senal.cancel(); } catch (Throwable ignorado) { }
        senal = null;
    }

    /** Muestra «Pon tu huella» y abre la llave con ella. crear = activar (hace la llave si no hay una que sirva).
     *  Siempre en el hilo principal (VentoApp.ui). */
    static void pedir(final String id, String titulo, String subtitulo, boolean crear) {
        final Activity a = VentoApp.ventana;
        if (Build.VERSION.SDK_INT < 28) { responder(id, false, "no-soporta"); return; }
        if (a == null || a.isFinishing()) { responder(id, false, "sin-ventana"); return; }
        final Cipher cifra;
        try {
            SecretKey k = llave();
            if (k != null) {
                try {
                    Cipher c0 = Cipher.getInstance("AES/GCM/NoPadding");
                    c0.init(Cipher.ENCRYPT_MODE, k);
                } catch (KeyPermanentlyInvalidatedException e) {
                    borrarLlave();
                    k = null;
                    if (!crear) { responder(id, false, "invalidada"); return; }
                }
            }
            if (k == null) {
                if (!crear) { responder(id, false, "sin-llave"); return; }
                k = crearLlave();
            }
            cifra = Cipher.getInstance("AES/GCM/NoPadding");
            cifra.init(Cipher.ENCRYPT_MODE, k);
        } catch (Throwable e) {
            responder(id, false, "error");
            return;
        }
        try {
            cancelar();
            BiometricPrompt.Builder b = new BiometricPrompt.Builder(a)
                    .setTitle(titulo == null || titulo.isEmpty() ? "Entrar a ORDEVA" : titulo)
                    .setNegativeButton("Usar contraseña", a.getMainExecutor(), (d, w) -> responder(id, false, "cancelado"));
            if (subtitulo != null && !subtitulo.isEmpty()) b.setSubtitle(subtitulo);
            if (Build.VERSION.SDK_INT >= 30) b.setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG);
            senal = new CancellationSignal();
            b.build().authenticate(new BiometricPrompt.CryptoObject(cifra), senal, a.getMainExecutor(), new BiometricPrompt.AuthenticationCallback() {
                @Override public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult r) {
                    senal = null;
                    try {
                        // La prueba de verdad: la llave solo se deja usar si la huella la abrió.
                        BiometricPrompt.CryptoObject co = r.getCryptoObject();
                        if (co == null || co.getCipher() == null) { responder(id, false, "error"); return; }
                        co.getCipher().doFinal("ORDEVA".getBytes("UTF-8"));
                        responder(id, true, "ok");
                    } catch (Throwable e) {
                        responder(id, false, "error");
                    }
                }
                @Override public void onAuthenticationError(int codigo, CharSequence msg) {
                    senal = null;
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
