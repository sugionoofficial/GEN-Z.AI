/* =========================================================
   GEN-Z.AI
   MODEL FORM COORDINATOR
   ---------------------------------------------------------
   File:
   admin-control/models/functions/model-form-coordinator.js

   Tanggung jawab:
   - Menjadi satu pintu operasi CRUD Model
   - Menghubungkan Create Model
   - Menghubungkan Edit Model
   - Menghubungkan Delete Model
   - Menjaga pemisahan owner setiap module
   - Menjadi bridge antara UI/Event dan module CRUD

   Tidak bertanggung jawab:
   - Query Supabase langsung
   - Render form
   - Render table
   - Provider dropdown
   - Model search
   - Price calculation
   - Event listener tombol
   - Data KIE
   - kie_* tables
   - Pricing legacy credit_cost / credit_final

   PENTING:
   - Tidak memanggil coordinator dari dirinya sendiri.
   - Tidak dispatch event CRUD dari dalam fungsi CRUD.
   - Tidak membuat recursive create/edit/delete.
   - Tidak menghitung pricing.
   ========================================================= */

(function (window) {

    "use strict";


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


    /* =====================================================
       DATA MODULE
       ===================================================== */

    function getDataModule() {

        return (
            window.GENZModelsData ||
            null
        );

    }


    /* =====================================================
       TABLE MODULE
       -----------------------------------------------------
       Nama plural adalah nama utama yang digunakan oleh
       models-init.js.

       Nama singular dipertahankan sebagai compatibility
       fallback agar module lama tidak rusak.
       ===================================================== */

    function getTableModule() {

        return (
            window.GENZModelsTable ||
            window.GENZModelTable ||
            null
        );

    }


    /* =====================================================
       REQUIRE MODULE
       ===================================================== */

    function requireModule(
        module,
        name
    ) {

        if (!module) {

            throw new Error(
                "Module " +
                name +
                " belum tersedia."
            );

        }

        return module;

    }


    /* =====================================================
       REQUIRE FUNCTION
       ===================================================== */

    function requireFunction(
        module,
        functionName,
        moduleName
    ) {

        if (
            !module ||
            typeof module[functionName] !==
                "function"
        ) {

            throw new Error(
                "Fungsi " +
                functionName +
                " pada Module " +
                moduleName +
                " belum tersedia."
            );

        }

        return module[
            functionName
        ];

    }


    /* =====================================================
       NORMALIZE ID
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


    /* =====================================================
       MODEL ID RESOLVER
       ===================================================== */

    function getModelRecordId(
        model
    ) {

        if (
            typeof model ===
            "string" ||
            typeof model ===
            "number"
        ) {

            return normalizeId(
                model
            );

        }

        if (
            !model ||
            typeof model !==
                "object"
        ) {

            return "";

        }

        /*
         * Record ID database.
         *
         * model_id adalah business/model identifier,
         * bukan pengganti record id apabila keduanya
         * tersedia.
         */
        return normalizeId(
            model.id ||
            model.model_id_record ||
            ""
        );

    }


    /* =====================================================
       CREATE
       ===================================================== */

    async function create(
        data
    ) {

        const module =
            requireModule(
                getCreate(),
                "Create Model"
            );

        const handler =
            requireFunction(
                module,
                "create",
                "Create Model"
            );

        /*
         * Hanya delegasi.
         *
         * Tidak memanggil coordinator lagi.
         */
        const result =
            await handler.call(
                module,
                data
            );

        await invalidateModelCache();

        return result;

    }


    /* =====================================================
       CREATE FROM FORM
       ===================================================== */

    async function createFromForm(
        event = null
    ) {

        const module =
            requireModule(
                getCreate(),
                "Create Model"
            );

        const handler =
            requireFunction(
                module,
                "createFromForm",
                "Create Model"
            );

        /*
         * Event langsung diteruskan ke owner Create.
         *
         * Coordinator tidak dispatch ulang event.
         */
        const result =
            await handler.call(
                module,
                event
            );

        await invalidateModelCache();

        return result;

    }


    /* =====================================================
       EDIT: OPEN
       ===================================================== */

    async function openEdit(
        modelOrId,
        options = {}
    ) {

        const module =
            requireModule(
                getEdit(),
                "Edit Model"
            );

        /*
         * Modul baru menyediakan
         * openEditModel().
         */
        if (
            typeof module.openEditModel ===
            "function"
        ) {

            return module.openEditModel(
                options.root ||
                options.container ||
                options.formRoot,
                modelOrId,
                options
            );

        }


        /*
         * Compatibility dengan module lama.
         */
        if (
            typeof module.populate ===
            "function"
        ) {

            return module.populate(
                modelOrId
            );

        }


        if (
            typeof module.resolveModelForEdit ===
            "function"
        ) {

            return module.resolveModelForEdit(
                modelOrId,
                options
            );

        }


        throw new Error(
            "Module Edit Model tidak memiliki fungsi openEditModel/populate."
        );

    }


    /* =====================================================
       EDIT: PREPARE
       ===================================================== */

    function prepareEdit(
        root,
        options = {}
    ) {

        const module =
            requireModule(
                getEdit(),
                "Edit Model"
            );

        if (
            typeof module.prepareEditSubmission ===
            "function"
        ) {

            return module.prepareEditSubmission(
                root,
                options
            );

        }


        /*
         * Compatibility lama.
         */
        if (
            typeof module.collectEditData ===
            "function"
        ) {

            return module.collectEditData(
                root
            );

        }


        if (
            typeof module.collectFormData ===
            "function"
        ) {

            return module.collectFormData();

        }


        throw new Error(
            "Module Edit Model tidak memiliki fungsi prepareEditSubmission."
        );

    }


    /* =====================================================
       EDIT: UPDATE DIRECT
       ===================================================== */

    async function update(
        data,
        options = {}
    ) {

        const module =
            requireModule(
                getEdit(),
                "Edit Model"
            );

        /*
         * PRIORITAS 1:
         * Module baru.
         *
         * Jika ada submit handler dari caller,
         * gunakan handler tersebut.
         */
        if (
            typeof module.submitEditModel ===
                "function" &&
            options.root
        ) {

            const submit =
                typeof options.submit ===
                    "function"
                    ? options.submit
                    : typeof options.onSubmit ===
                        "function"
                        ? options.onSubmit
                        : null;

            if (submit) {

                const result =
                    await module.submitEditModel(
                        options.root,
                        {
                            ...options,
                            submit
                        }
                    );

                await invalidateModelCache();

                return result;

            }

        }


        /*
         * PRIORITAS 2:
         * Module Edit lama.
         *
         * Hanya dipakai jika fungsi update
         * memang benar-benar dimiliki Edit module.
         */
        if (
            typeof module.update ===
            "function"
        ) {

            const result =
                await module.update(
                    data
                );

            await invalidateModelCache();

            return result;

        }


        /*
         * Jangan fallback ke coordinator sendiri.
         *
         * Ini mencegah:
         *
         * coordinator.update()
         * -> coordinator.update()
         * -> coordinator.update()
         *
         * yang berujung Maximum call stack size exceeded.
         */
        throw new Error(
            "Module Edit Model tidak menyediakan fungsi update atau submitEditModel."
        );

    }


    /* =====================================================
       EDIT FROM FORM
       ===================================================== */

    async function updateFromForm(
        root,
        options = {}
    ) {

        const module =
            requireModule(
                getEdit(),
                "Edit Model"
            );

        /*
         * Module baru.
         */
        if (
            typeof module.submitEditModel ===
                "function"
        ) {

            const formRoot =
                root ||
                options.root ||
                options.container ||
                options.formRoot;

            if (!formRoot) {

                throw new Error(
                    "EDIT_FORM_ROOT_MISSING"
                );

            }

            /*
             * Submit harus diberikan oleh caller.
             *
             * Coordinator sendiri tidak melakukan
             * database update.
             */
            const submitHandler =
                typeof options.submit ===
                    "function"
                    ? options.submit
                    : typeof options.onSubmit ===
                        "function"
                        ? options.onSubmit
                        : null;

            if (!submitHandler) {

                /*
                 * Jangan membuat fallback recursive.
                 */
                throw new Error(
                    "EDIT_SUBMIT_HANDLER_MISSING"
                );

            }

            const result =
                await module.submitEditModel(
                    formRoot,
                    {
                        ...options,
                        submit:
                            submitHandler
                    }
                );

            await invalidateModelCache();

            return result;

        }


        /*
         * Module lama.
         */
        if (
            typeof module.updateFromForm ===
            "function"
        ) {

            const result =
                await module.updateFromForm(
                    root
                );

            await invalidateModelCache();

            return result;

        }


        /*
         * Jangan pernah melakukan:
         *
         * updateFromForm()
         * -> coordinator.update()
         * -> updateFromForm()
         *
         * karena itu sumber stack overflow.
         */
        throw new Error(
            "Module Edit Model tidak menyediakan updateFromForm."
        );

    }


    /* =====================================================
       EDIT: POPULATE
       ===================================================== */

    async function populateEdit(
        model,
        options = {}
    ) {

        const module =
            requireModule(
                getEdit(),
                "Edit Model"
            );

        /*
         * Module baru.
         */
        if (
            typeof module.openEditModel ===
            "function"
        ) {

            const root =
                options.root ||
                options.container ||
                options.formRoot;

            if (root) {

                return module.openEditModel(
                    root,
                    model,
                    options
                );

            }

        }


        /*
         * Compatibility module lama.
         */
        if (
            typeof module.populate ===
            "function"
        ) {

            return module.populate(
                model
            );

        }


        /*
         * Resolve model saja apabila belum ada
         * root render.
         */
        if (
            typeof module.resolveModelForEdit ===
            "function"
        ) {

            return module.resolveModelForEdit(
                model,
                options
            );

        }


        throw new Error(
            "Module Edit Model tidak menyediakan populate/openEditModel."
        );

    }


    /* =====================================================
       CLOSE EDIT
       ===================================================== */

    function closeEdit() {

        const module =
            getEdit();

        if (!module) {
            return null;
        }


        if (
            typeof module.closeEditModel ===
            "function"
        ) {

            return module.closeEditModel();

        }


        if (
            typeof module.clearEditingModel ===
            "function"
        ) {

            return module.clearEditingModel();

        }


        return null;

    }


    /* =====================================================
       DELETE
       ===================================================== */

    async function remove(
        model
    ) {

        const module =
            requireModule(
                getDelete(),
                "Delete Model"
            );

        const handler =
            requireFunction(
                module,
                "remove",
                "Delete Model"
            );

        const result =
            await handler.call(
                module,
                model
            );

        await invalidateModelCache();

        return result;

    }


    /* =====================================================
       DELETE BY ID
       ===================================================== */

    async function removeById(
        modelId
    ) {

        const module =
            requireModule(
                getDelete(),
                "Delete Model"
            );

        const handler =
            requireFunction(
                module,
                "removeById",
                "Delete Model"
            );

        const result =
            await handler.call(
                module,
                normalizeId(
                    modelId
                )
            );

        await invalidateModelCache();

        return result;

    }


    /* =====================================================
       CACHE INVALIDATION
       ===================================================== */

    async function invalidateModelCache() {

        const data =
            getDataModule();

        if (!data) {
            return;
        }


        /*
         * models-data.js memiliki clearCache().
         */
        if (
            typeof data.clearCache ===
            "function"
        ) {

            try {

                await data.clearCache();

            } catch (error) {

                console.warn(
                    "[GEN-Z.AI] Gagal clear model cache:",
                    error
                );

            }

        }

    }


    /* =====================================================
       REFRESH TABLE
       ===================================================== */

    async function refreshTable(
        options = {}
    ) {

        const table =
            getTableModule();

        if (!table) {
            return null;
        }


        const candidates = [
            "refresh",
            "reload",
            "load",
            "render"
        ];


        for (
            const functionName
            of candidates
        ) {

            if (
                typeof table[
                    functionName
                ] !==
                "function"
            ) {

                continue;

            }


            try {

                return await table[
                    functionName
                ](
                    options
                );

            } catch (error) {

                /*
                 * Jika fungsi tersedia tetapi
                 * membutuhkan signature berbeda,
                 * lanjutkan ke candidate berikutnya.
                 */
                console.warn(
                    "[GEN-Z.AI] Table refresh warning:",
                    functionName,
                    error
                );

            }

        }


        return null;

    }


    /* =====================================================
       CRUD OPERATION WRAPPERS
       -----------------------------------------------------
       Wrapper ini tidak otomatis refresh UI kecuali
       caller secara eksplisit memberikan:

       {
           refresh: true
       }

       Hal ini mencegah siklus:

       CRUD
        ↓
       refresh
        ↓
       render
        ↓
       event
        ↓
       CRUD
       ===================================================== */

    async function createAndRefresh(
        data,
        options = {}
    ) {

        const result =
            await create(
                data
            );

        if (
            options.refresh ===
            true
        ) {

            await refreshTable(
                options
            );

        }

        return result;

    }


    async function updateAndRefresh(
        data,
        options = {}
    ) {

        const result =
            await update(
                data,
                options
            );

        if (
            options.refresh ===
            true
        ) {

            await refreshTable(
                options
            );

        }

        return result;

    }


    async function deleteAndRefresh(
        model,
        options = {}
    ) {

        const result =
            await remove(
                model
            );

        if (
            options.refresh ===
            true
        ) {

            await refreshTable(
                options
            );

        }

        return result;

    }


    /* =====================================================
       OPERATION LOCK
       -----------------------------------------------------
       Mencegah double-click melakukan dua operasi
       database secara bersamaan.
       ===================================================== */

    const operationLocks =
        new Map();


    function lock(
        operation,
        id = "global"
    ) {

        const key =
            operation +
            ":" +
            normalizeId(
                id
            );


        if (
            operationLocks.has(
                key
            )
        ) {

            return null;

        }


        const token = {
            key,
            createdAt:
                Date.now()
        };


        operationLocks.set(
            key,
            token
        );


        return token;

    }


    function unlock(
        token
    ) {

        if (!token) {
            return;
        }


        const current =
            operationLocks.get(
                token.key
            );


        if (
            current === token
        ) {

            operationLocks.delete(
                token.key
            );

        }

    }


    /* =====================================================
       LOCKED CREATE
       ===================================================== */

    async function safeCreate(
        data,
        options = {}
    ) {

        const token =
            lock(
                "create"
            );

        if (!token) {

            return null;

        }


        try {

            return await createAndRefresh(
                data,
                options
            );

        } finally {

            unlock(
                token
            );

        }

    }


    /* =====================================================
       LOCKED UPDATE
       ===================================================== */

    async function safeUpdate(
        data,
        options = {}
    ) {

        const id =
            getModelRecordId(
                data
            );


        const token =
            lock(
                "update",
                id
            );

        if (!token) {

            return null;

        }


        try {

            return await updateAndRefresh(
                data,
                options
            );

        } finally {

            unlock(
                token
            );

        }

    }


    /* =====================================================
       LOCKED DELETE
       ===================================================== */

    async function safeDelete(
        model,
        options = {}
    ) {

        const id =
            getModelRecordId(
                model
            );


        const token =
            lock(
                "delete",
                id
            );

        if (!token) {

            return null;

        }


        try {

            return await deleteAndRefresh(
                model,
                options
            );

        } finally {

            unlock(
                token
            );

        }

    }


    /* =====================================================
       MODULE STATUS
       ===================================================== */

    function getModules() {

        return {

            create:
                getCreate(),

            edit:
                getEdit(),

            delete:
                getDelete(),

            data:
                getDataModule(),

            table:
                getTableModule()

        };

    }


    function status() {

        const modules =
            getModules();


        return {

            create:
                Boolean(
                    modules.create
                ),

            edit:
                Boolean(
                    modules.edit
                ),

            delete:
                Boolean(
                    modules.delete
                ),

            data:
                Boolean(
                    modules.data
                ),

            table:
                Boolean(
                    modules.table
                )

        };

    }


    /* =====================================================
       DEBUG
       ===================================================== */

    function getOperationLocks() {

        return Array.from(
            operationLocks.entries()
        ).map(
            function ([
                key,
                value
            ]) {

                return {

                    key,

                    createdAt:
                        value.createdAt

                };

            }
        );

    }


    /* =====================================================
       PUBLIC API
       ===================================================== */

    window.GENZModelFormCoordinator =
        Object.freeze({

            /* =========================
               CREATE
            ========================= */

            create,

            createFromForm,

            safeCreate,


            /* =========================
               EDIT
            ========================= */

            openEdit,

            populateEdit,

            prepareEdit,

            update,

            updateFromForm,

            safeUpdate,

            closeEdit,


            /* =========================
               DELETE
            ========================= */

            remove,

            removeById,

            safeDelete,


            /* =========================
               UI
            ========================= */

            refreshTable,

            createAndRefresh,

            updateAndRefresh,

            deleteAndRefresh,


            /* =========================
               DIAGNOSTICS
            ========================= */

            getModules,

            status,

            getOperationLocks,

            invalidateModelCache

        });


    /* =====================================================
       LOG
    ===================================================== */

    console.info(
        "[GEN-Z.AI] GENZModelFormCoordinator loaded."
    );


})(window);
