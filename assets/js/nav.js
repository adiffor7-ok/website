export function setupNavHighlight() {
  const navLinks = Array.from(document.querySelectorAll(".nav-link[data-page]"));
  if (!navLinks.length) return;

  const activePage = document.body?.dataset.page;
  if (!activePage) return;

  navLinks.forEach((link) => {
    const pages = link.dataset.page.split(",").map((token) => token.trim());
    const isActive = pages.includes(activePage);
    link.classList.toggle("is-active", isActive);
    if (isActive) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });
}

export function setupNavMobile() {
  /* no-op: horizontal nav needs no JS toggling */
}
