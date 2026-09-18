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

   ARSITEKTUR:
   ---------------------------------------------------------
   models-data.js
        ↓
   models-search.js
        ↓
   ├── model-search-render.js
   ├── model-search-select.js
   ├── model-search-dropdown.js
   └── model-search-events.js

   Provider:
   models-provider.js
        ↓
   models-search.js
        ↓
   filter Model berdasarkan Provider

   DATABASE:
   - kie_models.provider
   - kie_models.model_id
   - kie_models.model_name
   - kie_models.model_family
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
            document.getElementById(
                "modelCodeSearch"
            ) ||
            document.getElementById(
                "modelSearch"
            ) ||
            document.getElementById(
                "modelIdSearch"
            )
        );
    }


    function getHiddenModelInput() {

        return (
            document.getElementById(
                "modelCode"
            ) ||
            document.getElementById(
                "modelId"
            )
        );
    }


    function getResultsBox() {

        return (
            document.getElementById(
                "modelSearchResults"
            ) ||
            document.getElementById(
                "modelResults"
            ) ||
            document.getElementById(
                "modelDropdown"
            )
        );
    }


    /* =====================================================
       STRING NORMALIZER
    ===================================================== */

    function normalizeString(
        value
    ) {

        return String(
            value ?? ""
        )
            .trim()
            .toLowerCase();
    }


    /* =====================================================
       MODEL NORMALIZER
    ===================================================== */

    function normalizeModel(
        model
    ) {

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
         * Database kie_models biasanya menggunakan:
         *
         * provider
         *
         * Sedangkan API Model Management dapat
         * mengembalikan:
         *
         * provider_id
         *
         * Jangan menghapus salah satunya.
         */

        const provider =
            String(
                model.provider ??
                model.provider_id ??
                model.providerId ??
                ""
            ).trim();


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

    function normalizeModels(
        list
    ) {

        if (
            !Array.isArray(
                list
            )
        ) {
            return [];
        }


        const result = [];

        const seen = new Set();


        list.forEach(
            function (item) {

                const model =
                    normalizeModel(
                        item
                    );


                if (!model) {
                    return;
                }


                const key =
                    normalizeString(
                        model.model_id
                    );


                if (
                    seen.has(
                        key
                    )
                ) {
                    return;
                }


                seen.add(
                    key
                );


                result.push(
                    model
                );
            }
        );


        return result;
    }


    /* =====================================================
       SET MODELS
    ===================================================== */

    function setModels(
        list
    ) {

        const normalized =
            normalizeModels(
                list
            );


        models =
            normalized;


        /*
         * Catalog dianggap sudah tersedia.
         *
         * Bahkan jika hasilnya kosong.
         *
         * Ini mencegah loop load tanpa akhir.
         */

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

    function isActive(
        model
    ) {

        const status =
            normalizeString(
                model?.status
            );


        /*
         * Data lama yang tidak memiliki status
         * tetap dianggap aktif.
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
       PROVIDER OWNER
       -----------------------------------------------------
       models-search.js TIDAK memiliki state Provider.

       Semua informasi Provider dibaca dari:
       GENZModelsProvider
    ===================================================== */

    function getProviderModule() {

        return (
            window.GENZModelsProvider ||
            null
        );
    }


    /* =====================================================
       GET SELECTED PROVIDER
    ===================================================== */

    function getSelectedProvider() {

        const select =
            document.getElementById(
                "providerId"
            );


        if (!select) {

            return {

                id: "",

                providerId: "",

                name: "",

                text: ""
            };
        }


        const selectedValue =
            String(
                select.value ||
                ""
            ).trim();


        const option =
            select.options[
                select.selectedIndex
            ];


        const optionText =
            String(
                option?.textContent ||
                ""
            ).trim();


        if (!selectedValue) {

            return {

                id: "",

                providerId: "",

                name: "",

                text: ""
            };
        }


        /*
         * Provider dropdown menggunakan
         * provider_id sebagai value.
         */

        let providerId =
            selectedValue;


        let providerName =
            optionText;


        const providerModule =
            getProviderModule();


        /*
         * Provider owner menyediakan lookup
         * berdasarkan UUID / provider_id / provider.
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
                            provider.id ??
                            selectedValue
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
         * Fallback langsung ke Provider state.
         *
         * Ini hanya fallback kompatibilitas.
         * Bukan query baru.
         */

        if (
            providerId ===
            selectedValue
        ) {

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
                    {

                        const found =
                            providerList.find(
                                function (
                                    provider
                                ) {

                                    const values = [

                                        provider?.id,

                                        provider?.provider_id,

                                        provider?.provider

                                    ]
                                        .map(
                                            normalizeString
                                        )
                                        .filter(
                                            Boolean
                                        );


                                    return values.includes(
                                        normalizeString(
                                            selectedValue
                                        )
                                    );
                                }
                            );


                        if (found) {

                            providerId =
                                String(
                                    found.provider_id ??
                                    found.provider ??
                                    found.id ??
                                    selectedValue
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
        }


        return {

            id:
                selectedValue,

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
    ===================================================== */

    function getModelProviderValues(
        model
    ) {

        const values = [

            model?.provider,

            model?.provider_id,

            model?.providerId,

            model?.provider_name,

            model?.providerName

        ]
            .map(
                normalizeString
            )
            .filter(
                Boolean
            );


        return [
            ...new Set(
                values
            )
        ];
    }


    /* =====================================================
       PROVIDER MATCH
       -----------------------------------------------------
       Model Search tidak mengubah Provider.
       Hanya memeriksa apakah Model cocok dengan
       Provider yang sedang dipilih.
    ===================================================== */

    function providerMatches(
        model,
        selectedProvider = null
    ) {

        const selected =
            selectedProvider ||
            getSelectedProvider();


        /*
         * Belum ada Provider:
         * semua Model boleh ditampilkan.
         */

        if (
            !selected.providerId &&
            !selected.id
        ) {

            return true;
        }


        const selectedValues = [

            selected.providerId,

            selected.id,

            selected.name,

            selected.text

        ]
            .map(
                normalizeString
            )
            .filter(
                Boolean
            );


        const modelValues =
            getModelProviderValues(
                model
            );


        /*
         * Exact match.
         */

        const exact =
            modelValues.some(
                function (
                    modelValue
                ) {

                    return selectedValues.includes(
                        modelValue
                    );
                }
            );


        if (exact) {
            return true;
        }


        /*
         * Fuzzy match untuk kompatibilitas
         * data lama.
         */

        return modelValues.some(
            function (
                modelValue
            ) {

                return selectedValues.some(
                    function (
                        selectedValue
                    ) {

                        if (
                            !modelValue ||
                            !selectedValue
                        ) {
                            return false;
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
       -----------------------------------------------------
       Sumber tunggal:
       GENZModelsData
    ===================================================== */

    async function ensureCatalog(
        options = {}
    ) {

        /*
         * Jika sudah tersedia dan tidak force,
         * gunakan catalog lokal.
         */

        if (
            catalogLoaded &&
            options.force !== true
        ) {

            return [
                ...models
            ];
        }


        /*
         * Jika request sedang berjalan,
         * gunakan Promise yang sama.
         */

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


                    /*
                     * Jangan menghapus catalog lama
                     * jika refresh gagal.
                     */

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
         */

        results =
            results.filter(
                function (
                    model
                ) {

                    return providerMatches(
                        model,
                        selectedProvider
                    );
                }
            );


        /*
         * Jika tidak ada keyword,
         * tampilkan seluruh Model yang cocok
         * dengan Provider.
         */

        if (!term) {

            return results
                .sort(
                    function (
                        a,
                        b
                    ) {

                        return String(
                            a.model_id ||
                            ""
                        ).localeCompare(
                            String(
                                b.model_id ||
                                ""
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
         * Search berdasarkan:
         *
         * Model ID
         * Model Name
         * Model Family
         * Provider
         */

        results =
            results.filter(
                function (
                    model
                ) {

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
         * Ranking hasil.
         *
         * Prioritas:
         *
         * 1. Exact Model ID
         * 2. Model ID dimulai keyword
         * 3. Model ID mengandung keyword
         * 4. Model Name cocok
         * 5. Alphabetical
         */

        results.sort(
            function (
                a,
                b
            ) {

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
                function (
                    model
                ) {

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


        /*
         * Renderer bertanggung jawab penuh
         * menampilkan hasil.
         */

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
                input.value ||
                ""
            );


        /*
         * Hindari render keyword lama jika
         * user sudah mengetik sesuatu yang baru.
         */

        if (
            currentKeyword !==
            String(
                keyword ??
                ""
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
         * Ketika user mengetik ulang,
         * pilihan Model sebelumnya dibatalkan.
         */

        const hidden =
            getHiddenModelInput();


        if (hidden) {

            hidden.value =
                "";
        }


        /*
         * Catalog sudah tersedia.
         */

        if (
            catalogLoaded
        ) {

            render(
                keyword
            );


            return;
        }


        /*
         * Catalog belum tersedia.
         */

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
                function (
                    item
                ) {

                    return item.classList.contains(
                        "active"
                    );
                }
            );


        /* -------------------------------------------------
           ARROW DOWN
        ------------------------------------------------- */

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
                function (
                    item
                ) {

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


        /* -------------------------------------------------
           ARROW UP
        ------------------------------------------------- */

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
                function (
                    item
                ) {

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
                );


            return;
        }


        /* -------------------------------------------------
           ENTER
        ------------------------------------------------- */

        if (
            event.key ===
            "Enter"
        ) {

            const active =
                items.find(
                    function (
                        item
                    ) {

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


        /* -------------------------------------------------
           ESCAPE
        ------------------------------------------------- */

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
                modelId ??
                ""
            ).trim();


        if (!id) {
            return false;
        }


        const model =
            findModelById(
                id
            );


        /*
         * Model harus berasal dari katalog.
         */

        if (!model) {

            console.warn(
                "[GEN-Z.AI] Model ID tidak terdapat di katalog:",
                id
            );


            return false;
        }


        /*
         * Pastikan Provider cocok.
         */

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


        /*
         * Pastikan aktif.
         */

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
                item.dataset.modelId ??
                ""
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

        /*
         * Provider berubah.
         *
         * Model terpilih harus dibersihkan.
         */

        clearSelectedModelInfo();


        const input =
            getSearchInput();


        if (!input) {
            return;
        }


        /*
         * Jika catalog sudah ada,
         * langsung render ulang berdasarkan
         * Provider baru.
         */

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


        /*
         * Klik input.
         */

        if (
            event.target ===
            input
        ) {

            return;
        }


        /*
         * Klik dropdown.
         */

        if (
            box &&
            box.contains(
                event.target
            )
        ) {

            return;
        }


        /*
         * Klik luar.
         */

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


        /*
         * Bind positioning event hanya sekali.
         */

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
         * Load catalog di background.
         *
         * Tujuannya agar saat user mengetik,
         * catalog sudah tersedia.
         */

        ensureCatalog()
            .then(
                function (
                    loaded
                ) {

                    console.info(
                        "[GEN-Z.AI] Model search catalog ready:",
                        loaded.length
                    );


                    const currentInput =
                        getSearchInput();


                    /*
                     * Jika input sedang aktif,
                     * tampilkan hasil setelah catalog
                     * selesai dimuat.
                     */

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
                function (
                    error
                ) {

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
