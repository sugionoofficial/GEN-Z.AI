/* =========================================================
   GEN-Z.AI
   ADMIN MODEL MANAGEMENT

   File:
   admin-control/models/functions/model-form-create.js

   OWNER:
   CREATE MODEL

   Tanggung jawab:
   - Mengambil data form untuk CREATE
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
       FORM DATA
    ===================================================== */

    function collectFormData() {

        /*
         * Model ID utama berasal dari hidden field.
         *
         * modelCodeSearch hanya digunakan sebagai
         * fallback apabila hidden field belum tersinkron.
         */

        let modelId =
            getValue(
                "modelCode"
            );

        if (!modelId) {

            modelId =
                getValue(
                    "modelCodeSearch"
                );

        }


        return {

            provider_id:
                getValue(
                    "providerId"
                ),

            model_id:
                modelId,

            model_name:
                getValue(
                    "modelName"
                ),

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


        if (!data.provider_id) {

            return "Provider wajib dipilih.";

        }


        if (!data.model_id) {

            return "Model ID wajib dipilih.";

        }


        if (!data.model_name) {

            return "Nama model wajib diisi.";

        }


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

            return "Diskon harus antara 0 sampai 100 persen.";

        }


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


        if (
            data.min_duration !==
                "" &&
            !Number.isFinite(
                Number(
                    data.min_duration
                )
            )
        ) {

            return "Minimum duration harus berupa angka.";

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

            return "Maximum duration harus berupa angka.";

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
                Array.isArray(
                    data.supported_ratios
                )
                    ? data.supported_ratios
                    : [],

            supported_resolutions:
                Array.isArray(
                    data.supported_resolutions
                )
                    ? data.supported_resolutions
                    : [],

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

    async function createFromForm() {

        if (creating) {

            return null;

        }


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
             * Pastikan credit final sudah
             * dihitung oleh owner pricing.
             *
             * Create tidak menghitung sendiri.
             */

            const calculation =
                window.GENZModelPriceCalculation;


            if (
                calculation &&
                typeof calculation.syncForm ===
                    "function"
            ) {

                calculation.syncForm();

            }


            /*
             * Ambil ulang data setelah sync
             * supaya credit_final yang dikirim
             * merupakan nilai terbaru.
             */

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

                dataModule.clearCache();

            }


            /*
             * Beritahu coordinator/UI.
             *
             * Create tidak langsung
             * mengelola tabel.
             */

            document.dispatchEvent(
                new CustomEvent(
                    "genz-model-created",
                    {
                        detail: {

                            result,

                            model:
                                finalData

                        }
                    }
                )
            );


            /*
             * Tutup modal melalui
             * Form coordinator apabila tersedia.
             */

            const form =
                window.GENZModelsForm;


            if (
                form &&
                typeof form.closeModal ===
                    "function"
            ) {

                form.closeModal();

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
