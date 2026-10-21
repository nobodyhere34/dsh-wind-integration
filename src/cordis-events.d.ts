/**
 * Typed-event declaration merging for the wind hooks — mirrors the DSH
 * convention (packages augment `Events`) against the vendored cordis the
 * build links, so `ctx.on` for these agent-scoped event names type-checks
 * from this standalone package.
 */
import type { WindAgentFace } from './types.js'

declare module 'cordis' {
  interface Events {
    /** Waterfall: assemble a system prompt for an agent. */
    'system-prompt/assemble'(assembly: unknown, context: { agent?: WindAgentFace }, next: () => Promise<unknown>): unknown
    /** A user message was claimed by an agent. */
    'agent/inbox/claimed'(payload: { agent?: WindAgentFace; message?: unknown }): void
    /** Waterfall: prepare a pre-step decision (guide injection rides here). */
    'agent/pre-step'(payload: { agent?: WindAgentFace; messages?: unknown[]; step?: number }, next: () => Promise<unknown>): unknown
    /** Agent lifecycle status change (terminal cleanup). */
    'agent/status'(payload: { agent?: WindAgentFace; status?: string }): void
  }
}
