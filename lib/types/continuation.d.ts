/**
 * Legacy-model continuation compatibility.
 *
 * Newer models put their next tool call in the same assistant message as the
 * progress text. Older models often end the message with "next I will ..." and
 * no tool call; the loop then treats the turn as complete. This module decides
 * whether such a text-only turn looks unfinished and should be steered on.
 *
 * Pure functions only: the caller supplies session events, the routed model id
 * and the resolved configuration.
 */
/** Resolved continuation policy. */
export interface ContinuationPolicy {
    /** Master switch; off by default (opt-in per deployment). */
    enabled: boolean;
    /** Model id patterns; '*' matches any run of characters, matching is case-insensitive substring. */
    models: readonly string[];
    /** Hard cap of continuations per turn (prevents loops on chatty models). */
    maxPerTurn: number;
    /** User-role message steered when a text-only turn looks unfinished. */
    prompt: string;
}
/** Last assistant message of one turn, reduced to what the decision needs. */
export interface AssistantTurnText {
    text: string;
    toolCalls: number;
}
/** True when the routed model id matches any configured legacy pattern. */
export declare function matchesLegacyModel(modelId: string | undefined, patterns: readonly string[]): boolean;
/** Number of pending/in-progress todos in the newest todo/write event. */
export declare function openTodoCount(events: readonly unknown[]): number;
/** The last assistant message of one turn, or undefined when the turn had none. */
export declare function lastAssistantOfTurn(events: readonly unknown[], turn: number): AssistantTurnText | undefined;
/** True when the text looks like a progress report rather than a final answer. */
export declare function looksUnfinished(text: string, openTodos: number): boolean;
/** One continuation decision with a reason for diagnostics. */
export interface ContinuationDecision {
    continue: boolean;
    reason: 'disabled' | 'model' | 'tools' | 'empty' | 'finished' | 'ok';
}
/** Decide whether a text-only turn should receive a continuation message. */
export declare function shouldContinue(input: {
    modelId?: string;
    last?: AssistantTurnText;
    openTodos: number;
}, policy: ContinuationPolicy): ContinuationDecision;
