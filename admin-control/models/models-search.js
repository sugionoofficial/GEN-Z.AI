/* =========================================================
   GEN-Z.AI - MODELS SEARCH MODULE
   File:
   admin-control/models/models-search.js

   Tugas:
   - Autocomplete Model ID
   - Pencarian model dari catalog kie_models
   - Filter berdasarkan Provider yang dipilih
   - Mendukung input Model ID manual
   - Sinkronisasi model -> provider
   - Tidak melakukan query Supabase langsung
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
       NORMALIZATION
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

            provider_id:
                providerId,

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

            /*
             * Model ID harus unik di autocomplete.
             */
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
            status === "active" ||
            status === "enabled" ||
            status === "published" ||
            status === ""
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
       PROVIDER STATE
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

        /*
         * Value provider dropdown normalnya:
         * provider_id
         *
         * Text normalnya:
         * Provider Name (provider_id)
         */

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

    function getModelProviderValues(model) {
        const values = [];

        const add = function (value) {
            const normalized =
                String(
                    value ??
                    ""
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
        };

        add(model?.provider_id);
        add(model?.provider);
        add(model?.providerId);
        add(model?.provider_name);
        add(model?.providerName);

        return values;
    }

    function providerMatches(model) {
        const selected =
            getSelectedProviderData();

        if (
            !selected.id &&
            !selected.name &&
            !selected.text
        ) {
            /*
             * Tidak ada provider dipilih.
             * Semua provider boleh dicari.
             */
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
         * Cocokkan ID provider terlebih dahulu.
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
         * Beberapa data lama mungkin menyimpan
         * nama provider, sedangkan dropdown memakai ID.
         *
         * Contoh:
         * model.provider = "ChinaApi"
         * dropdown value = "bytedance"
         * dropdown text = "ChinaApi (bytedance)"
         *
         * Maka pencocokan parsial digunakan sebagai
         * fallback yang aman.
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
        const term =
            String(
                keyword ??
                ""
            )
                .trim()
                .toLowerCase();

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
                     * Jika provider dipilih,
                     * autocomplete hanya menampilkan
                     * model milik provider tersebut.
                     */
                    if (
                        hasProvider &&
                        !providerMatches(model)
                    ) {
                        return false;
                    }

                    /*
                     * Jika keyword kosong,
                     * tampilkan semua model provider tersebut.
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

        /*
         * Urutan hasil:
         *
         * 1. Exact Model ID
         * 2. Provider match
         * 3. Model ID diawali keyword
         * 4. Alphabetical
         */
        results.sort(
            function (a, b) {
                const aId =
                    String(
                        a.model_id ??
                        ""
                    )
                        .trim()
                        .toLowerCase();

                const bId =
                    String(
                        b.model_id ??
                        ""
                    )
                        .trim()
                        .toLowerCase();

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

                const providerDiff =
                    getProviderScore(b) -
                    getProviderScore(a);

                if (
                    providerDiff !==
                    0
                ) {
                    return providerDiff;
                }

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

        /*
         * Manual Model ID
         *
         * Jika user mengetik Model ID yang belum
         * ada di catalog, tetap berikan opsi tersebut.
         *
         * Ini penting karena tidak semua model API
         * harus sudah terdaftar di kie_models.
         */
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
                        String(
                            keyword
                        ).trim(),

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
       HTML SAFETY
       ===================================================== */

    function escapeHtml(value) {
        return String(
            value ??
            ""
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

    function renderResults(
        results
    ) {
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

        const html =
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

                        const manual =
                            model.__manual ===
                            true;

                        return (
                            '<div ' +
                            'class="model-search-item' +
                            (
                                manual
                                    ? " manual"
                                    : ""
                            ) +
                            '" ' +
                            'data-model-id="' +
                            escapeHtml(
                                modelId
                            ) +
                            '">' +

                            '<div class="model-search-item-main">' +

                            '<div class="model-search-item-id">' +
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

                            '</div>' +

                            (
                                family ||
                                provider
                                    ? (
                                        '<div class="model-search-item-meta">' +
                                        (
                                            family
                                                ? escapeHtml(
                                                    family
                                                )
                                                : ""
                                        ) +
                                        (
                                            family &&
                                            provider
                                                ? " • "
                                                : ""
                                        ) +
                                        (
                                            provider
                                                ? escapeHtml(
                                                    provider
                                                )
                                                : ""
                                        ) +
                                        '</div>'
                                    )
                                    : ""
                            ) +

                            (
                                manual
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

        box.innerHTML =
            html;

        showDropdown();
    }

    /* =====================================================
       SELECTED MODEL INFO
       ===================================================== */

    function updateSelectedModelInfo(
        model
    ) {
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
                ? parts.join(
                    " • "
                )
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
       PROVIDER SYNC
       ===================================================== */

    function syncProvider(
        model
    ) {
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
         * Gunakan module Provider jika tersedia.
         * Jangan mengambil alih provider dropdown.
         */
        if (
            window.GENZModelsProvider &&
            typeof
                window.GENZModelsProvider.setValue ===
                "function"
        ) {
            const success =
                window.GENZModelsProvider.setValue(
                    providerId
                );

            if (success) {
                return;
            }
        }

        /*
         * Fallback langsung ke select.
         */
        const select =
            getProviderSelect();

        if (!select) {
            return;
        }

        const options =
            Array.from(
                select.options
            );

        const exact =
            options.find(
                function (option) {
                    return (
                        String(
                            option.value ||
                            ""
                        )
                            .trim()
                            .toLowerCase() ===
                        providerId
                            .toLowerCase()
                    );
                }
            );

        if (exact) {
            select.value =
                exact.value;
        }
    }

    /* =====================================================
       SELECT MODEL
       ===================================================== */

    function selectModel(
        model
    ) {
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

            /*
             * Trigger input/change agar module Form
             * lain dapat mengetahui perubahan.
             */
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
            } catch (
                error
            ) {
                console.warn(
                    "[GEN-Z.AI] Model hidden input event error:",
                    error
                );
            }
        }

        /*
         * Sinkronkan provider hanya untuk
         * model yang berasal dari catalog.
         */
        syncProvider(
            model
        );

        updateSelectedModelInfo(
            model
        );

        hideDropdown();

        /*
         * Beri kesempatan module lain
         * menangani model yang dipilih.
         */
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
       EVENT HANDLERS
       ===================================================== */

    function handleInput(
        event
    ) {
        const input =
            event.currentTarget;

        if (!input) {
            return;
        }

        const keyword =
            String(
                input.value ??
                ""
            ).trim();

        /*
         * Jika user mengubah text setelah memilih
         * model, hidden Model ID harus ikut direset
         * sampai user memilih hasil baru.
         */
        const hiddenInput =
            getHiddenModelInput();

        if (hiddenInput) {
            if (
                String(
                    hiddenInput.value ??
                    ""
                ).trim() !==
                String(
                    input.value ??
                    ""
                ).trim()
            ) {
                hiddenInput.value =
                    "";
            }
        }

        const results =
            search(
                keyword
            );

        renderResults(
            results
        );

        if (
            keyword
        ) {
            showDropdown();
        } else {
            /*
             * Saat kosong, tampilkan daftar model
             * provider yang dipilih.
             */
            if (
                results.length
            ) {
                showDropdown();
            } else {
                hideDropdown();
            }
        }
    }

    function handleFocus(
        event
    ) {
        const input =
            event.currentTarget;

        if (!input) {
            return;
        }

        const keyword =
            String(
                input.value ??
                ""
            ).trim();

        const results =
            search(
                keyword
            );

        if (
            results.length
        ) {
            renderResults(
                results
            );
        }
    }

    function handleKeydown(
        event
    ) {
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

        if (
            !items.length
        ) {
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

            items[index].classList.add(
                "active"
            );

            items[index].scrollIntoView({
                block:
                    "nearest"
            });

            return;
        }

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

            items[index].classList.add(
                "active"
            );

            items[index].scrollIntoView({
                block:
                    "nearest"
            );

            return;
        }

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
                    /*
                     * Manual Model ID.
                     */
                    selectModel({
                        __manual:
                            true,

                        model_id:
                            active.dataset.modelId,

                        provider_id:
                            getSelectedProviderData()
                                .value,

                        provider:
                            getSelectedProviderData()
                                .value,

                        status:
                            "active"
                    });
                }
            }

            return;
        }

        if (
            event.key ===
            "Escape"
        ) {
            hideDropdown();
        }
    }

    function handleResultsClick(
        event
    ) {
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

        /*
         * Manual model.
         */
        selectModel({
            __manual:
                true,

            model_id:
                modelId,

            provider_id:
                getSelectedProviderData()
                    .value,

            provider:
                getSelectedProviderData()
                    .value,

            provider_name:
                getSelectedProviderData()
                    .name,

            status:
                "active"
        });
    }

    function handleProviderChange() {
        const input =
            getSearchInput();

        if (!input) {
            return;
        }

        /*
         * Provider berubah:
         * hasil autocomplete harus berubah
         * mengikuti provider baru.
         */
        const keyword =
            String(
                input.value ??
                ""
            ).trim();

        const hidden =
            getHiddenModelInput();

        /*
         * Model sebelumnya bisa berasal dari provider
         * berbeda. Reset hidden value agar tidak
         * tersimpan model yang salah.
         */
        if (hidden) {
            hidden.value =
                "";
        }

        clearSelectedModelInfo();

        const results =
            search(
                keyword
            );

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

    function handleDocumentClick(
        event
    ) {
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
       MODEL LOOKUP
       ===================================================== */

    function findModelById(
        modelId
    ) {
        const id =
            String(
                modelId ??
                ""
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

        const resultsBox =
            getResultsBox();

        const providerSelect =
            getProviderSelect();

        if (!searchInput) {
            console.warn(
                "[GEN-Z.AI] #modelCodeSearch tidak ditemukan."
            );

            return false;
        }

        /*
         * Input search.
         */
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

        /*
         * Dropdown results.
         */
        if (resultsBox) {
            resultsBox.addEventListener(
                "click",
                handleResultsClick
            );
        }

        /*
         * Provider.
         *
         * Penting:
         * listener hanya dipasang oleh Search module
         * untuk memperbarui hasil pencarian.
         *
         * Tidak mengubah isi dropdown provider.
         */
        if (providerSelect) {
            providerSelect.addEventListener(
                "change",
                handleProviderChange
            );
        }

        /*
         * Klik di luar dropdown.
         */
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
        /*
         * Karena event listener menggunakan function
         * reference yang sama, lepaskan semuanya.
         */
        const searchInput =
            getSearchInput();

        const resultsBox =
            getResultsBox();

        const providerSelect =
            getProviderSelect();

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

        if (providerSelect) {
            providerSelect.removeEventListener(
                "change",
                handleProviderChange
            );
        }

        document.removeEventListener(
            "click",
            handleDocumentClick
        );

        hideDropdown();

        models =
            [];

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
