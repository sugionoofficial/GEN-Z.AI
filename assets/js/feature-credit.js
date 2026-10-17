(function () {
    "use strict";

    const ENDPOINT = "/api/feature-credits";
    const FEATURE_NAMES = {
        vision: "Vision — setiap generate",
        vision_video: "Vision Video — setiap analisis",
        upscale: "Upscale Foto — setiap proses",
        upscale_video: "Upscale Video — setiap proses",
        prompt_studio: "Prompt Studio — setiap Copy Prompt",
        metadata_cleaner: "Metadata Cleaner — setiap CHECK atau CLEAN"
    };
    let currentCosts = {};

    function getClient() {
        if (window.GENZ_SUPABASE) return window.GENZ_SUPABASE;
        if (window.supabaseClient) return window.supabaseClient;

        const config = window.GENZ_CONFIG || {};
        const key = config.SUPABASE_KEY || config.SUPABASE_ANON_KEY;
        if (!window.supabase?.createClient || !config.SUPABASE_URL || !key) return null;

        const client = window.supabase.createClient(config.SUPABASE_URL, key);
        window.GENZ_SUPABASE = client;
        window.supabaseClient = client;
        return client;
    }

    async function getToken() {
        const client = getClient();
        if (!client?.auth?.getSession) {
            throw new Error("Koneksi akun belum siap. Muat ulang halaman dan coba lagi.");
        }

        const { data, error } = await client.auth.getSession();
        if (error) throw error;
        if (!data?.session?.access_token) {
            throw new Error("Silakan login untuk melihat atau menggunakan biaya kredit.");
        }
        return data.session.access_token;
    }

    async function request(body) {
        const token = await getToken();
        const response = await fetch(ENDPOINT, {
            method: body ? "POST" : "GET",
            headers: {
                Authorization: `Bearer ${token}`,
                ...(body ? { "Content-Type": "application/json" } : {})
            },
            ...(body ? { body: JSON.stringify(body) } : {})
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.success !== true) {
            throw new Error(data.error || `Permintaan tarif gagal (HTTP ${response.status}).`);
        }
        return data;
    }

    function createTransactionId() {
        if (window.crypto?.randomUUID) return window.crypto.randomUUID();
        const bytes = new Uint8Array(16);
        window.crypto.getRandomValues(bytes);
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = Array.from(bytes, value => value.toString(16).padStart(2, "0")).join("");
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }

    function ensureNotice() {
        let notice = document.getElementById("feature-credit-notice");
        if (notice) return notice;

        const style = document.createElement("style");
        style.textContent = `
            .feature-credit-cost-note {
                margin: 8px 0;
                color: #aab1c5;
                font: 500 12px/1.5 system-ui, sans-serif;
            }
            .feature-credit-cost-note strong {
                color: #c7d2fe;
                font-weight: 700;
            }
        `;
        document.head.append(style);

        notice = document.createElement("div");
        notice.id = "feature-credit-notice";
        notice.setAttribute("role", "status");
        notice.style.cssText = "margin:12px auto;padding:10px 14px;max-width:1100px;border:1px solid rgba(99,102,241,.28);border-radius:12px;background:rgba(99,102,241,.08);color:#c7d2fe;font:500 13px/1.5 system-ui,sans-serif";
        const main = document.querySelector("main");
        (main || document.body).prepend(notice);
        return notice;
    }

    function showMessage(message, isError = false) {
        const notice = ensureNotice();
        notice.textContent = message;
        notice.style.color = isError ? "#fecaca" : "#c7d2fe";
        notice.style.borderColor = isError ? "rgba(239,68,68,.4)" : "rgba(99,102,241,.28)";
        notice.setAttribute("role", isError ? "alert" : "status");
    }

    async function loadSettings() {
        const data = await request();
        currentCosts = Object.fromEntries(
            data.settings.map(item => [item.feature_id, Number(item.credit_cost)])
        );

        renderCosts();
        return currentCosts;
    }

    function renderCosts() {
        document.querySelectorAll("[data-feature-credit-cost]").forEach(element => {
            const featureId = element.dataset.featureCreditCost;
            if (!Object.hasOwn(currentCosts, featureId)) return;
            element.textContent = currentCosts[featureId].toLocaleString("id-ID");
        });

        const currentFeature = document.body.dataset.featureCredit;
        if (FEATURE_NAMES[currentFeature] && Object.hasOwn(currentCosts, currentFeature)) {
            showMessage(`${FEATURE_NAMES[currentFeature]}: ${currentCosts[currentFeature].toLocaleString("id-ID")} credit.`);
        }
    }

    function setFeature(featureId) {
        if (!FEATURE_NAMES[featureId]) {
            throw new Error("Fitur kredit tidak dikenal.");
        }

        document.body.dataset.featureCredit = featureId;
        document.querySelectorAll("[data-feature-credit-cost]").forEach(element => {
            element.dataset.featureCreditCost = featureId;
        });
        renderCosts();
    }

    async function run(featureId, operation) {
        if (!FEATURE_NAMES[featureId] || typeof operation !== "function") {
            throw new Error("Konfigurasi pemakaian kredit tidak valid.");
        }

        const transactionId = createTransactionId();
        const charged = await request({
            action: "charge",
            feature_id: featureId,
            transaction_id: transactionId
        });
        showMessage(`${FEATURE_NAMES[featureId]}: ${Number(charged.cost).toLocaleString("id-ID")} credit digunakan.`);

        let result;
        try {
            result = await operation();
        } catch (error) {
            try {
                await request({
                    action: "settle",
                    transaction_id: transactionId,
                    outcome: "refund"
                });
            } catch (refundError) {
                console.error("[feature-credit] Refund gagal:", refundError);
                showMessage(`${error.message || "Proses gagal."} Pengembalian kredit juga gagal; hubungi admin.`, true);
                throw new Error(`${error.message || "Proses gagal."} Kredit tidak berhasil dikembalikan secara otomatis.`);
            }

            showMessage(`${error.message || "Proses gagal."} Kredit telah dikembalikan.`, true);
            throw error;
        }

        try {
            await request({
                action: "settle",
                transaction_id: transactionId,
                outcome: "complete"
            });
        } catch (error) {
            console.error("[feature-credit] Gagal menutup transaksi:", error);
            showMessage("Proses berhasil, tetapi status transaksi credit belum dapat diselesaikan. Hubungi admin jika saldo tidak sesuai.", true);
        }

        return result;
    }

    window.GENZFeatureCredit = Object.freeze({
        loadSettings,
        setFeature,
        run,
        showMessage
    });

    document.addEventListener("DOMContentLoaded", function () {
        loadSettings().catch(error => {
            console.error("[feature-credit] Gagal memuat tarif:", error);
            showMessage(error.message || "Tarif kredit tidak dapat dimuat.", true);
        });
    }, { once: true });
})();
