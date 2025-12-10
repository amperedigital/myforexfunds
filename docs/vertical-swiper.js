/**
 * Lightweight vertical slider that reuses the existing Webflow markup:
 * <section data-vertical-scroll>
 *   <div data-scroll-track>
 *     <article data-scroll-slide>...</article>
 *   </div>
 * </section>
 *
 * Supports: autoplay, hover pause, wheel (with optional lock), touch drag, keyboard.
 * Relies only on CSS transforms; no Swiper/GSAP required.
 */
(function initVerticalSlider() {
  const SCOPE_SELECTOR = "[data-vertical-scroll]";
  const TRACK_SELECTOR = "[data-scroll-track]";
  const SLIDE_SELECTOR = "[data-scroll-slide]";
  const NEXT_SELECTOR = "[data-scroll-next]";
  const PREV_SELECTOR = "[data-scroll-prev]";
  const TO_SELECTOR = "[data-scroll-to]";
  const WAIT_INTERVAL = 120;

  function clampIndex(index, max) {
    const num = Number.parseInt(index, 10);
    if (Number.isNaN(num)) return 0;
    return Math.max(0, Math.min(num, max));
  }

  function parseDuration(value, fallbackSeconds) {
    if (!value) return fallbackSeconds;
    const trimmed = String(value).trim();
    if (!trimmed) return fallbackSeconds;
    if (trimmed.endsWith("ms")) {
      const parsed = Number.parseFloat(trimmed.replace(/ms$/, ""));
      return Number.isFinite(parsed) ? parsed / 1000 : fallbackSeconds;
    }
    const parsed = Number.parseFloat(trimmed);
    return Number.isFinite(parsed) ? parsed : fallbackSeconds;
  }

  function toNumber(value, fallback) {
    if (value == null) return fallback;
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function initScope(scope) {
    if (scope.__verticalSliderInit) return;
    const dataset = scope.dataset || {};
    const track =
      scope.matches(TRACK_SELECTOR)
        ? scope
        : scope.querySelector(TRACK_SELECTOR) || scope.querySelector(".vertical-scroll-track");
    if (!track) return;

    const slides = Array.from(track.querySelectorAll(SLIDE_SELECTOR));
    if (slides.length < 2) return;

    scope.__verticalSliderInit = true;
    const prefersReduce =
      window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduce && dataset.scrollRespectMotion !== "false") {
      scope.style.overflowY = scope.style.overflowY || "auto";
      return;
    }

    const durationSeconds = parseDuration(dataset.scrollDuration, 0.85);
    const easing = dataset.scrollEase || "cubic-bezier(0.22, 0.61, 0.36, 1)";
    const loop = dataset.scrollLoop === "true";
    const wheelEnabled = dataset.scrollWheel !== "false";
    const lockWheel = dataset.scrollLock === "true";
    const touchEnabled = dataset.scrollTouch !== "false";
    const keysEnabled = dataset.scrollKeys !== "false";
    const autoplayAttr = dataset.scrollAutoplay;
    const autoplayDelay =
      autoplayAttr === "true"
        ? 4000
        : autoplayAttr === "false"
        ? 0
        : toNumber(autoplayAttr, 0);
    const autoplayDirection = dataset.scrollAutoplayDirection === "reverse" ? -1 : 1;
    const autoplayStartDelay = toNumber(dataset.scrollDelay, null);
    const wheelThreshold = toNumber(dataset.scrollWheelThreshold, 10);
    const swipeThreshold = toNumber(dataset.scrollSwipeThreshold, 50);
    const startIndex = clampIndex(dataset.scrollStartIndex, slides.length - 1);
    const isTouchDevice =
      "ontouchstart" in window ||
      (navigator && typeof navigator.maxTouchPoints === "number" && navigator.maxTouchPoints > 0);

    scope.style.position = "relative";
    scope.style.width = "100%";
    scope.style.maxWidth = "100%";
    scope.style.overflow = "hidden";
    scope.style.touchAction = "none";
    scope.style.willChange = "transform";

    track.style.position = "relative";
    track.style.width = "100%";
    track.style.display = "flex";
    track.style.flexDirection = "column";
    track.style.margin = "0";
    track.style.padding = "0";
    track.style.transform = "translate3d(0,0,0)";
    track.style.transitionProperty = "transform";

    slides.forEach((slide) => {
      slide.style.flex = "0 0 auto";
      slide.style.width = "100%";
    });

    let offsets = [];
    let heights = [];
    let tallest = 0;
    function measureSlides() {
      offsets = [];
      heights = [];
      let acc = 0;
      tallest = 0;
      slides.forEach((slide, index) => {
        const rect = slide.getBoundingClientRect();
        const h = rect.height || slide.offsetHeight || slide.scrollHeight || 0;
        offsets[index] = acc;
        heights[index] = h;
        acc += h;
        if (h > tallest) tallest = h;
      });
      const targetHeight = dataset.scrollSlideHeight || (tallest ? `${tallest}px` : "auto");
      scope.style.height = targetHeight;
      slides.forEach((slide) => {
        slide.style.minHeight = dataset.scrollSlideHeight ? dataset.scrollSlideHeight : `${tallest}px`;
      });
    }

    measureSlides();
    window.addEventListener("resize", () => {
      measureSlides();
      goTo(activeIndex, { immediate: true });
    });

    let activeIndex = startIndex;
    let isAnimating = false;
    let autoplayTimer = null;
    let pendingDelay = autoplayStartDelay;
    let isHovered = false;

    function setTrackTransform(offset, immediate = false) {
      if (immediate || durationSeconds === 0) {
        track.style.transitionDuration = "0ms";
        track.style.transform = `translate3d(0, ${-offset}px, 0)`;
        // force reflow then restore transition
        void track.offsetWidth;
        track.style.transitionDuration = `${durationSeconds * 1000}ms`;
        track.style.transitionTimingFunction = easing;
      } else {
        track.style.transitionDuration = `${durationSeconds * 1000}ms`;
        track.style.transitionTimingFunction = easing;
        track.style.transform = `translate3d(0, ${-offset}px, 0)`;
      }
    }

    function emitChange() {
      scope.dispatchEvent(
        new CustomEvent("verticalscroll:change", {
          detail: { index: activeIndex, slide: slides[activeIndex] },
        })
      );
    }

    function updateActiveState() {
      slides.forEach((slide, idx) => {
        const active = idx === activeIndex;
        slide.classList.toggle("is-active", active);
        slide.toggleAttribute("data-slide-active", active);
      });
      scope.querySelectorAll(TO_SELECTOR).forEach((btn) => {
        if (btn.closest(SCOPE_SELECTOR) !== scope) return;
        const target = clampIndex(btn.dataset.scrollTo, slides.length - 1);
        btn.classList.toggle("is-active", target === activeIndex);
      });
    }

    function goTo(index, options = {}) {
      const { immediate = false } = options;
      let target = index;
      if (loop) {
        target = ((target % slides.length) + slides.length) % slides.length;
      } else {
        target = clampIndex(target, slides.length - 1);
      }
      if (target === activeIndex && !immediate) return false;
      const offset = offsets[target] || 0;
      isAnimating = !immediate;
      setTrackTransform(offset, immediate);
      activeIndex = target;
      updateActiveState();
      emitChange();
      if (!immediate && durationSeconds > 0) {
        setTimeout(() => {
          isAnimating = false;
        }, durationSeconds * 1000);
      } else {
        isAnimating = false;
      }
      scheduleAutoplay();
      return true;
    }

    function goRelative(delta) {
      if (!delta) return false;
      return goTo(activeIndex + delta);
    }

    function clearAutoplay() {
      if (!autoplayTimer) return;
      clearTimeout(autoplayTimer);
      autoplayTimer = null;
    }

    function scheduleAutoplay(customDelay) {
      if (!autoplayDelay || isHovered) return;
      clearAutoplay();
      const delayToUse =
        typeof customDelay === "number"
          ? customDelay
          : pendingDelay != null
          ? pendingDelay
          : autoplayDelay;
      pendingDelay = null;
      autoplayTimer = setTimeout(() => {
        goRelative(autoplayDirection);
      }, delayToUse);
    }

    scope.addEventListener("mouseenter", () => {
      isHovered = true;
      clearAutoplay();
    });
    scope.addEventListener("mouseleave", () => {
      isHovered = false;
      scheduleAutoplay();
    });

    function handleWheel(event) {
      if (!scope.contains(event.target)) return;
      const absDelta = Math.abs(event.deltaY);
      if (lockWheel && event.cancelable) event.preventDefault();
      if (!wheelEnabled || isAnimating || absDelta < wheelThreshold) return;
      event.preventDefault();
      goRelative(event.deltaY > 0 ? 1 : -1);
    }

    if (wheelEnabled || lockWheel) {
      scope.addEventListener("wheel", handleWheel, { passive: false });
    }

    let pointerActive = false;
    let pointerStartY = 0;
    let pointerStartX = 0;

    function handlePointerDown(event) {
      if (!touchEnabled) return;
      pointerActive = true;
      const point = event.touches ? event.touches[0] : event;
      pointerStartY = point.clientY;
      pointerStartX = point.clientX;
    }

    function handlePointerMove(event) {
      if (!pointerActive) return;
      const point = event.touches ? event.touches[0] : event;
      const deltaY = Math.abs(point.clientY - pointerStartY);
      const deltaX = Math.abs(point.clientX - pointerStartX);
      if (deltaY > deltaX && event.cancelable) event.preventDefault();
    }

    function handlePointerUp(event) {
      if (!pointerActive) return;
      pointerActive = false;
      const point = event.changedTouches ? event.changedTouches[0] : event;
      const deltaY = point.clientY - pointerStartY;
      const deltaX = point.clientX - pointerStartX;
      if (Math.abs(deltaY) < swipeThreshold || Math.abs(deltaY) < Math.abs(deltaX)) return;
      goRelative(deltaY < 0 ? 1 : -1);
    }

    if (touchEnabled) {
      if ("PointerEvent" in window && !isTouchDevice) {
        scope.addEventListener("pointerdown", handlePointerDown, { passive: true });
        scope.addEventListener("pointermove", handlePointerMove, { passive: false });
        scope.addEventListener("pointerup", handlePointerUp, { passive: true });
        scope.addEventListener("pointercancel", handlePointerUp, { passive: true });
      } else {
        scope.addEventListener("touchstart", handlePointerDown, { passive: true });
        scope.addEventListener("touchmove", handlePointerMove, { passive: false });
        scope.addEventListener("touchend", handlePointerUp, { passive: true });
        scope.addEventListener("touchcancel", handlePointerUp, { passive: true });
      }
    }

    if (keysEnabled) {
      scope.addEventListener("keydown", (event) => {
        if (!scope.contains(event.target)) return;
        if (event.key === "ArrowDown" || event.key === "PageDown") {
          event.preventDefault();
          goRelative(1);
        } else if (event.key === "ArrowUp" || event.key === "PageUp") {
          event.preventDefault();
          goRelative(-1);
        }
      });
      if (!scope.hasAttribute("tabindex")) scope.tabIndex = 0;
    }

    function resolveButtonTarget(btn) {
      const target = btn.getAttribute("data-scroll-target") || btn.getAttribute("aria-controls");
      if (target && target.startsWith("#")) {
          const el = document.querySelector(target);
          if (el) return el;
      }
      return btn.closest(SCOPE_SELECTOR);
    }

    document.querySelectorAll(NEXT_SELECTOR).forEach((btn) => {
      const targetScope = resolveButtonTarget(btn);
      if (targetScope !== scope) return;
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        goRelative(1);
      });
    });

    document.querySelectorAll(PREV_SELECTOR).forEach((btn) => {
      const targetScope = resolveButtonTarget(btn);
      if (targetScope !== scope) return;
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        goRelative(-1);
      });
    });

    document.querySelectorAll(TO_SELECTOR).forEach((btn) => {
      const targetScope = resolveButtonTarget(btn);
      if (targetScope !== scope) return;
      const targetIndex = clampIndex(btn.dataset.scrollTo, slides.length - 1);
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        goTo(targetIndex);
      });
    });

    goTo(activeIndex, { immediate: true });
    if (autoplayDelay) {
      scheduleAutoplay(pendingDelay != null ? pendingDelay : autoplayDelay);
    }
  }

  function boot() {
    document.querySelectorAll(SCOPE_SELECTOR).forEach(initScope);
  }

  if (document.readyState === "complete" || document.readyState === "interactive") {
    boot();
  } else {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  }

  // Fallback boot if DOMContentLoaded fired before script loaded.
  setTimeout(() => {
    if (!document.querySelector(SCOPE_SELECTOR)?.__verticalSliderInit) {
      boot();
    }
  }, WAIT_INTERVAL);
})();
