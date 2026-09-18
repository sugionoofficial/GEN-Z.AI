/* =========================================================
   GEN-Z.AI
   MODELS SEARCH COORDINATOR
   ---------------------------------------------------------
   File:
   admin-control/models/models-search.js

   Tugas:
   - Menyimpan daftar model
   - Melakukan pencarian
   - Filter Provider
   - Mengkoordinasikan module search
   ---------------------------------------------------------
   Tidak mengurus:
   - HTML dropdown
   - CSS dropdown
   - Event binding detail
   - Rendering HTML
   - Provider dropdown
   - Supabase
   ========================================================= */

(function () {
    "use strict";

    let models = [];
    let initialized = false;

    function getSearchInput() {

        return (
            document.getElementById("modelCodeSearch") ||
            document.getElementById("modelSearch") ||
            document.getElementById("modelIdSearch")
        );
    }

    function getHiddenModelInput() {

        return (
            document.getElementById("modelCode") ||
            document.getElementById("modelId")
        );
    }

    function getResultsBox() {

        return (
            document.getElementById("modelSearchResults") ||
            document.getElementById("modelResults") ||
            document.getElementById("modelDropdown")
        );
    }

    function normalizeModel(model) {

        if (
            !model ||
            typeof model !== "object"
        ) {
            return null;
        }

        const modelId =
            String(
                model.model_id ??
                model.modelId ??
                model.id ??
                ""
            ).trim();

        if (!modelId) {
            return null;
        }

        const providerId =
            String(
                model.provider_id ??
                model.provider ??
                model.providerId ??
                ""
            ).trim();

        const providerName =
            String(
                model.provider_name ??
                model.providerName ??
                ""
            ).trim();

        return {
            ...model,

            model_id:
                modelId,

            provider_id:
                providerId,

            provider:
                providerId ||
                model.provider ||
                "",

            model_name:
                String(
                    model.model_name ??
                    model.modelName ??
                    model.name ??
                    ""
                ).trim(),

            model_family:
                String(
                    model.model_family ??
                    model.modelFamily ??
                    model.family ??
                    ""
                ).trim(),

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

        list.forEach(
            function (item) {

                const model =
                    normalizeModel(item);

                if (!model) {
                    return;
                }

                const key =
                    model.model_id
                        .toLowerCase();

                if (seen.has(key)) {
                    return;
                }

                seen.add(key);

                result.push(model);
            }
        );

        return result;
    }

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

    function isActive(model) {

        const status =
            String(
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

    function getSelectedProvider() {

        const select =
            document.getElementById(
                "providerId"
            );

        if (!select) {
            return {
                id: "",
                name: "",
                text: ""
            };
        }

        const id =
            String(
                select.value || ""
            ).trim();

        const option =
            select.options[
                select.selectedIndex
            ];

        const text =
            String(
                option?.textContent || ""
            ).trim();

        /*
         * Jangan anggap placeholder
         * "Pilih Provider" sebagai provider.
         */
        if (
            !id ||
            text.toLowerCase() ===
                "pilih provider"
        ) {
            return {
                id: "",
                name: "",
                text: ""
            };
        }

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

        /*
         * Cari data provider sebenarnya.
         */
        const providerModule =
            window.GENZModelsProvider;

        if (
            providerModule &&
            typeof providerModule.getProviders ===
                "function"
        ) {

            const provider =
                providerModule
                    .getProviders()
                    .find(
                        function (item) {

                            return [
                                item.id,
                                item.provider_id
                            ]
                                .map(
                                    function (v) {
                                        return String(
                                            v ?? ""
                                        )
                                            .trim()
                                            .toLowerCase();
                                    }
                                )
                                .includes(
                                    id.toLowerCase()
                                );
                        }
                    );

            if (provider) {

                return {
                    id,
                    name:
                        String(
                            provider.provider_name ??
                            provider.name ??
                            name
                        ).trim(),

                    providerId:
                        String(
                            provider.provider_id ??
                            ""
                        ).trim(),

                    text
                };
            }
        }

        return {
            id,
            name,
            text
        };
    }

    function getModelProviderValues(model) {

        return [
            model?.provider_id,
            model?.provider,
            model?.providerId,
            model?.provider_name,
            model?.providerName
        ]
            .map(
                function (value) {

                    return String(
                        value ?? ""
                    )
                        .trim()
                        .toLowerCase();
                }
            )
            .filter(Boolean);
    }

    function providerMatches(model) {

        const selected =
            getSelectedProvider();

        if (!selected.id) {
            return true;
        }

        const values =
            getModelProviderValues(
                model
            );

        if (!values.length) {
            return false;
        }

        const selectedValues = [
            selected.id,
            selected.providerId,
            selected.name,
            selected.text
        ]
            .map(
                function (value) {
                    return String(
                        value || ""
                    )
                        .trim()
                        .toLowerCase();
                }
            )
            .filter(Boolean);

        return values.some(
            function (modelProvider) {

                return selectedValues.some(
                    function (selectedValue) {

                        return (
                            modelProvider ===
                                selectedValue ||
                            modelProvider.includes(
                                selectedValue
                            ) ||
                            selectedValue.includes(
                                modelProvider
                            )
                        );
                    }
                );
            }
        );
    }

    function search(keyword) {

        const raw =
            String(
                keyword ?? ""
            ).trim();

        const term =
            raw.toLowerCase();

        const selected =
            getSelectedProvider();

        let results =
            models.filter(
                function (model) {

                    if (!isActive(model)) {
                        return false;
                    }

                    if (
                        selected.id &&
                        !providerMatches(model)
                    ) {
                        return false;
                    }

                    if (!term) {
                        return true;
                    }

                    const fields = [
                        model.model_id,
                        model.model_name,
                        model.model_family,
                        model.provider_id,
                        model.provider_name,
                        model.provider
                    ]
                        .map(
                            function (value) {
                                return String(
                                    value ?? ""
                                )
                                    .trim()
                                    .toLowerCase();
                            }
                        );

                    return fields.some(
                        function (field) {
                            return field.includes(term);
                        }
                    );
                }
            );

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

                const aStart =
                    term &&
                    aId.startsWith(term)
                        ? 100
                        : 0;

                const bStart =
                    term &&
                    bId.startsWith(term)
                        ? 100
                        : 0;

                if (
                    aStart !==
                    bStart
                ) {
                    return (
                        bStart -
                        aStart
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
         * Model ID manual tetap tersedia.
         */
        if (term) {

            const exact =
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

            if (!exact) {

                results.push({

                    __manual:
                        true,

                    model_id:
                        raw,

                    provider_id:
                        selected.providerId ||
                        selected.id,

                    provider:
                        selected.providerId ||
                        selected.id,

                    provider_name:
                        selected.name,

                    model_name:
                        "",

                    model_family:
                        "",

                    status:
                        "active"
                });
            }
        }

        return results;
    }

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
            ) || null
        );
    }

    function clearSelectedModelInfo() {

        window.GENZModelSearchSelect
            .clearSelected();
    }

    function updateSelectedModelInfo(model) {

        if (!model) {
            clearSelectedModelInfo();
            return;
        }

        window.GENZModelSearchSelect
            .selectModel(model);
    }

    function render(keyword) {

        const results =
            search(keyword);

        if (
            results.length === 0
        ) {

            window.GENZModelSearchDropdown
                .hide();

            return;
        }

        window.GENZModelSearchRender
            .render(results);
    }

    function handleInput(event) {

        const keyword =
            event.target.value;

        /*
         * User mengetik:
         * hidden Model ID harus dibersihkan
         * karena pilihan sebelumnya sudah tidak
         * otomatis valid.
         */
        const hidden =
            getHiddenModelInput();

        if (hidden) {
            hidden.value = "";
        }

        render(keyword);
    }

    function handleFocus(event) {

        render(
            event.target.value
        );
    }

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

        let index =
            items.findIndex(
                function (item) {
                    return item.classList.contains(
                        "active"
                    );
                }
            );

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
                block: "nearest"
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
                block: "nearest"
            });

            return;
        }

        if (
            event.key ===
            "Enter"
        ) {

            const active =
                items.find(
                    function (item) {
                        return item.classList.contains(
                            "active"
                        );
                    }
                );

            if (active) {

                event.preventDefault();

                chooseModel(
                    active.dataset.modelId
                );
            }

            return;
        }

        if (
            event.key ===
            "Escape"
        ) {

            window.GENZModelSearchDropdown
                .hide();
        }
    }

    function chooseModel(modelId) {

        const model =
            findModelById(
                modelId
            );

        if (model) {

            window.GENZModelSearchSelect
                .selectModel(model);

            return;
        }

        const provider =
            getSelectedProvider();

        window.GENZModelSearchSelect
            .selectModel({

                __manual:
                    true,

                model_id:
                    modelId,

                provider_id:
                    provider.providerId ||
                    provider.id,

                provider:
                    provider.providerId ||
                    provider.id,

                provider_name:
                    provider.name,

                status:
                    "active"
            });
    }

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

        chooseModel(modelId);
    }

    function handleProviderChanged() {

        const input =
            getSearchInput();

        clearSelectedModelInfo();

        if (!input) {
            return;
        }

        render(
            input.value
        );
    }

    function handleDocumentClick(event) {

        const input =
            getSearchInput();

        const box =
            getResultsBox();

        if (!input) {
            return;
        }

        if (
            event.target ===
            input
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

        window.GENZModelSearchDropdown
            .hide();
    }

    function initialize() {

        if (initialized) {
            return true;
        }

        if (!getSearchInput()) {

            console.warn(
                "[GEN-Z.AI] Model search input belum tersedia."
            );

            return false;
        }

        const events =
            window.GENZModelSearchEvents;

        if (
            !events ||
            typeof events.bind !==
                "function"
        ) {

            console.error(
                "[GEN-Z.AI] ModelSearchEvents belum tersedia."
            );

            return false;
        }

        const result =
            events.bind({

                onInput:
                    handleInput,

                onFocus:
                    handleFocus,

                onKeydown:
                    handleKeydown,

                onResultsClick:
                    handleResultsClick,

                onProviderChanged:
                    handleProviderChanged,

                onDocumentClick:
                    handleDocumentClick
            });

        if (!result) {
            return false;
        }

        initialized = true;

        console.log(
            "[GEN-Z.AI] GENZModelsSearch initialized."
        );

        return true;
    }

    function destroy() {

        if (
            window.GENZModelSearchEvents
        ) {

            window.GENZModelSearchEvents
                .unbind();
        }

        window.GENZModelSearchDropdown
            .hide();

        models = [];

        initialized = false;
    }

    window.GENZModelsSearch =
        Object.freeze({

            initialize,
            destroy,

            setModels,
            getModels,

            search,
            findModelById,

            selectModel:
                chooseModel,

            hideDropdown:
                window.GENZModelSearchDropdown.hide,

            updateSelectedModelInfo,

            clearSelectedModelInfo
        });

    console.log(
        "[GEN-Z.AI] GENZModelsSearch loaded."
    );

})();
