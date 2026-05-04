// Lazy loading functionality
import { state } from './state.js';
import { checkWebPSupport } from './utils.js';
import { clearImageError, showImageError } from './image-handling.js';

// Initialize Intersection Observer for lazy loading
export function initLazyLoadObserver() {
  // Check if Intersection Observer is supported
  if (!('IntersectionObserver' in window)) {
    return null;
  }
  
  // Throttle image loading to avoid rate limiting (429 errors from Google Photos)
  let loadingQueue = [];
  let isProcessingQueue = false;
  let lastLoadTime = 0;
  const MIN_LOAD_INTERVAL = 50; // Minimum 50ms between image loads
  
  const processQueue = () => {
    if (isProcessingQueue || loadingQueue.length === 0) return;
    
    isProcessingQueue = true;
    const now = Date.now();
    const timeSinceLastLoad = now - lastLoadTime;
    const delay = Math.max(0, MIN_LOAD_INTERVAL - timeSinceLastLoad);
    
    setTimeout(() => {
      const item = loadingQueue.shift();
      if (item) {
        const { img, srcToLoad, card, fullUrl } = item;
        lastLoadTime = Date.now();
        loadImage(img, srcToLoad, card, fullUrl);
      }
      isProcessingQueue = false;
      if (loadingQueue.length > 0) {
        processQueue();
      }
    }, delay);
  };
  
  const loadImage = (img, srcToLoad, card, fullUrl) => {
    // Clear any existing error state first
    clearImageError(card, img);
          
          // Progressive loading: if we have a placeholder, load full image with blur-up effect
          const placeholderUrl = img.src.includes('googleusercontent.com') && img.src.includes('=w20') ? img.src : null;
          const finalUrl = srcToLoad;
          const isGooglePhotos = finalUrl.includes('googleusercontent.com');
          
          // Setup WebP for local images during lazy load
          let actualImg = img;
          if (checkWebPSupport() && !isGooglePhotos && finalUrl && !finalUrl.endsWith('.webp') && (finalUrl.endsWith('.jpg') || finalUrl.endsWith('.jpeg') || finalUrl.endsWith('.png'))) {
            const webpUrl = finalUrl.replace(/\.(jpg|jpeg|png)$/i, '.webp');
            if (webpUrl !== finalUrl) {
              // Create picture element for WebP
              const picture = document.createElement('picture');
              const webpSource = document.createElement('source');
              webpSource.type = 'image/webp';
              webpSource.srcset = webpUrl;
              
              const fallbackImg = img.cloneNode(true);
              picture.appendChild(webpSource);
              picture.appendChild(fallbackImg);
              
              img.parentNode.replaceChild(picture, img);
              actualImg = fallbackImg;
            }
          }
          
          if (placeholderUrl && placeholderUrl !== finalUrl) {
            // Progressive loading: remove blur and load full image
            const fullImage = new Image();
            fullImage.src = finalUrl;
            fullImage.referrerPolicy = 'no-referrer';
            
            fullImage.onload = () => {
              actualImg.src = finalUrl;
              actualImg.style.filter = 'blur(0px)';
              actualImg.style.backgroundImage = '';
              actualImg.style.backgroundSize = '';
              actualImg.style.backgroundPosition = '';
            };
            
            fullImage.onerror = () => {
              // If full image fails, try fallback
              if (fullUrl && fullUrl !== finalUrl) {
                actualImg.src = fullUrl;
                actualImg.referrerPolicy = 'no-referrer';
              }
            };
          } else {
            // No placeholder, just load normally
            actualImg.src = srcToLoad;
            actualImg.referrerPolicy = 'no-referrer';
          }
          
    img.removeAttribute('data-src');
    img.removeAttribute('data-lazy');
    
    // Remove skeleton when image loads
    // Use the card parameter if provided, otherwise get it from DOM
    const imageCard = card || img.closest('.gallery-card');
    if (imageCard) {
      img.addEventListener('load', () => {
        imageCard.classList.remove('skeleton');
      }, { once: true });
      img.addEventListener('error', () => {
        imageCard.classList.remove('skeleton');
      }, { once: true });
    }
    
    // Build list of fallback URLs
    const fallbackUrls = [];
    if (fullUrl && fullUrl !== srcToLoad) {
      fallbackUrls.push(fullUrl);
    }
    
    // Set up error handler with fallback
    let errorHandlerTimeout = null;
    const handleError = () => {
      // Immediately check if image actually loaded (might be cached)
      if (actualImg.complete && actualImg.naturalWidth > 0 && actualImg.naturalHeight > 0) {
        clearImageError(card, actualImg);
        observer.unobserve(img);
        return;
      }
      
      // Wait a moment to see if image loads
      errorHandlerTimeout = setTimeout(() => {
        // Final check - only proceed if image truly failed
        if (!actualImg.complete || actualImg.naturalWidth === 0) {
          if (fallbackUrls.length > 0) {
            // Try fallback URL
            const nextUrl = fallbackUrls.shift();
            actualImg.src = nextUrl;
            actualImg.referrerPolicy = 'no-referrer';
            // Set up error handler for fallback
            actualImg.addEventListener('error', handleError, { once: true });
          } else {
            // All URLs failed, show error
            showImageError(card, actualImg, () => {
              // Retry from beginning
              actualImg.src = srcToLoad;
              actualImg.referrerPolicy = 'no-referrer';
              if (fullUrl && fullUrl !== srcToLoad) {
                actualImg.addEventListener('error', () => {
                  actualImg.src = fullUrl;
                  actualImg.referrerPolicy = 'no-referrer';
                  actualImg.addEventListener('error', handleError, { once: true });
                }, { once: true });
              }
              actualImg.addEventListener('error', handleError, { once: true });
            });
          }
        }
      }, 500);
    };
    
    // Set up load handler to clear errors and unobserve
    const handleLoad = () => {
      // Cancel any pending error handler
      if (errorHandlerTimeout) {
        clearTimeout(errorHandlerTimeout);
        errorHandlerTimeout = null;
      }
      // Remove error handlers to prevent false positives
      actualImg.removeEventListener('error', handleError);
      clearImageError(card, actualImg);
      observer.unobserve(img);
    };
    
    actualImg.addEventListener('error', handleError, { once: true });
    actualImg.addEventListener('load', handleLoad, { once: true });
    
    // If image is already loaded (cached), trigger load handler immediately
    if (actualImg.complete && actualImg.naturalWidth > 0 && actualImg.naturalHeight > 0) {
      handleLoad();
    }
  };
  
  // Create observer with root margin for early loading
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        
        // Load the image if it has a data-src attribute (lazy loaded)
        if (img.dataset.src) {
          const srcToLoad = img.dataset.src;
          const card = img.closest('.gallery-card');
          const fullUrl = img.dataset.full;
          
          // Queue the image for loading (throttled to avoid rate limiting)
          loadingQueue.push({ img, srcToLoad, card, fullUrl });
          processQueue();
        }
      }
    });
  }, {
    root: null,
    rootMargin: '50px', // Reduced from 100px to load fewer images at once (prevents 429 errors)
    threshold: 0.01 // Trigger when 1% visible
  });
  
  return observer;
}

// Setup lazy loading for images in a container
export function setupLazyLoading(container) {
  if (!container || !state.lazyLoadObserver) return;
  
  // Use requestAnimationFrame to ensure DOM is ready
  requestAnimationFrame(() => {
    const images = container.querySelectorAll('.gallery-card img[data-src]');
    images.forEach(img => {
      // Observe any image that still has a deferred source.
      if (img.dataset.src) {
        state.lazyLoadObserver.observe(img);
      }
    });
  });
}
