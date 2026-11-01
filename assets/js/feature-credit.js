(function () {
    "use strict";

    const ENDPOINT = "/api/feature-credits";
    const FEATURE_NAMES = {
        vision: "Vision — setiap generate",
        vision_video: "Vision Video — setiap analisis",
        upscale: "Upscale Foto — setiap proses",
        upscale_video: "Upscale Video — setiap proses",
        prompt_studio: "Prompt Studio — setiap Copy Prompt",
        metadata_cleaner: "Metadata Cleaner — setiap CHECK atau CLEAN",
        opusclip_clipping: "OpusClip AI Clipping — setiap project",
        opusclip_dubbing: "OpusClip AI Dubbing — setiap video",
        opusclip_thumbnail: "OpusClip Thumbnail AI — setiap generate",
        opusclip_censor_edit: "OpusClip Edit & Sensor — setiap proses",
        opusclip_understanding: "OpusClip Video Understanding — setiap analisis",
        opusclip_motion_ui: "OpusClip Motion UI — setiap render video"
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
            html[data-genz-theme="light"] .feature-credit-cost-note {
                color: #3c4a60 !important;
            }
            html[data-genz-theme="light"] .feature-credit-cost-note strong {
                color: #7a4a00 !important;
            }
            html[data-genz-theme="light"] #feature-credit-notice {
                border-color: rgba(99, 102, 241, .35) !important;
                background: #eef1ff !important;
                color: #2b338a !important;
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

    function syncRemainingCredits(creditsValue) {
        const numeric = Number(creditsValue);
        if (!Number.isFinite(numeric)) return;

        try {
            const profile = window.GENZNavigation?.getProfile?.();
            if (profile && typeof profile === "object") {
                profile.credits = numeric;
            }
            const rawCache = localStorage.getItem("genz-auth-profile-cache-v1");
            if (rawCache) {
                const parsed = JSON.parse(rawCache);
                if (parsed && typeof parsed === "object") {
                    parsed.credits = numeric;
                    parsed.cachedAt = Date.now();
                    localStorage.setItem("genz-auth-profile-cache-v1", JSON.stringify(parsed));
                }
            }
        } catch (_err) {
            /* ignore storage restrictions */
        }
    }

    function resolveMetadata(metaOrFactory) {
        try {
            const raw = typeof metaOrFactory === "function" ? metaOrFactory() : metaOrFactory;
            if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
                return {};
            }
            const prompt = typeof raw.prompt === "string" ? raw.prompt.trim() : "";
            const modelId = typeof (raw.modelId || raw.model_id) === "string"
                ? String(raw.modelId || raw.model_id).trim()
                : "";
            const modelName = typeof (raw.modelName || raw.model_name) === "string"
                ? String(raw.modelName || raw.model_name).trim()
                : "";
            return { prompt, modelId, modelName };
        } catch (_err) {
            return {};
        }
    }

    function getCost(featureId) {
        if (!Object.hasOwn(currentCosts, featureId)) return null;
        const value = Number(currentCosts[featureId]);
        return Number.isFinite(value) ? value : null;
    }

    async function run(featureId, operation, metaOrFactory = null) {
        if (!FEATURE_NAMES[featureId] || typeof operation !== "function") {
            throw new Error("Konfigurasi pemakaian kredit tidak valid.");
        }

        const initialMeta = resolveMetadata(metaOrFactory);
        const chargePayload = {
            action: "charge",
            feature_id: featureId,
            transaction_id: createTransactionId()
        };
        if (initialMeta.prompt) chargePayload.prompt = initialMeta.prompt;
        if (initialMeta.modelId) chargePayload.model_id = initialMeta.modelId;
        if (initialMeta.modelName) chargePayload.model_name = initialMeta.modelName;

        const transactionId = chargePayload.transaction_id;
        const charged = await request(chargePayload);
        syncRemainingCredits(charged.credits);
        showMessage(`${FEATURE_NAMES[featureId]}: ${Number(charged.cost).toLocaleString("id-ID")} credit digunakan.`);

        let result;
        try {
            result = await operation();
        } catch (error) {
            try {
                const refundPayload = {
                    action: "settle",
                    transaction_id: transactionId,
                    outcome: "refund"
                };
                if (error?.message) {
                    refundPayload.error_message = String(error.message).slice(0, 1000);
                }
                const refunded = await request(refundPayload);
                syncRemainingCredits(refunded.credits);
            } catch (refundError) {
                console.error("[feature-credit] Refund gagal:", refundError);
                showMessage(`${error.message || "Proses gagal."} Pengembalian kredit juga gagal; hubungi admin.`, true);
                throw new Error(`${error.message || "Proses gagal."} Kredit tidak berhasil dikembalikan secara otomatis.`);
            }

            showMessage(`${error.message || "Proses gagal."} Kredit telah dikembalikan.`, true);
            throw error;
        }

        try {
            const finalMeta = resolveMetadata(metaOrFactory);
            const completePayload = {
                action: "settle",
                transaction_id: transactionId,
                outcome: "complete"
            };
            if (finalMeta.prompt && finalMeta.prompt !== initialMeta.prompt) {
                completePayload.prompt = finalMeta.prompt;
            }
            const completed = await request(completePayload);
            syncRemainingCredits(completed.credits);
        } catch (error) {
            console.error("[feature-credit] Gagal menutup transaksi:", error);
            showMessage("Proses berhasil, tetapi status transaksi credit belum dapat diselesaikan. Hubungi admin jika saldo tidak sesuai.", true);
        }

        return result;
    }

    window.GENZFeatureCredit = Object.freeze({
        loadSettings,
        setFeature,
        getCost,
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
