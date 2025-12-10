/**
 * GSAP Vertical Scroller
 * Smooth vertical slide navigation powered by GSAP with wheel, touch, and key controls.
 *
 * Usage:
 * <section data-vertical-scroll data-scroll-ease="power3.out">
 *   <div data-scroll-track>
 *     <article data-scroll-slide>Slide 1</article>
 *     <article data-scroll-slide>Slide 2</article>
 *   </div>
 *   <button data-scroll-prev>Prev</button>
 *   <button data-scroll-next>Next</button>
 *   <button data-scroll-to="0">1</button>
 * </section>
 *
 * Data attributes:
 *   data-scroll-duration="0.85"   // seconds or "850ms"
 *   data-scroll-ease="power2.out"
 *   data-scroll-loop="true|false"
 *   data-scroll-wheel="false"
 *   data-scroll-touch="false"
 *   data-scroll-keys="false"
 *   data-scroll-slide-height="100vh"
 *   data-scroll-track=".selector"
 *   data-scroll-slide=".selector"
 *
 * Emits `verticalscroll:change` with `{ index, slide }`.
 */
(function initGsapVerticalScroller() {
  const BASE_SCOPE = "[data-vertical-scroll]";
  const DEFAULT_TRACK = "[data-scroll-track]";
  const DEFAULT_SLIDE = "[data-scroll-slide]";
  const NEXT_SELECTOR = "[data-scroll-next]";
  const PREV_SELECTOR = "[data-scroll-prev]";
  const TO_SELECTOR = "[data-scroll-to]";
  const WAIT_INTERVAL = 150;
  const STYLE_ID = "gsap-vertical-scroll-base";

  const prefersReduce =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function injectBaseStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
${BASE_SCOPE} {
  position: relative !important;
  width: 100% !important;
  max-width: 100% !important;
  overflow: hidden !important;
  touch-action: none !important;
}
${BASE_SCOPE} ${DEFAULT_TRACK},
${BASE_SCOPE} .vertical-scroll-track {
  position: relative !important;
  display: flex !important;
  flex-direction: column !important;
  padding: 0 !important;
  margin: 0 !important;
  gap: 0 !important;
  width: 100% !important;
  will-change: transform !important;
}
${BASE_SCOPE} ${DEFAULT_SLIDE},
${BASE_SCOPE} .vertical-slide {
  flex: 0 0 auto !important;
  width: 100% !important;
}
`;
    document.head.appendChild(style);
  }

  function queryScopes() {
    return Array.from(document.querySelectorAll(BASE_SCOPE));
  }

  function enableNativeScroll(scopes) {
    injectBaseStyles();
    scopes.forEach((scope) => {
      if (scope.__verticalScrollInit) return;
      scope.style.setProperty("overflow-y", "auto", "important");
      scope.style.setProperty("overflow-x", "auto", "important");
      scope.style.setProperty("overflow", "auto", "important");
      scope.style.touchAction = scope.style.touchAction || "pan-y";
    });
  }

  function initScopes(scopes) {
    const gsap = window.gsap;
    if (!gsap) return;

    scopes.forEach((scope) => {
      if (scope.__verticalScrollInit) return;
      scope.__verticalScrollInit = true;

      const dataset = scope.dataset;
      const trackSelector = dataset.scrollTrack || DEFAULT_TRACK;
      const slideSelector = dataset.scrollSlide || DEFAULT_SLIDE;

      const track = scope.matches(trackSelector)
        ? scope
        : scope.querySelector(trackSelector) || scope.querySelector(".vertical-scroll-track");
      if (!track) return;

      const slides = Array.from(track.querySelectorAll(slideSelector));
      if (slides.length < 2) return;

      const respectMotionPreference = dataset.scrollRespectMotion !== "false";

      if (prefersReduce && respectMotionPreference) {
        scope.style.overflowY = scope.style.overflowY || "auto";
        return;
      }

      const declaredSlideHeight = dataset.scrollSlideHeight || "";
      const hasFixedSlideHeight = Boolean(declaredSlideHeight);
      const shouldCloak = dataset.scrollCloak !== "false";
      const ease = dataset.scrollEase || "power2.out";
      const duration = normalizeDuration(dataset.scrollDuration, 0.85);
      const loopSlides = dataset.scrollLoop === "true";
      const wheelEnabled = dataset.scrollWheel !== "false";
      const wheelLock = dataset.scrollLock === "true";
      const touchEnabled = dataset.scrollTouch !== "false";
      const keysEnabled = dataset.scrollKeys !== "false";
      const wheelThreshold = toNumber(dataset.scrollWheelThreshold, 10);
      const swipeThreshold = toNumber(dataset.scrollSwipeThreshold, 50);

      let storedVisibility = "";
      let storedOpacity = "";
      if (shouldCloak) {
        storedVisibility = scope.style.visibility || "";
        storedOpacity = scope.style.opacity || "";
        scope.style.visibility = "hidden";
        scope.style.opacity = "0";
      }

      function revealScope() {
        if (!shouldCloak || scope.__scrollCloakRevealed) return;
        scope.__scrollCloakRevealed = true;
        if (storedVisibility) scope.style.visibility = storedVisibility;
        else scope.style.removeProperty("visibility");
        if (storedOpacity) scope.style.opacity = storedOpacity;
        else scope.style.removeProperty("opacity");
      }

      function applyScopeState() {
        scope.style.setProperty("width", "100%", "important");
        scope.style.setProperty("max-width", "100%", "important");
        scope.style.setProperty("position", "relative", "important");
        scope.style.setProperty("display", "block", "important");
        scope.style.setProperty("overflow", "hidden", "important");
        scope.style.setProperty("touch-action", "none", "important");
      }
      applyScopeState();
      const scopeWatcher = new MutationObserver((mutations) => {
        const needsUpdate = mutations.some((mutation) => mutation.attributeName === "style");
        if (needsUpdate) {
          applyScopeState();
        }
      });
      scopeWatcher.observe(scope, { attributes: true, attributeFilter: ["style"] });

      if (!scope.hasAttribute("tabindex")) scope.tabIndex = 0;

      function applyTrackState() {
        track.style.setProperty("position", "relative", "important");
        track.style.setProperty("display", "flex", "important");
        track.style.setProperty("flex-direction", "column", "important");
        track.style.setProperty("width", "100%", "important");
        track.style.setProperty("padding", "0", "important");
        track.style.setProperty("margin", "0", "important");
        track.style.setProperty("gap", "0", "important");
        track.style.setProperty("grid-column-gap", "0", "important");
        track.style.setProperty("grid-row-gap", "0", "important");
        track.style.setProperty("pointer-events", "auto", "important");
        track.style.setProperty("will-change", "transform");
        if (!track.style.transform) {
          track.style.transform = "translate3d(0, 0, 0)";
        }
      }
      applyTrackState();
      const trackWatcher = new MutationObserver((mutations) => {
        const needsUpdate = mutations.some((mutation) => mutation.attributeName === "style");
        if (needsUpdate) {
          applyTrackState();
        }
      });
      trackWatcher.observe(track, { attributes: true, attributeFilter: ["style"] });

      slides.forEach((slide) => {
        slide.style.setProperty("flex", "0 0 auto", "important");
        slide.style.setProperty("width", "100%", "important");
        if (hasFixedSlideHeight && declaredSlideHeight) {
          slide.style.setProperty("min-height", declaredSlideHeight, "important");
          slide.style.setProperty("height", declaredSlideHeight, "important");
        }
      });

      let slideOffsets = [];
      let slideHeights = [];
      let metricsDirty = true;
      let dynamicSlideHeight = hasFixedSlideHeight ? declaredSlideHeight : "";

      function markMetricsDirty() {
        metricsDirty = true;
      }

      function applyDynamicSlideSize(value) {
        if (hasFixedSlideHeight) return;
        if (!value || dynamicSlideHeight === value) return;
        dynamicSlideHeight = value;
        slides.forEach((slide) => {
          slide.style.setProperty("min-height", value, "important");
          slide.style.setProperty("height", value, "important");
        });
      }

      function measureSlides() {
        metricsDirty = false;
        let running = 0;
        let maxHeight = 0;
        slideOffsets = [];
        slideHeights = [];
        const baseOffset = slides[0]?.offsetTop || 0;
        slides.forEach((slide, index) => {
          const rect = slide.getBoundingClientRect();
          let height = rect.height || slide.offsetHeight || slide.scrollHeight || 0;
          if (window.getComputedStyle) {
            const computed = window.getComputedStyle(slide);
            const marginTop = parseFloat(computed.marginTop) || 0;
            const marginBottom = parseFloat(computed.marginBottom) || 0;
            height += marginTop + marginBottom;
          }
          const offset = slide.offsetTop - baseOffset;
          slideOffsets[index] = offset;
          slideHeights[index] = height;
          running += height;
          if (height > maxHeight) maxHeight = height;
        });
        if (!running) {
          running =
            slides[0]?.getBoundingClientRect().height ||
            slides[0]?.offsetHeight ||
            scope.getBoundingClientRect().height ||
            scope.offsetHeight ||
            0;
        }
        const targetHeight = hasFixedSlideHeight
          ? declaredSlideHeight
          : maxHeight > 0
          ? `${maxHeight}px`
          : `${running}px`;
        scope.style.setProperty("height", targetHeight, "important");
        scope.style.setProperty("min-height", targetHeight, "important");
        applyDynamicSlideSize(targetHeight);
      }

      function ensureMetrics() {
        if (metricsDirty) {
          measureSlides();
        }
      }

      function getTargetOffset(index) {
        ensureMetrics();
        return slideOffsets[index] || 0;
      }

      let activeIndex = clampIndex(dataset.scrollStartIndex, slides.length - 1);
      const slideResizeObserver =
        "ResizeObserver" in window
          ? new ResizeObserver(() => {
              markMetricsDirty();
              ensureMetrics();
              gsap.set(track, { y: -getTargetOffset(activeIndex) });
            })
          : null;
      if (slideResizeObserver) {
        slides.forEach((slide) => slideResizeObserver.observe(slide));
      } else {
        window.addEventListener("load", () => {
          markMetricsDirty();
          ensureMetrics();
          gsap.set(track, { y: -getTargetOffset(activeIndex) });
        });
      }
      let pendingTween = null;
      let isAnimating = false;
      let isHovered = false;
      const autoplayAttr = dataset.scrollAutoplay;
      const autoplayInterval =
        autoplayAttr === "true"
          ? 4000
          : autoplayAttr === "false"
          ? 0
          : toNumber(autoplayAttr, 0);
      const autoplayDirection = dataset.scrollAutoplayDirection === "reverse" ? -1 : 1;
      const autoplayStartDelayRaw = dataset.scrollDelay;
      const initialAutoplayDelay = toNumber(
        autoplayStartDelayRaw === undefined ? null : autoplayStartDelayRaw,
        null
      );
      let pendingStartDelay = Number.isFinite(initialAutoplayDelay) ? initialAutoplayDelay : null;
      let autoplayTimer = null;

      const emitChange = () => {
        scope.dispatchEvent(
          new CustomEvent("verticalscroll:change", {
            detail: { index: activeIndex, slide: slides[activeIndex] },
          })
        );
        scheduleAutoplay();
        revealScope();
      };

      function clearAutoplay() {
        if (!autoplayTimer) return;
        clearTimeout(autoplayTimer);
        autoplayTimer = null;
      }

      function scheduleAutoplay(requestedDelay) {
        if (!autoplayInterval || isHovered) return;
        clearAutoplay();
        const delay = Number.isFinite(requestedDelay)
          ? requestedDelay
          : pendingStartDelay ?? autoplayInterval;
        pendingStartDelay = null;
        autoplayTimer = setTimeout(() => {
          goRelative(autoplayDirection);
        }, delay);
      }

      function updateActiveState() {
        slides.forEach((slide, index) => {
          const isActive = index === activeIndex;
          slide.classList.toggle("is-active", isActive);
          slide.toggleAttribute("data-slide-active", isActive);
        });

        scope.querySelectorAll(TO_SELECTOR).forEach((btn) => {
          if (btn.closest(BASE_SCOPE) !== scope) return;
          const targetIndex = clampIndex(btn.dataset.scrollTo, slides.length - 1);
          const match = targetIndex === activeIndex;
          btn.classList.toggle("is-active", match);
          btn.setAttribute("aria-pressed", match ? "true" : "false");
        });
      }

      function indexToUse(index) {
        const total = slides.length;
        let target = typeof index === "number" ? index : parseInt(index, 10);
        if (!Number.isFinite(target)) target = 0;
        if (loopSlides) {
          target = ((target % total) + total) % total;
          return target;
        }
        return Math.min(Math.max(0, target), total - 1);
      }

      function setImmediate(index) {
        const target = indexToUse(index);
        ensureMetrics();
        const offset = getTargetOffset(target);
        activeIndex = target;
        gsap.set(track, { y: -offset });
        updateActiveState();
        emitChange();
      }

      function goTo(index, opts = {}) {
        const { immediate = false } = opts;
        const target = indexToUse(index);

        if (target === activeIndex && !immediate) return false;
        clearAutoplay();

        ensureMetrics();
        const distance = Math.abs(target - activeIndex) || 1;
        const targetOffset = getTargetOffset(target);
        activeIndex = target;
        updateActiveState();

        if (pendingTween) {
          pendingTween.kill();
          pendingTween = null;
        }

        if (immediate || duration === 0) {
        gsap.set(track, { y: -targetOffset });
        emitChange();
        isAnimating = false;
        return true;
      }

      isAnimating = true;
      pendingTween = gsap.to(track, {
        y: -targetOffset,
        duration: Math.min(duration * distance, duration * 1.5),
        ease,
        onComplete: () => {
          isAnimating = false;
          pendingTween = null;
          emitChange();
        },
      });

        return true;
      }

      function goRelative(delta) {
        if (!delta) return false;
        return goTo(activeIndex + delta);
      }

      function maybeLockWheel(event) {
        if (!wheelLock || !event || !event.cancelable) return;
        if (!scope.contains(event.target)) return;
        event.preventDefault();
      }

      function handleWheel(event) {
        if (!scope.contains(event.target)) return;
        if (!wheelEnabled || isAnimating) {
          maybeLockWheel(event);
          return;
        }
        if (Math.abs(event.deltaY) < wheelThreshold) {
          maybeLockWheel(event);
          return;
        }
        clearAutoplay();
        const moved = goRelative(event.deltaY > 0 ? 1 : -1);
        if (moved) event.preventDefault();
        else maybeLockWheel(event);
      }

      const supportsPointer = "PointerEvent" in window;
      let pointerActive = false;
      let pointerStartY = 0;
      let pointerStartX = 0;
      let pointerId = null;

      function pointerDown(event) {
        if (!touchEnabled || isAnimating) return;
        if (supportsPointer) {
          if (event.pointerType && event.pointerType !== "touch") return;
          pointerId = event.pointerId;
          pointerStartY = event.clientY;
          pointerStartX = event.clientX;
        } else if (event.touches && event.touches.length) {
          const first = event.touches[0];
          pointerId = first.identifier;
          pointerStartY = first.clientY;
          pointerStartX = first.clientX;
        } else {
          return;
        }
        pointerActive = true;
        clearAutoplay();
      }

      function pointerUp(event) {
        if (!pointerActive) return;
        let point = null;
        if (supportsPointer) {
          if (event.pointerId !== pointerId) return;
          point = event;
        } else if (event.changedTouches && event.changedTouches.length) {
          point = findTouch(event.changedTouches, pointerId) || event.changedTouches[0];
        }
        pointerActive = false;
        pointerId = null;
        if (!point) return;
        const deltaY = point.clientY - pointerStartY;
        const deltaX = point.clientX - pointerStartX;
        if (Math.abs(deltaY) < swipeThreshold || Math.abs(deltaY) < Math.abs(deltaX)) return;
        const moved = goRelative(deltaY < 0 ? 1 : -1);
        if (moved && event.cancelable) event.preventDefault();
      }

      function pointerMove(event) {
        if (!pointerActive) return;
        let point = null;
        if (supportsPointer) {
          if (event.pointerId !== pointerId) return;
          point = event;
        } else if (event.touches && event.touches.length) {
          point = findTouch(event.touches, pointerId) || event.touches[0];
        }
        if (!point) return;
        const deltaY = Math.abs(point.clientY - pointerStartY);
        const deltaX = Math.abs(point.clientX - pointerStartX);
        if (deltaY > deltaX && event.cancelable) event.preventDefault();
      }

      function handleKeydown(event) {
        if (!keysEnabled || isAnimating) return;
        if (!scope.contains(event.target)) return;
        if (event.key === "ArrowDown" || event.key === "PageDown") {
          clearAutoplay();
          const moved = goRelative(1);
          if (moved) event.preventDefault();
        } else if (event.key === "ArrowUp" || event.key === "PageUp") {
          clearAutoplay();
          const moved = goRelative(-1);
          if (moved) event.preventDefault();
        }
      }

      scope.addEventListener("mouseenter", () => {
        isHovered = true;
        clearAutoplay();
      });
      scope.addEventListener("mouseleave", () => {
        isHovered = false;
        scheduleAutoplay();
      });

      function resolveButtonTarget(btn, attrName) {
        const direct = btn.closest(BASE_SCOPE);
        if (direct) return direct;
        const explicit =
          btn.getAttribute("data-scroll-target") ||
          btn.getAttribute(attrName) ||
          btn.getAttribute("aria-controls") ||
          btn.getAttribute("href") ||
          "";
        const selector = explicit.trim();
        if (selector.startsWith("#")) {
          return document.querySelector(selector);
        }
        return false;
      }

      const externalButtons = new Set();

      function attachExternalButton(btn, type, payload) {
        if (externalButtons.has(btn)) return;
        externalButtons.add(btn);
        btn.addEventListener("click", (event) => {
          const resolvedTarget = resolveButtonTarget(btn, type);
          if (resolvedTarget && resolvedTarget !== scope) return;
          event.preventDefault();
          clearAutoplay();
          if (type === "data-scroll-next") {
            goRelative(payload || 1);
          } else if (type === "data-scroll-prev") {
            goRelative(payload || -1);
          } else {
            goTo(payload);
          }
        });
      }

      Array.from(document.querySelectorAll(NEXT_SELECTOR)).forEach((btn) => {
        const target = resolveButtonTarget(btn, "data-scroll-next");
        if (target && target !== scope) return;
        attachExternalButton(btn, "data-scroll-next", 1);
      });
      Array.from(document.querySelectorAll(PREV_SELECTOR)).forEach((btn) => {
        const target = resolveButtonTarget(btn, "data-scroll-prev");
        if (target && target !== scope) return;
        attachExternalButton(btn, "data-scroll-prev", -1);
      });
      Array.from(document.querySelectorAll(TO_SELECTOR)).forEach((btn) => {
        const target = resolveButtonTarget(btn, "data-scroll-to");
        if (target && target !== scope) return;
        const targetIndex = clampIndex(btn.dataset.scrollTo, slides.length - 1);
        if (!Number.isFinite(targetIndex)) return;
        attachExternalButton(btn, "data-scroll-to", targetIndex);
      });
      scope.addEventListener(
        "click",
        (event) => {
          const nextBtn = event.target.closest(NEXT_SELECTOR);
          if (nextBtn && resolveButtonTarget(nextBtn, "data-scroll-next") === scope) {
            event.preventDefault();
            clearAutoplay();
            goRelative(1);
            return;
          }
          const prevBtn = event.target.closest(PREV_SELECTOR);
          if (prevBtn && resolveButtonTarget(prevBtn, "data-scroll-prev") === scope) {
            event.preventDefault();
            clearAutoplay();
            goRelative(-1);
            return;
          }
          const toBtn = event.target.closest(TO_SELECTOR);
          if (toBtn && resolveButtonTarget(toBtn, "data-scroll-to") === scope) {
            event.preventDefault();
            const targetIndex = clampIndex(toBtn.dataset.scrollTo, slides.length - 1);
            if (Number.isFinite(targetIndex)) {
              clearAutoplay();
              goTo(targetIndex);
            }
          }
        },
        true
      );
      scope.addEventListener("verticalscroll:go", (event) => {
        const detail = event.detail || {};
        if (typeof detail.index === "number") {
          goTo(detail.index);
        } else if (typeof detail.delta === "number") {
          goRelative(detail.delta);
        }
      });

      if (wheelEnabled) scope.addEventListener("wheel", handleWheel, { passive: false });
      if (touchEnabled) {
        if (supportsPointer) {
          scope.addEventListener("pointerdown", pointerDown, { passive: true });
          scope.addEventListener("pointermove", pointerMove, { passive: false });
          scope.addEventListener("pointerup", pointerUp, { passive: true });
          scope.addEventListener("pointercancel", pointerUp, { passive: true });
        } else {
          scope.addEventListener("touchstart", pointerDown, { passive: true });
          scope.addEventListener("touchmove", pointerMove, { passive: false });
          scope.addEventListener("touchend", pointerUp, { passive: true });
          scope.addEventListener("touchcancel", pointerUp, { passive: true });
        }
      }
      if (keysEnabled) scope.addEventListener("keydown", handleKeydown);

      window.addEventListener("resize", () => {
        markMetricsDirty();
        ensureMetrics();
        gsap.set(track, { y: -getTargetOffset(activeIndex) });
      });

      setImmediate(activeIndex);
    });
  }

  function waitForGsap() {
    const scopes = queryScopes();
    if (!scopes.length) return;

    if (window.gsap) {
      initScopes(scopes);
      return;
    }

    setTimeout(waitForGsap, WAIT_INTERVAL);
  }

  function bootWhenReady() {
    if (document.readyState === "complete" || document.readyState === "interactive") {
      waitForGsap();
    } else {
      document.addEventListener(
        "DOMContentLoaded",
        () => {
          waitForGsap();
        },
        { once: true }
      );
    }
  }

  bootWhenReady();

  function clampIndex(value, maxIndex) {
    const num = parseInt(value, 10);
    if (!Number.isFinite(num)) return 0;
    return Math.min(Math.max(0, num), maxIndex);
  }

  function toNumber(value, fallback) {
    if (value == null) return fallback;
    const num = parseFloat(value);
    return Number.isFinite(num) ? num : fallback;
  }

  function normalizeDuration(value, fallbackSeconds) {
    if (!value) return fallbackSeconds;
    const raw = String(value).trim();
    if (!raw) return fallbackSeconds;
    if (raw.endsWith("ms")) {
      const parsed = parseFloat(raw.replace(/ms$/, ""));
      return Number.isFinite(parsed) ? parsed / 1000 : fallbackSeconds;
    }
    const parsed = parseFloat(raw);
    return Number.isFinite(parsed) ? parsed : fallbackSeconds;
  }

  function findTouch(list, identifier) {
    if (!list) return null;
    for (let i = 0; i < list.length; i += 1) {
      if (list[i].identifier === identifier) return list[i];
    }
    return null;
  }
})();
