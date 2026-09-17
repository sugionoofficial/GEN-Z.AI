(function () {
    "use strict";

    if (window.GENZProviderInit) {
        console.log("[GEN-Z.AI] Provider init sudah aktif.");
        return;
    }

    let started = false;

    function getModule(name) {
        return window[name] || null;
    }

    function showInitError(message) {
        console.error("[GEN-Z.AI] Provider init error:", message);

        const selectors = [
            "#providerList",
            "#providersList",
            "#providerPanel"
        ];

        let container = null;

        for (const selector of selectors) {
            container = document.querySelector(selector);
            if (container) break;
        }

        if (!container) return;

        container.innerHTML = `
            <div style="
                padding:20px;
                margin:10px 0;
                border:1px solid rgba(239,68,68,.35);
                border-radius:12px;
                background:rgba(239,68,68,.08);
                color:#ef4444;
                font-family:Arial,sans-serif;
            ">
                <strong>Provider gagal dimuat</strong>
                <div style="
                    margin-top:6px;
                    font-size:13px;
                    opacity:.85;
                ">
                    ${escapeHtml(message)}
                </div>
            </div>
        `;
    }

    function escapeHtml(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function bindCreateButton() {
        document.addEventListener(
            "click",
            function (event) {
                const button = event.target.closest(
                    [
                        '[data-provider-action="create"]',
                        "#addProviderBtn",
                        "#addProvider",
                        ".add-provider-btn"
                    ].join(",")
                );

                if (!button) return;

                event.preventDefault();
                event.stopPropagation();

                const form = getModule("GENZProviderForm");

                if (!form || typeof form.openCreate !== "function") {
                    console.error(
                        "[GEN-Z.AI] GENZProviderForm belum tersedia."
                    );
                    return;
                }

                form.openCreate();
            },
            true
        );
    }

    async function start() {
        if (started) {
            return true;
        }

        started = true;

        try {
            const supabase = getModule(
                "GENZProviderSupabase"
            );

            const apiKey = getModule(
                "GENZProviderApiKey"
            );

            const list = getModule(
                "GENZProviderList"
            );

            const form = getModule(
                "GENZProviderForm"
            );

            const actions = getModule(
                "GENZProviderActions"
            );

            if (!supabase) {
                throw new Error(
                    "Modul Supabase belum tersedia."
                );
            }

            if (!apiKey) {
                throw new Error(
                    "Modul API Key belum tersedia."
                );
            }

            if (!list) {
                throw new Error(
                    "Modul daftar provider belum tersedia."
                );
            }

            if (!form) {
                throw new Error(
                    "Modul form provider belum tersedia."
                );
            }

            if (!actions) {
                throw new Error(
                    "Modul aksi provider belum tersedia."
                );
            }

            if (
                supabase.ready &&
                typeof supabase.ready.then === "function"
            ) {
                await supabase.ready;
            }

            if (
                apiKey.ready &&
                typeof apiKey.ready.then === "function"
            ) {
                await apiKey.ready;
            }

            if (
                list.ready &&
                typeof list.ready.then === "function"
            ) {
                await list.ready;
            }

            if (
                form.ready &&
                typeof form.ready.then === "function"
            ) {
                await form.ready;
            }

            if (
                actions.ready &&
                typeof actions.ready.then === "function"
            ) {
                await actions.ready;
            }

            bindCreateButton();

            if (typeof list.load === "function") {
                await list.load();
            }

            document.dispatchEvent(
                new CustomEvent(
                    "genz:providers-ready"
                )
            );

            console.log(
                "[GEN-Z.AI] Provider system siap."
            );

            return true;

        } catch (error) {
            started = false;

            showInitError(
                error && error.message
                    ? error.message
                    : "Gagal menginisialisasi provider."
            );

            return false;
        }
    }

    async function reload() {
        const list = getModule(
            "GENZProviderList"
        );

        if (!list) {
            return false;
        }

        try {
            if (typeof list.refresh === "function") {
                await list.refresh();
            } else if (
                typeof list.load === "function"
            ) {
                await list.load();
            }

            return true;

        } catch (error) {
            console.error(
                "[GEN-Z.AI] Gagal reload provider:",
                error
            );

            return false;
        }
    }

    window.GENZProviderInit = {
        ready: true,
        start,
        reload
    };

    function boot() {
        start();
    }

    if (
        document.readyState === "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            boot,
            { once: true }
        );
    } else {
        boot();
    }

})();
