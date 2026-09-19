/* =========================================================
   GEN-Z.AI
   ADMIN MODEL MANAGEMENT
   MODEL FORM EDIT

   File:
   admin-control/models/functions/model-form-edit.js

   OWNER:
   EDIT MODEL

   =========================================================

   SOURCE OF TRUTH
   ---------------------------------------------------------
   Model ID
       -> KIE

   Model Name
       -> KIE

   Model Family
       -> KIE

   Ratio OPTIONS
       -> KIE / Supabase

   Duration OPTIONS
       -> KIE / Supabase

   Resolution OPTIONS
       -> KIE / Supabase

   KIE Unit Price
       -> kie_pricing / Supabase

   Saved capability selection
       -> models / Supabase

   =========================================================

   EDITABLE
   ---------------------------------------------------------
   Description
   Credit Cost
   Discount
   Status

   Capability selection
       -> checkbox
       -> pilihan berasal dari KIE/Supabase

   =========================================================

   IMPORTANT
   ---------------------------------------------------------
   Tidak melakukan query Supabase langsung.

   Tidak membuat:
   - Model ID
   - Model Name
   - Model Family
   - Ratio
   - Duration
   - Resolution
   - KIE Price

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

                modelId =
                    "";

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
       silent=true:
       - tidak memanggil dropdown.setValue()
       - tidak dispatch provider-changed
       - tidak memicu refresh recursive

       Ini khusus ketika membuka Edit Model.
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
         */

        if (silent) {

            const select =
                firstElement(
                    [
                        "providerId",
                        "modelProvider"
                    ]
                );


            if (!select) {

                return value;

            }


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


            /*
             * Jika option belum tersedia,
             * tetap simpan value untuk Layout.
             */

            select.value =
                value;

            return value;

        }


        /*
         * =================================================
         * NORMAL MODE
         * =================================================
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


        await layout.setModel(
            kieModel
        );


        setValue(
            "modelCode",
            modelId
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
       WAIT FOR MODEL LAYOUT
    ===================================================== */

    async function waitForModelLayout() {

        return Boolean(
            getFormLayout()
        );

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
       APPLY SAVED CAPABILITY SELECTION
       -----------------------------------------------------
       INI BAGIAN PENTING UNTUK EDIT.

       KIE/Supabase menyediakan SEMUA OPTION.

       Record model Supabase menentukan mana yang
       sebelumnya dipilih.

       Contoh:

       Supabase:
           supported_ratios:
               ["16:9", "9:16"]

       KIE options:
           ["16:9", "9:16", "1:1"]

       Hasil Edit:
           [x] 16:9
           [x] 9:16
           [ ] 1:1

       Ratio/resolution yang sebelumnya disabled oleh
       Layout dibuka kembali menjadi selectable khusus
       pada form Edit.

       Duration:
           min_duration = 5
           max_duration = 10

       KIE options:
           5, 8, 10, 12

       Hasil:
           [x] 5
           [x] 8
           [x] 10
           [ ] 12
    ===================================================== */

    function applySavedCapabilitySelection(
        model
    ) {

        if (!model) {

            return false;

        }


        /*
         * -------------------------------------------------
         * DATA YANG SUDAH TERSIMPAN DI SUPABASE
         * -------------------------------------------------
         */

        const savedRatios =
            uniqueArray(
                model.supported_ratios ??
                model.supportedRatios ??
                []
            );


        const savedResolutions =
            uniqueArray(
                model.supported_resolutions ??
                model.supportedResolutions ??
                []
            );


        const savedMin =
            toNumber(
                model.min_duration ??
                model.minDuration
            );


        const savedMax =
            toNumber(
                model.max_duration ??
                model.maxDuration
            );


        /*
         * -------------------------------------------------
         * RATIO
         * -------------------------------------------------
         */

        const ratioCheckboxes =
            document.querySelectorAll(
                'input[data-kie-capability="ratio"]'
            );


        ratioCheckboxes.forEach(
            checkbox => {

                const value =
                    String(
                        checkbox.dataset.kieValue ??
                        ""
                    ).trim();


                /*
                 * Ratio berasal dari KIE.
                 *
                 * Admin hanya memilih.
                 */

                checkbox.disabled =
                    false;


                checkbox.removeAttribute(
                    "aria-readonly"
                );


                checkbox.checked =
                    savedRatios.some(
                        saved =>
                            saved.toLowerCase() ===
                            value.toLowerCase()
                    );

            }
        );


        /*
         * -------------------------------------------------
         * RESOLUTION
         * -------------------------------------------------
         */

        const resolutionCheckboxes =
            document.querySelectorAll(
                'input[data-kie-capability="resolution"]'
            );


        resolutionCheckboxes.forEach(
            checkbox => {

                const value =
                    String(
                        checkbox.dataset.kieValue ??
                        ""
                    ).trim();


                checkbox.disabled =
                    false;


                checkbox.removeAttribute(
                    "aria-readonly"
                );


                checkbox.checked =
                    savedResolutions.some(
                        saved =>
                            saved.toLowerCase() ===
                            value.toLowerCase()
                    );

            }
        );


        /*
         * -------------------------------------------------
         * DURATION
         * -------------------------------------------------
         *
         * Duration yang tersimpan direpresentasikan
         * oleh min/max.
         *
         * Checkbox yang berada di dalam range tersebut
         * dicentang.
         */

        const durationCheckboxes =
            document.querySelectorAll(
                'input[data-kie-capability="duration"]'
            );


        durationCheckboxes.forEach(
            checkbox => {

                const value =
                    String(
                        checkbox.dataset.kieValue ??
                        ""
                    ).trim();


                const numeric =
                    Number(
                        value
                    );


                checkbox.disabled =
                    false;


                checkbox.removeAttribute(
                    "aria-readonly"
                );


                if (
                    savedMin !== null &&
                    savedMax !== null &&
                    Number.isFinite(
                        numeric
                    )
                ) {

                    checkbox.checked =
                        numeric >= savedMin &&
                        numeric <= savedMax;

                } else {

                    /*
                     * Tidak ada selection lama.
                     * Jangan membuat pilihan sendiri.
                     */

                    checkbox.checked =
                        false;

                }

            }
        );


        /*
         * -------------------------------------------------
         * SINKRONKAN FIELD LEGACY
         * -------------------------------------------------
         */

        syncKieCapabilities();


        /*
         * Pastikan min/max berasal dari checkbox.
         */

        const layout =
            getFormLayout();


        if (
            layout &&
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


        if (
            layout &&
            typeof layout.syncLegacyCapabilityFields ===
            "function"
        ) {

            try {

                layout.syncLegacyCapabilityFields();

            } catch (error) {

                console.warn(
                    "[GEN-Z.AI] Legacy capability sync warning:",
                    error
                );

            }

        }


        return true;

    }


    /* =====================================================
       COLLECT EDITABLE DATA
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
         * Capability berasal dari checkbox.
         */

        syncKieCapabilities();


        const ratios =
            normalizeArray(
                getValue(
                    "supportedRatios"
                )
            );


        const resolutions =
            normalizeArray(
                getValue(
                    "supportedResolutions"
                )
            );


        const minDuration =
            getValue(
                "minDuration"
            );


        const maxDuration =
            getValue(
                "maxDuration"
            );


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
         * Credit Cost.
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


        syncKieCapabilities();


        let data =
            collectData();


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
       FLOW:

       1. Simpan record Supabase
       2. Isi editable data dari Supabase
       3. Provider silent
       4. Load catalog KIE/Supabase
       5. Load KIE config
       6. Render semua capability yang tersedia
       7. Terapkan selection dari record Supabase
       8. KIE identity readonly
       9. KIE price readonly
       10. Credit preview
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
         * EDITABLE DATABASE DATA
         * =================================================
         *
         * Ini berasal langsung dari record model
         * yang sudah dimuat dari Supabase.
         */

        setValue(
            "description",
            model.description || ""
        );


        /*
         * CREDIT COST
         * -------------------------------------------------
         * Harga/credit yang digunakan aplikasi berasal
         * dari record Supabase.
         */

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
         * LAYOUT
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
         * EXISTING MODEL ID
         * =================================================
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
         * SATU KALI REFRESH
         * =================================================
         *
         * Refresh memuat:
         * - model catalog
         * - KIE config
         * - parameters
         * - pricing
         * - capability options
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
         * VALIDASI MODEL KIE
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


        const kieModel =
            layout.findModel(
                existingModelId
            );


        if (!kieModel) {

            throw new Error(
                `Model "${existingModelId}" tidak ditemukan dalam katalog KIE.`
            );

        }


        /*
         * =================================================
         * KIE IDENTITY
         * =================================================
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
         * =================================================
         * KIE PRICE
         * =================================================
         *
         * layout.setModel() sudah mengambil harga dari
         * kie_pricing melalui KIE config.
         *
         * Tidak boleh diisi manual.
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
         * Layout sudah membuat checkbox berdasarkan
         * parameter KIE/Supabase.
         *
         * Sekarang selection lama dari record Supabase
         * diterapkan.
         */

        applySavedCapabilitySelection(
            model
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
         * =================================================
         */

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
       Modal langsung dibuka sebelum proses async.
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
         * BUKA MODAL TERLEBIH DAHULU
         * =================================================
         */

        const modal =
            getElement(
                "modelModal"
            );


        if (modal) {

            try {

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
                    "[model-form-edit] Modal open warning:",
                    error
                );


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
         * LOAD DATA
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
