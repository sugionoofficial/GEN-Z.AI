// ========================================
// GEN-Z.AI - SUPABASE AUTHENTICATION
// ========================================

console.log("========================================");
console.log("GEN-Z.AI AUTH START");
console.log("========================================");


// ========================================
// CEK KONFIGURASI
// ========================================

if (
    typeof GENZ_CONFIG === "undefined" ||
    !GENZ_CONFIG.SUPABASE_URL ||
    !GENZ_CONFIG.SUPABASE_KEY
) {
    console.error("GENZ_CONFIG tidak ditemukan.");

    const message = document.getElementById("loginMessage");

    if (message) {
        message.textContent =
            "Konfigurasi Supabase tidak ditemukan.";
    }

    throw new Error("GENZ_CONFIG tidak ditemukan.");
}


// ========================================
// CEK SUPABASE
// ========================================

if (
    typeof window.supabase === "undefined" ||
    typeof window.supabase.createClient !== "function"
) {
    console.error("Supabase JS belum dimuat.");

    const message = document.getElementById("loginMessage");

    if (message) {
        message.textContent =
            "Supabase belum berhasil dimuat.";
    }

    throw new Error("Supabase JS belum dimuat.");
}


// ========================================
// SUPABASE CLIENT
// ========================================

const supabaseClient = window.supabase.createClient(
    GENZ_CONFIG.SUPABASE_URL,
    GENZ_CONFIG.SUPABASE_KEY
);

console.log("Supabase client berhasil dibuat.");


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
// CEK FORM
// ========================================

if (!loginForm) {

    console.error(
        "Form login #loginForm tidak ditemukan."
    );

} else {

    console.log(
        "Form login berhasil ditemukan."
    );


    // ========================================
    // LOGIN
    // ========================================

    loginForm.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();

            console.log("----------------------------------------");
            console.log("LOGIN DIMULAI");
            console.log("----------------------------------------");


            // ====================================
            // INPUT
            // ====================================

            const emailElement =
                document.getElementById("email");

            const passwordElement =
                document.getElementById("password");


            if (!emailElement || !passwordElement) {

                console.error(
                    "Input email/password tidak ditemukan."
                );

                loginMessage.textContent =
                    "Form login tidak lengkap.";

                return;
            }


            const email =
                emailElement.value.trim();

            const password =
                passwordElement.value;


            if (!email || !password) {

                loginMessage.textContent =
                    "Email dan password wajib diisi.";

                return;
            }


            // ====================================
            // UI
            // ====================================

            loginButton.disabled = true;
            loginButton.textContent = "LOGIN...";

            loginMessage.textContent =
                "Memproses login...";


            try {


                // ==================================
                // 1. LOGIN SUPABASE
                // ==================================

                console.log(
                    "Mencoba login:",
                    email
                );


                const {
                    data: authData,
                    error: authError
                } =
                    await supabaseClient.auth
                        .signInWithPassword({
                            email: email,
                            password: password
                        });


                console.log(
                    "AUTH DATA:",
                    authData
                );

                console.log(
                    "AUTH ERROR:",
                    authError
                );


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


                console.log(
                    "LOGIN BERHASIL"
                );

                console.log(
                    "USER ID:",
                    userId
                );

                console.log(
                    "USER EMAIL:",
                    authData.user.email
                );


                // ==================================
                // 2. CEK SESSION
                // ==================================

                const {
                    data: sessionData,
                    error: sessionError
                } =
                    await supabaseClient.auth
                        .getSession();


                console.log(
                    "CURRENT SESSION:",
                    sessionData
                );

                console.log(
                    "SESSION ERROR:",
                    sessionError
                );


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


                console.log(
                    "SESSION USER ID:",
                    sessionUser.id
                );


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

                console.log(
                    "Mengambil profile:",
                    userId
                );


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


                console.log(
                    "PROFILE DATA:",
                    profiles
                );

                console.log(
                    "PROFILE ERROR:",
                    profileError
                );


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

                    console.error(
                        "PROFILE TIDAK DITEMUKAN."
                    );

                    console.error(
                        "USER ID:",
                        userId
                    );

                    console.error(
                        "EMAIL:",
                        authData.user.email
                    );


                    throw new Error(
                        "Profile belum ditemukan untuk akun ini. " +
                        "User ID: " +
                        userId
                    );
                }


                // ==================================
                // 6. PROFILE
                // ==================================

                const profile =
                    profiles[0];


                console.log(
                    "PROFILE BERHASIL:",
                    profile
                );


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
                    profile.status !== "active"
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
                        .toUpperCase();


                console.log(
                    "USER ROLE:",
                    role
                );


                // ==================================
                // 10. USER
                // ==================================

                if (role === "USER") {

                    loginMessage.textContent =
                        "Login berhasil. Membuka dashboard...";


                    console.log(
                        "REDIRECT → USER DASHBOARD"
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

                    loginMessage.textContent =
                        "Login berhasil. Membuka dashboard admin...";


                    console.log(
                        "REDIRECT → ADMIN DASHBOARD"
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
                    "Role akun tidak valid: " +
                    profile.role
                );


            } catch (error) {


                // ==================================
                // ERROR
                // ==================================

                console.error(
                    "========================================"
                );

                console.error(
                    "GEN-Z.AI LOGIN ERROR"
                );

                console.error(
                    error
                );

                console.error(
                    "========================================"
                );


                loginMessage.textContent =
                    error?.message ||
                    "Login gagal.";


                loginButton.disabled = false;
                loginButton.textContent = "LOGIN";
            }

        }
    );
}
