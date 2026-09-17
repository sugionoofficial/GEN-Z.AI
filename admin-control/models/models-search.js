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
   - Mengisi Provider ID otomatis dari model.provider
   - Menjaga kompatibilitas dengan models-ui.js
========================================================= */

(function () {
    "use strict";

    let models = [];
    let selectedModel = null;
    let eventsBound = false;

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function getElements() {
        return {
            searchInput:
                document.getElementById("modelCodeSearch"),

            results:
                document.getElementById("modelSearchResults"),

            hiddenInput:
                document.getElementById("modelCode"),

            selectedInfo:
                document.getElementById("selectedModelInfo"),

            providerInput:
                document.getElementById("providerId")
        };
    }

    async function initialize() {
        const elements = getElements();

        if (
            !elements.searchInput ||
            !elements.results
        ) {
            console.warn(
                "[models-search] Element pencarian belum tersedia."
            );

            return;
        }

        if (
            !window.GENZModelsData ||
            typeof window.GENZModelsData.loadKieModels !==
                "function"
        ) {
            console.error(
                "[models-search] models-data.js belum dimuat."
            );

            return;
        }

        try {
            models =
                await window.GENZModelsData.loadKieModels({
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

    function bindEvents() {
        if (eventsBound) {
            return;
        }

        const elements = getElements();

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

                const index = Number(
                    button.dataset.modelIndex
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
                    !box.contains(event.target)
                ) {
                    elements.results.innerHTML = "";
                }
            }
        );
    }

    function render(keyword = "") {
        const elements = getElements();

        if (!elements.results) {
            return;
        }

        const term = String(
            keyword || ""
        )
            .trim()
            .toLowerCase();

        let filtered = models;

        if (term) {
            filtered = models.filter(
                model => {
                    const modelId =
                        String(
                            model.model_id || ""
                        ).toLowerCase();

                    const modelName =
                        String(
                            model.model_name || ""
                        ).toLowerCase();

                    const family =
                        String(
                            model.model_family || ""
                        ).toLowerCase();

                    const provider =
                        String(
                            model.provider || ""
                        ).toLowerCase();

                    return (
                        modelId.includes(term) ||
                        modelName.includes(term) ||
                        family.includes(term) ||
                        provider.includes(term)
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
            filtered.slice(0, 30);

        elements.results.innerHTML =
            limited
                .map(model => {
                    const index =
                        models.indexOf(model);

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
                                        "kie"
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
                })
                .join("");
    }

    function setProviderFromModel(model) {
        if (!model) {
            return;
        }

        const elements = getElements();

        const provider =
            String(
                model.provider || ""
            ).trim();

        if (
            !provider ||
            !elements.providerInput
        ) {
            return;
        }

        elements.providerInput.value =
            provider;

        elements.providerInput.dispatchEvent(
            new Event("input", {
                bubbles: true
            })
        );

        elements.providerInput.dispatchEvent(
            new Event("change", {
                bubbles: true
            })
        );
    }

    function selectModel(model) {
        if (!model) {
            return;
        }

        selectedModel = model;

        const elements = getElements();

        const modelId =
            String(
                model.model_id || ""
            ).trim();

        if (elements.hiddenInput) {
            elements.hiddenInput.value =
                modelId;

            elements.hiddenInput.dispatchEvent(
                new Event("input", {
                    bubbles: true
                })
            );

            elements.hiddenInput.dispatchEvent(
                new Event("change", {
                    bubbles: true
                })
            );
        }

        if (elements.searchInput) {
            elements.searchInput.value =
                modelId;
        }

        /*
         * Provider otomatis mengikuti model.
         *
         * Contoh:
         * model.provider = "kie"
         *
         * Maka:
         * providerId = "kie"
         */
        setProviderFromModel(model);

        if (elements.selectedInfo) {
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
                        modelId || "-"
                    )}
                </span>
                ${
                    model.provider
                        ? `
                            <br>
                            <span>
                                Provider:
                                ${escapeHtml(
                                    model.provider
                                )}
                            </span>
                        `
                        : ""
                }
            `;
        }

        /*
         * Setelah model dipilih,
         * tampilkan model tersebut sebagai
         * pilihan aktif.
         */
        render(modelId);

        /*
         * Callback untuk modul lain.
         */
        if (
            typeof window.GENZModelsSearch?.onSelect ===
            "function"
        ) {
            window.GENZModelsSearch.onSelect(
                model
            );
        }

        /*
         * Event global agar modul lain
         * bisa menerima model terpilih
         * tanpa saling bergantung langsung.
         */
        document.dispatchEvent(
            new CustomEvent(
                "genz-model-selected",
                {
                    detail: model
                }
            )
        );
    }

    function setModels(data) {
        models = Array.isArray(data)
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
                updated || null;
        }

        render();
    }

    function getSelectedModel() {
        return selectedModel;
    }

    function clearSelection() {
        selectedModel = null;

        const elements = getElements();

        if (elements.hiddenInput) {
            elements.hiddenInput.value = "";
        }

        if (elements.searchInput) {
            elements.searchInput.value = "";
        }

        if (elements.selectedInfo) {
            elements.selectedInfo.textContent =
                "Belum ada model dipilih.";
        }

        render();
    }

    function getModels() {
        return [...models];
    }

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
