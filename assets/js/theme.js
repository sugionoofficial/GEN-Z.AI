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
            html[data-genz-theme="light"] {
                color-scheme: dark;
                filter: invert(1) hue-rotate(180deg);
            }

            html[data-genz-theme="light"] img,
            html[data-genz-theme="light"] video,
            html[data-genz-theme="light"] canvas,
            html[data-genz-theme="light"] iframe {
                filter: invert(1) hue-rotate(180deg);
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
