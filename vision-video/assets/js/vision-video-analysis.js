/* =========================================================
   GEN-Z.AI VISION VIDEO
   ---------------------------------------------------------
   File:
   vision-video/assets/js/vision-video-analysis.js

   Fungsi:
   - Orchestrate video analysis workflow
   - Mengambil metadata video
   - Menentukan frame sampling
   - Menjalankan frame extraction
   - Menyusun temporal context
   - Menyusun analysis payload
   - Menyimpan hasil intermediate ke State
   - Tidak melakukan HTTP/API request
   - Tidak membuat prompt AI final
========================================================= */

(function () {

    "use strict";


    /* =====================================================
       CONFIG
    ===================================================== */

    const CONFIG = Object.freeze({

        defaultMode:
            "auto",

        defaultDetail:
            "standard",

        defaultPurpose:
            "general",

        /*
         * Jumlah maksimum frame yang dikirim ke layer
         * analysis. Extraction sendiri juga dibatasi.
         */
        maximumAnalysisFrames:
            32,

        /*
         * Durasi maksimum yang digunakan sebagai basis
         * temporal sampling calculation.
         */
        minimumSceneDuration:
            0.20,

        /*
         * Threshold sederhana untuk mendeteksi perubahan
         * posisi sampling, bukan computer vision scene
         * detection penuh.
         */
        sceneGapThreshold:
            2.5

    });


    /* =====================================================
       DEPENDENCIES
    ===================================================== */

    function getState() {

        const state =
            window.GENZVisionVideoState;

        if (!state) {

            throw new Error(
                "[GEN-Z.AI Vision Video] State module tidak tersedia."
            );

        }

        return state;

    }


    function getDOM() {

        const dom =
            window.GENZVisionVideoDOM;

        if (!dom) {

            throw new Error(
                "[GEN-Z.AI Vision Video] DOM module tidak tersedia."
            );

        }

        return dom;

    }


    function getPreview() {

        const preview =
            window.GENZVisionVideoPreview;

        if (!preview) {

            throw new Error(
                "[GEN-Z.AI Vision Video] Preview module tidak tersedia."
            );

        }

        return preview;

    }


    function getFramesModule() {

        const frames =
            window.GENZVisionVideoFrames;

        if (!frames) {

            throw new Error(
                "[GEN-Z.AI Vision Video] Frames module tidak tersedia."
            );

        }

        return frames;

    }


    /* =====================================================
       INTERNAL STATE
    ===================================================== */

    let analysisToken = 0;
    let active = false;


    /* =====================================================
       HELPERS
    ===================================================== */

    function numberOrZero(value) {

        const number =
            Number(value);

        return Number.isFinite(number)
            ? number
            : 0;

    }


    function clamp(
        value,
        min,
        max
    ) {

        return Math.min(
            Math.max(
                numberOrZero(value),
                min
            ),
            max
        );

    }


    function normalizeString(
        value,
        fallback = ""
    ) {

        const result =
            String(
                value === undefined ||
                value === null
                    ? ""
                    : value
            ).trim();

        return result ||
            fallback;

    }


    function normalizeDetail(
        detail
    ) {

        const value =
            normalizeString(
                detail,
                CONFIG.defaultDetail
            ).toLowerCase();

        if (
            value === "high" ||
            value === "ultra"
        ) {

            return value;

        }

        return "standard";

    }


    function normalizePurpose(
        purpose
    ) {

        const value =
            normalizeString(
                purpose,
                CONFIG.defaultPurpose
            ).toLowerCase();

        const allowed = [
            "general",
            "tiktok_affiliate",
            "product_video",
            "cinematic",
            "advertising",
            "ai_video"
        ];

        if (
            allowed.includes(value)
        ) {

            return value;

        }

        return CONFIG.defaultPurpose;

    }


    function normalizeFrameMode(
        mode
    ) {

        const value =
            normalizeString(
                mode,
                CONFIG.defaultMode
            ).toLowerCase();

        const allowed = [
            "auto",
            "keyframes",
            "uniform",
            "dense"
        ];

        return allowed.includes(value)
            ? value
            : CONFIG.defaultMode;

    }


    /* =====================================================
       READ STATE
    ===================================================== */

    function getVideoState() {

        const state =
            getState();

        if (
            typeof state.getValue ===
            "function"
        ) {

            return (
                state.getValue(
                    "video"
                ) || {}
            );

        }

        if (
            typeof state.get ===
            "function"
        ) {

            return (
                state.get(
                    "video"
                ) || {}
            );

        }

        return {};

    }


    function getSettingsState() {

        const state =
            getState();

        if (
            typeof state.getValue ===
            "function"
        ) {

            return (
                state.getValue(
                    "settings"
                ) || {}
            );

        }

        if (
            typeof state.get ===
            "function"
        ) {

            return (
                state.get(
                    "settings"
                ) || {}
            );

        }

        return {};

    }


    function getAnalysisState() {

        const state =
            getState();

        if (
            typeof state.getValue ===
            "function"
        ) {

            return (
                state.getValue(
                    "analysis"
                ) || {}
            );

        }

        if (
            typeof state.get ===
            "function"
        ) {

            return (
                state.get(
                    "analysis"
                ) || {}
            );

        }

        return {};

    }


    /* =====================================================
       VIDEO METADATA
    ===================================================== */

    function getVideoMetadata() {

        const videoState =
            getVideoState();

        const metadata =
            videoState.metadata ||
            {};

        const preview =
            getPreview();

        const video =
            typeof preview.getVideoElement ===
            "function"
                ? preview.getVideoElement()
                : document.getElementById(
                    "visionVideoPreview"
                );


        const duration =
            numberOrZero(
                metadata.duration
            ) ||
            numberOrZero(
                video &&
                video.duration
            );


        const width =
            numberOrZero(
                metadata.width
            ) ||
            numberOrZero(
                video &&
                video.videoWidth
            );


        const height =
            numberOrZero(
                metadata.height
            ) ||
            numberOrZero(
                video &&
                video.videoHeight
            );


        const fps =
            numberOrZero(
                metadata.fps
            );


        return {

            duration,

            width,

            height,

            fps,

            aspectRatio:
                width > 0 &&
                height > 0
                    ? width / height
                    : 0

        };

    }


    /* =====================================================
       SETTINGS
    ===================================================== */

    function getAnalysisSettings() {

        const settings =
            getSettingsState();

        return {

            model:
                normalizeString(
                    settings.model
                ),

            detail:
                normalizeDetail(
                    settings.detail
                ),

            frameMode:
                normalizeFrameMode(
                    settings.frameMode
                ),

            purpose:
                normalizePurpose(
                    settings.purpose
                ),

            instruction:
                normalizeString(
                    settings.instruction
                )

        };

    }


    /* =====================================================
       TIMELINE DESCRIPTION
    ===================================================== */

    function describeTimeline(
        timestamps,
        duration
    ) {

        if (
            !Array.isArray(timestamps) ||
            timestamps.length === 0
        ) {

            return [];

        }

        const totalDuration =
            numberOrZero(
                duration
            );


        return timestamps.map(
            function (
                timestamp,
                index
            ) {

                const time =
                    numberOrZero(
                        timestamp
                    );

                const ratio =
                    totalDuration > 0
                        ? clamp(
                            time /
                            totalDuration,
                            0,
                            1
                        )
                        : 0;


                let position =
                    "middle";


                if (
                    ratio <= 0.10
                ) {

                    position =
                        "opening";

                } else if (
                    ratio >= 0.90
                ) {

                    position =
                        "ending";

                }


                return {

                    index,

                    timestamp:
                        time,

                    relativePosition:
                        position,

                    normalizedPosition:
                        ratio

                };

            }
        );

    }


    /* =====================================================
       TEMPORAL SEGMENTS
    ===================================================== */

    function buildTemporalSegments(
        timestamps,
        duration
    ) {

        const values =
            Array.isArray(
                timestamps
            )
                ? timestamps
                    .map(
                        numberOrZero
                    )
                    .sort(
                        function (a, b) {
                            return a - b;
                        }
                    )
                : [];


        if (
            values.length === 0
        ) {

            return [];

        }


        const totalDuration =
            numberOrZero(
                duration
            );


        const segments = [];


        for (
            let i = 0;
            i < values.length;
            i++
        ) {

            const start =
                values[i];


            const next =
                i < values.length - 1
                    ? values[i + 1]
                    : totalDuration;


            const end =
                Math.max(
                    start,
                    next
                );


            const segmentDuration =
                Math.max(
                    CONFIG.minimumSceneDuration,
                    end - start
                );


            segments.push({

                index:
                    i,

                start:

                    start,

                end:

                    Math.min(
                        end,
                        totalDuration ||
                        end
                    ),

                duration:
                    segmentDuration

            });

        }


        return segments;

    }


    /* =====================================================
       SCENE CANDIDATES
       -----------------------------------------------------
       Ini bukan scene detection AI. Hanya memberi struktur
       temporal kepada API agar model dapat membandingkan
       frame secara berurutan.
    ===================================================== */

    function detectSceneCandidates(
        timestamps,
        duration
    ) {

        const values =
            Array.isArray(
                timestamps
            )
                ? timestamps
                    .map(
                        numberOrZero
                    )
                    .sort(
                        function (a, b) {
                            return a - b;
                        }
                    )
                : [];


        if (
            values.length === 0
        ) {

            return [];

        }


        const scenes = [];

        let sceneStart =
            values[0];


        for (
            let i = 1;
            i < values.length;
            i++
        ) {

            const previous =
                values[i - 1];

            const current =
                values[i];


            const gap =
                current -
                previous;


            if (
                gap >
                CONFIG.sceneGapThreshold
            ) {

                scenes.push({

                    start:
                        sceneStart,

                    end:
                        previous,

                    duration:
                        Math.max(
                            0,
                            previous -
                            sceneStart
                        )

                });


                sceneStart =
                    current;

            }

        }


        const totalDuration =
            numberOrZero(
                duration
            );


        scenes.push({

            start:
                sceneStart,

            end:
                totalDuration ||
                values[values.length - 1],

            duration:
                Math.max(
                    0,
                    (
                        totalDuration ||
                        values[values.length - 1]
                    ) -
                    sceneStart
                )

        });


        return scenes;

    }


    /* =====================================================
       FRAME SERIALIZATION
       -----------------------------------------------------
       Blob tetap dipertahankan agar API module dapat memilih
       cara transport yang sesuai. Data URI hanya dibuat
       ketika diminta secara eksplisit.
    ===================================================== */

    async function blobToDataURL(
        blob
    ) {

        if (
            !(blob instanceof Blob)
        ) {

            throw new Error(
                "Frame blob tidak valid."
            );

        }


        return new Promise(
            function (
                resolve,
                reject
            ) {

                const reader =
                    new FileReader();


                reader.onload =
                    function () {

                        resolve(
                            String(
                                reader.result ||
                                ""
                            )
                        );

                    };


                reader.onerror =
                    function () {

                        reject(
                            new Error(
                                "Frame gagal dikonversi."
                            )
                        );

                    };


                reader.readAsDataURL(
                    blob
                );

            }
        );

    }


    async function serializeFrames(
        frames,
        options = {}
    ) {

        const {

            includeDataURL =
                false,

            maximum =
                CONFIG.maximumAnalysisFrames

        } = options;


        if (
            !Array.isArray(frames)
        ) {

            return [];

        }


        const selected =
            frames.slice(
                0,
                Math.max(
                    1,
                    Math.min(
                        maximum,
                        CONFIG.maximumAnalysisFrames
                    )
                )
            );


        const result = [];


        for (
            let i = 0;
            i < selected.length;
            i++
        ) {

            const frame =
                selected[i];


            if (!frame) {

                continue;

            }


            const item = {

                index:
                    numberOrZero(
                        frame.index
                    ),

                timestamp:
                    numberOrZero(
                        frame.timestamp
                    ),

                width:
                    numberOrZero(
                        frame.width
                    ),

                height:
                    numberOrZero(
                        frame.height
                    ),

                mimeType:
                    frame.blob instanceof Blob
                        ? frame.blob.type
                        : "image/jpeg",

                blob:
                    frame.blob || null,

                url:
                    normalizeString(
                        frame.url
                    )

            };


            if (
                includeDataURL &&
                frame.blob instanceof Blob
            ) {

                item.dataURL =
                    await blobToDataURL(
                        frame.blob
                    );

            }


            result.push(
                item
            );

        }


        return result;

    }


    /* =====================================================
       BUILD ANALYSIS CONTEXT
    ===================================================== */

    function buildAnalysisContext(
        extraction
    ) {

        const metadata =
            getVideoMetadata();


        const settings =
            getAnalysisSettings();


        const frames =
            extraction &&
            Array.isArray(
                extraction.frames
            )
                ? extraction.frames
                : [];


        const timeline =
            extraction &&
            Array.isArray(
                extraction.timeline
            )
                ? extraction.timeline
                : frames.map(
                    function (frame) {
                        return frame.timestamp;
                    }
                );


        const timelineDescription =
            describeTimeline(
                timeline,
                metadata.duration
            );


        const temporalSegments =
            buildTemporalSegments(
                timeline,
                metadata.duration
            );


        const sceneCandidates =
            detectSceneCandidates(
                timeline,
                metadata.duration
            );


        return {

            video: {

                duration:
                    metadata.duration,

                width:
                    metadata.width,

                height:
                    metadata.height,

                fps:
                    metadata.fps,

                aspectRatio:
                    metadata.aspectRatio

            },

            settings: {

                model:
                    settings.model,

                detail:
                    settings.detail,

                frameMode:
                    settings.frameMode,

                purpose:
                    settings.purpose,

                instruction:
                    settings.instruction

            },

            sampling: {

                mode:
                    extraction.mode,

                frameCount:
                    frames.length,

                timeline:
                    timelineDescription

            },

            temporal: {

                segments:
                    temporalSegments,

                sceneCandidates:
                    sceneCandidates

            }

        };

    }


    /* =====================================================
       BUILD API PAYLOAD
       -----------------------------------------------------
       Payload ini sengaja netral terhadap provider.
       vision-video-api.js yang menentukan endpoint dan
       transport.
    ===================================================== */

    async function buildAnalysisPayload(
        extraction,
        options = {}
    ) {

        const {

            includeDataURL =
                true

        } = options;


        const context =
            buildAnalysisContext(
                extraction
            );


        const serializedFrames =
            await serializeFrames(
                extraction &&
                extraction.frames
                    ? extraction.frames
                    : [],
                {
                    includeDataURL
                }
            );


        return {

            type:
                "vision_video_analysis",

            version:
                "1.0",

            context,

            frames:
                serializedFrames

        };

    }


    /* =====================================================
       STORE ANALYSIS INTERMEDIATE
    ===================================================== */

    function storeAnalysisContext(
        context
    ) {

        const state =
            getState();


        if (
            typeof state.setAnalysis !==
            "function"
        ) {

            return;

        }


        const previous =
            getAnalysisState();


        state.setAnalysis({

            ...previous,

            context,

            status:
                "prepared"

        });

    }


    /* =====================================================
       PROGRESS
    ===================================================== */

    function updateProgress(
        current,
        total,
        detail = ""
    ) {

        const dom =
            getDOM();


        const safeTotal =
            Math.max(
                1,
                numberOrZero(
                    total
                )
            );


        const safeCurrent =
            clamp(
                current,
                0,
                safeTotal
            );


        const progress =
            Math.round(
                (
                    safeCurrent /
                    safeTotal
                ) *
                100
            );


        dom.text(
            "progressText",
            detail
                ? `${progress}% • ${detail}`
                : `${progress}%`
        );


        const progressBar =
            dom.get(
                "progressBar"
            );


        if (
            progressBar
        ) {

            progressBar.style.width =
                `${progress}%`;

        }


        const state =
            getState();


        if (
            typeof state.setProcess ===
            "function"
        ) {

            state.setProcess({

                progress,

                message:
                    detail

            });

        }

    }


    /* =====================================================
       PREPARE ANALYSIS
    ===================================================== */

    async function prepareAnalysis(
        options = {}
    ) {

        if (
            active
        ) {

            throw new Error(
                "Analisis video sedang berjalan."
            );

        }


        const currentToken =
            ++analysisToken;


        active =
            true;


        const state =
            getState();


        try {

            const metadata =
                getVideoMetadata();


            if (
                metadata.duration <= 0
            ) {

                throw new Error(
                    "Durasi video tidak tersedia."
                );

            }


            if (
                metadata.width <= 0 ||
                metadata.height <= 0
            ) {

                throw new Error(
                    "Resolusi video tidak tersedia."
                );

            }


            const settings =
                getAnalysisSettings();


            const mode =
                normalizeFrameMode(
                    options.mode ||
                    settings.frameMode
                );


            const frameCount =
                options.count !== undefined &&
                options.count !== null
                    ? Number(
                        options.count
                    )
                    : null;


            if (
                typeof state.startAnalysis ===
                "function"
            ) {

                state.startAnalysis();

            }


            updateProgress(
                5,
                100,
                "Menyiapkan video"
            );


            const framesModule =
                getFramesModule();


            if (
                currentToken !== analysisToken
            ) {

                throw new DOMException(
                    "Analisis dibatalkan.",
                    "AbortError"
                );

            }


            updateProgress(
                12,
                100,
                "Menentukan frame"
            );


            const extraction =
                await framesModule.extractFrames({

                    mode,

                    count:
                        frameCount,

                    store:
                        true,

                    onProgress:
                        function (
                            progress
                        ) {

                            const frameProgress =
                                numberOrZero(
                                    progress.progress
                                );


                            updateProgress(

                                15 +
                                (
                                    frameProgress *
                                    0.35
                                ),

                                100,

                                `Mengambil frame ${progress.current}/${progress.total}`

                            );

                        }

                });


            if (
                currentToken !== analysisToken
            ) {

                throw new DOMException(
                    "Analisis dibatalkan.",
                    "AbortError"
                );

            }


            updateProgress(
                55,
                100,
                "Menyusun konteks temporal"
            );


            const context =
                buildAnalysisContext(
                    extraction
                );


            storeAnalysisContext(
                context
            );


            updateProgress(
                65,
                100,
                "Menyiapkan payload"
            );


            const payload =
                await buildAnalysisPayload(
                    extraction,
                    {
                        includeDataURL:
                            options.includeDataURL !==
                            undefined
                                ? Boolean(
                                    options.includeDataURL
                                )
                                : true
                    }
                );


            if (
                currentToken !== analysisToken
            ) {

                throw new DOMException(
                    "Analisis dibatalkan.",
                    "AbortError"
                );

            }


            updateProgress(
                75,
                100,
                "Payload siap"
            );


            if (
                typeof state.setAnalysis ===
                "function"
            ) {

                const previous =
                    getAnalysisState();


                state.setAnalysis({

                    ...previous,

                    context,

                    payload,

                    frames:
                        extraction.frames,

                    status:
                        "ready"

                });

            }


            document.dispatchEvent(
                new CustomEvent(
                    "genz:vision-video:analysis-prepared",
                    {
                        detail: {

                            extraction,

                            context,

                            payload

                        }
                    }
                )
            );


            return {

                extraction,

                context,

                payload

            };

        } catch (error) {

            if (
                typeof state.failAnalysis ===
                "function"
            ) {

                state.failAnalysis(
                    error.message ||
                    "Analisis video gagal."
                );

            }


            document.dispatchEvent(
                new CustomEvent(
                    "genz:vision-video:analysis-error",
                    {
                        detail: {
                            error
                        }
                    }
                )
            );


            throw error;

        } finally {

            active =
                false;

        }

    }


    /* =====================================================
       CANCEL
    ===================================================== */

    function cancel() {

        analysisToken++;

        active =
            false;


        const framesModule =
            window.GENZVisionVideoFrames;


        if (
            framesModule &&
            typeof framesModule.cancel ===
            "function"
        ) {

            framesModule.cancel();

        }


        const state =
            window.GENZVisionVideoState;


        if (
            state &&
            typeof state.setProcess ===
            "function"
        ) {

            state.setProcess({

                status:
                    "cancelled",

                message:
                    "Analisis dibatalkan.",

                progress:
                    0

            });

        }

    }


    /* =====================================================
       IS ACTIVE
    ===================================================== */

    function isActive() {

        return active;

    }


    /* =====================================================
       PUBLIC API
    ===================================================== */

    const API = Object.freeze({

        getVideoMetadata,

        getAnalysisSettings,

        describeTimeline,

        buildTemporalSegments,

        detectSceneCandidates,

        blobToDataURL,

        serializeFrames,

        buildAnalysisContext,

        buildAnalysisPayload,

        storeAnalysisContext,

        updateProgress,

        prepareAnalysis,

        cancel,

        isActive

    });


    /* =====================================================
       EXPORT
    ===================================================== */

    window.GENZVisionVideoAnalysis =
        API;

    window.GENZVisionVideoAnalysisReady =
        true;


    console.log(
        "[GEN-Z.AI Vision Video] Analysis module ready."
    );

})();
