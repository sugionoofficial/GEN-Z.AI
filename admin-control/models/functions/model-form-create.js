/* =========================================================
   GEN-Z.AI
   ADMIN MODEL MANAGEMENT

   File:
   admin-control/models/functions/model-form-create.js

   OWNER:
   CREATE MODEL

   Tanggung jawab:
   - Mengambil data form untuk CREATE
   - Memastikan Model ID berasal dari KIE
   - Mengambil Model Name dari KIE
   - Mengambil Model Family dari KIE
   - Mengambil capability dari KIE
   - Validasi data CREATE
   - Menyusun payload CREATE
   - Mengirim POST ke /api/admin-models
   - Mengambil access token Supabase
   - Menampilkan status proses
   - Membersihkan state setelah berhasil

   TIDAK bertanggung jawab atas:
   - Provider dropdown
   - Model ID dropdown
   - Search Model
   - Kalkulasi credit
   - Discount calculation
   - Edit Model
   - Delete Model
   - Event listener form
   - Event listener button
   - Render tabel

   Event owner:
   model-form-events.js

   Provider owner:
   models-provider.js

   Model catalog owner:
   model-form-layout.js

   Credit calculation owner:
   model-price-calculation.js

   API/Data owner:
   models-data.js / endpoint /api/admin-models

   ========================================================= */

(function () {

    "use strict";


    /* =====================================================
       STATE
    ===================================================== */

    let creating = false;


    /* =====================================================
       ELEMENT
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


    /* =====================================================
       NORMALIZE ARRAY
    ===================================================== */

    function normalizeArray(value) {

        if (Array.isArray(value)) {

            return value
                .map(item =>
                    String(item ?? "").trim()
                )
                .filter(Boolean);

        }


        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {

            return [];

        }


        return String(value)
            .split(",")
            .map(item =>
                item.trim()
            )
            .filter(Boolean);

    }


    /* =====================================================
       UNIQUE ARRAY
    ===================================================== */

    function uniqueArray(value) {

        const source =
            normalizeArray(value);

        const seen =
            new Set();

        const result =
            [];

        source.forEach(
            item => {

                const key =
                    item
                        .trim()
                        .toLowerCase();

                if (!key) {
                    return;
                }

                if (seen.has(key)) {
                    return;
                }

                seen.add(key);

                result.push(item);

            }
        );

        return result;

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
       FORM LAYOUT
       -----------------------------------------------------
       Semua data KIE harus melalui Layout.
    ===================================================== */

    function getFormLayout() {

        return (
            window.GENZModelFormLayout ||
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


        const modelId =
            typeof layout.getCurrentModelId ===
                "function"
                ? layout.getCurrentModelId()
                : getValue("modelCode");


        if (!modelId) {
            return null;
        }


        if (
            typeof layout.findModel ===
            "function"
        ) {

            const model =
                layout.findModel(
                    modelId
                );

            if (model) {
                return model;
            }

        }


        if (
            typeof layout.findModelById ===
            "function"
        ) {

            const model =
                layout.findModelById(
                    modelId
                );

            if (model) {
                return model;
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
                "[GEN-Z.AI] Gagal membaca KIE config:",
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

            const parameters =
                layout.getCurrentParameters();

            return Array.isArray(
                parameters
            )
                ? parameters
                : [];

        } catch (error) {

            console.warn(
                "[GEN-Z.AI] Gagal membaca KIE parameters:",
                error
            );

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

            const pricing =
                layout.getCurrentPricing();

            return Array.isArray(
                pricing
            )
                ? pricing
                : [];

        } catch (error) {

            console.warn(
                "[GEN-Z.AI] Gagal membaca KIE pricing:",
                error
            );

            return [];

        }

    }


    /* =====================================================
       KIE CAPABILITIES
       -----------------------------------------------------
       Capability utama dibaca dari checkbox yang
       sudah dirender oleh model-form-layout.js.

       Tidak membuat ratio/duration/resolution sendiri.
    ===================================================== */

    function getCapabilityValues(
        group
    ) {

        const result =
            [];


        document
            .querySelectorAll(
                `input[data-kie-capability="${group}"]:checked`
            )
            .forEach(
                checkbox => {

                    const value =
                        String(
                            checkbox.dataset.kieValue ??
                            ""
                        ).trim();

                    if (value) {
                        result.push(
                            value
                        );
                    }

                }
            );


        return uniqueArray(
            result
        );

    }


    /* =====================================================
       SYNC KIE CAPABILITIES
       -----------------------------------------------------
       Gunakan API Layout terlebih dahulu.
       Ini penting agar field legacy tetap sinkron
       dengan checkbox KIE.

       Tidak dispatch event change secara manual.
       Hal ini sengaja untuk mencegah recursive event
       / Maximum call stack size exceeded.
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
                    "[GEN-Z.AI] Gagal sinkronisasi capability legacy:",
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
                    "[GEN-Z.AI] Gagal sinkronisasi duration:",
                    error
                );

            }

        }

    }


    /* =====================================================
       FORM DATA
       -----------------------------------------------------
       Form hanya menjadi sumber untuk:
       - provider
       - description
       - credit
       - discount
       - status

       Model identity dan capability berasal dari KIE.
    ===================================================== */

    function collectFormData() {

        const kieModel =
            getCurrentKieModel();


        const modelId =
            String(
                kieModel?.model_id ??
                getValue("modelCode") ??
                ""
            ).trim();


        const modelName =
            String(
                kieModel?.model_name ??
                ""
            ).trim();


        const modelFamily =
            String(
                kieModel?.model_family ??
                ""
            ).trim();


        const ratioValues =
            getCapabilityValues(
                "ratio"
            );


        const durationValues =
            getCapabilityValues(
                "duration"
            );


        const resolutionValues =
            getCapabilityValues(
                "resolution"
            );


        /*
         * Duration fallback hanya membaca
         * field yang sudah disinkronkan oleh Layout.
         *
         * Tidak membuat angka duration sendiri.
         */

        const minDuration =
            getValue(
                "minDuration"
            );


        const maxDuration =
            getValue(
                "maxDuration"
            );


        /*
         * Ratio/resolution fallback ke field legacy
         * hanya jika checkbox belum tersedia.
         *
         * Nilainya tetap harus berasal dari Layout.
         */

        const legacyRatios =
            ratioValues.length
                ? ratioValues
                : normalizeArray(
                    getValue(
                        "supportedRatios"
                    )
                );


        const legacyResolutions =
            resolutionValues.length
                ? resolutionValues
                : normalizeArray(
                    getValue(
                        "supportedResolutions"
                    )
                );


        return {

            provider_id:
                getValue(
                    "providerId"
                ),

            model_id:
                modelId,

            model_name:
                modelName,

            model_family:
                modelFamily,

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
                minDuration,

            max_duration:
                maxDuration,

            supported_ratios:
                uniqueArray(
                    legacyRatios
                ),

            supported_resolutions:
                uniqueArray(
                    legacyResolutions
                ),

            status:
                getValue(
                    "modelStatus"
                ) ||
                "active"

        };

    }


    /* =====================================================
       VALIDATION
    ===================================================== */

    function validate(
        data
    ) {

        if (!data) {

            return "Data model tidak tersedia.";

        }


        /*
         * Provider
         */

        if (!data.provider_id) {

            return "Provider wajib dipilih.";

        }


        /*
         * Model wajib berasal dari KIE.
         */

        if (!data.model_id) {

            return "Model ID wajib dipilih dari katalog KIE.";

        }


        if (!data.model_name) {

            return "Model Name dari konfigurasi KIE tidak tersedia.";

        }


        /*
         * Pastikan model benar-benar ditemukan
         * dalam catalog KIE.
         */

        const kieModel =
            getCurrentKieModel();

        if (!kieModel) {

            return (
                "Model KIE tidak ditemukan. Pilih Model ID dari daftar yang tersedia."
            );

        }


        /*
         * Credit
         */

        if (
            data.credit_cost !==
                "" &&
            !Number.isFinite(
                Number(
                    data.credit_cost
                )
            )
        ) {

            return "Credit normal harus berupa angka.";

        }


        if (
            data.credit_cost !==
                "" &&
            Number(
                data.credit_cost
            ) < 0
        ) {

            return "Credit normal tidak boleh negatif.";

        }


        /*
         * Discount
         */

        if (
            data.discount_percent !==
                "" &&
            !Number.isFinite(
                Number(
                    data.discount_percent
                )
            )
        ) {

            return "Diskon harus berupa angka.";

        }


        if (
            data.discount_percent !==
                "" &&
            (
                Number(
                    data.discount_percent
                ) < 0 ||
                Number(
                    data.discount_percent
                ) > 100
            )
        ) {

            return (
                "Diskon harus antara 0 sampai 100 persen."
            );

        }


        /*
         * Credit final.
         */

        if (
            data.credit_final !==
                "" &&
            !Number.isFinite(
                Number(
                    data.credit_final
                )
            )
        ) {

            return "Credit final harus berupa angka.";

        }


        /*
         * Duration.
         */

        if (
            data.min_duration !==
                "" &&
            !Number.isFinite(
                Number(
                    data.min_duration
                )
            )
        ) {

            return (
                "Minimum duration harus berupa angka."
            );

        }


        if (
            data.max_duration !==
                "" &&
            !Number.isFinite(
                Number(
                    data.max_duration
                )
            )
        ) {

            return (
                "Maximum duration harus berupa angka."
            );

        }


        if (
            data.min_duration !==
                "" &&
            data.max_duration !==
                "" &&
            Number(
                data.min_duration
            ) >
            Number(
                data.max_duration
            )
        ) {

            return (
                "Minimum duration tidak boleh lebih besar dari maximum duration."
            );

        }


        /*
         * Status.
         */

        const status =
            String(
                data.status ||
                "active"
            )
                .trim()
                .toLowerCase();


        if (
            ![
                "active",
                "inactive",
                "maintenance"
            ].includes(
                status
            )
        ) {

            return "Status model tidak valid.";

        }


        /*
         * Capability tidak boleh dibuat
         * apabila KIE tidak menyediakan konfigurasi.
         *
         * Kita tidak memaksa ratio/duration/resolution
         * harus ada karena beberapa model memang dapat
         * memiliki parameter tertentu saja.
         */

        const kieConfig =
            getCurrentKieConfig();

        if (!kieConfig) {

            return (
                "Konfigurasi KIE belum tersedia. Model tidak dapat disimpan."
            );

        }


        return null;

    }


    /* =====================================================
       ACCESS TOKEN
    ===================================================== */

    async function getAccessToken() {

        const supabase =
            window.GENZ_SUPABASE ||
            window.supabaseClient ||
            null;


        if (!supabase) {

            throw new Error(
                "Supabase client belum tersedia."
            );

        }


        if (
            !supabase.auth ||
            typeof supabase.auth.getSession !==
                "function"
        ) {

            throw new Error(
                "Supabase authentication belum tersedia."
            );

        }


        const result =
            await supabase.auth.getSession();


        const session =
            result?.data?.session ||
            null;


        if (
            !session ||
            !session.access_token
        ) {

            throw new Error(
                "Session login tidak ditemukan. Silakan login kembali."
            );

        }


        return session.access_token;

    }


    /* =====================================================
       BUILD PAYLOAD
       -----------------------------------------------------
       Hanya field yang diterima oleh /api/admin-models.

       Model identity berasal dari KIE.
       Capability berasal dari KIE.

       kieUnitPrice sengaja TIDAK dikirim ke POST karena
       endpoint CREATE saat ini tidak membuat record pricing.
    ===================================================== */

    function buildPayload(
        data
    ) {

        if (!data) {

            return null;

        }


        const payload = {

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


        return payload;

    }


    /* =====================================================
       API CREATE
    ===================================================== */

    async function create(
        data
    ) {

        const token =
            await getAccessToken();


        const payload =
            buildPayload(
                data
            );


        if (!payload) {

            throw new Error(
                "Payload model tidak tersedia."
            );

        }


        const response =
            await fetch(
                "/api/admin-models",
                {

                    method: "POST",

                    headers: {

                        "Content-Type":
                            "application/json",

                        "Accept":
                            "application/json",

                        "Authorization":
                            `Bearer ${token}`

                    },

                    body:
                        JSON.stringify(
                            payload
                        )

                }
            );


        const responseText =
            await response.text();


        let result =
            null;


        if (responseText) {

            try {

                result =
                    JSON.parse(
                        responseText
                    );

            } catch {

                result = {

                    message:
                        responseText

                };

            }

        }


        if (!response.ok) {

            throw new Error(

                result?.error ||
                result?.message ||
                result?.details ||
                `Gagal menambahkan model (${response.status}).`

            );

        }


        return result;

    }


    /* =====================================================
       CREATE FROM FORM
    ===================================================== */

    async function createFromForm(
        event = null
    ) {

        /*
         * Jangan biarkan submit event kembali
         * menjalankan handler lain.
         *
         * stopImmediatePropagation sengaja hanya
         * dilakukan pada event submit yang masuk ke
         * module ini.
         */

        if (event) {

            try {

                event.preventDefault();

            } catch {
                /* ignore */
            }

        }


        if (creating) {

            return null;

        }


        /*
         * Sinkronisasi KIE capability terlebih dahulu.
         *
         * Tidak memicu event change.
         */

        syncKieCapabilities();


        /*
         * Ambil data SETELAH capability sync.
         */

        const data =
            collectFormData();


        const validationError =
            validate(
                data
            );


        if (validationError) {

            notify(
                validationError,
                "error"
            );

            return null;

        }


        creating = true;


        const button =
            firstElement(
                [
                    "saveModelBtn",
                    "saveModelButton",
                    "saveModel"
                ]
            );


        const originalText =
            button?.textContent ||
            "Tambah Model";


        if (button) {

            button.disabled =
                true;

            button.textContent =
                "Menambahkan...";

        }


        try {

            /*
             * Pricing calculation tetap menjadi
             * owner terpisah.
             *
             * Jangan dispatch input/change secara manual.
             */

            const calculation =
                window.GENZModelPriceCalculation;


            if (
                calculation &&
                typeof calculation.syncForm ===
                    "function"
            ) {

                try {

                    calculation.syncForm();

                } catch (error) {

                    console.warn(
                        "[GEN-Z.AI] Credit calculation sync warning:",
                        error
                    );

                }

            }


            /*
             * Ambil ulang form setelah calculation.
             *
             * Tidak memanggil setModel().
             * Tidak memanggil provider change.
             * Tidak memanggil model change.
             *
             * Dengan demikian jalur CREATE tidak
             * membuat event recursion.
             */

            syncKieCapabilities();


            const finalData =
                collectFormData();


            const finalValidation =
                validate(
                    finalData
                );


            if (finalValidation) {

                throw new Error(
                    finalValidation
                );

            }


            /*
             * Pastikan Model ID yang dikirim sama
             * dengan Model ID dari katalog KIE.
             */

            const kieModel =
                getCurrentKieModel();


            if (!kieModel) {

                throw new Error(
                    "Model KIE tidak ditemukan. Pilih Model ID dari katalog KIE."
                );

            }


            const kieModelId =
                String(
                    kieModel.model_id ??
                    ""
                ).trim();


            if (
                !kieModelId ||
                kieModelId !==
                    finalData.model_id
            ) {

                throw new Error(
                    "Model ID tidak sinkron dengan katalog KIE. Silakan pilih ulang Model ID."
                );

            }


            /*
             * Model Name harus berasal dari KIE.
             */

            const kieModelName =
                String(
                    kieModel.model_name ??
                    ""
                ).trim();


            if (
                !kieModelName ||
                kieModelName !==
                    finalData.model_name
            ) {

                throw new Error(
                    "Model Name tidak sinkron dengan data KIE. Silakan pilih ulang Model ID."
                );

            }


            /*
             * Config KIE wajib tersedia.
             */

            const kieConfig =
                getCurrentKieConfig();


            if (!kieConfig) {

                throw new Error(
                    "Konfigurasi KIE tidak tersedia. Model tidak disimpan."
                );

            }


            /*
             * Simpan.
             */

            const result =
                await create(
                    finalData
                );


            notify(
                "Model berhasil ditambahkan.",
                "success"
            );


            /*
             * Bersihkan cache Data module.
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
                        "[GEN-Z.AI] Gagal membersihkan cache model:",
                        error
                    );

                }

            }


            /*
             * Beritahu coordinator/UI.
             */

            try {

                document.dispatchEvent(

                    new CustomEvent(
                        "genz-model-created",
                        {
                            detail: {

                                result,

                                model:
                                    finalData,

                                kieModel: {
                                    ...kieModel
                                },

                                kieConfig

                            }
                        }
                    )

                );

            } catch (error) {

                console.warn(
                    "[GEN-Z.AI] Event model-created warning:",
                    error
                );

            }


            /*
             * Tutup modal melalui event owner.
             */

            const formEvents =
                window.GENZModelFormEvents;


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

            } else {

                /*
                 * Fallback minimal apabila event module
                 * belum termuat.
                 */

                const modal =
                    getElement(
                        "modelModal"
                    );


                if (modal) {

                    modal.classList.remove(
                        "open",
                        "show"
                    );

                    modal.classList.add(
                        "hidden"
                    );

                    modal.setAttribute(
                        "aria-hidden",
                        "true"
                    );

                    modal.style.display =
                        "none";

                    document.body.classList.remove(
                        "modal-open"
                    );

                }

            }


            return result;

        } catch (error) {

            console.error(
                "[GEN-Z.AI] Create model error:",
                error
            );


            notify(
                error?.message ||
                "Gagal menambahkan model.",
                "error"
            );


            throw error;

        } finally {

            creating =
                false;


            if (button) {

                button.disabled =
                    false;

                button.textContent =
                    originalText;

            }

        }

    }


    /* =====================================================
       RESET
    ===================================================== */

    function reset() {

        creating =
            false;

    }


    /* =====================================================
       STATE
    ===================================================== */

    function isCreating() {

        return Boolean(
            creating
        );

    }


    /* =====================================================
       PUBLIC API
    ===================================================== */

    window.GENZModelFormCreate =
        Object.freeze({

            collectFormData,

            validate,

            buildPayload,

            getAccessToken,

            create,

            createFromForm,

            reset,

            isCreating

        });


    console.log(
        "[GEN-Z.AI] GENZModelFormCreate loaded."
    );


})();
