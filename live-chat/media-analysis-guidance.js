export function buildMediaAnalysisGuidance() {
    return {
        role: "system",
        content: [
            "MEDIA VISUAL GUIDANCE:",
            "Describe visual content neutrally, factually, and only from observable evidence. Do not infer that ordinary clothing, swimwear, dance, exercise, body shape, or appearance is sexual or explicit by itself. For benign, non-explicit image or video content, provide the requested visual description or analysis without a generic refusal or moralizing. Do not guess a person's identity, age, intent, or unseen actions; state uncertainty when relevant. Follow applicable safety requirements if the media itself clearly requires a restriction."
        ].join("\n")
    };
}
