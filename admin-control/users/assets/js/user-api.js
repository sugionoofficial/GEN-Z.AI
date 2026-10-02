/* =========================================================
   GEN-Z.AI
   USER MANAGEMENT - API
   ---------------------------------------------------------
   File:
   admin-control/users/assets/js/user-api.js

   Fungsi:
   - Mendapatkan session access token
   - Request ke /api/admin-users
   - GET    users
   - POST   create / resend
   - PATCH  confirm
   - DELETE user

   Catatan:
   - Tidak menyimpan state user
   - Tidak melakukan render
   - Tidak menangani modal
   - Tidak melakukan authentication page
   - Tidak mengubah api/admin-users.js
========================================================= */


/* =========================================================
   API URL
========================================================= */

const API_URL =
    "../api/admin-users";


/* =========================================================
   GET SUPABASE CLIENT
========================================================= */

function getSupabaseClient() {

    return window.GENZ_SUPABASE || null;

}


/* =========================================================
   GET ACCESS TOKEN
========================================================= */

async function getAccessToken() {

    const supabaseClient =
        getSupabaseClient();


    if (!supabaseClient) {

        throw new Error(
            "Supabase client tidak tersedia."
        );

    }


    const {
        data,
        error
    } =
        await supabaseClient.auth.getSession();


    if (error) {

        throw new Error(
            error.message ||
            "Gagal mengambil session."
        );

    }


    const session =
        data?.session;


    if (!session) {

        throw new Error(
            "Session tidak tersedia. Silakan login kembali."
        );

    }


    const accessToken =
        session.access_token;


    if (!accessToken) {

        throw new Error(
            "Access token tidak tersedia."
        );

    }


    return accessToken;

}


/* =========================================================
   API REQUEST
========================================================= */

export async function apiRequest(
    method,
    body = null
) {

    const accessToken =
        await getAccessToken();


    const options = {

        method,

        headers: {

            "Authorization":
                `Bearer ${accessToken}`,

            "Content-Type":
                "application/json"

        }

    };


    /* -----------------------------------------------------
       REQUEST BODY
    ----------------------------------------------------- */

    if (body !== null) {

        options.body =
            JSON.stringify(body);

    }


    /* -----------------------------------------------------
       FETCH API
    ----------------------------------------------------- */

    let response;

    try {

        response =
            await fetch(
                API_URL,
                options
            );

    } catch (error) {

        console.error(
            "[GEN-Z.AI] API network error:",
            error
        );

        throw new Error(
            "Tidak dapat terhubung ke server."
        );

    }


    /* -----------------------------------------------------
       PARSE RESPONSE
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

        const errorMessage =
            result?.message ||
            result?.error ||
            `Request gagal (${response.status}).`;

        throw new Error(
            errorMessage
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
            result.message ||
            result.error ||
            "Request gagal."
        );

    }


    /* -----------------------------------------------------
       RETURN RESULT
    ----------------------------------------------------- */

    return result;

}


/* =========================================================
   GET USERS
========================================================= */

export async function getUsers() {

    return apiRequest(
        "GET"
    );

}


/* =========================================================
   CREATE USER
========================================================= */

export async function createUser(
    userData
) {

    return apiRequest(
        "POST",
        {

            action:
                "create",

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

    return apiRequest(
        "POST",
        {

            action:
                "resend",

            email

        }
    );

}


/* =========================================================
   CONFIRM EMAIL
========================================================= */

export async function confirmUserEmail(
    userId
) {

    return apiRequest(
        "PATCH",
        {

            action:
                "confirm",

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

    return apiRequest(
        "DELETE",
        {

            userId

        }
    );

}
