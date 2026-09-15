const SUPABASE_URL = "MASUKKAN_PROJECT_URL";
const SUPABASE_KEY = "MASUKKAN_PUBLISHABLE_KEY";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

const loginForm = document.getElementById("loginForm");
const loginButton = document.getElementById("loginButton");
const loginMessage = document.getElementById("loginMessage");

loginForm.addEventListener("submit", async function (event) {

    event.preventDefault();

    const email = document
        .getElementById("email")
        .value
        .trim();

    const password = document
        .getElementById("password")
        .value;

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

        const user = data.user;

        if (!user) {
            throw new Error("User tidak ditemukan.");
        }

        const { data: profile, error: profileError } =
            await supabaseClient
                .from("profiles")
                .select("role,status")
                .eq("id", user.id)
                .single();

        if (profileError) {
            throw new Error(
                "Profile user belum tersedia."
            );
        }

        if (profile.status !== "active") {

            await supabaseClient.auth.signOut();

            throw new Error(
                "Akun tidak aktif. Hubungi administrator."
            );
        }

        if (profile.role === "USER") {

            window.location.href =
                "user/dashboard.html";

        } else if (
            profile.role === "ADMIN" ||
            profile.role === "OWNER"
        ) {

            window.location.href =
                "admin/dashboard.html";

        } else {

            await supabaseClient.auth.signOut();

            throw new Error(
                "Role akun tidak valid."
            );
        }

    } catch (error) {

        console.error("Login error:", error);

        loginMessage.textContent =
            error.message || "Login gagal.";

        loginButton.disabled = false;
        loginButton.textContent = "LOGIN";
    }
});
