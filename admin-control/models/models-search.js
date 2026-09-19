/* =========================================================
   GEN-Z.AI
   MODELS SEARCH COORDINATOR
   ---------------------------------------------------------
   File:
   admin-control/models/models-search.js

   Tanggung jawab:
   - Memuat katalog Model dari models-data
   - Filter berdasarkan Provider
   - Search Model ID / nama / family / provider
   - Menyediakan Model untuk dropdown
   - Memvalidasi selection berdasarkan catalog

   SOURCE OF TRUTH:
   - models
   - providers

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

    function normalizeString(
        value
    ) {

        return String(
            value ?? ""
        )
            .trim()
            .toLowerCase();
    }


    function cleanString(
        value
    ) {

        return String(
            value ?? ""
        ).trim();
    }


    function uniqueValues(
        values
    ) {

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
       MODEL NORMALIZER
       ===================================================== */

    function normalizeModel(
        model
    ) {

        if (
            !model ||
            typeof model !==
                "object"
        ) {

            return null;
        }


        const modelId =
            cleanString(
                model.model_id ??
                model.modelId ??
                ""
            );


        /*
         * Model tanpa Model ID tidak
         * dapat digunakan untuk search.
         */
        if (
            !modelId
        ) {

            return null;
        }


        const providerObject =
            model.provider &&
            typeof model.provider ===
                "object"
                ? model.provider
                : null;


        const providerId =
            cleanString(
                model.provider_id ??
                model.providerId ??
                providerObject?.provider_id ??
                ""
            );


        const providerUuid =
            cleanString(
                model.provider_uuid ??
                model.providerUuid ??
                providerObject?.id ??
                ""
            );


        const providerName =
            cleanString(
                model.provider_name ??
                model.providerName ??
                providerObject?.provider_name ??
                providerObject?.name ??
                ""
            );


        const modelName =
            cleanString(
                model.model_name ??
                model.modelName ??
                model.name ??
                ""
            );


        const modelFamily =
            cleanString(
                model.model_family ??
                model.modelFamily ??
                model.family ??
                ""
            );


        return {

            ...model,

            model_id:
                modelId,

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


    function normalizeModels(
        list
    ) {

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


                if (
                    !model
                ) {

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
       MODEL STATUS
       ===================================================== */

    function isActive(
        model
    ) {

        const status =
            normalizeString(
                model?.status
            );


        /*
         * models-data sudah dapat melakukan
         * filtering status.
         *
         * Jika status kosong, record tetap
         * boleh tampil karena source data
         * sudah dianggap valid.
         */
        if (
            !status
        ) {

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


        if (
            !select
        ) {

            return emptyProvider();
        }


        const selectedValue =
            cleanString(
                select.value
            );


        if (
            !selectedValue
        ) {

            return emptyProvider();
        }


        const option =
            select.options[
                select.selectedIndex
            ];


        let providerId =
            selectedValue;


        let providerUuid =
            cleanString(
                option?.dataset?.providerUuid
            );


        let providerName =
            cleanString(
                option?.textContent
            );


        const providerModule =
            getProviderModule();


        /*
         * Provider module adalah sumber
         * data provider yang sudah dimuat.
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


                if (
                    provider
                ) {

                    providerId =
                        cleanString(
                            provider.provider_id ??
                            provider.provider ??
                            selectedValue
                        );


                    providerUuid =
                        cleanString(
                            provider.id ??
                            providerUuid
                        );


                    providerName =
                        cleanString(
                            provider.provider_name ??
                            provider.name ??
                            providerName
                        );
                }

            } catch (
                error
            ) {

                console.warn(
                    "[GEN-Z.AI] Provider lookup gagal:",
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
                cleanString(
                    option?.textContent
                )
        };
    }


    /* =====================================================
       MODEL PROVIDER IDENTIFIERS
       ===================================================== */

    function getModelProviderIds(
        model
    ) {

        return uniqueValues([

            model?.provider_id,

            model?.providerId,

            model?.provider,

            model?.provider?.provider_id
        ]);
    }


    function getModelProviderUuids(
        model
    ) {

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
         * Tidak ada Provider dipilih.
         */
        if (
            !selected.providerId &&
            !selected.uuid &&
            !selected.id
        ) {

            return true;
        }


        const selectedProviderId =
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
         * UUID exact.
         */
        if (
            selectedUuid
        ) {

            const modelUuids =
                getModelProviderUuids(
                    model
                );


            if (
                modelUuids.length > 0
            ) {

                return modelUuids.includes(
                    selectedUuid
                );
            }
        }


        /*
         * Provider code exact.
         *
         * Contoh:
         *
         * providers.provider_id
         * =
         * model.provider_id
         *
         * Tidak menggunakan includes().
         */
        if (
            selectedProviderId
        ) {

            const modelProviderIds =
                getModelProviderIds(
                    model
                );


            if (
                modelProviderIds.length > 0
            ) {

                return modelProviderIds.includes(
                    selectedProviderId
                );
            }
        }


        /*
         * Fallback apabila value select
         * adalah UUID database provider.
         */
        if (
            selectedId
        ) {

            const modelProviderUuids =
                getModelProviderUuids(
                    model
                );


            if (
                modelProviderUuids.includes(
                    selectedId
                )
            ) {

                return true;
            }


            const modelProviderIds =
                getModelProviderIds(
                    model
                );


            if (
                modelProviderIds.includes(
                    selectedId
                )
            ) {

                return true;
            }
        }


        /*
         * Provider name sengaja tidak digunakan
         * untuk menentukan kecocokan.
         */
        return false;
    }


    /* =====================================================
       CATALOG LOADING
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
                     * INI PERUBAHAN UTAMA:
                     *
                     * Sebelumnya:
                     * loadKieModels()
                     *
                     * Sekarang:
                     * loadModels()
                     *
                     * Karena source of truth sudah
                     * dipindahkan ke tabel models.
                     */
                    const loaded =
                        await data.loadModels({

                            force:
                                options.force === true,

                            includeInactive:
                                options.activeOnly ===
                                    false,

                            activeProviderOnly:
                                options.activeProviderOnly ===
                                    true
                        });


                    /*
                     * Hanya data dari models-data
                     * yang boleh masuk catalog.
                     */
                    setModels(
                        loaded
                    );


                    return [
                        ...models
                    ];

                } catch (
                    error
                ) {

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

    function setModels(
        list
    ) {

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


        /*
         * Jika input sedang aktif,
         * render ulang setelah catalog
         * berhasil dimuat.
         */
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


    /* =====================================================
       GET MODELS
       ===================================================== */

    function getModels() {

        return [
            ...models
        ];
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
         * Provider exact.
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
         * tampilkan seluruh Model dari
         * Provider yang dipilih.
         */
        if (
            !term
        ) {

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
         * Search Model ID.
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
                            model.provider?.provider_name ||
                            model.provider?.provider_id ||
                            ""
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


                const aFamily =
                    normalizeString(
                        a.model_family
                    );


                const bFamily =
                    normalizeString(
                        b.model_family
                    );


                const aProvider =
                    normalizeString(
                        a.provider_name ||
                        a.provider_id ||
                        a.provider?.provider_name ||
                        a.provider?.provider_id ||
                        ""
                    );


                const bProvider =
                    normalizeString(
                        b.provider_name ||
                        b.provider_id ||
                        b.provider?.provider_name ||
                        b.provider?.provider_id ||
                        ""
                    );


                function score(
                    id,
                    name,
                    family,
                    provider
                ) {

                    if (
                        id === term
                    ) {

                        return 100000;
                    }


                    if (
                        id.startsWith(
                            term
                        )
                    ) {

                        return 10000;
                    }


                    if (
                        id.includes(
                            term
                        )
                    ) {

                        return 1000;
                    }


                    if (
                        name.includes(
                            term
                        )
                    ) {

                        return 100;
                    }


                    if (
                        family.includes(
                            term
                        )
                    ) {

                        return 50;
                    }


                    if (
                        provider.includes(
                            term
                        )
                    ) {

                        return 25;
                    }


                    return 0;
                }


                const aScore =
                    score(
                        aId,
                        aName,
                        aFamily,
                        aProvider
                    );


                const bScore =
                    score(
                        bId,
                        bName,
                        bFamily,
                        bProvider
                    );


                if (
                    aScore !==
                    bScore
                ) {

                    return (
                        bScore -
                        aScore
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


        if (
            !id
        ) {

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

        } catch (
            error
        ) {

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


        if (
            !input
        ) {

            return false;
        }


        const currentKeyword =
            String(
                input.value || ""
            );


        /*
         * Jangan render hasil lama apabila
         * user sudah mengetik keyword baru.
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
         * Search input tidak menjadi
         * source of truth Model ID.
         */
        const hidden =
            getHiddenModelInput();


        if (
            hidden
        ) {

            hidden.value =
                "";
        }


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
       FOCUS
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


        if (
            !box
        ) {

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

                } catch (
                    error
                ) {
                    // ignore
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

                } catch (
                    error
                ) {
                    // ignore
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


            if (
                active
            ) {

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


        if (
            !id
        ) {

            return false;
        }


        /*
         * Model harus berasal dari catalog.
         */
        const model =
            findModelById(
                id
            );


        if (
            !model
        ) {

            console.warn(
                "[GEN-Z.AI] Model ID tidak terdapat di katalog:",
                id
            );

            return false;
        }


        /*
         * Provider harus cocok.
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
         * Model harus aktif.
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


        try {

            const selected =
                selector.selectModel(
                    model
                );


            return selected !== false;

        } catch (
            error
        ) {

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


        if (
            !target
        ) {

            return;
        }


        const item =
            target.closest(
                ".model-search-item"
            );


        if (
            !item
        ) {

            return;
        }


        const modelId =
            cleanString(
                item.dataset.modelId
            );


        if (
            !modelId
        ) {

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
         * Model sebelumnya tidak lagi valid
         * ketika Provider berubah.
         */
        clearSelectedModelInfo();


        const input =
            getSearchInput();


        if (
            !input
        ) {

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

            } catch (
                error
            ) {

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

        if (
            !model
        ) {

            clearSelectedModelInfo();

            return;
        }


        const catalogModel =
            findModelById(
                model.model_id
            );


        if (
            !catalogModel
        ) {

            console.warn(
                "[GEN-Z.AI] Update Model ditolak karena Model tidak ada di catalog."
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

            } catch (
                error
            ) {

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


        if (
            !input
        ) {

            return;
        }


        /*
         * Klik input tidak menutup dropdown.
         */
        if (
            event.target ===
            input
        ) {

            return;
        }


        /*
         * Klik item/dropdown tidak menutup
         * sebelum selection selesai.
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

                return dropdown.show() !==
                    false;

            } catch (
                error
            ) {

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

                return dropdown.hide() !==
                    false;

            } catch (
                error
            ) {

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

        if (
            initialized
        ) {

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

            } catch (
                error
            ) {

                console.warn(
                    "[GEN-Z.AI] Dropdown position binding gagal:",
                    error
                );
            }
        }


        /*
         * Load model catalog dari tabel models.
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

            } catch (
                error
            ) {

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
