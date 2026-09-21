/* =========================================================
   GEN-Z.AI
   MODELS SEARCH COORDINATOR
   ---------------------------------------------------------
   File:
   admin-control/models/models-search.js

   Tanggung jawab:
   - Koordinasi Model Search
   - Memuat catalog melalui GENZModelsData
   - Filter berdasarkan Provider
   - Search Model ID / Name / Family / Type
   - Delegasi rendering
   - Delegasi selection

   Tidak bertanggung jawab:
   - Query Supabase langsung
   - Provider CRUD
   - Form CRUD
   - Render detail dropdown
   - Selection detail

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
       NORMALIZE
    ===================================================== */

    function cleanString(value) {

        return String(
            value ?? ""
        ).trim();

    }


    function normalizeString(value) {

        return cleanString(
            value
        ).toLowerCase();

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
            ) ||

            document.getElementById(
                "model_id"
            ) ||

            document.querySelector(
                "[name='model_id']"
            ) ||

            document.querySelector(
                "[name='modelId']"
            ) ||

            null
        );

    }


    function getHiddenModelInput() {

        return (
            document.getElementById(
                "modelCode"
            ) ||

            document.getElementById(
                "model_id"
            ) ||

            document.querySelector(
                "[name='model_code']"
            ) ||

            document.querySelector(
                "[name='model_id']"
            ) ||

            null
        );

    }


    function getProviderSelect() {

        return (
            document.getElementById(
                "providerId"
            ) ||

            document.getElementById(
                "provider_id"
            ) ||

            document.querySelector(
                "[name='provider_id']"
            ) ||

            document.querySelector(
                "[name='providerId']"
            ) ||

            null
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
            ) ||

            document.querySelector(
                "[data-model-search-results]"
            ) ||

            null
        );

    }


    /* =====================================================
       MODEL NORMALIZATION
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


        /*
         * Model ID adalah identitas utama.
         *
         * models.model_id menjadi prioritas.
         */
        const modelId =
            cleanString(
                model.model_id ??
                model.modelId ??
                ""
            );


        if (
            !modelId
        ) {

            return null;

        }


        const provider =
            model.provider &&
            typeof model.provider === "object"
                ? model.provider
                : null;


        const providerId =
            cleanString(
                model.provider_id ??
                model.providerId ??
                ""
            );


        const providerCode =
            cleanString(
                model.provider_code ??
                model.providerCode ??
                provider?.provider_id ??
                provider?.providerId ??
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
                provider?.providerName ??
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


        const modelFamily =
            cleanString(
                model.model_family ??
                model.modelFamily ??
                model.family ??
                ""
            );


        const modelType =
            cleanString(
                model.model_type ??
                model.modelType ??
                model.type ??
                model.category ??
                ""
            );


        return {

            ...model,

            model_id:
                modelId,

            model_name:
                modelName,

            model_family:
                modelFamily,

            modelFamily:
                modelFamily,

            model_type:
                modelType,

            modelType:
                modelType,

            provider_id:
                providerId,

            providerId:
                providerId,

            provider_code:
                providerCode,

            providerCode:
                providerCode,

            provider_uuid:
                providerUuid,

            providerUuid:
                providerUuid,

            provider_name:
                providerName,

            providerName:
                providerName,

            provider:
                provider

        };

    }


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

        const seen =
            new Set();


        list.forEach(
            function (
                item
            ) {

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
       ACTIVE MODEL
    ===================================================== */

    function isActive(
        model
    ) {

        if (
            !model ||
            typeof model !== "object"
        ) {

            return false;

        }


        /*
         * Jangan mengarang status jika field
         * memang tidak tersedia.
         */
        const status =
            normalizeString(
                model.status
            );


        if (
            !status
        ) {

            if (
                Object.prototype.hasOwnProperty.call(
                    model,
                    "is_active"
                )
            ) {

                return (
                    model.is_active === true ||
                    model.is_active === 1 ||
                    normalizeString(
                        model.is_active
                    ) === "true"
                );

            }


            if (
                Object.prototype.hasOwnProperty.call(
                    model,
                    "active"
                )
            ) {

                return (
                    model.active === true ||
                    model.active === 1 ||
                    normalizeString(
                        model.active
                    ) === "true"
                );

            }


            if (
                Object.prototype.hasOwnProperty.call(
                    model,
                    "enabled"
                )
            ) {

                return (
                    model.enabled === true ||
                    model.enabled === 1 ||
                    normalizeString(
                        model.enabled
                    ) === "true"
                );

            }


            /*
             * Tidak ada status:
             * model tidak dibuang.
             */
            return true;

        }


        return [
            "active",
            "enabled",
            "enable",
            "published",
            "ready",
            "live",
            "on",
            "true",
            "1"
        ].includes(
            status
        );

    }


    /* =====================================================
       PROVIDER IDENTIFIERS
    ===================================================== */

    function getModelProviderCodes(
        model
    ) {

        return uniqueValues([

            model?.provider_code,

            model?.providerCode,

            model?.provider_id,

            model?.providerId,

            model?.provider?.provider_id,

            model?.provider?.providerId

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
       SELECTED PROVIDER
    ===================================================== */

    function getSelectedProvider() {

        const select =
            getProviderSelect();


        if (
            !select
        ) {

            return {

                id: "",

                uuid: "",

                providerId: "",

                name: "",

                text: ""

            };

        }


        const selectedValue =
            cleanString(
                select.value
            );


        if (
            !selectedValue
        ) {

            return {

                id: "",

                uuid: "",

                providerId: "",

                name: "",

                text: ""

            };

        }


        const option =
            select.selectedIndex >= 0
                ? select.options[
                    select.selectedIndex
                ]
                : null;


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


        /*
         * Select value = providers.id.
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
                providerName

        };

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
            !selected
        ) {

            return true;

        }


        const selectedId =
            normalizeString(
                selected.id
            );


        const selectedUuid =
            normalizeString(
                selected.uuid
            );


        const selectedCode =
            normalizeString(
                selected.providerId
            );


        /*
         * Provider belum dipilih.
         */
        if (
            !selectedId &&
            !selectedUuid &&
            !selectedCode
        ) {

            return true;

        }


        const modelIds =
            getModelProviderUuids(
                model
            );


        const modelCodes =
            getModelProviderCodes(
                model
            );


        /*
         * Prioritas:
         *
         * providers.id
         * providers.provider_id
         */
        if (
            selectedId &&
            (
                modelIds.includes(
                    selectedId
                ) ||
                modelCodes.includes(
                    selectedId
                )
            )
        ) {

            return true;

        }


        if (
            selectedUuid &&
            modelIds.includes(
                selectedUuid
            )
        ) {

            return true;

        }


        if (
            selectedCode &&
            modelCodes.includes(
                selectedCode
            )
        ) {

            return true;

        }


        return false;

    }


    /* =====================================================
       DATA CATALOG
    ===================================================== */

    async function ensureCatalog(
        options = {}
    ) {

        const force =
            options.force === true;


        /*
         * Catalog sudah tersedia.
         */
        if (
            catalogLoaded &&
            !force
        ) {

            return [
                ...models
            ];

        }


        /*
         * Request yang sedang berjalan selalu
         * dipakai bersama.
         *
         * Ini mencegah double request ketika
         * input diketik cepat.
         */
        if (
            loadingPromise
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

                    const loaded =
                        await data.loadModels({

                            force:

                                force,

                            includeInactive:

                                options.includeInactive ===
                                true

                        });


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
       SET CATALOG
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


        catalogLoaded =
            true;


        /*
         * Sinkronisasi selectedModel dengan
         * object terbaru dari catalog.
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
                    function (
                        model
                    ) {

                        return (
                            normalizeString(
                                model.model_id
                            ) ===
                            selectedId
                        );

                    }
                ) || null;

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


        if (
            !id
        ) {

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
       SEARCH
    ===================================================== */

    function search(
        keyword = "",
        options = {}
    ) {

        const term =
            normalizeString(
                keyword
            );


        const provider =
            options.provider ||
            getSelectedProvider();


        /*
         * Default search hanya menampilkan
         * model aktif.
         */
        const includeInactive =
            options.includeInactive === true;


        let results =
            models.filter(
                function (
                    model
                ) {

                    return (
                        includeInactive ||
                        isActive(
                            model
                        )
                    );

                }
            );


        /*
         * Provider filter.
         */
        results =
            results.filter(
                function (
                    model
                ) {

                    return providerMatches(
                        model,
                        provider
                    );

                }
            );


        /*
         * Tanpa keyword:
         * tampilkan catalog provider tersebut.
         */
        if (
            !term
        ) {

            return results.sort(
                sortModels
            );

        }


        /*
         * Search fields.
         */
        results =
            results.filter(
                function (
                    model
                ) {

                    const haystack = [

                        model.model_id,

                        model.model_name,

                        model.model_family,

                        model.model_type,

                        model.type,

                        model.description,

                        model.provider_id,

                        model.provider_code,

                        model.provider_name,

                        model.provider?.provider_id,

                        model.provider?.provider_name

                    ]
                        .filter(
                            Boolean
                        )
                        .join(
                            " "
                        )
                        .toLowerCase();


                    return haystack.includes(
                        term
                    );

                }
            );


        return results.sort(
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
                 * Model ID starts with
                 * keyword.
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


                return sortModels(
                    a,
                    b
                );

            }
        );

    }


    function sortModels(
        a,
        b
    ) {

        return String(
            a?.model_id ?? ""
        ).localeCompare(
            String(
                b?.model_id ?? ""
            ),
            "id",
            {
                sensitivity:
                    "base"
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

            return false;

        }


        const results =
            search(
                keyword
            );


        try {

            const result =
                renderer.render(
                    results
                );


            return result !== false;

        } catch (
            error
        ) {

            console.error(
                "[GEN-Z.AI] Model Search render gagal:",
                error
            );


            return false;

        }

    }


    async function renderAfterCatalog(
        keyword = ""
    ) {

        const requested =
            String(
                keyword ?? ""
            );


        await ensureCatalog();


        const input =
            getSearchInput();


        if (
            !input
        ) {

            return false;

        }


        const current =
            String(
                input.value ?? ""
            );


        /*
         * Request lama tidak boleh
         * menimpa keyword terbaru.
         */
        if (
            current !==
            requested
        ) {

            return false;

        }


        return render(
            current
        );

    }


    /* =====================================================
       INPUT
    ===================================================== */

    function handleInput(
        event
    ) {

        const input =
            event?.target ||
            getSearchInput();


        const keyword =
            input?.value ??
            "";


        /*
         * Ketika user mengetik ulang,
         * selection sebelumnya tidak lagi valid.
         */
        selectedModel =
            null;


        /*
         * Hidden Model ID harus kosong
         * jika merupakan field berbeda.
         */
        const hidden =
            getHiddenModelInput();


        if (
            hidden &&
            hidden !== input
        ) {

            hidden.value =
                "";

        }


        showDropdown();


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

        const input =
            event?.target ||
            getSearchInput();


        const keyword =
            input?.value ??
            "";


        showDropdown();


        if (
            catalogLoaded
        ) {

            return render(
                keyword
            );

        }


        renderAfterCatalog(
            keyword
        )
            .then(
                function () {

                    const currentInput =
                        getSearchInput();


                    if (
                        currentInput &&
                        document.activeElement ===
                            currentInput
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
            items.length ===
            0
        ) {

            if (
                event.key ===
                "Escape"
            ) {

                hideDropdown();

            }


            return;

        }


        let index =
            items.findIndex(
                function (
                    item
                ) {

                    return (
                        item.classList.contains(
                            "active"
                        )
                    );

                }
            );


        if (
            event.key ===
            "ArrowDown"
        ) {

            event.preventDefault();


            index =
                index < 0
                    ? 0
                    : Math.min(
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
                    function (
                        item
                    ) {

                        return (
                            item.classList.contains(
                                "active"
                            )
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

            event.preventDefault();

            hideDropdown();

        }

    }


    function setActiveResult(
        items,
        index
    ) {

        items.forEach(
            function (
                item
            ) {

                item.classList.remove(
                    "active"
                );


                item.setAttribute(
                    "aria-selected",
                    "false"
                );

            }
        );


        const item =
            items[index];


        if (
            !item
        ) {

            return;

        }


        item.classList.add(
            "active"
        );


        item.setAttribute(
            "aria-selected",
            "true"
        );


        try {

            item.scrollIntoView({
                block:
                    "nearest"
            });

        } catch (_) {

            /* ignore */

        }

    }


    /* =====================================================
       CHOOSE MODEL
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
         * Selection hanya boleh berasal
         * dari catalog.
         */
        const model =
            findModelById(
                id
            );


        if (
            !model
        ) {

            console.warn(
                "[GEN-Z.AI] Model tidak terdapat di catalog:",
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
         * Hanya Model aktif yang dapat
         * dipilih melalui search.
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
                "[GEN-Z.AI] GENZModelSearchSelect.selectModel() belum tersedia."
            );


            return false;

        }


        try {

            const result =
                selector.selectModel(
                    model
                );


            if (
                result === false
            ) {

                return false;

            }


            selectedModel =
                model;


            hideDropdown();


            return true;

        } catch (
            error
        ) {

            console.error(
                "[GEN-Z.AI] Selection Model gagal:",
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
            typeof target.closest ===
                "function"
                ? target.closest(
                    ".model-search-item"
                )
                : null;


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

        selectedModel =
            null;


        /*
         * Jangan membuat Model baru.
         * Hanya membersihkan selection lama.
         */
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
                    "[GEN-Z.AI] Gagal membersihkan Model selection:",
                    error
                );

            }

        }


        const input =
            getSearchInput();


        if (
            !input
        ) {

            hideDropdown();

            return false;

        }


        if (
            catalogLoaded
        ) {

            return render(
                input.value
            );

        }


        renderAfterCatalog(
            input.value
        );


        return true;

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

            } catch (
                error
            ) {

                console.warn(
                    "[GEN-Z.AI] Show Model dropdown gagal:",
                    error
                );

            }

        }


        const box =
            getResultsBox();


        if (
            !box
        ) {

            return false;

        }


        box.hidden =
            false;


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

            } catch (
                error
            ) {

                console.warn(
                    "[GEN-Z.AI] Hide Model dropdown gagal:",
                    error
                );

            }

        }


        const box =
            getResultsBox();


        if (
            !box
        ) {

            return false;

        }


        box.hidden =
            true;


        box.setAttribute(
            "aria-hidden",
            "true"
        );


        return true;

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
         * Catalog dimuat melalui Data layer.
         */
        ensureCatalog(
            options
        )
            .then(
                function (
                    loaded
                ) {

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
                function (
                    error
                ) {

                    console.error(
                        "[GEN-Z.AI] Background Model catalog error:",
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


        models =
            [];


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

            showDropdown,

            hideDropdown,

            updateSelectedModelInfo:
                function (
                    model
                ) {

                    if (
                        !model
                    ) {

                        selectedModel =
                            null;

                        return false;

                    }


                    const modelId =
                        cleanString(
                            model.model_id ??
                            model.modelId
                        );


                    if (
                        !modelId
                    ) {

                        return false;

                    }


                    const catalogModel =
                        findModelById(
                            modelId
                        );


                    if (
                        !catalogModel
                    ) {

                        return false;

                    }


                    selectedModel =
                        catalogModel;


                    return true;

                },

            clearSelectedModelInfo:
                function () {

                    selectedModel =
                        null;

                    return true;

                },

            getSelectedModel:
                function () {

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


                    return modelId
                        ? findModelById(
                            modelId
                        )
                        : null;

                },

            providerMatches,

            getSelectedProvider

        });


    console.info(
        "[GEN-Z.AI] GENZModelsSearch loaded."
    );

})();
