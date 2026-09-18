/* =========================================================
   GEN-Z.AI
   MODEL FORM CREATE
   ---------------------------------------------------------
   Tanggung jawab:
   - Create / tambah Model
   - Validasi data dasar
   - Kirim request POST ke /api/admin-models
   ---------------------------------------------------------
   Tidak mengurus:
   - Edit
   - Delete
   - Search
   - Provider dropdown
   - Price calculation
   ========================================================= */

(function () {
    "use strict";

    const API_URL = "/api/admin-models";

    function getSupabase() {
        return (
            window.GENZ_SUPABASE ||
            window.supabaseClient ||
            window.supabase ||
            null
        );
    }

    function getField(id) {
        return document.getElementById(id);
    }

    function getValue(id) {
        const field = getField(id);

        if (!field) {
            return "";
        }

        return String(
            field.value ?? ""
        ).trim();
    }

    function getSessionToken() {
        const supabase = getSupabase();

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
            .then(function (result) {

                const session =
                    result?.data?.session;

                return String(
                    session?.access_token ?? ""
                ).trim();
            })
            .catch(function () {
                return "";
            });
    }

    function collectData() {
        const searchModelId =
            getValue("modelCodeSearch");

        const hiddenModelId =
            getValue("modelCode");

        const modelId =
            hiddenModelId ||
            searchModelId;

        const providerId =
            getValue("providerId");

        const modelName =
            getValue("modelName");

        const modelFamily =
            getValue("modelFamily");

        const statusField =
            getField("modelStatus") ||
            getField("status");

        const status =
            statusField
                ? String(
                    statusField.value ?? ""
                  ).trim()
                : "active";

        const documentationUrl =
            getValue(
                "documentationUrl"
            );

        return {
            provider_id: providerId,
            model_id: modelId,
            model_name: modelName,
            model_family: modelFamily,
            status: status || "active",
            documentation_url:
                documentationUrl
        };
    }

    function validate(data) {

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

        return true;
    }

    function buildPayload(data) {

        /*
         * API admin-models dapat menerima
         * payload tambahan dari modul Form.
         *
         * Hanya field yang tersedia yang dikirim.
         */

        const payload = {
            action: "create",

            provider_id:
                data.provider_id,

            model_id:
                data.model_id,

            model_name:
                data.model_name,

            model_family:
                data.model_family,

            status:
                data.status,

            documentation_url:
                data.documentation_url
        };

        return payload;
    }

    function create(data) {

        const payload =
            buildPayload(data);

        return validate(data) &&
            getSessionToken()
                .then(function (token) {

                    const headers = {
                        "Content-Type":
                            "application/json"
                    };

                    if (token) {
                        headers.Authorization =
                            "Bearer " + token;
                    }

                    return fetch(
                        API_URL,
                        {
                            method: "POST",
                            headers,
                            body:
                                JSON.stringify(
                                    payload
                                )
                        }
                    );
                })
                .then(async function (response) {

                    let result = null;

                    try {
                        result =
                            await response.json();
                    } catch (error) {
                        result = null;
                    }

                    if (!response.ok) {

                        const message =
                            result?.error ||
                            result?.message ||
                            "Gagal menambahkan model.";

                        throw new Error(
                            message
                        );
                    }

                    return result;
                });
    }

    function createFromForm() {
        const data =
            collectData();

        return create(data);
    }

    function reset() {

        [
            "modelCode",
            "modelCodeSearch",
            "modelName",
            "modelFamily",
            "documentationUrl"
        ].forEach(function (id) {

            const field =
                getField(id);

            if (field) {
                field.value = "";
            }
        });

        const statusField =
            getField("modelStatus") ||
            getField("status");

        if (statusField) {
            statusField.value = "active";
        }

        const info =
            getField(
                "selectedModelInfo"
            );

        if (info) {
            info.textContent =
                "Belum ada model dipilih.";
        }

        if (
            window.GENZModelProviderDropdown &&
            typeof
                window.GENZModelProviderDropdown.clear ===
                "function"
        ) {
            window.GENZModelProviderDropdown.clear();
        }
    }

    window.GENZModelFormCreate =
        Object.freeze({
            collectData,
            validate,
            buildPayload,
            create,
            createFromForm,
            reset
        });

})();
