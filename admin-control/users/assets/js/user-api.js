/* =========================================================
   GEN-Z.AI
   USER MANAGEMENT - API
   ---------------------------------------------------------
   File:
   admin-control/users/assets/js/user-api.js

   Fungsi:
   - Mengambil access token Supabase
   - Request ke /api/admin-users
   - LIST users
   - CREATE user
   - RESEND confirmation
   - CONFIRM email
   - DELETE user

   CATATAN:
   - Tidak mengubah API server.
   - Tidak mengandung logic permission.
   - Permission tetap divalidasi oleh API server.
========================================================= */


/* =========================================================
   API ENDPOINT
   ---------------------------------------------------------
   Document:
   admin-control/users/user.html

   ../../api/admin-users
   -> /api/admin-users
========================================================= */

const API_URL =
    "../../api/admin-users";


/* =========================================================
   SUPABASE CLIENT
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

    const supabase =
        getSupabaseClient();


    if (!supabase) {

        throw new Error(
            "Supabase client tidak tersedia."
        );

    }


    const {
        data,
        error
    } =
        await supabase.auth.getSession();


    if (error) {

        throw new Error(
            error.message ||
            "Gagal mengambil session."
        );

    }


    const session =
        data?.session || null;


    if (
        !session?.access_token
    ) {

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


    /* -----------------------------------------------------
       RESPONSE PARSE
    ----------------------------------------------------- */

    let result = null;


    try {

        result =
            await response.json();

    } catch {

        result = null;

    }


    /* -----------------------------------------------------
       HTTP ERROR
    ----------------------------------------------------- */

    if (!response.ok) {

        const message =
            result?.error ||
            result?.message ||
            `Request gagal (${response.status}).`;


        throw new Error(
            message
        );

    }


    /* -----------------------------------------------------
       APPLICATION ERROR
    ----------------------------------------------------- */

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
   ---------------------------------------------------------
   GET /api/admin-users
========================================================= */

export async function getUsers() {

    return await apiRequest(
        "GET"
    );

}


/* =========================================================
   CREATE USER
   ---------------------------------------------------------
   POST /api/admin-users

   Server contract:

   {
       action: "create",
       email,
       password,
       name,
       role,
       credits,
       status
   }
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
   RESEND CONFIRMATION
   ---------------------------------------------------------
   POST /api/admin-users

   {
       action: "resend",
       email
   }
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
   ---------------------------------------------------------
   PATCH /api/admin-users

   {
       action: "confirm",
       userId
   }
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
   ---------------------------------------------------------
   DELETE /api/admin-users

   {
       userId
   }
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
   PUBLIC API
========================================================= */

export const GENZUserAPI = {

    getUsers,

    createUser,

    resendConfirmation,

    confirmUserEmail,

    deleteUser

};


/* =========================================================
   OPTIONAL GLOBAL
   ---------------------------------------------------------
   Dipertahankan untuk kompatibilitas/debugging.
========================================================= */

if (
    typeof window !== "undefined"
) {

    window.GENZUserAPI =
        GENZUserAPI;

}
