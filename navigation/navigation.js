/* =========================================================
   GEN-Z.AI
   SHARED ROLE-BASED NAVIGATION
   ---------------------------------------------------------
   File:
   navigation/navigation.js

   Tanggung jawab:
   - Shared navigation seluruh halaman
   - Premium dark luxury UI
   - Neon red accent
   - Luxury G monogram
   - Hamburger / X
   - Sidebar slide
   - Overlay
   - Active navigation
   - ESC close
   - Supabase Auth validation
   - Supabase Profile / Role validation
   - Navigation berdasarkan role

   ROLE:
   - USER
   - ADMIN
   - OWNER

   SUPABASE:
   - auth.getSession()
   - profiles.id
   - profiles.role
   - profiles.status

   CATATAN AUTH:
   - Tidak pernah menggunakan window.supabase
     sebagai Supabase client secara langsung.
   - window.supabase dari CDN adalah library.
   - Shared client disimpan di:
       window.GENZ_SUPABASE
       window.supabaseClient
   - Jika shared client belum ada, client dibuat
     menggunakan GENZ_CONFIG.
   ========================================================= */

(() => {

    "use strict";


    /* =====================================================
       CONFIG
       ===================================================== */

    const STYLE_ID =
        "gz-shared-navigation-style";

    const CONTAINER_ID =
        "navigation";

    const LOGIN_PATH =
        "/login.html";


    /* =====================================================
       ROLE NAVIGATION
       ===================================================== */

    const NAVIGATION_BY_ROLE = {

        USER: [
            {
                label: "DASHBOARD",
                href: "/user/dashboard.html",
                icon: "♻️"
            },
            {
                label: "GENERATE",
                href: "/generate/index.html",
                icon: "♻️"
            },
            {
                label: "HISTORY",
                href: "/history/index.html",
                icon: "♻️"
            },
            {
                label: "TOP UP",
                href: "/user/topup.html",
                icon: "♻️"
            },
            {
                label: "HUB ADMIN",
                href: "/user/hub-admin.html",
                icon: "♻️"
            }
        ],

        ADMIN: [
            {
                label: "DASHBOARD ADMIN",
                href: "/admin/dashboard.html",
                icon: "♻️"
            },
            {
                label: "GENERATE",
                href: "/generate/index.html",
                icon: "♻️"
            },
            {
                label: "HISTORY",
                href: "/history/index.html",
                icon: "♻️"
            },
            {
                label: "ADMIN PANEL",
                href: "/admin-control/admin-panel.html",
                icon: "♻️"
            }
        ],

        OWNER: [
            {
                label: "DASHBOARD ADMIN",
                href: "/admin/dashboard.html",
                icon: "♻️"
            },
            {
                label: "GENERATE",
                href: "/generate/index.html",
                icon: "♻️"
            },
            {
                label: "HISTORY",
                href: "/history/index.html",
                icon: "♻️"
            },
            {
                label: "ADMIN PANEL",
                href: "/admin-control/admin-panel.html",
                icon: "♻️"
            }
        ]

    };


    /* =====================================================
       CURRENT USER
       ===================================================== */

    let currentUser = null;

    let currentProfile = null;

    let currentRole = null;


    /* =====================================================
       SUPABASE CLIENT CACHE
       ===================================================== */

    let cachedSupabaseClient = null;


    /* =====================================================
       CSS
       ===================================================== */

    const CSS = `

        :root {

            --gz-red: #ff1744;
            --gz-red-bright: #ff3159;
            --gz-red-light: #ff5878;

            --gz-red-soft:
                rgba(255, 23, 68, 0.08);

            --gz-red-soft-2:
                rgba(255, 23, 68, 0.14);

            --gz-red-border:
                rgba(255, 23, 68, 0.32);

            --gz-red-border-strong:
                rgba(255, 23, 68, 0.58);

            --gz-black: #030304;
            --gz-black-2: #070709;

            --gz-panel:
                rgba(10, 10, 13, 0.96);

            --gz-panel-soft:
                rgba(17, 17, 21, 0.88);

            --gz-white: #ffffff;

            --gz-white-soft:
                rgba(255, 255, 255, 0.72);

            --gz-white-muted:
                rgba(255, 255, 255, 0.43);
        }


        /* =================================================
           MENU BUTTON
           ================================================= */

        .gz-admin-menu-button {

            position: fixed;

            top: 20px;
            left: 20px;

            width: 48px;
            height: 48px;

            padding: 0;
            margin: 0;

            display: flex;

            align-items: center;
            justify-content: center;

            border:
                1px solid
                var(--gz-red-border-strong);

            border-radius: 15px;

            background:
                radial-gradient(
                    circle at 30% 20%,
                    rgba(255,255,255,0.08),
                    transparent 32%
                ),
                linear-gradient(
                    145deg,
                    rgba(22,22,26,0.94),
                    rgba(5,5,7,0.96)
                );

            backdrop-filter: blur(18px);
            -webkit-backdrop-filter: blur(18px);

            box-shadow:
                inset 0 1px 0
                    rgba(255,255,255,0.06),

                inset 0 0 0 1px
                    rgba(255,23,68,0.04),

                0 8px 30px
                    rgba(0,0,0,0.48),

                0 0 18px
                    rgba(255,23,68,0.13);

            cursor: pointer;

            z-index: 99999;

            transition:
                transform 0.25s ease,
                border-color 0.25s ease,
                box-shadow 0.25s ease,
                background 0.25s ease;
        }


        .gz-admin-menu-button:hover {

            transform:
                translateY(-1px);

            border-color:
                var(--gz-red);

            background:
                radial-gradient(
                    circle at 30% 20%,
                    rgba(255,255,255,0.10),
                    transparent 32%
                ),
                linear-gradient(
                    145deg,
                    rgba(27,27,31,0.98),
                    rgba(7,7,9,0.98)
                );

            box-shadow:
                inset 0 1px 0
                    rgba(255,255,255,0.07),

                0 10px 34px
                    rgba(0,0,0,0.52),

                0 0 24px
                    rgba(255,23,68,0.28);
        }


        .gz-admin-menu-button:active {

            transform:
                scale(0.96);
        }


        .gz-admin-menu-icon {

            position: relative;

            width: 20px;
            height: 16px;

            display: block;
        }


        .gz-admin-menu-icon span {

            position: absolute;

            left: 0;

            width: 20px;
            height: 2px;

            border-radius: 999px;

            background:
                #ffffff;

            box-shadow:
                0 0 5px
                    rgba(255,255,255,0.72),

                0 0 10px
                    rgba(255,23,68,0.78);

            transition:
                top 0.25s ease,
                transform 0.25s ease,
                opacity 0.2s ease;
        }


        .gz-admin-menu-icon span:nth-child(1) {

            top: 0;
        }


        .gz-admin-menu-icon span:nth-child(2) {

            top: 7px;
        }


        .gz-admin-menu-icon span:nth-child(3) {

            top: 14px;
        }


        .gz-admin-menu-button.open
        .gz-admin-menu-icon span:nth-child(1) {

            top: 7px;

            transform:
                rotate(45deg);
        }


        .gz-admin-menu-button.open
        .gz-admin-menu-icon span:nth-child(2) {

            opacity: 0;

            transform:
                scaleX(0);
        }


        .gz-admin-menu-button.open
        .gz-admin-menu-icon span:nth-child(3) {

            top: 7px;

            transform:
                rotate(-45deg);
        }


        /* =================================================
           OVERLAY
           ================================================= */

        .gz-admin-nav-overlay {

            position: fixed;

            inset: 0;

            background:
                radial-gradient(
                    circle at 12% 20%,
                    rgba(255,23,68,0.035),
                    transparent 28%
                ),
                rgba(0,0,0,0.68);

            backdrop-filter:
                blur(4px);

            -webkit-backdrop-filter:
                blur(4px);

            opacity: 0;

            visibility: hidden;

            pointer-events: none;

            z-index: 99990;

            transition:
                opacity 0.28s ease,
                visibility 0.28s ease;
        }


        .gz-admin-nav-overlay.open {

            opacity: 1;

            visibility: visible;

            pointer-events: auto;
        }


        /* =================================================
           SIDEBAR
           ================================================= */

        .gz-admin-sidebar {

            position: fixed;

            top: 0;
            left: 0;
            bottom: 0;

            width: 300px;

            box-sizing: border-box;

            padding:
                30px
                18px
                20px;

            background:
                radial-gradient(
                    circle at 0% 0%,
                    rgba(255,23,68,0.13),
                    transparent 34%
                ),

                radial-gradient(
                    circle at 100% 80%,
                    rgba(255,23,68,0.045),
                    transparent 35%
                ),

                linear-gradient(
                    145deg,
                    rgba(17,17,21,0.98),
                    rgba(4,4,6,0.99)
                );

            border-right:
                1px solid
                rgba(255,23,68,0.32);

            box-shadow:

                inset -1px 0 0
                    rgba(255,255,255,0.025),

                18px 0 60px
                    rgba(0,0,0,0.58),

                0 0 40px
                    rgba(255,23,68,0.06);

            transform:
                translateX(-105%);

            transition:
                transform
                0.32s
                cubic-bezier(
                    0.22,
                    0.8,
                    0.25,
                    1
                );

            z-index: 99995;

            display: flex;

            flex-direction: column;

            overflow-y: auto;
            overflow-x: hidden;

            scrollbar-width: thin;

            scrollbar-color:
                rgba(255,23,68,0.35)
                transparent;
        }


        .gz-admin-sidebar::-webkit-scrollbar {

            width: 4px;
        }


        .gz-admin-sidebar::-webkit-scrollbar-track {

            background:
                transparent;
        }


        .gz-admin-sidebar::-webkit-scrollbar-thumb {

            background:
                rgba(255,23,68,0.35);

            border-radius:
                999px;
        }


        .gz-admin-sidebar.open {

            transform:
                translateX(0);
        }


        /* =================================================
           BRAND
           ================================================= */

        .gz-admin-brand {

            display: flex;

            align-items: center;

            gap: 13px;

            padding:
                4px
                8px
                29px;
        }


        .gz-admin-logo {

            position: relative;

            width: 50px;
            height: 50px;

            flex: 0 0 50px;

            display: flex;

            align-items: center;
            justify-content: center;

            border:
                1px solid
                rgba(255,23,68,0.62);

            border-radius: 16px;

            background:
                radial-gradient(
                    circle at 30% 20%,
                    rgba(255,255,255,0.11),
                    transparent 30%
                ),

                radial-gradient(
                    circle at 75% 80%,
                    rgba(255,23,68,0.08),
                    transparent 45%
                ),

                linear-gradient(
                    145deg,
                    #19191e,
                    #060608
                );

            color:
                #ffffff;

            font-family:
                Georgia,
                "Times New Roman",
                serif;

            font-size:
                31px;

            font-weight:
                700;

            font-style:
                italic;

            line-height:
                1;

            text-shadow:

                0 0 3px
                    #ffffff,

                0 0 8px
                    rgba(255,23,68,0.95),

                0 0 17px
                    rgba(255,23,68,0.70),

                0 0 30px
                    rgba(255,23,68,0.34);

            box-shadow:

                inset 0 1px 0
                    rgba(255,255,255,0.08),

                inset 0 0 0 1px
                    rgba(255,23,68,0.045),

                0 0 20px
                    rgba(255,23,68,0.17),

                0 8px 28px
                    rgba(0,0,0,0.46);
        }


        .gz-admin-logo::after {

            content: "";

            position: absolute;

            inset: 5px;

            border:
                1px solid
                rgba(255,255,255,0.035);

            border-radius:
                11px;

            pointer-events:
                none;
        }


        .gz-admin-brand-copy {

            min-width: 0;
        }


        .gz-admin-brand-name {

            color:
                #ffffff;

            font-size:
                19px;

            font-weight:
                850;

            letter-spacing:
                0.13em;

            line-height:
                1.1;

            white-space:
                nowrap;

            text-shadow:
                0 0 12px
                rgba(255,23,68,0.20);
        }


        .gz-admin-brand-sub {

            margin-top:
                6px;

            color:
                rgba(255,255,255,0.40);

            font-size:
                8px;

            font-weight:
                800;

            letter-spacing:
                0.25em;

            white-space:
                nowrap;
        }


        /* =================================================
           NAVIGATION
           ================================================= */

        .gz-admin-nav {

            display: flex;

            flex-direction: column;

            gap: 7px;
        }


        .gz-admin-nav-link,
        .gz-admin-nav-logout {

            position: relative;

            width: 100%;

            min-height:
                53px;

            box-sizing:
                border-box;

            display:
                flex;

            align-items:
                center;

            gap:
                13px;

            padding:
                0
                15px;

            border:
                1px solid
                transparent;

            border-radius:
                14px;

            color:
                rgba(255,255,255,0.64);

            background:
                transparent;

            text-decoration:
                none;

            font-size:
                11px;

            font-weight:
                850;

            letter-spacing:
                0.075em;

            transition:

                color 0.22s ease,
                border-color 0.22s ease,
                background 0.22s ease,
                box-shadow 0.22s ease,
                transform 0.22s ease;
        }


        .gz-admin-nav-link:hover,
        .gz-admin-nav-logout:hover {

            color:
                #ffffff;

            border-color:
                rgba(255,23,68,0.30);

            background:
                linear-gradient(
                    90deg,
                    rgba(255,23,68,0.105),
                    rgba(255,23,68,0.025)
                );

            box-shadow:

                inset 0 0 18px
                    rgba(255,23,68,0.035),

                0 0 22px
                    rgba(255,23,68,0.09);

            transform:
                translateX(3px);
        }


        .gz-admin-nav-link.active {

            color:
                #ffffff;

            border-color:
                rgba(255,23,68,0.48);

            background:
                linear-gradient(
                    90deg,
                    rgba(255,23,68,0.18),
                    rgba(255,23,68,0.035)
                );

            box-shadow:

                inset 0 0 22px
                    rgba(255,23,68,0.045),

                0 0 28px
                    rgba(255,23,68,0.15);

            text-shadow:
                0 0 9px
                rgba(255,23,68,0.45);
        }


        .gz-admin-nav-link.active::before {

            content:
                "";

            position:
                absolute;

            left:
                -1px;

            top:
                9px;

            bottom:
                9px;

            width:
                3px;

            border-radius:
                0 6px 6px 0;

            background:
                var(--gz-red);

            box-shadow:

                0 0 7px
                    var(--gz-red),

                0 0 16px
                    rgba(255,23,68,0.82),

                0 0 27px
                    rgba(255,23,68,0.42);
        }


        /* =================================================
           ICON
           ================================================= */

        .gz-admin-nav-icon {

            width:
                26px;

            height:
                26px;

            flex:
                0 0 26px;

            display:
                flex;

            align-items:
                center;

            justify-content:
                center;

            color:
                var(--gz-red-bright);

            font-family:
                Georgia,
                "Times New Roman",
                serif;

            font-size:
                17px;

            text-shadow:

                0 0 7px
                    rgba(255,23,68,0.80),

                0 0 15px
                    rgba(255,23,68,0.32);

            transition:

                transform 0.22s ease,
                text-shadow 0.22s ease;
        }


        .gz-admin-nav-link:hover
        .gz-admin-nav-icon,

        .gz-admin-nav-link.active
        .gz-admin-nav-icon {

            transform:
                scale(1.05);

            text-shadow:

                0 0 8px
                    rgba(255,23,68,0.95),

                0 0 18px
                    rgba(255,23,68,0.55);
        }


        .gz-admin-nav-link:first-child
        .gz-admin-nav-icon {

            border:
                1px solid
                rgba(255,23,68,0.48);

            border-radius:
                8px;

            font-size:
                15px;

            font-weight:
                900;

            box-shadow:

                inset 0 0 8px
                    rgba(255,23,68,0.04),

                0 0 10px
                    rgba(255,23,68,0.11);
        }


        /* =================================================
           DIVIDER
           ================================================= */

        .gz-admin-nav-divider {

            position:
                relative;

            height:
                1px;

            margin:
                auto
                8px
                13px;

            background:
                linear-gradient(
                    90deg,
                    transparent,
                    rgba(255,23,68,0.38),
                    transparent
                );
        }


        .gz-admin-nav-divider::after {

            content:
                "";

            position:
                absolute;

            left:
                50%;

            top:
                0;

            width:
                36px;

            height:
                1px;

            transform:
                translateX(-50%);

            background:
                var(--gz-red);

            box-shadow:
                0 0 7px
                var(--gz-red);
        }


        /* =================================================
           LOGOUT
           ================================================= */

        .gz-admin-nav-logout {

            appearance:
                none;

            -webkit-appearance:
                none;

            color:
                rgba(255,255,255,0.54);

            cursor:
                pointer;

            border-color:
                rgba(255,23,68,0.14);

            background:
                rgba(255,23,68,0.025);

            font-family:
                inherit;

            text-align:
                left;
        }


        .gz-admin-nav-logout:hover {

            color:
                #ffffff;

            border-color:
                rgba(255,23,68,0.40);

            background:
                rgba(255,23,68,0.09);

            box-shadow:
                0 0 22px
                rgba(255,23,68,0.12);
        }


        /* =================================================
           FOCUS
           ================================================= */

        .gz-admin-nav-link:focus-visible,
        .gz-admin-nav-logout:focus-visible,
        .gz-admin-menu-button:focus-visible {

            outline:
                none;

            border-color:
                var(--gz-red);

            box-shadow:

                0 0 0 2px
                    rgba(255,23,68,0.16),

                0 0 24px
                    rgba(255,23,68,0.28);
        }


        /* =================================================
           AUTH LOADING
           ================================================= */

        .gz-navigation-loading {

            position:
                fixed;

            inset:
                0;

            z-index:
                100000;

            display:
                flex;

            align-items:
                center;

            justify-content:
                center;

            background:
                #030304;

            color:
                rgba(255,255,255,0.72);

            font-size:
                11px;

            font-weight:
                800;

            letter-spacing:
                0.16em;

            text-transform:
                uppercase;
        }


        .gz-navigation-loading::after {

            content:
                "";

            width:
                18px;

            height:
                18px;

            margin-left:
                12px;

            border:
                2px solid
                rgba(255,255,255,0.15);

            border-top-color:
                var(--gz-red);

            border-radius:
                50%;

            animation:
                gzNavigationSpin
                0.75s linear infinite;
        }


        @keyframes gzNavigationSpin {

            to {

                transform:
                    rotate(360deg);
            }
        }


        /* =================================================
           MOBILE
           ================================================= */

        @media (max-width: 600px) {

            .gz-admin-sidebar {

                width:
                    min(300px, 88vw);

                padding-top:
                    24px;
            }


            .gz-admin-menu-button {

                top:
                    14px;

                left:
                    14px;

                width:
                    45px;

                height:
                    45px;

                border-radius:
                    14px;
            }


            .gz-admin-brand {

                padding-bottom:
                    25px;
            }
        }


        /* =================================================
           REDUCED MOTION
           ================================================= */

        @media (prefers-reduced-motion: reduce) {

            .gz-admin-menu-button,
            .gz-admin-menu-icon span,
            .gz-admin-nav-overlay,
            .gz-admin-sidebar,
            .gz-admin-nav-link,
            .gz-admin-nav-logout,
            .gz-admin-nav-icon {

                transition:
                    none !important;
            }
        }

    `;


    /* =====================================================
       STYLE INJECTION
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


        style.textContent =
            CSS;


        document.head.appendChild(
            style
        );
    }


    /* =====================================================
       SUPABASE CLIENT
       ===================================================== */

    function getSupabaseClient() {

        /*
         * -------------------------------------------------
         * 1. Gunakan cached client
         * -------------------------------------------------
         */

        if (
            cachedSupabaseClient &&
            cachedSupabaseClient.auth
        ) {

            return cachedSupabaseClient;
        }


        /*
         * -------------------------------------------------
         * 2. Shared GENZ_SUPABASE
         * -------------------------------------------------
         */

        if (
            window.GENZ_SUPABASE &&
            window.GENZ_SUPABASE.auth
        ) {

            cachedSupabaseClient =
                window.GENZ_SUPABASE;

            return cachedSupabaseClient;
        }


        /*
         * -------------------------------------------------
         * 3. Shared supabaseClient
         * -------------------------------------------------
         */

        if (
            window.supabaseClient &&
            window.supabaseClient.auth
        ) {

            cachedSupabaseClient =
                window.supabaseClient;

            window.GENZ_SUPABASE =
                cachedSupabaseClient;

            return cachedSupabaseClient;
        }


        /*
         * -------------------------------------------------
         * 4. Buat client dari konfigurasi resmi
         * -------------------------------------------------
         *
         * window.supabase dari CDN TIDAK digunakan
         * sebagai client.
         *
         * Ia hanya menyediakan createClient().
         * -------------------------------------------------
         */

        const library =
            window.supabase;


        const config =
            window.GENZ_CONFIG;


        if (
            library &&
            typeof library.createClient ===
                "function" &&
            config &&
            config.SUPABASE_URL &&
            config.SUPABASE_KEY
        ) {

            try {

                cachedSupabaseClient =
                    library.createClient(
                        config.SUPABASE_URL,
                        config.SUPABASE_KEY
                    );


                window.GENZ_SUPABASE =
                    cachedSupabaseClient;


                window.supabaseClient =
                    cachedSupabaseClient;


                return cachedSupabaseClient;

            } catch (error) {

                console.error(
                    "[GEN-Z.AI] Gagal membuat Supabase client:",
                    error
                );

                return null;
            }
        }


        console.error(
            "[GEN-Z.AI] Supabase client belum tersedia."
        );


        return null;
    }


    /* =====================================================
       AUTH
       ===================================================== */

    async function getAuthenticatedUser() {

        const supabase =
            getSupabaseClient();


        if (
            !supabase ||
            !supabase.auth ||
            typeof supabase.auth.getSession !==
                "function"
        ) {

            console.error(
                "[GEN-Z.AI] Supabase Auth client tidak ditemukan."
            );

            return null;
        }


        try {

            const {
                data,
                error
            } =
                await supabase.auth.getSession();


            if (error) {

                console.error(
                    "[GEN-Z.AI] Gagal membaca session:",
                    error
                );

                return null;
            }


            if (
                !data ||
                !data.session ||
                !data.session.user
            ) {

                return null;
            }


            return data.session.user;

        } catch (error) {

            console.error(
                "[GEN-Z.AI] Auth session error:",
                error
            );

            return null;
        }
    }


    /* =====================================================
       PROFILE
       ===================================================== */

    async function getUserProfile(
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


        try {

            const {
                data,
                error
            } =
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


            if (error) {

                console.error(
                    "[GEN-Z.AI] Gagal mengambil profile:",
                    error
                );

                return null;
            }


            return data || null;

        } catch (error) {

            console.error(
                "[GEN-Z.AI] Profile error:",
                error
            );

            return null;
        }
    }


    /* =====================================================
       PROFILE STATUS
       ===================================================== */

    function isProfileActive(
        profile
    ) {

        /*
         * Status NULL tidak dianggap sebagai akun
         * nonaktif karena beberapa profile lama mungkin
         * belum memiliki nilai status.
         */

        if (
            !profile ||
            profile.status === null ||
            profile.status === undefined
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
            status === "" ||
            status === "active" ||
            status === "aktif" ||
            status === "enabled"
        );
    }


    /* =====================================================
       ROLE NORMALIZATION
       ===================================================== */

    function normalizeRole(
        role
    ) {

        const normalized =
            String(
                role || ""
            )
            .trim()
            .toUpperCase();


        if (
            normalized === "USER"
        ) {

            return "USER";
        }


        if (
            normalized === "ADMIN"
        ) {

            return "ADMIN";
        }


        if (
            normalized === "OWNER"
        ) {

            return "OWNER";
        }


        return null;
    }


    /* =====================================================
       VALIDATE AUTH + ROLE
       ===================================================== */

    async function validateAuthentication() {

        const user =
            await getAuthenticatedUser();


        if (!user) {

            console.warn(
                "[GEN-Z.AI] Session tidak ditemukan."
            );

            redirectToLogin();

            return false;
        }


        currentUser =
            user;


        const profile =
            await getUserProfile(
                user.id
            );


        if (!profile) {

            console.error(
                "[GEN-Z.AI] Profile user tidak ditemukan."
            );

            /*
             * Jangan langsung signOut.
             *
             * Jika query profile gagal karena RLS,
             * network, atau Supabase belum siap,
             * session sebenarnya masih valid.
             *
             * SignOut di sini justru membuat user
             * benar-benar kehilangan session.
             */

            return false;
        }


        if (
            String(profile.id) !==
            String(user.id)
        ) {

            console.error(
                "[GEN-Z.AI] ID profile tidak sesuai dengan Auth user."
            );

            return false;
        }


        if (
            !isProfileActive(
                profile
            )
        ) {

            console.warn(
                "[GEN-Z.AI] Akun tidak aktif."
            );

            /*
             * Hanya akun yang benar-benar memiliki
             * status nonaktif yang dikeluarkan.
             */

            await signOutSilently();

            redirectToLogin();

            return false;
        }


        const role =
            normalizeRole(
                profile.role
            );


        if (!role) {

            console.error(
                "[GEN-Z.AI] Role tidak valid:",
                profile.role
            );

            /*
             * Jangan signOut hanya karena role
             * belum terbaca/terisi. Session Auth tetap
             * valid.
             */

            return false;
        }


        currentProfile =
            profile;


        currentRole =
            role;


        return true;
    }


    /* =====================================================
       REDIRECT LOGIN
       ===================================================== */

    function redirectToLogin() {

        if (
            window.location.pathname ===
            LOGIN_PATH
        ) {

            return;
        }


        window.location.href =
            LOGIN_PATH;
    }


    /* =====================================================
       CURRENT PATH
       ===================================================== */

    function normalizePath(
        path
    ) {

        if (!path) {

            return "";
        }


        let value =
            String(path);


        value =
            value.replace(
                /\\/g,
                "/"
            );


        if (
            value.length > 1
        ) {

            value =
                value.replace(
                    /\/+$/,
                    ""
                );
        }


        return value;
    }


    function getCurrentPath() {

        return normalizePath(
            window.location.pathname
        );
    }


    /* =====================================================
       ACTIVE NAVIGATION
       ===================================================== */

    function isActive(
        href
    ) {

        try {

            const url =
                new URL(
                    href,
                    window.location.origin
                );


            const currentPath =
                getCurrentPath();


            const targetPath =
                normalizePath(
                    url.pathname
                );


            if (
                currentPath ===
                targetPath
            ) {

                return true;
            }


            if (
                targetPath !== "/" &&
                currentPath.endsWith(
                    targetPath
                )
            ) {

                return true;
            }


            return false;

        } catch (error) {

            return false;
        }
    }


    /* =====================================================
       RENDER
       ===================================================== */

    function render(
        container
    ) {

        if (
            !container ||
            !currentRole
        ) {

            return;
        }


        const navItems =
            NAVIGATION_BY_ROLE[
                currentRole
            ] || [];


        const brandSub =
            currentRole === "USER"
                ? "USER"
                : "ADMIN CONTROL";


        container.innerHTML = `

            <button
                class="gz-admin-menu-button"
                id="gzAdminMenuButton"
                type="button"
                aria-label="Buka menu"
                aria-expanded="false"
                aria-controls="gzAdminSidebar"
            >

                <span
                    class="gz-admin-menu-icon"
                    aria-hidden="true"
                >

                    <span></span>
                    <span></span>
                    <span></span>

                </span>

            </button>


            <div
                class="gz-admin-nav-overlay"
                id="gzAdminNavOverlay"
                aria-hidden="true"
            ></div>


            <aside
                class="gz-admin-sidebar"
                id="gzAdminSidebar"
                aria-label="Navigasi utama"
            >

                <div class="gz-admin-brand">

                    <div
                        class="gz-admin-logo"
                        aria-label="GEN-Z.AI"
                    >
                        G
                    </div>


                    <div
                        class="gz-admin-brand-copy"
                    >

                        <div
                            class="gz-admin-brand-name"
                        >
                            GEN-Z.AI
                        </div>


                        <div
                            class="gz-admin-brand-sub"
                        >
                            ${brandSub}
                        </div>

                    </div>

                </div>


                <nav
                    class="gz-admin-nav"
                    aria-label="Menu utama"
                >

                    ${navItems.map(
                        item => `

                            <a
                                class="gz-admin-nav-link${
                                    isActive(
                                        item.href
                                    )
                                        ? " active"
                                        : ""
                                }"
                                href="${item.href}"
                            >

                                <span
                                    class="gz-admin-nav-icon"
                                    aria-hidden="true"
                                >
                                    ${item.icon}
                                </span>


                                <span>
                                    ${item.label}
                                </span>

                            </a>

                        `
                    ).join("")}

                </nav>


                <div
                    class="gz-admin-nav-divider"
                    aria-hidden="true"
                ></div>


                <button
                    class="gz-admin-nav-logout"
                    id="gzAdminLogoutButton"
                    type="button"
                >

                    <span
                        class="gz-admin-nav-icon"
                        aria-hidden="true"
                    >
                        ↪
                    </span>


                    <span>
                        LOG OUT
                    </span>

                </button>

            </aside>
        `;


        bindEvents();
    }


    /* =====================================================
       MENU CONTROL
       ===================================================== */

    function toggleMenu() {

        const sidebar =
            document.getElementById(
                "gzAdminSidebar"
            );


        const overlay =
            document.getElementById(
                "gzAdminNavOverlay"
            );


        const button =
            document.getElementById(
                "gzAdminMenuButton"
            );


        if (
            !sidebar ||
            !overlay ||
            !button
        ) {

            return;
        }


        const shouldOpen =
            !sidebar.classList.contains(
                "open"
            );


        sidebar.classList.toggle(
            "open",
            shouldOpen
        );


        overlay.classList.toggle(
            "open",
            shouldOpen
        );


        button.classList.toggle(
            "open",
            shouldOpen
        );


        button.setAttribute(
            "aria-expanded",
            String(
                shouldOpen
            )
        );


        overlay.setAttribute(
            "aria-hidden",
            String(
                !shouldOpen
            )
        );


        document.body.classList.toggle(
            "gz-admin-nav-open",
            shouldOpen
        );
    }


    function closeMenu() {

        const sidebar =
            document.getElementById(
                "gzAdminSidebar"
            );


        const overlay =
            document.getElementById(
                "gzAdminNavOverlay"
            );


        const button =
            document.getElementById(
                "gzAdminMenuButton"
            );


        if (
            !sidebar ||
            !overlay ||
            !button
        ) {

            return;
        }


        sidebar.classList.remove(
            "open"
        );


        overlay.classList.remove(
            "open"
        );


        button.classList.remove(
            "open"
        );


        button.setAttribute(
            "aria-expanded",
            "false"
        );


        overlay.setAttribute(
            "aria-hidden",
            "true"
        );


        document.body.classList.remove(
            "gz-admin-nav-open"
        );
    }


    /* =====================================================
       LOGOUT
       ===================================================== */

    async function logout() {

        closeMenu();


        try {

            await signOutSilently();

        } catch (error) {

            console.error(
                "[GEN-Z.AI] Logout error:",
                error
            );

        } finally {

            window.location.href =
                LOGIN_PATH;
        }
    }


    async function signOutSilently() {

        const supabase =
            getSupabaseClient();


        if (
            !supabase ||
            !supabase.auth ||
            typeof supabase.auth.signOut !==
                "function"
        ) {

            return;
        }


        try {

            await supabase.auth.signOut();

        } catch (error) {

            console.error(
                "[GEN-Z.AI] Supabase signOut error:",
                error
            );
        }
    }


    /* =====================================================
       EVENTS
       ===================================================== */

    function bindEvents() {

        const menuButton =
            document.getElementById(
                "gzAdminMenuButton"
            );


        const overlay =
            document.getElementById(
                "gzAdminNavOverlay"
            );


        const logoutButton =
            document.getElementById(
                "gzAdminLogoutButton"
            );


        if (menuButton) {

            menuButton.addEventListener(
                "click",
                toggleMenu
            );
        }


        if (overlay) {

            overlay.addEventListener(
                "click",
                closeMenu
            );
        }


        if (logoutButton) {

            logoutButton.addEventListener(
                "click",
                logout
            );
        }


        document
            .querySelectorAll(
                ".gz-admin-nav-link"
            )
            .forEach(
                link => {

                    link.addEventListener(
                        "click",
                        closeMenu
                    );
                }
            );
    }


    /* =====================================================
       LOADING
       ===================================================== */

    function showLoading() {

        if (
            document.getElementById(
                "gzNavigationLoading"
            )
        ) {

            return;
        }


        const loading =
            document.createElement(
                "div"
            );


        loading.id =
            "gzNavigationLoading";


        loading.className =
            "gz-navigation-loading";


        loading.textContent =
            "MEMERIKSA SESSION";


        document.body.appendChild(
            loading
        );
    }


    function hideLoading() {

        const loading =
            document.getElementById(
                "gzNavigationLoading"
            );


        if (loading) {

            loading.remove();
        }
    }


    /* =====================================================
       INITIALIZATION
       ===================================================== */

    async function init() {

        injectStyles();


        showLoading();


        const authenticated =
            await validateAuthentication();


        if (!authenticated) {

            hideLoading();

            return;
        }


        let container =
            document.getElementById(
                CONTAINER_ID
            );


        /*
         * Jika halaman belum memiliki container,
         * buat otomatis di awal body.
         */

        if (!container) {

            container =
                document.createElement(
                    "div"
                );


            container.id =
                CONTAINER_ID;


            document.body.prepend(
                container
            );
        }


        render(
            container
        );


        /*
         * Compatibility dengan halaman lama.
         */

        window.toggleMenu =
            toggleMenu;


        window.closeMenu =
            closeMenu;


        window.logout =
            logout;


        /*
         * Expose informasi role.
         * Bukan sumber otorisasi.
         * Sumber tetap Supabase.
         */

        window.GENZ_NAVIGATION_USER =
            currentUser;

        window.GENZ_NAVIGATION_PROFILE =
            currentProfile;

        window.GENZ_NAVIGATION_ROLE =
            currentRole;


        /*
         * Promise siap navigation.
         *
         * Dashboard dapat menunggu object ini jika
         * tersedia sehingga tidak perlu menebak apakah
         * navigation sudah selesai melakukan auth.
         */

        window.GENZNavigationReady =
            Promise.resolve({
                user: currentUser,
                profile: currentProfile,
                role: currentRole
            });


        hideLoading();
    }


    /* =====================================================
       ESCAPE KEY
       ===================================================== */

    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key ===
                "Escape"
            ) {

                closeMenu();
            }
        }
    );


    /* =====================================================
       SUPABASE AUTH STATE
       ===================================================== */

    function bindAuthState() {

        const supabase =
            getSupabaseClient();


        if (
            !supabase ||
            !supabase.auth ||
            typeof supabase.auth.onAuthStateChange !==
                "function"
        ) {

            return;
        }


        supabase.auth.onAuthStateChange(
            (
                event,
                session
            ) => {

                /*
                 * Hanya SIGNED_OUT yang benar-benar
                 * berarti session telah berakhir.
                 *
                 * Jangan menganggap event auth lain
                 * sebagai logout.
                 */

                if (
                    event ===
                    "SIGNED_OUT"
                ) {

                    if (
                        window.location.pathname !==
                        LOGIN_PATH
                    ) {

                        window.location.href =
                            LOGIN_PATH;
                    }

                    return;
                }


                /*
                 * Session masih ada.
                 *
                 * Event INITIAL_SESSION,
                 * SIGNED_IN, TOKEN_REFRESHED,
                 * USER_UPDATED, dll tidak boleh
                 * melempar user ke login.
                 */

                if (
                    session &&
                    session.user
                ) {

                    currentUser =
                        session.user;

                    window.GENZ_NAVIGATION_USER =
                        currentUser;
                }

            }
        );
    }


    /* =====================================================
       START
       ===================================================== */

    function start() {

        if (
            document.readyState ===
            "loading"
        ) {

            document.addEventListener(
                "DOMContentLoaded",
                async () => {

                    /*
                     * Pastikan config sudah tersedia
                     * sebelum navigation membuat client.
                     */

                    if (
                        !window.GENZ_CONFIG
                    ) {

                        console.warn(
                            "[GEN-Z.AI] GENZ_CONFIG belum tersedia saat navigation dimulai."
                        );
                    }


                    /*
                     * Buat/reuse client terlebih dahulu.
                     */

                    getSupabaseClient();


                    bindAuthState();


                    await init();

                },
                {
                    once: true
                }
            );

        } else {

            getSupabaseClient();

            bindAuthState();

            init();
        }
    }


    /* =====================================================
       PUBLIC API
       ===================================================== */

    window.GENZNavigation = {

        getSupabaseClient,

        getAuthenticatedUser,

        getUserProfile,

        validateAuthentication,

        getCurrentUser: () =>
            currentUser,

        getCurrentProfile: () =>
            currentProfile,

        getCurrentRole: () =>
            currentRole,

        getNavigationByRole: () =>
            NAVIGATION_BY_ROLE,

        render,

        toggleMenu,

        closeMenu,

        logout,

        init

    };


    /* =====================================================
       START
       ===================================================== */

    start();

})();
