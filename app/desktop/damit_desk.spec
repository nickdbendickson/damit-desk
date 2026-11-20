# -*- mode: python ; coding: utf-8 -*-
# Build:  pyinstaller damit_desk.spec   (Python 3.10–3.12; damit_desktop/web/ is committed, rebuild it with `npm run build:desktop` after changing src/)
# Result: dist/DamIT Desk/ (Windows: dist\DamIT Desk\DamIT Desk.exe), and dist/DamIT Desk.app on macOS.

import sys
from pathlib import Path

if not Path("../../damit_catalog/handoff.py").is_file():
    raise SystemExit("../../damit_catalog/handoff.py is missing: build from a checkout of the damit-desk repository.")
if not Path("damit_desktop/web/index.html").is_file():
    raise SystemExit("damit_desktop/web/index.html is missing: run `npm run build:desktop` from the repo root first.")

block_cipher = None

a = Analysis(
    ["run.py"],
    pathex=["."],
    binaries=[],
    # DamIT Catalog's NID-ID rule: damit_desktop/nid_rule.py loads this file (no copy of the rule in the desk).
    datas=[("damit_desktop/web", "damit_desktop/web"), ("damit_desktop/icon.png", "damit_desktop"), ("../../docs/img/damit-wordmark-light.png", "docs/img"), ("../../damit_catalog/handoff.py", "damit_catalog")],
    hiddenimports=[
        "damit_desktop",
        "damit_desktop.__main__",
        "damit_desktop.algorithms",
        "damit_desktop.handoff",
        "damit_desktop.nid_rule",
        "damit_desktop.qgis_run",
        "damit_desktop.layers",
        "damit_desktop.localdem",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    cipher=block_cipher,
    noarchive=False,
)
pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)
exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="DamIT Desk",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,
    icon="damit_desk.ico",
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    name="DamIT Desk",
)
if sys.platform == "darwin":
    app = BUNDLE(
        coll,
        name="DamIT Desk.app",
        icon="damit_desk.ico",
        bundle_identifier="org.damit.desk",
        info_plist={"CFBundleName": "DamIT Desk", "CFBundleDisplayName": "DamIT Desk — Dam Breach and Hazard Desk"},
    )
