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

   CAPABILITY POLICY:
   - Tidak mengarang capability model.
   - Tidak membuat registry vision statis.
   - Semua metadata provider dipertahankan.
   - Field capability yang belum dikenal tetap diteruskan.
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
    "2026-10-05-openkey-models-preserve-v3";


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
   CAPABILITY FIELD PRESERVER
   ---------------------------------------------------------
   Tidak menentukan apakah model vision atau bukan.

   Fungsi ini hanya mengambil metadata capability yang
   memang dikirim provider.

   Tujuannya:
   - Tidak membuang field OpenKey yang belum dikenal.
   - Menyediakan bentuk canonical untuk API layer.
========================================================= */

function getCapabilityField(
    model,
    ...keys
) {

    if (
        !model ||
        typeof model !== "object"
    ) {

        return null;

    }


    for (
        const key of keys
    ) {

        if (
            Object.prototype.hasOwnProperty.call(
                model,
                key
            )
        ) {

            return model[key];

        }

    }


    return null;

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
     * =====================================================
     * IMPORTANT
     * =====================================================
     *
     * Mulai dari seluruh field asli provider.
     *
     * Sebelumnya normalizer hanya memilih field tertentu.
     * Akibatnya field capability baru dari OpenKey dapat
     * hilang dari object normalized.
     *
     * Dengan spread ini:
     *
     * - capabilities tetap ada
     * - modalities tetap ada
     * - architecture tetap ada
     * - vision tetap ada
     * - image tetap ada
     * - supports_* tetap ada
     * - field baru dari OpenKey tetap ada
     *
     * Tidak ada field capability yang dibuat secara
     * artificial.
     */

    const normalized = {

        ...model,


        /* =================================================
           CANONICAL ID
        ================================================= */

        id:
            modelId,

        model_id:
            modelId,


        /* =================================================
           CANONICAL NAME
        ================================================= */

        name:
            modelName,

        model_name:
            modelName,


        /* =================================================
           STANDARD OPENAI METADATA
        ================================================= */

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


        /* =================================================
           PROVIDER PRICING
        ================================================= */

        pricing:
            model.pricing ??
            null,


        /* =================================================
           INPUT MODALITIES
        ================================================= */

        input_modalities:
            normalizeArray(

                getCapabilityField(

                    model,

                    "input_modalities",

                    "inputModalities",

                    "input_types",

                    "inputTypes",

                    "supported_inputs",

                    "supportedInputs"

                )

            ),


        /* =================================================
           OUTPUT MODALITIES
        ================================================= */

        output_modalities:
            normalizeArray(

                getCapabilityField(

                    model,

                    "output_modalities",

                    "outputModalities",

                    "output_types",

                    "outputTypes",

                    "supported_outputs",

                    "supportedOutputs"

                )

            ),


        /* =================================================
           CAPABILITY METADATA
        ================================================= */

        capabilities:
            getCapabilityField(

                model,

                "capabilities",

                "capability"

            ),


        modalities:
            getCapabilityField(

                model,

                "modalities"

            ),


        modality:
            getCapabilityField(

                model,

                "modality"

            ),


        architecture:
            getCapabilityField(

                model,

                "architecture"

            ),


        input:
            getCapabilityField(

                model,

                "input"

            ),


        output:
            getCapabilityField(

                model,

                "output"

            ),


        vision:
            getCapabilityField(

                model,

                "vision"

            ),


        image:
            getCapabilityField(

                model,

                "image"

            ),


        images:
            getCapabilityField(

                model,

                "images"

            ),


        supports_vision:
            getCapabilityField(

                model,

                "supports_vision",

                "supportsVision"

            ),


        supports_image:
            getCapabilityField(

                model,

                "supports_image",

                "supportsImage"

            ),


        supports_images:
            getCapabilityField(

                model,

                "supports_images",

                "supportsImages"

            ),


        supports_multimodal:
            getCapabilityField(

                model,

                "supports_multimodal",

                "supportsMultimodal"

            ),


        /* =================================================
           CONTEXT
        ================================================= */

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


        /* =================================================
           RAW PROVIDER MODEL
        =================================================
         *
         * Seluruh object asli tetap tersedia.
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


                    capability:
                        model.capability ??
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
                        null,


                    images:
                        model.images ??
                        null,


                    supports_vision:
                        model.supports_vision ??
                        model.supportsVision ??
                        null,


                    supports_image:
                        model.supports_image ??
                        model.supportsImage ??
                        null,


                    supports_images:
                        model.supports_images ??
                        model.supportsImages ??
                        null,


                    supports_multimodal:
                        model.supports_multimodal ??
                        model.supportsMultimodal ??
                        null

                }

            );

        }

    );

}


/* =========================================================
   DEBUG NORMALIZED MODELS
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

                capabilities:
                    model?.capabilities ??
                    null,

                capability:
                    model?.capability ??
                    null,

                modalities:
                    model?.modalities ??
                    null,

                modality:
                    model?.modality ??
                    null,

                architecture:
                    model?.architecture ??
                    null,

                input:
                    model?.input ??
                    null,

                output:
                    model?.output ??
                    null,

                vision:
                    model?.vision ??
                    null,

                image:
                    model?.image ??
                    null,

                images:
                    model?.images ??
                    null,

                supports_vision:
                    model?.supports_vision ??
                    null,

                supports_image:
                    model?.supports_image ??
                    null,

                supports_images:
                    model?.supports_images ??
                    null,

                supports_multimodal:
                    model?.supports_multimodal ??
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
     */

    if (
        modelsLoaded &&
        !force
    ) {

        return modelCache.slice();

    }


    /*
     * SINGLE FLIGHT
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
                 * RAW RESPONSE
                 */

                debugRawModelsResponse(
                    response
                );


                /*
                 * NORMALIZE
                 */

                const models =
                    normalizeModels(
                        response
                    );


                /*
                 * NORMALIZED DEBUG
                 */

                debugNormalizedModels(
                    models
                );


                /*
                 * SORT
                 */

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
                                model.output_modalities,

                            capabilities:
                                model.capabilities,

                            modalities:
                                model.modalities,

                            modality:
                                model.modality,

                            vision:
                                model.vision,

                            image:
                                model.image,

                            supports_vision:
                                model.supports_vision,

                            supports_image:
                                model.supports_image,

                            supports_images:
                                model.supports_images,

                            supports_multimodal:
                                model.supports_multimodal

                        })

                    )

                );


                return modelCache.slice();

            }
            catch (
                error
            ) {

                console.error(

                    "[GEN-Z.AI] OpenKey models gagal dimuat:",

                    error

                );


                /*
                 * Jangan menghapus cache lama ketika
                 * refresh gagal.
                 */

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

    getCapabilityField,


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

    getCapabilityField,


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
