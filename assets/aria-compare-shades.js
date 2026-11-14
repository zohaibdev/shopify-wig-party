/* Wig Party: Compare Shades, side by side (sections/compare-shades.liquid).
 *
 * The shades are one wig's own variants (snippets/compare-wig-shades.liquid). The section
 * renders the default wig's shades as JSON ({ title, wig, handle, shades: [...] }); the wig
 * picker loads ?product=<handle>, and that wig's shades are then fetched through the Section
 * Rendering API (/products/<handle>?section_id=compare-product-shades).
 *
 * Events, unchanged for the slider and the table: "aria-compare:change" (detail { a, b, c }),
 * "aria-compare:swap", "aria-compare:request", "aria-compare:third" (detail { on }).
 * URL state: ?product=<handle>&a=<slug>&b=<slug>&c=<slug>.
 */
(function () {
  if (customElements.get('aria-compare-shades')) return;

  var root = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';

  class AriaCompareShades extends HTMLElement {
    connectedCallback() {
      this.columns = Array.prototype.slice.call(this.querySelectorAll('[data-column]'));
      this.container = this.querySelector('.aria-compare-shades__columns');
      this.picker = this.querySelector('[data-wig-picker]');

      var data = this.querySelector('script[data-shades]');
      var parsed = null;
      try {
        parsed = data ? JSON.parse(data.textContent) : null;
      } catch (error) {
        parsed = null;
      }

      this.columns.forEach(this.wire.bind(this));

      this.onSwap = this.swap.bind(this);
      this.onRequest = this.announce.bind(this);
      this.onThird = function (event) {
        var on = event.detail && event.detail.on;
        if (on) this.addThird();
        else this.removeThird();
        this.announce();
        this.updateUrl();
      }.bind(this);
      document.addEventListener('aria-compare:swap', this.onSwap);
      document.addEventListener('aria-compare:request', this.onRequest);
      document.addEventListener('aria-compare:third', this.onThird);

      if (this.picker) {
        this.picker.addEventListener(
          'change',
          function () {
            var params = new URLSearchParams();
            params.set('product', this.picker.value);
            var keep = new URLSearchParams(window.location.search).get('preview_theme_id');
            if (keep) params.set('preview_theme_id', keep);
            window.location.search = params.toString();
          }.bind(this)
        );
      }

      var product = this.param('product');
      if (product && (!parsed || parsed.handle !== product)) {
        this.loadProduct(product, parsed);
      } else {
        this.useWig(parsed);
      }
    }

    param(key) {
      try {
        return new URLSearchParams(window.location.search).get(key) || '';
      } catch (error) {
        return '';
      }
    }

    loadProduct(handle, fallback) {
      var url = root + 'products/' + encodeURIComponent(handle) + '?section_id=compare-product-shades';
      fetch(url)
        .then(function (response) {
          if (!response.ok) throw new Error(response.status);
          return response.text();
        })
        .then(
          function (html) {
            var node = new DOMParser().parseFromString(html, 'text/html').querySelector('[data-product-shades]');
            this.useWig(node ? JSON.parse(node.textContent) : fallback);
          }.bind(this)
        )
        .catch(
          function () {
            this.useWig(fallback);
          }.bind(this)
        );
    }

    useWig(wig) {
      this.wig = wig;
      this.shades = (wig && wig.shades) || [];
      if (this.picker && wig && wig.handle) {
        var exists = Array.prototype.some.call(this.picker.options, function (option) {
          return option.value === wig.handle;
        });
        if (!exists) {
          var option = document.createElement('option');
          option.value = wig.handle;
          option.textContent = wig.wig || wig.title || wig.handle;
          this.picker.insertBefore(option, this.picker.firstChild);
        }
        this.picker.value = wig.handle;
      }

      if (this.shades.length < 2) {
        this.showEmpty(wig);
        this.classList.remove('is-pending');
        return;
      }

      this.columns.forEach(
        function (column, i) {
          this.fill(column, Math.min(i, this.shades.length - 1));
        }.bind(this)
      );
      this.applyUrlParams();
      var startC = this.param('c');
      if (startC) this.addThird(startC);
      this.announce();
      this.classList.remove('is-pending');
    }

    fill(column, index) {
      var select = column.querySelector('[data-select]');
      if (!select) return;
      select.textContent = '';
      this.shades.forEach(function (shade, j) {
        var option = document.createElement('option');
        option.value = String(j);
        option.textContent = shade.name;
        select.appendChild(option);
      });
      select.value = String(index);
      this.show(column, this.shades[index]);
    }

    showEmpty(wig) {
      this.empty = true;
      this.classList.add('is-empty');
      document.documentElement.classList.add('aria-compare-empty');
      var box = this.querySelector('[data-compare-empty]');
      if (!box) return;
      var text = box.querySelector('[data-compare-empty-text]');
      if (text) text.textContent = text.textContent.replace('[product]', (wig && (wig.wig || wig.title)) || 'This wig');
      var link = box.querySelector('[data-compare-empty-link]');
      if (link && wig && wig.handle) link.href = root + 'products/' + encodeURIComponent(wig.handle);
      box.hidden = false;
    }

    wire(column) {
      var select = column.querySelector('[data-select]');
      if (!select) return;
      select.addEventListener(
        'change',
        function () {
          this.show(column, this.shades[parseInt(select.value, 10)]);
          this.announce();
          this.updateUrl();
        }.bind(this)
      );
    }

    indexOfSlug(slug) {
      for (var j = 0; j < this.shades.length; j++) {
        if (this.shades[j].slug === slug) return j;
      }
      return -1;
    }

    addThird(slug) {
      if (this.third || this.columns.length < 2 || !this.shades || this.shades.length < 3) return;
      var column = this.columns[1].cloneNode(true);
      var select = column.querySelector('[data-select]');
      if (!select) return;
      var id = select.id ? select.id.replace(/-\d+$/, '') + '-3' : '';
      if (id) select.id = id;
      var label = column.querySelector('.aria-compare-shades__label label');
      if (label) {
        label.textContent = this.dataset.labelC || 'SHADE C';
        if (id) label.setAttribute('for', id);
      }
      var taken = this.selected().map(function (shade) {
        return shade ? shade.slug : null;
      });
      var index = slug ? this.indexOfSlug(slug) : -1;
      if (index === -1) {
        index = 0;
        for (var j = 0; j < this.shades.length; j++) {
          if (taken.indexOf(this.shades[j].slug) === -1) {
            index = j;
            break;
          }
        }
      }
      column.setAttribute('data-column-third', '');
      this.container.appendChild(column);
      this.container.classList.add('has-third');
      this.columns.push(column);
      this.third = column;
      this.wire(column);
      select.value = String(index);
      this.show(column, this.shades[index]);
      this.say((this.dataset.labelC || 'Shade C') + ' added.');
    }

    removeThird() {
      if (!this.third) return;
      this.third.remove();
      this.columns = this.columns.filter(function (column) {
        return column !== this.third;
      }, this);
      this.third = null;
      this.container.classList.remove('has-third');
      this.say((this.dataset.labelC || 'Shade C') + ' removed.');
    }

    say(message) {
      var live = this.querySelector('[data-compare-announce]');
      if (live) live.textContent = message;
    }

    applyUrlParams() {
      var keys = ['a', 'b'];
      this.columns.forEach(
        function (column, i) {
          var slug = this.param(keys[i]);
          if (!slug) return;
          var index = this.indexOfSlug(slug);
          if (index === -1) return;
          var select = column.querySelector('[data-select]');
          if (!select) return;
          select.value = String(index);
          this.show(column, this.shades[index]);
        }.bind(this)
      );
    }

    updateUrl() {
      try {
        var params = new URLSearchParams(window.location.search);
        if (this.wig && this.wig.handle) params.set('product', this.wig.handle);
        var keys = ['a', 'b', 'c'];
        this.selected().forEach(function (shade, i) {
          if (shade && shade.slug && keys[i]) params.set(keys[i], shade.slug);
        });
        if (!this.third) params.delete('c');
        var query = params.toString();
        window.history.replaceState(null, '', window.location.pathname + (query ? '?' + query : '') + window.location.hash);
      } catch (error) {
        /* URL state is optional */
      }
    }

    disconnectedCallback() {
      if (this.onSwap) document.removeEventListener('aria-compare:swap', this.onSwap);
      if (this.onRequest) document.removeEventListener('aria-compare:request', this.onRequest);
      if (this.onThird) document.removeEventListener('aria-compare:third', this.onThird);
    }

    selected() {
      return this.columns.map(
        function (column) {
          var select = column.querySelector('[data-select]');
          return select && this.shades ? this.shades[parseInt(select.value, 10)] : null;
        }.bind(this)
      );
    }

    announce() {
      if (this.empty || !this.shades || !this.shades.length) return;
      var picked = this.selected();
      document.dispatchEvent(
        new CustomEvent('aria-compare:change', {
          detail: { a: picked[0] || null, b: picked[1] || null, c: (this.third && picked[2]) || null },
        })
      );
    }

    swap() {
      if (this.columns.length < 2) return;
      var first = this.columns[0].querySelector('[data-select]');
      var second = this.columns[1].querySelector('[data-select]');
      if (!first || !second) return;
      var value = first.value;
      first.value = second.value;
      second.value = value;
      this.show(this.columns[0], this.shades[parseInt(first.value, 10)]);
      this.show(this.columns[1], this.shades[parseInt(second.value, 10)]);
      this.announce();
      this.updateUrl();
      this.say('Shade A and Shade B swapped.');
    }

    show(column, shade) {
      if (!shade) return;
      var photo = column.querySelector('.aria-compare-shades__photo img');
      if (photo && shade.photo) {
        photo.removeAttribute('srcset');
        photo.removeAttribute('sizes');
        photo.src = shade.photo;
        photo.alt = shade.alt || shade.name || '';
      }
      var meta = column.querySelector('[data-meta]');
      if (meta) {
        meta.textContent = [shade.wig, shade.price, shade.status].filter(Boolean).join('  |  ');
      }
      var shop = column.querySelector('[data-shop]');
      if (shop && shade.url) shop.href = shade.url;
    }
  }

  customElements.define('aria-compare-shades', AriaCompareShades);
})();
