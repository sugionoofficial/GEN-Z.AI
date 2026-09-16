// ========================================
// GEN-Z.AI
// KIE.AI DYNAMIC CONFIGURATION API
// File: api/kie-config.js
// ========================================
//
// GET /api/kie-config
//
// Query:
//   ?model_id=kling-3.0/video
//   ?workflow_id=<uuid>
//   ?variant_id=<uuid>
//
// Fungsi:
// - Membaca model KIE dari Supabase
// - Membaca workflow
// - Membaca variant
// - Membaca parameter
// - Membaca constraint
// - Membaca dependency
// - Membaca pricing
//
// Sumber konfigurasi:
// Supabase:
//   kie_models
//   kie_workflows
//   kie_workflow_variants
//   kie_parameters
//   kie_constraints
//   kie_dependencies
//   kie_pricing
//
// Tidak ada konfigurasi model yang di-hardcode.
// ========================================


// ========================================
// RESPONSE HELPER
// ========================================

const json = (res, status, data) => {

    return res
        .status(status)
        .json(data);

};


// ========================================
// HEADER HELPER
// ========================================

const getHeader = (req, name) => {

    const headers =
        req.headers || {};

    return (
        headers[name] ||
        headers[name.toLowerCase()] ||
        ""
    );

};


// ========================================
// SUPABASE CONFIG
// ========================================

const getSupabaseConfig = () => {

    const url =
        process.env.SUPABASE_URL;

    const serviceRoleKey =
        process.env.SUPABASE_SERVICE_ROLE_KEY;

    const anonKey =
        process.env.SUPABASE_ANON_KEY ||
        process.env.SUPABASE_KEY ||
        serviceRoleKey;

    return {

        url:
            url
                ? String(url).replace(/\/+$/, "")
                : "",

        serviceRoleKey:
            serviceRoleKey || "",

        anonKey:
            anonKey || ""

    };

};


// ========================================
// SUPABASE REQUEST
// ========================================

const supabaseRequest = async (
    config,
    path,
    options = {}
) => {

    if (!config.url) {

        throw new Error(
            "SUPABASE_URL belum dikonfigurasi."
        );

    }

    const response =
        await fetch(
            `${config.url}${path}`,
            options
        );

    const text =
        await response.text();

    let data = null;

    if (text) {

        try {

            data =
                JSON.parse(text);

        } catch {

            data = {
                raw: text
            };

        }

    }

    return {

        response,

        data

    };

};


// ========================================
// SUPABASE ERROR
// ========================================

const getSupabaseError = (
    data,
    fallback
) => {

    if (!data) {

        return fallback;

    }

    return (

        data.message ||

        data.error_description ||

        data.error ||

        data.details ||

        data.hint ||

        data.msg ||

        fallback

    );

};


// ========================================
// BUILD SERVICE HEADERS
// ========================================

const getServiceHeaders = (
    config
) => {

    return {

        "apikey":
            config.serviceRoleKey,

        "Authorization":
            `Bearer ${config.serviceRoleKey}`,

        "Content-Type":
            "application/json",

        "Accept":
            "application/json"

    };

};


// ========================================
// VERIFY USER SESSION
// ========================================

const verifyUser = async (
    req,
    config
) => {

    const authorization =
        getHeader(
            req,
            "authorization"
        );

    if (!authorization) {

        return {

            ok: false,

            status: 401,

            error:
                "Session tidak ditemukan. Silakan login kembali."

        };

    }


    const tokenMatch =
        String(
            authorization
        ).match(
            /^Bearer\s+(.+)$/i
        );


    if (!tokenMatch) {

        return {

            ok: false,

            status: 401,

            error:
                "Authorization token tidak valid."

        };

    }


    if (
        !config.url ||
        !config.anonKey
    ) {

        return {

            ok: false,

            status: 500,

            error:
                "Konfigurasi Supabase server belum lengkap."

        };

    }


    const token =
        tokenMatch[1].trim();


    const result =
        await supabaseRequest(

            config,

            "/auth/v1/user",

            {

                method: "GET",

                headers: {

                    "apikey":
                        config.anonKey,

                    "Authorization":
                        `Bearer ${token}`

                }

            }

        );


    if (
        !result.response.ok ||
        !result.data?.id
    ) {

        return {

            ok: false,

            status: 401,

            error:
                "Session Supabase tidak valid atau sudah kedaluwarsa."

        };

    }


    return {

        ok: true,

        userId:
            result.data.id,

        user:
            result.data

    };

};


// ========================================
// URL ENCODE FILTER
// ========================================

const eqFilter = (
    value
) => {

    return `eq.${encodeURIComponent(value)}`;

};


// ========================================
// LOAD MODELS
// ========================================

const loadModels = async (
    config,
    modelId
) => {

    let path =
        "/rest/v1/kie_models" +
        "?select=" +
        "id,provider,model_family,model_id," +
        "model_name,status,documentation_url,metadata," +
        "created_at,updated_at" +
        "&status=eq.ACTIVE" +
        "&order=model_name.asc";


    if (modelId) {

        path +=
            `&model_id=${eqFilter(modelId)}`;

    }


    const result =
        await supabaseRequest(

            config,

            path,

            {

                method: "GET",

                headers:
                    getServiceHeaders(
                        config
                    )

            }

        );


    if (!result.response.ok) {

        throw new Error(
            getSupabaseError(
                result.data,
                "Gagal membaca kie_models."
            )
        );

    }


    return Array.isArray(
        result.data
    )
        ? result.data
        : [];

};


// ========================================
// LOAD WORKFLOWS
// ========================================

const loadWorkflows = async (
    config,
    modelUuid,
    workflowId
) => {

    let path =
        "/rest/v1/kie_workflows" +
        "?select=" +
        "id,model_id,workflow_key," +
        "workflow_type,operation,variant," +
        "status,metadata,created_at,updated_at" +
        "&status=eq.ACTIVE" +
        "&order=workflow_key.asc";


    // modelUuid dapat berupa:
    // - satu UUID
    // - array UUID
    //
    // Handler mengirim models.map(model => model.id),
    // sehingga ketika lebih dari satu model aktif,
    // filter harus menggunakan PostgREST `in`,
    // bukan `eq`.

    if (Array.isArray(modelUuid)) {

        const validModelUuids =
            modelUuid
                .map(
                    value =>
                        String(value).trim()
                )
                .filter(
                    Boolean
                );

        if (validModelUuids.length) {

            const values =
                validModelUuids
                    .map(
                        id =>
                            `"${id.replace(/"/g, '\\"')}"`
                    )
                    .join(",");

            path +=
                `&model_id=in.(${encodeURIComponent(values)})`;

        }

    } else if (modelUuid) {

        path +=
            `&model_id=${eqFilter(modelUuid)}`;

    }


    if (workflowId) {

        path +=
            `&id=${eqFilter(workflowId)}`;

    }


    const result =
        await supabaseRequest(

            config,

            path,

            {

                method: "GET",

                headers:
                    getServiceHeaders(
                        config
                    )

            }

        );


    if (!result.response.ok) {

        throw new Error(
            getSupabaseError(
                result.data,
                "Gagal membaca kie_workflows."
            )
        );

    }


    return Array.isArray(
        result.data
    )
        ? result.data
        : [];

};


// ========================================
// LOAD VARIANTS
// ========================================

const loadVariants = async (
    config,
    workflowIds,
    variantId
) => {

    if (
        !workflowIds.length &&
        !variantId
    ) {

        return [];

    }


    let path =
        "/rest/v1/kie_workflow_variants" +
        "?select=" +
        "id,workflow_id,variant_key,label," +
        "status,conditions,metadata," +
        "created_at,updated_at" +
        "&status=eq.ACTIVE" +
        "&order=variant_key.asc";


    if (variantId) {

        path +=
            `&id=${eqFilter(variantId)}`;

    } else {

        const values =
            workflowIds
                .map(
                    id =>
                        `"${id}"`
                )
                .join(",");

        path +=
            `&workflow_id=in.(${encodeURIComponent(values)})`;

    }


    const result =
        await supabaseRequest(

            config,

            path,

            {

                method: "GET",

                headers:
                    getServiceHeaders(
                        config
                    )

            }

        );


    if (!result.response.ok) {

        throw new Error(
            getSupabaseError(
                result.data,
                "Gagal membaca kie_workflow_variants."
            )
        );

    }


    return Array.isArray(
        result.data
    )
        ? result.data
        : [];

};


// ========================================
// LOAD PARAMETERS
// ========================================

const loadParameters = async (
    config,
    workflowIds,
    variantIds
) => {

    if (
        !workflowIds.length
    ) {

        return [];

    }


    const values =
        workflowIds
            .map(
                id =>
                    `"${id}"`
            )
            .join(",");


    let path =
        "/rest/v1/kie_parameters" +
        "?select=" +
        "id,workflow_id,variant_id," +
        "parameter_name,label,type,required," +
        "default_value,enum_values,min_value,max_value," +
        "min_items,max_items,item_type,description," +
        "api_mapping,metadata,created_at,updated_at" +
        "&workflow_id=in." +
        `(${encodeURIComponent(values)})`;


    const result =
        await supabaseRequest(

            config,

            path,

            {

                method: "GET",

                headers:
                    getServiceHeaders(
                        config
                    )

            }

        );


    if (!result.response.ok) {

        throw new Error(
            getSupabaseError(
                result.data,
                "Gagal membaca kie_parameters."
            )
        );

    }


    let parameters =
        Array.isArray(
            result.data
        )
            ? result.data
            : [];


    if (
        variantIds.length
    ) {

        const variantSet =
            new Set(
                variantIds
            );

        parameters =
            parameters.filter(
                parameter => {

                    if (
                        parameter.variant_id === null
                    ) {

                        return true;

                    }

                    return variantSet.has(
                        parameter.variant_id
                    );

                }
            );

    }


    return parameters;

};


// ========================================
// LOAD CONSTRAINTS
// ========================================

const loadConstraints = async (
    config,
    workflowIds,
    variantIds
) => {

    if (
        !workflowIds.length
    ) {

        return [];

    }


    const values =
        workflowIds
            .map(
                id =>
                    `"${id}"`
            )
            .join(",");


    let path =
        "/rest/v1/kie_constraints" +
        "?select=" +
        "id,workflow_id,variant_id," +
        "constraint_type,source_parameter," +
        "target_parameter,operator,value," +
        "expression,error_message,metadata," +
        "created_at" +
        "&workflow_id=in." +
        `(${encodeURIComponent(values)})`;


    const result =
        await supabaseRequest(

            config,

            path,

            {

                method: "GET",

                headers:
                    getServiceHeaders(
                        config
                    )

            }

        );


    if (!result.response.ok) {

        throw new Error(
            getSupabaseError(
                result.data,
                "Gagal membaca kie_constraints."
            )
        );

    }


    let constraints =
        Array.isArray(
            result.data
        )
            ? result.data
            : [];


    if (
        variantIds.length
    ) {

        const variantSet =
            new Set(
                variantIds
            );

        constraints =
            constraints.filter(
                constraint => {

                    if (
                        constraint.variant_id === null
                    ) {

                        return true;

                    }

                    return variantSet.has(
                        constraint.variant_id
                    );

                }
            );

    }


    return constraints;

};


// ========================================
// LOAD DEPENDENCIES
// ========================================

const loadDependencies = async (
    config,
    workflowIds,
    variantIds
) => {

    if (
        !workflowIds.length
    ) {

        return [];

    }


    const values =
        workflowIds
            .map(
                id =>
                    `"${id}"`
            )
            .join(",");


    const path =
        "/rest/v1/kie_dependencies" +
        "?select=" +
        "id,workflow_id,variant_id," +
        "dependency_type,source_parameter," +
        "target_parameter,rule,created_at" +
        "&workflow_id=in." +
        `(${encodeURIComponent(values)})`;


    const result =
        await supabaseRequest(

            config,

            path,

            {

                method: "GET",

                headers:
                    getServiceHeaders(
                        config
                    )

            }

        );


    if (!result.response.ok) {

        throw new Error(
            getSupabaseError(
                result.data,
                "Gagal membaca kie_dependencies."
            )
        );

    }


    let dependencies =
        Array.isArray(
            result.data
        )
            ? result.data
            : [];


    if (
        variantIds.length
    ) {

        const variantSet =
            new Set(
                variantIds
            );

        dependencies =
            dependencies.filter(
                dependency => {

                    if (
                        dependency.variant_id === null
                    ) {

                        return true;

                    }

                    return variantSet.has(
                        dependency.variant_id
                    );

                }
            );

    }


    return dependencies;

};


// ========================================
// LOAD PRICING
// ========================================

const loadPricing = async (
    config,
    workflowIds,
    variantIds
) => {

    let path =
        "/rest/v1/kie_pricing" +
        "?select=" +
        "id,workflow_id,variant_id," +
        "operation,sku_key,billing_unit," +
        "unit_price,currency,conditions," +
        "pricing_context,source_type,source_url," +
        "source_reference,pricing_status," +
        "effective_at,expires_at,status," +
        "created_at,updated_at" +
        "&status=eq.ACTIVE" +
        "&pricing_status=eq.VERIFIED" +
        "&order=sku_key.asc";


    const result =
        await supabaseRequest(

            config,

            path,

            {

                method: "GET",

                headers:
                    getServiceHeaders(
                        config
                    )

            }

        );


    if (!result.response.ok) {

        throw new Error(
            getSupabaseError(
                result.data,
                "Gagal membaca kie_pricing."
            )
        );

    }


    let pricing =
        Array.isArray(
            result.data
        )
            ? result.data
            : [];


    const workflowSet =
        new Set(
            workflowIds
        );

    const variantSet =
        new Set(
            variantIds
        );


    pricing =
        pricing.filter(
            item => {

                const workflowMatch =
                    item.workflow_id === null ||
                    workflowSet.has(
                        item.workflow_id
                    );

                const variantMatch =
                    item.variant_id === null ||
                    variantSet.has(
                        item.variant_id
                    );

                return (
                    workflowMatch &&
                    variantMatch
                );

            }
        );


    return pricing;

};


// ========================================
// HANDLER
// ========================================

export default async function handler(
    req,
    res
) {

    // ====================================
    // METHOD
    // ====================================

    if (
        req.method !== "GET"
    ) {

        return json(
            res,
            405,
            {

                success: false,

                error:
                    "Method tidak diizinkan."

            }
        );

    }


    try {

        // =================================
        // SUPABASE CONFIG
        // =================================

        const config =
            getSupabaseConfig();


        if (
            !config.url ||
            !config.serviceRoleKey
        ) {

            return json(
                res,
                500,
                {

                    success: false,

                    error:
                        "SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi."

                }
            );

        }


        // =================================
        // VERIFY SESSION
        // =================================

        const auth =
            await verifyUser(
                req,
                config
            );


        if (
            !auth.ok
        ) {

            return json(
                res,
                auth.status,
                {

                    success: false,

                    error:
                        auth.error

                }
            );

        }


        // =================================
        // QUERY
        // =================================

        const query =
            req.query || {};


        const modelId =
            query.model_id
                ? String(
                    query.model_id
                ).trim()
                : "";


        const workflowId =
            query.workflow_id
                ? String(
                    query.workflow_id
                ).trim()
                : "";


        const variantId =
            query.variant_id
                ? String(
                    query.variant_id
                ).trim()
                : "";


        // =================================
        // LOAD MODELS
        // =================================

        const models =
            await loadModels(
                config,
                modelId
            );


        // =================================
        // MODEL NOT FOUND
        // =================================

        if (
            modelId &&
            !models.length
        ) {

            return json(
                res,
                404,
                {

                    success: false,

                    error:
                        "Model KIE tidak ditemukan atau tidak aktif.",

                    model_id:
                        modelId

                }
            );

        }


        // =================================
        // LOAD WORKFLOWS
        // =================================

        const modelUuids =
            models.map(
                model =>
                    model.id
            );


        let workflows =
            await loadWorkflows(
                config,
                modelUuids,
                workflowId
            );


        // =================================
        // WORKFLOW FILTER
        // =================================

        if (
            workflowId &&
            !workflows.length
        ) {

            return json(
                res,
                404,
                {

                    success: false,

                    error:
                        "Workflow KIE tidak ditemukan atau tidak aktif.",

                    workflow_id:
                        workflowId

                }
            );

        }


        // =================================
        // LOAD VARIANTS
        // =================================

        const workflowIds =
            workflows.map(
                workflow =>
                    workflow.id
            );


        const variants =
            await loadVariants(
                config,
                workflowIds,
                variantId
            );


        // =================================
        // VARIANT FILTER
        // =================================

        if (
            variantId &&
            !variants.length
        ) {

            return json(
                res,
                404,
                {

                    success: false,

                    error:
                        "Variant KIE tidak ditemukan atau tidak aktif.",

                    variant_id:
                        variantId

                }
            );

        }


        // =================================
        // VARIANT IDS
        // =================================

        const variantIds =
            variants.map(
                variant =>
                    variant.id
            );


        // =================================
        // LOAD ALL CONFIG
        // =================================

        const [

            parameters,

            constraints,

            dependencies,

            pricing

        ] = await Promise.all([

            loadParameters(
                config,
                workflowIds,
                variantIds
            ),

            loadConstraints(
                config,
                workflowIds,
                variantIds
            ),

            loadDependencies(
                config,
                workflowIds,
                variantIds
            ),

            loadPricing(
                config,
                workflowIds,
                variantIds
            )

        ]);


        // =================================
        // RESPONSE
        // =================================

        return json(
            res,
            200,
            {

                success: true,

                provider: {

                    provider_id:
                        "kie_ai",

                    provider_name:
                        "KIE.AI"

                },

                models,

                workflows,

                variants,

                parameters,

                constraints,

                dependencies,

                pricing,

                meta: {

                    model_count:
                        models.length,

                    workflow_count:
                        workflows.length,

                    variant_count:
                        variants.length,

                    parameter_count:
                        parameters.length,

                    constraint_count:
                        constraints.length,

                    dependency_count:
                        dependencies.length,

                    pricing_count:
                        pricing.length

                }

            }
        );


    } catch (error) {

        console.error(
            "GEN-Z.AI KIE CONFIG ERROR:",
            error
        );


        return json(
            res,
            500,
            {

                success: false,

                error:
                    "Gagal membaca konfigurasi KIE dari Supabase.",

                detail:
                    process.env.NODE_ENV === "development"
                        ? error.message
                        : undefined

            }
        );

    }

}
