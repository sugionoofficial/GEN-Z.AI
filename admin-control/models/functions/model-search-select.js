/* =========================================================
   GEN-Z.AI
   MODEL SEARCH SELECT
   ---------------------------------------------------------
   File:
   admin-control/models/functions/model-search-select.js

   Tanggung jawab:
   - Memilih Model dari hasil catalog
   - Mengisi Model ID
   - Mengisi field Model dari hasil selection
   - Sinkronisasi Provider
   - Mengirim event Model selected
   - Menjaga selection tetap berasal dari catalog

   Tidak bertanggung jawab:
   - Search
   - Query Supabase
   - CRUD
   - Membuat Model baru

   SOURCE OF TRUTH:
   - GENZModelsSearch
   - models
   - providers
   ========================================================= */

(function () {

    "use strict";


    /* =====================================================
       HELPERS
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


    function normalizeNumber(value) {

        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {

            return null;
        }


        const number =
            Number(
                value
            );


        return Number.isFinite(
            number
        )
            ? number
            : null;
    }


    function normalizeArray(value) {

        if (
            Array.isArray(
                value
            )
        ) {

            return value
                .map(
                    cleanString
                )
                .filter(Boolean);
        }


        if (
            typeof value ===
            "string"
        ) {

            return value
                .split(",")
                .map(
                    cleanString
                )
                .filter(Boolean);
        }


        return [];
    }


    /* =====================================================
       FIELD HELPERS
    ===================================================== */

    function readField(
        model,
        keys,
        fallback = ""
    ) {

        if (
            !model ||
            typeof model !==
                "object"
        ) {

            return fallback;
        }


        for (
            const key of keys
        ) {

            if (
                Object.prototype.hasOwnProperty.call(
                    model,
                    key
                )
            ) {

                const value =
                    model[key];


                if (
                    value !== null &&
                    value !== undefined &&
                    value !== ""
                ) {

                    return value;
                }
            }
        }


        return fallback;
    }


    function readNumberField(
        model,
        keys,
        fallback = null
    ) {

        const value =
            readField(
                model,
                keys,
                null
            );


        const number =
            normalizeNumber(
                value
            );


        return number !== null
            ? number
            : fallback;
    }


    /* =====================================================
       MODEL ID
    ===================================================== */

    function getModelId(
        model
    ) {

        return cleanString(
            readField(
                model,
                [
                    "model_id",
                    "modelId",
                    "code",
                    "model_code"
                ],
                ""
            )
        );
    }


    /* =====================================================
       MODEL NAME
    ===================================================== */

    function getModelName(
        model
    ) {

        return cleanString(
            readField(
                model,
                [
                    "model_name",
                    "modelName",
                    "name"
                ],
                ""
            )
        );
    }


    /* =====================================================
       MODEL FAMILY
    ===================================================== */

    function getModelFamily(
        model
    ) {

        return cleanString(
            readField(
                model,
                [
                    "model_family",
                    "modelFamily",
                    "family"
                ],
                ""
            )
        );
    }


    /* =====================================================
       MODEL TYPE
    ===================================================== */

    function getModelType(
        model
    ) {

        return cleanString(
            readField(
                model,
                [
                    "model_type",
                    "modelType",
                    "type",
                    "category"
                ],
                ""
            )
        );
    }


    /* =====================================================
       DESCRIPTION
    ===================================================== */

    function getDescription(
        model
    ) {

        return cleanString(
            readField(
                model,
                [
                    "description"
                ],
                ""
            )
        );
    }


    /* =====================================================
       PROVIDER VALUES
    ===================================================== */

    function getModelProviderValues(
        model
    ) {

        if (
            !model ||
            typeof model !==
                "object"
        ) {

            return [];
        }


        const provider =
            model.provider &&
            typeof model.provider ===
                "object"
                ? model.provider
                : null;


        return [
            model.provider_id,
            model.providerId,
            model.provider_uuid,
            model.providerUuid,

            provider?.id,
            provider?.provider_id,
            provider?.providerId,

            model.provider_name,
            model.providerName,

            provider?.provider_name,
            provider?.providerName,
            provider?.name
        ]
            .map(
                normalizeString
            )
            .filter(Boolean);
    }


    /* =====================================================
       PROVIDER VALUES
    ===================================================== */

    function getProviderValues(
        provider
    ) {

        if (
            !provider ||
            typeof provider !==
                "object"
        ) {

            return [];
        }


        return [
            provider.id,
            provider.provider_id,
            provider.providerId,
            provider.provider_uuid,

            provider.provider_name,
            provider.providerName,
            provider.name,
            provider.code
        ]
            .map(
                normalizeString
            )
            .filter(Boolean);
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
       GET PROVIDERS
    ===================================================== */

    function getProviders() {

        const providerModule =
            getProviderModule();


        if (
            !providerModule ||
            typeof providerModule.getProviders !==
                "function"
        ) {

            return [];
        }


        try {

            const providers =
                providerModule.getProviders();


            return Array.isArray(
                providers
            )
                ? providers
                : [];

        } catch (error) {

            console.warn(
                "[GEN-Z.AI] Gagal mengambil daftar Provider:",
                error
            );


            return [];
        }
    }


    /* =====================================================
       FIND PROVIDER
    ===================================================== */

    function findProvider(
        model
    ) {

        const providers =
            getProviders();


        if (
            providers.length ===
            0
        ) {

            return null;
        }


        const modelValues =
            getModelProviderValues(
                model
            );


        if (
            modelValues.length ===
            0
        ) {

            return null;
        }


        /*
         * Prioritas pencocokan:
         *
         * 1. UUID / id
         * 2. provider_id
         * 3. provider name/code
         */
        for (
            const provider of providers
        ) {

            const providerValues =
                getProviderValues(
                    provider
                );


            if (
                providerValues.length ===
                0
            ) {

                continue;
            }


            if (
                modelValues.some(
                    function (
                        value
                    ) {

                        return providerValues.includes(
                            value
                        );
                    }
                )
            ) {

                return provider;
            }
        }


        return null;
    }


    /* =====================================================
       FIND CATALOG MODEL
    ===================================================== */

    function findCatalogModel(
        model
    ) {

        const modelId =
            getModelId(
                model
            );


        if (
            !modelId
        ) {

            return null;
        }


        const search =
            window.GENZModelsSearch;


        if (
            !search
        ) {

            return null;
        }


        /*
         * Jalur utama.
         */
        if (
            typeof search.findModelById ===
                "function"
        ) {

            try {

                const catalogModel =
                    search.findModelById(
                        modelId
                    );


                if (
                    catalogModel
                ) {

                    return catalogModel;
                }

            } catch (error) {

                console.warn(
                    "[GEN-Z.AI] Catalog Model lookup gagal:",
                    error
                );
            }
        }


        /*
         * Fallback ke catalog lokal.
         */
        if (
            typeof search.getModels ===
                "function"
        ) {

            try {

                const models =
                    search.getModels();


                if (
                    Array.isArray(
                        models
                    )
                ) {

                    const normalizedId =
                        normalizeString(
                            modelId
                        );


                    const found =
                        models.find(
                            function (
                                item
                            ) {

                                return (
                                    normalizeString(
                                        getModelId(
                                            item
                                        )
                                    ) ===
                                    normalizedId
                                );
                            }
                        );


                    if (
                        found
                    ) {

                        return found;
                    }
                }

            } catch (error) {

                console.warn(
                    "[GEN-Z.AI] Fallback catalog Model lookup gagal:",
                    error
                );
            }
        }


        return null;
    }


    /* =====================================================
       GET PROVIDER SELECT
    ===================================================== */

    function getProviderSelect() {

        return (
            document.getElementById(
                "providerId"
            ) ||

            document.getElementById(
                "provider_id"
            ) ||

            document.getElementById(
                "provider"
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


    /* =====================================================
       RESOLVE PROVIDER SELECT VALUE
    ===================================================== */

    function resolveProviderSelectValue(
        provider
    ) {

        if (
            !provider ||
            typeof provider !==
                "object"
        ) {

            return "";
        }


        const select =
            getProviderSelect();


        if (
            !select
        ) {

            return "";
        }


        const candidates = [
            provider.id,
            provider.provider_id,
            provider.providerId,
            provider.provider_uuid
        ]
            .map(
                cleanString
            )
            .filter(Boolean);


        /*
         * Exact match.
         */
        for (
            const candidate of candidates
        ) {

            const option =
                Array.from(
                    select.options || []
                ).find(
                    function (
                        item
                    ) {

                        return (
                            cleanString(
                                item.value
                            ) ===
                            candidate
                        );
                    }
                );


            if (
                option
            ) {

                return cleanString(
                    option.value
                );
            }
        }


        /*
         * Case insensitive.
         */
        for (
            const candidate of candidates
        ) {

            const normalized =
                normalizeString(
                    candidate
                );


            const option =
                Array.from(
                    select.options || []
                ).find(
                    function (
                        item
                    ) {

                        return (
                            normalizeString(
                                item.value
                            ) ===
                            normalized
                        );
                    }
                );


            if (
                option
            ) {

                return cleanString(
                    option.value
                );
            }
        }


        return "";
    }


    /* =====================================================
       SYNC PROVIDER
    ===================================================== */

    function syncProvider(
        model
    ) {

        const provider =
            findProvider(
                model
            );


        if (
            !provider
        ) {

            /*
             * Provider tidak ditemukan tidak boleh
             * membuat Provider palsu.
             */
            return false;
        }


        const select =
            getProviderSelect();


        if (
            !select
        ) {

            /*
             * Bisa saja Provider memakai custom
             * dropdown yang dikelola module Provider.
             */
            const providerModule =
                getProviderModule();


            if (
                providerModule &&
                typeof providerModule.selectProvider ===
                    "function"
            ) {

                try {

                    return (
                        providerModule.selectProvider(
                            provider
                        ) !== false
                    );

                } catch (error) {

                    console.warn(
                        "[GEN-Z.AI] Provider module selection gagal:",
                        error
                    );
                }
            }


            return false;
        }


        const providerValue =
            resolveProviderSelectValue(
                provider
            );


        if (
            !providerValue
        ) {

            return false;
        }


        /*
         * Jangan dispatch change.
         *
         * Perubahan Provider dilakukan sebagai
         * bagian dari selection Model.
         */
        try {

            select.value =
                providerValue;

        } catch (error) {

            console.warn(
                "[GEN-Z.AI] Gagal mengubah Provider:",
                error
            );


            return false;
        }


        return (
            cleanString(
                select.value
            ) ===
            providerValue
        );
    }


    /* =====================================================
       GET FIELD
    ===================================================== */

    function getField(
        ids,
        names = []
    ) {

        for (
            const id of ids
        ) {

            const element =
                document.getElementById(
                    id
                );


            if (
                element
            ) {

                return element;
            }
        }


        for (
            const name of names
        ) {

            const element =
                document.querySelector(
                    "[name='" +
                    name +
                    "']"
                );


            if (
                element
            ) {

                return element;
            }
        }


        return null;
    }


    /* =====================================================
       GET HIDDEN MODEL INPUT
    ===================================================== */

    function getHiddenInput() {

        return getField(
            [
                "modelCode"
            ],
            [
                "model_code"
            ]
        );
    }


    /* =====================================================
       GET SEARCH INPUT
    ===================================================== */

    function getSearchInput() {

        return getField(
            [
                "modelCodeSearch",
                "modelSearch",
                "modelIdSearch",
                "modelId",
                "model_id"
            ],
            [
                "model_search",
                "model_id_search",
                "modelId"
            ]
        );
    }


    /* =====================================================
       GET MODEL NAME INPUT
    ===================================================== */

    function getModelNameInput() {

        return getField(
            [
                "modelName",
                "model_name"
            ],
            [
                "model_name",
                "modelName"
            ]
        );
    }


    /* =====================================================
       GET MODEL FAMILY INPUT
    ===================================================== */

    function getModelFamilyInput() {

        return getField(
            [
                "modelFamily",
                "model_family"
            ],
            [
                "model_family",
                "modelFamily"
            ]
        );
    }


    /* =====================================================
       GET MODEL TYPE INPUT
    ===================================================== */

    function getModelTypeInput() {

        return getField(
            [
                "modelType",
                "model_type"
            ],
            [
                "model_type",
                "modelType"
            ]
        );
    }


    /* =====================================================
       GET DESCRIPTION INPUT
    ===================================================== */

    function getDescriptionInput() {

        return getField(
            [
                "description",
                "modelDescription"
            ],
            [
                "description"
            ]
        );
    }


    /* =====================================================
       GET INFO BOX
    ===================================================== */

    function getInfoBox() {

        return (
            document.getElementById(
                "selectedModelInfo"
            ) ||

            document.getElementById(
                "modelSelectedInfo"
            ) ||

            document.querySelector(
                "[data-model-selected-info]"
            ) ||

            null
        );
    }


    /* =====================================================
       UPDATE VALUE
    ===================================================== */

    function setValue(
        element,
        value
    ) {

        if (
            !element
        ) {

            return false;
        }


        const normalized =
            value === null ||
            value === undefined
                ? ""
                : String(
                    value
                );


        if (
            element.value ===
            normalized
        ) {

            return true;
        }


        element.value =
            normalized;


        return true;
    }


    /* =====================================================
       UPDATE MODEL ID
    ===================================================== */

    function updateModelId(
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


        const hidden =
            getHiddenInput();


        const search =
            getSearchInput();


        setValue(
            hidden,
            id
        );


        setValue(
            search,
            id
        );


        return true;
    }


    /* =====================================================
       UPDATE MODEL ID ALIASES
    ===================================================== */

    function updateModelIdAliases(
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


        const fields = [

            getField(
                ["modelId"],
                ["modelId"]
            ),

            getField(
                ["model_id"],
                ["model_id"]
            )

        ];


        fields.forEach(
            function (
                field
            ) {

                if (
                    field
                ) {

                    setValue(
                        field,
                        id
                    );
                }
            }
        );


        return true;
    }


    /* =====================================================
       UPDATE IDENTITY FIELDS
    ===================================================== */

    function updateIdentityFields(
        model
    ) {

        const modelName =
            getModelName(
                model
            );


        const modelFamily =
            getModelFamily(
                model
            );


        const modelType =
            getModelType(
                model
            );


        const description =
            getDescription(
                model
            );


        setValue(
            getModelNameInput(),
            modelName
        );


        setValue(
            getModelFamilyInput(),
            modelFamily
        );


        setValue(
            getModelTypeInput(),
            modelType
        );


        /*
         * Description hanya ditulis jika
         * source model memang memiliki nilai.
         */
        if (
            description
        ) {

            setValue(
                getDescriptionInput(),
                description
            );
        }


        return true;
    }


    /* =====================================================
       UPDATE INFO BOX
    ===================================================== */

    function updateInfoBox(
        model
    ) {

        const infoBox =
            getInfoBox();


        if (
            !infoBox
        ) {

            return false;
        }


        const modelId =
            getModelId(
                model
            );


        const name =
            getModelName(
                model
            );


        const family =
            getModelFamily(
                model
            );


        const provider =
            cleanString(
                readField(
                    model,
                    [
                        "provider_name",
                        "providerName"
                    ],
                    ""
                )
            );


        const parts = [];


        if (
            name
        ) {

            parts.push(
                name
            );

        } else if (
            modelId
        ) {

            parts.push(
                modelId
            );
        }


        if (
            family
        ) {

            parts.push(
                family
            );
        }


        if (
            provider
        ) {

            parts.push(
                provider
            );
        }


        infoBox.textContent =
            parts.join(
                " · "
            ) ||
            "Belum ada model dipilih.";


        return true;
    }


    /* =====================================================
       UPDATE FORM THROUGH LAYOUT
    ===================================================== */

    function updateFormThroughLayout(
        model
    ) {

        const layout =
            window.GENZModelFormLayout;


        if (
            !layout
        ) {

            return false;
        }


        const form =
            document.getElementById(
                "modelForm"
            ) ||

            document.getElementById(
                "modelsForm"
            );


        if (
            !form
        ) {

            return false;
        }


        if (
            typeof layout.updateSelectedModelFields ===
                "function"
        ) {

            try {

                const result =
                    layout.updateSelectedModelFields(
                        form,
                        [model]
                    );


                return result !== false;

            } catch (error) {

                console.warn(
                    "[GEN-Z.AI] Layout gagal memperbarui field Model:",
                    error
                );


                return false;
            }
        }


        return false;
    }


    /* =====================================================
       HIDE DROPDOWN
    ===================================================== */

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

            } catch (error) {

                console.warn(
                    "[GEN-Z.AI] Gagal menutup Model dropdown:",
                    error
                );
            }
        }
    }


    /* =====================================================
       DISPATCH SELECTION EVENT
    ===================================================== */

    function dispatchSelectionEvent(
        model
    ) {

        const modelId =
            getModelId(
                model
            );


        try {

            document.dispatchEvent(
                new CustomEvent(
                    "genz-model-selected",
                    {
                        detail: {

                            model:
                                model,

                            modelId:
                                modelId,

                            model_id:
                                modelId
                        }
                    }
                )
            );


            return true;

        } catch (error) {

            console.warn(
                "[GEN-Z.AI] Event genz-model-selected gagal:",
                error
            );


            return false;
        }
    }


    /* =====================================================
       SELECT MODEL
    ===================================================== */

    function selectModel(
        model
    ) {

        if (
            !model ||
            typeof model !==
                "object"
        ) {

            return false;
        }


        const requestedId =
            getModelId(
                model
            );


        if (
            !requestedId
        ) {

            console.warn(
                "[GEN-Z.AI] Selection ditolak. Model ID kosong."
            );


            return false;
        }


        /*
         * SOURCE OF TRUTH:
         * selalu ambil ulang object dari catalog.
         *
         * Object yang datang dari UI tidak dipercaya
         * sebagai sumber identitas Model.
         */
        const catalogModel =
            findCatalogModel(
                model
            );


        if (
            !catalogModel
        ) {

            console.warn(
                "[GEN-Z.AI] Selection ditolak. Model tidak terdapat di catalog:",
                requestedId
            );


            return false;
        }


        const selectedId =
            getModelId(
                catalogModel
            );


        if (
            !selectedId
        ) {

            return false;
        }


        /*
         * Pastikan ID benar-benar sama.
         */
        if (
            normalizeString(
                selectedId
            ) !==
            normalizeString(
                requestedId
            )
        ) {

            console.warn(
                "[GEN-Z.AI] Selection ditolak. Model ID catalog berbeda."
            );


            return false;
        }


        /* =================================================
           1. PROVIDER
           ================================================= */

        syncProvider(
            catalogModel
        );


        /* =================================================
           2. MODEL ID
           ================================================= */

        updateModelId(
            selectedId
        );


        updateModelIdAliases(
            selectedId
        );


        /* =================================================
           3. MODEL IDENTITY
           ================================================= */

        updateIdentityFields(
            catalogModel
        );


        /* =================================================
           4. FORM LAYOUT
           ================================================= */

        updateFormThroughLayout(
            catalogModel
        );


        /* =================================================
           5. INFO BOX
           ================================================= */

        updateInfoBox(
            catalogModel
        );


        /* =================================================
           6. HIDE DROPDOWN
           ================================================= */

        hideDropdown();


        /* =================================================
           7. NOTIFY
           ================================================= */

        dispatchSelectionEvent(
            catalogModel
        );


        console.info(
            "[GEN-Z.AI] Model selected:",
            selectedId
        );


        return true;
    }


    /* =====================================================
       CLEAR SELECTED
    ===================================================== */

    function clearSelected() {

        const fields = [

            getHiddenInput(),

            getSearchInput(),

            getField(
                ["modelId"],
                ["modelId"]
            ),

            getField(
                ["model_id"],
                ["model_id"]
            )

        ];


        /*
         * Deduplicate elements.
         */
        const uniqueFields =
            Array.from(
                new Set(
                    fields.filter(Boolean)
                )
            );


        uniqueFields.forEach(
            function (
                field
            ) {

                setValue(
                    field,
                    ""
                );
            }
        );


        const infoBox =
            getInfoBox();


        if (
            infoBox
        ) {

            infoBox.textContent =
                "Belum ada model dipilih.";
        }


        hideDropdown();


        return true;
    }


    /* =====================================================
       GET SELECTED MODEL
    ===================================================== */

    function getSelectedModel() {

        const hiddenInput =
            getHiddenInput();


        const searchInput =
            getSearchInput();


        const modelId =
            cleanString(
                hiddenInput?.value ||
                searchInput?.value
            );


        if (
            !modelId
        ) {

            return null;
        }


        const search =
            window.GENZModelsSearch;


        if (
            search &&
            typeof search.findModelById ===
                "function"
        ) {

            try {

                return (
                    search.findModelById(
                        modelId
                    ) ||
                    null
                );

            } catch (error) {

                console.warn(
                    "[GEN-Z.AI] Gagal mengambil selected Model:",
                    error
                );
            }
        }


        return null;
    }


    /* =====================================================
       PUBLIC API
    ===================================================== */

    window.GENZModelSearchSelect =
        Object.freeze({

            selectModel,

            clearSelected,

            getSelectedModel,

            findProvider,

            findCatalogModel

        });


    console.info(
        "[GEN-Z.AI] GENZModelSearchSelect loaded."
    );

})();
