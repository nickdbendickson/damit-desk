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

- **Mac and Windows** open a native window (WebKit, or WebView2 on Windows 11). The first run makes a virtualenv in
  `app/desktop/.venv` and installs pywebview into it.
- **Linux** opens the desk in your web browser on purpose, so the install does not pull in Qt. The desk needs only
  Python's standard library there, so no virtualenv is made and the `python3-venv` package is not needed.

The terminal prints the address, for example:

```
DamIT Desk is running at http://127.0.0.1:47241/index.html
```

If no browser opens (WSL, SSH, no default browser), open that address yourself in a browser **on the same computer**.
Leave the terminal open while you use the desk; **Ctrl+C** in it closes the desk.

**Port 47241 busy.** If another program (or a second DamIT Desk) already uses 47241, the desk says so and picks a
random port for that session; use the address it prints. Your saved dams are kept by the browser per address, so the
dams from the usual 47241 address are not shown in that session. Close the other copy and start again to get them back.

### Linux browser mode: what is different

- **Choosing a local DEM, the Report step's file fields and the exports folder** use the desk's own file chooser
  (a list of folders on this computer), not the system's Open dialog.
- **Save / Export buttons** do not download through the browser. The desk writes the file into its exports folder
  (`~/DamITDams/exports` unless you pick another with **Change…** on the Report step) and tells you the full path. An
  existing file is never overwritten; a new copy gets ` (2)`.
- Still the same as the browser: **Print** and **Save view as PDF** use the browser's own print dialog, and the dams
  you enter are kept in the browser's storage for `127.0.0.1:47241` (another browser or a private window does not see
  them; export a dam's `dam.json` to move it).

## The engine, once

Screen, Run, Classify, Download layers, Atlas 14 and Find fills call the DamIT plugins through `qgis_process`. Install
those with the suite installer, which puts QGIS in a per-user conda env and does not need admin rights:

```bash
# from a checkout of nickdbendickson/damit
bash suite_install/install-all.sh                       # everything in ~/dam-suite
bash suite_install/install-all.sh --sandbox ~/damit-sb  # or: everything in one folder, nothing else touched
```

On Windows, `suite_install\install-all-windows.cmd` (`-Sandbox DIR` for the one-folder install). On a Mac, run
`download-all.sh` first and keep the folder in your home directory. Details are in that repository's
`suite_install/README.md`.

**Which `qgis_process` the desk uses.** Use the one the installer writes, `qgis-process-damit.sh`
(`qgis-process-damit.cmd` on Windows). It starts QGIS with the DamIT plugins' profile. A plain `qgis_process` uses
QGIS's default profile, where the DamIT algorithms usually are not, so the desk would report them missing.

| Install | What to do |
|---|---|
| `install-all.sh` (default) | Nothing. The desk finds `~/dam-suite/qgis-process-damit.sh` by itself (or `$DAMSUITE_PREFIX/…`). |
| `install-all.sh --sandbox DIR` | Start the desk with `QGIS_PROCESS=DIR/qgis-process-damit.sh bin/damit-desk` |
| Your own QGIS with the plugins in its default profile | `QGIS_PROCESS=/path/to/qgis_process bin/damit-desk` |

The order the desk looks in: `QGIS_PROCESS`, then the installer's `qgis-process-damit.sh`, then `qgis_process` on
`PATH`, then the Mac QGIS apps. The desk looks for the DamIT algorithm ids (`damit:classify`,
`damit_screen:preflight`, `damit_screen:runchain`, `damit_run:rundam`, `damit_data:download`, `damit_pmp:pointpf`,
`damit_find:embankments`). It will not call the North Dakota suite ids.

You do not open `open-damit-qgis.sh`. That launcher is for someone who wants the QGIS window.

**Classify needs the internet or a data folder.** It sends the real structures, roads and rail lines inside the flood
area to `damit:classify`: from the DamIT data folder when you have one (`DAMIT_DATA`), otherwise from the national
public services (USACE National Structure Inventory, FHWA HPMS roads, the national rail network). If a layer cannot be
read, the class is shown as **"at least …, INCOMPLETE"** with the layer that was not checked. A rail line counts as
High only with a trains-per-day lookup (the Report step's "Rail trains-per-day lookup" field, a CSV like
`SUBDIV,TRAINS_PER_DAY`); without it an impacted rail line can reach Medium at most.

**Cancel and time limits.** Cancel on the Report step stops the running plugin and everything it started. Download
layers stops after 3 hours, Atlas 14 after 15 minutes and Find fills after 2 hours (`DAMIT_PLUGIN_TIMEOUT_S` sets one
limit for all three, `0` for none). Screening has `DAMIT_SCREENING_TIMEOUT_S`. The log under the buttons shows the
plugin's output while it runs.

## Where files go

| What | Linux | Mac | Windows |
|---|---|---|---|
| Settings, chosen DEM, NID downloads | `~/.local/share/damit-crest/` (`$XDG_DATA_HOME/damit-crest`) | `~/Library/Application Support/DamIT Crest/` | `%APPDATA%\DamIT Crest\` |
| Dam folders, runs, classifications | `~/DamITDams/` (or `DAMIT_WORK`) | same | same |
| Exports from Save buttons | `~/DamITDams/exports/` (changeable) | the Save dialog | the Save dialog |
| Dams you entered | the browser's storage for the desk address | the window's storage in the folder above | same |

The settings folders keep the old "DamIT Crest" name so dams saved before the rename are still found. A job sent to
the desk may only write under `~/DamITDams`, `DAMIT_WORK`, or folders listed in `DAMIT_WORK_ROOTS`. `DAMIT_DATA` points
at a DamIT data folder, `DAMIT_DEM` at a default DEM.

## A shortcut

```bash
bin/install-launcher          # Mac: ~/Applications/DamIT Desk.app
                              # Linux: a "DamIT Desk" menu entry
```

On Linux the menu entry opens a terminal window that shows the address and the log. Keep it open while you use the
desk and close it (or press Ctrl+C) to stop the desk. That is the same as starting `bin/damit-desk` in a terminal. To
use a sandbox install from the menu, put `export QGIS_PROCESS=…` in `~/.profile`.

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
  desktop/run.py          python entry (the server: desktop/damit_desktop/__main__.py)
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

GitHub Actions runs that on Ubuntu, macOS, and Windows. The local-DEM tests (`test_localdem`) need GDAL's Python
bindings and are skipped without them; run the suite with the QGIS env's Python (or set `PROJ_DATA`/`GDAL_DATA`) to
include them. The web desk's own tests: `cd app && npm ci && npm test` (and `npm run build:desktop` after changing
anything under `app/src`, then commit `app/desktop/damit_desktop/web/`).
