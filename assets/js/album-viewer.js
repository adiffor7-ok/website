// Album viewer functionality
import { state } from './state.js';
import { isVideoItem } from './image-handling.js';
import { parseDatasetJSON, resolveAlbumViewerUrl } from './utils.js';
import { trapFocus, restoreFocus, removeFocusTrap } from './focus-management.js';
import { initImageZoom } from './image-zoom.js';

function repositionViewer() {
  const { albumPhotoViewer, albumViewerContainer, albumViewerImage, albumViewerImage2, albumViewerVideo, albumViewerCaption } = state.selectors;
  if (!albumPhotoViewer || !albumViewerContainer) return;

  const showCaptionPanel = state.albumViewer.showCaption;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const captionWidth = viewportWidth * 0.382;
  const gap = 20;

  const isShowingVideo = albumViewerVideo && albumViewerVideo.style.display !== 'none' && albumViewerVideo.videoWidth > 0;
  let mediaEl, mediaWidth, mediaHeight;
  if (isShowingVideo) {
    mediaEl = albumViewerVideo;
    mediaWidth = albumViewerVideo.videoWidth;
    mediaHeight = albumViewerVideo.videoHeight;
  } else if (albumViewerImage && albumViewerImage.naturalWidth > 0) {
    mediaEl = albumViewerImage;
    mediaWidth = albumViewerImage.naturalWidth;
    mediaHeight = albumViewerImage.naturalHeight;
  } else {
    return;
  }

  const isPortrait = mediaHeight > mediaWidth;
  albumViewerContainer.classList.toggle('layout-portrait', isPortrait);

  // Golden-ratio max dimensions (0.618 * 1.2)
  const maxWidth = viewportWidth * 0.7416;
  const maxHeight = viewportHeight * 0.7416;
  let finalWidth = mediaWidth * Math.min(maxWidth / mediaWidth, maxHeight / mediaHeight);
  let finalHeight = mediaHeight * Math.min(maxWidth / mediaWidth, maxHeight / mediaHeight);

  if (showCaptionPanel) {
    const maxContainerWidth = viewportWidth * 0.96;
    if (finalWidth + gap + captionWidth > maxContainerWidth) {
      const sf = (maxContainerWidth - gap - captionWidth) / finalWidth;
      finalWidth *= sf;
      finalHeight *= sf;
    }
  } else {
    const fullScale = Math.min((viewportWidth * 0.96) / mediaWidth, (viewportHeight * 0.96) / mediaHeight);
    finalWidth = mediaWidth * fullScale;
    finalHeight = mediaHeight * fullScale;
  }

  const finalX = showCaptionPanel
    ? (viewportWidth - (finalWidth + gap + captionWidth)) / 2
    : (viewportWidth - finalWidth) / 2;
  const finalY = (viewportHeight - finalHeight) / 2;
  const captionX = finalX + finalWidth + gap;

  mediaEl.style.position = 'fixed';
  mediaEl.style.left = `${finalX}px`;
  mediaEl.style.top = `${finalY}px`;
  mediaEl.style.width = `${finalWidth}px`;
  mediaEl.style.height = `${finalHeight}px`;
  mediaEl.style.maxWidth = `${showCaptionPanel ? maxWidth : viewportWidth * 0.96}px`;
  mediaEl.style.maxHeight = `${showCaptionPanel ? maxHeight : viewportHeight * 0.96}px`;

  if (!isShowingVideo && albumViewerImage2 && albumViewerImage2.src) {
    albumViewerImage2.style.position = 'fixed';
    albumViewerImage2.style.left = `${finalX}px`;
    albumViewerImage2.style.top = `${finalY}px`;
    albumViewerImage2.style.width = `${finalWidth}px`;
    albumViewerImage2.style.height = `${finalHeight}px`;
    albumViewerImage2.style.maxWidth = `${showCaptionPanel ? maxWidth : viewportWidth * 0.96}px`;
    albumViewerImage2.style.maxHeight = `${showCaptionPanel ? maxHeight : viewportHeight * 0.96}px`;
  }

  if (albumViewerCaption) {
    albumViewerCaption.style.position = 'fixed';
    albumViewerCaption.style.left = `${captionX}px`;
    albumViewerCaption.style.top = '50%';
    albumViewerCaption.style.transform = 'translateY(-50%)';
    albumViewerCaption.style.width = `${captionWidth}px`;
  }
}

export function openAlbumPhotoViewer(imgElement, clickEvent, options) {
  const { albumPhotoViewer, albumViewerContainer, albumViewerImage, albumViewerImage2, albumViewerVideo, albumViewerCaption, gallery } = state.selectors;
  if (!albumPhotoViewer || !albumViewerImage || !albumViewerContainer) return;

  if (state.albumViewer.clearImagesTimeoutId != null) {
    clearTimeout(state.albumViewer.clearImagesTimeoutId);
    state.albumViewer.clearImagesTimeoutId = null;
  }

  const full = imgElement.dataset.full;
  const caption = imgElement.dataset.caption || imgElement.alt || "";
  const description = imgElement.dataset.description || "";
  const linksData = parseDatasetJSON(imgElement.dataset.links);
  const currentPhotoId = imgElement.dataset.id || imgElement.closest('.gallery-card')?.dataset?.id || null;
  
  // Check if item is a video using comprehensive detection
  // First check dataset, then check the actual image data
  let isVideo = false;
  const mediaTypeFromDataset = imgElement.dataset.mediaType;
  if (mediaTypeFromDataset === 'video') {
    isVideo = true;
  } else {
    // Get image data from the card or gallery to check properly
    const card = imgElement.closest('.gallery-card');
    const imageId = card?.dataset?.id || imgElement.dataset.id;
    const activeKey = state.albums.activeKey;
    
    if (activeKey && state.albums.lookup && state.albums.lookup[activeKey]) {
      const album = state.albums.lookup[activeKey];
      const albumImages = album.items || [];
      const imageData = imageId ? albumImages.find(img => img?.id === imageId) : null;
      
      if (imageData) {
        // Pass album name for better video detection
        const albumName = album.name || '';
        isVideo = isVideoItem(imageData, full, albumName);
      } else {
        // Fallback: check URL directly
        isVideo = isVideoItem(null, full);
      }
    } else {
      // Fallback: check URL directly
      isVideo = isVideoItem(null, full);
    }
  }
  
  if (!full) return;
  
  // Get current album images for navigation
  let albumImages = [];
  let currentIndex = -1;
  const activeKey = state.albums.activeKey;
  
  if (activeKey && state.albums.lookup && state.albums.lookup[activeKey]) {
    const album = state.albums.lookup[activeKey];
    albumImages = album.items || [];
    
    // Find current image index
    if (currentPhotoId && albumImages.length > 0) {
      currentIndex = albumImages.findIndex(item => item && item.id === currentPhotoId);
    }
    
    // If not found by ID, try to find by matching the clicked image
    if (currentIndex === -1 && gallery && albumImages.length > 0) {
      const allCards = Array.from(gallery.querySelectorAll('.gallery-card'));
      const card = imgElement.closest('.gallery-card');
      currentIndex = allCards.indexOf(card);
    }
  }
  
  // Store current state for navigation
  state.albumViewer.currentIndex = currentIndex >= 0 ? currentIndex : 0;
  state.albumViewer.images = albumImages;
  state.albumViewer.previousFocus = document.activeElement;

  const thumbnailRect = imgElement.getBoundingClientRect();
  const thumbnailCenterX = thumbnailRect.left + thumbnailRect.width / 2;
  const thumbnailCenterY = thumbnailRect.top + thumbnailRect.height / 2;
  const thumbnailWidth = thumbnailRect.width;
  const thumbnailHeight = thumbnailRect.height;

  document.body.classList.add("album-viewer-opening");
  document.body.style.overflow = "hidden";
  state.albumViewer.openTransitionTimer = setTimeout(() => {
    state.albumViewer.openTransitionTimer = null;
    albumPhotoViewer.classList.add("is-open");
    state.albumViewer.openStartTime = Date.now();
  }, 400);
  
  // Handle video vs image
  if (isVideo && albumViewerVideo) {
    // Hide images, show video
    albumViewerImage.style.display = 'none';
    if (albumViewerImage2) albumViewerImage2.style.display = 'none';
    albumViewerVideo.style.display = 'block';
    
    // Get video URL - for Google Photos, use proxy server to avoid CORS issues
    let videoUrl = full;
    let baseUrl = full;
    let isGooglePhotos = false;
    if (videoUrl.includes('googleusercontent.com')) {
      baseUrl = videoUrl.split('=')[0];
      isGooglePhotos = true;
      // For Google Photos videos, use proxy server with =dv format
      const dvUrl = baseUrl + '=dv';
      videoUrl = `/api/proxy-video?url=${encodeURIComponent(dvUrl)}`;
    }
    albumViewerVideo.src = videoUrl;
    albumViewerVideo.referrerPolicy = 'no-referrer';
    albumViewerVideo.muted = true;
    albumViewerVideo.loop = true;
    albumViewerVideo.playsInline = true;
    albumViewerVideo.autoplay = true;
    albumViewerVideo.preload = 'auto';
    albumViewerVideo.style.opacity = '0';
    
    // For non-Google Photos videos, if original URL fails, try =dv format
    if (!isGooglePhotos && baseUrl && baseUrl !== full) {
      albumViewerVideo.addEventListener('error', function tryDvFormat() {
        if (albumViewerVideo.error && albumViewerVideo.error.code === 4) {
          console.log('Original video URL failed, trying =dv format');
          albumViewerVideo.removeEventListener('error', tryDvFormat);
          const dvUrl = baseUrl + '=dv';
          albumViewerVideo.src = dvUrl;
          albumViewerVideo.referrerPolicy = 'no-referrer';
          albumViewerVideo.load();
          
          // If =dv format also fails, show image instead
          albumViewerVideo.addEventListener('error', function showImageFallback() {
            console.log('Video formats failed, showing image instead');
            // Completely stop and clear the video
            albumViewerVideo.pause();
            albumViewerVideo.src = '';
            albumViewerVideo.load();
            albumViewerVideo.style.display = 'none';
            // Show image instead
            albumViewerImage.style.display = 'block';
            albumViewerImage.src = full;
            albumViewerImage.alt = caption || '';
            albumViewerImage.referrerPolicy = 'no-referrer';
            albumViewerImage.style.opacity = '1';
          }, { once: true });
        } else {
          // If error is not code 4, show image immediately
          console.log('Video error, showing image instead');
          // Completely stop and clear the video
          albumViewerVideo.pause();
          albumViewerVideo.src = '';
          albumViewerVideo.load();
          albumViewerVideo.style.display = 'none';
          // Show image instead
          albumViewerImage.style.display = 'block';
          albumViewerImage.src = full;
          albumViewerImage.alt = caption || '';
          albumViewerImage.referrerPolicy = 'no-referrer';
          albumViewerImage.style.opacity = '1';
        }
      }, { once: true });
    }
    albumViewerVideo.style.transition = 'opacity 1000ms ease-in-out';
    
    // Improve mobile video controls
    albumViewerVideo.controls = true;
    albumViewerVideo.setAttribute('playsinline', 'true');
    albumViewerVideo.setAttribute('webkit-playsinline', 'true');
    albumViewerVideo.style.touchAction = 'manipulation';
    
    // Handle video errors - if video fails, show image instead
    albumViewerVideo.addEventListener('error', function onVideoError() {
      console.error('Video failed to load:', {
        error: albumViewerVideo.error,
        code: albumViewerVideo.error?.code,
        message: albumViewerVideo.error?.message,
        URL: albumViewerVideo.src,
        networkState: albumViewerVideo.networkState,
        readyState: albumViewerVideo.readyState
      });
      
      // If video fails, hide video and show image instead
      albumViewerVideo.style.display = 'none';
      albumViewerImage.style.display = 'block';
      albumViewerImage.src = full;
      albumViewerImage.alt = caption || '';
      albumViewerImage.referrerPolicy = 'no-referrer';
      albumViewerImage.style.opacity = '1';
    }, { once: true });
    
    // Handle video stalling/buffering issues
    albumViewerVideo.addEventListener('stalled', () => {
      console.warn('Video stalled, attempting to reload...');
      const currentTime = albumViewerVideo.currentTime;
      albumViewerVideo.load();
      if (currentTime > 0) {
        albumViewerVideo.currentTime = currentTime;
      }
      albumViewerVideo.play().catch(e => console.warn('Video play after reload failed:', e));
    });
    
    albumViewerVideo.addEventListener('waiting', () => {
      console.warn('Video waiting for data...');
    });
    
    // Wait for video metadata to load
    albumViewerVideo.onloadedmetadata = () => {
      repositionViewer();

      const showCaptionPanel = state.albumViewer.showCaption;
      if (albumViewerCaption) {
        albumViewerCaption.style.display = showCaptionPanel ? 'block' : 'none';
        albumViewerCaption.style.opacity = '0';
        albumViewerCaption.style.transition = 'opacity 1000ms ease-in-out';
      }

      // Fade in video and caption after background fade
      setTimeout(() => {
        albumViewerVideo.style.opacity = '1';
        // Ensure video is ready before playing
        if (albumViewerVideo.readyState >= 2) {
          albumViewerVideo.play().catch(e => console.warn('Video autoplay failed:', e));
        } else {
          albumViewerVideo.addEventListener('loadeddata', () => {
            albumViewerVideo.play().catch(e => console.warn('Video autoplay failed:', e));
          }, { once: true });
        }
        if (albumViewerCaption && showCaptionPanel) {
          albumViewerCaption.style.opacity = '1';
        }
      }, 700);
    };
    
    // Set caption content
    albumViewerCaption.innerHTML = '';
    if (caption) {
      const header = document.createElement('div');
      header.className = 'caption-header';
      header.textContent = caption;
      albumViewerCaption.appendChild(header);
    }
    if (description) {
      const body = document.createElement('div');
      body.className = 'caption-body';
      body.textContent = description;
      albumViewerCaption.appendChild(body);
      
      // Add links if available
      if (linksData && Array.isArray(linksData) && linksData.length > 0) {
        const linksContainer = document.createElement('div');
        linksContainer.className = 'caption-links';
        linksData.forEach(link => {
          if (link && link.text && link.url) {
            const linkElement = document.createElement('a');
            linkElement.href = link.url;
            linkElement.textContent = link.text;
            linkElement.target = '_blank';
            linkElement.rel = 'noopener noreferrer';
            linkElement.className = 'caption-link';
            linksContainer.appendChild(linkElement);
          }
        });
        albumViewerCaption.appendChild(linksContainer);
      }
    }
    
    // Initialize zoom/pan for images (not videos)
    if (!isVideo && albumViewerImage) {
      // Reset any existing zoom
      if (state.albumViewer.zoomController) {
        state.albumViewer.zoomController.destroy();
        state.albumViewer.zoomController = null;
      }
      
      // Wait for image to load before initializing zoom
      const initZoomOnLoad = () => {
        if (albumViewerImage.complete && albumViewerImage.naturalWidth > 0) {
          state.albumViewer.zoomController = initImageZoom(albumViewerContainer, albumViewerImage);
        } else {
          albumViewerImage.addEventListener('load', initZoomOnLoad, { once: true });
        }
      };
      initZoomOnLoad();
    } else if (isVideo && state.albumViewer.zoomController) {
      // Clean up zoom if switching to video
      state.albumViewer.zoomController.destroy();
      state.albumViewer.zoomController = null;
    }
    
    // Trap focus in album viewer
    trapFocus(albumPhotoViewer, state.albumViewer.previousFocus);
    
    // Set up keyboard navigation for videos
    const handleKeyboard = (e) => {
      // Only handle if viewer is open
      if (!albumPhotoViewer.classList.contains("is-open")) return;
      
      if (e.key === "Escape" || e.keyCode === 27) {
        closeAlbumPhotoViewer();
        return;
      }
      
      // Arrow key navigation
      if (e.key === 'ArrowLeft' || e.keyCode === 37) {
        e.preventDefault();
        navigateAlbumViewer(-1);
      } else if (e.key === 'ArrowRight' || e.keyCode === 39) {
        e.preventDefault();
        navigateAlbumViewer(1);
      }
    };
    
    // Store handler for cleanup
    state.albumViewer.keyboardHandler = handleKeyboard;
    window.addEventListener('keydown', handleKeyboard);
    
    // Set up close handler for videos
    const closeButton = albumPhotoViewer.querySelector(".close-button");
    if (closeButton) {
      const closeHandler = () => {
        closeAlbumPhotoViewer();
        closeButton.removeEventListener("click", closeHandler);
        albumPhotoViewer.removeEventListener("click", backdropCloseHandler);
      };
      const backdropCloseHandler = (e) => {
        if (e.target === albumPhotoViewer) {
          closeHandler();
        }
      };
      closeButton.addEventListener("click", closeHandler);
      albumPhotoViewer.addEventListener("click", backdropCloseHandler);
    }
    
    return; // Exit early for videos
  }
  
  // Handle images (existing code)
  // Hide video, show images
  if (albumViewerVideo) {
    albumViewerVideo.style.display = 'none';
    albumViewerVideo.pause();
    albumViewerVideo.src = '';
  }
  albumViewerImage.style.display = 'block';

  // Hover (-ue) overlay: only in standalone viewer, show on hover over the image
  const currentImageData = albumImages[state.albumViewer.currentIndex];
  const hoverUrl = currentImageData?.hover;
  if (albumViewerImage2) {
    if (hoverUrl) {
      albumViewerImage2.style.display = 'block';
      albumViewerImage2.src = hoverUrl;
      albumViewerImage2.alt = '';
      albumViewerImage2.referrerPolicy = 'no-referrer';
      albumViewerImage2.style.opacity = '0';
      albumViewerImage2.style.pointerEvents = 'none';
      albumViewerImage2.style.transition = 'opacity 0.2s ease';
      albumViewerImage2.style.zIndex = '2';
    } else {
      albumViewerImage2.style.display = 'none';
      albumViewerImage2.src = '';
    }
  }

  // Clear any existing errors before loading
  const existingErrorBeforeLoad = albumViewerContainer.querySelector('.album-viewer-error');
  if (existingErrorBeforeLoad) existingErrorBeforeLoad.remove();
  
  // Set the full resolution image
  albumViewerImage.src = full;
  albumViewerImage.alt = imgElement.alt || "";
  albumViewerImage.referrerPolicy = 'no-referrer';
  albumViewerImage.style.opacity = '0'; // Start invisible
  
  // Clear error handler reference
  let errorTimeout = null;
  let errorHandler = null;
  
  // Clear error on successful load - cancel timeout and remove error
  const clearAlbumError = () => {
    if (errorTimeout) {
      clearTimeout(errorTimeout);
      errorTimeout = null;
    }
    const errorDiv = albumViewerContainer.querySelector('.album-viewer-error');
    if (errorDiv) errorDiv.remove();
    // Remove error handler if it exists
    if (errorHandler) {
      albumViewerImage.removeEventListener('error', errorHandler);
      errorHandler = null;
    }
  };
  
  // Add error handling for album viewer image - only show if image truly fails
  errorHandler = () => {
    // Immediately check if image is already loaded (might have loaded between error event and handler)
    if (albumViewerImage.complete && albumViewerImage.naturalWidth > 0 && albumViewerImage.naturalHeight > 0) {
      clearAlbumError();
      return;
    }
    
    // Wait and double-check that image actually failed (not just loading)
    errorTimeout = setTimeout(() => {
      // Final check - only show error if image still hasn't loaded AND is truly broken
      if (!albumViewerImage.complete || albumViewerImage.naturalWidth === 0) {
        // Double-check one more time before showing error
        if (albumViewerImage.complete && albumViewerImage.naturalWidth > 0) {
          clearAlbumError();
          return;
        }
        
        // Check if error div already exists
        let errorDiv = albumViewerContainer.querySelector('.album-viewer-error');
        if (!errorDiv) {
          errorDiv = document.createElement('div');
          errorDiv.className = 'album-viewer-error';
          errorDiv.style.position = 'fixed';
          errorDiv.style.top = '50%';
          errorDiv.style.left = '50%';
          errorDiv.style.transform = 'translate(-50%, -50%)';
          errorDiv.style.background = 'rgba(255, 255, 255, 0.95)';
          errorDiv.style.padding = '2rem';
          errorDiv.style.borderRadius = '1rem';
          errorDiv.style.textAlign = 'center';
          errorDiv.style.zIndex = '10002';
          errorDiv.innerHTML = `
            <div class="error-icon" aria-hidden="true" style="font-size: 2.5rem; margin-bottom: 1rem;">⚠️</div>
            <p class="error-message" style="margin: 0 0 1rem 0; color: #666;">Failed to load image</p>
            <button class="error-retry-button" type="button" aria-label="Retry loading image">Retry</button>
          `;
          
          const retryButton = errorDiv.querySelector('.error-retry-button');
          retryButton.addEventListener('click', () => {
            errorDiv.remove();
            albumViewerImage.src = full;
            albumViewerImage.referrerPolicy = 'no-referrer';
          });
          
          albumViewerContainer.appendChild(errorDiv);
        }
      }
    }, 1500); // Wait 1.5 seconds to ensure image truly failed
  };
  
  albumViewerImage.addEventListener('error', errorHandler, { once: true });
  albumViewerImage.addEventListener('load', clearAlbumError, { once: true });
  
  // Also check immediately if image is already loaded (cached)
  if (albumViewerImage.complete && albumViewerImage.naturalWidth > 0 && albumViewerImage.naturalHeight > 0) {
    clearAlbumError();
  }
  
  // Set caption with header and body
  albumViewerCaption.innerHTML = '';
  if (caption) {
    const header = document.createElement('div');
    header.className = 'caption-header';
    header.textContent = caption;
    albumViewerCaption.appendChild(header);
  }
  if (description) {
    const body = document.createElement('div');
    body.className = 'caption-body';
    body.textContent = description;
    albumViewerCaption.appendChild(body);
    
    // Add links if available (linksData was already declared at the top of the function)
    if (linksData && Array.isArray(linksData) && linksData.length > 0) {
      const linksContainer = document.createElement('div');
      linksContainer.className = 'caption-links';
      linksData.forEach(link => {
        if (link && link.text && link.url) {
          const linkElement = document.createElement('a');
          linkElement.href = link.url;
          linkElement.textContent = link.text;
          linkElement.target = '_blank';
          linkElement.rel = 'noopener noreferrer';
          linkElement.className = 'caption-link';
          linksContainer.appendChild(linkElement);
        }
      });
      albumViewerCaption.appendChild(linksContainer);
    }
  }
  
  // Camera details (from image metadata); skip if metadata.hideCameraDetails is true
  if (currentPhotoId) {
    let imageData = null;
    if (state.photosDefault && Array.isArray(state.photosDefault)) {
      imageData = state.photosDefault.find(p => p && p.id === currentPhotoId);
    }
    if (!imageData && state.images && Array.isArray(state.images)) {
      imageData = state.images.find(p => p && p.id === currentPhotoId);
    }
    const meta = imageData?.metadata || {};
    if (!meta.hideCameraDetails) {
      const cameraDetails = document.createElement('div');
      cameraDetails.className = 'viewer-camera-details';
      const lines = [
        ['Camera:', meta.camera],
        ['Focal Length:', meta.focalLength],
        ['F/ Stop:', meta.fStop],
        ['Shutter:', meta.shutter],
        ['ISO:', meta.iso],
      ];
      lines.forEach(([label, value]) => {
        const line = document.createElement('div');
        line.className = 'viewer-camera-details-line';
        line.textContent = value !== undefined && value !== null && String(value).trim() !== '' ? `${label} ${String(value).trim()}` : `${label} `;
        cameraDetails.appendChild(line);
      });
      albumViewerCaption.appendChild(cameraDetails);
    }
  }
  
  // Clear any existing errors immediately when setting up the image
  const existingError = albumViewerContainer.querySelector('.album-viewer-error');
  if (existingError) existingError.remove();
  
  // Wait for image to load to get its dimensions
  albumViewerImage.onload = () => {
    // Clear any errors that might have appeared
    const errorDiv = albumViewerContainer.querySelector('.album-viewer-error');
    if (errorDiv) errorDiv.remove();

    repositionViewer();

    const showCaptionPanel = state.albumViewer.showCaption;
    albumViewerImage.style.transform = 'none';
    const bgFadeMs = 700;
    const photoFadeMs = 400;
    albumViewerImage.style.transition = `opacity ${photoFadeMs}ms ease-in-out`;
    const openStart = state.albumViewer.openStartTime;
    const elapsed = openStart ? (Date.now() - openStart) : 0;
    const delay = Math.max(0, bgFadeMs - elapsed);
    const applyFadeIn = () => {
      albumViewerImage.style.opacity = '1';
      if (albumViewerCaption && showCaptionPanel) {
        albumViewerCaption.style.transition = `opacity ${photoFadeMs}ms ease-in-out`;
        albumViewerCaption.style.opacity = '1';
      }
    };
    if (delay > 0) {
      setTimeout(applyFadeIn, delay);
    } else {
      applyFadeIn();
    }

    // Set up hover overlay handlers (repositionViewer handles sizing/position)
    if (albumViewerImage2 && albumViewerImage2.src) {
      albumViewerImage2.style.objectFit = 'contain';
      const prevShow = state.albumViewer.hoverOverlayShow;
      const prevHide = state.albumViewer.hoverOverlayHide;
      if (prevShow && prevHide) {
        albumViewerImage.removeEventListener('mouseenter', prevShow);
        albumViewerImage.removeEventListener('mouseleave', prevHide);
      }
      const showOverlay = () => { albumViewerImage2.style.opacity = '1'; };
      const hideOverlay = () => { albumViewerImage2.style.opacity = '0'; };
      state.albumViewer.hoverOverlayShow = showOverlay;
      state.albumViewer.hoverOverlayHide = hideOverlay;
      albumViewerImage.addEventListener('mouseenter', showOverlay);
      albumViewerImage.addEventListener('mouseleave', hideOverlay);
    }

    if (albumViewerCaption) {
      albumViewerCaption.style.display = showCaptionPanel ? 'block' : 'none';
      albumViewerCaption.style.opacity = showCaptionPanel ? '0' : '1';
      albumViewerCaption.style.transition = 'none';
    }
  };
  
  // Reposition on resize / device orientation change
  if (state.albumViewer.resizeHandler) {
    window.removeEventListener('resize', state.albumViewer.resizeHandler);
  }
  const onViewerResize = () => {
    if (state.selectors.albumPhotoViewer?.classList.contains('is-open')) {
      repositionViewer();
    }
  };
  window.addEventListener('resize', onViewerResize);
  state.albumViewer.resizeHandler = onViewerResize;

  // Trap focus in album viewer
  trapFocus(albumPhotoViewer, state.albumViewer.previousFocus);
  
  // Set up keyboard navigation for images
  const handleKeyboard = (e) => {
    // Only handle if viewer is open
    if (!albumPhotoViewer.classList.contains("is-open")) return;
    
    if (e.key === "Escape" || e.keyCode === 27) {
      closeAlbumPhotoViewer();
      return;
    }
    
    // Arrow key navigation
    if (e.key === 'ArrowLeft' || e.keyCode === 37) {
      e.preventDefault();
      navigateAlbumViewer(-1);
    } else if (e.key === 'ArrowRight' || e.keyCode === 39) {
      e.preventDefault();
      navigateAlbumViewer(1);
    }
  };
  
  // Store handler for cleanup (only if not already set for video)
  if (!state.albumViewer.keyboardHandler) {
    state.albumViewer.keyboardHandler = handleKeyboard;
    window.addEventListener('keydown', handleKeyboard);
  }
  
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
        navigateAlbumViewer(1);
      } else {
        // Swipe right - previous image
        navigateAlbumViewer(-1);
      }
    }
    
    // Reset
    touchStartX = 0;
    touchStartY = 0;
    touchEndX = 0;
    touchEndY = 0;
  };
  
  albumPhotoViewer.addEventListener('touchstart', handleTouchStart, { passive: true });
  albumPhotoViewer.addEventListener('touchmove', handleTouchMove, { passive: true });
  albumPhotoViewer.addEventListener('touchend', handleTouchEnd, { passive: true });
  
  // Prefetch adjacent images
  const prefetchAdjacentImages = () => {
    const { images, currentIndex } = state.albumViewer;
    if (!images || images.length === 0) return;
    
    const nextHref = currentIndex + 1 < images.length ? resolveAlbumViewerUrl(images[currentIndex + 1]) : '';
    if (nextHref) {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = nextHref;
      link.as = 'image';
      document.head.appendChild(link);
    }
    const prevHref = currentIndex - 1 >= 0 ? resolveAlbumViewerUrl(images[currentIndex - 1]) : '';
    if (prevHref) {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = prevHref;
      link.as = 'image';
      document.head.appendChild(link);
    }
  };
  
  setTimeout(prefetchAdjacentImages, 300);
  
  // Set up close handler
  const closeButton = albumPhotoViewer.querySelector(".close-button");
  if (closeButton) {
    const closeHandler = () => {
      closeAlbumPhotoViewer();
      closeButton.removeEventListener("click", closeHandler);
      albumPhotoViewer.removeEventListener("click", backdropCloseHandler);
    };
    const backdropCloseHandler = (e) => {
      if (e.target === albumPhotoViewer) {
        closeHandler();
      }
    };
    closeButton.addEventListener("click", closeHandler);
    albumPhotoViewer.addEventListener("click", backdropCloseHandler);
  }
}

// Navigate to next/previous image in album viewer
export function navigateAlbumViewer(direction) {
  const { images, currentIndex } = state.albumViewer;
  if (!images || images.length === 0) return;
  
  const newIndex = currentIndex + direction;
  if (newIndex < 0 || newIndex >= images.length) return;
  
  state.albumViewer.currentIndex = newIndex;
  const image = images[newIndex];
  if (!image) return;
  
  // Get selectors
  const { albumViewerImage, albumViewerImage2, albumViewerVideo, albumViewerCaption, albumViewerContainer } = state.selectors;
  if (!albumViewerImage || !albumViewerContainer) return;
  
  // Clear any existing errors
  const existingError = albumViewerContainer.querySelector('.album-viewer-error');
  if (existingError) existingError.remove();
  
  // Get image data directly from the image object
  const full = resolveAlbumViewerUrl(image) || image.full || image.thumbnail || '';
  const caption = image.caption || image.alt || '';
  const description = image.description || '';
  const linksData = image.links || null;
  const currentPhotoId = image.id || null;
  
  // Check if item is a video using comprehensive detection
  // Get album name for better video detection
  const activeKey = state.albums.activeKey;
  let albumName = '';
  if (activeKey && state.albums.lookup && state.albums.lookup[activeKey]) {
    albumName = state.albums.lookup[activeKey].name || '';
  }
  const isVideo = isVideoItem(image, full, albumName);
  
  if (!full) return;
  
  // Reset zoom when navigating
  if (state.albumViewer.zoomController) {
    state.albumViewer.zoomController.reset();
  }
  
  // Handle video vs image
  if (isVideo && albumViewerVideo) {
    // Stop any currently playing video
    albumViewerVideo.pause();
    albumViewerVideo.currentTime = 0;
    
    // Hide images, show video
    albumViewerImage.style.display = 'none';
    if (albumViewerImage2) albumViewerImage2.style.display = 'none';
    albumViewerVideo.style.display = 'block';
    
    // Clean up zoom for videos
    if (state.albumViewer.zoomController) {
      state.albumViewer.zoomController.destroy();
      state.albumViewer.zoomController = null;
    }
    
    // Get video URL - for Google Photos, use proxy server to avoid CORS issues
    let videoUrl = full;
    let baseUrl = full;
    let isGooglePhotos = false;
    if (videoUrl.includes('googleusercontent.com')) {
      baseUrl = videoUrl.split('=')[0];
      isGooglePhotos = true;
      // For Google Photos videos, use proxy server with =dv format
      const dvUrl = baseUrl + '=dv';
      videoUrl = `/api/proxy-video?url=${encodeURIComponent(dvUrl)}`;
    }
    albumViewerVideo.src = videoUrl;
    albumViewerVideo.referrerPolicy = 'no-referrer';
    
    // For non-Google Photos videos, if original URL fails, try =dv format
    if (!isGooglePhotos && baseUrl && baseUrl !== full) {
      albumViewerVideo.addEventListener('error', function tryDvFormat() {
        if (albumViewerVideo.error && albumViewerVideo.error.code === 4 && baseUrl) {
          console.log('Original video URL failed, trying =dv format');
          albumViewerVideo.removeEventListener('error', tryDvFormat);
          const dvUrl = baseUrl + '=dv';
          albumViewerVideo.src = dvUrl;
          albumViewerVideo.referrerPolicy = 'no-referrer';
          albumViewerVideo.load();
          
          // If =dv format also fails, show image instead
          albumViewerVideo.addEventListener('error', function showImageFallback() {
            console.log('Video formats failed, showing image instead');
            // Completely stop and clear the video
            albumViewerVideo.pause();
            albumViewerVideo.src = '';
            albumViewerVideo.load();
            albumViewerVideo.style.display = 'none';
            // Show image instead
            albumViewerImage.style.display = 'block';
            albumViewerImage.src = full;
            albumViewerImage.alt = caption || '';
            albumViewerImage.referrerPolicy = 'no-referrer';
            albumViewerImage.style.opacity = '1';
          }, { once: true });
        } else {
          // If error is not code 4, show image immediately
          console.log('Video error, showing image instead');
          // Completely stop and clear the video
          albumViewerVideo.pause();
          albumViewerVideo.src = '';
          albumViewerVideo.load();
          albumViewerVideo.style.display = 'none';
          // Show image instead
          albumViewerImage.style.display = 'block';
          albumViewerImage.src = full;
          albumViewerImage.alt = caption || '';
          albumViewerImage.referrerPolicy = 'no-referrer';
          albumViewerImage.style.opacity = '1';
        }
      }, { once: true });
    }
    albumViewerVideo.muted = true;
    albumViewerVideo.loop = true;
    albumViewerVideo.playsInline = true;
    albumViewerVideo.autoplay = true;
    albumViewerVideo.preload = 'auto';
    albumViewerVideo.style.opacity = '1';
    
    // Ensure video plays when ready
    const playVideo = () => {
      albumViewerVideo.play().catch(e => console.warn('Video autoplay failed:', e));
    };
    
    if (albumViewerVideo.readyState >= 2) {
      // Video already has enough data, play immediately
      playVideo();
    } else {
      // Wait for video to load data before playing
      albumViewerVideo.addEventListener('loadeddata', playVideo, { once: true });
      // Also try canplay as a fallback
      albumViewerVideo.addEventListener('canplay', playVideo, { once: true });
    }
    
    // Update caption
    if (albumViewerCaption) {
      albumViewerCaption.innerHTML = '';
      if (caption) {
        const header = document.createElement('div');
        header.className = 'caption-header';
        header.textContent = caption;
        albumViewerCaption.appendChild(header);
      }
      if (description) {
        const body = document.createElement('div');
        body.className = 'caption-body';
        body.textContent = description;
        albumViewerCaption.appendChild(body);
        
        // Add links if available
        if (linksData && Array.isArray(linksData) && linksData.length > 0) {
          const linksContainer = document.createElement('div');
          linksContainer.className = 'caption-links';
          linksData.forEach(link => {
            if (link && link.text && link.url) {
              const linkElement = document.createElement('a');
              linkElement.href = link.url;
              linkElement.textContent = link.text;
              linkElement.target = '_blank';
              linkElement.rel = 'noopener noreferrer';
              linkElement.className = 'caption-link';
              linksContainer.appendChild(linkElement);
            }
          });
          albumViewerCaption.appendChild(linksContainer);
        }
      }
    }
    return;
  }
  
  // Handle images
  if (albumViewerVideo) {
    albumViewerVideo.style.display = 'none';
    albumViewerVideo.pause();
    albumViewerVideo.src = '';
  }
  albumViewerImage.style.display = 'block';

  const hoverUrl = image.hover;
  if (albumViewerImage2) {
    if (hoverUrl) {
      albumViewerImage2.style.display = 'block';
      albumViewerImage2.src = hoverUrl;
      albumViewerImage2.alt = '';
      albumViewerImage2.referrerPolicy = 'no-referrer';
      albumViewerImage2.style.opacity = '0';
      albumViewerImage2.style.pointerEvents = 'none';
      albumViewerImage2.style.transition = 'opacity 0.2s ease';
      albumViewerImage2.style.zIndex = '2';
    } else {
      albumViewerImage2.style.display = 'none';
      albumViewerImage2.src = '';
    }
  }

  // Clear errors before loading
  const existingErrorBeforeLoad = albumViewerContainer.querySelector('.album-viewer-error');
  if (existingErrorBeforeLoad) existingErrorBeforeLoad.remove();
  
  // Set the image
  albumViewerImage.src = full;
  albumViewerImage.alt = caption;
  albumViewerImage.referrerPolicy = 'no-referrer';
  albumViewerImage.style.opacity = '1'; // Show immediately (no fade animation during navigation)
  
  // Initialize zoom/pan and position hover overlay when image loads
  const initZoomOnImageLoad = () => {
    if (albumViewerImage.complete && albumViewerImage.naturalWidth > 0) {
      // Clean up existing zoom
      if (state.albumViewer.zoomController) {
        state.albumViewer.zoomController.destroy();
      }
      // Initialize new zoom
      state.albumViewer.zoomController = initImageZoom(albumViewerContainer, albumViewerImage);
      // Position hover overlay over main image and attach hover listeners
      if (albumViewerImage2 && albumViewerImage2.src) {
        const r = albumViewerImage.getBoundingClientRect();
        albumViewerImage2.style.position = 'fixed';
        albumViewerImage2.style.left = `${r.left}px`;
        albumViewerImage2.style.top = `${r.top}px`;
        albumViewerImage2.style.width = `${r.width}px`;
        albumViewerImage2.style.height = `${r.height}px`;
        albumViewerImage2.style.objectFit = 'contain';
        const prevShow = state.albumViewer.hoverOverlayShow;
        const prevHide = state.albumViewer.hoverOverlayHide;
        if (prevShow && prevHide) {
          albumViewerImage.removeEventListener('mouseenter', prevShow);
          albumViewerImage.removeEventListener('mouseleave', prevHide);
        }
        const showOverlay = () => { albumViewerImage2.style.opacity = '1'; };
        const hideOverlay = () => { albumViewerImage2.style.opacity = '0'; };
        state.albumViewer.hoverOverlayShow = showOverlay;
        state.albumViewer.hoverOverlayHide = hideOverlay;
        albumViewerImage.addEventListener('mouseenter', showOverlay);
        albumViewerImage.addEventListener('mouseleave', hideOverlay);
      }
    } else {
      albumViewerImage.addEventListener('load', initZoomOnImageLoad, { once: true });
    }
  };
  initZoomOnImageLoad();
  
  // Update caption
  if (albumViewerCaption) {
    albumViewerCaption.innerHTML = '';
    if (caption) {
      const header = document.createElement('div');
      header.className = 'caption-header';
      header.textContent = caption;
      albumViewerCaption.appendChild(header);
    }
    if (description) {
      const body = document.createElement('div');
      body.className = 'caption-body';
      body.textContent = description;
      albumViewerCaption.appendChild(body);
      
      // Add links if available
      if (linksData && Array.isArray(linksData) && linksData.length > 0) {
        const linksContainer = document.createElement('div');
        linksContainer.className = 'caption-links';
        linksData.forEach(link => {
          if (link && link.text && link.url) {
            const linkElement = document.createElement('a');
            linkElement.href = link.url;
            linkElement.textContent = link.text;
            linkElement.target = '_blank';
            linkElement.rel = 'noopener noreferrer';
            linkElement.className = 'caption-link';
            linksContainer.appendChild(linkElement);
          }
        });
        albumViewerCaption.appendChild(linksContainer);
      }
    }
  }
  
  // Set up error handling (same as in openAlbumPhotoViewer)
  let errorTimeout = null;
  let errorHandler = null;
  
  const clearAlbumError = () => {
    if (errorTimeout) {
      clearTimeout(errorTimeout);
      errorTimeout = null;
    }
    const errorDiv = albumViewerContainer.querySelector('.album-viewer-error');
    if (errorDiv) errorDiv.remove();
    if (errorHandler) {
      albumViewerImage.removeEventListener('error', errorHandler);
      errorHandler = null;
    }
  };
  
  errorHandler = () => {
    if (albumViewerImage.complete && albumViewerImage.naturalWidth > 0 && albumViewerImage.naturalHeight > 0) {
      clearAlbumError();
      return;
    }
    
    errorTimeout = setTimeout(() => {
      if (!albumViewerImage.complete || albumViewerImage.naturalWidth === 0) {
        if (albumViewerImage.complete && albumViewerImage.naturalWidth > 0) {
          clearAlbumError();
          return;
        }
        
        let errorDiv = albumViewerContainer.querySelector('.album-viewer-error');
        if (!errorDiv) {
          errorDiv = document.createElement('div');
          errorDiv.className = 'album-viewer-error';
          errorDiv.style.position = 'fixed';
          errorDiv.style.top = '50%';
          errorDiv.style.left = '50%';
          errorDiv.style.transform = 'translate(-50%, -50%)';
          errorDiv.style.background = 'rgba(255, 255, 255, 0.95)';
          errorDiv.style.padding = '2rem';
          errorDiv.style.borderRadius = '1rem';
          errorDiv.style.textAlign = 'center';
          errorDiv.style.zIndex = '10002';
          errorDiv.innerHTML = `
            <div class="error-icon" aria-hidden="true" style="font-size: 2.5rem; margin-bottom: 1rem;">⚠️</div>
            <p class="error-message" style="margin: 0 0 1rem 0; color: #666;">Failed to load image</p>
            <button class="error-retry-button" type="button" aria-label="Retry loading image">Retry</button>
          `;
          
          const retryButton = errorDiv.querySelector('.error-retry-button');
          retryButton.addEventListener('click', () => {
            errorDiv.remove();
            albumViewerImage.src = full;
            albumViewerImage.referrerPolicy = 'no-referrer';
          });
          
          albumViewerContainer.appendChild(errorDiv);
        }
      }
    }, 1500);
  };
  
  albumViewerImage.addEventListener('error', errorHandler, { once: true });
  albumViewerImage.addEventListener('load', clearAlbumError, { once: true });
  
  if (albumViewerImage.complete && albumViewerImage.naturalWidth > 0 && albumViewerImage.naturalHeight > 0) {
    clearAlbumError();
  }
  
  // Update layout when image loads
  albumViewerImage.onload = () => {
    repositionViewer();

    const showCaptionPanel = state.albumViewer.showCaption;
    if (albumViewerCaption) {
      albumViewerCaption.style.display = showCaptionPanel ? 'block' : 'none';
      albumViewerCaption.style.opacity = '1';
    }
  };
}

function doCloseAlbumPhotoViewer() {
  const { albumPhotoViewer, albumViewerContainer, albumViewerImage, albumViewerImage2, albumViewerVideo, albumViewerCaption } = state.selectors;
  if (!albumPhotoViewer) return;
  if (state.albumViewer.keyboardHandler) {
    window.removeEventListener('keydown', state.albumViewer.keyboardHandler);
    state.albumViewer.keyboardHandler = null;
  }
  if (state.albumViewer.resizeHandler) {
    window.removeEventListener('resize', state.albumViewer.resizeHandler);
    state.albumViewer.resizeHandler = null;
  }
  removeFocusTrap(albumPhotoViewer);
  const prevFocus = state.albumViewer.previousFocus;
  const insideAriaHidden = prevFocus && prevFocus.closest("[aria-hidden=\"true\"]");
  restoreFocus(insideAriaHidden ? null : prevFocus);
  state.albumViewer.previousFocus = null;
  state.albumViewer.currentIndex = -1;
  state.albumViewer.images = [];
  state.albumViewer.openStartTime = null;
  const prevShow = state.albumViewer.hoverOverlayShow;
  const prevHide = state.albumViewer.hoverOverlayHide;
  if (albumViewerImage && prevShow && prevHide) {
    albumViewerImage.removeEventListener('mouseenter', prevShow);
    albumViewerImage.removeEventListener('mouseleave', prevHide);
  }
  state.albumViewer.hoverOverlayShow = null;
  state.albumViewer.hoverOverlayHide = null;
  if (albumViewerVideo) {
    albumViewerVideo.pause();
    albumViewerVideo.src = '';
    albumViewerVideo.style.display = 'none';
  }
  if (albumViewerImage) {
    albumViewerImage.style.transition = '';
    albumViewerImage.style.position = '';
    albumViewerImage.style.left = '';
    albumViewerImage.style.top = '';
    albumViewerImage.style.width = '';
    albumViewerImage.style.height = '';
    albumViewerImage.style.maxWidth = '';
    albumViewerImage.style.maxHeight = '';
    albumViewerImage.style.transform = '';
    albumViewerImage.style.transformOrigin = '';
    albumViewerImage.style.opacity = '';
  }
  if (albumViewerImage2) {
    albumViewerImage2.style.transition = '';
    albumViewerImage2.style.position = '';
    albumViewerImage2.style.left = '';
    albumViewerImage2.style.top = '';
    albumViewerImage2.style.width = '';
    albumViewerImage2.style.height = '';
    albumViewerImage2.style.maxWidth = '';
    albumViewerImage2.style.maxHeight = '';
    albumViewerImage2.style.transform = '';
    albumViewerImage2.style.opacity = '';
    albumViewerImage2.style.pointerEvents = '';
  }
  if (albumViewerCaption) {
    albumViewerCaption.style.position = '';
    albumViewerCaption.style.left = '';
    albumViewerCaption.style.top = '';
    albumViewerCaption.style.transform = '';
    albumViewerCaption.style.width = '';
    albumViewerCaption.style.opacity = '';
  }
  if (albumViewerContainer) {
    albumViewerContainer.classList.remove("layout-portrait", "is-image-hovered");
  }
  if (state.albumViewer.openTransitionTimer != null) {
    clearTimeout(state.albumViewer.openTransitionTimer);
    state.albumViewer.openTransitionTimer = null;
  }
  document.body.classList.remove("album-viewer-opening");
  document.body.classList.add("album-viewer-content-fade-in");
  albumPhotoViewer.classList.remove("is-open");
  document.body.style.overflow = "";
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.body.classList.remove("album-viewer-content-fade-in");
    });
  });

  if (state.albumViewer.clearImagesTimeoutId != null) {
    clearTimeout(state.albumViewer.clearImagesTimeoutId);
  }
  state.albumViewer.clearImagesTimeoutId = setTimeout(() => {
    state.albumViewer.clearImagesTimeoutId = null;
    if (!albumPhotoViewer.classList.contains("is-open")) {
      if (albumViewerImage) {
        albumViewerImage.src = "";
        albumViewerImage.alt = "";
      }
      if (albumViewerImage2) {
        albumViewerImage2.src = "";
        albumViewerImage2.alt = "";
      }
      if (albumViewerCaption) {
        albumViewerCaption.innerHTML = "";
      }
    }
  }, 600);
}

export function closeAlbumPhotoViewer() {
  doCloseAlbumPhotoViewer();
}
