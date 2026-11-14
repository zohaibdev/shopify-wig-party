/* Wig Party: (1) after a successful /cart/add(.js), open the cart drawer and redirect to the cart page;
   (2) in the cart drawer, minus at quantity 1 removes the line.
   Loaded from layout/theme.liquid (drawer mode only). data-redirect / data-delay / data-cart-url come from the
   script tag (theme settings wp_cart_redirect, wp_cart_redirect_delay). Shared drawer files are not edited.
   Does nothing in the theme editor or on account pages. */
(function () {
  if (window.wpCartRedirectReady) return;
  window.wpCartRedirectReady = true;
  if (window.Shopify && window.Shopify.designMode) return;

  var script = document.currentScript;
  var cartUrl = (script && script.getAttribute('data-cart-url')) || (window.routes && window.routes.cart_url) || '/cart';
  var redirectOn = !script || script.getAttribute('data-redirect') !== 'false';
  var delay = script ? parseInt(script.getAttribute('data-delay'), 10) : 700;
  if (!(delay >= 0)) delay = 700;

  function trim(path) { return path.replace(/\/+$/, '') || '/'; }
  var cartPath = trim(new URL(cartUrl, window.location.origin).pathname);
  // Locale root ("/" or "/fr/") = cart path minus "cart"; account paths are root + "account...".
  var root = cartPath.replace(/cart$/, '');
  var here = trim(window.location.pathname);
  if (here === root + 'account' || here.indexOf(root + 'account/') === 0) return;
  var onCartPage = here === cartPath;

  /* ---------- 1. Redirect after add ---------- */

  var upsellAt = 0;
  var timer = null;

  // Adds from the drawer's own upsell ADD keep the drawer open and do not redirect.
  document.addEventListener('click', function (e) {
    if (e.target && e.target.closest && e.target.closest('[data-aria-cart-upsell]')) upsellAt = Date.now();
  }, true);

  function isAdd(input) {
    try {
      var url = typeof input === 'string' ? input : (input && input.url) || String(input);
      return /\/cart\/add(\.js)?$/.test(new URL(url, window.location.href).pathname);
    } catch (err) { return false; }
  }

  function closeSearchOverlay() {
    document.querySelectorAll('wp-search-overlay[open]').forEach(function (el) {
      if (typeof el.closeOverlay === 'function') el.closeOverlay(false);
    });
  }

  function onAdded() {
    if (timer) return;
    closeSearchOverlay();
    var drawer = document.querySelector('cart-drawer');
    if (drawer && delay > 0) {
      // Let the native renderContents() open it first; open() is a no-op when already active.
      setTimeout(function () {
        if (typeof drawer.open === 'function' && !drawer.classList.contains('active')) drawer.open();
      }, Math.min(150, delay));
    }
    timer = setTimeout(function () { window.location.assign(cartUrl); }, delay);
  }

  var nativeFetch = window.fetch;
  if (redirectOn && !onCartPage && typeof nativeFetch === 'function') {
    window.fetch = function (input) {
      // The original call and its original promise are returned untouched; the response is only inspected via clone().
      var promise = nativeFetch.apply(this, arguments);
      var skip = Date.now() - upsellAt < 1500;
      if (isAdd(input) && !skip) {
        promise.then(function (response) {
          if (!response || !response.ok) return;
          return response.clone().json().then(function (data) {
            if (data && (data.status || data.errors)) return;
            onAdded();
          });
        }).catch(function () {});
      }
      return promise;
    };
  }

  /* ---------- 2. Drawer minus at quantity 1 removes the line ---------- */

  function qtyOf(btn) {
    var input = btn.closest('quantity-input') && btn.closest('quantity-input').querySelector('input');
    return input ? parseInt(input.value, 10) : NaN;
  }

  function rowOf(btn) { return btn.closest('[data-aria-cart-item]'); }

  function removeButtonOf(row) { return row && row.querySelector('cart-remove-button button'); }

  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest && e.target.closest('.aria-cart__qty-btn--minus');
    if (!btn || !btn.closest('.aria-cart')) return;
    if (!(qtyOf(btn) <= 1)) return;
    var row = rowOf(btn);
    var remove = removeButtonOf(row);
    if (!remove) return;
    // Runs before QuantityInput's own handler, which would set 0 and be rejected by the min rule.
    e.preventDefault();
    e.stopImmediatePropagation();
    var items = document.getElementById('CartDrawer-CartItems');
    if (row.hasAttribute('data-wp-removing') || (items && items.classList.contains('cart__items--disabled'))) return;
    row.setAttribute('data-wp-removing', 'true');
    row.setAttribute('aria-busy', 'true');
    // Same path as the Remove link: cart.js updateQuantity(line, 0) re-renders the drawer, bubble and empty state.
    remove.click();
    setTimeout(function () {
      row.removeAttribute('data-wp-removing');
      row.removeAttribute('aria-busy');
    }, 5000);
  }, true);

  // At quantity 1 the minus button is announced as the line's Remove label (already localized in the markup).
  function labelMinus() {
    document.querySelectorAll('.aria-cart .aria-cart__qty-btn--minus').forEach(function (btn) {
      var remove = removeButtonOf(rowOf(btn));
      var label = remove && remove.getAttribute('aria-label');
      if (label && qtyOf(btn) <= 1) {
        if (btn.getAttribute('aria-label') !== label) btn.setAttribute('aria-label', label);
      } else if (btn.hasAttribute('aria-label')) {
        btn.removeAttribute('aria-label');
      }
    });
  }

  var queued = false;
  function queueLabel() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; labelMinus(); });
  }

  document.addEventListener('change', function (e) {
    if (e.target && e.target.closest && e.target.closest('.aria-cart')) queueLabel();
  });

  function observe() {
    labelMinus();
    var drawer = document.querySelector('cart-drawer');
    if (drawer) new MutationObserver(queueLabel).observe(drawer, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observe);
  else observe();
})();
