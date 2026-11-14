/* Wig Party: product card quick-add pop-up.

   Loaded on demand by assets/aria-product-card.js (first card on the page, or the first
   click on a card's cart icon). The card's cart icon no longer posts straight to the cart:
   it opens this dialog so the shopper confirms the shade first. The shade selected on the
   card is preselected.

   Variant data comes from /products/<handle>.js on open (cached per handle), so the cards
   carry no per-variant JSON. Add to cart uses the same path as product-form.js and the
   wishlist drawer: POST /cart/add.js with the cart drawer's own sections, then hand the
   response to <cart-drawer>.renderContents(), which refreshes and opens the drawer.

   Public API: window.AriaQuickAdd.open({ handle, url, title, variantId, trigger }). */
(function () {
  if (window.AriaQuickAdd) return;

  var COLOUR_NAMES = ['color', 'colour', 'shade'];
  var cache = {};
  var dialog = null;
  var state = null;
  var lastTrigger = null;

  /* Same rule as assets/aria-colour-shades.js: 'Name - R ETA 12/2027' reads 'Name - R'. */
  function cleanName(name) {
    return String(name || '').split(/\s*\(?\s*ETA\b/i)[0].replace(/[\s(-]+$/, '').replace(/\s+/g, ' ').trim();
  }

  function etaText(name) {
    var match = String(name || '').match(/\bETA\b\s*([^)]*)/i);
    if (!match) return '';
    var rest = match[1].trim();
    return rest ? 'ETA ' + rest : 'ETA';
  }

  function isPrompt(value) {
    var lower = String(value || '').toLowerCase();
    return lower.indexOf('choose') !== -1 || lower.indexOf('dropdown') !== -1 || lower.indexOf('drop down') !== -1;
  }

  function money(cents) {
    if (window.AriaDiscountPrice && typeof window.AriaDiscountPrice.format === 'function') {
      return window.AriaDiscountPrice.format(cents);
    }
    try {
      var currency = (window.Shopify && window.Shopify.currency && window.Shopify.currency.active) || 'USD';
      return new Intl.NumberFormat(document.documentElement.lang || undefined, {
        style: 'currency',
        currency: currency,
      }).format(cents / 100);
    } catch (error) {
      return (cents / 100).toFixed(2);
    }
  }

  function sized(src, width) {
    if (!src) return '';
    var url = src.indexOf('//') === 0 ? 'https:' + src : src;
    return url + (url.indexOf('?') === -1 ? '?' : '&') + 'width=' + width;
  }

  function withVariant(url, id) {
    try {
      var u = new URL(url, window.location.origin);
      u.searchParams.set('variant', id);
      return u.pathname + u.search;
    } catch (error) {
      return url;
    }
  }

  function root() {
    return (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
  }

  function fetchProduct(handle) {
    if (cache[handle]) return cache[handle];
    cache[handle] = fetch(root() + 'products/' + encodeURIComponent(handle) + '.js', {
      headers: { Accept: 'application/json' },
    }).then(function (response) {
      if (!response.ok) throw new Error('product_fetch');
      return response.json();
    });
    cache[handle].catch(function () {
      delete cache[handle];
    });
    return cache[handle];
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  /* ---------------- Dialog shell (built once) ---------------- */
  function build() {
    if (dialog) return dialog;

    dialog = el('div', 'aria-qa');
    dialog.setAttribute('data-aria-quick-add', '');
    dialog.hidden = true;
    dialog.innerHTML =
      '<div class="aria-qa__overlay" data-qa-close></div>' +
      '<div class="aria-qa__panel" role="dialog" aria-modal="true" aria-labelledby="AriaQuickAddTitle" tabindex="-1">' +
      '<button type="button" class="aria-qa__close" data-qa-close aria-label="Close">' +
      '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>' +
      '</button>' +
      '<div class="aria-qa__media"><img class="aria-qa__image" alt="" data-qa-image></div>' +
      '<div class="aria-qa__body">' +
      '<h2 class="aria-qa__title" id="AriaQuickAddTitle" data-qa-title></h2>' +
      '<div class="aria-qa__price" data-qa-price data-compare-class="aria-qa__price-compare">' +
      '<span class="aria-qa__price-current" data-aria-price-current></span>' +
      '</div>' +
      '<div class="aria-qa__options" data-qa-options></div>' +
      '<div class="aria-qa__qty">' +
      '<label class="aria-qa__label" for="AriaQuickAddQty">Quantity</label>' +
      '<div class="aria-qa__qty-control">' +
      '<button type="button" class="aria-qa__qty-btn" data-qa-qty="-1" aria-label="Decrease quantity">&minus;</button>' +
      '<input type="number" id="AriaQuickAddQty" class="aria-qa__qty-input" min="1" value="1" inputmode="numeric" data-qa-qty-input>' +
      '<button type="button" class="aria-qa__qty-btn" data-qa-qty="1" aria-label="Increase quantity">+</button>' +
      '</div></div>' +
      '<p class="aria-qa__error" role="alert" hidden data-qa-error></p>' +
      '<button type="button" class="aria-qa__add" data-qa-add><span data-qa-add-text>Add to cart</span></button>' +
      '<a class="aria-qa__details" href="#" data-qa-details>View full details</a>' +
      '</div>' +
      '<div class="aria-qa__loading" data-qa-loading hidden>Loading</div>' +
      '</div>';
    document.body.appendChild(dialog);

    dialog.addEventListener('click', function (event) {
      var target = event.target;
      if (target.closest('[data-qa-close]')) {
        close();
        return;
      }
      var qtyBtn = target.closest('[data-qa-qty]');
      if (qtyBtn) {
        var input = dialog.querySelector('[data-qa-qty-input]');
        var next = Math.max(1, (parseInt(input.value, 10) || 1) + parseInt(qtyBtn.dataset.qaQty, 10));
        input.value = next;
        return;
      }
      var shade = target.closest('[data-qa-shade]');
      if (shade) {
        if (shade.getAttribute('aria-disabled') === 'true') return;
        state.selected[state.colourIndex] = shade.dataset.qaShade;
        update();
        return;
      }
      if (target.closest('[data-qa-add]')) add();
    });

    dialog.addEventListener('change', function (event) {
      var select = event.target.closest('[data-qa-option]');
      if (select) {
        state.selected[parseInt(select.dataset.qaOption, 10)] = select.value;
        update();
      }
    });

    dialog.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        close();
        return;
      }
      /* Arrow keys move between shades, like a radio group. */
      var shade = event.target.closest && event.target.closest('[data-qa-shade]');
      if (shade && (event.key === 'ArrowRight' || event.key === 'ArrowLeft' || event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
        event.preventDefault();
        var all = Array.prototype.slice.call(dialog.querySelectorAll('[data-qa-shade]'));
        var i = all.indexOf(shade) + (event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1);
        if (all[(i + all.length) % all.length]) all[(i + all.length) % all.length].focus();
      }
    });

    return dialog;
  }

  /* ---------------- State ---------------- */
  function findVariant(product, selected) {
    for (var i = 0; i < product.variants.length; i++) {
      var v = product.variants[i];
      var ok = true;
      for (var j = 0; j < selected.length; j++) {
        if (v.options[j] !== selected[j]) {
          ok = false;
          break;
        }
      }
      if (ok) return v;
    }
    return null;
  }

  function colourIndexOf(product) {
    for (var i = 0; i < product.options.length; i++) {
      var name = String(product.options[i].name || product.options[i]).toLowerCase();
      if (COLOUR_NAMES.indexOf(name) !== -1) return i;
    }
    return product.options.length > 1 || (product.options[0] && product.variants.length > 1) ? 0 : -1;
  }

  /* Best variant for a value at one position, other positions as currently selected. */
  function variantFor(product, index, value) {
    var exact = null;
    var any = null;
    product.variants.forEach(function (v) {
      if (v.options[index] !== value) return;
      var matchesRest = state.selected.every(function (sel, j) {
        return j === index || v.options[j] === sel;
      });
      if (matchesRest && !exact) exact = v;
      if (!any || (!any.available && v.available)) any = v;
    });
    return exact || any;
  }

  function renderOptions() {
    var product = state.product;
    var wrap = dialog.querySelector('[data-qa-options]');
    wrap.textContent = '';

    product.options.forEach(function (option, index) {
      var name = option.name || option;
      var values = (option.values || []).filter(function (value) {
        return !isPrompt(value);
      });
      if (values.length <= 1 && index !== state.colourIndex) return;

      var group = el('div', 'aria-qa__option');

      if (index === state.colourIndex) {
        var head = el('p', 'aria-qa__label');
        head.id = 'AriaQuickAddShadeLabel';
        head.appendChild(document.createTextNode(name + ': '));
        var current = el('span', 'aria-qa__shade-name');
        current.setAttribute('data-qa-shade-name', '');
        head.appendChild(current);
        group.appendChild(head);

        var list = el('div', 'aria-qa__shades');
        list.setAttribute('role', 'radiogroup');
        list.setAttribute('aria-labelledby', 'AriaQuickAddShadeLabel');
        values.forEach(function (value) {
          var v = variantFor(product, index, value);
          var available = !!(v && v.available);
          var eta = etaText(value);
          var btn = el('button', 'aria-qa__shade');
          btn.type = 'button';
          btn.setAttribute('role', 'radio');
          btn.dataset.qaShade = value;
          var label = cleanName(value);
          if (!available) label += ', sold out';
          else if (eta) label += ', pre-order, ' + eta;
          btn.setAttribute('aria-label', label);
          if (!available) {
            btn.setAttribute('aria-disabled', 'true');
            btn.classList.add('aria-qa__shade--sold-out');
          }
          var img = v && v.featured_image && v.featured_image.src;
          var dot = el('span', 'aria-qa__shade-dot');
          if (img) dot.style.backgroundImage = 'url("' + sized(img, 80) + '")';
          btn.appendChild(dot);
          var text = el('span', 'aria-qa__shade-text', cleanName(value));
          btn.appendChild(text);
          if (!available) btn.appendChild(el('span', 'aria-qa__shade-tag', 'Sold out'));
          else if (eta) btn.appendChild(el('span', 'aria-qa__shade-tag aria-qa__shade-tag--eta', 'Pre-order ' + eta));
          list.appendChild(btn);
        });
        group.appendChild(list);
      } else {
        var id = 'AriaQuickAddOption' + index;
        var lbl = el('label', 'aria-qa__label', name);
        lbl.setAttribute('for', id);
        group.appendChild(lbl);
        var select = el('select', 'aria-qa__select');
        select.id = id;
        select.dataset.qaOption = String(index);
        values.forEach(function (value) {
          var opt = el('option', '', cleanName(value));
          opt.value = value;
          select.appendChild(opt);
        });
        group.appendChild(select);
      }
      wrap.appendChild(group);
    });
  }

  function update() {
    var product = state.product;
    var variant = findVariant(product, state.selected);
    state.variant = variant;

    /* Shade buttons: checked state, and roving tabindex. */
    dialog.querySelectorAll('[data-qa-shade]').forEach(function (btn) {
      var on = state.colourIndex !== -1 && btn.dataset.qaShade === state.selected[state.colourIndex];
      btn.setAttribute('aria-checked', on ? 'true' : 'false');
      btn.tabIndex = on ? 0 : -1;
      btn.classList.toggle('aria-qa__shade--selected', on);
    });
    dialog.querySelectorAll('[data-qa-option]').forEach(function (select) {
      select.value = state.selected[parseInt(select.dataset.qaOption, 10)];
      Array.prototype.forEach.call(select.options, function (opt) {
        var v = variantFor(product, parseInt(select.dataset.qaOption, 10), opt.value);
        opt.disabled = !(v && v.available);
      });
    });
    var nameEl = dialog.querySelector('[data-qa-shade-name]');
    if (nameEl && state.colourIndex !== -1) nameEl.textContent = cleanName(state.selected[state.colourIndex]);

    /* Image: the variant's own image, else the product featured image. */
    var image = dialog.querySelector('[data-qa-image]');
    var src = (variant && variant.featured_image && variant.featured_image.src) || product.featured_image;
    if (src) {
      image.src = sized(src, 900);
      image.srcset = sized(src, 450) + ' 450w, ' + sized(src, 700) + ' 700w, ' + sized(src, 900) + ' 900w';
      image.sizes = '(min-width: 750px) 380px, 100vw';
      image.alt = state.title + (variant && state.colourIndex !== -1 ? ', ' + cleanName(state.selected[state.colourIndex]) : '');
      image.hidden = false;
    } else {
      image.hidden = true;
    }

    /* Price row: same attributes the cards use, so assets/aria-discount-price.js quotes
       what the cart will charge. */
    var row = dialog.querySelector('[data-qa-price]');
    var price = variant ? variant.price : product.price;
    var compareAt = variant ? variant.compare_at_price : product.compare_at_price;
    row.querySelector('[data-aria-price-current]').textContent = money(price);
    var compareEl = row.querySelector('[data-aria-price-compare]');
    if (compareAt && compareAt > price) {
      if (!compareEl) {
        compareEl = el('span', 'aria-qa__price-compare');
        compareEl.setAttribute('data-aria-price-compare', '');
        row.appendChild(compareEl);
      }
      compareEl.textContent = money(compareAt);
    } else if (compareEl) {
      compareEl.remove();
    }
    if (variant) {
      row.setAttribute('data-variant-id', variant.id);
      row.setAttribute('data-price-value', price);
      row.setAttribute('data-compare-value', compareAt && compareAt > price ? compareAt : 0);
      if (window.AriaDiscountPrice) window.AriaDiscountPrice.apply(row);
    }

    var addBtn = dialog.querySelector('[data-qa-add]');
    var addText = dialog.querySelector('[data-qa-add-text]');
    var canBuy = !!(variant && variant.available);
    addBtn.disabled = !canBuy;
    if (!variant) addText.textContent = 'Unavailable';
    else if (!variant.available) addText.textContent = 'Sold out';
    else if (state.colourIndex !== -1 && etaText(state.selected[state.colourIndex])) addText.textContent = 'Pre-order now';
    else addText.textContent = 'Add to cart';

    dialog.querySelector('[data-qa-details]').href = variant ? withVariant(state.url, variant.id) : state.url;
    dialog.querySelector('[data-qa-error]').hidden = true;
  }

  /* ---------------- Open / close ---------------- */
  function lock() {
    document.body.classList.add('overflow-hidden');
  }

  function unlock() {
    if (!document.querySelector('cart-drawer.active, .drawer.active, [data-wishlist-drawer].active')) {
      document.body.classList.remove('overflow-hidden');
    }
  }

  function open(options) {
    build();
    lastTrigger = options.trigger || document.activeElement;
    var panel = dialog.querySelector('.aria-qa__panel');
    var loading = dialog.querySelector('[data-qa-loading]');
    dialog.querySelector('[data-qa-title]').textContent = options.title || '';
    dialog.querySelector('[data-qa-qty-input]').value = 1;
    dialog.hidden = false;
    dialog.classList.add('aria-qa--busy');
    loading.hidden = false;
    lock();
    void dialog.offsetWidth;
    dialog.classList.add('aria-qa--open');
    panel.focus();

    var token = {};
    state = { token: token };

    return fetchProduct(options.handle)
      .then(function (product) {
        if (state.token !== token) return;
        state.product = product;
        state.title = options.title || product.title;
        state.url = (options.url || product.url || '').split('?')[0];
        state.colourIndex = colourIndexOf(product);

        var start = null;
        var wanted = String(options.variantId || '');
        product.variants.forEach(function (v) {
          if (String(v.id) === wanted) start = v;
        });
        /* The card's colour is preselected. If that exact variant cannot be bought, keep the
           colour and pick a purchasable variant of it, then any purchasable variant. */
        if (!start || !start.available) {
          var colour = start && state.colourIndex !== -1 ? start.options[state.colourIndex] : null;
          var sameColour = null;
          var firstAvailable = null;
          product.variants.forEach(function (v) {
            if (!v.available || isPrompt(v.options[state.colourIndex])) return;
            if (!firstAvailable) firstAvailable = v;
            if (colour && v.options[state.colourIndex] === colour && !sameColour) sameColour = v;
          });
          /* A sold-out card shade stays chosen (the button then reads Sold out) so the
             shopper sees why; with no card shade at all, the first purchasable one. */
          start = sameColour || start || firstAvailable;
        }
        if (!start) start = product.variants[0];
        state.selected = start.options.slice();

        dialog.querySelector('[data-qa-title]').textContent = state.title;
        renderOptions();
        update();
        dialog.classList.remove('aria-qa--busy');
        loading.hidden = true;
        if (typeof trapFocus === 'function') {
          var first = dialog.querySelector('.aria-qa__shade[aria-checked="true"]') || dialog.querySelector('[data-qa-add]');
          trapFocus(panel, first);
        }
      })
      .catch(function () {
        if (state.token !== token) return;
        loading.hidden = true;
        /* No data: send the shopper to the product page rather than leave a dead dialog. */
        window.location.href = options.variantId ? withVariant(options.url, options.variantId) : options.url;
      });
  }

  function close() {
    if (!dialog || dialog.hidden) return;
    dialog.classList.remove('aria-qa--open');
    state = null;
    var finish = function () {
      dialog.hidden = true;
    };
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) finish();
    else setTimeout(finish, 220);
    unlock();
    if (typeof removeTrapFocus === 'function') removeTrapFocus(lastTrigger);
    else if (lastTrigger && lastTrigger.focus) lastTrigger.focus();
    lastTrigger = null;
  }

  /* ---------------- Add to cart ---------------- */
  function cartElement() {
    return document.querySelector('cart-drawer') || document.querySelector('cart-notification');
  }

  function add() {
    if (!state || !state.variant || !state.variant.available) return;
    var addBtn = dialog.querySelector('[data-qa-add]');
    var errorEl = dialog.querySelector('[data-qa-error]');
    if (addBtn.getAttribute('aria-busy') === 'true') return;

    var variant = state.variant;
    var quantity = Math.max(1, parseInt(dialog.querySelector('[data-qa-qty-input]').value, 10) || 1);
    var cart = cartElement();
    var body = { items: [{ id: Number(variant.id), quantity: quantity }] };
    if (cart && typeof cart.getSectionsToRender === 'function') {
      body.sections = cart.getSectionsToRender().map(function (section) {
        return section.id;
      });
      body.sections_url = window.location.pathname;
    }

    addBtn.setAttribute('aria-busy', 'true');
    addBtn.disabled = true;
    errorEl.hidden = true;

    fetch((window.routes && window.routes.cart_add_url ? window.routes.cart_add_url : '/cart/add') + '.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/javascript' },
      body: JSON.stringify(body),
    })
      .then(function (response) {
        return response.json().then(function (data) {
          if (!response.ok || data.status) throw new Error(data.description || data.message || 'cart_error');
          return data;
        });
      })
      .then(function (data) {
        addBtn.removeAttribute('aria-busy');
        close();
        if (cart && typeof cart.renderContents === 'function') {
          if (cart.classList.contains('is-empty')) cart.classList.remove('is-empty');
          cart.renderContents(data);
        } else {
          window.location.href = (window.routes && window.routes.cart_url) || '/cart';
          return;
        }
        if (typeof publish === 'function' && typeof PUB_SUB_EVENTS !== 'undefined') {
          publish(PUB_SUB_EVENTS.cartUpdate, { source: 'aria-quick-add', productVariantId: variant.id, cartData: data });
        }
      })
      .catch(function (error) {
        addBtn.removeAttribute('aria-busy');
        addBtn.disabled = false;
        errorEl.textContent =
          error && error.message && error.message !== 'cart_error'
            ? error.message
            : 'Could not add to cart. Please try again.';
        errorEl.hidden = false;
      });
  }

  window.AriaQuickAdd = { open: open, close: close, cleanName: cleanName };
  document.dispatchEvent(new CustomEvent('aria-quick-add:ready'));
})();
