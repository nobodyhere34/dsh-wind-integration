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
  targetsItemTitle: '风插目标模型',
  targetsSummary: '已选 {count} 个目标模型；点击配置。',
  targetsTitle: '目标模型',
  legacyTitle: '老模型续跑',
  legacyDescription: '对勾选的老模型：本轮以纯文字进度汇报结束时自动续跑，并要求直接发出下一个工具调用。',
  legacyEnable: '启用老模型续跑',
  legacyMaxPerTurn: '每轮最多续跑次数',
  targetsDescription: '只有勾选的模型会启用风插行为；选项来自当前已导入的模型服务商。',
  targetsCatalogHint: '已选 {count} 个模型',
  targetsCatalogLoading: '正在读取模型目录…',
  targetsCatalogError: '模型目录读取失败，可稍后重试。',
  targetsEmpty: '当前没有可用的模型服务商，请先在设置中导入模型。',
  targetsStale: '已配置但当前目录未提供',
  targetsSave: '保存',
  targetsSaving: '保存中…',
  targetsDiscard: '放弃修改',
  targetsReadonly: '当前配置不可写（Host 未开启设置写入）。',
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
  targetsItemTitle: 'Wind target models',
  targetsSummary: '{count} target model(s) selected; open to configure.',
  targetsTitle: 'Target models',
  legacyTitle: 'Legacy continuation',
  legacyDescription: 'For checked legacy models: when a turn ends with a text-only progress report, steer it to make the next tool call instead of stopping.',
  legacyEnable: 'Enable legacy continuation',
  legacyMaxPerTurn: 'Max continuations per turn',
  targetsDescription: 'Wind behavior engages only for the checked models; options come from the imported model providers.',
  targetsCatalogHint: '{count} model(s) selected',
  targetsCatalogLoading: 'Reading the model catalogue…',
  targetsCatalogError: 'Model catalogue unavailable; retry later.',
  targetsEmpty: 'No model provider is available; import a provider first.',
  targetsStale: 'Configured but not advertised by the catalogue',
  targetsSave: 'Save',
  targetsSaving: 'Saving…',
  targetsDiscard: 'Discard',
  targetsReadonly: 'This configuration is not writable (Host settings writes are disabled).',
} as const

export type WindDict = typeof zh
export const dictionaries: Record<'zh' | 'en', WindDict> = { zh, en }
