/**
 * Wind apply — the pure transform entry points shared by both the Cordis
 * wiring (index.ts) and the offline node:test suite (tests/). Keeping these
 * free of cordis/host services makes the lead's acceptance cases genuinely
 * testable in plain Node.
 *
 * Two entry points:
 *   - transformAssembly: adds wind sections (persona/stage/decl) to a
 *     system-prompt assembly when the model gate passes; returns the exact
 *     same assembly object when it does not (zero-touch contract).
 *   - maybeGuided: appends the once-per-session near-field guide to the
 *     pre-step decision. Same-request guidance — zero extra API calls,
 *     mirroring the official installModelSelection notice pattern.
 */
import { randomUUID } from 'node:crypto'
import { buildGuide, bandOf, classifyTask, personaForBand, applyPersona, windExtraSections, STAGES } from './wind-core.js'
import { decideWind } from './wind-gate.js'
import { WindRuntime } from './wind-state.js'
import type { WindResolvedConfig, PromptAssembly, PreStepDecision, InjectedMessage, PromptSection } from './types.js'

export interface AssemblyMeta {
  sid: string
  modelId?: string
  presetId?: string
  presentation?: string
}

export interface GuideMeta extends AssemblyMeta {
  step: number
  hasUserMessage: boolean
  /** Task mode captured at inbox/claimed; falls back to weak when unknown. */
  mode?: number | 'weak'
}

export interface TransformResult {
  assembled: PromptAssembly
  decision: ReturnType<typeof decideWind>
}

/** Classify the first non-empty user text of a session into mode/band. */
export function recordUserMessage(runtime: WindRuntime, sid: string, text: string): void {
  if (!text || !text.trim()) return
  const st = runtime.ensure(sid)
  if (st.firstText === undefined) st.firstText = text.trim()
  if (st.mode === undefined) {
    st.mode = classifyTask(text)
    st.band = bandOf(st.mode)
  }
}

/**
 * Add wind sections to an assembly when the model gate engages.
 * Inactive input is returned untouched (same reference).
 */
export function transformAssembly(
  assembled: PromptAssembly,
  meta: AssemblyMeta,
  config: WindResolvedConfig,
  runtime: WindRuntime,
): TransformResult {
  const decision = decideWind(meta, config)
  if (!decision.active) {
    if (decision.skipReason !== undefined) runtime.noteSkip(meta.sid, decision.skipReason, meta.presetId)
    return { assembled, decision }
  }
  if (!runtime.enabled(meta.sid)) {
    runtime.noteSkip(meta.sid, 'session')
    return { assembled, decision: { ...decision, active: false, skipReason: 'session' } }
  }
  const st = runtime.ensure(meta.sid)
  st.injectedAssemblies += 1
  st.engaged = true
  st.lastSkip = undefined
  if (meta.modelId !== undefined) st.model = meta.modelId
  if (st.firstAssembledModel === undefined) st.firstAssembledModel = meta.modelId
  st.restrictRequested = decision.restrict
  const personaText = personaForBand(st.band, meta.modelId)
  const sections: PromptSection[] = [
    ...applyPersona(assembled.sections ?? [], personaText),
    ...windExtraSections(st.stage, st.band, meta.modelId, !decision.restrict || st.stage >= STAGES.length - 1),
  ]
  return { assembled: { ...assembled, sections }, decision }
}

/**
 * Append the near-field guide once per session on the first pre-step.
 * Inactive or already-guided calls return the decision unchanged.
 */
export function maybeGuided(
  decision: PreStepDecision,
  meta: GuideMeta,
  config: WindResolvedConfig,
  runtime: WindRuntime,
): PreStepDecision {
  if (decision.kind !== 'enter') return decision
  if (!config.guideEnabled) return decision
  const d = decideWind(meta, config)
  if (!d.active) return decision
  if (!runtime.enabled(meta.sid)) return decision
  const st = runtime.ensure(meta.sid)
  if (st.guided) return decision
  if (meta.step !== 1 || !meta.hasUserMessage) return decision
  if (!Array.isArray(decision.messages) || decision.messages.length === 0) return decision
  st.guided = true
  return { ...decision, messages: [...decision.messages, guideMessage(meta.mode ?? st.mode, meta.modelId)] }
}

/** The same-request guidance message appended to a pre-step decision. */
export function guideMessage(mode: number | 'weak' | undefined, modelId: string | undefined): InjectedMessage {
  return {
    // Every identified message needs a stable id; the host logs decision.messages
    // verbatim as user/message and reload validates it (assertMessageEventShape).
    id: randomUUID(),
    role: 'user',
    content: [{ type: 'text', text: buildGuide(bandOf(mode), modelId) }],
    // V4 admission (DSH ≥0.1.7) rejects the retired `{kind:'plugin', plugin}`
    // wrapper; `plugin:<name>` is the producer-owned kind.
    source: { kind: 'plugin:dsh-wind-integration' },
  }
}
