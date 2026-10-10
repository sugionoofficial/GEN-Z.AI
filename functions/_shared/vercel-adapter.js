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
    let responseReady;
    let resolveResponse;

    responseReady = new Promise(resolve => {
        resolveResponse = resolve;
    });

    function commit() {
        if (committed) return;
        committed = true;
        const noBody = [204, 205, 304].includes(statusCode);
        resolveResponse(new Response(noBody ? null : stream.readable, {
            status: statusCode,
            headers
        }));
    }

    function writeChunk(chunk) {
        if (chunk === undefined || chunk === null) return;
        const bytes = typeof chunk === "string"
            ? encoder.encode(chunk)
            : chunk instanceof ArrayBuffer
                ? new Uint8Array(chunk)
                : ArrayBuffer.isView(chunk)
                    ? new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength)
                    : encoder.encode(String(chunk));

        writer.write(bytes).catch(error => {
            if (!ended) {
                console.error("[Cloudflare adapter] Response stream write failed:", error);
            }
        });
    }

    function end(chunk) {
        if (ended) return response;
        if (chunk !== undefined) writeChunk(chunk);
        ended = true;
        commit();
        writer.close().catch(error => {
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
            headers.set(name, Array.isArray(value) ? value.join(", ") : String(value));
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

export async function runVercelHandler(handler, request, context) {
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
    const response = await responseAdapter.responseReady;
    const webResponse = await responseAdapter.responseReady;
    return webResponse;
}
