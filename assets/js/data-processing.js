// Data fetching and processing
import { state, DETAIL_KEYS } from './state.js';
import { slugifyId, mergeMetadata } from './utils.js';
import { extractAlbumNames, extractAlbumName, albumKeyFromName } from './gallery-renderer.js';

// Data fetching functions
export async function fetchGalleryData() {
  try {
    const response = await fetch("data/gallery.json", { cache: "no-cache" });
    if (!response.ok) throw new Error(`Request failed: ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data.images)) throw new Error("Invalid gallery payload");
    return data;
  } catch (error) {
    throw new Error(`Unable to load gallery: ${error.message}`);
  }
}

export async function fetchCaptionsData() {
  try {
    const response = await fetch("data/captions.json", { cache: "no-cache" });
    if (!response.ok) throw new Error(`Request failed: ${response.status}`);
    const data = await response.json();
    const photos = data && typeof data.photos === "object" ? data.photos : {};
    const digital = data && typeof data.digital === "object" ? data.digital : {};
    return { photos, digital };
  } catch (error) {
    console.warn("Unable to load captions:", error);
    return { photos: {}, digital: {} };
  }
}

export async function fetchDigitalArtData() {
  try {
    const response = await fetch("data/digital-art.json", { cache: "no-cache" });
    if (!response.ok) throw new Error(`Request failed: ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data.images)) throw new Error("Invalid digital art payload");
    return data.images;
  } catch (error) {
    throw new Error(`Unable to load digital art: ${error.message}`);
  }
}

// Data processing functions
export function annotateWithIndex(items) {
  return items.map((item, index) => {
    const albumNames = extractAlbumNames(item);
    const primaryAlbum = albumNames.length ? albumNames[0] : null;
    const rawId = item.id ?? item.filename ?? item.name ?? item.alt ?? "";
    const derivedSlug = slugifyId(rawId) || `image-${index}`;
    return {
      ...item,
      __index: index,
      __album: primaryAlbum,
      __albums: albumNames,
      __slug: derivedSlug,
    };
  });
}

export function enrichWithCaptions(items, captionMap) {
  if (!Array.isArray(items) || !captionMap || typeof captionMap !== "object") {
    return items;
  }
  return items.map((item) => {
    const slug = item.__slug || slugifyId(item.id ?? item.alt ?? "");
    const entry = slug ? captionMap[slug] : null;
    if (!entry || typeof entry !== "object") return item;
    const mergedMetadata = mergeMetadata(item.metadata, entry.metadata);
    let details = null;
    if (entry.details && typeof entry.details === "object") {
      details = DETAIL_KEYS.reduce((result, key) => {
        if (entry.details[key]) {
          result[key] = entry.details[key];
        }
        return result;
      }, {});
      if (!Object.keys(details).length) {
        details = null;
      }
    }
    return {
      ...item,
      caption: entry.caption ?? item.caption ?? item.id ?? "",
      description: entry.description ?? item.description ?? "",
      metadata: mergedMetadata,
      details,
    };
  });
}

export function deriveAlbums(photos, albumCatalog) {
  if (Array.isArray(albumCatalog) && albumCatalog.length) {
    return integrateAlbumCatalog(albumCatalog, photos);
  }
  return buildAlbumGroupsFromMetadata(photos);
}

function integrateAlbumCatalog(albumCatalog, photos) {
  const photoIndex = new Map();
  photos.forEach((photo) => {
    if (photo && typeof photo.id === "string") {
      photoIndex.set(photo.id, photo);
    }
  });
  
  // Collect all sub-album IDs to filter them out from main gallery
  const subAlbumIds = new Set();
  for (const album of albumCatalog) {
    if (album && Array.isArray(album.subAlbums)) {
      album.subAlbums.forEach(subAlbum => {
        if (subAlbum && subAlbum.id) {
          subAlbumIds.add(subAlbum.id);
        }
      });
    }
  }
  
  const groups = [];
  const lookup = {};
  for (const album of albumCatalog) {
    if (!album || typeof album !== "object") continue;
    // Skip albums that are sub-albums (they should only appear within their parent)
    if (album.id && subAlbumIds.has(album.id)) continue;
    const name = typeof album.name === "string" && album.name.trim() ? album.name.trim() : null;
    const keySource = typeof album.id === "string" && album.id.trim() ? album.id.trim() : name;
    if (!keySource) continue;
    const key = albumKeyFromName(keySource);
    if (!key) continue;
    const description = typeof album.description === "string" ? album.description.trim() : "";
    const rawItems = Array.isArray(album.items) ? album.items : [];
    const seenIds = new Set();
    const albumItems = [];
    const coverSources = [];
    for (const rawItem of rawItems) {
      if (!rawItem || typeof rawItem !== "object") continue;
      const itemId = typeof rawItem.id === "string" ? rawItem.id : null;
      if (!itemId || seenIds.has(itemId)) continue;
      const basePhoto = photoIndex.get(itemId);
      if (!basePhoto) continue;
      seenIds.add(itemId);
      const clone = { ...basePhoto };
      if (typeof rawItem.thumbnail === "string" && rawItem.thumbnail.trim()) {
        clone.thumbnail = rawItem.thumbnail.trim();
      }
      if (typeof rawItem.full === "string" && rawItem.full.trim()) {
        clone.full = rawItem.full.trim();
      }
      clone.__album = name || basePhoto.__album || "";
      clone.__albumKey = key;
      albumItems.push(clone);
      const coverCandidate = clone.thumbnail || clone.full || basePhoto.thumbnail || basePhoto.full;
      if (coverCandidate) {
        coverSources.push(coverCandidate);
      }
    }
    // Allow albums with sub-albums even if they have no items
    const hasSubAlbums = Array.isArray(album.subAlbums) && album.subAlbums.length > 0;
    if (!albumItems.length && !hasSubAlbums) continue;
    
    // Check if album has a custom cover image specified
    const customCoverId = typeof album.cover === "string" ? album.cover.trim() : null;
    let covers = [];
    
    if (customCoverId) {
      // First try to find the custom cover image in albumItems
      let coverPhoto = albumItems.find((item) => item.id === customCoverId);
      
      // If not found in album items, try the main photo index
      if (!coverPhoto) {
        coverPhoto = photoIndex.get(customCoverId);
      }
      
      if (coverPhoto) {
        const coverUrl = coverPhoto.thumbnail || coverPhoto.full || "";
        if (coverUrl) {
          covers.push(coverUrl);
          // Add remaining covers from album items (excluding the cover image if it's in the album)
          const otherCovers = albumItems
            .filter((item) => item.id !== customCoverId)
            .map((item) => item.thumbnail || item.full || "")
            .filter(Boolean)
            .slice(0, 2);
          covers.push(...otherCovers);
        }
      }
    }
    
    // If no custom cover or custom cover not found, try custom cover from photo index
    if (covers.length === 0 && customCoverId) {
      const coverPhoto = photoIndex.get(customCoverId);
      if (coverPhoto) {
        const coverUrl = coverPhoto.thumbnail || coverPhoto.full || "";
        if (coverUrl) {
          covers.push(coverUrl);
          // Add remaining covers from album items
          const otherCovers = albumItems
            .map((item) => item.thumbnail || item.full || "")
            .filter(Boolean)
            .slice(0, 2);
          covers.push(...otherCovers);
        }
      }
    }
    
    // If still no covers, use default behavior from album items
    if (covers.length === 0) {
      covers = coverSources.slice(0, 3);
    }
    
    // Ensure we have at least 3 covers (duplicate last one if needed)
    while (covers.length && covers.length < 3) {
      covers.push(covers[covers.length - 1]);
    }
    
    // Final fallback - ensure we have at least one cover (for albums with sub-albums but no items)
    if (!covers.length && customCoverId) {
      const coverPhoto = photoIndex.get(customCoverId);
      if (coverPhoto) {
        const coverUrl = coverPhoto.thumbnail || coverPhoto.full || "";
        if (coverUrl) {
          covers.push(coverUrl);
          // Duplicate to fill 3 covers
          while (covers.length < 3) {
            covers.push(coverUrl);
          }
        }
      }
    }
    // Get sub-albums from original album data
    const subAlbums = Array.isArray(album.subAlbums) ? album.subAlbums : [];
    const scrabbleThumbs = albumItems
      .slice(0, 12)
      .map((item) => item.thumbnail || item.full || "")
      .filter(Boolean);
    
    const titleColor = typeof album.titleColor === "string" && album.titleColor.trim() ? album.titleColor.trim() : null;
    const albumViewBackgroundId =
      typeof album.albumViewBackgroundId === "string" && album.albumViewBackgroundId.trim()
        ? album.albumViewBackgroundId.trim()
        : undefined;
    const albumViewBackground =
      typeof album.albumViewBackground === "string" && album.albumViewBackground.trim()
        ? album.albumViewBackground.trim()
        : undefined;
    const group = {
      name: name || key,
      key,
      count: albumItems.length,
      covers,
      scrabbleThumbs: scrabbleThumbs.length ? scrabbleThumbs : covers,
      description,
      items: albumItems,
      subAlbums: subAlbums,
      titleColor: titleColor || undefined,
      albumViewBackgroundId: albumViewBackgroundId || undefined,
      albumViewBackground: albumViewBackground || undefined,
    };
    groups.push(group);
    lookup[key] = group;
  }
  groups.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  return { groups, lookup };
}

function buildAlbumGroupsFromMetadata(images) {
  const map = new Map();
  for (const image of images) {
    const albumName = extractAlbumName(image);
    if (!albumName) continue;
    const key = albumKeyFromName(albumName);
    if (!key) continue;
    if (!map.has(key)) {
      map.set(key, {
        name: albumName,
        key,
        items: [],
        description: "",
      });
    }
    const entry = map.get(key);
    entry.items.push(image);
    if (!entry.description && image.metadata && typeof image.metadata === "object") {
      const meta = image.metadata;
      const desc =
        (typeof meta.albumDescription === "string" && meta.albumDescription.trim()) ||
        (typeof meta.albumSummary === "string" && meta.albumSummary.trim()) ||
        "";
      if (desc) {
        entry.description = desc;
      }
    }
  }
  const groups = [];
  const lookup = {};
  for (const entry of map.values()) {
    if (!entry.items.length) continue;
    const covers = entry.items
      .slice(0, 3)
      .map((item) => item.thumbnail || item.full || "")
      .filter(Boolean);
    while (covers.length && covers.length < 3) {
      covers.push(covers[covers.length - 1]);
    }
    const scrabbleThumbs = entry.items
      .slice(0, 12)
      .map((item) => item.thumbnail || item.full || "")
      .filter(Boolean);
    const group = {
      name: entry.name,
      key: entry.key,
      count: entry.items.length,
      covers,
      scrabbleThumbs: scrabbleThumbs.length ? scrabbleThumbs : covers,
      description: entry.description || "",
      items: entry.items,
    };
    groups.push(group);
    lookup[entry.key] = group;
  }
  groups.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  return { groups, lookup };
}
