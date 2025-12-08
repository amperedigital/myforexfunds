window.addEventListener("DOMContentLoaded", () => {
  const targets = document.querySelectorAll("[data-space-bg]");
  if (!targets.length) return;

  const UNICORN_SCRIPT =
    "https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v1.4.36/dist/unicornStudio.umd.js";
  let unicornScriptPromise = null;
  function ensureUnicornStudio() {
    if (window.UnicornStudio) {
      return Promise.resolve();
    }
    if (!unicornScriptPromise) {
      unicornScriptPromise = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = UNICORN_SCRIPT;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }
    return unicornScriptPromise;
  }
  function initUnicorn() {
    ensureUnicornStudio()
      .then(() => {
        if (window.UnicornStudio) {
          if (!window.UnicornStudio.isInitialized) {
            window.UnicornStudio.init();
            window.UnicornStudio.isInitialized = true;
          } else if (typeof window.UnicornStudio.refresh === "function") {
            window.UnicornStudio.refresh();
          }
        }
      })
      .catch(() => {
        console.warn("Unable to load Unicorn Studio embed.");
      });
  }

  const MOBILE_BREAKPOINT = 1024;
  const pointerMedia = window.matchMedia("(pointer: fine)");
  const prefersReducedMotionMedia = window.matchMedia("(prefers-reduced-motion: reduce)");
  const userAgent = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
  const isMobilePhone =
    /Mobi|Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent) &&
    !/iPad|Tablet|Silk|PlayBook|Kindle/i.test(userAgent);
  const isMobileViewport = () => window.innerWidth < MOBILE_BREAKPOINT;
  const UNICORN_ENABLE_DELAY = 8000;

  const starLayers = [
    { count: 120, size: [0.5, 1.1], speed: 0.02, twinkle: 0.25 },
    { count: 90, size: [1.0, 1.7], speed: 0.05, twinkle: 0.35 },
    { count: 55, size: [1.4, 2.3], speed: 0.08, twinkle: 0.5 }
  ];
  const getStarDensityScale = () => (isMobileViewport() ? 0.5 : 1);
  const DEFAULT_DUST_SPEED = 0.0075; // baseline movement calibration used before introducing speed scaling
  const dustConfig = { count: 18, size: [1.6, 4.8], speed: 0.00025, alpha: [0.03, 0.14] };
  let starParallaxScale = isMobileViewport() ? 0 : 0.2;
  let dustMotionBoost = isMobileViewport() ? 3 : 1;
  function parseBooleanAttribute(el, attr, fallback) {
    if (!el.hasAttribute(attr)) return fallback;
    const value = el.getAttribute(attr);
    return value !== "false";
  }
  function parseNumberAttribute(el, attr, fallback) {
    if (!el.hasAttribute(attr)) return fallback;
    const raw = (el.getAttribute(attr) || "").trim();
    if (raw === "") return fallback;
    const value = Number(raw);
    if (Number.isFinite(value)) {
      return value;
    }
    const floatVal = parseFloat(raw);
    return Number.isFinite(floatVal) ? floatVal : fallback;
  }
  function clamp01(value) {
    return Math.min(1, Math.max(0, value));
  }

  function fullBleed(el, { cover = false } = {}) {
    if (!el) return;
    el.style.position = "absolute";
    el.style.top = "0";
    el.style.left = "0";
    el.style.right = "0";
    el.style.bottom = "0";
    el.style.width = "100%";
    el.style.height = "100%";
    el.style.maxWidth = "100%";
    el.style.maxHeight = "100%";
    if (cover) {
      el.style.objectFit = "cover";
      el.style.background = "transparent";
    }
  }

  function setupVideo(section) {
    const slot = section.querySelector(".u-background-slot");
    const wrapper = section.querySelector(".bgvideo");
    if (!wrapper) return null;
    if (slot && wrapper.parentElement !== slot) {
      slot.appendChild(wrapper);
    }

    let host = wrapper.querySelector(".space-video-mask-host");
    if (!host) {
      host = document.createElement("div");
      host.className = "space-video-mask-host";
      while (wrapper.firstChild) {
        host.appendChild(wrapper.firstChild);
      }
      wrapper.appendChild(host);
    }

    fullBleed(wrapper);
    wrapper.style.zIndex = "1";
    wrapper.style.overflow = "hidden";
    fullBleed(host);
    host.style.zIndex = "1";

    const bunnyPlayer = host.querySelector(".bunny-player");
    if (bunnyPlayer) {
      fullBleed(bunnyPlayer);
      bunnyPlayer.style.padding = "0";
      bunnyPlayer.setAttribute("data-player-update-size", "false");
      const ratioShim = bunnyPlayer.querySelector(".bunny-player__before");
      if (ratioShim) ratioShim.remove();
    }

    const videoEl = host.querySelector(".bunny-player__video");
    if (videoEl) {
      fullBleed(videoEl, { cover: true });
      videoEl.removeAttribute("width");
      videoEl.removeAttribute("height");
      videoEl.style.opacity = "0";
      videoEl.style.transition = "opacity 2.8s ease";
      const revealVideo = () => {
        if (videoEl.dataset.spaceVideoRevealed === "true") return;
        videoEl.dataset.spaceVideoRevealed = "true";
        requestAnimationFrame(() => {
          videoEl.style.opacity = "1";
        });
      };
      videoEl.addEventListener("loadeddata", revealVideo);
      videoEl.addEventListener("canplay", revealVideo);
      setTimeout(revealVideo, 2000);
    }

    const placeholder = host.querySelector(".bunny-player__placeholder");
    if (placeholder) {
      const poster = placeholder.currentSrc || placeholder.src;
      if (poster && videoEl && !videoEl.getAttribute("poster")) {
        videoEl.setAttribute("poster", poster);
      }
      placeholder.remove();
    }

    return { host, video: videoEl || null };
  }

  const starPalette = [
    { rgb: [255, 255, 255], weight: 0.35 },
    { rgb: [200, 230, 255], weight: 0.25 },
    { rgb: [120, 210, 255], weight: 0.15 },
    { rgb: [140, 255, 220], weight: 0.15 },
    { rgb: [200, 255, 180], weight: 0.10 }
  ];
  let milkyWayGradient = null;
  let nebulaGradient = null;
  let anomaly = null;

  targets.forEach((el) => {
    if (getComputedStyle(el).position === "static") {
      el.style.position = "relative";
    }

    const showStars = parseBooleanAttribute(el, "data-space-bg-stars", true);
    const requestedNebula = parseBooleanAttribute(el, "data-space-bg-nebula", true);
    const overlayGlowEnabled = parseBooleanAttribute(el, "data-space-bg-glow", true);
    const showNebula = overlayGlowEnabled && requestedNebula;
    const showMilkyWay = overlayGlowEnabled;
    const starRegion = (el.getAttribute("data-space-bg-stars-region") || "full").toLowerCase();
    const starChuteEnabled = parseBooleanAttribute(el, "data-space-bg-stars-chute", false);
    const starSafeLeft = clamp01(parseNumberAttribute(el, "data-space-bg-stars-safe-left", 0.1));
    const starSafeRight = clamp01(
      parseNumberAttribute(el, "data-space-bg-stars-safe-right", 0.9)
    );
    const starSafeTop = clamp01(parseNumberAttribute(el, "data-space-bg-stars-safe-top", 0));
    const starSafeBottom = clamp01(
      parseNumberAttribute(el, "data-space-bg-stars-safe-bottom", 0.25)
    );
    const starSafeFadeDepth = clamp01(
      parseNumberAttribute(el, "data-space-bg-stars-safe-fade-depth", 0.12)
    );
    const starSafeSpawnAbove = clamp01(
      parseNumberAttribute(el, "data-space-bg-stars-safe-spawn", 1)
    );
    const starSafeFallSpeed = Math.max(
      0,
      parseNumberAttribute(el, "data-space-bg-stars-safe-speed", 0.5)
    );
    const unicornClipModeRaw =
      (el.getAttribute("data-space-bg-unicorn-clip") || "chute").toLowerCase();
    const unicornDelayAttr = Math.max(
      0,
      parseNumberAttribute(el, "data-space-bg-unicorn-delay", UNICORN_ENABLE_DELAY)
    );
    const unicornClipTopOverride = clamp01(
      parseNumberAttribute(el, "data-space-bg-unicorn-clip-top", 0)
    );
    const unicornClipBottomOverride = clamp01(
      parseNumberAttribute(el, "data-space-bg-unicorn-clip-bottom", 0)
    );
    const unicornClipTopMobileOverride = clamp01(
      parseNumberAttribute(el, "data-space-bg-unicorn-clip-top-mobile", unicornClipTopOverride)
    );
    const unicornClipBottomMobileOverride = clamp01(
      parseNumberAttribute(
        el,
        "data-space-bg-unicorn-clip-bottom-mobile",
        unicornClipBottomOverride > 0 ? unicornClipBottomOverride : 0.08
      )
    );
    const bgParallaxIntensity = parseNumberAttribute(el, "data-space-bg-img-parallax", 0);
    const dustEnabled = parseBooleanAttribute(el, "data-space-bg-dust", true);
    const dustAllowed = dustEnabled && !isMobileViewport();
    const dustCountAttr = parseNumberAttribute(el, "data-space-bg-dust-count", dustConfig.count);
    const normalizedDustCount = Math.max(0, Math.floor(dustCountAttr));
    const pointerParallaxStrength = Math.max(
      0,
      parseNumberAttribute(el, "data-space-bg-parallax-strength", 1)
    );
    const pointerParallaxEaseAttr = parseNumberAttribute(el, "data-space-bg-parallax-ease", 1);
    const pointerParallaxEase =
      !Number.isFinite(pointerParallaxEaseAttr) || pointerParallaxEaseAttr >= 1
        ? 1
        : Math.min(0.35, Math.max(0.01, pointerParallaxEaseAttr));
    const parallaxSlot = el.querySelector(".u-background-slot");
    const parallaxSlotBaseTransform = parallaxSlot ? parallaxSlot.style.transform || "" : "";

    const style = document.createElement("style");
    style.textContent = `
a[href*="unicorn.studio"]{display:none!important;opacity:0!important;pointer-events:none!important;}
.space-unicorn-layer{position:absolute;inset:0;z-index:2;pointer-events:none;overflow:hidden;mix-blend-mode:screen;opacity:0;transition:opacity 12s ease;clip-path:var(--space-layer-unicorn-clip,none);}
.space-unicorn-layer .space-unicorn{position:absolute;inset:0;pointer-events:none;}
.space-unicorn-layer .space-unicorn canvas,.space-unicorn-layer .space-unicorn div{width:100%!important;height:100%!important;}
.space-layer{position:absolute;inset:0;z-index:3;pointer-events:none;overflow:hidden;mix-blend-mode:screen;}
.space-layer canvas{position:absolute;inset:0;width:100%;height:100%;z-index:1;}
.space-layer .space-starfield,.space-layer .space-dustfield{mix-blend-mode:screen;}
.space-layer::before{content:"";position:absolute;inset:0;background:radial-gradient(ellipse at top,rgba(20,30,50,.45),transparent 55%),radial-gradient(ellipse at bottom,rgba(5,10,20,.55),transparent 65%);z-index:1;pointer-events:none;opacity:var(--space-layer-overlay-opacity,0);}
.space-layer.space-layer--no-glow::before{display:none;}
.space-video-mask-host{position:absolute;inset:0;width:100%;height:100%;overflow:hidden;z-index:1;}
.space-video-mask-host :is(.bunny-player,.bunny-player__video,.bunny-player__placeholder){position:absolute;inset:0;width:100%!important;height:100%!important;max-width:100%!important;max-height:100%!important;object-fit:cover;}
[data-space-bg]{position:relative;z-index:0;}
[data-space-bg] .u-image-wrapper{position:relative;z-index:1;isolation:isolate;}
[data-space-bg] .u-overlay{position:absolute;inset:0;z-index:2;mix-blend-mode:multiply;opacity:.92;pointer-events:none;}
[data-space-bg] :is(.u-container,.u-layout-wrapper,.u-layout,.u-layout-column,.space-bull,.u-text,.u-rich-text,.w-embed,.u-section-content,.u-content-wrapper){position:relative;z-index:5;}
`;
    document.head.appendChild(style);
    const videoContext = setupVideo(el) || {};
    const videoHost = videoContext.host || null;
    const videoEl = videoContext.video || null;

    function restartVideoPlayback() {
      if (!videoEl) return;
      try {
        videoEl.dataset.spaceVideoRevealed = "";
        videoEl.style.opacity = "0";
        videoEl.pause();
        videoEl.currentTime = 0;
        videoEl.load();
        const promise = videoEl.play();
        if (promise && typeof promise.catch === "function") {
          promise.catch(() => {});
        }
      } catch (err) {
        // ignore
      }
    }

    function pauseVideoPlayback() {
      if (!videoEl) return;
      try {
        videoEl.pause();
      } catch (err) {
        // ignore
      }
    }

    const layer = document.createElement("div");
    layer.className = "space-layer";
    if (!overlayGlowEnabled) {
      layer.classList.add("space-layer--no-glow");
    }
    const starCanvas = document.createElement("canvas");
    const dustCanvas = document.createElement("canvas");
    starCanvas.className = "space-starfield";
    dustCanvas.className = "space-dustfield";
    const unicornProjectId = el.getAttribute("data-space-bg-unicorn");
    let unicornLayer = null;
    let unicornAttachTimer = null;
    let unicornWasAllowed = false;
    function shouldEnableUnicorn() {
      return Boolean(unicornProjectId) && (!isMobilePhone || window.innerWidth >= MOBILE_BREAKPOINT);
    }
    function createUnicornLayer() {
      const layerEl = document.createElement("div");
      layerEl.className = "space-unicorn-layer";
      layerEl.style.opacity = "0";
      const unicornHost = document.createElement("div");
      unicornHost.className = "space-unicorn";
      unicornHost.dataset.usProject = unicornProjectId;
      layerEl.appendChild(unicornHost);
      return layerEl;
    }
    function attachUnicornLayer() {
      if (unicornLayer) return;
      unicornLayer = createUnicornLayer();
      requestAnimationFrame(initUnicorn);
      bgHost.appendChild(unicornLayer);
      applyUnicornOpacity(unicornOpacityValue);
      updateOverlayState();
    }
    function detachUnicornLayer() {
      if (!unicornLayer) return;
      unicornLayer.remove();
      unicornLayer = null;
      if (unicornFadeFrame) {
        cancelAnimationFrame(unicornFadeFrame);
        unicornFadeFrame = null;
      }
    }
    function scheduleUnicornAttach(delay) {
      if (unicornAttachTimer) return;
      unicornAttachTimer = setTimeout(() => {
        unicornAttachTimer = null;
        if (shouldEnableUnicorn()) {
          attachUnicornLayer();
        }
      }, delay);
    }
    function refreshUnicornLayer({ deferOnTransition = false } = {}) {
      const allowed = shouldEnableUnicorn();
      if (allowed) {
        if (unicornLayer) {
        } else if (deferOnTransition && !unicornWasAllowed) {
          scheduleUnicornAttach(unicornDelayAttr || UNICORN_ENABLE_DELAY);
        } else if (unicornDelayAttr > 0) {
          scheduleUnicornAttach(unicornDelayAttr);
        } else {
          attachUnicornLayer();
        }
      } else {
        detachUnicornLayer();
        if (unicornAttachTimer) {
          clearTimeout(unicornAttachTimer);
          unicornAttachTimer = null;
        }
      }
      unicornWasAllowed = allowed;
    }
    layer.appendChild(starCanvas);
    layer.appendChild(dustCanvas);
    const bgHost = parallaxSlot || el;
    if (parallaxSlot) {
      parallaxSlot.prepend(layer);
    } else {
      el.prepend(layer);
    }
    const starChuteActive =
      starChuteEnabled && starSafeRight > starSafeLeft && starSafeBottom > starSafeTop;
    const starChuteSpawnDepth = starChuteActive
      ? Math.max(0.02, Math.min(1, starSafeSpawnAbove))
      : 1;
    const starChutePointerStrength = starChuteActive ? Math.max(0, starSafeFallSpeed || 0) : 0;
    const starChuteMobileLift = starChuteActive && isMobileViewport() ? 0.35 : 0;
    const effectiveStarSafeBottom = starChuteActive
      ? Math.max(starSafeTop, Math.max(0, starSafeBottom - starChuteMobileLift))
      : starSafeBottom;
    const starChuteCoverageBottom = starChuteActive
      ? Math.min(1, Math.max(starSafeTop, effectiveStarSafeBottom + starSafeFadeDepth))
      : 1;
    const starChuteClipTop = starChuteActive ? Math.min(starSafeTop, starChuteCoverageBottom) : 0;
    const getUnicornClipTop = () =>
      clamp01(isMobileViewport() ? unicornClipTopMobileOverride : unicornClipTopOverride);
    const getUnicornClipBottom = () =>
      clamp01(isMobileViewport() ? unicornClipBottomMobileOverride : unicornClipBottomOverride);
    function buildFullUnicornClip() {
      const clipTop = getUnicornClipTop();
      const maxBottom = Math.max(0, 1 - clipTop);
      const clipBottom = Math.min(maxBottom, getUnicornClipBottom());
      if (clipTop <= 0 && clipBottom <= 0) {
        return "none";
      }
      return `inset(${(clipTop * 100).toFixed(3)}% 0% ${(clipBottom * 100).toFixed(3)}% 0%)`;
    }
    function buildChuteClip() {
      if (!starChuteActive) return "none";
      const clipTop = Math.max(starChuteClipTop, getUnicornClipTop());
      const bottomInset = Math.max(1 - starChuteCoverageBottom, getUnicornClipBottom());
      return `inset(${(clipTop * 100).toFixed(3)}% ${((1 - starSafeRight) * 100).toFixed(3)}% ${(
        bottomInset *
        100
      ).toFixed(3)}% ${(starSafeLeft * 100).toFixed(3)}%)`;
    }
    const getUnicornClipValue = () => {
      if (unicornClipModeRaw === "none") return "none";
      if (unicornClipModeRaw === "full") return buildFullUnicornClip();
      return buildChuteClip();
    };
    const UNICORN_FADE_IN_DURATION = 12000;
    const UNICORN_FADE_OUT_DURATION = 600;
    let unicornOpacityValue = 0;
    let unicornFadeFrame = null;
    refreshUnicornLayer();
    updateOverlayState();

    const starCtx = starCanvas.getContext("2d");
    const dustCtx = dustCanvas.getContext("2d");
    let w, h, stars = [], dust = [];
    let lastInitWidth = 0;
    let mouseX = 0, mouseY = 0;
    let mouseTargetX = 0, mouseTargetY = 0;
    let pointerActive = false;
    let pointerPaused = false;
    let pointerResumeTimer = null;
    let lastDustFrameTime = 0;
    let dustVisible = dustAllowed;
    let bgTargetX = 0, bgTargetY = 0;
    let bgSmoothX = 0, bgSmoothY = 0;
    const PARALLAX_EASE = 0.075;

    let parallaxReady = true;
    const PARALLAX_START_DELAY = 8000;

    function resize() {
      w = starCanvas.width = dustCanvas.width = el.clientWidth;
      h = starCanvas.height = dustCanvas.height = el.clientHeight;

      milkyWayGradient = starCtx.createLinearGradient(0, h * 0.2, w, h * 0.8);
      milkyWayGradient.addColorStop(0.0, "rgba(255,215,180,0.06)");
      milkyWayGradient.addColorStop(0.2, "rgba(250,235,210,0.1)");
      milkyWayGradient.addColorStop(0.45, "rgba(205,220,255,0.14)");
      milkyWayGradient.addColorStop(0.7, "rgba(150,190,255,0.1)");
      milkyWayGradient.addColorStop(1.0, "rgba(110,140,200,0.07)");

      nebulaGradient = starCtx.createLinearGradient(-w * 0.2, h * 0.1, w * 1.1, h * 0.9);
      nebulaGradient.addColorStop(0.0, "rgba(255,120,210,0.05)");
      nebulaGradient.addColorStop(0.4, "rgba(60,20,60,0)");
      nebulaGradient.addColorStop(0.8, "rgba(180,100,255,0.06)");
      nebulaGradient.addColorStop(1.0, "rgba(40,15,60,0)");
      updateBackgroundParallax();
    }


    function applyUnicornOpacity(value) {
      unicornOpacityValue = value;
      if (!unicornLayer) return;
      const clamped = Math.max(0, Math.min(1, value));
      const displayValue = clamped.toFixed(3);
      unicornLayer.style.setProperty("--space-layer-unicorn-opacity", displayValue);
      unicornLayer.style.opacity = displayValue;
    }
    function animateUnicornOpacity(targetValue, duration) {
      if (!unicornLayer) {
        unicornOpacityValue = targetValue;
        return;
      }
      if (unicornFadeFrame) {
        cancelAnimationFrame(unicornFadeFrame);
        unicornFadeFrame = null;
      }
      const startValue = unicornOpacityValue;
      const delta = targetValue - startValue;
      if (Math.abs(delta) < 0.001 || duration <= 0) {
        applyUnicornOpacity(targetValue);
        return;
      }
      const startTime = performance.now();
      const ease = (t) => t * t * (3 - 2 * t);
      const step = () => {
        const now = performance.now();
        const progress = Math.min(1, (now - startTime) / duration);
        const eased = ease(progress);
        applyUnicornOpacity(startValue + delta * eased);
        if (progress < 1) {
          unicornFadeFrame = requestAnimationFrame(step);
        } else {
          unicornFadeFrame = null;
        }
      };
      unicornFadeFrame = requestAnimationFrame(step);
    }

    function updateOverlayState() {
      const overlayVisible = showNebula;
      layer.style.setProperty("--space-layer-overlay-opacity", overlayVisible ? "1" : "0");
      layer.style.setProperty("--space-layer-overlay-clip", "none");

      if (unicornLayer) {
        const unicornOpacity = 0.22;
        const clipValue = getUnicornClipValue();
        unicornLayer.style.setProperty("--space-layer-unicorn-clip", clipValue);
        const duration =
          unicornOpacity > unicornOpacityValue ? UNICORN_FADE_IN_DURATION : UNICORN_FADE_OUT_DURATION;
        animateUnicornOpacity(unicornOpacity, duration);
      }
    }

  function rand(min, max) {
    return Math.random() * (max - min) + min;
  }

  function pickPaletteColor() {
    const total = starPalette.reduce((sum, c) => sum + c.weight, 0);
    let r = Math.random() * total;
    for (const c of starPalette) {
      if ((r -= c.weight) <= 0) return c.rgb;
    }
    return starPalette[0].rgb;
  }

    function computeRegionBounds() {
      switch (starRegion) {
        case "top-left":
          return { minX: 0, maxX: w * 0.5, minY: 0, maxY: h * 0.5 };
        case "top-right":
          return { minX: w * 0.5, maxX: w, minY: 0, maxY: h * 0.5 };
        case "bottom-left":
          return { minX: 0, maxX: w * 0.5, minY: h * 0.5, maxY: h };
        case "bottom-right":
          return { minX: w * 0.5, maxX: w, minY: h * 0.5, maxY: h };
        case "center":
          return { minX: w * 0.25, maxX: w * 0.75, minY: h * 0.25, maxY: h * 0.75 };
        default:
          return { minX: 0, maxX: w, minY: 0, maxY: h };
      }
    }

    function createBaseStar(layerCfg) {
      const rgb = pickPaletteColor();
      const baseRadius = rand(layerCfg.size[0], layerCfg.size[1]);
      return {
        x: 0,
        y: 0,
        r: baseRadius,
        speed: layerCfg.speed,
        twinkle: layerCfg.twinkle,
        twinkleAmp: rand(0.3, 0.8),
        twinkleOffset: Math.random() * Math.PI * 2,
        pulseSpeed: rand(0.08, 0.35),
        pulseOffset: Math.random() * Math.PI * 2,
        pulseAmount: rand(0.05, 0.35),
        baseAlpha: rand(0.4, 0.9),
        layer: layerCfg,
        color: rgb,
        isChute: false
      };
    }

    function init() {
      lastInitWidth = w;
      stars = [];
      if (showStars) {
        const region = computeRegionBounds();
        const densityScale = getStarDensityScale();
        starLayers.forEach((layerCfg) => {
          const scaledCount = Math.max(1, Math.round(layerCfg.count * densityScale));
          for (let i = 0; i < scaledCount; i++) {
            const star = createBaseStar(layerCfg);
            if (starChuteActive) {
              star.isChute = true;
              star.x = Math.random();
              star.y = Math.random() * starChuteSpawnDepth;
            } else {
              star.x = rand(region.minX, region.maxX);
              star.y = rand(region.minY, region.maxY);
            }
            stars.push(star);
          }
        });
      }

      dust = [];
      if (dustAllowed) {
        for (let i = 0; i < normalizedDustCount; i++) {
          const maxDriftX = rand(0.00035, 0.0008);
          const maxDriftY = rand(0.00025, 0.00065);
          dust.push({
            x: Math.random() * w,
            y: Math.random() * h,
            r: rand(dustConfig.size[0], dustConfig.size[1]),
            alpha: rand(dustConfig.alpha[0], dustConfig.alpha[1]),
            baseAlpha: rand(dustConfig.alpha[0], dustConfig.alpha[1]),
            alphaPulseAmp: rand(0.25, 0.55),
            alphaPulseSpeed: rand(0.02, 0.08),
            alphaPulseOffset: Math.random() * Math.PI * 2,
            driftX: rand(-maxDriftX, maxDriftX),
            driftY: rand(-maxDriftY, maxDriftY),
            maxDriftX,
            maxDriftY,
            driftJitter: rand(0.00001, 0.00005),
            swayAmp: rand(0.04, 0.18),
            swaySpeed: rand(0.004, 0.016),
            swayPhaseX: Math.random() * Math.PI * 2,
            swayPhaseY: Math.random() * Math.PI * 2,
            hueShift: rand(-10, 25)
          });
        }
      }
    }

    function drawStars(time) {
      starCtx.clearRect(0, 0, w, h);

      const shouldRenderGradient = showMilkyWay && milkyWayGradient;
      if (shouldRenderGradient) {
        starCtx.fillStyle = milkyWayGradient;
        starCtx.fillRect(0, 0, w, h);
      }

      const nebulaAllowed = showNebula && nebulaGradient;
      if (nebulaAllowed) {
        starCtx.save();
        starCtx.globalCompositeOperation = "lighter";
        starCtx.fillStyle = nebulaGradient;
        starCtx.fillRect(0, 0, w, h);
        starCtx.restore();
      }

      const t = (time || 0) * 0.001;
      const chuteLeftPx = starSafeLeft * w;
      const chuteRightPx = starSafeRight * w;
      const chuteFadeStartPx = effectiveStarSafeBottom * h;
      const chuteFadeDepthPx = Math.max(1, starSafeFadeDepth * h);
      const chuteWidthPx = Math.max(1, chuteRightPx - chuteLeftPx);
      const chuteHeightPx = Math.max(1, chuteFadeStartPx + chuteFadeDepthPx);

      for (const s of stars) {
        let x;
        let y;
        if (starChuteActive && s.isChute) {
          const baseX = chuteLeftPx + s.x * chuteWidthPx;
          const baseY = Math.min(chuteHeightPx, s.y * chuteHeightPx);
          const pointerOffsetX = mouseX * chuteWidthPx * 0.1 * starChutePointerStrength;
          const pointerOffsetY = mouseY * chuteHeightPx * 0.06 * starChutePointerStrength;
          x = Math.max(chuteLeftPx, Math.min(chuteRightPx, baseX + pointerOffsetX));
          y = Math.max(0, Math.min(chuteFadeStartPx + chuteFadeDepthPx, baseY + pointerOffsetY));
        } else {
          const layerSpeed = s.layer.speed * starParallaxScale;
          const parallax = 1 + layerSpeed * 40;
          x = (s.x + mouseX * parallax * 20 + w) % w;
          y = (s.y + mouseY * parallax * 12 + h) % h;
        }

        const twinkleWave = Math.sin(t * s.twinkle + s.twinkleOffset);
        const tw = s.baseAlpha + twinkleWave * s.twinkleAmp;
        let alpha = Math.max(0.06, Math.min(1, tw));
        if (starChuteActive && s.isChute && y >= chuteFadeStartPx) {
          const fadeProgress = (y - chuteFadeStartPx) / chuteFadeDepthPx;
          const fade = Math.max(0, 1 - Math.min(1, fadeProgress));
          if (fade <= 0.01) continue;
          alpha *= fade;
        }
        const pulse = 1 + Math.sin(t * s.pulseSpeed + s.pulseOffset) * s.pulseAmount;
        const renderRadius = Math.max(0.2, s.r * pulse);
        const [r, g, b] = s.color;
        starCtx.beginPath();
        starCtx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
        starCtx.arc(x, y, renderRadius, 0, Math.PI * 2);
        starCtx.fill();
      }
    }

    function maybeSpawnAnomaly(time) {
      if (anomaly) return;
      if (Math.random() < 0.002) {
        const startX = Math.random() * w * 0.6 + w * 0.2;
        const startY = Math.random() * h * 0.6 + h * 0.2;
        const angle = Math.random() * Math.PI * 2;
        const len = rand(80, 140);
        const life = rand(600, 1200); // ms
        const speed = rand(0.3, 0.7);
        anomaly = {
          x: startX,
          y: startY,
          dx: Math.cos(angle) * speed,
          dy: Math.sin(angle) * speed,
          len,
          endTime: performance.now() + life,
          alpha: 0.5 + Math.random() * 0.4
        };
      }
    }

    function drawAnomaly(now) {
      if (!anomaly) return;
      const remaining = anomaly.endTime - now;
      if (remaining <= 0) {
        anomaly = null;
        return;
      }
      anomaly.x += anomaly.dx * 16;
      anomaly.y += anomaly.dy * 16;
      starCtx.save();
      starCtx.globalAlpha = anomaly.alpha * Math.max(0, remaining / 1200);
      starCtx.strokeStyle = "rgba(180,220,255,0.9)";
      starCtx.lineWidth = 2;
      starCtx.beginPath();
      starCtx.moveTo(anomaly.x, anomaly.y);
      starCtx.lineTo(anomaly.x - anomaly.dx * anomaly.len, anomaly.y - anomaly.dy * anomaly.len);
      starCtx.stroke();
      starCtx.restore();
    }

    function drawDust(time) {
      const now = time || performance.now();
      if (!dustVisible) {
        lastDustFrameTime = now;
        return;
      }
      const deltaMs = lastDustFrameTime ? now - lastDustFrameTime : 16.67;
      lastDustFrameTime = now;
      const frameScale = Math.min(2.5, deltaMs / 16.67);
      const speedScale = (dustConfig.speed || DEFAULT_DUST_SPEED) / DEFAULT_DUST_SPEED;
      const motionScale = Math.max(0, frameScale * speedScale) * (isMobileViewport() ? dustMotionBoost : 1);
      const t = now * 0.001;
      dustCtx.clearRect(0, 0, w, h);
      for (const d of dust) {
        d.driftX *= 0.96;
        d.driftY *= 0.96;
        d.driftX += rand(-d.driftJitter, d.driftJitter);
        d.driftY += rand(-d.driftJitter, d.driftJitter);
        d.driftX = Math.max(-d.maxDriftX, Math.min(d.maxDriftX, d.driftX));
        d.driftY = Math.max(-d.maxDriftY, Math.min(d.maxDriftY, d.driftY));
        const swayX = Math.cos(t * d.swaySpeed + d.swayPhaseX) * d.swayAmp;
        const swayY = Math.sin(t * d.swaySpeed + d.swayPhaseY) * d.swayAmp;
        d.x += (d.driftX + swayX) * motionScale + mouseX * 4 * (0.6 + d.r * 0.2) * motionScale;
        d.y += (d.driftY + swayY) * motionScale + mouseY * 3.5 * (0.6 + d.r * 0.2) * motionScale;
        if (d.x < -20) d.x = w + 20;
        if (d.x > w + 20) d.x = -20;
        if (d.y < -20) d.y = h + 20;
        if (d.y > h + 20) d.y = -20;
        const pulse = 1 + Math.sin(t * d.alphaPulseSpeed + d.alphaPulseOffset) * d.alphaPulseAmp;
        const alpha = Math.max(0, Math.min(1, d.baseAlpha * pulse));
        const radius = Math.max(0.6, d.r * (0.8 + pulse * 0.25));
        const tint = 220 + d.hueShift; // keep near white with slight warmth/cool shift
        dustCtx.save();
        dustCtx.shadowBlur = radius * 6;
        dustCtx.shadowColor = `rgba(${tint},${tint},255,${alpha})`;
        dustCtx.beginPath();
        dustCtx.fillStyle = `rgba(${tint},${tint},255,${alpha * 0.9})`;
        dustCtx.arc(d.x + mouseX * 8, d.y + mouseY * 6, radius, 0, Math.PI * 2);
        dustCtx.fill();
        dustCtx.restore();
      }
    }

    function tick(time) {
      if (bgParallaxActive) {
        bgSmoothX += (bgTargetX - bgSmoothX) * PARALLAX_EASE;
        bgSmoothY += (bgTargetY - bgSmoothY) * PARALLAX_EASE;
      }
      if (pointerParallaxEase === 1) {
        mouseX = mouseTargetX;
        mouseY = mouseTargetY;
      } else {
        mouseX += (mouseTargetX - mouseX) * pointerParallaxEase;
        mouseY += (mouseTargetY - mouseY) * pointerParallaxEase;
      }
      drawStars(time);
      drawDust(time);
      maybeSpawnAnomaly(time || 0);
      drawAnomaly(time || 0);
      requestAnimationFrame(tick);
    }

    let bgParallaxActive = false;
    function refreshParallaxMode() {
      const shouldEnable = bgParallaxIntensity > 0 && !isMobileViewport() && pointerMedia.matches;
      if (shouldEnable === bgParallaxActive) return;
      bgParallaxActive = shouldEnable;
      if (!bgParallaxActive) {
        parallaxReady = true;
        bgTargetX = 0;
        bgTargetY = 0;
        bgSmoothX = 0;
        bgSmoothY = 0;
        updateBackgroundParallax();
      } else {
        parallaxReady = false;
        setTimeout(() => {
          parallaxReady = true;
          bgSmoothX = bgTargetX;
          bgSmoothY = bgTargetY;
          updateBackgroundParallax();
        }, PARALLAX_START_DELAY);
      }
    }
    refreshParallaxMode();
    function updateBackgroundParallax() {
      if (!bgParallaxActive || !parallaxReady) return;
      const offsetX = bgSmoothX * bgParallaxIntensity * 20;
      const offsetY = bgSmoothY * bgParallaxIntensity * 12;
      const posX = 50 + offsetX;
      const posY = 50 + offsetY;
      el.style.backgroundPosition = `${posX}% ${posY}%`;
      if (parallaxSlot) {
        const translate = `translate(${offsetX}px, ${offsetY}px)`;
        parallaxSlot.style.transform = parallaxSlotBaseTransform
          ? `${parallaxSlotBaseTransform} ${translate}`
          : translate;
      }
    }

    function handleMouse(e) {
      const rect = el.getBoundingClientRect();
      const normalizedX = (e.clientX - rect.left) / w - 0.5;
      const normalizedY = (e.clientY - rect.top) / h - 0.5;
      if (pointerPaused) return;
      mouseTargetX = normalizedX * pointerParallaxStrength;
      mouseTargetY = normalizedY * pointerParallaxStrength;
      bgTargetX = normalizedX;
      bgTargetY = normalizedY;
      if (!pointerActive) {
        pointerActive = true;
      }
      updateBackgroundParallax();
    }

    function handleMouseLeave() {
      mouseTargetX = 0;
      mouseTargetY = 0;
      bgTargetX = 0;
      bgTargetY = 0;
      updateBackgroundParallax();
      pausePointerParallax();
    }
    const PARALLAX_RESUME_DELAY = 5000;
    function pausePointerParallax() {
      pointerPaused = true;
      pointerActive = false;
      if (pointerResumeTimer) {
        clearTimeout(pointerResumeTimer);
        pointerResumeTimer = null;
      }
      pointerResumeTimer = setTimeout(() => {
        pointerPaused = false;
        pointerResumeTimer = null;
      }, PARALLAX_RESUME_DELAY);
    }
    let pointerHandlersAttached = false;
    function attachPointerHandlers() {
      if (pointerHandlersAttached) return;
      el.addEventListener("mousemove", handleMouse);
      el.addEventListener("mouseleave", handleMouseLeave);
      pointerHandlersAttached = true;
    }
    function detachPointerHandlers() {
      if (!pointerHandlersAttached) return;
      el.removeEventListener("mousemove", handleMouse);
      el.removeEventListener("mouseleave", handleMouseLeave);
      pointerHandlersAttached = false;
      pointerActive = false;
      mouseTargetX = 0;
      mouseTargetY = 0;
    }

    resize();
    init();
    requestAnimationFrame(tick);
    let resizeTimeout = null;
    window.addEventListener("resize", () => {
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }
      resizeTimeout = setTimeout(() => {
        const widthAtLastInit = lastInitWidth > 0 ? lastInitWidth : w;
        starParallaxScale = isMobileViewport() ? 0 : 0.2;
        dustMotionBoost = isMobileViewport() ? 3 : 1;
        refreshParallaxMode();
        refreshPointerHandlers();
        refreshUnicornLayer({ deferOnTransition: true });
        resize();
        if (Math.abs(w - widthAtLastInit) >= 1) {
          init();
        }
        restartVideoPlayback();
      }, 200);
    });
    function refreshPointerHandlers() {
      if (!isMobileViewport() && pointerMedia.matches) {
        attachPointerHandlers();
      } else {
        detachPointerHandlers();
      }
    }
    refreshPointerHandlers();
    pointerMedia.addEventListener("change", () => {
      refreshPointerHandlers();
      refreshUnicornLayer({ deferOnTransition: true });
    });

    if (videoEl) {
      const handleVisibilityChange = () => {
        if (document.hidden) {
          pauseVideoPlayback();
        } else {
          restartVideoPlayback();
        }
      };
      document.addEventListener("visibilitychange", handleVisibilityChange);
      window.addEventListener("pageshow", (event) => {
        if (event.persisted) {
          restartVideoPlayback();
        }
      });
      window.addEventListener("pagehide", pauseVideoPlayback);
    }

  });
});
