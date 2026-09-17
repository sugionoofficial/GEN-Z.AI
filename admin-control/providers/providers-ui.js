(function () {
    "use strict";

    function getProviders() {
        if (
            window.GENZProvidersData &&
            typeof window.GENZProvidersData.getProviders === "function"
        ) {
            return window.GENZProvidersData.getProviders();
        }

        return [];
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function getStatusLabel(status) {
        const value =
            String(status || "")
                .trim()
                .toLowerCase();

        if (value === "active") {
            return "Active";
        }

        if (value === "inactive") {
            return "Inactive";
        }

        if (value === "maintenance") {
            return "Maintenance";
        }

        return status || "-";
    }

    function getStatusClass(status) {
        const value =
            String(status || "")
                .trim()
                .toLowerCase();

        if (value === "active") {
            return "active";
        }

        if (value === "maintenance") {
            return "maintenance";
        }

        return "inactive";
    }

    function updateProviderStats() {
        const providers =
            getProviders();

        const total =
            providers.length;

        const active =
            providers.filter(
                provider =>
                    String(provider.status || "")
                        .trim()
                        .toLowerCase() === "active"
            ).length;

        const inactive =
            providers.filter(
                provider =>
                    String(provider.status || "")
                        .trim()
                        .toLowerCase() === "inactive"
            ).length;

        const maintenance =
            providers.filter(
                provider =>
                    String(provider.status || "")
                        .trim()
                        .toLowerCase() === "maintenance"
            ).length;

        const totalElement =
            document.getElementById(
                "totalProviders"
            );

        const activeElement =
            document.getElementById(
                "activeProviders"
            );

        const inactiveElement =
            document.getElementById(
                "inactiveProviders"
            );

        const maintenanceElement =
            document.getElementById(
                "maintenanceProviders"
            );

        if (totalElement) {
            totalElement.textContent =
                total;
        }

        if (activeElement) {
            activeElement.textContent =
                active;
        }

        if (inactiveElement) {
            inactiveElement.textContent =
                inactive;
        }

        if (maintenanceElement) {
            maintenanceElement.textContent =
                maintenance;
        }

        return {
            total,
            active,
            inactive,
            maintenance
        };
    }

    function renderEmptyState() {
        return `
            <div class="panel-header">

                <div class="panel-title">

                    <span class="panel-title-icon">
                        <svg
                            width="17"
                            height="17"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.8"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        >
                            <circle
                                cx="12"
                                cy="12"
                                r="3"
                            ></circle>

                            <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-1.9 1.9-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V22h-2.7v-.08a1.7 1.7 0 0 0-1.03-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06-1.9-1.9.06-.06A1.7 1.7 0 0 0 5.76 15a1.7 1.7 0 0 0-1.56-1.03H4v-2.7h.2A1.7 1.7 0 0 0 5.76 10a1.7 1.7 0 0 0-.34-1.88l-.06-.06 1.9-1.9.06.06A1.7 1.7 0 0 0 9.2 6.56 1.7 1.7 0 0 0 10.23 5V4h2.7v1a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06 1.9 1.9-.06.06A1.7 1.7 0 0 0 17.4 10a1.7 1.7 0 0 0 1.56 1.03H20v2.7h-1.03A1.7 1.7 0 0 0 17.4 15z"></path>
                        </svg>
                    </span>

                    <div>
                        <strong>Provider Registry</strong>
                        <span>Daftar provider AI yang terhubung</span>
                    </div>

                </div>

                <div class="panel-badge">
                    <span class="panel-badge-dot"></span>
                    Provider Control
                </div>

            </div>

            <div class="provider-empty">

                <div class="empty-icon">

                    <svg
                        width="30"
                        height="30"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                        <rect
                            x="3"
                            y="3"
                            width="18"
                            height="18"
                            rx="4"
                        ></rect>

                        <path d="M8 9h8"></path>
                        <path d="M8 13h5"></path>
                        <path d="M8 17h3"></path>
                    </svg>

                </div>

                <h3 class="empty-title">
                    Belum ada provider
                </h3>

                <p class="empty-text">
                    Provider yang ditambahkan nantinya akan muncul
                    di sini. Gunakan tombol
                    <strong>Tambah Provider</strong>
                    untuk membuat konfigurasi provider baru.
                </p>

            </div>
        `;
    }

    function renderProviderCard(provider) {
        const statusClass =
            getStatusClass(
                provider.status
            );

        const statusLabel =
            getStatusLabel(
                provider.status
            );

        const providerName =
            provider.provider_name ||
            "Provider";

        const providerId =
            provider.provider_id ||
            "-";

        const initial =
            String(providerName)
                .charAt(0)
                .toUpperCase() ||
            "P";

        const description =
            provider.description
                ? `
                    <div
                        style="
                            margin-top:5px;
                            color:#7f8998;
                            font-size:11px;
                        "
                    >
                        ${escapeHtml(
                            provider.description
                        )}
                    </div>
                `
                : "";

        const defaultBadge =
            provider.is_default
                ? `
                    <span
                        style="
                            display:inline-flex;
                            align-items:center;
                            padding:5px 8px;
                            border-radius:999px;
                            background:var(--accent-soft);
                            color:#a78bfa;
                            font-size:9px;
                            font-weight:850;
                        "
                    >
                        Default
                    </span>
                `
                : "";

        const statusBackground =
            statusClass === "active"
                ? "var(--success-soft)"
                : statusClass === "maintenance"
                    ? "var(--warning-soft)"
                    : "var(--danger-soft)";

        const statusColor =
            statusClass === "active"
                ? "var(--success)"
                : statusClass === "maintenance"
                    ? "var(--warning)"
                    : "var(--danger)";

        return `
            <article
                style="
                    padding:22px;
                    border-bottom:1px solid var(--border);
                    display:flex;
                    align-items:center;
                    justify-content:space-between;
                    gap:20px;
                    flex-wrap:wrap;
                "
            >

                <div
                    style="
                        display:flex;
                        align-items:center;
                        gap:15px;
                        min-width:0;
                    "
                >

                    <div
                        style="
                            width:46px;
                            height:46px;
                            flex:0 0 46px;
                            display:flex;
                            align-items:center;
                            justify-content:center;
                            border:1px solid rgba(139,92,246,.18);
                            border-radius:13px;
                            background:var(--accent-soft);
                            color:#a78bfa;
                            font-size:18px;
                            font-weight:900;
                        "
                    >
                        ${escapeHtml(initial)}
                    </div>

                    <div
                        style="
                            min-width:0;
                        "
                    >

                        <div
                            style="
                                display:flex;
                                align-items:center;
                                gap:9px;
                                flex-wrap:wrap;
                            "
                        >

                            <strong
                                style="
                                    font-size:14px;
                                    font-weight:850;
                                "
                            >
                                ${escapeHtml(providerName)}
                            </strong>

                            <span
                                style="
                                    display:inline-flex;
                                    align-items:center;
                                    padding:5px 8px;
                                    border-radius:999px;
                                    background:${statusBackground};
                                    color:${statusColor};
                                    font-size:9px;
                                    font-weight:850;
                                "
                            >
                                ${escapeHtml(statusLabel)}
                            </span>

                            ${defaultBadge}

                        </div>

                        <div
                            style="
                                margin-top:5px;
                                color:#697386;
                                font-size:10px;
                            "
                        >
                            ID:
                            ${escapeHtml(providerId)}
                        </div>

                        ${description}

                    </div>

                </div>

                <div
                    style="
                        color:#596477;
                        font-size:10px;
                        font-weight:700;
                    "
                >
                    ${
                        provider.is_default
                            ? "Provider default aktif"
                            : "Provider terdaftar"
                    }
                </div>

            </article>
        `;
    }

    function renderProviderRegistry() {
        const panel =
            document.querySelector(
                ".provider-panel"
            );

        if (!panel) {
            console.warn(
                "Element .provider-panel tidak ditemukan."
            );

            return;
        }

        const providers =
            getProviders();

        updateProviderStats();

        if (!providers.length) {
            panel.innerHTML =
                renderEmptyState();

            return;
        }

        const cards =
            providers
                .map(
                    provider =>
                        renderProviderCard(
                            provider
                        )
                )
                .join("");

        panel.innerHTML = `
            <div class="panel-header">

                <div class="panel-title">

                    <span class="panel-title-icon">
                        <svg
                            width="17"
                            height="17"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.8"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        >
                            <circle
                                cx="12"
                                cy="12"
                                r="3"
                            ></circle>

                            <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-1.9 1.9-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V22h-2.7v-.08a1.7 1.7 0 0 0-1.03-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06-1.9-1.9.06-.06A1.7 1.7 0 0 0 5.76 15a1.7 1.7 0 0 0-1.56-1.03H4v-2.7h.2A1.7 1.7 0 0 0 5.76 10a1.7 1.7 0 0 0-.34-1.88l-.06-.06 1.9-1.9.06.06A1.7 1.7 0 0 0 9.2 6.56 1.7 1.7 0 0 0 10.23 5V4h2.7v1a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.88-.34l-.06-.06 1.9 1.9-.06.06A1.7 1.7 0 0 0 17.4 10a1.7 1.7 0 0 0 1.56 1.03H20v2.7h-1.03A1.7 1.7 0 0 0 17.4 15z"></path>
                        </svg>
                    </span>

                    <div>
                        <strong>Provider Registry</strong>
                        <span>Daftar provider AI yang terhubung</span>
                    </div>

                </div>

                <div class="panel-badge">
                    <span class="panel-badge-dot"></span>
                    ${providers.length} Provider
                </div>

            </div>

            ${cards}
        `;
    }

    function refresh() {
        renderProviderRegistry();
    }

    window.GENZProvidersUI =
        Object.freeze({
            escapeHtml,
            getStatusLabel,
            getStatusClass,
            updateProviderStats,
            renderProviderRegistry,
            renderProviderCard,
            renderEmptyState,
            refresh
        });

    /*
     * Compatibility layer untuk providers.html lama.
     * Akan tetap tersedia selama proses migrasi.
     */

    window.updateProviderStats =
        updateProviderStats;

    window.renderProviderRegistry =
        renderProviderRegistry;

})();
