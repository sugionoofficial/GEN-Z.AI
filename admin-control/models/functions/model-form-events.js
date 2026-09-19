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
    =====================================================

       Semua listener dicatat agar bind()
       tidak menghasilkan duplicate listener.

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
    =====================================================

       Modal sekarang ditangani langsung oleh
       Model Form Events.

       Tidak lagi bergantung kepada:

           window.GENZModelsForm

       Ini penting agar models-form.js nantinya
       dapat dilepas tanpa mematikan event Form.

    ===================================================== */

    function closeModal() {

        const modal =
            getElement(
                "modelModal"
            );


        if (!modal) {

            return false;

        }


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


        modal.style.display =
            "none";


        document.body.classList.remove(
            "modal-open"
        );


        /*
         * Tutup Model Search dropdown
         * jika module tersedia.
         */

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


        /*
         * Fallback langsung ke dropdown
         * search module baru.
         */

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


        /*
         * Coordinator adalah owner utama
         * operasi CRUD.
         */

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

                /*
                 * Mode Edit sekarang diambil
                 * langsung dari Form Edit module.
                 *
                 * Tidak lagi menggunakan:
                 *
                 * window.GENZModelsForm
                 */

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
    =====================================================

       Event Provider hanya memberi tahu module
       yang memang memiliki tanggung jawab.

       Tidak mengambil alih filtering Model.

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


        /*
         * Provider kosong:
         * Model ID harus dikosongkan oleh Layout.
         */

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


        /*
         * Layout menjadi owner refresh
         * Model ID berdasarkan Provider.
         */

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


        /*
         * Beritahu module lain bahwa Provider
         * berubah.
         */

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


        /*
         * Model ID selection dimiliki Layout.
         *
         * Jangan menulis ulang option.
         */

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

                    /*
                     * Hidden modelCode.
                     */

                    const hidden =
                        getElement(
                            "modelCode"
                        );


                    if (hidden) {

                        hidden.value =
                            modelId;

                    }


                    /*
                     * Model Name.
                     *
                     * Hanya isi apabila kosong.
                     * Ini mencegah edit menimpa
                     * nama custom dari database.
                     */

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


                    /*
                     * Informasi Model.
                     */

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
    =====================================================

       Price calculation owner menangani
       kalkulasi sebenarnya.

       Event module hanya meneruskan perubahan.

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
         *
         * Klik di dalam modal tidak boleh
         * menutup modal.
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


        /*
         * Model Code Search sekarang dapat berupa
         * SELECT maupun INPUT legacy.
         *
         * Event tetap kompatibel.
         */

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
       BIND CLOSE
    ===================================================== */

    function bindCloseButtons() {

        const selectors = [

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
             * Tombol cancel/close tidak boleh
             * submit form.
             */

            if (
                element.tagName ===
                "BUTTON"
            ) {

                element.type =
                    "button";

            }


            addListener(
                element,
                "click",
                handleCloseClick
            );


            count += 1;

        }


        return count > 0;

    }


    /* =====================================================
       BIND CANCEL
    ===================================================== */

    function bindCancel() {

        const buttons =
            document.querySelectorAll(
                "[data-model-cancel]"
            );


        let count = 0;


        buttons.forEach(
            button => {

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
         * Sangat penting:
         *
         * Jika bind dipanggil berkali-kali,
         * listener lama dibuang terlebih dahulu.
         */

        if (initialized) {

            unbind();

        }


        /*
         * Submit.
         */

        bindSubmit();


        /*
         * Provider.
         */

        bindProvider();


        /*
         * Model ID.
         */

        bindModel();


        /*
         * Credit / Discount.
         */

        bindPrice();


        /*
         * Close.
         */

        bindCloseButtons();


        /*
         * Cancel.
         */

        bindCancel();


        /*
         * Backdrop.
         */

        bindBackdrop();


        /*
         * Escape.
         */

        bindEscape();


        initialized = true;


        console.log(
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
