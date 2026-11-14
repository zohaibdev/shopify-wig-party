/* Wig Party — colour swatches on our own cards (snippets/wp-search-card.liquid,
   snippets/sale-card.liquid). Same behaviour as assets/aria-product-card.js, which is shared,
   not edited here, and bound to .aria-product-card markup, so it cannot drive these cards.

   Swatch click -> swap the card image to the variant image (data-image-url / -srcset,
   preloaded on hover, focus or touch), point the card links at ?variant=<id>, write the id
   into the quick-add form, re-price, refresh the wishlist snapshot and name the colour.
   "+N" reveals the colours rendered `hidden`, like the collection card.

   Delegated once at document level, so cards appended by "Show N more" (search) and the
   Sale load-more work with no re-init. State lives on each card element.

   Loaded by assets/wp-search-results.js and assets/sale-listing.js. */
(function () {
  if (window.__wpCardSwatchesInit) return;
  window.__wpCardSwatchesInit = true;

  var CARD = '[data-wp-card]';
  var SWATCH = '[data-wp-swatch]';
  var MORE = '[data-wp-swatch-more]';
  var SELECTED = 'is-selected';
  var TOOLTIP_CLASS = 'wp-card-swatch-tooltip';
  var TOOLTIP_VISIBLE = 'is-visible';
  var preloads = {};

  function closest(target, selector) {
    return target && target.closest ? target.closest(selector) : null;
  }

  /* A product with no images renders a placeholder <svg>: nothing to swap. */
  function mainImage(card) {
    return card.querySelector('[data-wp-card-media] img');
  }

  /* Captured on first interaction, so "default" is exactly what Liquid shipped. */
  function getState(card) {
    if (card.__wpSwatchState) return card.__wpSwatchState;
    var image = mainImage(card);
    card.__wpSwatchState = {
      defaultImage: image
        ? {
            src: image.getAttribute('src'),
            srcset: image.getAttribute('srcset'),
            alt: image.getAttribute('alt'),
          }
        : null,
      imageToken: 0,
      tooltip: null,
      tooltipTimer: null,
    };
    return card.__wpSwatchState;
  }

  /* Variant images are not loaded with the page; this fetches one the first time its swatch
     is hovered, focused or touched, so the click usually swaps from cache. */
  function preload(card, swatch) {
    var src = swatch.getAttribute('data-image-url');
    if (!src) return null;
    if (preloads[src]) return preloads[src];
    var image = mainImage(card);
    var img = new Image();
    if (image && image.getAttribute('sizes')) img.sizes = image.getAttribute('sizes');
    var srcset = swatch.getAttribute('data-image-srcset');
    if (srcset) img.srcset = srcset;
    img.src = src;
    preloads[src] = img;
    return img;
  }

  function applySelected(card, swatch) {
    card.querySelectorAll(SWATCH).forEach(function (other) {
      var isSelected = other === swatch;
      other.classList.toggle(SELECTED, isSelected);
      other.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
    });
  }

  /* A colour without its own image falls back to the image the card loaded with. The swap
     waits for the decoded image, and a later click wins over a slower earlier one. */
  function applyImage(card, state, swatch) {
    var image = mainImage(card);
    if (!image || !state.defaultImage) return;

    var variantSrc = swatch.getAttribute('data-image-url');
    var src = variantSrc || state.defaultImage.src;
    var srcset = variantSrc ? swatch.getAttribute('data-image-srcset') : state.defaultImage.srcset;
    var alt = variantSrc ? swatch.getAttribute('data-image-alt') : state.defaultImage.alt;

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
      if (alt !== null) image.setAttribute('alt', alt);
    };

    if (!variantSrc) {
      commit();
      return;
    }
    var loader = preload(card, swatch);
    if (loader.complete && loader.naturalWidth) {
      commit();
      return;
    }
    /* On error the current image simply stays. */
    loader.addEventListener('load', commit, { once: true });
  }

  function applyVariant(card, swatch) {
    var variantId = swatch.getAttribute('data-variant-id');
    if (!variantId) return;

    var input = card.querySelector('form input[name="id"]');
    if (input) input.value = variantId;

    var base = card.getAttribute('data-product-url');
    if (base) {
      card.querySelectorAll('[data-wp-card-link]').forEach(function (link) {
        link.setAttribute('href', base + '?variant=' + variantId);
      });
    }

    /* A sold-out product is disabled by Liquid for every colour; a busy button is
       product-form.js's to release. */
    if (card.getAttribute('data-sold-out') === 'true') return;
    var button = card.querySelector('form button[name="add"]');
    if (!button || button.classList.contains('loading')) return;
    if (swatch.getAttribute('data-variant-available') === 'false') {
      button.setAttribute('aria-disabled', 'true');
    } else {
      button.removeAttribute('aria-disabled');
    }
  }

  function applyPrice(card, swatch) {
    if (!swatch.hasAttribute('data-variant-id')) return;
    var row = card.querySelector('[data-aria-price]');
    var currentEl = row && row.querySelector('[data-aria-price-current]');
    if (!currentEl) return;

    var price = swatch.getAttribute('data-variant-price');
    var compare = swatch.getAttribute('data-variant-compare-price');
    if (price) currentEl.textContent = price;

    var compareEl = row.querySelector('[data-aria-price-compare]');
    if (compare) {
      if (!compareEl) {
        compareEl = document.createElement('span');
        compareEl.className = row.getAttribute('data-compare-class') || '';
        compareEl.setAttribute('data-aria-price-compare', '');
        row.appendChild(compareEl);
      }
      compareEl.textContent = compare;
    } else if (compareEl) {
      compareEl.remove();
    }

    /* Keeps assets/aria-discount-price.js quoting the new variant's automatic discount. */
    row.setAttribute('data-variant-id', swatch.getAttribute('data-variant-id'));
    row.setAttribute('data-price-value', swatch.getAttribute('data-variant-price-value') || '0');
    row.setAttribute('data-compare-value', swatch.getAttribute('data-variant-compare-value') || '0');
    if (window.AriaDiscountPrice) window.AriaDiscountPrice.apply(row);
  }

  /* assets/aria-wishlist.js snapshots these attributes at click time. */
  function applyWishlist(card, swatch) {
    var button = card.querySelector('[data-wishlist-toggle]');
    if (!button || !swatch.hasAttribute('data-variant-id')) return;
    button.setAttribute('data-variant-id', swatch.getAttribute('data-variant-id'));
    button.setAttribute('data-product-available', swatch.getAttribute('data-variant-available') || 'true');
    var price = swatch.getAttribute('data-variant-price');
    if (price) button.setAttribute('data-product-price', price);
    var compare = swatch.getAttribute('data-variant-compare-price');
    if (compare) {
      button.setAttribute('data-product-compare-price', compare);
    } else {
      button.removeAttribute('data-product-compare-price');
    }
    var thumb = swatch.getAttribute('data-image-thumb');
    if (thumb) button.setAttribute('data-product-image', thumb);
  }

  /* ---- Colour name: one tooltip per card, inside its swatch row, clamped to the row so it
     never overhangs the card. aria-hidden: each swatch already has aria-label. */
  function getTooltip(card, state) {
    if (state.tooltip && state.tooltip.isConnected) return state.tooltip;
    var row = card.querySelector('[data-wp-card-swatches]');
    if (!row) return null;
    var tooltip = document.createElement('span');
    tooltip.className = TOOLTIP_CLASS;
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
    if (state.tooltip) state.tooltip.classList.remove(TOOLTIP_VISIBLE);
  }

  function showTooltip(card, state, swatch, autoHide) {
    var name = swatch.getAttribute('data-swatch-value');
    var tooltip = name && getTooltip(card, state);
    if (!tooltip) return;
    if (state.tooltipTimer) {
      clearTimeout(state.tooltipTimer);
      state.tooltipTimer = null;
    }

    tooltip.textContent = name;
    var row = tooltip.offsetParent;
    var available = row ? row.clientWidth : 0;
    var width = tooltip.offsetWidth;
    var left = swatch.offsetLeft + swatch.offsetWidth / 2 - width / 2;
    left = Math.min(Math.max(0, left), Math.max(0, available - width));
    tooltip.style.left = left + 'px';
    tooltip.style.top = swatch.offsetTop - tooltip.offsetHeight - 6 + 'px';
    tooltip.classList.add(TOOLTIP_VISIBLE);

    /* A tap has no reliable mouseout, so click-driven shows time out. */
    if (autoHide) {
      state.tooltipTimer = setTimeout(function () {
        hideTooltip(state);
      }, 2500);
    }
  }

  /* "+N" unhides the colours already rendered for this card, then removes itself. */
  function revealHidden(card, control) {
    var swatches = card.querySelectorAll(SWATCH);
    swatches.forEach(function (swatch) {
      swatch.hidden = false;
    });
    control.setAttribute('aria-expanded', 'true');
    if (control.contains(document.activeElement) && swatches.length) {
      swatches[swatches.length - 1].focus();
    }
    control.remove();
  }

  document.addEventListener('click', function (event) {
    var card = closest(event.target, CARD);
    if (!card) return;

    var more = closest(event.target, MORE);
    if (more) {
      event.preventDefault();
      revealHidden(card, more);
      return;
    }

    var swatch = closest(event.target, SWATCH);
    if (!swatch) return;
    event.preventDefault();

    var state = getState(card);
    applySelected(card, swatch);
    applyVariant(card, swatch);
    applyImage(card, state, swatch);
    applyPrice(card, swatch);
    applyWishlist(card, swatch);
    showTooltip(card, state, swatch, true);
  });

  function onEnter(event) {
    var swatch = closest(event.target, SWATCH);
    var card = swatch && closest(swatch, CARD);
    if (!card) return;
    preload(card, swatch);
    if (event.type !== 'touchstart') showTooltip(card, getState(card), swatch, false);
  }

  function onLeave(event) {
    var swatch = closest(event.target, SWATCH);
    var card = swatch && closest(swatch, CARD);
    if (!card) return;
    /* Keep it for a keyboard user still focused on the swatch. */
    if (event.type === 'mouseout' && document.activeElement === swatch) return;
    hideTooltip(getState(card));
  }

  document.addEventListener('mouseover', onEnter);
  document.addEventListener('focusin', onEnter);
  document.addEventListener('touchstart', onEnter, { passive: true });
  document.addEventListener('mouseout', onLeave);
  document.addEventListener('focusout', onLeave);
})();
