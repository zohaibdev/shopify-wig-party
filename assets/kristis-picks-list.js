/* Kristi's Picks list: quick add (first available variant) via /cart/add.js, then swaps the header cart
 * bubble and side cart markup without opening the drawer (same approach as main-cart.js). */
(function () {
  function updateHeaderCart() {
    return fetch(window.location.pathname + '?sections=cart-drawer,cart-icon-bubble')
      .then(function (r) { return r.json(); })
      .then(function (sections) {
        [
          { id: 'cart-drawer', target: '#CartDrawer', selector: '#CartDrawer' },
          { id: 'cart-icon-bubble', target: '#cart-icon-bubble', selector: '.shopify-section' }
        ].forEach(function (s) {
          if (!sections[s.id]) return;
          var target = document.querySelector(s.target);
          var src = new DOMParser().parseFromString(sections[s.id], 'text/html').querySelector(s.selector);
          if (target && src) target.innerHTML = src.innerHTML;
        });
        document.dispatchEvent(new CustomEvent('wp:cart-updated'));
      })
      .catch(function () {});
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-kp-add]');
    if (!btn || btn.disabled || btn.getAttribute('aria-busy') === 'true') return;
    var label = btn.querySelector('[data-kp-add-label]');
    var original = label.textContent;
    btn.setAttribute('aria-busy', 'true');
    fetch('/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ id: Number(btn.getAttribute('data-variant-id')), quantity: 1 })
    })
      .then(function (r) {
        if (!r.ok) throw new Error('add failed');
        return r.json();
      })
      .then(updateHeaderCart)
      .then(function () {
        btn.removeAttribute('aria-busy');
        btn.classList.add('is-added');
        label.textContent = btn.getAttribute('data-added-label');
        setTimeout(function () {
          btn.classList.remove('is-added');
          label.textContent = original;
        }, 2000);
      })
      .catch(function () {
        btn.removeAttribute('aria-busy');
      });
  });
})();
