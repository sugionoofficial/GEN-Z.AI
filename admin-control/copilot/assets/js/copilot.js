(() => {
    "use strict";

    const page = document.getElementById("copilotPage");
    const loading = document.getElementById("pageLoading");
    const notice = document.getElementById("notice");
    const fileList = document.getElementById("fileList");
    const editor = document.getElementById("fileEditor");
    const modelSelect = document.getElementById("modelSelect");
    const chatMessages = document.getElementById("chatMessages");
    const chatInput = document.getElementById("chatInput");
    const saveButton = document.getElementById("saveFileButton");
    const createPrButton = document.getElementById("createPrButton");
    const pullRequestSelect = document.getElementById("pullRequestSelect");
    const mergePrButton = document.getElementById("mergePrButton");

    const state = {
        accessToken: "",
        currentFolder: "",
        currentFile: null,
        originalContent: "",
        branch: "",
        pullRequests: [],
        busy: false
    };

    function showNotice(message, type = "info") {
        notice.textContent = String(message || "");
        notice.dataset.type = type;
        notice.hidden = !message;
    }

    function setBusy(busy) {
        state.busy = busy;
        document.querySelectorAll(".workspace button, .workspace select, .workspace input, .workspace textarea")
            .forEach(element => {
                if (element === editor && state.currentFile) return;
                element.disabled = busy || element.dataset.locked === "true";
            });
        updateEditorControls();
    }

    async function getAccessToken() {
        const client = window.GENZ_SUPABASE || window.supabaseClient;
        if (!client?.auth?.getSession) {
            throw new Error("Supabase session tidak tersedia.");
        }

        const { data, error } = await client.auth.getSession();
        if (error) throw new Error("Gagal membaca session admin.");
        const token = data?.session?.access_token;
        if (!token) throw new Error("Session login tidak ditemukan.");
        return token;
    }

    async function apiRequest(url, options = {}) {
        const response = await fetch(url, {
            ...options,
            headers: {
                Authorization: `Bearer ${state.accessToken}`,
                ...(options.body ? { "Content-Type": "application/json" } : {}),
                ...(options.headers || {})
            }
        });

        let payload = {};
        try {
            payload = await response.json();
        } catch (error) {
            console.error("[Admin Copilot] Response JSON tidak valid:", error);
            throw new Error("Response server tidak dapat dibaca.");
        }

        if (!response.ok || payload.success === false) {
            throw new Error(payload.error || `Request gagal (${response.status}).`);
        }
        return payload;
    }

    function updateEditorControls() {
        const hasFile = Boolean(state.currentFile);
        const dirty = hasFile && editor.value !== state.originalContent;
        const editorState = document.getElementById("editorState");
        editorState.textContent = dirty ? "Ada perubahan belum disimpan" : "Tidak ada perubahan";
        editorState.dataset.dirty = dirty ? "true" : "false";
        saveButton.disabled = state.busy || !dirty;
        createPrButton.disabled = state.busy || !state.branch;
        mergePrButton.disabled = state.busy || !pullRequestSelect.value;
        editor.disabled = state.busy || !hasFile;
        document.getElementById("workingBranchLabel").textContent =
            state.branch || "Belum ada branch Copilot";
        document.getElementById("branchBadge").textContent =
            state.branch || "main · read only";
    }

    function renderTree(items, path) {
        state.currentFolder = path;
        document.getElementById("currentFolder").textContent = path ? `/${path}` : "/";
        fileList.replaceChildren();

        if (path) {
            const parent = path.split("/").slice(0, -1).join("/");
            const up = document.createElement("button");
            up.type = "button";
            up.className = "file-item directory";
            up.innerHTML = '<span class="file-icon" aria-hidden="true">↰</span><span>..</span>';
            up.addEventListener("click", () => loadTree(parent));
            fileList.append(up);
        }

        if (!items.length) {
            const empty = document.createElement("p");
            empty.className = "empty-hint";
            empty.textContent = "Folder ini belum memiliki file.";
            fileList.append(empty);
            return;
        }

        items.sort((a, b) =>
            Number(b.type === "dir") - Number(a.type === "dir") ||
            a.name.localeCompare(b.name)
        );

        items.forEach(item => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = `file-item ${item.type === "dir" ? "directory" : ""}`;
            button.dataset.path = item.path;

            const icon = document.createElement("span");
            icon.className = "file-icon";
            icon.setAttribute("aria-hidden", "true");
            icon.textContent = item.type === "dir" ? "▸" : "◇";

            const label = document.createElement("span");
            label.textContent = item.name;
            button.append(icon, label);

            if (item.type === "dir") {
                button.addEventListener("click", () => loadTree(item.path));
            } else {
                button.addEventListener("click", () => loadFile(item.path));
            }
            fileList.append(button);
        });
    }

    async function loadTree(path = "") {
        setBusy(true);
        try {
            const query = new URLSearchParams({ action: "tree", path });
            const result = await apiRequest(`/api/admin-copilot?${query}`);
            renderTree(result.items, result.path);
        } catch (error) {
            console.error("[Admin Copilot] Gagal memuat folder:", error);
            showNotice(error.message, "error");
        } finally {
            setBusy(false);
        }
    }

    async function loadFile(path) {
        setBusy(true);
        try {
            const query = new URLSearchParams({ action: "file", path });
            const result = await apiRequest(`/api/admin-copilot?${query}`);
            state.currentFile = result.path;
            state.originalContent = result.content;
            state.branch = "";
            editor.value = result.content;
            document.getElementById("editorTitle").textContent = path.split("/").pop();
            document.getElementById("editorPath").textContent = result.path;
            document.getElementById("chatContext").textContent =
                `Konteks aktif: ${result.path} · ${result.size.toLocaleString("id-ID")} byte`;
            document.querySelectorAll(".file-item").forEach(button => {
                button.classList.toggle("active", button.dataset.path === result.path);
            });
            showNotice("");
        } catch (error) {
            console.error("[Admin Copilot] Gagal membaca file:", error);
            showNotice(error.message, "error");
        } finally {
            setBusy(false);
        }
    }

    async function loadModels() {
        modelSelect.innerHTML = '<option value="">Memuat model OpenKey…</option>';
        try {
            const result = await apiRequest("/api/openkey-chat", {
                method: "POST",
                body: JSON.stringify({ operation: "openkey_models" })
            });
            const models = Array.isArray(result.models) ? result.models : [];
            modelSelect.replaceChildren();

            models.forEach(model => {
                const id = String(model.id || "").trim();
                if (!id) return;
                const option = document.createElement("option");
                option.value = id;
                option.textContent = String(model.name || id);
                modelSelect.append(option);
            });

            if (!modelSelect.options.length) {
                throw new Error("Daftar model OpenKey kosong.");
            }
            modelSelect.disabled = false;
        } catch (error) {
            console.error("[Admin Copilot] Gagal memuat model OpenKey:", error);
            modelSelect.replaceChildren(new Option("Model OpenKey tidak tersedia", ""));
            modelSelect.disabled = true;
            showNotice(`Model OpenKey gagal dimuat: ${error.message}`, "error");
        }
    }

    function appendMessage(role, content, { code = false } = {}) {
        const message = document.createElement("article");
        message.className = `chat-message ${role}`;

        const label = document.createElement("p");
        label.className = "message-role";
        label.textContent = role === "user" ? "YOU" : "OPENKEY COPILOT";

        const body = document.createElement("div");
        body.className = "message-body";
        body.textContent = content;
        message.append(label, body);

        if (role === "assistant" && code) {
            const useCode = document.createElement("button");
            useCode.type = "button";
            useCode.className = "button button-secondary use-code-button";
            useCode.textContent = "Gunakan kode di editor";
            useCode.addEventListener("click", () => {
                if (!state.currentFile) {
                    showNotice("Pilih file terlebih dahulu.", "error");
                    return;
                }
                editor.value = code;
                updateEditorControls();
                editor.focus();
                showNotice("Kode AI dimasukkan ke editor. Tinjau sebelum disimpan.", "success");
            });
            message.append(useCode);
        }

        chatMessages.append(message);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function extractCode(content) {
        const match = String(content || "").match(/```[^\n]*\n([\s\S]*?)```/);
        return match ? match[1].replace(/\n$/, "") : "";
    }

    async function sendChat(event) {
        event.preventDefault();
        const prompt = chatInput.value.trim();
        const model = modelSelect.value;
        if (!prompt || !model || state.busy) return;

        const fileContext = state.currentFile
            ? `\n\nFile aktif: ${state.currentFile}\nIsi file:\n\`\`\`\n${editor.value.slice(0, 30000)}\n\`\`\``
            : "";
        const messages = [
            {
                role: "system",
                content:
                    "Kamu adalah asisten coding untuk repository GEN-Z.AI. " +
                    "Jangan mengklaim sudah mengubah repository. Jangan menjalankan shell, tool, deployment, atau operasi GitHub. " +
                    "Bila diminta mengubah file aktif, balas ringkasan singkat lalu berikan satu blok kode fenced berisi SELURUH isi file hasil revisi. " +
                    "Jangan potong file atau mengganti bagian yang tidak terkait. Jika tidak ada file aktif, jawab seperti asisten coding biasa."
            },
            { role: "user", content: `${prompt}${fileContext}` }
        ];

        appendMessage("user", prompt);
        chatInput.value = "";
        setBusy(true);
        try {
            const result = await apiRequest("/api/openkey-chat", {
                method: "POST",
                body: JSON.stringify({
                    model,
                    messages,
                    temperature: 0.2,
                    max_tokens: 8192
                })
            });
            const answer = String(result.content || "").trim();
            if (!answer) throw new Error("Model OpenKey tidak mengembalikan teks.");
            appendMessage("assistant", answer, { code: extractCode(answer) });
        } catch (error) {
            console.error("[Admin Copilot] Chat OpenKey gagal:", error);
            appendMessage("assistant", `Permintaan gagal: ${error.message}`);
        } finally {
            setBusy(false);
        }
    }

    async function saveFile() {
        if (!state.currentFile || editor.value === state.originalContent) return;
        setBusy(true);
        try {
            const message = document.getElementById("commitMessage").value.trim();
            const result = await apiRequest("/api/admin-copilot", {
                method: "POST",
                body: JSON.stringify({
                    action: "commit_file",
                    path: state.currentFile,
                    content: editor.value,
                    message: message || `Update ${state.currentFile}`,
                    branch: state.branch || undefined
                })
            });
            state.branch = result.branch;
            state.originalContent = editor.value;
            document.getElementById("commitMessage").value = "";
            updateEditorControls();
            showNotice(`Commit berhasil disimpan ke ${result.branch}. Main tidak berubah.`, "success");
            await loadPullRequests(false);
        } catch (error) {
            console.error("[Admin Copilot] Commit file gagal:", error);
            showNotice(error.message, "error");
        } finally {
            setBusy(false);
        }
    }

    async function createPullRequest() {
        if (!state.branch) return;
        const title = window.prompt("Judul pull request:", `Update ${state.currentFile || "GEN-Z.AI"}`);
        if (title === null || !title.trim()) return;
        const description = window.prompt("Deskripsi singkat pull request:", "Perubahan dibuat dari Admin Copilot.") || "";

        setBusy(true);
        try {
            const result = await apiRequest("/api/admin-copilot", {
                method: "POST",
                body: JSON.stringify({
                    action: "create_pull_request",
                    branch: state.branch,
                    title: title.trim(),
                    body: description.trim()
                })
            });
            showNotice(`PR #${result.pullRequest.number} berhasil dibuat.`, "success");
            await loadPullRequests(false);
            pullRequestSelect.value = String(result.pullRequest.number);
            updateEditorControls();
        } catch (error) {
            console.error("[Admin Copilot] Pembuatan PR gagal:", error);
            showNotice(error.message, "error");
        } finally {
            setBusy(false);
        }
    }

    async function loadPullRequests(showErrors = true) {
        try {
            const result = await apiRequest("/api/admin-copilot?action=pulls");
            state.pullRequests = result.pullRequests;
            pullRequestSelect.replaceChildren();
            const placeholder = new Option(
                result.pullRequests.length ? "Pilih PR untuk ditinjau…" : "Tidak ada PR Copilot terbuka",
                ""
            );
            pullRequestSelect.add(placeholder);

            result.pullRequests.forEach(pull => {
                pullRequestSelect.add(new Option(
                    `#${pull.number} · ${pull.title}`,
                    String(pull.number)
                ));
            });
            if (showErrors) showNotice("");
        } catch (error) {
            console.error("[Admin Copilot] Gagal memuat daftar PR:", error);
            if (showErrors) showNotice(error.message, "error");
        } finally {
            updateEditorControls();
        }
    }

    async function mergePullRequest() {
        const number = Number(pullRequestSelect.value);
        if (!number) return;
        const phrase = window.prompt(
            `Merge PR #${number} ke main hanya jika semua CI lulus.\nKetik MERGE #${number} untuk mengonfirmasi:`
        );
        if (phrase !== `MERGE #${number}`) {
            showNotice("Konfirmasi merge dibatalkan.", "info");
            return;
        }

        setBusy(true);
        try {
            const result = await apiRequest("/api/admin-copilot", {
                method: "POST",
                body: JSON.stringify({
                    action: "merge_pull_request",
                    pullRequestNumber: number
                })
            });
            showNotice(`PR #${number} berhasil di-merge.`, "success");
            await loadPullRequests(false);
        } catch (error) {
            console.error("[Admin Copilot] Merge PR gagal:", error);
            showNotice(error.message, "error");
        } finally {
            setBusy(false);
        }
    }

    async function initialize() {
        try {
            const ready = window.GENZNavigationReady
                ? await window.GENZNavigationReady
                : false;
            const role = String(window.GENZ_NAVIGATION_ROLE || "").toLowerCase();
            if (ready !== true || !["admin", "owner"].includes(role)) {
                window.location.replace("/user/dashboard.html");
                return;
            }

            state.accessToken = await getAccessToken();
            page.hidden = false;
            loading.hidden = true;

            await Promise.all([
                loadTree(),
                loadPullRequests(),
                loadModels()
            ]);

            chatMessages.innerHTML = "";
            const placeholder = document.createElement("p");
            placeholder.className = "chat-placeholder";
            placeholder.textContent = "Pilih model dan tulis instruksi. AI dapat membantu merevisi file aktif, tetapi perubahan tidak disimpan sebelum kamu meninjau dan menekan tombol commit.";
            chatMessages.append(placeholder);
        } catch (error) {
            console.error("[Admin Copilot] Inisialisasi gagal:", error);
            loading.innerHTML = "";
            const message = document.createElement("p");
            message.textContent = error.message || "Gagal memuat Admin Copilot.";
            loading.append(message);
        }
    }

    editor.addEventListener("input", updateEditorControls);
    document.getElementById("refreshTreeButton").addEventListener("click", () => loadTree(state.currentFolder));
    document.getElementById("chatForm").addEventListener("submit", sendChat);
    saveButton.addEventListener("click", saveFile);
    createPrButton.addEventListener("click", createPullRequest);
    mergePrButton.addEventListener("click", mergePullRequest);
    pullRequestSelect.addEventListener("change", updateEditorControls);

    void initialize();
})();
