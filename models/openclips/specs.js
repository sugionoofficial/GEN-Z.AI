/* Initial OpenClips marketplace registry. Fields follow the live OpenAPI
 * discriminated request schemas; additions should be made only after their
 * model contract has been verified. */

function inclusiveDurationOptions(minimum, maximum) {
    return Array.from(
        { length: maximum - minimum + 1 },
        (_, index) => String(minimum + index)
    );
}

export const OPENCLIPS_MODEL_SPECS = Object.freeze([
    {
        id: "openclips-seedance-2.5",
        upstreamModel: "seedance-2.5",
        name: "Seedance 2.5 (OpenClips)",
        logo: "seedance.svg",
        mediaType: "video",
        description: "Seedance 2.5 melalui OpenClips MCP — text/reference to video, 4–30 detik, hingga 1080p, audio native, hingga 30 gambar referensi.",
        ratios: ["9:16", "16:9", "1:1", "4:3", "3:4", "21:9"],
        defaultRatio: "9:16",
        resolutions: ["720p", "480p", "1080p"],
        defaultResolution: "720p",
        durations: inclusiveDurationOptions(4, 30),
        defaultDuration: "5",
        minDuration: 4,
        maxDuration: 30,
        maxReferences: 30,
        defaultGenerateAudio: true,
        imageRoles: ["first-frame", "first-last", "reference"],
        defaultImageRole: "first-frame",
        outputFormats: ["mp4", "mov"],
        defaultOutputFormat: "mp4",
        defaultCredits: { credit_480p: 15, credit_720p: 25, credit_1080p: 45 }
    },
    {
        id: "openclips-seedance-2.0",
        upstreamModel: "seedance-2.0",
        name: "Seedance 2.0 (OpenClips)",
        logo: "seedance.svg",
        mediaType: "video",
        description: "Seedance 2.0 melalui OpenClips MCP — text/reference to video, 4–15 detik, audio native, hingga 30 gambar referensi.",
        ratios: ["9:16", "16:9", "1:1", "4:3", "3:4", "21:9"],
        defaultRatio: "9:16",
        resolutions: ["720p", "480p", "1080p"],
        defaultResolution: "720p",
        durations: inclusiveDurationOptions(4, 15),
        defaultDuration: "5",
        minDuration: 4,
        maxDuration: 15,
        maxReferences: 30,
        defaultGenerateAudio: true,
        imageRoles: ["first-frame", "first-last", "reference"],
        defaultImageRole: "first-frame",
        outputFormats: [],
        defaultCredits: { credit_480p: 12, credit_720p: 20, credit_1080p: 40 }
    },
    {
        id: "openclips-seedream-5.0-pro",
        upstreamModel: "seedream-5.0-pro",
        name: "Seedream 5.0 Pro (OpenClips)",
        logo: "seedance.svg",
        mediaType: "image",
        description: "Seedream 5.0 Pro melalui OpenClips MCP — text/image to image, hingga 10 referensi, ukuran 1K/1.5K/2K, PNG atau JPEG.",
        ratios: ["1:1", "9:16", "16:9"],
        defaultRatio: "1:1",
        maxReferences: 10,
        sizes: ["1K", "1.5K", "2K"],
        defaultSize: "1K",
        outputFormats: ["png", "jpeg"],
        defaultOutputFormat: "png",
        defaultCredits: { credit_480p: 500, credit_720p: 0, credit_1080p: 0 }
    },
    {
        id: "openclips-seedream-5.0-flash",
        upstreamModel: "seedream-5.0-flash",
        name: "Seedream 5.0 Flash (OpenClips)",
        logo: "seedance.svg",
        mediaType: "image",
        description: "Seedream 5.0 Flash melalui OpenClips MCP — text/image to image cepat, hingga 10 referensi, ukuran 1K/1.5K/2K, PNG atau JPEG.",
        ratios: ["1:1", "9:16", "16:9"],
        defaultRatio: "1:1",
        maxReferences: 10,
        sizes: ["1K", "1.5K", "2K"],
        defaultSize: "2K",
        outputFormats: ["png", "jpeg"],
        defaultOutputFormat: "png",
        defaultCredits: { credit_480p: 500, credit_720p: 0, credit_1080p: 0 }
    }
]);

export const OPENCLIPS_MODEL_IDS = Object.freeze(OPENCLIPS_MODEL_SPECS.map(spec => spec.id));

export function isOpenClipsModelId(modelId) {
    return OPENCLIPS_MODEL_IDS.includes(String(modelId || "").trim());
}
