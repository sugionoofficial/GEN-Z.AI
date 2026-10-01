/* =========================================================
   GEN-Z.AI
   METADATA STATE MODULE
   ---------------------------------------------------------
   File:
   metadata-cleaner/assets/js/metadata-state.js

   Tanggung jawab:
   - Menyimpan state aplikasi Metadata Cleaner
   - Menyimpan metadata lokal
   - Menyimpan hasil Sightengine
   - Menyimpan Face Manipulation / Deepfake
   - Menyimpan Content Provenance / C2PA
   - Menyimpan file aktif
   - Menyimpan preview state
   - Menyimpan status cleaning
   - Tidak melakukan DOM rendering
   - Tidak melakukan API request
========================================================= */


/* =========================================================
   INITIAL STATE
========================================================= */

const metadataState = {

    /* -----------------------------------------------------
       FILE
    ----------------------------------------------------- */

    file:
        null,

    fileType:
        null,

    fileName:
        "",

    fileSize:
        0,


    /* -----------------------------------------------------
       MEDIA
    ----------------------------------------------------- */

    mediaType:
        null,

    isImage:
        false,

    isVideo:
        false,


    /* -----------------------------------------------------
       LOCAL METADATA
    ----------------------------------------------------- */

    metadata:
        [],

    metadataCount:
        0,


    /* -----------------------------------------------------
       ORIGINAL METADATA
    ----------------------------------------------------- */

    originalMetadata:
        [],

    originalMetadataCount:
        0,


    /* -----------------------------------------------------
       CLEANED METADATA
    ----------------------------------------------------- */

    cleanedMetadata:
        [],

    cleanedMetadataCount:
        0,


    /* -----------------------------------------------------
       CONTENT PROVENANCE
       -----------------------------------------------------
       Menyimpan hasil pemeriksaan provenance seperti:

       - C2PA
       - Content Credentials
       - digitalSourceType
       - AI disclosure
       - verification status

       Catatan:
       Object ini hanya menyimpan hasil pemeriksaan.

       Verifikasi cryptographic tidak dilakukan oleh
       metadata-state.js.
    ----------------------------------------------------- */

    provenance:
        null,


    /* -----------------------------------------------------
       SIGHTENGINE
       -----------------------------------------------------
       Semua hasil dari backend disimpan dalam normalized
       object agar module UI tidak perlu mengetahui bentuk
       response API mentah.
    ----------------------------------------------------- */

    sightengineDetection: {

        provider:
            null,

        model:
            null,

        models:
            [],


        /* -----------------------------------------------
           GENAI
        ----------------------------------------------- */

        ai_generated:
            null,

        confidence:
            null,

        is_ai_generated:
            false,


        /* -----------------------------------------------
           FACE MANIPULATION
        ----------------------------------------------- */

        face_manipulation:
            null,

        face_manipulation_confidence:
            null,

        is_face_manipulated:
            false,


        /* -----------------------------------------------
           DEEPFAKE
        ----------------------------------------------- */

        deepfake:
            null,

        deepfake_confidence:
            null,

        is_deepfake:
            false,


        /* -----------------------------------------------
           GENERATORS
        ----------------------------------------------- */

        generators:
            [],

        detected_generator:
            null,


        /* -----------------------------------------------
           REQUEST
        ----------------------------------------------- */

        request: {

            id:
                null,

            timestamp:
                null,

            operations:
                null

        },


        /* -----------------------------------------------
           MEDIA
        ----------------------------------------------- */

        media: {

            id:
                null,

            uri:
                null

        }

    },


    /* -----------------------------------------------------
       SIGHTENGINE STATUS
    ----------------------------------------------------- */

    sightengineLoading:
        false,

    sightengineError:
        null,

    sightengineChecked:
        false,


    /* -----------------------------------------------------
       DETECTION STATUS
    ----------------------------------------------------- */

    detectionStatus:
        "idle",

    detectionMessage:
        "",


    /* -----------------------------------------------------
       CLEAN STATUS
    ----------------------------------------------------- */

    cleaning:
        false,

    cleaned:
        false,

    cleaningError:
        null,


    /* -----------------------------------------------------
       PREVIEW
    ----------------------------------------------------- */

    previewUrl:
        null,

    previewObjectUrl:
        null,

   originalURL:
    null,

cleanedURL:
    null,


    /* -----------------------------------------------------
       PROCESSING
    ----------------------------------------------------- */

    processing:
        false,

    processingStage:
        "",

    processingProgress:
        0,


    /* -----------------------------------------------------
       DOWNLOAD
    ----------------------------------------------------- */

    downloadReady:
        false,

    downloadUrl:
        null,

    downloadName:
        "",


    /* -----------------------------------------------------
       ERROR
    ----------------------------------------------------- */

    error:
        null,


    /* -----------------------------------------------------
       UI
    ----------------------------------------------------- */

    status:
        "idle",

    statusMessage:
        "",


    /* -----------------------------------------------------
       RESET VERSION
    ----------------------------------------------------- */

    resetVersion:
        0

};


/* =========================================================
   DEFAULT SIGHTENGINE OBJECT FACTORY
   ---------------------------------------------------------
   Selalu membuat object baru agar array / object tidak
   berbagi reference ketika state di-reset.
========================================================= */

export function createEmptySightengineDetection() {

    return {

        provider:
            null,

        model:
            null,

        models:
            [],


        /* -----------------------------------------------
           GENAI
        ----------------------------------------------- */

        ai_generated:
            null,

        confidence:
            null,

        is_ai_generated:
            false,


        /* -----------------------------------------------
           FACE MANIPULATION
        ----------------------------------------------- */

        face_manipulation:
            null,

        face_manipulation_confidence:
            null,

        is_face_manipulated:
            false,


        /* -----------------------------------------------
           DEEPFAKE
        ----------------------------------------------- */

        deepfake:
            null,

        deepfake_confidence:
            null,

        is_deepfake:
            false,


        /* -----------------------------------------------
           GENERATORS
        ----------------------------------------------- */

        generators:
            [],

        detected_generator:
            null,


        /* -----------------------------------------------
           REQUEST
        ----------------------------------------------- */

        request: {

            id:
                null,

            timestamp:
                null,

            operations:
                null

        },


        /* -----------------------------------------------
           MEDIA
        ----------------------------------------------- */

        media: {

            id:
                null,

            uri:
                null

        }

    };

}


/* =========================================================
   DEFAULT PROVENANCE OBJECT FACTORY
   ---------------------------------------------------------
   Membuat object provenance baru agar tidak berbagi
   reference ketika state di-reset.
========================================================= */

export function createEmptyProvenance() {

    return {

        checked:
            false,

        supported:
            false,

        format:
            "unknown",

        detected:
            false,

        status:
            "NOT_DETECTED",

        verified:
            false,

        verificationStatus:
            "NOT_VERIFIED",


        /* -----------------------------------------------
           C2PA
        ----------------------------------------------- */

        c2pa: {

            detected:
                false,

            verified:
                false,

            manifestCount:
                0

        },


        /* -----------------------------------------------
           CONTENT CREDENTIALS
        ----------------------------------------------- */

        contentCredentials: {

            detected:
                false,

            verified:
                false

        },


        /* -----------------------------------------------
           FINDINGS
        ----------------------------------------------- */

        findings:
            [],


        /* -----------------------------------------------
           SOURCE INFORMATION
        ----------------------------------------------- */

        digitalSourceType:
            null,

        aiDisclosure:
            null

    };

}


/* =========================================================
   PROVENANCE NORMALIZER
   ---------------------------------------------------------
   Menjaga agar module UI selalu menerima bentuk object
   yang konsisten walaupun inspector mengembalikan field
   yang tidak lengkap.
========================================================= */

function normalizeProvenance(
    provenance = null
) {

    if (
        !provenance ||
        typeof provenance !== "object"
    ) {

        return createEmptyProvenance();

    }


    const normalized =
        createEmptyProvenance();


    /* -----------------------------------------------------
       BASIC
    ----------------------------------------------------- */

    normalized.checked =
        provenance.checked === true;

    normalized.supported =
        provenance.supported === true;

    normalized.format =
        provenance.format ??
        "unknown";

    normalized.detected =
        provenance.detected === true;

    normalized.status =
        provenance.status ??
        (
            normalized.detected
                ? "DETECTED"
                : "NOT_DETECTED"
        );

    normalized.verified =
        provenance.verified === true;

    normalized.verificationStatus =
        provenance.verificationStatus ??
        (
            normalized.verified
                ? "VERIFIED"
                : "NOT_VERIFIED"
        );


    /* -----------------------------------------------------
       C2PA
    ----------------------------------------------------- */

    if (
        provenance.c2pa &&
        typeof provenance.c2pa === "object"
    ) {

        normalized.c2pa = {

            detected:
                provenance.c2pa.detected === true,

            verified:
                provenance.c2pa.verified === true,

            manifestCount:
                Number.isFinite(
                    Number(
                        provenance.c2pa.manifestCount
                    )
                )
                    ? Number(
                        provenance.c2pa.manifestCount
                    )
                    : 0

        };

    }


    /* -----------------------------------------------------
       CONTENT CREDENTIALS
    ----------------------------------------------------- */

    if (
        provenance.contentCredentials &&
        typeof provenance.contentCredentials === "object"
    ) {

        normalized.contentCredentials = {

            detected:
                provenance.contentCredentials.detected === true,

            verified:
                provenance.contentCredentials.verified === true

        };

    }


    /* -----------------------------------------------------
       FINDINGS
    ----------------------------------------------------- */

    normalized.findings =
        Array.isArray(
            provenance.findings
        )
            ? provenance.findings.map(
                finding => {

                    if (
                        finding === null ||
                        finding === undefined
                    ) {

                        return "";

                    }


                    if (
                        typeof finding === "string"
                    ) {

                        return finding;

                    }


                    if (
                        typeof finding === "number" ||
                        typeof finding === "boolean"
                    ) {

                        return String(
                            finding
                        );

                    }


                    /*
                     * Jangan simpan object mentah sebagai
                     * string "[object Object]".
                     *
                     * UI dapat memilih field yang relevan
                     * jika diperlukan.
                     */

                    if (
                        typeof finding === "object"
                    ) {

                        try {

                            return JSON.stringify(
                                finding
                            );

                        } catch {

                            return "";

                        }

                    }


                    return "";

                }
            ).filter(
                Boolean
            )
            : [];


    /* -----------------------------------------------------
       DIGITAL SOURCE TYPE
    ----------------------------------------------------- */

    normalized.digitalSourceType =
        provenance.digitalSourceType ??
        null;


    /* -----------------------------------------------------
       AI DISCLOSURE
    ----------------------------------------------------- */

    normalized.aiDisclosure =
        provenance.aiDisclosure ??
        null;


    return normalized;

}


/* =========================================================
   STATE ACCESS
========================================================= */

export function getMetadataState() {

    return metadataState;

}


/* =========================================================
   STATE UPDATE
========================================================= */

export function setMetadataState(
    updates = {}
) {

    if (
        !updates ||
        typeof updates !== "object"
    ) {

        return metadataState;

    }


    Object.assign(
        metadataState,
        updates
    );


    return metadataState;

}


/* =========================================================
   PROVENANCE STATE UPDATE
========================================================= */

export function setProvenance(
    provenance = null
) {

    /* -----------------------------------------------------
       EMPTY / RESET
    ----------------------------------------------------- */

    if (
        !provenance ||
        typeof provenance !== "object"
    ) {

        metadataState.provenance =
            createEmptyProvenance();

        return metadataState.provenance;

    }


    /* -----------------------------------------------------
       NORMALIZED PROVENANCE
    ----------------------------------------------------- */

    metadataState.provenance =
        normalizeProvenance(
            provenance
        );


    return metadataState.provenance;

}


/* =========================================================
   SIGHTENGINE STATE UPDATE
========================================================= */

export function setSightengineDetection(
    detection = null
) {

    /* -----------------------------------------------------
       EMPTY / RESET
    ----------------------------------------------------- */

    if (
        !detection ||
        typeof detection !== "object"
    ) {

        metadataState.sightengineDetection =
            createEmptySightengineDetection();

        metadataState.sightengineChecked =
            false;

        metadataState.sightengineError =
            null;

        return metadataState.sightengineDetection;

    }


    /* -----------------------------------------------------
       NORMALIZED DETECTION
    ----------------------------------------------------- */

    metadataState.sightengineDetection = {

        provider:
            detection.provider ??
            null,

        model:
            detection.model ??
            null,

        models:
            Array.isArray(
                detection.models
            )
                ? [
                    ...detection.models
                ]
                : [],


        /* -----------------------------------------------
           GENAI
        ----------------------------------------------- */

        ai_generated:
            detection.ai_generated ??
            null,

        confidence:
            detection.confidence ??
            null,

        is_ai_generated:
            detection.is_ai_generated === true,


        /* -----------------------------------------------
           FACE MANIPULATION
        ----------------------------------------------- */

        face_manipulation:
            detection.face_manipulation ??
            null,

        face_manipulation_confidence:
            detection.face_manipulation_confidence ??
            null,

        is_face_manipulated:
            detection.is_face_manipulated === true,


        /* -----------------------------------------------
           DEEPFAKE
        ----------------------------------------------- */

        deepfake:
            detection.deepfake ??
            null,

        deepfake_confidence:
            detection.deepfake_confidence ??
            null,

        is_deepfake:
            detection.is_deepfake === true,


        /* -----------------------------------------------
           GENERATORS
        ----------------------------------------------- */

        generators:
            Array.isArray(
                detection.generators
            )
                ? detection.generators.map(
                    generator => {

                        if (
                            generator &&
                            typeof generator === "object"
                        ) {

                            return {
                                ...generator
                            };

                        }

                        return generator;

                    }
                )
                : [],


        detected_generator:
            detection.detected_generator
                ? (
                    typeof detection.detected_generator === "object"
                        ? {
                            ...detection.detected_generator
                        }
                        : detection.detected_generator
                )
                : null,


        /* -----------------------------------------------
           REQUEST
        ----------------------------------------------- */

        request:
            detection.request
                ? {

                    id:
                        detection.request.id ??
                        null,

                    timestamp:
                        detection.request.timestamp ??
                        null,

                    operations:
                        detection.request.operations ??
                        null

                }
                : {

                    id:
                        null,

                    timestamp:
                        null,

                    operations:
                        null

                },


        /* -----------------------------------------------
           MEDIA
        ----------------------------------------------- */

        media:
            detection.media
                ? {

                    id:
                        detection.media.id ??
                        null,

                    uri:
                        detection.media.uri ??
                        null

                }
                : {

                    id:
                        null,

                    uri:
                        null

                }

    };


    /* -----------------------------------------------------
       MARK SIGHTENGINE AS CHECKED
    ----------------------------------------------------- */

    metadataState.sightengineChecked =
        true;

    metadataState.sightengineError =
        null;


    return metadataState.sightengineDetection;

}


/* =========================================================
   SIGHTENGINE LOADING
========================================================= */

export function setSightengineLoading(
    loading
) {

    metadataState.sightengineLoading =
        Boolean(
            loading
        );

}


/* =========================================================
   SIGHTENGINE ERROR
========================================================= */

export function setSightengineError(
    error
) {

    if (
        error instanceof Error
    ) {

        metadataState.sightengineError =
            error.message;

    } else {

        metadataState.sightengineError =
            error
                ? String(
                    error
                )
                : null;

    }

}


/* =========================================================
   METADATA SETTER
========================================================= */

export function setMetadata(
    metadata = []
) {

    metadataState.metadata =
        Array.isArray(
            metadata
        )
            ? metadata
            : [];


    metadataState.metadataCount =
        metadataState.metadata.length;


    return metadataState.metadata;

}


/* =========================================================
   ORIGINAL METADATA SETTER
========================================================= */

export function setOriginalMetadata(
    metadata = []
) {

    metadataState.originalMetadata =
        Array.isArray(
            metadata
        )
            ? metadata
            : [];


    metadataState.originalMetadataCount =
        metadataState.originalMetadata.length;


    return metadataState.originalMetadata;

}


/* =========================================================
   CLEANED METADATA SETTER
========================================================= */

export function setCleanedMetadata(
    metadata = []
) {

    metadataState.cleanedMetadata =
        Array.isArray(
            metadata
        )
            ? metadata
            : [];


    metadataState.cleanedMetadataCount =
        metadataState.cleanedMetadata.length;


    return metadataState.cleanedMetadata;

}


/* =========================================================
   FILE SETTER
========================================================= */

export function setFile(
    file
) {

    metadataState.file =
        file ||
        null;


    if (
        file
    ) {

        metadataState.fileName =
            file.name ||
            "";

        metadataState.fileSize =
            Number(
                file.size
            ) ||
            0;

        metadataState.fileType =
            file.type ||
            null;

    } else {

        metadataState.fileName =
            "";

        metadataState.fileSize =
            0;

        metadataState.fileType =
            null;

    }


    return metadataState.file;

}


/* =========================================================
   MEDIA TYPE
========================================================= */

export function setMediaType(
    type
) {

    const normalized =
        typeof type === "string"
            ? type.toLowerCase()
            : null;


    metadataState.mediaType =
        normalized;


    metadataState.isImage =
        normalized === "image";


    metadataState.isVideo =
        normalized === "video";


    return normalized;

}


/* =========================================================
   PREVIEW URL
========================================================= */

export function setPreviewUrl(
    url
) {

    metadataState.previewUrl =
        url ||
        null;


    return metadataState.previewUrl;

}


/* =========================================================
   DETECTION STATUS
========================================================= */

export function setDetectionStatus(
    status,
    message = ""
) {

    metadataState.detectionStatus =
        status ||
        "idle";


    metadataState.detectionMessage =
        message ||
        "";

}


/* =========================================================
   CLEANING STATUS
========================================================= */

export function setCleaningStatus(
    cleaning,
    message = ""
) {

    metadataState.cleaning =
        Boolean(
            cleaning
        );


    metadataState.statusMessage =
        message ||
        "";

}


/* =========================================================
   PROCESSING STATUS
========================================================= */

export function setProcessingStatus(
    processing,
    stage = "",
    progress = 0
) {

    metadataState.processing =
        Boolean(
            processing
        );


    metadataState.processingStage =
        stage ||
        "";


    const numericProgress =
        Number(
            progress
        );


    metadataState.processingProgress =
        Number.isFinite(
            numericProgress
        )
            ? Math.max(
                0,
                Math.min(
                    100,
                    numericProgress
                )
            )
            : 0;

}


/* =========================================================
   ERROR
========================================================= */

export function setError(
    error
) {

    if (
        error instanceof Error
    ) {

        metadataState.error =
            error.message;

    } else {

        metadataState.error =
            error
                ? String(
                    error
                )
                : null;

    }

}


/* =========================================================
   RESET
========================================================= */

export function resetMetadataState() {

    /*
     * Jangan mengganti object utama metadataState.
     * Module lain mungkin memegang reference yang sama.
     */


    /* -----------------------------------------------------
       FILE
    ----------------------------------------------------- */

    metadataState.file =
        null;

    metadataState.fileType =
        null;

    metadataState.fileName =
        "";

    metadataState.fileSize =
        0;


    /* -----------------------------------------------------
       MEDIA
    ----------------------------------------------------- */

    metadataState.mediaType =
        null;

    metadataState.isImage =
        false;

    metadataState.isVideo =
        false;


    /* -----------------------------------------------------
       METADATA
    ----------------------------------------------------- */

    metadataState.metadata =
        [];

    metadataState.metadataCount =
        0;


    /* -----------------------------------------------------
       ORIGINAL METADATA
    ----------------------------------------------------- */

    metadataState.originalMetadata =
        [];

    metadataState.originalMetadataCount =
        0;


    /* -----------------------------------------------------
       CLEANED METADATA
    ----------------------------------------------------- */

    metadataState.cleanedMetadata =
        [];

    metadataState.cleanedMetadataCount =
        0;


    /* -----------------------------------------------------
       CONTENT PROVENANCE
    -----------------------------------------------------
       Sangat penting:
       provenance file sebelumnya tidak boleh ikut muncul
       ketika user memilih file baru.
    ----------------------------------------------------- */

    metadataState.provenance =
        createEmptyProvenance();


    /* -----------------------------------------------------
       SIGHTENGINE
    ----------------------------------------------------- */

    metadataState.sightengineDetection =
        createEmptySightengineDetection();


    metadataState.sightengineLoading =
        false;


    metadataState.sightengineError =
        null;


    metadataState.sightengineChecked =
        false;


    /* -----------------------------------------------------
       DETECTION
    ----------------------------------------------------- */

    metadataState.detectionStatus =
        "idle";

    metadataState.detectionMessage =
        "";


    /* -----------------------------------------------------
       CLEAN
    ----------------------------------------------------- */

    metadataState.cleaning =
        false;

    metadataState.cleaned =
        false;

    metadataState.cleaningError =
        null;


    /* -----------------------------------------------------
   PREVIEW
----------------------------------------------------- */

metadataState.previewUrl =
    null;

metadataState.previewObjectUrl =
    null;

metadataState.originalURL =
    null;

metadataState.cleanedURL =
    null;


    /* -----------------------------------------------------
       PROCESSING
    ----------------------------------------------------- */

    metadataState.processing =
        false;

    metadataState.processingStage =
        "";

    metadataState.processingProgress =
        0;


    /* -----------------------------------------------------
       DOWNLOAD
    ----------------------------------------------------- */

    metadataState.downloadReady =
        false;

    metadataState.downloadUrl =
        null;

    metadataState.downloadName =
        "";


    /* -----------------------------------------------------
       ERROR
    ----------------------------------------------------- */

    metadataState.error =
        null;


    /* -----------------------------------------------------
       UI
    ----------------------------------------------------- */

    metadataState.status =
        "idle";

    metadataState.statusMessage =
        "";


    /* -----------------------------------------------------
       RESET VERSION
    ----------------------------------------------------- */

    metadataState.resetVersion +=
        1;


    return metadataState;

}


/* =========================================================
   PUBLIC EXPORTS
========================================================= */

/*
   APP
   ---------------------------------------------------------
   Compatibility object untuk module yang masih menggunakan
   metadata-state sebagai sumber konfigurasi aplikasi.

   Jangan membuat state kedua.
   APP tetap menunjuk ke metadataState yang sama.
*/

export const APP =
    metadataState;


/*
   Canonical state export.
*/

export const state =
    metadataState;


/*
   Default export.
*/

export default metadataState;
