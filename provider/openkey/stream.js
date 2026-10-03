/* =========================================================
   GEN-Z.AI
   OPENKEY STREAMING MODULE
   ---------------------------------------------------------
   File:
   provider/openkey/stream.js

   Fungsi:
   - OpenKey streaming chat completion
   - Consume SSE stream
   - Hanya expose delta.content sebagai teks jawaban
   - Menangani reasoning_content tanpa menampilkannya sebagai
     jawaban user
   - Menangani tool-call fragments
   - Menggabungkan function.arguments yang terpecah
   - Tool-call SSE yang keluar adalah DELTA, bukan cumulative
   - Final tool-call tetap dapat direkonstruksi dari accumulator
   - Tidak menangani KIE
   - Tidak menangani video generation
   - Tidak menangani generation credit
   - Tidak menyimpan API key di browser
========================================================= */

import openKeyClient from "./client.js";


/* =========================================================
   VERSION
========================================================= */

const OPENKEY_STREAM_VERSION =
    "2026-10-03-openkey-stream-v2";


/* =========================================================
   DEFAULTS
========================================================= */

const DEFAULT_MODEL =
    "auto";


/* =========================================================
   BASIC HELPERS
========================================================= */

function isObject(value) {

    return (
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value)
    );

}


function asArray(value) {

    return Array.isArray(value)
        ? value
        : [];

}


function asString(value) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";

    }

    return String(value);

}


/* =========================================================
   MESSAGE NORMALIZATION
========================================================= */

function normalizeMessage(
    message
) {

    if (!isObject(message)) {

        return null;

    }


    const normalized = {

        role:
            asString(
                message.role ||
                "user"
            ),

        content:
            message.content === undefined
                ? ""
                : message.content

    };


    if (
        message.name !== undefined
    ) {

        normalized.name =
            message.name;

    }


    if (
        message.tool_call_id !== undefined
    ) {

        normalized.tool_call_id =
            message.tool_call_id;

    }


    if (
        Array.isArray(
            message.tool_calls
        )
    ) {

        normalized.tool_calls =
            message.tool_calls;

    }


    if (
        message.reasoning_content !==
        undefined
    ) {

        normalized.reasoning_content =
            message.reasoning_content;

    }


    return normalized;

}


function normalizeMessages(
    messages
) {

    return asArray(messages)
        .map(normalizeMessage)
        .filter(Boolean);

}


/* =========================================================
   TOOL NORMALIZATION
========================================================= */

function normalizeTools(
    tools
) {

    if (
        !Array.isArray(tools)
    ) {

        return undefined;

    }


    return tools
        .filter(Boolean)
        .map(
            tool => tool
        );

}


/* =========================================================
   STREAM PAYLOAD
========================================================= */

function buildStreamPayload(
    options = {}
) {

    const {

        model =
            DEFAULT_MODEL,

        messages = [],

        temperature,

        max_tokens,

        max_completion_tokens,

        top_p,

        tools,

        tool_choice,

        response_format,

        stop,

        presence_penalty,

        frequency_penalty,

        seed,

        user,

        ...extra

    } = options;


    const payload = {

        model:
            asString(
                model ||
                DEFAULT_MODEL
            ),

        messages:
            normalizeMessages(
                messages
            ),

        stream:
            true

    };


    if (
        temperature !== undefined
    ) {

        payload.temperature =
            temperature;

    }


    if (
        max_tokens !== undefined
    ) {

        payload.max_tokens =
            max_tokens;

    }


    if (
        max_completion_tokens !==
        undefined
    ) {

        payload.max_completion_tokens =
            max_completion_tokens;

    }


    if (
        top_p !== undefined
    ) {

        payload.top_p =
            top_p;

    }


    const normalizedTools =
        normalizeTools(
            tools
        );


    if (
        normalizedTools &&
        normalizedTools.length
    ) {

        payload.tools =
            normalizedTools;

    }


    if (
        tool_choice !== undefined
    ) {

        payload.tool_choice =
            tool_choice;

    }


    if (
        response_format !== undefined
    ) {

        payload.response_format =
            response_format;

    }


    if (
        stop !== undefined
    ) {

        payload.stop =
            stop;

    }


    if (
        presence_penalty !== undefined
    ) {

        payload.presence_penalty =
            presence_penalty;

    }


    if (
        frequency_penalty !== undefined
    ) {

        payload.frequency_penalty =
            frequency_penalty;

    }


    if (
        seed !== undefined
    ) {

        payload.seed =
            seed;

    }


    if (
        user !== undefined
    ) {

        payload.user =
            user;

    }


    for (
        const [key, value]
        of Object.entries(extra)
    ) {

        if (
            key === "stream"
        ) {

            continue;

        }


        if (
            value !== undefined
        ) {

            payload[key] =
                value;

        }

    }


    return payload;

}


/* =========================================================
   TOOL CALL ACCUMULATOR
========================================================= */

function createToolAccumulator() {

    return {

        calls:
            new Map()

    };

}


/* =========================================================
   GET TOOL CALL KEY
========================================================= */

function getToolCallKey(
    toolCall,
    fallbackIndex
) {

    if (
        toolCall?.id
    ) {

        return (
            `id:${toolCall.id}`
        );

    }


    if (
        toolCall?.index !== undefined
    ) {

        return (
            `index:${toolCall.index}`
        );

    }


    return (
        `index:${fallbackIndex}`
    );

}


/* =========================================================
   ENSURE TOOL CALL
========================================================= */

function ensureToolCall(
    accumulator,
    toolCall,
    fallbackIndex
) {

    const key =
        getToolCallKey(
            toolCall,
            fallbackIndex
        );


    if (
        !accumulator.calls.has(key)
    ) {

        accumulator.calls.set(
            key,
            {

                index:
                    toolCall?.index !==
                    undefined
                        ? toolCall.index
                        : fallbackIndex,

                id:
                    toolCall?.id ||
                    "",

                type:
                    toolCall?.type ||
                    "function",

                function: {

                    name:
                        "",

                    arguments:
                        ""

                }

            }
        );

    }


    return accumulator.calls.get(
        key
    );

}


/* =========================================================
   APPEND TOOL CALL DELTA
========================================================= */

function appendToolCallDelta(
    accumulator,
    delta,
    fallbackIndex = 0
) {

    if (
        !isObject(delta)
    ) {

        return null;

    }


    const toolCall =
        ensureToolCall(
            accumulator,
            delta,
            fallbackIndex
        );


    /*
     * ID
     */

    if (
        delta.id
    ) {

        toolCall.id =
            delta.id;

    }


    /*
     * TYPE
     */

    if (
        delta.type
    ) {

        toolCall.type =
            delta.type;

    }


    const fn =
        isObject(
            delta.function
        )
            ? delta.function
            : null;


    if (!fn) {

        return toolCall;

    }


    /*
     * FUNCTION NAME
     *
     * Name biasanya muncul pada chunk awal.
     *
     * Hanya delta yang ditambahkan ke accumulator.
     */

    if (
        typeof fn.name ===
        "string" &&
        fn.name
    ) {

        toolCall.function.name +=
            fn.name;

    }


    /*
     * FUNCTION ARGUMENTS
     *
     * Arguments dapat datang sebagai
     * beberapa fragment.
     */

    if (
        typeof fn.arguments ===
        "string" &&
        fn.arguments
    ) {

        toolCall.function.arguments +=
            fn.arguments;

    }


    return toolCall;

}


/* =========================================================
   ACCUMULATE TOOL DELTAS FROM CHUNK
========================================================= */

function accumulateToolCalls(
    accumulator,
    chunk
) {

    const choices =
        asArray(
            chunk?.choices
        );


    for (
        const choice
        of choices
    ) {

        const toolCalls =
            asArray(
                choice?.delta?.tool_calls
            );


        for (
            let i = 0;
            i < toolCalls.length;
            i++
        ) {

            appendToolCallDelta(
                accumulator,
                toolCalls[i],
                toolCalls[i]?.index ??
                    i
            );

        }

    }


    return accumulator;

}


/* =========================================================
   ACCUMULATE DIRECT TOOL DELTA
   ---------------------------------------------------------
   Menghasilkan delta yang BENAR-BENAR berasal
   dari chunk saat ini.

   Tidak pernah mengembalikan accumulator penuh.
========================================================= */

function extractToolCallDeltas(
    chunk
) {

    const result = [];

    const choices =
        asArray(
            chunk?.choices
        );


    for (
        const choice
        of choices
    ) {

        const toolCalls =
            asArray(
                choice?.delta?.tool_calls
            );


        for (
            let i = 0;
            i < toolCalls.length;
            i++
        ) {

            const call =
                toolCalls[i];


            if (
                !isObject(call)
            ) {

                continue;

            }


            const delta = {

                index:
                    call.index !==
                    undefined
                        ? call.index
                        : i,

                id:
                    call.id ||
                    "",

                type:
                    call.type ||
                    "function",

                function: {

                    name:
                        "",

                    arguments:
                        ""

                }

            };


            const fn =
                isObject(
                    call.function
                )
                    ? call.function
                    : null;


            if (fn) {

                if (
                    typeof fn.name ===
                    "string"
                ) {

                    delta.function.name =
                        fn.name;

                }


                if (
                    typeof fn.arguments ===
                    "string"
                ) {

                    delta.function.arguments =
                        fn.arguments;

                }

            }


            /*
             * Jangan membuang delta yang hanya
             * berisi id/type/name.
             *
             * Itu tetap bagian dari tool call.
             */

            if (
                delta.id ||
                delta.function.name ||
                delta.function.arguments
            ) {

                result.push(
                    delta
                );

            }

        }

    }


    return result;

}


/* =========================================================
   PARSE TOOL ARGUMENTS
========================================================= */

function parseToolArguments(
    value
) {

    const raw =
        asString(
            value
        );


    if (!raw) {

        return {};

    }


    try {

        return JSON.parse(
            raw
        );

    } catch {

        return {

            __raw:
                raw,

            __parseError:
                true

        };

    }

}


/* =========================================================
   FINALIZE TOOL CALLS
========================================================= */

function finalizeToolCalls(
    accumulator
) {

    return Array.from(
        accumulator.calls.values()
    )
        .sort(
            (a, b) =>
                Number(
                    a.index ??
                    0
                ) -
                Number(
                    b.index ??
                    0
                )
        )
        .map(
            call => ({

                index:
                    call.index,

                id:
                    call.id,

                type:
                    call.type ||
                    "function",

                function: {

                    name:
                        call.function?.name ||
                        "",

                    arguments:
                        call.function?.arguments ||
                        "",

                    parsed_arguments:
                        parseToolArguments(
                            call.function?.arguments
                        )

                }

            })
        );

}


/* =========================================================
   STREAM STATE
========================================================= */

function createStreamState() {

    return {

        content:
            "",

        reasoningContent:
            "",

        finishReason:
            null,

        model:
            null,

        usage:
            null,

        toolAccumulator:
            createToolAccumulator(),

        chunks:
            0,

        done:
            false

    };

}


/* =========================================================
   PROCESS CHUNK
========================================================= */

function processChunk(
    state,
    chunk
) {

    if (
        !isObject(chunk)
    ) {

        return {

            content:
                "",

            reasoning_content:
                "",

            tool_calls:
                []

        };

    }


    state.chunks++;


    if (
        chunk.model
    ) {

        state.model =
            chunk.model;

    }


    const choices =
        asArray(
            chunk.choices
        );


    let content =
        "";

    let reasoningContent =
        "";


    for (
        const choice
        of choices
    ) {

        const delta =
            choice?.delta ||
            {};


        /*
         * HANYA delta.content
         * yang menjadi text jawaban.
         */

        if (
            typeof delta.content ===
            "string"
        ) {

            content +=
                delta.content;

        }


        /*
         * Reasoning dipisahkan.
         */

        if (
            typeof delta.reasoning_content ===
            "string"
        ) {

            reasoningContent +=
                delta.reasoning_content;

        }


        if (
            choice.finish_reason
        ) {

            state.finishReason =
                choice.finish_reason;

        }

    }


    /*
     * Simpan content cumulative
     * hanya di STATE.
     */

    if (
        content
    ) {

        state.content +=
            content;

    }


    if (
        reasoningContent
    ) {

        state.reasoningContent +=
            reasoningContent;

    }


    /*
     * Ambil DELTA tool call dari chunk.
     *
     * Ini penting.
     *
     * result.tool_calls tidak lagi berisi
     * seluruh accumulator.
     */

    const toolCallDeltas =
        extractToolCallDeltas(
            chunk
        );


    /*
     * Accumulator internal tetap berjalan
     * seperti sebelumnya.
     */

    accumulateToolCalls(
        state.toolAccumulator,
        chunk
    );


    if (
        chunk.usage
    ) {

        state.usage =
            chunk.usage;

    }


    return {

        /*
         * DELTA
         */

        content:
            content,

        reasoning_content:
            reasoningContent,

        tool_calls:
            toolCallDeltas,

        finish_reason:
            state.finishReason,

        usage:
            state.usage,

        model:
            state.model

    };

}


/* =========================================================
   STREAM CHAT
========================================================= */

async function* streamChat(
    options = {}
) {

    const {

        apiKey = null,

        onChunk,

        onComplete,

        onError

    } = options;


    const messages =
        normalizeMessages(
            options.messages
        );


    if (
        messages.length ===
        0
    ) {

        throw new Error(
            "OpenKey stream membutuhkan messages."
        );

    }


    const payload =
        buildStreamPayload({
            ...options,
            messages
        });


    let response;


    try {

        response =
            await openKeyClient
                .streamChatCompletion(
                    payload,
                    apiKey
                );

    } catch (error) {

        if (
            typeof onError ===
            "function"
        ) {

            try {

                await onError(
                    error
                );

            } catch {
                /* ignore */
            }

        }

        throw error;

    }


    const state =
        createStreamState();


    try {

        /*
         * consumeSSE() mengembalikan wrapper:
         *
         * {
         *     done,
         *     data
         * }
         *
         * processChunk() menerima data OpenKey.
         */

        for await (
            const sseEvent
            of openKeyClient.consumeSSE(
                response
            )
        ) {

            if (
                sseEvent?.done
            ) {

                break;

            }


            const chunk =
                sseEvent?.data;


            if (
                !isObject(chunk)
            ) {

                continue;

            }


            const result =
                processChunk(
                    state,
                    chunk
                );


            if (
                typeof onChunk ===
                "function"
            ) {

                await onChunk(
                    result,
                    state
                );

            }


            yield result;

        }


        state.done =
            true;


        /*
         * Final result menggunakan
         * ACCUMULATOR LENGKAP.
         *
         * Ini berbeda dengan result chunk
         * yang menggunakan DELTA.
         */

        const finalResult = {

            content:
                state.content,

            reasoning_content:
                state.reasoningContent,

            tool_calls:
                finalizeToolCalls(
                    state.toolAccumulator
                ),

            finish_reason:
                state.finishReason,

            model:
                state.model,

            usage:
                state.usage,

            chunks:
                state.chunks,

            done:
                true

        };


        if (
            typeof onComplete ===
            "function"
        ) {

            await onComplete(
                finalResult,
                state
            );

        }


        return finalResult;

    } catch (error) {

        if (
            typeof onError ===
            "function"
        ) {

            try {

                await onError(
                    error
                );

            } catch {
                /* ignore */
            }

        }

        throw error;

    }

}


/* =========================================================
   TOOL CALL ACCUMULATION HELPER
   ---------------------------------------------------------
   Dipakai oleh consumeStream / collectStream
   agar caller memperoleh hasil lengkap.
========================================================= */

function mergeToolCallDeltas(
    accumulator,
    deltas
) {

    if (
        !Array.isArray(deltas)
    ) {

        return;

    }


    for (
        let i = 0;
        i < deltas.length;
        i++
    ) {

        appendToolCallDelta(
            accumulator,
            deltas[i],
            deltas[i]?.index ??
                i
        );

    }

}


/* =========================================================
   STREAM TO CALLBACK
========================================================= */

async function consumeStream(
    options = {}
) {

    const {

        onContent,

        onReasoning,

        onToolCalls,

        onChunk,

        onComplete,

        onError

    } = options;


    const localToolAccumulator =
        createToolAccumulator();


    let finalResult =
        null;


    try {

        for await (
            const chunk
            of streamChat({

                ...options,

                onChunk:
                    async (
                        result,
                        state
                    ) => {

                        /*
                         * Simpan DELTA tool call
                         * secara lokal.
                         */

                        mergeToolCallDeltas(
                            localToolAccumulator,
                            result.tool_calls
                        );


                        if (
                            result.content &&
                            typeof onContent ===
                            "function"
                        ) {

                            await onContent(
                                result.content,
                                state
                            );

                        }


                        if (
                            result.reasoning_content &&
                            typeof onReasoning ===
                            "function"
                        ) {

                            await onReasoning(
                                result.reasoning_content,
                                state
                            );

                        }


                        if (
                            result.tool_calls?.length &&
                            typeof onToolCalls ===
                            "function"
                        ) {

                            await onToolCalls(
                                result.tool_calls,
                                state
                            );

                        }


                        if (
                            typeof onChunk ===
                            "function"
                        ) {

                            await onChunk(
                                result,
                                state
                            );

                        }

                    },

                onComplete:
                    undefined,

                onError:
                    undefined

            })
        ) {

            finalResult =
                chunk;

        }


        /*
         * streamChat() final return
         * sudah memiliki accumulator lengkap.
         */

        if (
            finalResult &&
            Array.isArray(
                finalResult.tool_calls
            ) &&
            finalResult.tool_calls.length
        ) {

            localToolAccumulator.calls
                .clear();


            for (
                const call
                of finalResult.tool_calls
            ) {

                appendToolCallDelta(
                    localToolAccumulator,
                    call,
                    call.index ?? 0
                );

            }

        }


        if (
            typeof onComplete ===
            "function"
        ) {

            await onComplete(
                finalResult
            );

        }


        return finalResult;

    } catch (error) {

        if (
            typeof onError ===
            "function"
        ) {

            try {

                await onError(
                    error
                );

            } catch {
                /* ignore */
            }

        }

        throw error;

    }

}


/* =========================================================
   SIMPLE STREAM
========================================================= */

async function streamText(
    options = {},
    onText
) {

    let text =
        "";


    for await (
        const chunk
        of streamChat(
            options
        )
    ) {

        if (
            chunk.content
        ) {

            text +=
                chunk.content;


            if (
                typeof onText ===
                "function"
            ) {

                await onText(
                    chunk.content,
                    chunk
                );

            }

        }

    }


    return text;

}


/* =========================================================
   COLLECT STREAM
========================================================= */

async function collectStream(
    options = {}
) {

    const result = {

        content:
            "",

        reasoning_content:
            "",

        tool_calls:
            [],

        finish_reason:
            null,

        model:
            null,

        usage:
            null,

        chunks:
            0,

        done:
            false

    };


    const toolAccumulator =
        createToolAccumulator();


    for await (
        const chunk
        of streamChat(
            options
        )
    ) {

        if (
            chunk.content
        ) {

            result.content +=
                chunk.content;

        }


        if (
            chunk.reasoning_content
        ) {

            result.reasoning_content +=
                chunk.reasoning_content;

        }


        /*
         * Chunk tool_calls sekarang
         * adalah DELTA.
         *
         * Karena itu harus diakumulasi.
         */

        mergeToolCallDeltas(
            toolAccumulator,
            chunk.tool_calls
        );


        if (
            chunk.finish_reason
        ) {

            result.finish_reason =
                chunk.finish_reason;

        }


        if (
            chunk.model
        ) {

            result.model =
                chunk.model;

        }


        if (
            chunk.usage
        ) {

            result.usage =
                chunk.usage;

        }


        result.chunks++;

    }


    result.tool_calls =
        finalizeToolCalls(
            toolAccumulator
        );


    result.done =
        true;


    return result;

}


/* =========================================================
   TOOL CALL CHECK
========================================================= */

function hasToolCalls(
    result
) {

    return Boolean(
        result &&
        Array.isArray(
            result.tool_calls
        ) &&
        result.tool_calls.length
    );

}


/* =========================================================
   FINAL TOOL CALL NORMALIZATION
========================================================= */

function normalizeToolCall(
    toolCall
) {

    if (
        !isObject(toolCall)
    ) {

        return null;

    }


    const fn =
        isObject(
            toolCall.function
        )
            ? toolCall.function
            : {};


    let parsedArguments =
        fn.parsed_arguments;


    if (
        parsedArguments ===
        undefined
    ) {

        parsedArguments =
            parseToolArguments(
                fn.arguments
            );

    }


    return {

        index:
            toolCall.index,

        id:
            toolCall.id ||
            "",

        type:
            toolCall.type ||
            "function",

        function: {

            name:
                fn.name ||
                "",

            arguments:
                fn.arguments ||
                "",

            parsed_arguments:
                parsedArguments

        }

    };

}


function normalizeToolCalls(
    toolCalls
) {

    return asArray(
        toolCalls
    )
        .map(
            normalizeToolCall
        )
        .filter(Boolean);

}


/* =========================================================
   BUILD ASSISTANT TOOL MESSAGE
========================================================= */

function buildAssistantToolMessage(
    result
) {

    const toolCalls =
        normalizeToolCalls(
            result?.tool_calls
        );


    return {

        role:
            "assistant",

        content:
            result?.content ||
            null,

        tool_calls:
            toolCalls.map(
                call => ({

                    id:
                        call.id,

                    type:
                        call.type,

                    function: {

                        name:
                            call.function.name,

                        arguments:
                            call.function.arguments

                    }

                })
            )

    };

}


/* =========================================================
   BUILD TOOL RESULT MESSAGE
========================================================= */

function buildToolResultMessage(
    toolCall,
    result
) {

    const call =
        normalizeToolCall(
            toolCall
        );


    if (!call) {

        throw new Error(
            "Tool call OpenKey tidak valid."
        );

    }


    let content;


    if (
        typeof result ===
        "string"
    ) {

        content =
            result;

    } else {

        try {

            content =
                JSON.stringify(
                    result ??
                    null
                );

        } catch {

            content =
                String(
                    result
                );

        }

    }


    return {

        role:
            "tool",

        tool_call_id:
            call.id,

        content

    };

}


/* =========================================================
   CONTINUE AFTER TOOLS
========================================================= */

async function* continueAfterTools(
    options = {}
) {

    const {

        messages = [],

        assistantResult,

        toolResults = [],

        ...rest

    } = options;


    const normalizedMessages =
        normalizeMessages(
            messages
        );


    const assistantMessage =
        buildAssistantToolMessage(
            assistantResult
        );


    normalizedMessages.push(
        assistantMessage
    );


    for (
        const item
        of asArray(toolResults)
    ) {

        if (
            item &&
            item.role ===
            "tool"
        ) {

            normalizedMessages.push(
                item
            );

            continue;

        }


        if (
            isObject(item) &&
            item.toolCall
        ) {

            normalizedMessages.push(
                buildToolResultMessage(
                    item.toolCall,
                    item.result
                )
            );

            continue;

        }


        if (
            isObject(item) &&
            item.call
        ) {

            normalizedMessages.push(
                buildToolResultMessage(
                    item.call,
                    item.result
                )
            );

        }

    }


    yield* streamChat({

        ...rest,

        messages:
            normalizedMessages

    });

}


/* =========================================================
   STREAM VERSION INFO
========================================================= */

function getVersion() {

    return OPENKEY_STREAM_VERSION;

}


/* =========================================================
   BROWSER GLOBAL
========================================================= */

if (
    typeof window !==
    "undefined"
) {

    window.GENZOpenKeyStream = {

        version:
            OPENKEY_STREAM_VERSION,

        buildStreamPayload,

        createStreamState,

        processChunk,

        streamChat,

        consumeStream,

        streamText,

        collectStream,

        accumulateToolCalls,

        extractToolCallDeltas,

        finalizeToolCalls,

        normalizeToolCall,

        normalizeToolCalls,

        hasToolCalls,

        buildAssistantToolMessage,

        buildToolResultMessage,

        continueAfterTools,

        getVersion

    };

}


/* =========================================================
   EXPORTS
========================================================= */

export {

    OPENKEY_STREAM_VERSION,

    buildStreamPayload,

    createStreamState,

    processChunk,

    streamChat,

    consumeStream,

    streamText,

    collectStream,

    accumulateToolCalls,

    extractToolCallDeltas,

    finalizeToolCalls,

    normalizeToolCall,

    normalizeToolCalls,

    hasToolCalls,

    buildAssistantToolMessage,

    buildToolResultMessage,

    continueAfterTools,

    getVersion

};


export default {

    version:
        OPENKEY_STREAM_VERSION,

    buildStreamPayload,

    createStreamState,

    processChunk,

    streamChat,

    consumeStream,

    streamText,

    collectStream,

    accumulateToolCalls,

    extractToolCallDeltas,

    finalizeToolCalls,

    normalizeToolCall,

    normalizeToolCalls,

    hasToolCalls,

    buildAssistantToolMessage,

    buildToolResultMessage,

    continueAfterTools,

    getVersion

};
