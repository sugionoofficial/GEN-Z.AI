/* =========================================================
   GEN-Z.AI
   ADMIN MODEL MANAGEMENT
   MODEL FORM EVENTS

   File:
   admin-control/models/functions/model-form-events.js

   OWNER:
   Seluruh event Form Model.

   Tanggung jawab:
   - Submit form
   - Provider change
   - Model ID change
   - Tombol close
   - Backdrop modal
   - Escape keyboard
   - Tombol cancel
   - Sinkronisasi event ke module pemilik

   TIDAK BOLEH:
   - Query Supabase
   - CRUD langsung
   - Menghitung credit sendiri
   - Mengelola Provider sendiri
   - Mengelola Model catalog sendiri
   - Mengambil alih layout

   OWNER LAIN:
   Provider:
       GENZModelsProvider
       GENZModelProviderDropdown

   Model catalog/layout:
       GENZModelFormLayout

   Pricing:
       GENZModelPriceCalculation

   CRUD:
       GENZModelFormCreate
       GENZModelFormEdit
       GENZModelFormDelete
       GENZModelFormCoordinator
========================================================= */

(function () {

    "use strict";


    /* =====================================================
       STATE
    ===================================================== */

    let initialized = false;

    const handlers = [];


    /* =====================================================
       ELEMENT
    ===================================================== */

    function getElement(id) {

        return document.getElementById(id);

    }


    function firstElement(ids) {

        for (const id of ids) {

            const element =
                getElement(id);

            if (element) {

                return element;

            }

        }

        return null;

    }


    /* =====================================================
       FORM
    ===================================================== */

    function getForm() {

        return (
            getElement("modelForm") ||
            getElement("modelsForm")
        );

    }


    /* =====================================================
       FORM CREATE
    ===================================================== */

    function getCreateModule() {

        return (
            window.GENZModelFormCreate ||
            null
        );

    }


    /* =====================================================
       FORM EDIT
    ===================================================== */

    function getEditModule() {

        return (
            window.GENZModelFormEdit ||
            null
        );

    }


    /* =====================================================
       FORM COORDINATOR
    ===================================================== */

    function getCoordinator() {

        return (
            window.GENZModelFormCoordinator ||
            null
        );

    }


    /* =====================================================
       FORM LAYOUT
    ===================================================== */

    function getLayout() {

        return (
            window.GENZModelFormLayout ||
            null
        );

    }


    /* =====================================================
       PRICE
    ===================================================== */

    function getPriceCalculation() {

        return (
            window.GENZModelPriceCalculation ||
            null
        );

    }


    /* =====================================================
       SAFE CALL
    ===================================================== */

    async function callAsync(
        fn,
        ...args
    ) {

        if (
            typeof fn !==
            "function"
        ) {

            return undefined;

        }

        return await fn(
            ...args
        );

    }


    /* =====================================================
       EVENT REGISTRY
    ===================================================== */

    function addListener(
        element,
        event,
        handler,
        options
    ) {

        if (!element) {

            return false;

        }

        element.addEventListener(
            event,
            handler,
            options
        );

        handlers.push({

            element,

            event,

            handler,

            options

        });

        return true;

    }


    /* =====================================================
       REMOVE ALL
    ===================================================== */

    function unbind() {

        while (
            handlers.length
        ) {

            const item =
                handlers.pop();

            try {

                item.element.removeEventListener(
                    item.event,
                    item.handler,
                    item.options
                );

            } catch (error) {

                console.warn(
                    "[model-form-events] Gagal remove listener:",
                    error
                );

            }

        }

        initialized = false;

        return true;

    }


    /* =====================================================
       MODAL
    ===================================================== */

    function closeModal() {

        const modal =
            getElement(
                "modelModal"
            );


        if (!modal) {

            console.warn(
                "[model-form-events] #modelModal tidak ditemukan."
            );

            return false;

        }


        /* =================================================
           HENTIKAN EVENT YANG MUNGKIN MASIH BERJALAN
        ================================================= */

        modal.classList.remove(
            "open",
            "show"
        );


        modal.classList.add(
            "hidden"
        );


        modal.setAttribute(
            "aria-hidden",
            "true"
        );


        /*
         * Pastikan display benar-benar tertutup.
         */
        modal.style.display =
            "none";


        /*
         * Bersihkan kemungkinan inline visibility.
         */
        modal.style.visibility =
            "hidden";


        /*
         * Pulihkan body.
         */
        document.body.classList.remove(
            "modal-open"
        );


        document.body.style.removeProperty(
            "overflow"
        );


        /* =================================================
           TUTUP MODEL SEARCH DROPDOWN
        ================================================= */

        const search =
            window.GENZModelsSearch;


        if (
            search &&
            typeof search.hideDropdown ===
                "function"
        ) {

            try {

                search.hideDropdown();

            } catch (error) {

                console.warn(
                    "[model-form-events] Gagal hide model search:",
                    error
                );

            }

        }


        /* =================================================
           FALLBACK SEARCH DROPDOWN
        ================================================= */

        const searchDropdown =
            window.GENZModelSearchDropdown;


        if (
            searchDropdown &&
            typeof searchDropdown.hide ===
                "function"
        ) {

            try {

                searchDropdown.hide();

            } catch (error) {

                console.warn(
                    "[model-form-events] Gagal hide search dropdown:",
                    error
                );

            }

        }


        /* =================================================
           EVENT NOTIFICATION
        ================================================= */

        try {

            document.dispatchEvent(
                new CustomEvent(
                    "genz-model-modal-closed",
                    {
                        detail: {
                            source:
                                "model-form-events"
                        }
                    }
                )
            );

        } catch (error) {

            console.warn(
                "[model-form-events] Close event gagal:",
                error
            );

        }


        console.info(
            "[GEN-Z.AI] Model modal closed."
        );


        return true;

    }


    /* =====================================================
       IS MODAL OPEN
    ===================================================== */

    function isModalOpen() {

        const modal =
            getElement(
                "modelModal"
            );


        if (!modal) {

            return false;

        }


        return (

            modal.classList.contains(
                "open"
            ) ||

            modal.classList.contains(
                "show"
            ) ||

            modal.getAttribute(
                "aria-hidden"
            ) !== "true"

        );

    }


    /* =====================================================
       SUBMIT
    ===================================================== */

    async function handleSubmit(
        event
    ) {

        if (event) {

            event.preventDefault();

            event.stopPropagation();

        }


        const coordinator =
            getCoordinator();


        if (

            coordinator &&

            typeof coordinator.updateFromForm ===
                "function" &&

            typeof coordinator.createFromForm ===
                "function"

        ) {

            try {

                const edit =
                    getEditModule();


                const editing =
                    Boolean(

                        edit &&

                        typeof edit.isEditing ===
                            "function" &&

                        edit.isEditing()

                    );


                if (editing) {

                    return await coordinator.updateFromForm(
                        event
                    );

                }


                return await coordinator.createFromForm(
                    event
                );


            } catch (error) {

                console.error(
                    "[model-form-events] Coordinator submit error:",
                    error
                );

                throw error;

            }

        }


        /* =================================================
           FALLBACK EDIT
        ================================================= */

        const edit =
            getEditModule();


        if (

            edit &&

            typeof edit.isEditing ===
                "function" &&

            edit.isEditing() &&

            typeof edit.updateFromForm ===
                "function"

        ) {

            try {

                return await edit.updateFromForm(
                    event
                );

            } catch (error) {

                console.error(
                    "[model-form-events] Edit submit error:",
                    error
                );

                throw error;

            }

        }


        /* =================================================
           FALLBACK CREATE
        ================================================= */

        const create =
            getCreateModule();


        if (

            create &&

            typeof create.createFromForm ===
                "function"

        ) {

            try {

                return await create.createFromForm(
                    event
                );

            } catch (error) {

                console.error(
                    "[model-form-events] Create submit error:",
                    error
                );

                throw error;

            }

        }


        console.error(
            "[model-form-events] Tidak ada handler submit yang tersedia."
        );


        return null;

    }


    /* =====================================================
       PROVIDER CHANGE
    ===================================================== */

    async function handleProviderChange(
        event
    ) {

        const select =
            event?.currentTarget ||
            getElement(
                "providerId"
            );


        if (!select) {

            return;

        }


        const providerId =
            String(
                select.value || ""
            ).trim();


        const layout =
            getLayout();


        if (!providerId) {

            if (

                layout &&

                typeof layout.clearModelSelection ===
                    "function"

            ) {

                try {

                    layout.clearModelSelection();

                } catch (error) {

                    console.warn(
                        "[model-form-events] Gagal clear Model ID:",
                        error
                    );

                }

            }


            return;

        }


        if (

            layout &&

            typeof layout.refresh ===
                "function"

        ) {

            try {

                await layout.refresh();

            } catch (error) {

                console.warn(
                    "[model-form-events] Gagal refresh Model Layout:",
                    error
                );

            }

        }


        document.dispatchEvent(

            new CustomEvent(
                "genz-model-provider-changed",
                {
                    detail: {

                        providerId,

                        source:
                            "model-form-events"

                    }
                }
            )

        );

    }


    /* =====================================================
       MODEL ID CHANGE
    ===================================================== */

    function handleModelChange(
        event
    ) {

        const select =
            event?.currentTarget ||
            getElement(
                "modelCodeSearch"
            );


        if (!select) {

            return;

        }


        const modelId =
            String(
                select.value || ""
            ).trim();


        const layout =
            getLayout();


        if (

            layout &&

            typeof layout.findModel ===
                "function" &&

            modelId

        ) {

            try {

                const model =
                    layout.findModel(
                        modelId
                    );


                if (model) {

                    const hidden =
                        getElement(
                            "modelCode"
                        );


                    if (hidden) {

                        hidden.value =
                            modelId;

                    }


                    const modelName =
                        getElement(
                            "modelName"
                        );


                    if (

                        modelName &&

                        !String(
                            modelName.value || ""
                        ).trim()

                    ) {

                        modelName.value =
                            model.model_name ||
                            modelId;

                    }


                    document.dispatchEvent(

                        new CustomEvent(
                            "genz-model-selected",
                            {
                                detail: {

                                    model,

                                    source:
                                        "model-form-events"

                                }
                            }
                        )

                    );

                }

            } catch (error) {

                console.warn(
                    "[model-form-events] Model selection warning:",
                    error
                );

            }

        }

    }


    /* =====================================================
       PRICE INPUT
    ===================================================== */

    function handlePriceInput(
        event
    ) {

        const calculation =
            getPriceCalculation();


        if (!calculation) {

            return;

        }


        if (

            typeof calculation.syncForm ===
                "function"

        ) {

            try {

                calculation.syncForm();

                return;

            } catch (error) {

                console.warn(
                    "[model-form-events] Price sync warning:",
                    error
                );

            }

        }


        if (

            typeof calculation.updatePreview ===
                "function"

        ) {

            try {

                calculation.updatePreview();

            } catch (error) {

                console.warn(
                    "[model-form-events] Price preview warning:",
                    error
                );

            }

        }

    }


    /* =====================================================
       CLOSE BUTTON
    ===================================================== */

    function handleCloseClick(
        event
    ) {

        if (event) {

            event.preventDefault();

            event.stopPropagation();

        }


        closeModal();

    }


    /* =====================================================
       BACKDROP
    ===================================================== */

    function handleBackdropClick(
        event
    ) {

        const modal =
            getElement(
                "modelModal"
            );


        if (!modal) {

            return;

        }


        /*
         * Hanya klik langsung pada backdrop.
         * Klik isi modal tidak menutup modal.
         */

        if (
            event.target !==
            modal
        ) {

            return;

        }


        closeModal();

    }


    /* =====================================================
       ESCAPE
    ===================================================== */

    function handleEscape(
        event
    ) {

        if (
            event.key !==
            "Escape"
        ) {

            return;

        }


        if (
            !isModalOpen()
        ) {

            return;

        }


        event.preventDefault();

        event.stopPropagation();


        closeModal();

    }


    /* =====================================================
       CANCEL
    ===================================================== */

    function handleCancel(
        event
    ) {

        if (event) {

            event.preventDefault();

            event.stopPropagation();

        }


        closeModal();

    }


    /* =====================================================
       BIND SUBMIT
    ===================================================== */

    function bindSubmit() {

        const form =
            getForm();


        if (!form) {

            return false;

        }


        return addListener(
            form,
            "submit",
            handleSubmit
        );

    }


    /* =====================================================
       BIND PROVIDER
    ===================================================== */

    function bindProvider() {

        const provider =
            getElement(
                "providerId"
            );


        if (!provider) {

            return false;

        }


        return addListener(
            provider,
            "change",
            handleProviderChange
        );

    }


    /* =====================================================
       BIND MODEL
    ===================================================== */

    function bindModel() {

        const model =
            getElement(
                "modelCodeSearch"
            );


        if (!model) {

            return false;

        }


        return addListener(
            model,
            "change",
            handleModelChange
        );

    }


    /* =====================================================
       BIND PRICE
    ===================================================== */

    function bindPrice() {

        const fields = [

            "creditCost",

            "credit_cost",

            "discountPercent",

            "discount_percent"

        ];


        let count = 0;


        for (const id of fields) {

            const element =
                getElement(id);


            if (!element) {

                continue;

            }


            addListener(
                element,
                "input",
                handlePriceInput
            );


            addListener(
                element,
                "change",
                handlePriceInput
            );


            count += 1;

        }


        return count > 0;

    }


    /* =====================================================
       BIND CLOSE BUTTONS
       -----------------------------------------------------
       ID AKTUAL DARI models.html:

           #closeModalBtn
           #cancelModalBtn

       Keduanya sengaja didaftarkan secara eksplisit.
    ===================================================== */

    function bindCloseButtons() {

        const selectors = [

            /*
             * ID AKTUAL
             */
            "closeModalBtn",

            "cancelModalBtn",

            /*
             * Compatibility ID lama
             */
            "closeModelModal",

            "closeModelBtn",

            "closeModelButton",

            "cancelModelBtn",

            "cancelModelButton",

            "modelModalClose"

        ];


        let count = 0;


        for (const id of selectors) {

            const element =
                getElement(id);


            if (!element) {

                continue;

            }


            /*
             * Close dan Cancel tidak boleh
             * menjadi submit button.
             */

            if (
                element.tagName ===
                "BUTTON"
            ) {

                element.type =
                    "button";

            }


            /*
             * Tombol Cancel memakai handler
             * khusus Cancel.
             *
             * Tombol lainnya memakai handler Close.
             */
            const handler =
                id === "cancelModalBtn" ||
                id === "cancelModelBtn" ||
                id === "cancelModelButton"

                    ? handleCancel

                    : handleCloseClick;


            addListener(
                element,
                "click",
                handler
            );


            count += 1;


            console.info(
                "[GEN-Z.AI] Model modal button bound:",
                id
            );

        }


        return count > 0;

    }


    /* =====================================================
       BIND CANCEL DATA ATTRIBUTE
       -----------------------------------------------------
       Tetap mendukung tombol yang menggunakan:
           data-model-cancel
    ===================================================== */

    function bindCancel() {

        const buttons =
            document.querySelectorAll(
                "[data-model-cancel]"
            );


        let count = 0;


        buttons.forEach(
            button => {

                /*
                 * Hindari duplicate binding jika
                 * tombol tersebut juga memiliki
                 * ID cancelModalBtn.
                 */
                if (
                    button.id ===
                        "cancelModalBtn" ||
                    button.id ===
                        "cancelModelBtn" ||
                    button.id ===
                        "cancelModelButton"
                ) {

                    return;

                }


                if (
                    button.tagName ===
                    "BUTTON"
                ) {

                    button.type =
                        "button";

                }


                addListener(
                    button,
                    "click",
                    handleCancel
                );


                count += 1;

            }
        );


        return count > 0;

    }


    /* =====================================================
       BIND BACKDROP
    ===================================================== */

    function bindBackdrop() {

        const modal =
            getElement(
                "modelModal"
            );


        if (!modal) {

            return false;

        }


        return addListener(
            modal,
            "click",
            handleBackdropClick
        );

    }


    /* =====================================================
       BIND ESCAPE
    ===================================================== */

    function bindEscape() {

        return addListener(
            document,
            "keydown",
            handleEscape
        );

    }


    /* =====================================================
       BIND
    ===================================================== */

    function bind() {

        /*
         * Jika bind dipanggil ulang,
         * listener lama dibuang terlebih dahulu.
         */

        if (initialized) {

            unbind();

        }


        /* ================================================
           SUBMIT
        ================================================ */

        bindSubmit();


        /* ================================================
           PROVIDER
        ================================================ */

        bindProvider();


        /* ================================================
           MODEL ID
        ================================================ */

        bindModel();


        /* ================================================
           CREDIT / DISCOUNT
        ================================================ */

        bindPrice();


        /* ================================================
           CLOSE + CANCEL
        ================================================ */

        bindCloseButtons();


        /* ================================================
           DATA ATTRIBUTE CANCEL
        ================================================ */

        bindCancel();


        /* ================================================
           BACKDROP
        ================================================ */

        bindBackdrop();


        /* ================================================
           ESCAPE
        ================================================ */

        bindEscape();


        initialized = true;


        console.info(
            "[GEN-Z.AI] GENZModelFormEvents bound."
        );


        return true;

    }


    /* =====================================================
       REBIND
    ===================================================== */

    function rebind() {

        return bind();

    }


    /* =====================================================
       INITIALIZE
    ===================================================== */

    function initialize() {

        if (
            initialized
        ) {

            return true;

        }


        return bind();

    }


    /* =====================================================
       STATUS
    ===================================================== */

    function isBound() {

        return initialized;

    }


    /* =====================================================
       PUBLIC API
    ===================================================== */

    window.GENZModelFormEvents =
        Object.freeze({

            initialize,

            bind,

            rebind,

            unbind,

            isBound,

            closeModal,

            handleSubmit,

            handleProviderChange,

            handleModelChange,

            handlePriceInput,

            handleCloseClick,

            handleBackdropClick,

            handleEscape,

            handleCancel

        });


})();
