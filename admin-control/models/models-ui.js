/* =========================================================
   GEN-Z.AI
   ADMIN MODEL MANAGEMENT
   UI ORCHESTRATOR MODULE
   ---------------------------------------------------------
   File:
   admin-control/models/models-ui.js

   Tanggung jawab:
   - UI state
   - Notification / alert
   - Load model catalog melalui Models Data
   - Load provider state melalui Provider module
   - Sinkronisasi Search
   - Sinkronisasi Table
   - Statistics
   - Refresh

   Tidak bertanggung jawab:
   - Create model
   - Edit model
   - Delete model
   - Query Supabase langsung
   - Pricing calculation
   - Model registry / model source creation
   - Provider CRUD

   SOURCE OF TRUTH:
   - Model: models-data.js / tabel models
   - Provider: Provider module / tabel providers

   Catatan:
   - Modul ini hanya orchestrator.
   - Tidak membuat model/provider palsu.
   - Tidak melakukan query Supabase langsung.
   - Tidak menganggap fungsi async sebagai object synchronous.
   ========================================================= */

(function () {

    "use strict";


    /* =====================================================
       STATE
    ===================================================== */

    const state = {

        models: [],

        providers: [],

        loadingModels: false,

        loadingProviders: false,

        initialized: false,

        initializing: null

    };


    let buttonsBound = false;


    /* =====================================================
       DOM
    ===================================================== */

    function $(id) {

        if (!id) {

            return null;

        }

        return document.getElementById(id);

    }


    function getElement(target) {

        if (!target) {

            return null;

        }


        if (typeof target === "string") {

            try {

                return document.querySelector(target);

            } catch {

                return null;

            }

        }


        return target;

    }


    /* =====================================================
       MODULE ACCESS
    ===================================================== */

    function getModelsData() {

        return window.GENZModelsData || null;

    }


    function getModelsProvider() {

        return window.GENZModelsProvider || null;

    }


    function getModelsSearch() {

        return window.GENZModelsSearch || null;

    }


    function getPageSearch() {

        return window.GENZModelPageSearch || null;

    }


    function getTable() {

        return window.GENZModelTable || null;

    }


    function getTableEvents() {

        return window.GENZModelTableEvents || null;

    }


    function getPrice() {

        return window.GENZModelsPrice || null;

    }


    /* =====================================================
       NORMALIZATION HELPERS
    ===================================================== */

    function normalizeId(value) {

        if (
            value === null ||
            value === undefined
        ) {

            return "";

        }


        return String(value)
            .trim()
            .toLowerCase();

    }


    function normalizeArray(value) {

        if (Array.isArray(value)) {

            return [...value];

        }


        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {

            return [];

        }


        if (typeof value === "string") {

            return value
                .split(",")
                .map(function (item) {

                    return item.trim();

                })
                .filter(Boolean);

        }


        return [];

    }


    /* =====================================================
       NOTIFICATION
    ===================================================== */

    function notify(
        message,
        type = "info",
        duration = 3500
    ) {

        const text = String(
            message === null ||
            message === undefined
                ? ""
                : message
        );


        const existing =
            $("modelNotification") ||
            $("notification") ||
            $("toast");


        if (existing) {

            existing.textContent = text;


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

                position: "fixed",

                right: "24px",

                bottom: "24px",

                zIndex: "99999",

                maxWidth: "420px",

                padding: "14px 18px",

                borderRadius: "12px",

                background:
                    "rgba(17,24,39,.96)",

                border:
                    "1px solid rgba(255,255,255,.12)",

                color: "#fff",

                boxShadow:
                    "0 14px 40px rgba(0,0,0,.35)",

                fontSize: "14px",

                lineHeight: "1.45",

                pointerEvents: "none",

                opacity: "1",

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
            Array.isArray(error.errors) &&
            error.errors.length
        ) {

            return error.errors.join(
                "\n"
            );

        }


        if (
            error.message !== null &&
            error.message !== undefined &&
            String(error.message).trim()
        ) {

            return String(
                error.message
            );

        }


        if (typeof error === "string") {

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


        state.loadingModels =
            true;


        try {

            let result = [];


            if (
                typeof data.loadModels ===
                "function"
            ) {

                result =
                    await data.loadModels(
                        options
                    );

            }

            else if (
                typeof data.getCachedModels ===
                "function"
            ) {

                result =
                    data.getCachedModels();

            }


            const models =
                Array.isArray(result)
                    ? result
                    : (
                        Array.isArray(result?.models)
                            ? result.models
                            : []
                    );


            state.models =
                [...models];


            syncSearchState();

            syncPageSearchState();

            syncTableState();

            updateStatistics(
                state.models
            );


            return [
                ...state.models
            ];

        }

        finally {

            state.loadingModels =
                false;

        }

    }


    /* =====================================================
       REFRESH MODELS
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

            }

            catch (error) {

                console.warn(
                    "[models-ui] clearCache warning:",
                    error
                );

            }

        }


        return loadModels({

            ...options,

            force: true

        });

    }


    /* =====================================================
       PROVIDERS
    ===================================================== */

    async function loadProviders(
        options = {}
    ) {

        const providerModule =
            getModelsProvider();


        if (!providerModule) {

            state.providers =
                [];

            return [];

        }


        state.loadingProviders =
            true;


        try {

            let result = [];


            if (
                typeof providerModule.loadProviders ===
                "function"
            ) {

                /*
                 * Provider module adalah pemilik
                 * lifecycle provider.
                 *
                 * Jangan memakai activeOnly karena
                 * models-data/provider module dapat
                 * menggunakan includeInactive.
                 */

                result =
                    await providerModule.loadProviders(
                        {
                            ...options,

                            force:
                                options.force === true,

                            includeInactive:
                                options.includeInactive === true
                        }
                    );

            }

            else if (
                typeof providerModule.getProviders ===
                "function"
            ) {

                result =
                    providerModule.getProviders();

            }


            const providers =
                Array.isArray(result)
                    ? result
                    : [];


            state.providers =
                [...providers];


            return [
                ...state.providers
            ];

        }

        catch (error) {

            console.error(
                "[models-ui] Provider load error:",
                error
            );


            state.providers =
                [];


            notify(
                getErrorMessage(
                    error,
                    "Gagal memuat daftar provider."
                ),
                "error"
            );


            return [];

        }

        finally {

            state.loadingProviders =
                false;

        }

    }


    /* =====================================================
       PROVIDER STATE SYNC
    ===================================================== */

    function syncProviderState() {

        const providerModule =
            getModelsProvider();


        if (
            !providerModule ||
            typeof providerModule.getProviders !==
            "function"
        ) {

            return [
                ...state.providers
            ];

        }


        try {

            const providers =
                providerModule.getProviders();


            if (Array.isArray(providers)) {

                state.providers =
                    [...providers];

            }

        }

        catch (error) {

            console.warn(
                "[models-ui] Provider state sync warning:",
                error
            );

        }


        return [
            ...state.providers
        ];

    }


    /* =====================================================
       PROVIDER LOOKUP
       ===================================================== */

    function findProviderById(
        providerId
    ) {

        const normalized =
            normalizeId(
                providerId
            );


        if (!normalized) {

            return null;

        }


        /*
         * IMPORTANT:
         *
         * Hanya cari dari state yang sudah
         * dimuat secara synchronous.
         *
         * Jangan memanggil getProviderById()
         * async lalu mengembalikan Promise
         * dari fungsi yang namanya lookup.
         */

        const found =
            state.providers.find(
                function (provider) {

                    if (!provider) {

                        return false;

                    }


                    const candidates = [

                        provider.id,

                        provider.provider_id,

                        provider.provider_name,

                        provider.name,

                        provider.code,

                        provider.provider_code

                    ];


                    return candidates.some(
                        function (value) {

                            return (
                                normalizeId(
                                    value
                                ) ===
                                normalized
                            );

                        }
                    );

                }
            );


        return found || null;

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
                    [
                        ...state.models
                    ]
                );

                return true;

            }


            if (
                typeof search.setCatalog ===
                "function"
            ) {

                search.setCatalog(
                    [
                        ...state.models
                    ]
                );

                return true;

            }

        }

        catch (error) {

            console.warn(
                "[models-ui] Search sync warning:",
                error
            );

        }


        return false;

    }


    /* =====================================================
       PAGE SEARCH SYNC
    ===================================================== */

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
                    [
                        ...state.models
                    ]
                );

                return true;

            }


            if (
                typeof pageSearch.setCatalog ===
                "function"
            ) {

                pageSearch.setCatalog(
                    [
                        ...state.models
                    ]
                );

                return true;

            }

        }

        catch (error) {

            console.warn(
                "[models-ui] Page search sync warning:",
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
                    [
                        ...state.models
                    ]
                );

                return true;

            }


            if (
                typeof table.setData ===
                "function"
            ) {

                table.setData(
                    [
                        ...state.models
                    ]
                );

                return true;

            }


            if (
                typeof table.render ===
                "function"
            ) {

                table.render(
                    [
                        ...state.models
                    ]
                );

                return true;

            }

        }

        catch (error) {

            console.warn(
                "[models-ui] Table sync warning:",
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
            Array.isArray(models)
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
                            .trim()
                            .toLowerCase() ===
                        "active"
                    );

                }
            ).length;


        const inactive =
            total - active;


        const stats = {

            total,

            active,

            inactive

        };


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
            normalizeId(
                modelId
            );


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
                                normalizeId(
                                    value
                                ) ===
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
            (
                typeof modelOrId ===
                    "object" &&
                modelOrId !== null
            )
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

        }

        catch {

            /* Compatibility only. */

        }


        return model;

    }


    /* =====================================================
       PRICE DISPLAY
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

            }

            catch (error) {

                console.warn(
                    "[models-ui] Price render warning:",
                    error
                );

            }

        }


        const element =
            getElement(
                target
            );


        if (!element) {

            return null;

        }


        /*
         * Fallback hanya untuk tampilan.
         * Tidak melakukan calculation.
         */

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
            Array.isArray(ids)
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
                 * Hindari duplicate listener.
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

                        }

                        catch (error) {

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
         * models-ui TIDAK membuat
         * tombol Create Model.
         *
         * Create/Edit/Delete tetap dimiliki
         * module masing-masing.
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
                            includeInactive:
                                true
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

        }

        catch (error) {

            console.warn(
                "[models-ui] Table events binding warning:",
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
                     * Refresh button harus tersedia
                     * walaupun data belum selesai load.
                     */

                    bindButtons();


                    /*
                     * Provider:
                     *
                     * Ambil semua provider yang memang
                     * tersedia di database.
                     *
                     * Jangan membuang provider aktif
                     * hanya karena UI memakai istilah
                     * activeOnly.
                     */

                    await loadProviders(
                        {
                            force: false,

                            includeInactive: true
                        }
                    );


                    /*
                     * Model:
                     *
                     * models-data.js adalah sumber
                     * data model.
                     */

                    await loadModels(
                        {
                            force: false,

                            activeOnly: false
                        }
                    );


                    /*
                     * Sinkronisasi setelah kedua
                     * sumber data selesai.
                     */

                    syncProviderState();

                    syncSearchState();

                    syncPageSearchState();

                    syncTableState();

                    updateStatistics(
                        state.models
                    );


                    /*
                     * Table event module tetap
                     * menjadi pemilik event Edit/Delete.
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

                    }

                    catch {

                        /* Compatibility only. */

                    }


                    try {

                        window.dispatchEvent(
                            new CustomEvent(
                                "genz-models-ready"
                            )
                        );

                    }

                    catch {

                        /* Compatibility only. */

                    }


                    console.info(
                        "[GEN-Z.AI] Models UI ready."
                    );


                    return true;

                }

                catch (error) {

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
                                    detail: error
                                }
                            )
                        );

                    }

                    catch {

                        /* Compatibility only. */

                    }


                    throw error;

                }

                finally {

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


        state.loadingModels =
            false;


        state.loadingProviders =
            false;


        state.models =
            [];


        state.providers =
            [];


        /*
         * Jangan menghapus dataset
         * binding secara manual.
         *
         * Listener yang sudah terpasang
         * tetap ditandai oleh element.
         */

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

        return (
            state.loadingModels ||
            state.loadingProviders
        );

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
