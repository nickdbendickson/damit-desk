// The receptor inspector (receptor-inspector.ts, 2026-11-27): a desk dot shows its ACER TM 11 inputs, zone and what it
// does to the screen; a classify dot shows its class and whether the class rests on it.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { thresholds } from "./acer.ts";
import { hazardDrivers, screenDrivers } from "./class-drivers.ts";
import { parseClassifyList } from "./classify-list.ts";
import { analyze } from "./engine.ts";
import { inspectClassifyReceptor, inspectDeskReceptor } from "./receptor-inspector.ts";
import { SAMPLE_DAMS } from "./samples.ts";
import type { HazardResult } from "./types.ts";

const row = (i: ReturnType<typeof inspectDeskReceptor>, k: string) => i!.rows.find((r) => r.k === k)?.v;

describe("a desk receptor", () => {
  it("shows the TM 11 inputs, the zone boundaries the engine used, and its role in the screen", () => {
    let seen = 0;
    for (const d of SAMPLE_DAMS) {
      const a = analyze(d);
      const drivers = screenDrivers(a, d.receptors);
      for (const r of a.flood.receptors) {
        const i = inspectDeskReceptor(d, a, r.id, drivers)!;
        assert.equal(i.source, "desk");
        assert.equal(row(i, "ND class it supports"), r.ndClass ?? "none");
        assert.equal(row(i, "Rule"), r.rankReason);
        const role = drivers.receptors.find((x) => x.id === r.id)?.role ?? "dry";
        assert.equal(i.role, role);
        if ((r.kind === "house" || r.kind === "mobile") && !r.unresolved) {
          const [lo, hi] = thresholds(r.kind === "mobile" ? "mobile" : "house", r.velocityFps);
          assert.match(row(i, "Zone boundaries at this velocity")!, new RegExp(`${lo.toFixed(2)}–${hi.toFixed(2)} ft`));
          assert.equal(row(i, "ACER TM 11 zone"), r.zone ?? "—");
          assert.equal(row(i, "Depth"), `${r.depthFt.toFixed(2)} ft`);
          seen++;
        }
        if (role === "sets") assert.match(i.contribution, new RegExp(`^Sets the desk screen: ${r.ndClass}`));
        assert.match(i.contribution, /schematic preview, not the class\.$/);
      }
    }
    assert.ok(seen > 0);
    assert.equal(inspectDeskReceptor(SAMPLE_DAMS[0], analyze(SAMPLE_DAMS[0]), "nope"), null);
  });
});

describe("a classify receptor", () => {
  const list = parseClassifyList({
    receptors: [
      { rid: "rail:21", layer: "RAIL", kind: "rail", name: "BNSF KO", ordinal: 3, label: "High", depthFt: 2.1, velFps: 1.2, methods: "M9a", flags: ["trains_lookup"] },
      { rid: "road:9", layer: "ROADS", kind: "road", name: "Cty 10", ordinal: 3, label: "High", depthFt: 1, velFps: null, methods: "M8a", flags: [] },
      { rid: "structure:28", layer: "STRUCTURES", kind: "home", name: "28 Main", ordinal: 2, label: "Medium", depthFt: 0.6, velFps: 0.5, methods: "M6", flags: [] },
      { rid: "structure:9", layer: "STRUCTURES", kind: "home", name: "9 Main", ordinal: 3, label: "High", advisory: true, depthFt: 0.4, velFps: 0, methods: "M6", flags: [] },
      { rid: "structure:7", layer: "STRUCTURES", kind: "home", name: "7 Main", ordinal: null, label: "", depthFt: 0.2, velFps: 0, methods: "", flags: [] },
    ],
    total: 5,
    truncated: false,
    counts: {},
    gpkg: "/w/x.gpkg",
  })!;
  const hr = { suggestedClass: "High", ordinal: "3", driving: [{ method: "M9a", label: "High", reason: "r", receptors: 1, receptorIds: ["rail:21"] }] } as HazardResult;
  const drivers = hazardDrivers(hr, list);
  const role = (rid: string) => inspectClassifyReceptor(list.receptors.find((r) => r.rid === rid)!, drivers);
  it("says whether the class rests on it", () => {
    assert.deepEqual(["rail:21", "road:9", "structure:28", "structure:9", "structure:7"].map((id) => role(id).role), ["drives", "at class", "below", "advisory", "no hit"]);
    assert.match(role("rail:21").contribution, /Drives the damit:classify class \(High\), on a value that still needs a ruling/);
    assert.match(role("road:9").contribution, /not among the hits damit:classify names as driving/);
    assert.equal(role("structure:28").rows.find((r) => r.k === "Depth × velocity")!.v, "0.30 ft²/s");
    assert.equal(role("road:9").rows.find((r) => r.k === "Velocity")!.v, "— (no velocity raster)");
  });
});

describe("the Dashboard wiring", () => {
  it("opens the inspector from a dot click and rings the drivers", () => {
    const map = readFileSync(new URL("../../components/crest/DashboardMap.tsx", import.meta.url), "utf8");
    assert.match(map, /m\.on\("click", \(\) => pick\.current\?\.\(p\.id, "classify"\)\)/);
    assert.match(map, /m\.on\("click", \(\) => pick\.current\?\.\(p\.id, "desk"\)\)/);
    const dash = readFileSync(new URL("../../components/crest/Dashboard.tsx", import.meta.url), "utf8");
    assert.match(dash, /<ReceptorInspector inspection=\{inspection\}/);
    assert.match(dash, /driver: deskDriverIds\.has\(p\.id\)/);
    assert.match(dash, /driver: classifyDriverIds\.has\(r\.rid\)/);
  });
});
