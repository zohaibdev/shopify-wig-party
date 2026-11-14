/*
 * Wig Party — PDP buy box behaviour (sections/pdp-buy-box.liquid).
 *
 * Scoped to a custom element rather than a document listener because a PDP renders
 * exactly one buy box, and the theme's global delegated listeners (aria-wishlist.js,
 * aria-product-card.js) already own the document. Everything here is instance state.
 *
 * Add-to-cart itself is NOT reimplemented: the markup wraps a <product-form>, so
 * assets/product-form.js performs the fetch and opens the cart drawer exactly as it
 * does everywhere else in the theme.
 */
if (!customElements.get('aria-pdp-buy-box')) {
  customElements.define(
    'aria-pdp-buy-box',
    class AriaPdpBuyBox extends HTMLElement {
      connectedCallback() {
        this.currency = this.dataset.currency;
        this.variants = this.parseVariants();
        this.initGallery();
        this.initVariants();
        this.initQuantity();
        this.initDiscountPrice();
        this.initAccordions();
      }

      /*
       * The accordions carry a shared `name`, which already makes them an exclusive
       * group in browsers that support it. This closes the others explicitly for those
       * that do not, so exactly one row is open everywhere. Feature-detected, so on a
       * supporting browser it does nothing and the native behaviour is left alone.
       */
      initAccordions() {
        var rows = Array.from(this.querySelectorAll('.aria-pdp__accordion'));
        if (rows.length < 2) return;
        if ('name' in document.createElement('details')) return;

        rows.forEach(function (row) {
          row.addEventListener('toggle', function () {
            if (!row.open) return;
            rows.forEach(function (other) {
              if (other !== row) other.open = false;
            });
          });
        });
      }

      parseVariants() {
        const script = this.querySelector('[data-pdp-variants]');
        if (!script) return [];
        try {
          return JSON.parse(script.textContent) || [];
        } catch (e) {
          // A malformed payload must not take the gallery and stepper down with it.
          console.error('[aria-pdp-buy-box] could not parse variant data', e);
          return [];
        }
      }

      /* ---------------- Gallery ---------------- */

      initGallery() {
        this.slides = Array.from(this.querySelectorAll('[data-pdp-slide]'));
        this.thumbs = Array.from(this.querySelectorAll('[data-pdp-thumb]'));
        if (!this.thumbs.length) return;

        this.thumbs.forEach((thumb) => {
          thumb.addEventListener('click', () => this.showMedia(thumb.dataset.pdpThumb));
        });
      }

      showMedia(mediaId) {
        if (!mediaId) return;
        this.slides.forEach((slide) => {
          slide.hidden = slide.dataset.pdpSlide !== mediaId;
        });
        this.thumbs.forEach((thumb) => {
          thumb.setAttribute('aria-current', thumb.dataset.pdpThumb === mediaId ? 'true' : 'false');
        });
      }

      /* ---------------- Quantity ---------------- */

      initQuantity() {
        this.qtyInput = this.querySelector('[data-pdp-qty]');
        if (!this.qtyInput) return;

        this.querySelectorAll('[data-pdp-qty-step]').forEach((button) => {
          button.addEventListener('click', () => {
            const step = parseInt(button.dataset.pdpQtyStep, 10);
            const min = parseInt(this.qtyInput.min, 10) || 1;
            const current = parseInt(this.qtyInput.value, 10) || min;
            this.qtyInput.value = Math.max(min, current + step);
            this.qtyInput.dispatchEvent(new Event('change', { bubbles: true }));
            this.syncQuantityButtons();
          });
        });

        // Covers the stepper's own dispatched 'change' above AND a shopper typing a
        // quantity directly into the field.
        this.qtyInput.addEventListener('change', () => {
          this.syncQuantityButtons();
          this.updateSubmit(this.currentVariant);
        });
        this.syncQuantityButtons();
      }

      syncQuantityButtons() {
        const min = parseInt(this.qtyInput.min, 10) || 1;
        const current = parseInt(this.qtyInput.value, 10) || min;
        const minus = this.querySelector('[data-pdp-qty-step="-1"]');
        if (minus) minus.disabled = current <= min;
      }

      currentQuantity() {
        if (!this.qtyInput) return 1;
        const min = parseInt(this.qtyInput.min, 10) || 1;
        return parseInt(this.qtyInput.value, 10) || min;
      }

      /*
       * No `Shopify.formatMoney` helper is loaded anywhere in this theme, and the
       * variant payload's own `price` string is pre-formatted for a quantity of 1 only
       * (baked in server-side by the `money` filter) — multiplying it as text would mean
       * hand-parsing currency symbols and thousand separators back out. `Intl` does the
       * same job correctly (symbol placement, grouping, decimals) given just the ISO
       * currency code already on the root element and the shop's own presentment-
       * converted `price_value` (in the smallest currency unit, e.g. cents for USD).
       */
      formatMoney(subunits) {
        try {
          return new Intl.NumberFormat(document.documentElement.lang || undefined, {
            style: 'currency',
            currency: this.currency,
          }).format(subunits / 100);
        } catch (e) {
          // An unrecognised/missing currency code must not take the button down with it.
          return (subunits / 100).toFixed(2);
        }
      }

      /* ---------------- Variants ---------------- */

      /*
       * The product can carry more than one option (the design shows Colour AND Cap
       * size), so a control never maps to a variant on its own. Every change re-reads
       * the full option selection and looks up the variant matching all positions.
       */
      initVariants() {
        this.form = this.querySelector('form[data-type="add-to-cart-form"]');
        this.idInput = this.form && this.form.querySelector('input[name="id"]');

        // The page renders with a variant already selected (the hidden `id` input's
        // server-rendered value) — read it back so the quantity stepper has a variant
        // to multiply against before any option is ever touched.
        const initialId = this.idInput && parseInt(this.idInput.value, 10);
        this.currentVariant = this.variants.find((candidate) => candidate.id === initialId);

        this.optionInputs = Array.from(this.querySelectorAll('input[data-pdp-option]'));
        this.optionInputs.forEach((input) => {
          input.addEventListener('change', () => this.onOptionChange());
        });

        this.colourSelect = this.querySelector('[data-pdp-colour-select]');
        if (this.colourSelect) {
          this.colourSelect.addEventListener('change', () => {
            // The grid and the dropdown are two controls over one value; check the
            // matching radio so the selected swatch outline follows the dropdown.
            const match = this.optionInputs.find(
              (input) => input.dataset.pdpOption === this.colourSelect.dataset.pdpColourPosition
                && input.value === this.colourSelect.value
            );
            if (match) match.checked = true;
            this.onOptionChange();
          });
        }
      }

      /* Selected value for each 1-based option position, as a dense array. */
      currentOptions() {
        const values = [];
        this.optionInputs.forEach((input) => {
          if (!input.checked) return;
          values[parseInt(input.dataset.pdpOption, 10) - 1] = input.value;
        });
        return values;
      }

      onOptionChange() {
        const selected = this.currentOptions();
        const variant = this.variants.find((candidate) =>
          candidate.options.every((value, index) =>
            selected[index] === undefined || selected[index] === value
          )
        );

        if (!variant) {
          this.markUnavailable();
          return;
        }
        this.selectVariant(variant);
      }

      /* A combination with no variant behind it must not leave a stale, buyable id —
         nor a stale price the quantity stepper could go on multiplying. */
      markUnavailable() {
        this.currentVariant = null;

        const button = this.querySelector('[data-pdp-submit]');
        const text = this.querySelector('[data-pdp-submit-text]');
        if (button) {
          button.setAttribute('aria-disabled', 'true');
          button.disabled = true;
        }
        if (text) {
          text.textContent =
            (window.variantStrings && window.variantStrings.unavailable) || 'Unavailable';
        }
      }

      selectVariant(variant) {
        if (!variant || !this.idInput) return;

        this.currentVariant = variant;
        this.idInput.value = variant.id;
        this.idInput.disabled = false;

        // Deep-link the chosen colour so a shared or reloaded URL keeps it.
        if (window.history && window.history.replaceState) {
          const url = new URL(window.location.href);
          url.searchParams.set('variant', variant.id);
          window.history.replaceState({}, '', url.toString());
        }

        this.updatePrice(variant);
        this.updateColourLabel(variant);
        this.updateSubmit(variant);
        this.loadDiscountPrice(variant);
        this.updateSelect(variant);
        if (variant.featured_media_id) this.showMedia(String(variant.featured_media_id));

        // Let the rest of the theme (wishlist snapshot, analytics) see the change.
        this.querySelectorAll('[data-wishlist-toggle]').forEach((button) => {
          button.dataset.variantId = variant.id;
          button.dataset.productPrice = variant.price;
        });
      }

      /*
       * Price, "Save N%" and the instalment line follow `unitPriceFor()`: the variant's
       * price with any automatic discount applied, i.e. what the cart line will charge.
       * When a discount lowers the price and the variant has no compare-at, its own
       * price becomes the struck-through "was" figure, as in the cart drawer.
       */
      updatePrice(variant) {
        const price = this.querySelector('[data-pdp-price]');
        const compare = this.querySelector('[data-pdp-compare]');
        const save = this.querySelector('[data-pdp-save]');

        const unit = this.unitPriceFor(variant);
        if (price) price.textContent = this.formatMoney(unit);

        let wasValue = variant.compare_at_price_value;
        let wasText = variant.compare_at_price;
        if (!(wasValue > variant.price_value) && unit < variant.price_value) {
          wasValue = variant.price_value;
          wasText = variant.price;
        }

        const instalment = this.querySelector('[data-pdp-instalment]');
        if (instalment) instalment.textContent = this.formatMoney(Math.round(unit / 4));

        const onSale = wasValue > unit;
        if (compare) {
          compare.textContent = onSale ? wasText : '';
          compare.hidden = !onSale;
        }
        if (save) {
          const pct = onSale ? Math.round(((wasValue - unit) / wasValue) * 100) : 0;
          const label = pct > 0 ? this.saveLabel(pct) : '';
          save.textContent = label;
          save.hidden = !label;
        }
      }

      /* The rendered "Save 30%" string is the only place the wording lives; reuse it as a
         template so this never hardcodes English or the % placement. */
      saveLabel(percent) {
        const save = this.querySelector('[data-pdp-save]');
        const template = (save && save.dataset.labelTemplate) || '';
        if (template.indexOf('__PCT__') >= 0) {
          return template.replace('__PCT__', percent);
        }
        return `${percent}%`;
      }

      /* ---------------- Automatic discount ----------------
       * Shopify only applies automatic discounts in the cart, so the discounted price is
       * fetched by assets/aria-discount-price.js (one-line Storefront API cart per
       * variant; see that file). Until it lands, and whenever there is no discount or the
       * request fails, the variant's own price stands. */
      initDiscountPrice() {
        this.discountRatios = new Map();
        this.loadDiscountPrice(this.currentVariant);
      }

      loadDiscountPrice(variant) {
        if (!variant || !this.discountRatios || !window.AriaDiscountPrice) return;
        if (this.discountRatios.has(variant.id)) return;
        window.AriaDiscountPrice.ratio(variant.id).then((ratio) => {
          if (ratio === null || !(ratio < 1)) return;
          this.discountRatios.set(variant.id, ratio);
          if (this.currentVariant && this.currentVariant.id === variant.id) {
            this.updatePrice(variant);
            this.updateSubmit(variant);
          }
        });
      }

      /* Subunits charged for one of this variant once its automatic discount applies. */
      unitPriceFor(variant) {
        if (!variant) return 0;
        const ratio = this.discountRatios && this.discountRatios.get(variant.id);
        return ratio ? Math.round(variant.price_value * ratio) : variant.price_value;
      }

      updateColourLabel(variant) {
        const label = this.querySelector('[data-pdp-colour-name]');
        if (label) label.textContent = variant.colour || variant.title;
      }

      /*
       * Runs on both a variant change AND a quantity change — the button always reads
       * "Add to cart — " + (unit price x quantity), not just the unit price, so it
       * matches what actually lands in the cart rather than looking like a lower total
       * than what gets charged.
       */
      updateSubmit(variant) {
        const button = this.querySelector('[data-pdp-submit]');
        const text = this.querySelector('[data-pdp-submit-text]');
        if (!button || !text) return;
        if (!variant) return;

        if (variant.available) {
          button.removeAttribute('aria-disabled');
          button.disabled = false;
          const total = this.unitPriceFor(variant) * this.currentQuantity();
          text.textContent = `${button.dataset.addLabel} | ${this.formatMoney(total)}`;
        } else {
          button.setAttribute('aria-disabled', 'true');
          button.disabled = true;
          text.textContent = button.dataset.soldOutLabel;
        }
      }

      updateSelect(variant) {
        if (this.colourSelect && variant.colour && this.colourSelect.value !== variant.colour) {
          this.colourSelect.value = variant.colour;
        }
      }
    }
  );
}
