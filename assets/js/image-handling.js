// Image and video handling utilities
import { state } from './state.js';
import { checkWebPSupport } from './utils.js';

// Detect if an item is a video based on multiple indicators
export function isVideoItem(image, url, activeAlbumNameFromState = null) {
  if (!image && !url && !activeAlbumNameFromState) return false;
  
  // Check URL for video file extensions
  const urlToCheck = url || image?.full || image?.thumbnail || image?.src || '';
  if (urlToCheck) {
    // Check for video file extensions
    if (/\.(mp4|webm|ogg|mov|avi|wmv|flv|mkv)(\?|$)/i.test(urlToCheck)) {
      return true;
    }
    // Check for video indicators in URL
    if (urlToCheck.includes('video') || urlToCheck.includes('=dv') || urlToCheck.includes('=m37') || urlToCheck.includes('=m18')) {
      return true;
    }
  }
  
  // Check metadata type
  const mediaType = image?.metadata?.type || image?.type || '';
  if (mediaType && (mediaType.includes('video') || mediaType === 'video' || mediaType === 'video/mp4')) {
    return true;
  }
  
  // Check if in Celeste album (all items are videos)
  let albumName = image?.__album || activeAlbumNameFromState || '';
  // Also check active album from state if in album mode
  if (!albumName && state.albums.activeKey && state.albums.lookup && state.albums.lookup[state.albums.activeKey]) {
    albumName = state.albums.lookup[state.albums.activeKey].name || '';
  }
  if (albumName === "Celeste") {
    return true;
  }
  
  return false;
}

// Generate low-quality placeholder URL from Google Photos URL
export function generateLowQualityPlaceholder(url) {
  if (!url || !url.includes('googleusercontent.com')) return null;
  
  // Extract base URL (before size parameters)
  const baseUrl = url.split('=')[0];
  if (!baseUrl) return null;
  
  // Generate small placeholder (20px width, maintains aspect ratio)
  return `${baseUrl}=w20`;
}

// Create blur-up placeholder effect
export function setupProgressiveImage(img, placeholderUrl, fullUrl) {
  if (!img || !fullUrl) return;
  
  // Create a small placeholder image
  if (placeholderUrl) {
    const placeholder = new Image();
    placeholder.src = placeholderUrl;
    placeholder.referrerPolicy = 'no-referrer';
    
    placeholder.onload = () => {
      // Set placeholder as background with blur
      img.style.backgroundImage = `url(${placeholderUrl})`;
      img.style.backgroundSize = 'cover';
      img.style.backgroundPosition = 'center';
      img.style.filter = 'blur(10px)';
      img.style.transition = 'filter 0.3s ease-out';
      
      // Load full image
      const fullImage = new Image();
      fullImage.src = fullUrl;
      fullImage.referrerPolicy = 'no-referrer';
      
      fullImage.onload = () => {
        // Remove blur and show full image
        img.src = fullUrl;
        img.style.filter = 'blur(0px)';
        img.style.backgroundImage = '';
        img.style.backgroundSize = '';
        img.style.backgroundPosition = '';
      };
      
      fullImage.onerror = () => {
        // If full image fails, remove blur but keep placeholder
        img.style.filter = 'blur(0px)';
      };
    };
  } else {
    // Fallback: just load the full image
    img.src = fullUrl;
  }
}

// Show error state on a gallery card - only if image truly failed
export function showImageError(card, img, retryCallback) {
  if (!card || !img) return;
  
  // Immediately check if image is already loaded - if so, don't show error
  if (img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) {
    clearImageError(card, img);
    return;
  }
  
  // Double-check that image actually failed (not just still loading)
  // Wait a moment to ensure it's truly failed
  const errorTimeout = setTimeout(() => {
    // Final check - only show error if image still hasn't loaded AND is not visible
    if (!img.complete || img.naturalWidth === 0) {
      // Also check if image is actually visible (not just a placeholder)
      const rect = img.getBoundingClientRect();
      const isVisible = rect.width > 0 && rect.height > 0;
      
      if (!isVisible || img.naturalWidth === 0) {
        // Mark as error state
        card.classList.add('has-error');
        card.setAttribute('aria-label', (card.getAttribute('aria-label') || 'Image') + ' - Failed to load');
        
        // Hide the broken image
        img.style.display = 'none';
        
        // Create or get error overlay
        let errorOverlay = card.querySelector('.image-error-overlay');
        if (!errorOverlay) {
          errorOverlay = document.createElement('div');
          errorOverlay.className = 'image-error-overlay';
          errorOverlay.setAttribute('role', 'alert');
          errorOverlay.setAttribute('aria-live', 'polite');
          
          const errorIcon = document.createElement('div');
          errorIcon.className = 'error-icon';
          errorIcon.innerHTML = '⚠️';
          errorIcon.setAttribute('aria-hidden', 'true');
          
          const errorMessage = document.createElement('p');
          errorMessage.className = 'error-message';
          errorMessage.textContent = 'Failed to load image';
          
          const retryButton = document.createElement('button');
          retryButton.className = 'error-retry-button';
          retryButton.type = 'button';
          retryButton.textContent = 'Retry';
          retryButton.setAttribute('aria-label', 'Retry loading image');
          
          retryButton.addEventListener('click', (e) => {
            e.stopPropagation();
            if (retryCallback) {
              retryCallback();
            }
          });
          
          errorOverlay.appendChild(errorIcon);
          errorOverlay.appendChild(errorMessage);
          errorOverlay.appendChild(retryButton);
          card.appendChild(errorOverlay);
        }
        
        errorOverlay.hidden = false;
      }
    }
  }, 1000); // Wait 1 second to ensure image truly failed
  
  // If image loads successfully, cancel the error timeout
  const cancelError = () => {
    clearTimeout(errorTimeout);
    clearImageError(card, img);
  };
  
  img.addEventListener('load', cancelError, { once: true });
}

// Clear error state from a gallery card
export function clearImageError(card, img) {
  if (!card || !img) return;
  
  card.classList.remove('has-error');
  img.style.display = '';
  
  const errorOverlay = card.querySelector('.image-error-overlay');
  if (errorOverlay) {
    errorOverlay.hidden = true;
    // Optionally remove it after a short delay to avoid flicker
    setTimeout(() => {
      if (errorOverlay && card.classList.contains('has-error') === false) {
        errorOverlay.remove();
      }
    }, 100);
  }
}

// Retry loading an image with fallback URLs
export function retryImageLoad(img, card, urls, currentIndex = 0) {
  if (currentIndex >= urls.length) {
    // All URLs failed, show error
    showImageError(card, img, () => {
      // Retry from beginning
      retryImageLoad(img, card, urls, 0);
    });
    return;
  }
  
  // Clear any existing error
  clearImageError(card, img);
  
  // Try next URL
  const urlToTry = urls[currentIndex];
  
  // Check if image is already loaded with this URL (cached)
  if (img.complete && img.naturalWidth > 0 && img.src === urlToTry) {
    // Image is already loaded successfully, clear any errors and return
    clearImageError(card, img);
    return;
  }
  
  img.src = urlToTry;
  img.referrerPolicy = 'no-referrer';
  
  // Set up error handler for this attempt
  const errorHandler = () => {
    img.removeEventListener('error', errorHandler);
    img.removeEventListener('load', loadHandler);
    retryImageLoad(img, card, urls, currentIndex + 1);
  };
  
  // Success handler
  const loadHandler = () => {
    img.removeEventListener('error', errorHandler);
    img.removeEventListener('load', loadHandler);
    clearImageError(card, img);
  };
  
  img.addEventListener('error', errorHandler, { once: true });
  img.addEventListener('load', loadHandler, { once: true });
  
  // If image is already loaded (cached), trigger load handler immediately
  if (img.complete && img.naturalWidth > 0) {
    loadHandler();
  }
}

// Setup WebP image with picture element
export function setupWebPImage(imgElement, thumbnailUrl, fullUrl, altText) {
  // Check if we should use picture element for WebP
  const useWebP = checkWebPSupport();
  const isGooglePhotos = thumbnailUrl.includes('googleusercontent.com') || fullUrl.includes('googleusercontent.com');
  
  // For Google Photos, they're already optimized - use regular img
  // For local images, use picture element with WebP fallback
  if (useWebP && !isGooglePhotos) {
    const imageUrl = thumbnailUrl || fullUrl;
    // Check if it's a local image (not already WebP)
    if (imageUrl && !imageUrl.endsWith('.webp') && (imageUrl.endsWith('.jpg') || imageUrl.endsWith('.jpeg') || imageUrl.endsWith('.png'))) {
      // Try to find WebP version
      const webpUrl = imageUrl.replace(/\.(jpg|jpeg|png)$/i, '.webp');
      
      // Create picture element structure
      const picture = document.createElement('picture');
      const webpSource = document.createElement('source');
      webpSource.type = 'image/webp';
      webpSource.srcset = webpUrl;
      
      // Clone the img element for fallback
      const fallbackImg = imgElement.cloneNode(true);
      fallbackImg.src = imageUrl;
      fallbackImg.alt = altText || '';
      fallbackImg.referrerPolicy = 'no-referrer';
      
      picture.appendChild(webpSource);
      picture.appendChild(fallbackImg);
      
      // Replace img with picture
      imgElement.parentNode.replaceChild(picture, imgElement);
      return fallbackImg; // Return the actual img element
    }
  }
  
  return imgElement; // Return original if not using WebP
}
