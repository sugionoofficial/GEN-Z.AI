/* =========================================================
   GEN-Z.AI
   MODEL PROVIDER DROPDOWN
   ---------------------------------------------------------
   File:
   admin-control/models/functions/model-provider-dropdown.js

   TANGGUNG JAWAB:
   - Mengontrol dropdown #providerId
   - Render Provider
   - Set Provider
   - Clear Provider
   - Membaca Provider terpilih
   - Menjaga nilai models.provider_id = providers.id
   - Menyediakan provider code untuk kebutuhan lain

   ATURAN DATABASE:
   ---------------------------------------------------------
   providers.id
        ↓
   models.provider_id

   providers.provider_id
        ↓
   provider_credentials.provider_id

   JANGAN menukar kedua field tersebut.

   Module ini:
   - TIDAK query Supabase
   - TIDAK query KIE
   - TIDAK melakukan CRUD Model
   - TIDAK membuat provider baru
   - TIDAK mengarang provider_id
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
       STRING
       ===================================================== */

    function normalizeString(value) {

        return String(
            value ?? ""
        ).trim();

    }


    function normalizeKey(value) {

        return normalizeString(
            value
        ).toLowerCase();

    }


    /* =====================================================
       UUID
       ===================================================== */

    function isUuidLike(value) {

        const text =
            normalizeString(
                value
            );

        if (!text) {
            return false;
        }

        return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
            .test(text);

    }


    /* =====================================================
       BOOLEAN
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

    function normalizeProvider(provider) {

        if (
            !provider ||
            typeof provider !== "object"
        ) {

            return null;

        }


        /*
         * PRIMARY DATABASE ID
         *
         * Ini yang harus masuk ke:
         *
         * models.provider_id
         */

        const recordId =
            normalizeString(
                provider.id ??
                provider.uuid ??
                provider.provider_uuid
            );


        /*
         * PROVIDER CODE
         *
         * Ini digunakan untuk:
         *
         * provider_credentials.provider_id
         *
         * dan identitas provider di API.
         */

        const providerCode =
            normalizeString(
                provider.provider_id ??
                provider.provider ??
                provider.code ??
                ""
            );


        /*
         * Jangan membuat provider code dari UUID.
         *
         * Kalau data Provider benar-benar tidak punya
         * provider_id, gunakan kosong.
         */

        const providerName =
            normalizeString(
                provider.provider_name ??
                provider.name ??
                provider.display_name ??
                providerCode ??
                recordId ??
                ""
            );


        const status =
            normalizeString(
                provider.status ??
                provider.state ??
                ""
            );


        const explicitActive =
            normalizeBoolean(
                provider.is_active ??
                provider.active ??
                provider.enabled
            );


        /*
         * Provider harus punya database ID.
         *
         * Karena models.provider_id adalah FK
         * ke providers.id.
         */

        if (!recordId) {

            return null;

        }


        return {

            ...provider,

            /*
             * Database primary key
             */

            id:
                recordId,


            /*
             * Provider code
             */

            provider_id:
                providerCode,


            /*
             * Display name
             */

            provider_name:
                providerName ||
                providerCode ||
                recordId,


            /*
             * Status
             */

            status:


                status,


            /*
             * Active state
             */

            is_active:
                explicitActive,

            active:
                explicitActive

        };

    }


    /* =====================================================
       NORMALIZE PROVIDER LIST
       ===================================================== */

    function normalizeProviders(list) {

        if (
            !Array.isArray(list)
        ) {

            return [];

        }


        const result = [];

        const seenIds =
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


                const idKey =
                    normalizeKey(
                        provider.id
                    );


                if (!idKey) {
                    return;
                }


                /*
                 * Deduplicate berdasarkan
                 * providers.id.
                 */

                if (
                    seenIds.has(
                        idKey
                    )
                ) {

                    return;

                }


                seenIds.add(
                    idKey
                );


                result.push(
                    provider
                );

            }
        );


        return result;

    }


    /* =====================================================
       ACTIVE
       ===================================================== */

    function isActive(provider) {

        if (
            !provider ||
            typeof provider !== "object"
        ) {

            return false;

        }


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


        const status =
            normalizeKey(
                provider.status
            );


        /*
         * Jika tidak ada status sama sekali,
         * pertahankan kompatibilitas data lama.
         */

        if (!status) {

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
       FIND BY DATABASE ID
       ===================================================== */

    function findById(id) {

        const value =
            normalizeKey(
                id
            );


        if (!value) {

            return null;

        }


        return (

            providers.find(
                function (provider) {

                    return (
                        normalizeKey(
                            provider.id
                        ) ===
                        value
                    );

                }
            ) ||

            null

        );

    }


    /* =====================================================
       FIND BY PROVIDER CODE
       ===================================================== */

    function findByCode(code) {

        const value =
            normalizeKey(
                code
            );


        if (!value) {

            return null;

        }


        return (

            providers.find(
                function (provider) {

                    return (
                        normalizeKey(
                            provider.provider_id
                        ) ===
                        value
                    );

                }
            ) ||

            null

        );

    }


    /* =====================================================
       FIND PROVIDER
       -----------------------------------------------------
       Mendukung:
       - providers.id
       - providers.provider_id
       - provider
       - code
       - provider_name
       ===================================================== */

    function findProvider(value) {

        const key =
            normalizeKey(
                value
            );


        if (!key) {

            return null;

        }


        return (

            findById(
                value
            ) ||

            findByCode(
                value
            ) ||

            providers.find(
                function (provider) {

                    return (

                        normalizeKey(
                            provider.provider
                        ) === key ||

                        normalizeKey(
                            provider.code
                        ) === key ||

                        normalizeKey(
                            provider.provider_name
                        ) === key

                    );

                }
            ) ||

            null

        );

    }


    /* =====================================================
       REQUESTED VALUE
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
       IMPORTANT:
       option.value = providers.id
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


        providers =
            normalizeProviders(
                list
            );


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
         * Nilai sebelumnya dapat berupa:
         *
         * - providers.id
         * - provider_id lama
         * - provider code
         * - provider name
         *
         * Kita resolve hanya dari data Provider.
         */

        const requestedValue =
            getRequestedValue(
                select,
                options
            );


        const selectedProvider =
            requestedValue
                ? findProvider(
                    requestedValue
                )
                : null;


        /*
         * Jika Provider terpilih aktif tetapi tidak ada
         * di source, masukkan kembali.
         *
         * Provider inactive TIDAK dipaksa menjadi aktif.
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
                            provider.id
                        ) ===
                        normalizeKey(
                            selectedProvider.id
                        )
                    );

                }
            )
        ) {

            source.push(
                selectedProvider
            );

        }


        /* =================================================
           BUILD OPTIONS
        ================================================= */

        const fragment =
            document.createDocumentFragment();


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


        source.forEach(
            function (provider) {

                const databaseId =
                    normalizeString(
                        provider.id
                    );


                if (!databaseId) {

                    return;

                }


                const option =
                    document.createElement(
                        "option"
                    );


                /*
                 * =================================================
                 * INI BAGIAN PALING PENTING
                 * =================================================
                 *
                 * models.provider_id -> providers.id
                 *
                 * Jadi value HARUS database UUID.
                 */

                option.value =
                    databaseId;


                const providerName =
                    normalizeString(
                        provider.provider_name
                    ) ||
                    normalizeString(
                        provider.provider_id
                    ) ||
                    databaseId;


                const providerCode =
                    normalizeString(
                        provider.provider_id
                    );


                option.textContent =
                    providerCode &&
                    providerName !== providerCode

                        ?

                        (
                            providerName +
                            " (" +
                            providerCode +
                            ")"
                        )

                        :

                        providerName;


                /*
                 * Dataset database ID.
                 */

                option.dataset.providerUuid =
                    databaseId;


                option.dataset.providerId =
                    providerCode;


                option.dataset.providerName =
                    providerName;


                if (
                    provider.status
                ) {

                    option.dataset.status =
                        String(
                            provider.status
                        );

                }


                option.dataset.active =
                    isActive(
                        provider
                    )
                        ? "true"
                        : "false";


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
           RESTORE SELECTED PROVIDER
        ================================================= */

        if (
            selectedProvider
        ) {

            const selectedDatabaseId =
                normalizeString(
                    selectedProvider.id
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
                                selectedDatabaseId
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

        }


        /*
         * Jika options.value berupa provider code
         * atau nama, selectedProvider di atas sudah
         * mengkonversinya ke UUID.
         */


        console.info(
            "[GEN-Z.AI] Provider dropdown rendered:",
            source.length
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


        /*
         * select.value sekarang adalah
         * providers.id.
         */

        return findById(
            select.value
        );

    }


    /* =====================================================
       GET SELECTED DATABASE ID
       ===================================================== */

    function getSelectedId() {

        const provider =
            getSelected();


        return provider
            ? normalizeString(
                provider.id
            )
            : "";

    }


    /* =====================================================
       GET SELECTED PROVIDER CODE
       ===================================================== */

    function getSelectedCode() {

        const provider =
            getSelected();


        return provider
            ? normalizeString(
                provider.provider_id
            )
            : "";

    }


    /* =====================================================
       SET VALUE
       -----------------------------------------------------
       Input boleh:
       - providers.id
       - providers.provider_id
       - provider name
       - provider/code legacy

       Tetapi hasil select.value SELALU:
       providers.id
       ===================================================== */

    function setValue(
        providerValue,
        options = {}
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


        /* =================================================
           CLEAR
        ================================================= */

        if (!value) {

            select.value =
                "";


            if (
                options.dispatch !== false
            ) {

                dispatchProviderChanged(
                    "",
                    null
                );

            }


            return true;

        }


        /* =================================================
           RESOLVE
        ================================================= */

        const provider =
            findProvider(
                value
            );


        if (!provider) {

            console.warn(
                "[GEN-Z.AI] Provider tidak ditemukan:",
                providerValue
            );

            return false;

        }


        const databaseId =
            normalizeString(
                provider.id
            );


        if (!databaseId) {

            return false;

        }


        /*
         * models.provider_id menggunakan
         * providers.id.
         */

        select.value =
            databaseId;


        if (
            select.value !==
            databaseId
        ) {

            return false;

        }


        if (
            options.dispatch !== false
        ) {

            dispatchProviderChanged(
                databaseId,
                provider
            );

        }


        return true;

    }


    /* =====================================================
       DISPATCH PROVIDER CHANGE
       ===================================================== */

    function dispatchProviderChanged(
        databaseId,
        provider = null
    ) {

        try {

            document.dispatchEvent(
                new CustomEvent(
                    "genz-models-provider-changed",
                    {
                        detail: {

                            /*
                             * Primary value:
                             * providers.id
                             */

                            providerId:
                                databaseId,


                            /*
                             * Explicit database ID.
                             */

                            providerDbId:
                                databaseId,


                            /*
                             * Provider code.
                             */

                            providerCode:
                                provider
                                    ? normalizeString(
                                        provider.provider_id
                                    )
                                    : "",


                            providerName:
                                provider
                                    ? normalizeString(
                                        provider.provider_name
                                    )
                                    : "",


                            recordId:
                                provider
                                    ? normalizeString(
                                        provider.id
                                    )
                                    : databaseId

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

    function clear(
        options = {}
    ) {

        return setValue(
            "",
            options
        );

    }


    /* =====================================================
       INITIALIZE
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


            return render(
                list,
                {
                    activeOnly:
                        options.activeOnly !== false,

                    value:
                        options.value
                }
            );

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
             * Provider module adalah pemilik data.
             */

            if (
                typeof providerModule.refresh ===
                "function"
            ) {

                providerList =
                    await providerModule.refresh(
                        {
                            force:
                                options.force !== false,

                            activeOnly:
                                options.activeOnly !== false
                        }
                    );

            } else if (
                typeof providerModule.loadProviders ===
                "function"
            ) {

                providerList =
                    await providerModule.loadProviders(
                        {
                            force:
                                options.force !== false,

                            activeOnly:
                                options.activeOnly !== false
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


            providers =
                normalizeProviders(
                    list
                );


            /*
             * Selalu render ulang.
             *
             * Ini lebih aman setelah Provider berubah.
             */

            render(
                providers,
                {
                    activeOnly:
                        options.activeOnly !== false,

                    value:
                        options.value
                }
            );


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


        if (!select) {

            return;

        }


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

            getSelectedId,

            getSelectedCode,

            setValue,

            clear,

            refresh,

            destroy,

            findProvider,

            findById,

            findByCode,

            isActive,

            normalizeProvider,

            normalizeProviders

        });


    console.info(
        "[GEN-Z.AI] Model Provider Dropdown loaded."
    );


})();
