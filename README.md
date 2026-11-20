# DamIT Desk

One window for screening, a breach run, and classification, on Windows, Mac, and Linux. QGIS is not what you open. The same plugins still do the work, through `qgis_process`, in the background.

This repository is the desk. The plugins, LISFLOOD-FP, and the conda install live in [damit](https://github.com/nickdbendickson/damit) (`suite_install`). One codebase: the plugins stay the engine, and this is the only interface.

The desk is a screen, not an official hazard class. The engineer of record and the regulating agency make the determination.

## Open it

Python 3.10 or newer. Node is not required. The built desk is already in `app/desktop/damit_desktop/web/`.

| | |
|---|---|
| Linux, Mac | `bin/damit-desk` |
| Mac, double-click | `bin/damit-desk.command` |
| Windows | `bin\damit-desk.cmd` |

The first run makes a virtualenv next to the app. Mac and Windows install a native window (WebKit, or WebView2 on Windows 11). Linux opens the desk in the browser on purpose, so the install does not pull in Qt.

Leave that terminal open while you use the desk.

## The engine, once

Screen, Run, and Classify call the DamIT plugins. Install those with the suite installer, which puts QGIS in a per-user conda env and does not need admin rights:

```bash
# from a checkout of nickdbendickson/damit
bash suite_install/install-all.sh
```

On Windows, `suite_install\install-all-windows.cmd`. On a Mac, run `download-all.sh` first and keep the folder in your home directory. Details are in that repository's `suite_install/README.md`.

If `qgis_process` is not on `PATH`, set `QGIS_PROCESS` to it. The desk looks for the DamIT algorithm ids (`damit:classify`, `damit_screen:preflight`, `damit_screen:runchain`, `damit_run:rundam`, `damit_data:download`, `damit_pmp:pointpf`, `damit_find:embankments`). It will not call the North Dakota suite ids.

You do not open `open-damit-qgis.sh`. That launcher is for someone who wants the QGIS window.

## A shortcut

```bash
bin/install-launcher          # Mac: ~/Applications/DamIT Desk.app
                              # Linux: a menu entry
```

On Windows, from the repo folder:

```powershell
powershell -File bin\install-launcher.ps1
```

That puts DamIT Desk in the Start menu. The shortcut runs `bin\damit-desk.cmd`.

## What is not in this repo yet

- A signed Mac `.dmg` and a Windows `.exe` installer. The scripts above are the install. The shortcut is the app icon; the signed installers are later.
- A headless engine with QGIS removed from Runner's `engine.py` and Hazard's `classify.py`. That is the later swap, behind this same window. Results people already have do not change, because today this desk calls those plugins as they are.

## Layout

```
bin/damit-desk            Linux and Mac
bin/damit-desk.cmd        Windows
bin/install-launcher      Mac app and Linux menu entry
bin/install-launcher.ps1  Windows Start-menu shortcut
share/damit-desk.svg      the icon
app/                      the desk (React + Leaflet, pywebview)
  desktop/run.py          python entry
  src/lib/crest/          breach screen, handoff, jurisdiction display
damit_catalog/handoff.py  Catalog's NID-ID rule, the same file the plugins import
LICENSE.md                PolyForm Noncommercial 1.0.0
```

`app/README.md` is the developer note carried from `damit_crest`: hand-off ids, the NID picker, and how a failure mode you did not choose is sent as piping.

## Tests

Headless. Nothing starts QGIS, a flood model, or a window.

```bash
python3 app/desktop/tests/run_tests.py
```

GitHub Actions runs that on Ubuntu, macOS, and Windows.
