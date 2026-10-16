const config = {
    id: "seedance-a2v-studio-s14",
    motiongenModelId: "seedance-a2v-studio-s14",
    name: "Seedance Audio to Video (30s)",
    providerId: "motiongen",
    providerName: "Motiongen-AI",
    type: "image-to-video",
    adminEditor: {
        resolutionOptions: [
            { value: "480p", label: "480p" },
            { value: "720p", label: "720p" },
            { value: "1080p", label: "1080p" }
        ],
        hideParameterSummary: true
    },
    api: {
        createTask: "/api/v1/generate",
        queryTask: "/api/v1/jobs/{job_id}"
    }
};

export default config;
