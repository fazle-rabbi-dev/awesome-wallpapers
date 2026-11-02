/* ---------- Main logic ---------- */
const state = { items: [], query: "", filter: "all" };

// Device detection → default filter (used in init)
const isMobileDevice =
  /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
  (window.matchMedia("(pointer: coarse)").matches && window.innerWidth < 820);
const detectedCategory = isMobileDevice ? "Phone" : "PC";

const grid = document.getElementById("grid");
const empty = document.getElementById("empty");
const count = document.getElementById("count");
const searchInput = document.getElementById("search");
const lightbox = document.getElementById("lightbox");
const lbImg = document.getElementById("lb-img");
const lbTitle = document.getElementById("lb-title");
const lbOpen = document.getElementById("lb-open");
const toast = document.getElementById("toast");

/* ---------- Lazy loading (only images near the viewport are fetched) ---------- */
function setupObserver() {
  if (state.observer) state.observer.disconnect();
  state.observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const img = entry.target;
        img.src = img.dataset.src;
        delete img.dataset.src;
        state.observer.unobserve(img);
        img.addEventListener("load", () => img.classList.remove("opacity-0"), { once: true });
      }
    },
    { rootMargin: "400px" } // pre-fetch just before items scroll into view
  );
  document.querySelectorAll("#grid img[data-src]").forEach((img) => state.observer.observe(img));
}

/* ---------- Card template ---------- */
// Very tall images (phone wallpapers, ~9:20) get their *preview* cropped to 9:16
// so masonry rows stay a sane height. The download link serves the original file.
const MAX_ASPECT = 1.3; // height/width threshold for cropping the preview
const CROP_AR = 3 / 4;  // preview aspect ratio for tall images (width/height)

function cardHTML(item) {
  const download = `${item.src}?download=true`;
  const tall = item.width && item.height / item.width > MAX_ASPECT;
  const preview = tall ? `aspect-ratio:${CROP_AR}` : item.width ? `aspect-ratio:${item.width}/${item.height}` : "min-height:220px";
  return `
  <figure data-name="${item.title.toLowerCase()}" data-category="${item.category}"
          class="card group relative overflow-hidden rounded-2xl bg-surface-700 ring-1 ring-white/5
                 transition hover:ring-accent/40 hover:shadow-[0_8px_40px_rgba(124,108,246,.15)] cursor-zoom-in">
    <img data-src="${item.src}" alt="${item.title}" loading="lazy"
         style="${preview}"
         class="${tall ? "object-cover" : "object-cover"} w-full opacity-0 transition-opacity duration-300" />

    <figcaption class="absolute inset-0 flex flex-col justify-end
                       bg-gradient-to-t from-black/75 via-black/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100">
      <div class="flex items-end justify-between gap-3 p-4">
        <div class="pointer-events-none">
          <p class="text-sm font-semibold text-white drop-shadow">${item.title}</p>
          <p class="text-xs text-zinc-300">${item.category}${item.width ? ` · ${item.width}×${item.height}` : ""}</p>
        </div>
        <a href="${download}"
           download="${item.title}-${decodeURIComponent(item.src.split("/").pop())}"
           class="dl-btn grid size-10 shrink-0 place-items-center rounded-xl bg-white/15 text-white backdrop-blur-md transition hover:bg-accent"
           title="Download" onclick="event.stopPropagation()">
          <i data-lucide="download" class="size-4"></i>
        </a>
      </div>
    </figcaption>
  </figure>`;
}

/* ---------- Filtering ---------- */
function visibleItems() {
  const q = state.query.trim().toLowerCase();
  return state.items.filter((it) => {
    const matchQ = !q || `${it.title} ${it.name} ${it.category}`.toLowerCase().includes(q);
    const matchF = state.filter === "all" || it.category === state.filter;
    return matchQ && matchF;
  });
}

/* ---------- Masonry (Pinterest-style: items go to the shortest column) ---------- */
function columnCount() {
  const w = window.innerWidth;
  if (w < 640) return 1;
  if (w < 1024) return 2;
  if (w < 1280) return 3;
  return 4;
}

function renderMasonry(visible) {
  const n = columnCount();
  const heights = new Array(n).fill(0);
  const cols = Array.from({ length: n }, () => []);

  for (const item of visible) {
    // estimated height relative to a 100px-wide column; cap tall previews at 3:4
    const ratio = item.width ? Math.min(item.height / item.width, 4 / 3) : 1.5;
    const est = 100 * ratio;
    const shortest = heights.indexOf(Math.min(...heights));
    cols[shortest].push(item);
    heights[shortest] += est;
  }

  grid.innerHTML = "";
  for (const colItems of cols) {
    const col = document.createElement("div");
    col.className = "flex-1 min-w-0 flex flex-col gap-4";
    col.innerHTML = colItems.map(cardHTML).join("");
    grid.appendChild(col);
  }
}

function render() {
  const visible = visibleItems();
  renderMasonry(visible);
  empty.classList.toggle("hidden", visible.length > 0);
  count.textContent = `${visible.length} of ${state.items.length}`;
  lucide.createIcons();
  setupObserver();
}

/* ---------- Events ---------- */
searchInput.addEventListener("input", (e) => { state.query = e.target.value; render(); });

document.getElementById("filters").addEventListener("click", (e) => {
  const btn = e.target.closest(".filter-chip");
  if (!btn) return;
  document.querySelectorAll(".filter-chip").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  state.filter = btn.dataset.filter;
  render();
});

// "/" focuses search, Esc closes lightbox
document.addEventListener("keydown", (e) => {
  if (e.key === "/" && document.activeElement !== searchInput) { e.preventDefault(); searchInput.focus(); }
  if (e.key === "Escape" && !lightbox.classList.contains("hidden")) closeLightbox();
});

// pre-activate the detected device's chip
preselectFilter();
function preselectFilter() {
  document.querySelectorAll(".filter-chip").forEach((b) => b.classList.remove("active"));
  document.querySelector(`.filter-chip[data-filter="${detectedCategory}"]`)?.classList.add("active");
}

/* ---------- Lightbox ---------- */
function openLightbox(item) {
  lbImg.src = item.src;
  lbImg.alt = item.title;
  lbTitle.textContent = item.title;
  lbOpen.href = `${item.src}?download=true`;
  lbOpen.setAttribute("download", decodeURIComponent(item.src.split("/").pop()));
  lightbox.classList.remove("hidden");
  lightbox.classList.add("flex");
  document.body.style.overflow = "hidden";
}
function closeLightbox() {
  lightbox.classList.add("hidden");
  lightbox.classList.remove("flex");
  document.body.style.overflow = "";
}

grid.addEventListener("click", (e) => {
  if (e.target.closest(".dl-btn")) return; // let the download link work
  const card = e.target.closest(".card");
  if (!card) return;
  const item = state.items.find((it) => it.title.toLowerCase() === card.dataset.name);
  if (item) openLightbox(item);
});

lightbox.addEventListener("click", (e) => { if (e.target === lightbox) closeLightbox(); });
document.getElementById("lb-close").addEventListener("click", closeLightbox);

/* ---------- Toast ---------- */
let toastTimer;
grid.addEventListener("click", (e) => {
  if (!e.target.closest(".dl-btn")) return;
  toast.textContent = "Download started…";
  toast.style.opacity = "1";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.style.opacity = "0"), 1800);
});

/* ---------- Init ---------- */
let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { if (state.items.length) render(); }, 150);
});

async function init() {
  try {
    const res = await fetch("data/wallpapers.json");
    state.items = await res.json();
    state.filter = detectedCategory; // show matching wallpapers by default
    render();
  } catch (err) {
    grid.innerHTML = `<p class="text-center text-zinc-500">Failed to load wallpapers: ${err.message}</p>`;
  }
}
init();
