/**
 * Wind integration client copy — locale-owned dictionaries (zh is the source
 * of truth, en mirrors every key), per the DSH client i18n discipline.
 *
 * v1 registers the `wind` namespace through the client locale service and
 * renders the Models-page status card from these keys. Every product-visible
 * string lives here; the card never hardcodes copy.
 */
export const zh = {
  statusTitle: '风插集成（ds v4 0731）',
  statusActive: '已生效：{model}',
  statusInactive: '未生效（模型不匹配：{model}）',
  statusIdle: '未生效（暂无活动会话）',
  statusDisabled: '本会话已手动停用：{model}',
  statusEnded: '已结束：{model}',
  statusModelUnknown: '未生效（模型未知）',
  statusPresetSkipped: '跳过叠加：该预设已是风插原生呈现（{preset}）',
  statusPreserveTools: '仅行为注入：当前呈现模式不接管工具（{presentation}）',
  statusStage: '当前阶段：{stage}',
  statusBand: '任务带：{band}',
  statusGuided: '近场引导：已注入',
  statusRestricted: '工具披露：阶段性收窄',
  windToggle: '风插（当前会话）',
  accountLabel: '风插集成',
} as const

export const en = {
  statusTitle: 'Wind integration (ds v4 0731)',
  statusActive: 'Active: {model}',
  statusInactive: 'Inactive (model mismatch: {model})',
  statusPresetSkipped: 'Overlay skipped: preset already wind-native ({preset})',
  statusPreserveTools: 'Behavior only: presentation mode keeps tool control ({presentation})',
  statusStage: 'Current stage: {stage}',
  statusBand: 'Task band: {band}',
  statusGuided: 'Near-field guide: injected',
  statusRestricted: 'Tool disclosure: staged',
  windToggle: 'Wind (this session)',
  accountLabel: 'Wind integration',
} as const

export type WindDict = typeof zh
export const dictionaries: Record<'zh' | 'en', WindDict> = { zh, en }
