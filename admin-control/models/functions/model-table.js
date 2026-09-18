/* =========================================================
   GEN-Z.AI
   MODEL TABLE
   ---------------------------------------------------------
   Tanggung jawab:
   - Render tabel Models
   - Format data tabel
   - Tombol Edit
   - Tombol Delete
   - Empty state
   ---------------------------------------------------------
   Tidak mengurus:
   - Search
   - Provider dropdown
   - Form Create/Edit
   - Price calculation
   - API CRUD
   ========================================================= */

(function () {
    "use strict";

    let models = [];

    function getTableBody() {
        return (
            document.getElementById("modelsTableBody") ||
            document.querySelector("#modelsTable tbody") ||
            document.querySelector("table tbody")
        );
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function normalizeModel(model) {
        if (!model) {
            return null;
        }

        return {
            id: String(
                model.id ?? ""
            ).trim(),

            provider_id: String(
                model.provider_id ??
                model.provider ??
                ""
            ).trim(),

            provider_name: String(
                model.provider_name ??
                ""
            ).trim(),

            model_id: String(
                model.model_id ??
                ""
            ).trim(),

            model_name: String(
                model.model_name ??
                ""
            ).trim(),

            model_family: String(
                model.model_family ??
                ""
            ).trim(),

            status: String(
                model.status ??
                "active"
            ).trim(),

            credit_cost:
                model.credit_cost ??
                model.credit ??
                0,

            discount_percent:
                model.discount_percent ??
                0,

            credit_final:
                model.credit_final ??
                0,

            duration:
                model.duration ??
                "",

            ratios:
                model.ratios ??
                "",

            resolutions:
                model.resolutions ??
                ""
        };
    }

    function setModels(list) {

        models = Array.isArray(list)
            ? list
                .map(normalizeModel)
                .filter(Boolean)
            : [];

        return models;
    }

    function getModels() {
        return models.slice();
    }

    function formatNumber(value) {

        const number =
            Number(value);

        if (
            !Number.isFinite(number)
        ) {
            return "0";
        }

        return new Intl.NumberFormat(
            "id-ID"
        ).format(number);
    }

    function formatStatus(status) {

        const value =
            String(
                status ?? "active"
            )
                .trim()
                .toLowerCase();

        const label =
            value === "active"
                ? "Aktif"
                : value === "inactive"
                    ? "Nonaktif"
                    : status || "-";

        return (
            '<span class="status-badge status-' +
            escapeHtml(value) +
            '">' +
            escapeHtml(label) +
            "</span>"
        );
    }

    function renderRow(model) {

        const provider =
            model.provider_name ||
            model.provider_id ||
            "-";

        const modelId =
            model.model_id ||
            "-";

        const modelName =
            model.model_name ||
            "-";

        const family =
            model.model_family ||
            "-";

        const finalCredit =
            formatNumber(
                model.credit_final
            );

        const discount =
            Number(
                model.discount_percent
            );

        const discountText =
            Number.isFinite(discount) &&
            discount > 0
                ? discount + "%"
                : "-";

        return (
            "<tr" +
            ' data-model-id="' +
            escapeHtml(
                model.id
            ) +
            '">' +

            "<td>" +
            "<strong>" +
            escapeHtml(
                modelId
            ) +
            "</strong>" +
            "</td>" +

            "<td>" +
            escapeHtml(
                modelName
            ) +
            "</td>" +

            "<td>" +
            escapeHtml(
                family
            ) +
            "</td>" +

            "<td>" +
            escapeHtml(
                provider
            ) +
            "</td>" +

            "<td>" +
            escapeHtml(
                finalCredit
            ) +
            "</td>" +

            "<td>" +
            escapeHtml(
                discountText
            ) +
            "</td>" +

            "<td>" +
            formatStatus(
                model.status
            ) +
            "</td>" +

            "<td>" +

            '<div class="table-actions">' +

            '<button type="button"' +
            ' class="btn btn-sm btn-edit-model"' +
            ' data-action="edit"' +
            ' data-model-id="' +
            escapeHtml(
                model.id
            ) +
            '">' +
            "Edit" +
            "</button>" +

            '<button type="button"' +
            ' class="btn btn-sm btn-danger btn-delete-model"' +
            ' data-action="delete"' +
            ' data-model-id="' +
            escapeHtml(
                model.id
            ) +
            '">' +
            "Hapus" +
            "</button>" +

            "</div>" +

            "</td>" +

            "</tr>"
        );
    }

    function renderEmpty() {

        const body =
            getTableBody();

        if (!body) {
            return false;
        }

        body.innerHTML =
            '<tr class="models-empty-row">' +
            '<td colspan="8">' +
            "Belum ada Model." +
            "</td>" +
            "</tr>";

        return true;
    }

    function render(list) {

        const body =
            getTableBody();

        if (!body) {
            return false;
        }

        if (
            Array.isArray(list)
        ) {
            setModels(list);
        }

        if (!models.length) {
            return renderEmpty();
        }

        body.innerHTML =
            models
                .map(renderRow)
                .join("");

        return true;
    }

    function findById(id) {

        const value =
            String(
                id ?? ""
            ).trim();

        if (!value) {
            return null;
        }

        return (
            models.find(
                function (model) {
                    return (
                        model.id ===
                        value
                    );
                }
            ) || null
        );
    }

    function removeById(id) {

        const value =
            String(
                id ?? ""
            ).trim();

        models =
            models.filter(
                function (model) {
                    return (
                        model.id !==
                        value
                    );
                }
            );

        render();

        return true;
    }

    function updateModel(model) {

        if (!model) {
            return false;
        }

        const id =
            String(
                model.id ?? ""
            ).trim();

        const index =
            models.findIndex(
                function (item) {
                    return (
                        item.id === id
                    );
                }
            );

        if (index < 0) {
            models.push(
                normalizeModel(
                    model
                )
            );
        } else {
            models[index] =
                normalizeModel(
                    model
                );
        }

        render();

        return true;
    }

    function clear() {

        models = [];

        renderEmpty();
    }

    function initialize() {

        const data =
            window.GENZModelsData;

        if (
            data &&
            typeof data.getCachedModels ===
                "function"
        ) {

            const cached =
                data.getCachedModels();

            if (
                Array.isArray(cached)
            ) {
                setModels(cached);
                render();
            }
        }

        return true;
    }

    window.GENZModelTable =
        Object.freeze({
            initialize,
            setModels,
            getModels,
            render,
            renderRow,
            findById,
            removeById,
            updateModel,
            clear,
            escapeHtml,
            formatNumber
        });

})();
