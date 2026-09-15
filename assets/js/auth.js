// ========================================
// GEN-Z.AI - SUPABASE AUTH
// ========================================

console.log("GEN-Z.AI AUTH START");

const supabaseClient = window.supabase.createClient(
    GENZ_CONFIG.SUPABASE_URL,
    GENZ_CONFIG.SUPABASE_KEY
);

const loginForm = document.getElementById("loginForm");
const loginButton = document.getElementById("loginButton");
const loginMessage = document.getElementById("loginMessage");

if (loginForm) {

    loginForm.addEventListener("submit", async function (event) {

        event.preventDefault();

        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;

        loginButton.disabled = true;
        loginButton.textContent = "LOGIN...";
        loginMessage.textContent = "Memproses login...";

        try {

            // ==============================
            // LOGIN SUPABASE
            // ==============================

            const {
                data: authData,
                error: authError
            } = await supabaseClient.auth.signInWithPassword({
                email: email,
                password: password
            });

            console.log("AUTH:", authData, authError);

            if (authError) {
                throw authError;
            }

            if (!authData || !authData.user) {
                throw new Error("User tidak ditemukan setelah login.");
            }

            const userId = authData.user.id;

            console.log("USER ID:", userId);

            // ==============================
            // AMBIL PROFILE
            // ==============================

            const {
                data: profiles,
                error: profileError
            } = await supabaseClient
                .from("profiles")
                .select("id,email,name,role,credits,status")
                .eq("id", userId);

            console.log("PROFILES:", profiles);
            console.log("PROFILE ERROR:", profileError);

            if (profileError) {
                throw new Error(
                    "Gagal mengambil profile: " +
                    profileError.message
                );
            }

            // ==============================
            // PROFILE TIDAK ADA
            // ==============================

            if (!profiles || profiles.length === 0) {

                await supabaseClient.auth.signOut();

                throw new Error(
                    "Profile belum ditemukan untuk akun ini."
                );
            }

            // ==============================
            // AMBIL PROFILE PERTAMA
            // ==============================

            const profile = profiles[0];

            console.log("PROFILE:", profile);

            // ==============================
            // STATUS AKUN
            // ==============================

            if (profile.status !== "active") {

                await supabaseClient.auth.signOut();

                throw new Error(
                    "Akun tidak aktif."
                );
            }

            // ==============================
            // USER
            // ==============================

            if (profile.role === "USER") {

                loginMessage.textContent =
                    "Login berhasil. Membuka dashboard...";

                window.location.href =
                    "user/dashboard.html";

                return;
            }

            // ==============================
            // ADMIN / OWNER
            // ==============================

            if (
                profile.role === "ADMIN" ||
                profile.role === "OWNER"
            ) {

                loginMessage.textContent =
                    "Login berhasil. Membuka dashboard admin...";

                window.location.href =
                    "admin/dashboard.html";

                return;
            }

            // ==============================
            // ROLE INVALID
            // ==============================

            await supabaseClient.auth.signOut();

            throw new Error(
                "Role akun tidak valid: " +
                profile.role
            );

        } catch (error) {

            console.error(
                "GEN-Z.AI LOGIN ERROR:",
                error
            );

            loginMessage.textContent =
                error.message ||
                "Login gagal.";

            loginButton.disabled = false;
            loginButton.textContent = "LOGIN";
        }

    });
}
