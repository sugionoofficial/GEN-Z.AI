    /* =====================================================
       POPULATE
       -----------------------------------------------------
       FLOW:

       1. Simpan record Supabase
       2. Isi editable data dari Supabase
       3. Provider silent
       4. Load catalog KIE
       5. Cari Model ID
       6. Set Model KIE
       7. WAJIB pastikan KIE config tersedia
       8. Render capability
       9. Terapkan selection Supabase
       10. KIE identity readonly
       11. KIE price readonly
       12. Credit preview

       CATATAN:
       Tidak mengandalkan refresh() sebagai satu-satunya
       mekanisme untuk memuat KIE config.
    ===================================================== */

    async function populate(
        model
    ) {

        if (!model) {

            return false;

        }


        editingModel =
            {
                ...model
            };


        console.info(
            "[MODEL EDIT] ========================================"
        );

        console.info(
            "[MODEL EDIT] OPEN MODEL EDIT"
        );

        console.info(
            "[MODEL EDIT] Supabase record:",
            model
        );


        /*
         * =================================================
         * RECORD ID
         * =================================================
         */

        setValue(
            "modelRecordId",
            model.id || ""
        );


        /*
         * =================================================
         * EDITABLE DATABASE DATA
         * =================================================
         */

        setValue(
            "description",
            model.description || ""
        );


        setValue(
            "creditCost",
            model.credit_cost ?? ""
        );


        setValue(
            "discountPercent",
            model.discount_percent ?? 0
        );


        setValue(
            "creditFinal",
            model.credit_final ?? ""
        );


        setValue(
            "modelStatus",
            model.status ||
            "active"
        );


        /*
         * =================================================
         * EXISTING MODEL ID
         * =================================================
         *
         * Model ID HARUS berasal dari record Supabase.
         */

        const existingModelId =
            String(
                model.model_id ||
                model.modelId ||
                ""
            ).trim();


        if (!existingModelId) {

            throw new Error(
                "Record model tidak memiliki Model ID."
            );

        }


        console.info(
            "[MODEL EDIT] Model ID:",
            existingModelId
        );


        /*
         * =================================================
         * PROVIDER
         * =================================================
         */

        const providerIdentifier =
            String(
                model.provider_id ||
                model.provider ||
                model.provider_code ||
                model.provider_uuid ||
                ""
            ).trim();


        console.info(
            "[MODEL EDIT] Provider:",
            providerIdentifier
        );


        if (providerIdentifier) {

            await setProvider(
                providerIdentifier,
                true
            );

        }


        /*
         * =================================================
         * LAYOUT
         * =================================================
         */

        const layout =
            getFormLayout();


        if (!layout) {

            throw new Error(
                "GENZModelFormLayout belum tersedia."
            );

        }


        /*
         * =================================================
         * LOAD MODEL CATALOG
         * =================================================
         */

        if (
            typeof layout.loadActiveModels !==
            "function"
        ) {

            throw new Error(
                "GENZModelFormLayout.loadActiveModels() belum tersedia."
            );

        }


        console.info(
            "[MODEL EDIT] Loading KIE model catalog..."
        );


        await layout.loadActiveModels(
            {
                providerId:
                    providerIdentifier,

                selectedModelId:
                    existingModelId
            }
        );


        /*
         * =================================================
         * FIND MODEL
         * =================================================
         */

        if (
            typeof layout.findModel !==
            "function"
        ) {

            throw new Error(
                "GENZModelFormLayout.findModel() belum tersedia."
            );

        }


        let kieModel =
            layout.findModel(
                existingModelId
            );


        /*
         * =================================================
         * FORCE RELOAD CATALOG
         * =================================================
         *
         * Jika model tidak ditemukan pada cache,
         * paksa load ulang satu kali.
         */

        if (!kieModel) {

            console.warn(
                "[MODEL EDIT] Model tidak ditemukan di cache. Force reload..."
            );


            await layout.loadActiveModels(
                {
                    providerId:
                        providerIdentifier,

                    selectedModelId:
                        existingModelId,

                    force:
                        true
                }
            );


            kieModel =
                layout.findModel(
                    existingModelId
                );

        }


        if (!kieModel) {

            throw new Error(
                `Model "${existingModelId}" tidak ditemukan dalam katalog KIE.`
            );

        }


        console.info(
            "[MODEL EDIT] KIE model ditemukan:",
            kieModel
        );


        /*
         * =================================================
         * SET MODEL KIE
         * =================================================
         *
         * Ini adalah titik resmi Layout untuk:
         * - currentModel
         * - current model ID
         * - KIE config
         * - pricing
         * - capability
         */

        if (
            typeof layout.setModel !==
            "function"
        ) {

            throw new Error(
                "GENZModelFormLayout.setModel() belum tersedia."
            );

        }


        console.info(
            "[MODEL EDIT] Set KIE model..."
        );


        await layout.setModel(
            kieModel
        );


        /*
         * =================================================
         * KIE CONFIG
         * =================================================
         *
         * Jangan hanya percaya bahwa setModel()
         * berhasil.
         *
         * Kita cek hasilnya.
         */

        let kieConfig =
            getCurrentKieConfig();


        console.info(
            "[MODEL EDIT] KIE config setelah setModel:",
            kieConfig
        );


        /*
         * =================================================
         * FORCE LOAD KIE CONFIG
         * =================================================
         *
         * Jika currentKieConfig kosong, panggil
         * loadKieConfig secara langsung.
         *
         * Tidak ada hardcoded capability.
         */

        if (!kieConfig) {

            if (
                typeof layout.loadKieConfig !==
                "function"
            ) {

                throw new Error(
                    "GENZModelFormLayout.loadKieConfig() belum tersedia."
                );

            }


            console.warn(
                "[MODEL EDIT] currentKieConfig kosong."
            );


            console.info(
                "[MODEL EDIT] Memanggil loadKieConfig():",
                existingModelId
            );


            /*
             * Layout versi sekarang menerima modelId
             * sebagai parameter utama.
             *
             * Jangan mengirim object/options yang tidak
             * didukung oleh implementasi Layout.
             */

            kieConfig =
                await layout.loadKieConfig(
                    existingModelId
                );


            console.info(
                "[MODEL EDIT] KIE config hasil loadKieConfig:",
                kieConfig
            );

        }


        /*
         * =================================================
         * VALIDASI CONFIG
         * =================================================
         */

        if (!kieConfig) {

            throw new Error(
                `Konfigurasi KIE untuk model "${existingModelId}" tidak tersedia.`
            );

        }


        /*
         * =================================================
         * PARAMETERS
         * =================================================
         */

        const parameters =
            getCurrentParameters();


        console.info(
            "[MODEL EDIT] KIE parameters:",
            parameters
        );


        /*
         * Jangan menganggap parameters kosong sebagai
         * error API secara otomatis.
         *
         * Model bisa memang tidak memiliki parameter.
         *
         * Tetapi capability harus mengikuti data yang
         * benar-benar tersedia.
         */


        /*
         * =================================================
         * KIE IDENTITY
         * =================================================
         */

        setValue(
            "modelCode",
            String(
                kieModel.model_id ||
                existingModelId
            ).trim()
        );


        setValue(
            "modelName",
            String(
                kieModel.model_name ||
                ""
            ).trim()
        );


        setValue(
            "modelFamily",
            String(
                kieModel.model_family ||
                ""
            ).trim()
        );


        /*
         * =================================================
         * READONLY IDENTITY
         * =================================================
         */

        const modelCodeElement =
            getElement(
                "modelCode"
            );


        if (modelCodeElement) {

            modelCodeElement.readOnly =
                true;

            modelCodeElement.dataset.kieManaged =
                "true";

        }


        const modelNameElement =
            getElement(
                "modelName"
            );


        if (modelNameElement) {

            modelNameElement.readOnly =
                true;

            modelNameElement.dataset.kieManaged =
                "true";

        }


        const modelFamilyElement =
            getElement(
                "modelFamily"
            );


        if (modelFamilyElement) {

            modelFamilyElement.readOnly =
                true;

            modelFamilyElement.dataset.kieManaged =
                "true";

        }


        /*
         * =================================================
         * KIE PRICE
         * =================================================
         */

        const kieUnitPrice =
            getElement(
                "kieUnitPrice"
            );


        if (kieUnitPrice) {

            kieUnitPrice.readOnly =
                true;

            kieUnitPrice.dataset.kieManaged =
                "true";

        }


        /*
         * =================================================
         * CAPABILITY
         * =================================================
         *
         * Render terlebih dahulu.
         *
         * Baru kemudian data Supabase diterapkan.
         */

        if (
            typeof layout.renderCapabilities ===
            "function"
        ) {

            console.info(
                "[MODEL EDIT] Render KIE capabilities..."
            );


            layout.renderCapabilities();

        }


        /*
         * =================================================
         * ENABLE EDIT CAPABILITY MODE
         * =================================================
         *
         * Jika Layout mendukung mode editable,
         * aktifkan setelah capability dibuat.
         */

        if (
            typeof layout.setCapabilityEditMode ===
            "function"
        ) {

            layout.setCapabilityEditMode(
                true,
                {
                    ratios:
                        uniqueArray(
                            model.supported_ratios ??
                            model.supportedRatios ??
                            []
                        ),

                    resolutions:
                        uniqueArray(
                            model.supported_resolutions ??
                            model.supportedResolutions ??
                            []
                        ),

                    durations:
                        []
                }
            );

        }


        /*
         * =================================================
         * APPLY SAVED SUPABASE SELECTION
         * =================================================
         */

        applySavedCapabilitySelection(
            model
        );


        /*
         * =================================================
         * SYNC AFTER CHECKBOX
         * =================================================
         */

        syncKieCapabilities();


        /*
         * =================================================
         * DEBUG FINAL CAPABILITY
         * =================================================
         */

        const finalRatios =
            uniqueArray(
                getValue(
                    "supportedRatios"
                )
            );


        const finalResolutions =
            uniqueArray(
                getValue(
                    "supportedResolutions"
                )
            );


        const finalMinDuration =
            getValue(
                "minDuration"
            );


        const finalMaxDuration =
            getValue(
                "maxDuration"
            );


        console.info(
            "[MODEL EDIT] Final ratios:",
            finalRatios
        );


        console.info(
            "[MODEL EDIT] Final resolutions:",
            finalResolutions
        );


        console.info(
            "[MODEL EDIT] Final min duration:",
            finalMinDuration
        );


        console.info(
            "[MODEL EDIT] Final max duration:",
            finalMaxDuration
        );


        /*
         * =================================================
         * CREDIT PREVIEW
         * =================================================
         */

        const priceCalculation =
            getPriceCalculation();


        if (
            priceCalculation &&
            typeof priceCalculation.updatePreview ===
            "function"
        ) {

            try {

                await priceCalculation.updatePreview();

            } catch (error) {

                console.warn(
                    "[GEN-Z.AI] Credit preview warning:",
                    error
                );

            }

        }


        /*
         * =================================================
         * SELECTED MODEL INFO
         * ================================================= */

        updateSelectedModelInfo(
            kieModel
        );


        /*
         * =================================================
         * EVENT
         * =================================================
         */

        try {

            document.dispatchEvent(
                new CustomEvent(
                    "genz-model-edit-populated",
                    {
                        detail: {

                            model:
                                {
                                    ...model
                                },

                            kieModel:
                                {
                                    ...kieModel
                                },

                            kieConfig,

                            parameters,

                            pricing:
                                getCurrentPricing()

                        }
                    }
                )
            );

        } catch {
            /* ignore */
        }


        console.info(
            "[MODEL EDIT] Populate selesai:",
            existingModelId
        );


        console.info(
            "[MODEL EDIT] ========================================"
        );


        return true;

    }
