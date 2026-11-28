/**
 * "Export rationale…" (the class banner and the Report's Export panel): build rationale.json for the dam from its
 * analysis of record, the classify receptor list (when loaded) and the chosen DEM's checksum (from the desk server),
 * then save it like every other export.
 */
import { useCallback, useState } from "react";
import { fetchDemDigest } from "@/lib/crest/dem-source";
import { useProfile } from "@/lib/crest/profile";
import { demSourceLabel } from "@/lib/crest/outline";
import { buildRationale, demFallback, rationaleFileName, rationaleText } from "@/lib/crest/rationale";
import { saveText } from "@/lib/crest/save";
import type { Analysis, DamRecord } from "@/lib/crest/types";
import { useClassifyReceptors } from "./use-classify-receptors";

export function useRationaleExport(dam: DamRecord, result: Analysis) {
  const profile = useProfile((s) => s.profile);
  const load = useClassifyReceptors(dam);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const run = useCallback(async () => {
    setBusy(true);
    try {
      // The desk server names and hashes the chosen DEM; without one (the web desk) the live terrain label stands in.
      const dem = (await fetchDemDigest()) ?? demFallback(demSourceLabel());
      const r = buildRationale({ dam, result, profile, now: new Date(), list: load.list ?? null, dem });
      const name = rationaleFileName(dam);
      const s = await saveText(name, rationaleText(r), "application/json");
      setNote(s.status === "saved" ? (s.path ? `Saved ${s.path}` : `Saved ${name}`) : s.status === "cancelled" ? null : `Could not save ${name}: ${s.message}`);
    } catch (e) {
      setNote(`Could not build the rationale: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, [dam, result, profile, load.list]);
  return { run, busy, note };
}
