/**
 * =========================================================
 * GEN-Z.AI
 * MODEL TABLE EVENTS
 * ---------------------------------------------------------
 * File:
 * admin-control/models/functions/model-table-events.js
 *
 * Tanggung jawab:
 * - Event tombol Edit
 * - Navigasi ke halaman Edit Model
 * - Event delegation pada tabel Models
 *
 * Tidak bertanggung jawab:
 * - Query Supabase
 * - Render tabel
 * - Render form Edit
 * - Delete model
 * - Update database
 *
 * CATATAN:
 * - Model ID adalah referensi utama model.
 * - Edit Model menggunakan halaman:
 *   ../model-edit.html?model_id=<MODEL_ID>
 * - Tidak ada Delete Model.
 * =========================================================
 */

(function () {

    "use strict";


    /* =====================================================
     * STATE
     * ===================================================== */

    let initialized = false;

    let boundContainer = null;

    let boundClickHandler = null;

    let operationLocked = false;


    /* =====================================================
     * UTILITIES
     * ===================================================== */

    function getContainer(container) {

        if (
            typeof Element !== "undefined" &&
            container instanceof Element
        ) {
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


        const selectors = [

            "#models-table",

            "#modelsTable",

            "#modelTableBody",

            "[data-models-table]",

            ".models-table",

            "table"

        ];


        for (
            const selector of selectors
        ) {

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


    /* =====================================================
     * MODEL ID
     * ===================================================== */

    function getModelIdFromElement(element) {

        if (!element) {

            return null;

        }


        /*
         * Prioritas:
         * 1. data-model-id
         * 2. data-id
         * 3. data-model
         */

        const directModelId =
            element.dataset?.modelId ||
            element.dataset?.id ||
            element.dataset?.model;


        if (directModelId) {

            return String(
                directModelId
            ).trim();

        }


        /*
         * Cari parent row.
         */

        const row =
            element.closest("tr");


        if (row) {

            const rowModelId =
                row.dataset?.modelId ||
                row.dataset?.id ||
                row.dataset?.model;


            if (rowModelId) {

                return String(
                    rowModelId
                ).trim();

            }


            const nestedElement =
                row.querySelector(
                    "[data-model-id], [data-id], [data-model]"
                );


            if (nestedElement) {

                const nestedModelId =
                    nestedElement.dataset?.modelId ||
                    nestedElement.dataset?.id ||
                    nestedElement.dataset?.model;


                if (nestedModelId) {

                    return String(
                        nestedModelId
                    ).trim();

                }

            }

        }


        /*
         * Jika tombol memiliki href dengan
         * query model_id, gunakan nilai tersebut.
         */

        const href =
            element.getAttribute(
                "href"
            );


        if (href) {

            try {

                const url =
                    new URL(
                        href,
                        window.location.href
                    );


                const queryModelId =
                    url.searchParams.get(
                        "model_id"
                    );


                if (queryModelId) {

                    return String(
                        queryModelId
                    ).trim();

                }

            } catch (_) {

                /*
                 * href bukan URL valid.
                 */

            }

        }


        return null;

    }


    /* =====================================================
     * NORMALIZE MODEL ID
     * ===================================================== */

    function normalizeModelId(modelId) {

        if (
            modelId === null ||
            modelId === undefined
        ) {

            return null;

        }


        const value =
            String(modelId).trim();


        if (!value) {

            return null;

        }


        return value;

    }


    /* =====================================================
     * LOCK
     * ===================================================== */

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
     * EDIT NAVIGATION
     * ===================================================== */

    function buildEditUrl(modelId) {

        const normalizedId =
            normalizeModelId(
                modelId
            );


        if (!normalizedId) {

            return null;

        }


        /*
         * model-table-events.js berada di:
         *
         * admin-control/models/functions/
         *
         * Sedangkan model-edit.html berada di:
         *
         * admin-control/model-edit.html
         *
         * Jadi naik dua level:
         *
         * functions -> models -> admin-control
         */

        const baseUrl =
            "../../admin-control/model-edit.html";


        /*
         * Karena halaman Models juga berada
         * di dalam admin-control, gunakan path
         * relatif dari lokasi browser.
         *
         * Saat module dipanggil dari halaman
         * admin-control/models.html, URL yang
         * benar adalah:
         *
         * ./model-edit.html
         */

        const currentPath =
            window.location.pathname;


        let editPath =
            "./model-edit.html";


        /*
         * Jika halaman saat ini berada di folder
         * admin-control/models/, sesuaikan path.
         */

        if (
            currentPath.includes(
                "/admin-control/models/"
            )
        ) {

            editPath =
                "../model-edit.html";

        }


        /*
         * Jika script dijalankan dari:
         *
         * /admin-control/models.html
         *
         * ./model-edit.html sudah benar.
         */

        const url =
            new URL(
                editPath,
                window.location.href
            );


        url.searchParams.set(
            "model_id",
            normalizedId
        );


        return url.href;

    }


    /* =====================================================
     * TRIGGER EDIT
     * ===================================================== */

    async function triggerEdit(
        modelId,
        element = null
    ) {

        const normalizedId =
            normalizeModelId(
                modelId
            );


        if (!normalizedId) {

            console.warn(
                "[GEN-Z.AI Models] " +
                "Model ID untuk Edit tidak ditemukan."
            );


            return false;

        }


        if (!lockOperation()) {

            return false;

        }


        try {

            const editUrl =
                buildEditUrl(
                    normalizedId
                );


            if (!editUrl) {

                throw new Error(
                    "URL Edit Model tidak dapat dibuat."
                );

            }


            /*
             * Navigasi langsung.
             *
             * Tidak menggunakan:
             * - Models UI modal
             * - Form Coordinator
             * - Delete module
             *
             * Ini mencegah recursive event /
             * modal state yang sebelumnya berpotensi
             * menyebabkan Maximum call stack size exceeded.
             */

            window.location.assign(
                editUrl
            );


            return true;

        } catch (error) {

            console.error(
                "[GEN-Z.AI Models] " +
                "Edit gagal:",
                error
            );


            showError(
                error
            );


            return false;

        } finally {

            /*
             * Beri browser kesempatan melakukan
             * navigation terlebih dahulu.
             */

            setTimeout(
                unlockOperation,
                250
            );

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
         * HANYA tangani tombol Edit.
         *
         * Tidak ada selector Delete.
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


        if (!editButton) {

            return;

        }


        event.preventDefault();

        event.stopPropagation();


        const modelId =
            getModelIdFromElement(
                editButton
            );


        if (!modelId) {

            console.warn(
                "[GEN-Z.AI Models] " +
                "Model ID untuk Edit tidak ditemukan.",
                editButton
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

    }


    /* =====================================================
     * ERROR
     * ===================================================== */

    function showError(error) {

        const message =
            error?.message ||
            "Operasi Model gagal.";


        /*
         * Gunakan Models UI hanya untuk
         * menampilkan pesan error.
         *
         * Tidak membuka modal Edit/Delete.
         */

        const ui =
            window.GENZModelsUI ||
            null;


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


        /*
         * Fallback sederhana.
         */

        console.error(
            "[GEN-Z.AI Models]",
            message
        );

    }


    /* =====================================================
     * BIND
     * ===================================================== */

    function bind(container = null) {

        const resolvedContainer =
            getContainer(
                container
            );


        if (!resolvedContainer) {

            /*
             * Tabel mungkin belum dirender.
             * Bukan error fatal.
             */

            return false;

        }


        /*
         * Jangan pasang listener dua kali
         * pada container yang sama.
         */

        if (
            boundContainer ===
            resolvedContainer &&
            boundClickHandler
        ) {

            initialized = true;

            return true;

        }


        /*
         * Bersihkan listener lama.
         */

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


        boundContainer =
            null;


        boundClickHandler =
            null;


        initialized =
            false;


        return true;

    }


    /* =====================================================
     * INITIALIZE
     * ===================================================== */

    function initialize(
        container = null
    ) {

        return bind(
            container
        );

    }


    /* =====================================================
     * REBIND
     * ===================================================== */

    function rebind(
        container = null
    ) {

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


        operationLocked =
            false;


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
         * Lifecycle
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


        /*
         * Event
         */

        handleClick,


        /*
         * URL helper
         */

        buildEditUrl

    };


    /* =====================================================
     * GLOBAL
     * ===================================================== */

    window.GENZModelTableEvents =
        ModelTableEvents;


})();
