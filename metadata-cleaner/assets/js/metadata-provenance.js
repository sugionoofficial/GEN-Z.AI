/* =========================================================
   GEN-Z.AI
   AI METADATA CLEANER
   ---------------------------------------------------------
   File:
   metadata-cleaner/assets/js/metadata-provenance.js

   Fungsi:
   - Memeriksa C2PA
   - Memeriksa Content Credentials
   - Memeriksa C2PA Manifest Store
   - Mendukung C2PA IMAGE + VIDEO
   - Mendukung JPEG / PNG / WebP / MP4 / MOV
   - Mendeteksi digitalSourceType
   - Mendeteksi trainedAlgorithmicMedia
   - Mendeteksi c2pa.created
   - Mendeteksi softwareAgent
   - Mendeteksi c2pa.ai-disclosure
   - Tidak mengubah file
   - Tidak menghapus metadata
   - Tidak melakukan visual AI detection

   CATATAN:
   ---------------------------------------------------------
   DETECTED
       Struktur / metadata C2PA ditemukan.

   AI DETECTED
       Ditemukan sinyal AI provenance eksplisit,
       misalnya:
       - trainedAlgorithmicMedia
       - trainedAlgorithmicData
       - c2pa.ai-disclosure
       - AI-specific provenance declaration

   NOT VERIFIED
       File terdeteksi memiliki provenance,
       tetapi modul browser ini belum melakukan
       cryptographic signature verification.

   Modul ini TIDAK mengklaim bahwa signature valid
   hanya karena struktur C2PA ditemukan.
========================================================= */


/* =========================================================
   CONSTANTS
========================================================= */

const MAX_INSPECT_BYTES =
    50 * 1024 * 1024;


/*
   File besar (umumnya video) tidak lagi ditolak mentah-mentah.

   Membaca 200 MB ke memori browser bisa membuat tab kehabisan
   memori, jadi untuk berkas di atas MAX_INSPECT_BYTES hanya bagian
   awal dan akhir yang dipindai. Hasilnya ditandai `partial: true`
   supaya UI tidak pernah mengklaim "tidak ditemukan provenance"
   seolah seluruh berkas sudah diperiksa.
*/
const PARTIAL_WINDOW_BYTES =
    12 * 1024 * 1024;


const PARTIAL_OVERLAP_BYTES =
    64 * 1024;


const ASCII_CACHE =
    new WeakMap();


/*
   C2PA Manifest Store UUID.

   Representasi ASCII:
   63327061-0011-0010-8000-00AA00389B71
*/

const C2PA_UUID_HEX =
    "6332706100110010800000AA00389B71";


const C2PA_UUID_BYTES =
    hexToBytes(
        C2PA_UUID_HEX
    );


/*
   Common C2PA / JUMBF labels.
*/

const C2PA_LABEL =
    "c2pa";


const JUMBF_LABEL =
    "jumbf";


const CONTENT_CREDENTIALS_LABEL =
    "content credentials";


const C2PA_CREATED_LABEL =
    "c2pa.created";


const C2PA_AI_DISCLOSURE_LABEL =
    "c2pa.ai-disclosure";


/*
   IPTC digitalSourceType value used by
   C2PA for Generative AI / trained algorithmic media.
*/

const TRAINED_ALGORITHMIC_MEDIA =
    "trainedalgorithmicmedia";


const TRAINED_ALGORITHMIC_DATA =
    "trainedalgorithmicdata";


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
   FILE EXTENSION
   ---------------------------------------------------------
   FIX:
   detectFormat() menggunakan getExtension()
   untuk membedakan MP4 dan MOV, tetapi fungsi
   sebelumnya tidak tersedia.

   Fungsi ini sengaja lokal di module ini agar
   metadata-provenance.js tidak bergantung pada
   global function dari module lain.
========================================================= */

function getExtension(
    fileName
) {

    if (
        typeof fileName !== "string"
    ) {

        return "";

    }


    const normalized =
        fileName
            .trim()
            .toLowerCase();


    if (
        !normalized
    ) {

        return "";

    }


    const lastDot =
        normalized.lastIndexOf(
            "."
        );


    if (
        lastDot < 0 ||
        lastDot === normalized.length - 1
    ) {

        return "";

    }


    return normalized
        .slice(
            lastDot + 1
        )
        .replace(
            /[^a-z0-9]/g,
            ""
        );

}


/* =========================================================
   ASCII HELPERS
========================================================= */

function bytesToAscii(
    bytes
) {

    const cached =
        ASCII_CACHE.get(
            bytes
        );


    if (
        cached !== undefined
    ) {

        return cached;

    }


    const text =
        new TextDecoder(
            "windows-1252"
        ).decode(
            bytes
        );


    ASCII_CACHE.set(
        bytes,
        text
    );


    return text;

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
        target.length >
        bytes.length
    ) {

        return false;

    }


    outer:
    for (
        let index = 0;
        index <=
            bytes.length -
            target.length;
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
                ] !==
                target[offset]
            ) {

                continue outer;

            }

        }


        return true;

    }


    return false;

}


/* =========================================================
   CASE-INSENSITIVE ASCII SEARCH
========================================================= */

function containsAsciiInsensitive(
    bytes,
    needle
) {

    if (
        !bytes ||
        !needle
    ) {

        return false;

    }


    const ascii =
        bytesToAscii(
            bytes
        )
        .toLowerCase();


    return ascii.includes(
        String(
            needle
        ).toLowerCase()
    );

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
        target.length >
        bytes.length
    ) {

        return false;

    }


    outer:
    for (
        let index = 0;
        index <=
            bytes.length -
            target.length;
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
                ] !==
                target[offset]
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
       ISO BMFF / MP4 / MOV

       MP4/MOV biasanya memiliki:
       - ftyp
       - moov
       - mdat

       C2PA pada video dapat disimpan
       melalui ISO BMFF/JUMBF structures.
    */

    if (
        isIsoBmff(
            bytes
        )
    ) {

        /*
           FIX:
           getExtension() sekarang tersedia
           secara lokal di module ini.
        */

        const extension =
            getExtension(
                file?.name
            );


        const mime =
            String(
                file?.type || ""
            ).toLowerCase();


        if (
            mime === "video/quicktime" ||
            extension === "mov"
        ) {

            return "mov";

        }


        return "mp4";

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


    if (
        mime === "video/mp4"
    ) {

        return "mp4";

    }


    if (
        mime === "video/quicktime"
    ) {

        return "mov";

    }


    return "unknown";

}


/* =========================================================
   ISO BMFF DETECTION
========================================================= */

function isIsoBmff(
    bytes
) {

    if (
        !bytes ||
        bytes.length < 12
    ) {

        return false;

    }


    /*
       Standard BMFF first box:

       size: 4 bytes
       type: 4 bytes

       Example:
       00 00 00 xx
       66 74 79 70

       = "ftyp"
    */

    if (
        readAscii(
            bytes,
            4,
            4
        ) === "ftyp"
    ) {

        return true;

    }


    /*
       Some files may not begin with
       the expected ftyp location.
       Scan the first part for a valid
       ftyp box signature.
    */

    const limit =
        Math.min(
            bytes.length - 4,
            1024
        );


    for (
        let index = 0;
        index <= limit;
        index++
    ) {

        if (
            readAscii(
                bytes,
                index,
                4
            ) === "ftyp"
        ) {

            return true;

        }

    }


    return false;

}


/* =========================================================
   READ ASCII FROM BYTE ARRAY
========================================================= */

function readAscii(
    bytes,
    start,
    length
) {

    if (
        !bytes ||
        start < 0 ||
        length <= 0 ||
        start + length >
            bytes.length
    ) {

        return "";

    }


    let output =
        "";


    for (
        let index = start;
        index < start + length;
        index++
    ) {

        output +=
            String.fromCharCode(
                bytes[index]
            );

    }


    return output;

}


/* =========================================================
   JPEG INSPECTION
========================================================= */

function inspectJPEG(
    bytes
) {

    const findings = [];


    /*
       C2PA JPEG menggunakan APP11.
    */

    let app11Found =
        false;


    for (
        let index = 0;
        index <
            bytes.length - 1;
        index++
    ) {

        if (
            bytes[index] === 0xFF &&
            bytes[index + 1] === 0xEB
        ) {

            app11Found =
                true;

        }

    }


    if (
        app11Found
    ) {

        findings.push(
            "JPEG APP11"
        );

    }


    if (
        containsAsciiInsensitive(
            bytes,
            C2PA_LABEL
        )
    ) {

        findings.push(
            "c2pa label"
        );

    }


    if (
        containsAsciiInsensitive(
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

        format:
            "jpeg",

        detected:
            findings.length > 0,

        findings,

        ai:
            inspectAIProvenance(
                bytes
            )

    };

}


/* =========================================================
   PNG INSPECTION
========================================================= */

function inspectPNG(
    bytes
) {

    const findings = [];


    if (
        containsAsciiInsensitive(
            bytes,
            C2PA_LABEL
        )
    ) {

        findings.push(
            "c2pa label"
        );

    }


    if (
        containsAsciiInsensitive(
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

        format:
            "png",

        detected:
            findings.length > 0,

        findings,

        ai:
            inspectAIProvenance(
                bytes
            )

    };

}


/* =========================================================
   WEBP INSPECTION
========================================================= */

function inspectWEBP(
    bytes
) {

    const findings = [];


    if (
        containsAsciiInsensitive(
            bytes,
            C2PA_LABEL
        )
    ) {

        findings.push(
            "c2pa label"
        );

    }


    if (
        containsAsciiInsensitive(
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

        format:
            "webp",

        detected:
            findings.length > 0,

        findings,

        ai:
            inspectAIProvenance(
                bytes
            )

    };

}


/* =========================================================
   MP4 / MOV INSPECTION
========================================================= */

function inspectMP4(
    bytes,
    format
) {

    const findings = [];


    /*
       ISO BMFF confirmation.
    */

    if (
        isIsoBmff(
            bytes
        )
    ) {

        findings.push(
            "ISO BMFF"
        );

    }


    /*
       C2PA Manifest Store UUID.

       This is the strongest structural
       signal we can inspect locally
       without cryptographic validation.
    */

    const c2paUuidFound =
        containsBytes(
            bytes,
            C2PA_UUID_BYTES
        );


    if (
        c2paUuidFound
    ) {

        findings.push(
            "C2PA Manifest Store UUID"
        );

    }


    /*
       C2PA label.
    */

    const c2paFound =
        containsAsciiInsensitive(
            bytes,
            C2PA_LABEL
        );


    if (
        c2paFound
    ) {

        findings.push(
            "c2pa label"
        );

    }


    /*
       JUMBF.
    */

    const jumbfFound =
        containsAsciiInsensitive(
            bytes,
            JUMBF_LABEL
        );


    if (
        jumbfFound
    ) {

        findings.push(
            "JUMBF signature"
        );

    }


    /*
       Content Credentials.
    */

    const contentCredentialsFound =
        containsAsciiInsensitive(
            bytes,
            CONTENT_CREDENTIALS_LABEL
        );


    if (
        contentCredentialsFound
    ) {

        findings.push(
            "Content Credentials"
        );

    }


    /*
       c2pa.created.
    */

    const createdFound =
        containsAsciiInsensitive(
            bytes,
            C2PA_CREATED_LABEL
        );


    if (
        createdFound
    ) {

        findings.push(
            "c2pa.created"
        );

    }


    /*
       c2pa.ai-disclosure.
    */

    const aiDisclosureFound =
        containsAsciiInsensitive(
            bytes,
            C2PA_AI_DISCLOSURE_LABEL
        );


    if (
        aiDisclosureFound
    ) {

        findings.push(
            "c2pa.ai-disclosure"
        );

    }


    /*
       AI provenance inspection.
    */

    const ai =
        inspectAIProvenance(
            bytes
        );


    if (
        ai.digitalSourceType
    ) {

        findings.push(
            `digitalSourceType: ${ai.digitalSourceType}`
        );

    }


    if (
        ai.softwareAgent
    ) {

        findings.push(
            `softwareAgent: ${ai.softwareAgent}`
        );

    }


    if (
        ai.aiDisclosure
    ) {

        findings.push(
            "AI Disclosure"
        );

    }


    /*
       A C2PA video can be detected by:
       - UUID
       - c2pa
       - JUMBF
       - c2pa.created
       - Content Credentials
    */

    const detected =
        (
            c2paUuidFound ||
            c2paFound ||
            jumbfFound ||
            contentCredentialsFound ||
            createdFound ||
            aiDisclosureFound
        );


    return {

        format,

        detected,

        findings,

        ai

    };

}


/* =========================================================
   AI PROVENANCE INSPECTION
========================================================= */

function inspectAIProvenance(
    bytes
) {

    const ascii =
        bytesToAscii(
            bytes
        );


    const normalized =
        ascii
            .replace(
                /\0+/g,
                " "
            )
            .replace(
                /\s+/g,
                " "
            )
            .trim();


    const lower =
        normalized.toLowerCase();


    /*
       digitalSourceType
       -----------------------------------------------
       Search for the complete known URI first.
    */

    let digitalSourceType =
        null;


    if (
        lower.includes(
            "trainedalgorithmicmedia"
        )
    ) {

        digitalSourceType =
            "trainedAlgorithmicMedia";

    }
    else if (
        lower.includes(
            "trainedalgorithmicdata"
        )
    ) {

        digitalSourceType =
            "trainedAlgorithmicData";

    }
    else {

        const sourceTypeMatch =
            normalized.match(
                /digitalSourceType.{0,300}?([a-zA-Z][a-zA-Z0-9_-]*(?:Media|Data))/i
            );


        if (
            sourceTypeMatch &&
            sourceTypeMatch[1]
        ) {

            digitalSourceType =
                sourceTypeMatch[1];

        }

    }


    /*
       softwareAgent
    */

    let softwareAgent =
        null;


    const softwareAgentMatch =
        normalized.match(
            /softwareAgent.{0,220}/i
        );


    if (
        softwareAgentMatch &&
        softwareAgentMatch[0]
    ) {

        softwareAgent =
            cleanProvenanceValue(
                softwareAgentMatch[0]
            );

    }


    /*
       AI Disclosure.
    */

    const aiDisclosure =
        (
            lower.includes(
                "c2pa.ai-disclosure"
            ) ||
            lower.includes(
                "ai-disclosure"
            )
        )
            ? "c2pa.ai-disclosure"
            : null;


    /*
       Explicit AI source declaration.
    */

    const trainedAlgorithmic =
        (
            lower.includes(
                TRAINED_ALGORITHMIC_MEDIA
            ) ||
            lower.includes(
                TRAINED_ALGORITHMIC_DATA
            )
        );


    /*
       c2pa.created alone does not prove AI.
    */

    const aiDetected =
        (
            trainedAlgorithmic ||
            Boolean(
                aiDisclosure
            )
        );


    return {

        aiDetected,

        digitalSourceType,

        softwareAgent,

        aiDisclosure

    };

}


/* =========================================================
   CLEAN PROVENANCE VALUE
========================================================= */

function cleanProvenanceValue(
    value
) {

    if (
        value === null ||
        value === undefined
    ) {

        return null;

    }


    const text =
        String(
            value
        )
        .replace(
            /\0+/g,
            " "
        )
        .replace(
            /\s+/g,
            " "
        )
        .trim();


    if (
        !text
    ) {

        return null;

    }


    const maxLength =
        180;


    if (
        text.length >
        maxLength
    ) {

        return (
            text.slice(
                0,
                maxLength
            ) +
            "..."
        );

    }


    return text;

}


/* =========================================================
   BUFFER READER
========================================================= */

function formatMegabytes(
    bytes
) {

    if (
        !Number.isFinite(
            bytes
        ) ||
        bytes <= 0
    ) {

        return "0 MB";

    }


    const megabytes =
        bytes / (1024 * 1024);


    return `${megabytes >= 10
        ? Math.round(megabytes)
        : Math.round(megabytes * 10) / 10} MB`;

}


function inspectionLimitNote(
    fileSize,
    scannedBytes
) {

    return `Berkas ${formatMegabytes(fileSize)} melebihi batas pemindaian penuh `
        + `${formatMegabytes(MAX_INSPECT_BYTES)}. Provenance hanya diperiksa pada `
        + `${formatMegabytes(scannedBytes)} di bagian awal dan akhir berkas, `
        + `jadi "tidak ditemukan" bukan berarti berkas bebas C2PA.`;

}


/*
   Mengembalikan objek, bukan Uint8Array mentah:

   {
       bytes, partial, fileSize, scannedBytes
   }
*/
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
        typeof file.arrayBuffer !==
        "function" &&
        typeof file.slice !==
        "function"
    ) {

        throw new Error(
            "Browser tidak mendukung pembacaan ArrayBuffer."
        );

    }


    const fileSize =
        Number(
            file.size
        ) || 0;


    if (
        fileSize <=
        MAX_INSPECT_BYTES
    ) {

        const buffer =
            await file.arrayBuffer();


        const bytes =
            new Uint8Array(
                buffer
            );


        return {
            bytes,
            partial:
                false,
            fileSize,
            scannedBytes:
                bytes.length
        };

    }


    /*
       Pemindaian terbatas: kepala + ekor berkas.

       Metadata C2PA pada JPEG/PNG/WebP berada dekat awal atau akhir
       berkas, dan pada MP4/MOV ada di dalam box `uuid`/`moov` yang
       biasanya berada di salah satu ujung juga. Byte yang dipindai
       tetap dipakai apa adanya, jadi bila label C2PA ditemukan hasilnya
       tetap valid — yang tidak bisa diklaim hanyalah "bersih".
    */
    const windowEnd =
        Math.min(
            fileSize,
            PARTIAL_WINDOW_BYTES + PARTIAL_OVERLAP_BYTES
        );


    const tailStart =
        Math.max(
            0,
            fileSize - PARTIAL_WINDOW_BYTES
        );


    const head =
        new Uint8Array(
            await file
                .slice(0, windowEnd)
                .arrayBuffer()
        );


    const tail =
        tailStart > windowEnd
            ? new Uint8Array(
                await file
                    .slice(tailStart, fileSize)
                    .arrayBuffer()
            )
            : new Uint8Array(0);


    const bytes =
        new Uint8Array(
            head.length + tail.length
        );


    bytes.set(
        head,
        0
    );


    if (
        tail.length > 0
    ) {

        bytes.set(
            tail,
            head.length
        );

    }


    return {
        bytes,
        partial:
            true,
        fileSize,
        scannedBytes:
            bytes.length,
        scanWindows: {
            head: [0, windowEnd],
            tail: tail.length > 0
                ? [tailStart, fileSize]
                : null
        },
        limitBytes:
            MAX_INSPECT_BYTES
    };

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


    const ai =
        details?.ai &&
        typeof details.ai ===
            "object"

            ? details.ai

            : {

                aiDetected:
                    false,

                digitalSourceType:
                    null,

                softwareAgent:
                    null,

                aiDisclosure:
                    null

            };


    const findings =
        Array.isArray(
            details?.findings
        )
            ? [
                ...new Set(
                    details.findings
                )
            ]
            : [];


    return {

        checked:
            true,

        supported:
            format !== "unknown",

        format,

        detected,

        aiDetected:
            Boolean(
                ai.aiDetected
            ),

        status:
            detected
                ? "DETECTED"
                : "NOT_DETECTED",

        verified:
            false,

        verificationStatus:
            "NOT_VERIFIED",

        c2pa: {

            detected,

            verified:
                false,

            manifestCount:
                detected
                    ? 1
                    : 0

        },

        contentCredentials: {

            detected,

            verified:
                false

        },

        findings,

        digitalSourceType:
            ai.digitalSourceType,

        aiDisclosure:
            ai.aiDisclosure,

        softwareAgent:
            ai.softwareAgent

    };

}


/* =========================================================
   EMPTY RESULT
========================================================= */

function createEmptyResult() {

    return {

        checked:
            false,

        supported:
            false,

        format:
            "unknown",

        detected:
            false,

        aiDetected:
            false,

        status:
            "NO_FILE",

        verified:
            false,

        verificationStatus:
            "NOT_VERIFIED",

        c2pa: {

            detected:
                false,

            verified:
                false,

            manifestCount:
                0

        },

        contentCredentials: {

            detected:
                false,

            verified:
                false

        },

        findings: [],

        digitalSourceType:
            null,

        aiDisclosure:
            null,

        softwareAgent:
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

        return createEmptyResult();

    }


    const inspection =
        await readInspectionBytes(
            file
        );


    const bytes =
        inspection.bytes;


    /*
       Bila pemindaian dibatasi, hasil "tidak ditemukan" tidak boleh
       tampil seolah seluruh berkas bersih. Statusnya menjadi PARTIAL
       dan catatan batasnya ikut dikirim ke UI.
    */
    const decorateResult =
        result => {

            if (
                !inspection.partial
            ) {

                return result;

            }


            return {
                ...result,
                partial:
                    true,
                status:
                    result.detected
                        ? result.status
                        : "PARTIAL",
                note:
                    inspectionLimitNote(
                        inspection.fileSize,
                        inspection.scannedBytes
                    ),
                fileSize:
                    inspection.fileSize,
                scannedBytes:
                    inspection.scannedBytes,
                scanWindows:
                    inspection.scanWindows,
                inspectionLimitBytes:
                    MAX_INSPECT_BYTES
            };

        };


    const format =
        detectFormat(
            bytes,
            file
        );


    if (
        format ===
        "unknown"
    ) {

        return decorateResult(
            createResult(
            format,
            {

                detected:
                    false,

                findings: [],

                ai: {

                    aiDetected:
                        false,

                    digitalSourceType:
                        null,

                    softwareAgent:
                        null,

                    aiDisclosure:
                        null

                }

            }
        )
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


        case "mp4":

        case "mov":

            details =
                inspectMP4(
                    bytes,
                    format
                );

            break;


        default:

            details = {

                detected:
                    false,

                findings: [],

                ai: {

                    aiDetected:
                        false,

                    digitalSourceType:
                        null,

                    softwareAgent:
                        null,

                    aiDisclosure:
                        null

                }

            };

    }


    return decorateResult(
        createResult(
            format,
            details
        )
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


function hasAIProvenance(
    result
) {

    return Boolean(
        result &&
        result.aiDetected === true
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

    hasAIProvenance,

    isProvenanceVerified

};


/* =========================================================
   GLOBAL API
========================================================= */

window.GENZMetadataProvenance =
    Object.freeze({

        inspect:
            inspectProvenance,

        hasProvenance,

        hasAIProvenance,

        isVerified:
            isProvenanceVerified

    });
