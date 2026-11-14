/*
 * Wig Party — PDP customer reviews (sections/pdp-reviews.liquid).
 *
 * Two small behaviours only. The photo strip is driven by the shared Swiper carousel
 * (assets/aria-product-carousel.js) via its data-attribute contract, so nothing about
 * that is reimplemented here.
 *
 *  1. Load more — reviews render server-side; those past the initial count are `hidden`
 *     and revealed a page at a time. No fetch, so it works with JS-rendered blocks and
 *     degrades to "all reviews visible" if this script fails to load.
 *  2. Read more — long review bodies are clamped to the design's three-line block and
 *     expanded in place.
 */
if (!customElements.get('aria-pdp-reviews')) {
  customElements.define(
    'aria-pdp-reviews',
    class AriaPdpReviews extends HTMLElement {
      connectedCallback() {
        this.step = parseInt(this.dataset.step, 10) || 3;
        this.initLoadMore();
        this.initReadMore();
      }

      initLoadMore() {
        this.button = this.querySelector('[data-reviews-more]');
        if (!this.button) return;

        this.button.addEventListener('click', () => {
          var hidden = this.querySelectorAll('[data-review][hidden]');
          for (var i = 0; i < this.step && i < hidden.length; i++) {
            hidden[i].hidden = false;
          }
          // Hide the control once nothing is left to reveal.
          if (!this.querySelector('[data-review][hidden]')) this.button.hidden = true;
        });

        if (!this.querySelector('[data-review][hidden]')) this.button.hidden = true;
      }

      /*
       * The design ends long bodies with "Read More". That word is part of the mock copy,
       * not the data, so the control is added here only where the text actually overflows
       * its clamp — measured after layout so it reflects real wrapping, not a guess.
       */
      initReadMore() {
        var self = this;
        requestAnimationFrame(function () {
          self.querySelectorAll('[data-review-text]').forEach(function (el) {
            if (el.scrollHeight <= el.clientHeight + 1) return;

            var toggle = document.createElement('button');
            toggle.type = 'button';
            toggle.className = 'aria-reviews__read-more';
            toggle.textContent = el.dataset.moreLabel || 'Read More';
            toggle.addEventListener('click', function () {
              var expanded = el.classList.toggle('is-expanded');
              toggle.textContent = expanded
                ? el.dataset.lessLabel || 'Read Less'
                : el.dataset.moreLabel || 'Read More';
            });
            el.insertAdjacentElement('afterend', toggle);
          });
        });
      }
    }
  );
}
