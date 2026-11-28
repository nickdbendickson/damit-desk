/**
 * The persistent class banner, above every desk tab (2026-11-27): the class for the chosen jurisdiction with its
 * caveats (INCOMPLETE lower bound, out of date, needs a ruling) and what it rests on, so no view shows a class without
 * them. The words are the Report lead's (reportLead) and the badge's ruling flag (rulingFlag): class-banner.ts reuses
 * that state and decides nothing itself.
 */
import { useMemo } from "react";
import { classBanner } from "@/lib/crest/class-banner";
import { useProfile } from "@/lib/crest/profile";
import { useDesk } from "@/lib/crest/store";
import type { Analysis, DamRecord } from "@/lib/crest/types";
import { useClassifyReceptors } from "./use-classify-receptors";
import { useRationaleExport } from "./use-rationale-export";

const TONE: Record<string, string> = {
  alert: "border-2 border-amber bg-sand",
  warn: "border border-amber bg-sand",
  ok: "border border-water bg-card",
  none: "border border-line bg-card",
};

export function ClassBanner({ dam, result }: { dam: DamRecord; result: Analysis }) {
  const profile = useProfile((s) => s.profile);
  const load = useClassifyReceptors(dam);
  const b = useMemo(() => classBanner(dam, result, profile, load.list ?? null), [dam, result, profile, load.list]);
  const exp = useRationaleExport(dam, result);
  const setStep = useDesk((s) => s.setStep);
  return (
    <div
      className={`mb-3 flex flex-wrap items-start gap-x-4 gap-y-1 rounded-md px-3 py-2 text-sm ${TONE[b.tone]}`}
      data-testid="class-banner"
      data-tone={b.tone}
      data-kind={b.kind}
      data-incomplete={b.incomplete ? "true" : undefined}
      data-ruling={b.ruling ?? undefined}
      role={b.tone === "alert" ? "alert" : "status"}
    >
      <div className="min-w-0 flex-1">
        <p className="font-semibold break-words" data-testid="class-banner-title">
          {b.title}
          {b.ruling ? (
            <span className="ml-2 rounded-sm border border-amber px-1 text-[11px] font-normal text-amber" title={b.rulingText ?? undefined} data-testid="class-banner-ruling">
              {b.ruling}
            </span>
          ) : null}
        </p>
        {b.detail ? <p className="text-xs break-words text-muted">{b.detail}</p> : null}
        {b.drivers ? (
          <p className="text-xs text-muted" data-testid="class-banner-drivers">
            {b.drivers}
          </p>
        ) : null}
        {exp.note ? (
          <p className="text-xs text-muted" role="status">
            {exp.note}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 gap-2">
        <button type="button" className="h-8 rounded-sm border border-line bg-paper px-2 text-xs text-ink" onClick={() => setStep("report")}>
          Open Report
        </button>
        <button
          type="button"
          className="h-8 rounded-sm border border-line bg-paper px-2 text-xs text-ink disabled:opacity-50"
          onClick={() => void exp.run()}
          disabled={exp.busy}
          data-testid="export-rationale-banner"
          title="Save rationale.json: the class, its status, the receptors and criteria that drove it, the DEM and model versions"
        >
          {exp.busy ? "Exporting…" : "Export rationale…"}
        </button>
      </div>
    </div>
  );
}
