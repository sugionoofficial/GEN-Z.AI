/* =========================================================
   GEN-Z.AI
   MODEL SEARCH SELECT
   ---------------------------------------------------------
   Tanggung jawab:
   - Memilih model
   - Mengisi modelCode
   - Mengisi input pencarian
   - Menampilkan informasi model
   - Sinkronisasi Provider
   ---------------------------------------------------------
   Tidak melakukan pencarian.
   ========================================================= */

(function () {
    "use strict";

    function getHiddenInput() {
        return (
            document.getElementById("modelCode") ||
            document.getElementById("modelId")
        );
    }

    function getSearchInput() {
        return (
            document.getElementById("modelCodeSearch") ||
            document.getElementById("modelSearch") ||
            document.getElementById("modelIdSearch")
        );
    }

    function getInfoBox() {
        return (
            document.getElementById("selectedModelInfo") ||
            document.getElementById("modelSelectedInfo")
        );
    }

    function findProvider(model) {

        const providerModule =
            window.GENZModelsProvider;

        if (
            !providerModule ||
            typeof providerModule.getProviders !== "function"
        ) {
            return null;
        }

        const values = [
            model?.provider_id,
            model?.providerId,
            model?.provider,
            model?.provider_name,
            model?.providerName
        ]
            .map(function (value) {
                return String(
                    value ?? ""
                )
                    .trim()
                    .toLowerCase();
            })
            .filter(Boolean);

        const providers =
            providerModule.getProviders();

        return (
            providers.find(
                function (provider) {

                    const providerValues = [
                        provider.id,
                        provider.provider_id,
                        provider.provider_name,
                        provider.name
                    ]
                        .map(function (value) {
                            return String(
                                value ?? ""
                            )
                                .trim()
                                .toLowerCase();
                        })
                        .filter(Boolean);

                    return values.some(
                        function (value) {
                            return providerValues.includes(
                                value
                            );
                        }
                    );
                }
            ) || null
        );
    }

    function selectModel(model) {

        if (!model) {
            return false;
        }

        const modelId =
            String(
                model.model_id ??
                model.modelId ??
                ""
            ).trim();

        if (!modelId) {
            return false;
        }

        const hiddenInput =
            getHiddenInput();

        const searchInput =
            getSearchInput();

        const infoBox =
            getInfoBox();

        if (hiddenInput) {
            hiddenInput.value = modelId;
        }

        if (searchInput) {
            searchInput.value = modelId;
        }

        if (infoBox) {

            const name =
                String(
                    model.model_name ?? ""
                ).trim();

            const family =
                String(
                    model.model_family ?? ""
                ).trim();

            const provider =
                String(
                    model.provider_name ??
                    model.provider_id ??
                    model.provider ??
                    ""
                ).trim();

            infoBox.textContent =
                [
                    name || modelId,
                    family,
                    provider
                ]
                    .filter(Boolean)
                    .join(" · ");
        }

        const provider =
            findProvider(model);

        if (
            provider &&
            window.GENZModelsProvider &&
            typeof window.GENZModelsProvider.setValue ===
                "function"
        ) {

            window.GENZModelsProvider.setValue(
                String(
                    provider.id ??
                    provider.provider_id ??
                    ""
                )
            );
        }

        window.GENZModelSearchDropdown.hide();

        document.dispatchEvent(
            new CustomEvent(
                "genz-model-selected",
                {
                    detail: {
                        model,
                        modelId
                    }
                }
            )
        );

        return true;
    }

    function clearSelected() {

        const hiddenInput =
            getHiddenInput();

        const searchInput =
            getSearchInput();

        const infoBox =
            getInfoBox();

        if (hiddenInput) {
            hiddenInput.value = "";
        }

        if (searchInput) {
            searchInput.value = "";
        }

        if (infoBox) {
            infoBox.textContent =
                "Belum ada model dipilih.";
        }
    }

    window.GENZModelSearchSelect =
        Object.freeze({
            selectModel,
            clearSelected
        });

})();
