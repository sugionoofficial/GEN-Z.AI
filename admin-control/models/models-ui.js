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
   - Lifecycle utama ditangani GENZModelsInit
   - UI hanya mengorkestrasi tampilan dan state

   IMPORTANT:
   - models-ui TIDAK menjadi owner dropdown Provider
   - models-ui TIDAK merender Provider setelah Provider module
     selesai melakukan load
   - models-ui hanya menyimpan/sinkronisasi state Provider
   - Provider rendering dimiliki GENZModelsProvider
   - Form/Search/Table lifecycle tetap dimiliki models-init.js
   - Tidak ada double initialization
   - Tidak ada double Provider rendering
   - Identifier Provider mendukung UUID maupun provider_id
   - Model catalog tetap disinkronkan ke Search dan Table
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
                    existing.classList.remove(
                        "show"
                    );
                }, duration);

            return;
        }

        const toast =
            document.createElement("div");

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

        document.body.appendChild(toast);

        window.setTimeout(() => {
            if (!toast) {
                return;
            }

            toast.style.opacity = "0";
            toast.style.transform =
                "translateY(8px)";

            window.setTimeout(() => {
                if (
                    toast &&
                    toast.parentNode
                ) {
                    toast.remove();
                }
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

        modal.classList.add("show");
        modal.classList.remove("hidden");

        modal.style.display =
            modal.dataset.originalDisplay ||
            "flex";

        modal.setAttribute(
            "aria-hidden",
            "false"
        );

        if (document.body) {
            document.body.classList.add(
                "modal-open"
            );
        }
    }

    function hideModalElement(
        modal
    ) {
        if (!modal) {
            return;
        }

        modal.classList.remove("show");
        modal.classList.add("hidden");

        modal.style.display =
            "none";

        modal.setAttribute(
            "aria-hidden",
            "true"
        );

        if (document.body) {
            document.body.classList.remove(
                "modal-open"
            );
        }
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
       PROVIDER
       
       OWNER:
       GENZModelsProvider

       models-ui hanya:
       - meminta load
       - menyimpan state
       - membaca provider

       models-ui TIDAK melakukan render dropdown
       setelah GENZModelsProvider selesai load.
    ===================================================== */

    async function loadProviders(
        options = {}
    ) {
        const providerModule =
            getModelsProvider();

        /*
         * =================================================
         * PRIMARY PROVIDER MODULE
         * =================================================
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
                    Array.isArray(providers)
                        ? providers
                        : [];

                /*
                 * IMPORTANT:
                 *
                 * Jangan panggil populateSelect()
                 * di sini.
                 *
                 * GENZModelsProvider.loadProviders()
                 * sudah menjadi owner Provider lifecycle
                 * dan dropdown rendering.
                 */

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

                /*
                 * Jangan merender ulang dropdown.
                 * Provider module tetap menjadi owner.
                 */

                notify(
                    "Gagal memuat daftar provider.",
                    "error"
                );

                return [];
            }
        }

        /*
         * =================================================
         * LEGACY FALLBACK
         *
         * Hanya digunakan jika Provider module
         * memang belum tersedia.
         * =================================================
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
                Array.isArray(providers)
                    ? providers
                    : [];

            /*
             * Legacy fallback masih memakai helper
             * agar halaman lama tidak langsung rusak.
             *
             * Jalur ini tidak digunakan ketika
             * GENZModelsProvider tersedia.
             */

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

            populateProviderSelect([]);

            notify(
                "Gagal memuat daftar provider.",
                "error"
            );

            return [];
        }
    }

    /*
     * =====================================================
     * LEGACY COMPATIBILITY
     *
     * Fungsi ini tetap tersedia karena mungkin masih
     * dipanggil module lama.
     *
     * Jika GENZModelsProvider tersedia, fungsi ini
     * mendelegasikan sepenuhnya ke Provider module.
     * =====================================================
     */

    function populateProviderSelect(
        providers = state.providers
    ) {
        const providerModule =
            getModelsProvider();

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
                    Array.isArray(providers)
                        ? providers
                        : state.providers;

                return result;
            } catch (error) {
                console.error(
                    "[models-ui] Provider populateSelect error:",
                    error
                );

                return;
            }
        }

        /*
         * =================================================
         * TRUE LEGACY FALLBACK
         * =================================================
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

        for (
            const provider of list
        ) {
            if (!provider) {
                continue;
            }

            /*
             * Provider ID dapat berbentuk:
             *
             * provider.provider_id
             * provider.provider
             * provider.id
             */

            const providerId =
                String(
                    provider.provider_id ||
                    provider.provider ||
                    provider.id ||
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

            /*
             * Simpan metadata tambahan.
             */

            if (provider.id) {
                option.dataset.providerUuid =
                    String(
                        provider.id
                    );
            }

            if (provider.provider_id) {
                option.dataset.providerId =
                    String(
                        provider.provider_id
                    );
            }

            if (provider.provider_name) {
                option.dataset.providerName =
                    String(
                        provider.provider_name
                    );
            }

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

        console.info(
            "[models-ui] Legacy Provider dropdown:",
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

        /*
         * =================================================
         * LOCAL STATE LOOKUP
         *
         * Support:
         * - UUID providers.id
         * - providers.provider_id
         * - provider
         * - provider_name
         * =================================================
         */

        const localProvider =
            state.providers.find(
                provider => {
                    if (!provider) {
                        return false;
                    }

                    const values = [
                        provider.id,
                        provider.provider_id,
                        provider.provider,
                        provider.provider_name
                    ];

                    return values.some(
                        value =>
                            String(
                                value || ""
                            )
                                .trim()
                                .toLowerCase() ===
                            normalized
                    );
                }
            );

        if (localProvider) {
            return localProvider;
        }

        /*
         * =================================================
         * PROVIDER MODULE LOOKUP
         * =================================================
         */

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

        state.loading = true;

        try {
            const models =
                await data.loadKieModels(
                    options
                );

            state.models =
                Array.isArray(models)
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
             * =================================================
             * SEARCH SYNCHRONIZATION
             * =================================================
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
             * =================================================
             * TABLE SYNCHRONIZATION
             * =================================================
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
                search.setModels([]);
            }

            const table =
                window.GENZModelTable;

            if (
                table &&
                typeof table.setModels ===
                    "function"
            ) {
                try {
                    table.setModels([]);
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
            state.loading = false;
        }
    }

    /* =====================================================
       REFRESH
    ===================================================== */

    async function refreshModels() {
        console.info(
            "[models-ui] Refresh Models..."
        );

        /*
         * Provider refresh
         */

        await loadProviders({
            force: true,
            activeOnly: false
        });

        /*
         * Model refresh
         */

        await loadModels({
            force: true,
            activeOnly: false
        });

        /*
         * Pricing refresh
         */

        await initializePrice({
            force: true
        });

        /*
         * Provider state terakhir.
         *
         * Jangan render dropdown lagi.
         * GENZModelsProvider sudah menangani UI Provider.
         */

        syncProviderState();

        /*
         * Search catalog final sync
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
         * Table catalog final sync
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
                    "[models-ui] Refresh table sync warning:",
                    error
                );
            }
        }

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
                model =>
                    String(
                        model?.status ||
                        ""
                    )
                        .trim()
                        .toLowerCase() ===
                    "active"
            ).length;

        const inactive =
            total - active;

        const totalEl =
            $(
                "totalModels"
            ) ||
            $(
                "modelTotal"
            ) ||
            $(
                "modelsTotal"
            );

        const activeEl =
            $(
                "activeModels"
            ) ||
            $(
                "modelActive"
            ) ||
            $(
                "modelsActive"
            );

        const inactiveEl =
            $(
                "inactiveModels"
            ) ||
            $(
                "modelInactive"
            ) ||
            $(
                "modelsInactive"
            );

        if (totalEl) {
            totalEl.textContent =
                String(total);
        }

        if (activeEl) {
            activeEl.textContent =
                String(active);
        }

        if (inactiveEl) {
            inactiveEl.textContent =
                String(inactive);
        }

        /*
         * Generic data-stat support.
         */

        document
            .querySelectorAll(
                "[data-model-stat]"
            )
            .forEach(
                element => {
                    const stat =
                        String(
                            element.getAttribute(
                                "data-model-stat"
                            ) || ""
                        )
                            .trim()
                            .toLowerCase();

                    if (
                        stat ===
                        "total"
                    ) {
                        element.textContent =
                            String(total);
                    }

                    if (
                        stat ===
                        "active"
                    ) {
                        element.textContent =
                            String(active);
                    }

                    if (
                        stat ===
                        "inactive"
                    ) {
                        element.textContent =
                            String(inactive);
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
                        model?.model_id ||
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
            typeof target ===
                "string"
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
       PRICE
    ===================================================== */

    async function initializePrice(
        options = {}
    ) {
        const price =
            getModelsPrice();

        if (!price) {
            state.pricing = [];

            return [];
        }

        /*
         * Jika module pricing menyediakan
         * loadPricing(), gunakan itu.
         */

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
                    Array.isArray(pricing)
                        ? pricing
                        : [];

                return state.pricing;
            } catch (error) {
                console.warn(
                    "[models-ui] Pricing load warning:",
                    error
                );

                state.pricing = [];

                return [];
            }
        }

        /*
         * Jika module pricing hanya memiliki
         * initialize(), tetap kompatibel.
         */

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
                    Array.isArray(result)
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

    /* =====================================================
       BUTTON EVENTS
       
       UI hanya menangani:
       - Add
       - Refresh

       Close/Cancel:
       GENZModelFormEvents

       Edit/Delete/Select:
       GENZModelTableEvents
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
             * Hindari duplicate listener.
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
       
       Hanya untuk action yang belum dimiliki
       module event utama.
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

                if (
                    event.defaultPrevented
                ) {
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

                /*
                 * ADD MODEL
                 */

                if (
                    action ===
                    "add-model"
                ) {
                    event.preventDefault();

                    openModal();

                    return;
                }

                /*
                 * CLOSE MODEL
                 *
                 * Form Events adalah owner jika
                 * tersedia.
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
       LEGACY COMPATIBILITY HELPERS
       
       Tetap diekspos untuk module lama.
       Tidak dipanggil dari initialize().
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

        return false;
    }

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

            if (
                result &&
                typeof result.then ===
                    "function"
            ) {
                return result
                    .then(
                        () => true
                    )
                    .catch(
                        error => {
                            console.error(
                                "[models-ui] Form initialization error:",
                                error
                            );

                            return false;
                        }
                    );
            }

            return result !== false;
        } catch (error) {
            console.error(
                "[models-ui] Form initialization error:",
                error
            );

            return false;
        }
    }

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
                    .then(
                        () => true
                    )
                    .catch(
                        error => {
                            console.error(
                                "[models-ui] Search initialization error:",
                                error
                            );

                            return false;
                        }
                    );
            }

            return result !== false;
        } catch (error) {
            console.error(
                "[models-ui] Search initialization error:",
                error
            );

            return false;
        }
    }

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

        return false;
    }

    /* =====================================================
       PROVIDER STATE SYNC
       
       Hanya membaca state dari Provider module.
       Tidak melakukan render.
    ===================================================== */

    function syncProviderState() {
        const providerModule =
            getModelsProvider();

        if (!providerModule) {
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
       
       OWNER:
       GENZModelsInit

       models-ui hanya:
       - bind tombol UI
       - sinkronisasi state Provider
       - load catalog
       - load pricing
       - update statistics
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
                       BASIC UI EVENTS
                    ============================================= */

                    bindButtons();

                    bindActionFallback();

                    /* =============================================
                       STEP 2
                       PROVIDER STATE
                       
                       Provider lifecycle sudah dilakukan
                       oleh GENZModelsInit.

                       Tidak render dropdown di sini.
                    ============================================= */

                    syncProviderState();

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
                       
                       Lifecycle tetap milik
                       GENZModelsInit.
                    ============================================= */

                    console.info(
                        "[models-ui] Form lifecycle delegated to GENZModelsInit."
                    );

                    /* =============================================
                       STEP 6
                       SEARCH
                       
                       UI hanya mengirim catalog.
                    ============================================= */

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

                    console.info(
                        "[models-ui] Search catalog synchronized:",
                        state.models.length
                    );

                    /* =============================================
                       STEP 7
                       TABLE
                       
                       UI hanya mengirim catalog.
                    ============================================= */

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
                                "[models-ui] Initial table sync warning:",
                                error
                            );
                        }
                    }

                    /* =============================================
                       STEP 8
                       FINAL STATE SYNC
                       
                       Tidak render Provider.
                    ============================================= */

                    updateStatistics(
                        state.models
                    );

                    syncProviderState();

                    /*
                     * Jangan memanggil:
                     *
                     * populateProviderSelect()
                     *
                     * di sini.
                     *
                     * Provider module sudah menjadi
                     * owner dropdown.
                     */

                    initialized = true;

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

                    initialized = false;

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
                    initializing = null;
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
