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
   - Menyediakan catalog model DB + registry untuk Create
   - Tidak melakukan query Supabase langsung

   Module utama:
   - GENZModelFormCreate
   - GENZModelFormEdit
   - GENZModelFormDelete
   - GENZModelFormCoordinator
   - GENZModelFormLayout
   - GENZModelsData

   Tidak menggunakan:
   - kie_models
   - kie_workflows
   - kie_workflow_variants
   - kie_parameters
   - kie_constraints
   - kie_dependencies
   - kie_pricing
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
            false,

        /*
         * Catalog terakhir yang dipakai
         * oleh form Create.
         */
        providers:
            [],

        models:
            []

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


    function getData() {

        return (
            window.GENZModelsData ||
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


    function normalizeText(
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
       ARRAY / CATALOG HELPERS
       ===================================================== */

    function normalizeArray(
        value
    ) {

        return Array.isArray(value)
            ? value.filter(Boolean)
            : [];

    }


    function getModelId(
        model
    ) {

        return normalizeId(
            model?.model_id ??
            model?.modelId ??
            model?.id
        );

    }


    function getProviderReference(
        provider
    ) {

        return normalizeId(
            provider?.id ??
            provider?.provider_id ??
            provider?.providerId ??
            provider?.provider_code ??
            provider?.providerCode
        );

    }


    function getProviderCode(
        provider
    ) {

        return normalizeText(
            provider?.provider_id ??
            provider?.providerId ??
            provider?.provider_code ??
            provider?.providerCode ??
            provider?.code
        );

    }


    function getProviderName(
        provider
    ) {

        return normalizeText(
            provider?.provider_name ??
            provider?.providerName ??
            provider?.name
        );

    }


    /*
     * Merge model database + registry.
     *
     * Database model selalu menjadi prioritas.
     * Registry hanya menyediakan catalog teknis
     * untuk model yang belum tersimpan.
     */
    function mergeModelCatalog(
        databaseModels,
        registryModels
    ) {

        const result = [];
        const seen = new Set();

        const databaseList =
            normalizeArray(
                databaseModels
            );

        const registryList =
            normalizeArray(
                registryModels
            );


        /*
         * 1. Database terlebih dahulu.
         */
        databaseList.forEach(
            model => {

                const id =
                    getModelId(
                        model
                    );

                if (!id) {
                    return;
                }

                const key =
                    id.toLowerCase();

                if (
                    seen.has(key)
                ) {
                    return;
                }

                seen.add(key);

                result.push(
                    model
                );

            }
        );


        /*
         * 2. Registry sebagai catalog tambahan.
         */
        registryList.forEach(
            model => {

                const id =
                    getModelId(
                        model
                    );

                if (!id) {
                    return;
                }

                const key =
                    id.toLowerCase();

                if (
                    seen.has(key)
                ) {
                    return;
                }

                seen.add(key);

                result.push(
                    model
                );

            }
        );


        return result;

    }


    /*
     * Merge provider tanpa membuat provider palsu.
     *
     * Provider hanya berasal dari:
     * - provider database
     * - provider object yang memang diberikan registry
     *
     * Tidak membuat GEN-Z.AI / KIE.AI secara hardcoded.
     */
    function mergeProviderCatalog(
        databaseProviders,
        models
    ) {

        const result = [];
        const seen = new Set();


        normalizeArray(
            databaseProviders
        ).forEach(
            provider => {

                const reference =
                    getProviderReference(
                        provider
                    );

                const code =
                    getProviderCode(
                        provider
                    );

                const key =
                    (
                        reference ||
                        code
                    ).toLowerCase();

                if (!key) {
                    return;
                }

                if (
                    seen.has(key)
                ) {
                    return;
                }

                seen.add(key);

                result.push(
                    provider
                );

            }
        );


        /*
         * Registry provider hanya dipakai jika
         * model registry memang membawa informasi
         * provider tersebut.
         */
        normalizeArray(
            models
        ).forEach(
            model => {

                const provider =
                    model?.provider;

                if (
                    !provider ||
                    typeof provider !==
                        "object"
                ) {
                    return;
                }

                const reference =
                    getProviderReference(
                        provider
                    );

                const code =
                    getProviderCode(
                        provider
                    );

                const name =
                    getProviderName(
                        provider
                    );

                const key =
                    (
                        reference ||
                        code ||
                        name
                    ).toLowerCase();

                if (!key) {
                    return;
                }

                if (
                    seen.has(key)
                ) {
                    return;
                }

                seen.add(key);

                result.push(
                    provider
                );

            }
        );


        return result;

    }


    /*
     * Ambil provider dari model registry bila
     * model hanya membawa provider_id / provider_code.
     *
     * Tidak membuat provider baru.
     */
    function attachProviderObjects(
        models,
        providers
    ) {

        const providerList =
            normalizeArray(
                providers
            );


        return normalizeArray(
            models
        ).map(
            model => {

                if (
                    model?.provider &&
                    typeof model.provider ===
                        "object"
                ) {
                    return model;
                }


                const providerId =
                    normalizeId(
                        model?.provider_id ??
                        model?.providerId ??
                        model?.provider_uuid ??
                        model?.providerUuid
                    );

                const providerCode =
                    normalizeText(
                        model?.provider_code ??
                        model?.providerCode
                    );


                let provider =
                    null;


                if (
                    providerId
                ) {

                    provider =
                        providerList.find(
                            item => {

                                const id =
                                    normalizeId(
                                        item?.id
                                    );

                                const code =
                                    normalizeText(
                                        item?.provider_id ??
                                        item?.providerId ??
                                        item?.provider_code ??
                                        item?.providerCode ??
                                        item?.code
                                    );

                                return (
                                    id ===
                                        providerId ||
                                    code ===
                                        providerId
                                );

                            }
                        ) ||
                        null;

                }


                if (
                    !provider &&
                    providerCode
                ) {

                    provider =
                        providerList.find(
                            item => {

                                const code =
                                    normalizeText(
                                        item?.provider_id ??
                                        item?.providerId ??
                                        item?.provider_code ??
                                        item?.providerCode ??
                                        item?.code
                                    );

                                return (
                                    code.toLowerCase() ===
                                    providerCode.toLowerCase()
                                );

                            }
                        ) ||
                        null;

                }


                if (!provider) {
                    return model;
                }


                return {
                    ...model,

                    provider,

                    provider_name:
                        model?.provider_name ||
                        model?.providerName ||
                        getProviderName(
                            provider
                        ),

                    provider_code:
                        model?.provider_code ||
                        model?.providerCode ||
                        getProviderCode(
                            provider
                        )
                };

            }
        );

    }


    /* =====================================================
       LOAD CREATE CATALOG
       ===================================================== */

    function loadCreateCatalog(
        providers = [],
        models = []
    ) {

        const data =
            getData();


        /*
         * Catalog awal berasal dari caller.
         */
        const databaseProviders =
            normalizeArray(
                providers
            );

        const databaseModels =
            normalizeArray(
                models
            );


        /*
         * Jika data module belum tersedia,
         * jangan membuat data palsu.
         */
        if (!data) {

            const finalModels =
                attachProviderObjects(
                    databaseModels,
                    databaseProviders
                );

            const finalProviders =
                mergeProviderCatalog(
                    databaseProviders,
                    finalModels
                );

            return {
                providers:
                    finalProviders,

                models:
                    finalModels
            };

        }


        /*
         * Registry loader.
         */
        let registryResult =
            [];


        if (
            typeof data.loadRegistryModels ===
                "function"
        ) {

            try {

                registryResult =
                    data.loadRegistryModels();

            } catch (error) {

                console.warn(
                    "[GEN-Z.AI] Registry model loader warning:",
                    error
                );

                registryResult =
                    [];

            }

        }


        /*
         * loadRegistryModels() pada architecture
         * saat ini dapat mengembalikan Promise.
         *
         * Jika synchronous, langsung digunakan.
         * Jika Promise, caller akan melakukan
         * refresh asynchronous.
         */
        if (
            registryResult &&
            typeof registryResult.then ===
                "function"
        ) {

            return Promise.resolve(
                registryResult
            )
                .then(
                    registryModels => {

                        const mergedModels =
                            mergeModelCatalog(
                                databaseModels,
                                registryModels
                            );

                        const finalProviders =
                            mergeProviderCatalog(
                                databaseProviders,
                                mergedModels
                            );

                        const finalModels =
                            attachProviderObjects(
                                mergedModels,
                                finalProviders
                            );

                        return {
                            providers:
                                finalProviders,

                            models:
                                finalModels
                        };

                    }
                )
                .catch(
                    error => {

                        console.warn(
                            "[GEN-Z.AI] Registry catalog warning:",
                            error
                        );


                        const finalModels =
                            attachProviderObjects(
                                databaseModels,
                                databaseProviders
                            );

                        const finalProviders =
                            mergeProviderCatalog(
                                databaseProviders,
                                finalModels
                            );

                        return {
                            providers:
                                finalProviders,

                            models:
                                finalModels
                        };

                    }
                );

        }


        /*
         * Synchronous registry.
         */
        const mergedModels =
            mergeModelCatalog(
                databaseModels,
                registryResult
            );

        const finalProviders =
            mergeProviderCatalog(
                databaseProviders,
                mergedModels
            );

        const finalModels =
            attachProviderObjects(
                mergedModels,
                finalProviders
            );


        return {
            providers:
                finalProviders,

            models:
                finalModels
        };

    }


    /*
     * Simpan catalog ke state.
     */
    function setCatalog(
        catalog
    ) {

        const safeCatalog =
            catalog || {};


        state.providers =
            normalizeArray(
                safeCatalog.providers
            );

        state.models =
            normalizeArray(
                safeCatalog.models
            );


        return {
            providers:
                state.providers,

            models:
                state.models
        };

    }


    /*
     * Render ulang form setelah registry
     * selesai dimuat.
     *
     * Tidak membuka modal kedua kali.
     */
    function refreshCreateCatalog(
        catalog,
        options = {}
    ) {

        const normalized =
            setCatalog(
                catalog
            );


        const layout =
            getLayout();


        if (
            !layout ||
            typeof layout.renderModelForm !==
                "function"
        ) {

            return normalized;

        }


        const root =
            state.root;


        if (!root) {
            return normalized;
        }


        /*
         * Jangan memilih provider secara paksa.
         *
         * Jika caller memang memberikan providerId,
         * gunakan itu.
         */
        const requestedProviderId =
            normalizeId(
                options.providerId ??
                options.provider_id ??
                ""
            );


        layout.renderModelForm(

            root,

            null,

            normalized.providers,

            {
                ...options,

                models:
                    normalized.models,

                mode:
                    "create",

                create:
                    true,

                providerId:
                    requestedProviderId

            }

        );


        if (
            typeof layout.attachModelFormEvents ===
                "function"
        ) {

            layout.attachModelFormEvents(

                root,

                normalized.models,

                normalized.providers,

                {
                    ...options,

                    models:
                        normalized.models,

                    mode:
                        "create",

                    create:
                        true,

                    providerId:
                        requestedProviderId

                }

            );

        }


        return normalized;

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
       MODAL EVENTS
       ===================================================== */

    function bindModalEvents() {

        const modal =
            document.getElementById(
                "modelModal"
            );

        if (!modal) {
            return false;
        }


        if (
            modal.dataset
                .modelCloseEventsAttached ===
            "true"
        ) {

            return true;

        }


        const closeButton =
            document.getElementById(
                "closeModalBtn"
            );

        const cancelButton =
            document.getElementById(
                "cancelModalBtn"
            );


        if (closeButton) {

            closeButton.addEventListener(
                "click",
                function (event) {

                    event.preventDefault();

                    close();

                }
            );

        }


        if (cancelButton) {

            cancelButton.addEventListener(
                "click",
                function (event) {

                    event.preventDefault();

                    close();

                }
            );

        }


        modal.addEventListener(
            "click",
            function (event) {

                if (
                    event.target ===
                    modal
                ) {

                    close();

                }

            }
        );


        document.addEventListener(
            "keydown",
            function (event) {

                if (
                    event.key ===
                    "Escape"
                ) {

                    const isVisible =
                        modal.classList.contains(
                            "show"
                        );

                    if (isVisible) {

                        close();

                    }

                }

            }
        );


        modal.dataset
            .modelCloseEventsAttached =
            "true";


        return true;

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


        const suppliedProviders =
            Array.isArray(
                options.providers
            )
                ? options.providers
                : [];


        const suppliedModels =
            Array.isArray(
                options.models
            )
                ? options.models
                : [];


        /*
         * Simpan catalog awal.
         */
        setCatalog({

            providers:
                suppliedProviders,

            models:
                suppliedModels

        });


        /*
         * Sinkronkan Create module
         * dengan catalog awal.
         */
        const create =
            getCreate();


        if (
            create &&
            typeof create.openCreate ===
                "function"
        ) {

            create.openCreate({

                root:
                    state.root,

                providers:
                    state.providers,

                models:
                    state.models

            });

        }


        /*
         * Render awal.
         */
        const layout =
            getLayout();


        if (
            !layout ||
            typeof layout.renderModelForm !==
                "function"
        ) {

            throw new Error(
                "GENZModelFormLayout.renderModelForm() belum tersedia."
            );

        }


        /*
         * Provider default TIDAK dipaksa.
         *
         * Jika caller memberikan providerId,
         * gunakan provider tersebut.
         *
         * Jika kosong, select harus berada pada
         * placeholder "Pilih provider...".
         */
        const requestedProviderId =
            normalizeId(
                options.providerId ??
                options.provider_id ??
                ""
            );


        layout.renderModelForm(

            state.root,

            null,

            state.providers,

            {
                ...options,

                models:
                    state.models,

                mode:
                    "create",

                create:
                    true,

                providerId:
                    requestedProviderId

            }

        );


        /*
         * Pasang event form.
         */
        if (
            typeof layout.attachModelFormEvents ===
                "function"
        ) {

            layout.attachModelFormEvents(

                state.root,

                state.models,

                state.providers,

                {
                    ...options,

                    models:
                        state.models,

                    mode:
                        "create",

                    create:
                        true,

                    providerId:
                        requestedProviderId

                }

            );

        }


        if (state.root) {

            const form =
                state.root;

            form.dataset.modelFormMode =
                "create";

            delete form.dataset.modelId;

        }


        bindModalEvents();


        /*
         * Buka modal.
         */
        const modal =
            document.getElementById(
                "modelModal"
            );

        if (modal) {

            modal.classList.add(
                "show"
            );

            modal.setAttribute(
                "aria-hidden",
                "false"
            );

            document.body.classList.add(
                "modal-open"
            );

        }


        /*
         * Judul modal.
         */
        const title =
            document.getElementById(
                "modalTitle"
            );

        if (title) {

            title.textContent =
                "Tambah Model";

        }


        /*
         * Fokus awal.
         */
        window.setTimeout(
            function () {

                const provider =
                    document.getElementById(
                        "providerId"
                    );

                if (
                    provider &&
                    typeof provider.focus ===
                        "function"
                ) {

                    provider.focus();

                }

            },
            50
        );


        /*
         * =================================================
         * LOAD REGISTRY CATALOG
         * =================================================
         *
         * Ini bagian penting untuk Seedance.
         *
         * Model database tetap dipakai.
         * Registry hanya ditambahkan sebagai catalog
         * model yang bisa dipilih saat Create.
         */
        const catalogResult =
            loadCreateCatalog(
                suppliedProviders,
                suppliedModels
            );


        if (
            catalogResult &&
            typeof catalogResult.then ===
                "function"
        ) {

            catalogResult.then(
                catalog => {

                    /*
                     * Jangan render ulang jika modal
                     * sudah ditutup / pindah ke Edit.
                     */
                    if (
                        state.mode !==
                            "create"
                    ) {

                        return;

                    }


                    refreshCreateCatalog(
                        catalog,
                        options
                    );


                    /*
                     * Pastikan Create module juga
                     * mendapat catalog terbaru.
                     */
                    const createModule =
                        getCreate();


                    if (
                        createModule &&
                        typeof createModule.openCreate ===
                            "function"
                    ) {

                        try {

                            createModule.openCreate({

                                root:
                                    state.root,

                                providers:
                                    state.providers,

                                models:
                                    state.models

                            });

                        } catch (error) {

                            console.warn(
                                "[GEN-Z.AI] Create catalog refresh warning:",
                                error
                            );

                        }

                    }

                }
            );

        } else {

            refreshCreateCatalog(
                catalogResult,
                options
            );

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


        if (!edit) {

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

        const modal =
            document.getElementById(
                "modelModal"
            );

        if (modal) {

            modal.classList.remove(
                "show"
            );

            modal.setAttribute(
                "aria-hidden",
                "true"
            );

        }

        document.body.classList.remove(
            "modal-open"
        );


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


            const validation =
                validate(
                    normalized,
                    options
                );


            /*
             * Compatibility:
             * beberapa create module mengembalikan
             * array error, beberapa object.
             */
            const errors =
                Array.isArray(
                    validation
                )
                    ? validation
                    : (
                        Array.isArray(
                            validation?.errors
                        )
                            ? validation.errors
                            : []
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


    const coordinator =
        getCoordinator();


    if (
        coordinator &&
        typeof coordinator.createFromForm ===
            "function"
    ) {

        return await coordinator.createFromForm(
            event,
            {
                ...options,

                root:
                    options.root ||
                    state.root
            }
        );

    }


    const createModule =
        getCreate();


    if (
        createModule &&
        typeof createModule.createFromForm ===
            "function"
    ) {

        return await createModule.createFromForm(
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


    return await create(
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
       GET CATALOG
       ===================================================== */

    function getCatalog() {

        return {

            providers:
                state.providers,

            models:
                state.models

        };

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

        state.providers =
            [];

        state.models =
            [];


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
                state.initialized,

            providers:
                state.providers,

            models:
                state.models

        };

    }


    /* =====================================================
       EVENT HANDLER
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

        getCatalog,

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


    window.GENZModelForm =
        api;


    console.info(
        "[GEN-Z.AI] GENZModelsForm compatibility bridge loaded."
    );


})();
