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

   IMPORTANT:
   File ini tidak memanggil API yang tidak dimiliki
   oleh GENZModelFormLayout.

   Layout API yang digunakan:
       handleProviderChange()
       updateSelectedModelFields()
       updateModelIdOptions()
       updateProviderStatus()
       updateCreditFinalPreview()
========================================================= */

(function () {

    "use strict";


    /* =====================================================
       STATE
    ===================================================== */

    let initialized = false;

    const handlers = [];


    /*
     * Data yang diberikan oleh Models UI / Form.
     *
     * Event module tidak melakukan query database.
     */
    let currentModels = [];

    let currentProviders = [];


    /* =====================================================
       ELEMENT HELPERS
    ===================================================== */

    function getElement(
        id
    ) {

        if (!id) {

            return null;

        }


        return document.getElementById(
            id
        );

    }


    function firstElement(
        ids
    ) {

        if (
            !Array.isArray(ids)
        ) {

            return null;

        }


        for (
            const id of ids
        ) {

            const element =
                getElement(
                    id
                );


            if (
                element
            ) {

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
            getElement(
                "modelForm"
            ) ||
            getElement(
                "modelsForm"
            )
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
       SET FORM DATA
       -----------------------------------------------------
       Dipanggil oleh owner UI ketika data models/providers
       sudah tersedia.

       Tidak melakukan query.
    ===================================================== */

    function setData(
        options = {}
    ) {

        if (
            Array.isArray(
                options.models
            )
        ) {

            currentModels =
                options.models;

        }


        if (
            Array.isArray(
                options.providers
            )
        ) {

            currentProviders =
                options.providers;

        }


        return getData();

    }


    /* =====================================================
       GET FORM DATA
    ===================================================== */

    function getData() {

        return {

            models:
                [
                    ...currentModels
                ],

            providers:
                [
                    ...currentProviders
                ]

        };

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

            } catch (
                error
            ) {

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


        if (
            !modal
        ) {

            return false;

        }


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
         * Tutup Model Search dropdown.
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

            } catch (
                error
            ) {

                console.warn(
                    "[GEN-Z.AI] Gagal menutup Model dropdown:",
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

            } catch (
                error
            ) {

                console.warn(
                    "[GEN-Z.AI] Gagal menutup search dropdown:",
                    error
                );

            }

        }


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


        if (
            !modal
        ) {

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


        if (
            !modal
        ) {

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

        } catch (
            error
        ) {

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
       -----------------------------------------------------
       Coordinator tetap menjadi owner CRUD.
    ===================================================== */

    async function handleSubmit(
        event
    ) {

        if (
            event
        ) {

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


                if (
                    editing
                ) {

                    return await coordinator.updateFromForm(
                        event
                    );

                }


                return await coordinator.createFromForm(
                    event
                );

            } catch (
                error
            ) {

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
       Layout adalah owner perubahan field berdasarkan
       Provider.

       Tidak memanggil:
           layout.refresh()

       karena API tersebut tidak tersedia.
    ===================================================== */

    function handleProviderChange(
        event
    ) {

        const providerElement =
            event?.currentTarget ||
            getElement(
                "providerId"
            );


        if (
            !providerElement
        ) {

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

        if (
            !providerId
        ) {

            if (
                layout &&
                typeof layout.handleProviderChange ===
                    "function"
            ) {

                try {

                    layout.handleProviderChange(
                        getForm(),
                        currentModels,
                        currentProviders
                    );

                } catch (
                    error
                ) {

                    console.warn(
                        "[GEN-Z.AI] Layout provider clear gagal:",
                        error
                    );

                }

            }


            dispatchEvent(
                "genz-model-provider-changed",
                {
                    providerId:
                        "",

                    source:
                        "model-form-events"
                }
            );


            return true;

        }


        /*
         * Gunakan API layout yang benar.
         */

        if (
            layout &&
            typeof layout.handleProviderChange ===
                "function"
        ) {

            try {

                layout.handleProviderChange(
                    getForm(),
                    currentModels,
                    currentProviders
                );

            } catch (
                error
            ) {

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
         * Beri tahu module lain.
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
       Tidak melakukan query.
       Tidak memanggil API layout yang tidak ada.

       Model dicari dari:
           currentModels

       lalu layout:
           updateSelectedModelFields()
    ===================================================== */

    function handleModelChange(
        event
    ) {

        const modelElement =
            event?.currentTarget ||
            firstElement([
                "modelCodeSearch",
                "modelId"
            ]);


        if (
            !modelElement
        ) {

            return false;

        }


        const modelId =
            String(
                modelElement.value ||
                ""
            ).trim();


        const form =
            getForm();


        const layout =
            getLayout();


        /*
         * Model kosong.
         */

        if (
            !modelId
        ) {

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
         * Layout menjadi owner pengisian field.
         */

        if (
            layout &&
            typeof layout.updateSelectedModelFields ===
                "function"
        ) {

            try {

                layout.updateSelectedModelFields(
                    form,
                    currentModels
                );

            } catch (
                error
            ) {

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
         * Cari model dari catalog hanya untuk
         * event notification.
         *
         * Tidak membuat model baru.
         */

        let selectedModel =
            null;


        const normalizedId =
            modelId.toLowerCase();


        selectedModel =
            currentModels.find(
                function (
                    model
                ) {

                    return (
                        String(
                            model?.model_id ??
                            model?.modelId ??
                            ""
                        )
                            .trim()
                            .toLowerCase() ===
                        normalizedId
                    );

                }
            ) ||
            null;


        if (
            selectedModel
        ) {

            dispatchEvent(
                "genz-model-selected",
                {
                    model:
                        selectedModel,

                    modelId,

                    source:
                        "model-form-events"
                }
            );


            return true;

        }


        /*
         * Model belum cocok dengan catalog.
         *
         * Jangan mengarang data.
         */

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


    /* =====================================================
       MODEL INPUT
       -----------------------------------------------------
       Input text tidak boleh memicu pencarian database
       setiap karakter.

       Pencarian dropdown ditangani oleh:
           GENZModelsSearch
           GENZModelSearchEvents

       Di sini hanya update field jika Model ID cocok
       dengan catalog.
    ===================================================== */

    function handleModelInput(
        event
    ) {

        const input =
            event?.currentTarget;


        if (
            !input
        ) {

            return false;

        }


        const value =
            String(
                input.value ||
                ""
            ).trim();


        if (
            !value
        ) {

            return true;

        }


        const normalized =
            value.toLowerCase();


        const exists =
            currentModels.some(
                function (
                    model
                ) {

                    return (
                        String(
                            model?.model_id ??
                            model?.modelId ??
                            ""
                        )
                            .trim()
                            .toLowerCase() ===
                        normalized
                    );

                }
            );


        /*
         * Jangan menghapus input saat user sedang
         * mengetik Model ID.
         *
         * Hanya sinkronkan ketika benar-benar
         * ditemukan dalam catalog.
         */

        if (
            !exists
        ) {

            return true;

        }


        return handleModelChange(
            event
        );

    }


    /* =====================================================
       CLOSE BUTTON
    ===================================================== */

    function handleCloseClick(
        event
    ) {

        if (
            event
        ) {

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

        if (
            event
        ) {

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


        if (
            !modal
        ) {

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


        /*
         * Jika dropdown search sedang terbuka,
         * biarkan search module menutupnya dahulu.
         *
         * Tetapi jangan membuat event recursive.
         */

        const dropdown =
            window.GENZModelSearchDropdown;


        if (
            dropdown &&
            typeof dropdown.isVisible ===
                "function"
        ) {

            try {

                if (
                    dropdown.isVisible()
                ) {

                    dropdown.hide();

                    event.preventDefault();

                    event.stopPropagation();

                    return true;

                }

            } catch (
                error
            ) {

                console.warn(
                    "[GEN-Z.AI] Dropdown Escape handling gagal:",
                    error
                );

            }

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


        if (
            !form
        ) {

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


        if (
            !provider
        ) {

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
    ===================================================== */

    function bindModel() {

        const model =
            firstElement([
                "modelCodeSearch",
                "modelId"
            ]);


        if (
            !model
        ) {

            return false;

        }


        let bound =
            false;


        /*
         * CHANGE
         */

        bound =
            addListener(
                model,
                "change",
                handleModelChange
            ) ||
            bound;


        /*
         * INPUT
         *
         * Hanya proses jika Model ID sudah ada
         * di catalog.
         */

        bound =
            addListener(
                model,
                "input",
                handleModelInput
            ) ||
            bound;


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
            function (
                id
            ) {

                const element =
                    getElement(
                        id
                    );


                if (
                    !element
                ) {

                    return;

                }


                /*
                 * Close button tidak boleh menjadi
                 * submit button.
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
            function (
                id
            ) {

                const element =
                    getElement(
                        id
                    );


                if (
                    !element
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
            function (
                element
            ) {

                /*
                 * Hindari duplicate binding
                 * pada tombol yang sudah ditangani
                 * berdasarkan ID.
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


        if (
            !modal
        ) {

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

    function bind(
        options = {}
    ) {

        /*
         * Update data terlebih dahulu.
         */

        setData(
            options
        );


        /*
         * Jika sudah terpasang,
         * jangan membuat listener kedua.
         */

        if (
            initialized
        ) {

            return true;

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

    function rebind(
        options = {}
    ) {

        unbind();


        return bind(
            options
        );

    }


    /* =====================================================
       INITIALIZE
    ===================================================== */

    function initialize(
        options = {}
    ) {

        /*
         * Data boleh diperbarui walaupun event
         * sudah terpasang.
         */

        setData(
            options
        );


        if (
            initialized
        ) {

            return true;

        }


        return bind();

    }


    /* =====================================================
       UPDATE DATA
       -----------------------------------------------------
       Berguna ketika Models UI selesai memuat data
       setelah event module sudah terpasang.
    ===================================================== */

    function updateData(
        options = {}
    ) {

        setData(
            options
        );


        /*
         * Jika form sedang tersedia,
         * sinkronkan layout dengan data terbaru.
         */

        const form =
            getForm();


        const layout =
            getLayout();


        if (
            form &&
            layout
        ) {

            if (
                typeof layout.updateModelIdOptions ===
                    "function"
            ) {

                try {

                    layout.updateModelIdOptions(
                        form,
                        currentModels
                    );

                } catch (
                    error
                ) {

                    console.warn(
                        "[GEN-Z.AI] Model ID options update gagal:",
                        error
                    );

                }

            }


            if (
                typeof layout.updateProviderStatus ===
                    "function"
            ) {

                try {

                    layout.updateProviderStatus(
                        form,
                        currentProviders
                    );

                } catch (
                    error
                ) {

                    console.warn(
                        "[GEN-Z.AI] Provider status update gagal:",
                        error
                    );

                }

            }


            if (
                typeof layout.updateCreditFinalPreview ===
                    "function"
            ) {

                try {

                    layout.updateCreditFinalPreview(
                        form
                    );

                } catch (
                    error
                ) {

                    console.warn(
                        "[GEN-Z.AI] Credit preview update gagal:",
                        error
                    );

                }

            }

        }


        return getData();

    }


    /* =====================================================
       STATUS
    ===================================================== */

    function isBound() {

        return initialized;

    }


    /* =====================================================
       DESTROY
    ===================================================== */

    function destroy() {

        unbind();


        currentModels =
            [];

        currentProviders =
            [];


        return true;

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

            destroy,

            isBound,

            setData,

            updateData,

            getData,

            openModal,

            closeModal,

            isModalOpen,

            handleSubmit,

            handleProviderChange,

            handleModelChange,

            handleModelInput,

            handleCloseClick,

            handleCancel,

            handleBackdropClick,

            handleEscape

        });


})();
