/**
 * Lead's acceptance cases against the real assembly/guide transforms:
 *   1) 0731 + standard → wind behavior active (sections + guide injected)
 *   2) non-0731 + standard → completely untouched (injection count 0)
 *   3) 0731 + ptc → persona + guide, but NO restrict
 * Runs on the built lib with plain node:test — no cordis, no host services.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { WindRuntime } from '../lib/wind-state.js'
import { transformAssembly, maybeGuided, recordUserMessage } from '../lib/wind-apply.js'

const config = {
  targetModels: ['DeepSeek-V4-Flash-0731'],
  matchV4Fallback: true,
  skipPresets: ['router-standard', 'router-spec', 'router-pro'],
  preservePresentationModes: ['ptc', 'both'],
  stageRestrict: true,
  guideEnabled: true,
  debugLog: false,
}

const assembly = {
  sections: [{ name: 'system-persona', text: 'official persona', order: 0 }],
  tools: [{ name: 'read' }, { name: 'run_code' }],
  variables: { model: 'DeepSeek-V4-Flash-0731', provider: 'aside-gateway-srd' },
}

const enterDecision = {
  kind: 'enter',
  messages: [{ role: 'user', content: [{ type: 'text', text: 'hello' }], source: { kind: 'user' } }],
}

test('CASE 1 — 0731 + standard → wind active (sections + once-only guide)', () => {
  const runtime = new WindRuntime()
  // inbox/claimed classify step
  recordUserMessage(runtime, 's1', '直接写一个网页')
  const { assembled, decision } = transformAssembly(assembly, {
    sid: 's1', modelId: 'DeepSeek-V4-Flash-0731', presetId: 'prefab-anchored-standard', presentation: 'native',
  }, config, runtime)
  assert.equal(decision.active, true)
  assert.equal(decision.restrict, true)
  const names = assembled.sections.map((s) => s.name)
  assert.ok(names.includes('wind-stage') && names.includes('wind-decl'))
  const persona = assembled.sections.find((s) => s.name === 'system-persona')
  assert.ok(persona.text.startsWith('You are a') && persona.text !== 'official persona')
  assert.equal(runtime.get('s1').injectedAssemblies, 1)

  // guide: first pre-step injects exactly one message
  const out1 = maybeGuided(enterDecision, {
    sid: 's1', modelId: 'DeepSeek-V4-Flash-0731', presetId: 'prefab-anchored-standard', presentation: 'native',
    step: 1, hasUserMessage: true, mode: runtime.get('s1').mode,
  }, config, runtime)
  assert.equal(out1.messages.length, enterDecision.messages.length + 1)
  const guide = out1.messages.at(-1)
  assert.equal(guide.role, 'user')
  assert.equal(guide.source.kind, 'plugin:dsh-wind-integration')
  assert.ok(guide.content[0].text.includes('[wind routing]'))
  // V4 reload validates every message event's id (assertMessageEventShape);
  // an idless injected message corrupts the session log on the next load.
  assert.match(guide.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)

  // second pre-step: guided guard returns the exact passed-in decision (no stacking)
  const entered2 = { ...enterDecision }
  const again = maybeGuided(entered2, {
    sid: 's1', modelId: 'DeepSeek-V4-Flash-0731', presetId: 'prefab-anchored-standard', presentation: 'native',
    step: 1, hasUserMessage: true, mode: runtime.get('s1').mode,
  }, config, runtime)
  assert.equal(again, entered2, 'repeat call returns the input decision untouched')
  assert.equal(again.messages.length, enterDecision.messages.length, 'no message stacked on repeat')
  assert.equal(runtime.get('s1').injectedAssemblies, 1, 'assembly count still 1')
})

test('CASE 2 — non-0731 + standard → completely untouched (injection count 0)', () => {
  const runtime = new WindRuntime()
  const other = { ...assembly, variables: { model: 'DeepSeek-V3', provider: 'aside-gateway-srd' } }
  const { assembled, decision } = transformAssembly(other, {
    sid: 's2', modelId: 'DeepSeek-V3', presetId: 'prefab-anchored-standard', presentation: 'native',
  }, config, runtime)
  assert.equal(decision.active, false)
  assert.equal(assembled, other, 'same object reference — zero touch')
  assert.equal(assembled.sections.length, 1)
  assert.equal(assembled.sections[0].name, 'system-persona')
  assert.equal(runtime.get('s2'), undefined, 'no session state allocated — injection count is structurally zero')

  const out = maybeGuided(enterDecision, {
    sid: 's2', modelId: 'DeepSeek-V3', presetId: 'prefab-anchored-standard', presentation: 'native',
    step: 1, hasUserMessage: true,
  }, config, runtime)
  assert.equal(out, enterDecision, 'guide untouched for non-target model')
  assert.equal(runtime.get('s2'), undefined, 'guide path also allocates nothing')
})

test('CASE 3 — 0731 + ptc → persona + guide but NO restrict', () => {
  const runtime = new WindRuntime()
  recordUserMessage(runtime, 's3', '写一个登录页面')
  const { assembled, decision } = transformAssembly(assembly, {
    sid: 's3', modelId: 'DeepSeek-V4-Flash-0731', presetId: 'prefab-anchored-standard', presentation: 'ptc',
  }, config, runtime)
  assert.equal(decision.active, true)
  assert.equal(decision.restrict, false, 'PTC must never restrict')
  const names = assembled.sections.map((s) => s.name)
  assert.ok(names.includes('wind-stage') && names.includes('wind-decl'))
  assert.equal(assembled.sections.find((s) => s.name === 'wind-stage').text.includes('[full catalog open]'), true,
    'staged-disclosure text reports full catalog when tools are preserved')

  const out = maybeGuided(enterDecision, {
    sid: 's3', modelId: 'DeepSeek-V4-Flash-0731', presetId: 'prefab-anchored-standard', presentation: 'ptc',
    step: 1, hasUserMessage: true, mode: runtime.get('s3').mode,
  }, config, runtime)
  assert.equal(out.messages.length, enterDecision.messages.length + 1)
  // rejected decisions never gain guidance
  const rejected = maybeGuided({ kind: 'reject', messages: [] }, {
    sid: 's3', modelId: 'DeepSeek-V4-Flash-0731', presetId: 'prefab-anchored-standard', presentation: 'ptc',
    step: 1, hasUserMessage: true,
  }, config, runtime)
  assert.equal(rejected.kind, 'reject')
})

test('wind-native preset overlay is skipped end-to-end (guide too)', () => {
  const runtime = new WindRuntime()
  const { assembled, decision } = transformAssembly(assembly, {
    sid: 's4', modelId: 'DeepSeek-V4-Flash-0731', presetId: 'router-standard', presentation: 'native',
  }, config, runtime)
  assert.equal(decision.active, false)
  assert.equal(assembled, assembly, 'wind-native preset: no double write')
  const out = maybeGuided(enterDecision, {
    sid: 's4', modelId: 'DeepSeek-V4-Flash-0731', presetId: 'router-standard', presentation: 'native',
    step: 1, hasUserMessage: true,
  }, config, runtime)
  assert.equal(out, enterDecision)
  assert.equal(runtime.size(), 0, 'inactive paths never create session state')
})

test('CASE 5 — 0731 + standard + session override off → untouched; re-enable restores gate', () => {
  const runtime = new WindRuntime()
  runtime.setEnabled('s5', false)
  recordUserMessage(runtime, 's5', '直接写一个网页')
  const { assembled, decision } = transformAssembly(assembly, {
    sid: 's5', modelId: 'DeepSeek-V4-Flash-0731', presetId: 'prefab-anchored-standard', presentation: 'native',
  }, config, runtime)
  assert.equal(decision.active, false)
  assert.equal(decision.skipReason, 'session')
  assert.equal(assembled, assembly, 'disabled session returns the input assembly untouched')
  assert.equal(assembled.sections.length, 1, 'no wind sections added')
  assert.equal(runtime.get('s5').injectedAssemblies, 0)

  const out = maybeGuided(enterDecision, {
    sid: 's5', modelId: 'DeepSeek-V4-Flash-0731', presetId: 'prefab-anchored-standard', presentation: 'native',
    step: 1, hasUserMessage: true, mode: runtime.get('s5').mode,
  }, config, runtime)
  assert.equal(out, enterDecision, 'disabled session returns the pre-step decision untouched')

  runtime.setEnabled('s5', true)
  assert.equal(runtime.enabled('s5'), true, 're-enable restores the model-gate default')
  const again = transformAssembly(assembly, {
    sid: 's5', modelId: 'DeepSeek-V4-Flash-0731', presetId: 'prefab-anchored-standard', presentation: 'native',
  }, config, runtime)
  assert.equal(again.decision.active, true)
})
