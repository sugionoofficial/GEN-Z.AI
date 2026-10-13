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
    const attachButton = document.getElementById("attachButton");
    const attachmentInput = document.getElementById("attachmentInput");
    const attachmentList = document.getElementById("attachmentList");
    const clearButton = document.getElementById("clearButton");
    const notice = document.getElementById("notice");

    const MAX_ATTACHMENTS = 4;
    const MAX_TOTAL_ATTACHMENT_BYTES = 3 * 1024 * 1024;
    const MAX_TEXT_FILE_BYTES = 512 * 1024;
    const MAX_IMAGE_FILE_BYTES = 3 * 1024 * 1024;
    const IMAGE_TYPES = new Set([
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
        "image/avif"
    ]);
    const TEXT_FILE_EXTENSIONS = new Set([
        "txt", "md", "csv", "tsv", "json", "xml", "html", "htm", "css",
        "js", "mjs", "ts", "tsx", "jsx", "py", "java", "c", "h", "cpp",
        "go", "rs", "php", "sql", "yaml", "yml", "toml", "ini", "log",
        "sh", "bash", "diff", "patch"
    ]);

    let messages = [];
    let attachments = [];
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
        sendButton.disabled = !canSend || (!input.value.trim() && !attachments.length);
        attachButton.disabled = !canSend;
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

    function appendMessage(role, content, {
        error = false,
        typing = false,
        attachments: messageAttachments = []
    } = {}) {
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

        if (!typing && messageAttachments.length) {
            const attachmentContainer = document.createElement("div");
            attachmentContainer.className = "message-attachments";
            for (const attachment of messageAttachments) {
                if (attachment.kind === "image") {
                    const image = document.createElement("img");
                    image.src = attachment.dataUrl;
                    image.alt = attachment.name;
                    image.loading = "lazy";
                    attachmentContainer.append(image);
                } else {
                    const file = document.createElement("span");
                    file.className = "message-file";
                    file.textContent = `▤ ${attachment.name}`;
                    attachmentContainer.append(file);
                }
            }
            body.append(attachmentContainer);
        }

        if (!typing) {
            const copyRow = document.createElement("div");
            copyRow.className = "message-copy-row";

            const copyButton = document.createElement("button");
            copyButton.className = "message-copy";
            copyButton.type = "button";
            copyButton.setAttribute("aria-label", "Salin teks chat");
            copyButton.title = "Salin teks chat";
            copyButton.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg><span>Salin</span>';
            copyButton.addEventListener("click", async () => {
                try {
                    await copyText(content);
                    copyButton.classList.add("copied");
                    copyButton.setAttribute("aria-label", "Teks chat disalin");
                    copyButton.title = "Tersalin";
                    copyButton.querySelector("span").textContent = "Tersalin";
                    window.setTimeout(() => {
                        copyButton.classList.remove("copied");
                        copyButton.setAttribute("aria-label", "Salin teks chat");
                        copyButton.title = "Salin teks chat";
                        copyButton.querySelector("span").textContent = "Salin";
                    }, 1600);
                } catch (copyError) {
                    setNotice(copyError.message || "Gagal menyalin teks chat.", true);
                }
            });

            copyRow.append(copyButton);
            body.append(copyRow);
        }

        message.append(avatar, body);
        transcript.append(message);
        transcript.scrollTop = transcript.scrollHeight;
        return message;
    }

    async function copyText(text) {
        const value = String(text || "");
        if (!value) {
            throw new Error("Tidak ada teks pada chat ini untuk disalin.");
        }

        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(value);
            return;
        }

        const temporaryInput = document.createElement("textarea");
        temporaryInput.value = value;
        temporaryInput.setAttribute("readonly", "");
        temporaryInput.style.position = "fixed";
        temporaryInput.style.opacity = "0";
        document.body.append(temporaryInput);
        temporaryInput.select();
        const copied = document.execCommand("copy");
        temporaryInput.remove();
        if (!copied) {
            throw new Error("Browser tidak mengizinkan menyalin ke clipboard.");
        }
    }

    function responseText(data) {
        if (typeof data?.content === "string" && data.content.trim()) return data.content;
        if (typeof data?.message?.content === "string" && data.message.content.trim()) {
            return data.message.content;
        }
        return "";
    }

    function getFileExtension(name) {
        return String(name).split(".").pop().toLowerCase();
    }

    function readImage(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                if (typeof reader.result !== "string") {
                    reject(new Error(`Gagal membaca gambar ${file.name}.`));
                    return;
                }
                resolve(reader.result);
            };
            reader.onerror = () => reject(new Error(`Gagal membaca gambar ${file.name}.`));
            reader.readAsDataURL(file);
        });
    }

    function renderAttachments() {
        attachmentList.replaceChildren();
        attachmentList.hidden = attachments.length === 0;

        for (const [index, attachment] of attachments.entries()) {
            const chip = document.createElement("div");
            chip.className = "attachment-chip";

            if (attachment.kind === "image") {
                const image = document.createElement("img");
                image.src = attachment.dataUrl;
                image.alt = "";
                chip.append(image);
            } else {
                const icon = document.createElement("span");
                icon.className = "attachment-file-icon";
                icon.setAttribute("aria-hidden", "true");
                icon.textContent = "▤";
                chip.append(icon);
            }

            const name = document.createElement("span");
            name.className = "attachment-name";
            name.textContent = attachment.name;
            chip.append(name);

            const remove = document.createElement("button");
            remove.className = "attachment-remove";
            remove.type = "button";
            remove.setAttribute("aria-label", `Hapus lampiran ${attachment.name}`);
            remove.textContent = "×";
            remove.addEventListener("click", () => {
                if (requestPending) return;
                attachments.splice(index, 1);
                renderAttachments();
                setReady(true);
            });
            chip.append(remove);
            attachmentList.append(chip);
        }
    }

    async function loadAttachments(files) {
        if (attachments.length + files.length > MAX_ATTACHMENTS) {
            throw new Error(`Maksimal ${MAX_ATTACHMENTS} lampiran dalam satu pesan.`);
        }

        const added = [];
        let totalBytes = attachments.reduce((total, attachment) => total + attachment.size, 0);

        for (const file of files) {
            if (file.size === 0) {
                throw new Error(`Berkas ${file.name} kosong.`);
            }
            if (file.type.startsWith("image/")) {
                if (!IMAGE_TYPES.has(file.type)) {
                    throw new Error(`Format gambar ${file.name} tidak didukung. Gunakan JPG, PNG, WebP, GIF, atau AVIF.`);
                }
                if (file.size > MAX_IMAGE_FILE_BYTES) {
                    throw new Error(`Ukuran gambar ${file.name} melebihi 3 MB.`);
                }
                totalBytes += file.size;
                added.push({
                    file,
                    name: file.name,
                    size: file.size,
                    kind: "image",
                    dataUrl: await readImage(file)
                });
            } else {
                const extension = getFileExtension(file.name);
                if (!TEXT_FILE_EXTENSIONS.has(extension)) {
                    throw new Error(`Format berkas ${file.name} tidak didukung. Gambar dan berkas teks/kode diperbolehkan.`);
                }
                if (file.size > MAX_TEXT_FILE_BYTES) {
                    throw new Error(`Ukuran berkas teks ${file.name} melebihi 512 KB.`);
                }
                totalBytes += file.size;
                const content = await file.text();
                if (content.includes("\u0000")) {
                    throw new Error(`${file.name} bukan berkas teks yang dapat dibaca.`);
                }
                added.push({
                    file,
                    name: file.name,
                    size: file.size,
                    kind: "text",
                    content
                });
            }

            if (totalBytes > MAX_TOTAL_ATTACHMENT_BYTES) {
                throw new Error("Total ukuran lampiran tidak boleh melebihi 3 MB.");
            }
        }

        attachments.push(...added);
        renderAttachments();
        setReady(true);
        setNotice(`${attachments.length} lampiran siap dikirim.`);
    }

    function buildUserMessage(text, selectedAttachments) {
        if (!selectedAttachments.length) {
            return { role: "user", content: text };
        }

        const content = [];
        if (text) content.push({ type: "text", text });

        for (const attachment of selectedAttachments) {
            if (attachment.kind === "image") {
                content.push({
                    type: "image_url",
                    image_url: { url: attachment.dataUrl }
                });
            } else {
                content.push({
                    type: "text",
                    text: `File terlampir: ${attachment.name}\n\`\`\`\n${attachment.content}\n\`\`\``
                });
            }
        }

        return { role: "user", content };
    }

    async function sendMessage(text, selectedAttachments) {
        const newMessage = buildUserMessage(text, selectedAttachments);
        messages.push(newMessage);
        appendMessage("user", text || "Lampiran", { attachments: selectedAttachments });
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
            newMessage.content = text || `Pengguna mengirim lampiran: ${selectedAttachments.map(file => file.name).join(", ")}`;
            messages.push({ role: "assistant", content });
            appendMessage("assistant", content);
            setNotice(result.model ? `Dijawab oleh ${result.model}` : "Jawaban diterima.");
            return true;
        } catch (error) {
            pendingMessage?.remove();
            messages = messages.filter(message => message !== newMessage);
            appendMessage("assistant", error.message || "Terjadi kesalahan saat menghubungi model.", { error: true });
            setNotice(error.message || "Terjadi kesalahan saat menghubungi model.", true);
            return false;
        } finally {
            requestPending = false;
            setReady(true);
            input.focus();
        }
    }

    form.addEventListener("submit", async event => {
        event.preventDefault();
        const text = input.value.trim();
        if ((!text && !attachments.length) || requestPending || !modelSelect.value) return;
        const selectedAttachments = attachments.slice();
        input.value = "";
        input.style.height = "auto";
        setReady(true);
        const sent = await sendMessage(text, selectedAttachments);
        if (sent) {
            attachments = [];
            renderAttachments();
        } else {
            input.value = text;
            setReady(true);
        }
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
        setReady(true);
    });

    attachButton.addEventListener("click", () => attachmentInput.click());
    attachmentInput.addEventListener("change", async () => {
        const selectedFiles = Array.from(attachmentInput.files || []);
        attachmentInput.value = "";
        if (!selectedFiles.length) return;

        try {
            await loadAttachments(selectedFiles);
        } catch (error) {
            setNotice(error.message || "Gagal memuat lampiran.", true);
        }
    });

    modelSelect.addEventListener("change", () => {
        if (messages.length) setNotice(`Model untuk pesan berikutnya: ${modelSelect.selectedOptions[0].textContent}`);
        setReady(true);
    });

    clearButton.addEventListener("click", () => {
        if (requestPending) return;
        messages = [];
        attachments = [];
        renderAttachments();
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
