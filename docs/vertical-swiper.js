/**
 * Minimal Swiper initialiser for the hero slider.
 * Usage:
 * <div class="hero-swiper swiper">
 *   <div class="swiper-wrapper">
 *     <article class="swiper-slide">...</article>
 *   </div>
 *   <div class="swiper-button-prev"></div>
 *   <div class="swiper-button-next"></div>
 * </div>
 */
(function initHeroSwiper() {
  const SELECTOR = ".hero-swiper";
  const WAIT = 120;

  function readNumber(value, fallback) {
    if (value == null || value === "") return fallback;
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function readBoolean(value, fallback) {
    if (value == null) return fallback;
    if (value === "true") return true;
    if (value === "false") return false;
    return fallback;
  }

  function initElement(el) {
    if (el.__heroSwiper || typeof Swiper === "undefined") return;
    el.__heroSwiper = true;

    const dataset = el.dataset || {};
    const autoplayDelay = readNumber(dataset.autoplayDelay, 0);
    const autoplayReverse = (dataset.autoplayDirection || "").toLowerCase() !== "forward";
    const speed = readNumber(dataset.speed, 5000);
    const slidesPerView = readNumber(dataset.slidesPerView, 1);
    const allowTouch = readBoolean(dataset.touch, true);

    const swiper = new Swiper(el, {
      direction: "vertical",
      slidesPerView,
      spaceBetween: readNumber(dataset.spaceBetween, 30),
      loop: readBoolean(dataset.loop, true),
      allowTouchMove: allowTouch,
      autoHeight: false,
      resistanceRatio: 0.85,
      speed,
      autoplay:
        autoplayDelay > 0
          ? {
              delay: autoplayDelay,
              reverseDirection: autoplayReverse,
              disableOnInteraction: false,
              pauseOnMouseEnter: true,
            }
          : false,
      mousewheel: {
        enabled: readBoolean(dataset.mousewheel, true),
        forceToAxis: true,
        releaseOnEdges: false,
      },
      keyboard: {
        enabled: readBoolean(dataset.keys, true),
        onlyInViewport: true,
      },
      navigation: {
        nextEl: el.querySelector(".swiper-button-next"),
        prevEl: el.querySelector(".swiper-button-prev"),
      },
    });

    // Optional wheel lock so the page doesn't scroll while hovering the slider.
    if (readBoolean(dataset.lockScroll, true)) {
      el.addEventListener(
        "wheel",
        (event) => {
          if (!el.contains(event.target)) return;
          if (event.cancelable) event.preventDefault();
        },
        { passive: false }
      );
    }
  }

  function bootWhenReady() {
    const nodes = document.querySelectorAll(SELECTOR);
    if (!nodes.length) return;
    nodes.forEach(initElement);
  }

  function waitForSwiper() {
    if (typeof Swiper === "undefined") {
      setTimeout(waitForSwiper, WAIT);
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
