/**
 * =========================================================
 * GEN-Z.AI
 * MODEL DATA MODULE
 * ---------------------------------------------------------
 * File:
 * admin-control/models/models-data.js
 *
 * Tanggung jawab:
 * - Load data model dari Supabase
 * - Load provider dari Supabase
 * - Normalisasi data model
 * - Menjadi sumber data untuk Model Table
 *
 * Database:
 * - models
 * - providers
 *
 * Tidak menggunakan:
 * - kie_models
 * - kie_workflows
 * - kie_workflow_variants
 * - kie_parameters
 * - kie_constraints
 * - kie_dependencies
 * - kie_pricing
 *
 * =========================================================
 */

const MODEL_TABLE = "models";
const PROVIDER_TABLE = "providers";

/* =========================================================
   STATE
========================================================= */

let modelCache = [];
let providerCache = [];

/* =========================================================
   HELPERS
========================================================= */

function getSupabaseClient() {
    if (
        typeof window !== "undefined" &&
        window.supabaseClient
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

    throw new Error(
        "Supabase client belum tersedia."
    );
}

/* =========================================================
   ARRAY NORMALIZER
========================================================= */

function normalizeArray(value) {
    if (Array.isArray(value)) {
        return value;
    }

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return [];
    }

    if (typeof value === "string") {
        const text = value.trim();

        if (!text) {
            return [];
        }

        /*
         * PostgreSQL array:
         * {"2:3","9:16"}
         */
        if (
            text.startsWith("{") &&
            text.endsWith("}")
        ) {
            const content =
                text.slice(1, -1).trim();

            if (!content) {
                return [];
            }

            return content
                .split(",")
                .map(item =>
                    item
                        .trim()
                        .replace(/^"(.*)"$/, "$1")
                )
                .filter(Boolean);
        }

        /*
         * JSON array
         */
        if (
            text.startsWith("[") &&
            text.endsWith("]")
        ) {
            try {
                const parsed =
                    JSON.parse(text);

                if (Array.isArray(parsed)) {
                    return parsed;
                }
            } catch {
                // lanjut ke comma separated
            }
        }

        /*
         * Comma separated
         */
        return text
            .split(",")
            .map(item => item.trim())
            .filter(Boolean);
    }

    return [];
}

/* =========================================================
   NUMBER NORMALIZER
========================================================= */

function normalizeNumber(value) {
    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return null;
    }

    const number = Number(value);

    return Number.isFinite(number)
        ? number
        : null;
}

/* =========================================================
   PROVIDER CACHE
========================================================= */

export function clearProviderCache() {
    providerCache = [];
}

export function clearModelCache() {
    modelCache = [];
}

/* =========================================================
   LOAD PROVIDERS
========================================================= */

export async function loadProviders(
    options = {}
) {
    const {
        force = false,
        includeInactive = true
    } = options;

    if (
        !force &&
        providerCache.length > 0
    ) {
        return [...providerCache];
    }

    const supabase =
        getSupabaseClient();

    let query =
        supabase
            .from(PROVIDER_TABLE)
            .select("*")
            .order(
                "provider_name",
                {
                    ascending: true
                }
            );

    if (!includeInactive) {
        query =
            query.eq(
                "status",
                "active"
            );
    }

    const {
        data,
        error
    } = await query;

    if (error) {
        throw error;
    }

    providerCache =
        Array.isArray(data)
            ? data
            : [];

    return [...providerCache];
}

/* =========================================================
   GET PROVIDER
========================================================= */

export async function getProviderById(
    providerId
) {
    if (!providerId) {
        return null;
    }

    const providers =
        await loadProviders();

    return (
        providers.find(
            provider =>
                String(provider.id) ===
                String(providerId)
        ) || null
    );
}

export async function getProviderByCode(
    providerCode
) {
    if (!providerCode) {
        return null;
    }

    const providers =
        await loadProviders();

    return (
        providers.find(
            provider =>
                String(
                    provider.provider_id || ""
                ).toLowerCase() ===
                String(
                    providerCode
                ).toLowerCase()
        ) || null
    );
}

/* =========================================================
   NORMALIZE MODEL
========================================================= */

export function normalizeModel(
    model,
    providers = providerCache
) {
    if (!model) {
        return null;
    }

    const provider =
        providers.find(
            item =>
                String(item.id) ===
                String(model.provider_id)
        ) || null;

    const creditCost =
        normalizeNumber(
            model.credit_cost
        );

    const discountPercent =
        normalizeNumber(
            model.discount_percent
        );

    const creditFinal =
        normalizeNumber(
            model.credit_final
        );

    const minDuration =
        normalizeNumber(
            model.min_duration
        );

    const maxDuration =
        normalizeNumber(
            model.max_duration
        );

    return {
        ...model,

        id: model.id || null,

        provider_id:
            model.provider_id || null,

        model_id:
            model.model_id || "",

        model_name:
            model.model_name || "",

        description:
            model.description || "",

        credit_cost:
            creditCost,

        discount_percent:
            discountPercent,

        credit_final:
            creditFinal,

        min_duration:
            minDuration,

        max_duration:
            maxDuration,

        supported_ratios:
            normalizeArray(
                model.supported_ratios
            ),

        supported_resolutions:
            normalizeArray(
                model.supported_resolutions
            ),

        status:
            model.status || "inactive",

        provider: provider
            ? {
                  id: provider.id,

                  provider_id:
                      provider.provider_id ||
                      "",

                  provider_name:
                      provider.provider_name ||
                      provider.name ||
                      "",

                  status:
                      provider.status ||
                      ""
              }
            : null
    };
}

/* =========================================================
   LOAD MODELS
========================================================= */

export async function loadModels(
    options = {}
) {
    const {
        force = false,
        includeInactive = true,
        activeProviderOnly = false
    } = options;

    if (
        !force &&
        modelCache.length > 0
    ) {
        return [...modelCache];
    }

    const supabase =
        getSupabaseClient();

    /*
     * Load provider terlebih dahulu.
     */
    const providers =
        await loadProviders({
            force,
            includeInactive: true
        });

    let query =
        supabase
            .from(MODEL_TABLE)
            .select("*")
            .order(
                "created_at",
                {
                    ascending: false
                }
            );

    if (!includeInactive) {
        query =
            query.eq(
                "status",
                "active"
            );
    }

    const {
        data,
        error
    } = await query;

    if (error) {
        throw error;
    }

    let models =
        Array.isArray(data)
            ? data
                .map(
                    model =>
                        normalizeModel(
                            model,
                            providers
                        )
                )
                .filter(Boolean)
            : [];

    /*
     * Hanya model yang provider-nya
     * masih aktif.
     */
    if (activeProviderOnly) {
        models =
            models.filter(
                model =>
                    model.provider &&
                    String(
                        model.provider.status ||
                        ""
                    ).toLowerCase() ===
                    "active"
            );
    }

    modelCache =
        models;

    return [...modelCache];
}

/* =========================================================
   GET MODEL BY DATABASE ID
========================================================= */

export async function getModelById(
    id
) {
    if (!id) {
        return null;
    }

    const models =
        await loadModels();

    return (
        models.find(
            model =>
                String(model.id) ===
                String(id)
        ) || null
    );
}

/* =========================================================
   GET MODEL BY MODEL ID
========================================================= */

export async function getModelByModelId(
    modelId
) {
    if (!modelId) {
        return null;
    }

    const models =
        await loadModels();

    return (
        models.find(
            model =>
                String(
                    model.model_id
                ) ===
                String(modelId)
        ) || null
    );
}

/* =========================================================
   FILTER MODELS
========================================================= */

export function filterModels(
    models,
    filters = {}
) {
    if (!Array.isArray(models)) {
        return [];
    }

    const {
        search = "",
        providerId = "",
        providerCode = "",
        status = ""
    } = filters;

    const searchText =
        String(search)
            .trim()
            .toLowerCase();

    return models.filter(
        model => {

            if (
                searchText
            ) {
                const haystack =
                    [
                        model.model_id,
                        model.model_name,
                        model.description,
                        model.provider?.provider_id,
                        model.provider?.provider_name
                    ]
                        .filter(Boolean)
                        .join(" ")
                        .toLowerCase();

                if (
                    !haystack.includes(
                        searchText
                    )
                ) {
                    return false;
                }
            }

            if (
                providerId &&
                String(
                    model.provider_id
                ) !==
                    String(providerId)
            ) {
                return false;
            }

            if (
                providerCode &&
                String(
                    model.provider?.provider_id ||
                    ""
                ).toLowerCase() !==
                    String(
                        providerCode
                    ).toLowerCase()
            ) {
                return false;
            }

            if (
                status &&
                String(
                    model.status || ""
                ).toLowerCase() !==
                    String(status)
                        .toLowerCase()
            ) {
                return false;
            }

            return true;
        }
    );
}

/* =========================================================
   FORMAT CREDIT
========================================================= */

export function formatCredit(
    value
) {
    const number =
        normalizeNumber(value);

    if (number === null) {
        return "-";
    }

    return new Intl.NumberFormat(
        "id-ID"
    ).format(number);
}

/* =========================================================
   FORMAT PERCENT
========================================================= */

export function formatPercent(
    value
) {
    const number =
        normalizeNumber(value);

    if (number === null) {
        return "-";
    }

    return `${number}%`;
}

/* =========================================================
   FORMAT DURATION
========================================================= */

export function formatDuration(
    min,
    max
) {
    const minimum =
        normalizeNumber(min);

    const maximum =
        normalizeNumber(max);

    if (
        minimum === null &&
        maximum === null
    ) {
        return "-";
    }

    if (
        minimum !== null &&
        maximum !== null
    ) {
        return `${minimum}-${maximum}s`;
    }

    if (
        minimum !== null
    ) {
        return `${minimum}s+`;
    }

    return `-${maximum}s`;
}

/* =========================================================
   FORMAT ARRAY
========================================================= */

export function formatList(
    value
) {
    const items =
        normalizeArray(value);

    if (
        items.length === 0
    ) {
        return "-";
    }

    return items.join(", ");
}

/* =========================================================
   STATUS HELPERS
========================================================= */

export function isModelActive(
    model
) {
    return (
        String(
            model?.status || ""
        ).toLowerCase() ===
        "active"
    );
}

export function isProviderActive(
    model
) {
    return (
        String(
            model?.provider?.status ||
            ""
        ).toLowerCase() ===
        "active"
    );
}

export function isModelUsable(
    model
) {
    return (
        isModelActive(model) &&
        isProviderActive(model)
    );
}

/* =========================================================
   EXPORT SNAPSHOT
========================================================= */

export function getModelCache() {
    return [...modelCache];
}

export function getProviderCache() {
    return [...providerCache];
}

/* =========================================================
   DEFAULT EXPORT
========================================================= */

const ModelData = {
    MODEL_TABLE,
    PROVIDER_TABLE,

    loadModels,
    loadProviders,

    getModelById,
    getModelByModelId,

    getProviderById,
    getProviderByCode,

    normalizeModel,

    filterModels,

    formatCredit,
    formatPercent,
    formatDuration,
    formatList,

    isModelActive,
    isProviderActive,
    isModelUsable,

    clearModelCache,
    clearProviderCache,

    getModelCache,
    getProviderCache
};

export default ModelData;
