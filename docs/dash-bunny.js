(() => {
  const HLS_SOURCE = "https://cdn.jsdelivr.net/npm/hls.js@1.6.11";
  let hlsLoadPromise = null;

  function ensureHlsLoaded() {
    if (window.Hls) return Promise.resolve(window.Hls);
    if (hlsLoadPromise) return hlsLoadPromise;

    hlsLoadPromise = new Promise((resolve) => {
      const existing = document.querySelector('script[data-hls-autoload]');
      if (existing) {
        if (existing.dataset.hlsReady === "true") {
          resolve(window.Hls || null);
          return;
        }
        existing.addEventListener("load", () => resolve(window.Hls || null), { once: true });
        existing.addEventListener("error", () => resolve(null), { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = HLS_SOURCE;
      script.async = true;
      script.dataset.hlsAutoload = "true";
      script.addEventListener("load", () => {
        script.dataset.hlsReady = "true";
        resolve(window.Hls || null);
      }, { once: true });
      script.addEventListener("error", () => resolve(null), { once: true });
      document.head.appendChild(script);
    });

    return hlsLoadPromise;
  }

  function initBunnyPlayerBasic() {
  document.querySelectorAll('[data-bunny-player-init]').forEach(function(player) {
    var src = player.getAttribute('data-player-src');
    if (!src) return;

    var video = player.querySelector('video');
    if (!video) return;

    var placeholderImg = player.querySelector('.bunny-player__placeholder');
    if (placeholderImg) {
      var placeholderSrc = placeholderImg.currentSrc || placeholderImg.src || '';
      if (placeholderSrc) {
        video.setAttribute('poster', placeholderSrc);
      }
      placeholderImg.removeAttribute('width');
      placeholderImg.removeAttribute('height');
      placeholderImg.style.width = '100%';
      placeholderImg.style.height = '100%';
      placeholderImg.style.objectFit = 'cover';
      placeholderImg.style.maxWidth = '100%';
      placeholderImg.style.maxHeight = '100%';
      placeholderImg.style.inset = '0';
      placeholderImg.style.position = 'absolute';
      placeholderImg.remove();
    }

    try { video.pause(); } catch(_) {}
    try { video.removeAttribute('src'); video.load(); } catch(_) {}

    // Attribute helpers
    function setStatus(s) {
      if (player.getAttribute('data-player-status') !== s) {
        player.setAttribute('data-player-status', s);
      }
    }
    function setActivated(v) { player.setAttribute('data-player-activated', v ? 'true' : 'false'); }
    if (!player.hasAttribute('data-player-activated')) setActivated(false);

    // Flags
    var updateSize = player.getAttribute('data-player-update-size'); // "true" | "cover" | null
    if (updateSize === 'cover') {
      updateSize = null;
      var ratioShim = player.querySelector('.bunny-player__before');
      if (ratioShim) {
        ratioShim.style.paddingTop = '';
      }
      player.style.position = 'absolute';
      player.style.inset = '0';
      player.style.width = '100%';
      player.style.height = '100%';
    }
    var lazyMode   = player.getAttribute('data-player-lazy');        // "true" | "meta" | null
    var isLazyTrue = lazyMode === 'true';
    var isLazyMeta = lazyMode === 'meta';
    var autoplay   = player.getAttribute('data-player-autoplay') === 'true';
    var autoplayDelayValue = parseDelayValue(player.getAttribute('data-player-autoplay-delay'));
    var autoplayDelayReady = autoplayDelayValue <= 0;
    var autoplayDelayTimer = null;
    var loopAttr   = player.getAttribute('data-player-loop');        // "true" | "false" | "once" | null
    var shouldLoop = loopAttr === null ? autoplay : loopAttr === 'true';
    var autoplayLoopOnce = loopAttr === 'once';
    var speedAttr  = player.getAttribute('data-player-speed');
    var playbackRate = parsePlaybackRate(speedAttr);
    var scrollStable = player.getAttribute('data-player-scroll-stable') === 'true';

    // Used to suppress 'ready' flicker when user just pressed play in lazy modes
    var pendingPlay = false;

    // Autoplay forces muted; loop defaults to autoplay unless overridden
    video.muted = !!autoplay;
    video.loop = !!shouldLoop;
    if (autoplayLoopOnce) {
      video.loop = false;
    } else if (shouldLoop) {
      video.setAttribute('loop', '');
    } else {
      video.removeAttribute('loop');
    }

    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.playsInline = true;
    if (typeof video.disableRemotePlayback !== 'undefined') video.disableRemotePlayback = true;
    if (autoplay) video.autoplay = false;

    var isSafariNative = !!video.canPlayType('application/vnd.apple.mpegurl');
    var canUseHlsJs    = !!(window.Hls && Hls.isSupported()) && !isSafariNative;

    // Minimal ratio fetch when requested (and not already handled by lazy meta)
    if (updateSize === 'true' && !isLazyMeta) {
      if (isLazyTrue) {
        // Do nothing: no fetch, no <video> touch when lazy=true
      } else {
        var prev = video.preload;
        video.preload = 'metadata';
        var onMeta2 = function() {
          setBeforeRatio(player, updateSize, video.videoWidth, video.videoHeight);
          video.removeEventListener('loadedmetadata', onMeta2);
          video.preload = prev || '';
        };
        video.addEventListener('loadedmetadata', onMeta2, { once: true });
        video.src = src;
      }
    }

    //  Lazy meta fetch (duration + aspect) without attaching playback
    function fetchMetaOnce() {
      getSourceMeta(src, canUseHlsJs).then(function(meta){
        if (meta.width && meta.height) setBeforeRatio(player, updateSize, meta.width, meta.height);
        readyIfIdle(player, pendingPlay);
      });
    }

    // Attach media only once (for actual playback)
    var isAttached = false;
    var userInteracted = false;
    var lastPauseBy = ''; // 'io' | 'manual' | ''
    function attachMediaOnce() {
      if (isAttached) return;
      isAttached = true;

      if (player._hls) { try { player._hls.destroy(); } catch(_) {} player._hls = null; }

      if (isSafariNative) {
        video.preload = (isLazyTrue || isLazyMeta) ? 'auto' : video.preload;
        video.src = src;
        video.addEventListener('loadedmetadata', function() {
          readyIfIdle(player, pendingPlay);
          if (updateSize === 'true') setBeforeRatio(player, updateSize, video.videoWidth, video.videoHeight);
        }, { once: true });
      } else if (canUseHlsJs) {
        var hls = new Hls({ maxBufferLength: 10 });
        hls.attachMedia(video);
        hls.on(Hls.Events.MEDIA_ATTACHED, function() { hls.loadSource(src); });
        hls.on(Hls.Events.MANIFEST_PARSED, function() {
          readyIfIdle(player, pendingPlay);
          if (updateSize === 'true') {
            var lvls = hls.levels || [];
            var best = bestLevel(lvls);
            if (best && best.width && best.height) setBeforeRatio(player, updateSize, best.width, best.height);
          }
        });
        player._hls = hls;
      } else {
        // Fallback if not HLS
        video.src = src;
      }
    }

    // Initialize based on lazy mode
    if (isLazyMeta) {
      if (updateSize === 'true') fetchMetaOnce();
      video.preload = 'none';
    } else if (isLazyTrue) {
      video.preload = 'none';
    } else {
      attachMediaOnce();
    }

    // Toggle play/pause
    function togglePlay(forcePlay) {
      userInteracted = true;
      if (video.paused || video.ended) {
        if ((isLazyTrue || isLazyMeta) && !isAttached) attachMediaOnce();
        pendingPlay = true;
        lastPauseBy = '';
        setStatus('loading');
        safePlay(video, forcePlay);
      } else {
        lastPauseBy = 'manual';
        video.pause();
      }
    }

    function requestAutoplayIfReady(source, force) {
      if (!autoplay || !autoplayDelayReady) return;
      if (!force && !elementIsInViewport(player, 0.05) && document.visibilityState !== 'visible') {
        return;
      }
      if (video.paused && !video.ended) {
        setStatus('loading');
        togglePlay(true);
      }
    }
    
    // Toggle mute
    function toggleMute() {
      video.muted = !video.muted;
      player.setAttribute('data-player-muted', video.muted ? 'true' : 'false');
    }

    // Controls (delegated)
    player.addEventListener('click', function(e) {
      var btn = e.target.closest('[data-player-control]');
      if (!btn || !player.contains(btn)) return;
      var type = btn.getAttribute('data-player-control');
      if (type === 'play' || type === 'pause' || type === 'playpause') togglePlay();
      else if (type === 'mute') toggleMute();
    });

    // Media event wiring
    video.addEventListener('play', function() { setActivated(true); setStatus('playing'); });
    video.addEventListener('playing', function() { pendingPlay = false; setStatus('playing'); });
    video.addEventListener('pause', function() { pendingPlay = false; setStatus('paused'); });
    video.addEventListener('waiting', function() { setStatus('loading'); });
    video.addEventListener('canplay', function() { readyIfIdle(player, pendingPlay); });
    video.addEventListener('ended', function() {
      pendingPlay = false;
      if (autoplayLoopOnce) {
        setStatus('finished');
        setActivated(false);
      } else {
        setStatus('paused');
        setActivated(false);
      }
    });

    if (playbackRate && playbackRate !== 1) {
      video.playbackRate = playbackRate;
    }

    // Ensure aspect ratio updates as soon as real dimensions exist (lazy=true path included)
    var ratioSet = false;
    function maybeSetRatioOnce() {
      if (ratioSet || updateSize !== 'true') return;
      var before = player.querySelector('[data-player-before]');
      if (!before) return;
      if (video.videoWidth && video.videoHeight) {
        before.style.paddingTop = (video.videoHeight / video.videoWidth * 100) + '%';
        ratioSet = true;
      }
    }
    video.addEventListener('loadedmetadata', function(){
      maybeSetRatioOnce();
      requestAutoplayIfReady('loadedmetadata', false);
    });
    video.addEventListener('loadeddata',    function(){
      maybeSetRatioOnce();
      requestAutoplayIfReady('loadeddata', false);
    });
    video.addEventListener('playing',       function(){ maybeSetRatioOnce(); });

    // Hover (basic: active on enter, idle on leave)
    function setHover(state) {
      if (player.getAttribute('data-player-hover') !== state) {
        player.setAttribute('data-player-hover', state);
      }
    }
    player.addEventListener('pointerenter', function(){ setHover('active'); });
    player.addEventListener('pointerleave', function(){ setHover('idle'); });

    // In-view auto play/pause (only when autoplay is true)
    if (autoplay) {
      var pointerCoarseMedia = window.matchMedia ? window.matchMedia('(pointer: coarse)') : null;
      var disableIoAutopause = scrollStable || (pointerCoarseMedia ? pointerCoarseMedia.matches : false);
      var io = null;
      function handleIoEntries(entries) {
        entries.forEach(function(entry) {
          var inView = entry.isIntersecting && entry.intersectionRatio > 0;
          var canRestart =
            shouldLoop ||
            !video.ended ||
            video.readyState === 0;
          if (inView) {
            if (!autoplayDelayReady) return;
            if ((isLazyTrue || isLazyMeta) && !isAttached) attachMediaOnce();
            if (
              (lastPauseBy === 'io') ||
              (video.paused && lastPauseBy !== 'manual' && canRestart)
            ) {
              setStatus('loading');
              if (video.paused) togglePlay(inView);
              lastPauseBy = '';
            }
          } else {
            if (!video.paused && !video.ended) {
              lastPauseBy = 'io';
              video.pause();
            }
          }
        });
      }
      function attachIntersectionObserver() {
        if (io || disableIoAutopause) return;
        io = new IntersectionObserver(handleIoEntries, { threshold: 0.1 });
        io.observe(player);
      }
      function detachIntersectionObserver() {
        if (!io) return;
        io.disconnect();
        io = null;
      }
      if (!disableIoAutopause) {
        attachIntersectionObserver();
      }
      if (!scrollStable && pointerCoarseMedia && typeof pointerCoarseMedia.addEventListener === 'function') {
        pointerCoarseMedia.addEventListener('change', function(event) {
          disableIoAutopause = event.matches;
          if (disableIoAutopause) {
            detachIntersectionObserver();
          } else {
            attachIntersectionObserver();
          }
        });
      }

      var kickstartAutoplay = function() {
        requestAutoplayIfReady('kickstart', false);
      };

      var scheduleKickstart = function() {
        if (!autoplayDelayReady) return;
        requestAnimationFrame(kickstartAutoplay);
        if (document.readyState === 'complete') {
          kickstartAutoplay();
        } else {
          window.addEventListener('load', kickstartAutoplay, { once: true });
        }
      };

      if (!autoplayDelayReady) {
        autoplayDelayTimer = setTimeout(function() {
          autoplayDelayReady = true;
          autoplayDelayTimer = null;
          requestAutoplayIfReady('autoplay-delay', true);
          scheduleKickstart();
        }, autoplayDelayValue);
      } else {
        requestAutoplayIfReady('autoplay-ready', false);
        scheduleKickstart();
      }
    }
  });

  // Helper: Ready status guard
  function readyIfIdle(player, pendingPlay) {
    if (!pendingPlay &&
        player.getAttribute('data-player-activated') !== 'true' &&
        player.getAttribute('data-player-status') === 'idle') {
      player.setAttribute('data-player-status', 'ready');
    }
  }

  // Helper: Ratio setter
  function setBeforeRatio(player, updateSize, w, h) {
    if (updateSize !== 'true' || !w || !h) return;
    var before = player.querySelector('[data-player-before]');
    if (!before) return;
    before.style.paddingTop = (h / w * 100) + '%';
  }
  function maybeSetRatioFromVideo(player, updateSize, video) {
    if (updateSize !== 'true') return;
    var before = player.querySelector('[data-player-before]');
    if (!before) return;
    var hasPad = before.style.paddingTop && before.style.paddingTop !== '0%';
    if (!hasPad && video.videoWidth && video.videoHeight) {
      setBeforeRatio(player, updateSize, video.videoWidth, video.videoHeight);
    }
  }

  // Helper: best HLS level by resolution
  function bestLevel(levels) {
    if (!levels || !levels.length) return null;
    return levels.reduce(function(a, b) { return ((b.width||0) > (a.width||0)) ? b : a; }, levels[0]);
  }

  // Helper: safe programmatic play
  function safePlay(video, force) {
    if (force) {
      try {
        var attr = document.createAttribute('playsinline');
        video.setAttributeNode(attr);
      } catch(_) {}
    }
    var p = video.play();
    if (p && typeof p.then === 'function') {
      p.catch(function(err){
        if (force) {
          video.muted = true;
          video.play().catch(function(){});
        }
      });
    }
  }

  function elementIsInViewport(el, thresholdRatio) {
    if (!el) return false;
    var rect = el.getBoundingClientRect();
    var vw = window.innerWidth || document.documentElement.clientWidth || 0;
    var vh = window.innerHeight || document.documentElement.clientHeight || 0;
    if (!vw || !vh) return false;
    var visibleX = Math.max(0, Math.min(rect.right, vw) - Math.max(rect.left, 0));
    var visibleY = Math.max(0, Math.min(rect.bottom, vh) - Math.max(rect.top, 0));
    var visibleArea = visibleX * visibleY;
    var totalArea = Math.max(1, rect.width * rect.height);
    var ratio = visibleArea / totalArea;
    var threshold = typeof thresholdRatio === 'number' ? thresholdRatio : 0;
    return ratio >= threshold;
  }

  function parseDelayValue(attr) {
    if (!attr) return 0;
    var raw = String(attr).trim();
    if (!raw) return 0;
    var multiplier = 1;
    if (/ms$/i.test(raw)) {
      raw = raw.replace(/ms$/i, '');
    } else if (/s$/i.test(raw)) {
      raw = raw.replace(/s$/i, '');
      multiplier = 1000;
    }
    var value = parseFloat(raw);
    if (!isFinite(value) || value <= 0) return 0;
    return value * multiplier;
  }

  function parsePlaybackRate(attr) {
    if (!attr) return 1;
    var value = parseFloat(attr);
    if (!isFinite(value) || value <= 0) return 1;
    return value;
  }

  // Helper: simple URL resolver
  function resolveUrl(base, rel) { try { return new URL(rel, base).toString(); } catch(_) { return rel; } }

  // Helper: unified meta fetch (hls.js or native fetch)
  function getSourceMeta(src, useHlsJs) {
    return new Promise(function(resolve) {
      if (useHlsJs && window.Hls && Hls.isSupported()) {
        try {
          var tmp = new Hls();
          var out = { width: 0, height: 0, duration: NaN };

          tmp.on(Hls.Events.MANIFEST_PARSED, function(e, data) {
            var lvls = (data && data.levels) || tmp.levels || [];
            var best = bestLevel(lvls);
            if (best && best.width && best.height) { out.width = best.width; out.height = best.height; }
          });
          tmp.on(Hls.Events.LEVEL_LOADED, function(e, data) {
            if (data && data.details && isFinite(data.details.totalduration)) { out.duration = data.details.totalduration; }
          });
          tmp.on(Hls.Events.ERROR, function(){ try { tmp.destroy(); } catch(_) {} resolve(out); });
          tmp.on(Hls.Events.LEVEL_LOADED, function(){ try { tmp.destroy(); } catch(_) {} resolve(out); });

          tmp.loadSource(src);
          return;
        } catch(_) { resolve({ width:0, height:0, duration:NaN }); return; }
      }

      function parseMaster(masterText) {
        var lines = masterText.split(/\r?\n/);
        var bestW = 0, bestH = 0, firstMedia = null, lastInf = null;
        for (var i=0;i<lines.length;i++) {
          var line = lines[i];
          if (line.indexOf('#EXT-X-STREAM-INF:') === 0) {
            lastInf = line;
          } else if (lastInf && line && line[0] !== '#') {
            if (!firstMedia) firstMedia = line.trim();
            var m = /RESOLUTION=(\d+)x(\d+)/.exec(lastInf);
            if (m) {
              var w = parseInt(m[1],10), h = parseInt(m[2],10);
              if (w > bestW) { bestW = w; bestH = h; }
            }
            lastInf = null;
          }
        }
        return { bestW: bestW, bestH: bestH, media: firstMedia };
      }
      function sumDuration(mediaText) {
        var dur = 0, re = /#EXTINF:([\d.]+)/g, m;
        while ((m = re.exec(mediaText))) dur += parseFloat(m[1]);
        return dur;
      }

      fetch(src, { credentials: 'omit', cache: 'no-store' }).then(function(r){
        if (!r.ok) throw new Error('master');
        return r.text();
      }).then(function(master){
        var info = parseMaster(master);
        if (!info.media) { resolve({ width: info.bestW||0, height: info.bestH||0, duration: NaN }); return; }
        var mediaUrl = resolveUrl(src, info.media);
        return fetch(mediaUrl, { credentials: 'omit', cache: 'no-store' }).then(function(r){
          if (!r.ok) throw new Error('media');
          return r.text();
        }).then(function(mediaText){
          resolve({ width: info.bestW||0, height: info.bestH||0, duration: sumDuration(mediaText) });
        });
      }).catch(function(){ resolve({ width:0, height:0, duration:NaN }); });
    });
  }
}

  function bootPlayers() {
    ensureHlsLoaded()
      .catch(() => null)
      .then(() => initBunnyPlayerBasic());
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootPlayers, { once: true });
  } else {
    bootPlayers();
  }

  window.initBunnyPlayerBasic = initBunnyPlayerBasic;
})();
