(function () {
    "use strict";

    if (window.__GENZ_SUPPORT_CHAT_STARTED) {
        return;
    }
    window.__GENZ_SUPPORT_CHAT_STARTED = true;

    const CONFIG_URL = "/assets/js/config.js";
    const SUPABASE_SCRIPT_URL =
        "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.58.0/dist/umd/supabase.min.js";
    const CHAT_STORAGE_KEY = "genz-support-auth-token";
    const MAX_MESSAGE_LENGTH = 2000;
    const MAX_IMAGE_FILE_SIZE = 8 * 1024 * 1024;
    const MAX_COMPRESSED_IMAGE_SIZE = 675000;
    const CONNECTION_TIMEOUT_MS = 5 * 60 * 1000;

    /*
     * Teks loading saat panel dibuka.
     * Wajib dibersihkan di SEMUA jalur sukses openChat —
     * lihat safety check di akhir blok try openChat.
     */
    const CONNECTION_FEEDBACK_TEXT = "Menghubungkan ke tim support...";
    const UNREAD_NOTICE_DELAY_MS = 5 * 60 * 1000;
    const SUPPORT_HEARTBEAT_INTERVAL_MS = 30000;
    const SUPPORT_STATUS_POLL_INTERVAL_MS = 15000;

    let supabaseClient = null;
    let currentUser = null;
    let isSupportAgent = false;
    let supportAgentName = "";
    let activeConversation = null;
    let latestUserMessage = null;
    let unreadNoticeTimer = null;
    let messageChannel = null;
    let conversationChannel = null;
    let inboxChannel = null;
    let conversations = [];
    let selectedImage = null;
    const unreadConversationIds = new Set();
    let busy = false;
    let connectionAttempt = 0;
    let supportMonitorPromise = null;
    let supportHeartbeatTimer = null;
    let supportStatusPollTimer = null;
    let supportHeartbeatInFlight = false;

    const launcher = createElement("button", "genz-chat-launcher", {
        type: "button",
        "aria-label": "Buka live chat dukungan",
        "aria-expanded": "false"
    });
    launcher.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 8.7 3.9a8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z"/></svg>';
    const presenceDot = createElement("span", "genz-chat-presence-dot", {
        "aria-hidden": "true"
    });
    const notificationDot = createElement("span", "genz-chat-notification-dot", {
        "aria-hidden": "true"
    });
    launcher.append(presenceDot, notificationDot);

    const panel = createElement("section", "genz-chat-panel", {
        "aria-label": "Live chat dukungan",
        "aria-live": "polite",
        hidden: ""
    });

    const header = createElement("header", "genz-chat-header");
    const headingWrap = createElement("div");
    const title = createElement("h2", "genz-chat-title", {
        text: "GEN-Z.AI Support"
    });
    const subtitle = createElement("div", "genz-chat-subtitle", {
        text: "Tim kami siap membantu"
    });
    const presenceLabel = createElement("div", "genz-chat-presence-label", {
        text: "Memeriksa status admin..."
    });
    headingWrap.append(title, subtitle, presenceLabel);

    const closeButton = createElement("button", "genz-chat-close", {
        type: "button",
        "aria-label": "Tutup live chat"
    });
    closeButton.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';
    header.append(headingWrap, closeButton);

    const layout = createElement("div", "genz-chat-layout");
    const inbox = createElement("nav", "genz-chat-inbox", {
        "aria-label": "Percakapan support",
        hidden: ""
    });
    const content = createElement("div", "genz-chat-content");
    const messages = createElement("div", "genz-chat-messages", {
        role: "log",
        "aria-live": "polite",
        "aria-relevant": "additions"
    });
    const feedback = createElement("div", "genz-chat-feedback", {
        role: "status",
        "aria-live": "polite"
    });
    const tools = createElement("div", "genz-chat-tools", { hidden: "" });
    const closeThreadButton =
        createElement("button", "genz-chat-close-thread", {
            type: "button",
            text: "Tutup percakapan",
            hidden: ""
        });
    tools.append(closeThreadButton);

    const composer = createElement("form", "genz-chat-composer", {
        hidden: ""
    });
    const attachmentPreview = createElement(
        "div",
        "genz-chat-attachment-preview",
        { hidden: "" }
    );
    const attachmentThumbnail = createElement("img", "genz-chat-attachment-thumb", {
        alt: "Pratinjau gambar untuk dikirim"
    });
    const attachmentName = createElement("span", "genz-chat-attachment-name");
    const removeAttachmentButton = createElement(
        "button",
        "genz-chat-attachment-remove",
        {
            type: "button",
            "aria-label": "Hapus gambar"
        }
    );
    removeAttachmentButton.textContent = "×";
    attachmentPreview.append(
        attachmentThumbnail,
        attachmentName,
        removeAttachmentButton
    );
    const composerControls = createElement("div", "genz-chat-composer-controls");
    const imageInput = createElement("input", "genz-chat-image-input", {
        type: "file",
        accept: "image/jpeg,image/png,image/webp",
        "aria-label": "Pilih gambar untuk dikirim"
    });
    imageInput.hidden = true;
    const imageButton = createElement("button", "genz-chat-image-button", {
        type: "button",
        "aria-label": "Lampirkan gambar",
        title: "Lampirkan gambar"
    });
    imageButton.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>';
    const input = createElement("textarea", "genz-chat-input", {
        name: "message",
        maxlength: String(MAX_MESSAGE_LENGTH),
        rows: "1",
        placeholder: "Tulis pesan...",
        "aria-label": "Pesan"
    });
    const sendButton = createElement("button", "genz-chat-send", {
        type: "submit",
        text: "Kirim"
    });
    composerControls.append(imageButton, imageInput, input, sendButton);
    composer.append(attachmentPreview, composerControls);

    content.append(messages, feedback, tools, composer);
    layout.append(inbox, content);
    panel.append(header, layout);
    document.body.append(launcher, panel);
    addStylesheet();

    launcher.addEventListener("click", () => openChat());
    closeButton.addEventListener("click", closeChat);
    composer.addEventListener("submit", sendMessage);
    imageButton.addEventListener("click", () => imageInput.click());
    imageInput.addEventListener("change", selectImageAttachment);
    removeAttachmentButton.addEventListener("click", clearImageAttachment);
    closeThreadButton.addEventListener("click", closeConversation);
    void initializeSupportMonitor();

    function createElement(tag, className, attributes) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        for (const [key, value] of Object.entries(attributes || {})) {
            if (key === "text") {
                element.textContent = value;
            } else {
                element.setAttribute(key, value);
            }
        }
        return element;
    }

    function addStylesheet() {
        const stylesheet = document.createElement("link");
        stylesheet.rel = "stylesheet";
        stylesheet.href = "/assets/css/support-chat.css";
        document.head.append(stylesheet);
    }

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const existing = Array.from(document.scripts)
                .find(script => script.src === new URL(src, location.href).href);
            if (existing) {
                if (existing.dataset.loaded === "true") {
                    resolve();
                    return;
                }
                existing.addEventListener("load", resolve, { once: true });
                existing.addEventListener(
                    "error",
                    () => reject(new Error("Skrip autentikasi chat gagal dimuat.")),
                    { once: true }
                );
                return;
            }

            const script = document.createElement("script");
            script.src = src;
            script.async = true;
            script.addEventListener("load", () => {
                script.dataset.loaded = "true";
                resolve();
            }, { once: true });
            script.addEventListener(
                "error",
                () => reject(new Error("Skrip autentikasi chat gagal dimuat.")),
                { once: true }
            );
            document.head.append(script);
        });
    }

    async function ensureSupabase() {
        if (window.GENZ_SUPABASE || window.supabaseClient) {
            return window.GENZ_SUPABASE || window.supabaseClient;
        }

        if (
            !window.GENZ_CONFIG ||
            !window.GENZ_CONFIG.SUPABASE_URL ||
            !window.GENZ_CONFIG.SUPABASE_KEY
        ) {
            await loadScript(CONFIG_URL);
        }

        if (
            !window.supabase ||
            typeof window.supabase.createClient !== "function"
        ) {
            await loadScript(SUPABASE_SCRIPT_URL);
        }

        if (
            !window.GENZ_CONFIG ||
            !window.GENZ_CONFIG.SUPABASE_URL ||
            !window.GENZ_CONFIG.SUPABASE_KEY ||
            !window.supabase ||
            typeof window.supabase.createClient !== "function"
        ) {
            throw new Error("Konfigurasi Supabase untuk live chat tidak tersedia.");
        }

        supabaseClient = window.supabase.createClient(
            window.GENZ_CONFIG.SUPABASE_URL,
            window.GENZ_CONFIG.SUPABASE_KEY,
            {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true,
                    detectSessionInUrl: false,
                    lock: async (_name, _timeout, callback) => await callback()
                }
            }
        );
        return supabaseClient;
    }

    function createGuestClient() {
        const config = window.GENZ_CONFIG;
        return window.supabase.createClient(
            config.SUPABASE_URL,
            config.SUPABASE_KEY,
            {
                auth: {
                    storageKey: CHAT_STORAGE_KEY,
                    persistSession: true,
                    autoRefreshToken: true,
                    detectSessionInUrl: false,
                    lock: async (_name, _timeout, callback) => await callback()
                }
            }
        );
    }

    /*
     * Sesi pengunjung.
     *
     * PENTING: Supabase anonymous sign-in membuat baris SUNGGUHAN di
     * auth.users. Akun seperti itu tidak punya profil (nama, email,
     * kredit) dan hanya mengotori daftar user admin.
     *
     * Karena itu akun tamu TIDAK lagi dibuat saat panel chat dibuka.
     * Akun tamu hanya dibuat ketika pengunjung benar-benar menekan
     * "Mulai chat" (createIfMissing: true), yaitu saat mereka akan
     * mengirim pesan ke admin.
     *
     * @returns {Promise<boolean>} true bila sudah ada sesi (akun asli
     * atau tamu) yang bisa dipakai.
     */
    async function ensureVisitorSession({ createIfMissing = false } = {}) {
        const appClient = await ensureSupabase();
        const {
            data: { session: appSession },
            error: appSessionError
        } = await appClient.auth.getSession();

        if (appSessionError) {
            throw appSessionError;
        }
        if (appSession) {
            currentUser = appSession.user;
            supabaseClient = appClient;
            return true;
        }

        const guestClient = createGuestClient();
        const {
            data: { session: guestSession },
            error: guestSessionError
        } = await guestClient.auth.getSession();

        if (guestSessionError) {
            throw guestSessionError;
        }

        if (guestSession?.user) {
            currentUser = guestSession.user;
            supabaseClient = guestClient;
            return true;
        }

        if (!createIfMissing) {
            currentUser = null;
            return false;
        }

        const {
            data: { user },
            error
        } = await guestClient.auth.signInAnonymously();

        if (error) {
            throw error;
        }
        if (!user) {
            throw new Error("Supabase tidak mengembalikan sesi pengunjung.");
        }
        currentUser = user;
        supabaseClient = guestClient;
        return true;
    }

    async function detectSupportAgent() {
        if (currentUser.is_anonymous) {
            isSupportAgent = false;
            return;
        }

        const { data: profile, error } = await supabaseClient
            .from("profiles")
            .select("role,name")
            .eq("id", currentUser.id)
            .maybeSingle();

        if (error) {
            throw error;
        }

        const role = String(profile?.role || "").trim().toUpperCase();
        isSupportAgent = role === "ADMIN" || role === "OWNER";
        supportAgentName =
            String(profile?.name || "").trim() ||
            String(
                currentUser.user_metadata?.full_name ||
                    currentUser.user_metadata?.name ||
                    ""
            ).trim() ||
            "Admin Support";
    }

    function setSupportPresenceStatus(status) {
        presenceLabel.classList.remove(
            "is-online",
            "is-offline",
            "is-checking",
            "is-unavailable"
        );
        presenceLabel.classList.add("is-" + status);
        presenceLabel.textContent = {
            online: "Admin online",
            offline: "Admin offline",
            checking: "Memeriksa status admin...",
            unavailable: "Status admin tidak tersedia"
        }[status];
    }

    async function updateSupportHeartbeat() {
        if (supportHeartbeatInFlight) return;
        supportHeartbeatInFlight = true;
        try {
            const { error } = await supabaseClient.rpc(
                "update_support_agent_presence"
            );
            if (error) throw error;
            setSupportPresenceStatus("online");
        } catch (error) {
            console.error(
                "[GEN-Z.AI Support Chat] Gagal memperbarui status admin:",
                error
            );
            setSupportPresenceStatus("unavailable");
        } finally {
            supportHeartbeatInFlight = false;
        }
    }

    function startSupportAgentHeartbeat() {
        if (supportHeartbeatTimer) return;
        void updateSupportHeartbeat();
        supportHeartbeatTimer = window.setInterval(
            updateSupportHeartbeat,
            SUPPORT_HEARTBEAT_INTERVAL_MS
        );
    }

    async function refreshSupportPresence() {
        try {
            const { data, error } = await supabaseClient.rpc(
                "get_support_agent_presence"
            );
            if (error) throw error;
            setSupportPresenceStatus(data ? "online" : "offline");
        } catch (error) {
            console.error(
                "[GEN-Z.AI Support Chat] Gagal memeriksa status admin:",
                error
            );
            setSupportPresenceStatus("unavailable");
        }
    }

    function startSupportPresencePolling() {
        if (supportStatusPollTimer) return;
        setSupportPresenceStatus("checking");
        void refreshSupportPresence();
        supportStatusPollTimer = window.setInterval(
            refreshSupportPresence,
            SUPPORT_STATUS_POLL_INTERVAL_MS
        );
    }

    function stopSupportPresencePolling() {
        if (!supportStatusPollTimer) return;
        window.clearInterval(supportStatusPollTimer);
        supportStatusPollTimer = null;
    }

    async function initializeSupportMonitor() {
        if (supportMonitorPromise) return supportMonitorPromise;
        supportMonitorPromise = (async () => {
            try {
                const appClient = await ensureSupabase();
                const {
                    data: { session },
                    error
                } = await appClient.auth.getSession();
                if (error) throw error;
                if (session?.user && !session.user.is_anonymous) {
                    currentUser = session.user;
                    supabaseClient = appClient;
                } else {
                    const config = window.GENZ_CONFIG;
                    const guestClient = window.supabase.createClient(
                        config.SUPABASE_URL,
                        config.SUPABASE_KEY,
                        {
                            auth: {
                                storageKey: CHAT_STORAGE_KEY,
                                persistSession: true,
                                autoRefreshToken: true,
                                detectSessionInUrl: false,
                                lock: async (_name, _timeout, callback) =>
                                    await callback()
                            }
                        }
                    );
                    const {
                        data: { session: guestSession },
                        error: guestError
                    } = await guestClient.auth.getSession();
                    if (guestError) throw guestError;
                    if (!guestSession?.user) return;
                    currentUser = guestSession.user;
                    supabaseClient = guestClient;
                }

                await detectSupportAgent();
                if (!isSupportAgent) {
                    await monitorVisitorConversation();
                    return;
                }

                launcher.classList.add("is-support-online");
                startSupportAgentHeartbeat();
                await loadInbox();
                if (unreadConversationIds.size) {
                    showMessageIndicator();
                }
                subscribeToInbox();

                appClient.auth.onAuthStateChange(event => {
                    if (event === "SIGNED_OUT") {
                        launcher.classList.remove("is-support-online");
                        clearMessageIndicator();
                        unreadConversationIds.clear();
                        conversations = [];
                        isSupportAgent = false;
                        if (supportHeartbeatTimer) {
                            window.clearInterval(supportHeartbeatTimer);
                            supportHeartbeatTimer = null;
                        }
                        setSupportPresenceStatus("checking");
                        if (inboxChannel) {
                            void appClient.removeChannel(inboxChannel);
                            inboxChannel = null;
                        }
                    }
                });
            } catch (error) {
                console.error(
                    "[GEN-Z.AI Support Chat] Gagal memantau inbox support:",
                    error
                );
            }
        })();
        return supportMonitorPromise;
    }

    async function monitorVisitorConversation() {
        if (panel.hidden === false || !currentUser?.id) return;
        const { data, error } = await supabaseClient
            .from("support_conversations")
            .select("id,user_id,user_name,user_email,status,last_message_at,last_user_message_at,admin_read_at,user_read_at,admin_name")
            .eq("user_id", currentUser.id)
            .eq("status", "open")
            .order("last_message_at", { ascending: false })
            .limit(1);

        if (error) throw error;
        if (!data?.length || !panel.hidden) return;

        activeConversation = data[0];
        subscribeToMessages(activeConversation.id);
        subscribeToConversation(activeConversation.id);
    }

    /*
     * options.createGuest = true hanya dipakai tombol "Mulai chat".
     * Tanpa itu, membuka panel chat tidak membuat akun apa pun.
     */
    /*
     * Layar awal pengunjung yang belum punya sesi.
     *
     * Di titik ini BELUM ada akun yang dibuat di Supabase. Akun tamu
     * baru dibuat setelah tombol "Mulai chat" ditekan, sehingga
     * pengunjung yang hanya mengintip chat tidak meninggalkan akun
     * kosong di daftar user admin.
     */
    function renderVisitorWelcome() {
        composer.hidden = true;
        inbox.hidden = true;
        tools.hidden = true;
        presenceLabel.hidden = true;
        subtitle.textContent = "Chat langsung dengan tim kami";
        setFeedback("");
        renderEmpty(
            "Ada kendala akun, kredit, atau fitur? Tekan Mulai chat dan tim support akan membantu."
        );
        const startButton = createElement("button", "genz-chat-start", {
            type: "button",
            text: "Mulai chat"
        });
        startButton.addEventListener("click", () =>
            openChat({ createGuest: true })
        );
        feedback.replaceChildren(startButton);
    }

    async function openChat(options = {}) {
        const createGuest = options.createGuest === true;
        panel.hidden = false;
        launcher.hidden = true;
        launcher.setAttribute("aria-expanded", "true");
        clearMessageIndicator();

        if (busy) return;
        busy = true;
        const attempt = ++connectionAttempt;
        setFeedback(CONNECTION_FEEDBACK_TEXT);
        const connectionTimeout = window.setTimeout(() => {
            if (attempt !== connectionAttempt) return;
            connectionAttempt++;
            busy = false;
            composer.hidden = true;
            setFeedback(
                "Koneksi ke Supabase terlalu lama. Periksa koneksi dan pengaturan Anonymous Sign-Ins, lalu coba lagi."
            );
            const retryButton = createElement("button", "genz-chat-start", {
                type: "button",
                text: "Coba lagi"
            });
            retryButton.addEventListener("click", () => openChat());
            feedback.append(retryButton);
        }, CONNECTION_TIMEOUT_MS);
        try {
            const hasSession = await ensureVisitorSession({
                createIfMissing: createGuest
            });
            if (attempt !== connectionAttempt) return;
            if (!hasSession) {
                renderVisitorWelcome();
                return;
            }
            await detectSupportAgent();
            if (attempt !== connectionAttempt) return;
            if (isSupportAgent) {
                startSupportAgentHeartbeat();
            } else {
                startSupportPresencePolling();
            }
            composer.hidden = false;
            inbox.hidden = !isSupportAgent;
            tools.hidden = !isSupportAgent;
            presenceLabel.hidden = false;

            if (isSupportAgent) {
                subtitle.textContent = `Inbox dukungan · ${supportAgentName}`;
                await loadInbox();
                if (attempt !== connectionAttempt) return;
                subscribeToInbox();
                if (activeConversation) {
                    composer.hidden = false;
                    closeThreadButton.hidden = false;
                    await loadMessages(activeConversation.id);
                    if (attempt !== connectionAttempt) return;
                    await markConversationRead(activeConversation.id);
                    if (attempt !== connectionAttempt) return;
                    subscribeToMessages(activeConversation.id);
                } else {
                    composer.hidden = true;
                    closeThreadButton.hidden = true;
                    renderEmpty("Pilih percakapan untuk mulai membalas.");
                    setFeedback("");
                }
            } else {
                subtitle.textContent = currentUser.is_anonymous
                    ? "Chat langsung dengan tim kami"
                    : "Terhubung dengan tim support";
                if (createGuest) {
                    /*
                     * Pengunjung baru menekan "Mulai chat": sesi tamu
                     * baru saja dibuat dan belum punya percakapan.
                     * Langsung buka percakapan supaya tidak perlu klik
                     * "Mulai chat" untuk kedua kalinya.
                     */
                    await startConversation();
                } else {
                    await loadUserConversation(attempt);
                }
            }

            /*
             * Safety: semua jalur sukses di atas tidak boleh
             * menyisakan teks loading koneksi (mis. jalur inbox
             * admin tanpa percakapan aktif).
             */
            if (feedback.textContent === CONNECTION_FEEDBACK_TEXT) {
                setFeedback("");
            }
        } catch (error) {
            if (attempt !== connectionAttempt) return;
            console.error("[GEN-Z.AI Support Chat] Gagal membuka chat:", error);
            setFeedback(getErrorMessage(error));
            composer.hidden = true;
        } finally {
            window.clearTimeout(connectionTimeout);
            if (attempt === connectionAttempt) {
                busy = false;
            }
        }
    }

    function closeChat() {
        connectionAttempt++;
        busy = false;
        panel.hidden = true;
        launcher.hidden = false;
        launcher.setAttribute("aria-expanded", "false");
        if (!isSupportAgent) stopSupportPresencePolling();
    }

    async function loadUserConversation(attempt = null) {
        const { data, error } = await supabaseClient
            .from("support_conversations")
            .select("id,user_id,user_name,user_email,status,last_message_at,last_user_message_at,admin_read_at,user_read_at,admin_name")
            .eq("user_id", currentUser.id)
            .eq("status", "open")
            .order("last_message_at", { ascending: false })
            .limit(1);

        if (error) throw error;
        if (attempt !== null && attempt !== connectionAttempt) return;

        if (data.length) {
            activeConversation = data[0];
            composer.hidden = false;
            closeThreadButton.hidden = true;
            setFeedback("");
            updateVisitorHeading();
            const loadedMessages = await loadMessages(activeConversation.id);
            if (attempt !== null && attempt !== connectionAttempt) return;
            latestUserMessage =
                [...loadedMessages].reverse().find(message =>
                    message.sender_role === "user"
                ) || null;
            await markConversationReadByUser(activeConversation.id);
            scheduleUnreadBusyNotice(activeConversation.id, latestUserMessage);
            updateReadReceipts();
            subscribeToMessages(activeConversation.id);
            subscribeToConversation(activeConversation.id);
            return;
        }

        activeConversation = null;
        unsubscribeMessages();
        renderEmpty("Mulai percakapan dengan tim support kami.");
        composer.hidden = true;
        setFeedback("");
        const startButton = createElement("button", "genz-chat-start", {
            type: "button",
            text: "Mulai chat"
        });
        startButton.addEventListener("click", startConversation);
        feedback.replaceChildren();
        feedback.append(startButton);
    }

    async function startConversation() {
        if (busy) return;
        busy = true;
        setFeedback("Membuka percakapan...");
        try {
            const { data, error } = await supabaseClient
                .from("support_conversations")
                .insert({
                    user_id: currentUser.id,
                    user_name:
                        currentUser.user_metadata?.name ||
                        currentUser.user_metadata?.full_name ||
                        (currentUser.is_anonymous
                            ? "Pengunjung"
                            : currentUser.email || "Pengguna"),
                    user_email: currentUser.email || null,
                    status: "open"
                })
                .select("id,user_id,user_name,user_email,status,last_message_at,last_user_message_at,admin_read_at,user_read_at,admin_name")
                .single();

            if (error) throw error;
            activeConversation = data;
            setFeedback("");
            composer.hidden = false;
            closeThreadButton.hidden = true;
            const loadedMessages = await loadMessages(data.id);
            latestUserMessage =
                [...loadedMessages].reverse().find(message =>
                    message.sender_role === "user"
                ) || null;
            subscribeToMessages(data.id);
            subscribeToConversation(data.id);
            scheduleUnreadBusyNotice(data.id, latestUserMessage);
            updateReadReceipts();
            input.focus();
        } catch (error) {
            if (error?.code === "23505") {
                try {
                    await loadUserConversation();
                    return;
                } catch (reloadError) {
                    console.error(
                        "[GEN-Z.AI Support Chat] Gagal memuat chat aktif:",
                        reloadError
                    );
                    setFeedback(getErrorMessage(reloadError));
                    return;
                }
            }
            console.error("[GEN-Z.AI Support Chat] Gagal memulai chat:", error);
            setFeedback(getErrorMessage(error));
        } finally {
            busy = false;
        }
    }

    async function loadInbox() {
        const { data, error } = await supabaseClient
            .from("support_conversations")
            .select("id,user_id,user_name,user_email,status,last_message_at,last_user_message_at,admin_read_at,user_read_at,admin_name")
            .eq("status", "open")
            .order("last_message_at", { ascending: false })
            .limit(50);

        if (error) throw error;
        conversations = data || [];
        const activeUpdate = conversations.find(
            conversation => conversation.id === activeConversation?.id
        );
        if (activeUpdate) {
            activeConversation = { ...activeConversation, ...activeUpdate };
            updateReadReceipts();
        }
        unreadConversationIds.clear();
        for (const conversation of conversations) {
            const hasUnreadUserMessage =
                conversation.last_user_message_at &&
                (
                    !conversation.admin_read_at ||
                    new Date(conversation.last_user_message_at) >
                        new Date(conversation.admin_read_at)
                );
            if (hasUnreadUserMessage) {
                unreadConversationIds.add(conversation.id);
            } else {
                unreadConversationIds.delete(conversation.id);
            }
        }
        if (unreadConversationIds.size) {
            showMessageIndicator();
        } else {
            clearMessageIndicator();
        }
        renderInbox();

        if (
            activeConversation &&
            !conversations.some(item => item.id === activeConversation.id)
        ) {
            activeConversation = null;
            unsubscribeMessages();
            composer.hidden = true;
            closeThreadButton.hidden = true;
            renderEmpty("Percakapan ini sudah tidak aktif.");
        }
    }

    function renderInbox() {
        inbox.replaceChildren();
        if (!conversations.length) {
            const empty = createElement("div", "genz-chat-empty", {
                text: "Belum ada chat."
            });
            inbox.append(empty);
            return;
        }

        for (const conversation of conversations) {
            const thread = createElement("button", "genz-chat-thread", {
                type: "button"
            });
            if (activeConversation?.id === conversation.id) {
                thread.classList.add("is-active");
            }
            const nameRow = createElement("span", "genz-chat-thread-name-row");
            nameRow.append(
                createElement("span", "genz-chat-thread-name", {
                    text: conversation.user_name || "Pengunjung"
                })
            );
            const hasUnreadMessage =
                unreadConversationIds.has(conversation.id) ||
                (
                    conversation.last_user_message_at &&
                    (
                        !conversation.admin_read_at ||
                        new Date(conversation.last_user_message_at) >
                            new Date(conversation.admin_read_at)
                    )
                );
            if (hasUnreadMessage) {
                nameRow.append(
                    createElement("span", "genz-chat-thread-notification", {
                        text: "BARU",
                        "aria-label": "Pesan belum dibaca"
                    })
                );
            }
            thread.append(
                nameRow,
                createElement("span", "genz-chat-thread-time", {
                    text: formatTime(conversation.last_message_at)
                })
            );
            thread.addEventListener("click", async () => {
                activeConversation = conversation;
                renderInbox();
                composer.hidden = false;
                closeThreadButton.hidden = false;
                try {
                    await loadMessages(conversation.id);
                    await markConversationRead(conversation.id);
                    subscribeToMessages(conversation.id);
                } catch (error) {
                    console.error(
                        "[GEN-Z.AI Support Chat] Gagal membuka percakapan:",
                        error
                    );
                    setFeedback(getErrorMessage(error));
                }
            });
            inbox.append(thread);
        }
    }

    async function loadMessages(conversationId) {
        setFeedback("Memuat pesan...");
        const { data, error } = await supabaseClient
            .from("support_messages")
            .select("id,conversation_id,sender_id,sender_role,sender_name,body,created_at,image_data,image_type")
            .eq("conversation_id", conversationId)
            .order("created_at", { ascending: false })
            .limit(200);

        if (error) throw error;
        const orderedMessages = (data || []).slice().reverse();
        messages.replaceChildren();
        for (const message of orderedMessages) {
            renderMessage(message);
        }
        if (!orderedMessages.length) {
            appendEmptyMessage("Kirim pesan pertama Anda.");
        }
        latestUserMessage =
            [...orderedMessages].reverse().find(message =>
                message.sender_role === "user"
            ) || null;
        setFeedback("");
        updateReadReceipts();
        scrollToLatest();
        return orderedMessages;
    }

    function subscribeToMessages(conversationId) {
        unsubscribeMessages();
        messageChannel = supabaseClient
            .channel("genz-support-messages-" + conversationId)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "support_messages",
                    filter: "conversation_id=eq." + conversationId
                },
                payload => {
                    const currentId = activeConversation?.id;
                    if (
                        currentId === conversationId &&
                        !messages.querySelector(
                            '[data-message-id="' + payload.new.id + '"]'
                        )
                    ) {
                        const empty = messages.querySelector(
                            ".genz-chat-empty"
                        );
                        if (empty) empty.remove();
                        renderMessage(payload.new);
                        if (payload.new.sender_role === "user") {
                            latestUserMessage = payload.new;
                            updateReadReceipts();
                            if (isSupportAgent) {
                                if (!panel.hidden) {
                                    void markConversationRead(
                                        conversationId
                                    ).catch(error => {
                                        console.error(
                                            "[GEN-Z.AI Support Chat] Gagal menandai pesan telah dibaca:",
                                            error
                                        );
                                        setFeedback(getErrorMessage(error));
                                    });
                                }
                            } else {
                                scheduleUnreadBusyNotice(
                                    conversationId,
                                    payload.new
                                );
                            }
                        } else if (
                            payload.new.sender_role === "support" &&
                            !isSupportAgent &&
                            !panel.hidden
                        ) {
                            void markConversationReadByUser(
                                conversationId
                            ).catch(error => {
                                console.error(
                                    "[GEN-Z.AI Support Chat] Gagal menandai pesan sebagai dibaca:",
                                    error
                                );
                                setFeedback(getErrorMessage(error));
                            });
                        }
                        if (
                            payload.new.sender_id !== currentUser.id &&
                            panel.hidden
                        ) {
                            showMessageIndicator();
                        }
                        scrollToLatest();
                    }
                    if (isSupportAgent) {
                        void loadInbox().catch(error => {
                            console.error(
                                "[GEN-Z.AI Support Chat] Gagal menyegarkan inbox:",
                                error
                            );
                        });
                    }
                }
            )
            .subscribe(status => {
                if (
                    status === "SUBSCRIBED" &&
                    !isSupportAgent &&
                    panel.hidden &&
                    activeConversation?.id === conversationId
                ) {
                    void checkForUnreadSupportMessage(conversationId);
                }
                if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
                    setFeedback(
                        "Koneksi live terputus. Coba muat ulang chat."
                    );
                }
            });
    }

    async function checkForUnreadSupportMessage(conversationId) {
        const conversation = activeConversation;
        if (
            !conversation ||
            conversation.id !== conversationId ||
            !panel.hidden
        ) {
            return;
        }

        const { data, error } = await supabaseClient
            .from("support_messages")
            .select("created_at")
            .eq("conversation_id", conversationId)
            .eq("sender_role", "support")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) {
            console.error(
                "[GEN-Z.AI Support Chat] Gagal memeriksa pesan admin yang belum dibaca:",
                error
            );
            return;
        }

        if (
            data?.created_at &&
            (
                !conversation.user_read_at ||
                new Date(data.created_at) >
                    new Date(conversation.user_read_at)
            )
        ) {
            showMessageIndicator();
        }
    }

    function subscribeToConversation(conversationId) {
        if (conversationChannel) {
            void supabaseClient.removeChannel(conversationChannel);
        }
        conversationChannel = supabaseClient
            .channel("genz-support-conversation-" + conversationId)
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "support_conversations",
                    filter: "id=eq." + conversationId
                },
                payload => {
                    if (payload.new.status === "closed") {
                        activeConversation = null;
                        latestUserMessage = null;
                        clearUnreadNoticeTimer();
                        unsubscribeMessages();
                        if (conversationChannel) {
                            void supabaseClient.removeChannel(
                                conversationChannel
                            );
                            conversationChannel = null;
                        }
                        composer.hidden = true;
                        renderEmpty("Percakapan telah ditutup oleh tim support.");
                        renderStartChatAction();
                        return;
                    }
                    activeConversation = {
                        ...activeConversation,
                        ...payload.new
                    };
                    updateReadReceipts();
                    if (isSupportAgent) {
                        void loadInbox().catch(error => {
                            console.error(
                                "[GEN-Z.AI Support Chat] Gagal menyegarkan inbox:",
                                error
                            );
                        });
                    } else {
                        updateVisitorHeading();
                        scheduleUnreadBusyNotice(
                            conversationId,
                            latestUserMessage
                        );
                    }
                }
            )
            .subscribe(status => {
                if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
                    setFeedback(
                        "Koneksi status chat terputus. Coba muat ulang chat."
                    );
                }
            });
    }

    function subscribeToInbox() {
        if (inboxChannel) {
            void supabaseClient.removeChannel(inboxChannel);
        }
        inboxChannel = supabaseClient
            .channel("genz-support-inbox")
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "support_conversations"
                },
                payload => {
                    const conversation = payload.new;
                    if (
                        panel.hidden &&
                        conversation?.user_id !== currentUser.id &&
                        conversation?.last_user_message_at &&
                        (
                            !conversation.admin_read_at ||
                            new Date(conversation.last_user_message_at) >
                                new Date(conversation.admin_read_at)
                        )
                    ) {
                        showMessageIndicator();
                    }
                    void loadInbox().catch(error => {
                        console.error(
                            "[GEN-Z.AI Support Chat] Gagal menyegarkan inbox:",
                            error
                        );
                    });
                }
            )
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "support_messages"
                },
                payload => {
                    const incomingMessage = payload.new;
                    if (
                        incomingMessage.sender_role !== "user" ||
                        incomingMessage.sender_id === currentUser.id
                    ) {
                        return;
                    }

                    const isOpenConversation =
                        !panel.hidden &&
                        activeConversation?.id ===
                            incomingMessage.conversation_id;
                    if (isOpenConversation) {
                        void markConversationRead(
                            incomingMessage.conversation_id
                        ).catch(error => {
                            console.error(
                                "[GEN-Z.AI Support Chat] Gagal menandai pesan telah dibaca:",
                                error
                            );
                            setFeedback(getErrorMessage(error));
                        });
                        return;
                    }

                    unreadConversationIds.add(
                        incomingMessage.conversation_id
                    );
                    renderInbox();
                    showMessageIndicator();
                }
            )
            .subscribe(status => {
                if (status === "SUBSCRIBED" && isSupportAgent) {
                    void loadInbox().catch(error => {
                        console.error(
                            "[GEN-Z.AI Support Chat] Gagal memuat inbox setelah tersambung:",
                            error
                        );
                        setFeedback(getErrorMessage(error));
                    });
                }
                if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
                    setFeedback(
                        "Koneksi inbox live terputus. Coba muat ulang chat."
                    );
                }
            });
    }

    function unsubscribeMessages() {
        if (!messageChannel || !supabaseClient) return;
        void supabaseClient.removeChannel(messageChannel);
        messageChannel = null;
    }

    function renderStartChatAction() {
        const startButton = createElement("button", "genz-chat-start", {
            type: "button",
            text: "Mulai chat baru"
        });
        startButton.addEventListener("click", startConversation);
        feedback.replaceChildren(startButton);
    }

    async function sendMessage(event) {
        event.preventDefault();
        if (!activeConversation || busy) return;
        const body = input.value.trim();
        if (!body && !selectedImage) return;
        if (body.length > MAX_MESSAGE_LENGTH) {
            setFeedback("Pesan maksimal 2.000 karakter.");
            return;
        }

        busy = true;
        sendButton.disabled = true;
        setFeedback("");
        try {
            const { data: sentMessage, error } = await supabaseClient
                .from("support_messages")
                .insert({
                    conversation_id: activeConversation.id,
                    sender_id: currentUser.id,
                    sender_role: isSupportAgent ? "support" : "user",
                    body,
                    image_data: selectedImage?.data || null,
                    image_type: selectedImage?.type || null
                })
                .select("id,conversation_id,sender_id,sender_role,sender_name,body,created_at,image_data,image_type")
                .single();

            if (error) throw error;
            if (sentMessage.sender_role === "user") {
                latestUserMessage = sentMessage;
                scheduleUnreadBusyNotice(
                    activeConversation.id,
                    sentMessage
                );
                updateReadReceipts();
            }
            if (
                !messages.querySelector(
                    '[data-message-id="' + sentMessage.id + '"]'
                )
            ) {
                renderMessage(sentMessage);
            }
            updateReadReceipts();
            scrollToLatest();
            input.value = "";
            clearImageAttachment();
        } catch (error) {
            console.error("[GEN-Z.AI Support Chat] Gagal mengirim pesan:", error);
            setFeedback(getErrorMessage(error));
        } finally {
            busy = false;
            sendButton.disabled = false;
            input.focus();
        }
    }

    async function closeConversation() {
        if (!isSupportAgent || !activeConversation || busy) return;
        busy = true;
        closeThreadButton.disabled = true;
        try {
            const { error } = await supabaseClient
                .from("support_conversations")
                .update({ status: "closed" })
                .eq("id", activeConversation.id);

            if (error) throw error;
            activeConversation = null;
            unsubscribeMessages();
            await loadInbox();
            composer.hidden = true;
            closeThreadButton.hidden = true;
            renderEmpty("Percakapan ditutup. Pilih chat lain dari inbox.");
        } catch (error) {
            console.error("[GEN-Z.AI Support Chat] Gagal menutup chat:", error);
            setFeedback(getErrorMessage(error));
        } finally {
            busy = false;
            closeThreadButton.disabled = false;
        }
    }

    function renderMessage(message) {
        const bubble = createElement("div", "genz-chat-message", {
            "data-message-id": message.id,
            "data-sender-id": message.sender_id,
            "data-sender-role": message.sender_role,
            "data-created-at": message.created_at
        });
        if (message.sender_role === "system") {
            bubble.classList.add("is-system");
        } else if (message.sender_id === currentUser.id) {
            bubble.classList.add("is-mine");
        }
        if (message.body) {
            bubble.append(document.createTextNode(message.body));
        }
        if (message.image_data && message.image_type) {
            const image = createElement("img", "genz-chat-image", {
                src: `data:${message.image_type};base64,${message.image_data}`,
                alt: "Gambar yang dikirim melalui live chat",
                loading: "lazy"
            });
            image.addEventListener("click", () => {
                const imageWindow = window.open();
                if (imageWindow) {
                    imageWindow.document.title = "Gambar live chat";
                    imageWindow.document.body.style.margin = "0";
                    imageWindow.document.body.style.background = "#101218";
                    imageWindow.document.body.append(image.cloneNode());
                    imageWindow.document.querySelector("img").style.cssText =
                        "display:block;max-width:100%;max-height:100vh;margin:auto";
                }
            });
            bubble.append(image);
        }
        const senderName = message.sender_name ||
            (message.sender_role === "support"
                ? activeConversation?.admin_name ||
                    (isSupportAgent ? supportAgentName : "Admin Support")
                : message.sender_role === "user"
                    ? activeConversation?.user_name ||
                        (isSupportAgent ? "Pengunjung" : "Pengguna")
                    : "Info");
        bubble.append(
            createElement("span", "genz-chat-message-meta", {
                text:
                    senderName + " · " +
                    formatTime(message.created_at)
            })
        );
        messages.append(bubble);
    }

    async function selectImageAttachment() {
        const [file] = imageInput.files || [];
        if (!file) return;

        if (
            !["image/jpeg", "image/png", "image/webp"].includes(file.type)
        ) {
            setFeedback("Pilih gambar berformat JPG, PNG, atau WebP.");
            imageInput.value = "";
            return;
        }
        if (file.size > MAX_IMAGE_FILE_SIZE) {
            setFeedback("Ukuran gambar maksimal 8 MB.");
            imageInput.value = "";
            return;
        }

        imageButton.disabled = true;
        setFeedback("Mengoptimalkan gambar...");
        try {
            const compressedImage = await compressImage(file);
            clearImageAttachment();
            selectedImage = {
                data: compressedImage.data,
                type: compressedImage.type,
                name: file.name,
                previewUrl: URL.createObjectURL(compressedImage.blob)
            };
            attachmentThumbnail.src = selectedImage.previewUrl;
            attachmentName.textContent = selectedImage.name;
            attachmentPreview.hidden = false;
            setFeedback("");
        } catch (error) {
            console.error(
                "[GEN-Z.AI Support Chat] Gagal menyiapkan gambar:",
                error
            );
            setFeedback(error.message || "Gambar gagal disiapkan.");
        } finally {
            imageButton.disabled = false;
            imageInput.value = "";
        }
    }

    async function compressImage(file) {
        if (typeof createImageBitmap !== "function") {
            throw new Error("Browser ini belum mendukung upload gambar.");
        }

        const bitmap = await createImageBitmap(file);
        try {
            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d");
            if (!context) {
                throw new Error("Gambar tidak dapat diproses di browser ini.");
            }

            let scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
            const qualities = [0.82, 0.7, 0.58, 0.46];
            while (scale >= 0.25) {
                canvas.width = Math.max(1, Math.round(bitmap.width * scale));
                canvas.height = Math.max(1, Math.round(bitmap.height * scale));
                context.clearRect(0, 0, canvas.width, canvas.height);
                context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

                for (const quality of qualities) {
                    let blob = await new Promise((resolve, reject) => {
                        canvas.toBlob(
                            result => {
                                if (result) resolve(result);
                                else reject(new Error("Gambar gagal diproses."));
                            },
                            "image/webp",
                            quality
                        );
                    });
                    let type = blob.type;
                    if (type !== "image/webp") {
                        context.fillStyle = "#fff";
                        context.fillRect(0, 0, canvas.width, canvas.height);
                        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
                        blob = await new Promise((resolve, reject) => {
                            canvas.toBlob(
                                result => {
                                    if (result) resolve(result);
                                    else reject(
                                        new Error("Gambar gagal diproses.")
                                    );
                                },
                                "image/jpeg",
                                quality
                            );
                        });
                        type = "image/jpeg";
                    }
                    if (blob.size > MAX_COMPRESSED_IMAGE_SIZE) continue;
                    return {
                        blob,
                        type,
                        data: (await blobToDataUrl(blob)).split(",", 2)[1]
                    };
                }
                scale *= 0.8;
            }
        } finally {
            bitmap.close();
        }

        throw new Error(
            "Gambar terlalu besar setelah dikompres. Coba gambar lain yang lebih kecil."
        );
    }

    function blobToDataUrl(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.addEventListener("load", () => {
                if (typeof reader.result !== "string") {
                    reject(new Error("Gambar gagal dibaca."));
                    return;
                }
                resolve(reader.result);
            }, { once: true });
            reader.addEventListener(
                "error",
                () => reject(reader.error || new Error("Gambar gagal dibaca.")),
                { once: true }
            );
            reader.readAsDataURL(blob);
        });
    }

    function clearImageAttachment() {
        if (selectedImage?.previewUrl) {
            URL.revokeObjectURL(selectedImage.previewUrl);
        }
        selectedImage = null;
        attachmentThumbnail.removeAttribute("src");
        attachmentName.textContent = "";
        attachmentPreview.hidden = true;
        imageInput.value = "";
    }

    async function markConversationRead(conversationId) {
        const { data, error } = await supabaseClient.rpc(
            "mark_support_conversation_read",
            { p_conversation_id: conversationId }
        );
        if (error) throw error;

        const readAt = data?.admin_read_at;
        if (!readAt) {
            throw new Error("Supabase tidak mengonfirmasi status pesan dibaca.");
        }

        const updates = {
            admin_read_at: readAt,
            admin_name: data.admin_name || supportAgentName
        };
        conversations = conversations.map(conversation =>
            conversation.id === conversationId
                ? { ...conversation, ...updates }
                : conversation
        );
        if (activeConversation?.id === conversationId) {
            activeConversation = { ...activeConversation, ...updates };
        }
        unreadConversationIds.delete(conversationId);
        renderInbox();
        updateReadReceipts();
    }

    async function markConversationReadByUser(conversationId) {
        const { data: readAt, error } = await supabaseClient.rpc(
            "mark_support_conversation_read_by_user",
            { p_conversation_id: conversationId }
        );
        if (error) throw error;
        if (!readAt) {
            throw new Error("Supabase tidak mengonfirmasi status pesan dibaca.");
        }

        if (activeConversation?.id === conversationId) {
            activeConversation = {
                ...activeConversation,
                user_read_at: readAt
            };
        }
        updateReadReceipts();
    }

    function updateVisitorHeading() {
        if (isSupportAgent) return;
        subtitle.textContent = activeConversation?.admin_name
            ? `Admin: ${activeConversation.admin_name}`
            : "Tim support GEN-Z.AI";
    }

    function updateReadReceipts() {
        if (!activeConversation || !currentUser) return;
        const readAt = isSupportAgent
            ? activeConversation.user_read_at
            : activeConversation.admin_read_at;
        const reader = isSupportAgent ? "pengunjung" : "admin";
        const outgoingRole = isSupportAgent ? "support" : "user";

        messages.querySelectorAll(".genz-chat-message").forEach(bubble => {
            bubble.querySelector(".genz-chat-read-check")?.remove();
            if (
                bubble.dataset.senderId !== currentUser.id ||
                bubble.dataset.senderRole !== outgoingRole
            ) {
                return;
            }

            const wasRead =
                readAt &&
                new Date(readAt) >= new Date(bubble.dataset.createdAt);
            const status = createElement("span", "genz-chat-read-check", {
                text: " ✓✓",
                title: wasRead
                    ? `Dibaca oleh ${reader}`
                    : `Belum dibaca oleh ${reader}`,
                "aria-label": wasRead
                    ? `Dibaca oleh ${reader}`
                    : `Belum dibaca oleh ${reader}`
            });
            if (wasRead) status.classList.add("is-read");
            bubble.querySelector(".genz-chat-message-meta")?.append(status);
        });
    }

    function scheduleUnreadBusyNotice(conversationId, message) {
        clearUnreadNoticeTimer();
        if (
            isSupportAgent ||
            !message ||
            message.sender_role !== "user" ||
            !activeConversation ||
            activeConversation.id !== conversationId ||
            (
                activeConversation.admin_read_at &&
                new Date(activeConversation.admin_read_at) >=
                    new Date(message.created_at)
            )
        ) {
            return;
        }

        const deadline =
            new Date(message.created_at).getTime() + UNREAD_NOTICE_DELAY_MS;
        unreadNoticeTimer = window.setTimeout(() => {
            void sendUnreadBusyNotice(conversationId, message.id);
        }, Math.max(0, deadline - Date.now()));
    }

    async function sendUnreadBusyNotice(conversationId, messageId) {
        if (
            !activeConversation ||
            activeConversation.id !== conversationId ||
            latestUserMessage?.id !== messageId
        ) {
            return;
        }

        try {
            const { error } = await supabaseClient.rpc(
                "add_support_busy_notice",
                { p_conversation_id: conversationId }
            );
            if (error) throw error;
        } catch (error) {
            console.error(
                "[GEN-Z.AI Support Chat] Gagal mengirim pemberitahuan admin sibuk:",
                error
            );
            if (!panel.hidden) setFeedback(getErrorMessage(error));
        }
    }

    function clearUnreadNoticeTimer() {
        if (unreadNoticeTimer === null) return;
        window.clearTimeout(unreadNoticeTimer);
        unreadNoticeTimer = null;
    }

    function showMessageIndicator() {
        launcher.classList.add("has-new-message");
        launcher.setAttribute(
            "aria-label",
            "Ada pesan baru di live chat dukungan"
        );
    }

    function clearMessageIndicator() {
        launcher.classList.remove("has-new-message");
        launcher.setAttribute("aria-label", "Buka live chat dukungan");
    }

    function renderEmpty(text) {
        messages.replaceChildren();
        appendEmptyMessage(text);
    }

    function appendEmptyMessage(text) {
        messages.append(
            createElement("div", "genz-chat-empty", { text })
        );
    }

    function setFeedback(text) {
        feedback.replaceChildren(document.createTextNode(text));
    }

    function scrollToLatest() {
        messages.scrollTop = messages.scrollHeight;
    }

    function formatTime(value) {
        if (!value) return "Baru";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "Baru";
        return new Intl.DateTimeFormat("id-ID", {
            hour: "2-digit",
            minute: "2-digit"
        }).format(date);
    }

    function getErrorMessage(error) {
        const message = String(error?.message || "").toLowerCase();
        if (
            message.includes("anonymous") &&
            (message.includes("disabled") || message.includes("not enabled"))
        ) {
            return "Chat pengunjung belum aktif. Tim perlu mengaktifkan Anonymous Sign-Ins di Supabase Auth.";
        }
        if (
            message.includes("relation") &&
            message.includes("does not exist")
        ) {
            return "Fitur chat belum disiapkan di database. Jalankan migration support-chat.sql di Supabase.";
        }
        if (
            message.includes("support_conversations") ||
            message.includes("support_messages") ||
            message.includes("last_user_message_at") ||
            message.includes("admin_read_at") ||
            message.includes("admin_name") ||
            message.includes("mark_support_conversation_read") ||
            message.includes("add_support_busy_notice") ||
            message.includes("schema cache")
        ) {
            return "Struktur live chat belum diperbarui. Jalankan ulang migration terbaru supabase/support-chat.sql di Supabase.";
        }
        if (
            message.includes("network") ||
            message.includes("fetch")
        ) {
            return "Koneksi bermasalah. Periksa internet lalu coba lagi.";
        }
        return error?.message || "Live chat gagal dimuat.";
    }
})();
