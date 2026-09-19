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
            typeof model !==
                "object"
        ) {

            return "";
        }

        return cleanString(
            model.model_id ??
            model.modelId
        );
    }


    /* =====================================================
       MODEL PROVIDER VALUES
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
            provider?.provider_id
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
            provider.provider_name,
            provider.name
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
       FIND PROVIDER
       ===================================================== */

    function findProvider(
        model
    ) {

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
         * 1. Database UUID
         * 2. provider_id
         *
         * Nama hanya fallback.
         */
        for (
            const provider of providers
        ) {

            const providerValues =
                getProviderValues(
                    provider
                );


            if (
                providerValues.length === 0
            ) {

                continue;
            }


            if (
                modelValues.some(
                    function (value) {

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
            !search ||
            typeof search.findModelById !==
                "function"
        ) {

            return null;
        }


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


        return null;
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

            provider.provider_id

        ]
            .map(
                cleanString
            )
            .filter(Boolean);


        /*
         * Exact match terlebih dahulu.
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
                            ) ===
                            candidate
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
         * Case insensitive fallback.
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
       -----------------------------------------------------
       IMPORTANT:
       Tidak dispatch "change".

       Selection Model sedang melakukan sinkronisasi
       internal. Dispatch change akan masuk kembali
       ke model-search-events dan dapat menghapus
       Model yang baru dipilih.
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


        if (
            !select
        ) {

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
         * Jika sudah sama, tidak perlu melakukan
         * apa pun.
         */
        if (
            cleanString(
                select.value
            ) ===
            providerValue
        ) {

            return true;
        }


        /*
         * Gunakan Provider module hanya jika
         * tersedia dan tidak menyebabkan event
         * recursive.
         *
         * Karena kita tidak mengetahui apakah
         * setValue() melakukan dispatch change,
         * direct assignment digunakan sebagai
         * jalur aman.
         */
        try {

            select.value =
                providerValue;

        } catch (error) {

            console.warn(
                "[GEN-Z.AI] Gagal mengubah Provider select:",
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
                model?.provider?.provider_name ??
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


        /*
         * Hidden Model ID.
         */
        if (
            hiddenInput
        ) {

            hiddenInput.value =
                id;
        }


        /*
         * Search display.
         */
        if (
            searchInput
        ) {

            searchInput.value =
                id;
        }


        /*
         * Sengaja TIDAK dispatch input/change.
         *
         * Dispatch di sini bisa memanggil search
         * lagi dan membuat event chain recursive.
         */
        return true;
    }


    /* =====================================================
       CLEAR DROPDOWN
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
         * Jangan menerima object arbitrary.
         *
         * Model wajib berasal dari catalog
         * GENZModelsSearch.
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


        const selectedModel =
            catalogModel;


        const selectedId =
            getModelId(
                selectedModel
            );


        if (
            !selectedId
        ) {

            return false;
        }


        /*
         * 1. Sinkronkan Provider terlebih dahulu.
         *
         * Tidak menghasilkan event change.
         */
        syncProvider(
            selectedModel
        );


        /*
         * 2. Isi Model ID.
         */
        updateInputs(
            selectedId
        );


        /*
         * 3. Update informasi Model.
         */
        updateInfoBox(
            selectedModel
        );


        /*
         * 4. Tutup dropdown.
         */
        hideDropdown();


        /*
         * 5. Notify module lain.
         *
         * Event ini hanya satu arah.
         * Tidak mengubah selection kembali.
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
       GET SELECTED MODEL
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
