/**
 * Which receptors drove the class call (rationale.json, the class banner and the receptor inspector, 2026-11-27).
 *
 * Until now the desk could show THAT receptors were wet and what class each supports, but nothing named the ones the
 * class actually rests on:
 *  - the desk screen (engine.ts screenReceptors) takes the worst receptor class and keeps only the level, the label and
 *    free-text reasons; the receptors at that level are not listed;
 *  - damit:classify's report lists the driving hits WITH their receptor ids (damit_hazard_report.json "driving"), but
 *    the desk server kept only a count per hit (qgis_run.read_hazard_report). It now also keeps the ids
 *    (`receptorIds`), and results from before that fall back to the stored hits at the top class.
 *
 * Read-only: nothing here feeds back into the screen or the stored class. It reads the same fields the engine and
 * Hazard already produced, and class-drivers.test.ts checks the drivers always agree with the class they explain.
 * Pure; no DOM. Kept out of the five synced engine files (engine, spread, outline, routing, warnings).
 */
import { hazardOrdinal } from "./classify-receptors.ts";
import { needsRuling, type ClassifyList, type ClassifyReceptor } from "./classify-list.ts";
import type { Analysis, HazardResult, ReceptorSeed } from "./types.ts";

type Ranked = Analysis["flood"]["receptors"][number];
type NdClass = "High" | "Medium" | "Low";

const CLASS_ORDER: Record<NdClass, number> = { High: 3, Medium: 2, Low: 1 };

/** How one desk receptor stands in the desk screen. */
export type ScreenRole =
  /** At the governing class: the screen rests on it. */
  | "sets"
  /** Unresolved (past the reach or outside the drawn area) and counting: it holds the screen at Review. */
  | "holds"
  /** Counted, at a class below the governing one. */
  | "below"
  /** Wet or near, but not counted (not habitable, dry, rail/road with no class). */
  | "not counted";

export type ScreenDriver = {
  id: string;
  name: string;
  kind: string;
  role: ScreenRole;
  ndClass: NdClass | null;
  zone: Ranked["zone"];
  depthFt: number;
  velocityFps: number;
  reason: string;
  needsJudgment: boolean;
  /** Outside the drawn area but inside the desk reach: how it would screen without the AOI. */
  wouldBe: NdClass | null;
};

export type ScreenDrivers = {
  level: Analysis["screen"]["level"];
  label: string;
  /** The worst class over resolved receptors (null when none counts): the level unless held at Review. */
  resolvedClass: NdClass | null;
  /** Every counting receptor with its role; `drivers` is the "sets" + "holds" subset. */
  receptors: ScreenDriver[];
  drivers: ScreenDriver[];
  /** True when the drivers explain the level (always, unless the engine and this module drift apart). */
  consistent: boolean;
};

const isHabitable = (r: Pick<Ranked, "kind">, seed?: Pick<ReceptorSeed, "habitable">) =>
  seed?.habitable ?? (r.kind === "house" || r.kind === "mobile");

/**
 * The desk screen's drivers: resolved receptors at the governing class ("sets"), and, when the screen is held at
 * Review, the unresolved homes and roads that hold it there ("holds"), in the engine's order.
 */
export function screenDrivers(
  result: Pick<Analysis, "flood" | "screen">,
  seeds: readonly Pick<ReceptorSeed, "habitable">[] = [],
): ScreenDrivers {
  const rs = result.flood.receptors;
  let top: NdClass | null = null;
  for (const r of rs) if (!r.unresolved && r.ndClass && (top == null || CLASS_ORDER[r.ndClass] > CLASS_ORDER[top])) top = r.ndClass;
  const level = result.screen.level;
  const out: ScreenDriver[] = [];
  rs.forEach((r, i) => {
    const counting = isHabitable(r, seeds[i]) || r.kind === "road";
    let role: ScreenRole | null = null;
    if (r.unresolved) role = level === "Review" && counting ? "holds" : null;
    else if (r.ndClass) role = r.ndClass === top ? "sets" : "below";
    else if (r.depthFt > 0 && r.rankReason !== "dry") role = "not counted";
    if (!role) return;
    out.push({
      id: r.id,
      name: r.name,
      kind: String(r.kind),
      role,
      ndClass: r.ndClass,
      zone: r.zone,
      depthFt: r.depthFt,
      velocityFps: r.velocityFps,
      reason: r.rankReason,
      needsJudgment: r.needsJudgment,
      wouldBe: r.wouldBe?.ndClass ?? null,
    });
  });
  const drivers = out.filter((d) => d.role === "sets" || d.role === "holds");
  // Consistency with the engine: a High/Medium/Low level is the worst resolved class (Low also when nothing counts);
  // a Review level has at least one receptor holding it.
  const consistent = level === "Review" ? drivers.some((d) => d.role === "holds") : (top ?? "Low") === level;
  return { level, label: result.screen.label, resolvedClass: top, receptors: out, drivers, consistent };
}

/** One damit:classify / ndhazard:classify receptor the class rests on. */
export type HazardDriverReceptor = {
  id: string;
  /** "STRUCTURES", "ROADS", … from the id ("structure:39") or the receptor list. */
  layer: string;
  name: string | null;
  label: string | null;
  ordinal: number | null;
  depthFt: number | null;
  velFps: number | null;
  methods: string[];
  flags: string[];
  needsRuling: boolean;
  at: [number, number] | null;
};

export type HazardDrivers = {
  ordinal: number | null;
  label: string;
  /**
   * Where the receptor ids came from: Hazard's own "driving" list ("driving"), the stored hits at the top class
   * ("hits", first five ids per hit), the receptor list read from the GeoPackage ("receptor list"), or nowhere.
   */
  basis: "driving" | "hits" | "receptor list" | "none";
  /** False when some ids were cut (a hit kept only its first five), so `receptors` is a sample, not all of them. */
  complete: boolean;
  /** Receptors that drove the class, de-duplicated, in Hazard's order. */
  receptors: HazardDriverReceptor[];
  /** How many receptors the driving hits name in all (may exceed receptors.length when not complete). */
  receptorTotal: number;
  methods: { method: string; label: string; reason: string; receptorCount: number }[];
};

const LAYER_OF: Record<string, string> = {
  structure: "STRUCTURES",
  structures: "STRUCTURES",
  road: "ROADS",
  roads: "ROADS",
  rail: "RAIL",
  facility: "FACILITIES",
  lifeline: "LIFELINES",
  environment: "ENVIRONMENT",
};

export const layerOfId = (id: string): string => LAYER_OF[id.split(":", 1)[0].toLowerCase()] ?? "OTHER";

/** Validate the driving hits handed back by the desk server before they are stored (receptorIds is new, optional). */
export function parseDriving(v: unknown): NonNullable<HazardResult["driving"]> {
  if (!Array.isArray(v)) return [];
  const out: NonNullable<HazardResult["driving"]> = [];
  for (const h of v.slice(0, 8)) {
    if (!h || typeof h !== "object") continue;
    const o = h as Record<string, unknown>;
    const ids = Array.isArray(o.receptorIds) ? o.receptorIds.filter((x) => typeof x === "string" || typeof x === "number").map(String).slice(0, 50) : null;
    const n = typeof o.receptors === "number" && Number.isFinite(o.receptors) ? Math.max(0, Math.round(o.receptors)) : (ids?.length ?? 0);
    out.push({
      method: String(o.method ?? "").slice(0, 40),
      label: String(o.label ?? "").slice(0, 40),
      reason: String(o.reason ?? "").slice(0, 300),
      receptors: n,
      ...(ids ? { receptorIds: ids } : {}),
    });
  }
  return out;
}

function fromList(id: string, row: ClassifyReceptor | undefined): HazardDriverReceptor {
  return {
    id,
    layer: row?.layer ?? layerOfId(id),
    name: row?.name ?? null,
    label: row ? row.label || null : null,
    ordinal: row?.ordinal ?? null,
    depthFt: row?.depthFt ?? null,
    velFps: row?.velFps ?? null,
    methods: row?.methods ? [row.methods] : [],
    flags: row?.flags ?? [],
    needsRuling: row ? needsRuling(row) : false,
    at: row?.at ?? null,
  };
}

/**
 * The receptors damit:classify (or ndhazard:classify) rested its class on. `list` is the receptor list from the
 * GeoPackage when it is loaded (names, depths, flags); without it the ids still come from the stored result.
 */
export function hazardDrivers(r: HazardResult | null | undefined, list?: ClassifyList | null): HazardDrivers {
  const none: HazardDrivers = { ordinal: null, label: "", basis: "none", complete: true, receptors: [], receptorTotal: 0, methods: [] };
  if (!r || !r.suggestedClass) return none;
  const hits = r.hits ?? [];
  const ruleHits = hits.filter((h) => h.strength !== "advisory" && h.ordinal != null);
  const ordinal = hazardOrdinal(r) ?? (ruleHits.length ? Math.max(...ruleHits.map((h) => h.ordinal!)) : null);
  const byId = new Map((list?.receptors ?? []).map((x) => [x.rid, x]));
  const ids: string[] = [];
  const add = (id: string) => {
    if (!ids.includes(id)) ids.push(id);
  };
  let basis: HazardDrivers["basis"] = "none";
  let complete = true;
  let total = 0;
  let methods: HazardDrivers["methods"] = [];
  const driving = r.driving ?? [];
  if (driving.some((d) => Array.isArray(d.receptorIds))) {
    basis = "driving";
    for (const d of driving) {
      (d.receptorIds ?? []).forEach(add);
      if ((d.receptorIds?.length ?? 0) < d.receptors) complete = false;
      total += d.receptors;
    }
    methods = driving.map((d) => ({ method: d.method, label: d.label, reason: d.reason, receptorCount: d.receptors }));
  } else if (ordinal != null && ruleHits.some((h) => h.ordinal === ordinal)) {
    basis = "hits";
    const top = ruleHits.filter((h) => h.ordinal === ordinal);
    for (const h of top) {
      h.receptors.forEach(add);
      if (h.receptors.length < h.receptorCount) complete = false;
      total += h.receptorCount;
    }
    if ((r.hitsTotal ?? hits.length) > hits.length) complete = false;
    methods = top.map((h) => ({ method: h.method, label: h.label, reason: h.reason, receptorCount: h.receptorCount }));
  } else if (ordinal != null && list?.receptors.length) {
    basis = "receptor list";
    for (const x of list.receptors) if (x.ordinal === ordinal && !x.advisory) add(x.rid);
    complete = !list.truncated;
    total = ids.length;
    methods = driving.map((d) => ({ method: d.method, label: d.label, reason: d.reason, receptorCount: d.receptors }));
  } else {
    methods = driving.map((d) => ({ method: d.method, label: d.label, reason: d.reason, receptorCount: d.receptors }));
    total = driving.reduce((n, d) => n + d.receptors, 0);
    complete = total === 0;
  }
  return {
    ordinal,
    label: r.suggestedClass,
    basis,
    complete,
    receptors: ids.map((id) => fromList(id, byId.get(id))),
    receptorTotal: Math.max(total, ids.length),
    methods,
  };
}

/** A set of the driver ids, for the map (ring the dots that drove the class). */
export const driverIds = (d: HazardDrivers): Set<string> => new Set(d.receptors.map((x) => x.id));
