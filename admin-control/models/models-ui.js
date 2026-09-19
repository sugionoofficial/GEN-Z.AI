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
   - Load model catalog
   - Load provider state
   - Sinkronisasi search
   - Sinkronisasi table
   - Statistics
   - Refresh

   Tidak bertanggung jawab:
   - Create model
   - Delete model
   - Edit modal
   - Model CRUD
   - Query Supabase langsung
   - Pricing calculation

   SOURCE OF TRUTH MODEL:
   models/<model-folder>/

   Model ID TIDAK BOLEH diubah dari halaman ini.
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
       DOM
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


        if (!document.body) {

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
       ERROR
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


        if (error.message) {

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
       MODEL CATALOG
    ===================================================== */

    async function loadModels(
        options = {}
    ) {

        const data =
            getModelsData();


        if (!data) {

            throw new Error(
                "GENZModelsData belum tersedia."
            );

        }


        state.loading =
            true;


        try {

            let models = [];


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
                        : (
                            result?.models ||
                            []
                        );

            }


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

            syncPageSearchState();

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


    /* =====================================================
       REFRESH
    ===================================================== */

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
       PROVIDERS
    ===================================================== */

    async function loadProviders(
        options = {}
    ) {

        const provider =
            getModelsProvider();


        if (!provider) {

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
                function (provider) {

                    if (!provider) {

                        return false;

                    }


                    return [

                        provider.id,

                        provider.provider_id,

                        provider.provider_name,

                        provider.name

                    ].some(
                        function (value) {

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


        if (found) {

            return found;

        }


        const providerModule =
            getModelsProvider();


        if (
            providerModule &&
            typeof providerModule.getProviderById ===
            "function"
        ) {

            try {

                return (
                    providerModule.getProviderById(
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
       SEARCH SYNC
    ===================================================== */

    function syncSearchState() {

        const search =
            getModelsSearch();


        if (!search) {

            return false;

        }


        try {

            if (
                typeof search.setModels ===
                "function"
            ) {

                search.setModels(
                    state.models
                );

                return true;

            }


            if (
                typeof search.setCatalog ===
                "function"
            ) {

                search.setCatalog(
                    state.models
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


    function syncPageSearchState() {

        const pageSearch =
            getPageSearch();


        if (!pageSearch) {

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
                typeof pageSearch.setCatalog ===
                "function"
            ) {

                pageSearch.setCatalog(
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
       TABLE SYNC
    ===================================================== */

    function syncTableState() {

        const table =
            getTable();


        if (!table) {

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

                return true;

            }


            if (
                typeof table.setData ===
                "function"
            ) {

                table.setData(
                    state.models
                );

                return true;

            }


            if (
                typeof table.render ===
                "function"
            ) {

                table.render(
                    state.models
                );

                return true;

            }

        } catch (error) {

            console.warn(
                "[models-ui] Table sync error:",
                error
            );

        }


        return false;

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
                function (model) {

                    return (
                        String(
                            model?.status ||
                            ""
                        )
                            .toLowerCase() ===
                        "active"
                    );

                }
            ).length;


        const inactive =
            total -
            active;


        const stats = {

            total,

            active,

            inactive

        };


        /*
         * Support berbagai ID statistik
         * dari layout lama maupun baru.
         */

        const totalElements = [

            $("totalModels"),

            $("modelCount"),

            $("modelsCount"),

            $("statTotalModels")

        ];


        const activeElements = [

            $("activeModels"),

            $("activeModelCount"),

            $("statActiveModels")

        ];


        const inactiveElements = [

            $("inactiveModels"),

            $("inactiveModelCount"),

            $("statInactiveModels")

        ];


        totalElements.forEach(
            function (element) {

                if (element) {

                    element.textContent =
                        String(total);

                }

            }
        );


        activeElements.forEach(
            function (element) {

                if (element) {

                    element.textContent =
                        String(active);

                }

            }
        );


        inactiveElements.forEach(
            function (element) {

                if (element) {

                    element.textContent =
                        String(inactive);

                }

            }
        );


        /*
         * Data attribute compatibility.
         */

        const statsRoot =
            document.querySelector(
                "[data-model-statistics]"
            );


        if (statsRoot) {

            statsRoot.dataset.total =
                String(total);

            statsRoot.dataset.active =
                String(active);

            statsRoot.dataset.inactive =
                String(inactive);

        }


        return stats;

    }


    /* =====================================================
       MODEL LOOKUP
    ===================================================== */

    function findModelById(
        modelId
    ) {

        const normalized =
            String(
                modelId === null ||
                modelId === undefined
                    ? ""
                    : modelId
            )
                .trim()
                .toLowerCase();


        if (!normalized) {

            return null;

        }


        return (
            state.models.find(
                function (model) {

                    if (!model) {

                        return false;

                    }


                    const candidates = [

                        model.id,

                        model.model_id,

                        model.modelId

                    ];


                    return candidates.some(
                        function (value) {

                            return (
                                String(
                                    value === null ||
                                    value === undefined
                                        ? ""
                                        : value
                                )
                                    .trim()
                                    .toLowerCase() ===
                                normalized
                            );

                        }
                    );

                }
            ) ||
            null
        );

    }


    /* =====================================================
       SELECT MODEL
    ===================================================== */

    function selectModel(
        modelOrId
    ) {

        const model =
            typeof modelOrId === "object" &&
            modelOrId !== null
                ? modelOrId
                : findModelById(
                    modelOrId
                );


        if (!model) {

            notify(
                "Model tidak ditemukan.",
                "error"
            );

            return false;

        }


        /*
         * Hanya sinkronisasi state.
         *
         * Tidak membuka modal.
         * Tidak melakukan CRUD.
         */

        try {

            window.dispatchEvent(
                new CustomEvent(
                    "genz-model-selected",
                    {
                        detail: {
                            model
                        }
                    }
                )
            );

        } catch {
            /* Ignore event compatibility failure. */
        }


        return model;

    }


    /* =====================================================
       PRICE
    ===================================================== */

    function renderModelPrice(
        model,
        target = null
    ) {

        if (!model) {

            return null;

        }


        const price =
            getPrice();


        if (
            price &&
            typeof price.render ===
            "function"
        ) {

            try {

                return price.render(
                    model,
                    target
                );

            } catch (error) {

                console.warn(
                    "[models-ui] Price render warning:",
                    error
                );

            }

        }


        /*
         * Fallback sederhana.
         */

        const element =
            getElement(
                target
            );


        if (!element) {

            return null;

        }


        const value =
            model.credit_final ??
            model.credit_cost ??
            0;


        element.textContent =
            String(value);


        return value;

    }


    /* =====================================================
       BUTTON BINDING
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
            function (id) {

                const button =
                    $(id);


                if (!button) {

                    return;

                }


                found =
                    true;


                /*
                 * Jangan bind dua kali.
                 */

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


                button.addEventListener(
                    "click",
                    function (event) {

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
                                    function (error) {

                                        console.error(
                                            "[models-ui] Button error:",
                                            error
                                        );


                                        notify(
                                            getErrorMessage(
                                                error
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
                                    error
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


        /*
         * TIDAK ADA:
         *
         * addModelButton
         * createModelButton
         * newModelBtn
         *
         * Model berasal dari folder repository.
         */


        /*
         * REFRESH SAJA.
         */

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
       TABLE EVENTS
    ===================================================== */

    function bindTableEvents() {

        const events =
            getTableEvents();


        if (!events) {

            return false;

        }


        try {

            if (
                typeof events.initialize ===
                "function"
            ) {

                return events.initialize();

            }


            if (
                typeof events.bind ===
                "function"
            ) {

                return events.bind();

            }

        } catch (error) {

            console.warn(
                "[models-ui] Table events binding error:",
                error
            );

        }


        return false;

    }


    /* =====================================================
       INITIALIZE
    ===================================================== */

    async function initialize() {

        if (
            state.initialized
        ) {

            bindButtons();

            bindTableEvents();

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
                     * Bind refresh terlebih dahulu.
                     */

                    bindButtons();


                    /*
                     * Load provider.
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
                     * Load model catalog.
                     *
                     * Model berasal dari
                     * models-data.js.
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
                     * Sinkronisasi provider.
                     */

                    syncProviderState();


                    syncSearchState();


                    syncPageSearchState();


                    syncTableState();


                    updateStatistics(
                        state.models
                    );


                    /*
                     * Table event:
                     * Edit -> model-edit.html
                     */

                    bindTableEvents();


                    state.initialized =
                        true;


                    try {

                        window.dispatchEvent(
                            new CustomEvent(
                                "genz-models-ui-ready"
                            )
                        );

                    } catch {
                        /* Ignore */
                    }


                    try {

                        window.dispatchEvent(
                            new CustomEvent(
                                "genz-models-ready"
                            )
                        );

                    } catch {
                        /* Ignore */
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
                        /* Ignore */
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
       GETTERS
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

        return state.loading;

    }


    function isInitialized() {

        return state.initialized;

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

            bindButtons,

            bindTableEvents,

            getModels,

            getProviders,

            isLoading,

            isInitialized

        });


    console.info(
        "[GEN-Z.AI] GENZModelsUI loaded."
    );

})();
