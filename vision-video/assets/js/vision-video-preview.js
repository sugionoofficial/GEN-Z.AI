/* =========================================================
   GEN-Z.AI VISION VIDEO
   ---------------------------------------------------------
   File:
   vision-video/assets/js/vision-video-preview.js

   Fungsi:
   - Menampilkan video preview
   - Menghubungkan video object URL dari State
   - Membaca metadata video
   - Duration
   - Resolution
   - FPS bila tersedia
   - Menampilkan / menyembunyikan upload state
   - Membersihkan preview
   - Tidak melakukan frame extraction
   - Tidak melakukan AI analysis
   - Tidak melakukan API request
========================================================= */

(function () {

    "use strict";


    /* =====================================================
       CONFIG
    ===================================================== */

    const CONFIG = Object.freeze({

        videoElementId:
            "visionVideoPreview",

        uploadStateId:
            "visionVideoUploadState",

        previewStateId:
            "visionVideoPreviewState",

        fileNameId:
            "visionVideoFileName",

        fileSizeId:
            "visionVideoFileSize",

        durationId:
            "visionVideoDuration",

        resolutionId:
            "visionVideoResolution",

        fpsId:
            "visionVideoFPS"

    });


    /* =====================================================
       INTERNAL STATE
    ===================================================== */

    let bound = false;

    let metadataLoadToken = 0;

    let frameRateDetectionActive = false;


    /* =====================================================
       DEPENDENCY
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


    /* =====================================================
       ELEMENT
    ===================================================== */

    function getVideoElement() {

        return document.getElementById(
            CONFIG.videoElementId
        );

    }


    /* =====================================================
       FORMAT FILE SIZE
    ===================================================== */

    function formatFileSize(bytes) {

        const value =
            Number(bytes);

        if (
            !Number.isFinite(value) ||
            value < 0
        ) {

            return "0 B";

        }

        if (value < 1024) {

            return `${value} B`;

        }

        if (value < 1024 * 1024) {

            return `${(
                value / 1024
            ).toFixed(1)} KB`;

        }

        if (value < 1024 * 1024 * 1024) {

            return `${(
                value /
                (1024 * 1024)
            ).toFixed(1)} MB`;

        }

        return `${(
            value /
            (1024 * 1024 * 1024)
        ).toFixed(2)} GB`;

    }


    /* =====================================================
       FORMAT DURATION
    ===================================================== */

    function formatDuration(seconds) {

        const value =
            Number(seconds);

        if (
            !Number.isFinite(value) ||
            value < 0
        ) {

            return "0:00";

        }

        const totalSeconds =
            Math.round(value);

        const hours =
            Math.floor(
                totalSeconds / 3600
            );

        const minutes =
            Math.floor(
                (totalSeconds % 3600) / 60
            );

        const remainingSeconds =
            totalSeconds % 60;

        if (hours > 0) {

            return [
                hours,
                String(minutes).padStart(2, "0"),
                String(remainingSeconds).padStart(2, "0")
            ].join(":");

        }

        return [
            minutes,
            String(remainingSeconds).padStart(2, "0")
        ].join(":");

    }


    /* =====================================================
       FORMAT RESOLUTION
    ===================================================== */

    function formatResolution(
        width,
        height
    ) {

        const w =
            Number(width);

        const h =
            Number(height);

        if (
            !Number.isFinite(w) ||
            !Number.isFinite(h) ||
            w <= 0 ||
            h <= 0
        ) {

            return "Unknown";

        }

        return `${w} × ${h}`;

    }


    /* =====================================================
       FORMAT FPS
    ===================================================== */

    function formatFPS(fps) {

        const value =
            Number(fps);

        if (
            !Number.isFinite(value) ||
            value <= 0
        ) {

            return "Unknown";

        }

        if (value >= 100) {

            return `${Math.round(value)} FPS`;

        }

        return `${value.toFixed(2).replace(/\.00$/, "")} FPS`;

    }


    /* =====================================================
       GET VIDEO STATE
    ===================================================== */

    function getVideoState() {

        const state =
            getState();

        if (
            typeof state.getValue === "function"
        ) {

            const video =
                state.getValue("video");

            if (video) {

                return video;

            }

        }

        if (
            typeof state.get === "function"
        ) {

            const video =
                state.get("video");

            if (video) {

                return video;

            }

        }

        return null;

    }


    /* =====================================================
       GET CURRENT VIDEO URL
       -----------------------------------------------------
       IMPORTANT:
       State menggunakan objectUrl, bukan objectURL.
       Tetap dukung objectURL sebagai compatibility fallback.
    ===================================================== */

    function getVideoURL() {

        const video =
            getVideoState();

        if (!video) {

            return "";

        }


        /*
         * Primary property.
         *
         * vision-video-state.js:
         * video.objectUrl
         */
        if (
            typeof video.objectUrl === "string" &&
            video.objectUrl
        ) {

            return video.objectUrl;

        }


        /*
         * Compatibility fallback.
         */
        if (
            typeof video.objectURL === "string" &&
            video.objectURL
        ) {

            return video.objectURL;

        }


        /*
         * Compatibility fallback lainnya.
         */
        if (
            typeof video.url === "string" &&
            video.url
        ) {

            return video.url;

        }


        /*
         * Beberapa implementasi mungkin menyimpan
         * source langsung sebagai src.
         */
        if (
            typeof video.src === "string" &&
            video.src
        ) {

            return video.src;

        }

        return "";

    }


    /* =====================================================
       GET CURRENT FILE
    ===================================================== */

    function getCurrentFile() {

        const video =
            getVideoState();

        if (!video) {

            return null;

        }

        if (
            video.file instanceof File
        ) {

            return video.file;

        }

        return null;

    }


    /* =====================================================
       RESOLVE VIDEO URL
       -----------------------------------------------------
       Jika State belum memiliki objectUrl tetapi file
       sudah tersedia, buat Object URL sebagai fallback.
    ===================================================== */

    function resolveVideoURL(file) {

        const stateURL =
            getVideoURL();

        if (stateURL) {

            return stateURL;

        }

        if (
            file instanceof File
        ) {

            try {

                return URL.createObjectURL(
                    file
                );

            } catch (error) {

                console.error(
                    "[GEN-Z.AI Vision Video] Gagal membuat Object URL:",
                    error
                );

            }

        }

        return "";

    }


    /* =====================================================
       UPDATE FILE INFORMATION
    ===================================================== */

    function renderFileInformation(file) {

        const dom =
            getDOM();

        if (!file) {

            dom.text(
                "fileName",
                "-"
            );

            dom.text(
                "fileSize",
                "-"
            );

            return;

        }

        dom.text(
            "fileName",
            file.name || "Video"
        );

        dom.text(
            "fileSize",
            formatFileSize(file.size)
        );

    }


    /* =====================================================
       UPDATE METADATA UI
    ===================================================== */

    function renderMetadata(metadata = {}) {

        const dom =
            getDOM();

        const duration =
            Number(metadata.duration);

        const width =
            Number(metadata.width);

        const height =
            Number(metadata.height);

        const fps =
            Number(metadata.fps);


        dom.text(
            "duration",
            Number.isFinite(duration) &&
            duration > 0
                ? formatDuration(duration)
                : "Unknown"
        );

        dom.text(
            "resolution",
            formatResolution(
                width,
                height
            )
        );

        dom.text(
            "fps",
            formatFPS(fps)
        );

    }


    /* =====================================================
       SHOW PREVIEW
    ===================================================== */

    function showPreview() {

        const dom =
            getDOM();

        dom.show(
            "previewState"
        );

        dom.hide(
            "uploadState"
        );

    }


    /* =====================================================
       SHOW UPLOAD STATE
    ===================================================== */

    function showUploadState() {

        const dom =
            getDOM();

        dom.show(
            "uploadState"
        );

        dom.hide(
            "previewState"
        );

    }


    /* =====================================================
       SET VIDEO SOURCE
    ===================================================== */

    function setVideoSource(url) {

        const video =
            getVideoElement();

        if (!video) {

            console.warn(
                "[GEN-Z.AI Vision Video] Elemen video preview tidak ditemukan."
            );

            return false;

        }

        if (!url) {

            return false;

        }


        /*
         * Normalisasi source.
         *
         * video.src dapat menjadi absolute URL.
         * Karena itu jangan hanya membandingkan
         * video.src dengan string mentah secara buta.
         */
        const currentSource =
            video.getAttribute("src") || "";


        if (
            currentSource !== url &&
            video.src !== url
        ) {

            try {

                video.pause();

            } catch (error) {

                /* no-op */

            }

            video.removeAttribute(
                "src"
            );

            video.load();

            video.src =
                url;

        }


        /*
         * Preview tidak autoplay.
         */
        video.autoplay =
            false;

        video.controls =
            true;

        video.preload =
            "metadata";

        /*
         * Pastikan browser memuat source.
         */
        if (
            video.readyState === 0
        ) {

            try {

                video.load();

            } catch (error) {

                console.warn(
                    "[GEN-Z.AI Vision Video] video.load() gagal:",
                    error
                );

            }

        }

        return true;

    }


    /* =====================================================
       CLEAR VIDEO SOURCE
    ===================================================== */

    function clearVideoSource() {

        const video =
            getVideoElement();

        if (!video) {

            return;

        }

        try {

            video.pause();

        } catch (error) {

            /* no-op */

        }

        video.removeAttribute(
            "src"
        );

        video.load();

    }


    /* =====================================================
       READ METADATA
    ===================================================== */

    function readMetadata() {

        const video =
            getVideoElement();

        if (!video) {

            return Promise.reject(
                new Error(
                    "Elemen preview video tidak ditemukan."
                )
            );

        }

        const token =
            metadataLoadToken;

        return new Promise(
            function (resolve, reject) {

                let finished =
                    false;


                function cleanup() {

                    video.removeEventListener(
                        "loadedmetadata",
                        onLoadedMetadata
                    );

                    video.removeEventListener(
                        "error",
                        onError
                    );

                }


                function finish(
                    callback
                ) {

                    if (finished) {

                        return;

                    }

                    if (
                        token !== metadataLoadToken
                    ) {

                        cleanup();

                        finished =
                            true;

                        return;

                    }

                    finished =
                        true;

                    cleanup();

                    callback();

                }


                function onLoadedMetadata() {

                    finish(
                        function () {

                            const duration =
                                Number(
                                    video.duration
                                );

                            const width =
                                Number(
                                    video.videoWidth
                                );

                            const height =
                                Number(
                                    video.videoHeight
                                );


                            resolve({

                                duration:
                                    Number.isFinite(duration)
                                        ? duration
                                        : 0,

                                width:
                                    Number.isFinite(width)
                                        ? width
                                        : 0,

                                height:
                                    Number.isFinite(height)
                                        ? height
                                        : 0,

                                fps:
                                    0

                            });

                        }
                    );

                }


                function onError() {

                    finish(
                        function () {

                            reject(
                                new Error(
                                    "Metadata video tidak dapat dibaca."
                                )
                            );

                        }
                    );

                }


                video.addEventListener(
                    "loadedmetadata",
                    onLoadedMetadata
                );

                video.addEventListener(
                    "error",
                    onError
                );


                /*
                 * Metadata mungkin sudah tersedia sebelum
                 * listener dipasang.
                 */
                if (
                    video.readyState >= 1
                ) {

                    queueMicrotask(
                        onLoadedMetadata
                    );

                }

            }
        );

    }


    /* =====================================================
       FPS DETECTION
       -----------------------------------------------------
       Browser-side estimation only.
       Kegagalan FPS tidak menggagalkan preview.
    ===================================================== */

    async function detectFPS() {

        const video =
            getVideoElement();

        if (!video) {

            return 0;

        }

        if (
            typeof video.requestVideoFrameCallback !==
            "function"
        ) {

            return 0;

        }

        if (
            frameRateDetectionActive
        ) {

            return 0;

        }

        frameRateDetectionActive =
            true;

        try {

            if (
                video.readyState < 1
            ) {

                return 0;

            }

            const originalTime =
                Number(video.currentTime) || 0;

            const wasPaused =
                video.paused;

            const samples = [];

            let resolveSample;

            let rejectSample;

            const samplePromise =
                new Promise(
                    function (
                        resolve,
                        reject
                    ) {

                        resolveSample =
                            resolve;

                        rejectSample =
                            reject;

                    }
                );

            let callbackCount =
                0;


            function callback(
                now,
                metadata
            ) {

                callbackCount++;


                const mediaTime =
                    Number(
                        metadata.mediaTime
                    );


                if (
                    Number.isFinite(mediaTime)
                ) {

                    samples.push({

                        now,

                        mediaTime

                    });

                }


                if (
                    samples.length >= 8
                ) {

                    resolveSample(
                        samples
                    );

                    return;

                }


                if (
                    callbackCount >= 12
                ) {

                    resolveSample(
                        samples
                    );

                    return;

                }


                try {

                    video.requestVideoFrameCallback(
                        callback
                    );

                } catch (error) {

                    rejectSample(
                        error
                    );

                }

            }


            try {

                video.requestVideoFrameCallback(
                    callback
                );

            } catch (error) {

                return 0;

            }


            /*
             * Untuk memperoleh frame callback,
             * video perlu berjalan sebentar.
             */
            if (
                video.paused
            ) {

                try {

                    const playPromise =
                        video.play();

                    if (
                        playPromise &&
                        typeof playPromise.then ===
                        "function"
                    ) {

                        await playPromise;

                    }

                } catch (error) {

                    return 0;

                }

            }


            let resultSamples =
                [];


            try {

                resultSamples =
                    await Promise.race([

                        samplePromise,

                        new Promise(
                            function (
                                resolve
                            ) {

                                setTimeout(
                                    function () {

                                        resolve(
                                            []
                                        );

                                    },
                                    1500
                                );

                            }
                        )

                    ]);

            } catch (error) {

                resultSamples =
                    [];

            }


            /*
             * Kembalikan posisi video.
             */
            try {

                video.currentTime =
                    originalTime;

            } catch (error) {

                /* no-op */

            }


            if (
                wasPaused
            ) {

                try {

                    video.pause();

                } catch (error) {

                    /* no-op */

                }

            }


            if (
                !Array.isArray(resultSamples) ||
                resultSamples.length < 2
            ) {

                return 0;

            }


            const fpsValues =
                [];


            for (
                let i = 1;
                i < resultSamples.length;
                i++
            ) {

                const previous =
                    resultSamples[i - 1];

                const current =
                    resultSamples[i];


                const mediaDelta =
                    Number(
                        current.mediaTime
                    ) -
                    Number(
                        previous.mediaTime
                    );


                if (
                    mediaDelta <= 0
                ) {

                    continue;

                }


                const fps =
                    1 / mediaDelta;


                if (
                    Number.isFinite(fps) &&
                    fps >= 1 &&
                    fps <= 240
                ) {

                    fpsValues.push(
                        fps
                    );

                }

            }


            if (
                fpsValues.length === 0
            ) {

                return 0;

            }


            fpsValues.sort(
                function (
                    a,
                    b
                ) {

                    return a - b;

                }
            );


            const middle =
                Math.floor(
                    fpsValues.length / 2
                );


            if (
                fpsValues.length % 2 === 0
            ) {

                return (
                    fpsValues[middle - 1] +
                    fpsValues[middle]
                ) / 2;

            }


            return fpsValues[middle];

        } finally {

            frameRateDetectionActive =
                false;

        }

    }


    /* =====================================================
       SAVE METADATA TO STATE
    ===================================================== */

    function saveMetadataToState(
        metadata
    ) {

        const state =
            getState();


        /*
         * Primary state API.
         */
        if (
            typeof state.setVisionVideoMetadata ===
            "function"
        ) {

            state.setVisionVideoMetadata(
                metadata
            );

            return;

        }


        /*
         * Compatibility API.
         */
        if (
            typeof state.setMetadata ===
            "function"
        ) {

            state.setMetadata(
                metadata
            );

            return;

        }


        /*
         * Generic setter fallback.
         */
        if (
            typeof state.set ===
            "function"
        ) {

            state.set(
                "video.metadata",
                metadata
            );

        }

    }


    /* =====================================================
       LOAD VIDEO
    ===================================================== */

    async function loadVideo(file) {

        if (!(file instanceof File)) {

            clear();

            return false;

        }


        /*
         * Resolve URL dari State.
         *
         * FIX UTAMA:
         * state menggunakan objectUrl.
         */
        const url =
            resolveVideoURL(
                file
            );


        if (!url) {

            console.error(
                "[GEN-Z.AI Vision Video] Object URL video tidak tersedia."
            );

            clear();

            return false;

        }


        /*
         * Token baru untuk video baru.
         */
        const token =
            ++metadataLoadToken;


        /*
         * File information harus tampil
         * sebelum proses metadata.
         */
        renderFileInformation(
            file
        );


        /*
         * Pasang video terlebih dahulu.
         */
        const sourceReady =
            setVideoSource(
                url
            );


        if (!sourceReady) {

            console.error(
                "[GEN-Z.AI Vision Video] Source video gagal dipasang."
            );

            return false;

        }


        /*
         * PENTING:
         * Preview langsung ditampilkan.
         *
         * Tidak menunggu metadata.
         * Tidak menunggu FPS.
         * Tidak menunggu AI.
         */
        showPreview();


        /*
         * Beri browser kesempatan memproses
         * source video.
         */
        const video =
            getVideoElement();

        if (video) {

            try {

                video.load();

            } catch (error) {

                /* no-op */

            }

        }


        try {

            const metadata =
                await readMetadata();


            /*
             * Video sudah diganti sebelum metadata selesai.
             */
            if (
                token !== metadataLoadToken
            ) {

                return false;

            }


            /*
             * Render metadata dasar terlebih dahulu.
             */
            renderMetadata(
                metadata
            );


            /*
             * Simpan metadata dasar ke state.
             */
            try {

                saveMetadataToState(
                    metadata
                );

            } catch (error) {

                console.warn(
                    "[GEN-Z.AI Vision Video] Metadata state tidak dapat diperbarui:",
                    error
                );

            }


            /*
             * FPS hanya tambahan.
             *
             * Preview sudah tampil sebelum bagian ini.
             */
            let fps =
                0;


            try {

                fps =
                    await detectFPS();

            } catch (error) {

                fps =
                    0;

            }


            if (
                token !== metadataLoadToken
            ) {

                return false;

            }


            metadata.fps =
                Number.isFinite(fps)
                    ? fps
                    : 0;


            /*
             * Update state dengan FPS.
             */
            try {

                saveMetadataToState(
                    metadata
                );

            } catch (error) {

                console.warn(
                    "[GEN-Z.AI Vision Video] FPS state tidak dapat diperbarui:",
                    error
                );

            }


            /*
             * Update tampilan FPS.
             */
            renderMetadata(
                metadata
            );


            document.dispatchEvent(
                new CustomEvent(
                    "genz:vision-video:metadata-ready",
                    {
                        detail: {

                            file,

                            metadata

                        }

                    }
                )
            );


            return true;

        } catch (error) {

            console.error(
                "[GEN-Z.AI Vision Video] Metadata error:",
                error
            );


            /*
             * Preview tetap hidup walaupun metadata
             * gagal dibaca.
             */
            renderMetadata({

                duration: 0,

                width: 0,

                height: 0,

                fps: 0

            });


            document.dispatchEvent(
                new CustomEvent(
                    "genz:vision-video:metadata-error",
                    {
                        detail: {

                            file,

                            error

                        }

                    }
                )
            );


            /*
             * Ini bukan kegagalan preview.
             * Video sudah berhasil dipasang.
             */
            return true;

        }

    }


    /* =====================================================
       CLEAR PREVIEW
    ===================================================== */

    function clear() {

        metadataLoadToken++;


        clearVideoSource();


        const dom =
            getDOM();


        dom.text(
            "fileName",
            "-"
        );


        dom.text(
            "fileSize",
            "-"
        );


        dom.text(
            "duration",
            "-"
        );


        dom.text(
            "resolution",
            "-"
        );


        dom.text(
            "fps",
            "-"
        );


        showUploadState();


        document.dispatchEvent(
            new CustomEvent(
                "genz:vision-video:preview-cleared"
            )
        );

    }


    /* =====================================================
       REFRESH FROM STATE
    ===================================================== */

    async function refreshFromState() {

        const file =
            getCurrentFile();


        if (!file) {

            clear();

            return false;

        }


        return loadVideo(
            file
        );

    }


    /* =====================================================
       EVENT HANDLERS
    ===================================================== */

    function handleFileSelected(
        event
    ) {

        const file =
            event &&
            event.detail
                ? event.detail.file
                : null;


        if (!(file instanceof File)) {

            /*
             * Compatibility:
             * beberapa uploader mungkin mengirim
             * file langsung sebagai detail.
             */
            if (
                event &&
                event.detail instanceof File
            ) {

                loadVideo(
                    event.detail
                );

            }

            return;

        }


        loadVideo(
            file
        );

    }


    function handleFileRemoved() {

        clear();

    }


    /* =====================================================
       BIND
    ===================================================== */

    function bind() {

        if (bound) {

            return;

        }


        document.addEventListener(
            "genz:vision-video:file-selected",
            handleFileSelected
        );


        document.addEventListener(
            "genz:vision-video:file-removed",
            handleFileRemoved
        );


        bound =
            true;


        console.log(
            "[GEN-Z.AI Vision Video] Preview module ready."
        );

    }


    /* =====================================================
       PUBLIC API
    ===================================================== */

    const API = Object.freeze({

        formatFileSize,

        formatDuration,

        formatResolution,

        formatFPS,

        getVideoElement,

        getCurrentFile,

        getVideoURL,

        renderFileInformation,

        renderMetadata,

        showPreview,

        showUploadState,

        setVideoSource,

        clearVideoSource,

        readMetadata,

        detectFPS,

        loadVideo,

        refreshFromState,

        clear,

        bind

    });


    /* =====================================================
       EXPORT
    ===================================================== */

    window.GENZVisionVideoPreview =
        API;


    window.GENZVisionVideoPreviewReady =
        true;


    /* =====================================================
       AUTO BIND
    ===================================================== */

    function autoBind() {

        if (
            window.GENZVisionVideoState &&
            window.GENZVisionVideoDOM
        ) {

            bind();

        }

    }


    if (
        document.readyState === "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            autoBind,
            {
                once: true
            }
        );

    } else {

        autoBind();

    }


})();
