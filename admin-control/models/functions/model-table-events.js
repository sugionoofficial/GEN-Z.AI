/* =========================================================
   GEN-Z.AI
   MODEL TABLE EVENTS MODULE
   ---------------------------------------------------------
   File:
   admin-control/models/functions/model-table-events.js

   Tanggung jawab:
   - Event tombol Edit
   - Event tombol Delete
   - Delegasi ke Form / Coordinator / Delete module
   - Sinkronisasi hasil operasi dengan Table

   Tidak bertanggung jawab:
   - Render tabel
   - Query Supabase
   - CRUD API langsung
   - Provider
   - Search
   - Price calculation
   - Form layout
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


    function getFormModule() {

        return (
            window.GENZModelsForm ||
            null
        );

    }


    function getCoordinator() {

        return (
            window.GENZModelFormCoordinator ||
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
       FIND MODEL
    ===================================================== */

    function findModel(
        modelId
    ) {

        const normalized =
            String(
                modelId ??
                ""
            ).trim();


        if (
            !normalized
        ) {

            return null;

        }


        const table =
            getTableModule();


        if (
            table &&
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


        return null;

    }


    /* =====================================================
       GET MODEL ID FROM TARGET
    ===================================================== */

    function getModelIdFromTarget(
        target
    ) {

        if (
            !target
        ) {

            return "";

        }


        const value =
            target.getAttribute(
                "data-model-id"
            );


        return String(
            value ??
            ""
        ).trim();

    }


    /* =====================================================
       OPEN EDIT
    ===================================================== */

    async function editModel(
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


        const coordinator =
            getCoordinator();


        if (
            coordinator &&
            typeof coordinator.populateEdit ===
                "function"
        ) {

            try {

                const result =
                    await coordinator.populateEdit(
                        model
                    );


                return (
                    result !== false
                );

            } catch (error) {

                console.error(
                    "[model-table-events] coordinator edit error:",
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


        const form =
            getFormModule();


        if (
            form &&
            typeof form.openEditForm ===
                "function"
        ) {

            try {

                const result =
                    form.openEditForm(
                        model
                    );


                if (
                    result &&
                    typeof result.then ===
                        "function"
                ) {

                    await result;

                }


                return true;

            } catch (error) {

                console.error(
                    "[model-table-events] form edit error:",
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


        notify(
            "Module form edit belum tersedia.",
            "error"
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
                model.id
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

            editModel(
                modelId
            );


            return;

        }


        if (
            action === "delete"
        ) {

            deleteModel(
                modelId
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
