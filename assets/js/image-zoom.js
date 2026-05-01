// Image zoom and pan functionality
// Supports mouse wheel zoom, pinch-to-zoom, and drag-to-pan

export function initImageZoom(container, imageElement) {
  if (!container || !imageElement) return null;
  
  let scale = 1;
  let translateX = 0;
  let translateY = 0;
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let initialTranslateX = 0;
  let initialTranslateY = 0;
  let minScale = 1;
  let maxScale = 5;
  let isZoomed = false;
  
  // Reset zoom state
  const resetZoom = () => {
    scale = 1;
    translateX = 0;
    translateY = 0;
    isZoomed = false;
    updateTransform();
  };
  
  // Update CSS transform
  const updateTransform = () => {
    imageElement.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    imageElement.style.transition = isDragging ? 'none' : 'transform 0.2s ease-out';
    
    // Add/remove zoomed class for styling
    if (scale > 1) {
      container.classList.add('is-zoomed');
      isZoomed = true;
      container.style.cursor = isDragging ? 'grabbing' : 'grab';
    } else {
      container.classList.remove('is-zoomed');
      isZoomed = false;
      container.style.cursor = 'zoom-in';
    }
  };
  
  // Constrain translation to keep image within bounds
  const constrainTranslation = () => {
    const rect = container.getBoundingClientRect();
    const imgRect = imageElement.getBoundingClientRect();
    const scaledWidth = imgRect.width * scale;
    const scaledHeight = imgRect.height * scale;
    
    const maxX = Math.max(0, (scaledWidth - rect.width) / 2);
    const maxY = Math.max(0, (scaledHeight - rect.height) / 2);
    
    translateX = Math.max(-maxX, Math.min(maxX, translateX));
    translateY = Math.max(-maxY, Math.min(maxY, translateY));
    
    updateTransform();
  };
  
  // Zoom to point
  const zoomToPoint = (clientX, clientY, delta) => {
    const rect = container.getBoundingClientRect();
    const imgRect = imageElement.getBoundingClientRect();
    
    // Calculate point relative to container
    const x = clientX - rect.left - rect.width / 2;
    const y = clientY - rect.top - rect.height / 2;
    
    // Calculate point relative to image
    const imgX = (x - translateX) / scale;
    const imgY = (y - translateY) / scale;
    
    // Calculate new scale
    const zoomFactor = delta > 0 ? 1.1 : 0.9;
    const newScale = Math.max(minScale, Math.min(maxScale, scale * zoomFactor));
    
    if (newScale === scale) return; // Can't zoom further
    
    // Calculate new translation to zoom into point
    translateX = x - imgX * newScale;
    translateY = y - imgY * newScale;
    scale = newScale;
    
    constrainTranslation();
  };
  
  // Mouse wheel zoom
  const handleWheel = (e) => {
    if (!isZoomed && scale === 1 && e.deltaY < 0) {
      // First zoom in - center on image
      const rect = container.getBoundingClientRect();
      translateX = 0;
      translateY = 0;
      scale = 1.5;
      updateTransform();
      constrainTranslation();
      e.preventDefault();
      return;
    }
    
    if (scale > 1 || e.deltaY < 0) {
      e.preventDefault();
      zoomToPoint(e.clientX, e.clientY, -e.deltaY);
    }
  };
  
  // Mouse drag to pan
  const handleMouseDown = (e) => {
    if (scale <= 1) return;
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    initialTranslateX = translateX;
    initialTranslateY = translateY;
    updateTransform(); // Updates cursor to 'grabbing'
    e.preventDefault();
  };
  
  const handleMouseMove = (e) => {
    if (!isDragging) return;
    translateX = initialTranslateX + (e.clientX - startX);
    translateY = initialTranslateY + (e.clientY - startY);
    constrainTranslation();
  };
  
  const handleMouseUp = () => {
    isDragging = false;
    updateTransform(); // Updates cursor based on scale
  };
  
  // Touch gestures
  let touchStartDistance = 0;
  let touchStartScale = 1;
  let touchStartTranslateX = 0;
  let touchStartTranslateY = 0;
  let touchStartCenterX = 0;
  let touchStartCenterY = 0;
  
  const getTouchDistance = (touches) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };
  
  const getTouchCenter = (touches) => {
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2
    };
  };
  
  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      // Single touch - prepare for pan
      if (scale > 1) {
        isDragging = true;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        initialTranslateX = translateX;
        initialTranslateY = translateY;
      }
    } else if (e.touches.length === 2) {
      // Two touches - prepare for pinch zoom
      isDragging = false;
      touchStartDistance = getTouchDistance(e.touches);
      touchStartScale = scale;
      touchStartTranslateX = translateX;
      touchStartTranslateY = translateY;
      const center = getTouchCenter(e.touches);
      touchStartCenterX = center.x;
      touchStartCenterY = center.y;
    }
  };
  
  const handleTouchMove = (e) => {
    if (e.touches.length === 1 && isDragging && scale > 1) {
      // Single touch pan
      translateX = initialTranslateX + (e.touches[0].clientX - startX);
      translateY = initialTranslateY + (e.touches[0].clientY - startY);
      constrainTranslation();
    } else if (e.touches.length === 2) {
      // Pinch zoom
      e.preventDefault();
      const currentDistance = getTouchDistance(e.touches);
      const scaleFactor = currentDistance / touchStartDistance;
      const newScale = Math.max(minScale, Math.min(maxScale, touchStartScale * scaleFactor));
      
      if (newScale !== scale) {
        const rect = container.getBoundingClientRect();
        const centerX = touchStartCenterX - rect.left - rect.width / 2;
        const centerY = touchStartCenterY - rect.top - rect.height / 2;
        
        // Calculate zoom point relative to image
        const imgX = (centerX - touchStartTranslateX) / touchStartScale;
        const imgY = (centerY - touchStartTranslateY) / touchStartScale;
        
        // Update scale and translation
        scale = newScale;
        translateX = centerX - imgX * scale;
        translateY = centerY - imgY * scale;
        
        constrainTranslation();
      }
    }
  };
  
  const handleTouchEnd = () => {
    isDragging = false;
  };
  
  // Double-click to zoom
  const handleDoubleClick = (e) => {
    if (scale > 1) {
      resetZoom();
    } else {
      const rect = container.getBoundingClientRect();
      zoomToPoint(e.clientX, e.clientY, 1);
    }
  };
  
  // Set up event listeners
  container.addEventListener('wheel', handleWheel, { passive: false });
  container.addEventListener('mousedown', handleMouseDown);
  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('mouseup', handleMouseUp);
  container.addEventListener('touchstart', handleTouchStart, { passive: true });
  container.addEventListener('touchmove', handleTouchMove, { passive: false });
  container.addEventListener('touchend', handleTouchEnd);
  container.addEventListener('dblclick', handleDoubleClick);
  
  
  // Return cleanup function
  return {
    reset: resetZoom,
    destroy: () => {
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('dblclick', handleDoubleClick);
      resetZoom();
    }
  };
}
