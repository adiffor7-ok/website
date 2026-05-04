// Utility functions
import { METADATA_LABELS, METADATA_EXCLUDE, DETAIL_KEYS } from './state.js';

export function slugifyId(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** URL used in the album viewer: animated GIF when `fullGif` exists, else full still image (e.g. WebP). */
export function resolveAlbumViewerUrl(item) {
  if (!item || typeof item !== "object") return "";
  const gif = typeof item.fullGif === "string" && item.fullGif.trim() ? item.fullGif.trim() : "";
  if (gif) return gif;
  const full = typeof item.full === "string" && item.full.trim() ? item.full.trim() : "";
  if (full) return full;
  const thumb = typeof item.thumbnail === "string" && item.thumbnail.trim() ? item.thumbnail.trim() : "";
  return thumb || "";
}

export function humanizeLabel(label) {
  if (!label) return "";
  return label
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase());
}

export function parseDatasetJSON(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
}

export function mergeMetadata(base, extra) {
  const result = base && typeof base === "object" ? { ...base } : {};
  if (!extra || typeof extra !== "object") return result;
  for (const [key, value] of Object.entries(extra)) {
    if (value === undefined || value === null || value === "") continue;
    result[key] = value;
  }
  return result;
}

export function hexToRgb(hex) {
  if (!hex) return null;
  let normalized = hex.trim().replace("#", "");
  if (normalized.length === 3) {
    normalized = normalized
      .split("")
      .map((char) => char + char)
      .join("");
  }
  if (normalized.length !== 6) return null;
  const value = parseInt(normalized, 16);
  if (Number.isNaN(value)) return null;
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

export function mixColors(base, accent, blend = 0.3, alpha = 0.92) {
  if (!accent) return `rgba(${base.r}, ${base.g}, ${base.b}, ${alpha})`;
  const clamp = (value) => Math.max(0, Math.min(255, value));
  const r = clamp(Math.round(base.r * (1 - blend) + accent.r * blend));
  const g = clamp(Math.round(base.g * (1 - blend) + accent.g * blend));
  const b = clamp(Math.round(base.b * (1 - blend) + accent.b * blend));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function buildMetadataList(metadata) {
  if (!metadata || typeof metadata !== "object") return null;
  const entries = Object.entries(metadata)
    .filter(([key, value]) => !METADATA_EXCLUDE.has(key) && Boolean(value))
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        return [key, value.join(", ")];
      }
      return [key, String(value)];
    });
  if (!entries.length) return null;
  const list = document.createElement("dl");
  list.className = "metadata-list";
  for (const [key, value] of entries) {
    const dt = document.createElement("dt");
    dt.textContent = METADATA_LABELS[key] || humanizeLabel(key);
    const dd = document.createElement("dd");
    dd.textContent = value;
    list.appendChild(dt);
    list.appendChild(dd);
  }
  return list;
}

export function buildDetailsList(details) {
  if (!details || typeof details !== "object") return null;
  const entries = DETAIL_KEYS.map((key) => [key, details[key]])
    .filter(([, value]) => Boolean(value));
  if (!entries.length) return null;
  const list = document.createElement("dl");
  list.className = "metadata-list details-list";
  for (const [key, value] of entries) {
    const dt = document.createElement("dt");
    dt.textContent = METADATA_LABELS[key] || humanizeLabel(key);
    const dd = document.createElement("dd");
    dd.textContent = String(value);
    list.appendChild(dt);
    list.appendChild(dd);
  }
  return list;
}

// Check if browser supports WebP
let webpSupported = null;
export function checkWebPSupport() {
  if (webpSupported !== null) return webpSupported;
  
  // Check using canvas method (most reliable)
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  webpSupported = canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
  
  return webpSupported;
}

export function hasGalleryElements(state) {
  const { gallery, template, loading, error } = state.selectors;
  return Boolean(gallery && template && loading && error);
}

export function hasDigitalArtElements(state) {
  const { digitalGallery, digitalTemplate, digitalLoading, digitalError } = state.selectors;
  return Boolean(digitalGallery && digitalTemplate && digitalLoading && digitalError);
}

