/* =========================================================
   GEN-Z.AI
   GENZ TOAST — NOTIFIKASI RINGAN (TANPA DEPENDENSI)
   ---------------------------------------------------------
   File: assets/js/genz-toast.js

   Dipakai halaman yang butuh umpan balik jelas setelah aksi
   pengguna, contohnya tombol "Download" di halaman History:
   sebelumnya tombol hanya berubah teks sebentar sehingga
   pengguna tidak tahu apakah unduhan berhasil atau gagal.

   API:
     GENZToast.show("Pesan", { type: "success" })
     GENZToast.success("Berhasil diunduh", { description: "nama.mp4" })
     GENZToast.error("Gagal mengunduh", { actionLabel: "Coba lagi", onAction })
     GENZToast.info("Menyiapkan unduhan…", { key: "download", duration: 0 })
     GENZToast.dismiss(id) / GENZToast.dismissAll()

   Aturan penting:
   - Tanpa node:*, tanpa import eksternal (aman dibundel browser).
   - Memakai `key` yang sama akan MENGGANTI toast yang masih
     tampil, jadi status "Menyiapkan…" bisa berubah menjadi
     "Berhasil" tanpa menumpuk dua notifikasi.
   - Aksesibel: role status/alert + aria-live, tombol tutup
     berlabel, dan mode cerah/gelap mengikuti data-genz-theme.
   - Menghormati prefers-reduced-motion.
========================================================= */

(function () {
    "use strict";

    if (window.GENZToast) return;

    const STYLE_ID = "genz-toast-style";
    const CONTAINER_ID = "genz-toast-container";

    const DEFAULT_DURATION = {
        success: 5200,
        info: 4200,
        error: 0
    };

    /* key -> { id, timer, element } */
    const activeToasts = new Map();
    let toastSeed = 0;

    const ICONS = {
        success: "✓",
        error: "!",
        info: "i"
    };

    const TITLES = {
        success: "BERHASIL",
        error: "GAGAL",
        info: "INFO"
    };

    function normalizeType(type) {
        const value = String(type || "").trim().toLowerCase();
        if (value === "success" || value === "error" || value === "info") {
            return value;
        }
        return "info";
    }

    function ensureStyles() {
        if (document.getElementById(STYLE_ID)) return;

        const style = document.createElement("style");
        style.id = STYLE_ID;
        style.textContent = `
            #${CONTAINER_ID} {
                position: fixed;
                z-index: 100000;
                right: 18px;
                bottom: calc(18px + env(safe-area-inset-bottom, 0px));
                display: flex;
                flex-direction: column;
                gap: 10px;
                width: min(380px, calc(100vw - 32px));
                pointer-events: none;
            }

            .genz-toast {
                position: relative;
                overflow: hidden;
                pointer-events: auto;
                display: grid;
                grid-template-columns: 34px 1fr auto;
                align-items: start;
                gap: 10px;
                padding: 12px 12px 13px 13px;
                border: 1px solid rgba(255, 255, 255, .12);
                border-radius: 14px;
                background: rgba(11, 13, 18, .97);
                box-shadow: 0 18px 46px rgba(0, 0, 0, .55);
                color: #f4f7f5;
                font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
                backdrop-filter: blur(14px);
                -webkit-backdrop-filter: blur(14px);
                animation: genz-toast-in .22s cubic-bezier(.22, .8, .3, 1);
            }

            .genz-toast.is-leaving {
                animation: genz-toast-out .18s ease forwards;
            }

            @keyframes genz-toast-in {
                from { opacity: 0; transform: translateY(12px) scale(.985); }
                to   { opacity: 1; transform: translateY(0) scale(1); }
            }

            @keyframes genz-toast-out {
                from { opacity: 1; transform: translateY(0); }
                to   { opacity: 0; transform: translateY(8px); }
            }

            .genz-toast-icon {
                display: grid;
                place-items: center;
                width: 34px;
                height: 34px;
                border-radius: 10px;
                font-size: 15px;
                font-weight: 900;
                line-height: 1;
            }

            .genz-toast-body {
                min-width: 0;
                padding-top: 1px;
            }

            .genz-toast-kicker {
                display: block;
                margin-bottom: 3px;
                font-size: 9px;
                font-weight: 800;
                letter-spacing: .16em;
                text-transform: uppercase;
            }

            .genz-toast-title {
                display: block;
                font-size: 12.5px;
                font-weight: 800;
                line-height: 1.4;
                word-break: break-word;
            }

            .genz-toast-desc {
                display: block;
                margin-top: 3px;
                font-size: 11px;
                font-weight: 500;
                line-height: 1.5;
                color: rgba(232, 240, 235, .62);
                word-break: break-word;
            }

            .genz-toast-action {
                margin-top: 8px;
                padding: 6px 11px;
                border: 1px solid rgba(255, 255, 255, .22);
                border-radius: 8px;
                background: rgba(255, 255, 255, .07);
                color: inherit;
                font: inherit;
                font-size: 10.5px;
                font-weight: 800;
                letter-spacing: .08em;
                text-transform: uppercase;
                cursor: pointer;
            }

            .genz-toast-action:hover,
            .genz-toast-action:focus-visible {
                background: rgba(255, 255, 255, .14);
            }

            .genz-toast-close {
                display: grid;
                place-items: center;
                width: 24px;
                height: 24px;
                margin-top: -2px;
                border: 0;
                border-radius: 7px;
                background: transparent;
                color: rgba(255, 255, 255, .45);
                font: inherit;
                font-size: 16px;
                line-height: 1;
                cursor: pointer;
            }

            .genz-toast-close:hover,
            .genz-toast-close:focus-visible {
                background: rgba(255, 255, 255, .1);
                color: #fff;
            }

            .genz-toast-bar {
                position: absolute;
                left: 0;
                bottom: 0;
                height: 2px;
                width: 100%;
                transform-origin: left center;
                opacity: .85;
            }

            /* SUCCESS */
            .genz-toast[data-type="success"] {
                border-color: rgba(57, 255, 113, .34);
            }
            .genz-toast[data-type="success"] .genz-toast-icon {
                background: rgba(57, 255, 113, .14);
                color: #39ff71;
            }
            .genz-toast[data-type="success"] .genz-toast-kicker {
                color: #39ff71;
            }
            .genz-toast[data-type="success"] .genz-toast-bar {
                background: #39ff71;
            }

            /* ERROR */
            .genz-toast[data-type="error"] {
                border-color: rgba(255, 77, 79, .38);
            }
            .genz-toast[data-type="error"] .genz-toast-icon {
                background: rgba(255, 77, 79, .16);
                color: #ff6b6d;
            }
            .genz-toast[data-type="error"] .genz-toast-kicker {
                color: #ff6b6d;
            }
            .genz-toast[data-type="error"] .genz-toast-bar {
                background: #ff4d4f;
            }

            /* INFO */
            .genz-toast[data-type="info"] {
                border-color: rgba(120, 170, 255, .32);
            }
            .genz-toast[data-type="info"] .genz-toast-icon {
                background: rgba(120, 170, 255, .14);
                color: #9cc4ff;
            }
            .genz-toast[data-type="info"] .genz-toast-kicker {
                color: #9cc4ff;
            }
            .genz-toast[data-type="info"] .genz-toast-bar {
                background: #78aaff;
            }

            /* MODE CERAH */
            html[data-genz-theme="light"] .genz-toast {
                border-color: rgba(16, 32, 24, .14);
                background: rgba(255, 255, 255, .98);
                color: #101820;
                box-shadow: 0 18px 44px rgba(24, 40, 62, .18);
            }

            html[data-genz-theme="light"] .genz-toast-desc {
                color: #4a5866;
            }

            html[data-genz-theme="light"] .genz-toast-close {
                color: #7b8894;
            }

            html[data-genz-theme="light"] .genz-toast-close:hover,
            html[data-genz-theme="light"] .genz-toast-close:focus-visible {
                background: rgba(16, 32, 24, .08);
                color: #101820;
            }

            html[data-genz-theme="light"] .genz-toast-action {
                border-color: rgba(16, 32, 24, .2);
                background: rgba(16, 32, 24, .06);
            }

            html[data-genz-theme="light"] .genz-toast[data-type="success"] .genz-toast-kicker,
            html[data-genz-theme="light"] .genz-toast[data-type="success"] .genz-toast-icon {
                color: #0d9a4d;
            }

            html[data-genz-theme="light"] .genz-toast[data-type="error"] .genz-toast-kicker,
            html[data-genz-theme="light"] .genz-toast[data-type="error"] .genz-toast-icon {
                color: #c2183a;
            }

            html[data-genz-theme="light"] .genz-toast[data-type="info"] .genz-toast-kicker,
            html[data-genz-theme="light"] .genz-toast[data-type="info"] .genz-toast-icon {
                color: #1d5fd6;
            }

            @media (max-width: 600px) {
                #${CONTAINER_ID} {
                    right: 12px;
                    left: 12px;
                    bottom: calc(12px + env(safe-area-inset-bottom, 0px));
                    width: auto;
                }

                .genz-toast {
                    grid-template-columns: 30px 1fr auto;
                    padding: 11px 11px 12px 12px;
                }

                .genz-toast-icon {
                    width: 30px;
                    height: 30px;
                    border-radius: 9px;
                    font-size: 13px;
                }
            }

            @media (prefers-reduced-motion: reduce) {
                .genz-toast,
                .genz-toast.is-leaving,
                .genz-toast-bar {
                    animation: none !important;
                    transition: none !important;
                }
            }
        `;

        document.head.appendChild(style);
    }

    function ensureContainer() {
        let container = document.getElementById(CONTAINER_ID);

        if (!container) {
            container = document.createElement("div");
            container.id = CONTAINER_ID;
            container.setAttribute("role", "region");
            container.setAttribute("aria-label", "Notifikasi");
            document.body.appendChild(container);
        }

        return container;
    }

    function clearToastEntry(entry) {
        if (!entry) return;

        if (entry.timer) {
            clearTimeout(entry.timer);
            entry.timer = null;
        }

        if (entry.entryKey && activeToasts.get(entry.entryKey) === entry) {
            activeToasts.delete(entry.entryKey);
        }
    }

    function removeElement(element, immediate = false) {
        if (!element) return;

        if (immediate) {
            element.remove();
            return;
        }

        element.classList.add("is-leaving");
        setTimeout(() => element.remove(), 200);
    }

    /**
     * Menampilkan notifikasi.
     *
     * @param {string} message Pesan utama (judul).
     * @param {{
     *   type?: "success"|"error"|"info",
     *   description?: string,
     *   kicker?: string,
     *   duration?: number,
     *   key?: string,
     *   actionLabel?: string,
     *   onAction?: Function,
     *   dismissible?: boolean
     * }} options
     * @returns {string} id toast
     */
    function show(message, options = {}) {
        if (!document.body) return "";

        ensureStyles();

        const type = normalizeType(options.type);
        const key = String(options.key || "").trim();
        const text = String(message || "").trim();

        if (!text) return "";

        /* Toast dengan key yang sama diganti seketika, bukan ditumpuk. */
        if (key && activeToasts.has(key)) {
            const previous = activeToasts.get(key);
            clearToastEntry(previous);
            activeToasts.delete(key);
            removeElement(previous.element, true);
        }

        const container = ensureContainer();
        const id = `genz-toast-${++toastSeed}`;

        const kicker = String(
            options.kicker || TITLES[type] || TITLES.info
        ).trim();

        const description = String(options.description || "").trim();
        const actionLabel = String(options.actionLabel || "").trim();

        const duration = Number.isFinite(Number(options.duration))
            ? Math.max(0, Number(options.duration))
            : (DEFAULT_DURATION[type] ?? DEFAULT_DURATION.info);

        const element = document.createElement("div");
        element.className = "genz-toast";
        element.id = id;
        element.dataset.type = type;
        element.setAttribute(
            "role",
            type === "error" ? "alert" : "status"
        );
        element.setAttribute(
            "aria-live",
            type === "error" ? "assertive" : "polite"
        );

        const icon = document.createElement("span");
        icon.className = "genz-toast-icon";
        icon.setAttribute("aria-hidden", "true");
        icon.textContent = ICONS[type] || ICONS.info;

        const body = document.createElement("div");
        body.className = "genz-toast-body";

        const kickerEl = document.createElement("span");
        kickerEl.className = "genz-toast-kicker";
        kickerEl.textContent = kicker;

        const titleEl = document.createElement("span");
        titleEl.className = "genz-toast-title";
        titleEl.textContent = text;

        body.append(kickerEl, titleEl);

        if (description) {
            const descEl = document.createElement("span");
            descEl.className = "genz-toast-desc";
            descEl.textContent = description;
            body.appendChild(descEl);
        }

        if (actionLabel && typeof options.onAction === "function") {
            const actionButton = document.createElement("button");
            actionButton.type = "button";
            actionButton.className = "genz-toast-action";
            actionButton.textContent = actionLabel;
            actionButton.addEventListener("click", () => {
                try {
                    options.onAction();
                } finally {
                    dismiss(id);
                }
            });
            body.appendChild(actionButton);
        }

        const closeButton = document.createElement("button");
        closeButton.type = "button";
        closeButton.className = "genz-toast-close";
        closeButton.setAttribute("aria-label", "Tutup notifikasi");
        closeButton.textContent = "×";

        if (options.dismissible === false) {
            closeButton.hidden = true;
        }

        const bar = document.createElement("span");
        bar.className = "genz-toast-bar";
        bar.setAttribute("aria-hidden", "true");

        element.append(icon, body, closeButton, bar);
        container.appendChild(element);

        const entry = {
            id,
            element,
            timer: null,
            entryKey: key || id
        };

        if (key) {
            activeToasts.set(key, entry);
        } else {
            activeToasts.set(id, entry);
        }

        closeButton.addEventListener("click", () => dismiss(id));

        if (duration > 0) {
            bar.style.transition = `transform ${duration}ms linear`;
            bar.style.transform = "scaleX(1)";
            requestAnimationFrame(() => {
                bar.style.transform = "scaleX(0)";
            });

            entry.timer = setTimeout(() => dismiss(id), duration);
        } else {
            bar.style.display = "none";
        }

        return id;
    }

    function dismiss(id) {
        const targetId = String(id || "").trim();
        if (!targetId) return false;

        const entry = activeToasts.get(targetId);
        if (!entry) return false;

        clearToastEntry(entry);
        removeElement(entry.element);
        return true;
    }

    function dismissAll() {
        for (const [key, entry] of Array.from(activeToasts.entries())) {
            clearToastEntry(entry);
            removeElement(entry.element, true);
            activeToasts.delete(key);
        }
    }

    window.GENZToast = Object.freeze({
        show,
        dismiss,
        dismissAll,
        success: (message, options = {}) =>
            show(message, { ...options, type: "success" }),
        error: (message, options = {}) =>
            show(message, { ...options, type: "error" }),
        info: (message, options = {}) =>
            show(message, { ...options, type: "info" })
    });
})();
