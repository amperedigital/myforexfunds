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
