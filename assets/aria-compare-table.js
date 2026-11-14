/* Wig Party — Compare Shades, "Stated plainly" table (sections/compare-table.liquid).
   Mobile shows one shade at a time: the indicators, or a horizontal swipe on the
   table, set data-active on it, and CSS shows that column. Desktop ignores both.

   Live data: listens for "aria-compare:change" (sections/compare-shades.liquid) and asks for it
   once with "aria-compare:request" on init, same request/response pattern as the slider. Updates
   the two column names and each row's two cells (matched by the row's data-field, set in Liquid)
   from the selected shades; a shade with no value for a field shows "—". A page with no compare
   shades section never gets the event, so the table just keeps its static block content (after
   the ~3s CSS fallback reveal — see the is-pending rule in sections/compare-shades.liquid).

   Third shade: when the detail carries a `c` (ADD A THIRD), the card gets `has-third`, which
   shows the third column and its mobile dot; without one they are hidden again and a mobile
   view sitting on the third column goes back to the first.

   First paint: the table starts with class "is-pending" (set in Liquid), which hides the two
   value columns. The first "aria-compare:change" received removes it, right after the cells are
   updated, so nothing is ever revealed with stale values. */
(function () {
  if (window.ariaCompareTableReady) return;
  window.ariaCompareTableReady = true;

  function applyPair(table, detail) {
    var names = table.querySelectorAll('.aria-compare-table__col-name');
    var shades = [detail.a, detail.b, detail.c];
    shades.forEach(function (shade, i) {
      if (!shade || !names[i]) return;
      names[i].textContent = shade.table_name || shade.name || names[i].textContent;
    });
    var rows = table.querySelectorAll('.aria-compare-table__row[data-field]');
    Array.prototype.forEach.call(rows, function (row) {
      var field = row.getAttribute('data-field');
      var cells = row.querySelectorAll('.aria-compare-table__cell');
      shades.forEach(function (shade, i) {
        if (!cells[i]) return;
        if (i === 2 && !shade) return;
        cells[i].textContent = shade && shade[field] ? shade[field] : '-';
      });
    });
  }

  function bind(card) {
    var table = card.querySelector('.aria-compare-table__table');
    var dots = Array.prototype.slice.call(card.querySelectorAll('.aria-compare-table__dot'));
    if (!table || !dots.length || card.hasAttribute('data-aria-bound')) return;
    card.setAttribute('data-aria-bound', '');

    var onPair = function (event) {
      var detail = event.detail || {};
      applyPair(table, detail);
      card.classList.toggle('has-third', !!detail.c);
      if (!detail.c && table.getAttribute('data-active') === '3') show(1);
      table.classList.remove('is-pending');
    };
    document.addEventListener('aria-compare:change', onPair);
    document.dispatchEvent(new CustomEvent('aria-compare:request'));

    function show(index) {
      var count = dots.filter(function (dot) {
        return getComputedStyle(dot).display !== 'none';
      }).length || dots.length;
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
    document.querySelectorAll('.aria-compare-table__card').forEach(bind);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  document.addEventListener('shopify:section:load', init);
})();
