# Local image pack (private, never publish)

This folder is gitignored. Put an **unpacked image pack** here if you want the remake to use it **on your own machine only** (development with `?images=local`).

The online / CI build never includes these files. Do not copy them into `public/`, `dist/`, or any git-tracked path. A pack produced from the 1998 Clinergy demo is a private study copy and must never be committed or published.

The pack format is documented in [`docs/image-pack.md`](../../docs/image-pack.md).

## Layout

```
remake/local-originals/pack.yaml
remake/local-originals/images/bodymap/M_main.png
remake/local-originals/images/buttons/All1.png
…
```

## How to get a pack

If you have your own copy of the 1998 demo, build a pack with clinergy-extractor (no need to re-run Wine if you already have an extract tree):

```sh
deno task image-pack /path/to/clinergy-extract-out
# writes /path/to/clinergy-extract-out/penpad-image-pack-clinergy-1998.zip
```

Unzip it into this folder (from the workbench repository root):

```sh
mkdir -p remake/local-originals
python3 - <<'PY'
import zipfile
from pathlib import Path
z = zipfile.ZipFile("/path/to/clinergy-extract-out/penpad-image-pack-clinergy-1998.zip")
z.extractall("remake/local-originals")
# If the zip has a single wrapping folder, flatten it so pack.yaml sits here.
PY
```

Then run `npm run dev` and open `/penpad-clinergy-workbench/remake/?images=local`. You can also upload the zip in the remake UI (stored in this browser’s IndexedDB; use **Revert to built-in pack** to go back to the CC0 placeholders).

The Vite dev server serves this folder; it is not copied into `dist/` on `npm run build`.
