const config = {
    id: "seedance-25-studio-s14",
    motiongenModelId: "seedance-25-studio-s14",
    name: "Seedance 2.5 (30s)",
    providerId: "motiongen",
    providerName: "Motiongen-AI",
    type: "text-to-video",
    adminEditor: {
        resolutionOptions: [
            { value: "480p", label: "480p" },
            { value: "720p", label: "720p" }
        ],
        hideParameterSummary: true,
        hiddenCreditFields: ["credit_1080p"]
    },
    api: {
        createTask: "/api/v1/generate",
        queryTask: "/api/v1/jobs/{job_id}"
    }
};

export default config;