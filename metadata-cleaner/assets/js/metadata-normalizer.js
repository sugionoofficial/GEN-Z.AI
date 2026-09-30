/* =========================================================
   GEN-Z.AI
   AI METADATA CLEANER
   ---------------------------------------------------------
   File:
   metadata-cleaner/assets/js/metadata-normalizer.js

   Fungsi:
   - Normalize metadata
   - Normalize metadata values
   - Flatten nested metadata objects
========================================================= */


/* =========================================================
   NORMALIZE METADATA
========================================================= */

export function normalizeMetadata(
    metadata
) {

    const output = [];

    const seen =
        new Set();


    for (
        const item of metadata || []
    ) {

        if (
            !item ||
            item.value === undefined ||
            item.value === null
        ) {

            continue;
        }


        const field =
            String(
                item.field || "Unknown"
            );


        const value =
            normalizeValue(
                item.value
            );


        if (
            !value
        ) {

            continue;
        }


        const key =
            `${field}::${value}`;


        if (
            seen.has(key)
        ) {

            continue;
        }


        seen.add(
            key
        );


        output.push({

            field,

            value,

            source:
                item.source ||
                "Metadata"
        });
    }


    return output;
}


/* =========================================================
   NORMALIZE VALUE
========================================================= */

export function normalizeValue(
    value
) {

    if (
        value instanceof Date
    ) {

        return value.toISOString();
    }


    if (
        typeof value === "string"
    ) {

        return value;
    }


    if (
        typeof value === "number" ||
        typeof value === "boolean"
    ) {

        return String(
            value
        );
    }


    if (
        Array.isArray(value)
    ) {

        return value
            .map(
                normalizeValue
            )
            .join(", ");
    }


    if (
        typeof value === "object"
    ) {

        try {

            return JSON.stringify(
                value
            );

        } catch {

            return String(
                value
            );
        }
    }


    return String(
        value
    );
}


/* =========================================================
   OBJECT METADATA APPEND
========================================================= */

export function appendObjectMetadata(
    target,
    object,
    source
) {

    if (
        !object ||
        typeof object !== "object"
    ) {

        return;
    }


    const flatten = (
        value,
        prefix
    ) => {

        if (
            value === null ||
            value === undefined
        ) {

            return;
        }


        if (
            Array.isArray(value)
        ) {

            target.push({

                field:
                    prefix,

                value:
                    value
                        .map(
                            normalizeValue
                        )
                        .join(", "),

                source
            });

            return;
        }


        if (
            value instanceof Date
        ) {

            target.push({

                field:
                    prefix,

                value:
                    value.toISOString(),

                source
            });

            return;
        }


        if (
            typeof value === "object"
        ) {

            for (
                const [
                    key,
                    child
                ] of Object.entries(
                    value
                )
            ) {

                flatten(
                    child,
                    prefix
                        ? `${prefix}.${key}`
                        : key
                );
            }

            return;
        }


        target.push({

            field:
                prefix,

            value:
                normalizeValue(
                    value
                ),

            source
        });
    };


    for (
        const [
            key,
            value
        ] of Object.entries(
            object
        )
    ) {

        flatten(
            value,
            key
        );
    }
}
