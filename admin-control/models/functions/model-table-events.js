/**
 * =========================================================
 * GEN-Z.AI
 * MODEL TABLE EVENTS
 * ---------------------------------------------------------
 * File:
 * admin-control/models/functions/model-table-events.js
 *
 * Tanggung jawab:
 * - Event Edit
 * - Event Delete
 * - Event delegation pada tabel Models
 * - Delegasi operasi ke Models UI / Form Coordinator
 *
 * Tidak bertanggung jawab:
 * - Query Supabase
 * - Render tabel
 * - Render form
 * - Delete langsung ke database
 * - Update langsung ke database
 * =========================================================
 */

(function () {
    "use strict";

    let initialized = false;
    let boundContainer = null;
    let boundClickHandler = null;

    let operationLocked = false;


    /* =====================================================
     * UTILITIES
     * ===================================================== */

    function getContainer(container) {

        if (container instanceof Element) {
            return container;
        }

        if (
            typeof container === "string" &&
            container.trim()
        ) {
            return document.querySelector(
                container
            );
        }

        /*
         * Coba beberapa selector umum.
         */
        const selectors = [
            "#models-table",
            "#modelsTable",
            "[data-models-table]",
            ".models-table",
            "table"
        ];

        for (const selector of selectors) {

            const element =
                document.querySelector(
                    selector
                );

            if (element) {
                return element;
            }
        }

        return null;
    }


    function getModelsUI() {

        return (
            window.GENZModelsUI ||
            null
        );
    }


    function getFormCoordinator() {

        return (
            window.GENZModelFormCoordinator ||
            null
        );
    }


    function getModelData() {

        return (
            window.GENZModelsData ||
            null
        );
    }


    function getModelIdFromElement(element) {

        if (!element) {
            return null;
        }

        /*
         * Prioritas:
         * data-model-id
         * data-id
         * data-model
         */
        const modelId =
            element.dataset?.modelId ||
            element.dataset?.id ||
            element.dataset?.model;

        if (modelId) {
            return modelId;
        }

        /*
         * Cari parent row.
         */
        const row =
            element.closest(
                "tr"
            );

        if (!row) {
            return null;
        }

        return (
            row.dataset?.modelId ||
            row.dataset?.id ||
            row.dataset?.model ||
            row.querySelector(
                "[data-model-id]"
            )?.dataset?.modelId ||
            row.querySelector(
                "[data-id]"
            )?.dataset?.id ||
            null
        );
    }


    async function resolveModel(modelId) {

        if (
            modelId === null ||
            modelId === undefined ||
            modelId === ""
        ) {
            return null;
        }

        const data =
            getModelData();

        if (!data) {
            return null;
        }

        /*
         * Database UUID.
         */
        if (
            typeof data.getModelById ===
            "function"
        ) {

            const byId =
                await data.getModelById(
                    modelId
                );

            if (byId) {
                return byId;
            }
        }

        /*
         * Model ID seperti:
         * grok-imagine/image-to-video
         */
        if (
            typeof data.getModelByModelId ===
            "function"
        ) {

            const byModelId =
                await data.getModelByModelId(
                    modelId
                );

            if (byModelId) {
                return byModelId;
            }
        }

        /*
         * Fallback ke cache.
         */
        if (
            typeof data.getCachedModels ===
            "function"
        ) {

            const models =
                data.getCachedModels();

            return (
                models.find(
                    model =>
                        String(model.id) ===
                            String(modelId) ||
                        String(model.model_id) ===
                            String(modelId)
                ) ||
                null
            );
        }

        return null;
    }


    function lockOperation() {

        if (operationLocked) {
            return false;
        }

        operationLocked = true;

        return true;
    }


    function unlockOperation() {

        operationLocked = false;
    }


    /* =====================================================
     * EDIT
     * ===================================================== */

    async function triggerEdit(modelId, element = null) {

        if (
            modelId === null ||
            modelId === undefined ||
            modelId === ""
        ) {
            return false;
        }

        if (!lockOperation()) {
            return false;
        }

        try {

            const model =
                await resolveModel(
                    modelId
                );

            if (!model) {
                throw new Error(
                    `Model tidak ditemukan: ${modelId}`
                );
            }

            const ui =
                getModelsUI();

            if (
                ui &&
                typeof ui.openEditModel ===
                "function"
            ) {

                await ui.openEditModel(
                    model
                );

                return true;
            }

            if (
                ui &&
                typeof ui.openEdit ===
                "function"
            ) {

                await ui.openEdit(
                    model
                );

                return true;
            }

            const coordinator =
                getFormCoordinator();

            if (
                coordinator &&
                typeof coordinator.openEdit ===
                "function"
            ) {

                await coordinator.openEdit(
                    model
                );

                return true;
            }

            if (
                coordinator &&
                typeof coordinator.openEditModel ===
                "function"
            ) {

                await coordinator.openEditModel(
                    model
                );

                return true;
            }

            throw new Error(
                "Module Edit Model tidak tersedia."
            );

        } finally {

            unlockOperation();
        }
    }


    /* =====================================================
     * DELETE
     * ===================================================== */

    async function triggerDelete(modelId, element = null) {

        if (
            modelId === null ||
            modelId === undefined ||
            modelId === ""
        ) {
            return false;
        }

        if (!lockOperation()) {
            return false;
        }

        try {

            const model =
                await resolveModel(
                    modelId
                );

            if (!model) {
                throw new Error(
                    `Model tidak ditemukan: ${modelId}`
                );
            }

            const ui =
                getModelsUI();

            if (
                ui &&
                typeof ui.openDeleteModel ===
                "function"
            ) {

                await ui.openDeleteModel(
                    model
                );

                return true;
            }

            if (
                ui &&
                typeof ui.openDelete ===
                "function"
            ) {

                await ui.openDelete(
                    model
                );

                return true;
            }

            const coordinator =
                getFormCoordinator();

            if (
                coordinator &&
                typeof coordinator.remove ===
                "function"
            ) {

                await coordinator.remove(
                    model
                );

                return true;
            }

            if (
                coordinator &&
                typeof coordinator.removeById ===
                "function"
            ) {

                await coordinator.removeById(
                    model.id
                );

                return true;
            }

            /*
             * Fallback ke delete module.
             */
            const deleteModule =
                window.GENZModelFormDelete;

            if (
                deleteModule &&
                typeof deleteModule.openDelete ===
                "function"
            ) {

                await deleteModule.openDelete(
                    model
                );

                return true;
            }

            throw new Error(
                "Module Delete Model tidak tersedia."
            );

        } finally {

            unlockOperation();
        }
    }


    /* =====================================================
     * CLICK HANDLER
     * ===================================================== */

    async function handleClick(event) {

        if (!event) {
            return;
        }

        const target =
            event.target instanceof Element
                ? event.target
                : null;

        if (!target) {
            return;
        }

        /*
         * Edit
         */
        const editButton =
            target.closest(
                [
                    "[data-action='edit-model']",
                    "[data-action='edit']",
                    "[data-model-action='edit']",
                    ".btn-edit-model",
                    ".edit-model",
                    "[data-edit-model]"
                ].join(",")
            );

        if (editButton) {

            event.preventDefault();
            event.stopPropagation();

            const modelId =
                getModelIdFromElement(
                    editButton
                );

            if (!modelId) {
                console.warn(
                    "[GEN-Z.AI Models] " +
                    "Model ID untuk Edit tidak ditemukan."
                );

                return;
            }

            try {

                await triggerEdit(
                    modelId,
                    editButton
                );

            } catch (error) {

                console.error(
                    "[GEN-Z.AI Models] " +
                    "Edit gagal:",
                    error
                );

                showError(
                    error
                );
            }

            return;
        }


        /*
         * Delete
         */
        const deleteButton =
            target.closest(
                [
                    "[data-action='delete-model']",
                    "[data-action='delete']",
                    "[data-model-action='delete']",
                    ".btn-delete-model",
                    ".delete-model",
                    "[data-delete-model]"
                ].join(",")
            );

        if (deleteButton) {

            event.preventDefault();
            event.stopPropagation();

            const modelId =
                getModelIdFromElement(
                    deleteButton
                );

            if (!modelId) {
                console.warn(
                    "[GEN-Z.AI Models] " +
                    "Model ID untuk Delete tidak ditemukan."
                );

                return;
            }

            try {

                await triggerDelete(
                    modelId,
                    deleteButton
                );

            } catch (error) {

                console.error(
                    "[GEN-Z.AI Models] " +
                    "Delete gagal:",
                    error
                );

                showError(
                    error
                );
            }
        }
    }


    function showError(error) {

        const message =
            error?.message ||
            "Operasi Model gagal.";

        const ui =
            getModelsUI();

        if (
            ui &&
            typeof ui.showAlert ===
            "function"
        ) {

            ui.showAlert(
                message,
                "error"
            );

            return;
        }

        console.error(
            "[GEN-Z.AI Models]",
            message
        );
    }


    /* =====================================================
     * BIND
     * ===================================================== */

    function bind(container = null) {

        /*
         * Jika sudah terpasang pada container yang sama,
         * tidak perlu memasang listener kedua.
         */
        const resolvedContainer =
            getContainer(
                container
            );

        if (!resolvedContainer) {

            /*
             * Tabel mungkin belum dirender.
             * Jangan dianggap fatal.
             */
            return false;
        }

        if (
            boundContainer ===
            resolvedContainer &&
            boundClickHandler
        ) {
            initialized = true;
            return true;
        }

        unbind();

        boundContainer =
            resolvedContainer;

        boundClickHandler =
            handleClick;

        boundContainer.addEventListener(
            "click",
            boundClickHandler
        );

        initialized = true;

        return true;
    }


    /* =====================================================
     * UNBIND
     * ===================================================== */

    function unbind() {

        if (
            boundContainer &&
            boundClickHandler
        ) {

            boundContainer.removeEventListener(
                "click",
                boundClickHandler
            );
        }

        boundContainer = null;
        boundClickHandler = null;

        initialized = false;

        return true;
    }


    /* =====================================================
     * INITIALIZE
     * ===================================================== */

    function initialize(container = null) {

        /*
         * initialize() wajib tersedia karena
         * models-init.js dapat memanggilnya.
         */
        return bind(
            container
        );
    }


    /* =====================================================
     * REBIND
     * ===================================================== */

    function rebind(container = null) {

        unbind();

        return bind(
            container
        );
    }


    /* =====================================================
     * DESTROY
     * ===================================================== */

    function destroy() {

        unbind();

        operationLocked = false;

        return true;
    }


    /* =====================================================
     * STATE
     * ===================================================== */

    function isInitialized() {

        return initialized;
    }


    function isBusy() {

        return operationLocked;
    }


    function getContainerElement() {

        return boundContainer;
    }


    /* =====================================================
     * PUBLIC API
     * ===================================================== */

    const ModelTableEvents = {

        /*
         * Primary lifecycle API
         */
        initialize,
        bind,
        unbind,
        rebind,
        destroy,

        /*
         * State
         */
        isInitialized,
        isBusy,
        getContainerElement,

        /*
         * Actions
         */
        triggerEdit,
        triggerDelete,

        /*
         * Event handler
         */
        handleClick
    };


    /*
     * Browser global.
     */
    window.GENZModelTableEvents =
        ModelTableEvents;


})();
