/* =========================================================
   GEN-Z.AI
   ADMIN MODEL MANAGEMENT
   MODEL FORM EDIT

   File:
   admin-control/models/functions/model-form-edit.js

   OWNER:
   EDIT MODEL

   Tanggung jawab:
   - Mode Edit Model
   - Populate data model ke form
   - Validasi data edit
   - Build payload update
   - Update model melalui coordinator
   - Sinkronisasi Model ID dengan Model Form Layout
   - Tidak mengambil alih Provider
   - Tidak mengambil alih Pricing
   - Tidak melakukan query Supabase langsung

   ARSITEKTUR:
   - Provider  -> GENZModelsProvider / GENZModelProviderDropdown
   - Model ID  -> GENZModelFormLayout
   - Pricing   -> GENZModelPriceCalculation
   - CRUD      -> GENZModelFormCoordinator
   - Modal     -> GENZModelFormEvents

   PENTING:
   File ini TIDAK lagi bergantung kepada:
       window.GENZModelsForm
========================================================= */

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

        return element.value ?? "";

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
                .map(item =>
                    String(item).trim()
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
            .map(item =>
                item.trim()
            )
            .filter(Boolean);

    }


    /* =====================================================
       NUMBER
    ===================================================== */

    function toNumber(value) {

        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {

            return null;

        }


        const number =
            Number(value);


        return Number.isFinite(number)
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


            requestAnimationFrame(
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
    ===================================================== */

    function getFormLayout() {

        return (
            window.GENZModelFormLayout ||
            null
        );

    }


    /* =====================================================
       PRICE CALCULATION
    ===================================================== */

    function getPriceCalculation() {

        return (
            window.GENZModelPriceCalculation ||
            null
        );

    }


    /* =====================================================
       PROVIDER MODULE
    ===================================================== */

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


    /* =====================================================
       FORM EVENTS
    ===================================================== */

    function getFormEvents() {

        return (
            window.GENZModelFormEvents ||
            null
        );

    }


    /* =====================================================
       SET PROVIDER
    ===================================================== */

    async function setProvider(
        providerIdentifier
    ) {

        const value =
            String(
                providerIdentifier || ""
            ).trim();


        if (!value) {

            return null;

        }


        const dropdown =
            getProviderDropdown();


        if (
            dropdown &&
            typeof dropdown.setValue ===
                "function"
        ) {

            try {

                const result =
                    await dropdown.setValue(
                        value
                    );


                return result || value;

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
                ).find(option => {

                    const optionValue =
                        String(
                            option.value || ""
                        )
                            .trim()
                            .toLowerCase();


                    return (
                        optionValue ===
                        value.toLowerCase()
                    );

                });


            if (option) {

                select.value =
                    option.value;


                return option.value;

            }

        }


        return null;

    }


    /* =====================================================
       MODEL ID
    =====================================================

       modelCodeSearch dikelola oleh
       GENZModelFormLayout.

       File Edit tidak boleh mengambil alih
       option Model ID.
    ===================================================== */

    async function setModel(
        model
    ) {

        if (!model) {

            return null;

        }


        const layout =
            getFormLayout();


        if (
            layout &&
            typeof layout.setModel ===
                "function"
        ) {

            try {

                const result =
                    await layout.setModel(
                        model
                    );


                const modelId =
                    String(
                        model.model_id ||
                        model.modelId ||
                        ""
                    ).trim();


                if (modelId) {

                    setValue(
                        "modelCode",
                        modelId
                    );

                }


                return (
                    result ||
                    model
                );

            } catch (error) {

                console.warn(
                    "[model-form-edit] Layout setModel error:",
                    error
                );

            }

        }


        /*
         * Fallback kompatibilitas jika
         * Model Form Layout belum tersedia.
         */

        const modelId =
            String(
                model.model_id ||
                model.modelId ||
                ""
            ).trim();


        if (!modelId) {

            return null;

        }


        setValue(
            "modelCode",
            modelId
        );


        const search =
            getElement(
                "modelCodeSearch"
            );


        if (search) {

            /*
             * SELECT.
             */

            if (
                search.tagName ===
                "SELECT"
            ) {

                const option =
                    Array.from(
                        search.options || []
                    ).find(option =>
                        String(
                            option.value || ""
                        ).trim() ===
                        modelId
                    );


                if (option) {

                    search.value =
                        option.value;

                }

            } else {

                /*
                 * Legacy INPUT.
                 */

                search.value =
                    modelId;

            }

        }


        return model;

    }


    /* =====================================================
       WAIT MODEL SELECT
    ===================================================== */

    async function waitForModelLayout() {

        const layout =
            getFormLayout();


        if (!layout) {

            return;

        }


        await new Promise(
            resolve => {

                window.setTimeout(
                    resolve,
                    0
                );

            }
        );


        /*
         * Layout menyelesaikan refresh
         * internalnya sendiri.
         */

        if (
            typeof layout.refresh ===
            "function"
        ) {

            try {

                await layout.refresh();

            } catch (error) {

                console.warn(
                    "[model-form-edit] Layout refresh warning:",
                    error
                );

            }

        }

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


        info.innerHTML = `
            <strong>Model dipilih:</strong>
            ${escapeHtml(name)}
            <br>
            <span>
                ${escapeHtml(id)}
            </span>
        `;

    }


    /* =====================================================
       ESCAPE HTML
    ===================================================== */

    function escapeHtml(
        value
    ) {

        return String(
            value ?? ""
        )
            .replace(
                /&/g,
                "&amp;"
            )
            .replace(
                /</g,
                "&lt;"
            )
            .replace(
                />/g,
                "&gt;"
            )
            .replace(
                /"/g,
                "&quot;"
            )
            .replace(
                /'/g,
                "&#039;"
            );

    }


    /* =====================================================
       COLLECT DATA
    ===================================================== */

    function collectData() {

        let modelId =
            String(
                getValue(
                    "modelCode"
                )
            ).trim();


        /*
         * Fallback jika hidden Model Code
         * belum tersinkron.
         */

        if (!modelId) {

            modelId =
                String(
                    getValue(
                        "modelCodeSearch"
                    )
                ).trim();

        }


        const creditCost =
            getValue(
                "creditCost"
            ).trim();


        const discountPercent =
            getValue(
                "discountPercent"
            ).trim();


        const creditFinal =
            getValue(
                "creditFinal"
            ).trim();


        return {

            id:
                getValue(
                    "modelRecordId"
                ).trim(),

            provider_id:
                getValue(
                    "providerId"
                ).trim(),

            model_id:
                modelId,

            model_name:
                getValue(
                    "modelName"
                ).trim(),

            description:
                getValue(
                    "description"
                ).trim(),

            credit_cost:
                creditCost,

            discount_percent:
                discountPercent,

            credit_final:
                creditFinal,

            min_duration:
                getValue(
                    "minDuration"
                ).trim(),

            max_duration:
                getValue(
                    "maxDuration"
                ).trim(),

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
                )
                    .trim()
                    .toLowerCase()

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


        if (!data.provider_id) {

            return "Provider wajib dipilih.";

        }


        if (!data.model_id) {

            return "Model ID wajib dipilih.";

        }


        if (!data.model_name) {

            return "Model Name wajib diisi.";

        }


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


        if (
            data.discount_percent !==
                "" &&
            toNumber(
                data.discount_percent
            ) === null
        ) {

            return (
                "Discount Percent harus berupa angka."
            );

        }


        const discount =
            toNumber(
                data.discount_percent
            );


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


        if (
            data.min_duration !==
                "" &&
            toNumber(
                data.min_duration
            ) === null
        ) {

            return (
                "Minimum Duration harus berupa angka."
            );

        }


        if (
            data.max_duration !==
                "" &&
            toNumber(
                data.max_duration
            ) === null
        ) {

            return (
                "Maximum Duration harus berupa angka."
            );

        }


        const min =
            toNumber(
                data.min_duration
            );


        const max =
            toNumber(
                data.max_duration
            );


        if (
            min !== null &&
            max !== null &&
            min > max
        ) {

            return (
                "Minimum Duration tidak boleh lebih besar dari Maximum Duration."
            );

        }


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

            provider_id:
                data.provider_id,

            model_id:
                data.model_id,

            model_name:
                data.model_name,

            description:
                data.description,

            credit_cost:
                data.credit_cost,

            discount_percent:
                data.discount_percent,

            credit_final:
                data.credit_final,

            min_duration:
                data.min_duration,

            max_duration:
                data.max_duration,

            supported_ratios:
                data.supported_ratios,

            supported_resolutions:
                data.supported_resolutions,

            status:
                data.status

        };


        /*
         * UUID record database.
         */

        if (
            editingModel?.id
        ) {

            payload.id =
                editingModel.id;

        } else if (
            data.id
        ) {

            payload.id =
                data.id;

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


        const data =
            collectData();


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
         * Coordinator adalah satu-satunya
         * pintu CRUD.
         */

        const coordinator =
            window.GENZModelFormCoordinator;


        if (
            coordinator &&
            typeof coordinator.update ===
                "function"
        ) {

            return coordinator.update(
                payload
            );

        }


        throw new Error(
            "Module GENZModelFormCoordinator belum tersedia."
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


        saving = true;


        try {

            const result =
                await update();


            notify(
                "Model berhasil diperbarui.",
                "success"
            );


            /*
             * Bersihkan cache Data module
             * setelah update berhasil.
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
             * Informasikan UI.
             */

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


            /*
             * Tutup modal melalui owner event.
             */

            const formEvents =
                getFormEvents();


            if (
                formEvents &&
                typeof formEvents.closeModal ===
                    "function"
            ) {

                formEvents.closeModal();

            }


            return result;

        } catch (error) {

            console.error(
                "[model-form-edit] Update error:",
                error
            );


            /*
             * Jika error sudah diberi
             * notifikasi oleh update(),
             * tetap tampilkan pesan final
             * untuk error API lainnya.
             */

            if (
                error?.message
            ) {

                notify(
                    error.message,
                    "error"
                );

            } else {

                notify(
                    "Gagal memperbarui model.",
                    "error"
                );

            }


            throw error;

        } finally {

            saving = false;

        }

    }


    /* =====================================================
       POPULATE
    ===================================================== */

    async function populate(
        model
    ) {

        if (!model) {

            return false;

        }


        /*
         * Simpan referensi model yang sedang
         * diedit.
         */

        editingModel = {
            ...model
        };


        /*
         * Record ID.
         */

        setValue(
            "modelRecordId",
            model.id || ""
        );


        /*
         * Provider.
         *
         * Provider harus dipilih terlebih dahulu
         * karena Model ID dropdown mengikuti Provider.
         */

        const providerIdentifier =
            model.provider_id ||
            model.provider ||
            model.provider_code ||
            model.provider_uuid ||
            "";


        if (providerIdentifier) {

            await setProvider(
                providerIdentifier
            );

        }


        /*
         * Beri kesempatan Provider event
         * menyelesaikan refresh Model ID.
         */

        await waitForModelLayout();


        /*
         * Model ID.
         *
         * WAJIB melalui Layout.
         */

        await setModel(
            model
        );


        /*
         * Model Name dari database harus
         * dipertahankan.
         */

        setValue(
            "modelName",
            model.model_name || ""
        );


        /*
         * Description.
         */

        setValue(
            "description",
            model.description || ""
        );


        /*
         * Credit.
         */

        setValue(
            "creditCost",
            model.credit_cost ?? ""
        );


        setValue(
            "discountPercent",
            model.discount_percent ?? 0
        );


        /*
         * Credit Final menggunakan nilai
         * database saat Edit dibuka.
         */

        setValue(
            "creditFinal",
            model.credit_final ?? ""
        );


        /*
         * Duration.
         */

        setValue(
            "minDuration",
            model.min_duration ?? ""
        );


        setValue(
            "maxDuration",
            model.max_duration ?? ""
        );


        /*
         * Ratio.
         */

        setValue(
            "supportedRatios",
            normalizeArray(
                model.supported_ratios
            )
        );


        /*
         * Resolution.
         */

        setValue(
            "supportedResolutions",
            normalizeArray(
                model.supported_resolutions
            )
        );


        /*
         * Status.
         */

        setValue(
            "modelStatus",
            model.status ||
            "active"
        );


        /*
         * Selected Model Info.
         */

        updateSelectedModelInfo(
            model
        );


        /*
         * Preview Credit.
         */

        const priceCalculation =
            getPriceCalculation();


        if (
            priceCalculation &&
            typeof priceCalculation.updatePreview ===
                "function"
        ) {

            try {

                priceCalculation.updatePreview();

            } catch (error) {

                console.warn(
                    "[model-form-edit] Credit preview warning:",
                    error
                );

            }

        }


        /*
         * Preview USD/IDR.
         */

        const layout =
            getFormLayout();


        if (
            layout &&
            typeof layout.updateUsdPreview ===
                "function"
        ) {

            try {

                await layout.updateUsdPreview();

            } catch (error) {

                console.warn(
                    "[model-form-edit] USD preview warning:",
                    error
                );

            }

        }


        document.dispatchEvent(

            new CustomEvent(
                "genz-model-edit-populated",
                {
                    detail: {

                        model: {
                            ...model
                        }

                    }
                }
            )

        );


        return true;

    }


    /* =====================================================
       OPEN
    =====================================================

       Modal lifecycle tidak lagi menggunakan
       GENZModelsForm.

       Populate tetap menjadi tanggung jawab
       Edit module.

       Pembukaan modal dilakukan langsung di sini
       hanya sebagai lifecycle UI minimal jika
       models-ui belum menangani modal.
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


        editingModel = {
            ...model
        };


        try {

            /*
             * Populate terlebih dahulu supaya
             * Provider dan Model ID siap ketika
             * modal ditampilkan.
             */

            await populate(
                model
            );


            /*
             * Modal owner utama.
             */

            const formEvents =
                getFormEvents();


            if (
                formEvents &&
                typeof formEvents.openModal ===
                    "function"
            ) {

                return (
                    await formEvents.openModal(
                        "edit",
                        model
                    )
                ) !== false;

            }


            /*
             * Fallback langsung ke DOM.
             */

            const modal =
                getElement(
                    "modelModal"
                );


            if (!modal) {

                return true;

            }


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


            return true;

        } catch (error) {

            console.error(
                "[model-form-edit] Open error:",
                error
            );


            return false;

        }

    }


    /* =====================================================
       CLEAR STATE
    ===================================================== */

    function clear() {

        editingModel =
            null;

        saving =
            false;

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

        return saving;

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


        console.log(
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

            isSaving

        });


})();
