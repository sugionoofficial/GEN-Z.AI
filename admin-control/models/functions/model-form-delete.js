/* =========================================================
   GEN-Z.AI
   MODEL FORM DELETE MODULE
   ---------------------------------------------------------
   File:
   admin-control/models/functions/model-form-delete.js

   Tanggung jawab:
   - Menyiapkan proses delete model
   - Validasi model target
   - Konfirmasi delete
   - Menyerahkan operasi DELETE kepada caller/API layer
   - Menjaga agar delete tidak recursive
   - Menjaga state delete tetap konsisten

   Tidak bertanggung jawab:
   - Render tabel
   - Query Supabase langsung
   - Create model
   - Edit model
   - Render modal
   - Perhitungan pricing
   ========================================================= */

(function () {

    "use strict";


    /* =====================================================
       STATE
       ===================================================== */

    const state = {
        active: false,
        deleting: false,
        model: null,
        modelId: null
    };


    /* =====================================================
       HELPERS
       ===================================================== */

    function normalizeId(value) {

        if (
            value === null ||
            value === undefined
        ) {
            return "";
        }

        return String(value).trim();

    }


    function normalizeText(value) {

        if (
            value === null ||
            value === undefined
        ) {
            return "";
        }

        return String(value).trim();

    }


    function getModelId(model) {

        if (
            !model ||
            typeof model !== "object"
        ) {
            return "";
        }

        /*
         * Database primary key tetap menjadi
         * identifier utama untuk DELETE.
         *
         * model_id hanya fallback untuk
         * membaca identifier model ketika
         * diperlukan oleh resolver.
         */
        return normalizeId(
            model.id
        );

    }


    function getModelName(model) {

        if (
            !model ||
            typeof model !== "object"
        ) {
            return "";
        }

        return normalizeText(
            model.model_name ||
            model.name ||
            model.model_id
        );

    }


    /* =====================================================
       RESOLVE MODEL
       ===================================================== */

    function resolveModel(
        model,
        models = []
    ) {

        const list =
            Array.isArray(models)
                ? models
                : [];


        /*
         * Jika object model diberikan.
         */
        if (
            model &&
            typeof model === "object"
        ) {

            /*
             * Model dengan database ID sudah cukup.
             */
            if (
                normalizeId(model.id)
            ) {

                return model;

            }


            /*
             * Jika hanya mempunyai model_id,
             * coba cari record lengkap dari list.
             */
            const requestedModelId =
                normalizeText(
                    model.model_id
                );


            if (
                requestedModelId
            ) {

                const found =
                    list.find(
                        item =>
                            normalizeText(
                                item &&
                                item.model_id
                            ) ===
                            requestedModelId
                    );


                return found || model;

            }


            return model;

        }


        /*
         * Jika hanya ID/string diberikan,
         * cari berdasarkan:
         * 1. database id
         * 2. model_id
         */
        const requestedId =
            normalizeId(
                model
            );


        if (!requestedId) {
            return null;
        }


        return (
            list.find(
                item => {

                    if (
                        !item ||
                        typeof item !== "object"
                    ) {
                        return false;
                    }

                    return (
                        normalizeId(
                            item.id
                        ) === requestedId
                    ) ||
                    (
                        normalizeText(
                            item.model_id
                        ) === requestedId
                    );

                }
            ) || null
        );

    }


    /* =====================================================
       VALIDATE DELETE TARGET
       ===================================================== */

    function validateDeleteTarget(
        model,
        options = {}
    ) {

        const errors = [];


        if (
            !model ||
            typeof model !== "object"
        ) {

            errors.push(
                "Model yang akan dihapus tidak ditemukan."
            );

            return errors;

        }


        const modelId =
            getModelId(
                model
            );


        /*
         * DELETE database harus menggunakan
         * models.id.
         */
        if (
            options.requireDatabaseId !== false &&
            !modelId
        ) {

            errors.push(
                "ID database model tidak ditemukan."
            );

        }


        return errors;

    }


    /* =====================================================
       CREATE VALIDATION ERROR
       ===================================================== */

    function createValidationError(
        errors
    ) {

        const error =
            new Error(
                "MODEL_DELETE_VALIDATION_FAILED"
            );

        error.code =
            "MODEL_DELETE_VALIDATION_FAILED";

        error.errors =
            Array.isArray(errors)
                ? errors
                : [];

        return error;

    }


    /* =====================================================
       OPEN DELETE
       ===================================================== */

    function openDelete(
        model,
        options = {}
    ) {

        /*
         * Jangan membuka operasi delete baru
         * ketika delete sebelumnya masih berjalan.
         */
        if (
            state.deleting
        ) {

            return getState();

        }


        const resolved =
            resolveModel(
                model,
                options.models
            );


        const errors =
            validateDeleteTarget(
                resolved,
                options
            );


        if (
            errors.length
        ) {

            throw createValidationError(
                errors
            );

        }


        state.active =
            true;

        state.deleting =
            false;

        state.model =
            resolved;

        state.modelId =
            getModelId(
                resolved
            );


        return getState();

    }


    /* =====================================================
       CLOSE DELETE
       ===================================================== */

    function closeDelete() {

        state.active =
            false;

        state.deleting =
            false;

        state.model =
            null;

        state.modelId =
            null;

    }


    /* =====================================================
       GET STATE
       ===================================================== */

    function getState() {

        return {

            active:
                state.active,

            deleting:
                state.deleting,

            model:
                state.model,

            modelId:
                state.modelId

        };

    }


    /* =====================================================
       CONFIRMATION
       ===================================================== */

    function confirmDelete(
        model,
        options = {}
    ) {

        const target =
            model ||
            state.model;


        if (
            !target ||
            typeof target !== "object"
        ) {

            return false;

        }


        /*
         * Caller dapat menonaktifkan native confirm
         * jika UI sudah menyediakan modal sendiri.
         */
        if (
            options.requireConfirmation ===
                false
        ) {

            return true;

        }


        const modelName =
            getModelName(
                target
            );


        const message =
            options.message ||
            (
                "Hapus model " +
                (
                    modelName ||
                    "ini"
                ) +
                "?\n\n" +
                "Data model akan dihapus dari database."
            );


        /*
         * Environment tanpa window.confirm
         * tidak boleh membuat delete macet.
         */
        if (
            typeof window === "undefined" ||
            typeof window.confirm !== "function"
        ) {

            return true;

        }


        return window.confirm(
            message
        );

    }


    /* =====================================================
       RESOLVE DELETE HANDLER
       ===================================================== */

    function resolveDeleteHandler(
        options = {}
    ) {

        if (
            typeof options.remove ===
                "function"
        ) {

            return options.remove;

        }


        if (
            typeof options.delete ===
                "function"
        ) {

            return options.delete;

        }


        if (
            typeof options.onDelete ===
                "function"
        ) {

            return options.onDelete;

        }


        if (
            typeof options.submit ===
                "function"
        ) {

            return options.submit;

        }


        return null;

    }


    /* =====================================================
       DELETE
       -----------------------------------------------------
       Database operation diserahkan ke callback.

       Tidak:
       - memanggil coordinator
       - memanggil dirinya sendiri
       - melakukan query Supabase
       - melakukan pricing
       - dispatch recursive event
       ===================================================== */

    async function remove(
        model,
        options = {}
    ) {

        if (
            state.deleting
        ) {

            const error =
                new Error(
                    "MODEL_DELETE_IN_PROGRESS"
                );

            error.code =
                "MODEL_DELETE_IN_PROGRESS";

            throw error;

        }


        let target =
            model ||
            state.model;


        /*
         * Jika hanya ID diberikan,
         * resolve menggunakan cache/list model.
         */
        if (
            !target ||
            typeof target !== "object"
        ) {

            target =
                resolveModel(
                    target,
                    options.models
                );

        }


        const errors =
            validateDeleteTarget(
                target,
                options
            );


        if (
            errors.length
        ) {

            throw createValidationError(
                errors
            );

        }


        /*
         * Konfirmasi hanya dijalankan jika
         * caller belum menyatakan confirmed=true.
         */
        if (
            options.confirmed !== true
        ) {

            const confirmed =
                confirmDelete(
                    target,
                    options
                );


            if (!confirmed) {

                return {

                    success:
                        false,

                    cancelled:
                        true,

                    model:
                        target,

                    modelId:
                        getModelId(
                            target
                        )

                };

            }

        }


        const handler =
            resolveDeleteHandler(
                options
            );


        if (!handler) {

            const error =
                new Error(
                    "MODEL_DELETE_HANDLER_MISSING"
                );

            error.code =
                "MODEL_DELETE_HANDLER_MISSING";

            error.model =
                target;

            error.modelId =
                getModelId(
                    target
                );

            throw error;

        }


        /*
         * Ambil database ID satu kali.
         * Ini mencegah identifier berubah
         * selama callback berjalan.
         */
        const databaseId =
            getModelId(
                target
            );


        state.active =
            true;

        state.deleting =
            true;

        state.model =
            target;

        state.modelId =
            databaseId;


        try {

            /*
             * Hanya database ID dikirim sebagai
             * argument utama kepada API/caller.
             *
             * Metadata lengkap tetap tersedia
             * pada argument kedua untuk compatibility.
             */
            const result =
                await handler(
                    databaseId,
                    {
                        mode:
                            "delete",

                        model:
                            target,

                        modelId:
                            databaseId
                    }
                );


            return {

                success:
                    true,

                cancelled:
                    false,

                result,

                model:
                    target,

                modelId:
                    databaseId

            };

        } finally {

            /*
             * Jangan menghapus model/state di sini.
             * Coordinator atau caller masih dapat
             * membaca hasil operasi setelah handler
             * selesai.
             *
             * Hanya flag operasi yang dilepas.
             */
            state.deleting =
                false;

        }

    }


    /* =====================================================
       DELETE BY ID
       ===================================================== */

    async function removeById(
        modelId,
        options = {}
    ) {

        const id =
            normalizeId(
                modelId
            );


        if (!id) {

            const error =
                new Error(
                    "MODEL_ID_REQUIRED"
                );

            error.code =
                "MODEL_ID_REQUIRED";

            throw error;

        }


        const models =
            Array.isArray(
                options.models
            )
                ? options.models
                : [];


        const target =
            resolveModel(
                id,
                models
            );


        /*
         * Bila model tidak ditemukan di cache,
         * tetap izinkan operasi menggunakan database ID.
         *
         * Ini penting agar delete tidak bergantung
         * pada tabel/cache yang kebetulan belum refresh.
         */
        if (!target) {

            return remove(
                {
                    id: id
                },
                {
                    ...options
                }
            );

        }


        return remove(
            target,
            options
        );

    }


    /* =====================================================
       PREPARE DELETE
       ===================================================== */

    function prepareDelete(
        model,
        options = {}
    ) {

        const target =
            resolveModel(
                model,
                options.models
            );


        const errors =
            validateDeleteTarget(
                target,
                options
            );


        if (
            errors.length
        ) {

            throw createValidationError(
                errors
            );

        }


        return {

            id:
                getModelId(
                    target
                ),

            model_id:
                normalizeText(
                    target.model_id
                ),

            model_name:
                getModelName(
                    target
                )

        };

    }


    /* =====================================================
       RESET
       ===================================================== */

    function reset() {

        closeDelete();

    }


    /* =====================================================
       PUBLIC API
       ===================================================== */

    const ModelFormDelete = {

        resolveModel,

        validateDeleteTarget,

        prepareDelete,

        openDelete,

        closeDelete,

        confirmDelete,

        remove,

        removeById,

        reset,

        getState

    };


    /* =====================================================
       GLOBAL COMPATIBILITY
       ===================================================== */

    window.GENZModelFormDelete =
        ModelFormDelete;


    console.info(
        "[GEN-Z.AI] GENZModelFormDelete loaded."
    );


})();
