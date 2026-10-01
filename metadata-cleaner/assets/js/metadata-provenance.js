/* =========================================================
   GEN-Z.AI
   AI METADATA CLEANER
   ---------------------------------------------------------
   File:
   metadata-cleaner/assets/js/metadata-provenance.js

   Fungsi:
   - Memeriksa kemungkinan keberadaan C2PA
   - Memeriksa Content Credentials signature
   - Memeriksa C2PA Manifest Store signature
   - Tidak mengubah file
   - Tidak menghapus metadata
   - Tidak melakukan AI visual detection

   Catatan penting:
   ---------------------------------------------------------
   Modul browser ini melakukan SIGNATURE INSPECTION.

   Hasil:
   - NOT_DETECTED
       Tidak ditemukan signature C2PA yang dikenal.

   - DETECTED
       Ditemukan signature/struktur yang mengindikasikan
       keberadaan C2PA/JUMBF.

   - UNSUPPORTED
       Format belum didukung oleh inspector ini.

   Modul ini TIDAK mengklaim melakukan cryptographic
   verification terhadap manifest.

   Untuk verification penuh diperlukan C2PA validator.
========================================================= */


/* =========================================================
   CONSTANTS
========================================================= */

const MAX_INSPECT_BYTES =
    50 * 1024 * 1024;


/*
   C2PA Manifest Store UUID.

   Representasi ASCII:
   63327061-0011-0010-8000-00AA00389B71

   C2PA specification menggunakan UUID ini
   untuk mengidentifikasi C2PA Manifest Store.
*/


const C2PA_UUID_HEX =
    "6332706100110010800000AA00389B71";


const C2PA_UUID_BYTES =
    hexToBytes(
        C2PA_UUID_HEX
    );


const C2PA_LABEL =
    "c2pa";


const JUMBF_LABEL =
    "jumbf";


const CONTENT_CREDENTIALS_LABEL =
    "content credentials";


/* =========================================================
   BYTE HELPERS
========================================================= */

function hexToBytes(
    hex
) {

    if (
        typeof hex !== "string" ||
        hex.length % 2 !== 0
    ) {

        return [];

    }


    const bytes = [];


    for (
        let index = 0;
        index < hex.length;
        index += 2
    ) {

        bytes.push(
            parseInt(
                hex.slice(
                    index,
                    index + 2
                ),
                16
            )
        );

    }


    return bytes;

}


/* =========================================================
   ASCII HELPERS
========================================================= */

function bytesToAscii(
    bytes
) {

    let output = "";


    for (
        let index = 0;
        index < bytes.length;
        index++
    ) {

        const value =
            bytes[index];


        /*
           Printable ASCII only.

           Non-printable byte dibuat sebagai
           separator supaya signature tidak
           terputus menjadi karakter aneh.
        */

        if (
            value >= 32 &&
            value <= 126
        ) {

            output +=
                String.fromCharCode(
                    value
                );

        } else {

            output +=
                "\0";

        }

    }


    return output;

}


/* =========================================================
   ASCII SIGNATURE SEARCH
========================================================= */

function containsAscii(
    bytes,
    needle
) {

    if (
        !bytes ||
        !needle
    ) {

        return false;

    }


    const target =
        new TextEncoder()
            .encode(
                needle
            );


    if (
        target.length > bytes.length
    ) {

        return false;

    }


    outer:
    for (
        let index = 0;
        index <= bytes.length - target.length;
        index++
    ) {

        for (
            let offset = 0;
            offset < target.length;
            offset++
        ) {

            if (
                bytes[
                    index + offset
                ] !== target[offset]
            ) {

                continue outer;

            }

        }


        return true;

    }


    return false;

}


/* =========================================================
   BYTE SIGNATURE SEARCH
========================================================= */

function containsBytes(
    bytes,
    target
) {

    if (
        !bytes ||
        !target ||
        !target.length
    ) {

        return false;

    }


    if (
        target.length > bytes.length
    ) {

        return false;

    }


    outer:
    for (
        let index = 0;
        index <= bytes.length - target.length;
        index++
    ) {

        for (
            let offset = 0;
            offset < target.length;
            offset++
        ) {

            if (
                bytes[
                    index + offset
                ] !== target[offset]
            ) {

                continue outer;

            }

        }


        return true;

    }


    return false;

}


/* =========================================================
   FORMAT DETECTION
========================================================= */

function detectFormat(
    bytes,
    file
) {

    /*
       JPEG
       FF D8 FF
    */

    if (
        bytes.length >= 3 &&
        bytes[0] === 0xFF &&
        bytes[1] === 0xD8 &&
        bytes[2] === 0xFF
    ) {

        return "jpeg";

    }


    /*
       PNG
       89 50 4E 47 0D 0A 1A 0A
    */

    if (
        bytes.length >= 8 &&
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4E &&
        bytes[3] === 0x47 &&
        bytes[4] === 0x0D &&
        bytes[5] === 0x0A &&
        bytes[6] === 0x1A &&
        bytes[7] === 0x0A
    ) {

        return "png";

    }


    /*
       WEBP
       RIFF....WEBP
    */

    if (
        bytes.length >= 12 &&
        bytes[0] === 0x52 &&
        bytes[1] === 0x49 &&
        bytes[2] === 0x46 &&
        bytes[3] === 0x46 &&
        bytes[8] === 0x57 &&
        bytes[9] === 0x45 &&
        bytes[10] === 0x42 &&
        bytes[11] === 0x50
    ) {

        return "webp";

    }


    /*
       Fallback berdasarkan MIME.
    */

    const mime =
        String(
            file?.type || ""
        ).toLowerCase();


    if (
        mime === "image/jpeg" ||
        mime === "image/jpg"
    ) {

        return "jpeg";

    }


    if (
        mime === "image/png"
    ) {

        return "png";

    }


    if (
        mime === "image/webp"
    ) {

        return "webp";

    }


    return "unknown";

}


/* =========================================================
   JPEG INSPECTION
========================================================= */

function inspectJPEG(
    bytes
) {

    const findings = [];


    /*
       C2PA JPEG menggunakan APP11
       untuk penyimpanan Manifest Store.

       Cari marker APP11:

           FF EB
    */

    let app11Found =
        false;


    for (
        let index = 0;
        index < bytes.length - 1;
        index++
    ) {

        if (
            bytes[index] === 0xFF &&
            bytes[index + 1] === 0xEB
        ) {

            app11Found =
                true;


            /*
               Jangan berhenti.

               C2PA manifest dapat terdiri
               dari beberapa APP11 segment.
            */

        }

    }


    if (
        app11Found
    ) {

        findings.push(
            "JPEG APP11"
        );

    }


    /*
       C2PA label.
    */

    if (
        containsAscii(
            bytes,
            C2PA_LABEL
        )
    ) {

        findings.push(
            "c2pa label"
        );

    }


    /*
       JUMBF label.
    */

    if (
        containsAscii(
            bytes,
            JUMBF_LABEL
        )
    ) {

        findings.push(
            "JUMBF signature"
        );

    }


    /*
       C2PA Manifest Store UUID.
    */

    if (
        containsBytes(
            bytes,
            C2PA_UUID_BYTES
        )
    ) {

        findings.push(
            "C2PA Manifest Store UUID"
        );

    }


    return {

        format: "jpeg",

        app11: app11Found,

        detected:
            findings.length > 0,

        findings

    };

}


/* =========================================================
   PNG INSPECTION
========================================================= */

function inspectPNG(
    bytes
) {

    const findings = [];


    /*
       PNG dapat membawa JUMBF/C2PA
       sebagai chunk.

       Inspector ini sengaja tidak menganggap
       keberadaan sembarang iTXt/tEXt sebagai
       bukti C2PA.

       Kita hanya mencari signature yang
       berkaitan dengan C2PA/JUMBF.
    */


    if (
        containsAscii(
            bytes,
            C2PA_LABEL
        )
    ) {

        findings.push(
            "c2pa label"
        );

    }


    if (
        containsAscii(
            bytes,
            JUMBF_LABEL
        )
    ) {

        findings.push(
            "JUMBF signature"
        );

    }


    if (
        containsBytes(
            bytes,
            C2PA_UUID_BYTES
        )
    ) {

        findings.push(
            "C2PA Manifest Store UUID"
        );

    }


    return {

        format: "png",

        detected:
            findings.length > 0,

        findings

    };

}


/* =========================================================
   WEBP INSPECTION
========================================================= */

function inspectWEBP(
    bytes
) {

    const findings = [];


    /*
       WebP menggunakan RIFF.

       C2PA dapat menggunakan struktur
       JUMBF dalam container yang sesuai.
    */


    if (
        containsAscii(
            bytes,
            C2PA_LABEL
        )
    ) {

        findings.push(
            "c2pa label"
        );

    }


    if (
        containsAscii(
            bytes,
            JUMBF_LABEL
        )
    ) {

        findings.push(
            "JUMBF signature"
        );

    }


    if (
        containsBytes(
            bytes,
            C2PA_UUID_BYTES
        )
    ) {

        findings.push(
            "C2PA Manifest Store UUID"
        );

    }


    return {

        format: "webp",

        detected:
            findings.length > 0,

        findings

    };

}


/* =========================================================
   BUFFER READER
========================================================= */

async function readInspectionBytes(
    file
) {

    if (
        !file
    ) {

        throw new Error(
            "File tidak tersedia."
        );

    }


    if (
        typeof file.arrayBuffer !== "function"
    ) {

        throw new Error(
            "Browser tidak mendukung pembacaan ArrayBuffer."
        );

    }


    if (
        file.size >
        MAX_INSPECT_BYTES
    ) {

        throw new Error(
            "File terlalu besar untuk pemeriksaan provenance."
        );

    }


    const buffer =
        await file.arrayBuffer();


    return new Uint8Array(
        buffer
    );

}


/* =========================================================
   RESULT NORMALIZER
========================================================= */

function createResult(
    format,
    details
) {

    const detected =
        Boolean(
            details?.detected
        );


    return {

        checked: true,

        supported:
            format !== "unknown",

        format,

        detected,

        status:
            detected
                ? "DETECTED"
                : "NOT_DETECTED",

        verified: false,

        verificationStatus:
            "NOT_VERIFIED",

        c2pa: {

            detected,

            verified: false,

            manifestCount:
                detected
                    ? 1
                    : 0

        },

        contentCredentials: {

            detected,

            verified: false

        },

        findings:
            Array.isArray(
                details?.findings
            )
                ? [
                    ...new Set(
                        details.findings
                    )
                ]
                : [],

        digitalSourceType:
            null,

        aiDisclosure:
            null

    };

}


/* =========================================================
   PUBLIC INSPECTOR
========================================================= */

async function inspectProvenance(
    file
) {

    if (
        !file
    ) {

        return {

            checked: false,

            supported: false,

            format: "unknown",

            detected: false,

            status: "NO_FILE",

            verified: false,

            verificationStatus:
                "NOT_VERIFIED",

            c2pa: {

                detected: false,

                verified: false,

                manifestCount: 0

            },

            contentCredentials: {

                detected: false,

                verified: false

            },

            findings: [],

            digitalSourceType: null,

            aiDisclosure: null

        };

    }


    const bytes =
        await readInspectionBytes(
            file
        );


    const format =
        detectFormat(
            bytes,
            file
        );


    /*
       Video belum diperiksa oleh
       inspector ini.

       Jangan menganggap video tanpa
       signature sebagai "clean".
    */

    if (
        format === "unknown"
    ) {

        return createResult(
            format,
            {

                detected: false,

                findings: []

            }
        );

    }


    let details;


    switch (
        format
    ) {

        case "jpeg":

            details =
                inspectJPEG(
                    bytes
                );

            break;


        case "png":

            details =
                inspectPNG(
                    bytes
                );

            break;


        case "webp":

            details =
                inspectWEBP(
                    bytes
                );

            break;


        default:

            details = {

                detected: false,

                findings: []

            };

    }


    return createResult(
        format,
        details
    );

}


/* =========================================================
   SIMPLE STATUS HELPERS
========================================================= */

function hasProvenance(
    result
) {

    return Boolean(
        result &&
        result.detected === true
    );

}


function isProvenanceVerified(
    result
) {

    return Boolean(
        result &&
        result.verified === true
    );

}


/* =========================================================
   PUBLIC API
========================================================= */

export {

    inspectProvenance,

    hasProvenance,

    isProvenanceVerified

};


/* =========================================================
   GLOBAL API
   ---------------------------------------------------------
   Public API kecil untuk debugging / integrasi.
========================================================= */

window.GENZMetadataProvenance =
    Object.freeze({

        inspect:
            inspectProvenance,

        hasProvenance,

        isVerified:
            isProvenanceVerified

    });
