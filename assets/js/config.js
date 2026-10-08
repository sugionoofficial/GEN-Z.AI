/*
 * ============================================================
 * GEN-Z.AI
 * Supabase Configuration
 * ============================================================
 *
 * File ini menjadi sumber konfigurasi utama untuk:
 * - login
 * - register
 * - dashboard
 * - generator
 * - authentication
 *
 * Jangan mengubah nama variabel GENZ_CONFIG karena file
 * authentication membacanya.
 *
 * PATCH:
 * - Debug log di-gate via window.GENZ_DEBUG
 * - Validasi format URL Supabase
 * - Validasi format publishable/anon key
 * - window.GENZ_CONFIG dibuat non-writable
 * ============================================================
 */

"use strict";


/* =========================================================
   CONFIG OBJECT
========================================================= */

const GENZ_CONFIG = Object.freeze({

    SUPABASE_URL:
        "https://boeamhglmvkatnycluaa.supabase.co",

    SUPABASE_KEY:
        "sb_publishable_blGIFRNPbB2qAa1vXQBXcw_txqDQldb"

});


/* =========================================================
   DEBUG FLAG
========================================================= */

function isDebugEnabled() {

    return (
        typeof window !== "undefined" &&
        window.GENZ_DEBUG === true
    );

}


function debugLog(...args) {

    if (
        isDebugEnabled()
    ) {

        console.log(...args);

    }

}


function debugWarn(...args) {

    /*
     * Warning SELALU ditampilkan (tidak di-gate),
     * karena berkaitan dengan konfigurasi yang salah.
     */

    console.warn(...args);

}


function debugError(...args) {

    /*
     * Error SELALU ditampilkan.
     */

    console.error(...args);

}


/* =========================================================
   VALIDATE URL
   ---------------------------------------------------------
   Supabase URL harus:
   - Protokol https
   - Hostname berakhir dengan .supabase.co
     atau .supabase.in (region legacy)
========================================================= */

function isValidSupabaseUrl(
    url
) {

    if (
        typeof url !== "string" ||
        !url.trim()
    ) {

        return false;

    }


    let parsed;


    try {

        parsed =
            new URL(
                url
            );

    } catch {

        return false;

    }


    if (
        parsed.protocol !== "https:"
    ) {

        return false;

    }


    const hostname =
        String(
            parsed.hostname ||
            ""
        )
            .toLowerCase();


    return (
        hostname.endsWith(
            ".supabase.co"
        ) ||
        hostname.endsWith(
            ".supabase.in"
        )
    );

}


/* =========================================================
   VALIDATE KEY
   ---------------------------------------------------------
   Format key yang diterima:
   - sb_publishable_* (format baru, 2024+)
   - sb_anon_*        (format baru alternatif)
   - eyJ*             (JWT legacy anon key)

   JANGAN menerima:
   - sb_secret_*      (service_role, HARAM di client)
   - Service role JWT (yang punya "role":"service_role")
========================================================= */

function isValidSupabaseKey(
    key
) {

    if (
        typeof key !== "string" ||
        !key.trim()
    ) {

        return false;

    }


    const normalized =
        key.trim();


    /* -----------------------------------------------------
       FORMAT BARU — publishable
    ----------------------------------------------------- */

    if (
        normalized.startsWith(
            "sb_publishable_"
        )
    ) {

        return true;

    }


    /* -----------------------------------------------------
       FORMAT BARU — anon (varian)
    ----------------------------------------------------- */

    if (
        normalized.startsWith(
            "sb_anon_"
        )
    ) {

        return true;

    }


    /* -----------------------------------------------------
       FORMAT BARU — SERVICE ROLE (TOLAK!)
    ----------------------------------------------------- */

    if (
        normalized.startsWith(
            "sb_secret_"
        )
    ) {

        debugError(
            "GEN-Z.AI: SERVICE_ROLE KEY TERDETEKSI DI CONFIG! " +
            "JANGAN gunakan service_role key di client. " +
            "Gunakan sb_publishable_* atau anon key."
        );

        return false;

    }


    /* -----------------------------------------------------
       FORMAT LEGACY — JWT anon
       Format: header.payload.signature (base64url)
    ----------------------------------------------------- */

    if (
        normalized.startsWith(
            "eyJ"
        )
    ) {

        const parts =
            normalized.split(
                "."
            );


        if (
            parts.length !==
            3
        ) {

            return false;

        }


        /* -------------------------------------------------
           Cek payload JWT untuk deteksi "role":"service_role"
        ------------------------------------------------- */

        try {

            const payload =
                parts[1];


            /* Base64url → Base64 */

            const base64 =
                payload
                    .replace(
                        /-/g,
                        "+"
                    )
                    .replace(
                        /_/g,
                        "/"
                    );


            /* Padding */

            const padded =
                base64 +
                "=".repeat(
                    (
                        4 -
                        base64.length %
                        4
                    ) %
                    4
                );


            const decoded =
                atob(
                    padded
                );


            const data =
                JSON.parse(
                    decoded
                );


            if (
                data?.role ===
                "service_role"
            ) {

                debugError(
                    "GEN-Z.AI: SERVICE ROLE JWT TERDETEKSI DI CONFIG! " +
                    "JANGAN gunakan service_role key di client."
                );

                return false;

            }

        } catch {

            /*
             * Kalau tidak bisa decode, minimal
             * format JWT-nya benar (3 bagian).
             */

        }


        return true;

    }


    return false;

}


/* =========================================================
   COMPATIBILITY
   ---------------------------------------------------------
   Membuat konfigurasi juga tersedia melalui window.
   Ini mencegah masalah ketika auth.js dijalankan sebagai
   script biasa di browser.

   window.GENZ_CONFIG dibuat non-writable agar tidak bisa
   di-overwrite dari script lain.
========================================================= */

try {

    Object.defineProperty(
        window,
        "GENZ_CONFIG",
        {
            value:
                GENZ_CONFIG,

            writable:
                false,

            configurable:
                false,

            enumerable:
                true
        }
    );

} catch (
    error
) {

    /*
     * Fallback kalau defineProperty gagal
     * (mis. script dijalankan di lingkungan lama).
     */

    window.GENZ_CONFIG =
        GENZ_CONFIG;

}


/* =========================================================
   VALIDATION
========================================================= */

const urlValid =
    isValidSupabaseUrl(
        GENZ_CONFIG.SUPABASE_URL
    );


const keyValid =
    isValidSupabaseKey(
        GENZ_CONFIG.SUPABASE_KEY
    );


if (
    !urlValid ||
    !keyValid
) {

    if (
        !urlValid
    ) {

        debugError(
            "GEN-Z.AI: SUPABASE_URL tidak valid. " +
            "Harap gunakan URL dengan format " +
            "https://<project-ref>.supabase.co"
        );

    }


    if (
        !keyValid
    ) {

        debugError(
            "GEN-Z.AI: SUPABASE_KEY tidak valid. " +
            "Harus berupa sb_publishable_* / sb_anon_* / " +
            "atau JWT anon key. " +
            "JANGAN gunakan service_role key di client."
        );

    }


    debugError(
        "GEN-Z.AI: Konfigurasi Supabase tidak lengkap."
    );

}

else {

    debugLog(
        "GEN-Z.AI: Konfigurasi berhasil dimuat."
    );

}
