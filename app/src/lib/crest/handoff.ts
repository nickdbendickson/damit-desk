/**
 * What the Report step sends to the DamIT Desk server (desktop/damit_desktop/__main__.py), and the
 * algorithm ids it shows before the server answers GET /api/handoff.
 *
 * The ids are the DamIT defaults (docs/HANDOFF.md): damit:classify (damit_hazard), damit_screen:preflight and
 * damit_screen:runchain (damit_screener), damit_run:rundam (damit_runner). No batch id is published and none is started. The desktop server resolves the ids it
 * really calls (environment / damit-handoff.json); this table is only what the page shows without a server.
 */
import { defaultPresetFor, handoffChoice } from "./jurisdiction.ts";
import type { DamRecord, FailureMode } from "./types.ts";

export const DEFAULT_ALGORITHMS = {
  classify: "damit:classify",
  preflight: "damit_screen:preflight",
  runchain: "damit_screen:runchain",
  rundam: "damit_run:rundam",
  batch: "damit_run:batch",
  data: "damit_data:download",
  pmp: "damit_pmp:pointpf",
  finder: "damit_find:embankments",
} as const;

/**
 * The North Dakota profile's ids (profile.ts; desktop/damit_desktop/algorithms.py ND_ALGORITHMS): the DWR DamSafety
 * suite, as the old dwr_crest desk handed off. DamSafety Data publishes no download algorithm (data is empty).
 */
export const ND_ALGORITHMS: Record<keyof typeof DEFAULT_ALGORITHMS, string> = {
  classify: "ndhazard:classify",
  preflight: "nddam:preflight",
  runchain: "nddam:runchain",
  rundam: "ndbreach:rundam",
  batch: "ndbreach:batch",
  data: "",
  pmp: "ndpmp:atlas14_point",
  finder: "ndfind:embankments",
};

/** Piping unless overtopping was chosen (Nick, 2026-11-05): a missing or unknown mode is never overtopping. */
export function handoffFailureMode(mode: unknown): FailureMode {
  return mode === "overtopping" ? "overtopping" : "piping";
}

/** The dam as sent: failure mode resolved (piping default) and the jurisdiction choice resolved (its state's preset, else FEMA 333). */
export function handoffDam(dam: DamRecord): DamRecord {
  // The last classify result stays in the desk; it is not part of the dam record the plugins read.
  const { hazardResult: _last, screeningResult: _screen, ...rest } = dam;
  void _last;
  void _screen;
  return { ...rest, failureMode: handoffFailureMode(dam.failureMode), classification: handoffChoice(dam.classification, defaultPresetFor(dam)) };
}
