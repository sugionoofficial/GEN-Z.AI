/* =========================================================
   GEN-Z.AI
   MODELS SEARCH COORDINATOR
   ---------------------------------------------------------
   File:
   admin-control/models/models-search.js

   TANGGUNG JAWAB:
   - Mengelola katalog Model
   - Search Model ID
   - Filter berdasarkan Provider aktif
   - Koordinasi Search Dropdown
   - Koordinasi Search Renderer
   - Koordinasi Model Selection
   - Memastikan katalog tersedia sebelum pencarian

   TIDAK BERTANGGUNG JAWAB ATAS:
   - Query Provider
   - Render Provider
   - CRUD Model
   - Pricing
   - Table
========================================================= */

(function () {

    "use strict";


    /* =====================================================
       STATE
    ===================================================== */

    let models = [];

    let initialized = false;

    let loadingPromise = null;

    let catalogLoaded = false;


    /* =====================================================
       ELEMENT
    ===================================================== */

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


    /* =====================================================
       STRING NORMALIZER
    ===================================================== */

    function normalizeString(value) {

        return String(value ?? "")
            .trim()
            .toLowerCase();
    }


    /* =====================================================
       MODEL NORMALIZER
    ===================================================== */

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
                ""
            ).trim();


        if (!modelId) {
            return null;
        }


        /*
         * Model dapat menggunakan beberapa bentuk
         * identifier Provider.
         *
         * Simpan semuanya.
         */

        const provider =
            String(
                model.provider ??
                ""
            ).trim();


        const providerId =
            String(
                model.provider_id ??
                model.providerId ??
                model.provider ??
                ""
            ).trim();


        const providerUuid =
            String(
                model.provider_uuid ??
                model.providerUuid ??
                ""
            ).trim();


        const providerName =
            String(
                model.provider_name ??
                model.providerName ??
                ""
            ).trim();


        const modelName =
            String(
                model.model_name ??
                model.modelName ??
                model.name ??
                ""
            ).trim();


        const modelFamily =
            String(
                model.model_family ??
                model.modelFamily ??
                model.family ??
                ""
            ).trim();


        return {

            ...model,

            model_id:
                modelId,

            provider:
                provider,

            provider_id:
                providerId,

            provider_uuid:
                providerUuid,

            provider_name:
                providerName,

            model_name:
                modelName,

            model_family:
                modelFamily
        };
    }


    /* =====================================================
       NORMALIZE MODEL LIST
    ===================================================== */

    function normalizeModels(list) {

        if (
            !Array.isArray(list)
        ) {
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
                    normalizeString(
                        model.model_id
                    );


                if (
                    seen.has(key)
                ) {
                    return;
                }


                seen.add(key);

                result.push(model);
            }
        );


        return result;
    }


    /* =====================================================
       SET MODELS
    ===================================================== */

    function setModels(list) {

        models =
            normalizeModels(list);

        catalogLoaded =
            true;


        console.info(
            "[GEN-Z.AI] Model search catalog set:",
            models.length
        );


        return [
            ...models
        ];
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
       ACTIVE MODEL
    ===================================================== */

    function isActive(model) {

        const status =
            normalizeString(
                model?.status
            );


        /*
         * Model tanpa status dianggap aktif
         * untuk kompatibilitas data lama.
         */

        if (!status) {
            return true;
        }


        return (
            status === "active" ||
            status === "enabled" ||
            status === "published"
        );
    }


    /* =====================================================
       PROVIDER MODULE
    ===================================================== */

    function getProviderModule() {

        return (
            window.GENZModelsProvider ||
            null
        );
    }


    /* =====================================================
       GET SELECTED PROVIDER
       -----------------------------------------------------
       PENTING:

       Dropdown menggunakan provider_id sebagai value.

       UUID Provider disimpan pada:

           option.dataset.providerUuid

       Kita harus mempertahankan KEDUANYA agar Model
       yang menggunakan UUID tetap dapat ditemukan.
    ===================================================== */

    function getSelectedProvider() {

        const select =
            document.getElementById(
                "providerId"
            );


        if (!select) {

            return {

                id: "",

                uuid: "",

                providerId: "",

                name: "",

                text: ""
            };
        }


        const selectedValue =
            String(
                select.value || ""
            ).trim();


        const option =
            select.options[
                select.selectedIndex
            ];


        const optionText =
            String(
                option?.textContent || ""
            ).trim();


        /*
         * INI PERBAIKAN UTAMA.
         *
         * Ambil UUID Provider dari option.
         */

        const optionUuid =
            String(
                option?.dataset?.providerUuid || ""
            ).trim();


        if (!selectedValue) {

            return {

                id: "",

                uuid: "",

                providerId: "",

                name: "",

                text: ""
            };
        }


        let providerId =
            selectedValue;

        let providerUuid =
            optionUuid;

        let providerName =
            optionText;


        const providerModule =
            getProviderModule();


        /*
         * Cari Provider melalui owner Provider.
         */

        if (
            providerModule &&
            typeof providerModule.getProviderById ===
                "function"
        ) {

            try {

                const provider =
                    providerModule.getProviderById(
                        selectedValue
                    );


                if (provider) {

                    providerId =
                        String(
                            provider.provider_id ??
                            provider.provider ??
                            selectedValue
                        ).trim();


                    providerUuid =
                        String(
                            provider.id ??
                            providerUuid
                        ).trim();


                    providerName =
                        String(
                            provider.provider_name ??
                            provider.name ??
                            optionText
                        ).trim();
                }

            } catch (error) {

                console.warn(
                    "[GEN-Z.AI] Provider lookup gagal:",
                    error
                );
            }
        }


        /*
         * Fallback ke Provider state.
         */

        if (
            providerModule &&
            typeof providerModule.getProviders ===
                "function"
        ) {

            try {

                const providerList =
                    providerModule.getProviders();


                if (
                    Array.isArray(
                        providerList
                    )
                ) {

                    const selectedNormalized =
                        normalizeString(
                            selectedValue
                        );


                    const uuidNormalized =
                        normalizeString(
                            providerUuid
                        );


                    const found =
                        providerList.find(
                            function (provider) {

                                const values = [

                                    provider?.id,

                                    provider?.provider_id,

                                    provider?.provider,

                                    provider?.provider_name,

                                    provider?.name

                                ]
                                    .map(
                                        normalizeString
                                    )
                                    .filter(Boolean);


                                return (
                                    values.includes(
                                        selectedNormalized
                                    ) ||
                                    (
                                        uuidNormalized &&
                                        values.includes(
                                            uuidNormalized
                                        )
                                    )
                                );
                            }
                        );


                    if (found) {

                        providerId =
                            String(
                                found.provider_id ??
                                found.provider ??
                                selectedValue
                            ).trim();


                        providerUuid =
                            String(
                                found.id ??
                                providerUuid
                            ).trim();


                        providerName =
                            String(
                                found.provider_name ??
                                found.name ??
                                optionText
                            ).trim();
                    }
                }

            } catch (error) {

                console.warn(
                    "[GEN-Z.AI] Provider state lookup gagal:",
                    error
                );
            }
        }


        return {

            id:
                selectedValue,

            uuid:
                providerUuid,

            providerId:
                providerId,

            name:
                providerName,

            text:
                optionText
        };
    }


    /* =====================================================
       GET MODEL PROVIDER VALUES
       -----------------------------------------------------
       Semua kemungkinan identifier Provider disimpan.

       Ini membuat pencarian fleksibel terhadap:

       - UUID
       - provider_id
       - provider
       - provider_name
    ===================================================== */

    function getModelProviderValues(model) {

        const values = [

            model?.provider,

            model?.provider_id,

            model?.providerId,

            model?.provider_uuid,

            model?.providerUuid,

            model?.provider_name,

            model?.providerName

        ]
            .map(
                normalizeString
            )
            .filter(Boolean);


        return [
            ...new Set(values)
        ];
    }


    /* =====================================================
       PROVIDER MATCH
    ===================================================== */

    function providerMatches(
        model,
        selectedProvider = null
    ) {

        const selected =
            selectedProvider ||
            getSelectedProvider();


        /*
         * Tidak ada Provider yang dipilih.
         *
         * Jangan membatasi Model.
         */

        if (
            !selected.providerId &&
            !selected.id &&
            !selected.uuid
        ) {

            return true;
        }


        /*
         * Semua identifier Provider terpilih.
         */

        const selectedValues = [

            selected.providerId,

            selected.id,

            selected.uuid,

            selected.name,

            selected.text

        ]
            .map(
                normalizeString
            )
            .filter(Boolean);


        /*
         * Semua identifier Model.
         */

        const modelValues =
            getModelProviderValues(
                model
            );


        /*
         * Exact match.
         */

        const exact =
            modelValues.some(
                function (modelValue) {

                    return selectedValues.includes(
                        modelValue
                    );
                }
            );


        if (exact) {
            return true;
        }


        /*
         * Fuzzy match hanya untuk identifier
         * non-UUID / data legacy.
         */

        return modelValues.some(
            function (modelValue) {

                return selectedValues.some(
                    function (selectedValue) {

                        if (
                            !modelValue ||
                            !selectedValue
                        ) {
                            return false;
                        }


                        /*
                         * UUID sebaiknya exact match saja.
                         */

                        const looksLikeUuid =
                            /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i
                                .test(
                                    modelValue
                                ) ||
                            /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i
                                .test(
                                    selectedValue
                                );


                        if (
                            looksLikeUuid
                        ) {

                            return (
                                modelValue ===
                                selectedValue
                            );
                        }


                        return (
                            modelValue.includes(
                                selectedValue
                            ) ||
                            selectedValue.includes(
                                modelValue
                            )
                        );
                    }
                );
            }
        );
    }


    /* =====================================================
       LOAD CATALOG
    ===================================================== */

    async function ensureCatalog(
        options = {}
    ) {

        if (
            catalogLoaded &&
            options.force !== true
        ) {

            return [
                ...models
            ];
        }


        if (
            loadingPromise &&
            options.force !== true
        ) {

            return loadingPromise;
        }


        const data =
            window.GENZModelsData;


        if (
            !data ||
            typeof data.loadKieModels !==
                "function"
        ) {

            console.error(
                "[GEN-Z.AI] GENZModelsData.loadKieModels() belum tersedia."
            );


            return [
                ...models
            ];
        }


        loadingPromise =
            (async function () {

                try {

                    const loaded =
                        await data.loadKieModels(
                            {

                                force:
                                    options.force === true,

                                activeOnly:
                                    options.activeOnly !==
                                    false
                            }
                        );


                    setModels(
                        loaded
                    );


                    return [
                        ...models
                    ];

                } catch (error) {

                    console.error(
                        "[GEN-Z.AI] Gagal memuat catalog Model:",
                        error
                    );


                    return [
                        ...models
                    ];

                } finally {

                    loadingPromise =
                        null;
                }

            })();


        return loadingPromise;
    }


    /* =====================================================
       REFRESH CATALOG
    ===================================================== */

    async function refreshCatalog(
        options = {}
    ) {

        return ensureCatalog(
            {

                ...options,

                force: true
            }
        );
    }


    /* =====================================================
       SEARCH
    ===================================================== */

    function search(
        keyword = ""
    ) {

        const term =
            normalizeString(
                keyword
            );


        const selectedProvider =
            getSelectedProvider();


        /*
         * Hanya Model aktif.
         */

        let results =
            models.filter(
                isActive
            );


        /*
         * Filter Provider.

         * Jika Provider belum dipilih,
         * seluruh Model diperbolehkan.
         */

        results =
            results.filter(
                function (model) {

                    return providerMatches(
                        model,
                        selectedProvider
                    );
                }
            );


        /*
         * Tidak ada keyword.
         */

        if (!term) {

            return results.sort(
                function (a, b) {

                    return String(
                        a.model_id || ""
                    ).localeCompare(
                        String(
                            b.model_id || ""
                        ),
                        "id",
                        {
                            sensitivity:
                                "base"
                        }
                    );
                }
            );
        }


        /*
         * Search:

         * Model ID
         * Model Name
         * Model Family
         * Provider
         */

        results =
            results.filter(
                function (model) {

                    const modelId =
                        normalizeString(
                            model.model_id
                        );


                    const modelName =
                        normalizeString(
                            model.model_name
                        );


                    const family =
                        normalizeString(
                            model.model_family
                        );


                    const provider =
                        normalizeString(
                            model.provider_name ||
                            model.provider_id ||
                            model.provider
                        );


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
         * Ranking.
         */

        results.sort(
            function (a, b) {

                const aId =
                    normalizeString(
                        a.model_id
                    );

                const bId =
                    normalizeString(
                        b.model_id
                    );


                const aName =
                    normalizeString(
                        a.model_name
                    );

                const bName =
                    normalizeString(
                        b.model_name
                    );


                const aExact =
                    aId === term
                        ? 100000
                        : 0;

                const bExact =
                    bId === term
                        ? 100000
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
                    aId.startsWith(
                        term
                    )
                        ? 10000
                        : 0;

                const bStart =
                    bId.startsWith(
                        term
                    )
                        ? 10000
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


                const aContains =
                    aId.includes(
                        term
                    )
                        ? 1000
                        : 0;

                const bContains =
                    bId.includes(
                        term
                    )
                        ? 1000
                        : 0;


                if (
                    aContains !==
                    bContains
                ) {

                    return (
                        bContains -
                        aContains
                    );
                }


                const aNameMatch =
                    aName.includes(
                        term
                    )
                        ? 100
                        : 0;

                const bNameMatch =
                    bName.includes(
                        term
                    )
                        ? 100
                        : 0;


                if (
                    aNameMatch !==
                    bNameMatch
                ) {

                    return (
                        bNameMatch -
                        aNameMatch
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


        return results;
    }


    /* =====================================================
       FIND MODEL BY ID
    ===================================================== */

    function findModelById(
        modelId
    ) {

        const id =
            normalizeString(
                modelId
            );


        if (!id) {
            return null;
        }


        return (
            models.find(
                function (model) {

                    return (
                        normalizeString(
                            model.model_id
                        ) ===
                        id
                    );
                }
            ) ||
            null
        );
    }


    /* =====================================================
       RENDER
    ===================================================== */

    function render(
        keyword = ""
    ) {

        const renderer =
            window.GENZModelSearchRender;


        if (
            !renderer ||
            typeof renderer.render !==
                "function"
        ) {

            console.error(
                "[GEN-Z.AI] GENZModelSearchRender belum tersedia."
            );

            return;
        }


        const results =
            search(
                keyword
            );


        renderer.render(
            results
        );
    }


    /* =====================================================
       RENDER AFTER CATALOG
    ===================================================== */

    async function renderAfterCatalog(
        keyword
    ) {

        await ensureCatalog();


        const input =
            getSearchInput();


        if (!input) {
            return;
        }


        const currentKeyword =
            String(
                input.value || ""
            );


        if (
            currentKeyword !==
            String(
                keyword ?? ""
            )
        ) {

            return;
        }


        render(
            currentKeyword
        );
    }


    /* =====================================================
       INPUT EVENT
    ===================================================== */

    function handleInput(
        event
    ) {

        const keyword =
            event?.target?.value ??
            "";


        /*
         * User mengetik ulang.
         * Model sebelumnya dibatalkan.
         */

        const hidden =
            getHiddenModelInput();


        if (hidden) {

            hidden.value =
                "";
        }


        if (
            catalogLoaded
        ) {

            render(
                keyword
            );

            return;
        }


        renderAfterCatalog(
            keyword
        );
    }


    /* =====================================================
       FOCUS EVENT
    ===================================================== */

    function handleFocus(
        event
    ) {

        const keyword =
            event?.target?.value ??
            "";


        if (
            catalogLoaded
        ) {

            render(
                keyword
            );

            return;
        }


        renderAfterCatalog(
            keyword
        );
    }


    /* =====================================================
       KEYBOARD
    ===================================================== */

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
            items.length ===
            0
        ) {

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

            if (
                window.GENZModelSearchDropdown &&
                typeof
                    window.GENZModelSearchDropdown.hide ===
                    "function"
            ) {

                window.GENZModelSearchDropdown
                    .hide();
            }
        }
    }


    /* =====================================================
       CHOOSE MODEL
    ===================================================== */

    function chooseModel(
        modelId
    ) {

        const id =
            String(
                modelId ?? ""
            ).trim();


        if (!id) {
            return false;
        }


        const model =
            findModelById(
                id
            );


        if (!model) {

            console.warn(
                "[GEN-Z.AI] Model ID tidak terdapat di katalog:",
                id
            );

            return false;
        }


        if (
            !providerMatches(
                model
            )
        ) {

            console.warn(
                "[GEN-Z.AI] Model tidak cocok dengan Provider terpilih:",
                id
            );

            return false;
        }


        if (
            !isActive(
                model
            )
        ) {

            console.warn(
                "[GEN-Z.AI] Model tidak aktif:",
                id
            );

            return false;
        }


        const selector =
            window.GENZModelSearchSelect;


        if (
            !selector ||
            typeof selector.selectModel !==
                "function"
        ) {

            console.error(
                "[GEN-Z.AI] GENZModelSearchSelect.selectModel() tidak tersedia."
            );

            return false;
        }


        const selected =
            selector.selectModel(
                model
            );


        return selected !== false;
    }


    /* =====================================================
       RESULT CLICK
    ===================================================== */

    function handleResultsClick(
        event
    ) {

        const target =
            event?.target;


        if (!target) {
            return;
        }


        const item =
            target.closest(
                ".model-search-item"
            );


        if (!item) {
            return;
        }


        const modelId =
            String(
                item.dataset.modelId ?? ""
            ).trim();


        if (!modelId) {
            return;
        }


        chooseModel(
            modelId
        );
    }


    /* =====================================================
       PROVIDER CHANGED
    ===================================================== */

    function handleProviderChanged() {

        clearSelectedModelInfo();


        const input =
            getSearchInput();


        if (!input) {
            return;
        }


        if (
            catalogLoaded
        ) {

            render(
                input.value
            );

            return;
        }


        renderAfterCatalog(
            input.value
        );
    }


    /* =====================================================
       CLEAR SELECTED
    ===================================================== */

    function clearSelectedModelInfo() {

        const selector =
            window.GENZModelSearchSelect;


        if (
            selector &&
            typeof selector.clearSelected ===
                "function"
        ) {

            selector.clearSelected();
        }
    }


    /* =====================================================
       UPDATE SELECTED MODEL INFO
    ===================================================== */

    function updateSelectedModelInfo(
        model
    ) {

        if (!model) {

            clearSelectedModelInfo();

            return;
        }


        const selector =
            window.GENZModelSearchSelect;


        if (
            selector &&
            typeof selector.selectModel ===
                "function"
        ) {

            selector.selectModel(
                model
            );
        }
    }


    /* =====================================================
       DOCUMENT CLICK
    ===================================================== */

    function handleDocumentClick(
        event
    ) {

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


        if (
            window.GENZModelSearchDropdown &&
            typeof
                window.GENZModelSearchDropdown.hide ===
                "function"
        ) {

            window.GENZModelSearchDropdown
                .hide();
        }
    }


    /* =====================================================
       INITIALIZE
    ===================================================== */

    function initialize() {

        if (
            initialized
        ) {

            return true;
        }


        const events =
            window.GENZModelSearchEvents;


        if (
            !events ||
            typeof events.bind !==
                "function"
        ) {

            console.error(
                "[GEN-Z.AI] GENZModelSearchEvents belum tersedia."
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


        initialized =
            true;


        if (
            window.GENZModelSearchDropdown &&
            typeof
                window.GENZModelSearchDropdown
                    .bindPositionEvents ===
                "function"
        ) {

            window.GENZModelSearchDropdown
                .bindPositionEvents();
        }


        /*
         * Load catalog background.
         */

        ensureCatalog()
            .then(
                function (loaded) {

                    console.info(
                        "[GEN-Z.AI] Model search catalog ready:",
                        loaded.length
                    );


                    const currentInput =
                        getSearchInput();


                    if (
                        currentInput &&
                        document.activeElement ===
                            currentInput
                    ) {

                        render(
                            currentInput.value
                        );
                    }
                }
            )
            .catch(
                function (error) {

                    console.error(
                        "[GEN-Z.AI] Model search background load error:",
                        error
                    );
                }
            );


        console.info(
            "[GEN-Z.AI] GENZModelsSearch initialized."
        );


        return true;
    }


    /* =====================================================
       DESTROY
    ===================================================== */

    function destroy() {

        const events =
            window.GENZModelSearchEvents;


        if (
            events &&
            typeof events.unbind ===
                "function"
        ) {

            events.unbind();
        }


        if (
            window.GENZModelSearchDropdown &&
            typeof
                window.GENZModelSearchDropdown.hide ===
                "function"
        ) {

            window.GENZModelSearchDropdown
                .hide();
        }


        models = [];

        catalogLoaded =
            false;

        loadingPromise =
            null;

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

            selectModel:
                chooseModel,

            ensureCatalog,

            refreshCatalog,

            hideDropdown:
                function () {

                    if (
                        window.GENZModelSearchDropdown &&
                        typeof
                            window.GENZModelSearchDropdown.hide ===
                            "function"
                    ) {

                        window.GENZModelSearchDropdown
                            .hide();
                    }
                },

            updateSelectedModelInfo,

            clearSelectedModelInfo
        });


    console.info(
        "[GEN-Z.AI] GENZModelsSearch loaded."
    );

})();
