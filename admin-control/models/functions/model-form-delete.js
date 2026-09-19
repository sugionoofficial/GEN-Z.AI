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

   Tidak bertanggung jawab:
   - Render tabel
   - Query Supabase langsung
   - Create model
   - Edit model
   - Render modal
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

        return String(
            value === null ||
            value === undefined
                ? ""
                : value
        ).trim();

    }


    function normalizeText(value) {

        return String(
            value === null ||
            value === undefined
                ? ""
                : value
        ).trim();

    }


    function getModelId(model) {

        if (!model) {
            return "";
        }

        return normalizeId(
            model.id ||
            model.model_id
        );

    }


    function getModelName(model) {

        if (!model) {
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

        if (
            model &&
            typeof model === "object"
        ) {

            if (model.id) {

                return model;

            }

            if (model.model_id) {

                const found =
                    (models || []).find(
                        item =>
                            normalizeText(
                                item.model_id
                            ) ===
                            normalizeText(
                                model.model_id
                            )
                    );

                return found || model;

            }

        }


        const requestedId =
            normalizeId(
                model
            );


        if (!requestedId) {
            return null;
        }


        return (
            models || []
        ).find(
            item =>
                normalizeId(
                    item.id
                ) === requestedId ||
                normalizeText(
                    item.model_id
                ) === requestedId
        ) || null;

    }


    /* =====================================================
       VALIDATE DELETE TARGET
       ===================================================== */

    function validateDeleteTarget(
        model,
        options = {}
    ) {

        const errors = [];


        if (!model) {

            errors.push(
                "Model yang akan dihapus tidak ditemukan."
            );

            return errors;

        }


        const modelId =
            normalizeId(
                model.id
            );


        if (!modelId) {

            errors.push(
                "ID database model tidak ditemukan."
            );

        }


        /*
         * Delete harus menggunakan models.id.
         *
         * model_id adalah identifier API,
         * bukan primary key database.
         */
        if (
            options.requireDatabaseId !== false &&
            !modelId
        ) {

            errors.push(
                "Model tidak memiliki database ID yang valid."
            );

        }


        return errors;

    }


    /* =====================================================
       OPEN DELETE
       ===================================================== */

    function openDelete(
        model,
        options = {}
    ) {

        if (state.deleting) {

            return {
                active: true,
                deleting: true,
                model: state.model,
                modelId: state.modelId
            };

        }


        const resolved =
            resolveModel(
                model,
                options.models || []
            );


        const errors =
            validateDeleteTarget(
                resolved,
                options
            );


        if (errors.length) {

            const error =
                new Error(
                    "MODEL_DELETE_VALIDATION_FAILED"
                );

            error.code =
                "MODEL_DELETE_VALIDATION_FAILED";

            error.errors =
                errors;

            throw error;

        }


        state.active =
            true;

        state.deleting =
            false;

        state.model =
            resolved;

        state.modelId =
            normalizeId(
                resolved.id
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


        if (!target) {

            return false;

        }


        /*
         * Caller dapat mematikan confirm native
         * jika UI sudah mempunyai modal sendiri.
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


        if (
            typeof window.confirm !==
                "function"
        ) {

            return true;

        }


        return window.confirm(
            message
        );

    }


    /* =====================================================
       DELETE
       -----------------------------------------------------
       Database operation diserahkan ke callback.

       Tidak ada fallback ke coordinator.
       Tidak ada dispatch event yang memanggil
       dirinya sendiri.
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
         * Jika hanya ID yang diberikan,
         * coba resolve dari options.models.
         */
        if (
            !target ||
            typeof target !==
                "object"
        ) {

            target =
                resolveModel(
                    target,
                    options.models || []
                );

        }


        const errors =
            validateDeleteTarget(
                target,
                options
            );


        if (errors.length) {

            const error =
                new Error(
                    "MODEL_DELETE_VALIDATION_FAILED"
                );

            error.code =
                "MODEL_DELETE_VALIDATION_FAILED";

            error.errors =
                errors;

            throw error;

        }


        /*
         * Konfirmasi hanya dilakukan jika
         * caller belum melakukan konfirmasi.
         */
        if (
            options.confirmed !==
                true &&
            !confirmDelete(
                target,
                options
            )
        ) {

            return {

                success:
                    false,

                cancelled:
                    true,

                model:
                    target,

                modelId:
                    normalizeId(
                        target.id
                    )

            };

        }


        const handler =
            typeof options.remove ===
                "function"
                ? options.remove
                : typeof options.delete ===
                    "function"
                    ? options.delete
                    : typeof options.onDelete ===
                        "function"
                        ? options.onDelete
                        : typeof options.submit ===
                            "function"
                            ? options.submit
                            : null;


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
                normalizeId(
                    target.id
                );

            throw error;

        }


        state.active =
            true;

        state.deleting =
            true;

        state.model =
            target;

        state.modelId =
            normalizeId(
                target.id
            );


        try {

            /*
             * Hanya database ID yang dikirim sebagai
             * identifier utama.
             */
            const result =
                await handler(
                    state.modelId,
                    {
                        mode:
                            "delete",

                        model:
                            target,

                        modelId:
                            state.modelId
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
                    state.modelId

            };

        } finally {

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
         * Jika model tidak ada di cache,
         * tetap boleh diteruskan bila caller
         * memang hanya membutuhkan database ID.
         */
        if (!target) {

            return remove(
                {
                    id
                },
                {
                    ...options,
                    confirmed:
                        options.confirmed ===
                            true
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
                options.models || []
            );


        const errors =
            validateDeleteTarget(
                target,
                options
            );


        if (errors.length) {

            const error =
                new Error(
                    "MODEL_DELETE_VALIDATION_FAILED"
                );

            error.code =
                "MODEL_DELETE_VALIDATION_FAILED";

            error.errors =
                errors;

            throw error;

        }


        return {

            id:
                normalizeId(
                    target.id
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
