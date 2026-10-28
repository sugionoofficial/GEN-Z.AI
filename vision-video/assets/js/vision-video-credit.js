/* =========================================================
   GEN-Z.AI VISION VIDEO
   ---------------------------------------------------------
   File:
   vision-video/assets/js/vision-video-credit.js

   Fungsi:
   - Membaca saldo credit dari server
   - Menampilkan saldo credit pada Vision Video UI
   - Menentukan apakah saldo mencukupi
   - Deduct 1 credit
   - Refund 1 credit jika proses gagal
   - Sinkronisasi saldo ke Vision Video State
   - Browser TIDAK mengubah profiles.credits langsung

   ATURAN:
   - 1 proses Vision Video = 1 credit
   - Deduct hanya SATU kali
   - Refund hanya jika credit sudah dideduct
   - Server tetap menjadi authority
========================================================= */

(function () {

    "use strict";


    /* =====================================================
       CONFIGURATION
    ===================================================== */

    const VISION_VIDEO_CREDIT_CONFIG =
        Object.freeze({

            featureId:
                "vision_video",

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

    let currentVisionVideoCreditCost =
        VISION_VIDEO_CREDIT_CONFIG.cost;


    function createCreditTransactionId() {

        if (window.crypto?.randomUUID) {
            return window.crypto.randomUUID();
        }

        const bytes = new Uint8Array(16);
        window.crypto.getRandomValues(bytes);
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = Array.from(bytes, value => value.toString(16).padStart(2, "0")).join("");

        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;

    }


    /* =====================================================
       STATE ACCESS
    ===================================================== */

    function getState() {

        if (
            !window.GENZVisionVideoState
        ) {

            throw new Error(
                "GENZVisionVideoState belum tersedia."
            );

        }


        return window.GENZVisionVideoState;

    }


    /* =====================================================
       DOM ACCESS
    ===================================================== */

    function getElement(
        id
    ) {

        const dom =
            window.GENZVisionVideoDOM;


        if (
            dom &&
            typeof dom.get ===
                "function"
        ) {

            try {

                const element =
                    dom.get(
                        id
                    );


                if (
                    element
                ) {

                    return element;

                }

            } catch {

                /* fallback ke document */
            }

        }


        return document.getElementById(
            id
        );

    }


    /* =====================================================
       SUPABASE CLIENT
    ===================================================== */

    function getSupabaseClient() {

        /*
         * -------------------------------------------------
         * PRIORITY 1
         * Existing global GEN-Z Supabase
         * -------------------------------------------------
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
         * -------------------------------------------------
         * PRIORITY 2
         * Existing global Supabase client
         * -------------------------------------------------
         */

        if (
            window.supabaseClient &&
            typeof window.supabaseClient.auth?.getSession ===
                "function"
        ) {

            return window.supabaseClient;

        }


        /*
         * -------------------------------------------------
         * PRIORITY 3
         * Create client from GEN-Z config
         * -------------------------------------------------
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
                        "[GEN-Z.AI Vision Video] Gagal membuat Supabase client:",
                        error
                    );

                }

            }

        }


        return null;

    }


    /* =====================================================
       GET SESSION
    ===================================================== */

    async function getSession() {

        const client =
            getSupabaseClient();


        if (
            !client
        ) {

            throw new Error(
                "Supabase client belum tersedia."
            );

        }


        if (
            !client.auth ||
            typeof client.auth.getSession !==
                "function"
        ) {

            throw new Error(
                "Supabase Auth client tidak tersedia."
            );

        }


        const result =
            await client.auth.getSession();


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


        if (
            !window.supabaseClient
        ) {

            window.supabaseClient =
                client;

        }


        return session;

    }


    /* =====================================================
       GET ACCESS TOKEN
    ===================================================== */

    async function getAccessToken() {

        const session =
            await getSession();


        return session.access_token;

    }


    /* =====================================================
       NORMALIZE CREDIT
    ===================================================== */

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


    /* =====================================================
       FORMAT CREDIT
    ===================================================== */

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


    /* =====================================================
       UPDATE CREDIT BADGE
    ===================================================== */

    function updateCreditBadge(
        credits
    ) {

        const valueElement =
            getElement(
                "creditValue"
            ) ||
            document.getElementById(
                "visionVideoCreditValue"
            );


        const badge =
            getElement(
                "creditBadge"
            ) ||
            document.getElementById(
                "visionVideoCreditBadge"
            );


        const normalized =
            normalizeCredit(
                credits
            );


        if (
            valueElement
        ) {

            valueElement.textContent =
                formatCredit(
                    normalized
                );

        }


        if (
            badge
        ) {

            badge.classList.toggle(
                "is-low",
                normalized > 0 &&
                normalized <=
                    VISION_VIDEO_CREDIT_CONFIG
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


    /* =====================================================
       GET CURRENT CREDIT
    ===================================================== */

    function getCurrentCredit() {

        const state =
            getState();


        /*
         * Primary:
         * credit.balance
         */

        if (
            typeof state.getValue ===
                "function"
        ) {

            const value =
                state.getValue(
                    "credit.balance",
                    null
                );


            if (
                value !== null &&
                value !== undefined
            ) {

                return normalizeCredit(
                    value
                );

            }

        }


        /*
         * Fallback:
         * getCredit()
         */

        if (
            typeof state.getCredit ===
                "function"
        ) {

            const credit =
                state.getCredit();


            if (
                credit &&
                credit.balance !==
                    null &&
                credit.balance !==
                    undefined
            ) {

                return normalizeCredit(
                    credit.balance
                );

            }

        }


        return 0;

    }


    /* =====================================================
       SET CREDIT
    ===================================================== */

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
         * Current Vision Video state API
         */

        if (
            typeof state.set ===
                "function"
        ) {

            state.set(
                "credit.balance",
                normalized
            );

        }


        /*
         * Compatibility:
         * jika setCredit tersedia pada
         * versi state berikutnya.
         */

        if (
            typeof state.setCreditBalance ===
                "function"
        ) {

            state.setCreditBalance(
                normalized
            );

        }


        if (
            typeof state.setCredit ===
                "function"
        ) {

            state.setCredit({

                balance:
                    normalized

            });

        }


        updateCreditBadge(
            normalized
        );


        return normalized;

    }


    /* =====================================================
       SET CREDIT OPERATION STATE
    ===================================================== */

    function setCreditOperationState(
        values = {}
    ) {

        const state =
            getState();


        if (
            typeof state.setCredit ===
                "function"
        ) {

            state.setCredit(
                values
            );


            return;

        }


        if (
            typeof state.set ===
                "function"
        ) {

            Object.keys(
                values
            ).forEach(
                function (
                    key
                ) {

                    state.set(
                        `credit.${key}`,
                        values[key]
                    );

                }
            );

        }

    }


    /* =====================================================
       GET CREDIT OPERATION STATE
    ===================================================== */

    function getCreditOperationState() {

        const state =
            getState();


        if (
            typeof state.getCredit ===
                "function"
        ) {

            return (
                state.getCredit() ||
                {}
            );

        }


        if (
            typeof state.getValue ===
                "function"
        ) {

            return (
                state.getValue(
                    "credit",
                    {}
                ) ||
                {}
            );

        }


        return {};

    }


    /* =====================================================
       GET COST
    ===================================================== */

    function getCost() {

        return currentVisionVideoCreditCost;

    }


    /* =====================================================
       HAS ENOUGH CREDIT
    ===================================================== */

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


    /* =====================================================
       ASSERT ENOUGH CREDIT
    ===================================================== */

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
            current <
            cost
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


    /* =====================================================
       BUILD REQUEST
    ===================================================== */

    function buildRequest(
        operation,
        extra = {}
    ) {

        return {

            operation,

            feature_id:
                VISION_VIDEO_CREDIT_CONFIG.featureId,

            amount:
                getCost(),

            ...extra

        };

    }


    /* =====================================================
       SERVER REQUEST
    ===================================================== */

    async function requestServer(
        operation,
        extra = {}
    ) {

        const token =
            await getAccessToken();


        const response =
            await fetch(
                VISION_VIDEO_CREDIT_CONFIG.endpoint,
                {

                    method:
                        "POST",

                    headers: {

                        "Content-Type":
                            "application/json",

                        "Authorization":
                            `Bearer ${token}`

                    },

                    body:
                        JSON.stringify(
                            buildRequest(
                                operation,
                                extra
                            )
                        )

                }
            );


        const rawText =
            await response.text();


        let data =
            {};


        if (
            rawText
        ) {

            try {

                data =
                    JSON.parse(
                        rawText
                    );

            } catch {

                data = {

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

            const error =
                new Error(
                    data?.error ||
                    data?.message ||
                    `Credit request gagal (${response.status}).`
                );


            error.status =
                response.status;


            error.code =
                data?.code ||
                "VISION_VIDEO_CREDIT_REQUEST_FAILED";


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
                    "Vision Video credit operation gagal."
                );


            error.code =
                data.code ||
                "VISION_VIDEO_CREDIT_OPERATION_FAILED";


            error.data =
                data;


            throw error;

        }


        return data || {};

    }


    /* =====================================================
       EXTRACT BALANCE
    ===================================================== */

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


    /* =====================================================
       CHECK CREDIT
    ===================================================== */

    async function checkCredit() {

        const state =
            getState();


        setCreditOperationState({

            checked:
                false

        });


        const response =
            await requestServer(
                VISION_VIDEO_CREDIT_CONFIG
                    .operation
                    .CHECK
            );

        const configuredCost = Number(response?.cost);
        if (!Number.isInteger(configuredCost) || configuredCost < 0) {
            throw new Error("Tarif credit Vision Video dari server tidak valid.");
        }
        currentVisionVideoCreditCost = configuredCost;


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


        updateCreditBadge(
            currentCredits
        );


        const sufficient =
            hasEnoughCredit(
                currentCredits
            );


        setCreditOperationState({

            checked:
                true,

            required:
                getCost()

        });


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


    /* =====================================================
       DEDUCT CREDIT
    ===================================================== */

    async function deductCredit(
        metadata = {}
    ) {

        const creditState =
            getCreditOperationState();


        /*
         * -------------------------------------------------
         * Jangan deduct dua kali.
         * -------------------------------------------------
         */

        if (
            creditState.deducted ===
            true
        ) {

            const current =
                getCurrentCredit();


            updateCreditBadge(
                current
            );


            return {

                alreadyDeducted:
                    true,

                deducted:
                    false,

                credits:
                    current,

                amount:
                    getCost()

            };

        }


        /*
         * -------------------------------------------------
         * Local fast-fail.
         * Server tetap authority.
         * -------------------------------------------------
         */

        assertEnoughCredit();


        /*
         * -------------------------------------------------
         * Server deduction.
         * -------------------------------------------------
         */

        const transactionId =
            createCreditTransactionId();

        const response =
            await requestServer(
                VISION_VIDEO_CREDIT_CONFIG
                    .operation
                    .DEDUCT,

                {

                    feature_id:
                        VISION_VIDEO_CREDIT_CONFIG.featureId,

                    transaction_id:
                        transactionId,

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

        const chargedCost = Number(response?.cost);
        if (!Number.isInteger(chargedCost) || chargedCost < 0) {
            throw new Error("Tarif credit Vision Video dari server tidak valid.");
        }
        currentVisionVideoCreditCost = chargedCost;


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
                Math.max(
                    0,
                    current -
                    getCost()
                )
            );

        }


        setCreditOperationState({

            deducted:
                true,

            transactionId,

            amount:
                chargedCost,

            reserved:
                true,

            refunded:
                false

        });


        const remaining =
            getCurrentCredit();


        updateCreditBadge(
            remaining
        );


        return {

            deducted:
                true,

            transactionId,

            amount:
                chargedCost,

            credits:
                remaining,

            response

        };

    }


    /* =====================================================
       REFUND CREDIT
    ===================================================== */

    async function refundCredit(
        metadata = {}
    ) {

        const creditState =
            getCreditOperationState();


        const deducted =
            creditState.deducted ===
            true;


        const refunded =
            creditState.refunded ===
            true;


        /*
         * Tidak ada deduction.
         */

        if (
            !deducted
        ) {

            const current =
                getCurrentCredit();


            updateCreditBadge(
                current
            );


            return {

                refunded:
                    false,

                skipped:
                    true,

                reason:
                    "Credit belum dideduct.",

                credits:
                    current

            };

        }


        /*
         * Jangan refund dua kali.
         */

        if (
            refunded
        ) {

            const current =
                getCurrentCredit();


            updateCreditBadge(
                current
            );


            return {

                refunded:
                    false,

                skipped:
                    true,

                reason:
                    "Credit sudah direfund.",

                credits:
                    current

            };

        }


        const response =
            await requestServer(
                VISION_VIDEO_CREDIT_CONFIG
                    .operation
                    .REFUND,

                {

                    feature_id:
                        VISION_VIDEO_CREDIT_CONFIG.featureId,

                    transaction_id:
                        creditState.transactionId,

                    task_id:
                        metadata?.taskId ||
                        null,

                    model_id:
                        metadata?.modelId ||
                        null,

                    model_name:
                        metadata?.modelName ||
                        null,

                    error_message:
                        metadata?.errorMessage ||
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


        setCreditOperationState({

            refunded:
                true,

            reserved:
                false

        });


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


    async function completeCredit() {

        const creditState = getCreditOperationState();
        if (!creditState.deducted || !creditState.transactionId || creditState.refunded) {
            return { completed: false, skipped: true };
        }

        const response = await requestServer(
            "vision_credit_complete",
            {
                feature_id: VISION_VIDEO_CREDIT_CONFIG.featureId,
                transaction_id: creditState.transactionId
            }
        );

        setCreditOperationState({
            completed: true,
            reserved: false
        });

        return { completed: true, response };

    }


    /* =====================================================
       RESERVE CREDIT
    ===================================================== */

    function reserveCredit() {

        setCreditOperationState({

            reserved:
                true

        });


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


    /* =====================================================
       RESET OPERATION STATE
    ===================================================== */

    function resetOperationState() {

        setCreditOperationState({

            checked:
                false,

            required:
                getCost(),

            reserved:
                false,

            deducted:
                false,

            refunded:
                false,

            completed:
                false,

            transactionId:
                null

        });


        updateCreditBadge(
            getCurrentCredit()
        );


        return true;

    }


    /* =====================================================
       GET CREDIT STATE
    ===================================================== */

    function getCreditState() {

        const credit =
            getCreditOperationState();


        const credits =
            getCurrentCredit();


        return {

            cost:
                getCost(),

            credits,

            checked:
                Boolean(
                    credit.checked
                ),

            required:
                getCost(),

            reserved:
                Boolean(
                    credit.reserved
                ),

            deducted:
                Boolean(
                    credit.deducted
                ),

            refunded:
                Boolean(
                    credit.refunded
                ),

            transactionId:
                credit.transactionId ||
                null,

            amount:
                Number.isFinite(Number(credit.amount))
                    ? Number(credit.amount)
                    : getCost()

        };

    }


    /* =====================================================
       REFRESH DISPLAY
    ===================================================== */

    function refreshDisplay() {

        const credits =
            getCurrentCredit();


        updateCreditBadge(
            credits
        );


        return credits;

    }


    /* =====================================================
       PUBLIC API
    ===================================================== */

    const GENZVisionVideoCredit =
        Object.freeze({

            CONFIG:
                VISION_VIDEO_CREDIT_CONFIG,

            getSupabaseClient,

            getSession,

            getAccessToken,

            getCost,

            completeCredit,

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


    /* =====================================================
       GLOBAL EXPORT
    ===================================================== */

    window.GENZVisionVideoCredit =
        GENZVisionVideoCredit;


    window.GENZVisionVideoCreditReady =
        true;


    console.log(
        "[GEN-Z.AI Vision Video] Credit module ready."
    );


})();
