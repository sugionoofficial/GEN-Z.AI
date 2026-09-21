/* =========================================================
   GEN-Z.AI
   MODELS SEARCH COORDINATOR
   ---------------------------------------------------------
   File:
   admin-control/models/models-search.js

   Tanggung jawab:
   - Model search coordinator
   - Search Model ID / Name
   - Filter berdasarkan Provider
   - Menyediakan catalog kepada Search UI
   - Delegasi selection ke model-search-select.js

   Tidak bertanggung jawab:
   - Query Supabase langsung
   - Render dropdown detail
   - Provider lifecycle
   - CRUD Model
   - Create / Edit / Delete

   SOURCE OF TRUTH:
   - GENZModelsData
   - Supabase models
   - Supabase providers
   ========================================================= */

(function () {

    "use strict";


    /* =====================================================
       STATE
       ===================================================== */

    let models = [];

    let initialized = false;

    let catalogLoaded = false;

    let loadingPromise = null;

    let selectedModel = null;


    /* =====================================================
       ELEMENT HELPERS
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
            ) ||

            document.getElementById(
                "modelId"
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
            ) ||

            document.querySelector(
                "[name='model_id']"
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
       STRING HELPERS
       ===================================================== */

    function normalizeString(value) {

        return String(
            value ?? ""
        )
            .trim()
            .toLowerCase();
    }


    function cleanString(value) {

        return String(
            value ?? ""
        ).trim();
    }


    function uniqueValues(values) {

        return [
            ...new Set(
                values
                    .map(
                        normalizeString
                    )
                    .filter(Boolean)
            )
        ];
    }


    /* =====================================================
       MODEL NORMALIZATION
       ===================================================== */

    function normalizeModel(model) {

        if (
            !model ||
            typeof model !==
                "object"
        ) {
            return null;
        }


        const provider =
            model.provider &&
            typeof model.provider ===
                "object"
                ? model.provider
                : null;


        const modelId =
            cleanString(
                model.model_id ??
                model.modelId ??
                model.id ??
                ""
            );


        if (!modelId) {
            return null;
        }


        const providerCode =
            cleanString(
                model.provider_code ??
                model.providerId ??
                model.provider_id ??
                provider?.provider_id ??
                ""
            );


        const providerUuid =
            cleanString(
                model.provider_uuid ??
                model.providerUuid ??
                provider?.id ??
                ""
            );


        const providerName =
            cleanString(
                model.provider_name ??
                model.providerName ??
                provider?.provider_name ??
                provider?.name ??
                ""
            );


        const modelName =
            cleanString(
                model.model_name ??
                model.modelName ??
                model.name ??
                ""
            );


        return {
            ...model,

            model_id:
                modelId,

            model_name:
                modelName,

            provider_id:
                providerCode,

            provider_code:
                providerCode,

            provider_uuid:
                providerUuid,

            provider_name:
                providerName,

            provider:
                provider || null
        };
    }


    function normalizeModels(list) {

        if (
            !Array.isArray(list)
        ) {
            return [];
        }


        const result = [];

        const seen =
            new Set();


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
                    !key ||
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
       STATUS
       ===================================================== */

    function isActive(model) {

        const status =
            normalizeString(
                model?.status
            );


        /*
         * Jika status tidak tersedia,
         * jangan membuang model.
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
       PROVIDER
       ===================================================== */

    function getProviderModule() {

        return (
            window.GENZModelsProvider ||
            null
        );
    }


    function emptyProvider() {

        return {

            id: "",

            uuid: "",

            providerId: "",

            name: "",

            text: ""
        };
    }


    function getSelectedProvider() {

        const select =
            document.getElementById(
                "providerId"
            ) ||

            document.querySelector(
                "[name='provider_id']"
            );


        if (!select) {
            return emptyProvider();
        }


        const selectedValue =
            cleanString(
                select.value
            );


        if (!selectedValue) {
            return emptyProvider();
        }


        const option =
            select.options &&
            select.selectedIndex >= 0
                ? select.options[
                    select.selectedIndex
                ]
                : null;


        /*
         * Provider module tidak dipanggil
         * secara synchronous.
         *
         * Data Provider yang sudah dirender
         * pada select menjadi sumber identitas
         * untuk pencocokan search.
         */
        const providerCode =
            cleanString(
                option?.dataset?.providerId ??
                option?.dataset?.providerCode ??
                ""
            );


        const providerUuid =
            cleanString(
                option?.dataset?.providerUuid ??
                option?.dataset?.providerIdUuid ??
                ""
            );


        const providerName =
            cleanString(
                option?.dataset?.providerName ??
                option?.textContent ??
                ""
            );


        return {

            id:
                selectedValue,

            uuid:
                providerUuid ||
                selectedValue,

            providerId:
                providerCode,

            name:
                providerName,

            text:
                providerName
        };
    }


    /* =====================================================
       MODEL PROVIDER IDENTIFIERS
       ===================================================== */

    function getModelProviderCodes(model) {

        return uniqueValues([

            model?.provider_code,

            model?.provider_id,

            model?.providerId,

            model?.provider,

            model?.provider?.provider_id
        ]);
    }


    function getModelProviderUuids(model) {

        return uniqueValues([

            model?.provider_uuid,

            model?.providerUuid,

            model?.provider?.id
        ]);
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
         * Jika Provider belum dipilih,
         * tampilkan semua model.
         */
        if (
            !selected.providerId &&
            !selected.uuid &&
            !selected.id
        ) {
            return true;
        }


        const selectedCode =
            normalizeString(
                selected.providerId
            );


        const selectedUuid =
            normalizeString(
                selected.uuid
            );


        const selectedId =
            normalizeString(
                selected.id
            );


        /*
         * -------------------------------------------------
         * PROVIDER CODE
         * -------------------------------------------------
         */
        if (selectedCode) {

            const codes =
                getModelProviderCodes(
                    model
                );


            if (
                codes.includes(
                    selectedCode
                )
            ) {
                return true;
            }
        }


        /*
         * -------------------------------------------------
         * PROVIDER UUID
         * -------------------------------------------------
         */
        if (selectedUuid) {

            const uuids =
                getModelProviderUuids(
                    model
                );


            if (
                uuids.includes(
                    selectedUuid
                )
            ) {
                return true;
            }
        }


        /*
         * -------------------------------------------------
         * SELECT VALUE
         * -------------------------------------------------
         *
         * Bisa berupa UUID atau provider_id,
         * tergantung bentuk select.
         */
        if (selectedId) {

            const uuids =
                getModelProviderUuids(
                    model
                );


            if (
                uuids.includes(
                    selectedId
                )
            ) {
                return true;
            }


            const codes =
                getModelProviderCodes(
                    model
                );


            if (
                codes.includes(
                    selectedId
                )
            ) {
                return true;
            }
        }


        return false;
    }


    /* =====================================================
       CATALOG
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
            typeof data.loadModels !==
                "function"
        ) {

            console.error(
                "[GEN-Z.AI] GENZModelsData.loadModels() belum tersedia."
            );

            return [
                ...models
            ];
        }


        loadingPromise =
            (async function () {

                try {

                    /*
                     * models-data menjadi gateway
                     * sumber Model.
                     *
                     * Search tidak melakukan
                     * query Supabase sendiri.
                     */
                    const loaded =
                        await data.loadModels({

                            force:
                                options.force ===
                                true,

                            includeInactive:
                                options.includeInactive ===
                                true,

                            activeProviderOnly:
                                options.activeProviderOnly ===
                                true
                        });


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


    async function refreshCatalog(
        options = {}
    ) {

        return ensureCatalog({

            ...options,

            force:
                true
        });
    }


    /* =====================================================
       SET MODELS
       ===================================================== */

    function setModels(list) {

        models =
            normalizeModels(
                list
            );


        catalogLoaded =
            true;


        /*
         * Pastikan selection lama masih
         * terdapat di catalog terbaru.
         */
        if (
            selectedModel
        ) {

            const selectedId =
                normalizeString(
                    selectedModel.model_id
                );


            selectedModel =
                models.find(
                    model =>
                        normalizeString(
                            model.model_id
                        ) ===
                        selectedId
                ) || null;
        }


        console.info(
            "[GEN-Z.AI] Model search catalog:",
            models.length
        );


        const input =
            getSearchInput();


        if (
            input &&
            document.activeElement ===
                input &&
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
                model =>
                    normalizeString(
                        model.model_id
                    ) === id
            ) || null
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
         * Hanya Model aktif untuk pilihan
         * pada form Create.
         *
         * Model inactive tetap ada di catalog
         * untuk kebutuhan Edit / compatibility.
         */
        let results =
            models.filter(
                isActive
            );


        /*
         * Provider.
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
                        a.model_id
                    ).localeCompare(
                        String(
                            b.model_id
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
         *
         * Model ID
         * Model Name
         * Description
         * Provider ID
         * Provider Name
         * Model Family
         * Type
         */
        return results
            .filter(
                function (model) {

                    const haystack = [

                        model.model_id,

                        model.model_name,

                        model.description,

                        model.provider_code,

                        model.provider_id,

                        model.provider_name,

                        model.model_family,

                        model.modelFamily,

                        model.type,

                        model.model_type,

                        model.provider?.provider_id,

                        model.provider?.provider_name

                    ]
                        .filter(Boolean)
                        .join(" ")
                        .toLowerCase();


                    return haystack.includes(
                        term
                    );
                }
            )
            .sort(
                function (a, b) {

                    const aId =
                        normalizeString(
                            a.model_id
                        );

                    const bId =
                        normalizeString(
                            b.model_id
                        );


                    /*
                     * Exact Model ID.
                     */
                    if (
                        aId === term &&
                        bId !== term
                    ) {
                        return -1;
                    }


                    if (
                        bId === term &&
                        aId !== term
                    ) {
                        return 1;
                    }


                    /*
                     * Model ID dimulai
                     * dengan keyword.
                     */
                    const aStarts =
                        aId.startsWith(
                            term
                        );

                    const bStarts =
                        bId.startsWith(
                            term
                        );


                    if (
                        aStarts &&
                        !bStarts
                    ) {
                        return -1;
                    }


                    if (
                        bStarts &&
                        !aStarts
                    ) {
                        return 1;
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

            /*
             * Jangan crash seluruh halaman
             * hanya karena renderer belum
             * selesai dimuat.
             */
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

        const requestedKeyword =
            String(
                keyword ?? ""
            );


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
         * Hindari hasil request lama
         * menimpa keyword terbaru.
         */
        if (
            currentKeyword !==
            requestedKeyword
        ) {
            return false;
        }


        return render(
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
         * Mengetik ulang berarti selection
         * sebelumnya sudah tidak valid.
         */
        selectedModel =
            null;


        /*
         * Jangan kosongkan field yang sama
         * dengan search input.
         *
         * Hanya kosongkan hidden input jika
         * memang berbeda element.
         */
        const hidden =
            getHiddenModelInput();

        const input =
            event?.target ||
            getSearchInput();


        if (
            hidden &&
            hidden !== input
        ) {

            hidden.value =
                "";
        }


        if (catalogLoaded) {

            showDropdown();

            return render(
                keyword
            );
        }


        showDropdown();


        renderAfterCatalog(
            keyword
        );


        return true;
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


        showDropdown();


        if (catalogLoaded) {

            return render(
                keyword
            );
        }


        renderAfterCatalog(
            keyword
        )
            .then(
                function () {

                    /*
                     * Pastikan input masih aktif
                     * sebelum menampilkan hasil.
                     */
                    const input =
                        getSearchInput();


                    if (
                        input &&
                        document.activeElement ===
                            input
                    ) {
                        showDropdown();
                    }
                }
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


            setActiveResult(
                items,
                index
            );

            return;
        }


        if (
            event.key ===
            "ArrowUp"
        ) {

            event.preventDefault();


            index =
                index <= 0
                    ? 0
                    : index - 1;


            setActiveResult(
                items,
                index
            );

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


    function setActiveResult(
        items,
        index
    ) {

        items.forEach(
            function (item) {

                item.classList.remove(
                    "active"
                );

                item.setAttribute(
                    "aria-selected",
                    "false"
                );
            }
        );


        if (
            !items[index]
        ) {
            return;
        }


        items[index].classList.add(
            "active"
        );

        items[index].setAttribute(
            "aria-selected",
            "true"
        );


        try {

            items[index].scrollIntoView({
                block:
                    "nearest"
            });

        } catch (_) {
            /* ignore */
        }
    }


    /* =====================================================
       SELECT MODEL
       ===================================================== */

    function chooseModel(
        modelId
    ) {

        const id =
            cleanString(
                modelId
            );


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


            if (
                selected === false
            ) {
                return false;
            }


            selectedModel =
                model;


            hideDropdown();


            return true;

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
            cleanString(
                item.dataset.modelId
            );


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
         * Provider berubah berarti
         * selection Model sebelumnya invalid.
         */
        selectedModel =
            null;


        clearSelectedModelInfo();


        const input =
            getSearchInput();


        if (!input) {
            return;
        }


        if (catalogLoaded) {

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
       SELECTED MODEL
       ===================================================== */

    function clearSelectedModelInfo() {

        selectedModel =
            null;


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


        const modelId =
            cleanString(
                model.model_id ??
                model.modelId
            );


        if (!modelId) {
            return;
        }


        const catalogModel =
            findModelById(
                modelId
            );


        if (!catalogModel) {

            console.warn(
                "[GEN-Z.AI] Model tidak ada di catalog:",
                modelId
            );

            return;
        }


        selectedModel =
            catalogModel;


        const selector =
            window.GENZModelSearchSelect;


        if (
            selector &&
            typeof selector.selectModel ===
                "function"
        ) {

            try {

                selector.selectModel(
                    catalogModel
                );

            } catch (error) {

                console.warn(
                    "[GEN-Z.AI] Update Model selection gagal:",
                    error
                );
            }
        }
    }


    function getSelectedModel() {

        if (
            selectedModel
        ) {
            return selectedModel;
        }


        const hidden =
            getHiddenModelInput();


        const modelId =
            cleanString(
                hidden?.value
            );


        if (!modelId) {
            return null;
        }


        return findModelById(
            modelId
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


        hideDropdown();
    }


    /* =====================================================
       DROPDOWN
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

                return (
                    dropdown.show() !==
                    false
                );

            } catch (error) {

                console.warn(
                    "[GEN-Z.AI] Show dropdown gagal:",
                    error
                );
            }
        }


        /*
         * Fallback jika dropdown module
         * belum menyediakan show().
         */
        const box =
            getResultsBox();


        if (!box) {
            return false;
        }


        box.hidden = false;

        box.removeAttribute(
            "aria-hidden"
        );


        return true;
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

                return (
                    dropdown.hide() !==
                    false
                );

            } catch (error) {

                console.warn(
                    "[GEN-Z.AI] Hide dropdown gagal:",
                    error
                );
            }
        }


        const box =
            getResultsBox();


        if (!box) {
            return false;
        }


        box.hidden = true;

        box.setAttribute(
            "aria-hidden",
            "true"
        );


        return true;
    }


    /* =====================================================
       EVENTS
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

    function initialize(
        options = {}
    ) {

        if (initialized) {
            return true;
        }


        if (
            !initializeEvents()
        ) {
            return false;
        }


        initialized =
            true;


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
         * Catalog dimuat melalui models-data.
         */
        ensureCatalog(
            options
        )
            .then(
                function (loaded) {

                    console.info(
                        "[GEN-Z.AI] Model search catalog ready:",
                        loaded.length
                    );


                    const input =
                        getSearchInput();


                    if (
                        input &&
                        document.activeElement ===
                            input
                    ) {

                        render(
                            input.value
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

        selectedModel =
            null;

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

            showDropdown,

            updateSelectedModelInfo,

            clearSelectedModelInfo,

            getSelectedModel,

            providerMatches,

            getSelectedProvider

        });


    console.info(
        "[GEN-Z.AI] GENZModelsSearch loaded."
    );

})();
