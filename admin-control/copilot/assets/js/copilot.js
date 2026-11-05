(() => {
    "use strict";

    /* =================================================================
       GEN-Z.AI — ADMIN COPILOT (v3) — Sesi + Konektor + Upload + Copy
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
        repoStateText: document.getElementById("repoStateText"),
        // Sesi
        sessionSelect: document.getElementById("sessionSelect"),
        newSessionButton: document.getElementById("newSessionButton"),
        renameSessionButton: document.getElementById("renameSessionButton"),
        deleteSessionButton: document.getElementById("deleteSessionButton"),
        // Connectors
        supabaseConnector: document.getElementById("supabaseConnector"),
        cloudflareConnector: document.getElementById("cloudflareConnector"),
        supabaseStatusDot: document.getElementById("supabaseStatusDot"),
        supabaseStatusText: document.getElementById("supabaseStatusText"),
        cloudflareStatusDot: document.getElementById("cloudflareStatusDot"),
        cloudflareStatusText: document.getElementById("cloudflareStatusText"),
        supabaseDetail: document.getElementById("supabaseDetail"),
        cloudflareDetail: document.getElementById("cloudflareDetail"),
        // Upload
        attachButton: document.getElementById("attachButton"),
        fileInput: document.getElementById("fileInput"),
        uploadPreview: document.getElementById("uploadPreview"),
        attachmentsBar: document.getElementById("attachmentsBar"),
        attachmentsCount: document.getElementById("attachmentsCount"),
        saveToStorageToggle: document.getElementById("saveToStorageToggle"),
        clearAttachmentsButton: document.getElementById("clearAttachmentsButton")
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
        busy: false,
        sessions: [],
        currentSessionId: null,
        attachments: []
    };

    const LS_KEY = "genz.copilot.sessions.v3";
    const LS_ACTIVE = "genz.copilot.activeSession.v3";

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
        if (!message) { els.notice.hidden = true; return; }
        els.noticeText.textContent = String(message);
        els.notice.dataset.type = type;
        els.notice.hidden = false;
        if (autoHide > 0) {
            window.clearTimeout(showNotice._timer);
            showNotice._timer = window.setTimeout(() => { els.notice.hidden = true; }, autoHide);
        }
    }

    function setBusy(busy) {
        state.busy = busy;
        document.querySelectorAll(".workspace button, .workspace select, .workspace input").forEach(element => {
            if (element.dataset.locked === "true") { element.disabled = true; return; }
            element.disabled = busy;
        });
        els.editor.disabled = busy || !state.currentFile;
        els.fileFilter.disabled = busy;
        updateEditorControls();
    }

    async function getAccessToken() {
        const client = window.GENZ_SUPABASE || window.supabaseClient;
        if (!client?.auth?.getSession) throw new Error("Supabase session tidak tersedia.");
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
        try { payload = await response.json(); } catch (error) {
            console.error("[Admin Copilot] Response JSON tidak valid:", error);
            throw new Error("Response server tidak dapat dibaca.");
        }
        if (!response.ok || payload.success === false) throw new Error(payload.error || `Request gagal (${response.status}).`);
        return payload;
    }

    /* -----------------------------------------------------------------
       SESI — persistent chat history
       ----------------------------------------------------------------- */

    function generateId() {
        return `s_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
    }

    function loadSessionsLocal() {
        try {
            const raw = localStorage.getItem(LS_KEY);
            const arr = raw ? JSON.parse(raw) : [];
            if (Array.isArray(arr) && arr.length) return arr;
        } catch {}
        return [{ id: generateId(), title: "Percakapan Baru", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), messages: [] }];
    }

    function saveSessionsLocal() {
        try {
            localStorage.setItem(LS_KEY, JSON.stringify(state.sessions));
            if (state.currentSessionId) localStorage.setItem(LS_ACTIVE, state.currentSessionId);
        } catch {}
    }

    async function syncSessionsToSupabase() {
        // best-effort sync each session's messages to server (if table exists)
        if (!state.accessToken) return;
        for (const s of state.sessions.slice(0,3)) { // limit to avoid spam
            try {
                await apiRequest("/api/copilot-session", { method:"POST", body: JSON.stringify({ action:"update", id: s.id, title: s.title, messages: s.messages }) });
            } catch {}
        }
    }

    async function loadSessions() {
        state.sessions = loadSessionsLocal();
        try {
            const r = await apiRequest("/api/copilot-session");
            if (Array.isArray(r.sessions) && r.sessions.length) {
                // merge: supabase is source of truth if has data
                // keep local messages if supabase empty
                const byId = new Map(state.sessions.map(s=>[s.id,s]));
                for (const row of r.sessions) {
                    if (!byId.has(row.id)) {
                        state.sessions.push({ id: row.id, title: row.title, createdAt: row.created_at, updatedAt: row.updated_at, messages: Array.isArray(row.messages)?row.messages:[] });
                    } else {
                        const local = byId.get(row.id);
                        if (Array.isArray(row.messages) && row.messages.length > (local.messages?.length||0)) local.messages = row.messages;
                    }
                }
            }
        } catch {}
        const active = localStorage.getItem(LS_ACTIVE);
        state.currentSessionId = state.sessions.find(s=>s.id===active)?.id || state.sessions[0].id;
        renderSessions();
        renderChatFromSession();
    }

    function renderSessions() {
        if (!els.sessionSelect) return;
        els.sessionSelect.replaceChildren();
        state.sessions.forEach(s => {
            const o = document.createElement("option");
            o.value = s.id;
            o.textContent = `${s.title} (${(s.messages||[]).length})`;
            if (s.id===state.currentSessionId) o.selected = true;
            els.sessionSelect.append(o);
        });
    }

    function currentSession() { return state.sessions.find(s=>s.id===state.currentSessionId) || state.sessions[0]; }

    function createSession() {
        const s = { id: generateId(), title: `Percakapan ${state.sessions.length+1}`, createdAt:new Date().toISOString(), updatedAt:new Date().toISOString(), messages:[] };
        state.sessions.unshift(s);
        state.currentSessionId = s.id;
        saveSessionsLocal();
        try { apiRequest("/api/copilot-session",{method:"POST",body:JSON.stringify({action:"create", title:s.title})}).catch(()=>{}); } catch {}
        renderSessions();
        renderChatFromSession();
        showNotice(`Sesi baru: ${s.title}`, "success", 3000);
    }

    function switchSession(id) {
        if (!id || !state.sessions.find(s=>s.id===id)) return;
        state.currentSessionId = id;
        saveSessionsLocal();
        renderSessions();
        renderChatFromSession();
    }

    function renameSession() {
        const s = currentSession(); if (!s) return;
        const t = window.prompt("Nama baru sesi:", s.title);
        if (t===null || !t.trim()) return;
        s.title = t.trim().slice(0,80);
        s.updatedAt = new Date().toISOString();
        saveSessionsLocal();
        renderSessions();
        try { apiRequest("/api/copilot-session",{method:"POST",body:JSON.stringify({action:"update", id:s.id, title:s.title})}).catch(()=>{});}catch{}
    }

    function deleteSession() {
        if (state.sessions.length<=1) { showNotice("Minimal 1 sesi harus ada", "error", 3000); return; }
        const s = currentSession();
        if (!window.confirm(`Hapus sesi "${s.title}"?`)) return;
        state.sessions = state.sessions.filter(x=>x.id!==s.id);
        state.currentSessionId = state.sessions[0].id;
        saveSessionsLocal();
        renderSessions();
        renderChatFromSession();
        try { apiRequest("/api/copilot-session",{method:"POST",body:JSON.stringify({action:"delete", id:s.id})}).catch(()=>{});}catch{}
    }

    function persistMessage(role, content, attachments) {
        const s = currentSession(); if (!s) return;
        s.messages.push({ role, content, attachments: attachments||[], at: new Date().toISOString() });
        s.updatedAt = new Date().toISOString();
        // batasi 200 pesan per sesi
        if (s.messages.length>200) s.messages = s.messages.slice(-200);
        saveSessionsLocal();
        renderSessions();
        // async sync
        clearTimeout(persistMessage._t);
        persistMessage._t = setTimeout(()=>{ syncSessionsToSupabase(); }, 1200);
    }

    function renderChatFromSession() {
        els.chatMessages.replaceChildren();
        const s = currentSession();
        if (!s || !s.messages.length) {
            const p = document.createElement("p");
            p.className = "chat-placeholder";
            p.textContent = "Pilih file, lalu minta AI merevisinya. Perubahan tidak tersimpan sebelum kamu meninjau dan menekan Commit.";
            els.chatMessages.append(p);
            return;
        }
        s.messages.forEach(m => {
            // re-render without re-persisting
            appendMessage(m.role, m.content, { code: m.role==="assistant" ? extractCode(m.content) : false, persist:false, attachments: m.attachments });
        });
    }

    /* -----------------------------------------------------------------
       EDITOR: NOMOR BARIS & TAB
       ----------------------------------------------------------------- */

    function renderGutter() {
        if (!els.gutter) return;
        const total = els.editor.value.split("\n").length;
        if (renderGutter._count === total) return;
        renderGutter._count = total;
        let text = "";
        for (let i = 1; i <= total; i += 1) text += `${i}\n`;
        els.gutter.textContent = text;
    }
    function syncGutterScroll() { if (!els.gutter) return; els.gutter.scrollTop = els.editor.scrollTop; }
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
        els.branchHint.textContent = state.branch || "main · read only";
        els.branchHint.dataset.active = state.branch ? "true" : "false";
        els.branchHint.title = state.branch ? `Branch aktif: ${state.branch} — main tidak berubah` : "Commit pertama akan membuat branch copilot/* baru";
        els.explorerFoot.textContent = state.branch ? `Menulis ke ${state.branch}` : "Read-only pada main";
        renderGutter();
    }

    /* -----------------------------------------------------------------
       EXPLORER
       ----------------------------------------------------------------- */

    function matchesFilter(name) { if (!state.fileFilter) return true; return name.toLowerCase().includes(state.fileFilter); }
    function renderTree(items, path) {
        state.currentFolder = path;
        state.treeItems = Array.isArray(items) ? items : [];
        els.currentFolder.textContent = path ? `/${path}` : "/";
        els.fileList.replaceChildren();
        if (path) {
            const parent = path.split("/").slice(0, -1).join("/");
            const up = document.createElement("button");
            up.type = "button"; up.className = "file-item directory";
            up.innerHTML = '<span class="file-icon" aria-hidden="true">↰</span><span class="file-name">..</span>';
            up.addEventListener("click", () => loadTree(parent));
            els.fileList.append(up);
        }
        const visible = state.treeItems.filter(item => matchesFilter(item.name)).sort((a,b)=> Number(b.type==="dir") - Number(a.type==="dir") || a.name.localeCompare(b.name));
        if (!visible.length) {
            const empty = document.createElement("p"); empty.className = "chat-placeholder";
            empty.textContent = state.fileFilter ? `Tidak ada nama yang cocok dengan "${state.fileFilter}".` : "Folder ini belum memiliki file.";
            els.fileList.append(empty); return;
        }
        visible.forEach(item => {
            const button = document.createElement("button");
            button.type = "button"; button.className = `file-item ${item.type==="dir"?"directory":""}`; button.dataset.path = item.path;
            if (item.path === state.currentFile) button.classList.add("active");
            const icon = document.createElement("span"); icon.className = "file-icon"; icon.setAttribute("aria-hidden","true"); icon.textContent = item.type==="dir"?"▸":"◇";
            const label = document.createElement("span"); label.className = "file-name"; label.textContent = item.name;
            button.append(icon, label);
            if (item.type==="file") {
                const size = formatBytes(item.size);
                if (size) { const meta=document.createElement("span"); meta.className="file-size"; meta.textContent=size; button.append(meta); }
                button.addEventListener("click", () => loadFile(item.path));
            } else { button.addEventListener("click", () => { state.fileFilter=""; els.fileFilter.value=""; loadTree(item.path); }); }
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
        } finally { setBusy(false); }
    }
    async function loadFile(path) {
        setBusy(true);
        try {
            const query = new URLSearchParams({ action: "file", path });
            const result = await apiRequest(`/api/admin-copilot?${query}`);
            state.currentFile = result.path; state.originalContent = result.content; state.branch = "";
            els.editor.value = result.content; renderGutter._count = -1; els.editor.scrollTop = 0;
            els.editorTitle.textContent = String(path).split("/").pop();
            els.editorPath.textContent = result.path;
            els.chatContext.textContent = `Konteks aktif: ${result.path} · ${formatBytes(result.size) || `${result.size} B`}`;
            document.querySelectorAll(".file-item").forEach(button => { button.classList.toggle("active", button.dataset.path===result.path); });
            showNotice("");
        } catch (error) { console.error("[Admin Copilot] Gagal membaca file:", error); showNotice(error.message,"error"); }
        finally { setBusy(false); }
    }

    /* -----------------------------------------------------------------
       KONEKTOR SUPABASE & CLOUDFLARE
       ----------------------------------------------------------------- */

    function setConnectorState(dot, text, ok, label){
        if(text) text.textContent = label;
        if(dot) dot.classList.toggle("is-off", !ok);
        const card = dot?.closest(".connector-card");
        if(card){ card.classList.toggle("is-connected", ok); card.classList.toggle("is-error", !ok && label!=="mengecek…"); }
    }
    async function loadSupabaseConnector(){
        setConnectorState(els.supabaseStatusDot, els.supabaseStatusText, true, "mengecek…");
        try{
            const r = await apiRequest("/api/copilot-supabase?action=status");
            const ok = !!r.url;
            setConnectorState(els.supabaseStatusDot, els.supabaseStatusText, ok, ok ? r.url.replace("https://","").slice(0,28) : "offline");
            if(els.supabaseDetail) els.supabaseDetail.dataset.payload = JSON.stringify(r,null,2);
        }catch(e){ setConnectorState(els.supabaseStatusDot, els.supabaseStatusText, false, "error"); if(els.supabaseDetail) els.supabaseDetail.textContent = e.message; }
    }
    async function loadCloudflareConnector(){
        setConnectorState(els.cloudflareStatusDot, els.cloudflareStatusText, true, "mengecek…");
        try{
            const r = await apiRequest("/api/copilot-cloudflare");
            const ok = r.configured;
            setConnectorState(els.cloudflareStatusDot, els.cloudflareStatusText, ok, ok ? (r.workers? `${r.workers.length} workers` : "terhubung") : "belum set");
            if(els.cloudflareDetail) els.cloudflareDetail.dataset.payload = JSON.stringify(r,null,2);
        }catch(e){ setConnectorState(els.cloudflareStatusDot, els.cloudflareStatusText, false, "error"); if(els.cloudflareDetail) els.cloudflareDetail.textContent = e.message; }
    }
    function toggleConnectorDetail(detailEl){
        if(!detailEl) return;
        const isHidden = detailEl.hidden;
        // hide both first
        if(els.supabaseDetail) els.supabaseDetail.hidden = true;
        if(els.cloudflareDetail) els.cloudflareDetail.hidden = true;
        if(isHidden){
            // render payload if not yet
            if(detailEl.dataset.payload && !detailEl.textContent) detailEl.textContent = detailEl.dataset.payload;
            if(!detailEl.textContent) detailEl.textContent = "Memuat…";
            detailEl.hidden = false;
            // simple explorer for supabase: allow query
            if(detailEl===els.supabaseDetail && !detailEl.queryRendered){
                const bar = document.createElement("div"); bar.style.display="flex"; bar.style.gap="6px"; bar.style.marginTop="8px";
                const inp = document.createElement("input"); inp.placeholder="tabel (mis: profiles)"; inp.className="field"; inp.style.flex="1"; inp.style.height="28px";
                const btn = document.createElement("button"); btn.textContent="Query 10"; btn.className="button button-secondary"; btn.style.minHeight="28px";
                const pre = document.createElement("pre"); pre.style.marginTop="8px"; pre.style.maxHeight="120px"; pre.style.overflow="auto"; pre.style.fontSize="10px";
                btn.onclick = async ()=>{ if(!inp.value.trim()) return; btn.disabled=true; pre.textContent="loading…"; try{ const j=await apiRequest("/api/copilot-supabase?action=query",{method:"POST", body:JSON.stringify({table:inp.value.trim(), limit:10})}); pre.textContent = JSON.stringify(j.rows,null,2); }catch(e){ pre.textContent=e.message; } btn.disabled=false; };
                bar.append(inp,btn); detailEl.append(bar,pre); detailEl.queryRendered=true;
            }
        }
    }

    /* -----------------------------------------------------------------
       MODEL OPENKEY
       ----------------------------------------------------------------- */

    async function loadModels() {
        els.modelSelect.innerHTML = '<option value="">Memuat model…</option>';
        try {
            const result = await apiRequest("/api/openkey-chat", { method:"POST", body: JSON.stringify({ operation:"openkey_models" }) });
            const models = Array.isArray(result.models) ? result.models : [];
            els.modelSelect.replaceChildren();
            models.forEach(model => { const id=String(model.id||"").trim(); if(!id) return; const o=document.createElement("option"); o.value=id; o.textContent=String(model.name||id); els.modelSelect.append(o); });
            if (!els.modelSelect.options.length) throw new Error("Daftar model OpenKey kosong.");
            els.modelSelect.disabled = false;
        } catch (error) {
            console.error("[Admin Copilot] Gagal memuat model OpenKey:", error);
            els.modelSelect.replaceChildren(new Option("Model OpenKey tidak tersedia",""));
            els.modelSelect.disabled = true; els.modelSelect.dataset.locked="true";
            showNotice(`Model OpenKey gagal dimuat: ${error.message}`, "error");
        }
    }

    /* -----------------------------------------------------------------
       PERCAKAPAN + UPLOAD + COPY
       ----------------------------------------------------------------- */

    function renderMessageBody(container, content) {
        const parts = String(content || "").split(/```[^\n]*\n?/);
        parts.forEach((part, index) => {
            if (!part) return;
            if (index % 2 === 1) { const pre=document.createElement("pre"); pre.textContent=part.replace(/\n$/,""); container.append(pre); }
            else { const text=document.createElement("span"); text.textContent=part; container.append(text); }
        });
    }

    function copyText(text, btn){
        const done=()=>{
            if(btn){ const o=btn.textContent; btn.textContent="✓ Tersalin"; btn.classList.add("copied"); setTimeout(()=>{ btn.textContent=o; btn.classList.remove("copied"); },1500); }
            showNotice("Tersalin ke clipboard","success",1500);
        };
        if(navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done).catch(()=>{
            const ta=document.createElement("textarea"); ta.value=text; document.body.append(ta); ta.select(); document.execCommand("copy"); ta.remove(); done();
        });
        else { const ta=document.createElement("textarea"); ta.value=text; document.body.append(ta); ta.select(); document.execCommand("copy"); ta.remove(); done(); }
    }

    function appendMessage(role, content, { code = false, persist=true, attachments=null } = {}) {
        const article = document.createElement("article"); article.className = `chat-message ${role}`;
        const label = document.createElement("p"); label.className="chat-role"; label.textContent = role==="user" ? "Kamu" : "OpenKey Copilot";
        const body = document.createElement("div"); body.className="chat-body"; renderMessageBody(body, content);
        // render attachments thumbnails if any
        if (attachments && attachments.length) {
            const attWrap = document.createElement("div"); attWrap.style.display="flex"; attWrap.style.gap="6px"; attWrap.style.flexWrap="wrap"; attWrap.style.marginTop="8px";
            attachments.forEach(a=>{
                if(a.mime?.startsWith("image/") && a.dataUrl){
                    const img=document.createElement("img"); img.src=a.dataUrl; img.style.width="80px"; img.style.height="80px"; img.style.objectFit="cover"; img.style.borderRadius="8px"; img.style.border="1px solid var(--line)"; attWrap.append(img);
                } else {
                    const chip=document.createElement("span"); chip.className="upload-file-chip"; chip.textContent=`${a.name} (${formatBytes(a.size)})`; attWrap.append(chip);
                }
            });
            body.append(attWrap);
        }
        article.append(label, body);
        // tools row: copy + (code use)
        const tools = document.createElement("div"); tools.className="message-tools";
        const cp = document.createElement("button"); cp.type="button"; cp.className="copy-btn"; cp.textContent="⎘ Salin"; cp.title="Salin pesan";
        cp.addEventListener("click", ()=> copyText(content, cp));
        tools.append(cp);
        if (role === "assistant" && code) {
            const useCode = document.createElement("button"); useCode.type="button"; useCode.className="button button-secondary use-code"; useCode.textContent="Gunakan kode di editor";
            useCode.addEventListener("click", ()=>{ if(!state.currentFile){ showNotice("Pilih file terlebih dahulu.","error"); return; } els.editor.value=code; renderGutter._count=-1; updateEditorControls(); els.editor.focus(); showNotice("Kode AI dimasukkan ke editor. Tinjau sebelum commit.","success"); });
            tools.append(useCode);
        }
        article.append(tools);
        els.chatMessages.append(article);
        els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
        if(persist) persistMessage(role, content, attachments);
    }

    function extractCode(content){ const m=String(content||"").match(/```[^\n]*\n([\s\S]*?)```/); return m? m[1].replace(/\n$/,"") : ""; }

    /* ---- Upload handling ---- */
    function renderUploadPreview(){
        if(!els.uploadPreview) return;
        els.uploadPreview.replaceChildren();
        if(!state.attachments.length){ els.uploadPreview.hidden=true; if(els.attachmentsBar) els.attachmentsBar.hidden=true; return; }
        els.uploadPreview.hidden=false; if(els.attachmentsBar) els.attachmentsBar.hidden=false;
        if(els.attachmentsCount) els.attachmentsCount.textContent = `${state.attachments.length} file`;
        state.attachments.forEach((f,idx)=>{
            const wrap=document.createElement("div"); wrap.style.position="relative";
            if(f.mime.startsWith("image/")){
                const img=document.createElement("img"); img.src=f.dataUrl; wrap.append(img);
            } else {
                const chip=document.createElement("span"); chip.className="upload-file-chip"; chip.textContent=f.name; wrap.append(chip);
            }
            const rm=document.createElement("button"); rm.type="button"; rm.textContent="×"; rm.style.cssText="position:absolute;top:-6px;right:-6px;width:18px;height:18px;border-radius:50%;border:1px solid var(--line);background:#111;color:#fff;font-size:10px;";
            rm.onclick=()=>{ state.attachments.splice(idx,1); renderUploadPreview(); };
            wrap.append(rm); els.uploadPreview.append(wrap);
        });
    }
    function handleFiles(files){
        const list = Array.from(files||[]);
        if(!list.length) return;
        if(state.attachments.length + list.length > 5){ showNotice("Maks 5 file per pesan","error",3000); return; }
        let pending = list.length;
        list.forEach(file=>{
            if(file.size > 8*1024*1024){ showNotice(`${file.name} >8MB terlewat`,"error",3000); pending--; if(!pending) renderUploadPreview(); return; }
            const reader=new FileReader();
            reader.onload=()=>{
                state.attachments.push({ name:file.name, mime: file.type || "application/octet-stream", size:file.size, dataUrl: reader.result });
                pending--; if(!pending) renderUploadPreview();
            };
            reader.onerror=()=>{ pending--; if(!pending) renderUploadPreview(); };
            reader.readAsDataURL(file);
        });
    }

    async function sendChat(event) {
        event.preventDefault();
        const prompt = els.chatInput.value.trim();
        const model = els.modelSelect.value;
        if ((!prompt && !state.attachments.length) || !model || state.busy) return;
        const fileContext = state.currentFile ? `\n\nFile aktif: ${state.currentFile}\nIsi file:\n\`\`\`\n${els.editor.value.slice(0,30000)}\n\`\`\`` : "";
        const fullPrompt = prompt + fileContext;
        // build history from current session (last 20)
        const history = (currentSession()?.messages || []).slice(-12).map(m=>({ role:m.role, content:m.content }));
        const messages = [
            {
                role: "system",
                content: "Kamu adalah asisten coding untuk repository GEN-Z.AI dengan akses internet LIVE. JANGAN PERNAH menjawab 'tidak ada koneksi internet' / 'tidak bisa browsing' / 'cutoff 2024'. Backend otomatis: (a) jika pesan user berisi URL https:// maka halaman itu DI-FETCH server dan disisipkan sebagai konteks sistem, (b) jika user memakai kata cari/telusuri/search/terbaru/terkini/hari ini/berita/harga/cuaca/latest maka server melakukan LIVE WEB SEARCH via DuckDuckGo dan menyisipkan hasilnya. Tugasmu: gunakan konteks LIVE itu untuk menjawab, kutip Source: URL, bedakan fakta dari inferensi, dan sebutkan jika hasil tidak cukup. Jangan mengklaim sudah mengubah repository. Jangan menjalankan shell, tool, deployment, atau operasi GitHub. Bila diminta mengubah file aktif, balas ringkasan singkat lalu berikan satu blok kode fenced berisi SELURUH isi file hasil revisi. Jangan potong file atau mengganti bagian yang tidak terkait. Jika tidak ada file aktif, jawab seperti asisten coding biasa."
            },
            ...history,
            { role:"user", content: fullPrompt }
        ];
        // prepare attachments snapshot
        const atts = state.attachments.slice();
        // inject attachments as vision parts: we send via openkey-chat with custom field attachments
        // openkey-chat expects messages array with possible image_url parts; we emulate by appending to messages as multipart
        let sendMessages = messages;
        if (atts.length) {
            const imageParts = atts.map(a=>{
                if(a.mime.startsWith("image/")) return { type:"image_url", image_url:{ url: a.dataUrl } };
                return { type:"text", text:`[File: ${a.name} (${a.mime}, ${formatBytes(a.size)})]\nKonten base64 dipotong, analisis metadata file.` };
            });
            // Convert last user message to multipart
            const last = sendMessages[sendMessages.length-1];
            sendMessages[sendMessages.length-1] = { role:"user", content: [{ type:"text", text: last.content }, ...imageParts] };
        }

        appendMessage("user", prompt || "(file terkirim)", { persist:true, attachments: atts });
        els.chatInput.value = ""; state.attachments=[]; renderUploadPreview();
        setBusy(true);
        try {
            const body = { model, messages: sendMessages, temperature:0.2, max_tokens:8192 };
            // if saveToStorage, upload in parallel
            if (atts.length && els.saveToStorageToggle?.checked) {
                atts.forEach(a=>{
                    apiRequest("/api/copilot-upload",{method:"POST", body: JSON.stringify({ filename:a.name, dataUrl:a.dataUrl, saveToStorage:true })}).catch(()=>{});
                });
            }
            const result = await apiRequest("/api/openkey-chat", { method:"POST", body: JSON.stringify(body) });
            const answer = String(result.content || "").trim();
            if (!answer) throw new Error("Model OpenKey tidak mengembalikan teks.");
            appendMessage("assistant", answer, { code: extractCode(answer) });
        } catch (error) {
            console.error("[Admin Copilot] Chat OpenKey gagal:", error);
            appendMessage("assistant", `Permintaan gagal: ${error.message}`, { persist:true });
        } finally { setBusy(false); }
    }

    /* -----------------------------------------------------------------
       GIT: COMMIT, PR, MERGE
       ----------------------------------------------------------------- */

    async function saveFile() {
        if (!state.currentFile || els.editor.value === state.originalContent) return;
        setBusy(true);
        try {
            const message = els.commitMessage.value.trim();
            const result = await apiRequest("/api/admin-copilot", { method:"POST", body: JSON.stringify({ action: "commit_file", path:state.currentFile, content:els.editor.value, message: message || `Update ${state.currentFile}`, branch: state.branch || undefined }) });
            state.branch = result.branch; state.originalContent = els.editor.value; els.commitMessage.value=""; updateEditorControls(); showNotice(`Commit tersimpan ke ${result.branch}. main belum berubah.`,"success",9000); await loadPullRequests(false);
        } catch (error) { console.error("[Admin Copilot] Commit file gagal:", error); showNotice(error.message,"error"); }
        finally { setBusy(false); }
    }
    async function createPullRequest() {
        if (!state.branch) return;
        const title = window.prompt("Judul pull request:", `Update ${state.currentFile || "GEN-Z.AI"}`);
        if (title===null || !title.trim()) return;
        const description = window.prompt("Deskripsi singkat pull request:", "Perubahan dibuat dari Admin Copilot.") || "";
        setBusy(true);
        try {
            const result = await apiRequest("/api/admin-copilot", { method:"POST", body: JSON.stringify({ action:"create_pull_request", branch: state.branch, title: title.trim(), body: description.trim() }) });
            showNotice(`PR #${result.pullRequest.number} dibuat.`, "success", 9000); await loadPullRequests(false); els.pullRequestSelect.value=String(result.pullRequest.number); updateEditorControls();
        } catch (error) { console.error("[Admin Copilot] Pembuatan PR gagal:", error); showNotice(error.message,"error"); }
        finally { setBusy(false); }
    }
    async function loadPullRequests(showErrors=true) {
        try {
            const result = await apiRequest("/api/admin-copilot?action=pulls");
            state.pullRequests = Array.isArray(result.pullRequests)? result.pullRequests: [];
            els.pullRequestSelect.replaceChildren();
            els.pullRequestSelect.add(new Option(state.pullRequests.length? `Pilih PR (${state.pullRequests.length} terbuka)` : "Tidak ada PR Copilot terbuka",""));
            state.pullRequests.forEach(pull=>{ els.pullRequestSelect.add(new Option(`#${pull.number} · ${pull.title}`, String(pull.number))); });
            if(showErrors) showNotice("");
        } catch(error){ console.error("[Admin Copilot] Gagal memuat daftar PR:", error); if(showErrors) showNotice(error.message,"error"); }
        finally { updateEditorControls(); }
    }
    async function mergePullRequest() {
        const number = Number(els.pullRequestSelect.value); if (!number) return;
        const phrase = window.prompt(`Merge PR #${number} ke main hanya jika semua CI lulus.\nKetik MERGE #${number} untuk mengonfirmasi:`);
        if (phrase !== `MERGE #${number}`) { showNotice("Konfirmasi merge dibatalkan.","info",6000); return; }
        setBusy(true);
        try { await apiRequest("/api/admin-copilot", { method:"POST", body: JSON.stringify({ action:"merge_pull_request", pullRequestNumber:number }) }); showNotice(`PR #${number} berhasil di-merge.`,"success",9000); await loadPullRequests(false); }
        catch(error){ console.error("[Admin Copilot] Merge PR gagal:", error); showNotice(error.message,"error"); }
        finally { setBusy(false); }
    }

    /* -----------------------------------------------------------------
       INISIALISASI
       ----------------------------------------------------------------- */

    async function initialize() {
        try {
            const ready = window.GENZNavigationReady ? await window.GENZNavigationReady : false;
            const role = String(window.GENZ_NAVIGATION_ROLE || "").toLowerCase();
            if (ready !== true || !["admin","owner"].includes(role)) { window.location.replace("/user/dashboard.html"); return; }
            state.accessToken = await getAccessToken();
            els.shell.hidden = false; els.loading.hidden = true;
            // sesi dulu (non-blocking)
            await loadSessions();
            await Promise.all([loadTree(), loadPullRequests(), loadModels(), loadSupabaseConnector(), loadCloudflareConnector()]);
            if(!els.chatMessages.querySelector(".chat-message")) renderChatFromSession();
            renderGutter();
        } catch (error) {
            console.error("[Admin Copilot] Inisialisasi gagal:", error);
            els.loading.innerHTML=""; const m=document.createElement("p"); m.textContent=error.message||"Gagal memuat Admin Copilot."; els.loading.append(m);
        }
    }

    /* -----------------------------------------------------------------
       EVENT
       ----------------------------------------------------------------- */

    els.editor.addEventListener("input", ()=>{ renderGutter._count=-1; updateEditorControls(); });
    els.editor.addEventListener("scroll", syncGutterScroll);
    els.editor.addEventListener("keydown", event=>{ if(event.key!=="Tab") return; event.preventDefault(); const s=els.editor.selectionStart, e=els.editor.selectionEnd; els.editor.value=els.editor.value.slice(0,s)+"    "+els.editor.value.slice(e); els.editor.selectionStart=els.editor.selectionEnd=s+4; renderGutter._count=-1; updateEditorControls(); });
    els.fileFilter.addEventListener("input", ()=>{ state.fileFilter=els.fileFilter.value.trim().toLowerCase(); renderTree(state.treeItems, state.currentFolder); });
    els.noticeClose.addEventListener("click", ()=>{ els.notice.hidden=true; });
    els.refreshTree.addEventListener("click", ()=>{ state.fileFilter=""; els.fileFilter.value=""; loadTree(state.currentFolder); });
    els.chatForm.addEventListener("submit", sendChat);
    els.saveButton.addEventListener("click", saveFile);
    els.createPrButton.addEventListener("click", createPullRequest);
    els.mergePrButton.addEventListener("click", mergePullRequest);
    els.pullRequestSelect.addEventListener("change", updateEditorControls);
    els.commitMessage.addEventListener("keydown", event=>{ if(event.key==="Enter"){ event.preventDefault(); saveFile(); } });
    document.addEventListener("keydown", event=>{ if((event.ctrlKey||event.metaKey) && event.key.toLowerCase()==="s"){ event.preventDefault(); if(!els.saveButton.disabled) saveFile(); } });
    window.addEventListener("resize", ()=>{ renderGutter._count=-1; renderGutter(); syncGutterScroll(); });
    // sesi events
    if(els.sessionSelect) els.sessionSelect.addEventListener("change", e=> switchSession(e.target.value));
    if(els.newSessionButton) els.newSessionButton.addEventListener("click", createSession);
    if(els.renameSessionButton) els.renameSessionButton.addEventListener("click", renameSession);
    if(els.deleteSessionButton) els.deleteSessionButton.addEventListener("click", deleteSession);
    // connectors
    if(els.supabaseConnector) els.supabaseConnector.addEventListener("click", ()=> toggleConnectorDetail(els.supabaseDetail));
    if(els.cloudflareConnector) els.cloudflareConnector.addEventListener("click", ()=> toggleConnectorDetail(els.cloudflareDetail));
    // upload
    if(els.attachButton) els.attachButton.addEventListener("click", ()=> els.fileInput?.click());
    if(els.fileInput) els.fileInput.addEventListener("change", e=>{ handleFiles(e.target.files); e.target.value=""; });
    if(els.clearAttachmentsButton) els.clearAttachmentsButton.addEventListener("click", ()=>{ state.attachments=[]; renderUploadPreview(); });
    // drag & drop + paste
    if(els.chatForm){
        els.chatForm.addEventListener("dragover", e=>{ e.preventDefault(); e.dataTransfer.dropEffect="copy"; els.chatForm.style.outline="1px dashed var(--amber)"; });
        els.chatForm.addEventListener("dragleave", ()=>{ els.chatForm.style.outline=""; });
        els.chatForm.addEventListener("drop", e=>{ e.preventDefault(); els.chatForm.style.outline=""; if(e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files); });
    }
    document.addEventListener("paste", e=>{
        if(document.activeElement===els.chatInput){
            const items=[... (e.clipboardData?.files||[])];
            if(items.length) { e.preventDefault(); handleFiles(items); }
        }
    });
    // connect enter+shift ?
    void initialize();
})();
