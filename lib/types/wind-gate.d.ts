/**
 * Wind gating — pure, offline-testable predicates and decision.
 *
 * The model gate is the single source of truth for "ds v4 0731 + any preset
 * gains wind behavior": exact id match first (default `DeepSeek-V4-Flash-0731`),
 * then the lead-specified fuzzy fallback `/v4/i && (含 '0731' 或 /flash/i 且含 '0731')`
 * (the flash disjunct is implied by the '0731' conjunct; kept literal).
 */
import type { WindConfig } from './types.js';
/** Inputs a decision is derived from. */
export interface WindInput {
    modelId?: string;
    presetId?: string;
    presentation?: string;
}
/** Outcome of the model/preset/presentation gate. */
export interface WindDecision {
    /** Wind behavior (persona/guide/stage sections) should engage. */
    active: boolean;
    /** Staged tool restrict should be applied (active && stageRestrict && native presentation). */
    restrict: boolean;
    /** The model id matched a target. */
    modelMatched: boolean;
    /** Why behavior did not engage, when active is false. */
    skipReason?: 'model' | 'preset' | 'session';
}
/** True when the model id matches a configured target (exact or fuzzy v4-0731). */
export declare function matchesTargetModel(modelId: string | undefined, config: WindConfig): boolean;
/** True when the composed preset id is itself wind-native and must not be double-wired. */
export declare function isSkippedPreset(presetId: string | undefined, config: WindConfig): boolean;
/** True when the current presentation mode must keep full tool control (no restrict). */
export declare function preservesTools(presentation: string | undefined, config: WindConfig): boolean;
/** Derive the wind engage/restrict decision for one assembly. */
export declare function decideWind(input: WindInput, config: WindConfig): WindDecision;
