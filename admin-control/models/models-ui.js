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
   - Hubungkan data/search/form/price module
   - Tidak menyimpan API key
========================================================= */

(function () {
    "use strict";

    let initialized = false;

    const state = {
        models: [],
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

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
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
                '[data-model-modal]'
            )
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

        const modal =
            getModal();

        if (!modal) {
            return;
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

    function openEditModal(model) {
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

        const modal =
            getModal();

        if (!modal) {
            return;
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

        const modal =
            getModal();

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

        document.body.classList.remove(
            "modal-open"
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
                return;
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
                "totalModelCount"
            ],
            total
        );

        setText(
            [
                "activeModels",
                "modelsActive",
                "statActiveModels",
                "activeModelCount"
            ],
            active
        );

        setText(
            [
                "inactiveModels",
                "modelsInactive",
                "statInactiveModels",
                "inactiveModelCount"
            ],
            inactive
        );

        setText(
            [
                "maintenanceModels",
                "modelsMaintenance",
                "statMaintenanceModels"
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

        const models =
            await loadModels({
                force: true,
                activeOnly: false
            });

        await loadPricing();

        notify(
            "Data model berhasil diperbarui.",
            "success"
        );

        return models;
    }

    /* =====================================================
       MODEL SELECTION
    ===================================================== */

    function selectModel(model) {
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
                return;
            }

            button.dataset
                .genzUiBound = "true";

            button.addEventListener(
                "click",
                event => {
                    event.preventDefault();

                    try {
                        handler(event);
                    } catch (error) {
                        console.error(
                            "[models-ui] Button error:",
                            error
                        );
                    }
                }
            );

            return;
        }
    }

    function bindButtons() {
        bindButton(
            [
                "addModelButton",
                "addModelBtn",
                "createModelButton"
            ],
            () => {
                openModal();
            }
        );

        bindButton(
            [
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
                "cancelModelButton",
                "cancelModelBtn"
            ],
            () => {
                closeModal();
            }
        );

        bindButton(
            [
                "refreshModels",
                "refreshModelsButton",
                "refreshModelButton"
            ],
            () => {
                refreshModels();
            }
        );
    }

    /* =====================================================
       GLOBAL MODAL EVENTS
    ===================================================== */

    function bindModalEvents() {
        document.addEventListener(
            "click",
            event => {
                const modal =
                    getModal();

                if (
                    !modal ||
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
                    event.key ===
                    "Escape"
                ) {
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
       FULL INITIALIZATION
    ===================================================== */

    async function initialize() {
        if (initialized) {
            return;
        }

        initialized = true;

        try {
            bindButtons();
            bindModalEvents();
            bindFormEvents();
            bindSearchEvents();

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

            updateStatistics,

            selectModel,
            findModelById,

            renderModelPrice,

            getModels: () =>
                [...state.models],

            getPricing: () =>
                [...state.pricing],

            isLoading: () =>
                state.loading
        });

    /* =====================================================
       AUTO START
    ===================================================== */

    function start() {
        initialize();
    }

    if (
        document.readyState ===
        "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            start,
            {
                once: true
            }
        );
    } else {
        start();
    }
})();
