// ========================================
// GEN-Z.AI
// KIE.AI VIDEO GENERATION API
// File: api/generate.js
// ========================================

import crypto from "node:crypto";

import {
    createTask
} from "../provider/kie/client.js";


const SUPABASE_URL =
    process.env.SUPABASE_URL;

const SUPABASE_SERVICE_ROLE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

const PROVIDER_CREDENTIAL_ENCRYPTION_KEY =
    process.env.PROVIDER_CREDENTIAL_ENCRYPTION_KEY;


// ========================================
// JSON VALUE HELPER
// ========================================

function jsonValue(value) {

    if (
        value === null ||
        value === undefined
    ) {
        return value;
    }

    if (
        typeof value !== "string"
    ) {
        return value;
    }

    const text =
        value.trim();

    if (!text) {
        return value;
    }

    try {

        return JSON.parse(text);

    } catch {

        return value;

    }

}


// ========================================
// PROVIDER API KEY DECRYPTION
// ========================================

function decryptProviderApiKey(
    credential
) {

    if (
        !PROVIDER_CREDENTIAL_ENCRYPTION_KEY
    ) {

        throw new Error(
            "PROVIDER_CREDENTIAL_ENCRYPTION_KEY belum dikonfigurasi."
        );

    }

    const key =
        Buffer.from(
            PROVIDER_CREDENTIAL_ENCRYPTION_KEY,
            "hex"
        );

    if (
        key.length !== 32
    ) {

        throw new Error(
            "PROVIDER_CREDENTIAL_ENCRYPTION_KEY harus 32 byte."
        );

    }

    if (
        !credential ||
        !credential.api_key_ciphertext ||
        !credential.api_key_iv ||
        !credential.api_key_tag
    ) {

        throw new Error(
            "Credential provider tidak lengkap."
        );

    }

    const iv =
        Buffer.from(
            credential.api_key_iv,
            "base64"
        );

    const tag =
        Buffer.from(
            credential.api_key_tag,
            "base64"
        );

    if (
        iv.length !== 12
    ) {

        throw new Error(
            "IV credential provider tidak valid."
        );

    }

    if (
        tag.length !== 16
    ) {

        throw new Error(
            "Authentication tag credential provider tidak valid."
        );

    }

    const decipher =
        crypto.createDecipheriv(
            "aes-256-gcm",
            key,
            iv
        );

    decipher.setAuthTag(tag);

    const encrypted =
        Buffer.from(
            credential.api_key_ciphertext,
            "base64"
        );

    const decrypted =
        Buffer.concat([

            decipher.update(
                encrypted
            ),

            decipher.final()

        ]);

    const apiKey =
        decrypted.toString(
            "utf8"
        ).trim();

    if (!apiKey) {

        throw new Error(
            "API key provider hasil decrypt kosong."
        );

    }

    return apiKey;

}


// ========================================
// LOAD PROVIDER API KEY
// ========================================

async function loadProviderApiKey(
    providerId
) {

    const rows =
        await supabaseQuery(
            "provider_credentials",
            {
                select:
                    "api_key_ciphertext,api_key_iv,api_key_tag",

                provider_id:
                    `eq.${providerId}`,

                limit:
                    "1"
            }
        );

    if (
        rows.length === 0
    ) {

        throw new Error(
            `API key provider "${providerId}" belum tersimpan.`
        );

    }

    return decryptProviderApiKey(
        rows[0]
    );

}


// ========================================
// AUTHORIZATION
// ========================================

function getBearerToken(req) {

    const header =
        req.headers?.authorization ||
        "";

    if (
        !header
            .toLowerCase()
            .startsWith("bearer ")
    ) {

        return null;

    }

    return (
        header
            .slice(7)
            .trim() ||
        null
    );

}


async function getAuthenticatedUser(req) {

    const token =
        getBearerToken(req);

    if (
        !token ||
        !SUPABASE_URL ||
        !SUPABASE_SERVICE_ROLE_KEY
    ) {

        return null;

    }

    const response =
        await fetch(
            `${SUPABASE_URL}/auth/v1/user`,
            {
                method: "GET",

                headers: {

                    apikey:
                        SUPABASE_SERVICE_ROLE_KEY,

                    Authorization:
                        `Bearer ${token}`

                }
            }
        );

    if (!response.ok) {

        return null;

    }

    return response.json();

}


// ========================================
// SUPABASE REST QUERY
// ========================================

async function supabaseQuery(
    table,
    params = {}
) {

    if (
        !SUPABASE_URL ||
        !SUPABASE_SERVICE_ROLE_KEY
    ) {

        throw new Error(
            "Konfigurasi Supabase server belum lengkap."
        );

    }

    const url =
        new URL(
            `${SUPABASE_URL}/rest/v1/${table}`
        );

    for (
        const [key, value]
        of Object.entries(params)
    ) {

        if (
            value === undefined ||
            value === null
        ) {

            continue;

        }

        url.searchParams.set(
            key,
            value
        );

    }

    const response =
        await fetch(
            url,
            {
                method: "GET",

                headers: {

                    apikey:
                        SUPABASE_SERVICE_ROLE_KEY,

                    Authorization:
                        `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,

                    Accept:
                        "application/json"

                }
            }
        );

    const text =
        await response.text();

    let data;

    try {

        data =
            JSON.parse(text);

    } catch {

        data = null;

    }

    if (!response.ok) {

        const message =
            data?.message ||
            data?.hint ||
            data?.details ||
            `Supabase query gagal (${response.status}).`;

        throw new Error(message);

    }

    return Array.isArray(data)
        ? data
        : [];

}


// ========================================
// GET PARAMETER VALUE
// ========================================

function parameterValue(
    body,
    parameter
) {

    const parameters =
        body.parameters &&
        typeof body.parameters === "object"
            ? body.parameters
            : {};

    if (
        Object.prototype.hasOwnProperty.call(
            parameters,
            parameter.parameter_name
        )
    ) {

        return parameters[
            parameter.parameter_name
        ];

    }

    if (
        Object.prototype.hasOwnProperty.call(
            body,
            parameter.parameter_name
        )
    ) {

        return body[
            parameter.parameter_name
        ];

    }

    return undefined;

}


// ========================================
// API MAPPING
// ========================================

function parameterMapping(
    parameter
) {

    const mapping =
        parameter.api_mapping;

    if (!mapping) {

        return parameter.parameter_name;

    }

    if (
        typeof mapping === "string"
    ) {

        return mapping.replace(
            /^input\./,
            ""
        );

    }

    if (
        typeof mapping === "object"
    ) {

        return String(
            mapping.path ||
            mapping.key ||
            mapping.name ||
            parameter.parameter_name
        ).replace(
            /^input\./,
            ""
        );

    }

    return parameter.parameter_name;

}


// ========================================
// PARAMETER VALIDATION
// ========================================

function checkParameter(
    parameter,
    value
) {

    const name =
        parameter.parameter_name;

    const type =
        String(
            parameter.type ||
            ""
        ).toLowerCase();

    if (
        parameter.required &&
        (
            value === undefined ||
            value === null ||
            value === ""
        )
    ) {

        return `${name} wajib diisi.`;

    }

    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {

        return null;

    }

    const enumValues =
        Array.isArray(
            parameter.enum_values
        )
            ? parameter.enum_values
            : Array.isArray(
                jsonValue(
                    parameter.enum_values
                )
            )
                ? jsonValue(
                    parameter.enum_values
                )
                : null;

    if (
        enumValues &&
        enumValues.length > 0 &&
        !enumValues.includes(value)
    ) {

        return `${name} memiliki nilai yang tidak didukung.`;

    }

    if (
        typeof value === "number"
    ) {

        if (
            parameter.min_value !== null &&
            parameter.min_value !== undefined &&
            value <
                Number(
                    parameter.min_value
                )
        ) {

            return `${name} minimal ${parameter.min_value}.`;

        }

        if (
            parameter.max_value !== null &&
            parameter.max_value !== undefined &&
            value >
                Number(
                    parameter.max_value
                )
        ) {

            return `${name} maksimal ${parameter.max_value}.`;

        }

    }

    if (
        (
            type.includes("array") ||
            Array.isArray(value)
        ) &&
        Array.isArray(value)
    ) {

        if (
            parameter.min_items !== null &&
            parameter.min_items !== undefined &&
            value.length <
                Number(
                    parameter.min_items
                )
        ) {

            return `${name} minimal ${parameter.min_items} item.`;

        }

        if (
            parameter.max_items !== null &&
            parameter.max_items !== undefined &&
            value.length >
                Number(
                    parameter.max_items
                )
        ) {

            return `${name} maksimal ${parameter.max_items} item.`;

        }

    }

    return null;

}


// ========================================
// CONSTRAINT CHECK
// ========================================

function compareValue(
    actual,
    operator,
    expected
) {

    switch (
        String(
            operator || ""
        ).toLowerCase()
    ) {

        case "eq":
        case "=":
        case "==":
        case "equals":

            return actual === expected;

        case "neq":
        case "!=":
        case "not_equals":

            return actual !== expected;

        case "in":

            return (
                Array.isArray(expected) &&
                expected.includes(actual)
            );

        case "not_in":

            return (
                Array.isArray(expected) &&
                !expected.includes(actual)
            );

        case "gte":
        case ">=":

            return (
                Number(actual) >=
                Number(expected)
            );

        case "lte":
        case "<=":

            return (
                Number(actual) <=
                Number(expected)
            );

        case "gt":
        case ">":

            return (
                Number(actual) >
                Number(expected)
            );

        case "lt":
        case "<":

            return (
                Number(actual) <
                Number(expected)
            );

        default:

            return true;

    }

}


function constraintApplies(
    constraint,
    values
) {

    const source =
        constraint.source_parameter;

    if (!source) {

        return true;

    }

    const sourceValue =
        values[source];

    if (
        sourceValue === undefined ||
        sourceValue === null
    ) {

        return false;

    }

    const expected =
        jsonValue(
            constraint.value
        );

    return compareValue(
        sourceValue,
        constraint.operator,
        expected
    );

}


function constraintMessage(
    constraint
) {

    return (
        constraint.error_message ||
        `Parameter ${
            constraint.source_parameter ||
            "source"
        } tidak memenuhi aturan.`
    );

}


// ========================================
// LOAD KIE CONFIGURATION
// ========================================

async function loadKieConfig(
    modelId,
    workflowId,
    variantId
) {

    const models =
        await supabaseQuery(
            "kie_models",
            {
                select: "*",

                model_id:
                    `eq.${modelId}`,

                status:
                    "in.(ACTIVE,active)"
            }
        );

    if (
        models.length === 0
    ) {

        return null;

    }

    const model =
        models[0];

    const workflowParams = {

        select: "*",

        model_id:
            `eq.${model.id}`,

        status:
            "in.(ACTIVE,active)"

    };

    if (workflowId) {

        workflowParams.id =
            `eq.${workflowId}`;

    }

    const workflows =
        await supabaseQuery(
            "kie_workflows",
            workflowParams
        );

    if (
        workflows.length === 0
    ) {

        return {
            model,
            workflows: [],
            variants: [],
            parameters: [],
            constraints: [],
            dependencies: [],
            pricing: []
        };

    }

    let variants = [];

    for (
        const workflow
        of workflows
    ) {

        const workflowVariants =
            await supabaseQuery(
                "kie_workflow_variants",
                {
                    select: "*",

                    workflow_id:
                        `eq.${workflow.id}`,

                    status:
                        "in.(ACTIVE,active)"
                }
            );

        variants.push(
            ...workflowVariants
        );

    }

    if (variantId) {

        variants =
            variants.filter(
                variant =>
                    variant.id ===
                    variantId
            );

    }

    const workflowIds =
        workflows.map(
            workflow =>
                workflow.id
        );

    const parameters =
        await supabaseQuery(
            "kie_parameters",
            {
                select: "*",

                workflow_id:
                    `in.(${workflowIds.join(",")})`
            }
        );

    const constraints =
        await supabaseQuery(
            "kie_constraints",
            {
                select: "*",

                workflow_id:
                    `in.(${workflowIds.join(",")})`
            }
        );

    const dependencies =
        await supabaseQuery(
            "kie_dependencies",
            {
                select: "*",

                workflow_id:
                    `in.(${workflowIds.join(",")})`
            }
        );

    const pricing =
        await supabaseQuery(
            "kie_pricing",
            {
                select: "*",

                pricing_status:
                    "eq.VERIFIED",

                status:
                    "in.(ACTIVE,active)"
            }
        );

    return {
        model,
        workflows,
        variants,
        parameters,
        constraints,
        dependencies,
        pricing
    };

}


// ========================================
// SELECT WORKFLOW
// ========================================

function selectWorkflow(
    config,
    body
) {

    if (body.workflow_id) {

        return config.workflows.find(
            item =>
                item.id ===
                body.workflow_id
        ) || null;

    }

    if (body.workflow_key) {

        return config.workflows.find(
            item =>
                item.workflow_key ===
                body.workflow_key
        ) || null;

    }

    if (
        config.workflows.length === 1
    ) {

        return config.workflows[0];

    }

    return null;

}


// ========================================
// SELECT VARIANT
// ========================================

function selectVariant(
    config,
    workflow,
    body
) {

    const variants =
        config.variants.filter(
            item =>
                item.workflow_id ===
                workflow.id
        );

    if (body.variant_id) {

        return variants.find(
            item =>
                item.id ===
                body.variant_id
        ) || null;

    }

    if (body.variant_key) {

        return variants.find(
            item =>
                item.variant_key ===
                body.variant_key
        ) || null;

    }

    if (
        variants.length === 1
    ) {

        return variants[0];

    }

    return null;

}


// ========================================
// BUILD KIE INPUT
// ========================================

function buildInput(
    config,
    workflow,
    variant,
    body
) {

    const parameters =
        config.parameters.filter(
            parameter =>
                parameter.workflow_id ===
                    workflow.id &&
                (
                    !parameter.variant_id ||
                    !variant ||
                    parameter.variant_id ===
                        variant.id
                )
        );

    const values = {};

    const input = {};

    const errors = [];

    for (
        const parameter
        of parameters
    ) {

        let value =
            parameterValue(
                body,
                parameter
            );

        if (
            value === undefined ||
            value === null ||
            value === ""
        ) {

            if (
                parameter.default_value !==
                    null &&
                parameter.default_value !==
                    undefined
            ) {

                value =
                    jsonValue(
                        parameter.default_value
                    );

            }

        }

        value =
            jsonValue(
                value
            );

        const error =
            checkParameter(
                parameter,
                value
            );

        if (error) {

            errors.push(
                error
            );

        }

        if (
            value !== undefined &&
            value !== null &&
            value !== ""
        ) {

            values[
                parameter.parameter_name
            ] = value;

            input[
                parameterMapping(
                    parameter
                )
            ] = value;

        }

    }

    const constraints =
        config.constraints.filter(
            constraint =>
                constraint.workflow_id ===
                    workflow.id &&
                (
                    !constraint.variant_id ||
                    !variant ||
                    constraint.variant_id ===
                        variant.id
                )
        );

    for (
        const constraint
        of constraints
    ) {

        if (
            !constraintApplies(
                constraint,
                values
            )
        ) {

            continue;

        }

        if (
            constraint.target_parameter &&
            constraint.operator
        ) {

            const target =
                values[
                    constraint.target_parameter
                ];

            if (
                target === undefined
            ) {

                continue;

            }

            const expected =
                jsonValue(
                    constraint.value
                );

            const valid =
                compareValue(
                    target,
                    constraint.operator,
                    expected
                );

            if (!valid) {

                errors.push(
                    constraintMessage(
                        constraint
                    )
                );

            }

        }

    }

    return {
        input,
        values,
        errors,
        parameters
    };

}


// ========================================
// DEPENDENCY VALIDATION
// ========================================

function dependencyErrors(
    config,
    workflow,
    variant,
    body
) {

    const dependencies =
        config.dependencies.filter(
            dependency =>
                dependency.workflow_id ===
                    workflow.id &&
                (
                    !dependency.variant_id ||
                    !variant ||
                    dependency.variant_id ===
                        variant.id
                )
        );

    const errors = [];

    const parameters =
        body.parameters &&
        typeof body.parameters === "object"
            ? body.parameters
            : {};

    for (
        const dependency
        of dependencies
    ) {

        const source =
            dependency.source_parameter;

        const target =
            dependency.target_parameter;

        if (
            String(
                dependency.dependency_type ||
                ""
            ).includes(
                "PREVIOUS_KIE_TASK"
            ) ||
            source ===
                "PREVIOUS_KIE_TASK"
        ) {

            const taskId =
                parameters.task_id ||
                body.task_id ||
                parameters.previous_task_id ||
                body.previous_task_id;

            if (!taskId) {

                errors.push(
                    "Workflow ini membutuhkan task KIE sebelumnya (task_id)."
                );

            }

            continue;

        }

        if (!target) {

            continue;

        }

        const targetValue =
            parameters[target] !== undefined
                ? parameters[target]
                : body[target];

        if (
            targetValue === undefined ||
            targetValue === null ||
            targetValue === ""
        ) {

            errors.push(
                `Dependency ${
                    dependency.dependency_type ||
                    "workflow"
                }: ${target} wajib diisi.`
            );

        }

    }

    return errors;

}


// ========================================
// MAIN HANDLER
// ========================================

export default async function handler(
    req,
    res
) {

    if (
        req.method !== "POST"
    ) {

        return res.status(405).json({

            success: false,

            error:
                "Method tidak diizinkan."

        });

    }

    try {

        // ========================================
        // ENV CHECK
        // ========================================

        if (
            !SUPABASE_URL ||
            !SUPABASE_SERVICE_ROLE_KEY
        ) {

            return res.status(500).json({

                success: false,

                error:
                    "SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi."

            });

        }

        if (
            !PROVIDER_CREDENTIAL_ENCRYPTION_KEY
        ) {

            return res.status(500).json({

                success: false,

                error:
                    "PROVIDER_CREDENTIAL_ENCRYPTION_KEY belum dikonfigurasi."

            });

        }


        // ========================================
        // AUTH CHECK
        // ========================================

        const user =
            await getAuthenticatedUser(
                req
            );

        if (!user) {

            return res.status(401).json({

                success: false,

                error:
                    "Sesi login tidak valid atau belum dikirim ke API."

            });

        }


        // ========================================
        // REQUEST BODY
        // ========================================

        const body =
            req.body || {};

        const modelId =
            body.model_id ||
            body.model;

        if (!modelId) {

            return res.status(400).json({

                success: false,

                error:
                    "Model belum dipilih."

            });

        }


        // ========================================
        // PROVIDER
        // ========================================

        const requestedProvider =
            body.provider ||
            "kie_ai";

        const providerId =
            requestedProvider === "kie_ai"
                ? "kie"
                : requestedProvider;

        if (
            providerId !== "kie"
        ) {

            return res.status(400).json({

                success: false,

                error:
                    "Provider belum didukung oleh endpoint ini."

            });

        }


        // ========================================
        // LOAD PROVIDER API KEY
        // ========================================

        const providerApiKey =
            await loadProviderApiKey(
                providerId
            );


        // ========================================
        // LOAD SUPABASE CONFIG
        // ========================================

        const config =
            await loadKieConfig(
                modelId,
                body.workflow_id,
                body.variant_id
            );

        if (!config) {

            return res.status(404).json({

                success: false,

                error:
                    `Model KIE.AI tidak ditemukan di Supabase: ${modelId}`

            });

        }


        // ========================================
        // WORKFLOW
        // ========================================

        const workflow =
            selectWorkflow(
                config,
                body
            );

        if (!workflow) {

            return res.status(400).json({

                success: false,

                error:
                    "Workflow belum dipilih. Model ini memiliki lebih dari satu workflow.",

                model:
                    modelId,

                workflows:
                    config.workflows.map(
                        item => ({

                            id:
                                item.id,

                            workflow_key:
                                item.workflow_key,

                            workflow_type:
                                item.workflow_type,

                            operation:
                                item.operation,

                            variant:
                                item.variant

                        })
                    )

            });

        }


        // ========================================
        // VARIANT
        // ========================================

        const variant =
            selectVariant(
                config,
                workflow,
                body
            );

        const workflowHasVariants =
            config.variants.some(
                item =>
                    item.workflow_id ===
                    workflow.id
            );

        if (
            workflowHasVariants &&
            !variant
        ) {

            return res.status(400).json({

                success: false,

                error:
                    "Variant workflow belum dipilih.",

                workflow_id:
                    workflow.id,

                variants:
                    config.variants
                        .filter(
                            item =>
                                item.workflow_id ===
                                workflow.id
                        )
                        .map(
                            item => ({

                                id:
                                    item.id,

                                variant_key:
                                    item.variant_key,

                                label:
                                    item.label,

                                conditions:
                                    item.conditions

                            })
                        )

            });

        }


        // ========================================
        // BUILD INPUT
        // ========================================

        const built =
            buildInput(
                config,
                workflow,
                variant,
                body
            );


        // ========================================
        // DEPENDENCIES
        // ========================================

        const dependencyErrorsList =
            dependencyErrors(
                config,
                workflow,
                variant,
                body
            );

        const errors = [

            ...built.errors,

            ...dependencyErrorsList

        ];


        if (
            errors.length > 0
        ) {

            return res.status(400).json({

                success: false,

                error:
                    errors[0],

                errors,

                model:
                    modelId,

                workflow_id:
                    workflow.id,

                variant_id:
                    variant?.id ||
                    null

            });

        }


        // ========================================
        // EMPTY INPUT CHECK
        // ========================================

        if (
            Object.keys(
                built.input
            ).length === 0
        ) {

            return res.status(400).json({

                success: false,

                error:
                    "Tidak ada parameter generate yang berhasil dibentuk dari konfigurasi Supabase."

            });

        }


        // ========================================
        // KIE PAYLOAD
        // ========================================

        const kiePayload = {

            model:
                modelId,

            input:
                built.input

        };


        // ========================================
        // SAFE LOG
        // ========================================

        console.log(
            "GEN-Z.AI → KIE.AI request:",
            JSON.stringify({

                user_id:
                    user.id,

                model:
                    modelId,

                workflow_id:
                    workflow.id,

                variant_id:
                    variant?.id ||
                    null,

                payload:
                    kiePayload

            })
        );


        // ========================================
        // SEND TO KIE.AI
        // ========================================

        const kieResponse =
            await createTask(
                kiePayload,
                providerApiKey
            );


        // ========================================
        // TASK ID
        // ========================================

        const jobId =
            kieResponse?.taskId ||
            kieResponse?.data?.taskId ||
            kieResponse?.data?.task_id ||
            kieResponse?.task_id ||
            null;


        // ========================================
        // SUCCESS
        // ========================================

        return res.status(200).json({

            success: true,

            provider:
                "kie_ai",

            model:
                modelId,

            workflow_id:
                workflow.id,

            workflow_key:
                workflow.workflow_key,

            variant_id:
                variant?.id ||
                null,

            variant_key:
                variant?.variant_key ||
                null,

            jobId,

            taskId:
                jobId,

            status:
                "processing",

            message:
                "Permintaan generate berhasil dikirim ke KIE.AI.",

            data:
                kieResponse

        });


    } catch (error) {

        console.error(
            "GEN-Z.AI KIE.AI Error:",
            error
        );

        return res.status(
            error?.status >= 400 &&
            error?.status < 600
                ? error.status
                : 500
        ).json({

            success: false,

            error:
                error?.message ||
                "Terjadi kesalahan pada server.",

            provider:
                "kie_ai",

            detail:
                process.env.NODE_ENV ===
                "development"
                    ? error.message
                    : undefined,

            providerResponse:
                error?.response ||
                undefined

        });

    }

}
