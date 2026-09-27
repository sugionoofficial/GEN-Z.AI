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
 * - INSERT model ke Supabase
 * - UPDATE model di Supabase
 * - DELETE model dari Supabase
 *
 * TIDAK BERTANGGUNG JAWAB
 * - Render UI
 * - Form validation UI
 * - Pricing calculation
 * - Cache
 * - Search
 * - Table rendering
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

    const MODEL_TABLE = "models";


    /* =====================================================
       STATE
    ===================================================== */

    let initialized = false;


    /* =====================================================
       SUPABASE
    ===================================================== */

    function getSupabaseClient() {

        if (
            typeof window !== "undefined" &&
            window.GENZ_SUPABASE &&
            typeof window.GENZ_SUPABASE.from === "function"
        ) {
            return window.GENZ_SUPABASE;
        }


        if (
            typeof window !== "undefined" &&
            window.supabaseClient &&
            typeof window.supabaseClient.from === "function"
        ) {
            return window.supabaseClient;
        }


        if (
            typeof window !== "undefined" &&
            window.supabase &&
            typeof window.supabase.from === "function"
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
       HELPERS
    ===================================================== */

    function normalizeId(value) {

        if (
            value === null ||
            value === undefined
        ) {
            return "";
        }

        return String(value).trim();

    }


    function normalizeText(value) {

        if (
            value === null ||
            value === undefined
        ) {
            return "";
        }

        return String(value).trim();

    }


    function hasOwn(object, key) {

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
            Number(value);

        return Number.isFinite(number)
            ? number
            : fallback;

    }


    function normalizeArray(value) {

        if (Array.isArray(value)) {

            return value
                .map(item =>
                    normalizeText(item)
                )
                .filter(Boolean);

        }


        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {
            return [];
        }


        if (typeof value === "string") {

            const text =
                value.trim();

            if (!text) {
                return [];
            }


            /*
             * PostgreSQL ARRAY:
             *
             * {16:9,9:16}
             */

            if (
                text.startsWith("{") &&
                text.endsWith("}")
            ) {

                return text
                    .slice(1, -1)
                    .split(",")
                    .map(item =>
                        item
                            .trim()
                            .replace(/^"(.*)"$/, "$1")
                    )
                    .filter(Boolean);

            }


            /*
             * JSON ARRAY
             */

            if (
                text.startsWith("[") &&
                text.endsWith("]")
            ) {

                try {

                    const parsed =
                        JSON.parse(text);

                    if (Array.isArray(parsed)) {

                        return parsed
                            .map(item =>
                                normalizeText(item)
                            )
                            .filter(Boolean);

                    }

                } catch (_) {
                    /* fallback below */
                }

            }


            /*
             * Comma-separated
             */

            return text
                .split(",")
                .map(item =>
                    item.trim()
                )
                .filter(Boolean);

        }


        return [];

    }


    /* =====================================================
       MODEL ID
    ===================================================== */

    function getModelDatabaseId(model) {

        if (
            model === null ||
            model === undefined
        ) {
            return "";
        }


        if (
            typeof model !== "object"
        ) {
            return normalizeId(model);
        }


        return normalizeId(
            model.id ??
            model.model_id_record ??
            model.modelIdRecord
        );

    }


    function getModelCode(model) {

        if (
            !model ||
            typeof model !== "object"
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

    function normalizeCreatePayload(data) {

        const source =
            data &&
            typeof data === "object"
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

    function normalizeUpdatePayload(data) {

        const source =
            data &&
            typeof data === "object"
                ? data
                : {};


        const payload = {};


        /*
         * Identity fields.
         *
         * Model ID dan provider biasanya dikunci
         * pada Edit Model.
         *
         * Tetap diteruskan jika caller memang
         * menyediakannya.
         */

        if (
            hasOwn(source, "provider_id") ||
            hasOwn(source, "providerId")
        ) {

            payload.provider_id =
                normalizeId(
                    source.provider_id ??
                    source.providerId
                );

        }


        if (
            hasOwn(source, "model_id") ||
            hasOwn(source, "modelId")
        ) {

            payload.model_id =
                normalizeText(
                    source.model_id ??
                    source.modelId
                );

        }


        if (
            hasOwn(source, "model_name") ||
            hasOwn(source, "modelName")
        ) {

            payload.model_name =
                normalizeText(
                    source.model_name ??
                    source.modelName
                );

        }


        if (
            hasOwn(source, "description")
        ) {

            payload.description =
                normalizeText(
                    source.description
                );

        }


        if (
            hasOwn(source, "status")
        ) {

            payload.status =
                normalizeText(
                    source.status
                ).toLowerCase();

        }


        if (
            hasOwn(source, "discount_percent") ||
            hasOwn(source, "discountPercent")
        ) {

            payload.discount_percent =
                toNumber(
                    source.discount_percent ??
                    source.discountPercent,
                    0
                );

        }


        if (
            hasOwn(source, "credit_480p") ||
            hasOwn(source, "credit480p")
        ) {

            payload.credit_480p =
                toNumber(
                    source.credit_480p ??
                    source.credit480p,
                    0
                );

        }


        if (
            hasOwn(source, "credit_720p") ||
            hasOwn(source, "credit720p")
        ) {

            payload.credit_720p =
                toNumber(
                    source.credit_720p ??
                    source.credit720p,
                    0
                );

        }


        if (
            hasOwn(source, "credit_1080p") ||
            hasOwn(source, "credit1080p")
        ) {

            payload.credit_1080p =
                toNumber(
                    source.credit_1080p ??
                    source.credit1080p,
                    0
                );

        }


        if (
            hasOwn(source, "min_duration") ||
            hasOwn(source, "minDuration")
        ) {

            payload.min_duration =
                toNumber(
                    source.min_duration ??
                    source.minDuration,
                    0
                );

        }


        if (
            hasOwn(source, "max_duration") ||
            hasOwn(source, "maxDuration")
        ) {

            payload.max_duration =
                toNumber(
                    source.max_duration ??
                    source.maxDuration,
                    0
                );

        }


        if (
            hasOwn(source, "supported_ratios") ||
            hasOwn(source, "supportedRatios")
        ) {

            payload.supported_ratios =
                normalizeArray(
                    source.supported_ratios ??
                    source.supportedRatios
                );

        }


        if (
            hasOwn(source, "supported_resolutions") ||
            hasOwn(source, "supportedResolutions")
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

    function validateCreatePayload(payload) {

        const errors = [];


        if (!payload.provider_id) {

            errors.push(
                "provider_id wajib diisi."
            );

        }


        if (!payload.model_id) {

            errors.push(
                "model_id wajib diisi."
            );

        }


        if (!payload.model_name) {

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


        if (!databaseId) {

            errors.push(
                "ID database model wajib diisi."
            );

        }


        if (
            hasOwn(payload, "provider_id") &&
            !payload.provider_id
        ) {

            errors.push(
                "provider_id tidak boleh kosong."
            );

        }


        if (
            hasOwn(payload, "model_id") &&
            !payload.model_id
        ) {

            errors.push(
                "model_id tidak boleh kosong."
            );

        }


        if (
            hasOwn(payload, "model_name") &&
            !payload.model_name
        ) {

            errors.push(
                "model_name tidak boleh kosong."
            );

        }


        if (
            hasOwn(payload, "discount_percent") &&
            (
                payload.discount_percent < 0 ||
                payload.discount_percent > 100
            )
        ) {

            errors.push(
                "discount_percent harus berada di antara 0 dan 100."
            );

        }


        return errors;

    }


    /* =====================================================
       CREATE
    ===================================================== */

    async function create(data) {

        const payload =
            normalizeCreatePayload(
                data
            );


        const errors =
            validateCreatePayload(
                payload
            );


        if (errors.length) {

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


        const supabase =
            requireSupabase();


        const response =
            await supabase
                .from(MODEL_TABLE)
                .insert(payload)
                .select("*")
                .single();


        if (response.error) {

            const error =
                new Error(
                    response.error.message ||
                    "Gagal membuat model."
                );

            error.code =
                response.error.code ||
                "MODEL_CREATE_FAILED";

            error.details =
                response.error.details;

            error.hint =
                response.error.hint;

            error.supabase =
                response.error;

            throw error;

        }


        if (!response.data) {

            const error =
                new Error(
                    "Model berhasil diproses tetapi data hasil INSERT kosong."
                );

            error.code =
                "MODEL_CREATE_EMPTY_RESULT";

            throw error;

        }


        return {

            success:
                true,

            operation:
                "create",

            model:
                response.data,

            data:
                response.data

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


        /*
         * Support:
         *
         * update(modelObject)
         */

        if (
            !source &&
            modelOrId &&
            typeof modelOrId === "object"
        ) {

            source =
                modelOrId;

        }


        /*
         * Support:
         *
         * update(id, payload)
         */

        if (
            !databaseId &&
            source &&
            typeof source === "object"
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


        if (errors.length) {

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
            Object.keys(payload).length === 0
        ) {

            const error =
                new Error(
                    "Tidak ada perubahan model yang dikirim."
                );

            error.code =
                "MODEL_UPDATE_EMPTY_PAYLOAD";

            throw error;

        }


        const supabase =
            requireSupabase();


        const response =
            await supabase
                .from(MODEL_TABLE)
                .update(payload)
                .eq("id", databaseId)
                .select("*")
                .single();


        if (response.error) {

            const error =
                new Error(
                    response.error.message ||
                    "Gagal memperbarui model."
                );

            error.code =
                response.error.code ||
                "MODEL_UPDATE_FAILED";

            error.details =
                response.error.details;

            error.hint =
                response.error.hint;

            error.supabase =
                response.error;

            throw error;

        }


        if (!response.data) {

            const error =
                new Error(
                    "Model berhasil diproses tetapi data hasil UPDATE kosong."
                );

            error.code =
                "MODEL_UPDATE_EMPTY_RESULT";

            throw error;

        }


        return {

            success:
                true,

            operation:
                "update",

            model:
                response.data,

            data:
                response.data

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


        if (!databaseId) {

            const error =
                new Error(
                    "ID database model wajib diisi."
                );

            error.code =
                "MODEL_DELETE_ID_MISSING";

            throw error;

        }


        const supabase =
            requireSupabase();


        const response =
            await supabase
                .from(MODEL_TABLE)
                .delete()
                .eq("id", databaseId)
                .select("*")
                .single();


        if (response.error) {

            const error =
                new Error(
                    response.error.message ||
                    "Gagal menghapus model."
                );

            error.code =
                response.error.code ||
                "MODEL_DELETE_FAILED";

            error.details =
                response.error.details;

            error.hint =
                response.error.hint;

            error.supabase =
                response.error;

            throw error;

        }


        return {

            success:
                true,

            operation:
                "delete",

            model:
                response.data || null,

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
                MODEL_TABLE

        };

    }


    /* =====================================================
       API
    ===================================================== */

    const API =
        Object.freeze({

            MODEL_TABLE,

            initialize,

            getState,

            getSupabaseClient,

            normalizeCreatePayload,

            normalizeUpdatePayload,

            validateCreatePayload,

            validateUpdatePayload,

            create,

            update,

            remove,

            removeById

        });


    window.GENZModelsCRUD =
        API;


    window.GENZModelCRUD =
        API;


    console.log(
        "[GEN-Z.AI] Models CRUD loaded."
    );


})();
