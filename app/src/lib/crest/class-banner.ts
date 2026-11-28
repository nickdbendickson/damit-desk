/**
 * The persistent class banner (above every tab, 2026-11-27): the class the chosen jurisdiction gives, and whether it
 * is complete, current and ruled, so a reviewer on the Map, Dashboard or Batch view never reads a class without its
 * caveats. It reuses the Report lead's state (reportLead: kind, incomplete, title), the badge's ruling flag
 * (rulingFlag) and the drivers (class-drivers.ts); it decides nothing itself. Pure; no DOM.
 */
import { hazardDrivers, type HazardDrivers } from "./class-drivers.ts";
import { rulingFlag, type ClassifyList } from "./classify-list.ts";
import { reportLead, type ReportLead } from "./classify-receptors.ts";
import type { Analysis, DamRecord } from "./types.ts";

export type ClassBannerState = {
  /** "alert": incomplete (a lower bound); "warn": out of date or needs a ruling; "ok": current; "none": not run. */
  tone: "alert" | "warn" | "ok" | "none";
  kind: ReportLead["kind"];
  incomplete: boolean;
  /** The Report lead's title, word for word. */
  title: string;
  /** "needs ruling" / "partly needs ruling", or null. */
  ruling: string | null;
  rulingText: string | null;
  /** "Rests on 2 roads and 4 rail lines." (null when no class or no ids). */
  drivers: string | null;
  /** The first line of the Report lead (the INCOMPLETE / out-of-date / not-run explanation). */
  detail: string | null;
};

const WORD: Record<string, [string, string]> = {
  STRUCTURES: ["structure", "structures"],
  ROADS: ["road", "roads"],
  RAIL: ["rail line", "rail lines"],
  FACILITIES: ["facility", "facilities"],
  LIFELINES: ["lifeline", "lifelines"],
  ENVIRONMENT: ["environmental receptor", "environmental receptors"],
  OTHER: ["receptor", "receptors"],
};

/** "Rests on 2 roads and 4 rail lines." from the drivers; "at least" when the stored ids are a sample. */
export function driversLine(d: HazardDrivers): string | null {
  if (!d.receptors.length) return null;
  const by = new Map<string, number>();
  for (const r of d.receptors) by.set(r.layer, (by.get(r.layer) ?? 0) + 1);
  const parts = [...by.entries()].map(([layer, n]) => {
    const [one, many] = WORD[layer] ?? WORD.OTHER;
    return `${n} ${n === 1 ? one : many}`;
  });
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}` : parts[0];
  return `Rests on ${d.complete ? "" : "at least "}${list}.`;
}

export function classBanner(dam: DamRecord, result: Pick<Analysis, "flood">, profile: "us" | "nd" = "us", list?: ClassifyList | null): ClassBannerState {
  const lead = reportLead(dam, result, profile);
  const current = lead.kind === "hazard";
  const flag = current ? rulingFlag(dam.hazardResult) : null;
  const incomplete = lead.incomplete === true;
  const tone = incomplete ? "alert" : lead.kind === "stale" || flag ? "warn" : current ? "ok" : "none";
  return {
    tone,
    kind: lead.kind,
    incomplete,
    title: lead.title,
    ruling: flag?.short ?? null,
    rulingText: flag?.text ?? null,
    drivers: current ? driversLine(hazardDrivers(dam.hazardResult, list ?? null)) : null,
    detail: lead.kind === "hazard" && !incomplete ? null : (lead.lines[0] ?? null),
  };
}
