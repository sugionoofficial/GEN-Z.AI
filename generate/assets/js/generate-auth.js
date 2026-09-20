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

   Status valid:
   - active
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
                resolve(window.supabase);
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
    } = getSupabaseConfig();

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
   LOAD SUPABASE
========================================================= */

export async function loadSupabase() {

    const existingClient =
        getSupabaseClient();

    if (existingClient) {
        return existingClient;
    }

    /*
     * Prioritaskan client global yang mungkin
     * sudah dibuat oleh modul lain.
     */
    if (
        window.GENZ_SUPABASE &&
        typeof window.GENZ_SUPABASE.auth
            ?.getSession ===
            "function"
    ) {

        setSupabaseClient(
            window.GENZ_SUPABASE
        );

        window.supabaseClient =
            window.GENZ_SUPABASE;

        return window.GENZ_SUPABASE;
    }

    if (
        window.supabaseClient &&
        typeof window.supabaseClient.auth
            ?.getSession ===
            "function"
    ) {

        setSupabaseClient(
            window.supabaseClient
        );

        window.GENZ_SUPABASE =
            window.supabaseClient;

        return window.supabaseClient;
    }

    /*
     * Pastikan library Supabase tersedia.
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
     * Simpan satu client saja.
     * Ini penting agar session tidak dibuat
     * ulang oleh setiap modul.
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

    if (!client) {

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

    if (!client) {

        throw new Error(
            "Supabase client belum tersedia."
        );
    }

    const session =
        await getCurrentSession();

    /*
     * Validasi ulang user menggunakan access token.
     * Jangan hanya percaya object session di browser.
     */
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

    /*
     * Pastikan user dari Auth sama dengan
     * user yang berada pada session.
     */
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
     * profiles.id harus sama dengan
     * auth.users.id.
     */
    if (
        String(profile.id || "") !==
        String(user.id)
    ) {

        throw new Error(
            "ID profile tidak sesuai dengan user."
        );
    }

    /*
     * Generate hanya boleh digunakan oleh
     * akun yang aktif.
     */
    if (
        normalizeStatus(
            profile.status
        ) !== ACTIVE_STATUS
    ) {

        throw new Error(
            "Akun tidak aktif."
        );
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

    if (roleBadge) {

        roleBadge.textContent =
            profile.role ||
            "USER";
    }

    if (!creditBadge) {
        return;
    }

    const credits =
        profile.credits;

    if (
        credits === null ||
        credits === undefined ||
        credits === ""
    ) {

        creditBadge.textContent =
            "Credit: -";

        return;
    }

    const numericCredits =
        Number(credits);

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
     * Jangan membuat angka palsu jika
     * database mengirim nilai yang tidak
     * bisa dikonversi.
     */
    creditBadge.textContent =
        `Credit: ${String(
            credits
        )}`;
}


/* =========================================================
   LOAD PROFILE
========================================================= */

export async function loadProfile() {

    const client =
        getSupabaseClient();

    if (!client) {

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

    const {
        data,
        error
    } =
        await client
            .from("profiles")
            .select(
                "id,email,name,role,credits,status"
            )
            .eq(
                "id",
                user.id
            )
            .maybeSingle();

    if (error) {

        throw new Error(
            "Gagal mengambil profile: " +
            error.message
        );
    }

    /*
     * Jangan menggunakan {} sebagai profile
     * fallback. Profile kosong berarti
     * profile tidak ada.
     */
    if (!data) {

        await safeSignOut();

        throw new Error(
            "Profile belum ditemukan untuk akun ini."
        );
    }

    const profile =
        validateProfile(
            data,
            user
        );

    setCurrentProfile(
        profile
    );

    updateAuthBadges(
        profile
    );

    return profile;
}


/* =========================================================
   GET ACCESS TOKEN
========================================================= */

export async function getAccessToken() {

    const client =
        getSupabaseClient();

    if (!client) {

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

    const user =
        getCurrentUser();

    const profile =
        getCurrentProfile();

    if (
        user &&
        profile
    ) {
        return {
            user,
            profile
        };
    }

    await loadSupabase();

    const currentUser =
        getCurrentUser() ||
        await loadCurrentUser();

    const currentProfile =
        getCurrentProfile() ||
        await loadProfile();

    return {
        user: currentUser,
        profile: currentProfile
    };
}


/* =========================================================
   SAFE SIGN OUT
========================================================= */

export async function safeSignOut() {

    const client =
        getSupabaseClient();

    if (!client) {
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
        .map(normalizeRole)
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
