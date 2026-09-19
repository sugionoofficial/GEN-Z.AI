/* =========================================================
   GEN-Z.AI
   MODEL PAGE SEARCH
   ---------------------------------------------------------
   File:
   admin-control/models/functions/model-page-search.js

   TANGGUNG JAWAB:
   - Search utama halaman Models
   - #searchInput
   - #statusFilter
   - Filter Model ID
   - Filter Model Name
   - Filter Model Family
   - Filter Provider
   - Render hasil melalui GENZModelTable

   TIDAK BERTANGGUNG JAWAB:
   - Search Model ID di Form
   - Provider
   - CRUD
   - Pricing
   - Data loading
   - Form Layout
   - Table rendering

   CATATAN:
   Search halaman dan Search Model ID Form
   adalah DUA SISTEM BERBEDA.
========================================================= */

(function () {

    "use strict";


    /* =====================================================
       STATE
    ===================================================== */

    let initialized = false;

    let bound = false;

    let handlers = null;

    let models = [];


    /* =====================================================
       DOM
    ===================================================== */

    function getSearchInput() {

        return (
            document.getElementById(
                "searchInput"
            ) ||
            null
        );

    }


    function getStatusFilter() {

        return (
            document.getElementById(
                "statusFilter"
            ) ||
            null
        );

    }


    /* =====================================================
       DATA MODULE
    ===================================================== */

    function getDataModule() {

        return (
            window.GENZModelsData ||
            null
        );

    }


    /* =====================================================
       TABLE MODULE
    ===================================================== */

    function getTableModule() {

        return (
            window.GENZModelTable ||
            null
        );

    }


    /* =====================================================
       NORMALIZE
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


    function normalizeModel(
        model
    ) {

        if (
            !model ||
            typeof model !== "object"
        ) {

            return null;

        }


        return {

            ...model,

            id:
                model.id ?? "",

            model_id:
                model.model_id ??
                model.modelId ??
                "",

            model_name:
                model.model_name ??
                model.modelName ??
                model.name ??
                "",

            model_family:
                model.model_family ??
                model.modelFamily ??
                model.family ??
                "",

            provider:
                model.provider ??
                "",

            provider_id:
                model.provider_id ??
                model.providerId ??
                "",

            provider_name:
                model.provider_name ??
                model.providerName ??
                "",

            status:
                model.status ??
                "active"

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


        return list
            .map(
                normalizeModel
            )
            .filter(
                Boolean
            );

    }


    /* =====================================================
       LOAD CURRENT SOURCE
       -----------------------------------------------------
       Search TIDAK membuat API sendiri.
       Selalu mengambil katalog dari Data owner.
    ===================================================== */

    function loadSourceModels() {

        const data =
            getDataModule();


        if (
            data &&
            typeof data.getCachedModels ===
                "function"
        ) {

            try {

                const cached =
                    data.getCachedModels();


                if (
                    Array.isArray(
                        cached
                    )
                ) {

                    models =
                        normalizeModels(
                            cached
                        );

                    return [
                        ...models
                    ];

                }

            } catch (error) {

                console.warn(
                    "[model-page-search] getCachedModels error:",
                    error
                );

            }

        }


        /*
         * Fallback ke state yang sudah disimpan
         * oleh module ini.
         */

        return [
            ...models
        ];

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


        /*
         * Jika Search sedang aktif,
         * langsung hitung ulang.
         */

        if (
            initialized
        ) {

            apply();

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
       STATUS
    ===================================================== */

    function isActive(
        model
    ) {

        const status =
            normalizeString(
                model?.status
            );


        /*
         * Data lama tanpa status
         * dianggap aktif.
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


    function matchesStatus(
        model,
        status
    ) {

        const filter =
            normalizeString(
                status
            );


        /*
         * Semua status.
         */

        if (!filter) {

            return true;

        }


        const modelStatus =
            normalizeString(
                model?.status
            );


        if (
            filter === "active"
        ) {

            return (
                isActive(
                    model
                )
            );

        }


        if (
            filter === "inactive"
        ) {

            return !isActive(
                model
            );

        }


        /*
         * Untuk status tambahan
         * jika nanti ditambahkan ke HTML.
         */

        if (
            modelStatus ===
            filter
        ) {

            return true;

        }


        return false;

    }


    /* =====================================================
       SEARCH TEXT
    ===================================================== */

    function getSearchText(
        model
    ) {

        return [

            model?.model_id,

            model?.model_name,

            model?.model_family,

            model?.provider,

            model?.provider_id,

            model?.provider_name

        ]
            .map(
                normalizeString
            )
            .filter(
                Boolean
            );

    }


    /* =====================================================
       MATCH SEARCH
    ===================================================== */

    function matchesSearch(
        model,
        keyword
    ) {

        const term =
            normalizeString(
                keyword
            );


        /*
         * Search kosong =
         * semua Model cocok.
         */

        if (!term) {

            return true;

        }


        const values =
            getSearchText(
                model
            );


        return values.some(
            function (
                value
            ) {

                return value.includes(
                    term
                );

            }
        );

    }


    /* =====================================================
       FILTER
    ===================================================== */

    function filterModels(
        list,
        keyword,
        status
    ) {

        const source =
            normalizeModels(
                list
            );


        const filtered =
            source.filter(
                function (
                    model
                ) {

                    return (
                        matchesSearch(
                            model,
                            keyword
                        ) &&
                        matchesStatus(
                            model,
                            status
                        )
                    );

                }
            );


        /*
         * Ranking pencarian.
         *
         * Exact Model ID
         * ↓
         * Model ID diawali keyword
         * ↓
         * Model ID mengandung keyword
         * ↓
         * Nama
         * ↓
         * Alphabetical
         */

        const term =
            normalizeString(
                keyword
            );


        if (!term) {

            return filtered;

        }


        filtered.sort(
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


                const aName =
                    normalizeString(
                        a.model_name
                    );

                const bName =
                    normalizeString(
                        b.model_name
                    );


                /*
                 * Exact ID.
                 */

                const aExact =
                    aId === term
                        ? 100000
                        : 0;

                const bExact =
                    bId === term
                        ? 100000
                        : 0;


                if (
                    aExact !==
                    bExact
                ) {

                    return (
                        bExact -
                        aExact
                    );

                }


                /*
                 * Prefix ID.
                 */

                const aPrefix =
                    aId.startsWith(
                        term
                    )
                        ? 10000
                        : 0;

                const bPrefix =
                    bId.startsWith(
                        term
                    )
                        ? 10000
                        : 0;


                if (
                    aPrefix !==
                    bPrefix
                ) {

                    return (
                        bPrefix -
                        aPrefix
                    );

                }


                /*
                 * ID contains.
                 */

                const aContains =
                    aId.includes(
                        term
                    )
                        ? 1000
                        : 0;

                const bContains =
                    bId.includes(
                        term
                    )
                        ? 1000
                        : 0;


                if (
                    aContains !==
                    bContains
                ) {

                    return (
                        bContains -
                        aContains
                    );

                }


                /*
                 * Name contains.
                 */

                const aNameContains =
                    aName.includes(
                        term
                    )
                        ? 100
                        : 0;

                const bNameContains =
                    bName.includes(
                        term
                    )
                        ? 100
                        : 0;


                if (
                    aNameContains !==
                    bNameContains
                ) {

                    return (
                        bNameContains -
                        aNameContains
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


        return filtered;

    }


    /* =====================================================
       RENDER
    ===================================================== */

    function render(
        list
    ) {

        const table =
            getTableModule();


        if (
            !table
        ) {

            console.error(
                "[model-page-search] GENZModelTable belum tersedia."
            );

            return false;

        }


        if (
            typeof table.setModels !==
                "function" ||
            typeof table.render !==
                "function"
        ) {

            console.error(
                "[model-page-search] API GENZModelTable tidak lengkap."
            );

            return false;

        }


        try {

            table.setModels(
                Array.isArray(
                    list
                )
                    ? list
                    : []
            );


            table.render();


            return true;

        } catch (error) {

            console.error(
                "[model-page-search] Render table error:",
                error
            );

            return false;

        }

    }


    /* =====================================================
       APPLY
    ===================================================== */

    function apply() {

        /*
         * Selalu ambil katalog terbaru.
         * Jangan menggunakan hasil filter sebelumnya
         * sebagai source berikutnya.
         */

        const source =
            loadSourceModels();


        const searchInput =
            getSearchInput();


        const statusFilter =
            getStatusFilter();


        const keyword =
            searchInput
                ? searchInput.value
                : "";


        const status =
            statusFilter
                ? statusFilter.value
                : "";


        const result =
            filterModels(
                source,
                keyword,
                status
            );


        console.info(
            "[GEN-Z.AI] Page Model Search:",
            {
                keyword:
                    String(
                        keyword || ""
                    ),
                status:
                    String(
                        status || ""
                    ),
                total:
                    source.length,
                result:
                    result.length
            }
        );


        render(
            result
        );


        return [
            ...result
        ];

    }


    /* =====================================================
       INPUT HANDLER
    ===================================================== */

    function handleSearchInput(
        event
    ) {

        if (
            !event
        ) {

            return false;

        }


        apply();


        return true;

    }


    /* =====================================================
       STATUS HANDLER
    ===================================================== */

    function handleStatusChange(
        event
    ) {

        if (
            !event
        ) {

            return false;

        }


        apply();


        return true;

    }


    /* =====================================================
       KEYBOARD
    ===================================================== */

    function handleKeydown(
        event
    ) {

        if (
            !event
        ) {

            return false;

        }


        /*
         * Escape mengosongkan pencarian.
         */

        if (
            event.key ===
            "Escape"
        ) {

            const input =
                getSearchInput();


            if (
                input &&
                input.value
            ) {

                input.value =
                    "";


                apply();


                event.preventDefault();

            }

        }


        return true;

    }


    /* =====================================================
       CLEAR
    ===================================================== */

    function clear() {

        const input =
            getSearchInput();


        const status =
            getStatusFilter();


        if (input) {

            input.value =
                "";

        }


        if (status) {

            status.value =
                "";

        }


        return apply();

    }


    /* =====================================================
       BIND
    ===================================================== */

    function bind() {

        if (
            bound
        ) {

            return true;

        }


        const input =
            getSearchInput();


        const status =
            getStatusFilter();


        if (!input) {

            console.warn(
                "[model-page-search] #searchInput belum tersedia."
            );

        }


        /*
         * Simpan handler.
         */

        handlers = {

            input:
                handleSearchInput,

            status:
                handleStatusChange,

            keydown:
                handleKeydown

        };


        /*
         * Search utama.
         */

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


        /*
         * Status filter.
         */

        if (status) {

            status.addEventListener(
                "change",
                handlers.status
            );

        }


        bound =
            true;


        console.info(
            "[GEN-Z.AI] Model Page Search bound."
        );


        return true;

    }


    /* =====================================================
       UNBIND
    ===================================================== */

    function unbind() {

        if (
            !bound
        ) {

            return true;

        }


        const input =
            getSearchInput();


        const status =
            getStatusFilter();


        if (
            input &&
            handlers
        ) {

            input.removeEventListener(
                "input",
                handlers.input
            );


            input.removeEventListener(
                "keydown",
                handlers.keydown
            );

        }


        if (
            status &&
            handlers
        ) {

            status.removeEventListener(
                "change",
                handlers.status
            );

        }


        handlers =
            null;

        bound =
            false;


        return true;

    }


    /* =====================================================
       INITIALIZE
    ===================================================== */

    function initialize() {

        if (
            initialized
        ) {

            bind();

            return true;

        }


        /*
         * Ambil katalog awal.
         */

        loadSourceModels();


        bind();


        initialized =
            true;


        console.info(
            "[GEN-Z.AI] Model Page Search initialized:",
            models.length
        );


        return true;

    }


    /* =====================================================
       RESET
    ===================================================== */

    function reset() {

        unbind();


        initialized =
            false;


        models =
            [];


        return true;

    }


    /* =====================================================
       PUBLIC API
    ===================================================== */

    window.GENZModelPageSearch =
        Object.freeze({

            initialize,

            reset,

            bind,

            unbind,

            setModels,

            getModels,

            apply,

            clear,

            filterModels,

            render,

            getSearchInput,

            getStatusFilter

        });


    console.info(
        "[GEN-Z.AI] GENZModelPageSearch loaded."
    );

})();
