// ========================================
// GEN-Z.AI - AUTHENTICATION
// ========================================

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

        loginMessage.textContent = "";
        loginButton.disabled = true;
        loginButton.textContent = "LOGIN...";

        try {

            const { data, error } =
                await supabaseClient.auth.signInWithPassword({
                    email: email,
                    password: password
                });

            if (error) {
                throw error;
            }

            if (!data || !data.user) {
                throw new Error("User tidak ditemukan.");
            }

            const { data: profile, error: profileError } =
                await supabaseClient
                    .from("profiles")
                    .select("role,status")
                    .eq("id", data.user.id)
                    .single();

            if (profileError || !profile) {
                throw new Error(
                    "Profile user belum tersedia di tabel profiles."
                );
            }

            if (profile.status !== "active") {
                await supabaseClient.auth.signOut();

                throw new Error(
                    "Akun tidak aktif."
                );
            }

            if (profile.role === "USER") {
                window.location.href = "user/dashboard.html";
                return;
            }

            if (
                profile.role === "ADMIN" ||
                profile.role === "OWNER"
            ) {
                window.location.href = "admin/dashboard.html";
                return;
            }

            await supabaseClient.auth.signOut();

            throw new Error(
                "Role akun tidak valid."
            );

        } catch (error) {

            console.error("GEN-Z.AI Login Error:", error);

            let message = error.message ||
                "Login gagal.";

            if (
                message.includes("Invalid login credentials")
            ) {
                message = "Email atau password salah.";
            }

            if (
                message.includes("Email not confirmed")
            ) {
                message = "Email belum dikonfirmasi.";
            }

            loginMessage.textContent = message;

            loginButton.disabled = false;
            loginButton.textContent = "LOGIN";
        }

    });

}
