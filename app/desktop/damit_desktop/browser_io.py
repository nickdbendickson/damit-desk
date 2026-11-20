"""The DEM picker and Save for the desk in a browser (Linux, or anywhere pywebview cannot start).

In the native window (Mac, Windows) the pywebview bridge opens the system's Open and Save dialogs. A browser page
cannot read a file on the computer by its path, and its downloads go to the browser's Downloads folder. Here the
desk's own server does both, on this computer, for the page it served (the same token check as every /api/ call):

  list_dir(dir, mode)   the folders and files under a folder, for the desk's own file chooser
                        (mode "dem": DEM files .vrt .tif .tiff .img; mode "folder": folders only)
  choose_dem(path)      remember a DEM as the desk's terrain (the same setting the native picker writes)
  save_export(...)      write an export into the chosen exports folder and say where

Nothing here deletes or overwrites: a name already in the folder gets " (2)", " (3)"..."""

from __future__ import annotations

import json
import os
from pathlib import Path

from damit_desktop import localdem

MAX_ENTRIES = 2000


class BrowserIOError(ValueError):
    pass


def _settings(settings_file: Path | None) -> dict:
    try:
        data = json.loads(settings_file.read_text(encoding="utf-8")) if settings_file and settings_file.is_file() else {}
    except (OSError, ValueError):
        data = {}
    return data if isinstance(data, dict) else {}


def _write_settings(settings_file: Path | None, data: dict) -> None:
    if not settings_file:
        return
    settings_file.parent.mkdir(parents=True, exist_ok=True)
    settings_file.write_text(json.dumps(data, indent=2), encoding="utf-8")


def default_export_dir() -> Path:
    """<work folder>/exports: DAMIT_WORK, else ~/DamITDams."""
    work = os.environ.get("DAMIT_WORK") or str(Path.home() / "DamITDams")
    return Path(work).expanduser() / "exports"


def export_dir(settings_file: Path | None) -> Path:
    chosen = _settings(settings_file).get("export_dir")
    if isinstance(chosen, str) and chosen and Path(chosen).is_dir():
        return Path(chosen)
    return default_export_dir()


def set_export_dir(settings_file: Path | None, path: str) -> Path:
    folder = Path(str(path or "")).expanduser()
    if not str(path or "").strip() or not folder.is_absolute():
        raise BrowserIOError("give a full folder path")
    if not folder.is_dir():
        raise BrowserIOError(f"no such folder: {folder}")
    if not os.access(folder, os.W_OK):
        raise BrowserIOError(f"this folder cannot be written: {folder}")
    data = _settings(settings_file)
    data["export_dir"] = str(folder.resolve())
    _write_settings(settings_file, data)
    return folder.resolve()


def list_dir(path: str | None, mode: str = "dem") -> dict:
    """{"dir", "parent", "entries": [{"name", "path", "dir"}]} for the desk's file chooser. Hidden entries are left
    out; in "dem" mode only DEM files are listed beside the folders."""
    folder = Path(str(path)).expanduser() if path else Path.home()
    try:
        folder = folder.resolve()
    except OSError:
        raise BrowserIOError(f"no such folder: {folder}") from None
    if not folder.is_dir():
        raise BrowserIOError(f"no such folder: {folder}")
    entries = []
    try:
        items = sorted(folder.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower()))
    except OSError as exc:
        raise BrowserIOError(f"cannot read {folder}: {exc.strerror or exc}") from None
    for p in items:
        if p.name.startswith("."):
            continue
        try:
            is_dir = p.is_dir()
        except OSError:
            continue
        if not is_dir and (mode != "dem" or p.suffix.lower() not in localdem.DEM_SUFFIXES):
            continue
        entries.append({"name": p.name, "path": str(p), "dir": is_dir})
        if len(entries) >= MAX_ENTRIES:
            break
    parent = str(folder.parent) if folder.parent != folder else None
    return {"dir": str(folder), "parent": parent, "home": str(Path.home()), "entries": entries}


def dem_state(settings_file: Path | None) -> dict:
    return {"path": localdem.read_dem_path(settings_file), "gdalwarp": localdem.find_gdalwarp()}


def choose_dem(settings_file: Path | None, path: str) -> dict:
    p = Path(str(path or "")).expanduser()
    if not str(path or "").strip() or not p.is_absolute():
        raise BrowserIOError("give the full path of the DEM file")
    if not p.is_file():
        raise BrowserIOError(f"no such file: {p}")
    if p.suffix.lower() not in localdem.DEM_SUFFIXES:
        raise BrowserIOError(f"not a DEM file DamIT Desk reads ({', '.join(localdem.DEM_SUFFIXES)}): {p}")
    if settings_file:
        localdem.write_dem_path(settings_file, str(p))
    return {"path": str(p), "gdalwarp": localdem.find_gdalwarp()}


def clear_dem(settings_file: Path | None) -> dict:
    if settings_file:
        localdem.write_dem_path(settings_file, None)
    return {"path": None, "gdalwarp": localdem.find_gdalwarp()}


def _free_name(folder: Path, name: str) -> Path:
    target = folder / name
    if not target.exists():
        return target
    stem, suffix = Path(name).stem, Path(name).suffix
    for n in range(2, 10000):
        target = folder / f"{stem} ({n}){suffix}"
        if not target.exists():
            return target
    raise BrowserIOError("too many files with that name")


def save_export(settings_file: Path | None, name: str, data: bytes) -> Path:
    """Write an export into the exports folder (made if missing) under its own name, never over another file."""
    clean = Path(str(name or "")).name or "damit_export.txt"
    if clean in (".", ".."):
        clean = "damit_export.txt"
    folder = export_dir(settings_file)
    folder.mkdir(parents=True, exist_ok=True)
    target = _free_name(folder, clean)
    tmp = target.with_name(target.name + ".part")
    try:
        with open(tmp, "xb") as fh:
            fh.write(data)
        os.replace(tmp, target)
    except OSError:
        try:
            tmp.unlink()
        except OSError:
            pass
        raise
    return target
