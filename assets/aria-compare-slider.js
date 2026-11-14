/* Wig Party — Compare Shades, before/after slider (sections/compare-slider.liquid).
 *
 * Dragging anywhere on the photo (or a handle) moves the nearest split, as do the arrow keys
 * on a handle (Home / End jump to the ends). The splits are the --pos (A | B) and --pos-c
 * (B | C) custom properties on the element; the second only exists while a third shade is in.
 *
 * The sides follow the compare columns (sections/compare-shades.liquid): their element
 * announces the shades on the document ("aria-compare:change", detail { a, b, c }); this
 * element asks for them once on start ("aria-compare:request"). A shade with its own photo
 * replaces the built-in photo on its side; the stand-in wash over B stays only while A and B
 * are both the built-in photo. "Swap A and B" asks the columns to swap ("aria-compare:swap"),
 * or swaps the two sides here when the page has no compare columns. "Add a third" asks the
 * columns to add or drop their third column ("aria-compare:third", detail { on }); the split
 * goes three-way when a Shade C is announced and back to two when it is gone.
 */
(function () {
  if (customElements.get('aria-compare-slider')) return;

  /* The closest two lines may come to each other, in % of the photo's width. */
  var GAP = 4;

  class AriaCompareSlider extends HTMLElement {
    connectedCallback() {
      this.stage = this.querySelector('[data-stage]');
      this.handle = this.querySelector('[data-handle]');
      this.handleC = this.querySelector('[data-handle-c]');
      this.lineC = this.querySelector('[data-line-c]');
      this.layerB = this.querySelector('[data-b]');
      this.layerC = this.querySelector('[data-c]');
      this.imgA = this.querySelector('[data-side="a"]');
      this.imgB = this.querySelector('[data-side="b"]');
      this.imgC = this.querySelector('[data-side="c"]');
      this.thirdButton = this.querySelector('[data-third]');
      this.base = this.dataset.base;
      this.baseFallback = this.dataset.baseFallback === 'true';
      this.startPos = parseFloat(getComputedStyle(this).getPropertyValue('--pos')) || 50;
      this.pos = this.startPos;
      this.posC = 67;
      this.hasThird = false;

      this.onDown = this.onDown.bind(this);
      this.onMove = this.onMove.bind(this);
      this.onUp = this.onUp.bind(this);
      this.stage.addEventListener('pointerdown', this.onDown);
      this.handle.addEventListener('keydown', this.onKey.bind(this, 'a'));
      if (this.handleC) this.handleC.addEventListener('keydown', this.onKey.bind(this, 'c'));

      var swap = this.querySelector('[data-swap]');
      if (swap) swap.addEventListener('click', this.onSwap.bind(this));

      if (this.thirdButton) {
        /* A third shade is picked in the compare columns; without them there is none to add. */
        if (!document.querySelector('aria-compare-shades') || !this.layerC) {
          this.thirdButton.hidden = true;
        } else {
          this.thirdButton.addEventListener('click', this.onThird.bind(this));
        }
      }

      this.onPair = this.onPair.bind(this);
      document.addEventListener('aria-compare:change', this.onPair);
      document.dispatchEvent(new CustomEvent('aria-compare:request'));
    }

    disconnectedCallback() {
      document.removeEventListener('aria-compare:change', this.onPair);
    }

    /* Moves one split, keeping A | B left of B | C when both are there. */
    setPos(which, value) {
      if (which === 'c') {
        this.posC = Math.min(100, Math.max(this.pos + GAP, value));
        this.style.setProperty('--pos-c', this.posC + '%');
        this.handleC.setAttribute('aria-valuenow', String(Math.round(this.posC)));
        return;
      }
      var max = this.hasThird ? this.posC - GAP : 100;
      this.pos = Math.min(max, Math.max(0, value));
      this.style.setProperty('--pos', this.pos + '%');
      this.handle.setAttribute('aria-valuenow', String(Math.round(this.pos)));
    }

    posFromEvent(event) {
      var rect = this.stage.getBoundingClientRect();
      return ((event.clientX - rect.left) / rect.width) * 100;
    }

    onDown(event) {
      /* The buttons over the photo keep their own clicks. */
      if (event.target.closest('a, button:not([data-handle]):not([data-handle-c])')) return;
      if (event.button !== undefined && event.button !== 0) return;
      var at = this.posFromEvent(event);
      if (event.target.closest('[data-handle-c]')) this.dragging = 'c';
      else if (event.target.closest('[data-handle]')) this.dragging = 'a';
      else if (this.hasThird) this.dragging = Math.abs(at - this.posC) < Math.abs(at - this.pos) ? 'c' : 'a';
      else this.dragging = 'a';
      this.stage.setPointerCapture(event.pointerId);
      this.stage.addEventListener('pointermove', this.onMove);
      this.stage.addEventListener('pointerup', this.onUp);
      this.stage.addEventListener('pointercancel', this.onUp);
      this.setPos(this.dragging, at);
      event.preventDefault();
    }

    onMove(event) {
      if (this.dragging) this.setPos(this.dragging, this.posFromEvent(event));
    }

    onUp(event) {
      this.dragging = null;
      if (this.stage.hasPointerCapture(event.pointerId)) this.stage.releasePointerCapture(event.pointerId);
      this.stage.removeEventListener('pointermove', this.onMove);
      this.stage.removeEventListener('pointerup', this.onUp);
      this.stage.removeEventListener('pointercancel', this.onUp);
    }

    onKey(which, event) {
      var step = event.shiftKey ? 10 : 2;
      var current = which === 'c' ? this.posC : this.pos;
      var next = null;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next = current - step;
      else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next = current + step;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = 100;
      if (next === null) return;
      event.preventDefault();
      this.setPos(which, next);
    }

    onSwap() {
      if (document.querySelector('aria-compare-shades')) {
        document.dispatchEvent(new CustomEvent('aria-compare:swap'));
        return;
      }
      var a = this.imgA.getAttribute('src');
      var aFallback = this.imgA.classList.contains('is-fallback');
      this.imgA.src = this.imgB.getAttribute('src');
      this.imgA.classList.toggle('is-fallback', this.imgB.classList.contains('is-fallback'));
      this.imgB.src = a;
      this.imgB.classList.toggle('is-fallback', aFallback);
    }

    onThird() {
      document.dispatchEvent(new CustomEvent('aria-compare:third', { detail: { on: !this.hasThird } }));
    }

    /* Splits the photo in thirds when Shade C arrives, and back to the start when it goes. */
    setThird(on) {
      if (on === this.hasThird || !this.layerC) return;
      this.hasThird = on;
      this.layerC.hidden = !on;
      if (this.lineC) this.lineC.hidden = !on;
      if (this.handleC) this.handleC.hidden = !on;
      if (on) {
        this.setPos('a', 100 / 3);
        this.setPos('c', 200 / 3);
      } else {
        this.setPos('a', this.startPos);
      }
      if (this.thirdButton) {
        this.thirdButton.textContent = on ? this.thirdButton.dataset.labelRemove : this.thirdButton.dataset.labelAdd;
        this.thirdButton.setAttribute('aria-pressed', on ? 'true' : 'false');
      }
    }

    /* Prefers the shade's own landscape comparison_image; falls back to its portrait photo
       (object-fit: cover already crops it, see .aria-compare-slider__img) when only that is
       set; falls back to this section's built-in photo when the shade has no photo at all. */
    sidePhoto(shade) {
      if (!shade) return this.base;
      if (shade.comparison_image) return shade.comparison_image;
      if (shade.own_photo && shade.photo) return shade.photo;
      return this.base;
    }

    showSide(img, shade) {
      var src = this.sidePhoto(shade);
      if (img.getAttribute('src') !== src) img.src = src;
      /* The built-in photo is placed with Figma's crop per breakpoint (CSS .is-fallback). */
      img.classList.toggle('is-fallback', src === this.base && this.baseFallback);
      if (shade && shade.name) img.alt = shade.name;
      return src;
    }

    onPair(event) {
      var detail = event.detail || {};
      var a = this.showSide(this.imgA, detail.a);
      var b = this.showSide(this.imgB, detail.b);
      if (this.imgC && detail.c) this.showSide(this.imgC, detail.c);
      this.setThird(!!detail.c);
      this.layerB.classList.toggle('is-demo', a === this.base && b === this.base);
    }
  }

  customElements.define('aria-compare-slider', AriaCompareSlider);
})();
