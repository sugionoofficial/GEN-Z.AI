/* =========================================================
   GEN-Z.AI
   MODEL PROVIDER DROPDOWN
   ---------------------------------------------------------
   File:
   admin-control/models/functions/model-provider-dropdown.js

   Tanggung jawab:
   - Render dropdown Provider
   - Set Provider
   - Clear Provider
   - Refresh dropdown
   - Menjaga kompatibilitas provider.id / provider_id

   FIX:
   - Value dropdown menggunakan provider_id
   - Edit Model dapat memilih provider yang tersimpan
   - Mendukung input UUID provider.id maupun provider_id
   - Tidak mengubah CRUD Model
   - Tidak mengubah Provider Management
   - Hanya memperbaiki sinkronisasi Provider -> Model
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

    function normalizeProvider(provider) {

        if (
            !provider ||
            typeof provider !== "object"
        ) {
            return null;
        }


        /*
         * UUID record provider.
         */
        const recordId =
            String(
                provider.id ??
                ""
            ).trim();


        /*
         * Provider identifier yang digunakan
         * oleh kie_models.provider.
         *
         * Contoh:
         *
         * bytedance
         * kie
         * openai
         */
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
                "active"
            ).trim();


        return {

            /*
             * UUID database.
             */
            id:
                recordId,


            /*
             * Identifier provider.
             *
             * INI yang menjadi value dropdown.
             */
            provider_id:
                providerId,


            provider_name:
                providerName,


            status:
                status,


            /*
             * Pertahankan field lain jika ada.
             */
            ...provider,

            /*
             * Pastikan field hasil normalisasi
             * tetap menjadi nilai final.
             */
            id:
                recordId,

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

    function normalizeProviders(list) {

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


                /*
                 * Provider dianggap unik berdasarkan
                 * provider_id, bukan UUID record.
                 */
                const key =
                    provider.provider_id
                        .trim()
                        .toLowerCase();


                if (seen.has(key)) {
                    return;
                }


                seen.add(key);

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

    function isActive(provider) {

        const status =
            String(
                provider?.status ??
                ""
            )
                .trim()
                .toLowerCase();


        /*
         * Status kosong dianggap aktif untuk
         * kompatibilitas data lama.
         */

        return (
            !status ||
            status === "active" ||
            status === "enabled"
        );
    }


    /* =====================================================
       FIND PROVIDER
       Mendukung:
       - provider_id
       - UUID id
       - provider name
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

                    const providerId =
                        String(
                            provider.provider_id ??
                            ""
                        )
                            .trim()
                            .toLowerCase();


                    const recordId =
                        String(
                            provider.id ??
                            ""
                        )
                            .trim()
                            .toLowerCase();


                    const providerName =
                        String(
                            provider.provider_name ??
                            ""
                        )
                            .trim()
                            .toLowerCase();


                    return (
                        providerId === value ||
                        recordId === value ||
                        providerName === value
                    );
                }
            ) ||
            null
        );
    }


    /* =====================================================
       RENDER
    ===================================================== */

    function render(list) {

        const select =
            getSelect();


        if (!select) {

            console.warn(
                "[GEN-Z.AI] #providerId tidak ditemukan."
            );

            return false;
        }


        /*
         * Normalisasi provider.
         */
        providers =
            normalizeProviders(
                list
            );


        /*
         * Simpan value yang sedang dipilih
         * sebelum option diganti.
         */
        const currentValue =
            String(
                select.value ??
                ""
            ).trim();


        /*
         * Jika sebelumnya kosong tetapi
         * ada data dari attribute/value,
         * coba ambil.
         */
        const previousValue =
            currentValue;


        /* -------------------------------------------------
           CLEAR
        ------------------------------------------------- */

        select.innerHTML = "";


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


        select.appendChild(
            placeholder
        );


        /* -------------------------------------------------
           PROVIDER OPTIONS
        ------------------------------------------------- */

        providers
            .filter(isActive)
            .forEach(
                function (provider) {

                    const option =
                        document.createElement(
                            "option"
                        );


                    /*
                     * PENTING:
                     *
                     * Value menggunakan provider_id,
                     * BUKAN UUID provider.id.
                     *
                     * Karena kie_models.provider
                     * menyimpan provider_id.
                     */
                    option.value =
                        provider.provider_id;


                    /*
                     * Tampilkan nama provider.
                     *
                     * Contoh:
                     * ByteDance (bytedance)
                     */
                    const name =
                        provider.provider_name ||
                        provider.provider_id;


                    if (
                        name &&
                        name !==
                            provider.provider_id
                    ) {

                        option.textContent =
                            name +
                            " (" +
                            provider.provider_id +
                            ")";

                    } else {

                        option.textContent =
                            provider.provider_id;
                    }


                    /*
                     * Simpan metadata tambahan.
                     */
                    option.dataset.providerId =
                        provider.provider_id;


                    if (provider.id) {

                        option.dataset.recordId =
                            provider.id;
                    }


                    option.dataset.providerName =
                        provider.provider_name ||
                        provider.provider_id;


                    select.appendChild(
                        option
                    );
                }
            );


        /* -------------------------------------------------
           RESTORE CURRENT VALUE
        ------------------------------------------------- */

        if (previousValue) {

            const selectedProvider =
                findProvider(
                    previousValue
                );


            if (selectedProvider) {

                select.value =
                    selectedProvider.provider_id;
            }
        }


        return true;
    }


    /* =====================================================
       SET PROVIDERS
    ===================================================== */

    function setProviders(list) {

        return render(list);
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
       - provider.id UUID
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
           FIND PROVIDER
        ------------------------------------------------- */

        const provider =
            findProvider(
                value
            );


        if (!provider) {

            /*
             * Fallback langsung ke option value.
             *
             * Ini menjaga kompatibilitas jika
             * provider belum masuk state tetapi
             * option sudah tersedia.
             */
            const directExists =
                Array.from(
                    select.options
                ).some(
                    function (option) {

                        return (
                            String(
                                option.value
                            ).trim()
                            .toLowerCase() ===
                            value.toLowerCase()
                        );
                    }
                );


            if (!directExists) {

                console.warn(
                    "[GEN-Z.AI] Provider tidak ditemukan di dropdown:",
                    providerValue
                );

                return false;
            }


            select.value =
                value;


            document.dispatchEvent(
                new CustomEvent(
                    "genz-models-provider-changed",
                    {
                        detail: {
                            providerId:
                                value
                        }
                    }
                )
            );


            return true;
        }


        /* -------------------------------------------------
           SET NORMALIZED PROVIDER_ID
        ------------------------------------------------- */

        select.value =
            provider.provider_id;


        /*
         * Pastikan benar-benar terpilih.
         */
        if (
            select.value !==
            provider.provider_id
        ) {

            return false;
        }


        /* -------------------------------------------------
           EVENT
        ------------------------------------------------- */

        document.dispatchEvent(
            new CustomEvent(
                "genz-models-provider-changed",
                {
                    detail: {

                        providerId:
                            provider.provider_id,

                        providerName:
                            provider.provider_name,

                        recordId:
                            provider.id || ""
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
       REFRESH
    ===================================================== */

    function refresh() {

        const data =
            window.GENZModelsData;


        if (
            !data ||
            typeof data.loadProviders !==
                "function"
        ) {

            console.warn(
                "[GEN-Z.AI] GENZModelsData.loadProviders() tidak tersedia."
            );

            return false;
        }


        return data
            .loadProviders(
                {
                    force: true,
                    activeOnly: false
                }
            )
            .then(
                function (result) {

                    const list =
                        Array.isArray(
                            result
                        )
                            ? result
                            : [];


                    render(
                        list
                    );


                    return list;
                }
            );
    }


    /* =====================================================
       INITIALIZE
    ===================================================== */

    function initialize() {

        const data =
            window.GENZModelsData;


        /* -------------------------------------------------
           CACHE
        ------------------------------------------------- */

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

                render(
                    cached
                );


                return true;
            }
        }


        /* -------------------------------------------------
           LOAD
        ------------------------------------------------- */

        if (
            data &&
            typeof data.loadProviders ===
                "function"
        ) {

            return data
                .loadProviders(
                    {
                        force: false,
                        activeOnly: false
                    }
                )
                .then(
                    function (result) {

                        render(
                            Array.isArray(
                                result
                            )
                                ? result
                                : []
                        );


                        return true;
                    }
                );
        }


        console.warn(
            "[GEN-Z.AI] Provider data module belum tersedia."
        );


        return false;
    }


    /* =====================================================
       DESTROY
    ===================================================== */

    function destroy() {

        providers = [];
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
