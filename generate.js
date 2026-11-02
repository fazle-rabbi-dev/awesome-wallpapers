// Scans wallpapers/ and regenerates data/wallpapers.json (with image dimensions)
// Run: bun generate.js   (or node generate.js)
import { readdirSync, writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const CATEGORIES = [
  { dir: "pc", label: "PC", kind: "desktop" },
  { dir: "phone", label: "Phone", kind: "mobile" },
];
const EXTS = [".jpg", ".jpeg", ".png", ".webp", ".avif"];

// --- Read intrinsic size from file headers (JPEG/PNG/WebP) ---
function imageSize(buf) {
  // PNG
  if (buf[0] === 0x89 && buf[1] === 0x50) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  // WebP
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    const fmt = buf.toString("ascii", 12, 16);
    if (fmt === "VP8 ") return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    if (fmt === "VP8L") {
      const b = buf.readUInt32LE(21);
      return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
    }
    if (fmt === "VP8X") {
      return { width: buf.readUIntLE(24, 3) + 1, height: buf.readUIntLE(27, 3) + 1 };
    }
  }
  // JPEG
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let off = 2;
    while (off < buf.length - 9) {
      if (buf[off] !== 0xff) { off++; continue; }
      const marker = buf[off + 1];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: buf.readUInt16BE(off + 5), width: buf.readUInt16BE(off + 7) };
      }
      off += 2 + buf.readUInt16BE(off + 2);
    }
  }
  return null; // avif etc. → no dims, site falls back
}

const items = [];
for (const cat of CATEGORIES) {
  for (const file of readdirSync(join("wallpapers", cat.dir))) {
    if (!EXTS.some((e) => file.toLowerCase().endsWith(e))) continue;
    const raw = file.replace(/\.[^.]+$/, "");
    const dims = imageSize(readFileSync(join("wallpapers", cat.dir, file)));
    items.push({
      name: raw,
      title: raw.split(/[-_]+/).map((w) => w[0].toUpperCase() + w.slice(1)).join(" "),
      src: `wallpapers/${cat.dir}/${encodeURIComponent(file)}`,
      category: cat.label,
      ...dims,
    });
  }
}
items.reverse();

mkdirSync("data", { recursive: true });
writeFileSync("data/wallpapers.json", JSON.stringify(items, null, 2));
console.log(`Generated data/wallpapers.json with ${items.length} wallpapers`);
