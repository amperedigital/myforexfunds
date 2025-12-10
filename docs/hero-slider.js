(function heroTimelineController() {
  function init() {
    const sliderSelector = '.timeline-slider';
    const cardSelector = '.hero-card-slide';
    const panelSelector = '.hero-card-list-wrapper';
    const footerSelector = '.hero-card-footer';
    const navSelector = '.swiper-button-next, .swiper-button-prev, .swiper-pagination-bullet';

    const sliderEl = document.querySelector(sliderSelector);
    if (!sliderEl || typeof Swiper === 'undefined') return;

    const scope = sliderEl.closest('.timeline-tabs') || document;
    const breakpoint = window.matchMedia('(max-width: 767px)');
    let swiperInstance = null;
    let frozenTranslate = null;
    let isFrozen = false;
    let isPointerDown = false;

    function panelLooksOpen(panel) {
      if (!panel) return false;
      const state = panel.dataset.state || panel.dataset.open;
      if (state === 'open' || state === 'true') return true;
      if (panel.classList.contains('is-open') || panel.classList.contains('w--open')) return true;
      const inlineHeight = parseFloat(panel.style.height || panel.style.maxHeight || '0');
      if (!Number.isNaN(inlineHeight) && inlineHeight > 4) return true;
      const inlineWidth = parseFloat(panel.style.width || panel.style.maxWidth || '0');
      if (!Number.isNaN(inlineWidth) && inlineWidth > 4) return true;
      const rect = panel.getBoundingClientRect();
      return rect.height > 4;
    }

    function slideLooksOpen(slide) {
      if (!slide) return false;
      if (slide.dataset.state === 'open' || slide.dataset.open === 'true') return true;
      if (slide.classList.contains('is-open') || slide.classList.contains('w--open')) return true;
      return panelLooksOpen(slide.querySelector(panelSelector));
    }

    function collectOpenSlides() {
      return Array.from(sliderEl.querySelectorAll(cardSelector)).filter(slideLooksOpen);
    }

    function lockSliderHeight(duration) {
      const height = sliderEl?.getBoundingClientRect?.().height || 0;
      if (height <= 0) return;
      sliderEl.style.minHeight = `${height}px`;
      setTimeout(() => sliderEl.style.removeProperty('min-height'), duration);
    }

    function freezeSwiper(lockTranslate = true) {
      if (!swiperInstance?.autoplay?.running) return;
      if (lockTranslate) {
        frozenTranslate = swiperInstance.getTranslate();
        swiperInstance.setTransition(0);
        swiperInstance.setTranslate(frozenTranslate);
      } else {
        frozenTranslate = null;
      }
      swiperInstance.autoplay.stop();
      isFrozen = true;
    }

    function resumeSwiper() {
      if (!swiperInstance?.autoplay || swiperInstance.autoplay.running) return;
      swiperInstance.setTransition(swiperInstance.params.speed);
      if (frozenTranslate !== null) {
        swiperInstance.setTranslate(frozenTranslate);
      }
      swiperInstance.autoplay.start();
      isFrozen = false;
      frozenTranslate = null;
    }

    function syncPlaybackState(source) {
      if (breakpoint.matches) return;
      const openSlides = collectOpenSlides();
      if (isPointerDown || sliderEl.matches(':hover') || openSlides.length) {
        freezeSwiper(!isPointerDown);
      } else if (isFrozen) {
        resumeSwiper();
      }
    }

    function createSwiper(mode) {
      if (swiperInstance) {
        swiperInstance.destroy(true, true);
      }

      swiperInstance = new Swiper(sliderSelector, {
        slidesPerView: mode === 'mobile' ? 1 : 'auto',
        spaceBetween: 12,
        allowTouchMove: true,
        loop: mode !== 'mobile',
        speed: mode === 'mobile' ? 800 : 4000,
        autoplay:
          mode === 'mobile'
            ? false
            : {
                delay: 3000,
                disableOnInteraction: false,
                pauseOnMouseEnter: false,
              },
        pagination: {
          el: '.swiper-pagination',
          clickable: true,
        },
        navigation: {
          nextEl: '.swiper-button-next',
          prevEl: '.swiper-button-prev',
        },
      });

      swiperInstance.on('slideChangeTransitionStart', () => lockSliderHeight(600));
      swiperInstance.on('touchStart', () => {
        isPointerDown = true;
        freezeSwiper(false);
      });
      swiperInstance.on('touchEnd', () => {
        isPointerDown = false;
        syncPlaybackState('touchEnd');
      });
    }

    function applyMode() {
      const mode = breakpoint.matches ? 'mobile' : 'desktop';
      createSwiper(mode);
      if (mode === 'desktop') {
        syncPlaybackState('mode-change');
      }
    }

    applyMode();

    if (breakpoint.addEventListener) {
      breakpoint.addEventListener('change', applyMode);
    } else {
      breakpoint.addListener(applyMode);
    }

    sliderEl.addEventListener('mouseenter', () => syncPlaybackState('hover-enter'));
    sliderEl.addEventListener('mouseleave', () => syncPlaybackState('hover-leave'));

    if (window.MutationObserver) {
      const observer = new MutationObserver(() => syncPlaybackState('mutation'));
      observer.observe(sliderEl, {
        attributes: true,
        childList: true,
        subtree: true,
        attributeFilter: ['class', 'style', 'data-state', 'data-open', 'aria-expanded', 'aria-hidden'],
      });
    }

    setInterval(() => syncPlaybackState('interval'), 800);

    // Single-open enforcement (mimics timeline-tabs helper)
    (function initSingleOpen(scopeElement) {
      if (!scopeElement) return;
      let suppress = false;

      function closeSlides(exceptSlide) {
        suppress = true;
        collectOpenSlides()
          .filter((slide) => !exceptSlide || slide !== exceptSlide)
          .forEach((slide) => {
            if (!slideLooksOpen(slide)) return;
            const footer = slide.querySelector(footerSelector);
            if (!footer) return;
            const trigger =
              footer.querySelector('button, [role="button"], [data-w-id], [data-trigger="card-footer"]') || footer;
            trigger.dataset.heroSingleOpen = 'true';
            trigger.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
          });
        requestAnimationFrame(() => {
          suppress = false;
          syncPlaybackState('single-open');
        });
      }

      scopeElement.addEventListener(
        'click',
        (event) => {
          if (suppress) return;
          const navBtn = event.target.closest(navSelector);
          if (navBtn && scopeElement.contains(navBtn)) {
            requestAnimationFrame(() => closeSlides());
            return;
          }
          const footer = event.target.closest(footerSelector);
          if (!footer || !scopeElement.contains(footer)) return;
          const slide = footer.closest(cardSelector);
          if (!slide) return;
          let trigger = footer.querySelector('button, [role="button"], [data-w-id], [data-trigger="card-footer"]') || footer;
          if (trigger.dataset.heroSingleOpen === 'true') {
            delete trigger.dataset.heroSingleOpen;
            return;
          }
          requestAnimationFrame(() => closeSlides(slide));
        },
        true
      );
    })(scope);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
