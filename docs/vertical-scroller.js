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

  const prefersReduce =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function queryScopes() {
    return Array.from(document.querySelectorAll(BASE_SCOPE));
  }

  function enableNativeScroll(scopes) {
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

      if (prefersReduce) {
        scope.style.overflowY = scope.style.overflowY || "auto";
        return;
      }

      const slideHeight = dataset.scrollSlideHeight || "100vh";
      const ease = dataset.scrollEase || "power2.out";
      const duration = normalizeDuration(dataset.scrollDuration, 0.85);
      const loopSlides = dataset.scrollLoop === "true";
      const wheelEnabled = dataset.scrollWheel !== "false";
      const touchEnabled = dataset.scrollTouch !== "false";
      const keysEnabled = dataset.scrollKeys !== "false";
      const wheelThreshold = toNumber(dataset.scrollWheelThreshold, 10);
      const swipeThreshold = toNumber(dataset.scrollSwipeThreshold, 50);

      function applyScopeState() {
        scope.style.setProperty("overflow-y", "hidden", "important");
        scope.style.setProperty("overflow-x", "hidden", "important");
        scope.style.setProperty("overflow", "hidden", "important");
        scope.style.setProperty("height", slideHeight, "important");
        scope.style.setProperty("max-height", slideHeight, "important");
        scope.style.setProperty("--vertical-scroll-slide-height", slideHeight);
      }
      applyScopeState();
      const scopeWatcher = new MutationObserver((mutations) => {
        const needsUpdate = mutations.some((mutation) => mutation.attributeName === "style");
        if (needsUpdate) {
          applyScopeState();
        }
      });
      scopeWatcher.observe(scope, { attributes: true, attributeFilter: ["style"] });

      scope.style.position = scope.style.position || "relative";
      scope.style.touchAction = scope.style.touchAction || "none";
      if (!scope.hasAttribute("tabindex")) scope.tabIndex = 0;

      function applyTrackState() {
        track.style.setProperty("display", "flex", "important");
        track.style.setProperty("flex-direction", "column", "important");
        track.style.setProperty("width", "100%", "important");
        track.style.setProperty("height", "100%", "important");
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
        slide.style.setProperty("flex", `0 0 ${slideHeight}`, "important");
        slide.style.setProperty("min-height", slideHeight, "important");
        slide.style.setProperty("height", slideHeight, "important");
        slide.style.setProperty("width", "100%", "important");
      });

      let activeIndex = clampIndex(dataset.scrollStartIndex, slides.length - 1);
      let pendingTween = null;
      let isAnimating = false;
      let isHovered = false;
      const autoplayInterval = toNumber(dataset.scrollAutoplay, 0);
      const autoplayDirection = dataset.scrollAutoplayDirection === "reverse" ? -1 : 1;
      let autoplayTimer = null;

      const emitChange = () => {
        scope.dispatchEvent(
          new CustomEvent("verticalscroll:change", {
            detail: { index: activeIndex, slide: slides[activeIndex] },
          })
        );
        scheduleAutoplay();
      };

      function clearAutoplay() {
        if (!autoplayTimer) return;
        clearTimeout(autoplayTimer);
        autoplayTimer = null;
      }

      function scheduleAutoplay() {
        if (!autoplayInterval || isHovered) return;
        clearAutoplay();
        autoplayTimer = setTimeout(() => {
          goRelative(autoplayDirection);
        }, autoplayInterval);
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
        activeIndex = target;
        gsap.set(track, { yPercent: -100 * target });
        updateActiveState();
        emitChange();
      }

      function goTo(index, opts = {}) {
        const { immediate = false } = opts;
        const target = indexToUse(index);

        if (target === activeIndex && !immediate) return false;
        clearAutoplay();

        const distance = Math.abs(target - activeIndex) || 1;
        activeIndex = target;
        updateActiveState();

        if (pendingTween) {
          pendingTween.kill();
          pendingTween = null;
        }

        if (immediate || duration === 0) {
          gsap.set(track, { yPercent: -100 * target });
          emitChange();
          isAnimating = false;
          return true;
        }

        isAnimating = true;
        pendingTween = gsap.to(track, {
          yPercent: -100 * target,
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

      function handleWheel(event) {
        if (!wheelEnabled || isAnimating) return;
        if (!scope.contains(event.target)) return;
        if (Math.abs(event.deltaY) < wheelThreshold) return;
        clearAutoplay();
        const moved = goRelative(event.deltaY > 0 ? 1 : -1);
        if (moved) event.preventDefault();
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
        gsap.set(track, { yPercent: -100 * activeIndex });
      });

      setImmediate(activeIndex);
      scheduleAutoplay();
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
