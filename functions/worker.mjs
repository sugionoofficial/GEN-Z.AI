// =========================================================
// TEMPMAIL HANDLER (Chinaapi)
// =========================================================
async function handleTempmail(request, env) {
    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
    };

    if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);
    const action = url.searchParams.get("action");
    const email = url.searchParams.get("email");
    const token = url.searchParams.get("token");
    const messageId = url.searchParams.get("messageId");

    const TEMPMAIL_URL = (env.TEMPMAIL_API_URL || "").replace(/\/+$/, "");
    if (!TEMPMAIL_URL) {
        return Response.json(
            { error: "TEMPMAIL_API_URL belum di-set di Cloudflare" },
            { status: 500, headers: corsHeaders }
        );
    }

    try {
        let targetUrl = "";
        let method = "GET";

        if (action === "create") {
            // Selalu pakai provider gmail
            targetUrl = `${TEMPMAIL_URL}/api/email?name=gmail`;
            method = "POST";
        } else if (action === "messages") {
            if (!email || !token) {
                return Response.json(
                    { error: "Parameter email & token wajib diisi" },
                    { status: 400, headers: corsHeaders }
                );
            }
            // ⭐ Tambahkan name=gmail agar provider konsisten
            targetUrl = `${TEMPMAIL_URL}/api/email/${encodeURIComponent(email)}/messages?token=${encodeURIComponent(token)}&name=gmail`;
        } else if (action === "message") {
            if (!email || !token || !messageId) {
                return Response.json(
                    { error: "Parameter email, token & messageId wajib diisi" },
                    { status: 400, headers: corsHeaders }
                );
            }
            // ⭐ Tambahkan name=gmail juga
            targetUrl = `${TEMPMAIL_URL}/api/email/${encodeURIComponent(email)}/message/${encodeURIComponent(messageId)}?token=${encodeURIComponent(token)}&name=gmail`;
        } else {
            return Response.json(
                { error: "Action tidak dikenal. Gunakan: create, messages, atau message" },
                { status: 400, headers: corsHeaders }
            );
        }

        // ⭐ Tambahkan timeout supaya tidak menggantung
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);

        let response;
        try {
            response = await fetch(targetUrl, {
                method,
                signal: controller.signal,
                headers: { "Accept": "application/json" }
            });
        } finally {
            clearTimeout(timeoutId);
        }

        const data = await response.text();
        const contentType = response.headers.get("Content-Type") || "application/json";

        // ⭐ Kalau server balikin error, tetap teruskan tapi kasih info
        if (!response.ok) {
            return new Response(data, {
                status: response.status,
                headers: {
                    ...corsHeaders,
                    "Content-Type": contentType,
                    "X-Target-URL": targetUrl.replace(/token=[^&]+/, "token=***")
                }
            });
        }

        return new Response(data, {
            status: response.status,
            headers: { ...corsHeaders, "Content-Type": contentType }
        });
    } catch (error) {
        const errorMessage = String(error && error.message ? error.message : error);
        return Response.json(
            {
                error: "Gagal menghubungi server Tempmail",
                detail: errorMessage,
                isAbort: errorMessage.includes("abort")
            },
            { status: 502, headers: corsHeaders }
        );
    }
}
