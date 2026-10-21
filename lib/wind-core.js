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
    + 'Keep the loop tight — produce, verify, fix — and finish with a usable '
    + 'deliverable and a short summary.';
const WEAK_PRO = 'You are a helpful software engineer assistant.\n'
    + 'Before acting, decide the task type (build or fix) and adopt the matching '
    + 'style: build → hands-on production; fix → inspect-and-plan.';
const WEAK_FLASH = 'You are a helpful assistant.\n'
    + 'Before acting, decide the task type (build or fix) and adopt the matching '
    + 'style: build → hands-on production; fix → inspect-and-plan.\n'
    + 'Before acting, review what you have already done and continue; do not '
    + 'repeat completed steps or run environment checks. Think first, then produce.';
const COMPLEX_RE = /(重构|架构|全面|详细|设计|系统|优化|分析|survey|overview|architecture|refactor|comprehensive|detailed|design|system|optimize|analyze)/i;
const SPEC_RE = /(先|计划|方案|规划|步骤|详细|设计|重构|架构|修复|调试|调查|设计文档|架构图|整体流程|roadmap|plan|design|debug|fix|refactor|architecture|investigate|analyze|review)/i;
const REACT_RE = /(直接|立刻|马上|快点|尽快|现在|写|实现|改|做|生成|产出|create|write|build|implement|generate|make|do|now|quick|fast|immediately)/i;
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
    if (m <= 0.45)
        return 'mixed';
    return 'react';
}
/** Classify a user task text into a reasoning mode (0 / 0.3 / 1 / 'weak'). */
export function classifyTask(text) {
    if (!text.trim())
        return MODE_WEAK;
    return isComplexTask(text) && SPEC_RE.test(text) ? 0
        : REACT_RE.test(text) ? 1
            : MODE_WEAK;
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
/** Stage ← next on todo/plan evidence (todo_write call or plan wording). */
export function advanceStage(stage, toolNames, text) {
    let next = stage;
    if (stage === 0 && (hasTool(toolNames, 'todo_write') || /开始|开头|开发|固定方案|计划|plan|design|todo/i.test(text)))
        next = 1;
    else if (stage === 1 && hasTool(toolNames, 'write', 'edit', 'str_replace_editor'))
        next = 2;
    else if (stage === 2 && (hasTool(toolNames, 'bash', 'pwsh', 'job_list', 'job_output', 'job_kill') || /完成|验证|测试|跑|run|test|verify|done/i.test(text)))
        next = 3;
    return Math.max(stage, Math.min(next, STAGES.length - 1));
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
/** Point any persona-named section at the band persona; add a wind-persona section when none exists. */
export function applyPersona(sections, personaText) {
    let sawPersona = false;
    const out = sections.map((s) => {
        if (/persona/i.test(s.name)) {
            sawPersona = true;
            return { ...s, text: personaText };
        }
        return s;
    });
    if (!sawPersona) {
        out.push({ name: 'wind-persona', text: personaText, order: 0 });
    }
    return out;
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