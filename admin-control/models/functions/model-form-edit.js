/* =========================================================
   GEN-Z.AI
   MODEL FORM EDIT
   ---------------------------------------------------------
   Tanggung jawab:
   - Edit / update Model
   - Mengambil ID record Model
   - Validasi data
   - Kirim request PATCH ke /api/admin-models
   ---------------------------------------------------------
   Tidak mengurus:
   - Create
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

    function getRecordId(model) {
        if (model) {
            return String(
                model.id ??
                model.model_id_record ??
                ""
            ).trim();
        }

        return getValue("modelRecordId");
    }

    function collectData(model) {

        const recordId =
            getRecordId(model);

        const providerId =
            getValue("providerId");

        const modelId =
            getValue("modelCode") ||
            getValue("modelCodeSearch");

        const modelName =
            getValue("modelName");

        const modelFamily =
            getValue("modelFamily");

        const documentationUrl =
            getValue(
                "documentationUrl"
            );

        const statusField =
            getField("modelStatus") ||
            getField("status");

        const status =
            statusField
                ? String(
                    statusField.value ?? ""
                  ).trim()
                : "active";

        return {
            id: recordId,

            provider_id:
                providerId,

            model_id:
                modelId,

            model_name:
                modelName,

            model_family:
                modelFamily,

            status:
                status || "active",

            documentation_url:
                documentationUrl
        };
    }

    function validate(data) {

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

        return true;
    }

    function buildPayload(data) {

        return {
            action: "update",

            id: data.id,

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
    }

    function update(data) {

        validate(data);

        const payload =
            buildPayload(data);

        return getSessionToken()
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
                        method: "PATCH",
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
                        "Gagal memperbarui model.";

                    throw new Error(
                        message
                    );
                }

                return result;
            });
    }

    function updateFromForm(model) {

        const data =
            collectData(model);

        return update(data);
    }

    function populate(model) {

        if (!model) {
            return false;
        }

        const recordId =
            String(
                model.id ?? ""
            ).trim();

        const modelId =
            String(
                model.model_id ??
                ""
            ).trim();

        const modelName =
            String(
                model.model_name ??
                ""
            ).trim();

        const modelFamily =
            String(
                model.model_family ??
                ""
            ).trim();

        const documentationUrl =
            String(
                model.documentation_url ??
                ""
            ).trim();

        const status =
            String(
                model.status ??
                "active"
            ).trim();

        const recordField =
            getField(
                "modelRecordId"
            );

        if (recordField) {
            recordField.value =
                recordId;
        }

        const searchField =
            getField(
                "modelCodeSearch"
            );

        if (searchField) {
            searchField.value =
                modelId;
        }

        const hiddenField =
            getField("modelCode");

        if (hiddenField) {
            hiddenField.value =
                modelId;
        }

        const nameField =
            getField("modelName");

        if (nameField) {
            nameField.value =
                modelName;
        }

        const familyField =
            getField("modelFamily");

        if (familyField) {
            familyField.value =
                modelFamily;
        }

        const documentationField =
            getField(
                "documentationUrl"
            );

        if (documentationField) {
            documentationField.value =
                documentationUrl;
        }

        const statusField =
            getField("modelStatus") ||
            getField("status");

        if (statusField) {
            statusField.value =
                status || "active";
        }

        const info =
            getField(
                "selectedModelInfo"
            );

        if (info) {

            info.textContent =
                [
                    modelName ||
                        modelId,
                    modelFamily,
                    model.provider_name ||
                        model.provider_id ||
                        model.provider ||
                        ""
                ]
                    .filter(Boolean)
                    .join(" · ");
        }

        if (
            window.GENZModelProviderDropdown &&
            typeof
                window.GENZModelProviderDropdown.setValue ===
                "function"
        ) {

            window.GENZModelProviderDropdown
                .setValue(
                    String(
                        model.provider_id ??
                        model.provider ??
                        ""
                    ).trim()
                );
        }

        return true;
    }

    window.GENZModelFormEdit =
        Object.freeze({
            collectData,
            validate,
            buildPayload,
            update,
            updateFromForm,
            populate
        });

})();
