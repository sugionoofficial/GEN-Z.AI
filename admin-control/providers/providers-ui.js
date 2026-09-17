(function () {
    "use strict";

    // =========================================================
    // GEN-Z.AI - PROVIDERS UI
    // =========================================================

    let currentProviders = [];

    // ---------------------------------------------------------
    // ELEMENT HELPERS
    // ---------------------------------------------------------

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

    // ---------------------------------------------------------
    // STATUS
    // ---------------------------------------------------------

    function getStatusLabel(status) {
        return normalizeStatus(status) === "active"
            ? "Aktif"
            : "Nonaktif";
    }

    function getStatusClass(status) {
        return normalizeStatus(status) === "active"
            ? "active"
            : "inactive";
    }

    // ---------------------------------------------------------
    // PROVIDER ACTION BUTTONS
    // ---------------------------------------------------------

    function renderActions(provider) {
        const id =
            provider.id ||
            provider.uuid ||
            "";

        const status =
            normalizeStatus(
                provider.status
            );

        const toggleText =
            status === "active"
                ? "Nonaktifkan"
                : "Aktifkan";

        const toggleClass =
            status === "active"
                ? "provider-btn-warning"
                : "provider-btn-success";

        return `
            <div class="provider-actions">

                <button
                    type="button"
                    class="provider-action-btn provider-btn-edit"
                    data-provider-action="edit"
                    data-provider-id="${escapeHtml(id)}"
                >
                    Edit
                </button>

                <button
                    type="button"
                    class="provider-action-btn ${toggleClass}"
                    data-provider-action="toggle"
                    data-provider-id="${escapeHtml(id)}"
                >
                    ${toggleText}
                </button>

                <button
                    type="button"
                    class="provider-action-btn provider-btn-delete"
                    data-provider-action="delete"
                    data-provider-id="${escapeHtml(id)}"
                >
                    Hapus
                </button>

            </div>
        `;
    }

    // ---------------------------------------------------------
    // PROVIDER CARD
    // ---------------------------------------------------------

    function renderProviderCard(provider) {
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

        const statusLabel =
            getStatusLabel(status);

        const statusClass =
            getStatusClass(status);

        const isDefault =
            Boolean(
                provider.is_default
            );

        const createdAt =
            provider.created_at
                ? new Date(
                    provider.created_at
                ).toLocaleString(
                    "id-ID"
                )
                : "-";

        return `
            <article
                class="provider-card"
                data-provider-id="${escapeHtml(
                    provider.id ||
                    provider.uuid ||
                    ""
                )}"
            >

                <div class="provider-card-header">

                    <div class="provider-title-area">

                        <h3 class="provider-name">
                            ${escapeHtml(
                                providerName
                            )}
                        </h3>

                        <div class="provider-id">
                            ${escapeHtml(
                                providerId
                            )}
                        </div>

                    </div>

                    <div class="provider-status ${statusClass}">
                        ${statusLabel}
                    </div>

                </div>


                <div class="provider-card-body">

                    <div class="provider-description">
                        ${escapeHtml(
                            description
                        )}
                    </div>


                    <div class="provider-meta">

                        <span>
                            Dibuat:
                            ${escapeHtml(
                                createdAt
                            )}
                        </span>

                        ${
                            isDefault
                                ? `
                                    <span class="provider-default">
                                        Provider Default
                                    </span>
                                  `
                                : ""
                        }

                    </div>

                </div>


                ${renderActions(provider)}

            </article>
        `;
    }

    // ---------------------------------------------------------
    // RENDER PROVIDERS
    // ---------------------------------------------------------

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
            console.warn(
                "[GEN-Z.AI] Container provider tidak ditemukan."
            );

            return;
        }

        if (
            !Array.isArray(
                currentProviders
            ) ||
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

    // ---------------------------------------------------------
    // EMPTY STATE
    // ---------------------------------------------------------

    function renderEmptyState(container) {
        container.innerHTML = `
            <div class="provider-empty">

                <div class="provider-empty-icon">
                    +
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

    // ---------------------------------------------------------
    // STATS
    // ---------------------------------------------------------

    function updateStats(providers) {
        const list =
            Array.isArray(providers)
                ? providers
                : [];

        const total =
            list.length;

        const active =
            list.filter(function (provider) {
                return (
                    normalizeStatus(
                        provider.status
                    ) === "active"
                );
            }).length;

        const inactive =
            total - active;

        const defaults =
            list.filter(function (provider) {
                return Boolean(
                    provider.is_default
                );
            }).length;

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

    function setText(ids, value) {
        ids.some(function (id) {
            const element =
                getElement(id);

            if (!element) {
                return false;
            }

            element.textContent =
                String(value);

            return true;
        });
    }

    // ---------------------------------------------------------
    // FIND PROVIDER
    // ---------------------------------------------------------

    function findProvider(providerId) {
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

    // ---------------------------------------------------------
    // PUBLIC API
    // ---------------------------------------------------------

    window.GENZProvidersUI = {

        renderProviders,

        renderProviderCard,

        renderEmptyState,

        updateStats,

        findProvider,

        getProviders: function () {
            return [
                ...currentProviders
            ];
        }

    };

})();
