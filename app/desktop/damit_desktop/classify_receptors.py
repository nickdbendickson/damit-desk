"""The real receptors damit:classify judged, read back from its damit_hazard_receptors.gpkg, for the Dashboard and the
printed report: every receptor with a hit or water on it, with a name (joined from the classify_inputs layers the desk
wrote) and a point to zoom the map to.

Absaraka desk test 2026-11-21: classify counted 230 wet structures while the Dashboard and the report table listed only
the desk's own 4 address points. Read-only; only a file named damit_hazard_receptors.gpkg inside a work folder.
"""

from __future__ import annotations

import json
import sqlite3
import struct
from pathlib import Path

from damit_desktop.browser_io import BrowserIOError
from damit_desktop.qgis_run import allowed_work_roots

GPKG_NAME = "damit_hazard_receptors.gpkg"
#: GeoPackage table -> (layer name used by the desk, classify_inputs file)
TABLES = {"structures": ("STRUCTURES", "structures.geojson"), "roads": ("ROADS", "roads.geojson"),
          "rail": ("RAIL", "rail.geojson")}
#: The most receptors sent back (strongest class, then deepest, first); the GeoPackage keeps them all.
MAX_ROWS = 2000
#: USACE NSI occupancy codes in words (the prefix before the first hyphen).
OCCUPANCY = {"RES1": "single-family home", "RES2": "mobile home", "RES3": "multi-family", "RES4": "lodging",
             "RES5": "institutional dormitory", "RES6": "nursing home", "COM": "commercial", "IND": "industrial",
             "AGR1": "agricultural", "REL1": "church", "GOV1": "government", "GOV2": "emergency response",
             "EDU1": "school", "EDU2": "college"}
_ENVELOPE_BYTES = {0: 0, 1: 32, 2: 48, 3: 48, 4: 64}


class ReceptorsError(BrowserIOError):
    pass


def gpkg_path(requested: str) -> Path:
    """The GeoPackage asked for, only when it is a damit_hazard_receptors.gpkg inside an allowed work folder."""
    if not isinstance(requested, str) or not requested.strip() or "\x00" in requested:
        raise ReceptorsError("no GeoPackage given")
    path = Path(requested.strip()).expanduser().resolve()
    if path.name != GPKG_NAME:
        raise ReceptorsError(f"only {GPKG_NAME} is read here")
    if not any(path == r or r in path.parents for r in allowed_work_roots()):
        raise ReceptorsError("the GeoPackage must be inside the work folder")
    if not path.is_file():
        raise ReceptorsError(f"{path} does not exist (run damit:classify again)")
    return path


def _wkb_coords(wkb: bytes, off: int = 0):
    """(lon, lat) points of a 2-D WKB Point / LineString / MultiLineString / Polygon (outer ring), else []."""
    order = "<" if wkb[off] == 1 else ">"
    gtype = struct.unpack_from(order + "I", wkb, off + 1)[0] % 1000
    p = off + 5
    if gtype == 1:
        return [struct.unpack_from(order + "dd", wkb, p)]
    if gtype == 2:
        n = struct.unpack_from(order + "I", wkb, p)[0]
        return [struct.unpack_from(order + "dd", wkb, p + 4 + 16 * i) for i in range(n)]
    if gtype == 3:
        n_rings = struct.unpack_from(order + "I", wkb, p)[0]
        if not n_rings:
            return []
        n = struct.unpack_from(order + "I", wkb, p + 4)[0]
        return [struct.unpack_from(order + "dd", wkb, p + 8 + 16 * i) for i in range(n)]
    if gtype in (4, 5):
        n = struct.unpack_from(order + "I", wkb, p)[0]
        out, q = [], p + 4
        for _ in range(n):
            part = _wkb_coords(wkb, q)
            out += part
            sub_order = "<" if wkb[q] == 1 else ">"
            sub_type = struct.unpack_from(sub_order + "I", wkb, q + 1)[0] % 1000
            q += 5 + (16 if sub_type == 1 else 4 + 16 * struct.unpack_from(sub_order + "I", wkb, q + 5)[0])
        return out
    return []


def gpkg_geometry(blob: bytes | None):
    """A GeoPackage geometry blob -> (point to zoom to, [west, south, east, north]) or (None, None)."""
    if not blob or len(blob) < 8 or blob[:2] != b"GP":
        return None, None
    flags = blob[3]
    env = _ENVELOPE_BYTES.get((flags >> 1) & 7, 0)
    try:
        pts = _wkb_coords(blob, 8 + env)
    except struct.error:
        return None, None
    if not pts:
        return None, None
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    mid = pts[len(pts) // 2]
    return [round(mid[0], 6), round(mid[1], 6)], [round(min(xs), 6), round(min(ys), 6), round(max(xs), 6), round(max(ys), 6)]


def _name(layer: str, props: dict, rid: str) -> str:
    """A receptor's name in words from its classify_inputs feature."""
    if layer == "STRUCTURES":
        if props.get("name"):
            return str(props["name"])
        occ = str(props.get("occtype") or "").strip()
        if occ:
            code = occ.split("-")[0]
            words = OCCUPANCY.get(code) or OCCUPANCY.get(code[:4]) or OCCUPANCY.get(code.rstrip("0123456789"), "")
            fd = props.get("fd_id")
            return " · ".join(b for b in (f"NSI {fd}" if fd else "NSI", occ + (f" ({words})" if words else "")) if b)
        return rid
    if layer == "ROADS":
        route = str(props.get("route_name") or "").strip() or str(props.get("route_id") or "").strip() or rid
        aadt = props.get("aadt")
        return f"{route} (AADT {aadt:,})" if isinstance(aadt, int) else route
    owner = str(props.get("RROWNER1") or "").strip()
    sub = str(props.get("SUBDIV") or "").strip()
    branch = str(props.get("BRANCH") or "").strip()
    bits = [b for b in (owner, f"subdivision {sub}" if sub else "", branch) if b]
    return " · ".join(bits) or rid


def _inputs(folder: Path, name: str) -> list[dict]:
    try:
        data = json.loads((folder / name).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return []
    feats = data.get("features") if isinstance(data, dict) else None
    return [f.get("properties") or {} for f in feats or [] if isinstance(f, dict)]


def read_receptors(gpkg: Path, limit: int = MAX_ROWS) -> dict:
    """{"receptors": [...], "counts": {layer: {"total", "wet", "hit"}}, "total", "truncated", "gpkg"}: receptors with
    a hit (class >= 0) or water on them, strongest class first, then deepest."""
    inputs_dir = gpkg.parent.parent / "classify_inputs"
    try:
        cfg = json.loads((gpkg.parent / "damit_hazard_report.json").read_text(encoding="utf-8")).get("config") or {}
        labels = cfg.get("labels") if isinstance(cfg.get("labels"), dict) else {}
    except (OSError, ValueError, AttributeError):
        labels = {}
    try:
        return _read(gpkg, inputs_dir, labels, limit)
    except sqlite3.Error as exc:
        raise ReceptorsError(f"could not read {gpkg.name}: {exc}") from exc


def _read(gpkg: Path, inputs_dir: Path, labels: dict, limit: int) -> dict:
    con = sqlite3.connect(f"file:{gpkg.as_posix()}?mode=ro", uri=True)
    try:
        have = {r[0] for r in con.execute("select table_name from gpkg_contents")}
        rows, counts = [], {}
        for table, (layer, src) in TABLES.items():
            if table not in have:
                continue
            props = _inputs(inputs_dir, src)
            total, wet, hit = con.execute(
                f'select count(*), sum(coalesce(depth_ft,0) > 0), sum(coalesce(class,-1) >= 0 or coalesce(adv_class,-1) >= 0) from "{table}"').fetchone()
            counts[layer] = {"total": total or 0, "wet": wet or 0, "hit": hit or 0}
            for (rid, src_fid, kind, cls, adv, label, depth, vel, flags, methods, geom) in con.execute(
                    f'select rid, src_fid, kind, class, adv_class, label, depth_ft, vel_fps, flags, methods, geom from "{table}" '
                    "where coalesce(class,-1) >= 0 or coalesce(adv_class,-1) >= 0 or coalesce(depth_ft,0) > 0"):
                rule = isinstance(cls, int) and cls >= 0
                ordinal = cls if rule else adv if isinstance(adv, int) and adv >= 0 else None
                word = str(label) if rule and label else str(labels.get(str(ordinal), ordinal)) if ordinal is not None else ""
                p = props[src_fid] if isinstance(src_fid, int) and 0 <= src_fid < len(props) else {}
                at, bbox = gpkg_geometry(geom)
                rows.append({
                    "rid": str(rid), "layer": layer, "kind": str(kind or ""),
                    "name": _name(layer, p, str(rid)),
                    "ordinal": ordinal,
                    "label": word,
                    # A class from an advisory method (e.g. M6 on a structure) rather than a rule.
                    "advisory": ordinal is not None and not rule,
                    "depthFt": round(depth, 2) if isinstance(depth, (int, float)) else None,
                    "velFps": round(vel, 2) if isinstance(vel, (int, float)) else None,
                    "methods": str(methods or ""),
                    "flags": [f for f in str(flags or "").split(",") if f],
                    "at": at, "bbox": bbox,
                })
    finally:
        con.close()
    rows.sort(key=lambda r: (-(r["ordinal"] if r["ordinal"] is not None else -1), -(r["depthFt"] or 0)))
    return {"receptors": rows[:limit], "total": len(rows), "truncated": len(rows) > limit, "counts": counts,
            "gpkg": str(gpkg)}
