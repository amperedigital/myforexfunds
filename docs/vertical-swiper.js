/**
 * Swiper-powered vertical slider that reuses the existing Webflow markup.
 *
 * Markup requirements (already on page):
 * <section data-vertical-scroll ...>
 *   <div data-scroll-track>
 *     <article data-scroll-slide>...</article>
 *   </div>
 *   <button data-scroll-prev>Prev</button>
 *   <button data-scroll-next>Next</button>
 * </section>
 *
 * Include Swiper assets before this script:
 * <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css">
 * <script src="https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js" defer></script>
 */
(function initHeroVerticalSwiper() {
  const SCOPE_SELECTOR = "[data-vertical-scroll]";
  const TRACK_SELECTOR = "[data-scroll-track]";
  const SLIDE_SELECTOR = "[data-scroll-slide]";
  const NEXT_SELECTOR = "[data-scroll-next]";
  const PREV_SELECTOR = "[data-scroll-prev]";
  const TO_SELECTOR = "[data-scroll-to]";
  const WAIT_INTERVAL = 150;

  function hasTouch() {
    return (
      "ontouchstart" in window ||
      (navigator && typeof navigator.maxTouchPoints === "number" && navigator.maxTouchPoints > 0)
    );
  }

  function clampIndex(value, max) {
    const num = Number.parseInt(value, 10);
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

  function cleanupInlineStyles(scope, track) {
    const props = ["transform", "transition", "top", "left", "right", "bottom", "height", "min-height"];
    props.forEach((prop) => {
      if (scope.style) scope.style.removeProperty(prop);
      if (track.style) track.style.removeProperty(prop);
    });
  }

  function initScope(scope) {
    if (scope.__verticalSwiper || typeof Swiper === "undefined") return;

    const track =
      scope.matches(TRACK_SELECTOR)
        ? scope
        : scope.querySelector(TRACK_SELECTOR) || scope.querySelector(".vertical-scroll-track");
    if (!track) return;

    const slides = Array.from(track.querySelectorAll(SLIDE_SELECTOR));
    if (slides.length < 2) return;

    const dataset = scope.dataset || {};
    cleanupInlineStyles(scope, track);

    const autoplayAttr = dataset.scrollAutoplay;
    const autoplayDelay =
      autoplayAttr === "true"
        ? 4000
        : autoplayAttr === "false"
        ? 0
        : Number.parseInt(autoplayAttr || "", 10) || 0;
    const autoplayEnabled = autoplayDelay > 0;
    const autoplayStartDelay =
      dataset.scrollDelay != null ? Number.parseInt(dataset.scrollDelay, 10) || 0 : null;
    const durationSeconds = parseDuration(dataset.scrollDuration, 0.85);
    const wheelEnabled = dataset.scrollWheel !== "false";
    const lockWheel = dataset.scrollLock === "true";
    const touchEnabled = dataset.scrollTouch !== "false";
    const keysEnabled = dataset.scrollKeys !== "false";
    const loopSlides = dataset.scrollLoop === "true";
    const isTouch = hasTouch();

    const explicitStartIndex = Number.parseInt(dataset.scrollStartIndex || "", 10);
    const detectedActiveIndex = slides.findIndex(
      (slide) => slide.hasAttribute("data-slide-active") || slide.classList.contains("is-active")
    );
    const startIndex = Number.isFinite(explicitStartIndex)
      ? Math.max(0, explicitStartIndex)
      : 0;

    scope.classList.add("hero-vertical-swiper", "swiper");
    track.classList.add("swiper-wrapper");
    slides.forEach((slide) => {
      slide.classList.add("swiper-slide");
      slide.style.setProperty("width", "100%", "important");
      slide.style.setProperty("flex", "0 0 auto", "important");
    });

    const nextBtn = scope.querySelector(NEXT_SELECTOR);
    const prevBtn = scope.querySelector(PREV_SELECTOR);

    const swiper = new Swiper(scope, {
      direction: "vertical",
      slidesPerView: 1,
      loop: false,
      rewind: true,
      initialSlide: clampIndex(startIndex, slides.length - 1),
      speed: durationSeconds * 1000,
      allowTouchMove: touchEnabled,
      resistanceRatio: 0.85,
      threshold: 12,
      autoHeight: false,
      autoplay: autoplayEnabled
        ? {
            delay: Math.max(100, autoplayDelay),
            disableOnInteraction: false,
            pauseOnMouseEnter: true,
          }
        : false,
      mousewheel: wheelEnabled
        ? {
            enabled: true,
            forceToAxis: true,
            releaseOnEdges: true,
            invert: false,
          }
        : false,
      keyboard: {
        enabled: keysEnabled,
        onlyInViewport: true,
      },
      navigation:
        nextBtn || prevBtn
          ? {
              nextEl: nextBtn || undefined,
              prevEl: prevBtn || undefined,
            }
          : undefined,
      on: {
        init(swiperInstance) {
          const targetIndex = clampIndex(startIndex, slides.length - 1);
          swiperInstance.slideTo(targetIndex, 0, false);
          scope.classList.add("is-ready");
          if (autoplayEnabled && autoplayStartDelay && swiperInstance.autoplay) {
            swiperInstance.autoplay.stop();
            setTimeout(() => {
              swiperInstance.autoplay.start();
            }, autoplayStartDelay);
          }
          emitChange(scope, swiperInstance);
        },
        slideChange(swiperInstance) {
          emitChange(scope, swiperInstance);
        },
      },
    });

    if (lockWheel && !isTouch) {
      scope.addEventListener(
        "wheel",
        (event) => {
          if (!scope.contains(event.target)) return;
          if (event.cancelable) event.preventDefault();
        },
        { passive: false }
      );
    }
    scope.addEventListener(
      "click",
      (event) => {
        const btn = event.target.closest(TO_SELECTOR);
        if (!btn || btn.closest(SCOPE_SELECTOR) !== scope) return;
        event.preventDefault();
        const targetIndex = clampIndex(btn.dataset.scrollTo, slides.length - 1);
        swiper.slideTo(targetIndex);
      },
      true
    );

    wireExternalButtons(scope, swiper);
    scope.__verticalSwiper = swiper;
  }

  function emitChange(scope, swiperInstance) {
    const detail = {
      index: swiperInstance.realIndex ?? swiperInstance.activeIndex,
      slide: swiperInstance.slides[swiperInstance.activeIndex],
    };
    scope.dispatchEvent(new CustomEvent("verticalscroll:change", { detail }));
  }

  function resolveButtonTarget(btn) {
    const explicit =
      btn.getAttribute("data-scroll-target") ||
      btn.getAttribute("aria-controls") ||
      btn.getAttribute("href");
    if (explicit && explicit.startsWith("#")) {
      const target = document.querySelector(explicit);
      if (target) return target;
    }
    return btn.closest(SCOPE_SELECTOR);
  }

  function wireExternalButtons(scope, swiper) {
    const loopSlides = swiper.params.loop;

    document.querySelectorAll(NEXT_SELECTOR).forEach((btn) => {
      if (btn.__verticalBound) return;
      const targetScope = resolveButtonTarget(btn);
      if (targetScope !== scope) return;
      btn.__verticalBound = true;
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        swiper.slideNext();
      });
    });

    document.querySelectorAll(PREV_SELECTOR).forEach((btn) => {
      if (btn.__verticalBound) return;
      const targetScope = resolveButtonTarget(btn);
      if (targetScope !== scope) return;
      btn.__verticalBound = true;
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        swiper.slidePrev();
      });
    });
  }

  function bootWhenReady() {
    document.querySelectorAll(SCOPE_SELECTOR).forEach(initScope);
  }

  function waitForSwiper() {
    if (typeof Swiper === "undefined") {
      setTimeout(waitForSwiper, WAIT_INTERVAL);
      return;
    }
    bootWhenReady();
  }

  if (document.readyState === "complete" || document.readyState === "interactive") {
    waitForSwiper();
  } else {
    document.addEventListener("DOMContentLoaded", waitForSwiper, { once: true });
  }
})();
