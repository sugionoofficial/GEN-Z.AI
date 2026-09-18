/* =========================================================
   GEN-Z.AI
   ADMIN MODEL MANAGEMENT
   MODEL FORM MODULE

   File:
   admin-control/models/models-form.js

   Fungsi:
   - Tambah Model
   - Edit Model
   - Tutup modal
   - Model ID dari pencarian Supabase
   - Provider dari public.providers
   - Validasi form
   - Save ke /api/admin-models
   - Auth Bearer token Supabase
   - Refresh data setelah save

   Arsitektur:
   - Provider lifecycle dimiliki GENZModelsProvider
   - Form hanya membaca / memilih Provider
   - Search dimiliki GENZModelsSearch
   - Data dimiliki GENZModelsData
   - Tidak membuat Provider palsu
========================================================= */

(function () {
    "use strict";

    let editingModel = null;
    let initialized = false;
    let saving = false;

    /* =====================================================
       ELEMENT
    ===================================================== */

    function getElement(id) {
        return document.getElementById(id);
    }

    function firstElement(ids) {
        for (const id of ids) {
            const element = getElement(id);

            if (element) {
                return element;
            }
        }

        return null;
    }

    function value(id) {
        const element = getElement(id);

        if (!element) {
            return "";
        }

        return element.value;
    }

    function setValue(id, newValue) {
        const element = getElement(id);

        if (!element) {
            return;
        }

        if (Array.isArray(newValue)) {
            element.value = newValue.join(", ");
            return;
        }

        element.value = newValue ?? "";
    }

    function normalizeArray(input) {
        if (Array.isArray(input)) {
            return input
                .map(item => String(item).trim())
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
            .map(item => item.trim())
            .filter(Boolean);
    }

    /* =====================================================
       NOTIFICATION
    ===================================================== */

    function notify(message, type = "info") {
        const existing =
            getElement("modelNotification") ||
            getElement("notification") ||
            getElement("toast");

        if (existing) {
            existing.textContent = message;

            existing.classList.remove(
                "success",
                "error",
                "warning",
                "info",
                "show"
            );

            existing.classList.add(type);

            requestAnimationFrame(() => {
                existing.classList.add("show");
            });

            window.clearTimeout(
                existing.__genzTimer
            );

            existing.__genzTimer =
                window.setTimeout(() => {
                    existing.classList.remove("show");
                }, 3500);

            return;
        }

        const toast =
            document.createElement("div");

        toast.id = "modelNotification";

        toast.className =
            `genz-model-notification ${type}`;

        toast.textContent = message;

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

        document.body.appendChild(toast);

        window.setTimeout(() => {
            toast.style.opacity = "0";
            toast.style.transform =
                "translateY(8px)";
            toast.style.transition =
                "opacity .2s ease, transform .2s ease";

            window.setTimeout(() => {
                toast.remove();
            }, 250);
        }, 3500);
    }

    /* =====================================================
       PROVIDER
    ===================================================== */

    function getModelsData() {
        return (
            window.GENZModelsData ||
            null
        );
    }

    function getModelsProvider() {
        return (
            window.GENZModelsProvider ||
            null
        );
    }

    /*
     * Provider sekarang memiliki module khusus.
     *
     * models-form.js tidak mengambil alih lifecycle
     * Provider. Fungsi ini hanya menjadi kompatibilitas
     * untuk kebutuhan form.
     */
    async function loadProviders(options = {}) {
        const providerModule =
            getModelsProvider();

        /*
         * PRIORITAS 1:
         * GENZModelsProvider
         */
        if (
            providerModule &&
            typeof providerModule.loadProviders ===
                "function"
        ) {
            try {
                const providers =
                    await providerModule.loadProviders({
                        force:
                            options.force === true,

                        activeOnly:
                            options.activeOnly !== false
                    });

                return Array.isArray(
                    providers
                )
                    ? providers
                    : [];
            } catch (error) {
                console.error(
                    "[models-form] Provider module load error:",
                    error
                );

                return [];
            }
        }

        /*
         * FALLBACK:
         * GENZModelsData hanya digunakan jika
         * Provider module belum tersedia.
         */
        const data =
            getModelsData();

        if (
            data &&
            typeof data.loadProviders ===
                "function"
        ) {
            try {
                const providers =
                    await data.loadProviders({
                        force:
                            options.force === true,

                        activeOnly:
                            options.activeOnly !== false
                    });

                return Array.isArray(
                    providers
                )
                    ? providers
                    : [];
            } catch (error) {
                console.error(
                    "[models-form] Legacy provider load error:",
                    error
                );
            }
        }

        return [];
    }

    function findProvider(
        providerId
    ) {
        const normalized =
            String(
                providerId ||
                ""
            )
                .trim()
                .toLowerCase();

        if (!normalized) {
            return null;
        }

        /*
         * PRIORITAS 1:
         * Provider module.
         */
        const providerModule =
            getModelsProvider();

        if (
            providerModule &&
            typeof providerModule.getProviderById ===
                "function"
        ) {
            try {
                const provider =
                    providerModule.getProviderById(
                        normalized
                    );

                if (provider) {
                    return provider;
                }
            } catch (error) {
                console.warn(
                    "[models-form] Provider module lookup error:",
                    error
                );
            }
        }

        /*
         * PRIORITAS 2:
         * UI state.
         */
        const ui =
            window.GENZModelsUI;

        if (
            ui &&
            typeof ui.getProviders ===
                "function"
        ) {
            try {
                const providers =
                    ui.getProviders();

                if (
                    Array.isArray(
                        providers
                    )
                ) {
                    const found =
                        providers.find(
                            provider =>
                                String(
                                    provider.provider_id ||
                                    provider.provider ||
                                    provider.id ||
                                    ""
                                )
                                    .trim()
                                    .toLowerCase() ===
                                normalized
                        );

                    if (found) {
                        return found;
                    }
                }
            } catch (error) {
                console.warn(
                    "[models-form] UI provider lookup error:",
                    error
                );
            }
        }

        /*
         * PRIORITAS 3:
         * Data module.
         *
         * Hanya lookup, bukan lifecycle.
         */
        const data =
            getModelsData();

        if (
            data &&
            typeof data.findProviderById ===
                "function"
        ) {
            try {
                return (
                    data.findProviderById(
                        normalized
                    ) ||
                    null
                );
            } catch (error) {
                console.warn(
                    "[models-form] Data provider lookup error:",
                    error
                );
            }
        }

        return null;
    }

    function ensureProviderOption(
        providerId,
        provider = null
    ) {
        const select =
            getElement(
                "providerId"
            );

        if (
            !select ||
            select.tagName !== "SELECT"
        ) {
            return false;
        }

        const normalized =
            String(
                providerId ||
                ""
            ).trim();

        if (!normalized) {
            return false;
        }

        /*
         * Cari option yang sudah ada.
         */
        const existing =
            Array.from(
                select.options
            ).find(
                option =>
                    String(
                        option.value ||
                        ""
                    )
                        .trim()
                        .toLowerCase() ===
                    normalized.toLowerCase()
            );

        if (existing) {
            select.value =
                existing.value;

            return true;
        }

        /*
         * Jika option belum ada, cari provider.
         */
        if (!provider) {
            provider =
                findProvider(
                    normalized
                );
        }

        if (!provider) {
            return false;
        }

        const providerValue =
            String(
                provider.provider_id ||
                provider.provider ||
                provider.id ||
                ""
            ).trim();

        if (!providerValue) {
            return false;
        }

        const providerName =
            String(
                provider.provider_name ||
                provider.name ||
                providerValue
            ).trim();

        const option =
            document.createElement(
                "option"
            );

        option.value =
            providerValue;

        option.textContent =
            providerName ===
            providerValue
                ? providerValue
                : `${providerName} (${providerValue})`;

        select.appendChild(
            option
        );

        select.value =
            providerValue;

        return true;
    }

    async function setProvider(
        providerId,
        options = {}
    ) {
        const normalized =
            String(
                providerId ||
                ""
            ).trim();

        if (!normalized) {
            setValue(
                "providerId",
                ""
            );

            return null;
        }

        let provider =
            findProvider(
                normalized
            );

        /*
         * Provider belum tersedia.
         *
         * Load hanya melalui Provider module.
         */
        if (!provider) {
            const providers =
                await loadProviders({
                    force:
                        options.force === true,

                    activeOnly:
                        options.activeOnly !== false
                });

            if (
                Array.isArray(
                    providers
                )
            ) {
                provider =
                    providers.find(
                        item =>
                            String(
                                item.provider_id ||
                                item.provider ||
                                item.id ||
                                ""
                            )
                                .trim()
                                .toLowerCase() ===
                            normalized.toLowerCase()
                    ) || null;
            }
        }

        if (provider) {
            const success =
                ensureProviderOption(
                    normalized,
                    provider
                );

            if (!success) {
                setValue(
                    "providerId",
                    ""
                );

                return null;
            }

            setValue(
                "providerId",
                provider.provider_id ||
                provider.provider ||
                provider.id ||
                ""
            );

            /*
             * Beritahu module Search bahwa Provider
             * berubah.
             *
             * Event listener Search akan melakukan
             * filtering ulang.
             */
            const select =
                getElement(
                    "providerId"
                );

            if (select) {
                select.dispatchEvent(
                    new Event(
                        "change",
                        {
                            bubbles: true
                        }
                    )
                );
            }

            return provider;
        }

        /*
         * Jangan membuat Provider palsu.
         */
        setValue(
            "providerId",
            ""
        );

        return null;
    }

    /* =====================================================
       FORM MODE
    ===================================================== */

    function setFormMode(mode) {
        const title =
            firstElement([
                "modalTitle",
                "modelModalTitle"
            ]);

        const submitButton =
            firstElement([
                "saveModelBtn",
                "saveModelButton",
                "saveModel"
            ]);

        if (mode === "edit") {
            if (title) {
                title.textContent =
                    "Edit Model";
            }

            if (submitButton) {
                submitButton.textContent =
                    "Simpan Perubahan";
            }

            return;
        }

        if (title) {
            title.textContent =
                "Tambah Model";
        }

        if (submitButton) {
            submitButton.textContent =
                "Tambah Model";
        }
    }

    /* =====================================================
       OPEN CREATE
    ===================================================== */

    async function openCreateForm() {
        editingModel = null;

        /*
         * Modal dibuka PALING AWAL.
         */
        try {
            openModal();
        } catch (error) {
            console.error(
                "[models-form] Gagal membuka modal:",
                error
            );
        }

        /*
         * Reset form setelah modal terlihat.
         */
        try {
            clearForm();
        } catch (error) {
            console.error(
                "[models-form] Gagal reset form:",
                error
            );
        }

        try {
            setFormMode(
                "create"
            );
        } catch (error) {
            console.error(
                "[models-form] Gagal mengatur mode create:",
                error
            );
        }

        const search =
            getElement(
                "modelCodeSearch"
            );

        if (search) {
            window.setTimeout(
                () => {
                    try {
                        search.focus();
                    } catch (error) {
                        console.warn(
                            "[models-form] Gagal focus modelCodeSearch:",
                            error
                        );
                    }
                },
                100
            );
        }

        /*
         * Provider dimuat setelah modal terbuka.
         *
         * Provider module menjadi sumber utama.
         */
        try {
            await loadProviders({
                force: false,
                activeOnly: true
            });
        } catch (error) {
            console.error(
                "[models-form] Gagal memuat provider:",
                error
            );

            notify(
                "Provider gagal dimuat dari Supabase.",
                "warning"
            );
        }
    }

    /* =====================================================
       OPEN EDIT
    ===================================================== */

    async function openEditForm(
        model
    ) {
        if (!model) {
            console.warn(
                "[models-form] Model tidak tersedia."
            );

            return;
        }

        /*
         * Provider harus tersedia sebelum
         * populateForm memilih option.
         */
        await loadProviders({
            force: false,
            activeOnly: true
        });

        editingModel = {
            ...model
        };

        setFormMode(
            "edit"
        );

        await populateForm(
            model
        );

        openModal();
    }

    /* =====================================================
       POPULATE
    ===================================================== */

    async function populateForm(
        model
    ) {
        if (!model) {
            return;
        }

        setValue(
            "modelId",
            model.id || ""
        );

        const providerId =
            model.provider_id ||
            model.provider ||
            "";

        await setProvider(
            providerId
        );

        setValue(
            "modelCode",
            model.model_id || ""
        );

        const modelSearch =
            getElement(
                "modelCodeSearch"
            );

        if (modelSearch) {
            modelSearch.value =
                model.model_id || "";
        }

        setValue(
            "modelName",
            model.model_name || ""
        );

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
            "minDuration",
            model.min_duration ?? ""
        );

        setValue(
            "maxDuration",
            model.max_duration ?? ""
        );

        setValue(
            "supportedRatios",
            normalizeArray(
                model.supported_ratios
            )
        );

        setValue(
            "supportedResolutions",
            normalizeArray(
                model.supported_resolutions
            )
        );

        setValue(
            "modelStatus",
            model.status ||
            "active"
        );

        updateSelectedModelInfo(
            model
        );
    }

    /* =====================================================
       CLEAR
    ===================================================== */

    function clearForm() {
        const form =
            getElement(
                "modelForm"
            );

        if (form) {
            form.reset();
        }

        setValue(
            "modelId",
            ""
        );

        setValue(
            "providerId",
            ""
        );

        setValue(
            "modelCode",
            ""
        );

        setValue(
            "modelName",
            ""
        );

        setValue(
            "description",
            ""
        );

        setValue(
            "creditCost",
            ""
        );

        setValue(
            "discountPercent",
            0
        );

        setValue(
            "creditFinal",
            ""
        );

        setValue(
            "minDuration",
            ""
        );

        setValue(
            "maxDuration",
            ""
        );

        setValue(
            "supportedRatios",
            ""
        );

        setValue(
            "supportedResolutions",
            ""
        );

        setValue(
            "modelStatus",
            "active"
        );

        const search =
            getElement(
                "modelCodeSearch"
            );

        if (search) {
            search.value = "";
        }

        const selectedInfo =
            getElement(
                "selectedModelInfo"
            );

        if (selectedInfo) {
            selectedInfo.textContent =
                "Belum ada model dipilih.";
        }

        const searchResults =
            getElement(
                "modelSearchResults"
            );

        if (searchResults) {
            searchResults.innerHTML =
                "";

            searchResults.style.display =
                "none";

            searchResults.classList.remove(
                "show"
            );
        }

        resetPricePreview();

        editingModel = null;
    }

    /* =====================================================
       RESET PRICE PREVIEW
    ===================================================== */

    function resetPricePreview() {
        const ids = [
            "previewNormal",
            "previewDiscount",
            "previewFinal",
            "previewKieUsd",
            "previewKieIdr"
        ];

        for (const id of ids) {
            const element =
                getElement(id);

            if (element) {
                element.textContent =
                    "-";
            }
        }
    }

    /* =====================================================
       MODAL
    ===================================================== */

    function openModal() {
        const modal =
            getElement(
                "modelModal"
            );

        if (!modal) {
            console.error(
                "[models-form] #modelModal tidak ditemukan."
            );

            return;
        }

        modal.classList.add(
            "open"
        );

        modal.classList.add(
            "show"
        );

        modal.classList.remove(
            "hidden"
        );

        modal.removeAttribute(
            "aria-hidden"
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

    function closeModal() {
        const modal =
            getElement(
                "modelModal"
            );

        if (!modal) {
            return;
        }

        modal.classList.remove(
            "open"
        );

        modal.classList.remove(
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

        /*
         * Tutup autocomplete juga.
         */
        const search =
            window.GENZModelsSearch;

        if (
            search &&
            typeof search.hideDropdown ===
                "function"
        ) {
            try {
                search.hideDropdown();
            } catch (error) {
                console.warn(
                    "[models-form] Gagal menutup search dropdown:",
                    error
                );
            }
        }
    }

    /* =====================================================
       FORM DATA
    ===================================================== */

    function getFormData() {
        /*
         * Model ID utama berasal dari hidden input.
         *
         * Jika karena suatu kondisi hidden input kosong,
         * gunakan input pencarian sebagai fallback.
         */
        let modelId =
            value(
                "modelCode"
            ).trim();

        if (!modelId) {
            modelId =
                value(
                    "modelCodeSearch"
                ).trim();
        }

        return {
            provider_id:
                value(
                    "providerId"
                ).trim(),

            model_id:
                modelId,

            model_name:
                value(
                    "modelName"
                ).trim(),

            description:
                value(
                    "description"
                ).trim(),

            credit_cost:
                value(
                    "creditCost"
                ).trim(),

            discount_percent:
                value(
                    "discountPercent"
                ).trim(),

            credit_final:
                value(
                    "creditFinal"
                ).trim(),

            min_duration:
                value(
                    "minDuration"
                ).trim(),

            max_duration:
                value(
                    "maxDuration"
                ).trim(),

            supported_ratios:
                normalizeArray(
                    value(
                        "supportedRatios"
                    )
                ),

            supported_resolutions:
                normalizeArray(
                    value(
                        "supportedResolutions"
                    )
                ),

            status:
                value(
                    "modelStatus"
                ).trim()
        };
    }

    /* =====================================================
       VALIDATE
    ===================================================== */

    function validateForm(
        data
    ) {
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
            !Number.isFinite(
                Number(
                    data.credit_cost
                )
            )
        ) {
            return (
                "Credit Cost harus berupa angka."
            );
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
            return (
                "Discount Percent harus berupa angka."
            );
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
                "Discount Percent harus antara 0 sampai 100."
            );
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
            return (
                "Credit Final harus berupa angka."
            );
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
            return (
                "Minimum Duration harus berupa angka."
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
                "Maximum Duration harus berupa angka."
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
                data.status.toLowerCase()
            )
        ) {
            return (
                "Status model tidak valid."
            );
        }

        return null;
    }

    /* =====================================================
       API AUTH
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

        const result =
            await supabase.auth.getSession();

        const session =
            result?.data?.session ||
            null;

        if (
            !session?.access_token
        ) {
            throw new Error(
                "Session login tidak ditemukan. Silakan login kembali."
            );
        }

        return session.access_token;
    }

    /* =====================================================
       API SAVE
    ===================================================== */

    async function saveToApi(
        data
    ) {
        const token =
            await getAccessToken();

        const payload = {
            ...data
        };

        if (
            editingModel?.id
        ) {
            payload.id =
                editingModel.id;
        }

        const method =
            editingModel?.id
                ? "PATCH"
                : "POST";

        const response =
            await fetch(
                "/api/admin-models",
                {
                    method,

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

        const text =
            await response.text();

        let result = null;

        if (text) {
            try {
                result =
                    JSON.parse(
                        text
                    );
            } catch {
                result = {
                    message: text
                };
            }
        }

        if (
            !response.ok
        ) {
            throw new Error(
                result?.error ||
                result?.message ||
                result?.details ||
                `Gagal menyimpan model (${response.status}).`
            );
        }

        return result;
    }

    /* =====================================================
       SAVE MODEL
    ===================================================== */

    async function saveModel(
        event
    ) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        if (saving) {
            return;
        }

        const data =
            getFormData();

        const validationError =
            validateForm(
                data
            );

        if (validationError) {
            notify(
                validationError,
                "error"
            );

            return;
        }

        saving = true;

        const button =
            firstElement([
                "saveModelBtn",
                "saveModelButton",
                "saveModel"
            ]);

        const originalText =
            button?.textContent ||
            "";

        if (button) {
            button.disabled =
                true;

            button.textContent =
                editingModel?.id
                    ? "Menyimpan..."
                    : "Menambahkan...";
        }

        try {
            const result =
                await saveToApi(
                    data
                );

            const wasEditing =
                Boolean(
                    editingModel?.id
                );

            notify(
                wasEditing
                    ? "Model berhasil diperbarui."
                    : "Model berhasil ditambahkan.",
                "success"
            );

            closeModal();

            const dataModule =
                window.GENZModelsData;

            if (
                dataModule &&
                typeof dataModule.clearCache ===
                    "function"
            ) {
                dataModule.clearCache();
            }

            const ui =
                window.GENZModelsUI;

            if (
                ui &&
                typeof ui.refreshModels ===
                    "function"
            ) {
                await ui.refreshModels();
            }

            document.dispatchEvent(
                new CustomEvent(
                    "genz-model-saved",
                    {
                        detail: {
                            result,
                            model: data,
                            editing:
                                wasEditing
                        }
                    }
                )
            );

            editingModel = null;

            return result;

        } catch (error) {
            console.error(
                "[models-form] Save error:",
                error
            );

            notify(
                error?.message ||
                "Gagal menyimpan model.",
                "error"
            );

            throw error;

        } finally {
            saving = false;

            if (button) {
                button.disabled =
                    false;

                button.textContent =
                    originalText ||
                    (
                        editingModel?.id
                            ? "Simpan Perubahan"
                            : "Tambah Model"
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

        info.innerHTML = `
            <strong>Model dipilih:</strong>
            ${escapeHtml(
                model.model_name ||
                model.model_id ||
                "-"
            )}
            <br>
            <span>
                ${escapeHtml(
                    model.model_id ||
                    "-"
                )}
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
       SELECT MODEL
    ===================================================== */

    function setSelectedModel(
        model
    ) {
        if (!model) {
            return;
        }

        const modelId =
            String(
                model.model_id ||
                ""
            ).trim();

        setValue(
            "modelCode",
            modelId
        );

        const search =
            getElement(
                "modelCodeSearch"
            );

        if (search) {
            search.value =
                modelId;
        }

        setValue(
            "modelName",
            model.model_name ||
            ""
        );

        /*
         * Provider dari catalog.
         */
        const providerId =
            model.provider_id ||
            model.provider ||
            "";

        if (providerId) {
            /*
             * Coba pilih option yang sudah tersedia.
             */
            const selected =
                ensureProviderOption(
                    providerId
                );

            /*
             * Jika belum tersedia,
             * ambil melalui Provider module.
             */
            if (!selected) {
                setProvider(
                    providerId
                ).catch(
                    error => {
                        console.error(
                            "[models-form] Gagal menyinkronkan provider:",
                            error
                        );
                    }
                );
            }
        }

        updateSelectedModelInfo(
            model
        );
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
   LEGACY EVENT BINDING COMPATIBILITY
===================================================== */

/*
 * Event sekarang dimiliki oleh:
 *
 * admin-control/models/functions/model-form-events.js
 *
 * models-form.js tetap menyediakan fungsi lama
 * supaya module lain yang masih memanggil fungsi ini
 * tidak rusak.
 */

/* =====================================================
   FORM SUBMIT
===================================================== */

function bindFormSubmit() {

    const events =
        window.GENZModelFormEvents;

    if (
        events &&
        typeof events.bind ===
            "function"
    ) {
        return events.bind();
    }

    console.warn(
        "[models-form] GENZModelFormEvents belum tersedia."
    );

    return false;
}


/* =====================================================
   CLOSE BUTTON
===================================================== */

function bindCloseButtons() {

    const events =
        window.GENZModelFormEvents;

    if (
        events &&
        typeof events.bind ===
            "function"
    ) {
        return events.bind();
    }

    return false;
}


/* =====================================================
   MODAL BACKDROP
===================================================== */

function bindModalBackdrop() {

    const events =
        window.GENZModelFormEvents;

    if (
        events &&
        typeof events.bind ===
            "function"
    ) {
        return events.bind();
    }

    return false;
}


/* =====================================================
   ESCAPE
===================================================== */

function bindEscape() {

    const events =
        window.GENZModelFormEvents;

    if (
        events &&
        typeof events.bind ===
            "function"
    ) {
        return events.bind();
    }

    return false;
}


/* =====================================================
   INITIALIZE
===================================================== */

function initialize() {

    if (initialized) {
        return true;
    }

    initialized = true;

    /*
     * PENTING:
     *
     * Jangan lagi memasang event listener langsung
     * dari models-form.js.
     *
     * Seluruh event Form sekarang dimiliki:
     *
     * GENZModelFormEvents
     *
     * Lifecycle owner:
     * models-init.js
     */

    console.log(
        "[GEN-Z.AI] GENZModelsForm initialized."
    );

    return true;
}

    /* =====================================================
       PUBLIC API
    ===================================================== */

    window.GENZModelsForm = {
        initialize,

        openCreateForm,
        openEditForm,

        closeModal,
        openModal,

        clearForm,

        populateForm,

        getFormData,
        validateForm,

        saveModel,
        saveToApi,

        setSelectedModel,
        setProvider,
        loadProviders,

        getEditingModel,
        isEditing,
        isSaving,

        updateSelectedModelInfo
    };

})();
