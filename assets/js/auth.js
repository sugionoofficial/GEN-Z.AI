// ========================================
// GEN-Z.AI - SUPABASE AUTHENTICATION
// ========================================

console.log("GEN-Z.AI AUTH START");

const supabaseClient = window.supabase.createClient(
    GENZ_CONFIG.SUPABASE_URL,
    GENZ_CONFIG.SUPABASE_KEY
);

const loginForm = document.getElementById("loginForm");
const loginButton = document.getElementById("loginButton");
const loginMessage = document.getElementById("loginMessage");

console.log("Supabase:", !!supabaseClient);
console.log("Login form:", !!loginForm);
console.log("Login button:", !!loginButton);

if (loginForm) {

    loginForm.addEventListener("submit", async function (event) {

        event.preventDefault();

        console.log("LOGIN BUTTON CLICKED");

        const email = document
            .getElementById("email")
            .value
            .trim();

        const password = document
            .getElementById("password")
            .value;

        loginMessage.textContent = "Memproses login...";

        loginButton.disabled = true;
        loginButton.textContent = "LOGIN...";

        try {

            console.log("Mencoba login:", email);

            const {
                data,
                error
            } = await supabaseClient.auth.signInWithPassword({
                email: email,
                password: password
            });

            console.log("Supabase login response:", data, error);

            if (error) {
                throw error;
            }

            if (!data || !data.user) {
                throw new Error(
                    "Login berhasil tetapi user tidak ditemukan."
                );
            }

            console.log(
                "User berhasil login:",
                data.user.id
            );

            const {
                data: profile,
                error: profileError
            } = await supabaseClient
                .from("profiles")
                .select("role,status")
                .eq("id", data.user.id)
                .single();

            console.log(
                "Profile response:",
                profile,
                profileError
            );

            if (profileError) {
                throw new Error(
                    "Gagal mengambil profile: " +
                    profileError.message
                );
            }

            if (!profile) {
                throw new Error(
                    "Profile user tidak ditemukan."
                );
            }

            if (profile.status !== "active") {

                await supabaseClient.auth.signOut();

                throw new Error(
                    "Akun tidak aktif."
                );
            }

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
                error?.message ||
                "Login gagal.";

            loginButton.disabled = false;
            loginButton.textContent = "LOGIN";
        }

    });

}
