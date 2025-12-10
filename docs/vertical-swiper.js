/**
 * Minimal Swiper init for the hero slider.
 */
(function initHeroSwiper() {
  const SELECTOR = '.hero-swiper';
  const WAIT = 100;

  function boot() {
    document.querySelectorAll(SELECTOR).forEach((el) => {
      if (el.__heroSwiper || typeof Swiper === 'undefined') return;
      el.__heroSwiper = true;

      const swiper = new Swiper(el, {
        direction: 'vertical',
        slidesPerView: Number(el.dataset.slidesPerView) || 1,
        spaceBetween: Number(el.dataset.spaceBetween) || 30,
        loop: true,
        allowTouchMove: el.dataset.touch !== 'false',
        speed: Number(el.dataset.speed) || 5000,
        autoplay: {
          delay: Number(el.dataset.autoplayDelay) || 0,
          reverseDirection: el.dataset.autoplayDirection !== 'forward',
          disableOnInteraction: false,
          pauseOnMouseEnter: true,
        },
        mousewheel: {
          enabled: el.dataset.mousewheel !== 'false',
          forceToAxis: true,
          releaseOnEdges: false,
        },
        keyboard: {
          enabled: el.dataset.keys !== 'false',
          onlyInViewport: true,
        },
        navigation: {
          nextEl: el.querySelector('.swiper-button-next'),
          prevEl: el.querySelector('.swiper-button-prev'),
        },
      });

      const startDelay = Number(el.dataset.startDelay) || 0;
      if (startDelay > 0 && swiper.autoplay) {
        swiper.autoplay.stop();
        setTimeout(() => {
          if (swiper && swiper.autoplay) swiper.autoplay.start();
        }, startDelay);
      }

      if (el.dataset.lockScroll !== 'false') {
        el.addEventListener('wheel', (evt) => {
          if (evt.cancelable) evt.preventDefault();
        }, { passive: false });
      }

      el.__heroSwiperInstance = swiper;
    });
  }

  function waitForSwiper() {
    if (typeof Swiper === 'undefined') {
      setTimeout(waitForSwiper, WAIT);
      return;
    }
    boot();
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    waitForSwiper();
  } else {
    document.addEventListener('DOMContentLoaded', waitForSwiper, { once: true });
  }
})();
