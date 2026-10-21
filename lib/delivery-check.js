/**
 * Delivery gate — port of dsh-routing-suite router-bootstrap v34 `deliveryCheck`
 * (MIT, yjh051108/dsh-routing-suite) into the wind plugin, with two wind-port
 * deltas:
 *  - the headless smoke check runs through an *injected runner* (`deps.smoke`)
 *    instead of a built-in browser: page deliverables (args.url) require
 *    headless-smoke unless `requireSmoke:false` is passed explicitly, and an
 *    absent runner FAILs the check deterministically (no silent pass);
 *  - every filesystem probe goes through injected deps (`readFile`, `exists`,
 *    `cwd`) so the validator is pure and offline-testable against temp dirs.
 *
 * Model-facing contract (unchanged from upstream): a delivery may be declared
 * completed only after the gate returns PASS; any FAIL must be fixed and the
 * gate re-run — failure is not bypassable.
 */
import { isAbsolute, join } from 'node:path';
/** Allowed evidence kinds (upstream set, verbatim). */
export const DELIVERY_EVIDENCE_KINDS = [
    'file', 'page', 'image', 'run', 'test', 'text', 'external', 'numeric',
];
/** Head size fed to the UTF-8 decoder (upstream 64KiB). */
const UTF8_HEAD = 65536;
/** Detail strings from upstream, kept verbatim so the model contract matches. */
const DETAIL_MISSING_FILE_PARAM = 'missing file parameter';
const DETAIL_FILE_ZERO_BYTES = 'file is 0 bytes';
const DETAIL_UTF8_OK = 'UTF-8 decode OK (head 64KB)';
const DETAIL_MISSING_EVIDENCE = 'missing evidence items — provide at least one evidence item';
const DETAIL_NUMERIC_NEEDS_NUMERIC = 'numeric evidence needs a numeric result (e.g. minr=2.07, H=0.00)';
const DETAIL_EXTERNAL_NEEDS_TARGET_OR_RESULT = 'external evidence needs target (file) or result (output summary)';
const DETAIL_PAGE_NEEDS_VISUAL = 'page deliverable needs at least one reviewed visual evidence (page/image/external)';
function emptyLabelDetail() { return 'empty label'; }
function badKindDetail(kind) { return 'bad kind: ' + kind; }
function noResultDetail(kind) { return kind + ' evidence without result'; }
function noTargetDetail(kind) { return kind + ' evidence without target'; }
function targetMissingDetail(t) { return 'target missing: ' + t; }
function targetInvalidDetail(t) { return 'target not valid file: ' + t; }
function externalTargetMissingDetail(t) { return 'external target missing: ' + t; }
function externalTargetInvalidDetail(t) { return 'external target not valid file: ' + t; }
function visualNotReviewedDetail(label) { return 'visual not reviewed: ' + label; }
/** Resolve a possibly relative artifact path against the injected cwd. */
function resolvePath(p, cwd) {
    return isAbsolute(p) ? p : join(cwd ?? process.cwd(), p);
}
/** A valid evidence target is a regular file with at least one byte. */
function validTarget(info) {
    return info.exists && info.isFile && info.size > 0;
}
/**
 * Pure delivery validator, equivalent to upstream `deliveryCheck`.
 * Runs the required file checks (file-exists / file-nonempty / encoding-utf8),
 * the headless-smoke check for page deliverables via `deps.smoke`, and the
 * delivery-evidence manifest gate; returns the overall PASS/FAIL verdict.
 * @param args - gate arguments as declared by the tool schema.
 * @param deps - injected filesystem/smoke seam (never touches the network).
 * @returns verdict; `ok` is true only when every check passed.
 */
export async function deliveryCheck(args, deps) {
    const a = args ?? {};
    const checks = [];
    const rawFile = String(a.file ?? '').trim();
    if (rawFile === '') {
        return { ok: false, checks: [{ name: 'file-path', pass: false, detail: DETAIL_MISSING_FILE_PARAM }] };
    }
    const file = resolvePath(rawFile, deps.cwd);
    const info = deps.exists(file);
    if (!info.exists) {
        return { ok: false, checks: [{ name: 'file-exists', pass: false, detail: 'file missing: ' + file }] };
    }
    checks.push({
        name: 'file-exists',
        pass: true,
        detail: file + ' (' + info.size + ' bytes' + (info.mtime ? ', mtime ' + info.mtime : '') + ')',
    });
    checks.push(info.size > 0
        ? { name: 'file-nonempty', pass: true, detail: String(info.size) + ' bytes' }
        : { name: 'file-nonempty', pass: false, detail: DETAIL_FILE_ZERO_BYTES });
    try {
        const raw = deps.readFile(file);
        const head = (typeof raw === 'string' ? new TextEncoder().encode(raw) : raw).subarray(0, UTF8_HEAD);
        new TextDecoder('utf-8', { fatal: true }).decode(head);
        checks.push({ name: 'encoding-utf8', pass: true, detail: DETAIL_UTF8_OK });
    }
    catch (err) {
        checks.push({
            name: 'encoding-utf8',
            pass: false,
            detail: String(err?.message ?? err),
        });
    }
    const url = String(a.url ?? '').trim();
    const requireSmoke = a.requireSmoke !== false;
    if (url !== '' && requireSmoke) {
        const options = {
            timeoutMs: a.timeoutMs,
            virtualTimeMs: a.virtualTimeMs,
            retry: a.retry,
        };
        let smoke;
        if (typeof deps.smoke === 'function') {
            try {
                smoke = await deps.smoke(url, options);
            }
            catch (err) {
                smoke = { ok: false, detail: String(err?.message ?? err) };
            }
        }
        else {
            smoke = { ok: false, detail: 'no smoke runner injected (deps.smoke)' };
        }
        checks.push({
            name: 'headless-smoke',
            pass: smoke.ok === true,
            detail: (smoke.ok === true ? 'smoke OK: ' : 'smoke FAIL: ') + url + (smoke.detail ? ' — ' + smoke.detail : ''),
        });
    }
    const ev = a.evidence;
    if (!ev || !Array.isArray(ev.items) || ev.items.length === 0) {
        checks.push({ name: 'delivery-evidence', pass: false, detail: DETAIL_MISSING_EVIDENCE });
    }
    else {
        const failures = [];
        for (const it of ev.items) {
            const label = String(it?.label ?? '').trim();
            const kind = String(it?.kind ?? '').trim();
            if (label === '') {
                failures.push(emptyLabelDetail());
                continue;
            }
            if (!DELIVERY_EVIDENCE_KINDS.includes(kind)) {
                failures.push(badKindDetail(kind));
                continue;
            }
            if (kind === 'run' || kind === 'text') {
                if (String(it?.result ?? '').trim() === '')
                    failures.push(noResultDetail(kind));
                continue;
            }
            if (kind === 'numeric') {
                const result = String(it?.result ?? '').trim();
                if (result === '' || !/^-?[\d.eE+-]+$/.test(result))
                    failures.push(DETAIL_NUMERIC_NEEDS_NUMERIC);
                continue;
            }
            if (kind === 'external') {
                const target = String(it?.target ?? '').trim();
                const hasTarget = target !== '';
                const hasResult = String(it?.result ?? '').trim() !== '';
                if (!hasTarget && !hasResult)
                    failures.push(DETAIL_EXTERNAL_NEEDS_TARGET_OR_RESULT);
                if (hasTarget) {
                    const tp = resolvePath(target, deps.cwd);
                    const st = deps.exists(tp);
                    if (!st.exists)
                        failures.push(externalTargetMissingDetail(tp));
                    else if (!validTarget(st))
                        failures.push(externalTargetInvalidDetail(tp));
                }
                continue;
            }
            const target = String(it?.target ?? '').trim();
            if (target === '') {
                failures.push(noTargetDetail(kind));
                continue;
            }
            const tp = resolvePath(target, deps.cwd);
            const st = deps.exists(tp);
            if (!st.exists)
                failures.push(targetMissingDetail(tp));
            else if (!validTarget(st))
                failures.push(targetInvalidDetail(tp));
            if ((kind === 'page' || kind === 'image') && it?.reviewed !== true)
                failures.push(visualNotReviewedDetail(label));
        }
        if (url !== '') {
            const hasReviewedVisual = ev.items.some((it) => {
                const k = String(it?.kind ?? '').trim();
                return (k === 'page' || k === 'image' || k === 'external') && it?.reviewed === true;
            });
            if (!hasReviewedVisual)
                failures.push(DETAIL_PAGE_NEEDS_VISUAL);
        }
        checks.push({
            name: 'delivery-evidence',
            pass: failures.length === 0,
            detail: failures.length === 0 ? 'evidence accepted (' + ev.items.length + ' item(s))' : failures.join('; '),
        });
        const hasNumeric = ev.items.some((it) => String(it?.kind ?? '') === 'numeric');
        if (!hasNumeric) {
            checks.push({
                name: 'numeric-assertion',
                pass: true,
                detail: 'hint: if this deliverable has a measurable invariant (conserved qty / radius / count / compile-ok), add a numeric evidence item (kind=numeric, result=<number>) to turn "I think it works" into "I verified it". Non-blocking.',
            });
        }
    }
    return { ok: checks.every((c) => c.pass), checks };
}
const CONTRACT_PASS = 'All checks passed — delivery gate satisfied; you may report completion to the user.';
const CONTRACT_FAIL = 'Delivery gate NOT satisfied — do NOT report completion; fix the failing checks and re-run delivery_check.';
/**
 * Pure native render: one text block with the verdict line, every check line,
 * and the model-facing PASS/FAIL contract sentence.
 * @param _args - tool arguments (unused; render is replay-safe).
 * @param v - validated verdict value.
 */
export function deliveryCheckRender(_args, v) {
    let text = 'delivery-check: ' + (v.ok ? 'PASS ✅' : 'FAIL ❌') + '\n';
    for (const c of v.checks ?? []) {
        text += '- [' + (c.pass ? 'PASS' : 'FAIL') + '] ' + c.name + ': ' + c.detail + '\n';
    }
    text += v.ok ? CONTRACT_PASS : CONTRACT_FAIL;
    return [{ type: 'text', text }];
}
/**
 * Register the `delivery_check` tool on a cordis context through
 * `ctx.effect`, in the wind repo's native style (same literal ToolDefinition
 * shape `registerWindStatus` uses — no dsh-tools import, so the ambient
 * module augmentation stays out of the host program). The parameters are the
 * compiled JSON schema `defineTool` would produce, so `ctx.tools.register`
 * validates model arguments identically.
 * @param ctx - context exposing `tools.register` (+ optional `effect`).
 * @param deps - injected filesystem/smoke seam for the gate.
 * @returns disposal that unregisters the tool (no-op without an effect scope).
 */
export function registerDeliveryCheck(ctx, deps) {
    const def = {
        name: 'delivery_check',
        description: '交付 gate（阶段出口契约）。检查清单：file-exists / file-nonempty / encoding-utf8（必查）+ headless-smoke（页面类必查：传 url；requireSmoke 默认 true——非页面产物传 false）+ delivery-evidence。evidence: { items: [{ label, kind ∈ file|page|image|run|test|text|external|numeric, target?, result?, reviewed?: true }] }。⚠️ 全部 PASS 才允许宣告完成；任一 FAIL 必须修复后重跑 delivery_check，不允许绕过。',
        parameters: {
            type: 'object',
            additionalProperties: false,
            required: ['file', 'evidence'],
            properties: {
                file: { type: 'string', description: '交付物文件路径（绝对路径或相对工作区路径）' },
                url: { type: 'string', description: '页面交付物 URL——传入后为页面 gate（注入的 headless smoke + ≥1 条 reviewed:true 视觉证据）' },
                requireSmoke: { type: 'boolean', description: '默认 true：页面产物必须 smoke（不传 url 则 FAIL，不可绕过）；非页面产物传 false' },
                timeoutMs: { type: 'number', description: 'smoke 硬超时（毫秒，默认 20000）' },
                virtualTimeMs: { type: 'number', description: 'smoke 虚拟时间预算（毫秒，默认 8000）' },
                retry: { type: 'boolean', description: 'smoke 失败重试一次（默认 true，降低分辨率 + 双倍虚拟时间）' },
                evidence: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['items'],
                    description: '证据清单（唯一权威）：{ items: [{ label, kind ∈ file|page|image|run|test|text|external|numeric, target?, result?, reviewed? }] }。页面交付物至少一条 reviewed:true 视觉证据；缺失证据整体 FAIL。',
                    properties: {
                        items: {
                            type: 'array',
                            items: {
                                type: 'object',
                                additionalProperties: false,
                                required: ['kind', 'label'],
                                properties: {
                                    kind: { type: 'string', enum: [...DELIVERY_EVIDENCE_KINDS], description: '证据类型：file|page|image|run|test|text|external|numeric' },
                                    label: { type: 'string', description: '证据标签（如 AppIUM 记录：xxx）' },
                                    target: { type: 'string', description: '目标路径（file/page/image/test/external-with-target 需要有效非空文件）' },
                                    result: { type: 'string', description: '结果文本（run/text 必填；external 可替代 target；numeric 须为数字，如 2.07）' },
                                    reviewed: { type: 'boolean', description: 'page/image（及 external 作视觉时）必须 true：人工/截图核对过' },
                                },
                            },
                        },
                    },
                },
            },
        },
        output: {
            schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    ok: { type: 'boolean' },
                    checks: {
                        type: 'array',
                        items: {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                                name: { type: 'string' },
                                pass: { type: 'boolean' },
                                detail: { type: 'string' },
                            },
                        },
                    },
                },
            },
            render: (_args, v) => deliveryCheckRender(_args, v),
        },
        async execute(args) {
            return deliveryCheck(args, deps);
        },
    };
    if (typeof ctx?.effect === 'function') {
        const cleaned = ctx.effect(() => ctx.tools.register(def), 'dsh-wind: delivery_check');
        return typeof cleaned === 'function' ? cleaned : () => { };
    }
    ctx.tools.register(def);
    return () => { };
}
//# sourceMappingURL=delivery-check.js.map