/* =========================================================
   GEN-Z.AI VISION
   ---------------------------------------------------------
   File:
   vision/assets/js/vision-premium.js

   Fungsi:
   - Full-screen premium loading overlay
   - Muncul saat proses Vision berjalan
   - Spinner orbit + ring + pulse
   - Progress bar + status + detail
   - Otomatis ter-hook dari vision-ui.js setProcessing()

   Tidak menangani:
   - API
   - Credit
   - History
   - Upload
========================================================= */

(function () {

    "use strict";


    /* =====================================================
       CONFIGURATION
    ===================================================== */

    const CONFIG =
        Object.freeze({

            id:
                "genzVisionPremiumLoading",

            styleId:
                "genz-vision-premium-loading-style",

            title:
                "GEN-Z.AI Vision",

            subtitle:
                "Image Analysis Engine",

            defaultMessage:
                "Memproses gambar...",

            defaultDetail:
                "Vision Engine sedang bekerja"

        });


    /* =====================================================
       INTERNAL STATE
    ===================================================== */

    let overlayElement =
        null;

    let overlayVisible =
        false;


    /* =====================================================
       INJECT STYLES
    ===================================================== */

    function injectStyles() {

        if (
            document.getElementById(
                CONFIG.styleId
            )
        ) {

            return;

        }


        const style =
            document.createElement(
                "style"
            );


        style.id =
            CONFIG.styleId;


        style.textContent = `

            #${CONFIG.id} {

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


            #${CONFIG.id}.is-visible {

                opacity: 1;

                visibility: visible;

                pointer-events: auto;

            }


            #${CONFIG.id}
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


            #${CONFIG.id}.is-visible
            .genz-vv-loading-card {

                transform:
                    translateY(0)
                    scale(1);

            }


            #${CONFIG.id}
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


            #${CONFIG.id}
            .genz-vv-loading-brand {

                position: relative;

                z-index: 2;

                text-align: center;

                margin-bottom: 24px;

            }


            #${CONFIG.id}
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


            #${CONFIG.id}
            .genz-vv-loading-brand-subtitle {

                margin-top: 6px;

                font-size: 10px;

                font-weight: 600;

                letter-spacing: 0.2em;

                text-transform: uppercase;

                color:
                    rgba(255, 150, 150, 0.7);

            }


            #${CONFIG.id}
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


            #${CONFIG.id}
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


            #${CONFIG.id}
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


            #${CONFIG.id}
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


            #${CONFIG.id}
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


            #${CONFIG.id}
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


            #${CONFIG.id}
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


            #${CONFIG.id}
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


            #${CONFIG.id}
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


            #${CONFIG.id}
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

                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }

            }


            @keyframes genzVisionSpinReverse {

                from { transform: rotate(360deg); }
                to { transform: rotate(0deg); }

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

                #${CONFIG.id} {

                    padding: 18px;

                }


                #${CONFIG.id}
                .genz-vv-loading-card {

                    width:
                        calc(100vw - 32px);

                    padding:
                        28px 22px 24px;

                    border-radius:
                        20px;

                }


                #${CONFIG.id}
                .genz-vv-loading-orbit {

                    width: 96px;

                    height: 96px;

                }

            }

        `;


        document.head.appendChild(
            style
        );

    }


    /* =====================================================
       CREATE OVERLAY
    ===================================================== */

    function createOverlay() {

        if (
            overlayElement &&
            document.body.contains(
                overlayElement
            )
        ) {

            return overlayElement;

        }


        injectStyles();


        const existing =
            document.getElementById(
                CONFIG.id
            );


        if (existing) {

            overlayElement =
                existing;

            return existing;

        }


        const overlay =
            document.createElement(
                "div"
            );


        overlay.id =
            CONFIG.id;


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
                        ${CONFIG.title}
                    </div>

                    <div class="genz-vv-loading-brand-subtitle">
                        ${CONFIG.subtitle}
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
                    ${CONFIG.defaultMessage}
                </div>


                <div
                    class="genz-vv-loading-detail"
                    data-genz-vv-loading-detail
                >
                    ${CONFIG.defaultDetail}
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


        overlayElement =
            overlay;


        return overlay;

    }


    /* =====================================================
       SET PREMIUM LOADING
    ===================================================== */

    function setPremiumLoading(
        visible,
        message,
        progress,
        detail
    ) {

        try {

            const overlay =
                createOverlay();


            if (!overlay) {

                return false;

            }


            /* -------- HIDE -------- */

            if (!visible) {

                overlay.classList.remove(
                    "is-visible"
                );


                overlay.setAttribute(
                    "aria-hidden",
                    "true"
                );


                overlayVisible =
                    false;


                return true;

            }


            /* -------- SHOW -------- */

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
                    CONFIG.defaultMessage;

            }


            if (detailElement) {

                detailElement.textContent =
                    detail ||
                    CONFIG.defaultDetail;

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


            overlayVisible =
                true;


            return true;

        } catch (error) {

            console.warn(
                "[GEN-Z.AI Vision] Premium loading error:",
                error
            );


            return false;

        }

    }


    /* =====================================================
       HIDE PREMIUM LOADING
    ===================================================== */

    function hidePremiumLoading() {

        setPremiumLoading(
            false
        );

    }


    /* =====================================================
       UPDATE PREMIUM LOADING
    ===================================================== */

    function updatePremiumLoading(
        message,
        progress,
        detail
    ) {

        if (
            !overlayVisible
        ) {

            return false;

        }


        return setPremiumLoading(
            true,
            message,
            progress,
            detail
        );

    }


    /* =====================================================
       IS VISIBLE
    ===================================================== */

    function isVisible() {

        return overlayVisible;

    }


    /* =====================================================
       PUBLIC API
    ===================================================== */

    const GENZVisionPremium =
        Object.freeze({

            config:
                CONFIG,

            setPremiumLoading,

            hidePremiumLoading,

            updatePremiumLoading,

            isVisible

        });


    /* =====================================================
       GLOBAL EXPORT
    ===================================================== */

    window.GENZVisionPremium =
        GENZVisionPremium;


    console.info(
        "[GEN-Z.AI Vision] Premium loading module ready."
    );

})();
