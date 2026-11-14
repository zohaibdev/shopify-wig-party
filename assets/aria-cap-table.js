/* Wig Party — Shop by Cap Construction table (sections/cap-table.liquid).
   Mobile shows one cap type at a time: the indicators, or a horizontal swipe on the
   table, set data-active on it, and CSS shows that column. Desktop ignores both. */
(function () {
  if (window.ariaCapTableReady) return;
  window.ariaCapTableReady = true;

  function bind(card) {
    var table = card.querySelector('.aria-cap-table__table');
    var dots = Array.prototype.slice.call(card.querySelectorAll('.aria-cap-table__dot'));
    if (!table || !dots.length || card.hasAttribute('data-aria-bound')) return;
    card.setAttribute('data-aria-bound', '');

    function show(index) {
      var count = dots.length;
      index = ((index - 1 + count) % count) + 1;
      table.setAttribute('data-active', String(index));
      dots.forEach(function (dot) {
        var active = Number(dot.getAttribute('data-col')) === index;
        dot.classList.toggle('is-active', active);
        if (active) dot.setAttribute('aria-current', 'true');
        else dot.removeAttribute('aria-current');
      });
    }

    dots.forEach(function (dot) {
      dot.addEventListener('click', function () {
        show(Number(dot.getAttribute('data-col')));
      });
    });

    var startX = null;
    var startY = 0;
    table.addEventListener('touchstart', function (event) {
      startX = event.touches[0].clientX;
      startY = event.touches[0].clientY;
    }, { passive: true });
    table.addEventListener('touchend', function (event) {
      if (startX === null) return;
      var dx = event.changedTouches[0].clientX - startX;
      var dy = event.changedTouches[0].clientY - startY;
      startX = null;
      if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
      var current = Number(table.getAttribute('data-active')) || 1;
      show(dx < 0 ? current + 1 : current - 1);
    });
  }

  function init() {
    document.querySelectorAll('.aria-cap-table__card').forEach(bind);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  document.addEventListener('shopify:section:load', init);
})();
