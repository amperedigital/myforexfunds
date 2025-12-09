/**
 * GSAP Vertical Scroller
 * ======================
 * Turns any `[data-vertical-scroll]` wrapper into a wheel/touch driven
 * vertical slideshow with easing handled by GSAP.
 *
 * Markup structure (example):
 *
 * <section data-vertical-scroll data-scroll-ease="power3.out">
 *   <div class="vertical-scroll-track" data-scroll-track>
 *     <article class="vertical-slide" data-scroll-slide>...</article>
 *     <article class="vertical-slide" data-scroll-slide>...</article>
 *   </div>
 *   <button data-scroll-prev>Prev</button>
 *   <button data-scroll-next>Next</button>
 *   <button data-scroll-to="0">1</button>
 *   <button data-scroll-to="1">2</button>
 * </section>
 *
 * Data attributes on the scope:
 *   data-scroll-duration="0.85"  (seconds or "850ms")
 *   data-scroll-ease="power2.out"
 *   data-scroll-loop="true|false"
 *   data-scroll-wheel="false"    (disable wheel capture)
 *   data-scroll-touch="false"    (disable swipe)
 *   data-scroll-keys="false"     (disable arrow/PageUp/PageDown)
 *   data-scroll-slide-height="100vh" (sets flex-basis / min-height for slides)
 *   data-scroll-track=".my-track"    (custom track selector inside scope)
 *   data-scroll-slide=".my-slide"    (custom slide selector)
 *
 * Emits a `verticalscroll:change` event on the scope whenever the active slide changes.
 */
(function initGsapVerticalScroller() {
  const BASE_SCOPE = "[data-vertical-scroll]";
  const DEFAULT_TRACK = "[data-scroll-track]";
  const DEFAULT_SLIDE = "[data-scroll-slide]";
  const NEXT_SELECTOR = "[data-scroll-next]";
  const PREV_SELECTOR = "[data-scroll-prev]";
  const TO_SELECTOR = "[data-scroll-to]";

  const prefersReduce =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function initScroller() {
    const gsap = window.gsap;
    const scopes = Array.from(document.querySelectorAll(BASE_SCOPE));
    if (!scopes.length) return;

    if (!gsap) {
      scopes.forEach((scope) => {
        scope.style.overflowY = scope.style.overflowY || "auto";
        scope.style.touchAction = scope.style.touchAction || "pan-y";
      });
      return;
    }

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

      scope.style.overflow = scope.style.overflow || "hidden";
      scope.style.position = scope.style.position || "relative";
      scope.style.touchAction = scope.style.touchAction || "none";
      if (!scope.hasAttribute("tabindex")) scope.tabIndex = 0;
      if (!scope.style.height) scope.style.height = slideHeight;

      track.style.display = track.style.display || "flex";
      track.style.flexDirection = track.style.flexDirection || "column";
      track.style.willChange = track.style.willChange || "transform";
      track.style.transform = track.style.transform || "translate3d(0, 0, 0)";

      slides.forEach((slide) => {
        if (!slide.style.flex) slide.style.flex = `0 0 ${slideHeight}`;
        if (!slide.style.minHeight) slide.style.minHeight = slideHeight;
        if (!slide.style.width) slide.style.width = "100%";
      });

      let activeIndex = clampIndex(dataset.scrollStartIndex, slides.length - 1);
      let isAnimating = false;
      let pendingTween = null;

      const changeEvent = () =>
        scope.dispatchEvent(
          new CustomEvent("verticalscroll:change", {
            detail: { index: activeIndex, slide: slides[activeIndex] },
          })
        );

      function updateActiveState() {
        slides.forEach((slide, index) => {
          const isActive = index === activeIndex;
          slide.classList.toggle("is-active", isActive);
          slide.toggleAttribute("data-slide-active", isActive);
        });

        scope.querySelectorAll(TO_SELECTOR).forEach((btn) => {
          if (btn.closest(BASE_SCOPE) !== scope) return;
          const targetIndex = clampIndex(btn.dataset.scrollTo, slides.length - 1);
          const isMatch = targetIndex === activeIndex;
          btn.classList.toggle("is-active", isMatch);
          btn.setAttribute("aria-pressed", isMatch ? "true" : "false");
        });
      }

      function immediateSet(index) {
        const target = indexToUse(index);
        activeIndex = target;
        gsap.set(track, { yPercent: -100 * target });
        updateActiveState();
        changeEvent();
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

      function goTo(index, opts = {}) {
        const { immediate = false } = opts;
        const total = slides.length;
        let target = indexToUse(index);

        if (target === activeIndex && !immediate) {
          return false;
        }

        const distance = Math.abs(target - activeIndex) || 1;
        activeIndex = target;
        updateActiveState();

        if (pendingTween) {
          pendingTween.kill();
          pendingTween = null;
        }

        if (immediate || duration === 0) {
          gsap.set(track, { yPercent: -100 * target });
          changeEvent();
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
            changeEvent();
          },
        });

        return true;
      }

      function goRelative(delta) {
        if (!delta) return false;
        const target = loopSlides ? activeIndex + delta : activeIndex + delta;
        return goTo(target);
      }

      function handleWheel(event) {
        if (!wheelEnabled || isAnimating) return;
        if (!scope.contains(event.target)) return;
        if (Math.abs(event.deltaY) < wheelThreshold) return;
        const moved = goRelative(event.deltaY > 0 ? 1 : -1);
        if (moved) {
          event.preventDefault();
        }
      }

      let pointerStartY = 0;
      let pointerStartX = 0;
      let pointerActive = false;
      let pointerId = null;

      const supportsPointer = "PointerEvent" in window;

      function pointerDown(event) {
        if (!touchEnabled || isAnimating) return;
        if (supportsPointer) {
          if (event.pointerType && event.pointerType !== "touch") return;
          pointerId = event.pointerId;
          pointerStartY = event.clientY;
          pointerStartX = event.clientX;
        } else {
          if (!event.touches || !event.touches.length) return;
          const primary = event.touches[0];
          pointerId = primary.identifier;
          pointerStartY = primary.clientY;
          pointerStartX = primary.clientX;
        }
        pointerActive = true;
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
        if (!point) {
          pointerActive = false;
          pointerId = null;
          return;
        }
        const deltaY = point.clientY - pointerStartY;
        const deltaX = point.clientX - pointerStartX;
        pointerActive = false;
        pointerId = null;
        if (Math.abs(deltaY) < swipeThreshold || Math.abs(deltaY) < Math.abs(deltaX)) {
          return;
        }
        const moved = goRelative(deltaY < 0 ? 1 : -1);
        if (moved && event.cancelable) {
          event.preventDefault();
        }
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
        if (deltaY > deltaX && event.cancelable) {
          event.preventDefault();
        }
      }

      function handleKeydown(event) {
        if (!keysEnabled || isAnimating) return;
        if (!scope.contains(event.target)) return;
        const key = event.key;
        if (key === "ArrowDown" || key === "PageDown") {
          const moved = goRelative(1);
          if (moved) event.preventDefault();
        } else if (key === "ArrowUp" || key === "PageUp") {
          const moved = goRelative(-1);
          if (moved) event.preventDefault();
        }
      }

      scope.querySelectorAll(NEXT_SELECTOR).forEach((btn) => {
        if (btn.closest(BASE_SCOPE) !== scope) return;
        btn.addEventListener("click", (event) => {
          event.preventDefault();
          goRelative(1);
        });
      });

      scope.querySelectorAll(PREV_SELECTOR).forEach((btn) => {
        if (btn.closest(BASE_SCOPE) !== scope) return;
        btn.addEventListener("click", (event) => {
          event.preventDefault();
          goRelative(-1);
        });
      });

      scope.querySelectorAll(TO_SELECTOR).forEach((btn) => {
        if (btn.closest(BASE_SCOPE) !== scope) return;
        const targetIndex = clampIndex(btn.dataset.scrollTo, slides.length - 1);
        if (!Number.isFinite(targetIndex)) return;
        btn.addEventListener("click", (event) => {
          event.preventDefault();
          goTo(targetIndex);
        });
      });

      if (wheelEnabled) {
        scope.addEventListener("wheel", handleWheel, { passive: false });
      }
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
      if (keysEnabled) {
        scope.addEventListener("keydown", handleKeydown);
      }

      window.addEventListener("resize", () => {
        gsap.set(track, { yPercent: -100 * activeIndex });
      });

      function findTouch(list, identifier) {
        if (!list) return null;
        for (let i = 0; i < list.length; i += 1) {
          if (list[i].identifier === identifier) return list[i];
        }
        return null;
      }

      immediateSet(activeIndex);
    });
  }

  function bootWhenReady() {
    if (document.readyState === "complete" || document.readyState === "interactive") {
      if (window.gsap) {
        initScroller();
      } else {
        window.addEventListener("load", initScroller, { once: true });
      }
    } else {
      document.addEventListener(
        "DOMContentLoaded",
        () => {
          if (window.gsap) {
            initScroller();
          } else {
            window.addEventListener("load", initScroller, { once: true });
          }
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
})();
