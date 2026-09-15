// ========================================
// GEN-Z.AI
// KIE.AI VIDEO GENERATION API
// File: api/generate.js
// ========================================

export default async function handler(req, res) {

    // ========================================
    // METHOD CHECK
    // ========================================

    if (req.method !== "POST") {

        return res.status(405).json({
            success: false,
            error: "Method tidak diizinkan."
        });

    }


    try {

        // ========================================
        // KIE.AI API KEY
        // ========================================

        const KIE_API_KEY =
            process.env.KIE_API_KEY;


        if (!KIE_API_KEY) {

            return res.status(500).json({
                success: false,
                error:
                    "KIE_API_KEY belum dikonfigurasi di Vercel."
            });

        }


        // ========================================
        // REQUEST DATA
        // ========================================

        const body = req.body || {};

        const {
            provider,
            model,
            prompt,
            ratio,
            duration,
            resolution
        } = body;


        // ========================================
        // VALIDATION
        // ========================================

        if (!model) {

            return res.status(400).json({
                success: false,
                error: "Model belum dipilih."
            });

        }


        if (!prompt || !prompt.trim()) {

            return res.status(400).json({
                success: false,
                error: "Prompt belum diisi."
            });

        }


        // ========================================
        // PROVIDER CHECK
        // ========================================

        if (
            provider &&
            provider !== "kie_ai"
        ) {

            return res.status(400).json({
                success: false,
                error:
                    "Provider belum didukung oleh endpoint ini."
            });

        }


        // ========================================
        // KIE.AI REQUEST
        // ========================================
        //
        // Endpoint adapter diletakkan di satu tempat
        // supaya mudah diganti jika Kie.ai mengubah
        // endpoint atau format payload.
        //
        // ========================================

        const KIE_ENDPOINT =
            process.env.KIE_API_ENDPOINT ||
            "https://api.kie.ai/api/v1/jobs/createTask";


        // ========================================
        // PAYLOAD
        // ========================================

        const kiePayload = {

            model: model,

            input: {

                prompt: prompt.trim(),

                aspect_ratio:
                    ratio || "9:16",

                duration:
                    duration || "8",

                resolution:
                    resolution || "720p"

            }

        };


        console.log(
            "GEN-Z.AI → Kie.ai request:",
            JSON.stringify(kiePayload)
        );


        // ========================================
        // SEND TO KIE.AI
        // ========================================

        const kieResponse =
            await fetch(
                KIE_ENDPOINT,
                {

                    method: "POST",

                    headers: {

                        "Content-Type":
                            "application/json",

                        "Authorization":
                            `Bearer ${KIE_API_KEY}`

                    },

                    body:
                        JSON.stringify(kiePayload)

                }
            );


        // ========================================
        // READ RESPONSE
        // ========================================

        const responseText =
            await kieResponse.text();


        let kieData;

        try {

            kieData =
                JSON.parse(responseText);

        } catch {

            kieData = {
                raw: responseText
            };

        }


        console.log(
            "Kie.ai response:",
            JSON.stringify(kieData)
        );


        // ========================================
        // KIE ERROR
        // ========================================

        if (!kieResponse.ok) {

            return res.status(
                kieResponse.status
            ).json({

                success: false,

                error:
                    kieData?.message ||
                    kieData?.error ||
                    "Kie.ai gagal memproses request.",

                provider:
                    "kie_ai",

                providerResponse:
                    kieData

            });

        }


        // ========================================
        // JOB ID
        // ========================================

        const jobId =
            kieData?.data?.taskId ||
            kieData?.data?.task_id ||
            kieData?.taskId ||
            kieData?.task_id ||
            null;


        // ========================================
        // SUCCESS
        // ========================================

        return res.status(200).json({

            success: true,

            provider:
                "kie_ai",

            model:
                model,

            jobId:
                jobId,

            status:
                "processing",

            message:
                "Permintaan generate berhasil dikirim ke Kie.ai.",

            data:
                kieData

        });


    } catch (error) {

        // ========================================
        // SERVER ERROR
        // ========================================

        console.error(
            "GEN-Z.AI Kie.ai Error:",
            error
        );


        return res.status(500).json({

            success: false,

            error:
                "Terjadi kesalahan pada server.",

            detail:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined

        });

    }

}
