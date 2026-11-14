/* Sale listing: "Show N more" (AJAX append, link fallback). Keeps ?view=<template suffix> in the fetch.
   Appended cards are aria-product-card markup: swatches (aria-product-card.js) and wishlist
   (aria-wishlist.js) use document-level delegation, and <product-form> upgrades on insert
   (product-form.js is loaded by the section), so only prices and wishlist state are re-synced. */
(function () {
  function initMore(root) {
    var sectionId = root.getAttribute('data-section-id');
    var view = root.getAttribute('data-view');
    var wrap = root.querySelector('[data-wp-sale-more-wrap]');
    var grid = root.querySelector('[data-wp-sale-grid]');
    if (!wrap || !grid) return;

    wrap.addEventListener('click', function (event) {
      var link = event.target.closest('[data-wp-sale-more]');
      if (!link || link.classList.contains('is-loading')) return;
      event.preventDefault();
      link.classList.add('is-loading');

      var url = new URL(link.getAttribute('href'), window.location.origin);
      url.searchParams.set('section_id', sectionId);
      if (view) url.searchParams.set('view', view);

      fetch(url.toString())
        .then(function (response) {
          if (!response.ok) throw new Error(response.status);
          return response.text();
        })
        .then(function (html) {
          var doc = new DOMParser().parseFromString(html, 'text/html');
          var nextGrid = doc.querySelector('[data-wp-sale-grid]');
          var nextWrap = doc.querySelector('[data-wp-sale-more-wrap]');
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
    document.querySelectorAll('[data-wp-sale-listing]').forEach(initMore);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
