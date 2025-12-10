(function heroSliderInit() {
  function run() {
    if (typeof Swiper === "undefined") return;

  const sliderSelector = ".timeline-slider";
  const targetAttr = "data-hero-slider";
  const cardSelector = ".hero-card-slide";
  const panelSelector = ".hero-card-list-wrapper";
  const footerSelector = ".hero-card-footer";

  const attrMatches = Array.from(document.querySelectorAll(`[${targetAttr}]`));
  const fallback = !attrMatches.length ? document.querySelector(sliderSelector) : null;
  const sliderEls = attrMatches.length ? attrMatches : fallback ? [fallback] : [];
  if (!sliderEls.length) return;

  const breakpoint = window.matchMedia("(max-width: 767px)");
  const instances = sliderEls.map((sliderEl) => createHeroSlider(sliderEl));

  let pendingReload = false;
  const mqHandler = () => {
    if (pendingReload) return;
    pendingReload = true;
    window.location.reload();
  };

  if (breakpoint.addEventListener) {
    breakpoint.addEventListener("change", mqHandler);
  } else {
    breakpoint.addListener(mqHandler);
  }

  function createHeroSlider(sliderEl) {
    if (!sliderEl) return null;
    let current = null;

    function panelLooksOpen(panel) {
      if (!panel) return false;
      if (
        panel.dataset.state === "open" ||
        panel.dataset.open === "true" ||
        panel.getAttribute("aria-expanded") === "true" ||
        panel.getAttribute("aria-hidden") === "false" ||
        panel.classList.contains("is-open") ||
        panel.classList.contains("is-active") ||
        panel.classList.contains("w--open")
      ) {
        return true;
      }

      const inlineHeight = parseFloat(panel.style.height || panel.style.maxHeight || "0");
      if (!Number.isNaN(inlineHeight) && inlineHeight > 4) {
        return true;
      }

      const rect = panel.getBoundingClientRect();
      const computedHeight = rect.height || parseFloat(getComputedStyle(panel).height) || 0;
      return computedHeight > 4;
    }

    function slideLooksOpen(slideEl) {
      if (!slideEl) return false;
      if (
        slideEl.dataset.state === "open" ||
        slideEl.dataset.open === "true" ||
        slideEl.getAttribute("aria-expanded") === "true" ||
        slideEl.classList.contains("is-open") ||
        slideEl.classList.contains("is-active") ||
        slideEl.classList.contains("w--open")
      ) {
        return true;
      }
      return panelLooksOpen(slideEl.querySelector(panelSelector));
    }

    function collectCardState() {
      const slides = sliderEl.querySelectorAll(cardSelector);
      const openSlides = [];
      slides.forEach((slide) => {
        if (slideLooksOpen(slide)) openSlides.push(slide);
      });
      return { anyOpen: openSlides.length > 0, openSlides };
    }

    function createSlider(isMobileMode) {
      const swiper = new Swiper(sliderEl, {
        slidesPerView: "auto",
        spaceBetween: 0,
        overflow: "visible",
        allowTouchMove: true,
        autoplay: isMobileMode
          ? false
          : {
              delay: 3000,
              disableOnInteraction: false,
              pauseOnMouseEnter: false,
            },
        speed: isMobileMode ? 800 : 4000,
        loop: !isMobileMode,
        rewind: isMobileMode,
        pagination: {
          el: ".swiper-pagination",
          clickable: true,
        },
        navigation: {
          nextEl: ".swiper-button-next",
          prevEl: ".swiper-button-prev",
        },
      });

      let isHovered = sliderEl.matches(":hover");
      let isPointerDown = false;
      let frozenTranslate = null;
      let suppressFooterChain = false;
      const cleanupFns = [];

      function freezeSwiper() {
        if (isMobileMode || !swiper?.autoplay?.running) return;
        frozenTranslate = swiper.getTranslate();
        swiper.autoplay.stop();
        swiper.setTransition(0);
        swiper.setTranslate(frozenTranslate);
      }

      function resumeSwiper() {
        if (isMobileMode || !swiper?.autoplay || swiper.autoplay.running) return;
        swiper.setTransition(swiper.params.speed);
        if (frozenTranslate !== null) {
          swiper.setTranslate(frozenTranslate);
        }
        swiper.autoplay.start();
        frozenTranslate = null;
      }

      function syncPlaybackState(reason) {
        const { anyOpen } = collectCardState();
        if (isMobileMode) return;
        if (isHovered || isPointerDown || anyOpen) {
          freezeSwiper();
        } else {
          resumeSwiper();
        }
      }

      function triggerFooterToggle(slideEl) {
        if (!slideEl) return;
        const footer = slideEl.querySelector(footerSelector);
        if (!footer) return;
        const interactiveTarget =
          footer.querySelector("button, [role='button'], [data-w-id]") || footer;
        interactiveTarget.dispatchEvent(
          new MouseEvent("click", { bubbles: true, cancelable: true })
        );
      }

      if (isMobileMode) {
        const mobileClickHandler = () => {
          const { openSlides } = collectCardState();
          if (openSlides.length <= 1) return;
          const latest = openSlides[openSlides.length - 1];
          const others = openSlides.filter((slide) => slide !== latest);
          suppressFooterChain = true;
          others.forEach((slide) => triggerFooterToggle(slide));
          requestAnimationFrame(() => {
            suppressFooterChain = false;
            syncPlaybackState("mobile-enforce");
          });
        };
        sliderEl.addEventListener("click", mobileClickHandler);
        cleanupFns.push(() => sliderEl.removeEventListener("click", mobileClickHandler));
      }

      const hoverEnter = () => {
        isHovered = true;
        syncPlaybackState("hover-enter");
      };
      const hoverLeave = () => {
        isHovered = false;
        syncPlaybackState("hover-leave");
      };
      sliderEl.addEventListener("mouseenter", hoverEnter);
      sliderEl.addEventListener("mouseleave", hoverLeave);
      cleanupFns.push(() => {
        sliderEl.removeEventListener("mouseenter", hoverEnter);
        sliderEl.removeEventListener("mouseleave", hoverLeave);
      });

      const footerHandler = (event) => {
        const footer = event.target.closest(footerSelector);
        if (!footer || !sliderEl.contains(footer) || suppressFooterChain) return;

        const activeSlide = footer.closest(cardSelector);
        if (!activeSlide) return;

        freezeSwiper();

        requestAnimationFrame(() => {
          const { openSlides } = collectCardState();
          const otherOpenSlides = openSlides.filter((slide) => slide !== activeSlide);
          if (!otherOpenSlides.length) {
            syncPlaybackState("footer-no-change");
            return;
          }

          suppressFooterChain = true;
          otherOpenSlides.forEach((slide) => triggerFooterToggle(slide));
          setTimeout(() => {
            suppressFooterChain = false;
            syncPlaybackState("footer-auto-close");
          }, 0);
        });
      };
      sliderEl.addEventListener("click", footerHandler, true);
      cleanupFns.push(() => sliderEl.removeEventListener("click", footerHandler, true));

      if (!isMobileMode) {
        const pointerDown = () => {
          isPointerDown = true;
          freezeSwiper();
        };
        const pointerRelease = () => {
          if (!isPointerDown) return;
          isPointerDown = false;
          syncPlaybackState("pointer-release");
        };
        sliderEl.addEventListener("pointerdown", pointerDown);
        sliderEl.addEventListener("pointerup", pointerRelease);
        sliderEl.addEventListener("pointercancel", pointerRelease);
        sliderEl.addEventListener("pointerleave", (evt) => {
          if (evt.pointerType === "mouse") {
            pointerRelease();
          }
        });
        cleanupFns.push(() => {
          sliderEl.removeEventListener("pointerdown", pointerDown);
          sliderEl.removeEventListener("pointerup", pointerRelease);
          sliderEl.removeEventListener("pointercancel", pointerRelease);
          sliderEl.removeEventListener("pointerleave", pointerRelease);
        });
      }

      const MutationObserverCtor =
        window.MutationObserver || window.WebKitMutationObserver || window.MozMutationObserver;
      if (MutationObserverCtor) {
        const observer = new MutationObserverCtor(() => {
          syncPlaybackState("mutation");
        });
        observer.observe(sliderEl, {
          attributes: true,
          childList: true,
          subtree: true,
          attributeFilter: ["class", "style", "data-state", "data-open", "aria-expanded", "aria-hidden"],
        });
        cleanupFns.push(() => observer.disconnect());
      }

      let intervalId = null;
      if (!isMobileMode) {
        intervalId = setInterval(() => {
          if (!document.body.contains(sliderEl)) {
            clearInterval(intervalId);
            return;
          }
          syncPlaybackState("interval");
        }, 600);
        cleanupFns.push(() => clearInterval(intervalId));
      }

      syncPlaybackState("initial");

      return {
        swiper,
        cleanup() {
          cleanupFns.forEach((fn) => fn());
        },
      };
    }

    function applyMode(isMobileMode) {
      if (current) {
        current.cleanup?.();
        current.swiper?.destroy(true, true);
      }
      current = createSlider(isMobileMode);
    }

    applyMode(breakpoint.matches);

    return {
      destroy() {
        current?.cleanup?.();
        current?.swiper?.destroy(true, true);
        current = null;
      },
    };
  }

  return () => {
    instances.forEach((instance) => instance?.destroy?.());
  };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run, { once: true });
  } else {
    run();
  }
})();
