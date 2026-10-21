/**
 * Wind phase/catalog subsystem — pure, offline-testable port of the
 * dsh-routing-suite router-standard phase tools (phase_begin, phase_advance,
 * tools_catalog, tools_help; upstream
 * preset/router-standard/router-bootstrap-v34.mjs, MIT © 2026 yjh051108).
 *
 * All behavior lives here. Persistence goes through an injected
 * `PhaseStateStore` (no hardcoded paths), and there are no Cordis imports or
 * host services, so the acceptance cases run in plain node:test against the
 * built lib. The registration layer lives in `src/phase-tools.ts`.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
/** Build a catalog from the ladder plus meta/host tool name lists. */
export function catalogFromStages(stages, metaTools, hostTools = [], metas = {}) {
    const out = [];
    stages.forEach((stage, index) => {
        for (const name of stage.tools) {
            const meta = metas[name];
            out.push({
                name,
                description: meta?.description ?? name,
                parameters: meta?.parameters ?? {},
                kind: 'stage',
                stage: index,
            });
        }
    });
    for (const name of metaTools) {
        const meta = metas[name];
        out.push({ name, description: meta?.description ?? name, parameters: meta?.parameters ?? {}, kind: 'meta' });
    }
    for (const name of hostTools) {
        const meta = metas[name];
        out.push({ name, description: meta?.description ?? name, parameters: meta?.parameters ?? {}, kind: 'host' });
    }
    return out;
}
/**
 * Catalog mark for a tool at a stage: the final stage opens everything
 * (`全量`); meta tools are `meta`; a stage tool unlocked in the current
 * window is `可调`; anything else is `未解锁`.
 */
export function markFor(def, stage, stageTotal) {
    if (stage >= stageTotal - 1)
        return '全量';
    if (def.kind === 'meta')
        return 'meta';
    if (def.kind === 'stage' && (def.stage ?? 0) < stage + 1)
        return '可调';
    return '未解锁';
}
/** Inline annotation appended to locked/callable rows (upstream wording). */
export function catalogMarkExtra(def, mark, stageTotal) {
    if (mark === '未解锁' && def.kind === 'stage')
        return '（解锁于阶段 ' + (def.stage ?? 0) + '）';
    if (mark === '未解锁' && def.kind === 'host')
        return '（宿主·交付期：阶段 ' + (stageTotal - 1) + ' 全量开放）';
    if (mark === '可调' && def.kind === 'host')
        return '（宿主·常驻）';
    return '';
}
/** tools_help unlock line for a locked tool, upstream wording. */
export function helpUnlockLine(def, mark, stageTotal) {
    if (mark !== '未解锁')
        return '';
    if (def.kind === 'stage')
        return '解锁阶段: ' + (def.stage ?? 0) + '（当前调用会被拒绝；详情可提前查阅。若你判断它应属于当前阶段，请指出工具分配问题（调整 STAGES），而不是寻求绕过）';
    return '解锁阶段: 交付期（宿主工具·阶段 ' + (stageTotal - 1) + ' 全量开放；当前调用会被拒绝。若你认为它应在当前阶段，请指出工具分配问题）';
}
/** Domain classification for tools_catalog domain filtering (upstream single-source). */
export function categorizeDomain(name, desc) {
    const t = name + ' ' + desc;
    if (/(read|write|edit|glob|grep|str_replace_editor|fs|file|path)/i.test(t))
        return 'file';
    if (/(bash|pwsh|shell|run_code|exec|command|spawn)/i.test(t))
        return 'exec';
    if (/(web|search|fetch|http|network|browse)/i.test(t))
        return 'network';
    if (/(subagent|agent|delegate|workflow|ralph|fork)/i.test(t))
        return 'delegate';
    if (/(engram|memory|recall|store|search)/i.test(t))
        return 'memory';
    return 'other';
}
/**
 * One-line parameter-name quick hint embedded in catalog rows, killing
 * "guess the argument name" friction (glob's pattern / read's file_path differ).
 */
export function paramHint(parameters) {
    try {
        if (typeof parameters === 'function')
            return 'schema in tools_help';
        const p = parameters && typeof parameters === 'object' && !Array.isArray(parameters) ? parameters : {};
        const props = (p.properties ?? {});
        const keys = Object.keys(props);
        if (keys.length === 0)
            return 'no params';
        return 'params: ' + keys.map((k) => {
            const meta = props[k] ?? {};
            const type = meta.type ?? 'any';
            const desc = meta.description ?? '';
            const extra = /defaults? to/i.test(desc) ? '≤' + (desc.match(/defaults? to (\d+)/i)?.[1] ?? 'cap') : '';
            return k + ': ' + type + extra;
        }).join(', ');
    }
    catch {
        return '';
    }
}
export function createMemoryPhaseStore(initial = {}) {
    const records = new Map(Object.entries(initial));
    const clone = (rec) => ({
        ...rec,
        ...(rec.lastAdvance ? { lastAdvance: { at: rec.lastAdvance.at, reason: rec.lastAdvance.reason } } : {}),
    });
    return {
        load(sid) {
            const rec = records.get(sid);
            return rec ? clone(rec) : undefined;
        },
        save(sid, record) {
            records.set(sid, clone(record));
        },
        dump() {
            const out = {};
            for (const [sid, rec] of records)
                out[sid] = clone(rec);
            return out;
        },
    };
}
/**
 * File-backed store — the path is injected by the caller (the host wiring
 * chooses it), never hardcoded here. Persists a \{ version, savedAt, sessions \}
 * envelope, mirroring the upstream phases.json shape.
 */
export function createFilePhaseStore(file) {
    let cache;
    const loadAll = () => {
        if (cache !== undefined)
            return cache;
        try {
            const parsed = JSON.parse(readFileSync(file, 'utf8'));
            cache = parsed && typeof parsed === 'object' && parsed.sessions ? parsed.sessions : {};
        }
        catch {
            cache = {};
        }
        return cache;
    };
    return {
        load(sid) {
            const rec = loadAll()[sid];
            return rec ? { ...rec } : undefined;
        },
        save(sid, record) {
            const all = loadAll();
            all[sid] = { ...record };
            try {
                mkdirSync(dirname(file), { recursive: true });
                writeFileSync(file, JSON.stringify({ version: 2, savedAt: new Date().toISOString(), sessions: all }, null, 2), 'utf8');
            }
            catch (e) {
                console.error('[phase-state] save failed:', String(e));
            }
        },
    };
}
/**
 * phase_begin: confirm the session start once per session. Sets `guided`
 * and keeps upstream return wording; a fresh conversation resets stage state.
 */
export function beginOnce(store, sid, stageNames, opts = {}) {
    const existing = store.load(sid) ?? { stage: 0, guided: false };
    if (opts.fresh === true) {
        const record = { stage: 0, guided: true };
        store.save(sid, record);
        return {
            record,
            outcome: 'fresh',
            message: 'session started (fresh-auto): phase 0 ' + stageNames[0] + ' unlocked — Bootstrap injected. New conversation detected; stage state reset.',
        };
    }
    if (existing.guided === true) {
        return { record: existing, outcome: 'already', message: 'session already started: phase ' + existing.stage + ' (' + stageNames[existing.stage] + '); no duplicate bootstrap' };
    }
    if (existing.stage > 0) {
        const record = { ...existing, guided: true };
        store.save(sid, record);
        return { record, outcome: 'legacy', message: 'session already started (legacy state): phase ' + existing.stage + ' (' + stageNames[existing.stage] + '); guided flag repaired, no duplicate bootstrap' };
    }
    const record = { ...existing, guided: true };
    store.save(sid, record);
    return { record, outcome: 'started', message: 'session started: phase ' + existing.stage + ' (' + stageNames[existing.stage] + ') unlocked — Bootstrap injected.' };
}
/**
 * phase_advance: advance exactly one stage. The final stage is a no-op; the
 * advance card lists the newly entered stage's tools and the next goal.
 */
export function advanceOne(store, sid, stageNames, catalog, reason) {
    const existing = store.load(sid) ?? { stage: 0, guided: false };
    if (existing.stage >= stageNames.length - 1) {
        return { record: existing, advanced: false, message: 'already at the last stage (' + stageNames[existing.stage] + '); full catalog is open' };
    }
    const next = existing.stage + 1;
    const record = {
        ...existing,
        stage: next,
        lastAdvance: { at: Date.now(), reason: reason ? String(reason) : null },
    };
    store.save(sid, record);
    const byName = new Map(catalog.map((t) => [t.name, t]));
    const card = (nm) => {
        const found = byName.get(nm);
        return nm + (found ? ' — ' + found.description.split(/\n|\. /)[0].slice(0, 46) : '');
    };
    const stage = stageNames[next] ?? '';
    const newTools = catalog.filter((t) => t.kind === 'stage' && t.stage === next).map((t) => t.name);
    const newLine = newTools.length > 0 ? '\nNew this stage: ' + newTools.map(card).join(' | ') : '';
    const message = 'advanced to phase ' + next + ': ' + stage
        + newLine
        + '\nNext goal: ' + stage + ' — complete it via its completion signal (todo_write/exit_plan_mode) or phase_advance.';
    return { record, advanced: true, message };
}
/**
 * tools_catalog, tier one. By default only the current-stage callable tools are
 * listed (locked tools are never advertised); an explicit query is a single-point
 * whitebox — a locked tool then appears with its unlock-stage annotation.
 */
export function catalogText(store, sid, args, stageNames, catalog) {
    const current = store.load(sid);
    const stage = current?.stage ?? 0;
    const q = String(args?.query ?? '').toLowerCase();
    const d = String(args?.domain ?? '').toLowerCase();
    const rows = catalog.filter((t) => {
        if (d && categorizeDomain(t.name, t.description) !== d)
            return false;
        if (q && !(t.name + ' ' + t.description).toLowerCase().includes(q))
            return false;
        if (!q && markFor(t, stage, stageNames.length) === '未解锁')
            return false;
        return true;
    });
    if (rows.length === 0)
        return '（无匹配工具）';
    return rows.map((t) => {
        const mark = markFor(t, stage, stageNames.length);
        const extra = catalogMarkExtra(t, mark, stageNames.length);
        return '- ' + t.name + ' [' + mark + ']' + extra + ' — ' + t.description.split(/\n|\. /)[0].slice(0, 90) + ' (' + paramHint(t.parameters ?? {}) + ')';
    }).join('\n');
}
/**
 * tools_help, tier two: a single tool's full schema plus an unlock line when
 * it is locked. Querying is an active, allowed act — the call itself stays denied.
 */
export function helpText(store, sid, name, stageNames, catalog) {
    const found = catalog.find((t) => t.name === name);
    if (!found)
        return '未知工具: ' + name + '（先用 tools_catalog 查）';
    const current = store.load(sid);
    const stage = current?.stage ?? 0;
    const mark = markFor(found, stage, stageNames.length);
    const params = found.parameters && typeof found.parameters === 'object' && !Array.isArray(found.parameters) ? found.parameters : {};
    const props = (params.properties ?? {});
    const required = (Array.isArray(params.required) ? params.required : []);
    const unlock = helpUnlockLine(found, mark, stageNames.length);
    const lines = ['工具: ' + name + ' [' + mark + ']', unlock, '描述: ' + found.description].filter((l) => l !== '');
    for (const [k, v] of Object.entries(props)) {
        const meta = v && typeof v === 'object' ? v : {};
        lines.push('  ' + k + ': ' + (meta.type ?? 'any') + (required.includes(k) ? '（必需）' : '') + ' — ' + (meta.description ?? ''));
    }
    return lines.join('\n');
}
//# sourceMappingURL=phase-state.js.map