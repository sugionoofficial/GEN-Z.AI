/* =========================================================
   GEN-Z.AI
   GENERATE AUTH MODULE
   ---------------------------------------------------------
   File:
   generate/assets/js/generate-auth.js

   Tanggung jawab:
   - Supabase client
   - Session authentication
   - Current user
   - Current profile
   - Role validation
   - Account status validation
   - Access token
   - Badge role / account credit

   Tidak bertanggung jawab:
   - Model
   - Model credit
   - Parameter form
   - Generate request
   - Result
   - Provider API key

   SUMBER DATA:
   - Supabase Auth
   - profiles

   CREDIT:
   - Credit pojok kanan atas = profiles.credits
   - BUKAN credit model
   - BUKAN navigation cache
   - BUKAN localStorage
   - BUKAN hardcode

   MODEL CREDIT:
   - Ditangani oleh generate-model.js
   - Source = models.credit_final

   Role valid:
   - USER
   - ADMIN
   - OWNER

   Status:
   - active jika kolom tersedia
   - jika kolom status tidak tersedia, profile tetap
     dianggap valid selama profile + role valid

   PENTING:
   - Role Generate berasal dari profiles Supabase
   - Account Credit Generate berasal dari profiles Supabase
   - Navigation profile hanya cache/sinkronisasi
   - Navigation tidak boleh menjadi source of truth
   - TIDAK bergantung pada generate-utils.js
========================================================= */

import {
    getGenerateElements,
    setSupabaseClient,
    getSupabaseClient,
    setCurrentUser,
    getCurrentUser,
    setCurrentProfile,
    getCurrentProfile
} from "./generate-state.js";


/* =========================================================
   CONSTANT
========================================================= */

const SUPABASE_CDN =
    "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";

const VALID_ROLES = Object.freeze([
    "USER",
    "ADMIN",
    "OWNER"
]);

const ACTIVE_STATUS =
    "active";


/* =========================================================
   LOCAL FORMAT NUMBER
   ---------------------------------------------------------
   generate-utils.js tidak digunakan karena file tersebut
   tidak tersedia pada Generate module.
========================================================= */

function formatNumber(
    value
) {

    const numeric =
        Number(
            value
        );

    if (
        !Number.isFinite(
            numeric
        )
    ) {

        return String(
            value ?? ""
        );

    }

    return new Intl.NumberFormat(
        "id-ID"
    ).format(
        numeric
    );

}


/* =========================================================
   CONFIG
========================================================= */

function getSupabaseConfig() {

    if (
        typeof window === "undefined" ||
        !window.GENZ_CONFIG
    ) {

        throw new Error(
            "Konfigurasi GEN-Z.AI tidak ditemukan."
        );

    }

    const url =
        String(
            window.GENZ_CONFIG.SUPABASE_URL ||
            ""
        ).trim();

    const key =
        String(
            window.GENZ_CONFIG.SUPABASE_KEY ||
            ""
        ).trim();

    if (!url) {

        throw new Error(
            "SUPABASE_URL tidak ditemukan."
        );

    }

    if (!key) {

        throw new Error(
            "SUPABASE_KEY tidak ditemukan."
        );

    }

    return {
        url,
        key
    };

}


/* =========================================================
   LOAD SUPABASE SCRIPT
========================================================= */

function loadSupabaseScript() {

    return new Promise(
        (
            resolve,
            reject
        ) => {

            if (
                window.supabase &&
                typeof window.supabase.createClient ===
                    "function"
            ) {

                resolve(
                    window.supabase
                );

                return;

            }


            const existingScript =
                document.querySelector(
                    `script[src="${SUPABASE_CDN}"]`
                );


            if (existingScript) {

                const startedAt =
                    Date.now();

                const timeout =
                    15000;


                const check =
                    () => {

                        if (
                            window.supabase &&
                            typeof window.supabase
                                .createClient ===
                                "function"
                        ) {

                            resolve(
                                window.supabase
                            );

                            return;

                        }


                        if (
                            Date.now() -
                                startedAt >=
                            timeout
                        ) {

                            reject(
                                new Error(
                                    "Supabase JS gagal dimuat."
                                )
                            );

                            return;

                        }


                        window.setTimeout(
                            check,
                            50
                        );

                    };


                check();

                return;

            }


            const script =
                document.createElement(
                    "script"
                );


            script.src =
                SUPABASE_CDN;

            script.async =
                true;


            script.onload =
                () => {

                    if (
                        window.supabase &&
                        typeof window.supabase
                            .createClient ===
                            "function"
                    ) {

                        resolve(
                            window.supabase
                        );

                        return;

                    }


                    reject(
                        new Error(
                            "Supabase JS dimuat tetapi API createClient tidak tersedia."
                        )
                    );

                };


            script.onerror =
                () => {

                    reject(
                        new Error(
                            "Gagal memuat Supabase JS."
                        )
                    );

                };


            document.head.appendChild(
                script
            );

        }
    );

}


/* =========================================================
   CREATE SUPABASE CLIENT
========================================================= */

function createSupabaseClient() {

    const {
        url,
        key
    } =
        getSupabaseConfig();


    if (
        !window.supabase ||
        typeof window.supabase.createClient !==
            "function"
    ) {

        throw new Error(
            "Supabase JS belum tersedia."
        );

    }


    return window.supabase.createClient(
        url,
        key,
        {
            auth: {
                persistSession:
                    true,

                autoRefreshToken:
                    true,

                detectSessionInUrl:
                    true
            }
        }
    );

}


/* =========================================================
   CHECK VALID SUPABASE CLIENT
========================================================= */

function isValidSupabaseClient(
    client
) {

    return Boolean(
        client &&
        client.auth &&
        typeof client.auth.getSession ===
            "function"
    );

}


/* =========================================================
   LOAD SUPABASE
========================================================= */

export async function loadSupabase() {

    const existingClient =
        getSupabaseClient();


    if (
        isValidSupabaseClient(
            existingClient
        )
    ) {

        return existingClient;

    }


    /*
     * Gunakan shared client jika sudah
     * dibuat navigation atau module lain.
     */

    if (
        isValidSupabaseClient(
            window.GENZ_SUPABASE
        )
    ) {

        setSupabaseClient(
            window.GENZ_SUPABASE
        );

        window.supabaseClient =
            window.GENZ_SUPABASE;

        return window.GENZ_SUPABASE;

    }


    if (
        isValidSupabaseClient(
            window.supabaseClient
        )
    ) {

        setSupabaseClient(
            window.supabaseClient
        );

        window.GENZ_SUPABASE =
            window.supabaseClient;

        return window.supabaseClient;

    }


    /*
     * window.supabase biasanya adalah
     * library, bukan client.
     */

    if (
        !window.supabase ||
        typeof window.supabase.createClient !==
            "function"
    ) {

        await loadSupabaseScript();

    }


    const client =
        createSupabaseClient();


    setSupabaseClient(
        client
    );


    window.GENZ_SUPABASE =
        client;

    window.supabaseClient =
        client;


    return client;

}


/* =========================================================
   GET CURRENT SESSION
========================================================= */

async function getCurrentSession() {

    const client =
        getSupabaseClient();


    if (
        !isValidSupabaseClient(
            client
        )
    ) {

        throw new Error(
            "Supabase client belum tersedia."
        );

    }


    const {
        data,
        error
    } =
        await client.auth.getSession();


    if (error) {

        throw new Error(
            "Gagal membaca session Supabase: " +
            error.message
        );

    }


    if (
        !data ||
        !data.session
    ) {

        throw new Error(
            "Session tidak ditemukan. Silakan login kembali."
        );

    }


    return data.session;

}


/* =========================================================
   LOAD CURRENT USER
========================================================= */

export async function loadCurrentUser() {

    const client =
        getSupabaseClient();


    if (
        !isValidSupabaseClient(
            client
        )
    ) {

        throw new Error(
            "Supabase client belum tersedia."
        );

    }


    const session =
        await getCurrentSession();


    const {
        data,
        error
    } =
        await client.auth.getUser(
            session.access_token
        );


    if (error) {

        throw new Error(
            "Session user tidak valid: " +
            error.message
        );

    }


    if (
        !data ||
        !data.user
    ) {

        throw new Error(
            "User tidak ditemukan."
        );

    }


    if (
        data.user.id !==
        session.user.id
    ) {

        await safeSignOut();

        throw new Error(
            "User ID session tidak sesuai."
        );

    }


    setCurrentUser(
        data.user
    );


    /*
     * Sinkronisasi global user.
     */

    window.GENZ_CURRENT_USER =
        data.user;

    window.GENZ_NAVIGATION_USER =
        data.user;


    return data.user;

}


/* =========================================================
   NORMALIZE ROLE
========================================================= */

function normalizeRole(
    role
) {

    return String(
        role || ""
    )
        .trim()
        .toUpperCase();

}


/* =========================================================
   NORMALIZE STATUS
========================================================= */

function normalizeStatus(
    status
) {

    return String(
        status || ""
    )
        .trim()
        .toLowerCase();

}


/* =========================================================
   NORMALIZE ACCOUNT CREDIT
   ---------------------------------------------------------
   Source:
   profiles.credits

   Penting:
   - 0 adalah nilai valid
   - null/undefined = tidak tersedia
   - tidak melakukan fallback ke model credit
   - tidak mengambil dari navigation
========================================================= */

function normalizeAccountCredit(
    credits
) {

    if (
        credits === null ||
        credits === undefined ||
        credits === ""
    ) {

        return {
            value: null,
            valid: false
        };

    }


    const numeric =
        Number(
            credits
        );


    if (
        Number.isFinite(
            numeric
        )
    ) {

        return {
            value: numeric,
            valid: true
        };

    }


    return {
        value: String(
            credits
        ),
        valid: true
    };

}


/* =========================================================
   VALIDATE PROFILE
========================================================= */

function validateProfile(
    profile,
    user
) {

    if (
        !profile ||
        typeof profile !==
            "object"
    ) {

        throw new Error(
            "Profile akun belum ditemukan."
        );

    }


    if (
        !user?.id
    ) {

        throw new Error(
            "User Auth tidak valid."
        );

    }


    /*
     * Profile wajib milik user Auth.
     */

    if (
        String(
            profile.id || ""
        ) !==
        String(
            user.id
        )
    ) {

        throw new Error(
            "ID profile tidak sesuai dengan user."
        );

    }


    /*
     * Validasi status hanya jika kolom
     * status memang tersedia.
     */

    if (
        profile.status !== undefined &&
        profile.status !== null &&
        String(
            profile.status
        ).trim() !== ""
    ) {

        if (
            normalizeStatus(
                profile.status
            ) !==
            ACTIVE_STATUS
        ) {

            throw new Error(
                "Akun tidak aktif."
            );

        }

    }


    const role =
        normalizeRole(
            profile.role
        );


    if (
        !VALID_ROLES.includes(
            role
        )
    ) {

        throw new Error(
            "Role akun tidak valid."
        );

    }


    /*
     * Normalisasi credit dilakukan tanpa
     * mengubah source of truth.
     */

    const accountCredit =
        normalizeAccountCredit(
            profile.credits
        );


    return {
        ...profile,

        role,

        credits:
            accountCredit.valid
                ? accountCredit.value
                : null
    };

}


/* =========================================================
   UPDATE AUTH BADGES
========================================================= */

function updateAuthBadges(
    profile
) {

    const elements =
        getGenerateElements();


    if (!elements) {
        return;
    }


    const {
        roleBadge,
        creditBadge
    } =
        elements;


    /* =====================================================
       ROLE
    ===================================================== */

    if (
        roleBadge
    ) {

        const role =
            normalizeRole(
                profile?.role
            );


        /*
         * Role hanya dari profile Supabase.
         */

        roleBadge.textContent =
            role || "-";

    }


    /* =====================================================
       ACCOUNT CREDIT
       -----------------------------------------------------
       INI CREDIT POJOK KANAN ATAS.

       Source:
       profiles.credits

       BUKAN:
       - model credit
       - credit_final
       - credit_cost
       - localStorage
       - navigation cache
    ===================================================== */

    if (
        !creditBadge
    ) {
        return;
    }


    const accountCredit =
        normalizeAccountCredit(
            profile?.credits
        );


    /*
     * Data credit belum tersedia.
     */

    if (
        !accountCredit.valid
    ) {

        creditBadge.textContent =
            "Credit: -";

        return;

    }


    /*
     * Numeric credit.
     *
     * Nilai 0 tetap valid dan akan
     * ditampilkan sebagai:
     *
     * Credit: 0
     */

    if (
        typeof accountCredit.value ===
            "number"
    ) {

        creditBadge.textContent =
            `Credit: ${formatNumber(
                accountCredit.value
            )}`;

        return;

    }


    /*
     * Fallback hanya untuk nilai non-numeric
     * yang memang tersimpan di database.
     */

    creditBadge.textContent =
        `Credit: ${String(
            accountCredit.value
        )}`;

}


/* =========================================================
   PROFILE SELECTOR
========================================================= */

function getProfileSelectColumns() {

    return [
        "id",
        "email",
        "name",
        "role",
        "credits",
        "status"
    ];

}


/* =========================================================
   LOAD PROFILE WITH STATUS
========================================================= */

async function queryProfileWithStatus(
    client,
    user
) {

    return await client
        .from("profiles")
        .select(
            getProfileSelectColumns().join(",")
        )
        .eq(
            "id",
            user.id
        )
        .maybeSingle();

}


/* =========================================================
   LOAD PROFILE WITHOUT STATUS
========================================================= */

async function queryProfileWithoutStatus(
    client,
    user
) {

    return await client
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


/* =========================================================
   DETECT MISSING STATUS COLUMN
========================================================= */

function isMissingStatusColumnError(
    error
) {

    if (!error) {
        return false;
    }


    const message =
        String(
            error.message ||
            ""
        ).toLowerCase();


    const details =
        String(
            error.details ||
            ""
        ).toLowerCase();


    const hint =
        String(
            error.hint ||
            ""
        ).toLowerCase();


    const combined =
        `${message} ${details} ${hint}`;


    return (
        combined.includes(
            "profiles.status"
        ) ||
        (
            combined.includes(
                "column"
            ) &&
            combined.includes(
                "status"
            ) &&
            (
                combined.includes(
                    "does not exist"
                ) ||
                combined.includes(
                    "not exist"
                )
            )
        )
    );

}


/* =========================================================
   LOAD PROFILE
   ---------------------------------------------------------
   SOURCE OF TRUTH:
   Supabase profiles

   Tidak menggunakan navigation profile
   sebagai source of truth.

   CREDIT:
   profiles.credits
========================================================= */

export async function loadProfile() {

    const client =
        getSupabaseClient();


    if (
        !isValidSupabaseClient(
            client
        )
    ) {

        throw new Error(
            "Supabase client belum tersedia."
        );

    }


    const user =
        getCurrentUser();


    if (
        !user ||
        !user.id
    ) {

        throw new Error(
            "User belum terautentikasi."
        );

    }


    /*
     * Query profile terbaru langsung dari Supabase.
     *
     * Ini sengaja tidak menggunakan cache.
     * Kalau credit akun berubah di database,
     * Generate harus membaca nilai terbaru.
     */

    let result =
        await queryProfileWithStatus(
            client,
            user
        );


    /*
     * Jika schema tidak memiliki status,
     * query ulang tanpa status.
     */

    if (
        result.error &&
        isMissingStatusColumnError(
            result.error
        )
    ) {

        result =
            await queryProfileWithoutStatus(
                client,
                user
            );

    }


    if (
        result.error
    ) {

        throw new Error(
            "Gagal mengambil profile: " +
            result.error.message
        );

    }


    if (
        !result.data
    ) {

        await safeSignOut();

        throw new Error(
            "Profile belum ditemukan untuk akun ini."
        );

    }


    /*
     * Validasi profile terhadap Auth user.
     */

    const profile =
        validateProfile(
            result.data,
            user
        );


    /*
     * Simpan ke state.
     */

    setCurrentProfile(
        profile
    );


    /*
     * Update badge berdasarkan hasil
     * query Supabase terbaru.
     */

    updateAuthBadges(
        profile
    );


    /*
     * Sinkronisasi cache navigation
     * SETELAH query Supabase berhasil.
     *
     * Cache ini bukan source of truth.
     */

    window.GENZ_NAVIGATION_PROFILE =
        profile;

    window.GENZ_CURRENT_PROFILE =
        profile;

    window.GENZ_NAVIGATION_ROLE =
        profile.role;

    window.GENZ_CURRENT_ROLE =
        profile.role;


    return profile;

}


/* =========================================================
   GET ACCESS TOKEN
========================================================= */

export async function getAccessToken() {

    const client =
        getSupabaseClient();


    if (
        !isValidSupabaseClient(
            client
        )
    ) {

        throw new Error(
            "Supabase client belum tersedia."
        );

    }


    const session =
        await getCurrentSession();


    const token =
        String(
            session.access_token ||
            ""
        ).trim();


    if (!token) {

        throw new Error(
            "Access token tidak tersedia. Silakan login kembali."
        );

    }


    return token;

}


/* =========================================================
   ENSURE AUTHENTICATED
========================================================= */

export async function ensureAuthenticated() {

    /*
     * Pastikan client tersedia.
     */

    await loadSupabase();


    let user =
        getCurrentUser();


    /*
     * Cache user boleh digunakan.
     *
     * Ini hanya untuk menghindari query Auth
     * yang tidak diperlukan.
     */

    if (
        !user &&
        window.GENZ_NAVIGATION_USER
    ) {

        user =
            window.GENZ_NAVIGATION_USER;


        setCurrentUser(
            user
        );

    }


    /*
     * Jika tidak ada user,
     * baca langsung dari Supabase Auth.
     */

    if (!user) {

        user =
            await loadCurrentUser();

    }


    /*
     * PROFILE SELALU dibaca ulang dari
     * Supabase.
     *
     * Jangan gunakan:
     *
     * getCurrentProfile()
     *
     * untuk melewati query profile.
     */

    const profile =
        await loadProfile();


    /*
     * Pastikan badge memakai profile terbaru.
     */

    updateAuthBadges(
        profile
    );


    return {
        user,
        profile
    };

}


/* =========================================================
   SAFE SIGN OUT
========================================================= */

export async function safeSignOut() {

    const client =
        getSupabaseClient();


    if (
        !isValidSupabaseClient(
            client
        )
    ) {

        return;

    }


    try {

        await client.auth.signOut();

    } catch (error) {

        console.error(
            "GEN-Z.AI signOut error:",
            error
        );

    }

}


/* =========================================================
   GET CURRENT ROLE
========================================================= */

export function getCurrentRole() {

    const profile =
        getCurrentProfile();


    if (!profile) {

        return null;

    }


    return normalizeRole(
        profile.role
    );

}


/* =========================================================
   ROLE CHECK
========================================================= */

export function hasRole(
    ...roles
) {

    const currentRole =
        getCurrentRole();


    if (!currentRole) {

        return false;

    }


    return roles
        .map(
            normalizeRole
        )
        .includes(
            currentRole
        );

}


/* =========================================================
   GET CURRENT ACCOUNT CREDIT
   ---------------------------------------------------------
   Public helper agar module lain dapat membaca
   credit akun tanpa membaca DOM.

   Source:
   current profile -> profiles.credits
========================================================= */

export function getCurrentAccountCredit() {

    const profile =
        getCurrentProfile();


    if (!profile) {

        return null;

    }


    const accountCredit =
        normalizeAccountCredit(
            profile.credits
        );


    if (
        !accountCredit.valid
    ) {

        return null;

    }


    return accountCredit.value;

}


/* =========================================================
   REFRESH ACCOUNT CREDIT
   ---------------------------------------------------------
   Dipakai jika setelah generate credit akun
   berkurang dan badge kanan atas perlu
   menampilkan nilai terbaru.

   Tetap mengambil data dari Supabase.
========================================================= */

export async function refreshAccountCredit() {

    const profile =
        await loadProfile();


    return getCurrentAccountCredit();

}


/* =========================================================
   EXPORT AUTH API
========================================================= */

export const generateAuth =
    Object.freeze({

        loadSupabase,

        loadCurrentUser,

        loadProfile,

        getAccessToken,

        ensureAuthenticated,

        safeSignOut,

        getCurrentRole,

        hasRole,

        getCurrentAccountCredit,

        refreshAccountCredit

    });


export default generateAuth;
