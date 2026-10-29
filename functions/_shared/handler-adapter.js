/*
 * =========================================================
 * GEN-Z.AI
 * HANDLER ADAPTER
 * ---------------------------------------------------------
 * File: functions/_shared/handler-adapter.js
 * ---------------------------------------------------------
 *
 * Adapter ini mengubah handler API dengan signature Node.js
 *
 *     export default async function handler(req, res)
 *
 * menjadi Web API Request/Response yang dipakai Cloudflare Worker.
 * Semua API di api/ memakai signature tersebut, sementara runtime
 * produksi adalah Cloudflare Worker (lihat wrangler.toml). Adapter ini
 * menghubungkan kedua bentuk request/response itu untuk endpoint /api/*.
 *
 * =========================================================
 */

const encoder = new TextEncoder();

function getQuery(url) {
    const query = {};

    for (const [key, value] of url.searchParams) {
        if (Object.prototype.hasOwnProperty.call(query, key)) {
            query[key] = Array.isArray(query[key])
                ? [...query[key], value]
                : [query[key], value];
        } else {
            query[key] = value;
        }
    }

    return query;
}

async function getBody(request) {
    if (request.method === "GET" || request.method === "HEAD") {
        return undefined;
    }

    const contentType = request.headers.get("content-type") || "";
    const body = await request.arrayBuffer();

    if (body.byteLength === 0) {
        return undefined;
    }

    if (/^(application\/json|application\/[^;]+\+json)(?:;|$)/i.test(contentType)) {
        try {
            return JSON.parse(new TextDecoder().decode(body));
        } catch {
            throw new SyntaxError("Invalid JSON request body.");
        }
    }

    if (/^application\/x-www-form-urlencoded(?:;|$)/i.test(contentType)) {
        const params = new URLSearchParams(new TextDecoder().decode(body));
        const parsed = {};

        for (const [key, value] of params) {
            if (Object.prototype.hasOwnProperty.call(parsed, key)) {
                parsed[key] = Array.isArray(parsed[key])
                    ? [...parsed[key], value]
                    : [parsed[key], value];
            } else {
                parsed[key] = value;
            }
        }

        return parsed;
    }

    return Buffer.from(body);
}

function createResponseAdapter(request) {
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    const headers = new Headers();
    const closeListeners = new Set();
    let statusCode = 200;
    let committed = false;
    let ended = false;
    let writeChain = Promise.resolve();
    let responseReady;
    let resolveResponse;

    responseReady = new Promise(resolve => {
        resolveResponse = resolve;
    });

    function toChunkBytes(chunk) {
        if (chunk === undefined || chunk === null) return null;
        if (typeof chunk === "string") return encoder.encode(chunk);
        if (chunk instanceof ArrayBuffer) return new Uint8Array(chunk);
        if (ArrayBuffer.isView(chunk)) {
            return new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength);
        }
        return encoder.encode(String(chunk));
    }

    function commit(directBody) {
        if (committed) return;
        committed = true;
        const noBody = [204, 205, 304].includes(statusCode);
        const bodyInit = noBody
            ? null
            : directBody !== undefined
                ? directBody
                : stream.readable;
        resolveResponse(new Response(bodyInit, {
            status: statusCode,
            headers
        }));
    }

    function writeChunk(chunk) {
        const bytes = toChunkBytes(chunk);
        if (!bytes) return;

        writeChain = writeChain
            .then(() => writer.write(bytes))
            .catch(error => {
                if (!ended) {
                    console.error("[Cloudflare adapter] Response stream write failed:", error);
                }
            });
    }

    function end(chunk) {
        if (ended) return response;
        ended = true;
        if (!committed) {
            const directBytes = toChunkBytes(chunk);
            commit(directBytes ?? null);
            writer.close().catch(() => {});
            return response;
        }
        if (chunk !== undefined) writeChunk(chunk);
        writeChain
            .then(() => writer.close())
            .catch(error => {
                if (!request.signal.aborted) {
                    console.error("[Cloudflare adapter] Response stream close failed:", error);
                }
            });
        return response;
    }

    const response = {
        get statusCode() {
            return statusCode;
        },
        set statusCode(value) {
            statusCode = Number(value) || 200;
        },
        get headersSent() {
            return committed;
        },
        get writableEnded() {
            return ended;
        },
        setHeader(name, value) {
            if (String(name).toLowerCase() === "set-cookie" && Array.isArray(value)) {
                headers.delete("set-cookie");
                for (const cookie of value) {
                    headers.append("set-cookie", String(cookie));
                }
            } else {
                headers.set(name, Array.isArray(value) ? value.join(", ") : String(value));
            }
            return response;
        },
        getHeader(name) {
            return headers.get(name);
        },
        status(code) {
            statusCode = Number(code) || 200;
            return response;
        },
        json(data) {
            if (!headers.has("content-type")) {
                headers.set("content-type", "application/json; charset=utf-8");
            }
            return end(JSON.stringify(data));
        },
        send(data) {
            if (data && typeof data === "object" && !ArrayBuffer.isView(data)) {
                return response.json(data);
            }
            return end(data);
        },
        write(chunk) {
            if (ended) return false;
            commit();
            writeChunk(chunk);
            return true;
        },
        end
    };

    request.signal.addEventListener("abort", () => {
        for (const listener of closeListeners) listener();
        closeListeners.clear();
    }, { once: true });

    writer.closed.catch(() => {
        for (const listener of closeListeners) listener();
        closeListeners.clear();
    });

    return {
        response,
        responseReady,
        closeListeners,
    };
}

export async function runHandlerAdapter(handler, request, context, env) {
    let body;

    try {
        body = await getBody(request);
    } catch (error) {
        if (error instanceof SyntaxError) {
            return Response.json({ error: error.message }, { status: 400 });
        }
        throw error;
    }

    const url = new URL(request.url);
    const headers = Object.fromEntries(request.headers.entries());
    const req = {
        method: request.method,
        url: `${url.pathname}${url.search}`,
        headers,
        query: getQuery(url),
        env,
        /* Data Cloudflare (kota/negara/ASN/colo) — satu-satunya sumber
           lokasi yang tidak bisa dipalsukan dari browser. */
        cf: request.cf || null,
        body,
        on(event, listener) {
            if (event === "close" && typeof listener === "function") {
                if (request.signal.aborted) listener();
                else responseAdapter.closeListeners.add(listener);
            }
            return req;
        }
    };

    const responseAdapter = createResponseAdapter(request);
    const handlerTask = Promise.resolve()
        .then(() => handler(req, responseAdapter.response))
        .then(() => {
            if (!responseAdapter.response.writableEnded) {
                responseAdapter.response.end();
            }
        })
        .catch(error => {
            console.error("[Cloudflare adapter] API handler failed:", error);
            if (!responseAdapter.response.headersSent) {
                responseAdapter.response.status(500).json({ error: "Internal server error" });
            } else if (!responseAdapter.response.writableEnded) {
                responseAdapter.response.end();
            }
        });

    if (context && typeof context.waitUntil === "function") {
        context.waitUntil(handlerTask);
    }
    const webResponse = await responseAdapter.responseReady;
    return webResponse;
}
