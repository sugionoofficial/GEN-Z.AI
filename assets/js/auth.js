//auth.js?v=2.6
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

    const loginButtonText =
        document.getElementById("loginButtonText");

    const loginSpinner =
        document.getElementById("loginSpinner");

    const emailElement =
        document.getElementById("email");

    const passwordElement =
        document.getElementById("password");


    // ========================================
// LOGIN STATUS HOLOGRAM
// ========================================

const loginStatusHologram =
    document.getElementById(
        "loginStatusHologram"
    );


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
}


function showLoginStatusHologram(status) {

    const normalizedStatus =
        String(status || "")
            .trim()
            .toLowerCase();


    if (
        normalizedStatus !== "suspended" &&
        normalizedStatus !== "banned"
    ) {

        hideLoginStatusHologram();

        return;
    }


    if (!loginStatusHologram) {

        console.warn(
            "GEN-Z.AI: #loginStatusHologram tidak ditemukan."
        );

        return;
    }


    const text =
        document.getElementById(
            "loginStatusHologramText"
        );


    loginStatusHologram.classList.remove(
        "is-suspended",
        "is-banned"
    );


    if (normalizedStatus === "suspended") {

        loginStatusHologram.classList.add(
            "is-suspended"
        );

        if (text) {
            text.textContent =
                "SUSPENDED";
        }

    } else {

        loginStatusHologram.classList.add(
            "is-banned"
        );

        if (text) {
            text.textContent =
                "BANNED";
        }
    }


    loginStatusHologram.setAttribute(
        "aria-hidden",
        "false"
    );


    requestAnimationFrame(function () {

        loginStatusHologram.classList.add(
            "is-visible"
        );

    });
}


// ========================================
// EXPOSE HOLOGRAM
// ========================================

window.GENZLoginStatusHologram =
    Object.freeze({

        show: showLoginStatusHologram,

        hide: hideLoginStatusHologram,

        setStatus:
            showLoginStatusHologram

    });

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


        loginButton.disabled =
            loading;


        /*
         * Jangan menggunakan
         *
         * loginButton.textContent
         *
         * karena hologram dan spinner
         * merupakan child element tombol.
         */

        if (loginButtonText) {

            loginButtonText.textContent =
                loading
                    ? "LOGIN..."
                    : "LOGIN";
        }


        if (loginSpinner) {

            loginSpinner.classList.toggle(
                "active",
                loading
            );
        }
    }


    function getFriendlyAuthError(error) {

        if (!error) {
            return "Login gagal.";
        }


        if (
            error.code === "ACCOUNT_SUSPENDED"
        ) {

            return "Akun Anda sedang ditangguhkan.";
        }


        if (
            error.code === "ACCOUNT_BANNED"
        ) {

            return "Akun Anda telah dibanned.";
        }


        const message =
            String(error.message || "")
                .toLowerCase();


        if (
            message.includes(
                "invalid login credentials"
            )
        ) {

            return "Email atau password salah.";
        }


        if (
            message.includes(
                "email not confirmed"
            )
        ) {

            return "Email akun belum dikonfirmasi.";
        }


        if (
            message.includes(
                "too many requests"
            )
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
    // CLEAR HOLOGRAM SAAT INPUT BERUBAH
    // ========================================

    function clearLoginStatusVisual() {

        hideLoginStatusHologram();

    }


    if (emailElement) {

        emailElement.addEventListener(
            "input",
            clearLoginStatusVisual
        );

    }


    if (passwordElement) {

        passwordElement.addEventListener(
            "input",
            clearLoginStatusVisual
        );

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

            const emailField =
                document.getElementById("email");

            const passwordField =
                document.getElementById("password");


            if (
                !emailField ||
                !passwordField
            ) {

                showMessage(
                    "Form login tidak lengkap."
                );

                return;
            }


            const email =
                emailField.value
                    .trim()
                    .toLowerCase();

            const password =
                passwordField.value;


            /*
             * Setiap percobaan login baru
             * menghapus cap sebelumnya.
             */

            hideLoginStatusHologram();


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

                const accountStatus =
                    String(
                        profile.status || ""
                    )
                        .trim()
                        .toLowerCase();


                /*
                 * ACTIVE
                 * --------------------------------
                 * Login berjalan normal.
                 */

                if (
                    accountStatus === "active"
                ) {

                    // Tidak ada hologram.

                }


                /*
                 * SUSPENDED
                 * --------------------------------
                 * Session langsung dihentikan,
                 * lalu tampilkan cap hologram.
                 */

                else if (
                    accountStatus === "suspended"
                ) {

                    await supabaseClient.auth
                        .signOut();


                    const statusError =
                        new Error(
                            "Akun sedang ditangguhkan."
                        );


                    statusError.code =
                        "ACCOUNT_SUSPENDED";


                    showLoginStatusHologram(
                        "suspended"
                    );


                    throw statusError;
                }


                /*
                 * BANNED
                 * --------------------------------
                 * Session langsung dihentikan,
                 * lalu tampilkan cap hologram.
                 */

                else if (
                    accountStatus === "banned"
                ) {

                    await supabaseClient.auth
                        .signOut();


                    const statusError =
                        new Error(
                            "Akun telah dibanned."
                        );


                    statusError.code =
                        "ACCOUNT_BANNED";


                    showLoginStatusHologram(
                        "banned"
                    );


                    throw statusError;
                }


                /*
                 * STATUS LAIN
                 * --------------------------------
                 * Jangan memberikan akses.
                 */

                else {

                    await supabaseClient.auth
                        .signOut();


                    throw new Error(
                        "Status akun tidak valid."
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
                        "admin/dashboard/index.html";

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


                /*
                 * Untuk suspended / banned,
                 * hologram sudah ditampilkan
                 * sebelum error dilempar.
                 *
                 * Untuk error lain, hologram tetap
                 * tidak ditampilkan.
                 */

                if (
                    error?.code !==
                        "ACCOUNT_SUSPENDED" &&
                    error?.code !==
                        "ACCOUNT_BANNED"
                ) {

                    hideLoginStatusHologram();
                }


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
