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

     file: null,

     fileType: null,

     fileName: "",

     fileSize: 0,


     /* -----------------------------------------------------
        MEDIA
     ----------------------------------------------------- */

     mediaType: null,

     isImage: false,

     isVideo: false,


     /* -----------------------------------------------------
        LOCAL METADATA
     ----------------------------------------------------- */

     metadata: [],

     metadataCount: 0,


     /* -----------------------------------------------------
        ORIGINAL METADATA
     ----------------------------------------------------- */

     originalMetadata: [],

     originalMetadataCount: 0,


     /* -----------------------------------------------------
        CLEANED METADATA
     ----------------------------------------------------- */

     cleanedMetadata: [],

     cleanedMetadataCount: 0,


     /* -----------------------------------------------------
        SIGHTENGINE
        --------------------------------------------------
        Semua hasil dari backend disimpan utuh dalam bentuk
        normalized object.
     ----------------------------------------------------- */

     sightengineDetection: {

         provider:
             null,

         model:
             null,

         ai_generated:
             null,

         confidence:
             null,

         is_ai_generated:
             false,

         generators:
             [],

         detected_generator:
             null,

         request: {

             id:
                 null,

             timestamp:
                 null,

             operations:
                 null

         },

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
    Digunakan agar reset tidak berbagi reference array/object.
 ========================================================= */

 export function createEmptySightengineDetection() {

     return {

         provider:
             null,

         model:
             null,

         ai_generated:
             null,

         confidence:
             null,

         is_ai_generated:
             false,

         generators:
             [],

         detected_generator:
             null,

         request: {

             id:
                 null,

             timestamp:
                 null,

             operations:
                 null

         },

         media: {

             id:
                 null,

             uri:
                 null

         }

     };

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
    SIGHTENGINE STATE UPDATE
 ========================================================= */

 export function setSightengineDetection(
     detection = null
 ) {

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


     metadataState.sightengineDetection = {

         provider:
             detection.provider ??
             null,

         model:
             detection.model ??
             null,

         ai_generated:
             detection.ai_generated ??
             null,

         confidence:
             detection.confidence ??
             null,

         is_ai_generated:
             detection.is_ai_generated === true,

         generators:
             Array.isArray(
                 detection.generators
             )
                 ? detection.generators.map(
                     generator => ({
                         ...generator
                     })
                 )
                 : [],

         detected_generator:
             detection.detected_generator
                 ? {
                     ...detection.detected_generator
                 }
                 : null,

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
                 ? String(error)
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
         file || null;

     if (
         file
     ) {

         metadataState.fileName =
             file.name || "";

         metadataState.fileSize =
             Number(
                 file.size
             ) || 0;

         metadataState.fileType =
             file.type || null;

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
         url || null;

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
         status || "idle";

     metadataState.detectionMessage =
         message || "";

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
         message || "";

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
         stage || "";

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
                 ? String(error)
                 : null;

     }

 }


 /* =========================================================
    RESET
 ========================================================= */

 export function resetMetadataState() {

     /*
      * Jangan mengganti object utama metadataState.
      * Modul lain mungkin memegang reference yang sama.
      */

     metadataState.file =
         null;

     metadataState.fileType =
         null;

     metadataState.fileName =
         "";

     metadataState.fileSize =
         0;

     metadataState.mediaType =
         null;

     metadataState.isImage =
         false;

     metadataState.isVideo =
         false;

     metadataState.metadata =
         [];

     metadataState.metadataCount =
         0;

     metadataState.originalMetadata =
         [];

     metadataState.originalMetadataCount =
         0;

     metadataState.cleanedMetadata =
         [];

     metadataState.cleanedMetadataCount =
         0;

     metadataState.sightengineDetection =
         createEmptySightengineDetection();

     metadataState.sightengineLoading =
         false;

     metadataState.sightengineError =
         null;

     metadataState.sightengineChecked =
         false;

     metadataState.detectionStatus =
         "idle";

     metadataState.detectionMessage =
         "";

     metadataState.cleaning =
         false;

     metadataState.cleaned =
         false;

     metadataState.cleaningError =
         null;

     metadataState.previewUrl =
         null;

     metadataState.previewObjectUrl =
         null;

     metadataState.processing =
         false;

     metadataState.processingStage =
         "";

     metadataState.processingProgress =
         0;

     metadataState.downloadReady =
         false;

     metadataState.downloadUrl =
         null;

     metadataState.downloadName =
         "";

     metadataState.error =
         null;

     metadataState.status =
         "idle";

     metadataState.statusMessage =
         "";

     metadataState.resetVersion +=
         1;

     return metadataState;

 }


 /* =========================================================
    EXPORT
 ========================================================= */

 export default metadataState;
