/* =========================================================
   GEN-Z.AI
   MODEL FORM EDIT MODULE
   ---------------------------------------------------------
   File:
   admin-control/models/functions/model-form-edit.js

   TUGAS:
   - Mengelola proses EDIT / UPDATE Model
   - Mengambil record ID
   - Mengambil data Form
   - Validasi data Edit
   - Membentuk payload PATCH
   - Mengirim PATCH ke /api/admin-models
   - Populate field Form saat Edit

   TIDAK MENGURUS:
   - Create
   - Delete
   - Search
   - Provider lifecycle
   - Provider dropdown rendering
   - Price calculation
   - Table
   - UI orchestration

   OWNERSHIP:
   - Provider      -> GENZModelsProvider
   - Search        -> GENZModelsSearch
   - Pricing       -> GENZModelsPrice
   - Edit          -> GENZModelFormEdit
   ========================================================= */

(function () {
    "use strict";


    /* =====================================================
       CONFIG
    ===================================================== */

    const API_URL =
        "/api/admin-models";


    /* =====================================================
       SUPABASE
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
       FIELD HELPERS
    ===================================================== */

    function getField(id) {

        return document.getElementById(id);
    }


    function getValue(id) {

        const field =
            getField(id);

        if (!field) {
            return "";
        }

        return String(
            field.value ?? ""
        ).trim();
    }


    /* =====================================================
       ARRAY NORMALIZATION
       
       Form bisa mengirim:
       - array
       - JSON array
       - comma separated
       - newline separated
    ===================================================== */

    function normalizeArray(value) {

        if (Array.isArray(value)) {

            return value
                .map(function (item) {
                    return String(
                        item ?? ""
                    ).trim();
                })
                .filter(Boolean);
        }


        const text =
            String(
                value ?? ""
            ).trim();


        if (!text) {
            return [];
        }


        /*
         * JSON array.
         */
        if (
            text.startsWith("[") &&
            text.endsWith("]")
        ) {

            try {

                const parsed =
                    JSON.parse(text);

                if (
                    Array.isArray(parsed)
                ) {

                    return parsed
                        .map(function (item) {
                            return String(
                                item ?? ""
                            ).trim();
                        })
                        .filter(Boolean);
                }

            } catch (error) {

                /*
                 * Bukan JSON valid.
                 * Lanjut ke parser biasa.
                 */
            }
        }


        return text
            .split(
                /[\n,]+/
            )
            .map(function (item) {
                return String(
                    item ?? ""
                ).trim();
            })
            .filter(Boolean);
    }


    /* =====================================================
       NUMBER NORMALIZATION
    ===================================================== */

    function normalizeNumber(
        value,
        fallback = 0
    ) {

        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {

            return fallback;
        }


        const number =
            Number(
                String(value)
                    .replace(",", ".")
                    .trim()
            );


        return Number.isFinite(number)
            ? number
            : fallback;
    }


    /* =====================================================
       SESSION TOKEN
    ===================================================== */

    function getSessionToken() {

        const supabase =
            getSupabase();


        if (
            !supabase ||
            !supabase.auth ||
            typeof supabase.auth.getSession !==
                "function"
        ) {

            return Promise.resolve("");
        }


        return supabase.auth
            .getSession()
            .then(
                function (result) {

                    const session =
                        result?.data?.session;


                    return String(
                        session?.access_token ??
                        ""
                    ).trim();
                }
            )
            .catch(
                function () {

                    return "";
                }
            );
    }


    /* =====================================================
       RECORD ID
    ===================================================== */

    function getRecordId(
        model
    ) {

        if (model) {

            return String(
                model.id ??
                model.model_id_record ??
                ""
            ).trim();
        }


        return getValue(
            "modelRecordId"
        );
    }


    /* =====================================================
       PROVIDER VALUE
       
       Provider dropdown adalah owner Provider.
       Module Edit hanya mengambil value yang sudah
       dipilih oleh dropdown.
    ===================================================== */

    function getProviderValue() {

        const dropdown =
            window.GENZModelProviderDropdown;


        if (
            dropdown &&
            typeof dropdown.getSelected ===
                "function"
        ) {

            try {

                const selected =
                    dropdown.getSelected();

                if (selected) {

                    return String(
                        selected.provider_id ??
                        selected.provider ??
                        selected.id ??
                        ""
                    ).trim();
                }

            } catch (error) {

                console.warn(
                    "[GEN-Z.AI] Gagal membaca Provider Dropdown:",
                    error
                );
            }
        }


        return getValue(
            "providerId"
        );
    }


    /* =====================================================
       COLLECT FORM DATA
       
       Field diselaraskan dengan MODEL_FIELDS pada API:

       id
       provider_id
       model_id
       model_name
       description
       credit_cost
       discount_percent
       credit_final
       min_duration
       max_duration
       supported_ratios
       supported_resolutions
       status
    ===================================================== */

    function collectData(
        model
    ) {

        const recordId =
            getRecordId(
                model
            );


        const providerId =
            getProviderValue();


        const modelId =
            getValue(
                "modelCode"
            ) ||
            getValue(
                "modelCodeSearch"
            );


        const modelName =
            getValue(
                "modelName"
            );


        const description =
            getValue(
                "description"
            );


        const creditCost =
            getValue(
                "creditCost"
            );


        const discountPercent =
            getValue(
                "discountPercent"
            );


        const creditFinal =
            getValue(
                "creditFinal"
            );


        const minDuration =
            getValue(
                "minDuration"
            );


        const maxDuration =
            getValue(
                "maxDuration"
            );


        const supportedRatios =
            normalizeArray(
                getValue(
                    "supportedRatios"
                )
            );


        const supportedResolutions =
            normalizeArray(
                getValue(
                    "supportedResolutions"
                )
            );


        const statusField =
            getField(
                "modelStatus"
            ) ||
            getField(
                "status"
            );


        const status =
            statusField
                ? String(
                    statusField.value ??
                    ""
                  ).trim()
                : "active";


        return {

            id:
                recordId,

            provider_id:
                providerId,

            model_id:
                modelId,

            model_name:
                modelName,

            description:
                description,

            credit_cost:
                creditCost,

            discount_percent:
                discountPercent,

            credit_final:
                creditFinal,

            min_duration:
                minDuration,

            max_duration:
                maxDuration,

            supported_ratios:
                supportedRatios,

            supported_resolutions:
                supportedResolutions,

            status:
                status || "active"
        };
    }


    /* =====================================================
       VALIDATE
    ===================================================== */

    function validate(
        data
    ) {

        if (!data) {

            throw new Error(
                "Data Model tidak tersedia."
            );
        }


        if (!data.id) {

            throw new Error(
                "ID Model tidak ditemukan."
            );
        }


        if (!data.provider_id) {

            throw new Error(
                "Provider wajib dipilih."
            );
        }


        if (!data.model_id) {

            throw new Error(
                "Model ID wajib diisi."
            );
        }


        if (!data.model_name) {

            throw new Error(
                "Nama Model wajib diisi."
            );
        }


        const creditCost =
            normalizeNumber(
                data.credit_cost,
                NaN
            );


        if (
            !Number.isFinite(
                creditCost
            ) ||
            creditCost < 0
        ) {

            throw new Error(
                "Credit Cost harus berupa angka 0 atau lebih."
            );
        }


        const discount =
            normalizeNumber(
                data.discount_percent,
                0
            );


        if (
            !Number.isFinite(
                discount
            ) ||
            discount < 0 ||
            discount > 100
        ) {

            throw new Error(
                "Diskon harus berada antara 0 sampai 100 persen."
            );
        }


        return true;
    }


    /* =====================================================
       BUILD PAYLOAD
       
       Hanya field yang memang digunakan oleh
       endpoint /api/admin-models.
       
       Tidak mengirim:
       - model_family
       - documentation_url

       karena kedua field tersebut bukan bagian
       dari MODEL_FIELDS API saat ini.
    ===================================================== */

    function buildPayload(
        data
    ) {

        return {

            action:
                "update",

            id:
                data.id,

            provider_id:
                data.provider_id,

            model_id:
                data.model_id,

            model_name:
                data.model_name,

            description:
                data.description,

            credit_cost:
                data.credit_cost,

            discount_percent:
                data.discount_percent,

            credit_final:
                data.credit_final,

            min_duration:
                data.min_duration,

            max_duration:
                data.max_duration,

            supported_ratios:
                data.supported_ratios,

            supported_resolutions:
                data.supported_resolutions,

            status:
                data.status
        };
    }


    /* =====================================================
       UPDATE
       
       PATCH /api/admin-models
    ===================================================== */

    function update(
        data
    ) {

        validate(
            data
        );


        const payload =
            buildPayload(
                data
            );


        return getSessionToken()
            .then(
                function (token) {

                    const headers = {

                        "Content-Type":
                            "application/json"
                    };


                    if (token) {

                        headers.Authorization =
                            "Bearer " +
                            token;
                    }


                    return fetch(
                        API_URL,
                        {

                            method:
                                "PATCH",

                            headers:
                                headers,

                            body:
                                JSON.stringify(
                                    payload
                                )
                        }
                    );
                }
            )
            .then(
                async function (
                    response
                ) {

                    let result =
                        null;


                    try {

                        result =
                            await response.json();

                    } catch (error) {

                        result =
                            null;
                    }


                    if (
                        !response.ok
                    ) {

                        const message =
                            result?.error ||
                            result?.message ||
                            "Gagal memperbarui model.";


                        throw new Error(
                            message
                        );
                    }


                    return result;
                }
            );
    }


    /* =====================================================
       UPDATE FROM FORM
    ===================================================== */

    function updateFromForm(
        model
    ) {

        const data =
            collectData(
                model
            );


        return update(
            data
        );
    }


    /* =====================================================
       POPULATE
       
       Hanya mengisi field Form.
       
       Provider tetap diserahkan ke:
       GENZModelProviderDropdown
    ===================================================== */

    function populate(
        model
    ) {

        if (!model) {

            return false;
        }


        /* -------------------------------------------------
           RECORD ID
        ------------------------------------------------- */

        const recordId =
            String(
                model.id ??
                ""
            ).trim();


        const recordField =
            getField(
                "modelRecordId"
            );


        if (recordField) {

            recordField.value =
                recordId;
        }


        /* -------------------------------------------------
           PROVIDER
        ------------------------------------------------- */

        const providerIdentifier =
            String(
                model.provider_id ??
                model.provider ??
                model.provider_code ??
                model.id ??
                ""
            ).trim();


        const providerDropdown =
            window.GENZModelProviderDropdown;


        if (
            providerDropdown &&
            typeof providerDropdown.setValue ===
                "function"
        ) {

            /*
             * setValue() sekarang mendukung:
             * - provider_id
             * - provider.id
             * - provider_name
             */
            providerDropdown.setValue(
                providerIdentifier
            );
        }


        /* -------------------------------------------------
           MODEL ID
        ------------------------------------------------- */

        const modelId =
            String(
                model.model_id ??
                ""
            ).trim();


        const searchField =
            getField(
                "modelCodeSearch"
            );


        if (searchField) {

            searchField.value =
                modelId;
        }


        const hiddenField =
            getField(
                "modelCode"
            );


        if (hiddenField) {

            hiddenField.value =
                modelId;
        }


        /* -------------------------------------------------
           MODEL NAME
        ------------------------------------------------- */

        const nameField =
            getField(
                "modelName"
            );


        if (nameField) {

            nameField.value =
                String(
                    model.model_name ??
                    ""
                ).trim();
        }


        /* -------------------------------------------------
           DESCRIPTION
        ------------------------------------------------- */

        const descriptionField =
            getField(
                "description"
            );


        if (descriptionField) {

            descriptionField.value =
                String(
                    model.description ??
                    ""
                ).trim();
        }


        /* -------------------------------------------------
           CREDIT COST
        ------------------------------------------------- */

        const creditCostField =
            getField(
                "creditCost"
            );


        if (creditCostField) {

            creditCostField.value =
                model.credit_cost ??
                "";
        }


        /* -------------------------------------------------
           DISCOUNT
        ------------------------------------------------- */

        const discountField =
            getField(
                "discountPercent"
            );


        if (discountField) {

            discountField.value =
                model.discount_percent ??
                0;
        }


        /* -------------------------------------------------
           CREDIT FINAL
        ------------------------------------------------- */

        const creditFinalField =
            getField(
                "creditFinal"
            );


        if (creditFinalField) {

            creditFinalField.value =
                model.credit_final ??
                "";
        }


        /* -------------------------------------------------
           MIN DURATION
        ------------------------------------------------- */

        const minDurationField =
            getField(
                "minDuration"
            );


        if (minDurationField) {

            minDurationField.value =
                model.min_duration ??
                "";
        }


        /* -------------------------------------------------
           MAX DURATION
        ------------------------------------------------- */

        const maxDurationField =
            getField(
                "maxDuration"
            );


        if (maxDurationField) {

            maxDurationField.value =
                model.max_duration ??
                "";
        }


        /* -------------------------------------------------
           SUPPORTED RATIOS
        ------------------------------------------------- */

        const ratiosField =
            getField(
                "supportedRatios"
            );


        if (ratiosField) {

            const ratios =
                normalizeArray(
                    model.supported_ratios
                );


            /*
             * Ikuti format existing field.
             * Untuk textarea/input text, gunakan comma.
             */
            ratiosField.value =
                ratios.join(
                    ", "
                );
        }


        /* -------------------------------------------------
           SUPPORTED RESOLUTIONS
        ------------------------------------------------- */

        const resolutionsField =
            getField(
                "supportedResolutions"
            );


        if (resolutionsField) {

            const resolutions =
                normalizeArray(
                    model.supported_resolutions
                );


            resolutionsField.value =
                resolutions.join(
                    ", "
                );
        }


        /* -------------------------------------------------
           STATUS
        ------------------------------------------------- */

        const statusField =
            getField(
                "modelStatus"
            ) ||
            getField(
                "status"
            );


        if (statusField) {

            statusField.value =
                String(
                    model.status ??
                    "active"
                ).trim() ||
                "active";
        }


        /* -------------------------------------------------
           SELECTED MODEL INFO
        ------------------------------------------------- */

        const info =
            getField(
                "selectedModelInfo"
            );


        if (info) {

            const providerName =
                String(
                    model.provider_name ??
                    model.provider_code ??
                    model.provider_id ??
                    model.provider ??
                    ""
                ).trim();


            const modelName =
                String(
                    model.model_name ??
                    model.model_id ??
                    ""
                ).trim();


            const description =
                String(
                    model.description ??
                    ""
                ).trim();


            const parts = [

                modelName,

                providerName,

                description
            ]
                .filter(Boolean);


            info.textContent =
                parts.join(
                    " · "
                );
        }


        /*
         * Beri tahu module lain bahwa Form Edit
         * sudah diisi.
         *
         * Tidak menjalankan logic CRUD.
         */
        document.dispatchEvent(
            new CustomEvent(
                "genz-model-edit-populated",
                {
                    detail: {
                        model:
                            model
                    }
                }
            )
        );


        return true;
    }


    /* =====================================================
       PUBLIC API
    ===================================================== */

    window.GENZModelFormEdit =
        Object.freeze({

            collectData,

            validate,

            buildPayload,

            update,

            updateFromForm,

            populate

        });


    console.info(
        "[GEN-Z.AI] GENZModelFormEdit loaded."
    );

})();
