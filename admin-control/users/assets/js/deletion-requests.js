//admin-control/users/assets/js/deletion-requests.js?v=1
/* =========================================================
   GEN-Z.AI
   USER MANAGEMENT — ACCOUNT DELETION REQUESTS
   ---------------------------------------------------------
   File:
   admin-control/users/assets/js/deletion-requests.js

   Fungsi:
   - Menampilkan permintaan penghapusan akun + data yang
     diajukan user dari /user/profile.html
   - Filter status (pending / selesai / ditolak / semua)
   - Menandai permintaan selesai atau menolaknya
   - Badge jumlah permintaan pending

   Endpoint:
   GET   ../../api/admin-deletion-requests?status=...
   PATCH ../../api/admin-deletion-requests
========================================================= */

const API_URL = "../../api/admin-deletion-requests";


const REASON_LABELS = {
    "no-longer-used": "Tidak lagi memakai GEN-Z.AI",
    "switching-service": "Pindah ke layanan lain",
    "delete-all-data": "Ingin menghapus semua data",
    "too-expensive": "Biaya terlalu tinggi",
    "other": "Lainnya"
};


const STATUS_LABELS = {
    pending: "Menunggu",
    reviewed: "Ditinjau",
    completed: "Selesai",
    rejected: "Ditolak",
    cancelled: "Dibatalkan"
};


const state = {
    filter: "pending",
    loading: false,
    loaded: false,
    requests: [],
    stats: null
};


/* =========================================================
   HELPERS
========================================================= */

function escapeHtml(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function formatDate(value) {

    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}


function formatNumber(value) {
    return Number(value || 0).toLocaleString("id-ID");
}


function getSection() {
    return document.getElementById("deletionRequestsSection");
}


function getBody() {
    return document.getElementById("deletionRequestsBody");
}


function getBadge() {
    return document.getElementById("deletionPendingBadge");
}


function getSupabaseClient() {
    return window.GENZ_SUPABASE || window.supabaseClient || null;
}


async function getAccessToken() {

    const supabase = getSupabaseClient();

    if (!supabase) {
        throw new Error("Supabase client tidak tersedia.");
    }

    const { data, error } = await supabase.auth.getSession();

    if (error) {
        throw new Error(error.message || "Gagal mengambil session.");
    }

    const token = data?.session?.access_token;

    if (!token) {
        throw new Error("Session login tidak ditemukan.");
    }

    return token;
}


function setMessage(text, type) {

    const target = document.getElementById("message");

    if (!target) return;

    target.textContent = text || "";
    target.className = "message " + (type || "");

    if (text) {
        window.clearTimeout(setMessage.timer);
        setMessage.timer = window.setTimeout(() => {
            target.textContent = "";
            target.className = "message";
        }, 5000);
    }
}


/* =========================================================
   API
========================================================= */

async function apiRequest(method, body) {

    const token = await getAccessToken();

    const options = {
        method,
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
        }
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(API_URL, options);

    let result = null;

    try {
        result = await response.json();
    } catch {
        result = null;
    }

    if (!response.ok) {
        throw new Error(
            result?.error ||
            result?.message ||
            `Request gagal (${response.status}).`
        );
    }

    if (result && result.success === false) {
        throw new Error(result.error || "Request gagal.");
    }

    return result;
}


/* =========================================================
   RENDER
========================================================= */

function renderStats() {

    const badge = getBadge();
    const stats = state.stats || {};

    if (!badge) return;

    const pending = Number(stats.pending || 0);

    badge.textContent = pending > 99 ? "99+" : String(pending);
    badge.hidden = pending === 0;
}


function renderRequestCard(request) {

    const profile = request.profile || {};
    const status = String(request.status || "pending").toLowerCase();
    const statusLabel = STATUS_LABELS[status] || status;
    const reasonLabel = REASON_LABELS[request.reason] || request.reason || "—";

    const email = profile.email || request.email || "—";
    const name = String(profile.name || "").trim() || "Tanpa nama";
    const role = String(profile.role || "USER").toUpperCase();
    const accountStatus = String(profile.status || "active").toLowerCase();

    const isPending = status === "pending";

    return `
        <article class="deletion-item" data-request-id="${escapeHtml(request.id)}">

            <div class="deletion-item-head">

                <div class="deletion-item-identity">

                    <div class="deletion-avatar" aria-hidden="true">
                        ${escapeHtml(
                            (name[0] || email[0] || "?").toUpperCase()
                        )}
                    </div>

                    <div class="deletion-item-text">

                        <div class="deletion-item-name">
                            ${escapeHtml(name)}
                        </div>

                        <div class="deletion-item-email">
                            ${escapeHtml(email)}
                        </div>

                        <div class="deletion-item-chips">
                            <span class="deletion-chip">${escapeHtml(role)}</span>
                            <span class="deletion-chip">${escapeHtml(accountStatus)}</span>
                            <span class="deletion-chip">${formatNumber(profile.credits)} credit</span>
                        </div>

                    </div>

                </div>

                <span class="deletion-status deletion-status-${escapeHtml(status)}">
                    ${escapeHtml(statusLabel)}
                </span>

            </div>

            <div class="deletion-meta">

                <div class="deletion-meta-row">
                    <span>Alasan</span>
                    <strong>${escapeHtml(reasonLabel)}</strong>
                </div>

                <div class="deletion-meta-row">
                    <span>Diajukan</span>
                    <strong>${escapeHtml(formatDate(request.requested_at))}</strong>
                </div>

                ${
                    request.reviewed_at
                        ? `<div class="deletion-meta-row">
                               <span>Diproses</span>
                               <strong>${escapeHtml(formatDate(request.reviewed_at))}</strong>
                           </div>`
                        : ""
                }

            </div>

            ${
                request.note
                    ? `<p class="deletion-note">“${escapeHtml(request.note)}”</p>`
                    : ""
            }

            ${
                isPending
                    ? `<div class="deletion-actions">
                           <button
                               type="button"
                               class="primary-button deletion-complete"
                               data-id="${escapeHtml(request.id)}"
                           >
                               Tandai Selesai
                           </button>

                           <button
                               type="button"
                               class="danger-button deletion-reject"
                               data-id="${escapeHtml(request.id)}"
                           >
                               Tolak
                           </button>
                       </div>`
                    : ""
            }

        </article>
    `;
}


function renderRequests() {

    const body = getBody();

    if (!body) return;

    renderStats();

    if (!state.requests.length) {

        const emptyText =
            state.filter === "pending"
                ? "Tidak ada permintaan penghapusan yang menunggu. 🎉"
                : "Belum ada data untuk filter ini.";

        body.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">✓</div>
                <div class="empty-title">Tidak Ada Permintaan</div>
                <div class="empty-text">${escapeHtml(emptyText)}</div>
            </div>
        `;

        return;
    }

    body.innerHTML = state.requests.map(renderRequestCard).join("");
}


function renderLoading() {

    const body = getBody();

    if (!body) return;

    body.innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">…</div>
            <div class="empty-title">Memuat Permintaan</div>
            <div class="empty-text">Mengambil data permintaan penghapusan…</div>
        </div>
    `;
}


function renderError(message) {

    const body = getBody();

    if (!body) return;

    body.innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">⚠</div>
            <div class="empty-title">Gagal Memuat Permintaan</div>
            <div class="empty-text">${escapeHtml(message)}</div>
        </div>
    `;
}


/* =========================================================
   LOAD
========================================================= */

async function fetchRequests() {

    const body = getBody();

    if (!body || state.loading) return;

    state.loading = true;

    if (!state.loaded) {
        renderLoading();
    }

    try {

        const token = await getAccessToken();

        const url =
            `${API_URL}?status=${encodeURIComponent(state.filter)}&limit=60`;

        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });

        let result = null;

        try {
            result = await response.json();
        } catch {
            result = null;
        }

        if (!response.ok) {
            throw new Error(
                result?.error ||
                `Request gagal (${response.status}).`
            );
        }

        state.requests = Array.isArray(result?.requests) ? result.requests : [];
        state.stats = result?.stats || null;
        state.loaded = true;

        renderRequests();

    } catch (error) {

        console.error("[Deletion Requests] load error:", error);
        renderError(error.message || "Terjadi kesalahan.");

    } finally {
        state.loading = false;
    }
}


/* =========================================================
   ACTIONS
========================================================= */

async function reviewRequest(id, status) {

    const label = status === "completed" ? "selesai" : "ditolak";

    const confirmed = window.confirm(
        status === "completed"
            ? "Tandai permintaan ini selesai?\n\nSetelah selesai, hapus akun user lewat tombol Delete User di tabel bawah agar data benar-benar terhapus."
            : "Tolak permintaan penghapusan ini?"
    );

    if (!confirmed) return;

    const buttons = document.querySelectorAll(
        `.deletion-item[data-request-id="${id}"] button`
    );

    buttons.forEach((button) => {
        button.disabled = true;
    });

    try {

        const result = await apiRequest("PATCH", {
            action: "review",
            id,
            status
        });

        setMessage(result?.message || `Permintaan ditandai ${label}.`, "success");

        await fetchRequests();

    } catch (error) {

        console.error("[Deletion Requests] review error:", error);
        setMessage(error.message || "Gagal memproses permintaan.", "error");

        buttons.forEach((button) => {
            button.disabled = false;
        });
    }
}


/* =========================================================
   EVENTS
========================================================= */

function bindEvents() {

    const section = getSection();

    if (!section || section.dataset.bound === "1") return;

    section.dataset.bound = "1";

    section.addEventListener("click", (event) => {

        const filterButton = event.target.closest("[data-deletion-filter]");

        if (filterButton) {

            const nextFilter = filterButton.dataset.deletionFilter;

            if (!nextFilter || nextFilter === state.filter) return;

            state.filter = nextFilter;

            section
                .querySelectorAll("[data-deletion-filter]")
                .forEach((button) => {
                    button.classList.toggle(
                        "is-active",
                        button === filterButton
                    );
                });

            fetchRequests();
            return;
        }

        const refreshButton = event.target.closest("#deletionRefreshButton");

        if (refreshButton) {
            fetchRequests();
            return;
        }

        const completeButton = event.target.closest(".deletion-complete");

        if (completeButton) {
            reviewRequest(completeButton.dataset.id, "completed");
            return;
        }

        const rejectButton = event.target.closest(".deletion-reject");

        if (rejectButton) {
            reviewRequest(rejectButton.dataset.id, "rejected");
        }
    });
}


/* =========================================================
   INIT
========================================================= */

export async function initDeletionRequests() {

    const section = getSection();

    if (!section) return;

    section.hidden = false;

    bindEvents();

    await fetchRequests();
}


/* =========================================================
   GLOBAL BRIDGE
========================================================= */

if (typeof window !== "undefined") {

    window.GENZDeletionRequests = {
        init: initDeletionRequests,
        refresh: fetchRequests,
        review: reviewRequest,
        state
    };
}
