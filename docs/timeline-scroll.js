(function () {
  function enableDragScroll(wrapper) {
    if (!wrapper) return;

    let dragging = false;
    let startX = 0;
    let startScroll = 0;

    function pointerDown(event) {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
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
    }

    function endDrag(event) {
      if (!dragging) return;
      dragging = false;
      wrapper.classList.remove('is-dragging');
      wrapper.releasePointerCapture(event.pointerId);
    }

    wrapper.addEventListener('pointerdown', pointerDown);
    wrapper.addEventListener('pointermove', pointerMove);
    wrapper.addEventListener('pointerup', endDrag);
    wrapper.addEventListener('pointerleave', endDrag);
    wrapper.addEventListener('pointercancel', endDrag);
  }

  document.addEventListener('DOMContentLoaded', function () {
    document
      .querySelectorAll('.section-timeline .timeline-wrapper')
      .forEach(enableDragScroll);
  });
})();
