//navigation.js?v=1.5
/* =========================================================
   GEN-Z.AI
   SHARED NAVIGATION
   ---------------------------------------------------------
   File:
   navigation/navigation.js

   Logo:
   - GEN-Z.AI neon logo
   - Menjadi satu-satunya logo navigation
   - Tidak menggunakan fixed logo terpisah di halaman
   - Tetap terlihat saat sidebar melakukan scroll

   Fungsi:
   - Supabase authentication
   - Profile loading
   - Role detection
   - User/Admin/Owner navigation
   - Global compatibility bridge
   - Logout
   - Mobile navigation
   - Active menu
   ========================================================= */

(() => {

    "use strict";


    /* =====================================================
       PREVENT DOUBLE INITIALIZATION
    ===================================================== */

    if (
        window.__GENZ_NAVIGATION_STARTED
    ) {

        return;

    }

    window.__GENZ_NAVIGATION_STARTED = true;


    /* =====================================================
       CONFIG
    ===================================================== */

    const STYLE_ID =
        "genz-shared-navigation-style";


    const NAVIGATION_CONTAINER_IDS = [
        "genz-navigation",
        "navigation",
        "adminNavigation"
    ];


    const LOGIN_PATH =
        "/login.html";


    const SESSION_RETRY_COUNT =
        5;


    const SESSION_RETRY_DELAY =
        500;


    const PROFILE_RETRY_COUNT =
        3;


    const PROFILE_RETRY_DELAY =
        500;


    /* =====================================================
       STATE
    ===================================================== */

    let currentUser = null;

    let currentProfile = null;

    let currentRole = "user";

    let authSubscription = null;

    let authListenerReady = false;

    let navigationReady = false;

    let navigationReadyResolve;


    const navigationReadyPromise =
        new Promise(
            resolve => {

                navigationReadyResolve =
                    resolve;

            }
        );


    /* =====================================================
       GLOBAL COMPATIBILITY BRIDGE
    ===================================================== */

    function syncNavigationGlobals() {

        window.GENZ_NAVIGATION_USER =
            currentUser || null;


        window.GENZ_NAVIGATION_PROFILE =
            currentProfile || null;


        window.GENZ_NAVIGATION_ROLE =
            normalizeRole(
                currentRole
            );


        if (
            currentProfile
        ) {

            window.GENZ_CURRENT_PROFILE =
                currentProfile;

        } else {

            window.GENZ_CURRENT_PROFILE =
                null;

        }

    }


    /* =====================================================
       SUPABASE
    ===================================================== */

    function getSupabaseClient() {

        if (
            window.GENZ_SUPABASE
        ) {

            return window.GENZ_SUPABASE;

        }


        if (
            window.supabaseClient
        ) {

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

            console.error(
                "[GEN-Z.AI] Supabase library tidak tersedia."
            );

            return null;

        }


        if (
            !config ||
            !config.SUPABASE_URL
        ) {

            console.error(
                "[GEN-Z.AI] SUPABASE_URL tidak tersedia."
            );

            return null;

        }


        const supabaseKey =
            config.SUPABASE_KEY ||
            config.SUPABASE_ANON_KEY;


        if (
            !supabaseKey
        ) {

            console.error(
                "[GEN-Z.AI] SUPABASE_KEY tidak tersedia."
            );

            return null;

        }


        try {

            const client =
                supabaseGlobal.createClient(
                    config.SUPABASE_URL,
                    supabaseKey
                );


            window.supabaseClient =
                client;


            return client;

        } catch (
            error
        ) {

            console.error(
                "[GEN-Z.AI] Supabase client error:",
                error
            );

            return null;

        }

    }


    /* =====================================================
       DELAY
    ===================================================== */

    function delay(
        milliseconds
    ) {

        return new Promise(
            resolve =>
                setTimeout(
                    resolve,
                    milliseconds
                )
        );

    }


    /* =====================================================
       CURRENT PATH
    ===================================================== */

    function getCurrentPath() {

        return (
            window.location.pathname ||
            "/"
        );

    }


    /* =====================================================
       LOGIN PATH CHECK
    ===================================================== */

    function isLoginPage() {

        const path =
            getCurrentPath()
                .toLowerCase();


        return (
            path === LOGIN_PATH ||
            path === "/login" ||
            path.endsWith("/login.html")
        );

    }


    /* =====================================================
       ROLE NORMALIZATION
    ===================================================== */

    function normalizeRole(
        role
    ) {

        const value =
            String(
                role || ""
            )
                .trim()
                .toLowerCase();


        if (
            value === "owner"
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


    /* =====================================================
       PROFILE ACTIVE CHECK
    ===================================================== */

    function isProfileActive(
        profile
    ) {

        if (
            !profile
        ) {

            return false;

        }


        if (
            profile.status ===
                undefined ||
            profile.status ===
                null ||
            String(
                profile.status
            ).trim() === ""
        ) {

            return true;

        }


        const status =
            String(
                profile.status
            )
                .trim()
                .toLowerCase();


        return (
            status === "active" ||
            status === "approved" ||
            status === "enabled"
        );

    }


    /* =====================================================
       SESSION
    ===================================================== */

    async function getSessionWithRetry() {

        const supabase =
            getSupabaseClient();


        if (
            !supabase ||
            !supabase.auth
        ) {

            return {
                session: null,
                user: null
            };

        }


        for (
            let attempt = 0;
            attempt < SESSION_RETRY_COUNT;
            attempt++
        ) {

            try {

                const {
                    data,
                    error
                } =
                    await supabase.auth.getSession();


                if (
                    !error &&
                    data &&
                    data.session
                ) {

                    return {
                        session:
                            data.session,

                        user:
                            data.session.user
                    };

                }


                if (
                    attempt <
                    SESSION_RETRY_COUNT - 1
                ) {

                    await delay(
                        SESSION_RETRY_DELAY
                    );

                }

            } catch (
                error
            ) {

                console.error(
                    "[GEN-Z.AI] Session error:",
                    error
                );


                if (
                    attempt <
                    SESSION_RETRY_COUNT - 1
                ) {

                    await delay(
                        SESSION_RETRY_DELAY
                    );

                }

            }

        }


        return {
            session: null,
            user: null
        };

    }


    /* =====================================================
       LOAD PROFILE
    ===================================================== */

    async function loadProfile(
        userId
    ) {

        const supabase =
            getSupabaseClient();


        if (
            !supabase ||
            !userId
        ) {

            return null;

        }


        let lastError =
            null;


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
                        .eq(
                            "id",
                            userId
                        )
                        .maybeSingle();


                if (
                    result.error &&
                    (
                        String(
                            result.error.message || ""
                        )
                            .toLowerCase()
                            .includes(
                                "status"
                            ) ||
                        String(
                            result.error.message || ""
                        )
                            .toLowerCase()
                            .includes(
                                "schema cache"
                            )
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
                                userId
                            )
                            .maybeSingle();

                }


                if (
                    !result.error
                ) {

                    return (
                        result.data ||
                        null
                    );

                }


                lastError =
                    result.error;

            } catch (
                error
            ) {

                lastError =
                    error;

            }


            if (
                attempt <
                PROFILE_RETRY_COUNT - 1
            ) {

                await delay(
                    PROFILE_RETRY_DELAY
                );

            }

        }


        if (
            lastError
        ) {

            console.error(
                "[GEN-Z.AI] Profile load error:",
                lastError
            );

        }


        return null;

    }


    /* =====================================================
       NAVIGATION CONFIG
    ===================================================== */

    function getNavigationConfig(
        role
    ) {

        const commonUserItems = [

            {
                label: "Dashboard",
                href: "/user/dashboard.html",
                icon: "♻️ "
            },

            {
                label: "Generate",
                href: "/generate/index.html",
                icon: "♻️ "
            },

           {
    label: "Vision",
    href: "/vision/index.html",
    icon: "👁️ "
},
           
           {
              label: "VidDra FREE",
              href: "/viddra/index.html",
              icon: "🎬 "
           },

            {
                label: "History",
                href: "/history/index.html",
                icon: "♻️ "
            },

            {
                label: "AI Metadata Cleaner",
                href: "/metadata-cleaner/index.html",
                icon: "🛡️ "
            },

            {
                label: "Top Up",
                href: "/user/topup.html",
                icon: "♻️ "
            },

            {
                label: "Hub Admin",
                href: "/user/hub-admin.html",
                icon: "♻️ "
            }

        ];


        const adminItems = [

            {
                label: "Dashboard",
                href: "/admin/dashboard/index.html",
                icon: "♻️ "
            },

            {
                label: "Generate",
                href: "/generate/index.html",
                icon: "♻️ "
            },

           {
    label: "Vision",
    href: "/vision/index.html",
    icon: "👁️ "
},
           
           {
              label: "VidDra FREE",
              href: "/viddra/index.html",
              icon: "🎬 "
           },

            {
                label: "History",
                href: "/history/index.html",
                icon: "♻️ "
            },

            {
                label: "AI Metadata Cleaner",
                href: "/metadata-cleaner/index.html",
                icon: "🛡️ "
            },

            {
                label: "Admin Panel",
                href: "/admin-control/admin-panel.html",
                icon: "♻️ "
            }

        ];


        if (
            role === "admin" ||
            role === "owner"
        ) {

            return adminItems;

        }


        return commonUserItems;

    }


    /* =====================================================
       NAVIGATION CONTAINER
    ===================================================== */

    function getNavigationContainer() {

        for (
            const id of
            NAVIGATION_CONTAINER_IDS
        ) {

            const existing =
                document.getElementById(
                    id
                );


            if (
                existing
            ) {

                return existing;

            }

        }


        const container =
            document.createElement(
                "div"
            );


        container.id =
            "genz-navigation";


        document.body.prepend(
            container
        );


        return container;

    }


    /* =====================================================
       ACTIVE LINK
    ===================================================== */

    function isActiveLink(
        href
    ) {

        const currentPath =
            getCurrentPath();


        if (
            href ===
            currentPath
        ) {

            return true;

        }


        try {

            const target =
                new URL(
                    href,
                    window.location.origin
                );


            const targetPath =
                target.pathname;


            if (
                targetPath ===
                currentPath
            ) {

                return true;

            }


            return (
                currentPath.startsWith(
                    targetPath
                ) &&
                targetPath !== "/"
            );

        } catch (
            error
        ) {

            return false;

        }

    }


    /* =====================================================
       ESCAPE HTML
    ===================================================== */

    function escapeHTML(
        value
    ) {

        return String(
            value ??
            ""
        )
            .replace(
                /&/g,
                "&amp;"
            )
            .replace(
                /</g,
                "&lt;"
            )
            .replace(
                />/g,
                "&gt;"
            )
            .replace(
                /"/g,
                "&quot;"
            )
            .replace(
                /'/g,
                "&#039;"
            );

    }


    /* =====================================================
       DISPLAY NAME
    ===================================================== */

    function getDisplayName() {

        const profile =
            currentProfile;


        if (
            profile &&
            profile.name &&
            String(
                profile.name
            ).trim()
        ) {

            return String(
                profile.name
            ).trim();

        }


        if (
            currentUser &&
            currentUser.user_metadata
        ) {

            const metadata =
                currentUser.user_metadata;


            if (
                metadata.full_name
            ) {

                return String(
                    metadata.full_name
                ).trim();

            }


            if (
                metadata.name
            ) {

                return String(
                    metadata.name
                ).trim();

            }

        }


        if (
            currentUser &&
            currentUser.email
        ) {

            return String(
                currentUser.email
            )
                .split("@")[0];

        }


        return "User";

    }


    /* =====================================================
       AVATAR LETTER
       -----------------------------------------------------
       Dipertahankan untuk compatibility internal.
       Tidak lagi ditampilkan pada navigation.
       ===================================================== */

    function getAvatarLetter() {

        const name =
            getDisplayName()
                .trim();


        return (
            name
                .charAt(0)
                .toUpperCase() ||
            "U"
        );

    }


    /* =====================================================
       RENDER NAVIGATION
    ===================================================== */

    function renderNavigation() {

        const container =
            getNavigationContainer();


        if (
            !container
        ) {

            return;

        }


        syncNavigationGlobals();


        const items =
            getNavigationConfig(
                currentRole
            );


        const email =
            currentUser &&
            currentUser.email
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
            items
                .map(
                    item => {

                        const active =
                            isActiveLink(
                                item.href
                            );


                        return `
                            <a
                                class="genz-nav-item${active ? " active" : ""}"
                                href="${escapeHTML(item.href)}"
                                data-genz-nav-link="true"
                            >
                                <span class="genz-nav-icon">
                                    ${item.icon || ""}
                                </span>

                                <span class="genz-nav-label">
                                    ${escapeHTML(item.label)}
                                </span>
                            </a>
                        `;

                    }
                )
                .join("");


        container.innerHTML = `
            <aside
                class="genz-sidebar"
                id="genz-sidebar"
                aria-label="GEN-Z.AI Navigation"
            >

                <!-- =================================================
                     SIDEBAR HEADER
                     ================================================= -->

                <div class="genz-sidebar-header">

                    <div class="genz-brand">

                        <div
                            class="genz-logo"
                            aria-label="GEN-Z.AI"
                            title="GEN-Z.AI"
                        >

                            <div
                                class="genz-logo-mark"
                                aria-hidden="true"
                            >
                                AI
                            </div>

                            <div class="genz-logo-text">

                                <span class="genz-logo-main">
                                    GEN-<strong>Z</strong>
                                </span>

                                <span class="genz-logo-ai">
                                    .AI
                                </span>

                            </div>

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


                <!-- =================================================
                     NAVIGATION
                     ================================================= -->

                <nav
                    class="genz-nav"
                    aria-label="Main navigation"
                >

                    ${navigationItems}

                </nav>


                <!-- =================================================
                     ACCOUNT + LOGOUT
                     ================================================= -->

                <div class="genz-sidebar-footer">

                    <div class="genz-account-box">

                        <div class="genz-account-label">
                            ACCOUNT
                        </div>

                        <div class="genz-account-email">
                            ${escapeHTML(
                                email
                            )}
                        </div>

                        <div class="genz-account-role">
                            ${escapeHTML(
                                roleLabel
                            )}
                        </div>

                    </div>


                    <button
                        type="button"
                        class="genz-logout-button"
                        id="genz-logout-button"
                    >
                        LOG OUT
                    </button>

                </div>

            </aside>


            <!-- =====================================================
                 MOBILE TOGGLE
                 ===================================================== -->

            <button
                type="button"
                class="genz-mobile-toggle"
                id="genz-mobile-toggle"
                aria-label="Open menu"
                aria-controls="genz-sidebar"
                aria-expanded="false"
            >
                <span></span>
                <span></span>
                <span></span>
            </button>


            <!-- =====================================================
                 MOBILE OVERLAY
                 ===================================================== -->

            <div
                class="genz-sidebar-overlay"
                id="genz-sidebar-overlay"
            ></div>
        `;


        bindNavigationEvents();


        navigationReady =
            true;


        if (
            navigationReadyResolve
        ) {

            navigationReadyResolve(
                true
            );

            navigationReadyResolve =
                null;

        }

    }


    /* =====================================================
       NAVIGATION EVENTS
    ===================================================== */

    function bindNavigationEvents() {

        const sidebar =
            document.getElementById(
                "genz-sidebar"
            );


        const toggle =
            document.getElementById(
                "genz-mobile-toggle"
            );


        const closeButton =
            document.getElementById(
                "genz-mobile-close"
            );


        const overlay =
            document.getElementById(
                "genz-sidebar-overlay"
            );


        const logoutButton =
            document.getElementById(
                "genz-logout-button"
            );


        function openMobileNavigation() {

            if (
                !sidebar
            ) {

                return;

            }


            sidebar.classList.add(
                "open"
            );


            if (
                overlay
            ) {

                overlay.classList.add(
                    "active"
                );

            }


            if (
                toggle
            ) {

                toggle.setAttribute(
                    "aria-expanded",
                    "true"
                );

            }


            document.body.classList.add(
                "genz-nav-open"
            );

        }


        function closeMobileNavigation() {

            if (
                sidebar
            ) {

                sidebar.classList.remove(
                    "open"
                );

            }


            if (
                overlay
            ) {

                overlay.classList.remove(
                    "active"
                );

            }


            if (
                toggle
            ) {

                toggle.setAttribute(
                    "aria-expanded",
                    "false"
                );

            }


            document.body.classList.remove(
                "genz-nav-open"
            );

        }


        if (
            toggle
        ) {

            toggle.addEventListener(
                "click",
                event => {

                    event.preventDefault();


                    if (
                        sidebar &&
                        sidebar.classList.contains(
                            "open"
                        )
                    ) {

                        closeMobileNavigation();

                    } else {

                        openMobileNavigation();

                    }

                }
            );

        }


        if (
            closeButton
        ) {

            closeButton.addEventListener(
                "click",
                event => {

                    event.preventDefault();

                    closeMobileNavigation();

                }
            );

        }


        if (
            overlay
        ) {

            overlay.addEventListener(
                "click",
                closeMobileNavigation
            );

        }


        document
            .querySelectorAll(
                "[data-genz-nav-link='true']"
            )
            .forEach(
                link => {

                    link.addEventListener(
                        "click",
                        () => {

                            closeMobileNavigation();

                        }
                    );

                }
            );


        if (
            logoutButton
        ) {

            logoutButton.addEventListener(
                "click",
                logoutUser
            );

        }


        document.addEventListener(
            "keydown",
            event => {

                if (
                    event.key ===
                    "Escape"
                ) {

                    closeMobileNavigation();

                }

            }
        );

    }


    /* =====================================================
       LOGOUT
    ===================================================== */

    async function logoutUser() {

        const supabase =
            getSupabaseClient();


        try {

            if (
                supabase &&
                supabase.auth
            ) {

                await supabase.auth.signOut();

            }

        } catch (
            error
        ) {

            console.error(
                "[GEN-Z.AI] Logout error:",
                error
            );

        }


        currentUser =
            null;


        currentProfile =
            null;


        currentRole =
            "user";


        syncNavigationGlobals();


        if (
            !isLoginPage()
        ) {

            window.location.href =
                LOGIN_PATH;

        }

    }


    /* =====================================================
       AUTH STATE
       ===================================================== */

    function setupAuthListener() {

        if (
            authListenerReady
        ) {

            return;

        }


        const supabase =
            getSupabaseClient();


        if (
            !supabase ||
            !supabase.auth
        ) {

            return;

        }


        authListenerReady =
            true;


        const result =
            supabase.auth.onAuthStateChange(
                async (
                    event,
                    session
                ) => {

                    /*
                     * =================================================
                     * SIGNED OUT
                     * =================================================
                     */

                    if (
                        event ===
                        "SIGNED_OUT"
                    ) {

                        currentUser =
                            null;


                        currentProfile =
                            null;


                        currentRole =
                            "user";


                        syncNavigationGlobals();


                        if (
                            !isLoginPage()
                        ) {

                            window.location.href =
                                LOGIN_PATH;

                        }


                        return;

                    }


                    /*
                     * =================================================
                     * SESSION TIDAK TERSEDIA
                     * =================================================
                     */

                    if (
                        !session ||
                        !session.user
                    ) {

                        return;

                    }


                    /*
                     * =================================================
                     * CURRENT USER
                     * -------------------------------------------------
                     * Gunakan session.user.
                     * Tidak ada variabel "user" yang berdiri sendiri
                     * di dalam callback ini.
                     * =================================================
                     */

                    currentUser =
                        session.user;


                    /*
                     * =================================================
                     * LOAD PROFILE
                     * =================================================
                     */

                    const profile =
                        await loadProfile(
                            session.user.id
                        );


                    /*
                     * =================================================
                     * PROFILE TERSEDIA
                     * =================================================
                     */

                    if (
                        profile
                    ) {

                        currentProfile =
                            profile;


                        currentRole =
                            normalizeRole(
                                profile.role
                            );


                        syncNavigationGlobals();


                        /*
                         * =============================================
                         * PROFILE TIDAK AKTIF
                         * =============================================
                         */

                        if (
                            !isProfileActive(
                                profile
                            )
                        ) {

                            await logoutUser();

                            return;

                        }

                    } else {

                        /*
                         * =============================================
                         * PROFILE TIDAK DITEMUKAN
                         * =============================================
                         */

                        currentProfile =
                            null;


                        currentRole =
                            "user";


                        syncNavigationGlobals();

                    }


                    /*
                     * =================================================
                     * RENDER NAVIGATION
                     * =================================================
                     */

                    renderNavigation();

                }
            );


        /*
         * =========================================================
         * SIMPAN SUBSCRIPTION
         * =========================================================
         */

        if (
            result &&
            result.data &&
            result.data.subscription
        ) {

            authSubscription =
                result.data.subscription;

        }

    }


    /* =====================================================
       AUTH VALIDATION
    ===================================================== */

    async function validateAuthentication() {

        const {
            session,
            user
        } =
            await getSessionWithRetry();


        if (
            !session ||
            !user
        ) {

            currentUser =
                null;


            currentProfile =
                null;


            currentRole =
                "user";


            syncNavigationGlobals();


            if (
                !isLoginPage()
            ) {

                window.location.href =
                    LOGIN_PATH;

            }


            return false;

        }


        currentUser =
            user;


        const profile =
            await loadProfile(
                user.id
            );


        if (
            profile
        ) {

            currentProfile =
                profile;


            currentRole =
                normalizeRole(
                    profile.role
                );


            syncNavigationGlobals();


            if (
                !isProfileActive(
                    profile
                )
            ) {

                await logoutUser();

                return false;

            }

        } else {

            currentProfile =
                null;


            currentRole =
                "user";


            syncNavigationGlobals();

        }


        return true;

    }


    /* =====================================================
       INJECT SHARED CSS
    ===================================================== */

    function injectStyles() {

        if (
            document.getElementById(
                STYLE_ID
            )
        ) {

            return;

        }


        const style =
            document.createElement(
                "style"
            );


        style.id =
            STYLE_ID;


        style.textContent = `

            /* =================================================
               GLOBAL
               ================================================= */

            :root {

                --genz-sidebar-width:
                    260px;

                --genz-red:
                    #ff2424;

                --genz-red-bright:
                    #ff3b3b;

                --genz-red-dark:
                    #760000;

                --genz-bg:
                    #0f1117;

                --genz-bg-soft:
                    #141720;

                --genz-border:
                    rgba(
                        255,
                        50,
                        50,
                        .18
                    );

            }


            /* =================================================
               SIDEBAR
               ================================================= */

            .genz-sidebar {

                position: fixed;

                top: 0;

                left: 0;

                bottom: 0;

                width:
                    var(
                        --genz-sidebar-width
                    );

                z-index: 9999;

                display: flex;

                flex-direction: column;

                box-sizing: border-box;

                background:
                    linear-gradient(
                        180deg,
                        #101218 0%,
                        #0b0d12 100%
                    );

                border-right:
                    1px solid
                    rgba(
                        255,
                        40,
                        40,
                        .16
                    );

                box-shadow:
                    8px 0 30px
                    rgba(
                        0,
                        0,
                        0,
                        .35
                    );

                overflow-x: hidden;

                overflow-y: auto;

                scrollbar-width: thin;

                scrollbar-color:
                    rgba(
                        255,
                        40,
                        40,
                        .35
                    )
                    transparent;

            }


            /* =================================================
               SIDEBAR HEADER
               ================================================= */

            .genz-sidebar-header {

                position: sticky;

                top: 0;

                z-index: 20;

                flex: 0 0 auto;

                display: flex;

                align-items: center;

                justify-content: space-between;

                min-height: 76px;

                padding:
                    15px 14px;

                box-sizing: border-box;

                background:
                    linear-gradient(
                        180deg,
                        rgba(
                            15,
                            17,
                            23,
                            .99
                        ),
                        rgba(
                            15,
                            17,
                            23,
                            .96
                        )
                    );

                border-bottom:
                    1px solid
                    rgba(
                        255,
                        40,
                        40,
                        .14
                    );

                backdrop-filter:
                    blur(12px);

            }


            /* =================================================
               BRAND
               ================================================= */

            .genz-brand {

                min-width: 0;

                display: flex;

                flex-direction: column;

                align-items: flex-start;

                gap: 6px;

            }


            /* =================================================
               GEN-Z.AI LOGO
               ================================================= */

            .genz-logo {

                position: relative;

                display: inline-flex;

                align-items: center;

                gap: 9px;

                min-height: 42px;

                max-width: 100%;

                padding:
                    6px 11px 6px 7px;

                box-sizing: border-box;

                border:
                    1px solid
                    rgba(
                        255,
                        55,
                        55,
                        .68
                    );

                border-radius: 12px;

                background:
                    linear-gradient(
                        135deg,
                        rgba(
                            255,
                            0,
                            0,
                            .14
                        ),
                        rgba(
                            0,
                            0,
                            0,
                            .78
                        )
                    );

                box-shadow:
                    0 0 8px
                    rgba(
                        255,
                        0,
                        0,
                        .25
                    ),
                    inset 0 0 14px
                    rgba(
                        255,
                        0,
                        0,
                        .08
                    );

                overflow: hidden;

                isolation: isolate;

            }


            .genz-logo::before {

                content: "";

                position: absolute;

                left: -30%;

                right: -30%;

                top: 0;

                height: 1px;

                background:
                    linear-gradient(
                        90deg,
                        transparent,
                        rgba(
                            255,
                            80,
                            80,
                            .95
                        ),
                        transparent
                    );

                opacity: .8;

                animation:
                    genzLogoScan
                    3.2s
                    linear
                    infinite;

                pointer-events: none;

                z-index: 1;

            }


            @keyframes genzLogoScan {

                0% {

                    transform:
                        translateY(0);

                    opacity: 0;

                }

                15% {

                    opacity: .8;

                }

                70% {

                    opacity: .8;

                }

                100% {

                    transform:
                        translateY(42px);

                    opacity: 0;

                }

            }


            .genz-logo-mark {

                position: relative;

                z-index: 2;

                width: 34px;

                height: 34px;

                flex: 0 0 34px;

                display: flex;

                align-items: center;

                justify-content: center;

                box-sizing: border-box;

                border:
                    1px solid
                    rgba(
                        255,
                        255,
                        255,
                        .18
                    );

                border-radius: 9px;

                background:
                    linear-gradient(
                        135deg,
                        #ff2525,
                        #760000
                    );

                color: #ffffff;

                font-size: 12px;

                line-height: 1;

                font-weight: 900;

                letter-spacing: .5px;

                box-shadow:
                    0 0 12px
                    rgba(
                        255,
                        0,
                        0,
                        .45
                    );

            }


            .genz-logo-text {

                position: relative;

                z-index: 2;

                display: flex;

                align-items: baseline;

                min-width: 0;

                white-space: nowrap;

                font-size: 18px;

                line-height: 1;

                font-weight: 900;

                letter-spacing: .3px;

            }


            .genz-logo-main {

                color: #ffffff;

                text-shadow:
                    0 0 8px
                    rgba(
                        255,
                        255,
                        255,
                        .16
                    );

            }


            .genz-logo-main strong {

                color:
                    var(
                        --genz-red-bright
                    );

                text-shadow:
                    0 0 10px
                    rgba(
                        255,
                        0,
                        0,
                        .75
                    );

            }


            .genz-logo-ai {

                margin-left: 1px;

                color:
                    #ff4a4a;

                text-shadow:
                    0 0 8px
                    rgba(
                        255,
                        0,
                        0,
                        .55
                    );

            }


            .genz-brand-subtitle {

                padding-left: 4px;

                color:
                    rgba(
                        255,
                        255,
                        255,
                        .45
                    );

                font-size: 10px;

                line-height: 1;

                font-weight: 600;

                letter-spacing:
                    1.2px;

                text-transform:
                    uppercase;

            }


            /* =================================================
               MOBILE CLOSE
               ================================================= */

            .genz-mobile-close {

                display: none;

                width: 36px;

                height: 36px;

                padding: 0;

                border: 0;

                border-radius: 10px;

                background:
                    rgba(
                        255,
                        255,
                        255,
                        .05
                    );

                color: #ffffff;

                font-size: 25px;

                line-height: 1;

                cursor: pointer;

            }


            .genz-mobile-close:hover {

                background:
                    rgba(
                        255,
                        40,
                        40,
                        .15
                    );

                color:
                    var(
                        --genz-red-bright
                    );

            }


            /* =================================================
               NAVIGATION
               ================================================= */

            .genz-nav {

                display: flex;

                flex-direction: column;

                gap: 4px;

                padding:
                    8px 10px 16px;

                box-sizing: border-box;

            }


            .genz-nav-item {

                position: relative;

                display: flex;

                align-items: center;

                gap: 10px;

                min-height: 44px;

                padding:
                    9px 11px;

                box-sizing: border-box;

                border:
                    1px solid
                    transparent;

                border-radius: 10px;

                color:
                    rgba(
                        255,
                        255,
                        255,
                        .66
                    );

                background:
                    transparent;

                text-decoration: none;

                transition:
                    background .18s ease,
                    border-color .18s ease,
                    color .18s ease,
                    box-shadow .18s ease,
                    transform .18s ease;

            }


            .genz-nav-item:hover {

                color: #ffffff;

                background:
                    rgba(
                        255,
                        35,
                        35,
                        .07
                    );

                border-color:
                    rgba(
                        255,
                        45,
                        45,
                        .16
                    );

                transform:
                    translateX(2px);

            }


            .genz-nav-item.active {

                color: #ffffff;

                background:
                    linear-gradient(
                        90deg,
                        rgba(
                            255,
                            35,
                            35,
                            .15
                        ),
                        rgba(
                            255,
                            35,
                            35,
                            .04
                        )
                    );

                border-color:
                    rgba(
                        255,
                        50,
                        50,
                        .28
                    );

                box-shadow:
                    inset 3px 0 0
                    var(
                        --genz-red
                    ),
                    0 0 14px
                    rgba(
                        255,
                        0,
                        0,
                        .05
                    );

            }


            .genz-nav-icon {

                width: 23px;

                flex: 0 0 23px;

                display: flex;

                align-items: center;

                justify-content: center;

                font-size: 15px;

                line-height: 1;

            }


            .genz-nav-label {

                min-width: 0;

                font-size: 12px;

                font-weight: 600;

                line-height: 1.3;

            }


            /* =================================================
               ACCOUNT + LOGOUT
               ================================================= */

            .genz-sidebar-footer {

                margin-top: auto;

                padding:
                    10px 10px 14px;

                box-sizing: border-box;

                border-top:
                    1px solid
                    rgba(
                        255,
                        255,
                        255,
                        .05
                    );

            }


            .genz-account-box {

                width: 100%;

                margin:
                    0 0 10px;

                padding:
                    10px 11px;

                box-sizing: border-box;

                border:
                    1px solid
                    rgba(
                        255,
                        50,
                        50,
                        .18
                    );

                border-radius: 10px;

                background:
                    rgba(
                        255,
                        255,
                        255,
                        .025
                    );

            }


            .genz-account-label {

                margin-bottom: 5px;

                color:
                    rgba(
                        255,
                        255,
                        255,
                        .45
                    );

                font-size: 9px;

                line-height: 1.2;

                font-weight: 800;

                letter-spacing:
                    1.2px;

            }


            .genz-account-email {

                overflow: hidden;

                color:
                    rgba(
                        255,
                        255,
                        255,
                        .72
                    );

                font-size: 10px;

                line-height: 1.35;

                font-weight: 600;

                text-overflow: ellipsis;

                white-space: nowrap;

            }


            .genz-account-role {

                display: inline-block;

                margin-top: 5px;

                padding:
                    2px 6px;

                border:
                    1px solid
                    rgba(
                        255,
                        50,
                        50,
                        .28
                    );

                border-radius: 5px;

                color:
                    #ff6565;

                background:
                    rgba(
                        255,
                        0,
                        0,
                        .06
                    );

                font-size: 8px;

                line-height: 1.3;

                font-weight: 800;

                letter-spacing:
                    .8px;

            }


            .genz-logout-button {

                width: 100%;

                min-height: 42px;

                display: flex;

                align-items: center;

                justify-content: center;

                padding:
                    9px 11px;

                box-sizing: border-box;

                border:
                    1px solid
                    rgba(
                        255,
                        50,
                        50,
                        .25
                    );

                border-radius: 10px;

                color:
                    #ff3b3b;

                background:
                    rgba(
                        255,
                        0,
                        0,
                        .025
                    );

                font: inherit;

                font-size: 12px;

                font-weight: 800;

                letter-spacing:
                    .8px;

                cursor: pointer;

                transition:
                    background .18s ease,
                    border-color .18s ease,
                    color .18s ease,
                    box-shadow .18s ease;

            }


            .genz-logout-button:hover {

                color:
                    #ff5555;

                background:
                    rgba(
                        255,
                        0,
                        0,
                        .08
                    );

                border-color:
                    rgba(
                        255,
                        50,
                        50,
                        .45
                    );

                box-shadow:
                    0 0 12px
                    rgba(
                        255,
                        0,
                        0,
                        .12
                    );

            }


            /* =================================================
               MOBILE TOGGLE
               ================================================= */

            .genz-mobile-toggle {

                display: none;

                position: fixed;

                top: 12px;

                left: 12px;

                z-index: 10001;

                width: 44px;

                height: 44px;

                padding: 9px;

                box-sizing: border-box;

                flex-direction: column;

                align-items: center;

                justify-content: center;

                gap: 5px;

                border:
                    1px solid
                    rgba(
                        255,
                        50,
                        50,
                        .32
                    );

                border-radius: 11px;

                background:
                    rgba(
                        10,
                        11,
                        15,
                        .94
                    );

                box-shadow:
                    0 0 18px
                    rgba(
                        255,
                        0,
                        0,
                        .12
                    );

                cursor: pointer;

                backdrop-filter:
                    blur(12px);

            }


            .genz-mobile-toggle span {

                display: block;

                width: 20px;

                height: 2px;

                border-radius: 2px;

                background:
                    #ffffff;

            }


            /* =================================================
               OVERLAY
               ================================================= */

            .genz-sidebar-overlay {

                display: none;

                position: fixed;

                inset: 0;

                z-index: 9998;

                background:
                    rgba(
                        0,
                        0,
                        0,
                        .62
                    );

                backdrop-filter:
                    blur(2px);

            }


            .genz-sidebar-overlay.active {

                display: block;

            }


            /* =================================================
               DESKTOP BODY OFFSET
               ================================================= */

            @media (
                min-width: 769px
            ) {

                body {

                    padding-left:
                        var(
                            --genz-sidebar-width
                        );

                }

            }


            /* =================================================
               MOBILE
               ================================================= */

            @media (
                max-width: 768px
            ) {

                .genz-sidebar {

                    width:
                        min(
                            290px,
                            86vw
                        );

                    transform:
                        translateX(-105%);

                    transition:
                        transform .22s
                        ease;

                    z-index: 10000;

                }


                .genz-sidebar.open {

                    transform:
                        translateX(0);

                }


                .genz-sidebar-header {

                    min-height: 72px;

                }


                .genz-mobile-close {

                    display: flex;

                    align-items: center;

                    justify-content: center;

                }


                .genz-mobile-toggle {

                    display: flex;

                }


                body {

                    padding-left: 0 !important;

                }


                body.genz-nav-open {

                    overflow: hidden;

                }

            }


            /* =================================================
               SMALL MOBILE
               ================================================= */

            @media (
                max-width: 480px
            ) {

                .genz-sidebar-header {

                    padding:
                        13px 11px;

                }


                .genz-logo {

                    gap: 8px;

                    min-height: 40px;

                    padding:
                        5px 9px 5px 6px;

                }


                .genz-logo-mark {

                    width: 32px;

                    height: 32px;

                    flex-basis: 32px;

                    border-radius: 8px;

                    font-size: 11px;

                }


                .genz-logo-text {

                    font-size: 17px;

                }


                .genz-nav {

                    padding:
                        7px 8px 14px;

                }


                .genz-sidebar-footer {

                    padding:
                        9px 8px 12px;

                }


                .genz-account-box {

                    margin-bottom:
                        9px;

                }

            }

        `;


        document.head.appendChild(
            style
        );

    }


    /* =====================================================
       INITIALIZE
    ===================================================== */

    async function initialize() {

        injectStyles();


        if (
            isLoginPage()
        ) {

            navigationReady =
                true;


            if (
                navigationReadyResolve
            ) {

                navigationReadyResolve(
                    true
                );

                navigationReadyResolve =
                    null;

            }


            return;

        }


        try {

            const authenticated =
                await validateAuthentication();


            if (
                !authenticated
            ) {

                navigationReady =
                    false;


                if (
                    navigationReadyResolve
                ) {

                    navigationReadyResolve(
                        false
                    );

                    navigationReadyResolve =
                        null;

                }


                return;

            }


            syncNavigationGlobals();


            renderNavigation();


            setupAuthListener();


            navigationReady =
                true;


            if (
                navigationReadyResolve
            ) {

                navigationReadyResolve(
                    true
                );

                navigationReadyResolve =
                    null;

            }

        } catch (
            error
        ) {

            console.error(
                "[GEN-Z.AI] Navigation initialization error:",
                error
            );


            navigationReady =
                false;


            syncNavigationGlobals();


            if (
                navigationReadyResolve
            ) {

                navigationReadyResolve(
                    false
                );

                navigationReadyResolve =
                    null;

            }

        }

    }


    /* =====================================================
       PUBLIC API
    ===================================================== */

    window.GENZNavigation = {

        init:
            initialize,

        render:
            renderNavigation,

        logout:
            logoutUser,

        getUser:
            () => currentUser,

        getProfile:
            () => currentProfile,

        getRole:
            () => currentRole,

        ready:
            navigationReadyPromise

    };


    window.GENZNavigationReady =
        navigationReadyPromise;


    syncNavigationGlobals();


    /* =====================================================
       DOM READY
    ===================================================== */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            initialize,
            {
                once: true
            }
        );

    } else {

        initialize();

    }

})();
