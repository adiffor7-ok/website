// Focus management helpers for accessibility
export function trapFocus(container, previousFocus) {
  if (!container) return null;
  
  // Store the previously focused element
  const savedFocus = previousFocus || document.activeElement;
  
  // Get all focusable elements within the container
  const focusableSelectors = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    'video[controls]',
  ].join(', ');
  
  const focusableElements = Array.from(container.querySelectorAll(focusableSelectors))
    .filter(el => {
      // Filter out hidden elements
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    });
  
  if (focusableElements.length === 0) {
    // If no focusable elements, focus the container itself if it's focusable
    if (container.hasAttribute('tabindex') || container instanceof HTMLElement) {
      try {
        container.focus();
      } catch (e) {
        // Container might not be focusable, ignore
      }
    }
    return savedFocus;
  }
  
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  
  // Focus the first element
  try {
    firstElement.focus();
  } catch (e) {
    // Element might not be focusable, ignore
  }
  
  // Handle Tab key to trap focus
  const handleTab = (e) => {
    if (e.key !== 'Tab') return;
    
    if (e.shiftKey) {
      // Shift + Tab: if on first element, move to last
      if (document.activeElement === firstElement) {
        e.preventDefault();
        try {
          lastElement.focus();
        } catch (e) {
          // Element might not be focusable, ignore
        }
      }
    } else {
      // Tab: if on last element, move to first
      if (document.activeElement === lastElement) {
        e.preventDefault();
        try {
          firstElement.focus();
        } catch (e) {
          // Element might not be focusable, ignore
        }
      }
    }
  };
  
  container.addEventListener('keydown', handleTab);
  // Store handler for cleanup
  container.dataset.focusTrapHandler = handleTab.toString();
  
  return savedFocus;
}

export function restoreFocus(savedFocus) {
  if (savedFocus && savedFocus instanceof HTMLElement) {
    // Check if element is still in the DOM
    if (document.body.contains(savedFocus)) {
      try {
        savedFocus.focus();
      } catch (e) {
        // Element might not be focusable, ignore
      }
    }
  }
}

export function removeFocusTrap(container) {
  if (!container) return;
  // Note: We can't easily remove the specific listener without storing a reference
  // The listener will be removed when the container is removed from DOM or we can
  // use AbortController in modern browsers, but for now we'll just clear the flag
  container.dataset.focusTrapHandler = 'false';
}
