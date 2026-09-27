"use strict";

/*
 * ============================================================
 * GEN-Z.AI
 * MODEL EDIT API
 *
 * Tanggung jawab:
 * - Mendapatkan access token
 * - Komunikasi dengan /api/admin-models
 * - Parsing response API
 * - Mencari satu model Admin
 *
 * Tidak melakukan:
 * - Render UI
 * - Save logic
 * - Registry enrichment
 * - Event binding
 * ============================================================
 */


/* ============================================================
   ACCESS TOKEN
============================================================ */

async function getAccessToken() {

    const supabase =
        window.GENZ_SUPABASE ||
        window.supabaseClient ||
        null;


    if (!supabase) {

        throw new Error(
            "Supabase belum terhubung."
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


    const accessToken =
        data?.session?.access_token ||
        "";


    if (!accessToken) {

        throw new Error(
            "Sesi login tidak ditemukan. Silakan login kembali."
        );

    }


    return accessToken;

}


/* ============================================================
   ADMIN MODELS REQUEST
============================================================ */

async function requestAdminModels(
    method = "GET",
    body = null,
    query = null
) {

    const accessToken =
        await getAccessToken();


    const params =
        new URLSearchParams();


    if (
        query &&
        typeof query === "object"
    ) {

        Object.entries(
            query
        ).forEach(
            ([key, value]) => {

                if (
                    value !== undefined &&
                    value !== null &&
                    String(
                        value
                    ).trim() !== ""
                ) {

                    params.set(
                        key,
                        String(
                            value
                        ).trim()
                    );

                }

            }
        );

    }


    const queryString =
        params.toString();


    const url =
        queryString
            ? `../api/admin-models?${queryString}`
            : "../api/admin-models";


    const options = {

        method,

        headers: {

            Accept:
                "application/json",

            Authorization:
                `Bearer ${accessToken}`

        },

        credentials:
            "same-origin"

    };


    if (
        body !== null &&
        body !== undefined &&
        method !== "GET"
    ) {

        options.headers[
            "Content-Type"
        ] =
            "application/json";


        options.body =
            JSON.stringify(
                body
            );

    }


    /*
 * Fail-safe agar halaman Edit Model tidak
 * terkunci selamanya jika API tidak merespons.
 */
const controller =
    new AbortController();

const timeout =
    setTimeout(
        () => controller.abort(),
        15000
    );

options.signal =
    controller.signal;

let response;

try {

    response =
        await fetch(
            url,
            options
        );

} catch (error) {

    if (
        error?.name ===
        "AbortError"
    ) {

        throw new Error(
            "Admin Models API timeout setelah 15 detik."
        );
    }

    throw new Error(
        error?.message ||
        "Gagal menghubungi Admin Models API."
    );

} finally {

    clearTimeout(timeout);
}


    const data =
        await response
            .json()
            .catch(
                () => ({})
            );


    if (!response.ok) {

        throw new Error(
            data?.error ||
            data?.message ||
            `Admin Models API gagal (${response.status}).`
        );

    }


    if (
        data?.success === false
    ) {

        throw new Error(
            data.error ||
            data.message ||
            "Admin Models API gagal."
        );

    }


    return data;

}


/* ============================================================
   EXTRACT ADMIN MODELS
============================================================ */

function extractAdminModels(
    data
) {

    if (
        Array.isArray(data)
    ) {

        return data;

    }


    if (
        Array.isArray(
            data?.models
        )
    ) {

        return data.models;

    }


    if (
        Array.isArray(
            data?.data
        )
    ) {

        return data.data;

    }


    if (
        Array.isArray(
            data?.data?.models
        )
    ) {

        return data.data.models;

    }


    if (
        data?.model &&
        typeof data.model ===
            "object"
    ) {

        return [
            data.model
        ];

    }


    if (
        data?.data?.model &&
        typeof data.data.model ===
            "object"
    ) {

        return [
            data.data.model
        ];

    }


    return [];

}


/* ============================================================
   FIND ADMIN MODEL
============================================================ */

function findAdminModel(
    models,
    requestedId
) {

    if (
        !Array.isArray(models)
    ) {

        return null;

    }


    const normalized =
        String(
            requestedId || ""
        ).trim();


    if (!normalized) {

        return null;

    }


    return (
        models.find(
            item => {

                const modelId =
                    String(
                        item?.model_id ||
                        ""
                    ).trim();


                const databaseId =
                    String(
                        item?.id ||
                        ""
                    ).trim();


                return (
                    modelId ===
                        normalized ||
                    databaseId ===
                        normalized
                );

            }
        ) ||
        null
    );

}


/* ============================================================
   EXTRACT SAVED MODEL
============================================================ */

function extractSavedModel(
    data
) {

    if (
        data?.model &&
        typeof data.model ===
            "object"
    ) {

        return data.model;

    }


    if (
        data?.data?.model &&
        typeof data.data.model ===
            "object"
    ) {

        return data.data.model;

    }


    if (
        data?.data &&
        typeof data.data ===
            "object" &&
        !Array.isArray(
            data.data
        ) &&
        (
            data.data.id ||
            data.data.model_id
        )
    ) {

        return data.data;

    }


    if (
        Array.isArray(
            data?.models
        ) &&
        data.models[0]
    ) {

        return data.models[0];

    }


    if (
        Array.isArray(data) &&
        data[0]
    ) {

        return data[0];

    }


    if (
        data &&
        typeof data ===
            "object" &&
        !Array.isArray(data) &&
        (
            data.id ||
            data.model_id
        )
    ) {

        return data;

    }


    return null;

}


/* ============================================================
   GET SINGLE MODEL
============================================================ */

async function getAdminModel(
    modelId
) {

    const requestedId =
        String(
            modelId || ""
        ).trim();


    if (!requestedId) {

        throw new Error(
            "Model ID tidak ditemukan."
        );

    }


    /*
     * --------------------------------------------------------
     * PRIORITAS 1
     *
     * Cari berdasarkan model_id.
     * Ini adalah identifier utama yang digunakan
     * oleh halaman Generate / registry.
     * --------------------------------------------------------
     */

    let result =
        await requestAdminModels(
            "GET",
            null,
            {
                model_id:
                    requestedId
            }
        );


    let models =
        extractAdminModels(
            result
        );


    let model =
        findAdminModel(
            models,
            requestedId
        );


    if (model) {

        return model;

    }


    /*
     * --------------------------------------------------------
     * PRIORITAS 2
     *
     * Jika model_id tidak ditemukan, coba database UUID/id.
     *
     * Ini penting karena halaman Edit Model dapat dibuka
     * menggunakan ?id=...
     * --------------------------------------------------------
     */

    result =
        await requestAdminModels(
            "GET",
            null,
            {
                id:
                    requestedId
            }
        );


    models =
        extractAdminModels(
            result
        );


    model =
        findAdminModel(
            models,
            requestedId
        );


    if (model) {

        return model;

    }


    throw new Error(
        `Model "${requestedId}" tidak ditemukan pada Admin Models.`
    );

}


/* ============================================================
   PUBLIC API
============================================================ */

const GENZModelEditAPI =
    Object.freeze({

        getAccessToken,

        requestAdminModels,

        extractAdminModels,

        findAdminModel,

        extractSavedModel,

        getAdminModel

    });


window.GENZModelEditAPI =
    GENZModelEditAPI;


export {

    getAccessToken,

    requestAdminModels,

    extractAdminModels,

    findAdminModel,

    extractSavedModel,

    getAdminModel

};
