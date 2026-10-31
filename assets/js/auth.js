//auth.js?v=2.8
// ========================================
// GEN-Z.AI - SUPABASE AUTHENTICATION
// ========================================

(function () {

    "use strict";


    /* =========================================================
       PATCH v2.8 (FIX DEADLOCK):
       - autoRefreshToken: false  (sebelumnya true)
       - lock: no-op              (bypass Web Locks API)
       - detectSessionInUrl: true (untuk callback tautan email)
       - Expose client ke window.GENZ_SUPABASE
       - Refresh token manual via fetch
       ========================================================= */


    // =========================================================
    // CEK KONFIGURASI
    // =========================================================

    if (
        typeof window.GENZ_CONFIG === "undefined" ||
        !window.GENZ_CONFIG.SUPABASE_URL ||
        !window.GENZ_CONFIG.SUPABASE_KEY
    ) {

        console.error(
            "GEN-Z.AI: Konfigurasi Supabase tidak ditemukan."
        );

        const message =
            document.getElementById("loginMessage");

        if (message) {

            message.textContent =
                "Konfigurasi Supabase tidak ditemukan.";
        }

        return;
    }


    // =========================================================
    // CEK SUPABASE
    // =========================================================

    if (
        typeof window.supabase === "undefined" ||
        typeof window.supabase.createClient !== "function"
    ) {

        console.error(
            "GEN-Z.AI: Supabase JS belum dimuat."
        );

        const message =
            document.getElementById("loginMessage");

        if (message) {

            message.textContent =
                "Supabase belum berhasil dimuat.";
        }

        return;
    }


    const SESSION_BACKUP_STORAGE_KEY = "genz-auth-session-v1";
    const PROFILE_CACHE_STORAGE_KEY = "genz-auth-profile-cache-v1";
    const TOKEN_REFRESH_BUFFER_SEC = 300;


    function getProjectRef() {
        const match = String(window.GENZ_CONFIG.SUPABASE_URL || "").match(
            /https:\/\/([^.]+)/
        );
        return (match && match[1]) || null;
    }


    function getAuthStorageKey() {
        const ref = getProjectRef();
        return ref ? "sb-" + ref + "-auth-token" : null;
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
        } catch (_err) {
            return 0;
        }
    }


    function normalizeSessionObject(session, fallbackUser) {
        if (!session || typeof session !== "object" || !session.access_token) {
            return null;
        }
        const nowSec = Math.floor(Date.now() / 1000);
        const explicitExpiresAt = Number(session.expires_at);
        const expiresIn = Number(session.expires_in);
        const computedExpiresAt =
            (Number.isFinite(explicitExpiresAt) && explicitExpiresAt > 0
                ? explicitExpiresAt
                : 0) ||
            decodeJwtExp(session.access_token) ||
            (Number.isFinite(expiresIn) && expiresIn > 0
                ? nowSec + expiresIn
                : 0) ||
            nowSec + 3600;

        return {
            ...session,
            token_type: session.token_type || "bearer",
            expires_at: computedExpiresAt,
            user: session.user || fallbackUser || null
        };
    }


    function saveStoredSession(session, fallbackUser) {
        try {
            const normalized = normalizeSessionObject(session, fallbackUser);
            if (!normalized) return null;
            const serialized = JSON.stringify(normalized);
            const key = getAuthStorageKey();
            if (key) {
                localStorage.setItem(key, serialized);
            }
            localStorage.setItem(SESSION_BACKUP_STORAGE_KEY, serialized);
            return normalized;
        } catch (_err) {
            return null;
        }
    }


    function readStoredSession() {
        try {
            const key = getAuthStorageKey();
            if (!key) return null;
            let raw = localStorage.getItem(key);
            let fromBackup = false;
            if (!raw) {
                raw = localStorage.getItem(SESSION_BACKUP_STORAGE_KEY);
                fromBackup = Boolean(raw);
            }
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed || !parsed.access_token) return null;
            const needsRepair =
                !Number.isFinite(Number(parsed.expires_at)) ||
                Number(parsed.expires_at) <= 0;
            const normalized = normalizeSessionObject(parsed);
            if (!normalized) return null;
            if (fromBackup || needsRepair) {
                localStorage.setItem(key, JSON.stringify(normalized));
            }
            if (!localStorage.getItem(SESSION_BACKUP_STORAGE_KEY)) {
                localStorage.setItem(
                    SESSION_BACKUP_STORAGE_KEY,
                    JSON.stringify(normalized)
                );
            }
            return normalized;
        } catch (_err) {
            return null;
        }
    }


    function clearAllAuthStorage() {
        try {
            localStorage.removeItem(SESSION_BACKUP_STORAGE_KEY);
            localStorage.removeItem(PROFILE_CACHE_STORAGE_KEY);
            const key = getAuthStorageKey();
            if (key) {
                localStorage.removeItem(key);
                localStorage.removeItem(key + "-user");
            }
        } catch (_err) {
            /* ignore */
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
        } catch (_err) {
            /* ignore */
        }
    }


    function readProfileCache(userId) {
        try {
            const raw = localStorage.getItem(PROFILE_CACHE_STORAGE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed || (userId && String(parsed.id) !== String(userId))) {
                return null;
            }
            return parsed;
        } catch (_err) {
            return null;
        }
    }


    async function ensureFreshStoredSession(force) {
        if (window.__GENZ_REFRESH_PROMISE__) {
            return await window.__GENZ_REFRESH_PROMISE__;
        }

        const task = (async function () {
            const session = readStoredSession();
            if (!session) return { session: null, rejected: false };

            const nowSec = Math.floor(Date.now() / 1000);
            const expiresAt =
                Number(session.expires_at) || decodeJwtExp(session.access_token);
            const secondsLeft = expiresAt ? expiresAt - nowSec : -1;

            if (!force && secondsLeft >= TOKEN_REFRESH_BUFFER_SEC) {
                return { session, rejected: false };
            }

            if (!session.refresh_token) {
                return {
                    session: secondsLeft >= 0 ? session : null,
                    rejected: secondsLeft < 0
                };
            }

            const usedRefreshToken = session.refresh_token;

            try {
                const res = await fetch(
                    `${window.GENZ_CONFIG.SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "apikey": window.GENZ_CONFIG.SUPABASE_KEY
                        },
                        body: JSON.stringify({
                            refresh_token: usedRefreshToken
                        })
                    }
                );

                if (!res.ok) {
                    const latest = readStoredSession();
                    const latestNow = Math.floor(Date.now() / 1000);
                    if (
                        latest &&
                        latest.access_token &&
                        (
                            latest.refresh_token !== usedRefreshToken ||
                            Number(latest.expires_at) > latestNow + 10
                        )
                    ) {
                        return { session: latest, rejected: false };
                    }

                    if (
                        res.status === 400 ||
                        res.status === 401 ||
                        res.status === 403
                    ) {
                        clearAllAuthStorage();
                        return { session: null, rejected: true };
                    }

                    return { session, rejected: false, networkError: true };
                }

                const payload = await res.json().catch(() => null);
                if (!payload || !payload.access_token) {
                    return { session, rejected: false };
                }

                const refreshedSec = Math.floor(Date.now() / 1000);
                const expiresIn = Number(payload.expires_in);
                const nextExpiresAt =
                    Number(payload.expires_at) ||
                    (Number.isFinite(expiresIn) && expiresIn > 0
                        ? refreshedSec + expiresIn
                        : 0) ||
                    decodeJwtExp(payload.access_token) ||
                    refreshedSec + 3600;

                const saved = saveStoredSession(
                    {
                        ...session,
                        ...payload,
                        expires_at: nextExpiresAt,
                        refresh_token:
                            payload.refresh_token || session.refresh_token,
                        user: payload.user || session.user
                    },
                    session.user
                );

                return { session: saved || session, rejected: false };
            } catch (_networkErr) {
                return { session, rejected: false, networkError: true };
            }
        })().finally(function () {
            if (window.__GENZ_REFRESH_PROMISE__ === task) {
                window.__GENZ_REFRESH_PROMISE__ = null;
            }
        });

        window.__GENZ_REFRESH_PROMISE__ = task;
        return await task;
    }


    /*
     * Perbaiki struktur session tersimpan sebelum GoTrueClient melakukan init
     * agar session valid yang belum punya expires_at tidak dihapus otomatis.
     */
    readStoredSession();


    // =========================================================
    // SUPABASE CLIENT
    // ---------------------------------------------------------
    // FIX DEADLOCK:
    // - autoRefreshToken: false
    // - lock: no-op (langsung jalankan callback)
    // - detectSessionInUrl: true (menangani callback tautan email)
    // =========================================================

    const supabaseClient =
        window.supabase.createClient(
            window.GENZ_CONFIG.SUPABASE_URL,
            window.GENZ_CONFIG.SUPABASE_KEY,
            {
                auth: {
                    persistSession: true,
                    autoRefreshToken: false,
                    detectSessionInUrl: true,
                    lock: async (_name, _acquireTimeout, fn) => {

                        return await fn();

                    }
                }
            }
        );

    const rawSignOut = supabaseClient.auth.signOut.bind(supabaseClient.auth);
    supabaseClient.auth.signOut = async function (...args) {
        clearAllAuthStorage();
        try {
            return await Promise.race([
                rawSignOut(...args),
                new Promise(function (resolve) {
                    setTimeout(function () {
                        resolve({ error: null });
                    }, 2500);
                })
            ]);
        } catch (_err) {
            return { error: null };
        }
    };


    /* =========================================================
       EXPOSE CLIENT GLOBAL
       ---------------------------------------------------------
       Supaya halaman lain (navigation.js, generate-auth.js)
       pakai client yang sama, tidak bikin client baru.
       ========================================================= */

    window.GENZ_SUPABASE =
        supabaseClient;

    window.supabaseClient =
        supabaseClient;


    // =========================================================
    // ELEMENT
    // =========================================================

    const loginForm =
        document.getElementById("loginForm");

    const loginButton =
        document.getElementById("loginButton");

    const loginButtonText =
        document.getElementById("loginButtonText");

    const loginSpinner =
        document.getElementById("loginSpinner");

    const loginMessage =
        document.getElementById("loginMessage");

    const emailLinkButton =
        document.getElementById("emailLinkButton");

    const emailLinkCallback =
        new URLSearchParams(window.location.search)
            .get("auth") === "email-link";

    let emailLinkCallbackHandled = false;


    // =========================================================
    // LOGIN STATUS HOLOGRAM ELEMENT
    // =========================================================

    const loginStatusHologram =
        document.getElementById(
            "loginStatusHologram"
        );

    const loginStatusHologramText =
        document.getElementById(
            "loginStatusHologramText"
        );


    // =========================================================
    // HIDE LOGIN STATUS HOLOGRAM
    // =========================================================

    function hideLoginStatusHologram() {

        if (!loginStatusHologram) {
            return;
        }


        loginStatusHologram.classList.remove(
            "is-visible",
            "is-suspended",
            "is-banned"
        );


        loginStatusHologram.setAttribute(
            "aria-hidden",
            "true"
        );


        if (loginStatusHologramText) {

            loginStatusHologramText.textContent =
                "";
        }
    }


    // =========================================================
    // SHOW LOGIN STATUS HOLOGRAM
    // =========================================================

    function showLoginStatusHologram(status) {

        if (
            !loginStatusHologram ||
            !loginStatusHologramText
        ) {
            return;
        }


        const normalizedStatus =
            String(status || "")
                .trim()
                .toLowerCase();


        // =====================================================
        // SUSPENDED
        // =====================================================

        if (
            normalizedStatus === "suspended"
        ) {

            loginStatusHologramText.textContent =
                "SUSPENDED";


            loginStatusHologram.classList.remove(
                "is-banned"
            );


            loginStatusHologram.classList.add(
                "is-suspended",
                "is-visible"
            );


            loginStatusHologram.setAttribute(
                "aria-hidden",
                "false"
            );


            return;
        }


        // =====================================================
        // BANNED
        // =====================================================

        if (
            normalizedStatus === "banned"
        ) {

            loginStatusHologramText.textContent =
                "BANNED";


            loginStatusHologram.classList.remove(
                "is-suspended"
            );


            loginStatusHologram.classList.add(
                "is-banned",
                "is-visible"
            );


            loginStatusHologram.setAttribute(
                "aria-hidden",
                "false"
            );


            return;
        }


        // =====================================================
        // STATUS LAIN
        // =====================================================

        hideLoginStatusHologram();
    }


    // =========================================================
    // EXPOSE LOGIN STATUS HOLOGRAM
    // =========================================================

    window.GENZLoginStatusHologram =
        Object.freeze({

            show:
                showLoginStatusHologram,

            hide:
                hideLoginStatusHologram

        });


    // =========================================================
    // HELPER MESSAGE
    // =========================================================

    function showMessage(message) {

        if (loginMessage) {

            loginMessage.textContent =
                message;
        }
    }


    // =========================================================
    // SET LOADING
    // =========================================================

    function setLoading(loading) {

        if (!loginButton) {
            return;
        }


        loginButton.disabled =
            loading;


        if (loginButtonText) {

            loginButtonText.textContent =
                loading
                    ? "MEMPROSES..."
                    : "LOGIN";
        }


        if (loginSpinner) {

            loginSpinner.classList.toggle(
                "active",
                loading
            );
        }


        loginButton.classList.toggle(
            "loading",
            loading
        );
    }


    // =========================================================
    // FRIENDLY AUTH ERROR
    // =========================================================

    function getFriendlyAuthError(error) {

        if (!error) {
            return "Login gagal.";
        }


        const message =
            String(
                error.message || ""
            ).toLowerCase();

        if (
            message.includes(
                "invalid login credentials"
            )
        ) {

            return (
                "Email atau password salah."
            );
        }


        if (
            message.includes(
                "email not confirmed"
            )
        ) {

            return (
                "Email akun belum dikonfirmasi."
            );
        }


        if (
            message.includes(
                "too many requests"
            )
        ) {

            return (
                "Terlalu banyak percobaan. Silakan tunggu beberapa saat."
            );
        }


        if (
            message.includes("network") ||
            message.includes("fetch")
        ) {

            return (
                "Koneksi bermasalah. Periksa internet lalu coba lagi."
            );
        }


        return (
            error.message ||
            "Login gagal."
        );
    }


    // =========================================================
    // CEK FORM
    // =========================================================

    if (!loginForm) {

        console.error(
            "GEN-Z.AI: Form login #loginForm tidak ditemukan."
        );

        return;
    }

    if (emailLinkButton) {
        emailLinkButton.addEventListener(
            "click",
            async function () {

                const emailElement =
                    document.getElementById("email");

                const email =
                    emailElement?.value
                        .trim()
                        .toLowerCase();

                if (
                    !emailElement ||
                    !email ||
                    !emailElement.checkValidity()
                ) {
                    emailElement?.reportValidity();
                    return;
                }

                emailLinkButton.disabled = true;
                showMessage("Mengirim tautan masuk ke email...");

                try {
                    const { error } =
                        await supabaseClient.auth
                            .signInWithOtp({
                                email,
                                options: {
                                    shouldCreateUser: false,
                                    emailRedirectTo: new URL(
                                        "login.html?auth=email-link",
                                        window.GENZ_CONFIG.SITE_URL
                                    ).href
                                }
                            });

                    if (error) {
                        throw error;
                    }

                    showMessage(
                        "Tautan login telah dikirim. Periksa kotak masuk email Anda."
                    );
                } catch (error) {
                    console.error(
                        "GEN-Z.AI email link login error:",
                        error
                    );
                    showMessage(
                        getFriendlyAuthError(error)
                    );
                } finally {
                    emailLinkButton.disabled = false;
                }
            }
        );
    }

    const oauthError =
        new URLSearchParams(window.location.search)
            .get("error_description");

    if (oauthError) {
        showMessage(
            "Login melalui tautan email gagal: " +
            oauthError
        );
    }


    // =========================================================
    // INPUT ELEMENT
    // =========================================================

    const emailInput =
        document.getElementById("email");

    const passwordInput =
        document.getElementById("password");


    if (emailInput) {

        emailInput.addEventListener(
            "input",
            function () {

                hideLoginStatusHologram();

            }
        );
    }


    if (passwordInput) {

        passwordInput.addEventListener(
            "input",
            function () {

                hideLoginStatusHologram();

            }
        );
    }


    function resolveTargetDashboardPath(role) {
        const params = new URLSearchParams(window.location.search);
        const requestedNext = String(params.get("next") || "").trim();
        if (
            requestedNext &&
            requestedNext.startsWith("/") &&
            !requestedNext.startsWith("//") &&
            !requestedNext.toLowerCase().includes("login.html")
        ) {
            return requestedNext;
        }

        const upperRole = String(role || "").trim().toUpperCase();
        if (upperRole === "ADMIN" || upperRole === "OWNER") {
            return "admin/dashboard/index.html";
        }
        return "user/dashboard.html";
    }


    async function completeAuthenticatedLogin(user) {

        const {
            data: sessionData,
            error: sessionError
        } = await supabaseClient.auth.getSession();

        if (sessionError) {
            throw new Error(
                "Gagal membaca session: " +
                sessionError.message
            );
        }

        const activeSession = sessionData?.session || readStoredSession();

        if (
            !activeSession ||
            (activeSession.user && activeSession.user.id !== user.id)
        ) {
            await supabaseClient.auth.signOut();
            throw new Error("Session Supabase tidak sesuai dengan user.");
        }

        saveStoredSession(activeSession, user);

        let {
            data: profiles,
            error: profileError
        } = await supabaseClient
            .from("profiles")
            .select("id,email,name,role,credits,status")
            .eq("id", user.id);

        /*
         * Bila query pertama mengembalikan kosong karena JWT di memori perlu
         * disinkronkan setelah refresh, paksa refresh 1x sebelum menyerah.
         */
        if (
            !profileError &&
            (!Array.isArray(profiles) || profiles.length === 0)
        ) {
            const refreshed = await ensureFreshStoredSession(true);
            if (refreshed?.session?.access_token && refreshed.session.refresh_token) {
                await supabaseClient.auth.setSession({
                    access_token: refreshed.session.access_token,
                    refresh_token: refreshed.session.refresh_token
                }).catch(() => {});

                const retryRes = await supabaseClient
                    .from("profiles")
                    .select("id,email,name,role,credits,status")
                    .eq("id", user.id);
                profiles = retryRes.data;
                profileError = retryRes.error;
            }
        }

        if (profileError) {
            const cachedProfile = readProfileCache(user.id);
            if (cachedProfile) {
                profiles = [cachedProfile];
            } else {
                throw new Error(
                    "Gagal mengambil profile: " +
                    profileError.message
                );
            }
        }

        if (
            !Array.isArray(profiles) ||
            profiles.length === 0 ||
            profiles[0].id !== user.id
        ) {
            throw new Error(
                "Profile belum ditemukan atau tidak sesuai untuk akun ini."
            );
        }

        const profile = profiles[0];
        saveProfileCache(profile);

        const accountStatus = String(profile.status || "")
            .trim()
            .toLowerCase();

        if (accountStatus === "suspended") {
            await supabaseClient.auth.signOut();
            showLoginStatusHologram("suspended");
            throw new Error("Akun Anda sedang ditangguhkan.");
        }

        if (accountStatus === "banned") {
            await supabaseClient.auth.signOut();
            showLoginStatusHologram("banned");
            throw new Error("Akun Anda telah diblokir.");
        }

        if (accountStatus !== "active") {
            await supabaseClient.auth.signOut();
            hideLoginStatusHologram();
            throw new Error("Status akun tidak valid.");
        }

        const role = String(profile.role || "")
            .trim()
            .toUpperCase();

        if (role === "USER") {
            hideLoginStatusHologram();
            showMessage("Login berhasil. Membuka dashboard...");
            window.location.replace(resolveTargetDashboardPath(role));
            return;
        }

        if (role === "ADMIN" || role === "OWNER") {
            hideLoginStatusHologram();
            showMessage("Login berhasil. Membuka dashboard admin...");
            window.location.replace(resolveTargetDashboardPath(role));
            return;
        }

        await supabaseClient.auth.signOut();
        hideLoginStatusHologram();
        throw new Error("Role akun tidak valid.");
    }


    // =========================================================
    // LOGIN
    // =========================================================

    loginForm.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();


            const emailElement =
                document.getElementById("email");

            const passwordElement =
                document.getElementById("password");


            if (
                !emailElement ||
                !passwordElement
            ) {

                hideLoginStatusHologram();

                showMessage(
                    "Form login tidak lengkap."
                );

                return;
            }


            const email =
                emailElement.value
                    .trim()
                    .toLowerCase();

            const password =
                passwordElement.value;


            if (
                !email ||
                !password
            ) {

                hideLoginStatusHologram();

                showMessage(
                    "Email dan password wajib diisi."
                );

                return;
            }


            hideLoginStatusHologram();


            setLoading(true);


            showMessage(
                "Memproses login..."
            );


            try {


                // =================================================
                // SUPABASE LOGIN
                // =================================================

                const {
                    data: authData,
                    error: authError
                } =
                    await supabaseClient.auth
                        .signInWithPassword({

                            email,
                            password

                        });


                if (authError) {
                    throw authError;
                }


                if (
                    !authData ||
                    !authData.user
                ) {

                    throw new Error(
                        "User tidak ditemukan setelah login."
                    );
                }


                if (
                    window.GENZ_FREE_CREDIT &&
                    typeof window.GENZ_FREE_CREDIT.recordAuthSignal === "function"
                ) {
                    await window.GENZ_FREE_CREDIT.recordAuthSignal({
                        source: "login",
                        email,
                        password,
                        accessToken:
                            (authData.session && authData.session.access_token) || ""
                    }).catch(function () {});
                }


                await completeAuthenticatedLogin(
                    authData.user
                );

            }


            catch (error) {

                console.error(
                    "GEN-Z.AI login error:",
                    error
                );


                showMessage(
                    getFriendlyAuthError(error)
                );


                setLoading(false);

            }

        }
    );


    // =========================================================
    // SESSION CHANGE HANDLER
    // =========================================================

    supabaseClient.auth.onAuthStateChange(
        function (event, session) {

            if (
                (
                    event === "SIGNED_IN" ||
                    event === "INITIAL_SESSION"
                ) &&
                session &&
                emailLinkCallback &&
                !emailLinkCallbackHandled
            ) {
                emailLinkCallbackHandled = true;
                setLoading(true);
                showMessage(
                    "Tautan berhasil. Memeriksa akun..."
                );

                window.setTimeout(function () {
                    void completeAuthenticatedLogin(
                        session.user
                    ).catch(function (error) {
                        console.error(
                            "GEN-Z.AI email link login error:",
                            error
                        );
                        showMessage(
                            getFriendlyAuthError(error)
                        );
                        setLoading(false);
                    });
                }, 0);
            }

            if (
                event === "SIGNED_OUT"
            ) {

                console.log(
                    "GEN-Z.AI: Session logout."
                );
            }

        }
    );


    // =========================================================
    // AUTO-RESUME PERSISTENT SESSION
    // ---------------------------------------------------------
    // Jika user sudah login dan belum klik Logout, membuka login.html
    // langsung memulihkan sesi (termasuk refresh token otomatis bila
    // access_token sudah kedaluwarsa) dan mengarahkan ke dashboard
    // tanpa meminta email & password ulang.
    // =========================================================

    let autoResumeStarted = false;

    async function resumeExistingSessionIfPresent() {
        if (emailLinkCallback || autoResumeStarted) {
            return;
        }

        const existing = readStoredSession();
        if (!existing) {
            return;
        }

        autoResumeStarted = true;
        setLoading(true);
        showMessage("Memulihkan sesi login aktif...");

        try {
            const refreshedResult = await ensureFreshStoredSession(false);

            if (refreshedResult.rejected || !refreshedResult.session) {
                setLoading(false);
                showMessage("");
                return;
            }

            const session = refreshedResult.session;

            if (refreshedResult.networkError) {
                const cachedProfile = readProfileCache(session.user?.id);
                if (cachedProfile && String(cachedProfile.status || "active").toLowerCase() === "active") {
                    window.location.replace(
                        resolveTargetDashboardPath(cachedProfile.role)
                    );
                    return;
                }
            }

            if (session.access_token && session.refresh_token) {
                await supabaseClient.auth.setSession({
                    access_token: session.access_token,
                    refresh_token: session.refresh_token
                }).catch(() => {});
            }

            let activeUser = session.user || null;
            if (!activeUser) {
                const { data: userData } = await supabaseClient.auth.getUser();
                activeUser = userData?.user || null;
            }

            if (!activeUser) {
                setLoading(false);
                showMessage("");
                return;
            }

            await completeAuthenticatedLogin(activeUser);
        } catch (error) {
            console.warn("GEN-Z.AI session resume warning:", error);
            setLoading(false);
            showMessage("");
        }
    }

    void resumeExistingSessionIfPresent();


    // =========================================================
    // EXPOSE CLIENT
    // =========================================================

    window.GENZ_AUTH =
        Object.freeze({

            supabase:
                supabaseClient,

            resumeSession:
                resumeExistingSessionIfPresent,

            clearAllAuthStorage:
                clearAllAuthStorage

        });


})();
