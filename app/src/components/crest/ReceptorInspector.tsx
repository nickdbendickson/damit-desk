/**
 * The receptor inspector on the Dashboard (2026-11-27): click a receptor dot on the map and read its ACER TM 11
 * inputs, depth and velocity, zone, the class it supports and what it does to the class (receptor-inspector.ts).
 */
import type { Inspection } from "@/lib/crest/receptor-inspector";

export function ReceptorInspector({ inspection, onClose }: { inspection: Inspection | null; onClose: () => void }) {
  if (!inspection) {
    return (
      <div className="pane" data-testid="receptor-inspector" data-empty="true">
        <h4>Receptor inspector</h4>
        <p className="mini">Click a receptor dot on the map to see its depth, velocity, ACER TM 11 zone and what it does to the class.</p>
      </div>
    );
  }
  const i = inspection;
  return (
    <div className="pane" data-testid="receptor-inspector" data-role={i.role} data-source={i.source}>
      <div className="flex items-start justify-between gap-2">
        <h4 className="break-words">
          {i.name} <span className="mini">({i.source === "desk" ? "desk receptor" : "classify receptor"})</span>
        </h4>
        <button type="button" className="text-xs text-muted underline" onClick={onClose} aria-label="Close the receptor inspector">
          Close
        </button>
      </div>
      <p className="text-sm" data-testid="receptor-inspector-role">
        {i.contribution}
      </p>
      <dl className="mt-2 grid grid-cols-[max-content_1fr] gap-x-3 gap-y-0.5 text-xs">
        {i.rows.map((r) => (
          <div key={r.k} className="contents">
            <dt className="text-muted">{r.k}</dt>
            <dd className="break-words">{r.v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
