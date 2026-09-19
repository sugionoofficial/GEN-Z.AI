/* =========================================================
   GEN-Z.AI
   ADMIN MODEL MANAGEMENT
   MODEL FORM EDIT

   File:
   admin-control/models/functions/model-form-edit.js

   OWNER:
   EDIT MODEL

   ARSITEKTUR:
   ---------------------------------------------------------
   Provider
       -> GENZModelsProvider / GENZModelProviderDropdown

   Model Catalog
       -> GENZModelFormLayout
       -> Supabase / KIE

   KIE Configuration
       -> kie_models
       -> kie_parameters
       -> kie_pricing

   CRUD
       -> GENZModelFormCoordinator

   Events
       -> GENZModelFormEvents

   =========================================================

   SOURCE OF TRUTH:
   ---------------------------------------------------------
   Model ID
       -> KIE

   Model Name
       -> KIE

   Model Family
       -> KIE

   Ratio
       -> KIE parameters

   Duration
       -> KIE parameters

   Resolution
       -> KIE parameters

   KIE Price
       -> KIE pricing

   =========================================================

   EDITABLE:
   ---------------------------------------------------------
   Description
   Credit Cost
   Discount
   Status

   Capability KIE:
   READONLY / mengikuti KIE

   =========================================================

   IMPORTANT:
   ---------------------------------------------------------
   Tidak melakukan query Supabase langsung.
   Tidak membuat capability sendiri.
   Tidak membuat Model ID sendiri.
   Tidak membuat Model Name sendiri.
   Tidak membuat harga KIE sendiri.
   Tidak membuat ratio/duration/resolution sendiri.

   =========================================================
*/

(function () {

    "use strict";


    /* =====================================================
       STATE
    ===================================================== */

    let editingModel = null;

    let initialized = false;

    let saving = false;


    /* =====================================================
       ELEMENT HELPERS
    ===================================================== */

    function getElement(id) {

        return document.getElementById(id);

    }


    function firstElement(ids) {

        for (const id of ids) {

            const element =
                getElement(id);

            if (element) {

                return element;

            }

        }

        return null;

    }


    function getValue(id) {

        const element =
            getElement(id);

        if (!element) {

            return "";

        }

        return String(
            element.value ?? ""
        ).trim();

    }


    function setValue(
        id,
        value
    ) {

        const element =
            getElement(id);

        if (!element) {

            return;

        }


        if (Array.isArray(value)) {

            element.value =
                value.join(", ");

            return;

        }


        element.value =
            value ?? "";

    }


    /* =====================================================
       NORMALIZE ARRAY
    ===================================================== */

    function normalizeArray(input) {

        if (Array.isArray(input)) {

            return input
                .map(
                    item =>
                        String(
                            item ?? ""
                        ).trim()
                )
                .filter(Boolean);

        }


        if (
            input === null ||
            input === undefined ||
            input === ""
        ) {

            return [];

        }


        return String(input)
            .split(",")
            .map(
                item =>
                    item.trim()
            )
            .filter(Boolean);

    }


    /* =====================================================
       UNIQUE ARRAY
    ===================================================== */

    function uniqueArray(input) {

        const values =
            normalizeArray(
                input
            );

        const seen =
            new Set();

        const result =
            [];

        values.forEach(
            value => {

                const key =
                    value.toLowerCase();

                if (seen.has(key)) {

                    return;

                }

                seen.add(key);

                result.push(
                    value
                );

            }
        );

        return result;

    }


    /* =====================================================
       NUMBER
    ===================================================== */

    function toNumber(
        value
    ) {

        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {

            return null;

        }


        const number =
            Number(
                String(value)
                    .trim()
                    .replace(/,/g, "")
            );


        return Number.isFinite(
            number
        )
            ? number
            : null;

    }


    /* =====================================================
       NOTIFICATION
    ===================================================== */

    function notify(
        message,
        type = "info"
    ) {

        const existing =
            getElement(
                "modelNotification"
            ) ||
            getElement(
                "notification"
            ) ||
            getElement(
                "toast"
            );


        if (existing) {

            existing.textContent =
                message;


            existing.classList.remove(
                "success",
                "error",
                "warning",
                "info",
                "show"
            );


            existing.classList.add(
                type
            );


            window.requestAnimationFrame(
                () => {

                    existing.classList.add(
                        "show"
                    );

                }
            );


            window.clearTimeout(
                existing.__genzTimer
            );


            existing.__genzTimer =
                window.setTimeout(
                    () => {

                        existing.classList.remove(
                            "show"
                        );

                    },
                    3500
                );


            return;

        }


        const toast =
            document.createElement(
                "div"
            );


        toast.id =
            "modelNotification";


        toast.className =
            `genz-model-notification ${type}`;


        toast.textContent =
            message;


        Object.assign(
            toast.style,
            {
                position: "fixed",
                right: "24px",
                bottom: "24px",
                zIndex: "99999",
                maxWidth: "420px",
                padding: "14px 18px",
                borderRadius: "12px",
                background: "rgba(17,24,39,.96)",
                border: "1px solid rgba(255,255,255,.12)",
                color: "#fff",
                boxShadow:
                    "0 14px 40px rgba(0,0,0,.35)",
                fontSize: "14px",
                lineHeight: "1.45",
                pointerEvents: "none"
            }
        );


        document.body.appendChild(
            toast
        );


        window.setTimeout(
            () => {

                toast.style.opacity =
                    "0";

                toast.style.transform =
                    "translateY(8px)";

                toast.style.transition =
                    "opacity .2s ease, transform .2s ease";


                window.setTimeout(
                    () => {

                        toast.remove();

                    },
                    250
                );

            },
            3500
        );

    }


    /* =====================================================
       MODULE ACCESS
    ===================================================== */

    function getFormLayout() {

        return (
            window.GENZModelFormLayout ||
            null
        );

    }


    function getPriceCalculation() {

        return (
            window.GENZModelPriceCalculation ||
            null
        );

    }


    function getProviderModule() {

        return (
            window.GENZModelsProvider ||
            null
        );

    }


    function getProviderDropdown() {

        return (
            window.GENZModelProviderDropdown ||
            null
        );

    }


    function getFormEvents() {

        return (
            window.GENZModelFormEvents ||
            null
        );

    }


    /* =====================================================
       CURRENT KIE MODEL
    ===================================================== */

    function getCurrentKieModel() {

        const layout =
            getFormLayout();

        if (!layout) {

            return null;

        }


        let modelId = "";


        if (
            typeof layout.getCurrentModelId ===
            "function"
        ) {

            try {

                modelId =
                    String(
                        layout.getCurrentModelId() ||
                        ""
                    ).trim();

            } catch {

                modelId = "";

            }

        }


        if (!modelId) {

            modelId =
                getValue(
                    "modelCode"
                );

        }


        if (!modelId) {

            modelId =
                getValue(
                    "modelCodeSearch"
                );

        }


        if (!modelId) {

            return null;

        }


        if (
            typeof layout.findModel ===
            "function"
        ) {

            try {

                const model =
                    layout.findModel(
                        modelId
                    );

                if (model) {

                    return model;

                }

            } catch (error) {

                console.warn(
                    "[GEN-Z.AI] KIE model lookup error:",
                    error
                );

            }

        }


        if (
            typeof layout.findModelById ===
            "function"
        ) {

            try {

                return (
                    layout.findModelById(
                        modelId
                    ) ||
                    null
                );

            } catch (error) {

                console.warn(
                    "[GEN-Z.AI] KIE model lookup error:",
                    error
                );

            }

        }


        return null;

    }


    /* =====================================================
       KIE CONFIG
    ===================================================== */

    function getCurrentKieConfig() {

        const layout =
            getFormLayout();

        if (
            !layout ||
            typeof layout.getCurrentKieConfig !==
            "function"
        ) {

            return null;

        }


        try {

            return (
                layout.getCurrentKieConfig() ||
                null
            );

        } catch (error) {

            console.warn(
                "[GEN-Z.AI] KIE config lookup error:",
                error
            );

            return null;

        }

    }


    /* =====================================================
       KIE PARAMETERS
    ===================================================== */

    function getCurrentParameters() {

        const layout =
            getFormLayout();

        if (
            !layout ||
            typeof layout.getCurrentParameters !==
            "function"
        ) {

            return [];

        }


        try {

            const result =
                layout.getCurrentParameters();

            return Array.isArray(
                result
            )
                ? result
                : [];

        } catch {

            return [];

        }

    }


    /* =====================================================
       KIE PRICING
    ===================================================== */

    function getCurrentPricing() {

        const layout =
            getFormLayout();

        if (
            !layout ||
            typeof layout.getCurrentPricing !==
            "function"
        ) {

            return [];

        }


        try {

            const result =
                layout.getCurrentPricing();

            return Array.isArray(
                result
            )
                ? result
                : [];

        } catch {

            return [];

        }

    }


    /* =====================================================
       SET PROVIDER
       -----------------------------------------------------
       silent = true digunakan ketika membuka EDIT.

       Tujuannya:
       - menetapkan provider tanpa dispatch event
       - mencegah provider-changed
       - mencegah refresh berulang
       - mencegah recursive event chain
    ===================================================== */

    async function setProvider(
        providerIdentifier,
        silent = false
    ) {

        const value =
            String(
                providerIdentifier || ""
            ).trim();


        if (!value) {

            return null;

        }


        /*
         * =================================================
         * SILENT MODE
         * =================================================
         *
         * Jangan menggunakan dropdown.setValue()
         * karena method tersebut dapat dispatch:
         *
         * genz-models-provider-changed
         *
         * ketika form Edit baru dibuka.
         */

        if (silent) {

            const select =
                firstElement(
                    [
                        "providerId",
                        "modelProvider"
                    ]
                );


            if (select) {

                const option =
                    Array.from(
                        select.options || []
                    ).find(
                        option => {

                            return (
                                String(
                                    option.value || ""
                                )
                                    .trim()
                                    .toLowerCase() ===
                                value.toLowerCase()
                            );

                        }
                    );


                if (option) {

                    select.value =
                        option.value;

                    return option.value;

                }

            }


            /*
             * Jika provider dropdown belum memiliki
             * option, tetap isi value apabila select
             * tersedia. Layout.refresh() menerima
             * providerIdentifier secara eksplisit.
             */

            if (select) {

                select.value =
                    value;

                return value;

            }


            return value;

        }


        /*
         * =================================================
         * NORMAL MODE
         * =================================================
         *
         * Saat user benar-benar mengganti provider,
         * gunakan dropdown normal agar lifecycle event
         * tetap bekerja.
         */

        const dropdown =
            getProviderDropdown();


        if (
            dropdown &&
            typeof dropdown.setValue ===
            "function"
        ) {

            try {

                return (
                    await dropdown.setValue(
                        value
                    )
                ) || value;

            } catch (error) {

                console.warn(
                    "[model-form-edit] Provider dropdown error:",
                    error
                );

            }

        }


        const providerModule =
            getProviderModule();


        if (
            providerModule &&
            typeof providerModule.getProviderById ===
            "function"
        ) {

            try {

                const provider =
                    providerModule.getProviderById(
                        value
                    );


                if (provider) {

                    const providerValue =
                        provider.provider_id ||
                        provider.provider ||
                        provider.id ||
                        value;


                    setValue(
                        "providerId",
                        providerValue
                    );


                    return provider;

                }

            } catch (error) {

                console.warn(
                    "[model-form-edit] Provider lookup error:",
                    error
                );

            }

        }


        const select =
            getElement(
                "providerId"
            );


        if (select) {

            const option =
                Array.from(
                    select.options || []
                ).find(
                    option => {

                        return (
                            String(
                                option.value || ""
                            )
                                .trim()
                                .toLowerCase() ===
                            value.toLowerCase()
                        );

                    }
                );


            if (option) {

                select.value =
                    option.value;

                return option.value;

            }

        }


        return null;

    }


    /* =====================================================
       SET MODEL
       -----------------------------------------------------
       Selalu melalui Layout.
       Tidak memanipulasi KIE state secara manual.

       Catatan:
       Fungsi ini tetap tersedia untuk pemanggilan eksternal.
       Saat populate(), fungsi ini TIDAK dipanggil lagi
       setelah layout.refresh(), karena refresh() sudah
       melakukan setModel() sendiri.
    ===================================================== */

    async function setModel(
        model
    ) {

        if (!model) {

            return null;

        }


        const modelId =
            String(
                model.model_id ||
                model.modelId ||
                ""
            ).trim();


        if (!modelId) {

            return null;

        }


        const layout =
            getFormLayout();


        if (
            !layout ||
            typeof layout.findModel !==
            "function" ||
            typeof layout.setModel !==
            "function"
        ) {

            throw new Error(
                "GENZModelFormLayout belum siap."
            );

        }


        const kieModel =
            layout.findModel(
                modelId
            );


        if (!kieModel) {

            throw new Error(
                `Model ID "${modelId}" tidak ditemukan di katalog KIE.`
            );

        }


        /*
         * Hanya satu panggilan setModel().
         */

        await layout.setModel(
            kieModel
        );


        /*
         * Layout menjadi source of truth.
         */

        setValue(
            "modelCode",
            modelId
        );


        /*
         * Model Name.
         */

        const modelName =
            String(
                kieModel.model_name ||
                ""
            ).trim();


        setValue(
            "modelName",
            modelName
        );


        /*
         * Model Family.
         */

        const modelFamily =
            String(
                kieModel.model_family ||
                ""
            ).trim();


        setValue(
            "modelFamily",
            modelFamily
        );


        /*
         * Field KIE identity readonly.
         */

        const modelNameElement =
            getElement(
                "modelName"
            );


        if (modelNameElement) {

            modelNameElement.readOnly =
                true;

        }


        const modelFamilyElement =
            getElement(
                "modelFamily"
            );


        if (modelFamilyElement) {

            modelFamilyElement.readOnly =
                true;

        }


        /*
         * KIE Unit Price readonly.
         */

        const kieUnitPrice =
            getElement(
                "kieUnitPrice"
            );


        if (kieUnitPrice) {

            kieUnitPrice.readOnly =
                true;

        }


        updateSelectedModelInfo(
            kieModel
        );


        return kieModel;

    }


    /* =====================================================
       WAIT FOR LAYOUT
       -----------------------------------------------------
       Tidak menggunakan setTimeout(0).

       Layout sudah menjadi module dependency.
       Jika belum tersedia, langsung return false.
    ===================================================== */

    async function waitForModelLayout() {

        const layout =
            getFormLayout();


        if (!layout) {

            return false;

        }


        return true;

    }


    /* =====================================================
       SELECTED MODEL INFO
    ===================================================== */

    function updateSelectedModelInfo(
        model
    ) {

        const info =
            getElement(
                "selectedModelInfo"
            );


        if (!info) {

            return;

        }


        if (!model) {

            info.textContent =
                "Belum ada model dipilih.";

            return;

        }


        const name =
            model.model_name ||
            model.model_id ||
            "-";


        const id =
            model.model_id ||
            "-";


        info.textContent =
            `Model dipilih: ${name} (${id})`;

    }


    /* =====================================================
       SYNC KIE CAPABILITIES
    ===================================================== */

    function syncKieCapabilities() {

        const layout =
            getFormLayout();


        if (!layout) {

            return;

        }


        /*
         * Tidak dispatch change/input.
         * Layout langsung menyinkronkan field.
         */

        if (
            typeof layout.syncLegacyCapabilityFields ===
            "function"
        ) {

            try {

                layout.syncLegacyCapabilityFields();

            } catch (error) {

                console.warn(
                    "[GEN-Z.AI] Capability sync warning:",
                    error
                );

            }

        }


        if (
            typeof layout.syncDurationFields ===
            "function"
        ) {

            try {

                layout.syncDurationFields();

            } catch (error) {

                console.warn(
                    "[GEN-Z.AI] Duration sync warning:",
                    error
                );

            }

        }

    }


    /* =====================================================
       COLLECT EDITABLE DATA
       -----------------------------------------------------
       Identity dan capability TIDAK diambil sebagai
       sumber utama dari form.

       Semuanya diverifikasi kembali terhadap KIE.
    ===================================================== */

    function collectData() {

        const kieModel =
            getCurrentKieModel();


        const modelId =
            String(
                kieModel?.model_id ||
                getValue(
                    "modelCode"
                ) ||
                ""
            ).trim();


        return {

            id:
                getValue(
                    "modelRecordId"
                ),

            provider_id:
                getValue(
                    "providerId"
                ),

            model_id:
                modelId,

            model_name:
                String(
                    kieModel?.model_name ||
                    getValue(
                        "modelName"
                    ) ||
                    ""
                ).trim(),

            model_family:
                String(
                    kieModel?.model_family ||
                    getValue(
                        "modelFamily"
                    ) ||
                    ""
                ).trim(),

            description:
                getValue(
                    "description"
                ),

            credit_cost:
                getValue(
                    "creditCost"
                ),

            discount_percent:
                getValue(
                    "discountPercent"
                ),

            credit_final:
                getValue(
                    "creditFinal"
                ),

            min_duration:
                getValue(
                    "minDuration"
                ),

            max_duration:
                getValue(
                    "maxDuration"
                ),

            supported_ratios:
                normalizeArray(
                    getValue(
                        "supportedRatios"
                    )
                ),

            supported_resolutions:
                normalizeArray(
                    getValue(
                        "supportedResolutions"
                    )
                ),

            status:
                (
                    getValue(
                        "modelStatus"
                    ) ||
                    "active"
                ).toLowerCase()

        };

    }


    /* =====================================================
       BUILD KIE-SAFE DATA
    ===================================================== */

    function buildKieData(
        data
    ) {

        const layout =
            getFormLayout();


        const kieModel =
            getCurrentKieModel();


        if (!layout) {

            throw new Error(
                "GENZModelFormLayout belum tersedia."
            );

        }


        if (!kieModel) {

            throw new Error(
                "Model KIE belum dipilih."
            );

        }


        const modelId =
            String(
                kieModel.model_id ||
                ""
            ).trim();


        const modelName =
            String(
                kieModel.model_name ||
                ""
            ).trim();


        const modelFamily =
            String(
                kieModel.model_family ||
                ""
            ).trim();


        if (!modelId) {

            throw new Error(
                "Model ID dari KIE tidak tersedia."
            );

        }


        if (!modelName) {

            throw new Error(
                "Model Name dari KIE tidak tersedia."
            );

        }


        /*
         * Capability harus berasal dari state KIE.
         */

        let ratios =
            [];

        let resolutions =
            [];

        let minDuration =
            "";

        let maxDuration =
            "";


        /*
         * Sinkronisasi langsung melalui Layout.
         */

        syncKieCapabilities();


        ratios =
            normalizeArray(
                getValue(
                    "supportedRatios"
                )
            );


        resolutions =
            normalizeArray(
                getValue(
                    "supportedResolutions"
                )
            );


        minDuration =
            getValue(
                "minDuration"
            );


        maxDuration =
            getValue(
                "maxDuration"
            );


        /*
         * Jika Layout menyediakan current
         * capability state, gunakan itu sebagai
         * validasi tambahan.
         */

        const kieConfig =
            typeof layout.getCurrentKieConfig ===
            "function"
                ? layout.getCurrentKieConfig()
                : null;


        if (!kieConfig) {

            throw new Error(
                "Konfigurasi KIE belum tersedia. Model tidak dapat disimpan."
            );

        }


        return {

            ...data,

            model_id:
                modelId,

            model_name:
                modelName,

            model_family:
                modelFamily,

            min_duration:
                minDuration,

            max_duration:
                maxDuration,

            supported_ratios:
                uniqueArray(
                    ratios
                ),

            supported_resolutions:
                uniqueArray(
                    resolutions
                )

        };

    }


    /* =====================================================
       VALIDATE
    ===================================================== */

    function validate(
        data
    ) {

        if (!data) {

            return "Data model tidak tersedia.";

        }


        if (!data.id) {

            return (
                "ID record model tidak tersedia."
            );

        }


        if (!data.provider_id) {

            return (
                "Provider wajib dipilih."
            );

        }


        if (!data.model_id) {

            return (
                "Model ID wajib berasal dari katalog KIE."
            );

        }


        if (!data.model_name) {

            return (
                "Model Name dari KIE tidak tersedia."
            );

        }


        /*
         * Pastikan model benar-benar ada
         * dalam katalog KIE.
         */

        const kieModel =
            getCurrentKieModel();


        if (!kieModel) {

            return (
                "Model KIE tidak ditemukan."
            );

        }


        const kieModelId =
            String(
                kieModel.model_id ||
                ""
            ).trim();


        if (
            kieModelId !==
            data.model_id
        ) {

            return (
                "Model ID tidak sinkron dengan katalog KIE."
            );

        }


        /*
         * Credit.
         */

        if (
            data.credit_cost !==
            "" &&
            toNumber(
                data.credit_cost
            ) === null
        ) {

            return (
                "Credit Cost harus berupa angka."
            );

        }


        const creditCost =
            toNumber(
                data.credit_cost
            );


        if (
            creditCost !== null &&
            creditCost < 0
        ) {

            return (
                "Credit Cost tidak boleh negatif."
            );

        }


        /*
         * Discount.
         */

        const discount =
            toNumber(
                data.discount_percent
            );


        if (
            data.discount_percent !==
            "" &&
            discount === null
        ) {

            return (
                "Discount Percent harus berupa angka."
            );

        }


        if (
            discount !== null &&
            (
                discount < 0 ||
                discount > 100
            )
        ) {

            return (
                "Discount Percent harus antara 0 sampai 100."
            );

        }


        /*
         * Credit Final.
         */

        if (
            data.credit_final !==
            "" &&
            toNumber(
                data.credit_final
            ) === null
        ) {

            return (
                "Credit Final harus berupa angka."
            );

        }


        /*
         * Duration.
         */

        const min =
            toNumber(
                data.min_duration
            );


        const max =
            toNumber(
                data.max_duration
            );


        if (
            data.min_duration !==
            "" &&
            min === null
        ) {

            return (
                "Minimum Duration harus berupa angka."
            );

        }


        if (
            data.max_duration !==
            "" &&
            max === null
        ) {

            return (
                "Maximum Duration harus berupa angka."
            );

        }


        if (
            min !== null &&
            max !== null &&
            min > max
        ) {

            return (
                "Minimum Duration tidak boleh lebih besar dari Maximum Duration."
            );

        }


        /*
         * Status.
         */

        if (
            data.status &&
            ![
                "active",
                "inactive",
                "maintenance"
            ].includes(
                data.status
            )
        ) {

            return (
                "Status model tidak valid."
            );

        }


        /*
         * KIE config wajib tersedia.
         */

        const kieConfig =
            getCurrentKieConfig();


        if (!kieConfig) {

            return (
                "Konfigurasi KIE belum tersedia."
            );

        }


        return null;

    }


    /* =====================================================
       BUILD PAYLOAD
    ===================================================== */

    function buildPayload(
        data
    ) {

        if (!data) {

            return null;

        }


        /*
         * Payload mempertahankan struktur
         * API lama.
         *
         * Model identity sudah diverifikasi
         * dari KIE sebelum fungsi ini dipanggil.
         */

        const payload = {

            id:
                data.id,

            provider_id:
                data.provider_id,

            model_id:
                data.model_id,

            model_name:
                data.model_name,

            description:
                data.description,

            credit_cost:
                data.credit_cost === ""
                    ? null
                    : Number(
                        data.credit_cost
                    ),

            discount_percent:
                data.discount_percent === ""
                    ? 0
                    : Number(
                        data.discount_percent
                    ),

            credit_final:
                data.credit_final === ""
                    ? null
                    : Number(
                        data.credit_final
                    ),

            min_duration:
                data.min_duration === ""
                    ? null
                    : Number(
                        data.min_duration
                    ),

            max_duration:
                data.max_duration === ""
                    ? null
                    : Number(
                        data.max_duration
                    ),

            supported_ratios:
                uniqueArray(
                    data.supported_ratios
                ),

            supported_resolutions:
                uniqueArray(
                    data.supported_resolutions
                ),

            status:
                data.status ||
                "active"

        };


        /*
         * Model Family dikirim jika API/backend
         * mendukung field tersebut.
         *
         * Tidak memaksa field lain.
         */

        if (
            data.model_family
        ) {

            payload.model_family =
                data.model_family;

        }


        return payload;

    }


    /* =====================================================
       UPDATE
    ===================================================== */

    async function update(
        model = null
    ) {

        const target =
            model ||
            editingModel;


        if (!target) {

            throw new Error(
                "Model yang akan diedit tidak tersedia."
            );

        }


        /*
         * Sinkronkan capability KIE tanpa
         * men-trigger event DOM.
         */

        syncKieCapabilities();


        /*
         * Ambil form.
         */

        let data =
            collectData();


        /*
         * Rebuild berdasarkan KIE.
         */

        data =
            buildKieData(
                data
            );


        const validationError =
            validate(
                data
            );


        if (validationError) {

            notify(
                validationError,
                "error"
            );

            throw new Error(
                validationError
            );

        }


        const payload =
            buildPayload(
                data
            );


        /*
         * Coordinator menjadi satu pintu CRUD.
         */

        const coordinator =
            window.GENZModelFormCoordinator;


        if (
            !coordinator ||
            typeof coordinator.update !==
            "function"
        ) {

            throw new Error(
                "GENZModelFormCoordinator belum tersedia."
            );

        }


        return coordinator.update(
            payload
        );

    }


    /* =====================================================
       UPDATE FROM FORM
    ===================================================== */

    async function updateFromForm(
        event = null
    ) {

        if (event) {

            event.preventDefault();

            /*
             * stopPropagation hanya satu tingkat.
             *
             * Jangan dispatch submit lagi.
             */

            event.stopPropagation();

        }


        if (saving) {

            return null;

        }


        saving =
            true;


        try {

            const result =
                await update();


            notify(
                "Model berhasil diperbarui.",
                "success"
            );


            /*
             * Clear cache model.
             */

            const dataModule =
                window.GENZModelsData;


            if (
                dataModule &&
                typeof dataModule.clearCache ===
                "function"
            ) {

                try {

                    dataModule.clearCache();

                } catch (error) {

                    console.warn(
                        "[GEN-Z.AI] Cache clear warning:",
                        error
                    );

                }

            }


            /*
             * Informasikan UI.
             */

            try {

                document.dispatchEvent(
                    new CustomEvent(
                        "genz-model-updated",
                        {
                            detail: {

                                result,

                                model:
                                    collectData()

                            }
                        }
                    )
                );

            } catch {
                /* ignore */
            }


            /*
             * Tutup modal melalui owner.
             */

            const formEvents =
                getFormEvents();


            if (
                formEvents &&
                typeof formEvents.closeModal ===
                "function"
            ) {

                try {

                    formEvents.closeModal();

                } catch (error) {

                    console.warn(
                        "[GEN-Z.AI] Close modal warning:",
                        error
                    );

                }

            }


            return result;

        } catch (error) {

            console.error(
                "[GEN-Z.AI] Update model error:",
                error
            );


            notify(
                error?.message ||
                "Gagal memperbarui model.",
                "error"
            );


            throw error;

        } finally {

            saving =
                false;

        }

    }


    /* =====================================================
       POPULATE
       -----------------------------------------------------
       OPTIMIZED EDIT FLOW:

       1. Simpan record yang sedang diedit
       2. Record ID
       3. Provider silent
       4. Validasi Layout
       5. SATU KALI refresh KIE
       6. Layout memilih model + load config
       7. Identity KIE
       8. Editable DB fields
       9. Sync capability
       10. Credit preview
       11. Event notification

       IMPORTANT:
       -----------------------------------------------------
       Tidak melakukan:
           refresh()
           setModel()
           updateUsdPreview()
           refresh()

       berulang-ulang.

       layout.refresh() sudah bertanggung jawab untuk
       memilih model dan memuat KIE configuration.
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
         * EDITABLE DATABASE FIELDS
         * =================================================
         *
         * Diisi langsung dari record database.
         *
         * Identity KIE tidak diambil dari sini.
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
         * PROVIDER
         * =================================================
         *
         * Silent agar tidak men-trigger:
         *
         * genz-models-provider-changed
         *
         * Event tersebut tidak diperlukan ketika Edit
         * karena kita sendiri akan melakukan refresh dengan
         * providerId yang eksplisit.
         */

        const providerIdentifier =
            String(
                model.provider_id ||
                model.provider ||
                model.provider_code ||
                model.provider_uuid ||
                ""
            ).trim();


        if (providerIdentifier) {

            await setProvider(
                providerIdentifier,
                true
            );

        }


        /*
         * =================================================
         * WAIT FOR LAYOUT
         * =================================================
         */

        const layoutReady =
            await waitForModelLayout();


        if (!layoutReady) {

            throw new Error(
                "GENZModelFormLayout belum tersedia."
            );

        }


        const layout =
            getFormLayout();


        if (!layout) {

            throw new Error(
                "GENZModelFormLayout belum tersedia."
            );

        }


        /*
         * =================================================
         * MODEL ID
         * =================================================
         *
         * Model ID harus berasal dari record yang sudah
         * tersimpan dan diverifikasi terhadap katalog KIE.
         */

        const existingModelId =
            String(
                model.model_id ||
                ""
            ).trim();


        if (!existingModelId) {

            throw new Error(
                "Record model tidak memiliki Model ID."
            );

        }


        /*
         * =================================================
         * SATU KALI REFRESH KIE
         * =================================================
         *
         * Ini adalah titik utama optimasi.
         *
         * layout.refresh() sudah:
         *
         * - loadActiveModels()
         * - populateModelSelect()
         * - findModel()
         * - setModel()
         * - loadKieConfig()
         * - renderCapabilities()
         * - loadModelUsdPrice()
         * - syncCreditPreview()
         *
         * Jangan mengulang proses tersebut di sini.
         */

        if (
            typeof layout.refresh !==
            "function"
        ) {

            throw new Error(
                "GENZModelFormLayout.refresh() belum tersedia."
            );

        }


        await layout.refresh(
            {
                providerId:
                    providerIdentifier,

                selectedModelId:
                    existingModelId
            }
        );


        /*
         * =================================================
         * CARI MODEL HASIL REFRESH
         * =================================================
         *
         * Hanya validasi/reference.
         *
         * TIDAK memanggil setModel() lagi.
         */

        if (
            typeof layout.findModel !==
            "function"
        ) {

            throw new Error(
                "GENZModelFormLayout.findModel() belum tersedia."
            );

        }


        const kieModel =
            layout.findModel(
                existingModelId
            );


        if (!kieModel) {

            /*
             * Jangan menggunakan identity lama dari database
             * sebagai pengganti data KIE.
             */

            throw new Error(
                `Model "${existingModelId}" tidak ditemukan dalam katalog KIE.`
            );

        }


        /*
         * =================================================
         * KIE IDENTITY
         * =================================================
         *
         * layout.refresh() seharusnya sudah mengisi field
         * identity melalui setModel().
         *
         * Di sini hanya memastikan nilai readonly tetap
         * berasal dari KIE.
         */

        setValue(
            "modelCode",
            String(
                kieModel.model_id ||
                ""
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
         * Identity readonly.
         */

        const modelName =
            getElement(
                "modelName"
            );


        if (modelName) {

            modelName.readOnly =
                true;

        }


        const modelFamily =
            getElement(
                "modelFamily"
            );


        if (modelFamily) {

            modelFamily.readOnly =
                true;

        }


        /*
         * KIE Unit Price readonly.
         */

        const kieUnitPrice =
            getElement(
                "kieUnitPrice"
            );


        if (kieUnitPrice) {

            kieUnitPrice.readOnly =
                true;

        }


        /*
         * =================================================
         * CAPABILITY KIE
         * =================================================
         *
         * Ratio / Duration / Resolution tidak mengambil
         * source dari database lama.
         *
         * Layout tetap menjadi source of truth.
         */

        syncKieCapabilities();


        /*
         * =================================================
         * CREDIT PREVIEW
         * =================================================
         *
         * Hanya satu update preview dari sisi Edit.
         *
         * USD preview tidak dipanggil ulang karena
         * layout.refresh() sudah melakukan update pricing
         * saat setModel().
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
         * =================================================
         */

        updateSelectedModelInfo(
            kieModel
        );


        /*
         * =================================================
         * EDIT POPULATED EVENT
         * =================================================
         *
         * Event hanya sebagai notification.
         *
         * Tidak memanggil populate() kembali.
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

                            kieConfig:
                                getCurrentKieConfig(),

                            parameters:
                                getCurrentParameters(),

                            pricing:
                                getCurrentPricing()

                        }
                    }
                )
            );

        } catch {
            /* ignore */
        }


        return true;

    }


    /* =====================================================
       OPEN
       -----------------------------------------------------
       OPTIMIZED:

       Modal ditampilkan SEBELUM populate().

       Dengan begitu user langsung melihat form Edit,
       sementara data KIE dimuat oleh Layout.

       Ini menghilangkan kesan tombol Edit "stuck"
       karena sebelumnya browser menunggu seluruh proses
       async selesai sebelum modal terlihat.
    ===================================================== */

    async function open(
        model
    ) {

        if (!model) {

            console.warn(
                "[model-form-edit] Model tidak tersedia."
            );

            return false;

        }


        /*
         * =================================================
         * OPEN MODAL IMMEDIATELY
         * =================================================
         */

        const modal =
            getElement(
                "modelModal"
            );


        if (modal) {

            try {

                /*
                 * Support native dialog.
                 */

                if (
                    modal.tagName ===
                    "DIALOG" &&
                    typeof modal.showModal ===
                    "function"
                ) {

                    if (!modal.open) {

                        modal.showModal();

                    }

                } else {

                    /*
                     * Existing GEN-Z.AI modal system.
                     */

                    modal.classList.add(
                        "open",
                        "show"
                    );


                    modal.classList.remove(
                        "hidden"
                    );


                    modal.setAttribute(
                        "aria-hidden",
                        "false"
                    );


                    if (
                        window.getComputedStyle(
                            modal
                        ).display ===
                        "none"
                    ) {

                        modal.style.display =
                            "flex";

                    }


                    document.body.classList.add(
                        "modal-open"
                    );

                }

            } catch (error) {

                console.warn(
                    "[model-form-edit] Immediate modal open warning:",
                    error
                );


                /*
                 * Fallback.
                 */

                modal.classList.add(
                    "open",
                    "show"
                );


                modal.classList.remove(
                    "hidden"
                );


                modal.setAttribute(
                    "aria-hidden",
                    "false"
                );


                if (
                    window.getComputedStyle(
                        modal
                    ).display ===
                    "none"
                ) {

                    modal.style.display =
                        "flex";

                }


                document.body.classList.add(
                    "modal-open"
                );

            }

        }


        /*
         * =================================================
         * POPULATE AFTER MODAL IS VISIBLE
         * =================================================
         */

        try {

            await populate(
                model
            );


            return true;

        } catch (error) {

            console.error(
                "[model-form-edit] Open error:",
                error
            );


            notify(
                error?.message ||
                "Gagal membuka model untuk diedit.",
                "error"
            );


            return false;

        }

    }


    /* =====================================================
       CLEAR
    ===================================================== */

    function clear() {

        editingModel =
            null;

        saving =
            false;

        return true;

    }


    /* =====================================================
       STATE
    ===================================================== */

    function getEditingModel() {

        return editingModel;

    }


    function isEditing() {

        return Boolean(
            editingModel
        );

    }


    function isSaving() {

        return Boolean(
            saving
        );

    }


    /* =====================================================
       INITIALIZE
    ===================================================== */

    function initialize() {

        if (initialized) {

            return true;

        }


        initialized =
            true;


        /*
         * Identity KIE readonly.
         */

        const modelName =
            getElement(
                "modelName"
            );


        if (modelName) {

            modelName.readOnly =
                true;

        }


        const modelFamily =
            getElement(
                "modelFamily"
            );


        if (modelFamily) {

            modelFamily.readOnly =
                true;

        }


        const kieUnitPrice =
            getElement(
                "kieUnitPrice"
            );


        if (kieUnitPrice) {

            kieUnitPrice.readOnly =
                true;

        }


        console.info(
            "[GEN-Z.AI] GENZModelFormEdit initialized."
        );


        return true;

    }


    /* =====================================================
       PUBLIC API
    ===================================================== */

    window.GENZModelFormEdit =
        Object.freeze({

            initialize,

            open,

            populate,

            clear,

            collectData,

            validate,

            buildPayload,

            update,

            updateFromForm,

            setProvider,

            setModel,

            updateSelectedModelInfo,

            getEditingModel,

            isEditing,

            isSaving,

            getCurrentKieModel,

            getCurrentKieConfig,

            getCurrentParameters,

            getCurrentPricing

        });


})();
