/* Wig Party — Watch Live steps strip (sections/live-steps.liquid).
   Touch and trackpads scroll the strip natively; this adds drag-to-scroll for a mouse,
   and swallows the click that ends a drag so it never follows a link. */
(function () {
  if (window.ariaLiveStepsReady) return;
  window.ariaLiveStepsReady = true;

  function bind(scroller) {
    var startX = 0;
    var startScroll = 0;
    var moved = false;
    var active = false;

    scroller.addEventListener('pointerdown', function (event) {
      if (event.pointerType !== 'mouse' || event.button !== 0) return;
      active = true;
      moved = false;
      startX = event.clientX;
      startScroll = scroller.scrollLeft;
    });

    scroller.addEventListener('pointermove', function (event) {
      if (!active) return;
      var dx = event.clientX - startX;
      if (!moved && Math.abs(dx) < 4) return;
      if (!moved) {
        moved = true;
        scroller.classList.add('is-dragging');
        scroller.setPointerCapture(event.pointerId);
      }
      scroller.scrollLeft = startScroll - dx;
    });

    function end(event) {
      if (!active) return;
      active = false;
      scroller.classList.remove('is-dragging');
      if (scroller.hasPointerCapture && scroller.hasPointerCapture(event.pointerId)) {
        scroller.releasePointerCapture(event.pointerId);
      }
    }

    scroller.addEventListener('pointerup', end);
    scroller.addEventListener('pointercancel', end);
    scroller.addEventListener(
      'click',
      function (event) {
        if (!moved) return;
        event.preventDefault();
        event.stopPropagation();
        moved = false;
      },
      true
    );
  }

  function init() {
    document.querySelectorAll('[data-aria-live-steps]').forEach(bind);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
