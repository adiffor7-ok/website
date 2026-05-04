// Lightbox functionality
import { state, DEFAULT_LIGHTBOX_BG, DEFAULT_LIGHTBOX_RGB, DEFAULT_LIGHTBOX_SHADOW, METADATA_LABELS } from './state.js';
import { hexToRgb, mixColors, parseDatasetJSON, buildDetailsList, buildMetadataList } from './utils.js';
import { trapFocus, restoreFocus, removeFocusTrap } from './focus-management.js';

// Helper functions
function orientationFromDimensions(width, height) {
  if (!(width > 0) || !(height > 0)) return null;
  const aspect = width / height;
  if (Math.abs(aspect - 1) <= 0.05) return "square";
  return aspect > 1 ? "landscape" : "portrait";
}

function applyLightboxLayout(orientation) {
  const { lightboxContent } = state.selectors;
  if (!lightboxContent) return;
  lightboxContent.classList.remove("layout-landscape", "layout-portrait", "layout-square");
  if (!orientation) return;
  const layout =
    orientation === "landscape"
      ? "layout-landscape"
      : orientation === "square"
      ? "layout-square"
      : "layout-portrait";
  lightboxContent.classList.add(layout);
}

export function setupLightbox(openAlbumPhotoViewer) {
  const { gallery, digitalGallery, lightbox, lightboxImage, lightboxCaption, lightboxContent } = state.selectors;
  if (!lightbox || !lightboxImage || !lightboxCaption) return;
  const lightboxVideo = document.getElementById('lightbox-video');
  const captionTitle = lightboxCaption.querySelector(".caption-title");
  const captionText = lightboxCaption.querySelector(".caption-text");
  const containers = [gallery, digitalGallery].filter(Boolean);
  if (!containers.length) return;

  const updateLayoutFromImage = () => {
    const orientation = orientationFromDimensions(lightboxImage.naturalWidth, lightboxImage.naturalHeight);
    applyLightboxLayout(orientation);
  };

  const openFromImage = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLImageElement)) return;
    const { gallery, digitalGallery } = state.selectors;
    const getCollectionImages = (container, sourceItems) => {
      if (!container || !Array.isArray(sourceItems) || !sourceItems.length) {
        return [];
      }

      const cards = Array.from(container.querySelectorAll(".gallery-card"));
      const itemsById = new Map(
        sourceItems
          .filter((item) => item && typeof item.id === "string")
          .map((item) => [item.id, item])
      );

      const visibleItems = cards
        .map((galleryCard) => {
          const cardId = galleryCard.dataset.id || galleryCard.querySelector("img")?.dataset.id || null;
          return cardId ? itemsById.get(cardId) || null : null;
        })
        .filter(Boolean);

      return visibleItems.length ? visibleItems : sourceItems;
    };

    // In album mode, use custom full-screen viewer instead of lightbox
    if (gallery && gallery.classList.contains("is-album-mode")) {
      if (openAlbumPhotoViewer) {
        openAlbumPhotoViewer(target, event);
      }
      return;
    }
    const full = target.dataset.full;
    if (!full) return;
    
    // Determine which collection we're in and get all images
    const card = target.closest('.gallery-card');
    let currentImages = [];
    let currentIndex = -1;
    
    // Check if we're in digital art gallery or main photos gallery
    if (digitalGallery && digitalGallery.contains(card)) {
      currentImages = getCollectionImages(digitalGallery, state.digitalArt.items || []);
    } else if (gallery && gallery.contains(card)) {
      currentImages = getCollectionImages(gallery, state.images || []);
    }
    
    // Find current image index
    const imageId = card?.dataset?.id || target.dataset.id || null;
    if (imageId && currentImages.length > 0) {
      currentIndex = currentImages.findIndex(img => img && img.id === imageId);
    }
    
    // If not found by ID, try to find by matching the clicked image
    if (currentIndex === -1 && currentImages.length > 0) {
      // Get all gallery cards in the current collection
      const container = digitalGallery && digitalGallery.contains(card) ? digitalGallery : gallery;
      const allCards = Array.from(container.querySelectorAll('.gallery-card'));
      currentIndex = allCards.indexOf(card);
    }
    
    // Store current state for navigation
    state.lightbox.currentIndex = currentIndex >= 0 ? currentIndex : 0;
    state.lightbox.images = currentImages;
    state.lightbox.previousFocus = document.activeElement;
    
    const mediaType = target.dataset.mediaType || 'image';
    const isVideo = mediaType === 'video' || mediaType === 'video/mp4' || full.includes('.mp4') || full.includes('video');
    
    if (isVideo && lightboxVideo) {
      // Show video, hide image
      lightboxImage.style.display = 'none';
      lightboxVideo.style.display = 'block';
      
      // Google Photos videos need '=dv' parameter instead of size parameters
      let videoUrl = full;
      if (videoUrl.includes('googleusercontent.com')) {
        // For Google Photos videos, use proxy server to avoid CORS issues
        const baseUrl = videoUrl.split('=')[0];
        const dvUrl = baseUrl + '=dv';
        videoUrl = `/api/proxy-video?url=${encodeURIComponent(dvUrl)}`;
      }
      
      lightboxVideo.src = videoUrl;
      lightboxVideo.controls = true;
      lightboxVideo.type = 'video/mp4'; // Set MIME type
      lightboxVideo.muted = true;
      lightboxVideo.autoplay = true;
      lightboxVideo.playsInline = true;
      lightboxVideo.preload = 'auto';
      lightboxVideo.setAttribute('playsinline', 'true');
      lightboxVideo.setAttribute('webkit-playsinline', 'true');
      lightboxVideo.style.touchAction = 'manipulation';
      
      // Ensure video plays when ready
      if (lightboxVideo.readyState >= 2) {
        lightboxVideo.play().catch(e => console.warn('Lightbox video play failed:', e));
      } else {
        lightboxVideo.addEventListener('loadeddata', () => {
          lightboxVideo.play().catch(e => console.warn('Lightbox video play failed:', e));
        }, { once: true });
      }
      
      // Use =dv format only (avoid rate limiting by trying multiple formats)
      // This format worked before, so we'll stick with it
      lightboxVideo.addEventListener('error', function onVideoError() {
        console.error('Video failed to load:', {
          error: lightboxVideo.error,
          code: lightboxVideo.error?.code,
          message: lightboxVideo.error?.message,
          URL: lightboxVideo.src,
          networkState: lightboxVideo.networkState,
          readyState: lightboxVideo.readyState
        });
      }, { once: true });
    } else {
      // Show image, hide video
      lightboxImage.style.display = 'block';
      if (lightboxVideo) {
        lightboxVideo.style.display = 'none';
        lightboxVideo.src = '';
        lightboxVideo.pause();
      }
      lightboxImage.src = full;
      lightboxImage.alt = target.alt;
      
      // Add error handling for lightbox image
      const handleLightboxImageError = () => {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'lightbox-error';
        errorDiv.innerHTML = `
          <div class="error-icon" aria-hidden="true">⚠️</div>
          <p class="error-message">Failed to load image</p>
          <button class="error-retry-button" type="button" aria-label="Retry loading image">Retry</button>
        `;
        
        const retryButton = errorDiv.querySelector('.error-retry-button');
        retryButton.addEventListener('click', () => {
          errorDiv.remove();
          lightboxImage.src = full;
          lightboxImage.referrerPolicy = 'no-referrer';
        });
        
        if (lightboxContent) {
          lightboxContent.appendChild(errorDiv);
        }
      };
      
      lightboxImage.addEventListener('error', handleLightboxImageError, { once: true });
      
      // Clear error on successful load
      lightboxImage.addEventListener('load', () => {
        if (lightboxContent) {
          const errorDiv = lightboxContent.querySelector('.lightbox-error');
          if (errorDiv) errorDiv.remove();
        }
      }, { once: true });
    }
    // Don't set crossorigin - img tags work fine without it for simple display

    const dominantHex = target.dataset.dominantHex;
    const dominantColor = hexToRgb(dominantHex);
    lightbox.style.background = mixColors(DEFAULT_LIGHTBOX_RGB, dominantColor, 0.32, 0.98);
    lightbox.style.boxShadow = "0 40px 95px rgba(0, 0, 0, 0.2)";

    const caption = target.dataset.caption || target.alt || "Untitled photo";
    const description = target.dataset.description || "";
    const linksData = parseDatasetJSON(target.dataset.links);
    const detailsData = parseDatasetJSON(target.dataset.details);
    // Create a copy of metadata to avoid mutating the original
    const rawMetadata = parseDatasetJSON(target.dataset.metadata);
    const metadataData = rawMetadata && typeof rawMetadata === "object" ? { ...rawMetadata } : null;

    if (captionTitle) {
      captionTitle.textContent = caption || "Untitled photo";
      // Ensure caption title is always visible
      captionTitle.hidden = false;
      captionTitle.style.display = '';
      captionTitle.style.visibility = 'visible';
      captionTitle.style.opacity = '1';
    }
    // Determine orientation from the full image, not the thumbnail
    let initialOrientation = target.dataset.orientation;
    if (!initialOrientation || initialOrientation === "landscape") {
      // If orientation is not set or defaulted to landscape, recalculate from actual image
      // Wait for the full image to load to get accurate dimensions
      if (lightboxImage.complete && lightboxImage.naturalWidth > 0 && lightboxImage.naturalHeight > 0) {
        initialOrientation = orientationFromDimensions(lightboxImage.naturalWidth, lightboxImage.naturalHeight);
      } else if (target.naturalWidth > 0 && target.naturalHeight > 0) {
        // Fallback to thumbnail dimensions if full image not loaded yet
        initialOrientation = orientationFromDimensions(target.naturalWidth, target.naturalHeight);
      }
    }
    const isLandscape = initialOrientation === "landscape";
    const isPortrait = initialOrientation === "portrait";
    const isSquare = initialOrientation === "square";
    const useColumns = isLandscape;

    if (captionText) {
      captionText.classList.toggle("caption-text--landscape", useColumns);
      captionText.classList.toggle("caption-text--portrait", isPortrait || isSquare);
      captionText.replaceChildren();
      let layout = null;
      let detailsNode = buildDetailsList(detailsData);
      let locationValue = null;
      if (metadataData && typeof metadataData === "object" && metadataData.location) {
        const locationRaw = metadataData.location;
        if (typeof locationRaw === "string" && locationRaw.trim()) {
          locationValue = locationRaw.trim();
        }
      }
      if (locationValue && !detailsNode) {
        detailsNode = document.createElement("dl");
        detailsNode.className = "metadata-list details-list";
      }
      if (locationValue && detailsNode) {
        const dt = document.createElement("dt");
        dt.textContent = METADATA_LABELS.location || "Location";
        const dd = document.createElement("dd");
        dd.textContent = locationValue;
        detailsNode.appendChild(dt);
        detailsNode.appendChild(dd);
      }
      if (useColumns) {
        const detailsContainer = document.createElement("div");
        detailsContainer.className = "caption-details-container";
        const textContainer = document.createElement("div");
        textContainer.className = "caption-text-container";

        if (detailsNode) {
          detailsNode.classList.add("caption-details");
          detailsContainer.appendChild(detailsNode);
        }
        if (captionTitle) {
          captionTitle.classList.add("caption-title--inline");
          captionTitle.hidden = false;
          captionTitle.style.display = '';
          textContainer.appendChild(captionTitle);
        }
        if (description && description.trim()) {
          const descriptionBlock = document.createElement("div");
          descriptionBlock.className = "caption-description-block";
          const desc = document.createElement("p");
          desc.className = "caption-description";
          desc.textContent = description;
          descriptionBlock.appendChild(desc);
          textContainer.appendChild(descriptionBlock);
        }
        if (detailsContainer.childElementCount) {
          captionText.appendChild(detailsContainer);
        }
        // Always append textContainer if it has captionTitle (even if empty, caption should show)
        if (textContainer.childElementCount > 0 || captionTitle) {
          captionText.appendChild(textContainer);
        }
      } else {
        if (captionTitle) {
          captionTitle.classList.remove("caption-title--inline");
          captionTitle.hidden = false;
          captionTitle.style.display = '';
          const parentCaption = lightboxCaption;
          if (parentCaption && captionTitle.parentElement !== parentCaption) {
            parentCaption.insertBefore(captionTitle, captionText);
          }
        }
        if (detailsNode) {
          detailsNode.classList.add("caption-details");
          captionText.appendChild(detailsNode);
        }
        if (description && description.trim()) {
          const descriptionBlock = document.createElement("div");
          descriptionBlock.className = "caption-description-block";
          const desc = document.createElement("p");
          desc.className = "caption-description";
          desc.textContent = description;
          descriptionBlock.appendChild(desc);
          
          // Add links if available
          if (linksData && Array.isArray(linksData) && linksData.length > 0) {
            const linksContainer = document.createElement("div");
            linksContainer.className = "caption-links";
            linksData.forEach(link => {
              if (link && link.text && link.url) {
                const linkElement = document.createElement("a");
                linkElement.href = link.url;
                linkElement.textContent = link.text;
                linkElement.target = "_blank";
                linkElement.rel = "noopener noreferrer";
                linkElement.className = "caption-link";
                linksContainer.appendChild(linkElement);
              }
            });
            descriptionBlock.appendChild(linksContainer);
          }
          
          captionText.appendChild(descriptionBlock);
        }
      }
      // Build and append metadata list (filename, type, etc.)
      const metadataNode = buildMetadataList(metadataData);
      if (metadataNode) {
        captionText.appendChild(metadataNode);
      }
      // Don't hide captionText if it has content (details, description, or metadata)
      // or if captionTitle exists (it might be in parent for portrait/square)
      const hasContent = captionText.childElementCount > 0;
      const hasCaptionTitle = captionTitle && captionTitle.textContent.trim();
      captionText.hidden = !hasContent && !hasCaptionTitle;
    }

    if (!isVideo) {
      // Update orientation from actual loaded image dimensions
      if (lightboxImage.complete && lightboxImage.naturalWidth > 0 && lightboxImage.naturalHeight > 0) {
        const actualOrientation = orientationFromDimensions(lightboxImage.naturalWidth, lightboxImage.naturalHeight);
        if (actualOrientation && actualOrientation !== initialOrientation) {
          initialOrientation = actualOrientation;
        }
      }
      applyLightboxLayout(initialOrientation);
      if (lightboxImage.complete) {
        updateLayoutFromImage();
      } else {
        lightboxImage.addEventListener("load", () => {
          const actualOrientation = orientationFromDimensions(lightboxImage.naturalWidth, lightboxImage.naturalHeight);
          if (actualOrientation) {
            applyLightboxLayout(actualOrientation);
          }
          updateLayoutFromImage();
        }, { once: true });
      }
    } else {
      // For videos, use landscape layout by default
      applyLightboxLayout("landscape");
    }
    
    // Trap focus in lightbox
    trapFocus(lightbox, state.lightbox.previousFocus);
    
    // Set up keyboard navigation
    const handleKeyboard = (e) => {
      // Only handle if lightbox is open
      if (!lightbox.open) return;
      
      if (e.key === 'Escape' || e.keyCode === 27) {
        closeLightbox();
        return;
      }
      
      // Arrow key navigation
      if (e.key === 'ArrowLeft' || e.keyCode === 37) {
        e.preventDefault();
        navigateLightbox(-1);
      } else if (e.key === 'ArrowRight' || e.keyCode === 39) {
        e.preventDefault();
        navigateLightbox(1);
      }
    };
    
    // Store handler for cleanup
    state.lightbox.keyboardHandler = handleKeyboard;
    window.addEventListener('keydown', handleKeyboard);
    
    // Set up mobile touch gestures for swipe navigation
    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let touchEndY = 0;
    const minSwipeDistance = 50;
    
    const handleTouchStart = (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    };
    
    const handleTouchMove = (e) => {
      touchEndX = e.touches[0].clientX;
      touchEndY = e.touches[0].clientY;
    };
    
    const handleTouchEnd = () => {
      if (!touchStartX || !touchEndX) return;
      
      const deltaX = touchStartX - touchEndX;
      const deltaY = touchStartY - touchEndY;
      const absDeltaX = Math.abs(deltaX);
      const absDeltaY = Math.abs(deltaY);
      
      // Only handle horizontal swipes (more horizontal than vertical)
      if (absDeltaX > absDeltaY && absDeltaX > minSwipeDistance) {
        if (deltaX > 0) {
          // Swipe left - next image
          navigateLightbox(1);
        } else {
          // Swipe right - previous image
          navigateLightbox(-1);
        }
      }
      
      // Reset
      touchStartX = 0;
      touchStartY = 0;
      touchEndX = 0;
      touchEndY = 0;
    };
    
    lightbox.addEventListener('touchstart', handleTouchStart, { passive: true });
    lightbox.addEventListener('touchmove', handleTouchMove, { passive: true });
    lightbox.addEventListener('touchend', handleTouchEnd, { passive: true });
    
    // Prefetch next/previous images when lightbox opens
    const prefetchAdjacentImages = () => {
      const { images, currentIndex } = state.lightbox;
      if (!images || images.length === 0) return;
      
      // Prefetch next
      if (currentIndex + 1 < images.length && images[currentIndex + 1]?.full) {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = images[currentIndex + 1].full;
        link.as = 'image';
        document.head.appendChild(link);
      }
      // Prefetch previous
      if (currentIndex - 1 >= 0 && images[currentIndex - 1]?.full) {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = images[currentIndex - 1].full;
        link.as = 'image';
        document.head.appendChild(link);
      }
    };
    
    // Prefetch after a short delay
    setTimeout(prefetchAdjacentImages, 300);
    
    lightbox.showModal();
  };
  
  // Navigate to next/previous image in lightbox
  const navigateLightbox = (direction) => {
    const { images, currentIndex } = state.lightbox;
    if (!images || images.length === 0) return;
    
    const newIndex = currentIndex + direction;
    if (newIndex < 0 || newIndex >= images.length) return;
    
    // Update index immediately
    state.lightbox.currentIndex = newIndex;
    const image = images[newIndex];
    if (!image) return;
    
    // Prefetch adjacent images for smooth navigation
    if (newIndex + 1 < images.length && images[newIndex + 1]?.full) {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = images[newIndex + 1].full;
      link.as = 'image';
      document.head.appendChild(link);
    }
    if (newIndex - 1 >= 0 && images[newIndex - 1]?.full) {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = images[newIndex - 1].full;
      link.as = 'image';
      document.head.appendChild(link);
    }
    
    // Get image data directly from the image object
    const full = image.full || image.thumbnail || '';
    const caption = image.caption || image.alt || "Untitled photo";
    const description = image.description || "";
    const mediaType = image.metadata?.type || image.type || 'image';
    const isVideo = mediaType === 'video' || mediaType === 'video/mp4' || full.includes('.mp4') || full.includes('video');
    
    if (!full) return;
    
    if (isVideo && lightboxVideo) {
      // Stop any currently playing video
      lightboxVideo.pause();
      lightboxVideo.currentTime = 0;
      
      lightboxImage.style.display = 'none';
      lightboxVideo.style.display = 'block';
      
      let videoUrl = full;
      if (videoUrl.includes('googleusercontent.com')) {
        // For Google Photos videos, use proxy server to avoid CORS issues
        const baseUrl = videoUrl.split('=')[0];
        const dvUrl = baseUrl + '=dv';
        videoUrl = `/api/proxy-video?url=${encodeURIComponent(dvUrl)}`;
      }
      
      lightboxVideo.src = videoUrl;
      lightboxVideo.controls = true;
      lightboxVideo.type = 'video/mp4';
      lightboxVideo.muted = true;
      lightboxVideo.autoplay = true;
      lightboxVideo.playsInline = true;
      lightboxVideo.preload = 'auto';
      applyLightboxLayout("landscape");
      
      // Ensure video plays when ready
      const playVideo = () => {
        lightboxVideo.play().catch(e => console.warn('Lightbox video play failed:', e));
      };
      
      if (lightboxVideo.readyState >= 2) {
        // Video already has enough data, play immediately
        playVideo();
      } else {
        // Wait for video to load data before playing
        lightboxVideo.addEventListener('loadeddata', playVideo, { once: true });
        // Also try canplay as a fallback
        lightboxVideo.addEventListener('canplay', playVideo, { once: true });
      }
    } else {
      lightboxImage.style.display = 'block';
      if (lightboxVideo) {
        lightboxVideo.style.display = 'none';
        lightboxVideo.src = '';
        lightboxVideo.pause();
      }
      
      // Clear any existing errors
      if (lightboxContent) {
        const existingError = lightboxContent.querySelector('.lightbox-error');
        if (existingError) existingError.remove();
      }
      
      lightboxImage.src = full;
      lightboxImage.alt = caption;
      
      // Add error handling for navigation
      const handleNavImageError = () => {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'lightbox-error';
        errorDiv.innerHTML = `
          <div class="error-icon" aria-hidden="true">⚠️</div>
          <p class="error-message">Failed to load image</p>
          <button class="error-retry-button" type="button" aria-label="Retry loading image">Retry</button>
        `;
        
        const retryButton = errorDiv.querySelector('.error-retry-button');
        retryButton.addEventListener('click', () => {
          errorDiv.remove();
          lightboxImage.src = full;
          lightboxImage.referrerPolicy = 'no-referrer';
        });
        
        if (lightboxContent) {
          lightboxContent.appendChild(errorDiv);
        }
      };
      
      lightboxImage.addEventListener('error', handleNavImageError, { once: true });
      lightboxImage.addEventListener('load', () => {
        if (lightboxContent) {
          const errorDiv = lightboxContent.querySelector('.lightbox-error');
          if (errorDiv) errorDiv.remove();
        }
      }, { once: true });
      
      // Update layout
      const initialOrientation = image.orientation || 'landscape';
      applyLightboxLayout(initialOrientation);
      if (lightboxImage.complete) {
        updateLayoutFromImage();
      } else {
        lightboxImage.addEventListener("load", () => {
          const actualOrientation = orientationFromDimensions(lightboxImage.naturalWidth, lightboxImage.naturalHeight);
          if (actualOrientation) {
            applyLightboxLayout(actualOrientation);
          }
          updateLayoutFromImage();
        }, { once: true });
      }
    }
    
    // Update background color
    const dominantColor = hexToRgb(image.dominantColor?.hex || null);
    lightbox.style.background = mixColors(DEFAULT_LIGHTBOX_RGB, dominantColor, 0.32, 0.98);
    lightbox.style.boxShadow = "0 40px 95px rgba(0, 0, 0, 0.2)";
    
    // Update caption
    if (captionTitle) {
      captionTitle.textContent = caption || "Untitled photo";
      captionTitle.hidden = false;
      captionTitle.style.display = '';
      captionTitle.style.visibility = 'visible';
      captionTitle.style.opacity = '1';
    }
    
    if (captionText) {
      captionText.replaceChildren();
      if (description && description.trim()) {
        const desc = document.createElement("p");
        desc.className = "caption-description";
        desc.textContent = description;
        captionText.appendChild(desc);
      }
    }
  };

  containers.forEach((container) => container.addEventListener("click", openFromImage));

  const closeLightbox = () => {
    // Remove keyboard handler
    if (state.lightbox.keyboardHandler) {
      window.removeEventListener('keydown', state.lightbox.keyboardHandler);
      state.lightbox.keyboardHandler = null;
    }
    
    // Remove focus trap
    removeFocusTrap(lightbox);
    
    // Restore previous focus
    restoreFocus(state.lightbox.previousFocus);
    state.lightbox.previousFocus = null;
    state.lightbox.currentIndex = -1;
    state.lightbox.images = [];
    
    lightbox.close();
    lightboxImage.src = "";
    lightboxImage.alt = "";
    if (lightboxVideo) {
      lightboxVideo.src = "";
      lightboxVideo.pause();
      lightboxVideo.style.display = 'none';
    }
    lightboxImage.style.display = 'block';
    lightbox.style.background = DEFAULT_LIGHTBOX_BG;
    lightbox.style.boxShadow = DEFAULT_LIGHTBOX_SHADOW;
    applyLightboxLayout(null);
    if (captionTitle) {
      captionTitle.textContent = "";
      captionTitle.classList.remove("caption-title--inline");
      const parentCaption = lightboxCaption;
      if (parentCaption && captionTitle.parentElement !== parentCaption) {
        parentCaption.insertBefore(captionTitle, captionText);
      }
    }
    if (captionText) {
      captionText.replaceChildren();
      captionText.hidden = false;
    }
  };

  lightbox.addEventListener("cancel", closeLightbox);
  lightbox.addEventListener("click", (event) => {
    if (!lightboxContent) {
      closeLightbox();
      return;
    }
    if (!lightboxContent.contains(event.target)) {
      closeLightbox();
    }
  });
  
  // Prefetch next/previous images on hover
  let prefetchTimeout = null;
  const prefetchImages = () => {
    const { images, currentIndex } = state.lightbox;
    if (!images || images.length === 0) return;
    
    // Prefetch next image
    if (currentIndex + 1 < images.length) {
      const nextImage = images[currentIndex + 1];
      if (nextImage && nextImage.full) {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = nextImage.full;
        link.as = 'image';
        document.head.appendChild(link);
      }
    }
    
    // Prefetch previous image
    if (currentIndex - 1 >= 0) {
      const prevImage = images[currentIndex - 1];
      if (prevImage && prevImage.full) {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = prevImage.full;
        link.as = 'image';
        document.head.appendChild(link);
      }
    }
  };
  
  // Prefetch on lightbox open with slight delay
  const originalShowModal = lightbox.showModal.bind(lightbox);
  lightbox.showModal = function() {
    originalShowModal();
    if (prefetchTimeout) clearTimeout(prefetchTimeout);
    prefetchTimeout = setTimeout(prefetchImages, 500);
  };
  
  // Also prefetch on mouse move in lightbox
  lightbox.addEventListener('mousemove', () => {
    if (prefetchTimeout) clearTimeout(prefetchTimeout);
    prefetchTimeout = setTimeout(prefetchImages, 300);
  });
}
