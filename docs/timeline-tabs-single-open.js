/**
 * Timeline Tabs helper
 * Ensures only one card/panel stays open inside Swiper-powered timelines.
 * Relies on Webflow interactions by dispatching click events on the card footers.
 */
(function timelineTabsSingleOpen() {
  const sliderSelector = ".timeline-slider, .hero-card-slider, [data-single-open-slider]";
  const slideSelector = ".hero-card-slide, .timeline-slide-card";
  const panelSelector = ".hero-card-list-wrapper, .timeline-card-list-wrapper";
  const footerSelector = ".hero-card-footer, .timeline-card-footer";
  const slideTriggerSelector =
    ".hero-card-slide, .timeline-slide-card, [data-card-trigger], [data-slide-trigger]";
  const navSelector =
    ".swiper-button-prev, .swiper-button-next, .swiper-pagination-bullet, .w-slider-arrow-left, .w-slider-arrow-right, .w-slider-dot, [data-scroll-prev], [data-scroll-next]";

  const managedSliders = new WeakSet();
  const sliderObservers = new WeakMap();
  const closingSlides = new WeakSet();

  function looksOpen(panel) {
    if (!panel) return false;

    const state = panel.dataset.state || panel.dataset.open;
    if (state === "open" || state === "true") return true;

    const ariaExpanded = panel.getAttribute("aria-expanded");
    if (ariaExpanded === "true") return true;
    const ariaHidden = panel.getAttribute("aria-hidden");
    if (ariaHidden === "false") return true;

    if (
      panel.classList.contains("is-open") ||
      panel.classList.contains("w--open") ||
      panel.classList.contains("is-active")
    ) {
      return true;
    }

    const inlineHeight = parseFloat(panel.style.height || panel.style.maxHeight || "0");
    if (!Number.isNaN(inlineHeight) && inlineHeight > 4) return true;

    if (panel.style.width) {
      const inlineWidth = parseFloat(panel.style.width);
      if (!Number.isNaN(inlineWidth) && inlineWidth > 4) return true;
    }

    const rect = panel.getBoundingClientRect();
    return rect.height > 4;
  }

  function getSlides(slider) {
    return slider ? Array.from(slider.querySelectorAll(slideSelector)) : [];
  }

  function collectOpenSlides(slider) {
    return getSlides(slider).filter((slide) => looksOpen(slide.querySelector(panelSelector)));
  }

  function triggerFooter(slide) {
    if (!slide || closingSlides.has(slide)) return false;
    const footer = slide.querySelector(footerSelector);
    if (!footer) return false;
    let trigger = footer.querySelector("button, [role='button'], [data-w-id], [data-trigger='card-footer']");
    if (!trigger) trigger = footer;
    closingSlides.add(slide);
    trigger.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    requestAnimationFrame(() => closingSlides.delete(slide));
    return true;
  }

  function enforceSingle(slider, options = {}) {
    if (!slider) return false;
    const { keep = null, closeAll = false } = options;
    const openSlides = collectOpenSlides(slider);
    if (!openSlides.length) return false;

    let keepSlide = null;
    if (keep && !closeAll) {
      keepSlide = keep;
    } else if (!closeAll) {
      if (openSlides.length === 1) {
        keepSlide = openSlides[0];
      } else {
        keepSlide = openSlides[openSlides.length - 1];
      }
    }

    let changed = false;
    openSlides.forEach((slide) => {
      if (keepSlide && slide === keepSlide) return;
      if (triggerFooter(slide)) changed = true;
    });
    return changed;
  }

  function findSliderFrom(element) {
    return element?.closest(sliderSelector) || null;
  }

  function resolveSliderFromNav(button) {
    if (!button) return null;
    return (
      findSliderFrom(button) ||
      (button.dataset.scrollTarget && document.querySelector(button.dataset.scrollTarget)) ||
      button.closest(".timeline-tabs, [data-single-open-scope]")?.querySelector(sliderSelector)
    );
  }

  function handleToggleClick(event) {
    if (event.target.closest(panelSelector)) return;

    const toggle = event.target.closest(`${footerSelector}, ${slideTriggerSelector}`);
    if (!toggle) return;

    const slider = findSliderFrom(toggle);
    if (!slider) return;
    const slide = toggle.closest(slideSelector);
    if (!slide || closingSlides.has(slide)) return;
    requestAnimationFrame(() => enforceSingle(slider, { keep: slide }));
  }

  function handleNavClick(event) {
    const navBtn = event.target.closest(navSelector);
    if (!navBtn) return;
    const slider = resolveSliderFromNav(navBtn);
    if (!slider) return;
    enforceSingle(slider, { closeAll: true });
  }

  function attachSlider(slider) {
    if (!slider || managedSliders.has(slider)) return;
    managedSliders.add(slider);

    let pointerActive = false;

    const pointerStart = (event) => {
      if (event.target.closest(footerSelector)) {
        pointerActive = false;
        return;
      }
      pointerActive = true;
    };

    const pointerEnd = () => {
      if (!pointerActive) return;
      pointerActive = false;
      enforceSingle(slider, { closeAll: true });
    };

    slider.addEventListener("pointerdown", pointerStart, { passive: true });
    slider.addEventListener("touchstart", pointerStart, { passive: true });
    slider.addEventListener("pointerup", pointerEnd, { passive: true });
    slider.addEventListener("pointercancel", pointerEnd, { passive: true });
    slider.addEventListener("touchend", pointerEnd, { passive: true });
    slider.addEventListener("touchcancel", pointerEnd, { passive: true });

    if (window.MutationObserver) {
      let pending = false;
      const observer = new MutationObserver(() => {
        if (pending || !document.body.contains(slider)) return;
        pending = true;
        requestAnimationFrame(() => {
          pending = false;
          enforceSingle(slider);
        });
      });
      observer.observe(slider, {
        subtree: true,
        attributes: true,
        attributeFilter: ["style", "class", "data-state", "data-open", "aria-expanded", "aria-hidden"],
      });
      sliderObservers.set(slider, observer);
    }
  }

  function initSliders() {
    document.querySelectorAll(sliderSelector).forEach(attachSlider);
  }

  document.addEventListener("click", handleToggleClick, true);
  document.addEventListener("click", handleNavClick, true);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSliders, { once: true });
  } else {
    initSliders();
  }

  if (window.MutationObserver) {
    const docObserver = new MutationObserver(initSliders);
    docObserver.observe(document.documentElement, { childList: true, subtree: true });
  }
})();
