/* =========================================================
   GEN-Z.AI
   MODEL FORM EVENTS MODULE

   File:
   admin-control/models/functions/model-form-events.js

   TUGAS:
   - Event submit form
   - Event tombol close
   - Event tombol cancel
   - Event backdrop modal
   - Event Escape
   - Tidak mengelola API
   - Tidak mengelola Provider
   - Tidak mengelola Model Search
   - Tidak mengelola Pricing
========================================================= */

(function () {
    "use strict";

    let bound = false;

    /* =====================================================
       HELPERS
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

    function getFormModule() {
        return (
            window.GENZModelsForm ||
            null
        );
    }

    function getModal() {
        return (
            getElement("modelModal") ||
            getElement("modelEditModal") ||
            getElement("editModelModal") ||
            document.querySelector(
                "[data-model-modal]"
            )
        );
    }

    /* =====================================================
       FORM SUBMIT
    ===================================================== */

    function bindSubmit() {
        const form =
            getElement(
                "modelForm"
            );

        if (!form) {
            console.warn(
                "[model-form-events] #modelForm tidak ditemukan."
            );

            return false;
        }

        if (
            form.dataset
                .genzFormEventsSubmitBound ===
            "true"
        ) {
            return true;
        }

        const handler =
            function (event) {
                const formModule =
                    getFormModule();

                if (
                    formModule &&
                    typeof formModule.saveModel ===
                        "function"
                ) {
                    return formModule.saveModel(
                        event
                    );
                }

                console.error(
                    "[model-form-events] GENZModelsForm.saveModel() belum tersedia."
                );

                event.preventDefault();

                return false;
            };

        form.addEventListener(
            "submit",
            handler
        );

        form.dataset
            .genzFormEventsSubmitBound =
            "true";

        /*
         * Simpan reference agar bisa di-unbind.
         */
        form.__genzFormSubmitHandler =
            handler;

        return true;
    }

    /* =====================================================
       CLOSE / CANCEL
    ===================================================== */

    function bindCloseButtons() {
        const selectors = [
            "closeModalBtn",
            "closeModelModal",
            "closeModalButton",
            "modelModalClose",
            "cancelModalBtn",
            "cancelModelButton",
            "cancelModelBtn",
            "cancelBtn"
        ];

        let count = 0;

        for (
            const id of selectors
        ) {
            const button =
                getElement(id);

            if (!button) {
                continue;
            }

            if (
                button.dataset
                    .genzFormEventsCloseBound ===
                "true"
            ) {
                continue;
            }

            const handler =
                function (event) {
                    event.preventDefault();
                    event.stopPropagation();

                    const formModule =
                        getFormModule();

                    if (
                        formModule &&
                        typeof formModule.closeModal ===
                            "function"
                    ) {
                        formModule.closeModal();

                        return;
                    }

                    console.warn(
                        "[model-form-events] closeModal() belum tersedia."
                    );
                };

            button.addEventListener(
                "click",
                handler
            );

            button.dataset
                .genzFormEventsCloseBound =
                "true";

            button.__genzFormCloseHandler =
                handler;

            count++;
        }

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

        if (
            modal.dataset
                .genzFormEventsBackdropBound ===
            "true"
        ) {
            return true;
        }

        const handler =
            function (event) {
                if (
                    event.target !==
                    modal
                ) {
                    return;
                }

                const formModule =
                    getFormModule();

                if (
                    formModule &&
                    typeof formModule.closeModal ===
                        "function"
                ) {
                    formModule.closeModal();
                }
            };

        modal.addEventListener(
            "click",
            handler
        );

        modal.dataset
            .genzFormEventsBackdropBound =
            "true";

        modal.__genzFormBackdropHandler =
            handler;

        return true;
    }

    /* =====================================================
       ESCAPE
    ===================================================== */

    function bindEscape() {
        if (!document.body) {
            return false;
        }

        if (
            document.body.dataset
                .genzFormEventsEscapeBound ===
            "true"
        ) {
            return true;
        }

        const handler =
            function (event) {
                if (
                    event.key !==
                    "Escape"
                ) {
                    return;
                }

                const modal =
                    getModal();

                if (!modal) {
                    return;
                }

                const visible =
                    modal.classList.contains(
                        "show"
                    ) ||
                    modal.classList.contains(
                        "open"
                    ) ||
                    (
                        window.getComputedStyle(
                            modal
                        ).display !==
                        "none"
                    );

                if (!visible) {
                    return;
                }

                const formModule =
                    getFormModule();

                if (
                    formModule &&
                    typeof formModule.closeModal ===
                        "function"
                ) {
                    formModule.closeModal();
                }
            };

        document.addEventListener(
            "keydown",
            handler
        );

        document.body.dataset
            .genzFormEventsEscapeBound =
            "true";

        document.body.__genzFormEscapeHandler =
            handler;

        return true;
    }

    /* =====================================================
       BIND ALL
    ===================================================== */

    function bind() {
        if (bound) {
            return true;
        }

        /*
         * DOM harus tersedia.
         */
        if (!document.body) {
            return false;
        }

        bindSubmit();
        bindCloseButtons();
        bindBackdrop();
        bindEscape();

        bound = true;

        console.info(
            "[GEN-Z.AI] Model form events initialized."
        );

        return true;
    }

    /* =====================================================
       UNBIND
    ===================================================== */

    function unbind() {
        const form =
            getElement(
                "modelForm"
            );

        if (
            form &&
            form.__genzFormSubmitHandler
        ) {
            form.removeEventListener(
                "submit",
                form.__genzFormSubmitHandler
            );

            delete form.__genzFormSubmitHandler;
            delete form.dataset
                .genzFormEventsSubmitBound;
        }

        const ids = [
            "closeModalBtn",
            "closeModelModal",
            "closeModalButton",
            "modelModalClose",
            "cancelModalBtn",
            "cancelModelButton",
            "cancelModelBtn",
            "cancelBtn"
        ];

        for (
            const id of ids
        ) {
            const button =
                getElement(id);

            if (
                button &&
                button.__genzFormCloseHandler
            ) {
                button.removeEventListener(
                    "click",
                    button.__genzFormCloseHandler
                );

                delete button.__genzFormCloseHandler;
                delete button.dataset
                    .genzFormEventsCloseBound;
            }
        }

        const modal =
            getModal();

        if (
            modal &&
            modal.__genzFormBackdropHandler
        ) {
            modal.removeEventListener(
                "click",
                modal.__genzFormBackdropHandler
            );

            delete modal.__genzFormBackdropHandler;
            delete modal.dataset
                .genzFormEventsBackdropBound;
        }

        if (
            document.body &&
            document.body.__genzFormEscapeHandler
        ) {
            document.removeEventListener(
                "keydown",
                document.body.__genzFormEscapeHandler
            );

            delete document.body
                .__genzFormEscapeHandler;

            delete document.body.dataset
                .genzFormEventsEscapeBound;
        }

        bound = false;

        return true;
    }

    /* =====================================================
       PUBLIC API
    ===================================================== */

    window.GENZModelFormEvents =
        Object.freeze({
            bind,
            unbind,
            bindSubmit,
            bindCloseButtons,
            bindBackdrop,
            bindEscape,
            isBound: function () {
                return bound;
            }
        });

})();
