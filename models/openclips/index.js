import { OPENCLIPS_MODEL_SPECS, OPENCLIPS_MODEL_IDS, isOpenClipsModelId } from "./specs.js";
import { createOpenClipsModel } from "./factory.js";

export const openClipsModels = OPENCLIPS_MODEL_SPECS.map(createOpenClipsModel);
export const openClipsModelsById = new Map(openClipsModels.map(model => [model.config.id, model]));

export function getOpenClipsModel(modelId) {
    return openClipsModelsById.get(String(modelId || "").trim()) || null;
}

export { OPENCLIPS_MODEL_SPECS, OPENCLIPS_MODEL_IDS, isOpenClipsModelId };
export default openClipsModels;
