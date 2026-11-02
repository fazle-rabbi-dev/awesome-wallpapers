# Awesome Wallpapers

A free, open wallpaper collection — PC & phone — with a static preview/download site that runs entirely on GitHub Pages.

![Site](https://img.shields.io/badge/stack-HTML%20%7C%20Tailwind%20%7C%20Lucide-7c6cf6)

## Features
- 🖼 **Masonry layout** (Pinterest-style) via CSS columns
- ⚡ **Lazy loading** — only images near the viewport are fetched (IntersectionObserver, 400px pre-fetch margin)
- 🔍 **Search** filter by title/filename (press `/` to focus)
- 🏷 **Category filter** chips: All / PC / Phone
- 👁 **Lightbox preview** with one-click download
- 📐 Cards reserve correct space before load — reads image dimensions at build time, no layout jump

## Project structure
```
awesome-wallpapers/
├── wallpapers/
│   ├── pc/       # desktop wallpapers
│   └── phone/    # phone wallpapers
├── index.html    # the site
├── js/main.js    # lazy loading, search, lightbox
├── generate.js   # scans wallpapers/ → data/wallpapers.json
├── data/wallpapers.json   # auto-generated manifest (committed)
└── generate.mjs  # (alias for node users)
```

## Adding new wallpapers
1. Drop images into `wallpapers/pc/` or `wallpapers/phone/` (jpg/png/webp/avif)
2. Regenerate the manifest and commit both:
   ```sh
   bun generate.js    # or: node generate.js
   git add . && git commit -m "add wallpapers" && git push
   ```
   Names become titles: `among-trees-campsite.jpg` → "Among Trees Campsite".
   Search works on the filename automatically.

## Local preview
```sh
python -m http.server 8765     # then open http://localhost:8765
```
(Any static server works — `fetch()` of the manifest needs one, `file://` won't.)

## Deploy (GitHub Pages)
1. Push everything to `main` (including `data/wallpapers.json`)
2. Repo → **Settings → Pages** → Source: `main` branch, `/ (root)` → Save
3. Site lives at `https://<username>.github.io/awesome-wallpapers/`

> Tip: to auto-regenerate the manifest on push, add a GitHub Action that runs `node generate.js` and commits `data/wallpapers.json` — happy to write one if you want it.

## License
Wallpapers are for personal use. Code: MIT.
