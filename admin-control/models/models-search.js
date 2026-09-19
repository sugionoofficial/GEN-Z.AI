/* =========================================================
   GEN-Z.AI
   MODELS SEARCH COORDINATOR
   ---------------------------------------------------------
   File:
   admin-control/models/models-search.js

   Arsitektur:
   - Model catalog berasal dari model folder
   - models-data.js menjadi gateway catalog
   - Provider berasal dari Supabase
   - Tidak menggunakan tabel KIE lama

   TIDAK MENGGUNAKAN:
   - kie_models
   - kie_workflows
   - kie_workflow_variants
   - kie_parameters
   - kie_constraints
   - kie_dependencies
   - kie_pricing
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
            typeof model !== "object"
        ) {
            return null;
        }


        const provider =
            model.provider &&
            typeof model.provider === "object"
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
                provider?.provider_id ??
                ""
            );


        const providerUuid =
            cleanString(
                model.provider_uuid ??
                provider?.id ??
                ""
            );


        const providerName =
            cleanString(
                model.provider_name ??
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
         * Model folder default:
         * active
         *
         * Jika status belum ada,
         * jangan menghilangkan model.
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
            select.options[
                select.selectedIndex
            ];


        let providerCode =
            cleanString(
                option?.dataset?.providerId
            );


        let providerUuid =
            cleanString(
                option?.dataset?.providerUuid
            );


        let providerName =
            cleanString(
                option?.textContent
            );


        /*
         * Provider module tetap menjadi
         * sumber data provider.
         */
        const providerModule =
            getProviderModule();


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

                    providerUuid =
                        cleanString(
                            provider.id ??
                            providerUuid
                        );


                    providerCode =
                        cleanString(
                            provider.provider_id ??
                            provider.provider ??
                            providerCode
                        );


                    providerName =
                        cleanString(
                            provider.provider_name ??
                            provider.name ??
                            providerName
                        );
                }

            } catch (error) {

                console.warn(
                    "[GEN-Z.AI] Provider lookup gagal:",
                    error
                );
            }
        }


        /*
         * Bila value select adalah UUID,
         * gunakan UUID sebagai id.
         */
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
                providerName ||
                cleanString(
                    option?.textContent
                )
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
         * Prioritas 1:
         * provider code.
         *
         * Contoh:
         * kie_ai
         */
        if (selectedCode) {

            const codes =
                getModelProviderCodes(
                    model
                );


            if (
                codes.length > 0 &&
                codes.includes(
                    selectedCode
                )
            ) {
                return true;
            }
        }


        /*
         * Prioritas 2:
         * UUID provider.
         */
        if (selectedUuid) {

            const uuids =
                getModelProviderUuids(
                    model
                );


            if (
                uuids.length > 0 &&
                uuids.includes(
                    selectedUuid
                )
            ) {
                return true;
            }
        }


        /*
         * Prioritas 3:
         * selected id.
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
                     * models-data sekarang membaca
                     * MODEL_REGISTRY dari folder model.
                     */
                    const loaded =
                        await data.loadModels({

                            force:
                                options.force ===
                                true,

                            includeInactive:
                                options.activeOnly ===
                                false,

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
         * Hanya model aktif.
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
         * Search berdasarkan:
         *
         * Model ID
         * Model name
         * Description
         * Provider
         * Type
         */
        return results
            .filter(
                function (model) {

                    const haystack =
                        [
                            model.model_id,

                            model.model_name,

                            model.description,

                            model.provider_code,

                            model.provider_id,

                            model.provider_name,

                            model.provider?.provider_id,

                            model.provider?.provider_name,

                            model.type
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
                     * Exact match lebih dulu.
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
       INPUT EVENT
       ===================================================== */

    function handleInput(event) {

        const keyword =
            event?.target?.value ??
            "";


        /*
         * Saat user mengetik ulang,
         * selection sebelumnya harus dibersihkan.
         */
        const hidden =
            getHiddenModelInput();


        if (hidden) {

            hidden.value =
                "";
        }


        if (catalogLoaded) {

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
       FOCUS EVENT
       ===================================================== */

    function handleFocus(event) {

        const keyword =
            event?.target?.value ??
            "";


        if (catalogLoaded) {

            showDropdown();

            return render(
                keyword
            );
        }


        renderAfterCatalog(
            keyword
        )
            .then(
                function () {

                    showDropdown();
                }
            );


        return true;
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

                    item.setAttribute(
                        "aria-selected",
                        "false"
                    );
                }
            );


            if (
                items[index]
            ) {

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

                    item.setAttribute(
                        "aria-selected",
                        "false"
                    );
                }
            );


            if (
                items[index]
            ) {

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
         * Provider berubah:
         * Model sebelumnya tidak boleh
         * dianggap tetap valid.
         */
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


        const catalogModel =
            findModelById(
                model.model_id
            );


        if (!catalogModel) {

            console.warn(
                "[GEN-Z.AI] Model tidak ada di catalog:",
                model.model_id
            );

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


        return false;
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

    function initialize() {

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
         * Load catalog dari model folder.
         */
        ensureCatalog()
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

            providerMatches,

            getSelectedProvider
        });


    console.info(
        "[GEN-Z.AI] GENZModelsSearch loaded."
    );

})();
