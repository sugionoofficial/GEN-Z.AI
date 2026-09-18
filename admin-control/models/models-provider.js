/* =========================================================
   GEN-Z.AI - MODELS PROVIDER MODULE
   File:
   admin-control/models/models-provider.js

   Tugas:
   - Memuat daftar provider untuk halaman Models
   - Mengisi dropdown #providerId
   - Menyediakan provider ke module lain
   - Mendukung provider.id (UUID)
   - Mendukung provider.provider_id (kode provider)
   - Tidak mengambil alih fungsi Models UI
   - Tidak melakukan auto-initialize
   - Tidak memasang event listener global

   ARSITEKTUR:
   - models-data.js        = sumber data
   - models-provider.js    = lifecycle + lookup Provider
   - model-provider-dropdown.js = kontrol dropdown
   - models-form.js        = penggunaan Provider pada Form
   ========================================================= */

(function () {
    "use strict";

    /* =====================================================
       STATE
    ===================================================== */

    let providers = [];
    let initialized = false;


    /* =====================================================
       ELEMENT
    ===================================================== */

    function getProviderSelect() {
        return document.getElementById("providerId");
    }


    /* =====================================================
       NOTIFICATION
    ===================================================== */

    function notify(type, message) {
        try {
            if (
                window.GENZModelsUI &&
                typeof window.GENZModelsUI.showAlert ===
                    "function"
            ) {
                window.GENZModelsUI.showAlert(
                    type,
                    message
                );

                return;
            }

            const alertBox =
                document.getElementById("alertBox");

            if (!alertBox) {
                return;
            }

            alertBox.textContent =
                message || "";

            alertBox.className =
                "alert " +
                (
                    type === "error"
                        ? "alert-error"
                        : "alert-success"
                ) +
                " show";

        } catch (error) {
            console.error(
                "[GEN-Z.AI] Provider notify error:",
                error
            );
        }
    }


    /* =====================================================
       NORMALIZE PROVIDER
       
       PENTING:
       Jangan kehilangan provider.id.

       Struktur Provider bisa berupa:

       {
           id: UUID,
           provider_id: "bytedance",
           provider_name: "ByteDance"
       }

       atau legacy:

       {
           provider_id: "bytedance"
       }

       Form Edit bisa menerima UUID dari models.provider_id,
       sedangkan dropdown tetap memakai provider_id sebagai
       value.
    ===================================================== */

    function normalizeProvider(provider) {

        if (
            !provider ||
            typeof provider !== "object"
        ) {
            return null;
        }

        const databaseId =
            String(
                provider.id ??
                ""
            ).trim();

        const providerCode =
            String(
                provider.provider_id ??
                provider.provider ??
                ""
            ).trim();

        /*
         * ID utama untuk kebutuhan internal.
         *
         * Jika provider_id tersedia, gunakan itu sebagai
         * value dropdown.
         *
         * Jika tidak tersedia, fallback ke id.
         */
        const normalizedProviderId =
            providerCode ||
            databaseId;

        if (!normalizedProviderId) {
            return null;
        }

        const providerName =
            String(
                provider.provider_name ??
                provider.name ??
                normalizedProviderId
            ).trim();

        return {
            ...provider,

            /*
             * Pertahankan UUID database.
             */
            id:
                databaseId ||
                provider.id ||
                null,

            /*
             * provider_id adalah kode provider jika
             * tersedia. Jika tidak, fallback ke id.
             */
            provider_id:
                normalizedProviderId,

            provider_name:
                providerName
        };
    }


    /* =====================================================
       NORMALIZE PROVIDERS
    ===================================================== */

    function normalizeProviders(list) {

        if (!Array.isArray(list)) {
            return [];
        }

        const result = [];
        const seen = new Set();

        list.forEach(function (item) {

            const provider =
                normalizeProvider(item);

            if (!provider) {
                return;
            }

            /*
             * Deduplicate berdasarkan seluruh identifier
             * yang dikenal.
             *
             * Ini mencegah satu Provider muncul dua kali
             * apabila data memiliki variasi identifier.
             */
            const keys = [
                provider.id,
                provider.provider_id,
                provider.provider
            ]
                .map(function (value) {
                    return String(
                        value ?? ""
                    )
                        .trim()
                        .toLowerCase();
                })
                .filter(Boolean);

            const alreadyExists =
                keys.some(function (key) {
                    return seen.has(key);
                });

            if (alreadyExists) {
                return;
            }

            keys.forEach(function (key) {
                seen.add(key);
            });

            result.push(provider);
        });

        return result;
    }


    /* =====================================================
       ACTIVE STATUS
    ===================================================== */

    function isActive(provider) {

        const status =
            String(
                provider?.status ??
                "active"
            )
                .trim()
                .toLowerCase();

        return status === "active";
    }


    /* =====================================================
       SORT PROVIDERS
    ===================================================== */

    function sortProviders(list) {

        return [...list].sort(
            function (a, b) {

                /*
                 * Default provider selalu di atas.
                 */

                const aDefault =
                    a.is_default === true
                        ? 0
                        : 1;

                const bDefault =
                    b.is_default === true
                        ? 0
                        : 1;

                if (
                    aDefault !== bDefault
                ) {
                    return (
                        aDefault -
                        bDefault
                    );
                }

                const aName =
                    String(
                        a.provider_name ||
                        a.provider_id ||
                        ""
                    );

                const bName =
                    String(
                        b.provider_name ||
                        b.provider_id ||
                        ""
                    );

                return aName.localeCompare(
                    bName,
                    "id",
                    {
                        sensitivity:
                            "base"
                    }
                );
            }
        );
    }


    /* =====================================================
       FIND PROVIDER MATCH
       
       Satu fungsi pusat untuk seluruh pencarian Provider.

       Dapat menerima:
       - providers.id
       - providers.provider_id
       - provider.provider
       ===================================================== */

    function matchesProvider(
        provider,
        identifier
    ) {

        if (!provider) {
            return false;
        }

        const normalized =
            String(
                identifier ??
                ""
            )
                .trim()
                .toLowerCase();

        if (!normalized) {
            return false;
        }

        const candidates = [
            provider.id,
            provider.provider_id,
            provider.provider
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
                    normalized
                );
            }
        );
    }


    /* =====================================================
       POPULATE PROVIDER SELECT
       #providerId

       Owner:
       GENZModelsProvider

       Dropdown menerima provider_id sebagai value,
       tetapi lookup tetap mendukung UUID provider.id.
    ===================================================== */

    function populateSelect(
        list,
        options = {}
    ) {

        const select =
            getProviderSelect();

        if (!select) {
            console.warn(
                "[GEN-Z.AI] #providerId tidak ditemukan."
            );

            return false;
        }

        const activeOnly =
            options.activeOnly !== false;

        /*
         * Simpan value yang sedang dipilih.
         */
        const currentValue =
            String(
                options.value ??
                select.value ??
                ""
            ).trim();

        let source =
            normalizeProviders(list);

        if (activeOnly) {
            source =
                source.filter(
                    isActive
                );
        }

        source =
            sortProviders(source);

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

                /*
                 * Dropdown menggunakan provider_id.
                 *
                 * Ini penting agar data Model baru tetap
                 * konsisten dengan API yang memakai
                 * provider_id sebagai kode provider.
                 */
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

                option.value =
                    providerValue;

                const name =
                    provider.provider_name ||
                    providerValue;

                option.textContent =
                    name === providerValue
                        ? providerValue
                        : name +
                          " (" +
                          providerValue +
                          ")";

                /*
                 * Simpan UUID sebagai metadata option.
                 * Tidak mengubah value dropdown.
                 *
                 * Ini berguna apabila module lain perlu
                 * mengetahui providers.id.
                 */
                if (provider.id) {
                    option.dataset.providerUuid =
                        String(
                            provider.id
                        );
                }

                fragment.appendChild(
                    option
                );
            }
        );


        /* -------------------------------------------------
           REPLACE OPTIONS
        ------------------------------------------------- */

        select.replaceChildren(
            fragment
        );


        /* -------------------------------------------------
           RESTORE VALUE
           
           Pertama coba cocokkan langsung.

           Jika currentValue adalah UUID, cari Provider
           berdasarkan UUID lalu gunakan provider_id
           sebagai value dropdown.
        ------------------------------------------------- */

        if (currentValue) {

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
                            currentValue.toLowerCase()
                        );
                    }
                );

            if (directOption) {

                select.value =
                    directOption.value;

            } else {

                const matchedProvider =
                    source.find(
                        function (provider) {
                            return matchesProvider(
                                provider,
                                currentValue
                            );
                        }
                    );

                if (matchedProvider) {

                    select.value =
                        matchedProvider.provider_id;
                }
            }
        }

        return true;
    }


    /* =====================================================
       LOAD PROVIDERS
       
       Sumber data:
       GENZModelsData

       Module ini bertanggung jawab atas:
       - mengambil Provider
       - normalize
       - menyimpan state
       - populate dropdown
    ===================================================== */

    async function loadProviders(
        options = {}
    ) {

        const data =
            window.GENZModelsData;

        if (
            !data ||
            typeof data.loadProviders !==
                "function"
        ) {
            throw new Error(
                "GENZModelsData belum tersedia."
            );
        }

        const force =
            options.force === true;

        const activeOnly =
            options.activeOnly !== false;


        /* -------------------------------------------------
           LOAD FROM DATA MODULE
        ------------------------------------------------- */

        const loaded =
            await data.loadProviders({
                force,
                activeOnly
            });


        /* -------------------------------------------------
           NORMALIZE
        ------------------------------------------------- */

        providers =
            normalizeProviders(
                loaded
            );


        /* -------------------------------------------------
           POPULATE SELECT
           
           Data module sudah melakukan filter activeOnly.

           Jadi Provider module tidak melakukan filter
           kedua kali.
        ------------------------------------------------- */

        populateSelect(
            providers,
            {
                activeOnly: false,

                value:
                    options.value
            }
        );


        /* -------------------------------------------------
           EVENT
        ------------------------------------------------- */

        document.dispatchEvent(
            new CustomEvent(
                "genz-models-providers-loaded",
                {
                    detail: {
                        providers:
                            [...providers]
                    }
                }
            )
        );

        return [
            ...providers
        ];
    }


    /* =====================================================
       INITIALIZE
    ===================================================== */

    async function initialize(
        options = {}
    ) {

        /*
         * Jangan load ulang jika sudah initialized,
         * kecuali force=true.
         */

        if (
            initialized &&
            options.force !== true
        ) {

            if (
                options.value !==
                undefined
            ) {

                populateSelect(
                    providers,
                    {
                        activeOnly:
                            options.activeOnly !==
                            false,

                        value:
                            options.value
                    }
                );
            }

            return [
                ...providers
            ];
        }


        const loaded =
            await loadProviders(
                options
            );

        initialized =
            true;

        return loaded;
    }


    /* =====================================================
       REFRESH
    ===================================================== */

    async function refresh(
        options = {}
    ) {

        return initialize({
            ...options,

            force: true
        });
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
       GET PROVIDER BY ID
       
       Menerima:
       - providers.id
       - providers.provider_id
       - providers.provider

       Ini adalah bagian penting untuk Edit Model.
    ===================================================== */

    function getProviderById(
        providerId
    ) {

        const id =
            String(
                providerId ??
                ""
            )
                .trim()
                .toLowerCase();

        if (!id) {
            return null;
        }

        return (
            providers.find(
                function (provider) {

                    return matchesProvider(
                        provider,
                        id
                    );
                }
            ) ||
            null
        );
    }


    /* =====================================================
       GET PROVIDER VALUE
       
       Mengubah identifier apa pun menjadi provider_id
       yang digunakan oleh dropdown/API Model.
    ===================================================== */

    function getProviderValue(
        providerId
    ) {

        const provider =
            getProviderById(
                providerId
            );

        if (!provider) {
            return "";
        }

        return String(
            provider.provider_id ??
            provider.provider ??
            provider.id ??
            ""
        ).trim();
    }


    /* =====================================================
       SET SELECT VALUE
       
       Mendukung UUID maupun provider_id.
       
       Contoh:
       
       setValue("bytedance")
       setValue("UUID-PROVIDER-123")
       
       Keduanya akan memilih:
       
       ByteDance (bytedance)
    ===================================================== */

    function setValue(
        providerId
    ) {

        const select =
            getProviderSelect();

        if (!select) {
            return false;
        }

        const value =
            String(
                providerId ??
                ""
            ).trim();

        if (!value) {

            select.value =
                "";

            return true;
        }

        /*
         * 1. Coba langsung berdasarkan option.value.
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
                        value.toLowerCase()
                    );
                }
            );

        if (directOption) {

            select.value =
                directOption.value;

            return true;
        }

        /*
         * 2. Cari Provider berdasarkan:
         *    - id
         *    - provider_id
         *    - provider
         */
        const provider =
            getProviderById(
                value
            );

        if (!provider) {
            return false;
        }

        /*
         * 3. Gunakan provider_id sebagai value dropdown.
         */
        const providerValue =
            String(
                provider.provider_id ??
                provider.provider ??
                provider.id ??
                ""
            ).trim();

        if (!providerValue) {
            return false;
        }

        const option =
            Array.from(
                select.options
            ).find(
                function (item) {

                    return (
                        String(
                            item.value ??
                            ""
                        )
                            .trim()
                            .toLowerCase() ===
                        providerValue.toLowerCase()
                    );
                }
            );

        if (!option) {
            return false;
        }

        select.value =
            option.value;

        return true;
    }


    /* =====================================================
       CLEAR SELECT
    ===================================================== */

    function clear() {

        const select =
            getProviderSelect();

        if (select) {

            select.value =
                "";
        }
    }


    /* =====================================================
       DESTROY
    ===================================================== */

    function destroy() {

        providers =
            [];

        initialized =
            false;
    }


    /* =====================================================
       PUBLIC API
    ===================================================== */

    window.GENZModelsProvider =
        Object.freeze({

            initialize,

            refresh,

            loadProviders,

            populateSelect,

            getProviders,

            getProviderById,

            getProviderValue,

            setValue,

            clear,

            destroy
        });


    console.log(
        "[GEN-Z.AI] GENZModelsProvider loaded."
    );

})();
