/* =========================================================
   GEN-Z.AI
   MODEL PROVIDER DROPDOWN
   ---------------------------------------------------------
   Tanggung jawab:
   - Render dropdown Provider
   - Set Provider
   - Clear Provider
   - Refresh dropdown
   ---------------------------------------------------------
   Tidak mengurus:
   - Model Search
   - Form
   - Price
   - CRUD Model
   ========================================================= */

(function () {
    "use strict";

    let providers = [];

    function getSelect() {
        return document.getElementById("providerId");
    }

    function normalizeProvider(provider) {
        if (!provider) {
            return null;
        }

        return {
            id: String(
                provider.id ??
                provider.provider_id ??
                ""
            ).trim(),

            provider_id: String(
                provider.provider_id ??
                provider.id ??
                ""
            ).trim(),

            provider_name: String(
                provider.provider_name ??
                provider.name ??
                provider.provider_id ??
                provider.id ??
                ""
            ).trim(),

            status: String(
                provider.status ??
                "active"
            ).trim()
        };
    }

    function normalizeProviders(list) {
        if (!Array.isArray(list)) {
            return [];
        }

        return list
            .map(normalizeProvider)
            .filter(function (provider) {
                return provider && provider.id;
            });
    }

    function isActive(provider) {
        const status =
            String(
                provider?.status ?? ""
            )
            .trim()
            .toLowerCase();

        return (
            !status ||
            status === "active" ||
            status === "enabled"
        );
    }

    function render(list) {
        const select = getSelect();

        if (!select) {
            return false;
        }

        providers =
            normalizeProviders(list);

        const currentValue =
            String(
                select.value ?? ""
            ).trim();

        select.innerHTML = "";

        const placeholder =
            document.createElement("option");

        placeholder.value = "";
        placeholder.textContent =
            "Pilih Provider";

        select.appendChild(
            placeholder
        );

        providers
            .filter(isActive)
            .forEach(function (provider) {

                const option =
                    document.createElement("option");

                option.value =
                    provider.id;

                option.textContent =
                    provider.provider_name ||
                    provider.provider_id ||
                    provider.id;

                option.dataset.providerId =
                    provider.provider_id;

                select.appendChild(option);
            });

        if (
            currentValue &&
            Array.from(select.options)
                .some(function (option) {
                    return option.value === currentValue;
                })
        ) {
            select.value = currentValue;
        }

        return true;
    }

    function setProviders(list) {
        return render(list);
    }

    function getProviders() {
        return providers.slice();
    }

    function getSelected() {
        const select = getSelect();

        if (!select || !select.value) {
            return null;
        }

        return (
            providers.find(
                function (provider) {
                    return (
                        provider.id ===
                        select.value
                    );
                }
            ) || null
        );
    }

    function setValue(providerId) {
        const select = getSelect();

        if (!select) {
            return false;
        }

        const value =
            String(
                providerId ?? ""
            ).trim();

        if (!value) {
            select.value = "";
            return true;
        }

        const exists =
            Array.from(
                select.options
            ).some(function (option) {
                return (
                    option.value === value
                );
            });

        if (!exists) {
            return false;
        }

        select.value = value;

        document.dispatchEvent(
            new CustomEvent(
                "genz-models-provider-changed",
                {
                    detail: {
                        providerId: value
                    }
                }
            )
        );

        return true;
    }

    function clear() {
        const select = getSelect();

        if (!select) {
            return false;
        }

        select.value = "";

        document.dispatchEvent(
            new CustomEvent(
                "genz-models-provider-changed",
                {
                    detail: {
                        providerId: ""
                    }
                }
            )
        );

        return true;
    }

    function refresh() {
        const data =
            window.GENZModelsData;

        if (
            !data ||
            typeof data.loadProviders !==
                "function"
        ) {
            return false;
        }

        return data
            .loadProviders({
                force: true,
                activeOnly: false
            })
            .then(function (result) {

                const list =
                    Array.isArray(result)
                        ? result
                        : [];

                render(list);

                return list;
            });
    }

    function initialize() {
        const data =
            window.GENZModelsData;

        if (
            data &&
            typeof data.getCachedProviders ===
                "function"
        ) {
            const cached =
                data.getCachedProviders();

            if (
                Array.isArray(cached) &&
                cached.length
            ) {
                render(cached);
                return true;
            }
        }

        if (
            data &&
            typeof data.loadProviders ===
                "function"
        ) {
            return data
                .loadProviders({
                    force: false,
                    activeOnly: false
                })
                .then(function (result) {

                    render(
                        Array.isArray(result)
                            ? result
                            : []
                    );

                    return true;
                });
        }

        return false;
    }

    function destroy() {
        providers = [];
    }

    window.GENZModelProviderDropdown =
        Object.freeze({
            initialize,
            render,
            setProviders,
            getProviders,
            getSelected,
            setValue,
            clear,
            refresh,
            destroy
        });

})();
