/* =========================================================
   GEN-Z.AI
   USER MANAGEMENT API
   ---------------------------------------------------------
   File:
   admin-control/users/assets/js/user-api.js

   Fungsi:
   - GET users
   - CREATE user
   - UPDATE user
   - RESEND confirmation
   - CONFIRM email
   - DELETE user
========================================================= */

const API_URL = "../../api/admin-users";


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


    if (
        !supabase
    ) {

        throw new Error(
            "Supabase client tidak tersedia."
        );

    }


    const {
        data,
        error
    } =
        await supabase.auth.getSession();


    if (
        error
    ) {

        throw new Error(
            error.message ||
            "Gagal mengambil session."
        );

    }


    const session =
        data?.session ||
        null;


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
            JSON.stringify(
                body
            );

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


    if (
        !response.ok
    ) {

        const message =

            result?.error ||

            result?.message ||

            `Request gagal (${response.status}).`;


        throw new Error(
            message
        );

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
            action:
                "create",

            ...userData
        }
    );

}


/* =========================================================
   RESEND CONFIRMATION
========================================================= */

export async function resendConfirmation(
    email
) {

    return await apiRequest(
        "POST",
        {
            action:
                "resend",

            email:
                String(
                    email || ""
                )
                    .trim()
                    .toLowerCase()
        }
    );

}


/* =========================================================
   CONFIRM EMAIL
========================================================= */

export async function confirmUserEmail(
    userId
) {

    return await apiRequest(
        "PATCH",
        {
            action:
                "confirm",

            userId
        }
    );

}


/* =========================================================
   UPDATE USER
========================================================= */

export async function updateUser(
    userData = {}
) {

    return await apiRequest(
        "PATCH",
        {
            action:
                "update",

            ...userData
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
   PUBLIC API OBJECT
========================================================= */

export const GENZUserAPI = {

    getUsers,

    createUser,

    resendConfirmation,

    confirmUserEmail,

    updateUser,

    deleteUser

};


/* =========================================================
   GLOBAL BRIDGE
========================================================= */

if (
    typeof window !==
    "undefined"
) {

    window.GENZUserAPI =
        GENZUserAPI;

}
