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
   - Provider dropdown dimiliki GENZModelProviderDropdown
   - Form hanya memilih / membaca Provider
   - Search dimiliki GENZModelsSearch
   - Data dimiliki GENZModelsData
   - Form tidak membuat Provider palsu
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

        return element.value ?? "";
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
                .map(function (item) {
                    return String(item ?? "").trim();
                })
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
            .map(function (item) {
                return item.trim();
            })
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

            requestAnimationFrame(function () {
                existing.classList.add("show");
            });

            window.clearTimeout(existing.__genzTimer);

            existing.__genzTimer = window.setTimeout(function () {
                existing.classList.remove("show");
            }, 3500);

            return;
        }

        const toast = document.createElement("div");

        toast.id = "modelNotification";
        toast.className =
            "genz-model-notification " + type;

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
                boxShadow: "0 14px 40px rgba(0,0,0,.35)",
                fontSize: "14px",
                lineHeight: "1.45",
                pointerEvents: "none"
            }
        );

        document.body.appendChild(toast);

        window.setTimeout(function () {
            toast.style.opacity = "0";
            toast.style.transform = "translateY(8px)";
            toast.style.transition =
                "opacity .2s ease, transform .2s ease";

            window.setTimeout(function () {
                if (toast && toast.parentNode) {
                    toast.remove();
                }
            }, 250);
        }, 3500);
    }

    /* =====================================================
       MODULE ACCESS
    ===================================================== */

    function getModelsData() {
        return window.GENZModelsData || null;
    }

    function getModelsProvider() {
        return window.GENZModelsProvider || null;
    }

    function getProviderDropdown() {
        return window.GENZModelProviderDropdown || null;
    }

    function getModelsSearch() {
        return window.GENZModelsSearch || null;
    }

    /* =====================================================
       PROVIDER LOAD
       Provider lifecycle tetap di GENZModelsProvider.
    ===================================================== */

    async function loadProviders(options = {}) {
        const providerModule = getModelsProvider();

        if (
            providerModule &&
            typeof providerModule.loadProviders === "function"
        ) {
            try {
                const providers =
                    await providerModule.loadProviders({
                        force: options.force === true,
                        activeOnly: options.activeOnly !== false
                    });

                const list =
                    Array.isArray(providers)
                        ? providers
                        : [];

                /*
                 * Sinkronkan hasil Provider ke dropdown.
                 * Form tidak membuat option sendiri.
                 */
                const dropdown = getProviderDropdown();

                if (
                    dropdown &&
                    typeof dropdown.setProviders === "function"
                ) {
                    dropdown.setProviders(list);
                }

                return list;
            } catch (error) {
                console.error(
                    "[models-form] Provider module load error:",
                    error
                );

                return [];
            }
        }

        /*
         * Fallback hanya untuk kompatibilitas.
         * Lifecycle utama tetap GENZModelsProvider.
         */
        const data = getModelsData();

        if (
            data &&
            typeof data.loadProviders === "function"
        ) {
            try {
                const providers =
                    await data.loadProviders({
                        force: options.force === true,
                        activeOnly: options.activeOnly !== false
                    });

                const list =
                    Array.isArray(providers)
                        ? providers
                        : [];

                const dropdown = getProviderDropdown();

                if (
                    dropdown &&
                    typeof dropdown.setProviders === "function"
                ) {
                    dropdown.setProviders(list);
                }

                return list;
            } catch (error) {
                console.error(
                    "[models-form] Legacy provider load error:",
                    error
                );
            }
        }

        return [];
    }

    /* =====================================================
       FIND PROVIDER
    ===================================================== */

    function findProvider(providerId) {
        const normalized =
            String(providerId ?? "")
                .trim()
                .toLowerCase();

        if (!normalized) {
            return null;
        }

        /*
         * PRIORITAS 1:
         * Provider module.
         */
        const providerModule = getModelsProvider();

        if (
            providerModule &&
            typeof providerModule.getProviderById === "function"
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
         * Provider dropdown.
         */
        const dropdown = getProviderDropdown();

        if (
            dropdown &&
            typeof dropdown.getProviders === "function"
        ) {
            try {
                const providers =
                    dropdown.getProviders();

                const found =
                    Array.isArray(providers)
                        ? providers.find(function (provider) {
                            return (
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
                        })
                        : null;

                if (found) {
                    return found;
                }
            } catch (error) {
                console.warn(
                    "[models-form] Provider dropdown lookup error:",
                    error
                );
            }
        }

        /*
         * PRIORITAS 3:
         * UI state.
         */
        const ui = window.GENZModelsUI;

        if (
            ui &&
            typeof ui.getProviders === "function"
        ) {
            try {
                const providers =
                    ui.getProviders();

                if (Array.isArray(providers)) {
                    const found =
                        providers.find(function (provider) {
                            return (
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
                        });

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
         * PRIORITAS 4:
         * Data module.
         */
        const data = getModelsData();

        if (
            data &&
            typeof data.findProviderById === "function"
        ) {
            try {
                return (
                    data.findProviderById(normalized) ||
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

    /* =====================================================
       PROVIDER SELECT
       PENTING:
       Jangan membuat <option> Provider secara manual.
       Gunakan GENZModelProviderDropdown.
    ===================================================== */

    function ensureProviderOption(
        providerId,
        provider = null
    ) {
        const normalized =
            String(providerId ?? "").trim();

        if (!normalized) {
            return false;
        }

        const dropdown = getProviderDropdown();

        /*
         * Provider dropdown adalah owner option.
         */
        if (
            dropdown &&
            typeof dropdown.setValue === "function"
        ) {
            const selected =
                dropdown.setValue(normalized);

            if (selected) {
                return true;
            }
        }

        /*
         * Fallback kompatibilitas:
         * hanya memilih option yang SUDAH ada.
         *
         * Tidak membuat Provider baru.
         */
        const select =
            getElement("providerId");

        if (
            !select ||
            select.tagName !== "SELECT"
        ) {
            return false;
        }

        const existing =
            Array.from(select.options).find(function (option) {
                return (
                    String(option.value ?? "")
                        .trim()
                        .toLowerCase() ===
                    normalized.toLowerCase()
                );
            });

        if (!existing) {
            return false;
        }

        select.value = existing.value;

        return true;
    }

    /* =====================================================
       SET PROVIDER
    ===================================================== */

    async function setProvider(
        providerId,
        options = {}
    ) {
        const normalized =
            String(providerId ?? "").trim();

        const dropdown = getProviderDropdown();

        /*
         * Provider kosong.
         */
        if (!normalized) {
            if (
                dropdown &&
                typeof dropdown.clear === "function"
            ) {
                dropdown.clear();
            } else {
                setValue("providerId", "");
            }

            return null;
        }

        /*
         * Cari Provider yang sudah tersedia.
         */
        let provider =
            findProvider(normalized);

        /*
         * Jika belum ada, load Provider.
         */
        if (!provider) {
            const providers =
                await loadProviders({
                    force: options.force === true,
                    activeOnly:
                        options.activeOnly !== false
                });

            if (Array.isArray(providers)) {
                provider =
                    providers.find(function (item) {
                        return (
                            String(
                                item.provider_id ||
                                item.provider ||
                                item.id ||
                                ""
                            )
                                .trim()
                                .toLowerCase() ===
                            normalized.toLowerCase()
                        );
                    }) || null;
            }
        }

        /*
         * Provider harus benar-benar ada.
         */
        if (!provider) {
            console.warn(
                "[models-form] Provider tidak ditemukan:",
                normalized
            );

            if (
                dropdown &&
                typeof dropdown.clear === "function"
            ) {
                dropdown.clear();
            } else {
                setValue("providerId", "");
            }

            return null;
        }

        const providerValue =
            String(
                provider.provider_id ||
                provider.provider ||
                provider.id ||
                ""
            ).trim();

        if (!providerValue) {
            return null;
        }

        /*
         * PILIH PROVIDER MELALUI MODULE DROPDOWN.
         */
        let selected = false;

        if (
            dropdown &&
            typeof dropdown.setValue === "function"
        ) {
            selected =
                dropdown.setValue(providerValue);
        }

        /*
         * Fallback hanya jika dropdown module
         * belum tersedia.
         */
        if (!selected) {
            selected =
                ensureProviderOption(
                    providerValue,
                    provider
                );
        }

        if (!selected) {
            console.warn(
                "[models-form] Provider option tidak tersedia:",
                providerValue
            );

            return null;
        }

        /*
         * Pastikan value select benar.
         */
        const select =
            getElement("providerId");

        if (select) {
            select.value = providerValue;

            /*
             * Jangan gunakan event custom jika
             * dropdown module sudah mengirimkannya.
             *
             * Native change tetap dikirim agar module
             * lain yang mendengarkan #providerId tetap sinkron.
             */
            select.dispatchEvent(
                new Event("change", {
                    bubbles: true
                })
            );
        }

        return provider;
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
                title.textContent = "Edit Model";
            }

            if (submitButton) {
                submitButton.textContent =
                    "Simpan Perubahan";
            }

            return;
        }

        if (title) {
            title.textContent = "Tambah Model";
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

        try {
            openModal();
        } catch (error) {
            console.error(
                "[models-form] Gagal membuka modal:",
                error
            );
        }

        try {
            clearForm();
        } catch (error) {
            console.error(
                "[models-form] Gagal reset form:",
                error
            );
        }

        setFormMode("create");

        const search =
            getElement("modelCodeSearch");

        if (search) {
            window.setTimeout(function () {
                try {
                    search.focus();
                } catch (error) {
                    console.warn(
                        "[models-form] Gagal focus modelCodeSearch:",
                        error
                    );
                }
            }, 100);
        }

        /*
         * Pastikan Provider tersedia.
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

    async function openEditForm(model) {
        if (!model) {
            console.warn(
                "[models-form] Model tidak tersedia."
            );

            return;
        }

        /*
         * Provider harus tersedia sebelum
         * populateForm memilih Provider.
         */
        await loadProviders({
            force: false,
            activeOnly: true
        });

        editingModel = {
            ...model
        };

        setFormMode("edit");

        await populateForm(model);

        openModal();
    }

    /* =====================================================
       POPULATE FORM
    ===================================================== */

    async function populateForm(model) {
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

        await setProvider(providerId);

        setValue(
            "modelCode",
            model.model_id || ""
        );

        const modelSearch =
            getElement("modelCodeSearch");

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
            model.status || "active"
        );

        updateSelectedModelInfo(model);
    }

    /* =====================================================
       CLEAR FORM
    ===================================================== */

    function clearForm() {
        const form =
            getElement("modelForm");

        if (form) {
            form.reset();
        }

        setValue("modelId", "");

        /*
         * Provider harus dibersihkan melalui
         * Provider Dropdown module.
         */
        const dropdown =
            getProviderDropdown();

        if (
            dropdown &&
            typeof dropdown.clear === "function"
        ) {
            dropdown.clear();
        } else {
            setValue("providerId", "");
        }

        setValue("modelCode", "");
        setValue("modelName", "");
        setValue("description", "");
        setValue("creditCost", "");
        setValue("discountPercent", 0);
        setValue("creditFinal", "");
        setValue("minDuration", "");
        setValue("maxDuration", "");
        setValue("supportedRatios", "");
        setValue("supportedResolutions", "");
        setValue("modelStatus", "active");

        const search =
            getElement("modelCodeSearch");

        if (search) {
            search.value = "";
        }

        const selectedInfo =
            getElement("selectedModelInfo");

        if (selectedInfo) {
            selectedInfo.textContent =
                "Belum ada model dipilih.";
        }

        const searchResults =
            getElement("modelSearchResults");

        if (searchResults) {
            searchResults.innerHTML = "";
            searchResults.style.display = "none";
            searchResults.classList.remove("show");
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
                element.textContent = "-";
            }
        }
    }

    /* =====================================================
       MODAL
    ===================================================== */

    function openModal() {
        const modal =
            getElement("modelModal");

        if (!modal) {
            console.error(
                "[models-form] #modelModal tidak ditemukan."
            );

            return;
        }

        modal.classList.add("open");
        modal.classList.add("show");
        modal.classList.remove("hidden");

        modal.removeAttribute("aria-hidden");

        if (
            window.getComputedStyle(modal).display ===
            "none"
        ) {
            modal.style.display = "flex";
        }

        document.body.classList.add("modal-open");
    }

    function closeModal() {
        const modal =
            getElement("modelModal");

        if (!modal) {
            return;
        }

        modal.classList.remove("open");
        modal.classList.remove("show");
        modal.classList.add("hidden");

        modal.setAttribute(
            "aria-hidden",
            "true"
        );

        modal.style.display = "none";

        document.body.classList.remove(
            "modal-open"
        );

        /*
         * Tutup autocomplete melalui Search module.
         */
        const search =
            getModelsSearch();

        if (
            search &&
            typeof search.hideDropdown === "function"
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

        /*
         * Fallback langsung ke dropdown module.
         */
        const dropdownModule =
            window.GENZModelSearchDropdown;

        if (
            dropdownModule &&
            typeof dropdownModule.hide === "function"
        ) {
            try {
                dropdownModule.hide();
            } catch (error) {
                console.warn(
                    "[models-form] Gagal hide search dropdown:",
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
         * Search input digunakan sebagai fallback.
         */
        let modelId =
            value("modelCode").trim();

        if (!modelId) {
            modelId =
                value("modelCodeSearch").trim();
        }

        /*
         * Provider diambil dari select yang
         * dikelola Provider Dropdown module.
         */
        const providerId =
            value("providerId").trim();

        return {
            provider_id: providerId,

            model_id: modelId,

            model_name:
                value("modelName").trim(),

            description:
                value("description").trim(),

            credit_cost:
                value("creditCost").trim(),

            discount_percent:
                value("discountPercent").trim(),

            credit_final:
                value("creditFinal").trim(),

            min_duration:
                value("minDuration").trim(),

            max_duration:
                value("maxDuration").trim(),

            supported_ratios:
                normalizeArray(
                    value("supportedRatios")
                ),

            supported_resolutions:
                normalizeArray(
                    value("supportedResolutions")
                ),

            status:
                value("modelStatus").trim()
        };
    }

    /* =====================================================
       VALIDATE
    ===================================================== */

    function validateForm(data) {
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
            data.credit_cost !== "" &&
            !Number.isFinite(
                Number(data.credit_cost)
            )
        ) {
            return "Credit Cost harus berupa angka.";
        }

        if (
            data.discount_percent !== "" &&
            !Number.isFinite(
                Number(data.discount_percent)
            )
        ) {
            return "Discount Percent harus berupa angka.";
        }

        if (
            data.discount_percent !== "" &&
            (
                Number(data.discount_percent) < 0 ||
                Number(data.discount_percent) > 100
            )
        ) {
            return (
                "Discount Percent harus antara 0 sampai 100."
            );
        }

        if (
            data.credit_final !== "" &&
            !Number.isFinite(
                Number(data.credit_final)
            )
        ) {
            return "Credit Final harus berupa angka.";
        }

        if (
            data.min_duration !== "" &&
            !Number.isFinite(
                Number(data.min_duration)
            )
        ) {
            return "Minimum Duration harus berupa angka.";
        }

        if (
            data.max_duration !== "" &&
            !Number.isFinite(
                Number(data.max_duration)
            )
        ) {
            return "Maximum Duration harus berupa angka.";
        }

        if (
            data.min_duration !== "" &&
            data.max_duration !== "" &&
            Number(data.min_duration) >
            Number(data.max_duration)
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
            return "Status model tidak valid.";
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

        if (
            !supabase.auth ||
            typeof supabase.auth.getSession !== "function"
        ) {
            throw new Error(
                "Supabase Auth belum tersedia."
            );
        }

        const result =
            await supabase.auth.getSession();

        const session =
            result?.data?.session || null;

        if (!session?.access_token) {
            throw new Error(
                "Session login tidak ditemukan. Silakan login kembali."
            );
        }

        return session.access_token;
    }

    /* =====================================================
       API SAVE
    ===================================================== */

    async function saveToApi(data) {
        const token =
            await getAccessToken();

        const payload = {
            ...data
        };

        if (editingModel?.id) {
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
                            "Bearer " + token
                    },

                    body:
                        JSON.stringify(payload)
                }
            );

        const text =
            await response.text();

        let result = null;

        if (text) {
            try {
                result =
                    JSON.parse(text);
            } catch (error) {
                result = {
                    message: text
                };
            }
        }

        if (!response.ok) {
            throw new Error(
                result?.error ||
                result?.message ||
                result?.details ||
                "Gagal menyimpan model (" +
                response.status +
                ")."
            );
        }

        return result;
    }

    /* =====================================================
       SAVE MODEL
    ===================================================== */

    async function saveModel(event) {
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
            validateForm(data);

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
            button?.textContent || "";

        const wasEditing =
            Boolean(editingModel?.id);

        if (button) {
            button.disabled = true;

            button.textContent =
                wasEditing
                    ? "Menyimpan..."
                    : "Menambahkan...";
        }

        try {
            const result =
                await saveToApi(data);

            notify(
                wasEditing
                    ? "Model berhasil diperbarui."
                    : "Model berhasil ditambahkan.",
                "success"
            );

            closeModal();

            /*
             * Clear cache setelah save.
             */
            const dataModule =
                getModelsData();

            if (
                dataModule &&
                typeof dataModule.clearCache === "function"
            ) {
                dataModule.clearCache();
            }

            /*
             * Refresh table.
             */
            const ui =
                window.GENZModelsUI;

            if (
                ui &&
                typeof ui.refreshModels === "function"
            ) {
                await ui.refreshModels();
            }

            /*
             * Beritahu module lain.
             */
            document.dispatchEvent(
                new CustomEvent(
                    "genz-model-saved",
                    {
                        detail: {
                            result,
                            model: data,
                            editing: wasEditing
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
                button.disabled = false;

                button.textContent =
                    wasEditing
                        ? "Simpan Perubahan"
                        : "Tambah Model";
            }
        }
    }

    /* =====================================================
       SELECTED MODEL INFO
    ===================================================== */

    function updateSelectedModelInfo(model) {
        const info =
            getElement("selectedModelInfo");

        if (!info) {
            return;
        }

        if (!model) {
            info.textContent =
                "Belum ada model dipilih.";

            return;
        }

        info.innerHTML =
            "<strong>Model dipilih:</strong> " +
            escapeHtml(
                model.model_name ||
                model.model_id ||
                "-"
            ) +
            "<br>" +
            "<span>" +
            escapeHtml(
                model.model_id || "-"
            ) +
            "</span>";
    }

    /* =====================================================
       ESCAPE HTML
    ===================================================== */

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    /* =====================================================
       SELECT MODEL
    ===================================================== */

    function setSelectedModel(model) {
        if (!model) {
            return;
        }

        const modelId =
            String(
                model.model_id || ""
            ).trim();

        setValue(
            "modelCode",
            modelId
        );

        const search =
            getElement("modelCodeSearch");

        if (search) {
            search.value = modelId;
        }

        setValue(
            "modelName",
            model.model_name || ""
        );

        /*
         * Provider dari catalog model.
         */
        const providerId =
            String(
                model.provider_id ||
                model.provider ||
                ""
            ).trim();

        if (providerId) {
            const dropdown =
                getProviderDropdown();

            let selected = false;

            /*
             * PRIORITAS:
             * Provider Dropdown module.
             */
            if (
                dropdown &&
                typeof dropdown.setValue === "function"
            ) {
                selected =
                    dropdown.setValue(providerId);
            }

            /*
             * Jika Provider belum termuat,
             * load melalui Provider module.
             */
            if (!selected) {
                setProvider(
                    providerId,
                    {
                        force: false,
                        activeOnly: true
                    }
                ).catch(function (error) {
                    console.error(
                        "[models-form] Gagal menyinkronkan provider:",
                        error
                    );
                });
            }
        }

        updateSelectedModelInfo(model);

        /*
         * Beritahu module lain bahwa Model dipilih.
         */
        document.dispatchEvent(
            new CustomEvent(
                "genz-model-selected",
                {
                    detail: {
                        model: model
                    }
                }
            )
        );
    }

    /* =====================================================
       STATE
    ===================================================== */

    function getEditingModel() {
        return editingModel;
    }

    function isEditing() {
        return Boolean(editingModel);
    }

    function isSaving() {
        return saving;
    }

    /* =====================================================
       LEGACY EVENT BINDING COMPATIBILITY
    ===================================================== */

    function bindFormSubmit() {
        const events =
            window.GENZModelFormEvents;

        if (
            events &&
            typeof events.bind === "function"
        ) {
            return events.bind();
        }

        console.warn(
            "[models-form] GENZModelFormEvents belum tersedia."
        );

        return false;
    }

    function bindCloseButtons() {
        const events =
            window.GENZModelFormEvents;

        if (
            events &&
            typeof events.bind === "function"
        ) {
            return events.bind();
        }

        return false;
    }

    function bindModalBackdrop() {
        const events =
            window.GENZModelFormEvents;

        if (
            events &&
            typeof events.bind === "function"
        ) {
            return events.bind();
        }

        return false;
    }

    function bindEscape() {
        const events =
            window.GENZModelFormEvents;

        if (
            events &&
            typeof events.bind === "function"
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
         * Event Form dimiliki:
         * GENZModelFormEvents
         *
         * Lifecycle:
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

    window.GENZModelsForm = Object.freeze({
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

        updateSelectedModelInfo,

        /*
         * Compatibility API.
         */
        bindFormSubmit,
        bindCloseButtons,
        bindModalBackdrop,
        bindEscape,

        /*
         * Provider helper.
         */
        findProvider,
        ensureProviderOption
    });

    console.log(
        "[GEN-Z.AI] GENZModelsForm module loaded."
    );

})();
