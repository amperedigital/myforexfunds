(() => {
  const HOST_SELECTOR = '[data-bull-src].space-bull';
  const STYLE_ID = 'space-bull-styles';
  const KEYFRAMES = `@keyframes bull-stroke-draw { to { stroke-dashoffset: 0; opacity: 1; } }`;

  const DEFAULTS = {
    duration: 2800,
    baseDelay: 0,
    stagger: 1800,
    easing: 'power2.out',
    pathSelector: 'path',
    fade: false,
    threshold: 0.6,
    rootMargin: '0px 0px -20% 0px',
    laserSpread: 360,
    beamGlow: true,
    glowStrength: 0.85,
    particles: true,
    particlePool: 2520,
    particleRate: 70,
    particleDuration: 650,
    particleSpread: 16,
    particleSizeMin: 0.6,
    particleSizeMax: 2.6,
  };

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      ${HOST_SELECTOR} {
        position: relative;
        display: block;
        max-width: 100%;
        padding: 0;
        box-sizing: border-box;
      }
      ${HOST_SELECTOR} svg {
        display: block;
        width: 100%;
        height: auto;
        max-width: 100%;
      }
      ${HOST_SELECTOR} > :not(.space-bull__svg) {
        display: none !important;
      }
      ${HOST_SELECTOR} path {
        fill: none !important;
      }
      ${HOST_SELECTOR} .space-bull__laser-head circle:first-child {
        fill: rgba(255, 255, 255, 0.4);
        filter: blur(6px);
      }
      ${HOST_SELECTOR} .space-bull__laser-head--left circle:last-child {
        fill: #7cf5ff;
      }
      ${HOST_SELECTOR} .space-bull__laser-head--right circle:last-child {
        fill: #fcb1ff;
      }
      ${HOST_SELECTOR} .space-bull__beam {
        stroke-width: 1.6;
        stroke-linecap: round;
        opacity: 0;
      }
      ${HOST_SELECTOR} .space-bull__beam--left {
        stroke: rgba(124, 245, 255, 0.7);
        filter: drop-shadow(0 0 6px rgba(124, 245, 255, 0.9));
      }
      ${HOST_SELECTOR} .space-bull__beam--right {
        stroke: rgba(252, 177, 255, 0.7);
        filter: drop-shadow(0 0 6px rgba(252, 177, 255, 0.9));
      }
      ${HOST_SELECTOR} .space-bull__particles circle {
        fill: rgba(102, 204, 255, 0.95);
        filter: drop-shadow(0 0 8px rgba(102, 204, 255, 0.85));
        opacity: 0;
      }
      ${HOST_SELECTOR} .space-bull__svg [data-bull-eye],
      ${HOST_SELECTOR} .space-bull__svg polygon#Eye,
      ${HOST_SELECTOR} .space-bull__svg polygon#Nose {
        fill: transparent;
        transition: fill 200ms ease, stroke-opacity 200ms ease;
        stroke-opacity: 0;
        opacity: 0;
        display: none;
      }
      ${HOST_SELECTOR}.space-bull--paths-ready .space-bull__svg [data-bull-eye],
      ${HOST_SELECTOR}.space-bull--paths-ready .space-bull__svg polygon#Eye,
      ${HOST_SELECTOR}.space-bull--paths-ready .space-bull__svg polygon#Nose {
        fill: #d4a680;
        stroke: #d4a680;
        stroke-opacity: 1;
        opacity: 1;
        display: block;
      }
      ${KEYFRAMES}
    `;
    document.head.appendChild(style);
  }

  function parseNumber(value, fallback) {
    if (value === null || value === undefined || value === '') return fallback;
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function parseViewBox(vb) {
    if (!vb) return { x: 0, y: 0, width: 0, height: 0 };
    const parts = vb.split(/\s+/).map(Number);
    if (parts.length === 4 && parts.every(Number.isFinite)) {
      return { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
    }
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  function setEyeReady(host, ready) {
    host.classList.toggle('space-bull--paths-ready', ready);
  }

  function getConfig(host) {
    return {
      duration: parseNumber(host.getAttribute('data-bull-duration'), DEFAULTS.duration),
      baseDelay: parseNumber(host.getAttribute('data-bull-base-delay'), DEFAULTS.baseDelay),
      stagger: parseNumber(host.getAttribute('data-bull-stagger'), DEFAULTS.stagger),
      easing: host.getAttribute('data-bull-easing') || DEFAULTS.easing,
      pathSelector: host.getAttribute('data-bull-path-selector') || DEFAULTS.pathSelector,
      fade: host.hasAttribute('data-bull-fade')
        ? host.getAttribute('data-bull-fade') !== 'false'
        : host.hasAttribute('data-bull-no-fade')
        ? false
        : DEFAULTS.fade,
      threshold: parseNumber(host.getAttribute('data-bull-threshold'), DEFAULTS.threshold),
      repeat: host.hasAttribute('data-bull-repeat'),
      rootMargin: host.getAttribute('data-bull-root-margin') || DEFAULTS.rootMargin,
      playOnLoad: host.hasAttribute('data-bull-play-onload'),
      laserSpread: parseNumber(host.getAttribute('data-bull-spread'), DEFAULTS.laserSpread),
      beamGlow: host.hasAttribute('data-bull-no-glow') ? false : DEFAULTS.beamGlow,
      glowStrength: parseNumber(host.getAttribute('data-bull-glow-strength'), DEFAULTS.glowStrength),
      particles: host.hasAttribute('data-bull-no-particles') ? false : DEFAULTS.particles,
      particlePool: parseNumber(host.getAttribute('data-bull-particle-count'), DEFAULTS.particlePool),
      particleRate: parseNumber(host.getAttribute('data-bull-particle-rate'), DEFAULTS.particleRate),
      particleDuration: parseNumber(host.getAttribute('data-bull-particle-duration'), DEFAULTS.particleDuration),
      particleSpread: parseNumber(host.getAttribute('data-bull-particle-spread'), DEFAULTS.particleSpread),
      particleSizeMin: parseNumber(host.getAttribute('data-bull-particle-size-min'), DEFAULTS.particleSizeMin),
      particleSizeMax: parseNumber(host.getAttribute('data-bull-particle-size-max'), DEFAULTS.particleSizeMax),
    };
  }

  const TRIGGER_REGISTRY = new Map();

  function normalizeTriggerKey(value) {
    if (typeof value !== 'string') return '';
    return value.replace(/^#/, '').trim();
  }

  function registerHostTriggers(host) {
    const candidates = new Set();
    const attr = host.getAttribute('data-bull-trigger');
    if (attr) {
      attr.split(',').forEach(name => {
        const normalized = normalizeTriggerKey(name);
        if (normalized) {
          candidates.add(normalized);
        }
      });
    }
    if (host.id) {
      const normalizedId = normalizeTriggerKey(host.id);
      if (normalizedId) {
        candidates.add(normalizedId);
      }
    }
    candidates.forEach(name => {
      if (!TRIGGER_REGISTRY.has(name)) {
        TRIGGER_REGISTRY.set(name, new Set());
      }
      TRIGGER_REGISTRY.get(name).add(host);
    });
  }

  function resolveTriggerHosts(target) {
    if (!target) return [];
    if (typeof target === 'string') {
      const normalized = normalizeTriggerKey(target);
      const registered = TRIGGER_REGISTRY.get(normalized);
      if (registered && registered.size) {
        return Array.from(registered);
      }
      return [];
    }
    if (target instanceof Element) {
      const host = target.matches(HOST_SELECTOR) ? target : target.closest(HOST_SELECTOR);
      return host ? [host] : [];
    }
    return [];
  }

  function triggerSpaceBull(target) {
    const hosts = resolveTriggerHosts(target);
    hosts.forEach(host => host.playBull?.());
    return hosts.length > 0;
  }

  function exposeTriggerAPI() {
    if (typeof window === 'undefined') return;
    const hostApi = window.spaceBull || {};
    if (!hostApi.triggerSpaceBull) {
      hostApi.triggerSpaceBull = triggerSpaceBull;
    }
    if (!hostApi.trigger) {
      hostApi.trigger = triggerSpaceBull;
    }
    if (!hostApi.play) {
      hostApi.play = triggerSpaceBull;
    }
    window.spaceBull = hostApi;
    if (typeof window.triggerSpaceBull === 'undefined') {
      window.triggerSpaceBull = triggerSpaceBull;
    }
  }

  async function fetchSVG(src) {
    const response = await fetch(src);
    if (!response.ok) {
      throw new Error(`Failed to load SVG: ${response.status} ${response.statusText}`);
    }
    const text = await response.text();
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
    const svg = doc.querySelector('svg');
    if (!svg) throw new Error('No <svg> root found');
    svg.removeAttribute('width');
    svg.removeAttribute('height');
    if (!svg.getAttribute('preserveAspectRatio')) {
      svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    }
    return svg;
  }

  function resetPath(path, length, config) {
    const dash = `${length}px`;
    path.style.strokeDasharray = dash;
    path.style.strokeDashoffset = dash;
    path.style.opacity = config.fade ? '0' : '';
  }

  function preparePaths(svg, config) {
    const nodes = Array.from(svg.querySelectorAll(config.pathSelector));
    const valid = nodes.filter(node => typeof node.getTotalLength === 'function');
    return valid.map(path => {
      const length = Math.max(path.getTotalLength(), 0.1);
      const bbox = path.getBBox();
      const centerY = bbox.y + bbox.height / 2;
      const dash = `${length}px`;
      path.setAttribute('data-bull-path', '');
      path.dataset.bullDash = dash;
      resetPath(path, length, config);
      return { path, length, centerY, dash };
    });
  }

  function createLaserElements(svg, config) {
    const defs = ensureDefs(svg);
    const glow = config.beamGlow
      ? createBeamGradients(defs, config)
      : null;
    const leftHead = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    leftHead.classList.add('space-bull__laser-head', 'space-bull__laser-head--left');
    const leftGlow = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    leftGlow.setAttribute('r', '10');
    const leftCore = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    leftCore.setAttribute('r', '3');
    leftHead.append(leftGlow, leftCore);

    const rightHead = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    rightHead.classList.add('space-bull__laser-head', 'space-bull__laser-head--right');
    const rightGlow = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    rightGlow.setAttribute('r', '10');
    const rightCore = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    rightCore.setAttribute('r', '3');
    rightHead.append(rightGlow, rightCore);

    const leftBeam = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    leftBeam.classList.add('space-bull__beam', 'space-bull__beam--left');
    const rightBeam = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    rightBeam.classList.add('space-bull__beam', 'space-bull__beam--right');
    if (glow) {
      leftBeam.setAttribute('stroke', `url(#${glow.left})`);
      rightBeam.setAttribute('stroke', `url(#${glow.right})`);
      leftBeam.setAttribute('stroke-opacity', config.glowStrength);
      rightBeam.setAttribute('stroke-opacity', config.glowStrength);
    }

    leftHead.style.display = 'none';
    rightHead.style.display = 'none';

    let particleEmitter = null;
    if (config.particles && config.particlePool > 0) {
      const particleLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      particleLayer.classList.add('space-bull__particles');
      const poolSize = Math.max(1, Math.floor(config.particlePool));
      const pool = [];
      for (let i = 0; i < poolSize; i += 1) {
        const particle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        particleLayer.appendChild(particle);
        pool.push(particle);
      }
      svg.appendChild(particleLayer);
      particleEmitter = {
        enabled: true,
        pool,
        index: 0,
        lastEmit: 0,
        emit(x, y) {
          if (!pool.length) return;
          const circle = pool[this.index];
          this.index = (this.index + 1) % pool.length;
          animateParticle(circle, config, x, y);
        },
      };
    }

    svg.append(leftBeam, rightBeam, leftHead, rightHead);
    return {
      heads: [leftHead, rightHead],
      beams: [leftBeam, rightBeam],
      anchors: [
        { x: 0, y: 0 },
        { x: 0, y: 0 },
      ],
      offsets: [
        { x: -3, y: 0 },
        { x: 3, y: 0 },
      ],
      particles: particleEmitter,
    };
  }

  function ensureDefs(svg) {
    let defs = svg.querySelector('defs');
    if (!defs) {
      defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      svg.insertBefore(defs, svg.firstChild || null);
    }
    return defs;
  }

  function createBeamGradients(defs, config) {
    const uid = `space-bull-grad-${Math.random().toString(36).slice(2)}`;
    const gradients = {
      left: `${uid}-left`,
      right: `${uid}-right`,
    };
    createGradient(defs, gradients.left, '#7cf5ff', config.glowStrength);
    createGradient(defs, gradients.right, '#fcb1ff', config.glowStrength);
    return gradients;
  }

  function createGradient(defs, id, color, strength) {
    const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    gradient.id = id;
    gradient.setAttribute('x1', '0%');
    gradient.setAttribute('x2', '100%');
    gradient.setAttribute('y1', '0%');
    gradient.setAttribute('y2', '0%');

    const stops = [
      { offset: '0%', opacity: strength },
      { offset: '60%', opacity: strength * 0.5 },
      { offset: '100%', opacity: 0 },
    ];

    stops.forEach(stop => {
      const stopEl = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
      stopEl.setAttribute('offset', stop.offset);
      stopEl.setAttribute('stop-color', color);
      stopEl.setAttribute('stop-opacity', stop.opacity.toFixed(3));
      gradient.appendChild(stopEl);
    });

    defs.appendChild(gradient);
  }

  function animateParticle(circle, config, x, y) {
    const sizeRange = Math.max(config.particleSizeMax - config.particleSizeMin, 0.1);
    const radius = config.particleSizeMin + Math.random() * sizeRange;
    circle.setAttribute('cx', x);
    circle.setAttribute('cy', y);
    circle.setAttribute('r', radius.toFixed(2));
    circle.style.opacity = '1';
    circle.style.transform = 'translate(0px, 0px)';

    const driftX = (Math.random() - 0.5) * config.particleSpread;
    const driftY = config.particleSpread * (0.8 + Math.random());
    const duration = Math.max(120, config.particleDuration);

    if (circle._particleAnimation?.cancel) {
      circle._particleAnimation.cancel();
    }

    if (circle.animate) {
      circle._particleAnimation = circle.animate(
        [
          { transform: 'translate(0px, 0px)', opacity: 1 },
          { transform: `translate(${driftX}px, ${driftY}px)`, opacity: 0 },
        ],
        { duration, easing: 'ease-out', fill: 'forwards' }
      );
      circle._particleAnimation.onfinish = () => {
        circle.style.opacity = '0';
        circle.style.transform = '';
        circle._particleAnimation = null;
      };
    } else {
      circle.style.transition = 'none';
      requestAnimationFrame(() => {
        circle.style.transition = `transform ${duration}ms ease-out, opacity ${duration}ms ease-out`;
        circle.style.transform = `translate(${driftX}px, ${driftY}px)`;
        circle.style.opacity = '0';
        setTimeout(() => {
          circle.style.transition = '';
          circle.style.transform = '';
        }, duration + 50);
      });
    }
  }

  function buildGsapTimeline(paths, config, lasers, host) {
    if (!window.gsap) {
      return null;
    }

    const drawPlugin =
      window.DrawSVGPlugin ||
      (window.gsap.plugins && (window.gsap.plugins.DrawSVGPlugin || window.gsap.plugins.drawSVG));
    if (drawPlugin) {
      window.gsap.registerPlugin(drawPlugin);
    }

    const ordered = paths
      .slice()
      .sort((a, b) => {
        if (a.centerY === b.centerY) {
          try {
            return a.path.getPointAtLength(0).x - b.path.getPointAtLength(0).x;
          } catch {
            return 0;
          }
        }
        return b.centerY - a.centerY;
      });

    const totalLength = ordered.reduce((sum, entry) => sum + entry.length, 0) || 1;
    const totalDurationSec = Math.max(0.2, config.duration / 1000);
    const minSegSec = Math.min(0.25, totalDurationSec / Math.max(1, ordered.length) * 0.75);
    const maxSegSec = Math.max(minSegSec * 1.5, totalDurationSec * 0.35);
    const tl = window.gsap.timeline({ paused: true });
    let cursor = config.baseDelay / 1000;

    const showLasers = () => {
      lasers?.heads?.forEach(head => {
        head.style.display = 'block';
      });
      lasers?.beams?.forEach(beam => {
        beam.style.opacity = '1';
      });
    };

    const hideLasers = () => {
      lasers?.heads?.forEach(head => {
        head.style.display = 'none';
      });
      lasers?.beams?.forEach(beam => {
        beam.style.opacity = '0';
      });
    };

    const hideEye = () => setEyeReady(host, false);
    const showEye = () => setEyeReady(host, true);
    tl.eventCallback('onStart', hideEye);
    if (config.repeat) {
      tl.eventCallback('onRepeat', hideEye);
    }
    tl.eventCallback('onComplete', showEye);

    tl.add(showLasers, cursor);

    ordered.forEach(entry => {
      let segDuration = (entry.length / totalLength) * totalDurationSec;
      segDuration = Math.min(maxSegSec, Math.max(minSegSec, segDuration));
      const start = cursor;

      tl.add(() => {
        resetPath(entry.path, entry.length, config);
      }, start);

      if (drawPlugin) {
        tl.fromTo(
          entry.path,
          { drawSVG: '0%', opacity: config.fade ? 0 : 1 },
          { drawSVG: '100%', opacity: 1, duration: segDuration, ease: config.easing },
          start
        );
      } else {
        tl.fromTo(
          entry.path,
          { strokeDashoffset: entry.dash, opacity: config.fade ? 0 : 1 },
          { strokeDashoffset: 0, opacity: 1, duration: segDuration, ease: config.easing },
          start
        );
      }

      if (lasers?.heads?.length && lasers?.beams?.length && lasers?.anchors?.length) {
        const proxy = { progress: 0 };
        tl.fromTo(
          proxy,
          { progress: 0 },
          {
            progress: 1,
            duration: segDuration,
            ease: config.easing,
            onUpdate: () => {
              const point = entry.path.getPointAtLength(
                Math.min(entry.length * proxy.progress, entry.length)
              );
              const tx = point?.x ?? 0;
              const ty = point?.y ?? 0;
              lasers.heads.forEach((head, index) => {
                const offset = lasers.offsets?.[index] || { x: 0, y: 0 };
                head.setAttribute('transform', `translate(${tx + offset.x}, ${ty + offset.y})`);
              });
              lasers.beams.forEach((beam, index) => {
              const anchor = lasers.anchors[0];
              const offset = lasers.offsets?.[index] || { x: 0, y: 0 };
              beam.setAttribute('x1', anchor.x);
              beam.setAttribute('y1', anchor.y);
              beam.setAttribute('x2', tx + offset.x);
              beam.setAttribute('y2', ty + offset.y);
            });
              if (lasers.particles?.enabled) {
                const now = performance.now();
                if (!lasers.particles.lastEmit || now - lasers.particles.lastEmit > config.particleRate) {
                  lasers.particles.lastEmit = now;
                  lasers.particles.emit(tx, ty);
                }
              }
            },
          },
          start
        );
      }

      cursor += segDuration;
    });

    tl.add(hideLasers, cursor);

    return { timeline: tl };
  }

  function playFallback(paths, config, host) {
    const ordered = paths
      .slice()
      .sort((a, b) => {
        if (a.centerY === b.centerY) {
          try {
            return a.path.getPointAtLength(0).x - b.path.getPointAtLength(0).x;
          } catch {
            return 0;
          }
        }
        return b.centerY - a.centerY;
      });
    const minY = Math.min(...ordered.map(p => p.centerY));
    const maxY = Math.max(...ordered.map(p => p.centerY));
    const range = Math.max(maxY - minY, 1);

    ordered.forEach(entry => {
      const relative = (maxY - entry.centerY) / range;
      const delay = config.baseDelay + relative * config.stagger;
      entry.path.style.strokeDasharray = entry.dash;
      entry.path.style.strokeDashoffset = entry.dash;
      entry.path.style.animation = `bull-stroke-draw ${config.duration}ms ${config.easing} ${delay}ms forwards`;
      entry.path.style.opacity = config.fade ? '0' : '';
    });
    setEyeReady(host, true);
  }

  async function setupHost(host) {
    if (host.dataset.bullReady) return;
    const src = host.getAttribute('data-bull-src');
    if (!src) return;

    host.dataset.bullReady = 'pending';
    injectStyles();

    try {
      const svg = await fetchSVG(src);
      const config = getConfig(host);
      host.textContent = '';
      svg.classList.add('space-bull__svg');
      svg.style.visibility = 'hidden';
      host.appendChild(svg);

      const viewMeta = parseViewBox(svg.getAttribute('viewBox'));
      const origin = {
        x: viewMeta.x + viewMeta.width,
        y: viewMeta.y + viewMeta.height,
      };
      const lasers = createLaserElements(svg, config);
      const spread = Math.max(0, config.laserSpread);
      lasers.anchors = [origin, origin];
      const offset = Math.max(2, spread * 0.15);
      lasers.offsets = [
        { x: -offset, y: -offset * 0.05 },
        { x: offset, y: offset * 0.05 },
      ];

      const paths = preparePaths(svg, config);
      const gsapBundle = buildGsapTimeline(paths, config, lasers, host);

      const play = () => {
        svg.style.visibility = '';
        setEyeReady(host, false);
        if (gsapBundle?.timeline) {
          gsapBundle.timeline.restart(true, false);
        } else {
          playFallback(paths, config, host);
        }
      };

      host.playBull = play;
      registerHostTriggers(host);
      host.dataset.bullReady = 'true';
    } catch (error) {
      console.error('[space-bull]', error);
      host.dataset.bullReady = 'error';
      host.setAttribute('data-bull-error', error.message);
    }
  }

  function init() {
    document.querySelectorAll(HOST_SELECTOR).forEach(setupHost);
  }

  exposeTriggerAPI();
  ready(init);
})();
