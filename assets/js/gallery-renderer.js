// Gallery rendering functions
import { state, BLACK_LIGHTNESS_MAX, BLACK_CHROMA_MAX, WHITE_LIGHTNESS_MIN, WHITE_CHROMA_MAX, GREY_CHROMA_MAX, NEUTRAL_GROUPS, NEUTRAL_RANK } from './state.js';
import { hasGalleryElements, hasDigitalArtElements, slugifyId, resolveAlbumViewerUrl } from './utils.js';
import { isVideoItem, generateLowQualityPlaceholder, clearImageError, retryImageLoad, setupWebPImage } from './image-handling.js';
import { setupLazyLoading } from './lazy-loading.js';

// Helper functions for album name extraction
function normalizeAlbumName(album) {
  if (typeof album !== "string") return null;
  const trimmed = album.trim();
  return trimmed.length ? trimmed : null;
}

export function albumKeyFromName(name) {
  return normalizeAlbumName(name)?.toLowerCase().replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "") || null;
}

export function extractAlbumNames(image) {
  if (!image || typeof image !== "object") return [];
  const names = [];
  const pushUnique = (value) => {
    const normalized = normalizeAlbumName(value);
    if (!normalized) return;
    if (!names.includes(normalized)) {
      names.push(normalized);
    }
  };

  if (typeof image.album === "string") {
    pushUnique(image.album);
  }

  const metadata = image.metadata;
  if (metadata && typeof metadata === "object") {
    if (typeof metadata.album === "string") {
      pushUnique(metadata.album);
    }
    if (typeof metadata.Album === "string") {
      pushUnique(metadata.Album);
    }
    const metaAlbums = metadata.albums;
    if (Array.isArray(metaAlbums)) {
      metaAlbums.forEach(pushUnique);
    }
  }

  return names;
}

export function extractAlbumName(image) {
  const names = extractAlbumNames(image);
  return names.length ? names[0] : null;
}

// Color sorting helpers
function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeHue(hue) {
  if (!isFiniteNumber(hue)) return Number.POSITIVE_INFINITY;
  const normalized = hue % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function getColorMetrics(image) {
  const metrics = image.colorMetrics;
  if (metrics && typeof metrics === "object") {
    const lightness = Number(metrics.lightness);
    const chroma = Number(metrics.chroma);
    const hue = normalizeHue(metrics.hue);
    return {
      lightness: isFiniteNumber(lightness) ? lightness : 0,
      chroma: isFiniteNumber(chroma) ? chroma : 0,
      hue,
    };
  }

  const rgb = image?.dominantColor?.rgb;
  if (rgb && typeof rgb === "object") {
    const { r = 0, g = 0, b = 0 } = rgb;
    const labLight = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return {
      lightness: labLight / 2.55,
      chroma: 0,
      hue: Number.POSITIVE_INFINITY,
    };
  }

  return {
    lightness: 0,
    chroma: 0,
    hue: Number.POSITIVE_INFINITY,
  };
}

function categorizePerceptualGroup(metrics) {
  const { lightness, chroma, hue } = metrics;
  if (lightness <= BLACK_LIGHTNESS_MAX && chroma <= BLACK_CHROMA_MAX) {
    return "blacks";
  }
  if (lightness >= WHITE_LIGHTNESS_MIN && chroma <= WHITE_CHROMA_MAX) {
    return "whites";
  }
  if (chroma <= GREY_CHROMA_MAX || !Number.isFinite(hue)) {
    return "greys";
  }
  if (hue < 15 || hue >= 345) return "reds";
  if (hue < 45) return "oranges";
  if (hue < 75) return "yellows";
  if (hue < 165) return "greens";
  if (hue < 210) return "blues";
  if (hue < 250) return "indigos";
  if (hue < 300) return "purples";
  if (hue < 345) return "pinks";
  return "reds";
}

function comparePerceptualEntries(aEntry, bEntry) {
  const { item: itemA, metrics: metricsA, group: groupA } = aEntry;
  const { item: itemB, metrics: metricsB, group: groupB } = bEntry;

  const neutralA = NEUTRAL_GROUPS.has(groupA);
  const neutralB = NEUTRAL_GROUPS.has(groupB);

  if (neutralA !== neutralB) {
    return neutralA ? 1 : -1;
  }

  if (!neutralA && !neutralB) {
    const hueDiff = metricsA.hue - metricsB.hue;
    if (Math.abs(hueDiff) > 1e-6) return hueDiff;

    const chromaDiff = metricsB.chroma - metricsA.chroma;
    if (Math.abs(chromaDiff) > 1e-6) return chromaDiff;

    const lightDiff = metricsB.lightness - metricsA.lightness;
    if (Math.abs(lightDiff) > 1e-6) return lightDiff;

    return (itemA.__index ?? 0) - (itemB.__index ?? 0);
  }

  const rankA = NEUTRAL_RANK[groupA] ?? Number.POSITIVE_INFINITY;
  const rankB = NEUTRAL_RANK[groupB] ?? Number.POSITIVE_INFINITY;
  if (rankA !== rankB) return rankA - rankB;

  if (groupA === "whites") {
    const lightDiff = metricsB.lightness - metricsA.lightness;
    if (Math.abs(lightDiff) > 1e-6) return lightDiff;
  } else if (groupA === "blacks") {
    const lightDiff = metricsA.lightness - metricsB.lightness;
    if (Math.abs(lightDiff) > 1e-6) return lightDiff;
  } else {
    const chromaDiff = metricsB.chroma - metricsA.chroma;
    if (Math.abs(chromaDiff) > 1e-6) return chromaDiff;

    const lightDiff = metricsB.lightness - metricsA.lightness;
    if (Math.abs(lightDiff) > 1e-6) return lightDiff;
  }

  return (itemA.__index ?? 0) - (itemB.__index ?? 0);
}

export function sortCollectionByMode(items, mode) {
  if (!Array.isArray(items)) return [];
  if (mode === "default") {
    return [...items].sort((a, b) => (a.__index ?? 0) - (b.__index ?? 0));
  }

  const annotated = items.map((item) => {
    const metrics = getColorMetrics(item);
    const group = categorizePerceptualGroup(metrics);
    return { item, metrics, group };
  });

  annotated.sort(comparePerceptualEntries);
  return annotated.map((entry) => entry.item);
}

// Main rendering function
export function renderCollection(images, { container, template }) {
  if (!container || !template) return;
  if (!Array.isArray(images)) {
    console.error('renderCollection: images must be an array', images);
    return;
  }
  const fragment = document.createDocumentFragment();

  for (const image of images) {
    if (!image || typeof image !== 'object') {
      console.warn('renderCollection: skipping invalid image', image);
      continue;
    }
    const node = template.content.firstElementChild.cloneNode(true);
    const img = node.querySelector("img");
    const altText = image.alt ?? image.id?.replace(/[-_]+/g, " ") ?? "";
    const thumbnail = image.thumbnail ?? image.src ?? image.full ?? "";
    const full = image.full ?? image.src ?? image.thumbnail ?? "";
    const viewerFull = resolveAlbumViewerUrl(image) || full || "";

    // For Google Photos URLs, use them directly without encodeURI
    // encodeURI can break Google Photos URLs that are already properly encoded
    const safeThumbnail = thumbnail || "";
    const safeFull = full || "";

    // In album mode, use thumbnails for the grid
    const { gallery } = state.selectors;
    const isAlbumMode = gallery && gallery.classList.contains("is-album-mode") && container === gallery;
    /* Album grid: show animated GIF when catalog has fullGif (WebP stays fallback for errors / metadata). */
    const fullGifTrim =
      typeof image.fullGif === "string" && image.fullGif.trim() ? image.fullGif.trim() : "";
    const albumGridVisibleSrc = isAlbumMode && fullGifTrim ? fullGifTrim : safeThumbnail;
    
    // Make gallery card keyboard accessible
    node.setAttribute('role', 'button');
    node.setAttribute('tabindex', '0');
    node.setAttribute('aria-label', altText || 'View image');
    
    // Keyboard handler for gallery cards
    const handleCardKeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        img.click();
      }
    };
    node.addEventListener('keydown', handleCardKeydown);
    
    // Add skeleton loading state
    node.classList.add('skeleton');
    
    // Use Intersection Observer for lazy loading if available
    if (state.lazyLoadObserver && safeThumbnail) {
      // Store src in data-src for lazy loading
      img.dataset.src = albumGridVisibleSrc || safeFull;
      img.dataset.full = viewerFull || safeFull;
      
      // In album mode, load thumbnails directly without blur
      // In main gallery, use progressive loading with blur
      if (isAlbumMode) {
        // Album mode: load thumbnail directly, no blur
        const actualImg = setupWebPImage(img, albumGridVisibleSrc || safeThumbnail, safeFull, altText);
        actualImg.src = albumGridVisibleSrc || safeFull;
        actualImg.alt = altText;
        actualImg.referrerPolicy = 'no-referrer';
        if (safeThumbnail && safeThumbnail.includes('googleusercontent.com')) {
          actualImg.loading = 'lazy';
        }
        
        // Remove skeleton when image loads
        actualImg.addEventListener('load', () => {
          node.classList.remove('skeleton');
        }, { once: true });
        actualImg.addEventListener('error', () => {
          node.classList.remove('skeleton');
        }, { once: true });
      } else {
        // Main gallery: use progressive loading with blur
        const placeholderUrl = generateLowQualityPlaceholder(safeThumbnail || safeFull);
        
        // Use placeholder or minimal SVG
        if (placeholderUrl) {
          img.src = placeholderUrl;
          img.style.filter = 'blur(10px)';
          img.style.transition = 'filter 0.3s ease-out';
        } else {
          img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1" height="1"%3E%3C/svg%3E';
        }
        
        img.alt = altText;
        img.referrerPolicy = 'no-referrer';
        // Mark for observation - will be observed after fragment is appended
        img.dataset.lazy = 'true';
      }
    } else {
      // Fallback to native lazy loading
      const actualImg = setupWebPImage(img, albumGridVisibleSrc || safeThumbnail, safeFull, altText);
      actualImg.src = albumGridVisibleSrc || safeFull;
      actualImg.alt = altText;
      actualImg.referrerPolicy = 'no-referrer';
      if (safeThumbnail && safeThumbnail.includes('googleusercontent.com')) {
        actualImg.loading = 'lazy';
      }
    }
    
    // Set up error handling with retry mechanism
    if (safeThumbnail || safeFull || albumGridVisibleSrc) {
      const urlsToTry = [];
      if (albumGridVisibleSrc) urlsToTry.push(albumGridVisibleSrc);
      if (safeThumbnail && safeThumbnail !== albumGridVisibleSrc) urlsToTry.push(safeThumbnail);
      if (safeFull && safeFull !== albumGridVisibleSrc && safeFull !== safeThumbnail) urlsToTry.push(safeFull);
      
      // Only set up error handling if we're not using lazy loading
      // (lazy loading handles errors in the observer)
      if (!state.lazyLoadObserver || !img.dataset.lazy) {
        // Check if image is already loaded successfully
        if (img.complete && img.naturalWidth > 0) {
          // Image already loaded, ensure no error state
          const card = img.closest('.gallery-card');
          clearImageError(card, img);
        } else {
          img.addEventListener('error', function onError() {
            const card = this.closest('.gallery-card');
            retryImageLoad(this, card, urlsToTry, 0);
          }, { once: true });
          
          // Clear any error on successful load
          img.addEventListener('load', function onLoad() {
            const card = this.closest('.gallery-card');
            clearImageError(card, this);
          }, { once: true });
        }
      }
    }
    // Don't set crossorigin - img tags work fine without it for simple display
    // Google Photos URLs work in img tags without CORS
    if (safeThumbnail) {
      img.dataset.thumbnail = safeThumbnail;
    }
    if (viewerFull || safeFull) {
      img.dataset.full = viewerFull || safeFull;
    }
    /* Hover (-ue) overlay is only used in the standalone album viewer, not in the grid */
    img.dataset.caption = image.caption || "";
    img.dataset.description = image.description || "";
    const linksString = image.links && Array.isArray(image.links) && image.links.length
      ? JSON.stringify(image.links)
      : "";
    if (linksString) {
      img.dataset.links = linksString;
    }
    const detailsString = image.details && typeof image.details === "object" && Object.keys(image.details).length
      ? JSON.stringify(image.details)
      : "";
    const metadataString = image.metadata && typeof image.metadata === "object" && Object.keys(image.metadata).length
      ? JSON.stringify(image.metadata)
      : "";
    if (detailsString) {
      img.dataset.details = detailsString;
    } else {
      delete img.dataset.details;
    }
    if (metadataString) {
      img.dataset.metadata = metadataString;
    } else {
      delete img.dataset.metadata;
    }
    img.dataset.orientation = image.orientation || "";
    // Store media type for video detection
    // Check if item is a video using comprehensive detection
    // Also check if we're in Celeste album (all items are videos)
    let albumName = image.__album || extractAlbumName(image);
    // If in album mode, also check the active album name from state
    if (isAlbumMode && !albumName) {
      const activeKey = state.albums.activeKey;
      if (activeKey && state.albums.lookup && state.albums.lookup[activeKey]) {
        albumName = state.albums.lookup[activeKey].name || '';
      }
    }
    const isCelesteAlbum = albumName === "Celeste";
    let isVideo = isVideoItem(image, safeFull || safeThumbnail, albumName);
    // Override: if in Celeste album, always treat as video
    if (isCelesteAlbum) {
      isVideo = true;
    }
    const mediaType = isVideo ? 'video' : (image.metadata?.type || image.type || 'image');
    img.dataset.mediaType = mediaType;
    
    // Add video element for hover playback in album mode
    if (isAlbumMode && isVideo) {
      const video = document.createElement('video');
      video.className = 'gallery-card-video';
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = 'none'; // Don't preload - wait for hover to avoid rate limiting
      video.style.display = 'none';
      video.style.position = 'absolute';
      video.style.top = '0';
      video.style.left = '0';
      video.style.width = '100%';
      video.style.height = '100%';
      video.style.objectFit = 'cover';
      video.style.backgroundColor = '#000'; // Ensure black background
      video.style.pointerEvents = 'none'; // Allow clicks to pass through to the card
      
      // Get video URL - Google Photos videos need special handling
      // The original URL is an image URL, we need to convert it to a video URL
      let baseUrl = safeFull;
      let isGooglePhotos = false;
      if (safeFull.includes('googleusercontent.com')) {
        // Extract base URL - split on first = to remove size parameters
        baseUrl = safeFull.split('=')[0];
        isGooglePhotos = true;
      }
      
      // Don't set src yet - wait until hover to avoid CORS/preload issues
      // Store the base URL for later use
      video.dataset.baseUrl = baseUrl;
      video.dataset.isGooglePhotos = isGooglePhotos ? 'true' : 'false';
      
      // For Google Photos videos, only use =dv format (original URL is an image, not a video)
      // For actual video files (like .mp4), we can try the original URL first
      if (isGooglePhotos) {
        // Google Photos: only use =dv format
        const videoUrl = baseUrl + '=dv';
        video.dataset.videoUrl = videoUrl;
      } else {
        // Actual video file: try original URL first, then fallback to =dv if needed
        video.dataset.originalUrl = safeFull;
        const videoUrl = baseUrl + '=dv';
        video.dataset.videoUrl = videoUrl;
      }
      
      video.referrerPolicy = 'no-referrer';
      video.setAttribute('playsinline', 'true');
      video.setAttribute('webkit-playsinline', 'true');
      
      // Handle video stalling/buffering
      video.addEventListener('stalled', () => {
        const currentTime = video.currentTime;
        video.load();
        if (currentTime > 0) {
          video.currentTime = currentTime;
        }
        video.play().catch(e => console.warn('Video play after reload failed:', e));
      });
      
      // Hover to play - load video URL on hover
      node.addEventListener('mouseenter', () => {
        // Hide image completely
        img.style.opacity = '0';
        img.style.visibility = 'hidden';
        // Show video
        video.style.display = 'block';
        video.style.opacity = '1';
        video.style.zIndex = '2';
        video.style.visibility = 'visible';
        video.style.pointerEvents = 'none'; // Allow clicks to pass through to the card
        
        // Load and play video
        const playVideo = () => {
          const playPromise = video.play();
          if (playPromise !== undefined) {
            playPromise
              .then(() => {
                console.log('Video playing successfully:', video.src);
              })
              .catch(e => {
                console.warn('Video play failed:', e, 'URL:', video.src);
                // Try loading again if play fails
                video.load();
                setTimeout(() => {
                  video.play().catch(err => console.warn('Video play retry failed:', err));
                }, 200);
              });
          }
        };
        
        // Get video URL - for Google Photos, use proxy server to avoid CORS issues
        // For actual video files, try original URL first
        const isGooglePhotos = video.dataset.isGooglePhotos === 'true';
        const originalUrl = video.dataset.originalUrl;
        const dvUrl = video.dataset.videoUrl;
        
        if (!dvUrl) {
          console.error('No video URL available');
          return;
        }
        
        // For Google Photos videos, use proxy server to avoid CORS/OpaqueResponseBlocking
        // For actual video files, try original URL first, then fallback to =dv
        if (isGooglePhotos) {
          // Google Photos: use proxy server
          const proxyUrl = `/api/proxy-video?url=${encodeURIComponent(dvUrl)}`;
          video.src = proxyUrl;
          video.referrerPolicy = 'no-referrer';
        } else if (originalUrl) {
          // Actual video file: try original URL first
          video.src = originalUrl;
          video.referrerPolicy = 'no-referrer';
          
          // If original URL fails, try =dv format
          video.addEventListener('error', function tryDvFormat() {
            if (dvUrl && video.error && video.error.code === 4) {
              console.log('Original URL failed, trying =dv format');
              video.removeEventListener('error', tryDvFormat);
              video.src = dvUrl;
              video.referrerPolicy = 'no-referrer';
              video.load();
            }
          }, { once: true });
        } else {
          // Fall back to =dv format if no original URL
          video.src = dvUrl;
          video.referrerPolicy = 'no-referrer';
        }
        
        // Wait for video to load, then play
        const onLoadedData = () => {
          console.log('Video loadeddata, readyState:', video.readyState, 'networkState:', video.networkState);
          playVideo();
        };
        const onCanPlay = () => {
          console.log('Video canplay, readyState:', video.readyState);
          playVideo();
        };
        const onLoadedMetadata = () => {
          console.log('Video loadedmetadata, readyState:', video.readyState);
          if (video.readyState >= 1) {
            playVideo();
          }
        };
        const onError = (e) => {
          console.error('Video error:', {
            error: video.error,
            code: video.error?.code,
            message: video.error?.message,
            URL: video.src,
            networkState: video.networkState,
            readyState: video.readyState
          });
          
          // If video fails to load, hide video and show image instead
          // Completely stop and clear the video immediately
          video.pause();
          video.removeAttribute('src');
          video.load();
          video.style.display = 'none';
          video.style.opacity = '0';
          video.style.visibility = 'hidden';
          video.style.pointerEvents = 'none';
          
          // Show image instead
          img.style.opacity = '1';
          img.style.visibility = 'visible';
          img.style.display = 'block';
          
          // Remove all video event listeners to prevent further errors
          video.removeEventListener('loadeddata', onLoadedData);
          video.removeEventListener('canplay', onCanPlay);
          video.removeEventListener('loadedmetadata', onLoadedMetadata);
          video.removeEventListener('error', onError);
          video.removeEventListener('loadstart', onLoadStart);
          video.removeEventListener('progress', onProgress);
        };
        const onLoadStart = () => {
          console.log('Video loadstart, networkState:', video.networkState);
        };
        const onProgress = () => {
          console.log('Video progress, readyState:', video.readyState, 'buffered:', video.buffered.length);
        };
        
        video.addEventListener('loadeddata', onLoadedData, { once: true });
        video.addEventListener('canplay', onCanPlay, { once: true });
        video.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
        video.addEventListener('error', onError, { once: true });
        video.addEventListener('loadstart', onLoadStart, { once: true });
        video.addEventListener('progress', onProgress);
        
        // Load the video
        video.load();
        
        // Fallback: try playing after a delay if video has loaded
        // If video fails to load after timeout, show image instead
        setTimeout(() => {
          if (video.paused && video.style.display !== 'none') {
            if (video.readyState >= 1 && !video.error) {
              console.log('Fallback: attempting to play video, readyState:', video.readyState);
              playVideo();
            } else if (video.error || video.readyState === 0) {
              console.warn('Video not ready after timeout, showing image instead. readyState:', video.readyState, 'networkState:', video.networkState, 'error:', video.error);
              // Video failed, show image
              video.pause();
              video.removeAttribute('src');
              video.load();
              video.style.display = 'none';
              video.style.opacity = '0';
              video.style.visibility = 'hidden';
              img.style.opacity = '1';
              img.style.visibility = 'visible';
              img.style.display = 'block';
            }
          }
        }, 2000);
      });
      
      // Enhanced prefetching: prefetch adjacent images on hover
      let prefetchTimeout = null;
      node.addEventListener('mouseenter', () => {
        // Clear any existing timeout
        if (prefetchTimeout) clearTimeout(prefetchTimeout);
        
        // Prefetch after a short delay to avoid too many requests
        prefetchTimeout = setTimeout(() => {
          const { gallery } = state.selectors;
          if (!gallery) return;
          
          const allCards = Array.from(gallery.querySelectorAll('.gallery-card'));
          const currentIndex = allCards.indexOf(node);
          
          // Prefetch next image
          if (currentIndex + 1 < allCards.length) {
            const nextCard = allCards[currentIndex + 1];
            const nextImg = nextCard?.querySelector('img');
            const nextFull = nextImg?.dataset.full;
            if (nextFull) {
              const link = document.createElement('link');
              link.rel = 'prefetch';
              link.href = nextFull;
              link.as = 'image';
              document.head.appendChild(link);
            }
          }
          
          // Prefetch previous image
          if (currentIndex - 1 >= 0) {
            const prevCard = allCards[currentIndex - 1];
            const prevImg = prevCard?.querySelector('img');
            const prevFull = prevImg?.dataset.full;
            if (prevFull) {
              const link = document.createElement('link');
              link.rel = 'prefetch';
              link.href = prevFull;
              link.as = 'image';
              document.head.appendChild(link);
            }
          }
        }, 300);
      });
      
      // Stop on mouse leave
      node.addEventListener('mouseleave', () => {
        // Clear prefetch timeout
        if (prefetchTimeout) {
          clearTimeout(prefetchTimeout);
          prefetchTimeout = null;
        }
        
        video.pause();
        video.currentTime = 0;
        video.style.display = 'none';
        video.style.opacity = '0';
        video.style.visibility = 'hidden';
        // Show image again
        img.style.opacity = '1';
        img.style.visibility = 'visible';
      });
      
      node.appendChild(video);
      // Add class to card to indicate it has a video
      node.classList.add('has-video');
    }
    
    // Store photo ID for album fade feature
    if (image.id) {
      img.dataset.id = image.id;
      node.dataset.id = image.id; // Also store on card for CSS targeting
    }
    
    if (image.colorGroup) {
      img.dataset.colorGroup = image.colorGroup;
    }
    if (image.dominantColor?.hex) {
      img.dataset.dominantHex = image.dominantColor.hex;
    }
    const albumKey = image.__albumKey || albumKeyFromName(albumName);
    if (albumKey) {
      node.dataset.albumKey = albumKey;
      if (albumName) {
        node.dataset.albumName = albumName;
      }
      img.dataset.albumKey = albumKey;
    }

    fragment.appendChild(node);
  }

  container.replaceChildren(fragment);
  
  // Setup lazy loading for newly added images
  if (state.lazyLoadObserver) {
    setupLazyLoading(container);
  }
}

function resolveAmbientImageUrl(path) {
  if (!path || typeof path !== "string") return "";
  const t = path.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  if (t.startsWith("/")) return new URL(t, window.location.origin).href;
  try {
    return new URL(t, document.baseURI).href;
  } catch {
    return t;
  }
}

/** Build distinct absolute URLs to try. Thumbnail first: many CDNs only have thumbs, and SW may return HTTP 200 + SVG placeholder on 404 for “full”, which would satisfy onload and block fallback. */
function buildAmbientImageUrlCandidates(item, album) {
  const raw = [];
  if (item && typeof item === "object") {
    if (item.thumbnail) raw.push(String(item.thumbnail).trim());
    if (item.full) raw.push(String(item.full).trim());
  }
  if (album && typeof album.albumViewBackground === "string" && album.albumViewBackground.trim()) {
    /* Prefer explicit path first when present (e.g. thumb-only deploys) */
    raw.unshift(album.albumViewBackground.trim());
  }
  const seen = new Set();
  const out = [];
  for (const p of raw) {
    if (!p) continue;
    const a = resolveAmbientImageUrl(p);
    if (a && !seen.has(a)) {
      seen.add(a);
      out.push(a);
    }
    if (p.startsWith("content/")) {
      const root = `${window.location.origin}/${p}`;
      if (!seen.has(root)) {
        seen.add(root);
        out.push(root);
      }
    }
  }
  return out;
}

/** Optional per-album decorative background: `albumViewBackgroundId` points at an item id in the same album. */
function updateAlbumViewDecorativeBackground(photosSection, album) {
  const wrap = document.getElementById("album-view-bg");
  if (!wrap) return;
  const img = wrap.querySelector(".album-view-bg__image");
  if (!img) return;

  photosSection?.classList.remove("has-album-decorative-bg");
  document.body.classList.remove("album-ambient-active");

  img.onload = null;
  img.onerror = null;
  delete img.dataset.ambientAttempt;

  const bgId =
    album && typeof album === "object" && typeof album.albumViewBackgroundId === "string" && album.albumViewBackgroundId.trim()
      ? album.albumViewBackgroundId.trim()
      : null;
  const hasDirectPath =
    album && typeof album === "object" && typeof album.albumViewBackground === "string" && album.albumViewBackground.trim();

  if (!bgId && !hasDirectPath) {
    img.removeAttribute("src");
    img.src = "";
    wrap.hidden = true;
    wrap.setAttribute("aria-hidden", "true");
    return;
  }

  let item = null;
  if (bgId) {
    item =
      Array.isArray(album?.items) && album.items.length
        ? album.items.find((it) => it && it.id === bgId)
        : null;
    if (!item && Array.isArray(state.photosDefault)) {
      item = state.photosDefault.find((p) => p && p.id === bgId) || null;
    }
  }

  const urls = buildAmbientImageUrlCandidates(item, album);
  if (urls.length === 0) {
    img.removeAttribute("src");
    img.src = "";
    wrap.hidden = true;
    wrap.setAttribute("aria-hidden", "true");
    return;
  }

  /*
   * Apply the transparent shell (body.album-ambient-active, etc.) *before* the image loads.
   * If we only add those in img.onload, .page-scroll keeps theme --page-bg and paints a full opaque
   * layer over the fixed #album-view-bg — the user only sees black no matter that the file netloads.
   */
  photosSection?.classList.add("has-album-decorative-bg");
  document.body.classList.add("album-ambient-active");
  wrap.hidden = false;
  wrap.removeAttribute("aria-hidden");

  img.loading = "eager";
  img.decoding = "async";
  if ("fetchPriority" in img) img.fetchPriority = "high";

  let attempt = 0;

  const failAll = () => {
    img.onload = null;
    img.onerror = null;
    img.removeAttribute("src");
    img.src = "";
    wrap.hidden = true;
    wrap.setAttribute("aria-hidden", "true");
    photosSection?.classList.remove("has-album-decorative-bg");
    document.body.classList.remove("album-ambient-active");
  };

  const tryNext = () => {
    if (attempt >= urls.length) {
      failAll();
      return;
    }
    const url = urls[attempt];
    attempt += 1;
    img.onerror = tryNext;
    img.onload = () => {
      img.onerror = null;
      img.onload = null;
    };
    img.removeAttribute("src");
    img.src = url;
  };

  tryNext();
}

export function renderPhotos() {
  if (!hasGalleryElements(state)) return;
  const { gallery, template } = state.selectors;
  const lookup = state.albums.lookup || {};
  if (state.albums.activeKey && !lookup[state.albums.activeKey]) {
    state.albums.activeKey = null;
  }
  const activeKey = state.albums.activeKey;
  
  let baseItems;
  if (activeKey && lookup[activeKey]) {
    // Show album photos when an album is selected
    baseItems = lookup[activeKey].items;
  } else {
    // Main gallery: filter out photos that are in any album
    const photosInAlbums = new Set();
    Object.values(lookup).forEach(album => {
      if (album.items && Array.isArray(album.items)) {
        album.items.forEach(item => {
          if (item.id) photosInAlbums.add(item.id);
        });
      }
    });
    baseItems = state.photosDefault.filter(photo => !photosInAlbums.has(photo.id));
  }
  
  const sorted = sortCollectionByMode(baseItems, state.sortModes.photos);
  if (gallery) {
    const activeAlbumName = activeKey && lookup[activeKey] ? lookup[activeKey].name : "";
    gallery.classList.toggle("is-album-mode", Boolean(activeKey));
    if (activeAlbumName) {
      gallery.dataset.activeAlbum = activeAlbumName;
    } else {
      delete gallery.dataset.activeAlbum;
    }
    
    // Hide gallery if no album is active (show albums instead)
    const photosSection = gallery.parentElement;
    if (!activeKey) {
      gallery.classList.remove("is-visible", "album-drop-in");
      gallery.style.display = "none";
      if (photosSection) {
        photosSection.classList.remove("album-view-active");
        updateAlbumViewDecorativeBackground(photosSection, null);
      }
      const { albumsSection, albumViewHeader } = state.selectors;
      if (albumsSection) {
        albumsSection.hidden = false;
        albumsSection.classList.remove("is-fading-out");
      }
      if (albumViewHeader) {
        albumViewHeader.hidden = true;
        albumViewHeader.setAttribute("aria-hidden", "true");
      }
    } else {
      if (photosSection) {
        photosSection.classList.add("album-view-active");
        updateAlbumViewDecorativeBackground(photosSection, lookup[activeKey] || null);
      }
      const { albumViewHeader } = state.selectors;
      if (albumViewHeader) {
        const album = lookup[activeKey];
        const titleEl = albumViewHeader.querySelector(".album-view-title");
        const descEl = albumViewHeader.querySelector(".album-view-description");
        if (titleEl) {
          titleEl.textContent = album?.name || "";
          titleEl.style.color = album?.titleColor || "";
        }
        if (descEl) {
          descEl.textContent = album?.description || "";
          descEl.hidden = false;
        }
        albumViewHeader.hidden = false;
        albumViewHeader.removeAttribute("aria-hidden");
      }
    }
  }
  renderCollection(sorted, {
    container: gallery,
    template,
  });

  // Album view: brick layout (odd/even row counts, each row centered)
  if (gallery) {
    gallery.classList.remove("is-carousel", "adaptive-grid");
    delete gallery.dataset.photoCount;
    delete gallery.dataset.photosPerRow;
    delete gallery.dataset.numRows;
    gallery.style.gridTemplateColumns = "";

    if (activeKey && gallery.classList.contains("is-album-mode")) {
      const cards = Array.from(gallery.querySelectorAll(".gallery-card"));
      if (cards.length > 0) {
        const n = cards.length;
        const rowCounts = [];

        for (let remaining = n; remaining > 0; remaining -= 5) {
          rowCounts.push(Math.min(5, remaining));
        }

        const grid = document.createElement("div");
        grid.className = "album-brick-grid";
        if (rowCounts.length === 2) grid.classList.add("album-brick-grid-two-rows");
        if (rowCounts.length > 2) grid.classList.add("album-brick-grid-many-rows");
        let from = 0;
        rowCounts.forEach((count) => {
          const row = document.createElement("div");
          row.className = "album-brick-row";
          row.style.setProperty("--row-count", String(count));
          const slice = cards.slice(from, from + count);
          slice.forEach((card) => row.appendChild(card));
          from += count;
          grid.appendChild(row);
        });
        gallery.replaceChildren(grid);
      }
      requestAnimationFrame(() => {
        const cards = gallery.querySelectorAll(".gallery-card");
        cards.forEach((card, i) => {
          card.style.animationDelay = `${i * 0.04}s`;
        });
      });
    }
  }
}

export function renderDigitalArt() {
  if (!hasDigitalArtElements(state)) return;
  const { digitalGallery, digitalTemplate, digitalError } = state.selectors;
  if (!state.digitalArt.defaultItems.length) {
    if (digitalGallery) digitalGallery.replaceChildren();
    if (digitalError) {
      digitalError.hidden = false;
      digitalError.textContent = "Digital art uploads coming soon.";
    }
    return;
  }
  const sorted = sortCollectionByMode(state.digitalArt.defaultItems, state.sortModes.digital);
  state.digitalArt.items = sorted;
  renderCollection(sorted, { container: digitalGallery, template: digitalTemplate });
  if (digitalError) {
    digitalError.hidden = true;
    digitalError.textContent = "";
  }
}
