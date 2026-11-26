# Local originals (private, never publish)

This folder is gitignored. Put extracted 1998 Clinergy images here if you want the remake to show them **on your own machine only**.

The online / CI build never includes these files. Do not copy them into `public/`, `dist/`, or any git-tracked path.

## How to point this folder at the extractor output

The remake looks up files by the paths in `remake/data/images-manifest.json` (`originalRel`), for example `bodymap/M_main.png` and `buttons/All1.png`.

From the workbench repository root, after you have unpacked a clinergy-extractor output tree:

```sh
# Option A: symlink the extractor images directory
ln -sfn /path/to/clinergy-extract-out/images remake/local-originals

# Option B: two subfolders (if you only copied those trees)
mkdir -p remake/local-originals
ln -sfn /path/to/clinergy-extract-out/images/bodymap remake/local-originals/bodymap
ln -sfn /path/to/clinergy-extract-out/images/buttons remake/local-originals/buttons
```

A typical layout after option A:

```
remake/local-originals/bodymap/M_main.png
remake/local-originals/buttons/All1.png
```

Then run `npm run dev` and open `/penpad-clinergy-workbench/remake/?images=local`, or use the **Local originals** control on the host screen.

Missing files fall back to the CC0 placeholders. The Vite dev server serves this folder; it is not copied into `dist/` on `npm run build`.
