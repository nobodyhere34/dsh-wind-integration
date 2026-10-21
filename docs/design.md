# dsh-wind-integration 设计说明

（对 lead 的 30 行设计，已批准；本文件为落地细节追记。）

## 目标
在 DSH web（端口 3080 不动）运行时注入一个 Cordis 原生插件：选中模型 `DeepSeek-V4-Flash-0731`（provider aside-gateway-srd）后，**任意预设** 下自动激活风插（router-standard）行为；非 0731 模型零接触；ptc 等非 native 呈现只加行为、不 restrict。

## 关键机制（对应 lead 七条细化）
1. **宿主侧 ctx.on 注册**：system-prompt/assemble、agent/inbox/claimed、agent/pre-step、agent/status——不依赖任何预设挂载，注入即生效。
2. **模型门控**：精确 id 优先；模糊回退 /v4/i && (含 0731 || (flash && 含 0731))。真实命中值取装配 variables.model（官方 installModelSelection 同一字面量）。
3. **skipPresets**：composedPreset(agent.ctx) → preset 定义 id（如 prefab-anchored-standard / router-standard）；命中风插原生预设（router-standard/spec/pro）整体跳过。
4. **PTC 边界**：presentationOf(agent)（tools.modeFor）∈ preservePresentationModes → 决策 restrict=false；装配仍注入 persona/阶段段/宣言，引导仍注入，但不 restrict、不触碰 run_code/PTC 工具。
5. **测试**：node:test 纯函数核心覆盖验收三案（见 tests/wind-apply.test.mjs）。
6. **近场引导一次**：sessionId+guided 守卫，首步（step=1 且含用户消息）在 pre-step 决策的 messages 尾部追加一条 `source.kind='plugin'` 用户消息——官方安装模型选择通知同款同请求模式，零额外 API 调用，二次触发返回同一引用（不叠加）。
7. **无 harness 改动**：全部代码在 /media/ict/19BD52556106DE5A/dsh-wind-integration；注入走 dev_inject_plugin。

## 阶段披露（native 呈现）
STAGES 移植 router-standard（四档 + per-stage 工具）；restrict.allow = 当前档工具 ∪ 全局安全（GLOBAL_SAFE 交集 restrictableNames）+ wind_status；每档换发前释放旧 disposer；第 4 档放开；代理终止释放。前进证据 = 会话事件工具名 ∪ 上一步消息工具名 ∪ 用户文本信号（advanceStage 移植）。

## 已验证事实（研究期）
- 真实预设（~/.dsh/.agent-presets）无任何模型引用 → 模型唯一来自 agent-default-model / 装配 variables.model。
- runner 运行时 Agent/Context 接口、事件 payload、composedPreset、tools.modeFor/view/restrict、模型选择追加模式（model-selection.ts）、client locale API 均已读源码确认。
- super-injector 通道可用（dev_plugin_status 观察 75 成功注入/2 失败样例），构建模板来自其脚手架（junction 链接 + checkout tsc）。

## v1 状态灯（sidebar.footer.action）布线（2026-10-10 追记）
- 宿主路由：src/index.ts 注册 GET /wind/status 精确路由，返回实时 JSON（plugin/version/active/targetModels/latest{stage,stageTotal,guided,restrictApplied,injectedAssemblies}）。webServer 服务不得写入 inject（注入 fiber 激活会等待不可见服务而挂死宿主 agent-loop 钩子）——用 ctx.get('webServer') 惰性解析，服务缺失时注册空操作降级。
- 客户端：client/index.tsx（name dsh-wind-client，inject ['slots','locale']）向 sidebar.footer.action（order 200，id wind-status，locale wind）注册 WindStatusCard；同源轮询 /wind/status。窄 rail 态 8px 圆点（currentColor 继承，active 不透明度 1/0.35）；宽态 13px 标题 + 明细行。
- 构建：scripts/build-client.mjs = esbuild iife（external react/react-jsx-runtime）+ window.__ModuleLoader__.load({id,factory}) 经典脚本封装；exports["./client"]（types+default）+ dsh.client.platform 'web' 与官方目录选择器包同形。
- 测试：tests/wind-apply.test.mjs 两处 V4 source 断言随 session-format 迁移更新（kind:'plugin'+.plugin → kind:'plugin:dsh-wind-integration'），22/22 绿。
- 已知通道限制（v1 未闭环）：运行时注入的 client 行未进入宿主 ClientModuleRegistry 组合表——以精确 rev 探测 /plugins/??<id>/client.js&rev=<rev>，官方行（ui-directory-picker-native）200、wind 行 404；注入器自报 cm=yes clientPath=undefined（client ✗）。根因方向：注入器在自有 loader 上建 fiber，宿主 client-modules 的 internal/plugin→processOne(entryName) 组合路径取不到该 entry（或无 baseUrl）→ 行不落表 → 页面刷新后状态灯不出现。宿主行为与 /wind/status 不受影响（已实测 HTTP 200 实时 JSON）。
- 后续闭环：注入器把 client 行桥接进宿主 ClientModuleRegistry（或走 profile bundles 正式装配路径）；届时若 Node 侧 import 客户端包，需在 factory 外加 typeof window 守卫。

## 审计修正（2026-10-16）
- **引导消息 id**：guideMessage 此前手写字面量缺 `id`，宿主按原样落盘为 user/message，重载时 `assertMessageEventShape` 拒绝 → 会话历史不可加载（已实测损坏 session-43e4d347）。现 `randomUUID()` 铸造 id；tests/wind-apply.test.mjs 增加 uuid 回归断言，并以宿主 `adoptSessionEvent` 端到端验证通过。
- **阶段推进证据源**：`sessionEventToolNames` 原读 `ev.payload`（宿主事件载荷字段是 `data`），`toolNamesFromMessages` 原读 `tool_use`/`tool_result`（宿主块判别名是 `tool-call`）——两通道此前恒返回空，阶段前进只剩文本关键词兜底。已改为 `ev.data.name` 与 `type === 'tool-call'`。注意：pre-step `messages` 是 inbox 声明消息（user/steering），工具调用证据实际只来自会话事件通道。
- **client 行桥接回退**：删除 `bridgeClientRow`（戳 `loader.entries()` 的 tree baseUrl、`clientModules.processOne/compose/notifyGraphChanged`、私有 `pkgMeta` 缓存）。宿主私有面随版本漂移即碎，回到上文 v1 已知限制；桥接归属注入器/正式装配路径，不属本插件。client/ 模板保留未挂载。
- **enable 覆盖回收**：`wind-enable.json` 不再只增不减——按插入序封顶 1000 条驱逐最旧；选择在代理停止后仍需跨重启存活，故不随 dispose 删除。
