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
 * KEAMANAN
 * - Browser TIDAK melakukan INSERT langsung ke Supabase.
 * - Browser TIDAK melakukan UPDATE langsung ke Supabase.
 * - Browser TIDAK melakukan DELETE langsung ke Supabase.
 * - Semua perubahan model melewati:
 *
 *      /api/admin-models
 *
 * - API melakukan verifikasi:
 *      ADMIN / OWNER
 *
 * - API menggunakan Supabase Service Role
 *   secara server-side.
 *
 * SOURCE OF TRUTH
 * - Supabase table: models
 *
 * RELATION
 * - models.provider_id -> providers.id
 * =========================================================
 */

(function () {

    "use strict";


    /* =====================================================
       CONSTANT
    ===================================================== */

    const MODEL_TABLE =
        "models";


    /*
     * Endpoint HARUS absolute dari root.
     *
     * Jangan menggunakan:
     *
     *     ../api/admin-models
     *
     * karena halaman Models dapat berada pada beberapa
     * level directory berbeda.
     *
     * Endpoint repository:
     *
     *     /api/admin-models
     */

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
       AUTH SESSION
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

            const wrapped =
                new Error(
                    error?.message ||
                    "Gagal mengambil session Supabase."
                );

            wrapped.code =
                "MODEL_API_SESSION_ERROR";

            wrapped.cause =
                error;

            throw wrapped;

        }


        const sessionError =
            sessionResult?.error;


        if (
            sessionError
        ) {

            const error =
                new Error(
                    sessionError.message ||
                    "Gagal mengambil session Supabase."
                );

            error.code =
                sessionError.code ||
                "MODEL_API_SESSION_ERROR";

            error.supabase =
                sessionError;

            throw error;

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


        /*
         * Endpoint menggunakan absolute root path.
         *
         * Contoh:
         *
         * POST
         * /api/admin-models
         *
         * PATCH
         * /api/admin-models
         *
         * DELETE
         * /api/admin-models?id=...
         */

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


        /*
         * Body hanya untuk method yang
         * memang mengirim payload.
         */

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


            const wrapped =
                new Error(
                    error?.message ||
                    "Gagal menghubungi Admin Models API."
                );

            wrapped.code =
                "MODEL_API_REQUEST_FAILED";

            wrapped.cause =
                error;

            throw wrapped;

        } finally {

            clearTimeout(
                timeout
            );

        }


        /*
         * API seharusnya selalu mengembalikan
         * JSON. Tetap dibuat aman apabila response
         * bukan JSON.
         */

        let result = {};


        try {

            result =
                await response
                    .json();

        } catch (
            _
        ) {

            result = {};

        }


        /*
         * HTTP ERROR
         */

        if (
            !response.ok
        ) {

            const error =
                new Error(
                    result?.error ||
                    result?.message ||
                    `Admin Models API gagal (${response.status}).`
                );


            error.code =
                result?.code ||
                `MODEL_API_HTTP_${response.status}`;


            error.status =
                response.status;


            error.response =
                result;


            throw error;

        }


        /*
         * API dapat mengembalikan:
         *
         * {
         *     success: false,
         *     error: "..."
         * }
         *
         * walaupun HTTP status 200.
         */

        if (
            result?.success ===
                false
        ) {

            const error =
                new Error(
                    result.error ||
                    result.message ||
                    "Admin Models API gagal."
                );


            error.code =
                result.code ||
                "MODEL_API_FAILED";


            error.response =
                result;


            throw error;

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
             *
             * {16:9,9:16}
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
                ) {

                    /*
                     * Fallback ke
                     * comma-separated.
                     */

                }

            }


            /*
             * Comma-separated.
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


        /*
         * Support:
         *
         * remove("uuid")
         * update("uuid", data)
         */

        if (
            typeof model !==
            "object"
        ) {

            return normalizeId(
                model
            );

        }


        /*
         * Database primary key.
         */

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


        /*
         * Provider.
         */

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


        /*
         * Model ID.
         */

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


        /*
         * Model name.
         */

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


        /*
         * Description.
         */

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


        /*
         * Status.
         */

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


        /*
         * Discount.
         */

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


        /*
         * Credit 480p.
         */

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


        /*
         * Credit 720p.
         */

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


        /*
         * Credit 1080p.
         */

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


        /*
         * Minimum duration.
         */

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


        /*
         * Maximum duration.
         */

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


        /*
         * Ratios.
         */

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


        /*
         * Resolutions.
         */

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
       -----------------------------------------------------
       Browser
           ↓
       /api/admin-models
           ↓
       verify ADMIN / OWNER
           ↓
       Service Role
           ↓
       models
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
                    errors.join(" ")
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

            const wrapped =
                new Error(
                    error?.message ||
                    "Gagal membuat model."
                );


            wrapped.code =
                error?.code ||
                "MODEL_CREATE_FAILED";


            wrapped.status =
                error?.status;


            wrapped.response =
                error?.response;


            wrapped.cause =
                error;


            throw wrapped;

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
       -----------------------------------------------------
       Mendukung:
 *
       update(modelObject)
 *
       atau:
 *
       update(databaseId, payload)
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


        /*
         * update(modelObject)
         */

        if (
            !source &&
            modelOrId &&
            typeof modelOrId ===
                "object"
        ) {

            source =
                modelOrId;

        }


        /*
         * update(id, payload)
         */

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
                    errors.join(" ")
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


        /*
         * API menerima id di body.
         *
         * API juga mendukung req.query.id,
         * tetapi body dibuat eksplisit supaya
         * PATCH konsisten.
         */

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

            const wrapped =
                new Error(
                    error?.message ||
                    "Gagal memperbarui model."
                );


            wrapped.code =
                error?.code ||
                "MODEL_UPDATE_FAILED";


            wrapped.status =
                error?.status;


            wrapped.response =
                error?.response;


            wrapped.cause =
                error;


            throw wrapped;

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
       -----------------------------------------------------
       Mendukung:
 *
       remove("database-id")
 *
       atau:
 *
       remove(modelObject)
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

            const wrapped =
                new Error(
                    error?.message ||
                    "Gagal menghapus model."
                );


            wrapped.code =
                error?.code ||
                "MODEL_DELETE_FAILED";


            wrapped.status =
                error?.status;


            wrapped.response =
                error?.response;


            wrapped.cause =
                error;


            throw wrapped;

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
       -----------------------------------------------------
       CRUD tidak melakukan query saat initialize.
       Hanya menandai module siap digunakan.
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
       API
       ===================================================== */

    const API =
        Object.freeze({

            MODEL_TABLE,

            ADMIN_MODELS_API,

            initialize,

            getState,

            getSupabaseClient,

            getAccessToken,

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
