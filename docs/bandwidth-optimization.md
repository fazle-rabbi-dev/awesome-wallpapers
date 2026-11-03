# Reducing bandwidth on page load

How the grid went from pulling full-size originals to loading small thumbnails,
and what other options exist.

---

## 1. The problem

The grid is a masonry layout. At `max-w-7xl` (1280px) with 4 columns, each card is
roughly **300px wide**. At 2x DPR that is a **600px** image, at most.

What the site used to send per card: the original file.

Real numbers from `wallpapers/pc/`:

| file | size |
|---|---|
| `1-synthwave-84.jpg` | 7.2 MB |
| `1366774.png` | 8.7 MB |
| `R8bKInpG-fond-decran-foret-84.png` | 6.2 MB |
| whole `wallpapers/` folder (90 images) | **144 MB** |

So a single screen of the grid could cost 20–25 MB, and scrolling through the PC
collection could cost over 100 MB for pixels that get shrunk down to 300px.

## 2. Why lazy loading did not fix it

`loading="lazy"` + the `IntersectionObserver` in `js/main.js` only control **when**
a request starts. They do not change **how many bytes** that request returns.

```
lazy loading:   delays the 7.2 MB request
thumbnails:     makes it a 17 KB request
```

Lazy loading is still worth keeping — it stops off-screen images from downloading
at all. But it is a scheduling optimization, not a size optimization.

## 3. The core idea

Stop serving one file for two very different jobs.

```
                    ┌──────────────────────────────┐
   grid card ──────►│ thumb  ~640px WebP, ~15 KB    │  ← 100x smaller
                    └──────────────────────────────┘
                    ┌──────────────────────────────┐
   lightbox ───────►│ original, untouched           │  ← only on click
   download link ──►│ original, untouched           │
                    └──────────────────────────────┘
```

The grid only needs to answer "does this look interesting?" — that is a thumbnail
job. Full resolution is only needed after the user commits by clicking.

## 4. Options considered

### A. Pre-generate thumbnails with `sharp`

A build step resizes every original to `wallpapers/thumbs/<cat>/<name>.webp` and
`generate.js` records the path in the manifest.

| | |
|---|---|
| ✅ | Fastest possible load (static file, no third party) |
| ✅ | Works offline / on `localhost` |
| ❌ | Needs `sharp` installed (`bun add -d sharp`) |
| ❌ | Adds ~90 files to the repo (a few MB, acceptable) |
| ❌ | Must re-run when wallpapers are added |

Best long-term option for a static site. **Not used here** because it required
installing a new dependency and a rebuild step.

### B. Image proxy (chosen)

Rewrite the grid URL to go through [wsrv.nl](https://wsrv.nl), a free image-resizing
CDN. No new files, no build step, no dependency.

```
wallpapers/pc/foo.jpg
   ↓
https://wsrv.nl/?url=<absolute-url-of-foo.jpg>&w=640&output=webp&q=78
```

wsrv.nl fetches the original, resizes, converts to WebP, and caches the result.

| | |
|---|---|
| ✅ | Zero setup, works immediately after deploy |
| ✅ | No repo bloat, no build step |
| ❌ | Depends on a third-party service |
| ❌ | First request per image is slow (it fetches your multi-MB original server-side) |
| ❌ | Community-run free service with fair-use limits — not for serious traffic |

### C. `srcset` only

Tempting but **does not work alone**. `srcset` lets the browser pick among files
that already exist. If the only file is the 3840px original, the browser downloads
the 3840px original. `srcset` becomes useful only *after* option A creates multiple
sizes.

## 5. What is implemented

Only `js/main.js` changed.

**URL helper** (`js/main.js`, "Thumbnails (grid only)" section):

```js
const THUMB_WIDTH = 640;
const PROXY_HOST = "https://wsrv.nl/";

const USE_PROXY =
  (location.protocol === "http:" || location.protocol === "https:") &&
  !["localhost", "127.0.0.1", "0.0.0.0", "[::1]", ""].includes(location.hostname);

function thumbURL(src) {
  if (!USE_PROXY) return src;
  const absolute = new URL(src, location.href).href;
  return `${PROXY_HOST}?url=${encodeURIComponent(absolute)}&w=${THUMB_WIDTH}&output=webp&q=78`;
}
```

**Card markup:**

```html
<img data-src="${thumbURL(item.src)}"
     data-full="${item.src}"
     loading="lazy" decoding="async"
     onerror="if(!this.dataset.failed){this.dataset.failed=1;this.src=this.dataset.full;}" />
```

Three details worth knowing:

- `new URL(src, location.href)` — wsrv.nl needs an **absolute** URL. Resolving
  against `location.href` also handles the GitHub Pages subpath
  (`/awesome-wallpapers/...`) correctly.
- `onerror` — if the proxy fails or rate-limits, the card falls back to the
  original instead of showing a broken image.
- `USE_PROXY` — wsrv.nl can only fetch a **public** origin. On `localhost`,
  `127.0.0.1`, or `file://` it would fail on every card, so the helper returns the
  original path unchanged. Local dev looks exactly like before.

The lightbox (`openLightbox`) and the download button were **not** touched — both
still use `item.src`, the original file.

## 6. Measured results

Verified against the deployed origin (`raw.githubusercontent.com` mirror):

| file | original | grid thumb | reduction |
|---|---|---|---|
| `1-synthwave-84.jpg` | 7.2 MB | 17.6 KB | 99.8% |
| `1-sunset-lake.png` | 2.8 MB | 9.5 KB | 99.7% |
| `1638744.jpg` | 890 KB | 21.6 KB | 97.6% |
| `1-city-view.png` | 393 KB | 17.7 KB | 95.5% |

Thumbnails landed at **9–22 KB** at `w=640&q=78`. For a full PC grid (~67 images)
that is roughly **1–1.5 MB total**, versus ~125 MB before.

## 7. Caveats

1. **You cannot test the proxy locally.** `localhost` is unreachable from wsrv.nl.
   To see it working you need a public URL — deploy, or use a tunnel such as
   `cloudflared tunnel --url http://localhost:PORT`.
2. **LAN IPs behave oddly.** Opening the site at `http://192.168.x.x:PORT` is not
   `localhost`, so `USE_PROXY` becomes `true`, the proxy fails, and `onerror` swaps
   back to the original — same visual result as local, but via the fallback path.
   Add private IP ranges to the check if that matters.
3. **Cold cache is slow.** The first hit on each image took 1.4–3s while wsrv
   fetched the original. Subsequent hits are cached and fast.
4. **Fair use.** wsrv.nl is a free community service. I am not certain of its exact
   rate limits (roughly a few hundred requests per few minutes per IP, ~70%
   confidence) — do not build a high-traffic product on it.

## 8. Verifying on production

On the deployed site, open DevTools → Network → filter `Img`:

- grid requests should be `wsrv.nl` and ~10–25 KB each
- the lightbox image (after clicking a card) should be `wallpapers/...` and full size

Or in the console:

```js
document.querySelector(".card img").src   // expect https://wsrv.nl/?url=...
```

## 9. Possible next steps

| change | benefit |
|---|---|
| Proxy the lightbox too (`w=1600`) | Clicking stops pulling 8 MB; download stays original |
| Migrate to option A (`sharp` pre-generated) | Removes the third-party dependency entirely |
| Blurred LQIP placeholder (~500 B inline data URI) | Perceived speed while the thumb loads |
| `srcset` with 400/640/960 widths | Sharper thumbs on wide/4K screens |

None of these are required for the current win.
