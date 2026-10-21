/**
 * Wind gating — pure, offline-testable predicates and decision.
 *
 * The model gate is the single source of truth for "ds v4 0731 + any preset
 * gains wind behavior": exact id match first (default `DeepSeek-V4-Flash-0731`),
 * then the lead-specified fuzzy fallback `/v4/i && (含 '0731' 或 /flash/i 且含 '0731')`
 * (the flash disjunct is implied by the '0731' conjunct; kept literal).
 */
import type { WindConfig } from './types.js'

/** Inputs a decision is derived from. */
export interface WindInput {
  modelId?: string
  presetId?: string
  presentation?: string
}

/** Outcome of the model/preset/presentation gate. */
export interface WindDecision {
  /** Wind behavior (persona/guide/stage sections) should engage. */
  active: boolean
  /** Staged tool restrict should be applied (active && stageRestrict && native presentation). */
  restrict: boolean
  /** The model id matched a target. */
  modelMatched: boolean
  /** Why behavior did not engage, when active is false. */
  skipReason?: 'model' | 'preset' | 'session'
}

/** True when the model id matches a configured target (exact or fuzzy v4-0731). */
export function matchesTargetModel(modelId: string | undefined, config: WindConfig): boolean {
  if (!modelId) return false
  if (config.targetModels.includes(modelId)) return true
  if (!config.matchV4Fallback) return false
  if (!/v4/i.test(modelId)) return false
  return modelId.includes('0731') || (/flash/i.test(modelId) && modelId.includes('0731'))
}

/** True when the composed preset id is itself wind-native and must not be double-wired. */
export function isSkippedPreset(presetId: string | undefined, config: WindConfig): boolean {
  if (presetId === undefined) return false
  const id = presetId.toLowerCase()
  return config.skipPresets.some((p) => p.toLowerCase() === id)
}

/** True when the current presentation mode must keep full tool control (no restrict). */
export function preservesTools(presentation: string | undefined, config: WindConfig): boolean {
  return config.preservePresentationModes.includes(presentation ?? '')
}

/** Derive the wind engage/restrict decision for one assembly. */
export function decideWind(input: WindInput, config: WindConfig): WindDecision {
  const modelMatched = matchesTargetModel(input.modelId, config)
  if (!modelMatched) return { active: false, restrict: false, modelMatched: false, skipReason: 'model' }
  if (isSkippedPreset(input.presetId, config)) {
    return { active: false, restrict: false, modelMatched: true, skipReason: 'preset' }
  }
  const restrict = config.stageRestrict && !preservesTools(input.presentation, config)
  return { active: true, restrict, modelMatched: true }
}
