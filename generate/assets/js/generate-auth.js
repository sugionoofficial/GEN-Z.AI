/* =========================================================
   GEN-Z.AI
   GENERATE AUTH MODULE
   ---------------------------------------------------------
   File:
   generate/assets/js/generate-auth.js

   PATCH v1.9 (FIX DEADLOCK TOTAL):
   - BYPASS GoTrueClient SEPENUHNYA.
   - getSession/getUser/getAccessToken dibaca langsung dari
     localStorage (tidak memanggil client.auth.*).
   - Refresh token via fetch langsung ke /auth/v1/token.
   - signOut via clear localStorage.
   - Database operations (profiles query) tetap pakai
     supabase client — aman karena database client tidak hang.
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
    "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.58.0/dist/umd/supabase.min.js";


const SUPABASE_SCRIPT_TIMEOUT_MS =
    15000;


const SUPABASE_SCRIPT_POLL_MS =
    50;


const TOKEN_REFRESH_BUFFER_SEC =
    60;


const VALID_ROLES = Object.freeze([
    "USER",
    "ADMIN",
    "OWNER"
]);


const ACTIVE_STATUS =
    "active";


const PROFILE_SELECT_COLUMNS_WITH_STATUS =
    "id,email,name,role,credits,status";


const PROFILE_SELECT_COLUMNS_WITHOUT_STATUS =
    "id,email,name,role,credits";


function isDebugEnabled() {

    return (
        typeof window !== "undefined" &&
        window.GENZ_DEBUG === true
    );

}


function debugLog(...args) {

    if (isDebugEnabled()) {

        console.log(...args);

    }

}


function debugWarn(...args) {

    console.warn(...args);

}


function debugError(...args) {

    console.error(...args);

}


function formatNumber(value) {

    const numeric = Number(value);

    if (!Number.isFinite(numeric)) {

        return String(value ?? "");

    }

    return new Intl.NumberFormat("id-ID").format(numeric);

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
        String(window.GENZ_CONFIG.SUPABASE_URL || "").trim();

    const key =
        String(window.GENZ_CONFIG.SUPABASE_KEY || "").trim();

    if (!url) {

        throw new Error("SUPABASE_URL tidak ditemukan.");

    }

    if (!key) {

        throw new Error("SUPABASE_KEY tidak ditemukan.");

    }

    return { url, key };

}


/* =========================================================
   READ SESSION FROM LOCALSTORAGE
   ---------------------------------------------------------
   FIX DEADLOCK:
   Baca session langsung dari localStorage, bypass
   GoTrueClient sepenuhnya.
========================================================= */

function readSessionFromStorage() {

    try {

        if (
            typeof window === "undefined" ||
            !window.GENZ_CONFIG ||
            !window.GENZ_CONFIG.SUPABASE_URL
        ) {

            return null;

        }

        const match =
            window.GENZ_CONFIG.SUPABASE_URL.match(
                /https:\/\/([^.]+)/
            );

        const projectRef =
            match && match[1];

        if (!projectRef) {

            return null;

        }

        const key =
            "sb-" + projectRef + "-auth-token";

        const raw =
            localStorage.getItem(key);

        if (!raw) {

            return null;

        }

        const session =
            JSON.parse(raw);

        if (
            !session ||
            !session.access_token
        ) {

            return null;

        }

        return session;

    } catch (error) {

        return null;

    }

}


function clearSessionStorage() {

    try {

        if (
            typeof window === "undefined" ||
            !window.GENZ_CONFIG ||
            !window.GENZ_CONFIG.SUPABASE_URL
        ) {

            return;

        }

        const match =
            window.GENZ_CONFIG.SUPABASE_URL.match(
                /https:\/\/([^.]+)/
            );

        const projectRef =
            match && match[1];

        if (projectRef) {

            localStorage.removeItem(
                "sb-" + projectRef + "-auth-token"
            );

        }

    } catch (error) {

        /* ignore */

    }

}


/* =========================================================
   LOAD SUPABASE SCRIPT
========================================================= */

function loadSupabaseScript() {

    return new Promise((resolve, reject) => {

        if (
            window.supabase &&
            typeof window.supabase.createClient === "function"
        ) {

            resolve(window.supabase);

            return;

        }


        const existingScript =
            document.querySelector(
                `script[src="${SUPABASE_CDN}"]`
            );


        if (existingScript) {

            const startedAt = Date.now();

            const check = () => {

                if (
                    window.supabase &&
                    typeof window.supabase.createClient ===
                        "function"
                ) {

                    resolve(window.supabase);

                    return;

                }

                if (
                    Date.now() - startedAt >=
                    SUPABASE_SCRIPT_TIMEOUT_MS
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
                    SUPABASE_SCRIPT_POLL_MS
                );

            };

            check();

            return;

        }


        const script =
            document.createElement("script");

        script.src = SUPABASE_CDN;
        script.async = true;

        script.onload = () => {

            if (
                window.supabase &&
                typeof window.supabase.createClient ===
                    "function"
            ) {

                resolve(window.supabase);

                return;

            }

            reject(
                new Error(
                    "Supabase JS dimuat tetapi API createClient tidak tersedia."
                )
            );

        };

        script.onerror = () => {

            reject(
                new Error("Gagal memuat Supabase JS.")
            );

        };

        document.head.appendChild(script);

    });

}


/* =========================================================
   CREATE SUPABASE CLIENT
   ---------------------------------------------------------
   Client ini dipakai untuk DATABASE operations saja
   (profiles query). Untuk AUTH, kita baca langsung dari
   localStorage.

   persistSession: false — supaya GoTrueClient tidak
   menyentuh localStorage sama sekali (menghindari konflik
   dengan navigation.js).
========================================================= */

function createSupabaseClient() {

    const { url, key } =
        getSupabaseConfig();

    if (
        !window.supabase ||
        typeof window.supabase.createClient !== "function"
    ) {

        throw new Error("Supabase JS belum tersedia.");

    }

    return window.supabase.createClient(
        url,
        key,
        {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false,
                lock: async (_n, _t, fn) => await fn()
            }
        }
    );

}


function isValidSupabaseClient(client) {

    return Boolean(
        client &&
        client.auth &&
        typeof client.auth.getSession === "function"
    );

}


/* =========================================================
   LOAD SUPABASE
========================================================= */

export async function loadSupabase() {

    const existingClient =
        getSupabaseClient();

    if (isValidSupabaseClient(existingClient)) {

        return existingClient;

    }


    if (
        isValidSupabaseClient(
            window.GENZ_SUPABASE
        )
    ) {

        setSupabaseClient(window.GENZ_SUPABASE);
        window.supabaseClient = window.GENZ_SUPABASE;

        return window.GENZ_SUPABASE;

    }


    if (
        isValidSupabaseClient(
            window.supabaseClient
        )
    ) {

        setSupabaseClient(window.supabaseClient);
        window.GENZ_SUPABASE = window.supabaseClient;

        return window.supabaseClient;

    }


    if (
        !window.supabase ||
        typeof window.supabase.createClient !==
            "function"
    ) {

        await loadSupabaseScript();

    }


    const client = createSupabaseClient();

    setSupabaseClient(client);

    window.GENZ_SUPABASE = client;
    window.supabaseClient = client;

    return client;

}


/* =========================================================
   GET CURRENT SESSION (BYPASS GoTrueClient)
========================================================= */

async function getCurrentSession() {

    const session =
        readSessionFromStorage();

    if (!session) {

        throw new Error(
            "Session tidak ditemukan. Silakan login kembali."
        );

    }

    return session;

}


/* =========================================================
   ENSURE FRESH TOKEN (via fetch langsung)
========================================================= */

async function ensureFreshToken() {

    try {

        const session =
            readSessionFromStorage();

        if (
            !session ||
            !session.expires_at ||
            !session.refresh_token
        ) {

            return;

        }

        const nowSec =
            Math.floor(Date.now() / 1000);

        const secondsUntilExpiry =
            session.expires_at - nowSec;

        if (
            secondsUntilExpiry >=
            TOKEN_REFRESH_BUFFER_SEC
        ) {

            debugLog(
                "[GEN-Z.AI][Auth] Token masih valid, " +
                secondsUntilExpiry +
                " detik lagi."
            );

            return;

        }

        if (secondsUntilExpiry < 0) {

            return;

        }

        debugLog(
            "[GEN-Z.AI][Auth] Refresh token manual " +
            "(expired in " +
            secondsUntilExpiry +
            "s)..."
        );

        const config = window.GENZ_CONFIG;

        const res =
            await fetch(
                `${config.SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "apikey": config.SUPABASE_KEY
                    },
                    body: JSON.stringify({
                        refresh_token: session.refresh_token
                    })
                }
            );

        if (!res.ok) {

            debugWarn(
                "[GEN-Z.AI][Auth] Refresh token HTTP error:",
                res.status
            );

            return;

        }

        const newSession =
            await res.json();

        if (
            !newSession ||
            !newSession.access_token
        ) {

            debugWarn(
                "[GEN-Z.AI][Auth] Refresh token response tidak valid."
            );

            return;

        }

        const match =
            config.SUPABASE_URL.match(
                /https:\/\/([^.]+)/
            );

        const projectRef =
            match && match[1];

        if (projectRef) {

            localStorage.setItem(
                "sb-" + projectRef + "-auth-token",
                JSON.stringify(newSession)
            );

        }

        debugLog(
            "[GEN-Z.AI][Auth] Refresh token berhasil."
        );

    } catch (error) {

        debugWarn(
            "[GEN-Z.AI][Auth] ensureFreshToken error:",
            error
        );

    }

}


/* =========================================================
   LOAD CURRENT USER (BYPASS GoTrueClient)
========================================================= */

export async function loadCurrentUser() {

    const session =
        readSessionFromStorage();

    if (!session || !session.user) {

        throw new Error(
            "Session user tidak ditemukan. Silakan login kembali."
        );

    }

    const user = session.user;

    setCurrentUser(user);

    window.GENZ_CURRENT_USER = user;
    window.GENZ_NAVIGATION_USER = user;

    return user;

}


/* =========================================================
   NORMALIZE ROLE / STATUS / CREDIT
========================================================= */

function normalizeRole(role) {

    return String(role || "")
        .trim()
        .toUpperCase();

}


function normalizeStatus(status) {

    return String(status || "")
        .trim()
        .toLowerCase();

}


function normalizeAccountCredit(credits) {

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

    const numeric = Number(credits);

    if (Number.isFinite(numeric)) {

        return {
            value: numeric,
            valid: true
        };

    }

    return {
        value: String(credits),
        valid: true
    };

}


function validateProfile(profile, user) {

    if (!profile || typeof profile !== "object") {

        throw new Error(
            "Profile akun belum ditemukan."
        );

    }

    if (!user?.id) {

        throw new Error(
            "User Auth tidak valid."
        );

    }

    if (
        String(profile.id || "") !==
        String(user.id)
    ) {

        throw new Error(
            "ID profile tidak sesuai dengan user."
        );

    }

    if (
        profile.status !== undefined &&
        profile.status !== null &&
        String(profile.status).trim() !== ""
    ) {

        if (
            normalizeStatus(profile.status) !==
            ACTIVE_STATUS
        ) {

            throw new Error("Akun tidak aktif.");

        }

    }

    const role =
        normalizeRole(profile.role);

    if (!VALID_ROLES.includes(role)) {

        throw new Error(
            "Role akun tidak valid."
        );

    }

    const accountCredit =
        normalizeAccountCredit(profile.credits);

    return {
        ...profile,
        role,
        credits:
            accountCredit.valid
                ? accountCredit.value
                : null
    };

}


function updateAuthBadges(profile) {

    const elements =
        getGenerateElements();

    if (!elements) {

        return;

    }

    const { roleBadge, creditBadge } = elements;

    if (roleBadge) {

        const role =
            normalizeRole(profile?.role);

        roleBadge.textContent =
            role || "-";

    }

    if (!creditBadge) {

        return;

    }

    const accountCredit =
        normalizeAccountCredit(profile?.credits);

    if (!accountCredit.valid) {

        creditBadge.textContent = "Credit: -";

        return;

    }

    if (typeof accountCredit.value === "number") {

        creditBadge.textContent =
            `Credit: ${formatNumber(accountCredit.value)}`;

        return;

    }

    creditBadge.textContent =
        `Credit: ${String(accountCredit.value)}`;

}


/* =========================================================
   LOAD PROFILE (via Supabase database — aman)
========================================================= */

async function queryProfileWithStatus(client, user) {

    return await client
        .from("profiles")
        .select(PROFILE_SELECT_COLUMNS_WITH_STATUS)
        .eq("id", user.id)
        .maybeSingle();

}


async function queryProfileWithoutStatus(client, user) {

    return await client
        .from("profiles")
        .select(PROFILE_SELECT_COLUMNS_WITHOUT_STATUS)
        .eq("id", user.id)
        .maybeSingle();

}


function isMissingStatusColumnError(error) {

    if (!error) {

        return false;

    }

    const message =
        String(error.message || "").toLowerCase();

    const details =
        String(error.details || "").toLowerCase();

    const hint =
        String(error.hint || "").toLowerCase();

    const combined =
        `${message} ${details} ${hint}`;

    return (
        combined.includes("profiles.status") ||
        (
            combined.includes("column") &&
            combined.includes("status") &&
            (
                combined.includes("does not exist") ||
                combined.includes("not exist")
            )
        )
    );

}


export async function loadProfile() {

    const client = getSupabaseClient();

    if (!isValidSupabaseClient(client)) {

        throw new Error(
            "Supabase client belum tersedia."
        );

    }

    const user = getCurrentUser();

    if (!user || !user.id) {

        throw new Error(
            "User belum terautentikasi."
        );

    }

    let result =
        await queryProfileWithStatus(client, user);

    if (
        result.error &&
        isMissingStatusColumnError(result.error)
    ) {

        result =
            await queryProfileWithoutStatus(client, user);

    }

    if (result.error) {

        throw new Error(
            "Gagal mengambil profile: " +
            result.error.message
        );

    }

    if (!result.data) {

        /*
         * Jangan panggil safeSignOut() di sini
         * karena client.auth.signOut() hang.
         * Cukup clear localStorage.
         */

        clearSessionStorage();

        throw new Error(
            "Profile belum ditemukan untuk akun ini."
        );

    }

    const profile =
        validateProfile(result.data, user);

    setCurrentProfile(profile);
    updateAuthBadges(profile);

    window.GENZ_NAVIGATION_PROFILE = profile;
    window.GENZ_CURRENT_PROFILE = profile;
    window.GENZ_NAVIGATION_ROLE = profile.role;
    window.GENZ_CURRENT_ROLE = profile.role;

    return profile;

}


/* =========================================================
   GET ACCESS TOKEN (BYPASS GoTrueClient)
========================================================= */

export async function getAccessToken() {

    const session =
        readSessionFromStorage();

    if (!session || !session.access_token) {

        throw new Error(
            "Access token tidak tersedia. Silakan login kembali."
        );

    }

    return String(session.access_token).trim();

}


/* =========================================================
   ENSURE AUTHENTICATED
========================================================= */

export async function ensureAuthenticated() {

    await loadSupabase();

    await ensureFreshToken();

    let user = getCurrentUser();

    if (!user && window.GENZ_NAVIGATION_USER) {

        user = window.GENZ_NAVIGATION_USER;
        setCurrentUser(user);

    }

    if (!user) {

        user = await loadCurrentUser();

    }

    const profile = await loadProfile();

    updateAuthBadges(profile);

    return { user, profile };

}


/* =========================================================
   SAFE SIGN OUT (BYPASS GoTrueClient)
========================================================= */

export async function safeSignOut() {

    /*
     * Jangan panggil client.auth.signOut() karena hang.
     * Cukup clear localStorage.
     */

    clearSessionStorage();

    setCurrentUser(null);
    setCurrentProfile(null);

    window.GENZ_CURRENT_USER = null;
    window.GENZ_NAVIGATION_USER = null;

    window.GENZ_CURRENT_PROFILE = null;
    window.GENZ_NAVIGATION_PROFILE = null;

}


/* =========================================================
   PUBLIC HELPERS
========================================================= */

export function getCurrentRole() {

    const profile = getCurrentProfile();

    if (!profile) {

        return null;

    }

    return normalizeRole(profile.role);

}


export function hasRole(...roles) {

    const currentRole = getCurrentRole();

    if (!currentRole) {

        return false;

    }

    return roles
        .map(normalizeRole)
        .includes(currentRole);

}


export function getCurrentAccountCredit() {

    const profile = getCurrentProfile();

    if (!profile) {

        return null;

    }

    const accountCredit =
        normalizeAccountCredit(profile.credits);

    if (!accountCredit.valid) {

        return null;

    }

    return accountCredit.value;

}


export function getUserId() {

    const user = getCurrentUser();

    if (!user) {

        return "";

    }

    return String(
        user.id || user.user?.id || ""
    ).trim();

}


export function getUserEmail() {

    const user = getCurrentUser();

    if (!user) {

        return "";

    }

    return String(
        user.email || user.user?.email || ""
    ).trim();

}


export async function refreshAccountCredit() {

    const profile = await loadProfile();

    return getCurrentAccountCredit();

}


/* =========================================================
   EXPORT
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

        getUserId,

        getUserEmail,

        refreshAccountCredit

    });


export default generateAuth;
