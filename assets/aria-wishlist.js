/* Wig Party — localStorage-backed wishlist + wishlist drawer.
 *
 * Loaded once from layout/theme.liquid. The guard below is not optional: this file was
 * previously included by both best-sellers.liquid and new-trending.liquid, so the IIFE
 * ran twice and registered TWO document click listeners. A single click then ran both —
 * the first pushed the product id, the second re-read storage, found it, and spliced it
 * straight back out — so the wishlist always saved an empty array and aria-pressed never
 * flipped. Keep the guard even though the include is now single-sourced.
 *
 * Drawer behaviour follows Dawn's cart drawer contract (`.active` class, overlay click,
 * Escape, `overflow-hidden` on <body>, Dawn's own trapFocus/removeTrapFocus) so there is
 * one drawer idiom in the theme rather than two. Add-to-cart goes through the SAME path
 * product-form.js uses — POST /cart/add.js, then hand the response to the live
 * <cart-notification>/<cart-drawer> via renderContents — so the cart drawer, its count
 * bubble and its section rendering all keep working untouched.
 *
 * Public API (for a future header entry point): window.AriaWishlist.open() / .close() /
 * .count() / .items(). A `wishlist:updated` event fires on document after every change. */
(function () {
  if (window.__ariaWishlistInit) return;
  window.__ariaWishlistInit = true;

  var STORAGE_KEY = 'ariaWishlist';

  /* ---------------------------------------------------------------------------------
     Storage. Every read goes through normalise(), so malformed or legacy data can never
     reach the render path.
     --------------------------------------------------------------------------------- */

  /* An entry is keyed by variant, not product: two colours of the same wig are two
     wishlist rows, and /cart/add.js needs a variant id anyway. */
  function keyOf(entry) {
    if (!entry) return '';
    return String(entry.variantId || entry.id || '');
  }

  function normalise(raw) {
    if (!Array.isArray(raw)) return [];
    var seen = {};
    var out = [];
    raw.forEach(function (entry) {
      /* Pre-drawer builds stored bare product-id STRINGS. Such an entry carries no title,
         image, price or variant, so it can be neither drawn nor added to a cart, and
         there is nothing to hydrate it from client-side. Dropping it is the only
         normalisation available; the visitor simply re-hearts the product. */
      if (!entry || typeof entry !== 'object') return;
      var key = keyOf(entry);
      if (!key || seen[key]) return;
      if (!entry.title) return;
      seen[key] = true;
      out.push({
        id: String(entry.id || ''),
        variantId: String(entry.variantId || ''),
        handle: String(entry.handle || ''),
        title: String(entry.title || ''),
        url: String(entry.url || ''),
        image: String(entry.image || ''),
        vendor: String(entry.vendor || ''),
        variantTitle: String(entry.variantTitle || ''),
        price: String(entry.price || ''),
        comparePrice: String(entry.comparePrice || ''),
        available: entry.available !== false,
      });
    });
    return out;
  }

  function read() {
    try {
      return normalise(JSON.parse(localStorage.getItem(STORAGE_KEY)));
    } catch (error) {
      /* Corrupt JSON, or localStorage blocked entirely (private mode, quota). Never let
         this take the page down — an unavailable wishlist is a degraded feature, not a
         broken theme. */
      return [];
    }
  }

  function write(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (error) {
      /* Unavailable storage: the in-memory list still drives this page's UI. */
    }
    document.dispatchEvent(
      new CustomEvent('wishlist:updated', { detail: { items: list, count: list.length } })
    );
  }

  function indexOfKey(list, key) {
    for (var i = 0; i < list.length; i++) {
      if (keyOf(list[i]) === key) return i;
    }
    return -1;
  }

  /* ---------------------------------------------------------------------------------
     Heart buttons
     --------------------------------------------------------------------------------- */

  /* The card's LIVE state wins over the Liquid snapshot: the swatch handler
     (aria-product-card.js) rewrites the quick-add variant id, the primary image and the
     price when a colour is picked, so reading those means the wishlist stores the colour
     the shopper is actually looking at. */
  function entryFromButton(button) {
    var d = button.dataset;
    var card = button.closest('.aria-product-card');
    var liveVariant = card && card.querySelector('.aria-product-card__quick-add-form input[name="id"]');
    var liveImage = card && card.querySelector('.aria-product-card__image--primary');
    var livePrice = card && card.querySelector('.aria-product-card__price-current');
    var liveCompare = card && card.querySelector('.aria-product-card__price-compare');
    var liveSwatch = card && card.querySelector('.aria-product-card__swatch--selected');

    return {
      id: d.productId || '',
      variantId: (liveVariant && liveVariant.value) || d.variantId || '',
      handle: d.productHandle || '',
      title: d.productTitle || '',
      url: d.productUrl || '',
      image: (liveImage && liveImage.tagName === 'IMG' && liveImage.getAttribute('src')) || d.productImage || '',
      vendor: d.productVendor || '',
      variantTitle: (liveSwatch && liveSwatch.dataset.swatchValue) || '',
      price: (livePrice && livePrice.textContent.trim()) || d.productPrice || '',
      comparePrice: (liveCompare && liveCompare.textContent.trim()) || d.productComparePrice || '',
      /* Availability has to come from the SELECTED swatch, not the button. The button's
         attribute is a Liquid snapshot of the card's default variant, so hearting a
         sold-out colour would otherwise be stored as available and only fail later at
         /cart/add. The swatch carries `data-variant-available` per colour. */
      available: liveSwatch
        ? liveSwatch.dataset.variantAvailable !== 'false'
        : d.productAvailable !== 'false',
    };
  }

  /* A heart is "pressed" when that card's CURRENT variant is in the list, so switching
     colour on a card correctly shows the new colour as un-wishlisted. */
  function syncButton(button, list) {
    var key = keyOf(entryFromButton(button));
    button.setAttribute('aria-pressed', String(key !== '' && indexOfKey(list, key) !== -1));
  }

  function syncAllButtons(list) {
    document.querySelectorAll('[data-wishlist-toggle]').forEach(function (button) {
      syncButton(button, list);
    });
  }

  /* ---------------------------------------------------------------------------------
     Count. Drives every `[data-wishlist-count]` badge on the page — the header ships one,
     and any added later is picked up with no extra wiring. Hidden at zero, mirroring the
     cart bubble, which only renders for a non-empty cart.
     --------------------------------------------------------------------------------- */
  function syncCount(list) {
    document.querySelectorAll('[data-wishlist-count]').forEach(function (el) {
      el.textContent = String(list.length);
      el.hidden = list.length === 0;
    });
    document.querySelectorAll('[data-wishlist-open]').forEach(function (el) {
      el.setAttribute('data-wishlist-empty', String(list.length === 0));
    });
  }

  /* ---------------------------------------------------------------------------------
     Drawer
     --------------------------------------------------------------------------------- */
  var drawer = null;
  var itemsEl = null;
  var emptyEl = null;
  var template = null;
  var lastFocused = null;

  function cacheDrawer() {
    if (drawer) return drawer;
    drawer = document.querySelector('[data-wishlist-drawer]');
    if (!drawer) return null;
    itemsEl = drawer.querySelector('[data-wishlist-items]');
    emptyEl = drawer.querySelector('[data-wishlist-empty]');
    template = document.getElementById('AriaWishlistItemTemplate');
    return drawer;
  }

  function renderRow(entry) {
    var node = template.content.firstElementChild.cloneNode(true);
    node.dataset.wishlistKey = keyOf(entry);

    var img = node.querySelector('[data-wl-image]');
    if (entry.image) {
      img.src = entry.image;
      img.alt = entry.title;
    } else {
      /* Remove the whole media link, not just the <img>: an empty <a> would be hidden by
         base.css's `a:empty` rule but its 72px grid column would still be reserved,
         leaving the details indented past a gap. */
      var media = node.querySelector('.aria-wl-item__media');
      if (media) media.remove();
      node.classList.add('aria-wl-item--no-media');
    }

    node.querySelectorAll('[data-wl-link]').forEach(function (link) {
      if (entry.url) {
        link.href = entry.url;
      } else {
        link.removeAttribute('href');
      }
    });

    node.querySelector('[data-wl-title]').textContent = entry.title;

    var vendor = node.querySelector('[data-wl-vendor]');
    if (entry.vendor) {
      vendor.textContent = entry.vendor;
      vendor.hidden = false;
    }

    var variant = node.querySelector('[data-wl-variant]');
    if (entry.variantTitle) {
      variant.textContent = entry.variantTitle;
      variant.hidden = false;
    }

    node.querySelector('[data-wl-price]').textContent = entry.price;

    var compare = node.querySelector('[data-wl-compare]');
    if (entry.comparePrice) {
      compare.textContent = entry.comparePrice;
      compare.hidden = false;
    }

    /* A variant that was sold out when it was hearted cannot be added; say so on the
       button rather than letting the shopper hit a failing request. */
    var add = node.querySelector('[data-wl-add]');
    if (!entry.available || !entry.variantId) {
      add.disabled = true;
      add.querySelector('.aria-wl-item__add-label').textContent = add.dataset.soldOutLabel || 'Sold out';
    }

    return node;
  }

  function render(list) {
    if (!cacheDrawer()) return;

    var isEmpty = list.length === 0;
    emptyEl.hidden = !isEmpty;
    itemsEl.hidden = isEmpty;
    drawer.classList.toggle('aria-wl-drawer--empty', isEmpty);

    /* Rebuilt from a fragment in one pass rather than by appending row by row, so the
       drawer reflows once per change however many items there are. */
    var fragment = document.createDocumentFragment();
    list.forEach(function (entry) {
      fragment.appendChild(renderRow(entry));
    });
    itemsEl.textContent = '';
    itemsEl.appendChild(fragment);
  }

  function open() {
    if (!cacheDrawer() || drawer.classList.contains('active')) return;
    lastFocused = document.activeElement;
    drawer.setAttribute('aria-hidden', 'false');

    /* Flush pending style/layout so the browser has a resolved "before" state (overlay
       opacity 0, inner translateX(100%)) to transition FROM. Dawn defers this with a
       zero-delay setTimeout; reading a layout property is the deterministic equivalent and
       keeps open() synchronous, so callers — and tests — see `.active` immediately instead
       of one tick later. The drawer is only `visibility: hidden`, never `display: none`,
       so those start values are already computed and there is nothing to wait for. */
    void drawer.offsetWidth;

    drawer.classList.add('animate', 'active');
    document.body.classList.add('overflow-hidden');

    drawer.addEventListener(
      'transitionend',
      function () {
        var focusTarget = drawer.querySelector('[data-wishlist-close]');
        if (typeof trapFocus === 'function') trapFocus(drawer, focusTarget);
        else if (focusTarget) focusTarget.focus();
      },
      { once: true }
    );
  }

  /* THE single way anything opens this drawer. Every trigger — the header button, a
     product-page icon, a future section, the public API, the custom event — funnels through
     here, so "read the latest state, then show it" can never be reimplemented slightly
     differently somewhere else. Rendering before opening is what guarantees the drawer
     never flashes stale rows or a wrong empty state. */
  function openWishlistDrawer() {
    render(read());
    open();
  }

  function close() {
    if (!cacheDrawer() || !drawer.classList.contains('active')) return;
    drawer.classList.remove('active');
    drawer.setAttribute('aria-hidden', 'true');

    /* Release the body scroll lock only if no OTHER drawer still needs it. The cart
       drawer (and this store's Rebuy cart) set the same `overflow-hidden` class, so
       unconditionally removing it here would unlock the page behind a cart drawer that
       is still open — which is exactly what happens on the add-to-cart handover. */
    if (!document.querySelector('cart-drawer.active, .drawer.active, [data-wishlist-drawer].active')) {
      document.body.classList.remove('overflow-hidden');
    }

    if (typeof removeTrapFocus === 'function') removeTrapFocus(lastFocused);
    else if (lastFocused && lastFocused.focus) lastFocused.focus();
    lastFocused = null;
  }

  /* ---------------------------------------------------------------------------------
     Mutations — every one of these is the single place that writes, renders and syncs,
     so localStorage and the UI cannot drift apart.
     --------------------------------------------------------------------------------- */
  function commit(list) {
    write(list);
    render(list);
    syncAllButtons(list);
    syncCount(list);
    return list;
  }

  function removeKey(key) {
    var list = read();
    var index = indexOfKey(list, key);
    if (index === -1) return list;
    list.splice(index, 1);
    return commit(list);
  }

  /* ---------------------------------------------------------------------------------
     Add to cart. Reuses product-form.js's exact path so the existing cart drawer,
     its section rendering and its count bubble all behave identically.
     --------------------------------------------------------------------------------- */
  function cartElement() {
    return document.querySelector('cart-notification') || document.querySelector('cart-drawer');
  }

  function addToCart(entry, row) {
    var button = row.querySelector('[data-wl-add]');
    var errorEl = row.querySelector('[data-wl-error]');
    if (button.getAttribute('aria-busy') === 'true') return;

    button.setAttribute('aria-busy', 'true');
    button.disabled = true;
    row.classList.add('aria-wl-item--loading');
    errorEl.hidden = true;
    errorEl.textContent = '';

    var cart = cartElement();
    var body = { items: [{ id: Number(entry.variantId), quantity: 1 }] };
    if (cart && typeof cart.getSectionsToRender === 'function') {
      body.sections = cart.getSectionsToRender().map(function (section) {
        return section.id;
      });
      body.sections_url = window.location.pathname;
    }

    fetch((window.routes && window.routes.cart_add_url ? window.routes.cart_add_url : '/cart/add') + '.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/javascript' },
      body: JSON.stringify(body),
    })
      .then(function (response) {
        return response.json().then(function (data) {
          /* /cart/add.js answers 422 with a description for sold-out or invalid variants;
             treat any non-2xx, and any payload carrying `status`, as a failure. */
          if (!response.ok || data.status) {
            throw new Error(data.description || data.message || 'cart_error');
          }
          return data;
        });
      })
      .then(function (data) {
        /* ONLY on success: drop it from the wishlist, then let the theme's own cart UI
           take over exactly as it would after a product-form submit. */
        removeKey(keyOf(entry));

        /* Close BEFORE handing over, so the cart drawer's own open() is the last thing to
           touch the body scroll lock. Closing afterwards would have this drawer release a
           lock the cart drawer had just taken. Stacking the two dialogs is also avoided. */
        close();

        if (cart && typeof cart.renderContents === 'function') {
          cart.renderContents(data);
        }
        if (typeof publish === 'function' && typeof PUB_SUB_EVENTS !== 'undefined') {
          publish(PUB_SUB_EVENTS.cartUpdate, {
            source: 'aria-wishlist',
            productVariantId: entry.variantId,
            cartData: data,
          });
        }
      })
      .catch(function (error) {
        /* Failure path: the item STAYS in the wishlist and says why. */
        row.classList.remove('aria-wl-item--loading');
        button.removeAttribute('aria-busy');
        button.disabled = false;
        errorEl.textContent = error && error.message && error.message !== 'cart_error'
          ? error.message
          : errorEl.dataset.fallback || 'Could not add to cart. Please try again.';
        errorEl.hidden = false;
      });
  }

  /* ---------------------------------------------------------------------------------
     Listeners — three delegated handlers for the whole feature.
     --------------------------------------------------------------------------------- */
  document.addEventListener('click', function (event) {
    var target = event.target;
    if (!target || !target.closest) return;

    /* VIEW is checked before ADD, deliberately. A view trigger nested inside (or sharing an
       element with) a toggle would otherwise fall through to the toggle and silently remove
       the product the shopper was trying to look at. Explicit view intent always wins. */
    if (target.closest('[data-wishlist-open]')) {
      event.preventDefault();
      openWishlistDrawer();
      return;
    }

    /* Heart toggle — ADD/remove intent */
    var toggle = target.closest('[data-wishlist-toggle]');
    if (toggle) {
      var entry = entryFromButton(toggle);
      var key = keyOf(entry);
      if (!key) return;

      var list = read();
      var index = indexOfKey(list, key);
      if (index === -1) {
        list.push(entry);
        commit(list);
        /* Requirement: adding opens the drawer. Un-hearting does not — reopening the
           drawer to show the thing you just removed would be noise. */
        open();
      } else {
        list.splice(index, 1);
        commit(list);
      }
      return;
    }

    if (target.closest('[data-wishlist-close]') || target.closest('[data-wishlist-overlay]')) {
      close();
      return;
    }

    var row = target.closest('[data-wishlist-item]');
    if (!row) return;

    var rowKey = row.dataset.wishlistKey;
    var current = read();
    var entryIndex = indexOfKey(current, rowKey);

    if (target.closest('[data-wl-remove]')) {
      removeKey(rowKey);
      return;
    }

    if (target.closest('[data-wl-add]') && entryIndex !== -1) {
      addToCart(current[entryIndex], row);
    }
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && drawer && drawer.classList.contains('active')) close();
  });

  /* Another tab changed the wishlist: re-sync rather than letting the two drift. */
  window.addEventListener('storage', function (event) {
    if (event.key !== STORAGE_KEY) return;
    var list = read();
    render(list);
    syncAllButtons(list);
    syncCount(list);
  });

  /* ---------------------------------------------------------------------------------
     Boot
     --------------------------------------------------------------------------------- */
  function boot() {
    var list = read();
    /* Rewrite once on load so a legacy or corrupt payload is normalised in storage, not
       just in memory. */
    write(list);
    render(list);
    syncAllButtons(list);
    syncCount(list);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  /* Event-based entry point for anything that would rather dispatch than call — e.g. a
     section script that must not depend on load order. Same funnel as every other trigger. */
  document.addEventListener('wishlist:open', openWishlistDrawer);

  window.AriaWishlist = {
    open: openWishlistDrawer,
    close: close,
    count: function () {
      return read().length;
    },
    items: read,
  };

  /* Named global the brief asks for. Aliased, not a second implementation. */
  window.openWishlistDrawer = openWishlistDrawer;
})();
