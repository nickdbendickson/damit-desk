/**
 * rationale.json: the structured "why" behind a dam's class, for the screening-to-record hand-off (2026-11-27).
 *
 * A reviewer who never opens the desk should be able to read, from one file: which algorithm and jurisdiction preset
 * gave the class, its status (current, out of date, incomplete, needs a ruling), WHICH receptors and criteria drove
 * it (class-drivers.ts), the terrain it was built on (DEM path and SHA-256 from the desk server), the flood source of
 * record (desk estimate or an imported LISFLOOD-FP / Boann run, with the Runner / Boann versions its label names),
 * the app, engine and plugin versions, and when the file was written.
 *
 * It reports what the desk and Hazard already decided; it never recomputes or changes a class. Every status comes
 * from the same functions the Report's lead (reportLead, hazardStatus, rulingFlag) and the desk screen use. Pure:
 * `now`, the DEM digest and the receptor list are passed in. Schema: RATIONALE_SCHEMA_VERSION; checkRationale()
 * validates a file; docs/rationale.md describes every field and docs/rationale.example.json is an example.
 */
import { hazardDrivers, screenDrivers, type HazardDrivers, type ScreenDriver } from "./class-drivers.ts";
import { rulingFlag, type ClassifyList } from "./classify-list.ts";
import { choiceKey, choiceText, hazardOrdinal, hazardStatus, reportLead } from "./classify-receptors.ts";
import { ENGINE_VERSION } from "./engine.ts";
import { classifyAlgorithm } from "./handoff.ts";
import { damChoice, handoffChoice } from "./jurisdiction.ts";
import { DEM_SERVICE, terrainInfo } from "./outline.ts";
import { suggestedDisclaimer } from "./review-summary.ts";
import type { Analysis, DamRecord, HazardResult, Provenance } from "./types.ts";
import { CREST_VERSION } from "./version.ts";

export const RATIONALE_FORMAT = "damit_desk/rationale";
/** Bump on any change a reader must know about (a field removed, renamed or changing meaning); adding a field does not. */
export const RATIONALE_SCHEMA_VERSION = 1;

/** The desk's terrain as the desk server sees it (GET /api/dem/digest), or the 3DEP service. */
export type DemDigest = {
  kind: "3dep" | "local" | "unavailable";
  path: string | null;
  /** SHA-256 of the DEM file (a .vrt is hashed as the .vrt text; the tiles it lists are not). null = not hashed. */
  sha256: string | null;
  bytes: number | null;
  /** The file's modification time (ISO 8601), so an unhashed big file is still pinned. */
  modified: string | null;
  /** Why there is no checksum, or what it covers. */
  note: string | null;
};

/**
 * The terrain in words when the desk server cannot hash it (the web desk, or the server did not answer): the live
 * terrain label the desk reads with (outline.ts demSourceLabel: "3DEP" or "local DEM <name>"), with no checksum.
 */
export function demFallback(label: string): DemDigest {
  if (label.startsWith("local DEM "))
    return { kind: "local", path: label.slice("local DEM ".length), sha256: null, bytes: null, modified: null, note: "The desk server did not answer, so the DEM was named but not hashed (the path is the file name only)." };
  return { kind: "3dep", path: null, sha256: null, bytes: null, modified: null, note: "USGS 3DEP elevation service: no file to hash." };
}

export type RationaleStatus = "current" | "incomplete" | "stale" | "not run";
export type RulingStatus = "ruled" | "partly needs ruling" | "needs ruling" | "not applicable";

export type Rationale = {
  format: typeof RATIONALE_FORMAT;
  schemaVersion: number;
  generatedAt: string;
  software: {
    app: string;
    appVersion: string;
    engineVersion: string;
    classifyAlgorithm: string;
    profile: "us" | "nd";
  };
  dam: {
    id: string;
    name: string;
    nid: string;
    nidId: string | null;
    county: string;
    lon: number | null;
    lat: number | null;
    heightFt: number;
    storageAcFt: number;
    isNew: boolean;
    classOfRecord: string | null;
    nidHazard: string | null;
  };
  classification: {
    status: RationaleStatus;
    /** Why the stored result is not this choice's class (stale), else null. */
    statusWhy: string | null;
    /** The same words as the Report's lead and the class banner. */
    headline: string;
    algorithm: string;
    jurisdiction: { mode: string; preset: string | null; presetLabel: string | null; methods: string[]; advisory: boolean; text: string; key: string };
    /** What the run itself says it ran (read back from Hazard's report). */
    ran: { preset: string | null; presetLabel: string | null; mode: string | null; algorithm: string | null };
    suggestedClass: string | null;
    ordinal: number | null;
    genericLabel: string | null;
    tm11Class: string | null;
    /** False when receptor layers could not be checked: the class is then a lower bound. */
    complete: boolean | null;
    notChecked: Record<string, string>;
    ruling: { status: RulingStatus; text: string | null; hits: number | null; unruled: number | null; why: string[] };
    drivers: HazardDrivers;
    receptorsChecked: Record<string, number>;
    impacted: Record<string, number>;
    wetStructures: number | null;
    layerSources: Record<string, string>;
    railTrainsLookup: string | null;
    warnings: number | null;
    classifiedAt: string | null;
    report: string | null;
    gpkg: string | null;
    disclaimer: string;
  };
  /** The desk's own ND / ACER TM 11 screen: a schematic preview, never the class. */
  deskScreen: {
    role: "schematic preview";
    level: string;
    label: string;
    resolvedClass: string | null;
    acerLevel: string | null;
    judgmentAsProbable: boolean;
    drivers: ScreenDriver[];
    judgment: string[];
    consistent: boolean;
  };
  terrain: {
    source: "USGS 3DEP" | "local DEM" | "unknown";
    path: string | null;
    service: string | null;
    sha256: string | null;
    bytes: number | null;
    modified: string | null;
    note: string | null;
    /** The terrain layer on record (outline / routed), and what it was built on. */
    layer: { kind: string; builtOn: string; builtAt: string } | null;
  };
  model: {
    sourceOfRecord: "desk" | "lisflood" | "dsswise";
    label: string;
    files: string[];
    importedAt: string | null;
    crs: string | null;
    versions: { runner: string | null; boann: string | null; lisflood: string | null };
    stats: { peakDepthFt: number; wetAc: number; maxVelocityFps: number | null; farthestKm: number | null } | null;
    warnings: string[];
  };
  breach: { label: string; peakCfs: number; volumeAcFt: number; widthFt: number; timeHr: number; startPool: string };
  provenance: Record<string, Provenance>;
};

export type RationaleInput = {
  dam: DamRecord;
  /** The analysis of record (results-flow useAnalysisOfRecord): the desk estimate or the imported run. */
  result: Analysis;
  profile: "us" | "nd";
  now: Date;
  /** The receptor list from the classify GeoPackage, when loaded (names, depths and flags for the drivers). */
  list?: ClassifyList | null;
  dem?: DemDigest | null;
};

const VERSION_RE = /(\d+(?:\.\d+){1,3})/;

/** Runner / Boann / LISFLOOD-FP versions named in a run label or its file names ("ND Dam Breach Runner 3.11.1"). */
export function modelVersions(label: string, files: readonly string[] = []): { runner: string | null; boann: string | null; lisflood: string | null } {
  const text = [label, ...files].join(" ");
  const find = (re: RegExp) => {
    const m = re.exec(text);
    return m ? (VERSION_RE.exec(m[0])?.[1] ?? null) : null;
  };
  return {
    runner: find(/Runner[\s_-]*v?\d+(?:\.\d+){1,3}/i),
    boann: find(/Boann[\s_-]*v?\d+(?:\.\d+){1,3}/i),
    lisflood: find(/LISFLOOD(?:-FP)?[\s_-]*v?\d+(?:\.\d+){1,3}/i),
  };
}

function rulingOf(r: HazardResult | null): Rationale["classification"]["ruling"] {
  if (!r) return { status: "not applicable", text: null, hits: null, unruled: null, why: [] };
  const f = rulingFlag(r);
  if (!f || !r.ruling) return { status: "ruled", text: null, hits: r.ruling?.hits ?? null, unruled: 0, why: [] };
  return { status: f.short === "needs ruling" ? "needs ruling" : "partly needs ruling", text: f.text, hits: r.ruling.hits, unruled: r.ruling.unruled, why: r.ruling.why };
}

const finiteOrNull = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** The rationale for one dam, from the record, its analysis of record and (optionally) the receptor list and DEM. */
export function buildRationale(input: RationaleInput): Rationale {
  const { dam, result, profile, now } = input;
  const alg = classifyAlgorithm(profile, dam.hazardResult);
  const st = hazardStatus(dam, result);
  const lead = reportLead(dam, result, profile);
  const r = st.state === "none" ? null : st.result;
  const choice = handoffChoice(damChoice(dam));
  const status: RationaleStatus = st.state === "none" ? "not run" : st.state === "stale" ? "stale" : r?.complete === false ? "incomplete" : "current";
  const screen = screenDrivers(result, dam.receptors);
  const ref = dam.resultsOfRecord ?? null;
  const dem = input.dem ?? null;
  const outline = dam.outline ?? null;
  const t = outline ? terrainInfo(outline.source) : null;
  const local = dem?.kind === "local";
  return {
    format: RATIONALE_FORMAT,
    schemaVersion: RATIONALE_SCHEMA_VERSION,
    generatedAt: now.toISOString(),
    software: { app: "DamIT Desk", appVersion: CREST_VERSION, engineVersion: ENGINE_VERSION, classifyAlgorithm: alg, profile },
    dam: {
      id: dam.id,
      name: dam.name,
      nid: dam.nid,
      nidId: dam.nidId ?? null,
      county: dam.county,
      lon: finiteOrNull(dam.lon),
      lat: finiteOrNull(dam.lat),
      heightFt: dam.heightFt,
      storageAcFt: dam.storageAcFt,
      isNew: dam.isNew === true,
      classOfRecord: dam.classOfRecord ?? null,
      nidHazard: dam.nidHazard ?? null,
    },
    classification: {
      status,
      statusWhy: st.state === "stale" ? st.why : null,
      headline: lead.title,
      algorithm: alg,
      jurisdiction: {
        mode: choice.mode,
        preset: choice.preset ?? null,
        presetLabel: choice.presetLabel ?? null,
        methods: [...(choice.methods ?? [])],
        advisory: choice.advisory === true,
        text: choiceText(damChoice(dam)),
        key: choiceKey(damChoice(dam)),
      },
      ran: { preset: r?.ranPreset ?? null, presetLabel: r?.ranPresetLabel ?? null, mode: r?.ranMode ?? null, algorithm: r?.source ?? null },
      // A stale result is reported (so the reviewer sees it) but status says it is not this choice's class.
      suggestedClass: r?.suggestedClass ?? null,
      ordinal: r ? hazardOrdinal(r) : null,
      genericLabel: r?.genericLabel ?? null,
      tm11Class: r?.tm11Class ?? null,
      complete: r ? (r.complete ?? null) : null,
      notChecked: { ...(r?.notChecked ?? {}) },
      ruling: rulingOf(r),
      drivers: hazardDrivers(r, input.list ?? null),
      receptorsChecked: { ...(r?.layers ?? {}) },
      impacted: { ...(r?.impacted ?? {}) },
      wetStructures: r?.wetStructures ?? null,
      layerSources: { ...(r?.layerSources ?? {}) },
      railTrainsLookup: r?.railTrainsLookup ?? null,
      warnings: r?.warnings ?? null,
      classifiedAt: r?.classifiedAt ?? null,
      report: r?.report ?? null,
      gpkg: r?.gpkg ?? null,
      disclaimer: suggestedDisclaimer(alg),
    },
    deskScreen: {
      role: "schematic preview",
      level: result.screen.level,
      label: result.screen.label,
      resolvedClass: screen.resolvedClass,
      acerLevel: result.screen.acerLevel,
      judgmentAsProbable: result.screen.judgmentAsProbable,
      drivers: screen.drivers,
      judgment: [...result.screen.judgment],
      consistent: screen.consistent,
    },
    terrain: {
      source: local ? "local DEM" : dem?.kind === "3dep" ? "USGS 3DEP" : t ? (t.local ? "local DEM" : "USGS 3DEP") : "unknown",
      path: local ? dem!.path : null,
      service: local ? null : dem?.kind === "3dep" || (t && !t.local) ? DEM_SERVICE : null,
      sha256: local ? dem!.sha256 : null,
      bytes: local ? dem!.bytes : null,
      modified: local ? dem!.modified : null,
      note: dem?.note ?? (dem ? null : "The desk server was not reachable, so the DEM file could not be named or hashed."),
      layer: outline && t ? { kind: outline.layer ?? "outline", builtOn: t.label, builtAt: outline.builtAt } : null,
    },
    model: {
      sourceOfRecord: ref?.source ?? "desk",
      label: ref?.label ?? "Desk estimate",
      files: [...(ref?.files ?? [])],
      importedAt: ref?.importedAt ?? null,
      crs: ref?.crs ?? null,
      versions: ref ? modelVersions(ref.label, ref.files) : { runner: null, boann: null, lisflood: null },
      stats: ref ? { peakDepthFt: ref.stats.peakDepthFt, wetAc: ref.stats.wetAc, maxVelocityFps: ref.stats.maxVelocityFps, farthestKm: finiteOrNull(ref.stats.farthestKm) } : null,
      warnings: [...(ref?.warnings ?? [])],
    },
    breach: {
      label: result.breach.label,
      peakCfs: result.breach.peakCfs,
      volumeAcFt: result.breach.volumeAcFt,
      widthFt: result.breach.widthFt,
      timeHr: result.breach.timeHr,
      startPool: result.breach.startPoolLabel,
    },
    provenance: Object.fromEntries(Object.entries(dam.provenance ?? {}).filter((e): e is [string, Provenance] => e[1] != null)),
  };
}

/** The file text: two-space JSON with a trailing newline. */
export function rationaleText(r: Rationale): string {
  return JSON.stringify(r, null, 2) + "\n";
}

/** "nd00199_rationale.json". */
export function rationaleFileName(dam: Pick<DamRecord, "nid" | "id">): string {
  return `${(dam.nid || dam.id).toLowerCase().replace(/[^a-z0-9]/g, "_")}_rationale.json`;
}

/**
 * Problems with a rationale file (empty = valid for this schema version). Checks the format, the version, the
 * required sections and the types a reader relies on; extra fields are allowed (adding a field is not a new version).
 */
export function checkRationale(raw: unknown): string[] {
  const errs: string[] = [];
  const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
  if (!isObj(raw)) return ["not a JSON object"];
  if (raw.format !== RATIONALE_FORMAT) errs.push(`format is not "${RATIONALE_FORMAT}"`);
  if (raw.schemaVersion !== RATIONALE_SCHEMA_VERSION) errs.push(`schemaVersion is not ${RATIONALE_SCHEMA_VERSION}`);
  if (typeof raw.generatedAt !== "string" || !Number.isFinite(Date.parse(raw.generatedAt))) errs.push("generatedAt is not an ISO date");
  const need: Record<string, Record<string, string>> = {
    software: { app: "string", appVersion: "string", engineVersion: "string", classifyAlgorithm: "string", profile: "string" },
    dam: { id: "string", name: "string", nid: "string", isNew: "boolean" },
    classification: { status: "string", headline: "string", algorithm: "string", jurisdiction: "object", ruling: "object", drivers: "object", disclaimer: "string" },
    deskScreen: { role: "string", level: "string", label: "string", drivers: "array", consistent: "boolean" },
    terrain: { source: "string" },
    model: { sourceOfRecord: "string", label: "string", files: "array", versions: "object" },
    breach: { label: "string", peakCfs: "number" },
    provenance: {},
  };
  for (const [sec, fields] of Object.entries(need)) {
    const s = raw[sec];
    if (!isObj(s)) {
      errs.push(`${sec} is missing`);
      continue;
    }
    for (const [k, type] of Object.entries(fields)) {
      const v = s[k];
      const ok = type === "array" ? Array.isArray(v) : type === "object" ? isObj(v) : typeof v === type;
      if (!ok) errs.push(`${sec}.${k} is not ${type === "array" ? "an array" : `a ${type}`}`);
    }
  }
  const c = isObj(raw.classification) ? raw.classification : {};
  if (typeof c.status === "string" && !["current", "incomplete", "stale", "not run"].includes(c.status)) errs.push(`classification.status "${c.status}" is not known`);
  const d = isObj(c.drivers) ? c.drivers : null;
  if (d) {
    if (!Array.isArray(d.receptors)) errs.push("classification.drivers.receptors is not an array");
    if (!["driving", "hits", "receptor list", "none"].includes(String(d.basis))) errs.push("classification.drivers.basis is not known");
    if (typeof d.complete !== "boolean") errs.push("classification.drivers.complete is not a boolean");
  }
  const t = isObj(raw.terrain) ? raw.terrain : {};
  if (t.sha256 != null && !(typeof t.sha256 === "string" && /^[0-9a-f]{64}$/.test(t.sha256))) errs.push("terrain.sha256 is not a SHA-256 hex digest");
  return errs;
}
