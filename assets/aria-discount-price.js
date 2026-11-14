/* Wig Party — the price an automatic discount will actually charge, on the PDP and on
 * product cards, so they quote the same figure as the cart and checkout.
 *
 * WHY THIS EXISTS
 * Shopify applies automatic discounts (e.g. "20% sale" on select pieces) in the cart.
 * Liquid exposes them on `cart` and cart line items only, never on `product` or
 * `variant`, so a product page or card rendered server-side can only show the
 * pre-discount price. This asks Shopify's Storefront API instead.
 *
 * HOW IT STAYS EXACT
 * Each variant is priced in its OWN throwaway one-line cart (`cartCreate`, quantity 1),
 * all sent as aliases of one request. Separate carts matter: one shared cart holding every
 * product on the page would let order-level rules (spend thresholds, "buy 2") apply that
 * the shopper's real cart will not get. The cart is created in the shopper's country
 * (`@inContext`), so market pricing matches too.
 *
 * The result is kept as a RATIO (line total / line subtotal) and applied to the price
 * Liquid already rendered in subunits, so no currency conversion or decimal assumptions
 * are involved. Cached for five minutes per tab, so a discount that is switched off stops
 * showing within minutes rather than lingering for the whole session.
 *
 * Deliberately NOT the Ajax cart (`/cart/add.js`): that mutates the shopper's real cart
 * and fires the theme's cart events. A Storefront API cart is a
 * separate object and touches nothing the shopper owns.
 *
 * Every failure (network, GraphQL error, sold-out variant) leaves the server-rendered
 * price standing.
 *
 * MARKUP CONTRACT — a price opts in with `data-aria-price` and:
 *   data-variant-id="123"          the variant being priced
 *   data-price-value="44900"       its own price in subunits (Liquid `variant.price`)
 *   data-compare-value="68900"     its compare-at price in subunits, or 0
 *   data-compare-class="…"         optional; class for the struck-through "was" price,
 *                                  created next to the price when a discount needs one
 * The price text lives in a `[data-aria-price-current]` child, or the element itself;
 * an existing "was" price is a `[data-aria-price-compare]` child.
 *
 * JS API (window.AriaDiscountPrice):
 *   ratio(variantId) -> Promise<number|null>   1 = no discount
 *   format(subunits) -> string
 *   apply(element)                              re-price one element (after a swatch change)
 */
(function () {
  if (window.AriaDiscountPrice) return;

  var root = document.documentElement;
  var currency = root.getAttribute('data-currency') || 'USD';
  var country = (root.getAttribute('data-country') || '').toUpperCase();
  var API_VERSION = root.getAttribute('data-storefront-api-version') || '2026-01';
  /* Same origin on the storefront: the .myshopify.com host redirects to the primary
     domain, and a redirected cross-origin POST fails. Only the local `shopify theme dev`
     proxy (which does not serve /api) needs the shop's own domain. */
  var isLocal = /^(127\.0\.0\.1|localhost)$/.test(window.location.hostname);
  var shopDomain = root.getAttribute('data-shop-domain');
  var ENDPOINT = (isLocal && shopDomain ? 'https://' + shopDomain : '') + '/api/' + API_VERSION + '/graphql.json';
  var TTL = 5 * 60 * 1000;
  var BATCH = 15;

  var ratios = new Map(); // variantId -> Promise<number|null>
  var queue = []; // [{ id, resolve }]
  var flushTimer = null;

  function storageKey(id) {
    return 'aria-price:' + country + ':' + currency + ':' + id;
  }

  function readStored(id) {
    try {
      var raw = window.sessionStorage.getItem(storageKey(id));
      if (!raw) return undefined;
      var entry = JSON.parse(raw);
      if (!entry || Date.now() - entry.t > TTL) return undefined;
      return entry.r;
    } catch (error) {
      return undefined;
    }
  }

  function writeStored(id, ratio) {
    try {
      window.sessionStorage.setItem(storageKey(id), JSON.stringify({ t: Date.now(), r: ratio }));
    } catch (error) {
      /* Private mode / full storage: the in-memory map still holds it. */
    }
  }

  function ratio(variantId) {
    var id = String(variantId || '');
    if (!/^\d+$/.test(id)) return Promise.resolve(null);
    if (ratios.has(id)) return ratios.get(id);

    var stored = readStored(id);
    var promise =
      stored !== undefined
        ? Promise.resolve(stored)
        : new Promise(function (resolve) {
            queue.push({ id: id, resolve: resolve });
            if (!flushTimer) flushTimer = setTimeout(flush, 30);
          });
    ratios.set(id, promise);
    return promise;
  }

  function flush() {
    flushTimer = null;
    while (queue.length) request(queue.splice(0, BATCH));
  }

  function request(batch) {
    var context = /^[A-Z]{2}$/.test(country) ? ' @inContext(country: ' + country + ')' : '';
    var fields = batch
      .map(function (item, index) {
        return (
          'c' + index + ': cartCreate(input: { lines: [{ quantity: 1, merchandiseId: "gid://shopify/ProductVariant/' +
          item.id +
          '" }] }) { cart { lines(first: 1) { nodes { cost { subtotalAmount { amount } totalAmount { amount } } } } } }'
        );
      })
      .join('\n');

    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'mutation ariaPrices' + context + ' {\n' + fields + '\n}' }),
    })
      .then(function (response) {
        return response.ok ? response.json() : null;
      })
      .catch(function () {
        return null;
      })
      .then(function (payload) {
        var data = (payload && payload.data) || {};
        batch.forEach(function (item, index) {
          var result = readRatio(data['c' + index]);
          if (result !== null) writeStored(item.id, result);
          item.resolve(result);
        });
      });
  }

  function readRatio(node) {
    var cost =
      node &&
      node.cart &&
      node.cart.lines &&
      node.cart.lines.nodes &&
      node.cart.lines.nodes[0] &&
      node.cart.lines.nodes[0].cost;
    if (!cost) return null;
    var total = parseFloat(cost.totalAmount && cost.totalAmount.amount);
    var subtotal = parseFloat(cost.subtotalAmount && cost.subtotalAmount.amount);
    if (!isFinite(total) || !isFinite(subtotal) || subtotal <= 0 || total > subtotal) return null;
    return total / subtotal;
  }

  /* Liquid money values are always amount x 100, whatever the currency. */
  function format(subunits) {
    try {
      return new Intl.NumberFormat(root.lang || undefined, { style: 'currency', currency: currency }).format(
        subunits / 100
      );
    } catch (error) {
      return (subunits / 100).toFixed(2);
    }
  }

  function apply(el) {
    var id = el.getAttribute('data-variant-id');
    var price = parseInt(el.getAttribute('data-price-value'), 10);
    if (!id || !(price > 0)) return;

    el.__ariaPriceFor = id + ':' + price;
    ratio(id).then(function (r) {
      /* The shopper may have picked another colour while this was in flight. */
      if (el.__ariaPriceFor !== id + ':' + price) return;
      if (r === null || r >= 1) return;

      var discounted = Math.round(price * r);
      var compareValue = parseInt(el.getAttribute('data-compare-value'), 10) || 0;
      var was = Math.max(compareValue, price);

      var current = el.querySelector('[data-aria-price-current]') || el;
      current.textContent = format(discounted);

      var compare = el.querySelector('[data-aria-price-compare]');
      var compareClass = el.getAttribute('data-compare-class');
      if (!compare && compareClass) {
        compare = document.createElement('span');
        compare.className = compareClass;
        compare.setAttribute('data-aria-price-compare', '');
        el.appendChild(compare);
      }
      if (compare) compare.textContent = format(was);
    });
  }

  function scan(scope) {
    if (!scope || !scope.querySelectorAll) return;
    if (scope.matches && scope.matches('[data-aria-price]')) apply(scope);
    scope.querySelectorAll('[data-aria-price]').forEach(apply);
  }

  window.AriaDiscountPrice = { ratio: ratio, format: format, apply: apply };

  function start() {
    scan(document);
    /* Recommendations, filtered collection grids and carousels arrive by AJAX. */
    new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        mutation.addedNodes.forEach(function (node) {
          if (node.nodeType === 1) scan(node);
        });
      });
    }).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
