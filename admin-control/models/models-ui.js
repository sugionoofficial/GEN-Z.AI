/* =========================================================
   GEN-Z.AI
   ADMIN MODEL MANAGEMENT
   UI MODULE

   File:
   admin-control/models/models-ui.js

   TANGGUNG JAWAB:
   - UI state
   - Notification
   - Modal delegation
   - Load/sinkronisasi catalog
   - Sinkronisasi Provider state
   - Statistics
   - Pricing state
   - Refresh

   BUKAN OWNER:
   - Provider CRUD / dropdown
   - Model catalog API
   - Search
   - Search events
   - Form CRUD
   - Form events
   - Table rendering
   - Table events
   - Price calculation
   - Lifecycle utama

   OWNER:
   Provider       -> GENZModelsProvider
   Catalog        -> GENZModelsData
   Search         -> GENZModelsSearch
   Form           -> GENZModelsForm
   Form Events    -> GENZModelFormEvents
   Table          -> GENZModelTable
   Table Events   -> GENZModelTableEvents
   Pricing        -> GENZModelsPrice
   Lifecycle      -> GENZModelsInit

   PRINSIP:
   Satu fungsi = satu owner.
   models-ui hanya mengorkestrasi state dan tampilan.
========================================================= */

(function () {

    "use strict";


    /* =====================================================
       STATE
    ===================================================== */

    let initialized = false;

    let initializing = null;

    const state = {

        models: [],

        providers: [],

        pricing: [],

        loading: false

    };


    /* =====================================================
       DOM HELPER
    ===================================================== */

    function $(id) {

        return document.getElementById(id);

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


    function getModelsForm() {

        return (
            window.GENZModelsForm ||
            null
        );

    }


    function getModelsPrice() {

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

        const existing =
            $("modelNotification") ||
            $("notification") ||
            $("toast");


        if (existing) {

            existing.textContent =
                String(
                    message ??
                    ""
                );


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


        const toast =
            document.createElement(
                "div"
            );


        toast.id =
            "modelNotification";


        toast.className =
            "genz-model-notification " +
            String(
                type || "info"
            );


        toast.textContent =
            String(
                message ??
                ""
            );


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
                    !toast
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


    /* =====================================================
       MODAL
       -----------------------------------------------------
       Form tetap menjadi owner modal lifecycle.
       UI hanya melakukan delegation.
    ===================================================== */

    function getModal() {

        return (

            $("modelModal") ||

            $("modelEditModal") ||

            $("editModelModal") ||

            document.querySelector(
                "[data-model-modal]"
            )

        );

    }


    function showModalElement(
        modal
    ) {

        if (
            !modal
        ) {

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


        modal.classList.add(
            "show"
        );


        modal.classList.remove(
            "hidden"
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

        if (
            !modal
        ) {

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


    function openModal() {

        const form =
            getModelsForm();


        if (
            form &&
            typeof form.openCreateForm ===
                "function"
        ) {

            try {

                return form.openCreateForm();

            } catch (error) {

                console.error(
                    "[models-ui] openCreateForm:",
                    error
                );

            }

        }


        return showModalElement(
            getModal()
        );

    }


    function openEditModal(
        model
    ) {

        if (
            !model
        ) {

            return false;

        }


        const form =
            getModelsForm();


        if (
            form &&
            typeof form.openEditForm ===
                "function"
        ) {

            try {

                return form.openEditForm(
                    model
                );

            } catch (error) {

                console.error(
                    "[models-ui] openEditForm:",
                    error
                );

            }

        }


        return showModalElement(
            getModal()
        );

    }


    function closeModal() {

        const form =
            getModelsForm();


        if (
            form &&
            typeof form.closeModal ===
                "function"
        ) {

            try {

                return form.closeModal();

            } catch (error) {

                console.error(
                    "[models-ui] closeModal:",
                    error
                );

            }

        }


        return hideModalElement(
            getModal()
        );

    }


    /* =====================================================
       PROVIDER STATE
       -----------------------------------------------------
       Provider module adalah owner Provider.
       UI hanya membaca dan menyimpan state.
    ===================================================== */

    async function loadProviders(
        options = {}
    ) {

        const providerModule =
            getModelsProvider();


        if (
            !providerModule ||
            typeof providerModule.loadProviders !==
                "function"
        ) {

            console.warn(
                "[models-ui] GENZModelsProvider.loadProviders() belum tersedia."
            );


            state.providers =
                [];


            return [];

        }


        try {

            const providers =
                await providerModule.loadProviders(
                    {

                        force:
                            options.force === true,

                        activeOnly:
                            options.activeOnly !== false

                    }
                );


            state.providers =
                Array.isArray(
                    providers
                )
                    ? providers
                    : [];


            return state.providers;

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

        const providerModule =
            getModelsProvider();


        if (
            !providerModule
        ) {

            state.providers =
                [];


            return state.providers;

        }


        if (
            typeof providerModule.getProviders !==
                "function"
        ) {

            return state.providers;

        }


        try {

            const providers =
                providerModule.getProviders();


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


        return state.providers;

    }


    function findProviderById(
        providerId
    ) {

        const normalized =
            String(
                providerId ??
                ""
            )
                .trim()
                .toLowerCase();


        if (
            !normalized
        ) {

            return null;

        }


        const local =
            state.providers.find(
                function (
                    provider
                ) {

                    if (
                        !provider
                    ) {

                        return false;

                    }


                    const values = [

                        provider.id,

                        provider.provider_id,

                        provider.provider,

                        provider.provider_name

                    ];


                    return values.some(
                        function (
                            value
                        ) {

                            return (
                                String(
                                    value ??
                                    ""
                                )
                                    .trim()
                                    .toLowerCase() ===
                                normalized
                            );

                        }
                    );

                }
            );


        if (
            local
        ) {

            return local;

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
       MODEL CATALOG
       -----------------------------------------------------
       GENZModelsData adalah owner API/catalog.
       UI hanya meminta data dan sinkronisasi module.
    ===================================================== */

    async function loadModels(
        options = {}
    ) {

        const data =
            getModelsData();


        if (
            !data ||
            typeof data.loadKieModels !==
                "function"
        ) {

            console.warn(
                "[models-ui] GENZModelsData.loadKieModels() belum tersedia."
            );


            state.models =
                [];


            return [];

        }


        state.loading =
            true;


        try {

            const models =
                await data.loadKieModels(
                    options
                );


            state.models =
                Array.isArray(
                    models
                )
                    ? models
                    : [];


            updateStatistics(
                state.models
            );


            /*
             * Search hanya menerima catalog.
             */

            const search =
                getModelsSearch();


            if (
                search &&
                typeof search.setModels ===
                    "function"
            ) {

                search.setModels(
                    state.models
                );

            }


            /*
             * Table hanya menerima catalog.
             */

            const table =
                window.GENZModelTable;


            if (
                table &&
                typeof table.setModels ===
                    "function"
            ) {

                table.setModels(
                    state.models
                );

            }


            return state.models;

        } catch (error) {

            console.error(
                "[models-ui] Model catalog load error:",
                error
            );


            state.models =
                [];


            /*
             * Sinkronkan empty state
             * ke Search dan Table.
             */

            const search =
                getModelsSearch();


            if (
                search &&
                typeof search.setModels ===
                    "function"
            ) {

                search.setModels(
                    []
                );

            }


            const table =
                window.GENZModelTable;


            if (
                table &&
                typeof table.setModels ===
                    "function"
            ) {

                table.setModels(
                    []
                );

            }


            notify(
                "Gagal memuat daftar model dari Supabase.",
                "error"
            );


            return [];

        } finally {

            state.loading =
                false;

        }

    }


    /* =====================================================
       SEARCH SYNC
    ===================================================== */

    function syncSearchState() {

        const search =
            getModelsSearch();


        if (
            !search ||
            typeof search.setModels !==
                "function"
        ) {

            return false;

        }


        try {

            search.setModels(
                state.models
            );


            return true;

        } catch (error) {

            console.warn(
                "[models-ui] Search synchronization error:",
                error
            );


            return false;

        }

    }


    /* =====================================================
       TABLE SYNC
    ===================================================== */

    function syncTableState() {

        const table =
            window.GENZModelTable;


        if (
            !table ||
            typeof table.setModels !==
                "function"
        ) {

            return false;

        }


        try {

            table.setModels(
                state.models
            );


            return true;

        } catch (error) {

            console.warn(
                "[models-ui] Table synchronization error:",
                error
            );


            return false;

        }

    }


    /* =====================================================
       REFRESH
       -----------------------------------------------------
       Refresh hanya meminta owner masing-masing
       memuat ulang datanya.
    ===================================================== */

    async function refreshModels() {

        if (
            state.loading
        ) {

            console.warn(
                "[models-ui] Refresh diabaikan karena load masih berjalan."
            );


            return {

                providers:
                    [...state.providers],

                models:
                    [...state.models]

            };

        }


        state.loading =
            true;


        try {

            console.info(
                "[models-ui] Refresh Models..."
            );


            /*
             * Provider
             */

            await loadProviders(
                {

                    force: true,

                    activeOnly: false

                }
            );


            /*
             * Catalog
             */

            await loadModels(
                {

                    force: true,

                    activeOnly: false

                }
            );


            /*
             * Pricing
             */

            await initializePrice(
                {
                    force: true
                }
            );


            /*
             * Final synchronization.
             */

            syncProviderState();

            syncSearchState();

            syncTableState();

            updateStatistics(
                state.models
            );


            console.info(
                "[models-ui] Refresh selesai.",
                {

                    providers:
                        state.providers.length,

                    models:
                        state.models.length

                }
            );


            return {

                providers:
                    [...state.providers],

                models:
                    [...state.models]

            };

        } finally {

            state.loading =
                false;

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
                            model?.status ??
                            ""
                        )
                            .trim()
                            .toLowerCase() ===
                        "active"
                    );

                }
            ).length;


        const inactive =
            total -
            active;


        const totalEl =
            $("totalModels") ||
            $("modelTotal") ||
            $("modelsTotal");


        const activeEl =
            $("activeModels") ||
            $("modelActive") ||
            $("modelsActive");


        const inactiveEl =
            $("inactiveModels") ||
            $("modelInactive") ||
            $("modelsInactive");


        if (
            totalEl
        ) {

            totalEl.textContent =
                String(
                    total
                );

        }


        if (
            activeEl
        ) {

            activeEl.textContent =
                String(
                    active
                );

        }


        if (
            inactiveEl
        ) {

            inactiveEl.textContent =
                String(
                    inactive
                );

        }


        /*
         * Generic:
         *
         * data-model-stat="total"
         * data-model-stat="active"
         * data-model-stat="inactive"
         */

        document
            .querySelectorAll(
                "[data-model-stat]"
            )
            .forEach(
                function (
                    element
                ) {

                    const stat =
                        String(
                            element.getAttribute(
                                "data-model-stat"
                            ) ||
                            ""
                        )
                            .trim()
                            .toLowerCase();


                    if (
                        stat ===
                        "total"
                    ) {

                        element.textContent =
                            String(
                                total
                            );

                    }


                    if (
                        stat ===
                        "active"
                    ) {

                        element.textContent =
                            String(
                                active
                            );

                    }


                    if (
                        stat ===
                        "inactive"
                    ) {

                        element.textContent =
                            String(
                                inactive
                            );

                    }

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

    function selectModel(
        model
    ) {

        if (
            !model
        ) {

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

                console.error(
                    "[models-ui] selectModel error:",
                    error
                );

            }

        }


        return model;

    }


    function findModelById(
        modelId
    ) {

        const normalized =
            String(
                modelId ??
                ""
            )
                .trim()
                .toLowerCase();


        if (
            !normalized
        ) {

            return null;

        }


        return (
            state.models.find(
                function (
                    model
                ) {

                    return (
                        String(
                            model?.model_id ??
                            ""
                        )
                            .trim()
                            .toLowerCase() ===
                        normalized
                    );

                }
            ) ||
            null
        );

    }


    /* =====================================================
       PRICE
       -----------------------------------------------------
       models-ui hanya menyimpan pricing state.
       Credit calculation tetap milik
       GENZModelPriceCalculation.
    ===================================================== */

    async function initializePrice(
        options = {}
    ) {

        const price =
            getModelsPrice();


        if (
            !price
        ) {

            state.pricing =
                [];


            return [];

        }


        if (
            typeof price.loadPricing ===
                "function"
        ) {

            try {

                const pricing =
                    await price.loadPricing(
                        options
                    );


                state.pricing =
                    Array.isArray(
                        pricing
                    )
                        ? pricing
                        : [];


                return state.pricing;

            } catch (error) {

                console.warn(
                    "[models-ui] Pricing load warning:",
                    error
                );


                state.pricing =
                    [];


                return [];

            }

        }


        if (
            typeof price.initialize ===
                "function"
        ) {

            try {

                const result =
                    await price.initialize(
                        options
                    );


                if (
                    Array.isArray(
                        result
                    )
                ) {

                    state.pricing =
                        result;

                }


                return state.pricing;

            } catch (error) {

                console.warn(
                    "[models-ui] Pricing initialization warning:",
                    error
                );


                return state.pricing;

            }

        }


        return state.pricing;

    }


    function renderModelPrice(
        model,
        target
    ) {

        const price =
            getModelsPrice();


        if (
            !price
        ) {

            return false;

        }


        const element =
            typeof target ===
                "string"
                ? $(target)
                : target;


        if (
            !element
        ) {

            return false;

        }


        /*
         * models-price.js pada versi sekarang
         * menggunakan getModelPrice().
         *
         * Tetap dukung findPricingForModel()
         * apabila module lama masih memilikinya.
         */

        if (
            typeof price.getModelPrice ===
                "function"
        ) {

            try {

                const result =
                    price.getModelPrice(
                        model,
                        state.pricing
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
                        result?.usd != null
                            ? String(
                                result.usd
                            )
                            : "-";

                }


                return true;

            } catch (error) {

                console.warn(
                    "[models-ui] getModelPrice error:",
                    error
                );

            }

        }


        if (
            typeof price.findPricingForModel ===
                "function"
        ) {

            try {

                const pricing =
                    price.findPricingForModel(
                        model,
                        state.pricing
                    );


                if (
                    typeof price.renderPrice ===
                        "function"
                ) {

                    element.innerHTML =
                        price.renderPrice(
                            pricing
                        );

                }


                return true;

            } catch (error) {

                console.warn(
                    "[models-ui] findPricingForModel error:",
                    error
                );

            }

        }


        return false;

    }


    /* =====================================================
       BUTTONS
       -----------------------------------------------------
       models-init -> lifecycle.
       models-ui hanya memiliki tombol UI umum:
       Add dan Refresh.
       
       Row Edit/Delete bukan milik UI.
    ===================================================== */

    let buttonsBound =
        false;


    function executeHandler(
        handler,
        event
    ) {

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
                            "[models-ui] Async button error:",
                            error
                        );


                        notify(
                            "Terjadi kesalahan saat menjalankan aksi.",
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
                "Terjadi kesalahan saat menjalankan aksi.",
                "error"
            );

        }

    }


    function bindButton(
        ids,
        handler
    ) {

        if (
            !Array.isArray(
                ids
            )
        ) {

            ids = [
                ids
            ];

        }


        for (
            const id of ids
        ) {

            const button =
                $(id);


            if (
                !button
            ) {

                continue;

            }


            if (
                button.dataset
                    .genzUiBound ===
                "true"
            ) {

                continue;

            }


            button.dataset
                .genzUiBound =
                "true";


            button.addEventListener(
                "click",
                function (
                    event
                ) {

                    event.preventDefault();


                    executeHandler(
                        handler,
                        event
                    );

                }
            );

        }

    }


    function bindButtons() {

        if (
            buttonsBound
        ) {

            return true;

        }


        /*
         * ADD MODEL
         */

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

                return openModal();

            }
        );


        /*
         * REFRESH
         */

        bindButton(
            [

                "refreshBtn",

                "refreshModels",

                "refreshModelsButton",

                "refreshModelButton"

            ],
            function () {

                return refreshModels();

            }
        );


        buttonsBound =
            true;


        return true;

    }


    /* =====================================================
       INITIALIZE
       -----------------------------------------------------
       Lifecycle utama tetap di models-init.js.
       UI tidak lagi melakukan:
       - bind Form events
       - bind Search events
       - bind Table events
       - Provider dropdown rendering
       ===================================================== */

    async function initialize() {

        if (
            initializing
        ) {

            return initializing;

        }


        if (
            initialized
        ) {

            return true;

        }


        initializing =
            (async function () {

                try {

                    console.info(
                        "[models-ui] Initialization mulai..."
                    );


                    /*
                     * Tombol UI umum.
                     */

                    bindButtons();


                    /*
                     * Provider state.
                     *
                     * Tidak render dropdown.
                     */

                    syncProviderState();


                    /*
                     * Model catalog.
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
                     * Pricing catalog.
                     */

                    await initializePrice();


                    /*
                     * Final state synchronization.
                     */

                    syncProviderState();

                    syncSearchState();

                    syncTableState();

                    updateStatistics(
                        state.models
                    );


                    initialized =
                        true;


                    console.info(
                        "[GEN-Z.AI] Model Management UI READY"
                    );


                    try {

                        window.dispatchEvent(
                            new CustomEvent(
                                "genz-models-ui-ready"
                            )
                        );

                    } catch (
                        eventError
                    ) {

                        console.warn(
                            "[models-ui] UI ready event error:",
                            eventError
                        );

                    }


                    return true;

                } catch (error) {

                    initialized =
                        false;


                    console.error(
                        "[models-ui] Initialization error:",
                        error
                    );


                    notify(
                        "Model Management gagal diinisialisasi.",
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

                    } catch (
                        eventError
                    ) {

                        console.warn(
                            "[models-ui] UI error event gagal:",
                            eventError
                        );

                    }


                    throw error;

                } finally {

                    initializing =
                        null;

                }

            })();


        return initializing;

    }


    /* =====================================================
       RESET
    ===================================================== */

    function reset() {

        initialized =
            false;


        state.models =
            [];


        state.providers =
            [];


        state.pricing =
            [];


        state.loading =
            false;


        /*
         * Tombol tidak perlu dibind ulang
         * selama DOM element yang sama masih digunakan.
         */

        return true;

    }


    /* =====================================================
       PUBLIC API
    ===================================================== */

    window.GENZModelsUI =
        Object.freeze({

            initialize,

            reset,

            notify,

            openModal,

            openEditModal,

            closeModal,

            loadModels,

            refreshModels,

            loadProviders,

            updateStatistics,

            selectModel,

            findModelById,

            findProviderById,

            renderModelPrice,

            syncProviderState,

            syncSearchState,

            syncTableState,

            initializePrice,

            getModels:
                function () {

                    return [
                        ...state.models
                    ];

                },

            getProviders:
                function () {

                    return [
                        ...state.providers
                    ];

                },

            getPricing:
                function () {

                    return [
                        ...state.pricing
                    ];

                },

            isLoading:
                function () {

                    return (
                        state.loading
                    );

                },

            isInitialized:
                function () {

                    return (
                        initialized
                    );

                }

        });


    console.info(
        "[GEN-Z.AI] GENZModelsUI loaded."
    );

})();
