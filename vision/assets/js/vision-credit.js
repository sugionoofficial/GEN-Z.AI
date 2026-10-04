/* =========================================================
   GEN-Z.AI VISION
   ---------------------------------------------------------
   File:
   vision/assets/js/vision-credit.js

   Fungsi:
   - Membaca saldo credit dari state/profile
   - Menentukan apakah saldo mencukupi
   - Menyiapkan credit operation
   - Memanggil server untuk deduct / refund
   - Menyinkronkan saldo terbaru ke state

   ATURAN VISION:
   - 1 proses Vision = 1 credit
   - Deduct hanya SATU kali
   - Refund jika proses gagal setelah deduction
   - Browser TIDAK mengubah profiles.credits langsung

   Server endpoint yang digunakan:
   POST /api/openkey-chat

   Operation:
   vision_credit_check
   vision_credit_deduct
   vision_credit_refund

   Server-side implementation akan ditambahkan
   pada api/openkey-chat.js tanpa membuat
   Vercel function baru.
========================================================= */


/* =========================================================
   CONFIGURATION
========================================================= */

const VISION_CREDIT_CONFIG = Object.freeze({

    cost:
        1,

    endpoint:
        "/api/openkey-chat",

    currency:
        "credits",

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
   INTERNAL HELPERS
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
   GET SUPABASE SESSION
========================================================= */

async function getSession() {

    if (
        !window.supabaseClient
    ) {

        throw new Error(
            "Supabase client belum tersedia."
        );

    }


    const result =
        await window.supabaseClient.auth.getSession();


    if (
        result?.error
    ) {

        throw result.error;

    }


    const session =
        result?.data?.session ||
        null;


    if (
        !session ||
        !session.access_token
    ) {

        throw new Error(
            "Session pengguna tidak tersedia."
        );

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
        Number(value);


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

        response?.data?.credits,

        response?.data?.remaining_credits,

        response?.data?.balance

    ];


    for (
        const value
        of candidates
    ) {

        const numeric =
            Number(value);


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
        serverCredits === null
            ? getCurrentCredit()
            : setCredit(
                serverCredits
            );


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
     * Jangan pernah melakukan deduction kedua
     * dalam satu proses.
     */

    if (
        state.get(
            "credit.deducted",
            false
        )
    ) {

        return {

            alreadyDeducted:
                true,

            credits:
                getCurrentCredit(),

            amount:
                getCost()

        };

    }


    /*
     * Pemeriksaan lokal hanya sebagai
     * fast-fail UX.
     *
     * Server tetap menjadi authority.
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
         * Jangan mengarang saldo baru
         * jika server tidak mengembalikannya.
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


    return {

        deducted:
            true,

        amount:
            getCost(),

        credits:
            getCurrentCredit(),

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


    /*
     * Refund hanya boleh dilakukan
     * jika credit benar-benar sudah
     * dipotong.
     */

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


    return {

        refunded:
            true,

        amount:
            getCost(),

        credits:
            getCurrentCredit(),

        response

    };

}


/* =========================================================
   RESERVE CREDIT
   ---------------------------------------------------------
   Vision menggunakan deduction atomik di server.
   Reserve di state hanya menandai bahwa proses sudah
   melewati tahap persiapan credit.
========================================================= */

function reserveCredit() {

    const state =
        getState();


    state.markCreditReserved();


    return {

        reserved:
            true,

        amount:
            getCost()

    };

}


/* =========================================================
   RELEASE LOCAL CREDIT STATE
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


    return true;

}


/* =========================================================
   GET CREDIT STATE
========================================================= */

function getCreditState() {

    const state =
        getState();


    return {

        cost:
            getCost(),

        credits:
            getCurrentCredit(),

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
   PUBLIC API
========================================================= */

const GENZVisionCredit =
    Object.freeze({

        CONFIG:
            VISION_CREDIT_CONFIG,

        getCost,

        normalizeCredit,

        getCurrentCredit,

        setCredit,

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
