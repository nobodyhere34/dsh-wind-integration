/**
 * Ported routing-core pure logic tests (offline).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  classifyTask, bandOf, isFlashModel, extractText, advanceStage,
  personaForBand, buildGuide, buildDeclaration, buildStageText,
  applyPersona, windExtraSections, STAGES, autoAdvance, WIND_META_TOOLS,
} from '../lib/wind-core.js'

test('classifyTask: hit-counted spec/react bands, ambiguous → weak (upstream v34)', () => {
  assert.equal(classifyTask('请修复这个崩溃问题'), 0)
  assert.equal(classifyTask('重构这个系统的整体流程并优化性能'), 0)
  assert.equal(classifyTask('直接写一个网页出来，快点'), 1)
  assert.equal(classifyTask('写一个登录页面'), 1)
  // Tightened upstream rule: planning wording alone carries no class evidence.
  assert.equal(classifyTask('先给个计划'), 'weak')
  assert.equal(classifyTask('看看这个'), 'weak')
  assert.equal(classifyTask('hello'), 'weak')
  assert.equal(classifyTask(''), 'weak')
})

test('bandOf quantizes modes', () => {
  assert.equal(bandOf(0), 'spec')
  assert.equal(bandOf(0.3), 'mixed')
  assert.equal(bandOf(1), 'react')
  assert.equal(bandOf('weak'), 'weak')
  // Upstream parity: an absent mode clamps to 0 (spec region).
  assert.equal(bandOf(undefined), 'spec')
})

test('isFlashModel / extractText', () => {
  assert.equal(isFlashModel('DeepSeek-V4-Flash-0731'), true)
  assert.equal(isFlashModel('DeepSeek-V3'), false)
  assert.equal(extractText({ content: [{ type: 'text', text: '  fix it  ' }] }), 'fix it')
  assert.equal(extractText({ content: 'plain text' }), 'plain text')
  assert.equal(extractText(undefined), '')
})

test('personaForBand: weak flash gets the neutral classify-and-act persona', () => {
  const flashWeak = personaForBand('weak', 'DeepSeek-V4-Flash-0731')
  assert.ok(flashWeak.includes('build or fix') && flashWeak.includes('Think deeply'), flashWeak)
  assert.ok(flashWeak.includes('Do not run environment checks'), 'upstream flash anchors are kept verbatim')
  assert.ok(personaForBand('react', 'x').includes('do not build test harnesses'), 'upstream react persona is kept verbatim')
  assert.ok(personaForBand('react', 'DeepSeek-V4-Flash-0731').includes('hands-on'))
  assert.ok(personaForBand('spec', 'x').includes('software engineer'))
})

test('stage ladder: 4 stages with per-stage tools and goals', () => {
  assert.equal(STAGES.length, 4)
  const names = STAGES.map((s) => s.name)
  assert.ok(names[0].includes('了解'))
  assert.ok(names[1].includes('规划') || names[1].includes('拟合'))
  assert.ok(names[3].includes('验证'))
})

test('autoAdvance follows upstream v1.19 completion signals only', () => {
  assert.equal(autoAdvance(0, ['ask_user_question']), 1)
  assert.equal(autoAdvance(0, ['todo_write']), 1)
  assert.equal(autoAdvance(1, ['exit_plan_mode']), 2)
  assert.equal(autoAdvance(2, ['delivery_check']), 3)
  assert.equal(autoAdvance(2, ['bash']), 2, 'tool usage alone never advances')
  assert.equal(autoAdvance(3, ['delivery_check']), 3)
  assert.ok(WIND_META_TOOLS.includes('phase_begin') && WIND_META_TOOLS.includes('delivery_check'))
})

test('advanceStage transitions on tool/text evidence and never regresses', () => {
  assert.equal(advanceStage(0, ['todo_write'], ''), 1)
  assert.equal(advanceStage(0, [], '开始开发'), 1)
  assert.equal(advanceStage(0, [], '计划一下方案'), 0, 'planning wording no longer advances (upstream v34 tightening)')
  assert.equal(advanceStage(1, ['write'], ''), 2)
  assert.equal(advanceStage(2, [], '实现完成，开始验证'), 3)
  assert.equal(advanceStage(3, [], 'anything'), 3)
  assert.equal(advanceStage(1, [], '随口聊天'), 1)
})

test('guide text follows the upstream START_GUIDE and is band-aware', () => {
  const g = buildGuide('react', 'DeepSeek-V4-Flash-0731')
  assert.ok(g.includes('Bootstrap (once per session)') && g.includes('progressive tool-unlock'))
  assert.ok(g.includes('wind_status'))
  assert.ok(g.includes('Task classified as react'))
})

test('section builders produce the expected wind sections', () => {
  const extra = windExtraSections(0, 'weak', 'DeepSeek-V4-Flash-0731', false)
  assert.deepEqual(extra.map((s) => s.name), ['wind-stage', 'wind-decl'])
  assert.ok(buildStageText(0, 'DeepSeek-V4-Flash-0731', 'weak', false).includes('Current phase:'))
  assert.ok(buildStageText(0, 'x', 'weak', false).includes('Stage guide: Phase: understanding.'))
  assert.ok(buildStageText(3, 'x', 'react', true).includes('full catalog open'))
  assert.ok(buildDeclaration().includes('revealed in phases'))
})

test('applyPersona replaces the official persona section and adds wind-persona when absent', () => {
  const withOfficial = applyPersona([{ name: 'system-persona', text: 'old' }], 'new persona')
  assert.equal(withOfficial[0].text, 'new persona')
  assert.equal(withOfficial.length, 1)
  const minimal = applyPersona([{ name: 'placeholder', text: 'x' }], 'wind persona')
  assert.equal(minimal.length, 2)
  assert.equal(minimal[1].name, 'router-persona')
  assert.equal(minimal[1].text, 'wind persona')
})
