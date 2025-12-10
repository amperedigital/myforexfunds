/*
 * Timeline Tabs: keep only one card expanded at a time while relying on Webflow's
 * built-in interactions (so icon rotation/states stay in sync).
 *
 * Usage:
 *   1. Drop this script into the same page as your timeline tabs / card slider.
 *   2. Make sure the markup follows the structure shown in `timeline-tabs` inside `mff-story.html`.
 *   3. If your classes differ, update the selectors below before embedding.
 */
(function timelineTabsSingleCard(scopeSelector = ".timeline-tabs") {
  const scopes = document.querySelectorAll(scopeSelector);
  if (!scopes.length) return;

  const cardSelector = ".timeline-slide-card, .hero-card-slide";
  const panelSelector = ".timeline-card-list-wrapper, .hero-card-list-wrapper";
  const footerSelector = ".timeline-card-footer, .hero-card-footer";
  const navSelector =
    ".w-slider-arrow-left, .w-slider-arrow-right, .w-slider-dot, .swiper-button-next, .swiper-button-prev, .swiper-pagination-bullet";
  const sliderSelector = ".timeline-slider";

  function looksOpen(panel) {
    if (!panel) return false;
    const state = panel.dataset.state || panel.dataset.open;
    if (state === "open" || state === "true") return true;
    if (panel.classList.contains("is-open") || panel.classList.contains("w--open")) return true;

    const inlineHeight = parseFloat(panel.style.height || panel.style.maxHeight || "0");
    if (!Number.isNaN(inlineHeight) && inlineHeight > 4) return true;

    const rect = panel.getBoundingClientRect();
    return rect.height > 4;
  }

  function triggerFooter(slideEl) {
    if (!slideEl) return;
    const footer = slideEl.querySelector(footerSelector);
    if (!footer) return;
    const trigger =
      footer.querySelector("button, [role='button'], [data-w-id], [data-trigger='card-footer']") || footer;
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
