"""damit:classify's criteria hits for the Review tab's table (qgis_run.report_hits / read_hazard_report): read from
the report's structured "hits" list, strongest class first, capped, with the total.

    python3 app/desktop/tests/test_report_hits.py
"""

from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import damit_desktop.qgis_run as qr  # noqa: E402

LABELS = {"0": "Minimal", "1": "Low", "2": "Medium", "3": "High", "4": "Extremely High"}
#: The shape damit_hazard 0.x writes (from the ND00199 run on the box, 2026-11-21), trimmed.
HITS = [
    {"method": "M6", "class": 2, "receptors": ["structure:28"], "strength": "advisory",
     "reason": "habitable structure inundated (0.64 ft) without lethal conditions", "scenario": "S3"},
    {"method": "M8a", "class": 3, "receptors": ["road:240"], "strength": "rule", "reason": "road impacted: AADT 2390",
     "scenario": "S3"},
    {"method": "M9a", "class": 3, "receptors": ["rail:21", "rail:22"], "strength": "rule",
     "reason": "freight line, 15 trains/day", "scenario": "S3"},
    {"method": "M3", "class": 1, "receptors": [], "strength": "rule", "reason": "x" * 400},
    "not a hit",
]


class ReportHits(unittest.TestCase):
    def test_rows_from_the_structured_list(self):
        rows, total = qr.report_hits({"hits": HITS}, LABELS)
        self.assertEqual(total, 4)
        self.assertEqual([r["method"] for r in rows], ["M8a", "M9a", "M6", "M3"])  # High (rule) first, then Medium
        road = rows[0]
        self.assertEqual(road, {"method": "M8a", "ordinal": 3, "label": "High", "strength": "rule",
                                "reason": "road impacted: AADT 2390", "scenario": "S3", "receptors": ["road:240"],
                                "receptorCount": 1})
        self.assertEqual(rows[1]["receptors"], ["rail:21", "rail:22"])
        self.assertEqual(rows[2]["label"], "Medium")
        self.assertEqual(len(rows[3]["reason"]), 200)
        self.assertEqual(rows[3]["scenario"], "")

    def test_capped_with_the_total(self):
        many = [dict(HITS[0], receptors=[f"structure:{i}"]) for i in range(qr.MAX_HITS + 25)]
        rows, total = qr.report_hits({"hits": many}, LABELS)
        self.assertEqual((len(rows), total), (qr.MAX_HITS, qr.MAX_HITS + 25))

    def test_no_hits(self):
        self.assertEqual(qr.report_hits({}, LABELS), ([], 0))
        self.assertEqual(qr.report_hits({"hits": None}), ([], 0))

    def test_read_hazard_report_carries_them(self):
        with tempfile.TemporaryDirectory() as tmp:
            (Path(tmp) / "damit_hazard_report.json").write_text(json.dumps(
                {"config": {"labels": LABELS}, "hits": HITS, "driving": HITS[1:3], "per_receptor": {"road:240": {}}}))
            got = qr.read_hazard_report(Path(tmp))
        self.assertEqual(got["hitsTotal"], 4)
        self.assertEqual(got["hits"][0]["label"], "High")
        self.assertEqual(got["impacted"], {"ROADS": 1})

    def test_driving_keeps_which_receptors(self):
        """rationale.json / the receptor inspector (2026-11-27): the driving hits keep their receptor ids, not just a
        count; the count, method, label and reason are what they were."""
        many = {"method": "M2", "class": 3, "reason": "homes wet", "receptors": [f"structure:{i}" for i in range(70)]}
        with tempfile.TemporaryDirectory() as tmp:
            (Path(tmp) / "damit_hazard_report.json").write_text(json.dumps(
                {"config": {"labels": LABELS}, "hits": HITS, "driving": HITS[1:3] + [many, {"method": "M0", "class": 3,
                                                                                         "receptors": [True, 7, None]}]}))
            got = qr.read_hazard_report(Path(tmp))
        d = got["driving"]
        self.assertEqual(d[0], {"method": "M8a", "label": "High", "reason": "road impacted: AADT 2390", "receptors": 1,
                                "receptorIds": ["road:240"]})
        self.assertEqual(d[1]["receptorIds"], ["rail:21", "rail:22"])
        self.assertEqual(d[2]["receptors"], 70)
        self.assertEqual(len(d[2]["receptorIds"]), qr.MAX_DRIVER_IDS)
        self.assertEqual(d[2]["receptorIds"][0], "structure:0")
        self.assertEqual(d[3]["receptorIds"], ["7"], "booleans and nulls are not ids")


if __name__ == "__main__":
    unittest.main()
