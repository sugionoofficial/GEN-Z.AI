/* =========================================================
   GEN-Z.AI
   MODELS SEARCH COORDINATOR
   ---------------------------------------------------------
   File:
   admin-control/models/models-search.js

   Tanggung jawab:
   - Menyimpan katalog model
   - Memuat katalog model dari GENZModelsData / Supabase
   - Pencarian Model ID
   - Filter berdasarkan Provider
   - Mengkoordinasikan module search
   - Menjaga katalog tetap tersedia saat user mengetik

   Tidak mengurus:
   - HTML dropdown
   - CSS dropdown
   - Rendering HTML
   - Event binding detail
   - Provider dropdown
   - CRUD model
   - Pricing
   ========================================================= */

(function () {
    "use strict";


    /* =====================================================
       STATE
    ===================================================== */

    let models = [];

    let initialized = false;

    let loadingPromise = null;

    let catalogReady = false;


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
       NORMALIZE MODEL
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
         * Model ID WAJIB ada.
         *
         * Jangan menggunakan database id
         * sebagai fallback.
         *
         * Field yang digunakan oleh form
         * adalah model_id.
         */

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

            provider_id:
                providerId,

            provider:
                providerId ||
                String(
                    model.provider ??
                    ""
                ).trim(),

            provider_name:
                providerName,

            model_name:
                modelName,

            model_family:
                modelFamily
        };
    }


    /* =====================================================
       NORMALIZE MODELS
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


                /*
                 * Model ID dianggap unik
                 * untuk kebutuhan autocomplete.
                 */

                const key =
                    model.model_id
                        .trim()
                        .toLowerCase();


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

        models =
            normalizeModels(
                list
            );


        catalogReady =
            models.length > 0;


        console.info(
            "[GEN-Z.AI] Model search catalog:",
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
       MODEL ACTIVE CHECK
    ===================================================== */

    function isActive(model) {

        const status =
            String(
                model?.status ??
                "active"
            )
                .trim()
                .toLowerCase();


        /*
         * Status kosong dianggap aktif
         * untuk kompatibilitas data lama.
         */

        return (
            status === "" ||
            status === "active" ||
            status === "enabled" ||
            status === "published"
        );
    }


    /* =====================================================
       PROVIDER SELECT
    ===================================================== */

    function getSelectedProvider() {

        const select =
            document.getElementById(
                "providerId"
            );


        if (!select) {

            return {
                id: "",
                name: "",
                text: "",
                providerId: ""
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
                option?.textContent ||
                ""
            ).trim();


        /*
         * Provider belum dipilih.
         */

        if (
            !id ||
            text.toLowerCase() ===
                "pilih provider"
        ) {

            return {
                id: "",
                name: "",
                text: "",
                providerId: ""
            };
        }


        let name =
            text;


        /*
         * Jika dropdown menampilkan:
         *
         * KIE (kie)
         *
         * maka nama provider:
         *
         * KIE
         */

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
         * Cari provider sebenarnya
         * dari module Provider.
         */

        const providerModule =
            window.GENZModelsProvider;


        if (
            providerModule &&
            typeof
                providerModule.getProviders ===
                "function"
        ) {

            const providers =
                providerModule
                    .getProviders();


            const provider =
                Array.isArray(
                    providers
                )
                    ? providers.find(
                        function (item) {

                            const values = [

                                item?.id,

                                item?.provider_id,

                                item?.provider,

                                item?.name,

                                item?.provider_name

                            ]
                                .map(
                                    function (value) {

                                        return String(
                                            value ??
                                            ""
                                        )
                                            .trim()
                                            .toLowerCase();
                                    }
                                )
                                .filter(Boolean);


                            return values.includes(
                                id.toLowerCase()
                            );
                        }
                    )
                    : null;


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
                            provider.provider ??
                            ""
                        ).trim(),

                    text
                };
            }
        }


        return {

            id,

            name,

            text,

            providerId:
                ""
        };
    }


    /* =====================================================
       MODEL PROVIDER VALUES
    ===================================================== */

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


    /* =====================================================
       PROVIDER MATCH
    ===================================================== */

    function providerMatches(model) {

        const selected =
            getSelectedProvider();


        /*
         * Jika provider belum dipilih,
         * semua model boleh ditampilkan.
         */

        if (!selected.id) {
            return true;
        }


        const modelValues =
            getModelProviderValues(
                model
            );


        /*
         * Model tanpa provider
         * tidak boleh ditampilkan
         * ketika provider sudah dipilih.
         */

        if (
            modelValues.length === 0
        ) {
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


        return modelValues.some(
            function (modelProvider) {

                return selectedValues.some(
                    function (selectedValue) {

                        /*
                         * Exact match lebih aman.
                         */

                        if (
                            modelProvider ===
                            selectedValue
                        ) {
                            return true;
                        }


                        /*
                         * Compatibility untuk
                         * format provider lama.
                         */

                        if (
                            modelProvider.includes(
                                selectedValue
                            )
                        ) {
                            return true;
                        }


                        if (
                            selectedValue.includes(
                                modelProvider
                            )
                        ) {
                            return true;
                        }


                        return false;
                    }
                );
            }
        );
    }


    /* =====================================================
       LOAD CATALOG FROM SUPABASE
    ===================================================== */

    async function ensureCatalog(
        options = {}
    ) {

        const force =
            options.force === true;


        /*
         * Jika sudah ada catalog,
         * tidak perlu query ulang.
         */

        if (
            !force &&
            catalogReady &&
            models.length > 0
        ) {

            return [
                ...models
            ];
        }


        /*
         * Jika request sebelumnya masih berjalan,
         * gunakan Promise yang sama.
         *
         * Ini mencegah user mengetik cepat
         * membuat banyak query Supabase.
         */

        if (
            !force &&
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

                    /*
                     * Ambil dari Supabase.
                     *
                     * activeOnly false sengaja digunakan
                     * supaya filtering status dilakukan
                     * konsisten di coordinator.
                     */

                    const result =
                        await data.loadKieModels({
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


                    catalogReady =
                        true;


                    console.info(
                        "[GEN-Z.AI] Model catalog loaded from Supabase:",
                        models.length
                    );


                    /*
                     * Jika module Data juga memiliki
                     * cache model, sinkronkan tetap
                     * melalui API resmi.
                     */

                    return [
                        ...models
                    ];

                } catch (error) {

                    console.error(
                        "[GEN-Z.AI] Gagal memuat katalog model dari Supabase:",
                        error
                    );


                    /*
                     * Jangan merusak halaman Models
                     * hanya karena search gagal.
                     */

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
       REFRESH CATALOG
    ===================================================== */

    async function refreshCatalog() {

        catalogReady =
            false;


        return await ensureCatalog({
            force:
                true
        });
    }


    /* =====================================================
       SEARCH
    ===================================================== */

    function search(keyword) {

        const raw =
            String(
                keyword ?? ""
            ).trim();


        const term =
            raw.toLowerCase();


        const selected =
            getSelectedProvider();


        /*
         * HANYA model dari katalog Supabase.
         *
         * Tidak lagi membuat:
         *
         * __manual: true
         *
         * karena user meminta model_id
         * yang tersedia di Supabase.
         */

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
                     * model wajib cocok dengan provider.
                     */

                    if (
                        selected.id &&
                        !providerMatches(
                            model
                        )
                    ) {

                        return false;
                    }


                    /*
                     * Jika keyword kosong,
                     * tampilkan katalog provider.
                     */

                    if (!term) {
                        return true;
                    }


                    /*
                     * Prioritas utama:
                     * model_id.
                     *
                     * Field lain hanya sebagai
                     * bantuan pencarian.
                     */

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


                    return (
                        modelId.includes(
                            term
                        ) ||
                        modelName.includes(
                            term
                        ) ||
                        family.includes(
                            term
                        )
                    );
                }
            );


        /*
         * Sorting:
         *
         * 1. Exact model_id
         * 2. model_id diawali keyword
         * 3. model_id mengandung keyword
         * 4. model_name
         * 5. alfabetis
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


                const aName =
                    String(
                        a.model_name ??
                        ""
                    )
                        .trim()
                        .toLowerCase();


                const bName =
                    String(
                        b.model_name ??
                        ""
                    )
                        .trim()
                        .toLowerCase();


                /*
                 * Exact.
                 */

                const aExact =
                    term &&
                    aId === term
                        ? 10000
                        : 0;


                const bExact =
                    term &&
                    bId === term
                        ? 10000
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
                 * Starts with.
                 */

                const aStart =
                    term &&
                    aId.startsWith(
                        term
                    )
                        ? 5000
                        : 0;


                const bStart =
                    term &&
                    bId.startsWith(
                        term
                    )
                        ? 5000
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
                 * Model ID contains keyword.
                 */

                const aContains =
                    term &&
                    aId.includes(
                        term
                    )
                        ? 1000
                        : 0;


                const bContains =
                    term &&
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
                    term &&
                    aName.includes(
                        term
                    )
                        ? 100
                        : 0;


                const bNameMatch =
                    term &&
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
       FIND MODEL
    ===================================================== */

    function findModelById(
        modelId
    ) {

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
       CLEAR SELECTED MODEL
    ===================================================== */

    function clearSelectedModelInfo() {

        if (
            window.GENZModelSearchSelect &&
            typeof
                window.GENZModelSearchSelect
                    .clearSelected ===
                "function"
        ) {

            window.GENZModelSearchSelect
                .clearSelected();
        }
    }


    /* =====================================================
       UPDATE SELECTED MODEL
    ===================================================== */

    function updateSelectedModelInfo(
        model
    ) {

        if (!model) {

            clearSelectedModelInfo();

            return;
        }


        if (
            window.GENZModelSearchSelect &&
            typeof
                window.GENZModelSearchSelect
                    .selectModel ===
                "function"
        ) {

            window.GENZModelSearchSelect
                .selectModel(
                    model
                );
        }
    }


    /* =====================================================
       RENDER
    ===================================================== */

    function render(
        keyword
    ) {

        const renderer =
            window.GENZModelSearchRender;


        if (
            !renderer ||
            typeof renderer.render !==
                "function"
        ) {

            console.error(
                "[GEN-Z.AI] ModelSearchRender belum tersedia."
            );

            return;
        }


        const results =
            search(
                keyword
            );


        /*
         * Tidak ada hasil.
         */

        if (
            results.length === 0
        ) {

            if (
                window.GENZModelSearchDropdown &&
                typeof
                    window.GENZModelSearchDropdown.hide ===
                    "function"
            ) {

                window.GENZModelSearchDropdown.hide();
            }


            return;
        }


        renderer.render(
            results
        );
    }


    /* =====================================================
       RENDER AFTER CATALOG LOAD
    ===================================================== */

    async function renderAfterCatalog(
        keyword
    ) {

        await ensureCatalog();


        /*
         * Pastikan input masih ada
         * dan keyword belum berubah.
         */

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
         * Jika user sudah mengetik keyword
         * lain ketika query berlangsung,
         * jangan merender hasil lama.
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
       INPUT
    ===================================================== */

    function handleInput(
        event
    ) {

        const keyword =
            event?.target?.value ??
            "";


        /*
         * Pilihan lama tidak lagi valid
         * jika user mengetik ulang.
         */

        const hidden =
            getHiddenModelInput();


        if (hidden) {
            hidden.value = "";
        }


        /*
         * Render cache yang tersedia
         * terlebih dahulu.
         */

        if (
            catalogReady &&
            models.length > 0
        ) {

            render(
                keyword
            );

            return;
        }


        /*
         * Jika catalog belum tersedia,
         * ambil langsung dari Supabase.
         */

        renderAfterCatalog(
            keyword
        );
    }


    /* =====================================================
       FOCUS
    ===================================================== */

    function handleFocus(
        event
    ) {

        const keyword =
            event?.target?.value ??
            "";


        /*
         * Jika catalog sudah tersedia,
         * langsung tampilkan dropdown.
         */

        if (
            catalogReady &&
            models.length > 0
        ) {

            render(
                keyword
            );

            return;
        }


        /*
         * Jika belum,
         * load dari Supabase.
         */

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
            !items.length
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
                    window.GENZModelSearchDropdown
                        .hide ===
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
            return;
        }


        /*
         * Model HARUS berasal dari catalog.
         *
         * Tidak ada lagi fallback manual.
         */

        const model =
            findModelById(
                id
            );


        if (!model) {

            console.warn(
                "[GEN-Z.AI] Model ID tidak ditemukan di catalog:",
                id
            );


            return;
        }


        /*
         * Pastikan provider masih cocok.
         */

        if (
            !providerMatches(
                model
            )
        ) {

            console.warn(
                "[GEN-Z.AI] Model tidak sesuai dengan provider yang dipilih:",
                id
            );


            return;
        }


        if (
            !isActive(model)
        ) {

            console.warn(
                "[GEN-Z.AI] Model tidak aktif:",
                id
            );


            return;
        }


        if (
            window.GENZModelSearchSelect &&
            typeof
                window.GENZModelSearchSelect
                    .selectModel ===
                "function"
        ) {

            window.GENZModelSearchSelect
                .selectModel(
                    model
                );
        }
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

        const input =
            getSearchInput();


        /*
         * Model lama harus dibersihkan
         * karena provider sudah berubah.
         */

        clearSelectedModelInfo();


        if (!input) {
            return;
        }


        /*
         * Jika catalog sudah ada,
         * langsung filter provider baru.
         */

        if (
            catalogReady &&
            models.length > 0
        ) {

            render(
                input.value
            );

            return;
        }


        /*
         * Jika belum ada catalog,
         * load dari Supabase.
         */

        renderAfterCatalog(
            input.value
        );
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
                window.GENZModelSearchDropdown
                    .hide ===
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

        if (initialized) {
            return true;
        }


        const input =
            getSearchInput();


        if (!input) {

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


        initialized =
            true;


        /*
         * Jangan membuat initialization
         * gagal hanya karena catalog belum
         * selesai diambil.
         *
         * Load berjalan di background.
         */

        ensureCatalog()
            .then(
                function (loaded) {

                    console.info(
                        "[GEN-Z.AI] Model search catalog ready:",
                        loaded.length
                    );


                    /*
                     * Jika input sedang aktif,
                     * tampilkan hasil setelah data masuk.
                     */

                    const active =
                        document.activeElement ===
                        getSearchInput();


                    if (active) {

                        const currentInput =
                            getSearchInput();


                        if (currentInput) {

                            render(
                                currentInput.value
                            );
                        }
                    }
                }
            )
            .catch(
                function (error) {

                    console.error(
                        "[GEN-Z.AI] Background model catalog load error:",
                        error
                    );
                }
            );


        console.log(
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
                window.GENZModelSearchDropdown
                    .hide ===
                "function"
        ) {

            window.GENZModelSearchDropdown
                .hide();
        }


        models = [];

        catalogReady =
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
                            window.GENZModelSearchDropdown
                                .hide ===
                            "function"
                    ) {

                        window.GENZModelSearchDropdown
                            .hide();
                    }
                },

            updateSelectedModelInfo,

            clearSelectedModelInfo
        });


    console.log(
        "[GEN-Z.AI] GENZModelsSearch loaded."
    );

})();
