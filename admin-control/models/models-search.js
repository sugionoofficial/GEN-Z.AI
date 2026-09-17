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
   - Select model
   - Auto-fill Model ID
   - Auto-sync Provider
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

    let selectedIndex = -1;

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

        return {
            input,
            hiddenInput,
            dropdown
        };
    }

    /* =====================================================
       NORMALIZE MODEL
    ===================================================== */

    function normalizeModel(model) {
        if (!model || typeof model !== "object") {
            return null;
        }

        const provider =
            String(
                model.provider ||
                model.provider_id ||
                ""
            ).trim();

        return {
            ...model,

            provider,

            provider_id:
                String(
                    model.provider_id ||
                    provider ||
                    ""
                ).trim()
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
        models =
            normalizeModels(list);

        console.log(
            "[GEN-Z Models Search] Models received:",
            models.length
        );

        return [
            ...models
        ];
    }

    /* =====================================================
       GET MODELS
    ===================================================== */

    function getModels() {
        return [
            ...models
        ];
    }

    /* =====================================================
       MODEL STATUS
    ===================================================== */

    function isActive(model) {
        return (
            String(
                model?.status ||
                ""
            )
                .trim()
                .toLowerCase() ===
            "active"
        );
    }

    /* =====================================================
       SEARCH
    ===================================================== */

    function search(keyword = "") {
        const term =
            String(
                keyword || ""
            )
                .trim()
                .toLowerCase();

        /*
         * Tidak ada keyword:
         * tampilkan model aktif.
         */

        if (!term) {
            return models.filter(
                isActive
            );
        }

        /*
         * Ada keyword:
         * cari berdasarkan:
         * - model_id
         * - model_name
         * - model_family
         * - provider
         *
         * Status tidak digunakan sebagai
         * syarat pencarian karena data yang
         * dikirim models-ui sudah berasal
         * dari loadModels().
         */

        return models.filter(
            model => {

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
                        ""
                    )
                        .trim()
                        .toLowerCase();

                return (
                    modelId.includes(term) ||
                    modelName.includes(term) ||
                    family.includes(term) ||
                    provider.includes(term)
                );
            }
        );
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
            !Array.isArray(results) ||
            results.length === 0
        ) {
            dropdown.style.display =
                "none";

            selectedIndex = -1;

            return;
        }

        results.forEach(
            (model, index) => {

                const item =
                    document.createElement(
                        "div"
                    );

                item.className =
                    "model-search-item";

                item.dataset.index =
                    String(index);

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

                item.innerHTML = `
                    <div class="model-search-main">
                        <strong>
                            ${escapeHtml(modelId)}
                        </strong>
                    </div>

                    ${
                        modelName
                            ? `
                            <div class="model-search-name">
                                ${escapeHtml(modelName)}
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
                                    ${escapeHtml(provider)}
                                </span>
                                `
                                : ""
                        }

                        ${
                            family
                                ? `
                                <span>
                                    ${escapeHtml(family)}
                                </span>
                                `
                                : ""
                        }

                    </div>
                `;

                item.addEventListener(
                    "mousedown",
                    event => {

                        /*
                         * Gunakan mousedown agar
                         * pilihan tidak hilang
                         * ketika input blur.
                         */

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
       SELECT MODEL
    ===================================================== */

    async function selectModel(model) {
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
            return;
        }

        getElements();

        /*
         * Isi input yang terlihat.
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
         * Simpan model terpilih.
         */

        window.GENZ_SELECTED_MODEL =
            normalized;

        /*
         * Sinkronkan provider.
         */

        await syncProvider(
            normalized
        );

        hideDropdown();

        /*
         * Beritahu form bahwa
         * Model ID berubah.
         */

        if (input) {

            input.dispatchEvent(
                new Event(
                    "change",
                    {
                        bubbles: true
                    }
                )
            );

            input.dispatchEvent(
                new Event(
                    "input",
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
    }

    /* =====================================================
       SYNC PROVIDER
    ===================================================== */

    async function syncProvider(model) {

        const providerId =
            String(
                model.provider_id ||
                model.provider ||
                ""
            ).trim();

        if (!providerId) {

            console.warn(
                "[GEN-Z Models Search] Model tidak memiliki provider."
            );

            return;
        }

        const providerSelect =
            document.getElementById(
                "providerId"
            );

        if (!providerSelect) {

            console.warn(
                "[GEN-Z Models Search] #providerId tidak ditemukan."
            );

            return;
        }

        const options =
            Array.from(
                providerSelect.options
            );

        /*
         * Prioritas pertama:
         * cocokkan provider_id.
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
                    providerId
                        .toLowerCase()
            );

        if (matched) {

            providerSelect.value =
                matched.value;

            providerSelect.dispatchEvent(
                new Event(
                    "change",
                    {
                        bubbles: true
                    }
                )
            );

            console.log(
                "[GEN-Z Models Search] Provider synced:",
                matched.value
            );

            return;
        }

        /*
         * Fallback:
         * cocokkan teks provider.
         */

        const matchedByText =
            options.find(
                option =>
                    String(
                        option.textContent ||
                        ""
                    )
                        .trim()
                        .toLowerCase()
                        .includes(
                            providerId
                                .toLowerCase()
                        )
            );

        if (matchedByText) {

            providerSelect.value =
                matchedByText.value;

            providerSelect.dispatchEvent(
                new Event(
                    "change",
                    {
                        bubbles: true
                    }
                )
            );

            console.log(
                "[GEN-Z Models Search] Provider synced by text:",
                matchedByText.value
            );

            return;
        }

        console.warn(
            "[GEN-Z Models Search] Provider tidak ditemukan di dropdown:",
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

    function handleKeyboard(event) {

        if (!dropdown) {
            return;
        }

        const visible =
            dropdown.style.display !==
            "none";

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

            hideDropdown();
        }
    }

    function updateKeyboardSelection(
        items
    ) {

        items.forEach(
            (item, index) => {

                item.classList.toggle(
                    "selected",
                    index ===
                        selectedIndex
                );
            }
        );
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
         * Kalau user mengubah teks
         * setelah memilih model,
         * kosongkan hidden Model ID.
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
            }
        }

        const results =
            search(
                keyword
            );

        renderResults(
            results
        );
    }

    /* =====================================================
       FOCUS
    ===================================================== */

    function handleFocus() {

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
            180
        );
    }

    /* =====================================================
       CLICK OUTSIDE
    ===================================================== */

    function handleDocumentClick(
        event
    ) {

        if (!input) {
            return;
        }

        if (
            event.target === input ||
            dropdown?.contains(
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
            return;
        }

        getElements();

        if (!input) {

            console.warn(
                "[GEN-Z Models Search] Input #modelCodeSearch belum ditemukan."
            );

            return;
        }

        /*
         * PENTING:
         *
         * Tidak ada lagi:
         *
         * GENZModelsData.loadKieModels()
         *
         * di sini.
         *
         * Data model sekarang sepenuhnya
         * dikirim oleh models-ui.js
         * melalui setModels().
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

        document.addEventListener(
            "click",
            handleDocumentClick
        );

        initialized =
            true;

        console.log(
            "[GEN-Z Models Search] Initialized. Waiting for model data..."
        );

        /*
         * Jika models-ui sudah mengirim
         * data sebelum initialize selesai,
         * data tetap tersimpan melalui
         * setModels().
         */
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

        document.removeEventListener(
            "click",
            handleDocumentClick
        );

        initialized =
            false;

        console.log(
            "[GEN-Z Models Search] Destroyed."
        );
    }

    /* =====================================================
       PUBLIC API
    ===================================================== */

    window.GENZModelsSearch =
        Object.freeze({

            initialize,

            destroy,

            setModels,

            getModels,

            search,

            selectModel,

            hideDropdown

        });

})();
