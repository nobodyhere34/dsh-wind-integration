/** Retained per-session states; the oldest observation is evicted beyond it. */
const MAX_SESSIONS = 64;
/** In-memory per-session store owned by the plugin apply. */
export class WindRuntime {
    sessions = new Map();
    overrides = new Map();
    persist;
    /** Optional persist callback fires on every session override change (host wiring). */
    constructor(persist) {
        this.persist = persist;
    }
    /** Evict the least-recently-inserted sessions beyond MAX_SESSIONS. */
    evict() {
        for (let i = 0; i + MAX_SESSIONS < this.sessions.size; i++) {
            const oldest = this.sessions.keys().next().value;
            if (oldest === undefined)
                return;
            this.sessions.delete(oldest);
        }
    }
    /** Effective session activation gate: the session override, or the model-gate default (true). */
    enabled(sid) {
        return this.overrides.get(sid) ?? true;
    }
    /** Set the session override; true restores the model-gate default (no override). */
    setEnabled(sid, enabled) {
        if (enabled)
            this.overrides.delete(sid);
        else
            this.overrides.set(sid, false);
        const st = this.sessions.get(sid);
        if (st !== undefined) {
            if (!enabled)
                st.lastSkip = { reason: 'session' };
            else if (st.engaged)
                st.lastSkip = undefined;
        }
        this.persist?.(sid, enabled);
    }
    /** Load persisted overrides at startup (host wiring). */
    seedOverrides(entries) {
        for (const [sid, enabled] of entries)
            this.overrides.set(sid, enabled);
    }
    /** Return (creating if needed) the state for a session id, evicting the oldest beyond the bound. */
    ensure(sid) {
        let st = this.sessions.get(sid);
        if (st === undefined) {
            st = {
                sid, stage: 0, guided: false, injectedAssemblies: 0,
                restrictRequested: false, restrictApplied: false, toolRegistered: false,
                engaged: false,
                stepsSeen: 0,
            };
            this.sessions.set(sid, st);
            this.evict();
        }
        return st;
    }
    /** Read (without creating) the state for a session id. */
    get(sid) {
        return this.sessions.get(sid);
    }
    /** Number of tracked sessions (test helper). */
    size() {
        return this.sessions.size;
    }
    /** Drop a session's state (test helper). */
    delete(sid) {
        this.sessions.delete(sid);
    }
    /** Record why the gate did not engage; never creates state for an unobserved session. */
    noteSkip(sid, reason, preset) {
        const st = this.sessions.get(sid);
        if (st !== undefined)
            st.lastSkip = { reason, ...(preset === undefined ? {} : { preset }) };
    }
    /**
     * Mark a session terminal. A stopped session stays reportable so the
     * root-scoped card does not blank the instant a short-lived member ends; its
     * last wind route is still the newest wind fact.
     */
    markStopped(sid) {
        const st = this.sessions.get(sid);
        if (st === undefined)
            return;
        st.lastSkip = { reason: 'ended' };
        // Re-insert so map insertion order (last-observed) reflects this stop.
        this.sessions.delete(sid);
        this.sessions.set(sid, st);
    }
    /**
     * The sidebar snapshot. The card is root-scoped and cannot know which
     * session the user views, so it reports the most recently observed session.
     * The state carries the truth the card renders: `engaged` (the model gate
     * passed at least once), `model` (latest observed route), and `lastSkip`
     * (why wind currently does not participate, cleared on a live assembly).
     */
    statusView() {
        let last;
        for (const st of this.sessions.values())
            last = st;
        if (last === undefined)
            return null;
        return { state: last, active: last.engaged && last.lastSkip === undefined && runtimeActive(last) };
    }
}
/** Wind still participates in the session: behavior was injected, or it is armed to act. */
function runtimeActive(st) {
    return st.injectedAssemblies > 0 || st.toolRegistered || st.restrictApplied;
}
//# sourceMappingURL=wind-state.js.map