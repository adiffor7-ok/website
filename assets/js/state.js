// State management
export const state = {
  photosDefault: [],
  images: [],
  albums: {
    groups: [],
    lookup: {},
    activeKey: null,
    initialized: false,
  },
  sortModes: {
    photos: "default",
    digital: "default",
  },
  captions: {
    photos: {},
    digital: {},
  },
  digitalArt: {
    loaded: false,
    defaultItems: [],
    items: [],
  },
  lightbox: {
    currentIndex: -1,
    images: [],
    previousFocus: null,
    keyboardHandler: null,
  },
  albumViewer: {
    currentIndex: -1,
    images: [],
    previousFocus: null,
    keyboardHandler: null,
    clearImagesTimeoutId: null,
    openTransitionTimer: null,
    resizeHandler: null,
    /** When false, viewer shows image/video full-bleed (no caption panel). When true, shows caption/title/camera details. */
    showCaption: false,
  },
  selectors: {
    gallery: document.querySelector("#gallery"),
    template: document.querySelector("#image-card-template"),
    loading: document.querySelector("#loading"),
    error: document.querySelector("#error"),
    digitalGallery: document.querySelector("#digital-art-gallery"),
    digitalTemplate: document.querySelector("#digital-art-template"),
    digitalLoading: document.querySelector("#digital-art-loading"),
    digitalError: document.querySelector("#digital-art-error"),
    lightbox: document.querySelector("#lightbox"),
    lightboxImage: document.querySelector("#lightbox-image"),
    albumPhotoViewer: document.querySelector("#album-photo-viewer"),
    albumViewerContainer: document.querySelector("#album-viewer-container"),
    albumViewerImage: document.querySelector("#album-viewer-image"),
    albumViewerImage2: document.querySelector("#album-viewer-image-2"),
    albumViewerVideo: document.querySelector("#album-viewer-video"),
    albumViewerCaption: document.querySelector("#album-viewer-caption"),
    lightboxCaption: document.querySelector("#lightbox-caption"),
    lightboxContent: document.querySelector(".lightbox-content"),
    albumsSection: document.querySelector(".albums-section"),
    albumList: document.querySelector("#album-list"),
    albumTemplate: document.querySelector("#album-card-template"),
    albumsReset: document.querySelector("#albums-reset"),
    albumViewHeader: document.querySelector("#album-view-header"),
  },
  ui: {},
  lazyLoadObserver: null, // Intersection Observer for lazy loading
};

export const DEFAULT_LIGHTBOX_BG = "rgba(255, 255, 255, 0.98)";
export const DEFAULT_LIGHTBOX_RGB = { r: 255, g: 255, b: 255 };
export const DEFAULT_LIGHTBOX_SHADOW = "0 26px 65px rgba(0, 0, 0, 0.16)";

export const COLOR_GROUP_ORDER = [
  "reds",
  "oranges",
  "yellows",
  "greens",
  "blues",
  "indigos",
  "pinks",
  "purples",
  "whites",
  "greys",
  "blacks",
];
export const COLOR_GROUP_SET = new Set(COLOR_GROUP_ORDER);
export const BLACK_LIGHTNESS_MAX = 20;
export const BLACK_CHROMA_MAX = 22;
export const WHITE_LIGHTNESS_MIN = 87;
export const WHITE_CHROMA_MAX = 14;
export const GREY_CHROMA_MAX = 14;

export const NEUTRAL_GROUPS = new Set(["whites", "greys", "blacks", "misc"]);
export const NEUTRAL_ORDER = ["whites", "greys", "blacks", "misc"];
export const NEUTRAL_RANK = NEUTRAL_ORDER.reduce((map, name, index) => {
  map[name] = index;
  return map;
}, {});
export const METADATA_EXCLUDE = new Set(["dimensions", "albums", "album", "albumDescription"]);

export const METADATA_LABELS = {
  camera: "Camera",
  lens: "Lens",
  focalLength: "Focal Length",
  aperture: "Aperture",
  exposure: "Exposure",
  iso: "ISO",
  captured: "Captured",
  dimensions: "Dimensions",
  location: "Location",
  filename: "Filename",
  type: "Type",
};
export const DETAIL_KEYS = ["camera", "lens", "exposure", "iso", "aperture"];
