"""Pack PNG renders of share/damit-desk.svg into share/damit-desk.icns (the Mac app icon).

    python3 tools/make_icns.py DIR    # DIR holds icon_16.png, icon_32.png ... icon_1024.png

The PNGs are square renders of the SVG at 16, 32, 64, 128, 256, 512 and 1024 px (any renderer: a browser
screenshot, rsvg-convert, Inkscape). macOS reads PNG data in these icns entries (10.7 and later), so no
Apple tool is needed. Standard library only.
"""
import struct
import sys
from pathlib import Path

# icns type -> pixel size of the PNG it holds (Apple's table; the @2x types reuse the larger renders)
TYPES = (("icp4", 16), ("icp5", 32), ("icp6", 64), ("ic07", 128), ("ic08", 256), ("ic09", 512),
         ("ic10", 1024), ("ic11", 32), ("ic12", 64), ("ic13", 256), ("ic14", 512))


def pack(src: Path) -> bytes:
    body = b""
    for kind, px in TYPES:
        png = (src / f"icon_{px}.png").read_bytes()
        if png[:8] != b"\x89PNG\r\n\x1a\n":
            raise SystemExit(f"icon_{px}.png is not a PNG")
        w, h = struct.unpack(">II", png[16:24])
        if (w, h) != (px, px):
            raise SystemExit(f"icon_{px}.png is {w}x{h}, not {px}x{px}")
        body += kind.encode("ascii") + struct.pack(">I", 8 + len(png)) + png
    return b"icns" + struct.pack(">I", 8 + len(body)) + body


if __name__ == "__main__":
    root = Path(__file__).resolve().parent.parent
    out = root / "share" / "damit-desk.icns"
    out.write_bytes(pack(Path(sys.argv[1])))
    print(f"wrote {out}")
