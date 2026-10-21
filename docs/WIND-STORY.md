# 风插（dsh-wind-integration）产品与工程叙事

> 一句话定位：风插是把 dsh-routing-suite 的 router-standard 路由器行为，按模型门控叠加进任意预设的运行时集成——选中 DeepSeek-V4-Flash-0731（默认）或 deepseek-v4-pro-0813 时，会话自动获得 band persona、四档工具披露、近场引导与持久宣言；其余模型零接触。本文按"问题 → 价值 → 机制 → 证据 → 产品 → 边界 → 结语"七节讲清它为什么存在、如何工作、凭什么可信。

命名：wind 取"风/路由"意象，指模型在同一模型上按任务切换工作风格的时机；行为本体来自上游 router-standard 预设，插件只在选中的模型/预设上叠加，不编辑预设文件、不引入新的承载服务（仅 ctx.on / ctx.effect）。

## 一、问题：react–spec 行为轴与"一个模型、两种工作风格"

DeepSeek V4 在 persona 轴上的行为不是连续渐变，而是"相变"：上游 router-standard 的 21 点 × n=2 探针（router-core-v34 头注与 docs/experiments.md §C）测得，同一模型沿 react↔spec 轴坍缩成三个稳定区——spec 稳定区 [0, 0.15]、过渡带 [0.2, 0.45]（不稳定混合，规避）、react 稳定区 [0.5, 1.0]（11 个内插模式值行为一致）；"连续调参"在模型层是错觉，数值界面必须量化到 band。

同一个模型可以同时是两种工作风格：上游任务–轨迹分数里，同一模型在维护型任务（Project2）的 spec 条件（minimal 99/96、anchored-standard 98/99）与新建型任务（Mario 网页游戏）的 react/code 条件（10/10）都拿最高分，而模式给错时分别只有 91 与 6——约 10 分摆动，上游称之为"god/ghost duality"（preset/README.md）。

但模型不能自己路由：P3（固定 persona、换任务，轨迹不变）、P5（router 指令本身落入 react 吸引子，无任务区分）、P8（领域扫描只有 weak persona 区存在内部路由窗口，且是"lean"不是翻转）证明，自路由只在弱 persona 加 few-shot 路由指令时以 +2.3..+3.3 的弱区分度存在（docs/experiments.md §I）；"给模型一个人格让它自己判断任务类型"这条路被实测否决。

弱 persona 是模型相关的：P11/P24 实测 pro 的最优弱 persona 是"spec 句 + few-shot 路由指令"（w6，+5.00 区分度），flash 的最优弱 persona 是"中性 + 显式 classify-then-act"（w7，+5.67 区分度）；而 spec 句弱 persona 在 flash 上反路由（router-core-v34 头注，planGreen > 0）。

模型还有方向性差异：P8-Flash 显示 flash 没有 pro 的"竞争陷阱"（pro 的 mixed 竞争带区分度 0.00，flash 却达 +3.00），weak-persona 路由在 flash 上约为 pro 的 1.5–2 倍强；但 spec 侧反路由两个模型都有——规格化 persona 会把新建任务推回计划集体流（experiments.md §K）。

结论：风格选择必须由外部代码（分类器）做，而不是交给提示词；分类证据来自任务文本的命中计数，模糊就退回 weak 让模型按任务自路由——这正是 router-core-v34 classifyTask 的语义，也是风插移植的第一块砖。

## 二、价值：路由不是换提示词

路由不是"换一套提示词"：上游 trigger matrix（experiments.md §A）显示 persona 是轨迹的主触发、工具面是次要条件、目录文本无效果——改行为要改 persona 与工具面，而不是往消息里塞说明；风插的装配正是同时动这两处。

省 token：近场引导与用户消息同请求注入（agent/pre-step 的 decision.messages 尾部），每会话一次、零额外 API 调用——上游旧通道（事件后置追加）实测每用户消息强制产生第二次模型请求（2× API 尖峰），v0.3.0 起才修掉（preset/README.md）；风插从第一天就走同请求通道，并且只注入一次。

省 round trip：persona、wind-stage 阶段段、wind-decl 宣言随 system prompt 装配进同一请求；持久宣言与阶段段经压缩不丢（上游 v1.13 起的持久化 section 设计），不需要每轮重注入。

省返工：band 选对即轨迹选对——P9 复杂任务（购物车 10 断言）里 react 收敛中位数 2 轮 vs 其他 3–4 轮（experiments.md §J）；模式给错是 10 分级别（Mario 10 vs 6），且错误 band 不是"略差"而是反路由（spec persona 做新建任务更计划化，实测 6/10）。

省仪式：阶段化工具披露让首轮只需 read/glob/grep/web_search/ask_user_question，而不是面对全量目录做"该用哪个"的决策；上游 v1.20 起预解锁归零、窗口只含当前档（windowFor = stage+1），因为"知道后面还有工具"本身制造焦虑与大跃进入口——风插四档沿用同一口径。

可被测试度量：与上游的等价性由 parity 套件逐函数断言（见第四节），不是"感觉上差不多"；验收三案直接对着真实装配/引导变换断言。

省的不止执行成本，还有注意力预算：STAGE_GUIDES 常驻 stageText、经压缩不丢，模型每轮只需扫当前档，不必在无关工具描述里检索——这延续上游 v1.18 的口径（默认只列当前阶段可调工具、未解锁一律不点名），是显式的注意力分配而不是信息删减。

band 还管测试仪式：coreFor/testinessFor 让 react band 压住测试（新建任务不一上来就在脚手架与测试仪式上空转），spec/mixed 保留测试面（修 bug 需要验证）；同一介入点在"少 ceremony"与"保验证"之间按 band 摆位。

## 三、机制：classifyTask → band → persona，每一层为什么存在

数据流：classifyTask(text) → mode（0 / 0.3 / 1 / 字符串 weak）→ bandOf(mode) → band（spec / mixed / react / weak）→ personaForBand(band, modelId) 装进 system prompt；同一 mode 还决定 coreFor（首轮核心工具面）与 testinessFor（测试抑制强度）。

分类器（源自 router-core-v34，语义逐函数等价）：REACT_RE 与 SPEC_RE 命中计数比较，react > spec → 1，spec > react → 0，相等/无命中 → 'weak'；是命中计数不是首匹配，单个关键词不会翻盘；"先给个计划"这类规划措辞无分类证据（上游 v34 收紧，移除 /方案|计划/ 推进信号）。

为什么要 band 量化而不是直接出 persona：测得的是三个稳定区，模式值在区内的具体数值无行为差；bandOf 把 [0.2, 0.5) 归为 mixed（过渡带中心 0.3），过渡带从不被自动选中——它只在用户显式要求时才出现。

为什么弱 persona 分模型：spec 句弱 persona 在 flash 上反路由，flash 的最优弱 persona 是中性的 classify-then-act + recall/converge/anti-runaway 锚点（P11/P23：锚点把单任务完成率提到 100%）；isFlashModel(modelId) 做分支，pro 走 spec 句 + 分类指令（w6c，P24）。

四档工具阶梯（仅在 native 呈现下执行）：了解/对齐（read/glob/grep/web_search/ask_user_question）→ 拟合方案（todo_write/exit_plan_mode）→ 开发（write/edit/str_replace_editor）→ 验证（bash/pwsh/read_image/job_list/job_output/job_kill）；第 4 档视为交付档，restrict 释放为全量目录。

restrict 执行：applyStageRestrict 用 tools.restrict({ allow }) 只放当前档工具 ∪ 全局安全（WIND_GLOBAL_SAFE ∩ restrictableNames）+ wind_status；换档先释放旧 disposer 再装新档；代理终止（agent/status stopped/disposed/error）释放并标记 stopped；第 3 档起不再 restrict。

为什么 restrict 只发生在 native 呈现：ptc/both 是宿主自己的工具调度面（run_code/PTC 工具），叠加 restrict 会破坏这些预设的工具契约（preservePresentationModes 默认 ['ptc','both']）；风插对它们的贡献只有 persona + 引导 + 阶段段，wind-stage 文案标注 full catalog open（验收 CASE 3）。

模型门控：decideWind 严格白名单（默认 DeepSeek-V4-Flash-0731 与 deepseek-v4-pro-0813），精确 id 优先，/v4/i 且含 0731 的模糊回退默认关闭；装配时模型取 requestHeader() 的已发路由（宿主委托代码同源），其次 assembly variables.model、modelSelection projection、agentDefaultModel——门控读"实际发出的路由"而非 GUI 选择的旧值。

预设跳过：composedPreset(agent.ctx) 解析组合预设 id，命中 skipPresets（router-standard/spec/pro）整体跳过——这些预设本身就是风插原生呈现，再叠加就是双写。

近场引导：maybeGuided 只在 step=1、含用户消息、每会话一次时向 pre-step decision 的 messages 尾部追加一条用户消息，source.kind='plugin:dsh-wind-integration'，id 用 randomUUID 铸造——审计修正（2026-10-16）发现无 id 的注入消息在会话重载时被 assertMessageEventShape 拒绝，会损坏会话历史（docs/design.md 已记录实测损坏样例）；二次触发返回同一引用、不叠加。

持久宣言与阶段段：wind-decl（源自上游 PROGRESSIVE_DECL）与 wind-stage（当前档名、档内工具、Stage guide、band/model）作为独立 section 追加，随 system prompt 持久；宣言讲清"工具分阶段注入、wind_status 自检、签名不统一先读参数、write/edit 全量回显不要打印、自证自验、主动性协议"。

wind_status 自检工具：替代上游 dev_router_status——报告 model 与门控匹配、preset 跳过原因、presentation 与 restrict 决策、band/stage、guide 注入状态、装配计数、以及 view() 交集后的真实可调用工具列表；按代理作用域注册、随代理 scope 卸载。

文案对照（verbatim vs 替换）：persona 五段文本与 MODE 常量逐字移植（SPEC/MIXED/REACT/WEAK_PRO/WEAK_FLASH 与上游完全一致）；classifyTask/parseMode/bandOf/coreFor/testinessFor/sessionMode/extractText/applyPersona/advanceStage 逻辑逐函数等价；STAGE_GUIDES、START_GUIDE、PROGRESSIVE_DECL 保留原句，仅替换缺失子系统的引用——engram 记忆工具（recall/verify/respond、search/open、store/link）从档位与指引删去、"delivery_check（完成信号）"换成"开始验证工作"与"证据不足不算完成"、"do NOT call phase_advance"换成"do NOT force an advance"、tools_catalog/tools_help/phase_begin/delivery_check/dev_reload_preset_live 的提及统一换成 wind_status 或删除；阶段 section 名用 wind-stage/wind-decl 避免与真实 router 预设的 router-stage/router-decl 混淆（skipPresets 防双写是第二道保险）。

阶段推进：advanceStage 移植 router-core-v34 的证据规则——0→1 需 todo_write 或"开始开发/进入开发/着手实现/开始实现/write the code"文本，1→2 需 write/edit/str_replace_editor 调用，2→3 需 bash/pwsh 调用或"完成/finished/done/验证"文本；每步至多一档、永不回退；系统 prompt 同时写明"工具调用本身永不跳级"。

会话状态：WindRuntime 按 session.id 内存态（engaged/model/band/stage/guided/injectedAssemblies/restrict 状态），有界 64 会话淘汰最旧；代理结束后状态保留可上报（根作用域侧栏卡片按最近观察会话，不因短命成员会话结束而瞬间清空）；内存态在宿主重启后清空，唯有逐会话覆盖持久化在 ~/.dsh/dsh-wind-integration/wind-enable.json（封顶 1000 条按插入序淘汰）。

零接触契约：门控未命中（model/preset/session）时 transformAssembly 返回与原装配完全相同的对象引用、不分配会话状态——非 0731 会话的运行路径一个字节都不变；super-injector 的卸载即净与 bundle 的行级跳过都依赖这个契约。

首轮真实分类：recordUserMessage 在 agent/inbox/claimed 记录会话首条用户文本并立即 classify（band 不再 weak 兜底，对齐上游 issue #3/#13）；extractText 递归解出 data.message/kind/text 等嵌套形状，插件来源的辅助消息（approval/runtime-context/router 引导）不计入任务文本。

近场引导内容：首步注入一条 Bootstrap 引导（START_GUIDE 改编）——声明这是渐进工具解锁会话、四档推进路线、每档完成标准（对齐/计划/开发/验证）、band 与 flash/pro 分类回显（"Task classified as react (flash)"）与"工具调用本身永不跳级"。

披露的口径细节：WIND_META_TOOLS 恒在（wind_status），档位工具按阶段注入；全局安全集与可 restrict 集取交集——宿主里被禁用或平台缺失的工具名不会反向关掉阶段门禁（上游 v1.18 双过滤同款）；档位之间不预放后续工具（windowFor 同源 min(stage+1)），避免制造"后面还有工具"的升级焦虑。

## 四、证据：与上游同效（66/66）

上游核心测试面：风插把 router-core-v34.mjs 原样快照进 tests/fixtures/upstream-router-core-v34.mjs（cmp 与上游逐字节一致，MIT 归属头注），parity 套件直接 import 两个模块做逐函数断言。

persona 矩阵：10 个模式值（0/0.1/0.2/0.3/0.4/0.5/0.99/1/'weak'/undefined）× 4 个模型 id（pro/flash/0731/undefined）全组合，personaFor 两端逐字相等。

band/testiness/coreFor：全部模式值上 bandFor、testinessFor、coreFor 与上游一致——spec=read/edit/glob/grep（读优先）、react=read/write/edit（写优先）、weak=str_replace_editor（上游 v0.2 按界面恢复实测：RL 形状界面 100% 动作率在 18–29K 推理字符，read/write/edit 界面仅约 25% 且 73–101K）。

分类与解析：上游用例表（马里奥游戏/CSV 脚本/搭网站/修 bug/排查报错/开发并修复/今天天气/hello/空串）classifyTask 逐一相等；parseMode 令牌表（weak/router/spec/spec-lean/balanced/mixed/react/react-lean/70/0.3/auto/nonsense）逐一相等。

装配语义：applyPersona 对"persona 段替换 + 其余保留（plan-mode 存活）"与空表两种输入逐项相等；advanceStage 在 7 组上游证据用例（开始开发/计划一下方案/todo_write/write/随口聊天/bash/验证）上相等。

上游 issue #1：嵌套 user/message（data.message 内层）仍能分类——测试断言 extractText 解出"把目录里的内容内化成 DSH 插件并构建注入"且 band=react，平铺形状"修复这个仓库里的 bug"归 spec。

上游 issue #13：sessionMode 跳过插件来源消息（approval/runtime-context/router 引导不算任务）——混合事件流正确返回 1（构建任务）、纯插件流返回 'weak'、旧式无 source 消息仍按文本分类。

弱 persona 模型特异性与 flash 锚点：pro/weak 不含"review what you have already done"，flash/weak 必须含（"Do not run environment checks" 等锚点逐字保留），二者不等；isFlashModel 正确区分 flash/pro。

band 映射与相变边界：bandFor(0.1)='spec'、bandFor(0.2)='mixed'、bandFor(0.4)='mixed'、bandFor(0.5)='react'、bandFor(0.99)='react'——与上游测量的稳定区/过渡带边界一致。

验收三案 + 扩展（tests/wind-apply.test.mjs）：0731+standard → persona 替换（system-persona 消失、router-persona 就位）、wind-stage/wind-decl 注入、引导恰好一条且 uuid 合法、重复调用返回同一引用；非 0731 → 同一 assembly 对象原样返回、无会话状态分配（注入计数结构性为 0）；0731+ptc → persona+引导但 restrict=false、阶段文案标 full catalog open；router-standard 预设端到端跳过（guide 也不注入）；会话覆盖 off → 原样返回、再 enable → 恢复门控。

结果：在插件仓库执行 DSH_CHECKOUT=/media/ict/19BD52556106DE5A/deepseek-harness bash scripts/build.sh 后运行 node --test tests/wind-gate.test.mjs tests/wind-core.test.mjs tests/wind-apply.test.mjs tests/phase-tools.test.mjs tests/delivery-check.test.mjs tests/upstream-parity.test.mjs，66 条断言全部通过（# tests 66 / # pass 66 / # fail 0）；拆分为门控矩阵 10 + 核心移植 10 + 验收 5 + phase 9 + delivery 22 + parity 10。

parity 的证明口径不是"风插自己写的期望"：断言基准是上游模块自身的返回值，两端跑同一组输入（persona 矩阵、分类用例表、parseMode 令牌表、issue #1/#13 回归事件流），输出必须逐字节一致——等价性由上游代码自己判定。

为什么这证明"同效果"：风插与上游共享同一条"输入→输出"映射——同一文本同一 mode、同一 mode/model 同一 persona、同一 mode 同一工具面与测试抑制、同一证据同一阶段转移；纯函数边界逐函数等价 + 装配层（transformAssembly/maybeGuided）由验收案直接断言行为，因此"风插行为"在模型可见表面上与 router-standard 的对应部分一致。

## 五、产品：安装、配置、迁移、热重载

官方安装（bundle，推荐）：dsh plugin --profile web add 'github:nobodyhere34/dsh-wind-integration#v0.2.0'；bundle 形态 = package.json 的 dsh.bundle.patch → cordis.patch.yml 单行 insert，随 profile 装配、重启后仍生效；engines.dsh 声明 >=0.2.0-rc.2 <0.3.0-0，安装时官方兼容性检查校验。

官方 Plugins 页同样可安装/启停/配置；本地开发用 dsh plugin --profile web add <仓库绝对路径>（link 依赖 + rebuild 生效）。

模型白名单配置页（v0.1.3+）：Plugins → 内置插件配置 → 风插目标模型；多选列表按服务商分组读取当前已导入模型服务商的模型名（只列出它们广告的模型 id，白名单与宿主真实路由能力对齐），保存后写入 profile 的 dsh-wind-integration 行 config.targetModels；targetModels/matchV4Fallback 标为 schemastery volatile、decideWind 每次装配重新采样，保存即热生效、无需重启；其余非 volatile 字段（skipPresets/preservePresentationModes/stageRestrict/guideEnabled）是不可变启动配置。

从 super-injector 迁移：dev_inject_plugin { dir } 提供免重启热开发通道（同一包 id，与 bundle 行互不叠加）；改用 bundle 前先 dev_uninject_plugin 清掉注入行避免双注册；bundle 是持久形态、注入是开发通道，README 明确"同 id，互不叠加"。

热重载：scripts/build.sh（DSH_CHECKOUT 探测 + junction 链接 + tsc 编译 src→lib + lib/types）产出新 lib，dev_reload_package 或重启即换新；client 由 scripts/build-client.mjs（esbuild iife + window.__ModuleLoader__.load 封装）产出 lib/client.js。

产物与打包：lib/（tsc）与 lib/client.js（esbuild，20203 字节）后，npm pack 产出 dsh-external-dsh-wind-integration-0.1.x.tgz（仓库已存 0.1.0/0.1.1/0.1.2 三代）；package.json 无运行时依赖，peer 仅挂 cordis/schemastery/@deepseek-ai/dsh-tools，作为独立可装配包不依赖预设挂载点。

状态端点与逐会话覆盖：GET /wind/status（UI 4s 轮询）返回 plugin/version/active/targetModels/latest{stage,stageTotal,guided,restrictApplied,injectedAssemblies,enabled}；POST /wind/config 提供逐会话覆盖（false 即使门控命中也不参与，持久化到 wind-enable.json）；webServer 服务缺失时路由注册降级为空操作，注入器宿主缺服务不挂死装配链。

诚实上报：模型开关中途变化时，wind 如实显示最近观察路由与被拒原因（lastSkip: model/preset/session/ended，实时装配时清空），状态灯三态 engaged/lastSkip/model，不假装参与。

client 现状（v0.2.0 实机验证）：`client/index.tsx` 的 WindStatusCard 注册在 `sidebar.footer.action`（order 200，zh/en 字典），bundle 安装后刷新页面可见「风插（当前会话）」状态灯；`client/settings-page.tsx` 注册的「风插目标模型」配置项在 Plugins 页可用，保存写回 profile 的 `dsh-wind-integration` 行并热生效；两条路径均经无头浏览器验证、零控制台错误。运行时注入通道的 client 是否进入宿主组合表取决于注入器桥接，bundle 装配是已验证路径。

## 六、边界：已移植的子系统与仍未覆盖的部分

已移植（v0.2.0）：phase_begin/phase_advance（开启确认、逐级推进、Next goal 卡片、会话内阶段状态），tools_catalog/tools_help（当前档默认目录 + 单点白盒 + 解锁阶段标注），delivery_check（file-exists/nonempty/utf8 + 页面 smoke + evidence manifest，PASS 才可宣告完成），以及上游 v1.19 的完成信号推进 autoAdvance（ask_user_question/todo_write/exit_plan_mode 逐级推进、2→3 必须 delivery_check）。四者以 agent 作用域 meta 工具注册，只在风插激活的会话可见；非目标模型零接触。

剩余行为差：engram 记忆（recall/verify/store 等 14 个工具与四档记忆槽）、dev_page_check 页面检查、firstUserTask 任务回显、goal tools shim 仍未移植；其中 engram 需要宿主级存储契约，属于正交子系统。delivery_check 的页面 smoke 需要宿主注入 headless runner，未注入时页面类证据按规则 FAIL（非页面产物传 requireSmoke:false 不受影响），这是 fail-closed 而非静默放行。

阶段推进已与上游对齐：2→3 只由 delivery_check 的 PASS 驱动，bash/pwsh 调用或“完成/验证”文本不再能推进；阶段指引的 Gate 句恢复为“verify the real artifact with evidence — missing evidence or unreviewed visuals do not count as done”，与 upstream 的交付纪律同义。

记忆未移植的原因：engram 需要宿主级存储服务与持久化契约，属于宿主依赖子系统，移植会破坏"纯函数核心离线可测"的架构承诺；tools_catalog 需要读宿主工具注册表全量，风插改用 wind_status 的 view() 交集报告真实可调用集——同一诚实目的的更小实现。

阶段指引对缺失子系统的具体删改：STAGE_GUIDES[0] 的 "memory recall/verify/respond" 全删、保留"复杂任务先 record a plan (todo_write)"；STAGE_GUIDES[1] 的 "memory review (search/open)" 删去，"完成信号自动晋级"改为"todo_write/exit_plan_mode 记录即自动推进"；STAGE_GUIDES[2] 的 "memory write (store/link)" 删去、"delivery_check（完成信号）"改为"进入验证=开始验证工作"；STAGE_GUIDES[3] 的 "delivery_check must PASS" 改为"以证据验证真实产物，证据缺失/未人工复核不算完成"。

为什么 phase_begin 保留但非必需：上游 v34 用 phase_begin 做首轮确认（RL 句配唯一确认工具），而风插的参与与否由模型门控自动决定——不调用 phase_begin 也照常工作，调用则获得与上游一致的开启卡片（once-only、legacy 状态修复、新会话重置）；这样既不强制多一轮交互，又保留了上游协议的可调用面与 integration 语义。

为什么路由价值先做：分类/persona/阶段是纯逻辑、离线可验证、与上游逐函数可对拍；记忆/目录/交付门都要求先绑定宿主内部服务才能谈行为等价。v0.1.5 先证明“同一效果”可测（parity 34/34），v0.2.0 再补齐目录/阶段/交付门（66/66），engram 作为正交子系统后置。

明确不做的：不改 harness（全部代码在插件仓库，index.ts 是薄 Cordis 装配，纯逻辑在 wind-core/wind-gate/wind-apply）；不碰 PTC/run_code（非 native 呈现绝不 restrict）；client UI 槽位未挂载；不实现上游的 PRESSURE_GUIDE（v1.15 已并入 proactivity 协议，宣言保留 proactivity 句）。

版本与归属：v0.2.0，MIT；文案/逻辑同源于 dsh-routing-suite（© 2026 yjh051108，MIT），src/wind-core.ts 头注保留归属；tests/fixtures/upstream-router-core-v34.mjs 为上游原样快照，仅用于 parity 断言。

## 七、结语：何时开 wind、何时不开

启用 wind 当：你在 web profile 使用 DeepSeek-V4-Flash-0731（或 pro 0813），预设是 standard/ptc 等非风插原生预设；你想要 band 正确的 persona、按阶段收敛的工具面、一次性的近场引导与持久的自检声明，又不想整体换用 router-standard 预设；被门控的会话每次装配自动获得 persona + 阶段段 + 宣言，原生呈现下工具按档披露并随证据推进，ptc 呈现只加行为不 restrict。

不启用当：你希望所有模型都获得该行为（那应直接装 router-standard 预设，而不是按模型门控的叠加层）；你依赖记忆/目录/交付门子系统（未移植）；你的工作形态是同文件连续演化的相关任务链（上游 P21 实测相关链上引导为负、46–63% 且基线最好——风插引导虽每会话仅一次、影响面小，可在长相关链场景关闭 guideEnabled 减小扰动）。

需要注意的时点：bundle 装配下 client UI（侧栏状态灯 + 目标模型配置页）已实机验证；phase/catalog/delivery 工具按 agent 作用域注册，只在风插激活的会话出现；状态以宿主端点 /wind/status 为准；会话阶段与风插状态为内存态，宿主重启后清空（逐会话覆盖开关除外）。

一句话总结：风插是把上游实测过的路由行为按模型门控叠加进任意预设的移植——分类、persona、阶段、引导、披露、目录、交付门逐函数可对拍上游，全套 66/66；它不是复刻整个预设，engram 记忆这类正交子系统明确后置。
