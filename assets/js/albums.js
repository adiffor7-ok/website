// Album management
import { state } from './state.js';
import { albumKeyFromName } from './gallery-renderer.js';
import { renderPhotos } from './gallery-renderer.js';

export function updateAlbumsUI() {
  const { albumList, albumsReset } = state.selectors;
  const activeKey = state.albums.activeKey;
  if (albumList) {
    albumList.querySelectorAll(".album-card").forEach((card) => {
      const isActive = Boolean(activeKey) && card.dataset.albumKey === activeKey;
      card.classList.toggle("is-active", isActive);
      card.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  }
  if (albumsReset) {
    albumsReset.hidden = !activeKey;
  }
}

export function showSubAlbums(subAlbums, parentName) {
  const { albumList, albumTemplate, albumsSection } = state.selectors;
  if (!albumList || !albumTemplate || !albumsSection) return;
  
  albumsSection.hidden = false;
  const fragment = document.createDocumentFragment();
  
  // No back button - removed per user request
  
  // Render sub-albums
  for (const subAlbum of subAlbums) {
    const node = albumTemplate.content.firstElementChild.cloneNode(true);
    const key = albumKeyFromName(subAlbum.id || subAlbum.name);
    node.dataset.albumKey = key;
    node.dataset.albumName = subAlbum.name;
    node.dataset.isSubAlbum = "true";
    node.setAttribute("aria-label", `${subAlbum.name} (${subAlbum.items?.length || 0} ${(subAlbum.items?.length || 0) === 1 ? "photo" : "photos"})`);
    const title = node.querySelector(".album-title");
    const description = node.querySelector(".album-description");
    const count = node.querySelector(".album-count");
    const thumbnail = node.querySelector(".album-thumbnail");
    if (title) title.textContent = subAlbum.name;
    if (description) {
      description.textContent = subAlbum.name;
      description.style.color = subAlbum.titleColor || "";
      description.hidden = false;
    }
    if (count) count.textContent = `${subAlbum.items?.length || 0} ${(subAlbum.items?.length || 0) === 1 ? "photo" : "photos"}`;
    if (thumbnail) {
      let coverUrl = "";
      const customCoverId = typeof subAlbum.cover === "string" ? subAlbum.cover.trim() : null;
      if (customCoverId) {
        const coverItem = subAlbum.items?.find((item) => item.id === customCoverId);
        if (coverItem) coverUrl = coverItem.thumbnail || coverItem.full || "";
        else {
          const coverPhoto = state.photosDefault.find((p) => p && p.id === customCoverId);
          if (coverPhoto) coverUrl = coverPhoto.thumbnail || coverPhoto.full || "";
        }
      }
      if (!coverUrl && subAlbum.items?.length) coverUrl = subAlbum.items[0].thumbnail || subAlbum.items[0].full || "";
      if (coverUrl) {
        thumbnail.style.backgroundImage = `url("${coverUrl}")`;
        thumbnail.style.backgroundColor = "transparent";
        const preloadImg = new Image();
        preloadImg.src = coverUrl;
        preloadImg.referrerPolicy = "no-referrer";
      }
    }
    fragment.appendChild(node);
  }
  
  albumList.replaceChildren(fragment);
  updateAlbumsUI();
  
  // Add ESC handler to go back to main albums when viewing sub-albums
  if (state.albums.escHandler) {
    window.removeEventListener("keydown", state.albums.escHandler);
  }
  
  const escHandler = (e) => {
    if (e.key === "Escape" || e.keyCode === 27) {
      // Go back to main albums
      state.albums.parentKey = null;
      state.albums.subAlbums = null;
      state.albums.activeKey = null;
      renderAlbums();
      updateAlbumsUI();
    }
  };
  state.albums.escHandler = escHandler;
  window.addEventListener("keydown", escHandler);
}

export function renderAlbums() {
  const { albumList, albumTemplate, albumsSection } = state.selectors;
  if (!albumList || !albumTemplate || !albumsSection) return;
  
  // If showing sub-albums, don't render main albums
  if (state.albums.subAlbums && state.albums.subAlbums.length > 0) {
    return;
  }
  
  const groups = state.albums.groups;
  if (!groups || !groups.length) {
    albumList.replaceChildren();
    return;
  }
  albumsSection.hidden = false;
  const fragment = document.createDocumentFragment();
  for (const group of groups) {
    const node = albumTemplate.content.firstElementChild.cloneNode(true);
    node.dataset.albumKey = group.key;
    node.dataset.albumName = group.name;
    node.setAttribute("aria-label", `${group.name} (${group.count} ${group.count === 1 ? "photo" : "photos"})`);
    node.setAttribute("aria-pressed", "false");
    const title = node.querySelector(".album-title");
    const description = node.querySelector(".album-description");
    const count = node.querySelector(".album-count");
    const thumbnail = node.querySelector(".album-thumbnail");
    if (title) title.textContent = group.name;
    if (description) {
      description.textContent = group.name;
      description.style.color = group.titleColor || "";
      description.hidden = false;
    }
    if (count) count.textContent = `${group.count} ${group.count === 1 ? "photo" : "photos"}`;
    if (thumbnail && group.covers?.length) {
      const cover = group.covers[0];
      if (cover) {
        thumbnail.style.backgroundImage = `url("${cover}")`;
        thumbnail.style.backgroundColor = "transparent";
        const preloadImg = new Image();
        preloadImg.src = cover;
        preloadImg.referrerPolicy = "no-referrer";
      } else {
        thumbnail.style.backgroundImage = "";
        thumbnail.style.backgroundColor = "rgba(255, 255, 255, 0.72)";
      }
    }
    fragment.appendChild(node);
  }
  albumList.replaceChildren(fragment);
  updateAlbumsUI();
}

export function activateAlbumFilter(key) {
  // Check if this album has sub-albums
  const lookup = state.albums.lookup || {};
  const album = lookup[key];
  
  // If album has sub-albums, show them instead of photos
  if (album && Array.isArray(album.subAlbums) && album.subAlbums.length > 0) {
    // Store parent album key and show sub-albums
    state.albums.parentKey = key;
    state.albums.subAlbums = album.subAlbums;
    showSubAlbums(album.subAlbums, album.name);
    return;
  }
  
  // Normal album - show photos
  state.albums.activeKey = key;
  state.albums.parentKey = null;
  state.albums.subAlbums = null;
  updateAlbumsUI();
  renderPhotos();
  
  const { gallery, albumsSection } = state.selectors;
  
  // Scroll to top of page immediately (not smooth) to prevent scroll position issues
  window.scrollTo({ top: 0, behavior: 'auto' });
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
  const ps = document.querySelector('.page-scroll');
  if (ps) ps.scrollTop = 0;
  const photosEl = document.getElementById('photos');
  if (photosEl) photosEl.scrollTop = 0;
  
  // Fade out albums section to white (full fade before any content appears)
  if (albumsSection) {
    albumsSection.classList.add("is-fading-out");
    albumsSection.style.position = "absolute";
    albumsSection.style.top = "0";
    albumsSection.style.left = "0";
    albumsSection.style.right = "0";
  }

  const photosSection = document.getElementById("photos");
  if (photosSection) photosSection.classList.remove("album-content-visible");

  // After full fade to white, reveal album content (header + gallery) with same transition duration
  const transitionMs = 650;
  if (gallery) {
    setTimeout(() => {
      if (photosSection) photosSection.classList.add("album-content-visible");
      gallery.style.display = "grid";
      gallery.classList.add("is-visible", "album-drop-in");
      window.scrollTo({ top: 0, behavior: "auto" });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      const ps2 = document.querySelector('.page-scroll');
      if (ps2) ps2.scrollTop = 0;
      if (photosSection) photosSection.scrollTop = 0;
      setTimeout(() => gallery.classList.remove("album-drop-in"), transitionMs);
    }, transitionMs);
  }
  
  // Remove any existing handlers first
  if (state.albums.escHandler) {
    window.removeEventListener("keydown", state.albums.escHandler);
  }
  if (state.albums.clickOutsideHandler && gallery) {
    gallery.removeEventListener("click", state.albums.clickOutsideHandler);
  }
  
  // Add ESC key handler to go back to albums
  const escHandler = (e) => {
    if (e.key === "Escape" || e.keyCode === 27) {
      // Don't close if album photo viewer is open
      const albumViewer = document.querySelector("#album-photo-viewer");
      if (!albumViewer || !albumViewer.classList.contains("is-open")) {
        // If we're viewing sub-albums, go back to main albums
        if (state.albums.subAlbums && state.albums.subAlbums.length > 0) {
          state.albums.parentKey = null;
          state.albums.subAlbums = null;
          state.albums.activeKey = null;
          renderAlbums();
          updateAlbumsUI();
        } else {
          deactivateAlbumFilter();
        }
      }
    }
  };
  state.albums.escHandler = escHandler;
  window.addEventListener("keydown", escHandler);
  
  // Add click-outside handler to go back to albums (click on gallery background)
  const clickOutsideHandler = (e) => {
    // Don't close if album photo viewer is open
    const albumViewer = document.querySelector("#album-photo-viewer");
    if (albumViewer && albumViewer.classList.contains("is-open")) {
      return;
    }
    
    // Only trigger if clicking directly on gallery container (not on gallery cards or images)
    const clickedCard = e.target.closest(".gallery-card");
    if (!clickedCard && gallery && gallery.contains(e.target)) {
      deactivateAlbumFilter();
    }
  };
  state.albums.clickOutsideHandler = clickOutsideHandler;
  setTimeout(() => {
    if (gallery) {
      gallery.addEventListener("click", clickOutsideHandler);
    }
  }, 650);

  // Swipe-right on album grid to go back to gallery
  const photosTarget = document.getElementById("photos");
  if (photosTarget) {
    if (state.albums.swipeTouchStart) {
      photosTarget.removeEventListener("touchstart", state.albums.swipeTouchStart);
      photosTarget.removeEventListener("touchmove", state.albums.swipeTouchMove);
      photosTarget.removeEventListener("touchend", state.albums.swipeTouchEnd);
    }
    let swStartX = 0, swStartY = 0, swEndX = 0, swEndY = 0;
    const swTouchStart = (e) => {
      swStartX = e.touches[0].clientX;
      swStartY = e.touches[0].clientY;
      swEndX = 0;
      swEndY = 0;
    };
    const swTouchMove = (e) => {
      swEndX = e.touches[0].clientX;
      swEndY = e.touches[0].clientY;
    };
    const swTouchEnd = () => {
      if (!swStartX || !swEndX) return;
      const dX = swStartX - swEndX;
      const dY = swStartY - swEndY;
      if (Math.abs(dX) > Math.abs(dY) && dX < -50) {
        const albumViewer = document.querySelector("#album-photo-viewer");
        if (!albumViewer || !albumViewer.classList.contains("is-open")) {
          deactivateAlbumFilter();
        }
      }
      swStartX = 0; swStartY = 0; swEndX = 0; swEndY = 0;
    };
    state.albums.swipeTouchStart = swTouchStart;
    state.albums.swipeTouchMove = swTouchMove;
    state.albums.swipeTouchEnd = swTouchEnd;
    photosTarget.addEventListener("touchstart", swTouchStart, { passive: true });
    photosTarget.addEventListener("touchmove", swTouchMove, { passive: true });
    photosTarget.addEventListener("touchend", swTouchEnd, { passive: true });
  }
}

export function deactivateAlbumFilter() {
  state.albums.activeKey = null;
  updateAlbumsUI();
  renderPhotos();
  
  const { gallery, albumsSection } = state.selectors;
  
  // Clean up scroll prevention handlers
  if (gallery && gallery._scrollHandler) {
    window.removeEventListener('scroll', gallery._scrollHandler, true);
    gallery._scrollHandler = null;
  }
  if (gallery && gallery._wheelHandler) {
    window.removeEventListener('wheel', gallery._wheelHandler, true);
    gallery._wheelHandler = null;
  }
  if (gallery && gallery._touchHandler) {
    window.removeEventListener('touchmove', gallery._touchHandler, true);
    gallery._touchHandler = null;
  }
  if (gallery && gallery._resizeHandler) {
    window.removeEventListener('resize', gallery._resizeHandler);
    gallery._resizeHandler = null;
  }
  if (gallery && gallery._mutationObserver) {
    gallery._mutationObserver.disconnect();
    gallery._mutationObserver = null;
  }
  if (gallery && gallery._animationFrameId) {
    cancelAnimationFrame(gallery._animationFrameId);
    gallery._animationFrameId = null;
  }
  
  // Clear max scroll value
  if (gallery) {
    gallery._maxScrollValue = null;
  }
  
  // Reset body/document height
  document.body.style.minHeight = '';
  document.body.style.height = '';
  document.body.style.maxHeight = '';
  document.documentElement.style.minHeight = '';
  document.documentElement.style.height = '';
  document.documentElement.style.maxHeight = '';
  const pageScroll = document.querySelector('.page-scroll');
  if (pageScroll) {
    pageScroll.style.minHeight = '';
    pageScroll.style.height = '';
    pageScroll.style.maxHeight = '';
  }
  
  // Remove event listeners
  if (state.albums.escHandler) {
    window.removeEventListener("keydown", state.albums.escHandler);
    state.albums.escHandler = null;
  }
  if (state.albums.clickOutsideHandler && gallery) {
    gallery.removeEventListener("click", state.albums.clickOutsideHandler);
    state.albums.clickOutsideHandler = null;
  }
  const photosTarget = document.getElementById("photos");
  if (photosTarget && state.albums.swipeTouchStart) {
    photosTarget.removeEventListener("touchstart", state.albums.swipeTouchStart);
    photosTarget.removeEventListener("touchmove", state.albums.swipeTouchMove);
    photosTarget.removeEventListener("touchend", state.albums.swipeTouchEnd);
    state.albums.swipeTouchStart = null;
    state.albums.swipeTouchMove = null;
    state.albums.swipeTouchEnd = null;
  }
  
  const transitionMs = 650;
  const photosSection = document.getElementById("photos");
  if (photosSection) photosSection.classList.remove("album-content-visible");
  if (gallery) {
    gallery.classList.remove("is-visible");
    setTimeout(() => {
      gallery.style.display = "none";
    }, transitionMs);
  }
  
  // Fade in albums section (from white)
  if (albumsSection) {
    albumsSection.classList.remove("is-fading-out");
    // Reset albums section to relative positioning
    albumsSection.style.position = "relative";
    albumsSection.style.top = "";
    albumsSection.style.left = "";
    albumsSection.style.right = "";
  }
}

export function setupAlbumInteractions() {
  if (state.albums.initialized) return;
  const { albumList, albumsReset } = state.selectors;
  if (albumList) {
    albumList.addEventListener("click", (event) => {
      const card = event.target.closest(".album-card");
      if (!card) return;
      
      // Handle back button
      if (card.classList.contains("sub-album-back")) {
        return; // Already handled in showSubAlbums
      }
      
      const key = card.dataset.albumKey;
      if (!key) return;
      
      // Check if this is a sub-album
      const isSubAlbum = card.dataset.isSubAlbum === "true";
      if (isSubAlbum) {
        // Sub-album clicked - show its photos
        // First, add sub-album to lookup if not already there
        const lookup = state.albums.lookup || {};
        if (!lookup[key] && state.albums.subAlbums) {
          const subAlbum = state.albums.subAlbums.find(sa => {
            const saKey = albumKeyFromName(sa.id || sa.name);
            return saKey === key;
          });
          if (subAlbum) {
            // Create photo items from sub-album items
            const photoIndex = new Map();
            state.photosDefault.forEach((photo) => {
              if (photo && typeof photo.id === "string") {
                photoIndex.set(photo.id, photo);
              }
            });
            
            const albumItems = [];
            if (Array.isArray(subAlbum.items)) {
              for (const rawItem of subAlbum.items) {
                if (!rawItem || typeof rawItem !== "object") continue;
                const itemId = typeof rawItem.id === "string" ? rawItem.id : null;
                if (!itemId) continue;
                const basePhoto = photoIndex.get(itemId);
                if (!basePhoto) continue;
                const clone = { ...basePhoto };
                if (typeof rawItem.thumbnail === "string" && rawItem.thumbnail.trim()) {
                  clone.thumbnail = rawItem.thumbnail.trim();
                }
                if (typeof rawItem.full === "string" && rawItem.full.trim()) {
                  clone.full = rawItem.full.trim();
                }
                clone.__album = subAlbum.name || "";
                clone.__albumKey = key;
                albumItems.push(clone);
              }
            }
            
            lookup[key] = {
              key,
              name: subAlbum.name || "Untitled",
              items: albumItems,
              covers: albumItems.slice(0, 3).map(item => item.thumbnail || item.full || "").filter(Boolean),
              description: "",
              count: albumItems.length,
            };
          }
        }
        
        if (state.albums.activeKey === key) {
          deactivateAlbumFilter();
        } else {
          state.albums.activeKey = key;
          updateAlbumsUI();
          renderPhotos();
          
          // Same relaxed fade-to-white then reveal as activateAlbumFilter
          const { gallery, albumsSection } = state.selectors;
          const photosSection = document.getElementById("photos");
          window.scrollTo({ top: 0, behavior: 'auto' });
          document.documentElement.scrollTop = 0;
          document.body.scrollTop = 0;
          const subPs = document.querySelector('.page-scroll');
          if (subPs) subPs.scrollTop = 0;
          if (photosSection) photosSection.scrollTop = 0;
          if (photosSection) photosSection.classList.remove("album-content-visible");
          if (albumsSection) {
            albumsSection.classList.add("is-fading-out");
            albumsSection.style.position = "absolute";
            albumsSection.style.top = "0";
            albumsSection.style.left = "0";
            albumsSection.style.right = "0";
          }
          const transitionMs = 650;
          if (gallery) {
            setTimeout(() => {
              if (photosSection) photosSection.classList.add("album-content-visible");
              gallery.classList.add("is-visible", "album-drop-in");
              gallery.style.display = "grid";
              window.scrollTo({ top: 0, behavior: 'auto' });
              document.documentElement.scrollTop = 0;
              document.body.scrollTop = 0;
              const subPs2 = document.querySelector('.page-scroll');
              if (subPs2) subPs2.scrollTop = 0;
              if (photosSection) photosSection.scrollTop = 0;
              setTimeout(() => gallery.classList.remove("album-drop-in"), transitionMs);
            }, transitionMs);
          }
          
          // Add ESC and click-outside handlers
          if (state.albums.escHandler) {
            window.removeEventListener("keydown", state.albums.escHandler);
          }
          if (state.albums.clickOutsideHandler && gallery) {
            gallery.removeEventListener("click", state.albums.clickOutsideHandler);
          }
          
          const escHandler = (e) => {
            if (e.key === "Escape" || e.keyCode === 27) {
              const albumViewer = document.querySelector("#album-photo-viewer");
              if (!albumViewer || !albumViewer.classList.contains("is-open")) {
                // Go back to sub-albums view or main albums
                const lookup = state.albums.lookup || {};
                state.albums.activeKey = null;
                const parentKey = state.albums.parentKey;
                if (parentKey) {
                  const parentAlbum = lookup[parentKey];
                  if (parentAlbum && state.albums.subAlbums) {
                    // Hide gallery and show sub-albums view
                    const { gallery, albumsSection } = state.selectors;
                    if (gallery) {
                      gallery.classList.remove("is-visible");
                      gallery.style.display = "none";
                    }
                    if (albumsSection) {
                      albumsSection.hidden = false;
                      albumsSection.classList.remove("is-fading-out");
                    }
                    showSubAlbums(state.albums.subAlbums, parentAlbum.name);
                  } else {
                    // No parent or sub-albums, go back to main albums
                    deactivateAlbumFilter();
                  }
                } else {
                  // No parent key, just go back to main albums
                  deactivateAlbumFilter();
                }
              }
            }
          };
          state.albums.escHandler = escHandler;
          window.addEventListener("keydown", escHandler);
          
          const clickOutsideHandler = (e) => {
            const albumViewer = document.querySelector("#album-photo-viewer");
            if (albumViewer && albumViewer.classList.contains("is-open")) {
              return;
            }
            const clickedCard = e.target.closest(".gallery-card");
            if (!clickedCard && gallery && gallery.contains(e.target)) {
              // Go back to sub-albums view
              state.albums.activeKey = null;
              const parentKey = state.albums.parentKey;
              const parentAlbum = parentKey ? lookup[parentKey] : null;
              if (parentAlbum && state.albums.subAlbums) {
                showSubAlbums(state.albums.subAlbums, parentAlbum.name);
              }
              deactivateAlbumFilter();
            }
          };
          state.albums.clickOutsideHandler = clickOutsideHandler;
          setTimeout(() => {
            if (gallery) {
              gallery.addEventListener("click", clickOutsideHandler);
            }
          }, 600);
        }
      } else {
        // Main album clicked
        if (state.albums.activeKey === key) {
          deactivateAlbumFilter();
        } else {
          activateAlbumFilter(key);
        }
      }
    });
  }
  if (albumsReset) {
    albumsReset.addEventListener("click", () => {
      deactivateAlbumFilter();
    });
  }
  state.albums.initialized = true;
}
