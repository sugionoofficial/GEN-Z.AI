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
========================================================= */

"use strict";


/* =========================================================
   CONFIG
========================================================= */

const MAX_WAIT = 15000;

const INTERVAL = 150;


/* =========================================================
   INTERNAL STATE
========================================================= */

let lastRenderedAuthKey = "";

let safetyTimer = null;


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


    console.log(
        "[GEN-Z.AI][Generate] AUTH BADGE:",
        {
            email:
                profile.email,

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

            console.warn(
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

        console.warn(
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

function startSafetySync() {

    if (safetyTimer) {

        clearInterval(
            safetyTimer
        );

        safetyTimer =
            null;

    }


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

                    clearInterval(
                        safetyTimer
                    );

                    safetyTimer =
                        null;

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

                console.error(
                    "[GEN-Z.AI][Generate] Early auth bridge:",
                    error
                );

            }
        );


    startSafetySync();

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
