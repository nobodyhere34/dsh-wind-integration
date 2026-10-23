/**
 * Wind integration plugin — structural types.
 *
 * The plugin is injected into the web profile host and consumes agent-scoped
 * events with these loose structural interfaces (instead of importing the DSH
 * packages) so the package type-checks offline and stays decoupled from the
 * harness's exact type names. Values are resolved defensively at runtime.
 */
import type { Volatile } from 'cordis';
/** One section in a system-prompt assembly. */
export interface PromptSection {
    name: string;
    text?: string;
    order?: number;
}
/** The assembled system-prompt surface consumed by `system-prompt/assemble`. */
export interface PromptAssembly {
    sections?: PromptSection[];
    contexts?: unknown[];
    tools?: {
        name: string;
    }[];
    variables?: Record<string, unknown>;
}
/** Pre-step decision a waterfall listener returns. */
export interface PreStepDecision {
    kind: 'enter' | 'reject';
    messages: Array<Record<string, unknown>>;
}
/** A user-role message we append to a pre-step decision (same-request guidance). */
export type InjectedMessage = {
    role: 'user';
    content: {
        type: 'text';
        text: string;
    }[];
    /** Producer-owned V4 kind; the retired `{kind:'plugin', plugin}` wrapper is rejected by DSH ≥0.1.7 admission. */
    source: {
        kind: `plugin:${string}`;
    } & Record<string, unknown>;
} & Record<string, unknown>;
/** Runtime agent/session face we rely on (resolved live from event payloads). */
export interface WindAgentFace {
    id?: string;
    options?: {
        model?: string;
    };
    session?: {
        id?: string;
    };
    ctx?: {
        get?: (service: string) => unknown;
        effect?: (fn: () => unknown, label?: string) => unknown;
    };
}
/** Plugin configuration (schemastery schema in index.ts; defaults mirror the design). */
export interface WindConfig {
    /** Exact model ids that activate wind behavior (live settings field). */
    targetModels: Volatile<string[]>;
    /** Fuzzy fallback: /v4/i and contains '0731' (live settings field). */
    matchV4Fallback: Volatile<boolean>;
    /** Preset ids that are already wind-native (router-standard/spec/pro) — skip overlay to avoid double-write. */
    skipPresets: string[];
    /** Presentation modes that must NOT have tools restricted (PTC etc.). */
    preservePresentationModes: string[];
    /** Apply progressive staged tool disclosure on native-presented sessions. */
    stageRestrict: boolean;
    /** Inject once-per-session near-field guidance on the first pre-step. */
    guideEnabled: boolean;
    /** Continue a text-only turn that ends with a progress report (legacy-model compatibility). */
    legacyContinuation: Volatile<boolean>;
    /** Model id patterns for legacy continuation (case-insensitive substring; '*' wildcard). */
    legacyModels: Volatile<string[]>;
    /** Hard cap of continuation messages per turn. */
    legacyContinuationMaxPerTurn: Volatile<number>;
    /** User-role message steered into a stalled legacy turn. */
    legacyContinuationPrompt: string;
    /** Log wind decisions to the host console. */
    debugLog: boolean;
}
/** Config values resolved from Volatile fields for one decision. */
export interface WindResolvedConfig extends Omit<WindConfig, 'targetModels' | 'matchV4Fallback' | 'legacyContinuation' | 'legacyModels' | 'legacyContinuationMaxPerTurn'> {
    /** Exact model ids that activate wind behavior. */
    targetModels: readonly string[];
    /** Fuzzy fallback: /v4/i and contains '0731'. */
    matchV4Fallback: boolean;
    /** Legacy continuation switch resolved from its volatile field. */
    legacyContinuation: boolean;
    /** Legacy model patterns resolved from their volatile field. */
    legacyModels: readonly string[];
    /** Per-turn continuation cap resolved from its volatile field. */
    legacyContinuationMaxPerTurn: number;
}
