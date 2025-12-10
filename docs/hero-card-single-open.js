/**
 * Single-open helper for Swiper/Webflow hero cards.
 * Mirrors the working implementation on mff-story but extends selectors so it
 * can run on hero sliders that use `.hero-card-*` classes.
 */
(function heroCardSingleOpen(config = {}) {
  const scopeSelector = config.scopeSelector || ".timeline-tabs, [data-single-open-scope]";
  const cardSelector = config.cardSelector || ".hero-card-slide, .timeline-slide-card";
  const panelSelector = config.panelSelector || ".hero-card-list-wrapper, .timeline-card-list-wrapper";
  const footerSelector = config.footerSelector || ".hero-card-footer, .timeline-card-footer";
  const navSelector =
    config.navSelector ||
    ".swiper-button-next, .swiper-button-prev, .swiper-pagination-bullet, .w-slider-arrow-left, .w-slider-arrow-right, .w-slider-dot";
  const sliderSelector = config.sliderSelector || ".timeline-slider";

  const scopes = Array.from(document.querySelectorAll(scopeSelector));
  if (!scopes.length) return;

  function looksOpen(panel) {
    if (!panel) return false;
    const state = panel.dataset.state || panel.dataset.open;
    if (state === "open" || state === "true") return true;
    if (panel.classList.contains("is-open") || panel.classList.contains("w--open")) return true;

    const inlineHeight = parseFloat(panel.style.height || panel.style.maxHeight || "0");
    if (!Number.isNaN(inlineHeight) && inlineHeight > 4) return true;
    const inlineWidth = parseFloat(panel.style.width || panel.style.maxWidth || "0");
    if (!Number.isNaN(inlineWidth) && inlineWidth > 4) return true;
    const rect = panel.getBoundingClientRect();
    return rect.height > 4;
  }

  function triggerFooter(slideEl) {
    if (!slideEl) return;
    const footer = slideEl.querySelector(footerSelector);
    if (!footer) return;
    const trigger =
      footer.querySelector("button, [role='button'], [data-w-id], [data-trigger='card-footer']") || footer;
    trigger.dataset.singleOpenFired = "true";
    trigger.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  }

  scopes.forEach((scope) => {
    let suppress = false;

    function collectOpenSlides() {
      return Array.from(scope.querySelectorAll(cardSelector)).filter((slide) =>
        looksOpen(slide.querySelector(panelSelector))
      );
    }

    function closeSlides(slides) {
      if (!slides.length) return;
      suppress = true;
      slides.forEach(triggerFooter);
      requestAnimationFrame(() => {
        suppress = false;
      });
    }

    function enforceSingleOpen(activeSlide) {
      const openSlides = collectOpenSlides();
      const others = openSlides.filter((slide) => slide !== activeSlide);
      closeSlides(others);
    }

    scope.addEventListener(
      "click",
      (event) => {
        if (suppress) return;

        const navBtn = event.target.closest(navSelector);
        if (navBtn && scope.contains(navBtn)) {
          closeSlides(collectOpenSlides());
          return;
        }

        const footer = event.target.closest(footerSelector);
        if (!footer || !scope.contains(footer)) return;
        const slide = footer.closest(cardSelector);
        if (!slide) return;
        const trigger =
          footer.querySelector("button, [role='button'], [data-w-id], [data-trigger='card-footer']") || footer;
        if (trigger.dataset.singleOpenFired === "true") {
          delete trigger.dataset.singleOpenFired;
          return;
        }
        requestAnimationFrame(() => enforceSingleOpen(slide));
      },
      true
    );

    scope.querySelectorAll(sliderSelector).forEach((slider) => {
      let activePointer = null;

      const pointerStart = (event) => {
        if (suppress) return;
        const isTouchStart = event.type === "touchstart";
        const pointerType = isTouchStart ? "touch" : event.pointerType;
        if (pointerType && pointerType !== "touch") return;
        activePointer = {
          id: isTouchStart ? "touch" : event.pointerId,
          skip: !!event.target.closest(footerSelector),
        };
      };

      const pointerEnd = () => {
        if (suppress || !activePointer || activePointer.skip) {
          activePointer = null;
          return;
        }
        closeSlides(collectOpenSlides());
        activePointer = null;
      };

      slider.addEventListener("pointerdown", pointerStart, { passive: true });
      slider.addEventListener("touchstart", pointerStart, { passive: true });
      slider.addEventListener("pointerup", pointerEnd, { passive: true });
      slider.addEventListener("pointercancel", pointerEnd, { passive: true });
      slider.addEventListener(
        "touchend",
        () => {
          pointerEnd();
        },
        { passive: true }
      );
      slider.addEventListener(
        "touchcancel",
        () => {
          pointerEnd();
        },
        { passive: true }
      );
    });
  });
})();
