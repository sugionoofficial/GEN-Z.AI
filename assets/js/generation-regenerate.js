(function (window) {
    "use strict";

    const STORAGE_KEY =
        "genz.generation.regenerate.v1";

    function isVisionTask(item) {
        const taskId = String(
            item?.task_id ||
            item?.taskId ||
            ""
        ).trim().toLowerCase();

        const providers = [
            item?.provider_id,
            item?.provider_name,
            item?.provider
        ]
            .map(value => String(value || "").trim().toLowerCase())
            .filter(Boolean);

        return taskId.startsWith("vision-") ||
            providers.some(
                provider =>
                    /(^|[^a-z])vision([^a-z]|$)/.test(provider)
            );
    }

    function normalizeReference(value) {
        if (Array.isArray(value)) {
            return value
                .map(normalizeReference)
                .find(Boolean) || null;
        }

        if (typeof value !== "string") {
            return null;
        }

        const text = value.trim();
        if (!text) {
            return null;
        }

        if (text.startsWith("[") || text.startsWith('"')) {
            try {
                const parsed = JSON.parse(text);
                if (parsed !== value) {
                    return normalizeReference(parsed);
                }
            } catch {
                return text;
            }
        }

        return text;
    }

    function save(payload) {
        if (
            !payload ||
            typeof payload !== "object" ||
            !String(payload.modelId || "").trim() ||
            !payload.parameters ||
            typeof payload.parameters !== "object" ||
            Array.isArray(payload.parameters)
        ) {
            console.error(
                "[GEN-Z.AI][Regenerate] Payload regenerate tidak valid."
            );
            return false;
        }

        try {
            window.sessionStorage.setItem(
                STORAGE_KEY,
                JSON.stringify({
                    version: 1,
                    modelId: String(payload.modelId).trim(),
                    parameters: payload.parameters
                })
            );
            return true;
        } catch (error) {
            console.error(
                "[GEN-Z.AI][Regenerate] Gagal menyimpan data regenerate.",
                error
            );
            return false;
        }
    }

    function read() {
        let raw;
        try {
            raw = window.sessionStorage.getItem(STORAGE_KEY);
        } catch (error) {
            console.error(
                "[GEN-Z.AI][Regenerate] Gagal membaca data regenerate.",
                error
            );
            return null;
        }

        if (!raw) {
            return null;
        }

        try {
            const payload = JSON.parse(raw);
            if (
                payload?.version !== 1 ||
                !String(payload.modelId || "").trim() ||
                !payload.parameters ||
                typeof payload.parameters !== "object" ||
                Array.isArray(payload.parameters)
            ) {
                throw new Error("Payload regenerate tidak valid.");
            }

            return payload;
        } catch (error) {
            console.error(
                "[GEN-Z.AI][Regenerate] Data regenerate rusak.",
                error
            );
            clear();
            return null;
        }
    }

    function clear() {
        try {
            window.sessionStorage.removeItem(STORAGE_KEY);
            return true;
        } catch (error) {
            console.error(
                "[GEN-Z.AI][Regenerate] Gagal menghapus data regenerate.",
                error
            );
            return false;
        }
    }

    window.GENZRegenerate = Object.freeze({
        isVisionTask,
        normalizeReference,
        save,
        read,
        clear
    });
})(window);
