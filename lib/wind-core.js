export const MODE_SPEC = 0;
export const MODE_MIXED = 0.3;
export const MODE_REACT = 1;
export const MODE_WEAK = 'weak';
const SPEC_PERSONA = 'You are a helpful software engineer assistant.';
const MIXED_PERSONA = 'You are a helpful software engineer assistant.\n'
    + 'Work directly: prefer writing or editing code over describing plans. '
    + 'Verify your changes by reading and running them.';
const REACT_PERSONA = 'You are a hands-on software engineer who delivers working output fast.\n'
    + 'Work directly: write or edit code, then verify it by reading and running. '
    + 'Keep the loop tight — produce, verify, fix — and do not build test '
    + 'harnesses, scaffolding, or ceremony the user did not ask for. '
    + 'Finish with a usable deliverable and a short summary.';
const WEAK_PRO = 'You are a helpful software engineer assistant.\n'
    + 'Before acting, decide the task type (build or fix) and adopt the matching '
    + 'style: build → hands-on production; fix → inspect-and-plan.';
const WEAK_FLASH = 'You are a helpful assistant.\n'
    + 'Before acting, decide the task type (build or fix) and adopt the matching '
    + 'style: build → hands-on production; fix → inspect-and-plan.\n'
    + 'Before acting, briefly review what you have already done in this session and continue from where you left off; do not repeat completed steps. Do not run environment checks (echo, whoami, uname, node --version, date) or exhaustive grep/glob scans.\n'
    + 'Think deeply first, then produce.';
const COMPLEX_RE = /(重构|架构|全面|详细|设计|系统|优化|分析|survey|overview|architecture|refactor|comprehensive|detailed|design|system|optimize|analyze)/i;
// Upstream router-core-v34 classification vocabulary (hit-counted, not first-match).
const REACT_RE = /(开发|创建|写一个|生成|从零|做一个|游戏|网页|网站|构建|新项目|搭建|实现|做出|上线|落地|脚本|工具|应用|build|create|develop|generate|implement|make a|new project)/gi;
const SPEC_RE = /(修复|修一下|调试|重构|维护|排查|报错|出错|崩溃|优化|审查|review|fix|debug|refactor|maintain|repair|broken|break|为什么|异常|故障|迁移|升级|兼容)/gi;
function countHits(regex, text) {
    return [...text.matchAll(regex)].length;
}
function clamp01(n) {
    return n < 0 ? 0 : n > 1 ? 1 : n;
}
/** True when the model id names a Flash-family model. */
export function isFlashModel(modelId) {
    return typeof modelId === 'string' && /flash/i.test(modelId);
}
/** Long or architecturally-worded tasks are complex. */
export function isComplexTask(text) {
    return typeof text === 'string' && (text.length > 120 || COMPLEX_RE.test(text));
}
/** Quantize a task mode to a stable behavior band. */
export function bandOf(mode) {
    if (mode === MODE_WEAK || mode === undefined)
        return 'weak';
    const m = clamp01(mode);
    if (m < 0.2)
        return 'spec';
    // Upstream keeps [0.2, 0.5) as the unstable transition band.
    if (m < 0.5)
        return 'mixed';
    return 'react';
}
/** Classify a user task text into a reasoning mode (0 / 0.3 / 1 / 'weak').
 * Clear keyword evidence picks a stable band; ambiguous text returns 'weak'
 * so the model routes itself (same hit-count rule as upstream router-core-v34). */
export function classifyTask(text) {
    if (typeof text !== 'string' || text.trim() === '')
        return MODE_WEAK;
    const react = countHits(REACT_RE, text);
    const spec = countHits(SPEC_RE, text);
    if (react > spec)
        return 1;
    if (spec > react)
        return 0;
    return MODE_WEAK;
}
/** Extract the display text from a user message (content array or plain string). */
export function extractText(message) {
    const m = message;
    if (!m)
        return '';
    const content = m.content;
    if (Array.isArray(content)) {
        return content
            .map((c) => (c && typeof c === 'object' ? c.text ?? '' : ''))
            .join(' ')
            .trim();
    }
    if (typeof content === 'string')
        return content.trim();
    if (typeof m.text === 'string')
        return m.text.trim();
    return '';
}
/** Band persona (weak is model-specific: flash family gets the neutral classify-and-act persona). */
export function personaForBand(band, modelId) {
    const b = band ?? 'weak';
    if (b === 'spec')
        return SPEC_PERSONA;
    if (b === 'mixed')
        return MIXED_PERSONA;
    if (b === 'react')
        return REACT_PERSONA;
    return isFlashModel(modelId) ? WEAK_FLASH : WEAK_PRO;
}
/** Staged tool ladder (wind progressive disclosure). */
export const STAGES = [
    { name: '了解/对齐 (clarify)', tools: ['read', 'glob', 'grep', 'web_search', 'ask_user_question'], goal: 'clarify the task and gather what you need' },
    { name: '拟合方案 (plan)', tools: ['todo_write', 'exit_plan_mode'], goal: 'lay the plan out with todo_write' },
    { name: '开发 (implement)', tools: ['write', 'edit', 'str_replace_editor', 'read_image'], goal: 'implement per the plan' },
    { name: '验证 (verify)', tools: ['bash', 'pwsh', 'job_list', 'job_output', 'job_kill'], goal: 'run and verify the deliverable' },
];
/** Tools that stay available at every stage. */
export const WIND_META_TOOLS = ['wind_status'];
/** Union of all stage tools — the full write surface when disclosure is released. */
export const WIND_GLOBAL_SAFE = [...STAGES.flatMap((s) => s.tools), ...WIND_META_TOOLS];
/** End index (exclusive) of the stage slice exposed at a given stage: only the current stage. */
export function windowFor(stage) {
    return stage + 1;
}
/** Advance at most one stage per call from tool evidence plus tightened wording
 * (upstream v34: /方案|计划/ was removed because it fired too early). */
export function advanceStage(stage, toolNames, text) {
    const names = new Set(toolNames);
    const words = typeof text === 'string' ? text : '';
    let next = stage;
    if (next === 0 && (names.has('todo_write') || /开始开发|进入开发|着手实现|开始实现|write the code/i.test(words)))
        next = 1;
    if (next === 1 && (names.has('write') || names.has('edit') || names.has('str_replace_editor')))
        next = 2;
    if (next === 2 && (names.has('pwsh') || names.has('bash') || /完成|finished|done|验证/i.test(words)))
        next = 3;
    return Math.min(next, STAGES.length - 1);
}
function hasTool(toolNames, ...names) {
    const set = new Set(toolNames);
    return names.some((n) => set.has(n));
}
/** The near-field guide text (same-request, appended once on the first pre-step). */
export function buildGuide(band, modelId) {
    const b = band ?? 'weak';
    let line;
    if (b === 'spec')
        line = 'Plan first, gather what you need, then act step by step.';
    else if (b === 'mixed')
        line = 'Work directly, but confirm the plan before the first big write.';
    else if (b === 'react')
        line = 'Work directly: produce, verify, fix — keep the loop tight.';
    else
        line = isFlashModel(modelId)
            ? 'Decide build vs fix, then act; review progress before repeating.'
            : 'Decide build vs fix and pick the matching working style.';
    return '[wind routing] Task classified as ' + b + '. ' + line
        + ' Follow the staged tool discipline: only the tools of the current stage are callable; '
        + 'advance by completing the stage goal. Check ' + STAGES.length + ' stages with tools["wind_status"]({}).';
}
/** Persistent declaration appended to every wind assembly. */
export function buildDeclaration() {
    return 'Wind routing (router-standard behavior, model-gated): this session runs progressive disclosure — '
        + 'the tool list per stage shows only what is unlocked. Complete the stage goal to advance. '
        + 'Inspect the current stage, band, and callable tools with tools["wind_status"]({}).';
}
/** The stage section text: current stage, unlocked tools, and next goal. */
export function buildStageText(stage, modelId, band, fullCatalog) {
    const cur = STAGES[stage];
    const tools = fullCatalog ? WIND_GLOBAL_SAFE.join(', ') : WIND_META_TOOLS.concat(STAGES[stage].tools).join(', ');
    return 'Stage ' + (stage + 1) + '/' + STAGES.length + ': ' + cur.name
        + ' — unlocked tools: ' + tools + '. Next goal: ' + cur.goal + '.'
        + (fullCatalog ? ' [full catalog open]' : '')
        + ' band=' + (band ?? 'weak') + ' model=' + (modelId ?? '?');
}
/** Replace every persona-named section with one appended wind persona (upstream
 * v34 semantics: official persona is removed, everything else is preserved). */
export function applyPersona(sections, personaText) {
    const rest = sections.filter((section) => !/persona/i.test(section.name));
    return [...rest, { name: 'wind-persona', text: personaText, order: 0 }];
}
/** Sections added on top of the official sections when wind engages. */
export function windExtraSections(stage, band, modelId, fullCatalog) {
    return [
        { name: 'wind-stage', order: 1, text: buildStageText(stage, modelId, band, fullCatalog) },
        { name: 'wind-decl', order: 2, text: buildDeclaration() },
    ];
}
/** Readable band label for the wind_status report. */
export function bandLabel(band) {
    return band ?? 'weak';
}
//# sourceMappingURL=wind-core.js.map