/** classify's receptor list for the dam's current result, fetched once per result from the desk server. */
import { useEffect, useState } from "react";
import { parseClassifyList, type ClassifyList } from "@/lib/crest/classify-list";
import { crestApiHeaders, hasDesktopServer } from "@/lib/crest/desktop-server";
import type { DamRecord } from "@/lib/crest/types";

export type Load = { key: string; state: "none" | "loading" | "ready" | "error"; list?: ClassifyList; error?: string };

const cache = new Map<string, Promise<ClassifyList>>();

function fetchList(gpkg: string, key: string): Promise<ClassifyList> {
  let p = cache.get(key);
  if (!p) {
    p = fetch(`/api/classify/receptors?gpkg=${encodeURIComponent(gpkg)}`, { headers: crestApiHeaders() })
      .then(async (r) => {
        const body = await r.json().catch(() => null);
        if (!r.ok) throw new Error((body && typeof body.error === "string" && body.error) || `HTTP ${r.status}`);
        const list = parseClassifyList(body);
        if (!list) throw new Error("the desk server sent no receptor list");
        return list;
      })
      .catch((e: Error) => {
        cache.delete(key);
        throw e;
      });
    cache.set(key, p);
  }
  return p;
}

/** classify's receptor list for the dam's current result (fetched once per result). */
export function useClassifyReceptors(dam: DamRecord): Load {
  const gpkg = dam.hazardResult?.gpkg ?? "";
  const key = gpkg ? `${gpkg}|${dam.hazardResult?.classifiedAt ?? ""}` : "";
  const [load, setLoad] = useState<Load>({ key: "", state: "none" });
  useEffect(() => {
    if (!key || !hasDesktopServer()) return;
    let live = true;
    fetchList(gpkg, key).then(
      (list) => live && setLoad({ key, state: "ready", list }),
      (e: Error) => live && setLoad({ key, state: "error", error: e.message }),
    );
    return () => {
      live = false;
    };
  }, [gpkg, key]);
  if (!key) return { key, state: "none" };
  return load.key === key ? load : { key, state: "loading" };
}

