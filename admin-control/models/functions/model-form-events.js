/* =========================================================
   GEN-Z.AI
   MODEL FORM EVENTS MODULE
   ---------------------------------------------------------
   File:
   admin-control/models/functions/model-form-events.js

   Tanggung jawab:
   - Event binding Model Form
   - Submit delegation
   - Provider change delegation
   - Model change delegation
   - Modal open / close
   - Cancel / Escape / Backdrop
   - Sinkronisasi data ke module lain

   Tidak bertanggung jawab:
   - Query Supabase
   - Render form
   - Create logic
   - Edit logic
   - Delete logic
   - Model Search logic
   - Provider lifecycle
   ========================================================= */

(function () {
    "use strict";

    let initialized = false;

    let handlers = {};

    let currentModels = [];
    let currentProviders = [];

    let currentRoot = null;

    let submitLocked = false;

    /* =========================================================
       BASIC HELPERS
       ========================================================= */

    function normalizeId(value) {
        if (
            value === null ||
            value === undefined
        ) {
            return "";
        }

        return String(value).trim();
    }

    function normalizeText(value) {
        if (
            value === null ||
            value === undefined
        ) {
            return "";
        }

        return String(value).trim();
    }

    function getForm(root = currentRoot) {
        if (
            root &&
            root instanceof Element
        ) {
            if (
                root.matches &&
                root.matches(
                    "form"
                )
            ) {
                return root;
            }

            const nestedForm =
                root.querySelector(
                    "#modelForm, #modelsForm, form[data-model-form]"
                );

            if (nestedForm) {
                return nestedForm;
            }
        }

        return (
            document.getElementById(
                "modelForm"
            ) ||
            document.getElementById(
                "modelsForm"
            ) ||
            document.querySelector(
                "form[data-model-form]"
            )
        );
    }

    function getRootElement(root = currentRoot) {
        return (
            root ||
            getForm() ||
            document
        );
    }

    function queryFirst(
        root,
        selectors
    ) {
        const container =
            root instanceof Element
                ? root
                : getRootElement();

        for (
            const selector of selectors
        ) {
            try {
                const element =
                    container.querySelector(
                        selector
                    );

                if (element) {
                    return element;
                }
            } catch (_) {
                /* ignore invalid selector */
            }
        }

        return null;
    }

    /* =========================================================
       MODULE ACCESS
       ========================================================= */

    function getCreateModule() {
        return (
            window.GENZModelFormCreate ||
            null
        );
    }

    function getEditModule() {
        return (
            window.GENZModelFormEdit ||
            null
        );
    }

    function getDeleteModule() {
        return (
            window.GENZModelDelete ||
            window.GENZModelFormDelete ||
            null
        );
    }

    function getCoordinator() {
        return (
            window.GENZModelFormCoordinator ||
            null
        );
    }

    function getLayout() {
        return (
            window.GENZModelFormLayout ||
            null
        );
    }

    function getSearchModule() {
        return (
            window.GENZModelsSearch ||
            window.GENZModelSearch ||
            null
        );
    }

    /* =========================================================
       DATA
       ========================================================= */

    function setData(data = {}) {
        if (
            Array.isArray(
                data.models
            )
        ) {
            currentModels =
                data.models;
        }

        if (
            Array.isArray(
                data.providers
            )
        ) {
            currentProviders =
                data.providers;
        }

        if (
            data.root !== undefined
        ) {
            currentRoot =
                data.root;
        }

        return getData();
    }

    function getData() {
        return {
            models:
                currentModels,
            providers:
                currentProviders,
            root:
                currentRoot
        };
    }

    /* =========================================================
       LISTENER REGISTRY
       ========================================================= */

    function registerListener(
        element,
        eventName,
        handler,
        options
    ) {
        if (!element) {
            return;
        }

        element.addEventListener(
            eventName,
            handler,
            options
        );

        handlers[
            `${eventName}:${getElementKey(element)}`
        ] = {
            element,
            eventName,
            handler,
            options
        };
    }

    function getElementKey(element) {
        if (!element) {
            return "unknown";
        }

        if (element.id) {
            return element.id;
        }

        if (
            element.dataset &&
            element.dataset.genzModelEventKey
        ) {
            return (
                element.dataset
                    .genzModelEventKey
            );
        }

        const key =
            `model-event-${Math.random()
                .toString(36)
                .slice(2)}`;

        try {
            element.dataset.genzModelEventKey =
                key;
        } catch (_) {
            return key;
        }

        return key;
    }

    function removeListenerRecord(
        record
    ) {
        if (
            !record ||
            !record.element
        ) {
            return;
        }

        record.element.removeEventListener(
            record.eventName,
            record.handler,
            record.options
        );
    }

    function unbind() {
        Object.keys(
            handlers
        ).forEach(key => {
            removeListenerRecord(
                handlers[key]
            );
        });

        handlers = {};

        initialized = false;

        submitLocked = false;
    }

    /* =========================================================
       MODAL
       ========================================================= */

    function getModal() {
        return (
            document.getElementById(
                "modelModal"
            ) ||
            document.querySelector(
                "[data-model-modal]"
            )
        );
    }

    function isModalOpen() {
        const modal =
            getModal();

        if (!modal) {
            return false;
        }

        return (
            modal.classList.contains(
                "show"
            ) ||
            modal.classList.contains(
                "active"
            ) ||
            modal.getAttribute(
                "aria-hidden"
            ) === "false" ||
            modal.style.display ===
                "flex" ||
            modal.style.display ===
                "block"
        );
    }

    function closeSearchDropdowns() {
        const search =
            getSearchModule();

        if (!search) {
            return;
        }

        const methods = [
            "close",
            "closeDropdown",
            "hideDropdown",
            "clearResults"
        ];

        for (
            const method of methods
        ) {
            if (
                typeof search[
                    method
                ] === "function"
            ) {
                try {
                    search[
                        method
                    ]();
                } catch (_) {
                    /* Search cleanup must not break modal close */
                }
            }
        }
    }

    function resetEditState() {
        const edit =
            getEditModule();

        if (!edit) {
            return;
        }

        try {
            if (
                typeof edit
                    .cancelEditModel ===
                "function"
            ) {
                edit.cancelEditModel();
                return;
            }

            if (
                typeof edit
                    .clearEditingModel ===
                "function"
            ) {
                edit.clearEditingModel();
            }
        } catch (_) {
            /* state cleanup must remain non-fatal */
        }
    }

    function resetCreateState() {
        const create =
            getCreateModule();

        if (!create) {
            return;
        }

        try {
            if (
                typeof create
                    .closeCreate ===
                "function"
            ) {
                create.closeCreate();
            }
        } catch (_) {
            /* state cleanup must remain non-fatal */
        }
    }

    function closeCoordinatorState() {
        const coordinator =
            getCoordinator();

        if (!coordinator) {
            return;
        }

        const methods = [
            "cancel",
            "reset",
            "clear",
            "resetFormState"
        ];

        for (
            const method of methods
        ) {
            if (
                typeof coordinator[
                    method
                ] === "function"
            ) {
                try {
                    coordinator[
                        method
                    ]();
                    break;
                } catch (_) {
                    /* try next compatible method */
                }
            }
        }
    }

    function closeModal(
        options = {}
    ) {
        const modal =
            getModal();

        /*
         * Jangan melakukan cleanup dua kali
         * jika close dipanggil dari cancel.
         */
        const cleanup =
            options.cleanup !== false;

        if (cleanup) {
            /*
             * Cancel Edit harus mengembalikan
             * original snapshot sebelum state dibuang.
             */
            resetEditState();

            /*
             * Create state juga harus ditutup.
             */
            resetCreateState();

            /*
             * Coordinator tidak boleh tertinggal
             * dalam mode edit/create.
             */
            closeCoordinatorState();

            closeSearchDropdowns();
        }

        if (!modal) {
            return false;
        }

        modal.classList.remove(
            "show",
            "active",
            "open"
        );

        modal.setAttribute(
            "aria-hidden",
            "true"
        );

        /*
         * Jangan menghapus display secara permanen
         * jika CSS menggunakan display default.
         */
        if (
            modal.style.display ===
                "flex" ||
            modal.style.display ===
                "block"
        ) {
            modal.style.display =
                "none";
        }

        /*
         * Bersihkan class body bila modal
         * sebelumnya menambahkannya.
         */
        document.body.classList.remove(
            "modal-open"
        );

        document.body.style.removeProperty(
            "overflow"
        );

        /*
         * Reset submit lock.
         */
        submitLocked = false;

        /*
         * Event kompatibilitas.
         */
        try {
            document.dispatchEvent(
                new CustomEvent(
                    "genz-model-modal-closed",
                    {
                        detail: {
                            modal,
                            reason:
                                options.reason ||
                                "programmatic"
                        }
                    }
                )
            );
        } catch (_) {
            /* CustomEvent compatibility */
        }

        return true;
    }

    function openModal(
        options = {}
    ) {
        const modal =
            getModal();

        if (!modal) {
            return false;
        }

        if (
            Array.isArray(
                options.models
            ) ||
            Array.isArray(
                options.providers
            ) ||
            options.root
        ) {
            setData(options);
        }

        modal.classList.add(
            "show"
        );

        modal.setAttribute(
            "aria-hidden",
            "false"
        );

        /*
         * Hanya set display jika sebelumnya
         * memang disembunyikan secara inline.
         */
        if (
            modal.style.display ===
                "none"
        ) {
            modal.style.display =
                "flex";
        }

        document.body.classList.add(
            "modal-open"
        );

        submitLocked = false;

        return true;
    }

    /* =========================================================
       MODEL LOOKUP
       ========================================================= */

    function getModelField(
        form
    ) {
        return queryFirst(
            form,
            [
                "#modelCodeSearch",
                "#modelId",
                "#model_id",
                "[name='model_id']",
                "[name='modelId']"
            ]
        );
    }

    function getCurrentModelId(
        form
    ) {
        const field =
            getModelField(form);

        if (!field) {
            return "";
        }

        return normalizeId(
            field.value
        );
    }

    function findCurrentModel(
        modelId
    ) {
        const target =
            normalizeId(
                modelId
            ).toLowerCase();

        if (!target) {
            return null;
        }

        return (
            currentModels.find(
                model => {
                    const id =
                        normalizeId(
                            model?.model_id ??
                            model?.modelId
                        ).toLowerCase();

                    return (
                        id === target
                    );
                }
            ) || null
        );
    }

    function getSelectedModelFromSearch() {
        const search =
            getSearchModule();

        if (!search) {
            return null;
        }

        const methods = [
            "getSelectedModel",
            "getSelectedResult",
            "getSelected",
            "getCurrentModel"
        ];

        for (
            const method of methods
        ) {
            if (
                typeof search[
                    method
                ] === "function"
            ) {
                try {
                    const result =
                        search[
                            method
                        ]();

                    if (
                        result &&
                        typeof result ===
                            "object"
                    ) {
                        return result;
                    }
                } catch (_) {
                    /* continue compatibility lookup */
                }
            }
        }

        return null;
    }

    /* =========================================================
       SUBMIT
       ========================================================= */

    async function handleSubmit(
        event
    ) {
        if (
            event &&
            typeof event.preventDefault ===
                "function"
        ) {
            event.preventDefault();
        }

        /*
         * Hentikan bubbling agar handler form
         * parent tidak ikut melakukan submit.
         */
        if (
            event &&
            typeof event.stopPropagation ===
                "function"
        ) {
            event.stopPropagation();
        }

        /*
         * Proteksi double submit.
         */
        if (submitLocked) {
            return false;
        }

        submitLocked = true;

        try {
            const coordinator =
                getCoordinator();

            const edit =
                getEditModule();

            const create =
                getCreateModule();

            /*
             * Coordinator adalah jalur utama.
             */
            if (coordinator) {
                if (
                    edit &&
                    typeof edit
                        .isEditing ===
                        "function" &&
                    edit.isEditing()
                ) {
                    if (
                        typeof coordinator
                            .updateFromForm ===
                        "function"
                    ) {
                        return await coordinator
                            .updateFromForm(
                                event
                            );
                    }
                }

                if (
                    typeof coordinator
                        .createFromForm ===
                    "function"
                ) {
                    return await coordinator
                        .createFromForm(
                            event
                        );
                }
            }

            /*
             * Fallback edit.
             */
            if (
                edit &&
                typeof edit.isEditing ===
                    "function" &&
                edit.isEditing()
            ) {
                if (
                    typeof edit
                        .updateFromForm ===
                    "function"
                ) {
                    return await edit
                        .updateFromForm(
                            event
                        );
                }

                if (
                    typeof edit
                        .submitEditModel ===
                    "function"
                ) {
                    return await edit
                        .submitEditModel(
                            event
                        );
                }
            }

            /*
             * Fallback create.
             */
            if (
                create &&
                typeof create
                    .createFromForm ===
                "function"
            ) {
                return await create
                    .createFromForm(
                        event
                    );
            }

            throw new Error(
                "Model Form Coordinator/Create/Edit module tidak tersedia."
            );
        } finally {
            /*
             * Beri kesempatan submit berikutnya
             * setelah promise selesai.
             */
            submitLocked = false;
        }
    }

    /* =========================================================
       PROVIDER CHANGE
       ========================================================= */

    function handleProviderChange(
        event
    ) {
        const form =
            getForm();

        if (!form) {
            return;
        }

        const layout =
            getLayout();

        if (
            layout &&
            typeof layout
                .handleProviderChange ===
            "function"
        ) {
            layout.handleProviderChange(
                form,
                currentModels,
                currentProviders
            );
        }

        /*
         * Provider change berarti hasil Search
         * sebelumnya tidak boleh dipertahankan.
         */
        closeSearchDropdowns();

        try {
            document.dispatchEvent(
                new CustomEvent(
                    "genz-model-provider-changed",
                    {
                        detail: {
                            providerId:
                                event?.target?.value ||
                                "",
                            form
                        }
                    }
                )
            );
        } catch (_) {
            /* compatibility */
        }
    }

    /* =========================================================
       MODEL CHANGE
       ========================================================= */

    function handleModelChange(
        event
    ) {
        const form =
            getForm();

        if (!form) {
            return;
        }

        const modelId =
            normalizeId(
                event?.target?.value ??
                getCurrentModelId(form)
            );

        if (!modelId) {
            return;
        }

        const layout =
            getLayout();

        /*
         * Layout tetap menjadi pemilik
         * sinkronisasi field Model.
         */
        if (
            layout &&
            typeof layout
                .updateSelectedModelFields ===
            "function"
        ) {
            layout.updateSelectedModelFields(
                form,
                currentModels
            );
        }

        /*
         * Coba currentModels dahulu.
         */
        let selected =
            findCurrentModel(
                modelId
            );

        /*
         * Jika Search module memiliki selected
         * result, gunakan result tersebut.
         *
         * Ini penting ketika hasil Search Supabase
         * belum dimasukkan ke currentModels.
         */
        if (!selected) {
            selected =
                getSelectedModelFromSearch();
        }

        /*
         * Jangan langsung menyatakan "not found"
         * hanya karena currentModels belum memuat
         * hasil Search.
         */
        if (
            selected &&
            normalizeId(
                selected.model_id ??
                selected.modelId
            ).toLowerCase() ===
                modelId.toLowerCase()
        ) {
            try {
                document.dispatchEvent(
                    new CustomEvent(
                        "genz-model-selected",
                        {
                            detail: {
                                model:
                                    selected,
                                modelId,
                                form
                            }
                        }
                    )
                );
            } catch (_) {
                /* compatibility */
            }

            return selected;
        }

        /*
         * Jika tidak ditemukan di local state,
         * event ini hanya memberi tahu Search /
         * Coordinator bahwa field berubah.
         *
         * Tidak melakukan query Supabase di sini.
         */
        try {
            document.dispatchEvent(
                new CustomEvent(
                    "genz-model-id-changed",
                    {
                        detail: {
                            modelId,
                            form
                        }
                    }
                )
            );
        } catch (_) {
            /* compatibility */
        }

        return null;
    }

    /* =========================================================
       MODEL INPUT
       ========================================================= */

    function handleModelInput(
        event
    ) {
        const value =
            normalizeText(
                event?.target?.value
            );

        /*
         * Search module adalah pemilik
         * pencarian as-you-type.
         *
         * Events module tidak melakukan query.
         */
        if (!value) {
            return;
        }

        /*
         * Jika exact match sudah ada,
         * sinkronkan field.
         */
        const model =
            findCurrentModel(
                value
            );

        if (model) {
            handleModelChange(
                event
            );
        }

        /*
         * Informasikan Search module.
         */
        try {
            document.dispatchEvent(
                new CustomEvent(
                    "genz-model-search-input",
                    {
                        detail: {
                            value,
                            form:
                                getForm()
                        }
                    }
                )
            );
        } catch (_) {
            /* compatibility */
        }
    }

    /* =========================================================
       CANCEL
       ========================================================= */

    function handleCancel(
        event
    ) {
        if (
            event &&
            typeof event.preventDefault ===
                "function"
        ) {
            event.preventDefault();
        }

        if (
            event &&
            typeof event.stopPropagation ===
                "function"
        ) {
            event.stopPropagation();
        }

        /*
         * Edit cancel harus melalui module Edit
         * agar original snapshot dipulihkan.
         */
        const edit =
            getEditModule();

        if (
            edit &&
            typeof edit.isEditing ===
                "function" &&
            edit.isEditing()
        ) {
            try {
                if (
                    typeof edit
                        .cancelEditModel ===
                    "function"
                ) {
                    edit.cancelEditModel();
                } else if (
                    typeof edit
                        .clearEditingModel ===
                    "function"
                ) {
                    edit.clearEditingModel();
                }
            } catch (_) {
                /* continue modal cleanup */
            }
        }

        resetCreateState();

        closeSearchDropdowns();

        closeCoordinatorState();

        closeModal({
            cleanup: false,
            reason: "cancel"
        });

        return false;
    }

    /* =========================================================
       CLOSE BUTTON
       ========================================================= */

    function handleClose(
        event
    ) {
        if (
            event &&
            typeof event.preventDefault ===
                "function"
        ) {
            event.preventDefault();
        }

        if (
            event &&
            typeof event.stopPropagation ===
                "function"
        ) {
            event.stopPropagation();
        }

        closeModal({
            cleanup: true,
            reason: "close"
        });

        return false;
    }

    /* =========================================================
       BACKDROP
       ========================================================= */

    function handleBackdrop(
        event
    ) {
        const modal =
            getModal();

        if (!modal) {
            return;
        }

        /*
         * Hanya klik tepat pada modal backdrop,
         * bukan child content.
         */
        if (
            event.target !== modal
        ) {
            return;
        }

        closeModal({
            cleanup: true,
            reason: "backdrop"
        });
    }

    /* =========================================================
       ESCAPE
       ========================================================= */

    function handleEscape(
        event
    ) {
        if (
            event.key !== "Escape" &&
            event.key !== "Esc"
        ) {
            return;
        }

        const modal =
            getModal();

        if (
            !modal ||
            !isModalOpen()
        ) {
            return;
        }

        /*
         * Jika dropdown Search sedang terbuka,
         * beri kesempatan Search menutupnya dulu.
         */
        const search =
            getSearchModule();

        if (
            search &&
            typeof search.isOpen ===
                "function"
        ) {
            try {
                if (
                    search.isOpen()
                ) {
                    closeSearchDropdowns();
                    event.preventDefault();
                    event.stopPropagation();
                    return;
                }
            } catch (_) {
                /* continue modal handling */
            }
        }

        event.preventDefault();

        closeModal({
            cleanup: true,
            reason: "escape"
        });
    }

    /* =========================================================
       BIND FORM
       ========================================================= */

    function bindSubmit(
        form
    ) {
        if (!form) {
            return;
        }

        handlers.submit = {
            element: form,
            eventName: "submit",
            handler: handleSubmit,
            options: false
        };

        form.addEventListener(
            "submit",
            handleSubmit,
            false
        );
    }

    function bindProvider(
        form
    ) {
        const provider =
            queryFirst(
                form,
                [
                    "#providerId",
                    "#provider_id",
                    "[name='provider_id']",
                    "[name='providerId']"
                ]
            );

        if (!provider) {
            return;
        }

        handlers.providerChange = {
            element: provider,
            eventName: "change",
            handler:
                handleProviderChange,
            options: false
        };

        provider.addEventListener(
            "change",
            handleProviderChange,
            false
        );
    }

    function bindModel(
        form
    ) {
        const model =
            queryFirst(
                form,
                [
                    "#modelCodeSearch",
                    "#modelId",
                    "#model_id",
                    "[name='model_id']",
                    "[name='modelId']"
                ]
            );

        if (!model) {
            return;
        }

        handlers.modelChange = {
            element: model,
            eventName: "change",
            handler:
                handleModelChange,
            options: false
        };

        handlers.modelInput = {
            element: model,
            eventName: "input",
            handler:
                handleModelInput,
            options: false
        };

        model.addEventListener(
            "change",
            handleModelChange,
            false
        );

        model.addEventListener(
            "input",
            handleModelInput,
            false
        );
    }

    function bindCloseButtons() {
        const modal =
            getModal();

        if (!modal) {
            return;
        }

        const closeButtons =
            modal.querySelectorAll(
                [
                    "[data-model-modal-close]",
                    "[data-modal-close]",
                    ".model-modal-close",
                    ".modal-close",
                    ".close-modal",
                    "#closeModelModal",
                    "#cancelModel"
                ].join(",")
            );

        closeButtons.forEach(
            (button, index) => {
                const key =
                    `close-${index}`;

                handlers[key] = {
                    element: button,
                    eventName: "click",
                    handler:
                        handleClose,
                    options: false
                };

                button.addEventListener(
                    "click",
                    handleClose,
                    false
                );
            }
        );
    }

    function bindCancelButtons() {
        const modal =
            getModal();

        if (!modal) {
            return;
        }

        const cancelButtons =
            modal.querySelectorAll(
                [
                    "[data-model-cancel]",
                    "[data-cancel-model]",
                    "[data-action='cancel-model']",
                    ".model-cancel",
                    "#cancelModel"
                ].join(",")
            );

        cancelButtons.forEach(
            (button, index) => {
                const key =
                    `cancel-${index}`;

                /*
                 * Hindari double handler jika
                 * tombol juga ditemukan sebagai close.
                 */
                if (
                    handlers[key]
                ) {
                    return;
                }

                handlers[key] = {
                    element: button,
                    eventName: "click",
                    handler:
                        handleCancel,
                    options: false
                };

                button.addEventListener(
                    "click",
                    handleCancel,
                    false
                );
            }
        );
    }

    function bindBackdrop() {
        const modal =
            getModal();

        if (!modal) {
            return;
        }

        handlers.backdrop = {
            element: modal,
            eventName: "click",
            handler:
                handleBackdrop,
            options: false
        };

        modal.addEventListener(
            "click",
            handleBackdrop,
            false
        );
    }

    function bindEscape() {
        handlers.escape = {
            element: document,
            eventName: "keydown",
            handler:
                handleEscape,
            options: false
        };

        document.addEventListener(
            "keydown",
            handleEscape,
            false
        );
    }

    /* =========================================================
       BIND
       ========================================================= */

    function bind(
        options = {}
    ) {
        /*
         * Bersihkan binding lama terlebih dahulu.
         *
         * Ini mencegah event submit terpasang
         * dua kali setelah re-render / update data.
         */
        unbind();

        currentRoot =
            options.root ||
            currentRoot ||
            getForm();

        if (
            Array.isArray(
                options.models
            ) ||
            Array.isArray(
                options.providers
            )
        ) {
            setData(options);
        }

        const form =
            getForm(
                currentRoot
            );

        if (form) {
            bindSubmit(form);
            bindProvider(form);
            bindModel(form);
        }

        bindCloseButtons();
        bindCancelButtons();
        bindBackdrop();
        bindEscape();

        initialized = true;

        return true;
    }

    /* =========================================================
       INITIALIZE
       ========================================================= */

    function initialize(
        options = {}
    ) {
        setData(options);

        /*
         * Pastikan state create/edit yang stale
         * tidak ikut terbawa dari lifecycle sebelumnya.
         *
         * Hanya dilakukan jika explicit reset diminta
         * atau belum ada modal aktif.
         */
        if (
            options.resetState === true
        ) {
            resetEditState();
            resetCreateState();
        }

        return bind(options);
    }

    /* =========================================================
       UPDATE DATA
       ========================================================= */

    function updateData(
        data = {}
    ) {
        setData(data);

        const form =
            getForm(
                currentRoot
            );

        const layout =
            getLayout();

        if (
            form &&
            layout
        ) {
            if (
                typeof layout
                    .updateModelIdOptions ===
                "function"
            ) {
                layout.updateModelIdOptions(
                    form,
                    currentModels
                );
            }

            if (
                typeof layout
                    .updateProviderStatus ===
                "function"
            ) {
                layout.updateProviderStatus(
                    form,
                    currentProviders
                );
            }

            if (
                typeof layout
                    .updateCreditFinalPreview ===
                "function"
            ) {
                layout.updateCreditFinalPreview(
                    form
                );
            }
        }

        /*
         * Search module boleh menerima data baru,
         * tetapi tetap menjadi pemilik Search.
         */
        const search =
            getSearchModule();

        if (
            search &&
            typeof search.setData ===
                "function"
        ) {
            try {
                search.setData({
                    models:
                        currentModels,
                    providers:
                        currentProviders
                });
            } catch (_) {
                /* Search update is non-fatal */
            }
        }

        return getData();
    }

    /* =========================================================
       DESTROY
       ========================================================= */

    function destroy() {
        unbind();

        /*
         * Jangan menghapus data models/providers,
         * karena data tersebut dimiliki lifecycle
         * Models page.
         */
        currentRoot = null;

        submitLocked = false;

        return true;
    }

    /* =========================================================
       PUBLIC API
       ========================================================= */

    const API = {
        initialize,
        bind,
        unbind,
        destroy,

        setData,
        getData,
        updateData,

        openModal,
        closeModal,
        isModalOpen,

        handleSubmit,
        handleProviderChange,
        handleModelChange,
        handleModelInput,
        handleCancel,
        handleClose,
        handleBackdrop,
        handleEscape,

        getForm,

        get initialized() {
            return initialized;
        }
    };

    window.GENZModelFormEvents =
        API;

})();
