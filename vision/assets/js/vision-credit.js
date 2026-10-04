/* =========================================================
   GEN-Z.AI VISION
   ---------------------------------------------------------
   File:
   vision/assets/js/vision-credit.js

   Fungsi:
   - Membaca saldo credit dari server
   - Menampilkan saldo credit pada Vision UI
   - Menentukan apakah saldo mencukupi
   - Deduct 1 credit
   - Refund credit jika proses gagal
   - Sinkronisasi saldo ke state
   - Browser TIDAK mengubah profiles.credits langsung

   ATURAN:
   - 1 proses Vision = 1 credit
   - Deduct hanya SATU kali
   - Refund jika proses gagal setelah deduction
   - Server tetap menjadi authority
========================================================= */


/* =========================================================
   CONFIGURATION
========================================================= */

const VISION_CREDIT_CONFIG =
    Object.freeze({

        cost:
            1,

        endpoint:
            "/api/openkey-chat",

        currency:
            "credits",

        lowBalanceThreshold:
            5,

        operation:

            Object.freeze({

                CHECK:
                    "vision_credit_check",

                DEDUCT:
                    "vision_credit_deduct",

                REFUND:
                    "vision_credit_refund"

            })

    });


/* =========================================================
   INTERNAL STATE ACCESS
========================================================= */

function getState() {

    if (
        !window.GENZVisionState
    ) {

        throw new Error(
            "GENZVisionState belum tersedia."
        );

    }


    return window.GENZVisionState;

}


/* =========================================================
   DOM ACCESS
========================================================= */

function getDOM() {

    if (
        !window.GENZVisionDOM
    ) {

        return null;

    }


    try {

        return window.GENZVisionDOM.getDOM();

    } catch {

        return null;

    }

}


/* =========================================================
   GET SUPABASE CLIENT
   ---------------------------------------------------------
   Prioritas:
   1. GENZVisionSupabase
   2. GENZ_SUPABASE
   3. window.supabaseClient
   4. Buat client langsung dari config
========================================================= */

function getSupabaseClient() {

    /*
     * -----------------------------------------------------
     * PRIORITY 1
     * Vision Supabase module
     * -----------------------------------------------------
     */

    if (
        window.GENZVisionSupabase
    ) {

        if (
            typeof window.GENZVisionSupabase.getClient ===
            "function"
        ) {

            try {

                const client =
                    window.GENZVisionSupabase.getClient();


                if (
                    client
                ) {

                    window.supabaseClient =
                        client;


                    return client;

                }

            } catch (
                error
            ) {

                console.warn(
                    "[GEN-Z.AI Vision] GENZVisionSupabase.getClient() gagal:",
                    error
                );

            }

        }


        if (
            typeof window.GENZVisionSupabase.createClient ===
            "function"
        ) {

            try {

                const client =
                    window.GENZVisionSupabase.createClient();


                if (
                    client
                ) {

                    window.supabaseClient =
                        client;


                    return client;

                }

            } catch (
                error
            ) {

                console.warn(
                    "[GEN-Z.AI Vision] GENZVisionSupabase.createClient() gagal:",
                    error
                );

            }

        }

    }


    /*
     * -----------------------------------------------------
     * PRIORITY 2
     * Global GENZ Supabase client
     * -----------------------------------------------------
     */

    if (
        window.GENZ_SUPABASE &&
        typeof window.GENZ_SUPABASE.auth?.getSession ===
            "function"
    ) {

        window.supabaseClient =
            window.GENZ_SUPABASE;


        return window.GENZ_SUPABASE;

    }


    /*
     * -----------------------------------------------------
     * PRIORITY 3
     * Existing global Supabase client
     * -----------------------------------------------------
     */

    if (
        window.supabaseClient &&
        typeof window.supabaseClient.auth?.getSession ===
            "function"
    ) {

        return window.supabaseClient;

    }


    /*
     * -----------------------------------------------------
     * PRIORITY 4
     * Direct creation sebagai fallback terakhir
     * -----------------------------------------------------
     */

    const supabaseGlobal =
        window.supabase;


    const config =
        window.GENZ_CONFIG;


    if (
        supabaseGlobal &&
        typeof supabaseGlobal.createClient ===
            "function" &&
        config &&
        config.SUPABASE_URL
    ) {

        const supabaseKey =
            config.SUPABASE_KEY ||
            config.SUPABASE_ANON_KEY ||
            "";


        if (
            supabaseKey
        ) {

            try {

                const client =
                    supabaseGlobal.createClient(

                        config.SUPABASE_URL,

                        supabaseKey,

                        {

                            auth: {

                                persistSession:
                                    true,

                                autoRefreshToken:
                                    true,

                                detectSessionInUrl:
                                    true

                            }

                        }

                    );


                window.supabaseClient =
                    client;


                return client;

            } catch (
                error
            ) {

                console.error(
                    "[GEN-Z.AI Vision] Gagal membuat Supabase client:",
                    error
                );

            }

        }

    }


    return null;

}


/* =========================================================
   GET SUPABASE SESSION
========================================================= */

async function getSession() {

    const supabaseClient =
        getSupabaseClient();


    /*
     * -----------------------------------------------------
     * VALIDATE CLIENT
     * -----------------------------------------------------
     */

    if (
        !supabaseClient
    ) {

        throw new Error(
            "Supabase client belum tersedia."
        );

    }


    if (
        !supabaseClient.auth ||
        typeof supabaseClient.auth.getSession !==
            "function"
    ) {

        throw new Error(
            "Supabase Auth client tidak tersedia."
        );

    }


    /*
     * -----------------------------------------------------
     * GET SESSION
     * -----------------------------------------------------
     */

    const result =
        await supabaseClient.auth.getSession();


    if (
        result?.error
    ) {

        throw result.error;

    }


    const session =
        result?.data?.session ||
        null;


    /*
     * -----------------------------------------------------
     * VALIDATE SESSION
     * -----------------------------------------------------
     */

    if (
        !session ||
        !session.access_token
    ) {

        throw new Error(
            "Session pengguna tidak tersedia."
        );

    }


    /*
     * -----------------------------------------------------
     * KEEP GLOBAL CLIENT
     * -----------------------------------------------------
     */

    if (
        !window.supabaseClient
    ) {

        window.supabaseClient =
            supabaseClient;

    }


    return session;

}


/* =========================================================
   GET ACCESS TOKEN
========================================================= */

async function getAccessToken() {

    const session =
        await getSession();


    return session.access_token;

}


/* =========================================================
   NORMALIZE CREDIT
========================================================= */

function normalizeCredit(
    value
) {

    const numeric =
        Number(
            value
        );


    if (
        !Number.isFinite(
            numeric
        )
    ) {

        return 0;

    }


    return Math.max(
        0,
        numeric
    );

}


/* =========================================================
   FORMAT CREDIT
========================================================= */

function formatCredit(
    value
) {

    const numeric =
        normalizeCredit(
            value
        );


    if (
        Number.isInteger(
            numeric
        )
    ) {

        return String(
            numeric
        );

    }


    return numeric
        .toFixed(2)
        .replace(
            /\.?0+$/,
            ""
        );

}


/* =========================================================
   UPDATE CREDIT BADGE
========================================================= */

function updateCreditBadge(
    credits
) {

    const dom =
        getDOM();


    if (
        !dom
    ) {

        return false;

    }


    const badge =
        dom.creditBadge ||
        document.getElementById(
            "visionCreditBadge"
        );


    const valueElement =
        dom.creditValue ||
        document.getElementById(
            "visionCreditValue"
        );


    const normalized =
        normalizeCredit(
            credits
        );


    /*
     * -----------------------------------------------------
     * CREDIT VALUE
     * -----------------------------------------------------
     */

    if (
        valueElement
    ) {

        valueElement.textContent =
            formatCredit(
                normalized
            );

    }


    /*
     * -----------------------------------------------------
     * BADGE STATE
     * -----------------------------------------------------
     */

    if (
        badge
    ) {

        badge.classList.toggle(
            "is-low",
            normalized > 0 &&
            normalized <=
                VISION_CREDIT_CONFIG
                    .lowBalanceThreshold
        );


        badge.classList.toggle(
            "is-empty",
            normalized <= 0
        );


        badge.dataset.credits =
            String(
                normalized
            );

    }


    return true;

}


/* =========================================================
   GET CURRENT CREDIT
========================================================= */

function getCurrentCredit() {

    const state =
        getState();


    const stateCredits =
        state.get(
            "auth.credits",
            null
        );


    if (
        stateCredits !== null &&
        stateCredits !== undefined
    ) {

        return normalizeCredit(
            stateCredits
        );

    }


    const profileCredits =
        state.get(
            "auth.profile.credits",
            null
        );


    return normalizeCredit(
        profileCredits
    );

}


/* =========================================================
   SET CREDIT
========================================================= */

function setCredit(
    credits
) {

    const normalized =
        normalizeCredit(
            credits
        );


    const state =
        getState();


    /*
     * -----------------------------------------------------
     * STATE
     * -----------------------------------------------------
     */

    state.set(
        "auth.credits",
        normalized
    );


    state.merge(
        "auth.profile",
        {

            credits:
                normalized

        }
    );


    /*
     * -----------------------------------------------------
     * UI
     * -----------------------------------------------------
     */

    updateCreditBadge(
        normalized
    );


    return normalized;

}


/* =========================================================
   GET REQUIRED CREDIT
========================================================= */

function getCost() {

    return VISION_CREDIT_CONFIG.cost;

}


/* =========================================================
   HAS ENOUGH CREDIT
========================================================= */

function hasEnoughCredit(
    credits = null
) {

    const current =
        credits === null
            ? getCurrentCredit()
            : normalizeCredit(
                credits
            );


    return (
        current >=
        getCost()
    );

}


/* =========================================================
   ASSERT ENOUGH CREDIT
========================================================= */

function assertEnoughCredit(
    credits = null
) {

    const current =
        credits === null
            ? getCurrentCredit()
            : normalizeCredit(
                credits
            );


    const cost =
        getCost();


    if (
        current < cost
    ) {

        const error =
            new Error(
                `Credit tidak mencukupi. Diperlukan ${cost} credit, saldo saat ini ${current} credit.`
            );


        error.code =
            "INSUFFICIENT_CREDITS";


        error.currentCredits =
            current;


        error.requiredCredits =
            cost;


        updateCreditBadge(
            current
        );


        throw error;

    }


    return true;

}


/* =========================================================
   BUILD REQUEST
========================================================= */

function buildRequest(
    operation,
    extra = {}
) {

    return {

        operation,

        amount:
            getCost(),

        ...extra

    };

}


/* =========================================================
   SERVER REQUEST
========================================================= */

async function requestServer(
    operation,
    extra = {}
) {

    const token =
        await getAccessToken();


    const body =
        buildRequest(
            operation,
            extra
        );


    const response =
        await fetch(
            VISION_CREDIT_CONFIG.endpoint,
            {

                method:
                    "POST",

                headers: {

                    "Content-Type":
                        "application/json",

                    Authorization:
                        `Bearer ${token}`

                },

                body:
                    JSON.stringify(
                        body
                    )

            }
        );


    const rawText =
        await response.text();


    let data =
        null;


    if (
        rawText
    ) {

        try {

            data =
                JSON.parse(
                    rawText
                );

        } catch {

            data =
                {

                    success:
                        false,

                    error:
                        rawText

                };

        }

    }


    if (
        !response.ok
    ) {

        const message =
            data?.error ||
            data?.message ||
            `Credit request failed with status ${response.status}`;


        const error =
            new Error(
                message
            );


        error.status =
            response.status;


        error.code =
            data?.code ||
            "VISION_CREDIT_REQUEST_FAILED";


        error.data =
            data;


        throw error;

    }


    if (
        data &&
        data.success === false
    ) {

        const error =
            new Error(
                data.error ||
                data.message ||
                "Vision credit operation failed."
            );


        error.code =
            data.code ||
            "VISION_CREDIT_OPERATION_FAILED";


        error.data =
            data;


        throw error;

    }


    return data || {};

}


/* =========================================================
   EXTRACT BALANCE
========================================================= */

function extractBalance(
    response
) {

    const candidates = [

        response?.credits,

        response?.remaining_credits,

        response?.balance,

        response?.remaining,

        response?.data?.credits,

        response?.data?.remaining_credits,

        response?.data?.balance,

        response?.data?.remaining

    ];


    for (
        const value
        of candidates
    ) {

        const numeric =
            Number(
                value
            );


        if (
            Number.isFinite(
                numeric
            )
        ) {

            return normalizeCredit(
                numeric
            );

        }

    }


    return null;

}


/* =========================================================
   CHECK CREDIT
========================================================= */

async function checkCredit() {

    const state =
        getState();


    state.set(
        "credit.checked",
        false
    );


    /*
     * Server adalah sumber saldo utama.
     */

    const response =
        await requestServer(
            VISION_CREDIT_CONFIG
                .operation
                .CHECK
        );


    const serverCredits =
        extractBalance(
            response
        );


    const currentCredits =
        serverCredits !== null
            ? setCredit(
                serverCredits
            )
            : getCurrentCredit();


    if (
        serverCredits === null
    ) {

        updateCreditBadge(
            currentCredits
        );

    }


    const sufficient =
        hasEnoughCredit(
            currentCredits
        );


    state.set(
        "credit.checked",
        true
    );


    if (
        !sufficient
    ) {

        updateCreditBadge(
            currentCredits
        );


        const error =
            new Error(
                `Credit tidak mencukupi. Diperlukan ${getCost()} credit, saldo saat ini ${currentCredits} credit.`
            );


        error.code =
            "INSUFFICIENT_CREDITS";


        error.currentCredits =
            currentCredits;


        error.requiredCredits =
            getCost();


        throw error;

    }


    return {

        allowed:
            true,

        credits:
            currentCredits,

        required:
            getCost(),

        sufficient:
            true

    };

}


/* =========================================================
   DEDUCT CREDIT
========================================================= */

async function deductCredit(
    metadata = {}
) {

    const state =
        getState();


    /*
     * Jangan pernah melakukan deduction
     * kedua dalam satu proses.
     */

    if (
        state.get(
            "credit.deducted",
            false
        )
    ) {

        updateCreditBadge(
            getCurrentCredit()
        );


        return {

            alreadyDeducted:
                true,

            deducted:
                false,

            credits:
                getCurrentCredit(),

            amount:
                getCost()

        };

    }


    /*
     * Fast-fail lokal.
     * Server tetap authority.
     */

    assertEnoughCredit();


    const response =
        await requestServer(
            VISION_CREDIT_CONFIG
                .operation
                .DEDUCT,

            {

                task_id:
                    metadata.taskId ||
                    null,

                model_id:
                    metadata.modelId ||
                    null,

                model_name:
                    metadata.modelName ||
                    null

            }
        );


    const serverCredits =
        extractBalance(
            response
        );


    if (
        serverCredits !== null
    ) {

        setCredit(
            serverCredits
        );

    } else {

        /*
         * Hanya fallback lokal jika
         * server tidak mengirim saldo.
         */

        const current =
            getCurrentCredit();


        setCredit(
            Math.max(
                0,
                current -
                getCost()
            )
        );

    }


    state.markCreditDeducted();


    state.markCreditReserved();


    const remaining =
        getCurrentCredit();


    updateCreditBadge(
        remaining
    );


    return {

        deducted:
            true,

        amount:
            getCost(),

        credits:
            remaining,

        response

    };

}


/* =========================================================
   REFUND CREDIT
========================================================= */

async function refundCredit(
    metadata = {}
) {

    const state =
        getState();


    const deducted =
        state.get(
            "credit.deducted",
            false
        );


    const refunded =
        state.get(
            "credit.refunded",
            false
        );


    if (
        !deducted
    ) {

        updateCreditBadge(
            getCurrentCredit()
        );


        return {

            refunded:
                false,

            skipped:
                true,

            reason:
                "Credit was not deducted",

            credits:
                getCurrentCredit()

        };

    }


    if (
        refunded
    ) {

        updateCreditBadge(
            getCurrentCredit()
        );


        return {

            refunded:
                false,

            skipped:
                true,

            reason:
                "Credit was already refunded",

            credits:
                getCurrentCredit()

        };

    }


    const response =
        await requestServer(
            VISION_CREDIT_CONFIG
                .operation
                .REFUND,

            {

                task_id:
                    metadata.taskId ||
                    null,

                model_id:
                    metadata.modelId ||
                    null,

                model_name:
                    metadata.modelName ||
                    null

            }
        );


    const serverCredits =
        extractBalance(
            response
        );


    if (
        serverCredits !== null
    ) {

        setCredit(
            serverCredits
        );

    } else {

        const current =
            getCurrentCredit();


        setCredit(
            current +
            getCost()
        );

    }


    state.markCreditRefunded();


    const remaining =
        getCurrentCredit();


    updateCreditBadge(
        remaining
    );


    return {

        refunded:
            true,

        amount:
            getCost(),

        credits:
            remaining,

        response

    };

}


/* =========================================================
   RESERVE CREDIT
========================================================= */

function reserveCredit() {

    const state =
        getState();


    state.markCreditReserved();


    updateCreditBadge(
        getCurrentCredit()
    );


    return {

        reserved:
            true,

        amount:
            getCost()

    };

}


/* =========================================================
   RESET OPERATION STATE
========================================================= */

function resetOperationState() {

    const state =
        getState();


    state.set(
        "credit.checked",
        false
    );


    state.set(
        "credit.reserved",
        false
    );


    state.set(
        "credit.deducted",
        false
    );


    state.set(
        "credit.refunded",
        false
    );


    /*
     * Reset operation tidak boleh
     * mengubah saldo pengguna.
     */

    updateCreditBadge(
        getCurrentCredit()
    );


    return true;

}


/* =========================================================
   GET CREDIT STATE
========================================================= */

function getCreditState() {

    const state =
        getState();


    const credits =
        getCurrentCredit();


    return {

        cost:
            getCost(),

        credits,

        checked:
            Boolean(
                state.get(
                    "credit.checked",
                    false
                )
            ),

        reserved:
            Boolean(
                state.get(
                    "credit.reserved",
                    false
                )
            ),

        deducted:
            Boolean(
                state.get(
                    "credit.deducted",
                    false
                )
            ),

        refunded:
            Boolean(
                state.get(
                    "credit.refunded",
                    false
                )
            )

    };

}


/* =========================================================
   REFRESH DISPLAY ONLY
========================================================= */

function refreshDisplay() {

    const credits =
        getCurrentCredit();


    updateCreditBadge(
        credits
    );


    return credits;

}


/* =========================================================
   PUBLIC API
========================================================= */

const GENZVisionCredit =
    Object.freeze({

        CONFIG:
            VISION_CREDIT_CONFIG,

        getSupabaseClient,

        getSession,

        getAccessToken,

        getCost,

        normalizeCredit,

        formatCredit,

        getCurrentCredit,

        setCredit,

        updateCreditBadge,

        refreshDisplay,

        hasEnoughCredit,

        assertEnoughCredit,

        checkCredit,

        deductCredit,

        refundCredit,

        reserveCredit,

        resetOperationState,

        getCreditState

    });


/* =========================================================
   GLOBAL EXPORT
========================================================= */

window.GENZVisionCredit =
    GENZVisionCredit;
