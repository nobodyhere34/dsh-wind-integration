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
import { markFor, catalogMarkExtra, helpUnlockLine, categorizeDomain, paramHint } from './phase-state.js';
import type { PhaseDeps, PhaseStateStore, PhaseToolDef } from './phase-state.js';
/** Minimal ctx face sufficient for registration; keeps the module testable without Cordis. */
export interface PhaseContextFace {
    tools: {
        register(def: unknown): unknown;
    };
    /** Optional effect wrapper; defaults to calling the callback directly. */
    effect?: (fn: () => unknown, label?: string) => unknown;
}
export type { PhaseDeps, PhaseStateStore, PhaseToolDef };
/** Per-parameter meta in the upstream spec shape ({ key: { type, required?, description } }). */
export interface ParamSpec {
    type?: string;
    enum?: readonly unknown[];
    description?: string;
    /** True marks the parameter as required in the generated JSON schema. */
    required?: boolean;
}
/** Normalized tool def handed to ctx.tools.register (JSON-schema parameters). */
export interface RegisteredToolDef {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    output: {
        schema: {
            type: 'string';
        };
        render: (_a: unknown, v: unknown) => {
            type: 'text';
            text: string;
        }[];
    };
    execute: (args: Record<string, unknown>, exec: {
        agent?: {
            session?: {
                id?: string;
            };
        };
    }) => Promise<string> | string;
}
/** Parameter-meta → JSON-schema conversion (port of the upstream toJsonSchema). */
export declare function toJsonSchema(spec: Record<string, ParamSpec>): Record<string, unknown>;
/** Registration adapter: turns a spec into a fully-shaped registered def. */
export declare function defineTool(spec: {
    name: string;
    description: string;
    parameters?: Record<string, ParamSpec>;
    output: RegisteredToolDef['output'];
    execute: RegisteredToolDef['execute'];
}): RegisteredToolDef;
/** The four phase tool defs, bound to the injected deps. */
export declare function phaseToolDefs(deps: PhaseDeps): RegisteredToolDef[];
/** Register the four phase tools through ctx.effect, per repo convention. */
export declare function registerPhaseTools(ctx: PhaseContextFace, deps: PhaseDeps): void;
/** Re-exported for host wiring that wants to annotate catalog rows itself. */
export { markFor, catalogMarkExtra, helpUnlockLine, categorizeDomain, paramHint };
