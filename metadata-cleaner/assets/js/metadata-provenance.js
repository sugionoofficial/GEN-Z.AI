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


/*
   PEMINDAIAN SELURUH BERKAS (STREAMING)
   ---------------------------------------------------------
   Berkas besar TIDAK dibaca sekaligus ke memori, tetapi dibaca
   potongan demi potongan memakai `File.slice()`.

   `slice()` hanya membuat referensi ke data asli; yang masuk
   memori cuma satu potongan. Dengan cara ini berkas 500 MB pun
   bisa diperiksa SAMPAI HABIS tanpa membuat tab kehabisan memori,
   dan tidak ada lagi status "hanya diperiksa sebagian".

   Pada MP4/MOV, kotak `mdat` (isi video/audio) dilewati tanpa
   dibaca sama sekali: manifest C2PA selalu berada di container
   metadata, dan byte video terkompresi bisa kebetulan membentuk
   kata "c2pa" sehingga menghasilkan tuduhan palsu.
*/

const HEAD_BYTES =
    4 * 1024 * 1024;


const SCAN_CHUNK_BYTES =
    4 * 1024 * 1024;


const SCAN_OVERLAP_BYTES =
    64;


/*
   Label yang dicari saat pemindaian penuh.
*/

const SCAN_LABELS =
    [
        "c2pa",
        "jumbf",
        "content credentials",
        "softwareagent",
        "trainedalgorithmicmedia",
        "trainedalgorithmicdata",
        "digitalsourcetype"
    ];


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
   ISO BMFF MEDIA REGIONS
========================================================= */

function readUint32BEValue(
    bytes,
    offset
) {

    return (
        (
            bytes[offset] << 24
        ) |
        (
            bytes[offset + 1] << 16
        ) |
        (
            bytes[offset + 2] << 8
        ) |
        bytes[offset + 3]
    ) >>> 0;

}


/**
 * Mencari rentang byte kotak `mdat` (data video/audio).
 *
 * Label C2PA tidak pernah ditulis di dalam `mdat`. Kalau
 * pencarian teks dilakukan pada seluruh berkas, rangkaian byte
 * acak hasil kompresi bisa kebetulan membentuk kata `c2pa` dan
 * memicu "provenance ditemukan" palsu — terutama pada video
 * besar. Karena itu bagian `mdat` dilewati.
 */
function findMediaByteRanges(
    bytes
) {

    const ranges = [];

    let offset = 0;

    let boxCount = 0;


    while (
        offset + 8 <= bytes.length &&
        boxCount < 512
    ) {

        let size =
            readUint32BEValue(
                bytes,
                offset
            );


        const type =
            readAscii(
                bytes,
                offset + 4,
                4
            );


        let headerSize =
            8;


        if (
            size === 1
        ) {

            if (
                offset + 16 > bytes.length
            ) {

                break;

            }


            const high =
                readUint32BEValue(
                    bytes,
                    offset + 8
                );


            const low =
                readUint32BEValue(
                    bytes,
                    offset + 12
                );


            size =
                high *
                4294967296 +
                low;

            headerSize =
                16;

        }
        else if (
            size === 0
        ) {

            size =
                bytes.length - offset;

        }


        if (
            size < headerSize ||
            offset + size > bytes.length
        ) {

            /*
               Struktur tidak bisa diikuti (mis. karena
               pemindaian sebagian menggabungkan kepala dan ekor
               berkas). Berhenti dan biarkan pemanggil memakai
               pemindaian penuh.
            */

            break;

        }


        if (
            type === "mdat"
        ) {

            ranges.push(
                [
                    offset + headerSize,
                    offset + size
                ]
            );

        }


        offset +=
            size;

        boxCount +=
            1;

    }


    return {

        ranges,

        mappedBytes:
            offset,

        complete:
            offset >= bytes.length

    };

}


function containsAsciiInsensitiveOutside(
    bytes,
    label,
    ranges
) {

    if (
        !ranges ||
        ranges.length === 0
    ) {

        return containsAsciiInsensitive(
            bytes,
            label
        );

    }


    let cursor = 0;


    for (
        let index = 0;
        index < ranges.length; index += 1
    ) {

        const start =
            ranges[index][0];

        const end =
            ranges[index][1];


        if (
            start > cursor
        ) {

            if (
                containsAsciiInsensitive(
                    bytes.subarray(
                        cursor,
                        start
                    ),
                    label
                )
            ) {

                return true;

            }

        }


        cursor =
            Math.max(
                cursor,
                end
            );

    }


    if (
        cursor < bytes.length
    ) {

        return containsAsciiInsensitive(
            bytes.subarray(
                cursor
            ),
            label
        );

    }


    return false;

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
       Bagian `mdat` (data video/audio) tidak boleh ikut dicari.

       Byte hasil kompresi bersifat acak; rangkaian `63 32 70 61`
       bisa muncul kebetulan dan membuat video biasa dituduh
       membawa C2PA. Manifest C2PA selalu berada di container
       metadata (`moov`, `uuid`, `udta`, `jumb`), bukan di `mdat`.
    */

    const mediaScan =
        findMediaByteRanges(
            bytes
        );


    const mediaRanges =
        mediaScan.complete
            ? mediaScan.ranges
            : [];


    /*
       C2PA label.
    */

    const c2paFound =
        containsAsciiInsensitiveOutside(
            bytes,
            C2PA_LABEL,
            mediaRanges
        );


    if (
        c2paFound
    ) {

        findings.push(
            "c2pa label"
        );

    }
    else if (
        mediaRanges.length > 0 &&
        containsAsciiInsensitive(
            bytes,
            C2PA_LABEL
        )
    ) {

        /*
           Label hanya muncul di dalam data media: hampir pasti
           kebetulan byte, bukan provenance sungguhan.
        */

        findings.push(
            "label c2pa di dalam data media (kemungkinan positif palsu, bukan provenance)"
        );

    }


    /*
       JUMBF.
    */

    const jumbfFound =
        containsAsciiInsensitiveOutside(
            bytes,
            JUMBF_LABEL,
            mediaRanges
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
        containsAsciiInsensitiveOutside(
            bytes,
            CONTENT_CREDENTIALS_LABEL,
            mediaRanges
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
        containsAsciiInsensitiveOutside(
            bytes,
            C2PA_CREATED_LABEL,
            mediaRanges
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
        containsAsciiInsensitiveOutside(
            bytes,
            C2PA_AI_DISCLOSURE_LABEL,
            mediaRanges
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

    return `Pemindaian seluruh berkas berhenti di `
        + `${formatMegabytes(scannedBytes)} dari ${formatMegabytes(fileSize)} `
        + `(browser gagal membaca sisa berkas). Karena itu "tidak ditemukan" `
        + `belum berarti berkas bebas C2PA.`;

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
       Berkas besar: hanya KEPALA yang dibaca ke memori.

       Sisa berkas tidak dilewatkan — ia diperiksa lewat pemindaian
       streaming di `scanWholeFile()` (lihat `inspectProvenance`).
       Kepala dipakai untuk mengenali format dan struktur awal.
    */

    const headEnd =
        Math.min(
            fileSize,
            HEAD_BYTES
        );


    const head =
        new Uint8Array(
            await readSliceBytes(
                file,
                0,
                headEnd
            )
        );


    return {
        bytes:
            head,
        partial:
            false,
        stream:
            true,
        fileSize,
        scannedBytes:
            head.length,
        limitBytes:
            MAX_INSPECT_BYTES
    };

}


/* =========================================================
   STREAMING WHOLE-FILE SCAN
========================================================= */

async function readSliceBytes(
    file,
    start,
    end
) {

    if (
        end <= start
    ) {

        return new Uint8Array(0);

    }


    const blob =
        typeof file.slice ===
            "function"
            ? file.slice(
                start,
                end
            )
            : file;


    if (
        !blob ||
        typeof blob.arrayBuffer !==
            "function"
    ) {

        throw new Error(
            "Browser tidak mendukung pembacaan potongan berkas."
        );

    }


    return new Uint8Array(
        await blob.arrayBuffer()
    );

}


/*
   Pencocokan label pada satu potongan berkas.

   Potongan diubah menjadi string ASCII (potongan demi potongan
   kecil supaya tidak melampaui batas argumen fungsi), lalu
   `toLowerCase().includes()` memakai mesin string bawaan browser
   yang jauh lebih cepat daripada perulangan byte manual.
*/

function chunkToLowercase(
    bytes
) {

    const step =
        8192;


    let text =
        "";


    for (
        let offset = 0;
        offset < bytes.length;
        offset += step
    ) {

        text +=
            String.fromCharCode.apply(
                null,
                bytes.subarray(
                    offset,
                    Math.min(
                        offset + step,
                        bytes.length
                    )
                )
            );

    }


    return text.toLowerCase();

}


function containsByteSequence(
    bytes,
    sequence
) {

    const last =
        bytes.length - sequence.length;


    for (
        let index = 0;
        index <= last; index += 1
    ) {

        let matched =
            true;


        for (
            let offset = 0;
            offset < sequence.length; offset += 1
        ) {

            if (
                bytes[index + offset] !==
                sequence[offset]
            ) {

                matched =
                    false;

                break;

            }

        }


        if (
            matched
        ) {

            return true;

        }

    }


    return false;

}


/*
   Menyimpan temuan pemindaian streaming.
*/

function createScanTally() {

    return {

        labels:
            new Set(),

        ai: {

            aiDetected:
                false,

            digitalSourceType:
                null,

            softwareAgent:
                null,

            aiDisclosure:
                null

        },

        scannedBytes:
            0,

        mediaSkippedBytes:
            0,

        boxes:
            0,

        complete:
            false

    };

}


function absorbChunk(
    tally,
    bytes,
    chunkStart
) {

    const chunkEnd =
        chunkStart +
        bytes.length;


    const labelsBefore =
        tally.labels.size;


    const haystack =
        chunkToLowercase(
            bytes
        );


    for (
        let index = 0;
        index < SCAN_LABELS.length; index += 1
    ) {

        const label =
            SCAN_LABELS[index];


        if (
            tally.labels.has(
                label
            )
        ) {

            continue;

        }


        if (
            haystack.includes(
                label
            )
        ) {

            tally.labels.add(
                label
            );

        }

    }


    /*
       Manifest C2PA selalu ditandai UUID khusus.
    */

    if (
        !tally.labels.has(
            "c2pa-uuid"
        ) &&
        containsByteSequence(
            bytes,
            C2PA_UUID_BYTES
        )
    ) {

        tally.labels.add(
            "c2pa-uuid"
        );

    }


    /*
       Detail AI (softwareAgent, digitalSourceType) hanya diambil
       dari potongan yang BARU menemukan sinyal, supaya berkas
       besar tidak diurai berulang-ulang tanpa alasan.
    */

    const hasSignal =
        tally.labels.size >
        labelsBefore;


    if (
        hasSignal
    ) {

        try {

            const ai =
                inspectAIProvenance(
                    bytes
                );


            if (
                ai.softwareAgent &&
                !tally.ai.softwareAgent
            ) {

                tally.ai.softwareAgent =
                    ai.softwareAgent;

            }


            if (
                ai.digitalSourceType &&
                !tally.ai.digitalSourceType
            ) {

                tally.ai.digitalSourceType =
                    ai.digitalSourceType;

            }


            if (
                ai.aiDisclosure &&
                !tally.ai.aiDisclosure
            ) {

                tally.ai.aiDisclosure =
                    ai.aiDisclosure;

            }


            if (
                ai.aiDetected
            ) {

                tally.ai.aiDetected =
                    true;

            }

        } catch (
            error
        ) {

            console.warn(
                "[GEN-Z.AI] Detail AI dilewati:",
                error
            );

        }

    }


    tally.scannedBytes +=
        chunkEnd - chunkStart;

}


/*
   Memindai payload sebuah kotak MP4 sampai habis,
   potongan demi potongan.
*/
async function scanRange(
    file,
    start,
    end,
    tally
) {

    let cursor =
        start;


    while (
        cursor < end
    ) {

        const chunkStart =
            Math.max(
                start,
                cursor -
                    SCAN_OVERLAP_BYTES
            );


        const chunkEnd =
            Math.min(
                cursor +
                    SCAN_CHUNK_BYTES,
                end
            );


        const chunk =
            await readSliceBytes(
                file,
                chunkStart,
                chunkEnd
            );


        absorbChunk(
            tally,
            chunk,
            chunkStart
        );


        cursor =
            chunkEnd;

    }

}


/*
   MP4 / MOV: lewati `mdat`, pindai seluruh container metadata.
*/
async function scanIsoBmffFile(
    file,
    fileSize,
    tally
) {

    let offset = 0;


    while (
        offset + 8 <= fileSize &&
        tally.boxes < 100000
    ) {

        const header =
            await readSliceBytes(
                file,
                offset,
                Math.min(
                    offset + 16,
                    fileSize
                )
            );


        if (
            header.length < 8
        ) {

            break;

        }


        let size =
            (
                (
                    header[0] << 24
                ) |
                (
                    header[1] << 16
                ) |
                (
                    header[2] << 8
                ) |
                header[3]
            ) >>> 0;


        const type =
            String.fromCharCode(
                header[4],
                header[5],
                header[6],
                header[7]
            );


        let headerSize =
            8;


        if (
            size === 1 &&
            header.length >= 16
        ) {

            const high =
                (
                    (
                        header[8] << 24
                    ) |
                    (
                        header[9] << 16
                    ) |
                    (
                        header[10] << 8
                    ) |
                    header[11]
                ) >>> 0;


            const low =
                (
                    (
                        header[12] << 24
                    ) |
                    (
                        header[13] << 16
                    ) |
                    (
                        header[14] << 8
                    ) |
                    header[15]
                ) >>> 0;


            size =
                high *
                4294967296 +
                low;


            headerSize =
                16;

        }
        else if (
            size === 0
        ) {

            size =
                fileSize - offset;

        }


        if (
            size < headerSize
        ) {

            break;

        }


        const boxEnd =
            Math.min(
                offset + size,
                fileSize
            );


        if (
            type === "mdat"
        ) {

            /*
               Isi video/audio: dilewati tanpa dibaca.
            */

            tally.mediaSkippedBytes +=
                boxEnd - offset;

        }
        else {

            await scanRange(
                file,
                offset + headerSize,
                boxEnd,
                tally
            );

        }


        offset =
            boxEnd;

        tally.boxes +=
            1;

    }


    tally.complete =
        offset >= fileSize;

}


/*
   Format lain: baca berurutan sampai akhir berkas.
*/
async function scanSequentialFile(
    file,
    fileSize,
    tally
) {

    let cursor = 0;


    while (
        cursor < fileSize
    ) {

        const chunkStart =
            Math.max(
                0,
                cursor -
                    SCAN_OVERLAP_BYTES
            );


        const chunkEnd =
            Math.min(
                cursor +
                    SCAN_CHUNK_BYTES,
                fileSize
            );


        const chunk =
            await readSliceBytes(
                file,
                chunkStart,
                chunkEnd
            );


        if (
            chunk.length === 0
        ) {

            break;

        }


        absorbChunk(
            tally,
            chunk,
            chunkStart
        );


        cursor =
            chunkEnd;

    }


    tally.complete =
        cursor >= fileSize;

}


/**
 * Memeriksa SELURUH berkas tanpa memuat semuanya ke memori.
 *
 * @returns {Promise<object>} tally pemindaian
 */
async function scanWholeFile(
    file,
    isoBmff
) {

    const tally =
        createScanTally();


    const fileSize =
        Number(
            file.size
        ) || 0;


    try {

        if (
            isoBmff
        ) {

            await scanIsoBmffFile(
                file,
                fileSize,
                tally
            );

        }
        else {

            await scanSequentialFile(
                file,
                fileSize,
                tally
            );

        }

    } catch (
        error
    ) {

        console.warn(
            "[GEN-Z.AI] Pemindaian penuh terhenti:",
            error
        );

    }


    return tally;

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
       Bila pemindaian TIDAK selesai (bukan karena ukuran berkas,
       tetapi karena browser gagal membaca), hasil "tidak ditemukan"
       tidak boleh tampil seolah seluruh berkas bersih.
    */
    const decorateResult =
        result => {

            const base =
                inspection.coverage
                    ? {
                        ...result,
                        coverage:
                            inspection.coverage,
                        fileSize:
                            inspection.fileSize,
                        scannedBytes:
                            inspection.scannedBytes
                    }
                    : result;


            if (
                !inspection.partial
            ) {

                return base;

            }


            return {
                ...base,
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
                inspectionLimitBytes:
                    MAX_INSPECT_BYTES
            };

        };


    const format =
        detectFormat(
            bytes,
            file
        );


    /*
       Berkas besar: periksa SELURUH berkas lewat streaming.

       Tidak ada lagi "hanya kepala dan ekor": setiap kotak
       metadata dibaca sampai habis, hanya `mdat` (isi video)
       yang dilewati.
    */

    let stream =
        null;


    if (
        inspection.stream
    ) {

        stream =
            await scanWholeFile(
                file,
                isIsoBmff(
                    bytes
                )
            );


        inspection.scannedBytes =
            Math.max(
                inspection.scannedBytes,
                Math.max(
                    0,
                    (inspection.fileSize || 0) -
                        (stream.mediaSkippedBytes || 0)
                )
            );


        inspection.partial =
            !stream.complete;


        inspection.coverage = {
            mode:
                "stream",
            fileSize:
                inspection.fileSize,
            scannedBytes:
                inspection.scannedBytes,
            mediaSkippedBytes:
                stream.mediaSkippedBytes,
            boxes:
                stream.boxes,
            complete:
                stream.complete
        };

    }


    /*
       Menggabungkan hasil pemindaian streaming dengan hasil
       pemeriksaan struktur dari kepala berkas.
    */

    const mergeStream =
        current => {

            if (
                !stream ||
                stream.labels.size === 0
            ) {

                return current;

            }


            const labels =
                [
                    ...stream.labels
                ];


            const findings = [
                ...(
                    current.findings ||
                    []
                )
            ];


            const addFinding =
                text => {

                    if (
                        !findings.includes(
                            text
                        )
                    ) {

                        findings.push(
                            text
                        );

                    }

                };


            if (
                labels.includes(
                    "c2pa"
                )
            ) {

                addFinding(
                    "c2pa label"
                );

            }


            if (
                labels.includes(
                    "c2pa-uuid"
                )
            ) {

                addFinding(
                    "C2PA Manifest Store UUID"
                );

            }


            if (
                labels.includes(
                    "jumbf"
                )
            ) {

                addFinding(
                    "JUMBF signature"
                );

            }


            if (
                labels.includes(
                    "content credentials"
                )
            ) {

                addFinding(
                    "Content Credentials"
                );

            }


            const detectedFromStream =
                labels.includes(
                    "c2pa"
                ) ||
                labels.includes(
                    "c2pa-uuid"
                ) ||
                labels.includes(
                    "jumbf"
                ) ||
                labels.includes(
                    "content credentials"
                );


            return {
                ...current,
                detected:
                    Boolean(
                        current.detected
                    ) ||
                    detectedFromStream,
                findings,
                ai: {
                    aiDetected:
                        Boolean(
                            current.ai
                                ?.aiDetected
                        ) ||
                        stream.ai.aiDetected,
                    digitalSourceType:
                        current.ai
                            ?.digitalSourceType ||
                        stream.ai.digitalSourceType,
                    softwareAgent:
                        current.ai
                            ?.softwareAgent ||
                        stream.ai.softwareAgent,
                    aiDisclosure:
                        current.ai
                            ?.aiDisclosure ||
                        stream.ai.aiDisclosure
                }
            };

        };


    if (
        format ===
        "unknown"
    ) {

        return decorateResult(
            createResult(
            format,
            mergeStream(
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
            mergeStream(
                details
            )
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
