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

    function isElement(value) {
        return (
            typeof Element !== "undefined" &&
            value instanceof Element
        );
    }

    function getForm(root = currentRoot) {
        if (isElement(root)) {
            if (
                typeof root.matches === "function" &&
                root.matches("form")
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
            document.getElementById("modelForm") ||
            document.getElementById("modelsForm") ||
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

    function queryFirst(root, selectors) {
        const container = isElement(root)
            ? root
            : getRootElement();

        for (const selector of selectors) {
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

    function queryAll(root, selectors) {
        const container = isElement(root)
            ? root
            : getRootElement();

        const result = [];

        for (const selector of selectors) {
            try {
                container
                    .querySelectorAll(selector)
                    .forEach(element => {
                        if (
                            !result.includes(
                                element
                            )
                        ) {
                            result.push(
                                element
                            );
                        }
                    });
            } catch (_) {
                /* ignore invalid selector */
            }
        }

        return result;
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
            Array.isArray(data.models)
        ) {
            currentModels =
                data.models;
        }

        if (
            Array.isArray(data.providers)
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

    function getElementKey(element) {
        if (!element) {
            return "unknown";
        }

        if (element.id) {
            return element.id;
        }

        if (
            element.dataset &&
            element.dataset
                .genzModelEventKey
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
            element.dataset
                .genzModelEventKey =
                key;
        } catch (_) {
            return key;
        }

        return key;
    }

    function registerListener(
        element,
        eventName,
        handler,
        options = false,
        key = null
    ) {
        if (!element) {
            return false;
        }

        const recordKey =
            key ||
            `${eventName}:${getElementKey(
                element
            )}`;

        if (
            handlers[recordKey]
        ) {
            removeListenerRecord(
                handlers[recordKey]
            );
        }

        element.addEventListener(
            eventName,
            handler,
            options
        );

        handlers[recordKey] = {
            element,
            eventName,
            handler,
            options
        };

        return true;
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

        try {
            record.element.removeEventListener(
                record.eventName,
                record.handler,
                record.options
            );
        } catch (_) {
            /* non-fatal */
        }
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
            modal.classList.contains(
                "open"
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
            "hideDropdown"
        ];

        for (const method of methods) {
            if (
                typeof search[method] ===
                "function"
            ) {
                try {
                    search[method]();
                } catch (_) {
                    /* search cleanup is non-fatal */
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
            /*
             * cancelEditModel harus diprioritaskan
             * karena module Edit memiliki original
             * snapshot yang perlu dipulihkan.
             */
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
            /* state cleanup remains non-fatal */
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
            /* state cleanup remains non-fatal */
        }
    }

    function closeCoordinatorState() {
        const coordinator =
            getCoordinator();

        if (!coordinator) {
            return;
        }

        /*
         * Hanya panggil method yang memang tersedia.
         *
         * Jangan memanggil submit/create/update
         * dari sini karena dapat menyebabkan lifecycle
         * recursive.
         */
        const methods = [
            "cancel",
            "reset",
            "clear",
            "resetFormState"
        ];

        for (const method of methods) {
            if (
                typeof coordinator[method] ===
                "function"
            ) {
                try {
                    coordinator[method]();
                    return;
                } catch (_) {
                    /* try compatible fallback */
                }
            }
        }
    }

    function closeModal(options = {}) {
        const modal =
            getModal();

        const cleanup =
            options.cleanup !== false;

        if (cleanup) {
            /*
             * Urutan penting:
             *
             * 1. Edit mengembalikan snapshot.
             * 2. Create dibersihkan.
             * 3. Coordinator dibersihkan.
             * 4. Search dropdown ditutup.
             */
            resetEditState();
            resetCreateState();
            closeCoordinatorState();
            closeSearchDropdowns();
        }

        if (!modal) {
            submitLocked = false;
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
         * Hanya mengubah display jika modal
         * memang menggunakan inline display.
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

        document.body.classList.remove(
            "modal-open"
        );

        document.body.style.removeProperty(
            "overflow"
        );

        submitLocked = false;

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

    function openModal(options = {}) {
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
            options.root !== undefined
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
       MODEL FIELD
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

    function getModelIdFromObject(
        model
    ) {
        if (!model) {
            return "";
        }

        return normalizeId(
            model.model_id ??
            model.modelId ??
            model.id
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
                    return (
                        getModelIdFromObject(
                            model
                        ).toLowerCase() ===
                        target
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

        for (const method of methods) {
            if (
                typeof search[method] ===
                "function"
            ) {
                try {
                    const result =
                        search[method]();

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

    function getSelectedModelFromEvent(
        event
    ) {
        const detail =
            event?.detail;

        if (!detail) {
            return null;
        }

        if (
            detail.model &&
            typeof detail.model ===
                "object"
        ) {
            return detail.model;
        }

        if (
            detail.result &&
            typeof detail.result ===
                "object"
        ) {
            return detail.result;
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

        if (
            event &&
            typeof event.stopPropagation ===
                "function"
        ) {
            event.stopPropagation();
        }

        /*
         * Jangan gunakan stopImmediatePropagation
         * karena module lain dapat memiliki listener
         * yang memang dibutuhkan untuk lifecycle.
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
             *
             * Penting:
             * jika sedang edit, jangan pernah
             * menjalankan createFromForm.
             */
            if (coordinator) {
                const editing =
                    edit &&
                    typeof edit.isEditing ===
                        "function" &&
                    edit.isEditing();

                if (editing) {
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
                } else {
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
            }

            /*
             * Fallback Edit.
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
             * Fallback Create.
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
             * Lock hanya aktif selama operasi
             * async berlangsung.
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
            try {
                layout.handleProviderChange(
                    form,
                    currentModels,
                    currentProviders
                );
            } catch (_) {
                /* layout synchronization is non-fatal */
            }
        }

        /*
         * Provider berubah.
         * Hasil search dari provider sebelumnya
         * tidak boleh dipakai lagi.
         */
        closeSearchDropdowns();

        try {
            document.dispatchEvent(
                new CustomEvent(
                    "genz-model-provider-changed",
                    {
                        detail: {
                            providerId:
                                normalizeId(
                                    event?.target
                                        ?.value
                                ),
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
            return null;
        }

        const modelFromEvent =
            getSelectedModelFromEvent(
                event
            );

        const modelId =
            normalizeId(
                event?.target?.value ??
                event?.detail?.modelId ??
                getModelIdFromObject(
                    modelFromEvent
                ) ??
                getCurrentModelId(form)
            );

        if (!modelId) {
            return null;
        }

        /*
         * Model dari event Search memiliki prioritas
         * karena hasil tersebut bisa berasal langsung
         * dari Supabase dan belum berada di currentModels.
         */
        let selected =
            modelFromEvent;

        /*
         * Jika event tidak membawa model,
         * coba selected result milik Search module.
         */
        if (!selected) {
            selected =
                getSelectedModelFromSearch();
        }

        /*
         * Berikutnya baru cari di currentModels.
         */
        if (!selected) {
            selected =
                findCurrentModel(
                    modelId
                );
        }

        const selectedId =
            getModelIdFromObject(
                selected
            );

        /*
         * Jangan mengisi field dengan model
         * yang berbeda dari input aktif.
         */
        const selectedMatches =
            selected &&
            selectedId &&
            selectedId.toLowerCase() ===
                modelId.toLowerCase();

        const layout =
            getLayout();

        /*
         * Layout hanya menerima model lokal.
         *
         * Jika Search mendapatkan model Supabase
         * yang belum masuk currentModels, jangan
         * memaksa layout memakai array yang salah.
         */
        if (
            selectedMatches &&
            layout
        ) {
            /*
             * Jika layout menyediakan method khusus
             * untuk model terpilih, gunakan method itu.
             */
            if (
                typeof layout
                    .updateSelectedModel ===
                "function"
            ) {
                try {
                    layout.updateSelectedModel(
                        form,
                        selected
                    );
                } catch (_) {
                    /* compatibility */
                }
            } else if (
                typeof layout
                    .updateSelectedModelFields ===
                "function" &&
                currentModels.includes(
                    selected
                )
            ) {
                try {
                    layout.updateSelectedModelFields(
                        form,
                        currentModels
                    );
                } catch (_) {
                    /* compatibility */
                }
            }
        } else if (
            !selected &&
            layout &&
            typeof layout
                .updateSelectedModelFields ===
                "function"
        ) {
            /*
             * Hanya sinkronkan layout jika model memang
             * tersedia dalam currentModels.
             */
            const localModel =
                findCurrentModel(
                    modelId
                );

            if (localModel) {
                try {
                    layout.updateSelectedModelFields(
                        form,
                        currentModels
                    );
                } catch (_) {
                    /* compatibility */
                }
            }
        }

        if (selectedMatches) {
            try {
                document.dispatchEvent(
                    new CustomEvent(
                        "genz-model-selected",
                        {
                            detail: {
                                model:
                                    selected,
                                modelId,
                                form,
                                source:
                                    modelFromEvent
                                        ? "search-event"
                                        : "search-or-local"
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
         * Jangan mengirim "not found".
         *
         * Search Supabase dapat berjalan async.
         * Events module hanya memberitahu bahwa
         * Model ID berubah.
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

        const form =
            getForm();

        /*
         * Search module tetap pemilik utama
         * pencarian as-you-type.
         */
        if (!value) {
            closeSearchDropdowns();

            try {
                document.dispatchEvent(
                    new CustomEvent(
                        "genz-model-search-input",
                        {
                            detail: {
                                value: "",
                                form
                            }
                        }
                    )
                );
            } catch (_) {
                /* compatibility */
            }

            return;
        }

        /*
         * Jika exact match lokal tersedia,
         * sinkronkan field tanpa query baru.
         */
        const localModel =
            findCurrentModel(
                value
            );

        if (localModel) {
            handleModelChange(
                event
            );
        }

        /*
         * Informasikan Search module.
         * Search module yang melakukan query Supabase.
         */
        try {
            document.dispatchEvent(
                new CustomEvent(
                    "genz-model-search-input",
                    {
                        detail: {
                            value,
                            form,
                            providerId:
                                normalizeId(
                                    queryFirst(
                                        form,
                                        [
                                            "#providerId",
                                            "#provider_id",
                                            "[name='provider_id']",
                                            "[name='providerId']"
                                        ]
                                    )?.value
                                )
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

        const edit =
            getEditModule();

        /*
         * Jika sedang edit, Edit module wajib
         * memulihkan original snapshot terlebih dahulu.
         */
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

        /*
         * Create module hanya ditutup.
         */
        resetCreateState();

        /*
         * Search dropdown dibersihkan.
         */
        closeSearchDropdowns();

        /*
         * Coordinator dibersihkan tanpa submit.
         */
        closeCoordinatorState();

        /*
         * closeModal tidak melakukan cleanup kedua kali.
         */
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
         * Hanya backdrop langsung.
         * Klik di dalam konten modal tidak menutup modal.
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
            !event ||
            (
                event.key !== "Escape" &&
                event.key !== "Esc"
            )
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
         * Escape pertama digunakan Search untuk
         * menutup dropdown jika sedang terbuka.
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

        registerListener(
            form,
            "submit",
            handleSubmit,
            false,
            "submit"
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

        registerListener(
            provider,
            "change",
            handleProviderChange,
            false,
            "providerChange"
        );
    }

    function bindModel(
        form
    ) {
        /*
         * Model search input hanya di-bind ke satu
         * field utama agar tidak terjadi double query.
         */
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

        registerListener(
            model,
            "change",
            handleModelChange,
            false,
            "modelChange"
        );

        registerListener(
            model,
            "input",
            handleModelInput,
            false,
            "modelInput"
        );
    }

    function bindCloseButtons() {
        const modal =
            getModal();

        if (!modal) {
            return;
        }

        const closeButtons =
            queryAll(
                modal,
                [
                    "[data-model-modal-close]",
                    "[data-modal-close]",
                    ".model-modal-close",
                    ".modal-close",
                    ".close-modal",
                    "#closeModelModal"
                ]
            );

        closeButtons.forEach(
            (button, index) => {
                registerListener(
                    button,
                    "click",
                    handleClose,
                    false,
                    `close-${index}`
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
            queryAll(
                modal,
                [
                    "[data-model-cancel]",
                    "[data-cancel-model]",
                    "[data-action='cancel-model']",
                    ".model-cancel",
                    "#cancelModel"
                ]
            );

        cancelButtons.forEach(
            (button, index) => {
                /*
                 * Jika #cancelModel juga masuk close selector,
                 * cancel harus memiliki handler khusus.
                 */
                registerListener(
                    button,
                    "click",
                    handleCancel,
                    false,
                    `cancel-${index}`
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

        registerListener(
            modal,
            "click",
            handleBackdrop,
            false,
            "backdrop"
        );
    }

    function bindEscape() {
        registerListener(
            document,
            "keydown",
            handleEscape,
            false,
            "escape"
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
         * Ini penting setelah render/re-render modal
         * agar event submit tidak terpasang berkali-kali.
         */
        unbind();

        if (
            options.root !== undefined
        ) {
            currentRoot =
                options.root;
        } else if (
            !currentRoot
        ) {
            currentRoot =
                getForm();
        }

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
         * Reset state hanya jika caller memang meminta.
         *
         * Jangan otomatis menghapus state Edit setiap
         * kali module diinisialisasi karena initialize
         * dapat dipanggil ulang saat lifecycle page.
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
                try {
                    layout.updateModelIdOptions(
                        form,
                        currentModels
                    );
                } catch (_) {
                    /* non-fatal */
                }
            }

            if (
                typeof layout
                    .updateProviderStatus ===
                "function"
            ) {
                try {
                    layout.updateProviderStatus(
                        form,
                        currentProviders
                    );
                } catch (_) {
                    /* non-fatal */
                }
            }

            if (
                typeof layout
                    .updateCreditFinalPreview ===
                "function"
            ) {
                try {
                    layout.updateCreditFinalPreview(
                        form
                    );
                } catch (_) {
                    /* non-fatal */
                }
            }
        }

        /*
         * Search menerima data baru jika API tersedia.
         *
         * Events tetap tidak melakukan query.
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
         * Data models/providers bukan milik module Events.
         * Karena itu data tidak dihapus.
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
