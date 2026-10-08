/* =========================================================
   GEN-Z.AI
   GENERATE PAGE AUTH
   ---------------------------------------------------------
   File:
   generate/assets/js/generate-page-auth.js

   Tanggung jawab:
   - Menampilkan role pada Generate page
   - Menampilkan credit pada Generate page
   - Membaca profile dari Navigation
   - Fallback membaca profile dari Supabase
   - Sinkronisasi auth awal
   - Tidak melakukan polling render tanpa perubahan

   PATCH:
   - Debug log di-gate via window.GENZ_DEBUG
   - Email user di-mask (PII) sebelum di-log
   - Verifikasi profile.id === user.id di loadProfileDirectly
   - Cleanup safetyTimer saat page unload
   - Tidak mengubah API / signature / alur
========================================================= */

"use strict";


/* =========================================================
   CONFIG
========================================================= */

const MAX_WAIT =
    15000;

const INTERVAL =
    150;


/* =========================================================
   DEBUG HELPER
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

    if (
        isDebugEnabled()
    ) {

        console.warn(...args);

    }

}


function debugError(...args) {

    /*
     * Error selalu ditampilkan karena menyangkut auth flow.
     */

    console.error(...args);

}


/* =========================================================
   EMAIL MASK
   ---------------------------------------------------------
   Mencegah PII (email) bocor ke console / screenshot.
   Format: u***@domain.tld
========================================================= */

function maskEmail(
    email
) {

    const value =
        String(
            email ||
            ""
        ).trim();


    if (
        !value
    ) {

        return "";

    }


    const atIndex =
        value.indexOf(
            "@"
        );


    if (
        atIndex <=
        0
    ) {

        return "***";

    }


    const localPart =
        value.slice(
            0,
            atIndex
        );

    const domainPart =
        value.slice(
            atIndex
        );


    if (
        localPart.length <=
        1
    ) {

        return "*" + domainPart;

    }


    return (
        localPart[0] +
        "***" +
        domainPart
    );

}


/* =========================================================
   INTERNAL STATE
========================================================= */

let lastRenderedAuthKey =
    "";

let safetyTimer =
    null;


/* =========================================================
   DOM
========================================================= */

function getElement(id) {

    return document.getElementById(id);

}


/* =========================================================
   CREDIT
========================================================= */

function formatCredit(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {

        return "0";

    }


    const number =
        Number(value);


    if (
        Number.isFinite(number)
    ) {

        return new Intl.NumberFormat(
            "id-ID",
            {
                maximumFractionDigits: 2
            }
        ).format(number);

    }


    return String(value);

}


/* =========================================================
   ROLE
========================================================= */

function normalizeRole(value) {

    return String(
        value || ""
    )
        .trim()
        .toUpperCase();

}


/* =========================================================
   NAVIGATION PROFILE
========================================================= */

function getNavigationProfile() {

    return (
        window.GENZ_CURRENT_PROFILE ||
        window.GENZ_NAVIGATION_PROFILE ||
        null
    );

}


/* =========================================================
   RENDER ROLE
========================================================= */

function renderRole(profile) {

    const element =
        getElement(
            "roleBadge"
        );


    if (
        !element ||
        !profile
    ) {

        return false;

    }


    const role =
        normalizeRole(
            profile.role
        );


    if (!role) {

        return false;

    }


    element.textContent =
        role;


    element.hidden =
        false;


    element.removeAttribute(
        "hidden"
    );


    element.style.setProperty(
        "display",
        "inline",
        "important"
    );


    element.style.setProperty(
        "visibility",
        "visible",
        "important"
    );


    element.style.setProperty(
        "opacity",
        "1",
        "important"
    );


    element.dataset.role =
        role;


    return true;

}


/* =========================================================
   RENDER CREDIT
========================================================= */

function renderAccountCredit(profile) {

    const element =
        getElement(
            "creditBadge"
        );


    if (
        !element ||
        !profile
    ) {

        return false;

    }


    element.textContent =
        `Credit: ${formatCredit(
            profile.credits
        )}`;


    element.hidden =
        false;


    element.removeAttribute(
        "hidden"
    );


    element.style.setProperty(
        "display",
        "inline-flex",
        "important"
    );


    element.style.setProperty(
        "visibility",
        "visible",
        "important"
    );


    element.style.setProperty(
        "opacity",
        "1",
        "important"
    );


    return true;

}


/* =========================================================
   AUTH KEY
   ---------------------------------------------------------
   Dipakai untuk mencegah render/log berulang
   ketika profile sebenarnya tidak berubah.
========================================================= */

function getAuthRenderKey(profile) {

    if (
        !profile ||
        typeof profile !== "object"
    ) {

        return "";

    }


    return [
        String(profile.id || ""),
        String(profile.email || ""),
        normalizeRole(profile.role),
        String(profile.credits ?? "")
    ].join("|");

}


/* =========================================================
   RENDER AUTH
========================================================= */

function renderAuth(profile) {

    if (
        !profile ||
        typeof profile !== "object"
    ) {

        return false;

    }


    const roleReady =
        renderRole(
            profile
        );


    const creditReady =
        renderAccountCredit(
            profile
        );


    if (
        !roleReady ||
        !creditReady
    ) {

        return false;

    }


    const authKey =
        getAuthRenderKey(
            profile
        );


    /*
     * Profile sama dengan render sebelumnya.
     * Tidak perlu render/log lagi.
     */
    if (
        authKey &&
        authKey === lastRenderedAuthKey
    ) {

        return true;

    }


    lastRenderedAuthKey =
        authKey;


    /*
     * Email di-mask untuk mencegah PII bocor
     * ke console / screenshot.
     */

    debugLog(
        "[GEN-Z.AI][Generate] AUTH BADGE:",
        {
            email:
                maskEmail(
                    profile.email
                ),

            role:
                profile.role,

            credits:
                profile.credits
        }
    );


    return true;

}


/* =========================================================
   SUPABASE CLIENT
========================================================= */

function getSupabaseClient() {

    const candidates = [

        window.GENZ_SUPABASE,

        window.supabaseClient

    ];


    for (
        const client
        of candidates
    ) {

        if (
            client &&

            client.auth &&

            typeof client.auth.getSession ===
                "function"
        ) {

            return client;

        }

    }


    return null;

}


/* =========================================================
   DIRECT PROFILE LOAD
========================================================= */

async function loadProfileDirectly() {

    const supabase =
        getSupabaseClient();


    if (!supabase) {

        return null;

    }


    try {

        const sessionResult =
            await supabase.auth.getSession();


        const user =
            sessionResult
                ?.data
                ?.session
                ?.user ||
            null;


        if (!user?.id) {

            return null;

        }


        let result =
            await supabase
                .from("profiles")
                .select(
                    "id,email,name,role,credits,status"
                )
                .eq(
                    "id",
                    user.id
                )
                .maybeSingle();


        /*
         * Compatibility fallback:
         * beberapa database tidak memiliki kolom
         * profiles.status.
         */
        if (
            result?.error
        ) {

            const message =
                String(
                    result.error?.message ||
                    ""
                ).toLowerCase();


            if (
                message.includes(
                    "status"
                ) ||

                message.includes(
                    "schema cache"
                ) ||

                message.includes(
                    "column"
                )
            ) {

                result =
                    await supabase
                        .from("profiles")
                        .select(
                            "id,email,name,role,credits"
                        )
                        .eq(
                            "id",
                            user.id
                        )
                        .maybeSingle();

            }

        }


        if (
            result?.error
        ) {

            debugWarn(
                "[GEN-Z.AI][Generate] Profile fallback gagal:",
                result.error
            );

            return null;

        }


        const profile =
            result?.data ||
            null;


        if (!profile) {

            return null;

        }


        /* =================================================
           VERIFIKASI PROFILE MILIK USER
           -------------------------------------------------
           Mencegah profile spoofing jika
           result.data tidak sesuai dengan session user.
        ================================================= */

        if (
            String(profile.id || "") !==
            String(user.id)
        ) {

            debugWarn(
                "[GEN-Z.AI][Generate] Profile ID tidak sesuai dengan user session."
            );

            return null;

        }


        window.GENZ_CURRENT_USER =
            user;


        window.GENZ_CURRENT_PROFILE =
            profile;


        window.GENZ_NAVIGATION_USER =
            user;


        window.GENZ_NAVIGATION_PROFILE =
            profile;


        return profile;

    } catch (error) {

        debugWarn(
            "[GEN-Z.AI][Generate] Profile fallback exception:",
            error
        );

        return null;

    }

}


/* =========================================================
   HYDRATE
========================================================= */

async function hydrate() {

    let profile =
        getNavigationProfile();


    /*
     * Coba profile yang sudah diberikan
     * oleh navigation terlebih dahulu.
     */
    if (
        profile &&
        renderAuth(profile)
    ) {

        return profile;

    }


    /*
     * Tunggu Navigation jika promise tersedia.
     */
    if (
        window.GENZNavigationReady &&

        typeof window.GENZNavigationReady.then ===
            "function"
    ) {

        try {

            await Promise.race([

                window.GENZNavigationReady,

                new Promise(
                    resolve => {

                        setTimeout(
                            resolve,
                            5000
                        );

                    }
                )

            ]);

        } catch {
            /*
             * Fallback ke Supabase.
             */
        }


        profile =
            getNavigationProfile();


        if (
            profile &&
            renderAuth(profile)
        ) {

            return profile;

        }

    }


    /*
     * Fallback terakhir:
     * baca profile langsung dari Supabase.
     */
    profile =
        await loadProfileDirectly();


    if (profile) {

        renderAuth(
            profile
        );

    }


    return profile;

}


/* =========================================================
   SAFETY SYNC
   ---------------------------------------------------------
   Hanya melakukan pengecekan selama proses boot.
   Tidak melakukan render/log ulang jika profile sama.
========================================================= */

function stopSafetySync() {

    if (
        safetyTimer
    ) {

        clearInterval(
            safetyTimer
        );

        safetyTimer =
            null;

    }

}


function startSafetySync() {

    stopSafetySync();


    const started =
        Date.now();


    safetyTimer =
        setInterval(
            function () {

                const profile =
                    getNavigationProfile();


                if (profile) {

                    renderAuth(
                        profile
                    );

                }


                if (
                    Date.now() -
                    started >=
                    MAX_WAIT
                ) {

                    stopSafetySync();

                }

            },
            INTERVAL
        );

}


/* =========================================================
   BOOT
========================================================= */

function boot() {

    hydrate()
        .catch(
            function (error) {

                debugError(
                    "[GEN-Z.AI][Generate] Early auth bridge:",
                    error
                );

            }
        );


    startSafetySync();

}


/* =========================================================
   PAGE UNLOAD CLEANUP
   ---------------------------------------------------------
   Mencegah safetyTimer terus berjalan di background
   ketika user navigasi ke halaman lain.
========================================================= */

if (
    typeof window !==
        "undefined"
) {

    window.addEventListener(
        "pagehide",
        stopSafetySync,
        {
            once:
                false
        }
    );


    window.addEventListener(
        "beforeunload",
        stopSafetySync,
        {
            once:
                false
        }
    );

}


/* =========================================================
   PUBLIC API
========================================================= */

export {
    formatCredit,
    normalizeRole,
    getNavigationProfile,
    renderRole,
    renderAccountCredit,
    renderAuth,
    loadProfileDirectly,
    hydrate,
    startSafetySync,
    stopSafetySync,
    boot
};


/* =========================================================
   INITIALIZE
========================================================= */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        boot,
        {
            once: true
        }
    );

} else {

    boot();

}
