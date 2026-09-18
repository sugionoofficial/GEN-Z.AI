/* =========================================================
   GEN-Z.AI
   MODELS SEARCH COORDINATOR
   ---------------------------------------------------------
   File:
   admin-control/models/models-search.js

   Tugas:
   - Load katalog model dari Supabase melalui GENZModelsData
   - Search Model ID
   - Filter Provider
   - Koordinasi Search Dropdown / Render / Select / Events
   - Menjamin katalog tersedia sebelum pencarian
   - Menjamin hasil pencarian muncul saat user mengetik

   Catatan database:
   - kie_models.provider    = provider_id
   - kie_models.model_id    = Model ID
   - kie_models.model_name  = Nama model
   - kie_models.model_family = Family model
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

        return String(
            value ?? ""
        )
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


        /*
         * Model ID adalah field utama.
         */

        if (!modelId) {
            return null;
        }


        /*
         * kie_models menggunakan:
         *
         * provider
         *
         * bukan provider_id.
         *
         * models-data.js sudah menormalisasi
         * provider -> provider_id.
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
                    seen.has(key)
                ) {
                    return;
                }


                seen.add(key);

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

    function setModels(list) {

        const normalized =
            normalizeModels(
                list
            );


        models =
            normalized;


        /*
         * Catalog dianggap tersedia walaupun
         * hasil query kosong.
         *
         * Ini penting supaya tidak terjadi
         * loop loading terus menerus.
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

    function isActive(model) {

        const status =
            normalizeString(
                model?.status
            );


        /*
         * Jika status kosong, tetap dianggap
         * aktif untuk kompatibilitas data.
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
         * Belum memilih provider.
         */

        if (!selectedValue) {

            return {

                id: "",

                providerId: "",

                name: "",

                text: ""
            };
        }


        /*
         * models-provider-dropdown.js
         * menggunakan provider_id sebagai
         * value option.
         *
         * Jadi dalam kondisi normal:
         *
         * select.value = provider_id
         */

        let providerId =
            selectedValue;


        let providerName =
            text;


        /*
         * Ambil data provider sebenarnya jika
         * module tersedia.
         */

        const dropdown =
            window.GENZModelProviderDropdown;


        if (
            dropdown &&
            typeof dropdown.getSelected ===
                "function"
        ) {

            try {

                const selected =
                    dropdown.getSelected();


                if (selected) {

                    providerId =
                        String(
                            selected.provider_id ??
                            selected.provider ??
                            selected.id ??
                            selectedValue
                        ).trim();


                    providerName =
                        String(
                            selected.provider_name ??
                            selected.name ??
                            providerName
                        ).trim();
                }

            } catch (error) {

                console.warn(
                    "[GEN-Z.AI] Gagal membaca provider terpilih:",
                    error
                );
            }
        }


        /*
         * Fallback ke GENZModelsProvider.
         */

        if (
            providerId ===
            selectedValue
        ) {

            const providerModule =
                window.GENZModelsProvider;


            if (
                providerModule &&
                typeof providerModule.getProviders ===
                    "function"
            ) {

                try {

                    const providers =
                        providerModule
                            .getProviders();


                    if (
                        Array.isArray(
                            providers
                        )
                    ) {

                        const found =
                            providers.find(
                                function (provider) {

                                    return (

                                        normalizeString(
                                            provider?.provider_id
                                        ) ===
                                        normalizeString(
                                            selectedValue
                                        )

                                        ||

                                        normalizeString(
                                            provider?.id
                                        ) ===
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
                                    providerName
                                ).trim();
                        }
                    }

                } catch (error) {

                    console.warn(
                        "[GEN-Z.AI] Provider lookup gagal:",
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
                text
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
            .filter(Boolean);


        return [
            ...new Set(
                values
            )
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
         * Tidak ada provider:
         * jangan melakukan filtering.
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
            .filter(Boolean);


        const modelValues =
            getModelProviderValues(
                model
            );


        /*
         * Jika model tidak memiliki provider,
         * jangan tampilkan ketika provider sudah
         * dipilih.
         */

        if (
            modelValues.length === 0
        ) {

            return false;
        }


        /*
         * Exact match.
         */

        for (
            const modelValue
            of modelValues
        ) {

            for (
                const selectedValue
                of selectedValues
            ) {

                if (
                    modelValue ===
                    selectedValue
                ) {

                    return true;
                }
            }
        }


        /*
         * Compatibility:
         *
         * provider bisa memiliki format
         * berbeda seperti:
         *
         * bytedance
         * ByteDance
         * bytedance-api
         *
         * Tetapi kita tidak melakukan
         * fuzzy match yang terlalu longgar.
         */

        for (
            const modelValue
            of modelValues
        ) {

            for (
                const selectedValue
                of selectedValues
            ) {

                if (
                    modelValue.includes(
                        selectedValue
                    ) ||
                    selectedValue.includes(
                        modelValue
                    )
                ) {

                    return true;
                }
            }
        }


        return false;
    }


    /* =====================================================
       LOAD CATALOG
    ===================================================== */

    async function ensureCatalog(
        options = {}
    ) {

        const force =
            options.force === true;


        /*
         * Sudah ada katalog.
         */

        if (
            !force &&
            catalogLoaded
        ) {

            return [
                ...models
            ];
        }


        /*
         * Hindari request ganda.
         */

        if (
            loadingPromise
        ) {

            return await loadingPromise;
        }


        const data =
            window.GENZModelsData;


        if (!data) {

            console.error(
                "[GEN-Z.AI] GENZModelsData belum tersedia."
            );


            return [
                ...models
            ];
        }


        /*
         * API utama.
         */

        if (
            typeof data.loadKieModels !==
            "function"
        ) {

            console.error(
                "[GEN-Z.AI] GENZModelsData.loadKieModels() tidak tersedia."
            );


            return [
                ...models
            ];
        }


        loadingPromise =
            (async function () {

                try {

                    console.info(
                        "[GEN-Z.AI] Loading model catalog from Supabase..."
                    );


                    /*
                     * loadKieModels() sudah melakukan:
                     *
                     * public.kie_models
                     *
                     * dan normalisasi provider.
                     */

                    const result =
                        await data.loadKieModels({

                            force:
                                force,

                            activeOnly:
                                false
                        });


                    const normalized =
                        normalizeModels(
                            result
                        );


                    models =
                        normalized;


                    catalogLoaded =
                        true;


                    console.info(
                        "[GEN-Z.AI] Supabase model catalog loaded:",
                        models.length
                    );


                    return [
                        ...models
                    ];

                } catch (error) {

                    console.error(
                        "[GEN-Z.AI] Supabase model catalog gagal dimuat:",
                        error
                    );


                    /*
                     * Jangan menghapus katalog lama
                     * jika refresh gagal.
                     */

                    if (
                        models.length > 0
                    ) {

                        catalogLoaded =
                            true;
                    }


                    return [
                        ...models
                    ];

                } finally {

                    loadingPromise =
                        null;
                }

            })();


        return await loadingPromise;
    }


    /* =====================================================
       REFRESH
    ===================================================== */

    async function refreshCatalog() {

        catalogLoaded =
            false;


        return await ensureCatalog({

            force:
                true
        });
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
         * Filter provider dahulu.
         */

        let results =
            models.filter(
                function (model) {

                    if (
                        !isActive(
                            model
                        )
                    ) {

                        return false;
                    }


                    if (
                        !providerMatches(
                            model,
                            selectedProvider
                        )
                    ) {

                        return false;
                    }


                    return true;
                }
            );


        /*
         * Jika keyword kosong:
         * tampilkan model provider terpilih.
         */

        if (!term) {

            return results;
        }


        /*
         * Model ID adalah pencarian utama.
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


                    const modelFamily =
                        normalizeString(
                            model.model_family
                        );


                    /*
                     * Prioritas pencarian:
                     * model_id
                     * model_name
                     * model_family
                     */

                    return (

                        modelId.includes(
                            term
                        )

                        ||

                        modelName.includes(
                            term
                        )

                        ||

                        modelFamily.includes(
                            term
                        )
                    );
                }
            );


        /*
         * Sorting.
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


                /*
                 * Exact Model ID.
                 */

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


                /*
                 * Model ID dimulai keyword.
                 */

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


                /*
                 * Model ID mengandung keyword.
                 */

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


                /*
                 * Model name.
                 */

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


        /*
         * PENTING:
         *
         * Renderer sudah memiliki fungsi
         * untuk menampilkan:
         *
         * "Model tidak ditemukan."
         *
         * Jadi jangan hide di sini.
         *
         * Sebelumnya coordinator melakukan
         * hide ketika results = 0, sehingga
         * user tidak mendapatkan feedback
         * dropdown sama sekali.
         */

        renderer.render(
            results
        );
    }


    /* =====================================================
       RENDER AFTER LOAD
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


        /*
         * Jangan render keyword lama.
         */

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
         * User mulai mengetik lagi.
         * Pilihan sebelumnya tidak lagi dianggap
         * sebagai selected model.
         */

        const hidden =
            getHiddenModelInput();


        if (hidden) {

            hidden.value =
                "";
        }


        /*
         * Jika catalog sudah ada,
         * tampilkan langsung.
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
         * Jika catalog belum ada,
         * load Supabase dahulu.
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
            items.length === 0
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


        /* -------------------------------------------------
           ENTER
        ------------------------------------------------- */

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
                modelId ?? ""
            ).trim();


        if (!id) {
            return false;
        }


        const model =
            findModelById(
                id
            );


        /*
         * Model harus berasal dari Supabase.
         */

        if (!model) {

            console.warn(
                "[GEN-Z.AI] Model ID tidak terdapat di katalog Supabase:",
                id
            );


            return false;
        }


        /*
         * Pastikan provider cocok.
         */

        if (
            !providerMatches(
                model
            )
        ) {

            console.warn(
                "[GEN-Z.AI] Model tidak cocok dengan provider terpilih:",
                id
            );


            return false;
        }


        /*
         * Pastikan model aktif.
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
         * Model sebelumnya harus dibersihkan.
         */

        clearSelectedModelInfo();


        const input =
            getSearchInput();


        if (!input) {
            return;
        }


        /*
         * Catalog sudah tersedia.
         */

        if (
            catalogLoaded
        ) {

            render(
                input.value
            );


            return;
        }


        /*
         * Catalog belum tersedia.
         */

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
       UPDATE SELECTED
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
         * Klik input sendiri.
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
         * Klik di luar.
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


        const input =
            getSearchInput();


        if (!input) {

            console.warn(
                "[GEN-Z.AI] Model ID search input belum tersedia."
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
         * Load catalog di background.
         *
         * Ini penting agar saat user langsung
         * mengetik, data sudah tersedia.
         */

        ensureCatalog()
            .then(
                function (loaded) {

                    console.info(
                        "[GEN-Z.AI] Model search ready. Catalog:",
                        loaded.length
                    );


                    /*
                     * Jika input sedang aktif,
                     * tampilkan hasil setelah data
                     * selesai dimuat.
                     */

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

        if (
            window.GENZModelSearchEvents
        ) {

            window.GENZModelSearchEvents
                .unbind();
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
