"""The DEM picker and Save for the desk in a browser (Linux, or anywhere pywebview cannot start).

In the native window (Mac, Windows) the pywebview bridge opens the system's Open and Save dialogs. A browser page
cannot read a file on the computer by its path, and its downloads go to the browser's Downloads folder. Here the
desk's own server does both, on this computer, for the page it served (the same token check as every /api/ call):

  list_dir(dir, mode)   the folders and files under a folder, for the desk's own file chooser
                        (mode "dem": DEM files .vrt .tif .tiff .img; mode "folder": folders only)
  choose_dem(path)      remember a DEM as the desk's terrain (the same setting the native picker writes)
  save_export(...)      write an export into the chosen exports folder and say where

Nothing here deletes or overwrites: a name already in the folder gets " (2)", " (3)"...

Confinement (security, 2026-11-20). The token keeps other programs out, and on top of that these calls only reach
folders the desk has a reason to touch, after every symlink and ".." is resolved:

  read (list, choose a DEM)  the work folders (~/DamITDams, DAMIT_WORK, DAMIT_WORK_ROOTS), the exports folder, the
                             DamIT data folder (DAMIT_DATA or ~/.damit/config.json), DAMIT_DEM's folder, the folder of
                             the DEM already chosen, and any folders in DAMIT_DEM_ROOTS (os.pathsep separated)
  write (exports folder, Save)  the work folders only (DAMIT_WORK_ROOTS adds more)

A path outside them, a symlink that leads outside them, or a file name with a folder in it is refused."""

from __future__ import annotations

import json
import os
from pathlib import Path

from damit_desktop import layers, localdem
from damit_desktop.qgis_run import allowed_work_roots

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


def _real(path) -> Path | None:
    """The canonical path (symlinks and '..' resolved), or None for an empty or unusable one."""
    raw = str(path or "").strip()
    if not raw or "\x00" in raw:
        return None
    try:
        return Path(os.path.realpath(Path(raw).expanduser()))
    except (OSError, ValueError):
        return None


def _inside(path: Path, roots: list[Path]) -> bool:
    return any(path == r or r in path.parents for r in roots)


def _dedupe(paths) -> list[Path]:
    out: list[Path] = []
    for p in paths:
        if p is not None and p not in out:
            out.append(p)
    return out


def write_roots() -> list[Path]:
    """Folders Save and the exports folder may be in: the work folders (qgis_run.allowed_work_roots)."""
    return _dedupe(_real(r) for r in allowed_work_roots())


def read_roots(settings_file: Path | None) -> list[Path]:
    """Folders the desk's file chooser may show and a DEM may be chosen from (see the module docstring)."""
    raw: list = [*allowed_work_roots(), export_dir(settings_file), layers.find_data_folder()]
    env_dem = os.environ.get("DAMIT_DEM")
    if env_dem:
        raw.append(Path(env_dem).expanduser().parent)
    chosen = localdem.read_dem_path(settings_file)
    if chosen:
        raw.append(Path(chosen).expanduser().parent)
    raw += (os.environ.get("DAMIT_DEM_ROOTS") or "").split(os.pathsep)
    return _dedupe(r for r in (_real(x) for x in raw) if r is not None and r.is_dir())


def _roots_hint() -> str:
    return "put it under the work folder, or add its folder to DAMIT_DEM_ROOTS and restart the desk"


def default_export_dir() -> Path:
    """<work folder>/exports: DAMIT_WORK, else ~/DamITDams."""
    work = os.environ.get("DAMIT_WORK") or str(Path.home() / "DamITDams")
    return Path(work).expanduser() / "exports"


def export_dir(settings_file: Path | None) -> Path:
    """The chosen exports folder while it exists and is still inside a work folder, else <work>/exports."""
    chosen = _settings(settings_file).get("export_dir")
    real = _real(chosen) if isinstance(chosen, str) else None
    if real is not None and real.is_dir() and _inside(real, write_roots()):
        return real
    return default_export_dir()


def set_export_dir(settings_file: Path | None, path: str) -> Path:
    folder = Path(str(path or "")).expanduser()
    if not str(path or "").strip() or not folder.is_absolute():
        raise BrowserIOError("give a full folder path")
    if not folder.is_dir():
        raise BrowserIOError(f"no such folder: {folder}")
    real = _real(folder)
    if real is None or not _inside(real, write_roots()):
        roots = ", ".join(str(r) for r in write_roots())
        raise BrowserIOError(f"exports must go inside the work folder ({roots}); set DAMIT_WORK_ROOTS to allow others")
    if not os.access(real, os.W_OK):
        raise BrowserIOError(f"this folder cannot be written: {folder}")
    data = _settings(settings_file)
    data["export_dir"] = str(real)
    _write_settings(settings_file, data)
    return real


def list_dir(path: str | None, mode: str = "dem", settings_file: Path | None = None) -> dict:
    """{"dir", "parent", "roots", "entries": [{"name", "path", "dir"}]} for the desk's file chooser, inside the read
    roots only. No path means the first root (the work folder). Hidden entries are left out; in "dem" mode only DEM
    files are listed beside the folders; an entry whose real path leaves the roots (a symlink) is not listed."""
    roots = read_roots(settings_file)
    if not roots:
        raise BrowserIOError("there is no work folder to show; set DAMIT_WORK")
    folder = _real(path) if path else roots[0]
    if folder is None or not folder.is_dir():
        raise BrowserIOError(f"no such folder: {path}")
    if not _inside(folder, roots):
        raise BrowserIOError(f"the desk only shows its own folders here; to use {folder}, {_roots_hint()}")
    entries = []
    try:
        items = sorted(folder.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower()))
    except OSError as exc:
        raise BrowserIOError(f"cannot read {folder}: {exc.strerror or exc}") from None
    for p in items:
        if p.name.startswith("."):
            continue
        real = _real(p)
        if real is None or not _inside(real, roots):
            continue
        try:
            is_dir = real.is_dir()
        except OSError:
            continue
        if not is_dir and (mode != "dem" or p.suffix.lower() not in localdem.DEM_SUFFIXES):
            continue
        entries.append({"name": p.name, "path": str(folder / p.name), "dir": is_dir})
        if len(entries) >= MAX_ENTRIES:
            break
    parent = folder.parent if folder.parent != folder and _inside(folder.parent, roots) else None
    return {"dir": str(folder), "parent": str(parent) if parent else None, "home": str(roots[0]),
            "roots": [str(r) for r in roots], "entries": entries}


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
    real = _real(p)
    if real is None or not _inside(real, read_roots(settings_file)):
        raise BrowserIOError(f"the desk only reads DEMs from its own folders; to use {p}, {_roots_hint()}")
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


#: Characters a saved file name may not have (folder separators, Windows-reserved, control characters).
_BAD_NAME = set('<>:"/\\|?*') | {chr(c) for c in range(32)} | {"\x7f"}


def safe_name(name: str) -> str:
    """The export's own file name, with no folder in it: separators, reserved and control characters become "_",
    and leading dots (hidden files, "..") are dropped."""
    base = str(name or "").replace("\\", "/").split("/")[-1]
    clean = "".join("_" if ch in _BAD_NAME else ch for ch in base).strip().lstrip(".").strip()
    if not clean:
        return "damit_export.txt"
    if len(clean) > 150:
        stem, suffix = os.path.splitext(clean)
        clean = stem[: 150 - len(suffix[:20])] + suffix[:20]
    return clean


def save_export(settings_file: Path | None, name: str, data: bytes) -> Path:
    """Write an export into the exports folder (made if missing) under its own name, never over another file, and
    never through a symlink out of the work folders."""
    clean = safe_name(name)
    folder = export_dir(settings_file)
    folder.mkdir(parents=True, exist_ok=True)
    real = _real(folder)
    if real is None or not _inside(real, write_roots()):
        raise BrowserIOError(f"the exports folder {folder} is outside the work folder; choose it again")
    target = _free_name(real, clean)
    if target.parent != real:
        raise BrowserIOError("not a plain file name")
    tmp = target.with_name(target.name + ".part")
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_BINARY", 0) | getattr(os, "O_NOFOLLOW", 0)
    try:
        fd = os.open(tmp, flags, 0o644)
        with os.fdopen(fd, "wb") as fh:
            fh.write(data)
        os.replace(tmp, target)
    except FileExistsError:
        raise BrowserIOError(f"{tmp.name} is in the way in {real}; remove it and save again") from None
    except OSError:
        try:
            tmp.unlink()
        except OSError:
            pass
        raise
    return target
