/* =========================================================
   GEN-Z.AI
   MODEL SEARCH SELECT
   ---------------------------------------------------------
   File:
   admin-control/models/functions/model-search-select.js

   Tanggung jawab:
   - Memilih Model dari hasil katalog
   - Mengisi Model ID
   - Mengisi input pencarian
   - Menampilkan informasi Model
   - Sinkronisasi Provider
   - Menjaga selection tetap berasal dari catalog

   Tidak bertanggung jawab:
   - Search
   - Query Supabase
   - CRUD
   - Membuat Model baru
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


    /* =====================================================
       GET HIDDEN MODEL INPUT
    ===================================================== */

    function getHiddenInput() {

        return (
            document.getElementById(
                "modelCode"
            ) ||
            document.getElementById(
                "modelId"
            )
        );
    }


    /* =====================================================
       GET SEARCH INPUT
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
            )
        );
    }


    /* =====================================================
       GET PROVIDER SELECT
    ===================================================== */

    function getProviderSelect() {

        return document.getElementById(
            "providerId"
        );
    }


    /* =====================================================
       MODEL ID
    ===================================================== */

    function getModelId(model) {

        if (
            !model ||
            typeof model !== "object"
        ) {

            return "";
        }

        return cleanString(
            model.model_id ??
            model.modelId
        );
    }


    /* =====================================================
       PROVIDER VALUES
    ===================================================== */

    function getModelProviderValues(model) {

        if (
            !model ||
            typeof model !== "object"
        ) {

            return [];
        }

        return [
            model.provider_id,
            model.providerId,
            model.provider_uuid,
            model.providerUuid,
            model.provider
        ]
            .map(normalizeString)
            .filter(Boolean);
    }


    function getProviderValues(provider) {

        if (
            !provider ||
            typeof provider !== "object"
        ) {

            return [];
        }

        return [
            provider.id,
            provider.provider_id,
            provider.provider_name,
            provider.name
        ]
            .map(normalizeString)
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
       FIND PROVIDER
    ===================================================== */

    function findProvider(model) {

        const providerModule =
            getProviderModule();


        if (
            !providerModule
        ) {

            return null;
        }


        if (
            typeof providerModule.getProviders !==
            "function"
        ) {

            return null;
        }


        let providers = [];

        try {

            providers =
                providerModule.getProviders();

        } catch (error) {

            console.warn(
                "[GEN-Z.AI] Gagal mengambil daftar Provider:",
                error
            );

            return null;
        }


        if (
            !Array.isArray(providers)
        ) {

            return null;
        }


        const modelValues =
            getModelProviderValues(
                model
            );


        if (
            modelValues.length === 0
        ) {

            return null;
        }


        /*
         * Prioritas:
         *
         * 1. UUID / DB ID
         * 2. provider_id
         *
         * Nama provider hanya digunakan sebagai
         * fallback kompatibilitas.
         */
        for (
            const provider of providers
        ) {

            const values =
                getProviderValues(
                    provider
                );


            if (
                values.length === 0
            ) {

                continue;
            }


            if (
                modelValues.some(
                    function (value) {

                        return values.includes(
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
       
       Selection hanya boleh berasal dari
       GENZModelsSearch catalog.
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
            search &&
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
         * Jika search module belum tersedia,
         * jangan mengarang data.
         */
        return null;
    }


    /* =====================================================
       PROVIDER SELECT VALUE
    ===================================================== */

    function resolveProviderSelectValue(
        provider
    ) {

        if (
            !provider ||
            typeof provider !== "object"
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
            provider.provider_id
        ]
            .map(cleanString)
            .filter(Boolean);


        /*
         * Pastikan value benar-benar ada
         * pada option Provider.
         */
        for (
            const candidate of candidates
        ) {

            const option =
                Array.from(
                    select.options
                ).find(
                    function (item) {

                        return (
                            cleanString(
                                item.value
                            ) === candidate
                        );
                    }
                );


            if (
                option
            ) {

                return candidate;
            }
        }


        /*
         * Fallback case-insensitive.
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
                    select.options
                ).find(
                    function (item) {

                        return (
                            normalizeString(
                                item.value
                            ) === normalized
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

            return false;
        }


        const select =
            getProviderSelect();


        const providerValue =
            resolveProviderSelectValue(
                provider
            );


        /*
         * Jangan mengisi Provider dengan value
         * yang tidak tersedia pada select.
         */
        if (
            !select ||
            !providerValue
        ) {

            return false;
        }


        /*
         * Gunakan module Provider jika tersedia.
         */
        const providerModule =
            getProviderModule();


        if (
            providerModule &&
            typeof providerModule.setValue ===
            "function"
        ) {

            try {

                const result =
                    providerModule.setValue(
                        providerValue
                    );


                if (
                    result !== false
                ) {

                    return true;
                }

            } catch (error) {

                console.warn(
                    "[GEN-Z.AI] Provider module setValue gagal:",
                    error
                );
            }
        }


        /*
         * Fallback langsung ke select.
         */
        if (
            select.value !==
            providerValue
        ) {

            select.value =
                providerValue;


            select.dispatchEvent(
                new Event(
                    "change",
                    {
                        bubbles:
                            true
                    }
                )
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
            cleanString(
                model?.model_name ??
                model?.modelName ??
                model?.name
            );


        const family =
            cleanString(
                model?.model_family ??
                model?.modelFamily ??
                model?.family
            );


        const provider =
            cleanString(
                model?.provider_name ??
                model?.providerName ??
                model?.provider_id ??
                model?.provider
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
       UPDATE INPUTS
    ===================================================== */

    function updateInputs(
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


        const hiddenInput =
            getHiddenInput();


        const searchInput =
            getSearchInput();


        if (
            hiddenInput
        ) {

            hiddenInput.value =
                id;

            /*
             * Jangan dispatch input/change ke hidden
             * karena dapat memicu event loop pada
             * form coordinator.
             */
        }


        if (
            searchInput
        ) {

            searchInput.value =
                id;
        }


        return true;
    }


    /* =====================================================
       SELECT MODEL
    ===================================================== */

    function selectModel(
        model
    ) {

        if (
            !model ||
            typeof model !== "object"
        ) {

            return false;
        }


        const modelId =
            getModelId(
                model
            );


        if (
            !modelId
        ) {

            return false;
        }


        /*
         * Sangat penting:
         *
         * Model yang dipilih harus berasal
         * dari katalog yang telah dimuat.
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
                modelId
            );

            return false;
        }


        /*
         * Gunakan object catalog sebagai
         * satu-satunya source untuk selection.
         */
        const selectedModel =
            catalogModel;


        const selectedId =
            getModelId(
                selectedModel
            );


        /*
         * Isi Model ID.
         */
        updateInputs(
            selectedId
        );


        /*
         * Tampilkan informasi Model.
         */
        updateInfoBox(
            selectedModel
        );


        /*
         * Sinkronkan Provider.
         *
         * Jika Provider tidak ditemukan,
         * jangan membuat Provider baru.
         */
        syncProvider(
            selectedModel
        );


        /*
         * Tutup dropdown setelah selection.
         */
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


        /*
         * Beri tahu module lain bahwa Model
         * telah dipilih.
         */
        try {

            document.dispatchEvent(
                new CustomEvent(
                    "genz-model-selected",
                    {
                        detail: {
                            model:
                                selectedModel,

                            modelId:
                                selectedId
                        }
                    }
                )
            );

        } catch (error) {

            console.warn(
                "[GEN-Z.AI] Event genz-model-selected gagal:",
                error
            );
        }


        return true;
    }


    /* =====================================================
       CLEAR SELECTED
    ===================================================== */

    function clearSelected() {

        const hiddenInput =
            getHiddenInput();


        const searchInput =
            getSearchInput();


        const infoBox =
            getInfoBox();


        if (
            hiddenInput
        ) {

            hiddenInput.value =
                "";
        }


        if (
            searchInput
        ) {

            searchInput.value =
                "";
        }


        if (
            infoBox
        ) {

            infoBox.textContent =
                "Belum ada model dipilih.";
        }


        return true;
    }


    /* =====================================================
       GET SELECTED
    ===================================================== */

    function getSelectedModel() {

        const hiddenInput =
            getHiddenInput();


        const modelId =
            cleanString(
                hiddenInput?.value
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

            findProvider

        });


    console.info(
        "[GEN-Z.AI] GENZModelSearchSelect loaded."
    );

})();
