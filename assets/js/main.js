// Main initialization file
// Imports all modules and initializes the application

import { state } from './state.js';
import { hasGalleryElements, hasDigitalArtElements } from './utils.js';
import { fetchGalleryData, fetchCaptionsData, fetchDigitalArtData, annotateWithIndex, enrichWithCaptions, deriveAlbums } from './data-processing.js';
import { renderPhotos, renderDigitalArt } from './gallery-renderer.js';
import { renderAlbums } from './albums.js';
import { setupAlbumInteractions } from './albums.js';
import { setupLightbox } from './lightbox.js';
import { openAlbumPhotoViewer } from './album-viewer.js';
import { initLazyLoadObserver } from './lazy-loading.js';
import { setupCollectionSwitcher, setupSortControls } from './ui.js';
import { initLifeDevelopmentDNA } from './life-development-dna.js';
import { initPageShell, registerServiceWorker } from './site-shell.js';

// Load digital art collection
export async function loadDigitalArt() {
  if (!hasDigitalArtElements(state)) return;
  const { digitalGallery, digitalTemplate, digitalLoading, digitalError } = state.selectors;

  const renderCurrent = () => {
    if (state.digitalArt.defaultItems.length) {
      renderDigitalArt();
    } else {
      if (digitalGallery) digitalGallery.replaceChildren();
      if (digitalError) {
        digitalError.hidden = false;
        digitalError.textContent = "Digital art uploads coming soon.";
      }
    }
  };

  if (state.digitalArt.loaded) {
    if (digitalLoading) digitalLoading.hidden = true;
    renderCurrent();
    return;
  }

  if (digitalLoading) digitalLoading.hidden = false;
  if (digitalError) {
    digitalError.hidden = true;
    digitalError.textContent = "";
  }

  try {
    const images = await fetchDigitalArtData();
    const annotated = annotateWithIndex(images);
    const enriched = enrichWithCaptions(annotated, state.captions.digital);
    state.digitalArt.defaultItems = enriched;
    state.digitalArt.loaded = true;
    if (enriched.length) {
      renderDigitalArt();
    } else {
      renderCurrent();
    }
  } catch (error) {
    if (digitalError) {
      digitalError.hidden = false;
      digitalError.textContent = error.message;
    }
  } finally {
    if (digitalLoading) digitalLoading.hidden = true;
  }
}

// Initialize gallery
async function initGallery() {
  if (!hasGalleryElements(state)) return;
  const { loading, error } = state.selectors;
  try {
    const [data, captions] = await Promise.all([fetchGalleryData(), fetchCaptionsData()]);
    state.captions = captions;
    const images = data.images;
    const albumCatalog = Array.isArray(data.albums) ? data.albums : [];
    const annotated = annotateWithIndex(images);
    const enriched = enrichWithCaptions(annotated, captions.photos);
    state.images = enriched;
    state.photosDefault = enriched;
    const albumsDerived = deriveAlbums(enriched, albumCatalog);
    state.albums.groups = albumsDerived.groups;
    state.albums.lookup = albumsDerived.lookup;
    setupAlbumInteractions();
    renderAlbums();
    renderPhotos();
    loading.hidden = true;
  } catch (err) {
    loading.hidden = true;
    error.hidden = false;
    error.textContent = err.message;
  }
}

// Initialize lazy loading observer
state.lazyLoadObserver = initLazyLoadObserver();

// Life Development DNA strand (life development page only)
if (document.body.dataset.page === 'life-development') {
  initLifeDevelopmentDNA();
}

// Shared page shell
initPageShell({ enableThemePicker: true });

// Initialize all components
setupLightbox(openAlbumPhotoViewer);
initGallery();
setupCollectionSwitcher(loadDigitalArt);
setupSortControls(loadDigitalArt);
registerServiceWorker();
