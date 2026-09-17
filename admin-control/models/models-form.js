/* =========================================================
   GEN-Z.AI
   ADMIN MODEL MANAGEMENT
   MODEL FORM MODULE

   File:
   admin-control/models/models-form.js

   Fungsi:
   - Membuka modal Tambah Model
   - Membuka modal Edit Model
   - Menutup modal
   - Sinkronisasi Model ID dengan Model Search
   - Membaca data form
   - Validasi form
   - Cocok dengan ID aktual models.html
========================================================= */

(function () {
    "use strict";

    let editingModel = null;

    /* =====================================================
       ELEMENT HELPER
    ===================================================== */

    function getElement(id) {
        return document.getElementById(id);
    }

    function firstElement(ids) {
        for (const id of ids) {
            const element = getElement(id);

            if (element) {
                return element;
            }
        }

        return null;
    }

    function value(id) {
        const element = getElement(id);

        if (!element) {
            return "";
        }

        return element.value;
    }

    function setValue(id, newValue) {
        const element = getElement(id);

        if (!element) {
            return;
        }

        if (Array.isArray(newValue)) {
            element.value = newValue.join(", ");
            return;
        }

        element.value = newValue ?? "";
    }

    function normalizeArray(input) {
        if (Array.isArray(input)) {
            return input
                .map(item => String(item).trim())
                .filter(Boolean);
        }

        if (
            input === null ||
            input === undefined ||
            input === ""
        ) {
            return [];
        }

        return String(input)
            .split(",")
            .map(item => item.trim())
            .filter(Boolean);
    }

    /* =====================================================
       FORM MODE
    ===================================================== */

    function setFormMode(mode) {
        const title = firstElement([
            "modalTitle",
            "modelModalTitle"
        ]);

        const submitButton = firstElement([
            "saveModelBtn",
            "saveModelButton",
            "saveModel"
        ]);

        if (mode === "edit") {
            if (title) {
                title.textContent = "Edit Model";
            }

            if (submitButton) {
                submitButton.textContent =
                    "Simpan Perubahan";
            }

            return;
        }

        if (title) {
            title.textContent = "Tambah Model";
        }

        if (submitButton) {
            submitButton.textContent =
                "Tambah Model";
        }
    }

    /* =====================================================
       OPEN CREATE
    ===================================================== */

    function openCreateForm() {
        editingModel = null;

        clearForm();

        setFormMode("create");

        openModal();

        const search = getElement(
            "modelCodeSearch"
        );

        if (search) {
            window.setTimeout(() => {
                search.focus();
            }, 100);
        }
    }

    /* =====================================================
       OPEN EDIT
    ===================================================== */

    function openEditForm(model) {
        if (!model) {
            console.warn(
                "[models-form] Model tidak tersedia."
            );

            return;
        }

        editingModel = {
            ...model
        };

        setFormMode("edit");

        populateForm(model);

        openModal();
    }

    /* =====================================================
       POPULATE FORM
    ===================================================== */

    function populateForm(model) {
        setValue(
            "modelCode",
            model.model_id || ""
        );

        const modelSearch = getElement(
            "modelCodeSearch"
        );

        if (modelSearch) {
            modelSearch.value =
                model.model_id || "";
        }

        setValue(
            "modelName",
            model.model_name || ""
        );

        /*
         * models.html menggunakan:
         * id="description"
         */
        setValue(
            "description",
            model.description || ""
        );

        setValue(
            "creditCost",
            model.credit_cost ?? ""
        );

        setValue(
            "discountPercent",
            model.discount_percent ?? 0
        );

        setValue(
            "creditFinal",
            model.credit_final ?? ""
        );

        setValue(
            "minDuration",
            model.min_duration ?? ""
        );

        setValue(
            "maxDuration",
            model.max_duration ?? ""
        );

        setValue(
            "supportedRatios",
            normalizeArray(
                model.supported_ratios
            )
        );

        setValue(
            "supportedResolutions",
            normalizeArray(
                model.supported_resolutions
            )
        );

        setValue(
            "modelStatus",
            model.status || "active"
        );

        updateSelectedModelInfo(model);
    }

    /* =====================================================
       CLEAR FORM
    ===================================================== */

    function clearForm() {
        const form = getElement(
            "modelForm"
        );

        if (form) {
            form.reset();
        }

        setValue(
            "modelId",
            ""
        );

        setValue(
            "providerId",
            ""
        );

        setValue(
            "modelCode",
            ""
        );

        setValue(
            "modelName",
            ""
        );

        /*
         * ID aktual models.html:
         * description
         */
        setValue(
            "description",
            ""
        );

        setValue(
            "creditCost",
            ""
        );

        setValue(
            "discountPercent",
            0
        );

        setValue(
            "creditFinal",
            ""
        );

        setValue(
            "minDuration",
            ""
        );

        setValue(
            "maxDuration",
            ""
        );

        setValue(
            "supportedRatios",
            ""
        );

        setValue(
            "supportedResolutions",
            ""
        );

        setValue(
            "modelStatus",
            "active"
        );

        const search = getElement(
            "modelCodeSearch"
        );

        if (search) {
            search.value = "";
        }

        const selectedInfo = getElement(
            "selectedModelInfo"
        );

        if (selectedInfo) {
            selectedInfo.textContent =
                "Belum ada model dipilih.";
        }

        const searchResults = getElement(
            "modelSearchResults"
        );

        if (searchResults) {
            searchResults.innerHTML = "";
        }

        editingModel = null;

        /*
         * Reset preview harga.
         */
        const previewNormal = getElement(
            "previewNormal"
        );

        const previewDiscount = getElement(
            "previewDiscount"
        );

        const previewFinal = getElement(
            "previewFinal"
        );

        const previewKieUsd = getElement(
            "previewKieUsd"
        );

        const previewKieIdr = getElement(
            "previewKieIdr"
        );

        if (previewNormal) {
            previewNormal.textContent = "-";
        }

        if (previewDiscount) {
            previewDiscount.textContent = "-";
        }

        if (previewFinal) {
            previewFinal.textContent = "-";
        }

        if (previewKieUsd) {
            previewKieUsd.textContent = "-";
        }

        if (previewKieIdr) {
            previewKieIdr.textContent = "-";
        }
    }

    /* =====================================================
       OPEN MODAL
    ===================================================== */

    function openModal() {
        const modal = getElement(
            "modelModal"
        );

        if (!modal) {
            console.error(
                "[models-form] #modelModal tidak ditemukan."
            );

            return;
        }

        modal.classList.add("open");

        modal.classList.add("show");

        modal.classList.remove("hidden");

        modal.removeAttribute(
            "aria-hidden"
        );

        /*
         * Jangan memaksa display jika CSS
         * modal sudah mengaturnya.
         */
        if (
            window.getComputedStyle(modal)
                .display === "none"
        ) {
            modal.style.display = "flex";
        }

        document.body.classList.add(
            "modal-open"
        );
    }

    /* =====================================================
       CLOSE MODAL
    ===================================================== */

    function closeModal() {
        const modal = getElement(
            "modelModal"
        );

        if (!modal) {
            return;
        }

        modal.classList.remove(
            "open"
        );

        modal.classList.remove(
            "show"
        );

        modal.classList.add(
            "hidden"
        );

        modal.setAttribute(
            "aria-hidden",
            "true"
        );

        modal.style.display = "none";

        document.body.classList.remove(
            "modal-open"
        );
    }

    /* =====================================================
       FORM DATA
    ===================================================== */

    function getFormData() {
        const data = {
            provider_id:
                value("providerId"),

            model_id:
                value("modelCode"),

            model_name:
                value("modelName"),

            description:
                value("description"),

            credit_cost:
                value("creditCost"),

            discount_percent:
                value("discountPercent"),

            credit_final:
                value("creditFinal"),

            min_duration:
                value("minDuration"),

            max_duration:
                value("maxDuration"),

            supported_ratios:
                normalizeArray(
                    value(
                        "supportedRatios"
                    )
                ),

            supported_resolutions:
                normalizeArray(
                    value(
                        "supportedResolutions"
                    )
                ),

            status:
                value("modelStatus")
        };

        return data;
    }

    /* =====================================================
       VALIDATE
    ===================================================== */

    function validateForm(data) {
        if (!data.model_id) {
            return "Model ID wajib dipilih.";
        }

        if (!data.model_name) {
            return "Model Name wajib diisi.";
        }

        if (
            data.credit_cost !== "" &&
            Number.isNaN(
                Number(data.credit_cost)
            )
        ) {
            return (
                "Credit Cost harus berupa angka."
            );
        }

        if (
            data.discount_percent !== "" &&
            Number.isNaN(
                Number(
                    data.discount_percent
                )
            )
        ) {
            return (
                "Discount Percent harus berupa angka."
            );
        }

        if (
            data.discount_percent !== "" &&
            (
                Number(
                    data.discount_percent
                ) < 0 ||
                Number(
                    data.discount_percent
                ) > 100
            )
        ) {
            return (
                "Discount Percent harus antara 0 sampai 100."
            );
        }

        if (
            data.min_duration !== "" &&
            Number.isNaN(
                Number(data.min_duration)
            )
        ) {
            return (
                "Minimum Duration harus berupa angka."
            );
        }

        if (
            data.max_duration !== "" &&
            Number.isNaN(
                Number(data.max_duration)
            )
        ) {
            return (
                "Maximum Duration harus berupa angka."
            );
        }

        if (
            data.min_duration !== "" &&
            data.max_duration !== "" &&
            Number(data.min_duration) >
                Number(data.max_duration)
        ) {
            return (
                "Minimum Duration tidak boleh lebih besar dari Maximum Duration."
            );
        }

        return null;
    }

    /* =====================================================
       SELECTED MODEL INFO
    ===================================================== */

    function updateSelectedModelInfo(model) {
        const info = getElement(
            "selectedModelInfo"
        );

        if (!info || !model) {
            return;
        }

        info.innerHTML = `
            <strong>Model dipilih:</strong>
            ${escapeHtml(
                model.model_name ||
                model.model_id ||
                "-"
            )}
            <br>
            <span>
                ${escapeHtml(
                    model.model_id ||
                    "-"
                )}
            </span>
        `;
    }

    /* =====================================================
       ESCAPE HTML
    ===================================================== */

    function escapeHtml(value) {
        return String(
            value ?? ""
        )
            .replace(
                /&/g,
                "&amp;"
            )
            .replace(
                /</g,
                "&lt;"
            )
            .replace(
                />/g,
                "&gt;"
            )
            .replace(
                /"/g,
                "&quot;"
            )
            .replace(
                /'/g,
                "&#039;"
            );
    }

    /* =====================================================
       SELECT MODEL FROM SEARCH
    ===================================================== */

    function setSelectedModel(model) {
        if (!model) {
            return;
        }

        setValue(
            "modelCode",
            model.model_id || ""
        );

        const search = getElement(
            "modelCodeSearch"
        );

        if (search) {
            search.value =
                model.model_id || "";
        }

        setValue(
            "modelName",
            model.model_name || ""
        );

        /*
         * Provider dari model Supabase.
         */
        if (model.provider) {
            setValue(
                "providerId",
                model.provider
            );
        }

        updateSelectedModelInfo(
            model
        );
    }

    /* =====================================================
       GET STATE
    ===================================================== */

    function getEditingModel() {
        return editingModel;
    }

    function isEditing() {
        return Boolean(
            editingModel
        );
    }

    /* =====================================================
       BIND CLOSE BUTTONS
    ===================================================== */

    function initialize() {
        const closeButton =
            firstElement([
                "closeModalBtn",
                "closeModelModal",
                "closeModalButton",
                "modelModalClose"
            ]);

        const cancelButton =
            firstElement([
                "cancelModalBtn",
                "cancelModelButton",
                "cancelModelBtn",
                "cancelBtn"
            ]);

        if (closeButton) {
            closeButton.addEventListener(
                "click",
                function (event) {
                    event.preventDefault();
                    event.stopPropagation();

                    closeModal();
                }
            );
        }

        if (cancelButton) {
            cancelButton.addEventListener(
                "click",
                function (event) {
                    event.preventDefault();
                    event.stopPropagation();

                    closeModal();
                }
            );
        }

        const modal = getElement(
            "modelModal"
        );

        if (modal) {
            modal.addEventListener(
                "click",
                function (event) {
                    if (
                        event.target ===
                        modal
                    ) {
                        closeModal();
                    }
                }
            );
        }

        document.addEventListener(
            "keydown",
            function (event) {
                if (
                    event.key ===
                    "Escape"
                ) {
                    const modal =
                        getElement(
                            "modelModal"
                        );

                    if (
                        modal &&
                        (
                            modal.classList
                                .contains("open") ||
                            modal.classList
                                .contains("show")
                        )
                    ) {
                        closeModal();
                    }
                }
            }
        );
    }

    /* =====================================================
       PUBLIC API
    ===================================================== */

    window.GENZModelsForm = {
        initialize,
        openCreateForm,
        openEditForm,
        openModal,
        closeModal,
        clearForm,
        getFormData,
        validateForm,
        getEditingModel,
        isEditing,
        setSelectedModel,
        updateSelectedModelInfo,

        onModelSelected: null
    };
})();
