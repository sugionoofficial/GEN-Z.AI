// admin-control/models/functions/model-form-coordinator.js?v=1352.2
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
   - Setelah mutation berhasil, coordinator meminta UI
     melakukan reload data melalui GENZModelsUI.refreshModels().
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
       CRUD MODULE
       -----------------------------------------------------
       CRUD adalah satu-satunya owner operasi database
       Create / Update / Delete.

       Coordinator hanya menjadi bridge.
       ===================================================== */

    function getCRUD() {

        return (
            window.GENZModelsCRUD ||
            window.GENZModelCRUD ||
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
       ===================================================== */

    function getTableModule() {

        return (
            window.GENZModelsTable ||
            window.GENZModelTable ||
            null
        );

    }


    /* =====================================================
       UI MODULE
       -----------------------------------------------------
       UI adalah owner proses:
       - load model
       - refresh data
       - sync search
       - sync table
       - update statistics
       ===================================================== */

    function getUI() {

        return (
            window.GENZModelsUI ||
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
       RESOLVE CRUD CREATE HANDLER
       -----------------------------------------------------
       Caller callback tetap memiliki prioritas.
       Jika tidak diberikan, gunakan GENZModelsCRUD.
       ===================================================== */

    function resolveCreateHandler(
        options = {}
    ) {

        if (
            typeof options.insert ===
            "function"
        ) {

            return options.insert;

        }


        if (
            typeof options.onSubmit ===
            "function"
        ) {

            return options.onSubmit;

        }


        if (
            typeof options.submit ===
            "function"
        ) {

            return options.submit;

        }


        const crud =
            requireModule(
                getCRUD(),
                "Models CRUD"
            );


        return function (
            preparedData
        ) {

            const handler =
                requireFunction(
                    crud,
                    "create",
                    "Models CRUD"
                );


            return handler.call(
                crud,
                preparedData
            );

        };

    }


    /* =====================================================
       RESOLVE CRUD UPDATE HANDLER
       -----------------------------------------------------
       Caller callback tetap memiliki prioritas.
       Jika tidak diberikan, gunakan GENZModelsCRUD.
       ===================================================== */

    function resolveUpdateHandler(
        options = {}
    ) {

        if (
            typeof options.submit ===
            "function"
        ) {

            return options.submit;

        }


        if (
            typeof options.onSubmit ===
            "function"
        ) {

            return options.onSubmit;

        }


        const crud =
            requireModule(
                getCRUD(),
                "Models CRUD"
            );


        return function (
            preparedData
        ) {

            const handler =
                requireFunction(
                    crud,
                    "update",
                    "Models CRUD"
                );


            return handler.call(
                crud,
                preparedData
            );

        };

    }


    /* =====================================================
       RESOLVE CRUD DELETE HANDLER
       -----------------------------------------------------
       Caller callback tetap memiliki prioritas.
       Jika tidak diberikan, gunakan GENZModelsCRUD.
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
            typeof options.onDelete ===
            "function"
        ) {

            return options.onDelete;

        }


        const crud =
            requireModule(
                getCRUD(),
                "Models CRUD"
            );


        return function (
            databaseId,
            metadata = {}
        ) {

            const handler =
                requireFunction(
                    crud,
                    "remove",
                    "Models CRUD"
                );


            /*
             * Delete module mengirim databaseId
             * sebagai argument pertama.
             *
             * metadata tetap diterima agar kontrak
             * module Delete tidak berubah.
             */

            return handler.call(
                crud,
                databaseId,
                metadata
            );

        };

    }


    /* =====================================================
       CREATE
       ===================================================== */

    async function create(
        data,
        options = {}
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


        const insertHandler =
            resolveCreateHandler(
                options
            );


        /*
         * Hanya delegasi ke owner Create.
         *
         * Create module bertanggung jawab:
         * - normalisasi
         * - validasi
         * - duplicate check
         * - menyiapkan data
         *
         * Setelah itu callback insert
         * meneruskan data ke Models CRUD.
         */

        const result =
            await handler.call(
                module,
                data,
                {
                    ...options,

                    insert:
                        insertHandler
                }
            );


        /*
         * Mutation database sudah berhasil.
         *
         * Bersihkan cache agar load berikutnya
         * tidak menggunakan data lama.
         */

        await invalidateModelCache();


        /*
         * Setelah cache dibersihkan, minta UI
         * mengambil data terbaru dari source of truth.
         *
         * Refresh tidak boleh membuat Create
         * dianggap gagal.
         */

        await refreshModelsUI(
            options
        );


        return result;

    }


    /* =====================================================
       CREATE FROM FORM
       ===================================================== */

    async function createFromForm(
        event = null,
        options = {}
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


        const insertHandler =
            resolveCreateHandler(
                options
            );


        /*
         * Event langsung diteruskan ke owner Create.
         *
         * Coordinator tidak dispatch ulang event.
         */

        const result =
            await handler.call(
                module,
                event,
                {
                    ...options,

                    insert:
                        insertHandler
                }
            );


        /*
         * Create dari form juga harus menghapus
         * cache dan menyegarkan UI.
         */

        await invalidateModelCache();


        await refreshModelsUI(
            options
        );


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
       RESOLVE EDIT ROOT
       -----------------------------------------------------
       Root dapat diberikan melalui:
       - options.root
       - options.container
       - options.formRoot
       - parameter root pada updateFromForm()
       ===================================================== */

    function resolveEditRoot(
        root,
        options = {}
    ) {

        return (
            root ||
            options.root ||
            options.container ||
            options.formRoot ||
            null
        );

    }


    /* =====================================================
       RESOLVE SUBMIT HANDLER
       ===================================================== */

    function resolveEditSubmitHandler(
        options = {}
    ) {

        return resolveUpdateHandler(
            options
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
         * Module Edit baru.
         *
         * submitEditModel() adalah owner proses
         * pengumpulan + validasi + delegasi submit.
         */

        if (
            typeof module.submitEditModel ===
            "function"
        ) {

            const root =
                resolveEditRoot(
                    null,
                    options
                );


            if (root) {

                const submitHandler =
                    resolveEditSubmitHandler(
                        options
                    );


                const result =
                    await module.submitEditModel(
                        root,
                        {
                            ...options,

                            submit:
                                submitHandler
                        }
                    );


                await invalidateModelCache();


                await refreshModelsUI(
                    options
                );


                return result;

            }

        }


        /*
         * PRIORITAS 2:
         * Module Edit lama.
         *
         * Hanya digunakan jika module lama
         * benar-benar menyediakan update().
         */

        if (
            typeof module.update ===
            "function"
        ) {

            const result =
                await module.update(
                    data,
                    {
                        ...options,

                        submit:
                            resolveUpdateHandler(
                                options
                            )
                    }
                );


            await invalidateModelCache();


            await refreshModelsUI(
                options
            );


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
                resolveEditRoot(
                    root,
                    options
                );


            if (!formRoot) {

                throw new Error(
                    "EDIT_FORM_ROOT_MISSING"
                );

            }


            /*
             * Submit otomatis diarahkan ke CRUD
             * jika caller tidak memberikan callback.
             */

            const submitHandler =
                resolveEditSubmitHandler(
                    options
                );


            const result =
                await module.submitEditModel(
                    formRoot,
                    {
                        ...options,

                        root:
                            formRoot,

                        submit:
                            submitHandler
                    }
                );


            await invalidateModelCache();


            await refreshModelsUI(
                options
            );


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
                    root,
                    {
                        ...options,

                        submit:
                            resolveUpdateHandler(
                                options
                            )
                    }
                );


            await invalidateModelCache();


            await refreshModelsUI(
                options
            );


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
                resolveEditRoot(
                    null,
                    options
                );


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
        model,
        options = {}
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


        const removeHandler =
            resolveDeleteHandler(
                options
            );


        const result =
            await handler.call(
                module,
                model,
                {
                    ...options,

                    remove:
                        removeHandler
                }
            );


        await invalidateModelCache();


        await refreshModelsUI(
            options
        );


        return result;

    }


    /* =====================================================
       DELETE BY ID
       ===================================================== */

    async function removeById(
        modelId,
        options = {}
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


        const removeHandler =
            resolveDeleteHandler(
                options
            );


        const result =
            await handler.call(
                module,
                normalizeId(
                    modelId
                ),
                {
                    ...options,

                    remove:
                        removeHandler
                }
            );


        await invalidateModelCache();


        await refreshModelsUI(
            options
        );


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

                /*
                 * Cache gagal dibersihkan tidak boleh
                 * mengubah status mutation database
                 * yang sudah berhasil.
                 */

                console.warn(
                    "[GEN-Z.AI] Gagal clear model cache:",
                    error
                );

            }

        }

    }


    /* =====================================================
       REFRESH MODELS UI
       -----------------------------------------------------
       Ini adalah refresh utama setelah mutation.

       models-ui.js:
       - clear cache
       - loadModels()
       - sync search
       - sync page search
       - sync table
       - update statistics

       Karena itu coordinator tidak melakukan
       query Supabase sendiri.
       ===================================================== */

    async function refreshModelsUI(
        options = {}
    ) {

        /*
         * Caller dapat secara eksplisit mematikan
         * automatic refresh apabila diperlukan untuk
         * workflow khusus.
         */

        if (
            options &&
            options.refresh === false
        ) {

            return null;

        }


        const ui =
            getUI();


        if (
            !ui ||
            typeof ui.refreshModels !==
                "function"
        ) {

            console.warn(
                "[GEN-Z.AI] GENZModelsUI.refreshModels() belum tersedia."
            );


            /*
             * Jangan membuat mutation database
             * dianggap gagal hanya karena UI belum
             * siap melakukan refresh.
             */

            return null;

        }


        try {

            return await ui.refreshModels({

                /*
                 * Halaman Admin Models sebelumnya
                 * memang menggunakan includeInactive=true.
                 */

                includeInactive: true,

                /*
                 * Pertahankan opsi lain yang mungkin
                 * dikirim caller.
                 */

                ...options

            });

        } catch (error) {

            /*
             * Database mutation sudah berhasil.
             * Error refresh UI hanya dicatat sebagai
             * warning agar data tidak dilaporkan gagal
             * padahal sudah tersimpan.
             */

            console.warn(
                "[GEN-Z.AI] Model berhasil diubah, tetapi refresh UI gagal:",
                error
            );


            return null;

        }

    }


    /* =====================================================
       REFRESH TABLE
       -----------------------------------------------------
       Compatibility helper.

       Catatan:
       Fungsi ini bukan source-of-truth reload.
       Untuk mengambil data terbaru dari Supabase,
       gunakan refreshModelsUI().
       ===================================================== */

    async function refreshTable(
        options = {}
    ) {

        /*
         * Prioritaskan Models UI karena module ini
         * yang mengetahui bagaimana data harus
         * di-load dan disinkronkan ke table.
         */

        const uiResult =
            await refreshModelsUI(
                options
            );


        if (
            uiResult !== null
        ) {

            return uiResult;

        }


        /*
         * Compatibility fallback untuk implementasi
         * table lama.
         */

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
       Setelah Create / Update / Delete sukses,
       fungsi utama sudah melakukan:
       
       mutation
        ↓
       invalidate cache
        ↓
       refresh Models UI

       Wrapper ini dipertahankan untuk kompatibilitas
       dengan caller lama.
       ===================================================== */

    async function createAndRefresh(
        data,
        options = {}
    ) {

        /*
         * create() sudah melakukan refresh UI.
         *
         * Jangan melakukan refresh kedua di sini,
         * karena itu hanya akan menghasilkan:
         *
         * Create
         * -> refresh
         * -> refresh lagi
         *
         * yang tidak diperlukan.
         */

        return await create(
            data,
            options
        );

    }


    async function updateAndRefresh(
        data,
        options = {}
    ) {

        /*
         * update() sudah melakukan refresh UI.
         */

        return await update(
            data,
            options
        );

    }


    async function deleteAndRefresh(
        model,
        options = {}
    ) {

        /*
         * remove() sudah melakukan refresh UI.
         */

        return await remove(
            model,
            options
        );

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

            crud:
                getCRUD(),

            data:
                getDataModule(),

            table:
                getTableModule(),

            ui:
                getUI()

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

            crud:
                Boolean(
                    modules.crud
                ),

            data:
                Boolean(
                    modules.data
                ),

            table:
                Boolean(
                    modules.table
                ),

            ui:
                Boolean(
                    modules.ui
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

            refreshModelsUI,

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
