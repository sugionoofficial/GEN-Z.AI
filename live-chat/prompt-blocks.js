export function parseFinalPromptBlocks(content) {
    const definitions = [
        ["VIDEO_PROMPT_FINAL", "Prompt Video Final"],
        ["IMAGE_PROMPT_FINAL", "Prompt Gambar Final"]
    ];
    const prompts = [];
    let displayText = String(content || "");

    for (const [marker, label] of definitions) {
        const expression = new RegExp(
            `<<<${marker}>>>\\s*([\\s\\S]*?)\\s*<<<\\/${marker}>>>`,
            "gi"
        );
        displayText = displayText.replace(expression, (_match, prompt) => {
            const value = String(prompt || "").trim();
            if (value) prompts.push({ label, text: value });
            return "";
        });
    }

    return {
        displayText: displayText.trim(),
        prompts
    };
}
