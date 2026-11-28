# Changelog

## 0.2.0 (2026-11-27)

New: the class's "why" travels with it. No class result changes.

- **Export rationale…** writes `<nid>_rationale.json` (schema version 1, `app/docs/rationale.md`): the algorithm,
  jurisdiction preset, status (current, incomplete, out of date, needs a ruling), the receptors and criteria that
  drove the class, the desk screen's own drivers, the DEM path and SHA-256, the flood run of record with its Runner /
  Boann versions, and the app and engine versions. On the class banner and in the Report's Export panel.
- **Class banner** above every desk tab: the class for the chosen jurisdiction with its caveats (INCOMPLETE, out of
  date, needs a ruling) and what it rests on. It reuses the Report lead's state; it decides nothing itself.
- **Receptor inspector** on the Dashboard: click a receptor dot to see its depth, velocity, ACER TM 11 chart and zone
  boundaries, the class it supports, and what it does to the class. Dots the class rests on are drawn larger.
- **Which receptors drove the class** (`class-drivers.ts`): the desk server now keeps the receptor ids of
  damit:classify's driving hits (`receptorIds`, up to 50 per hit), not just a count. Older results fall back to the
  stored hits at the top class.
- Desk server: `GET /api/dem/digest` (the chosen DEM's SHA-256, size and modified time; reads only the chosen DEM).

Why 0.2.0 and not 0.1.7: a new export format, a new server endpoint and three new UI surfaces. That is a feature
release, and the minor number tells a reader of a rationale file which desk could have written it.
