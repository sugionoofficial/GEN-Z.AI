(function () {
    "use strict";

    let currentProviders = [];

    function getElement(id) {
        return document.getElementById(id);
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function normalizeStatus(status) {
        return String(status || "")
            .trim()
            .toLowerCase() === "active"
            ? "active"
            : "inactive";
    }

    function renderProviderCard(provider) {

        const databaseId =
            provider.id ||
            provider.uuid ||
            "";

        const providerId =
            provider.provider_id ||
            "-";

        const providerName =
            provider.provider_name ||
            providerId;

        const description =
            provider.description ||
            "Tidak ada deskripsi.";

        const status =
            normalizeStatus(
                provider.status
            );

        const statusText =
            status === "active"
                ? "AKTIF"
                : "NONAKTIF";

        // FIX UTAMA:
        // toggleClass sekarang dibuat
        // DI DALAM renderProviderCard().
        const toggleClass =
            status === "active"
                ? "provider-btn-warning"
                : "provider-btn-success";

        const toggleText =
            status === "active"
                ? "⏸️ Nonaktifkan"
                : "▶️ Aktifkan";

        const createdAt =
            provider.created_at
                ? new Date(
                    provider.created_at
                ).toLocaleString("id-ID")
                : "-";

        return `
            <article
                class="provider-card"
                data-provider-id="${escapeHtml(databaseId)}"
                style="
                    position:relative;
                    width:100%;
                    margin-bottom:16px;
                    overflow:visible;
                "
            >

                <div class="provider-card-header">

                    <div class="provider-title-area">

                        <h3 class="provider-name">
                            ${escapeHtml(providerName)}
                        </h3>

                        <div class="provider-id">
                            ID:
                            ${escapeHtml(providerId)}
                        </div>

                    </div>

                    <div
                        class="provider-status ${status}"
                        style="
                            display:inline-flex;
                            align-items:center;
                            padding:6px 10px;
                            border-radius:999px;
                            font-size:11px;
                            font-weight:800;
                        "
                    >
                        ${statusText}
                    </div>

                </div>

                <div class="provider-card-body">

                    <div class="provider-description">
                        ${escapeHtml(description)}
                    </div>

                    <div class="provider-meta">
                        Dibuat:
                        ${escapeHtml(createdAt)}
                    </div>

                    ${
                        provider.is_default
                            ? `
                                <div class="provider-default">
                                    ⭐ Provider Default
                                </div>
                            `
                            : ""
                    }

                </div>

                <!-- AKSI PROVIDER -->

                <div
                    class="provider-actions"
                    style="
                        display:flex !important;
                        flex-wrap:wrap !important;
                        gap:8px !important;

                        margin-top:18px !important;
                        padding-top:14px !important;

                        border-top:
                            1px solid
                            rgba(255,255,255,.10)
                            !important;

                        position:relative !important;
                        z-index:9999 !important;

                        visibility:visible !important;
                        opacity:1 !important;

                        pointer-events:auto !important;
                    "
                >

                    <!-- EDIT -->

                    <button
                        type="button"
                        class="
                            provider-action-btn
                            provider-btn-edit
                        "
                        data-provider-action="edit"
                        data-provider-id="${escapeHtml(databaseId)}"
                        style="
                            display:inline-flex !important;
                            align-items:center !important;
                            justify-content:center !important;

                            min-height:40px !important;

                            padding:
                                8px 16px
                                !important;

                            border-radius:
                                10px
                                !important;

                            background:
                                rgba(99,102,241,.25)
                                !important;

                            border:
                                1px solid
                                rgba(99,102,241,.65)
                                !important;

                            color:#ffffff
                                !important;

                            cursor:pointer
                                !important;

                            pointer-events:auto
                                !important;

                            visibility:visible
                                !important;

                            opacity:1
                                !important;

                            z-index:10000
                                !important;
                        "
                    >
                        ✏️ Edit
                    </button>


                    <!-- AKTIF / NONAKTIF -->

                    <button
                        type="button"
                        class="
                            provider-action-btn
                            ${toggleClass}
                        "
                        data-provider-action="toggle"
                        data-provider-id="${escapeHtml(databaseId)}"
                        style="
                            display:inline-flex !important;
                            align-items:center !important;
                            justify-content:center !important;

                            min-height:40px !important;

                            padding:
                                8px 16px
                                !important;

                            border-radius:
                                10px
                                !important;

                            ${
                                status === "active"
                                    ? `
                                        background:
                                            rgba(245,158,11,.25)
                                            !important;

                                        border:
                                            1px solid
                                            rgba(245,158,11,.65)
                                            !important;
                                    `
                                    : `
                                        background:
                                            rgba(34,197,94,.25)
                                            !important;

                                        border:
                                            1px solid
                                            rgba(34,197,94,.65)
                                            !important;
                                    `
                            }

                            color:#ffffff
                                !important;

                            cursor:pointer
                                !important;

                            pointer-events:auto
                                !important;

                            visibility:visible
                                !important;

                            opacity:1
                                !important;

                            z-index:10000
                                !important;
                        "
                    >
                        ${toggleText}
                    </button>


                    <!-- HAPUS -->

                    <button
                        type="button"
                        class="
                            provider-action-btn
                            provider-btn-delete
                        "
                        data-provider-action="delete"
                        data-provider-id="${escapeHtml(databaseId)}"
                        style="
                            display:inline-flex !important;
                            align-items:center !important;
                            justify-content:center !important;

                            min-height:40px !important;

                            padding:
                                8px 16px
                                !important;

                            border-radius:
                                10px
                                !important;

                            background:
                                rgba(239,68,68,.25)
                                !important;

                            border:
                                1px solid
                                rgba(239,68,68,.65)
                                !important;

                            color:#ffffff
                                !important;

                            cursor:pointer
                                !important;

                            pointer-events:auto
                                !important;

                            visibility:visible
                                !important;

                            opacity:1
                                !important;

                            z-index:10000
                                !important;
                        "
                    >
                        🗑️ Hapus
                    </button>

                </div>

            </article>
        `;
    }


    function renderProviders(providers) {

        currentProviders =
            Array.isArray(providers)
                ? providers
                : [];

        const container =
            getElement("providerList") ||
            getElement("providersList") ||
            getElement("providerPanel");

        if (!container) {

            console.error(
                "[GEN-Z.AI] Container provider tidak ditemukan."
            );

            return;
        }

        if (
            currentProviders.length === 0
        ) {

            renderEmptyState(
                container
            );

            updateStats([]);

            return;
        }

        container.innerHTML =
            currentProviders
                .map(
                    renderProviderCard
                )
                .join("");

        updateStats(
            currentProviders
        );
    }


    function renderEmptyState(
        container
    ) {

        container.innerHTML = `

            <div
                class="provider-empty"
                style="
                    padding:30px;
                    text-align:center;
                "
            >

                <div
                    style="
                        font-size:32px;
                        margin-bottom:10px;
                    "
                >
                    ＋
                </div>

                <h3>
                    Belum ada provider
                </h3>

                <p>
                    Tambahkan provider AI
                    untuk mulai menggunakan
                    engine GEN-Z.AI.
                </p>

            </div>

        `;
    }


    function updateStats(
        providers
    ) {

        const list =
            Array.isArray(providers)
                ? providers
                : [];

        const total =
            list.length;

        const active =
            list.filter(
                function (provider) {

                    return (
                        normalizeStatus(
                            provider.status
                        ) === "active"
                    );

                }
            ).length;

        const inactive =
            total - active;

        const defaults =
            list.filter(
                function (provider) {

                    return Boolean(
                        provider.is_default
                    );

                }
            ).length;

        setText(
            [
                "providerTotal",
                "totalProviders",
                "providersTotal"
            ],
            total
        );

        setText(
            [
                "providerActive",
                "activeProviders",
                "providersActive"
            ],
            active
        );

        setText(
            [
                "providerInactive",
                "inactiveProviders",
                "providersInactive"
            ],
            inactive
        );

        setText(
            [
                "providerDefault",
                "defaultProviders",
                "providersDefault"
            ],
            defaults
        );
    }


    function setText(
        ids,
        value
    ) {

        ids.some(
            function (id) {

                const element =
                    getElement(id);

                if (!element) {
                    return false;
                }

                element.textContent =
                    String(value);

                return true;
            }
        );
    }


    function findProvider(
        providerId
    ) {

        return (
            currentProviders.find(
                function (provider) {

                    return (
                        String(
                            provider.id ||
                            provider.uuid ||
                            ""
                        ) ===
                        String(
                            providerId
                        )
                    );

                }
            ) || null
        );
    }


    window.GENZProvidersUI = {

        renderProviders,

        renderProviderCard,

        renderEmptyState,

        updateStats,

        findProvider,

        getProviders:
            function () {
                return [
                    ...currentProviders
                ];
            }

    };

})();
