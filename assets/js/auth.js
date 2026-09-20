// ========================================
// GEN-Z.AI - SUPABASE AUTHENTICATION
// ========================================

(function () {

    "use strict";


    // ========================================
    // CEK KONFIGURASI
    // ========================================

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


    // ========================================
    // CEK SUPABASE
    // ========================================

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


    // ========================================
    // SUPABASE CLIENT
    // ========================================

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


    // ========================================
    // ELEMENT
    // ========================================

    const loginForm =
        document.getElementById("loginForm");

    const loginButton =
        document.getElementById("loginButton");

    const loginMessage =
        document.getElementById("loginMessage");


    // ========================================
    // HELPER
    // ========================================

    function showMessage(message) {

        if (loginMessage) {
            loginMessage.textContent = message;
        }
    }


    function setLoading(loading) {

        if (!loginButton) {
            return;
        }

        loginButton.disabled = loading;

        loginButton.textContent =
            loading
                ? "LOGIN..."
                : "LOGIN";
    }


    function getFriendlyAuthError(error) {

        if (!error) {
            return "Login gagal.";
        }

        const message =
            String(error.message || "").toLowerCase();


        if (
            message.includes("invalid login credentials")
        ) {
            return "Email atau password salah.";
        }


        if (
            message.includes("email not confirmed")
        ) {
            return "Email akun belum dikonfirmasi.";
        }


        if (
            message.includes("too many requests")
        ) {
            return "Terlalu banyak percobaan. Silakan tunggu beberapa saat.";
        }


        if (
            message.includes("network") ||
            message.includes("fetch")
        ) {
            return "Koneksi bermasalah. Periksa internet lalu coba lagi.";
        }


        return (
            error.message ||
            "Login gagal."
        );
    }


    // ========================================
    // CEK FORM
    // ========================================

    if (!loginForm) {

        console.error(
            "GEN-Z.AI: Form login #loginForm tidak ditemukan."
        );

        return;
    }


    // ========================================
    // LOGIN
    // ========================================

    loginForm.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();


            // ====================================
            // INPUT
            // ====================================

            const emailElement =
                document.getElementById("email");

            const passwordElement =
                document.getElementById("password");


            if (
                !emailElement ||
                !passwordElement
            ) {

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


            if (!email || !password) {

                showMessage(
                    "Email dan password wajib diisi."
                );

                return;
            }


            // ====================================
            // UI LOADING
            // ====================================

            setLoading(true);

            showMessage(
                "Memproses login..."
            );


            try {

                // ==================================
                // 1. LOGIN SUPABASE
                // ==================================

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


                // ==================================
                // 2. CEK SESSION
                // ==================================

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


                // ==================================
                // 3. VALIDASI USER ID
                // ==================================

                if (
                    sessionUser.id !== userId
                ) {

                    await supabaseClient.auth
                        .signOut();

                    throw new Error(
                        "User ID session tidak sesuai."
                    );
                }


                // ==================================
                // 4. AMBIL PROFILE
                // ==================================

                const {
                    data: profiles,
                    error: profileError
                } =
                    await supabaseClient
                        .from("profiles")
                        .select(
                            "id,email,name,role,credits,status"
                        )
                        .eq("id", userId);


                if (profileError) {

                    throw new Error(
                        "Gagal mengambil profile: " +
                        profileError.message
                    );
                }


                // ==================================
                // 5. PROFILE TIDAK DITEMUKAN
                // ==================================

                if (
                    !Array.isArray(profiles) ||
                    profiles.length === 0
                ) {

                    await supabaseClient.auth
                        .signOut();

                    throw new Error(
                        "Profile belum ditemukan untuk akun ini."
                    );
                }


                // ==================================
                // 6. PROFILE
                // ==================================

                const profile =
                    profiles[0];


                // ==================================
                // 7. VALIDASI PROFILE ID
                // ==================================

                if (
                    profile.id !== userId
                ) {

                    await supabaseClient.auth
                        .signOut();

                    throw new Error(
                        "ID profile tidak sesuai dengan user."
                    );
                }


                // ==================================
                // 8. VALIDASI STATUS
                // ==================================

                if (
                    String(profile.status || "")
                        .toLowerCase() !== "active"
                ) {

                    await supabaseClient.auth
                        .signOut();

                    throw new Error(
                        "Akun tidak aktif."
                    );
                }


                // ==================================
                // 9. VALIDASI ROLE
                // ==================================

                const role =
                    String(profile.role || "")
                        .trim()
                        .toUpperCase();


                // ==================================
                // 10. USER
                // ==================================

                if (role === "USER") {

                    showMessage(
                        "Login berhasil. Membuka dashboard..."
                    );

                    window.location.href =
                        "user/dashboard.html";

                    return;
                }


                // ==================================
                // 11. ADMIN / OWNER
                // ==================================

                if (
                    role === "ADMIN" ||
                    role === "OWNER"
                ) {

                    showMessage(
                        "Login berhasil. Membuka dashboard admin..."
                    );

                    window.location.href =
                        "admin/dashboard.html";

                    return;
                }


                // ==================================
                // 12. ROLE TIDAK VALID
                // ==================================

                await supabaseClient.auth
                    .signOut();

                throw new Error(
                    "Role akun tidak valid."
                );


            } catch (error) {

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


    // ========================================
    // SESSION CHANGE HANDLER
    // ========================================

    supabaseClient.auth.onAuthStateChange(
        function (event, session) {

            /*
             * Jangan melakukan redirect otomatis
             * di sini. Redirect tetap dikontrol oleh
             * proses login agar role USER / ADMIN /
             * OWNER tidak tertukar.
             */

            if (event === "SIGNED_OUT") {

                console.log(
                    "GEN-Z.AI: Session logout."
                );
            }

        }
    );


    // ========================================
    // EXPOSE CLIENT
    // ========================================

    /*
     * Hanya untuk kebutuhan halaman yang memang
     * membutuhkan auth client yang sama.
     *
     * Tidak menaruh credential baru.
     */

    window.GENZ_AUTH =
        Object.freeze({
            supabase: supabaseClient
        });


})();
