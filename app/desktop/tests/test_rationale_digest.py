"""The chosen DEM's checksum for rationale.json (browser_io.dem_digest, 2026-11-27): hashed once per file version,
a big file pinned by size and time instead, a file that is gone read as 3DEP, as the desk does.

    python3 app/desktop/tests/test_rationale_digest.py
"""

from __future__ import annotations

import hashlib
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from damit_desktop import browser_io, localdem  # noqa: E402


class DemDigest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.settings = self.root / "crest-settings.json"

    def tearDown(self):
        self.tmp.cleanup()

    def choose(self, path: Path | None):
        localdem.write_dem_path(self.settings, str(path) if path else None)

    def test_3dep_when_none_is_chosen(self):
        got = browser_io.dem_digest(self.settings)
        self.assertEqual((got["kind"], got["path"], got["sha256"]), ("3dep", None, None))
        self.assertIn("3DEP", got["note"])

    def test_hash_size_and_time(self):
        dem = self.root / "cass_10m.tif"
        dem.write_bytes(b"II*\x00" + b"\x01" * 4000)
        self.choose(dem)
        got = browser_io.dem_digest(self.settings)
        self.assertEqual(got["sha256"], hashlib.sha256(dem.read_bytes()).hexdigest())
        self.assertEqual(got["bytes"], 4004)
        self.assertIsNone(got["note"])
        json.dumps(got)  # the server sends it as JSON

    def test_a_changed_file_is_hashed_again(self):
        dem = self.root / "d.tif"
        dem.write_bytes(b"one")
        self.choose(dem)
        first = browser_io.dem_digest(self.settings)["sha256"]
        dem.write_bytes(b"two!")
        os.utime(dem, ns=(1, 1))
        self.assertNotEqual(browser_io.dem_digest(self.settings)["sha256"], first)

    def test_big_file_is_pinned_not_hashed(self):
        dem = self.root / "big.tif"
        dem.write_bytes(b"x" * 100)
        self.choose(dem)
        got = browser_io.dem_digest(self.settings, cap=10)
        self.assertIsNone(got["sha256"])
        self.assertEqual(got["bytes"], 100)
        self.assertIn("not hashed", got["note"])

    def test_a_gone_file_reads_as_3dep_as_the_desk_does(self):
        # localdem.read_dem_path drops a chosen file that is gone, and the desk's terrain falls back to 3DEP.
        self.choose(self.root / "gone.vrt")
        self.assertEqual(browser_io.dem_digest(self.settings)["kind"], "3dep")


if __name__ == "__main__":
    unittest.main()
