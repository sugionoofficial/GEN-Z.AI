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
            model.provider ||
            model.provider_id ||
            ""
        ).trim();

        const providerId = String(
            model.provider_id ||
            provider ||
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
            model?.status ||
            ""
        )
            .trim()
            .toLowerCase();

        /*
         * Status kosong tetap boleh tampil.
         *
         * Ini penting untuk kompatibilitas
         * katalog model lama / custom provider.
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

        return {
            id: String(
                providerSelect.value ||
                ""
            )
                .trim()
                .toLowerCase(),

            value: String(
                providerSelect.value ||
                ""
            ).trim(),

            text: String(
                option?.textContent ||
                ""
            )
                .trim()
                .toLowerCase()
        };
    }

    /* =====================================================
       PROVIDER MATCH
    ===================================================== */

    function providerMatches(model) {
        const selected =
            getSelectedProviderData();

        /*
         * Belum memilih provider.
         *
         * Jangan blok pencarian.
         */
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
                    value || ""
                )
                    .trim()
                    .toLowerCase()
            )
            .filter(Boolean);

        /*
         * Nilai provider dari option.
         *
         * Contoh:
         *
         * providerId = bytedance
         * text        = ByteDance (bytedance)
         */
        const selectedValues = [
            selected.id,
            selected.text
        ]
            .filter(Boolean);

        /*
         * Cocokkan langsung.
         */
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

                /*
                 * Provider ID bisa berada
                 * di dalam label option.
                 */
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

        /*
         * Kalau provider tidak cocok,
         * jangan langsung membuang model.
         *
         * Karena beberapa katalog KIE
         * menggunakan identifier provider
         * yang berbeda dengan providers.provider_id.
         */
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
                    value || ""
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
            keyword || ""
        )
            .trim()
            .toLowerCase();

        /*
         * ================================================
         * SEARCH KATALOG
         * ================================================
         */

        let results =
            models.filter(
                model => {
                    if (
                        !isActive(
                            model
                        )
                    ) {
                        return false;
                    }

                    /*
                     * Keyword kosong:
                     * semua model katalog.
                     */
                    if (!term) {
                        return true;
                    }

                    const modelId =
                        String(
                            model.model_id ||
                            ""
                        )
                            .trim()
                            .toLowerCase();

                    const modelName =
                        String(
                            model.model_name ||
                            ""
                        )
                            .trim()
                            .toLowerCase();

                    const family =
                        String(
                            model.model_family ||
                            ""
                        )
                            .trim()
                            .toLowerCase();

                    const provider =
                        String(
                            model.provider ||
                            model.provider_id ||
                            model.provider_name ||
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
         *
         * Jangan membuang model hanya karena
         * provider catalog dan provider database
         * menggunakan identifier berbeda.
         *
         * Model provider yang cocok ditempatkan
         * paling atas.
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
         * Kalau user mengetik sesuatu tetapi
         * katalog tidak memiliki model tersebut,
         * tetap tampilkan pilihan manual.
         *
         * Ini memungkinkan provider baru
         * menggunakan Model ID sendiri tanpa
         * harus terlebih dahulu memasukkan model
         * ke kie_models.
         */
        if (term) {
            const exactExists =
                results.some(
                    model =>
                        String(
                            model.model_id ||
                            ""
                        )
                            .trim()
                            .toLowerCase() ===
                        term
                );

            if (!exactExists) {
                const exactAny =
                    models.some(
                        model =>
                            String(
                                model.model_id ||
                                ""
                            )
                                .trim()
                                .toLowerCase() ===
                            term
                    );

                /*
                 * Tambahkan manual entry.
                 */
                results.push({
                    __manual: true,

                    id: null,

                    provider:
                        getSelectedProviderData()
                            .value,

                    provider_id:
                        getSelectedProviderData()
                            .value,

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
                    keyword
                );
            }
        }

        return results;
    }

    /* =====================================================
       RENDER RESULTS
    ===================================================== */

    function renderResults(results) {
        if (!dropdown) {
            getElements();
        }

        if (!dropdown) {
            return;
        }

        dropdown.innerHTML = "";

        if (
            !Array.isArray(
                results
            ) ||
            results.length === 0
        ) {
            dropdown.style.display =
                "none";

            selectedIndex = -1;

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

                if (
                    model.__manual
                ) {
                    item.classList.add(
                        "model-search-manual"
                    );
                }

                const modelId =
                    String(
                        model.model_id ||
                        ""
                    ).trim();

                const modelName =
                    String(
                        model.model_name ||
                        ""
                    ).trim();

                const family =
                    String(
                        model.model_family ||
                        ""
                    ).trim();

                const provider =
                    String(
                        model.provider ||
                        model.provider_id ||
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
                                Model baru / manual
                            </span>
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
                 * mousedown:
                 * mencegah blur terjadi lebih dulu.
                 */
                item.addEventListener(
                    "mousedown",
                    event => {
                        event.preventDefault();

                        selectModel(
                            model
                        );
                    }
                );

                /*
                 * click fallback.
                 */
                item.addEventListener(
                    "click",
                    event => {
                        event.preventDefault();

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

        dropdown.style.display =
            "block";

        selectedIndex = -1;
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

            return;
        }

        const modelId =
            String(
                normalized.model_id ||
                ""
            ).trim();

        const modelName =
            String(
                normalized.model_name ||
                ""
            ).trim();

        const provider =
            String(
                normalized.provider ||
                normalized.provider_id ||
                ""
            ).trim();

        const family =
            String(
                normalized.model_family ||
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
                normalized.model_id ||
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
         * Tampilkan info.
         */
        updateSelectedModelInfo(
            normalized
        );

        /*
         * Sinkron provider hanya jika
         * model katalog memiliki provider.
         *
         * Untuk manual model, provider
         * sudah berasal dari dropdown.
         */
        if (
            !normalized.__manual
        ) {
            await syncProvider(
                normalized
            );
        }

        /*
         * Beritahu form.
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
         * Trigger events.
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
                model.provider_id ||
                model.provider ||
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

        const options =
            Array.from(
                select.options
            );

        /*
         * Cocokkan value.
         */
        const matched =
            options.find(
                option =>
                    String(
                        option.value ||
                        ""
                    )
                        .trim()
                        .toLowerCase() ===
                    providerId.toLowerCase()
            );

        if (matched) {
            select.value =
                matched.value;

            return;
        }

        /*
         * Cocokkan label.
         */
        const matchedText =
            options.find(
                option =>
                    String(
                        option.textContent ||
                        ""
                    )
                        .trim()
                        .toLowerCase()
                        .includes(
                            providerId.toLowerCase()
                        )
            );

        if (matchedText) {
            select.value =
                matchedText.value;

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
            dropdown.style.display =
                "none";
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
            return;
        }

        if (
            dropdown.style.display ===
            "none"
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

        if (
            event.key ===
            "Escape"
        ) {
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
        if (!input) {
            return;
        }

        const keyword =
            input.value;

        /*
         * Jika user mengedit model
         * setelah memilih model sebelumnya,
         * kosongkan hidden value.
         */
        if (hiddenInput) {
            const current =
                String(
                    hiddenInput.value ||
                    ""
                ).trim();

            const typed =
                String(
                    keyword ||
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

        renderResults(
            search(
                keyword
            )
        );
    }

    /* =====================================================
       FOCUS
    ===================================================== */

    function handleFocus() {
        if (!input) {
            return;
        }

        renderResults(
            search(
                input.value
            )
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
            200
        );
    }

    /* =====================================================
       PROVIDER CHANGE
    ===================================================== */

    function handleProviderChange() {
        getElements();

        /*
         * Jangan menghapus model yang sedang
         * diketik user secara paksa.
         *
         * Cukup refresh hasil pencarian.
         */
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
    ===================================================== */

    function initialize() {
        if (initialized) {
            return;
        }

        getElements();

        if (!input) {
            console.warn(
                "[GEN-Z Models Search] #modelCodeSearch belum ditemukan."
            );

            return;
        }

        initialized = true;

        input.addEventListener(
            "input",
            handleInput
        );

        input.addEventListener(
            "focus",
            handleFocus
        );

        input.addEventListener(
            "blur",
            handleBlur
        );

        input.addEventListener(
            "keydown",
            handleKeyboard
        );

        if (providerSelect) {
            providerSelect.addEventListener(
                "change",
                handleProviderChange
            );
        }

        document.addEventListener(
            "click",
            handleDocumentClick
        );

        console.log(
            "[GEN-Z Models Search] Initialized."
        );
    }

    /* =====================================================
       DESTROY
    ===================================================== */

    function destroy() {
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

        if (providerSelect) {
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
            initialize,
            {
                once: true
            }
        );
    } else {
        initialize();
    }

})();
