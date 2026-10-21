import { decideWind } from './wind-gate.js';
import { WindRuntime } from './wind-state.js';
import type { WindConfig, PromptAssembly, PreStepDecision, InjectedMessage } from './types.js';
export interface AssemblyMeta {
    sid: string;
    modelId?: string;
    presetId?: string;
    presentation?: string;
}
export interface GuideMeta extends AssemblyMeta {
    step: number;
    hasUserMessage: boolean;
    /** Task mode captured at inbox/claimed; falls back to weak when unknown. */
    mode?: number | 'weak';
}
export interface TransformResult {
    assembled: PromptAssembly;
    decision: ReturnType<typeof decideWind>;
}
/** Classify the first non-empty user text of a session into mode/band. */
export declare function recordUserMessage(runtime: WindRuntime, sid: string, text: string): void;
/**
 * Add wind sections to an assembly when the model gate engages.
 * Inactive input is returned untouched (same reference).
 */
export declare function transformAssembly(assembled: PromptAssembly, meta: AssemblyMeta, config: WindConfig, runtime: WindRuntime): TransformResult;
/**
 * Append the near-field guide once per session on the first pre-step.
 * Inactive or already-guided calls return the decision unchanged.
 */
export declare function maybeGuided(decision: PreStepDecision, meta: GuideMeta, config: WindConfig, runtime: WindRuntime): PreStepDecision;
/** The same-request guidance message appended to a pre-step decision. */
export declare function guideMessage(mode: number | 'weak' | undefined, modelId: string | undefined): InjectedMessage;
