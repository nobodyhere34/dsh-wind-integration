/** Per-session phase state (index-aligned with the injected stageNames). */
export interface PhaseRecord {
    /** Current stage index (0-based, 0..stageNames.length-1). */
    stage: number;
    /** True once phase_begin confirmed the session start (once per session). */
    guided: boolean;
    /** Most recent manual advance, for diagnostics. */
    lastAdvance?: {
        at: number;
        reason: string | null;
    };
}
/** Injected persistence seam — the pure layer never knows a file path. */
export interface PhaseStateStore {
    load(sid: string): PhaseRecord | undefined;
    save(sid: string, record: PhaseRecord): void;
}
/** Tool ownership: a ladder tool, an always-callable meta tool, or a host tool outside the ladder. */
export type PhaseToolKind = 'stage' | 'meta' | 'host';
/** One catalog entry: name, description, JSON-schema parameters, and ladder ownership. */
export interface PhaseToolDef {
    name: string;
    description: string;
    /** JSON-schema object; an object with an empty `properties` means "no params". */
    parameters?: Record<string, unknown>;
    kind: PhaseToolKind;
    /** Unlock stage index; meaningful only for kind === 'stage'. */
    stage?: number;
}
/** A ladder stage: display name plus its tools (goal text is not consumed here). */
export interface PhaseStage {
    name: string;
    tools: readonly string[];
}
/** Catalog mark, upstream wording: 可调 / 未解锁 / meta / 全量. */
export type PhaseMark = '可调' | '未解锁' | 'meta' | '全量';
export interface PhaseToolMeta {
    description?: string;
    /** JSON-schema object describing the tool's parameters. */
    parameters?: Record<string, unknown>;
}
/** The four phase tools share one dep bundle; also the contract for registerPhaseTools. */
export interface PhaseDeps {
    /** Injected persistence; no hardcoded path inside the module. */
    stateStore: PhaseStateStore;
    /** Full tool index (stage/meta/host entries with descriptions and schemas). */
    catalog: readonly PhaseToolDef[];
    /** Stage display names, index-aligned with catalog stage entries. */
    stageNames: readonly string[];
}
/** Build a catalog from the ladder plus meta/host tool name lists. */
export declare function catalogFromStages(stages: ReadonlyArray<PhaseStage>, metaTools: readonly string[], hostTools?: readonly string[], metas?: Record<string, PhaseToolMeta>): PhaseToolDef[];
/**
 * Catalog mark for a tool at a stage: the final stage opens everything
 * (`全量`); meta tools are `meta`; a stage tool unlocked in the current
 * window is `可调`; anything else is `未解锁`.
 */
export declare function markFor(def: PhaseToolDef, stage: number, stageTotal: number): PhaseMark;
/** Inline annotation appended to locked/callable rows (upstream wording). */
export declare function catalogMarkExtra(def: PhaseToolDef, mark: PhaseMark, stageTotal: number): string;
/** tools_help unlock line for a locked tool, upstream wording. */
export declare function helpUnlockLine(def: PhaseToolDef, mark: PhaseMark, stageTotal: number): string;
/** Domain classification for tools_catalog domain filtering (upstream single-source). */
export declare function categorizeDomain(name: string, desc: string): string;
/**
 * One-line parameter-name quick hint embedded in catalog rows, killing
 * "guess the argument name" friction (glob's pattern / read's file_path differ).
 */
export declare function paramHint(parameters: unknown): string;
/** In-memory store; `dump()` snapshots state so a second store can round-trip it. */
export interface MemoryPhaseStore<T extends Record<string, PhaseRecord> = Record<string, PhaseRecord>> extends PhaseStateStore {
    dump(): T;
}
export declare function createMemoryPhaseStore(initial?: Record<string, PhaseRecord>): MemoryPhaseStore;
/**
 * File-backed store — the path is injected by the caller (the host wiring
 * chooses it), never hardcoded here. Persists a \{ version, savedAt, sessions \}
 * envelope, mirroring the upstream phases.json shape.
 */
export declare function createFilePhaseStore(file: string): PhaseStateStore;
export interface BeginResult {
    record: PhaseRecord;
    /** 'fresh' | 'started' | 'already' | 'legacy' — how the start was confirmed. */
    outcome: 'fresh' | 'started' | 'already' | 'legacy';
    message: string;
}
/**
 * phase_begin: confirm the session start once per session. Sets `guided`
 * and keeps upstream return wording; a fresh conversation resets stage state.
 */
export declare function beginOnce(store: PhaseStateStore, sid: string, stageNames: readonly string[], opts?: {
    fresh?: boolean;
}): BeginResult;
export interface AdvanceResult {
    record: PhaseRecord;
    advanced: boolean;
    message: string;
}
/**
 * phase_advance: advance exactly one stage. The final stage is a no-op; the
 * advance card lists the newly entered stage's tools and the next goal.
 */
export declare function advanceOne(store: PhaseStateStore, sid: string, stageNames: readonly string[], catalog: readonly PhaseToolDef[], reason?: string): AdvanceResult;
export interface CatalogArgs {
    query?: string;
    domain?: string;
}
/**
 * tools_catalog, tier one. By default only the current-stage callable tools are
 * listed (locked tools are never advertised); an explicit query is a single-point
 * whitebox — a locked tool then appears with its unlock-stage annotation.
 */
export declare function catalogText(store: PhaseStateStore, sid: string, args: CatalogArgs, stageNames: readonly string[], catalog: readonly PhaseToolDef[]): string;
/**
 * tools_help, tier two: a single tool's full schema plus an unlock line when
 * it is locked. Querying is an active, allowed act — the call itself stays denied.
 */
export declare function helpText(store: PhaseStateStore, sid: string, name: string, stageNames: readonly string[], catalog: readonly PhaseToolDef[]): string;
