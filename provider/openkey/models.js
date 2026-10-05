/* =========================================================
   GEN-Z.AI
   OPENKEY MODELS MODULE
   ---------------------------------------------------------
   File:
   provider/openkey/models.js

   TANGGUNG JAWAB:
   - Mengambil daftar model dari OpenKey
   - Normalisasi response /v1/models
   - Lookup model berdasarkan ID
   - Filtering model
   - Tidak menyimpan API key
   - Tidak menghitung credit GEN-Z.AI
   - Tidak berhubungan dengan KIE
   - Tidak berhubungan dengan generation history
   - Tidak membuat registry model statis

   OPENKEY SOURCE:
   https://open.api-github.com/v1/models

   CATATAN:
   - API key harus diberikan oleh caller.
   - Decryption credential dilakukan di server/API layer.
   - Module ini hanya menangani katalog model OpenKey.

   DEBUG:
   - Response OpenKey dicatat sebelum normalisasi.
   - Capability/model metadata dicatat tanpa API key.
   - Tidak melakukan filtering vision secara paksa.
========================================================= */


/* =========================================================
   IMPORT OPENKEY CLIENT
========================================================= */

import openKeyClient
    from "./client.js";


/* =========================================================
   MODULE VERSION
========================================================= */

const OPENKEY_MODELS_VERSION =
    "2026-10-05-openkey-models-debug-v2";


/* =========================================================
   CACHE
========================================================= */

let modelCache = [];

let modelsLoaded = false;

let modelsLoadingPromise = null;


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


    if (
        value === null ||
        value === undefined
    ) {

        return [];

    }


    return [
        value
    ];

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
    ).trim();

}


/* =========================================================
   NUMBER NORMALIZER
========================================================= */

function normalizeNumber(
    value,
    fallback = null
) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {

        return fallback;

    }


    const number =
        Number(value);


    return Number.isFinite(
        number
    )
        ? number
        : fallback;

}


/* =========================================================
   RESPONSE DATA EXTRACTOR
   ---------------------------------------------------------
   OpenAI-compatible /models biasanya:

   {
       object: "list",
       data: [...]
   }

   Tetapi normalizer tetap menerima array langsung
   supaya tidak rapuh terhadap variasi response.
========================================================= */

function extractModelRows(
    response
) {

    if (
        Array.isArray(response)
    ) {

        return response.slice();

    }


    if (
        Array.isArray(
            response?.data
        )
    ) {

        return response.data.slice();

    }


    if (
        Array.isArray(
            response?.models
        )
    ) {

        return response.models.slice();

    }


    return [];

}


/* =========================================================
   MODEL ID
========================================================= */

function getModelId(
    model
) {

    if (
        !model ||
        typeof model !== "object"
    ) {

        return "";

    }


    return normalizeText(

        model.id ??

        model.model_id ??

        model.modelId ??

        ""

    );

}


/* =========================================================
   MODEL NAME
========================================================= */

function getModelName(
    model
) {

    if (
        !model ||
        typeof model !== "object"
    ) {

        return "";

    }


    return normalizeText(

        model.name ??

        model.model_name ??

        model.modelName ??

        model.id ??

        ""

    );

}


/* =========================================================
   NORMALIZE MODEL
========================================================= */

function normalizeModel(
    model
) {

    if (
        !model ||
        typeof model !== "object"
    ) {

        return null;

    }


    const modelId =
        getModelId(
            model
        );


    if (
        !modelId
    ) {

        return null;

    }


    const modelName =
        getModelName(
            model
        );


    /*
     * Simpan raw object.
     *
     * Jangan membuang field provider karena OpenKey
     * dapat menambahkan metadata model baru di masa depan.
     */

    const normalized = {

        id:
            modelId,

        model_id:
            modelId,

        name:
            modelName,

        model_name:
            modelName,


        object:
            normalizeText(
                model.object,
                "model"
            ),


        created:
            normalizeNumber(
                model.created
            ),


        owned_by:
            normalizeText(
                model.owned_by ??
                model.ownedBy ??
                ""
            ),


        permission:
            normalizeArray(
                model.permission
            ),


        root:
            normalizeText(
                model.root ??
                ""
            ),


        parent:
            normalizeText(
                model.parent ??
                ""
            ),


        /*
         * Provider-specific metadata tetap tersedia.
         */

        pricing:
            model.pricing ??
            null,


        /*
         * OpenAI-style capability fields.
         *
         * Tidak mengasumsikan bahwa field ini selalu
         * tersedia dari OpenKey.
         */

        input_modalities:
            normalizeArray(
                model.input_modalities ??
                model.inputModalities
            ),


        output_modalities:
            normalizeArray(
                model.output_modalities ??
                model.outputModalities
            ),


        context_length:
            normalizeNumber(
                model.context_length ??
                model.contextLength
            ),


        max_output_tokens:
            normalizeNumber(
                model.max_output_tokens ??
                model.maxOutputTokens
            ),


        /*
         * Jangan menganggap pricing OpenKey sebagai
         * credit GEN-Z.AI.
         *
         * Pricing hanya metadata dari provider.
         */


        /*
         * RAW MODEL
         *
         * Seluruh field asli dari provider tetap
         * dipertahankan.
         *
         * Ini penting untuk capability field yang belum
         * diketahui oleh normalizer GEN-Z.AI.
         */

        raw:
            {
                ...model
            }

    };


    return normalized;

}


/* =========================================================
   NORMALIZE MODEL LIST
========================================================= */

function normalizeModels(
    response
) {

    const rows =
        extractModelRows(
            response
        );


    return rows
        .map(
            normalizeModel
        )
        .filter(
            Boolean
        );

}


/* =========================================================
   MODEL SORT
========================================================= */

function sortModels(
    models
) {

    const source =
        Array.isArray(models)
            ? models.slice()
            : [];


    return source.sort(

        (
            first,
            second
        ) => {

            const firstId =
                normalizeText(
                    first?.model_id
                )
                    .toLowerCase();


            const secondId =
                normalizeText(
                    second?.model_id
                )
                    .toLowerCase();


            return firstId.localeCompare(
                secondId
            );

        }

    );

}


/* =========================================================
   DEBUG RAW MODEL RESPONSE
   ---------------------------------------------------------
   Tujuan:
   - Mengetahui bentuk response OpenKey sebenarnya.
   - Mengetahui capability field yang tersedia.
   - Tidak menampilkan API key.
   - Tidak mengubah response.
========================================================= */

function debugRawModelsResponse(
    response
) {

    try {

        console.info(
            "[GEN-Z.AI][OpenKey][RAW MODELS RESPONSE]",
            response
        );

    }
    catch {

        /*
         * Logging tidak boleh menyebabkan proses
         * katalog model gagal.
         */

    }


    const rows =
        extractModelRows(
            response
        );


    console.info(
        "[GEN-Z.AI][OpenKey][RAW MODELS COUNT]",
        rows.length
    );


    /*
     * Log metadata capability setiap model.
     *
     * Hanya membaca field.
     * Tidak melakukan filtering.
     */

    rows.forEach(

        (
            model,
            index
        ) => {

            if (
                !model ||
                typeof model !== "object"
            ) {

                return;

            }


            console.info(

                `[GEN-Z.AI][OpenKey][RAW MODEL ${index + 1}]`,

                {

                    id:
                        model.id ??
                        model.model_id ??
                        model.modelId ??
                        null,


                    name:
                        model.name ??
                        model.model_name ??
                        model.modelName ??
                        null,


                    owned_by:
                        model.owned_by ??
                        model.ownedBy ??
                        null,


                    input_modalities:
                        model.input_modalities ??
                        model.inputModalities ??
                        null,


                    output_modalities:
                        model.output_modalities ??
                        model.outputModalities ??
                        null,


                    capabilities:
                        model.capabilities ??
                        null,


                    modality:
                        model.modality ??
                        null,


                    modalities:
                        model.modalities ??
                        null,


                    architecture:
                        model.architecture ??
                        null,


                    input:
                        model.input ??
                        null,


                    output:
                        model.output ??
                        null,


                    vision:
                        model.vision ??
                        null,


                    image:
                        model.image ??
                        null

                }

            );

        }

    );

}


/* =========================================================
   DEBUG NORMALIZED MODELS
   ---------------------------------------------------------
   Memastikan field yang diteruskan ke API layer.
========================================================= */

function debugNormalizedModels(
    models
) {

    const source =
        Array.isArray(models)
            ? models
            : [];


    console.info(
        "[GEN-Z.AI][OpenKey][NORMALIZED MODELS]",
        source.map(

            model => ({

                id:
                    model?.model_id ??
                    null,

                name:
                    model?.model_name ??
                    null,

                owned_by:
                    model?.owned_by ??
                    null,

                input_modalities:
                    model?.input_modalities ??
                    [],

                output_modalities:
                    model?.output_modalities ??
                    [],

                context_length:
                    model?.context_length ??
                    null,

                max_output_tokens:
                    model?.max_output_tokens ??
                    null,

                raw:
                    model?.raw ??
                    null

            })

        )
    );

}


/* =========================================================
   LOAD MODELS
========================================================= */

async function loadModels(
    options = {}
) {

    const {

        apiKey = null,

        force = false

    } = options;


    /*
     * CACHE
     *
     * Cache hanya boleh digunakan ketika caller
     * tidak secara eksplisit meminta refresh.
     */

    if (
        modelsLoaded &&
        !force
    ) {

        return modelCache.slice();

    }


    /*
     * SINGLE FLIGHT
     *
     * Hindari beberapa request /models bersamaan.
     */

    if (
        modelsLoadingPromise &&
        !force
    ) {

        return (
            await modelsLoadingPromise
        ).slice();

    }


    modelsLoadingPromise =
        (async function () {

            try {

                const response =
                    await openKeyClient
                        .listModels(
                            apiKey
                        );


                /*
                 * DEBUG:
                 *
                 * Response asli dari OpenKey
                 * sebelum normalisasi.
                 */

                debugRawModelsResponse(
                    response
                );


                const models =
                    normalizeModels(
                        response
                    );


                /*
                 * DEBUG:
                 *
                 * Model setelah normalisasi.
                 */

                debugNormalizedModels(
                    models
                );


                modelCache =
                    sortModels(
                        models
                    );


                modelsLoaded =
                    true;


                console.info(
                    "[GEN-Z.AI] OpenKey model catalog loaded:",
                    modelCache.map(
                        model => ({

                            id:
                                model.model_id,

                            name:
                                model.model_name,

                            owned_by:
                                model.owned_by,

                            input_modalities:
                                model.input_modalities,

                            output_modalities:
                                model.output_modalities

                        })
                    )
                );


                return modelCache.slice();

            }
            catch (
                error
            ) {

                /*
                 * Jangan menghapus cache lama ketika
                 * refresh gagal.
                 *
                 * Ini penting agar UI tidak kehilangan
                 * katalog hanya karena OpenKey sementara
                 * gagal merespons.
                 */

                console.error(
                    "[GEN-Z.AI] OpenKey models gagal dimuat:",
                    error
                );


                if (
                    modelCache.length > 0
                ) {

                    return modelCache.slice();

                }


                throw error;

            }
            finally {

                modelsLoadingPromise =
                    null;

            }

        })();


    return (
        await modelsLoadingPromise
    ).slice();

}


/* =========================================================
   FORCE REFRESH
========================================================= */

async function refreshModels(
    options = {}
) {

    const {

        apiKey = null

    } = options;


    return loadModels({

        apiKey,

        force:
            true

    });

}


/* =========================================================
   CLEAR CACHE
========================================================= */

function clearCache() {

    modelCache =
        [];

    modelsLoaded =
        false;

    modelsLoadingPromise =
        null;


    return true;

}


/* =========================================================
   GET CACHED MODELS
========================================================= */

function getCachedModels() {

    return modelCache.slice();

}


/* =========================================================
   GET MODEL BY ID
========================================================= */

function getModelById(
    modelId
) {

    const requestedId =
        normalizeText(
            modelId
        );


    if (
        !requestedId
    ) {

        return null;

    }


    const normalizedRequestedId =
        requestedId.toLowerCase();


    return (

        modelCache.find(

            model =>

                normalizeText(
                    model?.model_id
                )
                    .toLowerCase() ===
                normalizedRequestedId

        ) ||

        null

    );

}


/* =========================================================
   FIND MODEL
========================================================= */

function findModel(
    modelId
) {

    return getModelById(
        modelId
    );

}


/* =========================================================
   HAS MODEL
========================================================= */

function hasModel(
    modelId
) {

    return Boolean(
        getModelById(
            modelId
        )
    );

}


/* =========================================================
   FILTER MODELS
========================================================= */

function filterModels(
    models,
    options = {}
) {

    const source =
        Array.isArray(models)
            ? models
            : [];


    const {

        search = "",

        ownedBy = "",

        inputModality = "",

        outputModality = ""

    } = options;


    const normalizedSearch =
        normalizeText(
            search
        )
            .toLowerCase();


    const normalizedOwnedBy =
        normalizeText(
            ownedBy
        )
            .toLowerCase();


    const normalizedInput =
        normalizeText(
            inputModality
        )
            .toLowerCase();


    const normalizedOutput =
        normalizeText(
            outputModality
        )
            .toLowerCase();


    return source.filter(

        model => {

            /*
             * SEARCH
             */

            if (
                normalizedSearch
            ) {

                const haystack = [

                    model?.model_id,

                    model?.model_name,

                    model?.name,

                    model?.owned_by,

                    model?.root

                ]
                    .filter(

                        value =>

                            value !==
                            null &&

                            value !==
                            undefined

                    )
                    .join(" ")
                    .toLowerCase();


                if (
                    !haystack.includes(
                        normalizedSearch
                    )
                ) {

                    return false;

                }

            }


            /*
             * OWNER
             */

            if (
                normalizedOwnedBy
            ) {

                if (
                    normalizeText(
                        model?.owned_by
                    )
                        .toLowerCase() !==
                    normalizedOwnedBy
                ) {

                    return false;

                }

            }


            /*
             * INPUT MODALITY
             */

            if (
                normalizedInput
            ) {

                const modalities =
                    normalizeArray(
                        model?.input_modalities
                    )
                        .map(

                            value =>

                                normalizeText(
                                    value
                                )
                                    .toLowerCase()

                        );


                if (
                    !modalities.includes(
                        normalizedInput
                    )
                ) {

                    return false;

                }

            }


            /*
             * OUTPUT MODALITY
             */

            if (
                normalizedOutput
            ) {

                const modalities =
                    normalizeArray(
                        model?.output_modalities
                    )
                        .map(

                            value =>

                                normalizeText(
                                    value
                                )
                                    .toLowerCase()

                        );


                if (
                    !modalities.includes(
                        normalizedOutput
                    )
                ) {

                    return false;

                }

            }


            return true;

        }

    );

}


/* =========================================================
   MODEL COUNT
========================================================= */

function getModelCount() {

    return modelCache.length;

}


/* =========================================================
   VERSION
========================================================= */

function getVersion() {

    return OPENKEY_MODELS_VERSION;

}


/* =========================================================
   PUBLIC API
========================================================= */

const OpenKeyModels = {

    OPENKEY_MODELS_VERSION,


    normalizeArray,

    normalizeText,

    normalizeNumber,


    extractModelRows,

    getModelId,

    getModelName,


    normalizeModel,

    normalizeModels,

    sortModels,


    debugRawModelsResponse,

    debugNormalizedModels,


    loadModels,

    refreshModels,

    clearCache,


    getCachedModels,

    getModelById,

    findModel,

    hasModel,


    filterModels,

    getModelCount,

    getVersion

};


/* =========================================================
   EXPORTS
========================================================= */

export {

    OPENKEY_MODELS_VERSION,


    normalizeArray,

    normalizeText,

    normalizeNumber,


    extractModelRows,

    getModelId,

    getModelName,


    normalizeModel,

    normalizeModels,

    sortModels,


    debugRawModelsResponse,

    debugNormalizedModels,


    loadModels,

    refreshModels,

    clearCache,


    getCachedModels,

    getModelById,

    findModel,

    hasModel,


    filterModels,

    getModelCount,

    getVersion

};


export default OpenKeyModels;


/* =========================================================
   BROWSER GLOBAL
========================================================= */

if (
    typeof window !== "undefined"
) {

    window.GENZOpenKeyModels =
        OpenKeyModels;


    console.info(
        "[GEN-Z.AI] OpenKey Models loaded:",
        OPENKEY_MODELS_VERSION
    );

}
