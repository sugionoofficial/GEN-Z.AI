/* =========================================================
   GEN-Z.AI
   ADMIN MODEL MANAGEMENT
   UI MODULE

   File:
   admin-control/models/models-ui.js

   ARCHITECTURE:
   - Provider ditangani GENZModelsProvider
   - Model catalog ditangani GENZModelsData
   - Search ditangani GENZModelsSearch
   - Form ditangani GENZModelsForm
   - Form Events ditangani GENZModelFormEvents
   - Table ditangani GENZModelTable
   - Table Events ditangani GENZModelTableEvents
   - Pricing ditangani GENZModelsPrice
   - UI hanya mengorkestrasi modul

   FIX:
   - Provider tidak query Supabase langsung dari UI
   - Provider module diprioritaskan
   - Provider tetap tersimpan di state UI
   - Model catalog dimuat sebelum search initialize
   - Search selalu menerima state.models
   - Manual Model ID tetap dapat digunakan
   - Tidak bergantung pada kie_models untuk mengetik Model ID
   - Initialization tidak dikunci sebelum benar-benar selesai
   - Aman terhadap module yang terlambat dimuat
   - Refresh tetap sinkron antara Provider, Model, Search dan Pricing
   - Form Events tidak lagi diduplikasi oleh UI
   - Table Events tidak lagi diduplikasi oleh UI
   - Provider dropdown tidak ditimpa oleh event module lain
========================================================= */

(function () {
    "use strict";

    let initialized = false;
    let initializing = null;

    const state = {
        models: [],
        providers: [],
        pricing: [],
        loading: false
    };

    function $(id) {
        return document.getElementById(id);
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

    function getModelsForm() {
        return window.GENZModelsForm || null;
    }

    function getModelsPrice() {
        return window.GENZModelsPrice || null;
    }

    function getFormEvents() {
        return window.GENZModelFormEvents || null;
    }

    function getTableEvents() {
        return window.GENZModelTableEvents || null;
    }

    /* =====================================================
       EMERGENCY ADD MODEL HANDLER
    ===================================================== */

    function bindEmergencyAddModel() {

        if (!document.body) {
            return;
        }

        if (
            document.body.dataset
                .genzEmergencyAddModelBound === "true"
        ) {
            return;
        }

        const handler = event => {

            const target =
                event.target.closest(
                    "#addModelBtn, #addModelButton, [data-action=\"add-model\"]"
                );

            if (!target) {
                return;
            }

            /*
             * Jika tombol sudah memiliki handler normal,
             * jangan mengambil alih.
             *
             * Emergency handler hanya digunakan
             * ketika tombol utama belum berhasil bekerja.
             */
            const form =
                getModelsForm();

            const modal =
                document.getElementById(
                    "modelModal"
                );

            if (!modal) {
                console.error(
                    "[models-ui] #modelModal tidak ditemukan."
                );

                return;
            }

            /*
             * Jangan menjalankan emergency handler
             * jika event sudah dicegah oleh handler utama.
             */
            if (event.defaultPrevented) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();

            if (
                form &&
                typeof form.openCreateForm ===
                    "function"
            ) {

                Promise.resolve(
                    form.openCreateForm()
                ).catch(error => {

                    console.error(
                        "[models-ui] openCreateForm error:",
                        error
                    );

                    showModalElement(
                        modal
                    );
                });

                return;
            }

            showModalElement(
                modal
            );
        };

        document.addEventListener(
            "click",
            handler,
            true
        );

        document.body.dataset
            .genzEmergencyAddModelBound =
            "true";
    }

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            bindEmergencyAddModel,
            {
                once: true
            }
        );

    } else {

        bindEmergencyAddModel();

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
                message;

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

            requestAnimationFrame(() => {

                existing.classList.add(
                    "show"
                );

            });

            window.clearTimeout(
                existing.__genzTimer
            );

            existing.__genzTimer =
                window.setTimeout(() => {

                    existing.classList.remove(
                        "show"
                    );

                }, duration);

            return;
        }

        const toast =
            document.createElement(
                "div"
            );

        toast.id =
            "modelNotification";

        toast.className =
            `genz-model-notification ${type}`;

        toast.textContent =
            message;

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
                background: "rgba(17,24,39,.96)",
                border: "1px solid rgba(255,255,255,.12)",
                color: "#fff",
                boxShadow:
                    "0 14px 40px rgba(0,0,0,.35)",
                fontSize: "14px",
                lineHeight: "1.45",
                pointerEvents: "none",
                transition:
                    "opacity .2s ease, transform .2s ease"
            }
        );

        document.body.appendChild(
            toast
        );

        window.setTimeout(() => {

            toast.style.opacity =
                "0";

            toast.style.transform =
                "translateY(8px)";

            window.setTimeout(() => {

                toast.remove();

            }, 250);

        }, duration);
    }

    /* =====================================================
       MODAL
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

        if (!modal) {
            return;
        }

        if (
            !modal.dataset
                .originalDisplay
        ) {

            const computed =
                window.getComputedStyle(
                    modal
                ).display;

            if (
                computed &&
                computed !== "none"
            ) {

                modal.dataset
                    .originalDisplay =
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
            modal.dataset
                .originalDisplay ||
            "flex";

        modal.setAttribute(
            "aria-hidden",
            "false"
        );

        document.body.classList.add(
            "modal-open"
        );
    }

    function hideModalElement(
        modal
    ) {

        if (!modal) {
            return;
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

        document.body.classList.remove(
            "modal-open"
        );
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

        showModalElement(
            getModal()
        );
    }

    function openEditModal(
        model
    ) {

        if (!model) {
            return;
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

        showModalElement(
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

        hideModalElement(
            getModal()
        );
    }

    /* =====================================================
       PROVIDERS
       Provider lifecycle dimiliki
       GENZModelsProvider
    ===================================================== */

    async function loadProviders(
        options = {}
    ) {

        const providerModule =
            getModelsProvider();

        /*
         * PRIORITAS UTAMA:
         * Gunakan Provider module jika tersedia.
         */
        if (
            providerModule &&
            typeof providerModule.loadProviders ===
                "function"
        ) {

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

                /*
                 * Sinkronisasi dropdown.
                 */
                if (
                    typeof providerModule.populateSelect ===
                        "function"
                ) {

                    providerModule.populateSelect(
                        state.providers
                    );

                } else {

                    populateProviderSelect(
                        state.providers
                    );

                }

                console.info(
                    "[models-ui] Provider loaded via GENZModelsProvider:",
                    state.providers.length
                );

                return state.providers;

            } catch (error) {

                console.error(
                    "[models-ui] Gagal memuat provider melalui GENZModelsProvider:",
                    error
                );

                state.providers = [];

                populateProviderSelect(
                    []
                );

                notify(
                    "Gagal memuat daftar provider.",
                    "error"
                );

                return [];
            }
        }

        /*
         * FALLBACK LEGACY
         */
        const data =
            getModelsData();

        if (
            !data ||
            typeof data.loadProviders !==
                "function"
        ) {

            console.warn(
                "[models-ui] GENZModelsProvider dan loadProviders belum tersedia."
            );

            return [];
        }

        try {

            const providers =
                await data.loadProviders({
                    force:
                        options.force === true,

                    activeOnly:
                        options.activeOnly !== false
                });

            state.providers =
                Array.isArray(
                    providers
                )
                    ? providers
                    : [];

            populateProviderSelect(
                state.providers
            );

            console.info(
                "[models-ui] Provider loaded via legacy fallback:",
                state.providers.length
            );

            return state.providers;

        } catch (error) {

            console.error(
                "[models-ui] Legacy provider load error:",
                error
            );

            state.providers = [];

            populateProviderSelect(
                []
            );

            notify(
                "Gagal memuat daftar provider.",
                "error"
            );

            return [];
        }
    }

    function populateProviderSelect(
        providers = state.providers
    ) {

        const providerModule =
            getModelsProvider();

        /*
         * Provider module adalah pemilik utama
         * dropdown Provider.
         */
        if (
            providerModule &&
            typeof providerModule.populateSelect ===
                "function"
        ) {

            try {

                const result =
                    providerModule.populateSelect(
                        providers
                    );

                state.providers =
                    Array.isArray(
                        providers
                    )
                        ? providers
                        : state.providers;

                return result;

            } catch (error) {

                console.error(
                    "[models-ui] Provider populateSelect error:",
                    error
                );

            }
        }

        /*
         * FALLBACK RENDERING
         */
        const select =
            $("providerId");

        if (
            !select ||
            select.tagName !== "SELECT"
        ) {

            console.warn(
                "[models-ui] #providerId tidak ditemukan."
            );

            return;
        }

        const currentValue =
            String(
                select.value || ""
            ).trim();

        const fragment =
            document.createDocumentFragment();

        const placeholder =
            document.createElement(
                "option"
            );

        placeholder.value =
            "";

        placeholder.textContent =
            "Pilih Provider";

        fragment.appendChild(
            placeholder
        );

        const list =
            Array.isArray(
                providers
            )
                ? providers
                : [];

        for (
            const provider of list
        ) {

            const providerId =
                String(
                    provider.provider_id ||
                    provider.provider ||
                    ""
                ).trim();

            if (!providerId) {
                continue;
            }

            const option =
                document.createElement(
                    "option"
                );

            option.value =
                providerId;

            option.textContent =
                provider.provider_name
                    ? `${provider.provider_name} (${providerId})`
                    : providerId;

            fragment.appendChild(
                option
            );
        }

        select.innerHTML =
            "";

        select.appendChild(
            fragment
        );

        if (currentValue) {

            const exists =
                Array.from(
                    select.options
                ).some(
                    option =>
                        option.value ===
                        currentValue
                );

            if (exists) {

                select.value =
                    currentValue;

            }
        }

        console.info(
            "[models-ui] Provider dropdown:",
            Math.max(
                0,
                select.options.length - 1
            )
        );
    }

    function findProviderById(
        providerId
    ) {

        const normalized =
            String(
                providerId || ""
            )
                .trim()
                .toLowerCase();

        if (!normalized) {
            return null;
        }

        const localProvider =
            state.providers.find(
                provider =>
                    String(
                        provider.provider_id ||
                        provider.provider ||
                        ""
                    )
                        .trim()
                        .toLowerCase() ===
                    normalized
            );

        if (localProvider) {
            return localProvider;
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
       MODEL DATA
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
                "[models-ui] loadKieModels belum tersedia."
            );

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

            console.info(
                "[models-ui] KIE models loaded:",
                state.models.length
            );

            updateStatistics(
                state.models
            );

            /*
             * Search selalu menerima
             * catalog terbaru.
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

                console.info(
                    "[models-ui] Search catalog synchronized:",
                    state.models.length
                );
            }

            /*
             * Table module juga menerima
             * catalog terbaru jika tersedia.
             */
            const table =
                window.GENZModelTable;

            if (
                table &&
                typeof table.setModels ===
                    "function"
            ) {

                try {

                    table.setModels(
                        state.models
                    );

                } catch (error) {

                    console.warn(
                        "[models-ui] Table synchronization warning:",
                        error
                    );

                }
            }

            return state.models;

        } catch (error) {

            console.error(
                "[models-ui] Gagal memuat model:",
                error
            );

            state.models = [];

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

                try {

                    table.setModels(
                        []
                    );

                } catch (tableError) {

                    console.warn(
                        "[models-ui] Table empty-state warning:",
                        tableError
                    );

                }
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
       PRICING
    ===================================================== */

    async function loadPricing() {

        const price =
            getModelsPrice();

        if (
            !price ||
            typeof price.loadPricing !==
                "function"
        ) {

            return [];
        }

        try {

            state.pricing =
                await price.loadPricing({
                    force: false
                });

            if (
                !Array.isArray(
                    state.pricing
                )
            ) {

                state.pricing = [];

            }

            return state.pricing;

        } catch (error) {

            console.error(
                "[models-ui] Pricing load error:",
                error
            );

            state.pricing =
                [];

            return [];
        }
    }

    async function initializePrice() {

        const price =
            getModelsPrice();

        if (
            !price ||
            typeof price.initialize !==
                "function"
        ) {

            return [];
        }

        try {

            const result =
                await price.initialize();

            state.pricing =
                Array.isArray(
                    result
                )
                    ? result
                    : [];

            return state.pricing;

        } catch (error) {

            console.error(
                "[models-ui] Price initialization error:",
                error
            );

            state.pricing =
                [];

            return [];
        }
    }

    /* =====================================================
       STATISTICS
    ===================================================== */

    function setText(
        ids,
        value
    ) {

        if (!Array.isArray(ids)) {
            ids = [ids];
        }

        for (
            const id of ids
        ) {

            const element =
                $(id);

            if (element) {

                element.textContent =
                    value;

            }
        }
    }

    function updateStatistics(
        models = state.models
    ) {

        if (
            !Array.isArray(
                models
            )
        ) {

            models = [];

        }

        const total =
            models.length;

        const active =
            models.filter(
                model =>
                    String(
                        model.status ||
                        ""
                    )
                        .toLowerCase() ===
                    "active"
            ).length;

        const inactive =
            models.filter(
                model =>
                    String(
                        model.status ||
                        ""
                    )
                        .toLowerCase() ===
                    "inactive"
            ).length;

        const maintenance =
            models.filter(
                model =>
                    String(
                        model.status ||
                        ""
                    )
                        .toLowerCase() ===
                    "maintenance"
            ).length;

        const providers =
            new Set(
                models
                    .map(
                        model =>
                            String(
                                model.provider ||
                                model.provider_id ||
                                ""
                            ).trim()
                    )
                    .filter(Boolean)
            ).size;

        setText(
            [
                "totalModels",
                "modelsTotal",
                "statTotalModels",
                "totalModelCount",
                "statTotal"
            ],
            total
        );

        setText(
            [
                "activeModels",
                "modelsActive",
                "statActiveModels",
                "activeModelCount",
                "statActive"
            ],
            active
        );

        setText(
            [
                "inactiveModels",
                "modelsInactive",
                "statInactiveModels",
                "inactiveModelCount",
                "statInactive"
            ],
            inactive
        );

        setText(
            [
                "maintenanceModels",
                "modelsMaintenance",
                "statMaintenanceModels",
                "statMaintenance"
            ],
            maintenance
        );

        setText(
            [
                "providerCount",
                "providersCount",
                "statProviders"
            ],
            providers
        );

        return {
            total,
            active,
            inactive,
            maintenance,
            providers
        };
    }

    /* =====================================================
       REFRESH
    ===================================================== */

    async function refreshModels() {

        const data =
            getModelsData();

        if (
            data &&
            typeof data.clearCache ===
                "function"
        ) {

            data.clearCache();

        }

        try {

            /*
             * Provider refresh.
             */
            const providers =
                await loadProviders({
                    force: true,
                    activeOnly: true
                });

            /*
             * Model refresh.
             */
            const models =
                await loadModels({
                    force: true,
                    activeOnly: false
                });

            /*
             * Pricing refresh.
             */
            await loadPricing();

            /*
             * Provider dropdown final sync.
             */
            populateProviderSelect(
                providers
            );

            /*
             * Search final sync.
             */
            const search =
                getModelsSearch();

            if (
                search &&
                typeof search.setModels ===
                    "function"
            ) {

                search.setModels(
                    models
                );
            }

            /*
             * Table final sync.
             */
            const table =
                window.GENZModelTable;

            if (
                table &&
                typeof table.setModels ===
                    "function"
            ) {

                try {

                    table.setModels(
                        models
                    );

                } catch (error) {

                    console.warn(
                        "[models-ui] Table refresh sync warning:",
                        error
                    );

                }
            }

            updateStatistics(
                models
            );

            notify(
                "Data model dan provider berhasil diperbarui.",
                "success"
            );

            return models;

        } catch (error) {

            console.error(
                "[models-ui] Refresh error:",
                error
            );

            notify(
                "Gagal memperbarui data model.",
                "error"
            );

            return [];
        }
    }

    /* =====================================================
       MODEL SELECTION
    ===================================================== */

    function selectModel(
        model
    ) {

        if (!model) {
            return null;
        }

        const form =
            getModelsForm();

        const search =
            getModelsSearch();

        if (
            search &&
            typeof search.selectModel ===
                "function"
        ) {

            search.selectModel(
                model
            );
        }

        if (
            form &&
            typeof form.setSelectedModel ===
                "function"
        ) {

            form.setSelectedModel(
                model
            );
        }

        const providerId =
            String(
                model.provider_id ||
                model.provider ||
                ""
            ).trim();

        if (providerId) {

            const provider =
                findProviderById(
                    providerId
                );

            const select =
                $("providerId");

            if (
                provider &&
                select
            ) {

                const value =
                    String(
                        provider.provider_id ||
                        provider.provider ||
                        ""
                    ).trim();

                if (value) {

                    select.value =
                        value;

                    select.dispatchEvent(
                        new Event(
                            "change",
                            {
                                bubbles: true
                            }
                        )
                    );
                }
            }
        }

        return model;
    }

    function findModelById(
        modelId
    ) {

        const normalized =
            String(
                modelId || ""
            )
                .trim()
                .toLowerCase();

        if (!normalized) {
            return null;
        }

        return (
            state.models.find(
                model =>
                    String(
                        model.model_id ||
                        ""
                    )
                        .trim()
                        .toLowerCase() ===
                    normalized
            ) ||
            null
        );
    }

    /* =====================================================
       PRICE RENDER
    ===================================================== */

    function renderModelPrice(
        model,
        target
    ) {

        const price =
            getModelsPrice();

        if (
            !price ||
            typeof price.findPricingForModel !==
                "function"
        ) {

            return;
        }

        const element =
            typeof target === "string"
                ? $(target)
                : target;

        if (!element) {
            return;
        }

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
    }

    /* =====================================================
       BUTTON EVENTS
       Hanya Add + Refresh.
       Close/Cancel sekarang milik
       GENZModelFormEvents.
    ===================================================== */

    function executeHandler(
        handler,
        event
    ) {

        try {

            const result =
                handler(event);

            if (
                result &&
                typeof result.then ===
                    "function"
            ) {

                result.catch(
                    error => {

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

        if (!Array.isArray(ids)) {
            ids = [ids];
        }

        for (
            const id of ids
        ) {

            const button =
                $(id);

            if (!button) {
                continue;
            }

            /*
             * Jangan menimpa listener yang
             * sudah dipasang module lain.
             */
            if (
                button.dataset
                    .genzUiBound === "true"
            ) {

                continue;
            }

            button.dataset
                .genzUiBound = "true";

            button.addEventListener(
                "click",
                event => {

                    /*
                     * Hanya handler UI sendiri.
                     */
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
            () => {

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
            () => {

                return refreshModels();

            }
        );
    }

    /* =====================================================
       ACTION FALLBACK
    ===================================================== */

    function bindActionFallback() {

        if (
            !document.body ||
            document.body.dataset
                .genzModelActionFallbackBound ===
                "true"
        ) {

            return;
        }

        document.body.dataset
            .genzModelActionFallbackBound =
            "true";

        document.addEventListener(
            "click",
            event => {

                const target =
                    event.target.closest(
                        "[data-action]"
                    );

                if (!target) {
                    return;
                }

                /*
                 * Jangan mengambil alih event
                 * yang sudah ditangani module utama.
                 */
                if (event.defaultPrevented) {
                    return;
                }

                const action =
                    String(
                        target.getAttribute(
                            "data-action"
                        ) || ""
                    )
                        .trim()
                        .toLowerCase();

                if (
                    action ===
                    "add-model"
                ) {

                    event.preventDefault();

                    openModal();

                    return;
                }

                /*
                 * Close-model sekarang dikelola
                 * GENZModelFormEvents.
                 *
                 * Fallback tetap ada hanya jika
                 * module event belum tersedia.
                 */
                if (
                    action ===
                    "close-model"
                ) {

                    const events =
                        getFormEvents();

                    if (
                        events &&
                        typeof events.bind ===
                            "function"
                    ) {

                        return;
                    }

                    event.preventDefault();

                    closeModal();

                    return;
                }
            }
        );
    }

    /* =====================================================
       MODAL EVENTS
       Event utama sekarang ditangani
       GENZModelFormEvents.
    ===================================================== */

    function bindModalEvents() {

        const events =
            getFormEvents();

        if (
            events &&
            typeof events.bind ===
                "function"
        ) {

            try {

                return events.bind();

            } catch (error) {

                console.warn(
                    "[models-ui] GENZModelFormEvents bind error:",
                    error
                );

            }
        }

        /*
         * Jangan membuat listener baru di sini.
         *
         * models-init.js akan menginisialisasi
         * GENZModelFormEvents.
         */

        return false;
    }

    /* =====================================================
       FORM INITIALIZATION
    ===================================================== */

    function bindFormEvents() {

        const form =
            getModelsForm();

        if (
            !form ||
            typeof form.initialize !==
                "function"
        ) {

            console.warn(
                "[models-ui] GENZModelsForm belum tersedia."
            );

            return false;
        }

        try {

            const result =
                form.initialize();

            /*
             * Support initialize()
             * synchronous maupun async.
             */
            if (
                result &&
                typeof result.then ===
                    "function"
            ) {

                return result
                    .then(() => {

                        /*
                         * Pastikan event module
                         * juga sudah aktif.
                         */
                        const events =
                            getFormEvents();

                        if (
                            events &&
                            typeof events.bind ===
                                "function"
                        ) {

                            events.bind();

                        }

                        console.info(
                            "[models-ui] Form initialized."
                        );

                        return true;

                    })
                    .catch(error => {

                        console.error(
                            "[models-ui] Form initialization error:",
                            error
                        );

                        return false;

                    });
            }

            /*
             * Form sudah initialize.
             * Event handler tetap diserahkan
             * kepada GENZModelFormEvents.
             */
            const events =
                getFormEvents();

            if (
                events &&
                typeof events.bind ===
                    "function"
            ) {

                events.bind();

            }

            console.info(
                "[models-ui] Form initialized."
            );

            return true;

        } catch (error) {

            console.error(
                "[models-ui] Form initialization error:",
                error
            );

            return false;
        }
    }

    /* =====================================================
       SEARCH INITIALIZATION
    ===================================================== */

    function bindSearchEvents() {

        const search =
            getModelsSearch();

        if (
            !search ||
            typeof search.initialize !==
                "function"
        ) {

            console.warn(
                "[models-ui] GENZModelsSearch belum tersedia."
            );

            return false;
        }

        try {

            /*
             * Pastikan catalog terbaru masuk
             * sebelum initialize.
             */
            if (
                typeof search.setModels ===
                    "function"
            ) {

                search.setModels(
                    state.models
                );
            }

            const result =
                search.initialize();

            if (
                result &&
                typeof result.then ===
                    "function"
            ) {

                return result
                    .then(() => {

                        console.info(
                            "[models-ui] Search initialized with",
                            state.models.length,
                            "catalog models."
                        );

                        return true;

                    })
                    .catch(error => {

                        console.error(
                            "[models-ui] Search initialization error:",
                            error
                        );

                        return false;

                    });
            }

            console.info(
                "[models-ui] Search initialized with",
                state.models.length,
                "catalog models."
            );

            return true;

        } catch (error) {

            console.error(
                "[models-ui] Search initialization error:",
                error
            );

            return false;
        }
    }

    /* =====================================================
       TABLE EVENTS
       Event utama sekarang ditangani
       GENZModelTableEvents.
    ===================================================== */

    function bindTableEvents() {

        const events =
            getTableEvents();

        if (
            events &&
            typeof events.bind ===
                "function"
        ) {

            try {

                return events.bind();

            } catch (error) {

                console.warn(
                    "[models-ui] GENZModelTableEvents bind error:",
                    error
                );

                return false;
            }
        }

        /*
         * Jangan membuat event listener tabel
         * langsung dari UI.
         *
         * models-init.js akan mengaktifkan
         * GENZModelTableEvents.
         */

        return false;
    }

    /* =====================================================
       PROVIDER STATE SYNC
    ===================================================== */

    function syncProviderState() {

        const providerModule =
            getModelsProvider();

        if (
            !providerModule
        ) {

            return state.providers;
        }

        try {

            if (
                typeof providerModule.getProviders ===
                    "function"
            ) {

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
            }

        } catch (error) {

            console.warn(
                "[models-ui] Provider state sync error:",
                error
            );
        }

        return state.providers;
    }

    /* =====================================================
       FULL INITIALIZATION
    ===================================================== */

    async function initialize() {

        if (initializing) {
            return initializing;
        }

        if (initialized) {
            return true;
        }

        initializing =
            (async () => {

                try {

                    console.info(
                        "[models-ui] Initialization mulai..."
                    );

                    /* =============================================
                       STEP 1
                       UI BASIC EVENTS

                       Hanya:
                       - Add
                       - Refresh

                       Form dan Table event ditangani
                       module masing-masing.
                    ============================================= */

                    bindButtons();

                    /*
                     * Action fallback tetap dipertahankan
                     * untuk tombol data-action.
                     */
                    bindActionFallback();

                    /* =============================================
                       STEP 2
                       PROVIDER STATE

                       Provider lifecycle sudah dilakukan
                       oleh GENZModelsInit.
                    ============================================= */

                    syncProviderState();

                    populateProviderSelect(
                        state.providers
                    );

                    console.info(
                        "[models-ui] Provider siap:",
                        state.providers.length
                    );

                    /* =============================================
                       STEP 3
                       MODEL CATALOG
                    ============================================= */

                    await loadModels({
                        force: false,
                        activeOnly: false
                    });

                    console.info(
                        "[models-ui] Model catalog siap:",
                        state.models.length
                    );

                    /* =============================================
                       STEP 4
                       PRICE
                    ============================================= */

                    await initializePrice();

                    /* =============================================
                       STEP 5
                       FORM

                       Form logic tetap dimiliki
                       GENZModelsForm.

                       Event logic dimiliki
                       GENZModelFormEvents.
                    ============================================= */

                    await bindFormEvents();

                    /* =============================================
                       STEP 6
                       SEARCH
                    ============================================= */

                    await bindSearchEvents();

                    /* =============================================
                       STEP 7
                       TABLE EVENTS

                       Edit/Delete/Select dimiliki
                       GENZModelTableEvents.
                    ============================================= */

                    bindTableEvents();

                    /* =============================================
                       STEP 8
                       FINAL SYNC
                    ============================================= */

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

                        try {

                            table.setModels(
                                state.models
                            );

                        } catch (error) {

                            console.warn(
                                "[models-ui] Final table sync warning:",
                                error
                            );
                        }
                    }

                    syncProviderState();

                    populateProviderSelect(
                        state.providers
                    );

                    /*
                     * Jangan menganggap initialized
                     * sebelum seluruh proses di atas selesai.
                     */
                    initialized =
                        true;

                    console.info(
                        "[GEN-Z.AI] Model Management READY"
                    );

                    window.dispatchEvent(
                        new CustomEvent(
                            "genz-models-ready"
                        )
                    );

                    return true;

                } catch (error) {

                    console.error(
                        "[models-ui] Initialization error:",
                        error
                    );

                    /*
                     * Jika ada kegagalan,
                     * initialization boleh dicoba kembali.
                     */
                    initialized =
                        false;

                    notify(
                        "Model Management gagal diinisialisasi.",
                        "error"
                    );

                    window.dispatchEvent(
                        new CustomEvent(
                            "genz-models-error",
                            {
                                detail:
                                    error
                            }
                        )
                    );

                    throw error;

                } finally {

                    initializing =
                        null;
                }

            })();

        return initializing;
    }

    /* =====================================================
       PUBLIC API
    ===================================================== */

    window.GENZModelsUI =
        Object.freeze({

            initialize,

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

            populateProviderSelect,

            syncProviderState,

            getModels: () =>
                [...state.models],

            getProviders: () =>
                [...state.providers],

            getPricing: () =>
                [...state.pricing],

            isLoading: () =>
                state.loading,

            isInitialized: () =>
                initialized
        });

})();
