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

   TIDAK BERTANGGUNG JAWAB:
   - Search Model ID pada Form
   - Provider
   - Model CRUD
   - Pricing
   - Data loading
   - Form Layout
   - Authorization / Role
   - Table CRUD

   SUMBER DATA:
   GENZModelsData

   RENDER:
   GENZModelTable

   ROLE:
   Modul ini TIDAK mengubah atau menentukan role
   owner / admin / user.

   Authorization tetap berada pada:
   - Auth
   - Admin guard
   - API authorization
   - Supabase / backend policy

   SEARCH PAGE dan SEARCH FORM adalah dua sistem
   yang berbeda.
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
       MODULE ACCESS
    ===================================================== */

    function getDataModule() {

        return (
            window.GENZModelsData ||
            null
        );

    }


    function getTableModule() {

        return (
            window.GENZModelTable ||
            null
        );

    }


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
       NORMALIZATION
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


        const provider =
            (
                model.provider &&
                typeof model.provider === "object"
            )
                ? model.provider
                : null;


        return {

            ...model,

            id:
                model.id ??
                "",

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

            provider_id:
                model.provider_id ??
                model.providerId ??
                provider?.id ??
                provider?.provider_id ??
                "",

            provider_name:
                model.provider_name ??
                model.providerName ??
                provider?.provider_name ??
                provider?.name ??
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
            !Array.isArray(
                list
            )
        ) {

            return [];

        }


        return list
            .map(
                normalizeModel
            )
            .filter(
                function (
                    model
                ) {

                    return (
                        !!model &&
                        !!String(
                            model.model_id ??
                            ""
                        ).trim()
                    );

                }
            );

    }


    /* =====================================================
       SOURCE
       -----------------------------------------------------
       ModelsData adalah satu-satunya source catalog.
    ===================================================== */

    function loadSourceModels() {

        const data =
            getDataModule();


        if (
            !data
        ) {

            return [
                ...models
            ];

        }


        if (
            typeof data.getCachedModels !==
            "function"
        ) {

            return [
                ...models
            ];

        }


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

        } catch (
            error
        ) {

            console.warn(
                "[GEN-Z.AI] Model page search source error:",
                error
            );

        }


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
         * Jangan langsung render di sini.
         *
         * ModelsData / ModelsUI / Table tetap menjadi
         * owner lifecycle rendering.
         *
         * Search hanya menyimpan catalog.
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

    function normalizeStatus(
        model
    ) {

        return normalizeString(
            model?.status
        );

    }


    function isActive(
        model
    ) {

        const status =
            normalizeStatus(
                model
            );


        /*
         * Model tanpa status tetap dianggap aktif
         * untuk kompatibilitas data lama.
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

        if (
            !filter
        ) {

            return true;

        }


        if (
            filter === "active"
        ) {

            return isActive(
                model
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
         * Status lain jika nanti ditambahkan.
         */

        const modelStatus =
            normalizeStatus(
                model
            );


        return (
            modelStatus ===
            filter
        );

    }


    /* =====================================================
       SEARCH TEXT
    ===================================================== */

    function getSearchValues(
        model
    ) {

        return [

            model?.model_id,

            model?.model_name,

            model?.model_family,

            model?.provider_name,

            model?.provider_id

        ]
            .map(
                normalizeString
            )
            .filter(
                Boolean
            );

    }


    function matchesSearch(
        model,
        keyword
    ) {

        const term =
            normalizeString(
                keyword
            );


        if (
            !term
        ) {

            return true;

        }


        const values =
            getSearchValues(
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


        const term =
            normalizeString(
                keyword
            );


        /*
         * Tidak perlu ranking jika search kosong.
         */

        if (
            !term
        ) {

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


                const aProvider =
                    normalizeString(
                        a.provider_name
                    );

                const bProvider =
                    normalizeString(
                        b.provider_name
                    );


                /* =========================================
                   EXACT ID
                ========================================= */

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


                /* =========================================
                   ID PREFIX
                ========================================= */

                const aIdPrefix =
                    aId.startsWith(
                        term
                    )
                        ? 10000
                        : 0;

                const bIdPrefix =
                    bId.startsWith(
                        term
                    )
                        ? 10000
                        : 0;


                if (
                    aIdPrefix !==
                    bIdPrefix
                ) {

                    return (
                        bIdPrefix -
                        aIdPrefix
                    );

                }


                /* =========================================
                   ID CONTAINS
                ========================================= */

                const aIdContains =
                    aId.includes(
                        term
                    )
                        ? 1000
                        : 0;

                const bIdContains =
                    bId.includes(
                        term
                    )
                        ? 1000
                        : 0;


                if (
                    aIdContains !==
                    bIdContains
                ) {

                    return (
                        bIdContains -
                        aIdContains
                    );

                }


                /* =========================================
                   NAME PREFIX
                ========================================= */

                const aNamePrefix =
                    aName.startsWith(
                        term
                    )
                        ? 500
                        : 0;

                const bNamePrefix =
                    bName.startsWith(
                        term
                    )
                        ? 500
                        : 0;


                if (
                    aNamePrefix !==
                    bNamePrefix
                ) {

                    return (
                        bNamePrefix -
                        aNamePrefix
                    );

                }


                /* =========================================
                   NAME CONTAINS
                ========================================= */

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


                /* =========================================
                   PROVIDER
                ========================================= */

                const aProviderContains =
                    aProvider.includes(
                        term
                    )
                        ? 50
                        : 0;

                const bProviderContains =
                    bProvider.includes(
                        term
                    )
                        ? 50
                        : 0;


                if (
                    aProviderContains !==
                    bProviderContains
                ) {

                    return (
                        bProviderContains -
                        aProviderContains
                    );

                }


                /* =========================================
                   ALPHABETICAL
                ========================================= */

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
       TABLE
       -----------------------------------------------------
       Table tetap owner rendering.

       Search hanya meneruskan hasil filter.
    ===================================================== */

    function render(
        list
    ) {

        const table =
            getTableModule();


        if (
            !table
        ) {

            console.warn(
                "[GEN-Z.AI] GENZModelTable belum tersedia."
            );


            return false;

        }


        if (
            typeof table.setModels !==
            "function"
        ) {

            console.warn(
                "[GEN-Z.AI] GENZModelTable.setModels() tidak tersedia."
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


            /*
             * Jangan memaksa render apabila table
             * memiliki lifecycle render sendiri.
             *
             * Jika render tersedia, kita tetap panggil
             * karena Page Search adalah perubahan
             * tampilan yang memang harus terlihat segera.
             */

            if (
                typeof table.render ===
                "function"
            ) {

                table.render();

            }


            return true;

        } catch (
            error
        ) {

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

        /*
         * Selalu mulai dari source catalog.
         *
         * Jangan melakukan filter terhadap hasil filter
         * sebelumnya.
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


        if (
            input
        ) {

            input.value =
                "";

        }


        if (
            status
        ) {

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


        handlers = {

            input:
                handleSearchInput,

            keydown:
                handleKeydown,

            status:
                handleStatusChange

        };


        /*
         * Search input.
         */

        if (
            input
        ) {

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

        if (
            status
        ) {

            status.addEventListener(
                "change",
                handlers.status
            );

        }


        bound =
            true;


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

            /*
             * Pastikan listener tetap tersedia
             * jika DOM telah berubah.
             */

            bind();


            return true;

        }


        loadSourceModels();


        bind();


        initialized =
            true;


        /*
         * Terapkan filter awal jika HTML sudah
         * memiliki nilai search/filter.
         */

        apply();


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

            getStatusFilter,

            isActive,
            
            matchesStatus,

            matchesSearch

        });


    console.info(
        "[GEN-Z.AI] GENZModelPageSearch loaded."
    );


})();
