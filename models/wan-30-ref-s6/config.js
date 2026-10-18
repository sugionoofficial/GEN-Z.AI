const config = {
    id: "wan-30-ref-s6",
    motiongenModelId: "wan-30-ref-s6",
    name: "Wan 3.0 Reference Video (15s)",
    providerId: "motiongen",
    providerName: "Motiongen-AI",
    type: "image-to-video",
    adminEditor: {
        hideParameterSummary: true
    },
    api: {
        createTask: "/api/v1/generate",
        queryTask: "/api/v1/jobs/{job_id}"
    }
};

export default config;
