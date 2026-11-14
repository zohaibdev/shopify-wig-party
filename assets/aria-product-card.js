/* Wig Party — product card interactions (shared by every section that renders
   snippets/aria-product-card.liquid: Best Sellers and New & Trending).

   Colour swatch -> select that swatch's Shopify variant: swap the card's primary image to
   the variant's own image, repoint the quick-add form's variant id, and refresh the
   variant-dependent price/availability.

   The image swap only ever happens on an explicit click. On first load the card shows the
   product featured image that Liquid rendered, with the first colour ringed; it is not
   pre-swapped to that colour's variant image. Clicking the first colour is therefore a
   real interaction that does swap its image in.

   Also owns the per-card "+N more colours" reveal.

   Nothing here re-implements add to cart — the
   existing <product-form> (assets/product-form.js) keeps owning the AJAX request, the cart
   drawer, the loading/success/error states and the quantity field; it simply submits the
   variant id this file has written into its hidden input.

   Delegated once at document level so it works in any section, including sections the
   theme editor injects after load.

   State lives on each card element (`card.__ariaSwatchState`), never in a module-level
   variable and never reached with a bare document.querySelector, so two cards in the same
   carousel cannot read or write each other's selection. */
(function () {
  /* Loaded once from layout/theme.liquid. Previously included only by
     best-sellers.liquid, which left New & Trending's swatches completely inert. The
     guard keeps a duplicate include from registering a second listener. */
  if (window.__ariaProductCardInit) return;
  window.__ariaProductCardInit = true;

  var SWATCH_SELECTOR = '.aria-product-card__swatch';
  var MORE_SELECTOR = '[data-swatch-more]';
  var SELECTED_CLASS = 'aria-product-card__swatch--selected';
  var VARIANT_IMAGE_CLASS = 'aria-product-card--variant-image';

  /* Every lookup below is rooted at the card, which is the isolation boundary. */
  function query(card, selector) {
    return card.querySelector(selector);
  }

  function primaryImage(card) {
    var el = query(card, '.aria-product-card__image--primary');
    /* A product with no images renders a placeholder <svg> under the same class; there is
       nothing to swap on it. */
    return el && el.tagName === 'IMG' ? el : null;
  }

  /* Captured lazily on first interaction, so the initial render costs nothing and the
     "default" it remembers is exactly what Liquid shipped. */
  function getState(card) {
    if (card.__ariaSwatchState) return card.__ariaSwatchState;

    var image = primaryImage(card);
    var variantInput = query(card, '.aria-product-card__quick-add-form input[name="id"]');
    var currentPrice = query(card, '.aria-product-card__price-current');
    var comparePrice = query(card, '.aria-product-card__price-compare');
    var defaultVariantId = variantInput ? variantInput.value : null;

    card.__ariaSwatchState = {
      selectedSwatch: query(card, '.' + SELECTED_CLASS),
      selectedVariantId: defaultVariantId,
      selectedVariantImage: image ? image.getAttribute('src') : null,
      defaultVariantId: defaultVariantId,
      defaultImage: image
        ? {
            src: image.getAttribute('src'),
            srcset: image.getAttribute('srcset'),
            alt: image.getAttribute('alt'),
          }
        : null,
      defaultPrice: currentPrice ? currentPrice.textContent : null,
      defaultComparePrice: comparePrice ? comparePrice.textContent : null,
      /* What assets/aria-discount-price.js prices the row from by default. */
      defaultPriceAttrs: (function () {
        var row = query(card, '.aria-product-card__price');
        return row
          ? {
              variantId: row.getAttribute('data-variant-id'),
              priceValue: row.getAttribute('data-price-value'),
              compareValue: row.getAttribute('data-compare-value'),
            }
          : null;
      })(),
      /* Whether this card's hidden colours have been revealed. Per card, so expanding
         one product never expands another. */
      expanded: false,
      /* This card's own colour-name tooltip, created on first hover. */
      tooltip: null,
      tooltipTimer: null,
      /* Bumped on every swatch click so a slow image that lost the race cannot land after
         a later selection and leave the card showing the wrong colour. */
      imageToken: 0,
    };

    return card.__ariaSwatchState;
  }

  function applySwatchState(card, state, swatch) {
    card.querySelectorAll(SWATCH_SELECTOR).forEach(function (other) {
      var isSelected = other === swatch;
      other.classList.toggle(SELECTED_CLASS, isSelected);
      other.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
    });
    state.selectedSwatch = swatch;
  }

  /* Uses the variant image inlined in the swatch's data attributes — no /products/x.js
     round trip. A variant without its own image falls back to the product featured image
     the card loaded with. The <img> is absolutely positioned inside a fixed aspect-ratio
     box, so swapping src/srcset cannot move anything: dimensions, object-fit, radius and
     the surrounding grid all stay put. */
  function applyImage(card, state, swatch) {
    var image = primaryImage(card);
    if (!image || !state.defaultImage) return;

    var variantSrc = swatch.getAttribute('data-variant-image');
    var isVariantImage = !!variantSrc;
    var src = isVariantImage ? variantSrc : state.defaultImage.src;
    var srcset = isVariantImage
      ? swatch.getAttribute('data-variant-image-srcset')
      : state.defaultImage.srcset;
    var alt = isVariantImage ? swatch.getAttribute('data-variant-image-alt') : state.defaultImage.alt;

    state.selectedVariantImage = src;
    /* Once a specific colour is showing, the product-level second image is no longer a
       truthful hover partner for it. */
    card.classList.toggle(VARIANT_IMAGE_CLASS, isVariantImage);

    var token = ++state.imageToken;
    if (image.getAttribute('src') === src) return;

    var commit = function () {
      if (token !== state.imageToken) return;
      if (srcset) {
        image.setAttribute('srcset', srcset);
      } else {
        image.removeAttribute('srcset');
      }
      image.setAttribute('src', src);
      if (alt !== null && alt !== undefined) image.setAttribute('alt', alt);
    };

    /* Decode first, then swap, so the card never paints an empty or half-drawn frame.
       If the load fails the current image simply stays — better than a broken one. */
    var preload = new Image();
    preload.sizes = image.getAttribute('sizes') || '';
    if (srcset) preload.srcset = srcset;
    preload.src = src;

    if (preload.complete) {
      commit();
      return;
    }
    preload.addEventListener('load', commit, { once: true });
  }

  /* The variant id the existing quick-add form will submit. With no swatch data (a colour
     whose variant could not be resolved) the card keeps its default variant. */
  function applyVariant(card, state, swatch) {
    var variantId = swatch.getAttribute('data-variant-id') || state.defaultVariantId;
    state.selectedVariantId = variantId;

    var variantInput = query(card, '.aria-product-card__quick-add-form input[name="id"]');
    if (variantInput && variantId) variantInput.value = variantId;

    /* View product, the title and the image link carry the chosen colour to the PDP. */
    if (variantId) updateLinks(card, variantId);

    /* The cart icon opens the quick-add pop-up (assets/aria-quick-add-modal.js), where a
       sold-out shade is shown disabled and another can be picked, so the icon is no longer
       disabled per colour. A sold-out PRODUCT stays disabled by Liquid. */
  }

  function updateLinks(card, variantId) {
    card.querySelectorAll('[data-card-link]').forEach(function (link) {
      var href = link.getAttribute('href');
      if (!href) return;
      try {
        var url = new URL(href, window.location.origin);
        url.searchParams.set('variant', variantId);
        link.setAttribute('href', url.pathname + url.search + url.hash);
      } catch (error) {
        /* Leave the link as Liquid rendered it. */
      }
    });
  }

  /* ---- Quick-add pop-up -----------------------------------------------------------------
     The cart icon on a card opens the shade pop-up instead of posting the card's variant
     straight to the cart. The pop-up's script and stylesheet are loaded once, on demand,
     from the same asset folder as this file. If they cannot load, the click falls back to
     the PDP for the selected variant rather than adding a shade the shopper never chose. */
  var assetBase = (function () {
    var script = document.currentScript;
    var src = script && script.src;
    if (!src) return null;
    var cut = src.indexOf('aria-product-card.js');
    return cut === -1 ? null : src.slice(0, cut);
  })();
  var quickAddReady = null;

  function loadQuickAdd() {
    if (window.AriaQuickAdd) return Promise.resolve(window.AriaQuickAdd);
    if (quickAddReady) return quickAddReady;
    if (!assetBase) return Promise.reject(new Error('no_asset_base'));
    quickAddReady = new Promise(function (resolve, reject) {
      if (!document.querySelector('link[data-aria-quick-add-css]')) {
        var link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = assetBase + 'component-aria-quick-add.css';
        link.setAttribute('data-aria-quick-add-css', '');
        document.head.appendChild(link);
      }
      var script = document.createElement('script');
      script.src = assetBase + 'aria-quick-add-modal.js';
      script.onload = function () {
        if (window.AriaQuickAdd) resolve(window.AriaQuickAdd);
        else reject(new Error('quick_add_missing'));
      };
      script.onerror = function () {
        quickAddReady = null;
        reject(new Error('quick_add_load'));
      };
      document.head.appendChild(script);
    });
    return quickAddReady;
  }

  function cardVariantId(card) {
    var input = query(card, '.aria-product-card__quick-add-form input[name="id"]');
    return input ? input.value : '';
  }

  /* Capture phase, so the click is handled before <product-form> sees a submit. */
  document.addEventListener(
    'click',
    function (event) {
      var target = event.target;
      if (!target || !target.closest) return;
      var button = target.closest('.aria-product-card__cart-btn');
      if (!button) return;
      var card = button.closest('.aria-product-card[data-product-handle]');
      if (!card) return;

      event.preventDefault();
      event.stopPropagation();
      if (button.getAttribute('aria-disabled') === 'true' || button.disabled) return;

      var options = {
        handle: card.getAttribute('data-product-handle'),
        url: card.getAttribute('data-product-url'),
        title: card.getAttribute('data-product-title'),
        variantId: cardVariantId(card),
        trigger: button,
      };
      loadQuickAdd()
        .then(function (api) {
          api.open(options);
        })
        .catch(function () {
          var url = options.url || '/';
          window.location.href = url + (url.indexOf('?') === -1 ? '?' : '&') + 'variant=' + options.variantId;
        });
    },
    true
  );

  /* Warm the pop-up assets once the page has settled, so the first click opens instantly. */
  function warm() {
    if (!document.querySelector('.aria-product-card[data-product-handle]')) return;
    var idle = window.requestIdleCallback || function (fn) { return setTimeout(fn, 1500); };
    idle(function () {
      loadQuickAdd().catch(function () {});
    });
  }
  if (document.readyState === 'complete') warm();
  else window.addEventListener('load', warm, { once: true });

  function applyPrice(card, state, swatch) {
    var priceRow = query(card, '.aria-product-card__price');
    var currentEl = priceRow && priceRow.querySelector('.aria-product-card__price-current');
    if (!currentEl) return;

    /* A swatch that resolved a variant is authoritative, including when that variant has
       no compare-at price; one that resolved none restores the card's own defaults. */
    var hasVariantData = swatch.hasAttribute('data-variant-id');
    var price = hasVariantData ? swatch.getAttribute('data-variant-price') : state.defaultPrice;
    var compare = hasVariantData
      ? swatch.getAttribute('data-variant-compare-price')
      : state.defaultComparePrice;

    if (price) currentEl.textContent = price;

    var compareEl = priceRow.querySelector('.aria-product-card__price-compare');
    if (compare) {
      if (!compareEl) {
        compareEl = document.createElement('span');
        compareEl.className = 'aria-product-card__price-compare';
        compareEl.setAttribute('data-aria-price-compare', '');
        priceRow.appendChild(compareEl);
      }
      compareEl.textContent = compare;
    } else if (compareEl) {
      compareEl.remove();
    }

    /* Re-price for the new variant's automatic discount, so the card keeps quoting
       what the cart will charge. */
    var attrs = hasVariantData
      ? {
          variantId: swatch.getAttribute('data-variant-id'),
          priceValue: swatch.getAttribute('data-variant-price-value'),
          compareValue: swatch.getAttribute('data-variant-compare-value'),
        }
      : state.defaultPriceAttrs;
    if (attrs && attrs.variantId && attrs.priceValue) {
      priceRow.setAttribute('data-variant-id', attrs.variantId);
      priceRow.setAttribute('data-price-value', attrs.priceValue);
      priceRow.setAttribute('data-compare-value', attrs.compareValue || '0');
      if (window.AriaDiscountPrice) window.AriaDiscountPrice.apply(priceRow);
    }
  }

  /* ---- Colour-name tooltip ------------------------------------------------------------
     A 15px disc cannot say "CRUSHED ALMOND BLONDE - R", so the name is shown on hover,
     on keyboard focus, and when a colour is selected. One element per card, created on
     first use and parented to that card's swatch row — never a shared document-level
     node, which would leak one card's colour name onto another.

     The left offset is clamped to the row, which is the card's content width. That is what
     stops it overhanging the card and being cropped by the swiper's `overflow: hidden`,
     the same failure mode the selected ring had. It is aria-hidden because each swatch
     already carries `aria-label="Color: <name>"`; announcing both would be duplication. */
  function getTooltip(card, state) {
    if (state.tooltip && state.tooltip.isConnected) return state.tooltip;

    var row = query(card, '.aria-product-card__swatches');
    if (!row) return null;

    var tooltip = document.createElement('span');
    tooltip.className = 'aria-product-card__swatch-tooltip';
    tooltip.setAttribute('aria-hidden', 'true');
    row.appendChild(tooltip);
    state.tooltip = tooltip;
    return tooltip;
  }

  function hideTooltip(state) {
    if (state.tooltipTimer) {
      clearTimeout(state.tooltipTimer);
      state.tooltipTimer = null;
    }
    if (state.tooltip) state.tooltip.classList.remove('aria-product-card__swatch-tooltip--visible');
  }

  function showTooltip(card, state, swatch, autoHide) {
    var name = swatch.getAttribute('data-swatch-value');
    if (!name) return;

    var tooltip = getTooltip(card, state);
    if (!tooltip) return;

    if (state.tooltipTimer) {
      clearTimeout(state.tooltipTimer);
      state.tooltipTimer = null;
    }

    tooltip.textContent = name;

    /* Measured after the text is in, and offset* is relative to the row (its offsetParent),
       so a wrapped second line of swatches is handled without special cases. */
    var row = tooltip.offsetParent || query(card, '.aria-product-card__swatches');
    var available = row ? row.clientWidth : 0;
    var width = tooltip.offsetWidth;
    var left = swatch.offsetLeft + swatch.offsetWidth / 2 - width / 2;
    var maxLeft = Math.max(0, available - width);
    if (left < 0) left = 0;
    if (left > maxLeft) left = maxLeft;

    tooltip.style.left = left + 'px';
    tooltip.style.top = swatch.offsetTop - tooltip.offsetHeight - 6 + 'px';
    tooltip.classList.add('aria-product-card__swatch-tooltip--visible');

    /* A tap fires mouseover but no reliable mouseout, and a click leaves the pointer
       parked on the swatch, so pointer-driven shows get a timer. Hover and focus don't:
       they have real exit events. */
    if (autoHide) {
      state.tooltipTimer = setTimeout(function () {
        hideTooltip(state);
      }, 2500);
    }
  }

  /* "+N more colours" reveals the colours this card already rendered `hidden`. It changes
     nothing else: not the ringed swatch, not the variant, not the image — and, because it
     only unhides existing markup, colours cannot be duplicated or reordered. The control
     removes itself afterwards rather than sitting there doing nothing. */
  function revealHiddenSwatches(card, state) {
    card.querySelectorAll(SWATCH_SELECTOR).forEach(function (swatch) {
      swatch.hidden = false;
    });
    state.expanded = true;

    var control = card.querySelector(MORE_SELECTOR);
    if (!control) return;
    control.setAttribute('aria-expanded', 'true');
    /* Keep keyboard focus somewhere sensible before the control leaves the DOM. */
    if (control.contains(document.activeElement)) {
      var last = card.querySelectorAll(SWATCH_SELECTOR);
      if (last.length) last[last.length - 1].focus();
    }
    control.remove();
  }

  document.addEventListener('click', function (event) {
    var target = event.target;
    if (!target || !target.closest) return;

    var card = target.closest('.aria-product-card');
    if (!card) return;

    if (target.closest(MORE_SELECTOR)) {
      revealHiddenSwatches(card, getState(card));
      return;
    }

    var swatch = target.closest(SWATCH_SELECTOR);
    if (!swatch) return;

    /* No early return for the already-ringed swatch: on first load the card shows the
       product featured image with the first colour ringed, so clicking that first colour
       has to be what swaps its own variant image in. Each apply* is idempotent. */
    var state = getState(card);

    applySwatchState(card, state, swatch);
    applyVariant(card, state, swatch);
    applyImage(card, state, swatch);
    applyPrice(card, state, swatch);
    /* Selecting a colour names it too, not just hovering it. */
    showTooltip(card, state, swatch, true);
  });

  /* Hover and keyboard focus both name the colour. Each handler resolves the card from the
     event target, so a tooltip can only ever be shown on the card being pointed at. */
  function swatchFrom(event) {
    var target = event.target;
    if (!target || !target.closest) return null;
    return target.closest(SWATCH_SELECTOR);
  }

  document.addEventListener('mouseover', function (event) {
    var swatch = swatchFrom(event);
    if (!swatch) return;
    var card = swatch.closest('.aria-product-card');
    if (card) showTooltip(card, getState(card), swatch, false);
  });

  document.addEventListener('mouseout', function (event) {
    var swatch = swatchFrom(event);
    if (!swatch) return;
    var card = swatch.closest('.aria-product-card');
    if (!card) return;
    /* Don't yank it away from a keyboard user whose focus is still on the swatch. */
    if (document.activeElement === swatch) return;
    hideTooltip(getState(card));
  });

  document.addEventListener('focusin', function (event) {
    var swatch = swatchFrom(event);
    if (!swatch) return;
    var card = swatch.closest('.aria-product-card');
    if (card) showTooltip(card, getState(card), swatch, false);
  });

  document.addEventListener('focusout', function (event) {
    var swatch = swatchFrom(event);
    if (!swatch) return;
    var card = swatch.closest('.aria-product-card');
    if (card) hideTooltip(getState(card));
  });
})();
