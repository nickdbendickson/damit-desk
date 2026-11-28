# rationale.json (schema version 1)

`rationale.json` is the desk's structured "why" behind a dam's class, for the screening-to-record hand-off. A reviewer
can read it without opening the desk. It says which algorithm and preset gave the class, whether that class is current,
complete and ruled, which receptors and criteria drove it, which terrain and flood run it rests on, and which software
versions wrote it.

Use **Export rationale…** on the class banner (above every desk tab) or in the Report step's Export panel. The file is
named `<nid>_rationale.json`. It is built by `src/lib/crest/rationale.ts`, and `checkRationale()` validates it.

The file only reports what the desk and Hazard already decided. It never recomputes or changes a class. The status
words are the Report lead's (`reportLead`), the ruling words are the class badge's (`rulingFlag`), and the drivers
come from `src/lib/crest/class-drivers.ts`.

An example is in [`rationale.example.json`](rationale.example.json). It was built by the real builder from the ND00199
sample, with an illustrative classify result and receptor list (not a run of record).

## Versioning

`format` is always `"damit_desk/rationale"`. `schemaVersion` goes up when a field is removed, renamed or changes
meaning. Adding a field does not change it, so a reader should ignore fields it does not know.

## Fields

| Field | What it holds |
| --- | --- |
| `generatedAt` | When the file was written (ISO 8601, UTC). |
| `software` | `app`, `appVersion` (DamIT Desk build, e.g. `0.2.0+abc1234`), `engineVersion` (desk engine method version), `classifyAlgorithm` (`damit:classify` or `ndhazard:classify`), `profile` (`us` / `nd`). |
| `dam` | Id, name, NID, county, location, height, storage, `isNew`, `classOfRecord`, `nidHazard`. |
| `classification.status` | `current`, `incomplete` (some receptor layers not checked: the class is a lower bound), `stale` (the stored result was for another jurisdiction choice or other receptors: `statusWhy` says which), or `not run`. |
| `classification.headline` | The Report lead's title, word for word (the same text as the class banner). |
| `classification.jurisdiction` | The chosen preset or custom methods (`mode`, `preset`, `presetLabel`, `methods`, `advisory`, `text`, `key`). |
| `classification.ran` | What the run itself says it ran (preset, label, mode, algorithm), read back from Hazard's report. |
| `classification.suggestedClass`, `ordinal`, `genericLabel`, `tm11Class` | The class as Hazard returned it. A stale class is kept here but `status` says it is not this choice's class. |
| `classification.complete`, `notChecked` | Whether every receptor layer was checked, and why the others were not. |
| `classification.ruling` | `status`: `ruled`, `partly needs ruling`, `needs ruling` or `not applicable`; the badge's text; how many top-class hits rest on unruled values. |
| `classification.drivers` | The receptors the class rests on (below). |
| `classification.receptorsChecked`, `impacted`, `wetStructures`, `layerSources`, `railTrainsLookup`, `warnings` | What the run looked at and where its layers came from. |
| `classification.classifiedAt`, `report`, `gpkg` | When it ran and its report and receptor GeoPackage on this computer. |
| `classification.disclaimer` | A suggested class; the engineer of record and the regulating agency decide. |
| `deskScreen` | The desk's own ND / ACER TM 11 screen. `role` is always `schematic preview`: it is never the class. `level`, `label`, `resolvedClass`, `acerLevel`, `drivers`, `judgment`, `consistent`. |
| `terrain` | `source` (`USGS 3DEP`, `local DEM` or `unknown`), `path`, `service`, `sha256`, `bytes`, `modified`, `note`, and the terrain layer on record (`layer`). |
| `model` | The flood source of record: `desk` or an imported `lisflood` / `dsswise` run, with its label, files, import time, CRS, summary stats, and the `runner` / `boann` / `lisflood` versions its label or file names carry. |
| `breach` | The desk breach: method, peak, released volume, width, time, starting pool. |
| `provenance` | Where record fields came from (NID, DWR, DEM), as on the record. |

### `classification.drivers`

| Field | What it holds |
| --- | --- |
| `basis` | `driving`: Hazard's own driving hits with their receptor ids (results from 0.2.0 on). `hits`: the stored hits at the top class, rule strength only (older results; first five ids per hit). `receptor list`: the classify GeoPackage's receptors at the top class, non-advisory. `none`: nothing names them. |
| `complete` | `false` when ids were cut (more receptors than stored ids), so `receptors` is a sample. |
| `receptors[]` | `id` (e.g. `road:240`), `layer`, and, when the receptor list is loaded, `name`, `label`, `ordinal`, `depthFt`, `velFps`, `methods`, `flags`, `needsRuling`, `at`. |
| `receptorTotal` | How many receptors the driving hits name in all. |
| `methods[]` | The driving criteria: `method`, `label`, `reason`, `receptorCount`. |

### `deskScreen.drivers`

Each has `id`, `name`, `kind`, `role`, `ndClass`, `zone`, `depthFt`, `velocityFps`, `reason`, `needsJudgment` and
`wouldBe`. `role` is `sets` (at the governing class) or `holds` (unresolved: it holds the screen at Review).
`consistent` is `true` when the drivers explain the level, which the tests check on every sample.

## DEM checksum

The desk server's `GET /api/dem/digest` reads only the DEM already chosen in the desk. It does not take a path from
the page. It returns the SHA-256, size and modified time. A `.vrt` is hashed as the `.vrt` file; the tiles it lists
are not. A file over 2 GB is not hashed and is pinned by size and modified time instead. With 3DEP there is no file,
so `sha256` is `null` and `service` is the 3DEP URL. In the web desk (no desk server), `terrain.note` says the DEM could
not be named or hashed.
