// UI setup functions
import { state } from './state.js';
import { renderPhotos, renderDigitalArt } from './gallery-renderer.js';

export function collectionIdToKey(id) {
  return id === "digital-art" ? "digital" : "photos";
}

export function getActiveCollectionId() {
  const activePanel = document.querySelector(".collection-panel.is-active");
  return activePanel?.id || "photos";
}

export function getActiveCollectionKey() {
  return collectionIdToKey(getActiveCollectionId());
}

export function setupCollectionSwitcher(loadDigitalArtFn) {
  const switcher = document.querySelector(".collection-nav");
  if (!switcher) return;
  const triggers = Array.from(switcher.querySelectorAll(".collection-link[data-target]"));
  if (!triggers.length) return;
  const panels = new Map(
    Array.from(document.querySelectorAll(".collection-panel")).map((panel) => [
      panel.id,
      panel,
    ])
  );

  const activate = (targetId) => {
    triggers.forEach((button) => {
      const isActive = button.dataset.target === targetId;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", isActive ? "true" : "false");
    });

    panels.forEach((panel, id) => {
      const isActive = id === targetId;
      panel.classList.toggle("is-active", isActive);
      panel.hidden = !isActive;
    });

    state.ui.updateSortButtons?.(collectionIdToKey(targetId));

    if (targetId === "digital-art") {
      if (loadDigitalArtFn) {
        void loadDigitalArtFn();
      }
    }
  };

  triggers.forEach((button) => {
    button.addEventListener("click", () => {
      const targetId = button.dataset.target;
      if (!targetId || !panels.has(targetId)) return;
      activate(targetId);
    });
  });

  const defaultTarget =
    triggers.find((button) => button.classList.contains("is-active"))?.dataset.target ||
    triggers[0].dataset.target;

  if (defaultTarget && panels.has(defaultTarget)) {
    activate(defaultTarget);
  }
}

export function setupSortControls(loadDigitalArtFn) {
  const buttons = Array.from(document.querySelectorAll(".sort-button[data-sort-mode]"));
  if (!buttons.length) return;

  const updateButtons = (collectionKey) => {
    buttons.forEach((button) => {
      const mode = button.dataset.sortMode || "default";
      const isActive = state.sortModes[collectionKey] === mode;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  };

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const mode = button.dataset.sortMode;
      if (!mode) return;
      const activeKey = getActiveCollectionKey();
      if (state.sortModes[activeKey] === mode) return;
      state.sortModes[activeKey] = mode;
      if (activeKey === "photos") {
        renderPhotos();
      } else if (activeKey === "digital") {
        if (state.digitalArt.loaded) {
          renderDigitalArt();
        } else {
          if (loadDigitalArtFn) {
            void loadDigitalArtFn();
          }
        }
      }
      updateButtons(activeKey);
    });
  });

  state.ui.sortButtons = buttons;
  state.ui.updateSortButtons = updateButtons;
  updateButtons(getActiveCollectionKey());
}
