/** True when the model id matches a configured target (exact or fuzzy v4-0731). */
export function matchesTargetModel(modelId, config) {
    if (!modelId)
        return false;
    if (config.targetModels.includes(modelId))
        return true;
    if (!config.matchV4Fallback)
        return false;
    if (!/v4/i.test(modelId))
        return false;
    return modelId.includes('0731') || (/flash/i.test(modelId) && modelId.includes('0731'));
}
/** True when the composed preset id is itself wind-native and must not be double-wired. */
export function isSkippedPreset(presetId, config) {
    if (presetId === undefined)
        return false;
    const id = presetId.toLowerCase();
    return config.skipPresets.some((p) => p.toLowerCase() === id);
}
/** True when the current presentation mode must keep full tool control (no restrict). */
export function preservesTools(presentation, config) {
    return config.preservePresentationModes.includes(presentation ?? '');
}
/** Derive the wind engage/restrict decision for one assembly. */
export function decideWind(input, config) {
    const modelMatched = matchesTargetModel(input.modelId, config);
    if (!modelMatched)
        return { active: false, restrict: false, modelMatched: false, skipReason: 'model' };
    if (isSkippedPreset(input.presetId, config)) {
        return { active: false, restrict: false, modelMatched: true, skipReason: 'preset' };
    }
    const restrict = config.stageRestrict && !preservesTools(input.presentation, config);
    return { active: true, restrict, modelMatched: true };
}
//# sourceMappingURL=wind-gate.js.map