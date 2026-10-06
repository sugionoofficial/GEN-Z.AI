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
   GET https://api.openkey.ai/api/public/v1/models

   Public model detail:
   GET https://api.openkey.ai/api/public/v1/models/{provider}/{model}

   CATATAN:
   - /v1/models digunakan untuk mengetahui model yang
     tersedia untuk credential/API key.
   - Public catalog digunakan untuk metadata capability.
   - API key TIDAK dikirim ke public catalog.
   - Tidak ada capability model yang dibuat secara artificial.
   - Model hanya boleh berasal dari authenticated /v1/models.
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
    "2026-10-06-openkey-models-public-catalog-v5";


/* =========================================================
   PUBLIC CATALOG CONFIGURATION
========================================================= */

const DEFAULT_PUBLIC_CATALOG_BASE_URL =
    "https://api.openkey.ai";


const PUBLIC_CATALOG_MODELS_PATH =
    "/api/public/v1/models";


/* =========================================================
   PUBLIC MODEL DETAIL CONFIGURATION
========================================================= */

const PUBLIC_CATALOG_DETAIL_CONCURRENCY =
    5;


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


    if (
        typeof value === "object"
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
   MODEL IDENTIFIER CANDIDATES
   ---------------------------------------------------------
   Membuat beberapa identifier dari SATU model.

   Tidak membuat model baru.
   Hanya membuat alias lookup untuk metadata.
========================================================= */

function getModelIdentifierCandidates(
    model
) {

    if (
        !model ||
        typeof model !== "object"
    ) {

        return [];

    }


    const candidates = [];


    const pushCandidate = (
        value
    ) => {

        const text =
            normalizeText(
                value
            );


        if (
            !text
        ) {

            return;

        }


        const normalized =
            text
                .toLowerCase()
                .replace(
                    /^\/+/,
                    ""
                )
                .replace(
                    /\/+$/,
                    ""
                );


        if (
            normalized &&
            !candidates.includes(
                normalized
            )
        ) {

            candidates.push(
                normalized
            );

        }

    };


    pushCandidate(
        model.id
    );


    pushCandidate(
        model.model_id
    );


    pushCandidate(
        model.modelId
    );


    pushCandidate(
        model.slug
    );


    pushCandidate(
        model.name
    );


    pushCandidate(
        model.model_name
    );


    pushCandidate(
        model.modelName
    );


    pushCandidate(
        model.display_name
    );


    pushCandidate(
        model.displayName
    );


    pushCandidate(
        model.title
    );


    /*
     * Provider + model combinations.
     */

    const providerValues = [

        model.provider,

        model.provider_id,

        model.providerId,

        model.provider_name,

        model.providerName,

        model.owned_by,

        model.ownedBy,

        model.owner

    ];


    const modelValues = [

        model.id,

        model.model_id,

        model.modelId,

        model.slug,

        model.name,

        model.model_name,

        model.modelName

    ];


    for (
        const provider
        of providerValues
    ) {

        const providerText =
            normalizeText(
                provider
            );


        if (
            !providerText
        ) {

            continue;

        }


        for (
            const modelValue
            of modelValues
        ) {

            const modelText =
                normalizeText(
                    modelValue
                );


            if (
                !modelText
            ) {

                continue;

            }


            /*
             * Jika modelText sudah provider/model,
             * jangan menghasilkan provider/provider/model.
             */

            if (
                modelText
                    .toLowerCase()
                    .startsWith(
                        providerText
                            .toLowerCase() +
                        "/"
                    )
            ) {

                pushCandidate(
                    modelText
                );

            }
            else {

                pushCandidate(

                    `${providerText}/${modelText}`

                );

            }

        }

    }


    /*
     * Jika ID memiliki provider/model,
     * tambahkan bagian model tanpa provider
     * sebagai fallback alias.
     */

    const slashCandidates =
        candidates.slice();


    for (
        const candidate
        of slashCandidates
    ) {

        const slashIndex =
            candidate.indexOf(
                "/"
            );


        if (
            slashIndex <= 0 ||
            slashIndex >=
                candidate.length - 1
        ) {

            continue;

        }


        pushCandidate(

            candidate.slice(
                slashIndex + 1
            )

        );

    }


    return candidates;

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
========================================================= */

function getPublicCatalogBaseUrl() {

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
   BUILD PUBLIC MODEL DETAIL URL
   ---------------------------------------------------------
   Format resmi OpenKey:

   /api/public/v1/models/{provider}/{model}

   Model ID authenticated biasanya:

   provider/model

   API key TIDAK digunakan.
========================================================= */

function buildPublicModelDetailUrl(
    model
) {

    const modelId =
        getModelId(
            model
        );


    if (
        !modelId
    ) {

        return "";

    }


    /*
     * Prioritas:
     * provider/model dari model ID.
     */

    const slashIndex =
        modelId.indexOf(
            "/"
        );


    if (
        slashIndex > 0 &&
        slashIndex <
            modelId.length - 1
    ) {

        const provider =
            modelId.slice(
                0,
                slashIndex
            );


        const modelName =
            modelId.slice(
                slashIndex + 1
            );


        return (

            getPublicCatalogBaseUrl() +

            PUBLIC_CATALOG_MODELS_PATH +

            "/" +

            encodeURIComponent(
                provider
            ) +

            "/" +

            encodeURIComponent(
                modelName
            )

        );

    }


    /*
     * Jika ID tidak berbentuk provider/model,
     * gunakan provider dari metadata.
     */

    const provider =
        normalizeText(

            model.provider ??

            model.provider_id ??

            model.providerId ??

            model.provider_name ??

            model.providerName ??

            model.owned_by ??

            model.ownedBy ??

            ""

        );


    if (
        !provider
    ) {

        return "";

    }


    return (

        getPublicCatalogBaseUrl() +

        PUBLIC_CATALOG_MODELS_PATH +

        "/" +

        encodeURIComponent(
            provider
        ) +

        "/" +

        encodeURIComponent(
            modelId
        )

    );

}


/* =========================================================
   FETCH PUBLIC CATALOG
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
                    error?.message ||
                    String(error)

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
   FETCH PUBLIC MODEL DETAIL
   ---------------------------------------------------------
   Digunakan HANYA untuk model yang sudah ada pada
   authenticated /v1/models tetapi tidak ditemukan
   pada public catalog list.

   API key TIDAK dikirim.
========================================================= */

async function fetchPublicModelDetail(
    model
) {

    const url =
        buildPublicModelDetailUrl(
            model
        );


    if (
        !url
    ) {

        return null;

    }


    try {

        const response =
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


        if (
            !response.ok
        ) {

            console.warn(

                "[GEN-Z.AI][OpenKey][PUBLIC MODEL DETAIL FAILED]",

                {

                    model:
                        getModelId(
                            model
                        ),

                    status:
                        response.status,

                    url

                }

            );


            return null;

        }


        const contentType =
            String(

                response.headers.get(
                    "content-type"
                ) || ""

            ).toLowerCase();


        if (
            !contentType.includes(
                "application/json"
            )
        ) {

            return null;

        }


        const data =
            await response.json();


        /*
         * Endpoint detail mungkin mengembalikan
         * object langsung atau wrapper.
         */

        if (
            data &&
            typeof data === "object"
        ) {

            if (
                data.model &&
                typeof data.model ===
                    "object"
            ) {

                return data.model;

            }


            if (
                data.data &&
                !Array.isArray(
                    data.data
                ) &&
                typeof data.data ===
                    "object"
            ) {

                return data.data;

            }


            return data;

        }


        return null;

    }
    catch (
        error
    ) {

        console.warn(

            "[GEN-Z.AI][OpenKey][PUBLIC MODEL DETAIL ERROR]",

            {

                model:
                    getModelId(
                        model
                    ),

                url,

                message:
                    error?.message ||
                    String(error)

            }

        );


        return null;

    }

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
   ---------------------------------------------------------
   PERBAIKAN UTAMA:

   Sebelumnya hanya:

       index.set(model.id, model)

   Sekarang satu public model dapat memiliki
   beberapa alias lookup.

   Ini TIDAK membuat model baru.
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


        const candidates =
            getModelIdentifierCandidates(
                model
            );


        for (
            const candidate
            of candidates
        ) {

            if (
                !candidate
            ) {

                continue;

            }


            /*
             * Jangan menimpa entry yang sudah
             * ditemukan lebih dahulu.
             */

            if (
                !index.has(
                    candidate
                )
            ) {

                index.set(
                    candidate,
                    model
                );

            }

        }

    }


    return index;

}


/* =========================================================
   PUBLIC CATALOG MODEL MATCH
========================================================= */

function findPublicCatalogModel(
    authenticatedModel,
    publicIndex
) {

    if (
        !authenticatedModel ||
        !publicIndex
    ) {

        return null;

    }


    const candidates =
        getModelIdentifierCandidates(
            authenticatedModel
        );


    for (
        const candidate
        of candidates
    ) {

        const publicModel =
            publicIndex.get(
                candidate
            );


        if (
            publicModel
        ) {

            return {

                model:
                    publicModel,

                key:
                    candidate

            };

        }

    }


    return null;

}


/* =========================================================
   RECURSIVE MODALITY COLLECTOR
========================================================= */

function collectModalityValues(
    value,
    output = [],
    depth = 0
) {

    if (
        value === null ||
        value === undefined
    ) {

        return output;

    }


    if (
        depth > 8
    ) {

        return output;

    }


    if (
        typeof value === "string" ||
        typeof value === "number"
    ) {

        const text =
            String(
                value
            ).trim();


        if (
            text
        ) {

            output.push(
                text
            );

        }


        return output;

    }


    if (
        Array.isArray(
            value
        )
    ) {

        for (
            const item
            of value
        ) {

            collectModalityValues(

                item,

                output,

                depth + 1

            );

        }


        return output;

    }


    if (
        typeof value !== "object"
    ) {

        return output;

    }


    const preferredKeys = [

        "input_modalities",

        "inputModalities",

        "output_modalities",

        "outputModalities",

        "input_types",

        "inputTypes",

        "output_types",

        "outputTypes",

        "supported_inputs",

        "supportedInputs",

        "supported_outputs",

        "supportedOutputs",

        "supported_input_types",

        "supportedInputTypes",

        "supported_output_types",

        "supportedOutputTypes",

        "modalities",

        "modality",

        "input",

        "output"

    ];


    for (
        const key
        of preferredKeys
    ) {

        if (
            Object.prototype.hasOwnProperty.call(
                value,
                key
            )
        ) {

            collectModalityValues(

                value[key],

                output,

                depth + 1

            );

        }

    }


    /*
     * Fallback nested metadata.
     */

    for (
        const [
            key,
            nestedValue
        ]
        of Object.entries(
            value
        )
    ) {

        if (
            preferredKeys.includes(
                key
            )
        ) {

            continue;

        }


        if (
            nestedValue &&
            typeof nestedValue ===
                "object"
        ) {

            collectModalityValues(

                nestedValue,

                output,

                depth + 1

            );

        }

    }


    return output;

}


/* =========================================================
   UNIQUE TEXT ARRAY
========================================================= */

function uniqueNormalizedTexts(
    values
) {

    const result = [];

    const seen =
        new Set();


    for (
        const value
        of normalizeArray(
            values
        )
    ) {

        const text =
            normalizeText(
                value
            );


        if (
            !text
        ) {

            continue;

        }


        const key =
            text.toLowerCase();


        if (
            seen.has(
                key
            )
        ) {

            continue;

        }


        seen.add(
            key
        );


        result.push(
            text
        );

    }


    return result;

}


/* =========================================================
   EXTRACT ACTUAL INPUT MODALITIES
========================================================= */

function extractInputModalities(
    model
) {

    if (
        !model ||
        typeof model !== "object"
    ) {

        return [];

    }


    const values = [];


    const directKeys = [

        "input_modalities",

        "inputModalities",

        "input_types",

        "inputTypes",

        "supported_inputs",

        "supportedInputs",

        "supported_input_types",

        "supportedInputTypes"

    ];


    for (
        const key
        of directKeys
    ) {

        if (
            Object.prototype.hasOwnProperty.call(
                model,
                key
            )
        ) {

            values.push(
                ...normalizeArray(
                    model[key]
                )
            );

        }

    }


    const nestedSources = [

        model.architecture,

        model.modalities,

        model.modality,

        model.capabilities,

        model.capability,

        model.input,

        model.details,

        model.metadata,

        model.meta

    ];


    for (
        const source
        of nestedSources
    ) {

        values.push(

            ...collectModalityValues(
                source
            )

        );

    }


    return uniqueNormalizedTexts(
        values
    );

}


/* =========================================================
   EXTRACT ACTUAL OUTPUT MODALITIES
========================================================= */

function extractOutputModalities(
    model
) {

    if (
        !model ||
        typeof model !== "object"
    ) {

        return [];

    }


    const values = [];


    const directKeys = [

        "output_modalities",

        "outputModalities",

        "output_types",

        "outputTypes",

        "supported_outputs",

        "supportedOutputs",

        "supported_output_types",

        "supportedOutputTypes"

    ];


    for (
        const key
        of directKeys
    ) {

        if (
            Object.prototype.hasOwnProperty.call(
                model,
                key
            )
        ) {

            values.push(
                ...normalizeArray(
                    model[key]
                )
            );

        }

    }


    const nestedSources = [

        model.architecture,

        model.modalities,

        model.modality,

        model.capabilities,

        model.capability,

        model.output,

        model.details,

        model.metadata,

        model.meta

    ];


    for (
        const source
        of nestedSources
    ) {

        values.push(

            ...collectModalityValues(
                source
            )

        );

    }


    return uniqueNormalizedTexts(
        values
    );

}


/* =========================================================
   VISION INPUT DETECTOR
========================================================= */

function metadataContainsVisionInput(
    model
) {

    if (
        !model ||
        typeof model !== "object"
    ) {

        return false;

    }


    const inputValues =
        extractInputModalities(
            model
        );


    const text =
        inputValues

            .map(
                value =>
                    normalizeText(
                        value
                    )
                        .toLowerCase()
            )

            .join(" ");


    return (

        text.includes(
            "image"
        ) ||

        text.includes(
            "vision"
        ) ||

        text.includes(
            "visual"
        ) ||

        text.includes(
            "picture"
        ) ||

        text.includes(
            "photo"
        ) ||

        text.includes(
            "frame"
        )

    );

}


/* =========================================================
   MODEL METADATA MERGE
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


    const merged = {

        ...authenticated,

        ...publicMetadata

    };


    /*
     * LOCK IDENTIFIER
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
     * LOCK OWNED BY
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
     * PRESERVE ORIGINAL SOURCES
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


    const inputModalities =
        extractInputModalities(
            model
        );


    const outputModalities =
        extractOutputModalities(
            model
        );


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
            inputModalities,


        /* =================================================
           OUTPUT MODALITIES
        ================================================= */

        output_modalities:
            outputModalities,


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
   ---------------------------------------------------------
   MATCHING STRATEGY:

   1. Exact / alias public catalog match
   2. Unmatched model tetap dipertahankan
   3. Detail lookup dilakukan terpisah

   Model tidak pernah ditambahkan dari public catalog.
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

    let unmatchedCount = 0;

    let aliasMatchedCount = 0;


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

                    unmatchedCount += 1;

                    return model;

                }


                const match =
                    findPublicCatalogModel(

                        model,

                        publicIndex

                    );


                if (
                    !match
                ) {

                    unmatchedCount += 1;

                    return model;

                }


                matchedCount += 1;


                /*
                 * Jika key yang digunakan bukan ID
                 * canonical authenticated, catat sebagai
                 * alias match.
                 */

                const canonicalId =
                    id
                        .toLowerCase()
                        .replace(
                            /^\/+/,
                            ""
                        )
                        .replace(
                            /\/+$/,
                            ""
                        );


                if (
                    match.key !==
                    canonicalId
                ) {

                    aliasMatchedCount += 1;

                }


                return mergeModelMetadata(

                    model,

                    match.model

                );

            }

        );


    console.info(

        "[GEN-Z.AI][OpenKey][PUBLIC CATALOG MATCHED]",

        matchedCount

    );


    console.info(

        "[GEN-Z.AI][OpenKey][PUBLIC CATALOG ALIAS MATCHED]",

        aliasMatchedCount

    );


    console.info(

        "[GEN-Z.AI][OpenKey][PUBLIC CATALOG UNMATCHED]",

        unmatchedCount

    );


    const capabilityCount =
        enriched.filter(

            model =>
                metadataContainsVisionInput(
                    model
                )

        ).length;


    console.info(

        "[GEN-Z.AI][OpenKey][PUBLIC CATALOG VISION CAPABLE]",

        capabilityCount

    );


    const visionModels =
        enriched

            .filter(
                metadataContainsVisionInput
            )

            .slice(
                0,
                10
            )

            .map(

                model => ({

                    id:
                        model?.model_id ??
                        null,

                    name:
                        model?.model_name ??
                        null,

                    input_modalities:
                        model?.input_modalities ??
                        [],

                    architecture:
                        model?.architecture ??
                        null

                })

            );


    console.info(

        "[GEN-Z.AI][OpenKey][VISION MODEL SAMPLE]",

        visionModels

    );


    return enriched;

}


/* =========================================================
   ENRICH UNMATCHED MODELS FROM DETAIL ENDPOINT
   ---------------------------------------------------------
   PERBAIKAN UTAMA.

   Public list dapat gagal memberikan metadata untuk
   identifier tertentu.

   Karena authenticated /v1/models sudah menentukan
   model yang boleh digunakan credential, kita hanya
   meminta DETAIL metadata untuk model tersebut.

   Tidak pernah menambahkan model baru.
========================================================= */

async function enrichUnmatchedModelsWithPublicDetails(
    models
) {

    const source =
        Array.isArray(
            models
        )
            ? models
            : [];


    if (
        !source.length
    ) {

        return [];

    }


    const result =
        source.slice();


    const candidates =
        source
            .map(

                (
                    model,
                    index
                ) => ({

                    model,

                    index

                })

            )
            .filter(

                entry =>
                    entry.model &&
                    !metadataContainsVisionInput(
                        entry.model
                    )

            );


    if (
        !candidates.length
    ) {

        console.info(

            "[GEN-Z.AI][OpenKey][PUBLIC DETAIL] Tidak ada model yang perlu lookup detail."

        );


        return result;

    }


    console.info(

        "[GEN-Z.AI][OpenKey][PUBLIC DETAIL] Memeriksa detail untuk",

        candidates.length,

        "model."

    );


    let detailMatchedCount = 0;


    /*
     * Worker pool sederhana.
     *
     * Tidak menggunakan Promise.all untuk seluruh
     * model sekaligus agar tidak membanjiri public API.
     */

    let cursor = 0;


    async function worker() {

        while (
            true
        ) {

            const currentIndex =
                cursor;


            cursor += 1;


            if (
                currentIndex >=
                candidates.length
            ) {

                return;

            }


            const entry =
                candidates[
                    currentIndex
                ];


            const detail =
                await fetchPublicModelDetail(
                    entry.model
                );


            if (
                !detail
            ) {

                continue;

            }


            const merged =
                mergeModelMetadata(

                    entry.model,

                    detail

                );


            result[
                entry.index
            ] =
                merged;


            if (
                metadataContainsVisionInput(
                    merged
                )
            ) {

                detailMatchedCount += 1;

            }

        }

    }


    const workerCount =
        Math.min(

            PUBLIC_CATALOG_DETAIL_CONCURRENCY,

            candidates.length

        );


    const workers = [];


    for (
        let index = 0;
        index < workerCount;
        index += 1
    ) {

        workers.push(
            worker()
        );

    }


    await Promise.all(
        workers
    );


    const finalVisionCount =
        result.filter(
            metadataContainsVisionInput
        ).length;


    console.info(

        "[GEN-Z.AI][OpenKey][PUBLIC DETAIL MATCHED]",

        detailMatchedCount

    );


    console.info(

        "[GEN-Z.AI][OpenKey][VISION CAPABLE AFTER DETAIL]",

        finalVisionCount

    );


    return result;

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


                    identifiers:
                        getModelIdentifierCandidates(
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
                        null,


                    extracted_input_modalities:
                        extractInputModalities(
                            model
                        ),


                    extracted_output_modalities:
                        extractOutputModalities(
                            model
                        )

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
                   MERGE PUBLIC LIST
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
                   STEP 3B
                   DETAIL LOOKUP UNTUK MODEL YANG
                   BELUM MEMPUNYAI CAPABILITY
                ========================================= */

                authenticatedModels =

                    await enrichUnmatchedModelsWithPublicDetails(

                        authenticatedModels

                    );


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
                   FINAL VISION DIAGNOSTIC
                ========================================= */

                const finalVisionModels =
                    models.filter(

                        metadataContainsVisionInput

                    );


                console.info(

                    "[GEN-Z.AI][OpenKey][FINAL MODEL COUNT]",

                    models.length

                );


                console.info(

                    "[GEN-Z.AI][OpenKey][FINAL VISION MODEL COUNT]",

                    finalVisionModels.length

                );


                console.info(

                    "[GEN-Z.AI][OpenKey][FINAL VISION MODEL IDS]",

                    finalVisionModels.map(

                        model =>
                            model.model_id

                    )

                );


                /* =========================================
                   STEP 6
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
                    extractInputModalities(
                        model
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
                    extractOutputModalities(
                        model
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

    PUBLIC_CATALOG_DETAIL_CONCURRENCY,


    normalizeArray,

    normalizeText,

    normalizeNumber,


    extractModelRows,

    extractPublicCatalogRows,


    getModelId,

    getModelName,

    getModelIdentifierCandidates,

    getCapabilityField,


    getPublicCatalogBaseUrl,

    buildPublicCatalogUrl,

    buildPublicModelDetailUrl,

    fetchPublicCatalog,

    fetchPublicModelDetail,


    createPublicCatalogIndex,

    findPublicCatalogModel,

    mergeModelMetadata,


    collectModalityValues,

    extractInputModalities,

    extractOutputModalities,

    metadataContainsVisionInput,


    normalizeModel,

    normalizeModels,

    enrichModelsWithPublicCatalog,

    enrichUnmatchedModelsWithPublicDetails,

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

    PUBLIC_CATALOG_DETAIL_CONCURRENCY,


    normalizeArray,

    normalizeText,

    normalizeNumber,


    extractModelRows,

    extractPublicCatalogRows,


    getModelId,

    getModelName,

    getModelIdentifierCandidates,

    getCapabilityField,


    getPublicCatalogBaseUrl,

    buildPublicCatalogUrl,

    buildPublicModelDetailUrl,

    fetchPublicCatalog,

    fetchPublicModelDetail,


    createPublicCatalogIndex,

    findPublicCatalogModel,

    mergeModelMetadata,


    collectModalityValues,

    extractInputModalities,

    extractOutputModalities,

    metadataContainsVisionInput,


    normalizeModel,

    normalizeModels,

    enrichModelsWithPublicCatalog,

    enrichUnmatchedModelsWithPublicDetails,

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
