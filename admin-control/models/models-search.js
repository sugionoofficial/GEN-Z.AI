/* =========================================================
   GEN-Z.AI
   MODELS SEARCH COORDINATOR
   ---------------------------------------------------------
   File:
   admin-control/models/models-search.js

   TANGGUNG JAWAB:
   - Menyimpan katalog Model untuk Search
   - Normalisasi data Model
   - Filter Provider
   - Query Search
   - Koordinasi Search Renderer
   - Koordinasi Model Selection
   - Koordinasi Search Events

   DELEGASI:
   - Dropdown  -> GENZModelSearchDropdown
   - Renderer  -> GENZModelSearchRender
   - Selection -> GENZModelSearchSelect
   - Events    -> GENZModelSearchEvents

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
       ELEMENT HELPERS
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
       NORMALIZER
    ===================================================== */

    function normalizeString(value) {

        return String(
            value ?? ""
        )
            .trim()
            .toLowerCase();
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
                ""
            ).trim();


        if (!modelId) {
            return null;
        }


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


                if (!key) {
                    return;
                }


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
       SET / GET CATALOG
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


        /*
         * Jika input sedang aktif ketika katalog
         * diperbarui, render ulang hasilnya.
         *
         * Ini penting setelah data Model selesai
         * dimuat secara asynchronous.
         */
        const input =
            getSearchInput();


        if (
            input &&
            document.activeElement === input &&
            initialized
        ) {

            render(
                input.value
            );
        }


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
       MODEL STATUS
    ===================================================== */

    function isActive(model) {

        const status =
            normalizeString(
                model?.status
            );


        /*
         * Data lama yang tidak mempunyai status
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
       PROVIDER MODULE
    ===================================================== */

    function getProviderModule() {

        return (
            window.GENZModelsProvider ||
            null
        );
    }


    /* =====================================================
       SELECTED PROVIDER
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


        if (!selectedValue) {

            return {

                id: "",

                uuid: "",

                providerId: "",

                name: "",

                text: ""
            };
        }


        const option =
            select.options[
                select.selectedIndex
            ];


        const optionText =
            String(
                option?.textContent || ""
            ).trim();


        let providerId =
            selectedValue;


        let providerUuid =
            String(
                option?.dataset?.providerUuid ||
                ""
            ).trim();


        let providerName =
            optionText;


        const providerModule =
            getProviderModule();


        /*
         * Cari melalui Provider owner.
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

                    const selectedValues = [

                        selectedValue,

                        providerUuid,

                        providerId,

                        providerName,

                        optionText

                    ]
                        .map(
                            normalizeString
                        )
                        .filter(Boolean);


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


                                return values.some(
                                    function (value) {

                                        return selectedValues.includes(
                                            value
                                        );
                                    }
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
       MODEL PROVIDER VALUES
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
       UUID CHECK
    ===================================================== */

    function looksLikeUuid(value) {

        return /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(
            String(value || "")
        );
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
         * Semua Model diperbolehkan.
         */
        if (
            !selected.providerId &&
            !selected.id &&
            !selected.uuid
        ) {

            return true;
        }


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


        const modelValues =
            getModelProviderValues(
                model
            );


        /*
         * Exact match selalu diprioritaskan.
         */
        if (
            modelValues.some(
                function (value) {

                    return selectedValues.includes(
                        value
                    );
                }
            )
        ) {

            return true;
        }


        /*
         * Fuzzy match hanya untuk identifier
         * non-UUID.
         *
         * UUID wajib exact match.
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


                        if (
                            looksLikeUuid(modelValue) ||
                            looksLikeUuid(selectedValue)
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
       ENSURE CATALOG
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
                        "[GEN-Z.AI] Gagal memuat katalog Model:",
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
         * Filter hanya Model aktif.
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
                function (model) {

                    return providerMatches(
                        model,
                        selectedProvider
                    );
                }
            );


        /*
         * Tanpa keyword:
         * tampilkan seluruh Model yang cocok
         * dengan Provider.
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
         * Search pada:
         *
         * - Model ID
         * - Model Name
         * - Model Family
         * - Provider
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
                        modelId.includes(term) ||
                        modelName.includes(term) ||
                        family.includes(term) ||
                        provider.includes(term)
                    );
                }
            );


        /*
         * Ranking:
         *
         * 1. Exact Model ID
         * 2. Awalan Model ID
         * 3. Model ID contains
         * 4. Model Name contains
         * 5. Alphabetical
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
                    aId.startsWith(term)
                        ? 10000
                        : 0;

                const bStart =
                    bId.startsWith(term)
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
                    aId.includes(term)
                        ? 1000
                        : 0;

                const bContains =
                    bId.includes(term)
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
                    aName.includes(term)
                        ? 100
                        : 0;

                const bNameMatch =
                    bName.includes(term)
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
                        ) === id
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

            return false;
        }


        const results =
            search(
                keyword
            );


        try {

            renderer.render(
                results
            );

            return true;

        } catch (error) {

            console.error(
                "[GEN-Z.AI] Render Model Search gagal:",
                error
            );

            return false;
        }
    }


    /* =====================================================
       RENDER AFTER CATALOG
    ===================================================== */

    async function renderAfterCatalog(
        keyword = ""
    ) {

        await ensureCatalog();


        const input =
            getSearchInput();


        if (!input) {
            return false;
        }


        const currentKeyword =
            String(
                input.value || ""
            );


        /*
         * Jangan render hasil lama jika user sudah
         * mengetik keyword baru ketika request catalog
         * masih berjalan.
         */
        if (
            currentKeyword !==
            String(
                keyword ?? ""
            )
        ) {

            return false;
        }


        return render(
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
         * User mulai mengetik ulang.
         * Model selection lama harus dibatalkan.
         */
        const hidden =
            getHiddenModelInput();


        if (hidden) {

            hidden.value =
                "";
        }


        /*
         * Jika katalog sudah tersedia, render
         * secara langsung.
         */
        if (
            catalogLoaded
        ) {

            return render(
                keyword
            );
        }


        /*
         * Jika belum tersedia, tunggu katalog.
         */
        renderAfterCatalog(
            keyword
        );


        return true;
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
         * Focus kosong juga harus menampilkan
         * dropdown katalog.
         */
        if (
            catalogLoaded
        ) {

            return render(
                keyword
            );
        }


        renderAfterCatalog(
            keyword
        );


        return true;
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


            if (items[index]) {

                items[index].classList.add(
                    "active"
                );


                items[index].scrollIntoView({
                    block:
                        "nearest"
                });
            }


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


            if (items[index]) {

                items[index].classList.add(
                    "active"
                );


                items[index].scrollIntoView({
                    block:
                        "nearest"
                });
            }


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

            hideDropdown();
        }
    }


    /* =====================================================
       SELECT MODEL
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


        try {

            const selected =
                selector.selectModel(
                    model
                );


            return selected !== false;

        } catch (error) {

            console.error(
                "[GEN-Z.AI] Pemilihan Model gagal:",
                error
            );

            return false;
        }
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
         * Provider berubah berarti Model yang dipilih
         * sebelumnya tidak boleh dipertahankan.
         */
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
       SELECTED MODEL INFO
    ===================================================== */

    function clearSelectedModelInfo() {

        const selector =
            window.GENZModelSearchSelect;


        if (
            selector &&
            typeof selector.clearSelected ===
                "function"
        ) {

            try {

                selector.clearSelected();

            } catch (error) {

                console.warn(
                    "[GEN-Z.AI] Clear Model selection gagal:",
                    error
                );
            }
        }
    }


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

            try {

                selector.selectModel(
                    model
                );

            } catch (error) {

                console.warn(
                    "[GEN-Z.AI] Update Model selection gagal:",
                    error
                );
            }
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
         * Klik pada input tidak boleh menutup dropdown.
         */
        if (
            event.target === input
        ) {

            return;
        }


        /*
         * Klik di dalam dropdown juga tidak boleh
         * menutup sebelum selection selesai.
         */
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
       DROPDOWN HELPERS
    ===================================================== */

    function showDropdown() {

        const dropdown =
            window.GENZModelSearchDropdown;


        if (
            dropdown &&
            typeof dropdown.show ===
                "function"
        ) {

            try {

                dropdown.show();

                return true;

            } catch (error) {

                console.warn(
                    "[GEN-Z.AI] Show Model Search Dropdown gagal:",
                    error
                );
            }
        }


        return false;
    }


    function hideDropdown() {

        const dropdown =
            window.GENZModelSearchDropdown;


        if (
            dropdown &&
            typeof dropdown.hide ===
                "function"
        ) {

            try {

                dropdown.hide();

                return true;

            } catch (error) {

                console.warn(
                    "[GEN-Z.AI] Hide Model Search Dropdown gagal:",
                    error
                );
            }
        }


        return false;
    }


    /* =====================================================
       INITIALIZE EVENTS
    ===================================================== */

    function initializeEvents() {

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


        /*
         * Event module menggunakan event delegation.
         * Karena itu input tidak perlu sudah tersedia
         * saat bind dilakukan.
         */
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


        return result !== false;
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


        /*
         * Event module wajib tersedia.
         */
        if (
            !initializeEvents()
        ) {

            return false;
        }


        initialized =
            true;


        /*
         * Bind positioning sekali.
         */
        const dropdown =
            window.GENZModelSearchDropdown;


        if (
            dropdown &&
            typeof dropdown.bindPositionEvents ===
                "function"
        ) {

            try {

                dropdown.bindPositionEvents();

            } catch (error) {

                console.warn(
                    "[GEN-Z.AI] Dropdown position binding gagal:",
                    error
                );
            }
        }


        /*
         * Load katalog di background.
         *
         * Jangan menunggu request ini untuk membuat
         * event search aktif.
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


                    /*
                     * Jika user sedang membuka / mengetik
                     * pada search ketika katalog selesai,
                     * tampilkan dropdown langsung.
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

            try {

                events.unbind();

            } catch (error) {

                console.warn(
                    "[GEN-Z.AI] Model Search Events destroy gagal:",
                    error
                );
            }
        }


        hideDropdown();


        models = [];

        catalogLoaded =
            false;

        loadingPromise =
            null;

        initialized =
            false;


        return true;
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

            hideDropdown,

            updateSelectedModelInfo,

            clearSelectedModelInfo
        });


    console.info(
        "[GEN-Z.AI] GENZModelsSearch loaded."
    );

})();
