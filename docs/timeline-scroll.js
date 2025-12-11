(function () {
  var TAP_SLOP = 8;

  var coarsePointerQuery = window.matchMedia
    ? window.matchMedia('(pointer: coarse)')
    : { matches: false };
  var fineHoverQuery = window.matchMedia
    ? window.matchMedia('(hover: hover) and (pointer: fine)')
    : { matches: true };
  var deviceHasTouch =
    'ontouchstart' in window ||
    (navigator && typeof navigator.maxTouchPoints === 'number'
      ? navigator.maxTouchPoints > 0
      : false);

  function prefersTap(pointerType) {
    if (pointerType === 'mouse') return false;
    if (pointerType && pointerType !== '') return true;
    if (coarsePointerQuery.matches && !fineHoverQuery.matches) return true;
    if (fineHoverQuery.matches && !coarsePointerQuery.matches) return false;
    return deviceHasTouch;
  }

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }

  function enableTimelineScroll(wrapper) {
    if (!wrapper) return;

    var track = wrapper.querySelector('.timeline-container');
    var line = wrapper.querySelector('.timeline-line');
    if (!track) return;

    var gsapGlobal = window.gsap;
    var hasGSAP = typeof gsapGlobal !== 'undefined';
    var transformTargets = line ? [track, line] : [track];

    var pointerActive = false;
    var pointerTapMode = false;
    var lastPointerWasTouch = deviceHasTouch;
    var dragging = false;
    var startX = 0;
    var startY = 0;
    var startOffset = 0;
    var currentOffset = 0;
    var minOffset = 0;
    var velocity = 0;
    var lastMoveTime = 0;
    var lastMoveOffset = 0;
    var activeTween = null;
    var tooltipTimer = null;
    var tapCandidate = null;
    var tapMoved = false;
    var canScroll = false;

    wrapper.style.transform = 'translate3d(0px,0,0)';

    function clampOffset(value) {
      if (value > 0) return 0;
      if (value < minOffset) return minOffset;
      return value;
    }

    function updateLineWidth() {
      if (line) {
        line.style.width = track.scrollWidth + 'px';
      }
    }

    function closeAllTooltips(except) {
      wrapper.querySelectorAll('.status-box.is-tooltip-open').forEach(function (box) {
        if (!except || box !== except) {
          box.classList.remove('is-tooltip-open');
        }
      });
    }

    function killTween() {
      if (activeTween) {
        activeTween.kill();
        activeTween = null;
      }
    }

    function commitTransform(x) {
      updateLineWidth();
      if (hasGSAP) {
        gsapGlobal.set(transformTargets, { x: x });
      } else {
        var transform = 'translate3d(' + x + 'px,0,0)';
        track.style.transform = transform;
        if (line) {
          line.style.transform = transform;
        }
      }
    }

    function tweenTo(x, options) {
      if (options && options.dragging && hasGSAP) {
        killTween();
        commitTransform(x);
        return;
      }
      if (!hasGSAP || (options && options.immediate)) {
        killTween();
        commitTransform(x);
        return;
      }
      killTween();
      activeTween = gsapGlobal.to(transformTargets, {
        x: x,
        duration: options && options.duration ? options.duration : 0.55,
        ease: options && options.ease ? options.ease : 'power3.out',
        overwrite: true,
        onUpdate: updateLineWidth,
        onComplete: function () {
          activeTween = null;
          updateLineWidth();
        },
      });
    }

    function applyOffset(value, opts) {
      currentOffset = canScroll ? clampOffset(value) : 0;
      tweenTo(currentOffset, opts);
    }

    function computeBounds() {
      var visible = wrapper.clientWidth;
      var total = track.scrollWidth;
      minOffset = Math.min(0, visible - total);
      canScroll = minOffset < 0;
      updateLineWidth();
      applyOffset(clampOffset(currentOffset), { immediate: true });
    }

    function pointerDown(event) {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      if (event.pointerType === 'touch') {
        lastPointerWasTouch = true;
      } else if (event.pointerType === 'mouse') {
        lastPointerWasTouch = false;
      }
      pointerActive = true;
      dragging = false;
      tapMoved = false;
      pointerTapMode = prefersTap(event.pointerType);
      tapCandidate = pointerTapMode ? event.target.closest('.status-box') : null;
      startX = event.clientX;
      startY = event.clientY;
      startOffset = currentOffset;
      velocity = 0;
      lastMoveTime = performance.now();
      lastMoveOffset = currentOffset;
      if (!canScroll) {
        closeAllTooltips();
      }
    }

    function pointerMove(event) {
      if (!pointerActive || !canScroll) return;
      var deltaX = event.clientX - startX;
      var deltaY = event.clientY - startY;
      if (!dragging) {
        if (Math.abs(deltaX) <= TAP_SLOP && Math.abs(deltaY) <= TAP_SLOP) {
          return;
        }
        dragging = true;
        tapMoved = true;
        tapCandidate = null;
        wrapper.classList.add('is-dragging');
        closeAllTooltips();
        clearTimeout(tooltipTimer);
        if (wrapper.setPointerCapture) {
          wrapper.setPointerCapture(event.pointerId);
        }
      }
      event.preventDefault();
      applyOffset(startOffset + deltaX, { dragging: true });
      var now = performance.now();
      var dt = now - lastMoveTime;
      if (dt > 16) {
        velocity = (currentOffset - lastMoveOffset) / dt;
        lastMoveTime = now;
        lastMoveOffset = currentOffset;
      }
    }

    function resolveStatusBoxFromEvent(event) {
      var target = event.target;
      while (target && target.nodeType !== 1) {
        target = target.parentElement;
      }
      if (!target) return null;
      var withinBox = target.closest('.status-box');
      if (withinBox) return withinBox;
      var openBox = wrapper.querySelector('.status-box.is-tooltip-open');
      if (openBox && openBox.contains(target)) {
        return openBox;
      }
      return null;
    }

    function handleTap(event) {
      if (!pointerTapMode) {
        tapCandidate = null;
        if (!event.target.closest('.status-box')) {
          closeAllTooltips();
        }
        return;
      }
      var moved =
        tapMoved ||
        Math.abs(event.clientX - startX) > TAP_SLOP ||
        Math.abs(event.clientY - startY) > TAP_SLOP;
      var statusEl = tapCandidate || resolveStatusBoxFromEvent(event);
      if (!moved && statusEl) {
        if (statusEl.classList.contains('is-tooltip-open')) {
          statusEl.classList.remove('is-tooltip-open');
        } else {
          closeAllTooltips(statusEl);
          statusEl.classList.add('is-tooltip-open');
        }
      } else if (!event.target.closest('.status-box')) {
        closeAllTooltips();
      }
      tapCandidate = null;
    }

    function releasePointer(event, shouldHandleTap) {
      if (!pointerActive) return;
      pointerActive = false;
      if (dragging) {
        dragging = false;
        wrapper.classList.remove('is-dragging');
        if (
          event &&
          wrapper.hasPointerCapture &&
          wrapper.hasPointerCapture(event.pointerId)
        ) {
          wrapper.releasePointerCapture(event.pointerId);
        }
        var momentum =
          hasGSAP && Math.abs(velocity) > 0.05 ? velocity * 320 : 0;
        if (momentum) {
          applyOffset(currentOffset + momentum, {
            duration: 0.9,
            ease: 'power4.out',
          });
        } else {
          applyOffset(currentOffset, { dragging: false });
        }
        velocity = 0;
        clearTimeout(tooltipTimer);
        tooltipTimer = setTimeout(function () {
          tooltipTimer = null;
          wrapper.classList.remove('is-dragging');
        }, 200);
      }
      if (shouldHandleTap && event) {
          handleTap(event);
      } else {
        tapCandidate = null;
      }
    }

    function handleClick(event) {
      if (!lastPointerWasTouch && !pointerTapMode && !deviceHasTouch) return;
      if (wrapper.classList.contains('is-dragging')) return;
      var statusEl = resolveStatusBoxFromEvent(event);
      if (statusEl) {
        event.preventDefault();
        if (statusEl.classList.contains('is-tooltip-open')) {
          statusEl.classList.remove('is-tooltip-open');
        } else {
          closeAllTooltips(statusEl);
          statusEl.classList.add('is-tooltip-open');
        }
      } else if (!event.target.closest('.timeline-container')) {
        closeAllTooltips();
      }
    }

    function handleWheel(event) {
      if (!canScroll) return;
      closeAllTooltips();
      var delta =
        Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      if (!delta) return;
      applyOffset(currentOffset - delta, { dragging: false });
      event.preventDefault();
    }

    wrapper.addEventListener('pointerdown', pointerDown);
    wrapper.addEventListener('pointermove', pointerMove);
    wrapper.addEventListener('pointerup', function (event) {
      releasePointer(event, true);
    });
    wrapper.addEventListener('pointerleave', function (event) {
      releasePointer(event, false);
    });
    wrapper.addEventListener('pointercancel', function (event) {
      releasePointer(event, false);
    });
    wrapper.addEventListener('wheel', handleWheel, { passive: false });
    wrapper.addEventListener('click', handleClick, true);

    if (window.ResizeObserver) {
      var resizeObserver = new ResizeObserver(computeBounds);
      resizeObserver.observe(wrapper);
      resizeObserver.observe(track);
    } else {
      window.addEventListener('resize', computeBounds);
    }

    computeBounds();
  }

  ready(function () {
    document
      .querySelectorAll('.section-timeline .timeline-wrapper')
      .forEach(enableTimelineScroll);
  });
})();
