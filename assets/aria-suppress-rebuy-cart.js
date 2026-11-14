/* Wig Party — keep Rebuy's Smart Cart from opening (layout/theme.liquid).

   The theme's own drawer (snippets/cart-drawer.liquid) is the cart. Rebuy's app script
   (cdn.rebuyengine.com/onsite/js/rebuy.js, injected by the app, not a theme embed) still
   builds its Smart Cart (#rebuy-cart) and pops it on every add to cart, so both carts
   opened. This switches off only the Smart Cart: `Rebuy.SmartCart.show` becomes a no-op
   and anything it already opened is closed; Rebuy's other widgets keep working. The CSS
   half (hide #rebuy-cart, undo its scroll lock) lives in component-aria-cart-drawer.css.

   Turning Smart Cart off (or uninstalling Rebuy) makes this inert; to go back to Rebuy's cart,
   remove the script tag in theme.liquid. */
(function () {
  if (window.ariaRebuyCartSuppressed) return;
  window.ariaRebuyCartSuppressed = true;

  var BODY_CLASSES = ['rebuy-cart-visible', 'rebuy-modal-visible'];

  function releaseBody() {
    var body = document.body;
    if (!body) return;
    BODY_CLASSES.forEach(function (name) {
      body.classList.remove(name);
    });
    document.documentElement.classList.remove('rebuy-cart-visible');
  }

  function patch() {
    var smartCart = window.Rebuy && window.Rebuy.SmartCart;
    if (!smartCart || typeof smartCart.show !== 'function') return false;
    if (smartCart.show.ariaNoop) return true;

    var noop = function () {};
    noop.ariaNoop = true;
    smartCart.show = noop;
    /* Not calling smartCart.hide(): it runs the store's Rebuy custom callbacks, one of which
       throws when the cart was never open. The CSS keeps #rebuy-cart hidden regardless. */
    releaseBody();
    return true;
  }

  /* Rebuy loads asynchronously and may re-create SmartCart on reinit, so patch on its
     events and keep checking for a while after load. */
  ['rebuy:smartcart.init', 'rebuy:smartcart.ready', 'rebuy.ready'].forEach(function (name) {
    document.addEventListener(name, patch);
  });
  document.addEventListener('rebuy:smartcart.show', function () {
    patch();
    releaseBody();
  });

  var tries = 0;
  var timer = setInterval(function () {
    patch();
    if (++tries > 120) clearInterval(timer);
  }, 250);

  /* If Rebuy still flags the body open (e.g. from an internal call path), undo it — but
     never touch Dawn's own `overflow-hidden`, which the theme drawer manages. */
  function watchBody() {
    new MutationObserver(function () {
      if (BODY_CLASSES.some(function (name) { return document.body.classList.contains(name); })) {
        releaseBody();
      }
    }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }
  if (document.body) watchBody();
  else document.addEventListener('DOMContentLoaded', watchBody);
})();
