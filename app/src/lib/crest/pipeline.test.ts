// The pipeline as data (pipeline.ts): step completion, the status bar's n/8, and the top tabs mapped onto the steps.
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { analyze, STEPS } from "./engine.ts";
import {
  firstOpenWorkflowStep,
  pipelineProgress,
  railState,
  STEP_DONE,
  STEP_DONE_RULE,
  STEP_ORDER,
  stepForTab,
  tabForStep,
  TABS,
} from "./pipeline.ts";
import { blankDam, SAMPLE_DAMS } from "./samples.ts";
import type { DamRecord, StepId } from "./types.ts";

const sample = (): DamRecord => structuredClone(SAMPLE_DAMS[0]);
/** A record with nothing entered yet (a NID pick before elevations and datum). */
const empty = (): DamRecord => ({ ...blankDam(), heightFt: NaN, storageAcFt: NaN, crestFt: NaN, streambedFt: NaN, statedDatum: "" });

describe("pipeline steps", () => {
  it("covers the engine's eight steps in order, each with a rule", () => {
    assert.deepEqual([...STEP_ORDER], STEPS.map((s) => s.id));
    for (const id of STEP_ORDER) {
      assert.equal(typeof STEP_DONE[id], "function");
      assert.ok(STEP_DONE_RULE[id].length > 5);
    }
  });

  it("a blank record has nothing complete; a complete sample has its inputs and screen", () => {
    const blank = empty();
    assert.equal(pipelineProgress(blank, { screen: { level: "Review" } }).done, 0);
    const d = sample();
    const p = pipelineProgress(d, analyze(d));
    const done = new Set(p.steps.filter((s) => s.done).map((s) => s.id));
    assert.equal(p.total, 8);
    for (const id of ["setup", "record", "breach"] as StepId[]) assert.ok(done.has(id), id);
    // No terrain outline, no imported run, no classify: those steps are not complete.
    for (const id of ["flood", "results", "dashboard", "report"] as StepId[]) assert.ok(!done.has(id), id);
  });

  it("an imported run of record completes flood, results and dashboard; a classify result completes report", () => {
    const d = sample();
    const a = analyze(d);
    const before = pipelineProgress(d, a).done;
    d.resultsOfRecord = { source: "lisflood", label: "LISFLOOD-FP", files: [], importedAt: "2026-11-21", crs: "EPSG:26914", stats: {} as never, samples: [], warnings: [] };
    assert.equal(pipelineProgress(d, a).done, before + 3);
    d.hazardResult = { suggestedClass: "High" } as never;
    assert.equal(pipelineProgress(d, a).done, before + 4);
  });

  it("the screen is not complete while it is held at Review", () => {
    const d = sample();
    assert.equal(STEP_DONE.screen(d, { screen: { level: "Review" } }), false);
    assert.equal(STEP_DONE.screen(d, { screen: { level: "Low" } }), true);
  });

  it("rail marks: current wins, a record missing inputs is blocked, else done or todo", () => {
    const blank = empty();
    const a = { screen: { level: "Review" as const } };
    assert.equal(railState("record", blank, a, "record"), "current");
    assert.equal(railState("record", blank, a, "setup"), "blocked");
    assert.equal(railState("setup", blank, a, "record"), "blocked");
    assert.equal(railState("flood", blank, a, "setup"), "todo");
    const d = sample();
    assert.equal(railState("breach", d, analyze(d), "setup"), "done");
  });
});

describe("tabs", () => {
  it("every step is in exactly one tab", () => {
    for (const id of STEP_ORDER) assert.equal(TABS.filter((t) => t.steps.includes(id)).length, 1, id);
    assert.deepEqual(TABS.map((t) => t.label), ["Workflow", "Dashboard", "Review", "Export & Hand-off"]);
  });

  it("the tab follows the step, and a tab opens its step", () => {
    assert.equal(tabForStep("breach"), "workflow");
    assert.equal(tabForStep("dashboard"), "dashboard");
    assert.equal(tabForStep("screen"), "review");
    assert.equal(tabForStep("report"), "export");
    for (const t of TABS) assert.equal(tabForStep(stepForTab(t.id, null)), t.id);
  });

  it("Workflow returns to the last Workflow step, else the first one not complete, else Guided setup", () => {
    assert.equal(stepForTab("workflow", "flood"), "flood");
    assert.equal(stepForTab("workflow", "report", "breach"), "breach");
    assert.equal(stepForTab("workflow", null, null), "setup");
    const d = sample();
    assert.equal(firstOpenWorkflowStep(d, analyze(d)), "flood");
    assert.equal(firstOpenWorkflowStep(empty(), { screen: { level: "Review" } }), "setup");
  });
});
