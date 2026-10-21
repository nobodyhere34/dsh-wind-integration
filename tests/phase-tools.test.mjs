/**
 * Phase/catalog subsystem acceptance — offline, against the built lib.
 * Covers the six required cases: begin-once, advance-one-level + Next goal,
 * default-tier catalog, query-as-whitebox on locked tools, help runnable vs
 * locked, and state persistence round-trip (memory store, plus a file-store
 * bonus and a registration smoke test).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { STAGES, WIND_META_TOOLS } from '../lib/wind-core.js'
import {
  catalogFromStages,
  beginOnce,
  advanceOne,
  catalogText,
  helpText,
  createMemoryPhaseStore,
  createFilePhaseStore,
} from '../lib/phase-state.js'
import { registerPhaseTools } from '../lib/phase-tools.js'

const stageNames = STAGES.map((s) => s.name)
const PHASE_META = [...WIND_META_TOOLS, 'phase_begin', 'phase_advance', 'tools_catalog', 'tools_help']
const HOST_TOOLS = ['get_goal', 'create_goal', 'update_goal']
const META = {
  read: { description: 'Read a UTF-8 text file and return line-numbered content.', parameters: { type: 'object', properties: { file_path: { type: 'string', description: 'Path to read' } }, required: ['file_path'] } },
  glob: { description: 'Find files matching a glob pattern.' },
  grep: { description: 'Search file contents with a ripgrep regular expression.' },
  web_search: { description: 'Search the web for current information.' },
  ask_user_question: { description: 'Ask the user a concise question.' },
  todo_write: { description: 'Record and update the task list to plan multi-step work' },
  exit_plan_mode: { description: 'Present the plan for review and leave plan mode' },
  write: { description: 'Create or fully replace a UTF-8 text file.' },
  edit: { description: 'Edit an existing UTF-8 text file.' },
  str_replace_editor: { description: 'Edit via command-based string replacement' },
  bash: { description: 'Execute a bash command and return its stdout/stderr' },
  pwsh: { description: 'Execute a PowerShell command' },
  read_image: { description: 'Read a PNG/JPEG/WebP image file' },
  job_list: { description: 'List background jobs' },
  job_output: { description: 'Read a background job output' },
  job_kill: { description: 'Cancel a running background job' },
  wind_status: { description: 'Wind routing status for this session' },
  phase_begin: { description: '确认开启本次会话：开始渐进式工具解锁' },
  phase_advance: { description: '闯关推进：声明当前阶段已完成' },
  tools_catalog: { description: '渐进式披露一级：默认只列当前阶段可调工具', parameters: { type: 'object', properties: { query: { type: 'string' }, domain: { type: 'string' } } } },
  tools_help: { description: '渐进式披露二级：单个工具的完整 schema', parameters: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } },
  get_goal: { description: 'Read the current session goal' },
  create_goal: { description: 'Create a persisted goal' },
  update_goal: { description: 'Update the current goal' },
}
const catalog = catalogFromStages(STAGES, PHASE_META, HOST_TOOLS, META)

test('phase_begin confirms the session start exactly once', () => {
  const store = createMemoryPhaseStore()
  const first = beginOnce(store, 's1', stageNames)
  assert.equal(first.outcome, 'started')
  assert.ok(first.message.startsWith('session started: phase 0 (了解/对齐) unlocked'))
  assert.equal(store.load('s1').guided, true)

  const again = beginOnce(store, 's1', stageNames)
  assert.equal(again.outcome, 'already')
  assert.ok(again.message.includes('no duplicate bootstrap'))
  assert.equal(store.load('s1').stage, 0)

  // legacy record (stage>0, guided unset) is repaired, not re-bootstrapped
  const legacy = createMemoryPhaseStore({ s2: { stage: 2, guided: false } })
  const repaired = beginOnce(legacy, 's2', stageNames)
  assert.equal(repaired.outcome, 'legacy')
  assert.ok(repaired.message.includes('guided flag repaired'))
  assert.equal(legacy.load('s2').guided, true)
})

test('phase_advance moves exactly one stage with a Next-goal card', () => {
  const store = createMemoryPhaseStore()
  beginOnce(store, 's1', stageNames)
  const r = advanceOne(store, 's1', stageNames, catalog, 'understanding done')
  assert.equal(r.advanced, true)
  assert.equal(store.load('s1').stage, 1)
  assert.equal(store.load('s1').lastAdvance.reason, 'understanding done')
  assert.ok(r.message.startsWith('advanced to phase 1: 拟合方案'))
  assert.ok(r.message.includes('New this stage: todo_write — Record and update the task list'))
  assert.ok(r.message.includes('exit_plan_mode'))
  assert.ok(r.message.includes('Next goal: 拟合方案 — complete it via its completion signal (todo_write/exit_plan_mode) or phase_advance.'))
  assert.ok(!r.message.includes('delivery_check'), 'next-goal line drops delivery_check')
})

test('phase_advance is a no-op at the last stage', () => {
  const store = createMemoryPhaseStore({ s1: { stage: 3, guided: true } })
  const r = advanceOne(store, 's1', stageNames, catalog)
  assert.equal(r.advanced, false)
  assert.equal(store.load('s1').stage, 3)
  assert.ok(r.message.includes('already at the last stage (验证); full catalog is open'))
})

test('tools_catalog lists only the current-stage tier by default', () => {
  const store = createMemoryPhaseStore()
  const text = catalogText(store, 's1', {}, stageNames, catalog)
  assert.ok(text.includes('- read [可调] — Read a UTF-8 text file and return line-numbered content. (params: file_path: string)'))
  for (const name of ['glob', 'grep', 'web_search', 'ask_user_question']) {
    assert.ok(text.includes(name + ' [可调]'), name + ' callable row present')
  }
  assert.ok(text.includes('wind_status [meta]'))
  assert.ok(text.includes('tools_catalog [meta]'))
  for (const name of ['write', 'todo_write', 'bash', 'get_goal', 'create_goal', 'update_goal']) {
    assert.ok(!text.includes(name), name + ' not advertised while locked')
  }
  assert.ok(!text.includes('未解锁'), 'no locked rows in the default tier')
  assert.ok(!text.includes('（无匹配工具）'))
  // domain filter + default disclosure: exec-domain tools are all locked at stage 0
  assert.equal(catalogText(store, 's1', { domain: 'exec' }, stageNames, catalog), '（无匹配工具）')
})

test('tools_catalog query is a single-point whitebox: locked tool marked with its unlock stage', () => {
  const store = createMemoryPhaseStore()
  const q = catalogText(store, 's1', { query: 'write' }, stageNames, catalog)
  assert.ok(q.includes('write [未解锁]'), 'locked tool row keeps the 未解锁 mark')
  assert.ok(q.includes('解锁于阶段 2'), 'unlock stage annotated')
  assert.ok(!q.includes('- read '), 'unrelated tools stay hidden')
  // host-kind locked tools carry the delivery-period annotation
  const h = catalogText(store, 's1', { query: 'get_goal' }, stageNames, catalog)
  assert.ok(h.includes('get_goal [未解锁]（宿主·交付期：阶段 3 全量开放）'))
})

test('tools_help: runnable tool shows schema, locked tool shows unlock line', () => {
  const store = createMemoryPhaseStore()
  const ok = helpText(store, 's1', 'read', stageNames, catalog)
  assert.ok(ok.includes('工具: read [可调]'))
  assert.ok(ok.includes('描述: Read a UTF-8 text file and return line-numbered content.'))
  assert.ok(ok.includes('  file_path: string（必需） — Path to read'))
  assert.ok(!ok.includes('解锁阶段'))

  const locked = helpText(store, 's1', 'bash', stageNames, catalog)
  assert.ok(locked.includes('工具: bash [未解锁]'))
  assert.ok(locked.includes('解锁阶段: 3（当前调用会被拒绝'), 'unlock line present for a locked stage tool')

  const unknown = helpText(store, 's1', 'nope', stageNames, catalog)
  assert.ok(unknown.includes('未知工具: nope（先用 tools_catalog 查）'))
})

test('state persists and round-trips through an in-memory store', () => {
  const store = createMemoryPhaseStore()
  beginOnce(store, 's1', stageNames)
  advanceOne(store, 's1', stageNames, catalog, 'plan done')
  const snapshot = store.dump()
  assert.equal(snapshot.s1.stage, 1)
  assert.equal(snapshot.s1.guided, true)
  assert.equal(snapshot.s1.lastAdvance.reason, 'plan done')

  const revived = createMemoryPhaseStore(snapshot)
  assert.equal(revived.load('s1').stage, 1)
  assert.equal(revived.load('s1').guided, true)
  assert.equal(revived.load('s1').lastAdvance.reason, 'plan done')
  // the revived store stays authoritative for further advances
  assert.equal(advanceOne(revived, 's1', stageNames, catalog).record.stage, 2)
})

test('state persists and round-trips through a file-backed store (injected path)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wind-phase-'))
  const file = join(dir, 'phases.json')
  try {
    const first = createFilePhaseStore(file)
    beginOnce(first, 's2', stageNames)
    advanceOne(first, 's2', stageNames, catalog, 'memo')
    const second = createFilePhaseStore(file) // fresh instance, same file
    assert.equal(second.load('s2').stage, 1)
    assert.equal(second.load('s2').guided, true)
    assert.equal(second.load('s2').lastAdvance.reason, 'memo')
    assert.equal(second.load('missing'), undefined)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('registerPhaseTools registers exactly the four phase tools through ctx.effect', async () => {
  const registered = []
  const ctx = {
    tools: { register: (def) => { registered.push(def); return () => {} } },
    effect: (fn, label) => fn(),
  }
  const store = createMemoryPhaseStore()
  registerPhaseTools(ctx, { stateStore: store, catalog, stageNames })
  assert.deepEqual(registered.map((d) => d.name).sort(), ['phase_advance', 'phase_begin', 'tools_catalog', 'tools_help'])
  for (const def of registered) {
    assert.equal(def.output.schema.type, 'string')
    // execute only the read-only tools here; the mutating ones get explicit
    // begin → advance coverage below so they run on a well-defined stage
    if (def.name === 'tools_catalog' || def.name === 'tools_help') {
      const v = await def.execute({}, { agent: { session: { id: 's-smoke' } } })
      assert.equal(typeof v, 'string')
    }
  }
  const exec = { agent: { session: { id: 's-smoke' } } }
  const begin = registered.find((d) => d.name === 'phase_begin')
  const beginMsg = await begin.execute({}, exec)
  assert.ok(beginMsg.startsWith('session started: phase 0 (了解/对齐)'))
  const advance = registered.find((d) => d.name === 'phase_advance')
  const msg = await advance.execute({ reason: 'x' }, exec)
  assert.ok(msg.startsWith('advanced to phase 1: 拟合方案'))
})
