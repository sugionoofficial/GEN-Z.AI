/* =========================================================
   GEN-Z.AI
   OPENKEY CHAT MODULE
   ---------------------------------------------------------
   File:
   provider/openkey/chat.js

   TANGGUNG JAWAB:
   - OpenKey chat completion
   - Non-streaming chat
   - Normalisasi response
   - Tool calling helper
   - Full tool loop
   - Tool-call result helper
   - Tidak menangani API key encryption
   - Tidak menangani Supabase
   - Tidak menangani KIE
   - Tidak menangani generation credits
   - Tidak menangani generation_history
   - Tidak menangani video generation

   PROVIDER:
   OpenKey

   ENDPOINT:
   POST /v1/chat/completions
========================================================= */


/* =========================================================
   IMPORT CLIENT
========================================================= */

import openKeyClient
    from "./client.js";


/* =========================================================
   MODULE VERSION
========================================================= */

const OPENKEY_CHAT_VERSION =
    "2026-10-03-openkey-chat-v2";


/* =========================================================
   CONSTANT
========================================================= */

const DEFAULT_TEMPERATURE =
    0.7;


/* =========================================================
   ARRAY NORMALIZER
========================================================= */

function normalizeArray(
    value
) {

    if (
        Array.isArray(value)
    ) {

        return value.slice();

    }


    return [];

}


/* =========================================================
   TEXT NORMALIZER
========================================================= */

function normalizeText(
    value,
    fallback = ""
) {

    if (
        value === null ||
        value === undefined
    ) {

        return fallback;

    }


    return String(
        value
    );

}


/* =========================================================
   MESSAGE NORMALIZER
========================================================= */

function normalizeMessage(
    message
) {

    if (
        !message ||
        typeof message !== "object"
    ) {

        return null;

    }


    const role =
        normalizeText(
            message.role
        ).trim();


    if (
        !role
    ) {

        return null;

    }


    const normalized = {

        role,

        content:
            message.content ??
            null

    };


    /*
     * NAME
     */

    if (
        message.name !== undefined &&
        message.name !== null
    ) {

        normalized.name =
            message.name;

    }


    /*
     * TOOL CALLS
     */

    if (
        Array.isArray(
            message.tool_calls
        )
    ) {

        normalized.tool_calls =
            message.tool_calls.map(
                toolCall => ({
                    ...toolCall
                })
            );

    }


    /*
     * TOOL CALL ID
     */

    if (
        message.tool_call_id !==
        undefined &&
        message.tool_call_id !==
        null
    ) {

        normalized.tool_call_id =
            message.tool_call_id;

    }


    /*
     * REASONING CONTENT
     */

    if (
        message.reasoning_content !==
        undefined
    ) {

        normalized.reasoning_content =
            message.reasoning_content;

    }


    return normalized;

}


/* =========================================================
   MESSAGE LIST NORMALIZER
========================================================= */

function normalizeMessages(
    messages
) {

    return normalizeArray(
        messages
    )
        .map(
            normalizeMessage
        )
        .filter(
            Boolean
        );

}


/* =========================================================
   TOOL NORMALIZER
========================================================= */

function normalizeTool(
    tool
) {

    if (
        !tool ||
        typeof tool !== "object"
    ) {

        return null;

    }


    /*
     * OpenAI-compatible tools:

       {
           type: "function",
           function: {
               name,
               description,
               parameters
           }
       }
    */

    const normalized = {

        type:
            normalizeText(
                tool.type,
                "function"
            )

    };


    if (
        tool.function &&
        typeof tool.function ===
        "object"
    ) {

        normalized.function = {

            name:
                normalizeText(
                    tool.function.name
                ),

            description:
                normalizeText(
                    tool.function.description
                ),

            parameters:
                tool.function.parameters ??
                {
                    type:
                        "object",

                    properties:
                        {}
                }

        };

    }
    else {

        normalized.function =
            tool.function ??
            {};

    }


    return normalized;

}


/* =========================================================
   TOOL LIST NORMALIZER
========================================================= */

function normalizeTools(
    tools
) {

    return normalizeArray(
        tools
    )
        .map(
            normalizeTool
        )
        .filter(
            Boolean
        );

}


/* =========================================================
   REQUEST BUILDER
========================================================= */

function buildChatPayload(
    options = {}
) {

    const {

        model = "auto",

        messages = [],

        temperature =
            DEFAULT_TEMPERATURE,

        max_tokens,

        max_completion_tokens,

        top_p,

        stream = false,

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
            normalizeText(
                model,
                "auto"
            ).trim(),

        messages:
            normalizeMessages(
                messages
            ),

        stream:
            Boolean(
                stream
            )

    };


    /*
     * TEMPERATURE
     */

    if (
        temperature !==
        undefined &&
        temperature !==
        null
    ) {

        payload.temperature =
            temperature;

    }


    /*
     * TOKEN LIMIT
     */

    if (
        max_tokens !==
        undefined &&
        max_tokens !==
        null
    ) {

        payload.max_tokens =
            max_tokens;

    }


    if (
        max_completion_tokens !==
        undefined &&
        max_completion_tokens !==
        null
    ) {

        payload.max_completion_tokens =
            max_completion_tokens;

    }


    /*
     * TOP P
     */

    if (
        top_p !==
        undefined &&
        top_p !==
        null
    ) {

        payload.top_p =
            top_p;

    }


    /*
     * TOOLS
     */

    if (
        Array.isArray(
            tools
        ) &&
        tools.length > 0
    ) {

        payload.tools =
            normalizeTools(
                tools
            );

    }


    /*
     * TOOL CHOICE
     */

    if (
        tool_choice !==
        undefined &&
        tool_choice !==
        null
    ) {

        payload.tool_choice =
            tool_choice;

    }


    /*
     * RESPONSE FORMAT
     */

    if (
        response_format !==
        undefined &&
        response_format !==
        null
    ) {

        payload.response_format =
            response_format;

    }


    /*
     * STOP
     */

    if (
        stop !==
        undefined &&
        stop !==
        null
    ) {

        payload.stop =
            stop;

    }


    /*
     * PENALTIES
     */

    if (
        presence_penalty !==
        undefined &&
        presence_penalty !==
        null
    ) {

        payload.presence_penalty =
            presence_penalty;

    }


    if (
        frequency_penalty !==
        undefined &&
        frequency_penalty !==
        null
    ) {

        payload.frequency_penalty =
            frequency_penalty;

    }


    /*
     * SEED
     */

    if (
        seed !==
        undefined &&
        seed !==
        null
    ) {

        payload.seed =
            seed;

    }


    /*
     * USER
     */

    if (
        user !==
        undefined &&
        user !==
        null
    ) {

        payload.user =
            user;

    }


    /*
     * EXTRA PROVIDER PARAMETERS
     */

    Object.assign(
        payload,
        extra
    );


    return payload;

}


/* =========================================================
   RESPONSE CHOICE
========================================================= */

function getFirstChoice(
    response
) {

    if (
        !response ||
        !Array.isArray(
            response.choices
        )
    ) {

        return null;

    }


    return (
        response.choices[0] ||
        null
    );

}


/* =========================================================
   RESPONSE MESSAGE
========================================================= */

function getMessage(
    response
) {

    const choice =
        getFirstChoice(
            response
        );


    return (
        choice?.message ||
        null
    );

}


/* =========================================================
   RESPONSE CONTENT
========================================================= */

function getContent(
    response
) {

    const message =
        getMessage(
            response
        );


    if (
        !message
    ) {

        return "";

    }


    /*
     * CONTENT STRING
     */

    if (
        typeof message.content ===
        "string"
    ) {

        return message.content;

    }


    /*
     * CONTENT ARRAY
     */

    if (
        Array.isArray(
            message.content
        )
    ) {

        return message.content
            .map(
                part => {

                    if (
                        typeof part ===
                        "string"
                    ) {

                        return part;

                    }


                    if (
                        part &&
                        typeof part.text ===
                        "string"
                    ) {

                        return part.text;

                    }


                    return "";

                }
            )
            .join("");

    }


    return "";

}


/* =========================================================
   TOOL CALLS
========================================================= */

function getToolCalls(
    response
) {

    const message =
        getMessage(
            response
        );


    if (
        !message ||
        !Array.isArray(
            message.tool_calls
        )
    ) {

        return [];

    }


    return message.tool_calls.map(
        toolCall => ({
            ...toolCall
        })
    );

}


/* =========================================================
   FINISH REASON
========================================================= */

function getFinishReason(
    response
) {

    const choice =
        getFirstChoice(
            response
        );


    return (
        choice?.finish_reason ??
        null
    );

}


/* =========================================================
   USAGE
========================================================= */

function getUsage(
    response
) {

    if (
        !response ||
        !response.usage
    ) {

        return null;

    }


    /*
     * Usage adalah usage provider.
     *
     * BUKAN GEN-Z.AI credits.
     */

    return {
        ...response.usage
    };

}


/* =========================================================
   NORMALIZE RESPONSE
========================================================= */

function normalizeResponse(
    response
) {

    if (
        !response ||
        typeof response !== "object"
    ) {

        return {

            id:
                null,

            model:
                null,

            content:
                "",

            message:
                null,

            tool_calls:
                [],

            finish_reason:
                null,

            usage:
                null,

            raw:
                response ?? null

        };

    }


    return {

        id:
            response.id ??
            null,

        model:
            response.model ??
            null,

        content:
            getContent(
                response
            ),

        message:
            getMessage(
                response
            ),

        tool_calls:
            getToolCalls(
                response
            ),

        finish_reason:
            getFinishReason(
                response
            ),

        usage:
            getUsage(
                response
            ),

        raw:
            response

    };

}


/* =========================================================
   CHAT COMPLETION
========================================================= */

async function chat(
    options = {}
) {

    const {

        apiKey = null

    } = options;


    const payload =
        buildChatPayload(
            options
        );


    if (
        !payload.messages.length
    ) {

        const error =
            new Error(
                "OpenKey chat membutuhkan messages."
            );

        error.code =
            "OPENKEY_MESSAGES_REQUIRED";

        throw error;

    }


    if (
        !payload.model
    ) {

        const error =
            new Error(
                "OpenKey chat membutuhkan model."
            );

        error.code =
            "OPENKEY_MODEL_REQUIRED";

        throw error;

    }


    const response =
        await openKeyClient
            .chatCompletion(
                payload,
                apiKey
            );


    return normalizeResponse(
        response
    );

}


/* =========================================================
   SIMPLE CHAT HELPER
========================================================= */

async function simpleChat(
    options = {}
) {

    const response =
        await chat(
            options
        );


    return {

        content:
            response.content,

        model:
            response.model,

        usage:
            response.usage,

        finish_reason:
            response.finish_reason,

        raw:
            response.raw

    };

}


/* =========================================================
   TOOL CALL DETECTOR
========================================================= */

function hasToolCalls(
    response
) {

    if (
        !response
    ) {

        return false;

    }


    if (
        Array.isArray(
            response.tool_calls
        ) &&
        response.tool_calls.length > 0
    ) {

        return true;

    }


    return (
        response.finish_reason ===
        "tool_calls"
    );

}


/* =========================================================
   TOOL CALL NORMALIZER
========================================================= */

function normalizeToolCall(
    toolCall
) {

    if (
        !toolCall ||
        typeof toolCall !==
        "object"
    ) {

        return null;

    }


    const functionData =
        toolCall.function &&
        typeof toolCall.function ===
        "object"

            ? toolCall.function

            : {};


    let parsedArguments =
        null;


    const rawArguments =
        functionData.arguments;


    if (
        typeof rawArguments ===
        "string"
    ) {

        try {

            parsedArguments =
                JSON.parse(
                    rawArguments
                );

        }
        catch (_) {

            parsedArguments =
                null;

        }

    }
    else if (
        rawArguments &&
        typeof rawArguments ===
        "object"
    ) {

        parsedArguments =
            {
                ...rawArguments
            };

    }


    return {

        id:
            toolCall.id ??
            null,

        type:
            toolCall.type ??
            "function",

        function: {

            name:
                functionData.name ??
                "",

            arguments:
                rawArguments ??
                "",

            parsed_arguments:
                parsedArguments

        }

    };

}


/* =========================================================
   NORMALIZE TOOL CALL LIST
========================================================= */

function normalizeToolCalls(
    toolCalls
) {

    return normalizeArray(
        toolCalls
    )
        .map(
            normalizeToolCall
        )
        .filter(
            Boolean
        );

}


/* =========================================================
   BUILD TOOL RESULT MESSAGE
========================================================= */

function buildToolResultMessage(
    toolCall,
    result
) {

    const normalized =
        normalizeToolCall(
            toolCall
        );


    if (
        !normalized ||
        !normalized.id
    ) {

        const error =
            new Error(
                "Tool call ID tidak tersedia."
            );

        error.code =
            "OPENKEY_TOOL_CALL_ID_REQUIRED";

        throw error;

    }


    let content;


    if (
        typeof result ===
        "string"
    ) {

        content =
            result;

    }
    else {

        try {

            content =
                JSON.stringify(
                    result
                );

        }
        catch (_) {

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
            normalized.id,

        content

    };

}


/* =========================================================
   BUILD ASSISTANT TOOL MESSAGE
========================================================= */

function buildAssistantToolMessage(
    response
) {

    const message =
        response?.message ??
        getMessage(
            response?.raw
        );


    if (
        !message
    ) {

        return null;

    }


    const toolCalls =
        normalizeToolCalls(
            message.tool_calls ??
            response?.tool_calls
        );


    if (
        !toolCalls.length
    ) {

        return null;

    }


    return {

        role:
            "assistant",

        content:
            message.content ??
            null,

        tool_calls:
            toolCalls.map(
                toolCall => ({

                    id:
                        toolCall.id,

                    type:
                        toolCall.type,

                    function: {

                        name:
                            toolCall.function.name,

                        arguments:
                            toolCall.function.arguments

                    }

                })
            )

    };

}


/* =========================================================
   APPEND TOOL RESULT
========================================================= */

function appendToolResult(
    messages,
    toolCall,
    result
) {

    const source =
        normalizeMessages(
            messages
        );


    const assistantMessage =
        buildAssistantToolMessage(
            {
                message: {
                    tool_calls: [
                        toolCall
                    ]
                },

                tool_calls: [
                    toolCall
                ]
            }
        );


    if (
        assistantMessage
    ) {

        source.push(
            assistantMessage
        );

    }


    source.push(
        buildToolResultMessage(
            toolCall,
            result
        )
    );


    return source;

}


/* =========================================================
   BUILD NEXT TOOL REQUEST
========================================================= */

function buildToolContinuation(
    response,
    messages,
    toolResults = []
) {

    const source =
        normalizeMessages(
            messages
        );


    const assistantMessage =
        buildAssistantToolMessage(
            response
        );


    if (
        assistantMessage
    ) {

        source.push(
            assistantMessage
        );

    }


    const calls =
        normalizeToolCalls(
            response?.tool_calls ??
            response?.message?.tool_calls ??
            []
        );


    for (
        const call of calls
    ) {

        const resultEntry =
            normalizeArray(
                toolResults
            ).find(

                entry =>

                    String(
                        entry?.tool_call_id ??
                        entry?.toolCallId ??
                        ""
                    ) ===
                    String(
                        call.id
                    )

            );


        if (
            !resultEntry
        ) {

            continue;

        }


        source.push(

            buildToolResultMessage(
                call,
                resultEntry.result ??
                resultEntry.output ??
                resultEntry.content ??
                ""
            )

        );

    }


    return source;

}


/* =========================================================
   REQUEST WITH TOOL RESULTS
========================================================= */

async function continueAfterTools(
    options = {}
) {

    const {

        apiKey = null,

        response,

        messages = [],

        toolResults = []

    } = options;


    const nextMessages =
        buildToolContinuation(
            response,
            messages,
            toolResults
        );


    return chat({

        ...options,

        apiKey,

        messages:
            nextMessages,

        stream:
            false

    });

}


/* =========================================================
   FULL TOOL LOOP
   ---------------------------------------------------------
   Menjalankan tool call secara otomatis sampai model
   menghasilkan response final.

   executeTool:
       async (toolCall, context) => result

   context:
       round
       index
       response
       messages
       options
========================================================= */

async function runToolLoop(
    options = {}
) {

    const {

        apiKey = null,

        messages = [],

        executeTool,

        maxToolRounds = 8,

        continuationToolChoice = "auto"

    } = options;


    /*
     * VALIDATE EXECUTOR
     */

    if (
        typeof executeTool !==
        "function"
    ) {

        const error =
            new Error(
                "OpenKey tool loop membutuhkan executeTool."
            );

        error.code =
            "OPENKEY_EXECUTE_TOOL_REQUIRED";

        throw error;

    }


    /*
     * NORMALIZE LIMIT
     */

    const numericLimit =
        Number(
            maxToolRounds
        );


    const limit =
        Number.isFinite(
            numericLimit
        )
            ? Math.max(
                1,
                Math.floor(
                    numericLimit
                )
            )
            : 8;


    /*
     * COPY MESSAGE STATE
     */

    let currentMessages =
        normalizeMessages(
            messages
        );


    /*
     * FIRST REQUEST
     */

    let response =
        await chat({

            ...options,

            apiKey,

            messages:
                currentMessages,

            stream:
                false

        });


    /*
     * TOOL LOOP
     */

    for (
        let round = 0;
        round < limit;
        round++
    ) {

        const toolCalls =
            normalizeToolCalls(
                response?.tool_calls ??
                response?.message?.tool_calls ??
                []
            );


        /*
         * NO TOOL CALL
         *
         * Model sudah memberikan jawaban final.
         */

        if (
            !toolCalls.length
        ) {

            return response;

        }


        /*
         * BUILD ASSISTANT MESSAGE
         */

        const assistantMessage =
            buildAssistantToolMessage(
                response
            );


        if (
            !assistantMessage
        ) {

            const error =
                new Error(
                    "OpenKey mengembalikan tool call tanpa assistant tool message yang valid."
                );

            error.code =
                "OPENKEY_TOOL_ASSISTANT_MESSAGE_INVALID";

            throw error;

        }


        currentMessages.push(
            assistantMessage
        );


        /*
         * EXECUTE EVERY TOOL CALL
         */

        for (
            let index = 0;
            index < toolCalls.length;
            index++
        ) {

            const toolCall =
                toolCalls[index];


            let result;


            try {

                result =
                    await executeTool(
                        toolCall,
                        {

                            round:
                                round + 1,

                            index,

                            response,

                            messages:
                                currentMessages
                                    .slice(),

                            options

                        }
                    );

            }
            catch (error) {

                /*
                 * Tool failure tidak langsung
                 * menghentikan seluruh chat.
                 *
                 * Error dikirim sebagai tool result
                 * agar model dapat menangani kegagalan.
                 */

                result = {

                    error:
                        true,

                    message:
                        error?.message ||
                        String(
                            error
                        )

                };

            }


            currentMessages.push(

                buildToolResultMessage(
                    toolCall,
                    result
                )

            );

        }


        /*
         * CONTINUE MODEL
         *
         * Tool choice forced dari request awal tidak
         * diteruskan. Model kembali memilih sendiri.
         */

        response =
            await chat({

                ...options,

                apiKey,

                messages:
                    currentMessages,

                stream:
                    false,

                tool_choice:
                    continuationToolChoice

            });

    }


    /*
     * MAX ROUND REACHED
     */

    const limitError =
        new Error(
            "OpenKey tool loop mencapai batas iterasi."
        );


    limitError.code =
        "OPENKEY_TOOL_LOOP_LIMIT";


    limitError.maxToolRounds =
        limit;


    limitError.response =
        response;


    throw limitError;

}


/* =========================================================
   EXPORT OBJECT
========================================================= */

const OpenKeyChat = {

    OPENKEY_CHAT_VERSION,


    normalizeArray,

    normalizeText,


    normalizeMessage,

    normalizeMessages,


    normalizeTool,

    normalizeTools,


    buildChatPayload,


    getFirstChoice,

    getMessage,

    getContent,

    getToolCalls,

    getFinishReason,

    getUsage,


    normalizeResponse,


    chat,

    simpleChat,


    hasToolCalls,


    normalizeToolCall,

    normalizeToolCalls,


    buildToolResultMessage,

    buildAssistantToolMessage,

    appendToolResult,

    buildToolContinuation,

    continueAfterTools,

    runToolLoop

};


/* =========================================================
   EXPORTS
========================================================= */

export {

    OPENKEY_CHAT_VERSION,


    normalizeArray,

    normalizeText,


    normalizeMessage,

    normalizeMessages,


    normalizeTool,

    normalizeTools,


    buildChatPayload,


    getFirstChoice,

    getMessage,

    getContent,

    getToolCalls,

    getFinishReason,

    getUsage,


    normalizeResponse,


    chat,

    simpleChat,


    hasToolCalls,


    normalizeToolCall,

    normalizeToolCalls,


    buildToolResultMessage,

    buildAssistantToolMessage,

    appendToolResult,

    buildToolContinuation,

    continueAfterTools,

    runToolLoop

};


/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default OpenKeyChat;


/* =========================================================
   BROWSER GLOBAL
========================================================= */

if (
    typeof window !== "undefined"
) {

    window.GENZOpenKeyChat =
        OpenKeyChat;


    console.info(
        "[GEN-Z.AI] OpenKey Chat loaded:",
        OPENKEY_CHAT_VERSION
    );

}
