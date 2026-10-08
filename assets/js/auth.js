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
       - detectSessionInUrl: false
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


    // =========================================================
    // SUPABASE CLIENT
    // ---------------------------------------------------------
    // FIX DEADLOCK:
    // - autoRefreshToken: false
    // - lock: no-op (langsung jalankan callback)
    // - detectSessionInUrl: false
    // =========================================================

    const supabaseClient =
        window.supabase.createClient(
            window.GENZ_CONFIG.SUPABASE_URL,
            window.GENZ_CONFIG.SUPABASE_KEY,
            {
                auth: {
                    persistSession: true,
                    autoRefreshToken: false,
                    detectSessionInUrl: false,
                    lock: async (_name, _acquireTimeout, fn) => {

                        return await fn();

                    }
                }
            }
        );


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


                const userId =
                    authData.user.id;


                // =================================================
                // GET SESSION
                // =================================================

                const {
                    data: sessionData,
                    error: sessionError
                } =
                    await supabaseClient.auth
                        .getSession();


                if (sessionError) {

                    throw new Error(
                        "Gagal membaca session: " +
                        sessionError.message
                    );
                }


                if (
                    !sessionData ||
                    !sessionData.session
                ) {

                    throw new Error(
                        "Session Supabase tidak ditemukan."
                    );
                }


                const sessionUser =
                    sessionData.session.user;


                if (
                    sessionUser.id !== userId
                ) {

                    await supabaseClient.auth
                        .signOut();


                    hideLoginStatusHologram();


                    throw new Error(
                        "User ID session tidak sesuai."
                    );
                }


                // =================================================
                // AMBIL PROFILE
                // =================================================

                const {
                    data: profiles,
                    error: profileError
                } =
                    await supabaseClient
                        .from("profiles")
                        .select(
                            "id,email,name,role,credits,status"
                        )
                        .eq(
                            "id",
                            userId
                        );


                if (profileError) {

                    throw new Error(
                        "Gagal mengambil profile: " +
                        profileError.message
                    );
                }


                if (
                    !Array.isArray(profiles) ||
                    profiles.length === 0
                ) {

                    await supabaseClient.auth
                        .signOut();


                    hideLoginStatusHologram();


                    throw new Error(
                        "Profile belum ditemukan untuk akun ini."
                    );
                }


                const profile =
                    profiles[0];


                if (
                    profile.id !== userId
                ) {

                    await supabaseClient.auth
                        .signOut();


                    hideLoginStatusHologram();


                    throw new Error(
                        "ID profile tidak sesuai dengan user."
                    );
                }


                // =================================================
                // NORMALISASI STATUS AKUN
                // =================================================

                const accountStatus =
                    String(
                        profile.status || ""
                    )
                        .trim()
                        .toLowerCase();


                // =================================================
                // SUSPENDED
                // =================================================

                if (
                    accountStatus ===
                    "suspended"
                ) {

                    await supabaseClient.auth
                        .signOut();


                    showLoginStatusHologram(
                        "suspended"
                    );


                    throw new Error(
                        "Akun Anda sedang ditangguhkan."
                    );
                }


                // =================================================
                // BANNED
                // =================================================

                if (
                    accountStatus ===
                    "banned"
                ) {

                    await supabaseClient.auth
                        .signOut();


                    showLoginStatusHologram(
                        "banned"
                    );


                    throw new Error(
                        "Akun Anda telah diblokir."
                    );
                }


                // =================================================
                // STATUS HARUS ACTIVE
                // =================================================

                if (
                    accountStatus !==
                    "active"
                ) {

                    await supabaseClient.auth
                        .signOut();


                    hideLoginStatusHologram();


                    throw new Error(
                        "Status akun tidak valid."
                    );
                }


                // =================================================
                // VALIDASI ROLE
                // =================================================

                const role =
                    String(
                        profile.role || ""
                    )
                        .trim()
                        .toUpperCase();


                if (
                    role === "USER"
                ) {

                    hideLoginStatusHologram();


                    showMessage(
                        "Login berhasil. Membuka dashboard..."
                    );


                    window.location.href =
                        "user/dashboard.html";


                    return;
                }


                if (
                    role === "ADMIN" ||
                    role === "OWNER"
                ) {

                    hideLoginStatusHologram();


                    showMessage(
                        "Login berhasil. Membuka dashboard admin..."
                    );


                    window.location.href =
                        "admin/dashboard/index.html";


                    return;
                }


                await supabaseClient.auth
                    .signOut();


                hideLoginStatusHologram();


                throw new Error(
                    "Role akun tidak valid."
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
                event === "SIGNED_OUT"
            ) {

                console.log(
                    "GEN-Z.AI: Session logout."
                );
            }

        }
    );


    // =========================================================
    // EXPOSE CLIENT
    // =========================================================

    window.GENZ_AUTH =
        Object.freeze({

            supabase:
                supabaseClient

        });


})();
