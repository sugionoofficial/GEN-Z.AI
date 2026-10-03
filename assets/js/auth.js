//auth.js?v=2.7
// ========================================
// GEN-Z.AI - SUPABASE AUTHENTICATION
// ========================================

(function () {

    "use strict";


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
    // =========================================================

    const supabaseClient =
        window.supabase.createClient(
            window.GENZ_CONFIG.SUPABASE_URL,
            window.GENZ_CONFIG.SUPABASE_KEY,
            {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true,
                    detectSessionInUrl: true
                }
            }
        );


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
    // ---------------------------------------------------------
    // PENTING:
    // Jangan menggunakan:
    //
    // loginButton.textContent
    //
    // karena itu akan menghapus seluruh child element
    // tombol, termasuk hologram.
    // =========================================================

    function setLoading(loading) {

        if (!loginButton) {
            return;
        }


        loginButton.disabled =
            loading;


        // -----------------------------------------------------
        // BUTTON TEXT
        // -----------------------------------------------------

        if (loginButtonText) {

            loginButtonText.textContent =
                loading
                    ? "MEMPROSES..."
                    : "LOGIN";
        }


        // -----------------------------------------------------
        // SPINNER
        // -----------------------------------------------------

        if (loginSpinner) {

            loginSpinner.classList.toggle(
                "active",
                loading
            );
        }


        // -----------------------------------------------------
        // BUTTON STATE
        // -----------------------------------------------------

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


        // -----------------------------------------------------
        // INVALID LOGIN
        // -----------------------------------------------------

        if (
            message.includes(
                "invalid login credentials"
            )
        ) {

            return (
                "Email atau password salah."
            );
        }


        // -----------------------------------------------------
        // EMAIL NOT CONFIRMED
        // -----------------------------------------------------

        if (
            message.includes(
                "email not confirmed"
            )
        ) {

            return (
                "Email akun belum dikonfirmasi."
            );
        }


        // -----------------------------------------------------
        // TOO MANY REQUESTS
        // -----------------------------------------------------

        if (
            message.includes(
                "too many requests"
            )
        ) {

            return (
                "Terlalu banyak percobaan. Silakan tunggu beberapa saat."
            );
        }


        // -----------------------------------------------------
        // NETWORK ERROR
        // -----------------------------------------------------

        if (
            message.includes("network") ||
            message.includes("fetch")
        ) {

            return (
                "Koneksi bermasalah. Periksa internet lalu coba lagi."
            );
        }


        // -----------------------------------------------------
        // DEFAULT
        // -----------------------------------------------------

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


    // =========================================================
    // HIDE HOLOGRAM SAAT USER MENGETIK EMAIL
    // =========================================================

    if (emailInput) {

        emailInput.addEventListener(
            "input",
            function () {

                hideLoginStatusHologram();

            }
        );
    }


    // =========================================================
    // HIDE HOLOGRAM SAAT USER MENGETIK PASSWORD
    // =========================================================

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


            // =================================================
            // AMBIL ELEMENT
            // =================================================

            const emailElement =
                document.getElementById("email");

            const passwordElement =
                document.getElementById("password");


            // =================================================
            // CEK ELEMENT FORM
            // =================================================

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


            // =================================================
            // AMBIL INPUT
            // =================================================

            const email =
                emailElement.value
                    .trim()
                    .toLowerCase();

            const password =
                passwordElement.value;


            // =================================================
            // VALIDASI INPUT
            // =================================================

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


            // =================================================
            // LOGIN BARU
            // =================================================

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


                // =================================================
                // VALIDASI USER
                // =================================================

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


                // =================================================
                // VALIDASI SESSION USER
                // =================================================

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


                // =================================================
                // PROFILE TIDAK DITEMUKAN
                // =================================================

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


                // =================================================
                // VALIDASI PROFILE ID
                // =================================================

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

                    // -------------------------------------------------
                    // HENTIKAN SESSION
                    // -------------------------------------------------

                    await supabaseClient.auth
                        .signOut();


                    // -------------------------------------------------
                    // TAMPILKAN CAP HOLOGRAM
                    // -------------------------------------------------

                    showLoginStatusHologram(
                        "suspended"
                    );


                    // -------------------------------------------------
                    // PESAN
                    // -------------------------------------------------

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

                    // -------------------------------------------------
                    // HENTIKAN SESSION
                    // -------------------------------------------------

                    await supabaseClient.auth
                        .signOut();


                    // -------------------------------------------------
                    // TAMPILKAN CAP HOLOGRAM
                    // -------------------------------------------------

                    showLoginStatusHologram(
                        "banned"
                    );


                    // -------------------------------------------------
                    // PESAN
                    // -------------------------------------------------

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


                // =================================================
                // USER
                // =================================================

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


                // =================================================
                // ADMIN / OWNER
                // =================================================

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


                // =================================================
                // ROLE TIDAK VALID
                // =================================================

                await supabaseClient.auth
                    .signOut();


                hideLoginStatusHologram();


                throw new Error(
                    "Role akun tidak valid."
                );

            }


            // =====================================================
            // CATCH LOGIN ERROR
            // =====================================================

            catch (error) {

                console.error(
                    "GEN-Z.AI login error:",
                    error
                );


                // -------------------------------------------------
                // TAMPILKAN PESAN
                // -------------------------------------------------

                showMessage(
                    getFriendlyAuthError(error)
                );


                // -------------------------------------------------
                // RESET LOADING
                // -------------------------------------------------
                //
                // Penting:
                // setLoading(false) hanya mengubah span text,
                // spinner, dan class loading.
                //
                // Hologram TIDAK disentuh.
                //
                // Jadi untuk:
                //
                // SUSPENDED
                // BANNED
                //
                // cap tetap tampil di atas tombol.
                // -------------------------------------------------

                setLoading(false);

            }

        }
    );


    // =========================================================
    // SESSION CHANGE HANDLER
    // =========================================================

    supabaseClient.auth.onAuthStateChange(
        function (event, session) {

            /*
             * Jangan melakukan redirect otomatis
             * di sini.
             *
             * Redirect tetap dikontrol oleh proses login
             * agar role USER / ADMIN / OWNER tidak tertukar.
             */

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
