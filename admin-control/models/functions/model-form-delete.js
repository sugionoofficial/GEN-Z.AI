/* =========================================================
   GEN-Z.AI
   ADMIN MODEL MANAGEMENT
   MODEL FORM DELETE
   ---------------------------------------------------------
   File:
   admin-control/models/functions/model-form-delete.js

   Tanggung jawab:
   - Validasi ID Model
   - Membangun payload DELETE
   - Mengirim request DELETE ke API
   - Mengembalikan hasil API

   Tidak bertanggung jawab:
   - Create
   - Edit
   - Provider
   - Model Search
   - Model Dropdown
   - Price / Credit
   - Modal
   - Event Listener
   - Refresh Table
   - Notification

   Prinsip:
   Satu fungsi = satu owner.
   Module Delete hanya menangani operasi DELETE.
   ========================================================= */

(function () {

    "use strict";


    /* =====================================================
       CONFIG
    ===================================================== */

    const API_URL =
        "/api/admin-models";


    /* =====================================================
       SUPABASE ACCESS
    ===================================================== */

    function getSupabase() {

        return (
            window.GENZ_SUPABASE ||
            window.supabaseClient ||
            window.supabase ||
            null
        );

    }


    /* =====================================================
       SESSION TOKEN
    ===================================================== */

    async function getSessionToken() {

        const supabase =
            getSupabase();

        if (
            !supabase ||
            !supabase.auth ||
            typeof supabase.auth.getSession !==
                "function"
        ) {

            return "";

        }

        try {

            const result =
                await supabase.auth.getSession();

            return String(
                result?.data?.session?.access_token ??
                ""
            ).trim();

        } catch (error) {

            console.warn(
                "[GEN-Z.AI] Gagal mengambil session token:",
                error
            );

            return "";

        }

    }


    /* =====================================================
       MODEL ID
    ===================================================== */

    function getModelId(
        model
    ) {

        /*
         * Jika langsung diberikan string,
         * gunakan sebagai ID.
         */
        if (
            typeof model ===
            "string"
        ) {

            return model.trim();

        }


        /*
         * Jika object model,
         * gunakan primary record ID.
         *
         * Jangan menggunakan model.model_id
         * karena itu adalah ID provider/catalog,
         * bukan UUID/ID record database.
         */
        if (
            model &&
            typeof model ===
                "object"
        ) {

            return String(
                model.id ??
                model.model_id_record ??
                ""
            ).trim();

        }

        return "";

    }


    /* =====================================================
       VALIDATION
    ===================================================== */

    function validate(
        model
    ) {

        const id =
            getModelId(
                model
            );

        if (!id) {

            throw new Error(
                "ID Model tidak ditemukan."
            );

        }

        return id;

    }


    /* =====================================================
       PAYLOAD
    ===================================================== */

    function buildPayload(
        model
    ) {

        const id =
            validate(
                model
            );

        return {

            action:
                "delete",

            id

        };

    }


    /* =====================================================
       REQUEST HEADERS
    ===================================================== */

    async function buildHeaders() {

        const token =
            await getSessionToken();

        const headers = {

            "Content-Type":
                "application/json",

            "Accept":
                "application/json"

        };

        if (token) {

            headers.Authorization =
                "Bearer " +
                token;

        }

        return headers;

    }


    /* =====================================================
       DELETE MODEL
    ===================================================== */

    async function remove(
        model
    ) {

        const payload =
            buildPayload(
                model
            );

        const headers =
            await buildHeaders();


        let response;

        try {

            response =
                await fetch(
                    API_URL,
                    {

                        method:
                            "DELETE",

                        headers,

                        body:
                            JSON.stringify(
                                payload
                            )

                    }
                );

        } catch (error) {

            console.error(
                "[GEN-Z.AI] Delete Model network error:",
                error
            );

            throw new Error(
                "Tidak dapat terhubung ke server."
            );

        }


        /* =================================================
           RESPONSE
        ================================================= */

        let result =
            null;

        const contentType =
            response.headers
                ?.get(
                    "content-type"
                ) ||
            "";


        if (
            contentType.includes(
                "application/json"
            )
        ) {

            try {

                result =
                    await response.json();

            } catch (error) {

                result =
                    null;

            }

        } else {

            try {

                const text =
                    await response.text();

                result =
                    text
                        ? {
                            message:
                                text
                        }
                        : null;

            } catch (error) {

                result =
                    null;

            }

        }


        /* =================================================
           API ERROR
        ================================================= */

        if (
            !response.ok
        ) {

            const message =
                result?.error ||
                result?.message ||
                `Gagal menghapus model. HTTP ${response.status}.`;

            throw new Error(
                String(
                    message
                )
            );

        }


        /* =================================================
           SUCCESS
        ================================================= */

        return {

            success:
                true,

            ...(
                result &&
                typeof result ===
                    "object"
                    ? result
                    : {}
            )

        };

    }


    /* =====================================================
       DELETE BY ID
    ===================================================== */

    function removeById(
        modelId
    ) {

        return remove(
            modelId
        );

    }


    /* =====================================================
       PUBLIC API
    ===================================================== */

    window.GENZModelFormDelete =
        Object.freeze({

            getModelId,

            validate,

            buildPayload,

            getSessionToken,

            remove,

            removeById

        });


})();
