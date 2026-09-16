/* =========================================================
   GEN-Z.AI
   ADMIN MODEL MANAGEMENT
   MODEL FORM MODULE
   File: admin-control/models/models-form.js
========================================================= */

(function () {
    "use strict";

    let editingModel = null;

    function getElement(id) {
        return document.getElementById(id);
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

        if (
            Array.isArray(newValue)
        ) {
            element.value =
                newValue.join(", ");
            return;
        }

        element.value =
            newValue ?? "";
    }

    function normalizeArray(value) {
        if (Array.isArray(value)) {
            return value
                .map(item =>
                    String(item).trim()
                )
                .filter(Boolean);
        }

        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {
            return [];
        }

        return String(value)
            .split(",")
            .map(item =>
                item.trim()
            )
            .filter(Boolean);
    }

    function openCreateForm() {
        editingModel = null;

        clearForm();

        setFormMode("create");

        openModal();
    }

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

    function populateForm(model) {
        setValue(
            "modelCode",
            model.model_id || ""
        );

        const modelSearch =
            getElement(
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

        setValue(
            "modelDescription",
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

    function clearForm() {
        const form =
            getElement("modelForm");

        if (form) {
            form.reset();
        }

        setValue(
            "modelCode",
            ""
        );

        setValue(
            "modelName",
            ""
        );

        setValue(
            "modelDescription",
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

        const search =
            getElement(
                "modelCodeSearch"
            );

        if (search) {
            search.value = "";
        }

        const selectedInfo =
            getElement(
                "selectedModelInfo"
            );

        if (selectedInfo) {
            selectedInfo.textContent =
                "Belum ada model dipilih.";
        }

        editingModel = null;
    }

    function setFormMode(mode) {
        const title =
            getElement("modalTitle");

        const submitButton =
            getElement("saveModelButton");

        if (mode === "edit") {
            if (title) {
                title.textContent =
                    "Edit Model";
            }

            if (submitButton) {
                submitButton.textContent =
                    "Simpan Perubahan";
            }

            return;
        }

        if (title) {
            title.textContent =
                "Tambah Model";
        }

        if (submitButton) {
            submitButton.textContent =
                "Tambah Model";
        }
    }

    function openModal() {
        const modal =
            getElement("modelModal");

        if (!modal) {
            return;
        }

        modal.classList.add("open");

        modal.removeAttribute(
            "aria-hidden"
        );

        document.body.classList.add(
            "modal-open"
        );
    }

    function closeModal() {
        const modal =
            getElement("modelModal");

        if (!modal) {
            return;
        }

        modal.classList.remove("open");

        modal.setAttribute(
            "aria-hidden",
            "true"
        );

        document.body.classList.remove(
            "modal-open"
        );
    }

    function getFormData() {
        const data = {
            provider_id:
                value("providerId"),

            model_id:
                value("modelCode"),

            model_name:
                value("modelName"),

            description:
                value("modelDescription"),

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
            return "Credit Cost harus berupa angka.";
        }

        if (
            data.discount_percent !== "" &&
            Number.isNaN(
                Number(data.discount_percent)
            )
        ) {
            return "Discount Percent harus berupa angka.";
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
            return "Discount Percent harus antara 0 sampai 100.";
        }

        if (
            data.min_duration !== "" &&
            Number.isNaN(
                Number(data.min_duration)
            )
        ) {
            return "Minimum Duration harus berupa angka.";
        }

        if (
            data.max_duration !== "" &&
            Number.isNaN(
                Number(data.max_duration)
            )
        ) {
            return "Maximum Duration harus berupa angka.";
        }

        return null;
    }

    function updateSelectedModelInfo(model) {
        const info =
            getElement(
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

    function setSelectedModel(model) {
        if (!model) {
            return;
        }

        setValue(
            "modelCode",
            model.model_id || ""
        );

        const search =
            getElement(
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

        updateSelectedModelInfo(
            model
        );

        if (
            typeof window
                .GENZModelsForm
                ?.onModelSelected ===
            "function"
        ) {
            window.GENZModelsForm
                .onModelSelected(
                    model
                );
        }
    }

    function getEditingModel() {
        return editingModel;
    }

    function isEditing() {
        return Boolean(
            editingModel
        );
    }

    function initialize() {
        const closeButton =
            getElement(
                "closeModelModal"
            );

        const cancelButton =
            getElement(
                "cancelModelButton"
            );

        if (closeButton) {
            closeButton.addEventListener(
                "click",
                closeModal
            );
        }

        if (cancelButton) {
            cancelButton.addEventListener(
                "click",
                closeModal
            );
        }

        const modal =
            getElement("modelModal");

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
                    event.key === "Escape"
                ) {
                    closeModal();
                }
            }
        );
    }

    window.GENZModelsForm = {
        initialize,
        openCreateForm,
        openEditForm,
        closeModal,
        clearForm,
        getFormData,
        validateForm,
        getEditingModel,
        isEditing,
        setSelectedModel,

        onModelSelected: null
    };
})();
