/**
 * Legacy-model continuation compatibility.
 *
 * Newer models put their next tool call in the same assistant message as the
 * progress text. Older models often end the message with "next I will ..." and
 * no tool call; the loop then treats the turn as complete. This module decides
 * whether such a text-only turn looks unfinished and should be steered on.
 *
 * Pure functions only: the caller supplies session events, the routed model id
 * and the resolved configuration.
 */

/** Resolved continuation policy. */
export interface ContinuationPolicy {
  /** Master switch; off by default (opt-in per deployment). */
  enabled: boolean
  /** Model id patterns; '*' matches any run of characters, matching is case-insensitive substring. */
  models: readonly string[]
  /** Hard cap of continuations per turn (prevents loops on chatty models). */
  maxPerTurn: number
  /** User-role message steered when a text-only turn looks unfinished. */
  prompt: string
}

/** Last assistant message of one turn, reduced to what the decision needs. */
export interface AssistantTurnText {
  text: string
  toolCalls: number
}

/** Structural session event face (durable log replay). */
interface SessionEventLike {
  type?: string
  data?: {
    turn?: number
    todos?: Array<{ status?: string }>
    message?: { content?: Array<{ type?: string; text?: string }> }
  }
}

/** True when the routed model id matches any configured legacy pattern. */
export function matchesLegacyModel(modelId: string | undefined, patterns: readonly string[]): boolean {
  if (typeof modelId !== 'string' || modelId === '') return false
  const id = modelId.toLowerCase()
  for (const raw of patterns) {
    const pattern = String(raw ?? '').trim().toLowerCase()
    if (pattern === '') continue
    if (!pattern.includes('*')) {
      if (id.includes(pattern)) return true
      continue
    }
    const parts = pattern.split('*').filter((part) => part !== '')
    let at = 0
    let matched = true
    for (const part of parts) {
      const index = id.indexOf(part, at)
      if (index < 0) { matched = false; break }
      at = index + part.length
    }
    if (matched) return true
  }
  return false
}

/** Number of pending/in-progress todos in the newest todo/write event. */
export function openTodoCount(events: readonly unknown[]): number {
  let latest: Array<{ status?: string }> = []
  for (const event of events) {
    const e = event as SessionEventLike
    if (e.type === 'todo/write' && Array.isArray(e.data?.todos)) latest = e.data?.todos ?? []
  }
  return latest.filter((todo) => todo.status === 'pending' || todo.status === 'in_progress').length
}

/** The last assistant message of one turn, or undefined when the turn had none. */
export function lastAssistantOfTurn(events: readonly unknown[], turn: number): AssistantTurnText | undefined {
  let found: AssistantTurnText | undefined
  for (const event of events) {
    const e = event as SessionEventLike
    if (e.type !== 'assistant/message' || e.data?.turn !== turn) continue
    const content = Array.isArray(e.data?.message?.content) ? e.data.message.content : []
    const text = content
      .filter((block) => block.type === 'text' && typeof block.text === 'string')
      .map((block) => block.text ?? '')
      .join(' ')
      .trim()
    const toolCalls = content.filter((block) => block.type === 'tool-call').length
    found = { text, toolCalls }
  }
  return found
}

/** Forward-looking cue at the end of a progress report (last 100 characters). */
const UNFINISHED_CUE = /(接下来|下一步|现在(?:我|来)|然后|让我|我来|我会|准备|开始|继续|待|next|now|let me|i'?ll|i will|then)/i

/** True when the text looks like a progress report rather than a final answer. */
export function looksUnfinished(text: string, openTodos: number): boolean {
  const trimmed = typeof text === 'string' ? text.trim() : ''
  if (trimmed === '') return false
  // A question addressed to the user is a decision point, not a stalled step.
  if (/[?？]\s*$/.test(trimmed)) return false
  // Open work is strong evidence; otherwise require an explicit forward cue.
  if (openTodos > 0) return true
  return UNFINISHED_CUE.test(trimmed.slice(-100))
}

/** One continuation decision with a reason for diagnostics. */
export interface ContinuationDecision {
  continue: boolean
  reason: 'disabled' | 'model' | 'tools' | 'empty' | 'finished' | 'ok'
}

/** Decide whether a text-only turn should receive a continuation message. */
export function shouldContinue(
  input: { modelId?: string; last?: AssistantTurnText; openTodos: number },
  policy: ContinuationPolicy,
): ContinuationDecision {
  if (!policy.enabled) return { continue: false, reason: 'disabled' }
  if (!matchesLegacyModel(input.modelId, policy.models)) return { continue: false, reason: 'model' }
  if (input.last === undefined) return { continue: false, reason: 'empty' }
  if (input.last.toolCalls > 0) return { continue: false, reason: 'tools' }
  if (input.last.text === '') return { continue: false, reason: 'empty' }
  if (!looksUnfinished(input.last.text, input.openTodos)) return { continue: false, reason: 'finished' }
  return { continue: true, reason: 'ok' }
}
