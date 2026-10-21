/**
 * Session-scoped wind runtime state (in-memory, keyed by session id).
 */
import type { BandName, TaskMode } from './wind-core.js';
/** Mutable per-session wind state. */
export interface SessionWindState {
    sid: string;
    /** The wind model gate passed at least once for this session. */
    engaged: boolean;
    /** Why wind currently does not participate, from the latest observation; cleared on a live assembly. */
    lastSkip?: {
        reason: 'model' | 'preset' | 'session' | 'ended';
        preset?: string;
    };
    /** Terminal agent/status observed; wind no longer participates live. */
    stopped?: boolean;
    /** Latest observed route (refreshed per engaged assembly; survives mid-session model switches). */
    model?: string;
    /** Classified task mode (a band index or 'weak'), once the first user text arrives. */
    mode?: TaskMode;
    /** Mode quantized to a band name, for display/persona selection. */
    band?: BandName;
    /** Progressive disclosure stage index (0..STAGES.length-1). */
    stage: number;
    /** First real user task text captured at inbox/claimed. */
    firstText?: string;
    /** Near-field guide already injected for this session (once). */
    guided: boolean;
    /** Number of target-model assemblies that injected wind sections. */
    injectedAssemblies: number;
    /** Restrict was requested for this session (decision.restrict). */
    restrictRequested: boolean;
    /** The host restrict disposer was applied. */
    restrictApplied: boolean;
    /** Live disposer to release the current restrict before a re-restrict/full catalog. */
    restrictDisposer?: () => void;
    /** wind_status was registered on the agent scope. */
    toolRegistered: boolean;
    /** Model id captured at the first wind assembly (legacy display fallback). */
    firstAssembledModel?: string;
    /** Steps observed; the guide rides the first step only. */
    stepsSeen: number;
}
/** In-memory per-session store owned by the plugin apply. */
export declare class WindRuntime {
    private readonly sessions;
    private readonly overrides;
    private readonly persist?;
    /** Optional persist callback fires on every session override change (host wiring). */
    constructor(persist?: (sid: string, enabled: boolean) => void);
    /** Evict the least-recently-inserted sessions beyond MAX_SESSIONS. */
    private evict;
    /** Effective session activation gate: the session override, or the model-gate default (true). */
    enabled(sid: string): boolean;
    /** Set the session override; true restores the model-gate default (no override). */
    setEnabled(sid: string, enabled: boolean): void;
    /** Load persisted overrides at startup (host wiring). */
    seedOverrides(entries: Iterable<readonly [string, boolean]>): void;
    /** Return (creating if needed) the state for a session id, evicting the oldest beyond the bound. */
    ensure(sid: string): SessionWindState;
    /** Read (without creating) the state for a session id. */
    get(sid: string): SessionWindState | undefined;
    /** Number of tracked sessions (test helper). */
    size(): number;
    /** Drop a session's state (test helper). */
    delete(sid: string): void;
    /** Record why the gate did not engage; never creates state for an unobserved session. */
    noteSkip(sid: string, reason: 'model' | 'preset' | 'session', preset?: string): void;
    /**
     * Mark a session terminal. A stopped session stays reportable so the
     * root-scoped card does not blank the instant a short-lived member ends; its
     * last wind route is still the newest wind fact.
     */
    markStopped(sid: string): void;
    /**
     * The sidebar snapshot. The card is root-scoped and cannot know which
     * session the user views, so it reports the most recently observed session.
     * The state carries the truth the card renders: `engaged` (the model gate
     * passed at least once), `model` (latest observed route), and `lastSkip`
     * (why wind currently does not participate, cleared on a live assembly).
     */
    statusView(): {
        state: SessionWindState;
        active: boolean;
    } | null;
}
