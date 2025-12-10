(function heroSliderInit() {
  const sliderSelector = ".timeline-slider";
  const targetAttr = "data-hero-slider";
  const cardSelector = ".hero-card-slide";
  const panelSelector = ".hero-card-list-wrapper";
  const footerSelector = ".hero-card-footer";
  const navSelector = ".swiper-button-next, .swiper-button-prev, .swiper-pagination-bullet";
  const iconSelector = ".icon-regular svg, .icon-regular";
  const breakpoint = window.matchMedia("(max-width: 767px)");
  let pendingReload = false;

  function onReady(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else {
      fn();
    }
  }

  onReady(() => {
    console.log("[hero-slider] init start");
    if (typeof Swiper === "undefined") return;

    const attrMatches = Array.from(document.querySelectorAll(`[${targetAttr}]`));
    const fallback = !attrMatches.length ? document.querySelector(sliderSelector) : null;
    const sliderEls = attrMatches.length ? attrMatches : fallback ? [fallback] : [];
    console.log("[hero-slider] found sliders", sliderEls.length);
    if (!sliderEls.length) {
      console.warn("[hero-slider] no slider found");
      return;
    }

    sliderEls.forEach((sliderEl) => initHeroSlider(sliderEl));
  });

  function initHeroSlider(sliderEl) {
    if (!sliderEl) return;
    let current = null;

    function panelLooksOpen(panel) {
      if (!panel) return false;
      const parentSlide = panel.closest(cardSelector);
      if (parentSlide && parentSlide.dataset.heroOpen === "true") return true;
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
      if (slideEl.dataset.heroOpen === "true") return true;
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
        const parentSlide = slide.closest(".swiper-slide");
        if (parentSlide && parentSlide.classList.contains("swiper-slide-duplicate")) {
          return;
        }
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
      const slides = Array.from(sliderEl.querySelectorAll(cardSelector));

      slides.forEach((slide) => prepareSlide(slide));

      function prepareSlide(slide) {
        const panel = slide.querySelector(panelSelector);
        if (!panel) return;
        slide.dataset.heroOpen = slide.dataset.heroOpen === "true" ? "true" : "false";
        if (slide.dataset.heroOpen !== "true") {
          panel.style.height = "0px";
          panel.setAttribute("aria-hidden", "true");
        } else {
          panel.style.height = "auto";
          panel.setAttribute("aria-hidden", "false");
        }
        panel.style.overflow = "hidden";
        slide
          .querySelectorAll("[data-w-id]")
          .forEach((interactiveEl) => interactiveEl.removeAttribute("data-w-id"));
      }

      function getPanel(slide) {
        return slide.querySelector(panelSelector);
      }

      function getIcon(slide) {
        return slide.querySelector(iconSelector);
      }

      function setSlideState(slide, open) {
        slide.dataset.heroOpen = open ? "true" : "false";
        slide.classList.toggle("is-open", open);
      }

      function openSlide(slide) {
        if (!slide || slide.dataset.heroOpen === "true") return;
        const panel = getPanel(slide);
        if (!panel) return;
        const icon = getIcon(slide);
        const startHeight = panel.getBoundingClientRect().height || 0;
        const targetHeight = panel.scrollHeight || startHeight;
        panel.setAttribute("aria-hidden", "false");
        setSlideState(slide, true);
        if (typeof gsap !== "undefined") {
          gsap.killTweensOf(panel);
          panel.style.height = `${startHeight}px`;
          gsap.fromTo(
            panel,
            { height: startHeight },
            {
              height: targetHeight,
              duration: 0.55,
              ease: "power2.out",
              onComplete: () => {
                panel.style.height = "auto";
              },
            }
          );
          if (icon) {
            gsap.killTweensOf(icon);
            gsap.to(icon, { rotate: 0, duration: 0.45, ease: "power2.out" });
          }
        } else {
          panel.style.height = `${targetHeight}px`;
          if (icon) icon.style.transform = "rotate(0deg)";
        }
      }

      function closeSlide(slide) {
        if (!slide || slide.dataset.heroOpen !== "true") return;
        const panel = getPanel(slide);
        if (!panel) return;
        const icon = getIcon(slide);
        const startHeight = panel.scrollHeight || panel.getBoundingClientRect().height || 0;
        panel.setAttribute("aria-hidden", "true");
        setSlideState(slide, false);
        if (typeof gsap !== "undefined") {
          gsap.killTweensOf(panel);
          panel.style.height = `${startHeight}px`;
          gsap.fromTo(
            panel,
            { height: startHeight },
            {
              height: 0,
              duration: 0.45,
              ease: "power2.inOut",
              onComplete: () => {
                panel.style.height = "0px";
              },
            }
          );
          if (icon) {
            gsap.killTweensOf(icon);
            gsap.to(icon, { rotate: 180, duration: 0.35, ease: "power2.inOut" });
          }
        } else {
          panel.style.height = "0px";
          if (icon) icon.style.transform = "rotate(180deg)";
        }
      }

      function closeOtherSlides(exceptSlide) {
        let changed = false;
        slides.forEach((slide) => {
          if (slide === exceptSlide) return;
          if (slide.closest(".swiper-slide")?.classList.contains("swiper-slide-duplicate")) return;
          if (slide.dataset.heroOpen === "true") {
            closeSlide(slide);
            changed = true;
          }
        });
        if (changed) {
          requestAnimationFrame(() => syncPlaybackState("manual-close"));
        }
      }

      function toggleSlide(slide) {
        const isOpen = slide?.dataset.heroOpen === "true";
        if (!slide || slide.closest(".swiper-slide")?.classList.contains("swiper-slide-duplicate")) return;
        if (isOpen) {
          closeSlide(slide);
        } else {
          closeOtherSlides(slide);
          openSlide(slide);
        }
        requestAnimationFrame(() => syncPlaybackState("toggle"));
      }

      const closeOnSlideChange = () => closeOtherSlides(null);
      swiper.on("slideChangeTransitionStart", closeOnSlideChange);
      cleanupFns.push(() => swiper.off("slideChangeTransitionStart", closeOnSlideChange));

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
        if (isMobileMode) {
          return;
        }

        if (isHovered || isPointerDown || anyOpen) {
          freezeSwiper();
        } else {
          resumeSwiper();
        }
      }

      if (isMobileMode) {
        const mobileClickHandler = () => {
          const { openSlides } = collectCardState();
          if (openSlides.length <= 1) return;
          const latest = openSlides[openSlides.length - 1];
          const others = openSlides.filter((slide) => slide !== latest);
          suppressFooterChain = true;
          others.forEach((slide) => closeSlide(slide));
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
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        toggleSlide(activeSlide);
      };
      sliderEl.addEventListener("click", footerHandler, true);
      cleanupFns.push(() => sliderEl.removeEventListener("click", footerHandler, true));

      const navHandler = (event) => {
        const navBtn = event.target.closest(navSelector);
        if (!navBtn || !sliderEl.contains(navBtn)) return;
        closeOtherSlides(null);
      };
      sliderEl.addEventListener("click", navHandler, true);
      cleanupFns.push(() => sliderEl.removeEventListener("click", navHandler, true));

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
  }
})();
