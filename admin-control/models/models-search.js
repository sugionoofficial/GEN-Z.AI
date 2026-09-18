/* =========================================================
   GEN-Z.AI - MODELS SEARCH MODULE
   File:
   admin-control/models/models-search.js

   Tugas:
   - Autocomplete Model ID
   - Pencarian model dari catalog kie_models
   - Filter berdasarkan Provider
   - Mendukung input Model ID manual
   - Sinkronisasi model -> provider
   - Tidak melakukan query Supabase langsung
   - Tidak mengelola dropdown Provider
   - Tidak melakukan auto-initialize
   - Lifecycle dikendalikan oleh models-init.js
   ========================================================= */

(function () {
    "use strict";

    let models = [];
    let initialized = false;

    /* =====================================================
       DOM HELPERS
       ===================================================== */

    function getElement(id) {
        return document.getElementById(id);
    }

    function getSearchInput() {
        return (
            getElement("modelCodeSearch") ||
            getElement("modelSearch") ||
            getElement("modelIdSearch")
        );
    }

    function getHiddenModelInput() {
        return (
            getElement("modelCode") ||
            getElement("modelId")
        );
    }

    function getResultsBox() {
        return (
            getElement("modelSearchResults") ||
            getElement("modelResults") ||
            getElement("modelDropdown")
        );
    }

    function getSelectedInfo() {
        return (
            getElement("selectedModelInfo") ||
            getElement("modelSelectedInfo")
        );
    }

    function getProviderSelect() {
        return getElement("providerId");
    }

    /* =====================================================
       NORMALIZE MODEL
       ===================================================== */

    function normalizeModel(model) {
        if (
            !model ||
            typeof model !== "object"
        ) {
            return null;
        }

        const modelId = String(
            model.model_id ??
            model.modelId ??
            model.id ??
            ""
        ).trim();

        if (!modelId) {
            return null;
        }

        const providerId = String(
            model.provider_id ??
            model.provider ??
            model.providerId ??
            ""
        ).trim();

        const modelName = String(
            model.model_name ??
            model.modelName ??
            model.name ??
            ""
        ).trim();

        const modelFamily = String(
            model.model_family ??
            model.modelFamily ??
            model.family ??
            ""
        ).trim();

        const providerName = String(
            model.provider_name ??
            model.providerName ??
            ""
        ).trim();

        return {
            ...model,

            model_id: modelId,

            provider_id: providerId,

            provider:
                providerId ||
                model.provider ||
                "",

            model_name:
                modelName,

            model_family:
                modelFamily,

            provider_name:
                providerName
        };
    }

    /* =====================================================
       NORMALIZE MODELS
       ===================================================== */

    function normalizeModels(list) {
        if (!Array.isArray(list)) {
            return [];
        }

        const result = [];
        const seen = new Set();

        list.forEach(function (item) {
            const model =
                normalizeModel(item);

            if (!model) {
                return;
            }

            const key =
                model.model_id
                    .trim()
                    .toLowerCase();

            if (seen.has(key)) {
                return;
            }

            seen.add(key);

            result.push(model);
        });

        return result;
    }

    /* =====================================================
       STATUS
       ===================================================== */

    function isActive(model) {
        const status = String(
            model?.status ??
            "active"
        )
            .trim()
            .toLowerCase();

        return (
            status === "" ||
            status === "active" ||
            status === "enabled" ||
            status === "published"
        );
    }

    /* =====================================================
       MODEL STATE
       ===================================================== */

    function setModels(list) {
        models =
            normalizeModels(list);

        return [
            ...models
        ];
    }

    function getModels() {
        return [
            ...models
        ];
    }

    /* =====================================================
       PROVIDER READ ONLY
       ===================================================== */

    function getSelectedProviderData() {
        const select =
            getProviderSelect();

        if (!select) {
            return {
                value: "",
                text: "",
                id: "",
                name: ""
            };
        }

        const value =
            String(
                select.value || ""
            ).trim();

        const option =
            select.options[
                select.selectedIndex
            ];

        const text =
            String(
                option?.textContent ||
                ""
            ).trim();

        let name = text;

        const match =
            text.match(
                /^(.*?)\s*\(([^()]*)\)\s*$/
            );

        if (match) {
            name =
                String(
                    match[1] || ""
                ).trim();
        }

        return {
            value,
            text,
            id: value,
            name
        };
    }

    /* =====================================================
       MODEL PROVIDER VALUES
       ===================================================== */

    function getModelProviderValues(model) {
        const values = [];

        function add(value) {
            const normalized =
                String(
                    value ?? ""
                )
                    .trim()
                    .toLowerCase();

            if (
                normalized &&
                !values.includes(
                    normalized
                )
            ) {
                values.push(
                    normalized
                );
            }
        }

        add(model?.provider_id);
        add(model?.provider);
        add(model?.providerId);
        add(model?.provider_name);
        add(model?.providerName);

        return values;
    }

    /* =====================================================
       PROVIDER MATCH
       ===================================================== */

    function providerMatches(model) {
        const selected =
            getSelectedProviderData();

        /*
         * Tidak ada Provider dipilih.
         * Semua model boleh ditampilkan.
         */
        if (
            !selected.id &&
            !selected.name &&
            !selected.text
        ) {
            return true;
        }

        const modelProviders =
            getModelProviderValues(
                model
            );

        if (
            modelProviders.length === 0
        ) {
            return false;
        }

        const selectedValues = [
            selected.id,
            selected.name,
            selected.text
        ]
            .map(function (value) {
                return String(
                    value || ""
                )
                    .trim()
                    .toLowerCase();
            })
            .filter(Boolean);

        /*
         * Exact match.
         */
        for (
            const modelProvider
            of modelProviders
        ) {
            for (
                const selectedValue
                of selectedValues
            ) {
                if (
                    modelProvider ===
                    selectedValue
                ) {
                    return true;
                }
            }
        }

        /*
         * Fallback untuk data lama.
         *
         * Contoh:
         *
         * model.provider = "ChinaApi"
         *
         * dropdown:
         * ChinaApi (bytedance)
         */
        for (
            const modelProvider
            of modelProviders
        ) {
            for (
                const selectedValue
                of selectedValues
            ) {
                if (
                    modelProvider.includes(
                        selectedValue
                    ) ||
                    selectedValue.includes(
                        modelProvider
                    )
                ) {
                    return true;
                }
            }
        }

        return false;
    }

    /* =====================================================
       PROVIDER SCORE
       ===================================================== */

    function getProviderScore(model) {
        const selected =
            getSelectedProviderData();

        if (
            !selected.id &&
            !selected.name &&
            !selected.text
        ) {
            return 0;
        }

        return providerMatches(model)
            ? 1000
            : 0;
    }

    /* =====================================================
       SEARCH
       ===================================================== */

    function search(keyword = "") {
        const raw =
            String(
                keyword ?? ""
            ).trim();

        const term =
            raw.toLowerCase();

        const selected =
            getSelectedProviderData();

        const hasProvider =
            !!(
                selected.id ||
                selected.name ||
                selected.text
            );

        let results =
            models.filter(
                function (model) {

                    /*
                     * Hanya model aktif.
                     */
                    if (
                        !isActive(model)
                    ) {
                        return false;
                    }

                    /*
                     * Jika Provider dipilih,
                     * filter berdasarkan Provider.
                     */
                    if (
                        hasProvider &&
                        !providerMatches(model)
                    ) {
                        return false;
                    }

                    /*
                     * Keyword kosong:
                     * tampilkan semua model
                     * dari Provider terpilih.
                     */
                    if (!term) {
                        return true;
                    }

                    const modelId =
                        String(
                            model.model_id ??
                            ""
                        )
                            .trim()
                            .toLowerCase();

                    const modelName =
                        String(
                            model.model_name ??
                            ""
                        )
                            .trim()
                            .toLowerCase();

                    const family =
                        String(
                            model.model_family ??
                            ""
                        )
                            .trim()
                            .toLowerCase();

                    const provider =
                        String(
                            model.provider_id ??
                            model.provider ??
                            model.provider_name ??
                            ""
                        )
                            .trim()
                            .toLowerCase();

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

        /* =================================================
           SORTING
           ================================================= */

        results.sort(
            function (a, b) {

                const aId =
                    String(
                        a.model_id ?? ""
                    )
                        .trim()
                        .toLowerCase();

                const bId =
                    String(
                        b.model_id ?? ""
                    )
                        .trim()
                        .toLowerCase();

                /*
                 * Exact Model ID
                 */
                const aExact =
                    term &&
                    aId === term
                        ? 1000
                        : 0;

                const bExact =
                    term &&
                    bId === term
                        ? 1000
                        : 0;

                if (
                    aExact !==
                    bExact
                ) {
                    return (
                        bExact -
                        aExact
                    );
                }

                /*
                 * Provider match
                 */
                const providerDiff =
                    getProviderScore(b) -
                    getProviderScore(a);

                if (
                    providerDiff !==
                    0
                ) {
                    return providerDiff;
                }

                /*
                 * Model ID starts with keyword.
                 */
                const aStarts =
                    term &&
                    aId.startsWith(
                        term
                    )
                        ? 100
                        : 0;

                const bStarts =
                    term &&
                    bId.startsWith(
                        term
                    )
                        ? 100
                        : 0;

                if (
                    aStarts !==
                    bStarts
                ) {
                    return (
                        bStarts -
                        aStarts
                    );
                }

                /*
                 * Alphabetical.
                 */
                return aId.localeCompare(
                    bId,
                    "id",
                    {
                        sensitivity:
                            "base"
                    }
                );
            }
        );

        /* =================================================
           MANUAL MODEL ID
           ================================================= */

        if (term) {

            const exactExists =
                results.some(
                    function (model) {
                        return (
                            String(
                                model.model_id ??
                                ""
                            )
                                .trim()
                                .toLowerCase() ===
                            term
                        );
                    }
                );

            if (!exactExists) {

                results.push({

                    __manual: true,

                    id: null,

                    provider:
                        selected.value,

                    provider_id:
                        selected.value,

                    provider_name:
                        selected.name,

                    model_id:
                        raw,

                    model_name: "",

                    model_family: "",

                    status:
                        "active"
                });
            }
        }

        return results;
    }

    /* =====================================================
       HTML ESCAPE
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
       DROPDOWN
       ===================================================== */

    function showDropdown() {
        const box =
            getResultsBox();

        if (!box) {
            return;
        }

        box.style.display =
            "block";

        box.classList.add(
            "show"
        );
    }

    function hideDropdown() {
        const box =
            getResultsBox();

        if (!box) {
            return;
        }

        box.style.display =
            "none";

        box.classList.remove(
            "show"
        );
    }

    /* =====================================================
       RENDER RESULTS
       ===================================================== */

    function renderResults(results) {
        const box =
            getResultsBox();

        if (!box) {
            return;
        }

        if (
            !Array.isArray(results) ||
            results.length === 0
        ) {
            box.innerHTML =
                '<div class="model-search-empty">' +
                'Model tidak ditemukan.' +
                '</div>';

            showDropdown();

            return;
        }

        box.innerHTML =
            results
                .map(
                    function (model) {

                        const modelId =
                            String(
                                model.model_id ??
                                ""
                            ).trim();

                        const modelName =
                            String(
                                model.model_name ??
                                ""
                            ).trim();

                        const family =
                            String(
                                model.model_family ??
                                ""
                            ).trim();

                        const provider =
                            String(
                                model.provider_name ??
                                model.provider_id ??
                                model.provider ??
                                ""
                            ).trim();

                        const isManual =
                            model.__manual === true;

                        return (
                            '<div ' +
                            'class="model-search-item' +
                            (
                                isManual
                                    ? " manual"
                                    : ""
                            ) +
                            '" ' +
                            'data-model-id="' +
                            escapeHtml(
                                modelId
                            ) +
                            '">' +

                            '<div class="model-search-item-title">' +
                            escapeHtml(
                                modelId
                            ) +
                            '</div>' +

                            (
                                modelName
                                    ? (
                                        '<div class="model-search-item-name">' +
                                        escapeHtml(
                                            modelName
                                        ) +
                                        '</div>'
                                    )
                                    : ""
                            ) +

                            (
                                family
                                    ? (
                                        '<div class="model-search-item-family">' +
                                        escapeHtml(
                                            family
                                        ) +
                                        '</div>'
                                    )
                                    : ""
                            ) +

                            (
                                provider
                                    ? (
                                        '<div class="model-search-item-provider">' +
                                        'Provider: ' +
                                        escapeHtml(
                                            provider
                                        ) +
                                        '</div>'
                                    )
                                    : ""
                            ) +

                            (
                                isManual
                                    ? (
                                        '<div class="model-search-item-manual">' +
                                        'Gunakan Model ID ini' +
                                        '</div>'
                                    )
                                    : ""
                            ) +

                            '</div>'
                        );
                    }
                )
                .join("");

        showDropdown();
    }

    /* =====================================================
       MODEL INFO
       ===================================================== */

    function updateSelectedModelInfo(model) {
        const info =
            getSelectedInfo();

        if (!info) {
            return;
        }

        if (!model) {
            info.textContent =
                "Belum ada model dipilih.";

            return;
        }

        const modelId =
            String(
                model.model_id ??
                ""
            ).trim();

        const modelName =
            String(
                model.model_name ??
                ""
            ).trim();

        const provider =
            String(
                model.provider_name ??
                model.provider_id ??
                model.provider ??
                ""
            ).trim();

        const parts = [];

        if (modelId) {
            parts.push(
                modelId
            );
        }

        if (modelName) {
            parts.push(
                modelName
            );
        }

        if (provider) {
            parts.push(
                "Provider: " +
                provider
            );
        }

        info.textContent =
            parts.length
                ? parts.join(" • ")
                : "Model dipilih.";
    }

    function clearSelectedModelInfo() {
        const info =
            getSelectedInfo();

        if (!info) {
            return;
        }

        info.textContent =
            "Belum ada model dipilih.";
    }

    /* =====================================================
       SYNC MODEL -> PROVIDER
       ===================================================== */

    function syncProvider(model) {

        if (
            !model ||
            model.__manual === true
        ) {
            return;
        }

        const providerId =
            String(
                model.provider_id ??
                model.provider ??
                ""
            ).trim();

        if (!providerId) {
            return;
        }

        /*
         * Gunakan Provider module
         * sebagai pemilik dropdown.
         */
        if (
            window.GENZModelsProvider &&
            typeof
                window.GENZModelsProvider
                    .setValue ===
                "function"
        ) {
            const success =
                window.GENZModelsProvider
                    .setValue(
                        providerId
                    );

            if (success) {
                return;
            }
        }

        /*
         * Fallback read-only.
         */
        const select =
            getProviderSelect();

        if (!select) {
            return;
        }

        const option =
            Array.from(
                select.options
            ).find(
                function (item) {

                    return (
                        String(
                            item.value || ""
                        )
                            .trim()
                            .toLowerCase() ===
                        providerId
                            .toLowerCase()
                    );
                }
            );

        if (option) {
            select.value =
                option.value;
        }
    }

    /* =====================================================
       SELECT MODEL
       ===================================================== */

    function selectModel(model) {

        if (!model) {
            return;
        }

        const modelId =
            String(
                model.model_id ??
                ""
            ).trim();

        if (!modelId) {
            return;
        }

        const searchInput =
            getSearchInput();

        const hiddenInput =
            getHiddenModelInput();

        if (searchInput) {
            searchInput.value =
                modelId;
        }

        if (hiddenInput) {

            hiddenInput.value =
                modelId;

            try {

                hiddenInput.dispatchEvent(
                    new Event(
                        "input",
                        {
                            bubbles: true
                        }
                    )
                );

                hiddenInput.dispatchEvent(
                    new Event(
                        "change",
                        {
                            bubbles: true
                        }
                    )
                );

            } catch (error) {

                console.warn(
                    "[GEN-Z.AI] Model hidden input event error:",
                    error
                );
            }
        }

        syncProvider(
            model
        );

        updateSelectedModelInfo(
            model
        );

        hideDropdown();

        document.dispatchEvent(
            new CustomEvent(
                "genz-model-selected",
                {
                    detail: {
                        model:
                            model
                    }
                }
            )
        );

        return model;
    }

    /* =====================================================
       INPUT
       ===================================================== */

    function handleInput(event) {

        const input =
            event.currentTarget;

        if (!input) {
            return;
        }

        const value =
            String(
                input.value ?? ""
            );

        const hiddenInput =
            getHiddenModelInput();

        /*
         * Jika user mengubah teks,
         * hidden Model ID lama harus dihapus.
         */
        if (
            hiddenInput &&
            String(
                hiddenInput.value ?? ""
            ) !== value
        ) {
            hiddenInput.value = "";
        }

        const results =
            search(value);

        renderResults(
            results
        );
    }

    /* =====================================================
       FOCUS
       ===================================================== */

    function handleFocus(event) {

        const input =
            event.currentTarget;

        if (!input) {
            return;
        }

        const value =
            String(
                input.value ?? ""
            );

        const results =
            search(value);

        if (
            results.length
        ) {
            renderResults(
                results
            );
        }
    }

    /* =====================================================
       KEYBOARD
       ===================================================== */

    function handleKeydown(event) {

        const box =
            getResultsBox();

        if (!box) {
            return;
        }

        const items =
            Array.from(
                box.querySelectorAll(
                    ".model-search-item"
                )
            );

        if (!items.length) {
            return;
        }

        const active =
            box.querySelector(
                ".model-search-item.active"
            );

        let index =
            active
                ? items.indexOf(
                    active
                )
                : -1;

        /* Arrow Down */
        if (
            event.key ===
            "ArrowDown"
        ) {

            event.preventDefault();

            index =
                Math.min(
                    index + 1,
                    items.length - 1
                );

            items.forEach(
                function (item) {
                    item.classList.remove(
                        "active"
                    );
                }
            );

            items[index]
                .classList.add(
                    "active"
                );

            items[index]
                .scrollIntoView({
                    block:
                        "nearest"
                });

            return;
        }

        /* Arrow Up */
        if (
            event.key ===
            "ArrowUp"
        ) {

            event.preventDefault();

            index =
                Math.max(
                    index - 1,
                    0
                );

            items.forEach(
                function (item) {
                    item.classList.remove(
                        "active"
                    );
                }
            );

            items[index]
                .classList.add(
                    "active"
                );

            items[index]
                .scrollIntoView({
                    block:
                        "nearest"
                });

            return;
        }

        /* Enter */
        if (
            event.key ===
            "Enter"
        ) {

            if (
                active &&
                active.dataset.modelId
            ) {

                event.preventDefault();

                const model =
                    findModelById(
                        active.dataset.modelId
                    );

                if (model) {

                    selectModel(
                        model
                    );

                } else {

                    const provider =
                        getSelectedProviderData();

                    selectModel({

                        __manual:
                            true,

                        model_id:
                            active.dataset
                                .modelId,

                        provider_id:
                            provider.id,

                        provider:
                            provider.id,

                        provider_name:
                            provider.name,

                        status:
                            "active"
                    });
                }
            }

            return;
        }

        /* Escape */
        if (
            event.key ===
            "Escape"
        ) {
            hideDropdown();
        }
    }

    /* =====================================================
       RESULT CLICK
       ===================================================== */

    function handleResultsClick(event) {

        const item =
            event.target.closest(
                ".model-search-item"
            );

        if (!item) {
            return;
        }

        const modelId =
            String(
                item.dataset.modelId ??
                ""
            ).trim();

        if (!modelId) {
            return;
        }

        const model =
            findModelById(
                modelId
            );

        if (model) {

            selectModel(
                model
            );

            return;
        }

        const provider =
            getSelectedProviderData();

        selectModel({

            __manual:
                true,

            model_id:
                modelId,

            provider_id:
                provider.id,

            provider:
                provider.id,

            provider_name:
                provider.name,

            status:
                "active"
        });
    }

    /* =====================================================
       PROVIDER CHANGED
       ===================================================== */

    function handleProviderChanged() {

        const searchInput =
            getSearchInput();

        const hiddenInput =
            getHiddenModelInput();

        if (hiddenInput) {
            hiddenInput.value =
                "";
        }

        clearSelectedModelInfo();

        if (!searchInput) {
            return;
        }

        const keyword =
            String(
                searchInput.value ??
                ""
            ).trim();

        const results =
            search(keyword);

        if (
            results.length
        ) {
            renderResults(
                results
            );
        } else {
            hideDropdown();
        }
    }

    /* =====================================================
       DOCUMENT CLICK
       ===================================================== */

    function handleDocumentClick(event) {

        const searchInput =
            getSearchInput();

        const box =
            getResultsBox();

        if (!searchInput) {
            return;
        }

        if (
            event.target ===
            searchInput
        ) {
            return;
        }

        if (
            box &&
            box.contains(
                event.target
            )
        ) {
            return;
        }

        hideDropdown();
    }

    /* =====================================================
       FIND MODEL
       ===================================================== */

    function findModelById(modelId) {

        const id =
            String(
                modelId ?? ""
            )
                .trim()
                .toLowerCase();

        if (!id) {
            return null;
        }

        return (
            models.find(
                function (model) {

                    return (
                        String(
                            model.model_id ??
                            ""
                        )
                            .trim()
                            .toLowerCase() ===
                        id
                    );
                }
            ) ||
            null
        );
    }

    /* =====================================================
       INITIALIZE
       ===================================================== */

    function initialize() {

        if (initialized) {
            return true;
        }

        const searchInput =
            getSearchInput();

        if (!searchInput) {

            console.warn(
                "[GEN-Z.AI] #modelCodeSearch tidak ditemukan."
            );

            return false;
        }

        searchInput.addEventListener(
            "input",
            handleInput
        );

        searchInput.addEventListener(
            "focus",
            handleFocus
        );

        searchInput.addEventListener(
            "keydown",
            handleKeydown
        );

        const resultsBox =
            getResultsBox();

        if (resultsBox) {

            resultsBox.addEventListener(
                "click",
                handleResultsClick
            );
        }

        /*
         * Tidak listen langsung ke
         * #providerId change.
         *
         * Provider module yang mengontrol
         * perubahan Provider.
         */
        document.addEventListener(
            "genz-models-provider-changed",
            handleProviderChanged
        );

        document.addEventListener(
            "click",
            handleDocumentClick
        );

        initialized =
            true;

        console.log(
            "[GEN-Z.AI] GENZModelsSearch initialized."
        );

        return true;
    }

    /* =====================================================
       DESTROY
       ===================================================== */

    function destroy() {

        const searchInput =
            getSearchInput();

        const resultsBox =
            getResultsBox();

        if (searchInput) {

            searchInput.removeEventListener(
                "input",
                handleInput
            );

            searchInput.removeEventListener(
                "focus",
                handleFocus
            );

            searchInput.removeEventListener(
                "keydown",
                handleKeydown
            );
        }

        if (resultsBox) {

            resultsBox.removeEventListener(
                "click",
                handleResultsClick
            );
        }

        document.removeEventListener(
            "genz-models-provider-changed",
            handleProviderChanged
        );

        document.removeEventListener(
            "click",
            handleDocumentClick
        );

        hideDropdown();

        models = [];

        initialized =
            false;
    }

    /* =====================================================
       PUBLIC API
       ===================================================== */

    window.GENZModelsSearch =
        Object.freeze({

            initialize,
            destroy,

            setModels,

            getModels,

            search,

            findModelById,

            selectModel,

            hideDropdown,

            updateSelectedModelInfo,

            clearSelectedModelInfo
        });

    console.log(
        "[GEN-Z.AI] GENZModelsSearch loaded."
    );

})();
