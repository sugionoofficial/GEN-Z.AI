/* =========================================================
   GEN-Z.AI
   ADMIN MODEL MANAGEMENT
   MODEL SEARCH MODULE

   File:
   admin-control/models/models-search.js

   Fungsi:
   - Memuat model KIE dari Supabase
   - Pencarian Model ID
   - Pemilihan model dengan tombol ✓
   - Mengisi Model ID otomatis
   - Sinkronisasi Provider otomatis
   - Menyisipkan CSS dropdown secara otomatis
   - Menjaga kompatibilitas dengan models-ui.js
========================================================= */

(function () {
    "use strict";

    let models = [];
    let selectedModel = null;
    let eventsBound = false;

    /* =====================================================
       INJECT STYLES
    ===================================================== */

    function injectStyles() {
        const styleId = "genz-model-search-styles";

        if (document.getElementById(styleId)) {
            return;
        }

        const style = document.createElement("style");

        style.id = styleId;

        style.textContent = `
            /* =================================================
               MODEL ID SEARCH
            ================================================= */

            .model-search-box {
                position: relative;
            }

            .model-search-results {
                position: absolute;
                top: calc(100% + 6px);
                left: 0;
                right: 0;
                z-index: 10000;
                max-height: 360px;
                overflow-y: auto;
                background: #0d1424;
                border: 1px solid var(--border);
                border-radius: 10px;
                box-shadow: 0 18px 45px rgba(0, 0, 0, .45);
            }

            .model-search-item {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                padding: 11px 12px;
                border-bottom: 1px solid rgba(255,255,255,.07);
                transition: background .18s ease;
            }

            .model-search-item:last-child {
                border-bottom: 0;
            }

            .model-search-item:hover {
                background: rgba(99,102,241,.10);
            }

            .model-search-info {
                min-width: 0;
                flex: 1;
            }

            .model-search-id {
                color: #f8fafc;
                font-size: 12px;
                font-weight: 800;
                line-height: 1.4;
                word-break: break-all;
            }

            .model-search-name {
                margin-top: 3px;
                color: #cbd5e1;
                font-size: 11px;
                line-height: 1.4;
            }

            .model-search-provider {
                margin-top: 3px;
                color: var(--muted);
                font-size: 10px;
                line-height: 1.4;
            }

            .model-select-check {
                flex: 0 0 auto;
                width: 32px;
                height: 32px;
                border: 1px solid rgba(34,197,94,.35);
                border-radius: 8px;
                background: rgba(34,197,94,.08);
                color: #86efac;
                font-size: 17px;
                font-weight: 900;
                display: flex;
                align-items: center;
                justify-content: center;
                transition:
                    background .18s ease,
                    border-color .18s ease,
                    transform .18s ease;
                cursor: pointer;
            }

            .model-select-check:hover {
                background: rgba(34,197,94,.18);
                border-color: rgba(34,197,94,.60);
                transform: scale(1.04);
            }

            .model-select-check.selected {
                background: rgba(34,197,94,.22);
                border-color: rgba(34,197,94,.70);
                color: #bbf7d0;
            }

            .model-search-empty {
                padding: 15px;
                color: var(--muted);
                font-size: 12px;
                text-align: center;
            }

            #selectedModelInfo {
                margin-top: 6px;
            }

            #selectedModelInfo strong {
                color: #e2e8f0;
            }

            #selectedModelInfo span {
                color: var(--muted);
            }

            @media (max-width: 600px) {
                .model-search-results {
                    max-height: 300px;
                }

                .model-search-item {
                    padding: 10px;
                }

                .model-search-id {
                    font-size: 11px;
                }

                .model-select-check {
                    width: 30px;
                    height: 30px;
                }
            }
        `;

        document.head.appendChild(style);
    }

    /* =====================================================
       ESCAPE HTML
    ===================================================== */

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    /* =====================================================
       ELEMENT
    ===================================================== */

    function getElements() {
        return {
            searchInput:
                document.getElementById(
                    "modelCodeSearch"
                ),

            results:
                document.getElementById(
                    "modelSearchResults"
                ),

            hiddenInput:
                document.getElementById(
                    "modelCode"
                ),

            selectedInfo:
                document.getElementById(
                    "selectedModelInfo"
                ),

            providerInput:
                document.getElementById(
                    "providerId"
                )
        };
    }

    /* =====================================================
       DATA MODULE
    ===================================================== */

    function getDataModule() {
        return (
            window.GENZModelsData ||
            null
        );
    }

    /* =====================================================
       FORM MODULE
    ===================================================== */

    function getFormModule() {
        return (
            window.GENZModelsForm ||
            null
        );
    }

    /* =====================================================
       INITIALIZE
    ===================================================== */

    async function initialize() {
        injectStyles();

        const elements =
            getElements();

        if (
            !elements.searchInput ||
            !elements.results
        ) {
            console.warn(
                "[models-search] Element pencarian belum tersedia."
            );

            return;
        }

        const data =
            getDataModule();

        if (
            !data ||
            typeof data.loadKieModels !==
                "function"
        ) {
            console.error(
                "[models-search] models-data.js belum dimuat."
            );

            return;
        }

        try {
            models =
                await data.loadKieModels({
                    activeOnly: true
                });

            bindEvents();

            render(
                elements.searchInput.value
            );

        } catch (error) {
            console.error(
                "[models-search] Gagal memuat model:",
                error
            );

            elements.results.innerHTML = `
                <div class="model-search-empty">
                    Gagal memuat Model ID.
                </div>
            `;
        }
    }

    /* =====================================================
       EVENTS
    ===================================================== */

    function bindEvents() {
        if (eventsBound) {
            return;
        }

        const elements =
            getElements();

        if (
            !elements.searchInput ||
            !elements.results
        ) {
            return;
        }

        eventsBound = true;

        elements.searchInput.addEventListener(
            "input",
            function () {
                render(
                    elements.searchInput.value
                );
            }
        );

        elements.searchInput.addEventListener(
            "focus",
            function () {
                render(
                    elements.searchInput.value
                );
            }
        );

        elements.results.addEventListener(
            "click",
            function (event) {
                const button =
                    event.target.closest(
                        "[data-model-index]"
                    );

                if (!button) {
                    return;
                }

                const index =
                    Number(
                        button.dataset
                            .modelIndex
                    );

                if (
                    Number.isNaN(index) ||
                    !models[index]
                ) {
                    return;
                }

                selectModel(
                    models[index]
                );
            }
        );

        document.addEventListener(
            "click",
            function (event) {
                const box =
                    elements.searchInput.closest(
                        ".model-search-box"
                    );

                if (
                    box &&
                    !box.contains(
                        event.target
                    )
                ) {
                    elements.results.innerHTML =
                        "";
                }
            }
        );
    }

    /* =====================================================
       RENDER
    ===================================================== */

    function render(
        keyword = ""
    ) {
        const elements =
            getElements();

        if (!elements.results) {
            return;
        }

        const term =
            String(
                keyword || ""
            )
                .trim()
                .toLowerCase();

        let filtered =
            models;

        if (term) {
            filtered =
                models.filter(
                    model => {
                        const modelId =
                            String(
                                model.model_id ||
                                ""
                            ).toLowerCase();

                        const modelName =
                            String(
                                model.model_name ||
                                ""
                            ).toLowerCase();

                        const family =
                            String(
                                model.model_family ||
                                ""
                            ).toLowerCase();

                        const provider =
                            String(
                                model.provider ||
                                ""
                            ).toLowerCase();

                        return (
                            modelId.includes(
                                term
                            ) ||
                            modelName.includes(
                                term
                            ) ||
                            family.includes(
                                term
                            ) ||
                            provider.includes(
                                term
                            )
                        );
                    }
                );
        }

        if (!filtered.length) {
            elements.results.innerHTML = `
                <div class="model-search-empty">
                    Model tidak ditemukan.
                </div>
            `;

            return;
        }

        const limited =
            filtered.slice(
                0,
                30
            );

        elements.results.innerHTML =
            limited
                .map(
                    model => {
                        const index =
                            models.indexOf(
                                model
                            );

                        const isSelected =
                            selectedModel &&
                            selectedModel.id ===
                                model.id;

                        return `
                            <div
                                class="model-search-item"
                                data-model-row="${index}"
                            >
                                <div class="model-search-info">

                                    <div class="model-search-id">
                                        ${escapeHtml(
                                            model.model_id
                                        )}
                                    </div>

                                    <div class="model-search-name">
                                        ${escapeHtml(
                                            model.model_name ||
                                            "-"
                                        )}
                                    </div>

                                    <div class="model-search-provider">
                                        ${escapeHtml(
                                            model.provider ||
                                            "-"
                                        )}
                                        ${
                                            model.model_family
                                                ? " • " +
                                                  escapeHtml(
                                                      model.model_family
                                                  )
                                                : ""
                                        }
                                    </div>

                                </div>

                                <button
                                    type="button"
                                    class="model-select-check ${
                                        isSelected
                                            ? "selected"
                                            : ""
                                    }"
                                    data-model-index="${index}"
                                    aria-label="Pilih ${escapeHtml(
                                        model.model_id
                                    )}"
                                    title="Pilih model"
                                >
                                    ✓
                                </button>
                            </div>
                        `;
                    }
                )
                .join("");
    }

    /* =====================================================
       PROVIDER SYNC
    ===================================================== */

    async function setProviderFromModel(
        model
    ) {
        if (!model) {
            return null;
        }

        const providerId =
            String(
                model.provider_id ||
                model.provider ||
                ""
            ).trim();

        if (!providerId) {
            return null;
        }

        const form =
            getFormModule();

        if (
            form &&
            typeof form.setProvider ===
                "function"
        ) {
            try {
                const provider =
                    await form.setProvider(
                        providerId
                    );

                if (provider) {
                    return provider;
                }
            } catch (error) {
                console.error(
                    "[models-search] Gagal sinkronisasi provider melalui form:",
                    error
                );
            }
        }

        const elements =
            getElements();

        const select =
            elements.providerInput;

        if (
            !select ||
            select.tagName !==
                "SELECT"
        ) {
            return null;
        }

        const option =
            Array.from(
                select.options
            ).find(
                item =>
                    String(
                        item.value || ""
                    )
                        .trim()
                        .toLowerCase() ===
                    providerId.toLowerCase()
            );

        if (!option) {
            return null;
        }

        select.value =
            option.value;

        select.dispatchEvent(
            new Event(
                "input",
                {
                    bubbles: true
                }
            )
        );

        select.dispatchEvent(
            new Event(
                "change",
                {
                    bubbles: true
                }
            )
        );

        return {
            provider_id:
                option.value,

            provider_name:
                option.textContent
        };
    }

    /* =====================================================
       SELECT MODEL
    ===================================================== */

    async function selectModel(
        model
    ) {
        if (!model) {
            return;
        }

        selectedModel =
            model;

        const elements =
            getElements();

        const modelId =
            String(
                model.model_id ||
                ""
            ).trim();

        /* =================================================
           MODEL ID
        ================================================= */

        if (
            elements.hiddenInput
        ) {
            elements.hiddenInput.value =
                modelId;

            elements.hiddenInput.dispatchEvent(
                new Event(
                    "input",
                    {
                        bubbles: true
                    }
                )
            );

            elements.hiddenInput.dispatchEvent(
                new Event(
                    "change",
                    {
                        bubbles: true
                    }
                )
            );
        }

        if (
            elements.searchInput
        ) {
            elements.searchInput.value =
                modelId;
        }

        /* =================================================
           PROVIDER
        ================================================= */

        const providerId =
            model.provider_id ||
            model.provider ||
            "";

        let provider =
            null;

        if (providerId) {
            provider =
                await setProviderFromModel(
                    model
                );
        }

        /* =================================================
           SELECTED MODEL INFO
        ================================================= */

        if (
            elements.selectedInfo
        ) {
            elements.selectedInfo.innerHTML = `
                <strong>Model dipilih:</strong>
                ${escapeHtml(
                    model.model_name ||
                    modelId ||
                    "-"
                )}
                <br>
                <span>
                    ${escapeHtml(
                        modelId ||
                        "-"
                    )}
                </span>

                ${
                    providerId
                        ? `
                            <br>
                            <span>
                                Provider:
                                ${escapeHtml(
                                    provider?.provider_name ||
                                    providerId
                                )}
                            </span>
                        `
                        : ""
                }
            `;
        }

        /* =================================================
           RENDER SELECTED
        ================================================= */

        render(
            modelId
        );

        /* =================================================
           CALLBACK
        ================================================= */

        if (
            typeof window
                .GENZModelsSearch
                ?.onSelect ===
            "function"
        ) {
            window.GENZModelsSearch.onSelect(
                model
            );
        }

        /* =================================================
           GLOBAL EVENT
        ================================================= */

        document.dispatchEvent(
            new CustomEvent(
                "genz-model-selected",
                {
                    detail:
                        model
                }
            )
        );
    }

    /* =====================================================
       SET MODELS
    ===================================================== */

    function setModels(
        data
    ) {
        models =
            Array.isArray(data)
                ? [...data]
                : [];

        if (selectedModel) {
            const currentId =
                selectedModel.id;

            const updated =
                models.find(
                    model =>
                        model.id ===
                        currentId
                );

            selectedModel =
                updated ||
                null;
        }

        render();
    }

    /* =====================================================
       GET SELECTED MODEL
    ===================================================== */

    function getSelectedModel() {
        return selectedModel;
    }

    /* =====================================================
       CLEAR SELECTION
    ===================================================== */

    function clearSelection() {
        selectedModel =
            null;

        const elements =
            getElements();

        if (
            elements.hiddenInput
        ) {
            elements.hiddenInput.value =
                "";
        }

        if (
            elements.searchInput
        ) {
            elements.searchInput.value =
                "";
        }

        if (
            elements.selectedInfo
        ) {
            elements.selectedInfo.textContent =
                "Belum ada model dipilih.";
        }

        render();
    }

    /* =====================================================
       GET MODELS
    ===================================================== */

    function getModels() {
        return [
            ...models
        ];
    }

    /* =====================================================
       PUBLIC API
    ===================================================== */

    window.GENZModelsSearch = {
        initialize,
        render,
        selectModel,
        setModels,
        getSelectedModel,
        clearSelection,
        getModels,

        onSelect: null
    };

})();
