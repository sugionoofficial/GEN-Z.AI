/* =========================================================
   GEN-Z.AI VISION VIDEO
   ---------------------------------------------------------
   File:
   vision-video/assets/js/vision-video-events.js

   Fungsi:
   - Event coordinator Vision Video
   - Analyze button
   - Premium loading overlay
   - Sinkronisasi form ke state
   - Validasi video
   - CHECK credit
   - DEDUCT 1 credit
   - Menjalankan analysis preparation
   - Menjalankan API analysis
   - Menyimpan hasil ke generation_history
   - REFUND credit jika proses analysis gagal
   - Reset / cancel process

   ATURAN:
   - 1 generate prompt = 1 credit
   - Credit hanya dideduct satu kali
   - Credit tidak dideduct jika validasi gagal
   - Credit direfund jika proses setelah deduction gagal
   - History success disimpan setelah prompt berhasil
   - History failure disimpan ketika proses gagal
   - Tidak menyentuh Vision Image
========================================================= */

(function () {

    "use strict";


    /* =====================================================
       CONFIGURATION
    ===================================================== */

    const CONFIG = Object.freeze({

        creditCost:
            1,

        events: {

            metadataReady:
                "genz:vision-video:metadata-ready",

            fileSelected:
                "genz:vision-video:file-selected",

            fileRemoved:
                "genz:vision-video:file-removed",

            previewCleared:
                "genz:vision-video:preview-cleared",

            analysisPrepared:
                "genz:vision-video:analysis-prepared",

            analysisError:
                "genz:vision-video:analysis-error",

            apiStart:
                "genz:vision-video:api-start",

            apiComplete:
                "genz:vision-video:api-analysis-complete",

            apiError:
                "genz:vision-video:api-analysis-error",

            processProgress:
                "genz:vision-video:process-progress",

            processComplete:
                "genz:vision-video:process-complete"

        },

        premiumLoading: {

            id:
                "genzVisionVideoPremiumLoading",

            title:
                "GEN-Z.AI Vision",

            subtitle:
                "Video Analysis Engine"

        }

    });


    /* =====================================================
       DEPENDENCIES
    ===================================================== */

    function getState() {

        if (
            !window.GENZVisionVideoState
        ) {

            throw new Error(
                "GEN-Z.AI Vision Video State belum tersedia."
            );
        }

        return window.GENZVisionVideoState;
    }


    function getDOM() {

        if (
            !window.GENZVisionVideoDOM
        ) {

            throw new Error(
                "GEN-Z.AI Vision Video DOM belum tersedia."
            );
        }

        return window.GENZVisionVideoDOM;
    }


    function getAnalysis() {

        if (
            !window.GENZVisionVideoAnalysis
        ) {

            throw new Error(
                "GEN-Z.AI Vision Video Analysis belum tersedia."
            );
        }

        return window.GENZVisionVideoAnalysis;
    }


    function getAPI() {

        if (
            !window.GENZVisionVideoAPI
        ) {

            throw new Error(
                "GEN-Z.AI Vision Video API belum tersedia."
            );
        }

        return window.GENZVisionVideoAPI;
    }


    function getUI() {

        if (
            !window.GENZVisionVideoUI
        ) {

            throw new Error(
                "GEN-Z.AI Vision Video UI belum tersedia."
            );
        }

        return window.GENZVisionVideoUI;
    }


    function getCredit() {

        if (
            !window.GENZVisionVideoCredit
        ) {

            throw new Error(
                "GEN-Z.AI Vision Video Credit belum tersedia."
            );
        }

        return window.GENZVisionVideoCredit;
    }


    function getHistory() {

        if (
            !window.GENZVisionVideoHistory
        ) {

            throw new Error(
                "GEN-Z.AI Vision Video History belum tersedia."
            );
        }

        return window.GENZVisionVideoHistory;
    }


    /* =====================================================
       PREMIUM LOADING
    ===================================================== */

    let premiumLoadingElement =
        null;


    let premiumLoadingVisible =
        false;


    function injectPremiumLoadingStyles() {

        const styleId =
            "genz-vision-video-premium-loading-style";


        if (
            document.getElementById(
                styleId
            )
        ) {

            return;

        }


        const style =
            document.createElement(
                "style"
            );


        style.id =
            styleId;


        style.textContent = `

            #genzVisionVideoPremiumLoading {

                position: fixed;

                inset: 0;

                z-index: 2147483000;

                display: flex;

                align-items: center;

                justify-content: center;

                padding: 24px;

                background:
                    radial-gradient(
                        circle at center,
                        rgba(40, 0, 0, 0.38),
                        rgba(3, 3, 7, 0.96) 58%,
                        rgba(0, 0, 0, 0.99)
                    );

                backdrop-filter:
                    blur(14px);

                -webkit-backdrop-filter:
                    blur(14px);

                opacity: 0;

                visibility: hidden;

                pointer-events: none;

                transition:
                    opacity 0.25s ease,
                    visibility 0.25s ease;

            }


            #genzVisionVideoPremiumLoading.is-visible {

                opacity: 1;

                visibility: visible;

                pointer-events: auto;

            }


            #genzVisionVideoPremiumLoading
            .genz-vv-loading-card {

                position: relative;

                width: min(
                    430px,
                    calc(100vw - 40px)
                );

                padding: 34px 30px 30px;

                border:
                    1px solid
                    rgba(255, 40, 40, 0.42);

                border-radius: 24px;

                background:
                    linear-gradient(
                        145deg,
                        rgba(25, 7, 10, 0.96),
                        rgba(7, 7, 12, 0.98)
                    );

                box-shadow:
                    0 0 0 1px
                    rgba(255, 0, 0, 0.06),
                    0 0 28px
                    rgba(255, 0, 0, 0.18),
                    0 0 80px
                    rgba(255, 0, 0, 0.08),
                    inset 0 1px 0
                    rgba(255, 255, 255, 0.06);

                overflow: hidden;

                transform:
                    translateY(10px)
                    scale(0.98);

                transition:
                    transform 0.3s ease;

            }


            #genzVisionVideoPremiumLoading.is-visible
            .genz-vv-loading-card {

                transform:
                    translateY(0)
                    scale(1);

            }


            #genzVisionVideoPremiumLoading
            .genz-vv-loading-card::before {

                content: "";

                position: absolute;

                top: -90px;

                left: 50%;

                width: 240px;

                height: 180px;

                transform:
                    translateX(-50%);

                background:
                    radial-gradient(
                        circle,
                        rgba(255, 25, 25, 0.18),
                        transparent 70%
                    );

                pointer-events: none;

            }


            #genzVisionVideoPremiumLoading
            .genz-vv-loading-card::after {

                content: "";

                position: absolute;

                inset: 0;

                border-radius: inherit;

                pointer-events: none;

                box-shadow:
                    inset 0 0 40px
                    rgba(255, 0, 0, 0.035);

            }


            #genzVisionVideoPremiumLoading
            .genz-vv-loading-brand {

                position: relative;

                z-index: 2;

                text-align: center;

                margin-bottom: 24px;

            }


            #genzVisionVideoPremiumLoading
            .genz-vv-loading-brand-name {

                font-size: 17px;

                font-weight: 800;

                letter-spacing: 0.18em;

                color: #ffffff;

                text-transform: uppercase;

                text-shadow:
                    0 0 12px
                    rgba(255, 40, 40, 0.55);

            }


            #genzVisionVideoPremiumLoading
            .genz-vv-loading-brand-subtitle {

                margin-top: 6px;

                font-size: 10px;

                font-weight: 600;

                letter-spacing: 0.2em;

                text-transform: uppercase;

                color:
                    rgba(255, 150, 150, 0.7);

            }


            #genzVisionVideoPremiumLoading
            .genz-vv-loading-orbit {

                position: relative;

                z-index: 2;

                width: 112px;

                height: 112px;

                margin: 0 auto 25px;

                display: flex;

                align-items: center;

                justify-content: center;

            }


            #genzVisionVideoPremiumLoading
            .genz-vv-loading-ring {

                position: absolute;

                inset: 0;

                border-radius: 50%;

                border:
                    2px solid
                    rgba(255, 255, 255, 0.06);

                border-top-color:
                    rgba(255, 40, 40, 0.95);

                border-right-color:
                    rgba(255, 70, 70, 0.45);

                animation:
                    genzVisionSpin
                    1.15s linear infinite;

                box-shadow:
                    0 0 14px
                    rgba(255, 0, 0, 0.22);

            }


            #genzVisionVideoPremiumLoading
            .genz-vv-loading-ring-secondary {

                position: absolute;

                inset: 10px;

                border-radius: 50%;

                border:
                    1px dashed
                    rgba(255, 100, 100, 0.28);

                animation:
                    genzVisionSpinReverse
                    2.4s linear infinite;

            }


            #genzVisionVideoPremiumLoading
            .genz-vv-loading-core {

                width: 52px;

                height: 52px;

                border-radius: 16px;

                display: flex;

                align-items: center;

                justify-content: center;

                background:
                    radial-gradient(
                        circle at 35% 30%,
                        rgba(255, 100, 100, 0.32),
                        rgba(80, 0, 0, 0.32)
                    );

                border:
                    1px solid
                    rgba(255, 80, 80, 0.35);

                box-shadow:
                    0 0 20px
                    rgba(255, 0, 0, 0.18),
                    inset 0 0 18px
                    rgba(255, 0, 0, 0.08);

                animation:
                    genzVisionPulse
                    1.8s ease-in-out infinite;

            }


            #genzVisionVideoPremiumLoading
            .genz-vv-loading-core::before {

                content: "";

                width: 12px;

                height: 12px;

                border-radius: 50%;

                background:
                    #ff3b3b;

                box-shadow:
                    0 0 8px
                    #ff2020,
                    0 0 22px
                    rgba(255, 20, 20, 0.8);

            }


            #genzVisionVideoPremiumLoading
            .genz-vv-loading-status {

                position: relative;

                z-index: 2;

                min-height: 24px;

                text-align: center;

                color: #ffffff;

                font-size: 14px;

                font-weight: 700;

                letter-spacing: 0.01em;

            }


            #genzVisionVideoPremiumLoading
            .genz-vv-loading-detail {

                position: relative;

                z-index: 2;

                margin-top: 7px;

                min-height: 18px;

                text-align: center;

                color:
                    rgba(255, 255, 255, 0.48);

                font-size: 11px;

                font-weight: 500;

            }


            #genzVisionVideoPremiumLoading
            .genz-vv-loading-progress {

                position: relative;

                z-index: 2;

                height: 4px;

                margin-top: 22px;

                overflow: hidden;

                border-radius: 999px;

                background:
                    rgba(255, 255, 255, 0.07);

                box-shadow:
                    inset 0 0 5px
                    rgba(0, 0, 0, 0.5);

            }


            #genzVisionVideoPremiumLoading
            .genz-vv-loading-progress-bar {

                width: 0%;

                height: 100%;

                border-radius: inherit;

                background:
                    linear-gradient(
                        90deg,
                        #ff1515,
                        #ff5757,
                        #ff1515
                    );

                box-shadow:
                    0 0 10px
                    rgba(255, 30, 30, 0.7);

                transition:
                    width 0.35s ease;

            }


            #genzVisionVideoPremiumLoading
            .genz-vv-loading-percent {

                position: relative;

                z-index: 2;

                margin-top: 9px;

                text-align: right;

                color:
                    rgba(255, 100, 100, 0.8);

                font-size: 10px;

                font-weight: 700;

                letter-spacing: 0.08em;

            }


            @keyframes genzVisionSpin {

                from {
                    transform: rotate(0deg);
                }

                to {
                    transform: rotate(360deg);
                }

            }


            @keyframes genzVisionSpinReverse {

                from {
                    transform: rotate(360deg);
                }

                to {
                    transform: rotate(0deg);
                }

            }


            @keyframes genzVisionPulse {

                0%,
                100% {
                    transform: scale(0.94);
                    opacity: 0.82;
                }

                50% {
                    transform: scale(1.04);
                    opacity: 1;
                }

            }


            @media (max-width: 600px) {

                #genzVisionVideoPremiumLoading {

                    padding:
                        18px;

                }


                #genzVisionVideoPremiumLoading
                .genz-vv-loading-card {

                    width:
                        calc(100vw - 32px);

                    padding:
                        28px 22px 24px;

                    border-radius:
                        20px;

                }


                #genzVisionVideoPremiumLoading
                .genz-vv-loading-orbit {

                    width:
                        96px;

                    height:
                        96px;

                }

            }

        `;


        document.head.appendChild(
            style
        );

    }


    function createPremiumLoading() {

        if (
            premiumLoadingElement &&
            document.body.contains(
                premiumLoadingElement
            )
        ) {

            return premiumLoadingElement;

        }


        injectPremiumLoadingStyles();


        let existing =
            document.getElementById(
                CONFIG.premiumLoading.id
            );


        if (existing) {

            premiumLoadingElement =
                existing;

            return existing;

        }


        const overlay =
            document.createElement(
                "div"
            );


        overlay.id =
            CONFIG.premiumLoading.id;


        overlay.setAttribute(
            "aria-hidden",
            "true"
        );


        overlay.innerHTML = `

            <div
                class="genz-vv-loading-card"
                role="status"
                aria-live="polite"
            >

                <div class="genz-vv-loading-brand">

                    <div class="genz-vv-loading-brand-name">
                        ${CONFIG.premiumLoading.title}
                    </div>

                    <div class="genz-vv-loading-brand-subtitle">
                        ${CONFIG.premiumLoading.subtitle}
                    </div>

                </div>


                <div class="genz-vv-loading-orbit">

                    <div
                        class="genz-vv-loading-ring"
                    ></div>

                    <div
                        class="genz-vv-loading-ring-secondary"
                    ></div>

                    <div
                        class="genz-vv-loading-core"
                    ></div>

                </div>


                <div
                    class="genz-vv-loading-status"
                    data-genz-vv-loading-status
                >
                    Menyiapkan analisis video...
                </div>


                <div
                    class="genz-vv-loading-detail"
                    data-genz-vv-loading-detail
                >
                    Vision Engine sedang bekerja
                </div>


                <div
                    class="genz-vv-loading-progress"
                >

                    <div
                        class="genz-vv-loading-progress-bar"
                        data-genz-vv-loading-progress
                    ></div>

                </div>


                <div
                    class="genz-vv-loading-percent"
                    data-genz-vv-loading-percent
                >
                    0%
                </div>

            </div>

        `;


        document.body.appendChild(
            overlay
        );


        premiumLoadingElement =
            overlay;


        return overlay;

    }


    function setPremiumLoading(
        visible,
        message,
        progress,
        detail
    ) {

        try {

            const overlay =
                createPremiumLoading();


            if (!overlay) {

                return;

            }


            if (!visible) {

                overlay.classList.remove(
                    "is-visible"
                );


                overlay.setAttribute(
                    "aria-hidden",
                    "true"
                );


                premiumLoadingVisible =
                    false;


                return;

            }


            const safeProgress =
                Math.max(
                    0,
                    Math.min(
                        100,
                        Number(progress) || 0
                    )
                );


            const status =
                overlay.querySelector(
                    "[data-genz-vv-loading-status]"
                );


            const detailElement =
                overlay.querySelector(
                    "[data-genz-vv-loading-detail]"
                );


            const progressBar =
                overlay.querySelector(
                    "[data-genz-vv-loading-progress]"
                );


            const percent =
                overlay.querySelector(
                    "[data-genz-vv-loading-percent]"
                );


            if (status) {

                status.textContent =
                    message ||
                    "Memproses video...";

            }


            if (detailElement) {

                detailElement.textContent =
                    detail ||
                    "Vision Engine sedang bekerja";

            }


            if (progressBar) {

                progressBar.style.width =
                    `${safeProgress}%`;

            }


            if (percent) {

                percent.textContent =
                    `${Math.round(safeProgress)}%`;

            }


            overlay.classList.add(
                "is-visible"
            );


            overlay.setAttribute(
                "aria-hidden",
                "false"
            );


            premiumLoadingVisible =
                true;

        } catch (error) {

            console.warn(
                "[GEN-Z.AI Vision Video] Premium loading warning:",
                error
            );

        }

    }


    function hidePremiumLoading() {

        setPremiumLoading(
            false
        );

    }


    function updatePremiumLoading(
        message,
        progress,
        detail
    ) {

        if (
            !premiumLoadingVisible
        ) {

            return;

        }


        setPremiumLoading(
            true,
            message,
            progress,
            detail
        );

    }


    /* =====================================================
       EVENT DISPATCH
    ===================================================== */

    function dispatch(
        name,
        detail = {}
    ) {

        try {

            document.dispatchEvent(
                new CustomEvent(
                    name,
                    {
                        detail
                    }
                )
            );

        } catch (error) {

            console.warn(
                "[GEN-Z.AI Vision Video] Event dispatch gagal:",
                name,
                error
            );
        }
    }


    /* =====================================================
       FORM VALUE
    ===================================================== */

    function readValue(
        key
    ) {

        const dom =
            getDOM();


        const element =
            dom.get(key);


        if (!element) {

            return "";

        }


        return (
            element.value ??
            ""
        );
    }


    /* =====================================================
       FORM BOOLEAN
    ===================================================== */

    function readChecked(
        key
    ) {

        const dom =
            getDOM();


        const element =
            dom.get(key);


        if (!element) {

            return false;

        }


        return Boolean(
            element.checked
        );
    }


    /* =====================================================
       SYNC FORM TO STATE
    ===================================================== */

    function syncFormToState() {

        const state =
            getState();


        const settings = {

            model:
                readValue(
                    "model"
                ).trim(),

            detail:
                readValue(
                    "detail"
                ).trim() ||
                "standard",

            frameMode:
                readValue(
                    "frameMode"
                ).trim() ||
                "auto",

            purpose:
                readValue(
                    "purpose"
                ).trim() ||
                "general",

            instruction:
                readValue(
                    "instruction"
                ).trim()

        };


        state.setSettings(
            settings
        );


        return settings;
    }


    /* =====================================================
       READ CURRENT SETTINGS
    ===================================================== */

    function getCurrentSettings() {

        const state =
            getState();


        const settings =
            state.getValue(
                "settings",
                {}
            ) || {};


        return {

            model:
                settings.model ||
                "",

            detail:
                settings.detail ||
                "standard",

            frameMode:
                settings.frameMode ||
                "auto",

            purpose:
                settings.purpose ||
                "general",

            instruction:
                settings.instruction ||
                ""

        };
    }


    /* =====================================================
       VALIDATE VIDEO
    ===================================================== */

    function validateVideo() {

        const state =
            getState();


        const file =
            state.getValue(
                "video.file",
                null
            );


        if (!file) {

            return {

                valid:
                    false,

                message:
                    "Silakan upload video terlebih dahulu."

            };
        }


        const duration =
            Number(
                state.getValue(
                    "video.duration",
                    0
                )
            );


        if (
            !Number.isFinite(duration) ||
            duration <= 0
        ) {

            return {

                valid:
                    false,

                message:
                    "Metadata video belum siap."

            };
        }


        const width =
            Number(
                state.getValue(
                    "video.width",
                    0
                )
            );


        const height =
            Number(
                state.getValue(
                    "video.height",
                    0
                )
            );


        if (
            !Number.isFinite(width) ||
            !Number.isFinite(height) ||
            width <= 0 ||
            height <= 0
        ) {

            return {

                valid:
                    false,

                message:
                    "Resolusi video belum dapat dibaca."

            };
        }


        return {

            valid:
                true,

            message:
                ""

        };
    }


    /* =====================================================
       VALIDATE SETTINGS
    ===================================================== */

    function validateSettings() {

        const settings =
            getCurrentSettings();


        if (!settings.model) {

            return {

                valid:
                    false,

                message:
                    "Model Vision Video belum dipilih."

            };
        }


        return {

            valid:
                true,

            message:
                ""

        };
    }


    /* =====================================================
       VALIDATE CREDIT
    ===================================================== */

    function validateCreditLocal() {

        const credit =
            getCredit();


        const required =
            typeof credit.getCost ===
                "function"
                ? credit.getCost()
                : CONFIG.creditCost;


        const current =
            typeof credit.getCurrentCredit ===
                "function"
                ? credit.getCurrentCredit()
                : 0;


        if (
            current <
            required
        ) {

            const error =
                new Error(
                    `Credit tidak mencukupi. Diperlukan ${required} credit, saldo saat ini ${current} credit.`
                );


            error.code =
                "INSUFFICIENT_CREDITS";


            error.currentCredits =
                current;


            error.requiredCredits =
                required;


            throw error;

        }


        return true;
    }


    /* =====================================================
       VALIDATE COMPLETE FORM
    ===================================================== */

    function validateForm() {

        const video =
            validateVideo();


        if (!video.valid) {

            return video;

        }


        const settings =
            validateSettings();


        if (!settings.valid) {

            return settings;

        }


        return {

            valid:
                true,

            message:
                ""

        };
    }


    /* =====================================================
       PROGRESS
    ===================================================== */

    function setProgress(
        progress,
        message
    ) {

        const state =
            getState();


        const value =
            Math.max(
                0,
                Math.min(
                    100,
                    Number(progress) || 0
                )
            );


        state.setProcess({

            progress:
                value,

            message:
                message ||
                ""

        });


        updatePremiumLoading(
            message,
            value
        );


        dispatch(
            CONFIG.events.processProgress,
            {

                progress:
                    value,

                message:
                    message ||
                    ""

            }
        );
    }


    /* =====================================================
       PREPARATION PROGRESS
    ===================================================== */

    function handlePreparationProgress(
        progress
    ) {

        const value =
            Number(progress);


        if (
            !Number.isFinite(value)
        ) {

            return;

        }


        setProgress(
            value,
            "Menyiapkan frame video..."
        );

    }


    /* =====================================================
       BUILD ANALYSIS PAYLOAD
    ===================================================== */

    async function prepareAnalysis() {

        const analysis =
            getAnalysis();


        const settings =
            getCurrentSettings();


        return analysis.prepareAnalysis({

            mode:
                settings.frameMode,

            detail:
                settings.detail,

            purpose:
                settings.purpose,

            includeDataURL:
                true,

            onProgress:
                handlePreparationProgress

        });
    }


    /* =====================================================
       RUN API ANALYSIS
    ===================================================== */

    async function runAPIAnalysis(
        prepared
    ) {

        const api =
            getAPI();


        if (
            !prepared ||
            !prepared.payload
        ) {

            throw new Error(
                "Analysis payload belum tersedia."
            );
        }


        setProgress(
            60,
            "Mengirim frame ke Vision Engine..."
        );


        const settings =
            getCurrentSettings();


        const result =
            await api.analyze(
                prepared.payload,
                {

                    model:
                        settings.model,

                    detail:
                        settings.detail

                }
            );


        setProgress(
            90,
            "Menyusun hasil analysis..."
        );


        return result;
    }


    /* =====================================================
       GENERATE PROMPT FROM ANALYSIS
    ===================================================== */

    function buildPromptFromAnalysis(
        result
    ) {

        if (!result) {

            return "";

        }


        const content =
            typeof result.content ===
                "string"
                ? result.content.trim()
                : "";


        if (!content) {

            return "";

        }


        return content;
    }


    /* =====================================================
       STORE PROMPT
    ===================================================== */

    function storePrompt(
        result
    ) {

        const state =
            getState();


        const prompt =
            buildPromptFromAnalysis(
                result
            );


        if (!prompt) {

            return "";

        }


        state.setPrompt(
            prompt
        );


        return prompt;
    }


    /* =====================================================
       CREATE PROCESS TASK ID
    ===================================================== */

    function ensureTaskId() {

        const state =
            getState();


        const existing =
            String(
                state.getValue(
                    "process.taskId",
                    ""
                ) ||
                ""
            ).trim();


        if (existing) {

            return existing;

        }


        const history =
            getHistory();


        const taskId =
            history.createTaskId();


        state.setProcess({

            taskId

        });


        return taskId;
    }


    /* =====================================================
       CREDIT METADATA
    ===================================================== */

    function getCreditMetadata() {

        const settings =
            getCurrentSettings();


        const taskId =
            ensureTaskId();


        return {

            taskId,

            modelId:
                settings.model,

            modelName:
                settings.model

        };
    }


    /* =====================================================
       CHECK CREDIT
    ===================================================== */

    async function checkCredit() {

        const credit =
            getCredit();


        const result =
            await credit.checkCredit();


        if (
            !result ||
            result.sufficient !== true
        ) {

            const error =
                new Error(
                    "Credit tidak mencukupi."
                );


            error.code =
                "INSUFFICIENT_CREDITS";


            throw error;

        }


        return result;
    }


    /* =====================================================
       DEDUCT CREDIT
    ===================================================== */

    async function deductCredit() {

        const credit =
            getCredit();


        const metadata =
            getCreditMetadata();


        credit.resetOperationState();


        await checkCredit();


        const result =
            await credit.deductCredit(
                metadata
            );


        if (
            !result ||
            (
                result.deducted !== true &&
                result.alreadyDeducted !== true
            )
        ) {

            throw new Error(
                "Credit gagal dipotong."
            );

        }


        return result;
    }


    /* =====================================================
       REFUND CREDIT
    ===================================================== */

    async function refundCredit() {

        const credit =
            getCredit();


        const creditState =
            credit.getCreditState();


        if (
            !creditState.deducted ||
            creditState.refunded
        ) {

            return {

                refunded:
                    false,

                skipped:
                    true

            };

        }


        const metadata =
            getCreditMetadata();


        return credit.refundCredit(
            metadata
        );
    }


    /* =====================================================
       SAVE SUCCESS HISTORY
    ===================================================== */

    async function saveSuccessHistory(
        prompt
    ) {

        const state =
            getState();


        const history =
            getHistory();


        const settings =
            getCurrentSettings();


        const taskId =
            ensureTaskId();


        const result =
            await history.saveSuccess({

                taskId,

                model:
                    settings.model,

                modelName:
                    settings.model,

                prompt,

                settings,

                file:
                    state.getValue(
                        "video",
                        {}
                    ),

                creditCost:
                    CONFIG.creditCost

            });


        return result;
    }


    /* =====================================================
       SAVE FAILED HISTORY
    ===================================================== */

    async function saveFailedHistory(
        error
    ) {

        const state =
            getState();


        const history =
            getHistory();


        const settings =
            getCurrentSettings();


        const taskId =
            ensureTaskId();


        try {

            return await history.saveFailed(
                error,
                {

                    taskId,

                    model:
                        settings.model,

                    modelName:
                        settings.model,

                    settings,

                    file:
                        state.getValue(
                            "video",
                            {}
                        ),

                    creditCost:
                        CONFIG.creditCost

                }
            );

        } catch (historyError) {

            console.warn(
                "[GEN-Z.AI Vision Video] Failed history save gagal:",
                historyError
            );


            return null;
        }
    }


    /* =====================================================
       MAIN ANALYZE FLOW
    ===================================================== */

    let analysisRunning =
        false;


    async function analyzeVideo() {

        if (analysisRunning) {

            return null;

        }


        const state =
            getState();


        const ui =
            getUI();


        const validation =
            validateForm();


        if (!validation.valid) {

            ui.renderErrorStatus(
                validation.message
            );


            return null;

        }


        analysisRunning =
            true;


        let creditWasDeducted =
            false;


        let prompt =
            "";


        /*
         * Premium loading dimulai sedini mungkin
         * setelah validasi berhasil.
         */

        setPremiumLoading(
            true,
            "Menyiapkan analisis video...",
            2,
            "GEN-Z.AI Vision Engine"
        );


        try {

            /* =============================================
               FORM
            ============================================= */

            syncFormToState();


            /* =============================================
               RESET RESULT
            ============================================= */

            state.setPrompt(
                ""
            );


            state.setAnalysis({

                status:
                    "preparing",

                result:
                    "",

                raw:
                    null,

                structure:
                    null

            });


            state.setProcess({

                status:
                    "preparing",

                progress:
                    0,

                message:
                    "Menyiapkan analisis video...",

                error:
                    null

            });


            ui.resetResults();


            ui.setAnalyzeButtonLoading(
                true,
                "Memeriksa credit..."
            );


            ui.renderProcessingStatus(
                "Memeriksa credit..."
            );


            setProgress(
                5,
                "Memeriksa credit..."
            );


            updatePremiumLoading(
                "Memeriksa credit...",
                5,
                "Memverifikasi saldo akun"
            );


            /* =============================================
               TASK ID
            ============================================= */

            ensureTaskId();


            /* =============================================
               CREDIT CHECK + DEDUCT
            ============================================= */

            const creditResult =
                await deductCredit();


            creditWasDeducted =
                creditResult.deducted === true ||
                creditResult.alreadyDeducted === true;


            /*
             * UI module tidak menyediakan updateCredit().
             * Fungsi yang benar adalah renderCreditFromState().
             */

            ui.renderCreditFromState();


            setProgress(
                12,
                "Credit terverifikasi. Menyiapkan video..."
            );


            updatePremiumLoading(
                "Credit terverifikasi.",
                12,
                "Menyiapkan video untuk Vision Engine"
            );


            /* =============================================
               PREPARATION
            ============================================= */

            ui.setAnalyzeButtonLoading(
                true,
                "Menyiapkan..."
            );


            ui.renderProcessingStatus(
                "Menyiapkan frame video..."
            );


            updatePremiumLoading(
                "Menyiapkan frame video...",
                15,
                "Mengekstrak informasi visual"
            );


            const prepared =
                await prepareAnalysis();


            if (
                !prepared ||
                !prepared.payload
            ) {

                throw new Error(
                    "Gagal menyiapkan payload analisis video."
                );

            }


            dispatch(
                CONFIG.events.analysisPrepared,
                prepared
            );


            /* =============================================
               API ANALYSIS
            ============================================= */

            state.setProcess({

                status:
                    "analyzing",

                progress:
                    55,

                message:
                    "Menganalisis frame video..."

            });


            ui.setAnalyzeButtonLoading(
                true,
                "Menganalisis..."
            );


            ui.renderProcessingStatus(
                "Menganalisis frame video..."
            );


            updatePremiumLoading(
                "Menganalisis frame video...",
                55,
                "Vision Engine sedang membaca urutan visual"
            );


            dispatch(
                CONFIG.events.apiStart,
                {

                    prepared

                }
            );


            const result =
                await runAPIAnalysis(
                    prepared
                );


            if (!result) {

                throw new Error(
                    "Vision Engine tidak mengembalikan hasil."
                );

            }


            dispatch(
                CONFIG.events.apiComplete,
                {

                    result,

                    prepared

                }
            );


            /* =============================================
               BUILD PROMPT
            ============================================= */

            prompt =
                storePrompt(
                    result
                );


            if (!prompt) {

                throw new Error(
                    "Vision Engine tidak menghasilkan prompt."
                );

            }


            state.setProcess({

                status:
                    "saving",

                progress:
                    94,

                message:
                    "Menyimpan riwayat..."

            });


            ui.renderProcessingStatus(
                "Menyimpan hasil ke history..."
            );


            updatePremiumLoading(
                "Menyimpan hasil analisis...",
                94,
                "Menyelesaikan proses dan mencatat history"
            );


            /* =============================================
               SAVE HISTORY
            ============================================= */

            try {

                await saveSuccessHistory(
                    prompt
                );

            } catch (historyError) {

                console.warn(
                    "[GEN-Z.AI Vision Video] History save gagal:",
                    historyError
                );

            }


            /* =============================================
               COMPLETE
            ============================================= */

            setProgress(
                100,
                "Analisis video selesai."
            );


            updatePremiumLoading(
                "Analisis video selesai.",
                100,
                "Hasil analisis siap digunakan"
            );


            state.completeAnalysis(
                result.content
            );


            state.setProcess({

                status:
                    "complete",

                progress:
                    100,

                message:
                    "Analisis video selesai.",

                error:
                    null

            });


            ui.renderAnalysis(
                result.content
            );


            ui.renderPrompt(
                prompt
            );


            ui.renderSuccessStatus(
                "Analisis video selesai."
            );


            ui.completeProgress();


            ui.setAnalyzeButtonLoading(
                false,
                "Analyze Video"
            );


            ui.renderCreditFromState();


            dispatch(
                CONFIG.events.processComplete,
                {

                    result,

                    prompt,

                    prepared,

                    creditCost:
                        CONFIG.creditCost,

                    creditDeducted:
                        creditWasDeducted

                }
            );


            /*
             * Beri sedikit waktu agar status
             * 100% terlihat sebelum overlay ditutup.
             */

            window.setTimeout(
                function () {

                    hidePremiumLoading();

                },
                450
            );


            return result;

        } catch (error) {

            const message =
                error &&
                error.message
                    ? error.message
                    : "Analisis video gagal.";


            console.error(
                "[GEN-Z.AI Vision Video] Analysis error:",
                error
            );


            /* =============================================
               REFUND
            ============================================= */

            if (
                creditWasDeducted
            ) {

                try {

                    ui.renderProcessingStatus(
                        "Mengembalikan credit..."
                    );


                    updatePremiumLoading(
                        "Mengembalikan credit...",
                        96,
                        "Proses analysis gagal, credit sedang dikembalikan"
                    );


                    await refundCredit();


                    ui.renderCreditFromState();

                } catch (refundError) {

                    console.error(
                        "[GEN-Z.AI Vision Video] Refund credit gagal:",
                        refundError
                    );

                }

            }


            /* =============================================
               FAILED HISTORY
            ============================================= */

            await saveFailedHistory(
                error
            );


            /* =============================================
               ERROR STATE
            ============================================= */

            state.failAnalysis(
                message
            );


            state.setProcess({

                status:
                    "error",

                message:
                    message,

                error:
                    message

            });


            ui.renderErrorStatus(
                message
            );


            ui.setAnalyzeButtonLoading(
                false,
                "Analyze Video"
            );


            ui.renderCreditFromState();


            dispatch(
                CONFIG.events.apiError,
                {

                    error:
                        message

                }
            );


            /*
             * Error harus menutup premium loading.
             */

            hidePremiumLoading();


            return null;

        } finally {

            analysisRunning =
                false;


            ui.updateAnalyzeButton();

        }

    }


    /* =====================================================
       CANCEL
    ===================================================== */

    function cancelAnalysis() {

        const analysis =
            getAnalysis();


        try {

            analysis.cancel();

        } catch (error) {

            console.warn(
                "[GEN-Z.AI Vision Video] Analysis cancel warning:",
                error
            );

        }


        const state =
            getState();


        state.setProcess({

            status:
                "cancelled",

            progress:
                state.getValue(
                    "process.progress",
                    0
                ),

            message:
                "Analisis dibatalkan."

        });


        const ui =
            getUI();


        ui.setAnalyzeButtonLoading(
            false,
            "Analyze Video"
        );


        ui.renderStatus(
            "Analisis dibatalkan.",
            "cancelled"
        );


        hidePremiumLoading();


        analysisRunning =
            false;


        ui.updateAnalyzeButton();

    }


    /* =====================================================
       RESET
    ===================================================== */

    function reset() {

        const state =
            getState();


        try {

            getAnalysis().cancel();

        } catch (error) {

            /*
             * Cancel gagal tidak boleh
             * menghalangi reset UI/state.
             */

        }


        try {

            getCredit().resetOperationState();

        } catch (error) {

            console.warn(
                "[GEN-Z.AI Vision Video] Credit reset warning:",
                error
            );

        }


        state.reset();


        analysisRunning =
            false;


        hidePremiumLoading();


        const ui =
            getUI();


        ui.resetResults();


        ui.renderCreditFromState();


        ui.renderUploadState(
            false
        );


        ui.setAnalyzeButtonLoading(
            false,
            "Analyze Video"
        );


        ui.updateAnalyzeButton();

    }


    /* =====================================================
       FORM EVENTS
    ===================================================== */

    function handleFormChange() {

        try {

            syncFormToState();

            getUI().updateAnalyzeButton();

        } catch (error) {

            console.warn(
                "[GEN-Z.AI Vision Video] Form sync warning:",
                error
            );

        }

    }


    /* =====================================================
       FILE EVENTS
    ===================================================== */

    function handleFileSelected() {

        try {

            syncFormToState();


            getUI().renderUploadState(
                true
            );


            getUI().renderFileInfo();


            getUI().updateAnalyzeButton();

        } catch (error) {

            console.warn(
                "[GEN-Z.AI Vision Video] File selected UI warning:",
                error
            );

        }

    }


    function handleFileRemoved() {

        try {

            hidePremiumLoading();


            getUI().resetResults();


            getUI().renderUploadState(
                false
            );


            getUI().updateAnalyzeButton();

        } catch (error) {

            console.warn(
                "[GEN-Z.AI Vision Video] File remove UI warning:",
                error
            );

        }

    }


    /* =====================================================
       BUTTON BINDING
    ===================================================== */

    let bound =
        false;


    function bind() {

        if (bound) {

            return;

        }


        bound =
            true;


        const dom =
            getDOM();


        const analyzeButton =
            dom.get(
                "analyzeButton"
            );


        if (analyzeButton) {

            analyzeButton.addEventListener(
                "click",
                function (event) {

                    event.preventDefault();


                    if (
                        analysisRunning
                    ) {

                        return;

                    }


                    analyzeVideo();

                }
            );

        }


        [
            "model",
            "detail",
            "frameMode",
            "purpose",
            "instruction"

        ].forEach(
            function (
                key
            ) {

                const field =
                    dom.get(
                        key
                    );


                if (!field) {

                    return;

                }


                field.addEventListener(
                    "change",
                    handleFormChange
                );


                field.addEventListener(
                    "input",
                    handleFormChange
                );

            }
        );


        document.addEventListener(
            CONFIG.events.fileSelected,
            handleFileSelected
        );


        document.addEventListener(
            CONFIG.events.fileRemoved,
            handleFileRemoved
        );


        document.addEventListener(
            CONFIG.events.metadataReady,
            function () {

                getUI().renderVideoMetadata();


                getUI().updateAnalyzeButton();

            }
        );


        document.addEventListener(
            CONFIG.events.apiStart,
            function () {

                getUI().setAnalyzeButtonLoading(
                    true,
                    "Menganalisis..."
                );


                getUI().renderProcessingStatus(
                    "Mengirim frame video ke Vision Engine..."
                );


                updatePremiumLoading(
                    "Mengirim frame video ke Vision Engine...",
                    60,
                    "Vision Engine menerima data visual"
                );

            }
        );


        document.addEventListener(
            CONFIG.events.apiComplete,
            function (event) {

                const result =
                    event &&
                    event.detail &&
                    event.detail.result
                        ? event.detail.result
                        : null;


                if (!result) {

                    return;

                }

            }
        );


        document.addEventListener(
            CONFIG.events.apiError,
            function (event) {

                const error =
                    event &&
                    event.detail
                        ? event.detail.error
                        : "";


                if (error) {

                    getUI().renderErrorStatus(
                        error
                    );


                    hidePremiumLoading();

                }

            }
        );


        document.addEventListener(
            CONFIG.events.analysisError,
            function (event) {

                const error =
                    event &&
                    event.detail
                        ? event.detail.error
                        : "";


                if (error) {

                    getUI().renderErrorStatus(
                        error
                    );


                    hidePremiumLoading();

                }

            }
        );


        document.addEventListener(
            "keydown",
            function (event) {

                if (
                    event.key !==
                    "Escape"
                ) {

                    return;

                }


                if (
                    !analysisRunning
                ) {

                    return;

                }


                cancelAnalysis();

            }
        );


        syncFormToState();


        getUI().sync();

    }


    /* =====================================================
       PUBLIC API
    ===================================================== */

    const API = {

        config:
            CONFIG,

        syncFormToState,

        getCurrentSettings,

        validateVideo,

        validateSettings,

        validateCreditLocal,

        validateForm,

        setProgress,

        prepareAnalysis,

        runAPIAnalysis,

        buildPromptFromAnalysis,

        storePrompt,

        ensureTaskId,

        checkCredit,

        deductCredit,

        refundCredit,

        saveSuccessHistory,

        saveFailedHistory,

        analyzeVideo,

        cancelAnalysis,

        reset,

        bind,

        setPremiumLoading,

        hidePremiumLoading,

        updatePremiumLoading,

        isRunning:
            function () {

                return analysisRunning;

            }

    };


    /* =====================================================
       GLOBAL EXPORT
    ===================================================== */

    window.GENZVisionVideoEvents =
        API;


    window.GENZVisionVideoEventsReady =
        true;


    /* =====================================================
       AUTO BIND
    ===================================================== */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            bind,
            {
                once:
                    true
            }
        );

    } else {

        bind();

    }


    console.log(
        "[GEN-Z.AI Vision Video] Events module ready."
    );

})();
