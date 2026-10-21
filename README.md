# dsh-wind-integration

风插（dsh-routing-suite 路由器行为）的 **运行时模型门控集成**：当会话模型命中 wind 门控（默认精确 id `DeepSeek-V4-Flash-0731`，含 /v4/i 且含 0731 的模糊回退）时，**任意预设**（standard / ptc / 其它）自动叠加风插行为；以官方 profile bundle 持久安装，也保留 super-injector 运行时注入做热开发。

- **宿主侧原生 Cordis 插件**（无 dsh-hook-protocol）：只通过 `ctx.on` / `ctx.effect` 注册，插件不依赖任何预设挂载点。
- **官方安装形态**：`cordis.patch.yml` 为官方 bundle 装配层（`package.json` 的 `dsh.bundle.patch`，单行 insert，仓库 github.com/nobodyhere34/dsh-wind-integration）；super-injector 注入仅保留为免重启热开发通道（同 id，互不叠加）。
- **行为**：band persona（spec / mixed / react / weak，flash 模型用弱中性 persona）、wind-stage 阶段段、wind-decl 宣言、首步近场引导（同请求注入、每会话一次、零额外 API 调用）、四档渐进式工具披露（native 呈现下）。
- **安全边界**：ptc/both 等非 native 呈现 **只加行为**（persona + 引导 + 阶段段），**绝不 restrict、绝不触碰 run_code / PTC 工具**；预设本身已是风插原生呈现（router-standard / router-spec / router-pro）时整体跳过叠加，防双写。
- **纯函数核心**：src/wind-core.ts + wind-gate.ts + wind-apply.ts 离线可测（node:test）；index.ts 只是薄 cordis 装配层。

## 一、行为总览（在任意预设下选中 ds v4 0731 模型）

| 会话 | 门控 | 行为叠加 |
| --- | --- | --- |
| 0731 + standard/其它（native 呈现） | ✅ 命中 | persona + 阶段段 + 宣言 + 首步近场引导 + **四档渐进式工具披露**（`wind_status` 自检） |
| 0731 + ptc/both（非 native 呈现） | ✅ 命中 | persona + 阶段段 + 宣言 + 首步近场引导，**无 restrict** |
| 0731 + router-standard/spec/pro | ⏭️ 跳过 | 预设本身已是风插原生呈现，整体不叠加（防双写） |
| 非 0731 模型 | ❌ 未命中 | **完全零接触**（同一 assembly 引用原样返回，注入计数 0） |

## 二、门控配置（Config，schemastery）

| 键 | 默认 | 说明 |
| --- | --- | --- |
| `targetModels` | `['DeepSeek-V4-Flash-0731']` | 精确命中即生效 |
| `matchV4Fallback` | `true` | 模糊回退：/v4/i 且包含 '0731'（flash 且含 0731 为其子集，保持字面实现） |
| `skipPresets` | `['router-standard','router-spec','router-pro']` | 选中预设即风插原生 → 跳过叠加 |
| `preservePresentationModes` | `['ptc','both']` | 这些呈现模式下只加行为、不 restrict |
| `stageRestrict` | `true` | 是否对 native 呈现会话应用四档披露 |
| `guideEnabled` | `true` | 是否首步注入近场引导（每会话一次） |
| `debugLog` | `false` | `[wind]` 控制台日志 |

## 三、四档披露（router-standard 阶梯移植）

1. **了解/对齐**：read / glob / grep / web_search / ask_user_question + wind_status
2. **拟合方案**：todo_write / exit_plan_mode
3. **开发**：write / edit / str_replace_editor / read_image
4. **验证**：bash / pwsh / job_list / job_output / job_kill → 全量目录放开

- 前进信号：上一轮工具调用（会话事件 / 消息内容）或用户文本关键词（"开始开发/写"、"完成/验证/跑" 等，移植 router-core.advanceStage）。
- 每档 restrict 应用前释放旧 disposer；第 4 档放开全量；代理终止时释放。
- 每次装配的 persona / stage / decl 文案与 router-standard 的 META/progressive-decl 同源（MIT 移植，见 src/wind-core.ts 头注）。

## 四、构建与测试

```bash
cd /media/ict/19BD52556106DE5A/dsh-wind-integration
DSH_CHECKOUT=/media/ict/19BD52556106DE5A/deepseek-harness bash scripts/build.sh   # src → lib (+lib/types)
node --test tests/*.test.mjs  # 纯函数核心离线用例（含验收三案；目录形式在 Node 22 不被 --test 接受）
npm pack                      # 产物 tgz
```

## 五、安装（官方 bundle，推荐）与运行时注入（开发通道）

```bash
# 官方标准安装：写入 profile 依赖并选中 bundle（官方 Plugins 页同样可安装/启停/配置）
dsh plugin --profile web add 'github:nobodyhere34/dsh-wind-integration#v0.1.1'

# 本地开发：link 依赖，源码 rebuild 后生效
dsh plugin --profile web add /media/ict/19BD52556106DE5A/dsh-wind-integration
```

- bundle 形态：`dsh.bundle.patch` 指向单行 insert `cordis.patch.yml`，安装即随 profile 装配，重启后仍生效。
- 兼容门：`engines.dsh` 声明 `>=0.2.0-rc.2 <0.3.0-0`，安装时由官方兼容性检查校验。
- 热开发通道（可选）：super-injector `dev_inject_plugin { dir: "..." }` 免重启注入；与 bundle 行同 id，二者互不叠加，改用 bundle 前先 `dev_uninject_plugin`。

## 六、验收自动化（node:test，见 tests/）

1. **0731 + standard → 风插生效**：persona 被替换、wind-stage/wind-decl 注入、首步近场引导追加 **恰好一条**、二次触发不叠加。
2. **非 0731 + standard → 完全不动**：同一 assembly 引用原样返回、注入计数 0、guide 不追加。
3. **0731 + ptc → persona + 引导但无 restrict**：restrict=false、引导照常注入、阶段文案标注 full catalog open。
4. 附加：router-standard 预设整体跳过（防双写）；reject 决策永不附加；门控模糊回退矩阵。

## 七、目录结构

```
src/
  wind-core.ts    移植的路由核心纯函数（分类/persona/阶梯/段构建）
  wind-gate.ts    模型·预设·呈现门控纯函数
  wind-state.ts   会话级内存状态与 WindRuntime
  wind-apply.ts   装配变换 + 首步引导（离线可测的入口）
  index.ts        薄 cordis 装配层（ctx.on/effect 注册、restrict、wind_status）
  types.ts        结构化（松散）类型，无 harness 导入
tests/            node:test：门控矩阵 / 核心移植 / 验收三案
client/           UI 文案字典（zh/en）模板——v1 宿主侧，未注册 UI 槽位
docs/design.md    设计说明（对 lead 的 30 行设计 + 细化）
cordis.patch.yml  官方 bundle 装配层（package.json dsh.bundle.patch 声明，单行 insert）
```

## 八、限制与后续

- client 卡片注册在 `sidebar.footer.action` 槽位（zh/en 字典见 client/dicts.ts）。
- 会话状态为内存态（按 session.id）。代理终止只标记 `lastSkip=ended`、不再删除：根作用域侧栏卡片按"最近观察的会话"上报，短命成员会话结束时卡片不应瞬间清空；store 有界（MAX_SESSIONS，超出淘汰最旧观察）。
- 卡片上报三态：`engaged`（门控曾通过）+ `lastSkip`（当前不参与原因：model/preset/session/ended，实时装配时清空）+ `model`（最近观察路由，含 request/header 权威源，中途中换模型后如实显示被拒路由）。`/wind/status` 现带轮询（4s），不再一次性 fetch 冻结。
- 阶段推进的证据源做了双通道兜底（会话事件 + 文本信号）；若运行时事件命名变化，wind_status 可随时核对 stage 与实际 callable tools。
