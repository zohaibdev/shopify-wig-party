/* Wig Party — Shop by Cap Construction cards (sections/cap-types.liquid).
 *
 * The styles/price line ("N styles · from $X") is never server-rendered with a fixed
 * number: it is worked out here from the product catalogue, the same way
 * assets/aria-collection.js works out its own theme filters (?view=aria-index,
 * substring match against product.type). aria-collection.js itself is read-only
 * reference here and is not touched or imported.
 *
 * Each card (`[data-wp-cap-keywords]`) carries its block's match_keywords
 * (comma-separated, matched case-insensitively as a substring of product.type). On any
 * failure, a blank match_keywords, or a zero match count, the card's
 * [data-wp-cap-meta] line is simply left empty — section-aria-cap-types.css reserves its
 * height either way, so nothing shifts — and the card's Shop button keeps working since its
 * href is set server-side from the block's collection_url_slug, not from this script. The
 * card image is never touched by this file.
 */
(function () {
  function formatPrice(subunits, currency) {
    try {
      return new Intl.NumberFormat(document.documentElement.lang || undefined, {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(subunits / 100);
    } catch (error) {
      return '$' + (subunits / 100).toFixed(2);
    }
  }

  function fetchAllPages() {
    var results = [];
    function load(page) {
      var params = new URLSearchParams();
      params.set('view', 'aria-index');
      params.set('page', page);
      return fetch(window.location.pathname + '?' + params.toString(), { credentials: 'same-origin' })
        .then(function (response) {
          if (!response.ok) throw new Error(response.status);
          return response.json();
        })
        .then(function (data) {
          results = results.concat(data.products || []);
          var pages = data.pages || 1;
          return page < pages && page < 20 ? load(page + 1) : results;
        });
    }
    return load(1);
  }

  function init() {
    var cards = document.querySelectorAll('[data-wp-cap-keywords]');
    if (!cards.length) return;

    fetchAllPages()
      .then(function (products) {
        var currency = document.documentElement.getAttribute('data-currency') || 'USD';
        cards.forEach(function (card) {
          var keywords = String(card.dataset.wpCapKeywords || '')
            .split(',')
            .map(function (keyword) {
              return keyword.trim().toLowerCase();
            })
            .filter(Boolean);
          if (!keywords.length) return;

          var matches = products.filter(function (product) {
            var type = String(product.t || '').toLowerCase();
            if (!type) return false;
            return keywords.some(function (keyword) {
              return type.indexOf(keyword) !== -1;
            });
          });
          if (!matches.length) return;

          var meta = card.querySelector('[data-wp-cap-meta]');
          if (!meta) return;

          var minPrice = matches.reduce(function (min, product) {
            return typeof product.p === 'number' && product.p < min ? product.p : min;
          }, Infinity);

          meta.textContent =
            matches.length + (matches.length === 1 ? ' style' : ' styles') + ' · from ' + formatPrice(minPrice, currency);
        });
      })
      .catch(function () {
        // Fetch/parse failure: meta lines stay empty, buttons already have real hrefs.
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
