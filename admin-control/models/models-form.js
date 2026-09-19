/* =========================================================
   GEN-Z.AI
   MODELS FORM COMPATIBILITY / BRIDGE
   ---------------------------------------------------------
   File:
   admin-control/models/models-form.js

   Tanggung jawab:
   - Compatibility layer untuk form lama
   - Menjembatani Create / Edit / Delete
   - Delegasi ke module baru
   - Menjaga API lama tetap dapat dipanggil
   - Tidak melakukan query Supabase langsung

   Module utama:
   - GENZModelFormCreate
   - GENZModelFormEdit
   - GENZModelFormDelete
   - GENZModelFormCoordinator
   - GENZModelFormLayout

   Tidak menggunakan:
   - kie_models
   - kie_workflows
   - kie_workflow_variants
   - kie_parameters
   - kie_constraints
   - kie_dependencies
   - kie_pricing

   Catatan:
   File ini sengaja dipertahankan karena beberapa file lama
   masih dapat memanggil GENZModelsForm.
   ========================================================= */

(function () {

    "use strict";


    /* =====================================================
       STATE
       ===================================================== */

    const state = {

        mode:
            "none",

        model:
            null,

        modelId:
            null,

        root:
            null,

        initialized:
            false

    };


    /* =====================================================
       MODULE ACCESS
       ===================================================== */

    function getCreate() {

        return (
            window.GENZModelFormCreate ||
            null
        );

    }


    function getEdit() {

        return (
            window.GENZModelFormEdit ||
            null
        );

    }


    function getDelete() {

        return (
            window.GENZModelFormDelete ||
            null
        );

    }


    function getCoordinator() {

        return (
            window.GENZModelFormCoordinator ||
            null
        );

    }


    function getLayout() {

        return (
            window.GENZModelFormLayout ||
            null
        );

    }


    function getUI() {

        return (
            window.GENZModelsUI ||
            null
        );

    }


    /* =====================================================
       HELPERS
       ===================================================== */

    function normalizeId(
        value
    ) {

        return String(
            value === null ||
            value === undefined
                ? ""
                : value
        ).trim();

    }


    function getElement(
        target
    ) {

        if (!target) {
            return null;
        }


        if (
            typeof target ===
                "string"
        ) {

            return document.querySelector(
                target
            );

        }


        return target;

    }


    function getErrorMessage(
        error,
        fallback
    ) {

        if (!error) {
            return (
                fallback ||
                "Terjadi kesalahan."
            );
        }


        if (
            Array.isArray(
                error.errors
            ) &&
            error.errors.length
        ) {

            return error.errors.join(
                "\n"
            );

        }


        if (
            error.message
        ) {

            return String(
                error.message
            );

        }


        if (
            typeof error ===
                "string"
        ) {

            return error;

        }


        return (
            fallback ||
            "Terjadi kesalahan."
        );

    }


    /* =====================================================
       ALERT
       ===================================================== */

    function showAlert(
        message,
        type = "info"
    ) {

        const ui =
            getUI();


        if (
            ui &&
            typeof ui.showAlert ===
                "function"
        ) {

            return ui.showAlert(
                message,
                type
            );

        }


        if (
            ui &&
            typeof ui.notify ===
                "function"
        ) {

            return ui.notify(
                message,
                type
            );

        }


        /*
         * Compatibility fallback.
         * Tidak melakukan operasi database.
         */
        if (
            type ===
                "error"
        ) {

            console.error(
                "[GEN-Z.AI] " +
                message
            );

        } else {

            console.info(
                "[GEN-Z.AI] " +
                message
            );

        }


        return null;

    }


    /* =====================================================
       ROOT
       ===================================================== */

    function resolveRoot(
        root
    ) {

        if (root) {

            return getElement(
                root
            );

        }


        if (
            state.root
        ) {

            return state.root;

        }


        return (
            document.querySelector(
                "[data-model-form]"
            ) ||

            document.querySelector(
                "#modelForm"
            ) ||

            document.querySelector(
                "#model-form"
            ) ||

            document.querySelector(
                "form[data-model]"
            ) ||

            null
        );

    }


    /* =====================================================
       OPEN CREATE
       ===================================================== */

    function openCreate(
        root,
        options = {}
    ) {

        state.mode =
            "create";

        state.model =
            null;

        state.modelId =
            null;

        state.root =
            resolveRoot(
                root
            );


        const create =
            getCreate();


        if (
            create &&
            typeof create.openCreate ===
                "function"
        ) {

            try {

                create.openCreate(
                    state.root,
                    options
                );

            } catch (error) {

                console.warn(
                    "[GEN-Z.AI] Create module open warning:",
                    error
                );

            }

        }


        const layout =
            getLayout();


        if (
            layout
        ) {

            try {

                if (
                    typeof layout.openCreate ===
                        "function"
                ) {

                    layout.openCreate(
                        state.root,
                        options
                    );

                } else if (
                    typeof layout.renderCreate ===
                        "function"
                ) {

                    layout.renderCreate(
                        state.root,
                        options
                    );

                }

            } catch (error) {

                console.warn(
                    "[GEN-Z.AI] Layout create warning:",
                    error
                );

            }

        }


        return getState();

    }


    /* =====================================================
       OPEN EDIT
       ===================================================== */

    async function openEdit(
        model,
        options = {}
    ) {

        state.mode =
            "edit";

        state.model =
            model || null;

        state.modelId =
            normalizeId(
                model?.id ||
                model?.model_id
            );

        state.root =
            resolveRoot(
                options.root
            );


        const edit =
            getEdit();


        if (
            !edit
        ) {

            throw new Error(
                "GENZModelFormEdit belum tersedia."
            );

        }


        try {

            if (
                typeof edit.openEditModel ===
                    "function"
            ) {

                return await edit.openEditModel(
                    model,
                    {
                        ...options,

                        root:
                            state.root
                    }
                );

            }


            if (
                typeof edit.open ===
                    "function"
            ) {

                return await edit.open(
                    model,
                    {
                        ...options,

                        root:
                            state.root
                    }
                );

            }


            if (
                typeof edit.setEditingModel ===
                    "function"
            ) {

                edit.setEditingModel(
                    model
                );


                return model;

            }


            throw new Error(
                "API edit model tidak tersedia."
            );

        } catch (error) {

            showAlert(
                getErrorMessage(
                    error,
                    "Gagal membuka form edit model."
                ),
                "error"
            );


            throw error;

        }

    }


    /* =====================================================
       CLOSE EDIT
       ===================================================== */

    function closeEdit() {

        const edit =
            getEdit();


        if (
            edit &&
            typeof edit.clearEditingModel ===
                "function"
        ) {

            try {

                edit.clearEditingModel();

            } catch (error) {

                console.warn(
                    "[GEN-Z.AI] clearEditingModel warning:",
                    error
                );

            }

        }


        state.mode =
            "none";

        state.model =
            null;

        state.modelId =
            null;


        return true;

    }


    /* =====================================================
       CLOSE FORM
       ===================================================== */

    function close(
        options = {}
    ) {

        const layout =
            getLayout();


        if (
            layout
        ) {

            try {

                if (
                    typeof layout.close ===
                        "function"
                ) {

                    const result =
                        layout.close(
                            options
                        );


                    if (
                        result !== false
                    ) {

                        state.mode =
                            "none";

                        state.model =
                            null;

                        state.modelId =
                            null;


                        return true;

                    }

                }

            } catch (error) {

                console.warn(
                    "[GEN-Z.AI] Form layout close warning:",
                    error
                );

            }

        }


        const ui =
            getUI();


        if (
            ui &&
            typeof ui.closeModal ===
                "function"
        ) {

            try {

                ui.closeModal();

            } catch (error) {

                console.warn(
                    "[GEN-Z.AI] UI close modal warning:",
                    error
                );

            }

        }


        state.mode =
            "none";

        state.model =
            null;

        state.modelId =
            null;


        return true;

    }


    /* =====================================================
       COLLECT
       ===================================================== */

    function collect(
        root
    ) {

        const target =
            resolveRoot(
                root
            );


        /*
         * Saat edit, module edit memiliki collector
         * sendiri bila tersedia.
         */
        if (
            state.mode ===
                "edit"
        ) {

            const edit =
                getEdit();


            if (
                edit &&
                typeof edit.collectEditData ===
                    "function"
            ) {

                return edit.collectEditData(
                    target
                );

            }

        }


        /*
         * Create collector.
         */
        const create =
            getCreate();


        if (
            create &&
            typeof create.collectFormData ===
                "function"
        ) {

            return create.collectFormData(
                target
            );

        }


        /*
         * Layout compatibility.
         */
        const layout =
            getLayout();


        if (
            layout &&
            typeof layout.collectModelFormData ===
                "function"
        ) {

            return layout.collectModelFormData(
                target
            );

        }


        if (
            layout &&
            typeof layout.collectFormData ===
                "function"
        ) {

            return layout.collectFormData(
                target
            );

        }


        throw new Error(
            "Collector form model tidak tersedia."
        );

    }


    /* =====================================================
       VALIDATE
       ===================================================== */

    function validate(
        data,
        options = {}
    ) {

        const create =
            getCreate();


        if (
            create &&
            typeof create.validateModelData ===
                "function"
        ) {

            return create.validateModelData(
                data,
                options
            );

        }


        const layout =
            getLayout();


        if (
            layout &&
            typeof layout.validateModelFormData ===
                "function"
        ) {

            return layout.validateModelFormData(
                data,
                options
            );

        }


        return [];

    }


    /* =====================================================
       PREPARE CREATE
       ===================================================== */

    function prepareCreate(
        data,
        options = {}
    ) {

        const create =
            getCreate();


        if (
            create &&
            typeof create.prepareCreateData ===
                "function"
        ) {

            return create.prepareCreateData(
                data,
                options
            );

        }


        if (
            create &&
            typeof create.normalizeModelData ===
                "function"
        ) {

            const normalized =
                create.normalizeModelData(
                    data,
                    options
                );


            const errors =
                validate(
                    normalized,
                    options
                );


            if (
                errors.length
            ) {

                const error =
                    new Error(
                        "MODEL_CREATE_VALIDATION_FAILED"
                    );

                error.code =
                    "MODEL_CREATE_VALIDATION_FAILED";

                error.errors =
                    errors;

                throw error;

            }


            return normalized;

        }


        return data;

    }


    /* =====================================================
       CREATE
       ===================================================== */

    async function create(
        data,
        options = {}
    ) {

        const coordinator =
            getCoordinator();


        /*
         * Coordinator adalah owner orchestration.
         * Jangan memanggil dirinya kembali dari callback.
         */
        if (
            coordinator &&
            typeof coordinator.create ===
                "function"
        ) {

            return coordinator.create(
                data,
                options
            );

        }


        const createModule =
            getCreate();


        if (
            createModule &&
            typeof createModule.create ===
                "function"
        ) {

            return createModule.create(
                data,
                options
            );

        }


        throw new Error(
            "Module create model belum tersedia."
        );

    }


    /* =====================================================
       CREATE FROM FORM
       ===================================================== */

    async function createFromForm(
        event = null,
        options = {}
    ) {

        if (
            event &&
            typeof event.preventDefault ===
                "function"
        ) {

            event.preventDefault();

        }


        const createModule =
            getCreate();


        if (
            createModule &&
            typeof createModule.createFromForm ===
                "function"
        ) {

            return createModule.createFromForm(
                event,
                {
                    ...options,

                    root:
                        options.root ||
                        state.root
                }
            );

        }


        const data =
            collect(
                options.root ||
                state.root
            );


        return create(
            data,
            options
        );

    }


    /* =====================================================
       UPDATE
       ===================================================== */

    async function update(
        data,
        options = {}
    ) {

        const coordinator =
            getCoordinator();


        if (
            coordinator &&
            typeof coordinator.update ===
                "function"
        ) {

            return coordinator.update(
                data,
                options
            );

        }


        const edit =
            getEdit();


        if (
            edit &&
            typeof edit.update ===
                "function"
        ) {

            return edit.update(
                data,
                options
            );

        }


        if (
            edit &&
            typeof edit.submitEditModel ===
                "function"
        ) {

            const root =
                options.root ||
                state.root;


            return edit.submitEditModel(
                root,
                {
                    ...options,

                    data
                }
            );

        }


        throw new Error(
            "Module update model belum tersedia."
        );

    }


    /* =====================================================
       UPDATE FROM FORM
       ===================================================== */

    async function updateFromForm(
        event = null,
        options = {}
    ) {

        if (
            event &&
            typeof event.preventDefault ===
                "function"
        ) {

            event.preventDefault();

        }


        const edit =
            getEdit();


        if (
            edit &&
            typeof edit.updateFromForm ===
                "function"
        ) {

            return edit.updateFromForm(
                event,
                {
                    ...options,

                    root:
                        options.root ||
                        state.root
                }
            );

        }


        const data =
            collect(
                options.root ||
                state.root
            );


        return update(
            data,
            options
        );

    }


    /* =====================================================
       DELETE
       ===================================================== */

    async function remove(
        model,
        options = {}
    ) {

        const target =
            model ||
            state.model;


        const coordinator =
            getCoordinator();


        if (
            coordinator &&
            typeof coordinator.remove ===
                "function"
        ) {

            return coordinator.remove(
                target,
                options
            );

        }


        const deleteModule =
            getDelete();


        if (
            deleteModule &&
            typeof deleteModule.remove ===
                "function"
        ) {

            return deleteModule.remove(
                target,
                options
            );

        }


        throw new Error(
            "Module delete model belum tersedia."
        );

    }


    /* =====================================================
       DELETE BY ID
       ===================================================== */

    async function removeById(
        modelId,
        options = {}
    ) {

        const coordinator =
            getCoordinator();


        if (
            coordinator &&
            typeof coordinator.removeById ===
                "function"
        ) {

            return coordinator.removeById(
                modelId,
                options
            );

        }


        const deleteModule =
            getDelete();


        if (
            deleteModule &&
            typeof deleteModule.removeById ===
                "function"
        ) {

            return deleteModule.removeById(
                modelId,
                options
            );

        }


        return remove(
            {
                id:
                    normalizeId(
                        modelId
                    )
            },
            options
        );

    }


    /* =====================================================
       SET MODEL
       ===================================================== */

    function setModel(
        model
    ) {

        state.model =
            model || null;

        state.modelId =
            normalizeId(
                model?.id ||
                model?.model_id
            );


        return state.model;

    }


    /* =====================================================
       GET MODEL
       ===================================================== */

    function getModel() {

        return state.model;

    }


    function getModelId() {

        return state.modelId;

    }


    /* =====================================================
       SET MODE
       ===================================================== */

    function setMode(
        mode
    ) {

        const normalized =
            String(
                mode || "none"
            )
                .trim()
                .toLowerCase();


        if (
            normalized ===
                "create" ||
            normalized ===
                "edit" ||
            normalized ===
                "delete"
        ) {

            state.mode =
                normalized;

        } else {

            state.mode =
                "none";

        }


        return state.mode;

    }


    /* =====================================================
       GET MODE
       ===================================================== */

    function getMode() {

        return state.mode;

    }


    /* =====================================================
       RESET
       ===================================================== */

    function reset() {

        state.mode =
            "none";

        state.model =
            null;

        state.modelId =
            null;

        state.root =
            null;


        const create =
            getCreate();


        if (
            create &&
            typeof create.closeCreate ===
                "function"
        ) {

            try {

                create.closeCreate();

            } catch {
                /* Ignore cleanup failure. */
            }

        }


        const edit =
            getEdit();


        if (
            edit &&
            typeof edit.clearEditingModel ===
                "function"
        ) {

            try {

                edit.clearEditingModel();

            } catch {
                /* Ignore cleanup failure. */
            }

        }


        const deleteModule =
            getDelete();


        if (
            deleteModule &&
            typeof deleteModule.reset ===
                "function"
        ) {

            try {

                deleteModule.reset();

            } catch {
                /* Ignore cleanup failure. */
            }

        }


        return true;

    }


    /* =====================================================
       INITIALIZE
       ===================================================== */

    function initialize(
        options = {}
    ) {

        if (
            options.root
        ) {

            state.root =
                resolveRoot(
                    options.root
                );

        } else {

            state.root =
                resolveRoot();

        }


        state.initialized =
            true;


        return getState();

    }


    /* =====================================================
       GET STATE
       ===================================================== */

    function getState() {

        return {

            mode:
                state.mode,

            model:
                state.model,

            modelId:
                state.modelId,

            root:
                state.root,

            initialized:
                state.initialized

        };

    }


    /* =====================================================
       EVENT HANDLER
       -----------------------------------------------------
       Compatibility untuk script lama yang masih
       memanggil handleSubmit / handleFormSubmit.
       ===================================================== */

    async function handleSubmit(
        event,
        options = {}
    ) {

        if (
            event &&
            typeof event.preventDefault ===
                "function"
        ) {

            event.preventDefault();

        }


        try {

            if (
                state.mode ===
                    "edit"
            ) {

                return await updateFromForm(
                    event,
                    options
                );

            }


            return await createFromForm(
                event,
                options
            );

        } catch (error) {

            showAlert(
                getErrorMessage(
                    error,
                    "Gagal menyimpan model."
                ),
                "error"
            );


            throw error;

        }

    }


    /* =====================================================
       COMPATIBILITY ALIASES
       ===================================================== */

    const api = {

        initialize,

        reset,

        getState,

        setMode,

        getMode,

        setModel,

        getModel,

        getModelId,

        openCreate,

        openEdit,

        closeEdit,

        close,

        collect,

        validate,

        prepareCreate,

        create,

        createFromForm,

        update,

        updateFromForm,

        remove,

        delete:
            remove,

        removeById,

        deleteById:
            removeById,

        handleSubmit,

        submit:
            handleSubmit,

        showAlert

    };


    /* =====================================================
       GLOBAL
       ===================================================== */

    window.GENZModelsForm =
        api;


    /*
     * Beberapa kode lama dapat menggunakan
     * GENZModelForm sebagai nama global.
     */
    window.GENZModelForm =
        api;


    console.info(
        "[GEN-Z.AI] GENZModelsForm compatibility bridge loaded."
    );


})();
