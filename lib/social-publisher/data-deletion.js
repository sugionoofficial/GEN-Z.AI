/**
 * Facebook data-deletion helpers.
 *
 * Meta requires every app that uses Facebook Login to expose a public
 * "Data Deletion Request Callback". Meta POSTs a signed_request, the app has to
 * delete the data it received from Facebook and answer with:
 *
 *   { "url": "<status page>", "confirmation_code": "<code>" }
 *
 * The status page must let the person check the progress of that request.
 */

const CONFIRMATION_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CONFIRMATION_LENGTH = 16;

/**
 * Tables that hold data received from Facebook, in the order they must be
 * deleted. `social_post_schedules` and `social_page_connections` use
 * ON DELETE RESTRICT, so runs and schedules go first.
 *
 * Characters, outfits, the account, and the Studio Medsos subscription are the
 * user's own GEN-Z.AI content — they were not received from Facebook and are
 * intentionally kept.
 */
export const FACEBOOK_DATA_DELETION_STEPS = Object.freeze([
    Object.freeze({ table: "social_post_runs", label: "Riwayat posting Facebook (post ID, permalink, caption)" }),
    Object.freeze({ table: "social_post_schedules", label: "Jadwal autopost ke Facebook Page" }),
    Object.freeze({ table: "social_page_connections", label: "Koneksi Facebook Page dan token akses terenkripsi" }),
    Object.freeze({ table: "facebook_oauth_states", label: "State OAuth Facebook yang tertunda" }),
    Object.freeze({ table: "social_facebook_identities", label: "Pemetaan akun Facebook ke akun GEN-Z.AI" })
]);

export const RETAINED_DATA_NOTE = [
    "Akun GEN-Z.AI, karakter, outfit, dan langganan Studio Medsos Anda tidak dihapus karena data tersebut Anda unggah sendiri, bukan diterima dari Facebook.",
    "Untuk menghapus seluruh akun GEN-Z.AI (termasuk karakter dan outfit), ajukan permintaan melalui Live Chat atau hubungi admin aplikasi."
];

export function generateConfirmationCode(randomBytes) {
    const bytes = randomBytes instanceof Uint8Array
        ? randomBytes
        : crypto.getRandomValues(new Uint8Array(CONFIRMATION_LENGTH));
    let code = "";
    for (let index = 0; index < CONFIRMATION_LENGTH; index += 1) {
        code += CONFIRMATION_ALPHABET[bytes[index % bytes.length] % CONFIRMATION_ALPHABET.length];
    }
    return code;
}

export function buildDeletionResponse(origin, confirmationCode) {
    const base = String(origin || "").replace(/\/+$/, "");
    const code = encodeURIComponent(String(confirmationCode || ""));
    return {
        url: `${base}/api/facebook-data-deletion?code=${code}`,
        confirmation_code: String(confirmationCode || "")
    };
}

/**
 * The public origin used for the status URL. Prefers the request host so the
 * answer keeps working on preview deployments.
 */
export function resolvePublicOrigin(req, env) {
    const headers = req?.headers || {};
    const forwardedProto = String(headers["x-forwarded-proto"] || "").split(",")[0].trim();
    const host = String(headers["x-forwarded-host"] || headers.host || "").split(",")[0].trim();
    if (host && /^[a-z0-9.:[\]-]+$/i.test(host)) {
        return `${forwardedProto === "http" ? "http" : "https"}://${host}`;
    }
    for (const candidate of [env?.PUBLIC_SITE_URL, env?.SITE_URL, env?.META_REDIRECT_URI]) {
        const value = String(candidate || "").trim();
        if (!value) continue;
        try {
            return new URL(value).origin;
        } catch {
            // ignore malformed configuration values
        }
    }
    return "https://genzai.genzai-f37.workers.dev";
}

export function resolveContact(env) {
    const email = String(env?.PRIVACY_CONTACT_EMAIL || env?.DATA_DELETION_CONTACT_EMAIL || "").trim();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return { type: "email", value: email };
    }
    const url = String(env?.PRIVACY_CONTACT_URL || "").trim();
    if (/^https:\/\//i.test(url)) {
        return { type: "url", value: url };
    }
    return { type: "chat", value: "/live-chat/" };
}

function contactHtml(contact) {
    if (contact.type === "email") {
        return `Email <a href="mailto:${escapeHtml(contact.value)}">${escapeHtml(contact.value)}</a>`;
    }
    if (contact.type === "url") {
        return `<a href="${escapeHtml(contact.value)}" rel="noopener noreferrer">${escapeHtml(contact.value)}</a>`;
    }
    return `<a href="${escapeHtml(contact.value)}">Live Chat GEN-Z.AI</a>`;
}

export function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function formatDate(value) {
    const date = value ? new Date(value) : null;
    if (!date || !Number.isFinite(date.getTime())) return "—";
    return new Intl.DateTimeFormat("id-ID", {
        timeZone: "Asia/Jakarta",
        dateStyle: "medium",
        timeStyle: "short"
    }).format(date) + " WIB";
}

const STATUS_LABELS = {
    pending: { text: "Sedang diproses", tone: "#f4c56d" },
    completed: { text: "Selesai", tone: "#35d39a" },
    failed: { text: "Perlu tindak lanjut", tone: "#ff667a" }
};

function pageShell({ title, body }) {
    return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)} • GEN-Z.AI</title>
<style>
:root{color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;padding:32px 18px 64px;background:radial-gradient(circle at 8% 0%,rgba(124,108,255,.16),transparent 30%),radial-gradient(circle at 95% 12%,rgba(70,217,232,.1),transparent 26%),#080d18;color:#edf3ff;font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;line-height:1.65}
.wrap{max-width:720px;margin:0 auto}
.brand{display:flex;align-items:center;gap:12px;margin-bottom:22px}
.mark{width:44px;height:44px;border-radius:14px;display:grid;place-items:center;background:linear-gradient(135deg,#7864ff,#2acada);font-weight:900;font-size:20px}
h1{font-size:24px;margin:0 0 6px}
.sub{color:#9eacc2;font-size:13px;margin:0}
.card{margin-top:18px;padding:20px;border:1px solid #27364c;border-radius:16px;background:linear-gradient(155deg,rgba(19,29,46,.98),rgba(12,19,32,.98))}
.status{display:inline-flex;align-items:center;gap:8px;padding:6px 12px;border-radius:999px;border:1px solid currentColor;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.06em}
.kv{display:grid;gap:10px;margin-top:16px}
.row{display:flex;justify-content:space-between;gap:14px;font-size:13px;border-bottom:1px dashed #2a3a51;padding-bottom:9px}
.row:last-child{border-bottom:0;padding-bottom:0}
.row span{color:#9eacc2}
.row strong{text-align:right;overflow-wrap:anywhere}
ul{margin:10px 0 0;padding-left:20px;font-size:13px;color:#c6d3e6}
li{margin-bottom:6px}
code{background:#0a1420;border:1px solid #2c3d55;border-radius:6px;padding:2px 6px;font-size:12px;overflow-wrap:anywhere}
a{color:#8fd8ff}
.note{margin-top:16px;padding:12px 14px;border-left:3px solid #7864ff;border-radius:0 10px 10px 0;background:#141b2c;font-size:12.5px;color:#c6d3e6}
.foot{margin-top:22px;color:#6f7e93;font-size:11px;text-align:center}
</style>
</head>
<body><div class="wrap">
<div class="brand"><div class="mark">G</div><div><h1>${escapeHtml(title)}</h1><p class="sub">GEN-Z.AI · Penghapusan Data Facebook</p></div></div>
${body}
<p class="foot">Halaman publik ini dipakai sebagai URL konfirmasi pada Meta Data Deletion Request Callback.</p>
</div></body></html>`;
}

export function renderStatusPage({ request, contact }) {
    const status = STATUS_LABELS[request?.status] || STATUS_LABELS.pending;
    const counts = request?.deleted_counts || {};
    const deletedRows = FACEBOOK_DATA_DELETION_STEPS
        .map(step => `<li>${escapeHtml(step.label)}: <strong>${Number(counts[step.table] || 0)}</strong> baris</li>`)
        .join("");
    const matched = Array.isArray(request?.matched_user_ids) ? request.matched_user_ids.length : 0;

    const body = `
<div class="card">
    <span class="status" style="color:${status.tone}">${escapeHtml(status.text)}</span>
    <div class="kv">
        <div class="row"><span>Kode konfirmasi</span><strong><code>${escapeHtml(request?.confirmation_code || "—")}</code></strong></div>
        <div class="row"><span>Diminta pada</span><strong>${escapeHtml(formatDate(request?.requested_at || request?.created_at))}</strong></div>
        <div class="row"><span>Selesai pada</span><strong>${escapeHtml(formatDate(request?.completed_at))}</strong></div>
        <div class="row"><span>Akun GEN-Z.AI terkait</span><strong>${matched} akun</strong></div>
    </div>
    ${request?.error_message ? `<div class="note"><strong>Catatan:</strong> ${escapeHtml(request.error_message)}</div>` : ""}
</div>

<div class="card">
    <strong>Data Facebook yang dihapus</strong>
    <ul>${deletedRows}</ul>
    <p class="sub" style="margin-top:14px">Yang dihapus: koneksi Facebook Page beserta token akses terenkripsi, jadwal autopost, riwayat posting Facebook, state OAuth, dan pemetaan akun Facebook.</p>
</div>

<div class="card">
    <strong>Data yang tetap disimpan</strong>
    <ul>${RETAINED_DATA_NOTE.map(note => `<li>${escapeHtml(note)}</li>`).join("")}</ul>
    <p class="sub" style="margin-top:14px">Butuh penghapusan akun penuh atau ada pertanyaan? ${contactHtml(contact)}.</p>
</div>`;
    return pageShell({ title: "Status penghapusan data", body });
}

export function renderStatusNotFoundPage({ contact }) {
    const body = `
<div class="card">
    <strong>Kode konfirmasi tidak ditemukan</strong>
    <p class="sub" style="margin-top:10px">Periksa kembali kode yang Anda terima dari Facebook. Kode ditampilkan di halaman konfirmasi setelah permintaan penghapusan dikirim.</p>
    <p class="sub" style="margin-top:10px">Jika Anda yakin sudah mengirim permintaan, hubungi ${contactHtml(contact)}.</p>
</div>`;
    return pageShell({ title: "Kode tidak ditemukan", body });
}

export function renderInstructionsPage({ callbackUrl, contact }) {
    const body = `
<div class="card">
    <strong>Cara meminta penghapusan data</strong>
    <ul>
        <li>Buka <strong>Facebook → Settings &amp; privacy → Settings → Apps and Websites</strong>, pilih GEN-Z.AI, lalu <strong>Remove</strong>.</li>
        <li>Facebook mengirim permintaan otomatis ke endpoint kami, dan Anda menerima <strong>kode konfirmasi</strong> di halaman berikutnya.</li>
        <li>Simpan kode tersebut. Status penghapusan dapat dicek kapan saja di halaman ini dengan parameter <code>?code=KODE</code>.</li>
        <li>Alternatif tanpa Facebook: hubungi ${contactHtml(contact)} dengan menyebut akun GEN-Z.AI Anda.</li>
    </ul>
</div>
<div class="card">
    <strong>Data yang dihapus</strong>
    <ul>${FACEBOOK_DATA_DELETION_STEPS.map(step => `<li>${escapeHtml(step.label)}</li>`).join("")}</ul>
    <p class="sub" style="margin-top:14px">${escapeHtml(RETAINED_DATA_NOTE[0])}</p>
</div>
<div class="card">
    <strong>Data Deletion Request Callback URL</strong>
    <p class="sub" style="margin-top:10px">Endpoint yang dipanggil Meta saat permintaan penghapusan dikirim:</p>
    <p style="margin-top:8px"><code>${escapeHtml(callbackUrl)}</code></p>
    <p class="sub" style="margin-top:10px">Endpoint ini memverifikasi <code>signed_request</code> dengan HMAC-SHA256 memakai App Secret, lalu menjawab dengan <code>url</code> dan <code>confirmation_code</code> sesuai dokumentasi Meta.</p>
</div>`;
    return pageShell({ title: "Penghapusan data pengguna", body });
}
