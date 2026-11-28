/**
 * The receptor inspector (Dashboard map, 2026-11-27): click a receptor dot and see why it counts. For one of the
 * desk's own receptors: the ACER TM 11 inputs (chart, depth, velocity, the zone boundaries at that velocity), the zone,
 * the ND class it supports and what it does to the desk screen. For a receptor damit:classify / ndhazard:classify
 * judged: its class, depth and velocity, the methods, the flags and whether it is one the class rests on.
 *
 * Reads the analysis and the classify result; computes no class of its own (the zone boundaries are acer.ts
 * thresholds(), the same curves the engine ranks with). Pure; no DOM.
 */
import { AXES, thresholds, type ChartKind } from "./acer.ts";
import { screenDrivers, type HazardDrivers, type ScreenDrivers } from "./class-drivers.ts";
import { needsRuling, type ClassifyReceptor, LAYER_WORD } from "./classify-list.ts";
import { hazardType } from "./classify-receptors.ts";
import type { Analysis, DamRecord } from "./types.ts";

export type InspectRow = { k: string; v: string };

export type Inspection = {
  id: string;
  name: string;
  source: "desk" | "classify";
  /** "sets" / "holds" / "below" / "not counted" / "dry" for the desk; "drives" / "below" / "advisory" / "no hit" for classify. */
  role: string;
  /** One sentence: what this receptor does to the class. */
  contribution: string;
  rows: InspectRow[];
};

const ft = (v: number | null | undefined, d = 2) => (v == null || !Number.isFinite(v) ? "—" : `${v.toFixed(d)} ft`);
const fps = (v: number | null | undefined, d = 2) => (v == null || !Number.isFinite(v) ? "—" : `${v.toFixed(d)} ft/s`);

const HAB_WORD: Record<string, string> = {
  home: "home (habitable)",
  mobile_home: "mobile home (habitable)",
  outbuilding: "outbuilding (not habitable)",
  farm_occupied: "farm building, occupied (habitable)",
  farm_unoccupied: "farm building, unoccupied (not habitable)",
};

/** The inspector for one of the desk's own receptors (`id` = the seed id), or null when the record has no such one. */
export function inspectDeskReceptor(dam: DamRecord, result: Pick<Analysis, "flood" | "screen">, id: string, drivers?: ScreenDrivers): Inspection | null {
  const i = result.flood.receptors.findIndex((r) => r.id === id);
  if (i < 0) return null;
  const r = result.flood.receptors[i];
  const seed = dam.receptors[i];
  const d = drivers ?? screenDrivers(result, dam.receptors);
  const kind = String(r.kind);
  const rows: InspectRow[] = [];
  const structure = kind === "house" || kind === "mobile" || kind === "barn";
  rows.push({ k: "Type", v: structure && seed ? (HAB_WORD[hazardType(seed)] ?? kind) : kind });
  if (seed?.source) rows.push({ k: "From", v: seed.source === "nd911" ? "ND 911 address point" : seed.source });
  rows.push({ k: "Downstream", v: Number.isFinite(r.distanceKm) ? `${r.distanceKm.toFixed(2)} km` : "—" });
  if (r.unresolved) rows.push({ k: "Depth", v: r.outsideAoi ? "not computed (outside the drawn area)" : "not computed (past the desk reach)" });
  else {
    rows.push({ k: "Depth", v: ft(r.depthFt) });
    rows.push({ k: "Velocity", v: fps(r.velocityFps) });
    rows.push({ k: "Depth × velocity", v: Number.isFinite(r.depthFt * r.velocityFps) ? `${(r.depthFt * r.velocityFps).toFixed(2)} ft²/s` : "—" });
  }
  if (structure) {
    const chart: ChartKind = kind === "mobile" ? "mobile" : "house";
    const [lo, hi] = thresholds(chart, r.velocityFps);
    const [vmax, dmax] = AXES[chart];
    rows.push({ k: "ACER TM 11 chart", v: `${chart === "mobile" ? "mobile home" : "house"} (axes ${vmax} ft/s, ${dmax} ft)` });
    if (!r.unresolved)
      rows.push({ k: "Zone boundaries at this velocity", v: `low below ${lo.toFixed(2)} ft · judgment ${lo.toFixed(2)}–${hi.toFixed(2)} ft · high at ${hi.toFixed(2)} ft or more` });
    rows.push({ k: "ACER TM 11 zone", v: r.zone ?? "—" });
    if (seed?.padFt != null && Number.isFinite(seed.padFt)) rows.push({ k: "Pad above ground", v: ft(seed.padFt, 1) });
  }
  if (kind === "road") {
    rows.push({ k: "Road class", v: seed?.roadClass ?? "—" });
    rows.push({ k: "AADT", v: seed?.aadt != null && Number.isFinite(seed.aadt) ? seed.aadt.toLocaleString("en-US") : "unknown" });
  }
  if (r.arrivalHr != null && Number.isFinite(r.arrivalHr)) rows.push({ k: "Arrival", v: `${r.arrivalHr.toFixed(1)} h after breach` });
  rows.push({ k: "ND class it supports", v: r.ndClass ?? "none" });
  rows.push({ k: "Rule", v: r.rankReason });
  if (r.needsJudgment) rows.push({ k: "Needs an engineer", v: "yes" });
  const me = d.receptors.find((x) => x.id === id);
  const role = me?.role ?? "dry";
  const top = d.resolvedClass;
  const nTop = d.receptors.filter((x) => x.role === "sets").length;
  const contribution =
    role === "sets"
      ? `Sets the desk screen: ${r.ndClass} is the worst class over the resolved receptors${nTop > 1 ? ` (${nTop} receptors are at ${r.ndClass})` : ""}.`
      : role === "holds"
        ? `Unresolved, so it holds the desk screen at Review${me?.wouldBe ? ` (it would screen ${me.wouldBe} inside the drawn area)` : ""}.`
        : role === "below"
          ? `Counted at ${r.ndClass}, below the governing ${top}: it does not change the screen.`
          : role === "not counted"
            ? `Not counted: ${r.rankReason}.`
            : "Dry: it does not count.";
  return { id, name: r.name, source: "desk", role, contribution: `${contribution} The desk screen is a schematic preview, not the class.`, rows };
}

/** The inspector for a receptor the classify algorithm judged. */
export function inspectClassifyReceptor(row: ClassifyReceptor, drivers: HazardDrivers, alg = "damit:classify"): Inspection {
  const rows: InspectRow[] = [
    { k: "Layer", v: LAYER_WORD[row.layer] ?? row.layer },
    { k: "Type", v: row.kind || "—" },
    { k: "Id", v: row.rid },
    { k: "Depth", v: ft(row.depthFt) },
    { k: "Velocity", v: row.velFps == null ? "— (no velocity raster)" : fps(row.velFps) },
  ];
  if (row.depthFt != null && row.velFps != null) rows.push({ k: "Depth × velocity", v: `${(row.depthFt * row.velFps).toFixed(2)} ft²/s` });
  rows.push({ k: "Class", v: row.label ? `${row.label}${row.ordinal != null ? ` (ordinal ${row.ordinal})` : ""}${row.advisory ? ", advisory" : ""}` : "wet, no criteria hit" });
  if (row.methods) rows.push({ k: "Methods", v: row.methods });
  if (row.flags.length) rows.push({ k: "Flags", v: row.flags.join(", ") });
  const ruling = needsRuling(row);
  if (ruling) rows.push({ k: "Needs a ruling", v: "yes: a value here is from a lookup or assumption" });
  const drives = drivers.receptors.some((x) => x.id === row.rid);
  let role: string;
  let contribution: string;
  if (drives) {
    role = "drives";
    contribution = `Drives the ${alg} class (${drivers.label})${ruling ? ", on a value that still needs a ruling" : ""}.`;
  } else if (row.ordinal == null) {
    role = "no hit";
    contribution = "Wet, with no criteria hit: it does not raise the class.";
  } else if (row.advisory) {
    role = "advisory";
    contribution = `Advisory hit at ${row.label}: it does not set the class unless advisory hits are applied.`;
  } else if (drivers.ordinal != null && row.ordinal < drivers.ordinal) {
    role = "below";
    contribution = `Hit at ${row.label}, below the class ${drivers.label}: it does not change it.`;
  } else {
    role = "at class";
    contribution = drivers.complete
      ? `Hit at ${row.label}, but not among the hits ${alg} names as driving the class.`
      : `Hit at ${row.label}, the class level; the stored driver list is a sample (first ids only), so it may be one of them.`;
  }
  return { id: row.rid, name: row.name, source: "classify", role, contribution, rows };
}
