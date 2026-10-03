/* =========================================================
   GEN-Z.AI
   OPENKEY TOOL REGISTRY
   ---------------------------------------------------------
   File:
   provider/openkey/tools/registry.js

   FUNGSI:
   - Menyimpan definisi tool OpenKey
   - Menyimpan executor tool server-side
   - Validasi nama tool
   - Menghasilkan schema tools untuk OpenKey
   - Menjalankan tool berdasarkan tool call

   CATATAN:
   - Tidak menyimpan API key
   - Tidak mengakses KIE
   - Tidak mengakses credit
   - Tidak mengakses generation history
   - Executor berjalan server-side
========================================================= */


/* =========================================================
   VERSION
========================================================= */

const REGISTRY_VERSION =
    "2026-10-03-openkey-tool-registry-v1";


/* =========================================================
   INTERNAL REGISTRY
========================================================= */

const tools =
    new Map();


/* =========================================================
   ERROR
========================================================= */

function createToolError(
    message,
    code = "OPENKEY_TOOL_ERROR",
    status = 400
) {

    const error =
        new Error(
            message
        );

    error.code =
        code;

    error.status =
        status;

    return error;

}


/* =========================================================
   NORMALIZE TOOL DEFINITION
========================================================= */

function normalizeToolDefinition(
    definition
) {

    if (
        !definition ||
        typeof definition !==
            "object"
    ) {

        throw createToolError(
            "Definisi OpenKey tool tidak valid.",
            "OPENKEY_TOOL_DEFINITION_INVALID"
        );

    }


    const name =
        String(
            definition.name ||
            definition.function?.name ||
            ""
        ).trim();


    if (!name) {

        throw createToolError(
            "Nama OpenKey tool wajib diisi.",
            "OPENKEY_TOOL_NAME_REQUIRED"
        );

    }


    if (
        !/^[a-zA-Z0-9_-]+$/.test(
            name
        )
    ) {

        throw createToolError(
            `Nama OpenKey tool tidak valid: ${name}`,
            "OPENKEY_TOOL_NAME_INVALID"
        );

    }


    const description =
        String(
            definition.description ||
            definition.function?.description ||
            ""
        ).trim();


    const parameters =
        definition.parameters ||
        definition.function?.parameters ||
        {
            type:
                "object",

            properties: {},

            additionalProperties:
                false
        };


    if (
        !parameters ||
        typeof parameters !==
            "object"
    ) {

        throw createToolError(
            `Parameters tool tidak valid: ${name}`,
            "OPENKEY_TOOL_PARAMETERS_INVALID"
        );

    }


    return {

        name,

        description,

        parameters,

        execute:
            definition.execute

    };

}


/* =========================================================
   REGISTER TOOL
========================================================= */

function registerTool(
    definition
) {

    const normalized =
        normalizeToolDefinition(
            definition
        );


    if (
        typeof normalized.execute !==
            "function"
    ) {

        throw createToolError(
            `Executor tool belum tersedia: ${normalized.name}`,
            "OPENKEY_TOOL_EXECUTOR_REQUIRED"
        );

    }


    if (
        tools.has(
            normalized.name
        )
    ) {

        throw createToolError(
            `OpenKey tool sudah terdaftar: ${normalized.name}`,
            "OPENKEY_TOOL_ALREADY_REGISTERED"
        );

    }


    tools.set(
        normalized.name,
        normalized
    );


    return getTool(
        normalized.name
    );

}


/* =========================================================
   REGISTER MANY
========================================================= */

function registerTools(
    definitions = []
) {

    if (
        !Array.isArray(
            definitions
        )
    ) {

        throw createToolError(
            "Daftar OpenKey tools harus berupa array.",
            "OPENKEY_TOOL_LIST_INVALID"
        );

    }


    const registered = [];


    for (
        const definition
        of definitions
    ) {

        registered.push(
            registerTool(
                definition
            )
        );

    }


    return registered;

}


/* =========================================================
   GET TOOL
========================================================= */

function getTool(
    name
) {

    const key =
        String(
            name || ""
        ).trim();


    return tools.get(
        key
    ) || null;

}


/* =========================================================
   HAS TOOL
========================================================= */

function hasTool(
    name
) {

    return Boolean(
        getTool(
            name
        )
    );

}


/* =========================================================
   REMOVE TOOL
========================================================= */

function unregisterTool(
    name
) {

    const key =
        String(
            name || ""
        ).trim();


    return tools.delete(
        key
    );

}


/* =========================================================
   CLEAR REGISTRY
   ---------------------------------------------------------
   Terutama untuk testing.
========================================================= */

function clearTools() {

    tools.clear();

}


/* =========================================================
   GET TOOL DEFINITIONS
   ---------------------------------------------------------
   Hanya schema yang dikirim ke OpenKey.
   Executor TIDAK dikirim.
========================================================= */

function getToolDefinitions() {

    return Array.from(
        tools.values()
    ).map(
        tool => ({

            type:
                "function",

            function: {

                name:
                    tool.name,

                description:
                    tool.description,

                parameters:
                    tool.parameters

            }

        })
    );

}


/* =========================================================
   LIST TOOLS
========================================================= */

function listTools() {

    return Array.from(
        tools.values()
    ).map(
        tool => ({

            name:
                tool.name,

            description:
                tool.description,

            parameters:
                tool.parameters

        })
    );

}


/* =========================================================
   EXECUTE TOOL
   ---------------------------------------------------------
   Bentuk toolCall:

   {
       id,
       type,
       function: {
           name,
           arguments,
           parsed_arguments
       }
   }
========================================================= */

async function executeTool(
    toolCall,
    context = {}
) {

    const functionName =
        String(
            toolCall?.function?.name ||
            ""
        ).trim();


    if (!functionName) {

        throw createToolError(
            "Tool call OpenKey tidak memiliki nama function.",
            "OPENKEY_TOOL_CALL_NAME_REQUIRED"
        );

    }


    const tool =
        getTool(
            functionName
        );


    if (!tool) {

        throw createToolError(
            `OpenKey tool tidak terdaftar: ${functionName}`,
            "OPENKEY_TOOL_NOT_FOUND",
            404
        );

    }


    let parsedArguments =
        toolCall?.function?.parsed_arguments;


    /* =====================================================
       PARSE ARGUMENTS
    ===================================================== */

    if (
        parsedArguments ===
            undefined
    ) {

        const rawArguments =
            String(
                toolCall?.function?.arguments ||
                ""
            ).trim();


        if (!rawArguments) {

            parsedArguments =
                {};

        }
        else {

            try {

                parsedArguments =
                    JSON.parse(
                        rawArguments
                    );

            }
            catch {

                throw createToolError(
                    `Arguments tool tidak valid: ${functionName}`,
                    "OPENKEY_TOOL_ARGUMENTS_INVALID"
                );

            }

        }

    }


    /* =====================================================
       ARGUMENTS HARUS OBJECT
    ===================================================== */

    if (
        !parsedArguments ||
        typeof parsedArguments !==
            "object" ||
        Array.isArray(
            parsedArguments
        )
    ) {

        throw createToolError(
            `Arguments tool harus berupa object: ${functionName}`,
            "OPENKEY_TOOL_ARGUMENTS_OBJECT_REQUIRED"
        );

    }


    /* =====================================================
       EXECUTE
    ===================================================== */

    return await tool.execute(
        parsedArguments,
        {
            ...context,

            toolCall,

            toolName:
                functionName

        }
    );

}


/* =========================================================
   EXECUTOR ALIAS
========================================================= */

const execute =
    executeTool;


/* =========================================================
   VERSION
========================================================= */

function getVersion() {

    return REGISTRY_VERSION;

}


/* =========================================================
   BROWSER GLOBAL
========================================================= */

if (
    typeof window !==
        "undefined"
) {

    window.GENZOpenKeyToolRegistry = {

        version:
            REGISTRY_VERSION,

        registerTool,

        registerTools,

        getTool,

        hasTool,

        unregisterTool,

        clearTools,

        getToolDefinitions,

        listTools,

        executeTool,

        execute,

        getVersion

    };

}


/* =========================================================
   EXPORTS
========================================================= */

export {

    REGISTRY_VERSION,

    registerTool,

    registerTools,

    getTool,

    hasTool,

    unregisterTool,

    clearTools,

    getToolDefinitions,

    listTools,

    executeTool,

    execute,

    getVersion

};


/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default {

    version:
        REGISTRY_VERSION,

    registerTool,

    registerTools,

    getTool,

    hasTool,

    unregisterTool,

    clearTools,

    getToolDefinitions,

    listTools,

    executeTool,

    execute,

    getVersion

};
