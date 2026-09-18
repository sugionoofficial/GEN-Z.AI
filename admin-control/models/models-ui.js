/* =========================================================
   GEN-Z.AI
   ADMIN MODEL MANAGEMENT
   MODEL SEARCH MODULE

   FIXED VERSION
   - Search tidak bergantung pada kie_models
   - Manual Model ID selalu tersedia
   - Provider-aware
   - Tidak auto initialize sendiri
   - Initialization dikontrol models-ui.js
   - Aman untuk dynamic loader
   - Dropdown dipaksa tampil
   - Click item bekerja
   - Keyboard navigation bekerja
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
    let lastRenderedResults = [];

    /* =====================================================
       DOM
    ===================================================== */

    function getElements() {
        input =
            document.getElementById(
                "modelCodeSearch"
            );

        hiddenInput =
            document.getElementById(
                "modelCode"
            );

        dropdown =
            document.getElementById(
                "modelSearchResults"
            );

        if (!dropdown) {
            dropdown =
                document.getElementById(
                    "modelSearchDropdown"
                );
        }

        if (!dropdown) {
            dropdown =
                document.querySelector(
                    ".model-search-results"
                );
        }

        selectedInfo =
            document.getElementById(
                "selectedModelInfo"
            );

        providerSelect =
            document.getElementById(
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
       NORMALIZE
    ===================================================== */

    function normalizeModel(model) {

        if (
            !model ||
            typeof model !== "object"
        ) {
            return null;
        }

        const provider =
            String(
                model.provider ??
                model.provider_id ??
                model.provider_name ??
                ""
            ).trim();

        const providerId =
            String(
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
       MODELS
    ===================================================== */

    function setModels(list) {

        models =
            normalizeModels(list);

        console.log(
            "[GEN-Z Models Search] Catalog:",
            models.length
        );

        getElements();

        if (
            input &&
            document.activeElement === input
        ) {

            renderResults(
                search(
                    input.value
                )
            );
        }

        return [
            ...models
        ];
    }

    function getModels() {
        return [
            ...models
        ];
    }

    /* =====================================================
       STATUS
    ===================================================== */

    function isActive(model) {

        const status =
            String(
                model?.status ?? ""
            )
                .trim()
                .toLowerCase();

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
       PROVIDER
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
                value: "",
                text: ""
            };
        }

        const option =
            providerSelect.options[
                providerSelect.selectedIndex
            ];

        const value =
            String(
                providerSelect.value || ""
            ).trim();

        const text =
            String(
                option?.textContent || ""
            ).trim();

        return {
            id: value.toLowerCase(),
            value,
            text: text.toLowerCase()
        };
    }

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

        for (
            const value of values
        ) {

            if (
                value ===
                selected.id
            ) {
                return true;
            }

            if (
                value ===
                selected.text
            ) {
                return true;
            }

            if (
                selected.text &&
                selected.text.includes(
                    value
                )
            ) {
                return true;
            }

            if (
                selected.id &&
                value.includes(
                    selected.id
                )
            ) {
                return true;
            }
        }

        return false;
    }

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
            const value of values
        ) {

            if (
                value ===
                selected.id
            ) {
                score =
                    Math.max(
                        score,
                        100
                    );
            }

            if (
                value ===
                selected.text
            ) {
                score =
                    Math.max(
                        score,
                        90
                    );
            }

            if (
                selected.text &&
                selected.text.includes(
                    value
                )
            ) {
                score =
                    Math.max(
                        score,
                        70
                    );
            }

            if (
                selected.id &&
                value.includes(
                    selected.id
                )
            ) {
                score =
                    Math.max(
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

    function search(
        keyword = ""
    ) {

        const raw =
            String(
                keyword ?? ""
            ).trim();

        const term =
            raw.toLowerCase();

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
         * Provider matching hanya dipakai
         * sebagai prioritas, bukan filter keras.
         *
         * Jadi model tetap bisa dicari
         * meskipun provider catalog belum
         * sempurna.
         */
        results.sort(
            (a, b) =>
                getProviderScore(b) -
                getProviderScore(a)
        );

        /*
         * =================================================
         * MANUAL MODEL ID
         * =================================================
         *
         * Ini inti perbaikannya.
         *
         * Provider boleh sudah ada di
         * public.providers walaupun model
         * belum ada di kie_models.
         */

        if (raw) {

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

                const provider =
                    getSelectedProviderData();

                results.push({

                    __manual: true,

                    id: null,

                    provider:
                        provider.value,

                    provider_id:
                        provider.value,

                    model_id:
                        raw,

                    model_name:
                        "",

                    model_family:
                        "",

                    status:
                        "active"
                });

            }
        }

        return results;
    }

    /* =====================================================
       HTML ESCAPE
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
       SHOW DROPDOWN
    ===================================================== */

    function showDropdown() {

        if (!dropdown) {
            getElements();
        }

        if (!dropdown) {
            return;
        }

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
            "999999",
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

        dropdown.style.setProperty(
            "pointer-events",
            "auto",
            "important"
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

            dropdown.style.setProperty(
                "opacity",
                "0",
                "important"
            );
        }

        selectedIndex =
            -1;
    }

    /* =====================================================
       RENDER
    ===================================================== */

    function renderResults(
        results
    ) {

        getElements();

        if (!dropdown) {

            console.warn(
                "[GEN-Z Models Search] Dropdown tidak ditemukan."
            );

            return;
        }

        if (
            !Array.isArray(
                results
            )
        ) {
            results = [];
        }

        lastRenderedResults =
            results;

        dropdown.innerHTML =
            "";

        /*
         * Jika ada keyword tetapi hasil
         * catalog kosong, manual result
         * tetap dibuat.
         */
        if (
            results.length === 0 &&
            input
        ) {

            const keyword =
                String(
                    input.value || ""
                ).trim();

            if (keyword) {

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
                        model_name:
                            "",
                        model_family:
                            "",
                        status:
                            "active"
                    }
                ];

                lastRenderedResults =
                    results;
            }
        }

        if (
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

                item.style.cursor =
                    "pointer";

                item.style.pointerEvents =
                    "auto";

                item.style.display =
                    "block";

                item.style.width =
                    "100%";

                item.style.boxSizing =
                    "border-box";

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

                    item.classList.add(
                        "model-search-manual"
                    );

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

                        ${
                            provider
                                ? `
                                    <div class="model-search-meta">
                                        Provider:
                                        ${escapeHtml(
                                            provider
                                        )}
                                    </div>
                                  `
                                : `
                                    <div class="model-search-meta">
                                        Pilih provider terlebih dahulu
                                    </div>
                                  `
                        }
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
                                    ? escapeHtml(
                                        provider
                                    )
                                    : "Provider tidak diketahui"
                            }

                            ${
                                family
                                    ? `
                                        · ${escapeHtml(
                                            family
                                        )}
                                      `
                                    : ""
                            }
                        </div>
                    `;
                }

                /*
                 * CLICK
                 */
                item.addEventListener(
                    "mousedown",
                    event => {

                        event.preventDefault();

                    }
                );

                item.addEventListener(
                    "click",
                    event => {

                        event.preventDefault();
                        event.stopPropagation();

                        const selected =
                            lastRenderedResults[
                                index
                            ];

                        if (
                            selected
                        ) {

                            selectModel(
                                selected
                            );
                        }
                    }
                );

                dropdown.appendChild(
                    item
                );
            }
        );

        selectedIndex =
            -1;

        showDropdown();
    }

    /* =====================================================
       SELECTED INFO
    ===================================================== */

    function updateSelectedModelInfo(
        model
    ) {

        getElements();

        if (!selectedInfo) {
            return;
        }

        if (!model) {

            clearSelectedModelInfo();

            return;
        }

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

        const provider =
            String(
                model.provider ??
                model.provider_id ??
                model.provider_name ??
                ""
            ).trim();

        if (model.__manual) {

            selectedInfo.textContent =
                provider
                    ? `Model ID manual: ${modelId} • Provider: ${provider}`
                    : `Model ID manual: ${modelId}`;

        } else {

            const parts = [
                modelId,
                modelName,
                provider
            ].filter(Boolean);

            selectedInfo.textContent =
                parts.join(
                    " • "
                );
        }

        selectedInfo.classList.add(
            "model-selected"
        );

        selectedInfo.dataset.modelId =
            modelId;

        selectedInfo.dataset.provider =
            provider;
    }

    function clearSelectedModelInfo() {

        getElements();

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
            return;
        }

        getElements();

        /*
         * Visible input
         */
        if (input) {

            input.value =
                modelId;

        }

        /*
         * Hidden input
         */
        if (hiddenInput) {

            hiddenInput.value =
                modelId;

        }

        /*
         * Global
         */
        window.GENZ_SELECTED_MODEL =
            normalized;

        /*
         * Info
         */
        updateSelectedModelInfo(
            normalized
        );

        /*
         * Provider:
         *
         * Manual model:
         * jangan mengubah provider.
         *
         * Catalog:
         * sinkronkan provider model.
         */
        if (
            !normalized.__manual
        ) {

            await syncProvider(
                normalized
            );
        }

        /*
         * Form
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

        } catch (error) {

            console.warn(
                "[GEN-Z Models Search] Form sync error:",
                error
            );
        }

        hideDropdown();

        /*
         * Jangan dispatch input event
         * lagi di sini.
         *
         * Sebelumnya ini bisa menyebabkan:
         *
         * select
         * ↓
         * input
         * ↓
         * search
         * ↓
         * dropdown muncul lagi
         *
         * dan manusia menyebutnya "fitur".
         */

        if (input) {

            input.dispatchEvent(
                new Event(
                    "change",
                    {
                        bubbles:
                            true
                    }
                )
            );
        }

        if (hiddenInput) {

            hiddenInput.dispatchEvent(
                new Event(
                    "change",
                    {
                        bubbles:
                            true
                    }
                )
            );
        }

        console.log(
            "[GEN-Z Models Search] Selected:",
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

        const normalized =
            providerId.toLowerCase();

        const options =
            Array.from(
                select.options
            );

        const exact =
            options.find(
                option =>
                    String(
                        option.value ??
                        ""
                    )
                        .trim()
                        .toLowerCase() ===
                    normalized
            );

        if (exact) {

            select.value =
                exact.value;

            select.dispatchEvent(
                new Event(
                    "change",
                    {
                        bubbles:
                            true
                    }
                )
            );

            return;
        }

        const byText =
            options.find(
                option =>
                    String(
                        option.textContent ??
                        ""
                    )
                        .trim()
                        .toLowerCase()
                        .includes(
                            normalized
                        )
            );

        if (byText) {

            select.value =
                byText.value;

            select.dispatchEvent(
                new Event(
                    "change",
                    {
                        bubbles:
                            true
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
       KEYBOARD
    ===================================================== */

    function handleKeyboard(
        event
    ) {

        getElements();

        if (!dropdown) {
            return;
        }

        const visible =
            window.getComputedStyle(
                dropdown
            ).display !== "none";

        if (!visible) {
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
                    lastRenderedResults.length
            ) {

                event.preventDefault();

                selectModel(
                    lastRenderedResults[
                        selectedIndex
                    ]
                );
            }

            return;
        }

        if (
            event.key ===
            "Escape"
        ) {

            event.preventDefault();

            hideDropdown();
        }
    }

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
                block:
                    "nearest"
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
         * Reset hidden value jika
         * user mengubah input setelah
         * memilih model.
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

        getElements();

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

        /*
         * Delay sedikit agar click item
         * dapat diproses sebelum dropdown
         * ditutup.
         */
        setTimeout(
            () => {

                hideDropdown();

            },
            300
        );
    }

    /* =====================================================
       PROVIDER CHANGE
    ===================================================== */

    function handleProviderChange() {

        getElements();

        if (!input) {
            return;
        }

        /*
         * Jika input kosong, jangan paksa
         * dropdown muncul hanya karena
         * provider berubah.
         */
        if (
            !String(
                input.value || ""
            ).trim()
        ) {

            return;
        }

        renderResults(
            search(
                input.value
            )
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

        if (
            input.contains(
                event.target
            ) ||
            dropdown.contains(
                event.target
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
            return true;
        }

        getElements();

        /*
         * Tidak melakukan retry sendiri.
         *
         * models-ui.js sudah memastikan
         * initialization dilakukan setelah
         * HTML tersedia.
         */
        if (!input) {

            console.warn(
                "[GEN-Z Models Search] #modelCodeSearch belum tersedia."
            );

            return false;
        }

        /*
         * Bersihkan listener lama secara defensif.
         */
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

        document.removeEventListener(
            "click",
            handleDocumentClick
        );

        if (providerSelect) {

            providerSelect.removeEventListener(
                "change",
                handleProviderChange
            );
        }

        /*
         * Bind.
         */
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

        initialized =
            true;

        console.log(
            "[GEN-Z Models Search] Initialized.",
            {
                models:
                    models.length,
                input:
                    !!input,
                dropdown:
                    !!dropdown,
                provider:
                    !!providerSelect
            }
        );

        /*
         * Jika sudah ada teks.
         */
        if (
            String(
                input.value || ""
            ).trim()
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

        initialized =
            false;

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

    /*
     * PENTING:
     *
     * TIDAK ADA:
     *
     * DOMContentLoaded
     * setTimeout retry
     * auto initialize
     *
     * Semua dikendalikan oleh
     * models-ui.js.
     */

})();
