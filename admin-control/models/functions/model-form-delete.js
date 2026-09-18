/* =========================================================
   GEN-Z.AI
   MODEL FORM DELETE
   ---------------------------------------------------------
   Tanggung jawab:
   - Menghapus Model
   - Mengirim request DELETE
   - Validasi ID Model
   ---------------------------------------------------------
   Tidak mengurus:
   - Create
   - Edit
   - Search
   - Provider
   - Price
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

    function getModelId(model) {

        if (typeof model === "string") {
            return model.trim();
        }

        if (model) {
            return String(
                model.id ??
                model.model_id_record ??
                ""
            ).trim();
        }

        return "";
    }

    function validate(model) {

        const id =
            getModelId(model);

        if (!id) {
            throw new Error(
                "ID Model tidak ditemukan."
            );
        }

        return id;
    }

    function buildPayload(model) {

        return {
            action: "delete",
            id: validate(model)
        };
    }

    function remove(model) {

        const id =
            validate(model);

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
                        method: "DELETE",
                        headers,
                        body:
                            JSON.stringify({
                                action: "delete",
                                id: id
                            })
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
                        "Gagal menghapus model.";

                    throw new Error(
                        message
                    );
                }

                return result;
            });
    }

    function removeById(modelId) {
        return remove(modelId);
    }

    window.GENZModelFormDelete =
        Object.freeze({
            getModelId,
            validate,
            buildPayload,
            remove,
            removeById
        });

})();
