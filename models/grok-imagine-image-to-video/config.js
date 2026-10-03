const config = {
    id: "grok-imagine/image-to-video",

    name: "Grok Imagine Image to Video",

    providerId: "kie",

    providerName: "GEN-Z.AI",

    type: "image-to-video",

    api: {
        createTask: "/api/v1/jobs/createTask",
        queryTask: "/api/v1/jobs/recordInfo"
    }
};

export default config;
