/**
 * Delivery gate — port of dsh-routing-suite router-bootstrap v34 `deliveryCheck`
 * (MIT, yjh051108/dsh-routing-suite) into the wind plugin, with two wind-port
 * deltas:
 *  - the headless smoke check runs through an *injected runner* (`deps.smoke`)
 *    instead of a built-in browser: page deliverables (args.url) require
 *    headless-smoke unless `requireSmoke:false` is passed explicitly, and an
 *    absent runner FAILs the check deterministically (no silent pass);
 *  - every filesystem probe goes through injected deps (`readFile`, `exists`,
 *    `cwd`) so the validator is pure and offline-testable against temp dirs.
 *
 * Model-facing contract (unchanged from upstream): a delivery may be declared
 * completed only after the gate returns PASS; any FAIL must be fixed and the
 * gate re-run — failure is not bypassable.
 */
/** One gate check outcome (contract: `name` / `pass` / `detail`). */
export interface DeliveryCheck {
    name: string;
    pass: boolean;
    detail: string;
}
/** Overall gate verdict: `ok` is true only when every check passes. */
export interface DeliveryVerdict {
    ok: boolean;
    checks: DeliveryCheck[];
}
/** Evidence manifest item (upstream schema; items are closed objects). */
export interface EvidenceItem {
    label?: string;
    kind?: string;
    target?: string;
    result?: string;
    reviewed?: boolean;
}
/** Evidence manifest: `{ items: [...] }`. */
export interface EvidenceManifest {
    items: EvidenceItem[];
}
/** Gate arguments (validated at the tool boundary when called as a tool). */
export interface DeliveryCheckArgs {
    /** Deliverable file path (absolute, or resolved against `deps.cwd`). */
    file?: string;
    /** Page deliverable URL — presence turns the gate into a page gate. */
    url?: string;
    /** Default true; false skips the injected headless smoke (non-page artifacts). */
    requireSmoke?: boolean;
    /** Smoke hard timeout in milliseconds (forwarded to the runner). */
    timeoutMs?: number;
    /** Smoke virtual-time budget in milliseconds (forwarded to the runner). */
    virtualTimeMs?: number;
    /** Smoke retry-once flag (forwarded to the runner). */
    retry?: boolean;
    /** Evidence manifest — required by the delivery-evidence check. */
    evidence?: EvidenceManifest;
}
/** Filesystem facts for one path (deps.exists result; must never throw). */
export interface DeliveryFileInfo {
    exists: boolean;
    isFile: boolean;
    size: number;
    mtime?: string;
}
/** Injected headless-smoke runner outcome. */
export interface DeliverySmokeResult {
    ok: boolean;
    detail?: string;
}
/** Options forwarded to the injected smoke runner. */
export interface DeliverySmokeOptions {
    timeoutMs?: number;
    virtualTimeMs?: number;
    retry?: boolean;
}
/** Injected headless-smoke runner for page deliverables. */
export type DeliverySmokeRunner = (url: string, options?: DeliverySmokeOptions) => DeliverySmokeResult | Promise<DeliverySmokeResult>;
/** Injection seam: the validator reads and writes nothing directly. */
export interface DeliveryDeps {
    /** Probe one path; must never throw (missing file → exists:false). */
    exists(file: string): DeliveryFileInfo;
    /** Read file bytes for the encoding check; throws when unreadable. */
    readFile(file: string): Uint8Array | string;
    /** Headless-smoke runner; absent → page smoke FAILs (no silent pass). */
    smoke?: DeliverySmokeRunner;
    /** Base directory for relative artifact paths (defaults to process.cwd()). */
    cwd?: string;
}
/** Minimal cordis context face the registration needs (wind-native style). */
export interface DeliveryCheckContext {
    tools: {
        register: (def: unknown) => unknown;
    };
    effect?: <T>(fn: () => T, label?: string) => T;
}
/** Allowed evidence kinds (upstream set, verbatim). */
export declare const DELIVERY_EVIDENCE_KINDS: readonly ["file", "page", "image", "run", "test", "text", "external", "numeric"];
export type DeliveryEvidenceKind = (typeof DELIVERY_EVIDENCE_KINDS)[number];
/**
 * Pure delivery validator, equivalent to upstream `deliveryCheck`.
 * Runs the required file checks (file-exists / file-nonempty / encoding-utf8),
 * the headless-smoke check for page deliverables via `deps.smoke`, and the
 * delivery-evidence manifest gate; returns the overall PASS/FAIL verdict.
 * @param args - gate arguments as declared by the tool schema.
 * @param deps - injected filesystem/smoke seam (never touches the network).
 * @returns verdict; `ok` is true only when every check passed.
 */
export declare function deliveryCheck(args: DeliveryCheckArgs | undefined, deps: DeliveryDeps): Promise<DeliveryVerdict>;
/**
 * Pure native render: one text block with the verdict line, every check line,
 * and the model-facing PASS/FAIL contract sentence.
 * @param _args - tool arguments (unused; render is replay-safe).
 * @param v - validated verdict value.
 */
export declare function deliveryCheckRender(_args: unknown, v: DeliveryVerdict): Array<{
    type: 'text';
    text: string;
}>;
/**
 * Register the `delivery_check` tool on a cordis context through
 * `ctx.effect`, in the wind repo's native style (same literal ToolDefinition
 * shape `registerWindStatus` uses — no dsh-tools import, so the ambient
 * module augmentation stays out of the host program). The parameters are the
 * compiled JSON schema `defineTool` would produce, so `ctx.tools.register`
 * validates model arguments identically.
 * @param ctx - context exposing `tools.register` (+ optional `effect`).
 * @param deps - injected filesystem/smoke seam for the gate.
 * @returns disposal that unregisters the tool (no-op without an effect scope).
 */
export declare function registerDeliveryCheck(ctx: DeliveryCheckContext, deps: DeliveryDeps): () => void;
