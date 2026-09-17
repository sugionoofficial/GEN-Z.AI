// ========================================
// GEN-Z.AI
// PROVIDERS - LIST MODULE
// File: admin-control/providers/list.js
// ========================================

(function () {
    "use strict";

    // Jangan inisialisasi dua kali
    if (window.GENZProviderList) {
        return;
    }

    let providers = [];
    let container = null;

    // ========================================
    // HELPERS
    // ========================================

    function getSupabase() {
        const module =
            window.GENZProviderSupabase;

        if (!module || !module.ready) {
            throw new Error(
                module?.error ||
                "Modul Supabase belum siap."
            );
        }

        return module.client;
    }

    function normalizeStatus(value) {
        const status =
            String(value || "")
                .trim()
                .toLowerCase();

        if (
            status === "inactive" ||
            status === "disabled" ||
            status === "off" ||
            status === "nonaktif"
        ) {
            return "inactive";
        }

        return "active";
    }

    function getDatabaseId(provider) {
        return (
            provider?.id ||
            provider?.uuid ||
            ""
        );
    }

    function getProviderId(provider) {
        return String(
            provider?.provider_id || ""
        )
            .trim()
            .toLowerCase();
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function formatDate(value) {
        if (!value) {
            return "-";
        }

        const date =
            new Date(value);

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return "-";
        }

        try {
            return date.toLocaleDateString(
                "id-ID",
                {
                    day: "2-digit",
                    month: "short",
                    year: "numeric"
                }
            );
        } catch {
            return date
                .toISOString()
                .slice(0, 10);
        }
    }

    // ========================================
    // FIND CONTAINER
    // ========================================

    function findContainer() {
        const existing =
            document.getElementById(
                "providerList"
            );

        if (existing) {
            return existing;
        }

        const alternative =
            document.getElementById(
                "providersList"
            );

        if (alternative) {
            return alternative;
        }

        const panel =
            document.getElementById(
                "providerPanel"
            );

        if (panel) {
            return panel;
        }

        return null;
    }

    function ensureContainer() {
        container =
            findContainer();

        if (container) {
            return container;
        }

        const main =
            document.querySelector(
                "main"
            ) ||
            document.querySelector(
                ".main-content"
            ) ||
            document.body;

        container =
            document.createElement(
                "div"
            );

        container.id =
            "providerList";

        container.className =
            "provider-list";

        main.appendChild(
            container
        );

        return container;
    }

    // ========================================
    // LOADING
    // ========================================

    function renderLoading() {
        const target =
            ensureContainer();

        target.innerHTML = `
            <div
                class="provider-list-loading"
                style="
                    padding:24px;
                    text-align:center;
                    opacity:.75;
                "
            >
                Memuat provider...
            </div>
        `;
    }

    // ========================================
    // EMPTY
    // ========================================

    function renderEmpty() {
        const target =
            ensureContainer();

        target.innerHTML = `
            <div
                class="provider-list-empty"
                style="
                    padding:32px;
                    text-align:center;
                    opacity:.75;
                    border:1px dashed rgba(255,255,255,.15);
                    border-radius:12px;
                "
            >
                <div
                    style="
                        font-size:32px;
                        margin-bottom:10px;
                    "
                >
                    ⚙️
                </div>

                <div
                    style="
                        font-size:16px;
                        font-weight:600;
                        margin-bottom:6px;
                    "
                >
                    Belum ada provider
                </div>

                <div
                    style="
                        font-size:13px;
                    "
                >
                    Tambahkan provider untuk mulai menggunakan engine AI.
                </div>
            </div>
        `;
    }

    // ========================================
    // ERROR
    // ========================================

    function renderError(error) {
        const target =
            ensureContainer();

        const message =
            error?.message ||
            "Gagal memuat provider.";

        target.innerHTML = `
            <div
                class="provider-list-error"
                style="
                    padding:24px;
                    border:1px solid rgba(255,80,80,.35);
                    border-radius:12px;
                    background:rgba(255,60,60,.06);
                "
            >
                <div
                    style="
                        font-size:18px;
                        font-weight:700;
                        margin-bottom:8px;
                    "
                >
                    Gagal memuat provider
                </div>

                <div
                    style="
                        font-size:13px;
                        opacity:.8;
                        margin-bottom:14px;
                    "
                >
                    ${escapeHtml(message)}
                </div>

                <button
                    type="button"
                    data-provider-list-action="reload"
                    style="
                        border:0;
                        padding:9px 14px;
                        border-radius:8px;
                        cursor:pointer;
                    "
                >
                    🔄 Coba Lagi
                </button>
            </div>
        `;
    }

    // ========================================
    // API KEY STATUS
    // ========================================
    //
    // Backend credential API hanya menerima POST.
    // Jadi kita TIDAK melakukan GET credential.
    //
    // Status "Tersimpan" hanya ditampilkan jika
    // modul API Key telah berhasil menyimpan key
    // pada sesi halaman ini.
    //
    // ========================================

    function getApiKeyStatus(provider) {
        const apiKeyModule =
            window.GENZProviderApiKey;

        if (
            !apiKeyModule ||
            !apiKeyModule.ready
        ) {
            return false;
        }

        const providerId =
            getProviderId(
                provider
            );

        if (!providerId) {
            return false;
        }

        try {
            return Boolean(
                apiKeyModule.isSaved(
                    providerId
                )
            );
        } catch {
            return false;
        }
    }

    function renderApiKeyStatus(provider) {
        const saved =
            getApiKeyStatus(
                provider
            );

        if (saved) {
            return `
                <div
                    class="provider-api-status"
                    style="
                        display:inline-flex;
                        align-items:center;
                        gap:6px;
                        margin-top:10px;
                        font-size:12px;
                        font-weight:600;
                        opacity:.9;
                    "
                >
                    🔐 API Key: Tersimpan
                </div>
            `;
        }

        return `
            <div
                class="provider-api-status"
                style="
                    display:inline-flex;
                    align-items:center;
                    gap:6px;
                    margin-top:10px;
                    font-size:12px;
                    opacity:.65;
                "
            >
                🔑 API Key: Belum disimpan
            </div>
        `;
    }

    // ========================================
    // CARD
    // ========================================

    function renderProviderCard(
        provider
    ) {
        const databaseId =
            getDatabaseId(
                provider
            );

        const providerId =
            getProviderId(
                provider
            );

        const providerName =
            String(
                provider?.provider_name ||
                providerId ||
                "Provider"
            ).trim();

        const description =
            String(
                provider?.description ||
                ""
            ).trim();

        const status =
            normalizeStatus(
                provider?.status
            );

        const isDefault =
            Boolean(
                provider?.is_default
            );

        const active =
            status === "active";

        const safeDatabaseId =
            escapeHtml(
                databaseId
            );

        const safeProviderId =
            escapeHtml(
                providerId
            );

        const safeProviderName =
            escapeHtml(
                providerName
            );

        const safeDescription =
            escapeHtml(
                description
            );

        return `
            <article
                class="provider-card"
                data-provider-card-id="${safeDatabaseId}"
                data-provider-public-id="${safeProviderId}"
                style="
                    position:relative;
                    display:flex;
                    flex-direction:column;
                    gap:0;
                    padding:20px;
                    border-radius:14px;
                    border:1px solid rgba(255,255,255,.10);
                    background:rgba(255,255,255,.035);
                    min-width:0;
                "
            >

                <!-- HEADER -->

                <div
                    style="
                        display:flex;
                        align-items:flex-start;
                        justify-content:space-between;
                        gap:12px;
                    "
                >

                    <div
                        style="
                            min-width:0;
                            flex:1;
                        "
                    >

                        <div
                            style="
                                display:flex;
                                align-items:center;
                                gap:8px;
                                flex-wrap:wrap;
                            "
                        >

                            <h3
                                style="
                                    margin:0;
                                    font-size:18px;
                                    font-weight:700;
                                    word-break:break-word;
                                "
                            >
                                ${safeProviderName}
                            </h3>

                            ${
                                isDefault
                                    ? `
                                        <span
                                            style="
                                                display:inline-flex;
                                                align-items:center;
                                                padding:4px 8px;
                                                border-radius:999px;
                                                font-size:10px;
                                                font-weight:700;
                                                background:rgba(255,193,7,.15);
                                            "
                                        >
                                            DEFAULT
                                        </span>
                                    `
                                    : ""
                            }

                        </div>

                        <div
                            style="
                                margin-top:5px;
                                font-size:12px;
                                opacity:.55;
                                word-break:break-all;
                            "
                        >
                            ID: ${safeProviderId || "-"}
                        </div>

                    </div>

                    <!-- STATUS -->

                    <span
                        class="provider-status"
                        data-provider-status="${status}"
                        style="
                            flex:none;
                            display:inline-flex;
                            align-items:center;
                            padding:5px 9px;
                            border-radius:999px;
                            font-size:11px;
                            font-weight:700;
                            ${
                                active
                                    ? `
                                        background:rgba(40,200,120,.15);
                                        color:#65e6a0;
                                    `
                                    : `
                                        background:rgba(150,150,150,.15);
                                        color:#aaa;
                                    `
                            }
                        "
                    >
                        ${
                            active
                                ? "AKTIF"
                                : "NONAKTIF"
                        }
                    </span>

                </div>

                <!-- DESCRIPTION -->

                <div
                    style="
                        margin-top:16px;
                        min-height:40px;
                        font-size:13px;
                        line-height:1.6;
                        opacity:.75;
                        word-break:break-word;
                    "
                >
                    ${
                        safeDescription ||
                        "Tidak ada deskripsi."
                    }
                </div>

                <!-- API KEY -->

                ${renderApiKeyStatus(provider)}

                <!-- META -->

                <div
                    style="
                        display:flex;
                        flex-wrap:wrap;
                        gap:12px;
                        margin-top:14px;
                        padding-top:12px;
                        border-top:1px solid rgba(255,255,255,.07);
                        font-size:11px;
                        opacity:.55;
                    "
                >

                    <span>
                        Dibuat:
                        ${formatDate(
                            provider?.created_at
                        )}
                    </span>

                    ${
                        provider?.updated_at
                            ? `
                                <span>
                                    Diubah:
                                    ${formatDate(
                                        provider.updated_at
                                    )}
                                </span>
                            `
                            : ""
                    }

                </div>

                <!-- ACTIONS -->

                <div
                    class="provider-actions"
                    style="
                        display:flex;
                        flex-wrap:wrap;
                        gap:8px;
                        margin-top:18px;
                    "
                >

                    <button
                        type="button"
                        data-provider-action="edit"
                        data-provider-id="${safeDatabaseId}"
                        style="
                            flex:1 1 auto;
                            min-width:90px;
                            display:inline-flex;
                            align-items:center;
                            justify-content:center;
                            gap:6px;
                            padding:10px 12px;
                            border:1px solid rgba(255,255,255,.14);
                            border-radius:8px;
                            background:rgba(255,255,255,.06);
                            color:inherit;
                            cursor:pointer;
                            font-size:12px;
                            font-weight:600;
                        "
                    >
                        ✏️ Edit
                    </button>

                    <button
                        type="button"
                        data-provider-action="${
                            active
                                ? "toggle"
                                : "toggle"
                        }"
                        data-provider-id="${safeDatabaseId}"
                        data-provider-status="${status}"
                        style="
                            flex:1 1 auto;
                            min-width:110px;
                            display:inline-flex;
                            align-items:center;
                            justify-content:center;
                            gap:6px;
                            padding:10px 12px;
                            border:1px solid rgba(255,255,255,.14);
                            border-radius:8px;
                            background:rgba(255,255,255,.06);
                            color:inherit;
                            cursor:pointer;
                            font-size:12px;
                            font-weight:600;
                        "
                    >
                        ${
                            active
                                ? "⏸️ Nonaktifkan"
                                : "▶️ Aktifkan"
                        }
                    </button>

                    <button
                        type="button"
                        data-provider-action="delete"
                        data-provider-id="${safeDatabaseId}"
                        style="
                            flex:1 1 auto;
                            min-width:90px;
                            display:inline-flex;
                            align-items:center;
                            justify-content:center;
                            gap:6px;
                            padding:10px 12px;
                            border:1px solid rgba(255,80,80,.25);
                            border-radius:8px;
                            background:rgba(255,60,60,.07);
                            color:inherit;
                            cursor:pointer;
                            font-size:12px;
                            font-weight:600;
                        "
                    >
                        🗑️ Hapus
                    </button>

                </div>

            </article>
        `;
    }

    // ========================================
    // RENDER LIST
    // ========================================

    function render(list) {
        const target =
            ensureContainer();

        providers =
            Array.isArray(list)
                ? [...list]
                : [];

        if (!providers.length) {
            renderEmpty();
            return;
        }

        target.innerHTML =
            providers
                .map(
                    renderProviderCard
                )
                .join("");

        // Inform other modules that
        // rendering sudah selesai.
        document.dispatchEvent(
            new CustomEvent(
                "genz:providers-rendered",
                {
                    detail: {
                        providers:
                            [...providers]
                    }
                }
            )
        );
    }

    // ========================================
    // LOAD FROM SUPABASE
    // ========================================

    async function load(
        options = {}
    ) {

        renderLoading();

        try {

            const supabase =
                getSupabase();

            let query =
                supabase
                    .from("providers")
                    .select(
                        [
                            "id",
                            "provider_id",
                            "provider_name",
                            "description",
                            "status",
                            "is_default",
                            "created_at",
                            "updated_at"
                        ].join(",")
                    )
                    .order(
                        "created_at",
                        {
                            ascending: true
                        }
                    );

            if (
                options.status
            ) {

                query =
                    query.eq(
                        "status",
                        normalizeStatus(
                            options.status
                        )
                    );
            }

            const result =
                await query;

            if (result.error) {
                throw result.error;
            }

            const data =
                Array.isArray(
                    result.data
                )
                    ? result.data
                    : [];

            render(data);

            return [
                ...data
            ];

        } catch (error) {

            console.error(
                "[GEN-Z.AI] Provider list error:",
                error
            );

            renderError(
                error
            );

            throw error;
        }
    }

    // ========================================
    // GET CACHE
    // ========================================

    function getAll() {
        return [
            ...providers
        ];
    }

    function getById(
        databaseId
    ) {

        const target =
            String(
                databaseId || ""
            );

        return (
            providers.find(
                function (provider) {
                    return (
                        String(
                            getDatabaseId(
                                provider
                            )
                        ) === target
                    );
                }
            ) || null
        );
    }

    function getByProviderId(
        providerId
    ) {

        const target =
            getProviderId(
                {
                    provider_id:
                        providerId
                }
            );

        return (
            providers.find(
                function (provider) {
                    return (
                        getProviderId(
                            provider
                        ) === target
                    );
                }
            ) || null
        );
    }

    // ========================================
    // REFRESH
    // ========================================

    async function refresh() {
        return load();
    }

    // ========================================
    // EVENT
    // ========================================

    document.addEventListener(
        "click",
        function (event) {

            const button =
                event.target.closest(
                    "[data-provider-list-action]"
                );

            if (!button) {
                return;
            }

            const action =
                button.dataset
                    .providerListAction;

            if (
                action === "reload"
            ) {
                load().catch(
                    function () {}
                );
            }
        }
    );

    // ========================================
    // PUBLIC API
    // ========================================

    window.GENZProviderList = {

        ready: true,

        load,

        refresh,

        render,

        getAll,

        getById,

        getByProviderId,

        getApiKeyStatus
    };

    console.log(
        "[GEN-Z.AI] Provider List module siap."
    );

})();
