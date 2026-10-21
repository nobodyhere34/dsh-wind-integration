/**
 * dsh-wind-integration — Cordis native plugin (no dsh-hook-protocol).
 *
 * Integrates the 风插 (dsh-routing-suite router-standard) behavior into DSH at
 * runtime: when a session's model matches the wind gate (default exact id
 * DeepSeek-V4-Flash-0731, plus the /v4/i && '0731' fuzzy fallback), ANY preset
 * gains wind behavior — band persona, stage line, wind declaration, and
 * progressive tool disclosure — while non-native presentations (ptc/both)
 * receive behavior only and never lose tool control.
 *
 * Host-only wiring: every contribution registers through ctx.on / ctx.effect,
 * so the plugin works whether mounted by a preset or injected at runtime by
 * the dsh-super-injector channel (zero restart, no profile persistence).
 */
import type { Context } from 'cordis'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import z from 'schemastery'
import { STAGES, WIND_GLOBAL_SAFE, WIND_META_TOOLS, windowFor, bandLabel, extractText, advanceStage } from './wind-core.js'
import { decideWind, matchesTargetModel } from './wind-gate.js'
import { WindRuntime } from './wind-state.js'
import type { SessionWindState } from './wind-state.js'
import { transformAssembly, maybeGuided, recordUserMessage } from './wind-apply.js'
import type { WindConfig, WindResolvedConfig, WindAgentFace, PreStepDecision, PromptAssembly } from './types.js'

export const name = 'dsh-wind-integration'
export const inject = ['tools']

const BT = String.fromCharCode(96) // backtick, for the wind_status markdown fence

export const Config = z.object({
  targetModels: z.array(z.string()).default(['DeepSeek-V4-Flash-0731', 'deepseek-v4-pro-0813']).volatile(),
  matchV4Fallback: z.boolean().default(false).volatile(),
  skipPresets: z.array(z.string()).default(['router-standard', 'router-spec', 'router-pro']),
  preservePresentationModes: z.array(z.string()).default(['ptc', 'both']),
  stageRestrict: z.boolean().default(true),
  guideEnabled: z.boolean().default(true),
  debugLog: z.boolean().default(false),
})

export function apply(ctx: Context, config: WindConfig): void {
  // Volatile config fields are sampled per decision so Plugins-page edits apply live.
  const resolveConfig = (): WindResolvedConfig => ({
    ...config,
    targetModels: config.targetModels.get(),
    matchV4Fallback: config.matchV4Fallback.get(),
  })
  // ── per-session activation override persistence (host state, outside the package) ──
  const stateDir = process.env.DSH_WIND_STATE_DIR ?? join(homedir(), '.dsh', 'dsh-wind-integration')
  const stateFile = join(stateDir, 'wind-enable.json')
  let overrides: Record<string, boolean> = {}
  try {
    overrides = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, 'utf8')) : {}
    if (typeof overrides !== 'object' || overrides === null) overrides = {}
  } catch {
    overrides = {}
  }
  let saveTimer: ReturnType<typeof setTimeout> | undefined
  // Overrides must survive across agent stops (a resumed session keeps its
  // disabled choice), so they are not dropped on dispose; the store is bounded
  // instead, evicting the least-recently-set entries.
  const MAX_OVERRIDES = 1000
  function persistOverride(sid: string, enabled: boolean): void {
    if (enabled) delete overrides[sid]
    else {
      delete overrides[sid]
      overrides[sid] = false
      const keys = Object.keys(overrides)
      for (let i = 0; i + MAX_OVERRIDES < keys.length; i++) delete overrides[keys[i]]
    }
    if (saveTimer !== undefined) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      try {
        mkdirSync(stateDir, { recursive: true })
        writeFileSync(stateFile, JSON.stringify(overrides, null, 2))
      } catch (e) {
        log('persist override: ' + String(e))
      }
    }, 250)
  }

  const runtime = new WindRuntime(persistOverride)
  runtime.seedOverrides(Object.entries(overrides))
  const log = (msg: unknown): void => { if (config.debugLog) console.log('[wind]', msg) }

  // ── host-side resolvers (every capability optional; failures degrade to inactive) ──
  function composedPresetOf(agent: WindAgentFace): string | undefined {
    try {
      const ap = ctx.get('agentPresets') as { composedPreset?: (c: unknown) => string | undefined } | undefined
      const id = ap?.composedPreset?.(agent.ctx)
      return typeof id === 'string' && id ? id : undefined
    } catch (e) { log('composedPreset: ' + String(e)); return undefined }
  }

  function presentationOf(agent: WindAgentFace): string | undefined {
    try {
      const ts = agent.ctx?.get?.('tools') as { modeFor?: (a: unknown) => unknown } | undefined
      const m = ts?.modeFor?.(agent)
      return m === undefined || m === null ? undefined : String(m)
    } catch (e) { log('presentation: ' + String(e)); return undefined }
  }

  function toolsOf(agent: WindAgentFace): {
    register?: (def: unknown) => unknown
    restrict?: (r: { allow: string[] }) => (() => void) | undefined
    view?: (a: unknown) => { visible?: Iterable<string>; restrictableNames?: string[] }
  } | undefined {
    try { return agent.ctx?.get?.('tools') as ReturnType<typeof toolsOf> } catch { return undefined }
  }

  function sidOf(agent: WindAgentFace): string | undefined {
    return agent.session?.id ?? agent.id
  }

  /** The session's live model choice before its first request header exists. */
  function liveSelectionModel(agent: WindAgentFace): string | undefined {
    try {
      const projections = ctx.get('sessionProjections') as {
        stateOf?: (session: unknown, kind: string) => { pending?: { model?: unknown } | null } | undefined
      } | undefined
      const pending = projections?.stateOf?.(agent.session, 'modelSelection')?.pending
      if (pending && typeof pending.model === 'string' && pending.model !== '') return pending.model
    } catch { /* projection optional */ }
    try {
      const def = ctx.get('agentDefaultModel')?.currentSelection?.() as { model?: unknown } | undefined
      if (def && typeof def.model === 'string' && def.model !== '') return def.model
    } catch { /* default selection optional */ }
    return undefined
  }

  function modelOf(agent: WindAgentFace, variables?: Record<string, unknown>): string | undefined {
    // The durable request header carries the route the loop actually sent.
    // Before the first request (and on a mid-session switch) the session's
    // modelSelection projection holds the user's live choice; the deployment
    // default is the last resort. Creation options are deliberately not a gate
    // source: they stay stale after the user switches models.
    const routed = requestHeaderModel(agent)
    if (routed !== undefined && routed !== '') return routed
    if (variables && typeof variables.model === 'string' && variables.model !== '') return variables.model
    return liveSelectionModel(agent)
  }

  /** The folded `request/header` route, the same source the harness delegation code reads. */
  function requestHeaderModel(agent: WindAgentFace): string | undefined {
    try {
      const session = agent.session as { requestHeader?: () => { config?: { model?: string } } | undefined } | undefined
      return session?.requestHeader?.()?.config?.model
    } catch { return undefined }
  }

  /** Record a session's latest route so a gate miss can be reported truthfully. */
  function observeModel(sid: string, modelId: string | undefined): void {
    if (modelId === undefined || modelId === '') return
    runtime.ensure(sid).model = modelId
  }

  function sessionEventToolNames(agent: WindAgentFace): string[] {
    const session = agent.session as unknown as { snapshotEvents?: () => unknown[]; events?: unknown[] } | undefined
    let evs: unknown[] | undefined
    try { evs = typeof session?.snapshotEvents === 'function' ? session.snapshotEvents() : session?.events } catch { /* ignore */ }
    if (!Array.isArray(evs)) return []
    const names: string[] = []
    for (const ev of evs) {
      const e = ev as { type?: string; data?: Record<string, unknown> } | undefined
      const type = e?.type ?? ''
      if (type === 'tool/call' || type === 'tool/ptc-dispatch' || type === 'tool/ptc-dispatch-start') {
        // Session events carry their payload under `.data`; `tool/call` names the
        // tool directly (`data.name`).
        const d = e?.data as { name?: string; tool?: { name?: string } } | undefined
        const n = typeof d?.name === 'string' ? d.name
          : typeof d?.tool?.name === 'string' ? d.tool.name
          : undefined
        if (n) names.push(n)
      }
    }
    return names
  }

  function toolNamesFromMessages(messages: unknown[]): string[] {
    const names: string[] = []
    for (const m of messages) {
      const msg = m as { content?: unknown } | undefined
      if (!Array.isArray(msg?.content)) continue
      for (const block of msg.content as Array<Record<string, unknown>>) {
        // Harness tool blocks use the `tool-call` discriminant with a top-level `name`.
        if (block?.type === 'tool-call' && typeof block.name === 'string') names.push(block.name)
      }
    }
    return names
  }

  function hasUserMessage(messages: unknown[]): boolean {
    return messages.some((m) => {
      const src = (m as { source?: { kind?: string } })?.source
      return src?.kind === 'user'
    })
  }

  // ── staged tool disclosure ──
  function applyStageRestrict(agent: WindAgentFace, st: SessionWindState): void {
    try {
      const toolsSvc = toolsOf(agent)
      if (!toolsSvc || typeof toolsSvc.restrict !== 'function') return
      if (st.restrictDisposer) {
        try { st.restrictDisposer() } catch { /* release best-effort */ }
        st.restrictDisposer = undefined
      }
      st.restrictApplied = false
      if (st.stage >= STAGES.length - 1) return // full catalog — no restriction
      const stageTools = STAGES.slice(0, windowFor(st.stage)).flatMap((s) => [...s.tools])
      const allowSet = new Set([...stageTools, ...WIND_META_TOOLS])
      let known: Set<string> | null = null
      try {
        const rn = toolsSvc.view?.(agent)?.restrictableNames
        if (Array.isArray(rn)) known = new Set(rn)
      } catch { /* view optional */ }
      const allow = [...allowSet].filter((t) => {
        if (WIND_META_TOOLS.includes(t)) return true
        return WIND_GLOBAL_SAFE.includes(t) && (known === null || known.has(t))
      })
      if (allow.length === 0) return
      const disposer = toolsSvc.restrict({ allow }) ?? undefined
      st.restrictDisposer = disposer
      st.restrictApplied = true
      log('restrict stage ' + (st.stage + 1) + '/' + STAGES.length + ': ' + allow.join(','))
    } catch (e) { log('restrict failed (keep full catalog): ' + String(e)) }
  }

  function releaseRestrict(st: SessionWindState): void {
    if (st.restrictDisposer) {
      try { st.restrictDisposer() } catch { /* release best-effort */ }
      st.restrictDisposer = undefined
    }
    st.restrictApplied = false
    log('disclosure released (full catalog)')
  }

  // ── per-agent wind_status tool (agent-scoped; unwinds with the agent scope) ──
  function registerWindStatus(agent: WindAgentFace, st: SessionWindState): void {
    if (st.toolRegistered) return
    try {
      const toolsSvc = toolsOf(agent)
      const reg = toolsSvc?.register
      const scopeEffect = agent.ctx?.effect
      if (typeof reg !== 'function') return
      const def = {
        name: 'wind_status',
        description: 'Wind routing status for this session: model gate, band, stage, disclosure state, and callable tools.',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
        output: { schema: { type: 'string' }, render: (_a: unknown, v: unknown) => [{ type: 'text', text: String(v) }] },
        async execute(_args: unknown, exec: { agent?: WindAgentFace }): Promise<string> {
          const a = exec?.agent ?? agent
          const sid = sidOf(a) ?? st.sid
          const cur = runtime.get(sid) ?? st
          const presetId = composedPresetOf(a)
          const presentation = presentationOf(a)
          const model = modelOf(a) ?? cur.firstAssembledModel
          const decision = decideWind({ modelId: model, presetId, presentation }, resolveConfig())
          const full = cur.stage >= STAGES.length - 1
          let vis: string[] = []
          try {
            const v = toolsOf(a)?.view?.(a)?.visible
            if (v) vis = [...v]
          } catch { /* view optional */ }
          const lines = [
            'wind_status',
            'model: ' + (model ?? '?') + (decision.modelMatched ? ' [matched]' : ' [not matched]'),
            'preset: ' + (presetId ?? '?') + (decision.skipReason === 'preset' ? ' [wind-native — overlay skipped]' : ''),
            'presentation: ' + (presentation ?? 'native') + (decision.restrict ? ' [staged disclosure]' : decision.active ? ' [tools preserved]' : ''),
            'active: ' + String(decision.active),
            'band: ' + bandLabel(cur.band) + '  stage: ' + (cur.stage + 1) + '/' + STAGES.length + (full ? ' [full catalog]' : ' [stage tools only]'),
            'guide: ' + (cur.guided ? 'injected' : 'pending'),
            'assemblies: ' + String(cur.injectedAssemblies),
            'callable tools (' + String(vis.length) + '): ' + vis.join(', '),
          ]
          const fence = BT + BT + BT
          return fence + '\n' + lines.join('\n') + '\n' + fence
        },
      }
      if (typeof scopeEffect === 'function') scopeEffect(() => reg(def), 'wind_status register')
      else reg(def)
      st.toolRegistered = true
      log('wind_status registered for ' + sidOf(agent))
    } catch (e) { log('wind_status register: ' + String(e)) }
  }

  // ── hooks ──
  ctx.on('system-prompt/assemble', async (_assembly: unknown, context: { agent?: WindAgentFace }, next: () => Promise<unknown>) => {
    const assembled = await next() as PromptAssembly
    const agent = context.agent
    if (agent === undefined) return assembled
    const sid = sidOf(agent)
    if (sid === undefined) return assembled
    const variables = (assembled.variables ?? {}) as Record<string, unknown>
    const meta = {
      sid,
      modelId: modelOf(agent, variables),
      presetId: composedPresetOf(agent),
      presentation: presentationOf(agent),
    }
    const { assembled: out, decision } = transformAssembly(assembled, meta, resolveConfig(), runtime)
    if (decision.active) {
      const st = runtime.ensure(sid)
      if (decision.restrict && !st.restrictApplied) applyStageRestrict(agent, st)
      registerWindStatus(agent, st)
    }
    return out
  })

  ctx.on('agent/inbox/claimed', (payload: { agent?: WindAgentFace; message?: unknown }) => {
    const agent = payload.agent
    if (agent === undefined) return
    const sid = sidOf(agent)
    if (sid === undefined) return
    observeModel(sid, modelOf(agent))
    if (!matchesTargetModel(modelOf(agent), resolveConfig())) return
    const text = extractText(payload.message)
    recordUserMessage(runtime, sid, text)
    const st = runtime.get(sid)
    if (st && runtime.enabled(sid)) registerWindStatus(agent, st)
  })

  ctx.on('agent/pre-step', async (payload: { agent?: WindAgentFace; messages?: unknown[]; step?: number }, next: () => Promise<unknown>) => {
    const decision = await next() as PreStepDecision
    if (decision.kind !== 'enter') return decision
    const agent = payload.agent
    if (agent === undefined) return decision
    const sid = sidOf(agent)
    if (sid === undefined) return decision
    const stepModel = modelOf(agent)
    observeModel(sid, stepModel)
    const st = runtime.ensure(sid)
    st.stepsSeen += 1
    if (st.mode === undefined && st.firstText !== undefined) {
      const { classifyTask } = await import('./wind-core.js')
      st.mode = classifyTask(st.firstText)
    }
    if (runtime.enabled(sid)) registerWindStatus(agent, st)
    const userText = (payload.messages ?? []).map((m) => extractText(m)).join(' ')
    const toolNames = new Set([...sessionEventToolNames(agent), ...toolNamesFromMessages(payload.messages ?? [])])
    const advanced = advanceStage(st.stage, toolNames, userText)
    if (advanced !== st.stage) {
      st.stage = advanced
      if (st.restrictApplied) {
        if (advanced >= STAGES.length - 1) releaseRestrict(st)
        else applyStageRestrict(agent, st)
      }
      log('stage → ' + (advanced + 1) + '/' + STAGES.length)
    }
    const meta = {
      sid,
      modelId: modelOf(agent),
      presetId: composedPresetOf(agent),
      presentation: presentationOf(agent),
      step: payload.step ?? 0,
      hasUserMessage: hasUserMessage(payload.messages ?? []),
      mode: st.mode,
    }
    return maybeGuided(decision, meta, resolveConfig(), runtime)
  })

  // terminal cleanup: release the restrict disposer and mark the session
  // stopped. The state stays reportable (bounded) so the card does not blank
  // when a short-lived session ends.
  ctx.on('agent/status', (payload: { agent?: WindAgentFace; status?: string }) => {
    const status = payload.status ?? ''
    if (status === 'stopped' || status === 'disposed' || status === 'error') {
      const sid = sidOf(payload.agent ?? ({} as WindAgentFace))
      if (sid === undefined) return
      const st = runtime.get(sid)
      if (st) releaseRestrict(st)
      runtime.markStopped(sid)
      log('session cleanup: ' + sid)
    }
  })

  // ── UI endpoints (host-only): GET /wind/status (polled by the client pill)
  // and POST /wind/config (per-session activation override: false disables
  // wind for that session even when the model gate passes). No model-visible
  // surface; both fail closed when the webserver service is absent.
  function handleStatus(res: ServerResponse): void {
    const view = runtime.statusView()
    const st = view?.state ?? null
    const body = JSON.stringify({
      plugin: 'dsh-wind-integration',
      version: '0.1.5',
      active: view?.active ?? false,
      targetModels: config.targetModels.get(),
      latest: st === null ? null : {
        sid: st.sid,
        model: st.model ?? st.firstAssembledModel,
        engaged: st.engaged,
        stopped: st.stopped ?? false,
        band: st.band,
        stage: st.stage + 1,
        stageTotal: STAGES.length,
        guided: st.guided,
        restrictApplied: st.restrictApplied,
        injectedAssemblies: st.injectedAssemblies,
        enabled: runtime.enabled(st.sid),
      },
    })
    res.statusCode = 200
    res.setHeader('content-type', 'application/json; charset=utf-8')
    res.end(body)
  }

  function handleConfig(req: IncomingMessage, res: ServerResponse): void {
    let raw = ''
    req.on('data', (chunk: Buffer) => {
      if (raw.length < 65536) raw += chunk.toString()
    })
    req.on('end', () => {
      try {
        const body = JSON.parse(raw) as { sid?: unknown; enabled?: unknown }
        if (typeof body.sid !== 'string' || body.sid === '' || typeof body.enabled !== 'boolean') {
          res.statusCode = 400
          res.setHeader('content-type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ ok: false, error: 'sid: string and enabled: boolean required' }))
          return
        }
        runtime.setEnabled(body.sid, body.enabled)
        res.statusCode = 200
        res.setHeader('content-type', 'application/json; charset=utf-8')
        res.end(JSON.stringify({ ok: true, sid: body.sid, enabled: body.enabled }))
      } catch {
        res.statusCode = 400
        res.setHeader('content-type', 'application/json; charset=utf-8')
        res.end(JSON.stringify({ ok: false, error: 'invalid JSON body' }))
      }
    })
    req.on('error', () => {
      res.statusCode = 400
      res.setHeader('content-type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ ok: false, error: 'body read failed' }))
    })
  }

  ctx.effect(() => {
    try {
      // Never declare 'webServer' in inject (activation would wait on a
      // service the injected fiber may not see); resolve it lazily and degrade
      // to no route when the service is absent.
      const ws = ctx.get('webServer') as { register?: (route: unknown) => () => void } | undefined
      if (!ws || typeof ws.register !== 'function') return () => {}
      return ws.register!({
        kind: 'prefix',
        path: '/wind',
        handler: (req: IncomingMessage, res: ServerResponse): void => {
          const url = new URL(req.url ?? '/', 'http://dsh.local')
          if (req.method === 'POST' && url.pathname === '/wind/config') {
            handleConfig(req, res)
            return
          }
          handleStatus(res)
        },
      })
    } catch (e) {
      log('status route register: ' + String(e))
      return () => {}
    }
  }, 'dsh-wind: status + config route')
}
