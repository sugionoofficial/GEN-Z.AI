/* =========================================================
   GEN-Z.AI
   ADMIN MODEL MANAGEMENT
   UI MODULE
   ---------------------------------------------------------
   File:
   admin-control/models/models-ui.js

   Tanggung jawab:
   - UI state
   - Notification / alert
   - Modal orchestration
   - Sinkronisasi catalog
   - Sinkronisasi provider
   - Statistics
   - Refresh
   - Tombol Add / Refresh
   - Delegasi Create / Edit / Delete

   Tidak bertanggung jawab:
   - Query Supabase
   - Provider CRUD
   - Model CRUD database
   - Search logic
   - Table rendering logic
   - Price calculation logic

   Arsitektur:
   GENZModelsData
        ↓
   GENZModelsUI
        ↓
   Table / Search / Form modules

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

        models: [],

        providers: [],

        loading: false,

        initialized: false,

        initializing: null

    };


    let buttonsBound = false;


    /* =====================================================
       DOM HELPER
    ===================================================== */

    function $(id) {

        return document.getElementById(id);

    }


    function getElement(target) {

        if (!target) {
            return null;
        }

        if (
            typeof target === "string"
        ) {

            return document.querySelector(
                target
            );

        }

        return target;

    }


    /* =====================================================
       MODULE ACCESS
    ===================================================== */

    function getModelsData() {

        return (
            window.GENZModelsData ||
            null
        );

    }


    function getModelsProvider() {

        return (
            window.GENZModelsProvider ||
            null
        );

    }


    function getModelsSearch() {

        return (
            window.GENZModelsSearch ||
            null
        );

    }


    function getPageSearch() {

        return (
            window.GENZModelPageSearch ||
            null
        );

    }


    function getFormCreate() {

        return (
            window.GENZModelFormCreate ||
            null
        );

    }


    function getFormEdit() {

        return (
            window.GENZModelFormEdit ||
            null
        );

    }


    function getFormDelete() {

        return (
            window.GENZModelFormDelete ||
            null
        );

    }


    function getFormLayout() {

        return (
            window.GENZModelFormLayout ||
            null
        );

    }


    function getFormEvents() {

        return (
            window.GENZModelFormEvents ||
            null
        );

    }


    function getFormCoordinator() {

        return (
            window.GENZModelFormCoordinator ||
            null
        );

    }


    function getTable() {

        return (
            window.GENZModelTable ||
            null
        );

    }


    function getTableEvents() {

        return (
            window.GENZModelTableEvents ||
            null
        );

    }


    function getPrice() {

        return (
            window.GENZModelsPrice ||
            null
        );

    }


    /* =====================================================
       NOTIFICATION
       -----------------------------------------------------
       showAlert dipertahankan karena models-provider.js
       masih menggunakan API tersebut.
       ===================================================== */

    function notify(
        message,
        type = "info",
        duration = 3500
    ) {

        const text =
            String(
                message === null ||
                message === undefined
                    ? ""
                    : message
            );


        const existing =
            $(
                "modelNotification"
            ) ||
            $(
                "notification"
            ) ||
            $(
                "toast"
            );


        if (existing) {

            existing.textContent =
                text;


            existing.classList.remove(
                "success",
                "error",
                "warning",
                "info",
                "show"
            );


            existing.classList.add(
                type
            );


            requestAnimationFrame(
                function () {

                    existing.classList.add(
                        "show"
                    );

                }
            );


            window.clearTimeout(
                existing.__genzTimer
            );


            existing.__genzTimer =
                window.setTimeout(
                    function () {

                        existing.classList.remove(
                            "show"
                        );

                    },
                    duration
                );


            return existing;

        }


        if (
            !document.body
        ) {

            return null;

        }


        const toast =
            document.createElement(
                "div"
            );


        toast.id =
            "modelNotification";


        toast.className =
            "genz-model-notification " +
            type;


        toast.textContent =
            text;


        Object.assign(
            toast.style,
            {

                position:
                    "fixed",

                right:
                    "24px",

                bottom:
                    "24px",

                zIndex:
                    "99999",

                maxWidth:
                    "420px",

                padding:
                    "14px 18px",

                borderRadius:
                    "12px",

                background:
                    "rgba(17,24,39,.96)",

                border:
                    "1px solid rgba(255,255,255,.12)",

                color:
                    "#fff",

                boxShadow:
                    "0 14px 40px rgba(0,0,0,.35)",

                fontSize:
                    "14px",

                lineHeight:
                    "1.45",

                pointerEvents:
                    "none",

                opacity:
                    "1",

                transform:
                    "translateY(0)",

                transition:
                    "opacity .2s ease, transform .2s ease"

            }
        );


        document.body.appendChild(
            toast
        );


        window.setTimeout(
            function () {

                if (
                    !toast ||
                    !toast.parentNode
                ) {

                    return;

                }


                toast.style.opacity =
                    "0";

                toast.style.transform =
                    "translateY(8px)";


                window.setTimeout(
                    function () {

                        if (
                            toast &&
                            toast.parentNode
                        ) {

                            toast.remove();

                        }

                    },
                    250
                );

            },
            duration
        );


        return toast;

    }


    /*
     * Compatibility API.
     *
     * models-provider.js menggunakan showAlert().
     */
    function showAlert(
        message,
        type = "info",
        duration = 3500
    ) {

        return notify(
            message,
            type,
            duration
        );

    }


    /* =====================================================
       ERROR MESSAGE
       ===================================================== */

    function getErrorMessage(
        error,
        fallback = "Terjadi kesalahan."
    ) {

        if (!error) {
            return fallback;
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


        return fallback;

    }


    /* =====================================================
       MODAL
       ===================================================== */

    function getModal() {

        return (
            $(
                "modelModal"
            ) ||

            $(
                "modelEditModal"
            ) ||

            $(
                "editModelModal"
            ) ||

            document.querySelector(
                "[data-model-modal]"
            )
        );

    }


    function showModalElement(
        modal
    ) {

        if (!modal) {
            return false;
        }


        if (
            !modal.dataset.originalDisplay
        ) {

            const computed =
                window.getComputedStyle(
                    modal
                ).display;


            if (
                computed &&
                computed !== "none"
            ) {

                modal.dataset.originalDisplay =
                    computed;

            }

        }


        modal.classList.remove(
            "hidden"
        );


        modal.classList.add(
            "show"
        );


        modal.style.display =
            modal.dataset.originalDisplay ||
            "flex";


        modal.setAttribute(
            "aria-hidden",
            "false"
        );


        if (
            document.body
        ) {

            document.body.classList.add(
                "modal-open"
            );

        }


        return true;

    }


    function hideModalElement(
        modal
    ) {

        if (!modal) {
            return false;
        }


        modal.classList.remove(
            "show"
        );


        modal.classList.add(
            "hidden"
        );


        modal.style.display =
            "none";


        modal.setAttribute(
            "aria-hidden",
            "true"
        );


        if (
            document.body
        ) {

            document.body.classList.remove(
                "modal-open"
            );

        }


        return true;

    }


    /* =====================================================
       MODEL CATALOG
       ===================================================== */

    async function loadModels(
        options = {}
    ) {

        const data =
            getModelsData();


        if (
            !data
        ) {

            throw new Error(
                "GENZModelsData belum tersedia."
            );

        }


        state.loading =
            true;


        try {

            let models = [];


            /*
             * Prioritas:
             * loadModels()
             *
             * Ini adalah owner catalog.
             */
            if (
                typeof data.loadModels ===
                    "function"
            ) {

                const result =
                    await data.loadModels(
                        options
                    );


                models =
                    Array.isArray(
                        result
                    )
                        ? result
                        : [];

            }

            /*
             * Compatibility fallback.
             */
            else if (
                typeof data.getCachedModels ===
                    "function"
            ) {

                const result =
                    data.getCachedModels();


                models =
                    Array.isArray(
                        result
                    )
                        ? result
                        : [];

            }


            state.models =
                models;


            syncSearchState();

            syncTableState();

            updateStatistics(
                state.models
            );


            return [
                ...state.models
            ];

        } finally {

            state.loading =
                false;

        }

    }


    async function refreshModels(
        options = {}
    ) {

        const data =
            getModelsData();


        if (
            data &&
            typeof data.clearCache ===
                "function"
        ) {

            try {

                data.clearCache();

            } catch (error) {

                console.warn(
                    "[models-ui] clearCache warning:",
                    error
                );

            }

        }


        return loadModels(
            {
                ...options,

                force:
                    true,

                activeOnly:
                    options.activeOnly === true
            }
        );

    }


    /* =====================================================
       PROVIDER
       ===================================================== */

    async function loadProviders(
        options = {}
    ) {

        const provider =
            getModelsProvider();


        if (
            !provider
        ) {

            state.providers =
                [];

            return [];

        }


        try {

            let providers = [];


            if (
                typeof provider.loadProviders ===
                    "function"
            ) {

                const result =
                    await provider.loadProviders(
                        {
                            ...options,

                            force:
                                options.force === true,

                            activeOnly:
                                options.activeOnly !== false

                        }
                    );


                providers =
                    Array.isArray(
                        result
                    )
                        ? result
                        : [];

            }


            else if (
                typeof provider.getProviders ===
                    "function"
            ) {

                const result =
                    provider.getProviders();


                providers =
                    Array.isArray(
                        result
                    )
                        ? result
                        : [];

            }


            state.providers =
                providers;


            return [
                ...state.providers
            ];

        } catch (error) {

            console.error(
                "[models-ui] Provider load error:",
                error
            );


            state.providers =
                [];


            notify(
                "Gagal memuat daftar provider.",
                "error"
            );


            return [];

        }

    }


    function syncProviderState() {

        const provider =
            getModelsProvider();


        if (
            !provider ||
            typeof provider.getProviders !==
                "function"
        ) {

            return [
                ...state.providers
            ];

        }


        try {

            const providers =
                provider.getProviders();


            if (
                Array.isArray(
                    providers
                )
            ) {

                state.providers =
                    providers;

            }

        } catch (error) {

            console.warn(
                "[models-ui] Provider state sync error:",
                error
            );

        }


        return [
            ...state.providers
        ];

    }


    function findProviderById(
        providerId
    ) {

        const id =
            String(
                providerId === null ||
                providerId === undefined
                    ? ""
                    : providerId
            )
                .trim()
                .toLowerCase();


        if (!id) {
            return null;
        }


        const found =
            state.providers.find(
                function (
                    provider
                ) {

                    if (
                        !provider
                    ) {

                        return false;

                    }


                    return [

                        provider.id,

                        provider.provider_id,

                        provider.provider_name

                    ].some(
                        function (
                            value
                        ) {

                            return (
                                String(
                                    value === null ||
                                    value === undefined
                                        ? ""
                                        : value
                                )
                                    .trim()
                                    .toLowerCase() ===
                                id
                            );

                        }
                    );

                }
            );


        if (
            found
        ) {

            return found;

        }


        const provider =
            getModelsProvider();


        if (
            provider &&
            typeof provider.getProviderById ===
                "function"
        ) {

            try {

                return (
                    provider.getProviderById(
                        providerId
                    ) ||
                    null
                );

            } catch (error) {

                console.warn(
                    "[models-ui] Provider lookup error:",
                    error
                );

            }

        }


        return null;

    }


    /* =====================================================
       SEARCH
       ===================================================== */

    function syncSearchState() {

        const search =
            getModelsSearch();


        if (
            !search
        ) {

            return false;

        }


        const models =
            state.models;


        try {

            if (
                typeof search.setModels ===
                    "function"
            ) {

                search.setModels(
                    models
                );

                return true;

            }


            if (
                typeof search.setCatalog ===
                    "function"
            ) {

                search.setCatalog(
                    models
                );

                return true;

            }


        } catch (error) {

            console.warn(
                "[models-ui] Search sync error:",
                error
            );

        }


        return false;

    }


    /* =====================================================
       PAGE SEARCH
       ===================================================== */

    function syncPageSearchState() {

        const pageSearch =
            getPageSearch();


        if (
            !pageSearch
        ) {

            return false;

        }


        try {

            if (
                typeof pageSearch.setModels ===
                    "function"
            ) {

                pageSearch.setModels(
                    state.models
                );

                return true;

            }


            if (
                typeof pageSearch.setData ===
                    "function"
            ) {

                pageSearch.setData(
                    state.models
                );

                return true;

            }

        } catch (error) {

            console.warn(
                "[models-ui] Page search sync error:",
                error
            );

        }


        return false;

    }


    /* =====================================================
       TABLE
       ===================================================== */

    function syncTableState() {

        const table =
            getTable();


        if (
            !table
        ) {

            return false;

        }


        try {

            if (
                typeof table.setModels ===
                    "function"
            ) {

                table.setModels(
                    state.models
                );

            }


            if (
                typeof table.setData ===
                    "function"
            ) {

                table.setData(
                    state.models
                );

            }


            if (
                typeof table.render ===
                    "function"
            ) {

                table.render();

            }


            return true;

        } catch (error) {

            console.warn(
                "[models-ui] Table sync error:",
                error
            );


            return false;

        }

    }


    /* =====================================================
       STATISTICS
       ===================================================== */

    function updateStatistics(
        models = state.models
    ) {

        const list =
            Array.isArray(
                models
            )
                ? models
                : [];


        const total =
            list.length;


        const active =
            list.filter(
                function (
                    model
                ) {

                    return (
                        String(
                            model?.status ||
                            ""
                        )
                            .trim()
                            .toLowerCase() ===
                        "active"
                    );

                }
            ).length;


        const inactive =
            list.filter(
                function (
                    model
                ) {

                    return (
                        String(
                            model?.status ||
                            ""
                        )
                            .trim()
                            .toLowerCase() !==
                        "active"
                    );

                }
            ).length;


        const selectors = {

            total: [
                "totalModels",
                "modelTotal",
                "totalModel"
            ],

            active: [
                "activeModels",
                "modelActive",
                "activeModel"
            ],

            inactive: [
                "inactiveModels",
                "modelInactive",
                "inactiveModel"
            ]

        };


        Object.keys(
            selectors
        ).forEach(
            function (
                type
            ) {

                selectors[type].forEach(
                    function (
                        id
                    ) {

                        const element =
                            $(id);


                        if (
                            element
                        ) {

                            element.textContent =
                                String(
                                    type ===
                                        "total"
                                        ? total
                                        : type ===
                                            "active"
                                            ? active
                                            : inactive
                                );

                        }

                    }
                );

            }
        );


        return {

            total,

            active,

            inactive

        };

    }


    /* =====================================================
       MODEL LOOKUP
       ===================================================== */

    function findModelById(
        modelId
    ) {

        const requested =
            String(
                modelId === null ||
                modelId === undefined
                    ? ""
                    : modelId
            )
                .trim()
                .toLowerCase();


        if (!requested) {
            return null;
        }


        return (
            state.models.find(
                function (
                    model
                ) {

                    return [

                        model?.id,

                        model?.model_id,

                        model?.model_name

                    ].some(
                        function (
                            value
                        ) {

                            return (
                                String(
                                    value === null ||
                                    value === undefined
                                        ? ""
                                        : value
                                )
                                    .trim()
                                    .toLowerCase() ===
                                requested
                            );

                        }
                    );

                }
            ) ||
            null
        );

    }


    function selectModel(
        model
    ) {

        if (!model) {
            return null;
        }


        const search =
            getModelsSearch();


        if (
            search &&
            typeof search.chooseModel ===
                "function"
        ) {

            try {

                return search.chooseModel(
                    model
                );

            } catch (error) {

                console.warn(
                    "[models-ui] chooseModel error:",
                    error
                );

            }

        }


        return model;

    }


    /* =====================================================
       PRICE
       ===================================================== */

    function renderModelPrice(
        model,
        target
    ) {

        const price =
            getPrice();


        const element =
            getElement(
                target
            );


        if (
            !price ||
            !element
        ) {

            return false;

        }


        try {

            if (
                typeof price.getModelPrice ===
                    "function"
            ) {

                const result =
                    price.getModelPrice(
                        model,
                        state.models
                    );


                if (
                    typeof price.renderPrice ===
                        "function"
                ) {

                    element.innerHTML =
                        price.renderPrice(
                            result
                        );

                } else {

                    element.textContent =
                        String(
                            result?.usd ??
                            result?.credit ??
                            result ??
                            "-"
                        );

                }


                return true;

            }


            if (
                typeof price.findPricingForModel ===
                    "function"
            ) {

                const result =
                    price.findPricingForModel(
                        model,
                        state.models
                    );


                if (
                    typeof price.renderPrice ===
                        "function"
                ) {

                    element.innerHTML =
                        price.renderPrice(
                            result
                        );

                }


                return true;

            }

        } catch (error) {

            console.warn(
                "[models-ui] Price render error:",
                error
            );

        }


        return false;

    }


    /* =====================================================
       CREATE
       ===================================================== */

    async function openCreateModal() {

        const create =
            getFormCreate();


        if (
            create
        ) {

            try {

                if (
                    typeof create.openCreate ===
                        "function"
                ) {

                    create.openCreate(
                        getModal(),
                        {
                            providers:
                                state.providers,

                            models:
                                state.models
                        }
                    );

                }


                if (
                    typeof create.reset ===
                        "function"
                ) {

                    create.reset();

                }

            } catch (error) {

                console.warn(
                    "[models-ui] Create form reset/open warning:",
                    error
                );

            }

        }


        const layout =
            getFormLayout();


        if (
            layout
        ) {

            try {

                if (
                    typeof layout.refresh ===
                        "function"
                ) {

                    await layout.refresh();

                } else if (
                    typeof layout.render ===
                        "function"
                ) {

                    await layout.render();

                }

            } catch (error) {

                console.warn(
                    "[models-ui] Form layout refresh warning:",
                    error
                );

            }

        }


        /*
         * Pastikan provider state terbaru tersedia
         * untuk form.
         */
        syncProviderState();


        const modal =
            getModal();


        if (
            !modal
        ) {

            notify(
                "Modal tambah model belum tersedia.",
                "error"
            );

            return false;

        }


        showModalElement(
            modal
        );


        const input =
            $(
                "modelCodeSearch"
            );


        if (
            input
        ) {

            window.setTimeout(
                function () {

                    try {

                        input.focus();

                    } catch {
                        /* Ignore focus failure. */
                    }

                },
                50
            );

        }


        return true;

    }


    /* =====================================================
       EDIT
       ===================================================== */

    async function openEditModal(
        model
    ) {

        if (!model) {

            notify(
                "Model tidak ditemukan.",
                "error"
            );

            return false;

        }


        const edit =
            getFormEdit();


        if (
            !edit
        ) {

            notify(
                "Module form edit belum tersedia.",
                "error"
            );

            return false;

        }


        try {

            let result;


            /*
             * API yang digunakan oleh module baru.
             */
            if (
                typeof edit.openEditModel ===
                    "function"
            ) {

                result =
                    await edit.openEditModel(
                        model,
                        {
                            providers:
                                state.providers,

                            models:
                                state.models
                        }
                    );

            }


            /*
             * Compatibility API.
             */
            else if (
                typeof edit.open ===
                    "function"
            ) {

                result =
                    await edit.open(
                        model
                    );

            }


            else if (
                typeof edit.setEditingModel ===
                    "function"
            ) {

                edit.setEditingModel(
                    model
                );

                result =
                    true;

            }


            if (
                result === false
            ) {

                return false;

            }


            const modal =
                getModal();


            if (
                modal &&
                !modal.classList.contains(
                    "show"
                )
            ) {

                showModalElement(
                    modal
                );

            }


            return true;

        } catch (error) {

            console.error(
                "[models-ui] Open edit error:",
                error
            );


            notify(
                getErrorMessage(
                    error,
                    "Gagal membuka form edit model."
                ),
                "error"
            );


            return false;

        }

    }


    /* =====================================================
       CLOSE MODAL
       ===================================================== */

    function closeModal() {

        const events =
            getFormEvents();


        if (
            events &&
            typeof events.closeModal ===
                "function"
        ) {

            try {

                return events.closeModal();

            } catch (error) {

                console.warn(
                    "[models-ui] FormEvents.closeModal error:",
                    error
                );

            }

        }


        const layout =
            getFormLayout();


        if (
            layout &&
            typeof layout.close ===
                "function"
        ) {

            try {

                const result =
                    layout.close();


                if (
                    result !== false
                ) {

                    hideModalElement(
                        getModal()
                    );

                    return true;

                }

            } catch (error) {

                console.warn(
                    "[models-ui] FormLayout.close error:",
                    error
                );

            }

        }


        return hideModalElement(
            getModal()
        );

    }


    /* =====================================================
       CREATE / UPDATE / DELETE DELEGATION
       ===================================================== */

    async function createModel(
        data,
        options = {}
    ) {

        const coordinator =
            getFormCoordinator();


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


        const create =
            getFormCreate();


        if (
            create &&
            typeof create.create ===
                "function"
        ) {

            return create.create(
                data,
                {
                    ...options,

                    providers:
                        state.providers,

                    models:
                        state.models
                }
            );

        }


        throw new Error(
            "Module create model belum tersedia."
        );

    }


    async function updateModel(
        data,
        options = {}
    ) {

        const coordinator =
            getFormCoordinator();


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
            getFormEdit();


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


        throw new Error(
            "Module update model belum tersedia."
        );

    }


    async function deleteModel(
        model,
        options = {}
    ) {

        const coordinator =
            getFormCoordinator();


        if (
            coordinator &&
            typeof coordinator.remove ===
                "function"
        ) {

            return coordinator.remove(
                model,
                options
            );

        }


        const remove =
            getFormDelete();


        if (
            remove &&
            typeof remove.remove ===
                "function"
        ) {

            return remove.remove(
                model,
                {
                    ...options,

                    models:
                        state.models
                }
            );

        }


        throw new Error(
            "Module delete model belum tersedia."
        );

    }


    /* =====================================================
       REFRESH AFTER CRUD
       ===================================================== */

    async function refreshAfterMutation(
        result,
        options = {}
    ) {

        /*
         * Jika mutation berhasil, reload catalog
         * dari source sebenarnya.
         */
        if (
            options.refresh === false
        ) {

            return result;

        }


        try {

            await refreshModels(
                {
                    activeOnly:
                        false
                }
            );

        } catch (error) {

            console.warn(
                "[models-ui] Refresh after mutation failed:",
                error
            );

        }


        return result;

    }


    /* =====================================================
       BUTTON HANDLER
       ===================================================== */

    function bindButton(
        ids,
        handler
    ) {

        const list =
            Array.isArray(
                ids
            )
                ? ids
                : [ids];


        let found =
            false;


        list.forEach(
            function (
                id
            ) {

                const button =
                    $(id);


                if (
                    !button
                ) {

                    return;

                }


                found =
                    true;


                if (
                    button.dataset
                        .genzUiBound ===
                    "true"
                ) {

                    return;

                }


                button.dataset
                    .genzUiBound =
                    "true";


                button.dataset
                    .genzUiButtonBound =
                    "true";


                button.addEventListener(
                    "click",
                    function (
                        event
                    ) {

                        event.preventDefault();

                        event.stopPropagation();


                        try {

                            const result =
                                handler(
                                    event
                                );


                            if (
                                result &&
                                typeof result.then ===
                                    "function"
                            ) {

                                result.catch(
                                    function (
                                        error
                                    ) {

                                        console.error(
                                            "[models-ui] Button error:",
                                            error
                                        );


                                        notify(
                                            getErrorMessage(
                                                error,
                                                "Terjadi kesalahan."
                                            ),
                                            "error"
                                        );

                                    }
                                );

                            }

                        } catch (error) {

                            console.error(
                                "[models-ui] Button error:",
                                error
                            );


                            notify(
                                getErrorMessage(
                                    error,
                                    "Terjadi kesalahan."
                                ),
                                "error"
                            );

                        }

                    }
                );

            }
        );


        return found;

    }


    function bindButtons() {

        let bound =
            false;


        if (
            bindButton(
                [
                    "addModelButton",
                    "addModelBtn",
                    "createModelButton",
                    "addModel",
                    "btnAddModel",
                    "newModelBtn"
                ],
                function () {

                    return openCreateModal();

                }
            )
        ) {

            bound =
                true;

        }


        if (
            bindButton(
                [
                    "refreshBtn",
                    "refreshModels",
                    "refreshModelsButton",
                    "refreshModelButton"
                ],
                function () {

                    return refreshModels(
                        {
                            activeOnly:
                                false
                        }
                    );

                }
            )
        ) {

            bound =
                true;

        }


        buttonsBound =
            bound ||
            buttonsBound;


        return buttonsBound;

    }


    /* =====================================================
       INITIALIZE
       ===================================================== */

    async function initialize() {

        if (
            state.initialized
        ) {

            bindButtons();

            return true;

        }


        if (
            state.initializing
        ) {

            return state.initializing;

        }


        state.initializing =
            (async function () {

                try {

                    /*
                     * Bind tombol dulu.
                     * Tidak perlu menunggu module lain.
                     */
                    bindButtons();


                    /*
                     * Provider.
                     */
                    await loadProviders(
                        {
                            force:
                                false,

                            activeOnly:
                                true
                        }
                    );


                    /*
                     * Catalog models.
                     *
                     * Hanya tabel models.
                     */
                    await loadModels(
                        {
                            force:
                                false,

                            activeOnly:
                                false
                        }
                    );


                    /*
                     * Sinkronisasi provider/catalog.
                     */
                    syncProviderState();

                    syncSearchState();

                    syncPageSearchState();

                    syncTableState();

                    updateStatistics(
                        state.models
                    );


                    /*
                     * Bind ulang setelah seluruh DOM/module
                     * tersedia.
                     */
                    bindButtons();


                    state.initialized =
                        true;


                    try {

                        window.dispatchEvent(
                            new CustomEvent(
                                "genz-models-ui-ready"
                            )
                        );

                    } catch {
                        /* Ignore event compatibility failure. */
                    }


                    try {

                        window.dispatchEvent(
                            new CustomEvent(
                                "genz-models-ready"
                            )
                        );

                    } catch {
                        /* Ignore event compatibility failure. */
                    }


                    console.info(
                        "[GEN-Z.AI] Models UI ready."
                    );


                    return true;

                } catch (error) {

                    state.initialized =
                        false;


                    console.error(
                        "[GEN-Z.AI] Models UI initialization failed:",
                        error
                    );


                    notify(
                        getErrorMessage(
                            error,
                            "Model Management gagal diinisialisasi."
                        ),
                        "error"
                    );


                    try {

                        window.dispatchEvent(
                            new CustomEvent(
                                "genz-models-ui-error",
                                {
                                    detail:
                                        error
                                }
                            )
                        );

                    } catch {
                        /* Ignore event compatibility failure. */
                    }


                    throw error;

                } finally {

                    state.initializing =
                        null;

                }

            })();


        return state.initializing;

    }


    /* =====================================================
       RESET
       ===================================================== */

    function reset() {

        if (
            state.initializing
        ) {

            console.warn(
                "[GEN-Z.AI] UI reset skipped while initialization is running."
            );


            return false;

        }


        state.initialized =
            false;


        state.loading =
            false;


        state.models =
            [];


        state.providers =
            [];


        buttonsBound =
            false;


        return true;

    }


    /* =====================================================
       STATE GETTERS
       ===================================================== */

    function getModels() {

        return [
            ...state.models
        ];

    }


    function getProviders() {

        return [
            ...state.providers
        ];

    }


    function isLoading() {

        return (
            state.loading
        );

    }


    function isInitialized() {

        return (
            state.initialized
        );

    }


    /* =====================================================
       PUBLIC API
       ===================================================== */

    window.GENZModelsUI =
        Object.freeze({

            initialize,

            reset,

            notify,

            showAlert,

            getModal,

            showModalElement,

            hideModalElement,

            openModal:
                openCreateModal,

            openCreateModal,

            openEditModal,

            closeModal,

            loadModels,

            refreshModels,

            loadProviders,

            syncProviderState,

            syncSearchState,

            syncPageSearchState,

            syncTableState,

            updateStatistics,

            findModelById,

            findProviderById,

            selectModel,

            renderModelPrice,

            createModel,

            updateModel,

            deleteModel,

            refreshAfterMutation,

            bindButtons,

            getModels,

            getProviders,

            isLoading,

            isInitialized

        });


    console.info(
        "[GEN-Z.AI] GENZModelsUI loaded."
    );


})();
