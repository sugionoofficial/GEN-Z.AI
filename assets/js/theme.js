(() => {
    "use strict";

    if (window.__GENZ_THEME_STARTED) return;
    window.__GENZ_THEME_STARTED = true;

    const STORAGE_KEY = "genz-theme";
    const STYLE_ID = "genz-theme-style";
    let toggleButton = null;
    let refreshButton = null;
    let appDownloadButton = null;
    let announcementCheckRunning = false;
    let announcementPollTimer = null;
    let announcementBodyOverflow = null;
    let dismissedAnnouncementVersion = null;
    const isNativeApp = Boolean(window.Capacitor?.Plugins);
    const hasAndroidDownloadBridge = Boolean(window.GENZAndroidDownloads);

    if (isNativeApp) {
        document.documentElement.dataset.genzApp = "true";
    }

    function reportStorageError(action, error) {
        console.error(`[GEN-Z.AI] Unable to ${action} theme preference:`, error);
    }

    function readTheme() {
        try {
            const savedTheme = localStorage.getItem(STORAGE_KEY);
            return savedTheme === "light" || savedTheme === "dark"
                ? savedTheme
                : "dark";
        } catch (error) {
            reportStorageError("read", error);
            return "dark";
        }
    }

    function applyTheme(theme, persist = false) {
        document.documentElement.dataset.genzTheme = theme;

        if (toggleButton) {
            const isLight = theme === "light";
            toggleButton.textContent = isLight ? "Mode gelap" : "Mode cerah";
            toggleButton.dataset.themeIcon = isLight ? "☾" : "☼";
            toggleButton.setAttribute("aria-pressed", String(isLight));
            toggleButton.setAttribute(
                "aria-label",
                isLight ? "Aktifkan mode gelap" : "Aktifkan mode cerah"
            );
        }

        if (!persist) return;

        try {
            localStorage.setItem(STORAGE_KEY, theme);
        } catch (error) {
            reportStorageError("save", error);
        }
    }

    function ensureStyles() {
        if (document.getElementById(STYLE_ID)) return;

        const style = document.createElement("style");
        style.id = STYLE_ID;
        style.textContent = `
            html {
                color-scheme: dark;
                --theme-page: #090a10;
                --theme-text: #f5f6fb;
                --theme-muted: #a0a5b5;
                --theme-surface: rgba(19, 21, 31, .84);
                --theme-surface-raised: rgba(27, 29, 41, .94);
                --theme-border: rgba(255, 255, 255, .09);
                --theme-shadow: 0 18px 55px rgba(0, 0, 0, .28);
                --theme-input: rgba(6, 8, 14, .78);
            }

            html[data-genz-theme="dark"] body {
                color: var(--theme-text);
                background:
                    radial-gradient(ellipse at 8% 0%, rgba(255, 48, 72, .14), transparent 34%),
                    radial-gradient(ellipse at 94% 8%, rgba(97, 82, 190, .12), transparent 32%),
                    radial-gradient(ellipse at 50% 100%, rgba(19, 91, 120, .09), transparent 42%),
                    linear-gradient(145deg, #11131c 0%, #090a10 48%, #06070b 100%) !important;
                background-attachment: fixed !important;
            }

            html[data-genz-theme="light"] {
                color-scheme: light;
                --theme-page: #f3f5fb;
                --theme-text: #172033;
                --theme-muted: #4b5870;
                --theme-surface: #ffffff;
                --theme-surface-raised: #f8f9fd;
                --theme-border: #7c8aa0;
                --theme-shadow: 0 16px 38px rgba(40, 54, 82, .13);
                --theme-input: #ffffff;
            }

            html[data-genz-theme="light"] body {
                color: var(--theme-text);
                background:
                    radial-gradient(ellipse at 7% 0%, rgba(255, 48, 72, .10), transparent 34%),
                    radial-gradient(ellipse at 94% 8%, rgba(107, 117, 221, .15), transparent 34%),
                    radial-gradient(ellipse at 52% 100%, rgba(75, 172, 190, .10), transparent 42%),
                    linear-gradient(145deg, #fff 0%, #f1f3fa 48%, #e9edf6 100%) !important;
                background-attachment: fixed !important;
            }

            html[data-genz-theme="dark"] body :is(
                .card, .panel, .modal, .stat-card, .feature-card, .form-card,
                .vision-video-card, .vision-card, .parameter-card, .credit-card,
                .provider-stat-card, .metadata-panel, .payment-method,
                .requirement, .workflow-step
            ),
            html[data-genz-theme="light"] body :is(
                .card, .panel, .modal, .stat-card, .feature-card, .form-card,
                .vision-video-card, .vision-card, .parameter-card, .credit-card,
                .provider-stat-card, .metadata-panel, .payment-method,
                .requirement, .workflow-step
            ) {
                color: var(--theme-text);
                border-color: var(--theme-border);
                background-color: var(--theme-surface);
                box-shadow: var(--theme-shadow);
                backdrop-filter: blur(18px);
                -webkit-backdrop-filter: blur(18px);
            }

            html[data-genz-theme="light"] body :is(
                .card, .panel, .modal, .stat-card, .feature-card, .form-card,
                .vision-video-card, .vision-card, .parameter-card, .credit-card,
                .provider-stat-card, .metadata-panel, .payment-method,
                .requirement, .workflow-step
            ) {
                border-style: solid;
                border-width: 1px;
            }

            html[data-genz-theme="light"] body :is(
                .card-header, .panel-header, .modal-header, .page-header,
                .toolbar, .info-row
            ) {
                color: var(--theme-text);
                border-color: #a7b2c4;
                background-color: #edf1f8;
            }

            html[data-genz-theme="light"] body :is(
                h1, h2, h3, h4, h5, p, li, label, th, td,
                .card-title, .panel-title, .stat-label, .stat-value,
                .field-label, .form-label, .info-label, .info-value,
                .section-title, .section-description, .page-title,
                .page-subtitle, .subtitle, .description, .eyebrow
            ) {
                color: var(--theme-text);
            }

            html[data-genz-theme="light"] body :is(
                .stat-label, .field-label, .form-label, .info-label,
                .section-description, .page-subtitle, .subtitle,
                .description, .eyebrow, small, .muted
            ) {
                color: var(--theme-muted) !important;
            }

            html[data-genz-theme="light"] body :is(input, textarea, select) {
                color: var(--theme-text);
                border: 1px solid #8291a7;
                background-color: var(--theme-input);
                box-shadow: inset 0 1px 2px rgba(34, 46, 70, .04);
            }

            html[data-genz-theme="light"] body :is(input, textarea, select):focus {
                border-color: #596fa8;
                outline: 3px solid rgba(89, 111, 168, .2);
            }

            html[data-genz-theme="light"] body :is(input, textarea, select)::placeholder {
                color: #59657a;
            }

            html[data-genz-theme="light"] body :is(
                .genz-sidebar, .genz-mobile-toggle
            ) {
                color: var(--theme-text);
                border-color: var(--theme-border);
                background: var(--theme-surface-raised);
                box-shadow: var(--theme-shadow);
            }

            html[data-genz-theme="light"] body :is(
                .genz-sidebar .genz-logo-text, .genz-sidebar .genz-nav-label,
                .genz-sidebar .genz-account-email
            ) {
                color: var(--theme-text);
            }

            .genz-theme-toggle {
                min-height: 38px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 7px;
                padding: 8px 11px;
                border: 1px solid rgba(255, 255, 255, .16);
                border-radius: 9px;
                color: #fff;
                background: rgba(255, 255, 255, .04);
                font: inherit;
                font-size: 11px;
                font-weight: 700;
                white-space: nowrap;
                cursor: pointer;
            }

            .genz-theme-toggle:hover {
                border-color: rgba(255, 48, 72, .5);
                background: rgba(255, 48, 72, .1);
            }

            .genz-refresh-button {
                min-height: 38px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                padding: 8px 11px;
                border: 1px solid rgba(255, 255, 255, .16);
                border-radius: 9px;
                color: #fff;
                background: rgba(255, 255, 255, .04);
                font: inherit;
                font-size: 18px;
                font-weight: 700;
                line-height: 1;
                cursor: pointer;
            }

            .genz-refresh-button:hover {
                border-color: rgba(255, 48, 72, .5);
                background: rgba(255, 48, 72, .1);
            }

            .genz-announcement-overlay {
                position: fixed;
                inset: 0;
                z-index: 10050;
                display: grid;
                place-items: center;
                padding: 22px;
                background: rgba(3, 5, 12, .58);
                backdrop-filter: blur(5px);
                -webkit-backdrop-filter: blur(5px);
            }

            .genz-announcement-frame {
                position: relative;
                isolation: isolate;
                overflow: hidden;
                width: min(100%, 520px);
                max-height: min(82vh, 720px);
                padding: 2px;
                border-radius: 26px;
                box-shadow: 0 24px 90px rgba(0, 0, 0, .34);
            }

            .genz-announcement-frame::before {
                position: absolute;
                z-index: 0;
                inset: -75%;
                background: conic-gradient(
                    #ff5378,
                    #ffb84d,
                    #f5ed69,
                    #42e3b3,
                    #51b7ff,
                    #a77aff,
                    #f35dce,
                    #ff5378
                );
                content: "";
                animation: genz-announcement-neon 9s linear infinite;
                will-change: transform;
            }

            .genz-announcement-dialog {
                position: relative;
                z-index: 1;
                overflow: hidden;
                width: 100%;
                max-height: min(calc(82vh - 4px), 716px);
                overflow-y: auto;
                padding: 30px;
                border: 0;
                border-radius: 23px;
                color: #f5f6fb;
                background:
                    radial-gradient(ellipse at 100% 0%, rgba(128, 111, 255, .2), transparent 50%),
                    linear-gradient(145deg, #1c1e2e, #0e111b 78%);
                box-shadow: 0 30px 110px rgba(0, 0, 0, .58), inset 0 1px rgba(255, 255, 255, .08);
                animation: genz-announcement-enter .28s ease-out both;
            }

            .genz-announcement-dialog::before {
                position: absolute;
                top: 0;
                left: 30px;
                width: 72px;
                height: 2px;
                background: linear-gradient(90deg, #b6a8ff, transparent);
                content: "";
            }

            .genz-announcement-kicker {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                padding: 7px 10px;
                border: 1px solid rgba(153, 140, 255, .24);
                border-radius: 999px;
                color: #c9c1ff;
                background: rgba(117, 97, 255, .1);
                font-size: 10px;
                font-weight: 800;
                letter-spacing: .09em;
                text-transform: uppercase;
            }

            .genz-announcement-dialog[data-category="maintenance"] .genz-announcement-kicker {
                border-color: rgba(255, 173, 83, .28);
                color: #ffc986;
                background: rgba(255, 158, 61, .09);
            }

            .genz-announcement-dialog[data-category="important"] .genz-announcement-kicker {
                border-color: rgba(255, 88, 112, .3);
                color: #ff9eae;
                background: rgba(255, 60, 90, .1);
            }

            .genz-announcement-dialog[data-category="feature"] .genz-announcement-kicker {
                border-color: rgba(73, 219, 178, .27);
                color: #93e6cb;
                background: rgba(50, 196, 155, .09);
            }

            .genz-announcement-title {
                margin: 20px 0 12px;
                color: #fff;
                font-size: clamp(24px, 5vw, 32px);
                line-height: 1.2;
                letter-spacing: -.04em;
                overflow-wrap: anywhere;
            }

            .genz-announcement-message {
                margin: 0;
                color: #b1b8ca;
                font-size: 14px;
                line-height: 1.8;
                white-space: pre-wrap;
                overflow-wrap: anywhere;
            }

            .genz-announcement-footer {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 14px;
                margin-top: 26px;
                padding-top: 18px;
                border-top: 1px solid rgba(154, 165, 197, .14);
            }

            .genz-announcement-brand {
                color: #858da3;
                font-size: 10px;
                font-weight: 700;
                letter-spacing: .03em;
            }

            .genz-announcement-ok {
                min-height: 42px;
                padding: 0 18px;
                border: 1px solid rgba(177, 166, 255, .5);
                border-radius: 12px;
                color: #fff;
                background: linear-gradient(135deg, #8172ff, #6355d9);
                font: inherit;
                font-size: 12px;
                font-weight: 800;
                box-shadow: 0 8px 24px rgba(97, 80, 224, .24), inset 0 1px rgba(255, 255, 255, .18);
                cursor: pointer;
            }

            .genz-announcement-ok:hover {
                filter: brightness(1.12);
            }

            html[data-genz-theme="light"] .genz-announcement-dialog {
                color: #172033;
                border-color: #aeb7d0;
                background:
                    radial-gradient(ellipse at 100% 0%, rgba(128, 111, 255, .13), transparent 50%),
                    linear-gradient(145deg, #fff, #f3f5fb 78%);
                box-shadow: 0 30px 90px rgba(32, 44, 70, .28);
            }

            html[data-genz-theme="light"] .genz-announcement-title {
                color: #172033;
            }

            html[data-genz-theme="light"] .genz-announcement-message {
                color: #4b5870;
            }

            @keyframes genz-announcement-enter {
                from { opacity: 0; transform: translateY(12px) scale(.98); }
                to { opacity: 1; transform: translateY(0) scale(1); }
            }

            @keyframes genz-announcement-neon {
                to { transform: rotate(1turn); }
            }

            @media (max-width: 540px) {
                .genz-announcement-overlay { padding: 16px; }
                .genz-announcement-frame { border-radius: 22px; }
                .genz-announcement-dialog { padding: 24px 21px; border-radius: 20px; }
                .genz-announcement-dialog::before { left: 21px; }
                .genz-announcement-message { font-size: 13px; }
            }

            @media (prefers-reduced-motion: reduce) {
                .genz-announcement-dialog { animation: none; }
            }

            .genz-sidebar-footer .genz-theme-toggle {
                width: 100%;
                margin-bottom: 10px;
            }

            .genz-sidebar-footer.genz-has-refresh-control .genz-theme-toggle,
            .genz-sidebar-footer.genz-has-refresh-control .genz-refresh-button {
                width: calc(50% - 4px);
                margin-bottom: 10px;
            }

            .genz-sidebar-footer.genz-has-refresh-control .genz-theme-toggle {
                margin-right: 8px;
            }

            .genz-app-download {
                min-height: 38px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 7px;
                padding: 8px 11px;
                border: 1px solid rgba(255, 48, 72, .32);
                border-radius: 9px;
                color: #fff;
                background: rgba(255, 48, 72, .08);
                font: inherit;
                font-size: 11px;
                font-weight: 700;
                text-align: center;
                text-decoration: none;
                white-space: nowrap;
            }

            .genz-app-download:hover {
                border-color: rgba(255, 48, 72, .6);
                background: rgba(255, 48, 72, .16);
            }

            .genz-sidebar-footer .genz-app-download {
                width: 100%;
                margin-bottom: 10px;
            }

            html[data-genz-theme="light"] .genz-app-download {
                color: #283047;
                border-color: #cf8a98;
                background: #fff;
                box-shadow: 0 6px 20px rgba(52, 65, 94, .1);
            }

            .nav-actions .genz-theme-toggle {
                min-height: 36px;
            }

            html[data-genz-app="true"] .navbar .nav-actions {
                gap: 6px;
            }

            html[data-genz-app="true"] .navbar .nav-actions .genz-refresh-button {
                min-height: 40px;
                width: 40px;
                padding: 8px;
                border-radius: 10px;
            }

            @media (max-width: 760px) {
                html[data-genz-app="true"] .navbar .nav-actions {
                    grid-template-columns: repeat(5, minmax(0, 1fr));
                }

                html[data-genz-app="true"] .navbar .nav-actions .genz-refresh-button {
                    width: 100%;
                    font-size: 18px;
                }
            }

            @media (max-width: 760px) {
                .nav-actions .genz-theme-toggle {
                    width: 36px;
                    padding: 8px;
                    font-size: 0;
                }

                .nav-actions .genz-theme-toggle::before {
                    content: attr(data-theme-icon);
                    font-size: 17px;
                }
            }

            @media (max-width: 360px) {
                .nav-actions .genz-theme-toggle {
                    width: 32px;
                }
            }

            .genz-theme-toggle-floating {
                position: fixed;
                top: 12px;
                right: 12px;
                z-index: 10002;
                box-shadow: 0 4px 18px rgba(0, 0, 0, .25);
            }

            html[data-genz-theme="light"] .genz-theme-toggle {
                color: #283047;
                border-color: #aab6c9;
                background: #fff;
                box-shadow: 0 6px 20px rgba(52, 65, 94, .14);
            }

            html[data-genz-theme="light"] .genz-refresh-button {
                color: #283047;
                border-color: #aab6c9;
                background: #fff;
                box-shadow: 0 6px 20px rgba(52, 65, 94, .14);
            }

        `;
        document.head.appendChild(style);
    }

    function initializePwaSupport() {
        if (!document.head) return;

        if (!document.querySelector('link[rel="manifest"]')) {
            const manifest = document.createElement("link");
            manifest.rel = "manifest";
            manifest.href = "/manifest.webmanifest";
            document.head.appendChild(manifest);
        }

        if (!("serviceWorker" in navigator)) return;

        navigator.serviceWorker
            .register("/service-worker.js")
            .catch(error => {
                console.error("[GEN-Z.AI] Unable to register PWA service worker:", error);
            });
    }

    async function saveBlobInAndroid(blob, fileName) {
        if (!hasAndroidDownloadBridge || !(blob instanceof Blob)) return null;

        const bridge = window.GENZAndroidDownloads;
        const id = bridge.beginBlobDownload(
            fileName || "GEN-Z.AI-download",
            blob.type || "application/octet-stream"
        );
        if (!id) return false;

        try {
            const chunkSize = 48 * 1024;
            for (let offset = 0; offset < blob.size; offset += chunkSize) {
                const end = Math.min(offset + chunkSize, blob.size);
                const bytes = new Uint8Array(
                    await blob.slice(offset, end).arrayBuffer()
                );
                let binary = "";
                for (let index = 0; index < bytes.length; index += 1) {
                    binary += String.fromCharCode(bytes[index]);
                }
                if (!bridge.writeBlobChunk(id, window.btoa(binary))) {
                    throw new Error("Android gagal menerima isi file unduhan.");
                }
            }

            if (!bridge.finishBlobDownload(id)) {
                throw new Error("Android gagal menyimpan file unduhan.");
            }
            return true;
        } catch (error) {
            bridge.cancelBlobDownload(id);
            console.error("[GEN-Z.AI] Android file download failed:", error);
            return false;
        }
    }

    window.GENZMobileDownload = saveBlobInAndroid;

    document.addEventListener("click", event => {
        if (
            !isNativeApp ||
            !hasAndroidDownloadBridge ||
            event.defaultPrevented ||
            event.button !== 0
        ) {
            return;
        }

        const target = event.target instanceof Element
            ? event.target
            : event.target?.parentElement;
        const link = target?.closest("a[download]");
        if (!link) return;

        event.preventDefault();
        if (/^(blob:|data:)/i.test(link.href)) {
            void fetch(link.href)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Gagal membaca file unduhan (HTTP ${response.status}).`);
                    }
                    return response.blob();
                })
                .then(blob => saveBlobInAndroid(blob, link.download))
                .then(saved => {
                    if (saved !== true) {
                        throw new Error("File tidak berhasil disimpan di perangkat.");
                    }
                })
                .catch(error => {
                    console.error("[GEN-Z.AI] Android file download failed:", error);
                    window.GENZAndroidDownloads.notifyDownloadFailure();
                });
            return;
        }

        if (/^https?:/i.test(link.href)) {
            window.GENZAndroidDownloads.downloadUrl(
                link.href,
                link.download,
                link.type || "",
                window.location.href,
                navigator.userAgent
            );
        }
    }, true);

    function getToggleParent() {
        return (
            document.querySelector(".genz-sidebar-footer") ||
            document.querySelector(".nav-actions") ||
            document.body
        );
    }

    function mountToggle() {
        if (!document.body) return;

        const parent = getToggleParent();

        if (!toggleButton) {
            toggleButton = document.createElement("button");
            toggleButton.type = "button";
            toggleButton.className = "genz-theme-toggle";
            toggleButton.addEventListener("click", () => {
                const nextTheme =
                    document.documentElement.dataset.genzTheme === "light"
                        ? "dark"
                        : "light";
                applyTheme(nextTheme, true);
            });
            applyTheme(document.documentElement.dataset.genzTheme || "dark");
        }

        toggleButton.classList.toggle(
            "genz-theme-toggle-floating",
            parent === document.body
        );

        if (toggleButton.parentElement !== parent) {
            if (parent.classList.contains("genz-sidebar-footer")) {
                parent.prepend(toggleButton);
            } else if (parent.classList.contains("nav-actions")) {
                parent.prepend(toggleButton);
            } else {
                parent.append(toggleButton);
            }
        }
    }

    function mountRefreshButton() {
        if (!isNativeApp || !document.body) return;

        const parent = getToggleParent();
        if (parent === document.body) return;

        if (!refreshButton) {
            refreshButton = document.createElement("button");
            refreshButton.type = "button";
            refreshButton.className = "genz-refresh-button";
            refreshButton.textContent = "↻";
            refreshButton.setAttribute("aria-label", "Refresh halaman");
            refreshButton.title = "Refresh halaman";
            refreshButton.addEventListener("click", () => {
                window.location.reload();
            });
        }

        parent.classList.add("genz-has-refresh-control");
        if (refreshButton.parentElement !== parent) {
            parent.insertBefore(refreshButton, toggleButton?.nextSibling || parent.firstChild);
        } else if (refreshButton.previousElementSibling !== toggleButton) {
            parent.insertBefore(refreshButton, toggleButton?.nextSibling || parent.firstChild);
        }
    }

    function mountAppDownload() {
        if (!document.body) return;

        const parent = getToggleParent();
        if (parent === document.body) return;

        if (!appDownloadButton) {
            appDownloadButton = document.createElement("a");
            appDownloadButton.className = "genz-app-download";
            appDownloadButton.href = "/assets/downloads/genzai-android.apk";
            appDownloadButton.download = "GEN-Z.AI-Android.apk";
            appDownloadButton.textContent = "↓ Unduh Aplikasi Android";
            appDownloadButton.setAttribute(
                "aria-label",
                "Unduh aplikasi GEN-Z.AI untuk Android"
            );
        }

        if (appDownloadButton.parentElement !== parent) {
            if (parent.classList.contains("genz-sidebar-footer")) {
                const accountBox =
                    parent.querySelector(".genz-account-box");

                parent.insertBefore(appDownloadButton, accountBox);
            } else {
                parent.append(appDownloadButton);
            }
        } else if (
            parent.classList.contains("genz-sidebar-footer") &&
            appDownloadButton.previousElementSibling !== (refreshButton || toggleButton)
        ) {
            parent.insertBefore(
                appDownloadButton,
                refreshButton?.nextSibling || toggleButton?.nextSibling || parent.firstChild
            );
        }
    }

    function showAnnouncement(announcement, userId) {
        if (!announcement || !userId || !announcement.id) return;

        const storageKey = `genz-announcement-dismissed:${userId}`;
        const announcementVersion =
            `${announcement.id}:${announcement.updated_at || ""}`;
        if (dismissedAnnouncementVersion === announcementVersion) return;

        try {
            if (localStorage.getItem(storageKey) === announcementVersion) return;
        } catch (error) {
            reportStorageError("read announcement dismissal for", error);
        }

        const currentOverlay = document.querySelector(".genz-announcement-overlay");
        if (currentOverlay?.dataset.announcementVersion === announcementVersion) return;
        currentOverlay?.remove();
        const categoryLabels = {
            info: "Informasi umum",
            feature: "Fitur baru",
            maintenance: "Pemeliharaan",
            important: "Penting"
        };
        const overlay = document.createElement("div");
        overlay.className = "genz-announcement-overlay";
        overlay.dataset.announcementVersion = announcementVersion;
        const frame = document.createElement("div");
        frame.className = "genz-announcement-frame";
        const dialog = document.createElement("section");
        dialog.className = "genz-announcement-dialog";
        dialog.dataset.category = announcement.category || "info";
        dialog.setAttribute("role", "dialog");
        dialog.setAttribute("aria-modal", "true");
        dialog.setAttribute("aria-labelledby", "genz-announcement-title");

        const kicker = document.createElement("span");
        kicker.className = "genz-announcement-kicker";
        kicker.textContent = categoryLabels[announcement.category] || categoryLabels.info;

        const title = document.createElement("h2");
        title.className = "genz-announcement-title";
        title.id = "genz-announcement-title";
        title.textContent = announcement.title;

        const message = document.createElement("p");
        message.className = "genz-announcement-message";
        message.textContent = announcement.message;

        const footer = document.createElement("div");
        footer.className = "genz-announcement-footer";
        const brand = document.createElement("span");
        brand.className = "genz-announcement-brand";
        brand.textContent = "GEN-Z.AI · Informasi resmi";
        const okButton = document.createElement("button");
        okButton.className = "genz-announcement-ok";
        okButton.type = "button";
        okButton.textContent = "OK, saya mengerti";

        okButton.addEventListener("click", () => {
            dismissedAnnouncementVersion = announcementVersion;
            try {
                localStorage.setItem(storageKey, announcementVersion);
            } catch (error) {
                reportStorageError("save announcement dismissal for", error);
            }
            document.body.style.overflow = announcementBodyOverflow || "";
            announcementBodyOverflow = null;
            overlay.remove();
        });

        footer.append(brand, okButton);
        dialog.append(kicker, title, message, footer);
        frame.append(dialog);
        overlay.append(frame);
        if (announcementBodyOverflow === null) {
            announcementBodyOverflow = document.body.style.overflow;
        }
        document.body.append(overlay);
        document.body.style.overflow = "hidden";
        okButton.focus();
    }

    window.addEventListener("genz-announcement-published", event => {
        showAnnouncement(
            event.detail,
            window.GENZ_NAVIGATION_USER?.id
        );
    });

    async function loadAnnouncement() {
        if (
            announcementCheckRunning ||
            !document.querySelector(".genz-sidebar-footer")
        ) {
            return;
        }

        const client = window.GENZ_SUPABASE || window.supabaseClient;
        if (!client?.auth?.getSession) return;

        announcementCheckRunning = true;
        try {
            const { data, error } = await client.auth.getSession();
            if (error) throw error;
            const session = data?.session;
            if (!session?.access_token || !session.user?.id) return;

            const response = await fetch("/api/announcements", {
                cache: "no-store",
                headers: { Authorization: `Bearer ${session.access_token}` }
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok || result.success !== true) {
                throw new Error(result.error || `HTTP ${response.status}`);
            }
            showAnnouncement(result.announcement, result.user_id || session.user.id);
        } catch (error) {
            console.error("[GEN-Z.AI] Failed to load account announcement:", error);
        } finally {
            announcementCheckRunning = false;
        }
    }

    function startAnnouncementPolling() {
        if (
            announcementPollTimer ||
            !document.querySelector(".genz-sidebar-footer")
        ) {
            return;
        }
        announcementPollTimer = window.setInterval(() => {
            if (document.visibilityState === "visible") {
                void loadAnnouncement();
            }
        }, 5_000);
        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible") {
                void loadAnnouncement();
            }
        });
    }

    function initialize() {
        ensureStyles();
        mountToggle();
        mountRefreshButton();
        mountAppDownload();
        loadAnnouncement();
        startAnnouncementPolling();

        const observer = new MutationObserver(() => {
            mountToggle();
            mountRefreshButton();
            mountAppDownload();
            loadAnnouncement();
            startAnnouncementPolling();
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    applyTheme(readTheme());
    ensureStyles();
    initializePwaSupport();

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initialize, { once: true });
    } else {
        initialize();
    }
})();
