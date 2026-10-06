/* =========================================================
   GEN-Z.AI VISION VIDEO
   ---------------------------------------------------------
   File:
   vision-video/assets/js/vision-video-frames.js

   Fungsi:
   - Menentukan timeline frame video
   - Mode AUTO
   - Mode KEYFRAMES
   - Mode UNIFORM
   - Mode DENSE
   - Ekstraksi frame menggunakan HTMLVideoElement + Canvas
   - Tidak mengubah file video asli
   - Tidak melakukan API request
   - Tidak melakukan AI analysis
========================================================= */

(function () {

    "use strict";


    /* =====================================================
       CONFIG
    ===================================================== */

    const CONFIG = Object.freeze({

        defaultMode:
            "auto",

        defaultFrameCount:
            12,

        minimumFrameCount:
            4,

        maximumFrameCount:
            32,

        seekTimeout:
            8000,

        canvasType:
            "image/jpeg",

        canvasQuality:
            0.88,

        modes: Object.freeze([
            "auto",
            "keyframes",
            "uniform",
            "dense"
        ])

    });


    /* =====================================================
       INTERNAL STATE
    ===================================================== */

    let extractionToken = 0;

    let activeVideo = null;

    let eventsBound = false;


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


    function getVideoElement() {

        const preview =
            getPreview();

        if (
            typeof preview.getVideoElement ===
            "function"
        ) {

            return preview.getVideoElement();

        }

        return document.getElementById(
            "visionVideoPreview"
        );

    }


    /* =====================================================
       HELPERS
    ===================================================== */

    function clamp(
        value,
        min,
        max
    ) {

        return Math.min(
            Math.max(
                Number(value) || 0,
                min
            ),
            max
        );

    }


    function normalizeMode(mode) {

        const value =
            String(mode || "")
                .trim()
                .toLowerCase();

        if (
            CONFIG.modes.includes(value)
        ) {

            return value;

        }

        return CONFIG.defaultMode;

    }


    function getDuration(video) {

        const duration =
            Number(
                video &&
                video.duration
            );

        if (
            !Number.isFinite(duration) ||
            duration <= 0
        ) {

            return 0;

        }

        return duration;

    }


    function getVideoDimensions(video) {

        const width =
            Number(
                video &&
                video.videoWidth
            );

        const height =
            Number(
                video &&
                video.videoHeight
            );

        return {

            width:
                Number.isFinite(width)
                    ? width
                    : 0,

            height:
                Number.isFinite(height)
                    ? height
                    : 0

        };

    }


    /* =====================================================
       FRAME COUNT
    ===================================================== */

    function getFrameCount(
        duration,
        mode = CONFIG.defaultMode
    ) {

        const seconds =
            Number(duration);

        const normalizedMode =
            normalizeMode(mode);

        if (
            !Number.isFinite(seconds) ||
            seconds <= 0
        ) {

            return CONFIG.minimumFrameCount;

        }


        /*
         * AUTO
         *
         * Menyesuaikan jumlah frame dengan panjang video.
         */
        if (
            normalizedMode === "auto"
        ) {

            let count;

            if (seconds <= 3) {

                count = 8;

            } else if (seconds <= 8) {

                count = 10;

            } else if (seconds <= 15) {

                count = 12;

            } else if (seconds <= 30) {

                count = 16;

            } else if (seconds <= 60) {

                count = 20;

            } else if (seconds <= 120) {

                count = 24;

            } else {

                count = 28;

            }

            return clamp(
                count,
                CONFIG.minimumFrameCount,
                CONFIG.maximumFrameCount
            );

        }


        /*
         * KEYFRAMES
         *
         * Ini bukan codec I-frame.
         * Yang diambil adalah titik sampling temporal
         * yang diprioritaskan untuk perubahan struktur video.
         */
        if (
            normalizedMode === "keyframes"
        ) {

            return clamp(
                Math.round(
                    Math.min(
                        18,
                        6 + seconds / 8
                    )
                ),
                CONFIG.minimumFrameCount,
                CONFIG.maximumFrameCount
            );

        }


        /*
         * UNIFORM
         */
        if (
            normalizedMode === "uniform"
        ) {

            return clamp(
                Math.round(
                    Math.min(
                        24,
                        seconds * 1.5
                    )
                ),
                CONFIG.minimumFrameCount,
                CONFIG.maximumFrameCount
            );

        }


        /*
         * DENSE
         */
        if (
            normalizedMode === "dense"
        ) {

            return clamp(
                Math.round(
                    Math.min(
                        32,
                        Math.max(
                            12,
                            seconds * 2.5
                        )
                    )
                ),
                CONFIG.minimumFrameCount,
                CONFIG.maximumFrameCount
            );

        }


        return CONFIG.defaultFrameCount;

    }


    /* =====================================================
       TIMELINE GENERATORS
    ===================================================== */

    function generateUniformTimeline(
        duration,
        count
    ) {

        const seconds =
            Number(duration);

        const total =
            Math.max(
                1,
                Math.round(count)
            );

        if (
            !Number.isFinite(seconds) ||
            seconds <= 0
        ) {

            return [];

        }

        if (
            total === 1
        ) {

            return [
                seconds / 2
            ];

        }


        /*
         * Hindari frame tepat pada timestamp 0.
         */
        const safeStart =
            Math.min(
                0.05,
                seconds * 0.05
            );

        const safeEnd =
            Math.max(
                safeStart,
                seconds -
                Math.min(
                    0.05,
                    seconds * 0.05
                )
            );

        const result = [];

        for (
            let i = 0;
            i < total;
            i++
        ) {

            const ratio =
                i / (total - 1);

            const timestamp =
                safeStart +
                (
                    safeEnd -
                    safeStart
                ) *
                ratio;

            result.push(
                timestamp
            );

        }

        return result;

    }


    function generateKeyframeTimeline(
        duration,
        count
    ) {

        const seconds =
            Number(duration);

        if (
            !Number.isFinite(seconds) ||
            seconds <= 0
        ) {

            return [];

        }

        const points = [];

        const anchors = [

            0.03,
            0.10,
            0.25,
            0.40,
            0.50,
            0.60,
            0.75,
            0.90,
            0.97

        ];


        anchors.forEach(
            function (ratio) {

                if (
                    ratio >= 0 &&
                    ratio <= 1
                ) {

                    points.push(
                        seconds * ratio
                    );

                }

            }
        );


        const target =
            Math.max(
                CONFIG.minimumFrameCount,
                Math.round(count)
            );


        if (
            points.length < target
        ) {

            const extra =
                generateUniformTimeline(
                    seconds,
                    target
                );

            extra.forEach(
                function (timestamp) {

                    points.push(
                        timestamp
                    );

                }
            );

        }


        return normalizeTimeline(
            points,
            seconds
        ).slice(
            0,
            CONFIG.maximumFrameCount
        );

    }


    function generateDenseTimeline(
        duration,
        count
    ) {

        const seconds =
            Number(duration);

        const target =
            Math.max(
                CONFIG.minimumFrameCount,
                Math.round(count)
            );

        return generateUniformTimeline(
            seconds,
            target
        );

    }


    /* =====================================================
       TIMELINE NORMALIZATION
    ===================================================== */

    function normalizeTimeline(
        timestamps,
        duration
    ) {

        const seconds =
            Number(duration);

        if (
            !Array.isArray(timestamps) ||
            !Number.isFinite(seconds) ||
            seconds <= 0
        ) {

            return [];

        }

        const safeMargin =
            Math.min(
                0.05,
                seconds * 0.05
            );

        const safeStart =
            Math.min(
                safeMargin,
                seconds
            );

        const safeEnd =
            Math.max(
                safeStart,
                seconds -
                safeMargin
            );


        const values =
            timestamps
                .map(
                    function (value) {

                        return Number(
                            value
                        );

                    }
                )
                .filter(
                    function (value) {

                        return (
                            Number.isFinite(value) &&
                            value >= 0 &&
                            value <= seconds
                        );

                    }
                )
                .map(
                    function (value) {

                        return clamp(
                            value,
                            safeStart,
                            safeEnd
                        );

                    }
                )
                .sort(
                    function (a, b) {

                        return a - b;

                    }
                );


        const result = [];


        values.forEach(
            function (value) {

                if (
                    result.length === 0
                ) {

                    result.push(
                        value
                    );

                    return;

                }


                const previous =
                    result[
                        result.length - 1
                    ];


                /*
                 * Dedupe timestamp yang terlalu dekat.
                 */
                if (
                    Math.abs(
                        value - previous
                    ) > 0.08
                ) {

                    result.push(
                        value
                    );

                }

            }
        );


        return result;

    }


    /* =====================================================
       BUILD TIMELINE
    ===================================================== */

    function buildTimeline(
        duration,
        mode = CONFIG.defaultMode,
        requestedCount = null
    ) {

        const seconds =
            Number(duration);

        const normalizedMode =
            normalizeMode(mode);

        if (
            !Number.isFinite(seconds) ||
            seconds <= 0
        ) {

            return [];

        }


        const count =
            requestedCount !== null &&
            Number.isFinite(
                Number(requestedCount)
            )
                ? clamp(
                    Number(requestedCount),
                    CONFIG.minimumFrameCount,
                    CONFIG.maximumFrameCount
                )
                : getFrameCount(
                    seconds,
                    normalizedMode
                );


        let timeline;


        switch (
            normalizedMode
        ) {

            case "keyframes":

                timeline =
                    generateKeyframeTimeline(
                        seconds,
                        count
                    );

                break;


            case "dense":

                timeline =
                    generateDenseTimeline(
                        seconds,
                        count
                    );

                break;


            case "uniform":

                timeline =
                    generateUniformTimeline(
                        seconds,
                        count
                    );

                break;


            case "auto":

            default:

                /*
                 * AUTO menggunakan kombinasi anchor
                 * temporal dan uniform sampling.
                 */
                timeline =
                    generateKeyframeTimeline(
                        seconds,
                        count
                    );


                if (
                    timeline.length < count
                ) {

                    timeline =
                        generateUniformTimeline(
                            seconds,
                            count
                        );

                }

                break;

        }


        return normalizeTimeline(
            timeline,
            seconds
        ).slice(
            0,
            CONFIG.maximumFrameCount
        );

    }


    /* =====================================================
       VIDEO SEEK
    ===================================================== */

    function waitForSeek(
        video,
        timestamp,
        token
    ) {

        if (!video) {

            return Promise.reject(
                new Error(
                    "Video element tidak tersedia."
                )
            );

        }


        if (
            token !== extractionToken
        ) {

            return Promise.reject(
                new DOMException(
                    "Frame extraction dibatalkan.",
                    "AbortError"
                )
            );

        }


        const target =
            Number(timestamp);


        if (
            !Number.isFinite(target)
        ) {

            return Promise.reject(
                new Error(
                    "Timestamp frame tidak valid."
                )
            );

        }


        return new Promise(
            function (resolve, reject) {

                let timeoutId =
                    null;

                let finished =
                    false;


                function cleanup() {

                    video.removeEventListener(
                        "seeked",
                        onSeeked
                    );

                    video.removeEventListener(
                        "error",
                        onError
                    );


                    if (
                        timeoutId !== null
                    ) {

                        clearTimeout(
                            timeoutId
                        );

                    }

                }


                function finish(
                    callback,
                    value
                ) {

                    if (
                        finished
                    ) {

                        return;

                    }

                    finished = true;

                    cleanup();

                    callback(
                        value
                    );

                }


                function onSeeked() {

                    if (
                        token !== extractionToken
                    ) {

                        finish(
                            reject,
                            new DOMException(
                                "Frame extraction dibatalkan.",
                                "AbortError"
                            )
                        );

                        return;

                    }


                    finish(
                        resolve,
                        true
                    );

                }


                function onError() {

                    finish(
                        reject,
                        new Error(
                            "Video gagal melakukan seek ke frame."
                        )
                    );

                }


                video.addEventListener(
                    "seeked",
                    onSeeked
                );

                video.addEventListener(
                    "error",
                    onError
                );


                timeoutId =
                    setTimeout(
                        function () {

                            finish(
                                reject,
                                new Error(
                                    "Timeout saat mencari frame video."
                                )
                            );

                        },
                        CONFIG.seekTimeout
                    );


                try {

                    video.currentTime =
                        target;

                } catch (error) {

                    finish(
                        reject,
                        error
                    );

                }

            }
        );

    }


    /* =====================================================
       CANVAS
    ===================================================== */

    function createCanvas(
        width,
        height
    ) {

        const canvas =
            document.createElement(
                "canvas"
            );


        canvas.width =
            Math.max(
                1,
                Math.round(width)
            );


        canvas.height =
            Math.max(
                1,
                Math.round(height)
            );


        return canvas;

    }


    /* =====================================================
       FRAME TO BLOB
    ===================================================== */

    function captureFrame(
        video,
        timestamp,
        index,
        token
    ) {

        if (
            token !== extractionToken
        ) {

            return Promise.reject(
                new DOMException(
                    "Frame extraction dibatalkan.",
                    "AbortError"
                )
            );

        }


        return waitForSeek(
            video,
            timestamp,
            token
        )
            .then(
                function () {

                    if (
                        token !== extractionToken
                    ) {

                        throw new DOMException(
                            "Frame extraction dibatalkan.",
                            "AbortError"
                        );

                    }


                    const width =
                        Number(
                            video.videoWidth
                        );


                    const height =
                        Number(
                            video.videoHeight
                        );


                    if (
                        !width ||
                        !height
                    ) {

                        throw new Error(
                            "Dimensi video belum tersedia."
                        );

                    }


                    const canvas =
                        createCanvas(
                            width,
                            height
                        );


                    const context =
                        canvas.getContext(
                            "2d",
                            {
                                alpha: false
                            }
                        );


                    if (!context) {

                        throw new Error(
                            "Canvas 2D tidak tersedia."
                        );

                    }


                    context.drawImage(
                        video,
                        0,
                        0,
                        width,
                        height
                    );


                    return new Promise(
                        function (
                            resolve,
                            reject
                        ) {

                            canvas.toBlob(
                                function (blob) {

                                    if (!blob) {

                                        reject(
                                            new Error(
                                                "Frame gagal dikonversi menjadi image."
                                            )
                                        );

                                        return;

                                    }


                                    resolve({

                                        index,

                                        timestamp:
                                            Number(
                                                timestamp
                                            ),

                                        width,

                                        height,

                                        blob,

                                        url:
                                            URL.createObjectURL(
                                                blob
                                            )

                                    });

                                },
                                CONFIG.canvasType,
                                CONFIG.canvasQuality
                            );

                        }
                    );

                }
            );

    }


    /* =====================================================
       EXTRACT FRAMES
    ===================================================== */

    async function extractFrames(
        options = {}
    ) {

        const {

            mode =
                CONFIG.defaultMode,

            count =
                null,

            video =
                null,

            store =
                true,

            onProgress =
                null

        } = options;


        const currentToken =
            ++extractionToken;


        const videoElement =
            video ||
            getVideoElement();


        if (!videoElement) {

            throw new Error(
                "Video preview tidak ditemukan."
            );

        }


        activeVideo =
            videoElement;


        const duration =
            getDuration(
                videoElement
            );


        if (
            duration <= 0
        ) {

            throw new Error(
                "Durasi video belum tersedia."
            );

        }


        const dimensions =
            getVideoDimensions(
                videoElement
            );


        if (
            dimensions.width <= 0 ||
            dimensions.height <= 0
        ) {

            throw new Error(
                "Resolusi video belum tersedia."
            );

        }


        const normalizedMode =
            normalizeMode(
                mode
            );


        const timeline =
            buildTimeline(
                duration,
                normalizedMode,
                count
            );


        if (
            timeline.length === 0
        ) {

            throw new Error(
                "Tidak ada timestamp frame yang dapat diekstrak."
            );

        }


        const originalTime =
            Number(
                videoElement.currentTime
            ) || 0;


        const wasPaused =
            videoElement.paused;


        const frames = [];


        try {

            /*
             * Pause agar extraction tidak berjalan
             * melawan playback video.
             */
            videoElement.pause();


            for (
                let i = 0;
                i < timeline.length;
                i++
            ) {

                if (
                    currentToken !== extractionToken
                ) {

                    throw new DOMException(
                        "Frame extraction dibatalkan.",
                        "AbortError"
                    );

                }


                const timestamp =
                    timeline[i];


                const frame =
                    await captureFrame(
                        videoElement,
                        timestamp,
                        i,
                        currentToken
                    );


                frames.push(
                    frame
                );


                if (
                    typeof onProgress ===
                    "function"
                ) {

                    onProgress({

                        current:
                            i + 1,

                        total:
                            timeline.length,

                        progress:
                            Math.round(
                                (
                                    (i + 1) /
                                    timeline.length
                                ) *
                                100
                            ),

                        timestamp,

                        frame

                    });

                }

            }


            /*
             * Simpan ke State bila diminta.
             */
            if (
                store
            ) {

                const state =
                    getState();


                if (
                    typeof state.setFrames ===
                    "function"
                ) {

                    state.setFrames({

                        mode:
                            normalizedMode,

                        timeline,

                        items:
                            frames,

                        count:
                            frames.length

                    });

                }

            }


            return {

                mode:
                    normalizedMode,

                timeline,

                frames,

                count:
                    frames.length,

                duration,

                width:
                    dimensions.width,

                height:
                    dimensions.height

            };

        } catch (error) {

            /*
             * Jika extraction gagal, jangan meninggalkan
             * frame object URL yang sudah dibuat.
             */
            revokeFrameURLs(
                frames
            );

            throw error;

        } finally {

            /*
             * Kembalikan posisi preview.
             */
            try {

                videoElement.currentTime =
                    originalTime;

            } catch (error) {

                /* no-op */

            }


            if (
                !wasPaused
            ) {

                try {

                    await videoElement.play();

                } catch (error) {

                    /*
                     * Playback policy tidak boleh
                     * menggagalkan extraction.
                     */

                }

            }


            activeVideo =
                null;

        }

    }


    /* =====================================================
       REVOKE FRAME URLS
    ===================================================== */

    function revokeFrameURLs(
        frames
    ) {

        if (
            !Array.isArray(frames)
        ) {

            return;

        }


        frames.forEach(
            function (frame) {

                if (
                    frame &&
                    typeof frame.url ===
                    "string" &&
                    frame.url
                ) {

                    try {

                        URL.revokeObjectURL(
                            frame.url
                        );

                    } catch (error) {

                        /* no-op */

                    }

                }

            }
        );

    }


    /* =====================================================
       CLEAR FRAMES
    ===================================================== */

    function clearFrames() {

        extractionToken++;


        const state =
            getState();


        let frames = null;


        if (
            typeof state.getValue ===
            "function"
        ) {

            const frameState =
                state.getValue(
                    "frames"
                );


            if (
                frameState
            ) {

                frames =
                    frameState.items ||
                    frameState.frames ||
                    null;

            }

        }


        if (
            Array.isArray(frames)
        ) {

            revokeFrameURLs(
                frames
            );

        }


        if (
            typeof state.setFrames ===
            "function"
        ) {

            state.setFrames({

                mode:
                    CONFIG.defaultMode,

                timeline: [],

                items: [],

                count: 0

            });

        }

    }


    /* =====================================================
       CANCEL
    ===================================================== */

    function cancel() {

        extractionToken++;


        if (
            activeVideo
        ) {

            try {

                activeVideo.pause();

            } catch (error) {

                /* no-op */

            }

        }


        activeVideo =
            null;

    }


    /* =====================================================
       FRAME DATA FOR API
    ===================================================== */

    function getFrames() {

        const state =
            getState();


        if (
            typeof state.getValue ===
            "function"
        ) {

            const frameState =
                state.getValue(
                    "frames"
                );


            if (
                frameState
            ) {

                return (
                    frameState.items ||
                    frameState.frames ||
                    []
                );

            }

        }


        if (
            typeof state.get ===
            "function"
        ) {

            const frameState =
                state.get(
                    "frames"
                );


            if (
                frameState
            ) {

                return (
                    frameState.items ||
                    frameState.frames ||
                    []
                );

            }

        }


        return [];

    }


    /* =====================================================
       GET TIMELINE
    ===================================================== */

    function getTimeline() {

        const state =
            getState();


        if (
            typeof state.getValue ===
            "function"
        ) {

            const frameState =
                state.getValue(
                    "frames"
                );


            if (
                frameState &&
                Array.isArray(
                    frameState.timeline
                )
            ) {

                return [
                    ...frameState.timeline
                ];

            }

        }


        return [];

    }


    /* =====================================================
       EVENT HANDLERS
    ===================================================== */

    function handleMetadataReady(
        event
    ) {

        /*
         * Metadata baru berarti frame lama
         * tidak lagi dapat dianggap valid.
         */
        clearFrames();

    }


    function handlePreviewCleared() {

        clearFrames();

    }


    /* =====================================================
       BIND
    ===================================================== */

    function bind() {

        /*
         * Jangan menggunakan
         * GENZVisionVideoFramesReady sebagai guard.
         *
         * Ready berarti API module sudah tersedia,
         * bukan berarti event listener sudah dipasang.
         */
        if (
            eventsBound
        ) {

            return true;

        }


        if (
            !window.GENZVisionVideoState ||
            !window.GENZVisionVideoDOM ||
            !window.GENZVisionVideoPreview
        ) {

            return false;

        }


        document.addEventListener(
            "genz:vision-video:metadata-ready",
            handleMetadataReady
        );


        document.addEventListener(
            "genz:vision-video:preview-cleared",
            handlePreviewCleared
        );


        eventsBound =
            true;


        console.log(
            "[GEN-Z.AI Vision Video] Frames module ready."
        );


        return true;

    }


    /* =====================================================
       PUBLIC API
    ===================================================== */

    const API = Object.freeze({

        getFrameCount,

        generateUniformTimeline,

        generateKeyframeTimeline,

        generateDenseTimeline,

        normalizeTimeline,

        buildTimeline,

        waitForSeek,

        captureFrame,

        extractFrames,

        revokeFrameURLs,

        clearFrames,

        cancel,

        getFrames,

        getTimeline,

        bind

    });


    /* =====================================================
       EXPORT
    ===================================================== */

    window.GENZVisionVideoFrames =
        API;


    /*
     * Bind status dan API availability dipisahkan.
     *
     * Loader membutuhkan ready flag agar dapat melanjutkan,
     * sedangkan bind membutuhkan dependency yang sudah tersedia.
     */
    window.GENZVisionVideoFramesReady =
        true;


    /* =====================================================
       INITIAL BIND
    ===================================================== */

    function initializeBinding() {

        bind();

    }


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            initializeBinding,
            {
                once: true
            }
        );

    } else {

        initializeBinding();

    }


})();
