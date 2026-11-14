/* Wig Party — cart drawer extras (snippets/cart-drawer.liquid).

   Dawn's cart scripts (cart-drawer.js, cart.js, global.js) already handle opening, the
   quantity steppers, removal and re-rendering. This adds the three Wig Party actions:
     • "Save for later" — saves that line to the theme wishlist, then removes it from the
       cart through the line's own Remove button (so Dawn's update/re-render path runs);
     • "Save my bag"    — saves every line to the wishlist and opens it; the cart is kept;
     • upsell "ADD"     — adds the upsell variant and redraws the drawer in place.
   One delegated listener, so it keeps working after the drawer's HTML is re-rendered.
   It also applies and removes discount codes, and defines <aria-cart-recs>, the
   recommended-product upsell row (see below). */
(function () {
  if (window.ariaCartDrawerReady) return;
  window.ariaCartDrawerReady = true;

  function entryFrom(row) {
    var d = row.dataset;
    return {
      id: d.cartWlId || '',
      variantId: d.cartWlVariantId || '',
      handle: d.cartWlHandle || '',
      title: d.cartWlTitle || '',
      url: d.cartWlUrl || '',
      image: d.cartWlImage || '',
      variantTitle: d.cartWlVariantTitle || '',
      price: d.cartWlPrice || '',
      available: d.cartWlAvailable !== 'false',
    };
  }

  function saveToWishlist(entries) {
    if (!window.AriaWishlist || typeof window.AriaWishlist.add !== 'function') return false;
    window.AriaWishlist.add(entries);
    return true;
  }

  function drawer() {
    return document.querySelector('cart-drawer');
  }

  /* Discount codes. Shopify's Ajax cart takes the full list of codes in one `discount`
     field (/cart/update.js), so applying or removing one re-sends the others. A code the
     cart cannot use comes back `applicable: false`; it is dropped again straight away, so
     it never lingers on the cart, and the message names it. */
  function currentCodes() {
    return fetch(window.routes.cart_url + '.js', { headers: { Accept: 'application/json' } })
      .then(function (response) {
        return response.json();
      })
      .then(function (cart) {
        return (cart.discount_codes || []).map(function (entry) {
          return entry.code;
        });
      });
  }

  function updateCodes(codes) {
    return fetch(window.routes.cart_update_url + '.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        discount: codes.join(','),
        sections: 'cart-drawer,cart-icon-bubble',
        sections_url: window.location.pathname,
      }),
    })
      .then(function (response) {
        return response.json();
      })
      .then(function (state) {
        var cart = drawer();
        if (state && state.sections && cart && typeof cart.renderContents === 'function') {
          cart.renderContents(state);
        }
        return state;
      });
  }

  function showDiscountError(message) {
    var error = document.getElementById('CartDrawer-DiscountError');
    if (!error) return;
    error.textContent = message;
    error.hidden = !message;
  }

  document.addEventListener('submit', function (event) {
    var form = event.target.closest && event.target.closest('[data-aria-cart-discount-form]');
    if (!form) return;
    event.preventDefault();

    var input = form.querySelector('input[name="discount"]');
    var button = form.querySelector('button[type="submit"]');
    var code = input ? input.value.trim() : '';
    var box = form.closest('[data-aria-cart-discount]');
    var template = (box && box.dataset.error) || '[code] can\'t be used with this cart.';
    if (!code || form.getAttribute('aria-busy') === 'true') return;

    form.setAttribute('aria-busy', 'true');
    if (button) button.disabled = true;
    showDiscountError('');

    currentCodes()
      .then(function (codes) {
        var others = codes.filter(function (existing) {
          return existing.toLowerCase() !== code.toLowerCase();
        });
        return updateCodes(others.concat(code)).then(function (state) {
          var entry = (state.discount_codes || []).filter(function (item) {
            return item.code.toLowerCase() === code.toLowerCase();
          })[0];
          if (entry && entry.applicable) return;
          return updateCodes(others).then(function () {
            showDiscountError(template.replace('[code]', code));
          });
        });
      })
      .catch(function () {
        showDiscountError(window.cartStrings ? window.cartStrings.error : 'Something went wrong.');
      })
      .finally(function () {
        form.removeAttribute('aria-busy');
        if (button) button.disabled = false;
      });
  });

  /* <aria-cart-recs> — the upsell row when it shows a recommendation. Dawn re-renders the
     drawer's HTML after every cart change, which re-creates this element, so the rendered
     row is cached per cart (data-key = the cart's product ids) and redrawn instantly. */
  var recsCache = {};
  if (!customElements.get('aria-cart-recs')) {
    customElements.define(
      'aria-cart-recs',
      class extends HTMLElement {
        connectedCallback() {
          var key = this.dataset.key || '';
          var self = this;
          if (!recsCache[key]) {
            recsCache[key] = fetch(this.dataset.url)
              .then(function (response) {
                if (!response.ok) throw new Error(response.status);
                return response.text();
              })
              .then(function (html) {
                var doc = new DOMParser().parseFromString(html, 'text/html');
                var row = doc.querySelector('.aria-cart__upsell');
                return row ? row.outerHTML : '';
              })
              .catch(function () {
                delete recsCache[key];
                return '';
              });
          }
          recsCache[key].then(function (html) {
            if (self.isConnected) self.innerHTML = html;
          });
        }
      }
    );
  }

  document.addEventListener('click', function (event) {
    var target = event.target;
    if (!target || !target.closest || !target.closest('.aria-cart')) return;

    var saveItem = target.closest('[data-aria-cart-save-item]');
    if (saveItem) {
      var row = saveItem.closest('[data-aria-cart-item]');
      if (!row) return;
      if (!saveToWishlist(entryFrom(row))) return;
      var remove = row.querySelector('cart-remove-button button');
      if (remove) remove.click();
      return;
    }

    if (target.closest('[data-aria-cart-save-bag]')) {
      var rows = document.querySelectorAll('.aria-cart [data-aria-cart-item]');
      var entries = Array.prototype.map.call(rows, entryFrom);
      if (!entries.length || !saveToWishlist(entries)) return;
      var cart = drawer();
      if (cart && typeof cart.close === 'function') cart.close();
      if (window.AriaWishlist && window.AriaWishlist.open) window.AriaWishlist.open();
      return;
    }

    var removeCode = target.closest('[data-aria-cart-discount-remove]');
    if (removeCode) {
      var drop = removeCode.dataset.ariaCartDiscountRemove.toLowerCase();
      removeCode.disabled = true;
      currentCodes().then(function (codes) {
        return updateCodes(
          codes.filter(function (code) {
            return code.toLowerCase() !== drop;
          })
        );
      });
      return;
    }

    var upsell = target.closest('[data-aria-cart-upsell]');
    if (upsell) {
      if (upsell.getAttribute('aria-busy') === 'true') return;
      upsell.setAttribute('aria-busy', 'true');
      fetch(window.routes.cart_add_url + '.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          items: [{ id: Number(upsell.dataset.ariaCartUpsell), quantity: 1 }],
          sections: 'cart-drawer,cart-icon-bubble',
          sections_url: window.location.pathname,
        }),
      })
        .then(function (response) {
          return response.json();
        })
        .then(function (state) {
          var cart = drawer();
          if (state && state.sections && cart && typeof cart.renderContents === 'function') {
            cart.renderContents(state);
          } else {
            window.location.href = window.routes.cart_url;
          }
        })
        .catch(function () {
          window.location.href = window.routes.cart_url;
        })
        .finally(function () {
          upsell.removeAttribute('aria-busy');
        });
    }
  });
})();
