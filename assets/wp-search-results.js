/* Search results page: sort dropdown and "Show N more" (AJAX append, link fallback). */
(function () {
  /* Card swatches (assets/wp-card-swatches.js) load from this file's own asset folder, so
     the section markup does not need a second <script> tag. Guarded: the Sale page loads it too. */
  var self = document.currentScript;
  if (self && self.src && !window.__wpCardSwatchesRequested) {
    window.__wpCardSwatchesRequested = true;
    var swatches = document.createElement('script');
    swatches.src = self.src.replace('wp-search-results.js', 'wp-card-swatches.js');
    swatches.defer = true;
    document.head.appendChild(swatches);
  }

  function initSort(root) {
    var wrap = root.querySelector('[data-wp-sort]');
    if (!wrap) return;
    var trigger = wrap.querySelector('[data-wp-sort-trigger]');
    var menu = wrap.querySelector('[data-wp-sort-menu]');

    function setOpen(open) {
      trigger.setAttribute('aria-expanded', String(open));
      menu.hidden = !open;
    }

    trigger.addEventListener('click', function () {
      setOpen(menu.hidden);
    });
    document.addEventListener('click', function (event) {
      if (!wrap.contains(event.target)) setOpen(false);
    });
    wrap.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        setOpen(false);
        trigger.focus();
      }
    });
  }

  function initMore(root) {
    var sectionId = root.getAttribute('data-section-id');
    var wrap = root.querySelector('[data-wp-search-more-wrap]');
    var grid = root.querySelector('[data-wp-search-grid]');
    if (!wrap || !grid) return;

    wrap.addEventListener('click', function (event) {
      var link = event.target.closest('[data-wp-search-more]');
      if (!link || link.classList.contains('is-loading')) return;
      event.preventDefault();
      link.classList.add('is-loading');

      var url = new URL(link.getAttribute('href'), window.location.origin);
      url.searchParams.set('section_id', sectionId);

      fetch(url.toString())
        .then(function (response) {
          if (!response.ok) throw new Error(response.status);
          return response.text();
        })
        .then(function (html) {
          var doc = new DOMParser().parseFromString(html, 'text/html');
          var nextGrid = doc.querySelector('[data-wp-search-grid]');
          var nextWrap = doc.querySelector('[data-wp-search-more-wrap]');
          if (!nextGrid) throw new Error('no grid');
          Array.prototype.forEach.call(nextGrid.children, function (item) {
            var node = document.importNode(item, true);
            grid.appendChild(node);
            if (window.AriaDiscountPrice) {
              node.querySelectorAll('[data-aria-price]').forEach(window.AriaDiscountPrice.apply);
            }
          });
          wrap.innerHTML = nextWrap ? nextWrap.innerHTML : '';
          document.dispatchEvent(new CustomEvent('wishlist:sync'));
        })
        .catch(function () {
          window.location.href = link.getAttribute('href');
        });
    });
  }

  function init() {
    document.querySelectorAll('[data-wp-search]').forEach(function (root) {
      initSort(root);
      initMore(root);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
