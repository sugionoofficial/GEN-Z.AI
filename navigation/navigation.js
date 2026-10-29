//navigation.js?v=2.2
/* =========================================================
   GEN-Z.AI
   SHARED NAVIGATION
   ---------------------------------------------------------
   File:
   navigation/navigation.js

   PATCH v2.2:
   - Tambah menu "Chinaapi" (Temp Mail) ke adminItems.
   - Tambah icon "chinaapi" (amplop/email).
========================================================= */

(() => {

    "use strict";


    function isDebugEnabled() {
        return (
            typeof window !== "undefined" &&
            window.GENZ_DEBUG === true
        );
    }


    function debugError(...args) {
        console.error(...args);
    }


    if (window.__GENZ_NAVIGATION_STARTED) {
        return;
    }

    window.__GENZ_NAVIGATION_STARTED = true;

    if (!window.__GENZ_THEME_SCRIPT_LOADING) {
        window.__GENZ_THEME_SCRIPT_LOADING = true;
        const themeScript = document.createElement("script");
        themeScript.src = "/assets/js/theme.js?v=navlockup-20261029";
        themeScript.onerror = error => {
            console.error("[GEN-Z.AI] Failed to load shared theme controls:", error);
            window.__GENZ_THEME_SCRIPT_LOADING = false;
        };
        document.head.appendChild(themeScript);
    }


    /*
     * BLACK BOX // MONITORING
     * Beacon ringan: error halaman + deteksi DevTools, dikirim ke
     * /api/monitoring. Dimuat sekali per halaman dan bisa dimatikan
     * dengan <html data-genz-monitoring="off">.
     */
    if (!window.__GENZ_MONITOR_SCRIPT_LOADING) {
        window.__GENZ_MONITOR_SCRIPT_LOADING = true;

        const monitoringOff =
            document.documentElement.dataset.genzMonitoring === "off";

        if (!monitoringOff) {
            const monitorScript = document.createElement("script");
            monitorScript.src = "/assets/js/security-beacon.js?v=beacon-20261029-3";
            monitorScript.defer = true;
            monitorScript.onerror = error => {
                console.warn("[GEN-Z.AI] Beacon monitoring tidak termuat:", error);
                window.__GENZ_MONITOR_SCRIPT_LOADING = false;
            };
            document.head.appendChild(monitorScript);
        }
    }


    const STYLE_ID = "genz-shared-navigation-style";

    const NAVIGATION_CONTAINER_IDS = [
        "genz-navigation",
        "navigation",
        "adminNavigation"
    ];

    const LOGIN_PATH = "/index.html";

    const PROFILE_RETRY_COUNT = 3;
    const PROFILE_RETRY_DELAY = 500;
    const TOKEN_REFRESH_BUFFER_SEC = 300;
    const SESSION_KEEPALIVE_INTERVAL_MS = 4 * 60 * 1000;
    const SESSION_BACKUP_STORAGE_KEY = "genz-auth-session-v1";
    const PROFILE_CACHE_STORAGE_KEY = "genz-auth-profile-cache-v1";
    const PRESENCE_HEARTBEAT_INTERVAL_MS = 20000;
    const PRESENCE_STALE_AFTER_MS = 90000;
    const PRESENCE_SESSION_STORAGE_KEY = "genz-presence-session-id";

    let currentUser = null;
    let currentProfile = null;
    let currentRole = "user";
    let navigationReady = false;
    let navigationReadyResolve;
    let documentKeydownBound = false;
    let sessionKeepAliveTimer = null;
    let sessionKeepAliveBound = false;
    let presenceHeartbeatTimer = null;
    let presenceVisibilityHandler = null;
    let presenceSessionId = null;

    const navigationReadyPromise = new Promise(resolve => {
        navigationReadyResolve = resolve;
    });


    function getProjectRef() {
        const config = window.GENZ_CONFIG;
        if (!config || !config.SUPABASE_URL) return null;
        const match = String(config.SUPABASE_URL).match(/https:\/\/([^.]+)/);
        return (match && match[1]) || null;
    }


    function getAuthStorageKey() {
        const projectRef = getProjectRef();
        return projectRef ? "sb-" + projectRef + "-auth-token" : null;
    }


    function decodeJwtExp(token) {
        try {
            if (typeof token !== "string") return 0;
            const parts = token.split(".");
            if (parts.length !== 3) return 0;
            let base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
            const mod = base64.length % 4;
            if (mod) base64 += "=".repeat(4 - mod);
            const payload = JSON.parse(atob(base64));
            const exp = Number(payload && payload.exp);
            return Number.isFinite(exp) && exp > 0 ? exp : 0;
        } catch (error) {
            return 0;
        }
    }


    function normalizeSessionObject(session, fallbackUser = null) {
        if (!session || typeof session !== "object" || !session.access_token) {
            return null;
        }

        const nowSec = Math.floor(Date.now() / 1000);
        const explicitExpiresAt = Number(session.expires_at);
        const expiresIn = Number(session.expires_in);
        const jwtExp = decodeJwtExp(session.access_token);
        const computedExpiresAt =
            (Number.isFinite(explicitExpiresAt) && explicitExpiresAt > 0
                ? explicitExpiresAt
                : 0) ||
            jwtExp ||
            (Number.isFinite(expiresIn) && expiresIn > 0
                ? nowSec + expiresIn
                : 0);

        const normalized = {
            ...session,
            token_type: session.token_type || "bearer",
            expires_at: computedExpiresAt || nowSec + 3600,
            user: session.user || fallbackUser || null
        };

        return normalized;
    }


    function saveSessionToStorage(session, fallbackUser = null) {
        try {
            const normalized = normalizeSessionObject(session, fallbackUser);
            if (!normalized) return null;

            const storageKey = getAuthStorageKey();
            const serialized = JSON.stringify(normalized);

            if (storageKey) {
                localStorage.setItem(storageKey, serialized);
            }
            localStorage.setItem(SESSION_BACKUP_STORAGE_KEY, serialized);

            return normalized;
        } catch (error) {
            return null;
        }
    }


    function saveProfileCache(profile) {
        try {
            if (!profile || !profile.id) return;
            localStorage.setItem(
                PROFILE_CACHE_STORAGE_KEY,
                JSON.stringify({
                    id: profile.id,
                    email: profile.email || "",
                    name: profile.name || "",
                    role: profile.role || "USER",
                    credits: Number(profile.credits || 0),
                    status: profile.status || "active",
                    cachedAt: Date.now()
                })
            );
        } catch (error) {
            /* ignore storage quota/privacy restrictions */
        }
    }


    function readProfileCache(userId) {
        try {
            const raw = localStorage.getItem(PROFILE_CACHE_STORAGE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed || String(parsed.id) !== String(userId)) {
                return null;
            }
            return parsed;
        } catch (error) {
            return null;
        }
    }


    function wrapClientSignOut(client) {
        if (!client || !client.auth || client.auth.__genzWrappedSignOut) {
            return client;
        }

        const originalSignOut = client.auth.signOut.bind(client.auth);
        client.auth.signOut = async (...args) => {
            clearSessionStorage();
            try {
                return await Promise.race([
                    originalSignOut(...args),
                    new Promise(resolve =>
                        setTimeout(() => resolve({ error: null }), 2500)
                    )
                ]);
            } catch (error) {
                return { error: null };
            }
        };
        client.auth.__genzWrappedSignOut = true;

        return client;
    }


    async function syncSupabaseClientSession(session) {
        if (!session || !session.access_token || !session.refresh_token) {
            return;
        }

        const client = window.GENZ_SUPABASE || window.supabaseClient;
        if (!client || !client.auth) return;

        try {
            client.realtime?.setAuth?.(session.access_token);
        } catch (error) {
            /* ignore realtime sync errors */
        }

        try {
            const { data } = await client.auth.getSession();
            if (data?.session?.access_token === session.access_token) {
                return;
            }
            await client.auth.setSession({
                access_token: session.access_token,
                refresh_token: session.refresh_token
            });
        } catch (error) {
            if (isDebugEnabled()) {
                console.warn("[GEN-Z.AI] syncSupabaseClientSession warning:", error);
            }
        }
    }


    function syncNavigationGlobals() {
        window.GENZ_NAVIGATION_USER = currentUser || null;
        window.GENZ_NAVIGATION_PROFILE = currentProfile || null;
        window.GENZ_NAVIGATION_ROLE = normalizeRole(currentRole);
        window.GENZ_CURRENT_PROFILE = currentProfile || null;
    }


    function getSupabaseClient() {

        if (window.GENZ_SUPABASE) {
            return wrapClientSignOut(window.GENZ_SUPABASE);
        }
        if (window.supabaseClient) {
            return wrapClientSignOut(window.supabaseClient);
        }

        const supabaseGlobal = window.supabase;
        const config = window.GENZ_CONFIG;

        if (!supabaseGlobal || typeof supabaseGlobal.createClient !== "function") {
            return null;
        }

        if (!config || !config.SUPABASE_URL) return null;

        const supabaseKey = config.SUPABASE_KEY || config.SUPABASE_ANON_KEY;
        if (!supabaseKey) return null;

        /*
         * Pastikan session yang tersimpan memiliki expires_at numerik yang valid
         * sebelum GoTrueClient melakukan inisialisasi agar session tidak dihapus
         * oleh _recoverAndRefresh().
         */
        readSessionFromStorage();

        try {
            const client = wrapClientSignOut(
                supabaseGlobal.createClient(
                    config.SUPABASE_URL,
                    supabaseKey,
                    {
                        auth: {
                            persistSession: true,
                            autoRefreshToken: false,
                            detectSessionInUrl: false,
                            lock: async (_n, _t, fn) => await fn()
                        }
                    }
                )
            );

            window.GENZ_SUPABASE = client;
            window.supabaseClient = client;

            return client;
        } catch (error) {
            debugError("[GEN-Z.AI] Supabase client error:", error);
            return null;
        }
    }


    function readSessionFromStorage() {

        try {
            const key = getAuthStorageKey();
            if (!key) return null;

            let raw = localStorage.getItem(key);
            let restoredFromBackup = false;

            if (!raw) {
                raw = localStorage.getItem(SESSION_BACKUP_STORAGE_KEY);
                restoredFromBackup = Boolean(raw);
            }

            if (!raw) return null;

            const parsed = JSON.parse(raw);
            if (!parsed || !parsed.access_token) return null;

            const needsRepair =
                !Number.isFinite(Number(parsed.expires_at)) ||
                Number(parsed.expires_at) <= 0;
            const normalized = normalizeSessionObject(parsed);
            if (!normalized) return null;

            if (restoredFromBackup || needsRepair) {
                localStorage.setItem(key, JSON.stringify(normalized));
            }
            if (!localStorage.getItem(SESSION_BACKUP_STORAGE_KEY)) {
                localStorage.setItem(
                    SESSION_BACKUP_STORAGE_KEY,
                    JSON.stringify(normalized)
                );
            }

            return normalized;
        } catch (error) {
            return null;
        }
    }


    function clearSessionStorage() {

        try {
            localStorage.removeItem(SESSION_BACKUP_STORAGE_KEY);
            localStorage.removeItem(PROFILE_CACHE_STORAGE_KEY);

            const key = getAuthStorageKey();
            if (!key) return;

            localStorage.removeItem(key);
            localStorage.removeItem(key + "-user");
        } catch (error) {
            /* ignore */
        }
    }


    function getPresenceSessionId() {
        let sessionId =
            sessionStorage.getItem(
                PRESENCE_SESSION_STORAGE_KEY
            );

        if (!sessionId) {
            sessionId = crypto.randomUUID();
            sessionStorage.setItem(
                PRESENCE_SESSION_STORAGE_KEY,
                sessionId
            );
        }

        return sessionId;
    }


    async function writePresenceHeartbeat(userId, removeStale = false) {
        const supabase = getSupabaseClient();

        if (!supabase) {
            throw new Error(
                "Supabase client tidak tersedia untuk heartbeat presence."
            );
        }

        if (removeStale) {
            const staleBefore = new Date(
                Date.now() - PRESENCE_STALE_AFTER_MS
            ).toISOString();

            const { error: cleanupError } = await supabase
                .from("user_presence")
                .delete()
                .eq("user_id", userId)
                .lt("last_seen", staleBefore);

            if (cleanupError) {
                throw cleanupError;
            }
        }

        const { error } = await supabase
            .from("user_presence")
            .upsert(
                {
                    user_id: userId,
                    session_id: presenceSessionId
                },
                {
                    onConflict: "user_id,session_id"
                }
            );

        if (error) {
            throw error;
        }
    }


    function startPresenceTracking(userId) {
        if (!userId) return;

        if (
            presenceHeartbeatTimer &&
            currentUser &&
            String(currentUser.id) === String(userId)
        ) {
            return;
        }

        stopPresenceTracking();
        presenceSessionId = getPresenceSessionId();

        const heartbeat = async removeStale => {
            try {
                await writePresenceHeartbeat(
                    userId,
                    removeStale
                );
            } catch (error) {
                console.error(
                    "[GEN-Z.AI] User presence heartbeat failed:",
                    error
                );
            }
        };

        void heartbeat(true);

        presenceHeartbeatTimer = window.setInterval(
            () => {
                void heartbeat(false);
            },
            PRESENCE_HEARTBEAT_INTERVAL_MS
        );

        presenceVisibilityHandler = () => {
            if (!document.hidden) {
                void heartbeat(false);
            }
        };

        document.addEventListener(
            "visibilitychange",
            presenceVisibilityHandler
        );
    }


    async function stopPresenceTracking(removeCurrentSession = false) {
        if (presenceHeartbeatTimer) {
            window.clearInterval(presenceHeartbeatTimer);
            presenceHeartbeatTimer = null;
        }

        if (presenceVisibilityHandler) {
            document.removeEventListener(
                "visibilitychange",
                presenceVisibilityHandler
            );
            presenceVisibilityHandler = null;
        }

        if (
            removeCurrentSession &&
            currentUser?.id &&
            presenceSessionId
        ) {
            const supabase = getSupabaseClient();

            if (supabase) {
                const { error } = await supabase
                    .from("user_presence")
                    .delete()
                    .eq("user_id", currentUser.id)
                    .eq("session_id", presenceSessionId);

                if (error) {
                    console.error(
                        "[GEN-Z.AI] User presence cleanup failed:",
                        error
                    );
                }
            }
        }

        presenceSessionId = null;
    }


    async function ensureFreshToken(options = {}) {
        const force = Boolean(options && options.force);

        if (window.__GENZ_REFRESH_PROMISE__) {
            return await window.__GENZ_REFRESH_PROMISE__;
        }

        const runRefresh = async () => {
            try {
                const session = readSessionFromStorage();
                if (!session) return null;

                const nowSec = Math.floor(Date.now() / 1000);
                const expiresAt =
                    Number(session.expires_at) ||
                    decodeJwtExp(session.access_token);
                const secondsUntilExpiry = expiresAt
                    ? expiresAt - nowSec
                    : -1;

                /*
                 * Token masih panjang masa berlakunya dan tidak diminta force refresh:
                 * sinkronkan saja ke in-memory client tanpa memutar refresh_token.
                 * PENTING: JANGAN return lebih awal saat secondsUntilExpiry < 0!
                 * Justru saat access_token sudah kedaluwarsa (mis. aplikasi dibuka lagi
                 * setelah >1 jam / besok / minggu depan), refresh_token WAJIB ditukar!
                 */
                if (!force && secondsUntilExpiry >= TOKEN_REFRESH_BUFFER_SEC) {
                    await syncSupabaseClientSession(session);
                    return session;
                }

                if (!session.refresh_token) {
                    return secondsUntilExpiry >= 0 ? session : null;
                }

                const config = window.GENZ_CONFIG;
                const supabaseKey =
                    config && (config.SUPABASE_KEY || config.SUPABASE_ANON_KEY);
                if (!config || !config.SUPABASE_URL || !supabaseKey) {
                    return session;
                }

                const usedRefreshToken = session.refresh_token;

                const res = await fetch(
                    `${config.SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "apikey": supabaseKey
                        },
                        body: JSON.stringify({
                            refresh_token: usedRefreshToken
                        })
                    }
                );

                if (!res.ok) {
                    /*
                     * Cek dulu apakah tab lain sudah lebih dulu memutar refresh_token
                     * dan menyimpan token baru ke localStorage.
                     */
                    const latestStored = readSessionFromStorage();
                    const latestNowSec = Math.floor(Date.now() / 1000);
                    if (
                        latestStored &&
                        latestStored.access_token &&
                        (
                            latestStored.refresh_token !== usedRefreshToken ||
                            Number(latestStored.expires_at) > latestNowSec + 10
                        )
                    ) {
                        await syncSupabaseClientSession(latestStored);
                        return latestStored;
                    }

                    /*
                     * Hanya hapus sesi bila server Supabase secara eksplisit menolak
                     * refresh_token (400 / 401 / 403 — token dicabut / logout global).
                     * Gangguan jaringan / 5xx TIDAK BOLEH menghapus sesi user!
                     */
                    if (
                        res.status === 400 ||
                        res.status === 401 ||
                        res.status === 403
                    ) {
                        if (isDebugEnabled()) {
                            console.warn(
                                "[GEN-Z.AI] Refresh token ditolak server:",
                                res.status
                            );
                        }
                        clearSessionStorage();
                        return null;
                    }

                    if (isDebugEnabled()) {
                        console.warn(
                            "[GEN-Z.AI] Refresh token HTTP sementara gagal:",
                            res.status
                        );
                    }
                    return session;
                }

                const responseData = await res.json().catch(() => null);
                if (!responseData || !responseData.access_token) {
                    return session;
                }

                const refreshedAtSec = Math.floor(Date.now() / 1000);
                const expiresIn = Number(responseData.expires_in);
                const computedExpiresAt =
                    Number(responseData.expires_at) ||
                    (Number.isFinite(expiresIn) && expiresIn > 0
                        ? refreshedAtSec + expiresIn
                        : 0) ||
                    decodeJwtExp(responseData.access_token) ||
                    refreshedAtSec + 3600;

                const nextSession = saveSessionToStorage(
                    {
                        ...session,
                        ...responseData,
                        expires_at: computedExpiresAt,
                        refresh_token:
                            responseData.refresh_token ||
                            session.refresh_token,
                        user: responseData.user || session.user
                    },
                    session.user
                );

                if (nextSession) {
                    await syncSupabaseClientSession(nextSession);
                    if (nextSession.user) {
                        currentUser = nextSession.user;
                        syncNavigationGlobals();
                    }
                }

                if (isDebugEnabled()) {
                    console.log("[GEN-Z.AI] Refresh token berhasil.");
                }

                return nextSession || session;
            } catch (error) {
                if (isDebugEnabled()) {
                    console.warn("[GEN-Z.AI] ensureFreshToken error:", error);
                }
                return readSessionFromStorage();
            }
        };

        const inflight = runRefresh().finally(() => {
            if (window.__GENZ_REFRESH_PROMISE__ === inflight) {
                window.__GENZ_REFRESH_PROMISE__ = null;
            }
        });
        window.__GENZ_REFRESH_PROMISE__ = inflight;

        return await inflight;
    }


    function delay(ms) {
        return new Promise(r => setTimeout(r, ms));
    }

    function getCurrentPath() {
        return window.location.pathname || "/";
    }

    function isLoginPage() {
        const path = getCurrentPath().toLowerCase();
        return (
            path === LOGIN_PATH ||
            path === "/login" ||
            path.endsWith("/login.html")
        );
    }

    function normalizeRole(role) {
        const value = String(role || "").trim().toLowerCase();

        if (value === "owner") return "owner";
        if (value === "admin" || value === "administrator") return "admin";
        return "user";
    }

    function isProfileActive(profile) {
        if (!profile) return false;

        if (
            profile.status === undefined ||
            profile.status === null ||
            String(profile.status).trim() === ""
        ) {
            return true;
        }

        const status = String(profile.status).trim().toLowerCase();

        return (
            status === "active" ||
            status === "approved" ||
            status === "enabled"
        );
    }


    async function getSessionWithRetry() {

        for (let attempt = 0; attempt < 2; attempt++) {
            await ensureFreshToken();

            const session = readSessionFromStorage();
            if (!session) {
                return { session: null, user: null };
            }

            const nowSec = Math.floor(Date.now() / 1000);

            if (!session.expires_at || session.expires_at >= nowSec) {
                return { session, user: session.user };
            }

            /*
             * Jika access_token sudah kedaluwarsa tetapi refresh_token MASIH ADA
             * (artinya refresh baru saja terkendala sinyal/jaringan sesaat),
             * coba ulang sekali lagi sebelum menyerah, dan JANGAN hapus localStorage!
             */
            if (!session.refresh_token) {
                return { session: null, user: null };
            }

            if (attempt === 0) {
                await delay(700);
            }
        }

        /*
         * Bila perangkat sedang offline / sinyal putus sementara tetapi user sudah
         * punya sesi tersimpan yang belum logout, pertahankan sesi lokal agar user
         * tidak dipaksa mengetik email & password ulang.
         */
        const fallbackSession = readSessionFromStorage();
        if (fallbackSession && fallbackSession.refresh_token && fallbackSession.user) {
            return { session: fallbackSession, user: fallbackSession.user };
        }

        return { session: null, user: null };
    }


    async function loadProfile(userId) {

        const supabase = getSupabaseClient();
        if (!supabase || !userId) return readProfileCache(userId);

        let lastError = null;

        for (let attempt = 0; attempt < PROFILE_RETRY_COUNT; attempt++) {
            try {
                let result = await supabase
                    .from("profiles")
                    .select("id,email,name,role,credits,status")
                    .eq("id", userId)
                    .maybeSingle();

                if (
                    result.error &&
                    (
                        String(result.error.message || "")
                            .toLowerCase()
                            .includes("status") ||
                        String(result.error.message || "")
                            .toLowerCase()
                            .includes("schema cache")
                    )
                ) {
                    result = await supabase
                        .from("profiles")
                        .select("id,email,name,role,credits")
                        .eq("id", userId)
                        .maybeSingle();
                }

                if (!result.error && result.data) {
                    saveProfileCache(result.data);
                    return result.data;
                }

                if (!result.error && !result.data && attempt === 0) {
                    await ensureFreshToken({ force: true });
                    continue;
                }

                if (!result.error) {
                    return null;
                }

                lastError = result.error;
            } catch (error) {
                lastError = error;
            }

            if (attempt < PROFILE_RETRY_COUNT - 1) {
                await delay(PROFILE_RETRY_DELAY);
            }
        }

        if (lastError) {
            debugError("[GEN-Z.AI] Profile load error:", lastError);
            const cached = readProfileCache(userId);
            if (cached) {
                return cached;
            }
        }

        return null;
    }


    /* =====================================================
       NAVIGATION CONFIG (ICONS + ITEMS)
    ===================================================== */

    function getNavigationConfig(role) {

        const ICONS = Object.freeze({

            dashboard: `<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"></rect><rect x="14" y="3" width="7" height="7" rx="1.5"></rect><rect x="3" y="14" width="7" height="7" rx="1.5"></rect><rect x="14" y="14" width="7" height="7" rx="1.5"></rect></svg>`,

            generate: `<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15.5 4.5l4 4"></path><path d="M13.8 6.2L4 16l-1 4 4-1 9.8-9.8"></path><path d="M18.5 2.5v4"></path><path d="M20.5 4.5h-4"></path></svg>`,

            promptStudio: `<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2v3"></path><path d="m19 5-2 2"></path><path d="M22 12h-3"></path><path d="m19 19-2-2"></path><path d="M12 22v-3"></path><path d="m5 19 2-2"></path><path d="M2 12h3"></path><path d="m5 5 2 2"></path><circle cx="12" cy="12" r="3"></circle></svg>`,

            visionImage: `<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"></path><circle cx="12" cy="12" r="2.7"></circle></svg>`,

            visionVideo: `<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="13" height="14" rx="2"></rect><path d="M16 10l5-3v10l-5-3z"></path></svg>`,

            upscale: `<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6"></path><path d="M9 21H3v-6"></path><path d="M21 3l-7 7"></path><path d="M3 21l7-7"></path><path d="M9 9H5v4"></path><path d="M15 15h4v-4"></path></svg>`,

            viddra: `<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"></rect><path d="M10 9l5 3-5 3z"></path><path d="M7 2l2 2"></path><path d="M17 2l-2 2"></path></svg>`,

            history: `<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 12a8.5 8.5 0 1 0 2.5-6"></path><path d="M3.5 4.5v5h5"></path><path d="M12 7.5v5l3.5 2"></path></svg>`,

            socialStudio: `<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="M7 9h10"></path><path d="M7 13h6"></path><path d="M16 17l3-3-3-3"></path></svg>`,

            metadataCleaner: `<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 3h9l5 5v13H5z"></path><path d="M14 3v5h5"></path><path d="M8.5 15l2.2 2.2 4.8-5"></path></svg>`,

            topUp: `<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="M3 9h18"></path><path d="M12 12v5"></path><path d="M9.5 14.5h5"></path></svg>`,

            hubAdmin: `<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 21V9l8-5 8 5v12"></path><path d="M2 21h20"></path><path d="M8 21v-6h8v6"></path><path d="M8 10h.01"></path><path d="M12 10h.01"></path><path d="M16 10h.01"></path></svg>`,

            adminPanel: `<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l8 3v5c0 5.2-3.4 8.7-8 10-4.6-1.3-8-4.8-8-10V6z"></path><path d="M8.5 12l2.2 2.2 4.8-4.8"></path></svg>`,

            announcements: `<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 14V9a2 2 0 0 1 2-2h3l8-4v17l-8-4H6a2 2 0 0 1-2-2Z"></path><path d="m9 16 1.5 5h3L12 17"></path><path d="M20 8a5 5 0 0 1 0 7"></path></svg>`,

            chinaapi: `<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="5" width="19" height="14" rx="2"></rect><path d="m3 6.5 9 7 9-7"></path></svg>`,

            blackBox: `<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2.7 21 7v10l-9 4.3L3 17V7z"></path><path d="M3 7l9 4.3L21 7"></path><path d="M12 11.3v10"></path></svg>`,

            monitoring: `<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"></path><circle cx="12" cy="12" r="2.6"></circle><path d="M12 2v2"></path><path d="M22 12h-2"></path></svg>`

        });


        const commonUserItems = [
            { label: "Dashboard", href: "/user/dashboard.html", icon: ICONS.dashboard },
            { label: "Generate", href: "/generate/index.html", icon: ICONS.generate },
            { label: "Prompt Studio", href: "/prompt-studio/index.html", icon: ICONS.promptStudio },
            { label: "Vision Image", href: "/vision/index.html", icon: ICONS.visionImage },
            { label: "Vision Video", href: "/vision-video/index.html", icon: ICONS.visionVideo },
            { label: "Upscale Studio", href: "/upscale/index.html", icon: ICONS.upscale },
            { label: "VidDra FREE", href: "/viddra/index.html", icon: ICONS.viddra },
            { label: "History", href: "/history/index.html", icon: ICONS.history },
            { label: "Studio Medsos", href: "/admin-control/social-publisher.html", icon: ICONS.socialStudio },
            { label: "AI Metadata Cleaner", href: "/metadata-cleaner/index.html", icon: ICONS.metadataCleaner },
            { label: "Top Up", href: "/user/topup.html", icon: ICONS.topUp },
            { label: "Hub Admin", href: "/user/hub-admin.html", icon: ICONS.hubAdmin }
        ];


        const adminItems = [
            { label: "Dashboard", href: "/admin/dashboard/index.html", icon: ICONS.dashboard },
            { label: "Generate", href: "/generate/index.html", icon: ICONS.generate },
            { label: "Prompt Studio", href: "/prompt-studio/index.html", icon: ICONS.promptStudio },
            { label: "Vision Image", href: "/vision/index.html", icon: ICONS.visionImage },
            { label: "Vision Video", href: "/vision-video/index.html", icon: ICONS.visionVideo },
            { label: "Upscale Studio", href: "/upscale/index.html", icon: ICONS.upscale },
            { label: "VidDra FREE", href: "/viddra/index.html", icon: ICONS.viddra },
            { label: "History", href: "/history/index.html", icon: ICONS.history },
            { label: "Studio Medsos", href: "/admin-control/social-publisher.html", icon: ICONS.socialStudio },
            { label: "AI Metadata Cleaner", href: "/metadata-cleaner/index.html", icon: ICONS.metadataCleaner },
            { label: "TempMail", href: "/email.html", icon: ICONS.chinaapi },
            { label: "Admin Panel", href: "/admin-control/admin-panel.html", icon: ICONS.adminPanel },
            { label: "Informasi Penting", href: "/admin-control/announcements.html", icon: ICONS.announcements },
            { label: "Black Box", href: "/black-box/index.html", icon: ICONS.blackBox },
            { label: "Monitoring", href: "/admin-control/monitoring.html", icon: ICONS.monitoring }
        ];


        if (role === "admin" || role === "owner") {
            return adminItems;
        }

        return commonUserItems;
    }


    function getNavigationContainer() {

        for (const id of NAVIGATION_CONTAINER_IDS) {
            const existing = document.getElementById(id);
            if (existing) return existing;
        }

        const container = document.createElement("div");
        container.id = "genz-navigation";
        document.body.prepend(container);

        return container;
    }


    function isActiveLink(href) {

        const currentPath = getCurrentPath();

        if (href === currentPath) return true;

        try {
            const target = new URL(href, window.location.origin);
            const targetPath = target.pathname;

            if (targetPath === currentPath) return true;

            return (
                currentPath.startsWith(targetPath) &&
                targetPath !== "/"
            );
        } catch (error) {
            return false;
        }
    }


    function escapeHTML(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }


    function renderNavigation() {

        const container = getNavigationContainer();
        if (!container) return;

        syncNavigationGlobals();

        const items = getNavigationConfig(currentRole);

        const email = currentUser && currentUser.email
            ? currentUser.email
            : (
                currentProfile && currentProfile.email
                    ? currentProfile.email
                    : ""
            );

        const roleLabel = currentRole === "owner"
            ? "OWNER"
            : currentRole === "admin"
                ? "ADMIN"
                : "USER";

        const navigationItems = items.map(item => {

            const active = isActiveLink(item.href);

            return `
                <a class="genz-nav-item${active ? " active" : ""}" role="link" tabindex="0" data-genz-href="${escapeHTML(item.href)}" data-genz-nav-link="true"${active ? ' aria-current="page"' : ""}>
                    <span class="genz-nav-icon">${item.icon || ""}</span>
                    <span class="genz-nav-label">${escapeHTML(item.label)}</span>
                </a>
            `;

        }).join("");


        container.innerHTML = `
            <aside class="genz-sidebar" id="genz-sidebar" aria-label="GEN-Z.AI Navigation">
                <div class="genz-sidebar-header">
                    <div class="genz-brand">
                        <a class="genz-logo" role="link" tabindex="0" data-genz-href="/" aria-label="GEN-Z.AI — beranda">
                            <img
                                class="genz-logo-img"
                                src="/assets/brand/genz-ai-logo.png?v=genzai-logo-20261027"
                                alt="GEN-Z.AI"
                                width="720"
                                height="293"
                                decoding="async"
                                fetchpriority="high"
                            >
                        </a>
                    </div>
                    <button type="button" class="genz-mobile-close" id="genz-mobile-close" aria-label="Close menu">×</button>
                </div>
                <nav class="genz-nav" aria-label="Main navigation">${navigationItems}</nav>
                <div class="genz-sidebar-footer">
                    <a
                        class="genz-account-box"
                        role="link"
                        tabindex="0"
                        data-genz-href="/user/profile.html"
                        aria-label="Buka halaman profil akun"
                    >
                        <div class="genz-account-main">
                            <div class="genz-account-label">ACCOUNT</div>
                            <div class="genz-account-email">${escapeHTML(email)}</div>
                            <div class="genz-account-role">${escapeHTML(roleLabel)}</div>
                        </div>
                        <span class="genz-account-arrow" aria-hidden="true">→</span>
                    </a>
                    <button type="button" class="genz-logout-button" id="genz-logout-button">LOG OUT</button>
                </div>
            </aside>
            <button type="button" class="genz-mobile-toggle" id="genz-mobile-toggle" aria-label="Open menu" aria-controls="genz-sidebar" aria-expanded="false">
                <span></span><span></span><span></span>
            </button>
            <div class="genz-sidebar-overlay" id="genz-sidebar-overlay"></div>
        `;

        bindNavigationEvents();

        navigationReady = true;
        window.dispatchEvent(new Event("genz-account-navigation-ready"));

        if (navigationReadyResolve) {
            navigationReadyResolve(true);
            navigationReadyResolve = null;
        }
    }


    function bindNavigationEvents() {

        const sidebar = document.getElementById("genz-sidebar");
        const toggle = document.getElementById("genz-mobile-toggle");
        const closeButton = document.getElementById("genz-mobile-close");
        const overlay = document.getElementById("genz-sidebar-overlay");
        const logoutButton = document.getElementById("genz-logout-button");

        function openMobileNavigation() {
            if (!sidebar) return;
            sidebar.classList.add("open");
            if (overlay) overlay.classList.add("active");
            if (toggle) toggle.setAttribute("aria-expanded", "true");
            document.body.classList.add("genz-nav-open");
        }

        function closeMobileNavigation() {
            if (sidebar) sidebar.classList.remove("open");
            if (overlay) overlay.classList.remove("active");
            if (toggle) toggle.setAttribute("aria-expanded", "false");
            document.body.classList.remove("genz-nav-open");
        }

        if (toggle) {
            toggle.addEventListener("click", event => {
                event.preventDefault();
                if (sidebar && sidebar.classList.contains("open")) {
                    closeMobileNavigation();
                } else {
                    openMobileNavigation();
                }
            });
        }

        if (closeButton) {
            closeButton.addEventListener("click", event => {
                event.preventDefault();
                closeMobileNavigation();
            });
        }

        if (overlay) {
            overlay.addEventListener("click", closeMobileNavigation);
        }

        function navigateToTarget(targetHref, event) {
            if (!targetHref) return;
            closeMobileNavigation();
            if (event && (event.ctrlKey || event.metaKey || event.shiftKey)) {
                window.open(targetHref, "_blank", "noopener");
                return;
            }
            window.location.href = targetHref;
        }

        const navRoot = getNavigationContainer() || document;
        navRoot
            .querySelectorAll("[data-genz-href]")
            .forEach(link => {
                link.addEventListener("click", event => {
                    event.preventDefault();
                    navigateToTarget(link.getAttribute("data-genz-href"), event);
                });

                link.addEventListener("auxclick", event => {
                    if (event.button !== 1) return;
                    const targetHref = link.getAttribute("data-genz-href");
                    if (!targetHref) return;
                    event.preventDefault();
                    closeMobileNavigation();
                    window.open(targetHref, "_blank", "noopener");
                });

                link.addEventListener("keydown", event => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    navigateToTarget(link.getAttribute("data-genz-href"), event);
                });
            });

        if (logoutButton) {
            logoutButton.addEventListener("click", logoutUser);
        }

        if (!documentKeydownBound) {
            documentKeydownBound = true;

            document.addEventListener("keydown", event => {
                if (event.key === "Escape") {
                    const currentSidebar = document.getElementById("genz-sidebar");
                    const currentOverlay = document.getElementById("genz-sidebar-overlay");
                    const currentToggle = document.getElementById("genz-mobile-toggle");

                    if (currentSidebar) currentSidebar.classList.remove("open");
                    if (currentOverlay) currentOverlay.classList.remove("active");
                    if (currentToggle) currentToggle.setAttribute("aria-expanded", "false");

                    document.body.classList.remove("genz-nav-open");
                }
            });
        }
    }


    function stopSessionKeepAlive() {
        if (sessionKeepAliveTimer) {
            window.clearInterval(sessionKeepAliveTimer);
            sessionKeepAliveTimer = null;
        }
    }


    async function logoutUser() {

        stopSessionKeepAlive();
        await stopPresenceTracking(true);
        clearSessionStorage();

        const client = window.GENZ_SUPABASE || window.supabaseClient;
        if (client && client.auth && typeof client.auth.signOut === "function") {
            try {
                await Promise.race([
                    client.auth.signOut({ scope: "local" }),
                    delay(2000)
                ]);
            } catch (error) {
                /* ignore signOut network errors — storage already cleared */
            }
        }

        clearSessionStorage();

        currentUser = null;
        currentProfile = null;
        currentRole = "user";

        syncNavigationGlobals();

        if (!isLoginPage()) {
            window.location.href = LOGIN_PATH;
        }
    }


    function setupAuthListener() {
        stopSessionKeepAlive();

        sessionKeepAliveTimer = window.setInterval(() => {
            void ensureFreshToken();
        }, SESSION_KEEPALIVE_INTERVAL_MS);

        if (!sessionKeepAliveBound) {
            sessionKeepAliveBound = true;

            document.addEventListener("visibilitychange", () => {
                if (!document.hidden && currentUser) {
                    void ensureFreshToken();
                }
            });

            window.addEventListener("focus", () => {
                if (currentUser) {
                    void ensureFreshToken();
                }
            });

            window.addEventListener("online", () => {
                if (currentUser) {
                    void ensureFreshToken();
                }
            });

            window.addEventListener("storage", event => {
                const authKey = getAuthStorageKey();
                if (
                    event.key !== authKey &&
                    event.key !== SESSION_BACKUP_STORAGE_KEY
                ) {
                    return;
                }

                const latest = readSessionFromStorage();
                if (!latest) {
                    /*
                     * User klik Logout di tab lain -> sinkronkan logout ke tab ini.
                     */
                    if (currentUser && !isLoginPage()) {
                        stopSessionKeepAlive();
                        currentUser = null;
                        currentProfile = null;
                        currentRole = "user";
                        syncNavigationGlobals();
                        window.location.href = LOGIN_PATH;
                    }
                    return;
                }

                void syncSupabaseClientSession(latest);
            });
        }
    }


    async function validateAuthentication() {

        const { session, user } = await getSessionWithRetry();

        if (!session || !user) {
            currentUser = null;
            currentProfile = null;
            currentRole = "user";

            syncNavigationGlobals();

            if (!isLoginPage()) {
                window.location.href = LOGIN_PATH;
            }

            return false;
        }

        currentUser = user;
        startPresenceTracking(user.id);

        const profile = await loadProfile(user.id);

        if (profile) {
            currentProfile = profile;
            currentRole = normalizeRole(profile.role);

            syncNavigationGlobals();

            if (!isProfileActive(profile)) {
                await logoutUser();
                return false;
            }
        } else {
            currentProfile = null;
            currentRole = "user";

            syncNavigationGlobals();
        }

        return true;
    }


    function injectStyles() {

        if (document.getElementById(STYLE_ID)) return;

        const style = document.createElement("style");
        style.id = STYLE_ID;

        style.textContent = `

            :root {
                --genz-sidebar-width: 248px;
                --genz-red: #ff3030;
                --genz-red-bright: #ff4a4a;
            }

            * { box-sizing: border-box; }

            .genz-sidebar {
                position: fixed;
                top: 0; left: 0; bottom: 0;
                width: var(--genz-sidebar-width);
                z-index: 10000;
                display: flex;
                flex-direction: column;
                overflow: hidden;
                background: linear-gradient(180deg, #090a0f 0%, #07080b 100%);
                border-right: 1px solid rgba(255, 40, 40, .12);
                box-shadow: 8px 0 30px rgba(0, 0, 0, .32);
                color: #ffffff;
                font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            }

            .genz-sidebar-header {
                min-height: 82px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 15px 13px;
                border-bottom: 1px solid rgba(255, 255, 255, .05);
            }

            .genz-brand { min-width: 0; }

            /*
             * Logo sidebar: lockup lengkap GEN-Z.AI (chrome + aksen
             * merah) sebagai satu gambar, menggantikan mark Z +
             * teks "gen-z.ai". Ukuran mengikuti lebar sidebar supaya
             * tetap besar di desktop dan mengecil di layar HP.
             */

            .genz-logo {
                display: inline-flex;
                align-items: center;
                width: auto;
                max-width: 100%;
                min-height: 40px;
                padding: 0;
                border: 0;
                background: none;
                border-radius: 12px;
                text-decoration: none;
                cursor: pointer;
                user-select: none;
                -webkit-user-select: none;
                transition: opacity .18s ease;
            }

            .genz-logo:focus-visible {
                outline: 2px solid #00eaff;
                outline-offset: 4px;
                border-radius: 10px;
            }

            .genz-logo:hover { opacity: .85; }

            .genz-logo-img {
                display: block;
                width: 164px;
                max-width: 100%;
                height: auto;
                user-select: none;
                -webkit-user-drag: none;
            }

            .genz-mobile-close {
                display: none;
                width: 36px; height: 36px;
                padding: 0;
                border: 0;
                border-radius: 10px;
                background: rgba(255, 255, 255, .05);
                color: #ffffff;
                font-size: 25px;
                cursor: pointer;
            }

            .genz-mobile-close:hover {
                background: rgba(255, 40, 40, .15);
                color: var(--genz-red-bright);
            }

            .genz-nav {
                display: flex;
                flex-direction: column;
                gap: 4px;
                padding: 10px 10px 16px;
                overflow-x: hidden;
                overflow-y: auto;
            }

            .genz-nav-item {
                position: relative;
                display: flex;
                align-items: center;
                gap: 10px;
                min-height: 44px;
                padding: 10px 12px;
                border: 0;
                border-radius: 10px;
                color: rgba(255, 255, 255, .66);
                text-decoration: none;
                cursor: pointer;
                user-select: none;
                -webkit-user-select: none;
                overflow: hidden;
                isolation: isolate;
                transition:
                    color .3s ease,
                    background .3s ease,
                    box-shadow .3s ease,
                    transform .3s ease;
            }

            /* Electric blue border spinning around the block on hover */
            .genz-nav-item::before {
                content: "";
                position: absolute;
                top: 50%;
                left: 50%;
                width: 520px;
                height: 520px;
                background: conic-gradient(
                    from 0deg,
                    transparent 0deg,
                    transparent 300deg,
                    #00eaff 330deg,
                    #ffffff 345deg,
                    #00eaff 355deg,
                    transparent 360deg
                );
                transform: translate(-50%, -50%) rotate(0deg);
                animation: genz-nav-electric 2s linear infinite;
                animation-play-state: paused;
                opacity: 0;
                pointer-events: none;
                z-index: 0;
                transition: opacity .25s ease;
            }

            /* Inner background mask leaving a 2px glowing perimeter */
            .genz-nav-item::after {
                content: "";
                position: absolute;
                inset: 2px;
                background: #10151f;
                border-radius: 8px;
                opacity: 0;
                pointer-events: none;
                z-index: 1;
                transition: opacity .25s ease, background .25s ease;
            }

            .genz-nav-item.active {
                color: #ffffff;
                background: linear-gradient(90deg, rgba(255, 35, 35, .15), rgba(255, 35, 35, .04));
                box-shadow:
                    inset 3px 0 0 var(--genz-red),
                    inset 0 0 0 1px rgba(255, 50, 50, .28),
                    0 0 14px rgba(255, 0, 0, .05);
            }

            .genz-nav-item:hover,
            .genz-nav-item:focus-visible {
                z-index: 2;
                color: #ffffff;
                background: rgba(0, 234, 255, .12);
                transform: translateY(-2px);
                outline: none;
                box-shadow:
                    0 0 10px #00eaff,
                    0 0 25px rgba(0, 234, 255, .45);
            }

            .genz-nav-item:hover::before,
            .genz-nav-item:focus-visible::before {
                opacity: 1;
                animation-play-state: running;
            }

            .genz-nav-item:hover::after,
            .genz-nav-item:focus-visible::after {
                opacity: 1;
            }

            @keyframes genz-nav-electric {
                from {
                    transform: translate(-50%, -50%) rotate(0deg);
                }
                to {
                    transform: translate(-50%, -50%) rotate(360deg);
                }
            }

            html[data-genz-theme="light"][data-genz-theme="light"] body .genz-nav-item::before {
                background: conic-gradient(
                    from 0deg,
                    transparent 0deg,
                    transparent 295deg,
                    #00d4ff 325deg,
                    #0066ff 345deg,
                    #00eaff 356deg,
                    transparent 360deg
                );
            }

            html[data-genz-theme="light"][data-genz-theme="light"] body .genz-nav-item::after {
                background: #f0f8ff;
            }

            html[data-genz-theme="light"][data-genz-theme="light"] body .genz-nav-item:hover,
            html[data-genz-theme="light"][data-genz-theme="light"] body .genz-nav-item:focus-visible {
                color: #0f172a;
                background: rgba(0, 180, 255, .16);
                transform: translateY(-2px);
                box-shadow:
                    0 0 10px rgba(0, 212, 255, .75),
                    0 0 24px rgba(0, 140, 255, .36);
            }

            html[data-genz-theme="light"][data-genz-theme="light"] body .genz-nav-item:hover .genz-nav-label,
            html[data-genz-theme="light"][data-genz-theme="light"] body .genz-nav-item:focus-visible .genz-nav-label {
                color: #0f172a;
            }

            .genz-nav-icon {
                position: relative;
                z-index: 2;
                width: 23px;
                flex: 0 0 23px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: currentColor;
            }

            .genz-nav-icon svg {
                display: block;
                width: 19px; height: 19px;
                color: currentColor;
            }

            .genz-nav-label {
                position: relative;
                z-index: 2;
                min-width: 0;
                font-size: 12px;
                font-weight: 600;
                line-height: 1.3;
            }

            .genz-sidebar-footer {
                margin-top: auto;
                padding: 12px 10px 14px;
                border-top: 1px solid rgba(255, 255, 255, .05);
            }

            /* =====================================================
               FOOTER BLOCKS — BRIGHT NEON RED ROTATING BORDER
               (.genz-theme-toggle, .genz-refresh-button,
                .genz-account-box, .genz-logout-button)
            ===================================================== */

            .genz-sidebar-footer .genz-theme-toggle,
            .genz-sidebar-footer .genz-refresh-button {
                position: relative;
                overflow: hidden;
                isolation: isolate;
                border: 0;
                border-radius: 10px;
                padding: 9px 12px;
                color: #ffffff;
                background: rgba(255, 255, 255, .04);
                box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .16);
                transition:
                    color .3s ease,
                    background .3s ease,
                    box-shadow .3s ease,
                    transform .3s ease;
            }

            .genz-account-box {
                position: relative;
                overflow: hidden;
                isolation: isolate;
                display: flex;
                align-items: center;
                gap: 8px;
                width: 100%;
                margin: 0 0 10px;
                padding: 11px 12px;
                border: 0;
                border-radius: 10px;
                background: rgba(255, 255, 255, .025);
                box-shadow: inset 0 0 0 1px rgba(255, 50, 50, .18);
                color: inherit;
                text-decoration: none;
                cursor: pointer;
                user-select: none;
                -webkit-user-select: none;
                transition:
                    color .3s ease,
                    background .3s ease,
                    box-shadow .3s ease,
                    transform .3s ease;
            }

            .genz-account-main {
                position: relative;
                z-index: 2;
                min-width: 0;
                flex: 1 1 auto;
            }

            .genz-account-arrow {
                position: relative;
                z-index: 2;
                flex: 0 0 auto;
                color: rgba(255, 255, 255, .38);
                font-size: 12px;
                line-height: 1;
                transition: color .22s ease, transform .22s ease;
            }

            .genz-account-box:hover .genz-account-arrow,
            .genz-account-box:focus-visible .genz-account-arrow {
                color: #ff5263;
                transform: translateX(2px);
            }

            .genz-account-label {
                margin-bottom: 5px;
                color: rgba(255, 255, 255, .45);
                font-size: 9px;
                font-weight: 800;
                letter-spacing: 1.2px;
                transition: color .22s ease;
            }

            .genz-account-email {
                overflow: hidden;
                color: rgba(255, 255, 255, .72);
                font-size: 10px;
                font-weight: 600;
                text-overflow: ellipsis;
                white-space: nowrap;
                transition: color .22s ease;
            }

            .genz-account-box:hover .genz-account-label,
            .genz-account-box:focus-visible .genz-account-label {
                color: rgba(255, 255, 255, .72);
            }

            .genz-account-box:hover .genz-account-email,
            .genz-account-box:focus-visible .genz-account-email {
                color: #ffffff;
            }

            .genz-account-role {
                display: inline-block;
                margin-top: 5px;
                padding: 2px 6px;
                border: 1px solid rgba(255, 50, 50, .28);
                border-radius: 5px;
                color: #ff6565;
                background: rgba(255, 0, 0, .06);
                font-size: 8px;
                font-weight: 800;
                letter-spacing: .8px;
            }

            .genz-logout-button {
                position: relative;
                overflow: hidden;
                isolation: isolate;
                width: 100%;
                min-height: 42px;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 10px 12px;
                border: 0;
                border-radius: 10px;
                color: #ff3b3b;
                background: rgba(255, 0, 0, .025);
                box-shadow: inset 0 0 0 1px rgba(255, 50, 50, .25);
                font: inherit;
                font-size: 12px;
                font-weight: 800;
                letter-spacing: .8px;
                cursor: pointer;
                transition:
                    color .3s ease,
                    background .3s ease,
                    box-shadow .3s ease,
                    transform .3s ease;
            }

            .genz-sidebar-footer .genz-theme-toggle::before,
            .genz-sidebar-footer .genz-refresh-button::before,
            .genz-account-box::before,
            .genz-logout-button::before {
                content: "";
                position: absolute;
                top: 50%;
                left: 50%;
                width: 520px;
                height: 520px;
                background: conic-gradient(
                    from 0deg,
                    transparent 0deg,
                    transparent 295deg,
                    #ff1a35 325deg,
                    #ff5263 338deg,
                    #ffffff 347deg,
                    #ff1a35 356deg,
                    transparent 360deg
                );
                transform: translate(-50%, -50%) rotate(0deg);
                animation: genz-nav-electric 2s linear infinite;
                animation-play-state: paused;
                opacity: 0;
                pointer-events: none;
                z-index: -2;
                transition: opacity .25s ease;
            }

            .genz-sidebar-footer .genz-theme-toggle::after,
            .genz-sidebar-footer .genz-refresh-button::after,
            .genz-account-box::after,
            .genz-logout-button::after {
                content: "";
                position: absolute;
                inset: 2px;
                background: #140d12;
                border-radius: 8px;
                opacity: 0;
                pointer-events: none;
                z-index: -1;
                transition: opacity .25s ease, background .25s ease;
            }

            .genz-sidebar-footer .genz-theme-toggle:hover,
            .genz-sidebar-footer .genz-theme-toggle:focus-visible,
            .genz-sidebar-footer .genz-refresh-button:hover,
            .genz-sidebar-footer .genz-refresh-button:focus-visible,
            .genz-account-box:hover,
            .genz-account-box:focus-visible,
            .genz-logout-button:hover,
            .genz-logout-button:focus-visible {
                z-index: 2;
                color: #ffffff;
                background: rgba(255, 26, 53, .16);
                border-color: transparent;
                transform: translateY(-2px);
                outline: none;
                box-shadow:
                    0 0 12px #ff1e38,
                    0 0 26px rgba(255, 30, 56, .55);
            }

            .genz-sidebar-footer .genz-theme-toggle:hover::before,
            .genz-sidebar-footer .genz-theme-toggle:focus-visible::before,
            .genz-sidebar-footer .genz-refresh-button:hover::before,
            .genz-sidebar-footer .genz-refresh-button:focus-visible::before,
            .genz-account-box:hover::before,
            .genz-account-box:focus-visible::before,
            .genz-logout-button:hover::before,
            .genz-logout-button:focus-visible::before {
                opacity: 1;
                animation-play-state: running;
            }

            .genz-sidebar-footer .genz-theme-toggle:hover::after,
            .genz-sidebar-footer .genz-theme-toggle:focus-visible::after,
            .genz-sidebar-footer .genz-refresh-button:hover::after,
            .genz-sidebar-footer .genz-refresh-button:focus-visible::after,
            .genz-account-box:hover::after,
            .genz-account-box:focus-visible::after,
            .genz-logout-button:hover::after,
            .genz-logout-button:focus-visible::after {
                opacity: 1;
            }

            /* Light mode overrides for footer neon red blocks */
            html[data-genz-theme="light"][data-genz-theme="light"] body .genz-sidebar-footer .genz-theme-toggle,
            html[data-genz-theme="light"][data-genz-theme="light"] body .genz-sidebar-footer .genz-refresh-button {
                color: #1e293b;
                background: #ffffff;
                border: 0;
                box-shadow:
                    inset 0 0 0 1px #cbd5e1,
                    0 4px 14px rgba(15, 23, 42, .06);
            }

            html[data-genz-theme="light"][data-genz-theme="light"] body .genz-account-box {
                color: #101828;
                background: #f8f9fd;
                border: 0;
                box-shadow: inset 0 0 0 1px rgba(23, 32, 51, .14);
            }

            html[data-genz-theme="light"][data-genz-theme="light"] body .genz-account-box .genz-account-label {
                color: #55617a;
            }

            html[data-genz-theme="light"][data-genz-theme="light"] body .genz-account-box .genz-account-email {
                color: #101828;
            }

            html[data-genz-theme="light"][data-genz-theme="light"] body .genz-account-box .genz-account-role {
                border-color: rgba(180, 35, 47, .3);
                background: #fdf1f2;
                color: #b4232f;
            }

            html[data-genz-theme="light"][data-genz-theme="light"] body .genz-account-box .genz-account-arrow {
                color: #8a94a6;
            }

            html[data-genz-theme="light"][data-genz-theme="light"] body .genz-logout-button {
                color: #dc2626;
                background: #fff5f5;
                border: 0;
                box-shadow: inset 0 0 0 1px rgba(220, 38, 38, .28);
            }

            html[data-genz-theme="light"][data-genz-theme="light"] body .genz-sidebar-footer .genz-theme-toggle::before,
            html[data-genz-theme="light"][data-genz-theme="light"] body .genz-sidebar-footer .genz-refresh-button::before,
            html[data-genz-theme="light"][data-genz-theme="light"] body .genz-account-box::before,
            html[data-genz-theme="light"][data-genz-theme="light"] body .genz-logout-button::before {
                background: conic-gradient(
                    from 0deg,
                    transparent 0deg,
                    transparent 290deg,
                    #ff1744 322deg,
                    #ff6b6b 340deg,
                    #d50029 352deg,
                    #ff1744 357deg,
                    transparent 360deg
                );
            }

            html[data-genz-theme="light"][data-genz-theme="light"] body .genz-sidebar-footer .genz-theme-toggle::after,
            html[data-genz-theme="light"][data-genz-theme="light"] body .genz-sidebar-footer .genz-refresh-button::after,
            html[data-genz-theme="light"][data-genz-theme="light"] body .genz-account-box::after,
            html[data-genz-theme="light"][data-genz-theme="light"] body .genz-logout-button::after {
                background: #fff5f6;
            }

            html[data-genz-theme="light"][data-genz-theme="light"] body .genz-sidebar-footer .genz-theme-toggle:hover,
            html[data-genz-theme="light"][data-genz-theme="light"] body .genz-sidebar-footer .genz-theme-toggle:focus-visible,
            html[data-genz-theme="light"][data-genz-theme="light"] body .genz-sidebar-footer .genz-refresh-button:hover,
            html[data-genz-theme="light"][data-genz-theme="light"] body .genz-sidebar-footer .genz-refresh-button:focus-visible,
            html[data-genz-theme="light"][data-genz-theme="light"] body .genz-account-box:hover,
            html[data-genz-theme="light"][data-genz-theme="light"] body .genz-account-box:focus-visible,
            html[data-genz-theme="light"][data-genz-theme="light"] body .genz-logout-button:hover,
            html[data-genz-theme="light"][data-genz-theme="light"] body .genz-logout-button:focus-visible {
                color: #0f172a;
                background: rgba(255, 23, 68, .18);
                border-color: transparent;
                transform: translateY(-2px);
                box-shadow:
                    0 0 11px rgba(255, 23, 68, .82),
                    0 0 25px rgba(255, 23, 68, .40);
            }

            html[data-genz-theme="light"][data-genz-theme="light"] body .genz-logout-button:hover,
            html[data-genz-theme="light"][data-genz-theme="light"] body .genz-logout-button:focus-visible {
                color: #b91c1c;
            }

            html[data-genz-theme="light"][data-genz-theme="light"] body .genz-account-box:hover .genz-account-email,
            html[data-genz-theme="light"][data-genz-theme="light"] body .genz-account-box:focus-visible .genz-account-email {
                color: #0f172a;
            }

            html[data-genz-theme="light"][data-genz-theme="light"] body .genz-account-box:hover .genz-account-arrow,
            html[data-genz-theme="light"][data-genz-theme="light"] body .genz-account-box:focus-visible .genz-account-arrow {
                color: #e11d48;
                transform: translateX(2px);
            }

            .genz-mobile-toggle {
                display: none;
                position: fixed;
                top: 12px; left: 12px;
                z-index: 10001;
                width: 44px; height: 44px;
                padding: 9px;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 5px;
                border: 1px solid rgba(255, 50, 50, .32);
                border-radius: 11px;
                background: rgba(10, 11, 15, .94);
                box-shadow: 0 0 18px rgba(255, 0, 0, .12);
                cursor: pointer;
                backdrop-filter: blur(12px);
            }

            .genz-mobile-toggle span {
                display: block;
                width: 20px; height: 2px;
                border-radius: 2px;
                background: #ffffff;
            }

            .genz-sidebar-overlay {
                display: none;
                position: fixed;
                inset: 0;
                z-index: 9998;
                background: rgba(0, 0, 0, .62);
                backdrop-filter: blur(2px);
            }

            .genz-sidebar-overlay.active { display: block; }

            @media (min-width: 769px) {
                body { padding-left: var(--genz-sidebar-width); }
            }

            @media (max-width: 768px) {
                .genz-sidebar {
                    width: min(290px, 86vw);
                    transform: translateX(-105%);
                    transition: transform .22s ease;
                    z-index: 10000;
                }
                .genz-sidebar.open { transform: translateX(0); }
                .genz-sidebar-header {
                    min-height: 72px;
                    align-items: flex-start;
                    padding: 13px 11px;
                }
                .genz-brand { flex: 1 1 auto; }
                .genz-logo { min-height: 34px; }
                .genz-logo-img { width: 140px; }
                .genz-mobile-close {
                    display: flex;
                    flex: 0 0 40px;
                    width: 40px;
                    height: 40px;
                    align-items: center;
                    justify-content: center;
                }
                .genz-mobile-toggle { display: flex; }
                body.genz-nav-open .genz-mobile-toggle {
                    visibility: hidden;
                    pointer-events: none;
                }
                body { padding-left: 0 !important; }
                body.genz-nav-open { overflow: hidden; }
            }

            @media (max-width: 480px) {
                .genz-logo { min-height: 30px; }
                .genz-logo-img { width: 126px; }
                .genz-nav { padding: 9px 8px 14px; }
                .genz-sidebar-footer { padding: 11px 8px 13px; }
                .genz-account-box { margin-bottom: 9px; }
            }
        `;

        document.head.appendChild(style);
    }


    async function initialize() {

        injectStyles();

        if (isLoginPage()) {
            navigationReady = true;

            if (navigationReadyResolve) {
                navigationReadyResolve(true);
                navigationReadyResolve = null;
            }

            return;
        }

        try {
            const authenticated = await validateAuthentication();

            if (!authenticated) {
                navigationReady = false;

                if (navigationReadyResolve) {
                    navigationReadyResolve(false);
                    navigationReadyResolve = null;
                }

                return;
            }

            syncNavigationGlobals();
            renderNavigation();
            setupAuthListener();

            navigationReady = true;

            if (navigationReadyResolve) {
                navigationReadyResolve(true);
                navigationReadyResolve = null;
            }
        } catch (error) {
            debugError("[GEN-Z.AI] Navigation initialization error:", error);

            navigationReady = false;
            syncNavigationGlobals();

            if (navigationReadyResolve) {
                navigationReadyResolve(false);
                navigationReadyResolve = null;
            }
        }
    }


    window.GENZSession = {
        ensureFreshSession: ensureFreshToken,
        readSession: readSessionFromStorage,
        saveSession: saveSessionToStorage,
        saveProfileCache: saveProfileCache,
        readProfileCache: readProfileCache,
        clearAllAuthStorage: clearSessionStorage,
        logout: logoutUser
    };


    window.GENZNavigation = {

        init: initialize,

        render: renderNavigation,

        logout: logoutUser,

        getUser: () => currentUser,

        getProfile: () => currentProfile,

        getRole: () => currentRole,

        readSession: readSessionFromStorage,

        ensureFreshToken: ensureFreshToken,

        cleanup: () => {
            stopSessionKeepAlive();
        },

        ready: navigationReadyPromise

    };


    window.GENZNavigationReady = navigationReadyPromise;


    syncNavigationGlobals();


    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initialize, { once: true });
    } else {
        initialize();
    }

})();
