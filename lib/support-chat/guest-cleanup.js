/*
 * =========================================================
 * GEN-Z.AI
 * LIVE CHAT — PEMBERSIHAN AKUN TAMU
 * ---------------------------------------------------------
 * File: lib/support-chat/guest-cleanup.js
 * ---------------------------------------------------------
 *
 * Live chat memakai Supabase anonymous sign-in supaya pengunjung
 * bisa mengirim pesan tanpa mendaftar. Masalahnya, anonymous
 * sign-in membuat baris SUNGGUHAN di auth.users yang tidak punya
 * profil (nama, email, kredit). Kalau dibiarkan, daftar user admin
 * penuh akun kosong.
 *
 * Aturan modul ini:
 *
 *   1. HANYA akun dengan is_anonymous === true yang boleh dihapus.
 *      Akun pendaftar asli tidak pernah disentuh.
 *
 *   2. Akun tamu baru diberi masa tenggang 24 jam supaya percakapan
 *      yang sedang berjalan tidak diputus di tengah jalan.
 *
 *   3. Akun tamu dipertahankan selama percakapannya masih `open`.
 *
 *   4. Akun tamu dihapus bila tidak punya percakapan sama sekali,
 *      atau percakapannya sudah tidak aktif lebih dari 7 hari.
 *      Penghapusan user membuat percakapan & pesannya ikut terhapus
 *      lewat foreign key on delete cascade.
 *
 * Modul ini tidak menyimpan kredensial. Pemanggil (cron Cloudflare
 * Worker) membuat API client lewat createGuestCleanupApi() dengan
 * service-role key dari env.
 * =========================================================
 */

export const HOUR_MS = 60 * 60 * 1000;

/** Akun tamu baru tidak disentuh selama 24 jam. */
export const GUEST_GRACE_MS = 24 * HOUR_MS;

/** Percakapan tamu yang sudah 7 hari tidak aktif ikut dibersihkan. */
export const GUEST_IDLE_MS = 7 * 24 * HOUR_MS;

/** Cron dijalankan sekali per jam (worker scheduled tiap 5 menit). */
export const GUEST_CLEANUP_INTERVAL_MINUTES = 60;

/** Batas aman jumlah akun yang dihapus dalam satu putaran. */
export const GUEST_CLEANUP_MAX_DELETIONS = 200;

export const GUEST_KEEP_REASONS = Object.freeze({
    notGuest: "not_guest",
    unknownCreatedAt: "unknown_created_at",
    gracePeriod: "grace_period",
    openConversation: "open_conversation",
    recentActivity: "recent_activity"
});

export const GUEST_DELETE_REASONS = Object.freeze({
    noConversation: "no_conversation",
    idle: "idle"
});

/** True hanya untuk akun hasil anonymous sign-in. */
export function isGuestAuthUser(user) {
    return Boolean(user && user.is_anonymous === true);
}

function toTime(value) {
    const time = Date.parse(value);
    return Number.isFinite(time) ? time : null;
}

/**
 * Ringkas aktivitas percakapan per user.
 *
 * @param {Array<{user_id?: string, status?: string, last_message_at?: string}>} conversations
 */
function summarizeConversations(conversations) {
    const summary = new Map();

    for (const conversation of Array.isArray(conversations) ? conversations : []) {
        const userId = conversation?.user_id;
        if (!userId) continue;

        const current = summary.get(userId) || {
            total: 0,
            open: false,
            lastActivity: null
        };

        current.total += 1;
        if (conversation.status === "open") current.open = true;

        const activity = toTime(conversation.last_message_at);
        if (activity !== null && (current.lastActivity === null || activity > current.lastActivity)) {
            current.lastActivity = activity;
        }

        summary.set(userId, current);
    }

    return summary;
}

/**
 * Tentukan akun tamu mana yang boleh dihapus.
 *
 * Fungsi ini murni (tanpa jaringan) supaya bisa diuji dan diaudit
 * dengan mudah: tidak ada penghapusan tanpa keputusan eksplisit di sini.
 *
 * @returns {{scanned: number, deleteIds: string[], deleted: Array<{id: string, reason: string}>, kept: Array<{id: string, reason: string}>}}
 */
export function selectStaleGuestAccounts({
    guests = [],
    conversations = [],
    now = new Date(),
    graceMs = GUEST_GRACE_MS,
    idleMs = GUEST_IDLE_MS
} = {}) {
    const nowTime = now instanceof Date ? now.getTime() : Date.parse(now);
    const referenceTime = Number.isFinite(nowTime) ? nowTime : Date.now();
    const activity = summarizeConversations(conversations);

    const deleted = [];
    const kept = [];

    for (const guest of Array.isArray(guests) ? guests : []) {
        const id = String(guest?.id || "").trim();
        if (!id) continue;

        if (!isGuestAuthUser(guest)) {
            kept.push({ id, reason: GUEST_KEEP_REASONS.notGuest });
            continue;
        }

        const createdAt = toTime(guest.created_at);
        if (createdAt === null) {
            kept.push({ id, reason: GUEST_KEEP_REASONS.unknownCreatedAt });
            continue;
        }

        if (referenceTime - createdAt < graceMs) {
            kept.push({ id, reason: GUEST_KEEP_REASONS.gracePeriod });
            continue;
        }

        const summary = activity.get(id);

        if (summary?.open) {
            kept.push({ id, reason: GUEST_KEEP_REASONS.openConversation });
            continue;
        }

        if (summary?.lastActivity !== null && summary?.lastActivity !== undefined) {
            if (referenceTime - summary.lastActivity < idleMs) {
                kept.push({ id, reason: GUEST_KEEP_REASONS.recentActivity });
                continue;
            }
            deleted.push({ id, reason: GUEST_DELETE_REASONS.idle });
            continue;
        }

        deleted.push({ id, reason: GUEST_DELETE_REASONS.noConversation });
    }

    return {
        scanned: Array.isArray(guests) ? guests.length : 0,
        deleteIds: deleted.map(entry => entry.id),
        deleted,
        kept
    };
}

/**
 * Jalankan pembersihan memakai API client (lihat createGuestCleanupApi).
 *
 * @returns {Promise<object>} ringkasan: jumlah dipindai, dihapus, gagal.
 */
export async function runGuestCleanup(api, options = {}) {
    if (!api || typeof api.listGuestUsers !== "function") {
        throw new Error("API pembersihan akun tamu tidak tersedia.");
    }

    const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
    const dryRun = options.dryRun === true;
    const maxDeletions = Number.isFinite(options.maxDeletions)
        ? Math.max(0, options.maxDeletions)
        : GUEST_CLEANUP_MAX_DELETIONS;

    const guests = await api.listGuestUsers();
    const conversations = typeof api.listConversations === "function"
        ? await api.listConversations()
        : [];

    const plan = selectStaleGuestAccounts({
        guests,
        conversations,
        now,
        graceMs: options.graceMs,
        idleMs: options.idleMs
    });

    /*
     * Guard kedua: hanya id yang memang terdaftar sebagai akun tamu
     * pada daftar terbaru yang boleh dihapus, walau plan keliru.
     */
    const guestIds = new Set(
        guests.filter(isGuestAuthUser).map(guest => String(guest.id))
    );

    const targets = plan.deleteIds
        .filter(id => guestIds.has(String(id)))
        .slice(0, maxDeletions);

    const failed = [];
    let removed = 0;

    if (!dryRun) {
        for (const id of targets) {
            try {
                await api.deleteUser(id);
                removed += 1;
            } catch (error) {
                failed.push({ id, message: String(error?.message || "unknown error") });
            }
        }
    }

    return {
        ok: failed.length === 0,
        dryRun,
        scanned: plan.scanned,
        conversationsScanned: conversations.length,
        planned: targets.length,
        deleted: removed,
        truncated: plan.deleteIds.length > targets.length,
        failed,
        kept: plan.kept
    };
}

/**
 * True bila cron boleh berjalan pada menit ini.
 * Worker scheduled berjalan tiap 5 menit; pembersihan cukup 1x per jam.
 */
export function shouldRunGuestCleanup(date = new Date(), intervalMinutes = GUEST_CLEANUP_INTERVAL_MINUTES) {
    const minutes = date instanceof Date ? date.getUTCMinutes() : new Date(date).getUTCMinutes();
    const step = Math.max(1, Number(intervalMinutes) || 1);
    return Number.isFinite(minutes) && minutes % step === 0;
}

function trimBaseUrl(url) {
    return String(url || "").trim().replace(/\/+$/, "");
}

/**
 * API client Supabase untuk pembersihan akun tamu.
 * Memakai service-role key, jadi hanya boleh dipanggil dari server.
 */
export function createGuestCleanupApi({ url, serviceRoleKey, fetchImpl } = {}) {
    const baseUrl = trimBaseUrl(url);
    const key = String(serviceRoleKey || "").trim();
    const request = fetchImpl || (typeof fetch === "function" ? fetch : null);

    if (!baseUrl || !key) {
        throw new Error("Konfigurasi Supabase server belum lengkap untuk pembersihan akun tamu.");
    }
    if (typeof request !== "function") {
        throw new Error("Fetch tidak tersedia di runtime ini.");
    }

    const headers = {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json"
    };

    async function readError(response) {
        let message = `Supabase HTTP ${response?.status || 0}`;
        try {
            const text = await response.text();
            if (text) {
                try {
                    const data = JSON.parse(text);
                    message = String(data?.message || data?.msg || data?.error || message);
                } catch {
                    message = text.slice(0, 300);
                }
            }
        } catch {
            /* abaikan */
        }
        return new Error(message.slice(0, 500));
    }

    return {
        /**
         * Daftar akun tamu (anonymous) dari Supabase Auth.
         * Akun pendaftar asli tidak pernah dikembalikan.
         */
        async listGuestUsers({ pageSize = 1000, maxPages = 20 } = {}) {
            const guests = [];

            for (let page = 1; page <= maxPages; page += 1) {
                const response = await request(
                    `${baseUrl}/auth/v1/admin/users?page=${page}&per_page=${pageSize}`,
                    { method: "GET", headers }
                );
                if (!response?.ok) throw await readError(response);

                const data = await response.json().catch(() => null);
                const users = Array.isArray(data?.users) ? data.users : [];

                guests.push(...users.filter(isGuestAuthUser));

                if (users.length < pageSize) break;
            }

            return guests;
        },

        /** Semua percakapan support (ringkas, hanya kolom yang dipakai). */
        async listConversations({ pageSize = 1000, maxPages = 20 } = {}) {
            const rows = [];

            for (let page = 0; page < maxPages; page += 1) {
                const offset = page * pageSize;
                const response = await request(
                    `${baseUrl}/rest/v1/support_conversations` +
                        "?select=id,user_id,status,last_message_at" +
                        `&order=last_message_at.desc&limit=${pageSize}&offset=${offset}`,
                    { method: "GET", headers }
                );
                if (!response?.ok) throw await readError(response);

                const data = await response.json().catch(() => null);
                const list = Array.isArray(data) ? data : [];

                rows.push(...list);
                if (list.length < pageSize) break;
            }

            return rows;
        },

        /** Hapus akun tamu beserta percakapan & pesannya (cascade). */
        async deleteUser(id) {
            const response = await request(
                `${baseUrl}/auth/v1/admin/users/${encodeURIComponent(id)}`,
                { method: "DELETE", headers }
            );
            if (!response?.ok) throw await readError(response);
            return true;
        }
    };
}
