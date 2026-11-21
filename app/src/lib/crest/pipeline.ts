/**
 * The desk's pipeline as data (DamIT Desk UI, 2026-11-21): which of the eight steps is complete, the n/8 the status bar
 * shows, and the top tabs (Workflow, Dashboard, Review, Export & Hand-off) mapped onto the same steps, so a tab and the
 * left rail always point at one step and cannot drift apart. Pure: no DOM, no store.
 *
 * "Complete" is read from the record and its analysis only, never from where the user clicked:
 *   setup      height and storage are entered
 *   record     crest elevation and its datum are entered
 *   breach     the breach bottom (streambed) is entered
 *   flood      a mapped flood layer is on record: the terrain outline is built, or a model run is the source of record
 *   results    a model run (LISFLOOD-FP or DSS-WISE) is imported as the source of record
 *   dashboard  there is a mapped flood layer to review (same test as flood)
 *   screen     the desk screen gives a level (not held at Review by a stop flag) and every input it needs is entered
 *   report     damit:classify has returned a class for this dam (Report step, Classify)
 */
import { missingForNext } from "./nid-dams.ts";
import type { DamRecord, ScreenLevel, StepId } from "./types.ts";

export const STEP_ORDER: readonly StepId[] = ["setup", "record", "breach", "flood", "results", "dashboard", "screen", "report"];

/** What a step needs from the analysis: only the screen level. */
export type PipelineAnalysis = { screen: { level: ScreenLevel } };

const hasFloodLayer = (d: DamRecord) => d.outline != null || d.resultsOfRecord != null;

export const STEP_DONE: Record<StepId, (d: DamRecord, a: PipelineAnalysis) => boolean> = {
  setup: (d) => Number.isFinite(d.heightFt) && Number.isFinite(d.storageAcFt),
  record: (d) => Number.isFinite(d.crestFt) && Boolean(d.statedDatum),
  breach: (d) => Number.isFinite(d.streambedFt),
  flood: hasFloodLayer,
  results: (d) => d.resultsOfRecord != null,
  dashboard: hasFloodLayer,
  screen: (d, a) => missingForNext(d).length === 0 && a.screen.level !== "Review",
  report: (d) => Boolean(d.hazardResult?.suggestedClass),
};

/** Why a step reads complete, in words (the status bar's tooltip). */
export const STEP_DONE_RULE: Record<StepId, string> = {
  setup: "height and storage entered",
  record: "crest and datum entered",
  breach: "breach bottom entered",
  flood: "terrain outline built or a model run of record",
  results: "a model run imported as the source of record",
  dashboard: "a mapped flood layer to review",
  screen: "the desk screen has a level (not held at Review)",
  report: "damit:classify returned a class",
};

export type RailState = "done" | "current" | "blocked" | "todo";

/** The rail's mark for one step: the current step, a step held by missing inputs, complete, or not started. */
export function railState(id: StepId, dam: DamRecord, a: PipelineAnalysis, current: StepId): RailState {
  if (id === current) return "current";
  const missing = missingForNext(dam).length > 0;
  if (id === "record" && missing) return "blocked";
  if (STEP_DONE[id](dam, a)) return "done";
  if (id === "setup" && missing) return "blocked";
  return "todo";
}

/** n of 8 steps complete, and which. */
export function pipelineProgress(dam: DamRecord, a: PipelineAnalysis): { done: number; total: number; steps: { id: StepId; done: boolean }[] } {
  const steps = STEP_ORDER.map((id) => ({ id, done: STEP_DONE[id](dam, a) }));
  return { done: steps.filter((s) => s.done).length, total: steps.length, steps };
}

export type TabId = "workflow" | "dashboard" | "review" | "export";

export const TABS: readonly { id: TabId; label: string; steps: readonly StepId[] }[] = [
  { id: "workflow", label: "Workflow", steps: ["setup", "record", "breach", "flood", "results"] },
  { id: "dashboard", label: "Dashboard", steps: ["dashboard"] },
  { id: "review", label: "Review", steps: ["screen"] },
  { id: "export", label: "Export & Hand-off", steps: ["report"] },
];

/** The tab a step belongs to: every step is in exactly one tab, so the rail selects the tab. */
export function tabForStep(step: StepId): TabId {
  return TABS.find((t) => t.steps.includes(step))?.id ?? "workflow";
}

/**
 * The step a tab opens. Workflow returns to the last Workflow step used (else the first one not complete, else
 * Guided setup); the other tabs each hold one step.
 */
export function stepForTab(tab: TabId, lastWorkflow: StepId | null, firstOpen: StepId | null = null): StepId {
  const t = TABS.find((x) => x.id === tab) ?? TABS[0];
  if (t.id !== "workflow") return t.steps[0];
  if (lastWorkflow && t.steps.includes(lastWorkflow)) return lastWorkflow;
  if (firstOpen && t.steps.includes(firstOpen)) return firstOpen;
  return t.steps[0];
}

/** The first Workflow step not complete, or null when all are. */
export function firstOpenWorkflowStep(dam: DamRecord, a: PipelineAnalysis): StepId | null {
  return TABS[0].steps.find((id) => !STEP_DONE[id](dam, a)) ?? null;
}
