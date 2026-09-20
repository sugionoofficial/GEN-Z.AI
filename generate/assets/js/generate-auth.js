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
   - Badge role / credit

   Tidak bertanggung jawab:
   - Model
   - Parameter form
   - Generate request
   - Result
   - Provider API key

   Sumber data:
   - Supabase Auth
   - profiles

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
   - Credit Generate berasal dari profiles Supabase
   - Navigation profile hanya cache/sinkronisasi
   - Navigation tidak boleh menjadi source of truth
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

import {
    formatNumber
} from "./generate-utils.js";


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

const ACTIVE_STATUS = "active";


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
            window.GENZ_CONFIG.SUPABASE_URL || ""
        ).trim();

    const key =
        String(
            window.GENZ_CONFIG.SUPABASE_KEY || ""
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
        (resolve, reject) => {

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

            script.async = true;

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
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true
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
     * Prioritaskan client global yang sudah
     * dibuat navigation atau modul lain.
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
     * library Supabase, BUKAN client.
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

    /*
     * Simpan satu client global.
     */
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
     * Sinkronkan user global.
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

function normalizeRole(role) {

    return String(
        role || ""
    )
        .trim()
        .toUpperCase();
}


/* =========================================================
   NORMALIZE STATUS
========================================================= */

function normalizeStatus(status) {

    return String(
        status || ""
    )
        .trim()
        .toLowerCase();
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

    if (!user?.id) {

        throw new Error(
            "User Auth tidak valid."
        );
    }

    /*
     * Profile WAJIB milik user Auth yang sedang login.
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
     * Jika status memang tersedia,
     * akun harus active.
     *
     * Jika status tidak tersedia pada schema,
     * validasi status dilewati.
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

    return {
        ...profile,
        role
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
    } = elements;

    /*
     * ROLE
     */
    if (roleBadge) {

        const role =
            normalizeRole(
                profile?.role
            );

        roleBadge.textContent =
            role || "USER";
    }

    /*
     * CREDIT
     */
    if (!creditBadge) {
        return;
    }

    const credits =
        profile?.credits;

    /*
     * NULL / undefined / empty:
     * jangan mengubah menjadi 0.
     */
    if (
        credits === null ||
        credits === undefined ||
        credits === ""
    ) {

        creditBadge.textContent =
            "Credit: -";

        return;
    }

    /*
     * Supabase dapat mengembalikan
     * numeric sebagai string.
     */
    const numericCredits =
        Number(
            credits
        );

    /*
     * 0 adalah nilai VALID.
     */
    if (
        Number.isFinite(
            numericCredits
        )
    ) {

        creditBadge.textContent =
            `Credit: ${formatNumber(
                numericCredits
            )}`;

        return;
    }

    /*
     * Fallback jika nilai bukan angka.
     */
    creditBadge.textContent =
        `Credit: ${String(
            credits
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

   JANGAN:
   - memakai navigation profile terlebih dahulu
   - memakai cache sebagai role utama
   - memakai cache sebagai credit utama

   Navigation profile hanya diperbarui setelah
   query Supabase berhasil.
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
     * =====================================================
     * JANGAN menggunakan:
     *
     * window.GENZ_NAVIGATION_PROFILE
     *
     * sebagai source of truth.
     *
     * Profile harus selalu dibaca langsung
     * dari Supabase agar role dan credit
     * merupakan data terbaru.
     * =====================================================
     */

    let result =
        await queryProfileWithStatus(
            client,
            user
        );

    /*
     * Jika kolom status tidak tersedia,
     * ulangi query tanpa status.
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

    /*
     * Error database lainnya tidak boleh
     * ditutup dengan cache navigation.
     */
    if (result.error) {

        throw new Error(
            "Gagal mengambil profile: " +
            result.error.message
        );
    }

    /*
     * Profile tidak ditemukan.
     */
    if (!result.data) {

        await safeSignOut();

        throw new Error(
            "Profile belum ditemukan untuk akun ini."
        );
    }

    /*
     * Validasi terhadap Auth user.
     */
    const profile =
        validateProfile(
            result.data,
            user
        );

    /*
     * Simpan profile terbaru.
     */
    setCurrentProfile(
        profile
    );

    /*
     * Update badge menggunakan hasil
     * query Supabase terbaru.
     */
    updateAuthBadges(
        profile
    );

    /*
     * Setelah Supabase berhasil menjadi
     * source of truth, baru sinkronkan
     * global navigation/cache.
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
   ---------------------------------------------------------
   PENTING:
   - User boleh menggunakan navigation user
     sebagai cache untuk menghindari query Auth
     yang tidak perlu.
   - Profile TIDAK menggunakan navigation cache
     sebagai source of truth.
========================================================= */

export async function ensureAuthenticated() {

    /*
     * Pastikan shared client tersedia.
     */
    await loadSupabase();

    let user =
        getCurrentUser();

    /*
     * Jika state lokal kosong tetapi navigation
     * sudah membaca user, gunakan user tersebut
     * sebagai cache Auth.
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
     * Jika tetap belum ada, baca langsung
     * dari Supabase Auth.
     */
    if (!user) {

        user =
            await loadCurrentUser();
    }

    /*
     * =====================================================
     * PROFILE SELALU REFRESH DARI SUPABASE
     * =====================================================
     *
     * Jangan menggunakan:
     *
     * getCurrentProfile()
     *
     * sebagai alasan untuk melewati
     * loadProfile().
     *
     * Kalau profile sudah berubah di Supabase,
     * Generate harus melihat perubahan tersebut.
     */

    const profile =
        await loadProfile();

    /*
     * Pastikan badge menggunakan profile
     * hasil query Supabase.
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
   GET ROLE
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

        hasRole

    });


export default generateAuth;
