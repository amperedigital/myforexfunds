/**
 * Vertical Swiper integration that reuses the existing Webflow markup defined for
 * the old GSAP slider. No HTML changes required—just include Swiper's assets plus
 * this script.
 *
 * Expected markup (already in Webflow):
 * <section data-vertical-scroll ...>
 *   <div data-scroll-track>
 *     <article data-scroll-slide>...</article>
 *     ...
 *   </div>
 *   <button data-scroll-prev>Prev</button>
 *   <button data-scroll-next>Next</button>
 * </section>
 */
(function initHeroVerticalSwiper() {
  const SWIPER_SELECTOR = "[data-vertical-scroll]";
  const TRACK_SELECTOR = "[data-scroll-track]";
  const SLIDE_SELECTOR = "[data-scroll-slide]";
  const NEXT_SELECTOR = "[data-scroll-next]";
  const PREV_SELECTOR = "[data-scroll-prev]";

  function hasTouch() {
    if (typeof window === "undefined") return false;
    return (
      "ontouchstart" in window ||
      (navigator && typeof navigator.maxTouchPoints === "number" && navigator.maxTouchPoints > 0)
    );
  }

  function resetLegacyTransforms(scope, track) {
    ["transform", "transition", "top", "left", "right", "bottom", "height", "min-height"].forEach(
      (prop) => {
        if (scope.style) scope.style.removeProperty(prop);
        if (track.style) track.style.removeProperty(prop);
      }
    );
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
    const explicitStartIndex = Number.parseInt(dataset.scrollStartIndex || "", 10);
    const startIndex = Number.isFinite(explicitStartIndex) ? explicitStartIndex : 0;

    resetLegacyTransforms(scope, track);
    const isTouch = hasTouch();
    const autoplayAttr = dataset.scrollAutoplay;
    const autoplayDelay =
      autoplayAttr === "true"
        ? 4000
        : autoplayAttr === "false"
        ? 0
        : Number.parseInt(autoplayAttr, 10) || 4000;
    const autoplayEnabled = autoplayDelay > 0;
    const durationSeconds = dataset.scrollDuration ? Number(dataset.scrollDuration) : 0.85;
    const wheelEnabled = dataset.scrollWheel !== "false";
    const lockWheel = dataset.scrollLock === "true" && !isTouch;

    scope.classList.add("hero-vertical-swiper", "swiper");
    scope.style.setProperty("width", "100%", "important");
    scope.style.setProperty("max-width", "100%", "important");
    scope.style.setProperty("height", "auto", "important");
    scope.style.setProperty("min-height", "0", "important");
    scope.style.setProperty("position", "relative", "important");
    scope.style.setProperty("overflow", "hidden", "important");
    track.classList.add("swiper-wrapper");
    track.style.setProperty("width", "100%", "important");
    track.style.setProperty("height", "auto", "important");
    track.style.setProperty("display", "flex", "important");
    track.style.setProperty("flex-direction", "column", "important");
    track.style.setProperty("position", "relative", "important");
    track.style.setProperty("top", "auto", "important");
    track.style.setProperty("left", "auto", "important");
    track.style.setProperty("right", "auto", "important");
    slides.forEach((slide) => {
      slide.classList.add("swiper-slide");
      slide.style.setProperty("width", "100%", "important");
      slide.style.setProperty("flex", "0 0 auto", "important");
    });

    const nextEl = scope.querySelector(NEXT_SELECTOR);
    const prevEl = scope.querySelector(PREV_SELECTOR);

    const swiper = new Swiper(scope, {
      direction: "vertical",
      slidesPerView: 1,
      loop: dataset.scrollLoop === "true",
      speed: Number.isFinite(durationSeconds) ? durationSeconds * 1000 : 850,
      allowTouchMove: dataset.scrollTouch !== "false",
      cssMode: false,
      resistanceRatio: 0.85,
      threshold: 12,
      autoHeight: false,
      rewind: dataset.scrollLoop !== "true",
      autoplay: autoplayEnabled
        ? {
            delay: autoplayDelay,
            disableOnInteraction: false,
            pauseOnMouseEnter: true,
          }
        : false,
      mousewheel: wheelEnabled
        ? {
            enabled: true,
            forceToAxis: true,
            releaseOnEdges: true,
            thresholdTime: 200,
          }
        : false,
      keyboard: {
        enabled: dataset.scrollKeys !== "false",
        onlyInViewport: true,
      },
      navigation:
        nextEl || prevEl
          ? {
              nextEl: nextEl || undefined,
              prevEl: prevEl || undefined,
            }
          : undefined,
      on: {
        init(swiperInstance) {
          swiperInstance.setTranslate(0);
          swiperInstance.slideTo(startIndex, 0, false);
          scope.classList.add("is-ready");
          emitChange(swiperInstance, scope);
        },
        slideChange(swiperInstance) {
          emitChange(swiperInstance, scope);
        },
      },
    });

    if (autoplayEnabled) {
      scope.addEventListener("mouseenter", () => swiper.autoplay.stop());
      scope.addEventListener("mouseleave", () => swiper.autoplay.start());
    }

    if (lockWheel) {
      scope.addEventListener(
        "wheel",
        (event) => {
          if (!scope.contains(event.target)) return;
          const atStart = swiper.isBeginning && event.deltaY < 0;
          const atEnd = swiper.isEnd && event.deltaY > 0;
          if (!atStart && !atEnd && event.cancelable) {
            event.preventDefault();
          }
        },
        { passive: false }
      );
    }

    scope.__verticalSwiper = swiper;
  }

  function emitChange(swiperInstance, scope) {
    const { activeIndex, slides } = swiperInstance;
    const detail = { index: activeIndex, slide: slides[activeIndex] };
    scope.dispatchEvent(new CustomEvent("verticalscroll:change", { detail }));
  }

  function bootWhenReady() {
    const scopes = document.querySelectorAll(SWIPER_SELECTOR);
    if (!scopes.length) return;
    scopes.forEach(initScope);
  }

  function waitForSwiper() {
    if (typeof Swiper === "undefined") {
      setTimeout(waitForSwiper, 150);
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
