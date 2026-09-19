/* =========================================================
   GEN-Z.AI
   ADMIN MODEL MANAGEMENT
   MODEL FORM EVENTS
   ---------------------------------------------------------
   File:
   admin-control/models/functions/model-form-events.js

   Tanggung jawab:
   - Submit form
   - Provider change
   - Model ID change
   - Close modal
   - Cancel
   - Backdrop
   - Escape
   - Sinkronisasi event antar module

   Tidak bertanggung jawab:
   - Query Supabase
   - CRUD database
   - Provider CRUD
   - Pricing calculation
   - Model catalog query
   - KIE workflow
   - KIE parameters
   - KIE variants

   Owner:
   Provider:
       GENZModelsProvider
       GENZModelProviderDropdown

   Form:
       GENZModelFormLayout
       GENZModelFormCreate
       GENZModelFormEdit
       GENZModelFormDelete
       GENZModelFormCoordinator

   Search:
       GENZModelsSearch
       GENZModelSearchEvents

   Pricing:
       GENZModelPriceCalculation
========================================================= */

(function () {

    "use strict";


    /* =====================================================
       STATE
    ===================================================== */

    let initialized = false;

    const handlers = [];


    /* =====================================================
       ELEMENT HELPERS
    ===================================================== */

    function getElement(id) {

        if (!id) {
            return null;
        }

        return document.getElementById(id);

    }


    function firstElement(ids) {

        if (!Array.isArray(ids)) {
            return null;
        }

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


    function getDeleteModule() {

        return (
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


    function getSearch() {

        return (
            window.GENZModelsSearch ||
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

        if (
            !element ||
            typeof element.addEventListener !==
                "function"
        ) {

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
       UNBIND
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
                    "[GEN-Z.AI] Model form event remove gagal:",
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

    function getModal() {

        return getElement(
            "modelModal"
        );

    }


    function closeModal() {

        const modal =
            getModal();


        if (!modal) {

            return false;

        }


        /*
         * Support seluruh class modal yang pernah
         * digunakan halaman Models.
         */

        modal.classList.remove(
            "open",
            "show",
            "active"
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


        /*
         * Tutup dropdown pencarian Model ID.
         */

        const search =
            getSearch();


        if (
            search &&
            typeof search.hideDropdown ===
                "function"
        ) {

            try {

                search.hideDropdown();

            } catch (error) {

                console.warn(
                    "[GEN-Z.AI] Gagal menutup Model ID dropdown:",
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
                    "[GEN-Z.AI] Gagal menutup search dropdown:",
                    error
                );

            }

        }


        /*
         * Beri tahu module lain bahwa modal ditutup.
         */

        dispatchEvent(
            "genz-model-modal-closed",
            {
                source:
                    "model-form-events"
            }
        );


        return true;

    }


    function openModal() {

        const modal =
            getModal();


        if (!modal) {

            return false;

        }


        modal.classList.remove(
            "hidden"
        );


        modal.classList.add(
            "open"
        );


        modal.setAttribute(
            "aria-hidden",
            "false"
        );


        modal.style.display =
            "";


        modal.style.visibility =
            "";


        document.body.classList.add(
            "modal-open"
        );


        return true;

    }


    function isModalOpen() {

        const modal =
            getModal();


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

            modal.classList.contains(
                "active"
            ) ||

            modal.getAttribute(
                "aria-hidden"
            ) !== "true"

        );

    }


    /* =====================================================
       CUSTOM EVENT
    ===================================================== */

    function dispatchEvent(
        name,
        detail
    ) {

        try {

            document.dispatchEvent(
                new CustomEvent(
                    name,
                    {
                        detail:
                            detail || {}
                    }
                )
            );


            return true;

        } catch (error) {

            console.warn(
                "[GEN-Z.AI] Custom event gagal:",
                name,
                error
            );


            return false;

        }

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


        /*
         * Coordinator adalah owner utama CRUD.
         */

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
                    "[GEN-Z.AI] Model form submit gagal:",
                    error
                );


                throw error;

            }

        }


        /*
         * Compatibility fallback.
         */

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
            "[GEN-Z.AI] Tidak ada handler CRUD Model yang tersedia."
        );


        return null;

    }


    /* =====================================================
       PROVIDER CHANGE
       -----------------------------------------------------
       Provider change hanya meneruskan perubahan ke layout.

       Tidak melakukan query Supabase di sini.
    ===================================================== */

    async function handleProviderChange(
        event
    ) {

        const providerElement =
            event?.currentTarget ||
            getElement(
                "providerId"
            );


        if (!providerElement) {

            return false;

        }


        const providerId =
            String(
                providerElement.value ||
                ""
            ).trim();


        const layout =
            getLayout();


        /*
         * Provider kosong.
         */

        if (!providerId) {

            if (
                layout &&
                typeof layout.clearModelSelection ===
                    "function"
            ) {

                try {

                    await layout.clearModelSelection();

                } catch (error) {

                    console.warn(
                        "[GEN-Z.AI] Model selection clear gagal:",
                        error
                    );

                }

            }


            dispatchEvent(
                "genz-model-provider-changed",
                {
                    providerId: "",
                    source:
                        "model-form-events"
                }
            );


            return true;

        }


        /*
         * Layout menjadi owner pemuatan/filter
         * Model berdasarkan Provider.
         */

        if (
            layout &&
            typeof layout.refresh ===
                "function"
        ) {

            try {

                const result =
                    await layout.refresh({

                        providerId,

                        selectedModelId:
                            ""

                    });


                dispatchEvent(
                    "genz-model-provider-changed",
                    {
                        providerId,
                        result,
                        source:
                            "model-form-events"
                    }
                );


                return result !== false;

            } catch (error) {

                console.error(
                    "[GEN-Z.AI] Provider change gagal:",
                    error
                );


                dispatchEvent(
                    "genz-model-provider-error",
                    {
                        providerId,
                        error,
                        source:
                            "model-form-events"
                    }
                );


                return false;

            }

        }


        /*
         * Jika layout belum mempunyai refresh(),
         * jangan membuat logika provider baru di sini.
         *
         * Event tetap dikirim agar module lain dapat
         * merespons bila diperlukan.
         */

        dispatchEvent(
            "genz-model-provider-changed",
            {
                providerId,
                source:
                    "model-form-events"
            }
        );


        return true;

    }


    /* =====================================================
       MODEL ID CHANGE
       -----------------------------------------------------
       Layout adalah owner model catalog.

       Form events hanya meneruskan Model ID.
    ===================================================== */

    async function handleModelChange(
        event
    ) {

        const modelElement =
            event?.currentTarget ||
            firstElement([
                "modelCodeSearch",
                "modelId"
            ]);


        if (!modelElement) {

            return false;

        }


        const modelId =
            String(
                modelElement.value ||
                ""
            ).trim();


        const layout =
            getLayout();


        /*
         * Model ID kosong.
         */

        if (!modelId) {

            if (
                layout &&
                typeof layout.clearModelSelection ===
                    "function"
            ) {

                try {

                    await layout.clearModelSelection();

                } catch (error) {

                    console.warn(
                        "[GEN-Z.AI] Model selection clear gagal:",
                        error
                    );

                }

            }


            dispatchEvent(
                "genz-model-selection-cleared",
                {
                    source:
                        "model-form-events"
                }
            );


            return true;

        }


        /*
         * Prioritaskan API findModel() milik Layout.
         */

        if (
            layout &&
            typeof layout.findModel ===
                "function"
        ) {

            try {

                const model =
                    await layout.findModel(
                        modelId
                    );


                if (!model) {

                    dispatchEvent(
                        "genz-model-not-found",
                        {
                            modelId,
                            source:
                                "model-form-events"
                        }
                    );


                    return false;

                }


                /*
                 * Jika layout mempunyai setModel(),
                 * biarkan layout mengisi seluruh field.
                 */

                if (
                    typeof layout.setModel ===
                        "function"
                ) {

                    const result =
                        await layout.setModel(
                            model
                        );


                    dispatchEvent(
                        "genz-model-selected",
                        {
                            model,
                            modelId,
                            result,
                            source:
                                "model-form-events"
                        }
                    );


                    return result !== false;

                }


                dispatchEvent(
                    "genz-model-selected",
                    {
                        model,
                        modelId,
                        source:
                            "model-form-events"
                    }
                );


                return true;

            } catch (error) {

                console.error(
                    "[GEN-Z.AI] Model selection gagal:",
                    error
                );


                dispatchEvent(
                    "genz-model-selection-error",
                    {
                        modelId,
                        error,
                        source:
                            "model-form-events"
                    }
                );


                return false;

            }

        }


        /*
         * Tidak ada API layout.
         *
         * Jangan membuat query Supabase di event module.
         */

        console.warn(
            "[GEN-Z.AI] GENZModelFormLayout.findModel() tidak tersedia."
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
       BACKDROP
    ===================================================== */

    function handleBackdropClick(
        event
    ) {

        const modal =
            getModal();


        if (!modal) {

            return false;

        }


        /*
         * Hanya klik langsung pada backdrop.
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
            !event ||
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
       SUBMIT BINDING
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
       PROVIDER BINDING
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
       MODEL ID BINDING
       -----------------------------------------------------
       Mendukung:
       - select
       - input
       - datalist-backed input
    ===================================================== */

    function bindModel() {

        const model =
            firstElement([
                "modelCodeSearch",
                "modelId"
            ]);


        if (!model) {

            return false;

        }


        let bound =
            false;


        bound =
            addListener(
                model,
                "change",
                handleModelChange
            ) || bound;


        /*
         * Input teks juga perlu merespons pilihan
         * dari dropdown/datalist.
         */

        bound =
            addListener(
                model,
                "input",
                function (event) {

                    const target =
                        event.currentTarget;


                    /*
                     * Jangan melakukan query setiap karakter.
                     *
                     * Hanya proses jika input cocok dengan
                     * option datalist yang tersedia.
                     */

                    const value =
                        String(
                            target.value ||
                            ""
                        ).trim();


                    if (!value) {
                        return;
                    }


                    const listId =
                        target.getAttribute(
                            "list"
                        );


                    if (!listId) {
                        return;
                    }


                    const datalist =
                        getElement(
                            listId
                        );


                    if (!datalist) {
                        return;
                    }


                    const options =
                        Array.from(
                            datalist.options ||
                            []
                        );


                    const match =
                        options.some(
                            function (option) {

                                return (
                                    String(
                                        option.value ||
                                        ""
                                    ).trim() ===
                                    value
                                );

                            }
                        );


                    if (!match) {
                        return;
                    }


                    handleModelChange(
                        event
                    );

                }
            ) || bound;


        return bound;

    }


    /* =====================================================
       CLOSE BUTTONS
    ===================================================== */

    function bindCloseButtons() {

        const ids = [

            "closeModalBtn",
            "closeModelModal",
            "closeModelBtn",
            "closeModelButton",
            "modelModalClose"

        ];


        let count =
            0;


        ids.forEach(
            function (id) {

                const element =
                    getElement(id);


                if (!element) {
                    return;
                }


                /*
                 * Tombol close tidak boleh submit.
                 */

                if (
                    element.tagName ===
                    "BUTTON"
                ) {

                    element.type =
                        "button";

                }


                if (
                    addListener(
                        element,
                        "click",
                        handleCloseClick
                    )
                ) {

                    count += 1;

                }

            }
        );


        return count > 0;

    }


    /* =====================================================
       CANCEL BUTTONS
    ===================================================== */

    function bindCancelButtons() {

        const ids = [

            "cancelModalBtn",
            "cancelModelBtn",
            "cancelModelButton"

        ];


        let count =
            0;


        ids.forEach(
            function (id) {

                const element =
                    getElement(id);


                if (!element) {
                    return;
                }


                if (
                    element.tagName ===
                    "BUTTON"
                ) {

                    element.type =
                        "button";

                }


                if (
                    addListener(
                        element,
                        "click",
                        handleCancel
                    )
                ) {

                    count += 1;

                }

            }
        );


        return count > 0;

    }


    /* =====================================================
       DATA ATTRIBUTE CANCEL
    ===================================================== */

    function bindDataCancel() {

        const elements =
            document.querySelectorAll(
                "[data-model-cancel]"
            );


        let count =
            0;


        elements.forEach(
            function (element) {

                /*
                 * Hindari duplicate binding pada
                 * tombol yang sudah memiliki ID.
                 */

                if (
                    element.id ===
                        "cancelModalBtn" ||
                    element.id ===
                        "cancelModelBtn" ||
                    element.id ===
                        "cancelModelButton"
                ) {

                    return;

                }


                if (
                    element.tagName ===
                    "BUTTON"
                ) {

                    element.type =
                        "button";

                }


                if (
                    addListener(
                        element,
                        "click",
                        handleCancel
                    )
                ) {

                    count += 1;

                }

            }
        );


        return count > 0;

    }


    /* =====================================================
       BACKDROP
    ===================================================== */

    function bindBackdrop() {

        const modal =
            getModal();


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
         * Jika sebelumnya sudah bound,
         * bersihkan listener lama.
         */

        if (
            initialized
        ) {

            unbind();

        }


        bindSubmit();

        bindProvider();

        bindModel();

        bindCloseButtons();

        bindCancelButtons();

        bindDataCancel();

        bindBackdrop();

        bindEscape();


        initialized =
            true;


        console.info(
            "[GEN-Z.AI] Model form events initialized."
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

            openModal,

            closeModal,

            isModalOpen,

            handleSubmit,

            handleProviderChange,

            handleModelChange,

            handleCloseClick,

            handleCancel,

            handleBackdropClick,

            handleEscape

        });


})();
