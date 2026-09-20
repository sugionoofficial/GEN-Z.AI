/* =========================================================
   GEN-Z.AI
   SHARED NAVIGATION
   ---------------------------------------------------------
   File:
   navigation/navigation.js

   Tanggung jawab:
   - Membaca session Supabase
   - Membaca profile dari Supabase
   - Menentukan role USER / ADMIN / OWNER
   - Render navigasi berdasarkan role
   - Menyediakan global navigation state
   - Menjaga auth tanpa menyebabkan login loop
   - Menyediakan GENZNavigationReady

   Catatan:
   - Tidak melakukan signOut otomatis
   - Tidak menganggap profile.status kosong sebagai inactive
   - Tidak redirect pada setiap auth event
   - Login page tidak dikenakan auth guard
   ========================================================= */

(() => {
    "use strict";

    /* =========================================================
       PREVENT DOUBLE INITIALIZATION
       ========================================================= */

    if (window.__GENZ_NAVIGATION_STARTED === true) {
        return;
    }

    window.__GENZ_NAVIGATION_STARTED = true;


    /* =========================================================
       CONFIG
       ========================================================= */

    const STYLE_ID = "genz-shared-navigation-style";

    const NAVIGATION_CONTAINER_IDS = [
        "genz-navigation",
        "navigation"
    ];

    const LOGIN_PATH = "/login.html";

    const SESSION_RETRY_COUNT = 8;
    const SESSION_RETRY_DELAY = 250;

    const PROFILE_RETRY_COUNT = 3;
    const PROFILE_RETRY_DELAY = 300;


    /* =========================================================
       INTERNAL STATE
       ========================================================= */

    let currentUser = null;
    let currentProfile = null;
    let currentRole = null;

    let authSubscription = null;
    let authListenerBound = false;
    let initializationStarted = false;
    let redirectingToLogin = false;

    let navigationReadyResolved = false;
    let navigationReadyResolve = null;


    /* =========================================================
       NAVIGATION READY PROMISE
       ========================================================= */

    window.GENZNavigationReady = new Promise((resolve) => {
        navigationReadyResolve = resolve;
    });


    function resolveNavigationReady(value) {
        if (navigationReadyResolved) {
            return;
        }

        navigationReadyResolved = true;

        if (typeof navigationReadyResolve === "function") {
            navigationReadyResolve(value);
        }
    }


    /* =========================================================
       UTILITY
       ========================================================= */

    function delay(ms) {
        return new Promise((resolve) => {
            setTimeout(resolve, ms);
        });
    }


    function normalizePath(path) {
        if (!path) {
            return "/";
        }

        let normalized = String(path);

        if (!normalized.startsWith("/")) {
            normalized = "/" + normalized;
        }

        if (
            normalized.length > 1 &&
            normalized.endsWith("/")
        ) {
            normalized = normalized.slice(0, -1);
        }

        return normalized;
    }


    function getCurrentPath() {
        return normalizePath(
            window.location.pathname || "/"
        );
    }


    function isLoginPage() {
        const currentPath = getCurrentPath();

        const loginPath = normalizePath(
            LOGIN_PATH
        );

        return (
            currentPath === loginPath ||
            currentPath.endsWith("/login.html")
        );
    }


    /* =========================================================
       SUPABASE CLIENT
       ========================================================= */

    function getSupabaseClient() {
        const candidates = [
            window.GENZ_SUPABASE,
            window.supabaseClient,
            window.supabase
        ];

        for (const client of candidates) {
            if (
                client &&
                client.auth &&
                typeof client.auth.getSession === "function"
            ) {
                return client;
            }
        }

        return null;
    }


    /* =========================================================
       SESSION
       ---------------------------------------------------------
       Supabase kadang membutuhkan beberapa saat untuk
       memulihkan session dari storage / refresh token.
       Jangan langsung menyimpulkan user belum login.
       ========================================================= */

    async function getAuthenticatedUser() {
        const supabase = getSupabaseClient();

        if (!supabase) {
            console.error(
                "[GENZ Navigation] Supabase client tidak ditemukan."
            );

            return null;
        }

        let lastError = null;

        for (
            let attempt = 1;
            attempt <= SESSION_RETRY_COUNT;
            attempt++
        ) {
            try {
                const result =
                    await supabase.auth.getSession();

                const session =
                    result?.data?.session || null;

                if (
                    session &&
                    session.user
                ) {
                    return session.user;
                }

                if (result?.error) {
                    lastError = result.error;

                    console.warn(
                        `[GENZ Navigation] getSession attempt ${attempt}:`,
                        result.error
                    );
                }
            } catch (error) {
                lastError = error;

                console.warn(
                    `[GENZ Navigation] getSession exception attempt ${attempt}:`,
                    error
                );
            }

            if (
                attempt < SESSION_RETRY_COUNT
            ) {
                await delay(
                    SESSION_RETRY_DELAY
                );
            }
        }

        if (lastError) {
            console.error(
                "[GENZ Navigation] Session gagal dibaca:",
                lastError
            );
        }

        return null;
    }


    /* =========================================================
       PROFILE QUERY
       ========================================================= */

    function isMissingStatusColumnError(error) {
        const message =
            String(
                error?.message ||
                error?.details ||
                ""
            ).toLowerCase();

        return (
            (
                message.includes("status") &&
                message.includes("column")
            ) ||
            message.includes("schema cache") ||
            message.includes("could not find")
        );
    }


    async function queryUserProfile(
        supabase,
        userId
    ) {
        /*
         * Percobaan pertama.
         *
         * Status tetap dibaca jika memang tersedia.
         */

        let result =
            await supabase
                .from("profiles")
                .select(
                    [
                        "id",
                        "email",
                        "name",
                        "role",
                        "credits",
                        "status"
                    ].join(",")
                )
                .eq("id", userId)
                .maybeSingle();


        /*
         * Kalau kolom status ternyata tidak ada,
         * ulangi tanpa status.
         *
         * Ini penting supaya schema lama tidak
         * menyebabkan user otomatis logout.
         */

        if (
            result?.error &&
            isMissingStatusColumnError(
                result.error
            )
        ) {
            console.warn(
                "[GENZ Navigation] Kolom profiles.status tidak tersedia. Melanjutkan tanpa status."
            );

            result =
                await supabase
                    .from("profiles")
                    .select(
                        [
                            "id",
                            "email",
                            "name",
                            "role",
                            "credits"
                        ].join(",")
                    )
                    .eq("id", userId)
                    .maybeSingle();
        }


        return result;
    }


    async function getUserProfile(userId) {
        const supabase =
            getSupabaseClient();

        if (!supabase || !userId) {
            return {
                profile: null,
                error: new Error(
                    "Supabase client atau user ID tidak tersedia."
                )
            };
        }

        let lastError = null;

        for (
            let attempt = 1;
            attempt <= PROFILE_RETRY_COUNT;
            attempt++
        ) {
            try {
                const result =
                    await queryUserProfile(
                        supabase,
                        userId
                    );

                if (!result?.error) {
                    return {
                        profile:
                            result?.data || null,
                        error: null
                    };
                }

                lastError =
                    result.error;

                console.warn(
                    `[GENZ Navigation] Profile query attempt ${attempt}:`,
                    result.error
                );
            } catch (error) {
                lastError = error;

                console.warn(
                    `[GENZ Navigation] Profile exception attempt ${attempt}:`,
                    error
                );
            }

            if (
                attempt < PROFILE_RETRY_COUNT
            ) {
                await delay(
                    PROFILE_RETRY_DELAY
                );
            }
        }

        return {
            profile: null,
            error: lastError
        };
    }


    /* =========================================================
       ROLE
       ========================================================= */

    function normalizeRole(role) {
        const value =
            String(
                role || ""
            )
                .trim()
                .toLowerCase();

        if (
            value === "owner" ||
            value === "pemilik"
        ) {
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


    /* =========================================================
       PROFILE STATUS
       ========================================================= */

    function isProfileActive(profile) {
        /*
         * Kalau status tidak tersedia,
         * jangan anggap user inactive.
         *
         * Ini penting untuk kompatibilitas
         * dengan schema profiles yang belum memiliki
         * kolom status.
         */

        const status =
            String(
                profile?.status ?? ""
            )
                .trim()
                .toLowerCase();

        if (!status) {
            return true;
        }

        return [
            "active",
            "aktif",
            "enabled"
        ].includes(status);
    }


    /* =========================================================
       ALLOWED ROLE
       ========================================================= */

    function isAllowedRole(role) {
        return [
            "user",
            "admin",
            "owner"
        ].includes(role);
    }


    /* =========================================================
       REDIRECT
       ========================================================= */

    function redirectToLogin() {
        if (isLoginPage()) {
            return;
        }

        if (redirectingToLogin) {
            return;
        }

        redirectingToLogin = true;

        console.warn(
            "[GENZ Navigation] Session tidak valid. Redirect ke login."
        );

        window.location.replace(
            LOGIN_PATH
        );
    }


    /* =========================================================
       AUTH VALIDATION
       ========================================================= */

    async function validateAuthentication() {
        /*
         * LOGIN PAGE
         *
         * Jangan pernah menjalankan auth guard
         * di login.html.
         */

        if (isLoginPage()) {
            return false;
        }


        const user =
            await getAuthenticatedUser();


        /*
         * Session benar-benar tidak ditemukan
         * setelah retry.
         */

        if (!user) {
            console.warn(
                "[GENZ Navigation] User session tidak ditemukan."
            );

            redirectToLogin();

            return false;
        }


        /*
         * Ambil profile.
         */

        const profileResult =
            await getUserProfile(
                user.id
            );


        /*
         * PENTING:
         *
         * Jangan signOut kalau query profile error.
         *
         * Error database / RLS / jaringan bukan berarti
         * session user tidak valid.
         */

        if (profileResult.error) {
            console.error(
                "[GENZ Navigation] Gagal membaca profile:",
                profileResult.error
            );

            /*
             * Jangan panggil auth.signOut().
             *
             * Biarkan session tetap hidup.
             * Redirect hanya sebagai fallback.
             */

            redirectToLogin();

            return false;
        }


        const profile =
            profileResult.profile;


        /*
         * Profile benar-benar tidak ditemukan.
         */

        if (!profile) {
            console.error(
                "[GENZ Navigation] Profile user tidak ditemukan:",
                user.id
            );

            redirectToLogin();

            return false;
        }


        /*
         * Pastikan profile memang milik user
         * yang sedang login.
         */

        if (
            profile.id &&
            String(profile.id) !==
            String(user.id)
        ) {
            console.error(
                "[GENZ Navigation] Profile ID tidak cocok dengan Auth User."
            );

            redirectToLogin();

            return false;
        }


        /*
         * Status.
         *
         * Status kosong = dianggap aktif.
         */

        if (
            !isProfileActive(profile)
        ) {
            console.error(
                "[GENZ Navigation] Profile user tidak aktif:",
                profile.status
            );

            redirectToLogin();

            return false;
        }


        /*
         * Role.
         */

        const role =
            normalizeRole(
                profile.role
            );


        if (!isAllowedRole(role)) {
            console.error(
                "[GENZ Navigation] Role tidak diizinkan:",
                profile.role
            );

            redirectToLogin();

            return false;
        }


        /*
         * Simpan state.
         */

        currentUser = user;
        currentProfile = profile;
        currentRole = role;


        /*
         * Global state untuk halaman lain.
         */

        window.GENZ_NAVIGATION_USER =
            currentUser;

        window.GENZ_NAVIGATION_PROFILE =
            currentProfile;

        window.GENZ_NAVIGATION_ROLE =
            currentRole;


        /*
         * Compatibility aliases.
         */

        window.GENZ_CURRENT_USER =
            currentUser;

        window.GENZ_CURRENT_PROFILE =
            currentProfile;

        window.GENZ_CURRENT_ROLE =
            currentRole;


        return true;
    }


    /* =========================================================
       NAVIGATION CONFIG
       ========================================================= */

    const NAVIGATION_BY_ROLE = {

        user: [
            {
                label: "Dashboard",
                href: "/user/dashboard.html",
                icon: "* "
            },
            {
                label: "Generate",
                href: "/generate/index.html",
                icon: "* "
            },
            {
                label: "History",
                href: "/history/index.html",
                icon: "* "
            }
        ],

        admin: [
            {
                label: "Dashboard",
                href: "/admin/dashboard.html",
                icon: "* "
            },
            {
                label: "Generate",
                href: "/generate/index.html",
                icon: "* "
            },
            {
                label: "History",
                href: "/history/index.html",
                icon: "* "
            },
            {
                label: "Admin Panel",
                href: "/admin-control/admin-panel.html",
                icon: "* "
            }
        ],

        owner: [
            {
                label: "Dashboard",
                href: "/admin/dashboard.html",
                icon: "* "
            },
            {
                label: "Generate",
                href: "/generate/index.html",
                icon: "* "
            },
            {
                label: "History",
                href: "/history/index.html",
                icon: "* "
            },
            {
                label: "Admin Panel",
                href: "/admin-control/admin-panel.html",
                icon: "* "
            },   
        ]
    };


    /* =========================================================
       NAVIGATION CONTAINER
       ========================================================= */

    function getNavigationContainer() {
        for (
            const id of NAVIGATION_CONTAINER_IDS
        ) {
            const existing =
                document.getElementById(id);

            if (existing) {
                return existing;
            }
        }


        /*
         * Jika halaman belum menyediakan container,
         * buat otomatis.
         */

        const container =
            document.createElement("div");

        container.id =
            "genz-navigation";

        document.body.prepend(
            container
        );

        return container;
    }


    /* =========================================================
       ACTIVE LINK
       ========================================================= */

    function isActiveLink(href) {
        try {
            const target =
                new URL(
                    href,
                    window.location.origin
                );

            const current =
                normalizePath(
                    window.location.pathname
                );

            const targetPath =
                normalizePath(
                    target.pathname
                );

            if (
                targetPath === "/"
            ) {
                return current === "/";
            }

            return (
                current === targetPath ||
                current.startsWith(
                    targetPath + "/"
                )
            );
        } catch {
            return false;
        }
    }


    /* =========================================================
       RENDER
       ========================================================= */

    function renderNavigation() {
        const container =
            getNavigationContainer();

        if (!container) {
            return;
        }


        const role =
            currentRole || "user";

        const profile =
            currentProfile || {};

        const items =
            NAVIGATION_BY_ROLE[role] ||
            NAVIGATION_BY_ROLE.user;


        const displayName =
            profile.name ||
            profile.email ||
            currentUser?.email ||
            "User";


        const roleLabel =
            role.toUpperCase();


        const navigationItems =
            items
                .map((item) => {
                    const active =
                        isActiveLink(
                            item.href
                        );

                    return `
                        <a
                            href="${item.href}"
                            class="genz-nav-item ${active ? "active" : ""}"
                        >
                            <span class="genz-nav-icon">
                                ${item.icon}
                            </span>

                            <span class="genz-nav-label">
                                ${item.label}
                            </span>
                        </a>
                    `;
                })
                .join("");


        container.innerHTML = `
            <aside
                class="genz-sidebar"
                id="genz-sidebar"
            >

                <div class="genz-sidebar-header">

                    <div class="genz-brand">
                        <div class="genz-brand-title">
                            GEN-Z.AI
                        </div>

                        <div class="genz-brand-subtitle">
                            AI Platform
                        </div>
                    </div>

                    <button
                        type="button"
                        class="genz-mobile-close"
                        id="genz-mobile-close"
                        aria-label="Close menu"
                    >
                        ×
                    </button>

                </div>


                <div class="genz-user-box">

                    <div class="genz-user-avatar">
                        ${String(displayName).charAt(0).toUpperCase()}
                    </div>

                    <div class="genz-user-info">

                        <div class="genz-user-name">
                            ${displayName}
                        </div>

                        <div class="genz-user-role">
                            ${roleLabel}
                        </div>

                    </div>

                </div>


                <nav class="genz-nav-menu">
                    ${navigationItems}
                </nav>


                <div class="genz-sidebar-footer">

                    <button
                        type="button"
                        id="genz-logout"
                        class="genz-logout-button"
                    >
                        <span class="genz-nav-icon">
                            ⇥
                        </span>

                        <span>
                            Logout
                        </span>
                    </button>

                </div>

            </aside>


            <button
                type="button"
                class="genz-mobile-toggle"
                id="genz-mobile-toggle"
                aria-label="Open menu"
            >
                ☰
            </button>


            <div
                class="genz-sidebar-overlay"
                id="genz-sidebar-overlay"
            ></div>
        `;


        bindNavigationEvents();
    }


    /* =========================================================
       EVENTS
       ========================================================= */

    function bindNavigationEvents() {
        const toggle =
            document.getElementById(
                "genz-mobile-toggle"
            );

        const close =
            document.getElementById(
                "genz-mobile-close"
            );

        const sidebar =
            document.getElementById(
                "genz-sidebar"
            );

        const overlay =
            document.getElementById(
                "genz-sidebar-overlay"
            );

        const logout =
            document.getElementById(
                "genz-logout"
            );


        function openMenu() {
            sidebar?.classList.add(
                "open"
            );

            overlay?.classList.add(
                "open"
            );

            document.body.classList.add(
                "genz-menu-open"
            );
        }


        function closeMenu() {
            sidebar?.classList.remove(
                "open"
            );

            overlay?.classList.remove(
                "open"
            );

            document.body.classList.remove(
                "genz-menu-open"
            );
        }


        toggle?.addEventListener(
            "click",
            openMenu
        );

        close?.addEventListener(
            "click",
            closeMenu
        );

        overlay?.addEventListener(
            "click",
            closeMenu
        );


        document
            .querySelectorAll(
                ".genz-nav-item"
            )
            .forEach((item) => {
                item.addEventListener(
                    "click",
                    closeMenu
                );
            });


        logout?.addEventListener(
            "click",
            async () => {
                await logoutUser();
            }
        );


        /*
         * Compatibility global functions.
         */

        window.toggleMenu =
            openMenu;

        window.closeMenu =
            closeMenu;
    }


    /* =========================================================
       LOGOUT
       ========================================================= */

    async function logoutUser() {
        const supabase =
            getSupabaseClient();

        try {
            if (supabase) {
                await supabase.auth.signOut();
            }
        } catch (error) {
            console.error(
                "[GENZ Navigation] Logout error:",
                error
            );
        } finally {
            currentUser = null;
            currentProfile = null;
            currentRole = null;

            window.GENZ_NAVIGATION_USER =
                null;

            window.GENZ_NAVIGATION_PROFILE =
                null;

            window.GENZ_NAVIGATION_ROLE =
                null;

            window.location.replace(
                LOGIN_PATH
            );
        }
    }


    window.logout =
        logoutUser;


    /* =========================================================
       AUTH STATE LISTENER
       ---------------------------------------------------------
       Jangan redirect hanya karena session null pada event
       yang bukan SIGNED_OUT.
       ========================================================= */

    function bindAuthStateListener() {
        if (authListenerBound) {
            return;
        }

        const supabase =
            getSupabaseClient();

        if (!supabase) {
            console.error(
                "[GENZ Navigation] Tidak dapat bind auth listener karena Supabase tidak tersedia."
            );

            return;
        }

        authListenerBound = true;


        const result =
            supabase.auth.onAuthStateChange(
                (event, session) => {

                    console.log(
                        "[GENZ Navigation] Auth event:",
                        event
                    );


                    /*
                     * HANYA SIGNED_OUT yang secara eksplisit
                     * menyebabkan redirect.
                     */

                    if (
                        event === "SIGNED_OUT"
                    ) {
                        currentUser = null;
                        currentProfile = null;
                        currentRole = null;

                        window.GENZ_NAVIGATION_USER =
                            null;

                        window.GENZ_NAVIGATION_PROFILE =
                            null;

                        window.GENZ_NAVIGATION_ROLE =
                            null;

                        redirectToLogin();

                        return;
                    }


                    /*
                     * INITIAL_SESSION:
                     *
                     * Jangan melakukan redirect di sini.
                     *
                     * validateAuthentication() yang menentukan
                     * apakah session benar-benar valid.
                     */

                    if (
                        event === "INITIAL_SESSION"
                    ) {
                        return;
                    }


                    /*
                     * TOKEN_REFRESHED:
                     *
                     * Jangan redirect jika session sementara
                     * tidak tersedia.
                     */

                    if (
                        event === "TOKEN_REFRESHED"
                    ) {
                        if (session?.user) {
                            currentUser =
                                session.user;

                            window.GENZ_NAVIGATION_USER =
                                currentUser;
                        }

                        return;
                    }


                    /*
                     * SIGNED_IN:
                     *
                     * Jangan melakukan redirect atau
                     * signOut dari dalam callback.
                     *
                     * Session akan diproses oleh halaman
                     * melalui init().
                     */

                    if (
                        event === "SIGNED_IN"
                    ) {
                        if (session?.user) {
                            currentUser =
                                session.user;

                            window.GENZ_NAVIGATION_USER =
                                currentUser;
                        }

                        return;
                    }
                }
            );


        authSubscription =
            result?.data?.subscription ||
            null;
    }


    /* =========================================================
       STYLE
       ========================================================= */

    function injectStyles() {
        if (
            document.getElementById(
                STYLE_ID
            )
        ) {
            return;
        }


        const style =
            document.createElement("style");

        style.id =
            STYLE_ID;


        style.textContent = `
            .genz-sidebar {
                position: fixed;
                top: 0;
                left: 0;
                bottom: 0;
                width: 260px;
                z-index: 9999;
                background: #0f1117;
                color: #ffffff;
                border-right: 1px solid rgba(255,255,255,.08);
                display: flex;
                flex-direction: column;
                overflow-y: auto;
                transition: transform .25s ease;
            }

            .genz-sidebar-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 22px 18px;
                border-bottom: 1px solid rgba(255,255,255,.07);
            }

            .genz-brand-title {
                font-size: 20px;
                font-weight: 800;
                letter-spacing: .5px;
            }

            .genz-brand-subtitle {
                margin-top: 3px;
                font-size: 11px;
                color: rgba(255,255,255,.5);
            }

            .genz-mobile-close {
                display: none;
                border: 0;
                background: transparent;
                color: #ffffff;
                font-size: 26px;
                cursor: pointer;
            }

            .genz-user-box {
                display: flex;
                align-items: center;
                gap: 12px;
                margin: 16px;
                padding: 12px;
                border-radius: 12px;
                background: rgba(255,255,255,.05);
            }

            .genz-user-avatar {
                width: 38px;
                height: 38px;
                flex: 0 0 38px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                background: rgba(255,255,255,.1);
                font-weight: 700;
            }

            .genz-user-info {
                min-width: 0;
            }

            .genz-user-name {
                font-size: 13px;
                font-weight: 700;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .genz-user-role {
                margin-top: 3px;
                font-size: 10px;
                color: rgba(255,255,255,.5);
                letter-spacing: .5px;
            }

            .genz-nav-menu {
                flex: 1;
                padding: 4px 12px;
            }

            .genz-nav-item {
                display: flex;
                align-items: center;
                gap: 12px;
                min-height: 44px;
                margin-bottom: 4px;
                padding: 0 12px;
                border-radius: 10px;
                color: rgba(255,255,255,.72);
                text-decoration: none;
                transition:
                    background .15s ease,
                    color .15s ease;
            }

            .genz-nav-item:hover {
                background: rgba(255,255,255,.06);
                color: #ffffff;
            }

            .genz-nav-item.active {
                background: rgba(255,255,255,.1);
                color: #ffffff;
            }

            .genz-nav-icon {
                width: 22px;
                min-width: 22px;
                text-align: center;
                font-size: 16px;
            }

            .genz-nav-label {
                font-size: 13px;
                font-weight: 600;
            }

            .genz-sidebar-footer {
                padding: 14px 12px 18px;
                border-top: 1px solid rgba(255,255,255,.07);
            }

            .genz-logout-button {
                width: 100%;
                min-height: 44px;
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 0 12px;
                border: 0;
                border-radius: 10px;
                background: transparent;
                color: rgba(255,255,255,.65);
                font: inherit;
                font-size: 13px;
                font-weight: 600;
                cursor: pointer;
                text-align: left;
            }

            .genz-logout-button:hover {
                background: rgba(255,255,255,.06);
                color: #ffffff;
            }

            .genz-mobile-toggle {
                display: none;
                position: fixed;
                top: 14px;
                left: 14px;
                z-index: 9998;
                width: 42px;
                height: 42px;
                border: 1px solid rgba(255,255,255,.1);
                border-radius: 10px;
                background: #0f1117;
                color: #ffffff;
                cursor: pointer;
                font-size: 20px;
            }

            .genz-sidebar-overlay {
                display: none;
                position: fixed;
                inset: 0;
                z-index: 9997;
                background: rgba(0,0,0,.55);
            }

            body.genz-menu-open {
                overflow: hidden;
            }

            @media (max-width: 768px) {

                .genz-sidebar {
                    transform: translateX(-100%);
                }

                .genz-sidebar.open {
                    transform: translateX(0);
                }

                .genz-mobile-close {
                    display: block;
                }

                .genz-mobile-toggle {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .genz-sidebar-overlay.open {
                    display: block;
                }
            }

            @media (min-width: 769px) {

                body {
                    padding-left: 260px;
                }
            }
        `;


        document.head.appendChild(
            style
        );
    }


    /* =========================================================
       LOADING
       ========================================================= */

    function showLoading() {
        let loading =
            document.getElementById(
                "genz-navigation-loading"
            );

        if (loading) {
            return;
        }


        loading =
            document.createElement("div");

        loading.id =
            "genz-navigation-loading";


        loading.innerHTML = `
            <div class="genz-navigation-loading-spinner"></div>
        `;


        loading.style.cssText = `
            position: fixed;
            inset: 0;
            z-index: 999999;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #0b0d12;
        `;


        const spinner =
            loading.querySelector(
                ".genz-navigation-loading-spinner"
            );


        if (spinner) {
            spinner.style.cssText = `
                width: 30px;
                height: 30px;
                border: 3px solid rgba(255,255,255,.15);
                border-top-color: rgba(255,255,255,.85);
                border-radius: 50%;
                animation: genz-navigation-spin .8s linear infinite;
            `;
        }


        if (
            !document.getElementById(
                "genz-navigation-loading-style"
            )
        ) {
            const style =
                document.createElement("style");

            style.id =
                "genz-navigation-loading-style";

            style.textContent = `
                @keyframes genz-navigation-spin {
                    from {
                        transform: rotate(0deg);
                    }

                    to {
                        transform: rotate(360deg);
                    }
                }
            `;

            document.head.appendChild(
                style
            );
        }


        document.body.appendChild(
            loading
        );
    }


    function hideLoading() {
        const loading =
            document.getElementById(
                "genz-navigation-loading"
            );

        if (!loading) {
            return;
        }

        loading.remove();
    }


    /* =========================================================
       INITIALIZATION
       ========================================================= */

    async function initNavigation() {
        if (initializationStarted) {
            return;
        }

        initializationStarted = true;


        /*
         * Jangan jalankan navigation auth guard
         * pada login page.
         */

        if (isLoginPage()) {
            resolveNavigationReady(
                false
            );

            return;
        }


        injectStyles();

        showLoading();


        try {
            /*
             * Validasi auth.
             */

            const authenticated =
                await validateAuthentication();


            if (!authenticated) {
                hideLoading();

                resolveNavigationReady(
                    false
                );

                return;
            }


            /*
             * Render navigation.
             */

            renderNavigation();


            /*
             * Pastikan global state tersedia.
             */

            window.GENZ_NAVIGATION_USER =
                currentUser;

            window.GENZ_NAVIGATION_PROFILE =
                currentProfile;

            window.GENZ_NAVIGATION_ROLE =
                currentRole;


            window.GENZ_NAVIGATION_READY =
                true;


            hideLoading();


            resolveNavigationReady(
                true
            );


            console.log(
                "[GENZ Navigation] Ready:",
                {
                    user: currentUser?.email,
                    role: currentRole
                }
            );

        } catch (error) {
            console.error(
                "[GENZ Navigation] Initialization error:",
                error
            );

            hideLoading();

            resolveNavigationReady(
                false
            );


            /*
             * Jangan signOut user hanya karena
             * initialization error.
             */

            redirectToLogin();
        }
    }


    /* =========================================================
       START
       ========================================================= */

    function start() {

        /*
         * Login page tidak membutuhkan navigation.
         */

        if (isLoginPage()) {
            resolveNavigationReady(
                false
            );

            return;
        }


        /*
         * Bind listener sekali.
         */

        bindAuthStateListener();


        if (
            document.readyState ===
            "loading"
        ) {
            document.addEventListener(
                "DOMContentLoaded",
                () => {
                    initNavigation();
                },
                {
                    once: true
                }
            );

            return;
        }


        initNavigation();
    }


    /* =========================================================
       PUBLIC API
       ========================================================= */

    window.GENZNavigation = {
        getUser: () =>
            currentUser,

        getProfile: () =>
            currentProfile,

        getRole: () =>
            currentRole,

        isAuthenticated: () =>
            !!currentUser,

        logout:
            logoutUser,

        refresh: async () => {
            initializationStarted = false;
            await initNavigation();
        }
    };


    /* =========================================================
       START
       ========================================================= */

    start();

})();
