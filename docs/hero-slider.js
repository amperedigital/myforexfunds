(function initHeroTimelineSlider(){
  const sliderSel = '.timeline-slider';
  const cardSel = '.hero-card-slide';
  const paginationSel = '.hero-slider-pagination';
  const nextSel = '.hero-slider-next';
  const prevSel = '.hero-slider-prev';
  const sliderEl = document.querySelector(sliderSel);
  if(!sliderEl || typeof Swiper === 'undefined') return;

  const breakpoint = window.matchMedia('(max-width: 767px)');
  let instance = null;

  function lockHeight(el, duration){
    const h = el?.getBoundingClientRect?.().height || 0;
    if(h <= 0) return;
    el.style.minHeight = `${h}px`;
    setTimeout(() => el.style.removeProperty('min-height'), duration);
  }

  function create(mode){
    const swiper = new Swiper(sliderSel, {
      slidesPerView: mode === 'mobile' ? 1 : 'auto',
      spaceBetween: 12,
      allowTouchMove: true,
      loop: mode !== 'mobile',
      speed: mode === 'mobile' ? 800 : 4000,
      autoplay: mode === 'mobile' ? false : { delay: 3000, disableOnInteraction: false, pauseOnMouseEnter: true },
      pagination: { el: paginationSel, clickable: true },
      navigation: { nextEl: nextSel, prevEl: prevSel },
    });

    swiper.on('slideChangeTransitionStart', () => {
      lockHeight(sliderEl, 600);
    });

    return swiper;
  }

  function apply(){
    const mode = breakpoint.matches ? 'mobile' : 'desktop';
    if(instance) instance.destroy(true, true);
    instance = create(mode);
  }

  apply();
  if(breakpoint.addEventListener){
    breakpoint.addEventListener('change', apply);
  } else {
    breakpoint.addListener(apply);
  }
})();
(function heroSliderSingleOpen(){
  const scopeSelector = '.timeline-tabs, [data-single-open-scope]';
  const cardSelector = '.hero-card-slide';
  const panelSelector = '.hero-card-list-wrapper';
  const footerSelector = '.hero-card-footer';

  const scopes = document.querySelectorAll(scopeSelector);
  if(!scopes.length) return;

  const closing = new WeakSet();

  function looksOpen(panel){
    if(!panel) return false;
    const inlineHeight = parseFloat(panel.style.height || panel.style.maxHeight || '0');
    if(!Number.isNaN(inlineHeight) && inlineHeight > 4) return true;
    const inlineWidth = parseFloat(panel.style.width || panel.style.maxWidth || '0');
    if(!Number.isNaN(inlineWidth) && inlineWidth > 4) return true;
    const rect = panel.getBoundingClientRect();
    return rect.height > 4;
  }

  function triggerFooter(slide){
    if(!slide || closing.has(slide)) return;
    const footer = slide.querySelector(footerSelector);
    if(!footer) return;
    let trigger = footer.querySelector('button, [role="button"], [data-w-id], [data-trigger="card-footer"]') || footer;
    closing.add(slide);
    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    setTimeout(() => closing.delete(slide), 50);
  }

  scopes.forEach((scope) => {
    let suppress = false;

    function collectOpenSlides(){
      return Array.from(scope.querySelectorAll(cardSelector)).filter((slide) => looksOpen(slide.querySelector(panelSelector)));
    }

    function closeOthers(active){
      const openSlides = collectOpenSlides();
      const others = openSlides.filter((slide) => slide !== active);
      if(!others.length) return;
      suppress = true;
      others.forEach(triggerFooter);
      requestAnimationFrame(() => { suppress = false; });
    }

    scope.addEventListener('click', (event) => {
      if(suppress) return;
      const footer = event.target.closest(footerSelector);
      if(!footer || !scope.contains(footer)) return;
      const slide = footer.closest(cardSelector);
      if(!slide) return;
      requestAnimationFrame(() => closeOthers(slide));
    }, true);
  });
})();
