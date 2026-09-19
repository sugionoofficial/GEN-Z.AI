/* =========================================================
   GEN-Z.AI
   ADMIN MODEL MANAGEMENT
   UI MODULE

   File:
   admin-control/models/models-ui.js

   TANGGUNG JAWAB:
   - UI state
   - Notification
   - Modal orchestration
   - Load/sinkronisasi catalog
   - Sinkronisasi Provider state
   - Statistics
   - Pricing state
   - Refresh
   - Tombol UI umum Add / Refresh

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
   Form Create    -> GENZModelFormCreate
   Form Edit      -> GENZModelFormEdit
   Form Events    -> GENZModelFormEvents
   Form Layout    -> GENZModelFormLayout
   Table          -> GENZModelTable
   Table Events   -> GENZModelTableEvents
   Pricing        -> GENZModelsPrice
   Lifecycle      -> GENZModelsInit

   PRINSIP:
   Satu fungsi = satu owner.
   models-ui hanya mengorkestrasi state dan tampilan.

   CATATAN:
   GENZModelsForm legacy tidak digunakan lagi oleh UI.
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


    function getFormEvents() {

        return (
            window.GENZModelFormEvents ||
            null
        );

    }


    function getFormLayout() {

        return (
            window.GENZModelFormLayout ||
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
       MODAL DOM
       -----------------------------------------------------
       UI memiliki helper DOM modal saja.
       Lifecycle form tetap didelegasikan ke:
       - GENZModelFormCreate
       - GENZModelFormEdit
       - GENZModelFormEvents
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


    /* =====================================================
       CREATE MODAL
       -----------------------------------------------------
       Add Model:
       UI
        -> FormCreate.reset()
        -> FormLayout.refresh()
        -> Modal DOM
        -> FormEvents menangani submit
    ===================================================== */

    async function openModal() {

        const create =
            getFormCreate();


        if (
            create &&
            typeof create.reset ===
                "function"
        ) {

            try {

                create.reset();

            } catch (error) {

                console.warn(
                    "[models-ui] FormCreate.reset error:",
                    error
                );

            }

        }


        const layout =
            getFormLayout();


        if (
            layout &&
            typeof layout.refresh ===
                "function"
        ) {

            try {

                await layout.refresh();

            } catch (error) {

                console.warn(
                    "[models-ui] FormLayout.refresh error:",
                    error
                );

            }

        }


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


        const opened =
            showModalElement(
                modal
            );


        if (
            opened
        ) {

            const searchInput =
                $("modelCodeSearch");


            if (
                searchInput
            ) {

                window.setTimeout(
                    function () {

                        try {

                            searchInput.focus();

                        } catch (error) {

                            console.warn(
                                "[models-ui] modelCodeSearch focus error:",
                                error
                            );

                        }

                    },
                    50
                );

            }

        }


        return opened;

    }


    /* =====================================================
       EDIT MODAL
       -----------------------------------------------------
       Edit owner:
       GENZModelFormEdit
    ===================================================== */

    async function openEditModal(
        model
    ) {

        if (
            !model
        ) {

            notify(
                "Model tidak ditemukan.",
                "error"
            );

            return false;

        }


        const edit =
            getFormEdit();


        if (
            !edit ||
            typeof edit.open !==
                "function"
        ) {

            notify(
                "Module form edit belum tersedia.",
                "error"
            );

            return false;

        }


        try {

            const result =
                await edit.open(
                    model
                );


            if (
                result === false
            ) {

                return false;

            }


            /*
             * FormEdit saat ini dapat membuka modal
             * sendiri. Jika implementasi tersebut tidak
             * membuka DOM modal, pastikan modal terlihat.
             */
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
                "[models-ui] openEditModal error:",
                error
            );


            notify(
                error?.message ||
                "Gagal membuka form edit model.",
                "error"
            );


            return false;

        }

    }


    /* =====================================================
       CLOSE MODAL
       -----------------------------------------------------
       FormEvents menjadi owner close event.
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

                console.error(
                    "[models-ui] FormEvents.closeModal error:",
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


            await loadProviders(
                {

                    force:
                        true,

                    activeOnly:
                        false

                }
            );


            await loadModels(
                {

                    force:
                        true,

                    activeOnly:
                        false

                }
            );


            syncProviderState();

            syncSearchState();

            syncTableState();

            updateStatistics(
                state.models
            );


            bindButtons();


            /*
             * Beri tahu halaman bahwa data model
             * sudah diperbarui.
             */
            try {

                window.dispatchEvent(
                    new CustomEvent(
                        "genz-models-refreshed",
                        {
                            detail: {
                                providers:
                                    [...state.providers],

                                models:
                                    [...state.models]
                            }
                        }
                    )
                );

            } catch (eventError) {

                console.warn(
                    "[models-ui] refresh event error:",
                    eventError
                );

            }


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

        } catch (error) {

            console.error(
                "[models-ui] Refresh error:",
                error
            );


            notify(
                error?.message ||
                "Gagal melakukan refresh model.",
                "error"
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

                    const values = [

                        model?.id,

                        model?.model_id,

                        model?.model_name

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
            ) ||
            null
        );

    }


    /* =====================================================
       PRICE
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
       UI umum:
       - Add
       - Refresh

       Row Edit/Delete tetap dimiliki:
       GENZModelTableEvents
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
                            error?.message ||
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
                error?.message ||
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


        let found =
            false;


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


            found =
                true;


            /*
             * Jika listener sudah terpasang,
             * jangan membuat listener kedua.
             */
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


                    executeHandler(
                        handler,
                        event
                    );

                }
            );

        }


        return found;

    }


    function bindButtons() {

        let anyBound =
            false;


        /*
         * ADD MODEL
         */
        const addBound =
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


        if (
            addBound
        ) {

            anyBound =
                true;

        }


        /*
         * REFRESH
         */
        const refreshBound =
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


        if (
            refreshBound
        ) {

            anyBound =
                true;

        }


        /*
         * Jangan pernah menyatakan binding berhasil
         * jika tombol memang belum ada.
         */
        buttonsBound =
            anyBound ||
            document.querySelector(
                "[data-genz-ui-button-bound='true']"
            ) !== null;


        return buttonsBound;

    }


    /* =====================================================
       INITIALIZE
       -----------------------------------------------------
       Lifecycle utama tetap di models-init.js.
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

            bindButtons();

            return true;

        }


        initializing =
            (async function () {

                try {

                    console.info(
                        "[models-ui] Initialization mulai..."
                    );


                    /*
                     * Bind tombol secepat mungkin.
                     *
                     * Penting karena models-init dapat
                     * memulai UI sebelum semua elemen
                     * DOM selesai tersedia.
                     */
                    bindButtons();


                    /*
                     * Sinkronisasi Provider.
                     *
                     * Tidak mengambil alih Provider loader.
                     */
                    syncProviderState();


                    /*
                     * Load model catalog.
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
                     * Final synchronization.
                     */
                    syncProviderState();

                    syncSearchState();

                    syncTableState();

                    updateStatistics(
                        state.models
                    );


                    /*
                     * Tombol dicoba lagi setelah seluruh
                     * initialization selesai.
                     */
                    bindButtons();


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


                    /*
                     * Event tambahan untuk kompatibilitas
                     * halaman lama yang mendengarkan
                     * genz-models-ready.
                     */
                    try {

                        window.dispatchEvent(
                            new CustomEvent(
                                "genz-models-ready"
                            )
                        );

                    } catch (
                        eventError
                    ) {

                        console.warn(
                            "[models-ui] models-ready event error:",
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
                        error?.message ||
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
         * Listener DOM yang sudah terpasang tetap valid.
         * Dataset sengaja tidak dihapus.
         */
        buttonsBound =
            false;


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

            bindButtons,

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
