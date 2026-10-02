/* =========================================================
   GEN-Z.AI
   USER MANAGEMENT - API
   ---------------------------------------------------------
   File:
   admin-control/users/assets/js/user-api.js

   Fungsi:
   - Komunikasi dengan /api/admin-users
   - GET users
   - CREATE user
   - RESEND confirmation
   - CONFIRM email
   - DELETE user

   Catatan:
   - Tidak mengubah API server
   - Mengikuti posisi:
       admin-control/
       └── users/
           └── assets/
               └── js/
                   └── user-api.js

   - API berada di:
       /api/admin-users
========================================================= */


/* =========================================================
   API CONFIG
========================================================= */

const API_URL = "../../api/admin-users";


/* =========================================================
   SUPABASE
========================================================= */

function getSupabaseClient() {

    return (
        window.GENZ_SUPABASE ||
        window.supabaseClient ||
        null
    );

}


/* =========================================================
   ACCESS TOKEN
========================================================= */

async function getAccessToken() {

    const supabase = getSupabaseClient();

    if (!supabase) {

        throw new Error(
            "Supabase client tidak tersedia."
        );

    }


    const {
        data,
        error
    } = await supabase.auth.getSession();


    if (error) {

        throw new Error(
            error.message ||
            "Gagal mengambil session."
        );

    }


    const session =
        data?.session || null;


    if (!session?.access_token) {

        throw new Error(
            "Session login tidak ditemukan."
        );

    }


    return session.access_token;

}


/* =========================================================
   API REQUEST
========================================================= */

async function apiRequest(
    method = "GET",
    body = null
) {

    const token =
        await getAccessToken();


    const options = {

        method,

        headers: {

            "Authorization":
                `Bearer ${token}`,

            "Content-Type":
                "application/json"

        }

    };


    if (
        body !== null &&
        body !== undefined
    ) {

        options.body =
            JSON.stringify(body);

    }


    const response =
        await fetch(
            API_URL,
            options
        );


    let result = null;


    try {

        result =
            await response.json();

    } catch {

        result = null;

    }


    if (!response.ok) {

        const message =
            result?.error ||
            result?.message ||
            `Request gagal (${response.status}).`;


        throw new Error(message);

    }


    if (
        result &&
        result.success === false
    ) {

        throw new Error(
            result.error ||
            result.message ||
            "Request gagal."
        );

    }


    return result;

}


/* =========================================================
   GET USERS
========================================================= */

export async function getUsers() {

    return await apiRequest(
        "GET"
    );

}


/* =========================================================
   CREATE USER
========================================================= */

export async function createUser(
    userData = {}
) {

    return await apiRequest(
        "POST",
        {
            action: "create",
            ...userData
        }
    );

}


/* =========================================================
   RESEND CONFIRMATION EMAIL
========================================================= */

export async function resendConfirmation(
    email
) {

    return await apiRequest(
        "POST",
        {
            action: "resend",
            email
        }
    );

}


/* =========================================================
   CONFIRM USER EMAIL
========================================================= */

export async function confirmUserEmail(
    userId
) {

    return await apiRequest(
        "PATCH",
        {
            action: "confirm",
            userId
        }
    );

}


/* =========================================================
   DELETE USER
========================================================= */

export async function deleteUser(
    userId
) {

    return await apiRequest(
        "DELETE",
        {
            userId
        }
    );

}


/* =========================================================
   EXPORT OPTIONAL API OBJECT
   ---------------------------------------------------------
   Tidak wajib digunakan oleh module lain.
   Disediakan supaya debugging lebih mudah.
========================================================= */

export const GENZUserAPI = {

    getUsers,

    createUser,

    resendConfirmation,

    confirmUserEmail,

    deleteUser

};


/* =========================================================
   DEBUG
========================================================= */

if (
    typeof window !== "undefined"
) {

    window.GENZUserAPI =
        GENZUserAPI;

}
