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

    let supabaseClient = null;
    let currentUser = null;
    let isSupportAgent = false;
    let activeConversation = null;
    let messageChannel = null;
    let conversationChannel = null;
    let inboxChannel = null;
    let conversations = [];
    let busy = false;
    let connectionAttempt = 0;

    const launcher = createElement("button", "genz-chat-launcher", {
        type: "button",
        "aria-label": "Buka live chat dukungan",
        "aria-expanded": "false"
    });
    launcher.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 8.7 3.9a8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z"/></svg>';

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
    headingWrap.append(title, subtitle);

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
    composer.append(input, sendButton);

    content.append(messages, feedback, tools, composer);
    layout.append(inbox, content);
    panel.append(header, layout);
    document.body.append(launcher, panel);
    addStylesheet();

    launcher.addEventListener("click", openChat);
    closeButton.addEventListener("click", closeChat);
    composer.addEventListener("submit", sendMessage);
    closeThreadButton.addEventListener("click", closeConversation);

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

    async function ensureVisitorSession() {
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
            return;
        }

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
                    lock: async (_name, _timeout, callback) => await callback()
                }
            }
        );
        const {
            data: { session: guestSession },
            error: guestSessionError
        } = await guestClient.auth.getSession();

        if (guestSessionError) {
            throw guestSessionError;
        }

        if (guestSession) {
            currentUser = guestSession.user;
            supabaseClient = guestClient;
            return;
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
    }

    async function detectSupportAgent() {
        if (currentUser.is_anonymous) {
            isSupportAgent = false;
            return;
        }

        const { data: profile, error } = await supabaseClient
            .from("profiles")
            .select("role")
            .eq("id", currentUser.id)
            .maybeSingle();

        if (error) {
            throw error;
        }

        const role = String(profile?.role || "").trim().toUpperCase();
        isSupportAgent = role === "ADMIN" || role === "OWNER";
    }

    async function openChat() {
        panel.hidden = false;
        launcher.hidden = true;
        launcher.setAttribute("aria-expanded", "true");
        setFeedback("Menghubungkan ke tim support...");

        if (busy) return;
        busy = true;
        const attempt = ++connectionAttempt;
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
            retryButton.addEventListener("click", openChat);
            feedback.append(retryButton);
        }, 15000);
        try {
            await ensureVisitorSession();
            if (attempt !== connectionAttempt) return;
            await detectSupportAgent();
            if (attempt !== connectionAttempt) return;
            composer.hidden = false;
            inbox.hidden = !isSupportAgent;
            tools.hidden = !isSupportAgent;

            if (isSupportAgent) {
                subtitle.textContent = "Inbox dukungan";
                await loadInbox();
                if (attempt !== connectionAttempt) return;
                subscribeToInbox();
                if (activeConversation) {
                    composer.hidden = false;
                    closeThreadButton.hidden = false;
                    await loadMessages(activeConversation.id);
                    if (attempt !== connectionAttempt) return;
                    subscribeToMessages(activeConversation.id);
                } else {
                    composer.hidden = true;
                    closeThreadButton.hidden = true;
                    renderEmpty("Pilih percakapan untuk mulai membalas.");
                }
            } else {
                subtitle.textContent = currentUser.is_anonymous
                    ? "Chat langsung dengan tim kami"
                    : "Terhubung dengan tim support";
                await loadUserConversation(attempt);
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
        unsubscribeMessages();
        if (conversationChannel && supabaseClient) {
            void supabaseClient.removeChannel(conversationChannel);
            conversationChannel = null;
        }
        if (inboxChannel && supabaseClient) {
            void supabaseClient.removeChannel(inboxChannel);
            inboxChannel = null;
        }
    }

    async function loadUserConversation(attempt = null) {
        const { data, error } = await supabaseClient
            .from("support_conversations")
            .select("id,user_id,user_name,user_email,status,last_message_at")
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
            await loadMessages(activeConversation.id);
            if (attempt !== null && attempt !== connectionAttempt) return;
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
                .select("id,user_id,user_name,user_email,status,last_message_at")
                .single();

            if (error) throw error;
            activeConversation = data;
            setFeedback("");
            composer.hidden = false;
            closeThreadButton.hidden = true;
            await loadMessages(data.id);
            subscribeToMessages(data.id);
            subscribeToConversation(data.id);
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
            .select("id,user_id,user_name,user_email,status,last_message_at")
            .eq("status", "open")
            .order("last_message_at", { ascending: false })
            .limit(50);

        if (error) throw error;
        conversations = data || [];
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
            thread.append(
                createElement("span", "genz-chat-thread-name", {
                    text: conversation.user_name || "Pengunjung"
                }),
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
            .select("id,conversation_id,sender_id,sender_role,body,created_at")
            .eq("conversation_id", conversationId)
            .order("created_at", { ascending: false })
            .limit(200);

        if (error) throw error;
        messages.replaceChildren();
        for (const message of (data || []).reverse()) {
            renderMessage(message);
        }
        if (!data?.length) {
            appendEmptyMessage("Kirim pesan pertama Anda.");
        }
        setFeedback("");
        scrollToLatest();
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
                if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
                    setFeedback(
                        "Koneksi live terputus. Coba muat ulang chat."
                    );
                }
            });
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
                    if (payload.new.status !== "closed") return;
                    activeConversation = null;
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
                () => {
                    void loadInbox().catch(error => {
                        console.error(
                            "[GEN-Z.AI Support Chat] Gagal menyegarkan inbox:",
                            error
                        );
                    });
                }
            )
            .subscribe(status => {
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
        if (!body) return;
        if (body.length > MAX_MESSAGE_LENGTH) {
            setFeedback("Pesan maksimal 2.000 karakter.");
            return;
        }

        busy = true;
        sendButton.disabled = true;
        setFeedback("");
        try {
            const { error } = await supabaseClient
                .from("support_messages")
                .insert({
                    conversation_id: activeConversation.id,
                    sender_id: currentUser.id,
                    sender_role: isSupportAgent ? "support" : "user",
                    body
                });

            if (error) throw error;
            input.value = "";
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
            "data-message-id": message.id
        });
        if (message.sender_id === currentUser.id) {
            bubble.classList.add("is-mine");
        }
        bubble.append(
            document.createTextNode(message.body),
            createElement("span", "genz-chat-message-meta", {
                text:
                    (message.sender_role === "support" ? "Support · " : "") +
                    formatTime(message.created_at)
            })
        );
        messages.append(bubble);
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
            message.includes("schema cache")
        ) {
            return "Tabel live chat belum tersedia. Jalankan migration supabase/support-chat.sql di Supabase.";
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
