```javascript
// ========================================
// GEN-Z.AI - AUTHENTICATION
// ========================================

const supabaseClient = window.supabase.createClient(
    GENZ_CONFIG.SUPABASE_URL,
    GENZ_CONFIG.SUPABASE_KEY
);

// ========================================
// ELEMENTS
// ========================================

const loginForm = document.getElementById("loginForm");
const loginButton = document.getElementById("loginButton");
const loginMessage = document.getElementById("loginMessage");

// ========================================
// LOGIN
// ========================================

if (loginForm) {

    loginForm.addEventListener("submit", async function (event) {

        event.preventDefault();

        const emailInput = document.getElementById("email");
        const passwordInput = document.getElementById("password");

        const email = emailInput.value.trim();
        const password = passwordInput.value;

        // Reset message
        loginMessage.textContent = "";
        loginMessage.className = "login-message";

        // Loading
        loginButton.disabled = true;
        loginButton.textContent = "LOGIN...";

        try {

            // ----------------------------------------
            // 1. LOGIN SUPABASE
            // ----------------------------------------

            const { data, error } =
                await supabaseClient.auth.signInWithPassword({
                    email: email,
                    password: password
                });

            if (error) {
                throw error;
            }

            const user = data?.user;

            if (!user) {
                throw new Error(
                    "User tidak ditemukan."
                );
            }

            // ----------------------------------------
            // 2. AMBIL PROFILE USER
            // ----------------------------------------

            const {
                data: profile,
                error: profileError
            } = await supabaseClient
                .from("profiles")
                .select("role,status")
                .eq("id", user.id)
                .single();

            if (profileError) {

                await supabaseClient.auth.signOut();

                throw new Error(
                    "Profile user belum tersedia."
                );
            }

            // ----------------------------------------
            // 3. CEK STATUS AKUN
            // ----------------------------------------

            if (profile.status !== "active") {

                await supabaseClient.auth.signOut();

                throw new Error(
                    "Akun tidak aktif. Hubungi administrator."
                );
            }

            // ----------------------------------------
            // 4. CEK ROLE
            // ----------------------------------------

            if (profile.role === "USER") {

                window.location.href =
                    "user/dashboard.html";

                return;
            }

            if (
                profile.role === "ADMIN" ||
                profile.role === "OWNER"
            ) {

                window.location.href =
                    "admin/dashboard.html";

                return;
            }

            // ----------------------------------------
            // 5. ROLE TIDAK VALID
            // ----------------------------------------

            await supabaseClient.auth.signOut();

            throw new Error(
                "Role akun tidak valid."
            );

        } catch (error) {

            console.error(
                "GEN-Z.AI Login Error:",
                error
            );

            // ----------------------------------------
            // TAMPILKAN ERROR
            // ----------------------------------------

            let message =
                error?.message ||
                "Login gagal. Silakan coba lagi.";

            // Pesan yang lebih mudah dipahami
            if (
                message.includes("Invalid login credentials")
            ) {
                message =
                    "Email atau password salah.";
            }

            if (
                message.includes("Email not confirmed")
            ) {
                message =
                    "Email belum dikonfirmasi.";
            }

            loginMessage.textContent = message;

            // ----------------------------------------
            // RESET BUTTON
            // ----------------------------------------

            loginButton.disabled = false;
            loginButton.textContent = "LOGIN";
        }

    });

}
```
