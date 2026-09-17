/* =========================================================
   GEN-Z.AI
   ADMIN MODEL MANAGEMENT
   UI MODULE

   File:
   admin-control/models/models-ui.js

   Fungsi:
   - Modal management
   - Notification
   - Statistics
   - Refresh model data
   - Load provider dari public.providers
   - Hubungkan data/search/form/price module
   - Binding tombol Add / Close / Cancel / Refresh
   - Tidak menyimpan API key
========================================================= */

(function () {
    "use strict";

    let initialized = false;

    const state = {
        models: [],
        providers: [],
        pricing: [],
        loading: false
    };

    function $(id) {
        return document.getElementById(id);
    }

    function getModelsData() {
        return window.GENZModelsData || null;
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
            existing.textContent = message;

            existing.classList.remove(
                "success",
                "error",
                "warning",
                "info",
                "show"
            );

            existing.classList.add(type);

            requestAnimationFrame(() => {
                existing.classList.add("show");
            });

            window.clearTimeout(
                existing.__genzTimer
            );

            existing.__genzTimer =
                window.setTimeout(() => {
                    existing.classList.remove("show");
                }, duration);

            return;
        }

        const toast =
            document.createElement("div");

        toast.id = "modelNotification";

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
                pointerEvents: "none"
            }
        );

        document.body.appendChild(toast);

        window.setTimeout(() => {
            toast.style.opacity = "0";
            toast.style.transform =
                "translateY(8px)";
            toast.style.transition =
                "opacity .2s ease, transform .2s ease";

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

    function showModalElement(modal) {
        if (!modal) {
            return;
        }

        if (!modal.dataset.originalDisplay) {
            const computed =
                window.getComputedStyle(modal).display;

            if (
                computed &&
                computed !== "none"
            ) {
                modal.dataset.originalDisplay =
                    computed;
            }
        }

        modal.classList.add("show");
        modal.classList.remove("hidden");

        modal.style.display =
            modal.dataset.originalDisplay ||
            "flex";

        document.body.classList.add(
            "modal-open"
        );
    }

    function hideModalElement(modal) {
        if (!modal) {
            return;
        }

        modal.classList.remove("show");
        modal.classList.add("hidden");

        modal.style.display =
            "none";

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
            form.openCreateForm();
            return;
        }

        showModalElement(
            getModal()
        );
    }

    function openEditModal(model) {
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
            form.openEditForm(model);
            return;
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
            form.closeModal();
            return;
        }

        hideModalElement(
            getModal()
        );
    }

    /* =====================================================
       PROVIDER DATA
    ===================================================== */

    async function loadProviders(
        options = {}
    ) {
        const data =
            getModelsData();

        if (
            !data ||
            typeof data.loadProviders !==
                "function"
        ) {
            console.warn(
                "[models-ui] GENZModelsData.loadProviders belum tersedia."
            );

            return [];
        }

        try {
            state.providers =
                await data.loadProviders({
                    force:
                        options.force === true,
                    activeOnly:
                        options.activeOnly !== false
                });

            populateProviderSelect(
                state.providers
            );

            return state.providers;
        } catch (error) {
            console.error(
                "[models-ui] Gagal memuat provider:",
                error
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
        const select =
            $("providerId");

        if (
            !select ||
            select.tagName !== "SELECT"
        ) {
            return;
        }

        const currentValue =
            String(
                select.value || ""
            ).trim();

        const fragment =
            document.createDocumentFragment();

        const placeholder =
            document.createElement("option");

        placeholder.value = "";
        placeholder.textContent =
            "Pilih Provider";

        fragment.appendChild(
            placeholder
        );

        const list =
            Array.isArray(providers)
                ? providers
                : [];

        for (const provider of list) {
            const providerId =
                String(
                    provider.provider_id || ""
                ).trim();

            if (!providerId) {
                continue;
            }

            const option =
                document.createElement("option");

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

        select.innerHTML = "";

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

        return (
            state.providers.find(
                provider =>
                    String(
                        provider.provider_id || ""
                    )
                        .trim()
                        .toLowerCase() ===
                    normalized
            ) ||
            null
        );
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

        for (const id of ids) {
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
        if (!Array.isArray(models)) {
            models = [];
        }

        const total =
            models.length;

        const active =
            models.filter(
                model =>
                    String(
                        model.status || ""
                    ).toLowerCase() ===
                    "active"
            ).length;

        const inactive =
            models.filter(
                model =>
                    String(
                        model.status || ""
                    ).toLowerCase() ===
                    "inactive"
            ).length;

        const maintenance =
            models.filter(
                model =>
                    String(
                        model.status || ""
                    ).toLowerCase() ===
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
       PRICE DATA
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

            return state.pricing;
        } catch (error) {
            console.error(
                "[models-ui] Pricing load error:",
                error
            );

            return [];
        }
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
                "[models-ui] GENZModelsData belum tersedia."
            );

            return [];
        }

        state.loading = true;

        try {
            state.models =
                await data.loadKieModels(
                    options
                );

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

            return state.models;
        } catch (error) {
            console.error(
                "[models-ui] Gagal memuat model:",
                error
            );

            notify(
                "Gagal memuat daftar model dari Supabase.",
                "error"
            );

            return [];
        } finally {
            state.loading = false;
        }
    }

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
            const providers =
                await loadProviders({
                    force: true,
                    activeOnly: true
                });

            const models =
                await loadModels({
                    force: true,
                    activeOnly: false
                });

            await loadPricing();

            populateProviderSelect(
                providers
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

    function selectModel(model) {
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

            if (provider) {
                const select =
                    $("providerId");

                if (select) {
                    select.value =
                        provider.provider_id;

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
       PRICE RENDERING
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

        for (const id of ids) {
            const button =
                $(id);

            if (!button) {
                continue;
            }

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
                openModal();
            }
        );

        bindButton(
            [
                "closeModalBtn",
                "closeModelModal",
                "closeModalButton",
                "modelModalClose"
            ],
            () => {
                closeModal();
            }
        );

        bindButton(
            [
                "cancelModalBtn",
                "cancelModelButton",
                "cancelModelBtn",
                "cancelBtn"
            ],
            () => {
                closeModal();
            }
        );

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
       ADD MODEL FALLBACK
    ===================================================== */

    function bindActionFallback() {
        if (
            document.body.dataset
                .genzModelActionFallbackBound ===
            "true"
        ) {
            return;
        }

        document.body.dataset
            .genzModelActionFallbackBound = "true";

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

                if (
                    action ===
                    "close-model"
                ) {
                    event.preventDefault();

                    closeModal();

                    return;
                }
            }
        );
    }

    /* =====================================================
       GLOBAL MODAL EVENTS
    ===================================================== */

    function bindModalEvents() {
        if (
            document.body.dataset
                .genzModalEventsBound ===
            "true"
        ) {
            return;
        }

        document.body.dataset
            .genzModalEventsBound = "true";

        document.addEventListener(
            "click",
            event => {
                const modal =
                    getModal();

                if (!modal) {
                    return;
                }

                if (
                    !modal.classList.contains(
                        "show"
                    )
                ) {
                    return;
                }

                if (
                    event.target ===
                    modal
                ) {
                    closeModal();
                }
            }
        );

        document.addEventListener(
            "keydown",
            event => {
                if (
                    event.key !==
                    "Escape"
                ) {
                    return;
                }

                const modal =
                    getModal();

                if (
                    modal &&
                    modal.classList.contains(
                        "show"
                    )
                ) {
                    closeModal();
                }
            }
        );
    }

    /* =====================================================
       FORM EVENTS
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

            return;
        }

        try {
            form.initialize();
        } catch (error) {
            console.error(
                "[models-ui] Form initialization error:",
                error
            );
        }
    }

    /* =====================================================
       SEARCH EVENTS
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

            return;
        }

        try {
            search.initialize();
        } catch (error) {
            console.error(
                "[models-ui] Search initialization error:",
                error
            );
        }
    }

    /* =====================================================
       PRICE EVENTS
    ===================================================== */

    async function initializePrice() {
        const price =
            getModelsPrice();

        if (
            !price ||
            typeof price.initialize !==
                "function"
        ) {
            console.warn(
                "[models-ui] GENZModelsPrice belum tersedia."
            );

            return [];
        }

        try {
            state.pricing =
                await price.initialize();

            return state.pricing;
        } catch (error) {
            console.error(
                "[models-ui] Price initialization error:",
                error
            );

            return [];
        }
    }

    /* =====================================================
       TABLE EVENTS
    ===================================================== */

    function bindTableEvents() {
        const table =
            $("modelTableBody");

        if (!table) {
            return;
        }

        if (
            table.dataset
                .genzTableEventsBound ===
            "true"
        ) {
            return;
        }

        table.dataset
            .genzTableEventsBound = "true";

        table.addEventListener(
            "click",
            event => {
                const editButton =
                    event.target.closest(
                        "[data-model-edit]"
                    );

                if (editButton) {
                    event.preventDefault();

                    const modelId =
                        editButton.getAttribute(
                            "data-model-edit"
                        );

                    const model =
                        findModelById(
                            modelId
                        );

                    if (model) {
                        openEditModal(
                            model
                        );
                    }

                    return;
                }

                const selectButton =
                    event.target.closest(
                        "[data-model-select]"
                    );

                if (selectButton) {
                    event.preventDefault();

                    const modelId =
                        selectButton.getAttribute(
                            "data-model-select"
                        );

                    const model =
                        findModelById(
                            modelId
                        );

                    if (model) {
                        selectModel(
                            model
                        );
                    }
                }
            }
        );
    }

    /* =====================================================
       FULL INITIALIZATION
    ===================================================== */

    async function initialize() {
        if (initialized) {
            return;
        }

        initialized = true;

        try {
            bindButtons();
            bindActionFallback();
            bindModalEvents();
            bindFormEvents();
            bindSearchEvents();
            bindTableEvents();

            /*
             * Provider harus dimuat lebih dahulu
             * supaya <select id="providerId">
             * sudah mempunyai option ketika
             * model dipilih atau modal Edit dibuka.
             */
            await loadProviders({
                force: false,
                activeOnly: true
            });

            await loadModels({
                force: false,
                activeOnly: false
            });

            await initializePrice();

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

        } catch (error) {
            console.error(
                "[models-ui] Initialization error:",
                error
            );

            notify(
                "Model Management gagal diinisialisasi.",
                "error"
            );
        }
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

            getModels: () =>
                [...state.models],

            getProviders: () =>
                [...state.providers],

            getPricing: () =>
                [...state.pricing],

            isLoading: () =>
                state.loading
        });

    /*
     * TIDAK ADA AUTO START DI SINI.
     *
     * models-loader.js adalah orchestrator utama.
     *
     * Loader akan memanggil:
     *
     * GENZModelsInit.initialize()
     *
     * dan models-init.js akan memanggil:
     *
     * GENZModelsUI.initialize()
     */

})();
