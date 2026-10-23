/**
 * Legacy continuation decisions (pure, offline).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  matchesLegacyModel, openTodoCount, lastAssistantOfTurn, looksUnfinished, shouldContinue,
} from '../lib/continuation.js'

const policy = { enabled: true, models: ['deepseek-chat*', 'qwen*'], maxPerTurn: 2, prompt: 'continue' }

test('matchesLegacyModel: substring and wildcard patterns', () => {
  assert.equal(matchesLegacyModel('deepseek-chat-v3', policy.models), true)
  assert.equal(matchesLegacyModel('Qwen2.5-72B', policy.models), true)
  assert.equal(matchesLegacyModel('DeepSeek-V4-Flash-0731', policy.models), false)
  assert.equal(matchesLegacyModel(undefined, policy.models), false)
  assert.equal(matchesLegacyModel('x', ['']), false)
})

test('openTodoCount: newest todo/write wins, pending and in_progress count', () => {
  const events = [
    { type: 'todo/write', data: { todos: [{ status: 'pending' }, { status: 'pending' }] } },
    { type: 'todo/write', data: { todos: [{ status: 'completed' }, { status: 'in_progress' }] } },
  ]
  assert.equal(openTodoCount(events), 1)
  assert.equal(openTodoCount([]), 0)
})

test('lastAssistantOfTurn: last message of the turn, tool calls counted', () => {
  const events = [
    { type: 'assistant/message', data: { turn: 2, message: { content: [{ type: 'text', text: 'old' }] } } },
    { type: 'assistant/message', data: { turn: 3, message: { content: [{ type: 'text', text: 'next I will ' }] } } },
    { type: 'assistant/message', data: { turn: 3, message: { content: [{ type: 'tool-call' }] } } },
  ]
  assert.deepEqual(lastAssistantOfTurn(events, 3), { text: '', toolCalls: 1 })
  assert.equal(lastAssistantOfTurn(events, 9), undefined)
})

test('looksUnfinished: questions and final answers do not continue; cues and open work do', () => {
  assert.equal(looksUnfinished('Now I will:', 0), true)
  assert.equal(looksUnfinished('接下来我会检查配置', 0), true)
  assert.equal(looksUnfinished('Done. All checks passed.', 0), false)
  assert.equal(looksUnfinished('Which file should I edit?', 0), false)
  assert.equal(looksUnfinished('', 2), false)
  assert.equal(looksUnfinished('Anything at all', 1), true)
})

test('shouldContinue: gating order and reasons', () => {
  const last = { text: 'Next I will check the logs', toolCalls: 0 }
  assert.equal(shouldContinue({ modelId: 'deepseek-chat-v3', last, openTodos: 0 }, policy).continue, true)
  assert.equal(shouldContinue({ modelId: 'deepseek-v4', last, openTodos: 0 }, policy).reason, 'model')
  assert.equal(shouldContinue({ modelId: 'deepseek-chat-v3', last, openTodos: 0 }, { ...policy, enabled: false }).reason, 'disabled')
  assert.equal(shouldContinue({ modelId: 'deepseek-chat-v3', last: { text: 'x', toolCalls: 1 }, openTodos: 0 }, policy).reason, 'tools')
  assert.equal(shouldContinue({ modelId: 'deepseek-chat-v3', last: { text: '', toolCalls: 0 }, openTodos: 0 }, policy).reason, 'empty')
  assert.equal(shouldContinue({ modelId: 'deepseek-chat-v3', last: { text: 'Done.', toolCalls: 0 }, openTodos: 0 }, policy).reason, 'finished')
  assert.equal(shouldContinue({ modelId: 'deepseek-chat-v3', last, openTodos: 1 }, policy).continue, true)
})
