// Which receptors drove the class (class-drivers.ts, 2026-11-27): the desk screen's drivers always explain its level,
// Hazard's drivers come from its own "driving" list (or the stored hits), and nothing here changes a class.
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { driverIds, hazardDrivers, layerOfId, parseDriving, screenDrivers } from "./class-drivers.ts";
import { parseClassifyList } from "./classify-list.ts";
import { choiceKey, choiceText, classifyReceptors, hazardStatus, receptorKey, reportLead } from "./classify-receptors.ts";
import { analyze, screenReceptors } from "./engine.ts";
import { damChoice } from "./jurisdiction.ts";
import { analysisOfRecord } from "./results.ts";
import { classBadge } from "./review-summary.ts";
import { SAMPLE_DAMS } from "./samples.ts";
import type { Analysis, DamRecord, HazardResult } from "./types.ts";

type Ranked = Analysis["flood"]["receptors"][number];
const ORDER = { High: 3, Medium: 2, Low: 1 } as const;

/** Every sample, and variants that push the screen around (bigger dam, short reach -> Review, old judgment option). */
function variants(): DamRecord[] {
  const out: DamRecord[] = [];
  for (const s of SAMPLE_DAMS) {
    const d = structuredClone(s);
    out.push(d);
    out.push({ ...structuredClone(s), heightFt: s.heightFt * 2, storageAcFt: s.storageAcFt * 5 });
    out.push({ ...structuredClone(s), reachKm: 0.3 });
    out.push({ ...structuredClone(s), judgmentAsProbable: true, heightFt: s.heightFt * 1.5 });
    out.push({ ...structuredClone(s), heightFt: Math.max(3, s.heightFt / 3), storageAcFt: Math.max(5, s.storageAcFt / 20) });
  }
  return out;
}

describe("the desk screen's drivers", () => {
  it("explain the level on every sample and variant, and change nothing", () => {
    const levels = new Set<string>();
    for (const d of variants()) {
      const a = analyze(d);
      const before = JSON.stringify(a);
      const s = screenDrivers(a, d.receptors);
      assert.equal(JSON.stringify(a), before, `${d.id}: the analysis is not touched`);
      assert.equal(s.consistent, true, `${d.id}: ${a.screen.level}`);
      assert.equal(s.level, a.screen.level);
      levels.add(a.screen.level);
      if (a.screen.level !== "Review") {
        const sets = s.drivers.filter((x) => x.role === "sets");
        if (sets.length) assert.ok(sets.every((x) => x.ndClass === a.screen.level), `${d.id}: every setter is at the level`);
        else assert.equal(a.screen.level, "Low", `${d.id}: nothing counts, so Low`);
        // No receptor outside the drivers is at a higher class.
        for (const r of a.flood.receptors) if (!r.unresolved && r.ndClass) assert.ok(ORDER[r.ndClass] <= ORDER[a.screen.level as "High"]);
      } else {
        assert.ok(s.drivers.some((x) => x.role === "holds"), `${d.id}: Review is held by an unresolved receptor`);
      }
      // The same with the analysis of record (an imported run reranks the receptors).
      assert.equal(screenDrivers(analysisOfRecord(d, a).result, d.receptors).consistent, true);
    }
    assert.ok(levels.size >= 3, `the variants reach several levels (${[...levels].join(", ")})`);
  });

  it("agree with screenReceptors on random receptor sets (property test, 500 cases)", () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)];
    const kinds = ["house", "mobile", "barn", "road", "rail"] as const;
    for (let n = 0; n < 500; n++) {
      const rs: Ranked[] = Array.from({ length: 1 + Math.floor(rnd() * 6) }, (_, i) => {
        const unresolved = rnd() < 0.15;
        const ndClass = pick([null, null, "Low", "Medium", "High"] as const);
        return {
          id: `r${i}`, name: `R${i}`, kind: pick(kinds), station: 0, distanceKm: i, lateral: 0,
          depthFt: rnd() * 6, velocityFps: rnd() * 8, arrivalHr: null, flooded: true, unresolved,
          outsideAoi: unresolved && rnd() < 0.5, wouldBe: null, zone: pick([null, "low", "judgment", "high"] as const),
          ndClass, rankReason: "x", needsJudgment: rnd() < 0.2,
        } as Ranked;
      });
      const screen = screenReceptors(rs, [], { judgmentAsProbable: rnd() < 0.3 });
      const s = screenDrivers({ flood: { receptors: rs } as Analysis["flood"], screen });
      assert.equal(s.consistent, true, JSON.stringify({ level: screen.level, rs: rs.map((r) => [r.kind, r.ndClass, r.unresolved]) }));
    }
  });

  it("names the setters and the receptors that hold Review", () => {
    const rs = [
      { id: "a", name: "A", kind: "house", ndClass: "Medium", unresolved: false, depthFt: 1, velocityFps: 1, rankReason: "judgment", needsJudgment: false, zone: "judgment" },
      { id: "b", name: "B", kind: "road", ndClass: "Low", unresolved: false, depthFt: 1, velocityFps: 1, rankReason: "AADT 100", needsJudgment: false, zone: null },
      { id: "c", name: "C", kind: "house", ndClass: null, unresolved: true, outsideAoi: false, depthFt: 0, velocityFps: 0, rankReason: "past the reach", needsJudgment: true, zone: null },
      { id: "d", name: "D", kind: "barn", ndClass: null, unresolved: false, depthFt: 2, velocityFps: 1, rankReason: "barn is not habitable; not counted", needsJudgment: false, zone: "low" },
    ] as unknown as Ranked[];
    const screen = screenReceptors(rs);
    assert.equal(screen.level, "Review");
    const s = screenDrivers({ flood: { receptors: rs } as Analysis["flood"], screen });
    assert.deepEqual(s.receptors.map((x) => [x.id, x.role]), [["a", "sets"], ["b", "below"], ["c", "holds"], ["d", "not counted"]]);
    assert.deepEqual(s.drivers.map((x) => x.id), ["a", "c"]);
    assert.equal(s.resolvedClass, "Medium");
  });
});

const nd199 = (): DamRecord => structuredClone(SAMPLE_DAMS.find((d) => d.nid === "ND00199")!);
function classified(d: DamRecord, extra: Partial<HazardResult> = {}): DamRecord {
  const a = analyze(d);
  d.hazardResult = {
    suggestedClass: "High",
    ordinal: "3",
    gpkg: "/w/classify/damit_hazard_receptors.gpkg",
    complete: true,
    notChecked: {},
    classifiedAt: "2026-11-21T20:00:00Z",
    choiceKey: choiceKey(damChoice(d)),
    receptorKey: receptorKey(classifyReceptors(d, a)),
    choiceText: choiceText(damChoice(d)),
    ...extra,
  } as HazardResult;
  return d;
}

const HITS: HazardResult["hits"] = [
  { method: "M8a", ordinal: 3, label: "High", strength: "rule", reason: "road AADT 2390", scenario: "S3", receptors: ["road:240", "road:241"], receptorCount: 2 },
  { method: "M9a", ordinal: 3, label: "High", strength: "rule", reason: "15 trains/day", scenario: "S3", receptors: ["rail:21", "rail:22", "rail:23", "rail:24", "rail:25"], receptorCount: 7 },
  { method: "M6", ordinal: 3, label: "High", strength: "advisory", reason: "advisory", scenario: "S3", receptors: ["structure:9"], receptorCount: 1 },
  { method: "M6", ordinal: 2, label: "Medium", strength: "rule", reason: "home wet", scenario: "S3", receptors: ["structure:28"], receptorCount: 1 },
];

describe("damit:classify's drivers", () => {
  it("come from Hazard's own driving list when the result carries the ids", () => {
    const d = classified(nd199(), {
      driving: [
        { method: "M8a", label: "High", reason: "road AADT 2390", receptors: 2, receptorIds: ["road:240", "road:241"] },
        { method: "M9a", label: "High", reason: "15 trains/day", receptors: 4, receptorIds: ["rail:21", "rail:22", "rail:23", "rail:24"] },
      ],
      hits: HITS,
    });
    const h = hazardDrivers(d.hazardResult);
    assert.equal(h.basis, "driving");
    assert.equal(h.complete, true);
    assert.equal(h.ordinal, 3);
    assert.deepEqual(h.receptors.map((r) => r.id), ["road:240", "road:241", "rail:21", "rail:22", "rail:23", "rail:24"]);
    assert.deepEqual(h.receptors.map((r) => r.layer), ["ROADS", "ROADS", "RAIL", "RAIL", "RAIL", "RAIL"]);
    assert.equal(h.receptorTotal, 6);
    assert.deepEqual([...driverIds(h)].length, 6);
  });

  it("fall back to the stored hits at the top class (rule only), marked incomplete when ids were cut", () => {
    const d = classified(nd199(), { driving: [{ method: "M8a", label: "High", reason: "road AADT 2390", receptors: 2 }], hits: HITS });
    const h = hazardDrivers(d.hazardResult);
    assert.equal(h.basis, "hits");
    assert.equal(h.complete, false, "M9a kept 5 of its 7 rail ids");
    assert.equal(h.receptorTotal, 9);
    assert.ok(!h.receptors.some((r) => r.id === "structure:9"), "an advisory hit does not drive a preset class");
    assert.ok(!h.receptors.some((r) => r.id === "structure:28"), "a Medium hit does not drive a High class");
  });

  it("are enriched from the receptor list (names, depths, needs ruling), or read from it when nothing else says", () => {
    const list = parseClassifyList({
      receptors: [
        { rid: "rail:21", layer: "RAIL", kind: "rail", name: "BNSF KO", ordinal: 3, label: "High", depthFt: 2.1, velFps: 1.2, methods: "M9a", flags: ["trains_lookup"], at: [-97.3, 46.9] },
        { rid: "road:240", layer: "ROADS", kind: "road", name: "I-94", ordinal: 3, label: "High", depthFt: 1.5, velFps: null, methods: "M8a", flags: [], at: [-97.2, 46.8] },
        { rid: "structure:9", layer: "STRUCTURES", kind: "home", name: "9 Main", ordinal: 3, label: "High", advisory: true, depthFt: 0.4, velFps: 0, methods: "M6", flags: [] },
        { rid: "structure:28", layer: "STRUCTURES", kind: "home", name: "28 Main", ordinal: 2, label: "Medium", depthFt: 0.6, velFps: 0, methods: "M6", flags: [] },
      ],
      total: 4,
      truncated: false,
      counts: {},
      gpkg: "/w/classify/damit_hazard_receptors.gpkg",
    })!;
    const withHits = hazardDrivers(classified(nd199(), { hits: HITS }).hazardResult, list);
    const rail = withHits.receptors.find((r) => r.id === "rail:21")!;
    assert.equal(rail.name, "BNSF KO");
    assert.equal(rail.needsRuling, true);
    const onlyList = hazardDrivers(classified(nd199()).hazardResult, list);
    assert.equal(onlyList.basis, "receptor list");
    assert.deepEqual(onlyList.receptors.map((r) => r.id), ["rail:21", "road:240"], "not the advisory one, not the Medium one");
    assert.equal(onlyList.complete, true);
    assert.equal(hazardDrivers(classified(nd199()).hazardResult).basis, "none");
  });

  it("do not touch the stored result, its status, the Report lead or the badge", () => {
    const d = classified(nd199(), { hits: HITS, driving: [{ method: "M8a", label: "High", reason: "r", receptors: 2, receptorIds: ["road:240", "road:241"] }] });
    const a = analyze(d);
    const before = JSON.stringify([d, hazardStatus(d, a), reportLead(d, a), classBadge(d, a)]);
    hazardDrivers(d.hazardResult);
    assert.equal(JSON.stringify([d, hazardStatus(d, a), reportLead(d, a), classBadge(d, a)]), before);
    assert.equal(hazardStatus(d, a).state, "current");
  });

  it("an ndhazard:classify result (one hit per receptor) gives every High receptor", () => {
    const hits = ["road:1", "road:2", "rail:3"].map((id) => ({ method: "Roads: AADT", ordinal: 3, label: "High", strength: "rule", reason: id, scenario: "breach", receptors: [id], receptorCount: 1 }));
    const h = hazardDrivers(classified(nd199(), { source: "ndhazard:classify", hits, hitsTotal: 3 }).hazardResult);
    assert.equal(h.basis, "hits");
    assert.equal(h.complete, true);
    assert.deepEqual(h.receptors.map((r) => r.id), ["road:1", "road:2", "rail:3"]);
  });
});

describe("parseDriving and layerOfId", () => {
  it("keeps good driving rows, the new ids optional, and caps them", () => {
    const got = parseDriving([
      { method: "M2", label: "High", reason: "r", receptors: 3, receptorIds: ["structure:1", 2, null, true] },
      { method: "M3", label: "Medium", reason: "r", receptors: 1 },
      "junk",
      { method: "M4", receptorIds: Array.from({ length: 80 }, (_, i) => `road:${i}`) },
    ]);
    assert.deepEqual(got[0], { method: "M2", label: "High", reason: "r", receptors: 3, receptorIds: ["structure:1", "2"] });
    assert.equal("receptorIds" in got[1], false, "a result from before 2026-11-27 has no ids");
    assert.equal(got.length, 3);
    assert.equal(got[2].receptorIds!.length, 50);
    assert.equal(got[2].receptors, 50, "no count: the ids stand in");
    assert.deepEqual(parseDriving("x"), []);
  });
  it("reads the layer from the receptor id", () => {
    assert.equal(layerOfId("structure:39"), "STRUCTURES");
    assert.equal(layerOfId("roads:4"), "ROADS");
    assert.equal(layerOfId("rail:21"), "RAIL");
    assert.equal(layerOfId("x"), "OTHER");
  });
});
