/* =========================================================
   GEN-Z.AI
   AI METADATA CLEANER
   ---------------------------------------------------------
   File:
   metadata-cleaner/assets/js/metadata-cleaner-image.js

   Fungsi:
   - Clean image metadata locally
   - Re-render image through Canvas
   - Remove embedded JPEG/PNG/WebP metadata chunks
   - Remove ICC color profile
   - Create a new clean image Blob
   - Original image remains untouched

   CATATAN:
   - Canvas sendiri dapat menambahkan ICC/sRGB profile.
   - Karena itu hasil Canvas TIDAK langsung dikembalikan.
   - JPEG/PNG/WebP diproses lagi secara binary.
========================================================= */


/* =========================================================
   CLEAN IMAGE
========================================================= */

export async function cleanImage(
    file
) {

    if (
        !file
    ) {

        throw new Error(
            "File gambar tidak tersedia."
        );
    }


    const image =
        await loadImage(
            file
        );


    const canvas =
        document.createElement(
            "canvas"
        );


    canvas.width =
        image.naturalWidth;


    canvas.height =
        image.naturalHeight;


    const context =
        canvas.getContext(
            "2d",
            {
                alpha: true
            }
        );


    if (
        !context
    ) {

        throw new Error(
            "Canvas browser tidak tersedia."
        );
    }


    context.drawImage(
        image,
        0,
        0
    );


    const outputType =
        getImageOutputType(
            file
        );


    const canvasBlob =
        await canvasToBlob(
            canvas,
            outputType,
            outputType === "image/jpeg"
                ? 0.94
                : undefined
        );


    const cleanedBlob =
        await stripImageMetadata(
            canvasBlob,
            outputType
        );


    return {

        blob:
            cleanedBlob,

        type:
            outputType

    };
}


/* =========================================================
   IMAGE LOADER
========================================================= */

function loadImage(
    file
) {

    return new Promise(
        (
            resolve,
            reject
        ) => {

            const image =
                new Image();


            const url =
                URL.createObjectURL(
                    file
                );


            image.onload = () => {

                URL.revokeObjectURL(
                    url
                );


                resolve(
                    image
                );
            };


            image.onerror = () => {

                URL.revokeObjectURL(
                    url
                );


                reject(
                    new Error(
                        "Gambar tidak dapat dibaca."
                    )
                );
            };


            image.src =
                url;
        }
    );
}


/* =========================================================
   IMAGE OUTPUT TYPE
========================================================= */

function getImageOutputType(
    file
) {

    /*
     * PNG tetap PNG.
     */

    if (
        file.type === "image/png"
    ) {

        return "image/png";
    }


    /*
     * WebP tetap WebP.
     */

    if (
        file.type === "image/webp"
    ) {

        return "image/webp";
    }


    /*
     * Format lain dirender menjadi JPEG.
     */

    return "image/jpeg";
}


/* =========================================================
   CANVAS TO BLOB
========================================================= */

function canvasToBlob(
    canvas,
    type,
    quality
) {

    return new Promise(
        (
            resolve,
            reject
        ) => {

            canvas.toBlob(
                blob => {

                    if (
                        !blob
                    ) {

                        reject(
                            new Error(
                                "Browser gagal membuat file hasil."
                            )
                        );


                        return;
                    }


                    resolve(
                        blob
                    );
                },
                type,
                quality
            );
        }
    );
}


/* =========================================================
   STRIP IMAGE METADATA
========================================================= */

export async function stripImageMetadata(
    blob,
    type = blob?.type
) {
    if (!blob || typeof blob.arrayBuffer !== "function") {
        throw new Error("File gambar tidak tersedia untuk pembersihan metadata.");
    }

    const buffer =
        await blob.arrayBuffer();

    if (
        type === "image/jpeg"
    ) {
        const bytes = new Uint8Array(buffer);
        if (bytes.length < 4 || bytes[0] !== 0xFF || bytes[1] !== 0xD8) {
            throw new Error("Struktur JPEG tidak valid; metadata tidak dapat dibersihkan.");
        }
        return stripJPEGMetadata(
            buffer
        );
    }


    if (
        type === "image/png"
    ) {
        const bytes = new Uint8Array(buffer);
        if (bytes.length < 8 || !matchesBytes(bytes, [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], 0)) {
            throw new Error("Struktur PNG tidak valid; metadata tidak dapat dibersihkan.");
        }
        return stripPNGMetadata(
            buffer
        );
    }


    if (
        type === "image/webp"
    ) {
        const bytes = new Uint8Array(buffer);
        if (bytes.length < 12 || readASCII(bytes, 0, 4) !== "RIFF" || readASCII(bytes, 8, 4) !== "WEBP") {
            throw new Error("Struktur WebP tidak valid; metadata tidak dapat dibersihkan.");
        }
        return stripWebPMetadata(
            buffer
        );
    }

    throw new Error("Format gambar tidak didukung untuk pembersihan metadata.");
}


/* =========================================================
   JPEG METADATA CLEANER
========================================================= */

/*
 * JPEG structure:
 *
 * SOI
 * APP0
 * APP1
 * APP2
 * APP13
 * ...
 * DQT
 * SOF
 * DHT
 * SOS
 * image data
 * EOI
 *
 * Metadata yang kita hapus:
 *
 * APP0  = JFIF application block
 * APP1  = EXIF / XMP
 * APP2  = ICC profile
 * APP11 = C2PA / JUMBF
 * APP13 = IPTC / Photoshop
 * COM   = JPEG comment
 *
 * Marker struktur JPEG seperti:
 *
 * DQT
 * DHT
 * SOF
 * SOS
 *
 * HARUS dipertahankan.
 */

function stripJPEGMetadata(
    buffer
) {

    const input =
        new Uint8Array(
            buffer
        );


    if (
        input.length < 4 ||
        input[0] !== 0xFF ||
        input[1] !== 0xD8
    ) {

        return new Blob(
            [
                buffer
            ],
            {
                type:
                    "image/jpeg"
            }
        );
    }


    const output = [];


    /*
     * JPEG Start Of Image.
     */

    output.push(
        0xFF,
        0xD8
    );


    let offset =
        2;


    while (
        offset <
        input.length
    ) {

        /*
         * JPEG image data begins after SOS.
         *
         * From this point onward, marker-like
         * bytes can occur naturally inside compressed
         * image data. Therefore we must copy the
         * remainder without interpreting it.
         */

        if (
            input[offset] === 0xFF &&
            input[offset + 1] === 0xDA
        ) {

            appendBytes(
                output,
                input.subarray(
                    offset
                )
            );

            break;
        }


        /*
         * Invalid/incomplete marker.
         */

        if (
            input[offset] !== 0xFF ||
            offset + 1 >= input.length
        ) {

            appendBytes(
                output,
                input.subarray(
                    offset
                )
            );

            break;
        }


        /*
         * JPEG fill bytes.
         */

        let markerOffset =
            offset;


        while (
            markerOffset < input.length &&
            input[markerOffset] === 0xFF
        ) {

            markerOffset++;
        }


        if (
            markerOffset >= input.length
        ) {

            break;
        }


        const marker =
            input[markerOffset];


        /*
         * Standalone markers.
         */

        if (
            marker === 0xD8 ||
            marker === 0xD9 ||
            (
                marker >= 0xD0 &&
                marker <= 0xD7
            )
        ) {

            /*
             * Preserve non-metadata standalone markers.
             */

            appendBytes(
                output,
                input.subarray(
                    offset,
                    markerOffset + 1
                )
            );


            offset =
                markerOffset + 1;


            continue;
        }


        /*
         * Every normal JPEG segment has:
         *
         * FF
         * marker
         * length_hi
         * length_lo
         * payload
         */

        if (
            markerOffset + 2 >=
            input.length
        ) {

            break;
        }


        const segmentLength =
            (
                input[markerOffset + 1] << 8
            ) |
            input[markerOffset + 2];


        if (
            segmentLength < 2
        ) {

            break;
        }


        const segmentStart =
            offset;


        const segmentEnd =
            markerOffset +
            1 +
            segmentLength;


        if (
            segmentEnd >
            input.length
        ) {

            break;
        }


        /*
         * Metadata markers.
         *
         * APP0  FFE0
         * APP1  FFE1
         * APP2  FFE2
         * APP11 FFEB
         * APP13 FFED
         * COM   FFFE
         */

        /*
         * Semua APPn dianggap metadata.
         *
         * APP11 adalah lokasi resmi C2PA/JUMBF, tetapi sebagian
         * aplikasi menaruh manifest di APP3–APP10 atau APP15.
         * Karena itu seluruh APPn dibuang.
         *
         * PENGECUALIAN: APP14 (0xEE).
         * APP14 menyimpan penanda Adobe yang menentukan transformasi
         * warna JPEG CMYK. Membuangnya bisa mengubah warna gambar,
         * dan C2PA tidak pernah memakai APP14.
         */

        const removeSegment =
            (
                marker >= 0xE0 &&
                marker <= 0xEF &&
                marker !== 0xEE
            ) ||
            marker === 0xFE;


        if (
            !removeSegment
        ) {

            appendBytes(
                output,
                input.subarray(
                    segmentStart,
                    segmentEnd
                )
            );
        }


        offset =
            segmentEnd;
    }


    return new Blob(
        [
            new Uint8Array(
                output
            )
        ],
        {
            type:
                "image/jpeg"
        }
    );
}


/* =========================================================
   PNG METADATA CLEANER
========================================================= */

/*
 * PNG signature:
 *
 * 89 50 4E 47 0D 0A 1A 0A
 *
 * Metadata chunks yang dibuang:
 *
 * iCCP = ICC profile
 * tEXt = text metadata
 * zTXt = compressed text metadata
 * iTXt = international text metadata
 * eXIf = EXIF
 * caBX = C2PA / JUMBF
 * pHYs = physical pixel dimensions
 * cHRM = chromaticity
 * gAMA = gamma
 * sRGB = rendering intent
 * tIME = modification time
 *
 * Struktur utama:
 *
 * IHDR
 * PLTE
 * IDAT
 * IEND
 *
 * tetap dipertahankan.
 */

function stripPNGMetadata(
    buffer
) {

    const input =
        new Uint8Array(
            buffer
        );


    const signature =
        [
            0x89,
            0x50,
            0x4E,
            0x47,
            0x0D,
            0x0A,
            0x1A,
            0x0A
        ];


    if (
        input.length < 8 ||
        !matchesBytes(
            input,
            signature,
            0
        )
    ) {

        return new Blob(
            [
                buffer
            ],
            {
                type:
                    "image/png"
            }
        );
    }


    const output = [];


    appendBytes(
        output,
        input.subarray(
            0,
            8
        )
    );


    let offset =
        8;


    while (
        offset + 12 <=
        input.length
    ) {

        const chunkLength =
            readUint32BE(
                input,
                offset
            );


        const chunkType =
            readASCII(
                input,
                offset + 4,
                4
            );


        const chunkEnd =
            offset +
            12 +
            chunkLength;


        if (
            chunkEnd >
            input.length
        ) {

            break;
        }


        /*
         * Chunk ancillary (huruf pertama kecil) boleh dibuang
         * tanpa merusak gambar. Chunk critical (IHDR, PLTE, IDAT,
         * IEND) wajib dipertahankan.
         */
        const isAncillary =
            chunkType.length === 4 &&
            chunkType.charCodeAt(0) >= 0x61 &&
            chunkType.charCodeAt(0) <= 0x7A &&
            chunkType !== "tRNS";

        const carriesProvenance =
            isAncillary &&
            containsProvenanceLabel(
                input,
                offset + 8,
                offset + 8 + chunkLength
            );

        const removeChunk =
            carriesProvenance ||
            chunkType === "iCCP" ||
            chunkType === "tEXt" ||
            chunkType === "zTXt" ||
            chunkType === "iTXt" ||
            chunkType === "eXIf" ||
            chunkType === "caBX" ||
            chunkType === "pHYs" ||
            chunkType === "cHRM" ||
            chunkType === "gAMA" ||
            chunkType === "sRGB" ||
            chunkType === "tIME";


        if (
            !removeChunk
        ) {

            appendBytes(
                output,
                input.subarray(
                    offset,
                    chunkEnd
                )
            );
        }


        offset =
            chunkEnd;


        /*
         * IEND adalah akhir PNG.
         */

        if (
            chunkType === "IEND"
        ) {

            break;
        }
    }


    return new Blob(
        [
            new Uint8Array(
                output
            )
        ],
        {
            type:
                "image/png"
        }
    );
}


/* =========================================================
   WEBP METADATA CLEANER
========================================================= */

/*
 * WebP menggunakan RIFF container.
 *
 * Metadata/provenance chunks yang dibuang:
 *
 * EXIF
 * XMP
 * ICCP
 * C2PA
 *
 * VP8 / VP8L / VP8X tetap dipertahankan.
 */

function stripWebPMetadata(
    buffer
) {

    const input =
        new Uint8Array(
            buffer
        );


    if (
        input.length < 12 ||
        readASCII(
            input,
            0,
            4
        ) !== "RIFF" ||
        readASCII(
            input,
            8,
            4
        ) !== "WEBP"
    ) {

        return new Blob(
            [
                buffer
            ],
            {
                type:
                    "image/webp"
            }
        );
    }


    const output = [];


    /*
     * RIFF header.
     *
     * Size akan dihitung ulang setelah
     * metadata chunk dibuang.
     */

    appendBytes(
        output,
        input.subarray(
            0,
            8
        )
    );


    appendASCII(
        output,
        "WEBP"
    );


    let offset =
        12;


    while (
        offset + 8 <=
        input.length
    ) {

        const chunkType =
            readASCII(
                input,
                offset,
                4
            );


        const chunkSize =
            readUint32LE(
                input,
                offset + 4
            );


        const dataStart =
            offset + 8;


        const paddedSize =
            chunkSize +
            (
                chunkSize % 2
            );


        const chunkEnd =
            dataStart +
            paddedSize;


        if (
            chunkEnd >
            input.length
        ) {

            break;
        }


        const isImageChunk =
            chunkType === "VP8 " ||
            chunkType === "VP8L" ||
            chunkType === "VP8X" ||
            chunkType === "ALPH" ||
            chunkType === "ANIM" ||
            chunkType === "ANMF";

        /*
         * Selain nama chunk baku di atas, chunk non-gambar yang
         * isinya memuat label provenance juga dibuang.
         */
        const carriesProvenance =
            !isImageChunk &&
            containsProvenanceLabel(
                input,
                dataStart,
                dataStart + chunkSize
            );

        const removeChunk =
            carriesProvenance ||
            chunkType === "EXIF" ||
            chunkType === "XMP " ||
            chunkType === "ICCP" ||
            chunkType === "C2PA" ||
            chunkType === "JUMBF";


        if (
            !removeChunk
        ) {

            appendBytes(
                output,
                input.subarray(
                    offset,
                    chunkEnd
                )
            );
        }


        offset =
            chunkEnd;
    }


    /*
     * RIFF size =
     * total file size - 8
     */

    const riffSize =
        output.length -
        8;


    writeUint32LE(
        output,
        4,
        riffSize
    );


    return new Blob(
        [
            new Uint8Array(
                output
            )
        ],
        {
            type:
                "image/webp"
        }
    );
}


/* =========================================================
   PROVENANCE LABEL SCAN
========================================================= */

/*
 * Nama chunk standar tidak selalu dipakai vendor.
 *
 * Sebagian aplikasi menaruh manifest C2PA di chunk yang
 * namanya tidak dikenal (mis. teks bebas atau `zTXt`), jadi
 * selain daftar nama di atas, isi chunk juga diperiksa.
 */

const PROVENANCE_LABELS = [
    "c2pa",
    "jumbf",
    "content credentials",
    "trainedalgorithmicmedia",
    "softwareagent"
];

function containsProvenanceLabel(
    bytes,
    start,
    end
) {

    /* Batas 1 MB: label selalu berada di awal chunk metadata. */
    const limit =
        Math.min(
            end,
            start + 1024 * 1024
        );

    const step = 8192;

    let tail = "";

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

        let text = "";

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
                tail + text
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


/* =========================================================
   BYTE HELPERS
========================================================= */

function appendBytes(
    target,
    bytes
) {

    for (
        let index = 0;
        index < bytes.length;
        index++
    ) {

        target.push(
            bytes[index]
        );
    }
}


/* =========================================================
   ASCII HELPERS
========================================================= */

function appendASCII(
    target,
    text
) {

    for (
        let index = 0;
        index < text.length;
        index++
    ) {

        target.push(
            text.charCodeAt(
                index
            )
        );
    }
}


function readASCII(
    bytes,
    offset,
    length
) {

    let result =
        "";


    for (
        let index = 0;
        index < length;
        index++
    ) {

        result +=
            String.fromCharCode(
                bytes[
                    offset + index
                ]
            );
    }


    return result;
}


/* =========================================================
   BYTE COMPARISON
========================================================= */

function matchesBytes(
    bytes,
    expected,
    offset
) {

    for (
        let index = 0;
        index < expected.length;
        index++
    ) {

        if (
            bytes[
                offset + index
            ] !==
            expected[index]
        ) {

            return false;
        }
    }


    return true;
}


/* =========================================================
   UINT32 BIG ENDIAN
========================================================= */

function readUint32BE(
    bytes,
    offset
) {

    return (
        (
            bytes[offset] << 24
        ) >>> 0
    ) |
    (
        bytes[offset + 1] << 16
    ) |
    (
        bytes[offset + 2] << 8
    ) |
    bytes[offset + 3];
}


/* =========================================================
   UINT32 LITTLE ENDIAN
========================================================= */

function readUint32LE(
    bytes,
    offset
) {

    return (
        bytes[offset]
    ) |
    (
        bytes[offset + 1] << 8
    ) |
    (
        bytes[offset + 2] << 16
    ) |
    (
        bytes[offset + 3] << 24
    );
}


/* =========================================================
   WRITE UINT32 LITTLE ENDIAN
========================================================= */

function writeUint32LE(
    target,
    offset,
    value
) {

    target[offset] =
        value &
        0xFF;


    target[offset + 1] =
        (
            value >> 8
        ) &
        0xFF;


    target[offset + 2] =
        (
            value >> 16
        ) &
        0xFF;


    target[offset + 3] =
        (
            value >> 24
        ) &
        0xFF;
}
