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
   - Menjaga kompatibilitas dengan models-ui.js
========================================================= */

(function () {
    "use strict";

    let models = [];
    let selectedModel = null;
    let eventsBound = false;

    /* =====================================================
       ESCAPE HTML
    ===================================================== */

    function escapeHtml(value) {
        return String(value ?? "")
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

        /*
         * Prioritas utama:
         * gunakan models-form.js karena module
         * tersebut sudah mengetahui cara mengambil
         * provider aktif dari public.providers.
         */
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

        /*
         * Fallback:
         * jika models-form belum tersedia,
         * coba gunakan option yang sudah ada
         * di select.
         */
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

        /*
         * Jika model yang sedang dipilih
         * masih ada di data baru,
         * pertahankan pilihan tersebut.
         */
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
