/* Wig Party cart page: qty change, remove, add-to-cart, recommendation cards, save for later. Uses /cart/change.js and /cart/add.js. */
(function () {
  // The script tag sits inside the section, so a theme editor reload would bind the handlers twice.
  if (window.wpMainCartReady) return;
  window.wpMainCartReady = true;

  function root() { return document.querySelector('[data-wp-cart]'); }

  function post(url, body) {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body)
    }).then(function (r) {
      if (!r.ok) throw new Error('cart request failed: ' + r.status);
      return r.json();
    });
  }

  // Same sections/selectors as cart-drawer.js getSectionsToRender(). renderContents() is not
  // called because it also opens the drawer; here only the markup is swapped.
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

  // Threshold is set in store currency; convert with Shopify.currency.rate when the cart is
  // in the active presentment currency, otherwise compare as-is.
  function updateShippingProgress() {
    var p = document.querySelector('[data-wp-progress]');
    if (!p) return;
    var base = Number(p.getAttribute('data-threshold-base'));
    var total = Number(p.getAttribute('data-cart-total'));
    var currency = p.getAttribute('data-cart-currency');
    var shopify = window.Shopify && window.Shopify.currency;
    var rate = shopify && shopify.active === currency ? parseFloat(shopify.rate) : 1;
    if (!(rate > 0)) rate = 1;
    var threshold = Math.round(base * rate);
    if (!(threshold > 0)) return;
    var progress = Math.min(total / threshold, 1);
    p.style.setProperty('--wp-progress', progress);
    var fill = p.querySelector('[data-wp-progress-fill]');
    if (fill) fill.style.width = (progress * 100) + '%';
    var title = p.querySelector('[data-wp-progress-title]');
    if (!title) return;
    if (progress >= 1) {
      title.textContent = p.getAttribute('data-unlocked-text');
    } else {
      var amount = (threshold - total) / 100;
      var text;
      try { text = new Intl.NumberFormat(document.documentElement.lang || undefined, { style: 'currency', currency: currency }).format(amount); }
      catch (err) { text = amount.toFixed(2) + ' ' + currency; }
      title.textContent = p.getAttribute('data-locked-text').replace('[amount]', text);
    }
  }


  // Recommendation row: up to 4 cards (desktop CSS shows 3, mobile scrolls 4) from (1) cart_upsell_product, (2) /recommendations for the first cart
  // line, (3) optional fallback collection. Pool HTML is requested once per key and cached.
  var recsHtml = {};

  function fetchRecs(box) {
    var key = box.getAttribute('data-key');
    if (!key) return Promise.resolve('');
    if (recsHtml[key] !== undefined) return Promise.resolve(recsHtml[key]);
    var storeKey = 'wp_cart_recs_' + key;
    try {
      var hit = sessionStorage.getItem(storeKey);
      if (hit !== null) { recsHtml[key] = hit; return Promise.resolve(hit); }
    } catch (err) {}
    return fetch(box.getAttribute('data-url'))
      .then(function (r) { return r.ok ? r.text() : ''; })
      .catch(function () { return ''; })
      .then(function (html) {
        recsHtml[key] = html;
        try { sessionStorage.setItem(storeKey, html); } catch (err) {}
        return html;
      });
  }

  function cardsFrom(html) {
    var doc = new DOMParser().parseFromString(html, 'text/html');
    return Array.prototype.slice.call(doc.querySelectorAll('.wp-cart__rec'));
  }

  function renderRecs() {
    var box = document.querySelector('[data-wp-recs]');
    if (!box) return;
    var inCart = box.getAttribute('data-in-cart') || ',';
    var upsellT = box.querySelector('template[data-wp-recs-upsell]');
    var fallbackT = box.querySelector('template[data-wp-recs-fallback]');
    fetchRecs(box).then(function (html) {
      if (!box.isConnected) return;
      var pool = [];
      if (upsellT) pool = pool.concat(cardsFrom(upsellT.innerHTML));
      pool = pool.concat(cardsFrom(html || ''));
      if (fallbackT) pool = pool.concat(cardsFrom(fallbackT.innerHTML));
      var seen = {};
      var picked = [];
      pool.forEach(function (card) {
        var id = card.getAttribute('data-product-id');
        if (!id || seen[id] || inCart.indexOf(',' + id + ',') !== -1 || picked.length >= 4) return;
        seen[id] = true;
        picked.push(card);
      });
      var old = box.querySelector('.wp-cart__recs');
      if (old) old.remove();
      if (!picked.length) { box.hidden = true; return; }
      var row = document.createElement('div');
      row.className = 'wp-cart__recs' + (picked.length < 3 ? ' wp-cart__recs--few' : '');
      picked.forEach(function (card) { row.appendChild(document.importNode(card, true)); });
      box.appendChild(row);
      box.hidden = false;
    });
  }

  function refresh() {
    var el = root();
    if (!el) return;
    var id = el.getAttribute('data-section-id');
    var oldP = el.querySelector('[data-wp-progress]');
    var oldVal = oldP && oldP.style.getPropertyValue('--wp-progress');
    el.classList.add('is-loading');
    updateHeaderCart();
    return fetch(window.location.pathname + '?section_id=' + id)
      .then(function (r) { return r.text(); })
      .then(function (html) {
        var next = new DOMParser().parseFromString(html, 'text/html').querySelector('[data-wp-cart]');
        if (next) {
          var newP = next.querySelector('[data-wp-progress]');
          if (newP && oldVal) { newP.style.setProperty('--wp-progress', oldVal); }
          el.replaceWith(next);
          if (newP) void newP.offsetWidth;
          requestAnimationFrame(updateShippingProgress);
          renderRecs();
        }
        else window.location.reload();
      })
      .catch(function () { window.location.reload(); });
  }

  updateShippingProgress();
  renderRecs();

  // Search overlay add: refresh the cart section (only on the cart page; root() is null elsewhere).
  // Only events tagged by the overlay count, because refresh() itself fires wp:cart-updated (no loop).
  document.addEventListener('wp:cart-updated', function (e) {
    if (e.detail && e.detail.source === 'search-overlay' && root()) refresh();
  });

  function change(line, quantity) {
    // On failure refresh anyway so the page shows the real cart again.
    return post('/cart/change.js', { line: Number(line), quantity: Math.max(0, Number(quantity) || 0) })
      .catch(function () {})
      .then(refresh);
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-wp-qty-minus],[data-wp-qty-plus],[data-wp-remove],[data-wp-save],[data-wp-add]');
    if (!t || !t.closest('[data-wp-cart]')) return;
    var item = t.closest('[data-line]');
    if (t.hasAttribute('data-wp-add')) {
      e.preventDefault();
      var variantId = Number(t.getAttribute('data-variant-id'));
      if (!variantId || t.disabled || t.getAttribute('aria-busy') === 'true') return;
      t.setAttribute('aria-busy', 'true');
      post('/cart/add.js', { id: variantId, quantity: 1 })
        .then(refresh)
        .catch(function () { t.removeAttribute('aria-busy'); });
      return;
    }
    if (!item) return;
    e.preventDefault();
    var line = item.getAttribute('data-line');
    var qty = Number(item.getAttribute('data-qty'));
    if (t.hasAttribute('data-wp-qty-minus')) change(line, qty - 1);
    else if (t.hasAttribute('data-wp-qty-plus')) change(line, qty + 1);
    else if (t.hasAttribute('data-wp-remove')) change(line, 0);
    else if (t.hasAttribute('data-wp-save')) {
      // Same as aria-cart-drawer.js: save the line to the theme wishlist, then remove it from the cart.
      var d = item.dataset;
      if (!window.AriaWishlist || typeof window.AriaWishlist.add !== 'function') return;
      window.AriaWishlist.add({
        id: d.cartWlId || '',
        variantId: d.cartWlVariantId || '',
        handle: d.cartWlHandle || '',
        title: d.cartWlTitle || '',
        url: d.cartWlUrl || '',
        image: d.cartWlImage || '',
        variantTitle: d.cartWlVariantTitle || '',
        price: d.cartWlPrice || '',
        available: d.cartWlAvailable !== 'false'
      });
      change(line, 0);
    }
  });

  document.addEventListener('change', function (e) {
    var input = e.target.closest('[data-wp-qty-input]');
    if (!input || !input.closest('[data-wp-cart]')) return;
    change(input.closest('[data-line]').getAttribute('data-line'), input.value);
  });
})();
