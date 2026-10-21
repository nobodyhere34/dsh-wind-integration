/**
 * Model/preset/presentation gate tests (pure, offline).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { matchesTargetModel, isSkippedPreset, preservesTools, decideWind } from '../lib/wind-gate.js'

const config = {
  targetModels: ['DeepSeek-V4-Flash-0731'],
  matchV4Fallback: true,
  skipPresets: ['router-standard', 'router-spec', 'router-pro'],
  preservePresentationModes: ['ptc', 'both'],
  stageRestrict: true,
  guideEnabled: true,
  debugLog: false,
}

test('default target model matches exactly', () => {
  assert.equal(matchesTargetModel('DeepSeek-V4-Flash-0731', config), true)
})

test('fuzzy fallback: /v4/i and contains 0731', () => {
  assert.equal(matchesTargetModel('DeepSeek-V4-0731', config), true)      // no flash, but v4+0731
  assert.equal(matchesTargetModel('DeepSeek-V4-Flash-0730', config), false) // v4 but not 0731
  assert.equal(matchesTargetModel('DeepSeek-V3-0731', config), false)      // 0731 but no v4
  assert.equal(matchesTargetModel('gpt-4o', config), false)
  assert.equal(matchesTargetModel(undefined, config), false)
  assert.equal(matchesTargetModel('', config), false)
})

test('fuzzy fallback disabled keeps exact matching only', () => {
  const exactOnly = { ...config, matchV4Fallback: false }
  assert.equal(matchesTargetModel('DeepSeek-V4-0731', exactOnly), false)
  assert.equal(matchesTargetModel('DeepSeek-V4-Flash-0731', exactOnly), true)
})

test('strict allowlist: exactly 0731 and 0813pro, no other route', () => {
  const strict = { ...config, targetModels: ['DeepSeek-V4-Flash-0731', 'deepseek-v4-pro-0813'], matchV4Fallback: false }
  assert.equal(matchesTargetModel('DeepSeek-V4-Flash-0731', strict), true)
  assert.equal(matchesTargetModel('deepseek-v4-pro-0813', strict), true)
  for (const id of ['deepseek-flash', 'deepseek-v4.1-flash-1017', 'DeepSeek-V4.1-Flash', 'glm-5.3-flash', 'Qwen3.8-Flash-Next-NVFP4']) {
    assert.equal(matchesTargetModel(id, strict), false, id)
  }
})

test('skip presets are exact, case-insensitive, and never swipe unknown presets', () => {
  assert.equal(isSkippedPreset('router-standard', config), true)
  assert.equal(isSkippedPreset('Router-Standard', config), true)
  assert.equal(isSkippedPreset('router-spec', config), true)
  assert.equal(isSkippedPreset('router-pro', config), true)
  assert.equal(isSkippedPreset('prefab-anchored-standard', config), false)
  assert.equal(isSkippedPreset(undefined, config), false)
})

test('ptc/both presentations preserve tools', () => {
  assert.equal(preservesTools('ptc', config), true)
  assert.equal(preservesTools('both', config), true)
  assert.equal(preservesTools('native', config), false)
  assert.equal(preservesTools(undefined, config), false)
})

test('decision: 0731 + standard preset + native → active with restrict', () => {
  const d = decideWind({ modelId: 'DeepSeek-V4-Flash-0731', presetId: 'prefab-anchored-standard', presentation: 'native' }, config)
  assert.deepEqual(d, { active: true, restrict: true, modelMatched: true })
})

test('decision: 0731 + standard + ptc → active, NO restrict', () => {
  const d = decideWind({ modelId: 'DeepSeek-V4-Flash-0731', presetId: 'prefab-anchored-standard', presentation: 'ptc' }, config)
  assert.deepEqual(d, { active: true, restrict: false, modelMatched: true })
})

test('decision: 0731 + router-standard (wind-native preset) → skipped, no overlay', () => {
  const d = decideWind({ modelId: 'DeepSeek-V4-Flash-0731', presetId: 'router-standard', presentation: 'native' }, config)
  assert.equal(d.active, false)
  assert.equal(d.skipReason, 'preset')
})

test('decision: non-0731 + standard → inactive (model gate)', () => {
  const d = decideWind({ modelId: 'DeepSeek-V3', presetId: 'prefab-anchored-standard', presentation: 'native' }, config)
  assert.equal(d.active, false)
  assert.equal(d.skipReason, 'model')
  assert.equal(d.restrict, false)
})
