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

   TIDAK BOLEH:
   - Query Supabase
   - CRUD langsung
   - Menghitung credit sendiri
   - Mengelola Provider sendiri
   - Mengelola Model catalog sendiri
   - Mengelola Pricing sendiri
   - Membuat capability KIE sendiri

   OWNER:
   Provider:
       GENZModelsProvider
       GENZModelProviderDropdown

   Model catalog + KIE config:
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
       MODULE ACCESS
    ===================================================== */

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


        initialized =
            false;


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


        modal.style.visibility =
            "hidden";


        document.body.classList.remove(
            "modal-open"
        );


        document.body.style.removeProperty(
            "overflow"
        );


        /* ================================================
           MODEL SEARCH DROPDOWN
        ================================================ */

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
       MODAL STATUS
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

            return await edit.updateFromForm(
                event
            );

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

            return await create.createFromForm(
                event
            );

        }


        console.error(
            "[model-form-events] Tidak ada handler submit yang tersedia."
        );


        return null;

    }


    /* =====================================================
       PROVIDER CHANGE
       -----------------------------------------------------
       HANYA event coordinator.

       Layout adalah owner:
           - load models
           - filter provider
           - reset model
           - load KIE config
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

            return false;

        }


        const providerId =
            String(
                select.value || ""
            ).trim();


        const layout =
            getLayout();


        /*
         * Provider kosong:
         * biarkan layout membersihkan seluruh
         * state Model + KIE.
         */

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


            return true;

        }


        /*
         * PENTING:
         *
         * Jangan memanggil:
         *
         *   handleProviderChange()
         *   layout.handleProviderChange()
         *   layout.refresh()
         *
         * sekaligus.
         *
         * Layout sekarang mempunyai owner event provider
         * sendiri ketika digunakan secara standalone.
         *
         * Di sini kita hanya meminta refresh dengan
         * provider eksplisit.
         */

        if (

            layout &&

            typeof layout.refresh ===
                "function"

        ) {

            try {

                await layout.refresh(
                    {
                        providerId,

                        selectedModelId:
                            ""

                    }
                );

            } catch (error) {

                console.warn(
                    "[model-form-events] Gagal refresh Model Layout:",
                    error
                );

            }

        }


        try {

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

        } catch (error) {

            console.warn(
                "[model-form-events] Provider changed event gagal:",
                error
            );

        }


        return true;

    }


    /* =====================================================
       MODEL ID CHANGE
       -----------------------------------------------------
       Layout menjadi SINGLE OWNER untuk:
           - mencari model
           - Model Name
           - Model Family
           - kie_parameters
           - kie_pricing
           - ratio
           - duration
           - resolution

       Events hanya meneruskan perubahan.
    ===================================================== */

    async function handleModelChange(
        event
    ) {

        const select =
            event?.currentTarget ||
            getElement(
                "modelCodeSearch"
            );


        if (!select) {

            return false;

        }


        const modelId =
            String(
                select.value || ""
            ).trim();


        const layout =
            getLayout();


        if (!modelId) {

            if (

                layout &&

                typeof layout.clearModelSelection ===
                    "function"

            ) {

                layout.clearModelSelection(
                    {
                        keepPending:
                            false
                    }
                );

            }


            return true;

        }


        /*
         * Jangan mengisi modelName / family sendiri.
         *
         * Jangan membaca pricing sendiri.
         *
         * Jangan membaca capability sendiri.
         *
         * Semua dilakukan GENZModelFormLayout.setModel().
         */

        if (

            layout &&

            typeof layout.findModel ===
                "function" &&

            typeof layout.setModel ===
                "function"

        ) {

            try {

                const model =
                    layout.findModel(
                        modelId
                    );


                if (!model) {

                    console.warn(
                        "[model-form-events] Model ID tidak ditemukan dalam catalog:",
                        modelId
                    );


                    return false;

                }


                const result =
                    await layout.setModel(
                        model
                    );


                /*
                 * Event hanya dikirim setelah layout
                 * selesai memuat KIE config.
                 */

                try {

                    document.dispatchEvent(
                        new CustomEvent(
                            "genz-model-selected",
                            {
                                detail: {

                                    model,

                                    modelId,

                                    kieConfig:
                                        typeof layout.getCurrentKieConfig ===
                                            "function"
                                            ? layout.getCurrentKieConfig()
                                            : null,

                                    source:
                                        "model-form-events"

                                }
                            }
                        )
                    );

                } catch (eventError) {

                    console.warn(
                        "[model-form-events] Model selected event gagal:",
                        eventError
                    );

                }


                return result !== false;

            } catch (error) {

                console.error(
                    "[model-form-events] Gagal memproses Model ID:",
                    error
                );


                return false;

            }

        }


        console.error(
            "[model-form-events] GENZModelFormLayout tidak tersedia."
        );


        return false;

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


        return closeModal();

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

            return false;

        }


        /*
         * Hanya klik tepat pada backdrop.
         */

        if (
            event.target !==
            modal
        ) {

            return false;

        }


        return closeModal();

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

            return false;

        }


        if (
            !isModalOpen()
        ) {

            return false;

        }


        event.preventDefault();

        event.stopPropagation();


        return closeModal();

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


        return closeModal();

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
       CLOSE BUTTONS
    ===================================================== */

    function bindCloseButtons() {

        const selectors = [

            "closeModalBtn",

            "cancelModalBtn",

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
             * Close / Cancel tidak boleh submit form.
             */

            if (
                element.tagName ===
                "BUTTON"
            ) {

                element.type =
                    "button";

            }


            const isCancel =
                id ===
                    "cancelModalBtn" ||

                id ===
                    "cancelModelBtn" ||

                id ===
                    "cancelModelButton";


            addListener(
                element,
                "click",
                isCancel
                    ? handleCancel
                    : handleCloseClick
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
       DATA ATTRIBUTE CANCEL
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
                 * Jangan bind dua kali terhadap
                 * tombol yang sudah memiliki ID.
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
       BACKDROP
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
       ESCAPE
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
         * hapus seluruh listener lama.
         *
         * Ini penting agar:
         *
         *     initialize()
         *     bind()
         *     rebind()
         *
         * tidak menghasilkan listener berlapis.
         */

        if (initialized) {

            unbind();

        }


        bindSubmit();

        bindProvider();

        bindModel();

        bindCloseButtons();

        bindCancel();

        bindBackdrop();

        bindEscape();


        initialized =
            true;


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

            handleCloseClick,

            handleBackdropClick,

            handleEscape,

            handleCancel

        });


})();
