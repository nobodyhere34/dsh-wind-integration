/**
 * Wind routing core — task classification, persona selection, staged tool
 * ladder, and system-prompt section builders. All pure and offline-testable.
 *
 * The classification/persona logic is ported (MIT) from dsh-routing-suite
 * `preset/router-standard/router-core-v34.mjs` so this package reproduces the
 * "风插/wind" router behavior without depending on the preset tree.
 * Attribution: dsh-routing-suite (© 2026 yjh051108), MIT.
 */
import type { PromptSection } from './types.js';
/** A classified task mode: a band index (0/0.3/1) or the string 'weak'. */
export type TaskMode = number | 'weak';
/** Behavior band a mode quantizes to. */
export type BandName = 'spec' | 'mixed' | 'react' | 'weak';
export declare const MODE_SPEC = 0;
export declare const MODE_MIXED = 0.3;
export declare const MODE_REACT = 1;
export declare const MODE_WEAK = "weak";
/** True when the model id names a Flash-family model. */
export declare function isFlashModel(modelId: string | undefined): boolean;
/** Long or architecturally-worded tasks are complex. */
export declare function isComplexTask(text: string): boolean;
/** Quantize a task mode to a stable behavior band. */
export declare function bandOf(mode: TaskMode | undefined): BandName;
/** Classify a user task text into a reasoning mode (0 / 0.3 / 1 / 'weak').
 * Clear keyword evidence picks a stable band; ambiguous text returns 'weak'
 * so the model routes itself (same hit-count rule as upstream router-core-v34). */
export declare function classifyTask(text: string): TaskMode;
/** Extract the display text from a user message (content array or plain string). */
export declare function extractText(message: unknown): string;
/** Band persona (weak is model-specific: flash family gets the neutral classify-and-act persona). */
export declare function personaForBand(band: BandName | undefined, modelId: string | undefined): string;
/** Staged tool ladder (wind progressive disclosure). */
export declare const STAGES: ReadonlyArray<{
    name: string;
    tools: readonly string[];
    goal: string;
}>;
/** Tools that stay available at every stage. */
export declare const WIND_META_TOOLS: readonly string[];
/** Union of all stage tools — the full write surface when disclosure is released. */
export declare const WIND_GLOBAL_SAFE: readonly string[];
/** End index (exclusive) of the stage slice exposed at a given stage: only the current stage. */
export declare function windowFor(stage: number): number;
/** Advance at most one stage per call from tool evidence plus tightened wording
 * (upstream v34: /方案|计划/ was removed because it fired too early). */
export declare function advanceStage(stage: number, toolNames: Iterable<string>, text: string): number;
/** The near-field guide text (same-request, appended once on the first pre-step). */
export declare function buildGuide(band: BandName | undefined, modelId: string | undefined): string;
/** Persistent declaration appended to every wind assembly. */
export declare function buildDeclaration(): string;
/** The stage section text: current stage, unlocked tools, and next goal. */
export declare function buildStageText(stage: number, modelId: string | undefined, band: BandName | undefined, fullCatalog: boolean): string;
/** Replace every persona-named section with one appended wind persona (upstream
 * v34 semantics: official persona is removed, everything else is preserved). */
export declare function applyPersona(sections: PromptSection[], personaText: string): PromptSection[];
/** Sections added on top of the official sections when wind engages. */
export declare function windExtraSections(stage: number, band: BandName | undefined, modelId: string | undefined, fullCatalog: boolean): PromptSection[];
/** Readable band label for the wind_status report. */
export declare function bandLabel(band: BandName | undefined): string;
