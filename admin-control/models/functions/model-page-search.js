/* =========================================================
   GEN-Z.AI
   MODEL PAGE SEARCH & FILTER
   ---------------------------------------------------------
   File:
   admin-control/models/functions/model-page-search.js

   TANGGUNG JAWAB:
   - Search utama halaman Models (#modelSearch / #searchInput)
   - Filter Status (#modelStatusFilter / #statusFilter)
   - Filter Provider (#modelProviderFilter / #providerFilter)
   - Mengisi daftar opsi Provider secara dinamis dari
     GENZModelsProvider + katalog model aktif/nonaktif
   - Filter Model ID, Model Name, Model Family, Provider

   TIDAK BERTANGGUNG JAWAB:
   - Search Model ID pada Form Modal
   - Model CRUD / Provider CRUD
   - Pricing
   - Authorization / Role

   SUMBER DATA:
   GENZModelsData & GENZModelsProvider

   RENDER:
   GENZModelTable / GENZModelsTable
========================================================= */

(function () {

    "use strict";


    /* =====================================================
       STATE
    ===================================================== */

    let initialized = false;

    let bound = false;

    let boundElements = {
        input: null,
        status: null,
        provider: null
    };

    let handlers = null;

    let models = [];

    let hasExplicitModels = false;

    let providers = [];


    /* =====================================================
       MODULE ACCESS
    ===================================================== */

    function getDataModule() {

        return (
            window.GENZModelsData ||
            null
        );

    }


    function getProviderModule() {

        return (
            window.GENZModelsProvider ||
            null
        );

    }


    function getUIModule() {

        return (
            window.GENZModelsUI ||
            null
        );

    }


    function getTableModule() {

        return (
            window.GENZModelsTable ||
            window.GENZModelTable ||
            null
        );

    }


    /* =====================================================
       DOM
    ===================================================== */

    function getSearchInput() {

        return (
            document.getElementById("modelSearch") ||
            document.getElementById("searchInput") ||
            null
        );

    }


    function getStatusFilter() {

        return (
            document.getElementById("modelStatusFilter") ||
            document.getElementById("statusFilter") ||
            null
        );

    }


    function getProviderFilter() {

        return (
            document.getElementById("modelProviderFilter") ||
            document.getElementById("providerFilter") ||
            null
        );

    }


    /* =====================================================
       NORMALIZATION
    ===================================================== */

    function trimString(value) {

        return String(value ?? "").trim();

    }


    function normalizeString(value) {

        return trimString(value).toLowerCase();

    }


    function isUuidLike(value) {

        const text = trimString(value);

        if (!text) {
            return false;
        }

        return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
            .test(text);

    }


    function normalizeModel(model) {

        if (
            !model ||
            typeof model !== "object"
        ) {

            return null;

        }


        const providerObj =
            (
                model.provider &&
                typeof model.provider === "object"
            )
                ? model.provider
                : null;


        const rawProviderId =
            trimString(
                model.provider_id ??
                providerObj?.id ??
                ""
            );


        const rawProviderCode =
            trimString(
                model.provider_code ??
                model.providerCode ??
                model.providerId ??
                providerObj?.provider_id ??
                providerObj?.provider_code ??
                providerObj?.code ??
                (
                    !isUuidLike(rawProviderId)
                        ? rawProviderId
                        : ""
                )
            );


        let rawProviderName =
            trimString(
                model.provider_name ??
                model.providerName ??
                providerObj?.provider_name ??
                providerObj?.name ??
                ""
            );


        if (
            !rawProviderName &&
            typeof model.provider === "string"
        ) {

            rawProviderName =
                trimString(model.provider);

        }


        if (!rawProviderName) {

            rawProviderName =
                rawProviderCode ||
                rawProviderId ||
                "";

        }


        return {

            ...model,

            id:
                model.id ??
                "",

            model_id:
                trimString(
                    model.model_id ??
                    model.modelId ??
                    ""
                ),

            model_name:
                trimString(
                    model.model_name ??
                    model.modelName ??
                    model.name ??
                    ""
                ),

            model_family:
                trimString(
                    model.model_family ??
                    model.modelFamily ??
                    model.family ??
                    ""
                ),

            provider_id:
                rawProviderId ||
                rawProviderCode ||
                "",

            provider_code:
                rawProviderCode,

            provider_name:
                rawProviderName,

            status:
                trimString(
                    model.status ??
                    "active"
                ) || "active"

        };

    }


    function normalizeModels(list) {

        if (!Array.isArray(list)) {

            return [];

        }


        return list
            .map(normalizeModel)
            .filter(function (model) {

                return (
                    !!model &&
                    !!trimString(model.model_id)
                );

            });

    }


    function normalizeProviderRecord(provider) {

        if (
            !provider ||
            typeof provider !== "object"
        ) {

            return null;

        }


        const databaseId =
            trimString(
                provider.id ??
                provider.uuid ??
                provider.provider_uuid ??
                provider.databaseId ??
                ""
            );


        const codeCandidate =
            trimString(
                provider.provider_id ??
                provider.provider_code ??
                provider.providerCode ??
                provider.providerId ??
                provider.code ??
                (
                    typeof provider.provider === "string"
                        ? provider.provider
                        : ""
                )
            );


        const providerCode =
            !isUuidLike(codeCandidate)
                ? codeCandidate
                : "";


        const providerName =
            trimString(
                provider.provider_name ??
                provider.providerName ??
                provider.name ??
                provider.display_name ??
                provider.displayName ??
                providerCode ??
                databaseId
            );


        if (
            !databaseId &&
            !providerCode &&
            !providerName
        ) {

            return null;

        }


        return {
            id: databaseId,
            provider_id: providerCode,
            provider_name: providerName,
            status: trimString(provider.status ?? "active") || "active"
        };

    }


    function normalizeProviders(list) {

        if (!Array.isArray(list)) {

            return [];

        }


        return list
            .map(normalizeProviderRecord)
            .filter(Boolean);

    }


    /* =====================================================
       SOURCE DATA
    ===================================================== */

    function loadSourceModels() {

        if (hasExplicitModels) {

            return [...models];

        }


        const data =
            getDataModule();


        if (
            data &&
            typeof data.getCachedModels === "function"
        ) {

            try {

                const cached =
                    data.getCachedModels();


                if (Array.isArray(cached)) {

                    models =
                        normalizeModels(cached);

                    return [...models];

                }

            } catch (error) {

                console.warn(
                    "[GEN-Z.AI] Model page search source error:",
                    error
                );

            }

        }


        return [...models];

    }


    function loadSourceProviders() {

        const merged = [
            ...providers
        ];


        const providerModule =
            getProviderModule();


        if (
            providerModule &&
            typeof providerModule.getProviders === "function"
        ) {

            try {

                const list =
                    providerModule.getProviders();

                if (Array.isArray(list) && list.length > 0) {

                    merged.push(
                        ...normalizeProviders(list)
                    );

                }

            } catch (error) {

                console.warn(
                    "[GEN-Z.AI] Model page search provider source warning:",
                    error
                );

            }

        }


        const uiModule =
            getUIModule();


        if (
            uiModule &&
            typeof uiModule.getProviders === "function"
        ) {

            try {

                const list =
                    uiModule.getProviders();

                if (Array.isArray(list) && list.length > 0) {

                    merged.push(
                        ...normalizeProviders(list)
                    );

                }

            } catch {
                /* ignore optional UI state warning */
            }

        }


        return merged;

    }


    /* =====================================================
       PROVIDER OPTIONS & DISAMBIGUATION
    ===================================================== */

    function collectProviderEntries(
        customProviders,
        customModels
    ) {

        const providerList =
            Array.isArray(customProviders)
                ? normalizeProviders(customProviders)
                : loadSourceProviders();


        const modelList =
            Array.isArray(customModels)
                ? normalizeModels(customModels)
                : loadSourceModels();


        const entries = [];


        function findExistingEntry(
            codeKey,
            idKey,
            nameKey
        ) {

            if (codeKey) {

                const byCode =
                    entries.find(function (entry) {
                        return entry.codes.has(codeKey);
                    });

                if (byCode) {
                    return byCode;
                }

            }


            if (idKey) {

                const byId =
                    entries.find(function (entry) {
                        return entry.ids.has(idKey);
                    });

                if (byId) {
                    return byId;
                }

            }


            if (
                !codeKey &&
                !idKey &&
                nameKey
            ) {

                const byName =
                    entries.find(function (entry) {
                        return entry.nameKey === nameKey;
                    });

                if (byName) {
                    return byName;
                }

            }


            return null;

        }


        function upsertEntry(raw) {

            const code =
                trimString(raw.code);

            const id =
                trimString(raw.id);

            const name =
                trimString(raw.name);


            const codeKey =
                normalizeString(code);

            const idKey =
                normalizeString(id);

            const nameKey =
                normalizeString(name);


            if (
                !codeKey &&
                !idKey &&
                !nameKey
            ) {
                return;
            }


            let entry =
                findExistingEntry(
                    codeKey,
                    idKey,
                    nameKey
                );


            if (!entry) {

                const canonicalKey =
                    codeKey ||
                    idKey ||
                    nameKey;

                entry = {
                    key: canonicalKey,
                    primaryCode: code,
                    primaryId: id,
                    name: name || code || id,
                    nameKey: normalizeString(name || code || id),
                    codes: new Set(),
                    ids: new Set(),
                    duplicateName: false,
                    label: name || code || id
                };

                entries.push(entry);

            } else {

                if (!entry.primaryCode && code) {
                    entry.primaryCode = code;
                    entry.key = codeKey;
                }

                if (!entry.primaryId && id) {
                    entry.primaryId = id;
                }

                if (
                    name &&
                    (
                        !entry.name ||
                        entry.name === entry.primaryCode ||
                        entry.name === entry.primaryId
                    )
                ) {
                    entry.name = name;
                    entry.nameKey = nameKey;
                }

            }


            if (codeKey) {
                entry.codes.add(codeKey);
            }

            if (idKey) {
                entry.ids.add(idKey);
            }

        }


        providerList.forEach(function (provider) {

            upsertEntry({
                code: provider.provider_id,
                id: provider.id,
                name: provider.provider_name
            });

        });


        modelList.forEach(function (model) {

            const rawId =
                trimString(model.provider_id);

            const rawCode =
                trimString(model.provider_code) ||
                (!isUuidLike(rawId) ? rawId : "");

            const rawUuid =
                isUuidLike(rawId) ? rawId : "";

            upsertEntry({
                code: rawCode,
                id: rawUuid,
                name: model.provider_name
            });

        });


        /*
         * Hitung apakah ada provider_name kembar (contoh:
         * "GEN-Z.AI" dipakai oleh "kie" dan "motiongen").
         * Jika kembar, tambahkan kode provider pada label
         * agar admin dapat memilih provider spesifik.
         */

        const nameFrequency = new Map();

        entries.forEach(function (entry) {

            const key =
                normalizeString(entry.name);

            if (!key) {
                return;
            }

            nameFrequency.set(
                key,
                (nameFrequency.get(key) || 0) + 1
            );

        });


        entries.forEach(function (entry) {

            const count =
                nameFrequency.get(
                    normalizeString(entry.name)
                ) || 0;

            entry.duplicateName =
                count > 1;

            const displayName =
                entry.name ||
                entry.primaryCode ||
                entry.primaryId;

            if (
                entry.duplicateName &&
                entry.primaryCode &&
                normalizeString(entry.primaryCode) !==
                    normalizeString(displayName)
            ) {

                entry.label =
                    displayName +
                    " (" +
                    entry.primaryCode +
                    ")";

            } else {

                entry.label =
                    displayName;

            }

        });


        entries.sort(function (a, b) {

            return a.label.localeCompare(
                b.label,
                "id",
                {
                    sensitivity: "base"
                }
            );

        });


        return entries;

    }


    function resolveProviderEntry(
        filterValue,
        entries
    ) {

        const target =
            normalizeString(filterValue);

        if (
            !target ||
            target === "all"
        ) {
            return null;
        }


        const list =
            Array.isArray(entries)
                ? entries
                : collectProviderEntries();


        const byKeyOrCodeOrId =
            list.find(function (entry) {

                return (
                    entry.key === target ||
                    entry.codes.has(target) ||
                    entry.ids.has(target) ||
                    normalizeString(entry.label) === target
                );

            });


        if (byKeyOrCodeOrId) {
            return byKeyOrCodeOrId;
        }


        const byUniqueName =
            list.filter(function (entry) {
                return entry.nameKey === target;
            });


        if (byUniqueName.length === 1) {
            return byUniqueName[0];
        }


        return null;

    }


    function populateProviderFilter(
        customProviders,
        customModels
    ) {

        const select =
            getProviderFilter();


        const entries =
            collectProviderEntries(
                customProviders,
                customModels
            );


        if (!select) {

            return entries;

        }


        const previousValue =
            trimString(select.value);


        const fragment =
            document.createDocumentFragment();


        const allOption =
            document.createElement("option");

        allOption.value = "all";
        allOption.textContent = "Semua Provider";

        fragment.appendChild(allOption);


        entries.forEach(function (entry) {

            const option =
                document.createElement("option");

            option.value =
                entry.key;

            option.textContent =
                entry.label;

            if (entry.primaryCode) {
                option.dataset.providerCode =
                    entry.primaryCode;
            }

            if (entry.primaryId) {
                option.dataset.providerUuid =
                    entry.primaryId;
            }

            if (entry.name) {
                option.dataset.providerName =
                    entry.name;
            }

            fragment.appendChild(option);

        });


        if (typeof select.replaceChildren === "function") {

            select.replaceChildren(fragment);

        } else {

            select.innerHTML = "";
            select.appendChild(fragment);

        }


        if (
            previousValue &&
            normalizeString(previousValue) !== "all"
        ) {

            const matched =
                resolveProviderEntry(
                    previousValue,
                    entries
                );

            select.value =
                matched
                    ? matched.key
                    : "all";

        } else {

            select.value = "all";

        }


        return entries;

    }


    /* =====================================================
       SET / GET MODELS & PROVIDERS
    ===================================================== */

    function setModels(list) {

        hasExplicitModels =
            Array.isArray(list);

        models =
            normalizeModels(list);

        populateProviderFilter(
            undefined,
            models
        );

        if (initialized) {

            bind();
            apply();

        }

        return [...models];

    }


    function getModels() {

        return [...models];

    }


    function setProviders(list) {

        providers =
            normalizeProviders(list);

        populateProviderFilter(
            providers,
            undefined
        );

        if (initialized) {

            bind();
            apply();

        }

        return [...providers];

    }


    function getProviders() {

        return [...providers];

    }


    /* =====================================================
       STATUS MATCHING
    ===================================================== */

    function getStatusState(status) {

        const value =
            normalizeString(status);


        if (!value) {

            return "active";

        }


        if (
            value === "inactive" ||
            value === "disabled" ||
            value === "nonaktif" ||
            value === "false"
        ) {

            return "inactive";

        }


        if (
            value === "maintenance" ||
            value === "maintain"
        ) {

            return "maintenance";

        }


        return "active";

    }


    function isActive(model) {

        return (
            getStatusState(model?.status) ===
            "active"
        );

    }


    function matchesStatus(
        model,
        status
    ) {

        const filter =
            normalizeString(status);


        if (
            !filter ||
            filter === "all"
        ) {

            return true;

        }


        const state =
            getStatusState(model?.status);


        if (filter === "active") {

            return state === "active";

        }


        if (
            filter === "inactive" ||
            filter === "disabled" ||
            filter === "nonaktif"
        ) {

            return state === "inactive";

        }


        return (
            state === filter ||
            normalizeString(model?.status) === filter
        );

    }


    /* =====================================================
       PROVIDER MATCHING
    ===================================================== */

    function matchesProvider(
        model,
        providerFilterValue,
        providerEntries
    ) {

        const filter =
            normalizeString(providerFilterValue);


        if (
            !filter ||
            filter === "all"
        ) {

            return true;

        }


        const normalized =
            normalizeModel(model);


        if (!normalized) {

            return false;

        }


        const modelCode =
            normalizeString(normalized.provider_code);

        const modelId =
            normalizeString(normalized.provider_id);

        const modelName =
            normalizeString(normalized.provider_name);


        const entry =
            resolveProviderEntry(
                filter,
                providerEntries
            );


        if (entry) {

            if (
                modelCode &&
                entry.codes.has(modelCode)
            ) {
                return true;
            }

            if (
                modelId &&
                (
                    entry.ids.has(modelId) ||
                    entry.codes.has(modelId)
                )
            ) {
                return true;
            }

            /*
             * Hanya fallback ke provider_name apabila nama
             * provider tidak duplikat dan model tidak memiliki
             * kode/ID spesifik yang bertentangan.
             */

            if (
                !entry.duplicateName &&
                !modelCode &&
                !isUuidLike(modelId) &&
                modelName &&
                modelName === entry.nameKey
            ) {
                return true;
            }

            return false;

        }


        return (
            modelCode === filter ||
            modelId === filter ||
            modelName === filter
        );

    }


    /* =====================================================
       SEARCH TEXT
    ===================================================== */

    function getSearchValues(model) {

        return [
            model?.model_id,
            model?.model_name,
            model?.model_family,
            model?.provider_name,
            model?.provider_code,
            model?.provider_id,
            model?.type
        ]
            .map(normalizeString)
            .filter(Boolean);

    }


    function matchesSearch(
        model,
        keyword
    ) {

        const term =
            normalizeString(keyword);


        if (!term) {

            return true;

        }


        const values =
            getSearchValues(model);


        return values.some(function (value) {

            return value.includes(term);

        });

    }


    /* =====================================================
       FILTER
    ===================================================== */

    function filterModels(
        list,
        keyword,
        status,
        provider
    ) {

        const source =
            normalizeModels(list);


        const providerEntries =
            collectProviderEntries(
                undefined,
                source
            );


        const filtered =
            source.filter(function (model) {

                return (
                    matchesSearch(
                        model,
                        keyword
                    ) &&
                    matchesStatus(
                        model,
                        status
                    ) &&
                    matchesProvider(
                        model,
                        provider,
                        providerEntries
                    )
                );

            });


        const term =
            normalizeString(keyword);


        if (!term) {

            return filtered;

        }


        /* =================================================
           SEARCH RANKING

           1. Exact Model ID
           2. Model ID prefix
           3. Model ID contains
           4. Model Name prefix
           5. Model Name contains
           6. Provider
           7. Alphabetical
        ================================================= */

        filtered.sort(function (a, b) {

            const aId =
                normalizeString(a.model_id);

            const bId =
                normalizeString(b.model_id);

            const aName =
                normalizeString(a.model_name);

            const bName =
                normalizeString(b.model_name);

            const aProvider =
                normalizeString(
                    a.provider_name + " " + (a.provider_code || "")
                );

            const bProvider =
                normalizeString(
                    b.provider_name + " " + (b.provider_code || "")
                );


            const aExact =
                aId === term ? 100000 : 0;

            const bExact =
                bId === term ? 100000 : 0;

            if (aExact !== bExact) {
                return bExact - aExact;
            }


            const aIdPrefix =
                aId.startsWith(term) ? 10000 : 0;

            const bIdPrefix =
                bId.startsWith(term) ? 10000 : 0;

            if (aIdPrefix !== bIdPrefix) {
                return bIdPrefix - aIdPrefix;
            }


            const aIdContains =
                aId.includes(term) ? 1000 : 0;

            const bIdContains =
                bId.includes(term) ? 1000 : 0;

            if (aIdContains !== bIdContains) {
                return bIdContains - aIdContains;
            }


            const aNamePrefix =
                aName.startsWith(term) ? 500 : 0;

            const bNamePrefix =
                bName.startsWith(term) ? 500 : 0;

            if (aNamePrefix !== bNamePrefix) {
                return bNamePrefix - aNamePrefix;
            }


            const aNameContains =
                aName.includes(term) ? 100 : 0;

            const bNameContains =
                bName.includes(term) ? 100 : 0;

            if (aNameContains !== bNameContains) {
                return bNameContains - aNameContains;
            }


            const aProviderContains =
                aProvider.includes(term) ? 50 : 0;

            const bProviderContains =
                bProvider.includes(term) ? 50 : 0;

            if (aProviderContains !== bProviderContains) {
                return bProviderContains - aProviderContains;
            }


            return aId.localeCompare(
                bId,
                "id",
                {
                    sensitivity: "base"
                }
            );

        });


        return filtered;

    }


    /* =====================================================
       TABLE RENDERING
    ===================================================== */

    function render(list) {

        const table =
            getTableModule();


        if (!table) {

            console.warn(
                "[GEN-Z.AI] GENZModelTable belum tersedia."
            );

            return false;

        }


        if (typeof table.setModels !== "function") {

            console.warn(
                "[GEN-Z.AI] GENZModelTable.setModels() tidak tersedia."
            );

            return false;

        }


        try {

            table.setModels(
                Array.isArray(list)
                    ? list
                    : []
            );


            if (typeof table.render === "function") {

                table.render();

            }


            return true;

        } catch (error) {

            console.error(
                "[GEN-Z.AI] Model page search render error:",
                error
            );

            return false;

        }

    }


    /* =====================================================
       APPLY
    ===================================================== */

    function apply() {

        const source =
            loadSourceModels();


        const searchInput =
            getSearchInput();

        const statusFilter =
            getStatusFilter();

        const providerFilter =
            getProviderFilter();


        if (
            providerFilter &&
            providerFilter.options &&
            providerFilter.options.length <= 1 &&
            (source.length > 0 || providers.length > 0)
        ) {

            populateProviderFilter(
                undefined,
                source
            );

        }


        const keyword =
            searchInput
                ? searchInput.value
                : "";

        const status =
            statusFilter
                ? statusFilter.value
                : "all";

        const provider =
            providerFilter
                ? providerFilter.value
                : "all";


        const result =
            filterModels(
                source,
                keyword,
                status,
                provider
            );


        render(result);


        return [...result];

    }


    /* =====================================================
       EVENT HANDLERS
    ===================================================== */

    function handleSearchInput(event) {

        if (!event) {
            return false;
        }

        apply();

        return true;

    }


    function handleStatusChange(event) {

        if (!event) {
            return false;
        }

        apply();

        return true;

    }


    function handleProviderChange(event) {

        if (!event) {
            return false;
        }

        apply();

        return true;

    }


    function handleKeydown(event) {

        if (!event) {
            return false;
        }

        if (event.key === "Escape") {

            const input =
                getSearchInput();

            if (input && input.value) {

                input.value = "";
                apply();
                event.preventDefault();

            }

        }

        return true;

    }


    /* =====================================================
       CLEAR
    ===================================================== */

    function resetSelectToAll(select) {

        if (!select) {
            return;
        }

        const hasAllOption =
            Array.from(select.options || []).some(
                function (option) {
                    return option.value === "all";
                }
            );

        select.value =
            hasAllOption
                ? "all"
                : "";

    }


    function clear() {

        const input =
            getSearchInput();

        const status =
            getStatusFilter();

        const provider =
            getProviderFilter();


        if (input) {
            input.value = "";
        }

        resetSelectToAll(status);
        resetSelectToAll(provider);


        return apply();

    }


    /* =====================================================
       BIND & UNBIND
    ===================================================== */

    function bind() {

        const input =
            getSearchInput();

        const status =
            getStatusFilter();

        const provider =
            getProviderFilter();


        if (
            bound &&
            boundElements.input === input &&
            boundElements.status === status &&
            boundElements.provider === provider
        ) {

            return true;

        }


        if (bound) {
            unbind();
        }


        handlers = {
            input: handleSearchInput,
            keydown: handleKeydown,
            status: handleStatusChange,
            provider: handleProviderChange
        };


        if (input) {

            input.addEventListener(
                "input",
                handlers.input
            );

            input.addEventListener(
                "keydown",
                handlers.keydown
            );

        }


        if (status) {

            status.addEventListener(
                "change",
                handlers.status
            );

        }


        if (provider) {

            provider.addEventListener(
                "change",
                handlers.provider
            );

        }


        boundElements = {
            input,
            status,
            provider
        };

        bound = true;

        return true;

    }


    function unbind() {

        if (!bound) {
            return true;
        }


        const input =
            boundElements.input || getSearchInput();

        const status =
            boundElements.status || getStatusFilter();

        const provider =
            boundElements.provider || getProviderFilter();


        if (input && handlers) {

            input.removeEventListener(
                "input",
                handlers.input
            );

            input.removeEventListener(
                "keydown",
                handlers.keydown
            );

        }


        if (status && handlers) {

            status.removeEventListener(
                "change",
                handlers.status
            );

        }


        if (provider && handlers) {

            provider.removeEventListener(
                "change",
                handlers.provider
            );

        }


        boundElements = {
            input: null,
            status: null,
            provider: null
        };

        handlers = null;
        bound = false;

        return true;

    }


    /* =====================================================
       INITIALIZE & RESET
    ===================================================== */

    function initialize() {

        loadSourceModels();

        populateProviderFilter();

        bind();

        initialized = true;

        apply();

        console.info(
            "[GEN-Z.AI] Model Page Search initialized:",
            models.length
        );

        return true;

    }


    function reset() {

        unbind();

        initialized = false;
        hasExplicitModels = false;
        models = [];
        providers = [];

        return true;

    }


    /* =====================================================
       PUBLIC API
    ===================================================== */

    const api =
        Object.freeze({

            initialize,

            init: initialize,

            reset,

            destroy: reset,

            bind,

            unbind,

            setModels,

            getModels,

            setProviders,

            getProviders,

            populateProviders: populateProviderFilter,

            populateProviderFilter,

            collectProviderEntries,

            apply,

            clear,

            filterModels,

            render,

            getSearchInput,

            getStatusFilter,

            getProviderFilter,

            isActive,

            matchesStatus,

            matchesProvider,

            matchesSearch

        });


    window.GENZModelPageSearch = api;
    window.GENZModelsPageSearch = api;


    console.info(
        "[GEN-Z.AI] GENZModelPageSearch loaded."
    );


})();
