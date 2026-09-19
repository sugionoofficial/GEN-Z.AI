/* =========================================================
   GEN-Z.AI
   MODEL PROVIDER DROPDOWN
   ---------------------------------------------------------
   File:
   admin-control/models/functions/model-provider-dropdown.js

   TANGGUNG JAWAB:
   - Mengontrol dropdown #providerId
   - Render daftar Provider
   - Set Provider
   - Clear Provider
   - Membaca Provider terpilih
   - Kompatibilitas UUID / provider_id / provider / name
   - Menjaga Provider aktif tetap tersedia

   ATURAN:
   - Module ini TIDAK query Supabase
   - Data Provider hanya berasal dari GENZModelsProvider
   - Tidak membuat listener global
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
       VALUE NORMALIZER
    ===================================================== */

    function normalizeString(value) {

        return String(
            value ?? ""
        )
            .trim();

    }


    function normalizeKey(value) {

        return normalizeString(
            value
        )
            .toLowerCase();

    }


    /* =====================================================
       BOOLEAN NORMALIZER
       -----------------------------------------------------
       Mendukung:
       true / false
       "true" / "false"
       1 / 0
       "1" / "0"
       ===================================================== */

    function normalizeBoolean(value) {

        if (
            value === true ||
            value === 1
        ) {
            return true;
        }

        if (
            value === false ||
            value === 0
        ) {
            return false;
        }

        const normalized =
            normalizeKey(
                value
            );

        if (
            normalized === "true" ||
            normalized === "1" ||
            normalized === "yes" ||
            normalized === "active" ||
            normalized === "enabled"
        ) {
            return true;
        }

        if (
            normalized === "false" ||
            normalized === "0" ||
            normalized === "no" ||
            normalized === "inactive" ||
            normalized === "disabled"
        ) {
            return false;
        }

        return null;

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


        /*
         * UUID / database record ID.
         */

        const recordId =
            normalizeString(
                provider.id ??
                provider.uuid ??
                provider.provider_uuid
            );


        /*
         * Provider ID resmi.
         *
         * Jangan membuat provider_id baru.
         * Ambil hanya dari data Provider yang diberikan.
         */

        const providerId =
            normalizeString(
                provider.provider_id ??
                provider.provider ??
                provider.code ??
                (
                    provider.id &&
                    !isUuidLike(
                        provider.id
                    )
                        ? provider.id
                        : ""
                )
            );


        /*
         * Jika hanya ada UUID tanpa provider_id,
         * UUID tetap boleh dipakai sebagai fallback
         * untuk kompatibilitas data lama.
         */

        const effectiveProviderId =
            providerId ||
            recordId;


        if (!effectiveProviderId) {

            return null;

        }


        const providerName =
            normalizeString(
                provider.provider_name ??
                provider.name ??
                provider.display_name ??
                effectiveProviderId
            );


        const status =
            normalizeString(
                provider.status ??
                provider.state ??
                ""
            );


        /*
         * Simpan informasi active dari berbagai
         * kemungkinan bentuk data Supabase.
         */

        const explicitActive =
            normalizeBoolean(
                provider.is_active ??
                provider.active ??
                provider.enabled
            );


        return {

            ...provider,

            id:
                recordId ||
                null,

            provider_id:
                effectiveProviderId,

            provider_name:
                providerName ||
                effectiveProviderId,

            status:

                status,

            is_active:

                explicitActive,

            active:

                explicitActive

        };

    }


    /* =====================================================
       UUID DETECTION
    ===================================================== */

    function isUuidLike(
        value
    ) {

        const text =
            normalizeString(
                value
            );

        if (!text) {
            return false;
        }

        return (
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
                .test(text)
        );

    }


    /* =====================================================
       NORMALIZE PROVIDERS
       -----------------------------------------------------
       Penting:
       Jangan menganggap provider_name sebagai unique key.

       Dua record Provider dapat secara sah memiliki
       nama yang sama tetapi ID berbeda.
       ===================================================== */

    function normalizeProviders(
        list
    ) {

        if (
            !Array.isArray(
                list
            )
        ) {
            return [];
        }


        const result = [];

        const seenRecordIds =
            new Set();

        const seenProviderIds =
            new Set();


        list.forEach(
            function (item) {

                const provider =
                    normalizeProvider(
                        item
                    );


                if (!provider) {
                    return;
                }


                const recordKey =
                    normalizeKey(
                        provider.id
                    );

                const providerKey =
                    normalizeKey(
                        provider.provider_id
                    );


                /*
                 * Deduplicate berdasarkan ID sebenarnya.
                 *
                 * Jangan memakai provider_name sebagai key.
                 */

                if (
                    recordKey &&
                    seenRecordIds.has(
                        recordKey
                    )
                ) {
                    return;
                }


                if (
                    providerKey &&
                    seenProviderIds.has(
                        providerKey
                    )
                ) {
                    return;
                }


                if (recordKey) {

                    seenRecordIds.add(
                        recordKey
                    );

                }


                if (providerKey) {

                    seenProviderIds.add(
                        providerKey
                    );

                }


                result.push(
                    provider
                );

            }
        );


        return result;

    }


    /* =====================================================
       ACTIVE STATUS
       -----------------------------------------------------
       Prioritas:
       1. is_active / active / enabled
       2. status
       3. status kosong = aktif untuk kompatibilitas lama
       ===================================================== */

    function isActive(
        provider
    ) {

        if (
            !provider ||
            typeof provider !== "object"
        ) {
            return false;
        }


        /*
         * Explicit boolean state.
         */

        const explicitActive =
            normalizeBoolean(
                provider.is_active ??
                provider.active ??
                provider.enabled
            );


        if (
            explicitActive !== null
        ) {

            return explicitActive;

        }


        /*
         * Status text.
         */

        const status =
            normalizeKey(
                provider.status ??
                provider.state
            );


        if (!status) {

            /*
             * Data lama tanpa status tetap dianggap aktif.
             */

            return true;

        }


        return (
            status === "active" ||
            status === "enabled" ||
            status === "enable" ||
            status === "on" ||
            status === "true" ||
            status === "1"
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
            normalizeKey(
                providerValue
            );


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

                        provider.code,

                        provider.provider_name,

                        provider.name

                    ];


                    return candidates.some(
                        function (candidate) {

                            return (
                                normalizeKey(
                                    candidate
                                ) ===
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
       GET SELECTED VALUE
       ===================================================== */

    function getRequestedValue(
        select,
        options
    ) {

        if (
            options &&
            options.value !== undefined &&
            options.value !== null
        ) {

            return normalizeString(
                options.value
            );

        }


        if (select) {

            return normalizeString(
                select.value
            );

        }


        return "";

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
         * Normalisasi state.
         */

        providers =
            normalizeProviders(
                list
            );


        /*
         * Filter aktif.
         *
         * Default true.
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
         * Nilai yang sebelumnya dipilih.
         */

        const requestedValue =
            getRequestedValue(
                select,
                options
            );


        /*
         * Cari Provider dari seluruh state,
         * bukan hanya source hasil filter.
         *
         * Ini penting ketika edit record lama.
         */

        const selectedProvider =
            requestedValue
                ? findProvider(
                    requestedValue
                )
                : null;


        /*
         * Jika selected Provider ternyata aktif,
         * pastikan ada di source.
         *
         * Jika inactive dan activeOnly=true,
         * jangan diam-diam memasukkannya sebagai aktif.
         */

        if (
            selectedProvider &&
            activeOnly &&
            isActive(
                selectedProvider
            ) &&
            !source.some(
                function (provider) {

                    return (
                        normalizeKey(
                            provider.provider_id
                        ) ===
                        normalizeKey(
                            selectedProvider.provider_id
                        )
                    );

                }
            )
        ) {

            source.push(
                selectedProvider
            );

        }


        /*
         * Jika activeOnly=false,
         * seluruh Provider dipertahankan.
         */


        /* =================================================
           BUILD FRAGMENT
        ================================================= */

        const fragment =
            document.createDocumentFragment();


        /*
         * Placeholder.
         */

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


        /*
         * Provider options.
         */

        source.forEach(
            function (provider) {

                const providerValue =
                    normalizeString(
                        provider.provider_id
                    );


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
                 * Selalu provider_id.
                 */

                option.value =
                    providerValue;


                const providerName =
                    normalizeString(
                        provider.provider_name
                    ) ||
                    providerValue;


                option.textContent =
                    providerName !==
                        providerValue

                        ?

                        (
                            providerName +
                            " (" +
                            providerValue +
                            ")"
                        )

                        :

                        providerValue;


                /*
                 * Database UUID.
                 */

                if (
                    provider.id
                ) {

                    option.dataset.providerUuid =
                        String(
                            provider.id
                        );

                }


                /*
                 * Provider ID.
                 */

                option.dataset.providerId =
                    providerValue;


                /*
                 * Provider name.
                 */

                option.dataset.providerName =
                    providerName;


                /*
                 * Status.
                 */

                if (
                    provider.status
                ) {

                    option.dataset.status =
                        String(
                            provider.status
                        );

                }


                /*
                 * Active state.
                 */

                if (
                    provider.is_active !== null &&
                    provider.is_active !== undefined
                ) {

                    option.dataset.active =
                        provider.is_active
                            ? "true"
                            : "false";

                } else {

                    option.dataset.active =
                        isActive(
                            provider
                        )
                            ? "true"
                            : "false";

                }


                /*
                 * Default Provider.
                 */

                if (
                    provider.is_default === true ||
                    provider.is_default === 1 ||
                    provider.is_default === "true"
                ) {

                    option.dataset.default =
                        "true";

                }


                fragment.appendChild(
                    option
                );

            }
        );


        /*
         * Replace options satu kali.
         */

        select.replaceChildren(
            fragment
        );


        /* =================================================
           RESTORE VALUE
        ================================================= */

        if (
            selectedProvider
        ) {

            const selectedId =
                normalizeString(
                    selectedProvider.provider_id
                );


            const matchingOption =
                Array.from(
                    select.options
                ).find(
                    function (option) {

                        return (
                            normalizeKey(
                                option.value
                            ) ===
                            normalizeKey(
                                selectedId
                            )
                        );

                    }
                );


            if (
                matchingOption
            ) {

                select.value =
                    matchingOption.value;

            }

        } else if (
            requestedValue
        ) {

            /*
             * Direct fallback.
             */

            const directOption =
                Array.from(
                    select.options
                ).find(
                    function (option) {

                        return (
                            normalizeKey(
                                option.value
                            ) ===
                            normalizeKey(
                                requestedValue
                            )
                        );

                    }
                );


            if (
                directOption
            ) {

                select.value =
                    directOption.value;

            }

        }


        console.info(
            "[GEN-Z.AI] Provider dropdown rendered:",
            source.length,
            "active:",
            source.filter(
                isActive
            ).length
        );


        return true;

    }


    /* =====================================================
       SET PROVIDERS
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
            normalizeString(
                providerValue
            );


        /*
         * CLEAR
         */

        if (!value) {

            select.value =
                "";


            dispatchProviderChanged(
                ""
            );


            return true;

        }


        /*
         * FIND STATE
         */

        const provider =
            findProvider(
                value
            );


        if (
            provider
        ) {

            const providerId =
                normalizeString(
                    provider.provider_id
                );


            if (!providerId) {
                return false;
            }


            select.value =
                providerId;


            if (
                select.value !==
                providerId
            ) {

                return false;

            }


            dispatchProviderChanged(
                providerId,
                provider
            );


            return true;

        }


        /*
         * DIRECT OPTION FALLBACK
         */

        const directOption =
            Array.from(
                select.options
            ).find(
                function (option) {

                    return (
                        normalizeKey(
                            option.value
                        ) ===
                        normalizeKey(
                            value
                        )
                    );

                }
            );


        if (
            !directOption
        ) {

            console.warn(
                "[GEN-Z.AI] Provider tidak ditemukan:",
                providerValue
            );

            return false;

        }


        select.value =
            directOption.value;


        dispatchProviderChanged(
            select.value,
            null
        );


        return true;

    }


    /* =====================================================
       DISPATCH PROVIDER CHANGE
       ===================================================== */

    function dispatchProviderChanged(
        providerId,
        provider = null
    ) {

        try {

            document.dispatchEvent(
                new CustomEvent(
                    "genz-models-provider-changed",
                    {
                        detail: {

                            providerId:
                                providerId,

                            providerName:
                                provider
                                    ? (
                                        provider.provider_name ||
                                        ""
                                    )
                                    : "",

                            recordId:
                                provider
                                    ? (
                                        provider.id ||
                                        ""
                                    )
                                    : ""

                        }
                    }
                )
            );

        } catch (error) {

            console.warn(
                "[GEN-Z.AI] Provider change event gagal:",
                error
            );

        }

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


        dispatchProviderChanged(
            ""
        );


        return true;

    }


    /* =====================================================
       INITIALIZE
       -----------------------------------------------------
       Tidak query Supabase.
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


            const result =
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
                "[GEN-Z.AI] Provider dropdown initialized."
            );


            return result;

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
       Refresh hanya meminta data dari Provider owner.

       Tidak ada recursive:
       refresh()
         -> provider.refresh()
         -> dropdown.refresh()
         -> provider.refresh()
         -> ...
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
             * PRIORITAS Provider.refresh()
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
                 * Fallback versi lama.
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
                    typeof providerModule.getProviders ===
                    "function"

                        ?

                        providerModule.getProviders()

                        :

                        [];

            }


            const list =
                Array.isArray(
                    providerList
                )
                    ? providerList
                    : [];


            /*
             * Update state lokal.
             */

            providers =
                normalizeProviders(
                    list
                );


            /*
             * Jangan render kedua kali jika Provider
             * owner sudah mengisi dropdown.
             *
             * Tetapi jika dropdown kosong,
             * render lokal.
             */

            const select =
                getSelect();


            const hasProviderOptions =
                !!(
                    select &&
                    select.options &&
                    select.options.length > 1
                );


            if (
                !hasProviderOptions
            ) {

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

            const option =
                document.createElement(
                    "option"
                );


            option.value =
                "";

            option.textContent =
                "Pilih Provider";


            select.replaceChildren(
                option
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
