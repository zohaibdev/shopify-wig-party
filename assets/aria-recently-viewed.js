/* Wig Party — "recently viewed" product carousel (sections/pdp-product-carousel.liquid,
   source "Recently viewed by the shopper").

   Product pages record their handle in localStorage (inline script in layout/theme.liquid,
   key `aria:recently-viewed`, newest first). This element reads that list, leaves out the
   product on screen, and asks sections/aria-recently-viewed-cards.liquid for the cards in
   one request. The carousel markup waits in a <template> so aria-product-carousel.js does
   not initialise it empty; once the cards are in, it is inserted and handed to that driver
   with the same `shopify:section:load` event the recommendations carousel uses. With no
   history, or if anything fails, the section stays hidden. */
(function () {
  if (customElements.get('aria-recently-viewed')) return;

  var KEY = 'aria:recently-viewed';

  function readHandles() {
    try {
      var list = JSON.parse(window.localStorage.getItem(KEY) || '[]');
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }

  customElements.define(
    'aria-recently-viewed',
    class extends HTMLElement {
      connectedCallback() {
        if (this.dataset.loaded) return;
        this.dataset.loaded = 'true';

        var exclude = this.dataset.exclude || '';
        var limit = parseInt(this.dataset.limit, 10) || 8;
        var handles = readHandles()
          .filter(function (handle) {
            return handle && handle !== exclude && /^[a-z0-9-]+$/i.test(handle);
          })
          .slice(0, Math.min(limit, 12));
        if (!handles.length) return;

        var self = this;
        fetch(this.dataset.url + encodeURIComponent(handles.join(',')))
          .then(function (response) {
            if (!response.ok) throw new Error(response.status);
            return response.text();
          })
          .then(function (html) {
            var doc = new DOMParser().parseFromString(html, 'text/html');
            var slides = doc.querySelectorAll('.aria-pcar__slide');
            if (!slides.length) return;
            self.render(slides);
          })
          .catch(function () {});
      }

      render(slides) {
        var template = this.querySelector('template');
        if (!template) return;
        var content = template.content.cloneNode(true);
        var wrapper = content.querySelector('.swiper-wrapper');
        if (!wrapper) return;
        slides.forEach(function (slide) {
          wrapper.appendChild(document.importNode(slide, true));
        });
        template.replaceWith(content);

        var section = this.closest('.aria-pcar');
        if (section) section.hidden = false;
        this.dispatchEvent(new CustomEvent('shopify:section:load', { bubbles: true }));
      }
    }
  );
})();
