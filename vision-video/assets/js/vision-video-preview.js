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

        /*
         * Hindari angka absurd akibat precision.
         */
        if (value >= 100) {

            return `${Math.round(value)} FPS`;

        }

        return `${value.toFixed(2).replace(/\.00$/, "")} FPS`;

    }


    /* =====================================================
       GET CURRENT VIDEO URL
    ===================================================== */

    function getVideoURL() {

        const state =
            getState();

        /*
         * Ambil dari public state terlebih dahulu.
         */
        if (
            typeof state.getValue === "function"
        ) {

            const video =
                state.getValue("video");

            if (
                video &&
                typeof video.objectURL === "string" &&
                video.objectURL
            ) {

                return video.objectURL;

            }

            if (
                video &&
                typeof video.url === "string" &&
                video.url
            ) {

                return video.url;

            }

        }

        /*
         * Fallback untuk implementasi state yang
         * mengekspos get().
         */
        if (
            typeof state.get === "function"
        ) {

            const video =
                state.get("video");

            if (
                video &&
                typeof video.objectURL === "string" &&
                video.objectURL
            ) {

                return video.objectURL;

            }

            if (
                video &&
                typeof video.url === "string" &&
                video.url
            ) {

                return video.url;

            }

        }

        return "";

    }


    /* =====================================================
       GET CURRENT FILE
    ===================================================== */

    function getCurrentFile() {

        const state =
            getState();

        if (
            typeof state.getValue === "function"
        ) {

            const video =
                state.getValue("video");

            if (
                video &&
                video.file instanceof File
            ) {

                return video.file;

            }

        }

        if (
            typeof state.get === "function"
        ) {

            const video =
                state.get("video");

            if (
                video &&
                video.file instanceof File
            ) {

                return video.file;

            }

        }

        return null;

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
            Number.isFinite(duration)
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

        /*
         * Hindari reload source yang sama.
         */
        if (
            video.src !== url
        ) {

            video.pause();

            video.removeAttribute(
                "src"
            );

            video.load();

            if (url) {

                video.src = url;

            }

        }

        /*
         * Preview tidak boleh autoplay.
         */
        video.autoplay = false;
        video.controls = true;
        video.preload = "metadata";

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

        video.pause();

        video.removeAttribute(
            "src"
        );

        /*
         * Lepaskan resource media element.
         */
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
            ++metadataLoadToken;

        return new Promise(
            function (resolve, reject) {

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


                function onLoadedMetadata() {

                    if (
                        token !== metadataLoadToken
                    ) {

                        cleanup();

                        return;

                    }

                    const duration =
                        Number(video.duration);

                    const width =
                        Number(video.videoWidth);

                    const height =
                        Number(video.videoHeight);

                    cleanup();

                    const metadata = {

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

                    };

                    resolve(
                        metadata
                    );

                }


                function onError() {

                    if (
                        token !== metadataLoadToken
                    ) {

                        cleanup();

                        return;

                    }

                    cleanup();

                    reject(
                        new Error(
                            "Metadata video tidak dapat dibaca."
                        )
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
                 * Jika metadata sudah tersedia sebelum
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
       Menggunakan requestVideoFrameCallback jika browser
       mendukungnya. Ini bukan API analysis dan tidak
       melakukan decoding seluruh video.
    ===================================================== */

    async function detectFPS() {

        const video =
            getVideoElement();

        if (!video) {

            return 0;

        }

        /*
         * API modern.
         */
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

            /*
             * Pastikan video memiliki metadata.
             */
            if (
                video.readyState < 1
            ) {

                return 0;

            }

            /*
             * Jangan mengubah posisi playback pengguna
             * secara permanen.
             */
            const originalTime =
                Number(video.currentTime) || 0;

            const wasPaused =
                video.paused;

            /*
             * Ambil beberapa frame saat playback berjalan.
             * Tidak semua browser memberi metadata frame rate
             * secara langsung, sehingga FPS dihitung dari
             * media time antara callback frame.
             */
            const samples = [];

            let resolveSample;
            let rejectSample;

            const samplePromise =
                new Promise(
                    function (resolve, reject) {

                        resolveSample =
                            resolve;

                        rejectSample =
                            reject;

                    }
                );

            let callbackCount = 0;
            let firstMediaTime = null;
            let lastMediaTime = null;
            let firstWallTime = null;
            let lastWallTime = null;

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
                    firstMediaTime === null &&
                    Number.isFinite(mediaTime)
                ) {

                    firstMediaTime =
                        mediaTime;

                    firstWallTime =
                        now;

                }

                if (
                    Number.isFinite(mediaTime)
                ) {

                    lastMediaTime =
                        mediaTime;

                    lastWallTime =
                        now;

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

            video.requestVideoFrameCallback(
                callback
            );

            /*
             * Jika video paused, kita perlu menjalankannya
             * sebentar untuk memperoleh frame callbacks.
             */
            if (video.paused) {

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

                    /*
                     * Autoplay policy dapat menolak play().
                     * Dalam kondisi ini FPS tidak dipaksakan.
                     */

                    return 0;

                }

            }

            let resultSamples = [];

            try {

                resultSamples =
                    await Promise.race([

                        samplePromise,

                        new Promise(
                            function (resolve) {

                                setTimeout(
                                    function () {

                                        resolve([]);

                                    },
                                    1800
                                );

                            }
                        )

                    ]);

            } catch (error) {

                resultSamples = [];

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

                video.pause();

            }

            if (
                !Array.isArray(resultSamples) ||
                resultSamples.length < 2
            ) {

                return 0;

            }

            /*
             * Hitung FPS berdasarkan media time.
             * Karena callback dapat melewati frame tertentu,
             * gunakan beberapa interval dan median.
             */
            const fpsValues = [];

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

                const wallDelta =
                    (
                        Number(current.now) -
                        Number(previous.now)
                    ) / 1000;

                if (
                    mediaDelta > 0 &&
                    wallDelta > 0
                ) {

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

            }

            /*
             * requestVideoFrameCallback bukan jaminan setiap
             * frame dipanggil satu per satu. Karena itu nilai
             * langsung dari media delta bisa tidak stabil.
             *
             * Gunakan duration antara sampel yang terkumpul
             * bila memungkinkan.
             */
            if (
                firstMediaTime !== null &&
                lastMediaTime !== null &&
                firstWallTime !== null &&
                lastWallTime !== null
            ) {

                const mediaDuration =
                    lastMediaTime -
                    firstMediaTime;

                const wallDuration =
                    (
                        lastWallTime -
                        firstWallTime
                    ) / 1000;

                if (
                    mediaDuration > 0 &&
                    wallDuration > 0
                ) {

                    /*
                     * Ini hanya fallback estimasi playback rate,
                     * bukan FPS asli. Jangan gunakan sebagai FPS
                     * jika hasilnya jelas tidak masuk akal.
                     */

                }

            }

            if (
                fpsValues.length === 0
            ) {

                return 0;

            }

            fpsValues.sort(
                function (a, b) {
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
       LOAD VIDEO
    ===================================================== */

    async function loadVideo(file) {

        if (!(file instanceof File)) {

            clear();

            return false;

        }

        const url =
            getVideoURL();

        if (!url) {

            clear();

            return false;

        }

        const token =
            ++metadataLoadToken;

        renderFileInformation(
            file
        );

        setVideoSource(
            url
        );

        showPreview();

        try {

            const metadata =
                await readMetadata();

            /*
             * Jangan menerapkan hasil lama apabila user
             * sudah memilih video baru.
             */
            if (
                token !== metadataLoadToken
            ) {

                return false;

            }

            let fps = 0;

            /*
             * FPS hanya estimasi browser-side bila tersedia.
             * Kegagalan FPS tidak boleh menggagalkan preview.
             */
            try {

                fps =
                    await detectFPS();

            } catch (error) {

                fps = 0;

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

            const state =
                getState();

            if (
                typeof state.setMetadata === "function"
            ) {

                state.setMetadata(
                    metadata
                );

            }

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
             * Preview tetap ditampilkan walaupun metadata
             * gagal. Jangan menghukum user hanya karena
             * browser sedang berulah.
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

            return false;

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

    function handleFileSelected(event) {

        const file =
            event &&
            event.detail
                ? event.detail.file
                : null;

        if (!(file instanceof File)) {

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

        bound = true;

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

    /*
     * Bind otomatis hanya jika dependency sudah tersedia.
     * Loader tetap menjadi pengatur utama lifecycle.
     */
    if (
        document.readyState === "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            function () {

                if (
                    window.GENZVisionVideoState &&
                    window.GENZVisionVideoDOM
                ) {

                    bind();

                }

            },
            {
                once: true
            }
        );

    } else if (
        window.GENZVisionVideoState &&
        window.GENZVisionVideoDOM
    ) {

        bind();

    }

})();
