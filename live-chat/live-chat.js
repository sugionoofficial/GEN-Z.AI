(() => {
    "use strict";

    const endpoint = "/api/openkey-chat";
    const modelSelect = document.getElementById("modelSelect");
    const catalogStatus = document.getElementById("catalogStatus");
    const transcript = document.getElementById("transcript");
    const welcome = document.getElementById("welcome");
    const form = document.getElementById("chatForm");
    const input = document.getElementById("messageInput");
    const sendButton = document.getElementById("sendButton");
    const clearButton = document.getElementById("clearButton");
    const notice = document.getElementById("notice");

    let messages = [];
    let requestPending = false;

    function setNotice(text, isError = false) {
        notice.textContent = text;
        notice.classList.toggle("error", isError);
    }

    function getSupabaseClient() {
        const client = window.GENZ_SUPABASE || window.supabaseClient;
        if (client) return client;

        const config = window.GENZ_CONFIG;
        if (!window.supabase?.createClient || !config?.SUPABASE_URL || !config?.SUPABASE_KEY) {
            throw new Error("Konfigurasi autentikasi Supabase tidak tersedia.");
        }

        const createdClient = window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_KEY, {
            auth: {
                persistSession: true,
                autoRefreshToken: false,
                detectSessionInUrl: false,
                lock: async (_name, _timeout, callback) => callback()
            }
        });
        window.GENZ_SUPABASE = createdClient;
        window.supabaseClient = createdClient;
        return createdClient;
    }

    function setReady(ready) {
        const canSend = ready && modelSelect.value && !requestPending;
        input.disabled = !canSend;
        sendButton.disabled = !canSend;
        modelSelect.disabled = !ready || requestPending;
        clearButton.disabled = requestPending;
    }

    function formatModel(model) {
        const id = String(model?.model_id || model?.id || "").trim();
        const name = String(model?.model_name || model?.name || id).trim();
        if (!id) return null;
        return { id, name, owner: String(model?.owned_by || "").trim() };
    }

    async function loadModels(token) {
        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ operation: "openkey_models" })
        });
        const data = await response.json().catch(() => null);
        if (!response.ok || data?.success !== true) {
            throw new Error(data?.error || `Katalog model gagal dimuat (HTTP ${response.status}).`);
        }

        const models = Array.isArray(data.models)
            ? data.models.map(formatModel).filter(Boolean)
            : [];
        models.sort((left, right) => left.name.localeCompare(right.name, "id"));
        if (!models.length) throw new Error("Katalog OpenKey belum memiliki model yang tersedia.");

        modelSelect.replaceChildren();
        for (const model of models) {
            const option = document.createElement("option");
            option.value = model.id;
            option.textContent = model.name === model.id ? model.id : `${model.name} · ${model.id}`;
            if (model.owner) option.title = `Provider: ${model.owner}`;
            modelSelect.append(option);
        }
        catalogStatus.textContent = `${models.length} model tersedia`;
    }

    function appendMessage(role, content, { error = false, typing = false } = {}) {
        welcome.hidden = true;
        const message = document.createElement("article");
        message.className = `message ${role}${error ? " message-error" : ""}`;

        const avatar = document.createElement("span");
        avatar.className = "avatar";
        avatar.setAttribute("aria-hidden", "true");
        avatar.textContent = role === "user" ? "K" : "✦";

        const body = document.createElement("div");
        body.className = "message-content";
        if (typing) {
            const dots = document.createElement("span");
            dots.className = "typing";
            dots.setAttribute("aria-label", "AI sedang mengetik");
            for (let index = 0; index < 3; index += 1) dots.append(document.createElement("i"));
            body.append(dots);
        } else {
            body.textContent = content;
        }

        message.append(avatar, body);
        transcript.append(message);
        transcript.scrollTop = transcript.scrollHeight;
        return message;
    }

    function responseText(data) {
        if (typeof data?.content === "string" && data.content.trim()) return data.content;
        if (typeof data?.message?.content === "string" && data.message.content.trim()) {
            return data.message.content;
        }
        return "";
    }

    async function sendMessage(text) {
        const newMessage = { role: "user", content: text };
        messages.push(newMessage);
        appendMessage("user", text);
        let pendingMessage = null;
        requestPending = true;
        setReady(true);
        setNotice("Model sedang menyiapkan jawaban...");

        try {
            const client = getSupabaseClient();
            const { data, error } = await client.auth.getSession();
            if (error) throw error;
            const token = data?.session?.access_token;
            if (!token) throw new Error("Sesi login tidak ditemukan. Silakan login kembali.");
            pendingMessage = appendMessage("assistant", "", { typing: true });

            const response = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    model: modelSelect.value,
                    messages: messages.slice(-100),
                    stream: false
                }),
                signal: AbortSignal.timeout(180000)
            });
            const result = await response.json().catch(() => null);
            if (!response.ok || result?.success !== true) {
                throw new Error(result?.error || `Chat gagal diproses (HTTP ${response.status}).`);
            }

            const content = responseText(result);
            if (!content) throw new Error("Model mengembalikan jawaban kosong.");
            pendingMessage.remove();
            messages.push({ role: "assistant", content });
            appendMessage("assistant", content);
            setNotice(result.model ? `Dijawab oleh ${result.model}` : "Jawaban diterima.");
        } catch (error) {
            pendingMessage?.remove();
            appendMessage("assistant", error.message || "Terjadi kesalahan saat menghubungi model.", { error: true });
            setNotice(error.message || "Terjadi kesalahan saat menghubungi model.", true);
        } finally {
            requestPending = false;
            setReady(true);
            input.focus();
        }
    }

    form.addEventListener("submit", async event => {
        event.preventDefault();
        const text = input.value.trim();
        if (!text || requestPending || !modelSelect.value) return;
        input.value = "";
        input.style.height = "auto";
        await sendMessage(text);
    });

    input.addEventListener("keydown", event => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            form.requestSubmit();
        }
    });

    input.addEventListener("input", () => {
        input.style.height = "auto";
        input.style.height = `${Math.min(input.scrollHeight, 150)}px`;
    });

    modelSelect.addEventListener("change", () => {
        if (messages.length) setNotice(`Model untuk pesan berikutnya: ${modelSelect.selectedOptions[0].textContent}`);
        setReady(true);
    });

    clearButton.addEventListener("click", () => {
        if (requestPending) return;
        messages = [];
        transcript.replaceChildren(welcome);
        welcome.hidden = false;
        setNotice("Percakapan baru siap.");
        input.focus();
    });

    async function initialize() {
        try {
            const client = getSupabaseClient();
            const { data, error } = await client.auth.getSession();
            if (error) throw error;
            const token = data?.session?.access_token;
            if (!token) {
                catalogStatus.textContent = "Login diperlukan";
                setNotice("Silakan login untuk menggunakan live chat.");
                const link = document.createElement("a");
                link.className = "auth-link";
                link.href = "/login.html";
                link.textContent = " Login";
                notice.append(link);
                return;
            }

            await loadModels(token);
            setReady(true);
            setNotice("Katalog model siap. Mulai percakapan.");
        } catch (error) {
            catalogStatus.textContent = "Tidak tersedia";
            setNotice(error.message || "Gagal memuat live chat.", true);
            const retry = document.createElement("button");
            retry.className = "text-button";
            retry.type = "button";
            retry.textContent = "Coba lagi";
            retry.addEventListener("click", initialize, { once: true });
            catalogStatus.replaceChildren(retry);
        }
    }

    initialize();
})();
