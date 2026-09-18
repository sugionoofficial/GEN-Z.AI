/* =========================================================
   GEN-Z.AI
   MODEL TABLE EVENTS MODULE

   File:
   admin-control/models/functions/model-table-events.js

   TUGAS:
   - Menangani event tombol pada tabel Models
   - Edit Model
   - Delete Model
   - Select Model
   - Tidak melakukan query Supabase
   - Tidak merender tabel
   - Tidak mengelola Provider
   - Tidak mengelola Search

   DEPENDENCY:
   - GENZModelTable
   - GENZModelsForm
   - GENZModelFormDelete
========================================================= */

(function () {
    "use strict";

    let bound = false;

    /* =====================================================
       HELPERS
    ===================================================== */

    function getTableBody() {
        return (
            document.getElementById(
                "modelTableBody"
            ) ||
            document.querySelector(
                "[data-model-table-body]"
            )
        );
    }

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

    function notify(
        message,
        type = "info"
    ) {
        const ui =
            getUI();

        if (
            ui &&
            typeof ui.notify ===
                "function"
        ) {
            ui.notify(
                message,
                type
            );

            return;
        }

        console.log(
            "[model-table-events]",
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
                modelId || ""
            ).trim();

        if (!normalized) {
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
                const result =
                    table.findById(
                        normalized
                    );

                if (result) {
                    return result;
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
                return (
                    ui.findModelById(
                        normalized
                    ) ||
                    null
                );
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
       EDIT
    ===================================================== */

    function editModel(
        modelId
    ) {
        const model =
            findModel(
                modelId
            );

        if (!model) {
            notify(
                "Model tidak ditemukan.",
                "error"
            );

            return false;
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
                    result.catch(
                        error => {
                            console.error(
                                "[model-table-events] openEditForm error:",
                                error
                            );

                            notify(
                                "Gagal membuka form edit model.",
                                "error"
                            );
                        }
                    );
                }

                return true;

            } catch (error) {
                console.error(
                    "[model-table-events] edit error:",
                    error
                );

                notify(
                    "Gagal membuka form edit model.",
                    "error"
                );

                return false;
            }
        }

        notify(
            "Module form belum tersedia.",
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

        if (!model) {
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
                `Hapus ${modelName}?\n\nData model akan dihapus dari database.`
            );

        if (!confirmed) {
            return false;
        }

        const deleteModule =
            getDeleteModule();

        if (
            deleteModule &&
            typeof deleteModule.deleteModel ===
                "function"
        ) {
            try {
                const result =
                    await deleteModule.deleteModel(
                        model
                    );

                if (
                    result === false
                ) {
                    return false;
                }

                removeFromTable(
                    modelId
                );

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

        /* =================================================
           FALLBACK KE FORM LAMA
        ================================================= */

        const form =
            getFormModule();

        if (
            form &&
            typeof form.deleteModel ===
                "function"
        ) {
            try {
                await form.deleteModel(
                    model
                );

                removeFromTable(
                    modelId
                );

                notify(
                    "Model berhasil dihapus.",
                    "success"
                );

                return true;

            } catch (error) {
                console.error(
                    "[model-table-events] legacy delete error:",
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

        notify(
            "Module delete model belum tersedia.",
            "error"
        );

        return false;
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
                table.removeById(
                    modelId
                );

                return true;
            } catch (error) {
                console.warn(
                    "[model-table-events] removeById error:",
                    error
                );
            }
        }

        const row =
            document.querySelector(
                `[data-model-id="${CSS.escape(
                    String(modelId)
                )}"]`
            );

        if (row) {
            row.remove();
            return true;
        }

        return false;
    }

    /* =====================================================
       SELECT
    ===================================================== */

    function selectModel(
        modelId
    ) {
        const model =
            findModel(
                modelId
            );

        if (!model) {
            return false;
        }

        const ui =
            getUI();

        if (
            ui &&
            typeof ui.selectModel ===
                "function"
        ) {
            try {
                ui.selectModel(
                    model
                );

                return true;
            } catch (error) {
                console.warn(
                    "[model-table-events] ui.selectModel error:",
                    error
                );
            }
        }

        const form =
            getFormModule();

        if (
            form &&
            typeof form.setSelectedModel ===
                "function"
        ) {
            try {
                form.setSelectedModel(
                    model
                );

                return true;
            } catch (error) {
                console.warn(
                    "[model-table-events] form.setSelectedModel error:",
                    error
                );
            }
        }

        return false;
    }

    /* =====================================================
       EVENT HANDLER
    ===================================================== */

    function handleClick(
        event
    ) {
        const target =
            event.target.closest(
                "[data-model-edit], [data-model-delete], [data-model-select]"
            );

        if (!target) {
            return;
        }

        const editId =
            target.getAttribute(
                "data-model-edit"
            );

        const deleteId =
            target.getAttribute(
                "data-model-delete"
            );

        const selectId =
            target.getAttribute(
                "data-model-select"
            );

        if (editId) {
            event.preventDefault();
            editModel(
                editId
            );

            return;
        }

        if (deleteId) {
            event.preventDefault();

            deleteModel(
                deleteId
            );

            return;
        }

        if (selectId) {
            event.preventDefault();

            selectModel(
                selectId
            );
        }
    }

    /* =====================================================
       BIND
    ===================================================== */

    function bind() {
        if (bound) {
            return true;
        }

        const table =
            getTableBody();

        if (!table) {
            console.warn(
                "[model-table-events] #modelTableBody belum tersedia."
            );

            return false;
        }

        table.addEventListener(
            "click",
            handleClick
        );

        table.dataset
            .genzTableEventsBound =
            "true";

        bound = true;

        console.info(
            "[GEN-Z.AI] Model table events initialized."
        );

        return true;
    }

    /* =====================================================
       UNBIND
    ===================================================== */

    function unbind() {
        const table =
            getTableBody();

        if (
            table &&
            bound
        ) {
            table.removeEventListener(
                "click",
                handleClick
            );

            delete table.dataset
                .genzTableEventsBound;
        }

        bound = false;

        return true;
    }

    /* =====================================================
       PUBLIC API
    ===================================================== */

    window.GENZModelTableEvents =
        Object.freeze({
            bind,
            unbind,
            editModel,
            deleteModel,
            selectModel,
            findModel,
            removeFromTable,
            isBound: () =>
                bound
        });

})();
