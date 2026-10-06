/* =========================================================
   GEN-Z.AI
   OPENKEY MODELS MODULE
   ---------------------------------------------------------
   File:
   provider/openkey/models.js

   TANGGUNG JAWAB:
   - Mengambil daftar model dari OpenKey
   - Mengambil metadata public catalog OpenKey
   - Merge model authenticated + public metadata
   - Normalisasi response /v1/models
   - Lookup model berdasarkan ID
   - Filtering model
   - Tidak menyimpan API key
   - Tidak menghitung credit GEN-Z.AI
   - Tidak berhubungan dengan KIE
   - Tidak berhubungan dengan generation history
   - Tidak membuat registry model statis

   OPENKEY SOURCES:

   Authenticated:
   GET /v1/models

   Public catalog:
   GET /api/public/v1/models

   CATATAN:
   - /v1/models digunakan untuk mengetahui model yang
     tersedia untuk credential/API key.
   - Public catalog digunakan untuk metadata capability.
   - API key TIDAK dikirim ke public catalog.
   - Tidak ada capability model yang dibuat secara artificial.
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
    "2026-10-06-openkey-models-public-catalog-v3";


/* =========================================================
   PUBLIC CATALOG CONFIGURATION
   ---------------------------------------------------------
   Default mengikuti host OpenKey API client.

   Jika client menggunakan:

       https://open.api-github.com/v1

   maka public catalog menjadi:

       https://open.api-github.com/api/public/v1/models

   Environment variable tetap memiliki prioritas.
========================================================= */

const DEFAULT_PUBLIC_CATALOG_BASE_URL =
    "https://open.api-github.com";


const PUBLIC_CATALOG_MODELS_PATH =
    "/api/public/v1/models";


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


    if (
        Array.isArray(
            response?.model_list
        )
    ) {

        return response.model_list.slice();

    }


    if (
        Array.isArray(
            response?.modelList
        )
    ) {

        return response.modelList.slice();

    }


    if (
        Array.isArray(
            response?.model_catalog
        )
    ) {

        return response.model_catalog.slice();

    }


    if (
        Array.isArray(
            response?.modelCatalog
        )
    ) {

        return response.modelCatalog.slice();

    }


    if (
        Array.isArray(
            response?.available_models
        )
    ) {

        return response.available_models.slice();

    }


    if (
        Array.isArray(
            response?.availableModels
        )
    ) {

        return response.availableModels.slice();

    }


    if (
        Array.isArray(
            response?.results
        )
    ) {

        return response.results.slice();

    }


    if (
        Array.isArray(
            response?.items
        )
    ) {

        return response.items.slice();

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

        model.slug ??

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

        model.display_name ??

        model.displayName ??

        model.title ??

        model.id ??

        ""

    );

}


/* =========================================================
   CAPABILITY FIELD PRESERVER
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
        const key
        of keys
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
   PUBLIC CATALOG BASE URL
   ---------------------------------------------------------
   PRIORITAS:

   1. OPENKEY_PUBLIC_CATALOG_BASE_URL
   2. OPENKEY_PUBLIC_BASE_URL
   3. Host dari openKeyClient.getBaseUrl()
   4. DEFAULT_PUBLIC_CATALOG_BASE_URL

   Contoh client base:

       https://open.api-github.com/v1

   Menjadi:

       https://open.api-github.com
========================================================= */

function getPublicCatalogBaseUrl() {

    /*
     * =====================================================
     * ENVIRONMENT CONFIGURATION
     * =====================================================
     */

    const configured =

        typeof process !==
            "undefined" &&

        process?.env

            ? String(

                process.env
                    .OPENKEY_PUBLIC_CATALOG_BASE_URL ||

                process.env
                    .OPENKEY_PUBLIC_BASE_URL ||

                ""

            ).trim()

            : "";


    if (
        configured
    ) {

        return configured.replace(
            /\/+$/,
            ""
        );

    }


    /*
     * =====================================================
     * DERIVE FROM OPENKEY CLIENT
     * =====================================================
     *
     * Jangan membuat host berbeda dari client tanpa alasan.
     *
     * Jika client:
     *
     *     https://open.api-github.com/v1
     *
     * maka public catalog:
     *
     *     https://open.api-github.com/api/public/v1/models
     */

    try {

        if (
            typeof openKeyClient
                ?.getBaseUrl ===
            "function"
        ) {

            const clientBaseUrl =
                String(

                    openKeyClient
                        .getBaseUrl() ||

                    ""

                ).trim();


            if (
                clientBaseUrl
            ) {

                const derivedBaseUrl =
                    clientBaseUrl

                        .replace(
                            /\/v1\/?$/i,
                            ""
                        )

                        .replace(
                            /\/+$/,
                            ""
                        );


                if (
                    derivedBaseUrl
                ) {

                    return derivedBaseUrl;

                }

            }

        }

    }
    catch (
        error
    ) {

        console.warn(

            "[GEN-Z.AI][OpenKey] Gagal menurunkan public catalog base URL dari OpenKey client:",

            error

        );

    }


    /*
     * =====================================================
     * FINAL DEFAULT
     * ===================================================== */

    return DEFAULT_PUBLIC_CATALOG_BASE_URL;

}


/* =========================================================
   BUILD PUBLIC CATALOG URL
========================================================= */

function buildPublicCatalogUrl() {

    return (

        getPublicCatalogBaseUrl() +

        PUBLIC_CATALOG_MODELS_PATH

    );

}


/* =========================================================
   FETCH PUBLIC CATALOG
   ---------------------------------------------------------
   IMPORTANT:
   - Tidak menggunakan API key.
   - Public catalog unauthenticated.
========================================================= */

async function fetchPublicCatalog() {

    const url =
        buildPublicCatalogUrl();


    console.info(

        "[GEN-Z.AI][OpenKey][PUBLIC CATALOG URL]",

        url

    );


    let response;


    try {

        response =
            await fetch(

                url,

                {

                    method:
                        "GET",

                    headers: {

                        Accept:
                            "application/json"

                    }

                }

            );

    }
    catch (
        error
    ) {

        const catalogError =
            new Error(

                `Gagal terhubung ke OpenKey public catalog: ${error.message}`

            );


        catalogError.code =
            "OPENKEY_PUBLIC_CATALOG_NETWORK_ERROR";


        catalogError.url =
            url;


        catalogError.cause =
            error;


        console.error(

            "[GEN-Z.AI][OpenKey][PUBLIC CATALOG NETWORK ERROR]",

            {

                url,

                message:
                    error?.message || String(error)

            }

        );


        throw catalogError;

    }


    console.info(

        "[GEN-Z.AI][OpenKey][PUBLIC CATALOG HTTP STATUS]",

        response.status

    );


    const contentType =
        String(

            response.headers.get(
                "content-type"
            ) || ""

        ).toLowerCase();


    let data = null;


    try {

        if (
            contentType.includes(
                "application/json"
            )
        ) {

            data =
                await response.json();

        }
        else {

            const text =
                await response.text();


            if (
                text
            ) {

                try {

                    data =
                        JSON.parse(
                            text
                        );

                }
                catch {

                    data = {

                        raw:
                            text

                    };

                }

            }

        }

    }
    catch (
        error
    ) {

        const parseError =
            new Error(

                "Response OpenKey public catalog tidak dapat diparse sebagai JSON."

            );


        parseError.code =
            "OPENKEY_PUBLIC_CATALOG_JSON_ERROR";


        parseError.url =
            url;


        parseError.status =
            response.status;


        parseError.cause =
            error;


        throw parseError;

    }


    if (
        !response.ok
    ) {

        const message =

            data?.message ||

            data?.error?.message ||

            data?.error ||

            `OpenKey public catalog gagal (${response.status}).`;


        const catalogError =
            new Error(
                String(
                    message
                )
            );


        catalogError.code =
            "OPENKEY_PUBLIC_CATALOG_HTTP_ERROR";


        catalogError.status =
            response.status;


        catalogError.url =
            url;


        catalogError.response =
            data;


        console.error(

            "[GEN-Z.AI][OpenKey][PUBLIC CATALOG HTTP ERROR]",

            {

                url,

                status:
                    response.status,

                message:
                    String(message)

            }

        );


        throw catalogError;

    }


    console.info(

        "[GEN-Z.AI][OpenKey][PUBLIC CATALOG HTTP OK]",

        {

            url,

            status:
                response.status,

            contentType

        }

    );


    return data;

}


/* =========================================================
   EXTRACT PUBLIC CATALOG MODELS
========================================================= */

function extractPublicCatalogRows(
    response
) {

    if (
        Array.isArray(
            response
        )
    ) {

        return response.slice();

    }


    if (
        Array.isArray(
            response?.models
        )
    ) {

        return response.models.slice();

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
            response?.results
        )
    ) {

        return response.results.slice();

    }


    if (
        Array.isArray(
            response?.items
        )
    ) {

        return response.items.slice();

    }


    return [];

}


/* =========================================================
   PUBLIC CATALOG MODEL INDEX
========================================================= */

function createPublicCatalogIndex(
    rows
) {

    const index =
        new Map();


    const source =
        Array.isArray(
            rows
        )
            ? rows
            : [];


    for (
        const model
        of source
    ) {

        if (
            !model ||
            typeof model !==
                "object"
        ) {

            continue;

        }


        const id =
            getModelId(
                model
            );


        if (
            !id
        ) {

            continue;

        }


        index.set(

            id.toLowerCase(),

            model

        );

    }


    return index;

}


/* =========================================================
   MODEL METADATA MERGE
   ---------------------------------------------------------
   authenticated:
   - sumber availability
   - model yang benar-benar tersedia
   - id / object / owned_by

   public:
   - sumber capability
   - modalities
   - architecture
   - vision/image metadata
   - metadata model lainnya

   MERGE:

       ...authenticated,
       ...publicMetadata

   sehingga metadata public tidak tertimpa oleh
   field capability kosong dari /v1/models.
========================================================= */

function mergeModelMetadata(
    authenticatedModel,
    publicModel = null
) {

    if (
        !authenticatedModel ||
        typeof authenticatedModel !==
            "object"
    ) {

        return null;

    }


    const authenticated =
        authenticatedModel;


    const publicMetadata =
        publicModel &&
        typeof publicModel ===
            "object"

            ? publicModel
            : {};


    /*
     * =====================================================
     * MERGE ORDER
     * =====================================================
     */

    const merged = {

        ...authenticated,

        ...publicMetadata

    };


    /*
     * =====================================================
     * LOCK IDENTIFIER
     * =====================================================
     */

    if (
        authenticated.id !== undefined
    ) {

        merged.id =
            authenticated.id;

    }


    if (
        authenticated.model_id !== undefined
    ) {

        merged.model_id =
            authenticated.model_id;

    }


    if (
        authenticated.modelId !== undefined
    ) {

        merged.modelId =
            authenticated.modelId;

    }


    if (
        authenticated.object !== undefined
    ) {

        merged.object =
            authenticated.object;

    }


    /*
     * =====================================================
     * LOCK OWNED BY
     * =====================================================
     */

    if (
        authenticated.owned_by !==
            undefined &&

        authenticated.owned_by !==
            null &&

        String(
            authenticated.owned_by
        ).trim()
    ) {

        merged.owned_by =
            authenticated.owned_by;

    }


    /*
     * =====================================================
     * PRESERVE ORIGINAL SOURCES
     * =====================================================
     */

    merged.public_catalog =
        publicMetadata;


    merged.authenticated_catalog =
        authenticated;


    return merged;

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
     * Mulai dari seluruh field asli provider.
     *
     * Tidak membuang field capability yang belum
     * dikenal oleh GEN-Z.AI.
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
            model.object ??
            "model",


        created:
            normalizeNumber(
                model.created
            ),


        owned_by:
            normalizeText(

                model.owned_by ??

                model.ownedBy ??

                model.provider ??

                model.provider_name ??

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
           PROVIDER / PUBLIC PRICING
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

                    "supportedInputs",

                    "supported_input_types",

                    "supportedInputTypes"

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

                    "supportedOutputs",

                    "supported_output_types",

                    "supportedOutputTypes"

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


        capability:
            getCapabilityField(

                model,

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
        ================================================= */

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
   ENRICH AUTHENTICATED MODELS
========================================================= */

function enrichModelsWithPublicCatalog(
    authenticatedModels,
    publicResponse
) {

    const authenticated =
        Array.isArray(
            authenticatedModels
        )
            ? authenticatedModels
            : [];


    const publicRows =
        extractPublicCatalogRows(
            publicResponse
        );


    const publicIndex =
        createPublicCatalogIndex(
            publicRows
        );


    let matchedCount = 0;


    const enriched =

        authenticated.map(

            model => {

                const id =
                    getModelId(
                        model
                    );


                if (
                    !id
                ) {

                    return model;

                }


                const publicModel =
                    publicIndex.get(
                        id.toLowerCase()
                    );


                if (
                    !publicModel
                ) {

                    return model;

                }


                matchedCount += 1;


                return mergeModelMetadata(

                    model,

                    publicModel

                );

            }

        );


    /*
     * =====================================================
     * MATCH DIAGNOSTIC
     * =====================================================
     */

    console.info(

        "[GEN-Z.AI][OpenKey][PUBLIC CATALOG MATCHED]",

        matchedCount

    );


    console.info(

        "[GEN-Z.AI][OpenKey][PUBLIC CATALOG UNMATCHED]",

        Math.max(
            authenticated.length -
            matchedCount,
            0
        )

    );


    /*
     * =====================================================
     * CAPABILITY DIAGNOSTIC
     * =====================================================
     *
     * Tidak membuat capability.
     *
     * Hanya menghitung capability yang memang datang
     * dari metadata public.
     */

    const capabilityCount =
        enriched.filter(

            model => {

                const inputModalities =
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


                const outputModalities =
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


                const capabilityText =

                    [

                        model?.capabilities,

                        model?.capability,

                        model?.modalities,

                        model?.modality,

                        model?.architecture,

                        model?.input,

                        model?.output,

                        model?.vision,

                        model?.image,

                        model?.images

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


                return (

                    inputModalities.includes(
                        "image"
                    ) ||

                    inputModalities.includes(
                        "vision"
                    ) ||

                    inputModalities.includes(
                        "visual"
                    ) ||

                    outputModalities.includes(
                        "image"
                    ) ||

                    outputModalities.includes(
                        "vision"
                    ) ||

                    capabilityText.includes(
                        "image"
                    ) ||

                    capabilityText.includes(
                        "vision"
                    )

                );

            }

        ).length;


    console.info(

        "[GEN-Z.AI][OpenKey][PUBLIC CATALOG VISION CAPABLE]",

        capabilityCount

    );


    return enriched;

}


/* =========================================================
   MODEL SORT
========================================================= */

function sortModels(
    models
) {

    const source =
        Array.isArray(
            models
        )
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
         * Logging tidak boleh menyebabkan
         * katalog gagal.
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
                typeof model !==
                    "object"
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
   DEBUG PUBLIC CATALOG
========================================================= */

function debugPublicCatalog(
    response
) {

    const rows =
        extractPublicCatalogRows(
            response
        );


    console.info(

        "[GEN-Z.AI][OpenKey][PUBLIC CATALOG COUNT]",

        rows.length

    );


    rows.slice(
        0,
        10
    ).forEach(

        (
            model,
            index
        ) => {

            console.info(

                `[GEN-Z.AI][OpenKey][PUBLIC MODEL ${index + 1}]`,

                {

                    id:
                        getModelId(
                            model
                        ),

                    name:
                        getModelName(
                            model
                        ),

                    input_modalities:
                        model?.input_modalities ??
                        model?.inputModalities ??
                        null,

                    output_modalities:
                        model?.output_modalities ??
                        model?.outputModalities ??
                        null,

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
                        null

                }

            );

        }

    );

}


/* =========================================================
   DEBUG MERGED MODELS
========================================================= */

function debugMergedModels(
    models
) {

    const source =
        Array.isArray(
            models
        )
            ? models
            : [];


    console.info(

        "[GEN-Z.AI][OpenKey][MERGED MODELS]",

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

                public_catalog:
                    Boolean(
                        model?.public_catalog
                    )

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


    /* =====================================================
       CACHE
    ===================================================== */

    if (
        modelsLoaded &&
        !force
    ) {

        return modelCache.slice();

    }


    /* =====================================================
       SINGLE FLIGHT
    ===================================================== */

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

                /* =========================================
                   STEP 1
                   AUTHENTICATED MODEL CATALOG
                ========================================= */

                const authenticatedResponse =
                    await openKeyClient
                        .listModels(
                            apiKey
                        );


                debugRawModelsResponse(
                    authenticatedResponse
                );


                let authenticatedModels =
                    normalizeModels(
                        authenticatedResponse
                    );


                console.info(

                    "[GEN-Z.AI][OpenKey] Authenticated models:",

                    authenticatedModels.length

                );


                if (
                    !authenticatedModels.length
                ) {

                    throw new Error(

                        "OpenKey tidak mengembalikan daftar model yang tersedia untuk credential ini."

                    );

                }


                /* =========================================
                   STEP 2
                   PUBLIC CATALOG
                ========================================= */

                let publicCatalogResponse =
                    null;


                try {

                    publicCatalogResponse =
                        await fetchPublicCatalog();


                    debugPublicCatalog(
                        publicCatalogResponse
                    );

                }
                catch (
                    publicCatalogError
                ) {

                    console.warn(

                        "[GEN-Z.AI][OpenKey] Public catalog gagal dimuat. Model authenticated tetap digunakan:",

                        publicCatalogError

                    );

                }


                /* =========================================
                   STEP 3
                   MERGE
                ========================================= */

                if (
                    publicCatalogResponse
                ) {

                    authenticatedModels =

                        enrichModelsWithPublicCatalog(

                            authenticatedModels,

                            publicCatalogResponse

                        );

                }
                else {

                    console.warn(

                        "[GEN-Z.AI][OpenKey][PUBLIC CATALOG] Metadata public tidak tersedia. Tidak ada capability yang dibuat secara artificial."

                    );

                }


                /* =========================================
                   STEP 4
                   NORMALIZE ULANG
                ========================================= */

                const models =
                    authenticatedModels

                        .map(
                            normalizeModel
                        )

                        .filter(
                            Boolean
                        );


                /* =========================================
                   STEP 5
                   SORT + CACHE
                ========================================= */

                modelCache =
                    sortModels(
                        models
                    );


                modelsLoaded =
                    true;


                debugMergedModels(
                    modelCache
                );


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

                            capability:
                                model.capability,

                            modalities:
                                model.modalities,

                            modality:
                                model.modality,

                            architecture:
                                model.architecture,

                            input:
                                model.input,

                            output:
                                model.output,

                            vision:
                                model.vision,

                            image:
                                model.image,

                            images:
                                model.images,

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
                 * Jangan menghapus cache lama
                 * ketika refresh gagal.
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
        Array.isArray(
            models
        )
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

            /* =============================================
               SEARCH
            ============================================= */

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


            /* =============================================
               OWNER
            ============================================= */

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


            /* =============================================
               INPUT MODALITY
            ============================================= */

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


            /* =============================================
               OUTPUT MODALITY
            ============================================= */

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

    DEFAULT_PUBLIC_CATALOG_BASE_URL,

    PUBLIC_CATALOG_MODELS_PATH,


    normalizeArray,

    normalizeText,

    normalizeNumber,


    extractModelRows,

    extractPublicCatalogRows,


    getModelId,

    getModelName,

    getCapabilityField,


    getPublicCatalogBaseUrl,

    buildPublicCatalogUrl,

    fetchPublicCatalog,


    createPublicCatalogIndex,

    mergeModelMetadata,


    normalizeModel,

    normalizeModels,

    enrichModelsWithPublicCatalog,

    sortModels,


    debugRawModelsResponse,

    debugPublicCatalog,

    debugMergedModels,


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

    DEFAULT_PUBLIC_CATALOG_BASE_URL,

    PUBLIC_CATALOG_MODELS_PATH,


    normalizeArray,

    normalizeText,

    normalizeNumber,


    extractModelRows,

    extractPublicCatalogRows,


    getModelId,

    getModelName,

    getCapabilityField,


    getPublicCatalogBaseUrl,

    buildPublicCatalogUrl,

    fetchPublicCatalog,


    createPublicCatalogIndex,

    mergeModelMetadata,


    normalizeModel,

    normalizeModels,

    enrichModelsWithPublicCatalog,

    sortModels,


    debugRawModelsResponse,

    debugPublicCatalog,

    debugMergedModels,


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
