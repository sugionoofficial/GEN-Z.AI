/* =========================================================
   GEN-Z.AI
   MODEL PROVIDER DROPDOWN
   ---------------------------------------------------------
   File:
   admin-control/models/functions/model-provider-dropdown.js

   TANGGUNG JAWAB:
   - Mengontrol dropdown #providerId
   - Render daftar Provider yang diberikan
   - Set Provider
   - Clear Provider
   - Membaca Provider terpilih
   - Menjaga kompatibilitas UUID / provider_id / name

   ARSITEKTUR:
   ---------------------------------------------------------
   models-data.js
       ↓
   models-provider.js
       ↓
   model-provider-dropdown.js
       ↓
   models-form.js / models-search.js

   ATURAN:
   - Module ini TIDAK query Supabase
   - Module ini TIDAK memanggil GENZModelsData.loadProviders()
   - Data Provider hanya berasal dari GENZModelsProvider
   - Render dropdown hanya dilakukan oleh module ini
   - Tidak membuat event listener global
   - Tidak mengelola CRUD Model
========================================================= */

(function () {
    "use strict";


    /* =====================================================
       STATE
    ===================================================== */

    let providers = [];


    /* =====================================================
       ELEMENT
    ===================================================== */

    function getSelect() {

        return document.getElementById(
            "providerId"
        );
    }


    /* =====================================================
       NORMALIZE PROVIDER
    ===================================================== */

    function normalizeProvider(
        provider
    ) {

        if (
            !provider ||
            typeof provider !== "object"
        ) {
            return null;
        }


        const recordId =
            String(
                provider.id ??
                ""
            ).trim();


        const providerId =
            String(
                provider.provider_id ??
                provider.provider ??
                provider.id ??
                ""
            ).trim();


        if (!providerId) {
            return null;
        }


        const providerName =
            String(
                provider.provider_name ??
                provider.name ??
                providerId
            ).trim();


        const status =
            String(
                provider.status ??
                ""
            ).trim();


        return {
            ...provider,

            id:
                recordId ||
                provider.id ||
                null,

            provider_id:
                providerId,

            provider_name:
                providerName,

            status:
                status
        };
    }


    /* =====================================================
       NORMALIZE PROVIDERS
    ===================================================== */

    function normalizeProviders(
        list
    ) {

        if (!Array.isArray(list)) {
            return [];
        }


        const result = [];
        const seen = new Set();


        list.forEach(
            function (item) {

                const provider =
                    normalizeProvider(
                        item
                    );


                if (!provider) {
                    return;
                }


                const keys = [
                    provider.id,
                    provider.provider_id,
                    provider.provider,
                    provider.provider_name
                ]
                    .map(
                        function (value) {

                            return String(
                                value ??
                                ""
                            )
                                .trim()
                                .toLowerCase();
                        }
                    )
                    .filter(Boolean);


                const duplicate =
                    keys.some(
                        function (key) {

                            return seen.has(
                                key
                            );
                        }
                    );


                if (duplicate) {
                    return;
                }


                keys.forEach(
                    function (key) {

                        seen.add(
                            key
                        );
                    }
                );


                result.push(
                    provider
                );
            }
        );


        return result;
    }


    /* =====================================================
       ACTIVE STATUS
    ===================================================== */

    function isActive(
        provider
    ) {

        const status =
            String(
                provider?.status ??
                ""
            )
                .trim()
                .toLowerCase();


        /*
         * Status kosong tetap dianggap aktif
         * untuk kompatibilitas data lama.
         */

        return (
            !status ||
            status === "active" ||
            status === "enabled"
        );
    }


    /* =====================================================
       FIND PROVIDER
       -----------------------------------------------------
       Mendukung:
       - provider_id
       - provider
       - UUID id
       - provider_name
    ===================================================== */

    function findProvider(
        providerValue
    ) {

        const value =
            String(
                providerValue ??
                ""
            )
                .trim()
                .toLowerCase();


        if (!value) {
            return null;
        }


        return (
            providers.find(
                function (provider) {

                    const candidates = [
                        provider.id,
                        provider.provider_id,
                        provider.provider,
                        provider.provider_name
                    ];


                    return candidates.some(
                        function (candidate) {

                            return (
                                String(
                                    candidate ??
                                    ""
                                )
                                    .trim()
                                    .toLowerCase() ===
                                value
                            );
                        }
                    );
                }
            ) ||
            null
        );
    }


    /* =====================================================
       RENDER
       -----------------------------------------------------
       SATU-SATUNYA fungsi yang mengubah option dropdown.
    ===================================================== */

    function render(
        list,
        options = {}
    ) {

        const select =
            getSelect();


        if (!select) {

            console.warn(
                "[GEN-Z.AI] #providerId tidak ditemukan."
            );

            return false;
        }


        /*
         * Normalisasi Provider.
         */

        providers =
            normalizeProviders(
                list
            );


        /*
         * Filter aktif.
         *
         * Default:
         * activeOnly = true
         */

        const activeOnly =
            options.activeOnly !== false;


        let source =
            [...providers];


        if (activeOnly) {

            source =
                source.filter(
                    isActive
                );
        }


        /*
         * Simpan value sebelum render ulang.
         */

        const requestedValue =
            String(
                options.value ??
                select.value ??
                ""
            ).trim();


        /*
         * Cari Provider yang sebelumnya terpilih.
         *
         * Penting:
         * requestedValue dapat berupa UUID.
         */

        const selectedProvider =
            requestedValue
                ? findProvider(
                    requestedValue
                )
                : null;


        const selectedProviderId =
            selectedProvider
                ? String(
                    selectedProvider.provider_id ??
                    ""
                ).trim()
                : "";


        /* -------------------------------------------------
           BUILD FRAGMENT
        ------------------------------------------------- */

        const fragment =
            document.createDocumentFragment();


        /* -------------------------------------------------
           PLACEHOLDER
        ------------------------------------------------- */

        const placeholder =
            document.createElement(
                "option"
            );


        placeholder.value =
            "";


        placeholder.textContent =
            "Pilih Provider";


        fragment.appendChild(
            placeholder
        );


        /* -------------------------------------------------
           PROVIDER OPTIONS
        ------------------------------------------------- */

        source.forEach(
            function (provider) {

                const providerValue =
                    String(
                        provider.provider_id ??
                        provider.id ??
                        ""
                    ).trim();


                if (!providerValue) {
                    return;
                }


                const option =
                    document.createElement(
                        "option"
                    );


                /*
                 * Value resmi dropdown.
                 *
                 * Selalu provider_id jika tersedia.
                 */

                option.value =
                    providerValue;


                const providerName =
                    String(
                        provider.provider_name ??
                        providerValue
                    ).trim();


                option.textContent =
                    providerName &&
                    providerName !==
                        providerValue
                        ? (
                            providerName +
                            " (" +
                            providerValue +
                            ")"
                        )
                        : providerValue;


                /*
                 * Metadata.
                 */

                if (provider.id) {

                    option.dataset.providerUuid =
                        String(
                            provider.id
                        );
                }


                option.dataset.providerId =
                    providerValue;


                option.dataset.providerName =
                    providerName;


                /*
                 * Tandai default Provider.
                 */

                if (
                    provider.is_default === true
                ) {

                    option.dataset.default =
                        "true";
                }


                fragment.appendChild(
                    option
                );
            }
        );


        /* -------------------------------------------------
           REPLACE
        ------------------------------------------------- */

        select.replaceChildren(
            fragment
        );


        /* -------------------------------------------------
           RESTORE VALUE
        ------------------------------------------------- */

        if (selectedProviderId) {

            const exists =
                Array.from(
                    select.options
                ).some(
                    function (option) {

                        return (
                            String(
                                option.value ??
                                ""
                            )
                                .trim()
                                .toLowerCase() ===
                            selectedProviderId
                                .toLowerCase()
                        );
                    }
                );


            if (exists) {

                select.value =
                    selectedProviderId;
            }

        } else if (requestedValue) {

            /*
             * Fallback jika value belum ada
             * di state Provider.
             */

            const directOption =
                Array.from(
                    select.options
                ).find(
                    function (option) {

                        return (
                            String(
                                option.value ??
                                ""
                            )
                                .trim()
                                .toLowerCase() ===
                            requestedValue
                                .toLowerCase()
                        );
                    }
                );


            if (directOption) {

                select.value =
                    directOption.value;
            }
        }


        console.info(
            "[GEN-Z.AI] Provider dropdown rendered:",
            source.length
        );


        return true;
    }


    /* =====================================================
       SET PROVIDERS
       -----------------------------------------------------
       Pintu resmi dari models-provider.js / models-init.js.
    ===================================================== */

    function setProviders(
        list,
        options = {}
    ) {

        return render(
            list,
            options
        );
    }


    /* =====================================================
       GET PROVIDERS
    ===================================================== */

    function getProviders() {

        return [
            ...providers
        ];
    }


    /* =====================================================
       GET SELECTED
    ===================================================== */

    function getSelected() {

        const select =
            getSelect();


        if (
            !select ||
            !select.value
        ) {

            return null;
        }


        return (
            findProvider(
                select.value
            ) ||
            null
        );
    }


    /* =====================================================
       SET VALUE
       -----------------------------------------------------
       Mendukung:
       - provider_id
       - UUID
       - provider
       - provider_name
    ===================================================== */

    function setValue(
        providerValue
    ) {

        const select =
            getSelect();


        if (!select) {
            return false;
        }


        const value =
            String(
                providerValue ??
                ""
            ).trim();


        /* -------------------------------------------------
           CLEAR
        ------------------------------------------------- */

        if (!value) {

            select.value =
                "";


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


        /* -------------------------------------------------
           FIND
        ------------------------------------------------- */

        const provider =
            findProvider(
                value
            );


        if (provider) {

            const providerId =
                String(
                    provider.provider_id ??
                    provider.id ??
                    ""
                ).trim();


            select.value =
                providerId;


            if (
                select.value !==
                providerId
            ) {

                return false;
            }


            document.dispatchEvent(
                new CustomEvent(
                    "genz-models-provider-changed",
                    {
                        detail: {

                            providerId:
                                providerId,

                            providerName:
                                provider.provider_name ||
                                "",

                            recordId:
                                provider.id ||
                                ""
                        }
                    }
                )
            );


            return true;
        }


        /* -------------------------------------------------
           DIRECT OPTION FALLBACK
        ------------------------------------------------- */

        const directOption =
            Array.from(
                select.options
            ).find(
                function (option) {

                    return (
                        String(
                            option.value ??
                            ""
                        )
                            .trim()
                            .toLowerCase() ===
                        value
                            .toLowerCase()
                    );
                }
            );


        if (!directOption) {

            console.warn(
                "[GEN-Z.AI] Provider tidak ditemukan:",
                providerValue
            );

            return false;
        }


        select.value =
            directOption.value;


        document.dispatchEvent(
            new CustomEvent(
                "genz-models-provider-changed",
                {
                    detail: {
                        providerId:
                            select.value
                    }
                }
            )
        );


        return true;
    }


    /* =====================================================
       CLEAR
    ===================================================== */

    function clear() {

        const select =
            getSelect();


        if (!select) {
            return false;
        }


        select.value =
            "";


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


    /* =====================================================
       INITIALIZE
       -----------------------------------------------------
       TIDAK query models-data.js.

       Provider lifecycle adalah milik
       GENZModelsProvider.
    ===================================================== */

    function initialize(
        options = {}
    ) {

        const providerModule =
            window.GENZModelsProvider;


        if (
            !providerModule ||
            typeof providerModule.getProviders !==
                "function"
        ) {

            console.warn(
                "[GEN-Z.AI] GENZModelsProvider belum siap."
            );

            return false;
        }


        try {

            const providerList =
                providerModule.getProviders();


            const list =
                Array.isArray(
                    providerList
                )
                    ? providerList
                    : [];


            render(
                list,
                {
                    activeOnly:
                        options.activeOnly !== false,

                    value:
                        options.value
                }
            );


            console.info(
                "[GEN-Z.AI] Provider dropdown initialized from GENZModelsProvider."
            );


            return true;

        } catch (error) {

            console.error(
                "[GEN-Z.AI] Provider dropdown initialize error:",
                error
            );


            return false;
        }
    }


    /* =====================================================
       REFRESH
       -----------------------------------------------------
       Refresh dilakukan oleh Provider owner.

       Module dropdown hanya menerima hasilnya.
    ===================================================== */

    async function refresh(
        options = {}
    ) {

        const providerModule =
            window.GENZModelsProvider;


        if (
            !providerModule
        ) {

            console.warn(
                "[GEN-Z.AI] GENZModelsProvider belum tersedia."
            );

            return [];
        }


        try {

            let providerList;


            /*
             * PRIORITAS:
             * Provider.refresh()
             */

            if (
                typeof providerModule.refresh ===
                "function"
            ) {

                providerList =
                    await providerModule.refresh(
                        {
                            activeOnly:
                                options.activeOnly !== false,

                            value:
                                options.value
                        }
                    );

            } else if (
                typeof providerModule.loadProviders ===
                "function"
            ) {

                /*
                 * Fallback untuk Provider module
                 * versi lama.
                 */

                providerList =
                    await providerModule.loadProviders(
                        {
                            force: true,

                            activeOnly:
                                options.activeOnly !== false,

                            value:
                                options.value
                        }
                    );

            } else {

                providerList =
                    providerModule.getProviders
                        ? providerModule.getProviders()
                        : [];
            }


            const list =
                Array.isArray(
                    providerList
                )
                    ? providerList
                    : [];


            /*
             * Provider module pada versi sekarang
             * sudah melakukan render sendiri.
             *
             * Namun jika dropdown module dipanggil
             * langsung, sinkronkan state lokal.
             */

            providers =
                normalizeProviders(
                    list
                );


            /*
             * Jangan render kedua kali jika Provider
             * module sudah menjadi owner rendering.
             *
             * Render hanya jika dropdown belum memiliki
             * option yang sesuai.
             */

            const select =
                getSelect();


            const hasOptions =
                select &&
                select.options &&
                select.options.length > 1;


            if (!hasOptions) {

                render(
                    providers,
                    {
                        activeOnly:
                            options.activeOnly !== false,

                        value:
                            options.value
                    }
                );
            }


            return [
                ...providers
            ];

        } catch (error) {

            console.error(
                "[GEN-Z.AI] Provider dropdown refresh error:",
                error
            );


            return [];
        }
    }


    /* =====================================================
       DESTROY
    ===================================================== */

    function destroy() {

        providers = [];


        const select =
            getSelect();


        if (select) {

            select.replaceChildren(
                (() => {

                    const option =
                        document.createElement(
                            "option"
                        );

                    option.value =
                        "";

                    option.textContent =
                        "Pilih Provider";

                    return option;

                })()
            );
        }
    }


    /* =====================================================
       PUBLIC API
    ===================================================== */

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


    console.info(
        "[GEN-Z.AI] Model Provider Dropdown loaded."
    );

})();
