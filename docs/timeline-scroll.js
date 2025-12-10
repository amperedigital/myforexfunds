(function () {
  function enableTimelineScroll(wrapper) {
    if (!wrapper) return;

    const track = wrapper.querySelector('.timeline-container');
    const line = wrapper.querySelector('.timeline-line');
    let dragging = false;
    let startX = 0;
    let startScroll = 0;

    function syncLine() {
      if (!line || !track) return;
      line.style.width = track.scrollWidth + 'px';
      line.style.transform = 'translateX(' + -wrapper.scrollLeft + 'px)';
    }

    function pointerDown(event) {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      if (event.pointerType === 'mouse' && event.target.closest('.timeline-item')) {
        return;
      }
      dragging = true;
      startX = event.clientX;
      startScroll = wrapper.scrollLeft;
      wrapper.classList.add('is-dragging');
      wrapper.setPointerCapture(event.pointerId);
    }

    function pointerMove(event) {
      if (!dragging) return;
      event.preventDefault();
      const deltaX = event.clientX - startX;
      wrapper.scrollLeft = startScroll - deltaX;
      syncLine();
    }

    function endDrag(event) {
      if (!dragging) return;
      dragging = false;
      wrapper.classList.remove('is-dragging');
      if (wrapper.hasPointerCapture && wrapper.hasPointerCapture(event.pointerId)) {
        wrapper.releasePointerCapture(event.pointerId);
      }
    }

    wrapper.addEventListener('pointerdown', pointerDown);
    wrapper.addEventListener('pointermove', pointerMove);
    wrapper.addEventListener('pointerup', endDrag);
    wrapper.addEventListener('pointerleave', endDrag);
    wrapper.addEventListener('pointercancel', endDrag);
    wrapper.addEventListener('scroll', syncLine, { passive: true });

    const resizeObserver = new ResizeObserver(syncLine);
    if (track) resizeObserver.observe(track);

    syncLine();
  }

  document.addEventListener('DOMContentLoaded', function () {
    document
      .querySelectorAll('.section-timeline .timeline-wrapper')
      .forEach(enableTimelineScroll);
  });
})();
