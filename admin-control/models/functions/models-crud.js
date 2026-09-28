"use strict";

/*
 * =========================================================
 * GEN-Z.AI
 * MODELS CRUD MODULE
 * ---------------------------------------------------------
 * File:
 * admin-control/models/functions/models-crud.js
 *
 * TANGGUNG JAWAB
 * - CREATE model melalui /api/admin-models
 * - UPDATE model melalui /api/admin-models
 * - DELETE model melalui /api/admin-models
 *
 * Browser tidak melakukan mutation langsung ke Supabase.
 *
 * Semua mutation:
 *
 * Browser
 *   ↓
 * /api/admin-models
 *   ↓
 * verify ADMIN / OWNER
 *   ↓
 * Service Role
 *   ↓
 * Supabase models
 *
 * =========================================================
 */

(function () {

    "use strict";


    /* =====================================================
       CONSTANT
       ===================================================== */

    const MODEL_TABLE =
        "models";


    const ADMIN_MODELS_API =
        "/api/admin-models";


    /* =====================================================
       STATE
       ===================================================== */

    let initialized =
        false;


    /* =====================================================
       SUPABASE
       ===================================================== */

    function getSupabaseClient() {

        if (
            typeof window !== "undefined" &&
            window.GENZ_SUPABASE &&
            typeof window.GENZ_SUPABASE.from ===
                "function"
        ) {

            return window.GENZ_SUPABASE;

        }


        if (
            typeof window !== "undefined" &&
            window.supabaseClient &&
            typeof window.supabaseClient.from ===
                "function"
        ) {

            return window.supabaseClient;

        }


        if (
            typeof window !== "undefined" &&
            window.supabase &&
            typeof window.supabase.from ===
                "function"
        ) {

            return window.supabase;

        }


        return null;

    }


    function requireSupabase() {

        const client =
            getSupabaseClient();


        if (!client) {

            const error =
                new Error(
                    "Supabase client tidak tersedia."
                );

            error.code =
                "SUPABASE_CLIENT_MISSING";

            throw error;

        }


        return client;

    }


    /* =====================================================
       ERROR NORMALIZER
       -----------------------------------------------------
       Ini penting.
       Jangan pernah membiarkan object masuk ke:
       
           new Error(object)
       
       karena hasil akhirnya:
       
           [object Object]
       ===================================================== */

    function normalizeErrorMessage(
        error,
        fallback = "Terjadi kesalahan."
    ) {

        if (
            error === null ||
            error === undefined
        ) {

            return fallback;

        }


        /*
         * Error native.
         */

        if (
            error instanceof Error
        ) {

            if (
                typeof error.message ===
                    "string" &&
                error.message.trim()
            ) {

                return error.message.trim();

            }

        }


        /*
         * String langsung.
         */

        if (
            typeof error ===
                "string"
        ) {

            const text =
                error.trim();

            return text ||
                fallback;

        }


        /*
         * Object.
         */

        if (
            typeof error ===
                "object"
        ) {

            const candidates = [

                error.message,

                error.error,

                error.error_description,

                error.details,

                error.hint,

                error.msg,

                error.description

            ];


            for (
                const candidate
                of candidates
            ) {

                if (
                    typeof candidate ===
                        "string" &&
                    candidate.trim()
                ) {

                    return candidate.trim();

                }


                /*
                 * Nested object.
                 */

                if (
                    candidate &&
                    typeof candidate ===
                        "object"
                ) {

                    const nested =
                        normalizeErrorMessage(
                            candidate,
                            ""
                        );


                    if (
                        nested
                    ) {

                        return nested;

                    }

                }

            }


            /*
             * Supabase error terkadang
             * mempunyai:
             *
             * {
             *   code,
             *   details,
             *   hint,
             *   message
             * }
             *
             * Jika message tidak ada,
             * coba stringify dengan aman.
             */

            try {

                const serialized =
                    JSON.stringify(
                        error
                    );


                if (
                    serialized &&
                    serialized !== "{}"
                ) {

                    return serialized;

                }

            } catch (
                _
            ) {

                /*
                 * Ignore.
                 */

            }

        }


        /*
         * Jangan pernah mengembalikan
         * "[object Object]".
         */

        return fallback;

    }


    function createNormalizedError(
        error,
        fallback,
        code = "MODEL_API_FAILED"
    ) {

        const message =
            normalizeErrorMessage(
                error,
                fallback
            );


        const normalized =
            new Error(
                message
            );


        normalized.code =
            error?.code ||
            code;


        normalized.status =
            error?.status;


        normalized.details =
            error?.details;


        normalized.hint =
            error?.hint;


        normalized.response =
            error?.response;


        normalized.cause =
            error;


        return normalized;

    }


    /* =====================================================
       ACCESS TOKEN
       ===================================================== */

    async function getAccessToken() {

        const supabase =
            requireSupabase();


        let sessionResult;


        try {

            sessionResult =
                await supabase
                    .auth
                    .getSession();

        } catch (
            error
        ) {

            throw createNormalizedError(

                error,

                "Gagal mengambil session Supabase.",

                "MODEL_API_SESSION_ERROR"

            );

        }


        if (
            sessionResult?.error
        ) {

            throw createNormalizedError(

                sessionResult.error,

                "Gagal mengambil session Supabase.",

                "MODEL_API_SESSION_ERROR"

            );

        }


        const accessToken =
            sessionResult
                ?.data
                ?.session
                ?.access_token ||
            "";


        if (
            !accessToken
        ) {

            const error =
                new Error(
                    "Sesi login tidak ditemukan. Silakan login kembali."
                );


            error.code =
                "MODEL_API_AUTH_REQUIRED";


            throw error;

        }


        return accessToken;

    }


    /* =====================================================
       ADMIN MODELS API REQUEST
       ===================================================== */

    async function requestAdminModelsAPI(
        method = "GET",
        body = null,
        query = null
    ) {

        const accessToken =
            await getAccessToken();


        const params =
            new URLSearchParams();


        if (
            query &&
            typeof query ===
                "object"
        ) {

            Object.entries(
                query
            ).forEach(
                (
                    [
                        key,
                        value
                    ]
                ) => {

                    if (
                        value !==
                            undefined &&
                        value !==
                            null &&
                        String(
                            value
                        ).trim() !== ""
                    ) {

                        params.set(
                            key,
                            String(
                                value
                            ).trim()
                        );

                    }

                }
            );

        }


        const queryString =
            params.toString();


        const url =
            queryString
                ? `${ADMIN_MODELS_API}?${queryString}`
                : ADMIN_MODELS_API;


        const options = {

            method,

            headers: {

                Accept:
                    "application/json",

                Authorization:
                    `Bearer ${accessToken}`

            },

            credentials:
                "same-origin"

        };


        if (
            body !== null &&
            body !== undefined &&
            method !== "GET"
        ) {

            options.headers[
                "Content-Type"
            ] =
                "application/json";


            options.body =
                JSON.stringify(
                    body
                );

        }


        const controller =
            new AbortController();


        const timeout =
            setTimeout(
                () => {

                    controller.abort();

                },
                15000
            );


        options.signal =
            controller.signal;


        let response;


        try {

            response =
                await fetch(
                    url,
                    options
                );

        } catch (
            error
        ) {

            if (
                error?.name ===
                    "AbortError"
            ) {

                const timeoutError =
                    new Error(
                        "Admin Models API timeout setelah 15 detik."
                    );


                timeoutError.code =
                    "MODEL_API_TIMEOUT";


                throw timeoutError;

            }


            throw createNormalizedError(

                error,

                "Gagal menghubungi Admin Models API.",

                "MODEL_API_REQUEST_FAILED"

            );

        } finally {

            clearTimeout(
                timeout
            );

        }


        /*
         * Baca response JSON.
         */

        let result = {};


        try {

            result =
                await response.json();

        } catch (
            error
        ) {

            result = {};

        }


        /*
         * HTTP ERROR
         */

        if (
            !response.ok
        ) {

            const apiError =
                (
                    result &&
                    typeof result ===
                        "object"
                )
                    ? result
                    : {
                        message:
                            String(
                                result ||
                                ""
                            )
                    };


            const normalized =
                createNormalizedError(

                    apiError,

                    `Admin Models API gagal (${response.status}).`,

                    apiError.code ||
                    `MODEL_API_HTTP_${response.status}`

                );


            normalized.status =
                response.status;


            normalized.response =
                result;


            throw normalized;

        }


        /*
         * API ERROR dengan HTTP 200.
         */

        if (
            result?.success ===
                false
        ) {

            const normalized =
                createNormalizedError(

                    result,

                    "Admin Models API gagal.",

                    result.code ||
                    "MODEL_API_FAILED"

                );


            normalized.status =
                response.status;


            normalized.response =
                result;


            throw normalized;

        }


        return result;

    }


    /* =====================================================
       HELPERS
       ===================================================== */

    function normalizeId(
        value
    ) {

        if (
            value === null ||
            value === undefined
        ) {

            return "";

        }


        return String(
            value
        ).trim();

    }


    function normalizeText(
        value
    ) {

        if (
            value === null ||
            value === undefined
        ) {

            return "";

        }


        return String(
            value
        ).trim();

    }


    function hasOwn(
        object,
        key
    ) {

        return (
            object &&
            Object.prototype.hasOwnProperty.call(
                object,
                key
            )
        );

    }


    function toNumber(
        value,
        fallback = 0
    ) {

        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {

            return fallback;

        }


        const number =
            Number(
                value
            );


        return Number.isFinite(
            number
        )
            ? number
            : fallback;

    }


    function normalizeArray(
        value
    ) {

        if (
            Array.isArray(
                value
            )
        ) {

            return value
                .map(
                    item =>
                        normalizeText(
                            item
                        )
                )
                .filter(
                    Boolean
                );

        }


        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {

            return [];

        }


        if (
            typeof value ===
                "string"
        ) {

            const text =
                value.trim();


            if (
                !text
            ) {

                return [];

            }


            /*
             * PostgreSQL ARRAY
             */

            if (
                text.startsWith(
                    "{"
                ) &&
                text.endsWith(
                    "}"
                )
            ) {

                return text
                    .slice(
                        1,
                        -1
                    )
                    .split(
                        ","
                    )
                    .map(
                        item =>
                            item
                                .trim()
                                .replace(
                                    /^"(.*)"$/,
                                    "$1"
                                )
                    )
                    .filter(
                        Boolean
                    );

            }


            /*
             * JSON ARRAY
             */

            if (
                text.startsWith(
                    "["
                ) &&
                text.endsWith(
                    "]"
                )
            ) {

                try {

                    const parsed =
                        JSON.parse(
                            text
                        );


                    if (
                        Array.isArray(
                            parsed
                        )
                    ) {

                        return parsed
                            .map(
                                item =>
                                    normalizeText(
                                        item
                                    )
                            )
                            .filter(
                                Boolean
                            );

                    }

                } catch (
                    _
                ) {}

            }


            /*
             * Comma separated.
             */

            return text
                .split(
                    ","
                )
                .map(
                    item =>
                        item.trim()
                )
                .filter(
                    Boolean
                );

        }


        return [];

    }


    /* =====================================================
       DATABASE MODEL ID
       ===================================================== */

    function getModelDatabaseId(
        model
    ) {

        if (
            model === null ||
            model === undefined
        ) {

            return "";

        }


        if (
            typeof model !==
                "object"
        ) {

            return normalizeId(
                model
            );

        }


        return normalizeId(

            model.id ??

            model.model_id_record ??

            model.modelIdRecord ??

            model.database_id ??

            model.databaseId

        );

    }


    function getModelCode(
        model
    ) {

        if (
            !model ||
            typeof model !==
                "object"
        ) {

            return "";

        }


        return normalizeText(

            model.model_id ??

            model.modelId

        );

    }


    /* =====================================================
       CREATE PAYLOAD
       ===================================================== */

    function normalizeCreatePayload(
        data
    ) {

        const source =
            data &&
            typeof data ===
                "object"
                ? data
                : {};


        const providerId =
            normalizeId(

                source.provider_id ??

                source.providerId

            );


        const modelId =
            normalizeText(

                source.model_id ??

                source.modelId

            );


        const modelName =
            normalizeText(

                source.model_name ??

                source.modelName

            );


        const description =
            normalizeText(
                source.description
            );


        const discountPercent =
            toNumber(

                source.discount_percent ??

                source.discountPercent,

                0

            );


        const credit480p =
            toNumber(

                source.credit_480p ??

                source.credit480p,

                0

            );


        const credit720p =
            toNumber(

                source.credit_720p ??

                source.credit720p,

                0

            );


        const credit1080p =
            toNumber(

                source.credit_1080p ??

                source.credit1080p,

                0

            );


        const minDuration =
            toNumber(

                source.min_duration ??

                source.minDuration,

                0

            );


        const maxDuration =
            toNumber(

                source.max_duration ??

                source.maxDuration,

                minDuration

            );


        const supportedRatios =
            normalizeArray(

                source.supported_ratios ??

                source.supportedRatios

            );


        const supportedResolutions =
            normalizeArray(

                source.supported_resolutions ??

                source.supportedResolutions

            );


        const status =
            normalizeText(

                source.status ||
                "active"

            ).toLowerCase();


        return {

            provider_id:
                providerId,

            model_id:
                modelId,

            model_name:
                modelName,

            description:
                description,

            status:
                status,

            discount_percent:
                discountPercent,

            credit_480p:
                credit480p,

            credit_720p:
                credit720p,

            credit_1080p:
                credit1080p,

            min_duration:
                minDuration,

            max_duration:
                maxDuration,

            supported_ratios:
                supportedRatios,

            supported_resolutions:
                supportedResolutions

        };

    }


    /* =====================================================
       UPDATE PAYLOAD
       ===================================================== */

    function normalizeUpdatePayload(
        data
    ) {

        const source =
            data &&
            typeof data ===
                "object"
                ? data
                : {};


        const payload = {};


        if (
            hasOwn(
                source,
                "provider_id"
            ) ||
            hasOwn(
                source,
                "providerId"
            )
        ) {

            payload.provider_id =
                normalizeId(

                    source.provider_id ??

                    source.providerId

                );

        }


        if (
            hasOwn(
                source,
                "model_id"
            ) ||
            hasOwn(
                source,
                "modelId"
            )
        ) {

            payload.model_id =
                normalizeText(

                    source.model_id ??

                    source.modelId

                );

        }


        if (
            hasOwn(
                source,
                "model_name"
            ) ||
            hasOwn(
                source,
                "modelName"
            )
        ) {

            payload.model_name =
                normalizeText(

                    source.model_name ??

                    source.modelName

                );

        }


        if (
            hasOwn(
                source,
                "description"
            )
        ) {

            payload.description =
                normalizeText(
                    source.description
                );

        }


        if (
            hasOwn(
                source,
                "status"
            )
        ) {

            payload.status =
                normalizeText(
                    source.status
                ).toLowerCase();

        }


        if (
            hasOwn(
                source,
                "discount_percent"
            ) ||
            hasOwn(
                source,
                "discountPercent"
            )
        ) {

            payload.discount_percent =
                toNumber(

                    source.discount_percent ??

                    source.discountPercent,

                    0

                );

        }


        if (
            hasOwn(
                source,
                "credit_480p"
            ) ||
            hasOwn(
                source,
                "credit480p"
            )
        ) {

            payload.credit_480p =
                toNumber(

                    source.credit_480p ??

                    source.credit480p,

                    0

                );

        }


        if (
            hasOwn(
                source,
                "credit_720p"
            ) ||
            hasOwn(
                source,
                "credit720p"
            )
        ) {

            payload.credit_720p =
                toNumber(

                    source.credit_720p ??

                    source.credit720p,

                    0

                );

        }


        if (
            hasOwn(
                source,
                "credit_1080p"
            ) ||
            hasOwn(
                source,
                "credit1080p"
            )
        ) {

            payload.credit_1080p =
                toNumber(

                    source.credit_1080p ??

                    source.credit1080p,

                    0

                );

        }


        if (
            hasOwn(
                source,
                "min_duration"
            ) ||
            hasOwn(
                source,
                "minDuration"
            )
        ) {

            payload.min_duration =
                toNumber(

                    source.min_duration ??

                    source.minDuration,

                    0

                );

        }


        if (
            hasOwn(
                source,
                "max_duration"
            ) ||
            hasOwn(
                source,
                "maxDuration"
            )
        ) {

            payload.max_duration =
                toNumber(

                    source.max_duration ??

                    source.maxDuration,

                    0

                );

        }


        if (
            hasOwn(
                source,
                "supported_ratios"
            ) ||
            hasOwn(
                source,
                "supportedRatios"
            )
        ) {

            payload.supported_ratios =
                normalizeArray(

                    source.supported_ratios ??

                    source.supportedRatios

                );

        }


        if (
            hasOwn(
                source,
                "supported_resolutions"
            ) ||
            hasOwn(
                source,
                "supportedResolutions"
            )
        ) {

            payload.supported_resolutions =
                normalizeArray(

                    source.supported_resolutions ??

                    source.supportedResolutions

                );

        }


        return payload;

    }


    /* =====================================================
       VALIDATE CREATE
       ===================================================== */

    function validateCreatePayload(
        payload
    ) {

        const errors = [];


        if (
            !payload.provider_id
        ) {

            errors.push(
                "provider_id wajib diisi."
            );

        }


        if (
            !payload.model_id
        ) {

            errors.push(
                "model_id wajib diisi."
            );

        }


        if (
            !payload.model_name
        ) {

            errors.push(
                "model_name wajib diisi."
            );

        }


        if (
            payload.discount_percent < 0 ||
            payload.discount_percent > 100
        ) {

            errors.push(
                "discount_percent harus berada di antara 0 dan 100."
            );

        }


        if (
            payload.credit_480p < 0 ||
            payload.credit_720p < 0 ||
            payload.credit_1080p < 0
        ) {

            errors.push(
                "Credit tidak boleh bernilai negatif."
            );

        }


        if (
            payload.min_duration < 0 ||
            payload.max_duration < 0
        ) {

            errors.push(
                "Duration tidak boleh bernilai negatif."
            );

        }


        if (
            payload.max_duration <
            payload.min_duration
        ) {

            errors.push(
                "max_duration tidak boleh lebih kecil dari min_duration."
            );

        }


        return errors;

    }


    /* =====================================================
       VALIDATE UPDATE
       ===================================================== */

    function validateUpdatePayload(
        databaseId,
        payload
    ) {

        const errors = [];


        if (
            !databaseId
        ) {

            errors.push(
                "ID database model wajib diisi."
            );

        }


        if (
            hasOwn(
                payload,
                "provider_id"
            ) &&
            !payload.provider_id
        ) {

            errors.push(
                "provider_id tidak boleh kosong."
            );

        }


        if (
            hasOwn(
                payload,
                "model_id"
            ) &&
            !payload.model_id
        ) {

            errors.push(
                "model_id tidak boleh kosong."
            );

        }


        if (
            hasOwn(
                payload,
                "model_name"
            ) &&
            !payload.model_name
        ) {

            errors.push(
                "model_name tidak boleh kosong."
            );

        }


        if (
            hasOwn(
                payload,
                "discount_percent"
            ) &&
            (
                payload.discount_percent < 0 ||
                payload.discount_percent > 100
            )
        ) {

            errors.push(
                "discount_percent harus berada di antara 0 dan 100."
            );

        }


        if (
            hasOwn(
                payload,
                "credit_480p"
            ) &&
            payload.credit_480p < 0
        ) {

            errors.push(
                "credit_480p tidak boleh negatif."
            );

        }


        if (
            hasOwn(
                payload,
                "credit_720p"
            ) &&
            payload.credit_720p < 0
        ) {

            errors.push(
                "credit_720p tidak boleh negatif."
            );

        }


        if (
            hasOwn(
                payload,
                "credit_1080p"
            ) &&
            payload.credit_1080p < 0
        ) {

            errors.push(
                "credit_1080p tidak boleh negatif."
            );

        }


        if (
            hasOwn(
                payload,
                "min_duration"
            ) &&
            payload.min_duration < 0
        ) {

            errors.push(
                "min_duration tidak boleh negatif."
            );

        }


        if (
            hasOwn(
                payload,
                "max_duration"
            ) &&
            payload.max_duration < 0
        ) {

            errors.push(
                "max_duration tidak boleh negatif."
            );

        }


        if (
            hasOwn(
                payload,
                "min_duration"
            ) &&
            hasOwn(
                payload,
                "max_duration"
            ) &&
            payload.max_duration <
            payload.min_duration
        ) {

            errors.push(
                "max_duration tidak boleh lebih kecil dari min_duration."
            );

        }


        return errors;

    }


    /* =====================================================
       CREATE
       ===================================================== */

    async function create(
        data
    ) {

        const payload =
            normalizeCreatePayload(
                data
            );


        const errors =
            validateCreatePayload(
                payload
            );


        if (
            errors.length
        ) {

            const error =
                new Error(
                    errors.join(
                        " "
                    )
                );


            error.code =
                "MODEL_CREATE_VALIDATION_ERROR";


            error.errors =
                errors;


            throw error;

        }


        let response;


        try {

            response =
                await requestAdminModelsAPI(
                    "POST",
                    payload
                );

        } catch (
            error
        ) {

            throw createNormalizedError(

                error,

                "Gagal membuat model.",

                error?.code ||
                "MODEL_CREATE_FAILED"

            );

        }


        const model =
            response?.model ||
            response?.data ||
            null;


        if (
            !model
        ) {

            const error =
                new Error(
                    "Model berhasil diproses tetapi data hasil CREATE kosong."
                );


            error.code =
                "MODEL_CREATE_EMPTY_RESULT";


            error.response =
                response;


            throw error;

        }


        return {

            success:
                true,

            operation:
                "create",

            model:
                model,

            data:
                model

        };

    }


    /* =====================================================
       UPDATE
       ===================================================== */

    async function update(
        modelOrId,
        data = null
    ) {

        let databaseId =
            getModelDatabaseId(
                modelOrId
            );


        let source =
            data;


        if (
            !source &&
            modelOrId &&
            typeof modelOrId ===
                "object"
        ) {

            source =
                modelOrId;

        }


        if (
            !databaseId &&
            source &&
            typeof source ===
                "object"
        ) {

            databaseId =
                getModelDatabaseId(
                    source
                );

        }


        const payload =
            normalizeUpdatePayload(
                source
            );


        const errors =
            validateUpdatePayload(
                databaseId,
                payload
            );


        if (
            errors.length
        ) {

            const error =
                new Error(
                    errors.join(
                        " "
                    )
                );


            error.code =
                "MODEL_UPDATE_VALIDATION_ERROR";


            error.errors =
                errors;


            throw error;

        }


        if (
            Object.keys(
                payload
            ).length === 0
        ) {

            const error =
                new Error(
                    "Tidak ada perubahan model yang dikirim."
                );


            error.code =
                "MODEL_UPDATE_EMPTY_PAYLOAD";


            throw error;

        }


        const requestBody = {

            ...payload,

            id:
                databaseId

        };


        let response;


        try {

            response =
                await requestAdminModelsAPI(
                    "PATCH",
                    requestBody
                );

        } catch (
            error
        ) {

            throw createNormalizedError(

                error,

                "Gagal memperbarui model.",

                error?.code ||
                "MODEL_UPDATE_FAILED"

            );

        }


        const model =
            response?.model ||
            response?.data ||
            null;


        if (
            !model
        ) {

            const error =
                new Error(
                    "Model berhasil diproses tetapi data hasil UPDATE kosong."
                );


            error.code =
                "MODEL_UPDATE_EMPTY_RESULT";


            error.response =
                response;


            throw error;

        }


        return {

            success:
                true,

            operation:
                "update",

            model:
                model,

            data:
                model

        };

    }


    /* =====================================================
       DELETE
       ===================================================== */

    async function remove(
        modelOrId
    ) {

        const databaseId =
            getModelDatabaseId(
                modelOrId
            );


        if (
            !databaseId
        ) {

            const error =
                new Error(
                    "ID database model wajib diisi."
                );


            error.code =
                "MODEL_DELETE_ID_MISSING";


            throw error;

        }


        let response;


        try {

            response =
                await requestAdminModelsAPI(

                    "DELETE",

                    {
                        id:
                            databaseId
                    },

                    {
                        id:
                            databaseId
                    }

                );

        } catch (
            error
        ) {

            throw createNormalizedError(

                error,

                "Gagal menghapus model.",

                error?.code ||
                "MODEL_DELETE_FAILED"

            );

        }


        const model =
            response?.model ||
            response?.data ||
            null;


        return {

            success:
                true,

            operation:
                "delete",

            model:
                model,

            modelId:
                databaseId

        };

    }


    /* =====================================================
       DELETE BY ID
       ===================================================== */

    async function removeById(
        modelId
    ) {

        return await remove(
            modelId
        );

    }


    /* =====================================================
       INITIALIZE
       ===================================================== */

    function initialize() {

        initialized =
            true;


        return true;

    }


    /* =====================================================
       STATE
       ===================================================== */

    function getState() {

        return {

            initialized:
                initialized,

            table:
                MODEL_TABLE,

            api:
                ADMIN_MODELS_API

        };

    }


    /* =====================================================
       PUBLIC API
       ===================================================== */

    const API =
        Object.freeze({

            MODEL_TABLE,

            ADMIN_MODELS_API,

            initialize,

            getState,

            getSupabaseClient,

            requireSupabase,

            getAccessToken,

            normalizeErrorMessage,

            createNormalizedError,

            requestAdminModelsAPI,

            normalizeCreatePayload,

            normalizeUpdatePayload,

            validateCreatePayload,

            validateUpdatePayload,

            create,

            update,

            remove,

            removeById

        });


    /* =====================================================
       GLOBAL
       ===================================================== */

    window.GENZModelsCRUD =
        API;


    /*
     * Compatibility alias.
     */

    window.GENZModelCRUD =
        API;


    console.log(
        "[GEN-Z.AI] Models CRUD loaded."
    );


})();
