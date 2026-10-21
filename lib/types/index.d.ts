/**
 * dsh-wind-integration — Cordis native plugin (no dsh-hook-protocol).
 *
 * Integrates the 风插 (dsh-routing-suite router-standard) behavior into DSH at
 * runtime: when a session's model matches the wind gate (default exact id
 * DeepSeek-V4-Flash-0731, plus the /v4/i && '0731' fuzzy fallback), ANY preset
 * gains wind behavior — band persona, stage line, wind declaration, and
 * progressive tool disclosure — while non-native presentations (ptc/both)
 * receive behavior only and never lose tool control.
 *
 * Host-only wiring: every contribution registers through ctx.on / ctx.effect,
 * so the plugin works whether mounted by a preset or injected at runtime by
 * the dsh-super-injector channel (zero restart, no profile persistence).
 */
import type { Context } from 'cordis';
import z from 'schemastery';
import type { WindConfig } from './types.js';
export declare const name = "dsh-wind-integration";
export declare const inject: string[];
export declare const Config: z<Schemastery.ObjectS<NoInfer<{
    targetModels: z<string[], string[], "defined">;
    matchV4Fallback: z<boolean, boolean, "defined">;
    skipPresets: z<string[], string[], "defined">;
    preservePresentationModes: z<string[], string[], "defined">;
    stageRestrict: z<boolean, boolean, "defined">;
    guideEnabled: z<boolean, boolean, "defined">;
    debugLog: z<boolean, boolean, "defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    targetModels: z<string[], string[], "defined">;
    matchV4Fallback: z<boolean, boolean, "defined">;
    skipPresets: z<string[], string[], "defined">;
    preservePresentationModes: z<string[], string[], "defined">;
    stageRestrict: z<boolean, boolean, "defined">;
    guideEnabled: z<boolean, boolean, "defined">;
    debugLog: z<boolean, boolean, "defined">;
}>>, "plain">;
export declare function apply(ctx: Context, config: WindConfig): void;
