/* =========================================================
   GEN-Z.AI
   AI METADATA CLEANER
   ---------------------------------------------------------
   File:
   metadata-cleaner/assets/js/metadata-iso-bmff.js

   Fungsi:
   - Menghapus kotak metadata C2PA / JUMBF / XMP dari MP4 & MOV
   - Tidak mengubah ukuran berkas
   - Tidak menggeser satu byte pun

   KENAPA TIDAK DIHAPUS SAJA (dipotong)?
   ---------------------------------------------------------
   MP4 menyimpan posisi data video (kotak `stco` / `co64`) sebagai
   offset ABSOLUT terhadap awal berkas. Kalau sebuah kotak di depan
   `mdat` dipotong, seluruh offset video bergeser dan video menjadi
   rusak.

   Karena itu setiap kotak metadata hanya DIUBAH MENJADI `free`
   dengan ukuran yang sama persis, lalu isinya dinolkan. Parser
   MP4 wajib melewati kotak `free`, sehingga struktur berkas dan
   semua offset tetap valid — video tidak perlu di-encode ulang.

   Kotak yang TIDAK PERNAH disentuh:
   - ftyp, moov, trak, mdia, minf, stbl, stsd
   - mdat (isi video/audio)
========================================================= */


/* =========================================================
   CONSTANTS
========================================================= */

/*
   Kotak yang selalu berisi metadata, bukan data media.
*/

const ALWAYS_DROP_TYPES =
    new Set(
        [
            "udta",
            "meta",
            "jumb",
            "jumd",
            "c2pa",
            "XMP_",
            "xml "
        ]
    );


/*
   Kotak yang dibuang HANYA bila isinya benar-benar
   memuat tanda provenance. `uuid` juga dipakai vendor untuk
   hal lain (mis. enkripsi PIFF), jadi tidak boleh dibuang
   membabi buta.
*/

const CONDITIONAL_DROP_TYPES =
    new Set(
        [
            "uuid",
            "free",
            "skip",
            "wide"
        ]
    );


/*
   Kotak yang boleh ditelusuri lebih dalam.
*/

const CONTAINER_TYPES =
    new Set(
        [
            "moov",
            "trak",
            "mdia",
            "minf",
            "stbl",
            "edts",
            "dinf",
            "mvex",
            "moof",
            "traf",
            "mfra",
            "udta",
            "meta",
            "ilst"
        ]
    );


/*
   `meta` adalah FullBox: 4 byte version+flags sebelum anak-anaknya.
*/

const FULL_BOX_CONTAINERS =
    new Set(
        [
            "meta"
        ]
    );


const C2PA_UUID_BYTES =
    [
        0x63,
        0x32,
        0x70,
        0x61,
        0x00,
        0x11,
        0x00,
        0x10,
        0x80,
        0x00,
        0x00,
        0xAA,
        0x00,
        0x38,
        0x9B,
        0x71
    ];


/*
   UUID XMP standar:
   BE 7A CF CB 97 A9 42 E8 9C 71 99 94 91 E3 AF AC
*/

const XMP_UUID_BYTES =
    [
        0xBE,
        0x7A,
        0xCF,
        0xCB,
        0x97,
        0xA9,
        0x42,
        0xE8,
        0x9C,
        0x71,
        0x99,
        0x94,
        0x91,
        0xE3,
        0xAF,
        0xAC
    ];


const PROVENANCE_LABELS =
    [
        "c2pa",
        "jumbf",
        "content credentials",
        "trainedalgorithmicmedia",
        "softwareagent"
    ];


/* =========================================================
   HELPERS
========================================================= */

function readUint32BE(
    bytes,
    offset
) {

    return (
        (
            (
                bytes[offset] << 24
            ) >>>
            0
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


function readType(
    bytes,
    offset
) {

    let type =
        "";


    for (
        let index = 0;
        index < 4;
        index += 1
    ) {

        type +=
            String.fromCharCode(
                bytes[offset + index]
            );

    }


    return type;

}


function writeType(
    bytes,
    offset,
    type
) {

    for (
        let index = 0;
        index < 4; index += 1
    ) {

        bytes[offset + index] =
            type.charCodeAt(
                index
            );

    }

}


function matchesBytes(
    bytes,
    expected,
    offset
) {

    if (
        offset < 0 ||
        offset + expected.length > bytes.length
    ) {

        return false;

    }


    for (
        let index = 0;
        index < expected.length; index += 1
    ) {

        if (
            bytes[offset + index] !== expected[index]
        ) {

            return false;

        }

    }


    return true;

}


function findBytes(
    bytes,
    expected,
    start,
    end
) {

    const last =
        end - expected.length;


    for (
        let index = start;
        index <= last;
        index += 1
    ) {

        if (
            bytes[index] !== expected[0]
        ) {

            continue;

        }


        if (
            matchesBytes(
                bytes,
                expected,
                index
            )
        ) {

            return index;

        }

    }


    return -1;

}


function containsAsciiLabel(
    bytes,
    start,
    end
) {

    /*
       Batas pemindaian per kotak.

       Kotak `free` bisa berukuran sangat besar; memeriksa
       seluruh isinya hanya membuang waktu. Label provenance
       selalu berada di awal kotak metadata.
    */

    const limit =
        Math.min(
            end,
            start +
                2 *
                1024 *
                1024
        );


    const step =
        8192;


    let tail =
        "";


    for (
        let offset = start;
        offset < limit;
        offset += step
    ) {

        const chunkEnd =
            Math.min(
                offset + step,
                limit
            );


        let text =
            "";


        for (
            let index = offset;
            index < chunkEnd; index += 1
        ) {

            text +=
                String.fromCharCode(
                    bytes[index]
                );

        }


        const lower =
            (
                tail +
                text
            ).toLowerCase();


        for (
            let index = 0;
            index < PROVENANCE_LABELS.length; index += 1
        ) {

            if (
                lower.includes(
                    PROVENANCE_LABELS[index]
                )
            ) {

                return true;

            }

        }


        tail =
            text
                .slice(
                    -64
                )
                .toLowerCase();

    }


    return false;

}


function zeroRange(
    bytes,
    start,
    end
) {

    for (
        let index = start;
        index < end; index += 1
    ) {

        bytes[index] =
            0;

    }

}


/* =========================================================
   BOX WALKER
========================================================= */

/**
 * Menelusuri kotak ISO BMFF.
 *
 * Setiap kotak metadata diubah menjadi `free` dengan ukuran
 * identik (byte offset tidak berubah) dan isinya dinolkan.
 *
 * @returns {{ removed: string[] }} daftar kotak yang dihapus
 */
function scrubBoxes(
    bytes,
    start,
    end,
    removed,
    depth
) {

    let offset =
        start;


    while (
        offset + 8 <= end
    ) {

        let size =
            readUint32BE(
                bytes,
                offset
            );


        const type =
            readType(
                bytes,
                offset + 4
            );


        let headerSize =
            8;


        if (
            size === 1
        ) {

            if (
                offset + 16 > end
            ) {

                break;

            }


            /*
              64-bit size.
            */

            const high =
                readUint32BE(
                    bytes,
                    offset + 8
                );


            const low =
                readUint32BE(
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

            /*
               Kotak terakhir: sampai akhir berkas.
            */

            size =
                end - offset;

        }


        if (
            size < headerSize ||
            offset + size > end
        ) {

            break;

        }


        const payloadStart =
            offset + headerSize;


        const boxEnd =
            offset + size;


        /* ---------------------------------------------
           Kotak metadata: ubah menjadi `free`.
           --------------------------------------------- */

        if (
            ALWAYS_DROP_TYPES.has(
                type
            )
        ) {

            writeType(
                bytes,
                offset + 4,
                "free"
            );

            zeroRange(
                bytes,
                payloadStart,
                boxEnd
            );

            removed.push(
                type
            );

            offset =
                boxEnd;

            continue;

        }


        if (
            CONDITIONAL_DROP_TYPES.has(
                type
            )
        ) {

            const isC2paUuid =
                type === "uuid" &&
                matchesBytes(
                    bytes,
                    C2PA_UUID_BYTES,
                    payloadStart
                );


            const isXmpUuid =
                type === "uuid" &&
                matchesBytes(
                    bytes,
                    XMP_UUID_BYTES,
                    payloadStart
                );


            /*
               `free`/`skip` hanya dipangkas bila benar-benar
               menyimpan label provenance.
            */

            const hasLabel =
                containsAsciiLabel(
                    bytes,
                    payloadStart,
                    boxEnd
                );


            if (
                isC2paUuid ||
                isXmpUuid ||
                hasLabel
            ) {

                writeType(
                    bytes,
                    offset + 4,
                    "free"
                );

                zeroRange(
                    bytes,
                    payloadStart,
                    boxEnd
                );

                removed.push(
                    type
                );

                offset =
                    boxEnd;

                continue;

            }

        }


        /* ---------------------------------------------
           Telusuri container.
           --------------------------------------------- */

        if (
            CONTAINER_TYPES.has(
                type
            ) &&
            depth < 8
        ) {

            const childStart =
                FULL_BOX_CONTAINERS.has(
                    type
                )
                    ? payloadStart + 4
                    : payloadStart;


            if (
                childStart < boxEnd
            ) {

                scrubBoxes(
                    bytes,
                    childStart,
                    boxEnd,
                    removed,
                    depth + 1
                );

            }

        }


        offset =
            boxEnd;

    }


    return {
        removed
    };

}


/* =========================================================
   PUBLIC API
========================================================= */

/**
 * Memeriksa apakah buffer tampak seperti ISO BMFF (MP4 / MOV / HEIC).
 */
export function isIsoBmffBuffer(
    bytes
) {

    if (
        !bytes ||
        bytes.length < 12
    ) {

        return false;

    }


    const type =
        readType(
            bytes,
            4
        );


    return (
        type === "ftyp" ||
        type === "moov" ||
        type === "mdat" ||
        type === "free" ||
        type === "skip" ||
        type === "wide"
    );

}


/**
 * Menghapus metadata C2PA / JUMBF / XMP dari MP4 atau MOV
 * tanpa mengubah ukuran berkas dan tanpa encode ulang.
 *
 * @param {Uint8Array} input
 * @returns {{ bytes: Uint8Array, removed: string[], changed: boolean }}
 */
export function stripIsoBmffMetadata(
    input
) {

    if (
        !input ||
        !input.length
    ) {

        return {
            bytes:
                input,
            removed: [],
            changed:
                false
        };

    }


    if (
        !isIsoBmffBuffer(
            input
        )
    ) {

        return {
            bytes:
                input,
            removed: [],
            changed:
                false
        };

    }


    /*
       Selalu bekerja pada salinan.

       Buffer FFmpeg bisa saja merupakan view dari memori
       bersama; mengubahnya langsung berisiko merusak berkas
       yang masih dipakai proses lain.
    */

    const bytes =
        new Uint8Array(
            input.length
        );


    bytes.set(
        input
    );


    const removed = [];


    scrubBoxes(
        bytes,
        0,
        bytes.length,
        removed,
        0
    );


    return {

        bytes,

        removed,

        changed:
            removed.length > 0

    };

}
