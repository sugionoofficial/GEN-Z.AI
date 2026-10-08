//navigation.js?v=1.9
/* =========================================================
   GEN-Z.AI
   SHARED NAVIGATION
   ---------------------------------------------------------
   File:
   navigation/navigation.js

   PATCH v1.9 (FIX DEADLOCK TOTAL):
   - BYPASS GoTrueClient SEPENUHNYA untuk auth operations.
   - Method client.auth.* (getSession/getUser/refreshSession/
     signOut) hang pada client yang dibuat saat page load
     di Supabase v2.58.0.
   - Session dibaca langsung dari localStorage.
   - Refresh token via fetch langsung ke /auth/v1/token.
   - Logout via clear localStorage + redirect.
   - onAuthStateChange dinonaktifkan.
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


    if (
        window.__GENZ_NAVIGATION_STARTED
    ) {

        return;

    }

    window.__GENZ_NAVIGATION_STARTED = true;


    const STYLE_ID =
        "genz-shared-navigation-style";


    const NAVIGATION_CONTAINER_IDS = [
        "genz-navigation",
        "navigation",
        "adminNavigation"
    ];


    const LOGIN_PATH =
        "/index.html";


    const PROFILE_RETRY_COUNT =
        3;


    const PROFILE_RETRY_DELAY =
        500;


    const TOKEN_REFRESH_BUFFER_SEC =
        60;


    let currentUser = null;

    let currentProfile = null;

    let currentRole = "user";

    let navigationReady = false;

    let navigationReadyResolve;

    let documentKeydownBound = false;


    const navigationReadyPromise =
        new Promise(
            resolve => {

                navigationReadyResolve =
                    resolve;

            }
        );


    /* =====================================================
       GLOBAL BRIDGE
    ===================================================== */

    function syncNavigationGlobals() {

        window.GENZ_NAVIGATION_USER =
            currentUser || null;

        window.GENZ_NAVIGATION_PROFILE =
            currentProfile || null;

        window.GENZ_NAVIGATION_ROLE =
            normalizeRole(currentRole);

        window.GENZ_CURRENT_PROFILE =
            currentProfile || null;

    }


    /* =====================================================
       SUPABASE CLIENT (untuk storage & database saja)
       -----------------------------------------------------
       Tidak dipakai untuk auth operations.
       Auth dibaca langsung dari localStorage.
    ===================================================== */

    function getSupabaseClient() {

        if (window.GENZ_SUPABASE) {

            return window.GENZ_SUPABASE;

        }


        if (window.supabaseClient) {

            return window.supabaseClient;

        }


        const supabaseGlobal =
            window.supabase;

        const config =
            window.GENZ_CONFIG;


        if (
            !supabaseGlobal ||
            typeof supabaseGlobal.createClient !==
                "function"
        ) {

            return null;

        }


        if (
            !config ||
            !config.SUPABASE_URL
        ) {

            return null;

        }


        const supabaseKey =
            config.SUPABASE_KEY ||
            config.SUPABASE_ANON_KEY;


        if (!supabaseKey) {

            return null;

        }


        try {

            const client =
                supabaseGlobal.createClient(
                    config.SUPABASE_URL,
                    supabaseKey,
                    {
                        auth: {
                            persistSession: false,
                            autoRefreshToken: false,
                            detectSessionInUrl: false,
                            lock: async (_n, _t, fn) => await fn()
                        }
                    }
                );


            window.GENZ_SUPABASE =
                client;

            window.supabaseClient =
                client;


            return client;

        } catch (error) {

            debugError(
                "[GEN-Z.AI] Supabase client error:",
                error
            );

            return null;

        }

    }


    /* =====================================================
       READ SESSION FROM LOCALSTORAGE
       -----------------------------------------------------
       FIX DEADLOCK:
       Baca session langsung dari localStorage, bypass
       GoTrueClient sepenuhnya.

       Format key: sb-<project-ref>-auth-token
    ===================================================== */

    function readSessionFromStorage() {

        try {

            const config =
                window.GENZ_CONFIG;

            if (
                !config ||
                !config.SUPABASE_URL
            ) {

                return null;

            }

            const match =
                config.SUPABASE_URL.match(
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


    /* =====================================================
       CLEAR SESSION STORAGE
    ===================================================== */

    function clearSessionStorage() {

        try {

            const config =
                window.GENZ_CONFIG;

            if (
                !config ||
                !config.SUPABASE_URL
            ) {

                return;

            }

            const match =
                config.SUPABASE_URL.match(
                    /https:\/\/([^.]+)/
                );

            const projectRef =
                match && match[1];

            if (!projectRef) {

                return;

            }

            const key =
                "sb-" + projectRef + "-auth-token";

            localStorage.removeItem(key);

        } catch (error) {

            /* ignore */

        }

    }


    /* =====================================================
       ENSURE FRESH TOKEN (via fetch langsung)
       -----------------------------------------------------
       FIX DEADLOCK:
       Refresh token via fetch ke /auth/v1/token,
       TIDAK memanggil client.auth.refreshSession()
       yang hang.
    ===================================================== */

    async function ensureFreshToken() {

        try {

            const session =
                readSessionFromStorage();

            if (
                !session ||
                !session.expires_at
            ) {

                return;

            }

            const nowSec =
                Math.floor(
                    Date.now() / 1000
                );

            const secondsUntilExpiry =
                session.expires_at -
                nowSec;

            if (
                secondsUntilExpiry >=
                TOKEN_REFRESH_BUFFER_SEC
            ) {

                return;

            }

            if (
                secondsUntilExpiry < 0
            ) {

                /*
                 * Sudah expired. Tidak bisa refresh
                 * tanpa valid refresh_token.
                 */

                return;

            }

            if (!session.refresh_token) {

                return;

            }

            const config =
                window.GENZ_CONFIG;

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

                if (isDebugEnabled()) {

                    console.warn(
                        "[GEN-Z.AI] Refresh token HTTP error:",
                        res.status
                    );

                }

                return;

            }

            const newSession =
                await res.json();

            if (
                !newSession ||
                !newSession.access_token
            ) {

                return;

            }

            const match =
                config.SUPABASE_URL.match(
                    /https:\/\/([^.]+)/
                );

            const projectRef =
                match && match[1];

            if (projectRef) {

                const key =
                    "sb-" + projectRef + "-auth-token";

                localStorage.setItem(
                    key,
                    JSON.stringify(newSession)
                );

            }

            if (isDebugEnabled()) {

                console.log(
                    "[GEN-Z.AI] Refresh token berhasil."
                );

            }

        } catch (error) {

            if (isDebugEnabled()) {

                console.warn(
                    "[GEN-Z.AI] ensureFreshToken error:",
                    error
                );

            }

        }

    }


    function delay(ms) {

        return new Promise(r => setTimeout(r, ms));

    }


    function getCurrentPath() {

        return window.location.pathname || "/";

    }


    function isLoginPage() {

        const path =
            getCurrentPath().toLowerCase();

        return (
            path === LOGIN_PATH ||
            path === "/login" ||
            path.endsWith("/login.html")
        );

    }


    function normalizeRole(role) {

        const value =
            String(role || "")
                .trim()
                .toLowerCase();

        if (value === "owner") {

            return "owner";

        }

        if (
            value === "admin" ||
            value === "administrator"
        ) {

            return "admin";

        }

        return "user";

    }


    function isProfileActive(profile) {

        if (!profile) {

            return false;

        }

        if (
            profile.status === undefined ||
            profile.status === null ||
            String(profile.status).trim() === ""
        ) {

            return true;

        }

        const status =
            String(profile.status)
                .trim()
                .toLowerCase();

        return (
            status === "active" ||
            status === "approved" ||
            status === "enabled"
        );

    }


    /* =====================================================
       GET SESSION (BYPASS GoTrueClient)
    ===================================================== */

    async function getSessionWithRetry() {

        await ensureFreshToken();

        const session =
            readSessionFromStorage();

        if (!session) {

            return {
                session: null,
                user: null
            };

        }

        const nowSec =
            Math.floor(Date.now() / 1000);

        if (
            session.expires_at &&
            session.expires_at < nowSec
        ) {

            return {
                session: null,
                user: null
            };

        }

        return {
            session,
            user: session.user
        };

    }


    /* =====================================================
       LOAD PROFILE (masih via Supabase database client,
       BUKAN auth — aman karena database client tidak hang)
    ===================================================== */

    async function loadProfile(userId) {

        const supabase =
            getSupabaseClient();

        if (!supabase || !userId) {

            return null;

        }

        let lastError = null;

        for (
            let attempt = 0;
            attempt < PROFILE_RETRY_COUNT;
            attempt++
        ) {

            try {

                let result =
                    await supabase
                        .from("profiles")
                        .select(
                            "id,email,name,role,credits,status"
                        )
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

                    result =
                        await supabase
                            .from("profiles")
                            .select(
                                "id,email,name,role,credits"
                            )
                            .eq("id", userId)
                            .maybeSingle();

                }

                if (!result.error) {

                    return result.data || null;

                }

                lastError = result.error;

            } catch (error) {

                lastError = error;

            }

            if (
                attempt <
                PROFILE_RETRY_COUNT - 1
            ) {

                await delay(PROFILE_RETRY_DELAY);

            }

        }

        if (lastError) {

            debugError(
                "[GEN-Z.AI] Profile load error:",
                lastError
            );

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

            visionImage: `<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"></path><circle cx="12" cy="12" r="2.7"></circle></svg>`,

            visionVideo: `<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="13" height="14" rx="2"></rect><path d="M16 10l5-3v10l-5-3z"></path></svg>`,

            viddra: `<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"></rect><path d="M10 9l5 3-5 3z"></path><path d="M7 2l2 2"></path><path d="M17 2l-2 2"></path></svg>`,

            history: `<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 12a8.5 8.5 0 1 0 2.5-6"></path><path d="M3.5 4.5v5h5"></path><path d="M12 7.5v5l3.5 2"></path></svg>`,

            metadataCleaner: `<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 3h9l5 5v13H5z"></path><path d="M14 3v5h5"></path><path d="M8.5 15l2.2 2.2 4.8-5"></path></svg>`,

            topUp: `<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="M3 9h18"></path><path d="M12 12v5"></path><path d="M9.5 14.5h5"></path></svg>`,

            hubAdmin: `<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 21V9l8-5 8 5v12"></path><path d="M2 21h20"></path><path d="M8 21v-6h8v6"></path><path d="M8 10h.01"></path><path d="M12 10h.01"></path><path d="M16 10h.01"></path></svg>`,

            adminPanel: `<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l8 3v5c0 5.2-3.4 8.7-8 10-4.6-1.3-8-4.8-8-10V6z"></path><path d="M8.5 12l2.2 2.2 4.8-4.8"></path></svg>`

        });


        const commonUserItems = [

            { label: "Dashboard", href: "/user/dashboard.html", icon: ICONS.dashboard },
            { label: "Generate", href: "/generate/index.html", icon: ICONS.generate },
            { label: "Vision Image", href: "/vision/index.html", icon: ICONS.visionImage },
            { label: "Vision Video", href: "/vision-video/index.html", icon: ICONS.visionVideo },
            { label: "VidDra FREE", href: "/viddra/index.html", icon: ICONS.viddra },
            { label: "History", href: "/history/index.html", icon: ICONS.history },
            { label: "AI Metadata Cleaner", href: "/metadata-cleaner/index.html", icon: ICONS.metadataCleaner },
            { label: "Top Up", href: "/user/topup.html", icon: ICONS.topUp },
            { label: "Hub Admin", href: "/user/hub-admin.html", icon: ICONS.hubAdmin }

        ];


        const adminItems = [

            { label: "Dashboard", href: "/admin/dashboard/index.html", icon: ICONS.dashboard },
            { label: "Generate", href: "/generate/index.html", icon: ICONS.generate },
            { label: "Vision Image", href: "/vision/index.html", icon: ICONS.visionImage },
            { label: "Vision Video", href: "/vision-video/index.html", icon: ICONS.visionVideo },
            { label: "VidDra FREE", href: "/viddra/index.html", icon: ICONS.viddra },
            { label: "History", href: "/history/index.html", icon: ICONS.history },
            { label: "AI Metadata Cleaner", href: "/metadata-cleaner/index.html", icon: ICONS.metadataCleaner },
            { label: "Admin Panel", href: "/admin-control/admin-panel.html", icon: ICONS.adminPanel }

        ];


        if (
            role === "admin" ||
            role === "owner"
        ) {

            return adminItems;

        }

        return commonUserItems;

    }


    function getNavigationContainer() {

        for (const id of NAVIGATION_CONTAINER_IDS) {

            const existing =
                document.getElementById(id);

            if (existing) {

                return existing;

            }

        }

        const container =
            document.createElement("div");

        container.id = "genz-navigation";

        document.body.prepend(container);

        return container;

    }


    function isActiveLink(href) {

        const currentPath = getCurrentPath();

        if (href === currentPath) {

            return true;

        }

        try {

            const target =
                new URL(href, window.location.origin);

            const targetPath = target.pathname;

            if (targetPath === currentPath) {

                return true;

            }

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

        const container =
            getNavigationContainer();

        if (!container) {

            return;

        }

        syncNavigationGlobals();

        const items =
            getNavigationConfig(currentRole);

        const email =
            currentUser && currentUser.email
                ? currentUser.email
                : (
                    currentProfile &&
                    currentProfile.email
                        ? currentProfile.email
                        : ""
                );

        const roleLabel =
            currentRole === "owner"
                ? "OWNER"
                : currentRole === "admin"
                    ? "ADMIN"
                    : "USER";

        const navigationItems =
            items.map(item => {

                const active =
                    isActiveLink(item.href);

                return `
                    <a class="genz-nav-item${active ? " active" : ""}" href="${escapeHTML(item.href)}" data-genz-nav-link="true">
                        <span class="genz-nav-icon">${item.icon || ""}</span>
                        <span class="genz-nav-label">${escapeHTML(item.label)}</span>
                    </a>
                `;

            }).join("");


        container.innerHTML = `
            <aside class="genz-sidebar" id="genz-sidebar" aria-label="GEN-Z.AI Navigation">
                <div class="genz-sidebar-header">
                    <div class="genz-brand">
                        <div class="genz-logo" aria-label="GEN-Z.AI" title="GEN-Z.AI">
                            <div class="genz-logo-mark" aria-hidden="true">AI</div>
                            <div class="genz-logo-text">
                                <span class="genz-logo-main">GEN-<strong>Z</strong></span>
                                <span class="genz-logo-ai">.AI</span>
                            </div>
                        </div>
                        <div class="genz-brand-subtitle">AI Platform</div>
                    </div>
                    <button type="button" class="genz-mobile-close" id="genz-mobile-close" aria-label="Close menu">×</button>
                </div>
                <nav class="genz-nav" aria-label="Main navigation">${navigationItems}</nav>
                <div class="genz-sidebar-footer">
                    <div class="genz-account-box">
                        <div class="genz-account-label">ACCOUNT</div>
                        <div class="genz-account-email">${escapeHTML(email)}</div>
                        <div class="genz-account-role">${escapeHTML(roleLabel)}</div>
                    </div>
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

        document
            .querySelectorAll("[data-genz-nav-link='true']")
            .forEach(link => {

                link.addEventListener("click", () => {

                    closeMobileNavigation();

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


    /* =====================================================
       LOGOUT (BYPASS GoTrueClient)
    ===================================================== */

    async function logoutUser() {

        /*
         * Jangan panggil supabase.auth.signOut() karena hang.
         * Cukup hapus session dari localStorage.
         */

        clearSessionStorage();

        currentUser = null;
        currentProfile = null;
        currentRole = "user";

        syncNavigationGlobals();

        if (!isLoginPage()) {

            window.location.href = LOGIN_PATH;

        }

    }


    /* =====================================================
       AUTH LISTENER (DINONAKTIFKAN)
       -----------------------------------------------------
       FIX: onAuthStateChange ditiadakan karena method auth.*
       pada client yang rusak akan hang.
       Perubahan auth ditangani secara manual.
    ===================================================== */

    function setupAuthListener() {

        /* no-op */

    }


    /* =====================================================
       AUTH VALIDATION
    ===================================================== */

    async function validateAuthentication() {

        const { session, user } =
            await getSessionWithRetry();

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

        const profile =
            await loadProfile(user.id);

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


    /* =====================================================
       STYLE INJECTION
    ===================================================== */

    function injectStyles() {

        if (document.getElementById(STYLE_ID)) {

            return;

        }

        const style =
            document.createElement("style");

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

            .genz-logo {
                display: inline-flex;
                align-items: center;
                gap: 9px;
                min-height: 43px;
                padding: 6px 10px 6px 6px;
                border: 1px solid rgba(255, 50, 50, .24);
                border-radius: 11px;
                background: rgba(255, 255, 255, .025);
            }

            .genz-logo-mark {
                width: 34px; height: 34px;
                flex: 0 0 34px;
                display: flex;
                align-items: center;
                justify-content: center;
                border: 1px solid rgba(255, 70, 70, .4);
                border-radius: 9px;
                color: #ffffff;
                background: radial-gradient(circle at 35% 30%, rgba(255, 70, 70, .25), rgba(255, 0, 0, .05) 60%, rgba(0, 0, 0, .1));
                font-size: 11px;
                font-weight: 900;
                letter-spacing: .5px;
            }

            .genz-logo-text {
                display: flex;
                align-items: baseline;
                color: #ffffff;
                font-size: 18px;
                font-weight: 800;
                letter-spacing: .4px;
            }

            .genz-logo-main strong {
                color: #ff3d3d;
                text-shadow: 0 0 9px rgba(255, 0, 0, .75);
            }

            .genz-logo-ai {
                margin-left: 1px;
                color: #ff4a4a;
                text-shadow: 0 0 8px rgba(255, 0, 0, .55);
            }

            .genz-brand-subtitle {
                padding-left: 4px;
                color: rgba(255, 255, 255, .45);
                font-size: 10px;
                font-weight: 600;
                letter-spacing: 1.2px;
                text-transform: uppercase;
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
                padding: 8px 10px 16px;
            }

            .genz-nav-item {
                position: relative;
                display: flex;
                align-items: center;
                gap: 10px;
                min-height: 44px;
                padding: 9px 11px;
                border: 1px solid transparent;
                border-radius: 10px;
                color: rgba(255, 255, 255, .66);
                text-decoration: none;
                transition: all .18s ease;
            }

            .genz-nav-item:hover {
                color: #ffffff;
                background: rgba(255, 35, 35, .07);
                border-color: rgba(255, 45, 45, .16);
                transform: translateX(2px);
            }

            .genz-nav-item.active {
                color: #ffffff;
                background: linear-gradient(90deg, rgba(255, 35, 35, .15), rgba(255, 35, 35, .04));
                border-color: rgba(255, 50, 50, .28);
                box-shadow: inset 3px 0 0 var(--genz-red), 0 0 14px rgba(255, 0, 0, .05);
            }

            .genz-nav-icon {
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
                min-width: 0;
                font-size: 12px;
                font-weight: 600;
                line-height: 1.3;
            }

            .genz-sidebar-footer {
                margin-top: auto;
                padding: 10px 10px 14px;
                border-top: 1px solid rgba(255, 255, 255, .05);
            }

            .genz-account-box {
                width: 100%;
                margin: 0 0 10px;
                padding: 10px 11px;
                border: 1px solid rgba(255, 50, 50, .18);
                border-radius: 10px;
                background: rgba(255, 255, 255, .025);
            }

            .genz-account-label {
                margin-bottom: 5px;
                color: rgba(255, 255, 255, .45);
                font-size: 9px;
                font-weight: 800;
                letter-spacing: 1.2px;
            }

            .genz-account-email {
                overflow: hidden;
                color: rgba(255, 255, 255, .72);
                font-size: 10px;
                font-weight: 600;
                text-overflow: ellipsis;
                white-space: nowrap;
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
                width: 100%;
                min-height: 42px;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 9px 11px;
                border: 1px solid rgba(255, 50, 50, .25);
                border-radius: 10px;
                color: #ff3b3b;
                background: rgba(255, 0, 0, .025);
                font: inherit;
                font-size: 12px;
                font-weight: 800;
                letter-spacing: .8px;
                cursor: pointer;
                transition: all .18s ease;
            }

            .genz-logout-button:hover {
                color: #ff5555;
                background: rgba(255, 0, 0, .08);
                border-color: rgba(255, 50, 50, .45);
                box-shadow: 0 0 12px rgba(255, 0, 0, .12);
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
                .genz-sidebar-header { min-height: 72px; }
                .genz-mobile-close { display: flex; align-items: center; justify-content: center; }
                .genz-mobile-toggle { display: flex; }
                body { padding-left: 0 !important; }
                body.genz-nav-open { overflow: hidden; }
            }

            @media (max-width: 480px) {
                .genz-sidebar-header { padding: 13px 11px; }
                .genz-logo { gap: 8px; min-height: 40px; padding: 5px 9px 5px 6px; }
                .genz-logo-mark { width: 32px; height: 32px; flex-basis: 32px; border-radius: 8px; font-size: 11px; }
                .genz-logo-text { font-size: 17px; }
                .genz-nav { padding: 7px 8px 14px; }
                .genz-sidebar-footer { padding: 9px 8px 12px; }
                .genz-account-box { margin-bottom: 9px; }
            }
        `;

        document.head.appendChild(style);

    }


    /* =====================================================
       INITIALIZE
    ===================================================== */

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

            const authenticated =
                await validateAuthentication();

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

            debugError(
                "[GEN-Z.AI] Navigation initialization error:",
                error
            );

            navigationReady = false;
            syncNavigationGlobals();

            if (navigationReadyResolve) {

                navigationReadyResolve(false);
                navigationReadyResolve = null;

            }

        }

    }


    /* =====================================================
       PUBLIC API
    ===================================================== */

    window.GENZNavigation = {

        init: initialize,

        render: renderNavigation,

        logout: logoutUser,

        getUser: () => currentUser,

        getProfile: () => currentProfile,

        getRole: () => currentRole,

        readSession: readSessionFromStorage,

        cleanup: () => { /* no-op */ },

        ready: navigationReadyPromise

    };


    window.GENZNavigationReady =
        navigationReadyPromise;


    syncNavigationGlobals();


    if (document.readyState === "loading") {

        document.addEventListener(
            "DOMContentLoaded",
            initialize,
            { once: true }
        );

    } else {

        initialize();

    }

})();
