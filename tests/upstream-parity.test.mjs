/**
 * Upstream parity suite: runs yjh051108/dsh-routing-suite's own router-core v34
 * assertions against this port, plus a direct module-to-module matrix.
 * The vendored fixture is unmodified MIT source for that purpose only.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import * as up from './fixtures/upstream-router-core-v34.mjs'
import {
  personaFor, bandFor, coreFor, testinessFor, parseMode, classifyTask,
  sessionMode, extractText, applyPersona, advanceStage, isFlashModel,
} from '../lib/wind-core.js'

const MODES = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.99, 1, 'weak', undefined]
const MODELS = ['deepseek-v4-pro', 'deepseek-v4-flash', 'DeepSeek-V4-Flash-0731', undefined]

test('parity: personaFor over the full mode × model matrix', () => {
  for (const mode of MODES) for (const model of MODELS) {
    assert.equal(personaFor(mode, model), up.personaFor(mode, model), 'mode=' + String(mode) + ' model=' + String(model))
  }
})

test('parity: bandFor / testinessFor / coreFor', () => {
  for (const mode of MODES) {
    assert.equal(bandFor(mode), up.bandFor(mode))
    assert.equal(testinessFor(mode), up.testinessFor(mode))
    assert.deepEqual(coreFor(mode), up.coreFor(mode))
  }
})

test('parity: classifyTask on the upstream case list', () => {
  const cases = [
    '需要本地开发一个马里奥网页小游戏，参考经典原版',
    '帮我写一个 Python 脚本处理 CSV',
    '从零搭建一个网站',
    '修复这个仓库里的 bug',
    '为什么登录一直报错，帮我排查',
    '帮我开发一个小游戏然后修复里面的 bug',
    '开发并修复',
    '今天天气怎么样',
    'hello',
    '',
  ]
  for (const text of cases) assert.equal(classifyTask(text), up.classifyTask(text), text)
})

test('parity: parseMode on the upstream token list', () => {
  for (const token of ['weak', 'router', 'spec', 'spec-lean', 'balanced', 'mixed', 'react', 'react-lean', '70', '0.3', 'auto', 'nonsense']) {
    assert.equal(parseMode(token), up.parseMode(token), token)
  }
})

test('parity: applyPersona removes every persona section and appends router-persona', () => {
  const sections = [
    { name: 'harness-identity', text: 'x', order: -100 },
    { name: 'persona', text: 'old persona', order: 0 },
    { name: 'plan-mode', text: 'You are in plan mode.', order: -50 },
    { name: 'tool-guidance', text: 'y', order: 100 },
  ]
  assert.deepEqual(applyPersona(sections, 'new persona'), up.applyPersona(sections, 'new persona'))
  assert.deepEqual(applyPersona([], 'p'), up.applyPersona([], 'p'))
})

test('parity: advanceStage on upstream evidence cases', () => {
  const cases = [
    [0, [], '开始开发'], [0, [], '计划一下方案'], [0, ['todo_write'], ''],
    [1, ['write'], ''], [1, [], '随口聊天'], [2, ['bash'], ''], [2, [], '验证'],
  ]
  for (const [stage, tools, text] of cases) assert.equal(advanceStage(stage, tools, text), up.advanceStage(stage, tools, text))
})

test('upstream test: issue #1 nested user/message shape still classifies', () => {
  const nested = { message: { kind: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: '把目录里的内容内化成 DSH 插件并构建注入' }] } }
  assert.match(extractText(nested), /内化成/)
  assert.equal(bandFor(classifyTask(extractText(nested))), 'react')
  const flat = { kind: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: '修复这个仓库里的 bug' }] }
  assert.equal(extractText(flat), '修复这个仓库里的 bug')
  assert.equal(bandFor(classifyTask(extractText(flat))), 'spec')
  assert.equal(sessionMode({ events: [{ type: 'user/message', data: nested }] }), 1)
})

test('upstream test: issue #13 sessionMode skips plugin-origin messages', () => {
  const buildTask = { kind: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: '从零开发一个马里奥网页游戏' }] }
  const approval = { kind: 'user', source: { kind: 'plugin', plugin: 'user-approval' }, content: [{ type: 'text', text: 'The approval policy changed from "ask" to "never"' }] }
  const snapshot = { kind: 'user', source: { kind: 'plugin', plugin: 'runtime-context' }, content: [{ type: 'text', text: 'cwd snapshot' }] }
  const guide = { id: 'router-guide-x', kind: 'user', source: { kind: 'plugin', plugin: 'router-bootstrap' }, content: [{ type: 'text', text: 'Router: classify this task now' }] }
  assert.equal(sessionMode({ events: [
    { type: 'user/message', data: approval },
    { type: 'user/message', data: snapshot },
    { type: 'user/message', data: guide },
    { type: 'user/message', data: buildTask },
  ] }), 1)
  assert.equal(sessionMode({ events: [{ type: 'user/message', data: approval }] }), 'weak')
  const legacy = { kind: 'user', content: [{ type: 'text', text: '修复这个仓库里的 bug' }] }
  assert.equal(sessionMode({ events: [{ type: 'user/message', data: legacy }] }), 0)
})

test('upstream test: weak persona is model-specific and flash anchors survive', () => {
  const pro = personaFor('weak', 'deepseek-v4-pro')
  const flash = personaFor('weak', 'deepseek-v4-flash')
  assert.ok(pro.includes('decide the task type (build or fix)'))
  assert.ok(!pro.includes('review what you have already done'))
  assert.ok(flash.includes('review what you have already done'))
  assert.notEqual(pro, flash)
  assert.equal(isFlashModel('deepseek-v4-flash'), true)
  assert.equal(isFlashModel('deepseek-v4-pro'), false)
})

test('upstream test: band mapping matches the measured phase transition', () => {
  assert.equal(bandFor(0.1), 'spec')
  assert.equal(bandFor(0.2), 'mixed')
  assert.equal(bandFor(0.4), 'mixed')
  assert.equal(bandFor(0.5), 'react')
  assert.equal(bandFor(0.99), 'react')
})
