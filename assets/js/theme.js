(() => {
    "use strict";

    if (window.__GENZ_THEME_STARTED) return;
    window.__GENZ_THEME_STARTED = true;

    const STORAGE_KEY = "genz-theme";
    const STYLE_ID = "genz-theme-style";
    let toggleButton = null;

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
                --theme-text: #202536;
                --theme-muted: #657087;
                --theme-surface: rgba(255, 255, 255, .84);
                --theme-surface-raised: rgba(255, 255, 255, .96);
                --theme-border: rgba(73, 88, 120, .15);
                --theme-shadow: 0 18px 50px rgba(52, 65, 94, .11);
                --theme-input: rgba(255, 255, 255, .88);
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
                color: var(--theme-muted);
            }

            html[data-genz-theme="light"] body :is(input, textarea, select) {
                color: var(--theme-text);
                border-color: var(--theme-border);
                background-color: var(--theme-input);
                box-shadow: inset 0 1px 2px rgba(34, 46, 70, .04);
            }

            html[data-genz-theme="light"] body :is(input, textarea, select)::placeholder {
                color: #81899b;
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

            .genz-sidebar-footer .genz-theme-toggle {
                width: 100%;
                margin-bottom: 10px;
            }

            .nav-actions .genz-theme-toggle {
                min-height: 36px;
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
                border-color: rgba(73, 88, 120, .2);
                background: rgba(255, 255, 255, .78);
                box-shadow: 0 6px 20px rgba(52, 65, 94, .1);
            }

        `;
        document.head.appendChild(style);
    }

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

    function initialize() {
        ensureStyles();
        mountToggle();

        const observer = new MutationObserver(() => {
            mountToggle();
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    applyTheme(readTheme());
    ensureStyles();

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initialize, { once: true });
    } else {
        initialize();
    }
})();
