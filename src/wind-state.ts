/**
 * Session-scoped wind runtime state (in-memory, keyed by session id).
 */
import type { BandName, TaskMode } from './wind-core.js'

/** Mutable per-session wind state. */
export interface SessionWindState {
  sid: string
  /** The wind model gate passed at least once for this session. */
  engaged: boolean
  /** Why wind currently does not participate, from the latest observation; cleared on a live assembly. */
  lastSkip?: { reason: 'model' | 'preset' | 'session' | 'ended'; preset?: string }
  /** Terminal agent/status observed; wind no longer participates live. */
  stopped?: boolean
  /** Latest observed route (refreshed per engaged assembly; survives mid-session model switches). */
  model?: string
  /** Classified task mode (a band index or 'weak'), once the first user text arrives. */
  mode?: TaskMode
  /** Mode quantized to a band name, for display/persona selection. */
  band?: BandName
  /** Progressive disclosure stage index (0..STAGES.length-1). */
  stage: number
  /** First real user task text captured at inbox/claimed. */
  firstText?: string
  /** Near-field guide already injected for this session (once). */
  guided: boolean
  /** Number of target-model assemblies that injected wind sections. */
  injectedAssemblies: number
  /** Restrict was requested for this session (decision.restrict). */
  restrictRequested: boolean
  /** The host restrict disposer was applied. */
  restrictApplied: boolean
  /** Live disposer to release the current restrict before a re-restrict/full catalog. */
  restrictDisposer?: () => void
  /** wind_status was registered on the agent scope. */
  toolRegistered: boolean
  /** Model id captured at the first wind assembly (legacy display fallback). */
  firstAssembledModel?: string
  /** Steps observed; the guide rides the first step only. */
  stepsSeen: number
}

/** Retained per-session states; the oldest observation is evicted beyond it. */
const MAX_SESSIONS = 64

/** In-memory per-session store owned by the plugin apply. */
export class WindRuntime {
  private readonly sessions = new Map<string, SessionWindState>()
  private readonly overrides = new Map<string, boolean>()
  private readonly persist?: (sid: string, enabled: boolean) => void

  /** Optional persist callback fires on every session override change (host wiring). */
  constructor(persist?: (sid: string, enabled: boolean) => void) {
    this.persist = persist
  }

  /** Evict the least-recently-inserted sessions beyond MAX_SESSIONS. */
  private evict(): void {
    for (let i = 0; i + MAX_SESSIONS < this.sessions.size; i++) {
      const oldest = this.sessions.keys().next().value as string | undefined
      if (oldest === undefined) return
      this.sessions.delete(oldest)
    }
  }

  /** Effective session activation gate: the session override, or the model-gate default (true). */
  enabled(sid: string): boolean {
    return this.overrides.get(sid) ?? true
  }

  /** Set the session override; true restores the model-gate default (no override). */
  setEnabled(sid: string, enabled: boolean): void {
    if (enabled) this.overrides.delete(sid)
    else this.overrides.set(sid, false)
    const st = this.sessions.get(sid)
    if (st !== undefined) {
      if (!enabled) st.lastSkip = { reason: 'session' }
      else if (st.engaged) st.lastSkip = undefined
    }
    this.persist?.(sid, enabled)
  }

  /** Load persisted overrides at startup (host wiring). */
  seedOverrides(entries: Iterable<readonly [string, boolean]>): void {
    for (const [sid, enabled] of entries) this.overrides.set(sid, enabled)
  }

  /** Return (creating if needed) the state for a session id, evicting the oldest beyond the bound. */
  ensure(sid: string): SessionWindState {
    let st = this.sessions.get(sid)
    if (st === undefined) {
      st = {
        sid, stage: 0, guided: false, injectedAssemblies: 0,
        restrictRequested: false, restrictApplied: false, toolRegistered: false,
        engaged: false,
        stepsSeen: 0,
      }
      this.sessions.set(sid, st)
      this.evict()
    }
    return st
  }

  /** Read (without creating) the state for a session id. */
  get(sid: string): SessionWindState | undefined {
    return this.sessions.get(sid)
  }

  /** Number of tracked sessions (test helper). */
  size(): number {
    return this.sessions.size
  }

  /** Drop a session's state (test helper). */
  delete(sid: string): void {
    this.sessions.delete(sid)
  }

  /** Record why the gate did not engage; never creates state for an unobserved session. */
  noteSkip(sid: string, reason: 'model' | 'preset' | 'session', preset?: string): void {
    const st = this.sessions.get(sid)
    if (st !== undefined) st.lastSkip = { reason, ...(preset === undefined ? {} : { preset }) }
  }

  /**
   * Mark a session terminal. A stopped session stays reportable so the
   * root-scoped card does not blank the instant a short-lived member ends; its
   * last wind route is still the newest wind fact.
   */
  markStopped(sid: string): void {
    const st = this.sessions.get(sid)
    if (st === undefined) return
    st.lastSkip = { reason: 'ended' }
    // Re-insert so map insertion order (last-observed) reflects this stop.
    this.sessions.delete(sid)
    this.sessions.set(sid, st)
  }

  /**
   * The sidebar snapshot. The card is root-scoped and cannot know which
   * session the user views, so it reports the most recently observed session.
   * The state carries the truth the card renders: `engaged` (the model gate
   * passed at least once), `model` (latest observed route), and `lastSkip`
   * (why wind currently does not participate, cleared on a live assembly).
   */
  statusView(): { state: SessionWindState; active: boolean } | null {
    let last: SessionWindState | undefined
    for (const st of this.sessions.values()) last = st
    if (last === undefined) return null
    return { state: last, active: last.engaged && last.lastSkip === undefined && runtimeActive(last) }
  }
}

/** Wind still participates in the session: behavior was injected, or it is armed to act. */
function runtimeActive(st: SessionWindState): boolean {
  return st.injectedAssemblies > 0 || st.toolRegistered || st.restrictApplied
}
