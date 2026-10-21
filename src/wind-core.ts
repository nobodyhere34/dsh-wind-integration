/**
 * Wind routing core — task classification, persona selection, staged tool
 * ladder, and system-prompt section builders. All pure and offline-testable.
 *
 * The classification/persona logic is ported (MIT) from dsh-routing-suite
 * `preset/router-standard/router-core-v34.mjs` so this package reproduces the
 * "风插/wind" router behavior without depending on the preset tree.
 * Attribution: dsh-routing-suite (© 2026 yjh051108), MIT.
 */
import type { PromptSection } from './types.js'

/** A classified task mode: a band index (0/0.3/1) or the string 'weak'. */
export type TaskMode = number | 'weak'
/** Behavior band a mode quantizes to. */
export type BandName = 'spec' | 'mixed' | 'react' | 'weak'

export const MODE_SPEC = 0
export const MODE_MIXED = 0.3
export const MODE_REACT = 1
export const MODE_WEAK = 'weak'

const SPEC_PERSONA = 'You are a helpful software engineer assistant.'
const MIXED_PERSONA =
  'You are a helpful software engineer assistant.\n'
  + 'Work directly: prefer writing or editing code over describing plans. '
  + 'Verify your changes by reading and running them.'
const REACT_PERSONA =
  'You are a hands-on software engineer who delivers working output fast.\n'
  + 'Work directly: write or edit code, then verify it by reading and running. '
  + 'Keep the loop tight — produce, verify, fix — and do not build test '
  + 'harnesses, scaffolding, or ceremony the user did not ask for. '
  + 'Finish with a usable deliverable and a short summary.'
const WEAK_PRO =
  'You are a helpful software engineer assistant.\n'
  + 'Before acting, decide the task type (build or fix) and adopt the matching '
  + 'style: build → hands-on production; fix → inspect-and-plan.'
const WEAK_FLASH =
  'You are a helpful assistant.\n'
  + 'Before acting, decide the task type (build or fix) and adopt the matching '
  + 'style: build → hands-on production; fix → inspect-and-plan.\n'
  + 'Before acting, briefly review what you have already done in this session and continue from where you left off; do not repeat completed steps. Do not run environment checks (echo, whoami, uname, node --version, date) or exhaustive grep/glob scans.\n'
  + 'Think deeply first, then produce.'

const COMPLEX_RE = /(重构|架构|全面|详细|设计|系统|优化|分析|survey|overview|architecture|refactor|comprehensive|detailed|design|system|optimize|analyze)/i
// Upstream router-core-v34 classification vocabulary (hit-counted, not first-match).
const REACT_RE = /(开发|创建|写一个|生成|从零|做一个|游戏|网页|网站|构建|新项目|搭建|实现|做出|上线|落地|脚本|工具|应用|build|create|develop|generate|implement|make a|new project)/gi
const SPEC_RE = /(修复|修一下|调试|重构|维护|排查|报错|出错|崩溃|优化|审查|review|fix|debug|refactor|maintain|repair|broken|break|为什么|异常|故障|迁移|升级|兼容)/gi

function countHits(regex: RegExp, text: string): number {
  return [...text.matchAll(regex)].length
}

function clamp01(n: number | undefined): number {
  return Math.min(1, Math.max(0, Number(n) || 0))
}

/** True when the model id names a Flash-family model. */
export function isFlashModel(modelId: string | undefined): boolean {
  return typeof modelId === 'string' && /flash/i.test(modelId)
}

/** Long or architecturally-worded tasks are complex. */
export function isComplexTask(text: string): boolean {
  return typeof text === 'string' && (text.length > 120 || COMPLEX_RE.test(text))
}

/** Quantize a task mode to a stable behavior band. */
export function bandOf(mode: TaskMode | undefined): BandName {
  if (mode === MODE_WEAK) return 'weak'
  const m = clamp01(mode)
  if (m < 0.2) return 'spec'
  // Upstream keeps [0.2, 0.5) as the unstable transition band.
  if (m < 0.5) return 'mixed'
  return 'react'
}

/** Classify a user task text into a reasoning mode (0 / 0.3 / 1 / 'weak').
 * Clear keyword evidence picks a stable band; ambiguous text returns 'weak'
 * so the model routes itself (same hit-count rule as upstream router-core-v34). */
export function classifyTask(text: string): TaskMode {
  if (typeof text !== 'string' || text.trim() === '') return MODE_WEAK
  const react = countHits(REACT_RE, text)
  const spec = countHits(SPEC_RE, text)
  if (react > spec) return 1
  if (spec > react) return 0
  return MODE_WEAK
}

/** Extract the display text from a user message (content array or plain string). */
export function extractText(message: unknown): string {
  // Upstream #1 defensive unwrap: injector seeds occasionally nest the payload
  // under `data.message`; reading `content` directly would classify as weak.
  const raw = message as { message?: unknown; content?: unknown; text?: unknown } | undefined
  if (!raw) return ''
  const payload = ((raw.message !== null && typeof raw.message === 'object' ? raw.message : raw) as { content?: unknown; text?: unknown })
  const content = payload.content
  if (Array.isArray(content)) {
    return content
      .map((c) => (typeof c === 'string' ? c : (c && typeof c === 'object' ? (c as { text?: string }).text ?? '' : '')))
      .join(' ')
      .trim()
  }
  if (typeof content === 'string') return content.trim()
  if (typeof payload.text === 'string') return payload.text.trim()
  return ''
}

/** Persona for a raw mode value (upstream-compatible name). */
export function personaFor(mode: TaskMode | undefined, modelId?: string): string {
  return personaForBand(bandOf(mode), modelId)
}

/** Human-readable band name for a mode value (upstream `bandFor`). */
export function bandFor(mode: TaskMode | undefined): BandName {
  return bandOf(mode)
}

/** First-turn core tool surface by band (upstream v34 measurement). */
export function coreFor(mode: TaskMode | undefined): string[] {
  switch (bandOf(mode)) {
    case 'spec': return ['read', 'edit', 'glob', 'grep']
    case 'mixed': return ['read', 'edit', 'write', 'glob', 'grep']
    case 'weak': return ['str_replace_editor']
    default: return ['read', 'write', 'edit']
  }
}

/** Informational test-suppression strength by band (upstream v34). */
export function testinessFor(mode: TaskMode | undefined): 'suppressed' | 'normal' | 'light' {
  switch (bandOf(mode)) {
    case 'react': return 'suppressed'
    case 'spec': return 'normal'
    default: return 'light'
  }
}

/** Parse a user/agent-supplied mode token: number 0-100, decimal 0-1, band name, or 'auto'. */
export function parseMode(token: unknown): TaskMode | 'auto' | null {
  if (token === undefined || token === null) return null
  const t = String(token).trim().toLowerCase()
  if (t === 'auto') return 'auto'
  if (t === 'weak' || t === 'router') return 'weak'
  if (t === 'spec' || t === 'spec-lean') return 0
  if (t === 'balanced' || t === 'mixed') return 0.3
  if (t === 'react' || t === 'react-lean') return 1
  const n = Number(t)
  if (!Number.isFinite(n)) return null
  return t.includes('.') ? clamp01(n) : clamp01(n / 100)
}

/** Per-session mode from durable events, skipping plugin-origin user messages (upstream #13). */
export function sessionMode(session: unknown): TaskMode {
  const s = session as { events?: unknown[]; snapshotEvents?: () => unknown[] } | undefined
  const events = (s?.events ?? (typeof s?.snapshotEvents === 'function' ? s.snapshotEvents() : [])) as Array<{ type?: string; data?: { source?: { kind?: string } } }>
  const userMsg = events.find((e) => e.type === 'user/message' && e.data?.source?.kind !== 'plugin')
    ?? events.find((e) => e.type === 'user/message')
  return classifyTask(extractText(userMsg?.data))
}

/** Band persona (weak is model-specific: flash family gets the neutral classify-and-act persona). */
export function personaForBand(band: BandName | undefined, modelId: string | undefined): string {
  const b = band ?? 'weak'
  if (b === 'spec') return SPEC_PERSONA
  if (b === 'mixed') return MIXED_PERSONA
  if (b === 'react') return REACT_PERSONA
  return isFlashModel(modelId) ? WEAK_FLASH : WEAK_PRO
}

/** Staged tool ladder (wind progressive disclosure). */
export const STAGES: ReadonlyArray<{ name: string; tools: readonly string[]; goal: string }> = [
  { name: '了解/对齐', tools: ['read', 'glob', 'grep', 'web_search', 'ask_user_question'], goal: 'clarify the task and gather what you need' },
  { name: '拟合方案', tools: ['todo_write', 'exit_plan_mode'], goal: 'lay the plan out with todo_write' },
  { name: '开发', tools: ['write', 'edit', 'str_replace_editor'], goal: 'implement per the plan' },
  { name: '验证', tools: ['bash', 'pwsh', 'read_image', 'job_list', 'job_output', 'job_kill'], goal: 'run and verify the deliverable' },
]

/** Tools that stay available at every stage. */
export const WIND_META_TOOLS: readonly string[] = ['wind_status']
/** Union of all stage tools — the full write surface when disclosure is released. */
export const WIND_GLOBAL_SAFE: readonly string[] = [...STAGES.flatMap((s) => s.tools), ...WIND_META_TOOLS]

/** End index (exclusive) of the stage slice exposed at a given stage: only the current stage. */
export function windowFor(stage: number): number {
  return stage + 1
}

/** Advance at most one stage per call from tool evidence plus tightened wording
 * (upstream v34: /方案|计划/ was removed because it fired too early). */
export function advanceStage(stage: number, toolNames: Iterable<string>, text: string): number {
  const names = new Set(toolNames)
  const words = typeof text === 'string' ? text : ''
  let next = stage
  if (next === 0 && (names.has('todo_write') || /开始开发|进入开发|着手实现|开始实现|write the code/i.test(words))) next = 1
  if (next === 1 && (names.has('write') || names.has('edit') || names.has('str_replace_editor'))) next = 2
  if (next === 2 && (names.has('pwsh') || names.has('bash') || /完成|finished|done|验证/i.test(words))) next = 3
  return Math.min(next, STAGES.length - 1)
}

function hasTool(toolNames: Iterable<string>, ...names: string[]): boolean {
  const set = new Set(toolNames)
  return names.some((n) => set.has(n))
}

/** Upstream router-standard STAGE_GUIDES (v34), adapted only where this port
 * lacks a subsystem: memory (engram), tools_catalog, phase_advance and
 * delivery_check mentions are replaced by this port's wind_status /
 * auto-advance and plain delivery discipline. Everything else is verbatim. */
export const STAGE_GUIDES: readonly string[] = [
  'Phase: understanding. Unlocked: this stage only — read/glob/grep/web_search/ask_user_question. Ground first: read/ask for what you need. Do this stage properly and think broadly — do not settle on the first obvious reading. Break the request into its dimensions (what the user wants, how features should behave, what "good" looks like) and surface the genuinely ambiguous ones: a word like "拖拽" could mean reorder, drag-to-recategory, or both; "瀑布流" could mean masonry columns or JS-grid; persistence is often unspecified. **Decide each ambiguity by its impact:** if you can infer the common meaning and only one interpretation is reasonable for a deliverable, state that assumption clearly in one sentence (so the user can correct it) and continue — but if two or more interpretations would materially change the result (reorder vs recategory; persist vs not), ask ONE focused ask_user_question per such ambiguity, with concrete options. Do not under-ask (assume everything) nor over-ask (interrogate trivia) — aim for the questions that actually change the artifact. This is a deep-thinking stage: if the task is complex, also record a plan (todo_write). **Complete when: you understand the task (assumptions stated, or key ambiguities answered) — and, if complex, a plan is recorded. No alignment, no advancement.** → Done? Understood (stated assumption / question answered / plan recorded) → next stage.',
  'Phase: planning. Unlocked: todo_write/exit_plan_mode. Do this stage properly: design the approach, cover edge cases, define what "done" means, and decide acceptance criteria — not just list steps. **Attention reclamation (v1.26): assetize your context — keep the task goal + the current decision + the live evidence in the attention window; sink settled exploration/details into notes instead of holding them all; let stale, superseded, or resolved threads truly drop (fresh context recovers attention). Do not hold "everything might be useful" in mind — that is attention leakage, not diligence.** **Isolation & parallel (pillar 4): when two independent concerns are polluting one thread, or a sub-problem is eating the mainline budget, push it into a subagent / workflow (independent context) instead of keeping it in the same stream — a focused subagent holds its own attention so your mainline stays on the critical path.** **Complete when: the plan is thorough enough that the design is decision-complete (what to build, how it fits, what success looks like), recorded via todo_write or presented via exit_plan_mode.** Only this lets you enter development. Note: a completion signal (todo_write / exit_plan_mode) AUTO-advances to the next phase — do NOT force an advance after it, or you will skip a phase. → Done? Plan is decision-complete and locked (todo_write / exit_plan_mode) → develop (auto).',
  'Phase: development. Unlocked: write/edit/str_replace_editor. Re-read before re-edit (editor enforces fresh read); write/edit results carry FULL before/after text — take path/operation, inspect with grep/read. Do this stage properly: make the artifact real, self-check it against the plan and the acceptance criteria, and do not declare it done until it actually passes its own check. **Avoid local-optima (v1.22): keep the WHOLE artifact working while you iterate. If you find yourself re-fighting the same detail for several rounds with no convergence (e.g. a finite-difference sign, a conservation drift), step back: (1) is this detail blocking the overall deliverable, or is it polish? (2) preserve a working version; iterate on the detail in parallel, not by stalling the whole. (3) if a detail resists, finish the rest and re-attack it fresh — do not let one stubborn sub-problem stall the deliverable.** **Complete when: the artifact exists and passes its self-check — then enter verification by starting the verification work.** → Done? Self-check passes → verification.',
  'Phase: verification → delivery gate. Unlocked: pwsh/bash/read_image/jobs. Windows: bash = Git Bash (first-class), pwsh for PowerShell; Git Bash may need the one-shot sandbox escalation (approval=never: if denied, report it — never bypass). Page verify with your OWN tools: run a headless browser/playwright via bash (or install one), screenshot + read_image each shot (to visually confirm). **On verification failure, hold a quick hypothesis-audit (guidance, not a hard block): before touching the implementation, name in one line (a) which assumption you are now re-checking, (b) what NEW evidence you just gained — this turns "doubt the hypothesis" from a prompt into a habit. If the code is actually correct, say so and move on (do not manufacture a bug to justify rework).** Then check gates/evidence. Do this stage properly: verify the real artifact, not a summary of it — check evidence, look for defects, review the visuals honestly. **Gate: verify the real artifact with evidence — missing evidence or unreviewed visuals do not count as done.**',
]

/** The near-field guide text (same-request, appended once on the first pre-step).
 * Upstream START_GUIDE, adapted for wind_status and the absent bootstrap tools. */
export function buildGuide(band: BandName | undefined, modelId: string | undefined): string {
  const b = band ?? 'weak'
  return 'Bootstrap (once per session): this is a progressive tool-unlock session — tools open in phases like a leveling game. A brand-new conversation auto-starts at phase 0 — no manual reset needed. '
    + 'Unlock order: understanding (read/glob/grep/web_search/ask_user_question) → planning (todo_write/exit_plan_mode) → development (write/edit/str_replace_editor) → verification (bash/pwsh/read_image/jobs). '
    + 'This guide appears only once; after this, no phase messages are injected. '
    + 'Current phase + unlocked tools are always visible in the system prompt (wind-stage section) and via wind_status (tools["wind_status"]({})). '
    + 'You route yourself: to advance, complete the current phase — alignment (assumptions stated / plan recorded) → planning (plan locked) → development (self-check) → verification (artifact verified) — tool usage alone never skips a stage. '
    + 'Task classified as ' + b + (isFlashModel(modelId) ? ' (flash)' : '') + '.'
}

/** Persistent declaration appended to every wind assembly. */
export function buildDeclaration(): string {
  return 'We hold a full tool registry, revealed in phases. The current phase and unlocked tools are always visible in the system prompt (wind-stage section) and via wind_status. '
    + 'Meta tools are always callable: wind_status (self-check). '
    + 'Tool signatures are NOT uniform: before the first use of any tool this session, read its parameter names — never guess. Runtime caps (read lines, search count, output bytes) are enforced at call time. '
    + "Tools are directly callable (native mode — no wrapping): call write/edit/read/bash directly; only the current phase's tools are injected. Zero-arg tools still take {}: tools['wind_status']({}). "
    + 'write/edit results carry the FULL before/after text — take only path/operation, never print a whole write/edit result (context explosion); inspect the changed lines with grep/read instead. '
    + 'Verify your own work: run the artifact, screenshot/render and read_image it where relevant — do not rely on a fixed page-verify tool. '
    + 'Proactivity protocol: act on reversible next steps; ask only for user-owned choices; report actions with evidence.'
}

/** The stage section text: current stage, unlocked tools, and next goal. */
export function buildStageText(stage: number, modelId: string | undefined, band: BandName | undefined, fullCatalog: boolean): string {
  const cur = STAGES[stage]
  const tools = fullCatalog
    ? (WIND_GLOBAL_SAFE as readonly string[]).join(', ')
    : (WIND_META_TOOLS as readonly string[]).concat(STAGES[stage].tools).join(', ')
  const guide = STAGE_GUIDES[stage] ?? ''
  const total = STAGES.length - 1
  if (fullCatalog) {
    return 'Current phase: ' + cur.name + ' (' + total + '/' + total + '). Delivery: restrict released — full catalog open: ' + tools
      + '\nStage guide: ' + guide
      + '\nUntil the artifact is verified, do NOT declare the task delivered. Delivery is the gate, not a progress label.'
  }
  return 'Current phase: ' + cur.name + ' (' + stage + '/' + total + '). Core: ' + tools
    + '\nMore tools unlock with the next stage — check the current phase with tools["wind_status"]({}).'
    + '\nStage guide: ' + guide
    + '\nPhase is self-routed state: complete the current stage goal to advance (automatic); tool usage alone never skips a stage. band=' + (band ?? 'weak') + ' model=' + (modelId ?? '?')
}

/** Replace every persona-named section with one appended wind persona (upstream
 * v34 semantics: official persona is removed, everything else is preserved). */
export function applyPersona(sections: PromptSection[], personaText: string): PromptSection[] {
  const rest = sections.filter((section) => !/persona/i.test(section.name))
  return [...rest, { name: 'router-persona', text: personaText, order: 0 }]
}

/** Sections added on top of the official sections when wind engages. */
export function windExtraSections(stage: number, band: BandName | undefined, modelId: string | undefined, fullCatalog: boolean): PromptSection[] {
  return [
    { name: 'wind-stage', order: 1, text: buildStageText(stage, modelId, band, fullCatalog) },
    { name: 'wind-decl', order: 2, text: buildDeclaration() },
  ]
}

/** Readable band label for the wind_status report. */
export function bandLabel(band: BandName | undefined): string {
  return band ?? 'weak'
}
