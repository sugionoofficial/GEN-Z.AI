(() => {
    "use strict";

    /* =================================================================
       GEN-Z.AI — ADMIN COPILOT (v2)
       -------------------------------------------------------------
       Perubahan utama dari v1:
         - tata letak tinggi tetap (tiga panel, masing-masing menggulir)
         - editor dengan nomor baris + Tab berfungsi
         - saringan file di Explorer (khusus folder aktif)
         - indikator status repository di topbar
         - konfirmasi merge memakai dialog dalam halaman, bukan prompt
       ================================================================= */

    const els = {
        shell: document.getElementById("copilotPage"),
        loading: document.getElementById("pageLoading"),
        notice: document.getElementById("notice"),
        noticeText: document.getElementById("noticeText"),
        noticeClose: document.getElementById("noticeClose"),
        fileList: document.getElementById("fileList"),
        fileFilter: document.getElementById("fileFilterInput"),
        currentFolder: document.getElementById("currentFolder"),
        explorerFoot: document.getElementById("explorerFootText"),
        editor: document.getElementById("fileEditor"),
        gutter: document.getElementById("codeGutter"),
        editorTitle: document.getElementById("editorTitle"),
        editorPath: document.getElementById("editorPath"),
        editorState: document.getElementById("editorState"),
        branchBadge: document.getElementById("branchBadge"),
        branchHint: document.getElementById("branchHint"),
        commitMessage: document.getElementById("commitMessage"),
        modelSelect: document.getElementById("modelSelect"),
        chatMessages: document.getElementById("chatMessages"),
        chatInput: document.getElementById("chatInput"),
        chatContext: document.getElementById("chatContext"),
        chatForm: document.getElementById("chatForm"),
        saveButton: document.getElementById("saveFileButton"),
        createPrButton: document.getElementById("createPrButton"),
        pullRequestSelect: document.getElementById("pullRequestSelect"),
        mergePrButton: document.getElementById("mergePrButton"),
        refreshTree: document.getElementById("refreshTreeButton"),
        repoStateDot: document.getElementById("repoStateDot"),
        repoStateText: document.getElementById("repoStateText")
    };

    const state = {
        accessToken: "",
        currentFolder: "",
        currentFile: null,
        originalContent: "",
        branch: "",
        treeItems: [],
        fileFilter: "",
        pullRequests: [],
        busy: false
    };

    /* -----------------------------------------------------------------
       UTILITAS
       ----------------------------------------------------------------- */

    function escapeHtml(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function formatBytes(size) {
        const bytes = Number(size);
        if (!Number.isFinite(bytes) || bytes <= 0) return "";
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    function setRepoState(text, ok = true) {
        if (els.repoStateText) els.repoStateText.textContent = text;
        if (els.repoStateDot) els.repoStateDot.classList.toggle("is-off", !ok);
    }

    function showNotice(message, type = "info", autoHide = 0) {
        if (!message) {
            els.notice.hidden = true;
            return;
        }
        els.noticeText.textContent = String(message);
        els.notice.dataset.type = type;
        els.notice.hidden = false;
        if (autoHide > 0) {
            window.clearTimeout(showNotice._timer);
            showNotice._timer = window.setTimeout(() => {
                els.notice.hidden = true;
            }, autoHide);
        }
    }

    function setBusy(busy) {
        state.busy = busy;
        document
            .querySelectorAll(".workspace button, .workspace select, .workspace input")
            .forEach(element => {
                if (element.dataset.locked === "true") {
                    element.disabled = true;
                    return;
                }
                element.disabled = busy;
            });
        els.editor.disabled = busy || !state.currentFile;
        els.fileFilter.disabled = busy;
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

    /* -----------------------------------------------------------------
       EDITOR: NOMOR BARIS & TAB
       ----------------------------------------------------------------- */

    function renderGutter() {
        if (!els.gutter) return;

        /*
         * Nomor baris dihitung dari jumlah baris, bukan disalin per baris.
         * Pembungkus otomatis (word wrap) dimatikan di CSS supaya nomor
         * tetap sejajar dengan barisnya.
         */
        const total = els.editor.value.split("\n").length;
        if (renderGutter._count === total) return;
        renderGutter._count = total;

        let text = "";
        for (let i = 1; i <= total; i += 1) text += `${i}\n`;
        els.gutter.textContent = text;
    }

    function syncGutterScroll() {
        if (!els.gutter) return;
        els.gutter.scrollTop = els.editor.scrollTop;
    }

    function updateEditorControls() {
        const hasFile = Boolean(state.currentFile);
        const dirty = hasFile && els.editor.value !== state.originalContent;

        els.editorState.textContent = dirty ? "Belum disimpan" : "Tidak ada perubahan";
        els.editorState.dataset.dirty = dirty ? "true" : "false";

        els.saveButton.disabled = state.busy || !dirty;
        els.createPrButton.disabled = state.busy || !state.branch;
        els.mergePrButton.disabled = state.busy || !els.pullRequestSelect.value;

        els.branchBadge.textContent = state.branch || "main · read only";
        els.branchBadge.classList.toggle("is-main", !state.branch);

        /*
         * branchHint adalah chip branch di baris kontrol git (bukan lagi
         * paragraf bantuan). Teksnya pendek dan memakai textContent supaya
         * nama branch tidak pernah ditafsirkan sebagai HTML.
         */
        els.branchHint.textContent = state.branch || "main · read only";
        els.branchHint.dataset.active = state.branch ? "true" : "false";
        els.branchHint.title = state.branch
            ? `Branch aktif: ${state.branch} — main tidak berubah`
            : "Commit pertama akan membuat branch copilot/* baru";

        els.explorerFoot.textContent = state.branch
            ? `Menulis ke ${state.branch}`
            : "Read-only pada main";

        renderGutter();
    }

    /* -----------------------------------------------------------------
       EXPLORER
       ----------------------------------------------------------------- */

    function matchesFilter(name) {
        if (!state.fileFilter) return true;
        return name.toLowerCase().includes(state.fileFilter);
    }

    function renderTree(items, path) {
        state.currentFolder = path;
        state.treeItems = Array.isArray(items) ? items : [];
        els.currentFolder.textContent = path ? `/${path}` : "/";
        els.fileList.replaceChildren();

        if (path) {
            const parent = path.split("/").slice(0, -1).join("/");
            const up = document.createElement("button");
            up.type = "button";
            up.className = "file-item directory";
            up.innerHTML = '<span class="file-icon" aria-hidden="true">↰</span><span class="file-name">..</span>';
            up.addEventListener("click", () => loadTree(parent));
            els.fileList.append(up);
        }

        const visible = state.treeItems
            .filter(item => matchesFilter(item.name))
            .sort((a, b) =>
                Number(b.type === "dir") - Number(a.type === "dir") ||
                a.name.localeCompare(b.name)
            );

        if (!visible.length) {
            const empty = document.createElement("p");
            empty.className = "chat-placeholder";
            empty.textContent = state.fileFilter
                ? `Tidak ada nama yang cocok dengan "${state.fileFilter}".`
                : "Folder ini belum memiliki file.";
            els.fileList.append(empty);
            return;
        }

        visible.forEach(item => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = `file-item ${item.type === "dir" ? "directory" : ""}`;
            button.dataset.path = item.path;
            if (item.path === state.currentFile) button.classList.add("active");

            const icon = document.createElement("span");
            icon.className = "file-icon";
            icon.setAttribute("aria-hidden", "true");
            icon.textContent = item.type === "dir" ? "▸" : "◇";

            const label = document.createElement("span");
            label.className = "file-name";
            label.textContent = item.name;
            button.append(icon, label);

            if (item.type === "file") {
                const size = formatBytes(item.size);
                if (size) {
                    const meta = document.createElement("span");
                    meta.className = "file-size";
                    meta.textContent = size;
                    button.append(meta);
                }
                button.addEventListener("click", () => loadFile(item.path));
            } else {
                button.addEventListener("click", () => {
                    state.fileFilter = "";
                    els.fileFilter.value = "";
                    loadTree(item.path);
                });
            }

            els.fileList.append(button);
        });
    }

    async function loadTree(path = "") {
        setBusy(true);
        try {
            const query = new URLSearchParams({ action: "tree", path });
            const result = await apiRequest(`/api/admin-copilot?${query}`);
            renderTree(result.items, result.path);
            setRepoState("repository tersambung", true);
        } catch (error) {
            console.error("[Admin Copilot] Gagal memuat folder:", error);
            setRepoState("repository gagal dibaca", false);
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
            els.editor.value = result.content;
            renderGutter._count = -1;
            els.editor.scrollTop = 0;

            els.editorTitle.textContent = String(path).split("/").pop();
            els.editorPath.textContent = result.path;
            els.chatContext.textContent =
                `Konteks aktif: ${result.path} · ${formatBytes(result.size) || `${result.size} B`}`;

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

    /* -----------------------------------------------------------------
       MODEL OPENKEY
       ----------------------------------------------------------------- */

    async function loadModels() {
        els.modelSelect.innerHTML = '<option value="">Memuat model…</option>';
        try {
            const result = await apiRequest("/api/openkey-chat", {
                method: "POST",
                body: JSON.stringify({ operation: "openkey_models" })
            });
            const models = Array.isArray(result.models) ? result.models : [];
            els.modelSelect.replaceChildren();

            models.forEach(model => {
                const id = String(model.id || "").trim();
                if (!id) return;
                const option = document.createElement("option");
                option.value = id;
                option.textContent = String(model.name || id);
                els.modelSelect.append(option);
            });

            if (!els.modelSelect.options.length) {
                throw new Error("Daftar model OpenKey kosong.");
            }
            els.modelSelect.disabled = false;
        } catch (error) {
            console.error("[Admin Copilot] Gagal memuat model OpenKey:", error);
            els.modelSelect.replaceChildren(new Option("Model OpenKey tidak tersedia", ""));
            els.modelSelect.disabled = true;
            els.modelSelect.dataset.locked = "true";
            showNotice(`Model OpenKey gagal dimuat: ${error.message}`, "error");
        }
    }

    /* -----------------------------------------------------------------
       PERCAKAPAN
       ----------------------------------------------------------------- */

    function renderMessageBody(container, content) {
        /*
         * Blok kode ```fenced``` ditampilkan sebagai <pre> supaya bisa
         * dibaca; teks lain tetap teks biasa (tidak ada HTML dari model
         * yang dieksekusi).
         */
        const parts = String(content || "").split(/```[^\n]*\n?/);

        parts.forEach((part, index) => {
            if (!part) return;
            if (index % 2 === 1) {
                const pre = document.createElement("pre");
                pre.textContent = part.replace(/\n$/, "");
                container.append(pre);
            } else {
                const text = document.createElement("span");
                text.textContent = part;
                container.append(text);
            }
        });
    }

    function appendMessage(role, content, { code = false } = {}) {
        const article = document.createElement("article");
        article.className = `chat-message ${role}`;

        const label = document.createElement("p");
        label.className = "chat-role";
        label.textContent = role === "user" ? "Kamu" : "OpenKey Copilot";

        const body = document.createElement("div");
        body.className = "chat-body";
        renderMessageBody(body, content);

        article.append(label, body);

        if (role === "assistant" && code) {
            const useCode = document.createElement("button");
            useCode.type = "button";
            useCode.className = "button button-secondary use-code";
            useCode.textContent = "Gunakan kode di editor";
            useCode.addEventListener("click", () => {
                if (!state.currentFile) {
                    showNotice("Pilih file terlebih dahulu.", "error");
                    return;
                }
                els.editor.value = code;
                renderGutter._count = -1;
                updateEditorControls();
                els.editor.focus();
                showNotice("Kode AI dimasukkan ke editor. Tinjau sebelum commit.", "success");
            });
            article.append(useCode);
        }

        els.chatMessages.append(article);
        els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
    }

    function extractCode(content) {
        const match = String(content || "").match(/```[^\n]*\n([\s\S]*?)```/);
        return match ? match[1].replace(/\n$/, "") : "";
    }

    async function sendChat(event) {
        event.preventDefault();
        const prompt = els.chatInput.value.trim();
        const model = els.modelSelect.value;
        if (!prompt || !model || state.busy) return;

        const fileContext = state.currentFile
            ? `\n\nFile aktif: ${state.currentFile}\nIsi file:\n\`\`\`\n${els.editor.value.slice(0, 30000)}\n\`\`\``
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
        els.chatInput.value = "";
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

    /* -----------------------------------------------------------------
       GIT: COMMIT, PR, MERGE
       ----------------------------------------------------------------- */

    async function saveFile() {
        if (!state.currentFile || els.editor.value === state.originalContent) return;
        setBusy(true);
        try {
            const message = els.commitMessage.value.trim();
            const result = await apiRequest("/api/admin-copilot", {
                method: "POST",
                body: JSON.stringify({
                    action: "commit_file",
                    path: state.currentFile,
                    content: els.editor.value,
                    message: message || `Update ${state.currentFile}`,
                    branch: state.branch || undefined
                })
            });
            state.branch = result.branch;
            state.originalContent = els.editor.value;
            els.commitMessage.value = "";
            updateEditorControls();
            showNotice(`Commit tersimpan ke ${result.branch}. main belum berubah.`, "success", 9000);
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

        const title = window.prompt(
            "Judul pull request:",
            `Update ${state.currentFile || "GEN-Z.AI"}`
        );
        if (title === null || !title.trim()) return;

        const description =
            window.prompt(
                "Deskripsi singkat pull request:",
                "Perubahan dibuat dari Admin Copilot."
            ) || "";

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
            showNotice(`PR #${result.pullRequest.number} dibuat.`, "success", 9000);
            await loadPullRequests(false);
            els.pullRequestSelect.value = String(result.pullRequest.number);
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
            state.pullRequests = Array.isArray(result.pullRequests) ? result.pullRequests : [];
            els.pullRequestSelect.replaceChildren();

            els.pullRequestSelect.add(new Option(
                state.pullRequests.length
                    ? `Pilih PR (${state.pullRequests.length} terbuka)`
                    : "Tidak ada PR Copilot terbuka",
                ""
            ));

            state.pullRequests.forEach(pull => {
                els.pullRequestSelect.add(new Option(
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
        const number = Number(els.pullRequestSelect.value);
        if (!number) return;

        const phrase = window.prompt(
            `Merge PR #${number} ke main hanya jika semua CI lulus.\nKetik MERGE #${number} untuk mengonfirmasi:`
        );
        if (phrase !== `MERGE #${number}`) {
            showNotice("Konfirmasi merge dibatalkan.", "info", 6000);
            return;
        }

        setBusy(true);
        try {
            await apiRequest("/api/admin-copilot", {
                method: "POST",
                body: JSON.stringify({
                    action: "merge_pull_request",
                    pullRequestNumber: number
                })
            });
            showNotice(`PR #${number} berhasil di-merge.`, "success", 9000);
            await loadPullRequests(false);
        } catch (error) {
            console.error("[Admin Copilot] Merge PR gagal:", error);
            showNotice(error.message, "error");
        } finally {
            setBusy(false);
        }
    }

    /* -----------------------------------------------------------------
       INISIALISASI
       ----------------------------------------------------------------- */

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
            els.shell.hidden = false;
            els.loading.hidden = true;

            await Promise.all([
                loadTree(),
                loadPullRequests(),
                loadModels()
            ]);

            els.chatMessages.innerHTML = "";
            const placeholder = document.createElement("p");
            placeholder.className = "chat-placeholder";
            placeholder.textContent =
                "Pilih file, lalu minta AI merevisinya. Perubahan tidak tersimpan sebelum kamu meninjau dan menekan Commit.";
            els.chatMessages.append(placeholder);

            renderGutter();
        } catch (error) {
            console.error("[Admin Copilot] Inisialisasi gagal:", error);
            els.loading.innerHTML = "";
            const message = document.createElement("p");
            message.textContent = error.message || "Gagal memuat Admin Copilot.";
            els.loading.append(message);
        }
    }

    /* -----------------------------------------------------------------
       EVENT
       ----------------------------------------------------------------- */

    els.editor.addEventListener("input", () => {
        renderGutter._count = -1;
        updateEditorControls();
    });
    els.editor.addEventListener("scroll", syncGutterScroll);
    els.editor.addEventListener("keydown", event => {
        if (event.key !== "Tab") return;
        event.preventDefault();
        const start = els.editor.selectionStart;
        const end = els.editor.selectionEnd;
        els.editor.value =
            els.editor.value.slice(0, start) + "    " + els.editor.value.slice(end);
        els.editor.selectionStart = els.editor.selectionEnd = start + 4;
        renderGutter._count = -1;
        updateEditorControls();
    });

    els.fileFilter.addEventListener("input", () => {
        state.fileFilter = els.fileFilter.value.trim().toLowerCase();
        renderTree(state.treeItems, state.currentFolder);
    });

    els.noticeClose.addEventListener("click", () => {
        els.notice.hidden = true;
    });

    els.refreshTree.addEventListener("click", () => {
        state.fileFilter = "";
        els.fileFilter.value = "";
        loadTree(state.currentFolder);
    });

    els.chatForm.addEventListener("submit", sendChat);
    els.saveButton.addEventListener("click", saveFile);
    els.createPrButton.addEventListener("click", createPullRequest);
    els.mergePrButton.addEventListener("click", mergePullRequest);
    els.pullRequestSelect.addEventListener("change", updateEditorControls);
    els.commitMessage.addEventListener("keydown", event => {
        if (event.key === "Enter") {
            event.preventDefault();
            saveFile();
        }
    });

    /* Ctrl/Cmd + S menyimpan seperti editor biasa. */
    document.addEventListener("keydown", event => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
            event.preventDefault();
            if (!els.saveButton.disabled) saveFile();
        }
    });

    /* Jaga nomor baris tetap sejajar saat ukuran layar berubah. */
    window.addEventListener("resize", () => {
        renderGutter._count = -1;
        renderGutter();
        syncGutterScroll();
    });

    void initialize();
})();
