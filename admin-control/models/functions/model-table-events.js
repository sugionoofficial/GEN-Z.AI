/* =========================================================
   GEN-Z.AI
   MODEL TABLE EVENTS MODULE
   ---------------------------------------------------------
   File:
   admin-control/models/functions/model-table-events.js

   Tanggung jawab:
   - Event tombol Edit
   - Event tombol Delete
   - Delegasi ke UI / Form Edit / Delete module
   - Sinkronisasi hasil operasi dengan Table

   Tidak bertanggung jawab:
   - Render tabel
   - Query Supabase
   - CRUD API langsung
   - Provider
   - Search
   - Price calculation
   - Form layout
   - Legacy GENZModelsForm
   ========================================================= */

(function () {

    "use strict";


    /* =====================================================
       STATE
    ===================================================== */

    let bound = false;

    let boundBody = null;


    /* =====================================================
       DOM
    ===================================================== */

    function getTableBody() {

        return (

            document.getElementById(
                "modelTableBody"
            ) ||

            document.getElementById(
                "modelsTableBody"
            ) ||

            document.querySelector(
                "#modelsTable tbody"
            ) ||

            document.querySelector(
                "#modelTable tbody"
            ) ||

            document.querySelector(
                "[data-model-table-body]"
            ) ||

            document.querySelector(
                "table tbody"
            )

        );

    }


    /* =====================================================
       MODULE ACCESS
    ===================================================== */

    function getTableModule() {

        return (
            window.GENZModelTable ||
            null
        );

    }


    function getCoordinator() {

        return (
            window.GENZModelFormCoordinator ||
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


    function getUI() {

        return (
            window.GENZModelsUI ||
            null
        );

    }


    /* =====================================================
       NOTIFICATION
    ===================================================== */

    function notify(
        message,
        type
    ) {

        const ui =
            getUI();


        if (
            ui &&
            typeof ui.notify ===
                "function"
        ) {

            try {

                ui.notify(
                    message,
                    type || "info"
                );

                return;

            } catch (error) {

                console.warn(
                    "[model-table-events] notify error:",
                    error
                );

            }

        }


        if (
            type === "error"
        ) {

            console.error(
                "[GEN-Z.AI]",
                message
            );

            return;

        }


        console.log(
            "[GEN-Z.AI]",
            message
        );

    }


    /* =====================================================
       NORMALIZE ID
    ===================================================== */

    function normalizeId(
        value
    ) {

        return String(
            value ??
            ""
        )
            .trim();

    }


    /* =====================================================
       FIND MODEL
       -----------------------------------------------------
       Mendukung:
       - database UUID / id
       - model_id KIE
       ===================================================== */

    function findModel(
        modelId
    ) {

        const normalized =
            normalizeId(
                modelId
            );


        if (
            !normalized
        ) {

            return null;

        }


        /* =================================================
           1. TABLE MODULE
           ================================================= */

        const table =
            getTableModule();


        if (
            table
        ) {

            if (
                typeof table.findById ===
                    "function"
            ) {

                try {

                    const model =
                        table.findById(
                            normalized
                        );


                    if (
                        model
                    ) {

                        return model;

                    }

                } catch (error) {

                    console.warn(
                        "[model-table-events] table.findById error:",
                        error
                    );

                }

            }


            /*
             * Beberapa implementasi table menyimpan
             * data model dalam getModels().
             */
            if (
                typeof table.getModels ===
                    "function"
            ) {

                try {

                    const models =
                        table.getModels();


                    if (
                        Array.isArray(
                            models
                        )
                    ) {

                        const found =
                            models.find(
                                function (model) {

                                    if (
                                        !model
                                    ) {

                                        return false;

                                    }

                                    return (

                                        normalizeId(
                                            model.id
                                        ) === normalized ||

                                        normalizeId(
                                            model.model_id
                                        ) === normalized

                                    );

                                }
                            );


                        if (
                            found
                        ) {

                            return found;

                        }

                    }

                } catch (error) {

                    console.warn(
                        "[model-table-events] table.getModels error:",
                        error
                    );

                }

            }

        }


        /* =================================================
           2. UI MODULE
           ================================================= */

        const ui =
            getUI();


        if (
            ui &&
            typeof ui.findModelById ===
                "function"
        ) {

            try {

                const model =
                    ui.findModelById(
                        normalized
                    );


                if (
                    model
                ) {

                    return model;

                }

            } catch (error) {

                console.warn(
                    "[model-table-events] ui.findModelById error:",
                    error
                );

            }

        }


        /* =================================================
           3. DATA MODULE
           -------------------------------------------------
           Digunakan sebagai fallback terakhir.
           Tidak membuat model baru.
           ================================================= */

        const data =
            window.GENZModelsData ||
            null;


        if (
            data
        ) {

            if (
                typeof data.findModelById ===
                    "function"
            ) {

                try {

                    const model =
                        data.findModelById(
                            normalized
                        );


                    if (
                        model
                    ) {

                        return model;

                    }

                } catch (error) {

                    console.warn(
                        "[model-table-events] data.findModelById error:",
                        error
                    );

                }

            }


            if (
                typeof data.getCachedModels ===
                    "function"
            ) {

                try {

                    const models =
                        data.getCachedModels();


                    if (
                        Array.isArray(
                            models
                        )
                    ) {

                        const found =
                            models.find(
                                function (model) {

                                    if (
                                        !model
                                    ) {

                                        return false;

                                    }

                                    return (

                                        normalizeId(
                                            model.id
                                        ) === normalized ||

                                        normalizeId(
                                            model.model_id
                                        ) === normalized

                                    );

                                }
                            );


                        if (
                            found
                        ) {

                            return found;

                        }

                    }

                } catch (error) {

                    console.warn(
                        "[model-table-events] data.getCachedModels error:",
                        error
                    );

                }

            }

        }


        return null;

    }


    /* =====================================================
       GET MODEL ID FROM TARGET
       -----------------------------------------------------
       Prioritas:
       1. data-model-id
       2. data-id
       3. data-model-code
       4. data-model
       ===================================================== */

    function getModelIdFromTarget(
        target
    ) {

        if (
            !target
        ) {

            return "";

        }


        const attributes = [

            "data-model-id",

            "data-id",

            "data-model-code",

            "data-model"

        ];


        for (
            let i = 0;
            i < attributes.length;
            i++
        ) {

            const value =
                target.getAttribute(
                    attributes[i]
                );


            const normalized =
                normalizeId(
                    value
                );


            if (
                normalized
            ) {

                return normalized;

            }

        }


        /*
         * Jika tombol berada di dalam row,
         * ambil data dari row sebagai fallback.
         */
        const row =
            target.closest(
                "tr"
            );


        if (
            row
        ) {

            for (
                let i = 0;
                i < attributes.length;
                i++
            ) {

                const value =
                    row.getAttribute(
                        attributes[i]
                    );


                const normalized =
                    normalizeId(
                        value
                    );


                if (
                    normalized
                ) {

                    return normalized;

                }

            }

        }


        return "";

    }


    /* =====================================================
       OPEN EDIT
       -----------------------------------------------------
       Jalur utama:

       Table Events
            ↓
       GENZModelsUI.openEditModal()
            ↓
       GENZModelFormEdit.open()
            ↓
       FormEdit.populate()
            ↓
       Modal

       Tidak menggunakan:
       - populateEdit()
       - GENZModelsForm legacy
       ===================================================== */

    async function editModel(
        modelId
    ) {

        const normalizedId =
            normalizeId(
                modelId
            );


        if (
            !normalizedId
        ) {

            notify(
                "ID Model tidak ditemukan.",
                "error"
            );

            return false;

        }


        const model =
            findModel(
                normalizedId
            );


        if (
            !model
        ) {

            console.error(
                "[model-table-events] Model tidak ditemukan:",
                normalizedId
            );


            notify(
                "Model tidak ditemukan.",
                "error"
            );

            return false;

        }


        /* =================================================
           JALUR UTAMA
           ================================================= */

        const ui =
            getUI();


        if (
            ui &&
            typeof ui.openEditModal ===
                "function"
        ) {

            try {

                console.info(
                    "[model-table-events] Membuka edit melalui GENZModelsUI:",
                    model
                );


                const result =
                    await ui.openEditModal(
                        model
                    );


                return (
                    result !== false
                );

            } catch (error) {

                console.error(
                    "[model-table-events] UI edit error:",
                    error
                );


                notify(
                    error?.message ||
                    "Gagal membuka form edit model.",
                    "error"
                );


                return false;

            }

        }


        /* =================================================
           FALLBACK FORM EDIT
           -------------------------------------------------
           Digunakan hanya jika UI module belum tersedia.
           ================================================= */

        const editModule =
            getEditModule();


        if (
            editModule &&
            typeof editModule.open ===
                "function"
        ) {

            try {

                console.info(
                    "[model-table-events] Membuka edit melalui GENZModelFormEdit."
                );


                const result =
                    await editModule.open(
                        model
                    );


                return (
                    result !== false
                );

            } catch (error) {

                console.error(
                    "[model-table-events] FormEdit.open error:",
                    error
                );


                notify(
                    error?.message ||
                    "Gagal membuka form edit model.",
                    "error"
                );


                return false;

            }

        }


        /* =================================================
           FALLBACK MODAL DOM
           -------------------------------------------------
           Hanya untuk kondisi module UI/FormEdit belum
           tersedia tetapi modal sudah ada.
           ================================================= */

        const modal =
            document.getElementById(
                "modelModal"
            );


        if (
            modal
        ) {

            modal.style.display =
                "flex";

            modal.classList.add(
                "show"
            );

            modal.setAttribute(
                "aria-hidden",
                "false"
            );

            document.body.classList.add(
                "modal-open"
            );


            console.warn(
                "[model-table-events] Modal dibuka melalui fallback DOM. FormEdit belum tersedia."
            );


            return true;

        }


        notify(
            "Module form edit belum tersedia.",
            "error"
        );


        console.error(
            "[model-table-events] GENZModelsUI dan GENZModelFormEdit tidak tersedia."
        );


        return false;

    }


    /* =====================================================
       DELETE
    ===================================================== */

    async function deleteModel(
        modelId
    ) {

        const model =
            findModel(
                modelId
            );


        if (
            !model
        ) {

            notify(
                "Model tidak ditemukan.",
                "error"
            );

            return false;

        }


        const modelName =
            model.model_name ||
            model.model_id ||
            model.id ||
            "Model ini";


        const confirmed =
            window.confirm(

                "Hapus " +
                modelName +
                "?\n\n" +
                "Data model akan dihapus dari database."

            );


        if (
            !confirmed
        ) {

            return false;

        }


        const deleteModule =
            getDeleteModule();


        if (
            !deleteModule
        ) {

            notify(
                "Module delete model belum tersedia.",
                "error"
            );

            return false;

        }


        let result;


        try {

            if (
                typeof deleteModule.remove ===
                    "function"
            ) {

                result =
                    await deleteModule.remove(
                        model
                    );

            } else if (
                typeof deleteModule.removeById ===
                    "function"
            ) {

                result =
                    await deleteModule.removeById(
                        model.id
                    );

            } else {

                throw new Error(
                    "Fungsi delete model tidak tersedia."
                );

            }


            if (
                result === false
            ) {

                return false;

            }


            removeFromTable(
                model.id ||
                model.model_id
            );


            try {

                document.dispatchEvent(
                    new CustomEvent(
                        "genz-model-deleted",
                        {
                            detail: {
                                model: model,
                                result: result
                            }
                        }
                    )
                );

            } catch (eventError) {

                console.warn(
                    "[model-table-events] delete event error:",
                    eventError
                );

            }


            notify(
                "Model berhasil dihapus.",
                "success"
            );


            return true;

        } catch (error) {

            console.error(
                "[model-table-events] delete error:",
                error
            );


            notify(
                error?.message ||
                "Gagal menghapus model.",
                "error"
            );


            return false;

        }

    }


    /* =====================================================
       REMOVE FROM TABLE
    ===================================================== */

    function removeFromTable(
        modelId
    ) {

        const table =
            getTableModule();


        if (
            table &&
            typeof table.removeById ===
                "function"
        ) {

            try {

                return table.removeById(
                    modelId
                );

            } catch (error) {

                console.warn(
                    "[model-table-events] table.removeById error:",
                    error
                );

            }

        }


        return false;

    }


    /* =====================================================
       CLICK HANDLER
       ===================================================== */

    function handleClick(
        event
    ) {

        if (
            !event ||
            !event.target
        ) {

            return;

        }


        const button =
            event.target.closest(
                "button[data-action]"
            );


        if (
            !button
        ) {

            return;

        }


        if (
            !boundBody ||
            !boundBody.contains(
                button
            )
        ) {

            return;

        }


        const action =
            String(
                button.getAttribute(
                    "data-action"
                ) ??
                ""
            )
                .trim()
                .toLowerCase();


        if (
            action !== "edit" &&
            action !== "delete"
        ) {

            return;

        }


        const modelId =
            getModelIdFromTarget(
                button
            );


        if (
            !modelId
        ) {

            notify(
                "ID Model tidak ditemukan.",
                "error"
            );

            return;

        }


        event.preventDefault();

        event.stopPropagation();


        if (
            action === "edit"
        ) {

            /*
             * Promise sengaja tidak dibiarkan tanpa
             * penanganan. Error sudah ditangani di
             * editModel(), tetapi catch tambahan menjaga
             * event handler tetap aman.
             */
            editModel(
                modelId
            ).catch(
                function (error) {

                    console.error(
                        "[model-table-events] unhandled edit error:",
                        error
                    );

                    notify(
                        error?.message ||
                        "Gagal membuka form edit model.",
                        "error"
                    );

                }
            );

            return;

        }


        if (
            action === "delete"
        ) {

            deleteModel(
                modelId
            ).catch(
                function (error) {

                    console.error(
                        "[model-table-events] unhandled delete error:",
                        error
                    );

                    notify(
                        error?.message ||
                        "Gagal menghapus model.",
                        "error"
                    );

                }
            );

        }

    }


    /* =====================================================
       BIND
    ===================================================== */

    function bind() {

        const body =
            getTableBody();


        if (
            !body
        ) {

            console.warn(
                "[model-table-events] Table body belum tersedia."
            );

            return false;

        }


        if (
            bound &&
            boundBody === body
        ) {

            return true;

        }


        if (
            bound &&
            boundBody &&
            boundBody !== body
        ) {

            try {

                boundBody.removeEventListener(
                    "click",
                    handleClick
                );

            } catch (error) {

                console.warn(
                    "[model-table-events] old listener cleanup error:",
                    error
                );

            }

        }


        body.addEventListener(
            "click",
            handleClick
        );


        boundBody =
            body;


        bound =
            true;


        body.dataset
            .genzTableEventsBound = "true";


        console.info(
            "[GEN-Z.AI] Model table events initialized."
        );


        return true;

    }


    /* =====================================================
       UNBIND
    ===================================================== */

    function unbind() {

        if (
            boundBody
        ) {

            try {

                boundBody.removeEventListener(
                    "click",
                    handleClick
                );

                delete boundBody
                    .dataset
                    .genzTableEventsBound;

            } catch (error) {

                console.warn(
                    "[model-table-events] unbind error:",
                    error
                );

            }

        }


        boundBody =
            null;


        bound =
            false;


        return true;

    }


    /* =====================================================
       REBIND
    ===================================================== */

    function rebind() {

        unbind();

        return bind();

    }


    /* =====================================================
       INITIALIZE
    ===================================================== */

    function initialize() {

        return bind();

    }


    /* =====================================================
       PUBLIC API
    ===================================================== */

    window.GENZModelTableEvents =
        Object.freeze({

            initialize,

            bind,

            unbind,

            rebind,

            editModel,

            deleteModel,

            findModel,

            removeFromTable,

            getModelIdFromTarget,

            isBound:
                function () {

                    return bound;

                }

        });


})();
