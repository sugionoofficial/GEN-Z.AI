(function () {
    "use strict";

    const FEATURE_LABELS = {
        vision: ["Vision", "Setiap generate"],
        vision_video: ["Vision Video", "Setiap analisis"],
        upscale: ["Upscale", "Setiap proses"],
        prompt_studio: ["Prompt Studio", "Setiap Copy Prompt"],
        metadata_cleaner: ["Metadata Cleaner", "Setiap CHECK atau CLEAN"]
    };
    const endpoint = "/api/feature-credits";
    const form = document.getElementById("settings-form");
    const list = document.getElementById("settings-list");
    const button = document.getElementById("save-button");
    const status = document.getElementById("status");
    const retryButton = document.getElementById("retry-button");

    function getClient() {
        const config = window.GENZ_CONFIG || {};
        if (window.GENZ_SUPABASE) return window.GENZ_SUPABASE;
        if (window.supabaseClient) return window.supabaseClient;
        const key = config.SUPABASE_KEY || config.SUPABASE_ANON_KEY;
        if (!window.supabase?.createClient || !config.SUPABASE_URL || !key) {
            throw new Error("Konfigurasi Supabase tidak ditemukan.");
        }
        const client = window.supabase.createClient(config.SUPABASE_URL, key);
        window.GENZ_SUPABASE = client;
        return client;
    }

    async function getToken() {
        const { data, error } = await getClient().auth.getSession();
        if (error) throw error;
        if (!data?.session?.access_token) throw new Error("Silakan login terlebih dahulu.");
        return data.session.access_token;
    }

    async function callApi(method, body, adminOnly = false) {
        const token = await getToken();
        const response = await fetch(
            endpoint + (adminOnly ? "?admin=1" : ""),
            {
            method,
            headers: {
                Authorization: `Bearer ${token}`,
                ...(body ? { "Content-Type": "application/json" } : {})
            },
            ...(body ? { body: JSON.stringify(body) } : {})
            }
        );
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.success !== true) {
            throw new Error(data.error || `Permintaan gagal (HTTP ${response.status}).`);
        }
        return data;
    }

    function setStatus(message, tone = "success", title = "") {
        status.replaceChildren();
        status.className = message ? tone : "";
        status.setAttribute("role", tone === "error" ? "alert" : "status");
        if (!message) return;

        if (tone === "loading") {
            const spinner = document.createElement("span");
            spinner.className = "status-spinner";
            spinner.setAttribute("aria-hidden", "true");
            status.append(spinner);
        }

        const content = document.createElement("div");
        content.className = "status-content";
        if (title) {
            const heading = document.createElement("strong");
            heading.textContent = title;
            content.append(heading);
        }
        const detail = document.createElement("p");
        detail.textContent = message;
        content.append(detail);
        status.append(content);
    }

    function render(settings) {
        const costs = Object.fromEntries(settings.map(item => [item.feature_id, item.credit_cost]));
        list.replaceChildren();

        Object.entries(FEATURE_LABELS).forEach(([featureId, [name, trigger]]) => {
            const row = document.createElement("label");
            row.className = "row";

            const description = document.createElement("span");
            const title = document.createElement("strong");
            title.textContent = name;
            const detail = document.createElement("small");
            detail.textContent = trigger;
            description.append(title, detail);

            const input = document.createElement("input");
            input.type = "number";
            input.min = "0";
            input.max = "1000000";
            input.step = "1";
            input.required = true;
            input.name = featureId;
            input.value = String(costs[featureId] ?? 1);
            input.setAttribute("aria-label", `Biaya credit ${name}`);
            row.append(description, input);
            list.append(row);
        });
    }

    async function load() {
        button.disabled = true;
        retryButton.hidden = true;
        list.setAttribute("aria-busy", "true");
        setStatus("Memeriksa akses admin dan mengambil tarif dari Supabase.", "loading", "Memuat pengaturan");
        try {
            const data = await callApi("GET", null, true);
            render(data.settings);
            list.setAttribute("aria-busy", "false");
            button.disabled = false;
            setStatus("Tarif aktif berhasil dimuat. Perubahan belum disimpan sampai Anda menekan tombol Simpan Tarif.", "success", "Siap");
        } catch (error) {
            list.replaceChildren();
            list.setAttribute("aria-busy", "false");
            retryButton.hidden = false;
            setStatus(error.message || "Gagal memuat tarif.", "error", "Pengaturan belum dapat dimuat");
        }
    }

    retryButton.addEventListener("click", load);

    form.addEventListener("submit", async event => {
        event.preventDefault();
        if (button.disabled) return;
        const settings = Object.fromEntries(
            Object.keys(FEATURE_LABELS).map(featureId => {
                const input = form.elements.namedItem(featureId);
                return [featureId, Number(input.value)];
            })
        );

        if (Object.values(settings).some(value => !Number.isInteger(value) || value < 0 || value > 1000000)) {
            setStatus("Isi tarif bilangan bulat antara 0 sampai 1.000.000.", "error", "Nilai tarif tidak valid");
            return;
        }

        button.disabled = true;
        retryButton.hidden = true;
        setStatus("Menyimpan tarif dan memperbarui pengaturan server.", "loading", "Menyimpan tarif");
        try {
            const data = await callApi("POST", { action: "save_settings", settings });
            render(data.settings);
            setStatus("Tarif baru sudah tersimpan dan akan digunakan server.", "success", "Berhasil disimpan");
        } catch (error) {
            setStatus(error.message || "Tarif gagal disimpan.", "error", "Tarif gagal disimpan");
        } finally {
            button.disabled = false;
        }
    });

    load();
})();
