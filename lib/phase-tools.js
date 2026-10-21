/**
 * Wind phase/catalog tool definitions and registration.
 *
 * `registerPhaseTools(ctx, deps)` registers four tools — phase_begin,
 * phase_advance, tools_catalog, tools_help — following the repo convention of
 * registering through `ctx.effect` inside an agent scope, using a local
 * `defineTool` that normalizes parameter specs into full JSON schema (the
 * harness packages stay decoupled). All behavior lives in `src/phase-state.ts`
 * (pure, store-injected); this file only wraps it in tool defs. Port of the
 * dsh-routing-suite router-standard phase tools (upstream
 * preset/router-standard/router-bootstrap-v34.mjs, MIT © 2026 yjh051108).
 */
import { beginOnce, advanceOne, catalogText, helpText, markFor, catalogMarkExtra, helpUnlockLine, categorizeDomain, paramHint, } from './phase-state.js';
/** Parameter-meta → JSON-schema conversion (port of the upstream toJsonSchema). */
export function toJsonSchema(spec) {
    const build = (entries) => {
        const properties = {};
        const required = [];
        for (const [key, meta] of Object.entries(entries)) {
            const prop = { type: meta?.type ?? 'any' };
            if (meta?.description)
                prop.description = meta.description;
            if (Array.isArray(meta?.enum))
                prop.enum = [...meta.enum];
            if (meta?.required === true)
                required.push(key);
            properties[key] = prop;
        }
        return { type: 'object', properties, required, additionalProperties: false };
    };
    return build(spec);
}
/** Registration adapter: turns a spec into a fully-shaped registered def. */
export function defineTool(spec) {
    return {
        name: spec.name,
        description: spec.description,
        parameters: toJsonSchema(spec.parameters ?? {}),
        output: spec.output,
        execute: spec.execute,
    };
}
const renderText = (_a, v) => [{ type: 'text', text: String(v) }];
const sidOf = (exec) => exec?.agent?.session?.id ? String(exec.agent.session.id) : undefined;
/** The four phase tool defs, bound to the injected deps. */
export function phaseToolDefs(deps) {
    const { stateStore, catalog, stageNames } = deps;
    return [
        defineTool({
            name: 'phase_begin',
            description: '确认开启本次会话：开始渐进式工具解锁（注入机制声明 + 解锁阶段 0 工具；呈现为 native 直调）。调用即开始。',
            parameters: {},
            output: { schema: { type: 'string' }, render: renderText },
            async execute(_args, exec) {
                const sid = sidOf(exec);
                if (sid === undefined)
                    return 'no agent session';
                return beginOnce(stateStore, sid, stageNames).message;
            },
        }),
        defineTool({
            name: 'phase_advance',
            description: '闯关推进：声明当前阶段已完成，进入下一阶段（解锁新工具 + 阶段提示）。逐级推进（一次一级，不跳级）。仅在明确完成本阶段工作时调用。进入验证/交付阶段后：先以交付产物自检（构建 + 测试通过），再宣告完成。',
            parameters: { reason: { type: 'string', description: '推进理由（可选，记录用）' } },
            output: { schema: { type: 'string' }, render: renderText },
            async execute(args, exec) {
                const sid = sidOf(exec);
                if (sid === undefined)
                    return 'no agent session';
                const reason = typeof args?.reason === 'string' && args.reason ? args.reason : undefined;
                return advanceOne(stateStore, sid, stageNames, catalog, reason).message;
            },
        }),
        defineTool({
            name: 'tools_catalog',
            description: '渐进式披露一级：默认只列当前阶段可调工具（未解锁不点名、不预告后续工具）；query 单点白盒（命中未解锁才给相关行，带解锁阶段/交付期标注）；无全量出口——严格按阶段推进，未解锁工具名称不进入视野。行标注=运行时真绑定。',
            parameters: {
                query: { type: 'string', description: '关键词（单点白盒：命中未解锁工具时只给相关行，带解锁阶段/交付期标注）' },
                domain: { type: 'string', description: '域筛选' },
            },
            output: { schema: { type: 'string' }, render: renderText },
            async execute(args, exec) {
                const sid = sidOf(exec);
                // Unknown session falls back to stage 0, mirroring the upstream catalog path.
                return catalogText(stateStore, sid ?? '', { query: String(args?.query ?? ''), domain: String(args?.domain ?? '') }, stageNames, catalog);
            },
        }),
        defineTool({
            name: 'tools_help',
            description: '渐进式披露二级：单个工具的完整 schema（含解锁阶段提示）。查询本身是主动行为——可查未解锁工具详情，但调用会被拒绝。',
            parameters: { name: { type: 'string', required: true, description: '工具名（tools_catalog 里查到的）' } },
            output: { schema: { type: 'string' }, render: renderText },
            async execute(args, exec) {
                const sid = sidOf(exec);
                return helpText(stateStore, sid ?? '', String(args?.name ?? '').trim(), stageNames, catalog);
            },
        }),
    ];
}
/** Register the four phase tools through ctx.effect, per repo convention. */
export function registerPhaseTools(ctx, deps) {
    const effect = ctx.effect ?? ((fn) => fn());
    for (const def of phaseToolDefs(deps)) {
        const label = def.name + ' register';
        effect(() => ctx.tools.register(def), label);
    }
}
/** Re-exported for host wiring that wants to annotate catalog rows itself. */
export { markFor, catalogMarkExtra, helpUnlockLine, categorizeDomain, paramHint };
//# sourceMappingURL=phase-tools.js.map