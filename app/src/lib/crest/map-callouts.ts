/**
 * The figures printed over the Workflow map (DamIT Desk UI, 2026-11-21): max depth, max velocity, the first arrival
 * at a wet structure, peak discharge and wet area, read from the analysis of record (the desk estimate, or an imported
 * run's rasters when it is the source of record, results.ts analysisOfRecord). Nothing is made up: a figure the
 * analysis does not have is shown as "—" with the reason.
 */
import { num } from "./format.ts";
import type { Analysis } from "./types.ts";

export type Callout = { key: "depth" | "velocity" | "arrival" | "peak" | "area"; label: string; value: string; note: string };

export function mapCallouts(result: Pick<Analysis, "flood" | "breach">, source: string): Callout[] {
  const f = result.flood;
  const wet = f.receptors.filter((r) => r.flooded && r.arrivalHr != null && Number.isFinite(r.arrivalHr));
  const first = wet.length ? wet.reduce((a, b) => ((b.arrivalHr as number) < (a.arrivalHr as number) ? b : a)) : null;
  const fin = (v: number) => Number.isFinite(v);
  return [
    { key: "depth", label: "Max depth", value: fin(f.maxDepthFt) ? `${num(f.maxDepthFt, 1)} ft` : "—", note: source },
    { key: "velocity", label: "Max velocity", value: fin(f.maxVelocityFps) ? `${num(f.maxVelocityFps, 1)} ft/s` : "—", note: f.velocityBasis || source },
    {
      key: "arrival",
      label: "First arrival",
      value: first ? `${num(first.arrivalHr as number, 2)} hr` : "—",
      note: first ? `at ${first.name}` : "no wet structure with an arrival time",
    },
    { key: "peak", label: "Peak discharge", value: fin(result.breach.peakCfs) ? `${num(result.breach.peakCfs, 0)} cfs` : "—", note: "desk breach hydrograph" },
    { key: "area", label: "Wet area", value: fin(f.acres) ? `${num(f.acres, 0)} ac` : "—", note: source },
  ];
}
