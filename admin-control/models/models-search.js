/* =========================================================
   GEN-Z.AI
   ADMIN MODEL MANAGEMENT
   MODEL SEARCH MODULE

   File:
   admin-control/models/models-search.js

   Fungsi:
   - Autocomplete Model ID
   - Search Model Name
   - Search Model Family
   - Search Provider
   - Provider-aware search
   - Manual Model ID fallback
   - Select model
   - Auto-fill Model ID
   - Auto-sync Provider
   - Menampilkan model yang dipilih
   - Tidak melakukan query Supabase sendiri
   - Data diterima dari models-ui.js
   - Retry initialization untuk dynamic loader
   - Tetap bisa input Model ID manual
========================================================= */

(function () {
    "use strict";

    let models = [];
    let initialized = false;

    let input = null;
    let hiddenInput = null;
    let dropdown = null;
    let selectedInfo = null;
    let providerSelect = null;

    let selectedIndex = -1;

    let initializeTimer = null;
    let initializeAttempts = 0;

    const MAX_INITIALIZE_ATTEMPTS = 40;
    const INITIALIZE_RETRY_DELAY = 250;

    /* =====================================================
       DOM
    ===================================================== */

    function getElements() {
        input = document.getElementById(
            "modelCodeSearch"
        );

        hiddenInput = document.getElementById(
            "modelCode"
        );

        dropdown = document.getElementById(
            "modelSearchResults"
        );

        if (!dropdown) {
            dropdown = document.getElementById(
                "modelSearchDropdown"
            );
        }

        if (!dropdown) {
            dropdown = document.querySelector(
                ".model-search-results"
            );
        }

        selectedInfo = document.getElementById(
            "selectedModelInfo"
        );

        providerSelect = document.getElementById(
            "providerId"
        );

        return {
            input,
            hiddenInput,
            dropdown,
            selectedInfo,
            providerSelect
        };
    }

    /* =====================================================
       NORMALIZE MODEL
    ===================================================== */

    function normalizeModel(model) {
        if (!model || typeof model !== "object") {
            return null;
        }

        const provider = String(
            model.provider ??
            model.provider_id ??
            model.provider_name ??
            ""
        ).trim();

        const providerId = String(
            model.provider_id ??
            model.provider ??
            ""
        ).trim();

        return {
            ...model,

            provider,
            provider_id: providerId
        };
    }

    function normalizeModels(list) {
        if (!Array.isArray(list)) {
            return [];
        }

        return list
            .map(normalizeModel)
            .filter(Boolean);
    }

    /* =====================================================
       SET MODELS
    ===================================================== */

    function setModels(list) {
        models = normalizeModels(list);

        console.log(
            "[GEN-Z Models Search] Models received:",
            models.length
        );

        /*
         * Pastikan DOM sudah tersedia.
         */
        getElements();

        /*
         * Jika user sedang mengetik,
         * refresh hasil pencarian.
         */
        if (
            input &&
            document.activeElement === input
        ) {
            renderResults(
                search(input.value)
            );
        }

        return [...models];
    }

    /* =====================================================
       GET MODELS
    ===================================================== */

    function getModels() {
        return [...models];
    }

    /* =====================================================
       MODEL STATUS
    ===================================================== */

    function isActive(model) {
        const status = String(
            model?.status ?? ""
        )
            .trim()
            .toLowerCase();

        /*
         * Status kosong tetap boleh tampil.
         *
         * Berguna untuk katalog lama,
         * custom provider, atau data legacy.
         */
        if (!status) {
            return true;
        }

        return (
            status === "active" ||
            status === "enabled" ||
            status === "published" ||
            status === "available"
        );
    }

    /* =====================================================
       GET SELECTED PROVIDER
    ===================================================== */

    function getSelectedProviderData() {
        if (!providerSelect) {
            providerSelect =
                document.getElementById(
                    "providerId"
                );
        }

        if (!providerSelect) {
            return {
                id: "",
                text: "",
                value: ""
            };
        }

        const option =
            providerSelect.options[
                providerSelect.selectedIndex
            ];

        const value = String(
            providerSelect.value || ""
        ).trim();

        const text = String(
            option?.textContent || ""
        ).trim();

        return {
            id: value.toLowerCase(),
            value,
            text: text.toLowerCase()
        };
    }

    /* =====================================================
       PROVIDER MATCH
    ===================================================== */

    function providerMatches(model) {
        const selected =
            getSelectedProviderData();

        if (
            !selected.id &&
            !selected.text
        ) {
            return true;
        }

        const values = [
            model?.provider_id,
            model?.provider,
            model?.provider_name
        ]
            .map(value =>
                String(
                    value ?? ""
                )
                    .trim()
                    .toLowerCase()
            )
            .filter(Boolean);

        const selectedValues = [
            selected.id,
            selected.text
        ].filter(Boolean);

        for (
            const modelValue
            of values
        ) {
            for (
                const selectedValue
                of selectedValues
            ) {
                if (
                    modelValue ===
                    selectedValue
                ) {
                    return true;
                }

                if (
                    selectedValue.includes(
                        modelValue
                    ) ||
                    modelValue.includes(
                        selectedValue
                    )
                ) {
                    return true;
                }
            }
        }

        return false;
    }

    /* =====================================================
       PROVIDER SCORE
    ===================================================== */

    function getProviderScore(model) {
        const selected =
            getSelectedProviderData();

        if (
            !selected.id &&
            !selected.text
        ) {
            return 0;
        }

        const values = [
            model?.provider_id,
            model?.provider,
            model?.provider_name
        ]
            .map(value =>
                String(
                    value ?? ""
                )
                    .trim()
                    .toLowerCase()
            )
            .filter(Boolean);

        let score = 0;

        for (
            const modelValue
            of values
        ) {
            if (
                selected.id &&
                modelValue ===
                    selected.id
            ) {
                score = Math.max(
                    score,
                    100
                );
            }

            if (
                selected.text &&
                modelValue ===
                    selected.text
            ) {
                score = Math.max(
                    score,
                    90
                );
            }

            if (
                selected.text &&
                selected.text.includes(
                    modelValue
                )
            ) {
                score = Math.max(
                    score,
                    70
                );
            }

            if (
                selected.id &&
                modelValue.includes(
                    selected.id
                )
            ) {
                score = Math.max(
                    score,
                    60
                );
            }
        }

        return score;
    }

    /* =====================================================
       SEARCH
    ===================================================== */

    function search(keyword = "") {
        const term = String(
            keyword ?? ""
        )
            .trim()
            .toLowerCase();

        /*
         * ================================================
         * SEARCH KATALOG
         * ================================================
         */

        let results = models.filter(
            model => {
                if (!isActive(model)) {
                    return false;
                }

                /*
                 * Keyword kosong:
                 * tampilkan seluruh katalog.
                 */
                if (!term) {
                    return true;
                }

                const modelId =
                    String(
                        model.model_id ??
                        ""
                    )
                        .trim()
                        .toLowerCase();

                const modelName =
                    String(
                        model.model_name ??
                        ""
                    )
                        .trim()
                        .toLowerCase();

                const family =
                    String(
                        model.model_family ??
                        ""
                    )
                        .trim()
                        .toLowerCase();

                const provider =
                    String(
                        model.provider ??
                        model.provider_id ??
                        model.provider_name ??
                        ""
                    )
                        .trim()
                        .toLowerCase();

                return (
                    modelId.includes(
                        term
                    ) ||
                    modelName.includes(
                        term
                    ) ||
                    family.includes(
                        term
                    ) ||
                    provider.includes(
                        term
                    )
                );
            }
        );

        /*
         * ================================================
         * PRIORITAS PROVIDER
         * ================================================
         */

        results.sort(
            (a, b) =>
                getProviderScore(b) -
                getProviderScore(a)
        );

        /*
         * ================================================
         * MANUAL MODEL ID
         * ================================================
         *
         * INI BAGIAN PENTING.
         *
         * Provider sudah tersedia di database,
         * tetapi model belum tentu ada di kie_models.
         *
         * Jadi user tetap boleh mengetik:
         *
         * kling-3.0
         * veo-3
         * seedance-1.0
         * model-custom-123
         *
         * dan memilihnya sebagai Model ID manual.
         */

        if (term) {
            const exactExists =
                results.some(
                    model =>
                        String(
                            model.model_id ??
                            ""
                        )
                            .trim()
                            .toLowerCase() ===
                        term
                );

            if (!exactExists) {
                const selectedProvider =
                    getSelectedProviderData();

                results.push({
                    __manual: true,

                    id: null,

                    provider:
                        selectedProvider.value,

                    provider_id:
                        selectedProvider.value,

                    model_id:
                        String(
                            keyword
                        ).trim(),

                    model_name: "",

                    model_family: "",

                    status: "active"
                });

                console.log(
                    "[GEN-Z Models Search] Manual model option created:",
                    String(
                        keyword
                    ).trim()
                );
            }
        }

        return results;
    }

    /* =====================================================
       FORCE DROPDOWN VISIBLE
    ===================================================== */

    function showDropdown() {
        if (!dropdown) {
            getElements();
        }

        if (!dropdown) {
            return;
        }

        /*
         * !important dipasang melalui JS agar
         * tidak kalah oleh CSS halaman/admin layout.
         */
        dropdown.style.setProperty(
            "display",
            "block",
            "important"
        );

        dropdown.style.setProperty(
            "position",
            "absolute",
            "important"
        );

        dropdown.style.setProperty(
            "z-index",
            "99999",
            "important"
        );

        dropdown.style.setProperty(
            "pointer-events",
            "auto",
            "important"
        );

        dropdown.style.setProperty(
            "visibility",
            "visible",
            "important"
        );

        dropdown.style.setProperty(
            "opacity",
            "1",
            "important"
        );
    }

    /* =====================================================
       RENDER RESULTS
    ===================================================== */

    function renderResults(results) {
        getElements();

        if (!dropdown) {
            console.warn(
                "[GEN-Z Models Search] Dropdown belum ditemukan."
            );

            return;
        }

        dropdown.innerHTML = "";

        /*
         * ==================================================
         * FALLBACK PALING PENTING
         * ==================================================
         *
         * Jika results kosong tetapi user mengetik
         * sesuatu, buat manual Model ID langsung.
         *
         * Ini membuat search tetap bekerja bahkan
         * ketika katalog kie_models benar-benar kosong.
         */

        if (
            (!Array.isArray(results) ||
                results.length === 0) &&
            input &&
            String(
                input.value || ""
            ).trim()
        ) {
            const keyword =
                String(
                    input.value
                ).trim();

            const provider =
                getSelectedProviderData();

            results = [
                {
                    __manual: true,

                    id: null,

                    provider:
                        provider.value,

                    provider_id:
                        provider.value,

                    model_id:
                        keyword,

                    model_name: "",

                    model_family: "",

                    status: "active"
                }
            ];
        }

        /*
         * Jika tetap kosong.
         */
        if (
            !Array.isArray(results) ||
            results.length === 0
        ) {
            hideDropdown();

            return;
        }

        results.forEach(
            (
                model,
                index
            ) => {
                const item =
                    document.createElement(
                        "div"
                    );

                item.className =
                    "model-search-item";

                item.dataset.index =
                    String(index);

                /*
                 * Tambahkan class manual.
                 */
                if (
                    model.__manual
                ) {
                    item.classList.add(
                        "model-search-manual"
                    );
                }

                /*
                 * Inline style dasar.
                 *
                 * Tidak bergantung pada CSS eksternal.
                 */
                item.style.cursor =
                    "pointer";

                item.style.pointerEvents =
                    "auto";

                const modelId =
                    String(
                        model.model_id ??
                        ""
                    ).trim();

                const modelName =
                    String(
                        model.model_name ??
                        ""
                    ).trim();

                const family =
                    String(
                        model.model_family ??
                        ""
                    ).trim();

                const provider =
                    String(
                        model.provider ??
                        model.provider_id ??
                        model.provider_name ??
                        ""
                    ).trim();

                if (
                    model.__manual
                ) {
                    item.innerHTML = `
                        <div class="model-search-main">
                            <strong>
                                ${escapeHtml(
                                    modelId
                                )}
                            </strong>
                        </div>

                        <div class="model-search-name">
                            Gunakan Model ID ini
                        </div>

                        <div class="model-search-meta">
                            <span>
                                Model manual
                            </span>
                            ${
                                provider
                                    ? `
                                <span>
                                    Provider:
                                    ${escapeHtml(
                                        provider
                                    )}
                                </span>
                                `
                                    : ""
                            }
                        </div>
                    `;
                } else {
                    item.innerHTML = `
                        <div class="model-search-main">
                            <strong>
                                ${escapeHtml(
                                    modelId
                                )}
                            </strong>
                        </div>

                        ${
                            modelName
                                ? `
                            <div class="model-search-name">
                                ${escapeHtml(
                                    modelName
                                )}
                            </div>
                            `
                                : ""
                        }

                        <div class="model-search-meta">

                            ${
                                provider
                                    ? `
                                <span>
                                    Provider:
                                    ${escapeHtml(
                                        provider
                                    )}
                                </span>
                                `
                                    : ""
                            }

                            ${
                                family
                                    ? `
                                <span>
                                    ${escapeHtml(
                                        family
                                    )}
                                </span>
                                `
                                    : ""
                            }

                        </div>
                    `;
                }

                /*
                 * MOUSEDOWN
                 *
                 * Dipakai agar browser tidak menjalankan
                 * blur sebelum pilihan diproses.
                 */
                item.addEventListener(
                    "mousedown",
                    event => {
                        event.preventDefault();
                        event.stopPropagation();

                        selectModel(
                            model
                        );
                    }
                );

                /*
                 * CLICK FALLBACK
                 */
                item.addEventListener(
                    "click",
                    event => {
                        event.preventDefault();
                        event.stopPropagation();

                        selectModel(
                            model
                        );
                    }
                );

                dropdown.appendChild(
                    item
                );
            }
        );

        showDropdown();

        selectedIndex = -1;

        console.log(
            "[GEN-Z Models Search] Results rendered:",
            results.length
        );
    }

    /* =====================================================
       ESCAPE HTML
    ===================================================== */

    function escapeHtml(value) {
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
       UPDATE SELECTED MODEL INFO
    ===================================================== */

    function updateSelectedModelInfo(
        model
    ) {
        if (!selectedInfo) {
            selectedInfo =
                document.getElementById(
                    "selectedModelInfo"
                );
        }

        if (!selectedInfo) {
            return;
        }

        const normalized =
            normalizeModel(
                model
            );

        if (!normalized) {
            selectedInfo.textContent =
                "Belum ada model dipilih.";

            selectedInfo.classList.remove(
                "model-selected"
            );

            delete selectedInfo.dataset
                .modelId;

            delete selectedInfo.dataset
                .provider;

            return;
        }

        const modelId =
            String(
                normalized.model_id ??
                ""
            ).trim();

        const modelName =
            String(
                normalized.model_name ??
                ""
            ).trim();

        const provider =
            String(
                normalized.provider ??
                normalized.provider_id ??
                normalized.provider_name ??
                ""
            ).trim();

        const family =
            String(
                normalized.model_family ??
                ""
            ).trim();

        const parts = [];

        if (modelId) {
            parts.push(
                `Model ID: ${modelId}`
            );
        }

        if (modelName) {
            parts.push(
                `Nama: ${modelName}`
            );
        }

        if (provider) {
            parts.push(
                `Provider: ${provider}`
            );
        }

        if (family) {
            parts.push(
                `Family: ${family}`
            );
        }

        selectedInfo.textContent =
            `✓ Model dipilih | ${parts.join(
                " • "
            )}`;

        selectedInfo.classList.add(
            "model-selected"
        );

        selectedInfo.dataset.modelId =
            modelId;

        selectedInfo.dataset.provider =
            provider;
    }

    /* =====================================================
       CLEAR SELECTED MODEL INFO
    ===================================================== */

    function clearSelectedModelInfo() {
        if (!selectedInfo) {
            selectedInfo =
                document.getElementById(
                    "selectedModelInfo"
                );
        }

        if (!selectedInfo) {
            return;
        }

        selectedInfo.textContent =
            "Belum ada model dipilih.";

        selectedInfo.classList.remove(
            "model-selected"
        );

        delete selectedInfo.dataset
            .modelId;

        delete selectedInfo.dataset
            .provider;
    }

    /* =====================================================
       SELECT MODEL
    ===================================================== */

    async function selectModel(
        model
    ) {
        if (!model) {
            return;
        }

        const normalized =
            normalizeModel(
                model
            );

        if (!normalized) {
            return;
        }

        const modelId =
            String(
                normalized.model_id ??
                ""
            ).trim();

        if (!modelId) {
            console.warn(
                "[GEN-Z Models Search] Model ID kosong."
            );

            return;
        }

        getElements();

        /*
         * Isi input visible.
         */
        if (input) {
            input.value =
                modelId;
        }

        /*
         * Isi hidden Model ID.
         */
        if (hiddenInput) {
            hiddenInput.value =
                modelId;
        }

        /*
         * Simpan model global.
         */
        window.GENZ_SELECTED_MODEL =
            normalized;

        /*
         * Tampilkan informasi model.
         */
        updateSelectedModelInfo(
            normalized
        );

        /*
         * ==================================================
         * PROVIDER
         * ==================================================
         *
         * Manual:
         * provider berasal dari dropdown.
         *
         * Catalog:
         * provider mengikuti model catalog.
         */
        if (
            !normalized.__manual
        ) {
            await syncProvider(
                normalized
            );
        }

        /*
         * Sinkron ke Models Form.
         */
        try {
            const form =
                window.GENZModelsForm;

            if (
                form &&
                typeof form.setSelectedModel ===
                    "function"
            ) {
                form.setSelectedModel(
                    normalized
                );
            }
        } catch (
            error
        ) {
            console.warn(
                "[GEN-Z Models Search] Gagal sinkronisasi ke form:",
                error
            );
        }

        /*
         * Tutup dropdown.
         */
        hideDropdown();

        /*
         * Trigger input event.
         */
        if (input) {
            input.dispatchEvent(
                new Event(
                    "input",
                    {
                        bubbles: true
                    }
                )
            );

            input.dispatchEvent(
                new Event(
                    "change",
                    {
                        bubbles: true
                    }
                )
            );
        }

        /*
         * Trigger hidden input change.
         */
        if (hiddenInput) {
            hiddenInput.dispatchEvent(
                new Event(
                    "change",
                    {
                        bubbles: true
                    }
                )
            );
        }

        console.log(
            "[GEN-Z Models Search] Model selected:",
            normalized
        );
    }

    /* =====================================================
       SYNC PROVIDER
    ===================================================== */

    async function syncProvider(
        model
    ) {
        const providerId =
            String(
                model?.provider_id ??
                model?.provider ??
                model?.provider_name ??
                ""
            ).trim();

        if (!providerId) {
            return;
        }

        const select =
            document.getElementById(
                "providerId"
            );

        if (!select) {
            return;
        }

        const normalizedProvider =
            providerId.toLowerCase();

        const options =
            Array.from(
                select.options
            );

        /*
         * Match exact value.
         */
        const matched =
            options.find(
                option =>
                    String(
                        option.value ??
                        ""
                    )
                        .trim()
                        .toLowerCase() ===
                    normalizedProvider
            );

        if (matched) {
            select.value =
                matched.value;

            select.dispatchEvent(
                new Event(
                    "change",
                    {
                        bubbles: true
                    }
                )
            );

            return;
        }

        /*
         * Match label.
         */
        const matchedText =
            options.find(
                option =>
                    String(
                        option.textContent ??
                        ""
                    )
                        .trim()
                        .toLowerCase()
                        .includes(
                            normalizedProvider
                        )
            );

        if (matchedText) {
            select.value =
                matchedText.value;

            select.dispatchEvent(
                new Event(
                    "change",
                    {
                        bubbles: true
                    }
                )
            );

            return;
        }

        console.warn(
            "[GEN-Z Models Search] Provider tidak ditemukan:",
            providerId
        );
    }

    /* =====================================================
       HIDE DROPDOWN
    ===================================================== */

    function hideDropdown() {
        if (!dropdown) {
            getElements();
        }

        if (dropdown) {
            dropdown.style.setProperty(
                "display",
                "none",
                "important"
            );

            dropdown.style.setProperty(
                "visibility",
                "hidden",
                "important"
            );
        }

        selectedIndex = -1;
    }

    /* =====================================================
       KEYBOARD
    ===================================================== */

    function handleKeyboard(
        event
    ) {
        if (!dropdown) {
            getElements();
        }

        if (!dropdown) {
            return;
        }

        const computedDisplay =
            window.getComputedStyle(
                dropdown
            ).display;

        if (
            computedDisplay ===
                "none" ||
            dropdown.style.visibility ===
                "hidden"
        ) {
            return;
        }

        const items =
            Array.from(
                dropdown.querySelectorAll(
                    ".model-search-item"
                )
            );

        if (!items.length) {
            return;
        }

        /*
         * Arrow Down
         */
        if (
            event.key ===
            "ArrowDown"
        ) {
            event.preventDefault();

            selectedIndex =
                Math.min(
                    selectedIndex + 1,
                    items.length - 1
                );

            updateKeyboardSelection(
                items
            );

            return;
        }

        /*
         * Arrow Up
         */
        if (
            event.key ===
            "ArrowUp"
        ) {
            event.preventDefault();

            selectedIndex =
                Math.max(
                    selectedIndex - 1,
                    0
                );

            updateKeyboardSelection(
                items
            );

            return;
        }

        /*
         * Enter
         */
        if (
            event.key ===
            "Enter"
        ) {
            if (
                selectedIndex >= 0 &&
                selectedIndex <
                    items.length
            ) {
                event.preventDefault();

                const index =
                    Number(
                        items[
                            selectedIndex
                        ].dataset.index
                    );

                const results =
                    search(
                        input
                            ? input.value
                            : ""
                    );

                if (
                    results[index]
                ) {
                    selectModel(
                        results[index]
                    );
                }
            }

            return;
        }

        /*
         * Escape
         */
        if (
            event.key ===
            "Escape"
        ) {
            event.preventDefault();

            hideDropdown();
        }
    }

    /* =====================================================
       KEYBOARD SELECTION
    ===================================================== */

    function updateKeyboardSelection(
        items
    ) {
        items.forEach(
            (
                item,
                index
            ) => {
                item.classList.toggle(
                    "selected",
                    index ===
                        selectedIndex
                );
            }
        );

        if (
            selectedIndex >= 0 &&
            items[
                selectedIndex
            ]
        ) {
            items[
                selectedIndex
            ].scrollIntoView({
                block: "nearest"
            });
        }
    }

    /* =====================================================
       INPUT
    ===================================================== */

    function handleInput() {
        getElements();

        if (!input) {
            return;
        }

        const keyword =
            input.value;

        /*
         * Jika user mengubah Model ID
         * setelah memilih sebelumnya,
         * kosongkan hidden value.
         */
        if (hiddenInput) {
            const current =
                String(
                    hiddenInput.value ??
                    ""
                ).trim();

            const typed =
                String(
                    keyword ??
                    ""
                ).trim();

            if (
                current &&
                current !== typed
            ) {
                hiddenInput.value =
                    "";

                window.GENZ_SELECTED_MODEL =
                    null;

                clearSelectedModelInfo();
            }
        }

        /*
         * Search selalu dijalankan,
         * termasuk ketika models = [].
         *
         * search() akan membuat manual fallback.
         */
        const results =
            search(keyword);

        renderResults(
            results
        );
    }

    /* =====================================================
       FOCUS
    ===================================================== */

    function handleFocus() {
        getElements();

        if (!input) {
            return;
        }

        const results =
            search(
                input.value
            );

        renderResults(
            results
        );
    }

    /* =====================================================
       BLUR
    ===================================================== */

    function handleBlur() {
        setTimeout(
            () => {
                hideDropdown();
            },
            250
        );
    }

    /* =====================================================
       PROVIDER CHANGE
    ===================================================== */

    function handleProviderChange() {
        getElements();

        if (input) {
            renderResults(
                search(
                    input.value
                )
            );
        }

        console.log(
            "[GEN-Z Models Search] Provider changed:",
            getSelectedProviderData()
        );
    }

    /* =====================================================
       CLICK OUTSIDE
    ===================================================== */

    function handleDocumentClick(
        event
    ) {
        getElements();

        if (
            !input ||
            !dropdown
        ) {
            return;
        }

        const target =
            event.target;

        if (
            input.contains(
                target
            ) ||
            dropdown.contains(
                target
            )
        ) {
            return;
        }

        hideDropdown();
    }

    /* =====================================================
       INITIALIZE
       RETRY SAFE
    ===================================================== */

    function initialize() {
        /*
         * Sudah initialized.
         */
        if (initialized) {
            return true;
        }

        getElements();

        /*
         * Jika HTML belum tersedia,
         * jangan menyerah.
         *
         * models-loader.js dapat memuat module
         * sebelum elemen form selesai tersedia.
         */
        if (!input) {
            initializeAttempts++;

            console.warn(
                "[GEN-Z Models Search] #modelCodeSearch belum ditemukan. Retry:",
                initializeAttempts
            );

            if (
                initializeAttempts <=
                MAX_INITIALIZE_ATTEMPTS
            ) {
                if (
                    initializeTimer
                ) {
                    clearTimeout(
                        initializeTimer
                    );
                }

                initializeTimer =
                    setTimeout(
                        () => {
                            initialize();
                        },
                        INITIALIZE_RETRY_DELAY
                    );
            }

            return false;
        }

        /*
         * Reset counter.
         */
        initializeAttempts = 0;

        /*
         * Hapus timer jika ada.
         */
        if (
            initializeTimer
        ) {
            clearTimeout(
                initializeTimer
            );

            initializeTimer =
                null;
        }

        /*
         * Event input.
         */
        input.addEventListener(
            "input",
            handleInput
        );

        /*
         * Event focus.
         */
        input.addEventListener(
            "focus",
            handleFocus
        );

        /*
         * Event blur.
         */
        input.addEventListener(
            "blur",
            handleBlur
        );

        /*
         * Keyboard.
         */
        input.addEventListener(
            "keydown",
            handleKeyboard
        );

        /*
         * Provider.
         */
        if (
            providerSelect
        ) {
            providerSelect.addEventListener(
                "change",
                handleProviderChange
            );
        }

        /*
         * Click outside.
         */
        document.addEventListener(
            "click",
            handleDocumentClick
        );

        initialized = true;

        console.log(
            "[GEN-Z Models Search] Initialized successfully."
        );

        /*
         * Jika user sudah mengetik sebelum
         * module selesai initialize,
         * langsung render.
         */
        if (
            input.value.trim()
        ) {
            renderResults(
                search(
                    input.value
                )
            );
        }

        return true;
    }

    /* =====================================================
       DESTROY
    ===================================================== */

    function destroy() {
        if (
            initializeTimer
        ) {
            clearTimeout(
                initializeTimer
            );

            initializeTimer =
                null;
        }

        if (!initialized) {
            return;
        }

        if (input) {
            input.removeEventListener(
                "input",
                handleInput
            );

            input.removeEventListener(
                "focus",
                handleFocus
            );

            input.removeEventListener(
                "blur",
                handleBlur
            );

            input.removeEventListener(
                "keydown",
                handleKeyboard
            );
        }

        if (
            providerSelect
        ) {
            providerSelect.removeEventListener(
                "change",
                handleProviderChange
            );
        }

        document.removeEventListener(
            "click",
            handleDocumentClick
        );

        hideDropdown();

        initialized = false;

        console.log(
            "[GEN-Z Models Search] Destroyed."
        );
    }

    /* =====================================================
       PUBLIC API
    ===================================================== */

    window.GENZModelsSearch = {
        initialize,
        destroy,

        setModels,
        getModels,

        search,
        selectModel,

        hideDropdown,

        updateSelectedModelInfo,
        clearSelectedModelInfo
    };

    /* =====================================================
       DOM READY
    ===================================================== */

    if (
        document.readyState ===
        "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            () => {
                initialize();
            },
            {
                once: true
            }
        );
    } else {
        initialize();
    }

    /*
     * Safety retry tambahan.
     *
     * Berguna apabila models-loader.js,
     * models-ui.js, atau HTML form dimuat
     * secara dinamis setelah DOMContentLoaded.
     */
    setTimeout(
        () => {
            if (!initialized) {
                initialize();
            }
        },
        300
    );

    setTimeout(
        () => {
            if (!initialized) {
                initialize();
            }
        },
        1000
    );

})();
