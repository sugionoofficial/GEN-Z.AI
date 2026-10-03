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
    "2026-10-03-openkey-stream-v1";


/* =========================================================
   DEFAULTS
========================================================= */

const DEFAULT_MODEL = "auto";


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

function normalizeMessage(message) {

    if (!isObject(message)) {

        return null;

    }

    const normalized = {

        role:
            asString(message.role || "user"),

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
        Array.isArray(message.tool_calls)
    ) {

        normalized.tool_calls =
            message.tool_calls;

    }


    /*
       OpenKey reasoning models may return
       reasoning_content.

       Keep it available for protocol continuity,
       but never render it as normal answer text.
    */

    if (
        message.reasoning_content !== undefined
    ) {

        normalized.reasoning_content =
            message.reasoning_content;

    }


    return normalized;

}


function normalizeMessages(messages) {

    return asArray(messages)
        .map(normalizeMessage)
        .filter(Boolean);

}


/* =========================================================
   TOOL NORMALIZATION
========================================================= */

function normalizeTools(tools) {

    if (!Array.isArray(tools)) {

        return undefined;

    }

    return tools
        .filter(Boolean)
        .map(tool => tool);

}


/* =========================================================
   STREAM PAYLOAD
========================================================= */

function buildStreamPayload(options = {}) {

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
            asString(model || DEFAULT_MODEL),

        messages:
            normalizeMessages(messages),

        stream: true

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
        max_completion_tokens !== undefined
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
        normalizeTools(tools);


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


    /*
       Preserve provider-specific options.

       stream is deliberately protected.
    */

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

        return `id:${toolCall.id}`;

    }


    if (
        toolCall?.index !== undefined
    ) {

        return `index:${toolCall.index}`;

    }


    return `index:${fallbackIndex}`;

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
                    toolCall?.index !== undefined
                        ? toolCall.index
                        : fallbackIndex,

                id:
                    toolCall?.id || "",

                type:
                    toolCall?.type || "function",

                function: {

                    name: "",

                    arguments: ""

                }

            }
        );

    }


    return accumulator.calls.get(key);

}


/* =========================================================
   APPEND TOOL CALL DELTA
========================================================= */

function appendToolCallDelta(
    accumulator,
    delta,
    fallbackIndex = 0
) {

    if (!isObject(delta)) {

        return null;

    }


    const toolCall =
        ensureToolCall(
            accumulator,
            delta,
            fallbackIndex
        );


    if (
        delta.id
    ) {

        toolCall.id =
            delta.id;

    }


    if (
        delta.type
    ) {

        toolCall.type =
            delta.type;

    }


    const fn =
        isObject(delta.function)
            ? delta.function
            : null;


    if (fn) {

        if (
            fn.name
        ) {

            toolCall.function.name +=
                String(fn.name);

        }


        if (
            fn.arguments
        ) {

            toolCall.function.arguments +=
                String(fn.arguments);

        }

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
        asArray(chunk?.choices);


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
                toolCalls[i]?.index ?? i
            );

        }

    }


    return accumulator;

}


/* =========================================================
   PARSE TOOL ARGUMENTS
========================================================= */

function parseToolArguments(
    value
) {

    const raw =
        asString(value);


    if (!raw) {

        return {};

    }


    try {

        return JSON.parse(raw);

    } catch {

        /*
           Some providers can theoretically emit
           incomplete JSON.

           Do not destroy the accumulated data.
        */

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
                Number(a.index ?? 0) -
                Number(b.index ?? 0)
        )
        .map(call => ({

            index:
                call.index,

            id:
                call.id,

            type:
                call.type || "function",

            function: {

                name:
                    call.function?.name || "",

                arguments:
                    call.function?.arguments || "",

                parsed_arguments:
                    parseToolArguments(
                        call.function?.arguments
                    )

            }

        }));

}


/* =========================================================
   STREAM STATE
========================================================= */

function createStreamState() {

    return {

        content: "",

        reasoningContent: "",

        finishReason: null,

        model: null,

        usage: null,

        toolAccumulator:
            createToolAccumulator(),

        chunks: 0,

        done: false

    };

}


/* =========================================================
   PROCESS CHUNK
========================================================= */

function processChunk(
    state,
    chunk
) {

    if (!isObject(chunk)) {

        return {

            content: "",

            reasoning_content: "",

            tool_calls: []

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
        asArray(chunk.choices);


    let content = "";

    let reasoningContent = "";


    for (
        const choice
        of choices
    ) {

        const delta =
            choice?.delta || {};


        /*
           IMPORTANT:

           Only delta.content is normal
           user-visible answer content.

           reasoning_content is collected
           separately and NEVER merged into
           content.
        */

        if (
            typeof delta.content === "string"
        ) {

            content +=
                delta.content;

        }


        if (
            typeof delta.reasoning_content === "string"
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


    if (content) {

        state.content +=
            content;

    }


    if (reasoningContent) {

        state.reasoningContent +=
            reasoningContent;

    }


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

        content,

        reasoning_content:
            reasoningContent,

        tool_calls:
            finalizeToolCalls(
                state.toolAccumulator
            ),

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
        messages.length === 0
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
            typeof onError === "function"
        ) {

            try {

                await onError(error);

            } catch {
                /* ignore callback error */
            }

        }

        throw error;

    }


    const state =
        createStreamState();


    try {

        /*
         * =====================================================
         * PENTING
         * -----------------------------------------------------
         * client.consumeSSE() mengembalikan:
         *
         * {
         *     done: false,
         *     data: {
         *         choices: [...]
         *     }
         * }
         *
         * Jadi processChunk() HARUS menerima:
         *
         * sseEvent.data
         *
         * bukan object wrapper SSE.
         *
         * Bug sebelumnya mengirim seluruh wrapper ke
         * processChunk(), sehingga:
         *
         * chunk.choices
         *
         * selalu undefined.
         *
         * Akibatnya semua content menjadi:
         *
         * ""
         * =====================================================
         */

        for await (
            const sseEvent
            of openKeyClient.consumeSSE(
                response
            )
        ) {

            /*
             * [DONE] dari consumeSSE()
             */

            if (
                sseEvent?.done
            ) {

                break;

            }


            /*
             * Ambil payload OpenKey sebenarnya.
             */

            const chunk =
                sseEvent?.data;


            /*
             * Abaikan payload yang tidak valid.
             */

            if (
                !isObject(chunk)
            ) {

                continue;

            }


            /*
             * Sekarang processChunk() menerima
             * object OpenKey yang sebenarnya.
             */

            const result =
                processChunk(
                    state,
                    chunk
                );


            if (
                typeof onChunk === "function"
            ) {

                await onChunk(
                    result,
                    state
                );

            }


            yield result;

        }


        state.done = true;


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
            typeof onComplete === "function"
        ) {

            await onComplete(
                finalResult,
                state
            );

        }


        return finalResult;

    } catch (error) {

        if (
            typeof onError === "function"
        ) {

            try {

                await onError(error);

            } catch {
                /* ignore callback error */
            }

        }

        throw error;

    }

}


/* =========================================================
   STREAM TO CALLBACK
   ---------------------------------------------------------
   Utility untuk caller yang tidak ingin memakai
   async generator secara langsung.
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


    let finalResult = null;


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

                        if (
                            result.content &&
                            typeof onContent === "function"
                        ) {

                            await onContent(
                                result.content,
                                state
                            );

                        }


                        if (
                            result.reasoning_content &&
                            typeof onReasoning === "function"
                        ) {

                            await onReasoning(
                                result.reasoning_content,
                                state
                            );

                        }


                        if (
                            result.tool_calls?.length &&
                            typeof onToolCalls === "function"
                        ) {

                            await onToolCalls(
                                result.tool_calls,
                                state
                            );

                        }


                        if (
                            typeof onChunk === "function"
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


        if (
            typeof onComplete === "function"
        ) {

            await onComplete(
                finalResult
            );

        }


        return finalResult;

    } catch (error) {

        if (
            typeof onError === "function"
        ) {

            try {

                await onError(error);

            } catch {
                /* ignore callback error */
            }

        }

        throw error;

    }

}


/* =========================================================
   SIMPLE STREAM
   ---------------------------------------------------------
   Hanya mengembalikan text jawaban.
   Reasoning dan tool-call tidak dicampur.
========================================================= */

async function streamText(
    options = {},
    onText
) {

    let text = "";


    for await (
        const chunk
        of streamChat(options)
    ) {

        if (
            chunk.content
        ) {

            text +=
                chunk.content;


            if (
                typeof onText === "function"
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
   NON-STREAM RESULT BUILDER
   ---------------------------------------------------------
   Berguna untuk caller yang ingin hasil final
   dalam bentuk object yang konsisten.
========================================================= */

async function collectStream(
    options = {}
) {

    const result = {

        content: "",

        reasoning_content: "",

        tool_calls: [],

        finish_reason: null,

        model: null,

        usage: null,

        chunks: 0,

        done: false

    };


    for await (
        const chunk
        of streamChat(options)
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


        if (
            chunk.tool_calls?.length
        ) {

            result.tool_calls =
                chunk.tool_calls;

        }


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


    result.done = true;


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
        Array.isArray(result.tool_calls) &&
        result.tool_calls.length
    );

}


/* =========================================================
   FINAL TOOL CALL NORMALIZATION
========================================================= */

function normalizeToolCall(
    toolCall
) {

    if (!isObject(toolCall)) {

        return null;

    }


    const fn =
        isObject(toolCall.function)
            ? toolCall.function
            : {};


    let parsedArguments =
        fn.parsed_arguments;


    if (
        parsedArguments === undefined
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
            toolCall.id || "",

        type:
            toolCall.type || "function",

        function: {

            name:
                fn.name || "",

            arguments:
                fn.arguments || "",

            parsed_arguments:
                parsedArguments

        }

    };

}


function normalizeToolCalls(
    toolCalls
) {

    return asArray(toolCalls)
        .map(normalizeToolCall)
        .filter(Boolean);

}


/* =========================================================
   BUILD ASSISTANT TOOL MESSAGE
   ---------------------------------------------------------
   Dipakai setelah streaming selesai dan OpenKey
   meminta tool execution.
========================================================= */

function buildAssistantToolMessage(
    result
) {

    const toolCalls =
        normalizeToolCalls(
            result?.tool_calls
        );


    return {

        role: "assistant",

        content:
            result?.content || null,

        tool_calls:
            toolCalls.map(call => ({

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

            }))

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
        typeof result === "string"
    ) {

        content =
            result;

    } else {

        try {

            content =
                JSON.stringify(
                    result ?? null
                );

        } catch {

            content =
                String(result);

        }

    }


    return {

        role: "tool",

        tool_call_id:
            call.id,

        content

    };

}


/* =========================================================
   CONTINUE AFTER TOOLS
   ---------------------------------------------------------
   Streaming continuation setelah tool selesai.
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
        normalizeMessages(messages);


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
            item.role === "tool"
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
    typeof window !== "undefined"
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

    finalizeToolCalls,

    normalizeToolCall,

    normalizeToolCalls,

    hasToolCalls,

    buildAssistantToolMessage,

    buildToolResultMessage,

    continueAfterTools,

    getVersion

};
