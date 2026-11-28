// rationale.json (rationale.ts, 2026-11-27): the schema, the example in docs/, the status words shared with the Report
// lead and the badge, the DEM checksum and model versions, and that building one changes nothing.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { classBanner, driversLine } from "./class-banner.ts";
import { hazardDrivers } from "./class-drivers.ts";
import { choiceKey, choiceText, classifyReceptors, receptorKey, reportLead } from "./classify-receptors.ts";
import { analyze, ENGINE_VERSION } from "./engine.ts";
import { fetchDemDigest } from "./dem-source.ts";
import { damChoice } from "./jurisdiction.ts";
import { buildRationale, checkRationale, demFallback, modelVersions, RATIONALE_FORMAT, RATIONALE_SCHEMA_VERSION, rationaleFileName, rationaleText, type DemDigest } from "./rationale.ts";
import { analysisOfRecord } from "./results.ts";
import { classBadge } from "./review-summary.ts";
import { SAMPLE_DAMS } from "./samples.ts";
import type { DamRecord, HazardResult, ResultsOfRecord } from "./types.ts";
import { CREST_VERSION } from "./version.ts";

const NOW = new Date("2026-11-27T22:00:00Z");
const nd199 = (): DamRecord => structuredClone(SAMPLE_DAMS.find((d) => d.nid === "ND00199")!);
const SHA = "9f2c1d7e5b3a40c8e6f1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f7";
const LOCAL: DemDigest = { kind: "local", path: "/data/dem/cass_10m_3dep.vrt", sha256: SHA, bytes: 48213, modified: "2026-11-18T15:02:11Z", note: "SHA-256 of the .vrt file itself; the tiles it lists are not hashed." };

function classified(d: DamRecord, extra: Partial<HazardResult> = {}): DamRecord {
  const a = analyze(d);
  d.hazardResult = {
    suggestedClass: "High",
    ordinal: "3",
    genericLabel: "High",
    report: "/w/dams/ND00199/classify/damit_hazard_report.md",
    gpkg: "/w/dams/ND00199/classify/damit_hazard_receptors.gpkg",
    ranPreset: "ND",
    ranPresetLabel: "North Dakota (REG_05.2026)",
    ranMode: "preset",
    driving: [
      { method: "M8a", label: "High", reason: "road impacted: AADT 2390", receptors: 2, receptorIds: ["road:240", "road:241"] },
      { method: "M9a", label: "High", reason: "freight line, 15 trains/day", receptors: 4, receptorIds: ["rail:21", "rail:22", "rail:23", "rail:24"] },
    ],
    hitsTotal: 41,
    warnings: 2,
    layers: { STRUCTURES: 1670, ROADS: 263, RAIL: 34 },
    impacted: { STRUCTURES: 12, ROADS: 11, RAIL: 6 },
    wetStructures: 230,
    complete: true,
    notChecked: {},
    layerSources: { STRUCTURES: "USACE NSI", ROADS: "the DamIT data folder", RAIL: "the DamIT data folder" },
    railTrainsLookup: "/w/lookups/nd_rail_trains.csv",
    ruling: { label: "High", hits: 6, unruled: 4, why: ["BNSF KO Subdivision: 15 trains/day from the rail lookup needs a ruling"] },
    source: "damit:classify",
    classifiedAt: "2026-11-21T20:14:03Z",
    choiceKey: choiceKey(damChoice(d)),
    receptorKey: receptorKey(classifyReceptors(d, a)),
    choiceText: choiceText(damChoice(d)),
    ...extra,
  } as HazardResult;
  return d;
}

const RUN: ResultsOfRecord = {
  source: "lisflood",
  label: "LISFLOOD-FP (ND00199, DamIT Runner 0.9.0, Boann 5.0.0)",
  files: ["/w/dams/ND00199/runs/boann/max_depth.tif", "/w/dams/ND00199/runs/boann/max_velocity.tif"],
  importedAt: "2026-11-22T16:40:00Z",
  crs: "EPSG:26914",
  stats: { peakDepthFt: 14.2, peakDepthAllFt: 22.1, wetAc: 1840, wetAcAll: 2100, farthestKm: 18.4, maxVelocityFps: 9.1, arrivalMaxHr: 6.5, nearestWetM: 0, edgeWetCells: 0, coverKm: 30, cellM: 10, cells: 1, breachLon: -97.3, breachLat: 46.9 },
  samples: [],
  warnings: [],
};

describe("rationale.json", () => {
  it("is valid against its own schema for every sample, classified or not, with any DEM state", () => {
    for (const s of SAMPLE_DAMS) {
      for (const d of [structuredClone(s), classified(structuredClone(s))]) {
        const a = analyze(d);
        for (const dem of [null, LOCAL, { ...LOCAL, kind: "3dep" as const, path: null, sha256: null, note: "USGS 3DEP" }])
          for (const profile of ["us", "nd"] as const) {
            const r = buildRationale({ dam: d, result: a, profile, now: NOW, dem });
            assert.deepEqual(checkRationale(JSON.parse(rationaleText(r))), [], `${d.id} ${profile}`);
          }
      }
    }
  });

  it("carries the class, its status, the drivers and the same words as the Report lead and the banner", () => {
    const d = classified(nd199());
    const a = analyze(d);
    const r = buildRationale({ dam: d, result: a, profile: "us", now: NOW, dem: LOCAL });
    assert.equal(r.format, RATIONALE_FORMAT);
    assert.equal(r.schemaVersion, RATIONALE_SCHEMA_VERSION);
    assert.equal(r.generatedAt, "2026-11-27T22:00:00.000Z");
    assert.deepEqual(r.software, { app: "DamIT Desk", appVersion: CREST_VERSION, engineVersion: ENGINE_VERSION, classifyAlgorithm: "damit:classify", profile: "us" });
    const c = r.classification;
    assert.equal(c.status, "current");
    assert.equal(c.headline, reportLead(d, a).title);
    assert.equal(c.headline, classBanner(d, a).title);
    assert.equal(c.suggestedClass, "High");
    assert.equal(c.ordinal, 3);
    assert.equal(c.ruling.status, "partly needs ruling");
    assert.equal(c.drivers.basis, "driving");
    assert.deepEqual(c.drivers.receptors.map((x) => x.id), ["road:240", "road:241", "rail:21", "rail:22", "rail:23", "rail:24"]);
    assert.deepEqual(c.drivers, hazardDrivers(d.hazardResult));
    assert.equal(c.jurisdiction.text, choiceText(damChoice(d)));
    assert.equal(r.deskScreen.role, "schematic preview");
    assert.equal(r.deskScreen.level, a.screen.level);
    assert.equal(r.deskScreen.consistent, true);
    assert.deepEqual(r.terrain, { source: "local DEM", path: LOCAL.path, service: null, sha256: SHA, bytes: 48213, modified: LOCAL.modified, note: LOCAL.note, layer: null });
    assert.equal(r.model.sourceOfRecord, "desk");
    assert.equal(rationaleFileName(d), "nd00199_rationale.json");
  });

  it("says out of date, incomplete or not run in the Report's words, and keeps a stale class visible but marked", () => {
    const stale = classified(nd199(), { choiceKey: "preset:FEMA333:" });
    let r = buildRationale({ dam: stale, result: analyze(stale), profile: "us", now: NOW });
    assert.equal(r.classification.status, "stale");
    assert.match(r.classification.statusWhy!, /was classified for/);
    assert.equal(r.classification.suggestedClass, "High");
    assert.match(r.classification.headline, /out of date/);
    const part = classified(nd199(), { complete: false, notChecked: { RAIL: "the rail service did not answer" } });
    r = buildRationale({ dam: part, result: analyze(part), profile: "us", now: NOW });
    assert.equal(r.classification.status, "incomplete");
    assert.match(r.classification.headline, /at least High, INCOMPLETE/);
    assert.deepEqual(r.classification.notChecked, { RAIL: "the rail service did not answer" });
    const none = nd199();
    r = buildRationale({ dam: none, result: analyze(none), profile: "nd", now: NOW });
    assert.equal(r.classification.status, "not run");
    assert.equal(r.classification.algorithm, "ndhazard:classify");
    assert.equal(r.classification.drivers.basis, "none");
    assert.equal(r.classification.ruling.status, "not applicable");
    assert.match(r.terrain.note!, /not reachable/);
  });

  it("names the model run of record and the Runner / Boann versions its label carries", () => {
    const d = classified(nd199());
    d.resultsOfRecord = RUN;
    const rec = analysisOfRecord(d, analyze(d)).result;
    const r = buildRationale({ dam: d, result: rec, profile: "us", now: NOW, dem: LOCAL });
    assert.equal(r.model.sourceOfRecord, "lisflood");
    assert.deepEqual(r.model.versions, { runner: "0.9.0", boann: "5.0.0", lisflood: null });
    assert.equal(r.model.stats!.peakDepthFt, 14.2);
    assert.deepEqual(modelVersions("LISFLOOD-FP (DWR-2801, ND Dam Breach Runner 3.11.1)"), { runner: "3.11.1", boann: null, lisflood: null });
    assert.deepEqual(modelVersions("LISFLOOD-FP 8.1 run", ["/x/boann_v5.3.0/max_depth.tif"]), { runner: null, boann: "5.3.0", lisflood: "8.1" });
  });

  it("changes nothing: the record, the analysis, the lead and the badge are the same before and after", () => {
    const d = classified(nd199());
    const a = analyze(d);
    const before = JSON.stringify([d, a, reportLead(d, a), classBadge(d, a)]);
    buildRationale({ dam: d, result: a, profile: "us", now: NOW, dem: LOCAL });
    assert.equal(JSON.stringify([d, a, reportLead(d, a), classBadge(d, a)]), before);
  });

  it("checkRationale catches what a reader relies on", () => {
    assert.deepEqual(checkRationale("x"), ["not a JSON object"]);
    const d = classified(nd199());
    const good = JSON.parse(rationaleText(buildRationale({ dam: d, result: analyze(d), profile: "us", now: NOW, dem: LOCAL })));
    const bad = { ...good, schemaVersion: 2, terrain: { ...good.terrain, sha256: "abc" }, classification: { ...good.classification, status: "maybe" } };
    delete bad.model;
    const errs = checkRationale(bad);
    for (const e of ["schemaVersion is not 1", "model is missing", "terrain.sha256 is not a SHA-256 hex digest", 'classification.status "maybe" is not known'])
      assert.ok(errs.includes(e), `${e} in ${JSON.stringify(errs)}`);
    assert.deepEqual(checkRationale({ ...good, extra: 1 }), [], "an added field is not a new version");
  });

  it("docs/rationale.example.json is a valid rationale", () => {
    const ex = JSON.parse(readFileSync(new URL("../../../docs/rationale.example.json", import.meta.url), "utf8"));
    assert.deepEqual(checkRationale(ex), []);
    assert.equal(ex.classification.drivers.receptors.length > 0, true);
  });

  it("without the desk server, names the live terrain but gives no checksum", () => {
    const d = nd199();
    const t3 = buildRationale({ dam: d, result: analyze(d), profile: "us", now: NOW, dem: demFallback("3DEP") }).terrain;
    assert.deepEqual([t3.source, t3.sha256, t3.path], ["USGS 3DEP", null, null]);
    assert.match(t3.service!, /3DEPElevation/);
    const tl = buildRationale({ dam: d, result: analyze(d), profile: "us", now: NOW, dem: demFallback("local DEM cass_10m.vrt") }).terrain;
    assert.deepEqual([tl.source, tl.path, tl.sha256], ["local DEM", "cass_10m.vrt", null]);
    assert.match(tl.note!, /not hashed/);
  });

  it("asks the desk server for the DEM checksum only when there is one", async () => {
    assert.equal(await fetchDemDigest(async () => { throw new Error("no server should be called"); }), null);
  });
});

describe("the class banner", () => {
  it("reads the Report lead's state: ok, needs ruling, incomplete, out of date, not run", () => {
    const ok = classified(nd199(), { ruling: null });
    assert.deepEqual(
      [classBanner(ok, analyze(ok)).tone, classBanner(ok, analyze(ok)).ruling, classBanner(ok, analyze(ok)).drivers],
      ["ok", null, "Rests on 2 roads and 4 rail lines."],
    );
    const rule = classified(nd199());
    const b = classBanner(rule, analyze(rule));
    assert.equal(b.tone, "warn");
    assert.equal(b.ruling, "partly needs ruling");
    const part = classified(nd199(), { complete: false, notChecked: { RAIL: "offline" } });
    const p = classBanner(part, analyze(part));
    assert.deepEqual([p.tone, p.incomplete], ["alert", true]);
    assert.equal(p.title, reportLead(part, analyze(part)).title);
    assert.match(p.detail!, /^INCOMPLETE: rail was not checked/);
    const stale = classified(nd199(), { receptorKey: "x" });
    const s = classBanner(stale, analyze(stale));
    assert.deepEqual([s.tone, s.kind, s.drivers], ["warn", "stale", null]);
    const none = nd199();
    assert.deepEqual([classBanner(none, analyze(none)).tone, classBanner(none, analyze(none)).kind], ["none", "none"]);
  });
  it("says 'at least' when the stored ids are a sample", () => {
    const d = classified(nd199(), { driving: [{ method: "M2", label: "High", reason: "r", receptors: 70, receptorIds: ["structure:1", "structure:2"] }] });
    assert.equal(driversLine(hazardDrivers(d.hazardResult)), "Rests on at least 2 structures.");
  });
  it("is on every desk tab, after the getting-started card, and only in the desk view", () => {
    const src = readFileSync(new URL("../../components/crest/desk.tsx", import.meta.url), "utf8");
    const at = src.indexOf("<ClassBanner");
    assert.ok(at > src.indexOf("<GettingStarted") && at < src.indexOf('role="tabpanel"'));
    assert.match(src.slice(at - 40, at), /view === "desk"/);
    assert.match(src, /Export rationale…/);
    assert.ok(!/Export rationale\.\.\./.test(src), "labels use the Unicode ellipsis");
  });
});
